/**
 * The one input this package trusts: a TypeScript type expression, printed verbatim into the
 * emitted `contract.d.ts`.
 *
 * Verbatim is the feature. It is also the risk: a stray `;` or line break would land in a generated
 * declaration file and break every consumer's typecheck with an error pointing nowhere useful. So
 * the expression is checked once, at authoring time, with rules that reject what cannot be a single
 * type expression without trying to parse TypeScript. `PrismaJson.Settings`, `'draft' | 'published'`,
 * `Array<{ id: string }>` and `import('./types').Foo` all pass.
 */
import { runtimeError } from '@prisma/orm-framework/components/runtime';
import type { StandardSchemaV1 } from '@standard-schema/spec';

export type TypedParams = { readonly tsType: string };

export function tsTypeProblem(value: unknown): string | undefined {
  if (typeof value !== 'string') return `expected a string, got ${typeof value}`;
  const t = value.trim();
  if (t.length === 0) return 'must not be empty';
  if (/[\r\n\u2028\u2029]/.test(t)) return 'must be a single line';
  if (t.includes('//') || t.includes('/*')) return 'must not contain a comment';
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{', '>': '<' };
  const stack: string[] = [];
  let quote: string | undefined;
  for (let i = 0; i < t.length; i += 1) {
    const ch = t.charAt(i);
    if (quote) {
      if (ch === quote) quote = undefined;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    // A `;` inside braces separates object-type members. Outside them it would end the declaration.
    else if (ch === ';' && !stack.includes('{')) return 'must not contain ";" outside an object type';
    else if ('([{<'.includes(ch)) stack.push(ch);
    else if (ch === '>' && t.charAt(i - 1) === '=') continue; // the arrow in `() => void`
    else if (ch in pairs && stack.pop() !== pairs[ch]) return 'has unbalanced brackets';
  }
  if (quote) return 'has an unterminated string literal';
  if (stack.length > 0) return 'has unbalanced brackets';
  return undefined;
}

/** Authoring-time check for the column helpers: fail at the call site, naming the helper. */
export function assertTsType(helper: string, value: unknown): string {
  const problem = tsTypeProblem(value);
  if (problem !== undefined) {
    throw runtimeError(
      'CONTRACT.ARGUMENT_INVALID',
      `${helper}(tsType): the TypeScript type expression ${problem}.`,
      { helperPath: helper, expected: 'a single-line TypeScript type expression', received: value },
    );
  }
  return (value as string).trim();
}

/**
 * Standard Schema for the stored params, written by hand so this package depends on no validator
 * library. The same rules as {@link assertTsType}, applied when a contract is rehydrated at runtime.
 */
export const typedParamsSchema: StandardSchemaV1<TypedParams, TypedParams> = {
  '~standard': {
    version: 1,
    vendor: 'prisma-orm-extension-typed-json',
    validate(value) {
      const tsType = (value as { tsType?: unknown } | null)?.tsType;
      const problem = tsTypeProblem(tsType);
      if (problem !== undefined) {
        return { issues: [{ message: `tsType ${problem}`, path: ['tsType'] }] };
      }
      return { value: { ...(value as object), tsType: (tsType as string).trim() } as TypedParams };
    },
  },
};
