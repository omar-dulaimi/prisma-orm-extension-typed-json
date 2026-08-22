/**
 * Packs the tarball and imports every published entrypoint from the extracted contents.
 *
 * The unit tests import from `src/`, so they cannot see a wrong path in the exports map, a missing
 * file, or an entrypoint left out of the build. Those only surface when somebody installs the package,
 * which is too late. This checks the artefact that actually ships.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));

const problems = [];
const check = (ok, detail) => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${detail}`);
  if (!ok) problems.push(detail);
};

const work = mkdtempSync(join(tmpdir(), 'pnzj-verify-'));
try {
  const tarball = execFileSync('npm', ['pack', '--pack-destination', work], { cwd: repo })
    .toString()
    .trim()
    .split('\n')
    .pop();

  execFileSync('tar', ['-xzf', join(work, tarball), '-C', work]);
  const extracted = join(work, 'package');

  // Peer dependencies resolve through the repo's own install; we are testing our files, not theirs.
  symlinkSync(join(repo, 'node_modules'), join(work, 'node_modules'), 'dir');

  const subpaths = Object.keys(pkg.exports).filter((s) => s !== './package.json');
  check(subpaths.length > 0, `exports map declares ${subpaths.length} entrypoints`);

  for (const subpath of subpaths) {
    const entry = pkg.exports[subpath];
    const target = typeof entry === 'string' ? entry : entry.default;
    const onDisk = join(extracted, target);

    if (!existsSync(onDisk)) {
      check(false, `${subpath} → ${target} is missing from the tarball`);
      continue;
    }

    const types = typeof entry === 'object' ? entry.types : undefined;
    if (types && !existsSync(join(extracted, types))) {
      check(false, `${subpath} → types ${types} is missing from the tarball`);
      continue;
    }

    try {
      const loaded = await import(pathToFileURL(onDisk).href);
      const runtimeExports = Object.keys(loaded).length;
      // `./codec-types` is type-only, so an empty runtime module is correct there and nowhere else.
      const expectsRuntime = subpath !== './codec-types';
      check(
        !expectsRuntime || runtimeExports > 0,
        expectsRuntime
          ? `${subpath} imports, exporting ${runtimeExports} binding(s)`
          : `${subpath} imports (type-only, no runtime exports expected)`,
      );
    } catch (error) {
      check(false, `${subpath} failed to import: ${error.message.split('\n')[0]}`);
    }
  }

  // The pack must not carry anything that is not meant to ship.
  const listed = execFileSync('tar', ['-tzf', join(work, tarball)]).toString().split('\n');
  const leaked = listed.filter((f) => /(^package\/(test|e2e|docs|scripts)\/)|\.test\.ts$/.test(f));
  check(leaked.length === 0, leaked.length === 0 ? 'no tests, specs or e2e in the tarball' : `leaked: ${leaked.join(', ')}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s) with the published package.`);
  process.exit(1);
}
console.log('\nThe published package is importable.');
