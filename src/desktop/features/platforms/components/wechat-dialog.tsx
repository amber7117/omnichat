import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/common/components/ui/dialog';
import { Button } from '@/common/components/ui/button';
import { Input } from '@/common/components/ui/input';
import { Label } from '@/common/components/ui/label';
import { Alert, AlertDescription } from '@/common/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { connectWeChat } from '@/api/platforms';

interface WeChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
  tenantId: string;
}

export function WeChatDialog({ open, onOpenChange, onConnected, tenantId }: WeChatDialogProps) {
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [token, setToken] = useState('');
  const [encodingAESKey, setEncodingAESKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleConnect = async () => {
    if (!appId || !appSecret || !token || !encodingAESKey) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    const result = await connectWeChat({ appId, appSecret, token, encodingAESKey }, tenantId);
    
    if (result.ok) {
      onConnected();
      onOpenChange(false);
      resetForm();
    } else {
      setError(result.error || 'Connection failed');
    }
    
    setLoading(false);
  };

  const resetForm = () => {
    setAppId('');
    setAppSecret('');
    setToken('');
    setEncodingAESKey('');
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect WeChat Official Account</DialogTitle>
          <DialogDescription>
            Enter your WeChat Official Account details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="appId">AppID</Label>
            <Input
              id="appId"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="appSecret">AppSecret</Label>
            <Input
              id="appSecret"
              type="password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="token">Token</Label>
            <Input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="encodingAESKey">EncodingAESKey</Label>
            <Input
              id="encodingAESKey"
              value={encodingAESKey}
              onChange={(e) => setEncodingAESKey(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
