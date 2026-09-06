import { Link } from 'react-router-dom';
import { LAB_ORDER } from '../app/navigation';

export function ExperimentHeader({
  title,
  problem,
  test,
  tool,
  labId,
}: {
  title: string;
  problem: string;
  test: string;
  tool: string;
  labId: string;
}) {
  const idx = LAB_ORDER.findIndex((l) => l.id === labId);
  const prev = idx > 0 ? LAB_ORDER[idx - 1] : null;
  const next = idx >= 0 && idx < LAB_ORDER.length - 1 ? LAB_ORDER[idx + 1] : null;
  return (
    <header>
      <nav className="lab-nav">
        <Link to="/">← All Labs</Link>
        <span className="lab-nav-links">
          {prev && <Link to={prev.path}>← {prev.short}</Link>}
          {next && <Link to={next.path}>{next.short} →</Link>}
        </span>
      </nav>
      <h1>{title}</h1>
      <div className="dataset-line">
        <div><b>Problem</b> — {problem}</div>
        <div><b>What we&apos;ll test</b> — {test}</div>
        <div><b>Primary tool</b> — {tool}</div>
      </div>
    </header>
  );
}
