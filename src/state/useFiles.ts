/**
 * The file commands as the window sees them: New, Open, Save, Save As, the "save changes?" question,
 * reopening the last project at start, the window title and the close prompt. The dialogs and the
 * writing are in the main process (electron/main/files.ts); the rules are pure (core/fileState.ts).
 * Outside the app (no `window.studio`) every command quietly does nothing.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type Dispatch } from 'react';
import { APP_NAME } from '../core/constants';
import { canUndo } from '../core/history';
import { displayName, isDirty, projectName, windowTitle } from '../core/fileState';
import type { FileCommand } from '../core/fileBridge';
import { createProject, type Project } from '../core/project';
import { parseProject, serializeProject } from '../core/serialize';
import type { Action, AppState } from './appState';

export interface FileActions {
  /** The project differs from the file it was saved to (or was never saved and has been edited). */
  dirty: boolean;
  /** Asks to save first when there are unsaved changes; the new project replaces the present one. */
  newProject: () => Promise<void>;
  openProject: () => Promise<void>;
  /** True when the project was written. */
  save: () => Promise<boolean>;
  saveAs: () => Promise<boolean>;
  /**
   * The question to ask before the present project goes away (New, Open and, later, MIDI import):
   * true when it may go, because it is saved, the user chose Save and it worked, or chose not to save.
   */
  confirmDiscard: () => Promise<boolean>;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useFiles(
  state: AppState,
  dispatch: Dispatch<Action>,
  replaceProject: (project: Project, path: string | null) => void,
): FileActions {
  const bridge = typeof window === 'undefined' ? undefined : window.studio?.files;
  const latest = useRef(state);
  useLayoutEffect(() => {
    latest.current = state;
  });

  const present = state.history.present;
  const dirty = useMemo(() => isDirty(present, state.savedProject), [present, state.savedProject]);

  const write = useCallback(
    async (asNew: boolean): Promise<boolean> => {
      if (!bridge) return false;
      const { history, filePath, draftName } = latest.current;
      const project = history.present;
      const text = serializeProject(project);
      const name = displayName(filePath, draftName);
      try {
        const result = asNew ? await bridge.saveAs(text, name) : await bridge.save(filePath, text, name);
        if (result.kind === 'saved') {
          dispatch({ type: 'saved', path: result.path, project });
          return true;
        }
        if (result.kind === 'error') dispatch({ type: 'setNotice', message: result.message });
      } catch (error) {
        dispatch({ type: 'setNotice', message: `The project could not be saved: ${reasonOf(error)}` });
      }
      return false;
    },
    [bridge, dispatch],
  );

  const save = useCallback(() => write(false), [write]);
  const saveAs = useCallback(() => write(true), [write]);

  const confirmDiscard = useCallback(async (): Promise<boolean> => {
    const { history, savedProject, filePath, draftName } = latest.current;
    if (!bridge || !isDirty(history.present, savedProject)) return true;
    try {
      const choice = await bridge.confirmDiscard(displayName(filePath, draftName));
      if (choice === 'cancel') return false;
      if (choice === 'discard') return true;
    } catch {
      return false;
    }
    return write(false);
  }, [bridge, write]);

  const newProject = useCallback(async () => {
    if (!(await confirmDiscard())) return;
    replaceProject(createProject(), null);
  }, [confirmDiscard, replaceProject]);

  const openProject = useCallback(async () => {
    if (!bridge || !(await confirmDiscard())) return;
    try {
      const result = await bridge.open();
      if (result.kind === 'error') {
        dispatch({ type: 'setNotice', message: result.message });
        return;
      }
      if (result.kind !== 'opened') return;
      const parsed = parseProject(result.text);
      if (!parsed.ok) {
        dispatch({ type: 'setNotice', message: `${projectName(result.path)} could not be opened. ${parsed.reason}` });
        return;
      }
      replaceProject(parsed.project, result.path);
    } catch (error) {
      dispatch({ type: 'setNotice', message: `The project could not be opened: ${reasonOf(error)}` });
    }
  }, [bridge, confirmDiscard, dispatch, replaceProject]);

  // At start, the last project is reopened; if it is gone or does not parse, a new project stays with a quiet line.
  useEffect(() => {
    if (!bridge) return;
    let cancelled = false;
    bridge
      .loadLast()
      .then((result) => {
        if (cancelled) return;
        const s = latest.current;
        if (canUndo(s.history) || s.filePath !== null) return; // the user has already started
        if (result.kind === 'none') {
          if (result.notice) dispatch({ type: 'setNotice', message: result.notice });
          return;
        }
        const parsed = parseProject(result.text);
        if (parsed.ok) replaceProject(parsed.project, result.path);
        else {
          dispatch({
            type: 'setNotice',
            message: `The last project, ${projectName(result.path)}, could not be opened. ${parsed.reason} Starting a new project.`,
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [bridge, dispatch, replaceProject]);

  // The window title, and the main process learns whether closing needs a question.
  useEffect(() => {
    document.title = windowTitle(state.filePath, dirty, APP_NAME, state.draftName);
  }, [state.filePath, state.draftName, dirty]);
  useEffect(() => {
    bridge?.setDirty(dirty);
  }, [bridge, dirty]);

  // The File menu and its shortcuts.
  useEffect(() => {
    if (!bridge) return;
    const run = (command: FileCommand) => {
      if (command === 'new') void newProject();
      else if (command === 'open') void openProject();
      else if (command === 'save') void save();
      else void saveAs();
    };
    return bridge.onCommand(run);
  }, [bridge, newProject, openProject, save, saveAs]);

  // Closing the window with unsaved changes: the main process holds it back and asks here.
  useEffect(() => {
    if (!bridge) return;
    return bridge.onCloseRequested(() => {
      void confirmDiscard().then((ok) => {
        if (ok) bridge.closeWindow();
      });
    });
  }, [bridge, confirmDiscard]);

  return useMemo(
    () => ({ dirty, newProject, openProject, save, saveAs, confirmDiscard }),
    [dirty, newProject, openProject, save, saveAs, confirmDiscard],
  );
}
