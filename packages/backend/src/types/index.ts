export type ChannelKind = 'whatsapp' | 'telegram-user' | 'telegram-bot' | 'facebook' | 'widget' | 'wechat' | 'wecom' | 'wechaty';

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
  externalUserName?: string;
  externalUserAvatar?: string;
  externalConversationId?: string;
  text?: string;
  transcription?: string;
  summary?: string;
  attachments?: InboundAttachment[];
  raw: unknown;
  timestamp: Date;
}
