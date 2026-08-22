/**
 * Pack metadata: the framework-composition entry point.
 *
 * Three things live here. `types.codecTypes.import` tells the emitter where to import `CodecTypes`
 * from when it writes `contract.d.ts`. `types.storage` declares the native type behind each codec.
 * And `authoring.type` registers the PSL constructors, so a contract written in `.prisma` rather
 * than TypeScript can declare the same columns:
 *
 *     types {
 *       Settings = typed.Json("PrismaJson.Settings")
 *       Status   = typed.Text("'draft' | 'published'")
 *     }
 *
 * The single string argument is the TypeScript type expression, carried into `typeParams.tsType`
 * exactly as the TypeScript helpers store it.
 */
import type { CodecTypes } from '../types/codec-types.js';
import { typedCodecRegistry } from './registry.js';
import { TYPED_JSON_CODEC_ID, TYPED_TEXT_CODEC_ID } from './typed-codecs.js';

const tsTypeArg = [{ kind: 'string' as const, name: 'tsType' }];
const fromFirstArg = { tsType: { kind: 'arg' as const, index: 0 } };

const typedPackMetaBase = {
  kind: 'extension',
  id: 'typed-json',
  familyId: 'sql',
  targetId: 'postgres',
  version: '0.1.0',
  capabilities: {},
  authoring: {
    type: {
      typed: {
        Json: {
          kind: 'typeConstructor' as const,
          args: tsTypeArg,
          output: { codecId: TYPED_JSON_CODEC_ID, nativeType: 'jsonb', typeParams: fromFirstArg },
        },
        Text: {
          kind: 'typeConstructor' as const,
          args: tsTypeArg,
          output: { codecId: TYPED_TEXT_CODEC_ID, nativeType: 'text', typeParams: fromFirstArg },
        },
      },
    },
  },
  types: {
    codecTypes: {
      codecDescriptors: Array.from(typedCodecRegistry.values()),
      import: {
        package: 'prisma-orm-extension-typed-json/codec-types',
        named: 'CodecTypes',
        alias: 'TypedJsonTypes',
      },
    },
    storage: [
      { typeId: TYPED_JSON_CODEC_ID, familyId: 'sql' as const, targetId: 'postgres' as const, nativeType: 'jsonb' },
      { typeId: TYPED_TEXT_CODEC_ID, familyId: 'sql' as const, targetId: 'postgres' as const, nativeType: 'text' },
    ],
  },
} as const;

/**
 * Public pack metadata. The phantom `__codecTypes` field threads the codec-types map's literal type
 * into the pack ref for contract-builder generics; it is never read at runtime.
 */
export const typedPackMeta: typeof typedPackMetaBase & {
  readonly __codecTypes?: CodecTypes;
} = typedPackMetaBase;
