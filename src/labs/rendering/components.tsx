import { memo } from 'react';
import { useRenderCounter } from '../../performance/renderCounter';
import type { SaleRecord } from './data';

/**
 * Presentational dashboard pieces. Each tracks its own renders.
 * Whether they re-render unnecessarily depends on how the PARENT wires
 * them (inline props + top-level state = baseline; memo + stable props =
 * optimized). Same components, different render behavior.
 */

export function Kpi({ name, label, value, style, onClick }: {
  name: string; label: string; value: string; style?: React.CSSProperties; onClick?: () => void;
}) {
  useRenderCounter(name);
  return (
    <div className="dash-card" style={style} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      <span className="k">{label}</span>
      <span className="v">{value}</span>
    </div>
  );
}

export const MemoKpi = memo(Kpi);

export function BarsChart({ name, title, entries }: { name: string; title: string; entries: [string, number][] }) {
  useRenderCounter(name);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="dash-card wide">
      <span className="k">{title}</span>
      <svg viewBox="0 0 200 70" className="bars" role="img" aria-label={title}>
        {entries.map(([k, v], i) => (
          <rect key={k} x={8 + i * 48} y={65 - (v / max) * 55} width={34} height={(v / max) * 55} />
        ))}
      </svg>
    </div>
  );
}

export const MemoBarsChart = memo(BarsChart);

export function Spark({ name, title, points }: { name: string; title: string; points: number[] }) {
  useRenderCounter(name);
  const max = Math.max(1, ...points);
  const path = points.map((p, i) => `${(i / (points.length - 1)) * 200},${28 - (p / max) * 24}`).join(' ');
  return (
    <div className="dash-card">
      <span className="k">{title}</span>
      <svg viewBox="0 0 200 32" className="spark" role="img" aria-label={title}>
        <polyline points={path} fill="none" strokeWidth={2} />
      </svg>
    </div>
  );
}

export const MemoSpark = memo(Spark);

export function DataTable({ name, title, rows }: { name: string; title: string; rows: SaleRecord[] }) {
  useRenderCounter(name);
  return (
    <div className="dash-card wide">
      <span className="k">{title}</span>
      <table className="mini">
        <thead>
          <tr><th>ID</th><th>Region</th><th>Category</th><th>User</th><th>Amount</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}><td>{r.id}</td><td>{r.region}</td><td>{r.category}</td><td>{r.user}</td><td>{r.amount}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const MemoDataTable = memo(DataTable);

export function Feed({ name, title, items }: { name: string; title: string; items: string[] }) {
  useRenderCounter(name);
  return (
    <div className="dash-card">
      <span className="k">{title}</span>
      <ul className="feed">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  );
}

export const MemoFeed = memo(Feed);

export function UserCard({ name, user, total, orders }: { name: string; user: string; total: number; orders: number }) {
  useRenderCounter(name);
  return (
    <div className="dash-card">
      <span className="k">{user}</span>
      <span className="v small">₹{Math.round(total).toLocaleString()}</span>
      <span className="hint">{orders} orders</span>
    </div>
  );
}

export const MemoUserCard = memo(UserCard);

export function SidePanel({ name, title, lines }: { name: string; title: string; lines: string[] }) {
  useRenderCounter(name);
  return (
    <div className="dash-card">
      <span className="k">{title}</span>
      <ul className="feed">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </div>
  );
}

export const MemoSidePanel = memo(SidePanel);
