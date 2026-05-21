import { query } from './db';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function runOnce(): Promise<void> {
  // v1 — email verification
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT true`);
  await query(`
    CREATE TABLE IF NOT EXISTS verification_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // v2 — extended order lifecycle
  // Add new enum values (each must be a separate statement — ALTER TYPE ADD VALUE cannot run in a multi-statement block)
  const newStatuses = [
    'pending_approval',
    'awaiting_supplier_confirmation',
    'accepted_by_supplier',
    'dispatched',
    'in_transit',
    'rejected',
  ];
  for (const s of newStatuses) {
    await query(`DO $$ BEGIN
      ALTER TYPE order_status ADD VALUE IF NOT EXISTS '${s}';
    EXCEPTION WHEN others THEN NULL; END $$`);
  }

  // Migrate existing rows to new status names (idempotent — only touches old values)
  await query(`UPDATE orders SET status = 'pending_approval'               WHERE status = 'pending'`);
  await query(`UPDATE orders SET status = 'accepted_by_supplier'           WHERE status = 'processing'`);
  await query(`UPDATE orders SET status = 'in_transit'                     WHERE status = 'shipped'`);

  // v2 — supplier_id on orders: ensure column exists (may already)
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id)`);

  // v3 — extended shipment lifecycle statuses
  const newShipmentStatuses = ['packed', 'reached_hub'];
  for (const s of newShipmentStatuses) {
    await query(`DO $$ BEGIN
      ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS '${s}';
    EXCEPTION WHEN others THEN NULL; END $$`);
  }

  // v3 — shipment metadata columns
  await query(`ALTER TABLE shipments ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(100)`);
  await query(`ALTER TABLE shipments ADD COLUMN IF NOT EXISTS driver_name VARCHAR(255)`);
  await query(`ALTER TABLE shipments ADD COLUMN IF NOT EXISTS driver_phone VARCHAR(50)`);
  await query(`ALTER TABLE shipments ADD COLUMN IF NOT EXISTS dispatch_timestamp TIMESTAMPTZ`);

  // v3 — updated_at column on orders and shipments (needed for KPI calculations)
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
  await query(`ALTER TABLE shipments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);

  // v4 — reserved_quantity on products for stock reservation system
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER DEFAULT 0`);

  // v5 — PO number system
  await query(`
    CREATE TABLE IF NOT EXISTS po_sequences (
      company_id UUID PRIMARY KEY,
      last_number INTEGER DEFAULT 0
    )
  `);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS po_number VARCHAR(20)`);

  // Backfill existing orders that have NULL po_number
  await query(`
    DO $$
    DECLARE
      r RECORD;
      yr TEXT;
      seq_num INTEGER;
      po TEXT;
    BEGIN
      FOR r IN SELECT id, company_id, created_at FROM orders WHERE po_number IS NULL ORDER BY created_at ASC LOOP
        yr := EXTRACT(YEAR FROM r.created_at)::TEXT;
        INSERT INTO po_sequences (company_id, last_number)
          VALUES (r.company_id, 1)
          ON CONFLICT (company_id) DO UPDATE SET last_number = po_sequences.last_number + 1
          RETURNING last_number INTO seq_num;
        po := 'PO-' || yr || '-' || LPAD(seq_num::TEXT, 6, '0');
        UPDATE orders SET po_number = po WHERE id = r.id;
      END LOOP;
    END $$
  `);

  // v5 — Order activity timeline
  await query(`
    CREATE TABLE IF NOT EXISTS order_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL,
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id),
      event_type VARCHAR(100) NOT NULL,
      message TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id)`);

  // v5 — Invoice management
  await query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL,
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      invoice_number VARCHAR(100) NOT NULL,
      invoice_amount NUMERIC(15,2) NOT NULL,
      tax_amount NUMERIC(15,2) DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'USD',
      status VARCHAR(50) DEFAULT 'uploaded',
      file_url TEXT,
      notes TEXT,
      uploaded_by UUID REFERENCES users(id),
      approved_by UUID REFERENCES users(id),
      paid_at TIMESTAMPTZ,
      due_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // v5 — File/Document attachments
  await query(`
    CREATE TABLE IF NOT EXISTS attachments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL,
      resource_type VARCHAR(50) NOT NULL,
      resource_id UUID NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_url TEXT NOT NULL,
      file_size INTEGER,
      mime_type VARCHAR(100),
      uploaded_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_attachments_resource ON attachments(resource_type, resource_id)`);

  // v5 — SLA & Delay Monitoring columns
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS sla_breach BOOLEAN DEFAULT false`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS risk_flag VARCHAR(50) DEFAULT NULL`);
  await query(`ALTER TABLE shipments ADD COLUMN IF NOT EXISTS sla_breach BOOLEAN DEFAULT false`);

  // v5 — Partial fulfillment
  await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS fulfilled_quantity INTEGER DEFAULT 0`);
  await query(`DO $$ BEGIN
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'partially_fulfilled';
  EXCEPTION WHEN others THEN NULL; END $$`);

  // v5 — Approval hierarchy rules
  await query(`
    CREATE TABLE IF NOT EXISTS approval_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL,
      name VARCHAR(255) NOT NULL,
      min_amount NUMERIC(15,2) DEFAULT 0,
      max_amount NUMERIC(15,2),
      required_role VARCHAR(50) NOT NULL DEFAULT 'admin',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  console.log('Migrations applied.');
}

export async function runMigrations(): Promise<void> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await runOnce();
      return;
    } catch (err: any) {
      const isWakeup =
        err.message?.includes('Control plane request failed') ||
        err.message?.includes('connection') ||
        err.code === 'ECONNRESET';

      if (isWakeup && attempt < 5) {
        const delay = attempt * 2000;
        console.warn(`Migration attempt ${attempt}/5 failed (DB waking up) — retrying in ${delay}ms`);
        await sleep(delay);
        continue;
      }
      console.error('Migration failed after retries:', err.message);
      return;
    }
  }
}
