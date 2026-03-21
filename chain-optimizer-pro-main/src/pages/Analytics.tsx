import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, Package, Users, Download, Star } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { exportCSV } from '@/lib/export';
import { toast } from 'sonner';
import api from '@/lib/api';

const COLORS = ['hsl(160, 84%, 28%)', 'hsl(210, 100%, 52%)', 'hsl(38, 92%, 50%)', 'hsl(220, 25%, 10%)'];

type DateRange = '1m' | '3m' | '6m' | 'all';

const Analytics = () => {
  const [dateRange, setDateRange] = useState<DateRange>('all');

  const { data: overview } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get('/analytics/overview').then(r => r.data),
  });
  const { data: ordersChartRaw = [] } = useQuery({
    queryKey: ['analytics-orders-chart'],
    queryFn: () => api.get('/analytics/orders').then(r => r.data),
  });
  const { data: inventoryChartRaw = [] } = useQuery({
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

  // Filter chart data by date range
  const filterByRange = (data: any[]) => {
    if (dateRange === 'all') return data;
    const months = dateRange === '1m' ? 1 : dateRange === '3m' ? 3 : 6;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return data.filter((r: any) => new Date(r.month) >= cutoff);
  };

  const ordersChart = filterByRange(ordersChartRaw).map((r: any) => ({
    month: new Date(r.month).toLocaleString('default', { month: 'short', year: '2-digit' }),
    orders: Number(r.count),
    revenue: Number(r.revenue),
  }));

  const inventoryChart = inventoryChartRaw.map((r: any) => ({
    name: r.category,
    value: Number(r.product_count),
  }));

  const o = overview?.orders ?? {};
  const inv = overview?.inventory ?? {};
  const sup = overview?.suppliers ?? {};

  // Top suppliers by rating
  const topSuppliers = [...suppliersRaw]
    .filter((s: any) => s.is_active)
    .sort((a: any, b: any) => Number(b.rating) - Number(a.rating))
    .slice(0, 5);

  // Top products by stock value
  const topProducts = [...productsRaw]
    .sort((a: any, b: any) => Number(b.unit_price) * Number(b.stock_quantity) - Number(a.unit_price) * Number(a.stock_quantity))
    .slice(0, 5);

  const handleExport = () => {
    exportCSV('analytics-orders', ordersChart);
    toast.success('Analytics exported');
  };

  const totalRevenue = o.total_revenue ? Number(o.total_revenue) : 0;
  const revenueDisplay = totalRevenue >= 1000 ? `$${(totalRevenue / 1000).toFixed(1)}K` : `$${totalRevenue.toFixed(0)}`;

  return (
    <div>
      <Header title="Analytics" subtitle="Business intelligence and KPIs" />
      <div className="p-6 space-y-6">

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg border p-1">
            {(['1m', '3m', '6m', 'all'] as DateRange[]).map(r => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  dateRange === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >{r === 'all' ? 'All Time' : r === '1m' ? '1 Month' : r === '3m' ? '3 Months' : '6 Months'}</button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1" />Export
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
          <StatCard icon={Users} label="Active Suppliers" value={sup.active_suppliers ?? sup.total_suppliers ?? '—'}
            change={`of ${sup.total_suppliers ?? 0} total`} changeType="neutral" delay={180} />
        </div>

        {/* Charts row */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Monthly orders bar chart */}
          <div className="lg:col-span-2 rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '240ms', animationFillMode: 'forwards' }}>
            <h3 className="text-sm font-semibold text-foreground mb-4">Monthly Orders & Revenue</h3>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ordersChart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 91%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 46%)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 46%)" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(215,20%,91%)', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="orders" name="Orders" fill="hsl(160, 84%, 28%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category pie chart */}
          <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}>
            <h3 className="text-sm font-semibold text-foreground mb-4">Products by Category</h3>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={inventoryChart} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={4} dataKey="value">
                    {inventoryChart.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(215,20%,91%)', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1.5">
              {inventoryChart.map((c: any, i: number) => (
                <div key={c.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-foreground">{c.name}</span>
                  </span>
                  <span className="text-muted-foreground tabular-nums">{c.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Revenue trend line chart */}
        {ordersChart.length > 1 && (
          <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '360ms', animationFillMode: 'forwards' }}>
            <h3 className="text-sm font-semibold text-foreground mb-4">Revenue Trend</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ordersChart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 91%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 46%)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 46%)" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(215,20%,91%)', fontSize: 12 }}
                    formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Revenue']} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(160, 84%, 28%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

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
                      <p className="text-xs text-muted-foreground">{s.lead_time_days} day lead time</p>
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
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(value / maxVal) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-foreground tabular-nums">${value.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{p.stock_quantity} units</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Revenue vs orders comparison */}
        {ordersChart.length > 0 && (
          <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '540ms', animationFillMode: 'forwards' }}>
            <h3 className="text-sm font-semibold text-foreground mb-4">Orders vs Revenue Comparison</h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ordersChart} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 91%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 46%)" />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 46%)" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 46%)" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(215,20%,91%)', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="orders" name="Orders" fill="hsl(160, 84%, 28%)" radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="right" dataKey="revenue" name="Revenue ($)" fill="hsl(210, 100%, 52%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
