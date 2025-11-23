// src/components/channels/EditChannelModal.tsx

'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../common/components/ui/dialog';
import { Button } from '../../common/components/ui/button';
import { Input } from '../../common/components/ui/input';
import { Label } from '../../common/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../common/components/ui/select';
import { Textarea } from '../../common/components/ui/textarea';
import { Platform } from '@/types/platform';
import { updateChannel } from '../../lib/api';
import { useToast } from '@/core/hooks/use-toast';
import { AlertCircle, Settings, Wifi } from 'lucide-react';

interface EditChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Platform | null;
  onUpdate: (channel: Platform) => void;
}

export function EditChannelModal({ isOpen, onClose, channel, onUpdate }: EditChannelModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('');
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (channel && isOpen) {
      setName(channel.name);
      setType(channel.type);
      setConfig(channel.config || {});
      setError(null);
    }
  }, [channel, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channel || !name) {
      setError('请填写渠道名称');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const updatedChannel = await updateChannel(channel.id, {
        name,
        config,
      });
      
      // Map channel type to platform type if needed
      const mappedChannel: Platform = {
        ...updatedChannel,
        type: updatedChannel.type === 'web-widget' ? 'widget' : 
              updatedChannel.type === 'telegram-user' ? 'telegram' : 
              updatedChannel.type as Platform['type']
      };
      
      onUpdate(mappedChannel);
      toast({
        title: "更新成功",
        description: "渠道更新成功",
        variant: "default"
      });
      
      onClose();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '更新渠道失败，请重试';
      setError(errorMessage);
      toast({
        title: "更新失败",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setError(null);
      onClose();
    }
  };

  const updateConfig = (key: string, value: unknown) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const renderChannelSpecificConfig = () => {
    switch (type) {
      case 'whatsapp':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">手机号</Label>
              <Input
                id="phoneNumber"
                value={(config.phoneNumber as string) || ''}
                onChange={(e) => updateConfig('phoneNumber', e.target.value)}
                placeholder="输入手机号"
                disabled={isLoading}
              />
            </div>
          </div>
        );
      
      case 'telegram-bot':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="botToken">Bot Token</Label>
              <Input
                id="botToken"
                type="password"
                value={(config.botToken as string) || ''}
                onChange={(e) => updateConfig('botToken', e.target.value)}
                placeholder="输入Telegram Bot Token"
                disabled={isLoading}
              />
            </div>
          </div>
        );
      
      case 'web-widget':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">组件标题</Label>
              <Input
                id="title"
                value={(config.title as string) || ''}
                onChange={(e) => updateConfig('title', e.target.value)}
                placeholder="Web组件标题"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="welcomeMessage">欢迎消息</Label>
              <Textarea
                id="welcomeMessage"
                value={(config.welcomeMessage as string) || ''}
                onChange={(e) => updateConfig('welcomeMessage', e.target.value)}
                placeholder="欢迎消息内容"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryColor">主色调</Label>
              <Input
                id="primaryColor"
                type="color"
                value={(config.primaryColor as string) || '#007bff'}
                onChange={(e) => updateConfig('primaryColor', e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">组件位置</Label>
              <Select
                value={(config.position as string) || 'bottom-right'}
                onValueChange={(value) => updateConfig('position', value)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择组件位置" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-right">右下角</SelectItem>
                  <SelectItem value="bottom-left">左下角</SelectItem>
                  <SelectItem value="bottom-center">底部中间</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      
      case 'facebook-messenger':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pageId">页面ID</Label>
              <Input
                id="pageId"
                value={(config.pageId as string) || ''}
                onChange={(e) => updateConfig('pageId', e.target.value)}
                placeholder="Facebook页面ID"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appSecret">应用密钥</Label>
              <Input
                id="appSecret"
                type="password"
                value={(config.appSecret as string) || ''}
                onChange={(e) => updateConfig('appSecret', e.target.value)}
                placeholder="Facebook应用密钥"
                disabled={isLoading}
              />
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  if (!channel) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            编辑渠道
          </DialogTitle>
        </DialogHeader>
        
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">渠道名称 *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入渠道名称"
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label>渠道类型</Label>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
                <Wifi className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium capitalize">{type}</span>
                <span className="text-xs text-gray-500">(不可修改)</span>
              </div>
            </div>
          </div>

          {renderChannelSpecificConfig()}
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || !name}
            >
              {isLoading ? '保存中...' : '保存'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}