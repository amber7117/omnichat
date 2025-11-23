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
    const app = createApp();
    const server = createServer(app);

    createSocketServer(server);
    startOutboundWorker();
    await bootstrapWhatsAppConnections();
    await bootstrapTelegramConnections();

    server.listen(env.PORT, () => {
        logger.info(`🚀 OmniChat backend listening on :${env.PORT}`);
    });
}

bootstrap().catch((err) => {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
});

export default bootstrap;
