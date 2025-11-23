// ✅ Telegram Bot Dialog - Input bot token
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/common/components/ui/dialog';
import { Button } from '@/common/components/ui/button';
import { Input } from '@/common/components/ui/input';
import { Label } from '@/common/components/ui/label';
import { Alert, AlertDescription } from '@/common/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { connectTelegramBot } from '@/api/platforms';

interface TelegramBotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
  tenantId: string;
}

export function TelegramBotDialog({ open, onOpenChange, onConnected, tenantId }: TelegramBotDialogProps) {
  const [botToken, setBotToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleConnect = async () => {
    if (!botToken.trim()) {
      setError('请输入 Bot Token');
      return;
    }

    setLoading(true);
    setError('');

    const result = await connectTelegramBot(botToken, tenantId);
    
    if (result.ok) {
      onConnected();
      onOpenChange(false);
      setBotToken('');
    } else {
      setError(result.error || '连接失败');
    }
    
    setLoading(false);
  };

  const handleClose = () => {
    setBotToken('');
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>连接 Telegram Bot</DialogTitle>
          <DialogDescription>
            输入您的 Telegram Bot Token 以连接机器人
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="bot-token">Bot Token</Label>
            <Input
              id="bot-token"
              type="password"
              placeholder="110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              从 @BotFather 获取您的 Bot Token
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg bg-muted p-3 text-xs space-y-2">
            <p className="font-medium">如何获取 Bot Token：</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>在 Telegram 中搜索 @BotFather</li>
              <li>发送 /newbot 创建新机器人</li>
              <li>按照提示设置机器人名称</li>
              <li>复制 BotFather 返回的 Token</li>
            </ol>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleConnect} disabled={loading || !botToken.trim()}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            连接
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
