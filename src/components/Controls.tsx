import type { FilterState, SortDir, SortKey } from '../experiments/process';

export type Mode = 'baseline' | 'virtualized' | 'optimized' | 'worker';

export const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'baseline', label: 'Baseline', hint: 'Full DOM, naive filter/sort' },
  { id: 'virtualized', label: 'Virtualized', hint: 'Windowed rows, naive processing' },
  { id: 'optimized', label: 'Optimized', hint: 'Virtualized + memo + single-pass' },
  { id: 'worker', label: 'Worker', hint: 'Optimized + off-thread processing' },
];

const DEPARTMENTS = ['', 'Engineering', 'Design', 'Marketing', 'Sales', 'Support', 'Finance', 'HR', 'Legal'];
const STATUSES = ['', 'Active', 'Inactive', 'Pending', 'Suspended'];

type Props = {
  mode: Mode;
  onMode: (m: Mode) => void;
  filter: FilterState;
  draftQuery: string;
  onDraftQuery: (q: string) => void;
  onApply: (patch: Partial<FilterState>) => void;
  onApplySearch: () => void;
  onSortSalary: () => void;
  onSortScore: () => void;
  workerBusy: boolean;
};

export function Controls(p: Props) {
  return (
    <div className="controls">
      <div className="mode-row" role="tablist" aria-label="Experiment mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={p.mode === m.id}
            className={p.mode === m.id ? 'active' : ''}
            title={m.hint}
            onClick={() => p.onMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="filter-row">
        <input
          aria-label="Search"
          placeholder="Search name / email / company — then press Enter"
          value={p.draftQuery}
          onChange={(e) => p.onDraftQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') p.onApplySearch();
          }}
        />
        <button onClick={p.onApplySearch} disabled={p.workerBusy}>
          {p.workerBusy ? 'Working…' : 'Apply search / filter'}
        </button>
        <select
          aria-label="Department"
          value={p.filter.department}
          onChange={(e) => p.onApply({ department: e.target.value })}
        >
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d === '' ? 'All departments' : d}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          value={p.filter.status}
          onChange={(e) => p.onApply({ status: e.target.value })}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === '' ? 'All statuses' : s}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort key"
          value={p.filter.sortKey}
          onChange={(e) => p.onApply({ sortKey: e.target.value as SortKey })}
        >
          {(['id', 'name', 'salary', 'score', 'company'] as SortKey[]).map((k) => (
            <option key={k} value={k}>
              Sort: {k}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort direction"
          value={p.filter.sortDir}
          onChange={(e) => p.onApply({ sortDir: e.target.value as SortDir })}
        >
          <option value="asc">Asc</option>
          <option value="desc">Desc</option>
        </select>
        <button onClick={p.onSortSalary} title="Test D: sort 100k rows by salary">
          Sort by salary
        </button>
        <button onClick={p.onSortScore} title="Sort 100k rows by score">
          Sort by score
        </button>
      </div>
    </div>
  );
}
