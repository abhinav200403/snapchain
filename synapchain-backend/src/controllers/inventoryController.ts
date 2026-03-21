import { Request, Response } from 'express';
import pool from '../config/db';

// GET /api/inventory
export async function listProducts(req: Request, res: Response): Promise<void> {
  const result = await pool.query(
    `SELECT p.id, p.name, p.sku, p.category, p.stock_quantity, p.reorder_level,
            p.unit_price, p.supplier_id, s.name AS supplier_name,
            p.stock_quantity <= p.reorder_level AS low_stock,
            p.created_at, p.updated_at
     FROM products p
     LEFT JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.company_id = $1
     ORDER BY p.name`,
    [req.user!.companyId]
  );
  res.json(result.rows);
}

// POST /api/inventory
export async function createProduct(req: Request, res: Response): Promise<void> {
  const { name, sku, category, stock_quantity, reorder_level, unit_price, supplier_id } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Product name is required' });
    return;
  }

  // Validate supplier belongs to same company
  if (supplier_id) {
    const sup = await pool.query('SELECT id FROM suppliers WHERE id = $1 AND company_id = $2', [supplier_id, req.user!.companyId]);
    if (sup.rows.length === 0) {
      res.status(400).json({ error: 'Invalid supplier' });
      return;
    }
  }

  const result = await pool.query(
    `INSERT INTO products (company_id, name, sku, category, stock_quantity, reorder_level, unit_price, supplier_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, name, sku, category, stock_quantity, reorder_level, unit_price, supplier_id, created_at`,
    [req.user!.companyId, name, sku || null, category || null,
     stock_quantity || 0, reorder_level || 10, unit_price || 0, supplier_id || null]
  );
  res.status(201).json(result.rows[0]);
}

// PATCH /api/inventory/:id
export async function updateProduct(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, sku, category, stock_quantity, reorder_level, unit_price, supplier_id } = req.body;

  const result = await pool.query(
    `UPDATE products SET
       name = COALESCE($1, name),
       sku = COALESCE($2, sku),
       category = COALESCE($3, category),
       stock_quantity = COALESCE($4, stock_quantity),
       reorder_level = COALESCE($5, reorder_level),
       unit_price = COALESCE($6, unit_price),
       supplier_id = COALESCE($7, supplier_id),
       updated_at = NOW()
     WHERE id = $8 AND company_id = $9
     RETURNING id, name, sku, category, stock_quantity, reorder_level, unit_price, supplier_id, updated_at`,
    [name || null, sku || null, category || null, stock_quantity ?? null,
     reorder_level ?? null, unit_price ?? null, supplier_id || null, id, req.user!.companyId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json(result.rows[0]);
}

// DELETE /api/inventory/:id
export async function deleteProduct(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const result = await pool.query(
    `DELETE FROM products WHERE id = $1 AND company_id = $2 RETURNING id`,
    [id, req.user!.companyId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json({ message: 'Product deleted' });
}
