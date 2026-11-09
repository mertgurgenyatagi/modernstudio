import { useEffect, useState, type RefObject } from 'react';

export interface Size {
  width: number;
  height: number;
}

/**
 * The size of an element's content box, kept up to date as the window is resized. It is 0 by 0 until
 * the element has been laid out once, so a caller draws nothing that depends on it before then.
 */
export function useElementSize(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      const next = { width: Math.floor(box.width), height: Math.floor(box.height) };
      setSize((old) => (old.width === next.width && old.height === next.height ? old : next));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
