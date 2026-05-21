import { Request, Response } from 'express';
import { validate as isUUID } from 'uuid';
import { query } from '../config/db';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSupplierFields(
  email: unknown,
  rating: unknown
): string | null {
  if (email !== undefined && email !== null && !EMAIL_REGEX.test(String(email))) {
    return 'Invalid email format';
  }
  if (rating !== undefined && rating !== null) {
    const r = Number(rating);
    if (isNaN(r) || r < 0 || r > 5) {
      return 'Rating must be a number between 0 and 5';
    }
  }
  return null;
}

// GET /api/suppliers
export async function listSuppliers(req: Request, res: Response): Promise<void> {
  const result = await query(
    `SELECT id, name, email, phone, rating, lead_time_days, is_active, created_at
     FROM suppliers WHERE company_id = $1 ORDER BY name`,
    [req.user!.companyId]
  );
  res.json(result.rows);
}

// POST /api/suppliers
export async function createSupplier(req: Request, res: Response): Promise<void> {
  const { name, email, phone, rating, lead_time_days } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Supplier name is required' });
    return;
  }
  const validationError = validateSupplierFields(email, rating);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const result = await query(
    `INSERT INTO suppliers (company_id, name, email, phone, rating, lead_time_days)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, email, phone, rating, lead_time_days, is_active, created_at`,
    [req.user!.companyId, name.trim(), email || null, phone || null,
     rating !== undefined && rating !== null ? Number(rating) : null, lead_time_days || 7]
  );
  res.status(201).json(result.rows[0]);
}

// PATCH /api/suppliers/:id
export async function updateSupplier(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, email, phone, rating, lead_time_days, is_active } = req.body;

  const validationError = validateSupplierFields(email, rating);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const result = await query(
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
  const result = await query(
    `UPDATE suppliers SET is_active = false WHERE id = $1 AND company_id = $2 RETURNING id`,
    [id, req.user!.companyId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Supplier not found' });
    return;
  }
  res.json({ message: 'Supplier deactivated' });
}

// GET /api/suppliers/:id/scorecard
export async function getSupplierScorecard(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!isUUID(id)) { res.status(400).json({ error: 'Invalid supplier ID' }); return; }

  const supplierRes = await query(
    `SELECT id, name, email, rating, lead_time_days FROM suppliers WHERE id = $1 AND company_id = $2`,
    [id, req.user!.companyId]
  );
  if (supplierRes.rows.length === 0) {
    res.status(404).json({ error: 'Supplier not found' }); return;
  }
  const supplier = supplierRes.rows[0];

  // Total orders assigned to this supplier
  const totalRes = await query(
    `SELECT COUNT(*) AS total FROM orders WHERE supplier_id = $1 AND company_id = $2`,
    [id, req.user!.companyId]
  );
  const total = parseInt(totalRes.rows[0].total, 10);

  // Orders that were accepted (accepted_by_supplier + downstream)
  const acceptedRes = await query(
    `SELECT COUNT(*) AS cnt FROM orders
     WHERE supplier_id = $1 AND company_id = $2
       AND status IN ('accepted_by_supplier','processing','dispatched','in_transit','delivered','partially_fulfilled')`,
    [id, req.user!.companyId]
  );
  const accepted = parseInt(acceptedRes.rows[0].cnt, 10);

  // Orders that were rejected
  const rejectedRes = await query(
    `SELECT COUNT(*) AS cnt FROM orders
     WHERE supplier_id = $1 AND company_id = $2 AND status = 'rejected'`,
    [id, req.user!.companyId]
  );
  const rejected = parseInt(rejectedRes.rows[0].cnt, 10);

  // Delivered orders
  const deliveredRes = await query(
    `SELECT COUNT(*) AS cnt FROM orders
     WHERE supplier_id = $1 AND company_id = $2 AND status = 'delivered'`,
    [id, req.user!.companyId]
  );
  const delivered = parseInt(deliveredRes.rows[0].cnt, 10);

  // Average fulfillment time (from awaiting_supplier_confirmation timestamp to delivered)
  // Use order_events if available, fall back to updated_at
  const avgFulfillmentRes = await query(
    `SELECT AVG(EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 86400) AS avg_days
     FROM orders o
     WHERE o.supplier_id = $1 AND o.company_id = $2 AND o.status = 'delivered'`,
    [id, req.user!.companyId]
  );
  const avgFulfillmentDays = avgFulfillmentRes.rows[0].avg_days
    ? parseFloat(avgFulfillmentRes.rows[0].avg_days).toFixed(1)
    : null;

  // On-time delivery (delivered before expected_delivery)
  const onTimeRes = await query(
    `SELECT COUNT(*) AS cnt FROM orders
     WHERE supplier_id = $1 AND company_id = $2
       AND status = 'delivered'
       AND expected_delivery IS NOT NULL
       AND updated_at <= expected_delivery`,
    [id, req.user!.companyId]
  );
  const onTime = parseInt(onTimeRes.rows[0].cnt, 10);

  // Total revenue handled
  const revenueRes = await query(
    `SELECT COALESCE(SUM(total_amount), 0) AS total
     FROM orders WHERE supplier_id = $1 AND company_id = $2 AND status = 'delivered'`,
    [id, req.user!.companyId]
  );
  const totalRevenue = parseFloat(revenueRes.rows[0].total);

  const acceptanceRate = total > 0 ? Math.round((accepted / total) * 100) : 0;
  const rejectionRate  = total > 0 ? Math.round((rejected / total) * 100) : 0;
  const onTimeRate     = delivered > 0 ? Math.round((onTime / delivered) * 100) : 0;

  let grade: string;
  if (acceptanceRate >= 80) grade = 'Excellent';
  else if (acceptanceRate >= 60) grade = 'Good';
  else if (acceptanceRate >= 40) grade = 'Average';
  else grade = 'Poor';

  res.json({
    supplier,
    total_orders: total,
    accepted_orders: accepted,
    rejected_orders: rejected,
    delivered_orders: delivered,
    acceptance_rate: acceptanceRate,
    rejection_rate: rejectionRate,
    on_time_delivery_rate: onTimeRate,
    avg_fulfillment_days: avgFulfillmentDays,
    total_revenue: totalRevenue,
    performance_grade: grade,
  });
}
