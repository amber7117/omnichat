import { useState, useEffect, useCallback, useRef } from 'react';

interface WhatsAppStatusResult {
  status: 'online' | 'inactive' | 'connecting' | 'error';
  phoneNumber?: string;
  lastActivity?: string;
  isPolling: boolean;
}

interface UseWhatsAppStatusOptions {
  channelId: string | null;
  enabled?: boolean;
  pollInterval?: number; // 轮询间隔，默认 5 秒
  onStatusChange?: (status: WhatsAppStatusResult) => void;
}

/**
 * 自定义 Hook：轮询 WhatsApp 渠道状态
 * 只更新状态和最后上线时间，不刷新整个页面
 */
export function useWhatsAppStatus({
  channelId,
  enabled = true,
  pollInterval = 5000,
  onStatusChange
}: UseWhatsAppStatusOptions): WhatsAppStatusResult {
  const [status, setStatus] = useState<WhatsAppStatusResult>({
    status: 'inactive',
    isPolling: false
  });
  
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const fetchStatus = useCallback(async () => {
    if (!channelId || !enabled) {
      return;
    }

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');
      const response = await fetch(
        `${API_BASE_URL}/api/v1/channels/${channelId}/whatsapp/status`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.status}`);
      }

      const data = await response.json();

      if (!isMountedRef.current) return;

      if (data.ok && data.status) {
        const connectionState = data.status;
        const newStatus: WhatsAppStatusResult = {
          status: connectionState.connection === 'open' ? 'online' : 'inactive',
          phoneNumber: connectionState.phoneNumber,
          lastActivity: new Date().toLocaleString(),
          isPolling: true
        };

        setStatus(newStatus);
        onStatusChange?.(newStatus);
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      
      console.error('Failed to fetch WhatsApp status:', error);
      const errorStatus: WhatsAppStatusResult = {
        status: 'error',
        isPolling: false
      };
      setStatus(errorStatus);
      onStatusChange?.(errorStatus);
    }
  }, [channelId, enabled, onStatusChange]);

  // 启动轮询
  const startPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
    }

    // 立即执行一次
    fetchStatus();

    // 设置定时轮询
    pollTimerRef.current = setInterval(() => {
      fetchStatus();
    }, pollInterval);

    setStatus(prev => ({ ...prev, isPolling: true }));
  }, [fetchStatus, pollInterval]);

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setStatus(prev => ({ ...prev, isPolling: false }));
  }, []);

  // 自动启动/停止轮询
  useEffect(() => {
    isMountedRef.current = true;

    if (channelId && enabled) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, [channelId, enabled, startPolling, stopPolling]);

  return status;
}
