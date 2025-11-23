// src/modules/channels/whatsapp/postgresAuthState.ts

// 只引入类型，不生成运行时代码（不会 require('baileys')）
import type {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
} from 'baileys';

import { Prisma } from '@prisma/client';
import { prisma } from '../../../db/prisma';
import { logger } from '../../../utils/logger';

// ------------------------------------------------------
// ESM-only Baileys 动态加载适配（和 baileysClient 同套路）
// ------------------------------------------------------
let baileysRef: typeof import('baileys') | null = null;

async function getBaileys() {
  if (!baileysRef) {
    // 用 eval 避免被 tsc 编译成 require('baileys')
    baileysRef = (await eval('import("baileys")')) as typeof import('baileys');
  }
  return baileysRef;
}

function buildKeyId(type: string, id: string): string {
  return `${type}:${id}`;
}

export async function usePostgresAuthState(
  channelInstanceId: string,
  tenantId: string,
  sessionId: string
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  // 这里动态加载 Baileys 的 BufferJSON / initAuthCreds
  const baileys = await getBaileys();
  const { BufferJSON, initAuthCreds } = baileys;

  const serialize = <T>(data: T): any =>
    JSON.parse(JSON.stringify(data, BufferJSON.replacer));

  const deserialize = <T>(data: any): T =>
    JSON.parse(JSON.stringify(data ?? null), BufferJSON.reviver) as T;

  const sessionRow = await prisma.whatsAppSession.findFirst({
    where: { channelInstanceId, sessionId, tenantId },
  });

  const creds: AuthenticationCreds = sessionRow?.data
    ? deserialize<AuthenticationCreds>(sessionRow.data)
    : initAuthCreds();

  const keys = {
    get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
      const keyIds = ids.map((id) => buildKeyId(type, id));
      const rows = await prisma.whatsAppKey.findMany({
        where: { channelInstanceId, sessionId, tenantId, keyId: { in: keyIds } },
      });

      const results: { [id: string]: SignalDataTypeMap[T] } = {};
      for (const id of ids) {
        const row = rows.find((item) => item.keyId === buildKeyId(type, id));
        if (row?.data) {
          results[id] = deserialize<SignalDataTypeMap[T]>(row.data);
        }
      }
      return results;
    },

    set: async (
      data: Partial<Record<keyof SignalDataTypeMap, Record<string, any>>>
    ) => {
      const operations: Prisma.PrismaPromise<unknown>[] = [];

      for (const [type, entries] of Object.entries(data || {})) {
        const typedEntries = Object.entries(entries || {});
        for (const [id, value] of typedEntries) {
          operations.push(
            prisma.whatsAppKey.upsert({
              where: {
                channelInstanceId_sessionId_keyId: {
                  channelInstanceId,
                  sessionId,
                  keyId: buildKeyId(type, id),
                },
              },
              update: { data: serialize(value) },
              create: {
                tenantId,
                channelInstanceId,
                sessionId,
                keyId: buildKeyId(type, id),
                data: serialize(value),
              },
            })
          );
        }
      }

      if (operations.length) {
        await prisma.$transaction(operations);
      }
    },

    clear: async () => {
      await prisma.whatsAppKey.deleteMany({
        where: { channelInstanceId, sessionId, tenantId },
      });
    },
  };

  const saveCreds = async () => {
    try {
      const data = serialize(creds);
      await prisma.whatsAppSession.upsert({
        where: {
          channelInstanceId_sessionId: {
            channelInstanceId,
            sessionId,
          },
        },
        update: { data },
        create: { tenantId, channelInstanceId, sessionId, data },
      });
    } catch (err) {
      logger.error({ err, channelInstanceId }, 'Failed to persist WhatsApp credentials');
      throw err;
    }
  };

  return { state: { creds, keys }, saveCreds };
}
