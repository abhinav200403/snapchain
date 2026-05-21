import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/lib/api';

interface DispatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId?: string;
  onSuccess?: () => void;
}

export const DispatchDialog: React.FC<DispatchDialogProps> = ({ open, onOpenChange, orderId, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    tracking_number: '',
    carrier: '',
    estimated_arrival: '',
    origin: '',
    destination: '',
    vehicle_number: '',
    driver_name: '',
    driver_phone: '',
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) return;
    setLoading(true);
    try {
      await api.post('/shipments', { order_id: orderId, ...form });
      toast.success('Dispatch details saved — shipment created');
      onSuccess?.();
      onOpenChange(false);
      setForm({ tracking_number: '', carrier: '', estimated_arrival: '', origin: '', destination: '', vehicle_number: '', driver_name: '', driver_phone: '' });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to create shipment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Dispatch Details</DialogTitle>
          <DialogDescription>Provide shipping information for order {orderId ? `#${orderId.slice(0, 8).toUpperCase()}` : ''}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tracking & carrier */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Tracking ID</label>
              <Input placeholder="e.g. GT-8847291" required value={form.tracking_number} onChange={e => set('tracking_number', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Carrier</label>
              <Input placeholder="e.g. FedEx, DHL" required value={form.carrier} onChange={e => set('carrier', e.target.value)} />
            </div>
          </div>

          {/* Origin & destination */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Origin</label>
              <Input placeholder="City, Country" required value={form.origin} onChange={e => set('origin', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Destination</label>
              <Input placeholder="City, Country" required value={form.destination} onChange={e => set('destination', e.target.value)} />
            </div>
          </div>

          {/* ETA */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Estimated Arrival</label>
            <Input type="date" required value={form.estimated_arrival} onChange={e => set('estimated_arrival', e.target.value)} />
          </div>

          {/* Vehicle & driver info */}
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Driver & Vehicle (Optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Vehicle Number</label>
                <Input placeholder="e.g. MH-12-AB-1234" value={form.vehicle_number} onChange={e => set('vehicle_number', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Driver Phone</label>
                <Input placeholder="+91 XXXXX XXXXX" value={form.driver_phone} onChange={e => set('driver_phone', e.target.value)} />
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <label className="text-sm font-medium text-foreground">Driver Name</label>
              <Input placeholder="Full name" value={form.driver_name} onChange={e => set('driver_name', e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Submitting…' : 'Create Shipment'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
