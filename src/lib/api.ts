// src/lib/api.ts

// 导入客户端类型定义
interface Channel {
  id: string;
  name: string;
  type: 'whatsapp' | 'telegram-user' | 'telegram-bot' | 'web-widget' | 'facebook' | 'email';
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  isActive: boolean;
  lastActivity: Date;
  user?: { id: string; name?: string };
  config: Record<string, unknown>;
  agentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ChannelStatusResponse {
  ok: boolean;
  connected: boolean;
  user?: { id: string; name?: string };
  error?: string;
}

interface WhatsAppConnectResponse {
  ok: boolean;
  message?: string;
  error?: string;
}

interface WhatsAppQrResponse {
  ok: boolean;
  qr?: string;
  expiresIn?: number;
  error?: string;
}

interface TelegramUserStartLoginResponse {
  ok: boolean;
  loginSessionId?: string;
  error?: string;
}

interface TelegramUserSubmitCodeResponse {
  ok: boolean;
  needs2FA?: boolean;
  error?: string;
}

interface TelegramBotConnectResponse {
  ok: boolean;
  botUsername?: string;
  error?: string;
}

interface WidgetConfig {
  theme?: string;
  position?: string;
  [key: string]: unknown;
}

interface WidgetEmbedCodeResponse {
  ok: boolean;
  embedCode?: string;
  error?: string;
}

interface FacebookOAuthUrlResponse {
  ok: boolean;
  oauthUrl?: string;
  error?: string;
}

// Get API URL from environment
export const getApiBaseUrl = () => {
  // For client-side (Vite)
  if (typeof import.meta !== 'undefined' && import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  // For Next.js
  if (process.env.NEXT_PUBLIC_API_BASE) {
    return process.env.NEXT_PUBLIC_API_BASE;
  }
  // Default fallback
  return 'http://127.0.0.1:3001';
};

const API_BASE = getApiBaseUrl();

// Get current tenant ID
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

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  // Get auth token from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Merge with options headers
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Unauthorized');
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(response.status, errorText || `HTTP ${response.status}`);
  }

  return response.json();
}

// Channel CRUD - 统一连接器架构
export const getChannels = async (): Promise<Channel[]> => {
  try {
    const response = await apiRequest<{
      ok: boolean;  // 后端使用 ok 而不是 success
      data: Record<string, {
        connected: boolean;
        user?: { id: string; name?: string };
        error?: string;
        config?: {
          channelId: string;
          channelType: string;
          name: string;
          config: Record<string, unknown>;
          isActive?: boolean;
        };
      }>;
    }>('/api/channels');  // 添加 /api 前缀
    
    if (!response.ok || !response.data) {
      return [];
    }
    
    // 转换为前端期望的Channel格式
    return Object.entries(response.data).map(([channelId, status]) => ({
      id: channelId,
      name: status.config?.name || channelId,
      type: status.config?.channelType as Channel['type'] || 'web-widget',
      status: status.connected ? 'connected' as const : 'disconnected' as const,
      isActive: status.config?.isActive ?? true,
      lastActivity: new Date(),
      user: status.user,
      config: status.config?.config || {},
      agentCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  } catch (error) {
    console.error('Failed to fetch channels:', error);
    return [];
  }
};

export const createChannel = (data: {
  type: Channel['type'];
  name: string;
  config: Record<string, unknown>;
}): Promise<Channel> =>
  apiRequest('/api/channels', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateChannel = (id: string, data: Partial<Channel>, tenantId?: string): Promise<Channel> => {
  const tid = tenantId || getTenantId();
  return apiRequest(`/api/tenants/${tid}/channels/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

export const deleteChannel = async (id: string, tenantId?: string): Promise<void> => {
  const tid = tenantId || getTenantId();
  
  // 对于WhatsApp渠道,使用专用的删除端点
  try {
    await apiRequest(`/api/whatsapp/channels/${id}/whatsapp`, {
      method: 'DELETE',
      body: JSON.stringify({ tenantId: tid, disconnect: true }),
    });
  } catch {
    // 如果不是WhatsApp渠道或者WhatsApp端点失败,则使用通用端点
    return apiRequest(`/api/tenants/${tid}/channels/${id}`, {
      method: 'DELETE',
    });
  }
};

// Channel Status
export const getChannelStatus = (id: string): Promise<ChannelStatusResponse> => {
  // 后端路径: GET /api/channels/:channelId/status
  return apiRequest(`/api/channels/${id}/status`);
};

// WhatsApp Baileys
export const connectWhatsAppChannel = (id: string): Promise<WhatsAppConnectResponse> =>
  apiRequest(`/api/whatsapp/channels/${id}/whatsapp/connect`, {
    method: 'POST',
  });

export const getWhatsAppQr = (id: string): Promise<WhatsAppQrResponse> =>
  apiRequest(`/api/whatsapp/channels/${id}/whatsapp/qr`);

// Telegram User (GramJS)
export const startTelegramUserLogin = (id: string, phoneNumber: string): Promise<TelegramUserStartLoginResponse> =>
  apiRequest(`/api/channels/${id}/telegram-user/start-login`, {
    method: 'POST',
    body: JSON.stringify({ phoneNumber }),
  });

export const submitTelegramUserCode = (id: string, loginSessionId: string, code: string): Promise<TelegramUserSubmitCodeResponse> =>
  apiRequest(`/api/channels/${id}/telegram-user/submit-code`, {
    method: 'POST',
    body: JSON.stringify({ loginSessionId, code }),
  });

// Telegram Bot (Telegraf)
export const connectTelegramBot = (id: string, botToken: string): Promise<TelegramBotConnectResponse> =>
  apiRequest(`/api/channels/${id}/telegram-bot/connect`, {
    method: 'POST',
    body: JSON.stringify({ botToken }),
  });

// Web Widget
export const getWidgetConfig = (id: string): Promise<WidgetConfig> =>
  apiRequest(`/api/channels/${id}/widget/config`);

export const updateWidgetConfig = (id: string, config: WidgetConfig): Promise<void> =>
  apiRequest(`/api/channels/${id}/widget/config`, {
    method: 'POST',
    body: JSON.stringify(config),
  });

export const getWidgetEmbedCode = (id: string): Promise<WidgetEmbedCodeResponse> =>
  apiRequest(`/api/channels/${id}/widget/embed-code`);

// Facebook Pages Messenger
export const getFacebookOAuthUrl = (): Promise<FacebookOAuthUrlResponse> =>
  apiRequest('/api/facebook/oauth-url');