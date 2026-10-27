# Ethiopian Engineering Corporation (EEC) - Resource Management System (RMS)

Enterprise resource, capital asset, fleet, and technical inventory management platform developed for the **Ethiopian Engineering Corporation (EEC)**.

---

## 1. Monorepo Architecture

This repository is structured into **independently deployable, self-contained applications** with zero coupling across build systems.

The root of this repository contains **exactly four entries**:

```
EEC-Resource-Management-System/
├── frontend/        # React + Vite + TypeScript interactive web application
├── backend/         # Node.js + Express + TypeScript + Prisma backend API
├── docs/            # EEC corporate requirements, roles, workflows, & audit documentation
└── README.md        # Monorepo architecture & operations guide (this document)
```

---

## 2. Technology Stack & Key Decisions

| Tier | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite 6, TypeScript 5, Tailwind CSS 3 | Ultra-fast HMR, lightweight bundle (<420 KB), zero SSR complexity. |
| **Backend** | Node.js, Express, TypeScript, Prisma ORM, PostgreSQL | Robust enterprise relational data modeling, type-safe query execution. |
| **Authentication** | Custom Prisma session & HttpOnly cookies | **Strictly NO Better Auth**. Standardized, predictable session tokens. |
| **Design System** | EEC Design System | Corporate HSL tokens: Deep Navy (`#0A2540`), Teal (`#0D766E`), Warm Sand (`#F4EFEA`), Crimson Bolo Alert. |

---

## 3. Five Original Roles & Permissions Matrix

The system enforces five authoritative roles defined in `docs/resource-management-handover/02-roles-and-permissions.md`:

| Role Key | Corporate Persona | Operational Scope |
| :--- | :--- | :--- |
| `ADMIN` | System Administrator / ICT Directorate | Enterprise-wide governance, user account approvals, department creation, global asset audits, requisition approvals. |
| `STORE_KEEPER` | Chief Store Keeper / Warehouse Custodian | Central physical warehouse inventory (Kality & Gerji yards), physical fulfillment of approved requisitions, scheduled & walk-in return intake, custody tracking. |
| `IT_TECHNICIAN` | ICT Hardware Specialist & Lab Tech | Technical diagnostics, maintenance work orders, quality testing & inspections, calibration logs. |
| `DEPARTMENT_MANAGER` | Directorate / Sector Head | **Strictly scoped to their assigned department**; monitors departmental staff, departmental asset custody holdings, submits requisitions. |
| `EMPLOYEE` | Engineer / Field Officer | Strictly personal custodial responsibility; submits requisitions, views assigned assets, signals return requests, reports defects. |

### Department Data Visibility Rules
- **Department Manager Isolation**: A `DEPARTMENT_MANAGER` can only view and select employees belonging to their own department in employee directories, direct assignment modals, and custody transfers.
- **Enterprise View**: `ADMIN`, `STORE_KEEPER`, and `IT_TECHNICIAN` maintain corporate-wide visibility for governance, warehouse dispatch, and technical support.
- **Backend Enforcement**: In production, the backend Express API independently enforces these authorization boundaries on every `/api/*` route using server-side session middleware (`requireRole` and `requireDepartmentAccess`).

---

## 4. Local Development Workflow

Both applications can be run independently in separate terminal windows.

### Frontend Application
```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies (first time only)
npm install

# 3. Configure environment variables (optional for local mock mode)
cp .env.example .env

# 4. Start Vite development server
npm run dev
# -> App will serve on http://localhost:5173

# 5. Type-check and build
npm run type-check
npm run build
```

### Backend Application
```bash
# 1. Navigate to backend
cd backend

# 2. Install dependencies (first time only)
npm install

# 3. Configure environment variables
cp .env.example .env
# Set DATABASE_URL and PORT if different from defaults

# 4. Generate Prisma client
npm run prisma:generate

# 5. Start Express API server
npm run dev
# -> Server will run on http://localhost:5000 (Health check: http://localhost:5000/api/health)

# 6. Type-check and build
npm run type-check
npm run build
```

---

## 5. Independent Deployment Guide

The frontend and backend are designed to be hosted on completely independent platforms (e.g., Static CDN for Frontend + Container/PaaS for Backend).

### 5.1 Frontend Deployment (Static Hosting: Vercel, Netlify, Cloudflare Pages, S3/CloudFront)
1. **Build Command**: `npm run build`
2. **Output Directory**: `dist`
3. **Environment Variables**:
   - `VITE_API_URL`: Set to your deployed backend public URL (e.g. `https://api-rms.eec.gov.et/api`).
4. **Single Page Application (SPA) Routing**: Configure static host to rewrite all routes (`/*`) to `/index.html`.

### 5.2 Backend Deployment (Container/PaaS: Docker, Render, Railway, Fly.io, Ubuntu VPS)
1. **Build Command**: `npm run build`
2. **Start Command**: `npm run start` (executes `node dist/index.js`)
3. **Environment Variables**:
   - `PORT`: Typically provided by host (defaults to `5000`).
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: Production PostgreSQL connection string with SSL enabled.
   - `FRONTEND_URL`: The public URL of the deployed frontend (e.g. `https://rms.eec.gov.et`).

### 5.3 CORS & Cross-Origin Cookie Security
- The backend uses Express `cors` configured with `credentials: true` and strictly validates `origin` against `FRONTEND_URL`.
- Session tokens are stored in secure, HttpOnly, SameSite cookies.
- **Never expose backend secrets** (e.g. database credentials, JWT secrets) in the frontend bundle. Only `VITE_*` variables are exposed to the client.

---

## 6. PostgreSQL Database Setup (Prisma)

When preparing to connect the backend to live PostgreSQL:
1. Ensure PostgreSQL (version 14+) is running.
2. In `backend/.env`, set `DATABASE_URL`:
   ```env
   DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/eec_rms_db?schema=public"
   ```
3. Push schema to database:
   ```bash
   cd backend
   npx prisma db push
   # or run migrations:
   npx prisma migrate dev --name init
   ```

---

## 7. Handover Documentation Index

For detailed corporate specifications and business logic rules, consult `docs/`:
- [`docs/resource-management-handover/01-system-architecture.md`](docs/resource-management-handover/01-system-architecture.md)
- [`docs/resource-management-handover/02-roles-and-permissions.md`](docs/resource-management-handover/02-roles-and-permissions.md)
- [`docs/resource-management-handover/03-business-workflows.md`](docs/resource-management-handover/03-business-workflows.md)
- [`docs/resource-management-handover/04-category-specifications.md`](docs/resource-management-handover/04-category-specifications.md)
- [`docs/resource-management-handover/05-data-dictionary.md`](docs/resource-management-handover/05-data-dictionary.md)
- [`docs/resource-management-handover/06-integration-touchpoints.md`](docs/resource-management-handover/06-integration-touchpoints.md)
- [`docs/resource-management-handover/07-operational-governance.md`](docs/resource-management-handover/07-operational-governance.md)
- [`docs/resource-management-handover/08-migration-verification-guide.md`](docs/resource-management-handover/08-migration-verification-guide.md)
