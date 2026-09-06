/**
 * Web Worker: runs the expensive filter/sort over 100k rows off the main thread.
 * Receives the full dataset once (INIT), then FILTER messages. Posts back the
 * matched rows. postMessage structured-clone cost is real and measurable —
 * that tradeoff is part of the experiment.
 */
import type { FilterState } from '../experiments/process';
import type { IndexedRow, Row } from '../data/generateData';

let index: IndexedRow[] = [];

type InMsg =
  | { type: 'INIT'; rows: Row[] }
  | { type: 'FILTER'; id: number; filter: FilterState };

function process(filter: FilterState): IndexedRow[] {
  const q = filter.query.trim().toLowerCase();
  const hasDept = filter.department !== '';
  const hasStatus = filter.status !== '';
  const out: IndexedRow[] = [];
  for (let i = 0; i < index.length; i++) {
    const r = index[i];
    if (hasDept && r.department !== filter.department) continue;
    if (hasStatus && r.status !== filter.status) continue;
    if (q && !r._search.includes(q)) continue;
    out.push(r);
  }
  const dir = filter.sortDir === 'asc' ? 1 : -1;
  const key = filter.sortKey;
  if (key === 'id' || key === 'salary' || key === 'score') {
    out.sort((a, b) => (a[key] - b[key]) * dir);
  } else {
    out.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
    });
  }
  return out;
}

self.onmessage = (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  if (msg.type === 'INIT') {
    const t0 = performance.now();
    index = msg.rows.map((r) => ({
      ...r,
      _search: `${r.name} ${r.email} ${r.company}`.toLowerCase(),
    }));
    const dt = performance.now() - t0;
    self.postMessage({ type: 'READY', indexMs: dt });
    return;
  }
  if (msg.type === 'FILTER') {
    const t0 = performance.now();
    const rows = process(msg.filter);
    const dt = performance.now() - t0;
    self.postMessage({ type: 'RESULT', id: msg.id, rows, workerMs: dt });
  }
};
