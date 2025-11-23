import { useEffect, useMemo, useState, useRef } from "react";
import { Badge } from "@/common/components/ui/badge";
import { Button } from "@/common/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/common/components/ui/card";
import { Input } from "@/common/components/ui/input";
import { ScrollArea } from "@/common/components/ui/scroll-area";
import { Switch } from "@/common/components/ui/switch";
import { cn } from "@/common/lib/utils";
import { MessageCircle, RefreshCw, ImageIcon, Send, Brain } from "lucide-react";
import { websocketService } from "@/lib/websocket";

interface Conversation {
  id: string;
  channelInstanceId: string;
  channelType: string;
  customer: { id: string; name: string; externalId?: string };
  phoneNumber?: string;
  status: string;
  lastMessageAt?: string;
  lastMessage?: { id: string; text: string; direction: string; createdAt: string };
  autoReplyEnabled?: boolean;
  autoReplyAgentId?: string;
}

interface MessageItem {
  id: string;
  direction: string;
  text: string | null;
  createdAt: string;
  channelInstanceId: string;
  attachments?: Array<{ type?: string; url?: string; mimeType?: string; extra?: Record<string, unknown> }>;
  status?: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

const channelBadgeMap: Record<string, { label: string; variant?: "default" | "secondary" | "outline"; className?: string }> = {
  WHATSAPP: { label: "WhatsApp", className: "bg-green-100 text-green-700" },
  "whatsapp": { label: "WhatsApp", className: "bg-green-100 text-green-700" },
  TELEGRAM_BOT: { label: "Telegram", className: "bg-blue-100 text-blue-700" },
  TELEGRAM_USER: { label: "Telegram", className: "bg-blue-100 text-blue-700" },
  FACEBOOK: { label: "Facebook", className: "bg-purple-100 text-purple-700" },
};

const bubbleColors: Record<string, string> = {
  whatsapp: "bg-green-50 text-green-900 border border-green-200",
  WHATSAPP: "bg-green-50 text-green-900 border border-green-200",
  TELEGRAM_BOT: "bg-blue-50 text-blue-900 border border-blue-200",
  TELEGRAM_USER: "bg-blue-50 text-blue-900 border border-blue-200",
};

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("auth_token");
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function WorkbenchPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filtered, setFiltered] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingConv, setLoadingConv] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [search, setSearch] = useState("");
  const [inputText, setInputText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [autoReplyMap, setAutoReplyMap] = useState<Record<string, boolean>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const fetchConversations = async () => {
    setLoadingConv(true);
    try {
      const res = await fetch(`${API_BASE}/api/conversations`, { headers: authHeaders() });
      const data = await res.json();
      if (data.ok && data.conversations) {
        setConversations(data.conversations);
      }
    } finally {
      setLoadingConv(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    setLoadingMsg(true);
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${conversationId}/messages?limit=100`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.ok && data.messages) {
        setMessages(
          data.messages.map((m: MessageItem) => ({
            ...m,
            status: m.status,
          }))
        );
      } else {
        setMessages([]);
      }
    } finally {
      setLoadingMsg(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId]
  );

  const currentAutoReply = selectedId ? autoReplyMap[selectedId] ?? true : true;

  const formatName = (conv?: Conversation | null) => {
    if (!conv) return "";
    const isWhatsApp = conv.channelType?.toLowerCase().includes("whatsapp");
    const externalId = conv.customer.externalId;

    if (isWhatsApp) {
      if (conv.phoneNumber) {
        return conv.phoneNumber;
      }
      if (externalId) {
        return externalId.split("@")[0];
      }
    }

    return conv.phoneNumber || externalId || conv.customer.name || conv.customer.id || "";
  };

  useEffect(() => {
    const next = search
      ? conversations.filter((c) => c.customer.name?.toLowerCase().includes(search.toLowerCase()))
      : conversations;
    setFiltered(next);

    const map: Record<string, boolean> = {};
    conversations.forEach((c) => {
      map[c.id] = c.autoReplyEnabled ?? true;
    });
    setAutoReplyMap((prev) => ({ ...map, ...prev }));
  }, [conversations, search]);

  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId);
    } else if (filtered[0]) {
      setSelectedId(filtered[0].id);
      fetchMessages(filtered[0].id);
    }
  }, [selectedId, filtered]);

  const analysis = useMemo(() => {
    const total = messages.length;
    const inboundMessages = messages.filter((m) => m.direction === "INBOUND");
    const outboundMessages = messages.filter((m) => m.direction !== "INBOUND");
    const inbound = inboundMessages.length;
    const outbound = outboundMessages.length;
    const lastMsg = messages[messages.length - 1];
    const lastInbound = inboundMessages[inboundMessages.length - 1];
    const lastOutbound = outboundMessages[outboundMessages.length - 1];
    const responsiveness =
      lastInbound && lastOutbound
        ? Math.abs(new Date(lastOutbound.createdAt).getTime() - new Date(lastInbound.createdAt).getTime())
        : null;

    return {
      customer: formatName(selectedConversation),
      channel: selectedConversation?.channelType,
      total,
      inbound,
      outbound,
      lastTime: lastMsg ? new Date(lastMsg.createdAt).toLocaleString() : "",
      autoReply: currentAutoReply,
      lastInboundAt: lastInbound ? new Date(lastInbound.createdAt).toLocaleString() : "",
      lastOutboundAt: lastOutbound ? new Date(lastOutbound.createdAt).toLocaleString() : "",
      responsiveness: responsiveness !== null ? `${Math.round(responsiveness / 1000)} 秒` : "暂无",
    };
  }, [messages, selectedConversation, currentAutoReply]);

  const mockLookup = useMemo(() => {
    const phone = formatName(selectedConversation) || "未知号码";
    return {
      phone,
      location: "Kuala Lumpur",
      carrier: "运营商",
      risk: "低",
      tags: ["电商客户", "已验证"],
      lastChecked: new Date().toLocaleString(),
    };
  }, [selectedConversation]);
  useEffect(() => {
    // 始终滚动到底部
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages.length, selectedId]);

  const updateAutoReply = async (conversationId: string, enabled: boolean) => {
    setAutoReplyMap((prev) => ({ ...prev, [conversationId]: enabled }));
    try {
      await fetch(`${API_BASE}/api/conversations/${conversationId}/auto-reply`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ enabled }),
      });
    } catch (err) {
      console.error("更新自动回复失败", err);
    }
  };

  // WebSocket 增量更新：收到 message-created 时刷新列表 & 追加当前会话消息
  useEffect(() => {
    const handleMessageCreated = (...args: unknown[]) => {
      const data = args[0] as {
        conversationId?: string;
        message?: {
          id: string;
          text?: string;
          direction?: string;
          createdAt?: string | Date;
          channelInstanceId?: string;
          attachments?: Array<{ type?: string; url?: string; mimeType?: string; extra?: Record<string, unknown> }>;
          status?: string;
        };
      };
      if (!data.conversationId || !data.message) return;

      // 追加到当前会话
      if (selectedId && data.conversationId === selectedId) {
        setMessages((prev) => [
          ...prev,
          {
            id: data.message?.id || `msg-${Date.now()}`,
            direction: data.message?.direction || "INBOUND",
            text: (data.message?.text as string) || "",
            createdAt: new Date(data.message?.createdAt || Date.now()).toISOString(),
            channelInstanceId: data.message?.channelInstanceId || "",
            attachments: (data.message?.attachments as Array<{ type?: string; url?: string; mimeType?: string; extra?: Record<string, unknown> }>) || [],
            status: data.message?.status,
          },
        ]);
      }

      // 刷新会话列表以更新最后消息/排序
      fetchConversations();
    };

    websocketService.on("message-created", handleMessageCreated);
    return () => {
      websocketService.off("message-created", handleMessageCreated);
    };
  }, [selectedId, conversations]);

  const handleSend = async () => {
    if (!selectedConversation) return;
    if (!inputText && !imageUrl) return;
    setSending(true);
    try {
      const payload: {
        channelInstanceId: string;
        conversationId: string;
        text: string;
        autoReply: boolean;
        attachments?: Array<{ type: string; url: string }>;
      } = {
        channelInstanceId: selectedConversation.channelInstanceId,
        conversationId: selectedConversation.id,
        text: inputText,
        autoReply: currentAutoReply,
      };
      if (imageUrl) {
        payload.attachments = [{ type: "image", url: imageUrl }];
      }
      const res = await fetch(`${API_BASE}/api/messages/send`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || data?.error || "发送失败");
      }

      const mapped = data?.id
        ? {
            id: data.id,
            direction: data.direction || "OUTBOUND",
            text: data.text ?? inputText,
            createdAt: data.createdAt || new Date().toISOString(),
            channelInstanceId: data.channelInstanceId || selectedConversation.channelInstanceId,
            attachments: data.attachments || payload.attachments,
          status: data.status,
          }
        : null;

      if (mapped) {
        setMessages((prev) => [...prev, mapped]);
      } else {
        // fallback sync
        await fetchMessages(selectedConversation.id);
      }

      setInputText("");
      setImageUrl("");
    } catch (err) {
      console.error("发送失败", err);
      alert(err instanceof Error ? err.message : "发送失败");
    } finally {
      setSending(false);
    }
  };

  const renderBadge = (channelType: string) => {
    const cfg = channelBadgeMap[channelType] || { label: channelType, variant: "outline" };
    return (
      <Badge className={cn("text-xs", cfg.className)} variant={cfg.variant ?? "secondary"}>
        {cfg.label}
      </Badge>
    );
  };

  const statusIcon = (status?: string) => {
    const s = (status || "").toUpperCase();
    // WhatsApp style: single check (sent), double gray (delivered), double blue (read)
    const sentColor = "#9CB18F";
    const deliveredColor = "#8B8F8F";
    const readColor = "#6FA8DC";
    if (s === "READ") return <span style={{ color: readColor }} className="text-xs">✓✓</span>;
    if (s === "DELIVERED") return <span style={{ color: deliveredColor }} className="text-xs">✓✓</span>;
    if (s === "SENT") return <span style={{ color: sentColor }} className="text-xs">✓</span>;
    if (s === "FAILED") return <span className="text-red-500 text-xs">!</span>;
    return null;
  };

  return (
    <div className="flex h-full w-full bg-gray-50">
      <div className="w-72 border-r bg-white flex flex-col">
        <div className="p-3 flex items-center gap-3 border-b">
          <Input
            placeholder="搜索客户"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
          <Button size="icon" variant="ghost" onClick={fetchConversations} disabled={loadingConv}>
            <RefreshCw className={cn("w-4 h-4", loadingConv && "animate-spin")} />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {filtered.map((conv) => (
              <Card
                key={conv.id}
                className={cn(
                  "cursor-pointer hover:shadow-sm",
                  selectedId === conv.id ? "border-primary shadow-sm" : ""
                )}
                onClick={() => setSelectedId(conv.id)}
              >
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">{formatName(conv)}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    {renderBadge(conv.channelType)}
                    <div
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>自动回复</span>
                      <Switch
                        checked={autoReplyMap[conv.id] ?? true}
                        onCheckedChange={(v) => updateAutoReply(conv.id, v)}
                      />
                    </div>
                  </div>
                  {conv.lastMessage?.text && (
                    <p className="text-sm text-muted-foreground truncate">{conv.lastMessage.text}</p>
                  )}
                  <div className="text-[11px] text-muted-foreground">
                    {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleString() : ""}
                  </div>
                </CardContent>
              </Card>
            ))}
            {!filtered.length && (
              <div className="text-center text-sm text-muted-foreground py-6">暂无会话</div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="border-b bg-white px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex-1">
            <div className="text-lg font-semibold flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              {formatName(selectedConversation) || "选择会话"}
              {selectedConversation && renderBadge(selectedConversation.channelType)}
            </div>
            {selectedConversation?.customer.externalId && (
              <div className="text-xs text-muted-foreground">
                External: {selectedConversation.customer.externalId}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>自动回复</span>
            <Switch
              checked={currentAutoReply}
              onCheckedChange={(v) =>
                selectedConversation && updateAutoReply(selectedConversation.id, v)
              }
            />
          </div>
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {selectedConversation?.lastMessageAt
              ? `更新于 ${new Date(selectedConversation.lastMessageAt).toLocaleString()}`
              : ""}
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3 max-h-full overflow-auto" ref={scrollContainerRef}>
            {loadingMsg ? (
              <div className="text-sm text-muted-foreground">加载消息...</div>
            ) : messages.length ? (
              messages.map((msg) => {
                const isOutbound = msg.direction === "OUTBOUND" || msg.direction === "SYSTEM";
                const bubbleColor = isOutbound
                  ? "bg-white text-gray-900 border border-gray-200"
                  : bubbleColors[selectedConversation?.channelType || ""] || "bg-gray-100 text-gray-900";
                return (
                  <div
                    key={msg.id}
                    className={cn("flex", isOutbound ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[70%] rounded-lg px-3 py-2 text-sm shadow-sm",
                        bubbleColor
                      )}
                    >
                      {msg.text && (
                        <div className="whitespace-pre-wrap break-words">
                          {msg.text}
                        </div>
                      )}
                      {msg.attachments?.map((att, idx) => {
                        if (att?.type === "image" && att.url) {
                          return (
                            <div key={idx} className="mt-2">
                              <img
                                src={att.url}
                                alt="attachment"
                                className="max-h-64 rounded border"
                              />
                            </div>
                          );
                        }
                        return (
                          <div key={idx} className="mt-2 text-muted-foreground text-xs">
                            [附件: {att?.type || "unknown"}]
                          </div>
                        );
                      })}
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {new Date(msg.createdAt).toLocaleString()}{" "}
                        {isOutbound && statusIcon(msg.status)}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-muted-foreground">暂无消息</div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="border-t bg-white p-3 flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            <Input
              placeholder="输入消息..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1"
            />
            <Button size="sm" variant="outline" onClick={handleSend} disabled={sending}>
              <Send className="w-4 h-4 mr-1" />
              发送
            </Button>
          </div>
          <div className="flex gap-2 items-center">
            <ImageIcon className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="图片 URL（可选）"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="w-64 border-l bg-white flex flex-col">
        <div className="p-3 space-y-3">
          <Card className="rounded-lg border-primary/20 shadow-sm">
            <CardHeader className="pb-2 bg-primary/5 rounded-t-lg">
              <CardTitle className="text-xs font-semibold flex items-center gap-2 text-primary">
                <Brain className="w-4 h-4" />
                会话洞察
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">客户</span>
                <span className="font-medium truncate max-w-[120px] text-right">
                  {analysis.customer || "未选择"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">来自</span>
                <span className="font-medium">{mockLookup.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">运营商</span>
                <span className="font-medium">{mockLookup.carrier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">风险</span>
                <span className="font-medium">{mockLookup.risk}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">归属地</span>
                <span className="font-medium">{mockLookup.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">最后互动</span>
                <span className="font-medium text-right max-w-[120px]">
                  {analysis.lastTime || "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">客户最近</span>
                <span className="font-medium text-right max-w-[120px]">
                  {analysis.lastInboundAt || "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">回复速度</span>
                <span className="font-medium">{analysis.responsiveness}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">自动回复</span>
                <Badge variant={analysis.autoReply ? "secondary" : "outline"} className="text-[11px]">
                  {analysis.autoReply ? "开启" : "关闭"}
                </Badge>
              </div>
              <div className="text-[11px] text-muted-foreground">
                最近查询：{mockLookup.lastChecked}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-sky-100 shadow-sm hover:shadow-md transition-shadow duration-300">
            <CardHeader className="pb-3 bg-gradient-to-r from-sky-50 to-blue-50 rounded-t-lg border-b border-sky-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-sky-400 rounded-full"></div>
                <CardTitle className="text-sm font-semibold text-sky-800">AI客户分析</CardTitle>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              {/* 性格分析 */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-sky-600">👤</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-medium text-sky-700">性格特征</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {["稳健型", "耐心型", "谨慎型"].map((trait, index) => (
                      <Badge key={index} variant="outline" className="text-[10px] px-2 py-0 border-sky-200 text-sky-700">
                        {trait}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* 背景偏好 */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-sky-600">🛒</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-medium text-sky-700">消费偏好</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-5">
                    热衷网购，偏好电子产品和时尚服饰，注重性价比
                  </p>
                </div>
              </div>

              {/* 数据指标 */}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-sky-600">📊</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">成交概率</span>
                        <Badge variant="default" className="text-[10px] bg-green-100 text-green-700 hover:bg-green-100">
                          60%
                        </Badge>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1">
                        <div className="bg-green-500 h-1 rounded-full" style={{ width: "60%" }}></div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">防范心态</span>
                        <Badge variant="default" className="text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-100">
                          30%
                        </Badge>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1">
                        <div className="bg-amber-400 h-1 rounded-full" style={{ width: "30%" }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 建议提示 */}
              <div className="mt-3 p-2 bg-amber-50 rounded-md border border-amber-200">
                <p className="text-xs text-amber-700 text-center">
                  💡 建议：采用耐心沟通策略，需准备详细信息以消除疑虑
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
