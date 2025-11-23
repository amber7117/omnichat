export type ChannelKind = 'whatsapp' | 'telegram-user' | 'telegram-bot' | 'facebook' | 'widget';

export interface AuthContext {
  userId: string;
  tenantId: string;
  email: string;
}

export interface InboundAttachment {
  type: 'image' | 'video' | 'audio' | 'file' | 'location' | string;
  url?: string;
  mimeType?: string;
  extra?: Record<string, unknown>;
}

export interface InboundMessagePayload {
  tenantId: string;
  channelInstanceId: string;
  channelType: ChannelKind | string;
  externalUserId: string;
  externalConversationId?: string;
  text?: string;
  attachments?: InboundAttachment[];
  raw: unknown;
  timestamp: Date;
}
