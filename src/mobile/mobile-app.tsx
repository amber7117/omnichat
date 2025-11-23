import { useBreakpointContext } from "@/common/components/common/breakpoint-provider";
import { useTheme } from "@/common/components/common/theme";
import { commonAgentsExtension } from "@/common/features/agents/extensions";
import { settingsExtension } from "@/common/features/settings/extensions";
import { allInOneAgentExtension } from "@/common/features/all-in-one-agent";
import { cn } from "@/common/lib/utils";
import { useSetupApp } from "@/core/hooks/use-setup-app";
import { useAppBootstrap } from "@/core/hooks/use-app-bootstrap";
import { useViewportHeight } from "@/core/hooks/useViewportHeight";
import { mobileChatExtension } from "@/mobile/features/chat/extensions";
import { mobileAuthExtension } from "@/mobile/features/auth";
import { useEffect } from "react";
import { HashRouter, useNavigate, useLocation } from "react-router-dom";
import { PluginRouter } from "@/common/components/common/plugin-router";
import { useAuth } from "@/common/features/auth";

// 场景类型
export function MobileAppInner() {
  useAppBootstrap();
  const { initialized } = useSetupApp({
    extensions: [
      mobileAuthExtension,
      allInOneAgentExtension,
      mobileChatExtension,
      commonAgentsExtension,
      settingsExtension,
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
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">正在验证...</p>
        </div>
      </div>
    );
  }

  // 初始化插件中
  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">初始化中...</p>
        </div>
      </div>
    );
  }

  // 移动端布局
  return (
    <div className="fixed inset-0 flex flex-col" style={{ height }}>
      <div className={cn(rootClassName, "flex flex-col h-full")}>
        <PluginRouter />
      </div>
    </div>
  );
}

export function MobileApp() {
  return (
    <HashRouter>
      <MobileAppInner />
    </HashRouter>
  );
}
