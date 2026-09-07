# Voucher Entry Demo (Wajo) — Optimized Implementation

## A. Problem Statement

In the Wajo voucher-entry flow, an accountant types a **Ledger Account** name
into a text box. Two things go wrong with a naive implementation:

1. **Spelling mistakes select nothing.** If the typist enters "Salse" instead of
   "Sales", or "Cast Account" instead of "Cash Account", the field just says
   *Invalid Ledger*. The accountant must stop, recall the exact master name,
   delete, and retype — with a mouse round-trip each time.
2. **Live validation lags behind the typist.** Every keystroke fires a ledger
   validation request (300–1000 ms each). Responses land out of order, so the
   status can settle on a verdict for text that was already deleted. Typing
   feels sticky and untrustworthy.

The requirement: the typist sees **related ledger names as they type**, picks
one with **keyboard or mouse**, keeps typing at full speed without validation
interference, and completes the whole voucher without touching the mouse.

## B. Goals (Optimized Build Only)

- Typo-tolerant suggestions: partial and misspelled input shows matching ledgers.
- Select a suggestion via Arrow keys + Enter, or mouse hover + click.
- Ledger validation is debounced, cancellable, cached, and never blocks typing.
- Local validation (required, numeric amount > 0, valid date) is instant.
- Enter walks the form; save resets the form and refocuses the first field.
- Every number in the debug panel is a real counter, not a constant.

## C. File Map

| File | Responsibility |
| --- | --- |
| `src/api/ledgerApi.ts` | Mock ledger master + `validateLedger(name, signal?)` with 300–1000 ms latency and real `AbortSignal` support |
| `src/voucher/suggest.ts` | Typo-tolerant matcher: `suggestLedgers()`, `isExactLedger()` |
| `src/voucher/LedgerSuggest.tsx` | `useLedgerSuggest()` hook (dropdown state, keyboard) + `SuggestionDropdown` (listbox UI) |
| `src/voucher/OptimizedVoucherForm.tsx` | The optimized form: validation pipeline, focus graph, save flow |
| `src/voucher/components.tsx` | `ValidationStatus` badge, `VoucherDebugPanel` counters, `SavedVouchers` list |
| `src/voucher/useFastTypist.ts` | "Simulate Fast Typist" driver (types "Sales Account" at ~60–100 ms/char) |
| `src/voucher/VoucherDemo.tsx` | Mode shell (renders this form in Optimized mode) |

## D. How I Solved It — Suggestions

**Matching (`suggest.ts`).** For a non-empty, non-exact query, every master
ledger is scored in three tiers: prefix match first (`Sal` → Sales Account),
then substring (`suppler` → XYZ Suppliers), then typo match — edit (Levenshtein)
distance computed per word with tolerance 1–2 (`Salse` → Sales Account,
`Cast Account` → Cash Account). Results are sorted by score and capped at 6.
Empty or already-exact input returns nothing: there is nothing to suggest.

**Dropdown (`LedgerSuggest.tsx`).** `useLedgerSuggest(value, apply)` owns
`open`, highlight index, and ranked matches (memoized per value). The hook
exposes `handleKey(e)`, which consumes ArrowUp/ArrowDown/Escape and
Enter-when-a-suggestion-is-shown, returning `true` when it handled the key.
Anything it does not consume (plain Enter with no dropdown) falls through to
the form's own Enter-to-next-field behavior — so autocomplete and form
navigation share one key without fighting.

**Selection paths.** Mouse: hover highlights, `onMouseDown` (not `onClick`)
picks the ledger *before* input blur can close the list. Keyboard: Enter picks
the highlighted row. Both paths call the same `pick()` → the form's normal
ledger setter, so picking flows through validation, caching, and touched-state
exactly as if the name had been typed. The input carries
`role="combobox"` + `aria-expanded` + `aria-autocomplete="list"` and the list
uses `listbox`/`option` roles.

**Why local, not network.** Suggestions are computed from the in-memory master
list at zero latency. "Did you mean…?" must never cost a round trip.

## E. How I Solved It — Validation Pipeline

Validation is split into two buckets that never mix:

1. **Local (synchronous).** `localErrors()` checks required fields, numeric
   amount, amount > 0, and a parseable date on every render. Cost: ~zero.
   Errors render inline only after blur or save (`touched` map), so nothing
   interrupts typing.
2. **Ledger (asynchronous).** A `useEffect` on the ledger value runs this
   sequence per change:
   - Abort any in-flight request (`AbortController`) and count the cancellation.
   - Empty → `idle`. Cache hit (`Map`, lowercased key) → verdict applied
     synchronously + cache-hit counter. Both valid *and* invalid verdicts are
     cached.
   - Otherwise → status `checking`, 250 ms debounce, then fire with a fresh
     controller and an incrementing request id. On response, apply it **only
     if the id is still the latest** — a stale verdict can never overwrite a
     fresh one.
   - Input value (`ledger`) and verdict (`status`) are separate state. Typing
     only ever calls `setLedger`: it cannot be blocked by validation.

## F. How I Solved It — Focus Management

- One ref per field; `enterNext(ref)` moves focus on Enter through
  date → ledger → type → amount → narration → Save.
- If the suggestion dropdown is open, Enter selects instead of advancing
  (hook consumes the key first).
- Validation errors never steal focus while typing. Focus moves exactly once:
  on invalid save, to the first invalid field in form order.
- Successful save clears ledger/amount/narration, keeps the date (same-day
  vouchers), and focuses Voucher Date — the next voucher starts with zero mouse.

## G. How I Solved It — Save Flow

1. Mark all fields touched; run local checks. First offender gets focus, save stops.
2. If ledger validation is still pending, **await the latest pending promise**
   instead of failing with "try again".
3. Run one **authoritative backend re-check** that bypasses the cache, so even
   a poisoned cache entry cannot save a bad voucher. Invalid → focus ledger.
4. Commit: append `{no, date, ledger, dcType, amount, narration}` to the
   `SavedVouchers` list, show a confirmation naming all of them, reset, refocus.

## H. Debug Proof (All Real Counters)

The debug panel shows API requests made, requests cancelled, cache hits,
current validation status, and last response time. Expected behavior:

- Type normally with pauses → ~1 request per pause.
- Type fast or run **Simulate Fast Typist** → several requests fired, earlier
  ones cancelled, final status correct, typing smooth.
- Re-enter a known ledger → cache hit, zero requests, instant verdict.
- Save mid-validation → save waits, re-checks authoritatively, then commits.

## I. How to Demo It (60 Seconds)

1. Open `/form`, Optimized mode. Type `Salse` — the dropdown offers
   Sales Account. Arrow-down + Enter to pick it with the keyboard.
2. Click **Simulate Fast Typist**. Watch: ~1 request, status goes
   Checking → Valid once, cancelled counter may rise, typing never stutters.
3. Clear, type a valid ledger again → instant valid via cache hit.
4. Fill amount + narration, press Enter through the fields, Enter on Save.
   Voucher appears in Saved Vouchers with date, amount, narration — focus is
   already back on Voucher Date.

## J. Tradeoffs I Accepted

- Debounce adds ~250 ms before validation starts; correctness and load win.
- Cache never expires in this demo — production needs TTL or version keys.
- Aborted requests still consumed server time; cancellation saves the client,
  not the server.
- Keeping the date across saves assumes same-day batches; a day-boundary
  check would be needed in production.

## K. Key Takeaway

> Treat keystrokes as drafts, not emergencies: suggest locally, validate after
> a pause, cancel what's obsolete, remember what's known — and never let an old
> answer overwrite a new one.
