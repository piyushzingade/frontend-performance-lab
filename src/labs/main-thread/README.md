# Main Thread / Web Worker Lab

## Why I Built This

A dashboard search that scans 50k products feels "stuck" while it works — the
input freezes, hovers die, spinners stop spinning. Engineers often blame the
algorithm, but the algorithm is fine; the problem is *where* it runs. I built
this lab so the blocking is visible: a heartbeat animation that physically stops
is worth a thousand explanations of the event loop.

## The Problem

- Running filter → fuzzy search → sort → rank → aggregate over 10K–100K items
  freezes typing, hover, and animation for the whole duration.
- Users perceive a fast algorithm on the wrong thread as a broken page.

## Initial Hypothesis

Hypothesis, not conclusion: the UI freezes because the main thread is busy
computing, and moving the identical computation to a Worker will keep the page
responsive without necessarily finishing sooner.

## How I Measured It

- `performance.mark()/measure()` around the pipeline (real durations).
- Long Tasks API (`performance/longTasks.ts`) — count and max during the run.
- A rAF heartbeat dot: any inter-frame gap >120ms is recorded as a freeze with
  its real duration. Typing field as a human responsiveness probe.
- Chrome Performance trace to see the long task vs worker-thread work.

## What I Found

The pipeline itself is honest CPU work (subsequence fuzzy scoring per item plus a
full sort). On the main thread it appears as one giant long task; every rAF
callback, input event, and paint queues behind it. In the worker, the main thread
shows only `postMessage` + result handling.

## Baseline Architecture

```
UI thread: input → processItems(50k) [blocks everything] → render results
Heartbeat rAF ──✕ (starved)    typing events ──✕ (queued)
```

## Why the Baseline Is Slow

JavaScript is single-threaded per context: while `processItems` runs, the event
loop cannot process input, rAF, or rendering. No artificial delay is involved —
the freeze duration equals the genuine compute duration.

## Optimization

### Move the pipeline to a Web Worker

**What changed:** `MainThreadLab.tsx` + `worker.ts`; both import the same
`pipeline.ts`, so the computation is provably equivalent. Dataset generated once
per INIT; queries go over `postMessage`.
**Why it helps:** compute no longer competes with input/paint for main-thread time.
**Tradeoff:** structured-clone cost per message, async result handling, worker
lifecycle management, harder debugging.
**Verified:** heartbeat shows zero freezes in worker mode; long-task count stays
flat; worker-thread work visible in the Performance trace.

### Configurable dataset size

**What changed:** 10K/25K/50K/100K selector regenerating both main and worker
datasets from the same seed.
**Why it helps:** shows the scaling curve instead of one anecdote.
**Tradeoff:** none, just UI.
**Verified:** freeze durations grow with N on baseline; stay ~0 on worker.

## Before vs After

| Metric | Before | After |
|---|---|---|
| Operation ms (50K) | TBD | TBD (worker compute + roundtrip) |
| Long tasks during run | TBD | TBD |
| Heartbeat freezes | TBD | TBD |
| Typing responsive during run | No | Yes |

> The Worker is not necessarily faster at computing. It prevents the computation
> from blocking the UI thread. Compare responsiveness metrics, not just durations.

## How to Reproduce

1. Open `/main-thread-lab`, 50K, Baseline. Click Run while watching the dot and typing.
2. Read freezes + long tasks. Switch to Worker, run again.
3. Try 100K in both modes.

## Chrome DevTools Recording

Performance tab: record a baseline run (one long task, dead frames), then a
worker run (main thread idle, work on the worker lane). Keep the heartbeat and
typing field in frame — the video should make sense without audio.

## Things I Would Consider in Production

- Chunked main-thread processing (time-slicing) where workers are unavailable.
- Transferables / structured-clone budgets for large payloads.
- Worker fallback when `Worker` is undefined; feature-detect, don't assume.
- Canceling stale queries (request ids) when users type fast.

## What I Learned

1. Responsiveness and speed are different metrics; workers fix the first.
2. A visible heartbeat turns "jank" from a feeling into a measurement.
3. Sharing one pipeline module between threads guarantees equivalent work.
4. Long Tasks API + frame-gap detection corroborate what the trace shows.
5. Always state the honesty clause: total time may be similar — and that's fine.

## Key Takeaway

> Main-thread time is a limited resource — spend it on interaction, not computation.
