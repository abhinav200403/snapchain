import { Request, Response } from 'express';
import { query } from '../config/db';

// GET /api/analytics/overview
export async function overview(req: Request, res: Response): Promise<void> {
  const companyId = req.user!.companyId;

  const [orders, inventory, shipments, suppliers] = await Promise.all([
    query(
      `SELECT COUNT(*) AS total_orders,
              SUM(total_amount) AS total_revenue,
              COUNT(*) FILTER (WHERE status = 'pending_approval') AS pending_orders,
              COUNT(*) FILTER (WHERE status = 'delivered') AS delivered_orders
       FROM orders WHERE company_id = $1`,
      [companyId]
    ),
    query(
      `SELECT COUNT(*) AS total_products,
              COUNT(*) FILTER (WHERE stock_quantity <= reorder_level) AS low_stock_count,
              SUM(stock_quantity * unit_price) AS inventory_value
       FROM products WHERE company_id = $1`,
      [companyId]
    ),
    query(
      `SELECT COUNT(*) AS total_shipments,
              COUNT(*) FILTER (WHERE status = 'in_transit') AS in_transit,
              COUNT(*) FILTER (WHERE status = 'delayed') AS delayed
       FROM shipments WHERE company_id = $1`,
      [companyId]
    ),
    query(
      `SELECT COUNT(*) AS total_suppliers,
              ROUND(AVG(rating), 1) AS avg_supplier_rating
       FROM suppliers WHERE company_id = $1 AND is_active = true`,
      [companyId]
    ),
  ]);

  res.json({
    orders: orders.rows[0],
    inventory: inventory.rows[0],
    shipments: shipments.rows[0],
    suppliers: suppliers.rows[0],
  });
}

// GET /api/analytics/orders
export async function ordersChart(req: Request, res: Response): Promise<void> {
  const companyId = req.user!.companyId;
  const result = await query(
    `SELECT DATE_TRUNC('month', created_at) AS month,
            COUNT(*) AS count,
            SUM(total_amount) AS revenue
     FROM orders WHERE company_id = $1
     GROUP BY month ORDER BY month DESC LIMIT 12`,
    [companyId]
  );
  res.json(result.rows);
}

// GET /api/analytics/inventory
export async function inventoryChart(req: Request, res: Response): Promise<void> {
  const companyId = req.user!.companyId;
  const result = await query(
    `SELECT name, stock_quantity, reorder_level
     FROM products WHERE company_id = $1
     ORDER BY stock_quantity ASC LIMIT 10`,
    [companyId]
  );
  res.json(result.rows);
}

// GET /api/analytics/suppliers
export async function suppliersChart(req: Request, res: Response): Promise<void> {
  const companyId = req.user!.companyId;
  const result = await query(
    `SELECT name, rating, lead_time_days
     FROM suppliers WHERE company_id = $1 AND is_active = true
     ORDER BY rating DESC`,
    [companyId]
  );
  res.json(result.rows);
}

// GET /api/analytics/kpis
export async function kpis(req: Request, res: Response): Promise<void> {
  const companyId = req.user!.companyId;

  const [orderStats, supplierStats, inventoryStats, revenueStats] = await Promise.all([
    query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
         COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
         COUNT(*) FILTER (WHERE status IN ('pending_approval','approved','awaiting_supplier_confirmation','accepted_by_supplier','processing','dispatched','in_transit')) AS in_progress,
         COUNT(*) FILTER (WHERE status = 'accepted_by_supplier' OR status = 'awaiting_supplier_confirmation') AS supplier_stage,
         ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/86400) FILTER (WHERE status = 'delivered'), 1) AS avg_days_to_deliver
       FROM orders WHERE company_id = $1`,
      [companyId]
    ),
    query(
      `SELECT
         COUNT(*) AS total_active,
         ROUND(AVG(rating), 2) AS avg_rating,
         ROUND(AVG(lead_time_days), 1) AS avg_lead_time
       FROM suppliers WHERE company_id = $1 AND is_active = true`,
      [companyId]
    ),
    query(
      `SELECT
         COUNT(*) AS total_products,
         COUNT(*) FILTER (WHERE stock_quantity <= reorder_level) AS low_stock,
         ROUND(SUM(stock_quantity * unit_price)::numeric, 2) AS total_value
       FROM products WHERE company_id = $1`,
      [companyId]
    ),
    query(
      `SELECT
         COALESCE(SUM(total_amount) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW())), 0) AS this_month,
         COALESCE(SUM(total_amount) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
                                         AND created_at < DATE_TRUNC('month', NOW())), 0) AS last_month
       FROM orders WHERE company_id = $1`,
      [companyId]
    ),
  ]);

  const o = orderStats.rows[0];
  const s = supplierStats.rows[0];
  const i = inventoryStats.rows[0];
  const r = revenueStats.rows[0];

  const total = Number(o.total) || 1;
  const delivered = Number(o.delivered);
  const rejected = Number(o.rejected);
  const fulfillmentRate = Math.round((delivered / total) * 100);
  const thisMonth = Number(r.this_month);
  const lastMonth = Number(r.last_month) || 1;
  const revenueGrowth = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);

  res.json({
    fulfillment_rate: fulfillmentRate,
    avg_days_to_deliver: Number(o.avg_days_to_deliver) || null,
    revenue_growth: revenueGrowth,
    avg_supplier_rating: Number(s.avg_rating) || 0,
    avg_lead_time: Number(s.avg_lead_time) || 0,
    total_active_suppliers: Number(s.total_active),
    total_products: Number(i.total_products),
    low_stock_count: Number(i.low_stock),
    inventory_value: Number(i.total_value) || 0,
    rejection_rate: Math.round((rejected / total) * 100),
    in_progress_orders: Number(o.in_progress),
    this_month_revenue: thisMonth,
    last_month_revenue: lastMonth,
  });
}
