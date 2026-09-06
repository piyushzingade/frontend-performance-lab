export type LabMeta = {
  id: string;
  path: string;
  short: string;
  title: string;
  problem: string;
  metric: string;
};

export const LAB_ORDER: LabMeta[] = [
  {
    id: 'rendering',
    path: '/rendering-lab',
    short: 'Rendering',
    title: 'React Rendering',
    problem: 'One filter change re-renders the whole dashboard.',
    metric: 'Components rendered / interaction',
  },
  {
    id: 'main-thread',
    path: '/main-thread-lab',
    short: 'Main Thread',
    title: 'Main Thread & Worker',
    problem: 'CPU-heavy processing freezes the UI.',
    metric: 'Operation ms + animation continuity',
  },
  {
    id: 'observability',
    path: '/observability-lab',
    short: 'Observability',
    title: 'Observability',
    problem: 'Runtime behavior is invisible without instrumentation.',
    metric: 'LCP / CLS / INP / Long Tasks',
  },
  {
    id: 'network',
    path: '/network-lab',
    short: 'Network',
    title: 'Network Waterfall',
    problem: 'Dependent requests load sequentially.',
    metric: 'Total data load time',
  },
  {
    id: 'stress',
    path: '/stress-test',
    short: 'Stress Test',
    title: 'Frontend Stress Test',
    problem: 'Each rendering strategy breaks at a different scale.',
    metric: 'DOM nodes / render time',
  },
  {
    id: 'fps',
    path: '/fps-lab',
    short: '60 FPS',
    title: '60 FPS Interactions',
    problem: 'Dragging janks under load.',
    metric: 'FPS (approx) / frame ms',
  },
];
