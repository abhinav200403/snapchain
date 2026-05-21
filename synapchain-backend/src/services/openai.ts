import OpenAI from 'openai';
import pool from '../config/db';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export async function generateDemandForecast(companyId: string): Promise<object> {
  // Check for recent cached prediction (24h)
  const cached = await pool.query(
    `SELECT result FROM predictions
     WHERE company_id = $1 AND type = 'demand'
       AND created_at > NOW() - INTERVAL '24 hours'
     ORDER BY created_at DESC LIMIT 1`,
    [companyId]
  );
  if (cached.rows.length > 0) {
    return cached.rows[0].result;
  }

  // Fetch last 90 days order data
  const ordersData = await pool.query(
    `SELECT p.name AS product, p.category, p.sku,
            SUM(oi.quantity) AS units_ordered,
            DATE_TRUNC('week', o.created_at) AS week
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     WHERE o.company_id = $1 AND o.created_at > NOW() - INTERVAL '90 days'
       AND o.status != 'cancelled'
     GROUP BY p.name, p.category, p.sku, week
     ORDER BY week`,
    [companyId]
  );

  const inventoryData = await pool.query(
    `SELECT name, sku, category, stock_quantity, reorder_level, unit_price
     FROM products WHERE company_id = $1`,
    [companyId]
  );

  const prompt = `You are a supply chain AI analyst. Based on the following order history data for the last 90 days, provide demand forecasting for the next 30 days.

ORDER HISTORY (last 90 days):
${JSON.stringify(ordersData.rows, null, 2)}

CURRENT INVENTORY:
${JSON.stringify(inventoryData.rows, null, 2)}

Return ONLY a valid JSON object with this structure:
{
  "forecasts": [
    {
      "product": "product name",
      "sku": "sku code",
      "predicted_demand_30d": <number>,
      "confidence": "high|medium|low",
      "recommendation": "brief action",
      "risk_level": "high|medium|low"
    }
  ],
  "summary": "2-3 sentence executive summary",
  "generated_at": "${new Date().toISOString()}"
}`;

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 800,
    response_format: { type: 'json_object' },
  });

  const result = JSON.parse(response.choices[0].message.content || '{}');

  // Cache result
  await pool.query(
    `INSERT INTO predictions (company_id, type, result) VALUES ($1, 'demand', $2)`,
    [companyId, JSON.stringify(result)]
  );

  return result;
}

export async function generateRiskAssessment(companyId: string): Promise<object> {
  const [suppliers, shipments, inventory] = await Promise.all([
    pool.query(
      `SELECT s.id, s.name, s.rating, s.lead_time_days,
              COUNT(o.id) FILTER (WHERE o.status = 'cancelled') AS cancelled_orders,
              COUNT(sh.id) FILTER (WHERE sh.status = 'delayed') AS delayed_shipments
       FROM suppliers s
       LEFT JOIN orders o ON o.supplier_id = s.id AND o.company_id = $1
       LEFT JOIN shipments sh ON sh.order_id = o.id
       WHERE s.company_id = $1
       GROUP BY s.id, s.name, s.rating, s.lead_time_days`,
      [companyId]
    ),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'delayed') AS delayed,
              COUNT(*) FILTER (WHERE status = 'in_transit') AS in_transit
       FROM shipments WHERE company_id = $1`,
      [companyId]
    ),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE stock_quantity <= reorder_level) AS low_stock,
              COUNT(*) FILTER (WHERE stock_quantity = 0) AS out_of_stock
       FROM products WHERE company_id = $1`,
      [companyId]
    ),
  ]);

  // Rule-based risk scoring — return in the shape AiInsightsPanel expects
  const risks: object[] = [];

  for (const sup of suppliers.rows) {
    const score = calculateSupplierRisk(sup);
    if (score.reasons.length > 0) {
      risks.push({
        risk_level: score.level,
        message: score.reasons.join('; '),
        product_name: sup.name,
        risk_type: 'supplier',
        recommendation:
          score.level === 'high'
            ? 'Review supplier performance and consider alternative sourcing'
            : 'Monitor supplier closely and verify upcoming deliveries',
      });
    }
  }

  const invStats = inventory.rows[0];
  if (Number(invStats.out_of_stock) > 0) {
    risks.push({
      risk_level: 'high',
      message: `${invStats.out_of_stock} product${Number(invStats.out_of_stock) > 1 ? 's' : ''} currently out of stock`,
      risk_type: 'inventory',
      recommendation: 'Initiate emergency reorder to restore stock levels immediately',
    });
  }
  if (Number(invStats.low_stock) > 0) {
    risks.push({
      risk_level: 'medium',
      message: `${invStats.low_stock} product${Number(invStats.low_stock) > 1 ? 's' : ''} below reorder threshold`,
      risk_type: 'inventory',
      recommendation: 'Create purchase orders before stock reaches critical levels',
    });
  }

  const shipStats = shipments.rows[0];
  if (Number(shipStats.delayed) > 0) {
    risks.push({
      risk_level: 'high',
      message: `${shipStats.delayed} shipment${Number(shipStats.delayed) > 1 ? 's' : ''} currently delayed`,
      risk_type: 'shipment',
      recommendation: 'Contact carriers to investigate delay causes and update delivery estimates',
    });
  }

  return {
    risks,
    summary: {
      high_risk_count: risks.filter((r: any) => r.risk_level === 'high').length,
      medium_risk_count: risks.filter((r: any) => r.risk_level === 'medium').length,
      shipment_stats: shipStats,
      inventory_stats: invStats,
    },
    generated_at: new Date().toISOString(),
  };
}

function calculateSupplierRisk(supplier: Record<string, unknown>): { level: string; reasons: string[] } {
  const reasons: string[] = [];
  let riskScore = 0;

  if (Number(supplier.rating) < 3.5) { riskScore += 2; reasons.push(`Low rating: ${supplier.rating}`); }
  if (Number(supplier.delayed_shipments) > 2) { riskScore += 2; reasons.push(`${supplier.delayed_shipments} delayed shipments`); }
  if (Number(supplier.cancelled_orders) > 1) { riskScore += 1; reasons.push(`${supplier.cancelled_orders} cancelled orders`); }
  if (Number(supplier.lead_time_days) > 14) { riskScore += 1; reasons.push(`Long lead time: ${supplier.lead_time_days} days`); }

  const level = riskScore >= 3 ? 'high' : riskScore >= 1 ? 'medium' : 'low';
  return { level, reasons };
}
