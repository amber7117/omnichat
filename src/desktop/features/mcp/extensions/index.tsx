import { useIconStore } from "@/core/stores/icon.store";
import { useRouteTreeStore } from "@/core/stores/route-tree.store";
import { defineExtension, Disposable } from "@cardos/extension";
import { Cpu } from "lucide-react";
import { MCPDemoPage } from "../pages/mcp-demo-page";

export const desktopMCPExtension = defineExtension({
    manifest: {
        id: "mcp",
        name: "MCP Tools",
        description: "Model Context Protocol tools integration",
        version: "1.0.0",
        author: "OmniChat",
        icon: "server",
    },
    activate: ({ subscriptions }) => {
        subscriptions.push(Disposable.from(useIconStore.getState().addIcons({
            "cpu": Cpu,
        })))

        subscriptions.push(Disposable.from(useRouteTreeStore.getState().addRoutes([
            {
                id: "mcp-demo",
                path: "mcp",
                element: <MCPDemoPage />,
            }
        ], "plugins-root")))
    },
});
