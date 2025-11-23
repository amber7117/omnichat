import { getPresenter } from "@/core/presenter/presenter";
import { defineExtension, Disposable } from "@cardos/extension";
import { Settings } from "lucide-react";
import { connectRouterWithActivityBar } from "@/core/utils/connect-router-with-activity-bar";
import { ModuleOrderEnum } from "@/core/config/module-order";
import { WorkbenchPage } from "../pages/workbench-page";

export const desktopWorkbenchExtension = defineExtension({
    manifest: {
        id: "workbench",
        name: "客服工作台",
        description: "多智能体客服工作台",
        version: "1.0.0",
        author: "OmniChat",
        icon: "workbench",
    },
    activate: ({ subscriptions }) => {
        const presenter = getPresenter();
        subscriptions.push(Disposable.from(presenter.icon.addIcons({
            "workbench": Settings,
        })))
        subscriptions.push(Disposable.from(presenter.activityBar.addItem({
            id: "workbench",
            label: "工作台",
            title: "客服工作台",
            group: "main",
            icon: "workbench",
            order: ModuleOrderEnum.WORKBENCH,
        })))

        subscriptions.push(Disposable.from(presenter.routeTree.addRoutes([{
            id: "workbench",
            path: "/workbench",
            order: 0,
            element: <WorkbenchPage />,
        }
        ])))

        subscriptions.push(Disposable.from(connectRouterWithActivityBar([
            {
                activityKey: "workbench",
                routerPath: "/workbench",
            },
        ])))
    },
})