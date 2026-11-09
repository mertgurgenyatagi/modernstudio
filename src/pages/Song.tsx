import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { INSTRUMENT_IDS, INSTRUMENT_LABELS, type InstrumentId } from '../core/instruments';
import { blockBars, selectPattern } from '../core/project';
import {
  MAX_SONG_BARS,
  blockAt,
  blocksOf,
  groupSpan,
  moveBlocks,
  placeBlock,
  placeBlocks,
  removeBlocks,
  songBars,
  type BlockPlacement,
  type BlockRef,
} from '../core/song';
import { ticksPerBar } from '../core/time';
import { afterBlockPaste, blocksStartingAt, copyBlocksToClipboard } from '../state/clipboard';
import { commandLetter, isTypingTarget } from '../state/keys';
import { useStudio } from '../state/Studio';
import { BUTTON_ZOOM, anchoredScroll, barNumberEvery, fitSongBarPx, wheelFactor, zoomSongBarPx } from '../state/view';
import { ContextMenu } from '../ui/ContextMenu';
import { useElementSize } from '../ui/useElementSize';
import { useTryEdit } from './editor/useTryEdit';
import {
  NAME_PX,
  TIMELINE_PX,
  barFromPx,
  barLineEvery,
  barNumberAtTick,
  blocksInRect,
  dragBars,
  laneFromPx,
  laneHeight,
  songTickToPx,
  type PxRect,
} from './song/geometry';
import { patternChoices } from './song/menu';
import '../ui/controls.css';
import './song.css';

/** The gap between a block and the edges of its lane, in pixels. */
const BLOCK_INSET_PX = 6;
const refKey = (ref: BlockRef) => `${ref.instrument}:${ref.startBar}`;
const toRef = (b: BlockRef): BlockRef => ({ instrument: b.instrument, startBar: b.startBar });
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type Gesture =
  | { kind: 'empty'; x: number; y: number; additive: boolean; base: BlockRef[]; moved: boolean }
  | { kind: 'block'; x: number; y: number; ref: BlockRef; refs: BlockRef[]; wasSelected: boolean; moved: boolean; delta: number }
  | { kind: 'toggle' };

type Drag = { kind: 'marquee'; rect: PxRect } | { kind: 'move'; keys: ReadonlySet<string>; delta: number; refused: boolean };

type Menu = { kind: 'lane'; x: number; y: number; instrument: InstrumentId; bar: number } | { kind: 'block'; x: number; y: number; ref: BlockRef };

/**
 * The Song page: five lanes of blocks over 256 bars (the user's sweeping changes, 2026-11-09).
 *
 * - A right click on an empty bar opens a menu of the lane's patterns (and Paste); a pick places it
 *   there. A left click on empty space only lets go of the selection; a drag over it draws a
 *   rectangle that selects the blocks it touches. Ctrl or Shift adds to the selection.
 * - A block is dragged along its lane (a selection moves together), double-clicked to open its
 *   pattern, right-clicked for Open, Duplicate, Copy and Delete.
 * - Ctrl+C copies the selection and Ctrl+V pastes it right after itself, then after each paste in
 *   turn; Ctrl+X cuts, Ctrl+D doubles, Ctrl+A selects all, Delete deletes, the arrow keys move the
 *   selection a bar, Escape lets go.
 * - Ctrl with the wheel zooms where the pointer is, the wheel scrolls sideways. No scrollbars.
 */
export function Song() {
  const { state, project, dispatch, engine, seek } = useStudio();
  const tryEdit = useTryEdit();
  const [note, setNote] = useState('');
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<{ lane: number; bar: number } | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const anchor = useRef<{ bar: number; offset: number } | null>(null);
  const scrollLeft = useRef(0);
  const size = useElementSize(scrollerRef);

  const barPx = state.songBarPx;
  const laneH = laneHeight(size.height - TIMELINE_PX);
  const width = MAX_SONG_BARS * barPx;
  const height = INSTRUMENT_IDS.length * laneH;
  const total = songBars(project);

  const selection = useMemo(() => blocksOf(project, state.selectedBlocks), [project, state.selectedBlocks]);
  const selectedKeys = useMemo(() => new Set(selection.map(refKey)), [selection]);
  const select = useCallback((refs: readonly BlockRef[]) => dispatch({ type: 'selectBlocks', blocks: refs.map(toRef) }), [dispatch]);

  // ---- The playhead and the readout follow the engine while playing, and stand at the start bar otherwise ----

  useEffect(() => {
    const perBar = ticksPerBar(project.meter);
    let frame = 0;
    const tick = () => {
      const position = state.playing ? engine.position() : null;
      const songTick = position ? position.songTick : state.startBar * perBar;
      if (playheadRef.current) playheadRef.current.style.transform = `translateX(${songTickToPx(songTick, project.meter, barPx)}px)`;
      if (readoutRef.current) readoutRef.current.textContent = String(barNumberAtTick(songTick, project.meter));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [engine, project.meter, state.playing, state.startBar, barPx]);

  // ---- Zoom and scroll ----

  const lastBarPx = useRef(barPx);
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const before = lastBarPx.current;
    lastBarPx.current = barPx;
    const wanted = anchor.current;
    anchor.current = null;
    if (!scroller || before === barPx) return;
    const view = scroller.clientWidth - NAME_PX;
    const at = wanted ?? { bar: (scrollLeft.current + view / 2) / before, offset: view / 2 };
    scroller.scrollLeft = anchoredScroll(at.bar, at.offset, barPx);
    scrollLeft.current = scroller.scrollLeft;
  }, [barPx]);

  const latestZoom = useRef({ barPx });
  useEffect(() => {
    latestZoom.current = { barPx };
  });

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
        const px = latestZoom.current.barPx;
        const next = zoomSongBarPx(px, wheelFactor(event.deltaY));
        if (next === px) return; // already as far as it goes
        const offset = event.clientX - scroller.getBoundingClientRect().left - NAME_PX;
        anchor.current = { bar: (scroller.scrollLeft + offset) / px, offset };
        dispatch({ type: 'setSongBarPx', px: next });
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

  const zoomBy = (factor: number) => dispatch({ type: 'setSongBarPx', px: zoomSongBarPx(barPx, factor) });
  const fit = () => {
    const px = fitSongBarPx(size.width - NAME_PX, total);
    if (px !== barPx) {
      anchor.current = { bar: 0, offset: 0 };
      dispatch({ type: 'setSongBarPx', px });
    } else if (scrollerRef.current) {
      scrollerRef.current.scrollLeft = 0;
    }
  };

  // ---- Editing ----

  const openPattern = useCallback(
    (ref: BlockRef) => {
      const block = blocksOf(project, [ref])[0];
      if (!block) return;
      dispatch({ type: 'select', change: (p) => selectPattern(p, block.instrument, block.pattern) });
      dispatch({ type: 'setPage', page: block.instrument });
    },
    [project, dispatch],
  );

  const placeAll = useCallback(
    (placements: BlockPlacement[]): boolean => {
      const reason = tryEdit((p) => placeBlocks(p, placements));
      setNote(reason ?? '');
      if (!reason) select(placements);
      return reason === null;
    },
    [tryEdit, select],
  );

  const remove = useCallback(() => {
    if (selection.length === 0) return;
    dispatch({ type: 'edit', change: (p) => removeBlocks(p, selection) });
    select([]);
    setNote('');
  }, [selection, dispatch, select]);

  const copy = useCallback((): boolean => {
    const clip = copyBlocksToClipboard(project, selection);
    if (!clip) return false;
    dispatch({ type: 'setBlockClipboard', clipboard: clip });
    setNote(`${plural(selection.length, 'block', 'blocks')} copied.`);
    return true;
  }, [project, selection, dispatch]);

  const pasteAt = useCallback(
    (startBar: number) => {
      const clip = state.blockClipboard;
      if (!clip) return;
      if (placeAll(blocksStartingAt(clip, startBar))) dispatch({ type: 'setBlockClipboard', clipboard: afterBlockPaste(clip, startBar) });
    },
    [state.blockClipboard, placeAll, dispatch],
  );

  const duplicate = useCallback(() => {
    const span = groupSpan(project, selection);
    if (!span) return;
    placeAll(selection.map((b) => ({ ...b, startBar: b.startBar + span.end - span.start })));
  }, [project, selection, placeAll]);

  const moveSelection = useCallback(
    (delta: number) => {
      if (selection.length === 0) return;
      const reason = tryEdit((p) => moveBlocks(p, selection, delta));
      setNote(reason ?? '');
      if (!reason) select(selection.map((b) => ({ ...b, startBar: b.startBar + delta })));
    },
    [selection, tryEdit, select],
  );

  const keyActions = useRef<{ handle: (event: KeyboardEvent) => void }>({ handle: () => undefined });
  useEffect(() => {
    keyActions.current.handle = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target as HTMLElement | null)) return;
      const letter = commandLetter(event);
      if (letter !== null) {
        if (letter === 'a') select(INSTRUMENT_IDS.flatMap((id) => project.instruments[id].lane.map((b) => ({ instrument: id, startBar: b.startBar }))));
        else if (letter === 'c') copy();
        else if (letter === 'x') {
          if (copy()) remove();
        } else if (letter === 'v') {
          if (state.blockClipboard) pasteAt(state.blockClipboard.nextStart);
        } else if (letter === 'd') duplicate();
        else return;
        event.preventDefault();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Delete' || event.key === 'Backspace') remove();
      else if (event.key === 'Escape') select([]);
      else if (event.key === 'ArrowLeft' && selection.length > 0) moveSelection(-1);
      else if (event.key === 'ArrowRight' && selection.length > 0) moveSelection(1);
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

  const pointAt = (event: { clientX: number; clientY: number }) => {
    const box = lanesRef.current?.getBoundingClientRect();
    return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) };
  };

  const blockRefOf = (target: EventTarget): BlockRef | null => {
    const element = (target as HTMLElement).closest<HTMLElement>('[data-block]');
    if (!element) return null;
    return { instrument: element.dataset.instrument as InstrumentId, startBar: Number(element.dataset.bar) };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    setHover(null);
    const point = pointAt(event);
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    const ref = blockRefOf(event.target);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!ref) {
      gesture.current = { kind: 'empty', ...point, additive, base: additive ? selection.map(toRef) : [], moved: false };
      return;
    }
    setNote('');
    if (additive) {
      const has = selectedKeys.has(refKey(ref));
      if (has && !event.shiftKey) select(selection.filter((b) => refKey(b) !== refKey(ref)));
      else if (!has) select([...selection, ref]);
      gesture.current = { kind: 'toggle' };
      return;
    }
    const wasSelected = selectedKeys.has(refKey(ref));
    const refs = wasSelected ? selection.map(toRef) : [ref];
    if (!wasSelected) select(refs);
    gesture.current = { kind: 'block', ...point, ref, refs, wasSelected, moved: false, delta: 0 };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    const point = pointAt(event);
    if (!g) {
      // The empty bar under the pointer is shown, where a right click would place a pattern.
      const lane = Math.floor(point.y / laneH);
      const id = INSTRUMENT_IDS[lane];
      const bar = barFromPx(point.x, barPx);
      const empty = id !== undefined && event.buttons === 0 && blockRefOf(event.target) === null && !blockAt(project, id, bar);
      if (!empty) {
        if (hover) setHover(null);
      } else if (!hover || hover.lane !== lane || hover.bar !== bar) setHover({ lane, bar });
      return;
    }
    if (g.kind === 'toggle') return;
    if (!g.moved && Math.hypot(point.x - g.x, point.y - g.y) < 4) return;
    g.moved = true;
    if (g.kind === 'empty') {
      const rect = { x0: g.x, y0: g.y, x1: Math.min(Math.max(point.x, 0), width), y1: Math.min(Math.max(point.y, 0), height) };
      const hits = blocksInRect(project, rect, barPx, laneH);
      const keys = new Set(g.base.map(refKey));
      select([...g.base, ...hits.filter((h) => !keys.has(refKey(h)))]);
      setDrag({ kind: 'marquee', rect });
      return;
    }
    const blocks = blocksOf(project, g.refs);
    const first = Math.min(...blocks.map((b) => b.startBar));
    const last = Math.max(...blocks.map((b) => b.startBar + blockBars(project, b.instrument, b)));
    const delta = Math.min(MAX_SONG_BARS - last, Math.max(-first, dragBars(point.x - g.x, barPx)));
    g.delta = delta;
    const refused = delta !== 0 && !moveBlocks(project, g.refs, delta).ok;
    setDrag({ kind: 'move', keys: new Set(g.refs.map(refKey)), delta, refused });
  };

  const finish = (commit: boolean) => {
    const g = gesture.current;
    gesture.current = null;
    setDrag(null);
    if (!g || !commit || g.kind === 'toggle') return;
    if (!g.moved) {
      if (g.kind === 'empty') {
        // A left click on an empty place does nothing but let go of the selection.
        if (!g.additive) select([]);
      } else if (g.wasSelected && selection.length > 1) {
        select([g.ref]);
      }
      return;
    }
    if (g.kind === 'block' && g.delta !== 0) {
      const reason = tryEdit((p) => moveBlocks(p, g.refs, g.delta));
      setNote(reason ?? '');
      if (!reason) select(g.refs.map((r) => ({ ...r, startBar: r.startBar + g.delta })));
    }
  };

  const onContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setHover(null);
    const ref = blockRefOf(event.target);
    if (ref) {
      if (!selectedKeys.has(refKey(ref))) select([ref]);
      setMenu({ kind: 'block', x: event.clientX, y: event.clientY, ref });
      return;
    }
    const point = pointAt(event);
    const instrument = laneFromPx(point.y, laneH);
    if (!instrument || point.x < 0 || point.x > width) return;
    setMenu({ kind: 'lane', x: event.clientX, y: event.clientY, instrument, bar: barFromPx(point.x, barPx) });
  };

  const onDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const ref = blockRefOf(event.target);
    if (ref) openPattern(ref);
  };

  const onTimelineKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowLeft') seek(Math.max(0, state.startBar - 1));
    else if (event.key === 'ArrowRight') seek(Math.min(MAX_SONG_BARS - 1, state.startBar + 1));
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  // ---- Drawing ----

  const every = barNumberEvery(barPx);
  const numbers: number[] = [];
  for (let bar = 0; bar < MAX_SONG_BARS; bar += every) numbers.push(bar);
  const style = {
    '--name-px': `${NAME_PX}px`,
    '--timeline-px': `${TIMELINE_PX}px`,
    '--lane-px': `${laneH}px`,
    '--line-px': `${barLineEvery(barPx) * barPx}px`,
  } as CSSProperties;
  const hint = total === 0 ? 'Right-click a lane to place a pattern.' : '';

  return (
    <section className="song" aria-label="Song" style={style}>
      <div className="song-bar" role="toolbar" aria-label="Song">
        <p className="song-readout">
          Bar <span ref={readoutRef}>{state.startBar + 1}</span>
          {total > 0 ? ` of ${total}` : ''}
        </p>
        <p className="song-note" role="status" title={note || hint}>
          {note || hint}
        </p>
        <div className="seg" role="group" aria-label="Zoom">
          <button type="button" aria-label="Zoom out" title="Zoom out (Ctrl and the wheel)" onClick={() => zoomBy(BUTTON_ZOOM)}>
            −
          </button>
          <button type="button" aria-label="Zoom in" title="Zoom in (Ctrl and the wheel)" onClick={() => zoomBy(1 / BUTTON_ZOOM)}>
            +
          </button>
          <button type="button" title="Show the whole song" onClick={fit}>
            Fit
          </button>
        </div>
      </div>

      <div
        className="song-scroller"
        ref={scrollerRef}
        onScroll={(event) => {
          scrollLeft.current = event.currentTarget.scrollLeft;
        }}
      >
        {size.width > 0 && (
          <div className="song-canvas" style={{ width: NAME_PX + width, height: TIMELINE_PX + height }}>
            <div className="song-top">
              <div className="song-corner" />
              <button
                type="button"
                className="timeline"
                style={{ width }}
                aria-label="Playhead. Click a bar number to move it; the arrow keys move it one bar."
                onClick={(event) => seek(barFromPx(event.clientX - event.currentTarget.getBoundingClientRect().left, barPx))}
                onKeyDown={onTimelineKey}
              >
                {numbers.map((bar) => (
                  <span key={bar} className="timeline-bar" style={{ left: bar * barPx }} aria-hidden="true">
                    {bar + 1}
                  </span>
                ))}
              </button>
            </div>

            <div className="song-body">
              <div className="song-names" aria-hidden="true">
                {INSTRUMENT_IDS.map((id) => (
                  <div key={id} className="song-name">
                    {INSTRUMENT_LABELS[id]}
                  </div>
                ))}
              </div>
              <div
                className="song-lanes"
                ref={lanesRef}
                role="group"
                aria-label="Lanes"
                style={{ width, height }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => finish(true)}
                onPointerCancel={() => finish(false)}
                onPointerLeave={() => {
                  if (hover) setHover(null);
                }}
                onContextMenu={onContextMenu}
                onDoubleClick={onDoubleClick}
              >
                {INSTRUMENT_IDS.map((id) => (
                  <div key={id} className="song-lane" aria-hidden="true" />
                ))}
                {hover && !drag && (
                  <div className="song-hover" aria-hidden="true" style={{ left: hover.bar * barPx, top: hover.lane * laneH, width: barPx, height: laneH - 1 }} />
                )}
                {INSTRUMENT_IDS.map((id, lane) =>
                  project.instruments[id].lane.map((block) => {
                    const key = `${id}:${block.startBar}`;
                    const bars = blockBars(project, id, block);
                    const moving = drag?.kind === 'move' && drag.keys.has(key);
                    const start = block.startBar + (moving ? drag.delta : 0);
                    const classes = ['block'];
                    if (selectedKeys.has(key)) classes.push('selected');
                    if (moving) classes.push('dragging');
                    if (moving && drag.refused) classes.push('refused');
                    return (
                      <div
                        key={key}
                        data-block=""
                        data-instrument={id}
                        data-bar={block.startBar}
                        className={classes.join(' ')}
                        style={{ left: start * barPx, top: lane * laneH + BLOCK_INSET_PX, width: bars * barPx, height: laneH - 2 * BLOCK_INSET_PX }}
                        title={`Pattern ${block.pattern + 1}, ${plural(bars, 'bar', 'bars')}`}
                        aria-label={`${INSTRUMENT_LABELS[id]} pattern ${block.pattern + 1}, bar ${block.startBar + 1}, ${plural(bars, 'bar', 'bars')}${selectedKeys.has(key) ? ', selected' : ''}`}
                      >
                        <span className="block-label">{block.pattern + 1}</span>
                      </div>
                    );
                  }),
                )}
                {drag?.kind === 'marquee' && (
                  <div
                    className="song-marquee"
                    aria-hidden="true"
                    style={{
                      left: Math.min(drag.rect.x0, drag.rect.x1),
                      top: Math.min(drag.rect.y0, drag.rect.y1),
                      width: Math.abs(drag.rect.x1 - drag.rect.x0),
                      height: Math.abs(drag.rect.y1 - drag.rect.y0),
                    }}
                  />
                )}
                <div className="song-playhead" ref={playheadRef} aria-hidden="true" />
              </div>
            </div>
          </div>
        )}
      </div>

      {menu?.kind === 'lane' && (
        <LaneMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onPlace={(pattern) => {
            setMenu(null);
            const reason = tryEdit((p) => placeBlock(p, menu.instrument, pattern, menu.bar));
            setNote(reason ?? '');
            if (!reason) select([{ instrument: menu.instrument, startBar: menu.bar }]);
          }}
          onPaste={() => {
            setMenu(null);
            pasteAt(menu.bar);
          }}
        />
      )}
      {menu?.kind === 'block' && (
        <ContextMenu x={menu.x} y={menu.y} label="Block" onClose={() => setMenu(null)}>
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setMenu(null);
              openPattern(menu.ref);
            }}
          >
            Open pattern
          </button>
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setMenu(null);
              duplicate();
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setMenu(null);
              copy();
            }}
          >
            Copy
          </button>
          <div className="menu-sep" />
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setMenu(null);
              remove();
            }}
          >
            Delete
          </button>
        </ContextMenu>
      )}
    </section>
  );
}

/** The menu of an empty bar: Paste (when blocks are copied), then the lane's patterns that have notes. */
function LaneMenu({
  menu,
  onClose,
  onPlace,
  onPaste,
}: {
  menu: { x: number; y: number; instrument: InstrumentId; bar: number };
  onClose: () => void;
  onPlace: (pattern: number) => void;
  onPaste: () => void;
}) {
  const { state, project, dispatch } = useStudio();
  const choices = patternChoices(project, menu.instrument, menu.bar);
  const clip = state.blockClipboard;
  const pasteFits = clip !== null && placeBlocks(project, blocksStartingAt(clip, menu.bar)).ok;
  const label = INSTRUMENT_LABELS[menu.instrument];
  return (
    <ContextMenu x={menu.x} y={menu.y} label={`Place in ${label}, bar ${menu.bar + 1}`} onClose={onClose}>
      <p className="menu-head">
        {label} · bar {menu.bar + 1}
      </p>
      {clip && (
        <>
          <button type="button" className="menu-item" role="menuitem" disabled={!pasteFits} title={pasteFits ? undefined : 'The copied blocks do not fit here'} onClick={onPaste}>
            Paste
          </button>
          <div className="menu-sep" />
        </>
      )}
      {choices.length > 0 ? (
        <div className="menu-patterns" role="group" aria-label="Patterns">
          {choices.map((choice) => (
            <button
              key={choice.index}
              type="button"
              className="menu-pattern"
              role="menuitem"
              disabled={!choice.fits}
              title={`Pattern ${choice.index + 1}, ${plural(choice.bars, 'bar', 'bars')}${choice.fits ? '' : ': does not fit here'}`}
              onClick={() => onPlace(choice.index)}
            >
              {choice.index + 1}
            </button>
          ))}
        </div>
      ) : (
        <>
          <p className="menu-empty">{label} has no pattern with notes yet.</p>
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => {
              onClose();
              dispatch({ type: 'setPage', page: menu.instrument });
            }}
          >
            Open {label}
          </button>
        </>
      )}
    </ContextMenu>
  );
}
