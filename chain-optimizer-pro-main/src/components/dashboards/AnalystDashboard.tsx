import { useQuery } from '@tanstack/react-query';
import { StatCard } from '@/components/ui/stat-card';
import { BarChart3, TrendingUp, Users, Brain } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '@/lib/api';

export const AnalystDashboard = () => {
  const { data: overview } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get('/analytics/overview').then(r => r.data),
  });
  const { data: ordersChartRaw = [] } = useQuery({
    queryKey: ['analytics-orders-chart'],
    queryFn: () => api.get('/analytics/orders').then(r => r.data),
  });

  const ordersChart = ordersChartRaw.map((r: any) => ({
    month: new Date(r.month).toLocaleString('default', { month: 'short' }),
    orders: Number(r.count),
  }));

  const o = overview?.orders ?? {};
  const sup = overview?.suppliers ?? {};
  const inv = overview?.inventory ?? {};

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={BarChart3} label="Total Revenue" value={o.total_revenue ? `$${(Number(o.total_revenue) / 1000).toFixed(0)}K` : '—'} change="All time" changeType="positive" delay={0} />
        <StatCard icon={TrendingUp} label="Total Orders" value={o.total_orders ?? '—'} change="All time" changeType="positive" delay={60} />
        <StatCard icon={Users} label="Active Suppliers" value={sup.total_suppliers ?? '—'} change="In network" changeType="positive" delay={120} />
        <StatCard icon={Brain} label="Low Stock Alerts" value={inv.low_stock_count ?? '—'} change="Needs attention" changeType="neutral" delay={180} />
      </div>

      <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '240ms', animationFillMode: 'forwards' }}>
        <h3 className="text-sm font-semibold text-foreground mb-1">Order Trends</h3>
        <p className="text-xs text-muted-foreground mb-4">Monthly order volume</p>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={ordersChart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(160, 84%, 28%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(160, 84%, 28%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 91%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 46%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 46%)" />
              <Tooltip
                contentStyle={{
                  borderRadius: 8, border: '1px solid hsl(215, 20%, 91%)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 13,
                }}
              />
              <Area type="monotone" dataKey="orders" stroke="hsl(160, 84%, 28%)" fillOpacity={1} fill="url(#colorOrders)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
