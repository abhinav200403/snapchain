import { Request, Response } from 'express';
import { validate as isUUID } from 'uuid';
import pool, { query } from '../config/db';
import { logEvent } from './timelineController';
import { checkApprovalPermission } from './approvalRulesController';
import { getIo } from '../socket';

// ─── Status definitions ───────────────────────────────────────────────────────

export const ORDER_STATUSES = [
  'pending_approval',
  'approved',
  'awaiting_supplier_confirmation',
  'accepted_by_supplier',
  'processing',
  'dispatched',
  'in_transit',
  'delivered',
  'rejected',
  'cancelled',
  'partially_fulfilled',
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

// Who may move an order from one status to the next
// Each entry: [from, to, allowed_roles]
const TRANSITIONS: [OrderStatus, OrderStatus, string[]][] = [
  // Stage A — Internal procurement approval (Admin / Ops only)
  ['pending_approval', 'approved',                       ['admin', 'operations_manager']],
  ['pending_approval', 'rejected',                       ['admin', 'operations_manager']],
  ['pending_approval', 'cancelled',                      ['admin', 'operations_manager']],

  // Assign supplier — moves approved → awaiting supplier confirmation
  ['approved',         'awaiting_supplier_confirmation', ['admin', 'operations_manager']],
  ['approved',         'cancelled',                      ['admin', 'operations_manager']],

  // Stage B — Supplier fulfillment confirmation (Supplier only)
  ['awaiting_supplier_confirmation', 'accepted_by_supplier', ['supplier']],
  ['awaiting_supplier_confirmation', 'rejected',             ['supplier']],
  // Admin/Ops can still cancel while waiting
  ['awaiting_supplier_confirmation', 'cancelled',            ['admin', 'operations_manager']],

  // Post-acceptance — logistics (Admin / Ops manage flow)
  ['accepted_by_supplier', 'processing', ['admin', 'operations_manager']],
  ['accepted_by_supplier', 'cancelled',  ['admin', 'operations_manager']],
  ['processing',           'dispatched', ['admin', 'operations_manager']],
  ['dispatched',           'in_transit', ['admin', 'operations_manager']],
  ['in_transit',           'delivered',  ['admin', 'operations_manager']],

  // Partial fulfillment can transition to delivered
  ['partially_fulfilled',  'delivered',  ['admin', 'operations_manager', 'supplier']],
];

function canTransition(from: string, to: string, role: string): boolean {
  return TRANSITIONS.some(
    ([f, t, roles]) => f === from && t === to && roles.includes(role)
  );
}

// ─── PO Number generation ─────────────────────────────────────────────────────

async function generatePoNumber(companyId: string, client: any): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await client.query(
    `INSERT INTO po_sequences (company_id, last_number) VALUES ($1, 1)
     ON CONFLICT (company_id) DO UPDATE SET last_number = po_sequences.last_number + 1
     RETURNING last_number`,
    [companyId]
  );
  const num = String(seq.rows[0].last_number).padStart(6, '0');
  return `PO-${year}-${num}`;
}

// ─── GET /api/orders ──────────────────────────────────────────────────────────

export async function listOrders(req: Request, res: Response): Promise<void> {
  const { status } = req.query;
  let sql = `
    SELECT o.id, o.po_number, o.status, o.total_amount, o.expected_delivery, o.notes,
           o.created_at, o.updated_at, o.sla_breach, o.risk_flag,
           s.name AS supplier_name, s.id AS supplier_id,
           u.name AS created_by_name
    FROM orders o
    LEFT JOIN suppliers s ON s.id = o.supplier_id
    LEFT JOIN users u ON u.id = o.created_by
    WHERE o.company_id = $1
  `;
  const params: unknown[] = [req.user!.companyId];

  if (status) {
    // Support comma-separated multi-status: ?status=dispatched,in_transit
    const statuses = String(status).split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      params.push(statuses[0]);
      sql += ` AND o.status = $${params.length}`;
    } else if (statuses.length > 1) {
      const placeholders = statuses.map((_, i) => `$${params.length + i + 1}`).join(', ');
      params.push(...statuses);
      sql += ` AND o.status IN (${placeholders})`;
    }
  }

  sql += ' ORDER BY o.created_at DESC';
  const result = await query(sql, params);
  res.json(result.rows);
}

// ─── GET /api/orders/:id ──────────────────────────────────────────────────────

export async function getOrder(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!isUUID(id)) { res.status(400).json({ error: 'Invalid order ID' }); return; }

  const orderRes = await query(
    `SELECT o.*, s.name AS supplier_name, u.name AS created_by_name
     FROM orders o
     LEFT JOIN suppliers s ON s.id = o.supplier_id
     LEFT JOIN users u ON u.id = o.created_by
     WHERE o.id = $1 AND o.company_id = $2`,
    [id, req.user!.companyId]
  );
  if (orderRes.rows.length === 0) { res.status(404).json({ error: 'Order not found' }); return; }

  const itemsRes = await query(
    `SELECT oi.id, oi.quantity, oi.fulfilled_quantity, oi.unit_price,
            p.name AS product_name, p.sku
     FROM order_items oi JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1`,
    [id]
  );
  res.json({ ...orderRes.rows[0], items: itemsRes.rows });
}

// ─── POST /api/orders ─────────────────────────────────────────────────────────

export async function createOrder(req: Request, res: Response): Promise<void> {
  const { supplier_id, expected_delivery, notes, items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'At least one order item is required' }); return;
  }
  for (const item of items) {
    if (!item.product_id) { res.status(400).json({ error: 'Each item must have a product_id' }); return; }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      res.status(400).json({ error: 'Each item quantity must be a whole number ≥ 1' }); return;
    }
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
        res.status(400).json({ error: `Product ${item.product_id} not found` }); return;
      }
      const price = item.unit_price ?? prod.rows[0].unit_price;
      totalAmount += price * item.quantity;
      resolvedItems.push({ product_id: item.product_id, quantity: item.quantity, unit_price: price });
    }

    // Generate PO number
    const poNumber = await generatePoNumber(req.user!.companyId, client);

    const orderRes = await client.query(
      `INSERT INTO orders (company_id, supplier_id, created_by, status, total_amount, expected_delivery, notes, po_number)
       VALUES ($1, $2, $3, 'pending_approval', $4, $5, $6, $7)
       RETURNING id, po_number, status, total_amount, expected_delivery, notes, created_at`,
      [req.user!.companyId, supplier_id || null, req.user!.userId,
       totalAmount, expected_delivery || null, notes || null, poNumber]
    );
    const order = orderRes.rows[0];

    for (const item of resolvedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)`,
        [order.id, item.product_id, item.quantity, item.unit_price]
      );
    }

    await client.query('COMMIT');

    // Log timeline event
    await logEvent(
      req.user!.companyId,
      order.id,
      req.user!.userId,
      'order_created',
      `Order ${poNumber} created with ${resolvedItems.length} item${resolvedItems.length !== 1 ? 's' : ''}, total $${Number(totalAmount).toLocaleString()}`,
      { po_number: poNumber, item_count: resolvedItems.length },
    );

    // Emit real-time event
    try {
      const io = getIo();
      io.to(req.user!.companyId).emit('order:updated', { orderId: order.id, status: 'pending_approval' });
    } catch { /* socket may not be ready */ }

    res.status(201).json({ ...order, items: resolvedItems });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── PATCH /api/orders/:id/status ────────────────────────────────────────────

export async function updateOrderStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { status } = req.body;
  const role = req.user!.role;

  if (!isUUID(id)) { res.status(400).json({ error: 'Invalid order ID' }); return; }
  if (!status || !ORDER_STATUSES.includes(status as OrderStatus)) {
    res.status(400).json({ error: `Invalid status. Valid values: ${ORDER_STATUSES.join(', ')}` }); return;
  }

  // Fetch current status + amount for approval check
  const current = await query(
    `SELECT status, total_amount, po_number FROM orders WHERE id = $1 AND company_id = $2`,
    [id, req.user!.companyId]
  );
  if (current.rows.length === 0) { res.status(404).json({ error: 'Order not found' }); return; }

  const from = current.rows[0].status as string;
  const to = status as string;
  const totalAmount = parseFloat(current.rows[0].total_amount);
  const poNumber = current.rows[0].po_number;

  if (from === to) { res.status(400).json({ error: 'Order is already in that status' }); return; }

  if (!canTransition(from, to, role)) {
    res.status(403).json({
      error: `Cannot move order from '${from}' to '${to}' as ${role}`,
    });
    return;
  }

  // Check approval hierarchy when approving
  if (from === 'pending_approval' && to === 'approved') {
    const approvalCheck = await checkApprovalPermission(req.user!.companyId, totalAmount, role);
    if (!approvalCheck.allowed) {
      res.status(403).json({
        error: `Order value $${totalAmount.toLocaleString()} requires ${approvalCheck.required_role} approval (rule: ${approvalCheck.rule_name})`,
        required_role: approvalCheck.required_role,
        rule_name: approvalCheck.rule_name,
      });
      return;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE orders SET status = $1, updated_at = NOW()
       WHERE id = $2 AND company_id = $3
       RETURNING id, po_number, status, updated_at`,
      [to, id, req.user!.companyId]
    );

    // Stock reservation side effects
    const itemsRes = await client.query(
      `SELECT product_id, quantity FROM order_items WHERE order_id = $1`,
      [id]
    );
    const items = itemsRes.rows;

    if (from === 'pending_approval' && to === 'approved' && items.length > 0) {
      // Reserve stock for each product
      for (const item of items) {
        await client.query(
          `UPDATE products SET reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) + $1) WHERE id = $2`,
          [item.quantity, item.product_id]
        );
      }
    } else if (to === 'rejected' || to === 'cancelled') {
      const wasReserved = ['approved', 'awaiting_supplier_confirmation', 'accepted_by_supplier',
        'processing', 'dispatched', 'in_transit'].includes(from);
      if (wasReserved && items.length > 0) {
        for (const item of items) {
          await client.query(
            `UPDATE products SET reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - $1) WHERE id = $2`,
            [item.quantity, item.product_id]
          );
        }
      }
    } else if (to === 'delivered' && items.length > 0) {
      // Consume stock: subtract from stock_quantity AND release reservation
      for (const item of items) {
        await client.query(
          `UPDATE products SET
             stock_quantity    = GREATEST(0, stock_quantity - $1),
             reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - $1)
           WHERE id = $2`,
          [item.quantity, item.product_id]
        );
      }
    }

    await client.query('COMMIT');

    // Log timeline event
    const userRes = await query(`SELECT name FROM users WHERE id = $1`, [req.user!.userId]);
    const userName = userRes.rows[0]?.name ?? 'System';

    const eventMap: Record<string, { type: string; message: string }> = {
      [`pending_approval→approved`]:                       { type: 'order_approved',         message: `Order approved by ${userName}` },
      [`pending_approval→rejected`]:                       { type: 'order_rejected',          message: `Order rejected by ${userName}` },
      [`pending_approval→cancelled`]:                      { type: 'order_cancelled',         message: `Order cancelled by ${userName}` },
      [`approved→awaiting_supplier_confirmation`]:         { type: 'supplier_assigned',       message: `Sent to supplier for fulfillment` },
      [`approved→cancelled`]:                              { type: 'order_cancelled',         message: `Order cancelled by ${userName}` },
      [`awaiting_supplier_confirmation→accepted_by_supplier`]: { type: 'fulfillment_accepted', message: `Supplier accepted fulfillment` },
      [`awaiting_supplier_confirmation→rejected`]:         { type: 'fulfillment_rejected',    message: `Supplier rejected fulfillment` },
      [`awaiting_supplier_confirmation→cancelled`]:        { type: 'order_cancelled',         message: `Order cancelled by ${userName}` },
      [`accepted_by_supplier→processing`]:                 { type: 'order_processing',        message: `Order moved to processing by ${userName}` },
      [`accepted_by_supplier→cancelled`]:                  { type: 'order_cancelled',         message: `Order cancelled by ${userName}` },
      [`processing→dispatched`]:                           { type: 'order_dispatched',        message: `Order dispatched by ${userName}` },
      [`dispatched→in_transit`]:                           { type: 'order_in_transit',        message: `Order marked in transit by ${userName}` },
      [`in_transit→delivered`]:                            { type: 'order_delivered',         message: `Order delivered` },
      [`partially_fulfilled→delivered`]:                   { type: 'order_delivered',         message: `Order fully delivered` },
    };

    const key = `${from}→${to}`;
    const ev = eventMap[key] || { type: `status_changed`, message: `Status changed from ${from} to ${to} by ${userName}` };

    await logEvent(req.user!.companyId, id, req.user!.userId, ev.type, ev.message, { from, to, po_number: poNumber });

    // Emit real-time event
    try {
      const io = getIo();
      io.to(req.user!.companyId).emit('order:updated', { orderId: id, status: to });
    } catch { /* socket may not be ready */ }

    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── PATCH /api/orders/:id/supplier ──────────────────────────────────────────
// Assigns a supplier and automatically advances status to awaiting_supplier_confirmation

export async function updateOrderSupplier(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { supplier_id } = req.body;

  if (!isUUID(id)) { res.status(400).json({ error: 'Invalid order ID' }); return; }
  if (!supplier_id || !isUUID(supplier_id)) {
    res.status(400).json({ error: 'supplier_id is required' }); return;
  }

  const sup = await query(
    'SELECT id, name FROM suppliers WHERE id = $1 AND company_id = $2 AND is_active = true',
    [supplier_id, req.user!.companyId]
  );
  if (sup.rows.length === 0) { res.status(400).json({ error: 'Supplier not found or inactive' }); return; }

  const current = await query(
    `SELECT status FROM orders WHERE id = $1 AND company_id = $2`,
    [id, req.user!.companyId]
  );
  if (current.rows.length === 0) { res.status(404).json({ error: 'Order not found' }); return; }

  const currentStatus = current.rows[0].status;

  // Must be approved before assigning supplier
  if (currentStatus !== 'approved' && currentStatus !== 'awaiting_supplier_confirmation') {
    res.status(400).json({
      error: `Order must be in 'approved' status to assign a supplier (current: ${currentStatus})`,
    });
    return;
  }

  const result = await query(
    `UPDATE orders
     SET supplier_id = $1,
         status = 'awaiting_supplier_confirmation',
         updated_at = NOW()
     WHERE id = $2 AND company_id = $3
     RETURNING id, supplier_id, status, updated_at`,
    [supplier_id, id, req.user!.companyId]
  );

  await logEvent(
    req.user!.companyId,
    id,
    req.user!.userId,
    'supplier_assigned',
    `Supplier ${sup.rows[0].name} assigned`,
    { supplier_id, supplier_name: sup.rows[0].name },
  );

  // Emit real-time event
  try {
    const io = getIo();
    io.to(req.user!.companyId).emit('order:updated', { orderId: id, status: 'awaiting_supplier_confirmation' });
  } catch { /* socket may not be ready */ }

  res.json(result.rows[0]);
}

// ─── POST /api/orders/:id/fulfill-partial ────────────────────────────────────

export async function partialFulfill(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { items } = req.body;

  if (!isUUID(id)) { res.status(400).json({ error: 'Invalid order ID' }); return; }
  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'items array is required' }); return;
  }

  const orderRes = await query(
    `SELECT status FROM orders WHERE id = $1 AND company_id = $2`,
    [id, req.user!.companyId]
  );
  if (orderRes.rows.length === 0) { res.status(404).json({ error: 'Order not found' }); return; }

  const currentStatus = orderRes.rows[0].status;
  if (!['accepted_by_supplier', 'processing', 'partially_fulfilled'].includes(currentStatus)) {
    res.status(400).json({ error: `Cannot fulfill items in status: ${currentStatus}` }); return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const entry of items) {
      if (!entry.item_id || !isUUID(entry.item_id)) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Each entry needs a valid item_id' }); return;
      }
      const fulfilledQty = parseInt(entry.fulfilled_quantity, 10);
      if (isNaN(fulfilledQty) || fulfilledQty < 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'fulfilled_quantity must be a non-negative integer' }); return;
      }

      // Fetch order item to validate
      const itemRes = await client.query(
        `SELECT id, quantity, fulfilled_quantity, product_id FROM order_items
         WHERE id = $1 AND order_id = $2`,
        [entry.item_id, id]
      );
      if (itemRes.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: `Order item ${entry.item_id} not found` }); return;
      }

      const item = itemRes.rows[0];
      const newFulfilled = Math.min(fulfilledQty, item.quantity);
      const oldFulfilled = parseInt(item.fulfilled_quantity, 10) || 0;
      const delta = newFulfilled - oldFulfilled;

      await client.query(
        `UPDATE order_items SET fulfilled_quantity = $1 WHERE id = $2`,
        [newFulfilled, entry.item_id]
      );

      // Adjust stock: consume only the newly fulfilled delta
      if (delta > 0) {
        await client.query(
          `UPDATE products SET
             stock_quantity    = GREATEST(0, stock_quantity - $1),
             reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - $1)
           WHERE id = $2`,
          [delta, item.product_id]
        );
      }
    }

    // Check if all items fully fulfilled
    const allItemsRes = await client.query(
      `SELECT quantity, COALESCE(fulfilled_quantity, 0) AS fulfilled_quantity FROM order_items WHERE order_id = $1`,
      [id]
    );
    const allFulfilled = allItemsRes.rows.every(
      (r: any) => parseInt(r.fulfilled_quantity, 10) >= parseInt(r.quantity, 10)
    );
    const anyFulfilled = allItemsRes.rows.some(
      (r: any) => parseInt(r.fulfilled_quantity, 10) > 0
    );

    let newStatus: string = currentStatus;
    if (allFulfilled) {
      newStatus = 'delivered';
    } else if (anyFulfilled) {
      newStatus = 'partially_fulfilled';
    }

    await client.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, id]
    );

    await client.query('COMMIT');

    await logEvent(
      req.user!.companyId,
      id,
      req.user!.userId,
      'partial_fulfillment',
      `Partial fulfillment recorded — order is now ${newStatus.replace(/_/g, ' ')}`,
      { new_status: newStatus },
    );

    // Emit real-time event
    try {
      const io = getIo();
      io.to(req.user!.companyId).emit('order:updated', { orderId: id, status: newStatus });
    } catch { /* socket may not be ready */ }

    res.json({ orderId: id, status: newStatus, all_fulfilled: allFulfilled });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
