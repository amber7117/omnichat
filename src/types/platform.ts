// ✅ Platform types for multi-tenant integration management

export type PlatformType = 'whatsapp' | 'telegram' | 'telegram-bot' | 'widget' | 'facebook' | 'wechat' | 'wecom' | 'wechaty';

export type PlatformStatus = 'disconnected' | 'connecting' | 'connected' | 'error';




export interface Platform {
  id: string;
  name: string;
  type: 'whatsapp' | 'telegram' | 'telegram-bot' | 'widget' | 'facebook' | 'wechat' | 'wecom' | 'wechaty';
  status: 'connected' | 'connecting' | 'error' | 'disconnected';
  config: Record<string, unknown>;
  lastActivity: Date;
  agentCount: number;
  createdAt: Date;
  updatedAt: Date;
  phoneNumber?: string;
  messageCount?: number;
  
  // Additional fields from API response
  tenantId?: string;
  displayName?: string;
  meta?: PlatformMeta;
}

export interface PlatformMeta {
  // WhatsApp
  phoneNumber?: string;
  lastHeartbeat?: string;
  
  // Telegram User
  username?: string;
  firstName?: string;
  
  // Telegram Bot
  botUsername?: string;
  botToken?: string;
  
  // Web Widget
  embedCode?: string;
  widgetId?: string;
  
  // Facebook
  pageName?: string;
  pageId?: string;

  // Wechaty
  userName?: string;
  userId?: string;
}

export interface WhatsAppQRResponse {
  ok: boolean;
  qr?: string;
  error?: string;
  expiresIn?: number; // seconds
}

export interface PlatformConnectionResponse {
  ok: boolean;
  platform?: Platform;
  message?: string;
  error?: string;
}

export interface PlatformListResponse {
  ok: boolean;
  platforms?: Platform[];
  error?: string;
}
