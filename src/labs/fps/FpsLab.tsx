import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExperimentHeader } from '../../components/ExperimentHeader';
import { ExperimentMetrics } from '../../components/ExperimentMetrics';
import { ModeSwitcher } from '../../components/ModeSwitcher';
import { ProfilingGuide } from '../../components/ProfilingGuide';
import { useFps } from '../../performance/fps';

type Mode = 'baseline' | 'optimized';
type Node = { id: number; x: number; y: number; label: string };

const WORLD = 3000;
const VIEW_W = 900;
const VIEW_H = 420;

function genNodes(n: number): Node[] {
  let s = 42;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    x: rand() * (WORLD - 120),
    y: rand() * (WORLD - 60),
    label: `N${i}`,
  }));
}

/* ---------------- Baseline: state per pointermove, layout positioning -------- */
function BaselineCanvas({ nodes, setNodes }: { nodes: Node[]; setNodes: (n: Node[]) => void }) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [nearest, setNearest] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent) => {
    if (dragId === null) return;
    const rect = boxRef.current!.getBoundingClientRect(); // layout read per move
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Heavy per-move work: full nearest-neighbor scan in render-path state.
    let best = -1;
    let bestD = Infinity;
    for (const n of nodes) {
      if (n.id === dragId) continue;
      const d = (n.x - x) ** 2 + (n.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = n.id;
      }
    }
    setNearest(best);
    setNodes(nodes.map((n) => (n.id === dragId ? { ...n, x, y } : n))); // whole tree re-renders
  };

  return (
    <div
      ref={boxRef}
      className="canvas-view"
      onPointerMove={onMove}
      onPointerUp={() => setDragId(null)}
      onPointerLeave={() => setDragId(null)}
    >
      {nodes.map((n) => (
        <div
          key={n.id}
          className={`fnode${n.id === nearest ? ' near' : ''}`}
          style={{ left: n.x, top: n.y }} // layout-triggering position
          onPointerDown={(e) => {
            e.stopPropagation();
            setDragId(n.id);
          }}
        >
          {n.label}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Optimized: refs + transforms + memo + culling ------------- */
const OptNode = memo(function OptNode({ node, onGrab }: { node: Node; onGrab: (id: number, e: React.PointerEvent) => void }) {
  return (
    <div
      data-node={node.id}
      className="fnode"
      style={{ transform: `translate3d(${node.x}px, ${node.y}px, 0)` }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onGrab(node.id, e);
      }}
    >
      {node.label}
    </div>
  );
});

function OptimizedCanvas({ nodes, setNodes }: { nodes: Node[]; setNodes: (n: Node[]) => void }) {
  // Committed viewport offset (state, updated on pan end); live pan in a ref transform.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const worldRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: number; dx: number; dy: number; x?: number; y?: number } | null>(null);
  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number; nx?: number; ny?: number } | null>(null);
  const elCache = useRef(new Map<number, HTMLElement>());

  const visible = useMemo(() => {
    const M = 100; // cull margin
    return nodes.filter(
      (n) => n.x > offset.x - M && n.x < offset.x + VIEW_W + M && n.y > offset.y - M && n.y < offset.y + VIEW_H + M,
    );
  }, [nodes, offset]);

  const onGrab = useCallback((id: number, e: React.PointerEvent) => {
    const el = (e.target as HTMLElement).closest('[data-node]') as HTMLElement;
    const m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(el.style.transform);
    dragRef.current = { id, dx: e.clientX - Number(m?.[1]), dy: e.clientY - Number(m?.[2]) };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (d) {
      // Transient drag state stays in a ref → zero React renders per move.
      const x = e.clientX - d.dx;
      const y = e.clientY - d.dy;
      let el = elCache.current.get(d.id);
      if (!el) {
        el = worldRef.current?.querySelector(`[data-node="${d.id}"]`) as HTMLElement;
        if (el) elCache.current.set(d.id, el);
      }
      el?.style.setProperty('transform', `translate3d(${x}px, ${y}px, 0)`);
      d.x = x;
      d.y = y;
      return;
    }
    const p = panRef.current;
    if (p && worldRef.current) {
      const nx = p.ox - (e.clientX - p.sx);
      const ny = p.oy - (e.clientY - p.sy);
      worldRef.current.style.transform = `translate3d(${-nx}px, ${-ny}px, 0)`;
      p.nx = nx;
      p.ny = ny;
    }
  };

  const endDrag = () => {
    const d = dragRef.current;
    if (d) {
      dragRef.current = null;
      const { id, x, y } = d;
      if (x !== undefined && y !== undefined) {
        setNodes(nodes.map((n) => (n.id === id ? { ...n, x, y } : n))); // ONE commit
      }
      return;
    }
    const p = panRef.current;
    if (p && p.nx !== undefined && p.ny !== undefined) {
      const nx = Math.max(0, Math.min(WORLD - VIEW_W, p.nx));
      const ny = Math.max(0, Math.min(WORLD - VIEW_H, p.ny));
      panRef.current = null;
      setOffset({ x: nx, y: ny }); // ONE commit → culled re-render
    }
  };

  return (
    <div
      className="canvas-view"
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onPointerDown={(e) => {
        panRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
      }}
    >
      <div
        ref={worldRef}
        className="fworld"
        style={{ transform: `translate3d(${-offset.x}px, ${-offset.y}px, 0)`, width: WORLD, height: WORLD }}
      >
        {visible.map((n) => (
          <OptNode key={n.id} node={n} onGrab={onGrab} />
        ))}
      </div>
    </div>
  );
}

const COUNTS = [100, 500, 1000, 5000];

export function FpsLab() {
  const [mode, setMode] = useState<Mode>('baseline');
  const [count, setCount] = useState(500);
  const [nodes, setNodes] = useState<Node[]>(() => genNodes(500));
  const [culled, setCulled] = useState<number | null>(null);
  const fps = useFps(true);

  const changeCount = (n: number) => {
    setCount(n);
    setNodes(genNodes(n));
    setCulled(null);
  };

  return (
    <div className="lab">
      <ExperimentHeader
        labId="fps"
        title="60 FPS Interactions"
        problem="Dragging janks under load."
        test="Whether transform movement, ref-held drag state, and culling hold frame rate."
        tool="Chrome Performance + rAF meter"
      />
      <div className="controls">
        <ModeSwitcher
          modes={[
            { id: 'baseline', label: 'Baseline (state per move)' },
            { id: 'optimized', label: 'Optimized (refs+transforms)' },
          ]}
          value={mode}
          onChange={(m) => { setMode(m); setCulled(null); }}
        />
        <div className="filter-row">
          <select aria-label="Node count" value={count} onChange={(e) => changeCount(Number(e.target.value))}>
            {COUNTS.map((n) => <option key={n} value={n}>{n.toLocaleString()} nodes</option>)}
          </select>
          <span className="hint">Drag a node. In optimized mode, drag the background to pan (off-screen nodes are culled).</span>
        </div>
      </div>

      <ExperimentMetrics
        metrics={[
          { key: 'fps', label: 'FPS (approx)', value: fps.fps === null ? 'measuring…' : fps.fps.toFixed(0) },
          { key: 'frame', label: 'Avg frame', value: fps.avgFrameMs === null ? '—' : `${fps.avgFrameMs.toFixed(1)} ms` },
          { key: 'drop', label: 'Dropped (est)', value: String(fps.dropped) },
          { key: 'nodes', label: 'Nodes in DOM', value: mode === 'optimized' && culled !== null ? `${culled} / ${nodes.length}` : String(nodes.length) },
        ]}
      />

      {mode === 'baseline' ? (
        <BaselineCanvas nodes={nodes} setNodes={setNodes} />
      ) : (
        <OptimizedCanvas nodes={nodes} setNodes={(n) => { setNodes(n); }} />
      )}
      <CulledReporter mode={mode} nodes={nodes} onReport={setCulled} />

      <ProfilingGuide
        steps={[
          'Set 1,000+ nodes in Baseline. Record, then drag a node in circles for 5 seconds. Stop.',
          'Look for long frames, forced reflows (layout reads per move), and full-tree commits.',
          'Switch to Optimized, repeat the same drag: commits collapse to one per gesture.',
          'The on-screen FPS is an approximation — confirm with the Performance frame track.',
        ]}
      />
    </div>
  );
}

function CulledReporter({ mode, nodes, onReport }: { mode: Mode; nodes: Node[]; onReport: (n: number) => void }) {
  // Count actually-mounted optimized nodes after each commit.
  useEffect(() => {
    if (mode === 'optimized') {
      onReport(document.querySelectorAll('.fworld [data-node]').length || nodes.length);
    }
  }, [mode, nodes, onReport]);
  return null;
}
