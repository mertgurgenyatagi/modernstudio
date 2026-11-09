import { describe, expect, it } from 'vitest';
import { addNote } from './patterns';
import { createProject, setBpm, setMeter, type Project } from './project';
import { placeBlock } from './song';
import { must } from './testing';
import {
  WAV_SAMPLE_RATE,
  WAV_TAIL_SECONDS,
  encodeWav,
  ensureWavExtension,
  renderFrames,
  renderSeconds,
  songSeconds,
  toInt16,
  wavFileName,
} from './wav';

function withBlocks(bars: number[]): Project {
  let p = createProject();
  p = must(addNote(p, 'drums', 0, { row: 'kick', start: 0 }));
  for (const bar of bars) p = must(placeBlock(p, 'drums', 0, bar));
  return p;
}

describe('the length of the render', () => {
  it('is zero for a Song with no blocks', () => {
    expect(songSeconds(createProject())).toBe(0);
    expect(renderSeconds(createProject())).toBe(0);
    expect(renderFrames(createProject())).toBe(0);
  });

  it('is the Song in seconds plus the tail', () => {
    // 120 BPM in 4/4: a bar is 2 seconds. Blocks at bar 0 and 3 make a Song of 4 bars (a block is one bar).
    const p = withBlocks([0, 3]);
    expect(songSeconds(p)).toBeCloseTo(8, 9);
    expect(renderSeconds(p)).toBeCloseTo(8 + WAV_TAIL_SECONDS, 9);
    expect(renderFrames(p)).toBe((8 + WAV_TAIL_SECONDS) * WAV_SAMPLE_RATE);
  });

  it('follows the tempo and the meter', () => {
    const p = setBpm(withBlocks([0]), 60); // one 4/4 bar at 60 BPM: 4 seconds
    expect(songSeconds(p)).toBeCloseTo(4, 9);
    const q = setMeter(p, '3/4'); // one 3/4 bar at 60 BPM: 3 seconds
    expect(songSeconds(q)).toBeCloseTo(3, 9);
  });

  it('rounds the frames up', () => {
    const p = setBpm(withBlocks([0]), 77);
    expect(renderFrames(p)).toBe(Math.ceil(renderSeconds(p) * WAV_SAMPLE_RATE));
  });
});

describe('file names', () => {
  it('suggests the project name with .wav', () => {
    expect(wavFileName('demo')).toBe('demo.wav');
    expect(wavFileName('Untitled')).toBe('Untitled.wav');
  });

  it('adds the extension only when it is missing', () => {
    expect(ensureWavExtension('C:\\a\\song')).toBe('C:\\a\\song.wav');
    expect(ensureWavExtension('C:\\a\\song.WAV')).toBe('C:\\a\\song.WAV');
  });
});

describe('16-bit samples', () => {
  it('maps -1, 0 and 1 to the ends and the middle', () => {
    expect(toInt16(0)).toBe(0);
    expect(toInt16(1)).toBe(32767);
    expect(toInt16(-1)).toBe(-32768);
    expect(toInt16(0.5)).toBe(16384);
    expect(toInt16(-0.5)).toBe(-16384);
  });

  it('clips what is louder than full scale instead of wrapping', () => {
    expect(toInt16(1.7)).toBe(32767);
    expect(toInt16(-3)).toBe(-32768);
    expect(toInt16(Infinity)).toBe(0);
    expect(toInt16(NaN)).toBe(0);
  });
});

describe('encoding a WAV file', () => {
  const left = Float32Array.from([0, 0.5, -0.5, 1]);
  const right = Float32Array.from([1, -1, 2, 0]);
  const bytes = encodeWav([left, right], 44100);
  const view = new DataView(bytes.buffer);
  const tag = (offset: number) => String.fromCharCode(...bytes.slice(offset, offset + 4));

  it('writes a RIFF/WAVE header for 16-bit stereo PCM', () => {
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(tag(12)).toBe('fmt ');
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(2); // channels
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint32(28, true)).toBe(44100 * 4); // bytes per second
    expect(view.getUint16(32, true)).toBe(4); // bytes per frame
    expect(view.getUint16(34, true)).toBe(16);
    expect(tag(36)).toBe('data');
  });

  it('sizes the chunks from the number of frames', () => {
    expect(bytes.length).toBe(44 + 4 * 4);
    expect(view.getUint32(40, true)).toBe(16);
    expect(view.getUint32(4, true)).toBe(bytes.length - 8);
  });

  it('interleaves the channels, left first, and clips', () => {
    const at = (frame: number, channel: number) => view.getInt16(44 + (frame * 2 + channel) * 2, true);
    expect([at(0, 0), at(0, 1)]).toEqual([0, 32767]);
    expect([at(1, 0), at(1, 1)]).toEqual([16384, -32768]);
    expect([at(2, 0), at(2, 1)]).toEqual([-16384, 32767]); // the 2 is clipped
    expect([at(3, 0), at(3, 1)]).toEqual([32767, 0]);
  });

  it('writes a valid file with no frames', () => {
    const empty = encodeWav([new Float32Array(0), new Float32Array(0)]);
    expect(empty.length).toBe(44);
    expect(new DataView(empty.buffer).getUint32(40, true)).toBe(0);
  });

  it('refuses channels of different lengths, and no channels', () => {
    expect(() => encodeWav([new Float32Array(2), new Float32Array(3)])).toThrow();
    expect(() => encodeWav([])).toThrow();
  });
});
