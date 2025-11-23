// src/api/whatsapp.ts
import { apiGet, apiPost } from './client';
import type { Contact, ConnectionState } from 'baileys';

// 获取当前租户ID
const getTenantId = (): string => {
  if (typeof window !== 'undefined') {
    // Try localStorage first
    const stored = localStorage.getItem('tenantId');
    if (stored) return stored;
    
    // Generate and store in sessionStorage
    let sessionTenantId = sessionStorage.getItem('sessionTenantId');
    if (!sessionTenantId) {
      sessionTenantId = crypto.randomUUID();
      sessionStorage.setItem('sessionTenantId', sessionTenantId);
    }
    return sessionTenantId;
  }
  return 'default-tenant';
};

export interface WhatsAppQrResponse {
  ok: boolean;
  qr?: string;
  expiresIn?: number;
  error?: string;
}

export interface WhatsAppConnectResponse {
  ok: boolean;
  message?: string;
  error?: string;
}

export interface WhatsAppSendResponse {
  ok: boolean;
  message?: string;
  error?: string;
}

export interface WhatsAppContactsResponse {
  ok: boolean;
  contacts?: Contact[];
  error?: string;
}

export interface WhatsAppStatusResponse {
  ok: boolean;
  status?: ConnectionState | null;
  error?: string;
}

/**
 * 启动 WhatsApp 连接流程
 * @param channelId 渠道ID（ChannelInstance ID 或你生成的唯一ID）
 * @param phoneNumber 可选，预填手机号（大部分场景用不到）
 */
export async function startWhatsAppConnect(
  channelId: string,
  phoneNumber?: string
): Promise<WhatsAppConnectResponse> {
  try {
    const payload: { phoneNumber?: string; tenantId: string } = { 
      tenantId: getTenantId() 
    };
    
    if (phoneNumber) {
      payload.phoneNumber = phoneNumber;
    }

    // ✅ 后端实际路径: POST /api/whatsapp/channels/:id/whatsapp/connect
    const response = await apiPost<WhatsAppConnectResponse>(
      `/api/whatsapp/channels/${channelId}/whatsapp/connect`,
      payload
    );

    return response;
  } catch (error) {
    console.error('Failed to start WhatsApp connect:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '连接失败',
    };
  }
}

/**
 * 获取最新的 WhatsApp QR 码
 * @param channelId 渠道ID
 * @param refresh 是否刷新 QR 码
 */
export async function fetchWhatsAppQr(
  channelId: string,
  refresh?: boolean
): Promise<WhatsAppQrResponse> {
  try {
    // ✅ 后端实际路径: GET /api/whatsapp/channels/:id/whatsapp/qr?refresh=true
    const queryParams = refresh ? '?refresh=true' : '';
    const response = await apiGet<WhatsAppQrResponse>(
      `/api/whatsapp/channels/${channelId}/whatsapp/qr${queryParams}`
    );
    return response;
  } catch (error) {
    console.error('Failed to fetch WhatsApp QR:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '获取二维码失败',
    };
  }
}

/**
 * 发送 WhatsApp 消息
 * @param channelId 渠道ID
 * @param to 接收者JID
 * @param text 消息内容
 */
export async function sendWhatsAppMessage(
  channelId: string,
  to: string,
  text: string
): Promise<WhatsAppSendResponse> {
  try {
    // ✅ 后端实际路径: POST /api/whatsapp/channels/:id/whatsapp/send
    const response = await apiPost<WhatsAppSendResponse>(
      `/api/whatsapp/channels/${channelId}/whatsapp/send`,
      { to, text }
    );
    return response;
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '发送消息失败',
    };
  }
}

/**
 * 获取 WhatsApp 联系人
 * @param channelId 渠道ID
 */
export async function fetchWhatsAppContacts(
  channelId: string
): Promise<WhatsAppContactsResponse> {
  try {
    // ✅ 后端实际路径: GET /api/whatsapp/channels/:id/whatsapp/contacts
    const response = await apiGet<WhatsAppContactsResponse>(
      `/api/whatsapp/channels/${channelId}/whatsapp/contacts`
    );
    return response;
  } catch (error) {
    console.error('Failed to fetch WhatsApp contacts:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '获取联系人失败',
    };
  }
}

/**
 * 获取 WhatsApp 连接状态
 * @param channelId 渠道ID
 */
export async function fetchWhatsAppStatus(
  channelId: string
): Promise<WhatsAppStatusResponse> {
  try {
    // ✅ 后端实际路径: GET /api/whatsapp/channels/:id/whatsapp/status
    const response = await apiGet<WhatsAppStatusResponse>(
      `/api/whatsapp/channels/${channelId}/whatsapp/status`
    );
    return response;
  } catch (error) {
    console.error('Failed to fetch WhatsApp status:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : '获取状态失败',
    };
  }
}
