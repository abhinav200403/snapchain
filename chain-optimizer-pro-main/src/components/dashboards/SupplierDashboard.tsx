import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { StatCard } from '@/components/ui/stat-card';
import { ShoppingCart, Clock, CheckCircle, Truck, ChevronRight, XCircle } from 'lucide-react';
import { useState } from 'react';
import { DispatchDialog } from '@/components/modals/DispatchDialog';
import { KpiPanel } from '@/components/dashboard/KpiPanel';
import { toast } from 'sonner';
import api from '@/lib/api';

export const SupplierDashboard = () => {
  const navigate = useNavigate();
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchOrderId, setDispatchOrderId] = useState<string>();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get('/orders').then(r => r.data),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(
        vars.status === 'accepted_by_supplier'
          ? 'Fulfillment confirmed'
          : 'Fulfillment rejected',
      );
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Action failed'),
  });

  const fulfillmentRequests = (orders as any[]).filter(o => o.status === 'awaiting_supplier_confirmation');
  const total             = orders.length;
  const awaitingCount     = fulfillmentRequests.length;
  const inProgressCount   = (orders as any[]).filter(o =>
    ['accepted_by_supplier', 'processing', 'dispatched'].includes(o.status)
  ).length;
  const inTransitCount    = (orders as any[]).filter(o => o.status === 'in_transit').length;
  const deliveredCount    = (orders as any[]).filter(o => o.status === 'delivered').length;

  return (
    <div className="space-y-6">

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ShoppingCart}
          label="Total Orders"
          value={total}
          change="View all →"
          changeType="neutral"
          delay={0}
          onClick={() => navigate('/orders')}
        />
        <StatCard
          icon={Clock}
          label="Fulfillment Requests"
          value={awaitingCount}
          change={awaitingCount > 0 ? 'Confirm or reject →' : 'None pending'}
          changeType={awaitingCount > 0 ? 'negative' : 'neutral'}
          delay={60}
          onClick={() => navigate('/orders?status=awaiting_supplier_confirmation')}
          className={awaitingCount > 0 ? 'border-warning/40 bg-warning/5 ring-1 ring-warning/20' : ''}
        />
        <StatCard
          icon={Truck}
          label="In Progress"
          value={inProgressCount}
          change="Active fulfillments →"
          changeType="neutral"
          delay={120}
          onClick={() => navigate('/orders?status=accepted_by_supplier')}
        />
        <StatCard
          icon={CheckCircle}
          label="Delivered"
          value={deliveredCount}
          change="View completed →"
          changeType="positive"
          delay={180}
          onClick={() => navigate('/orders?status=delivered')}
        />
      </div>

      {/* ── KPI Panel ──────────────────────────────────────────────────────── */}
      <KpiPanel role="supplier" orders={orders as any[]} />

      {/* ── Fulfillment Requests Quick Actions ─────────────────────────────── */}
      <div
        className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up"
        style={{ animationDelay: '240ms', animationFillMode: 'forwards' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-semibold text-foreground">Fulfillment Requests</h3>
            {awaitingCount > 0 && (
              <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-bold text-warning">
                {awaitingCount} pending
              </span>
            )}
          </div>
          <button
            onClick={() => navigate('/orders?status=awaiting_supplier_confirmation')}
            className="text-xs text-primary hover:underline flex items-center gap-0.5"
          >
            View all <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-4 text-sm">Loading…</div>
        ) : fulfillmentRequests.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No pending fulfillment requests</div>
        ) : (
          <div className="space-y-2">
            {fulfillmentRequests.slice(0, 3).map((o: any) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-mono font-semibold text-foreground">#{o.po_number ?? o.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground">${Number(o.total_amount).toLocaleString()} · {new Date(o.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => statusMutation.mutate({ id: o.id, status: 'accepted_by_supplier' })}
                    disabled={statusMutation.isPending}
                    className="flex items-center gap-1 rounded-md bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success hover:bg-success/20 transition-colors"
                  >
                    <CheckCircle className="h-3 w-3" />Confirm
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
            {awaitingCount > 3 && (
              <button onClick={() => navigate('/orders?status=awaiting_supplier_confirmation')} className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 text-center hover:bg-secondary rounded-lg transition-colors">
                + {awaitingCount - 3} more requests
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Recent Orders Table ──────────────────────────────────────────────── */}
      <div
        className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up"
        style={{ animationDelay: '320ms', animationFillMode: 'forwards' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">All Orders</h3>
          <button onClick={() => navigate('/orders')} className="text-xs text-primary hover:underline">View all →</button>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Order ID</th>
                  <th className="pb-3 font-medium">Total</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(orders as any[]).slice(0, 6).map((o: any) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="py-3 font-mono text-xs font-semibold text-foreground">{o.po_number ?? o.id.slice(0, 8).toUpperCase()}</td>
                    <td className="py-3 text-muted-foreground tabular-nums">${Number(o.total_amount).toLocaleString()}</td>
                    <td className="py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        o.status === 'awaiting_supplier_confirmation' ? 'bg-warning/10 text-warning' :
                        o.status === 'accepted_by_supplier'           ? 'bg-info/10 text-info' :
                        o.status === 'processing'                     ? 'bg-primary/10 text-primary' :
                        o.status === 'dispatched'                     ? 'bg-orange-500/10 text-orange-600' :
                        o.status === 'in_transit'                     ? 'bg-sky-500/10 text-sky-600' :
                        o.status === 'delivered'                      ? 'bg-success/10 text-success' :
                        o.status === 'rejected'                       ? 'bg-destructive/10 text-destructive' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {o.status.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </span>
                    </td>
                    <td className="py-3 text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        {o.status === 'accepted_by_supplier' && (
                          <button
                            onClick={() => { setDispatchOrderId(o.id); setDispatchOpen(true); }}
                            className="rounded-md bg-info/10 px-2.5 py-1 text-[11px] font-medium text-info hover:bg-info/20 transition-colors"
                          >Add Dispatch</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DispatchDialog
        open={dispatchOpen}
        onOpenChange={setDispatchOpen}
        orderId={dispatchOrderId}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['orders', 'shipments'] })}
      />
    </div>
  );
};
