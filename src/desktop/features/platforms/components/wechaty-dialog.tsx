// ✅ Wechaty QR Dialog - Show QR code for scanning
import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/common/components/ui/dialog';
import { Button } from '@/common/components/ui/button';
import { Alert, AlertDescription } from '@/common/components/ui/alert';
import { Loader2, RefreshCw, CheckCircle } from 'lucide-react';
import QRCode from 'react-qr-code';
import { fetchWechatyStatus } from '@/api/platforms';
import { websocketService } from '@/lib/websocket';

interface WechatyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
  channelInstanceId: string;
  tenantId: string;
}

export function WechatyDialog({ open, onOpenChange, onConnected, channelInstanceId, tenantId }: WechatyDialogProps) {
  const [qrCode, setQrCode] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [countdown, setCountdown] = useState(60);
  const [isConnected, setIsConnected] = useState(false);
  const [channelId, setChannelId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');

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
    let statusResult;
    
    while (retryCount < maxRetries) {
      // Wait before fetching (1 second for first try, then 2 seconds)
      const waitTime = retryCount === 0 ? 1000 : 2000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      statusResult = await fetchWechatyStatus(channelInstanceId);
      
      if (statusResult.ok && statusResult.qrCode) {
        setQrCode(statusResult.qrCode);
        setCountdown(60); // Default countdown
        setLoading(false);
        return;
      }

      if (statusResult.ok && statusResult.isLoggedIn) {
        setIsConnected(true);
        setLoading(false);
        onConnected();
        return;
      }
      
      retryCount++;
    }
    
    // All retries failed
    setError(statusResult?.error || '获取二维码超时，请重试');
    setLoading(false);
  }, [channelInstanceId, onConnected]);

  // Poll connection status
  useEffect(() => {
    if (!open || isConnected || !channelId) return;

    // 监听加入房间确认
    const handleJoinedChannel = () => {
      // Joined
    };

    // 监听 WebSocket 的 wechaty-connected 事件
    const handleConnected = (...args: unknown[]) => {
      const data = args[0] as { channelInstanceId?: string; user?: { name: string; id: string } };
      
      // Filter by channelInstanceId to ensure we only handle our channel
      if (data.channelInstanceId && data.channelInstanceId !== channelInstanceId) {
        return;
      }
      
      if (data.user) {
        setUserName(data.user.name);
      }
      setIsConnected(true);
      setTimeout(() => {
        onConnected();
      }, 3000);
    };

    // 监听 QR 码更新事件
    const handleQRUpdate = (...args: unknown[]) => {
      const data = args[0] as { channelInstanceId?: string; qr?: string; status?: string };
      
      // Filter by channelInstanceId
      if (data.channelInstanceId && data.channelInstanceId !== channelInstanceId) {
        return;
      }
      
      if (data.qr) {
        setQrCode(data.qr);
        setCountdown(60);
      }
    };
    
    // 监听错误事件
    const handleError = (...args: unknown[]) => {
      const data = args[0] as { channelInstanceId?: string; error?: string; message?: string };
      
      // Filter by channelInstanceId
      if (data.channelInstanceId && data.channelInstanceId !== channelInstanceId) {
        return;
      }
      
      if (data.error || data.message) {
        setError(data.error || data.message || '连接出现错误');
      }
    };

    websocketService.on('joined-channel', handleJoinedChannel);
    websocketService.on('wechaty-connected', handleConnected);
    websocketService.on('wechaty-qr', handleQRUpdate);
    websocketService.on('wechaty-error', handleError);
    websocketService.joinChannel(channelId);

    const pollInterval = setInterval(async () => {
      const statusResult = await fetchWechatyStatus(channelId);
      
      if (statusResult.ok && statusResult.isLoggedIn) {
        setIsConnected(true);
        clearInterval(pollInterval);
        setTimeout(() => {
          onConnected();
          onOpenChange(false);
        }, 2500);
      }
    }, 2000);

    return () => {
      websocketService.off('joined-channel', handleJoinedChannel);
      websocketService.off('wechaty-connected', handleConnected);
      websocketService.off('wechaty-qr', handleQRUpdate);
      websocketService.off('wechaty-error', handleError);
      websocketService.leaveChannel(channelId);
      clearInterval(pollInterval);
    };
  }, [open, isConnected, channelId, tenantId, onConnected, onOpenChange, channelInstanceId]);

  // Countdown timer
  useEffect(() => {
    if (!qrCode || countdown <= 0 || isConnected) return;

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [qrCode, countdown, isConnected]);

  // Initialize on open
  useEffect(() => {
    if (open) {
      initializeQR();
    } else {
      setQrCode('');
      setError('');
      setIsConnected(false);
      setChannelId('');
      setUserName('');
    }
  }, [open, initializeQR]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>连接个人微信 (Wechaty)</DialogTitle>
          <DialogDescription>
            使用手机微信扫描二维码登录
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
                  在手机上打开微信 → 扫一扫 → 扫描此二维码
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
              {userName && (
                <p className="text-sm font-medium text-muted-foreground mt-1">
                  用户: {userName}
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
