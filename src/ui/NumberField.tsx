import { useState } from 'react';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
  className?: string;
}

/**
 * A number to type. What is typed is held back until it is a whole number inside the range, so that
 * typing 150 does not jump to 40 at the first digit; leaving the field puts an odd value right.
 */
export function NumberField({ label, value, min, max, onCommit, className }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      className={className}
      aria-label={label}
      min={min}
      max={max}
      step={1}
      value={draft ?? value}
      onChange={(event) => {
        const text = event.currentTarget.value;
        setDraft(text);
        const n = Number(text);
        if (text.trim() !== '' && Number.isInteger(n) && n >= min && n <= max) onCommit(n);
      }}
      onBlur={() => {
        if (draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft))) onCommit(Number(draft));
        setDraft(null);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}
