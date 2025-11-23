// ✅ Web Widget Dialog - Show/Generate embed code
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/common/components/ui/dialog';
import { Button } from '@/common/components/ui/button';
import { Alert, AlertDescription } from '@/common/components/ui/alert';
import { Loader2, Copy, CheckCircle } from 'lucide-react';
import { Textarea } from '@/common/components/ui/textarea';
import { generateWidget } from '@/api/platforms';
import type { Platform } from '@/types/platform';

interface WebWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: Platform | null;
  tenantId: string;
}

export function WebWidgetDialog({ open, onOpenChange, platform, tenantId }: WebWidgetDialogProps) {
  const [embedCode, setEmbedCode] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');

    const result = await generateWidget(tenantId);
    
    if (result.ok && result.platform?.meta?.embedCode) {
      setEmbedCode(result.platform.meta.embedCode);
    } else {
      setError(result.error || '生成失败');
    }
    
    setLoading(false);
  };

  useEffect(() => {
    if (open && platform?.meta?.embedCode) {
      setEmbedCode(platform.meta.embedCode);
    } else if (open && !platform) {
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, platform]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('复制失败');
    }
  };

  const handleClose = () => {
    setEmbedCode('');
    setError('');
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Web Widget 嵌入代码</DialogTitle>
          <DialogDescription>
            将以下代码复制并粘贴到您网站的 HTML 中
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">正在生成嵌入代码...</p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {embedCode && !loading && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">嵌入代码</label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    disabled={copied}
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        复制代码
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  value={embedCode}
                  readOnly
                  rows={8}
                  className="font-mono text-xs"
                />
              </div>

              <Alert>
                <AlertDescription className="text-xs space-y-2">
                  <p className="font-medium">使用说明：</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>复制上面的嵌入代码</li>
                    <li>粘贴到您网站的 HTML 中，建议放在 &lt;/body&gt; 标签之前</li>
                    <li>保存并发布您的网站</li>
                    <li>客服小组件将自动显示在网页右下角</li>
                  </ol>
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleGenerate} className="flex-1">
                  重新生成
                </Button>
                <Button onClick={handleClose} className="flex-1">
                  完成
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
