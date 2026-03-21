import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/types/roles';

interface RoleGuardProps {
  allowed: AppRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowed, children, fallback = null }) => {
  const { user } = useAuth();
  if (!user || !allowed.includes(user.role)) return <>{fallback}</>;
  return <>{children}</>;
};
