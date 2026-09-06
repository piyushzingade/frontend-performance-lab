import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExperimentHeader } from '../../components/ExperimentHeader';
import { ExperimentMetrics } from '../../components/ExperimentMetrics';
import { ModeSwitcher } from '../../components/ModeSwitcher';
import { ProfilingGuide } from '../../components/ProfilingGuide';
import { FullTable, ROW_HEIGHT, VirtualizedTable } from '../../components/Table';
import { buildIndex, type Row } from '../../data/generateData';
import { DEFAULT_FILTER, baselineProcess, optimizedProcess, type FilterState } from '../../experiments/process';
import { usePerformanceMeasure } from '../../hooks/usePerformanceMeasure';
import { formatMs } from '../../performance/measure';
import { getMemoryMB } from '../../performance/observers';
import { CanvasScatter, useIndexedDataset } from './CanvasStage';

type Stage = 'raw' | 'memo' | 'virtualized' | 'worker' | 'canvas';
const SIZES = [10_000, 100_000, 250_000, 500_000];
const RAW_DOM_LIMIT = 100_000; // above this, full-DOM stages need explicit consent

type StageResult = { stage: Stage; dataset: number; dom: number | null; processMs: number | null };

export function StressTestLab() {
  const [stage, setStage] = useState<Stage>('virtualized');
  const [size, setSize] = useState(100_000);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [draftQuery, setDraftQuery] = useState('');
  const [processed, setProcessed] = useState<Row[]>([]);
  const [domRows, setDomRows] = useState<number | null>(null);
  const [drawMs, setDrawMs] = useState<number | null>(null);
  const [consent, setConsent] = useState(false);
  const [workerState, setWorkerState] = useState('Off');
  const [results, setResults] = useState<StageResult[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);
  const { lastOperation, run, reportAsync } = usePerformanceMeasure();

  const { dataset, genMs } = useIndexedDataset(size);
  const index = useMemo(() => buildIndex(dataset), [dataset]);

  // Worker lifecycle (worker stage only).
  useEffect(() => {
    if (stage !== 'worker') {
      setWorkerState('Off');
      return;
    }
    setWorkerState('Preparing…');
    const w = new Worker(new URL('../../workers/dataWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = w;
    w.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'READY') {
        setWorkerState('Active');
        reqId.current += 1;
        w.postMessage({ type: 'FILTER', id: reqId.current, filter });
      } else if (e.data.type === 'RESULT' && e.data.id === reqId.current) {
        setProcessed(e.data.rows);
        reportAsync(`worker filter+sort (${e.data.rows.length.toLocaleString()})`, e.data.workerMs);
      }
    };
    w.postMessage({ type: 'INIT', rows: dataset });
    return () => {
      w.terminate();
      workerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, dataset]);

  // Main-thread processing for non-worker stages.
  useEffect(() => {
    if (stage === 'worker' || dataset.length === 0) return;
    if (stage === 'raw' || stage === 'virtualized') {
      setProcessed(run(`${stage} filter+sort (naive)`, () => baselineProcess(dataset, filter)));
    } else {
      setProcessed(run(`${stage} filter+sort (optimized)`, () => optimizedProcess(index, filter)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, filter, dataset, index]);

  useEffect(() => {
    if (stage === 'worker' && workerRef.current) {
      reqId.current += 1;
      workerRef.current.postMessage({ type: 'FILTER', id: reqId.current, filter });
    }
  }, [filter, stage]);

  const handleSelect = useCallback((_id: number) => {}, []);
  const handleDom = useCallback((n: number) => setDomRows(n), []);
  const handleDraw = useCallback((ms: number) => {
    setDrawMs(ms);
    setDomRows(1); // one canvas element
  }, []);

  // Log a comparison-table row whenever fresh measurements land.
  useEffect(() => {
    if (dataset.length === 0) return;
    const ms = lastOperation && /filter\+sort/.test(lastOperation.label) ? lastOperation.durationMs : stage === 'canvas' ? drawMs : null;
    setResults((prev) => {
      const row: StageResult = { stage, dataset: dataset.length, dom: stage === 'canvas' ? 1 : domRows, processMs: ms };
      const others = prev.filter((r) => r.stage !== stage || r.dataset !== dataset.length);
      return [...others, row].slice(-12);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domRows, lastOperation, drawMs, stage, dataset.length]);

  const switchStage = (s: Stage) => {
    setStage(s);
    setConsent(false);
    setDomRows(null);
    setDrawMs(null);
  };

  const needsConsent = (stage === 'raw' || stage === 'memo') && processed.length > RAW_DOM_LIMIT && !consent;
  const memMB = getMemoryMB();

  return (
    <div className="lab">
      <ExperimentHeader
        labId="stress"
        title="Frontend Stress Test"
        problem="Each rendering strategy breaks at a different scale."
        test="How far DOM, memoization, virtualization, workers, and canvas scale."
        tool="Chrome Performance + DOM counters"
      />
      <div className="controls">
        <ModeSwitcher
          modes={[
            { id: 'raw', label: '1. Raw DOM' },
            { id: 'memo', label: '2. Memoized' },
            { id: 'virtualized', label: '3. Virtualized' },
            { id: 'worker', label: '4. Worker' },
            { id: 'canvas', label: '5. Canvas' },
          ]}
          value={stage}
          onChange={switchStage}
        />
        <div className="filter-row">
          <select aria-label="Dataset size" value={size} onChange={(e) => { setSize(Number(e.target.value)); setConsent(false); }}>
            {SIZES.map((n) => <option key={n} value={n}>{n.toLocaleString()} rows</option>)}
          </select>
          <input aria-label="Search" placeholder="Search — Enter to apply" value={draftQuery} onChange={(e) => setDraftQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') setFilter((f) => ({ ...f, query: draftQuery })); }} />
          <button onClick={() => setFilter((f) => ({ ...f, query: draftQuery }))}>Apply search</button>
          <button onClick={() => setFilter((f) => ({ ...f, sortKey: 'salary', sortDir: f.sortDir === 'desc' ? 'asc' : 'desc' }))}>Sort by salary</button>
        </div>
        <p className="hint">Dataset generation: {formatMs(genMs)}. Raw/memoized stages above {RAW_DOM_LIMIT.toLocaleString()} rows need explicit consent.</p>
      </div>

      <ExperimentMetrics
        metrics={[
          { key: 'stage', label: 'Stage', value: stage },
          { key: 'rows', label: 'Dataset', value: dataset.length.toLocaleString() },
          { key: 'matched', label: 'Matched', value: processed.length.toLocaleString() },
          { key: 'dom', label: stage === 'canvas' ? 'Canvas elements' : 'DOM rows', value: domRows === null ? '—' : domRows.toLocaleString() },
          { key: 'op', label: 'Last operation', value: lastOperation ? `${lastOperation.label}: ${formatMs(lastOperation.durationMs)}` : formatMs(drawMs) },
          { key: 'mem', label: 'JS heap', value: memMB === null ? 'unsupported' : `${memMB.toFixed(0)} MB` },
          { key: 'worker', label: 'Worker', value: stage === 'worker' ? workerState : 'Off' },
        ]}
      />

      {needsConsent ? (
        <div className="dataset-line">
          <b>Warning:</b> rendering {processed.length.toLocaleString()} rows as full DOM may freeze this tab.
          <div className="filter-row" style={{ marginTop: 8 }}>
            <button onClick={() => setConsent(true)}>Render anyway</button>
            <button onClick={() => switchStage('virtualized')}>Use virtualized instead</button>
          </div>
        </div>
      ) : stage === 'canvas' ? (
        <CanvasScatter rows={processed} onDraw={handleDraw} />
      ) : stage === 'raw' || stage === 'memo' ? (
        <FullTable rows={processed} selectedId={null} onSelect={handleSelect} memoized={stage === 'memo'} containerRef={containerRef} onDomCount={handleDom} />
      ) : (
        <VirtualizedTable rows={processed} selectedId={null} onSelect={handleSelect} memoized={stage === 'worker'} containerRef={containerRef} onDomCount={handleDom} />
      )}

      <section className="metrics" aria-label="Comparison table">
        <h2>Strategy comparison (your measured runs)</h2>
        <div className="render-map">
          <div className="render-map-row head"><span>Technique · dataset</span><span>Rendered elements · process ms</span></div>
          {results.map((r, i) => (
            <div className="render-map-row" key={i}>
              <span>{r.stage} · {r.dataset.toLocaleString()}</span>
              <span>{r.dom === null ? '—' : r.dom.toLocaleString()} · {formatMs(r.processMs)}</span>
            </div>
          ))}
          {results.length === 0 && <span className="hint">Switch stages and run searches — rows appear here.</span>}
        </div>
      </section>

      <p className="hint">Visible rows ≈ {Math.ceil(520 / ROW_HEIGHT)} at 520px viewport. WebGL omitted deliberately — canvas already covers the dense-visual case (see README).</p>

      <ProfilingGuide
        steps={[
          'Start at 100K virtualized, record a reload trace as your baseline.',
          'Switch to Raw DOM at 100K: record reload + scroll + sort. Compare long tasks.',
          'Try 250K raw: read the warning, consent, and watch what happens.',
          'Compare memoized vs raw row-click behavior in the React Profiler.',
          'Canvas at 500K: one element, measured draw time, full scroll freedom traded for DOM semantics.',
        ]}
      />
    </div>
  );
}
