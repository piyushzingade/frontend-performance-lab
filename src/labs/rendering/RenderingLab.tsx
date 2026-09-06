import { useEffect, useRef, useState } from 'react';
import { ExperimentHeader } from '../../components/ExperimentHeader';
import { ExperimentMetrics } from '../../components/ExperimentMetrics';
import { ModeSwitcher } from '../../components/ModeSwitcher';
import { ProfilingGuide } from '../../components/ProfilingGuide';
import { formatMs } from '../../performance/measure';
import { getRenderCounts, getTotalRenders, resetRenderCounts } from '../../performance/renderCounter';
import type { Filters } from './data';
import { BaselineDashboard, OptimizedDashboard, type OptHandle } from './dashboards';

type Mode = 'baseline' | 'optimized';
const REGION_CYCLE = ['', 'North', 'South', 'East', 'West'];

export function RenderingLab() {
  const [mode, setMode] = useState<Mode>('baseline');
  const [filters, setFilters] = useState<Filters>({ region: '', category: '', query: '' });
  const [lastLabel, setLastLabel] = useState('—');
  const [lastRenders, setLastRenders] = useState<number | null>(null);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const beforeRef = useRef(0);
  const t0Ref = useRef(0);
  const armedRef = useRef(false);
  const optRef = useRef<OptHandle>(null);

  // Commit-inclusive timing: t0 at interaction, t1 in the post-commit effect.
  useEffect(() => {
    if (!armedRef.current) return;
    armedRef.current = false;
    setLastMs(performance.now() - t0Ref.current);
    setLastRenders(getTotalRenders() - beforeRef.current);
  });

  const beginMeasure = (label: string) => {
    resetRenderCounts();
    beforeRef.current = 0;
    t0Ref.current = performance.now();
    armedRef.current = true;
    setLastLabel(label);
  };

  /** Test 1: one region change — same data update in both modes. */
  const runRegionTest = () => {
    const next = REGION_CYCLE[(REGION_CYCLE.indexOf(filters.region) + 1) % REGION_CYCLE.length];
    beginMeasure(`Change region filter → ${next === '' ? 'all' : next}`);
    if (mode === 'baseline') {
      setFilters({ ...filters, region: next });
    } else {
      optRef.current?.setRegion(next);
    }
    setFilters((f) => ({ ...f, region: next })); // keep cycle position in sync
  };

  /** Test 2: three keystrokes. Baseline applies each to shared state (3 full
   * commits); optimized types into the colocated draft (SearchBox only). */
  const runTypingTest = () => {
    beginMeasure(`Type 3 chars in search`);
    if (mode === 'baseline') {
      const chars = ['a', 'an', 'ana'];
      chars.forEach((q, i) => {
        window.setTimeout(() => {
          // Re-arm per keystroke so each commit is timed; report the last.
          beforeRef.current = getTotalRenders();
          t0Ref.current = performance.now();
          armedRef.current = true;
          setFilters((f) => ({ ...f, query: q }));
        }, i * 60);
      });
    } else {
      const chars = ['a', 'an', 'ana'];
      chars.forEach((q, i) => {
        window.setTimeout(() => {
          beforeRef.current = getTotalRenders();
          t0Ref.current = performance.now();
          armedRef.current = true;
          optRef.current?.typeText(q);
        }, i * 60);
      });
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    resetRenderCounts();
    setLastLabel('—');
    setLastRenders(null);
    setLastMs(null);
  };

  return (
    <div className="lab">
      <ExperimentHeader
        labId="rendering"
        title="React Rendering Performance"
        problem="Unrelated components re-render after a small state change."
        test="How state placement and prop stability affect React rendering."
        tool="React DevTools Profiler + render counters"
      />
      <div className="controls">
        <ModeSwitcher
          modes={[
            { id: 'baseline', label: 'Baseline', hint: 'Top-level state, unstable props, recompute everywhere' },
            { id: 'optimized', label: 'Optimized', hint: 'Split/colocated state, memo, stable props, compute once' },
          ]}
          value={mode}
          onChange={switchMode}
        />
        <div className="filter-row">
          <button onClick={runRegionTest}>Run Test: change region</button>
          <button onClick={runTypingTest}>Run Test: type 3 chars</button>
          <button onClick={() => { resetRenderCounts(); setLastRenders(null); setLastMs(null); setLastLabel('—'); }}>
            Reset counters
          </button>
        </div>
        <p className="hint">
          Baseline applies search keystrokes to shared state. Optimized keeps the draft in the search box until Apply.
        </p>
      </div>

      <ExperimentMetrics
        metrics={[
          { key: 'interaction', label: 'Last interaction', value: lastLabel },
          { key: 'renders', label: 'Components rendered', value: lastRenders === null ? '—' : String(lastRenders) },
          { key: 'ms', label: 'Commit time (approx)', value: formatMs(lastMs) },
          { key: 'total', label: 'Total tracked renders', value: String(getTotalRenders()) },
        ]}
      />

      {mode === 'baseline' ? (
        <BaselineDashboard filters={filters} setFilters={setFilters} />
      ) : (
        <OptimizedDashboard ref={optRef} />
      )}

      <section className="metrics" aria-label="Render map">
        <h2>Live render map</h2>
        <div className="render-map">
          {getRenderCounts().map(([name, n]) => (
            <div className="render-map-row" key={name}>
              <span>{name}</span>
              <span>{n} renders</span>
            </div>
          ))}
          {getRenderCounts().length === 0 && <span className="hint">Interact with the dashboard — counts appear here.</span>}
        </div>
      </section>

      <ProfilingGuide
        steps={[
          'Open React DevTools Profiler.',
          'Click Reset counters, then Start profiling.',
          'Click "Run Test: change region" — the same data update in both modes.',
          'Stop profiling: compare committed component counts and durations.',
          'Then try "Run Test: type 3 chars" — baseline re-renders everything per keystroke; optimized renders only the search box until Apply.',
        ]}
      />
    </div>
  );
}
