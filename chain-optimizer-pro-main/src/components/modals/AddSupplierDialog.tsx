import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/lib/api';

interface AddSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const AddSupplierDialog: React.FC<AddSupplierDialogProps> = ({ open, onOpenChange, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', lead_time_days: '' });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/suppliers', {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : undefined,
      });
      toast.success('Supplier added successfully');
      onSuccess?.();
      onOpenChange(false);
      setForm({ name: '', email: '', phone: '', lead_time_days: '' });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to add supplier');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Supplier</DialogTitle>
          <DialogDescription>Register a new supplier in your network.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Company Name</label>
            <Input placeholder="e.g. Pacific Components Ltd" required value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input type="email" placeholder="contact@supplier.com" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Phone</label>
              <Input placeholder="+1 (555) 000-0000" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Lead Time (days)</label>
            <Input type="number" placeholder="7" min="1" value={form.lead_time_days} onChange={e => set('lead_time_days', e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Adding...' : 'Add Supplier'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
