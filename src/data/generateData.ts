export type Row = {
  id: number;
  name: string;
  email: string;
  company: string;
  department: string;
  salary: number;
  status: string;
  score: number;
  createdAt: string;
};

/** Enriched row with a precomputed lowercase search index (optimized path only). */
export type IndexedRow = Row & { _search: string };

const FIRST = [
  'Aarav', 'Ananya', 'Arjun', 'Diya', 'Ishaan', 'Kabir', 'Meera', 'Neha',
  'Piyush', 'Priya', 'Rahul', 'Riya', 'Rohan', 'Sanya', 'Vikram', 'Zoya',
  'Alice', 'Bob', 'Carol', 'David', 'Elena', 'Farhan', 'Grace', 'Hassan',
];
const LAST = [
  'Sharma', 'Patel', 'Reddy', 'Gupta', 'Mehta', 'Khan', 'Iyer', 'Nair',
  'Zingade', 'Kulkarni', 'Joshi', 'Smith', 'Garcia', 'Kim', 'Tanaka', 'Muller',
];
const COMPANIES = [
  'Acme Corp', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark Labs',
  'Wayne Ent', 'Massive Dyn', 'Cyberdyne', 'Tyrell Corp', 'Soylent', 'Gekko & Co',
];
const DEPARTMENTS = [
  'Engineering', 'Design', 'Marketing', 'Sales', 'Support', 'Finance', 'HR', 'Legal',
];
const STATUSES = ['Active', 'Inactive', 'Pending', 'Suspended'];

/** Deterministic mulberry32 PRNG — same seed => same 100k rows every load. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ROW_COUNT = 100_000;

export function generateData(count: number = ROW_COUNT): Row[] {
  performance.mark('data-gen-start');
  const rand = mulberry32(42);
  const rows: Row[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const first = FIRST[Math.floor(rand() * FIRST.length)];
    const last = LAST[Math.floor(rand() * LAST.length)];
    const company = COMPANIES[Math.floor(rand() * COMPANIES.length)];
    const department = DEPARTMENTS[Math.floor(rand() * DEPARTMENTS.length)];
    const status = STATUSES[Math.floor(rand() * STATUSES.length)];
    const salary = 30_000 + Math.floor(rand() * 170_000);
    const score = Math.floor(rand() * 101);
    const year = 2018 + Math.floor(rand() * 8);
    const month = String(1 + Math.floor(rand() * 12)).padStart(2, '0');
    const day = String(1 + Math.floor(rand() * 28)).padStart(2, '0');
    rows[i] = {
      id: i,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
      company,
      department,
      salary,
      status,
      score,
      createdAt: `${year}-${month}-${day}`,
    };
  }
  performance.mark('data-gen-end');
  performance.measure('data-generation', 'data-gen-start', 'data-gen-end');
  return rows;
}

/** Build the lowercase search index once — used by optimized + worker paths. */
export function buildIndex(rows: Row[]): IndexedRow[] {
  return rows.map((r) => ({
    ...r,
    _search: `${r.name} ${r.email} ${r.company}`.toLowerCase(),
  }));
}
