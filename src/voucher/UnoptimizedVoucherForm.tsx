import { useRef, useState } from 'react';
import { validateLedger } from '../api/ledgerApi';
import {
  SavedVouchers,
  ValidationStatus,
  VoucherDebugPanel,
  type SavedVoucher,
  type ValidationStatus as Status,
} from './components';
import { SuggestionDropdown, useLedgerSuggest } from './LedgerSuggest';
import { useFastTypist } from './useFastTypist';

/**
 * UNOPTIMIZED voucher form — intentionally bad, but honest:
 * - one API request per keystroke (no debounce)
 * - previous requests never cancelled, no request ids → stale responses
 *   can overwrite newer results (watch the status flicker with fast typing)
 * - no cache: re-validating a known ledger costs a full round trip
 * - no Enter-to-next-field, no focus restore after save
 */
export function UnoptimizedVoucherForm() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ledger, setLedger] = useState('');
  const [dcType, setDcType] = useState('debit');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [requests, setRequests] = useState(0);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState<SavedVoucher[]>([]);
  const nextNo = useRef(1);

  // Fires on EVERY keystroke. No debounce, no AbortController, no cache,
  // no staleness guard — whichever response lands last wins, even if it
  // belongs to an older keystroke.
  const handleLedgerChange = (value: string) => {
    setLedger(value);
    setMessage('');
    if (!value.trim()) {
      setStatus('idle');
      return;
    }
    setRequests((n) => n + 1);
    setStatus('checking');
    const t0 = performance.now();
    validateLedger(value).then(
      (res) => {
        setLastMs(performance.now() - t0);
        setStatus(res.valid ? 'valid' : 'invalid');
      },
      () => setStatus('error'),
    );
  };

  const { typing, simulate } = useFastTypist(handleLedgerChange);

  const suggest = useLedgerSuggest(ledger, handleLedgerChange);

  const handleSave = () => {
    // Basic inline checks only — errors interrupt flow, focus is left wherever it was.
    if (!date || !ledger.trim() || !amount.trim()) {
      setMessage('Please fill date, ledger and amount.');
      return;
    }
    if (Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      setMessage('Amount must be a number greater than zero.');
      return;
    }
    if (status !== 'valid') {
      setMessage('Ledger is not validated yet. Wait for validation, then save again.');
      return;
    }
    setMessage('Saving…');
    window.setTimeout(() => {
      // No field reset, no focus restore — the accountant reaches for the mouse.
      const v: SavedVoucher = {
        no: nextNo.current++,
        date,
        ledger: ledger.trim(),
        dcType,
        amount: amount.trim(),
        narration: narration.trim(),
      };
      setSaved((prev) => [...prev, v]);
      setMessage(
        `Voucher #${v.no} saved — ${v.date} · ${v.ledger} · ${v.dcType} ${v.amount}` +
          (v.narration ? ` · "${v.narration}"` : ''),
      );
    }, 500);
  };

  return (
    <div>
      <div className="voucher-grid">
        <label>
          Voucher Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Ledger Account
          <div className="ledger-row">
            <div className="ledger-wrap">
              <input
                value={ledger}
                onChange={(e) => handleLedgerChange(e.target.value)}
                onFocus={() => suggest.setOpen(true)}
                onBlur={() => suggest.setOpen(false)}
                onKeyDown={(e) => {
                  suggest.handleKey(e);
                }}
                placeholder="Type a ledger name…"
                autoComplete="off"
                role="combobox"
                aria-expanded={suggest.show}
                aria-autocomplete="list"
              />
              {suggest.show && (
                <SuggestionDropdown
                  matches={suggest.matches}
                  hi={suggest.hi}
                  onPick={suggest.pick}
                  onHover={suggest.setHi}
                />
              )}
            </div>
            <ValidationStatus status={status} />
          </div>
        </label>
        <label>
          Debit / Credit
          <select value={dcType} onChange={(e) => setDcType(e.target.value)}>
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
        </label>
        <label>
          Amount
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" />
        </label>
        <label className="span-2">
          Narration
          <input value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Being…" />
        </label>
      </div>
      <div className="voucher-actions">
        <button onClick={simulate} disabled={typing}>
          {typing ? 'Typing…' : 'Simulate Fast Typist'}
        </button>
        <button className="primary" onClick={handleSave}>
          Save Voucher
        </button>
      </div>
      {message && <p className="voucher-message">{message}</p>}
      <SavedVouchers items={saved} />
      <VoucherDebugPanel
        mode="Unoptimized"
        stats={{ requests, cancelled: 0, cacheHits: 0, status, lastMs }}
      />
    </div>
  );
}
