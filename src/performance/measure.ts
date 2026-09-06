/** Consistent performance.mark()/measure() helpers. Never fabricate values. */
export function mark(name: string) {
  performance.mark(name);
}

export function measure(label: string, start: string, end: string): number {
  performance.measure(label, start, end);
  const entries = performance.getEntriesByName(label);
  return entries.length > 0 ? entries[entries.length - 1].duration : 0;
}

/** Runs fn between two marks and returns { result, durationMs } — all real. */
export function measureSync<T>(label: string, fn: () => T): { result: T; durationMs: number } {
  const s = `${label}:start:${Math.random().toString(36).slice(2)}`;
  const e = `${label}:end:${Math.random().toString(36).slice(2)}`;
  mark(s);
  const result = fn();
  mark(e);
  const durationMs = measure(label, s, e);
  performance.clearMarks(s);
  performance.clearMarks(e);
  return { result, durationMs };
}

export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  return ms < 10 ? `${ms.toFixed(2)} ms` : `${Math.round(ms)} ms`;
}

/** ?recording=true — hide nav clutter, enlarge metrics for screen capture. */
export function isRecordingMode(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('recording') === 'true';
  } catch {
    return false;
  }
}
