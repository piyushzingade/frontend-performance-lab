import { useEffect, useRef, useState } from 'react';
import { ExperimentHeader } from '../../components/ExperimentHeader';
import { ExperimentMetrics } from '../../components/ExperimentMetrics';
import { ProfilingGuide } from '../../components/ProfilingGuide';
import { formatMs } from '../../performance/measure';
import { getJsTransferBytes, getMemoryMB, getNavigationTiming, observeCLS, observeINP, observeLCP } from '../../performance/observers';

type FeedEvent = { at: string; text: string };

function stamp(): string {
  return new Date().toLocaleTimeString('en-GB');
}

export function ObservabilityLab() {
  const [lcp, setLcp] = useState<number | null>(null);
  const [cls, setCls] = useState(0);
  const [inp, setInp] = useState<number | null>(null);
  const [longTasks, setLongTasks] = useState<{ start: number; duration: number }[]>([]);
  const [apiMs, setApiMs] = useState<number | null>(null);
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const [bigList, setBigList] = useState<number[] | null>(null);
  const [bigImage, setBigImage] = useState<string | null>(null);
  const [memMB, setMemMB] = useState<number | null>(null);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [nav] = useState(getNavigationTiming);
  const clsAcc = useRef(0);

  const push = (text: string) =>
    setFeed((f) => [...f.slice(-29), { at: stamp(), text }]);

  useEffect(() => {
    const offs = [
      observeLCP((v) => { setLcp(v); push(`LCP candidate — ${Math.round(v)} ms`); }),
      observeCLS((v) => { clsAcc.current += v; setCls(clsAcc.current); push(`Layout shift — ${v.toFixed(4)}`); }),
      observeINP((v) => { setInp((p) => (p === null || v > p ? v : p)); push(`Interaction timing — ${Math.round(v)} ms (approx INP signal)`); }),
    ];
    let longObs: PerformanceObserver | null = null;
    try {
      longObs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          setLongTasks((t) => [...t.slice(-19), { start: e.startTime, duration: e.duration }]);
          push(`Long task detected — ${Math.round(e.duration)} ms`);
        }
      });
      longObs.observe({ entryTypes: ['longtask'] });
    } catch { /* unsupported — panel shows fallback */ }
    const memTimer = window.setInterval(() => setMemMB(getMemoryMB()), 2000);
    return () => {
      offs.forEach((off) => off?.());
      longObs?.disconnect();
      window.clearInterval(memTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const expensiveRender = () => {
    push('Test action — rendering 5,000 rows');
    const t0 = performance.now();
    setBigList(Array.from({ length: 5000 }, (_, i) => i));
    requestAnimationFrame(() => {
      const dt = performance.now() - t0;
      setRenderMs(dt);
      push(`Custom render committed — ${Math.round(dt)} ms`);
    });
  };

  const cpuTask = () => {
    push('Test action — sorting 200K numbers (main thread)');
    const t0 = performance.now();
    const arr = Array.from({ length: 200_000 }, () => Math.random());
    arr.sort();
    void arr[0];
    push(`CPU task finished — ${Math.round(performance.now() - t0)} ms (watch for its long task above)`);
  };

  const apiRequest = async () => {
    push('Test action — same-origin request (see Network panel)');
    const t0 = performance.now();
    try {
      const res = await fetch(`${window.location.origin}/?probe=${Date.now()}`, { cache: 'no-store' });
      await res.text();
      const dt = performance.now() - t0;
      setApiMs(dt);
      push(`API request — ${Math.round(dt)} ms → ${res.status}`);
    } catch (err) {
      push(`API request failed — ${err instanceof Error ? err.message : 'error'}`);
    }
  };

  const loadImage = () => {
    push('Test action — generating a large image (real decode + layout)');
    // Runtime-generated bitmap: real decode/paint/LCP cost, no network dependency.
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 700;
    const ctx = c.getContext('2d')!;
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `hsl(${(i * 37) % 360} 60% 55%)`;
      ctx.fillRect((i * 53) % 1200, (i * 91) % 700, 60, 60);
    }
    setBigImage(c.toDataURL('image/png'));
  };

  const jsKB = getJsTransferBytes();

  return (
    <div className="lab">
      <ExperimentHeader
        labId="observability"
        title="Frontend Observability"
        problem="Runtime behavior is invisible without instrumentation."
        test="Which real browser signals we can observe — and what each one means."
        tool="PerformanceObserver + performance timeline"
      />
      <div className="controls">
        <div className="filter-row">
          <button onClick={expensiveRender}>Trigger expensive render</button>
          <button onClick={loadImage}>Load large image</button>
          <button onClick={cpuTask}>Run CPU task</button>
          <button onClick={apiRequest}>Make API request</button>
          <button onClick={() => { setFeed([]); setLongTasks([]); setBigList(null); setBigImage(null); }}>Reset metrics</button>
        </div>
      </div>

      <ExperimentMetrics
        metrics={[
          { key: 'lcp', label: 'LCP', value: lcp === null ? 'pending…' : formatMs(lcp) },
          { key: 'cls', label: 'CLS', value: cls.toFixed(4) },
          { key: 'inp', label: 'INP (approx)', value: inp === null ? 'interact first' : formatMs(inp) },
          { key: 'long', label: 'Long tasks', value: String(longTasks.length) },
          { key: 'api', label: 'API latency', value: formatMs(apiMs) },
          { key: 'render', label: 'Custom render', value: formatMs(renderMs) },
          { key: 'mem', label: 'JS heap', value: memMB === null ? 'unsupported' : `${memMB.toFixed(1)} MB` },
          { key: 'js', label: 'JS transferred', value: jsKB === null ? 'unavailable' : `${(jsKB / 1024).toFixed(0)} KB` },
        ]}
      />
      <p className="hint">
        LCP — how long the largest visible content took to appear. CLS — total unexpected layout movement (lower is
        better). INP (approx) — worst interaction delay seen via event timing. JS transferred comes from Resource
        Timing (network bytes), which is not the same as bundle analysis — see README.
      </p>

      {bigImage && <img src={bigImage} alt="Generated large test bitmap" className="obs-image" />}

      <section className="metrics" aria-label="Live event feed">
        <h2>Live timeline</h2>
        <div className="render-map">
          {feed.map((e, i) => (
            <div className="render-map-row" key={i}><span>{e.at}</span><span>{e.text}</span></div>
          ))}
          {feed.length === 0 && <span className="hint">Events from PerformanceObserver appear here. Press a demo control.</span>}
        </div>
      </section>

      {bigList && (
        <section className="metrics" aria-label="Expensive render output">
          <h2>Rendered {bigList.length.toLocaleString()} rows in {formatMs(renderMs)}</h2>
        </section>
      )}
      <div style={{ display: 'none' }} aria-hidden>
        {bigList?.map((n) => <span key={n}>{n}</span>)}
      </div>

      <p className="hint">
        Navigation — DCL {formatMs(nav.domContentLoaded)} · load {formatMs(nav.load)} · TTFB {formatMs(nav.ttfb)}.
      </p>

      <ProfilingGuide
        steps={[
          'Open the Performance tab and record while pressing each demo control.',
          'Match trace events (long tasks, layout shifts, paints) against the live timeline above.',
          'Check LCP/CLS in Lighthouse or the Web Vitals extension for lab conditions.',
          'Compare dev vs production build: npm run build && npm run preview.',
        ]}
      />
    </div>
  );
}
