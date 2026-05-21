import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { StatCard } from '@/components/ui/stat-card';
import { Package, ShoppingCart, AlertTriangle, Truck, UserCog, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import { LowStockPanel } from '@/components/dashboard/LowStockPanel';
import { KpiPanel } from '@/components/dashboard/KpiPanel';
import { toast } from 'sonner';
import api from '@/lib/api';

const STATUS_LABEL: Record<string, string> = {
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  awaiting_supplier_confirmation: 'Awaiting Supplier',
  accepted_by_supplier: 'Accepted',
  processing: 'Processing',
  dispatched: 'Dispatched',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const ManagerDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [lowStockOpen, setLowStockOpen] = useState(false);

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

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] });
      toast.success(vars.status === 'approved' ? 'Order approved' : 'Order rejected');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Action failed'),
  });

  const inv = overview?.inventory ?? {};
  const sh  = overview?.shipments ?? {};

  const pendingOrders    = (orders as any[]).filter(x => x.status === 'pending_approval');
  const awaitingOrders   = (orders as any[]).filter(x => x.status === 'awaiting_supplier_confirmation');
  const pendingApproval  = pendingOrders.length;
  const awaitingSupplier = awaitingOrders.length;
  const lowStockCount    = inv.low_stock_count ?? 0;
  const lowStockItems    = (inventory as any[]).filter(p => p.low_stock || Number(p.stock_quantity) <= Number(p.reorder_level));

  return (
    <div className="space-y-6">

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ShoppingCart}
          label="Pending Approval"
          value={pendingApproval}
          change="Approve or assign supplier →"
          changeType={pendingApproval > 0 ? 'negative' : 'neutral'}
          delay={0}
          onClick={() => navigate('/orders?status=pending_approval')}
          className={pendingApproval > 0 ? 'border-warning/40 bg-warning/5 ring-1 ring-warning/20' : ''}
        />

        <StatCard
          icon={UserCog}
          label="Awaiting Supplier"
          value={awaitingSupplier}
          change="Monitor supplier response →"
          changeType={awaitingSupplier > 0 ? 'negative' : 'neutral'}
          delay={60}
          onClick={() => navigate('/orders?status=awaiting_supplier_confirmation')}
        />

        <StatCard
          icon={Package}
          label="Low Stock Items"
          value={lowStockCount}
          change={lowStockCount > 0 ? 'Click to reorder →' : 'All levels healthy'}
          changeType={lowStockCount > 0 ? 'negative' : 'positive'}
          delay={120}
          onClick={lowStockCount > 0 ? () => setLowStockOpen(true) : () => navigate('/inventory')}
          className={lowStockCount > 0 ? 'border-destructive/40 bg-destructive/5 ring-1 ring-destructive/20' : ''}
        />

        <StatCard
          icon={Truck}
          label="In Transit"
          value={sh.in_transit ?? '—'}
          change="Track shipments →"
          changeType="positive"
          delay={180}
          onClick={() => navigate('/shipments')}
        />
      </div>

      {/* ── KPI Panel ──────────────────────────────────────────────────────── */}
      <KpiPanel role="operations_manager" />

      {/* ── Quick Action Panels ─────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Pending Approval quick actions */}
        <div
          className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up"
          style={{ animationDelay: '240ms', animationFillMode: 'forwards' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-semibold text-foreground">Pending Approval</h3>
              {pendingApproval > 0 && (
                <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-bold text-warning">
                  {pendingApproval}
                </span>
              )}
            </div>
            <button onClick={() => navigate('/orders?status=pending_approval')} className="text-xs text-primary hover:underline flex items-center gap-0.5">
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {pendingOrders.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No orders pending approval</p>
          ) : (
            <div className="space-y-2">
              {pendingOrders.slice(0, 3).map((o: any) => (
                <div key={o.id} className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-semibold text-foreground">#{o.po_number ?? o.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">${Number(o.total_amount).toLocaleString()} · {new Date(o.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => statusMutation.mutate({ id: o.id, status: 'approved' })}
                      disabled={statusMutation.isPending}
                      className="flex items-center gap-1 rounded-md bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success hover:bg-success/20 transition-colors"
                    >
                      <CheckCircle className="h-3 w-3" />Approve
                    </button>
                    <button
                      onClick={() => statusMutation.mutate({ id: o.id, status: 'rejected' })}
                      disabled={statusMutation.isPending}
                      className="flex items-center gap-1 rounded-md bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      <XCircle className="h-3 w-3" />Reject
                    </button>
                  </div>
                </div>
              ))}
              {pendingApproval > 3 && (
                <button onClick={() => navigate('/orders?status=pending_approval')} className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 text-center hover:bg-secondary rounded-lg transition-colors">
                  + {pendingApproval - 3} more orders waiting
                </button>
              )}
            </div>
          )}
        </div>

        {/* Low Stock quick view */}
        <div
          className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up"
          style={{ animationDelay: '320ms', animationFillMode: 'forwards' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <h3 className="text-sm font-semibold text-foreground">Low Stock Alerts</h3>
              {lowStockCount > 0 && (
                <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                  {lowStockCount}
                </span>
              )}
            </div>
            <button onClick={() => navigate('/inventory?tab=low_stock')} className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Manage <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {lowStockItems.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">All inventory levels healthy</p>
          ) : (
            <div className="space-y-2">
              {lowStockItems.slice(0, 3).map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => navigate('/inventory?tab=low_stock')}
                  className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2.5 cursor-pointer hover:bg-secondary transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-destructive">{item.stock_quantity}</p>
                    <p className="text-[10px] text-muted-foreground">/ {item.reorder_level} min</p>
                  </div>
                </div>
              ))}
              {lowStockCount > 3 && (
                <button onClick={() => navigate('/inventory?tab=low_stock')} className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 text-center hover:bg-secondary rounded-lg transition-colors">
                  + {lowStockCount - 3} more items below threshold
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <LowStockPanel open={lowStockOpen} onOpenChange={setLowStockOpen} />
    </div>
  );
};
