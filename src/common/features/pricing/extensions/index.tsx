import { defineExtension, Disposable } from "@cardos/extension";
import { getPresenter } from "@/core/presenter/presenter";
import { PricingPage } from "@/components/PricingPage";

export const pricingExtension = defineExtension({
    manifest: {
        id: "pricing",
        name: "Pricing",
        description: "Pricing Page",
        version: "1.0.0",
        author: "OmniChat",
    },
    activate: ({ subscriptions }) => {
        subscriptions.push(Disposable.from(getPresenter().routeTree.addRoute({
            id: "pricing",
            path: "pricing",
            element: <PricingPage />,
            title: "Pricing",
        })));
    },
});
