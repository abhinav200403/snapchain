import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import dns from 'dns';
import dotenv from 'dotenv';

dotenv.config();

// Local router DNS can't resolve Neon hostnames — use Google DNS for resolve4() calls.
// We pre-resolve the IP before creating the pool so pg never calls getaddrinfo internally.
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

function resolveHost(hostname: string): Promise<string> {
  return new Promise((res, rej) =>
    dns.resolve4(hostname, (err, addrs) => (err ? rej(err) : res(addrs[0])))
  );
}

async function createPool(): Promise<Pool> {
  const rawUrl = process.env.DATABASE_URL!;
  const url = new URL(rawUrl);
  const hostname = url.hostname;

  let host = hostname;
  try {
    host = await resolveHost(hostname);
    console.log(`DB: resolved ${hostname} → ${host}`);
  } catch {
    console.warn(`DB: DNS pre-resolve failed, falling back to hostname: ${hostname}`);
  }

  const p = new Pool({
    host,
    port: Number(url.port) || 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false, servername: hostname },
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: false,
  });

  p.on('error', (err) => console.error('DB pool error:', err.message));
  return p;
}

let _pool: Pool | undefined;
let _init: Promise<Pool> | undefined;

function getPool(): Promise<Pool> {
  if (_pool) return Promise.resolve(_pool);
  if (!_init) {
    _init = createPool()
      .then(p => { _pool = p; return p; })
      .catch(err => { _init = undefined; throw err; });
  }
  return _init;
}

function isTransient(err: any): boolean {
  return (
    err.message?.includes('Control plane request failed') ||
    err.message?.includes('Connection terminated') ||
    err.message?.includes('connection') ||
    err.code === 'ECONNRESET' ||
    err.code === 'ECONNREFUSED' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'EAI_AGAIN'
  );
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  let lastErr: any;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await (await getPool()).query<T>(text, params);
    } catch (err: any) {
      lastErr = err;
      if (isTransient(err) && attempt < 5) {
        const delay = attempt * 2000;
        console.warn(`DB transient error (attempt ${attempt}/5) — retrying in ${delay}ms: ${err.message}`);
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
  throw lastErr;
}

// For transactions — callers use client.query / client.release directly
export async function connect(): Promise<PoolClient> {
  return (await getPool()).connect();
}

// Default export: proxy that delegates pool.connect() and pool.query() to the lazy pool.
// Existing code that does `pool.connect()` or `pool.query()` continues to work unchanged.
const poolProxy = new Proxy({} as Pool, {
  get(_t, prop: string) {
    if (prop === 'connect') return connect;
    if (prop === 'query') return query;
    return async (...args: any[]) => ((await getPool()) as any)[prop](...args);
  },
});

export default poolProxy;
