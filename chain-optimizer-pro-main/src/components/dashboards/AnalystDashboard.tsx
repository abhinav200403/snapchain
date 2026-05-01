import { useQuery } from '@tanstack/react-query';
import { StatCard } from '@/components/ui/stat-card';
import { BarChart3, TrendingUp, Users, Brain } from 'lucide-react';
import {
  ComposedChart, Bar, Line, BarChart,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  Area, AreaChart, Cell,
} from 'recharts';
import api from '@/lib/api';

// Generate the last N months and fill in 0s for any month with no data
function buildMonthlyChart(raw: any[], months = 12) {
  const slots = Array.from({ length: months }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (months - 1 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    return { key, month: label, orders: 0, revenue: 0 };
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

const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: '1px solid hsl(215, 20%, 91%)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: 13,
};

const ratingColor = (rating: number) => {
  if (rating >= 4) return 'hsl(160, 84%, 28%)';
  if (rating >= 3) return 'hsl(38, 92%, 50%)';
  return 'hsl(0, 84%, 60%)';
};

export const AnalystDashboard = () => {
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
    queryKey: ['analytics-suppliers-chart'],
    queryFn: () => api.get('/analytics/suppliers').then(r => r.data),
  });

  const ordersChart = buildMonthlyChart(ordersChartRaw);

  const inventoryChart = inventoryRaw.map((p: any) => ({
    name: p.name.length > 16 ? p.name.slice(0, 15) + '…' : p.name,
    stock: Number(p.stock_quantity),
    threshold: Number(p.reorder_level),
  }));

  const suppliersChart = suppliersRaw.map((s: any) => ({
    name: s.name.length > 14 ? s.name.slice(0, 13) + '…' : s.name,
    rating: Number(s.rating ?? 0),
    leadTime: Number(s.lead_time_days ?? 0),
  }));

  const o = overview?.orders ?? {};
  const sup = overview?.suppliers ?? {};
  const inv = overview?.inventory ?? {};

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={BarChart3} label="Total Revenue" value={o.total_revenue ? `$${(Number(o.total_revenue) / 1000).toFixed(0)}K` : '—'} change="All time" changeType="positive" delay={0} />
        <StatCard icon={TrendingUp} label="Total Orders" value={o.total_orders ?? '—'} change="All time" changeType="positive" delay={60} />
        <StatCard icon={Users} label="Active Suppliers" value={sup.total_suppliers ?? '—'} change="In network" changeType="positive" delay={120} />
        <StatCard icon={Brain} label="Low Stock Alerts" value={inv.low_stock_count ?? '—'} change="Needs attention" changeType="neutral" delay={180} />
      </div>

      {/* Order Volume & Revenue Trend */}
      <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '240ms', animationFillMode: 'forwards' }}>
        <h3 className="text-sm font-semibold text-foreground mb-1">Order Volume & Revenue</h3>
        <p className="text-xs text-muted-foreground mb-4">Last 12 months</p>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={ordersChart} margin={{ top: 4, right: 16, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215,20%,91%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(220,10%,60%)" tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="hsl(220,10%,60%)" tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="hsl(220,10%,60%)" tickLine={false} axisLine={false}
                tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} />
              <Tooltip contentStyle={TOOLTIP_STYLE}
                formatter={(val: any, name: string) => name === 'Revenue' ? [`$${Number(val).toLocaleString()}`, name] : [val, name]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="orders" name="Orders" fill="hsl(160,84%,28%)" radius={[3,3,0,0]} maxBarSize={28} />
              <Area yAxisId="right" type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(217,91%,60%)" fill="url(#gradRevenue)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Inventory Levels + Supplier Ratings */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Inventory bar chart */}
        <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '320ms', animationFillMode: 'forwards' }}>
          <h3 className="text-sm font-semibold text-foreground mb-1">Inventory Levels</h3>
          <p className="text-xs text-muted-foreground mb-4">Stock vs reorder threshold</p>
          <div className="h-[240px]">
            {inventoryChart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No inventory data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryChart} margin={{ top: 4, right: 4, bottom: 40, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215,20%,91%)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(220,10%,60%)" tickLine={false}
                    angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(220,10%,60%)" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="top" />
                  <Bar dataKey="stock" name="Current Stock" fill="hsl(160,84%,28%)" radius={[3,3,0,0]} maxBarSize={22} />
                  <Bar dataKey="threshold" name="Reorder Level" fill="hsl(38,92%,50%)" radius={[3,3,0,0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Supplier ratings bar chart */}
        <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '400ms', animationFillMode: 'forwards' }}>
          <h3 className="text-sm font-semibold text-foreground mb-1">Supplier Performance</h3>
          <p className="text-xs text-muted-foreground mb-4">Rating out of 5.0</p>
          <div className="h-[240px]">
            {suppliersChart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No supplier data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={suppliersChart} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215,20%,91%)" horizontal={false} />
                  <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} stroke="hsl(220,10%,60%)" tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(220,10%,60%)" tickLine={false} axisLine={false} width={80} />
                  <Tooltip contentStyle={TOOLTIP_STYLE}
                    formatter={(val: any) => [`${Number(val).toFixed(1)} / 5.0`, 'Rating']} />
                  <Bar dataKey="rating" name="Rating" radius={[0,3,3,0]} maxBarSize={24}>
                    {suppliersChart.map((entry: any, i: number) => (
                      <Cell key={i} fill={ratingColor(entry.rating)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Lead Time comparison */}
      <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '480ms', animationFillMode: 'forwards' }}>
        <h3 className="text-sm font-semibold text-foreground mb-1">Supplier Lead Times</h3>
        <p className="text-xs text-muted-foreground mb-4">Days from order to delivery</p>
        <div className="h-[200px]">
          {suppliersChart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No supplier data</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={suppliersChart} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215,20%,91%)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(220,10%,60%)" tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(220,10%,60%)" tickLine={false} axisLine={false}
                  label={{ value: 'days', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'hsl(220,10%,60%)' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: any) => [`${val} days`, 'Lead Time']} />
                <Bar dataKey="leadTime" name="Lead Time (days)" fill="hsl(217,91%,60%)" radius={[3,3,0,0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};
