import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { INSTRUMENT_LABELS } from '../../core/instruments';
import { addNote, addNotes, noteKey, removeNotes, replaceNotes } from '../../core/patterns';
import type { Note } from '../../core/project';
import { NOTE_VALUE_TICKS, TICKS_PER_QUARTER, patternTicks, ticksPerBar } from '../../core/time';
import {
  afterNotePaste,
  canPasteNotes,
  copyNotesToClipboard,
  noteSpan,
  pasteShift,
  shiftNotes,
  spanUnit,
} from '../../state/clipboard';
import { commandLetter, isTypingTarget } from '../../state/keys';
import { useStudio } from '../../state/Studio';
import { anchoredScroll, barsShown, tickWidth, wheelFactor, zoomView } from '../../state/view';
import { useElementSize } from '../../ui/useElementSize';
import { describeStart, gridLines, rulerMarks } from './grid';
import { bigRowStep, rowHeight, type EditorLayout } from './layout';
import { DRAG_THRESHOLD_PX, clickStart, newNoteLength } from './noteGeometry';
import { groupRowShift, groupShift, movedGroup, notesInRect, resizedGroup, shownNotes, type Rect, type Shown } from './selection';
import { useTryEdit } from './useTryEdit';
import './noteEditor.css';

/** The height of the bar and beat numbers above the grid, in pixels. */
const RULER_PX = 22;
const NO_KEYS: ReadonlySet<string> = new Set();

interface Point {
  x: number;
  y: number;
  tick: number;
  row: number;
}

/** What the pointer is doing between press and release. Kept in a ref: it is not drawn. */
type Gesture =
  | { kind: 'empty'; start: Point; additive: boolean; base: ReadonlySet<string>; moved: boolean }
  | { kind: 'note'; start: Point; key: string; keys: string[]; wasSelected: boolean; moved: boolean; shift: number; rowShift: number }
  | { kind: 'grip'; start: Point; keys: string[]; moved: boolean; dx: number }
  | { kind: 'toggle' };

/** What is drawn while the pointer is held: the rectangle, or the notes where they would land. */
type Drag =
  | { kind: 'marquee'; x0: number; y0: number; x1: number; y1: number }
  | { kind: 'move'; keys: ReadonlySet<string>; shift: number; rowShift: number; refused: boolean }
  | { kind: 'resize'; keys: ReadonlySet<string>; lengths: ReadonlyMap<string, number> };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The note editor every instrument page shares (the user's sweeping changes, 2026-11-09): the rows of
 * the instrument's layout (layout.ts) under the bar and beat numbers, with the lines of the chosen note
 * value. It does what a music program's editor does:
 *
 * - A click on an empty place puts a note there (one step of the note value) and plays it. A drag
 *   over empty space draws a rectangle that selects the notes it touches; Ctrl or Shift adds to the
 *   selection, and a Ctrl or Shift click on a note adds or removes it.
 * - A click on a note selects it; dragging it moves the selection in time and across rows. The
 *   grip at a note's right edge makes the selection longer or shorter. On the Drums a click on a hit
 *   removes it, as on a pad, and dragging it moves it.
 * - Delete or Backspace deletes, Ctrl+A selects all, Ctrl+C, Ctrl+X and Ctrl+V copy, cut and paste,
 *   Ctrl+D doubles the selection after itself, the arrow keys nudge it (Shift with up or down: an
 *   octave, or a string), Escape lets go.
 * - Ctrl with the wheel zooms where the pointer is; the wheel scrolls (sideways when there is
 *   nothing to scroll up and down). There are no scrollbars.
 *
 * Each change is one Undo step, checked by the model. A refusal is said through `onMessage`.
 */
export function NoteEditor({ layout, onMessage, startRow }: { layout: EditorLayout; onMessage: (text: string) => void; startRow?: number }) {
  const { state, project, dispatch, engine } = useStudio();
  const tryEdit = useTryEdit();
  const id = layout.id;
  const instrument = project.instruments[id];
  const patternIndex = instrument.selectedPattern;
  const pattern = instrument.patterns[patternIndex];
  const bars = pattern?.bars ?? 1;
  const barTicks = ticksPerBar(project.meter);
  const total = patternTicks(project.meter, bars);
  const value = state.noteValue;
  const step = NOTE_VALUE_TICKS[value];

  const scrollerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(scrollerRef);
  const tickPx = tickWidth(size.width - layout.labelPx, barsShown(state.editorView, bars), barTicks);
  const rowPx = rowHeight(layout, size.height - RULER_PX);
  const rowCount = layout.rows.length;
  const width = total * tickPx;
  const height = rowCount * rowPx;

  const shown = useMemo(() => shownNotes(pattern?.notes ?? [], layout, total, value), [pattern, layout, total, value]);
  const byKey = useMemo(() => new Map(shown.map((s) => [s.key, s])), [shown]);

  // The selection belongs to the pattern on screen: another pattern starts with nothing selected.
  const scope = `${id}:${patternIndex}`;
  const [selection, setSelection] = useState<{ scope: string; keys: ReadonlySet<string> }>({ scope, keys: NO_KEYS });
  const selected = selection.scope === scope ? selection.keys : NO_KEYS;
  const select = useCallback((keys: Iterable<string>) => setSelection({ scope, keys: new Set(keys) }), [scope]);

  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<{ row: number; start: number } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  /** Where a zoom by the wheel should stay put; null zooms about the middle of the view. */
  const anchor = useRef<{ tick: number; offset: number } | null>(null);
  const scrollLeft = useRef(0);
  const lastTickPx = useRef(tickPx);

  const audition = useCallback(
    (note: Note) => {
      const sound = layout.soundOf(note);
      if (sound) engine.audition(id, sound, 'length' in note ? Math.min(note.length, TICKS_PER_QUARTER) : 0);
    },
    [engine, id, layout],
  );

  // ---- Zoom and scroll ----

  // After a zoom the point under the pointer (or the middle of the view) stays where it was.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const before = lastTickPx.current;
    lastTickPx.current = tickPx;
    const wanted = anchor.current;
    anchor.current = null;
    if (!scroller || before <= 0 || tickPx <= 0 || before === tickPx) return;
    const view = scroller.clientWidth - layout.labelPx;
    const at = wanted ?? { tick: (scrollLeft.current + view / 2) / before, offset: view / 2 };
    scroller.scrollLeft = anchoredScroll(at.tick, at.offset, tickPx);
    scrollLeft.current = scroller.scrollLeft;
  }, [tickPx, layout.labelPx]);

  // Another pattern starts at its beginning.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollLeft = 0;
    scrollLeft.current = 0;
  }, [scope]);

  // The roll first shows the row the page asks for (middle C on Keys) in the middle, once.
  const startDone = useRef(false);
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (startDone.current || !scroller || startRow === undefined || size.height <= 0) return;
    startDone.current = true;
    scroller.scrollTop = Math.max(0, (startRow + 0.5) * rowPx - (size.height - RULER_PX) / 2);
  }, [startRow, rowPx, size.height]);

  const latest = useRef({ tickPx, bars, view: state.editorView, labelPx: layout.labelPx });
  useEffect(() => {
    latest.current = { tickPx, bars, view: state.editorView, labelPx: layout.labelPx };
  });

  // Ctrl and the wheel zoom about the pointer; the wheel alone scrolls, sideways when nothing scrolls up and down.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onWheel = (event: WheelEvent) => {
      const now = latest.current;
      if (event.ctrlKey) {
        event.preventDefault();
        if (now.tickPx <= 0) return;
        const next = zoomView(now.view, now.bars, wheelFactor(event.deltaY));
        if (next.barsInView === barsShown(now.view, now.bars)) return; // already as far as it goes
        const offset = event.clientX - scroller.getBoundingClientRect().left - now.labelPx;
        anchor.current = { tick: (scroller.scrollLeft + offset) / now.tickPx, offset };
        dispatch({ type: 'setEditorView', view: next });
        return;
      }
      if (event.shiftKey || scroller.scrollHeight > scroller.clientHeight + 1) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      scroller.scrollLeft += event.deltaY;
    };
    scroller.addEventListener('wheel', onWheel, { passive: false });
    return () => scroller.removeEventListener('wheel', onWheel);
  }, [dispatch]);

  // ---- The playhead: drawn while this instrument's own loop plays, moved straight on the element ----

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const playhead = playheadRef.current;
      if (playhead) {
        const request = engine.playingRequest;
        const position = request && request.mode === 'pattern' && request.focus === id ? engine.position() : null;
        if (position) {
          playhead.style.display = 'block';
          playhead.style.transform = `translateX(${Math.min(Math.max(position.tick, 0), total) * tickPx}px)`;
        } else {
          playhead.style.display = 'none';
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [engine, id, total, tickPx]);

  // ---- Editing ----

  const selectedShown = useMemo(() => shown.filter((s) => selected.has(s.key)), [shown, selected]);

  /** Moves the notes with these keys, as one Undo step. */
  const commitMove = useCallback(
    (keys: readonly string[], shift: number, rowShift: number) => {
      const group = keys.map((k) => byKey.get(k)).filter((s): s is Shown => s !== undefined);
      if (group.length === 0 || (shift === 0 && rowShift === 0)) return;
      const to = movedGroup(group, layout, shift, rowShift);
      if (!to) return;
      const reason = tryEdit((p) => replaceNotes(p, id, patternIndex, group.map((s) => s.note), to));
      onMessage(reason ?? '');
      if (!reason) select(to.map(noteKey));
    },
    [byKey, layout, tryEdit, id, patternIndex, onMessage, select],
  );

  /** Puts notes in, as one Undo step, leaving out what falls past the end or off the rows; they become the selection. */
  const putNotes = useCallback(
    (notes: readonly Note[], shift: number): boolean => {
      const moved = shiftNotes(notes, shift, total);
      const fitting = moved.notes.filter((n) => layout.rowOf(n) !== null);
      const dropped = moved.dropped + moved.notes.length - fitting.length;
      if (fitting.length === 0) {
        onMessage(dropped > 0 ? 'Nothing pasted: the notes fall past the end of the pattern.' : '');
        return false;
      }
      const reason = tryEdit((p) => addNotes(p, id, patternIndex, fitting));
      if (reason) {
        onMessage(reason);
        return false;
      }
      select(fitting.map(noteKey));
      onMessage(dropped > 0 ? `${plural(dropped, 'note falls', 'notes fall')} past the end of the pattern, left out.` : '');
      return true;
    },
    [total, layout, tryEdit, id, patternIndex, select, onMessage],
  );

  const keyActions = useRef<{ handle: (event: KeyboardEvent) => void }>({ handle: () => undefined });
  useEffect(() => {
    const remove = () => {
      if (selectedShown.length === 0) return;
      dispatch({ type: 'edit', change: (p) => removeNotes(p, id, patternIndex, selectedShown.map((s) => s.note)) });
      select([]);
      onMessage('');
    };
    const copy = (): boolean => {
      if (selectedShown.length === 0) return false;
      dispatch({ type: 'setNoteClipboard', clipboard: copyNotesToClipboard(id, patternIndex, selectedShown.map((s) => s.note), step) });
      return true;
    };
    const paste = () => {
      const clip = state.noteClipboard;
      if (!clip) return;
      if (!canPasteNotes(clip.instrument, id)) {
        onMessage(`Notes copied on ${INSTRUMENT_LABELS[clip.instrument]} paste only there.`);
        return;
      }
      const shift = pasteShift(clip, patternIndex);
      if (putNotes(clip.notes, shift)) dispatch({ type: 'setNoteClipboard', clipboard: afterNotePaste(clip, patternIndex, shift) });
    };
    const duplicate = () => {
      const notes = selectedShown.map((s) => s.note);
      if (notes.length > 0) putNotes(notes, noteSpan(notes, step, spanUnit(step)));
    };
    const nudge = (ticks: number, rows: number) => {
      const held = selectedShown[0];
      if (!held) return;
      const notes = selectedShown.map((s) => s.note);
      const shift = ticks === 0 ? 0 : groupShift(notes, held.note, held.start + ticks, value, total);
      const rowShift = groupRowShift(selectedShown.map((s) => s.row), rows, rowCount);
      commitMove(selectedShown.map((s) => s.key), shift, rowShift);
      if (rowShift !== 0) {
        const note = layout.noteOn(held.row + rowShift, held.start + shift, 'length' in held.note ? held.note.length : 0);
        if (note) audition(note);
      }
    };
    keyActions.current.handle = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target as HTMLElement | null)) return;
      const letter = commandLetter(event);
      if (letter !== null) {
        if (letter === 'a') select(shown.map((s) => s.key));
        else if (letter === 'c') {
          if (copy()) onMessage(`${plural(selectedShown.length, 'note', 'notes')} copied.`);
        } else if (letter === 'x') {
          if (copy()) remove();
        } else if (letter === 'v') paste();
        else if (letter === 'd') duplicate();
        else return;
        event.preventDefault();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const big = event.shiftKey ? bigRowStep(layout) : 1;
      const arrow = event.key.startsWith('Arrow');
      if (arrow && selectedShown.length === 0) return; // nothing to move: the arrows scroll
      if (event.key === 'Delete' || event.key === 'Backspace') remove();
      else if (event.key === 'Escape') select([]);
      else if (event.key === 'ArrowLeft') nudge(-step, 0);
      else if (event.key === 'ArrowRight') nudge(step, 0);
      else if (event.key === 'ArrowUp') nudge(0, -big);
      else if (event.key === 'ArrowDown') nudge(0, big);
      else return;
      event.preventDefault();
    };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => keyActions.current.handle(event);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ---- The pointer ----

  const pointAt = (event: { clientX: number; clientY: number }): Point => {
    const box = gridRef.current?.getBoundingClientRect();
    const x = event.clientX - (box?.left ?? 0);
    const y = event.clientY - (box?.top ?? 0);
    return { x, y, tick: tickPx > 0 ? x / tickPx : 0, row: rowPx > 0 ? y / rowPx : 0 };
  };

  const rowAt = (point: Point) => Math.min(rowCount - 1, Math.max(0, Math.floor(point.row)));

  const place = (point: Point) => {
    const row = Math.floor(point.row);
    if (row < 0 || row >= rowCount || point.x < 0 || point.x > width) return;
    const start = clickStart(point.x, tickPx, value, total);
    const note = layout.noteOn(row, start, newNoteLength(start, value, total));
    if (!note) return;
    const reason = tryEdit((p) => addNote(p, id, patternIndex, note));
    onMessage(reason ?? '');
    if (reason) return;
    audition(note);
    select(layout.kind === 'drums' ? [] : [noteKey(note)]);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || tickPx <= 0) return;
    event.preventDefault();
    scrollerRef.current?.focus({ preventScroll: true });
    setHover(null);
    const point = pointAt(event);
    const target = event.target as HTMLElement;
    const noteElement = target.closest<HTMLElement>('[data-key]');
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!noteElement) {
      gesture.current = { kind: 'empty', start: point, additive, base: additive ? selected : NO_KEYS, moved: false };
      return;
    }
    const key = noteElement.dataset.key ?? '';
    const onGrip = target.closest('[data-grip]') !== null;
    if (additive && !onGrip) {
      const next = new Set(selected);
      if (next.has(key) && !event.shiftKey) next.delete(key);
      else next.add(key);
      select(next);
      gesture.current = { kind: 'toggle' };
      return;
    }
    const wasSelected = selected.has(key);
    const keys = wasSelected ? [...selected] : [key];
    if (!wasSelected && layout.kind !== 'drums') select(keys);
    gesture.current = onGrip
      ? { kind: 'grip', start: point, keys, moved: false, dx: 0 }
      : { kind: 'note', start: point, key, keys, wasSelected, moved: false, shift: 0, rowShift: 0 };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    const point = pointAt(event);
    if (!g) {
      // The place a click would put a note, shown faintly under the pointer.
      if (event.buttons !== 0 || (event.target as HTMLElement).closest('[data-key]')) {
        if (hover) setHover(null);
        return;
      }
      const row = Math.floor(point.row);
      const start = point.x >= 0 && point.x <= width ? clickStart(point.x, tickPx, value, total) : -1;
      if (row < 0 || row >= rowCount || start < 0) {
        if (hover) setHover(null);
      } else if (!hover || hover.row !== row || hover.start !== start) setHover({ row, start });
      return;
    }
    if (g.kind === 'toggle') return;
    if (!g.moved && Math.hypot(point.x - g.start.x, point.y - g.start.y) < DRAG_THRESHOLD_PX) return;
    g.moved = true;

    if (g.kind === 'empty') {
      const rect: Rect = { from: g.start.tick, to: point.tick, top: rowAt(g.start), bottom: rowAt(point) };
      const hits = notesInRect(shown, rect).map((s) => s.key);
      select([...g.base, ...hits]);
      setDrag({ kind: 'marquee', x0: g.start.x, y0: g.start.y, x1: Math.min(Math.max(point.x, 0), width), y1: Math.min(Math.max(point.y, 0), height) });
      return;
    }

    if (g.kind === 'grip') {
      const group = g.keys.map((k) => byKey.get(k)).filter((s): s is Shown => s !== undefined);
      g.dx = point.tick - g.start.tick;
      const resized = resizedGroup(group.map((s) => s.note), g.dx, value, total);
      const lengths = new Map<string, number>();
      resized.forEach((n, i) => {
        const s = group[i];
        if (s && 'length' in n) lengths.set(s.key, Math.min(n.length, total - n.start));
      });
      setDrag({ kind: 'resize', keys: new Set(g.keys), lengths });
      return;
    }

    // Moving: the held note lands on a line of the note value, the rest go the same way.
    const group = g.keys.map((k) => byKey.get(k)).filter((s): s is Shown => s !== undefined);
    const held = byKey.get(g.key);
    if (!held || group.length === 0) return;
    if (layout.kind === 'drums' && !g.wasSelected) {
      // A dragged hit becomes the selection, so it can be moved on with the arrow keys.
      select(g.keys);
      g.wasSelected = true;
    }
    const shift = groupShift(group.map((s) => s.note), held.note, held.start + (point.tick - g.start.tick), value, total);
    const rowShift = groupRowShift(group.map((s) => s.row), Math.round(point.row - g.start.row), rowCount);
    if (rowShift !== g.rowShift) {
      const note = layout.noteOn(held.row + rowShift, held.start + shift, 'length' in held.note ? held.note.length : 0);
      if (note) audition(note);
    }
    g.shift = shift;
    g.rowShift = rowShift;
    const to = movedGroup(group, layout, shift, rowShift);
    const refused = !to || !replaceNotes(project, id, patternIndex, group.map((s) => s.note), to).ok;
    setDrag({ kind: 'move', keys: new Set(g.keys), shift, rowShift, refused: refused && (shift !== 0 || rowShift !== 0) });
  };

  const finish = (commit: boolean) => {
    const g = gesture.current;
    gesture.current = null;
    setDrag(null);
    if (!g || !commit || g.kind === 'toggle') return;
    if (!g.moved) {
      if (g.kind === 'empty') {
        if (!g.additive) place(g.start);
      } else if (g.kind === 'note') {
        const s = byKey.get(g.key);
        if (layout.kind === 'drums' && s) {
          // A pad: a click on a hit takes it away.
          dispatch({ type: 'edit', change: (p) => removeNotes(p, id, patternIndex, [s.note]) });
          const rest = new Set(selected);
          rest.delete(g.key);
          select(rest);
          onMessage('');
        } else if (g.wasSelected) {
          select([g.key]);
        }
      }
      return;
    }
    if (g.kind === 'note') commitMove(g.keys, g.shift, g.rowShift);
    else if (g.kind === 'grip') {
      const group = g.keys.map((k) => byKey.get(k)).filter((s): s is Shown => s !== undefined);
      const from = group.map((s) => s.note);
      const to = resizedGroup(from, g.dx, value, total);
      const reason = tryEdit((p) => replaceNotes(p, id, patternIndex, from, to));
      onMessage(reason ?? '');
      if (!reason) select(to.map(noteKey));
    }
  };

  // ---- Drawing ----

  const lines = gridLines(value, tickPx, layout.kind !== 'drums');
  const marks = rulerMarks(project.meter, bars, tickPx);
  const style = {
    '--tick-px': `${tickPx}px`,
    '--row-px': `${rowPx}px`,
    '--label-px': `${layout.labelPx}px`,
    '--ruler-px': `${RULER_PX}px`,
    '--bar-px': `${barTicks * tickPx}px`,
    '--major-px': `${lines.majorTicks * tickPx}px`,
    '--minor-px': `${lines.minorTicks * tickPx}px`,
    '--step-px': `${step * tickPx}px`,
  } as CSSProperties;
  const lineClasses = ['ne-lines'];
  if (lines.majorTicks === 0) lineClasses.push('no-major');
  if (lines.minorTicks === 0) lineClasses.push('no-minor');

  const noteBoxes = shown.map((s) => {
    let row = s.row;
    let start = s.start;
    let span = s.width;
    const classes = ['ne-note'];
    if (selected.has(s.key)) classes.push('selected');
    if (drag?.kind === 'move' && drag.keys.has(s.key)) {
      row += drag.rowShift;
      start += drag.shift;
      classes.push('dragging');
      if (drag.refused) classes.push('refused');
    } else if (drag?.kind === 'resize' && drag.keys.has(s.key)) {
      span = drag.lengths.get(s.key) ?? span;
      classes.push('dragging');
    }
    const text = layout.textOf(s.note);
    const name = layout.rows[s.row]?.name ?? '';
    return (
      <div
        key={s.key}
        data-key={s.key}
        className={classes.join(' ')}
        style={{ left: start * tickPx + 1, top: row * rowPx + 1, width: Math.max(3, span * tickPx - 2) }}
        aria-label={`${name}, ${describeStart(s.start, project.meter)}${selected.has(s.key) ? ', selected' : ''}`}
      >
        {text && rowPx >= 14 && span * tickPx >= 12 && <span className="ne-note-text">{text}</span>}
        {layout.kind !== 'drums' && <span className="ne-grip" data-grip="" />}
      </div>
    );
  });

  return (
    <div className={`ne ne-${layout.kind}`} style={style}>
      <div
        className="ne-scroller"
        ref={scrollerRef}
        tabIndex={-1}
        onScroll={(event) => {
          scrollLeft.current = event.currentTarget.scrollLeft;
        }}
      >
        {size.width > 0 && (
          <div className="ne-canvas" style={{ width: layout.labelPx + width, height: RULER_PX + height }}>
            <div className="ne-ruler" aria-hidden="true">
              <div className="ne-corner" />
              <div className="ne-marks" style={{ width }}>
                {marks.map((mark) => (
                  <span key={mark.tick} className={mark.barStart ? 'ne-mark bar' : 'ne-mark'} style={{ left: mark.tick * tickPx }}>
                    {mark.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="ne-body">
              <div className="ne-labels" aria-hidden="true">
                {layout.rows.map((row, index) => (
                  <div key={index} className={`ne-label${row.tinted ? ' tinted' : ''}${row.divider ? ' divider' : ''}${row.strong ? ' strong' : ''}`} title={row.name}>
                    {rowPx >= 12 ? row.label : ''}
                  </div>
                ))}
              </div>
              <div
                className="ne-grid"
                ref={gridRef}
                role="group"
                aria-label={`${INSTRUMENT_LABELS[id]}, pattern ${patternIndex + 1}`}
                style={{ width, height }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => finish(true)}
                onPointerCancel={() => finish(false)}
                onPointerLeave={() => {
                  if (hover) setHover(null);
                }}
              >
                <div className="ne-rows" aria-hidden="true">
                  {layout.rows.map((row, index) => (
                    <div key={index} className={`ne-row${row.tinted ? ' tinted' : ''}${row.divider ? ' divider' : ''}`} />
                  ))}
                </div>
                <div className={lineClasses.join(' ')} aria-hidden="true" />
                {hover && !drag && (
                  <div
                    className="ne-hover"
                    aria-hidden="true"
                    style={{
                      left: hover.start * tickPx + 1,
                      top: hover.row * rowPx + 1,
                      width: Math.max(3, Math.min(step, total - hover.start) * tickPx - 2),
                    }}
                  />
                )}
                {noteBoxes}
                {drag?.kind === 'marquee' && (
                  <div
                    className="ne-marquee"
                    aria-hidden="true"
                    style={{
                      left: Math.min(drag.x0, drag.x1),
                      top: Math.min(drag.y0, drag.y1),
                      width: Math.abs(drag.x1 - drag.x0),
                      height: Math.abs(drag.y1 - drag.y0),
                    }}
                  />
                )}
                <div className="ne-playhead" ref={playheadRef} aria-hidden="true" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
