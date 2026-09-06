import { memo } from 'react';
import type { Row } from '../data/generateData';

export type RowProps = {
  row: Row;
  selected: boolean;
  onSelect: (id: number) => void;
};

/** Derived values computed inline — the baseline pays this cost per row per render. */
export function derived(row: Row) {
  return {
    bonus: row.salary * 0.2,
    grade: row.score >= 90 ? 'A' : row.score >= 75 ? 'B' : row.score >= 50 ? 'C' : 'D',
  };
}

/** Baseline row: plain component, re-renders whenever the parent re-renders. */
export function PlainRow({ row, selected, onSelect }: RowProps) {
  const d = derived(row);
  return (
    <tr
      data-rowid={row.id}
      onClick={() => onSelect(row.id)}
      style={{ background: selected ? '#e8f0fe' : undefined, cursor: 'pointer' }}
    >
      <td>{row.id}</td>
      <td>{row.name}</td>
      <td>{row.email}</td>
      <td>{row.company}</td>
      <td>{row.department}</td>
      <td>{row.salary.toLocaleString()}</td>
      <td>{d.bonus.toFixed(2)}</td>
      <td>{row.status}</td>
      <td>{row.score} ({d.grade})</td>
      <td>{row.createdAt}</td>
    </tr>
  );
}

/**
 * Optimized row: memoized + stable props. Skips re-render unless THIS row's
 * data/selection actually changed. Verify in React DevTools Profiler
 * ("Highlight updates" / recorded renders).
 */
export const MemoRow = memo(function MemoRow({ row, selected, onSelect }: RowProps) {
  const d = derived(row);
  return (
    <tr
      data-rowid={row.id}
      onClick={() => onSelect(row.id)}
      style={{ background: selected ? '#e8f0fe' : undefined, cursor: 'pointer' }}
    >
      <td>{row.id}</td>
      <td>{row.name}</td>
      <td>{row.email}</td>
      <td>{row.company}</td>
      <td>{row.department}</td>
      <td>{row.salary.toLocaleString()}</td>
      <td>{d.bonus.toFixed(2)}</td>
      <td>{row.status}</td>
      <td>{row.score} ({d.grade})</td>
      <td>{row.createdAt}</td>
    </tr>
  );
});
