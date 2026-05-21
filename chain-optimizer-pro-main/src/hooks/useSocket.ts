import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

export const useSocket = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const socket = io('http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected to SynapChain server');
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    socket.on('order:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] });
    });

    socket.on('shipment:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
    });

    socket.on('invoice:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    });

    socket.on('notification:new', () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, queryClient]);

  return socketRef;
};
