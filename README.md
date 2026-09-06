# Frontend Performance Lab — 100K Rows

> "This is a frontend performance experiment comparing different strategies for
> rendering and processing 100,000 rows."

## 1. What this demonstrates

A single-page React app renders **exactly 100,000 deterministic rows** four ways —
**Baseline → Virtualized → Optimized → Worker** — so Chrome DevTools Performance
traces show the before/after of each optimization. The story:

```
100K rows → slow baseline → profile → virtualize → memoize → worker → measure again
```

## 2. Baseline architecture

- `src/data/generateData.ts` — seeded PRNG (mulberry32, seed 42), same dataset every load.
- `src/experiments/process.ts → baselineProcess()` — intentionally naive but honest work:
  filter → map(spread) → filter → map(spread) → query filter with per-row
  `toLowerCase()` → sort with `localeCompare` → throwaway derived-value pass.
- `src/components/Table.tsx → FullTable` — renders **all** matched rows as real `<tr>`s
  (up to 100k rows × 10 cells ≈ 1M DOM nodes). No CSS hiding tricks.
- `PlainRow` — non-memoized; any state change (e.g. row selection) re-renders every row.
- No `setTimeout`, no fake delays. The bottleneck is real DOM + real CPU work.

## 3. Bottlenecks discovered

Profile the baseline and look for (your machine's numbers will differ):

1. **Initial render** — 1M+ DOM nodes: long scripting + rendering + layout.
2. **Scroll** — the browser must lay out / paint a gigantic document on every frame.
3. **Filter/sort** — 5 passes over 100k rows with per-row allocations and lowercasing.
4. **Row selection** — one click re-renders all 100k rows (no memoization).

## 4. Optimization techniques

| Mode | What changed | File |
|---|---|---|
| Virtualized | Renders only the visible window (~16 rows + 20 overscan); spacer div preserves scroll height of all 100k | `Table.tsx → VirtualizedTable` |
| Optimized | + `React.memo` rows with stable `onSelect` (`useCallback`); single-pass filter over a precomputed lowercase `_search` index; cheap comparators | `TableRow.tsx → MemoRow`, `optimizedProcess()` |
| Worker | + filter/sort moved to a Web Worker via `postMessage`; UI thread only renders | `workers/dataWorker.ts` |

`useMemo`/`useCallback` are used only where they fix a measured problem (stable row
props, one-time dataset/index creation) — not sprayed everywhere.

## 5. How to reproduce

```bash
npm install
npm run dev   # open http://localhost:5173
```

1. Load the page in **Baseline** mode (renders all 100k rows).
2. Switch modes with the four buttons; dataset and controls stay identical.
3. Use **Apply search / filter**, **Sort by salary/score**, department/status selects,
   and row clicks as the profileable actions.
4. Read real timings in the **Performance Metrics** panel (every value comes from
   `performance.mark()`/`measure()` — nothing is hardcoded).

## 6. Chrome DevTools recording instructions

- **Test A — Initial load:** DevTools → Performance → Record → reload page → Stop.
- **Test B — Scroll:** Record → rapidly scroll the table → Stop. (Baseline: jank;
  virtualized modes: smooth, ~35 DOM rows.)
- **Test C — Filtering:** Record → type a query → **Apply search / filter** → Stop.
- **Test D — Sorting:** Record → **Sort by salary** → Stop.
- **Selection:** Record → click a row → Stop. Compare baseline (100k rows re-render)
  vs. optimized (one row) using the React DevTools Profiler ("Highlight updates").

Tip: throttle CPU (Performance → CPU: 4x slowdown) to exaggerate main-thread work.

## 7. Before/after measurements

Fill these in from YOUR traces. Never invent numbers.

```
Baseline:
- DOM nodes (<tr> count): TBD
- Longest task (initial load): TBD
- Filter+sort (full dataset): TBD ms
- Sort by salary: TBD ms
- Row selection commit: TBD ms

Virtualized:
- DOM rows: TBD (~viewport + overscan)
- Longest task (initial load): TBD
- Scroll fps / long tasks: TBD

Optimized:
- DOM rows: TBD
- Filter+sort: TBD ms
- Row selection (re-rendered rows per Profiler): TBD

Worker:
- Worker filter+sort (off-thread): TBD ms
- Main-thread blocked during filter: TBD ms
- INP / responsiveness during filter: TBD
```

## 8. What each optimization actually changed

- **Virtualization** removed the DOM bottleneck (~1M nodes → ~35 rows) but kept the
  naive data pipeline — filtering/sorting still costs the same. Scroll and initial
  render improve; data processing does not.
- **Memoization** removed the React re-render bottleneck — selection and unrelated
  state updates skip untouched rows. Data pipeline still runs on the main thread.
- **Single-pass filter + search index** removed the repeated-work bottleneck —
  one loop, no per-row `toLowerCase()`, no throwaway allocations, cheap comparator.
- **Web Worker** removed the main-thread blocking — the same single-pass work runs
  off-thread, so input/animation stay responsive. Cost: `postMessage`
  structured-clone + async result handling.

## Project structure

```
src/
  components/   Controls.tsx  PerformancePanel.tsx  Table.tsx  TableRow.tsx
  data/         generateData.ts
  experiments/  process.ts        (baselineProcess, optimizedProcess)
  hooks/        usePerformanceMeasure.ts
  workers/      dataWorker.ts
  api/          ledgerApi.ts      (mock ledger validation, 300–1000ms)
  voucher/      VoucherDemo.tsx  UnoptimizedVoucherForm.tsx
                OptimizedVoucherForm.tsx  components.tsx  useFastTypist.ts
  App.tsx  main.tsx  index.css
```

## 9. Voucher entry demo (`/form`)

A second experiment on the same theme, but for **input latency** instead of render
cost: the same voucher form (date → ledger → debit/credit → amount → narration →
save) implemented twice, toggled via **[ Unoptimized ] [ Optimized ]**.

- **Unoptimized** (`voucher/UnoptimizedVoucherForm.tsx`): one API request per
  keystroke, no debounce, no cancellation, no request ids (stale responses
  overwrite fresh ones — watch the status flicker), no cache, no Enter-to-next,
  no focus restore after save. Debug panel shows requests climbing, cancelled = 0,
  cache hits = 0.
- **Optimized** (`voucher/OptimizedVoucherForm.tsx`): local validation runs
  synchronously; ledger validation is debounced ~250ms, in-flight requests are
  aborted via `AbortController` + guarded by request id, successful results are
  cached in a `Map`. Enter walks the form, save awaits pending validation,
  re-checks authoritatively, resets and refocuses the date field; invalid save
  focuses the first invalid field.
- **Mock API** (`api/ledgerApi.ts`): `validateLedger(name, signal?)` with random
  300–1000ms latency and real abort semantics.
- **Simulate Fast Typist** (`voucher/useFastTypist.ts`): types "Sales Account"
  at ~60–100ms/char through each form's real change path. Unoptimized fires ~13
  requests with out-of-order landings; optimized fires ~1–2.
- No Tailwind in this repo, so the demo reuses the lab's minimal CSS.
