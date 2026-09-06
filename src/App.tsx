import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controls, type Mode } from './components/Controls';
import { PerformancePanel } from './components/PerformancePanel';
import { FullTable, ROW_HEIGHT, VirtualizedTable } from './components/Table';
import { buildIndex, generateData, type Row } from './data/generateData';
import {
  DEFAULT_FILTER,
  baselineProcess,
  optimizedProcess,
  type FilterState,
} from './experiments/process';
import { usePerformanceMeasure } from './hooks/usePerformanceMeasure';
import { VoucherDemo } from './voucher/VoucherDemo';

function useRoute() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = useCallback((to: string) => {
    window.history.pushState({}, '', to);
    setPath(to);
    window.scrollTo(0, 0);
  }, []);
  return { path, navigate };
}

export default function App() {
  const { path } = useRoute();
  if (path === '/form') {
    return <VoucherDemo />;
  }
  return <PerfLab />;
}

function PerfLab() {
  type WorkerResultMsg = {
    type: 'RESULT';
    id: number;
    rows: Row[];
    workerMs: number;
  };
  const [mode, setMode] = useState<Mode>('worker'); // Worker by default: instant load, off-thread processing
  // The dataset is generated once, deterministically (seed 42). Same array for all modes.
  const dataset = useMemo(() => generateData(), []);
  const index = useMemo(() => buildIndex(dataset), [dataset]);

  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [draftQuery, setDraftQuery] = useState('');
  const [processed, setProcessed] = useState<Row[]>(dataset);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [domRows, setDomRows] = useState<number | null>(null);
  const [workerState, setWorkerState] = useState('Off');
  const [workerBusy, setWorkerBusy] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);
  const { lastOperation, run, reportAsync } = usePerformanceMeasure();

  // Surface the real data-generation duration (measured in generateData()).
  useEffect(() => {
    const entries = performance.getEntriesByName('data-generation');
    if (entries.length > 0) {
      reportAsync('data-generation (100k rows)', entries[entries.length - 1].duration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Web Worker lifecycle ----
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const sendToWorker = useCallback((f: FilterState) => {
    const w = workerRef.current;
    if (!w) return;
    reqId.current += 1;
    setWorkerBusy(true);
    w.postMessage({ type: 'FILTER', id: reqId.current, filter: f });
  }, []);

  useEffect(() => {
    if (mode !== 'worker') {
      setWorkerState((s) => (s === 'Off' ? s : 'Idle'));
      return;
    }
    setWorkerState('Indexing…');
    const worker = new Worker(new URL('./workers/dataWorker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<WorkerResultMsg | { type: string }>) => {
      const msg = e.data;
      if (msg.type === 'READY') {
        setWorkerState('Active');
        // Run current filter through the worker once ready.
        const w = workerRef.current;
        if (w) {
          reqId.current += 1;
          setWorkerBusy(true);
          w.postMessage({ type: 'FILTER', id: reqId.current, filter: filterRef.current });
        }
      } else if (msg.type === 'RESULT') {
        const m = msg as WorkerResultMsg;
        if (m.id !== reqId.current) return; // stale response
        setProcessed(m.rows);
        setWorkerBusy(false);
        reportAsync(`worker filter+sort (${m.rows.length.toLocaleString()} rows)`, m.workerMs);
      }
    };
    worker.onerror = () => {
      setWorkerState('Error — main-thread fallback');
      setProcessed(optimizedProcess(index, filter));
      setWorkerBusy(false);
    };
    worker.postMessage({ type: 'INIT', rows: dataset });
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sendToWorker]);

  // ---- Main-thread processing (all modes except worker) ----
  useEffect(() => {
    if (mode === 'worker') {
      sendToWorker(filter);
      return;
    }
    if (mode === 'optimized') {
      const rows = run('optimized filter+sort', () => optimizedProcess(index, filter));
      setProcessed(rows);
    } else {
      // baseline + virtualized share the intentionally naive pipeline.
      const rows = run(`${mode} filter+sort (naive)`, () => baselineProcess(dataset, filter));
      setProcessed(rows);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, filter, dataset, index]);

  // Stable callback: in baseline this still re-renders every row (no memo) —
  // that re-render cost IS the memoization lesson. In optimized/worker modes
  // MemoRow skips all untouched rows; verify in React DevTools Profiler.
  const handleSelect = useCallback((id: number) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const handleDomCount = useCallback((n: number) => setDomRows(n), []);

  const applySearch = useCallback(() => {
    setFilter((f) => ({ ...f, query: draftQuery }));
  }, [draftQuery]);

  const sortBy = useCallback((key: 'salary' | 'score') => {
    setFilter((f) => ({
      ...f,
      sortKey: key,
      sortDir: f.sortKey === key && f.sortDir === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  const visibleRows =
    containerRef.current?.clientHeight != null && containerRef.current.clientHeight > 0
      ? Math.ceil(containerRef.current.clientHeight / ROW_HEIGHT)
      : null;

  const useVirtual = mode !== 'baseline';
  const memoized = mode === 'optimized' || mode === 'worker';

  return (
    <div className="lab">
      <header>
        <h1>Frontend Performance Lab</h1>
        <p className="sub">100K-row rendering experiment — baseline vs. virtualization vs. memoization vs. worker</p>
        <p className="dataset-line">
          Dataset: 100,000 rows (deterministic, seed 42) · Current mode: <b>{mode}</b>
        </p>
      </header>

      <Controls
        mode={mode}
        onMode={setMode}
        filter={filter}
        draftQuery={draftQuery}
        onDraftQuery={setDraftQuery}
        onApply={(patch) => setFilter((f) => ({ ...f, ...patch }))}
        onApplySearch={applySearch}
        onSortSalary={() => sortBy('salary')}
        onSortScore={() => sortBy('score')}
        workerBusy={workerBusy}
      />

      <PerformancePanel
        mode={mode}
        datasetRows={dataset.length}
        matchedRows={processed.length}
        domRows={domRows}
        visibleRows={useVirtual ? visibleRows : domRows}
        lastOperation={lastOperation}
        workerState={mode === 'worker' ? (workerBusy ? 'Active (working…)' : workerState) : 'Off'}
      />

      <p className="selection-line">
        Selected row: {selectedId === null ? 'none — click any row' : `#${selectedId}`}
        {' · '}
        Showing {processed.length.toLocaleString()} of {dataset.length.toLocaleString()} rows
      </p>

      {useVirtual ? (
        <VirtualizedTable
          rows={processed}
          selectedId={selectedId}
          onSelect={handleSelect}
          memoized={memoized}
          containerRef={containerRef}
          onDomCount={handleDomCount}
        />
      ) : (
        <FullTable
          rows={processed}
          selectedId={selectedId}
          onSelect={handleSelect}
          memoized={false}
          containerRef={containerRef}
          onDomCount={handleDomCount}
        />
      )}

      <footer>
        <span>All timings from performance.mark()/measure() — no fabricated numbers.</span>
      </footer>
    </div>
  );
}
