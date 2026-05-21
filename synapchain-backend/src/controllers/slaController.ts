import { Request, Response } from 'express';
import { query } from '../config/db';

// ─── GET /api/sla/at-risk ─────────────────────────────────────────────────────

export async function getAtRisk(req: Request, res: Response): Promise<void> {
  const companyId = req.user!.companyId;

  // Orders stuck in awaiting_supplier_confirmation for > 24 hours
  const awaitingRes = await query(
    `SELECT o.id, o.po_number, o.status, o.total_amount, o.created_at, o.updated_at,
            s.name AS supplier_name
     FROM orders o
     LEFT JOIN suppliers s ON s.id = o.supplier_id
     WHERE o.company_id = $1
       AND o.status = 'awaiting_supplier_confirmation'
       AND o.updated_at < NOW() - INTERVAL '24 hours'`,
    [companyId],
  );

  // Orders stuck in processing for > 48 hours
  const processingRes = await query(
    `SELECT o.id, o.po_number, o.status, o.total_amount, o.created_at, o.updated_at,
            s.name AS supplier_name
     FROM orders o
     LEFT JOIN suppliers s ON s.id = o.supplier_id
     WHERE o.company_id = $1
       AND o.status = 'processing'
       AND o.updated_at < NOW() - INTERVAL '48 hours'`,
    [companyId],
  );

  // Orders in any active status for > 7 days
  const overdueRes = await query(
    `SELECT o.id, o.po_number, o.status, o.total_amount, o.created_at, o.updated_at,
            s.name AS supplier_name
     FROM orders o
     LEFT JOIN suppliers s ON s.id = o.supplier_id
     WHERE o.company_id = $1
       AND o.status NOT IN ('delivered', 'rejected', 'cancelled')
       AND o.created_at < NOW() - INTERVAL '7 days'`,
    [companyId],
  );

  // Shipments past their estimated_arrival but not delivered
  const delayedShipmentsRes = await query(
    `SELECT sh.id, sh.status, sh.estimated_arrival, sh.created_at, sh.updated_at,
            o.po_number AS order_po_number, o.id AS order_id
     FROM shipments sh
     LEFT JOIN orders o ON o.id = sh.order_id
     WHERE sh.company_id = $1
       AND sh.status NOT IN ('delivered')
       AND sh.estimated_arrival IS NOT NULL
       AND sh.estimated_arrival < NOW()`,
    [companyId],
  );

  // Invoices that are past their due date and not paid
  const overdueInvoicesRes = await query(
    `SELECT i.id, i.invoice_number, i.invoice_amount, i.due_date, i.status,
            o.po_number AS order_po_number, o.id AS order_id
     FROM invoices i
     LEFT JOIN orders o ON o.id = i.order_id
     WHERE i.company_id = $1
       AND i.status NOT IN ('paid')
       AND i.due_date IS NOT NULL
       AND i.due_date < CURRENT_DATE`,
    [companyId],
  );

  // Deduplicate at-risk orders (merge awaiting + processing + overdue)
  const atRiskOrderMap = new Map<string, any>();
  for (const row of [
    ...awaitingRes.rows.map(r => ({ ...r, risk_reason: 'Stuck in supplier confirmation > 24h' })),
    ...processingRes.rows.map(r => ({ ...r, risk_reason: 'Stuck in processing > 48h' })),
    ...overdueRes.rows.map(r => ({ ...r, risk_reason: 'Active order older than 7 days' })),
  ]) {
    if (!atRiskOrderMap.has(row.id)) atRiskOrderMap.set(row.id, row);
  }

  res.json({
    at_risk_orders: Array.from(atRiskOrderMap.values()),
    delayed_shipments: delayedShipmentsRes.rows,
    overdue_invoices: overdueInvoicesRes.rows,
  });
}

// ─── POST /api/sla/check ──────────────────────────────────────────────────────

export async function runSlaCheck(req: Request, res: Response): Promise<void> {
  const companyId = req.user!.companyId;

  // Mark orders as sla_breach
  const orderBreachRes = await query(
    `UPDATE orders SET sla_breach = true
     WHERE company_id = $1
       AND status NOT IN ('delivered', 'rejected', 'cancelled')
       AND (
         (status = 'awaiting_supplier_confirmation' AND updated_at < NOW() - INTERVAL '24 hours')
         OR (status = 'processing' AND updated_at < NOW() - INTERVAL '48 hours')
         OR (created_at < NOW() - INTERVAL '7 days')
       )
     RETURNING id`,
    [companyId],
  );

  // Mark shipments as sla_breach
  const shipmentBreachRes = await query(
    `UPDATE shipments SET sla_breach = true
     WHERE company_id = $1
       AND status NOT IN ('delivered')
       AND estimated_arrival IS NOT NULL
       AND estimated_arrival < NOW()
     RETURNING id`,
    [companyId],
  );

  res.json({
    orders_flagged: orderBreachRes.rowCount ?? 0,
    shipments_flagged: shipmentBreachRes.rowCount ?? 0,
    checked_at: new Date().toISOString(),
  });
}
