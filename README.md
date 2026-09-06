# Frontend Performance Lab

> A collection of controlled frontend experiments exploring React rendering,
> browser main-thread behavior, networking, runtime observability, large-scale
> rendering, and frame performance.

Most frontend performance problems aren't solved by randomly adding memoization.
They're solved by understanding what the browser is doing. Each lab isolates one
problem with a deliberately inefficient baseline, an optimized implementation,
real measurements (never fabricated), and exact DevTools recording steps.

## Labs

| Lab | Problem | Main Tool | Main Optimization |
| --- | --- | --- | --- |
| Rendering | Unnecessary React renders | React Profiler | State isolation / memoization |
| Main Thread | CPU blocking | Chrome Performance | Web Worker |
| Observability | Unknown runtime behavior | PerformanceObserver | Instrumentation |
| Network | Request waterfall | Network panel | Parallelization / caching |
| Stress Test | Rendering scale | Performance panel | Virtualization / Canvas |
| FPS | Janky interactions | Performance / RAF | Rendering pipeline optimization |

Routes: `/`, `/rendering-lab`, `/main-thread-lab`, `/observability-lab`,
`/network-lab`, `/stress-test`, `/fps-lab`.

Earlier standalone experiments are kept reachable: `/100k` (original 100K-row
table lab) and `/form` (voucher-entry input-latency demo).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (mock API active — required for /network-lab)
```

## Production profiling (important)

Performance recordings intended for comparison should preferably be taken from
the production build — React dev mode, StrictMode double-invocation, source
maps, and dev tooling change render counts and timings:

```bash
npm run build
npm run preview
```

Notes:

- **StrictMode** is enabled and can intentionally double-invoke certain
  development behavior. Never present dev-only render counts as production
  results without this context.
- The `/network-lab` mock API is Vite dev-server middleware. Static preview
  hosting cannot run it; the lab surfaces an honest error there instead of
  fake data.
- Append `?recording=true` to any page for recording mode: navigation chrome
  hides and metrics enlarge for screen capture.

## Measurement rules

Every displayed number is measured, computed from an actual measurement, or
clearly labeled unavailable/estimated. Before/after tables in each lab README
contain `TBD` until you run the experiment. No "improved by 93%" claims without
a trace behind them.

## Principles

1. Measure before optimizing — never assume the bottleneck.
2. Rendering less is often better than rendering faster.
3. Main-thread time is a limited resource.
4. React performance is often an architecture problem.
5. Networking architecture affects perceived performance.
6. Browser metrics need context.
7. Every optimization has tradeoffs.
8. Verify every optimization — profile again.

## Structure

```
src/
  app/            Home.tsx  navigation.ts  LegacyLab.tsx
  components/     ExperimentHeader.tsx  ExperimentMetrics.tsx
                  ModeSwitcher.tsx  ProfilingGuide.tsx  ErrorBoundary.tsx
  performance/    measure.ts  renderCounter.ts  longTasks.ts
                  fps.ts  observers.ts
  labs/
    rendering/    RenderingLab.tsx  dashboards.tsx  components.tsx  data.ts  README.md
    main-thread/  MainThreadLab.tsx  pipeline.ts  worker.ts  README.md
    observability/ ObservabilityLab.tsx  README.md
    network/      NetworkLab.tsx  README.md
    stress-test/  StressTestLab.tsx  CanvasStage.tsx  README.md
    fps/          FpsLab.tsx  README.md
  App.tsx  main.tsx
```
