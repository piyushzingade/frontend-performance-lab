import type { OperationMeasurement } from '../hooks/usePerformanceMeasure';
import type { Mode } from './Controls';

type Props = {
  mode: Mode;
  datasetRows: number;
  matchedRows: number;
  domRows: number | null;
  visibleRows: number | null;
  lastOperation: OperationMeasurement | null;
  workerState: string;
};

function fmt(ms: number) {
  return ms < 10 ? `${ms.toFixed(2)} ms` : `${Math.round(ms)} ms`;
}

export function PerformancePanel(p: Props) {
  return (
    <section className="metrics" aria-label="Performance metrics">
      <h2>Performance Metrics</h2>
      <div className="metric-grid">
        <div className="metric">
          <span className="k">Dataset rows</span>
          <span className="v">{p.datasetRows.toLocaleString()}</span>
        </div>
        <div className="metric">
          <span className="k">Matched rows</span>
          <span className="v">{p.matchedRows.toLocaleString()}</span>
        </div>
        <div className="metric">
          <span className="k">Rendered DOM rows</span>
          <span className="v">{p.domRows === null ? '—' : p.domRows.toLocaleString()}</span>
        </div>
        <div className="metric">
          <span className="k">Visible rows (viewport)</span>
          <span className="v">{p.visibleRows === null ? '—' : p.visibleRows}</span>
        </div>
        <div className="metric">
          <span className="k">Last operation</span>
          <span className="v">
            {p.lastOperation ? `${p.lastOperation.label}: ${fmt(p.lastOperation.durationMs)}` : '—'}
          </span>
        </div>
        <div className="metric">
          <span className="k">Worker</span>
          <span className="v">{p.workerState}</span>
        </div>
        <div className="metric">
          <span className="k">Mode</span>
          <span className="v">{p.mode}</span>
        </div>
      </div>
    </section>
  );
}
