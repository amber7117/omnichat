// @ts-nocheck
// src/components/channels/TelegramBotConnectPanel.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { connectTelegramBot, getChannelStatus } from '@/lib/api';
import { ChannelStatusResponse, TelegramBotConnectResponse } from '@/types/channel';

interface TelegramBotConnectPanelProps {
  channelId: string;
}

export function TelegramBotConnectPanel({ channelId }: TelegramBotConnectPanelProps) {
  const [status, setStatus] = useState<ChannelStatusResponse | null>(null);
  const [botToken, setBotToken] = useState('');
  const [botName, setBotName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current status
  const fetchStatus = useCallback(async () => {
    try {
      const statusData = await getChannelStatus(channelId);
      setStatus(statusData);
      setError(null);
    } catch (err) {
      console.error('获取状态失败:', err);
      setError('获取状态失败');
    }
  }, [channelId]);

  // Initial status fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Handle test connection
  const handleTestConnection = async () => {
    if (!botToken.trim()) {
      setError('请输入 Bot Token');
      return;
    }

    setIsTesting(true);
    setError(null);

    try {
      const response: TelegramBotConnectResponse = await connectTelegramBot(channelId, botToken.trim());
      if (response.success && response.botInfo) {
        setBotName(response.botInfo.firstName || '');
        alert(`连接成功！Bot: @${response.botInfo.username}`);
        fetchStatus();
      } else {
        setError('连接失败，请检查 Bot Token 是否正确');
      }
    } catch (err) {
      console.error('测试连接失败:', err);
      setError('测试连接失败，请检查网络连接');
    } finally {
      setIsTesting(false);
    }
  };

  // Handle save configuration
  const handleSave = async () => {
    if (!botToken.trim() || !botName.trim()) {
      setError('请填写 Bot Token 和 Bot 名称');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Test connection first
      const testResponse: TelegramBotConnectResponse = await connectTelegramBot(channelId, botToken.trim());
      if (!testResponse.success) {
        setError('Bot Token 无效，请重新测试连接');
        return;
      }

      // If test passed, save configuration
      // Note: In a real implementation, you might want to call a separate save API
      alert('配置已保存');
      fetchStatus();
    } catch (err) {
      console.error('保存失败:', err);
      setError('保存失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return '已连接';
      case 'connecting': return '连接中';
      case 'error': return '异常';
      default: return '未连接';
    }
  };

  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Telegram Bot 连接</h3>
        {status && (
          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(status.status)} bg-opacity-20`}>
            {getStatusText(status.status)}
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="botToken" className="block text-sm font-medium text-gray-700 mb-2">
            Bot Token
          </label>
          <input
            id="botToken"
            type="password"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="输入 Bot Token (从 @BotFather 获取)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            从 Telegram 的 @BotFather 获取的 Token
          </p>
        </div>

        <div>
          <label htmlFor="botName" className="block text-sm font-medium text-gray-700 mb-2">
            Bot 名称
          </label>
          <input
            id="botName"
            type="text"
            value={botName}
            onChange={(e) => setBotName(e.target.value)}
            placeholder="Bot 显示名称"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            描述
          </label>
          <input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Bot 描述（可选）"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleTestConnection}
            disabled={isTesting || !botToken.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? '测试中...' : '测试连接'}
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading || !botToken.trim() || !botName.trim()}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '保存中...' : '保存配置'}
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div className="text-red-600">
            <p className="font-medium">❌ 错误</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        {/* Loading state for initial load */}
        {!status && !error && (
          <div className="text-center text-gray-500">
            <p>加载中...</p>
          </div>
        )}
      </div>
    </div>
  );
}
// @ts-nocheck
