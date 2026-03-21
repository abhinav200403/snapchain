import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { AppRole } from '@/types/roles';
import { ROLE_LABELS } from '@/types/roles';
import {
  LayoutDashboard, Package, ShoppingCart, Truck, Users,
  BarChart3, Brain, Settings, ChevronLeft, ChevronRight, LogOut, FileText,
  UserCircle, CreditCard, Sun, Moon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/contexts/SidebarContext';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  roles: AppRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'operations_manager', 'supplier', 'business_analyst'] },
  { label: 'Inventory', path: '/inventory', icon: Package, roles: ['admin', 'operations_manager'] },
  { label: 'Orders', path: '/orders', icon: ShoppingCart, roles: ['admin', 'operations_manager', 'supplier'] },
  { label: 'Shipments', path: '/shipments', icon: Truck, roles: ['admin', 'operations_manager', 'supplier'] },
  { label: 'Suppliers', path: '/suppliers', icon: Users, roles: ['admin', 'operations_manager'] },
  { label: 'Analytics', path: '/analytics', icon: BarChart3, roles: ['admin', 'business_analyst'] },
  { label: 'AI Predictions', path: '/predictions', icon: Brain, roles: ['admin', 'business_analyst'] },
  { label: 'User Management', path: '/users', icon: Users, roles: ['admin'] },
  { label: 'Audit Log', path: '/audit-log', icon: FileText, roles: ['admin'] },
  { label: 'Settings', path: '/settings', icon: Settings, roles: ['admin'] },
  { label: 'Profile', path: '/profile', icon: UserCircle, roles: ['admin', 'operations_manager', 'supplier', 'business_analyst'] },
  { label: 'Billing', path: '/billing', icon: CreditCard, roles: ['admin', 'operations_manager', 'supplier', 'business_analyst'] },
];

export const Sidebar = () => {
  const { user, logout, switchRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { collapsed, setCollapsed } = useSidebar();
  const location = useLocation();

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(user.role));

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-[260px]'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
          <Brain className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in overflow-hidden">
            <h1 className="text-sm font-bold text-sidebar-accent-foreground">NeuroChain</h1>
            <p className="text-[11px] text-sidebar-muted">AI Supply Chain</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {visibleItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-primary'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span className="animate-fade-in">{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Role switcher (demo) */}
      {!collapsed && (
        <div className="border-t border-sidebar-border px-3 py-3">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
            Demo: Switch Role
          </p>
          <div className="flex flex-wrap gap-1">
            {(['admin', 'operations_manager', 'supplier', 'business_analyst'] as AppRole[]).map(role => (
              <button
                key={role}
                onClick={() => switchRole(role)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                  user.role === role
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                {ROLE_LABELS[role].split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* User + Collapse */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
            {user.name?.split(' ').map(n => n[0]).join('') ?? '?'}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 animate-fade-in">
              <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{user.name}</p>
              <p className="truncate text-[11px] text-sidebar-muted">{ROLE_LABELS[user.role]}</p>
            </div>
          )}
          <button onClick={toggleTheme} className="shrink-0 rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors" title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={logout} className="shrink-0 rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors" title="Logout">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>
    </aside>
  );
};
