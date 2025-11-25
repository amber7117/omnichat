import { useIconStore } from "@/core/stores/icon.store";
import { useRouteTreeStore } from "@/core/stores/route-tree.store";
import { defineExtension, Disposable } from "@cardos/extension";
import { Link } from "lucide-react";
import { PortalPage } from "../pages/portal-page";

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

        subscriptions.push(Disposable.from(useRouteTreeStore.getState().addRoutes([
            {
                id: "portal",
                path: "portal",
                element: <PortalPage />,
            }
        ], "plugins-root")))
    },
}); 
