import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotifications } from '@/hooks/useNotifications';
import { ROLE_LABELS } from '@/types/roles';
import { Bell, Search, Sun, Moon, X, AlertTriangle, ShoppingCart, Truck, Info, CheckCheck, PackageX } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

const notifIcon = (type: string) => {
  if (type === 'low_stock') return <AlertTriangle className="h-4 w-4 text-warning" />;
  if (type === 'order_pending') return <ShoppingCart className="h-4 w-4 text-info" />;
  if (type === 'order_fulfillment') return <ShoppingCart className="h-4 w-4 text-warning" />;
  if (type === 'shipment_delayed') return <Truck className="h-4 w-4 text-destructive" />;
  if (type === 'fulfillment_rejected') return <PackageX className="h-4 w-4 text-destructive" />;
  return <Info className="h-4 w-4 text-muted-foreground" />;
};

const useGlobalSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      const q = query.toLowerCase();
      // Fetch each endpoint independently so one 403 doesn't block others
      const safe = (p: Promise<any>) => p.catch(() => []);
      const [inv, ord, sup] = await Promise.all([
        safe(api.get('/inventory').then(r => r.data)),
        safe(api.get('/orders').then(r => r.data)),
        safe(api.get('/suppliers').then(r => r.data)),
      ]);
      const hits: any[] = [
        ...(inv as any[]).filter((p: any) => p.name?.toLowerCase().includes(q)).map((p: any) => ({ type: 'product', label: p.name, sub: `SKU: ${p.sku}`, path: '/inventory' })),
        ...(ord as any[]).filter((o: any) =>
          o.id?.toLowerCase().includes(q) ||
          o.po_number?.toLowerCase().includes(q) ||
          o.supplier_name?.toLowerCase().includes(q)
        ).map((o: any) => ({ type: 'order', label: `Order #${o.po_number ?? o.id.slice(0, 8).toUpperCase()}`, sub: o.supplier_name ?? '', path: '/orders' })),
        ...(sup as any[]).filter((s: any) => s.name?.toLowerCase().includes(q)).map((s: any) => ({ type: 'supplier', label: s.name, sub: s.email ?? '', path: '/suppliers' })),
      ].slice(0, 8);
      setResults(hits);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return { query, setQuery, results, loading };
};

export const Header: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications(user?.role ?? 'business_analyst');
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { query, setQuery, results, loading } = useGlobalSearch();
  const navigate = useNavigate();
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) { setSearchOpen(false); setQuery(''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <header className="flex h-16 items-center justify-between border-b px-6 bg-background">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {/* Global Search */}
        <div ref={searchRef} className="relative">
          <button
            onClick={() => setSearchOpen(v => !v)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Search className="h-4 w-4" />
          </button>
          {searchOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border bg-card shadow-lg z-50">
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  autoFocus
                  placeholder="Search products, orders, suppliers..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                {query && <button onClick={() => setQuery('')}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
              </div>
              {loading && <div className="px-4 py-3 text-xs text-muted-foreground">Searching...</div>}
              {!loading && query.length >= 2 && results.length === 0 && (
                <div className="px-4 py-3 text-xs text-muted-foreground">No results for "{query}"</div>
              )}
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => { navigate(r.path); setSearchOpen(false); setQuery(''); }}
                  className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-secondary transition-colors"
                >
                  <span className="mt-0.5 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">{r.type}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.label}</p>
                    {r.sub && <p className="text-xs text-muted-foreground truncate">{r.sub}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setNotifOpen(v => !v)}
            className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-96 rounded-xl border bg-card shadow-lg z-50">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <CheckCheck className="h-3.5 w-3.5" />Mark all read
                    </button>
                  )}
                  <button onClick={() => setNotifOpen(false)}><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">All caught up! No notifications.</div>
                ) : notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => { markRead(n.id); if (n.link) { navigate(n.link); setNotifOpen(false); } }}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary border-b last:border-0',
                      !n.read && 'bg-primary/5'
                    )}
                  >
                    <div className="mt-0.5 shrink-0">{notifIcon(n.type)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{n.timestamp.toLocaleTimeString()}</p>
                    </div>
                    {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User info */}
        <div className="ml-1 hidden items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 sm:flex">
          <span className="text-xs font-medium text-foreground">{user?.companyName}</span>
          <span className="text-[10px] text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">{user ? ROLE_LABELS[user.role] : ''}</span>
        </div>
      </div>
    </header>
  );
};
