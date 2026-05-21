import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Truck, MapPin, Clock, User, Car, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';

const STEPS = [
  { key: 'preparing',       label: 'Preparing' },
  { key: 'packed',          label: 'Packed' },
  { key: 'dispatched',      label: 'Dispatched' },
  { key: 'in_transit',      label: 'In Transit' },
  { key: 'reached_hub',     label: 'Reached Hub' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered',       label: 'Delivered' },
];

const STATUS_COLOR: Record<string, string> = {
  preparing:        'bg-muted text-muted-foreground',
  packed:           'bg-secondary text-foreground',
  dispatched:       'bg-orange-500/10 text-orange-600',
  in_transit:       'bg-info/10 text-info',
  reached_hub:      'bg-primary/10 text-primary',
  out_for_delivery: 'bg-warning/10 text-warning',
  delivered:        'bg-success/10 text-success',
  delayed:          'bg-destructive/10 text-destructive',
};

const NEXT_STATUS: Record<string, string> = {
  preparing:        'packed',
  packed:           'dispatched',
  dispatched:       'in_transit',
  in_transit:       'reached_hub',
  reached_hub:      'out_for_delivery',
  out_for_delivery: 'delivered',
};

const NEXT_LABEL: Record<string, string> = {
  preparing:        'Mark Packed',
  packed:           'Mark Dispatched',
  dispatched:       'Mark In Transit',
  in_transit:       'Reached Hub',
  reached_hub:      'Out for Delivery',
  out_for_delivery: 'Mark Delivered',
};

const Shipments = () => {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ['shipments'],
    queryFn: () => api.get('/shipments').then(r => r.data),
  });

  const advanceMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/shipments/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
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
        {shipments.length === 0 && (
          <div className="text-center text-muted-foreground py-12">No shipments yet</div>
        )}
        {(shipments as any[]).map((s: any, i: number) => {
          const stepKeys = STEPS.map(x => x.key);
          const stepIdx = s.status === 'delayed' ? -1 : stepKeys.indexOf(s.status);
          const isExpanded = expanded === s.id;
          const nextStatus = NEXT_STATUS[s.status];

          return (
            <div
              key={s.id}
              className="rounded-xl border bg-card opacity-0 animate-fade-in-up"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'forwards' }}
            >
              {/* Header row */}
              <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground font-mono">
                      {s.id.slice(0, 8).toUpperCase()}
                    </span>
                    {s.order_id && (
                      <span className="text-xs text-muted-foreground">
                        · Order #{s.po_number ?? s.order_id.slice(0, 8).toUpperCase()}
                      </span>
                    )}
                    {/* SLA delayed badge */}
                    {s.sla_breach && (
                      <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold text-destructive">SLA BREACH</span>
                    )}
                    {!s.sla_breach && s.estimated_arrival && new Date(s.estimated_arrival).getTime() < Date.now() && s.status !== 'delivered' && (
                      <span className="rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-bold text-orange-600">DELAYED</span>
                    )}
                  </div>
                  {s.carrier && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {s.carrier}
                      {s.tracking_number && (
                        <span className="ml-2 font-mono text-xs text-foreground">#{s.tracking_number}</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_COLOR[s.status] ?? 'bg-muted text-muted-foreground'}`}>
                    {STEPS.find(x => x.key === s.status)?.label ?? s.status.replace(/_/g, ' ')}
                  </span>
                  {nextStatus && (
                    <button
                      onClick={() => advanceMutation.mutate({ id: s.id, status: nextStatus })}
                      disabled={advanceMutation.isPending}
                      className="rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
                    >
                      {NEXT_LABEL[s.status]}
                    </button>
                  )}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : s.id)}
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Route & ETA info */}
              <div className="flex flex-wrap items-center gap-6 px-5 pb-3 text-xs text-muted-foreground">
                {s.origin && s.destination && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{s.origin} → {s.destination}
                  </span>
                )}
                {s.estimated_arrival && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />ETA: {new Date(s.estimated_arrival).toLocaleDateString()}
                  </span>
                )}
                {s.dispatch_timestamp && (
                  <span className="flex items-center gap-1">
                    <Truck className="h-3 w-3" />Dispatched: {new Date(s.dispatch_timestamp).toLocaleString()}
                  </span>
                )}
              </div>

              {/* Progress stepper */}
              <div className="px-5 pb-4">
                <div className="flex items-center gap-0">
                  {STEPS.map((step, j) => (
                    <div key={step.key} className="flex items-center flex-1 last:flex-none">
                      <div className={`h-2.5 w-2.5 rounded-full shrink-0 border-2 transition-colors ${
                        j < stepIdx ? 'bg-primary border-primary' :
                        j === stepIdx ? 'bg-primary border-primary ring-2 ring-primary/20' :
                        'bg-background border-border'
                      }`} />
                      {j < STEPS.length - 1 && (
                        <div className={`h-0.5 flex-1 mx-1 transition-colors ${j < stepIdx ? 'bg-primary' : 'bg-border'}`} />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-1.5">
                  {STEPS.map((step, j) => (
                    <span
                      key={step.key}
                      className={`text-[9px] text-center leading-tight truncate px-0.5 hidden sm:block ${
                        j <= stepIdx ? 'text-foreground font-medium' : 'text-muted-foreground'
                      }`}
                      style={{ width: `${100 / STEPS.length}%` }}
                    >
                      {step.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Expanded driver / vehicle details */}
              {isExpanded && (s.driver_name || s.vehicle_number || s.driver_phone) && (
                <div className="border-t px-5 py-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Driver & Vehicle Info</p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {s.driver_name && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Driver</p>
                          <p className="text-sm font-medium text-foreground">{s.driver_name}</p>
                        </div>
                      </div>
                    )}
                    {s.driver_phone && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Phone</p>
                          <p className="text-sm font-medium text-foreground">{s.driver_phone}</p>
                        </div>
                      </div>
                    )}
                    {s.vehicle_number && (
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Vehicle</p>
                          <p className="text-sm font-medium text-foreground font-mono">{s.vehicle_number}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {isExpanded && !s.driver_name && !s.vehicle_number && (
                <div className="border-t px-5 py-3 text-xs text-muted-foreground">
                  No driver or vehicle details recorded.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Shipments;
