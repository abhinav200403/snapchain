import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/lib/api';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit_price: number;
  stock_quantity: number;
  reorder_level: number;
}

interface EditProductDialogProps {
  product: Product | null;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const CATEGORIES = ['Machinery', 'Components', 'Electronics', 'Materials'];

export const EditProductDialog: React.FC<EditProductDialogProps> = ({ product, onOpenChange, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', sku: '', category: '', unit_price: '', stock_quantity: '', reorder_level: '' });

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        sku: product.sku ?? '',
        category: product.category ?? '',
        unit_price: String(product.unit_price),
        stock_quantity: String(product.stock_quantity),
        reorder_level: String(product.reorder_level),
      });
    }
  }, [product]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!product) return;
    setLoading(true);
    try {
      await api.patch(`/inventory/${product.id}`, {
        name: form.name,
        sku: form.sku,
        category: form.category,
        unit_price: Number(form.unit_price),
        stock_quantity: Number(form.stock_quantity),
        reorder_level: Number(form.reorder_level),
      });
      toast.success('Product updated');
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to update product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>Update product details and stock levels.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Product Name</label>
            <Input required value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">SKU</label>
              <Input value={form.sku} onChange={e => set('sku', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Category</label>
              <Select value={form.category} onValueChange={v => set('category', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Price ($)</label>
              <Input type="number" step="0.01" required value={form.unit_price} onChange={e => set('unit_price', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Stock</label>
              <Input type="number" required value={form.stock_quantity} onChange={e => set('stock_quantity', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Reorder Level</label>
              <Input type="number" required value={form.reorder_level} onChange={e => set('reorder_level', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
