import type { IndexedRow, Row } from '../data/generateData';

export type SortKey = 'id' | 'name' | 'salary' | 'score' | 'company';
export type SortDir = 'asc' | 'desc';

export type FilterState = {
  query: string;
  department: string; // '' = all
  status: string; // '' = all
  sortKey: SortKey;
  sortDir: SortDir;
};

export const DEFAULT_FILTER: FilterState = {
  query: '',
  department: '',
  status: '',
  sortKey: 'id',
  sortDir: 'asc',
};

/**
 * BASELINE — intentionally inefficient but honest work (no fake delays).
 *
 * Problems demonstrated:
 *  1. Multiple passes over 100k rows (filter -> map -> filter -> sort
 *     with fresh spreads, then another filter for the query).
 *  2. toLowerCase() recomputed for every row on every keystroke.
 *  3. Derived values (display strings) allocated per row per pass.
 *  4. Sort comparator uses localeCompare + re-reads properties.
 */
export function baselineProcess(rows: Row[], f: FilterState): Row[] {
  // Pass 1: department filter + spread a new object per row.
  let out = rows
    .filter((r) => (f.department ? r.department === f.department : true))
    .map((r) => ({ ...r }));
  // Pass 2: status filter, again with fresh objects.
  out = out
    .filter((r) => (f.status ? r.status === f.status : true))
    .map((r) => ({ ...r }));
  // Pass 3: query — lowercases haystack AND query per row.
  if (f.query) {
    const q = f.query;
    out = out.filter((r) =>
      `${r.name} ${r.email} ${r.company}`.toLowerCase().includes(q.toLowerCase()),
    );
  }
  // Pass 4: sort a copy with an expensive comparator.
  const sorted = [...out].sort((a, b) => {
    let cmp: number;
    if (f.sortKey === 'name' || f.sortKey === 'company') {
      cmp = String(a[f.sortKey]).localeCompare(String(b[f.sortKey]));
    } else {
      cmp = (a[f.sortKey] as number) - (b[f.sortKey] as number);
    }
    return f.sortDir === 'asc' ? cmp : -cmp;
  });
  // Pass 5: gratuitous final map allocating throwaway display objects.
  return sorted.map((r) => {
    void `${r.name.toUpperCase()}|${r.salary.toLocaleString()}|${(r.salary * 0.2).toFixed(2)}`;
    return r;
  });
}

/**
 * OPTIMIZED — single pass, precomputed search index, cheap comparator.
 * Same observable result as baselineProcess, minimal repeated work.
 */
export function optimizedProcess(rows: IndexedRow[], f: FilterState): IndexedRow[] {
  const q = f.query.trim().toLowerCase();
  const hasDept = f.department !== '';
  const hasStatus = f.status !== '';
  const out: IndexedRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (hasDept && r.department !== f.department) continue;
    if (hasStatus && r.status !== f.status) continue;
    if (q && !r._search.includes(q)) continue;
    out.push(r);
  }
  const dir = f.sortDir === 'asc' ? 1 : -1;
  const key = f.sortKey;
  // Numeric fast path; string path uses simple </> instead of localeCompare.
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
