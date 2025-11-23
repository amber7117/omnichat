// src/common/components/WhatsAppConnectPanel.tsx
import { useState, useEffect, useCallback } from 'react';
import QRCode from 'react-qr-code';
import { Button } from './ui/button';
import { AlertCircle, CheckCircle, Loader2, QrCode as QrCodeIcon, Smartphone } from 'lucide-react';
import { startWhatsAppConnect, fetchWhatsAppQr, fetchWhatsAppStatus } from '@/api/whatsapp';

interface WhatsAppConnectPanelProps {
  channelId: string;
}

type ConnectionStatus = 'idle' | 'connecting' | 'generating_qr' | 'qr_ready' | 'scanning' | 'connected' | 'error';

export function WhatsAppConnectPanel({ channelId }: WhatsAppConnectPanelProps) {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrPollTimer, setQrPollTimer] = useState<NodeJS.Timeout | null>(null);
  const [statusPollTimer, setStatusPollTimer] = useState<NodeJS.Timeout | null>(null);

  // 清理轮询定时器
  const clearQrPollTimer = useCallback(() => {
    if (qrPollTimer) {
      clearTimeout(qrPollTimer);
      setQrPollTimer(null);
    }
  }, [qrPollTimer]);

  const clearStatusPollTimer = useCallback(() => {
    if (statusPollTimer) {
      clearTimeout(statusPollTimer);
      setStatusPollTimer(null);
    }
  }, [statusPollTimer]);

  // 开始轮询连接状态
  const startPollingStatus = useCallback(() => {
    const poll = async () => {
      try {
        const statusResponse = await fetchWhatsAppStatus(channelId);

        if (statusResponse.ok && statusResponse.status) {
          const connectionState = statusResponse.status;

          // 检查连接状态
          if (connectionState.connection === 'open') {
            // 连接成功
            setStatus('connected');
            clearStatusPollTimer();
            clearQrPollTimer(); // 也停止QR轮询
          } else if (connectionState.connection === 'close') {
            // 连接关闭，检查是否是错误
            const reason = (connectionState.lastDisconnect?.error as any)?.output?.statusCode;
            if (reason && reason !== 404) { // 404通常是正常的断开
              setStatus('error');
              setError(`连接失败: ${reason}`);
              clearStatusPollTimer();
              clearQrPollTimer();
            }
          }
          // 如果是其他状态，继续轮询
        }

        // 如果还在扫描状态，继续轮询
        if (status === 'qr_ready' || status === 'scanning') {
          const timer = setTimeout(poll, 2000);
          setStatusPollTimer(timer);
        }
      } catch (error) {
        console.warn('Status polling network error, continuing...', error);
        // 网络错误，继续轮询
        if (status === 'qr_ready' || status === 'scanning') {
          const timer = setTimeout(poll, 2000);
          setStatusPollTimer(timer);
        }
      }
    };

    // 立即开始第一次轮询
    poll();
  }, [channelId, status, clearStatusPollTimer, clearQrPollTimer]);

  // 开始轮询二维码
  const startPollingQr = useCallback(() => {
    const poll = async () => {
      try {
        const qrResponse = await fetchWhatsAppQr(channelId);

        if (qrResponse.ok && qrResponse.qr) {
          // 获取到二维码
          setQr(qrResponse.qr);
          setStatus('qr_ready');
          clearQrPollTimer(); // 停止QR轮询
          // 开始轮询连接状态
          startPollingStatus();
        } else if (qrResponse.ok === false) {
          // 接口返回错误，可能是连接失败
          setStatus('error');
          setError(qrResponse.error || '生成二维码失败');
          clearQrPollTimer();
        } else {
          // 继续轮询
          const timer = setTimeout(poll, 3000);
          setQrPollTimer(timer);
        }
      } catch (error) {
        // 网络错误，继续轮询
        console.warn('QR polling network error, continuing...', error);
        const timer = setTimeout(poll, 3000);
        setQrPollTimer(timer);
      }
    };

    // 立即开始第一次轮询
    poll();
  }, [channelId, clearQrPollTimer, startPollingStatus]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      clearQrPollTimer();
      clearStatusPollTimer();
    };
  }, [clearQrPollTimer, clearStatusPollTimer]);

  // 开始连接流程
  const handleStartConnect = async () => {
    setStatus('connecting');
    setError(null);
    setQr(null);

    try {
      const connectResponse = await startWhatsAppConnect(channelId);

      if (!connectResponse.ok) {
        setStatus('error');
        setError(connectResponse.error || '启动连接失败');
        return;
      }

      // 连接成功，开始轮询二维码
      setStatus('generating_qr');
      startPollingQr();

    } catch (error) {
      setStatus('error');
      setError(error instanceof Error ? error.message : '网络错误');
    }
  };

  // 渲染状态内容
  const renderContent = () => {
    switch (status) {
      case 'idle':
        return (
          <div className="text-center py-8">
            <Smartphone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">点击下方按钮开始连接 WhatsApp</p>
            <Button onClick={handleStartConnect} className="gap-2">
              <QrCodeIcon className="w-4 h-4" />
              开始连接
            </Button>
          </div>
        );

      case 'connecting':
        return (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">正在启动 WhatsApp 连接...</p>
          </div>
        );

      case 'generating_qr':
        return (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">正在生成二维码，请稍候...</p>
            <p className="text-sm text-gray-500 mt-2">这可能需要几秒钟时间</p>
          </div>
        );

      case 'qr_ready':
        return (
          <div className="text-center py-6">
            <div className="mb-4">
              <QrCodeIcon className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">二维码已生成</p>
            </div>
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block mb-4">
              <QRCode value={qr!} size={200} />
            </div>
            <div className="max-w-sm mx-auto">
              <p className="text-sm text-gray-600 mb-2">
                请使用 WhatsApp 应用扫描上方二维码
              </p>
              <p className="text-xs text-gray-500">
                扫描后您的 WhatsApp 账户将连接到此渠道
              </p>
            </div>
          </div>
        );

      case 'scanning':
        return (
          <div className="text-center py-6">
            <div className="mb-4">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">正在验证连接...</p>
            </div>
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block mb-4 opacity-50">
              <QRCode value={qr!} size={200} />
            </div>
            <div className="max-w-sm mx-auto">
              <p className="text-sm text-gray-600 mb-2">
                二维码已扫描，正在建立连接...
              </p>
              <p className="text-xs text-gray-500">
                请保持应用打开，这可能需要几秒钟
              </p>
            </div>
          </div>
        );

      case 'connected':
        return (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <p className="text-green-700 font-medium">WhatsApp 已连接成功！</p>
            <p className="text-sm text-gray-600 mt-2">您可以开始接收和发送消息了</p>
          </div>
        );

      case 'error':
        return (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <p className="text-red-700 font-medium mb-2">连接失败</p>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <Button onClick={handleStartConnect} variant="outline" className="gap-2">
              <QrCodeIcon className="w-4 h-4" />
              重试连接
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">WhatsApp 连接</h3>
        <p className="text-sm text-gray-600">连接您的 WhatsApp Business 账户</p>
      </div>
      {renderContent()}
    </div>
  );
}
