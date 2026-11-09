/**
 * WAV export, the parts that are not sound: how long the render is, what the file is called, and the
 * WAV file itself (16-bit PCM, stereo). The render is src/audio/render.ts. Pure, so it is tested
 * without a window. See docs/editing-and-project.md and docs/sound.md.
 */
import type { Project } from './project';
import { songBars } from './song';
import { TICKS_PER_QUARTER, ticksPerBar } from './time';

export const WAV_SAMPLE_RATE = 44100;
export const WAV_CHANNELS = 2;
/** Silence-to-ring-out after the last bar, so that releases and the longest sample are not cut (assumed; docs/open-items.md). */
export const WAV_TAIL_SECONDS = 3;
export const WAV_EXTENSION = 'wav';

/** The seconds the Song itself lasts, from bar 1 to the end of the last block, at the project's tempo. */
export function songSeconds(project: Project): number {
  const ticks = songBars(project) * ticksPerBar(project.meter);
  return (ticks / TICKS_PER_QUARTER) * (60 / project.bpm);
}

/** The length of the render in seconds: the Song plus the tail. 0 for a Song with no blocks (nothing to export). */
export function renderSeconds(project: Project): number {
  const song = songSeconds(project);
  return song > 0 ? song + WAV_TAIL_SECONDS : 0;
}

/** The length of the render in sample frames. */
export function renderFrames(project: Project, sampleRate = WAV_SAMPLE_RATE): number {
  return Math.ceil(renderSeconds(project) * sampleRate);
}

/** The suggested file name for the Save dialog: the project's name with the WAV extension. */
export function wavFileName(projectName: string): string {
  return `${projectName}.${WAV_EXTENSION}`;
}

/** Adds the .wav extension when the chosen name has none of its own. */
export function ensureWavExtension(path: string): string {
  return path.toLowerCase().endsWith(`.${WAV_EXTENSION}`) ? path : `${path}.${WAV_EXTENSION}`;
}

/** A sample from -1 to 1 as a 16-bit integer. Anything louder than full scale is clipped, not wrapped. */
export function toInt16(sample: number): number {
  if (!Number.isFinite(sample)) return 0;
  const clipped = Math.max(-1, Math.min(1, sample));
  return Math.round(clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff);
}

/**
 * A WAV file: the 44 byte RIFF header and then 16-bit little-endian PCM, the channels interleaved.
 * `channels` all have the same length.
 */
export function encodeWav(channels: readonly Float32Array[], sampleRate = WAV_SAMPLE_RATE): Uint8Array {
  const count = channels.length;
  if (count === 0) throw new Error('A WAV file needs at least one channel.');
  const frames = channels[0]?.length ?? 0;
  if (channels.some((channel) => channel.length !== frames)) throw new Error('The channels of a WAV file must be the same length.');
  const bytesPerFrame = count * 2;
  const dataBytes = frames * bytesPerFrame;
  const out = new Uint8Array(44 + dataBytes);
  const view = new DataView(out.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true); // size of the format chunk
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, count, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerFrame, true);
  view.setUint16(32, bytesPerFrame, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (const channel of channels) {
      view.setInt16(offset, toInt16(channel[frame] ?? 0), true);
      offset += 2;
    }
  }
  return out;
}
