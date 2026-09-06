/** Runs the SAME pipeline off-thread. Dataset generated once per INIT. */
import { genItems, processItems, type Item } from './pipeline';

let items: Item[] = [];

self.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === 'INIT') {
    items = genItems(msg.n);
    self.postMessage({ type: 'READY', n: msg.n });
    return;
  }
  if (msg.type === 'RUN') {
    const t0 = performance.now();
    const result = processItems(items, msg.query);
    const workerMs = performance.now() - t0;
    self.postMessage({ type: 'RESULT', id: msg.id, result, workerMs });
  }
};
