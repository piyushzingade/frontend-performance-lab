export type SaleRecord = {
  id: number;
  region: string;
  category: string;
  amount: number;
  user: string;
  status: string;
  day: number;
};

export const REGIONS = ['North', 'South', 'East', 'West'];
export const CATEGORIES = ['Hardware', 'Software', 'Services', 'Support'];
export const USERS = ['Ana', 'Ben', 'Cara', 'Dev', 'Eli', 'Farah'];

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

export function genSales(n = 5000): SaleRecord[] {
  const rand = mulberry32(7);
  const out: SaleRecord[] = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = {
      id: i,
      region: REGIONS[Math.floor(rand() * REGIONS.length)],
      category: CATEGORIES[Math.floor(rand() * CATEGORIES.length)],
      amount: 50 + Math.floor(rand() * 4950),
      user: USERS[Math.floor(rand() * USERS.length)],
      status: rand() > 0.12 ? 'Closed' : 'Open',
      day: 1 + Math.floor(rand() * 30),
    };
  }
  return out;
}

export type Filters = { region: string; category: string; query: string };

/**
 * Deliberately multi-pass aggregation (filter → sort → group → rank).
 * Baseline calls this fresh in several components per render; optimized
 * memoizes it once. Same function, same result — the wiring differs.
 */
export function aggregateSales(records: SaleRecord[], f: Filters) {
  const q = f.query.trim().toLowerCase();
  const filtered = records.filter(
    (r) =>
      (f.region === '' || r.region === f.region) &&
      (f.category === '' || r.category === f.category) &&
      (!q || r.user.toLowerCase().includes(q) || String(r.id).includes(q)),
  );
  const sorted = [...filtered].sort((a, b) => b.amount - a.amount);
  const byCategory = new Map<string, number>();
  const byRegion = new Map<string, number>();
  for (const r of filtered) {
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + r.amount);
    byRegion.set(r.region, (byRegion.get(r.region) ?? 0) + r.amount);
  }
  const ranked = sorted.slice(0, 8);
  const total = filtered.reduce((a, r) => a + r.amount, 0);
  const daily = new Array(30).fill(0) as number[];
  for (const r of filtered) daily[r.day - 1] += r.amount;
  return {
    count: filtered.length,
    total,
    avg: filtered.length ? total / filtered.length : 0,
    ranked,
    byCategory: [...byCategory.entries()],
    byRegion: [...byRegion.entries()],
    daily,
  };
}

export type Agg = ReturnType<typeof aggregateSales>;
