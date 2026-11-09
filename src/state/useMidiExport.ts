/**
 * The MIDI export as the Mixer sees it: flatten the Song into a MIDI file, hand the bytes to the main
 * process to be saved, and say how it went on the quiet line. Outside the app (no `window.studio`) the
 * command says so instead.
 */
import { useCallback, type Dispatch } from 'react';
import { baseName, projectName } from '../core/fileState';
import { exportMidi, midiFileName } from '../core/midi/export';
import type { Project } from '../core/project';
import type { Action } from './appState';

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useMidiExport(project: Project, filePath: string | null, dispatch: Dispatch<Action>): () => Promise<void> {
  return useCallback(async () => {
    const bridge = window.studio?.files;
    if (!bridge) {
      dispatch({ type: 'setNotice', message: 'Export MIDI works in the app window only.' });
      return;
    }
    dispatch({ type: 'setNotice', message: null });
    try {
      const made = exportMidi(project);
      if (!made.ok) {
        dispatch({ type: 'setNotice', message: made.reason });
        return;
      }
      const result = await bridge.exportMidi(made.bytes, midiFileName(projectName(filePath)));
      if (result.kind === 'saved') dispatch({ type: 'setNotice', message: `Exported ${baseName(result.path)}` });
      else if (result.kind === 'error') dispatch({ type: 'setNotice', message: result.message });
    } catch (error) {
      dispatch({ type: 'setNotice', message: `The MIDI file could not be exported: ${reasonOf(error)}` });
    }
  }, [project, filePath, dispatch]);
}
