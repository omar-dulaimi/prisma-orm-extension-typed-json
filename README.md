# prisma-orm-extension-typed-json

[![CI](https://github.com/omar-dulaimi/prisma-orm-extension-typed-json/actions/workflows/ci.yml/badge.svg)](https://github.com/omar-dulaimi/prisma-orm-extension-typed-json/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/prisma-orm-extension-typed-json.svg)](https://www.npmjs.com/package/prisma-orm-extension-typed-json)

Typed JSON and typed text columns for Prisma 8, with no validator and no runtime cost: a
[Prisma 8 extension](https://www.prisma.io/docs/orm/v8/extensions/using-extensions) implementing the
`typed/json@1` and `typed/text@1` codecs.

An extension is a package that adds a database capability Prisma 8 does not have out of the box, while
keeping the Prisma 8 experience: typed schema declarations, generated TypeScript, migration support, and
query helpers that feel native to your app. This one adds what
[prisma-json-types-generator](https://github.com/arthurfiorette/prisma-json-types-generator) gave Prisma
4 to 7: a `jsonb` column whose TypeScript type is whatever you say it is, and a `text` column narrowed
to a literal union. The type is compile-time only. Values pass through unchanged, rows written before
the type existed keep reading, and nothing is installed or validated.

```ts
// Your existing PrismaJson namespace file works as-is.
declare global {
  namespace PrismaJson {
    interface Settings { theme: 'light' | 'dark'; tags: string[] }
  }
}

Account: model('Account', {
  fields: {
    id: field.id.uuidv7String(),
    settings: field.column(typedJson<PrismaJson.Settings>('PrismaJson.Settings')),
    status: field.column(typedText<'draft' | 'published'>("'draft' | 'published'")),
  },
}),
```

The string is the TypeScript type expression, printed verbatim into the emitted `contract.d.ts`. The
type parameter is the same type for the no-emit path. Keep the two in agreement; the package keeps the
string safe (single line, balanced brackets, no stray `;`) and fails at the call site otherwise.

The type applies on both sides of the client: `create` and `update` inputs for the column are checked
against it, and rows come back narrowed to it. What never happens is a runtime check, so data that
bypasses TypeScript (an old row, an `as never`, a raw SQL write) is stored and returned as-is.

If you want the column validated at runtime as well, that is a different codec:
[prisma-orm-extension-zod-json](https://github.com/omar-dulaimi/prisma-orm-extension-zod-json)
validates on write and read from a zod schema.

## 1. Install the package

```sh
npm install prisma-orm-extension-typed-json @prisma/orm-postgres@8.0.0-rc.4 @prisma/cli-engine@0.2.0
npm install -D prisma@next
```

No validator library is pulled in. `@prisma/orm-postgres` is the Prisma 8 facade your app talks to,
`@prisma/cli-engine` provides `definePrismaConfig` for `prisma.config.ts` (it has to be a direct
dependency for that import to resolve), and `prisma` is the unified CLI. This package's version
always matches the Prisma release it targets (see Versioning below), so keep it aligned with
`@prisma/orm-postgres`.

## 2. Register it in the config

Prisma 8 uses this registration when it emits your contract and plans migrations:

```ts
// prisma.config.ts
import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';
import { typedExtensionDescriptor } from 'prisma-orm-extension-typed-json/control';

export default definePrismaConfig({
  orm: ormConfig({
    contract: './src/prisma/contract.ts',
    extensions: [typedExtensionDescriptor],
    db: { connection: process.env.DATABASE_URL! },
  }),
});
```

## 3. Register it on the client

Prisma 8 uses this registration when your app runs queries. Pass your emitted `Contract` type
explicitly so the client is fully typed, not `unknown`:

```ts
// src/prisma/db.ts
import postgres from '@prisma/orm-postgres/runtime';
import { typedRuntimeDescriptor } from 'prisma-orm-extension-typed-json/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

export const db = postgres<Contract>({ contractJson, url, extensions: [typedRuntimeDescriptor] });
```

## 4. Use it in your contract

With the TypeScript builder, add the pack next to `models` and declare columns with `typedJson` and
`typedText`:

```ts
import { defineContract } from '@prisma/orm-postgres/contract-builder';
import { typedJson, typedText } from 'prisma-orm-extension-typed-json/column-types';
import typedPack from 'prisma-orm-extension-typed-json/pack';

export const contract = defineContract({}, ({ field, model }) => ({
  extensions: { typedJson: typedPack },
  models: {
    Account: model('Account', {
      fields: {
        id: field.id.uuidv7String(),
        settings: field.column(typedJson<PrismaJson.Settings>('PrismaJson.Settings')),
        status: field.column(typedText<'draft' | 'published'>("'draft' | 'published'")),
      },
    }),
  },
}));
```

With PSL, the same columns need no TypeScript at all:

```prisma
types {
  Settings = typed.Json("PrismaJson.Settings")
  Status   = typed.Text("'draft' | 'published'")
}

model Account {
  id       String   @id @default(uuid())
  settings Settings
  status   Status
}
```

Both doors emit the same `contract.d.ts`:

```ts
readonly settings: PrismaJson.Settings;
readonly status: 'draft' | 'published';
```

## 5. Apply and query

```sh
npx prisma contract emit
npx prisma db init
```

`contract emit` stores the type expression in `contract.json` and prints it into `contract.d.ts`.
`db init` (or `db update` on an existing database) creates a plain `jsonb` or `text` column. From
there the client returns the narrowed types and stores whatever you write, and a missing registration
surfaces as a clear error naming what is absent, not silent misbehaviour.

## Migrating from prisma-json-types-generator

Prisma 8 has no generated client to patch and no generator hook, so the generator itself cannot run
there. The idea survives unchanged:

| prisma-json-types-generator | this package |
| --- | --- |
| `/// [Settings]` on a `Json` field | `typedJson<PrismaJson.Settings>('PrismaJson.Settings')`, or `typed.Json("PrismaJson.Settings")` in PSL |
| `/// !['draft' \| 'published']` on a `String` field | `typedText<'draft' \| 'published'>("'draft' \| 'published'")`, or `typed.Text(...)` in PSL |
| `declare global { namespace PrismaJson { ... } }` | unchanged, keep the file |
| types only, no runtime validation | the same |

Two differences to know about. The type reference is a string now, because it has to travel through
`contract.json`; the `PrismaJson.` prefix is a convention you keep, not something the package requires.
And the storage type is explicit: `typedJson` is `jsonb`. A column that was native `json` (not `jsonb`)
shows up as a type change in your first migration plan.

## What this is not

It does not validate. A value the type forbids is stored and read back exactly as written, which is
the point: it matches how prisma-json-types-generator behaved, and it means switching a column to a
typed one never changes what existing rows return. When you want the database boundary enforced,
reach for a validator codec instead.

## Versioning and status

Versions mirror the Prisma release this package targets, the same convention Prisma's own extensions
use: installing `prisma-orm-extension-typed-json@8.0.0-rc.4` gets you the build for Prisma `8.0.0-rc.4`.
A fix released between Prisma versions appends a counter (`8.0.0-rc.4.1`), which semver orders after
its base and before the next Prisma release.

Early; tracks the Prisma v8 release-candidate line, which is still moving.
