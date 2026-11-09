/**
 * The store: the app state (appState.ts) and the audio engine, shared with every screen. It wires the
 * two together: the engine is told about each new project, isolate and metronome; Play and Stop go to
 * the engine and its answer comes back as state; Space starts and stops playback.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { AudioEngine } from '../audio/engine';
import type { Project } from '../core/project';
import { canUndo } from '../core/history';
import { initialState, playRequestFor, reduce, type Action, type AppState, type ReplaceOptions } from './appState';
import { commandLetter, isTypingTarget } from './keys';
import { useFiles, type FileActions } from './useFiles';

interface Studio {
  state: AppState;
  project: Project;
  dispatch: Dispatch<Action>;
  engine: AudioEngine;
  canUndo: boolean;
  play: () => void;
  stop: () => void;
  togglePlay: () => void;
  /** Moves the playhead to a bar (0 based); if playing, playback restarts from there. */
  seek: (bar: number) => void;
  /**
   * Replaces the project (New, Open, MIDI import): a new history, playback stopped, the playhead at the start.
   * Ask `files.confirmDiscard()` first. An import passes a name, `unsaved: true` and its report in `options`.
   */
  replaceProject: (project: Project, path?: string | null, options?: ReplaceOptions) => void;
  files: FileActions;
}

const StudioContext = createContext<Studio | null>(null);

export function useStudio(): Studio {
  const studio = useContext(StudioContext);
  if (!studio) throw new Error('useStudio must be used inside <StudioProvider>.');
  return studio;
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, undefined, () => initialState());
  const [engine] = useState(() => new AudioEngine());
  const project = state.history.present;
  /** Counts Play and Stop presses, so that the answer to an old Play is not taken for the latest. */
  const presses = useRef(0);

  // The engine learns of every project change, and of isolate and the metronome.
  useEffect(() => engine.setProject(project), [engine, project]);
  useEffect(() => engine.setIsolated(state.isolated), [engine, state.isolated]);
  useEffect(() => engine.setMetronome(state.metronome), [engine, state.metronome]);

  // Loads the recorded sounds, and hears when the engine stops by itself.
  useEffect(() => {
    engine.onStopped(() => dispatch({ type: 'stopped' }));
    engine.load().catch((error: unknown) => {
      dispatch({ type: 'soundsFailed', message: error instanceof Error ? error.message : String(error) });
    });
    return () => {
      engine.onStopped(null);
      engine.stop();
    };
  }, [engine]);

  const playFrom = useCallback(
    (from: AppState) => {
      presses.current += 1;
      const press = presses.current;
      engine
        .play(playRequestFor(from))
        .then((started) => {
          if (press === presses.current) dispatch({ type: started ? 'started' : 'stopped' });
        })
        .catch((error: unknown) => {
          dispatch({ type: 'soundsFailed', message: error instanceof Error ? error.message : String(error) });
          if (press === presses.current) dispatch({ type: 'stopped' });
        });
    },
    [engine],
  );

  const play = useCallback(() => playFrom(state), [playFrom, state]);

  const seek = useCallback(
    (bar: number) => {
      dispatch({ type: 'setStartBar', bar });
      if (state.playing) playFrom({ ...state, startBar: Number.isInteger(bar) && bar > 0 ? bar : 0 });
    },
    [playFrom, state],
  );

  const stop = useCallback(() => {
    presses.current += 1;
    engine.stop();
    dispatch({ type: 'stopped' });
  }, [engine]);

  const replaceProject = useCallback(
    (next: Project, path: string | null = null, options?: ReplaceOptions) => {
      stop();
      dispatch({ type: 'replaceProject', project: next, path, options });
    },
    [stop],
  );

  const files = useFiles(state, dispatch, replaceProject);

  const togglePlay = useCallback(() => {
    if (state.playing) stop();
    else play();
  }, [state.playing, play, stop]);

  // Space starts and stops playback, except while typing in a field. A focused button would also
  // be pressed by Space, so the key is taken on the way down and on the way up. Ctrl+Z undoes, on
  // every page (there is no redo, questionnaire 14).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target as HTMLElement | null)) return;
      if (commandLetter(event) === 'z' && !event.shiftKey) {
        event.preventDefault();
        dispatch({ type: 'undo' });
        return;
      }
      if (event.code !== 'Space' || event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      if (!event.repeat) togglePlay();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isTypingTarget(event.target as HTMLElement | null)) return;
      event.preventDefault();
    };
    // Ctrl with the wheel zooms the editors and the Song, never the whole window.
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('wheel', onWheel);
    };
  }, [togglePlay]);

  const value = useMemo<Studio>(
    () => ({ state, project, dispatch, engine, canUndo: canUndo(state.history), play, stop, togglePlay, seek, replaceProject, files }),
    [state, project, engine, play, stop, togglePlay, seek, replaceProject, files],
  );
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}
