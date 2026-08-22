/**
 * The type-level claim, checked by tsc rather than by reading the generated file.
 *
 * Every `@ts-expect-error` below is a negative control: if the emitted type ever widened to `any`
 * or `unknown`, the line under it would compile, the directive would be unused, and tsc would fail
 * this file. So a green run proves the types are real in both doors.
 */
import type { FieldOutputTypes as TsDoor } from './src/prisma/contract.d';
import type { FieldOutputTypes as PslDoor } from './src/psl/contract.d';

// TypeScript door
type TsSettings = TsDoor['public']['Account']['settings'];
type TsStatus = TsDoor['public']['Account']['status'];

const tsOk: TsSettings = { theme: 'dark', tags: ['a'] };
const tsStatus: TsStatus = 'published';

// @ts-expect-error 'neon' is not a member of the theme union
const tsBadTheme: TsSettings = { theme: 'neon', tags: [] };
// @ts-expect-error tags is required
const tsMissingTags: TsSettings = { theme: 'light' };
// @ts-expect-error 'archived' is outside the declared literal union
const tsBadStatus: TsStatus = 'archived';

// The emitted type and the user's global declaration are the same type, both directions.
const viaNamespace: PrismaJson.Settings = tsOk;
const backAgain: TsSettings = viaNamespace;

// PSL door: identical guarantees from a contract.prisma that never touched TypeScript.
type PslSettings = PslDoor['public']['Profile']['settings'];
type PslStatus = PslDoor['public']['Profile']['status'];

const pslOk: PslSettings = { theme: 'light', digestHour: 9, tags: [] };
const pslStatus: PslStatus = 'draft';

// @ts-expect-error 'neon' is not a member of the theme union
const pslBadTheme: PslSettings = { theme: 'neon', tags: [] };
// @ts-expect-error 'archived' is outside the declared literal union
const pslBadStatus: PslStatus = 'archived';

const sameType: PslSettings = tsOk;

export { tsOk, tsStatus, tsBadTheme, tsMissingTags, tsBadStatus, viaNamespace, backAgain, pslOk, pslStatus, pslBadTheme, pslBadStatus, sameType };
