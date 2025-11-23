// ✅ Platform Integration Management Page
// @ts-nocheck
// Multi-tenant SaaS platform connection UI
// Updated: 2025-11-21 - Improved loading spinners

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/common/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/common/components/ui/card';
import { Badge } from '@/common/components/ui/badge';
import { Plus, MessageSquare, Send, Bot, Globe, Facebook, RefreshCw } from 'lucide-react';
import type { Platform, PlatformType } from '@/types/platform';
import { fetchPlatforms } from '@/api/platforms';
import { AddPlatformDialog } from '../components/add-platform-dialog';
// @ts-nocheck
import { WhatsAppQRDialog } from '../components/whatsapp-qr-dialog';
import { TelegramLoginDialog } from '../components/telegram-login-dialog';
import { TelegramBotDialog } from '../components/telegram-bot-dialog';
import { WebWidgetDialog } from '../components/web-widget-dialog';

// TODO: Replace with real tenant hook
const useTenant = () => {
  const getTenantId = () => {
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
  
  const tenantId = getTenantId();
  return { tenantId, name: `Tenant ${tenantId.slice(0, 8)}` };
};

export function PlatformsPage() {
  const { tenantId, name: tenantName } = useTenant();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showWhatsAppQR, setShowWhatsAppQR] = useState(false);
  const [showTelegramLogin, setShowTelegramLogin] = useState(false);
  const [showTelegramBot, setShowTelegramBot] = useState(false);
  const [showWebWidget, setShowWebWidget] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);

  const loadPlatforms = useCallback(async () => {
    setLoading(true);
    const result = await fetchPlatforms(tenantId);
    if (result.ok && result.platforms) {
      setPlatforms(result.platforms);
    }
    setLoading(false);
  }, [tenantId]);

  const refreshPlatforms = async () => {
    setRefreshing(true);
    await loadPlatforms();
    setRefreshing(false);
  };

  useEffect(() => {
    loadPlatforms();
  }, [loadPlatforms]);

  const handleAddPlatform = (type: PlatformType) => {
    setShowAddDialog(false);
    
    switch (type) {
      case 'whatsapp':
        setShowWhatsAppQR(true);
        break;
      case 'telegram':
        // Open Telegram login dialog with GramJS phone auth
        setShowTelegramLogin(true);
        break;
      case 'telegram-bot':
        setShowTelegramBot(true);
        break;
      case 'widget':
        setShowWebWidget(true);
        break;
      case 'facebook':
        // Redirect to Facebook OAuth
        window.location.href = `/api/tenants/${tenantId}/facebook/platforms/facebook/login`;
        break;
    }
  };

  const getPlatformIcon = (type: PlatformType) => {
    switch (type) {
      case 'whatsapp': return <MessageSquare className="w-6 h-6 text-green-600" />;
      case 'telegram': return <Send className="w-6 h-6 text-blue-500" />;
      case 'telegram-bot': return <Bot className="w-6 h-6 text-blue-600" />;
      case 'widget': return <Globe className="w-6 h-6 text-purple-600" />;
      case 'facebook': return <Facebook className="w-6 h-6 text-blue-700" />;
      default: return <Globe className="w-6 h-6" />;
    }
  };

  const getStatusBadge = (status: Platform['status']) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500 hover:bg-green-600">已连接</Badge>;
      case 'connecting':
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            连接中
          </Badge>
        );
      case 'error':
        return <Badge variant="destructive">错误</Badge>;
      default:
        return <Badge variant="outline">未连接</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <RefreshCw className="w-12 h-12 mx-auto text-primary animate-spin" />
          <p className="text-muted-foreground">加载平台列表...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center px-6">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold">平台集成管理</h1>

          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">
              当前工作区：<span className="font-medium text-foreground">{tenantName}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshPlatforms}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? '刷新中...' : '刷新'}
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              添加平台
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {platforms.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Globe className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">暂无已连接的平台</h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                点击右上角"添加平台"按钮，开始连接 WhatsApp、Telegram 等多渠道平台，
                实现全渠道客户沟通。
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                添加第一个平台
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {platforms.map((platform) => (
              <Card key={platform.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        {getPlatformIcon(platform.type)}
                      </div>
                      <div>
                        <CardTitle className="text-base">{platform.displayName}</CardTitle>
                        <CardDescription className="text-xs">
                          {platform.description || '多渠道消息平台'}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">状态：</span>
                    {getStatusBadge(platform.status)}
                  </div>

                  {/* Platform-specific info */}
                  {platform.status === 'connected' && platform.meta && (
                    <div className="space-y-2 text-sm">
                      {platform.meta.phoneNumber && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">手机号：</span>
                          <span className="font-medium">{platform.meta.phoneNumber}</span>
                        </div>
                      )}
                      {platform.meta.username && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">用户名：</span>
                          <span className="font-medium">@{platform.meta.username}</span>
                        </div>
                      )}
                      {platform.meta.botUsername && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Bot：</span>
                          <span className="font-medium">@{platform.meta.botUsername}</span>
                        </div>
                      )}
                      {platform.meta.pageName && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">页面：</span>
                          <span className="font-medium">{platform.meta.pageName}</span>
                        </div>
                      )}
                      {platform.meta.lastHeartbeat && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">最后活动：</span>
                          <span className="text-xs">
                            {new Date(platform.meta.lastHeartbeat).toLocaleString('zh-CN')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    {platform.status === 'connected' ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setSelectedPlatform(platform);
                            // Open manage dialog based on type
                            if (platform.type === 'widget') {
                              setShowWebWidget(true);
                            }
                          }}
                        >
                          管理
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1"
                          onClick={async () => {
                            // TODO: Call disconnect API
                            // await disconnectPlatform(platform.type, tenantId);
                            await refreshPlatforms();
                          }}
                        >
                          断开连接
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleAddPlatform(platform.type)}
                      >
                        连接
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddPlatformDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSelectPlatform={handleAddPlatform}
      />

      <WhatsAppQRDialog
        open={showWhatsAppQR}
        onOpenChange={setShowWhatsAppQR}
        onConnected={refreshPlatforms}
        tenantId={tenantId}
      />

      <TelegramLoginDialog
        open={showTelegramLogin}
        onOpenChange={setShowTelegramLogin}
        onConnected={refreshPlatforms}
        tenantId={tenantId}
      />

      <TelegramBotDialog
        open={showTelegramBot}
        onOpenChange={setShowTelegramBot}
        onConnected={refreshPlatforms}
        tenantId={tenantId}
      />

      <WebWidgetDialog
        open={showWebWidget}
        onOpenChange={setShowWebWidget}
        platform={selectedPlatform}
        tenantId={tenantId}
      />
    </div>
  );
}
