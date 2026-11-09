/**
 * The WAV export as the Mixer sees it: render the whole Song offline, hand the bytes to the main
 * process to be saved, and say how it went on the quiet line. Outside the app (no `window.studio`)
 * the command says so instead of rendering.
 */
import { useCallback, useState, type Dispatch } from 'react';
import { EmptySongError, renderSongToWav } from '../audio/render';
import { baseName } from '../core/fileState';
import type { Project } from '../core/project';
import { wavFileName } from '../core/wav';
import type { Action } from './appState';

export interface WavExport {
  /** True while the Song is being rendered. */
  rendering: boolean;
  exportWav: () => Promise<void>;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** `name` is the project's display name (the file's name, the name of an import, or Untitled): the export's suggested file name. */
export function useWavExport(project: Project, name: string, dispatch: Dispatch<Action>): WavExport {
  const [rendering, setRendering] = useState(false);

  const exportWav = useCallback(async () => {
    if (rendering) return;
    const bridge = window.studio?.files;
    if (!bridge) {
      dispatch({ type: 'setNotice', message: 'Export WAV works in the app window only.' });
      return;
    }
    dispatch({ type: 'setNotice', message: null });
    setRendering(true);
    try {
      const bytes = await renderSongToWav(project);
      const result = await bridge.exportWav(bytes, wavFileName(name));
      if (result.kind === 'saved') dispatch({ type: 'setNotice', message: `Exported ${baseName(result.path)}` });
      else if (result.kind === 'error') dispatch({ type: 'setNotice', message: result.message });
    } catch (error) {
      const message = error instanceof EmptySongError ? 'The Song has no blocks, so there is nothing to export.' : `The WAV could not be exported: ${reasonOf(error)}`;
      dispatch({ type: 'setNotice', message });
    } finally {
      setRendering(false);
    }
  }, [rendering, project, name, dispatch]);

  return { rendering, exportWav };
}
