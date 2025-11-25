import { apiGet, apiPost } from './client';
import type {
  PlatformType,
  PlatformStatus,
  PlatformListResponse,
  PlatformConnectionResponse,
  WhatsAppQRResponse,
  Platform,
  PlatformMeta,
} from '@/types/platform';

// 内部响应类型
interface WhatsAppConnectResponse {
  ok: boolean;
  message?: string;
  error?: string;
}

// 后端 ChannelInstance 基础类型（根据 Express + Prisma 返回字段）
interface BackendChannelInstance {
  id: string;
  tenantId?: string;
  name?: string;
  type: string;
  status?: string;
  metadata?: Record<string, unknown> | null;
  config?: Record<string, unknown> | null;
  externalId?: string | null;
  qrCode?: string | null;
  qrCodeExpiry?: string | null;
  lastConnectedAt?: string | null;
  lastConnectAttempt?: string | null;
  lastError?: string | null;
  lastErrorAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const getTenantId = (): string => {
  // Try to get tenant ID from various sources
  try {
    // Check if running in browser environment
    if (typeof window !== 'undefined') {
      // Try to get from localStorage first
      const storedTenantId = localStorage.getItem('tenantId');
      if (storedTenantId) {
        return storedTenantId;
      }
      
      // Try to get from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const urlTenantId = urlParams.get('tenantId');
      if (urlTenantId) {
        return urlTenantId;
      }
      
      // Try to get from subdomain (e.g., tenant.domain.com)
      const subdomain = window.location.hostname.split('.')[0];
      if (subdomain && subdomain !== 'www' && subdomain !== 'localhost') {
        return subdomain;
      }
    }
    
    // Check environment variables
    const envTenantId = process.env.NEXT_PUBLIC_TENANT_ID || process.env.TENANT_ID;
    if (envTenantId) {
      return envTenantId;
    }
  } catch (error) {
    console.warn('Failed to get tenant ID from sources:', error);
  }
  
  // Generate and store a new UUID for this session
  if (typeof window !== 'undefined') {
    let sessionTenantId = sessionStorage.getItem('sessionTenantId');
    if (!sessionTenantId) {
      sessionTenantId = crypto.randomUUID();
      sessionStorage.setItem('sessionTenantId', sessionTenantId);
    }
    return sessionTenantId;
  }
  
  // Fallback for non-browser environments
  return 'default-tenant';
};

const typeMap: Record<string, PlatformType> = {
  whatsapp: 'whatsapp',
  WHATSAPP: 'whatsapp',
  'telegram-user': 'telegram',
  TELEGRAM_USER: 'telegram',
  'telegram-bot': 'telegram-bot',
  TELEGRAM_BOT: 'telegram-bot',
  widget: 'widget',
  WIDGET: 'widget',
  facebook: 'facebook',
  FACEBOOK: 'facebook',
  wechat: 'wechat',
  WECHAT: 'wechat',
  wecom: 'wecom',
  WECOM: 'wecom',
  wechaty: 'wechaty',
  WECHATY: 'wechaty',
};

const statusMap: Record<string, PlatformStatus> = {
  connected: 'connected',
  CONNECTED: 'connected',
  connecting: 'connecting',
  CONNECTING: 'connecting',
  error: 'error',
  ERROR: 'error',
  disconnected: 'disconnected',
  DISCONNECTED: 'disconnected',
};

const mapChannelToPlatform = (
  channel: BackendChannelInstance,
  tenantId: string
): Platform => {
  const mappedType =
    typeMap[channel.type] || (channel.type?.toLowerCase() as PlatformType) || 'whatsapp';
  const mappedStatus =
    statusMap[channel.status || 'disconnected'] || 'disconnected';
  const meta: PlatformMeta = {
    ...(channel.metadata as PlatformMeta),
    ...(channel.config as PlatformMeta),
  };
  const lastActivity =
    channel.lastConnectedAt ||
    channel.lastConnectAttempt ||
    channel.updatedAt ||
    channel.createdAt ||
    new Date().toISOString();

  return {
    id: channel.id,
    tenantId,
    name: channel.name || mappedType,
    type: mappedType,
    status: mappedStatus,
    displayName: channel.name || mappedType,
    config: (channel.config as Record<string, unknown>) || {},
    lastActivity: new Date(lastActivity),
    agentCount: 0,
    meta,
    createdAt: channel.createdAt ? new Date(channel.createdAt) : new Date(),
    updatedAt: channel.updatedAt ? new Date(channel.updatedAt) : new Date(),
  };
};

const pickChannelList = (payload: unknown): BackendChannelInstance[] | null => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const obj = payload as { data?: BackendChannelInstance[]; channels?: BackendChannelInstance[] };
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.channels)) return obj.channels;
  }
  return null;
};

const fetchChannelInstance = async (channelId: string): Promise<BackendChannelInstance | null> => {
  const response = await apiGet<unknown>('/api/channels');
  const list = pickChannelList(response);
  if (!list) return null;
  return list.find((item) => item.id === channelId) || null;
};

/**
 * 获取当前租户的所有平台列表
 */
export async function fetchPlatforms(tenantId?: string): Promise<PlatformListResponse> {
  const tid = tenantId || getTenantId();
  try {
    console.log('[fetchPlatforms] 请求平台列表，tenantId:', tid);
    const response = await apiGet<unknown>('/api/channels');
    const channelsData = pickChannelList(response);
    console.log('[fetchPlatforms] 渠道数据:', channelsData);
    
    if (channelsData) {
      const platforms = channelsData.map((channel) => mapChannelToPlatform(channel, tid));
      console.log('[fetchPlatforms] 最终平台列表:', platforms);
      return { ok: true, platforms };
    }

    return { ok: false, error: '获取平台列表失败' };
  } catch (error) {
    console.error('Failed to fetch platforms:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '获取平台列表失败'
    };
  }
}

/**
 * WhatsApp - 初始化连接（生成 QR）
 * 后端会通过 connection.update 事件发送 QR 码
 * 
 * 注意：初始使用临时 channelId，连接成功后前端需监听 whatsapp-connected 事件获取手机号
 */
export async function connectWhatsApp(tenantId?: string, phoneNumber?: string): Promise<PlatformConnectionResponse> {
  const tid = tenantId || getTenantId();
  try {
    // 新后端流程：
    // 1) 创建渠道实例 (type: WHATSAPP)
    const created = await apiPost<BackendChannelInstance>('/api/channels', {
      name: 'WhatsApp',
      type: 'WHATSAPP',
      metadata: phoneNumber ? { phoneNumber } : undefined,
    });

    // 2) 启动 WhatsApp 连接，后端会通过 WebSocket 推送 QR
    await apiPost<WhatsAppConnectResponse>(
      `/api/channels/${created.id}/whatsapp/start`,
      {}
    );

    const platform = mapChannelToPlatform(created, tid);
    platform.status = 'connecting';

    return {
      ok: true,
      message: 'WhatsApp connection initialized',
      platform,
    };
  } catch (error) {
    console.error('Failed to connect WhatsApp:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '连接 WhatsApp 失败'
    };
  }
}

/**
 * WhatsApp - 获取二维码
 */
export async function fetchWhatsAppQR(channelId: string): Promise<WhatsAppQRResponse> {
  try {
    // 新后端会把最新 QR 写在 ChannelInstance.qrCode 上，也会通过 WebSocket 推送
    const channel = await fetchChannelInstance(channelId);
    const qrCode = channel?.qrCode || null;
    const expiresIn = channel?.qrCodeExpiry
      ? Math.max(0, Math.floor((new Date(channel.qrCodeExpiry).getTime() - Date.now()) / 1000))
      : undefined;

    if (qrCode) {
      return { ok: true, qr: qrCode, expiresIn };
    }

    return { ok: false, error: '二维码暂未生成，请稍后重试' };
  } catch (error) {
    console.error('[fetchWhatsAppQR] 异常:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '获取二维码失败'
    };
  }
}

/**
 * WhatsApp - 获取连接状态
 */
export async function fetchWhatsAppStatus(channelId: string): Promise<PlatformConnectionResponse> {
  try {
    const channel = await fetchChannelInstance(channelId);
    if (channel) {
      return {
        ok: true,
        platform: mapChannelToPlatform(channel, channel.tenantId || getTenantId())
      };
    }

    return { ok: false, error: '获取状态失败' };
  } catch (error) {
    console.error('[fetchWhatsAppStatus] 异常:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '获取状态失败'
    };
  }
}

/**
 * WhatsApp - 断开连接
 */
export async function disconnectWhatsApp(channelId: string, clearSession = false): Promise<PlatformConnectionResponse> {
  try {
    // ✅ 后端实际路径: POST /api/whatsapp/channels/:id/whatsapp/disconnect
    const response = await apiPost<{ ok: boolean; message?: string; error?: string }>(
      `/api/whatsapp/channels/${channelId}/whatsapp/disconnect`,
      { clearSession }
    );
    
    if (response.ok) {
      return {
        ok: true,
        message: response.message || 'WhatsApp disconnected successfully'
      };
    }
    
    return {
      ok: false,
      error: response.error || '断开连接失败'
    };
  } catch (error) {
    console.error('Failed to disconnect WhatsApp:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '断开连接失败'
    };
  }
}

/**
 * WhatsApp - 删除渠道
 */
export async function deleteWhatsApp(channelId: string, permanent = false): Promise<PlatformConnectionResponse> {
  try {
    // ✅ 后端实际路径: POST /api/whatsapp/channels/:id/whatsapp (with _method=DELETE)
    const response = await apiPost<{ ok: boolean; message?: string; error?: string }>(
      `/api/whatsapp/channels/${channelId}/whatsapp`,
      { permanent, disconnect: true, _method: 'DELETE' }
    );
    
    if (response.ok) {
      return {
        ok: true,
        message: response.message || 'WhatsApp 渠道已删除'
      };
    }
    
    return {
      ok: false,
      error: response.error || '删除失败'
    };
  } catch (error) {
    console.error('Failed to delete WhatsApp:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '删除失败'
    };
  }
}

/**
 * Telegram User - 启动登录流程
 * 使用 GramJS 的手机号登录流程：
 * 1. 用户输入手机号
 * 2. 后端发送验证码到手机
 * 3. 用户输入验证码完成登录
 * 4. （可选）2FA 密码验证
 * 
 * Note: 前端应该打开对话框让用户输入手机号，然后调用 sendTelegramCode
 * 而不是重定向到后端（因为 Telegram 需要交互式登录）
 */
export function redirectToTelegramLogin(tenantId?: string): void {
  const tid = tenantId || getTenantId();
  // 前端应该打开 Telegram 登录对话框（sendTelegramCode -> verifyTelegramCode -> verify2FA）
  console.warn('redirectToTelegramLogin: 应该使用 sendTelegramCode 而不是重定向');
  window.location.href = `/api/tenants/${tid}/telegram/login`;
}

/**
 * Telegram Bot - 连接（提交 Bot Token）
 */
export async function connectTelegramBot(
  botToken: string,
  tenantId?: string
): Promise<PlatformConnectionResponse> {
  const tid = tenantId || getTenantId();
  try {
    // Backend API endpoint when ready: POST /api/tenants/:tenantId/telegram/bot/connect
    const channelId = `telegram-bot-${tid}-${Date.now()}`;
    const response = await apiPost<{ ok: boolean; message?: string; botUsername?: string; error?: string }>(
      `/api/tenants/${tid}/telegram/bot/connect`,
      { channelId, botToken }
    );

    if (response.ok) {
      return {
        ok: true,
        message: response.message || 'Telegram Bot connected successfully',
        platform: {
          id: channelId,
          tenantId: tid,
          name: 'Telegram Bot',
          type: 'telegram-bot',
          status: 'connected',
          displayName: 'Telegram Bot',
          config: {},
          lastActivity: new Date(),
          agentCount: 0,
          meta: {
            botUsername: response.botUsername || 'unknown_bot'
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };
    }
    
    return {
      ok: false,
      error: response.error || '连接 Telegram Bot 失败'
    };
  } catch (error) {
    console.error('Failed to connect Telegram Bot:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '连接 Telegram Bot 失败'
    };
  }
}

/**
 * Web Widget - 生成嵌入代码
 */
export async function generateWidget(tenantId?: string): Promise<PlatformConnectionResponse> {
  const tid = tenantId || getTenantId();
  try {
    // Backend API endpoint: POST /api/tenants/:tenantId/widget/generate
    const response = await apiPost<{ ok: boolean; widgetId?: string; embedCode?: string; error?: string }>(
      `/api/tenants/${tid}/widget/generate`,
      {}
    );

    if (response.ok && response.widgetId && response.embedCode) {
      return {
        ok: true,
        platform: {
          id: response.widgetId,
          tenantId: tid,
          name: 'Web Widget',
          type: 'widget',
          status: 'connected',
          displayName: 'Web Widget',
          config: {},
          lastActivity: new Date(),
          agentCount: 0,
          meta: {
            embedCode: response.embedCode,
            widgetId: response.widgetId
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };
    }
    
    return {
      ok: false,
      error: response.error || '生成 Widget 失败'
    };
  } catch (error) {
    console.error('Failed to generate widget:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '生成 Widget 失败'
    };
  }
}

/**
 * Web Widget - 获取嵌入代码
 */
export async function fetchWidgetEmbed(widgetId: string, tenantId?: string): Promise<PlatformConnectionResponse> {
  const tid = tenantId || getTenantId();
  try {
    // Backend API endpoint: GET /api/tenants/:tenantId/widget/:id
    interface WidgetResponse {
      tenantId?: string;
      status?: string;
      createdAt?: string;
      updatedAt?: string;
    }
    
    const response = await apiGet<{ ok: boolean; widget?: WidgetResponse; embedCode?: string; error?: string }>(
      `/api/tenants/${tid}/widget/${widgetId}`
    );
    
    if (response.ok && response.widget) {
      return {
        ok: true,
        platform: {
          id: widgetId,
          tenantId: response.widget.tenantId || tid,
          name: 'Web Widget',
          type: 'widget',
          status: (response.widget.status || 'connected') as 'connected' | 'connecting' | 'disconnected' | 'error',
          displayName: 'Web Widget',
          config: {},
          lastActivity: new Date(),
          agentCount: 0,
          meta: {
            embedCode: response.embedCode,
            widgetId: widgetId
          },
          createdAt: response.widget.createdAt ? new Date(response.widget.createdAt) : new Date(),
          updatedAt: response.widget.updatedAt ? new Date(response.widget.updatedAt) : new Date()
        }
      };
    }
    
    return {
      ok: false,
      error: response.error || '获取 Widget 代码失败'
    };
  } catch (error) {
    console.error('Failed to fetch widget embed:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '获取 Widget 代码失败'
    };
  }
}

/**
 * Facebook Messenger - 跳转登录（OAuth flow）
 */
export function redirectToFacebookLogin(tenantId?: string): void {
  const tid = tenantId || getTenantId();
  // Use real backend OAuth endpoint: GET /api/tenants/:tenantId/facebook/platforms/facebook/login
  window.location.href = `/api/tenants/${tid}/facebook/platforms/facebook/login`;
}

/**
 * 通用 - 断开平台连接
 */
export async function disconnectPlatform(
  platformType: PlatformType,
  channelId: string,
  tenantId?: string
): Promise<PlatformConnectionResponse> {
  const tid = tenantId || getTenantId();
  try {
    let endpoint = '';
    
    // Map platform type to real backend disconnect endpoints
    switch (platformType) {
      case 'whatsapp':
        // ✅ 使用新的 WhatsApp 路径
        endpoint = `/api/whatsapp/channels/${channelId}/whatsapp/disconnect`;
        break;
      case 'facebook':
        endpoint = `/api/tenants/${tid}/facebook/platforms/facebook/${channelId}/disconnect`;
        break;
      case 'telegram':
      case 'telegram-bot':
        endpoint = `/api/tenants/${tid}/telegram/${channelId}/disconnect`;
        break;
      case 'widget':
        endpoint = `/api/tenants/${tid}/widget/${channelId}/disconnect`;
        break;
      default:
        endpoint = `/api/tenants/${tid}/channels/${channelId}/disconnect`;
    }
    
    const response = await apiPost<{ ok: boolean; message?: string; error?: string }>(
      endpoint,
      {}
    );
    
    if (response.ok) {
      return {
        ok: true,
        message: response.message || `${platformType} disconnected successfully`
      };
    }
    
    return {
      ok: false,
      error: response.error || '断开连接失败'
    };
  } catch (error) {
    console.error(`Failed to disconnect ${platformType}:`, error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '断开连接失败'
    };
  }
}

// =====================================================
// Telegram User Login (GramJS) - Phone authentication
// =====================================================

/**
 * Telegram - 发送验证码到手机号
 */
export async function sendTelegramCode(
  phoneNumber: string,
  tenantId?: string,
  existingChannelId?: string
): Promise<PlatformConnectionResponse & { phoneCodeHash?: string; channelId?: string }> {
  const tid = tenantId || getTenantId();
  try {
    // 1) 如果已有 channelId，复用；否则创建 Telegram 用户渠道实例
    let channelId = existingChannelId;
    if (!channelId) {
      const createResp = await apiPost<{ id: string }>(`/api/channels`, {
        name: `Telegram ${phoneNumber}`,
        type: 'TELEGRAM_USER',
        metadata: { phoneNumber },
        config: {},
        externalId: phoneNumber,
        tenantId: tid,
      });
      channelId = createResp.id;
    }

    if (!channelId) {
      return { ok: false, error: '创建 Telegram 渠道失败' };
    }

    // 2) 启动登录流程：POST /api/telegram/user/start
    const response = await apiPost<{ ok: boolean; phoneCodeHash?: string; channelId?: string; error?: string }>(
      `/api/telegram/user/start`,
      { channelInstanceId: channelId, phoneNumber }
    );

    if (response.ok && response.phoneCodeHash && response.channelId) {
      return {
        ok: true,
        phoneCodeHash: response.phoneCodeHash,
        channelId: response.channelId
      };
    }
    
    return {
      ok: false,
      error: response.error || '发送验证码失败'
    };
  } catch (error) {
    console.error('Failed to send Telegram code:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '发送验证码失败'
    };
  }
}

/**
 * Telegram - 验证手机验证码
 */
export async function verifyTelegramCode(
  channelId: string,
  phoneNumber: string,
  phoneCodeHash: string,
  code: string,
  tenantId?: string
): Promise<PlatformConnectionResponse & { needs2FA?: boolean }> {
  const tid = tenantId || getTenantId();
  try {
    // Backend API endpoint when ready: POST /api/tenants/:tenantId/telegram/verify-code
    interface TelegramPlatform {
      createdAt?: string;
      updatedAt?: string;
    }
    
    const response = await apiPost<{
      ok: boolean;
      needs2FA?: boolean;
      platform?: TelegramPlatform;
      error?: string;
      phoneCodeHash?: string;
      phoneNumber?: string;
    }>(`/api/telegram/user/confirm`, {
      channelInstanceId: channelId,
      phoneNumber,
      phoneCodeHash,
      code,
      tenantId: tid,
    });

    if (response.ok) {
      return {
        ok: true,
        needs2FA: response.needs2FA,
        platform: response.platform ? {
          id: channelId,
          tenantId: tid,
          name: 'Telegram',
          type: 'telegram',
          status: 'connected',
          displayName: 'Telegram',
          config: {},
          lastActivity: new Date(),
          agentCount: 0,
          meta: { phoneNumber },
          createdAt: response.platform.createdAt ? new Date(response.platform.createdAt) : new Date(),
          updatedAt: response.platform.updatedAt ? new Date(response.platform.updatedAt) : new Date()
        } : undefined
      };
    }
    
    return {
      ok: false,
      error: response.error || '验证失败'
    };
  } catch (error) {
    console.error('Failed to verify Telegram code:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '验证失败'
    };
  }
}

/**
 * Telegram - 验证两步验证密码
 */
export async function verifyTelegram2FA(
  channelId: string,
  password: string,
  tenantId?: string
): Promise<PlatformConnectionResponse> {
  const tid = tenantId || getTenantId();
  try {
    // Backend API endpoint when ready: POST /api/tenants/:tenantId/telegram/verify-2fa
    interface TelegramPlatform {
      meta?: Record<string, unknown>;
      createdAt?: string;
      updatedAt?: string;
    }
    
    const response = await apiPost<{
      ok: boolean;
      platform?: TelegramPlatform;
      error?: string;
    }>(
      `/api/tenants/${tid}/telegram/verify-2fa`,
      { channelId, password }
    );

    if (response.ok && response.platform) {
      return {
        ok: true,
        platform: {
          id: channelId,
          tenantId: tid,
          name: 'Telegram',
          type: 'telegram',
          status: 'connected',
          displayName: 'Telegram',
          config: {},
          lastActivity: new Date(),
          agentCount: 0,
          meta: response.platform.meta || {},
          createdAt: response.platform.createdAt ? new Date(response.platform.createdAt) : new Date(),
          updatedAt: response.platform.updatedAt ? new Date(response.platform.updatedAt) : new Date()
        }
      };
    }
    
    return {
      ok: false,
      error: response.error || '验证失败'
    };
  } catch (error) {
    console.error('Failed to verify Telegram 2FA:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '验证失败'
    };
  }
}

/**
 * Telegram - 获取连接状态
 */
export async function fetchTelegramStatus(
  channelId: string,
  tenantId?: string
): Promise<PlatformConnectionResponse> {
  const tid = tenantId || getTenantId();
  try {
    // Backend API endpoint when ready: GET /api/tenants/:tenantId/telegram/:channelId/status
    interface TelegramPlatform {
      meta?: Record<string, unknown>;
      createdAt?: string;
      updatedAt?: string;
    }
    
    // Use the new route structure: /api/telegram/:channelId/status
    const response = await apiGet<{
      ok: boolean;
      status?: string;
      platform?: TelegramPlatform;
      error?: string;
    }>(
      `/api/telegram/${channelId}/status`
    );

    if (response.ok && response.status === 'connected' && response.platform) {
      return {
        ok: true,
        platform: {
          id: channelId,
          tenantId: tid,
          name: 'Telegram',
          type: 'telegram',
          status: 'connected',
          displayName: 'Telegram',
          config: {},
          lastActivity: new Date(),
          agentCount: 0,
          meta: response.platform.meta || {},
          createdAt: response.platform.createdAt ? new Date(response.platform.createdAt) : new Date(),
          updatedAt: response.platform.updatedAt ? new Date(response.platform.updatedAt) : new Date()
        }
      };
    }

    return {
      ok: true,
      platform: undefined // Not connected
    };
  } catch (error) {
    console.error('Failed to fetch Telegram status:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '获取状态失败'
    };
  }
}

/**
 * WeChat - Connect Official Account
 */
export async function connectWeChat(
  config: { appId: string; appSecret: string; token: string; encodingAESKey: string },
  tenantId?: string
): Promise<PlatformConnectionResponse> {
  const tid = tenantId || getTenantId();
  try {
    const response = await apiPost<BackendChannelInstance>('/api/channels', {
      name: 'WeChat Official Account',
      type: 'WECHAT',
      config,
    });

    return {
      ok: true,
      message: 'WeChat connected successfully',
      platform: mapChannelToPlatform(response, tid),
    };
  } catch (error) {
    console.error('Failed to connect WeChat:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to connect WeChat',
    };
  }
}

/**
 * WeCom - Connect Enterprise WeChat
 */
export async function connectWeCom(
  config: { corpId: string; agentId: string; secret: string; token: string; encodingAESKey: string },
  tenantId?: string
): Promise<PlatformConnectionResponse> {
  const tid = tenantId || getTenantId();
  try {
    const response = await apiPost<BackendChannelInstance>('/api/channels', {
      name: 'WeCom',
      type: 'WECOM',
      config,
    });

    return {
      ok: true,
      message: 'WeCom connected successfully',
      platform: mapChannelToPlatform(response, tid),
    };
  } catch (error) {
    console.error('Failed to connect WeCom:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to connect WeCom',
    };
  }
}

/**
 * Wechaty - Connect Personal WeChat (Scan QR)
 */
export async function connectWechaty(tenantId?: string): Promise<PlatformConnectionResponse> {
  const tid = tenantId || getTenantId();
  try {
    // 1) Create channel instance
    const created = await apiPost<BackendChannelInstance>('/api/channels', {
      name: 'Personal WeChat',
      type: 'WECHATY',
    });

    // 2) Start bot (will generate QR)
    await apiPost(`/api/wechaty/${created.id}/start`, {});

    const platform = mapChannelToPlatform(created, tid);
    platform.status = 'connecting';

    return {
      ok: true,
      message: 'Wechaty initialized',
      platform,
    };
  } catch (error) {
    console.error('Failed to connect Wechaty:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to connect Wechaty',
    };
  }
}

/**
 * Wechaty - Get Status / QR
 */
export async function fetchWechatyStatus(channelId: string): Promise<PlatformConnectionResponse & { qrCode?: string; isLoggedIn?: boolean }> {
  try {
    const response = await apiGet<{
      ok: boolean;
      status: string;
      isLoggedIn: boolean;
      user?: { name: string; id: string };
      qrCode?: string;
      qrCodeExpiry?: string;
    }>(`/api/wechaty/${channelId}/status`);

    if (response.ok) {
      // Construct a platform object from status
      const platform: Platform = {
        id: channelId,
        name: 'Personal WeChat',
        type: 'wechaty',
        status: (response.status?.toLowerCase() as PlatformStatus) || 'disconnected',
        config: {},
        lastActivity: new Date(),
        agentCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        meta: {
          userName: response.user?.name,
          userId: response.user?.id,
        }
      };

      return {
        ok: true,
        platform,
        qrCode: response.qrCode,
        isLoggedIn: response.isLoggedIn,
      };
    }

    return { ok: false, error: 'Failed to get status' };
  } catch (error) {
    console.error('Failed to fetch Wechaty status:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to fetch status',
    };
  }
}
