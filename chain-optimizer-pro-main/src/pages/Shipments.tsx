import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Truck, MapPin, Clock } from 'lucide-react';
import api from '@/lib/api';

const STEPS = ['preparing', 'in_transit', 'out_for_delivery', 'delivered'];
const STEP_LABELS: Record<string, string> = { preparing: 'Preparing', in_transit: 'In Transit', out_for_delivery: 'Out for Delivery', delivered: 'Delivered', delayed: 'Delayed' };

const statusColor = (s: string) => {
  if (s === 'delivered') return 'bg-success/10 text-success';
  if (s === 'in_transit') return 'bg-info/10 text-info';
  if (s === 'out_for_delivery') return 'bg-primary/10 text-primary';
  if (s === 'delayed') return 'bg-destructive/10 text-destructive';
  return 'bg-warning/10 text-warning';
};

const Shipments = () => {
  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ['shipments'],
    queryFn: () => api.get('/shipments').then(r => r.data),
  });

  if (isLoading) return (
    <div>
      <Header title="Shipments" subtitle="Track and manage shipment lifecycle" />
      <div className="p-6 text-center text-muted-foreground">Loading...</div>
    </div>
  );

  return (
    <div>
      <Header title="Shipments" subtitle="Track and manage shipment lifecycle" />
      <div className="p-6 space-y-4">
        {shipments.length === 0 && <div className="text-center text-muted-foreground py-8">No shipments yet</div>}
        {shipments.map((s: any, i: number) => {
          const stepIdx = STEPS.indexOf(s.status);
          return (
            <div key={s.id} className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'forwards' }}>
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground font-mono">{s.id.slice(0, 8).toUpperCase()}</span>
                    {s.order_id && <span className="text-xs text-muted-foreground">(Order: {s.order_id.slice(0, 8).toUpperCase()})</span>}
                  </div>
                  {s.carrier && <p className="mt-1 text-sm text-muted-foreground">Carrier: {s.carrier}</p>}
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusColor(s.status)}`}>
                  {STEP_LABELS[s.status] ?? s.status}
                </span>
              </div>
              <div className="flex items-center gap-6 text-xs text-muted-foreground mb-4">
                {s.origin && s.destination && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.origin} → {s.destination}</span>
                )}
                {s.estimated_arrival && (
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />ETA: {new Date(s.estimated_arrival).toLocaleDateString()}</span>
                )}
                {s.tracking_number && <span>Tracking: <span className="font-mono text-foreground">{s.tracking_number}</span></span>}
              </div>
              <div className="flex items-center gap-1">
                {STEPS.map((step, j) => (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${j <= stepIdx ? 'bg-primary' : 'bg-border'}`} />
                    {j < STEPS.length - 1 && (
                      <div className={`h-0.5 w-full mx-1 ${j < stepIdx ? 'bg-primary' : 'bg-border'}`} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                {STEPS.map((step, j) => (
                  <span key={step} className={`text-[10px] ${j <= stepIdx ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    {STEP_LABELS[step]}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Shipments;
