import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Input } from '@/components/ui/input';
import { Search, FileText, ShoppingCart, Truck, Package, Users } from 'lucide-react';
import api from '@/lib/api';

const TYPE_ICONS: Record<string, React.ElementType> = {
  order: ShoppingCart,
  shipment: Truck,
  inventory: Package,
  user: Users,
};

const TYPE_COLORS: Record<string, string> = {
  order: 'bg-info/10 text-info',
  shipment: 'bg-primary/10 text-primary',
  inventory: 'bg-warning/10 text-warning',
  user: 'bg-accent/10 text-accent',
};

const FILTER_OPTIONS = ['All', 'order', 'shipment', 'inventory', 'user'];
const FILTER_LABELS: Record<string, string> = { All: 'All', order: 'Orders', shipment: 'Shipments', inventory: 'Inventory', user: 'Users' };

const AuditLog = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', filter],
    queryFn: () => api.get('/audit', { params: { resource: filter === 'All' ? undefined : filter, limit: 50 } }).then(r => r.data),
  });

  const logs = data?.logs ?? [];

  const filtered = logs.filter((l: any) => {
    const matchSearch = l.action?.toLowerCase().includes(search.toLowerCase()) ||
      l.resource_id?.toLowerCase().includes(search.toLowerCase()) ||
      l.user_name?.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  return (
    <div>
      <Header title="Audit Log" subtitle="System activity and change history" />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search logs..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1 rounded-lg border p-1">
            {FILTER_OPTIONS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >{FILTER_LABELS[f]}</button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((log: any, i: number) => {
              const type = log.resource ?? 'order';
              const Icon = TYPE_ICONS[type] || FileText;
              return (
                <div
                  key={log.id}
                  className="flex gap-4 rounded-xl border bg-card p-4 opacity-0 animate-fade-in-up transition-shadow hover:shadow-sm"
                  style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'forwards' }}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TYPE_COLORS[type] ?? 'bg-secondary text-foreground'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-semibold text-foreground">{log.action}</span>
                      {log.resource_id && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground">{log.resource_id}</span>
                      )}
                    </div>
                    {log.details && <p className="mt-0.5 text-xs text-muted-foreground">{typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {log.user_name} · {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center text-muted-foreground py-8">No logs found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLog;
