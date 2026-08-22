/**
 * The release pipeline: version = the Prisma release this package targets.
 *
 * Every real Prisma extension (pgvector, PostGIS, ParadeDB, Supabase, arktype-json) is versioned
 * exactly as the Prisma release it targets, e.g. `8.0.0-rc.4` - not an independent history of its own
 * commits. semantic-release cannot express that: it deep-clones the context before every plugin call
 * (lib/plugins/normalize.js), so a plugin cannot set the version, by design. Two production releases
 * (4.0.0, 4.0.1) shipped with the wrong number before that was established, so this script replaces
 * semantic-release outright rather than fighting it.
 *
 * Decision rules:
 * - The target version is read from `peerDependencies["@prisma/orm-target-postgres"]`.
 * - If the target is not on npm yet (a Prisma bump just landed), release it. This is the automatic
 *   path: every push to main runs this and quietly exits when there is nothing to do.
 * - If the target is already published, release nothing - unless FIX_RELEASE=true (a deliberate,
 *   manually dispatched own-fix release), which appends the next `.N` counter: `8.0.0-rc.4.1`, `.2`...
 *   Semver orders these correctly: the counter extends the prerelease identifier list (longer,
 *   otherwise-equal list wins), and any real Prisma bump differs at the `rc.N` identifier first,
 *   outranking every counter on the old base.
 * - DRY_RUN=true computes and prints the decision, then stops before touching anything.
 *
 * Publishing is a plain `npm publish`: npm >= 11.5 performs the trusted-publishing OIDC exchange
 * natively inside GitHub Actions (`id-token: write` is set in release.yml, and the npm trusted
 * publisher is bound to this repo + that workflow file, independent of what tool runs the publish).
 * The tag and GitHub release are created server-side via `gh release create`, so no authenticated
 * git push is needed. package.json's `version` field in the repo is a placeholder; the real version
 * is written into the workspace only at publish time and never committed back.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = join(import.meta.dirname, '..');

/**
 * Pure decision logic, unit-tested in test/release-script.test.mjs.
 * Returns { version: string, reason } to release, or { version: null, reason } to do nothing.
 */
export function computeReleaseVersion({ target, published, fixRelease }) {
  if (!published.includes(target)) {
    return { version: target, reason: 'the Prisma target version is not on npm yet' };
  }
  if (!fixRelease) {
    return { version: null, reason: 'the Prisma target version is already published' };
  }
  const counters = published
    .filter((v) => v.startsWith(`${target}.`))
    .map((v) => Number(v.slice(target.length + 1)))
    .filter((n) => Number.isInteger(n) && n > 0);
  const next = counters.length === 0 ? 1 : Math.max(...counters) + 1;
  return { version: `${target}.${next}`, reason: 'own-fix release on an already-published base' };
}

/** Published versions from the registry; a 404 (name never published) is an empty list, not an error. */
export function publishedVersions(name) {
  let raw;
  try {
    raw = execFileSync('npm', ['view', name, 'versions', '--json'], { encoding: 'utf8' });
  } catch (error) {
    const out = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    if (out.includes('E404')) return [];
    throw error;
  }
  const parsed = JSON.parse(raw);
  // npm prints a bare string when exactly one version exists.
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function main() {
  const pkgPath = join(repo, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const target = pkg.peerDependencies?.['@prisma/orm-target-postgres'];
  if (!target || !/^\d+\.\d+\.\d+/.test(target)) {
    throw new Error(
      `peerDependencies["@prisma/orm-target-postgres"] must be an exact version, got: ${target}`,
    );
  }

  const dryRun = process.env.DRY_RUN === 'true';
  const fixRelease = process.env.FIX_RELEASE === 'true';
  const published = publishedVersions(pkg.name);

  const { version, reason } = computeReleaseVersion({ target, published, fixRelease });
  console.log(`target: ${target}  fixRelease: ${fixRelease}  published: ${published.join(', ') || '(none)'}`);

  if (!version) {
    console.log(`Nothing to release: ${reason}.`);
    return;
  }
  console.log(`Releasing ${version}: ${reason}.`);

  if (dryRun) {
    console.log('DRY_RUN=true - stopping before any side effect.');
    return;
  }

  writeFileSync(pkgPath, `${JSON.stringify({ ...pkg, version }, null, 2)}\n`);
  console.log(`Wrote version ${version} to package.json (workspace only, never committed).`);

  // --tag latest is explicit because npm refuses to publish a prerelease version (which every
  // 8.0.0-rc.N is) without one. latest is correct for this package's single release channel: each
  // release supersedes the last, RC or not, and semver keeps them ordered.
  execFileSync('npm', ['publish', '--tag', 'latest'], { cwd: repo, stdio: 'inherit' });
  console.log(`Published ${pkg.name}@${version}.`);

  const tag = `v${version}`;
  try {
    execFileSync(
      'gh',
      ['release', 'create', tag, '--target', process.env.GITHUB_SHA ?? 'main', '--generate-notes', '--title', tag],
      { cwd: repo, stdio: 'inherit' },
    );
    console.log(`Created GitHub release ${tag}.`);
  } catch (error) {
    // The npm publish already succeeded and cannot be repeated; do not fail into a state that would
    // re-publish. Report exactly what is missing and how to finish by hand.
    console.error(
      `npm publish succeeded but the GitHub release failed. Create it manually:\n` +
        `  gh release create ${tag} --target ${process.env.GITHUB_SHA ?? 'main'} --generate-notes --title ${tag}`,
    );
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
