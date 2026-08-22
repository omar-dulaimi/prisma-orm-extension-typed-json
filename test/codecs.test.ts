import { describe, expect, test } from 'vitest';
import {
  TYPED_JSON_CODEC_ID,
  TYPED_TEXT_CODEC_ID,
  typedJson,
  typedJsonDescriptor,
  typedText,
  typedTextDescriptor,
} from '../src/core/typed-codecs.js';

const ctx = {} as never;

/** Builds a codec the way the runtime does: from stored params alone. */
const jsonCodec = (tsType = 'PrismaJson.Settings') => typedJsonDescriptor.factory({ tsType })(ctx);
const textCodec = (tsType = "'a' | 'b'") => typedTextDescriptor.factory({ tsType })(ctx);

describe('typed/json@1 is a passthrough over jsonb', () => {
  test('encode serialises to a JSON string', async () => {
    await expect(jsonCodec().encode({ a: 1, b: ['x'] }, ctx)).resolves.toBe('{"a":1,"b":["x"]}');
  });

  test('decode parses a JSON string', async () => {
    await expect(jsonCodec().decode('{"a":1}', ctx)).resolves.toEqual({ a: 1 });
  });

  test('decode accepts an already-parsed value, as a jsonb driver returns', async () => {
    await expect(jsonCodec().decode({ a: 1 }, ctx)).resolves.toEqual({ a: 1 });
  });

  test('encodeJson and decodeJson are identity: the lossless JSON path has nothing to do', () => {
    const codec = jsonCodec();
    const value = { nested: { deep: [1, 2, 3] } };
    expect(codec.encodeJson(value)).toBe(value);
    expect(codec.decodeJson(value)).toBe(value);
  });

  test('never validates: a value the declared type would forbid passes through untouched', async () => {
    // The type is PrismaJson.Settings; the value is nothing of the sort. That is by design: this is
    // the no-behaviour-change guarantee for rows that predate any type annotation.
    const codec = jsonCodec();
    const wire = await codec.encode({ theme: 'neon', legacy: true } as never, ctx);
    await expect(codec.decode(wire, ctx)).resolves.toEqual({ theme: 'neon', legacy: true });
  });
});

describe('typed/text@1 is a passthrough over text', () => {
  test('encode and decode return the string unchanged', async () => {
    const codec = textCodec();
    await expect(codec.encode('draft', ctx)).resolves.toBe('draft');
    await expect(codec.decode('draft', ctx)).resolves.toBe('draft');
  });

  test('encodeJson and decodeJson are identity', () => {
    const codec = textCodec();
    expect(codec.encodeJson('x')).toBe('x');
    expect(codec.decodeJson('x')).toBe('x');
  });

  test('never validates: a member outside the declared union passes through', async () => {
    await expect(textCodec("'a' | 'b'").decode('z', ctx)).resolves.toBe('z');
  });
});

describe('the descriptors identify themselves and render the type verbatim', () => {
  test('ids and native types', () => {
    expect(typedJsonDescriptor.codecId).toBe(TYPED_JSON_CODEC_ID);
    expect(typedJsonDescriptor.targetTypes).toEqual(['jsonb']);
    expect(typedTextDescriptor.codecId).toBe(TYPED_TEXT_CODEC_ID);
    expect(typedTextDescriptor.targetTypes).toEqual(['text']);
  });

  test('typed/text@1 carries the same traits as the built-in pg/text@1, so string operations keep working', () => {
    expect(typedTextDescriptor.traits).toEqual(['equality', 'order', 'textual']);
    expect(typedJsonDescriptor.traits).toEqual(['equality']);
  });

  test('renderOutputType prints the stored expression exactly', () => {
    expect(typedJsonDescriptor.renderOutputType({ tsType: 'PrismaJson.Settings' })).toBe('PrismaJson.Settings');
    expect(typedTextDescriptor.renderOutputType({ tsType: "'draft' | 'published'" })).toBe("'draft' | 'published'");
  });
});

describe('the column helpers', () => {
  test('typedJson stores the trimmed expression as tsType over jsonb', () => {
    const spec = typedJson<{ a: string }>(' { a: string } ');
    expect(spec.codecId).toBe(TYPED_JSON_CODEC_ID);
    expect(spec.typeParams).toEqual({ tsType: '{ a: string }' });
    expect(spec.nativeType).toBe('jsonb');
  });

  test('typedText stores the expression over text', () => {
    const spec = typedText<'a' | 'b'>("'a' | 'b'");
    expect(spec.codecId).toBe(TYPED_TEXT_CODEC_ID);
    expect(spec.typeParams).toEqual({ tsType: "'a' | 'b'" });
    expect(spec.nativeType).toBe('text');
  });

  test('both refuse an expression that would corrupt contract.d.ts, at the call site', () => {
    expect(() => typedJson('string; oops')).toThrow(/typedJson\(tsType\)/);
    expect(() => typedText('')).toThrow(/typedText\(tsType\)/);
  });

  test('the helper-built codec and the params-built codec behave identically', async () => {
    const fromHelper = typedJson<{ a: number }>('{ a: number }').codecFactory(ctx);
    const fromParams = jsonCodec('{ a: number }');
    const wire = await fromHelper.encode({ a: 1 }, ctx);
    await expect(fromParams.decode(wire, ctx)).resolves.toEqual({ a: 1 });
  });
});
