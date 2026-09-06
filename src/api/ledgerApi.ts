/** Mock ledger "backend" for the voucher-entry demo. */

export const MOCK_LEDGERS = [
  'Sales Account',
  'Purchase Account',
  'Cash Account',
  'Bank Account',
  'ABC Traders',
  'XYZ Suppliers',
  'Salary Expense',
  'Office Expense',
];

export type LedgerResult = {
  valid: boolean;
  ledger: string;
  balance: number;
};

/** Deterministic pseudo-balance so repeated validations agree. */
function balanceFor(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % 900_000 + 10_000;
}

/**
 * Simulates `GET /api/ledgers/validate?name=...` with 300–1000ms latency.
 * Honors AbortSignal: aborts during the wait reject with AbortError and
 * never resolve afterwards — the optimized form relies on this.
 */
export function validateLedger(name: string, signal?: AbortSignal): Promise<LedgerResult> {
  const latency = 300 + Math.random() * 700;
  const query = name.trim().toLowerCase();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const match = MOCK_LEDGERS.find((l) => l.toLowerCase() === query);
      resolve({
        valid: match !== undefined,
        ledger: match ?? name.trim(),
        balance: match ? balanceFor(match) : 0,
      });
    }, latency);

    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}
