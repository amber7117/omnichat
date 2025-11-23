import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { logger } from './logger';

let ioInstance: Server | null = null;

export function createSocketServer(server: HttpServer): Server {
  const io = new Server(server, {
    path: env.SOCKET_PATH,
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
  });

  ioInstance = io;

  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'WebSocket connected');

    socket.on('join-channel', (channelId: string) => {
      socket.join(channelId);
      logger.debug({ channelId, socketId: socket.id }, 'Joined channel room');
    });

    socket.on('leave-channel', (channelId: string) => {
      socket.leave(channelId);
      logger.debug({ channelId, socketId: socket.id }, 'Left channel room');
    });
  });

  return io;
}

export function emitToChannel(channelInstanceId: string, event: string, payload: unknown): void {
  if (!ioInstance) {
    logger.warn({ channelInstanceId, event }, 'Socket server not initialized for emit');
    return;
  }
  ioInstance.to(channelInstanceId).emit(event, payload);
}

export function getSocketServer(): Server | null {
  return ioInstance;
}
