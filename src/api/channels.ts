// src/api/channels.ts
import { apiGet, apiPost, apiDelete, ApiResponse, ChannelConfig, ChannelStatus, ChannelType } from './client';

// 重新导出类型
export type { ChannelType, ChannelConfig, ChannelStatus, ApiResponse };

// TODO: Replace with real tenant hook
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

/**
 * 统一渠道管理 API
 */

// 获取所有渠道状态
export async function getAllChannels(tenantId?: string): Promise<ApiResponse<Record<string, ChannelStatus>>> {
    const tid = tenantId || getTenantId();
    return apiGet<ApiResponse<Record<string, ChannelStatus>>>(`/api/tenants/${tid}/channels`);
}

// 获取特定渠道状态
export async function getChannelStatus(channelId: string, tenantId?: string): Promise<ApiResponse<ChannelStatus>> {
    const tid = tenantId || getTenantId();
    return apiGet<ApiResponse<ChannelStatus>>(`/api/tenants/${tid}/channels/${channelId}/status`);
}

// 创建新渠道
export async function createChannel(channel: ChannelConfig, tenantId?: string): Promise<ApiResponse> {
    const tid = tenantId || getTenantId();
    return apiPost<ApiResponse>(`/api/tenants/${tid}/channels`, channel);
}

// 初始化渠道连接
export async function initializeChannel(channelId: string, config?: Record<string, unknown>, tenantId?: string): Promise<ApiResponse> {
    const tid = tenantId || getTenantId();
    return apiPost<ApiResponse>(`/api/tenants/${tid}/channels/${channelId}/initialize`, { config });
}

// 删除渠道
export async function deleteChannel(channelId: string, tenantId?: string): Promise<ApiResponse> {
    const tid = tenantId || getTenantId();
    return apiDelete<ApiResponse>(`/api/tenants/${tid}/channels/${channelId}`);
}

/**
 * WhatsApp 专用 API
 */

// 创建 WhatsApp 渠道
export async function createWhatsAppChannel(channelId: string, name: string, tenantId?: string): Promise<ApiResponse> {
    return createChannel({
        channelId,
        channelType: 'whatsapp',
        name,
        config: {},
        isActive: true
    }, tenantId);
}

// 初始化 WhatsApp 连接并获取二维码
export async function initializeWhatsApp(channelId: string, tenantId?: string): Promise<ApiResponse> {
    return initializeChannel(channelId, {}, tenantId);
}

/**
 * Telegram 专用 API
 */

// 创建 Telegram 用户渠道
export async function createTelegramChannel(channelId: string, name: string, apiId: number, apiHash: string, tenantId?: string): Promise<ApiResponse> {
    return createChannel({
        channelId,
        channelType: 'telegram-user',
        name,
        config: {
            apiId,
            apiHash
        },
        isActive: true
    }, tenantId);
}

// 初始化 Telegram 连接
export async function initializeTelegram(channelId: string, phoneNumber: string, tenantId?: string): Promise<ApiResponse> {
    return initializeChannel(channelId, { phoneNumber }, tenantId);
}

// 请求 Telegram 验证码
export async function requestTelegramCode(channelId: string, phoneNumber: string, tenantId?: string): Promise<ApiResponse> {
    const tid = tenantId || getTenantId();
    return apiPost<ApiResponse>(`/api/tenants/${tid}/channels/${channelId}/telegram/request-code`, { phoneNumber });
}

// 提交 Telegram 验证码
export async function submitTelegramCode(channelId: string, code: string, tenantId?: string): Promise<ApiResponse> {
    const tid = tenantId || getTenantId();
    return apiPost<ApiResponse>(`/api/tenants/${tid}/channels/${channelId}/telegram/submit-code`, { code });
}

/**
 * 通用消息 API
 */

// 发送消息
export async function sendMessage(
    channelId: string, 
    customerId: string, 
    content: string,
    metadata?: Record<string, unknown>,
    tenantId?: string
): Promise<ApiResponse<{ messageId: string; channelId: string; customerId: string; content: string }>> {
    const tid = tenantId || getTenantId();
    return apiPost<ApiResponse<{ messageId: string; channelId: string; customerId: string; content: string }>>(
        `/api/tenants/${tid}/channels/${channelId}/messages`, 
        { customerId, content, metadata }
    );
}

// 获取客户信息
export async function getCustomerInfo(channelId: string, customerId: string, tenantId?: string): Promise<ApiResponse<{
    name?: string;
    avatar?: string;
    metadata?: Record<string, unknown>;
}>> {
    const tid = tenantId || getTenantId();
    return apiGet<ApiResponse<{
        name?: string;
        avatar?: string;
        metadata?: Record<string, unknown>;
    }>>(`/api/tenants/${tid}/channels/${channelId}/customers/${customerId}`);
}

/**
 * 辅助函数
 */

// 生成渠道ID（基于类型和时间戳）
export function generateChannelId(channelType: ChannelType): string {
    return `${channelType}_${Date.now()}`;
}

// 检查渠道类型
export function isWhatsAppChannel(channelType: ChannelType): boolean {
    return channelType === 'whatsapp';
}

export function isTelegramChannel(channelType: ChannelType): boolean {
    return channelType === 'telegram-user' || channelType === 'telegram-bot';
}

// 格式化渠道状态显示文本
export function formatChannelStatus(status: ChannelStatus): string {
    if (status.connected) {
        return `已连接${status.user?.name ? ` - ${status.user.name}` : ''}`;
    } else {
        return `未连接${status.error ? ` - ${status.error}` : ''}`;
    }
}

// 获取渠道类型显示名称
export function getChannelTypeDisplayName(channelType: ChannelType): string {
    const names: Record<ChannelType, string> = {
        'whatsapp': 'WhatsApp',
        'telegram-user': 'Telegram 用户',
        'telegram-bot': 'Telegram 机器人',
        'web': 'Web 聊天',
        'email': '邮件',
        'facebook': 'Facebook',
        'wechat': '微信'
    };
    return names[channelType] || channelType;
}