import { buildCodecDescriptorRegistry } from '@prisma/orm-family-sql/relational-core/codec-descriptor-registry';
import type { CodecDescriptorRegistry } from '@prisma/orm-family-sql/relational-core/query-lane-context';
import { codecDescriptors } from './typed-codecs.js';

/**
 * Every codec descriptor shipped by this package: `typed/json@1` and `typed/text@1`.
 *
 * Kept in the same registry shape the other codec-shipping packages use, so consumers do not have to
 * special-case extensions.
 */
export const typedCodecRegistry: CodecDescriptorRegistry = buildCodecDescriptorRegistry(codecDescriptors);
