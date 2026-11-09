import type { CSSProperties } from 'react';
import './slider.css';

interface Props {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  /** Called when a drag or a run of key presses begins or ends, so Undo takes it as one step. */
  onGrabChange?: () => void;
}

/** A horizontal slider, filled with ink up to its value. */
export function LevelSlider({ label, value, min = 0, max = 100, onChange, onGrabChange }: Props) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className="slider"
      aria-label={label}
      min={min}
      max={max}
      step={1}
      value={value}
      style={{ '--fill': `${fill}%` } as CSSProperties}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
      onPointerDown={onGrabChange}
      onFocus={onGrabChange}
      onBlur={onGrabChange}
    />
  );
}
