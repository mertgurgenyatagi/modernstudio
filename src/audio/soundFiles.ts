/**
 * The recorded sound files (plan24 step 3) as the app sees them: the manifest, and a way to fetch
 * and decode each file. The files are bundled by Vite, so their addresses come from the build.
 */
import manifestJson from '../assets/sounds/manifest.json';
import type { SoundManifest } from '../core/samples';

export const manifest = manifestJson as unknown as SoundManifest;

const urls = import.meta.glob('../assets/sounds/**/*.wav', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** The address of a file named as in the manifest, such as `bass/bass_28.wav`. */
export function soundUrl(file: string): string {
  const url = urls[`../assets/sounds/${file}`];
  if (!url) throw new Error(`The sound file ${file} is not part of the build.`);
  return url;
}

/**
 * Reads a file's bytes. XMLHttpRequest rather than fetch, because the installed app loads its page
 * from a file address, and fetch does not read those; XMLHttpRequest answers status 0 for a file that
 * was read.
 */
export function readBytes(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', url);
    request.responseType = 'arraybuffer';
    request.onload = () => {
      if (request.status === 0 || (request.status >= 200 && request.status < 300)) resolve(request.response as ArrayBuffer);
      else reject(new Error(`Could not read ${url} (status ${request.status}).`));
    };
    request.onerror = () => reject(new Error(`Could not read ${url}.`));
    request.send();
  });
}

/** Every file listed in the manifest, once. */
export function allSoundFiles(): string[] {
  const files: string[] = [];
  for (const set of Object.values(manifest.instruments)) {
    for (const sample of set.samples) files.push(sample.file);
  }
  return files;
}

/** Fetches and decodes every sound into buffers, keyed by the manifest's file name. */
export async function loadBuffers(context: BaseAudioContext): Promise<Map<string, AudioBuffer>> {
  const buffers = new Map<string, AudioBuffer>();
  await Promise.all(
    allSoundFiles().map(async (file) => {
      const bytes = await readBytes(soundUrl(file));
      buffers.set(file, await context.decodeAudioData(bytes));
    }),
  );
  return buffers;
}
