import { Request, Response, NextFunction } from 'express';
import pool from '../config/db';

export function auditLog(resource: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      // Only log on mutating methods with success status
      if (['POST', 'PATCH', 'DELETE'].includes(req.method) && res.statusCode < 400 && req.user) {
        const resourceId = req.params.id || body?.id || null;
        pool.query(
          `INSERT INTO audit_logs (company_id, user_id, action, resource, resource_id, details, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6, $7::inet)`,
          [
            req.user.companyId,
            req.user.userId,
            req.method,
            resource,
            resourceId,
            JSON.stringify({ body: req.body }),
            req.ip || null,
          ]
        ).catch((err) => console.error('Audit log error:', err));
      }
      return originalJson(body);
    };
    next();
  };
}
