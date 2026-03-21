import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RoleGuard } from '@/components/RoleGuard';
import { Plus, Search, Star, Clock, Download, BarChart3, CheckCircle2, XCircle } from 'lucide-react';
import { AddSupplierDialog } from '@/components/modals/AddSupplierDialog';
import { exportCSV } from '@/lib/export';
import { toast } from 'sonner';
import api from '@/lib/api';

type Tab = 'cards' | 'scorecard';

const Suppliers = () => {
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('cards');
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers').then(r => r.data),
  });

  const filtered = suppliers.filter((s: any) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    exportCSV('suppliers', suppliers.map((s: any) => ({
      name: s.name,
      email: s.email ?? '',
      phone: s.phone ?? '',
      rating: s.rating,
      lead_time_days: s.lead_time_days,
      status: s.is_active ? 'Active' : 'Inactive',
    })));
    toast.success('Suppliers exported');
  };

  const avgRating = suppliers.length
    ? (suppliers.reduce((sum: number, s: any) => sum + Number(s.rating ?? 0), 0) / suppliers.length).toFixed(1)
    : '—';
  const avgLeadTime = suppliers.length
    ? Math.round(suppliers.reduce((sum: number, s: any) => sum + Number(s.lead_time_days ?? 0), 0) / suppliers.length)
    : '—';

  return (
    <div>
      <Header title="Suppliers" subtitle="Manage and evaluate supplier network" />
      <div className="p-6 space-y-4">
        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-lg border p-1 w-fit">
          {(['cards', 'scorecard'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'scorecard' && <BarChart3 className="h-3 w-3" />}
              {t === 'cards' ? 'Directory' : 'Scorecard'}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search suppliers..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-3.5 w-3.5 mr-1" />Export
            </Button>
            <RoleGuard allowed={['admin']}>
              <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Supplier</Button>
            </RoleGuard>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : tab === 'cards' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {filtered.map((s: any, i: number) => (
              <div key={s.id} className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up transition-shadow hover:shadow-md" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'forwards' }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{s.name}</h3>
                    {s.email && <p className="text-xs text-muted-foreground mt-0.5">{s.email}</p>}
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5">
                    <Star className="h-3 w-3 text-warning fill-warning" />
                    <span className="text-xs font-semibold text-warning">{Number(s.rating ?? 0).toFixed(1)}</span>
                  </div>
                </div>
                {s.phone && <p className="text-sm text-muted-foreground mb-3">{s.phone}</p>}
                <div className="flex gap-6 border-t pt-3">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-lg font-bold text-foreground tabular-nums">{s.lead_time_days ?? 7}</p>
                      <p className="text-[11px] text-muted-foreground">Lead Time (days)</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      {s.is_active
                        ? <CheckCircle2 className="h-4 w-4 text-success" />
                        : <XCircle className="h-4 w-4 text-destructive" />}
                      <p className="text-sm font-bold text-foreground">{s.is_active ? 'Active' : 'Inactive'}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Status</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Summary KPIs */}
            <div className="grid gap-4 sm:grid-cols-3 mb-2">
              {[
                { label: 'Avg Rating', value: avgRating, icon: Star, color: 'text-warning', bg: 'bg-warning/10' },
                { label: 'Avg Lead Time', value: avgLeadTime ? `${avgLeadTime}d` : '—', icon: Clock, color: 'text-info', bg: 'bg-info/10' },
                { label: 'Active Suppliers', value: suppliers.filter((s: any) => s.is_active).length, icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
              ].map((k, i) => (
                <div key={k.label} className="rounded-xl border bg-card p-4 opacity-0 animate-fade-in-up" style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'forwards' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{k.label}</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{k.value}</p>
                    </div>
                    <div className={`rounded-lg p-2 ${k.bg}`}>
                      <k.icon className={`h-4 w-4 ${k.color}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Scorecard table */}
            <div className="rounded-xl border bg-card overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-secondary/40 text-left text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Supplier</th>
                      <th className="px-4 py-3 font-medium">Rating</th>
                      <th className="px-4 py-3 font-medium">Lead Time</th>
                      <th className="px-4 py-3 font-medium">Performance</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filtered].sort((a: any, b: any) => Number(b.rating) - Number(a.rating)).map((s: any) => {
                      const score = Math.round((Number(s.rating) / 5) * 100);
                      const perfColor = score >= 80 ? 'bg-success' : score >= 60 ? 'bg-warning' : 'bg-destructive';
                      return (
                        <tr key={s.id} className="border-b last:border-0 hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{s.name}</p>
                            {s.email && <p className="text-xs text-muted-foreground">{s.email}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 text-warning fill-warning" />
                              <span className="font-semibold text-foreground tabular-nums">{Number(s.rating ?? 0).toFixed(1)}</span>
                              <span className="text-muted-foreground">/5</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-foreground tabular-nums">{s.lead_time_days ?? '—'} days</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-24 rounded-full bg-secondary">
                                <div className={`h-full rounded-full ${perfColor}`} style={{ width: `${score}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground tabular-nums">{score}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              s.is_active ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                            }`}>{s.is_active ? 'Active' : 'Inactive'}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <AddSupplierDialog open={addOpen} onOpenChange={setAddOpen} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['suppliers'] })} />
    </div>
  );
};

export default Suppliers;
