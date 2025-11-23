// @ts-nocheck
// src/components/channels/TelegramUserConnectPanel.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { startTelegramUserLogin, submitTelegramUserCode, getChannelStatus } from '@/lib/api';
import { ChannelStatusResponse, TelegramUserStartLoginResponse, TelegramUserSubmitCodeResponse } from '@/types/channel';

interface TelegramUserConnectPanelProps {
  channelId: string;
}

export function TelegramUserConnectPanel({ channelId }: TelegramUserConnectPanelProps) {
  const [status, setStatus] = useState<ChannelStatusResponse | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [loginSessionId, setLoginSessionId] = useState<string | null>(null);
  const [step, setStep] = useState<'phone' | 'code' | 'connected'>('phone');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current status
  const fetchStatus = useCallback(async () => {
    try {
      const statusData = await getChannelStatus(channelId);
      setStatus(statusData);
      setError(null);

      if (statusData.status === 'connected') {
        setStep('connected');
      } else if (statusData.status === 'error') {
        setError(statusData.lastError || '连接出现错误');
      }
    } catch (err) {
      console.error('获取状态失败:', err);
      setError('获取状态失败');
    }
  }, [channelId]);

  // Initial status fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Handle start login (send verification code)
  const handleStartLogin = async () => {
    if (!phoneNumber.trim()) {
      setError('请输入手机号');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response: TelegramUserStartLoginResponse = await startTelegramUserLogin(channelId, phoneNumber.trim());
      setLoginSessionId(response.loginSessionId);
      setStep('code');
      alert('验证码已发送，请检查 Telegram 应用');
    } catch (err) {
      console.error('发送验证码失败:', err);
      setError('发送验证码失败，请检查手机号格式');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle submit verification code
  const handleSubmitCode = async () => {
    if (!code.trim()) {
      setError('请输入验证码');
      return;
    }

    if (!loginSessionId) {
      setError('登录会话已过期，请重新开始');
      setStep('phone');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response: TelegramUserSubmitCodeResponse = await submitTelegramUserCode(channelId, loginSessionId, code.trim());

      if (response.status === 'connected') {
        setStep('connected');
        alert('Telegram 账号绑定成功！');
        fetchStatus(); // Refresh status to get latest info
      } else {
        setError(response.error || '验证码错误，请重试');
      }
    } catch (err) {
      console.error('验证失败:', err);
      setError('验证失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle back to phone input
  const handleBackToPhone = () => {
    setStep('phone');
    setCode('');
    setLoginSessionId(null);
    setError(null);
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
        <h3 className="text-lg font-semibold">Telegram User 连接</h3>
        {status && (
          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(status.status)} bg-opacity-20`}>
            {getStatusText(status.status)}
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* Phone number input step */}
        {step === 'phone' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                手机号
              </label>
              <input
                id="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1234567890"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                请输入带国家码的手机号，例如：+86 13800138000
              </p>
            </div>
            <button
              onClick={handleStartLogin}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '发送中...' : '发送验证码'}
            </button>
          </div>
        )}

        {/* Verification code input step */}
        {step === 'code' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                验证码
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="输入 Telegram 收到的验证码"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                请检查 Telegram 应用中的验证码
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSubmitCode}
                disabled={isLoading}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '验证中...' : '确认登录'}
              </button>
              <button
                onClick={handleBackToPhone}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                返回
              </button>
            </div>
          </div>
        )}

        {/* Connected state */}
        {step === 'connected' && (
          <div className="text-center text-green-600">
            <p className="font-medium">✅ Telegram 账号已成功绑定</p>
            {status?.deviceInfo && (
              <div className="mt-2 text-sm text-gray-600">
                {status.deviceInfo.name && <p>账号: {status.deviceInfo.name}</p>}
                {status.deviceInfo.platform && <p>平台: {status.deviceInfo.platform}</p>}
              </div>
            )}
          </div>
        )}

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
