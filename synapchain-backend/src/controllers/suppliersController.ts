import { Request, Response } from 'express';
import pool from '../config/db';

// GET /api/suppliers
export async function listSuppliers(req: Request, res: Response): Promise<void> {
  const result = await pool.query(
    `SELECT id, name, email, phone, rating, lead_time_days, is_active, created_at
     FROM suppliers WHERE company_id = $1 ORDER BY name`,
    [req.user!.companyId]
  );
  res.json(result.rows);
}

// POST /api/suppliers
export async function createSupplier(req: Request, res: Response): Promise<void> {
  const { name, email, phone, rating, lead_time_days } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Supplier name is required' });
    return;
  }

  const result = await pool.query(
    `INSERT INTO suppliers (company_id, name, email, phone, rating, lead_time_days)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, email, phone, rating, lead_time_days, is_active, created_at`,
    [req.user!.companyId, name, email || null, phone || null, rating || 0, lead_time_days || 7]
  );
  res.status(201).json(result.rows[0]);
}

// PATCH /api/suppliers/:id
export async function updateSupplier(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, email, phone, rating, lead_time_days, is_active } = req.body;

  const result = await pool.query(
    `UPDATE suppliers SET
       name = COALESCE($1, name),
       email = COALESCE($2, email),
       phone = COALESCE($3, phone),
       rating = COALESCE($4, rating),
       lead_time_days = COALESCE($5, lead_time_days),
       is_active = COALESCE($6, is_active)
     WHERE id = $7 AND company_id = $8
     RETURNING id, name, email, phone, rating, lead_time_days, is_active`,
    [name || null, email || null, phone || null, rating ?? null, lead_time_days ?? null, is_active ?? null, id, req.user!.companyId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Supplier not found' });
    return;
  }
  res.json(result.rows[0]);
}

// DELETE /api/suppliers/:id
export async function deleteSupplier(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const result = await pool.query(
    `UPDATE suppliers SET is_active = false WHERE id = $1 AND company_id = $2 RETURNING id`,
    [id, req.user!.companyId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Supplier not found' });
    return;
  }
  res.json({ message: 'Supplier deactivated' });
}
