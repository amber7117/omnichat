// @ts-nocheck
// src/components/channels/ChannelCard.tsx

"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../common/components/ui/card";
import { Button } from "../../common/components/ui/button";
import { Badge } from "../../common/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../common/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../common/components/ui/select";
import { Input } from "../../common/components/ui/input";
import { Switch } from "../../common/components/ui/switch";
import {
  Settings,
  Unlink,
  Trash2,
  Wifi,
  WifiOff,
  Clock,
  MessageCircle,
  Phone,
} from "lucide-react";
import { websocketService } from "../../lib/websocket";
import { getChannelStatus } from "../../lib/api";
import { Platform } from "@/types/platform";
import { EditChannelModal } from "./EditChannelModal";

type ChannelStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error"
  | "online"
  | "active";

interface StatusUpdateData {
  channelId: string;
  status?: string;
}

interface WhatsAppUpdateData {
  channelId: string;
  status: string;
}

// 在本组件中使用的增强版 Channel（原来的 Channel 也可以直接传进来）
type ChannelWithMeta = Platform & {
  status?: ChannelStatus | string;
  lastActivity?: string | Date;
  messageCount?: number;
  phoneNumber?: string;
};

interface ChannelCardProps {
  channel: ChannelWithMeta;
  onDelete: (channel: ChannelWithMeta | string) => void;
  onEdit?: (channel: ChannelWithMeta) => void;
  onDisconnect?: (channel: ChannelWithMeta) => void;
}

// 轮询定时器类型（兼容浏览器 & Node）
type IntervalId = ReturnType<typeof setInterval>;

export function ChannelCard({
  channel,
  onDelete,
  onEdit,
  onDisconnect,
}: ChannelCardProps) {
  // 将后端状态字符串映射为前端状态类型
  const mapBackendStatus = (backendStatus: string | ChannelStatus): ChannelStatus => {
    const statusStr = String(backendStatus).toLowerCase();
    switch (statusStr) {
      case 'connected':
      case 'online':
      case 'open':
      case 'active':
        return "connected";
      case 'connecting':
        return "connecting";
      case 'error':
      case 'failed':
        return "error";
      case 'disconnected':
      case 'closed':
      case 'offline':
      default:
        return "disconnected";
    }
  };

  const [currentStatus, setCurrentStatus] = useState<ChannelStatus>(
    mapBackendStatus(channel.status || "disconnected")
  );

  const [lastActivity, setLastActivity] = useState<string>(
    channel.lastActivity
      ? typeof channel.lastActivity === "string"
        ? channel.lastActivity
        : channel.lastActivity.toLocaleString()
      : "从未"
  );

  const [isOnline, setIsOnline] = useState(
    currentStatus === "connected" ||
    currentStatus === "online" ||
    currentStatus === "active"
  );
  const [bindOpen, setBindOpen] = useState(false);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [bindingAgent, setBindingAgent] = useState<string>("");
  const [bindingBehavior, setBindingBehavior] = useState<string>("");
  const [bindingAutoReply, setBindingAutoReply] = useState<boolean>(false);
  const [savingBind, setSavingBind] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const API_BASE = (import.meta as any)?.env?.VITE_API_BASE_URL || "http://localhost:3001";
  const authHeaders = (): HeadersInit => {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  const loadAgents = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setAgents((data.agents || []).map((a: any) => ({ id: a.id, name: a.name || "未命名" })));
    } catch (err) {
      console.error("加载智能体失败", err);
    }
  };

  const loadBinding = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/channels/${channel.id}/agent-binding`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const binding = data.binding || {};
      setBindingAgent(binding.agentId || "");
      setBindingBehavior(binding.behavior || "");
      setBindingAutoReply(Boolean(binding.autoReply));
    } catch (err) {
      console.error("加载绑定失败", err);
    }
  };

  const openBindDialog = () => {
    setBindOpen(true);
    loadAgents();
    loadBinding();
  };

  const saveBinding = async () => {
    setSavingBind(true);
    try {
      await fetch(`${API_BASE}/api/channels/${channel.id}/agent-binding`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          agentId: bindingAgent || undefined,
          behavior: bindingBehavior || undefined,
          autoReply: bindingAutoReply,
        }),
      });
      setBindOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSavingBind(false);
    }
  };

  // 🔁 WebSocket 实时状态更新（只依赖 channel.id）
  useEffect(() => {
    const handleStatusUpdate = (...args: unknown[]) => {
      const data = args[0] as StatusUpdateData;
      if (data.channelId !== channel.id) return;

      if (data.status) {
        const mappedStatus = mapBackendStatus(data.status);
        setCurrentStatus(mappedStatus);
        setLastActivity(new Date().toLocaleString());
        setIsOnline(mappedStatus === "connected");
      }
    };

    const handleWhatsAppConnectionUpdate = (...args: unknown[]) => {
      const data = args[0] as { connection?: string; channelId?: string };
      // 如果有 channelId，检查是否匹配；如果没有，则是全局事件
      if (data.channelId && data.channelId !== channel.id) return;

      if (data.connection) {
        const mappedStatus = mapBackendStatus(data.connection);
        setCurrentStatus(mappedStatus);
        setLastActivity(new Date().toLocaleString());
        setIsOnline(mappedStatus === "connected");
      }
    };

    const handleWhatsAppConnected = (...args: unknown[]) => {
      const data = args[0] as { channelId?: string; phoneNumber?: string };
      // 如果有 channelId，检查是否匹配；如果没有，则是全局事件
      if (data.channelId && data.channelId !== channel.id) return;

      setCurrentStatus("connected");
      setLastActivity(new Date().toLocaleString());
      setIsOnline(true);
    };

    const handleWhatsAppDisconnected = (...args: unknown[]) => {
      const data = args[0] as { channelId?: string };
      // 如果有 channelId，检查是否匹配；如果没有，则是全局事件
      if (data.channelId && data.channelId !== channel.id) return;

      setCurrentStatus("disconnected");
      setLastActivity(new Date().toLocaleString());
      setIsOnline(false);
    };

    // 监听通用渠道状态更新事件
    websocketService.on("channel-status-update", handleStatusUpdate);
    
    // 监听WhatsApp特定的连接事件
    websocketService.on("whatsapp-connection-update", handleWhatsAppConnectionUpdate);
    websocketService.on("whatsapp-connected", handleWhatsAppConnected);
    websocketService.on("whatsapp-disconnected", handleWhatsAppDisconnected);
    
    websocketService.joinChannel(channel.id);

    return () => {
      websocketService.off("channel-status-update", handleStatusUpdate);
      websocketService.off("whatsapp-connection-update", handleWhatsAppConnectionUpdate);
      websocketService.off("whatsapp-connected", handleWhatsAppConnected);
      websocketService.off("whatsapp-disconnected", handleWhatsAppDisconnected);
      websocketService.leaveChannel(channel.id);
    };
  }, [channel.id]);

  // ⏱ 轮询状态：只在 connecting / connected 时开启
  useEffect(() => {
    if (currentStatus !== "connecting" && currentStatus !== "connected") {
      return;
    }

    let statusInterval: IntervalId | undefined;

    const startPolling = () => {
      statusInterval = setInterval(async () => {
        try {
          const result = (await getChannelStatus(
            channel.id
          )) as unknown as { status: ChannelStatus | string };

          const nextStatus: ChannelStatus =
            (result.status as ChannelStatus) || "disconnected";

          if (nextStatus !== currentStatus) {
            setCurrentStatus(nextStatus);
            setLastActivity(new Date().toLocaleString());
            setIsOnline(
              nextStatus === "connected" ||
              nextStatus === "online" ||
              nextStatus === "active"
            );
          }
        } catch {
          // 静默失败，避免刷 error
        }
      }, 30_000); // 30 秒轮询一次
    };

    startPolling();

    return () => {
      if (statusInterval) {
        clearInterval(statusInterval);
      }
    };
  }, [channel.id, currentStatus]);

  const getStatusColor = (status: ChannelStatus) => {
    switch (status) {
      case "connected":
      case "online":
      case "active":
        return "bg-green-500";
      case "connecting":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: ChannelStatus) => {
    switch (status) {
      case "connected":
        return "已连接";
      case "connecting":
        return "连接中";
      case "error":
        return "异常";
      case "online":
        return "在线";
      case "active":
        return "活跃";
      default:
        return "未连接";
    }
  };

  const getCardColor = (type: string) => {
    switch (type) {
      case "whatsapp":
        return "bg-green-50/30 border-green-200/50 hover:border-green-300";
      case "telegram":
      case "telegram-bot":
        return "bg-blue-50/30 border-blue-200/50 hover:border-blue-300";
      case "facebook":
        return "bg-blue-50/40 border-blue-200/50 hover:border-blue-300";
      case "widget":
      case "web-widget":
        return "bg-purple-50/30 border-purple-200/50 hover:border-purple-300";
      default:
        return "bg-gray-50/30 border-gray-200/50 hover:border-gray-300";
    }
  };

  const lastActivityDisplay = lastActivity;

  return (
    <Card className={`hover:shadow-lg transition-all ${getCardColor(channel.type)}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-gray-400" />
            )}
            <span>{channel.name}</span>
          </div>
          <Badge className={getStatusColor(currentStatus)}>
            {getStatusText(currentStatus)}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>渠道类型</span>
              <span className="font-medium text-foreground capitalize">{channel.type}</span>
            </div>

            {channel.messageCount !== undefined && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" />
                  消息数
                </span>
                <span className="font-medium text-foreground">{channel.messageCount}</span>
              </div>
            )}

            {channel.phoneNumber && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  手机号
                </span>
                <span className="font-medium text-foreground">{channel.phoneNumber}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                最后上线
              </span>
              <span className={`font-medium ${isOnline ? "text-green-600" : "text-foreground"}`}>
                {lastActivityDisplay}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditModal(true)}
              className="flex-1 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
            >
              <Settings className="mr-1 h-3.5 w-3.5" />
              配置
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={openBindDialog}
              className="flex-1 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
            >
              <MessageCircle className="mr-1 h-3.5 w-3.5" />
              绑定智能体
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(channel)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>

      <EditChannelModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        channel={channel}
        onUpdate={(updatedChannel) => {
          setShowEditModal(false);
          // Optionally trigger a refresh or update the channel data
          if (onEdit) {
            onEdit(updatedChannel);
          }
        }}
      />

      <Dialog open={bindOpen} onOpenChange={setBindOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>绑定智能体</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">选择智能体</div>
              <Select value={bindingAgent} onValueChange={setBindingAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择智能体" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">智能体行为</div>
              <Select value={bindingBehavior} onValueChange={setBindingBehavior}>
                <SelectTrigger>
                  <SelectValue placeholder="选择行为" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto-reply">自动回复客户</SelectItem>
                  <SelectItem value="faq">FAQ 解答</SelectItem>
                  <SelectItem value="routing">分流/路由</SelectItem>
                  <SelectItem value="summary">对话总结</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="自定义行为"
                value={bindingBehavior}
                onChange={(e) => setBindingBehavior(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">自动回复客户</div>
              <Switch
                checked={bindingAutoReply}
                onCheckedChange={setBindingAutoReply}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBindOpen(false)} disabled={savingBind}>
              取消
            </Button>
            <Button onClick={saveBinding} disabled={savingBind || !bindingAgent}>
              {savingBind ? "保存中..." : "保存绑定"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
