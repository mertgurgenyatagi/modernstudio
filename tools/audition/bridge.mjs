// Local bridge for the sound audition page.
//
// Browsers hide the Microsoft GS Wavetable Synth from web pages, so this script
// plays MIDI through it for the page. It serves audition.html and accepts MIDI
// messages from it, then hands them to winmidi.ps1, which calls Windows' winmm.
//
// Run:  node tools/audition/bridge.mjs [port]      (default port 7777)
// Then open the address it prints. Press Ctrl+C to stop.
//
// It listens on 127.0.0.1 only and accepts nothing but short MIDI messages
// (note, controller and program changes) from its own page.

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || process.env.PORT || 7777);
const origin = `http://127.0.0.1:${port}`;

if (process.platform !== 'win32') {
  console.error('This bridge only works on Windows.');
  process.exit(1);
}

// ---- Start the Windows side and wait until the synth is open ----
const ps = spawn(
  'powershell.exe',
  ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(here, 'winmidi.ps1')],
  { stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true },
);

let synthName = null;
const ready = new Promise((resolve, reject) => {
  let buf = '';
  ps.stdout.on('data', (chunk) => {
    buf += chunk.toString();
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line.startsWith('READY ')) { synthName = line.slice(6); resolve(); }
      else if (line === 'NOSYNTH') reject(new Error('Windows has no "Microsoft GS Wavetable Synth" MIDI output.'));
      else if (line.startsWith('OPENFAIL')) reject(new Error(`Windows refused to open the synth (${line}). Another program may be holding it.`));
    }
  });
  ps.on('exit', (code) => reject(new Error(`The Windows MIDI helper stopped (exit code ${code}).`)));
});

function send(status, d1, d2) {
  if (ps.stdin.writable) ps.stdin.write(`${status} ${d1} ${d2}\n`);
}
function reset() {
  if (ps.stdin.writable) ps.stdin.write('RESET\n');
}

// A message is [status, data1, data2] or [status, data1]; channel messages only.
function validMessage(m) {
  if (!Array.isArray(m) || m.length < 2 || m.length > 3) return false;
  if (!m.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) return false;
  const [status, d1, d2 = 0] = m;
  return status >= 0x80 && status <= 0xef && d1 <= 127 && d2 <= 127;
}

// ---- HTTP ----
const wrapHead =
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1"></head><body>';
const wrapTail = '</body></html>';

const server = createServer(async (req, res) => {
  const host = req.headers.host;
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) { res.writeHead(403).end(); return; }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    try {
      const page = await readFile(join(here, 'audition.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(wrapHead + page + wrapTail);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' }).end('Could not read audition.html');
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ bridge: true, name: synthName }));
    return;
  }

  if (req.method === 'POST' && req.url === '/midi') {
    // Only the bridge's own page may send notes.
    const o = req.headers.origin;
    if (o !== origin && o !== `http://localhost:${port}`) { res.writeHead(403).end(); return; }
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 20000) { res.writeHead(413).end(); return; }
    }
    let batch;
    try { batch = JSON.parse(body); } catch { res.writeHead(400).end(); return; }
    if (!Array.isArray(batch) || batch.length > 64 || !batch.every(validMessage)) { res.writeHead(400).end(); return; }
    for (const [status, d1, d2 = 0] of batch) send(status, d1, d2);
    res.writeHead(204).end();
    return;
  }

  res.writeHead(404).end();
});

function shutdown() {
  reset();
  try { ps.stdin.end(); } catch {}
  server.close();
  setTimeout(() => process.exit(0), 300);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await ready;
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE'
    ? `Port ${port} is already in use. Is the bridge already running? Or pass another port: node tools/audition/bridge.mjs 7778`
    : e.message);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Connected to ${synthName}.`);
  console.log(`Open ${origin} in your browser. Ctrl+C stops the bridge.`);
});
