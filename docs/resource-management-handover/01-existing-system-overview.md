# 01. Existing System Overview

## 1. System Background & Context

The **Ethiopian Engineering Corporation Enterprise Asset Management System (EEC EAMS)** was designed and developed to provide centralized tracking, physical custody tracking, assignment lifecycle management, maintenance oversight, and departmental accountability for corporation assets.

The original application is architected as a monorepo consisting of:
- A dedicated **Express.js + TypeScript** REST API backend (`backend/`).
- A **Next.js 14 App Router** web frontend (`frontend/`).
- A PostgreSQL relational database managed via **Prisma ORM**.
- An automated verification and seed suite located in `backend/prisma/` and `backend/src/scripts/`.

---

## 2. Technology Stack

### 2.1 Backend Technology Stack

| Layer / Concern | Technology / Library | Version | Role in System |
| :--- | :--- | :--- | :--- |
| **Runtime & Language** | Node.js + TypeScript (`tsx` / `tsc`) | TypeScript `^7.0.2`, `tsx` `^4.23.15` | Typesafe server runtime |
| **HTTP Framework** | Express | `^5.2.1` | REST routing, route handlers, middleware |
| **Database & ORM** | PostgreSQL + Prisma ORM | `@prisma/client` `^7.10.0`, `@prisma/adapter-pg` `^7.10.0` | Schema definition, migrations, query builder |
| **Authentication Core** | Better Auth | `^1.7.5` | Isolated credential tables, session cookies, password hashing |
| **Security & Headers** | Helmet, CORS | `helmet` `^8.3.0`, `cors` `^2.8.6` | Security headers, credentialed cross-origin requests |
| **Validation** | Zod | `^4.6.5` | Request body, query param, and DTO validation |
| **Email Service** | Nodemailer & Resend | `nodemailer` `^10.0.10`, `resend` `^6.28.1` | SMTP transaction emails (welcome/approval, password reset) |

### 2.2 Frontend Technology Stack

| Layer / Concern | Technology / Library | Version | Role in System |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js (App Router) | `14.2.35` | Server/Client rendering, routing, layouts |
| **UI Library** | React / React DOM | `^18.x` | Declarative component UI |
| **Styling** | Tailwind CSS + PostCSS | `tailwindcss` `^3.4.1`, `postcss` `^8.x` | Utility-first responsive styling |
| **Icons** | Lucide React | `^1.47.0` | System icon set |
| **HTTP Client** | Axios | `^1.20.0` | Client-side API requests (`withCredentials: true`) |
| **Form Handling** | React Hook Form + `@hookform/resolvers` | `react-hook-form` `^7.88.0`, `@hookform/resolvers` `^5.9.1` | Controlled forms and client validation |
| **Client Auth** | Better Auth React Client | `better-auth/react` `^1.7.5` | Client session management and session hooks |
| **Typography** | Inter (Google Fonts) | Web font import | Corporate typography across all views |

---

## 3. Project Structure

```
EEC-Asset-Management-System-AMS-/
├── backend/
│   ├── prisma/
│   │   ├── migrations/            # SQL migration history
│   │   ├── schema.prisma          # Authoritative data schema (509 lines)
│   │   └── seed.ts                # Corporate seed script with 10 EEC departments and demo accounts
│   ├── src/
│   │   ├── index.ts               # Express entrypoint, middleware ordering, route mounts
│   │   ├── constants/             # Centralized ROLES and PERMISSIONS matrices
│   │   │   ├── roles.ts
│   │   │   ├── permissions.ts
│   │   │   └── index.ts
│   │   ├── lib/
│   │   │   ├── auth.ts            # Better Auth configuration & database hooks
│   │   │   ├── prisma.ts          # Singleton Prisma client instance
│   │   │   ├── email/             # Email templates & transporter configuration
│   │   │   ├── authorization/     # Granular resource ownership checking functions
│   │   │   │   └── resourceAccess.ts
│   │   │   └── events/            # Standardized event payload structures
│   │   ├── middleware/            # Security & RBAC middleware
│   │   │   ├── auth.middleware.ts # Better Auth session validator (attaches req.auth)
│   │   │   ├── requireRole.ts     # Role enforcement middleware
│   │   │   ├── requirePermission.ts # Granular permission middleware
│   │   │   ├── requireDepartmentAccess.ts # Department boundary scoping
│   │   │   └── audit.middleware.ts
│   │   ├── modules/               # 14 Business domain modules (Controller, Service, Repository, Validator, Routes)
│   │   │   ├── identity/          # Registration, approval, rejection, account status
│   │   │   ├── departments/       # Organization hierarchy & sector management
│   │   │   ├── employees/         # Staff profiles & user linking
│   │   │   ├── assets/            # Hardware/equipment registry & inventory counts
│   │   │   ├── asset-assignments/ # Direct assignment, transfer, return
│   │   │   ├── asset-requests/    # Formal requisition, approval, physical handover
│   │   │   ├── asset-returns/     # Return requisition & direct walk-in return
│   │   │   ├── store/             # Store Keeper dashboard, KPIs, movement history
│   │   │   ├── maintenance/       # Repair tickets, cost tracking, technician assignments
│   │   │   ├── testing/           # Post-maintenance quality inspections
│   │   │   ├── notifications/     # In-app notifications & multi-recipient dispatch
│   │   │   ├── reports/           # Departmental, maintenance, warranty & asset analytics
│   │   │   ├── search/            # Universal cross-module search
│   │   │   └── settings/          # Corporate settings, branding, timezones
│   │   └── scripts/               # 7 Standalone automated test/verification suites
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── app/                       # Next.js 14 App Router hierarchy
│   │   ├── page.tsx               # Root redirect with animated corporate splash guard
│   │   ├── layout.tsx             # Root HTML layout with font imports
│   │   ├── globals.css            # Custom CSS variables, scrollbars, and keyframe animations
│   │   ├── (auth)/                # Public authentication routes
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   ├── pending/
│   │   │   ├── rejected/
│   │   │   ├── forgot-password/
│   │   │   ├── reset-password/
│   │   │   └── verify-email/
│   │   └── (dashboard)/           # Protected dashboard routes (under DashboardLayout)
│   │       ├── layout.tsx         # Dashboard shell (Sidebar, Navbar, Heartbeat Session Guard)
│   │       ├── dashboard/         # Role-tailored summary metrics & shortcuts
│   │       ├── departments/       # Department listing, creation, and detail views
│   │       ├── employees/         # Staff roster and employee detail cards
│   │       ├── users/pending/     # Admin pending approval table
│   │       ├── assets/            # Asset catalog with search and filters
│   │       ├── assignments/       # Assignment history & direct transfer dialogs
│   │       ├── requests/          # Admin/Manager asset requisition queue
│   │       ├── my-requests/       # Personal employee asset requests
│   │       ├── my-assets/         # Personal employee assigned assets
│   │       ├── my-maintenance/    # Personal or assigned technician maintenance tickets
│   │       ├── store/             # Store Keeper central operational hub
│   │       │   ├── inventory/     # Inventory breakdown by status and category
│   │       │   ├── requests/      # Store Keeper handover queue (approved requests)
│   │       │   └── returns/       # Store Keeper return processing & walk-in returns
│   │       ├── maintenance/       # Corporate maintenance ticket queue
│   │       ├── testing/           # QA testing & inspection checklist
│   │       ├── reports/           # Analytical charts, exports, warranty alerts
│   │       ├── notifications/     # Notification center inbox
│   │       ├── profile/           # Authenticated user profile and password change
│   │       └── settings/          # Corporate branding & system configuration
│   ├── components/                # Modular UI components
│   │   ├── brand/                 # EEC Logo & branding badges
│   │   ├── layout/                # Sidebar, Navbar, Breadcrumbs
│   │   ├── ui/                    # Modals, Toast, StatusBadge, StatCard, SearchInput
│   │   └── loading/               # LogoPreloader & skeleton placeholders
│   ├── src/                       # Client architecture support
│   │   ├── context/               # AuthSessionContext, AppDataCacheContext
│   │   ├── hooks/                 # usePermissions, useSystemSettings
│   │   ├── lib/                   # Axios client, auth-client, authorization helpers
│   │   └── services/              # 14 strongly-typed Axios API services
│   ├── tailwind.config.ts         # Brand color tokens & custom shadows
│   └── package.json
```

---

## 4. Implemented Modules vs. Incomplete / Planned Functionality

### 4.1 Verified Fully Implemented

1. **Authentication & Session Management**:
   - Dual-table auth architecture: Better Auth handles security tables (`auth_user`, `auth_session`, `auth_account`, `auth_verification`), while business table `User` manages `role`, `status`, and `employeeProfile`.
   - Cookie-based authentication (`auth_session` cookie with `credentials: include`).
   - Self-registration with automatic pending account status (`AccountStatus.PENDING`).
   - Administrator review: approve account (with email auto-verification sync) or reject account with reason.

2. **Role-Based Access Control (RBAC)**:
   - 5 distinct roles: `ADMIN`, `IT_TECHNICIAN`, `DEPARTMENT_MANAGER`, `EMPLOYEE`, `STORE_KEEPER`.
   - Layered backend enforcement: route-level role checks (`requireRole`), permission checks (`requirePermission`), and resource ownership checks (`requireDepartmentAccess`, `resourceAccess.ts`).

3. **Organizational Hierarchy & Employees**:
   - 10 real Ethiopian Engineering Corporation sectors seeded (Transport, Energy, Water, Building, Geotechnical, etc.).
   - Employee profile binding to users, departments, and employee IDs.

4. **Asset Registry & Dynamic Inventory**:
   - Asset tracking by code (`assetCode`), serial number, category, brand, model, condition, and location.
   - Dynamic inventory derivation: `getInventory()` aggregates counts directly from the `Asset` table, ensuring inventory is always in sync with asset status.

5. **Requisition & Physical Handover (Phase 11C)**:
   - Employee/Manager submits request -> Admin approves/rejects -> Store Keeper fulfills with physical unit selection inside an atomic transaction.
   - Concurrency protection: verifies asset is strictly `AVAILABLE` and matches category before assignment.

6. **Asset Returns (Phase 11D)**:
   - Path A (Requisition): Employee requests return -> Store Keeper receives physical unit, records return location and condition, closes assignment, sets asset to `AVAILABLE`.
   - Path B (Direct Walk-in): Store Keeper directly receives assigned unit without a prior request.

7. **Maintenance & Testing (Phase 4 / 9D)**:
   - Ticket lifecycle: `OPEN` -> `IN_PROGRESS` -> `TESTING` -> `COMPLETED` / `CANCELLED`.
   - Automatic asset status sync (`MAINTENANCE`, `TESTING`, restored to `ASSIGNED` or `AVAILABLE`).
   - Enforced prerequisite: A ticket cannot transition to `COMPLETED` unless the latest `InspectionTest` has `passed = true`.

8. **In-App Notification Center (Phase 10B)**:
   - Persistent notifications across all major lifecycle events (accounts, requests, returns, maintenance, assignments).
   - Unread badge counters, polling/refresh hooks, mark single/all as read, delete read notifications.

---

### 4.2 Incomplete, Partial, or Planned Functionality

1. **Depreciation & Asset Valuation (Planned)**:
   - The `Asset` model stores `purchaseDate` and `purchasePrice` (`Decimal(12, 2)`).
   - However, no straight-line or declining-balance depreciation calculation engine is implemented. Net book value is not dynamically computed.

2. **Disposal & Decommissioning Workflow (Partial)**:
   - `AssetStatus` enum includes `RETIRED` and `DISPOSED`.
   - However, there is no formal scrap/disposal committee approval workflow, auction recording, or salvage value write-off ledger.

3. **Barcode / QR Code Generation & Scanning (Planned)**:
   - `assetCode` exists on all items, but there is no integrated barcode/QR code generation (SVG/Canvas) or mobile camera barcode scanner.

4. **External Production Email Transport (Environmental)**:
   - Nodemailer Gmail SMTP and Resend configurations exist. If external SMTP credentials are not configured or blocked by firewall, emails fail gracefully while in-app notifications still succeed.

5. **Audit Log Persistence (Partial)**:
   - An `AuditLog` table exists in Prisma (`action`, `entity`, `entityId`, `details`, `ipAddress`, `userAgent`).
   - `audit.middleware.ts` and `events.ts` define payloads, but automated global request audit logging across every write endpoint is only partially wired up.
