import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './use-auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // 加载中显示loading
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          <p className="text-gray-600">正在验证...</p>
        </div>
      </div>
    );
  }

  // 未登录重定向到登录页
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 已登录显示内容
  return <>{children}</>;
}
