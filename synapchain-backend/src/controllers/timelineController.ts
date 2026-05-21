import { Request, Response } from 'express';
import { validate as isUUID } from 'uuid';
import { query } from '../config/db';

// ─── logEvent helper ──────────────────────────────────────────────────────────
// Called from other controllers to record an activity event on an order.

export async function logEvent(
  companyId: string,
  orderId: string,
  userId: string | null,
  eventType: string,
  message: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await query(
      `INSERT INTO order_events (company_id, order_id, user_id, event_type, message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [companyId, orderId, userId || null, eventType, message, JSON.stringify(metadata)],
    );
  } catch (err: any) {
    // Timeline logging should never break main operations
    console.error('logEvent error:', err.message);
  }
}

// ─── GET /api/orders/:id/timeline ────────────────────────────────────────────

export async function getOrderTimeline(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!isUUID(id)) { res.status(400).json({ error: 'Invalid order ID' }); return; }

  // Verify order belongs to company
  const orderCheck = await query(
    `SELECT id FROM orders WHERE id = $1 AND company_id = $2`,
    [id, req.user!.companyId],
  );
  if (orderCheck.rows.length === 0) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  const result = await query(
    `SELECT oe.id, oe.event_type, oe.message, oe.metadata, oe.created_at,
            u.name AS user_name, u.role AS user_role
     FROM order_events oe
     LEFT JOIN users u ON u.id = oe.user_id
     WHERE oe.order_id = $1
     ORDER BY oe.created_at DESC`,
    [id],
  );
  res.json(result.rows);
}
