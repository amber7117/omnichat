import type { Response, NextFunction } from 'express';
import { z } from 'zod';

import { startUserLogin, confirmUserLogin, logoutUserSession } from './user.service';
import type { AuthedRequest } from '../../../types/http';
import { prisma } from '../../../db/prisma';

// ============ Zod 校验 ============

const startSchema = z.object({
  channelInstanceId: z.string(),
  phoneNumber: z.string(),
  tenantId: z.string().optional(), // 前端 sendTelegramCode 会顺带传 tenantId
});

const confirmSchema = z.object({
  channelInstanceId: z.string(),
  phoneNumber: z.string(),
  code: z.string(),
  phoneCodeHash: z.string().optional(),
  password: z.string().optional(), // 目前 service 里 2FA 不支持，但先保留字段
  tenantId: z.string().optional(),
});

const logoutSchema = z.object({
  channelInstanceId: z.string(),
  tenantId: z.string().optional(),
});

// 从 req.auth / body 里解析 tenantId
const resolveTenantId = (req: AuthedRequest, bodyTenantId?: string): string => {
  if (req.auth?.tenantId) return req.auth.tenantId;
  if (bodyTenantId) return bodyTenantId;
  // 如果你有匿名租户逻辑，可以改成对应默认值
  return 'default-tenant';
};

export const TelegramUserController = {
  /**
   * POST /api/telegram/user/start
   * Body: { channelInstanceId, phoneNumber, tenantId? }
   *
   * 前端 sendTelegramCode 期望返回：
   * { ok: true, phoneCodeHash, channelId }
   */
  async start(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = startSchema.parse(req.body);
      const tenantId = resolveTenantId(req, body.tenantId);

      const result = await startUserLogin(
        body.channelInstanceId,
        tenantId,
        body.phoneNumber
      );

      res.json({
        ok: true,
        channelId: body.channelInstanceId,
        phoneCodeHash: result.phoneCodeHash,
        phoneNumber: result.phoneNumber,
        status: result.status, // 'CODE_SENT'
      });
    } catch (err) {
      next(err as Error);
    }
  },

  /**
   * POST /api/telegram/user/confirm
   * Body: { channelInstanceId, phoneNumber, code, phoneCodeHash?, password?, tenantId? }
   *
   * 前端 verifyTelegramCode 期望返回：
   * {
   *   ok: boolean;
   *   needs2FA?: boolean;
   *   platform?: { createdAt?: string; updatedAt?: string; }
   *   error?: string;
   * }
   */
  async confirm(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = confirmSchema.parse(req.body);
      const tenantId = resolveTenantId(req, body.tenantId);

      const result = await confirmUserLogin(
        body.channelInstanceId,
        tenantId,
        {
          phoneNumber: body.phoneNumber,
          code: body.code,
          phoneCodeHash: body.phoneCodeHash,
          password: body.password,
        }
      );

      // user.service 里已经把 sessionString 存进 DB 了，这里不返回给前端（安全起见）
      // 如果你想让前端马上拿到 createdAt/updatedAt，用 channelInstance 查一下
      const channel = await prisma.channelInstance.findUnique({
        where: { id: body.channelInstanceId },
        select: {
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json({
        ok: true,
        status: result.status,          // 'LOGGED_IN'
        needs2FA: false,                // 目前 2FA 未支持
        platform: channel
          ? {
            createdAt: channel.createdAt.toISOString(),
            updatedAt: channel.updatedAt.toISOString(),
          }
          : undefined,
      });
    } catch (err) {
      next(err as Error);
    }
  },

  /**
   * POST /api/telegram/user/logout
   * Body: { channelInstanceId }
   */
  async logout(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = logoutSchema.parse(req.body);

      await logoutUserSession(body.channelInstanceId);

      res.json({
        ok: true,
        status: 'LOGGED_OUT',
      });
    } catch (err) {
      next(err as Error);
    }
  },
};
