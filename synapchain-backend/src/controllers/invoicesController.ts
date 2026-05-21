import { Request, Response } from 'express';
import { validate as isUUID } from 'uuid';
import { query } from '../config/db';
import { logEvent } from './timelineController';

const INVOICE_QUERY = `
  SELECT i.*,
         u1.name AS uploaded_by_name,
         u2.name AS approved_by_name
  FROM invoices i
  LEFT JOIN users u1 ON u1.id = i.uploaded_by
  LEFT JOIN users u2 ON u2.id = i.approved_by
`;

// ─── GET /api/invoices ────────────────────────────────────────────────────────

export async function listInvoices(req: Request, res: Response): Promise<void> {
  const { order_id } = req.query;
  let sql = `${INVOICE_QUERY} WHERE i.company_id = $1`;
  const params: unknown[] = [req.user!.companyId];

  if (order_id && isUUID(String(order_id))) {
    params.push(order_id);
    sql += ` AND i.order_id = $${params.length}`;
  }

  sql += ' ORDER BY i.created_at DESC';
  const result = await query(sql, params);
  res.json(result.rows);
}

// ─── POST /api/invoices ───────────────────────────────────────────────────────

export async function createInvoice(req: Request, res: Response): Promise<void> {
  const { order_id, invoice_number, invoice_amount, tax_amount, currency, file_url, notes, due_date } = req.body;

  if (!order_id || !isUUID(order_id)) {
    res.status(400).json({ error: 'Valid order_id is required' }); return;
  }
  if (!invoice_number || !String(invoice_number).trim()) {
    res.status(400).json({ error: 'invoice_number is required' }); return;
  }
  if (!invoice_amount || isNaN(Number(invoice_amount)) || Number(invoice_amount) <= 0) {
    res.status(400).json({ error: 'invoice_amount must be a positive number' }); return;
  }

  // Order must exist and be delivered
  const orderRes = await query(
    `SELECT id, status FROM orders WHERE id = $1 AND company_id = $2`,
    [order_id, req.user!.companyId],
  );
  if (orderRes.rows.length === 0) {
    res.status(404).json({ error: 'Order not found' }); return;
  }
  if (orderRes.rows[0].status !== 'delivered') {
    res.status(400).json({ error: 'Invoices can only be uploaded for delivered orders' }); return;
  }

  const result = await query(
    `INSERT INTO invoices (company_id, order_id, invoice_number, invoice_amount, tax_amount,
       currency, file_url, notes, uploaded_by, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      req.user!.companyId, order_id, invoice_number.trim(),
      Number(invoice_amount),
      tax_amount != null ? Number(tax_amount) : 0,
      currency || 'USD',
      file_url || null,
      notes || null,
      req.user!.userId,
      due_date || null,
    ],
  );
  const invoice = result.rows[0];

  await logEvent(
    req.user!.companyId,
    order_id,
    req.user!.userId,
    'invoice_uploaded',
    `Invoice ${invoice_number} uploaded for $${Number(invoice_amount).toLocaleString()}`,
    { invoice_id: invoice.id },
  );

  res.status(201).json(invoice);
}

// ─── PATCH /api/invoices/:id/status ──────────────────────────────────────────

export async function updateInvoiceStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { status } = req.body;

  if (!isUUID(id)) { res.status(400).json({ error: 'Invalid invoice ID' }); return; }

  const VALID_STATUSES = ['approved', 'rejected', 'payment_pending', 'paid'];
  if (!status || !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `Invalid status. Valid: ${VALID_STATUSES.join(', ')}` }); return;
  }

  const existing = await query(
    `SELECT * FROM invoices WHERE id = $1 AND company_id = $2`,
    [id, req.user!.companyId],
  );
  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Invoice not found' }); return;
  }

  const updates: string[] = ['status = $1', 'updated_at = NOW()'];
  const params: unknown[] = [status, id, req.user!.companyId];

  if (status === 'approved' || status === 'rejected') {
    updates.push(`approved_by = $${params.length + 1}`);
    params.splice(params.length - 2, 0, req.user!.userId);
  }
  if (status === 'paid') {
    updates.push(`paid_at = NOW()`);
  }

  // Rebuild properly
  const setClause = `status = $1, updated_at = NOW()${
    status === 'approved' || status === 'rejected' ? ', approved_by = $4' : ''
  }${status === 'paid' ? ', paid_at = NOW()' : ''}`;

  let updateSql: string;
  let updateParams: unknown[];

  if (status === 'approved' || status === 'rejected') {
    updateSql = `UPDATE invoices SET status = $1, updated_at = NOW(), approved_by = $2
                 WHERE id = $3 AND company_id = $4 RETURNING *`;
    updateParams = [status, req.user!.userId, id, req.user!.companyId];
  } else if (status === 'paid') {
    updateSql = `UPDATE invoices SET status = $1, updated_at = NOW(), paid_at = NOW()
                 WHERE id = $2 AND company_id = $3 RETURNING *`;
    updateParams = [status, id, req.user!.companyId];
  } else {
    updateSql = `UPDATE invoices SET status = $1, updated_at = NOW()
                 WHERE id = $2 AND company_id = $3 RETURNING *`;
    updateParams = [status, id, req.user!.companyId];
  }

  const result = await query(updateSql, updateParams);
  const inv = result.rows[0];

  const eventMessages: Record<string, string> = {
    approved: 'Invoice approved',
    rejected: 'Invoice rejected',
    payment_pending: 'Invoice marked as payment pending',
    paid: 'Invoice marked as paid',
  };

  await logEvent(
    req.user!.companyId,
    inv.order_id,
    req.user!.userId,
    `invoice_${status}`,
    eventMessages[status] || `Invoice status changed to ${status}`,
    { invoice_id: id },
  );

  res.json(inv);
}
