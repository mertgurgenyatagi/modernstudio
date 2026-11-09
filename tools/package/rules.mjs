// What the installer may hold (plan24 step 20). Pure functions, used by check.mjs and the test.

/** Paths (from the package root, forward slashes, no leading slash) that are allowed in the package. */
export function isAllowed(path) {
  return path === 'package.json' || path === 'out' || path.startsWith('out/');
}

/** Names that must never be in the package, even inside out/. Returns the reason, or null. */
export function forbiddenReason(path) {
  const top = path.split('/')[0];
  const banned = ['docs', 'midis', 'tools', 'questionnaires', 'src', 'electron', '.claude', '.serena', 'node_modules', 'release'];
  if (banned.includes(top)) return `${top}/ is not part of the app`;
  if (/\.test\.[cm]?[jt]sx?$/.test(path)) return 'a test file';
  if (/(^|\/)fixtures\//.test(path)) return 'a test fixture';
  if (/\.(py|pyc|md|map)$/.test(path)) return 'a script, a document or a source map';
  if (!isAllowed(path)) return 'outside out/ and package.json';
  return null;
}

/** Every path in the list that does not belong, as { path, reason }. */
export function findProblems(paths) {
  const problems = [];
  for (const raw of paths) {
    const path = raw.replaceAll('\\', '/').replace(/^\/+/, '');
    if (path === '') continue;
    const reason = forbiddenReason(path);
    if (reason) problems.push({ path, reason });
  }
  return problems;
}

/** The files: list of electron-builder.yml (a flat list of strings; the file is written by hand). */
export function readFilesRules(yamlText) {
  const lines = yamlText.split(/\r?\n/);
  const start = lines.findIndex((l) => /^files:\s*$/.test(l));
  if (start < 0) return [];
  const rules = [];
  for (const line of lines.slice(start + 1)) {
    const m = /^\s+-\s+(.*?)\s*$/.exec(line);
    if (!m) break;
    rules.push(m[1].replace(/^['"]|['"]$/g, ''));
  }
  return rules;
}

function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      i++;
      if (glob[i + 1] === '/') {
        i++;
        re += '(?:.*/)?';
      } else re += '.*';
    } else if (c === '*') re += '[^/]*';
    else re += c.replace(/[.+^${}()|[\]\\?]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

/** Applies the rules to a list of repository paths, as electron-builder would: later rules win. */
export function applyFilesRules(rules, paths) {
  return paths.filter((path) => {
    let included = false;
    for (const rule of rules) {
      const negative = rule.startsWith('!');
      const glob = negative ? rule.slice(1) : rule;
      if (globToRegExp(glob).test(path)) included = !negative;
    }
    return included;
  });
}
