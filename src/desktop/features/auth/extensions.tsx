import { useRouteTreeStore } from "@/core/stores/route-tree.store";
import { defineExtension, Disposable } from '@cardos/extension';
import { LoginPage } from './pages/login-page';
import { RegisterPage } from './pages/register-page';

export const desktopAuthExtension = defineExtension({
  manifest: {
    id: 'desktop-auth',
    name: 'Authentication',
    version: '1.0.0',
    description: '用户认证系统',
  },
  activate: ({ subscriptions }) => {
    subscriptions.push(Disposable.from(useRouteTreeStore.getState().addRoutes([
      {
        id: 'login',
        path: '/login',
        element: <LoginPage />,
      },
      {
        id: 'register',
        path: '/register',
        element: <RegisterPage />,
      }
    ])))
  },
});
