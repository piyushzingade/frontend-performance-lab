import { useEffect, useState } from 'react';

export type LongTask = { start: number; duration: number };

/** useSyncExternalStore-free simple hook: collects PerformanceLongTaskTiming entries. */
export function useLongTasks(active = true): { tasks: LongTask[]; reset: () => void; supported: boolean } {
  const [tasks, setTasks] = useState<LongTask[]>([]);
  const [supported] = useState(() => {
    try {
      return typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask');
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!active || !supported) return;
    const obs = new PerformanceObserver((list) => {
      const fresh = list.getEntries().map((e) => ({ start: e.startTime, duration: e.duration }));
      setTasks((prev) => [...prev.slice(-49), ...fresh]);
    });
    obs.observe({ entryTypes: ['longtask'] });
    return () => obs.disconnect();
  }, [active, supported]);

  return { tasks, reset: () => setTasks([]), supported };
}

export function longTaskStats(tasks: LongTask[]): { count: number; total: number; max: number } {
  return {
    count: tasks.length,
    total: tasks.reduce((a, t) => a + t.duration, 0),
    max: tasks.reduce((m, t) => Math.max(m, t.duration), 0),
  };
}
