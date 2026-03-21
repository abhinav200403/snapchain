import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const CreateOrderDialog: React.FC<CreateOrderDialogProps> = ({ open, onOpenChange, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ productId: '', qty: '' }]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers').then(r => r.data),
    enabled: open,
  });
  const { data: products = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get('/inventory').then(r => r.data),
    enabled: open,
  });

  const addItem = () => setItems([...items, { productId: '', qty: '' }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const setItem = (i: number, k: string, v: string) => setItems(items.map((item, idx) => idx === i ? { ...item, [k]: v } : item));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) { toast.error('Please select a supplier'); return; }
    const validItems = items.filter(i => i.productId && i.qty);
    if (validItems.length === 0) { toast.error('Add at least one item'); return; }

    setLoading(true);
    try {
      await api.post('/orders', {
        supplier_id: supplierId,
        notes,
        items: validItems.map(i => ({ product_id: i.productId, quantity: Number(i.qty) })),
      });
      toast.success('Purchase order created successfully');
      onSuccess?.();
      onOpenChange(false);
      setSupplierId('');
      setNotes('');
      setItems([{ productId: '', qty: '' }]);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogDescription>Create a new purchase order and assign it to a supplier.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Assign Supplier</label>
            <Select required value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Order Items</label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3 w-3 mr-1" />Add Item
              </Button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select value={item.productId} onValueChange={v => setItem(i, 'productId', v)}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Qty"
                  className="w-20"
                  min="1"
                  value={item.qty}
                  onChange={e => setItem(i, 'qty', e.target.value)}
                />
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="rounded-md p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Notes (optional)</label>
            <Input placeholder="Any special instructions..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Order'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
