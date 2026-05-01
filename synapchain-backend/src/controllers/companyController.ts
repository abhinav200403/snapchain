import { Request, Response } from 'express';
import { query } from '../config/db';

// GET /api/company
export async function getCompany(req: Request, res: Response): Promise<void> {
  const result = await query(
    `SELECT id, name, email, plan, is_active, created_at FROM companies WHERE id = $1`,
    [req.user!.companyId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }
  res.json(result.rows[0]);
}

// PATCH /api/company
export async function updateCompany(req: Request, res: Response): Promise<void> {
  const { name } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Company name is required' });
    return;
  }
  const result = await query(
    `UPDATE companies SET name = $1 WHERE id = $2
     RETURNING id, name, email, plan`,
    [name.trim(), req.user!.companyId]
  );
  res.json(result.rows[0]);
}
