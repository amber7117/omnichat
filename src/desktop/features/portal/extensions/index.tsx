import { getPresenter } from "@/core/presenter/presenter";
import { useIconStore } from "@/core/stores/icon.store";
import { useRouteTreeStore } from "@/core/stores/route-tree.store";
import { connectRouterWithActivityBar } from "@/core/utils/connect-router-with-activity-bar";
import { defineExtension, Disposable } from "@cardos/extension";
import { Link } from "lucide-react";
import { PortalPage } from "../pages/portal-page";
import { ModuleOrderEnum } from "@/core/config/module-order";

export const desktopPortalExtension = defineExtension({
    manifest: {
        id: "portal",
        name: "Portal",
        description: "Service Bus Portal 控制台",
        version: "1.0.0",
        author: "OmniChat",
        icon: "link",
    },
    activate: ({ subscriptions }) => {
        subscriptions.push(Disposable.from(useIconStore.getState().addIcons({
            "link": Link,
        })))
        subscriptions.push(Disposable.from(getPresenter().activityBar.addItem({
            id: "portal",
            label: "Portal",
            title: "Service Bus Portal",
            group: "main",
            icon: "link",
            order: ModuleOrderEnum.MCP + 1, // 放在 MCP 后面
        })))
        subscriptions.push(Disposable.from(useRouteTreeStore.getState().addRoutes([
            {
                id: "portal",
                path: "/portal",
                element: <PortalPage />,
            }
        ])))
        subscriptions.push(Disposable.from(connectRouterWithActivityBar([
            {
                activityKey: "portal",
                routerPath: "/portal",
            },
        ])))
    },
}); 
