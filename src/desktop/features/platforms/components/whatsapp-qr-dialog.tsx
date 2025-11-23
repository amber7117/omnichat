// ✅ WhatsApp QR Dialog - Show QR code for scanning
import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/common/components/ui/dialog';
import { Button } from '@/common/components/ui/button';
import { Alert, AlertDescription } from '@/common/components/ui/alert';
import { Loader2, RefreshCw, CheckCircle } from 'lucide-react';
import QRCode from 'react-qr-code';
import { fetchWhatsAppQR, fetchWhatsAppStatus } from '@/api/platforms';
import { websocketService } from '@/lib/websocket';

interface WhatsAppQRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
  channelInstanceId: string;
  tenantId: string;
}

export function WhatsAppQRDialog({ open, onOpenChange, onConnected, channelInstanceId, tenantId }: WhatsAppQRDialogProps) {
  const [qrCode, setQrCode] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [countdown, setCountdown] = useState(60);
  const [isConnected, setIsConnected] = useState(false);
  const [channelId, setChannelId] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');

  const initializeQR = useCallback(async () => {
    if (!channelInstanceId) {
      setError('渠道ID不能为空');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError('');
    setIsConnected(false);
    setChannelId(channelInstanceId);

    // Wait for QR code generation and retry up to 10 times
    let retryCount = 0;
    const maxRetries = 10;
    let qrResult;
    
    console.log(`[WhatsApp QR] 开始获取二维码，channelId: ${channelInstanceId}`);
    
    while (retryCount < maxRetries) {
      // Wait before fetching (1 second for first try, then 2 seconds)
      const waitTime = retryCount === 0 ? 1000 : 2000;
      console.log(`[WhatsApp QR] 等待 ${waitTime}ms 后进行第 ${retryCount + 1} 次请求...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      qrResult = await fetchWhatsAppQR(channelInstanceId);
      console.log(`[WhatsApp QR] 第 ${retryCount + 1} 次请求结果:`, qrResult);
      
      if (qrResult.ok && qrResult.qr) {
        console.log(`[WhatsApp QR] ✅ 成功获取二维码，长度: ${qrResult.qr.length}`);
        setQrCode(qrResult.qr);
        setCountdown(qrResult.expiresIn || 60);
        setLoading(false);
        return;
      }
      
      retryCount++;
      console.log(`[WhatsApp QR] ❌ 第 ${retryCount} 次失败: ${qrResult.error}`);
    }
    
    // All retries failed
    console.log(`[WhatsApp QR] ❌ 所有重试失败`);
    setError(qrResult?.error || '获取二维码超时，请重试');
    setLoading(false);
  }, [channelInstanceId]);

  // Poll connection status
  useEffect(() => {
    if (!open || !qrCode || isConnected || !channelId) return;

    console.log('[WebSocket] 设置监听，channelId:', channelId, 'WebSocket连接状态:', websocketService.isConnected);

    // 监听加入房间确认
    const handleJoinedChannel = (...args: unknown[]) => {
      console.log('[WebSocket] ✅ 已加入房间确认:', args);
    };

    // 监听 WebSocket 的 whatsapp-connected 事件
    const handleConnected = (...args: unknown[]) => {
      const data = args[0] as { channelInstanceId?: string; phoneNumber?: string; userId?: string };
      console.log('[WebSocket] ✅ 收到 whatsapp-connected 事件:', data);
      
      // Filter by channelInstanceId to ensure we only handle our channel
      if (data.channelInstanceId && data.channelInstanceId !== channelInstanceId) {
        console.log('[WebSocket] 🚫 事件不属于当前渠道，忽略');
        return;
      }
      
      if (data.phoneNumber) {
        setPhoneNumber(data.phoneNumber);
      }
      setIsConnected(true);
      setTimeout(() => {
        onConnected();
      }, 3000); // 增加延迟，等待 Baileys 完全重新连接
    };

    // 监听 QR 码更新事件
    const handleQRUpdate = (...args: unknown[]) => {
      const data = args[0] as { channelInstanceId?: string; qr?: string; expiresAt?: string };
      console.log('[WebSocket] 📱 收到 whatsapp-qr-update 事件:', data);
      
      // Filter by channelInstanceId
      if (data.channelInstanceId && data.channelInstanceId !== channelInstanceId) {
        console.log('[WebSocket] 🚫 QR事件不属于当前渠道，忽略');
        return;
      }
      
      if (data.qr) {
        console.log('[WebSocket] 📱 更新QR码');
        setQrCode(data.qr);
        
        // Update countdown if expiresAt is provided
        if (data.expiresAt) {
          const expiresAt = new Date(data.expiresAt);
          const now = new Date();
          const secondsLeft = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
          setCountdown(secondsLeft);
        } else {
          setCountdown(60); // Default countdown
        }
      }
    };
    const handleConnectionUpdate = (...args: unknown[]) => {
      console.log('[WebSocket] 🔄 收到 whatsapp-connection-update 事件:', args);
    };
    const handleDisconnected = (...args: unknown[]) => {
      console.log('[WebSocket] ❌ 收到 whatsapp-disconnected 事件:', args);
    };
    
    // 监听错误事件
    const handleError = (...args: unknown[]) => {
      const data = args[0] as { channelInstanceId?: string; error?: string; message?: string };
      console.log('[WebSocket] ❌ 收到 whatsapp-error 事件:', data);
      
      // Filter by channelInstanceId
      if (data.channelInstanceId && data.channelInstanceId !== channelInstanceId) {
        console.log('[WebSocket] 🚫 错误事件不属于当前渠道，忽略');
        return;
      }
      
      if (data.error || data.message) {
        setError(data.error || data.message || '连接出现错误');
      }
    };

    websocketService.on('joined-channel', handleJoinedChannel);
    websocketService.on('whatsapp-connected', handleConnected);
    websocketService.on('whatsapp-qr-update', handleQRUpdate);
    websocketService.on('whatsapp-connection-update', handleConnectionUpdate);
    websocketService.on('whatsapp-disconnected', handleDisconnected);
    websocketService.on('whatsapp-error', handleError);
    websocketService.joinChannel(channelId);

    const pollInterval = setInterval(async () => {
      console.log('[轮询] 检查连接状态...');
      const statusResult = await fetchWhatsAppStatus(channelId);
      console.log('[轮询] 状态结果:', statusResult);
      
      if (statusResult.ok && statusResult.platform?.status === 'connected') {
        console.log('[轮询] ✅ 检测到连接成功！');
        setIsConnected(true);
        clearInterval(pollInterval);
        setTimeout(() => {
          onConnected();
          onOpenChange(false);
        }, 2500); // 给更多时间让后端完全更新状态
      }
    }, 2000);

    return () => {
      console.log('[WebSocket] 清理监听，channelId:', channelId);
      websocketService.off('joined-channel', handleJoinedChannel);
      websocketService.off('whatsapp-connected', handleConnected);
      websocketService.off('whatsapp-qr-update', handleQRUpdate);
      websocketService.off('whatsapp-connection-update', handleConnectionUpdate);
      websocketService.off('whatsapp-disconnected', handleDisconnected);
      websocketService.off('whatsapp-error', handleError);
      websocketService.leaveChannel(channelId);
      clearInterval(pollInterval);
    };
  }, [open, qrCode, isConnected, channelId, tenantId, onConnected, onOpenChange]);

  // Countdown timer with auto-refresh
  useEffect(() => {
    if (!qrCode || countdown <= 0 || isConnected) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        const newCount = prev - 1;
        
        // 当倒计时快结束时（10秒），请求刷新二维码
        if (newCount === 10 && channelId) {
          console.log('🔄 倒计时剩余10秒，请求刷新二维码...');
          fetchWhatsAppQR(channelId).then(result => {
            if (result.ok && result.qr) {
              setQrCode(result.qr);
              setCountdown(result.expiresIn || 60);
              console.log('✅ 二维码已刷新');
            }
          }).catch(err => {
            console.error('❌ 刷新二维码失败:', err);
          });
        }
        
        return newCount;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [qrCode, countdown, isConnected, channelId]);

  // Initialize on open
  useEffect(() => {
    if (open) {
      initializeQR();
    } else {
      setQrCode('');
      setError('');
      setIsConnected(false);
      setChannelId('');
      setPhoneNumber('');
    }
  }, [open, initializeQR]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>连接 WhatsApp</DialogTitle>
          <DialogDescription>
            使用手机 WhatsApp 扫描二维码登录
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">正在生成二维码...</p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription className="mb-3">{error}</AlertDescription>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={initializeQR}
                disabled={loading}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                重试
              </Button>
            </Alert>
          )}

          {qrCode && !isConnected && !loading && (
            <>
              <div className="flex justify-center p-6 bg-white rounded-lg border-2">
                <QRCode value={qrCode} size={240} />
              </div>

              <div className="text-center">
                <p className="text-sm font-medium mb-2">
                  二维码将在 <span className="text-primary font-bold">{countdown}</span> 秒后过期
                </p>
                <p className="text-xs text-muted-foreground">
                  在手机上打开 WhatsApp → 设置 → 已连接的装置 → 扫描此二维码
                </p>
              </div>

              {countdown <= 0 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={initializeQR}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  重新生成二维码
                </Button>
              )}
            </>
          )}

          {isConnected && (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mb-3" />
              <p className="text-lg font-semibold text-green-600">连接成功！</p>
              {phoneNumber && (
                <p className="text-sm font-medium text-muted-foreground mt-1">
                  手机号: {phoneNumber}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                正在跳转...
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
