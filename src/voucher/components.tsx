export type ValidationStatus = 'idle' | 'checking' | 'valid' | 'invalid' | 'error';

export function ValidationStatus({ status }: { status: ValidationStatus }) {
  const label =
    status === 'idle'
      ? '—'
      : status === 'checking'
        ? 'Checking…'
        : status === 'valid'
          ? 'Valid Ledger'
          : status === 'invalid'
            ? 'Invalid Ledger'
            : 'Validation error';
  return (
    <span className={`vstatus vstatus-${status}`} role="status">
      {label}
    </span>
  );
}

export type SavedVoucher = {
  no: number;
  date: string;
  ledger: string;
  dcType: string;
  amount: string;
  narration: string;
};

export function SavedVouchers({ items }: { items: SavedVoucher[] }) {
  if (items.length === 0) return null;
  return (
    <section className="metrics" aria-label="Saved vouchers">
      <h2>Saved Vouchers ({items.length})</h2>
      <div className="table-scroll saved-list">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Date</th>
              <th>Ledger</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Narration</th>
            </tr>
          </thead>
          <tbody>
            {items.map((v) => (
              <tr key={v.no}>
                <td>{v.no}</td>
                <td>{v.date}</td>
                <td>{v.ledger}</td>
                <td>{v.dcType}</td>
                <td>{v.amount}</td>
                <td>{v.narration || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export type DebugStats = {
  requests: number;
  cancelled: number;
  cacheHits: number;
  status: string;
  lastMs: number | null;
};

export function VoucherDebugPanel({ mode, stats }: { mode: string; stats: DebugStats }) {
  return (
    <section className="metrics" aria-label="Voucher debug panel">
      <h2>Debug Panel</h2>
      <div className="metric-grid">
        <div className="metric">
          <span className="k">Current mode</span>
          <span className="v">{mode}</span>
        </div>
        <div className="metric">
          <span className="k">API requests made</span>
          <span className="v">{stats.requests}</span>
        </div>
        <div className="metric">
          <span className="k">Requests cancelled</span>
          <span className="v">{stats.cancelled}</span>
        </div>
        <div className="metric">
          <span className="k">Cache hits</span>
          <span className="v">{stats.cacheHits}</span>
        </div>
        <div className="metric">
          <span className="k">Validation status</span>
          <span className="v">{stats.status}</span>
        </div>
        <div className="metric">
          <span className="k">Last response time</span>
          <span className="v">{stats.lastMs === null ? '—' : `${Math.round(stats.lastMs)} ms`}</span>
        </div>
      </div>
    </section>
  );
}
