import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StatCard } from '@/components/ui/stat-card';
import { Package, ShoppingCart, AlertTriangle, Truck } from 'lucide-react';
import { RecentOrdersTable } from '@/components/dashboard/RecentOrdersTable';
import { LowStockPanel } from '@/components/dashboard/LowStockPanel';
import api from '@/lib/api';

export const ManagerDashboard = () => {
  const [lowStockOpen, setLowStockOpen] = useState(false);

  const { data: overview } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get('/analytics/overview').then(r => r.data),
  });

  const o = overview?.orders ?? {};
  const inv = overview?.inventory ?? {};
  const sh = overview?.shipments ?? {};

  const lowStockCount = inv.low_stock_count ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ShoppingCart}
          label="Total Orders"
          value={o.total_orders ?? '—'}
          change="All time"
          changeType="neutral"
          delay={0}
        />

        {/* Low Stock Card — clickable, red-highlighted when there are issues */}
        <StatCard
          icon={Package}
          label="Low Stock Items"
          value={lowStockCount}
          change={lowStockCount > 0 ? 'Click to reorder →' : 'All levels healthy'}
          changeType={lowStockCount > 0 ? 'negative' : 'positive'}
          delay={60}
          clickable={lowStockCount > 0}
          onClick={lowStockCount > 0 ? () => setLowStockOpen(true) : undefined}
          className={
            lowStockCount > 0
              ? 'border-destructive/40 bg-destructive/5 ring-1 ring-destructive/20'
              : ''
          }
        />

        <StatCard
          icon={Truck}
          label="In Transit"
          value={sh.in_transit ?? '—'}
          change="Shipments"
          changeType="positive"
          delay={120}
        />
        <StatCard
          icon={AlertTriangle}
          label="Pending Orders"
          value={o.pending_orders ?? '—'}
          change="Awaiting action"
          changeType="negative"
          delay={180}
        />
      </div>

      <div
        className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up"
        style={{ animationDelay: '240ms', animationFillMode: 'forwards' }}
      >
        <h3 className="text-sm font-semibold text-foreground mb-4">Recent Orders</h3>
        <RecentOrdersTable />
      </div>

      <LowStockPanel open={lowStockOpen} onOpenChange={setLowStockOpen} />
    </div>
  );
};
