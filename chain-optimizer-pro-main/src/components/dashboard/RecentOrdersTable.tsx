import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const statusColor = (s: string) => {
  if (s === 'pending') return 'bg-warning/10 text-warning';
  if (s === 'processing') return 'bg-info/10 text-info';
  if (s === 'shipped') return 'bg-primary/10 text-primary';
  if (s === 'delivered') return 'bg-success/10 text-success';
  return 'bg-destructive/10 text-destructive';
};

const STATUS_LABELS: Record<string, string> = { pending: 'Pending', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };

export const RecentOrdersTable = () => {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get('/orders').then(r => r.data),
  });

  const recent = orders.slice(0, 5);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-3 font-medium">Order</th>
            <th className="pb-3 font-medium">Supplier</th>
            <th className="pb-3 font-medium">Amount</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan={5} className="py-4 text-center text-muted-foreground text-xs">Loading...</td></tr>
          ) : recent.map((o: any) => (
            <tr key={o.id} className="border-b last:border-0">
              <td className="py-3 font-medium text-foreground font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</td>
              <td className="py-3 text-foreground">{o.supplier_name}</td>
              <td className="py-3 text-foreground tabular-nums">${Number(o.total_amount).toLocaleString()}</td>
              <td className="py-3">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor(o.status)}`}>
                  {STATUS_LABELS[o.status] ?? o.status}
                </span>
              </td>
              <td className="py-3 text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
