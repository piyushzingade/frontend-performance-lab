import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Row } from '../data/generateData';
import { MemoRow, PlainRow } from './TableRow';

export const ROW_HEIGHT = 33;
const OVERSCAN = 10;

const HEADERS = ['ID', 'Name', 'Email', 'Company', 'Dept', 'Salary', 'Bonus 20%', 'Status', 'Score', 'Created'];

function Head() {
  return (
    <thead>
      <tr>
        {HEADERS.map((h) => (
          <th key={h}>{h}</th>
        ))}
      </tr>
    </thead>
  );
}

export type TableProps = {
  rows: Row[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  memoized: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onDomCount: (n: number) => void;
};

/**
 * Renders ALL rows into the DOM. Intentionally heavy — this is the bottleneck
 * that virtualization removes. Do not use CSS hiding tricks here.
 */
export function FullTable({ rows, selectedId, onSelect, memoized, containerRef, onDomCount }: TableProps) {
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  useLayoutEffect(() => {
    const n = bodyRef.current?.querySelectorAll('tr[data-rowid]').length ?? 0;
    onDomCount(n);
  });

  const RowComp = memoized ? MemoRow : PlainRow;
  return (
    <div className="table-scroll" ref={containerRef}>
      <table>
        <Head />
        <tbody ref={bodyRef}>
          {rows.map((r) => (
            <RowComp key={r.id} row={r} selected={r.id === selectedId} onSelect={onSelect} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Virtualized table: renders only the visible window + overscan.
 * Scroll the container to page through all 100k records.
 */
export function VirtualizedTable({ rows, selectedId, onSelect, memoized, containerRef, onDomCount }: TableProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(520);
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    setViewportH(el.clientHeight || 520);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [containerRef]);

  const totalH = rows.length * ROW_HEIGHT;
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(viewportH / ROW_HEIGHT) + OVERSCAN * 2;
  const end = Math.min(rows.length, start + visibleCount);
  const slice = rows.slice(start, end);
  const topPad = start * ROW_HEIGHT;
  const bottomPad = totalH - end * ROW_HEIGHT;

  useLayoutEffect(() => {
    const n = bodyRef.current?.querySelectorAll('tr[data-rowid]').length ?? 0;
    onDomCount(n);
  });

  const RowComp = memoized ? MemoRow : PlainRow;

  return (
    <div className="table-scroll" ref={containerRef}>
      <table>
        <Head />
        <tbody ref={bodyRef}>
          {topPad > 0 && (
            <tr className="spacer">
              <td colSpan={HEADERS.length} style={{ height: topPad, padding: 0, border: 0 }} />
            </tr>
          )}
          {slice.map((r) => (
            <RowComp key={r.id} row={r} selected={r.id === selectedId} onSelect={onSelect} />
          ))}
          {bottomPad > 0 && (
            <tr className="spacer">
              <td colSpan={HEADERS.length} style={{ height: bottomPad, padding: 0, border: 0 }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
