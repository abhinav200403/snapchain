import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Download, ChevronLeft, ChevronRight, UserCog, CheckCircle2, XCircle, Truck, Package, ArrowRight, AlertTriangle, Clock } from 'lucide-react';
import { CreateOrderDialog } from '@/components/modals/CreateOrderDialog';
import { OrderDetailDrawer } from '@/components/orders/OrderDetailDrawer';
import { exportCSV } from '@/lib/export';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

// ─── Status config ────────────────────────────────────────────────────────────

const ALL_STATUSES = [
  'pending_approval',
  'approved',
  'awaiting_supplier_confirmation',
  'accepted_by_supplier',
  'processing',
  'dispatched',
  'in_transit',
  'delivered',
  'rejected',
  'cancelled',
  'partially_fulfilled',
] as const;

type OrderStatus = typeof ALL_STATUSES[number];

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_approval:                 'Pending Approval',
  approved:                         'Approved',
  awaiting_supplier_confirmation:   'Awaiting Supplier',
  accepted_by_supplier:             'Accepted by Supplier',
  processing:                       'Processing',
  dispatched:                       'Dispatched',
  in_transit:                       'In Transit',
  delivered:                        'Delivered',
  rejected:                         'Rejected',
  cancelled:                        'Cancelled',
  partially_fulfilled:              'Partially Fulfilled',
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending_approval:                 'bg-warning/10 text-warning',
  approved:                         'bg-info/10 text-info',
  awaiting_supplier_confirmation:   'bg-purple-500/10 text-purple-600',
  accepted_by_supplier:             'bg-blue-500/10 text-blue-600',
  processing:                       'bg-primary/10 text-primary',
  dispatched:                       'bg-orange-500/10 text-orange-600',
  in_transit:                       'bg-sky-500/10 text-sky-600',
  delivered:                        'bg-success/10 text-success',
  rejected:                         'bg-destructive/10 text-destructive',
  cancelled:                        'bg-muted text-muted-foreground',
  partially_fulfilled:              'bg-orange-400/10 text-orange-500',
};

// Filter tabs shown per role (subset of ALL_STATUSES)
const ROLE_TABS: Record<string, Array<OrderStatus | 'all'>> = {
  admin: [
    'all', 'pending_approval', 'approved',
    'awaiting_supplier_confirmation', 'accepted_by_supplier',
    'processing', 'dispatched', 'in_transit', 'delivered',
    'partially_fulfilled', 'rejected', 'cancelled',
  ],
  operations_manager: [
    'all', 'pending_approval', 'approved',
    'awaiting_supplier_confirmation', 'accepted_by_supplier',
    'processing', 'dispatched', 'in_transit', 'delivered', 'partially_fulfilled',
  ],
  supplier: [
    'all', 'awaiting_supplier_confirmation', 'accepted_by_supplier',
    'processing', 'dispatched', 'in_transit', 'delivered',
    'partially_fulfilled', 'rejected',
  ],
  business_analyst: ['all', 'pending_approval', 'approved', 'in_transit', 'delivered', 'cancelled'],
};

const TAB_LABEL: Record<string, string> = {
  all: 'All',
  ...STATUS_LABEL,
};

const PAGE_SIZE = 10;

// ─── SLA risk helpers ─────────────────────────────────────────────────────────

function isAtRisk(order: any, atRiskIds: Set<string>): boolean {
  return atRiskIds.has(order.id) || order.sla_breach === true;
}

function getSlaFlag(order: any, atRiskIds: Set<string>): 'at_risk' | 'overdue' | null {
  if (order.sla_breach) return 'overdue';
  if (atRiskIds.has(order.id)) return 'at_risk';
  // Local heuristics
  const now = Date.now();
  const updatedAt = new Date(order.updated_at ?? order.created_at).getTime();
  const hoursSinceUpdate = (now - updatedAt) / (1000 * 60 * 60);
  if (order.status === 'awaiting_supplier_confirmation' && hoursSinceUpdate > 24) return 'at_risk';
  if (order.status === 'processing' && hoursSinceUpdate > 48) return 'at_risk';
  if (order.expected_delivery && new Date(order.expected_delivery).getTime() < now &&
      !['delivered', 'rejected', 'cancelled'].includes(order.status)) return 'overdue';
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

const Orders = () => {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>(() => {
    const s = searchParams.get('status');
    return s && ALL_STATUSES.includes(s as OrderStatus) ? (s as OrderStatus) : 'all';
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const role = user?.role ?? '';

  const isSupplier  = role === 'supplier';
  const canManage   = role === 'admin' || role === 'operations_manager';
  const isAnalyst   = role === 'business_analyst';
  const tabs        = ROLE_TABS[role] ?? ['all'];

  useEffect(() => {
    const s = searchParams.get('status');
    if (s && ALL_STATUSES.includes(s as OrderStatus)) {
      setStatusFilter(s as OrderStatus);
      setPage(1);
    }
  }, [searchParams]);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get('/orders').then(r => r.data),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers').then(r => r.data),
    enabled: canManage,
  });

  const { data: slaData } = useQuery({
    queryKey: ['sla-at-risk'],
    queryFn: () => api.get('/sla/at-risk').then(r => r.data),
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });

  const { data: approvalRules = [] } = useQuery({
    queryKey: ['approval-rules'],
    queryFn: () => api.get('/approval-rules').then(r => r.data),
    enabled: canManage,
    staleTime: 5 * 60 * 1000,
  });

  const atRiskIds = new Set<string>((slaData?.at_risk_orders ?? []).map((o: any) => o.id));

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to update order'),
  });

  const assignSupplier = useMutation({
    mutationFn: ({ id, supplier_id }: { id: string; supplier_id: string }) =>
      api.patch(`/orders/${id}/supplier`, { supplier_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setAssigningId(null);
      toast.success('Supplier assigned — awaiting confirmation');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to assign supplier'),
  });

  // ── Filter / paginate ─────────────────────────────────────────────────────────

  const filtered = orders.filter((o: any) => {
    const q = search.toLowerCase();
    const matchSearch =
      (o.po_number ?? o.id.slice(0, 8).toUpperCase()).toLowerCase().includes(q) ||
      o.id?.toLowerCase().includes(q) ||
      o.supplier_name?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Export ────────────────────────────────────────────────────────────────────

  const handleExport = () => {
    exportCSV('orders', orders.map((o: any) => ({
      po_number:    o.po_number ?? o.id.slice(0, 8).toUpperCase(),
      supplier:     o.supplier_name ?? '',
      total_amount: o.total_amount,
      status:       o.status,
      date:         new Date(o.created_at).toLocaleDateString(),
    })));
    toast.success('Orders exported');
  };

  // ── Context banner ────────────────────────────────────────────────────────────

  const pendingApprovalCount  = orders.filter((o: any) => o.status === 'pending_approval').length;
  const awaitingSupplierCount = orders.filter((o: any) => o.status === 'awaiting_supplier_confirmation').length;
  const noSupplierCount       = orders.filter((o: any) => o.status === 'approved' && !o.supplier_name).length;

  // Approval rules: check if any rule requires admin for large amounts
  const getApprovalBadge = (order: any): string | null => {
    if (order.status !== 'pending_approval' || !canManage) return null;
    const amount = Number(order.total_amount);
    for (const rule of (approvalRules as any[])) {
      if (!rule.is_active) continue;
      if (amount >= rule.min_amount && (rule.max_amount == null || amount <= rule.max_amount)) {
        if (rule.required_role === 'admin' && role !== 'admin') {
          return `Requires Admin approval`;
        }
      }
    }
    return null;
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div>
      <Header title="Orders" subtitle="Manage purchase orders" />
      <div className="p-6 space-y-4">

        {/* ── Toolbar ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by PO number…"
                className="pl-9 h-8 text-xs"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            {/* Role-filtered status tabs */}
            <div className="flex flex-wrap gap-1 rounded-lg border p-1">
              {tabs.map(s => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s as any); setPage(1); }}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {TAB_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-3.5 w-3.5 mr-1" />Export
            </Button>
            {canManage && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />New Order
              </Button>
            )}
          </div>
        </div>

        {/* ── Context banners ──────────────────────────────────────────────── */}
        {canManage && pendingApprovalCount > 0 && statusFilter === 'pending_approval' && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
            <Package className="h-4 w-4 shrink-0" />
            <span>{pendingApprovalCount} order{pendingApprovalCount > 1 ? 's' : ''} waiting for your approval.</span>
          </div>
        )}
        {canManage && noSupplierCount > 0 && statusFilter === 'approved' && (
          <div className="flex items-center gap-2 rounded-lg border border-info/30 bg-info/5 px-4 py-3 text-sm text-info">
            <UserCog className="h-4 w-4 shrink-0" />
            <span>{noSupplierCount} approved order{noSupplierCount > 1 ? 's have' : ' has'} no supplier — use <strong>Assign Supplier</strong> to proceed.</span>
          </div>
        )}
        {isSupplier && awaitingSupplierCount > 0 && statusFilter === 'awaiting_supplier_confirmation' && (
          <div className="flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-50 dark:bg-purple-900/10 px-4 py-3 text-sm text-purple-700 dark:text-purple-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{awaitingSupplierCount} fulfillment request{awaitingSupplierCount > 1 ? 's' : ''} waiting — confirm whether you can fulfill them.</span>
          </div>
        )}

        {/* ── Table (desktop) ──────────────────────────────────────────────── */}
        <div
          className="rounded-xl border bg-card overflow-hidden opacity-0 animate-fade-in-up"
          style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}
        >
          <div className="overflow-x-auto hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/40 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">PO Number</th>
                  <th className="px-4 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  {!isAnalyst && <th className="px-4 py-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No orders found</td></tr>
                ) : paginated.map((o: any) => {
                  const slaFlag = getSlaFlag(o, atRiskIds);
                  const approvalBadge = getApprovalBadge(o);
                  return (
                    <tr
                      key={o.id}
                      className="border-b last:border-0 hover:bg-secondary/20 transition-colors cursor-pointer"
                      onClick={() => setSelectedOrder(o)}
                    >
                      {/* PO Number */}
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          {o.po_number ?? o.id.slice(0, 8).toUpperCase()}
                          {slaFlag === 'overdue' && (
                            <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold text-destructive">OVERDUE</span>
                          )}
                          {slaFlag === 'at_risk' && (
                            <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[9px] font-bold text-warning">AT RISK</span>
                          )}
                        </div>
                      </td>

                      {/* Supplier — inline assign when approved + no supplier */}
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {canManage && o.status === 'approved' && !o.supplier_name && assigningId === o.id ? (
                          <div className="flex items-center gap-1">
                            <select
                              autoFocus
                              className="rounded-md border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              defaultValue=""
                              onChange={e => {
                                if (e.target.value) assignSupplier.mutate({ id: o.id, supplier_id: e.target.value });
                              }}
                            >
                              <option value="" disabled>Select supplier…</option>
                              {(suppliers as any[]).filter((s: any) => s.is_active).map((s: any) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => setAssigningId(null)}
                              className="ml-1 text-xs text-muted-foreground hover:text-foreground"
                            >✕</button>
                          </div>
                        ) : (
                          <span className={o.supplier_name ? 'text-foreground' : 'text-muted-foreground italic'}>
                            {o.supplier_name ?? 'No supplier'}
                          </span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3 tabular-nums text-foreground">
                        <div>
                          ${Number(o.total_amount).toLocaleString()}
                          {approvalBadge && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <AlertTriangle className="h-3 w-3 text-warning" />
                              <span className="text-[9px] text-warning font-medium">{approvalBadge}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
                          STATUS_COLOR[o.status as OrderStatus] ?? 'bg-muted text-muted-foreground'
                        }`}>
                          {STATUS_LABEL[o.status as OrderStatus] ?? o.status}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(o.created_at).toLocaleDateString()}
                        {o.expected_delivery && (
                          <div className="text-[10px] text-muted-foreground/70">
                            ETA: {new Date(o.expected_delivery).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Actions — analyst sees no action column */}
                      {!isAnalyst && (
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex flex-wrap items-center gap-1">
                            {renderActions(o, role, updateStatus, assignSupplier, assigningId, setAssigningId)}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile card view ────────────────────────────────────────────── */}
          <div className="sm:hidden divide-y">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm">Loading…</div>
            ) : paginated.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm">No orders found</div>
            ) : paginated.map((o: any) => {
              const slaFlag = getSlaFlag(o, atRiskIds);
              return (
                <div
                  key={o.id}
                  className="p-4 hover:bg-secondary/20 transition-colors cursor-pointer"
                  onClick={() => setSelectedOrder(o)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-mono text-xs font-bold text-foreground">
                        {o.po_number ?? o.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">{o.supplier_name ?? 'No supplier'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {slaFlag === 'overdue' && <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold text-destructive">OVERDUE</span>}
                      {slaFlag === 'at_risk' && <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[9px] font-bold text-warning">AT RISK</span>}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[o.status as OrderStatus] ?? 'bg-muted text-muted-foreground'}`}>
                        {STATUS_LABEL[o.status as OrderStatus] ?? o.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground tabular-nums">${Number(o.total_amount).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</p>
                  </div>
                  {!isAnalyst && (
                    <div className="flex flex-wrap gap-1 mt-2" onClick={e => e.stopPropagation()}>
                      {renderActions(o, role, updateStatus, assignSupplier, assigningId, setAssigningId)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {filtered.length} total · Page {page} of {totalPages}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />Prev
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  Next<ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['orders'] })}
      />

      <OrderDetailDrawer
        order={selectedOrder}
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
};

// ─── Action button renderer (keeps JSX readable) ─────────────────────────────

function btn(
  label: string,
  onClick: () => void,
  style: 'approve' | 'reject' | 'info' | 'warn' | 'muted' | 'purple',
  icon?: React.ReactNode,
  disabled = false,
) {
  const colors = {
    approve: 'text-success bg-success/5 hover:bg-success/15',
    reject:  'text-destructive bg-destructive/5 hover:bg-destructive/15',
    info:    'text-info bg-info/5 hover:bg-info/15',
    warn:    'text-warning bg-warning/5 hover:bg-warning/15',
    muted:   'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
    purple:  'text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/10 dark:hover:bg-purple-900/20',
  };
  return (
    <button
      key={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${colors[style]}`}
    >
      {icon}{label}
    </button>
  );
}

function renderActions(
  o: any,
  role: string,
  updateStatus: any,
  assignSupplier: any,
  assigningId: string | null,
  setAssigningId: (id: string | null) => void,
) {
  const isPending  = updateStatus.isPending || assignSupplier.isPending;
  const mut        = (status: string) => updateStatus.mutate({ id: o.id, status });
  const canManage  = role === 'admin' || role === 'operations_manager';
  const isSupplier = role === 'supplier';

  const actions: React.ReactNode[] = [];

  // ── ADMIN / OPS MANAGER ────────────────────────────────────────────────────
  if (canManage) {
    switch (o.status) {
      case 'pending_approval':
        actions.push(btn('Approve Order',  () => mut('approved'),  'approve', <CheckCircle2 className="h-3.5 w-3.5" />, isPending));
        actions.push(btn('Reject Request', () => mut('rejected'),  'reject',  <XCircle className="h-3.5 w-3.5" />,     isPending));
        actions.push(btn('Cancel',         () => mut('cancelled'), 'muted',   undefined,                                isPending));
        break;

      case 'approved':
        if (!o.supplier_name && assigningId !== o.id) {
          actions.push(btn('Assign Supplier', () => setAssigningId(o.id), 'info', <UserCog className="h-3.5 w-3.5" />));
        }
        actions.push(btn('Cancel', () => mut('cancelled'), 'muted', undefined, isPending));
        break;

      case 'awaiting_supplier_confirmation':
        actions.push(btn('Cancel', () => mut('cancelled'), 'muted', undefined, isPending));
        break;

      case 'accepted_by_supplier':
        actions.push(btn('Start Processing', () => mut('processing'), 'info', <ArrowRight className="h-3.5 w-3.5" />, isPending));
        actions.push(btn('Cancel',           () => mut('cancelled'),  'muted', undefined,                              isPending));
        break;

      case 'processing':
        actions.push(btn('Mark Dispatched', () => mut('dispatched'), 'info', <Package className="h-3.5 w-3.5" />, isPending));
        break;

      case 'dispatched':
        actions.push(btn('Mark In Transit', () => mut('in_transit'), 'info', <Truck className="h-3.5 w-3.5" />, isPending));
        break;

      case 'in_transit':
        actions.push(btn('Mark Delivered', () => mut('delivered'), 'approve', <CheckCircle2 className="h-3.5 w-3.5" />, isPending));
        break;
    }
  }

  // ── SUPPLIER ───────────────────────────────────────────────────────────────
  if (isSupplier) {
    switch (o.status) {
      case 'awaiting_supplier_confirmation':
        actions.push(btn('Confirm Fulfillment', () => mut('accepted_by_supplier'), 'approve', <CheckCircle2 className="h-3.5 w-3.5" />, isPending));
        actions.push(btn('Reject Fulfillment',  () => mut('rejected'),             'reject',  <XCircle className="h-3.5 w-3.5" />,     isPending));
        break;
    }
  }

  return actions.length > 0 ? actions : <span className="text-xs text-muted-foreground">—</span>;
}

export default Orders;
