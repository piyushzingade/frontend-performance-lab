export type Metric = { key: string; label: string; value: string };

/** Reusable metrics grid — each lab passes only the metrics it actually measured. */
export function ExperimentMetrics({ metrics }: { metrics: Metric[] }) {
  return (
    <section className="metrics" aria-label="Experiment metrics">
      <div className="metric-grid">
        {metrics.map((m) => (
          <div className="metric" key={m.key}>
            <span className="k">{m.label}</span>
            <span className="v">{m.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
