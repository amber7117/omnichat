import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/common/components/ui/dialog';
import { Button } from '@/common/components/ui/button';
import { Input } from '@/common/components/ui/input';
import { Label } from '@/common/components/ui/label';
import { Alert, AlertDescription } from '@/common/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { connectWeCom } from '@/api/platforms';

interface WeComDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
  tenantId: string;
}

export function WeComDialog({ open, onOpenChange, onConnected, tenantId }: WeComDialogProps) {
  const [corpId, setCorpId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [encodingAESKey, setEncodingAESKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleConnect = async () => {
    if (!corpId || !agentId || !secret || !token || !encodingAESKey) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    const result = await connectWeCom({ corpId, agentId, secret, token, encodingAESKey }, tenantId);
    
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
    setCorpId('');
    setAgentId('');
    setSecret('');
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
          <DialogTitle>Connect WeCom (Enterprise WeChat)</DialogTitle>
          <DialogDescription>
            Enter your WeCom application details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="corpId">CorpID</Label>
            <Input
              id="corpId"
              value={corpId}
              onChange={(e) => setCorpId(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agentId">AgentID</Label>
            <Input
              id="agentId"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secret">Secret</Label>
            <Input
              id="secret"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
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
