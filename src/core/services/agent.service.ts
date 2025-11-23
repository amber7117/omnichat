import { AgentDef } from "@/common/types/agent";
import { AgentDataProvider } from "@/common/types/storage";

export class AgentService {
  constructor(private provider: AgentDataProvider) {}

  async listAgents(): Promise<AgentDef[]> {
    return this.provider.list();
  }

  async getAgent(id: string): Promise<AgentDef> {
    return this.provider.get(id);
  }

  async createAgent(data: Omit<AgentDef, "id">): Promise<AgentDef> {
    // 这里可以添加业务验证逻辑
    if (!data.name) {
      throw new Error("Agent name is required");
    }

    const result = await this.provider.create(data);
    return result;
  }

  async updateAgent(id: string, data: Partial<AgentDef>): Promise<AgentDef> {
    const result = await this.provider.update(id, data);
    return result;
  }

  async deleteAgent(id: string): Promise<void> {
    await this.provider.delete(id);
  }
  // 工具方法
  createDefaultAgent(): Omit<AgentDef, "id"> {
    const seed = Date.now().toString();
    return {
      name: "新成员",
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=b6e3f4,c7f2a4,f4d4d4`,
      prompt: "请在编辑时设置该成员的具体职责和行为方式。",
      role: "participant",
      personality: "待设置",
      expertise: [],
      bias: "待设置",
      responseStyle: "待设置",
    };
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:3001" : "");

function getToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
}

function authHeaders(): HeadersInit {
  const token = getToken();
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

// 将后端 Agent 记录映射为前端 AgentDef
function mapToAgentDef(item: any): AgentDef {
  const fallbackAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${item.id || Date.now()}&backgroundColor=b6e3f4,c7f2a4,f4d4d4`;
  const stored = item.toolConfig?.agentDef as AgentDef | undefined;
  return {
    id: item.id,
    name: stored?.name || item.name,
    avatar: stored?.avatar || fallbackAvatar,
    prompt: stored?.prompt || item.prompt || "",
    role: stored?.role || "participant",
    personality: stored?.personality || "",
    expertise: stored?.expertise || [],
    bias: stored?.bias || "",
    responseStyle: stored?.responseStyle || "",
    slug: stored?.slug,
    version: stored?.version,
  };
}

class HttpAgentProvider implements AgentDataProvider {
  async list(): Promise<AgentDef[]> {
    const token = getToken();
    if (!token) {
      return [];
    }
    const res = await fetch(`${API_BASE}/api/agents`, { headers: authHeaders() });
    const data = await res.json();
    if (res.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      localStorage.removeItem("tenantId");
      window.location.href = "/#/login";
      throw new Error("Unauthorized");
    }
    if (!res.ok) throw new Error(data?.message || data?.error || "Failed to list agents");
    return (data.agents || []).map(mapToAgentDef);
  }

  async get(id: string): Promise<AgentDef> {
    const token = getToken();
    if (!token) {
      throw new Error("Unauthorized");
    }
    const res = await fetch(`${API_BASE}/api/agents`, { headers: authHeaders() });
    const data = await res.json();
    if (res.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      localStorage.removeItem("tenantId");
      window.location.href = "/#/login";
      throw new Error("Unauthorized");
    }
    if (!res.ok) throw new Error(data?.message || data?.error || "Failed to fetch agent");
    const found = (data.agents || []).find((a: any) => a.id === id);
    if (!found) throw new Error("Agent not found");
    return mapToAgentDef(found);
  }

  async create(data: Omit<AgentDef, "id">): Promise<AgentDef> {
    const token = getToken();
    if (!token) {
      return Promise.reject(new Error("Unauthorized"));
    }
    const payload = {
      name: data.name,
      prompt: data.prompt,
      toolConfig: { agentDef: data },
      status: "ACTIVE",
    };
    const res = await fetch(`${API_BASE}/api/agents`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      localStorage.removeItem("tenantId");
      window.location.href = "/#/login";
      throw new Error("Unauthorized");
    }
    if (!res.ok) throw new Error(json?.message || json?.error || "Failed to create agent");
    return mapToAgentDef(json.agent);
  }

  async createMany(data: Omit<AgentDef, "id">[]): Promise<AgentDef[]> {
    const token = getToken();
    if (!token) {
      return Promise.reject(new Error("Unauthorized"));
    }
    const results: AgentDef[] = [];
    for (const item of data) {
      results.push(await this.create(item));
    }
    return results;
  }

  async update(id: string, data: Partial<AgentDef>): Promise<AgentDef> {
    const token = getToken();
    if (!token) {
      return Promise.reject(new Error("Unauthorized"));
    }
    const payload = {
      name: data.name,
      prompt: data.prompt,
      toolConfig: { agentDef: data },
    };
    const res = await fetch(`${API_BASE}/api/agents/${id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      localStorage.removeItem("tenantId");
      window.location.href = "/#/login";
      throw new Error("Unauthorized");
    }
    if (!res.ok) throw new Error(json?.message || json?.error || "Failed to update agent");
    return mapToAgentDef(json.agent);
  }

  async delete(id: string): Promise<void> {
    const token = getToken();
    if (!token) {
      return Promise.reject(new Error("Unauthorized"));
    }
    const res = await fetch(`${API_BASE}/api/agents/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      localStorage.removeItem("tenantId");
      window.location.href = "/#/login";
      throw new Error("Unauthorized");
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.message || data?.error || "Failed to delete agent");
    }
  }
}

export const agentService = new AgentService(
  new HttpAgentProvider()
);
