import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { StatCard } from '@/components/ui/stat-card';
import { Users, Package, ShoppingCart, TrendingUp, AlertTriangle, Truck } from 'lucide-react';
import { RecentOrdersTable } from '@/components/dashboard/RecentOrdersTable';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { KpiPanel } from '@/components/dashboard/KpiPanel';
import { AiInsightsPanel } from '@/components/dashboard/AiInsightsPanel';
import api from '@/lib/api';

export const AdminDashboard = () => {
  const navigate = useNavigate();

  const { data: overview } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get('/analytics/overview').then(r => r.data),
  });
  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get('/orders').then(r => r.data),
  });
  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get('/inventory').then(r => r.data),
  });
  const { data: shipments = [] } = useQuery({
    queryKey: ['shipments'],
    queryFn: () => api.get('/shipments').then(r => r.data),
  });

  const o   = overview?.orders    ?? {};
  const sup = overview?.suppliers ?? {};
  const inv = overview?.inventory ?? {};

  const pendingApproval  = (orders as any[]).filter(x => x.status === 'pending_approval').length;
  const awaitingSupplier = (orders as any[]).filter(x => x.status === 'awaiting_supplier_confirmation').length;
  const inTransitCount   = (shipments as any[]).filter(s => s.status === 'in_transit').length;
  const lowStockItems    = (inventory as any[]).filter(p => p.low_stock);

  return (
    <div className="space-y-6">

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ShoppingCart}
          label="Pending Approval"
          value={pendingApproval}
          change="Approve or reject →"
          changeType={pendingApproval > 0 ? 'negative' : 'neutral'}
          delay={0}
          onClick={() => navigate('/orders?status=pending_approval')}
          className={pendingApproval > 0 ? 'border-warning/40 bg-warning/5 ring-1 ring-warning/20' : ''}
        />
        <StatCard
          icon={Users}
          label="Awaiting Supplier"
          value={awaitingSupplier}
          change="Supplier confirmation pending"
          changeType={awaitingSupplier > 0 ? 'negative' : 'neutral'}
          delay={60}
          onClick={() => navigate('/orders?status=awaiting_supplier_confirmation')}
        />
        <StatCard
          icon={Truck}
          label="In Transit"
          value={inTransitCount}
          change="Track shipments →"
          changeType="positive"
          delay={120}
          onClick={() => navigate('/shipments')}
        />
        <StatCard
          icon={TrendingUp}
          label="Total Revenue"
          value={o.total_revenue ? `$${(Number(o.total_revenue) / 1000).toFixed(0)}K` : '—'}
          change="View analytics →"
          changeType="positive"
          delay={180}
          onClick={() => navigate('/analytics')}
        />
      </div>

      {/* ── KPI Panel ──────────────────────────────────────────────────────── */}
      <KpiPanel role="admin" />

      {/* ── Second row ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Package}
          label="Low Stock Items"
          value={inv.low_stock_count ?? '—'}
          change={inv.low_stock_count > 0 ? 'View low stock →' : 'All levels healthy'}
          changeType={inv.low_stock_count > 0 ? 'negative' : 'positive'}
          delay={0}
          onClick={() => navigate(inv.low_stock_count > 0 ? '/inventory?tab=low_stock' : '/inventory')}
          className={inv.low_stock_count > 0 ? 'border-destructive/40 bg-destructive/5 ring-1 ring-destructive/20' : ''}
        />
        <StatCard
          icon={Users}
          label="Active Suppliers"
          value={sup.total_suppliers ?? '—'}
          change="Manage suppliers →"
          changeType="positive"
          delay={60}
          onClick={() => navigate('/suppliers')}
        />
        <StatCard
          icon={ShoppingCart}
          label="Total Orders"
          value={o.total_orders ?? '—'}
          change="All time"
          changeType="neutral"
          delay={120}
          onClick={() => navigate('/orders')}
        />
        <StatCard
          icon={AlertTriangle}
          label="Pending Orders"
          value={o.pending_orders ?? '—'}
          change="Awaiting action"
          changeType="negative"
          delay={180}
          onClick={() => navigate('/orders?status=pending_approval')}
        />
      </div>

      {/* ── AI Insights ────────────────────────────────────────────────────── */}
      <AiInsightsPanel />

      {/* ── Tables ─────────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '240ms', animationFillMode: 'forwards' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Recent Orders</h3>
            <button onClick={() => navigate('/orders')} className="text-xs text-primary hover:underline">View all →</button>
          </div>
          <RecentOrdersTable />
        </div>
        <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}>
          <h3 className="text-sm font-semibold text-foreground mb-4">Activity Feed</h3>
          <ActivityFeed />
        </div>
      </div>

      {/* ── Low Stock + Active Shipments ────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '360ms', animationFillMode: 'forwards' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-semibold text-foreground">Low Stock Alerts</h3>
            </div>
            <button onClick={() => navigate('/inventory?tab=low_stock')} className="text-xs text-primary hover:underline">Manage →</button>
          </div>
          <div className="space-y-2">
            {lowStockItems.slice(0, 5).map((item: any) => (
              <div
                key={item.id}
                onClick={() => navigate('/inventory?tab=low_stock')}
                className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 cursor-pointer hover:bg-secondary transition-colors"
              >
                <span className="text-sm text-foreground">{item.name}</span>
                <span className="text-xs font-medium text-destructive">{item.stock_quantity} / {item.reorder_level}</span>
              </div>
            ))}
            {lowStockItems.length === 0 && <p className="text-xs text-muted-foreground">All items fully stocked</p>}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '420ms', animationFillMode: 'forwards' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-info" />
              <h3 className="text-sm font-semibold text-foreground">Active Shipments</h3>
            </div>
            <button onClick={() => navigate('/shipments')} className="text-xs text-primary hover:underline">View all →</button>
          </div>
          <div className="space-y-2">
            {(shipments as any[]).filter(s => s.status !== 'delivered').slice(0, 5).map((s: any) => (
              <div
                key={s.id}
                onClick={() => navigate('/shipments')}
                className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 cursor-pointer hover:bg-secondary transition-colors"
              >
                <div>
                  <span className="text-sm font-mono font-medium text-foreground">{s.id.slice(0, 8).toUpperCase()}</span>
                  {s.estimated_arrival && (
                    <p className="text-[11px] text-muted-foreground">ETA: {new Date(s.estimated_arrival).toLocaleDateString()}</p>
                  )}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  s.status === 'delivered'         ? 'bg-success/10 text-success' :
                  s.status === 'in_transit'        ? 'bg-info/10 text-info' :
                  s.status === 'delayed'           ? 'bg-destructive/10 text-destructive' :
                  'bg-warning/10 text-warning'
                }`}>{s.status.replace(/_/g, ' ')}</span>
              </div>
            ))}
            {(shipments as any[]).filter(s => s.status !== 'delivered').length === 0 && (
              <p className="text-xs text-muted-foreground">No active shipments</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
