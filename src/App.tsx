import { Analytics } from '@vercel/analytics/react';
import { useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Home } from './app/Home';
import { LegacyLab } from './app/LegacyLab';
import { FpsLab } from './labs/fps/FpsLab';
import { MainThreadLab } from './labs/main-thread/MainThreadLab';
import { NetworkLab } from './labs/network/NetworkLab';
import { ObservabilityLab } from './labs/observability/ObservabilityLab';
import { RenderingLab } from './labs/rendering/RenderingLab';
import { StressTestLab } from './labs/stress-test/StressTestLab';
import { VoucherDemo } from './voucher/VoucherDemo';

const UNLOCK_KEY = 'lab-unlock';

/**
 * Production gate: only /100k is public. Every other page needs
 * ?name=piyush once per tab (remembered in sessionStorage so in-app
 * navigation keeps working). Local dev stays fully open.
 */
function isUnlocked(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('name') === 'piyush') {
      sessionStorage.setItem(UNLOCK_KEY, '1');
      return true;
    }
    return sessionStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

function Protected({ children }: { children: ReactNode }) {
  const [ok] = useState(isUnlocked);
  if (import.meta.env.DEV || ok) return <>{children}</>;
  return (
    <div className="lab">
      <h1>Not found</h1>
      <p className="dataset-line">This page does not exist.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Protected><Home /></Protected>} />
        <Route path="/rendering-lab" element={<Protected><ErrorBoundary lab="rendering lab"><RenderingLab /></ErrorBoundary></Protected>} />
        <Route path="/main-thread-lab" element={<Protected><ErrorBoundary lab="main-thread lab"><MainThreadLab /></ErrorBoundary></Protected>} />
        <Route path="/observability-lab" element={<Protected><ErrorBoundary lab="observability lab"><ObservabilityLab /></ErrorBoundary></Protected>} />
        <Route path="/network-lab" element={<Protected><ErrorBoundary lab="network lab"><NetworkLab /></ErrorBoundary></Protected>} />
        <Route path="/stress-test" element={<Protected><ErrorBoundary lab="stress test"><StressTestLab /></ErrorBoundary></Protected>} />
        <Route path="/fps-lab" element={<Protected><ErrorBoundary lab="fps lab"><FpsLab /></ErrorBoundary></Protected>} />
        {/* /100k is the only public page in production */}
        <Route path="/100k" element={<LegacyLab />} />
        <Route path="/form" element={<Protected><VoucherDemo /></Protected>} />
        <Route path="*" element={<Navigate to="/100k" replace />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  );
}
