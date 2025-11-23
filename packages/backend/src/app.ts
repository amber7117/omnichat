import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { registerRoutes } from './routes';
import { errorHandler } from './middleware/error-handler';
import { logger } from './utils/logger';
import { prisma } from './db/prisma';

export function createApp() {
  const app = express();

  // CORS
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );

  // 安全头
  app.use(helmet());

  // JSON 解析 + rawBody 挂载
  app.use(
    express.json({
      limit: '10mb',
      verify: (req: any, _res, buf) => {
        // 某些 webhook（比如 Stripe、WhatsApp 回调）可能需要 rawBody 做签名验证
        req.rawBody = buf;
      },
    })
  );

  // 日志中间件（pino-http）
  app.use(
    pinoHttp({
      logger,
    })
  );

  // 健康检查
  app.get('/health', (_req, res) => {
    prisma
      // 简单探测数据库是否可用
      .$queryRaw`SELECT 1`
      .then(() => {
        res.json({
          status: 'ok',
          db: 'up',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        });
      })
      .catch((err) => {
        logger.error({ err }, 'Healthcheck DB failed');
        res.status(503).json({
          status: 'degraded',
          db: 'down',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        });
      });
  });

  // 注册所有业务路由
  registerRoutes(app);

  // 统一错误处理
  app.use(errorHandler);

  return app;
}

/**
 * ✅ 关键：导出 default，给 serverless 运行时用
 *
 * 对于像 AWS Lambda Web Adapter / 一些 serverless 平台，
 * 会直接 `import appModule from "./app.js"`，
 * 然后去找 `default`，要求它是：
 *   - 一个 Express app 实例，或者
 *   - 一个创建 app 的函数
 *
 * 这里我们把 createApp 作为 default 导出，
 * 运行时会自己调用这个函数获取 app。
 */
export default createApp;
