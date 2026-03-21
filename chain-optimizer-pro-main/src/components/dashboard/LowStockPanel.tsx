import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { AlertTriangle, ShoppingCart, Package, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface LowStockPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
  reorder_level: number;
  unit_price: number;
  low_stock: boolean;
}

interface OrderRowState {
  open: boolean;
  supplierId: string;
  qty: string;
  loading: boolean;
  done: boolean;
}

export const LowStockPanel = ({ open, onOpenChange }: LowStockPanelProps) => {
  const queryClient = useQueryClient();
  const [orderRows, setOrderRows] = useState<Record<string, OrderRowState>>({});

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['inventory'],
    queryFn: () => api.get('/inventory').then(r => r.data),
    enabled: open,
  });

  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers').then(r => r.data),
    enabled: open,
  });

  const lowStockItems = products.filter(p => p.low_stock || p.stock_quantity <= p.reorder_level);

  const getRow = (id: string): OrderRowState =>
    orderRows[id] ?? { open: false, supplierId: '', qty: '', loading: false, done: false };

  const setRow = (id: string, patch: Partial<OrderRowState>) =>
    setOrderRows(prev => ({ ...prev, [id]: { ...getRow(id), ...patch } }));

  const handleOpenOrder = (product: Product) => {
    const suggested = Math.max(product.reorder_level - product.stock_quantity, product.reorder_level);
    setRow(product.id, {
      open: true,
      qty: String(suggested),
      supplierId: suppliers[0]?.id ?? '',
      done: false,
    });
  };

  const handlePlaceOrder = async (product: Product) => {
    const row = getRow(product.id);
    if (!row.supplierId) { toast.error('Please select a supplier'); return; }
    if (!row.qty || Number(row.qty) < 1) { toast.error('Quantity must be at least 1'); return; }

    setRow(product.id, { loading: true });
    try {
      await api.post('/orders', {
        supplier_id: row.supplierId,
        notes: `Reorder for low stock item: ${product.name} (SKU: ${product.sku})`,
        items: [{ product_id: product.id, quantity: Number(row.qty) }],
      });
      setRow(product.id, { loading: false, done: true, open: false });
      toast.success(`Order placed for ${product.name}`);
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (err: any) {
      setRow(product.id, { loading: false });
      toast.error(err?.response?.data?.error ?? 'Failed to place order');
    }
  };

  const shortage = (p: Product) => Math.max(p.reorder_level - p.stock_quantity, 0);
  const severity = (p: Product) => {
    if (p.stock_quantity === 0) return 'out';
    if (p.stock_quantity <= p.reorder_level * 0.5) return 'critical';
    return 'low';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col gap-0 p-0">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b bg-destructive/5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-destructive/15 p-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <SheetTitle className="text-base font-semibold text-destructive">
                Low Stock Alert
              </SheetTitle>
              <SheetDescription className="text-xs mt-0.5">
                {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} need reordering
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Log legend */}
        <div className="px-6 py-3 bg-muted/40 border-b flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive inline-block" />Out of stock</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-500 inline-block" />Critical (&lt;50%)</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-yellow-500 inline-block" />Low stock</span>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto divide-y">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />Loading inventory...
            </div>
          ) : lowStockItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground text-sm">
              <Package className="h-8 w-8 opacity-30" />
              <p>All stock levels are healthy</p>
            </div>
          ) : (
            lowStockItems.map((product) => {
              const row = getRow(product.id);
              const sev = severity(product);

              return (
                <div key={product.id} className="px-6 py-4 space-y-3">
                  {/* Product info row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Severity dot */}
                      <span className={cn(
                        'mt-1.5 h-2 w-2 rounded-full flex-shrink-0',
                        sev === 'out' && 'bg-destructive',
                        sev === 'critical' && 'bg-orange-500',
                        sev === 'low' && 'bg-yellow-500',
                      )} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">SKU: {product.sku}</p>
                        {/* Stock log bar */}
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Stock:</span>
                          <span className={cn(
                            'font-bold',
                            sev === 'out' && 'text-destructive',
                            sev === 'critical' && 'text-orange-500',
                            sev === 'low' && 'text-yellow-600',
                          )}>{product.stock_quantity}</span>
                          <span className="text-muted-foreground">/ Reorder at:</span>
                          <span className="font-medium text-foreground">{product.reorder_level}</span>
                          <span className="text-muted-foreground ml-1">· Shortage:</span>
                          <span className="font-bold text-destructive">{shortage(product)}</span>
                        </div>
                        {/* Visual bar */}
                        <div className="mt-1.5 h-1.5 w-36 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              sev === 'out' && 'bg-destructive',
                              sev === 'critical' && 'bg-orange-500',
                              sev === 'low' && 'bg-yellow-500',
                            )}
                            style={{ width: `${Math.min((product.stock_quantity / product.reorder_level) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex-shrink-0">
                      {row.done ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />Ordered
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant={row.open ? 'secondary' : 'destructive'}
                          className="h-7 text-xs gap-1"
                          onClick={() => row.open
                            ? setRow(product.id, { open: false })
                            : handleOpenOrder(product)
                          }
                        >
                          <ShoppingCart className="h-3 w-3" />
                          {row.open ? 'Cancel' : 'Create Order'}
                          {!row.open && <ChevronRight className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Inline order form */}
                  {row.open && !row.done && (
                    <div className="ml-5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-3">
                      <p className="text-xs font-semibold text-destructive uppercase tracking-wide">Quick Reorder</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground font-medium">Supplier</label>
                          <Select
                            value={row.supplierId}
                            onValueChange={v => setRow(product.id, { supplierId: v })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select supplier" />
                            </SelectTrigger>
                            <SelectContent>
                              {suppliers.filter((s: any) => s.is_active).map((s: any) => (
                                <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground font-medium">
                            Quantity <span className="text-muted-foreground/60">(suggested: {Math.max(product.reorder_level - product.stock_quantity, product.reorder_level)})</span>
                          </label>
                          <Input
                            type="number"
                            min="1"
                            className="h-8 text-xs"
                            value={row.qty}
                            onChange={e => setRow(product.id, { qty: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <p className="text-xs text-muted-foreground">
                          Est. cost: <span className="font-semibold text-foreground">
                            ${(Number(row.qty || 0) * product.unit_price).toFixed(2)}
                          </span>
                        </p>
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-destructive hover:bg-destructive/90"
                          disabled={row.loading}
                          onClick={() => handlePlaceOrder(product)}
                        >
                          {row.loading
                            ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Placing...</>
                            : <><ShoppingCart className="h-3 w-3 mr-1" />Place Order</>
                          }
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer summary */}
        {lowStockItems.length > 0 && (
          <div className="border-t px-6 py-3 bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
            <span>{lowStockItems.filter(p => getRow(p.id).done).length} of {lowStockItems.length} ordered this session</span>
            <Badge variant="destructive" className="text-xs">
              {lowStockItems.filter(p => severity(p) === 'out').length} out of stock
            </Badge>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
