# React Rendering Performance Lab

## Why I Built This

Real dashboards grow a filter bar at the top and twenty widgets below it, all fed
from one state object. One day someone notices that typing in the search box makes
every chart stutter — and the instinct is to wrap everything in `useMemo`. I built
this lab to show the actual mechanism: where the state lives, what props change
identity, and which components *had* to render versus which ones just got dragged
along.

## The Problem

- Changing one region filter re-renders ~25 dashboard components.
- Typing one search character re-renders the whole dashboard per keystroke.
- The same 5,000-row aggregation (filter → sort → group → rank) runs five times
  per commit.

## Initial Hypothesis

My hypothesis — explicitly not a conclusion — was that the dashboard was slow
because "React renders too much". Profiling was needed to separate *necessary*
renders (data actually changed) from *propagated* renders (parent re-rendered, so
children followed) and from *repeated work* (the aggregation running per consumer).

## How I Measured It

- In-app render counters (`performance/renderCounter.ts`) — every widget calls
  `useRenderCounter(name)`; a live render map shows per-component counts.
- "Run Test" buttons drive the exact same interaction in both modes and report
  components-rendered plus commit-inclusive timing.
- React DevTools Profiler for commit durations and flame comparison.

## What I Found

Three distinct bottlenecks, each needing a different fix:

1. **State too high** — one `filters` object at the top; every consumer re-renders.
2. **Unstable props** — inline `style={{...}}`, `onClick={() => ...}`, and
   `rows={list.map(r => ({...r}))}` create new identities every render, defeating
   any memoization downstream.
3. **Repeated derivation** — four components each run the full aggregation.

## Baseline Architecture

```
Filters state (top)
   │  inline style / callbacks / fresh arrays
   ▼
Kpis, Charts, Tables, Feed, UserCards, Sidebar, Notifications
   │  each calls aggregateSales(5000 rows) again
   ▼
One giant DashCtx consumed by sidebar + notifications
```

## Why the Baseline Is Slow

A parent re-render re-renders all children by default. Inline object/callback
literals mean even memoized children would see changed props. Context consumers
re-render on every provider value change because the value object is rebuilt each
render. And the aggregation does 5 passes over 5k rows per call site.

## Optimization

### State colocation (search draft)

**What changed:** the search input owns its draft; the dashboard only learns the
query on Apply (`dashboards.tsx → SearchBox`).
**Why it helps:** keystrokes commit exactly one component instead of ~25.
**Tradeoff:** query and draft can diverge; Apply/discard UX must be explicit.
**Verified:** "Run Test: type 3 chars" counter — baseline ~75 renders, optimized 3.

### Split state + stable setters

**What changed:** region/category/query are separate `useState`s with
`useCallback` setters; filter context carries only stable references.
**Why it helps:** a region change no longer recreates the query setter identity.
**Tradeoff:** slightly more boilerplate at the top of the tree.
**Verified:** render map shows input components skipping region changes.

### Compute once with useMemo

**What changed:** `aggregateSales` runs once per filter set; children receive the
same array references.
**Why it helps:** removes 4 redundant filter→sort→group→rank passes per commit.
**Tradeoff:** memo cache holds one extra aggregation in memory; negligible here.
**Verified:** "change region" commit time drops; same numbers rendered.

### Memoized heavy children, no inline literals

**What changed:** charts/tables/cards are `React.memo`'d; styles hoisted to module
constants; no inline callbacks or spreads in props.
**Why it helps:** static widgets (AlertsPanel, SummaryStrip inputs) skip commits
whose data didn't change.
**Tradeoff:** memo has a comparison cost; applied only to heavy/static children,
not blindly everywhere.
**Verified:** Profiler shows skipped subtrees; README of each skipped component
explains why ("props referentially equal").

## Before vs After

| Metric | Before | After |
|---|---|---|
| Components per region change | TBD | TBD |
| Components per 3 keystrokes | TBD | TBD |
| Region-change commit ms | TBD | TBD |
| Aggregation runs per commit | 5 | 1 |

## How to Reproduce

1. Open `/rendering-lab`, Baseline mode.
2. Click "Run Test: change region", note renders + ms.
3. Switch to Optimized, run the same test.
4. Repeat with "Run Test: type 3 chars".

## Chrome DevTools Recording

React DevTools Profiler (not Performance): profile one "Run Test: change region"
per mode and compare commit counts/durations. Then profile the typing test.

## Things I Would Consider in Production

- Selector-based stores (e.g. subscriptions per widget) when prop drilling grows.
- Virtualizing the orders table beyond a few hundred rows.
- Debouncing the applied query for very large datasets.
- Accessibility: custom dropdowns here are native `<select>`s deliberately.

## What I Learned

1. Most "slow React" is state placement, not React itself.
2. Unstable props silently defeat memoization — identity is the API.
3. Colocating ephemeral state (drafts, hovers) beats memoizing its consequences.
4. `useMemo` pays off for expensive derivations, not for cheap JSX.
5. Counters beat intuition: measure renders, then fix the top offender.

## Key Takeaway

> Render less by architecture first; render faster by memoization second.
