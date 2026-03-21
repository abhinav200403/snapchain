import { Request, Response } from 'express';
import { query } from '../config/db';

// GET /api/analytics/overview
export async function overview(req: Request, res: Response): Promise<void> {
  const companyId = req.user!.companyId;

  const [orders, inventory, shipments, suppliers] = await Promise.all([
    query(
      `SELECT COUNT(*) AS total_orders,
              SUM(total_amount) AS total_revenue,
              COUNT(*) FILTER (WHERE status = 'pending') AS pending_orders,
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
