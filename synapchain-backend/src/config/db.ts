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

// Query wrapper with one automatic retry on transient connection drops
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  try {
    return await pool.query<T>(text, params);
  } catch (err: any) {
    const isConnectionError =
      err.message?.includes('Connection terminated') ||
      err.message?.includes('connection') ||
      err.code === 'ECONNRESET' ||
      err.code === 'ECONNREFUSED';

    if (isConnectionError) {
      console.warn('DB connection dropped — retrying query once...');
      return await pool.query<T>(text, params);
    }
    throw err;
  }
}

export default pool;
