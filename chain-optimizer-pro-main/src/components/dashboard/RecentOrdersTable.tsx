import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  pending_approval:               'bg-warning/10 text-warning',
  approved:                       'bg-info/10 text-info',
  awaiting_supplier_confirmation: 'bg-purple-500/10 text-purple-600',
  accepted_by_supplier:           'bg-blue-500/10 text-blue-600',
  processing:                     'bg-primary/10 text-primary',
  dispatched:                     'bg-orange-500/10 text-orange-600',
  in_transit:                     'bg-sky-500/10 text-sky-600',
  delivered:                      'bg-success/10 text-success',
  rejected:                       'bg-destructive/10 text-destructive',
  cancelled:                      'bg-muted text-muted-foreground',
  partially_fulfilled:            'bg-orange-400/10 text-orange-500',
};

const STATUS_LABELS: Record<string, string> = {
  pending_approval:               'Pending Approval',
  approved:                       'Approved',
  awaiting_supplier_confirmation: 'Awaiting Supplier',
  accepted_by_supplier:           'Accepted',
  processing:                     'Processing',
  dispatched:                     'Dispatched',
  in_transit:                     'In Transit',
  delivered:                      'Delivered',
  rejected:                       'Rejected',
  cancelled:                      'Cancelled',
  partially_fulfilled:            'Partial',
};

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
            <th className="pb-3 font-medium">PO Number</th>
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
              <td className="py-3 font-medium text-foreground font-mono text-xs">
                {o.po_number ?? o.id.slice(0, 8).toUpperCase()}
              </td>
              <td className="py-3 text-foreground">{o.supplier_name ?? '—'}</td>
              <td className="py-3 text-foreground tabular-nums">${Number(o.total_amount).toLocaleString()}</td>
              <td className="py-3">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[o.status] ?? 'bg-muted text-muted-foreground'}`}>
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
