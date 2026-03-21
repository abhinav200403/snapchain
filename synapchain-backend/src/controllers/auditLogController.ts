import { Request, Response } from 'express';
import pool from '../config/db';

// GET /api/audit
export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  const { action, resource, page = '1', limit = '50' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let query = `
    SELECT al.id, al.action, al.resource, al.resource_id, al.details,
           al.ip_address, al.created_at, u.name AS user_name, u.email AS user_email
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE al.company_id = $1
  `;
  const params: unknown[] = [req.user!.companyId];

  if (action) {
    params.push(action);
    query += ` AND al.action = $${params.length}`;
  }
  if (resource) {
    params.push(resource);
    query += ` AND al.resource = $${params.length}`;
  }

  query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(Number(limit), offset);

  const [result, countResult] = await Promise.all([
    pool.query(query, params),
    pool.query(
      `SELECT COUNT(*) AS total FROM audit_logs WHERE company_id = $1`,
      [req.user!.companyId]
    ),
  ]);

  res.json({
    logs: result.rows,
    total: Number(countResult.rows[0].total),
    page: Number(page),
    limit: Number(limit),
  });
}
