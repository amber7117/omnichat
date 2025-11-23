// ✅ Platform Integration Extension
import { getPresenter } from "@/core/presenter/presenter";
import { useIconStore } from "@/core/stores/icon.store";
import { useRouteTreeStore } from "@/core/stores/route-tree.store";
import { connectRouterWithActivityBar } from "@/core/utils/connect-router-with-activity-bar";
import { defineExtension, Disposable } from "@cardos/extension";
import { Settings } from "lucide-react";
import { PlatformsPage } from "../pages/platforms-page";
import { ModuleOrderEnum } from "@/core/config/module-order";


export const desktopPlatformsExtension = defineExtension({
    manifest: {
        id: "platforms",
        name: "Platforms",
        description: "多租户平台集成管理",
        version: "1.0.0",
        author: "OmniChat",
        icon: "settings",
    },
    activate: ({ subscriptions }) => {
        subscriptions.push(Disposable.from(useIconStore.getState().addIcons({
            "settings": Settings,
        })))
        subscriptions.push(Disposable.from(getPresenter().activityBar.addItem({
            id: "platforms",
            label: "平台集成",
            title: "Platform Integration",
            group: "main",
            icon: "settings",
            order: ModuleOrderEnum.SETTINGS - 1,
        })))
        subscriptions.push(Disposable.from(useRouteTreeStore.getState().addRoutes([
            {
                id: "platforms",
                path: "/platforms",
                element: (
                   
                        <PlatformsPage />
                   
                ),
            }
        ])))
        subscriptions.push(Disposable.from(connectRouterWithActivityBar([
            {
                activityKey: "platforms",
                routerPath: "/platforms",
            },
        ])))
    },
}); 