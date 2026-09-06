/** Real-user-measurement helpers via PerformanceObserver. Graceful degradation. */
export type WebVital = { name: string; value: number | null; detail: string };

function observeOnce(
  entryTypes: string[],
  onEntry: (e: PerformanceEntry) => void,
): (() => void) | null {
  try {
    if (typeof PerformanceObserver === 'undefined') return null;
    const supported = PerformanceObserver.supportedEntryTypes ?? [];
    if (!entryTypes.every((t) => supported.includes(t))) return null;
    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) onEntry(e);
    });
    obs.observe({ entryTypes });
    return () => obs.disconnect();
  } catch {
    return null;
  }
}

/** Largest Contentful Paint — last candidate wins. */
export function observeLCP(cb: (v: number) => void): (() => void) | null {
  return observeOnce(['largest-contentful-paint'], (e) => cb(e.startTime));
}

/** Cumulative Layout Shift — sum of unexpected shifts. */
export function observeCLS(cb: (v: number) => void): (() => void) | null {
  // layout-shift entries expose `hadRecentInput`/`value` on the impl type.
  return observeOnce(['layout-shift'], (e) => {
    const entry = e as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
    if (!entry.hadRecentInput && typeof entry.value === 'number') cb(entry.value);
  });
}

/** INP approximation: worst event-timing duration seen. Label as approximate. */
export function observeINP(cb: (v: number) => void): (() => void) | null {
  return observeOnce(['event'], (e) => {
    const entry = e as PerformanceEntry & { duration?: number; interactionId?: number };
    if (entry.interactionId && typeof entry.duration === 'number') cb(entry.duration);
  });
}

/** Navigation timing summary (actual, from the current document). */
export function getNavigationTiming(): { domContentLoaded: number | null; load: number | null; ttfb: number | null } {
  try {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (!nav) return { domContentLoaded: null, load: null, ttfb: null };
    return {
      domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
      load: nav.loadEventEnd - nav.startTime,
      ttfb: nav.responseStart - nav.startTime,
    };
  } catch {
    return { domContentLoaded: null, load: null, ttfb: null };
  }
}

/** Transferred JS bytes from Resource Timing — labeled as transfer size, NOT bundle analysis. */
export function getJsTransferBytes(): number | null {
  try {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    let total = 0;
    let found = false;
    for (const r of resources) {
      if (r.name.endsWith('.js') && typeof r.transferSize === 'number' && r.transferSize > 0) {
        total += r.transferSize;
        found = true;
      }
    }
    return found ? total : null;
  } catch {
    return null;
  }
}

export function getMemoryMB(): number | null {
  try {
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    return mem ? mem.usedJSHeapSize / 1048576 : null;
  } catch {
    return null;
  }
}
