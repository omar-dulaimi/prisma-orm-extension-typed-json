/**
 * Control-plane extension descriptor.
 *
 * Nothing to install: `jsonb` and `text` are built-in Postgres types, and the stored `tsType` affects
 * only the emitted TypeScript, never DDL. So the sole control hook is an identity `expandNativeType`,
 * registered once per codec. Lives at the control entrypoint so `src/core/**` stays free of
 * migration-plane imports.
 */

import type { CodecControlHooks, SqlControlExtensionDescriptor } from '@prisma/orm-family-sql/family/control';
import { typedPackMeta } from '../core/pack-meta.js';
import { TYPED_JSON_CODEC_ID, TYPED_TEXT_CODEC_ID } from '../core/typed-codecs.js';

const passthroughHooks: CodecControlHooks = {
  expandNativeType: ({ nativeType }) => nativeType,
};

export const typedExtensionDescriptor: SqlControlExtensionDescriptor<'postgres'> = {
  ...typedPackMeta,
  types: {
    ...typedPackMeta.types,
    codecTypes: {
      ...typedPackMeta.types.codecTypes,
      controlPlaneHooks: {
        [TYPED_JSON_CODEC_ID]: passthroughHooks,
        [TYPED_TEXT_CODEC_ID]: passthroughHooks,
      },
    },
  },
  create: () => ({
    familyId: 'sql' as const,
    targetId: 'postgres' as const,
  }),
};

export default typedExtensionDescriptor;
