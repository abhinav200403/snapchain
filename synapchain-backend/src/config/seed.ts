import bcrypt from 'bcrypt';
import pool from './db';

const COMPANY_ID = '903aa838-149d-4d7d-87b7-309de6a6dbc7';
const ADMIN_ID = '7b42a0ff-75db-4e1d-be19-62942ea79c2d';

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Seeding demo data...');

    const hash = await bcrypt.hash('Demo@12345', 12);

    // --- Demo Users ---
    const users = [
      { email: 'ops@synapchain.ai', name: 'Marcus Rivera', role: 'operations_manager' },
      { email: 'supplier@synapchain.ai', name: 'Priya Sharma', role: 'supplier' },
      { email: 'analyst@synapchain.ai', name: 'James Okafor', role: 'business_analyst' },
    ];
    const userIds: Record<string, string> = { admin: ADMIN_ID };
    for (const u of users) {
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [u.email]);
      if (existing.rows.length > 0) {
        userIds[u.role] = existing.rows[0].id;
        console.log(`  User ${u.email} already exists, skipping`);
        continue;
      }
      const r = await client.query(
        `INSERT INTO users (company_id, email, name, password_hash, role) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [COMPANY_ID, u.email, u.name, hash, u.role]
      );
      userIds[u.role] = r.rows[0].id;
      console.log(`  Created user: ${u.email}`);
    }

    // --- Also update admin password to Demo@12345 for easy login ---
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, ADMIN_ID]);
    console.log('  Updated admin password to Demo@12345');

    // --- Suppliers ---
    const supplierData = [
      { name: 'Acme Industrial', email: 'john@acme.com', phone: '+1-555-0101', rating: 4.6, lead_time_days: 5 },
      { name: 'GlobalTech Parts', email: 'li@globaltech.cn', phone: '+86-755-0202', rating: 4.4, lead_time_days: 8 },
      { name: 'Prime Materials', email: 'raj@primematerials.in', phone: '+91-22-0303', rating: 4.2, lead_time_days: 10 },
      { name: 'Eastern Supply Co', email: 'kim@eastern.kr', phone: '+82-2-0404', rating: 3.9, lead_time_days: 12 },
    ];
    const supplierIds: string[] = [];
    for (const s of supplierData) {
      const existing = await client.query('SELECT id FROM suppliers WHERE company_id = $1 AND name = $2', [COMPANY_ID, s.name]);
      if (existing.rows.length > 0) {
        supplierIds.push(existing.rows[0].id);
        console.log(`  Supplier ${s.name} already exists, skipping`);
        continue;
      }
      const r = await client.query(
        `INSERT INTO suppliers (company_id, name, email, phone, rating, lead_time_days) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [COMPANY_ID, s.name, s.email, s.phone, s.rating, s.lead_time_days]
      );
      supplierIds.push(r.rows[0].id);
      console.log(`  Created supplier: ${s.name}`);
    }
    const [acmeId, globaltechId, primeId, easternId] = supplierIds;

    // --- Products ---
    const productData = [
      { name: 'Hydraulic Pump A-200', sku: 'HP-A200', category: 'Machinery', stock_quantity: 12, reorder_level: 50, unit_price: 284.00, supplier_id: acmeId },
      { name: 'Steel Bearings M-10', sku: 'SB-M10', category: 'Components', stock_quantity: 28, reorder_level: 100, unit_price: 8.50, supplier_id: acmeId },
      { name: 'Circuit Board CB-400', sku: 'CB-400', category: 'Electronics', stock_quantity: 5, reorder_level: 25, unit_price: 142.00, supplier_id: globaltechId },
      { name: 'Copper Wire CW-12', sku: 'CW-12', category: 'Materials', stock_quantity: 340, reorder_level: 200, unit_price: 3.20, supplier_id: primeId },
      { name: 'Industrial Motor IM-50', sku: 'IM-50', category: 'Machinery', stock_quantity: 67, reorder_level: 30, unit_price: 520.00, supplier_id: acmeId },
      { name: 'Pressure Valve PV-8', sku: 'PV-8', category: 'Components', stock_quantity: 89, reorder_level: 40, unit_price: 64.00, supplier_id: easternId },
    ];
    const productIds: string[] = [];
    for (const p of productData) {
      const existing = await client.query('SELECT id FROM products WHERE company_id = $1 AND sku = $2', [COMPANY_ID, p.sku]);
      if (existing.rows.length > 0) {
        productIds.push(existing.rows[0].id);
        console.log(`  Product ${p.sku} already exists, skipping`);
        continue;
      }
      const r = await client.query(
        `INSERT INTO products (company_id, supplier_id, name, sku, category, stock_quantity, reorder_level, unit_price)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [COMPANY_ID, p.supplier_id, p.name, p.sku, p.category, p.stock_quantity, p.reorder_level, p.unit_price]
      );
      productIds.push(r.rows[0].id);
      console.log(`  Created product: ${p.sku}`);
    }
    const [pumpId, bearingId, circuitId, copperWireId, motorId, valveId] = productIds;

    // --- Orders ---
    const now = new Date();
    const d = (days: number) => new Date(now.getTime() - days * 86400000);

    const ordersData = [
      {
        supplier_id: acmeId, created_by: userIds.operations_manager, status: 'processing',
        total_amount: 12840, expected_delivery: d(-3), notes: 'Urgent restock',
        created_at: d(1),
        items: [{ product_id: pumpId, quantity: 30, unit_price: 284 }, { product_id: bearingId, quantity: 300, unit_price: 8.5 }, { product_id: valveId, quantity: 50, unit_price: 64 }]
      },
      {
        supplier_id: globaltechId, created_by: userIds.operations_manager, status: 'shipped',
        total_amount: 8320, expected_delivery: d(-6), notes: null,
        created_at: d(2),
        items: [{ product_id: circuitId, quantity: 50, unit_price: 142 }, { product_id: bearingId, quantity: 200, unit_price: 8.5 }]
      },
      {
        supplier_id: primeId, created_by: userIds.operations_manager, status: 'pending',
        total_amount: 24100, expected_delivery: d(-7), notes: 'Q2 bulk order',
        created_at: d(3),
        items: [{ product_id: copperWireId, quantity: 5000, unit_price: 3.2 }, { product_id: motorId, quantity: 20, unit_price: 520 }, { product_id: valveId, quantity: 100, unit_price: 64 }]
      },
      {
        supplier_id: acmeId, created_by: ADMIN_ID, status: 'delivered',
        total_amount: 6750, expected_delivery: d(-12), notes: null,
        created_at: d(4),
        items: [{ product_id: pumpId, quantity: 15, unit_price: 284 }, { product_id: motorId, quantity: 5, unit_price: 520 }]
      },
      {
        supplier_id: easternId, created_by: userIds.operations_manager, status: 'processing',
        total_amount: 15920, expected_delivery: d(-5), notes: 'Standard quarterly',
        created_at: d(5),
        items: [{ product_id: valveId, quantity: 200, unit_price: 64 }, { product_id: bearingId, quantity: 500, unit_price: 8.5 }]
      },
      {
        supplier_id: primeId, created_by: ADMIN_ID, status: 'cancelled',
        total_amount: 3200, expected_delivery: d(-6), notes: 'Supplier unable to fulfill',
        created_at: d(6),
        items: [{ product_id: copperWireId, quantity: 1000, unit_price: 3.2 }]
      },
    ];

    const orderIds: string[] = [];
    for (const o of ordersData) {
      const existing = await client.query(
        'SELECT id FROM orders WHERE company_id = $1 AND total_amount = $2 AND created_at::date = $3::date',
        [COMPANY_ID, o.total_amount, o.created_at]
      );
      if (existing.rows.length > 0) {
        orderIds.push(existing.rows[0].id);
        console.log(`  Order for $${o.total_amount} already exists, skipping`);
        continue;
      }
      const r = await client.query(
        `INSERT INTO orders (company_id, supplier_id, created_by, status, total_amount, expected_delivery, notes, created_at, updated_at)
         VALUES ($1,$2,$3,$4::order_status,$5,$6,$7,$8,$8) RETURNING id`,
        [COMPANY_ID, o.supplier_id, o.created_by, o.status, o.total_amount, o.expected_delivery, o.notes, o.created_at]
      );
      const orderId = r.rows[0].id;
      orderIds.push(orderId);
      for (const item of o.items) {
        await client.query(
          'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1,$2,$3,$4)',
          [orderId, item.product_id, item.quantity, item.unit_price]
        );
      }
      console.log(`  Created order: $${o.total_amount} (${o.status})`);
    }

    const [order1, order2, order3, order4, order5] = orderIds;

    // --- Shipments ---
    const shipmentsData = [
      {
        order_id: order2, tracking_number: 'GT-8847291', carrier: 'DHL',
        status: 'in_transit', origin: 'Shenzhen, CN', destination: 'Chicago, US',
        shipped_at: d(1), estimated_arrival: d(-3)
      },
      {
        order_id: order3, tracking_number: 'PM-5512884', carrier: 'FedEx',
        status: 'preparing', origin: 'Mumbai, IN', destination: 'Chicago, US',
        shipped_at: null, estimated_arrival: d(-4)
      },
      {
        order_id: order4, tracking_number: 'AI-7734120', carrier: 'UPS',
        status: 'delivered', origin: 'Detroit, US', destination: 'Chicago, US',
        shipped_at: d(4), estimated_arrival: d(1), delivered_at: d(1)
      },
      {
        order_id: order5, tracking_number: null, carrier: null,
        status: 'preparing', origin: 'Seoul, KR', destination: 'Chicago, US',
        shipped_at: null, estimated_arrival: d(-8)
      },
    ];

    for (const s of shipmentsData) {
      const existing = await client.query(
        'SELECT id FROM shipments WHERE company_id = $1 AND order_id = $2',
        [COMPANY_ID, s.order_id]
      );
      if (existing.rows.length > 0) {
        console.log(`  Shipment for order ${s.order_id} already exists, skipping`);
        continue;
      }
      await client.query(
        `INSERT INTO shipments (company_id, order_id, tracking_number, carrier, status, origin, destination, shipped_at, estimated_arrival, delivered_at)
         VALUES ($1,$2,$3,$4,$5::shipment_status,$6,$7,$8,$9,$10)`,
        [COMPANY_ID, s.order_id, s.tracking_number, s.carrier, s.status, s.origin, s.destination, s.shipped_at, s.estimated_arrival, (s as any).delivered_at || null]
      );
      console.log(`  Created shipment: ${s.tracking_number || 'pending'} (${s.status})`);
    }

    // --- Audit Logs ---
    const auditData = [
      { user_id: userIds.operations_manager, action: 'POST', resource: 'orders', resource_id: order1, details: { body: { notes: 'Urgent restock' } } },
      { user_id: userIds.supplier, action: 'POST', resource: 'shipments', resource_id: null, details: { body: { carrier: 'DHL', tracking_number: 'GT-8847291' } } },
      { user_id: ADMIN_ID, action: 'POST', resource: 'users', resource_id: userIds.operations_manager, details: { body: { role: 'operations_manager' } } },
      { user_id: userIds.operations_manager, action: 'PATCH', resource: 'orders', resource_id: order2, details: { body: { status: 'shipped' } } },
      { user_id: ADMIN_ID, action: 'POST', resource: 'inventory', resource_id: null, details: { body: { sku: 'PV-8', name: 'Pressure Valve PV-8' } } },
      { user_id: ADMIN_ID, action: 'PATCH', resource: 'orders', resource_id: order4, details: { body: { status: 'cancelled' } } },
    ];

    const existingLogs = await client.query('SELECT COUNT(*) FROM audit_logs WHERE company_id = $1', [COMPANY_ID]);
    if (Number(existingLogs.rows[0].count) === 0) {
      for (const a of auditData) {
        await client.query(
          `INSERT INTO audit_logs (company_id, user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5,$6)`,
          [COMPANY_ID, a.user_id, a.action, a.resource, a.resource_id, JSON.stringify(a.details)]
        );
      }
      console.log('  Created audit log entries');
    } else {
      console.log('  Audit logs already exist, skipping');
    }

    await client.query('COMMIT');
    console.log('\nSeed complete!');
    console.log('\nDemo Credentials:');
    console.log('  Admin:    admin@synapchain.ai  / Demo@12345');
    console.log('  Manager:  ops@synapchain.ai    / Demo@12345');
    console.log('  Supplier: supplier@synapchain.ai / Demo@12345');
    console.log('  Analyst:  analyst@synapchain.ai / Demo@12345');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);
