// ✅ Telegram User Login Dialog - Phone number login with GramJS
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/common/components/ui/dialog';
import { Button } from '@/common/components/ui/button';
import { Input } from '@/common/components/ui/input';
import { Label } from '@/common/components/ui/label';
import { Alert, AlertDescription } from '@/common/components/ui/alert';
import { Loader2, CheckCircle } from 'lucide-react';
import { sendTelegramCode, verifyTelegramCode, verifyTelegram2FA } from '@/api/platforms';

interface TelegramLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
  tenantId: string;
}

type LoginStep = 'phone' | 'code' | '2fa' | 'success';

export function TelegramLoginDialog({ 
  open, 
  onOpenChange, 
  onConnected, 
  tenantId 
}: TelegramLoginDialogProps) {
  const [step, setStep] = useState<LoginStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password2FA, setPassword2FA] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [channelId, setChannelId] = useState('');

  const handleSendCode = async () => {
    const normalized = phoneNumber.replace(/\s+/g, '').trim();
    if (!normalized) {
      setError('请输入手机号');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await sendTelegramCode(normalized, tenantId, channelId || undefined);
      
      if (response.ok && response.phoneCodeHash && response.channelId) {
        setPhoneCodeHash(response.phoneCodeHash);
        setChannelId(response.channelId);
        setStep('code');
      } else {
        setError(response.error || '发送验证码失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送验证码失败');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      setError('请输入验证码');
      return;
    }
    const normalizedPhone = phoneNumber.replace(/\s+/g, '').trim();

    setLoading(true);
    setError('');

    try {
      const response = await verifyTelegramCode(
        channelId,
        normalizedPhone,
        phoneCodeHash,
        verificationCode,
        tenantId
      );
      
      if (response.ok) {
        // Successfully connected
        setStep('success');
        setTimeout(() => {
          onConnected();
          onOpenChange(false);
          resetForm();
        }, 1500);
      } else {
        const errMsg = response.error || '验证失败';
        setError(errMsg);
        // 特殊错误处理
        if (errMsg.toUpperCase().includes('EXPIRED')) {
          setVerificationCode('');
        }
        if (errMsg.toUpperCase().includes('INVALID')) {
          setVerificationCode('');
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '验证失败';
      setError(msg);
      if (msg.toUpperCase().includes('EXPIRED')) {
        setVerificationCode('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    const normalized = phoneNumber.replace(/\s+/g, '').trim();
    if (!normalized) {
      setError('请先填写手机号');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await sendTelegramCode(normalized, tenantId, channelId || undefined);
      if (response.ok && response.phoneCodeHash && response.channelId) {
        setPhoneCodeHash(response.phoneCodeHash);
        setChannelId(response.channelId);
        setVerificationCode('');
        setStep('code');
      } else {
        setError(response.error || '重新发送失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '重新发送失败');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!password2FA.trim()) {
      setError('请输入两步验证密码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await verifyTelegram2FA(channelId, password2FA, tenantId);
      
      if (response.ok) {
        setStep('success');
        setTimeout(() => {
          onConnected();
          onOpenChange(false);
          resetForm();
        }, 1500);
      } else {
        setError(response.error || '验证失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证失败');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep('phone');
    setPhoneNumber('');
    setVerificationCode('');
    setPassword2FA('');
    setError('');
    setPhoneCodeHash('');
    setChannelId('');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>登录 Telegram</DialogTitle>
          <DialogDescription>
            {step === 'phone' && '输入您的手机号以接收验证码'}
            {step === 'code' && '输入发送到您手机的验证码'}
            {step === '2fa' && '输入您的两步验证密码'}
            {step === 'success' && '登录成功！'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Step 1: Phone Number */}
          {step === 'phone' && (
            <div className="space-y-2">
              <Label htmlFor="phone">手机号</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+86 138 0000 0000"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                请输入完整的国际格式手机号，例如：+86 138 0000 0000
              </p>
            </div>
          )}

          {/* Step 2: Verification Code */}
          {step === 'code' && (
            <div className="space-y-2">
              <Label htmlFor="code">验证码</Label>
              <Input
                id="code"
                type="text"
                placeholder="12345"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                disabled={loading}
                maxLength={5}
              />
              <p className="text-xs text-muted-foreground">
                验证码已发送到 {phoneNumber}
              </p>
              <div className="text-xs">
                <Button variant="link" type="button" onClick={handleResendCode} disabled={loading}>
                  重新发送验证码
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: 2FA Password */}
          {step === '2fa' && (
            <div className="space-y-2">
              <Label htmlFor="password">两步验证密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="输入您的两步验证密码"
                value={password2FA}
                onChange={(e) => setPassword2FA(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                您的账号启用了两步验证，请输入密码
              </p>
            </div>
          )}

          {/* Success State */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mb-3" />
              <p className="text-lg font-semibold text-green-600">登录成功！</p>
              <p className="text-sm text-muted-foreground mt-2">
                正在跳转...
              </p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        {step !== 'success' && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              取消
            </Button>
            {step === 'phone' && (
              <Button onClick={handleSendCode} disabled={loading || !phoneNumber.trim()}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                发送验证码
              </Button>
            )}
            {step === 'code' && (
              <Button onClick={handleVerifyCode} disabled={loading || !verificationCode.trim()}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                验证
              </Button>
            )}
            {step === '2fa' && (
              <Button onClick={handleVerify2FA} disabled={loading || !password2FA.trim()}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                确认
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
