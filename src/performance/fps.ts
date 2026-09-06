import { useEffect, useRef, useState } from 'react';

export type FpsSample = {
  fps: number | null;
  avgFrameMs: number | null;
  dropped: number; // frames > 2x the running median (approx — labeled as estimate)
};

/**
 * Approximate FPS meter via rAF deltas. Labeled as an approximation:
 * rAF throttling, background tabs, and display refresh all affect it.
 */
export function useFps(running = true): FpsSample {
  const [sample, setSample] = useState<FpsSample>({ fps: null, avgFrameMs: null, dropped: 0 });
  const state = useRef({ last: 0, deltas: [] as number[], dropped: 0, frames: 0 });

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const s = state.current;
    s.last = 0;
    const tick = (t: number) => {
      if (s.last !== 0) {
        const d = t - s.last;
        s.deltas.push(d);
        if (s.deltas.length > 60) s.deltas.shift();
        // Dropped-frame estimate: delta beyond 2x the median of the window.
        const sorted = [...s.deltas].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)] || 16.7;
        if (d > median * 2 && s.deltas.length > 10) s.dropped += 1;
        s.frames += 1;
        if (s.frames % 15 === 0) {
          const avg = s.deltas.reduce((a, b) => a + b, 0) / s.deltas.length;
          setSample({ fps: 1000 / avg, avgFrameMs: avg, dropped: s.dropped });
        }
      }
      s.last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  return sample;
}
