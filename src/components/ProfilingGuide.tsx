/** Per-experiment DevTools recipe. Steps reference the lab's own controls. */
export function ProfilingGuide({ steps }: { steps: string[] }) {
  return (
    <details className="guide">
      <summary>How to profile this experiment</summary>
      <ol>
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <p className="hint">
        Prefer the production build for comparison recordings: <code>npm run build &amp;&amp; npm run preview</code>.
        React dev mode, StrictMode double-invocation, and source maps change render counts and timings.
      </p>
    </details>
  );
}
