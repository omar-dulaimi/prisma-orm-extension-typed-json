import 'dotenv/config';
import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';
import { typedExtensionDescriptor } from 'prisma-orm-extension-typed-json/control';

// The TypeScript door: a contract authored with the builder.
export default definePrismaConfig({
  orm: ormConfig({
    contract: './src/prisma/contract.ts',
    extensions: [typedExtensionDescriptor],
    db: {
      connection: process.env['DATABASE_URL']!,
    },
  }),
});
