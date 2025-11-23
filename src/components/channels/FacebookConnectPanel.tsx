// @ts-nocheck
// src/components/channels/FacebookConnectPanel.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../common/components/ui/card';
import { Button } from '../../common/components/ui/button';
import { Badge } from '../../common/components/ui/badge';
import { Alert, AlertDescription } from '../../common/components/ui/alert';
import { Loader2, Facebook, CheckCircle, XCircle, RefreshCw, MessageSquare } from 'lucide-react';
import { getFacebookOAuthUrl, getChannelStatus } from '@/lib/api';
import { ChannelStatusResponse } from '@/types/channel';
import { toast } from 'sonner';

interface FacebookConnectPanelProps {
  channelId: string;
}

export function FacebookConnectPanel({ channelId }: FacebookConnectPanelProps) {
  const [status, setStatus] = useState<ChannelStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReauthorizing, setIsReauthorizing] = useState(false);
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

  // Handle connect/re-authorize
  const handleConnect = async (isReauth = false) => {
    if (isReauth) {
      setIsReauthorizing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await getFacebookOAuthUrl();
      // Redirect to Facebook OAuth
      window.location.href = response.url;
    } catch (err) {
      console.error('获取授权链接失败:', err);
      setError('获取授权链接失败，请重试');
      toast.error('获取授权链接失败');
      if (isReauth) {
        setIsReauthorizing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'connecting':
        return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <XCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-800';
      case 'connecting': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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

  const isConnected = status?.status === 'connected';
  const facebookInfo = status?.facebookInfo;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Facebook className="w-5 h-5 text-blue-600" />
          Facebook Pages Messenger 连接
          {status && (
            <Badge className={getStatusColor(status.status)}>
              <div className="flex items-center gap-1">
                {getStatusIcon(status.status)}
                {getStatusText(status.status)}
              </div>
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="w-4 h-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Not Connected State */}
        {!isConnected && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <MessageSquare className="w-16 h-16 text-gray-300" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                连接 Facebook Page
              </h3>
              <p className="text-gray-600 mb-4">
                通过 Facebook OAuth 绑定您的 Page，启用 Messenger 客服功能
              </p>
              <Button
                onClick={() => handleConnect(false)}
                disabled={isLoading}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    跳转中...
                  </>
                ) : (
                  <>
                    <Facebook className="w-4 h-4 mr-2" />
                    连接 Facebook Page
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Connected State */}
        {isConnected && facebookInfo && (
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Facebook Page 已成功连接
              </AlertDescription>
            </Alert>

            {/* Page Information */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Facebook className="w-5 h-5 text-blue-600" />
                <span className="font-medium">Page 信息</span>
              </div>

              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Page 名称:</span>
                  <span className="font-medium">{facebookInfo.fbPageName || '未知'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Page ID:</span>
                  <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">
                    {facebookInfo.fbPageId || '未知'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">消息订阅:</span>
                  <Badge
                    className={
                      facebookInfo.subscribed
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }
                  >
                    {facebookInfo.subscribed ? '已订阅' : '未订阅'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Re-authorize Button */}
            <div className="flex justify-center">
              <Button
                onClick={() => handleConnect(true)}
                disabled={isReauthorizing}
                variant="outline"
              >
                {isReauthorizing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    重新授权中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    重新授权
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Connecting State */}
        {status?.status === 'connecting' && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">正在处理 Facebook 授权...</p>
            <p className="text-sm text-gray-500 mt-2">
              请在 Facebook 完成授权后返回此页面
            </p>
          </div>
        )}

        {/* Error State */}
        {status?.status === 'error' && (
          <Alert variant="destructive">
            <XCircle className="w-4 h-4" />
            <AlertDescription>
              <strong>连接失败</strong>
              {status.lastError && (
                <div className="mt-2 text-sm">
                  错误详情: {status.lastError}
                </div>
              )}
              <div className="mt-3">
                <Button
                  onClick={() => handleConnect(false)}
                  size="sm"
                  variant="outline"
                >
                  重试连接
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Help Text */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• 需要 Facebook Page 管理员权限</p>
          <p>• 授权后将自动订阅 Messenger 消息事件</p>
          <p>• 支持文本消息、快速回复和结构化消息</p>
        </div>
      </CardContent>
    </Card>
  );
}
// @ts-nocheck
