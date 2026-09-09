import { Analytics } from '@vercel/analytics/react';
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/rendering-lab" element={<ErrorBoundary lab="rendering lab"><RenderingLab /></ErrorBoundary>} />
        <Route path="/main-thread-lab" element={<ErrorBoundary lab="main-thread lab"><MainThreadLab /></ErrorBoundary>} />
        <Route path="/observability-lab" element={<ErrorBoundary lab="observability lab"><ObservabilityLab /></ErrorBoundary>} />
        <Route path="/network-lab" element={<ErrorBoundary lab="network lab"><NetworkLab /></ErrorBoundary>} />
        <Route path="/stress-test" element={<ErrorBoundary lab="stress test"><StressTestLab /></ErrorBoundary>} />
        <Route path="/fps-lab" element={<ErrorBoundary lab="fps lab"><FpsLab /></ErrorBoundary>} />
        {/* Earlier standalone experiments, kept reachable */}
        <Route path="/100k" element={<LegacyLab />} />
        <Route path="/form" element={<VoucherDemo />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  );
}
