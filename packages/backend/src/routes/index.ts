import type { Express } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import channelRoutes from '../modules/channels/channel.routes';
import telegramRoutes from '../modules/channels/telegram/telegram.routes';
import messageRoutes from '../modules/messages/message.routes';
import facebookRoutes from '../modules/channels/facebook/facebook.routes';
import wechatRoutes from '../modules/channels/wechat/wechat.routes';
import wecomRoutes from '../modules/channels/wecom/wecom.routes';
import wechatyRoutes from '../modules/channels/wechaty/wechaty.routes';
import conversationRoutes from '../modules/conversations/conversation.routes';
import agentRoutes from '../modules/agents/agent.routes';
import osintRoutes from '../modules/osint/osint.routes';

export function registerRoutes(app: Express): void {
  app.use('/api/auth', authRoutes);
  app.use('/api/channels', channelRoutes);
  app.use('/api/telegram', telegramRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/facebook', facebookRoutes);
  app.use('/api/wechat', wechatRoutes);
  app.use('/api/wecom', wecomRoutes);
  app.use('/api/wechaty', wechatyRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/agents', agentRoutes);
  app.use('/api/osint', osintRoutes);
}
