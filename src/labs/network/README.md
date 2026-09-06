# Network Waterfall Optimization Lab

## Why I Built This

A settings page I worked on fetched user → profile → permissions → preferences
in a chain, each `await` waiting on the last, even though three of them only
needed the user id. Total time was the *sum* of latencies instead of the *max*.
I built this lab to make that shape visible: a waterfall you can see is a
waterfall you will fix.

## The Problem

- 7 requests run sequentially: user → profile → permissions → preferences →
  stats → activity → recommendations (~1.4s total).
- Only `user` is a genuine dependency; the rest wait for no reason.
- Repeated visits refetch everything; concurrent duplicate requests double-hit.

## Initial Hypothesis

Hypothesis: the chain is serialization overhead, not slow endpoints. Fetching
independent resources with `Promise.all`, deduplicating in-flight requests, and
caching by key should collapse total time toward the slowest single request —
verifiable in both the Network panel and the in-app waterfall.

## How I Measured It

- Real HTTP requests to a Vite dev-server mock API (`vite.config.ts →
  mockLabApi`), so entries appear in the Network panel with genuine timing.
- In-app waterfall drawn from measured `performance.now()` start/end offsets.
- Metrics: total load ms, network request count, cache hits, duplicates
  prevented, slowest request. Cache/dedupe counters are incremented at the exact
  code path that skips the network.

## What I Found

The endpoints are individually fast (140–300ms); the ~1.4s baseline is pure
serialization. Parallel waves cut it to ~3 sequential groups; warm cache cuts it
to ~0 network requests. The duplicate `stats` call proves dedupe: two callers,
one wire request.

## Baseline Architecture

```
user ─▶ profile ─▶ permissions ─▶ preferences ─▶ stats ─▶ activity ─▶ recommendations
(total ≈ sum of latencies)
```

## Why the Baseline Is Slow

Each `await` parks the chain on the network. Nothing overlaps, although only the
user id flows downstream. This pattern usually accretes one fetch at a time —
each addition looks harmless in isolation.

## Optimization

### Parallelize independent requests

**What changed:** after `user`, three `Promise.all` waves (identity group, then
dashboard group).
**Why it helps:** total time becomes max-of-wave instead of sum-of-all.
**Tradeoff:** higher concurrent load on the backend; error handling must
consider partial failure (`Promise.allSettled` in production).
**Verified:** waterfall bars overlap; total ≈ user + slowest wave.

### Request deduplication

**What changed:** in-flight map keyed by endpoint+params; the intentional double
`stats` call shares one promise.
**Why it helps:** components fetching the same resource concurrently stop
multiplying traffic.
**Tradeoff:** shared promises share errors too — handle rejection per consumer.
**Verified:** "Duplicates prevented" counter + single Network entry.

### Client cache

**What changed:** resolved responses cached by key; "Run again" serves all seven
from memory.
**Why it helps:** repeat visits cost ~0ms and 0 requests.
**Tradeoff:** invalidation — this demo cache never expires; production needs TTL
or version keys.
**Verified:** green cache bars with zero width; cache-hit counter.

## Before vs After

| Metric | Before | After (cold) | After (warm) |
|---|---|---|---|
| Total load | TBD | TBD | TBD |
| Network requests | 7 | TBD | 0 |
| Duplicates prevented | 0 | TBD | — |
| Cache hits | 0 | 0 | TBD |

## How to Reproduce

1. Open `/network-lab`, Baseline, "Load page (sequential)". Note 7 stacked bars.
2. Switch to Optimized, load: 3 waves. Load again: all cache.
3. "Reset + clear cache" restores cold state. Cross-check the Network panel.

## Chrome DevTools Recording

Network panel filtered to `/api/lab`: baseline shows 7 sequential entries;
optimized shows overlapping entries, then none on the warm run. Record
Performance simultaneously to see main-thread idle time between waves.

## Things I Would Consider in Production

- Route-level prefetching and `<link rel="preload">` for known-next resources.
- Optimistic UI where the mutation result is predictable.
- `AbortController` cancellation on navigation/unmount.
- Suspense + streaming for large payloads; stale-while-revalidate policies.
- NOTE: the mock API is dev-only middleware — `vite preview`/static hosts can't
  serve it, and the lab says so instead of faking data.

## What I Learned

1. Draw the dependency graph before the fetch code — most chains are accidental.
2. Total time = critical path, not request count; parallelize the path.
3. Dedupe and cache are different tools (concurrency vs repetition).
4. Every cache needs an invalidation story, even a demo one.
5. If it doesn't appear in the Network panel, it isn't a networking experiment.

## Key Takeaway

> Networking architecture is a loading-time architecture — parallelize the critical path.
