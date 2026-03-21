import { Request, Response } from 'express';
import pool from '../config/db';

// GET /api/analytics/overview
export async function overview(req: Request, res: Response): Promise<void> {
  const companyId = req.user!.companyId;

  const [orders, inventory, shipments, suppliers] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total_orders,
              SUM(total_amount) AS total_revenue,
              COUNT(*) FILTER (WHERE status = 'pending') AS pending_orders,
              COUNT(*) FILTER (WHERE status = 'delivered') AS delivered_orders
       FROM orders WHERE company_id = $1`,
      [companyId]
    ),
    pool.query(
      `SELECT COUNT(*) AS total_products,
              COUNT(*) FILTER (WHERE stock_quantity <= reorder_level) AS low_stock_count,
              SUM(stock_quantity * unit_price) AS inventory_value
       FROM products WHERE company_id = $1`,
      [companyId]
    ),
    pool.query(
      `SELECT COUNT(*) AS total_shipments,
              COUNT(*) FILTER (WHERE status = 'in_transit') AS in_transit,
              COUNT(*) FILTER (WHERE status = 'delayed') AS delayed
       FROM shipments WHERE company_id = $1`,
      [companyId]
    ),
    pool.query(
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
  const result = await pool.query(
    `SELECT DATE_TRUNC('month', created_at) AS month,
            COUNT(*) AS count,
            SUM(total_amount) AS revenue
     FROM orders
     WHERE company_id = $1 AND created_at > NOW() - INTERVAL '6 months'
     GROUP BY month
     ORDER BY month`,
    [req.user!.companyId]
  );
  res.json(result.rows);
}

// GET /api/analytics/inventory
export async function inventoryChart(req: Request, res: Response): Promise<void> {
  const result = await pool.query(
    `SELECT category, COUNT(*) AS product_count, SUM(stock_quantity) AS total_stock,
            SUM(stock_quantity * unit_price) AS total_value
     FROM products
     WHERE company_id = $1 AND category IS NOT NULL
     GROUP BY category
     ORDER BY total_value DESC`,
    [req.user!.companyId]
  );
  res.json(result.rows);
}

// GET /api/analytics/suppliers
export async function suppliersChart(req: Request, res: Response): Promise<void> {
  const result = await pool.query(
    `SELECT s.id, s.name, s.rating, s.lead_time_days,
            COUNT(o.id) AS total_orders,
            SUM(o.total_amount) AS total_spend,
            COUNT(sh.id) FILTER (WHERE sh.status = 'delayed') AS delayed_shipments
     FROM suppliers s
     LEFT JOIN orders o ON o.supplier_id = s.id AND o.company_id = $1
     LEFT JOIN shipments sh ON sh.order_id = o.id
     WHERE s.company_id = $1
     GROUP BY s.id, s.name, s.rating, s.lead_time_days
     ORDER BY total_spend DESC NULLS LAST`,
    [req.user!.companyId]
  );
  res.json(result.rows);
}
