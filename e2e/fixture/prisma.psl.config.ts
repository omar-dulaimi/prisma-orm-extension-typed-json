import 'dotenv/config';
import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';
import { typedExtensionDescriptor } from 'prisma-orm-extension-typed-json/control';

// The PSL door: the same columns declared in contract.prisma, against its own database.
export default definePrismaConfig({
  orm: ormConfig({
    contract: './src/psl/contract.prisma',
    extensions: [typedExtensionDescriptor],
    db: {
      connection: process.env['DATABASE_URL_PSL']!,
    },
  }),
});
