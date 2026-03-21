import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/db';
import { AppRole } from '../types';

// GET /api/users
export async function listUsers(req: Request, res: Response): Promise<void> {
  const result = await pool.query(
    `SELECT id, email, name, role, is_active, created_at FROM users WHERE company_id = $1 ORDER BY created_at DESC`,
    [req.user!.companyId]
  );
  res.json(result.rows);
}

// POST /api/users
export async function createUser(req: Request, res: Response): Promise<void> {
  const { name, email, password, role } = req.body;
  const validRoles: AppRole[] = ['admin', 'operations_manager', 'supplier', 'business_analyst'];

  if (!name || !email || !password || !role) {
    res.status(400).json({ error: 'name, email, password, and role are required' });
    return;
  }
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: 'Invalid role' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'Email already in use' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 12);
  const result = await pool.query(
    `INSERT INTO users (company_id, email, name, password_hash, role) VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, name, role, is_active, created_at`,
    [req.user!.companyId, email.toLowerCase(), name, passwordHash, role]
  );
  res.status(201).json(result.rows[0]);
}

// PATCH /api/users/:id
export async function updateUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { role, is_active } = req.body;
  const validRoles: AppRole[] = ['admin', 'operations_manager', 'supplier', 'business_analyst'];

  if (role && !validRoles.includes(role)) {
    res.status(400).json({ error: 'Invalid role' });
    return;
  }

  const result = await pool.query(
    `UPDATE users SET
       role = COALESCE($1, role),
       is_active = COALESCE($2, is_active)
     WHERE id = $3 AND company_id = $4
     RETURNING id, email, name, role, is_active`,
    [role || null, is_active ?? null, id, req.user!.companyId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(result.rows[0]);
}

// DELETE /api/users/:id
export async function deleteUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  if (id === req.user!.userId) {
    res.status(400).json({ error: 'Cannot deactivate your own account' });
    return;
  }

  const result = await pool.query(
    `UPDATE users SET is_active = false WHERE id = $1 AND company_id = $2 RETURNING id`,
    [id, req.user!.companyId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ message: 'User deactivated' });
}
