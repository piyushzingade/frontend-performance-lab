# Frontend Observability Lab

## Why I Built This

Teams argue about "the page feels slow" with no shared facts. Real-user signals
(LCP, CLS, INP, long tasks) exist in every Chromium browser for free — but most
developers have never watched them arrive live. I built this lab as the
instrument panel: press a button, do something real, watch the measurement land
in the feed with a timestamp.

## The Problem

- No visibility into what the runtime is doing: paint timing, layout shifts,
  input delays, heap growth, transfer sizes.
- "Bundle size" gets quoted from runtime guesses instead of build metadata.

## Initial Hypothesis

Hypothesis: wiring `PerformanceObserver` to LCP/CLS/event-timing/longtask
entries plus explicit test actions will produce a cause → measurement →
explanation loop that anyone (including non-engineers) can follow.

## How I Measured It

- `PerformanceObserver` for `largest-contentful-paint`, `layout-shift`,
  `event`, and `longtask` (`performance/observers.ts`, `longTasks.ts`).
- Navigation Timing + Resource Timing read directly, labeled as what they are.
- Demo controls create *real* behavior: 5,000-row commit, canvas-generated
  bitmap decode, 200K sort, same-origin fetch. Test actions are labeled as such
  in the feed — never mixed silently with organic events.

## What I Found

The APIs work, with caveats: LCP fires on paint candidates (our generated image
reliably becomes one); CLS accumulates only *unexpected* shifts; event-timing
gives an INP *approximation* (worst interaction seen), not the official metric;
`performance.memory` is Chromium-only; transfer bytes are network reality, not
bundle composition.

## Baseline Architecture

There is no baseline/optimized split here — this lab is the instrument panel
other labs (and your own app) get measured with:

```
Browser ──PerformanceObserver──▶ cards + timestamped feed
Demo controls ──real actions──▶ browser ──▶ new entries
```

## Why the Baseline Is Slow

Not applicable — but note *why naive observation fails*: polling
`performance.now()` in a loop tells you nothing about paint, layout, or input;
only the observer entries (and the DevTools trace) see those.

## Optimization

### Labeled, sourced metrics

**What changed:** every card shows a measured value or an honest fallback
("pending…", "unsupported", "interact first").
**Why it helps:** prevents the classic sin of displaying plausible-looking
constants.
**Tradeoff:** some cards stay empty until the user acts — that emptiness is information.
**Verified:** values change only when the corresponding real event occurs.

### Cause → effect demo controls

**What changed:** each button does genuine work (sort, decode, commit, fetch).
**Why it helps:** turns abstract metric definitions into muscle memory.
**Tradeoff:** the generated image isn't a network load — labeled as generated.
**Verified:** feed entries correlate 1:1 with button presses and trace events.

## Before vs After

| Metric | Before (no instrumentation) | After |
|---|---|---|
| LCP visibility | unknown | TBD (measured) |
| CLS visibility | unknown | TBD (measured) |
| Long-task attribution | guesswork | timestamped entries |
| JS transfer | guessed | TBD KB (Resource Timing) |

## How to Reproduce

1. Open `/observability-lab`. Note pending/empty states.
2. Press each control; watch cards + feed update.
3. Generate the image (new LCP), run the CPU task (new long task).

## Chrome DevTools Recording

Record the Performance tab while pressing controls; match trace rows (long
tasks, layout shifts, raster/paints) against the live feed timestamps.

## Things I Would Consider in Production

- Sampling + beaconing (e.g. `sendBeacon`) instead of live display.
- INP needs the official web-vitals attribution build for field data.
- Bundle composition comes from the bundler (`rollup-plugin-visualizer`),
  never from runtime byte counts.
- Memory API is Chromium-only — gate it, don't depend on it.

## What I Learned

1. A number without its cause is trivia; the feed provides the cause.
2. Every metric has a scope footnote — write the footnote down.
3. Transfer size ≠ bundle size; runtime ≠ build time.
4. "Unsupported" is a valid, honest metric state.
5. Label test actions — mixed feeds lie by omission.

## Key Takeaway

> Browser metrics need context — instrument the cause, not just the number.
