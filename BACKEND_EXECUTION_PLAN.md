# BACKEND EXECUTION PLAN — SynapChain
> Project: AI-powered Multi-Tenant Supply Chain SaaS
> Stack: Node.js + Express.js + PostgreSQL + JWT + OpenAI API

---

## CREDENTIALS & API KEYS NEEDED

Before starting, collect the following:

| Item | What it is | Where to get it |
|------|-----------|-----------------|
| `DATABASE_URL` | PostgreSQL connection string | Local install or Neon/Supabase/Render free tier |
| `JWT_ACCESS_SECRET` | Random 64-char string for signing access tokens | Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | Random 64-char string for refresh tokens | Same command as above |
| `OPENAI_API_KEY` | For AI demand forecasting + predictions | platform.openai.com → API Keys |
| `PORT` | Backend server port (default 5000) | Set in `.env` |
| `CLIENT_URL` | Frontend origin for CORS (e.g. http://localhost:8080) | Match Vite dev port |
| `BCRYPT_ROUNDS` | Salt rounds for password hashing (recommend: 12) | Constant in .env |

**No other paid services needed.** PostgreSQL can run locally for free.

---

## PHASE 1 — PROJECT SETUP (Day 1)

### 1.1 Initialize Backend Repo
```bash
mkdir synapchain-backend && cd synapchain-backend
npm init -y
npm install express pg jsonwebtoken bcrypt dotenv cors helmet morgan uuid
npm install -D typescript ts-node nodemon @types/express @types/pg @types/jsonwebtoken @types/bcrypt @types/cors @types/morgan @types/node @types/uuid
npx tsc --init
```

### 1.2 Folder Structure
```
synapchain-backend/
├── src/
│   ├── index.ts              # Entry point
│   ├── config/
│   │   └── db.ts             # PostgreSQL pool
│   ├── middleware/
│   │   ├── auth.ts           # JWT verify middleware
│   │   ├── rbac.ts           # Role-based access control
│   │   └── errorHandler.ts   # Global error handler
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── users.ts
│   │   ├── companies.ts
│   │   ├── inventory.ts
│   │   ├── orders.ts
│   │   ├── shipments.ts
│   │   ├── suppliers.ts
│   │   ├── analytics.ts
│   │   ├── predictions.ts
│   │   └── auditLog.ts
│   ├── controllers/          # Business logic (one per route file)
│   ├── services/
│   │   └── openai.ts         # AI prediction service
│   └── types/
│       └── index.ts          # Shared types
├── .env
├── .env.example
└── package.json
```

### 1.3 `.env` File Template
```env
DATABASE_URL=postgresql://user:password@localhost:5432/synapchain
JWT_ACCESS_SECRET=<64-char-random-hex>
JWT_REFRESH_SECRET=<64-char-random-hex>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
OPENAI_API_KEY=sk-...
PORT=5000
CLIENT_URL=http://localhost:8080
BCRYPT_ROUNDS=12
NODE_ENV=development
```

---

## PHASE 2 — DATABASE SCHEMA (Day 1-2)

Run in order in PostgreSQL:

### 2.1 Companies (Multi-Tenant Root)
```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  plan VARCHAR(50) DEFAULT 'free',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2 Users + Roles
```sql
CREATE TYPE app_role AS ENUM ('admin', 'operations_manager', 'supplier', 'business_analyst');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role app_role NOT NULL DEFAULT 'operations_manager',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_users_email ON users(email);
```

### 2.3 Refresh Tokens
```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.4 Suppliers
```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  rating NUMERIC(3,1) DEFAULT 0,
  lead_time_days INTEGER DEFAULT 7,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_suppliers_company ON suppliers(company_id);
```

### 2.5 Products / Inventory
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id),
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  category VARCHAR(100),
  stock_quantity INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 10,
  unit_price NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_company ON products(company_id);
```

### 2.6 Orders
```sql
CREATE TYPE order_status AS ENUM ('pending', 'approved', 'processing', 'shipped', 'delivered', 'cancelled');

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id),
  created_by UUID REFERENCES users(id),
  status order_status DEFAULT 'pending',
  total_amount NUMERIC(14,2) DEFAULT 0,
  expected_delivery DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL
);

CREATE INDEX idx_orders_company ON orders(company_id);
CREATE INDEX idx_orders_status ON orders(status);
```

### 2.7 Shipments
```sql
CREATE TYPE shipment_status AS ENUM ('preparing', 'in_transit', 'out_for_delivery', 'delivered', 'delayed');

CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  tracking_number VARCHAR(100),
  carrier VARCHAR(100),
  status shipment_status DEFAULT 'preparing',
  origin VARCHAR(255),
  destination VARCHAR(255),
  shipped_at TIMESTAMPTZ,
  estimated_arrival TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shipments_company ON shipments(company_id);
```

### 2.8 Audit Log
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100),
  resource_id VARCHAR(255),
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_company ON audit_logs(company_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
```

---

## PHASE 3 — API ROUTES (Day 2-4)

### 3.1 Authentication Routes
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Register new company + admin user |
| POST | `/api/auth/login` | Public | Login, returns access + refresh tokens |
| POST | `/api/auth/refresh` | Public | Rotate refresh token, new access token |
| POST | `/api/auth/logout` | Auth | Invalidate refresh token |
| GET | `/api/auth/me` | Auth | Get current user profile |

### 3.2 User Management Routes
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/users` | Admin | List all users in company |
| POST | `/api/users` | Admin | Create new user |
| PATCH | `/api/users/:id` | Admin | Update user role/status |
| DELETE | `/api/users/:id` | Admin | Deactivate user |

### 3.3 Inventory Routes
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/inventory` | Auth | List all products (with low-stock flag) |
| POST | `/api/inventory` | Admin, Manager | Add new product |
| PATCH | `/api/inventory/:id` | Admin, Manager | Update stock / product info |
| DELETE | `/api/inventory/:id` | Admin | Remove product |

### 3.4 Order Routes
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/orders` | Auth | List orders (filtered by role) |
| POST | `/api/orders` | Manager, Admin | Create purchase order |
| PATCH | `/api/orders/:id/status` | Auth | Update order status |
| GET | `/api/orders/:id` | Auth | Get single order with items |

### 3.5 Shipment Routes
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/shipments` | Auth | List all shipments |
| POST | `/api/shipments` | Supplier, Admin | Create shipment (dispatch) |
| PATCH | `/api/shipments/:id` | Supplier, Admin | Update shipment status |

### 3.6 Supplier Routes
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/suppliers` | Auth | List all suppliers |
| POST | `/api/suppliers` | Admin | Add supplier |
| PATCH | `/api/suppliers/:id` | Admin | Update supplier info |
| DELETE | `/api/suppliers/:id` | Admin | Remove supplier |

### 3.7 Analytics Routes
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/analytics/overview` | Admin, Analyst | Dashboard KPI stats |
| GET | `/api/analytics/orders` | Admin, Analyst | Orders over time chart data |
| GET | `/api/analytics/inventory` | Admin, Analyst | Inventory category breakdown |
| GET | `/api/analytics/suppliers` | Admin, Analyst | Supplier performance metrics |

### 3.8 AI Predictions Route
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/predictions/demand` | Analyst, Admin | Call OpenAI with sales history → demand forecast |
| GET | `/api/predictions/risk` | Analyst, Admin | Risk score per supplier/shipment |

### 3.9 Audit Log Route
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/audit` | Admin | Paginated audit log with filters |

---

## PHASE 4 — CORE MIDDLEWARE (Day 2)

### 4.1 JWT Auth Middleware (`middleware/auth.ts`)
- Extract Bearer token from `Authorization` header
- Verify with `JWT_ACCESS_SECRET`
- Attach `req.user = { id, companyId, role }` to request
- Return 401 if missing/invalid/expired

### 4.2 RBAC Middleware (`middleware/rbac.ts`)
- `allowRoles(...roles)` — factory function
- Check `req.user.role` against allowed roles
- Return 403 if not authorized
- Usage: `router.get('/users', auth, allowRoles('admin'), getUsers)`

### 4.3 Multi-Tenant Isolation
- Every DB query MUST include `WHERE company_id = req.user.companyId`
- Never expose data across companies
- Apply as middleware or in every controller

### 4.4 Audit Logger (`middleware/auditLog.ts`)
- Auto-log POST/PATCH/DELETE actions to `audit_logs` table
- Capture: user_id, action, resource, resource_id, ip_address

### 4.5 Global Error Handler (`middleware/errorHandler.ts`)
- Catch all errors, return consistent JSON `{ error: "message" }`
- Never leak stack traces in production
- Log errors to console in development

---

## PHASE 5 — AI INTEGRATION (Day 4-5)

### 5.1 OpenAI Demand Forecasting
- Collect last 90 days of order history from DB
- Send as structured prompt to `gpt-4o-mini` (cheapest, sufficient)
- Ask for demand predictions per product for next 30 days
- Store results in a `predictions` table or return directly
- Cache results for 24h to reduce API costs

### 5.2 Risk Assessment
- Rule-based scoring (no OpenAI needed for basic version):
  - Supplier rating < 3.5 → high risk
  - Shipments delayed > 2 times → risk flag
  - Stock below reorder level → alert
- OpenAI can explain risk factors in natural language

### 5.3 OpenAI API Cost Control
- Use `gpt-4o-mini` not `gpt-4o`
- Set max_tokens limit (500-800 tokens per call)
- Cache predictions, don't re-call on every request

---

## PHASE 6 — FRONTEND INTEGRATION (Day 5-6)

### 6.1 Set up Axios Client in Frontend
Create `src/lib/api.ts`:
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
});

// Auto-attach access token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  res => res,
  async error => {
    if (error.response?.status === 401) {
      // Call refresh endpoint, retry request
    }
    return Promise.reject(error);
  }
);

export default api;
```

### 6.2 Replace Demo Auth in AuthContext
- `login()` → POST `/api/auth/login`, store tokens
- `logout()` → POST `/api/auth/logout`, clear tokens
- On app load → GET `/api/auth/me` to restore session

### 6.3 Replace Hardcoded Data with React Query
```typescript
// Example for inventory
const { data: products, isLoading } = useQuery({
  queryKey: ['inventory', companyId],
  queryFn: () => api.get('/inventory').then(r => r.data),
});
```

### 6.4 Add `.env` to Frontend
```env
VITE_API_URL=http://localhost:5000/api
```

---

## PHASE 7 — TESTING (Day 6-7)

### 7.1 API Testing with Postman
- Import collection, test each route
- Test role-based access (403 for wrong roles)
- Test multi-tenant isolation (company A can't see company B data)

### 7.2 Unit Tests (Vitest — already installed in frontend)
- Test AuthContext login/logout
- Test RBAC middleware logic
- Test data transformation utilities

---

## PHASE 8 — DEPLOYMENT (Day 7-8)

| Component | Free Service | Paid Option |
|-----------|-------------|-------------|
| Frontend | Vercel | — |
| Backend | Render (free tier) | Railway |
| Database | Neon (free PostgreSQL) | Supabase |
| AI | OpenAI API (pay per use) | — |

### Environment Variables on Deployment
- Set all `.env` vars in Render/Railway dashboard
- Never commit `.env` to git
- Use `DATABASE_URL` from Neon dashboard

---

## EXECUTION TIMELINE

| Day | Tasks |
|-----|-------|
| 1 | Project init, folder structure, DB schema, `.env` setup |
| 2 | Auth routes (register, login, refresh, logout, me), JWT middleware, RBAC middleware |
| 3 | Users, Suppliers, Inventory CRUD routes |
| 4 | Orders, Shipments, Audit Log routes |
| 5 | Analytics queries, OpenAI predictions integration |
| 6 | Frontend: axios client, real auth, React Query data fetching |
| 7 | Fix all frontend bugs (see BUG_TRACKER.md), testing |
| 8 | Deployment, final documentation |

---

## WHAT YOU NEED TO PROVIDE

1. **OpenAI API Key** — `sk-...` from platform.openai.com
2. **PostgreSQL** — Either:
   - Install locally (postgres://localhost:5432)
   - OR create free account on [neon.tech](https://neon.tech) and copy connection string
3. **Nothing else** — JWT secrets are self-generated, no other paid services needed
