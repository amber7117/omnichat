import { getPresenter } from "@/core/presenter/presenter";
import { useIconStore } from "@/core/stores/icon.store";
import { useRouteTreeStore } from "@/core/stores/route-tree.store";
import { connectRouterWithActivityBar } from "@/core/utils/connect-router-with-activity-bar";
import { defineExtension, Disposable } from "@cardos/extension";
import { Plug } from "lucide-react";
import { PluginsLayout } from "../pages/plugins-layout";
import { PluginsMarketplacePage } from "../pages/plugins-marketplace-page";
import { MyAppsPage } from "../pages/developer/my-apps-page";
import { ModuleOrderEnum } from "@/core/config/module-order";

export const desktopPluginsExtension = defineExtension({
    manifest: {
        id: "plugins",
        name: "Plugins",
        description: "Plugin Marketplace and Manager",
        version: "1.0.0",
        author: "OmniChat",
        icon: "plug",
    },
    activate: ({ subscriptions }) => {
        console.warn("Activating Plugins Extension");
        subscriptions.push(Disposable.from(useIconStore.getState().addIcons({
            "plug": Plug,
        })))
        subscriptions.push(Disposable.from(getPresenter().activityBar.addItem({
            id: "plugins",
            label: "Plugins",
            title: "Plugins",
            group: "main",
            icon: "plug",
            order: ModuleOrderEnum.PLUGINS,
        })))
        
        // Add Root Route
        subscriptions.push(Disposable.from(useRouteTreeStore.getState().addRoutes([
            {
                id: "plugins-root",
                path: "/plugins",
                element: <PluginsLayout />,
                children: [
                    {
                        id: "plugins-marketplace",
                        path: "", // Index route
                        element: <PluginsMarketplacePage />,
                        index: true,
                    },
                    {
                        id: "plugins-developer",
                        path: "developer",
                        element: <MyAppsPage />,
                    }
                ]
            }
        ])))

        subscriptions.push(Disposable.from(connectRouterWithActivityBar([
            {
                activityKey: "plugins",
                routerPath: "/plugins",
            },
        ])))
    },
});
