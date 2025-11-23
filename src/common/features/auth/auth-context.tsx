import React, { createContext, useEffect, useState } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  tenantId: string;
  createdAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// 统一处理登录/注册响应的 helper
async function handleAuthResponse(
  res: Response,
  defaultError: string
): Promise<{ userData: AuthUser; accessToken: string }> {
  let data: {
    user?: AuthUser;
    data?: {
      user?: AuthUser;
      token?: string;
      accessToken?: string;
    };
    accessToken?: string;
    token?: string;
    error?: string;
    message?: string;
    msg?: string;
  } | null = null;

  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const message =
      data?.error ||
      data?.message ||
      data?.msg ||
      defaultError;
    throw new Error(message);
  }

  const userData: AuthUser | undefined =
    data?.user ?? data?.data?.user;
  const accessToken: string | undefined =
    data?.accessToken ??
    data?.token ??
    data?.data?.token ??
    data?.data?.accessToken;

  if (!userData || !accessToken) {
    throw new Error('Invalid auth response from server');
  }

  return { userData, accessToken };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize from localStorage
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('auth_user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (err) {
      console.error('[AUTH_INIT_ERROR]', err);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('tenantId');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const { userData, accessToken } = await handleAuthResponse(
        res,
        'Login failed'
      );

      setUser(userData);
      setToken(accessToken);

      localStorage.setItem('auth_token', accessToken);
      localStorage.setItem('auth_user', JSON.stringify(userData));

      if (userData.tenantId) {
        localStorage.setItem('tenantId', userData.tenantId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      console.error('[LOGIN_ERROR]', err);
      setError(message);
      setUser(null);
      setToken(null);
      // 保留 throw，方便调用方 await login() 时捕获
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, name?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      const { userData, accessToken } = await handleAuthResponse(
        res,
        'Register failed'
      );

      setUser(userData);
      setToken(accessToken);

      localStorage.setItem('auth_token', accessToken);
      localStorage.setItem('auth_user', JSON.stringify(userData));

      if (userData.tenantId) {
        localStorage.setItem('tenantId', userData.tenantId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Register failed';
      console.error('[REGISTER_ERROR]', err);
      setError(message);
      setUser(null);
      setToken(null);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setError(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('tenantId');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        error,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
