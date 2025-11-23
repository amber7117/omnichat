import { useRouteTreeStore } from "@/core/stores/route-tree.store";
import { defineExtension, Disposable } from '@cardos/extension';
import { MobileLoginPage } from './pages/login-page';
import { MobileRegisterPage } from './pages/register-page';

export const mobileAuthExtension = defineExtension({
  manifest: {
    id: 'mobile-auth',
    name: 'Mobile Authentication',
    version: '1.0.0',
    description: '移动端用户认证系统',
  },
  activate: ({ subscriptions }) => {
    subscriptions.push(Disposable.from(useRouteTreeStore.getState().addRoutes([
      {
        id: 'login',
        path: '/login',
        element: <MobileLoginPage />,
      },
      {
        id: 'register',
        path: '/register',
        element: <MobileRegisterPage />,
      }
    ])))
  },
});
