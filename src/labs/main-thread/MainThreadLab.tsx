import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExperimentHeader } from '../../components/ExperimentHeader';
import { ExperimentMetrics } from '../../components/ExperimentMetrics';
import { ModeSwitcher } from '../../components/ModeSwitcher';
import { ProfilingGuide } from '../../components/ProfilingGuide';
import { formatMs, measureSync } from '../../performance/measure';
import { longTaskStats, useLongTasks } from '../../performance/longTasks';
import { genItems, processItems, type Processed } from './pipeline';

type Mode = 'baseline' | 'worker';
const SIZES = [10_000, 25_000, 50_000, 100_000];

/** rAF heartbeat: a dot gliding on transform. Gaps >120ms = frozen frames. */
function Heartbeat({ onFreeze }: { onFreeze: (ms: number) => void }) {
  const dotRef = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onFreeze);
  cbRef.current = onFreeze;
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      if (last !== 0) {
        const d = t - last;
        if (d > 120) cbRef.current(d); // main thread was busy — heartbeat skipped
      }
      last = t;
      if (dotRef.current) {
        const x = ((t / 8) % 560);
        dotRef.current.style.transform = `translateX(${x}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="heartbeat" aria-label="Main thread heartbeat">
      <div className="heartbeat-dot" ref={dotRef} />
    </div>
  );
}

export function MainThreadLab() {
  const [mode, setMode] = useState<Mode>('baseline');
  const [size, setSize] = useState(50_000);
  const [query, setQuery] = useState('pro');
  const [typing, setTyping] = useState('');
  const [result, setResult] = useState<Processed | null>(null);
  const [opMs, setOpMs] = useState<number | null>(null);
  const [workerMs, setWorkerMs] = useState<number | null>(null);
  const [freezes, setFreezes] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [workerState, setWorkerState] = useState('Off');

  const items = useMemo(() => genItems(size), [size]);
  const { tasks, reset: resetTasks } = useLongTasks(true);
  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);

  const onFreeze = useCallback((ms: number) => {
    setFreezes((f) => [...f.slice(-19), Math.round(ms)]);
  }, []);

  // Worker lifecycle: regenerate dataset when size changes in worker mode.
  useEffect(() => {
    if (mode !== 'worker') {
      setWorkerState('Off');
      return;
    }
    setWorkerState('Preparing…');
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = w;
    w.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'READY') {
        setWorkerState('Active');
      } else if (e.data.type === 'RESULT' && e.data.id === reqId.current) {
        setResult(e.data.result);
        setWorkerMs(e.data.workerMs);
        setOpMs(performance.now() - t0Ref.current);
        setBusy(false);
      }
    };
    w.postMessage({ type: 'INIT', n: size });
    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, [mode, size]);

  const t0Ref = useRef(0);

  const run = () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    setOpMs(null);
    setWorkerMs(null);
    setFreezes([]);
    resetTasks();
    t0Ref.current = performance.now();
    if (mode === 'baseline') {
      // Synchronous main-thread pipeline — heartbeat + typing visibly freeze.
      const { result, durationMs } = measureSync(`pipeline-${size}`, () => processItems(items, query));
      setResult(result);
      setOpMs(durationMs);
      setBusy(false);
    } else {
      reqId.current += 1;
      workerRef.current?.postMessage({ type: 'RUN', id: reqId.current, query });
    }
  };

  const stats = longTaskStats(tasks);
  const switchMode = (m: Mode) => {
    setMode(m);
    setResult(null);
    setOpMs(null);
    setWorkerMs(null);
    setFreezes([]);
  };

  return (
    <div className="lab">
      <ExperimentHeader
        labId="main-thread"
        title="Main Thread / Web Worker"
        problem="CPU-heavy processing freezes the UI."
        test="Whether moving filter→fuzzy→sort→rank→aggregate off-thread keeps the page responsive."
        tool="Chrome Performance + heartbeat animation"
      />
      <div className="controls">
        <ModeSwitcher
          modes={[
            { id: 'baseline', label: 'Baseline (main thread)' },
            { id: 'worker', label: 'Worker' },
          ]}
          value={mode}
          onChange={switchMode}
        />
        <div className="filter-row">
          <select aria-label="Dataset size" value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {SIZES.map((n) => <option key={n} value={n}>{n.toLocaleString()} items</option>)}
          </select>
          <input aria-label="Search query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="fuzzy query" />
          <button onClick={run} disabled={busy || (mode === 'worker' && workerState !== 'Active')}>
            {busy ? 'Processing…' : 'Run pipeline'}
          </button>
          <input aria-label="Typing test" value={typing} onChange={(e) => setTyping(e.target.value)} placeholder="Type here during processing…" />
        </div>
        <p className="hint">Watch the heartbeat dot and try typing while the pipeline runs. In baseline both freeze.</p>
      </div>

      <Heartbeat onFreeze={onFreeze} />

      <ExperimentMetrics
        metrics={[
          { key: 'n', label: 'Processing', value: `${size.toLocaleString()} records` },
          { key: 'thread', label: mode === 'baseline' ? 'Main thread' : 'Worker', value: mode === 'baseline' ? (busy ? 'busy' : 'idle') : workerState },
          { key: 'op', label: 'Operation', value: formatMs(opMs) },
          ...(mode === 'worker' ? [{ key: 'wms', label: 'Worker compute', value: formatMs(workerMs) }] : []),
          { key: 'long', label: 'Long tasks', value: `${stats.count} (max ${formatMs(stats.max)})` },
          { key: 'freeze', label: 'Heartbeat freezes', value: freezes.length === 0 ? '0' : `${freezes.length} (worst ${Math.max(...freezes)} ms)` },
          { key: 'matched', label: 'Matched', value: result ? result.matched.toLocaleString() : '—' },
        ]}
      />

      {result && (
        <section className="metrics" aria-label="Results">
          <h2>Top ranked</h2>
          <div className="render-map">
            {result.top.slice(0, 10).map((r) => (
              <div className="render-map-row" key={r.id}><span>#{r.id} {r.name}</span><span>score {r.score}</span></div>
            ))}
          </div>
          <p className="hint">avg price ₹{Math.round(result.avgPrice).toLocaleString()} · top category {result.topCategory}</p>
        </section>
      )}

      <ProfilingGuide
        steps={[
          'Start in Baseline with 50K items. Click "Run pipeline" while watching the heartbeat dot.',
          'Record a Performance trace during the run: one long task, frozen rAF, dead typing field.',
          'Switch to Worker, run again: heartbeat glides through, typing works, work appears on the worker thread.',
          'Note the honesty clause: worker total time may be similar — responsiveness, not speed, is the win.',
        ]}
      />
    </div>
  );
}
