import { useQuery } from '@tanstack/react-query';
import { StatCard } from '@/components/ui/stat-card';
import { Users, Package, ShoppingCart, TrendingUp, AlertTriangle, Truck } from 'lucide-react';
import { RecentOrdersTable } from '@/components/dashboard/RecentOrdersTable';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import api from '@/lib/api';

export const AdminDashboard = () => {
  const { data: overview } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get('/analytics/overview').then(r => r.data),
  });
  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get('/inventory').then(r => r.data),
  });
  const { data: shipments = [] } = useQuery({
    queryKey: ['shipments'],
    queryFn: () => api.get('/shipments').then(r => r.data),
  });

  const o = overview?.orders ?? {};
  const inv = overview?.inventory ?? {};
  const sup = overview?.suppliers ?? {};

  const lowStockItems = inventory.filter((p: any) => p.low_stock);
  const activeShipments = shipments.filter((s: any) => s.status !== 'delivered');

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Active Suppliers" value={sup.total_suppliers ?? '—'} change="In network" changeType="positive" delay={0} />
        <StatCard icon={Package} label="Low Stock" value={inv.low_stock_count ?? '—'} change="Items below threshold" changeType="negative" delay={60} />
        <StatCard icon={ShoppingCart} label="Pending Orders" value={o.pending_orders ?? '—'} change="Awaiting action" changeType="neutral" delay={120} />
        <StatCard icon={TrendingUp} label="Total Revenue" value={o.total_revenue ? `$${(Number(o.total_revenue) / 1000).toFixed(0)}K` : '—'} change="All time" changeType="positive" delay={180} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '240ms', animationFillMode: 'forwards' }}>
          <h3 className="text-sm font-semibold text-foreground mb-4">Recent Orders</h3>
          <RecentOrdersTable />
        </div>
        <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}>
          <h3 className="text-sm font-semibold text-foreground mb-4">Activity Feed</h3>
          <ActivityFeed />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '360ms', animationFillMode: 'forwards' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-semibold text-foreground">Low Stock Alerts</h3>
          </div>
          <div className="space-y-3">
            {lowStockItems.slice(0, 4).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2.5">
                <span className="text-sm text-foreground">{item.name}</span>
                <span className="text-xs font-medium text-destructive">{item.stock_quantity}/{item.reorder_level}</span>
              </div>
            ))}
            {lowStockItems.length === 0 && <p className="text-xs text-muted-foreground">All items fully stocked</p>}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '420ms', animationFillMode: 'forwards' }}>
          <div className="flex items-center gap-2 mb-3">
            <Truck className="h-4 w-4 text-info" />
            <h3 className="text-sm font-semibold text-foreground">Active Shipments</h3>
          </div>
          <div className="space-y-3">
            {activeShipments.slice(0, 4).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2.5">
                <div>
                  <span className="text-sm font-medium text-foreground font-mono">{s.id.slice(0, 8).toUpperCase()}</span>
                  {s.estimated_arrival && <p className="text-[11px] text-muted-foreground">ETA: {new Date(s.estimated_arrival).toLocaleDateString()}</p>}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  s.status === 'delivered' ? 'bg-success/10 text-success' :
                  s.status === 'in_transit' ? 'bg-info/10 text-info' :
                  s.status === 'delayed' ? 'bg-destructive/10 text-destructive' :
                  'bg-warning/10 text-warning'
                }`}>{s.status.replace('_', ' ')}</span>
              </div>
            ))}
            {activeShipments.length === 0 && <p className="text-xs text-muted-foreground">No active shipments</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
