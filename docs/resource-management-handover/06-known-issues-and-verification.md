# 06. Known Issues, Technical Debt & Verification Evidence

## 1. Automated Verification Suites & Existing Tests

The backend contains **7 dedicated verification test suites** located in `backend/src/scripts/`. These scripts are standalone TypeScript suites executable via `npx tsx` that directly validate business logic, role boundaries, database transactions, and API endpoints.

### 1.1 Existing Test Scripts Summary

| Test Script File | Phase / Focus | Key Scenarios Verified | Verification Method |
| :--- | :--- | :--- | :--- |
| `test_storekeeper_rbac.ts` | Phase 11A / RBAC Regression | All 5 roles present in `ROLE_LIST`, demo users verified in DB, granular permissions matrix, role boundary denials | Direct DB & permission matrix assertions |
| `test_inventory_custody.ts` | Phase 11B / Inventory & Custody | Dynamic inventory calculation derived from live `Asset` records, category/location breakdown, physical location update isolation | Database counts & HTTP session requests |
| `test_asset_requests_workflow.ts` | Phase 11C / Requisitions | End-to-end request lifecycle: create, admin rejection, admin approval (inventory unchanged), store keeper handover, concurrency conflict protection | Service-layer method execution & Prisma transaction tests |
| `test_asset_returns_workflow.ts` | Phase 11D / Returns | Return request creation, store keeper physical check-in, direct walk-in return, active assignment closure, asset status restored to `AVAILABLE` | Service-layer execution & DB state validation |
| `test_store_operations_dashboard.ts`| Phase 11E / Store Dashboard | Live KPI aggregation, pending handover count, pending return count, chronological asset movement history compilation | Service-layer queries & mock timeline generation |
| `test_phase11e_fixes.ts` | Phase 11E / Bug Fixes | Mock Express controller tests: Store Keeper dashboard authorization, Admin approve/reject controller handling, category breakdown labels | Mock `req`/`res` controller execution |
| `test_notification_matrix.ts` | Phase 10B / Notifications | 15-point notification matrix: account approvals, rejections, maintenance assignments, QA test results, handover alerts across all 4 initial roles | Live DB notification insertion & helper verification |

### 1.2 Execution Commands

To execute these tests in the original backend environment (requires running PostgreSQL instance matching `.env`):
```bash
cd backend
npx tsx src/scripts/test_storekeeper_rbac.ts
npx tsx src/scripts/test_inventory_custody.ts
npx tsx src/scripts/test_asset_requests_workflow.ts
npx tsx src/scripts/test_asset_returns_workflow.ts
npx tsx src/scripts/test_store_operations_dashboard.ts
npx tsx src/scripts/test_phase11e_fixes.ts
npx tsx src/scripts/test_notification_matrix.ts
```

> [!NOTE]
> There are no Jest, Vitest, or Cypress configurations in either `backend/package.json` or `frontend/package.json`. Testing was conducted via the standalone `tsx` verification scripts and manual browser QA.

---

## 2. Known Issues & Architectural Flaws in the Original Application

### 2.1 Next.js Frontend Hydration & Preloader Conflicts
- **Problem**: The original Next.js frontend combined App Router server components with heavy client-side auth checks (`useEffect` in `DashboardAuthGuard`, `sessionStorage` splash screen flags, and `LogoPreloader`).
- **Symptom**: During hard page refreshes, users experienced hydration warnings, flickering layout shifts, and momentary competing preloaders before the dashboard rendered (addressed in commits `aa9ae73`, `bcee1a3`, and `f0a2ff8`).
- **Remedy for New Project**: Building with React 18 + Vite as a pure Single-Page Application (SPA) completely removes Next.js SSR hydration conflicts. A simple top-level router guard will handle authentication cleanly.

### 2.2 Dual-Table Authentication Complexity
- **Problem**: Better Auth stores core credentials in `auth_user`, `auth_session`, and `auth_account`, while business metadata resides in `User` and `EmployeeProfile`.
- **Symptom**:
  - The `User.passwordHash` field contains the placeholder string `"BETTER_AUTH_MANAGED"` rather than an actual hash.
  - When an admin approves an account, the backend had to execute dual updates:
    ```typescript
    await prisma.authUser.updateMany({ where: { email: user.email }, data: { emailVerified: true } });
    await prisma.user.update({ where: { id }, data: { isEmailVerified: true } });
    ```
- **Remedy for New Project**: In the new Resource Management System, either streamline the authentication provider or adopt a unified user model with standard JWT/session tables to eliminate cross-table synchronization friction.

### 2.3 External SMTP Configuration Fallback
- **Problem**: If corporate Gmail SMTP credentials are not configured in `.env`, account approval returns a partial warning:
  ```json
  {
    "message": "Account approved successfully, but welcome email could not be delivered.",
    "warning": "Account approved successfully, but welcome email could not be delivered."
  }
  ```
- **Current Behavior**: The system does not crash and the account is successfully marked `APPROVED`; in-app notifications still succeed. However, email delivery fails silently in offline or air-gapped environments.

### 2.4 Partial Audit Logging
- **Problem**: While `AuditLog` table exists in `schema.prisma` and helper factories exist in `backend/src/lib/events/`, automatic request audit logging is not globally hooked into every Express route. Only identity, maintenance, and assignment modules explicitly call audit notification logging.

---

## 3. Post-Mortem: Why the Experimental Vite Migration Failed

The previous attempt to migrate the frontend to Vite (`frontend-vite/`) ran into common migration pitfalls:

1. **Next.js Dependency Coupling**:
   - The original code extensively imported Next.js specific modules:
     - `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`)
     - `next/link` (`<Link href="...">`)
     - `next/image` (`<Image src="...">`)
   - Replacing these ad-hoc without a structured React Router v6 migration caused widespread runtime breakage across dozens of pages.

2. **CORS and Cookie Origin Mismatches**:
   - Next.js development ran on `http://localhost:3000`, which was hardcoded in `backend/src/index.ts` and `backend/src/lib/auth.ts`:
     ```typescript
     trustedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000']
     ```
   - Vite dev server defaults to `http://localhost:5173`. Because `5173` was not in `trustedOrigins` and CORS headers didn't match, Better Auth cookies were rejected by the browser, causing perpetual 401 Unauthorized redirect loops.

3. **Incomplete Route Manifestation**:
   - Next.js uses file-system based routing (`app/(dashboard)/departments/[id]/edit/page.tsx`).
   - The Vite migration lacked a cohesive, centralized React Router hierarchy, leading to broken route parameters (`useParams` vs Next.js `params.id`) and missing sub-routes.

4. **Component Import Paths**:
   - Mixed alias configurations (`@/components/...` vs `@/src/components/...`) caused path resolution errors in Vite's Rollup bundler.
