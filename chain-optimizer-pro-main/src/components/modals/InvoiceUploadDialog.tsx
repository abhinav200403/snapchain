import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, FileText, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/lib/api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  onSuccess?: () => void;
}

export const InvoiceUploadDialog: React.FC<Props> = ({ open, onOpenChange, orderId, onSuccess }) => {
  const [form, setForm] = useState({
    invoice_number: '',
    invoice_amount: '',
    tax_amount: '',
    currency: 'USD',
    due_date: '',
    notes: '',
    file_url: '',
  });

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/invoices', data),
    onSuccess: () => {
      toast.success('Invoice uploaded successfully');
      onSuccess?.();
      setForm({
        invoice_number: '',
        invoice_amount: '',
        tax_amount: '',
        currency: 'USD',
        due_date: '',
        notes: '',
        file_url: '',
      });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to upload invoice'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.invoice_number.trim()) { toast.error('Invoice number is required'); return; }
    if (!form.invoice_amount || isNaN(Number(form.invoice_amount))) {
      toast.error('Valid invoice amount is required'); return;
    }
    mutation.mutate({
      order_id: orderId,
      invoice_number: form.invoice_number.trim(),
      invoice_amount: Number(form.invoice_amount),
      tax_amount: form.tax_amount ? Number(form.tax_amount) : 0,
      currency: form.currency || 'USD',
      due_date: form.due_date || undefined,
      notes: form.notes || undefined,
      file_url: form.file_url || undefined,
    });
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md">
        <div className="bg-background rounded-2xl border shadow-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Upload Invoice</h2>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Invoice Number <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="INV-2024-001"
                value={form.invoice_number}
                onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">
                  Amount <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.invoice_amount}
                  onChange={e => setForm(p => ({ ...p, invoice_amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Tax Amount</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.tax_amount}
                  onChange={e => setForm(p => ({ ...p, tax_amount: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Currency</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.currency}
                  onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="INR">INR</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Due Date</label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">File URL (optional)</label>
              <Input
                placeholder="https://..."
                value={form.file_url}
                onChange={e => setForm(p => ({ ...p, file_url: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Notes</label>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                rows={3}
                placeholder="Additional notes..."
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 gap-1" disabled={mutation.isPending}>
                <Upload className="h-3.5 w-3.5" />
                {mutation.isPending ? 'Uploading...' : 'Upload Invoice'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};
