import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RoleGuard } from '@/components/RoleGuard';
import { Plus, Search, Package, Edit2, Trash2, Download, Upload, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { AddProductDialog } from '@/components/modals/AddProductDialog';
import { EditProductDialog } from '@/components/modals/EditProductDialog';
import { exportCSV } from '@/lib/export';
import api from '@/lib/api';
import { toast } from 'sonner';

type Tab = 'all' | 'low_stock';
const PAGE_SIZE = 10;

const Inventory = () => {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get('/inventory').then(r => r.data),
  });

  const allFiltered = products.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = products.filter((p: any) => p.low_stock || p.stock_quantity <= p.reorder_level);
  const filtered = tab === 'low_stock' ? lowStock.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  ) : allFiltered;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExport = () => {
    exportCSV('inventory', products.map((p: any) => ({
      name: p.name,
      sku: p.sku,
      category: p.category,
      stock_quantity: p.stock_quantity,
      reorder_level: p.reorder_level,
      unit_price: p.unit_price,
      status: (p.low_stock || p.stock_quantity <= p.reorder_level) ? 'Low Stock' : 'In Stock',
    })));
    toast.success('Inventory exported');
  };

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split('\n').filter(Boolean);
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const rows = lines.slice(1).map(line => {
          const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
        });
        let success = 0;
        for (const row of rows) {
          try {
            await api.post('/inventory', {
              name: row.name,
              sku: row.sku,
              category: row.category,
              stock_quantity: Number(row.stock_quantity ?? 0),
              reorder_level: Number(row.reorder_level ?? 10),
              unit_price: Number(row.unit_price ?? 0),
            });
            success++;
          } catch { /* skip invalid rows */ }
        }
        toast.success(`Imported ${success} of ${rows.length} products`);
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
      } catch {
        toast.error('Failed to parse CSV file');
      }
      if (fileRef.current) fileRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await api.delete(`/inventory/${id}`);
      toast.success('Product deleted');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to delete product');
    } finally {
      setDeletingId(null);
    }
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['inventory'] });

  return (
    <div>
      <Header title="Inventory" subtitle="Manage products and stock levels" />
      <div className="p-6 space-y-4">
        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-lg border p-1 w-fit">
          {(['all', 'low_stock'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1); }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'low_stock' && <AlertTriangle className="h-3 w-3" />}
              {t === 'all' ? 'All Products' : `Low Stock (${lowStock.length})`}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-3.5 w-3.5 mr-1" />Export CSV
            </Button>
            <RoleGuard allowed={['admin', 'operations_manager']}>
              <>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleBulkImport} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5 mr-1" />Import CSV
                </Button>
              </>
            </RoleGuard>
            <RoleGuard allowed={['admin']}>
              <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Product</Button>
            </RoleGuard>
          </div>
        </div>

        {tab === 'low_stock' && lowStock.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <p className="text-sm text-warning font-medium">{lowStock.length} product{lowStock.length !== 1 ? 's' : ''} below reorder threshold — consider restocking soon.</p>
          </div>
        )}

        <div className="rounded-xl border bg-card overflow-hidden opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/40 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Threshold</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    {tab === 'low_stock' ? 'No low stock items — all products are well stocked!' : 'No products found'}
                  </td></tr>
                ) : paginated.map((p: any) => {
                  const isLow = p.low_stock || p.stock_quantity <= p.reorder_level;
                  return (
                    <tr key={p.id} className={`border-b last:border-0 hover:bg-secondary/20 transition-colors ${isLow ? 'bg-warning/5' : ''}`}>
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />{p.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{p.sku}</td>
                      <td className="px-4 py-3 text-foreground">{p.category}</td>
                      <td className="px-4 py-3 tabular-nums text-foreground font-medium">{p.stock_quantity}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{p.reorder_level}</td>
                      <td className="px-4 py-3 tabular-nums text-foreground">${Number(p.unit_price).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          isLow ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                        }`}>{isLow ? 'Low Stock' : 'In Stock'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <RoleGuard allowed={['admin', 'operations_manager']}>
                            <button
                              onClick={() => setEditProduct(p)}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                              title="Edit product"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          </RoleGuard>
                          <RoleGuard allowed={['admin']}>
                            <button
                              onClick={() => handleDelete(p.id, p.name)}
                              disabled={deletingId === p.id}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                              title="Delete product"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </RoleGuard>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t px-4 py-3">
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
        </div>

        {tab === 'all' && (
          <p className="text-xs text-muted-foreground px-1">
            Tip: Import CSV with columns: name, sku, category, stock_quantity, reorder_level, unit_price
          </p>
        )}
      </div>

      <AddProductDialog open={addOpen} onOpenChange={setAddOpen} onSuccess={refresh} />
      <EditProductDialog product={editProduct} onOpenChange={open => { if (!open) setEditProduct(null); }} onSuccess={refresh} />
    </div>
  );
};

export default Inventory;
