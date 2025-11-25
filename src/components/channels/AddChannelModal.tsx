// @ts-nocheck
// src/components/channels/AddChannelModal.tsx

'use client';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../common/components/ui/dialog';
import { Button } from '../../common/components/ui/button';
import { Input } from '../../common/components/ui/input';
import { Label } from '../../common/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../common/components/ui/select';
import { Channel, ChannelType } from '@/types/channel';
import {
  createWhatsAppChannel,
  createTelegramChannel,
  createChannel,
  initializeWhatsApp,
  requestTelegramCode,
  submitTelegramCode,
  generateChannelId,
  ChannelType as ApiChannelType
} from '@/api/channels';
import { useToast } from '@/core/hooks/use-toast';
import { AlertCircle, Loader2 } from 'lucide-react';
import QRCode from 'react-qr-code';
import { io } from 'socket.io-client';

interface AddChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (channel: Channel) => void;
}

export function AddChannelModal({ isOpen, onClose, onAdd }: AddChannelModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ChannelType | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // WhatsApp 相关状态
  const [showWhatsAppSetup, setShowWhatsAppSetup] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('connecting');
  
  // Telegram 相关状态
  const [showTelegramSetup, setShowTelegramSetup] = useState(false);
  const [telegramPhone, setTelegramPhone] = useState('');
  const [telegramCode, setTelegramCode] = useState('');
  const [telegramApiId, setTelegramApiId] = useState('');
  const [telegramApiHash, setTelegramApiHash] = useState('');
  const [telegramStep, setTelegramStep] = useState<'config' | 'phone' | 'code' | 'connecting'>('config');
  
  // WeChat/WeCom config
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [token, setToken] = useState('');
  const [encodingAESKey, setEncodingAESKey] = useState('');
  const [corpId, setCorpId] = useState('');
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();

  const resetForm = () => {
    setName('');
    setType('');
    setError(null);
    setShowWhatsAppSetup(false);
    setShowTelegramSetup(false);
    setQrCode(null);
    setConnectionStatus('connecting');
    setTelegramPhone('');
    setTelegramCode('');
    setTelegramApiId('');
    setTelegramApiHash('');
    setTelegramStep('config');
    setAppId('');
    setAppSecret('');
    setToken('');
    setEncodingAESKey('');
    setCorpId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🚀 开始提交表单', { name, type });
    
    if (!name || !type) {
      setError('请填写渠道名称和类型');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      if (type === 'whatsapp') {
        console.log('🔥 开始创建WhatsApp渠道');
        await handleWhatsAppSetup();
      } else if (type === 'telegram-bot') {
        setShowTelegramSetup(true);
        setIsLoading(false);
        return;
      } else {
        // 其他渠道类型的处理
        const channelId = generateChannelId(type as ApiChannelType);

        let config = {};
        if (type === 'wechat') {
          config = { appId, appSecret, token, encodingAESKey };
        } else if (type === 'wecom') {
          config = { corpId, agentId: appId, secret: appSecret, token, encodingAESKey };
        }

        // Call API to create channel
        await createChannel({
          channelId,
          name,
          channelType: type as ApiChannelType,
          config,
          isActive: true
        });

        const newChannel: Channel = {
          id: channelId,
          name,
          type: type as ChannelType,
          status: 'disconnected' as const,
          config,
          agentCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        onAdd(newChannel);
        toast({
          title: "渠道创建成功",
          description: `${name} 渠道已创建`
        });
        resetForm();
        onClose();
      }
    } catch (err: any) {
      console.error('创建渠道失败:', err);
      if (err.message?.includes('Channel limit reached') || err.response?.data?.code === 'LIMIT_REACHED') {
        setShowUpgradeDialog(true);
        return;
      }
      setError(err instanceof Error ? err.message : '创建渠道失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWhatsAppSetup = async () => {
    const channelId = generateChannelId('whatsapp');
    console.log('📱 开始WhatsApp设置', { channelId, name });
    
    try {
      // 创建 WhatsApp 渠道
      console.log('🔧 调用createWhatsAppChannel API');
      const response = await createWhatsAppChannel(channelId, name);
      console.log('📋 创建渠道API响应:', response);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to create WhatsApp channel');
      }

      // 创建前端渠道对象
      const newChannel: Channel = {
        id: channelId,
        name,
        type: 'whatsapp',
        status: 'connecting' as const,
        config: {},
        agentCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      console.log('✅ 设置WhatsApp模态状态');
      setShowWhatsAppSetup(true);
      setConnectionStatus('connecting');

      // 建立 WebSocket 连接监听 QR 码更新
      console.log('🔌 初始化WebSocket连接');
      initializeWhatsAppConnection(channelId);

      // 通知父组件
      onAdd(newChannel);
      
      toast({
        title: "WhatsApp 渠道创建成功",
        description: "正在初始化连接，请扫描二维码"
      });
      
    } catch (error) {
      console.error('❌ handleWhatsAppSetup错误:', error);
      throw new Error(`WhatsApp 渠道创建失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const initializeWhatsAppConnection = async (channelId: string) => {
    try {
      // 建立 WebSocket 连接
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');
      const socketUrl = API_BASE_URL.replace('/api', '');
      console.log(`🔌 连接WebSocket: ${socketUrl}`);
      const socket = io(socketUrl);

      // 监听连接状态
      socket.on('connect', () => {
        console.log('✅ WebSocket已连接');
        // 加入特定渠道的房间
        socket.emit('join-channel', channelId);
        console.log(`🔌 加入WebSocket房间: channel-${channelId}`);
      });

      socket.on('disconnect', () => {
        console.log('🔌 WebSocket已断开');
      });

      // 监听二维码更新
      socket.on('qr-updated', (data: { channelId: string; qrCode: string }) => {
        console.log('📱 收到QR码更新:', data);
        if (data.channelId === channelId) {
          setQrCode(data.qrCode);
          setConnectionStatus('waiting_for_scan');
        }
      });

      // 监听连接状态变化
      socket.on('connection-updated', (data: { channelId: string; status: string; user?: { name?: string; id?: string } }) => {
        console.log('🔗 收到连接状态更新:', data);
        if (data.channelId === channelId) {
          setConnectionStatus(data.status);
          
          if (data.status === 'connected') {
            setQrCode(null);
            toast({
              title: "WhatsApp 连接成功",
              description: `已连接到 ${data.user?.name || 'WhatsApp'}`
            });
            
            setTimeout(() => {
              resetForm();
              onClose();
            }, 2000);
          }
        }
      });

      // 监听错误
      socket.on('error', (data: { channelId: string; error: string }) => {
        console.log('❌ 收到错误:', data);
        if (data.channelId === channelId) {
          console.error('WhatsApp 连接错误:', data.error);
          setError(data.error);
          setConnectionStatus('error');
        }
      });

      // 初始化连接
      const response = await fetch(`${API_BASE_URL}/api/channels/${channelId}/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initialize WhatsApp connection');
      }

      return socket;
      
    } catch (error) {
      console.error('WhatsApp 连接初始化失败:', error);
      setError(error instanceof Error ? error.message : '连接失败');
      setConnectionStatus('error');
    }
  };

  const handleTelegramSetup = async () => {
    if (telegramStep === 'config') {
      if (!telegramApiId || !telegramApiHash) {
        setError('请输入 Telegram API ID 和 API Hash');
        return;
      }
      setTelegramStep('phone');
    } else if (telegramStep === 'phone') {
      if (!telegramPhone) {
        setError('请输入手机号');
        return;
      }
      
      setIsLoading(true);
      try {
        const channelId = generateChannelId('telegram-user');
        
        // 创建 Telegram 渠道
        const response = await createTelegramChannel(
          channelId, 
          name, 
          parseInt(telegramApiId), 
          telegramApiHash
        );
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to create Telegram channel');
        }

        // 请求验证码
        await requestTelegramCode(channelId, telegramPhone);

        // 创建前端渠道对象
        const newChannel: Channel = {
          id: channelId,
          name,
          type: 'telegram-bot',
          status: 'connecting' as const,
          config: {},
          agentCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        onAdd(newChannel);
        setTelegramStep('code');
        
        toast({
          title: "Telegram 渠道创建成功",
          description: "验证码已发送，请输入验证码"
        });
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Telegram 设置失败');
      } finally {
        setIsLoading(false);
      }
    } else if (telegramStep === 'code') {
      if (!telegramCode) {
        setError('请输入验证码');
        return;
      }
      
      setIsLoading(true);
      try {
        // 这里需要获取正确的 channelId，现在简单生成一个
        const channelId = generateChannelId('telegram-user');
        await submitTelegramCode(channelId, telegramCode);
        
        setTelegramStep('connecting');
        
        toast({
          title: "Telegram 连接成功",
          description: "渠道已成功连接"
        });
        
        setTimeout(() => {
          resetForm();
          onClose();
        }, 2000);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : '验证码验证失败');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const renderWhatsAppSetup = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-medium">WhatsApp 连接设置</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {connectionStatus === 'connecting' && '正在生成二维码...'}
          {connectionStatus === 'waiting_for_scan' && '请使用 WhatsApp 扫描二维码'}
          {connectionStatus === 'connected' && '连接成功！'}
          {connectionStatus === 'error' && '连接失败'}
        </p>
      </div>
      
      {qrCode && connectionStatus === 'waiting_for_scan' && (
        <div className="flex justify-center p-4 bg-white rounded-lg">
          <QRCode value={qrCode} size={200} />
        </div>
      )}
      
      {connectionStatus === 'connecting' && (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}
      
      {connectionStatus === 'connected' && (
        <div className="text-center text-green-600">
          <div className="text-2xl mb-2">✅</div>
          <p>WhatsApp 已成功连接！</p>
        </div>
      )}
      
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={() => setShowWhatsAppSetup(false)} disabled={isLoading}>
          返回
        </Button>
        {connectionStatus === 'error' && (
          <Button onClick={() => initializeWhatsAppConnection(generateChannelId('whatsapp'))}>
            重试
          </Button>
        )}
      </div>
    </div>
  );

  const renderTelegramSetup = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-medium">Telegram 连接设置</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {telegramStep === 'config' && '请输入 Telegram API 配置'}
          {telegramStep === 'phone' && '请输入手机号'}
          {telegramStep === 'code' && '请输入验证码'}
          {telegramStep === 'connecting' && '正在连接...'}
        </p>
      </div>
      
      {telegramStep === 'config' && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="apiId">API ID</Label>
            <Input
              id="apiId"
              value={telegramApiId}
              onChange={(e) => setTelegramApiId(e.target.value)}
              placeholder="输入 Telegram API ID"
            />
          </div>
          <div>
            <Label htmlFor="apiHash">API Hash</Label>
            <Input
              id="apiHash"
              value={telegramApiHash}
              onChange={(e) => setTelegramApiHash(e.target.value)}
              placeholder="输入 Telegram API Hash"
            />
          </div>
        </div>
      )}
      
      {telegramStep === 'phone' && (
        <div>
          <Label htmlFor="phone">手机号</Label>
          <Input
            id="phone"
            value={telegramPhone}
            onChange={(e) => setTelegramPhone(e.target.value)}
            placeholder="输入手机号（包含国家代码）"
          />
        </div>
      )}
      
      {telegramStep === 'code' && (
        <div>
          <Label htmlFor="code">验证码</Label>
          <Input
            id="code"
            value={telegramCode}
            onChange={(e) => setTelegramCode(e.target.value)}
            placeholder="输入验证码"
          />
        </div>
      )}
      
      {telegramStep === 'connecting' && (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}
      
      <div className="flex justify-end space-x-2">
        <Button 
          variant="outline" 
          onClick={() => telegramStep === 'config' ? setShowTelegramSetup(false) : setTelegramStep('config')} 
          disabled={isLoading}
        >
          返回
        </Button>
        <Button onClick={handleTelegramSetup} disabled={isLoading}>
          {telegramStep === 'config' && '下一步'}
          {telegramStep === 'phone' && '发送验证码'}
          {telegramStep === 'code' && '验证'}
        </Button>
      </div>
    </div>
  );

  if (showUpgradeDialog) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upgrade Plan Required</DialogTitle>
            <DialogDescription>
              You have reached the maximum number of channels for your current plan. Please upgrade to add more channels.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => {
              onClose();
              navigate('/pricing');
            }}>
              View Pricing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (showWhatsAppSetup) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加 WhatsApp 渠道</DialogTitle>
          </DialogHeader>
          {renderWhatsAppSetup()}
        </DialogContent>
      </Dialog>
    );
  }

  if (showTelegramSetup) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加 Telegram 渠道</DialogTitle>
          </DialogHeader>
          {renderTelegramSetup()}
          {error && (
            <div className="bg-red-50 p-3 rounded-md">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>添加新渠道</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">渠道名称</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入渠道名称"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="type">渠道类型</Label>
            <Select value={type} onValueChange={(value) => setType(value as ChannelType)}>
              <SelectTrigger>
                <SelectValue placeholder="选择渠道类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="telegram-bot">Telegram</SelectItem>
                <SelectItem value="web-widget">Web 聊天</SelectItem>
                <SelectItem value="facebook-messenger">Facebook Messenger</SelectItem>
                <SelectItem value="wechat">微信公众号</SelectItem>
                <SelectItem value="wecom">企业微信</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === 'wechat' && (
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium">微信公众号配置</h4>
              <div>
                <Label htmlFor="appId">AppID</Label>
                <Input id="appId" value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="开发者ID(AppID)" />
              </div>
              <div>
                <Label htmlFor="appSecret">AppSecret</Label>
                <Input id="appSecret" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="开发者密码(AppSecret)" />
              </div>
              <div>
                <Label htmlFor="token">Token</Label>
                <Input id="token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="令牌(Token)" />
              </div>
              <div>
                <Label htmlFor="encodingAESKey">EncodingAESKey</Label>
                <Input id="encodingAESKey" value={encodingAESKey} onChange={(e) => setEncodingAESKey(e.target.value)} placeholder="消息加解密密钥" />
              </div>
            </div>
          )}

          {type === 'wecom' && (
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium">企业微信配置</h4>
              <div>
                <Label htmlFor="corpId">CorpID</Label>
                <Input id="corpId" value={corpId} onChange={(e) => setCorpId(e.target.value)} placeholder="企业ID" />
              </div>
              <div>
                <Label htmlFor="agentId">AgentID</Label>
                <Input id="agentId" value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="应用ID" />
              </div>
              <div>
                <Label htmlFor="secret">Secret</Label>
                <Input id="secret" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="应用Secret" />
              </div>
              <div>
                <Label htmlFor="token">Token</Label>
                <Input id="token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="令牌(Token)" />
              </div>
              <div>
                <Label htmlFor="encodingAESKey">EncodingAESKey</Label>
                <Input id="encodingAESKey" value={encodingAESKey} onChange={(e) => setEncodingAESKey(e.target.value)} placeholder="消息加解密密钥" />
              </div>
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 p-3 rounded-md">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  创建中...
                </>
              ) : (
                '创建渠道'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
// @ts-nocheck
