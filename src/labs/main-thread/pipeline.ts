/** Shared pipeline — imported by BOTH the main thread and the worker,
 * so the two modes provably run equivalent computation. */

export type Item = {
  id: number;
  name: string;
  category: string;
  price: number;
  rating: number;
};

const ADJ = ['Pro', 'Ultra', 'Mega', 'Super', 'Hyper', 'Nano', 'Aero', 'Turbo'];
const NOUN = ['Widget', 'Gadget', 'Module', 'Sensor', 'Driver', 'Panel', 'Router', 'Beacon'];
const CATS = ['Compute', 'Storage', 'Network', 'Power', 'Cooling'];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function genItems(n: number, seed = 11): Item[] {
  const rand = mulberry32(seed);
  const out: Item[] = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = {
      id: i,
      name: `${ADJ[Math.floor(rand() * ADJ.length)]} ${NOUN[Math.floor(rand() * NOUN.length)]} ${Math.floor(rand() * 1000)}`,
      category: CATS[Math.floor(rand() * CATS.length)],
      price: 10 + Math.floor(rand() * 9990),
      rating: Math.round(rand() * 50) / 10,
    };
  }
  return out;
}

/** Subsequence fuzzy score — genuine per-item CPU work. */
export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  let score = 0;
  let last = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      // Reward early and consecutive matches (ranking signal).
      score += 10 + (last === ti - 1 ? 15 : 0) + (ti === qi ? 5 : 0);
      last = ti;
      qi++;
    }
  }
  return qi === q.length ? score : -1;
}

export type Processed = {
  top: { id: number; name: string; score: number }[];
  matched: number;
  avgPrice: number;
  topCategory: string;
};

/** filter (fuzzy) → sort → rank top-100 → aggregate. */
export function processItems(items: Item[], query: string): Processed {
  const scored: { item: Item; score: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    const s = fuzzyScore(query, items[i].name);
    if (s >= 0) scored.push({ item: items[i], score: s + items[i].rating });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 100).map(({ item, score }) => ({ id: item.id, name: item.name, score: Math.round(score) }));
  let sum = 0;
  const byCat = new Map<string, number>();
  for (const { item } of scored) {
    sum += item.price;
    byCat.set(item.category, (byCat.get(item.category) ?? 0) + 1);
  }
  let topCategory = '—';
  let topN = -1;
  for (const [c, n] of byCat) {
    if (n > topN) {
      topN = n;
      topCategory = c;
    }
  }
  return { top, matched: scored.length, avgPrice: scored.length ? sum / scored.length : 0, topCategory };
}
