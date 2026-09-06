import { createContext, forwardRef, memo, useCallback, useContext, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { aggregateSales, CATEGORIES, genSales, REGIONS, USERS, type Filters } from './data';
import {
  BarsChart, DataTable, Feed, Kpi, MemoBarsChart, MemoDataTable, MemoFeed, MemoKpi,
  MemoSidePanel, MemoSpark, MemoUserCard, SidePanel, Spark, UserCard,
} from './components';

/**
 * BASELINE — realistic dashboard mistakes, nothing cartoonish:
 * 1. One state object at the top: any filter change re-renders everything.
 * 2. Unstable props: inline style/callback/array literals on every render.
 * 3. aggregateSales() (filter→sort→group→rank over 5k rows) runs fresh in
 *    FOUR different components per render.
 * 4. One giant context consumed by sidebar + notifications + summary.
 */
const DashCtx = createContext<{ filters: Filters; setFilters: (f: Filters) => void } | null>(null);

const RECORDS = genSales(5000);

function useDash() {
  const ctx = useContext(DashCtx);
  if (!ctx) throw new Error('missing provider');
  return ctx;
}

function BaselineSidebar() {
  const { filters } = useDash();
  const agg = aggregateSales(RECORDS, filters); // recompute #1
  return (
    <SidePanel
      name="Sidebar"
      title="Sidebar"
      lines={[`Region: ${filters.region || 'all'}`, `Orders: ${agg.count}`, 'Saved views (3)', 'Exports (2)']}
    />
  );
}

function BaselineNotifications() {
  const { filters } = useDash();
  const agg = aggregateSales(RECORDS, filters); // recompute #2
  return (
    <SidePanel
      name="Notifications"
      title="Notifications"
      lines={[`${agg.ranked.length} top deals`, `${agg.count} orders in view`, 'Sync: ok']}
    />
  );
}

function BaselineChart() {
  const { filters } = useDash();
  const agg = aggregateSales(RECORDS, filters); // recompute #3
  // Fresh array identity every render defeats any downstream memo.
  return <BarsChart name="RevenueChart" title="Revenue by category" entries={[...agg.byCategory]} />;
}

function BaselineTable() {
  const { filters } = useDash();
  const agg = aggregateSales(RECORDS, filters); // recompute #4
  return <DataTable name="OrdersTable" title={`Top orders (${agg.count})`} rows={agg.ranked.map((r) => ({ ...r }))} />;
}

export function BaselineDashboard({ filters, setFilters }: { filters: Filters; setFilters: (f: Filters) => void }) {
  const agg = aggregateSales(RECORDS, filters); // recompute #5 (parent itself)
  const feedItems = agg.ranked.slice(0, 5).map((r) => `#${r.id} ${r.user} closed ₹${r.amount}`);
  return (
    <DashCtx.Provider value={{ filters, setFilters }}>
      <div className="dash-controls">
        <div className="mode-row">
          {['', ...REGIONS].map((r) => (
            <button key={r} className={filters.region === r ? 'active' : ''} onClick={() => setFilters({ ...filters, region: r })}>
              {r === '' ? 'All regions' : r}
            </button>
          ))}
        </div>
        <div className="dash-controls-row">
          <select aria-label="Category" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input aria-label="Search" placeholder="Search user / id…" value={filters.query} onChange={(e) => setFilters({ ...filters, query: e.target.value })} />
        </div>
      </div>
      <div className="dash-grid">
        {/* Inline style + inline callback: new identities every render. */}
        <Kpi name="KpiRevenue" label="Revenue" value={`₹${Math.round(agg.total).toLocaleString()}`} style={{ borderLeft: '3px solid #1a1a1a' }} onClick={() => setFilters({ ...filters })} />
        <Kpi name="KpiOrders" label="Orders" value={String(agg.count)} style={{ borderLeft: '3px solid #555' }} onClick={() => setFilters({ ...filters })} />
        <Kpi name="KpiAvg" label="Avg order" value={`₹${Math.round(agg.avg).toLocaleString()}`} style={{ borderLeft: '3px solid #888' }} onClick={() => setFilters({ ...filters })} />
        <Kpi name="KpiUsers" label="Top user" value={agg.ranked[0]?.user ?? '—'} style={{ borderLeft: '3px solid #aaa' }} onClick={() => setFilters({ ...filters })} />
        <BaselineChart />
        <BarsChart name="RegionBars" title="Revenue by region" entries={[...agg.byRegion]} />
        <Spark name="SparkDaily" title="Daily trend" points={[...agg.daily]} />
        <Spark name="SparkAvg" title="Daily avg" points={agg.daily.map((d) => Math.round(d / 4))} />
        <BaselineTable />
        <DataTable name="TopTable" title="Top deals copy" rows={agg.ranked.slice(0, 5).map((r) => ({ ...r }))} />
        <Feed name="ActivityFeed" title="Activity" items={feedItems} />
        <Feed name="AlertsPanel" title="Alerts" items={['Quota at 82%', '2 refunds pending', 'Sync ok']} />
        {USERS.slice(0, 4).map((u) => {
          const mine = RECORDS.filter((r) => r.user === u && (filters.region === '' || r.region === filters.region));
          return <UserCard key={u} name={`UserCard-${u}`} user={u} total={mine.reduce((a, r) => a + r.amount, 0)} orders={mine.length} />;
        })}
        <BaselineSidebar />
        <BaselineNotifications />
        <SidePanel name="SummaryStrip" title="Summary" lines={[`${agg.count} orders`, `₹${Math.round(agg.total).toLocaleString()} total`, `Worst region: ${agg.byRegion.sort((a, b) => a[1] - b[1])[0]?.[0] ?? '—'}`]} />
      </div>
    </DashCtx.Provider>
  );
}

/**
 * OPTIMIZED — same pixels, fixed wiring:
 * - filter state split: region/category stay up top (many consumers), the
 *   search query is colocated in SearchBox and only flows down on Apply.
 * - aggregateSales() runs ONCE via useMemo; stable references downstream.
 * - heavy children are memoized + receive stable props (no inline literals).
 * - context split: FilterCtx carries only region/category + stable setters.
 */
const FilterCtx = createContext<{ region: string; category: string; setRegion: (r: string) => void; setCategory: (c: string) => void } | null>(null);

function useFilterCtx() {
  const ctx = useContext(FilterCtx);
  if (!ctx) throw new Error('missing provider');
  return ctx;
}

function OptSidebar({ count }: { count: number }) {
  return <MemoSidePanel name="Sidebar" title="Sidebar" lines={useMemo(() => [`Orders: ${count}`, 'Saved views (3)', 'Exports (2)'], [count])} />;
}

function OptNotifications({ top, count }: { top: number; count: number }) {
  const lines = useMemo(() => [`${top} top deals`, `${count} orders in view`, 'Sync: ok'], [top, count]);
  return <MemoSidePanel name="Notifications" title="Notifications" lines={lines} />;
}

function RegionButtons() {
  const { region, setRegion } = useFilterCtx();
  return (
    <div className="mode-row">
      {['', ...REGIONS].map((r) => (
        <button key={r} className={region === r ? 'active' : ''} onClick={() => setRegion(r)}>
          {r === '' ? 'All regions' : r}
        </button>
      ))}
    </div>
  );
}

function CategorySelect() {
  const { category, setCategory } = useFilterCtx();
  return (
    <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
      <option value="">All categories</option>
      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

/** Query state lives HERE — typing doesn't touch the dashboard until Apply. */
export type SearchBoxHandle = { setDraft: (q: string) => void };
const SearchBox = forwardRef<SearchBoxHandle, { onApply: (q: string) => void }>(function SearchBox({ onApply }, ref) {
  const [draft, setDraft] = useState('');
  useImperativeHandle(ref, () => ({ setDraft }), []);
  return (
    <span className="searchbox">
      <input aria-label="Search" placeholder="Search user / id…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onApply(draft); }} />
      <button onClick={() => onApply(draft)}>Apply</button>
    </span>
  );
});

const KPI_STYLE_A = { borderLeft: '3px solid #1a1a1a' };
const KPI_STYLE_B = { borderLeft: '3px solid #555' };
const KPI_STYLE_C = { borderLeft: '3px solid #888' };
const KPI_STYLE_D = { borderLeft: '3px solid #aaa' };

export type OptHandle = { setRegion: (r: string) => void; typeText: (q: string) => void };

export const OptimizedDashboard = forwardRef<OptHandle>(function OptimizedDashboard(_, ref) {
  const [region, setRegion] = useState('');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const searchRef = useRef<SearchBoxHandle>(null);
  useImperativeHandle(ref, () => ({
    setRegion: (r: string) => setRegion(r),
    typeText: (q: string) => searchRef.current?.setDraft(q),
  }), []);
  const setRegionCb = useCallback((r: string) => setRegion(r), []);
  const setCategoryCb = useCallback((c: string) => setCategory(c), []);
  const applyQuery = useCallback((q: string) => setQuery(q), []);
  const filterCtx = useMemo(() => ({ region, category, setRegion: setRegionCb, setCategory: setCategoryCb }), [region, category, setRegionCb, setCategoryCb]);

  const filters = useMemo(() => ({ region, category, query }), [region, category, query]);
  const agg = useMemo(() => aggregateSales(RECORDS, filters), [filters]); // computed ONCE
  const feedItems = useMemo(() => agg.ranked.slice(0, 5).map((r) => `#${r.id} ${r.user} closed ₹${r.amount}`), [agg]);
  const alertItems = useMemo(() => ['Quota at 82%', '2 refunds pending', 'Sync ok'], []);
  const regionEntries = useMemo(() => agg.byRegion, [agg]);
  const dailyAvg = useMemo(() => agg.daily.map((d) => Math.round(d / 4)), [agg]);
  const top5 = useMemo(() => agg.ranked.slice(0, 5), [agg]);
  const worstRegion = useMemo(() => [...agg.byRegion].sort((a, b) => a[1] - b[1])[0]?.[0] ?? '—', [agg]);
  const summaryLines = useMemo(() => [`${agg.count} orders`, `₹${Math.round(agg.total).toLocaleString()} total`, `Worst region: ${worstRegion}`], [agg, worstRegion]);

  return (
    <FilterCtx.Provider value={filterCtx}>
      <div className="dash-controls">
        <RegionButtons />
        <div className="dash-controls-row">
          <CategorySelect />
          <SearchBox ref={searchRef} onApply={applyQuery} />
        </div>
      </div>
      <div className="dash-grid">
        <MemoKpi name="KpiRevenue" label="Revenue" value={`₹${Math.round(agg.total).toLocaleString()}`} style={KPI_STYLE_A} />
        <MemoKpi name="KpiOrders" label="Orders" value={String(agg.count)} style={KPI_STYLE_B} />
        <MemoKpi name="KpiAvg" label="Avg order" value={`₹${Math.round(agg.avg).toLocaleString()}`} style={KPI_STYLE_C} />
        <MemoKpi name="KpiUsers" label="Top user" value={agg.ranked[0]?.user ?? '—'} style={KPI_STYLE_D} />
        <MemoBarsChart name="RevenueChart" title="Revenue by category" entries={agg.byCategory} />
        <MemoBarsChart name="RegionBars" title="Revenue by region" entries={regionEntries} />
        <MemoSpark name="SparkDaily" title="Daily trend" points={agg.daily} />
        <MemoSpark name="SparkAvg" title="Daily avg" points={dailyAvg} />
        <MemoDataTable name="OrdersTable" title={`Top orders (${agg.count})`} rows={agg.ranked} />
        <MemoDataTable name="TopTable" title="Top deals copy" rows={top5} />
        <MemoFeed name="ActivityFeed" title="Activity" items={feedItems} />
        <MemoFeed name="AlertsPanel" title="Alerts" items={alertItems} />
        {USERS.slice(0, 4).map((u) => (
          <OptUser key={u} user={u} region={region} />
        ))}
        <OptSidebar count={agg.count} />
        <OptNotifications top={agg.ranked.length} count={agg.count} />
        <MemoSidePanel name="SummaryStrip" title="Summary" lines={summaryLines} />
      </div>
    </FilterCtx.Provider>
  );
});

/** Per-user card subscribes only to (user, region) — category/query changes skip it. */
const OptUser = memo(function OptUser({ user, region }: { user: string; region: string }) {
  const { total, orders } = useMemo(() => {
    const mine = RECORDS.filter((r) => r.user === user && (region === '' || r.region === region));
    return { total: mine.reduce((a, r) => a + r.amount, 0), orders: mine.length };
  }, [user, region]);
  return <MemoUserCard name={`UserCard-${user}`} user={user} total={total} orders={orders} />;
});
