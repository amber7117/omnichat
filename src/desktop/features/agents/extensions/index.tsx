import { getPresenter } from "@/core/presenter/presenter";
import { useIconStore } from "@/core/stores/icon.store";
import { useRouteTreeStore } from "@/core/stores/route-tree.store";
import { connectRouterWithActivityBar } from "@/core/utils/connect-router-with-activity-bar";
import { defineExtension, Disposable } from "@cardos/extension";
import { Bot } from "lucide-react";
import { AgentsPage } from "../pages/agents-page";
import { AgentDetailPage } from "../pages/agent-detail-page";
import { ModuleOrderEnum } from "@/core/config/module-order";
import { AgentSettingsPage } from "../pages/agent-settings-page";


export const desktopAgentsExtension = defineExtension({
    manifest: {
        id: "agents",
        name: "Agents",
        description: "Agents",
        version: "1.0.0",
        author: "OmniChat",
        icon: "bot",
    },
    activate: ({ subscriptions }) => {
        subscriptions.push(Disposable.from(useIconStore.getState().addIcons({
            "bot": Bot,
        })))
        subscriptions.push(Disposable.from(getPresenter().activityBar.addItem({
            id: "agents",
            label: "智能体",
            title: "智能体管理",
            group: "main",
            icon: "bot",
            order: ModuleOrderEnum.AGENTS,
        })))
        subscriptions.push(Disposable.from(useRouteTreeStore.getState().addRoutes([
            {
                id: "agents",
                path: "/agents",
                element: <AgentsPage />,
            },
            {
                id: "agent-detail",
                path: "/agents/:agentId",
                element: <AgentDetailPage />,
            },
            {
                id: "agent-settings",
                path: "/agent-settings",
                element: <AgentSettingsPage />,
            }
        ])))
        subscriptions.push(Disposable.from(connectRouterWithActivityBar([
            {
                activityKey: "agents",
                routerPaths: ["/agents", "/agents/:agentId", "/agent-settings"],
            },
        ])))
    },
});
