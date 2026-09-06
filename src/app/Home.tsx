import { Link } from 'react-router-dom';
import { LAB_ORDER } from './navigation';
import { isRecordingMode } from '../performance/measure';

export function Home() {
  const recording = isRecordingMode();
  return (
    <div className={`lab${recording ? ' recording' : ''}`}>
      <header>
        <h1>Frontend Performance Lab</h1>
        <p className="sub">
          Most frontend performance problems aren&apos;t solved by randomly adding memoization.
          They&apos;re solved by understanding what the browser is doing.
        </p>
        <p className="sub">
          These experiments explore React rendering, main-thread work, networking, observability,
          large-scale rendering, and frame performance through measurable before-and-after examples.
        </p>
      </header>
      <div className="home-grid">
        {LAB_ORDER.map((lab) => (
          <article className="home-card" key={lab.id}>
            <h2>{lab.title}</h2>
            <p>{lab.problem}</p>
            <p className="home-metric">Primary metric: {lab.metric}</p>
            <Link className="home-open" to={lab.path}>
              Open experiment →
            </Link>
          </article>
        ))}
      </div>
      <footer>
        <span>
          Recordings compare best on a production build: <code>npm run build &amp;&amp; npm run preview</code>.
          Bonus demos: <code>/100k</code> (100K-row table lab) and <code>/form</code> (voucher entry latency demo).
        </span>
      </footer>
    </div>
  );
}
