import { useState } from 'react';
import { OptimizedVoucherForm } from './OptimizedVoucherForm';
import { UnoptimizedVoucherForm } from './UnoptimizedVoucherForm';

type VoucherMode = 'unoptimized' | 'optimized';

function ModeSwitcher({ mode, onMode }: { mode: VoucherMode; onMode: (m: VoucherMode) => void }) {
  return (
    <div className="mode-row" role="tablist" aria-label="Voucher mode">
      <button
        role="tab"
        aria-selected={mode === 'unoptimized'}
        className={mode === 'unoptimized' ? 'active' : ''}
        onClick={() => onMode('unoptimized')}
      >
        Unoptimized Mode
      </button>
      <button
        role="tab"
        aria-selected={mode === 'optimized'}
        className={mode === 'optimized' ? 'active' : ''}
        onClick={() => onMode('optimized')}
      >
        Optimized Mode
      </button>
    </div>
  );
}

export function VoucherDemo() {
  const [mode, setMode] = useState<VoucherMode>('unoptimized');

  return (
    <div className="lab">
      <header>
        <h1>Voucher Entry Demo</h1>
        <p className="sub">
          Same accounting form, two implementations — input-latency edition.
        </p>
        <p className="dataset-line">
          Current mode: <b>{mode === 'unoptimized' ? 'Unoptimized' : 'Optimized'}</b>
          {' · '}Try the <b>Simulate Fast Typist</b> button in each mode and watch the debug panel.
        </p>
      </header>

      <div className="controls">
        <ModeSwitcher mode={mode} onMode={setMode} />
        <p className="hint">
          {mode === 'unoptimized'
            ? 'Every keystroke fires a request. Responses can land out of order and overwrite each other.'
            : 'Debounced + cancelled + cached validation. Enter walks the form, save resets and refocuses.'}
        </p>
      </div>

      {mode === 'unoptimized' ? <UnoptimizedVoucherForm /> : <OptimizedVoucherForm />}

      <footer>
        <span>Ledger latency is simulated (300–1000ms). All counters are real — nothing is hardcoded.</span>
      </footer>
    </div>
  );
}
