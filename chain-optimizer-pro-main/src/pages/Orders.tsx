import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RoleGuard } from '@/components/RoleGuard';
import { Plus, Search, Download, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { CreateOrderDialog } from '@/components/modals/CreateOrderDialog';
import { exportCSV } from '@/lib/export';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

const STATUSES = ['All', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const PAGE_SIZE = 10;
const STATUS_LABELS: Record<string, string> = { All: 'All', pending: 'Pending', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };

const statusColor = (s: string) => {
  if (s === 'pending') return 'bg-warning/10 text-warning';
  if (s === 'processing') return 'bg-info/10 text-info';
  if (s === 'shipped') return 'bg-primary/10 text-primary';
  if (s === 'delivered') return 'bg-success/10 text-success';
  return 'bg-destructive/10 text-destructive';
};

const Orders = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isSupplier = user?.role === 'supplier';

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get('/orders').then(r => r.data),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`Order ${status === 'cancelled' ? 'cancelled' : status === 'processing' ? 'acknowledged' : 'updated'}`);
    },
    onError: () => toast.error('Failed to update order'),
  });

  const filtered = orders.filter((o: any) => {
    const matchSearch = o.id?.toLowerCase().includes(search.toLowerCase()) ||
      o.supplier_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExport = () => {
    exportCSV('orders', orders.map((o: any) => ({
      order_id: o.id.slice(0, 8).toUpperCase(),
      supplier: o.supplier_name ?? '',
      total_amount: o.total_amount,
      status: o.status,
      date: new Date(o.created_at).toLocaleDateString(),
    })));
    toast.success('Orders exported');
  };

  return (
    <div>
      <Header title="Orders" subtitle="Manage purchase orders" />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search orders..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <div className="flex gap-1 rounded-lg border p-1">
              {STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    statusFilter === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >{STATUS_LABELS[s]}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-3.5 w-3.5 mr-1" />Export
            </Button>
            <RoleGuard allowed={['operations_manager', 'admin']}>
              <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" />New Order</Button>
            </RoleGuard>
          </div>
        </div>

        {isSupplier && (
          <div className="rounded-lg border border-info/30 bg-info/5 px-4 py-3 text-sm text-info">
            As a supplier, you can acknowledge pending orders to confirm you'll fulfill them.
          </div>
        )}

        <div className="rounded-xl border bg-card overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/40 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Order ID</th>
                  <th className="px-4 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No orders found</td></tr>
                ) : paginated.map((o: any) => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-4 py-3 text-foreground">{o.supplier_name ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-foreground">${Number(o.total_amount).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor(o.status)}`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* Supplier: acknowledge pending orders */}
                        {isSupplier && o.status === 'pending' && (
                          <button
                            onClick={() => updateStatus.mutate({ id: o.id, status: 'processing' })}
                            disabled={updateStatus.isPending}
                            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-success hover:bg-success/10 transition-colors"
                            title="Acknowledge order"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />Acknowledge
                          </button>
                        )}
                        {/* Admin: advance status */}
                        <RoleGuard allowed={['admin', 'operations_manager']}>
                          {o.status === 'processing' && (
                            <button
                              onClick={() => updateStatus.mutate({ id: o.id, status: 'shipped' })}
                              disabled={updateStatus.isPending}
                              className="rounded-md px-2 py-1 text-xs font-medium text-info hover:bg-info/10 transition-colors"
                            >Mark Shipped</button>
                          )}
                          {o.status === 'shipped' && (
                            <button
                              onClick={() => updateStatus.mutate({ id: o.id, status: 'delivered' })}
                              disabled={updateStatus.isPending}
                              className="rounded-md px-2 py-1 text-xs font-medium text-success hover:bg-success/10 transition-colors"
                            >Mark Delivered</button>
                          )}
                        </RoleGuard>
                        <RoleGuard allowed={['admin']}>
                          {o.status !== 'cancelled' && o.status !== 'delivered' && (
                            <button
                              onClick={() => updateStatus.mutate({ id: o.id, status: 'cancelled' })}
                              disabled={updateStatus.isPending}
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <XCircle className="h-3.5 w-3.5" />Cancel
                            </button>
                          )}
                        </RoleGuard>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">{filtered.length} total · Page {page} of {totalPages}</p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  Next<ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['orders'] })} />
    </div>
  );
};

export default Orders;
