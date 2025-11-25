// ✅ Add Platform Dialog - Select platform type
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/common/components/ui/dialog';
import { Card } from '@/common/components/ui/card';
import { Button } from '@/common/components/ui/button';
import { MessageSquare, Send, Bot, Globe, Facebook, MessageCircle, Building2, Smartphone } from 'lucide-react';
import type { PlatformType } from '@/types/platform';

interface AddPlatformDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPlatform: (type: PlatformType) => void;
}

const PLATFORM_OPTIONS = [
  {
    type: 'whatsapp' as PlatformType,
    name: 'WhatsApp Business',
    description: '通过 WhatsApp 与客户实时沟通',
    icon: MessageSquare,
    iconColor: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    type: 'telegram' as PlatformType,
    name: 'Telegram',
    description: '连接您的 Telegram 个人账号',
    icon: Send,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
  },
  {
    type: 'telegram-bot' as PlatformType,
    name: 'Telegram Bot',
    description: '使用 Bot Token 接入 Telegram',
    icon: Bot,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    type: 'widget' as PlatformType,
    name: 'Web Widget',
    description: '嵌入式网页客服组件',
    icon: Globe,
    iconColor: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    type: 'facebook' as PlatformType,
    name: 'Facebook Messenger',
    description: '连接 Facebook 页面消息',
    icon: Facebook,
    iconColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
  },
  {
    type: 'wechat' as PlatformType,
    name: 'WeChat Official Account',
    description: '连接微信公众号',
    icon: MessageCircle,
    iconColor: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    type: 'wecom' as PlatformType,
    name: 'WeCom',
    description: '连接企业微信',
    icon: Building2,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    type: 'wechaty' as PlatformType,
    name: 'Personal WeChat',
    description: '扫码登录个人微信 (Wechaty)',
    icon: Smartphone,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
  },
];

export function AddPlatformDialog({ open, onOpenChange, onSelectPlatform }: AddPlatformDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>添加新平台</DialogTitle>
          <DialogDescription>
            选择您要连接的消息平台类型
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {PLATFORM_OPTIONS.map((platform) => {
            const Icon = platform.icon;
            return (
              <Card
                key={platform.type}
                className="p-4 cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary"
                onClick={() => onSelectPlatform(platform.type)}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-3 rounded-lg ${platform.bgColor}`}>
                    <Icon className={`w-6 h-6 ${platform.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm mb-1">{platform.name}</h3>
                    <p className="text-xs text-muted-foreground">{platform.description}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPlatform(platform.type);
                  }}
                >
                  选择
                </Button>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
