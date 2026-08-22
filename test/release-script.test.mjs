import { describe, expect, test } from 'vitest';
import { computeReleaseVersion } from '../scripts/release.mjs';

/**
 * The decision logic that controls real npm publishes. Its semantic-release predecessor shipped two
 * wrong versions in production while passing a source-level review, so every branch here is pinned,
 * including the adversarial cases that caught the previous implementation's bug.
 */
describe('computeReleaseVersion', () => {
  const target = '8.0.0-rc.4';

  test('releases the target when it is not on npm yet (the automatic Prisma-bump path)', () => {
    expect(computeReleaseVersion({ target, published: ['2.0.0', '4.0.1'], fixRelease: false })).toEqual({
      version: target,
      reason: expect.stringContaining('not on npm'),
    });
  });

  test('releases the target on a fresh, never-published name too', () => {
    expect(computeReleaseVersion({ target, published: [], fixRelease: false }).version).toBe(target);
  });

  test('releases nothing when the target is already published and no fix was requested', () => {
    expect(
      computeReleaseVersion({ target, published: ['4.0.1', target], fixRelease: false }).version,
    ).toBeNull();
  });

  test('a push after an own-fix release still releases nothing (the previous plugin got this wrong)', () => {
    // Its predecessor compared the full last-released string against the bare target, so once any
    // own-fix existed it forced a release on every future run. Here the base being published is the
    // only thing that matters.
    expect(
      computeReleaseVersion({ target, published: [target, `${target}.1`], fixRelease: false }).version,
    ).toBeNull();
  });

  test('a requested fix release on a published base appends the first counter', () => {
    expect(computeReleaseVersion({ target, published: [target], fixRelease: true })).toEqual({
      version: `${target}.1`,
      reason: expect.stringContaining('own-fix'),
    });
  });

  test('a second fix release increments past the highest existing counter, gaps included', () => {
    expect(
      computeReleaseVersion({ target, published: [target, `${target}.1`, `${target}.7`], fixRelease: true })
        .version,
    ).toBe(`${target}.7`.replace('.7', '.8'));
  });

  test('a fix release when the base itself is unpublished just releases the base', () => {
    expect(computeReleaseVersion({ target, published: ['4.0.1'], fixRelease: true }).version).toBe(target);
  });

  test('a prefix-colliding version (8.0.0-rc.40) is not mistaken for a counter on 8.0.0-rc.4', () => {
    expect(
      computeReleaseVersion({ target, published: [target, '8.0.0-rc.40'], fixRelease: true }).version,
    ).toBe(`${target}.1`);
  });

  test('junk suffixes on the base are ignored rather than parsed as counters', () => {
    expect(
      computeReleaseVersion({ target, published: [target, `${target}.beta`, `${target}.0`], fixRelease: true })
        .version,
    ).toBe(`${target}.1`);
  });
});
