# Frontend Stress Test

## Why I Built This

"Can we render a million rows?" is the wrong question until you know what
breaks, when, and what you trade away at each step. I built this lab as a
scaling ladder: same dataset, five strategies, one comparison table — so the
answer becomes "DOM to ~100K, virtualization to ~500K, canvas beyond that, and
here are my numbers".

## The Problem

- Raw DOM rendering collapses somewhere between 100K and 500K rows (millions
  of nodes, multi-second commits, scroll jank).
- Each fix (memo, virtualization, worker, canvas) solves a *different* limit,
  and teams often apply the wrong one.

## Initial Hypothesis

Hypothesis: no single strategy wins everywhere. Raw DOM is fine at 10K;
virtualization removes the DOM limit but keeps data-processing cost;
memoization trims re-renders but not node count; workers free the thread but
not layout; canvas removes per-item cost at the price of DOM semantics.

## How I Measured It

- Real DOM row counts (`querySelectorAll`), `performance.mark()/measure()`
  around filter/sort, canvas draw timing, JS heap where available.
- A comparison table accumulates one row per measured stage × dataset.
- Chrome Performance traces for reload/scroll/sort per stage; React Profiler
  for raw-vs-memo row clicks.

## What I Found

The limits separate cleanly: node count gates raw/memo stages (hence the
consent gate above 100K DOM rows), compute cost gates all main-thread stages,
and canvas draws 500K points in milliseconds while giving up selection,
semantics, and accessibility of individual rows.

## Baseline Architecture

```
Stage 1 Raw DOM:      dataset → naive 5-pass filter/sort → N <tr> × 10 <td>
Stage 2 Memoized:     same DOM + memo rows + single-pass pipeline
Stage 3 Virtualized:  same pipeline, ~35 <tr> window + spacer rows
Stage 4 Worker:       pipeline in dataWorker.ts, virtualized+memo render
Stage 5 Canvas:       same rows → salary/score scatter, 1 <canvas>
```

## Why the Baseline Is Slow

Stage 1 pays three compounding costs: O(N) DOM nodes (layout/paint per frame),
O(passes × N) allocations in the naive pipeline, and full-tree React commits on
any state change. Each later stage removes exactly one of these.

## Optimization

### Memoized React components (stage 2)

**What changed:** `MemoRow` + stable callbacks + single-pass pipeline.
**Why it helps:** selection/typing skip untouched rows; filtering allocates less.
**Tradeoff:** node count unchanged — 100K rows is still 100K rows.
**Verified:** Profiler row-click: 100K commits → ~2.

### Virtualized DOM (stage 3)

**What changed:** windowed `<tbody>` with spacer rows; same naive pipeline kept
deliberately to isolate the DOM variable.
**Why it helps:** layout/paint cost becomes O(viewport).
**Tradeoff:** breaks find-in-page, needs fixed row geometry, scroll-linked effects.
**Verified:** DOM rows 100,000 → ~35; filter ms unchanged (expected).

### Web Worker processing (stage 4)

**What changed:** filter/sort in `workers/dataWorker.ts` via postMessage.
**Why it helps:** main thread stays responsive during heavy queries.
**Tradeoff:** clone cost, async results, no DOM access.
**Verified:** heartbeat-equivalent responsiveness; worker ms reported separately.

### Canvas rendering (stage 5)

**What changed:** rows plotted as 2px rects, salary × score, on one canvas.
**Why it helps:** per-item DOM cost goes to zero; 500K points draw in milliseconds.
**Tradeoff:** no per-row semantics/selection/a11y; custom hit-testing if needed.
**Verified:** element count = 1 at every dataset size; draw ms in the panel.

(WebGL deliberately omitted: canvas already covers the dense-2D case; see
production notes.)

## Before vs After

| Metric | Before | After |
|---|---|---|
| DOM rows @100K (raw → virtualized) | TBD | TBD |
| Sort ms @100K (naive → single-pass) | TBD | TBD |
| Row-click commits (raw → memo) | TBD | TBD |
| Canvas draw ms @500K | — | TBD |

## How to test

DevTools tests: **A** reload with Performance recording · **B** record +
rapid scroll · **C** record + Apply search · **D** record + Sort button.
Click any row to test selection.

## How to Reproduce

1. Open `/stress-test` (defaults: 100K virtualized — safe).
2. Walk stages 1→5 at 100K, running Apply search + Sort in each.
3. Raise to 250K/500K; read the consent gate on raw/memo stages.
4. Fill the comparison table from your runs.

## Chrome DevTools Recording

Per stage: reload trace (commit + nodes), rapid-scroll trace (layout/paint),
sort trace (scripting). Keep dataset size constant across stages for valid
comparisons; CPU 4x slowdown recommended.

## Things I Would Consider in Production

- Pagination or server-side search before any client heroics at 500K+.
- Row heights: virtualization needs measurement strategies for dynamic rows.
- Canvas needs keyboard/a11y equivalents for anything interactive.
- WebGL only when point counts truly exceed canvas (millions, shaders).
- Device matrix: low-end Android behaves nothing like a dev laptop.

## What I Learned

1. Scale questions are strategy questions — match the tool to the limit.
2. Isolate one variable per stage or the comparison means nothing.
3. Consent gates beat crashed tabs in demos and in production.
4. Canvas trades semantics for scale — price it explicitly.
5. The comparison table is the deliverable, not the demo.

## Key Takeaway

> Rendering less beats rendering faster — until semantics matter more than scale.
