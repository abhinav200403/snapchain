import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, Target, Clock, Star, Package, BarChart2, Truck } from 'lucide-react';
import type { AppRole } from '@/types/roles';
import api from '@/lib/api';

interface KpiData {
  fulfillment_rate: number;
  avg_days_to_deliver: number | null;
  revenue_growth: number;
  avg_supplier_rating: number;
  avg_lead_time: number;
  total_active_suppliers: number;
  total_products: number;
  low_stock_count: number;
  inventory_value: number;
  rejection_rate: number;
  in_progress_orders: number;
  this_month_revenue: number;
  last_month_revenue: number;
}

interface KpiItemProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  good?: boolean;
}

const KpiItem: React.FC<KpiItemProps> = ({ icon: Icon, label, value, sub, trend, good }) => {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'neutral' ? 'text-muted-foreground' : good ? 'text-success' : 'text-destructive';

  return (
    <div className="flex items-center gap-3 rounded-lg bg-secondary/40 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
      {trend && (
        <TrendIcon className={`h-4 w-4 shrink-0 ${trendColor}`} />
      )}
    </div>
  );
};

const AdminKpis: React.FC<{ data: KpiData }> = ({ data }) => (
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <KpiItem
      icon={Target}
      label="Fulfillment Rate"
      value={`${data.fulfillment_rate}%`}
      sub="Orders delivered successfully"
      trend={data.fulfillment_rate >= 80 ? 'up' : 'down'}
      good={data.fulfillment_rate >= 80}
    />
    <KpiItem
      icon={Clock}
      label="Avg Delivery Time"
      value={data.avg_days_to_deliver != null ? `${data.avg_days_to_deliver}d` : 'N/A'}
      sub="Days from order to delivery"
      trend={data.avg_days_to_deliver != null ? (data.avg_days_to_deliver <= 7 ? 'up' : 'down') : 'neutral'}
      good={data.avg_days_to_deliver != null && data.avg_days_to_deliver <= 7}
    />
    <KpiItem
      icon={TrendingUp}
      label="Revenue Growth"
      value={`${data.revenue_growth > 0 ? '+' : ''}${data.revenue_growth}%`}
      sub="vs last month"
      trend={data.revenue_growth > 0 ? 'up' : data.revenue_growth < 0 ? 'down' : 'neutral'}
      good={data.revenue_growth >= 0}
    />
    <KpiItem
      icon={Star}
      label="Supplier Reliability"
      value={`${data.avg_supplier_rating.toFixed(1)} / 5`}
      sub={`${data.total_active_suppliers} active suppliers`}
      trend={data.avg_supplier_rating >= 4 ? 'up' : data.avg_supplier_rating >= 3 ? 'neutral' : 'down'}
      good={data.avg_supplier_rating >= 4}
    />
  </div>
);

const OpsKpis: React.FC<{ data: KpiData }> = ({ data }) => (
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <KpiItem
      icon={Clock}
      label="Avg Processing Time"
      value={data.avg_days_to_deliver != null ? `${data.avg_days_to_deliver}d` : 'N/A'}
      sub="Order to delivery"
      trend={data.avg_days_to_deliver != null ? (data.avg_days_to_deliver <= 7 ? 'up' : 'down') : 'neutral'}
      good={data.avg_days_to_deliver != null && data.avg_days_to_deliver <= 7}
    />
    <KpiItem
      icon={Target}
      label="Fulfillment Rate"
      value={`${data.fulfillment_rate}%`}
      sub="Successfully fulfilled"
      trend={data.fulfillment_rate >= 80 ? 'up' : 'down'}
      good={data.fulfillment_rate >= 80}
    />
    <KpiItem
      icon={Package}
      label="Inventory Health"
      value={`${Math.round(((data.total_products - data.low_stock_count) / Math.max(data.total_products, 1)) * 100)}%`}
      sub={`${data.low_stock_count} items below threshold`}
      trend={data.low_stock_count === 0 ? 'up' : data.low_stock_count <= 2 ? 'neutral' : 'down'}
      good={data.low_stock_count === 0}
    />
    <KpiItem
      icon={Star}
      label="Supplier Avg Rating"
      value={`${data.avg_supplier_rating.toFixed(1)} / 5`}
      sub={`Avg lead time: ${data.avg_lead_time}d`}
      trend={data.avg_supplier_rating >= 4 ? 'up' : 'neutral'}
      good={data.avg_supplier_rating >= 4}
    />
  </div>
);

const SupplierKpis: React.FC<{ data: KpiData; orders: any[] }> = ({ data, orders }) => {
  const total = orders.length || 1;
  const accepted = orders.filter(o => ['accepted_by_supplier', 'processing', 'dispatched', 'in_transit', 'delivered'].includes(o.status)).length;
  const rejected = orders.filter(o => o.status === 'rejected').length;
  const delivered = orders.filter(o => o.status === 'delivered').length;

  const acceptanceRate = Math.round((accepted / total) * 100);
  const onTimeRate = total > 0 ? Math.round((delivered / total) * 100) : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiItem
        icon={Target}
        label="Acceptance Rate"
        value={`${acceptanceRate}%`}
        sub="Fulfillment requests accepted"
        trend={acceptanceRate >= 80 ? 'up' : 'down'}
        good={acceptanceRate >= 80}
      />
      <KpiItem
        icon={BarChart2}
        label="Rejection Rate"
        value={`${Math.round((rejected / total) * 100)}%`}
        sub={`${rejected} order${rejected !== 1 ? 's' : ''} rejected`}
        trend={rejected === 0 ? 'up' : rejected <= 1 ? 'neutral' : 'down'}
        good={rejected === 0}
      />
      <KpiItem
        icon={Truck}
        label="On-Time Delivery"
        value={`${onTimeRate}%`}
        sub={`${delivered} delivered`}
        trend={onTimeRate >= 90 ? 'up' : onTimeRate >= 70 ? 'neutral' : 'down'}
        good={onTimeRate >= 90}
      />
      <KpiItem
        icon={Clock}
        label="Avg Lead Time"
        value={data.avg_lead_time > 0 ? `${data.avg_lead_time}d` : 'N/A'}
        sub="Days to fulfill"
        trend={data.avg_lead_time > 0 ? (data.avg_lead_time <= 5 ? 'up' : 'neutral') : 'neutral'}
        good={data.avg_lead_time <= 5}
      />
    </div>
  );
};

export const KpiPanel: React.FC<{ role: AppRole; orders?: any[] }> = ({ role, orders = [] }) => {
  const { data: kpiData, isLoading } = useQuery({
    queryKey: ['kpis'],
    queryFn: () => api.get('/analytics/kpis').then(r => r.data),
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 rounded-lg bg-secondary/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!kpiData) return null;

  return (
    <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
      <div className="mb-3 flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Performance KPIs</h3>
        <span className="text-xs text-muted-foreground">— This period</span>
      </div>
      {role === 'admin' && <AdminKpis data={kpiData} />}
      {role === 'operations_manager' && <OpsKpis data={kpiData} />}
      {role === 'supplier' && <SupplierKpis data={kpiData} orders={orders} />}
    </div>
  );
};
