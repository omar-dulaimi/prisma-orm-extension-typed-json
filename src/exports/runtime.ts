/**
 * Runtime-plane extension descriptor.
 *
 * Registers both codecs through the SQL runtime's `codecs:` slot. Lives at the runtime entrypoint so
 * `src/core/**` stays free of runtime-plane imports.
 */

import type { SqlRuntimeExtensionDescriptor } from '@prisma/orm-family-sql/runtime';
import { typedPackMeta } from '../core/pack-meta.js';
import { typedCodecRegistry } from '../core/registry.js';

export const typedRuntimeDescriptor: SqlRuntimeExtensionDescriptor<'postgres'> = {
  kind: 'extension' as const,
  id: typedPackMeta.id,
  version: typedPackMeta.version,
  familyId: 'sql' as const,
  targetId: 'postgres' as const,
  types: {
    codecTypes: {
      codecDescriptors: Array.from(typedCodecRegistry.values()),
    },
  },
  codecs: () => Array.from(typedCodecRegistry.values()),
  create() {
    return {
      familyId: 'sql' as const,
      targetId: 'postgres' as const,
    };
  },
};

export default typedRuntimeDescriptor;
