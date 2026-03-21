import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StatCard } from '@/components/ui/stat-card';
import { ShoppingCart, Clock, CheckCircle, Truck } from 'lucide-react';
import { useState } from 'react';
import { DispatchDialog } from '@/components/modals/DispatchDialog';
import { toast } from 'sonner';
import api from '@/lib/api';

export const SupplierDashboard = () => {
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
      toast.success(`Order ${vars.status === 'processing' ? 'accepted' : 'rejected'}`);
    },
    onError: () => toast.error('Action failed'),
  });

  const openDispatch = (id: string) => {
    setDispatchOrderId(id);
    setDispatchOpen(true);
  };

  const total = orders.length;
  const pending = orders.filter((o: any) => o.status === 'pending').length;
  const inTransit = orders.filter((o: any) => o.status === 'shipped' || o.status === 'processing').length;
  const delivered = orders.filter((o: any) => o.status === 'delivered').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ShoppingCart} label="Total Orders" value={total} change="This quarter" changeType="neutral" delay={0} />
        <StatCard icon={Clock} label="Pending" value={pending} change="Action needed" changeType="negative" delay={60} />
        <StatCard icon={Truck} label="In Progress" value={inTransit} delay={120} />
        <StatCard icon={CheckCircle} label="Completed" value={delivered} change="Delivered" changeType="positive" delay={180} />
      </div>

      <div className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: '240ms', animationFillMode: 'forwards' }}>
        <h3 className="text-sm font-semibold text-foreground mb-4">Assigned Orders</h3>
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Order ID</th>
                  <th className="pb-3 font-medium">Supplier</th>
                  <th className="pb-3 font-medium">Total</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o: any) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="py-3 font-medium text-foreground font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</td>
                    <td className="py-3 text-foreground">{o.supplier_name}</td>
                    <td className="py-3 text-muted-foreground tabular-nums">${Number(o.total_amount).toLocaleString()}</td>
                    <td className="py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        o.status === 'pending' ? 'bg-warning/10 text-warning' :
                        o.status === 'processing' ? 'bg-info/10 text-info' :
                        o.status === 'shipped' ? 'bg-primary/10 text-primary' :
                        o.status === 'cancelled' ? 'bg-destructive/10 text-destructive' :
                        'bg-success/10 text-success'
                      }`}>{o.status}</span>
                    </td>
                    <td className="py-3 text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="py-3">
                      {o.status === 'pending' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => statusMutation.mutate({ id: o.id, status: 'processing' })}
                            className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors active:scale-[0.97]"
                          >Accept</button>
                          <button
                            onClick={() => statusMutation.mutate({ id: o.id, status: 'cancelled' })}
                            className="rounded-md bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-destructive/10 hover:text-destructive transition-colors active:scale-[0.97]"
                          >Reject</button>
                        </div>
                      )}
                      {o.status === 'processing' && (
                        <button
                          onClick={() => openDispatch(o.id)}
                          className="rounded-md bg-info/10 px-2.5 py-1 text-[11px] font-medium text-info hover:bg-info/20 transition-colors active:scale-[0.97]"
                        >Add Dispatch</button>
                      )}
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
