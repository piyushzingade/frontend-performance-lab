import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * Central render-count store. Components call `trackRender(name)` during
 * render (cheap Map increment, no setState → no extra renders caused by
 * the instrumentation itself). Subscribed panels re-render on demand.
 */
const counts = new Map<string, number>();
const listeners = new Set<() => void>();
let interactionMark = 0;

function emit() {
  for (const l of listeners) l();
}

export function trackRender(name: string) {
  counts.set(name, (counts.get(name) ?? 0) + 1);
  scheduleEmit();
}

// Notify subscribers in a microtask (after the render commit) so the
// instrumentation never triggers a store update during another render.
let scheduled = false;
function scheduleEmit() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    emit();
  });
}

export function resetRenderCounts() {
  counts.clear();
  interactionMark += 1;
  emit();
}

export function getRenderCounts(): [string, number][] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function getTotalRenders(): number {
  let total = 0;
  for (const n of counts.values()) total += n;
  return total;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Re-render the subscriber whenever any tracked component renders. */
export function useRenderCounts(): [string, number][] {
  return useSyncExternalStore(subscribe, getRenderCounts, getRenderCounts);
}

/** Call inside a component body to count its renders. Returns current count. */
export function useRenderCounter(name: string): number {
  trackRender(name);
  return counts.get(name) ?? 0;
}

/**
 * Snapshot helper for "renders caused by last interaction": record the total
 * before an interaction, then diff after. The panel polls via useState ticker.
 */
export function useRenderTotalTicker(active: boolean): number {
  const [total, setTotal] = useState(() => getTotalRenders());
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!active) return;
    timer.current = window.setInterval(() => setTotal(getTotalRenders()), 500);
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, [active]);
  return total;
}

export { interactionMark };
