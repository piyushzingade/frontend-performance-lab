import { MOCK_LEDGERS } from '../api/ledgerApi';

/** Edit distance over short strings — cheap enough to run per keystroke. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let cur0 = i;
    let prevDiag = i - 1;
    for (let j = 1; j <= b.length; j++) {
      const prevUp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(prev[j] + 1, cur0 + 1, prevDiag + cost);
      prev[j - 1] = cur0;
      cur0 = next;
      prevDiag = prevUp;
    }
    prev[b.length] = cur0;
  }
  return prev[b.length];
}

export function isExactLedger(query: string): boolean {
  const q = query.trim().toLowerCase();
  return MOCK_LEDGERS.some((l) => l.toLowerCase() === q);
}

/**
 * Ranked ledger suggestions for a mistyped/partial query:
 *   prefix match → substring match → typo match (edit distance on words).
 * Returns [] for empty or already-exact queries (nothing to suggest).
 */
export function suggestLedgers(query: string, limit = 6): string[] {
  const q = query.trim().toLowerCase();
  if (!q || isExactLedger(query)) return [];
  const scored: { name: string; score: number }[] = [];
  for (const name of MOCK_LEDGERS) {
    const low = name.toLowerCase();
    if (low.startsWith(q)) {
      scored.push({ name, score: 0 });
    } else if (low.includes(q)) {
      scored.push({ name, score: 1 });
    } else {
      // Typo tolerance: compare against each word ("Salse" → "Sales").
      const words = low.split(/\s+/);
      const d = Math.min(...words.map((w) => levenshtein(q, w)));
      const tolerance = q.length <= 3 ? 1 : 2;
      if (d <= tolerance) scored.push({ name, score: 2 + d });
    }
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.name);
}
