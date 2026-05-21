import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/lib/api';

interface OrderItem {
  id: string;
  product_name: string;
  sku?: string;
  quantity: number;
  fulfilled_quantity?: number;
  unit_price: number;
}

interface Props {
  orderId: string;
  items: OrderItem[];
  onSuccess?: () => void;
}

export const PartialFulfillmentPanel: React.FC<Props> = ({ orderId, items, onSuccess }) => {
  const queryClient = useQueryClient();
  const [fulfilled, setFulfilled] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    items.forEach(item => {
      initial[item.id] = String(item.fulfilled_quantity ?? 0);
    });
    return initial;
  });

  const mutation = useMutation({
    mutationFn: (entries: { item_id: string; fulfilled_quantity: number }[]) =>
      api.post(`/orders/${orderId}/fulfill-partial`, { items: entries }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`Fulfillment saved — order is now ${res.data.status.replace(/_/g, ' ')}`);
      onSuccess?.();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to save fulfillment'),
  });

  const handleSubmit = () => {
    const entries = items.map(item => ({
      item_id: item.id,
      fulfilled_quantity: parseInt(fulfilled[item.id] || '0', 10),
    }));
    mutation.mutate(entries);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Partial Fulfillment</h3>
      </div>

      <div className="space-y-3">
        {items.map(item => {
          const ordered = parseInt(String(item.quantity), 10);
          const currentFulfilled = parseInt(fulfilled[item.id] || '0', 10);
          const pct = ordered > 0 ? Math.min(100, Math.round((currentFulfilled / ordered) * 100)) : 0;
          const remaining = Math.max(0, ordered - currentFulfilled);

          return (
            <div key={item.id} className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.product_name}</p>
                  {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Ordered: <span className="font-medium text-foreground">{ordered}</span></p>
                  <p>Remaining: <span className={remaining > 0 ? 'font-medium text-warning' : 'font-medium text-success'}>{remaining}</span></p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-success' : 'bg-primary'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground text-right">{pct}% fulfilled</p>
              </div>

              {/* Input for supplier */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">Fulfill qty:</label>
                <input
                  type="number"
                  min="0"
                  max={ordered}
                  className="w-24 rounded-md border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={fulfilled[item.id] ?? '0'}
                  onChange={e => {
                    const val = Math.min(ordered, Math.max(0, parseInt(e.target.value, 10) || 0));
                    setFulfilled(prev => ({ ...prev, [item.id]: String(val) }));
                  }}
                />
                {currentFulfilled >= ordered && (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? 'Saving...' : 'Save Fulfillment Progress'}
      </Button>
    </div>
  );
};
