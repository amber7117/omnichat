import { PluginRouter } from "@/common/components/common/plugin-router";
import { useTheme } from "@/common/components/common/theme";
import { ActivityBarComponent } from "@/common/features/app/components/activity-bar";
import { allInOneAgentExtension } from "@/common/features/all-in-one-agent";
import { settingsExtension } from "@/common/features/settings/extensions";
import { cn } from "@/common/lib/utils";
import { useSetupApp } from "@/core/hooks/use-setup-app";
import { useAppBootstrap } from "@/core/hooks/use-app-bootstrap";
import { useViewportHeight } from "@/core/hooks/useViewportHeight";


import { desktopAgentsExtension } from "@/desktop/features/agents/extensions";
import { desktopChatExtension } from "@/desktop/features/chat/extensions";
import { desktopMCPExtension } from "@/desktop/features/mcp/extensions";
import { desktopPluginsExtension } from "@/desktop/features/plugins/extensions";
import { desktopFileManagerExtension } from "@/desktop/features/file-manager/extensions";
import { desktopPortalExtension } from "@/desktop/features/portal";
import { desktopPlatformsExtension } from "@/desktop/features/platforms";
import { desktopWorkbenchExtension } from "@/desktop/features/workbench/extensions";
import { desktopAuthExtension } from "@/desktop/features/auth";
import { pricingExtension } from "@/common/features/pricing/extensions";
import { HashRouter, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/common/features/auth";
import { useEffect } from "react";

export function DesktopAppInner() {
  useAppBootstrap();
  const { initialized } = useSetupApp({
    extensions: [
      desktopAuthExtension,
      allInOneAgentExtension,
      desktopWorkbenchExtension,
      desktopChatExtension,
      desktopAgentsExtension,
      settingsExtension,
      desktopPluginsExtension,
      desktopMCPExtension,
      desktopPortalExtension,
      desktopPlatformsExtension,
      desktopFileManagerExtension,
      pricingExtension,
    ],
  });
  const { rootClassName } = useTheme();
  const { height } = useViewportHeight();
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 定义公开路径（不需要登录）
  const publicPaths = ["/login", "/register"];
  const isPublicPath = publicPaths.includes(location.pathname);

  // 已登录用户访问登录/注册页面时重定向到首页
  useEffect(() => {
    if (isLoading) return;

    if (user && isPublicPath) {
      navigate("/", { replace: true });
    }
  }, [user, isLoading, isPublicPath, navigate]);

  // 未登录用户访问受保护路由时重定向到登录页
  useEffect(() => {
    if (isLoading) return;

    if (!user && !isPublicPath) {
      navigate("/login", { replace: true, state: { from: location } });
    }
  }, [user, isLoading, isPublicPath, navigate, location]);

  // 加载认证状态时显示加载动画
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          <p className="text-gray-600">正在加载...</p>
        </div>
      </div>
    );
  }

  // 初始化插件中
  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          <p className="text-gray-600">初始化中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ height }}>
      <div className={cn(rootClassName, "flex flex-col h-full")}>
        <div className="flex-1 min-h-0 flex">
          {/* 登录/注册页面不显示侧边栏 */}
          {!isPublicPath && <ActivityBarComponent className="flex" />}
          <PluginRouter />
        </div>
      </div>
    </div>
  );
}

export function DesktopApp() {
  // 桌面端路由, 和mobile端不共享路由实例
  return (

    <HashRouter>

      <DesktopAppInner />


    </HashRouter>

  );
}
