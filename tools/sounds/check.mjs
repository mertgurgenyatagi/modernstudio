// Checks the shipped sample files against their manifest: every file exists, is a 16-bit mono WAV at
// the manifest's sample rate, has the length the manifest says, is not silent, does not clip, and the
// pitched samples between them cover every note the instrument can be asked to play.
//
// Run:  npm run check:sounds        (exit code 1 and a list of problems if anything is wrong)

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = join(root, 'src', 'assets', 'sounds');
const problems = [];
const fail = (msg) => problems.push(msg);

// The notes each instrument must cover (docs/midi-import.md, the guitars with 12 frets).
const REQUIRED_RANGE = { bass: [28, 55], guitar: [40, 76] };
const DRUM_ROWS = ['kick', 'snare', 'hihat', 'openHihat', 'crash'];
// Drum hits of the General MIDI kit are genuinely short (the kick is about 0.1 s, the closed hi-hat 0.06 s).
const MIN_SECONDS = { pitched: 1.5, drums: 0.04 };
const MAX_SECONDS = 12;
const SILENT_PEAK = 0.01; // linear, about -40 dBFS
const CLIP_PEAK = 0.999;

function readWav(path) {
  const b = readFileSync(path);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV file');
  let pos = 12;
  let fmt = null;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4);
    const size = b.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ') {
      fmt = { format: b.readUInt16LE(body), channels: b.readUInt16LE(body + 2), rate: b.readUInt32LE(body + 4), bits: b.readUInt16LE(body + 14) };
    } else if (id === 'data') {
      if (!fmt) throw new Error('data before fmt');
      const frames = Math.floor(size / 2 / fmt.channels);
      let peak = 0;
      for (let i = 0; i < frames * fmt.channels; i++) peak = Math.max(peak, Math.abs(b.readInt16LE(body + i * 2)) / 32768);
      return { ...fmt, frames, seconds: frames / fmt.rate, peak };
    }
    pos = body + size + (size % 2);
  }
  throw new Error('no data chunk');
}

const manifestPath = join(dir, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error(`Missing ${manifestPath}. Run: python tools/sounds/capture.py`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
let count = 0;

function checkFile(entry, label, kind) {
  const path = join(dir, entry.file);
  if (!existsSync(path)) return fail(`${label}: file ${entry.file} is missing`);
  count++;
  let wav;
  try {
    wav = readWav(path);
  } catch (e) {
    return fail(`${label}: ${entry.file}: ${e.message}`);
  }
  if (wav.format !== 1 || wav.bits !== 16 || wav.channels !== 1) fail(`${label}: ${entry.file} is not 16-bit mono PCM`);
  if (wav.rate !== manifest.sampleRate) fail(`${label}: ${entry.file} has rate ${wav.rate}, expected ${manifest.sampleRate}`);
  if (Math.abs(wav.seconds - entry.seconds) > 0.002) fail(`${label}: ${entry.file} is ${wav.seconds.toFixed(3)} s, manifest says ${entry.seconds}`);
  if (wav.seconds < MIN_SECONDS[kind] || wav.seconds > MAX_SECONDS) fail(`${label}: ${entry.file} length ${wav.seconds.toFixed(2)} s is out of bounds`);
  if (wav.peak < SILENT_PEAK) fail(`${label}: ${entry.file} is silent (peak ${wav.peak.toFixed(4)})`);
  if (wav.peak >= CLIP_PEAK) fail(`${label}: ${entry.file} clips (peak ${wav.peak.toFixed(4)})`);
}

for (const [name, [low, high]] of Object.entries(REQUIRED_RANGE)) {
  const inst = manifest.instruments?.[name];
  if (!inst) {
    fail(`${name}: missing from the manifest`);
    continue;
  }
  const covered = new Set();
  for (const s of inst.samples) {
    checkFile(s, name, 'pitched');
    for (let n = s.covers[0]; n <= s.covers[1]; n++) covered.add(n);
    if (s.pitch < s.covers[0] || s.pitch > s.covers[1]) fail(`${name}: ${s.file} does not cover its own pitch`);
  }
  for (let n = low; n <= high; n++) if (!covered.has(n)) fail(`${name}: note ${n} is not covered by any sample`);
}

const drums = manifest.instruments?.drums;
if (!drums) fail('drums: missing from the manifest');
else {
  for (const row of DRUM_ROWS) {
    const s = drums.samples.find((x) => x.row === row);
    if (!s) fail(`drums: no sample for ${row}`);
    else checkFile(s, 'drums', 'drums');
  }
}

if (problems.length) {
  console.error(`${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`Sounds OK: ${count} files checked.`);
