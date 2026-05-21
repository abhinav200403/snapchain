import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JwtPayload } from './types';

let io: Server | null = null;

export function initSocket(httpServer: any): Server {
  io = new Server(httpServer, {
    cors: {
      origin: /localhost/,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JwtPayload;
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user as JwtPayload;
    if (user?.companyId) {
      socket.join(user.companyId);
      console.log(`Socket connected: ${user.email} (${user.companyId})`);
    }

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${user?.email}`);
    });
  });

  return io;
}

export function getIo(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
