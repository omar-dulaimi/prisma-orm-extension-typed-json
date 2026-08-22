/**
 * Two codecs that carry a TypeScript type and nothing else.
 *
 * `typed/json@1` is a `jsonb` column and `typed/text@1` is a `text` column whose TypeScript type is
 * whatever expression the author wrote: `PrismaJson.Settings`, `'draft' | 'published'`, an inline
 * object type. The expression is stored in the contract as `tsType`, printed verbatim into
 * `contract.d.ts` by `renderOutputType`, and never consulted at runtime. Values pass through the
 * codec unchanged in both directions.
 *
 * That is the same deal prisma-json-types-generator made on Prisma 4 to 7: compile-time types,
 * zero runtime cost, zero dependency on a validator library, and no change in how existing rows
 * read back. A column that should also validate belongs to a validator codec such as
 * prisma-orm-extension-zod-json instead.
 */
import type { JsonValue } from '@prisma/orm-framework/contract/types';
import type { ProjectionExpr } from '@prisma/orm-family-sql/relational-core/ast';
import {
  type CodecCallContext,
  CodecImpl,
  type CodecInstanceContext,
  type ColumnHelperFor,
  type ColumnSpec,
  column,
} from '@prisma/orm-framework/components/codec';
import { PostgresCodecDescriptor, definePostgresCodecs } from '@prisma/orm-target-postgres/target/codec-descriptor';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { assertTsType, type TypedParams, typedParamsSchema } from './ts-type.js';

export const TYPED_JSON_CODEC_ID = 'typed/json@1' as const;
export const TYPED_TEXT_CODEC_ID = 'typed/text@1' as const;
const JSONB = 'jsonb' as const;
const TEXT = 'text' as const;

export class TypedJsonCodecClass<T> extends CodecImpl<
  typeof TYPED_JSON_CODEC_ID,
  readonly ['equality'],
  string | JsonValue,
  T
> {
  async encode(value: T, _ctx: CodecCallContext): Promise<string> {
    return JSON.stringify(value);
  }

  async decode(wire: string | JsonValue, _ctx: CodecCallContext): Promise<T> {
    return (typeof wire === 'string' ? JSON.parse(wire) : wire) as T;
  }

  encodeJson(value: T): JsonValue {
    return value as unknown as JsonValue;
  }

  decodeJson(json: JsonValue): T {
    return json as unknown as T;
  }
}

export class TypedTextCodecClass<T extends string> extends CodecImpl<
  typeof TYPED_TEXT_CODEC_ID,
  readonly ['equality', 'order', 'textual'],
  string,
  T
> {
  async encode(value: T, _ctx: CodecCallContext): Promise<string> {
    return value;
  }

  async decode(wire: string, _ctx: CodecCallContext): Promise<T> {
    return wire as T;
  }

  encodeJson(value: T): JsonValue {
    return value;
  }

  decodeJson(json: JsonValue): T {
    return json as T;
  }
}

export class TypedJsonDescriptor extends PostgresCodecDescriptor<TypedParams> {
  protected override nativeType(): string {
    return JSONB;
  }

  /** Already JSON on the wire; relation loading can project the column as-is. */
  protected override jsonProjection(expression: ProjectionExpr): ProjectionExpr {
    return expression;
  }

  override readonly codecId = TYPED_JSON_CODEC_ID;
  override readonly traits = ['equality'] as const;
  override readonly targetTypes = [JSONB] as const;
  override readonly paramsSchema: StandardSchemaV1<TypedParams> = typedParamsSchema;

  override renderOutputType(params: TypedParams): string {
    return params.tsType;
  }

  override factory(_params: TypedParams): (ctx: CodecInstanceContext) => TypedJsonCodecClass<unknown> {
    return () => new TypedJsonCodecClass<unknown>(this);
  }
}

export class TypedTextDescriptor extends PostgresCodecDescriptor<TypedParams> {
  protected override nativeType(): string {
    return TEXT;
  }

  protected override jsonProjection(expression: ProjectionExpr): ProjectionExpr {
    return expression;
  }

  override readonly codecId = TYPED_TEXT_CODEC_ID;
  // Same traits as the built-in pg/text@1, so every string operation keeps working on the column.
  override readonly traits = ['equality', 'order', 'textual'] as const;
  override readonly targetTypes = [TEXT] as const;
  override readonly paramsSchema: StandardSchemaV1<TypedParams> = typedParamsSchema;

  override renderOutputType(params: TypedParams): string {
    return params.tsType;
  }

  override factory(_params: TypedParams): (ctx: CodecInstanceContext) => TypedTextCodecClass<string> {
    return () => new TypedTextCodecClass<string>(this);
  }
}

export const typedJsonDescriptor = new TypedJsonDescriptor();
export const typedTextDescriptor = new TypedTextDescriptor();

/**
 * A `jsonb` column typed as `T`, where `tsType` is the same type written as a string for the
 * emitted `contract.d.ts`. The two are yours to keep in agreement; the type parameter serves the
 * no-emit path and the string serves the emit path.
 *
 * @throws `CONTRACT.ARGUMENT_INVALID` if `tsType` is not a single-line type expression.
 */
export function typedJson<T>(tsType: string): ColumnSpec<TypedJsonCodecClass<T>, TypedParams> {
  const params: TypedParams = { tsType: assertTsType('typedJson', tsType) };
  return column(
    (_ctx: CodecInstanceContext) => new TypedJsonCodecClass<T>(typedJsonDescriptor),
    typedJsonDescriptor.codecId,
    params,
    JSONB,
  );
}

/**
 * A `text` column typed as `T extends string`, typically a literal union such as
 * `'draft' | 'published'`. Storage and queries are plain text; only the TypeScript type narrows.
 *
 * @throws `CONTRACT.ARGUMENT_INVALID` if `tsType` is not a single-line type expression.
 */
export function typedText<T extends string>(tsType: string): ColumnSpec<TypedTextCodecClass<T>, TypedParams> {
  const params: TypedParams = { tsType: assertTsType('typedText', tsType) };
  return column(
    (_ctx: CodecInstanceContext) => new TypedTextCodecClass<T>(typedTextDescriptor),
    typedTextDescriptor.codecId,
    params,
    TEXT,
  );
}

typedJson satisfies ColumnHelperFor<TypedJsonDescriptor>;
typedText satisfies ColumnHelperFor<TypedTextDescriptor>;

/** Every codec descriptor this package ships. */
export const codecDescriptors = definePostgresCodecs([typedJsonDescriptor, typedTextDescriptor]);
