import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User, AppRole } from '@/types/roles';
import api from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: AppRole) => Promise<void>;
  register: (companyName: string, companyEmail: string, name: string, email: string, password: string) => Promise<void>;
}

const DEMO_CREDENTIALS: Record<AppRole, { email: string; password: string }> = {
  admin: { email: 'admin@synapchain.ai', password: 'Demo@12345' },
  operations_manager: { email: 'ops@synapchain.ai', password: 'Demo@12345' },
  supplier: { email: 'supplier@synapchain.ai', password: 'Demo@12345' },
  business_analyst: { email: 'analyst@synapchain.ai', password: 'Demo@12345' },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { setIsLoading(false); return; }
    api.get('/auth/me')
      .then((res) => {
        const u = res.data;
        setUser({ id: u.id, email: u.email, name: u.name, role: u.role, companyId: u.companyId, companyName: u.companyName, isActive: u.isActive, emailVerified: u.emailVerified ?? true });
      })
      .catch(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { accessToken, refreshToken, user: u } = res.data;
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    setUser({ id: u.id, email: u.email, name: u.name, role: u.role, companyId: u.companyId, companyName: u.companyName, isActive: true, emailVerified: u.emailVerified ?? true });
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    try { await api.post('/auth/logout', { refreshToken }); } catch { /* ignore */ }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  }, []);

  const switchRole = useCallback(async (role: AppRole) => {
    const creds = DEMO_CREDENTIALS[role];
    await login(creds.email, creds.password);
  }, [login]);

  const register = useCallback(async (companyName: string, companyEmail: string, name: string, email: string, password: string) => {
    const res = await api.post('/auth/register', { companyName, companyEmail, name, email, password });
    const { accessToken, refreshToken, user: u } = res.data;
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    setUser({ id: u.id, email: u.email, name: u.name, role: u.role, companyId: u.companyId, companyName: companyName, isActive: true, emailVerified: u.emailVerified ?? false });
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, switchRole, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
