export type AppRole = 'admin' | 'operations_manager' | 'supplier' | 'business_analyst';

export interface JwtPayload {
  userId: string;
  companyId: string;
  role: AppRole;
  email: string;
}

export interface AuthRequest extends Express.Request {
  user?: JwtPayload;
}

// Augment Express
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
