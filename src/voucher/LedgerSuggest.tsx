import { useEffect, useMemo, useState } from 'react';
import { isExactLedger, suggestLedgers } from './suggest';

export const SUGGEST_LIST_ID = 'ledger-suggest';

/**
 * Shared autocomplete state for the ledger field (used by BOTH forms —
 * suggestions are a UX feature, not one of the optimization variables).
 *
 * `handleKey` consumes ArrowUp/Down/Escape and Enter-when-selecting,
 * returning true when it handled the key. Anything it doesn't consume
 * (e.g. plain Enter with no dropdown) falls through to the form's own
 * Enter behavior — which is why both forms can share this hook despite
 * having different Enter semantics.
 */
export function useLedgerSuggest(value: string, apply: (v: string) => void) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const matches = useMemo(() => suggestLedgers(value), [value]);
  const show = open && matches.length > 0 && !isExactLedger(value);

  useEffect(() => setHi(0), [matches]);

  // Keep the keyboard-highlighted option visible AND announced: without this,
  // arrowing past the fold moves a highlight nobody can see or hear.
  const activeId = show ? `${SUGGEST_LIST_ID}-opt-${hi}` : undefined;
  useEffect(() => {
    if (!show) return;
    document.getElementById(activeId ?? '')?.scrollIntoView({ block: 'nearest' });
  }, [show, activeId]);

  const pick = (name: string) => {
    apply(name);
    setOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent): boolean => {
    if (e.key === 'ArrowDown' && show) {
      e.preventDefault();
      setHi((h) => (h + 1) % matches.length);
      return true;
    }
    if (e.key === 'ArrowUp' && show) {
      e.preventDefault();
      setHi((h) => (h - 1 + matches.length) % matches.length);
      return true;
    }
    if (e.key === 'Escape' && show) {
      e.preventDefault();
      setOpen(false);
      return true;
    }
    if (e.key === 'Enter' && show) {
      e.preventDefault();
      pick(matches[hi] ?? matches[0]);
      return true;
    }
    return false;
  };

  return { show, matches, hi, activeId, setHi, setOpen, pick, handleKey };
}

export function SuggestionDropdown({
  matches,
  hi,
  onPick,
  onHover,
}: {
  matches: string[];
  hi: number;
  onPick: (name: string) => void;
  onHover: (i: number) => void;
}) {
  return (
    <ul className="suggest" id={SUGGEST_LIST_ID} role="listbox" aria-label="Ledger suggestions">
      {matches.map((m, i) => (
        <li
          key={m}
          id={`${SUGGEST_LIST_ID}-opt-${i}`}
          role="option"
          aria-selected={i === hi}
          className={i === hi ? 'active' : ''}
          onMouseDown={(e) => {
            e.preventDefault(); // pick before input blur closes the list
            onPick(m);
          }}
          onMouseEnter={() => onHover(i)}
        >
          {m}
        </li>
      ))}
    </ul>
  );
}
