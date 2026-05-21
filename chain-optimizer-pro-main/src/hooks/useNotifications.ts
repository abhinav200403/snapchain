import { useEffect, useState, useCallback, useRef } from 'react';
import type { AppRole } from '@/types/roles';
import api from '@/lib/api';

export interface AppNotification {
  id: string;
  type: 'low_stock' | 'order_pending' | 'order_fulfillment' | 'shipment_delayed' | 'fulfillment_rejected' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  link?: string;
}

const buildNotifications = (
  inventory: any[],
  orders: any[],
  shipments: any[],
  role: AppRole,
): AppNotification[] => {
  const notes: AppNotification[] = [];

  const isAdminOrOps = role === 'admin' || role === 'operations_manager';
  const isSupplier = role === 'supplier';
  const isAnalyst = role === 'business_analyst';

  // Admin & Ops: orders awaiting internal approval
  if (isAdminOrOps) {
    const pendingOrders = orders.filter(o => o.status === 'pending_approval');
    if (pendingOrders.length > 0) {
      notes.push({
        id: 'orders-pending-approval',
        type: 'order_pending',
        title: 'Orders Need Approval',
        message: `${pendingOrders.length} order${pendingOrders.length > 1 ? 's' : ''} awaiting your approval`,
        timestamp: new Date(Math.max(...pendingOrders.map(o => new Date(o.created_at).getTime()))),
        read: false,
        link: '/orders?status=pending_approval',
      });
    }

    // Supplier-rejected fulfillments
    const rejectedBySupplier = orders.filter(o => o.status === 'rejected' && o.supplier_id);
    rejectedBySupplier.slice(0, 5).forEach(o => {
      notes.push({
        id: `supplier-rejected-${o.id}`,
        type: 'fulfillment_rejected',
        title: 'Supplier Rejected Fulfillment',
        message: `Order #${o.po_number ?? o.id.slice(0, 8).toUpperCase()} was rejected by the supplier`,
        timestamp: new Date(o.updated_at ?? o.created_at),
        read: false,
        link: '/orders?status=rejected',
      });
    });
  }

  // Admin & Ops: low stock alerts
  if (isAdminOrOps || isAnalyst) {
    inventory.forEach((p: any) => {
      if (p.low_stock || Number(p.stock_quantity) <= Number(p.reorder_level)) {
        notes.push({
          id: `low-${p.id}`,
          type: 'low_stock',
          title: 'Low Stock Alert',
          message: `${p.name} — ${p.stock_quantity} units left (reorder at ${p.reorder_level})`,
          timestamp: new Date(),
          read: false,
          link: '/inventory?tab=low_stock',
        });
      }
    });
  }

  // Supplier: new fulfillment requests assigned to them
  if (isSupplier) {
    const fulfillmentRequests = orders.filter(o => o.status === 'awaiting_supplier_confirmation');
    fulfillmentRequests.slice(0, 5).forEach(o => {
      notes.push({
        id: `fulfill-${o.id}`,
        type: 'order_fulfillment',
        title: 'New Fulfillment Request',
        message: `Order #${o.po_number ?? o.id.slice(0, 8).toUpperCase()} — $${Number(o.total_amount).toLocaleString()} — awaiting your confirmation`,
        timestamp: new Date(o.updated_at ?? o.created_at),
        read: false,
        link: '/orders?status=awaiting_supplier_confirmation',
      });
    });
  }

  // All roles: delayed shipments
  shipments.forEach((s: any) => {
    if (s.status === 'delayed') {
      notes.push({
        id: `ship-${s.id}`,
        type: 'shipment_delayed',
        title: 'Shipment Delayed',
        message: `Shipment #${s.id.slice(0, 8).toUpperCase()} is currently delayed`,
        timestamp: new Date(s.updated_at ?? new Date()),
        read: false,
        link: '/shipments',
      });
    }
  });

  return notes.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

const loadReadIds = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem('read_notifications') ?? '[]'));
  } catch {
    return new Set();
  }
};

export const useNotifications = (role: AppRole) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const readIdsRef = useRef<Set<string>>(loadReadIds());
  const [readVersion, setReadVersion] = useState(0);

  const fetchNotifications = useCallback(async () => {
    const safe = (p: Promise<any>) => p.then(r => r.data).catch(() => []);
    const needsInventory = role === 'admin' || role === 'operations_manager' || role === 'business_analyst';
    const needsShipments = true;

    const [inv, ord, ship] = await Promise.all([
      needsInventory ? safe(api.get('/inventory')) : Promise.resolve([]),
      safe(api.get('/orders')),
      needsShipments ? safe(api.get('/shipments')) : Promise.resolve([]),
    ]);

    const built = buildNotifications(inv, ord, ship, role);
    setNotifications(built.map(n => ({ ...n, read: readIdsRef.current.has(n.id) })));
  }, [role]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      prev.map(n => n.id).forEach(id => readIdsRef.current.add(id));
      localStorage.setItem('read_notifications', JSON.stringify([...readIdsRef.current]));
      setReadVersion(v => v + 1);
      return prev.map(n => ({ ...n, read: true }));
    });
  }, []);

  const markRead = useCallback((id: string) => {
    readIdsRef.current.add(id);
    localStorage.setItem('read_notifications', JSON.stringify([...readIdsRef.current]));
    setReadVersion(v => v + 1);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const unreadCount = readVersion >= 0 ? notifications.filter(n => !n.read).length : 0;

  return { notifications, unreadCount, markAllRead, markRead, refresh: fetchNotifications };
};
