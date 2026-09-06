import { useCallback, useRef, useState } from 'react';

export type OperationMeasurement = {
  label: string;
  durationMs: number;
  at: number;
};

/**
 * Wraps a synchronous operation in performance.mark()/measure() and
 * stores the last measurement for display. No fabricated numbers —
 * every value comes from a real performance entry.
 */
export function measureSync<T>(label: string, fn: () => T): { result: T; durationMs: number } {
  const startMark = `${label}-start-${Math.random().toString(36).slice(2)}`;
  const endMark = `${label}-end-${Math.random().toString(36).slice(2)}`;
  performance.mark(startMark);
  const result = fn();
  performance.mark(endMark);
  performance.measure(label, startMark, endMark);
  const entries = performance.getEntriesByName(label);
  const durationMs = entries.length > 0 ? entries[entries.length - 1].duration : 0;
  performance.clearMarks(startMark);
  performance.clearMarks(endMark);
  return { result, durationMs };
}

export function usePerformanceMeasure() {
  const [lastOperation, setLastOperation] = useState<OperationMeasurement | null>(null);
  const historyRef = useRef<OperationMeasurement[]>([]);

  const run = useCallback(<T,>(label: string, fn: () => T): T => {
    const { result, durationMs } = measureSync(label, fn);
    const entry = { label, durationMs, at: Date.now() };
    historyRef.current = [...historyRef.current.slice(-19), entry];
    setLastOperation(entry);
    return result;
  }, []);

  const reportAsync = useCallback((label: string, durationMs: number) => {
    const entry = { label, durationMs, at: Date.now() };
    historyRef.current = [...historyRef.current.slice(-19), entry];
    setLastOperation(entry);
  }, []);

  return { lastOperation, history: historyRef.current, run, reportAsync };
}
