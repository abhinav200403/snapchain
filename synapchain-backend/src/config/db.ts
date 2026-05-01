import { Pool, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,                        // Neon free tier — keep connections low
  idleTimeoutMillis: 10000,      // Release idle connections after 10s (before Neon drops them)
  connectionTimeoutMillis: 10000, // Wait up to 10s for a connection
  allowExitOnIdle: false,
});

pool.on('error', (err) => {
  console.error('DB pool error (connection will be replaced):', err.message);
});

function isTransient(err: any): boolean {
  return (
    err.message?.includes('Control plane request failed') ||
    err.message?.includes('Connection terminated') ||
    err.message?.includes('connection') ||
    err.code === 'ECONNRESET' ||
    err.code === 'ECONNREFUSED'
  );
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Query wrapper — retries up to 3 times with backoff for Neon cold-start / transient errors
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  let lastErr: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await pool.query<T>(text, params);
    } catch (err: any) {
      lastErr = err;
      if (isTransient(err) && attempt < 3) {
        const delay = attempt * 1500; // 1.5s, 3s
        console.warn(`DB transient error (attempt ${attempt}/3) — retrying in ${delay}ms: ${err.message}`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export default pool;
