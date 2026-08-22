import { describe, expect, test } from 'vitest';
import packageJson from '../package.json' with { type: 'json' };
import { typedPackMeta } from '../src/core/pack-meta.js';
import { typedCodecRegistry } from '../src/core/registry.js';
import { typedExtensionDescriptor } from '../src/exports/control.js';
import { typedRuntimeDescriptor } from '../src/exports/runtime.js';

describe('registry', () => {
  test('resolves both codecs by id, so the runtime can dispatch to them', () => {
    expect(typedCodecRegistry.descriptorFor('typed/json@1')?.codecId).toBe('typed/json@1');
    expect(typedCodecRegistry.descriptorFor('typed/text@1')?.codecId).toBe('typed/text@1');
  });

  test('lists exactly the codecs this package ships', () => {
    expect(Array.from(typedCodecRegistry.values()).map((d) => d.codecId).sort()).toEqual([
      'typed/json@1',
      'typed/text@1',
    ]);
  });

  test('indexes each under its native type, so a column can find it', () => {
    expect(typedCodecRegistry.byTargetType('jsonb').map((d) => d.codecId)).toContain('typed/json@1');
    expect(typedCodecRegistry.byTargetType('text').map((d) => d.codecId)).toContain('typed/text@1');
  });
});

describe('pack metadata', () => {
  test('identifies the pack for framework composition', () => {
    expect(typedPackMeta).toMatchObject({
      kind: 'extension',
      id: 'typed-json',
      familyId: 'sql',
      targetId: 'postgres',
    });
  });

  test('declares the storage backing for each codec id', () => {
    expect(typedPackMeta.types.storage).toEqual([
      { typeId: 'typed/json@1', familyId: 'sql', targetId: 'postgres', nativeType: 'jsonb' },
      { typeId: 'typed/text@1', familyId: 'sql', targetId: 'postgres', nativeType: 'text' },
    ]);
  });

  test('points the emitter at a codec-types entrypoint that this package actually exports', () => {
    const { package: pkg } = typedPackMeta.types.codecTypes.import;
    const subpath = `.${pkg.replace('prisma-orm-extension-typed-json', '')}`;

    expect(Object.keys((packageJson as { exports: Record<string, unknown> }).exports)).toContain(subpath);
  });

  test('the codec-types import names the package this package.json declares', () => {
    expect(typedPackMeta.types.codecTypes.import.package.startsWith(`${packageJson.name}/`)).toBe(true);
  });
});

/**
 * The PSL door. `types { Settings = typed.Json("PrismaJson.Settings") }` has to produce exactly the
 * params the TypeScript helper produces, or the two authoring styles would drift apart.
 */
describe('PSL type constructors', () => {
  const presets = typedPackMeta.authoring.type.typed;

  test('registers Json and Text under the `typed` namespace', () => {
    expect(Object.keys(presets).sort()).toEqual(['Json', 'Text']);
  });

  test.each([
    ['Json', 'typed/json@1', 'jsonb'],
    ['Text', 'typed/text@1', 'text'],
  ] as const)('%s takes one string argument and maps it to tsType over %s', (name, codecId, nativeType) => {
    const preset = presets[name];
    expect(preset.kind).toBe('typeConstructor');
    expect(preset.args).toEqual([{ kind: 'string', name: 'tsType' }]);
    expect(preset.output).toEqual({
      codecId,
      nativeType,
      typeParams: { tsType: { kind: 'arg', index: 0 } },
    });
  });
});

describe('runtime descriptor', () => {
  test('exposes both codecs through the runtime codecs slot', () => {
    expect(typedRuntimeDescriptor.codecs().map((c) => c.codecId).sort()).toEqual(['typed/json@1', 'typed/text@1']);
  });

  test('binds to the postgres target', () => {
    expect(typedRuntimeDescriptor.create()).toEqual({ familyId: 'sql', targetId: 'postgres' });
  });
});

describe('control descriptor', () => {
  type Hook = { expandNativeType?: (input: { nativeType: string }) => string };
  const hooks = (
    typedExtensionDescriptor.types as { codecTypes?: { controlPlaneHooks?: Record<string, Hook> } } | undefined
  )?.codecTypes?.controlPlaneHooks;

  test('registers a control hook for each codec, so db init can expand the native type', () => {
    expect(Object.keys(hooks ?? {}).sort()).toEqual(['typed/json@1', 'typed/text@1']);
  });

  test('expandNativeType is the identity: these are built-in Postgres types', () => {
    expect(hooks?.['typed/json@1']?.expandNativeType?.({ nativeType: 'jsonb' })).toBe('jsonb');
    expect(hooks?.['typed/text@1']?.expandNativeType?.({ nativeType: 'text' })).toBe('text');
  });
});
