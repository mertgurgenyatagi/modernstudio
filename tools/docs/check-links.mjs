// Lists broken relative links in docs/ (and the root README). Run: npm run check:docs
// A link is broken if its file does not exist, or if it points into a markdown file with a #anchor
// that matches no heading there.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function markdownFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...markdownFiles(full));
    else if (entry.name.endsWith('.md')) found.push(full);
  }
  return found;
}

function slug(heading) {
  return heading
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-');
}

const anchors = new Map();
function anchorsOf(file) {
  if (!anchors.has(file)) {
    const set = new Set();
    let fenced = false;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (line.startsWith('```')) fenced = !fenced;
      const m = !fenced && /^#{1,6}\s+(.*)$/.exec(line);
      if (m) set.add(slug(m[1]));
    }
    anchors.set(file, set);
  }
  return anchors.get(file);
}

const files = [path.join(root, 'README.md'), ...markdownFiles(path.join(root, 'docs'))];
const broken = [];
let checked = 0;
for (const file of files) {
  let fenced = false;
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (line.startsWith('```')) fenced = !fenced;
    if (fenced) return;
    const noCode = line.replace(/`[^`]*`/g, '');
    for (const m of noCode.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const target = m[1];
      if (/^[a-z]+:/i.test(target)) continue; // http:, mailto:
      checked += 1;
      const [rel, hash] = target.split('#');
      const dest = rel === '' ? file : path.resolve(path.dirname(file), decodeURIComponent(rel));
      if (!fs.existsSync(dest)) {
        broken.push(`${path.relative(root, file)}:${i + 1}: ${target} (no such file)`);
      } else if (hash && dest.endsWith('.md') && !anchorsOf(dest).has(hash.toLowerCase())) {
        broken.push(`${path.relative(root, file)}:${i + 1}: ${target} (no such heading)`);
      }
    }
  });
}
console.log(`${checked} relative links in ${files.length} files`);
if (broken.length > 0) {
  console.log(broken.join('\n'));
  process.exit(1);
}
console.log('No broken links.');
