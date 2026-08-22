/**
 * Asserts that `contract emit` carried both codecs into both contract planes with the type
 * expression intact. Run as `node ../assert-contract.mjs <contract.json> <Model>`.
 */
import { readFileSync } from 'node:fs';

const [file, modelName] = process.argv.slice(2);
if (!file || !modelName) {
  console.error('usage: assert-contract.mjs <contract.json> <Model>');
  process.exit(2);
}
const contract = JSON.parse(readFileSync(file, 'utf8'));

const problems = [];
const check = (ok, detail) => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${detail}`);
  if (!ok) problems.push(detail);
};

const model = contract.domain?.namespaces?.public?.models?.[modelName];
check(model?.fields?.settings?.type?.codecId === 'typed/json@1', 'the domain plane records typed/json@1 for settings');
check(model?.fields?.status?.type?.codecId === 'typed/text@1', 'the domain plane records typed/text@1 for status');

const tables = contract.storage?.namespaces?.public?.entries?.table ?? {};
const table = tables[Object.keys(tables)[0]];
const settings = table?.columns?.settings;
const status = table?.columns?.status;

check(settings?.codecId === 'typed/json@1', 'the storage plane records typed/json@1 for settings');
check(settings?.nativeType === 'jsonb', 'settings is backed by jsonb');
check(status?.codecId === 'typed/text@1', 'the storage plane records typed/text@1 for status');
check(status?.nativeType === 'text', 'status is backed by text');

// The PSL door stores params on the named type (`storage.types.<Name>`) and points the column at
// it through `typeRef`; the TypeScript door stores params on the column itself. Either way the
// expression must survive.
const namedTypes = contract.storage?.types ?? {};
const paramsOf = (column) => column?.typeParams ?? namedTypes[column?.typeRef]?.typeParams;

const settingsParams = paramsOf(settings);
const statusParams = paramsOf(status);
check(settingsParams?.tsType === 'PrismaJson.Settings', `settings carries tsType PrismaJson.Settings (got ${settingsParams?.tsType})`);
check(statusParams?.tsType === "'draft' | 'published'", `status carries the literal union (got ${statusParams?.tsType})`);

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s) in the emitted contract.`);
  process.exit(1);
}
console.log('\nThe emitted contract carries both codecs on both planes, type expressions intact.');
