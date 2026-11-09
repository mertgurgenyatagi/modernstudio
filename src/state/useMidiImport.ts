/**
 * The MIDI import as the Mixer sees it: the Import MIDI button, the file dialog, the mapping step and the
 * conversion. The stages and every rule are in importFlow.ts (pure, tested); this carries them out:
 * it asks to save the open project first (the same question as New and Open), opens the dialog through
 * the bridge, reads and converts the file, and hands the result to the store as a new, unsaved project
 * named after the MIDI file, with the report waiting. A refusal goes to the quiet line. A cancelled
 * question or dialog changes nothing. Outside the app (no `window.studio`) the command says so.
 */
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import { convertMidi } from '../core/midi/build';
import type { Assignment } from '../core/midi/guess';
import { refuse } from '../core/midi/types';
import { useStudio } from './Studio';
import { IDLE, loadMidi, midiName, reduceImport, type ImportStage } from './importFlow';

export interface MidiImport {
  stage: ImportStage;
  /** The Import MIDI button: ask to save, choose a file, read it, show the mapping step. */
  begin: () => Promise<void>;
  assign: (index: number, assignment: Assignment) => void;
  /** The Import button of the mapping step. */
  convert: () => Promise<void>;
  cancel: () => void;
}

/** Lets the screen draw what has just been set ("Converting…") before heavy work blocks the thread. */
function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useMidiImport(): MidiImport {
  const { dispatch, files, replaceProject } = useStudio();
  const [stage, send] = useReducer(reduceImport, IDLE);
  const latest = useRef(stage);
  useLayoutEffect(() => {
    latest.current = stage;
  });

  const begin = useCallback(async () => {
    if (latest.current.stage !== 'idle') return;
    const bridge = window.studio?.files;
    if (!bridge) {
      dispatch({ type: 'setNotice', message: 'Import MIDI works in the app window only.' });
      return;
    }
    dispatch({ type: 'setNotice', message: null });
    send({ type: 'start' });
    try {
      if (!(await files.confirmDiscard())) {
        send({ type: 'close' });
        return;
      }
      const picked = await bridge.chooseMidi();
      if (picked.kind === 'cancelled') {
        send({ type: 'close' });
        return;
      }
      if (picked.kind === 'error') {
        dispatch({ type: 'setNotice', message: picked.message });
        send({ type: 'close' });
        return;
      }
      send({ type: 'chosen', name: picked.name });
      await afterPaint();
      send({ type: 'read', name: picked.name, result: loadMidi(picked.bytes) });
    } catch (error) {
      dispatch({ type: 'setNotice', message: `The MIDI file could not be opened: ${reasonOf(error)}` });
      send({ type: 'close' });
    }
  }, [dispatch, files]);

  const assign = useCallback((index: number, assignment: Assignment) => send({ type: 'assign', index, assignment }), []);

  const convert = useCallback(async () => {
    const current = latest.current;
    if (current.stage !== 'mapping') return;
    const { name, loaded } = current;
    send({ type: 'convert' });
    await afterPaint();
    try {
      send({ type: 'converted', name, result: convertMidi(loaded.file, loaded.rows) });
    } catch (error) {
      // A conversion that fails unexpectedly is a refusal like any other (the flow cannot be closed while converting).
      send({ type: 'converted', name, result: refuse(`The conversion failed: ${reasonOf(error)}`) });
    }
  }, []);

  const cancel = useCallback(() => send({ type: 'close' }), []);

  // A finished conversion becomes the open project; a refusal goes to the quiet line. Either ends the flow.
  useEffect(() => {
    if (stage.stage === 'done') {
      replaceProject(stage.outcome.project, null, { name: midiName(stage.name), unsaved: true, report: stage.outcome.report });
      send({ type: 'close' });
    } else if (stage.stage === 'refused') {
      dispatch({ type: 'setNotice', message: stage.reason });
      send({ type: 'close' });
    }
  }, [stage, replaceProject, dispatch]);

  return { stage, begin, assign, convert, cancel };
}
