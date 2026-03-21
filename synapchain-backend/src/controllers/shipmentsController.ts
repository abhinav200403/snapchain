import { Request, Response } from 'express';
import pool from '../config/db';

// GET /api/shipments
export async function listShipments(req: Request, res: Response): Promise<void> {
  const result = await pool.query(
    `SELECT sh.id, sh.tracking_number, sh.carrier, sh.status, sh.origin, sh.destination,
            sh.shipped_at, sh.estimated_arrival, sh.delivered_at, sh.created_at,
            o.id AS order_id
     FROM shipments sh
     LEFT JOIN orders o ON o.id = sh.order_id
     WHERE sh.company_id = $1
     ORDER BY sh.created_at DESC`,
    [req.user!.companyId]
  );
  res.json(result.rows);
}

// POST /api/shipments
export async function createShipment(req: Request, res: Response): Promise<void> {
  const { order_id, tracking_number, carrier, origin, destination, estimated_arrival } = req.body;

  if (!origin || !destination) {
    res.status(400).json({ error: 'Origin and destination are required' });
    return;
  }

  if (order_id) {
    const orderCheck = await pool.query(
      'SELECT id FROM orders WHERE id = $1 AND company_id = $2',
      [order_id, req.user!.companyId]
    );
    if (orderCheck.rows.length === 0) {
      res.status(400).json({ error: 'Order not found' });
      return;
    }
  }

  const result = await pool.query(
    `INSERT INTO shipments (company_id, order_id, tracking_number, carrier, origin, destination, estimated_arrival, shipped_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING id, tracking_number, carrier, status, origin, destination, shipped_at, estimated_arrival, created_at`,
    [req.user!.companyId, order_id || null, tracking_number || null, carrier || null, origin, destination, estimated_arrival || null]
  );

  // Update linked order status to 'shipped'
  if (order_id) {
    await pool.query(
      `UPDATE orders SET status = 'shipped', updated_at = NOW() WHERE id = $1 AND company_id = $2`,
      [order_id, req.user!.companyId]
    );
  }

  res.status(201).json(result.rows[0]);
}

// PATCH /api/shipments/:id
export async function updateShipment(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { status, tracking_number, carrier, estimated_arrival } = req.body;
  const validStatuses = ['preparing', 'in_transit', 'out_for_delivery', 'delivered', 'delayed'];

  if (status && !validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const deliveredAt = status === 'delivered' ? new Date() : null;

  const result = await pool.query(
    `UPDATE shipments SET
       status = COALESCE($1::shipment_status, status),
       tracking_number = COALESCE($2, tracking_number),
       carrier = COALESCE($3, carrier),
       estimated_arrival = COALESCE($4, estimated_arrival),
       delivered_at = CASE WHEN $1 = 'delivered' THEN NOW() ELSE delivered_at END
     WHERE id = $5 AND company_id = $6
     RETURNING id, tracking_number, carrier, status, origin, destination, shipped_at, estimated_arrival, delivered_at`,
    [status || null, tracking_number || null, carrier || null, estimated_arrival || null, id, req.user!.companyId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Shipment not found' });
    return;
  }

  // If delivered, update linked order
  if (status === 'delivered') {
    const shipment = result.rows[0];
    const shipFull = await pool.query('SELECT order_id FROM shipments WHERE id = $1', [id]);
    if (shipFull.rows[0]?.order_id) {
      await pool.query(
        `UPDATE orders SET status = 'delivered', updated_at = NOW() WHERE id = $1`,
        [shipFull.rows[0].order_id]
      );
    }
  }

  res.json(result.rows[0]);
}
