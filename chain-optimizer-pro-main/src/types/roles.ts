export type AppRole = 'admin' | 'operations_manager' | 'supplier' | 'business_analyst';

export interface User {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  companyId: string;
  companyName: string;
  avatar?: string;
  isActive: boolean;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  operations_manager: 'Operations Manager',
  supplier: 'Supplier',
  business_analyst: 'Business Analyst',
};

export const ROLE_COLORS: Record<AppRole, string> = {
  admin: 'bg-primary text-primary-foreground',
  operations_manager: 'bg-info text-info-foreground',
  supplier: 'bg-warning text-warning-foreground',
  business_analyst: 'bg-accent text-accent-foreground',
};
