import { defineContract } from '@prisma/orm-postgres/contract-builder';
import { typedJson, typedText } from 'prisma-orm-extension-typed-json/column-types';
import typedPack from 'prisma-orm-extension-typed-json/pack';

export type Status = 'draft' | 'published';

export const contract = defineContract(
  {},
  ({ field, model }) => ({
    // Registration 1 of 3: the contract plane, next to `models`.
    extensions: {
      typedJson: typedPack,
    },
    models: {
      Account: model('Account', {
        fields: {
          id: field.id.uuidv7String(),
          email: field.text().unique(),
          settings: field.column(typedJson<PrismaJson.Settings>('PrismaJson.Settings')),
          status: field.column(typedText<Status>("'draft' | 'published'")),
        },
      }),
    },
  }),
);
