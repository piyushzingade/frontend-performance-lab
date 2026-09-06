# 60 FPS Interaction Lab

## Why I Built This

"Dragging feels laggy" reports are hard to act on: is it JS, layout, paint, or
too many nodes? I built an infinite-canvas node board where the baseline commits
the classic sins (state per pointermove, `left/top` positioning, layout reads,
O(n) hover scans) and the optimized version does the opposite — so a single drag
tells the whole rendering-pipeline story.

## The Problem

- Baseline drag at 500+ nodes: every pointermove sets state (full-tree commit),
  positions via `left/top` (layout each frame), reads `getBoundingClientRect`
  (forced reflow), and runs a nearest-neighbor scan into more state.
- FPS collapses; the drag visibly trails the cursor.

## Initial Hypothesis

Hypothesis: the jank is death by a thousand pipeline stages, not one hot
function. Moving transient drag state out of React (refs), positioning with
compositor-friendly transforms, eliminating layout reads, and culling
off-screen nodes should restore frame rate at the same node count.

## How I Measured It

- On-screen rAF meter (`performance/fps.ts`): FPS (approx), avg frame ms,
  dropped-frame estimate — all labeled approximate.
- Nodes-in-DOM counter (proves culling).
- Chrome Performance frame track + "Layout / Update layer tree" rows as ground truth.

## What I Found

Baseline frames are dominated by script (full commit per move) + layout (left/top
+ sync geometry read). Optimized moves show near-zero script: one style write to
a compositor property, committed to React once on pointerup. Culling keeps DOM
proportional to viewport, not dataset.

## Baseline Architecture

```
pointermove → getBoundingClientRect → O(n) nearest scan → setState(all nodes)
   → full commit → left/top style → layout → paint → (repeat per move)
```

## Why the Baseline Is Slow

Each move pays script (whole tree), layout (`left/top` invalidation plus a
forced synchronous reflow from the geometry read), and paint — serially, 60+
times per second. Realistic because each piece looks innocent alone.

## Optimization

### Refs for transient drag state

**What changed:** pointermove writes `transform` on the dragged element directly;
React state updates once on pointerup.
**Why it helps:** removes ~60 commits/second; the drag runs at rAF speed.
**Tradeoff:** React tree and DOM disagree mid-gesture — commit on release.
**Verified:** Performance shows one commit per drag vs hundreds.

### Transform-based movement

**What changed:** `translate3d` instead of `left/top`.
**Why it helps:** compositor-handled; no layout invalidation per frame.
**Tradeoff:** subpixel/rounding differences; transforms don't affect layout (intended).
**Verified:** Layout rows disappear from the drag in the trace.

### No layout reads in the hot path

**What changed:** coordinates derived from the pointer event + cached offsets;
the per-move `getBoundingClientRect` and hover scan are gone.
**Why it helps:** eliminates forced synchronous reflows.
**Tradeoff:** hover-nearest feature removed — it was demo-only cost.
**Verified:** no purple "Layout" blocks during optimized drags.

### Memoized nodes + viewport culling

**What changed:** `OptNode` is memoized; only nodes in viewport + margin mount.
**Why it helps:** DOM scales with screen, not dataset (5000 → hundreds).
**Tradeoff:** pan commits re-run the cull filter; margin tuning.
**Verified:** nodes-in-DOM counter vs dataset size.

## Before vs After

| Metric | Before | After |
|---|---|---|
| FPS dragging 1K nodes (approx) | TBD | TBD |
| Avg frame ms | TBD | TBD |
| Commits per drag gesture | TBD (hundreds) | 1 |
| Nodes in DOM @5K | 5000 | TBD (culled) |

## How to Reproduce

1. Open `/fps-lab`, Baseline, 1,000 nodes. Drag a node in circles.
2. Watch FPS/frame meters; switch to Optimized, repeat the drag.
3. Raise to 5,000; pan the background in optimized mode (culling at work).

## Chrome DevTools Recording

Performance tab: 5-second drag per mode. Baseline shows script+layout per frame
and full-tree commits; optimized shows idle main thread with compositor-driven
movement. Confirm the on-screen meter against the frame track.

## Things I Would Consider in Production

- Pointer capture + touch-action handling for real devices.
- rAF-throttled (not per-event) updates if direct writes prove too chatty.
- Virtualized canvas libraries (or canvas/WebGL) past ~10K interactive nodes.
- Accessibility: keyboard-movable nodes, not pointer-only.
- prefers-reduced-motion for the heartbeat-style motion.

## What I Learned

1. Interaction jank is a pipeline problem — profile stages, not just functions.
2. The fastest render is the one that never happens (refs for transient state).
3. `left/top` in a move handler is a layout bug wearing a style API.
4. Sync geometry reads turn bad frames into terrible ones.
5. Approximate meters guide; the frame track decides.

## Key Takeaway

> Keep transient interaction state out of React — commit gestures, not frames.
