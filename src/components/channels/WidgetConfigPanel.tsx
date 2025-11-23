// @ts-nocheck
// src/components/channels/WidgetConfigPanel.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../common/components/ui/card';
import { Button } from '../../common/components/ui/button';
import { Input } from '../../common/components/ui/input';
import { Label } from '../../common/components/ui/label';
import { Textarea } from '../../common/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../common/components/ui/select';
import { Alert, AlertDescription } from '../../common/components/ui/alert';
import { Loader2, Copy, MessageCircle, Settings } from 'lucide-react';
import { getWidgetConfig, updateWidgetConfig, getWidgetEmbedCode } from '@/lib/api';
import { WidgetConfig, WidgetEmbedCodeResponse } from '@/types/channel';
import { toast } from 'sonner';

interface WidgetConfigPanelProps {
  channelId: string;
}

export function WidgetConfigPanel({ channelId }: WidgetConfigPanelProps) {
  const [config, setConfig] = useState<WidgetConfig>({
    title: 'AI 客服',
    welcomeMessage: '您好！我是 AI 客服，有什么可以帮助您的吗？',
    primaryColor: '#3b82f6',
    position: 'bottom-right',
  });
  const [embedCode, setEmbedCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial config
  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loadedConfig = await getWidgetConfig(channelId);
      setConfig(loadedConfig);
    } catch (err) {
      console.error('加载配置失败:', err);
      setError('加载配置失败，使用默认配置');
    } finally {
      setIsLoading(false);
    }
  }, [channelId]);

  // Load embed code
  const loadEmbedCode = useCallback(async () => {
    try {
      const response: WidgetEmbedCodeResponse = await getWidgetEmbedCode(channelId);
      setEmbedCode(response.embedCode);
    } catch (err) {
      console.error('获取嵌入代码失败:', err);
      toast.error('获取嵌入代码失败');
    }
  }, [channelId]);

  // Initial load
  useEffect(() => {
    loadConfig();
    loadEmbedCode();
  }, [loadConfig, loadEmbedCode]);

  // Handle save and update
  const handleSaveAndUpdate = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await updateWidgetConfig(channelId, config);
      toast.success('配置已保存并更新');
      // Reload embed code after saving
      await loadEmbedCode();
    } catch (err) {
      console.error('保存失败:', err);
      setError('保存失败，请重试');
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  // Copy embed code to clipboard
  const copyEmbedCode = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      toast.success('嵌入代码已复制到剪贴板');
    } catch (err) {
      console.error('复制失败:', err);
      toast.error('复制失败');
    }
  };

  // Get position display text
  const getPositionText = (position: string) => {
    switch (position) {
      case 'bottom-right': return '右下角';
      case 'bottom-center': return '右中';
      case 'bottom-left': return '左下角';
      default: return position;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 配置面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Widget 配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">标题</Label>
            <Input
              id="title"
              value={config.title}
              onChange={(e) => setConfig(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Widget 标题"
              disabled={isLoading || isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="welcomeMessage">欢迎语</Label>
            <Textarea
              id="welcomeMessage"
              value={config.welcomeMessage}
              onChange={(e) => setConfig(prev => ({ ...prev, welcomeMessage: e.target.value }))}
              placeholder="欢迎消息"
              rows={3}
              disabled={isLoading || isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="primaryColor">主色调</Label>
            <div className="flex gap-2">
              <Input
                id="primaryColor"
                type="color"
                value={config.primaryColor}
                onChange={(e) => setConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                disabled={isLoading || isSaving}
                className="w-16 h-10"
              />
              <Input
                type="text"
                value={config.primaryColor}
                onChange={(e) => setConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                placeholder="#3b82f6"
                disabled={isLoading || isSaving}
                className="flex-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">位置</Label>
            <Select
              value={config.position}
              onValueChange={(value) => setConfig(prev => ({ ...prev, position: value as WidgetConfig['position'] }))}
              disabled={isLoading || isSaving}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bottom-right">右下角</SelectItem>
                <SelectItem value="bottom-center">右中</SelectItem>
                <SelectItem value="bottom-left">左下角</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSaveAndUpdate}
            disabled={isLoading || isSaving}
            className="w-full"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                保存并更新中...
              </>
            ) : (
              '保存并更新'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 预览和嵌入代码 */}
      <div className="space-y-6">
        {/* Widget 预览 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              实时预览
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative bg-gray-100 rounded-lg h-64 border-2 border-dashed border-gray-300 overflow-hidden">
              {/* 模拟页面内容 */}
              <div className="p-4 text-sm text-gray-600">
                <p>这是您的网站页面内容...</p>
                <p>Widget 将显示在 {getPositionText(config.position)}</p>
              </div>

              {/* Widget 预览 */}
              <div
                className="absolute w-80 max-w-sm shadow-xl rounded-lg overflow-hidden"
                style={{
                  backgroundColor: 'white',
                  border: `2px solid ${config.primaryColor}`,
                  ...(config.position === 'bottom-right' && {
                    bottom: '20px',
                    right: '20px',
                  }),
                  ...(config.position === 'bottom-center' && {
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                  }),
                  ...(config.position === 'bottom-left' && {
                    bottom: '20px',
                    left: '20px',
                  }),
                }}
              >
                {/* Widget Header */}
                <div
                  className="px-4 py-3 text-white font-medium text-sm"
                  style={{ backgroundColor: config.primaryColor }}
                >
                  {config.title}
                </div>

                {/* Widget Content */}
                <div className="p-4">
                  <p className="text-sm text-gray-700 mb-3">
                    {config.welcomeMessage}
                  </p>

                  {/* Sample Messages */}
                  <div className="space-y-2 mb-3">
                    <div className="flex justify-end">
                      <div className="bg-gray-200 rounded-lg px-3 py-2 max-w-xs">
                        <p className="text-xs text-gray-600">您好！</p>
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div
                        className="rounded-lg px-3 py-2 max-w-xs text-white text-xs"
                        style={{ backgroundColor: config.primaryColor }}
                      >
                        您好！我是 AI 客服，有什么可以帮助您的吗？
                      </div>
                    </div>
                  </div>

                  {/* Input Area */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="输入消息..."
                      className="flex-1 text-sm"
                      disabled
                    />
                    <Button
                      size="sm"
                      style={{ backgroundColor: config.primaryColor }}
                      disabled
                    >
                      发送
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 嵌入代码 */}
        <Card>
          <CardHeader>
            <CardTitle>嵌入代码</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {embedCode ? (
              <>
                <Textarea
                  value={embedCode}
                  readOnly
                  rows={8}
                  className="font-mono text-sm"
                  placeholder="嵌入代码将在这里显示..."
                />
                <Button
                  onClick={copyEmbedCode}
                  variant="outline"
                  className="w-full"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  复制代码
                </Button>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>请先保存配置以生成嵌入代码</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
// @ts-nocheck
