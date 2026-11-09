import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import './knob.css';

interface Props {
  /** The short word beside the knob ("Vol"). */
  label: string;
  /** The full name, for a screen reader and the tooltip ("Volume"). */
  name: string;
  value: number;
  min?: number;
  max?: number;
  /** Where a double click puts it back. */
  defaultValue: number;
  onChange: (value: number) => void;
  /** Called when a drag or a run of key presses begins or ends, so Undo takes it as one step. */
  onGrab: () => void;
}

/** The arc of a knob: from -135 degrees (the minimum) round to `fraction` of 270 degrees, on a circle of radius r about (c, c). */
function arc(fraction: number, c: number, r: number): string {
  const start = (-135 * Math.PI) / 180;
  const end = start + Math.max(0, Math.min(1, fraction)) * 1.5 * Math.PI;
  const point = (a: number) => `${(c + r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}`;
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${point(start)} A ${r} ${r} 0 ${large} 1 ${point(end)}`;
}

/**
 * A small knob, as a music program has them: drag up to turn it up, the wheel or the arrow keys for a
 * step, a double click for its default. The word beside it shows the value while it is touched.
 */
export function Knob({ label, name, value, min = 0, max = 100, defaultValue, onChange, onGrab }: Props) {
  const [active, setActive] = useState(false);
  const knobRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ value, min, max, onChange, onGrab });
  useEffect(() => {
    latest.current = { value, min, max, onChange, onGrab };
  });

  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));
  const set = (v: number) => {
    const next = clamp(v);
    if (next !== value) onChange(next);
  };

  // The wheel turns it a step a notch. Listened to directly, so the page does not scroll under it.
  useEffect(() => {
    const element = knobRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const { value: v, min: lo, max: hi, onChange: change } = latest.current;
      const step = (event.shiftKey ? 1 : 2) * (event.deltaY < 0 ? 1 : -1);
      const next = Math.min(hi, Math.max(lo, v + step));
      if (next !== v) change(next);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    onGrab();
    setActive(true);
    const y0 = event.clientY;
    const v0 = value;
    const range = max - min;
    const element = event.currentTarget;
    const onMove = (e: PointerEvent) => {
      const perPx = (range / 150) * (e.shiftKey ? 0.25 : 1);
      const next = Math.min(max, Math.max(min, Math.round(v0 + (y0 - e.clientY) * perPx)));
      if (next !== latest.current.value) latest.current.onChange(next);
    };
    const onUp = () => {
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onUp);
      setActive(false);
      latest.current.onGrab();
    };
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointercancel', onUp);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 };
    if (event.key in steps) set(value + (steps[event.key] ?? 0));
    else if (event.key === 'Home') set(min);
    else if (event.key === 'End') set(max);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  const fraction = max > min ? (value - min) / (max - min) : 0;
  return (
    <div className={active ? 'knob active' : 'knob'} title={`${name} ${value}`}>
      <div
        ref={knobRef}
        className="knob-dial"
        role="slider"
        tabIndex={0}
        aria-label={name}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        onFocus={onGrab}
        onBlur={onGrab}
        onDoubleClick={() => set(defaultValue)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path className="knob-track" d={arc(1, 12, 9)} />
          {fraction > 0 && <path className="knob-value" d={arc(fraction, 12, 9)} />}
          <line
            className="knob-pointer"
            x1="12"
            y1="12"
            x2={(12 + 6.5 * Math.sin(((-135 + 270 * fraction) * Math.PI) / 180)).toFixed(2)}
            y2={(12 - 6.5 * Math.cos(((-135 + 270 * fraction) * Math.PI) / 180)).toFixed(2)}
          />
        </svg>
      </div>
      <span className="knob-word" aria-hidden="true">
        <span className="knob-label">{label}</span>
        <span className="knob-value-text">{value}</span>
      </span>
    </div>
  );
}
