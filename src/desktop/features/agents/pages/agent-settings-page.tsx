import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/common/components/ui/card";
import { Button } from "@/common/components/ui/button";
import { Input } from "@/common/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/common/components/ui/select";
import { Switch } from "@/common/components/ui/switch";
import { Badge } from "@/common/components/ui/badge";
import { cn } from "@/common/lib/utils";
import { RefreshCw } from "lucide-react";
import { agentService } from "@/core/services/agent.service";

interface ChannelBinding {
  agentId?: string;
  behavior?: string;
  autoReply?: boolean;
}

interface ChannelItem {
  id: string;
  name: string;
  type: string;
  meta?: Record<string, unknown>;
  binding?: ChannelBinding;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("auth_token");
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchChannels(): Promise<ChannelItem[]> {
  const res = await fetch(`${API_BASE}/api/channels`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to load channels");
  return (data.channels || data.data || []).map((c: any) => ({
    id: c.id,
    name: c.name || c.type,
    type: c.type,
    meta: c.metadata || {},
  }));
}

async function fetchBinding(channelId: string): Promise<ChannelBinding | null> {
  const res = await fetch(`${API_BASE}/api/channels/${channelId}/agent-binding`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to load binding");
  return data.binding || null;
}

async function saveBinding(channelId: string, binding: ChannelBinding): Promise<void> {
  const res = await fetch(`${API_BASE}/api/channels/${channelId}/agent-binding`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(binding),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to save binding");
}

const behaviors = [
  { value: "auto-reply", label: "自动回复客户" },
  { value: "faq", label: "FAQ 解答" },
  { value: "routing", label: "分流/路由" },
  { value: "summary", label: "对话总结" },
];

export function AgentSettingsPage() {
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [agentList, channelList] = await Promise.all([
          agentService.listAgents(),
          fetchChannels(),
        ]);
        setAgents(agentList.map((a) => ({ id: a.id, name: a.name })));
        // 拉取每个 channel 的绑定
        const withBindings = await Promise.all(
          channelList.map(async (ch) => {
            try {
              const binding = await fetchBinding(ch.id);
              return { ...ch, binding: binding || (ch.meta as any)?.agentBinding };
            } catch {
              return { ...ch, binding: (ch.meta as any)?.agentBinding };
            }
          })
        );
        setChannels(withBindings);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const filteredChannels = useMemo(() => {
    if (!search) return channels;
    return channels.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  }, [channels, search]);

  const handleSave = async (channelId: string, binding: ChannelBinding) => {
    setSavingId(channelId);
    try {
      await saveBinding(channelId, binding);
      setChannels((prev) =>
        prev.map((c) => (c.id === channelId ? { ...c, binding } : c))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="搜索渠道"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.location.reload()}
          disabled={loading}
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredChannels.map((ch) => {
          const binding = ch.binding || {};
          return (
            <Card key={ch.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{ch.name}</CardTitle>
                  <Badge variant="outline">{ch.type}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">绑定智能体</label>
                  <Select
                    value={binding.agentId || ""}
                    onValueChange={(v) =>
                      setChannels((prev) =>
                        prev.map((c) =>
                          c.id === ch.id ? { ...c, binding: { ...binding, agentId: v } } : c
                        )
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择智能体" />
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
                  <label className="text-sm text-muted-foreground">行为</label>
                  <Select
                    value={binding.behavior || ""}
                    onValueChange={(v) =>
                      setChannels((prev) =>
                        prev.map((c) =>
                          c.id === ch.id ? { ...c, binding: { ...binding, behavior: v } } : c
                        )
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择或输入行为" />
                    </SelectTrigger>
                    <SelectContent>
                      {behaviors.map((b) => (
                        <SelectItem key={b.value} value={b.value}>
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="自定义行为"
                    value={binding.behavior || ""}
                    onChange={(e) =>
                      setChannels((prev) =>
                        prev.map((c) =>
                          c.id === ch.id ? { ...c, binding: { ...binding, behavior: e.target.value } } : c
                        )
                      )
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">自动回复客户</div>
                  <Switch
                    checked={binding.autoReply ?? false}
                    onCheckedChange={(v) =>
                      setChannels((prev) =>
                        prev.map((c) =>
                          c.id === ch.id ? { ...c, binding: { ...binding, autoReply: v } } : c
                        )
                      )
                    }
                  />
                </div>

                <Button
                  className="w-full"
                  disabled={savingId === ch.id}
                  onClick={() => handleSave(ch.id, ch.binding || {})}
                >
                  保存
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
