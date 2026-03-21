import { Request, Response } from 'express';
import pool, { query } from '../config/db';

// GET /api/orders
export async function listOrders(req: Request, res: Response): Promise<void> {
  const { status } = req.query;
  let sql = `
    SELECT o.id, o.status, o.total_amount, o.expected_delivery, o.notes, o.created_at, o.updated_at,
           s.name AS supplier_name, u.name AS created_by_name
    FROM orders o
    LEFT JOIN suppliers s ON s.id = o.supplier_id
    LEFT JOIN users u ON u.id = o.created_by
    WHERE o.company_id = $1
  `;
  const params: unknown[] = [req.user!.companyId];

  if (status) {
    params.push(status);
    sql += ` AND o.status = $${params.length}`;
  }

  sql += ' ORDER BY o.created_at DESC';
  const result = await query(sql, params);
  res.json(result.rows);
}

// GET /api/orders/:id
export async function getOrder(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const orderRes = await query(
    `SELECT o.*, s.name AS supplier_name, u.name AS created_by_name
     FROM orders o
     LEFT JOIN suppliers s ON s.id = o.supplier_id
     LEFT JOIN users u ON u.id = o.created_by
     WHERE o.id = $1 AND o.company_id = $2`,
    [id, req.user!.companyId]
  );

  if (orderRes.rows.length === 0) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  const itemsRes = await query(
    `SELECT oi.id, oi.quantity, oi.unit_price, p.name AS product_name, p.sku
     FROM order_items oi JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1`,
    [id]
  );

  res.json({ ...orderRes.rows[0], items: itemsRes.rows });
}

// POST /api/orders
export async function createOrder(req: Request, res: Response): Promise<void> {
  const { supplier_id, expected_delivery, notes, items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'At least one order item is required' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let totalAmount = 0;
    const resolvedItems: { product_id: string; quantity: number; unit_price: number }[] = [];

    for (const item of items) {
      const prod = await client.query(
        'SELECT id, unit_price FROM products WHERE id = $1 AND company_id = $2',
        [item.product_id, req.user!.companyId]
      );
      if (prod.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: `Product ${item.product_id} not found` });
        return;
      }
      const price = item.unit_price ?? prod.rows[0].unit_price;
      totalAmount += price * item.quantity;
      resolvedItems.push({ product_id: item.product_id, quantity: item.quantity, unit_price: price });
    }

    const orderRes = await client.query(
      `INSERT INTO orders (company_id, supplier_id, created_by, total_amount, expected_delivery, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, status, total_amount, expected_delivery, notes, created_at`,
      [req.user!.companyId, supplier_id || null, req.user!.userId, totalAmount, expected_delivery || null, notes || null]
    );
    const order = orderRes.rows[0];

    for (const item of resolvedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)`,
        [order.id, item.product_id, item.quantity, item.unit_price]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...order, items: resolvedItems });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// PATCH /api/orders/:id/status
export async function updateOrderStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['pending', 'approved', 'processing', 'shipped', 'delivered', 'cancelled'];

  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const result = await query(
    `UPDATE orders SET status = $1, updated_at = NOW()
     WHERE id = $2 AND company_id = $3
     RETURNING id, status, updated_at`,
    [status, id, req.user!.companyId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  res.json(result.rows[0]);
}
