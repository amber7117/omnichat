// ✅ Platform Integration Management Page
// Modern multi-tenant SaaS platform connection UI
// Updated: 2025-11-21 - Complete redesign with stats, filters, and enhanced UX

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/common/components/ui/button';
import { Card, CardContent } from '@/common/components/ui/card';
import { Badge } from '@/common/components/ui/badge';
import { Input } from '@/common/components/ui/input';
import {
  Plus,
  RefreshCw,
  Search,
  Activity,
  Zap,
  AlertCircle,
  Globe,
  WifiOff,
  CheckCircle2,
  XCircle,
  Loader2,
  Filter
} from 'lucide-react';
import type { Platform, PlatformType, PlatformStatus } from '@/types/platform';
import { fetchPlatforms, disconnectPlatform, deleteWhatsApp, connectWhatsApp, connectWechaty } from '@/api/platforms';
import { apiDelete } from '@/api/client';
import { AddPlatformDialog } from '../components/add-platform-dialog';
import { WhatsAppQRDialog } from '../components/whatsapp-qr-dialog';
import { TelegramLoginDialog } from '../components/telegram-login-dialog';
import { TelegramBotDialog } from '../components/telegram-bot-dialog';
import { WebWidgetDialog } from '../components/web-widget-dialog';
import { WeChatDialog } from '../components/wechat-dialog';
import { WeComDialog } from '../components/wecom-dialog';
import { WechatyDialog } from '../components/wechaty-dialog';
import { useAuth } from '@/common/features/auth';
import { ChannelCard } from '../../../../components/channels/ChannelCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/common/components/ui/select';

export function PlatformsPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId || 'default-tenant';
  const tenantName = user?.name || user?.email || 'Guest';
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | PlatformType>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | PlatformStatus>('all');

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showWhatsAppQR, setShowWhatsAppQR] = useState(false);
  const [showTelegramLogin, setShowTelegramLogin] = useState(false);
  const [showTelegramBot, setShowTelegramBot] = useState(false);
  const [showWebWidget, setShowWebWidget] = useState(false);
  const [showWeChat, setShowWeChat] = useState(false);
  const [showWeCom, setShowWeCom] = useState(false);
  const [showWechaty, setShowWechaty] = useState(false);
  
  // WhatsApp channel state
  const [whatsAppChannelId, setWhatsAppChannelId] = useState<string>('');
  // Wechaty channel state
  const [wechatyChannelId, setWechatyChannelId] = useState<string>('');

  const loadPlatforms = useCallback(async () => {
    setLoading(true);
    const result = await fetchPlatforms(tenantId);
    if (result.ok && result.platforms) {
      setPlatforms(result.platforms);
    } else {
      console.error('[平台加载] 加载失败:', result.error);
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

  const handleAddPlatform = async (type: PlatformType) => {
    setShowAddDialog(false);

    switch (type) {
      case 'whatsapp':
        // Call backend API to create WhatsApp channel
        try {
          const result = await connectWhatsApp(tenantId);
          if (result.ok && result.platform) {
            // Pass the channelInstanceId to the dialog
            setWhatsAppChannelId(result.platform.id);
            setShowWhatsAppQR(true);
          } else {
            alert(`创建 WhatsApp 渠道失败: ${result.error}`);
          }
        } catch (error) {
          alert(`创建 WhatsApp 渠道失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
        break;
      case 'telegram':
        setShowTelegramLogin(true);
        break;
      case 'telegram-bot':
        setShowTelegramBot(true);
        break;
      case 'widget':
        setShowWebWidget(true);
        break;
      case 'facebook':
        window.location.href = `/api/tenants/${tenantId}/facebook/platforms/facebook/login`;
        break;
      case 'wechat':
        setShowWeChat(true);
        break;
      case 'wecom':
        setShowWeCom(true);
        break;
      case 'wechaty':
        try {
          const result = await connectWechaty(tenantId);
          if (result.ok && result.platform) {
            setWechatyChannelId(result.platform.id);
            setShowWechaty(true);
          } else {
            alert(`创建个人微信渠道失败: ${result.error}`);
          }
        } catch (error) {
          alert(`创建个人微信渠道失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
        break;
    }
  };

  const handleDisconnect = async (channel: Platform) => {
    if (confirm(`确定要断开 ${channel.name} 的连接吗？`)) {
      const result = await disconnectPlatform(
        channel.type as PlatformType,
        channel.id,
        tenantId
      );

      if (result.ok) {
        await refreshPlatforms();
      } else {
        alert(`断开失败: ${result.error}`);
      }
    }
  };

  // Filter and search platforms
  const filteredPlatforms = useMemo(() => {
    return platforms.filter(platform => {
      // Type filter
      if (filterType !== 'all' && platform.type !== filterType) {
        return false;
      }

      // Status filter
      if (filterStatus !== 'all' && platform.status !== filterStatus) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          platform.displayName?.toLowerCase().includes(query) ||
          platform.type.toLowerCase().includes(query) ||
          platform.meta?.phoneNumber?.includes(query)
        );
      }

      return true;
    });
  }, [platforms, filterType, filterStatus, searchQuery]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = platforms.length;
    const connected = platforms.filter(p => p.status === 'connected').length;
    const connecting = platforms.filter(p => p.status === 'connecting').length;
    const error = platforms.filter(p => p.status === 'error').length;
    const disconnected = platforms.filter(p => p.status === 'disconnected').length;

    const byType = platforms.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    }, {} as Record<PlatformType, number>);

    return { total, connected, connecting, error, disconnected, byType };
  }, [platforms]);

  // 转换 Platform 到 Channel 格式
  const channelsFromPlatforms = filteredPlatforms.map(platform => {
    
    // 将后端状态字符串映射为前端状态
    const mapStatus = (backendStatus: string): Platform['status'] => {
      const status = backendStatus?.toLowerCase();
      
      switch (status) {
        case 'connected':
        case 'online':
        case 'open':
        case 'ready':
        case 'authenticated':
          return 'connected';
        case 'connecting':
        case 'initializing':
        case 'authenticating':
        case 'loading':
          return 'connecting';
        case 'error':
        case 'failed':
        case 'timeout':
        case 'unauthorized':
          return 'error';
        case 'disconnected':
        case 'closed':
        case 'offline':
        case 'close':
        case 'logout':
        default:
          return 'disconnected';
      }
    };

    const finalStatus = mapStatus(platform.status || 'disconnected');
    
    return {
      id: platform.id,
      name: platform.displayName || platform.name || platform.type,
      type: platform.type as Platform['type'],
      status: finalStatus,
      config: (platform.meta || {}) as Record<string, unknown>,
      lastActivity: platform.meta?.lastHeartbeat ? new Date(platform.meta.lastHeartbeat) : new Date(),
      agentCount: 0,
      createdAt: new Date(platform.createdAt),
      updatedAt: new Date(platform.updatedAt),
      phoneNumber: platform.meta?.phoneNumber,
      messageCount: 0,
    } as Platform & { phoneNumber?: string; messageCount?: number };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-gray-50/30">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
          <p className="text-muted-foreground">加载平台列表...</p>
        </div>
      </div>
    );
  }

  return (
    // 🔧 这里改成占满整个视口高度 & 宽度
    <div className="flex flex-col min-h-screen w-full bg-gray-50/30">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">渠道管理</h1>
              <p className="text-sm text-muted-foreground mt-1">
                管理您的多渠道连接 • 工作区: <span className="font-medium text-foreground">{tenantName}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshPlatforms}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? '刷新中...' : '刷新'}
              </Button>
              <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                添加平台
              </Button>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">总平台数</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <Activity className="w-8 h-8 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">已连接</p>
                    <p className="text-2xl font-bold text-green-600">{stats.connected}</p>
                  </div>
                  <CheckCircle2 className="w-8 h-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">连接中</p>
                    <p className="text-2xl font-bold text-yellow-600">{stats.connecting}</p>
                  </div>
                  <Loader2 className="w-8 h-8 text-yellow-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">异常</p>
                    <p className="text-2xl font-bold text-red-600">{stats.error}</p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">未连接</p>
                    <p className="text-2xl font-bold text-gray-600">{stats.disconnected}</p>
                  </div>
                  <WifiOff className="w-8 h-8 text-gray-400 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索平台名称、类型或手机号..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
              <SelectTrigger className="w-[160px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="平台类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="telegram">Telegram</SelectItem>
                <SelectItem value="telegram-bot">Telegram Bot</SelectItem>
                <SelectItem value="widget">Web Widget</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="wechat">微信公众号</SelectItem>
                <SelectItem value="wecom">企业微信</SelectItem>
                <SelectItem value="wechaty">个人微信</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
              <SelectTrigger className="w-[140px]">
                <Zap className="w-4 h-4 mr-2" />
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="connected">已连接</SelectItem>
                <SelectItem value="connecting">连接中</SelectItem>
                <SelectItem value="error">异常</SelectItem>
                <SelectItem value="disconnected">未连接</SelectItem>
              </SelectContent>
            </Select>

            <Badge variant="outline" className="ml-auto">
              {filteredPlatforms.length} / {platforms.length} 个平台
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {platforms.length === 0 ? (
          <div className="p-6">
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Globe className="w-20 h-20 text-muted-foreground mb-4 opacity-20" />
                <h3 className="text-xl font-semibold mb-2">暂无已连接的平台</h3>
                <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                  点击右上角"添加平台"按钮，开始连接 WhatsApp、Telegram 等多渠道平台，
                  实现全渠道客户沟通。
                </p>
                <Button onClick={() => setShowAddDialog(true)} size="lg" className="gap-2">
                  <Plus className="w-5 h-5" />
                  添加第一个平台
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : filteredPlatforms.length === 0 ? (
          <div className="p-6">
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <AlertCircle className="w-16 h-16 text-muted-foreground mb-4 opacity-20" />
                <h3 className="text-lg font-semibold mb-2">没有符合条件的平台</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  尝试调整筛选条件或搜索关键词
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterType('all');
                    setFilterStatus('all');
                  }}
                >
                  清除筛选
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {channelsFromPlatforms.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  onDelete={async () => {
                    if (confirm(`确定要删除 ${channel.name} 吗？此操作无法恢复。`)) {
                      try {
                        const result =
                          channel.type === 'whatsapp'
                            ? await deleteWhatsApp(channel.id, false)
                            : await apiDelete<{ ok?: boolean; error?: string }>(`/api/channels/${channel.id}`);

                        if (result && result.ok !== false) {
                          await refreshPlatforms();
                        } else {
                          alert(`删除失败: ${result?.error || '未知错误'}`);
                        }
                      } catch (err) {
                        alert(`删除失败: ${err instanceof Error ? err.message : '未知错误'}`);
                      }
                    }
                  }}
                  onEdit={() => {
                    // TODO: 打开编辑对话框
                    alert('编辑功能开发中...');
                  }}
                  onDisconnect={handleDisconnect}
                />
              ))}
            </div>
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
        onConnected={() => {
          // 立即刷新一次
          refreshPlatforms();
          // 3秒后再刷新一次，确保 Baileys 重连完成
          setTimeout(() => {
            refreshPlatforms();
          }, 3000);
          // 8秒后最后刷新一次，确保状态完全同步
          setTimeout(() => {
            refreshPlatforms();
          }, 8000);
          setShowWhatsAppQR(false);
        }}
        channelInstanceId={whatsAppChannelId}
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
        platform={null}
        tenantId={tenantId}
      />

      <WeChatDialog
        open={showWeChat}
        onOpenChange={setShowWeChat}
        onConnected={refreshPlatforms}
        tenantId={tenantId}
      />

      <WeComDialog
        open={showWeCom}
        onOpenChange={setShowWeCom}
        onConnected={refreshPlatforms}
        tenantId={tenantId}
      />

      <WechatyDialog
        open={showWechaty}
        onOpenChange={setShowWechaty}
        onConnected={() => {
          refreshPlatforms();
          setTimeout(refreshPlatforms, 3000);
          setShowWechaty(false);
        }}
        channelInstanceId={wechatyChannelId}
        tenantId={tenantId}
      />
    </div>
  );
}
