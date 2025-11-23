// src/api/client.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
    if (res.status === 401) {
        // 清除认证信息
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        
        // 重定向到登录页
        window.location.href = '/api/auth/login';
        throw new Error('Unauthorized');
    }
    
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `API error: ${res.status}`);
    }
    
    const jsonData = await res.json();
    
    // 后端有两种响应格式：
    // 1. { ok: true, data: {...} }  - channelRoutes 使用
    // 2. { ok: true, ...directData } - whatsapp.controller 使用
    if (jsonData.data !== undefined) {
        // 如果有 data 字段，返回包含 data 的完整响应
        return jsonData as T;
    }
    
    // 直接返回整个响应对象
    return jsonData as T;
}

export async function apiGet<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        headers: getAuthHeaders(),
    });
    return handleResponse<T>(res);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
    });
    return handleResponse<T>(res);
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
    });
    return handleResponse<T>(res);
}

export async function apiDelete<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    return handleResponse<T>(res);
}

// 统一API响应类型
export interface ApiResponse<T = unknown> {
    ok: boolean;           // 后端使用 ok 而不是 success
    data?: T;              // channelRoutes 使用 data 字段
    error?: string;        // 错误信息
    message?: string;      // 成功/错误消息
    code?: string;         // 错误代码
    meta?: Record<string, unknown>;  // 元数据
}

// 后端渠道列表响应格式
export interface ChannelListResponse {
    ok: boolean;
    data?: ChannelData[];
    channels?: ChannelData[];  // 兼容旧格式
    meta?: {
        total: number;
        filters?: Record<string, unknown>;
    };
    error?: string;
}

// 渠道数据
export interface ChannelData {
    id: string;
    name: string;
    type: string;
    status: string;
    phoneNumber?: string;
    lastActivity?: string;
    messageCount?: number;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

// 渠道类型
export type ChannelType = 'whatsapp' | 'telegram-user' | 'telegram-bot' | 'web' | 'email' | 'facebook' | 'wechat';

// 渠道配置接口
export interface ChannelConfig {
    channelId: string;
    channelType: ChannelType;
    name: string;
    config: Record<string, unknown>;
    isActive?: boolean;
}

// 渠道状态接口
export interface ChannelStatus {
    connected: boolean;
    user?: { id: string; name?: string };
    error?: string;
    config?: ChannelConfig;
}
