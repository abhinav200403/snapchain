import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RoleGuard } from '@/components/RoleGuard';
import { Plus, Search, Star, Clock, Download, BarChart3, CheckCircle2, XCircle, ChevronLeft, ChevronRight, X, TrendingUp, Award } from 'lucide-react';
import { AddSupplierDialog } from '@/components/modals/AddSupplierDialog';
import { exportCSV } from '@/lib/export';
import { toast } from 'sonner';
import api from '@/lib/api';

type Tab = 'cards' | 'scorecard';
const PAGE_SIZE = 8;

// ─── Supplier Scorecard Drawer ────────────────────────────────────────────────

interface ScorecardDrawerProps {
  supplierId: string | null;
  onClose: () => void;
}

const gradeColors: Record<string, string> = {
  Excellent: 'bg-success/10 text-success border-success/30',
  Good:      'bg-info/10 text-info border-info/30',
  Average:   'bg-warning/10 text-warning border-warning/30',
  Poor:      'bg-destructive/10 text-destructive border-destructive/30',
};

const ScorecardDrawer: React.FC<ScorecardDrawerProps> = ({ supplierId, onClose }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['supplier-scorecard', supplierId],
    queryFn: () => api.get(`/suppliers/${supplierId}/scorecard`).then(r => r.data),
    enabled: !!supplierId,
  });

  if (!supplierId) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b p-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Supplier Scorecard</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-16 rounded-xl bg-secondary animate-pulse" />)}
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              Failed to load scorecard data
            </div>
          ) : data ? (
            <>
              {/* Supplier info */}
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{data.supplier?.name}</h3>
                    {data.supplier?.email && (
                      <p className="text-xs text-muted-foreground mt-0.5">{data.supplier.email}</p>
                    )}
                  </div>
                  <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${gradeColors[data.performance_grade] ?? 'bg-muted text-muted-foreground'}`}>
                    <Award className="h-4 w-4" />
                    <span className="text-sm font-bold">{data.performance_grade}</span>
                  </div>
                </div>
              </div>

              {/* KPI Cards grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Orders', value: data.total_orders, unit: '', color: 'text-foreground', bg: 'bg-secondary/60' },
                  { label: 'Delivered', value: data.delivered_orders, unit: '', color: 'text-success', bg: 'bg-success/5' },
                  { label: 'Acceptance Rate', value: `${data.acceptance_rate}%`, unit: '', color: 'text-info', bg: 'bg-info/5' },
                  { label: 'Rejection Rate', value: `${data.rejection_rate}%`, unit: '', color: data.rejection_rate > 20 ? 'text-destructive' : 'text-muted-foreground', bg: data.rejection_rate > 20 ? 'bg-destructive/5' : 'bg-secondary/60' },
                  { label: 'On-Time Delivery', value: `${data.on_time_delivery_rate}%`, unit: '', color: 'text-success', bg: 'bg-success/5' },
                  { label: 'Avg Fulfillment', value: data.avg_fulfillment_days ? `${data.avg_fulfillment_days}d` : '—', unit: '', color: 'text-foreground', bg: 'bg-secondary/60' },
                ].map(kpi => (
                  <div key={kpi.label} className={`rounded-xl p-3 ${kpi.bg}`}>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <p className={`text-xl font-bold mt-0.5 ${kpi.color}`}>{kpi.value}</p>
                  </div>
                ))}
              </div>

              {/* Total Revenue */}
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Revenue Handled</p>
                    <p className="text-2xl font-bold text-foreground mt-0.5">
                      ${Number(data.total_revenue).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </div>

              {/* Acceptance rate visual */}
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">Acceptance Rate</span>
                  <span className="font-bold text-foreground">{data.acceptance_rate}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      data.acceptance_rate >= 80 ? 'bg-success' :
                      data.acceptance_rate >= 60 ? 'bg-info' :
                      data.acceptance_rate >= 40 ? 'bg-warning' : 'bg-destructive'
                    }`}
                    style={{ width: `${data.acceptance_rate}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{data.accepted_orders} accepted</span>
                  <span>{data.rejected_orders} rejected</span>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
};

// ─── Main Suppliers Component ─────────────────────────────────────────────────

const Suppliers = () => {
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('cards');
  const [page, setPage] = useState(1);
  const [scorecardSupplierId, setScorecardSupplierId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers').then(r => r.data),
  });

  const filtered = suppliers.filter((s: any) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
            <Input placeholder="Search suppliers..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
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
          <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {paginated.map((s: any, i: number) => (
              <div
                key={s.id}
                className="rounded-xl border bg-card p-5 opacity-0 animate-fade-in-up transition-shadow hover:shadow-md cursor-pointer"
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'forwards' }}
                onClick={() => setScorecardSupplierId(s.id)}
              >
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
                  <div className="ml-auto">
                    <button
                      onClick={e => { e.stopPropagation(); setScorecardSupplierId(s.id); }}
                      className="flex items-center gap-1 rounded-md bg-primary/5 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      <BarChart3 className="h-3 w-3" />Scorecard
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">{filtered.length} total · Page {page} of {totalPages}</p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  Next<ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
          </>
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
                      <th className="px-4 py-3 font-medium"></th>
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
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setScorecardSupplierId(s.id)}
                              className="flex items-center gap-1 rounded-md bg-primary/5 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                            >
                              <BarChart3 className="h-3 w-3" />Details
                            </button>
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

      <ScorecardDrawer supplierId={scorecardSupplierId} onClose={() => setScorecardSupplierId(null)} />
    </div>
  );
};

export default Suppliers;
