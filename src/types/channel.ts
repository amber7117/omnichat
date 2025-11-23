export type ChannelType =
  | 'whatsapp'
  | 'telegram'
  | 'telegram-bot'
  | 'facebook'
  | 'widget'
  | string;

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  status?: string;
  config: Record<string, unknown>;
  agentCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
  phoneNumber?: string;
  lastActivity?: string | Date;
}

export interface ChannelStatusResponse {
  status?: string;
  lastError?: string;
  deviceInfo?: Record<string, unknown>;
  lastHeartbeatAt?: string;
}

export interface FacebookOAuthUrlResponse {
  url?: string;
}

export interface ApiResponse<T = unknown> {
  ok?: boolean;
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}
