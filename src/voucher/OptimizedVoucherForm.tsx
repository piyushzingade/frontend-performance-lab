import { useEffect, useRef, useState } from 'react';
import { validateLedger } from '../api/ledgerApi';
import { ValidationStatus, VoucherDebugPanel, SavedVouchers, type ValidationStatus as Status, type SavedVoucher } from './components';
import { SuggestionDropdown, useLedgerSuggest } from './LedgerSuggest';
import { useFastTypist } from './useFastTypist';

const DEBOUNCE_MS = 250;

type LocalErrors = {
  date?: string;
  ledger?: string;
  amount?: string;
};

/**
 * OPTIMIZED voucher form — production-quality:
 * - local validation runs synchronously (required, numeric amount > 0, valid date)
 * - ledger validation is debounced (~250ms), previous in-flight request is
 *   aborted AND guarded by a request id, successful results are cached
 * - input value and validation state are separate; typing never blocks
 * - Enter moves through date → ledger → type → amount → narration → save
 * - save waits for pending validation, re-checks authoritatively, resets +
 *   refocuses the first field; invalid save focuses the first invalid field
 */
export function OptimizedVoucherForm() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ledger, setLedger] = useState('');
  const [dcType, setDcType] = useState('debit');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');

  const [status, setStatus] = useState<Status>('idle');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const [requests, setRequests] = useState(0);
  const [cancelled, setCancelled] = useState(0);
  const [cacheHits, setCacheHits] = useState(0);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [saved, setSaved] = useState<SavedVoucher[]>([]);

  const dateRef = useRef<HTMLInputElement>(null);
  const ledgerRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLSelectElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const narrationRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);

  const cacheRef = useRef(new Map<string, boolean>());
  const reqIdRef = useRef(0);
  const nextNo = useRef(1);
  const abortRef = useRef<AbortController | null>(null);
  const pendingRef = useRef<Promise<boolean> | null>(null);
  const settledRef = useRef(true);

  // ---- async ledger validation: debounce + cancel + cache + staleness guard ----
  useEffect(() => {
    const value = ledger.trim();
    // A new keystroke invalidates whatever is in flight — abort it first.
    if (abortRef.current && !settledRef.current) {
      abortRef.current.abort();
      setCancelled((n) => n + 1);
    }
    if (!value) {
      setStatus('idle');
      pendingRef.current = null;
      settledRef.current = true;
      return;
    }
    const key = value.toLowerCase();
    const cached = cacheRef.current.get(key);
    if (cached !== undefined) {
      setStatus(cached ? 'valid' : 'invalid');
      setCacheHits((n) => n + 1);
      pendingRef.current = Promise.resolve(cached);
      settledRef.current = true;
      return;
    }
    setStatus('checking');
    settledRef.current = false;
    const timer = window.setTimeout(() => {
      const id = ++reqIdRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      setRequests((n) => n + 1);
      const t0 = performance.now();
      const p = validateLedger(value, controller.signal).then(
        (res) => {
          settledRef.current = true;
          if (id !== reqIdRef.current) return false; // stale — never overwrite
          cacheRef.current.set(key, res.valid);
          setLastMs(performance.now() - t0);
          setStatus(res.valid ? 'valid' : 'invalid');
          return res.valid;
        },
        (err) => {
          settledRef.current = true;
          if (err?.name === 'AbortError' || id !== reqIdRef.current) return false;
          setStatus('error');
          return false;
        },
      );
      pendingRef.current = p;
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [ledger]);

  // ---- synchronous local validation (never touches the network) ----
  const localErrors = (): LocalErrors => {
    const e: LocalErrors = {};
    if (!date || Number.isNaN(Date.parse(date))) e.date = 'Enter a valid date.';
    if (!ledger.trim()) e.ledger = 'Ledger is required.';
    if (!amount.trim()) e.amount = 'Amount is required.';
    else if (Number.isNaN(Number(amount))) e.amount = 'Amount must be numeric.';
    else if (Number(amount) <= 0) e.amount = 'Amount must be greater than zero.';
    return e;
  };
  const errors = localErrors();
  const show = (field: string) => touched[field] && errors[field as keyof LocalErrors];

  const focusField = (field: 'date' | 'ledger' | 'amount') => {
    ({ date: dateRef, ledger: ledgerRef, amount: amountRef })[field].current?.focus();
  };

  const enterNext =
    (next: React.RefObject<HTMLInputElement | HTMLSelectElement | HTMLButtonElement | null>) =>
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        (next.current as HTMLElement | null)?.focus();
      }
    };

  const { typing, simulate } = useFastTypist((text) => {
    setLedger(text);
    setTouched((t) => ({ ...t, ledger: true }));
  });

  const suggest = useLedgerSuggest(ledger, (v) => {
    setLedger(v);
    setTouched((t) => ({ ...t, ledger: true }));
  });

  // ---- save: local checks → settle pending ledger validation → authoritative
  // backend check → reset + refocus. Invalid save focuses first invalid field. ----
  const handleSave = async () => {
    if (saving) return;
    setTouched({ date: true, ledger: true, amount: true });
    setMessage('');
    const errs = localErrors();
    if (errs.date) {
      focusField('date');
      return;
    }
    if (errs.ledger) {
      focusField('ledger');
      return;
    }
    if (errs.amount) {
      focusField('amount');
      return;
    }
    setSaving(true);
    try {
      // If a debounced validation is still pending, wait for the LATEST one.
      if (pendingRef.current && !settledRef.current) {
        setMessage('Waiting for ledger validation…');
        await pendingRef.current;
      }
      // Authoritative backend re-check at save time (bypasses cache).
      const t0 = performance.now();
      const res = await validateLedger(ledger.trim());
      setRequests((n) => n + 1);
      setLastMs(performance.now() - t0);
      if (!res.valid) {
        cacheRef.current.set(ledger.trim().toLowerCase(), false);
        setStatus('invalid');
        setMessage(`"${ledger.trim()}" is not a known ledger.`);
        focusField('ledger');
        return;
      }
      cacheRef.current.set(ledger.trim().toLowerCase(), true);
      setStatus('valid');
      setMessage('Saving…');
      await new Promise((r) => window.setTimeout(r, 350));
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
          (v.narration ? ` · "${v.narration}"` : '') +
          '. Ready for the next one.',
      );
      setLedger('');
      setAmount('');
      setNarration('');
      setStatus('idle');
      setTouched({});
      dateRef.current?.focus();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="voucher-grid">
        <label>
          Voucher Date
          <input
            ref={dateRef}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onKeyDown={enterNext(ledgerRef)}
          />
          {show('date') && <span className="field-error">{errors.date}</span>}
        </label>
        <label>
          Ledger Account
          <div className="ledger-row">
            <div className="ledger-wrap">
              <input
                ref={ledgerRef}
                value={ledger}
                onChange={(e) => setLedger(e.target.value)}
                onFocus={() => suggest.setOpen(true)}
                onBlur={() => {
                  suggest.setOpen(false);
                  setTouched((t) => ({ ...t, ledger: true }));
                }}
                onKeyDown={(e) => {
                  if (suggest.handleKey(e)) return; // suggestion nav/selection wins
                  enterNext(typeRef)(e); // plain Enter still walks the form
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
          {show('ledger') && <span className="field-error">{errors.ledger}</span>}
        </label>
        <label>
          Debit / Credit
          <select
            ref={typeRef}
            value={dcType}
            onChange={(e) => setDcType(e.target.value)}
            onKeyDown={enterNext(amountRef)}
          >
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
        </label>
        <label>
          Amount
          <input
            ref={amountRef}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
            onKeyDown={enterNext(narrationRef)}
            placeholder="0.00"
            inputMode="decimal"
          />
          {show('amount') && <span className="field-error">{errors.amount}</span>}
        </label>
        <label className="span-2">
          Narration
          <input
            ref={narrationRef}
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            onKeyDown={enterNext(saveRef)}
            placeholder="Being…"
          />
        </label>
      </div>
      <div className="voucher-actions">
        <button onClick={simulate} disabled={typing}>
          {typing ? 'Typing…' : 'Simulate Fast Typist'}
        </button>
        <button ref={saveRef} className="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Voucher'}
        </button>
      </div>
      {message && <p className="voucher-message">{message}</p>}
      <SavedVouchers items={saved} />
      <VoucherDebugPanel
        mode="Optimized"
        stats={{ requests, cancelled, cacheHits, status, lastMs }}
      />
    </div>
  );
}
