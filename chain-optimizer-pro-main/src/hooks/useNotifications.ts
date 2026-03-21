import { useEffect, useState, useCallback, useRef } from 'react';
import api from '@/lib/api';

export interface AppNotification {
  id: string;
  type: 'low_stock' | 'order_pending' | 'shipment_delayed' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

const buildNotifications = (inventory: any[], orders: any[], shipments: any[]): AppNotification[] => {
  const notes: AppNotification[] = [];

  inventory.forEach((p: any) => {
    if (p.low_stock || p.stock_quantity <= p.reorder_level) {
      notes.push({
        id: `low-${p.id}`,
        type: 'low_stock',
        title: 'Low Stock Alert',
        message: `${p.name} has only ${p.stock_quantity} units left (threshold: ${p.reorder_level})`,
        timestamp: new Date(),
        read: false,
      });
    }
  });

  orders.forEach((o: any) => {
    if (o.status === 'pending') {
      notes.push({
        id: `order-${o.id}`,
        type: 'order_pending',
        title: 'Pending Order',
        message: `Order #${o.id.slice(0, 8).toUpperCase()} from ${o.supplier_name ?? 'supplier'} is awaiting processing`,
        timestamp: new Date(o.created_at),
        read: false,
      });
    }
  });

  shipments.forEach((s: any) => {
    if (s.status === 'delayed') {
      notes.push({
        id: `ship-${s.id}`,
        type: 'shipment_delayed',
        title: 'Shipment Delayed',
        message: `Shipment #${s.id.slice(0, 8).toUpperCase()} is delayed`,
        timestamp: new Date(),
        read: false,
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

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  // Use a ref so fetchNotifications doesn't re-create on every markRead
  const readIdsRef = useRef<Set<string>>(loadReadIds());
  const [readVersion, setReadVersion] = useState(0); // triggers re-render for unreadCount

  const fetchNotifications = useCallback(async () => {
    const safe = (p: Promise<any>) => p.then(r => r.data).catch(() => []);
    const [inv, ord, ship] = await Promise.all([
      safe(api.get('/inventory')),
      safe(api.get('/orders')),
      safe(api.get('/shipments')),
    ]);
    const built = buildNotifications(inv, ord, ship);
    setNotifications(built.map(n => ({ ...n, read: readIdsRef.current.has(n.id) })));
  }, []); // stable — no deps

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const allIds = prev.map(n => n.id);
      allIds.forEach(id => readIdsRef.current.add(id));
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

  // readVersion in scope to force recalc
  const unreadCount = readVersion >= 0 ? notifications.filter(n => !n.read).length : 0;

  return { notifications, unreadCount, markAllRead, markRead, refresh: fetchNotifications };
};
