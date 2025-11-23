// src/server.ts
import { createServer } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { createSocketServer } from './utils/socket';
import { logger } from './utils/logger';
import { startOutboundWorker } from './modules/channels/outbound/outbound.worker';
import { bootstrapWhatsAppConnections } from './modules/channels/whatsapp/baileysClient';
import { bootstrapTelegramConnections } from './modules/channels/telegram/user.service';

async function bootstrap(): Promise<void> {
  // 创建 Express 应用
  const app = createApp();

  // 用 Node 原生 http 包裹（方便挂 websocket）
  const server = createServer(app);

  // 初始化 WebSocket / Socket.io（你 utils/socket 里的封装）
  createSocketServer(server);

  // 启动出站消息 worker（比如发送 WhatsApp/Telegram 消息队列）
  startOutboundWorker();

  // 启动时恢复已有的 WhatsApp 连接
  await bootstrapWhatsAppConnections();

  // 启动时恢复已有的 Telegram 用户连接
  await bootstrapTelegramConnections();

  const port = Number(env.PORT) || 3001;

  server.listen(port, () => {
    logger.info(`🚀 OmniChat backend listening on :${port}`);
  });
}

// 顶层启动
bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});

export default bootstrap;
