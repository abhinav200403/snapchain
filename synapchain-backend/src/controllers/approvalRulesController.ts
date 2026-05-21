import { Request, Response } from 'express';
import { validate as isUUID } from 'uuid';
import { query } from '../config/db';

// ─── GET /api/approval-rules ──────────────────────────────────────────────────

export async function listApprovalRules(req: Request, res: Response): Promise<void> {
  const result = await query(
    `SELECT * FROM approval_rules WHERE company_id = $1 ORDER BY min_amount ASC`,
    [req.user!.companyId],
  );
  res.json(result.rows);
}

// ─── POST /api/approval-rules ─────────────────────────────────────────────────

export async function createApprovalRule(req: Request, res: Response): Promise<void> {
  const { name, min_amount, max_amount, required_role } = req.body;

  if (!name || !String(name).trim()) {
    res.status(400).json({ error: 'Rule name is required' }); return;
  }
  const validRoles = ['admin', 'operations_manager'];
  if (required_role && !validRoles.includes(required_role)) {
    res.status(400).json({ error: `required_role must be one of: ${validRoles.join(', ')}` }); return;
  }

  const result = await query(
    `INSERT INTO approval_rules (company_id, name, min_amount, max_amount, required_role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      req.user!.companyId,
      name.trim(),
      min_amount != null ? Number(min_amount) : 0,
      max_amount != null ? Number(max_amount) : null,
      required_role || 'admin',
    ],
  );
  res.status(201).json(result.rows[0]);
}

// ─── PATCH /api/approval-rules/:id ───────────────────────────────────────────

export async function updateApprovalRule(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!isUUID(id)) { res.status(400).json({ error: 'Invalid rule ID' }); return; }

  const { name, min_amount, max_amount, required_role, is_active } = req.body;

  const result = await query(
    `UPDATE approval_rules SET
       name = COALESCE($1, name),
       min_amount = COALESCE($2, min_amount),
       max_amount = COALESCE($3, max_amount),
       required_role = COALESCE($4, required_role),
       is_active = COALESCE($5, is_active)
     WHERE id = $6 AND company_id = $7
     RETURNING *`,
    [
      name || null,
      min_amount != null ? Number(min_amount) : null,
      max_amount != null ? Number(max_amount) : null,
      required_role || null,
      is_active != null ? Boolean(is_active) : null,
      id,
      req.user!.companyId,
    ],
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Approval rule not found' }); return;
  }
  res.json(result.rows[0]);
}

// ─── DELETE /api/approval-rules/:id ──────────────────────────────────────────

export async function deleteApprovalRule(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!isUUID(id)) { res.status(400).json({ error: 'Invalid rule ID' }); return; }

  const result = await query(
    `DELETE FROM approval_rules WHERE id = $1 AND company_id = $2 RETURNING id`,
    [id, req.user!.companyId],
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Approval rule not found' }); return;
  }
  res.json({ message: 'Rule deleted' });
}

// ─── Helper: check if user's role can approve this amount ────────────────────

export async function checkApprovalPermission(
  companyId: string,
  amount: number,
  userRole: string,
): Promise<{ allowed: boolean; required_role?: string; rule_name?: string }> {
  const result = await query(
    `SELECT * FROM approval_rules
     WHERE company_id = $1
       AND is_active = true
       AND min_amount <= $2
       AND (max_amount IS NULL OR max_amount >= $2)
     ORDER BY min_amount DESC
     LIMIT 1`,
    [companyId, amount],
  );

  if (result.rows.length === 0) return { allowed: true };

  const rule = result.rows[0];
  const requiredRole = rule.required_role;

  // Role hierarchy: admin > operations_manager
  const roleRank: Record<string, number> = {
    admin: 2,
    operations_manager: 1,
    supplier: 0,
    business_analyst: 0,
  };

  const userRank = roleRank[userRole] ?? 0;
  const requiredRank = roleRank[requiredRole] ?? 0;

  if (userRank >= requiredRank) {
    return { allowed: true };
  }

  return { allowed: false, required_role: requiredRole, rule_name: rule.name };
}
