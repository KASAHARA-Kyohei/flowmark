import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function readStoredNumber(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function storeNumber(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(Math.round(value)));
  } catch {
    // ignore
  }
}

export function SplitPane(props: {
  left: React.ReactNode;
  right: React.ReactNode;
  storageKey?: string;
  defaultLeftPx?: number;
  minLeftPx?: number;
  minRightPx?: number;
}): React.ReactElement {
  const storageKey = props.storageKey ?? 'flowmark:split:leftPx';
  const minLeftPx = props.minLeftPx ?? 420;
  const minRightPx = props.minRightPx ?? 320;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [leftPx, setLeftPx] = useState<number | null>(null);

  useEffect(() => {
    const stored = readStoredNumber(storageKey);
    if (stored !== null) {
      setLeftPx(stored);
      return;
    }

    if (props.defaultLeftPx !== undefined) {
      setLeftPx(props.defaultLeftPx);
    }
  }, [props.defaultLeftPx, storageKey]);

  // Default: split 50/50 when no stored value.
  useLayoutEffect(() => {
    if (leftPx !== null) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;

    const half = rect.width / 2;
    const clamped = clamp(half, minLeftPx, rect.width - minRightPx);
    setLeftPx(clamped);
  }, [leftPx, minLeftPx, minRightPx]);

  // If the viewport changes, keep the split valid.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (leftPx === null) return;

    const observer = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;
      const clamped = clamp(leftPx, minLeftPx, rect.width - minRightPx);
      if (clamped !== leftPx) setLeftPx(clamped);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [leftPx, minLeftPx, minRightPx]);

  const leftStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (leftPx === null) return undefined;
    return { width: `${leftPx}px` };
  }, [leftPx]);

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;

    e.preventDefault();

    const rect = container.getBoundingClientRect();
    const width = rect.width;

    const initialBodyCursor = document.body.style.cursor;
    const initialUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const apply = (clientX: number) => {
      const raw = clientX - rect.left;
      const next = clamp(raw, minLeftPx, width - minRightPx);
      setLeftPx(next);
      storeNumber(storageKey, next);
    };

    apply(e.clientX);

    const onMove = (ev: PointerEvent) => {
      apply(ev.clientX);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = initialBodyCursor;
      document.body.style.userSelect = initialUserSelect;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-col lg:flex-row">
      <div className="min-h-0 lg:min-w-0" style={leftStyle}>
        {props.left}
      </div>

      <div
        className="relative hidden w-3 flex-none cursor-col-resize items-stretch lg:flex"
        onPointerDown={startDrag}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panes"
        tabIndex={-1}
      >
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/10" />
        <div className="absolute left-1/2 top-1/2 h-14 w-1 -translate-x-1/2 -translate-y-1/2 rounded bg-white/10" />
      </div>

      <div className="min-h-0 flex-1">{props.right}</div>
    </div>
  );
}
