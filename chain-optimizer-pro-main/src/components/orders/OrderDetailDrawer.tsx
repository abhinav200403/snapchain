import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Clock, CheckCircle2, FileText, Paperclip, Package, Truck, AlertCircle, ChevronDown, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { InvoiceUploadDialog } from '@/components/modals/InvoiceUploadDialog';
import { PartialFulfillmentPanel } from '@/components/orders/PartialFulfillmentPanel';
import { toast } from 'sonner';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Order {
  id: string;
  po_number?: string;
  status: string;
  total_amount: number;
  created_at: string;
  supplier_name?: string;
  expected_delivery?: string;
}

interface TimelineEvent {
  id: string;
  event_type: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
  user_name?: string;
  user_role?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_amount: number;
  tax_amount: number;
  currency: string;
  status: string;
  due_date?: string;
  notes?: string;
  uploaded_by_name?: string;
  approved_by_name?: string;
  paid_at?: string;
  created_at: string;
}

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  uploaded_by_name?: string;
  created_at: string;
}

// ─── Event type icons ─────────────────────────────────────────────────────────

const eventIcon = (type: string) => {
  if (type.includes('approved') || type.includes('accepted') || type.includes('delivered')) {
    return <CheckCircle2 className="h-4 w-4 text-success" />;
  }
  if (type.includes('rejected') || type.includes('cancelled')) {
    return <AlertCircle className="h-4 w-4 text-destructive" />;
  }
  if (type.includes('dispatch') || type.includes('transit') || type.includes('processing')) {
    return <Truck className="h-4 w-4 text-info" />;
  }
  if (type.includes('invoice')) {
    return <FileText className="h-4 w-4 text-primary" />;
  }
  if (type.includes('supplier')) {
    return <Package className="h-4 w-4 text-purple-500" />;
  }
  return <Clock className="h-4 w-4 text-muted-foreground" />;
};

const invoiceStatusColor = (status: string) => {
  if (status === 'paid') return 'bg-success/10 text-success';
  if (status === 'approved') return 'bg-info/10 text-info';
  if (status === 'rejected') return 'bg-destructive/10 text-destructive';
  if (status === 'payment_pending') return 'bg-warning/10 text-warning';
  return 'bg-muted text-muted-foreground';
};

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  order: Order | null;
  open: boolean;
  onClose: () => void;
}

type Tab = 'timeline' | 'invoice' | 'attachments' | 'fulfillment';

export const OrderDetailDrawer: React.FC<Props> = ({ order, open, onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>('timeline');
  const [invoiceUploadOpen, setInvoiceUploadOpen] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const role = user?.role ?? '';
  const isSupplier = role === 'supplier';
  const canManage = role === 'admin' || role === 'operations_manager';
  const canFulfill = isSupplier || canManage;
  const fulfillableStatuses = ['accepted_by_supplier', 'processing', 'partially_fulfilled'];

  // Full order (with items) for partial fulfillment
  const { data: orderDetail } = useQuery<{ items: any[] }>({
    queryKey: ['order-detail', order?.id],
    queryFn: () => api.get(`/orders/${order!.id}`).then(r => r.data),
    enabled: !!order?.id && open && canFulfill && fulfillableStatuses.includes(order?.status ?? ''),
  });

  // Timeline query
  const { data: timeline = [], isLoading: timelineLoading } = useQuery<TimelineEvent[]>({
    queryKey: ['order-timeline', order?.id],
    queryFn: () => api.get(`/orders/${order!.id}/timeline`).then(r => r.data),
    enabled: !!order?.id && open && activeTab === 'timeline',
  });

  // Invoices query
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices', order?.id],
    queryFn: () => api.get(`/invoices?order_id=${order!.id}`).then(r => r.data),
    enabled: !!order?.id && open && activeTab === 'invoice',
  });

  // Attachments query
  const { data: attachments = [], isLoading: attachmentsLoading } = useQuery<Attachment[]>({
    queryKey: ['attachments', 'order', order?.id],
    queryFn: () => api.get(`/attachments?resource_type=order&resource_id=${order!.id}`).then(r => r.data),
    enabled: !!order?.id && open && activeTab === 'attachments',
  });

  // Invoice status mutation
  const invoiceStatusMutation = useMutation({
    mutationFn: ({ invoiceId, status }: { invoiceId: string; status: string }) =>
      api.patch(`/invoices/${invoiceId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', order?.id] });
      toast.success('Invoice status updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to update invoice'),
  });

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !order) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('resource_type', 'order');
    formData.append('resource_id', order.id);

    try {
      await api.post('/attachments/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      queryClient.invalidateQueries({ queryKey: ['attachments', 'order', order.id] });
      toast.success('File uploaded successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Upload failed');
    }
    e.target.value = '';
  };

  if (!open || !order) return null;

  const poDisplay = order.po_number ?? order.id.slice(0, 8).toUpperCase();

  const statusColors: Record<string, string> = {
    pending_approval:               'bg-warning/10 text-warning',
    approved:                       'bg-info/10 text-info',
    awaiting_supplier_confirmation: 'bg-purple-500/10 text-purple-600',
    accepted_by_supplier:           'bg-blue-500/10 text-blue-600',
    processing:                     'bg-primary/10 text-primary',
    dispatched:                     'bg-orange-500/10 text-orange-600',
    in_transit:                     'bg-sky-500/10 text-sky-600',
    delivered:                      'bg-success/10 text-success',
    rejected:                       'bg-destructive/10 text-destructive',
    cancelled:                      'bg-muted text-muted-foreground',
    partially_fulfilled:            'bg-orange-400/10 text-orange-500',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b p-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-foreground font-mono">{poDisplay}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColors[order.status] ?? 'bg-muted text-muted-foreground'}`}>
                {order.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {order.supplier_name ?? 'No supplier'} &middot; ${Number(order.total_amount).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b overflow-x-auto">
          {(
            [
              'timeline',
              'invoice',
              'attachments',
              ...(canFulfill && fulfillableStatuses.includes(order?.status ?? '') ? ['fulfillment'] : []),
            ] as Tab[]
          ).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'timeline' && <Clock className="h-3.5 w-3.5" />}
              {t === 'invoice' && <FileText className="h-3.5 w-3.5" />}
              {t === 'attachments' && <Paperclip className="h-3.5 w-3.5" />}
              {t === 'fulfillment' && <Package className="h-3.5 w-3.5" />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Timeline ──────────────────────────────────────────────────────── */}
          {activeTab === 'timeline' && (
            <div>
              {timelineLoading ? (
                <div className="text-center text-muted-foreground py-8 text-sm">Loading timeline...</div>
              ) : timeline.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 text-sm">No events recorded yet</div>
              ) : (
                <div className="space-y-0">
                  {timeline.map((event, idx) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                          {eventIcon(event.event_type)}
                        </div>
                        {idx < timeline.length - 1 && (
                          <div className="w-px flex-1 bg-border" style={{ minHeight: '20px' }} />
                        )}
                      </div>
                      <div className="pb-5 pt-1 min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{event.message}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {event.user_name && (
                            <span className="text-xs text-muted-foreground">{event.user_name}</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Invoice ───────────────────────────────────────────────────────── */}
          {activeTab === 'invoice' && (
            <div className="space-y-4">
              {invoicesLoading ? (
                <div className="text-center text-muted-foreground py-8 text-sm">Loading invoices...</div>
              ) : invoices.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No invoices yet</p>
                  {(isSupplier || canManage) && order.status === 'delivered' && (
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() => setInvoiceUploadOpen(true)}
                    >
                      <Upload className="h-3.5 w-3.5 mr-1" />Upload Invoice
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {(isSupplier || canManage) && order.status === 'delivered' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setInvoiceUploadOpen(true)}
                    >
                      <Upload className="h-3.5 w-3.5 mr-1" />Upload Another Invoice
                    </Button>
                  )}
                  {invoices.map(inv => (
                    <div key={inv.id} className="rounded-xl border bg-card p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-foreground">{inv.invoice_number}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Uploaded by {inv.uploaded_by_name ?? 'Unknown'}</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${invoiceStatusColor(inv.status)}`}>
                          {inv.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Amount</p>
                          <p className="font-semibold text-foreground">${Number(inv.invoice_amount).toLocaleString()} {inv.currency}</p>
                        </div>
                        {Number(inv.tax_amount) > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground">Tax</p>
                            <p className="text-foreground">${Number(inv.tax_amount).toLocaleString()}</p>
                          </div>
                        )}
                        {inv.due_date && (
                          <div>
                            <p className="text-xs text-muted-foreground">Due Date</p>
                            <p className="text-foreground">{new Date(inv.due_date).toLocaleDateString()}</p>
                          </div>
                        )}
                        {inv.paid_at && (
                          <div>
                            <p className="text-xs text-muted-foreground">Paid At</p>
                            <p className="text-success">{new Date(inv.paid_at).toLocaleDateString()}</p>
                          </div>
                        )}
                      </div>
                      {inv.notes && (
                        <p className="text-xs text-muted-foreground border-t pt-2">{inv.notes}</p>
                      )}
                      {canManage && inv.status === 'uploaded' && (
                        <div className="flex gap-2 border-t pt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-success border-success/30 hover:bg-success/10"
                            onClick={() => invoiceStatusMutation.mutate({ invoiceId: inv.id, status: 'approved' })}
                            disabled={invoiceStatusMutation.isPending}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => invoiceStatusMutation.mutate({ invoiceId: inv.id, status: 'rejected' })}
                            disabled={invoiceStatusMutation.isPending}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                      {canManage && inv.status === 'approved' && (
                        <div className="flex gap-2 border-t pt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-warning border-warning/30 hover:bg-warning/10"
                            onClick={() => invoiceStatusMutation.mutate({ invoiceId: inv.id, status: 'payment_pending' })}
                            disabled={invoiceStatusMutation.isPending}
                          >
                            Mark Payment Pending
                          </Button>
                          <Button
                            size="sm"
                            className="bg-success text-white hover:bg-success/90"
                            onClick={() => invoiceStatusMutation.mutate({ invoiceId: inv.id, status: 'paid' })}
                            disabled={invoiceStatusMutation.isPending}
                          >
                            Mark Paid
                          </Button>
                        </div>
                      )}
                      {canManage && inv.status === 'payment_pending' && (
                        <div className="border-t pt-3">
                          <Button
                            size="sm"
                            className="bg-success text-white hover:bg-success/90"
                            onClick={() => invoiceStatusMutation.mutate({ invoiceId: inv.id, status: 'paid' })}
                            disabled={invoiceStatusMutation.isPending}
                          >
                            Mark Paid
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── Fulfillment ───────────────────────────────────────────────────── */}
          {activeTab === 'fulfillment' && (
            <div>
              {!orderDetail ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-secondary animate-pulse" />)}
                </div>
              ) : (
                <PartialFulfillmentPanel
                  orderId={order!.id}
                  items={orderDetail.items ?? []}
                  onSuccess={() => queryClient.invalidateQueries({ queryKey: ['order-detail', order!.id] })}
                />
              )}
            </div>
          )}

          {/* ── Attachments ───────────────────────────────────────────────────── */}
          {activeTab === 'attachments' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  {attachments.length} file{attachments.length !== 1 ? 's' : ''}
                </p>
                <label className="flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                  <Upload className="h-3.5 w-3.5" />Upload File
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>

              {attachmentsLoading ? (
                <div className="text-center text-muted-foreground py-8 text-sm">Loading attachments...</div>
              ) : attachments.length === 0 ? (
                <div className="text-center py-8">
                  <Paperclip className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No files attached</p>
                </div>
              ) : (
                attachments.map(att => (
                  <a
                    key={att.id}
                    href={`http://localhost:5000${att.file_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg border p-3 hover:bg-secondary transition-colors"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{att.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(att.file_size)}
                        {att.uploaded_by_name ? ` · ${att.uploaded_by_name}` : ''}
                        {` · ${new Date(att.created_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 rotate-[-90deg] text-muted-foreground shrink-0" />
                  </a>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <InvoiceUploadDialog
        open={invoiceUploadOpen}
        onOpenChange={setInvoiceUploadOpen}
        orderId={order.id}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['invoices', order.id] });
          setInvoiceUploadOpen(false);
        }}
      />
    </>
  );
};
