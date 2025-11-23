/**
 * 多智能体工作台 UI 原型
 * 第三阶段：前端界面设计
 *
 * 组件结构树：
 * - <MultiAgentWorkspace>
 *   - <TopBar />（渠道切换 + 搜索）
 *   - <MainLayout>
 *     - <SidebarConversations />（左侧：任务/对话列表）
 *     - <ConversationPanel />（中间：当前对话 + 多智能体协作区）
 *     - <AgentTeamPanel />（右侧：智能体团队成员 + 分派控制）
 */

// ==================== 类型定义 ====================

// 渠道类型
export type ChannelType = 'whatsapp' | 'telegram' | 'web';

// 对话状态
export type ConversationStatus = 'active' | 'pending' | 'resolved' | 'closed';

// 智能体状态
export type AgentStatus = 'online' | 'busy' | 'offline';

// 消息类型
export interface Message {
  id: string;
  conversationId: string;
  content: string;
  senderType: 'customer' | 'agent' | 'system';
  senderId: string;
  timestamp: Date;
  messageType: 'text' | 'image' | 'file';
  metadata?: Record<string, unknown>;
}

// 对话
export interface Conversation {
  id: string;
  channel: ChannelType;
  customerId: string;
  customerName: string;
  title: string;
  status: ConversationStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  lastMessageAt: Date;
  assignedAgents: string[];
  tags: string[];
  unreadCount: number;
}

// 智能体
export interface Agent {
  id: string;
  name: string;
  avatar?: string;
  status: AgentStatus;
  expertise: string[];
  currentLoad: number; // 0-100
  teamId?: string;
}

// 智能体团队
export interface AgentTeam {
  id: string;
  name: string;
  agents: Agent[];
  specialization: string;
}

// 工作台状态
export interface WorkspaceState {
  // 全局状态
  selectedChannel: ChannelType | null;
  searchQuery: string;

  // 左侧数据
  channels: ChannelType[];
  conversations: Conversation[];
  conversationFilters: {
    status?: ConversationStatus[];
    priority?: string[];
    assignedToMe?: boolean;
  };

  // 中间数据
  selectedConversation: Conversation | null;
  messages: Message[];
  agentSuggestions: AgentSuggestion[];

  // 右侧数据
  availableAgents: Agent[];
  selectedAgents: Agent[];
  agentTeams: AgentTeam[];
  autoDispatchConfig: {
    enabled: boolean;
    rules: DispatchRule[];
  };
}

// 智能体建议
export interface AgentSuggestion {
  agentId: string;
  confidence: number;
  reasoning: string;
  suggestedActions: string[];
}

// 分派规则
export interface DispatchRule {
  condition: string;
  targetTeamId: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

// ==================== 主要组件骨架 ====================

import React, { useState, useEffect } from 'react';

// 根组件：多智能体工作台
export const MultiAgentWorkspace: React.FC = () => {
  // 工作台状态
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>({
    selectedChannel: null,
    searchQuery: '',
    channels: ['whatsapp', 'telegram', 'web'],
    conversations: [],
    conversationFilters: {},
    selectedConversation: null,
    messages: [],
    agentSuggestions: [],
    availableAgents: [],
    selectedAgents: [],
    agentTeams: [],
    autoDispatchConfig: {
      enabled: true,
      rules: []
    }
  });

  // 初始化数据
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // 并行加载数据
      const [conversationsRes, agentsRes, teamsRes] = await Promise.all([
        fetch('/api/conversations'),
        fetch('/api/agents'),
        fetch('/api/agent-teams')
      ]);

      const conversations = await conversationsRes.json();
      const agents = await agentsRes.json();
      const teams = await teamsRes.json();

      setWorkspaceState(prev => ({
        ...prev,
        conversations,
        availableAgents: agents,
        agentTeams: teams
      }));
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  };

  // 选择对话
  const selectConversation = async (conversation: Conversation) => {
    setWorkspaceState(prev => ({ ...prev, selectedConversation: conversation }));

    // 加载对话消息
    try {
      const messagesRes = await fetch(`/api/conversations/${conversation.id}/messages`);
      const messages = await messagesRes.json();

      // 加载智能体建议
      const suggestionsRes = await fetch(`/api/conversations/${conversation.id}/agent-suggestions`);
      const agentSuggestions = await suggestionsRes.json();

      setWorkspaceState(prev => ({
        ...prev,
        messages,
        agentSuggestions
      }));
    } catch (error) {
      console.error('Failed to load conversation data:', error);
    }
  };

  return (
    <div className="multi-agent-workspace">
      <TopBar
        channels={workspaceState.channels}
        selectedChannel={workspaceState.selectedChannel}
        searchQuery={workspaceState.searchQuery}
        onChannelChange={(channel) => setWorkspaceState(prev => ({ ...prev, selectedChannel: channel }))}
        onSearchChange={(query) => setWorkspaceState(prev => ({ ...prev, searchQuery: query }))}
      />

      <MainLayout>
        <SidebarConversations
          conversations={workspaceState.conversations}
          filters={workspaceState.conversationFilters}
          selectedConversation={workspaceState.selectedConversation}
          onSelectConversation={selectConversation}
          onFiltersChange={(filters) => setWorkspaceState(prev => ({ ...prev, conversationFilters: filters }))}
        />

        <ConversationPanel
          conversation={workspaceState.selectedConversation}
          messages={workspaceState.messages}
          agentSuggestions={workspaceState.agentSuggestions}
          onSendMessage={async (content) => {
            // 发送消息逻辑
            if (workspaceState.selectedConversation) {
              await fetch(`/api/conversations/${workspaceState.selectedConversation.id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, senderType: 'agent' })
              });
              // 重新加载消息
              selectConversation(workspaceState.selectedConversation);
            }
          }}
        />

        <AgentTeamPanel
          selectedAgents={workspaceState.selectedAgents}
          agentTeams={workspaceState.agentTeams}
          autoDispatchConfig={workspaceState.autoDispatchConfig}
          onAgentSelect={(agents) => setWorkspaceState(prev => ({ ...prev, selectedAgents: agents }))}
          onAutoDispatchChange={(config) => setWorkspaceState(prev => ({ ...prev, autoDispatchConfig: config }))}
          onManualAssign={async (conversationId, agentIds) => {
            await fetch('/api/dispatch/manual', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                conversationId,
                assignedAgentIds: agentIds,
                assignedBy: 'current-user-id'
              })
            });
          }}
        />
      </MainLayout>
    </div>
  );
};

// 顶部栏组件
interface TopBarProps {
  channels: ChannelType[];
  selectedChannel: ChannelType | null;
  searchQuery: string;
  onChannelChange: (channel: ChannelType | null) => void;
  onSearchChange: (query: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  channels,
  selectedChannel,
  searchQuery,
  onChannelChange,
  onSearchChange
}) => {
  return (
    <div className="top-bar">
      <div className="channel-selector">
        <button
          className={selectedChannel === null ? 'active' : ''}
          onClick={() => onChannelChange(null)}
        >
          全部渠道
        </button>
        {channels.map(channel => (
          <button
            key={channel}
            className={selectedChannel === channel ? 'active' : ''}
            onClick={() => onChannelChange(channel)}
          >
            {channel.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="搜索对话..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="user-menu">
        {/* 用户菜单 */}
      </div>
    </div>
  );
};

// 主布局组件
interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="main-layout">
      {children}
    </div>
  );
};

// 左侧对话列表组件
interface SidebarConversationsProps {
  conversations: Conversation[];
  filters: WorkspaceState['conversationFilters'];
  selectedConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
  onFiltersChange: (filters: WorkspaceState['conversationFilters']) => void;
}

export const SidebarConversations: React.FC<SidebarConversationsProps> = ({
  conversations,
  filters,
  selectedConversation,
  onSelectConversation,
  onFiltersChange
}) => {
  // 过滤对话
  const filteredConversations = conversations.filter(conv => {
    if (filters.status && !filters.status.includes(conv.status)) return false;
    if (filters.priority && !filters.priority.includes(conv.priority)) return false;
    return true;
  });

  return (
    <div className="sidebar-conversations">
      <div className="filters">
        {/* 筛选控件 */}
        <select
          value={filters.status?.join(',') || ''}
          onChange={(e) => onFiltersChange({
            ...filters,
            status: e.target.value ? e.target.value.split(',') as ConversationStatus[] : undefined
          })}
        >
          <option value="">全部状态</option>
          <option value="active">活跃</option>
          <option value="pending">待处理</option>
          <option value="resolved">已解决</option>
        </select>
      </div>

      <div className="conversation-list">
        {filteredConversations.map(conversation => (
          <div
            key={conversation.id}
            className={`conversation-item ${selectedConversation?.id === conversation.id ? 'selected' : ''}`}
            onClick={() => onSelectConversation(conversation)}
          >
            <div className="conversation-header">
              <span className="customer-name">{conversation.customerName}</span>
              <span className={`priority ${conversation.priority}`}>{conversation.priority}</span>
            </div>
            <div className="last-message">
              {conversation.title}
            </div>
            <div className="conversation-meta">
              <span className="channel">{conversation.channel}</span>
              <span className="unread-count">{conversation.unreadCount > 0 && `(${conversation.unreadCount})`}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 中间对话面板组件
interface ConversationPanelProps {
  conversation: Conversation | null;
  messages: Message[];
  agentSuggestions: AgentSuggestion[];
  onSendMessage: (content: string) => Promise<void>;
}

export const ConversationPanel: React.FC<ConversationPanelProps> = ({
  conversation,
  messages,
  agentSuggestions,
  onSendMessage
}) => {
  const [newMessage, setNewMessage] = useState('');

  const handleSend = async () => {
    if (newMessage.trim()) {
      await onSendMessage(newMessage);
      setNewMessage('');
    }
  };

  if (!conversation) {
    return (
      <div className="conversation-panel empty">
        <div className="empty-state">
          选择一个对话开始工作
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-panel">
      <div className="conversation-header">
        <h3>{conversation.customerName}</h3>
        <div className="conversation-info">
          <span className="channel">{conversation.channel}</span>
          <span className="status">{conversation.status}</span>
          <span className="priority">{conversation.priority}</span>
        </div>
      </div>

      <div className="messages-area">
        {messages.map(message => (
          <div key={message.id} className={`message ${message.senderType}`}>
            <div className="message-content">
              {message.content}
            </div>
            <div className="message-meta">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>

      <div className="agent-suggestions">
        {agentSuggestions.map(suggestion => (
          <div key={suggestion.agentId} className="suggestion">
            <div className="confidence">置信度: {Math.round(suggestion.confidence * 100)}%</div>
            <div className="reasoning">{suggestion.reasoning}</div>
            <div className="actions">
              {suggestion.suggestedActions.map(action => (
                <button key={action} onClick={() => {/* 执行建议动作 */}}>
                  {action}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="message-input">
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="输入消息..."
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
        />
        <button onClick={handleSend}>发送</button>
      </div>
    </div>
  );
};

// 右侧智能体团队面板组件
interface AgentTeamPanelProps {
  selectedAgents: Agent[];
  agentTeams: AgentTeam[];
  autoDispatchConfig: WorkspaceState['autoDispatchConfig'];
  onAgentSelect: (agents: Agent[]) => void;
  onAutoDispatchChange: (config: WorkspaceState['autoDispatchConfig']) => void;
  onManualAssign: (conversationId: string, agentIds: string[]) => Promise<void>;
}

export const AgentTeamPanel: React.FC<AgentTeamPanelProps> = ({
  selectedAgents,
  agentTeams,
  autoDispatchConfig,
  onAgentSelect,
  onAutoDispatchChange,
  onManualAssign
}) => {
  const [selectedConversationId, setSelectedConversationId] = useState<string>('');

  return (
    <div className="agent-team-panel">
      <div className="auto-dispatch-toggle">
        <label>
          <input
            type="checkbox"
            checked={autoDispatchConfig.enabled}
            onChange={(e) => onAutoDispatchChange({
              ...autoDispatchConfig,
              enabled: e.target.checked
            })}
          />
          自动分派
        </label>
      </div>

      <div className="agent-teams">
        {agentTeams.map(team => (
          <div key={team.id} className="team">
            <h4>{team.name}</h4>
            <div className="team-agents">
              {team.agents.map(agent => (
                <div
                  key={agent.id}
                  className={`agent ${selectedAgents.some(a => a.id === agent.id) ? 'selected' : ''} ${agent.status}`}
                  onClick={() => {
                    const isSelected = selectedAgents.some(a => a.id === agent.id);
                    if (isSelected) {
                      onAgentSelect(selectedAgents.filter(a => a.id !== agent.id));
                    } else {
                      onAgentSelect([...selectedAgents, agent]);
                    }
                  }}
                >
                  <img src={agent.avatar} alt={agent.name} className="avatar" />
                  <div className="agent-info">
                    <div className="name">{agent.name}</div>
                    <div className="status">{agent.status}</div>
                    <div className="load">负载: {agent.currentLoad}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="manual-assign">
        <input
          type="text"
          placeholder="对话ID"
          value={selectedConversationId}
          onChange={(e) => setSelectedConversationId(e.target.value)}
        />
        <button
          onClick={() => onManualAssign(selectedConversationId, selectedAgents.map(a => a.id))}
          disabled={!selectedConversationId || selectedAgents.length === 0}
        >
          手动分派
        </button>
      </div>
    </div>
  );
};

// ==================== API 对接约定 ====================

/**
 * 后端 API 对接约定
 *
 * 1. 获取对话列表
 * GET /api/conversations
 * Query 参数: ?channel=whatsapp&status=active&limit=50&offset=0
 * 响应: Conversation[]
 *
 * 2. 获取单个对话详情
 * GET /api/conversations/:id
 * 响应: Conversation
 *
 * 3. 获取对话消息
 * GET /api/conversations/:id/messages
 * Query 参数: ?limit=100&before=messageId
 * 响应: Message[]
 *
 * 4. 发送消息
 * POST /api/conversations/:id/messages
 * 请求体: { content: string, messageType?: string, metadata?: object }
 * 响应: Message
 *
 * 5. 获取智能体列表
 * GET /api/agents
 * Query 参数: ?teamId=team123&status=online
 * 响应: Agent[]
 *
 * 6. 获取智能体团队
 * GET /api/agent-teams
 * 响应: AgentTeam[]
 *
 * 7. 获取智能体建议
 * GET /api/conversations/:id/agent-suggestions
 * 响应: AgentSuggestion[]
 *
 * 8. 手动分派任务
 * POST /api/dispatch/manual
 * 请求体: { conversationId: string, assignedAgentIds: string[], assignedTeamId?: string, reason?: string }
 * 响应: { success: boolean, taskId: string }
 *
 * 9. 更新自动分派配置
 * PUT /api/dispatch/auto-config
 * 请求体: { enabled: boolean, rules: DispatchRule[] }
 * 响应: { success: boolean }
 *
 * 10. 获取工作台统计
 * GET /api/workspace/stats
 * 响应: { totalConversations: number, activeAgents: number, pendingTasks: number, ... }
 */

// ==================== 样式约定 (CSS Classes) ====================

/*
.multi-agent-workspace {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.main-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar-conversations {
  width: 300px;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
}

.conversation-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.agent-team-panel {
  width: 250px;
  border-left: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
}
*/