/**
 * The store: the app state (appState.ts) and the audio engine, shared with every screen. It wires the
 * two together: the engine is told about each new project, isolate and metronome; Play and Stop go to
 * the engine and its answer comes back as state; Space starts and stops playback.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { AudioEngine } from '../audio/engine';
import type { Project } from '../core/project';
import { canUndo } from '../core/history';
import { initialState, playRequestFor, reduce, type Action, type AppState } from './appState';
import { isTypingTarget } from './keys';

interface Studio {
  state: AppState;
  project: Project;
  dispatch: Dispatch<Action>;
  engine: AudioEngine;
  canUndo: boolean;
  play: () => void;
  stop: () => void;
  togglePlay: () => void;
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

  const play = useCallback(() => {
    presses.current += 1;
    const press = presses.current;
    engine
      .play(playRequestFor(state))
      .then((started) => {
        if (press === presses.current) dispatch({ type: started ? 'started' : 'stopped' });
      })
      .catch((error: unknown) => {
        dispatch({ type: 'soundsFailed', message: error instanceof Error ? error.message : String(error) });
        if (press === presses.current) dispatch({ type: 'stopped' });
      });
  }, [engine, state]);

  const stop = useCallback(() => {
    presses.current += 1;
    engine.stop();
    dispatch({ type: 'stopped' });
  }, [engine]);

  const togglePlay = useCallback(() => {
    if (state.playing) stop();
    else play();
  }, [state.playing, play, stop]);

  // Space starts and stops playback, except while typing in a field. A focused button would also
  // be pressed by Space, so the key is taken on the way down and on the way up.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target as HTMLElement | null)) return;
      event.preventDefault();
      if (!event.repeat) togglePlay();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isTypingTarget(event.target as HTMLElement | null)) return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, [togglePlay]);

  const value = useMemo<Studio>(
    () => ({ state, project, dispatch, engine, canUndo: canUndo(state.history), play, stop, togglePlay }),
    [state, project, engine, play, stop, togglePlay],
  );
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}
