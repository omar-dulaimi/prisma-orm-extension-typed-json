import { describe, expect, test } from 'vitest';
import { assertTsType, tsTypeProblem, typedParamsSchema } from '../src/core/ts-type.js';

/**
 * The type expression is printed verbatim into a generated declaration file, so the guard exists to
 * keep anything that cannot be a single type expression out of contract.d.ts. It must accept every
 * shape a real user writes and reject the shapes that would corrupt the file.
 */
describe('tsTypeProblem accepts real type expressions', () => {
  test.each([
    'PrismaJson.Settings',
    "'draft' | 'published'",
    '"a" | "b"',
    'Array<{ id: string; n?: number }>',
    '{ a: { b: string; c: number }; d: boolean }',
    "import('./types').Foo",
    'Record<string, unknown>',
    '(x: string) => void',
    '[string, number]',
    'string | null',
    '`prefix-${string}`',
    '  PrismaJson.Padded  ',
  ])('%s', (expression) => {
    expect(tsTypeProblem(expression)).toBeUndefined();
  });
});

describe('tsTypeProblem rejects what would corrupt contract.d.ts', () => {
  test.each([
    ['', 'must not be empty'],
    ['   ', 'must not be empty'],
    ['a\nb', 'must be a single line'],
    ['a b', 'must be a single line'],
    ['string; drop', 'must not contain ";" outside an object type'],
    ['{ a: string }; drop', 'must not contain ";" outside an object type'],
    ['string // note', 'must not contain a comment'],
    ['string /* note */', 'must not contain a comment'],
    ['Array<string', 'has unbalanced brackets'],
    ['{ a: string ]', 'has unbalanced brackets'],
    ["'unterminated", 'has an unterminated string literal'],
  ])('%j -> %s', (expression, problem) => {
    expect(tsTypeProblem(expression)).toBe(problem);
  });

  test('a non-string is reported as such', () => {
    expect(tsTypeProblem(42)).toBe('expected a string, got number');
  });
});

describe('assertTsType', () => {
  test('returns the trimmed expression', () => {
    expect(assertTsType('typedJson', '  PrismaJson.Settings ')).toBe('PrismaJson.Settings');
  });

  test('throws a structured CONTRACT.ARGUMENT_INVALID naming the helper', () => {
    let caught: unknown;
    try {
      assertTsType('typedText', 'a;b');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain('typedText(tsType)');
    expect((caught as Error).message).toContain('must not contain ";"');
    expect((caught as { code?: string }).code).toBe('CONTRACT.ARGUMENT_INVALID');
  });
});

describe('typedParamsSchema (hand-written Standard Schema, no validator dependency)', () => {
  const validate = (value: unknown) => typedParamsSchema['~standard'].validate(value);

  test('accepts and trims a valid tsType', async () => {
    const result = await validate({ tsType: ' PrismaJson.Settings ' });
    expect(result).toEqual({ value: { tsType: 'PrismaJson.Settings' } });
  });

  test('rejects a bad tsType with a path', async () => {
    const result = await validate({ tsType: 'a;b' });
    expect('issues' in result && result.issues?.[0]?.path).toEqual(['tsType']);
  });

  test('rejects a missing tsType', async () => {
    const result = await validate({});
    expect('issues' in result && result.issues?.[0]?.message).toContain('expected a string');
  });

  test('declares itself as version 1 from this package', () => {
    expect(typedParamsSchema['~standard'].version).toBe(1);
    expect(typedParamsSchema['~standard'].vendor).toBe('prisma-orm-extension-typed-json');
  });
});
