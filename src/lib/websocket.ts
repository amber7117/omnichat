// src/lib/websocket.ts
import { io, Socket } from 'socket.io-client';

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    this.connect();
  }

  private connect(): void {
    try {
      // Get API URL - handle both browser and Node.js environments
      let apiUrl = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');
      
      if (typeof window !== 'undefined' && window.__APP_CONFIG__?.apiUrl) {
        apiUrl = window.__APP_CONFIG__.apiUrl;
      } else if (typeof process !== 'undefined' && process.env.REACT_APP_API_URL) {
        apiUrl = process.env.REACT_APP_API_URL;
      }

      // Remove /api suffix if present to get the base URL
      if (apiUrl && apiUrl.endsWith('/api')) {
        apiUrl = apiUrl.slice(0, -4);
      }

      this.socket = io(apiUrl || undefined, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
      });

      this.socket.on('connect', () => {
        console.warn('🔌 WebSocket connected');
        this.reconnectAttempts = 0;
      });

      this.socket.on('disconnect', (reason) => {
        console.warn('🔌 WebSocket disconnected:', reason);
        this.handleReconnect();
      });

      this.socket.on('connect_error', (error) => {
        console.error('🔌 WebSocket connection error:', error);
        this.handleReconnect();
      });

    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.warn(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  }

  public joinChannel(channelId: string): void {
    if (this.socket?.connected) {
      console.log(`[WebSocket] 加入频道: ${channelId}`);
      this.socket.emit('join-channel', channelId);
    } else {
      console.warn(`[WebSocket] Socket 未连接，无法加入频道: ${channelId}`);
    }
  }

  public leaveChannel(channelId: string): void {
    if (this.socket?.connected) {
      console.log(`[WebSocket] 离开频道: ${channelId}`);
      this.socket.emit('leave-channel', channelId);
    }
  }

  public on(event: string, callback: (...args: unknown[]) => void): void {
    console.log(`[WebSocket] 注册事件监听: ${event}`);
    this.socket?.on(event, callback);
  }

  public off(event: string, callback?: (...args: unknown[]) => void): void {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.off(event);
    }
  }

  public disconnect(): void {
    this.socket?.disconnect();
  }

  public get isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const websocketService = new WebSocketService();