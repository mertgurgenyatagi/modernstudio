// Fails if the installer would hold anything that is not part of the running app (plan24 step 20).
//   node tools/package/check.mjs   the rules, applied to the repository's files
//   and, if `npm run pack` has run, the real file list of release/win-unpacked/resources/app.asar
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { applyFilesRules, findProblems, readFilesRules } from './rules.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'release') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(relative(root, full).replaceAll('\\', '/'));
  }
  return out;
}

let failed = false;
function report(title, problems) {
  if (problems.length === 0) return console.log(`ok   ${title}`);
  failed = true;
  console.log(`FAIL ${title}`);
  for (const p of problems.slice(0, 20)) console.log(`       ${p.path}: ${p.reason}`);
}

const rules = readFilesRules(readFileSync(join(root, 'electron-builder.yml'), 'utf8'));
report('files rules are not empty', rules.length ? [] : [{ path: 'electron-builder.yml', reason: 'no files: list' }]);

// 1. The rules, applied to every file of the repository (the build in out/ if it exists).
const included = applyFilesRules(rules, walk(root));
report(`files rules keep ${included.length} files, none foreign`, findProblems(included));

// 2. No production dependency, so no node_modules goes into the package.
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const deps = Object.keys(pkg.dependencies ?? {});
report('no production dependencies', deps.map((d) => ({ path: d, reason: 'would be packed as node_modules' })));

// 3. The real package, if it was built.
const asar = join(root, 'release', 'win-unpacked', 'resources', 'app.asar');
if (existsSync(asar)) {
  const { listPackage } = createRequire(import.meta.url)('@electron/asar');
  const list = listPackage(asar);
  report(`app.asar holds ${list.length} entries, none foreign`, findProblems(list));
} else {
  console.log('skip app.asar (run `npm run pack` first)');
}

process.exit(failed ? 1 : 0);
