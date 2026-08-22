/**
 * The runtime claim: both codecs are passthroughs on real Postgres columns.
 *
 * Unit tests cannot prove that: they never go through `contract emit`, the DDL planner or the query
 * path. This does, for whichever door DOOR selects (`ts`, the default, or `psl`). Exits non-zero on
 * the first broken expectation.
 */
import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
// Registration 3 of 3: the runtime plane.
import { typedRuntimeDescriptor } from 'prisma-orm-extension-typed-json/runtime';
import type { Contract as TsContract } from './src/prisma/contract.d';
import type { Contract as PslContract } from './src/psl/contract.d';
import tsContractJson from './src/prisma/contract.json' with { type: 'json' };
import pslContractJson from './src/psl/contract.json' with { type: 'json' };

const door = process.env['DOOR'] === 'psl' ? 'psl' : 'ts';

// Each door has its own contract type, model name, and database; the checks are identical.
const records =
  door === 'psl'
    ? postgres<PslContract>({
        contractJson: pslContractJson,
        url: process.env['DATABASE_URL_PSL']!,
        extensions: [typedRuntimeDescriptor],
      }).orm.public.Profile
    : postgres<TsContract>({
        contractJson: tsContractJson,
        url: process.env['DATABASE_URL']!,
        extensions: [typedRuntimeDescriptor],
      }).orm.public.Account;

const failures: string[] = [];
let checks = 0;
const record = (ok: boolean, detail: string): void => {
  checks += 1;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${detail}`);
  if (!ok) failures.push(detail);
};
// jsonb canonicalises key order (shorter keys first), so compare structurally, never byte-for-byte.
const canon = (v: unknown): string =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );

const run = process.env['E2E_RUN_ID'] ?? String(Date.now());
const idFor = (n: number) => `${run}-${n}`.padStart(36, '0').slice(-36);
const create = (n: number, data: Record<string, unknown>) =>
  records.create({ id: idFor(n), email: `user${n}.${run}.${door}@example.test`, ...data } as never);
const find = async (n: number) => (await records.all()).find((r) => r.id === idFor(n));

// 1. Well-typed values round-trip.
const settings: PrismaJson.Settings = { theme: 'dark', digestHour: 9, tags: ['x', 'y'] };
await create(1, { settings, status: 'published' });
const r1 = await find(1);
record(canon(r1?.settings) === canon(settings), `[${door}] a typed JSON value round-trips unchanged`);
record(r1?.status === 'published', `[${door}] a typed text value round-trips unchanged`);

// 2. The types are compile-time only: values the types forbid still commit and read back untouched.
//    That is the prisma-json-types-generator contract, and the guarantee that rows written before
//    any annotation existed keep reading.
const offType = { theme: 'neon', legacy: true };
await create(2, { settings: offType, status: 'archived' });
const r2 = await find(2);
record(canon(r2?.settings) === canon(offType), `[${door}] an off-type JSON value passes through with no validation`);
record(r2?.status === 'archived', `[${door}] an off-union text value passes through with no validation`);

// 3. The narrowed type is what the client returns: this assignment only compiles because
//    `status` is 'draft' | 'published' at the type level (see typecheck-contract.ts for the
//    negative controls); at runtime it is still just the stored string.
const narrowed: 'draft' | 'published' | undefined = r1?.status;
record(narrowed === 'published', `[${door}] the client returns the stored string under the narrowed type`);

console.log(`\n[${door}] ${checks - failures.length}/${checks} checks passed`);
if (failures.length > 0) {
  console.error(`\n${failures.length} FAILED:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
process.exit(0);
