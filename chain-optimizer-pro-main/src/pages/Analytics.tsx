import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, Package, Users, Download, Star } from 'lucide-react';
import {
  ComposedChart, Bar, Area,
  BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { exportCSV } from '@/lib/export';
import { toast } from 'sonner';
import api from '@/lib/api';

const PIE_COLORS = [
  'hsl(160, 84%, 28%)',
  'hsl(217, 91%, 60%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 68%, 60%)',
  'hsl(0, 84%, 60%)',
];

const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: '1px solid hsl(215,20%,91%)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: 12,
};

type DateRange = '1m' | '3m' | '6m' | '12m';

// Build a full month-by-month array so the chart always has a continuous x-axis
function buildMonthlyChart(raw: any[], months: number) {
  const slots = Array.from({ length: months }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (months - 1 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return {
      key,
      month: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
      orders: 0,
      revenue: 0,
    };
  });
  raw.forEach((r: any) => {
    const d = new Date(r.month);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const slot = slots.find(s => s.key === key);
    if (slot) {
      slot.orders = Number(r.count);
      slot.revenue = Number(r.revenue ?? 0);
    }
  });
  return slots;
}

const Analytics = () => {
  const [dateRange, setDateRange] = useState<DateRange>('12m');

  const { data: overview } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get('/analytics/overview').then(r => r.data),
  });
  const { data: ordersChartRaw = [] } = useQuery({
    queryKey: ['analytics-orders-chart'],
    queryFn: () => api.get('/analytics/orders').then(r => r.data),
  });
  const { data: inventoryRaw = [] } = useQuery({
    queryKey: ['analytics-inventory-chart'],
    queryFn: () => api.get('/analytics/inventory').then(r => r.data),
  });
  const { data: suppliersRaw = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers').then(r => r.data),
  });
  const { data: productsRaw = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get('/inventory').then(r => r.data),
  });

  const rangeMonths: Record<DateRange, number> = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 };
  const ordersChart = buildMonthlyChart(ordersChartRaw, rangeMonths[dateRange]);

  // Products by category — group from full inventory
  const categoryMap: Record<string, number> = {};
  productsRaw.forEach((p: any) => {
    const cat = p.category || 'Other';
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
  });
  const categoryChart = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

  // Inventory levels from /analytics/inventory (name, stock_quantity, reorder_level)
  const inventoryChart = inventoryRaw.map((r: any) => ({
    name: r.name.length > 14 ? r.name.slice(0, 13) + '…' : r.name,
    stock: Number(r.stock_quantity),
    threshold: Number(r.reorder_level),
  }));

  const o = overview?.orders ?? {};
  const inv = overview?.inventory ?? {};
  const sup = overview?.suppliers ?? {};

  const topSuppliers = [...suppliersRaw]
    .filter((s: any) => s.is_active)
    .sort((a: any, b: any) => Number(b.rating) - Number(a.rating))
    .slice(0, 5);

  const topProducts = [...productsRaw]
    .sort((a: any, b: any) =>
      Number(b.unit_price) * Number(b.stock_quantity) - Number(a.unit_price) * Number(a.stock_quantity)
    )
    .slice(0, 5);

  const totalRevenue = o.total_revenue ? Number(o.total_revenue) : 0;
  const revenueDisplay = totalRevenue >= 1000 ? `$${(totalRevenue / 1000).toFixed(1)}K` : `$${totalRevenue.toFixed(0)}`;

  const handleExport = () => {
    exportCSV('analytics-orders', ordersChart.map(({ month, orders, revenue }) => ({ month, orders, revenue })));
    toast.success('Analytics exported');
  };

  return (
    <div>
      <Header title="Analytics" subtitle="Business intelligence and KPIs" />
      <div className="p-6 space-y-6">

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg border p-1">
            {(['1m', '3m', '6m', '12m'] as DateRange[]).map(r => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  dateRange === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >{r === '1m' ? '1 Month' : r === '3m' ? '3 Months' : r === '6m' ? '6 Months' : '12 Months'}</button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1" />Export CSV
          </Button>
        </div>

        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={BarChart3} label="Total Revenue" value={revenueDisplay}
            change={o.total_orders ? `From ${o.total_orders} orders` : 'All time'}
            changeType="positive" delay={0} />
          <StatCard icon={TrendingUp} label="Total Orders" value={o.total_orders ?? '—'}
            change={`${o.pending_orders ?? 0} pending`} changeType="positive" delay={60} />
          <StatCard icon={Package} label="Low Stock Items" value={inv.low_stock_count ?? '—'}
            change={(inv.low_stock_count ?? 0) > 0 ? 'Needs attention' : 'All good'}
            changeType={(inv.low_stock_count ?? 0) > 0 ? 'negative' : 'positive'} delay={120} />
          <StatCard icon={Users} label="Active Suppliers" value={sup.total_suppliers ?? '—'}
            change={`avg ${Number(sup.avg_supplier_rating ?? 0).toFixed(1)} rating`}
            changeType="neutral" delay={180} />
        </div>

        {/* Orders & Revenue combined chart + Category pie */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '240ms', animationFillMode: 'forwards' }}>
            <h3 className="text-sm font-semibold text-foreground mb-1">Orders & Revenue</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {dateRange === '1m' ? 'Last month' : dateRange === '3m' ? 'Last 3 months' : dateRange === '6m' ? 'Last 6 months' : 'Last 12 months'}
            </p>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={ordersChart} margin={{ top: 4, right: 20, bottom: 0, left: -16 }}>
                  <defs>
                    <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217,91%,60%)" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="hsl(217,91%,60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215,20%,91%)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(220,10%,60%)" tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="hsl(220,10%,60%)" tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="hsl(220,10%,60%)" tickLine={false} axisLine={false}
                    tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE}
                    formatter={(val: any, name: string) =>
                      name === 'Revenue' ? [`$${Number(val).toLocaleString()}`, name] : [val, name]
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="orders" name="Orders" fill="hsl(160,84%,28%)" radius={[3,3,0,0]} maxBarSize={32} />
                  <Area yAxisId="right" type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(217,91%,60%)" strokeWidth={2} fill="url(#gradRev)" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Products by Category pie */}
          <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}>
            <h3 className="text-sm font-semibold text-foreground mb-1">Products by Category</h3>
            <p className="text-xs text-muted-foreground mb-3">Distribution across catalog</p>
            {categoryChart.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">No data</div>
            ) : (
              <>
                <div className="h-[170px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryChart} cx="50%" cy="50%" innerRadius={48} outerRadius={76} paddingAngle={3} dataKey="value">
                        {categoryChart.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, _: any, props: any) => [v, props.payload.name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1.5">
                  {categoryChart.map((c: any, i: number) => (
                    <div key={c.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-foreground">{c.name}</span>
                      </span>
                      <span className="text-muted-foreground tabular-nums font-medium">{c.value} items</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Inventory levels bar chart */}
        <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '360ms', animationFillMode: 'forwards' }}>
          <h3 className="text-sm font-semibold text-foreground mb-1">Inventory Levels</h3>
          <p className="text-xs text-muted-foreground mb-4">Current stock vs reorder threshold (lowest 10 products)</p>
          <div className="h-[240px]">
            {inventoryChart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No inventory data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryChart} margin={{ top: 4, right: 4, bottom: 48, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215,20%,91%)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(220,10%,60%)" tickLine={false}
                    angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(220,10%,60%)" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="top" />
                  <Bar dataKey="stock" name="Current Stock" fill="hsl(160,84%,28%)" radius={[3,3,0,0]} maxBarSize={24} />
                  <Bar dataKey="threshold" name="Reorder Level" fill="hsl(38,92%,50%)" radius={[3,3,0,0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top tables */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top suppliers */}
          <div className="rounded-xl border bg-card overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: '420ms', animationFillMode: 'forwards' }}>
            <div className="px-5 py-3 border-b bg-secondary/40 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Top Suppliers by Rating</h3>
              <Star className="h-3.5 w-3.5 text-warning fill-warning" />
            </div>
            <div className="divide-y">
              {topSuppliers.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-muted-foreground">No suppliers</p>
              ) : topSuppliers.map((s: any, i: number) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.lead_time_days}d lead time</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5">
                    <Star className="h-3 w-3 text-warning fill-warning" />
                    <span className="text-xs font-semibold text-warning">{Number(s.rating ?? 0).toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top products by stock value */}
          <div className="rounded-xl border bg-card overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: '480ms', animationFillMode: 'forwards' }}>
            <div className="px-5 py-3 border-b bg-secondary/40 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Top Products by Stock Value</h3>
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="divide-y">
              {topProducts.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-muted-foreground">No products</p>
              ) : topProducts.map((p: any, i: number) => {
                const value = Number(p.unit_price) * Number(p.stock_quantity);
                const maxVal = Number(topProducts[0]?.unit_price ?? 1) * Number(topProducts[0]?.stock_quantity ?? 1);
                return (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                        <div className="mt-1 h-1.5 w-24 rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (value / maxVal) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-semibold text-foreground tabular-nums">${value.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{p.stock_quantity} units</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
