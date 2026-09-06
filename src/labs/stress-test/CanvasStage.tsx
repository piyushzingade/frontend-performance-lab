import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { buildIndex, generateData, type Row } from '../../data/generateData';

/** Canvas scatter: salary (x) vs score (y) — same logical dataset, no DOM per row. */
export const CanvasScatter = memo(function CanvasScatter({
  rows, onDraw,
}: {
  rows: Row[];
  onDraw: (ms: number, points: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const t0 = performance.now();
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    // Salary 30k–200k → x; score 0–100 → y.
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const x = ((r.salary - 30_000) / 170_000) * (W - 8) + 4;
      const y = H - 4 - (r.score / 100) * (H - 8);
      ctx.fillStyle = r.status === 'Active' ? '#1a1a1a' : '#9a9a9a';
      ctx.fillRect(x, y, 2, 2);
    }
    onDraw(performance.now() - t0, rows.length);
  });

  return <canvas ref={canvasRef} width={1160} height={420} className="canvas-stage" aria-label={`Scatter plot of ${rows.length} rows`} />;
});

export function useIndexedDataset(size: number) {
  const [dataset, setDataset] = useState<Row[]>([]);
  const [genMs, setGenMs] = useState<number | null>(null);
  useEffect(() => {
    const t0 = performance.now();
    const rows = generateData(size);
    void buildIndex(rows);
    setDataset(rows);
    setGenMs(performance.now() - t0);
  }, [size]);
  return { dataset, genMs };
}
