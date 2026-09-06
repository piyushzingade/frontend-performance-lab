import { useRef, useState } from 'react';
import { ExperimentHeader } from '../../components/ExperimentHeader';
import { ExperimentMetrics } from '../../components/ExperimentMetrics';
import { ModeSwitcher } from '../../components/ModeSwitcher';
import { ProfilingGuide } from '../../components/ProfilingGuide';
import { formatMs } from '../../performance/measure';

type Mode = 'baseline' | 'optimized';
type Span = { name: string; start: number; end: number; cached: boolean };

async function get(endpoint: string, params = ''): Promise<unknown> {
  const res = await fetch(`/api/lab/${endpoint}${params}`);
  if (!res.ok) throw new Error(`/${endpoint} → ${res.status}`);
  return res.json();
}

export function NetworkLab() {
  const [mode, setMode] = useState<Mode>('baseline');
  const [spans, setSpans] = useState<Span[]>([]);
  const [totalMs, setTotalMs] = useState<number | null>(null);
  const [cacheHits, setCacheHits] = useState(0);
  const [dupes, setDupes] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef(new Map<string, unknown>());
  const inflight = useRef(new Map<string, Promise<unknown>>());

  const timed = async (name: string, fn: () => Promise<unknown>, t0: number): Promise<unknown> => {
    const start = performance.now() - t0;
    try {
      const data = await fn();
      const end = performance.now() - t0;
      setSpans((s) => [...s, { name, start, end, cached: false }]);
      return data;
    } catch (e) {
      throw e;
    }
  };

  /** Baseline: every request awaits the previous one — a real waterfall. */
  const runBaseline = async () => {
    reset();
    setRunning(true);
    const t0 = performance.now();
    try {
      const user = (await timed('user', () => get('user'), t0)) as { id: number };
      const q = `?userId=${user.id}`;
      await timed('profile', () => get('profile', q), t0);
      await timed('permissions', () => get('permissions', q), t0);
      await timed('preferences', () => get('preferences', q), t0);
      await timed('stats', () => get('stats'), t0);
      await timed('activity', () => get('activity'), t0);
      await timed('recommendations', () => get('recommendations'), t0);
      setTotalMs(performance.now() - t0);
    } catch (e) {
      setError(e instanceof Error ? `${e.message} — mock API needs the Vite dev server (npm run dev).` : 'request failed');
    }
    setRunning(false);
  };

  /** Cached + deduped fetch used by the optimized path. */
  const smart = (name: string, params: string, t0: number): Promise<unknown> => {
    const key = `${name}${params}`;
    const hit = cache.current.get(key);
    if (hit !== undefined) {
      setCacheHits((n) => n + 1);
      const now = performance.now() - t0;
      setSpans((s) => [...s, { name: `${name} (cache)`, start: now, end: now, cached: true }]);
      return Promise.resolve(hit);
    }
    const ongoing = inflight.current.get(key);
    if (ongoing) {
      setDupes((d) => d + 1);
      return ongoing;
    }
    const start = performance.now() - t0;
    const p = get(name, params)
      .then((data) => {
        cache.current.set(key, data);
        const end = performance.now() - t0;
        setSpans((s) => [...s, { name, start, end, cached: false }]);
        inflight.current.delete(key);
        return data;
      })
      .catch((e) => {
        inflight.current.delete(key);
        throw e;
      });
    inflight.current.set(key, p);
    return p;
  };

  /** Optimized: user first (genuine dependency), then independent groups in
   * parallel; stats requested twice concurrently to prove dedupe. */
  const runOptimized = async () => {
    reset();
    setRunning(true);
    const t0 = performance.now();
    try {
      const user = (await smart('user', '', t0)) as { id: number };
      const q = `?userId=${user.id}`;
      await Promise.all([
        smart('profile', q, t0),
        smart('permissions', q, t0),
        smart('preferences', q, t0),
      ]);
      await Promise.all([
        smart('stats', '', t0),
        smart('stats', '', t0), // intentional duplicate → deduped to 1 request
        smart('activity', '', t0),
        smart('recommendations', '', t0),
      ]);
      setTotalMs(performance.now() - t0);
    } catch (e) {
      setError(e instanceof Error ? `${e.message} — mock API needs the Vite dev server (npm run dev).` : 'request failed');
    }
    setRunning(false);
  };

  const reset = () => {
    setSpans([]);
    setTotalMs(null);
    setError(null);
  };

  const runAll = () => (mode === 'baseline' ? runBaseline() : runOptimized());
  const switchMode = (m: Mode) => {
    setMode(m);
    reset();
    setCacheHits(0);
    setDupes(0);
  };

  const slowest = spans.length ? spans.reduce((a, s) => ((s.end - s.start > a.end - a.start) ? s : a)) : null;
  const scale = totalMs ? 100 / totalMs : 0;

  return (
    <div className="lab">
      <ExperimentHeader
        labId="network"
        title="Network Waterfall"
        problem="Dependent requests load sequentially."
        test="Whether parallelization + dedupe + caching change total load time."
        tool="Chrome Network panel + in-app waterfall"
      />
      <div className="controls">
        <ModeSwitcher
          modes={[
            { id: 'baseline', label: 'Baseline (waterfall)' },
            { id: 'optimized', label: 'Optimized (parallel+cached)' },
          ]}
          value={mode}
          onChange={switchMode}
        />
        <div className="filter-row">
          <button onClick={runAll} disabled={running}>{running ? 'Loading…' : mode === 'baseline' ? 'Load page (sequential)' : 'Load page (optimized)'}</button>
          {mode === 'optimized' && (
            <button onClick={runAll} disabled={running}>Run again (cache warm)</button>
          )}
          <button onClick={() => { reset(); cache.current.clear(); setCacheHits(0); setDupes(0); }}>Reset + clear cache</button>
        </div>
        <p className="hint">Real HTTP requests to the Vite dev-server mock API — watch them land in the Network panel.</p>
      </div>

      <ExperimentMetrics
        metrics={[
          { key: 'total', label: 'Total load time', value: formatMs(totalMs) },
          { key: 'req', label: 'Network requests', value: String(spans.filter((s) => !s.cached).length) },
          { key: 'hits', label: 'Cache hits', value: String(cacheHits) },
          { key: 'dupes', label: 'Duplicates prevented', value: String(dupes) },
          { key: 'slow', label: 'Slowest request', value: slowest ? `${slowest.name}: ${formatMs(slowest.end - slowest.start)}` : '—' },
        ]}
      />

      {error && <p className="dataset-line">{error}</p>}

      <section className="metrics" aria-label="Waterfall">
        <h2>Request waterfall (measured start/end offsets)</h2>
        {spans.length === 0 && <span className="hint">Run a load to draw the waterfall.</span>}
        <div className="waterfall">
          {spans.map((s, i) => (
            <div className="wf-row" key={i}>
              <span className="wf-name">{s.name}</span>
              <div className="wf-track">
                <div
                  className={`wf-bar${s.cached ? ' cached' : ''}`}
                  style={{ left: `${s.start * scale}%`, width: `${Math.max((s.end - s.start) * scale, s.cached ? 1.2 : 0.6)}%` }}
                  title={`${s.name}: +${Math.round(s.start)}ms → +${Math.round(s.end)}ms`}
                />
              </div>
              <span className="wf-ms">{s.cached ? 'cache' : `${Math.round(s.end - s.start)} ms`}</span>
            </div>
          ))}
        </div>
      </section>

      <ProfilingGuide
        steps={[
          'Open the Network panel (and the Performance tab if you want both).',
          'Run the baseline load: 7 sequential bars, ~1.4s total.',
          'Switch to optimized and run: 3 parallel waves, then run again with a warm cache.',
          'Filter the Network panel by "/api/lab" to compare request counts and timing.',
        ]}
      />
    </div>
  );
}
