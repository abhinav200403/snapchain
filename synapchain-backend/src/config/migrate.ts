import { query } from './db';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function runOnce(): Promise<void> {
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
  console.log('Migrations applied.');
}

// Retries with backoff — Neon serverless may need a moment to wake up on cold start
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
        const delay = attempt * 2000; // 2s, 4s, 6s, 8s
        console.warn(`Migration attempt ${attempt}/5 failed (DB waking up) — retrying in ${delay}ms`);
        await sleep(delay);
        continue;
      }
      console.error('Migration failed after retries:', err.message);
      // Don't throw — a failed migration should not prevent the server from starting
      return;
    }
  }
}
