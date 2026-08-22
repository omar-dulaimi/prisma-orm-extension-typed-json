/**
 * Codec type definitions for the typed-json extension.
 *
 * Type-only export consumed by the emitted `contract.d.ts` to resolve
 * `CodecTypes['typed/json@1']['input']` and friends.
 *
 * `output` is `unknown` here on purpose. The precise type is column-site-local: `typedJson<T>()`
 * returns a codec carrying `T`, which the no-emit resolver reads from the column descriptor, and the
 * emit path prints the stored `tsType` expression instead (see `renderOutputType`). This
 * codec-id-keyed map is only the fallback for sites with neither in scope.
 */

export type CodecTypes = {
  readonly 'typed/json@1': {
    readonly input: unknown;
    readonly output: unknown;
    readonly traits: 'equality';
  };
  readonly 'typed/text@1': {
    readonly input: string;
    readonly output: string;
    readonly traits: 'equality' | 'order' | 'textual';
  };
};
