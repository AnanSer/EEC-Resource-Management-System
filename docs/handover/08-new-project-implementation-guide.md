# 08. New Project Implementation Guide (React + Vite)

## 1. Guiding Principles for the New Repository

To ensure a seamless, rapid, and robust delivery of the **Resource Management System (RMS)** in a clean separate repository, follow these core principles:
1. **Preserve Proven Backend Logic**: Re-use the existing relational schema, state machines, atomic transactions, and RBAC rules without deviation.
2. **Pure SPA Frontend (React + Vite)**: Avoid Next.js App Router entirely. Building as a standard client-side Single-Page Application (SPA) using React 18, Vite, and React Router v6 permanently eliminates hydration mismatches, server component boundaries, and complex SSR preloader synchronization.
3. **Phased Incremental Milestones**: Follow the original project's fast, phased delivery style, ensuring each phase is end-to-end testable before moving to the next.

---

## 2. Frontend Rebuild Strategy: Clean React + Vite Architecture

```mermaid
graph TD
    subgraph Vite Project Setup
        A1[Vite 5+ with React & TypeScript template] --> A2[Tailwind CSS with EEC Brand Tokens]
        A2 --> A3[Axios withCredentials: true]
        A3 --> A4[Centralized React Router v6]
    end

    subgraph State & Route Protection
        B1[AuthContext & usePermissions hook] --> B2[Protected Layout Route Guard]
        B2 --> B3[DashboardShell: Sidebar + Navbar]
    end

    subgraph Domain Views
        B3 --> C1[Store Operations Hub]
        B3 --> C2[Resource Catalog & Inventory]
        B3 --> C3[Requisitions & Handover Queue]
        B3 --> C4[Maintenance & Inspection Queue]
    end

    Vite Project Setup --> State & Route Protection
```

### 2.1 Essential Replacement Matrix (Next.js to React + Vite)

| Next.js 14 Feature (Original) | Clean Vite + React Equivalent | Notes |
| :--- | :--- | :--- |
| `next/navigation` (`useRouter`) | `useNavigate()` from `react-router-dom` | Call `navigate('/dashboard')` directly; no `router.push` |
| `next/navigation` (`usePathname`) | `useLocation().pathname` | Clean reactive URL inspection |
| `next/navigation` (`useSearchParams`)| `useSearchParams()` from `react-router-dom` | Standard Web API query parameter state |
| `next/link` (`<Link href="...">`) | `<Link to="...">` from `react-router-dom` | Standard anchor wrapping |
| `next/image` (`<Image src="...">`) | Standard `<img>` with SVG/PNG asset imports | No image optimization server required |
| File-system routing (`app/...`) | Centralized route tree (`src/routes/index.tsx`) | Explicit, visible, and easily debugged routes |
| App Router Layout (`layout.tsx`) | `<Outlet />` inside layout component | Standard nested routing pattern |
| Port `3000` | Port `5173` (Vite Default) | **Crucial**: Add `http://localhost:5173` to backend CORS & Better Auth `trustedOrigins` |

---

## 3. Recommended Phased Implementation Order

### Phase 1: Project Scaffolding & Design Foundation
- Initialize repository with Vite (`npm create vite@latest . -- --template react-ts`).
- Install core dependencies: `tailwindcss`, `postcss`, `autoprefixer`, `lucide-react`, `clsx`, `axios`.
- Configure `tailwind.config.js` with verified EEC brand tokens:
  - `primary: '#083D4A'`
  - `accent: '#00A7D6'`
  - `active: '#C96F59'`
  - `background: '#F4F8FA'`
  - `card: '#FFFFFF'`
  - `text: '#1E293B'`
- Port core UI primitives from original codebase: `StatusBadge`, `StatCard`, `PageHeader`, `SearchInput`, `ConfirmationModal`, `ToastProvider`.

### Phase 2: Authentication & Route Protection Shell
- Configure Axios client (`src/lib/axios.ts`):
  ```typescript
  import axios from 'axios';

  export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
    withCredentials: true,
  });
  ```
- Build `AuthContext`: Fetch `/api/auth/me` on boot, expose `user`, `role`, `status`, and `isAuthenticated`.
- Implement `ProtectedRoute` and `RoleGuard` wrapper components.
- Build public auth pages: Sign In, Register, Pending Approval notice, and Rejected account screen.
- Implement responsive `DashboardLayout` with collapsible `Sidebar` and sticky `Navbar`.

### Phase 3: Master Data Management (Departments & Employees)
- Implement `/departments`: Listing, search, create modal, and detail view.
- Implement `/employees`: Employee roster, department filtering, and employee profile detail view.
- Implement `/users/pending`: Administrator review table for approving/rejecting user registration requests.

### Phase 4: Core Resource Registry & Live Inventory
- Implement `/assets` (or `/resources`): Multi-filter catalog by category, condition, status, and department.
- Implement resource registration modal with validation.
- Implement `/store/inventory`: Dynamic status counts (Available, Assigned, Maintenance, Testing, Retired) and category breakdown derived from database.
- Implement physical location update dialog (`PATCH /api/assets/:id/location`).

### Phase 5: Requisitions & Store Handover (Phase 11C Core)
- Implement `/my-requests` for staff: Requisition form with category, description, and notes.
- Implement `/requests` for Admins and Managers: Approval modal (with remarks) and rejection modal (with mandatory reason).
- Implement `/store/requests` for Store Keepers:
  - Table of `APPROVED` requests awaiting physical handover.
  - Handover Modal: Select an available unit matching the requested category, record physical condition on assign, record handover remarks, and execute atomic handover.

### Phase 6: Asset Returns & Movement History (Phase 11D & 11E Core)
- Implement return requisition from `/my-assets` (Path A).
- Implement `/store/returns`:
  - Scheduled returns receiving modal (condition on return, return warehouse location, close assignment).
  - Walk-in direct return action modal (Path B).
- Implement Asset Movement History timeline (`/store/assets/:id/history`).

### Phase 7: Maintenance & Quality Assurance Testing
- Implement `/maintenance`: Ticket listing, create repair ticket dialog (auto-sets asset status to `MAINTENANCE`).
- Implement ticket detail view: Log repair costs, assign technician, add resolution notes.
- Implement `/testing`: Quality inspection checklist.
- Verify completion prerequisite: Ticket cannot transition to `COMPLETED` unless latest inspection passed.

### Phase 8: Notification Center, Settings & Operational Reports
- Implement in-app notification bell dropdown and `/notifications` inbox.
- Implement `/settings`: Corporate branding, timezone, contact info.
- Implement `/reports`: Department allocation, maintenance analytics, and warranty expiration alerts.

---

## 4. Minimum First-Release (MVP Release 1.0) Checklist

To achieve a production-ready first release without unnecessary scope creep, focus strictly on the following completion criteria:

```
[ ] 1. Authentication & Security
    [ ] Self-registration creates PENDING account.
    [ ] Admin can approve (with role) or reject account.
    [ ] PENDING/SUSPENDED users are strictly barred from dashboard routes.
    [ ] 5 distinct roles enforced across frontend views and backend endpoints.

[ ] 2. Master Data & Catalog
    [ ] Active departments and employee profiles viewable and manageable.
    [ ] Assets/Resources can be registered with unique assetCode and serial number.
    [ ] Dynamic inventory correctly derives Available, Assigned, and Maintenance counts.

[ ] 3. Complete Custody Lifecycle
    [ ] Staff can submit requisitions; Admin can approve or reject.
    [ ] Store Keeper can physically hand over approved units with concurrency protection.
    [ ] Assets can be returned via scheduled request or walk-in receiving.
    [ ] Returned assets immediately restore to AVAILABLE and update storage location.

[ ] 4. In-App Notifications
    [ ] Requisition submissions alert Admins.
    [ ] Approvals alert Requesters and Store Keepers.
    [ ] Handovers and Returns alert former and current asset holders.

[ ] 5. Clean Vite Performance
    [ ] Zero hydration errors or server-rendering warnings.
    [ ] Fast sub-second page transitions via React Router v6.
    [ ] Brand styling and typography match verified EEC corporate design tokens.
```

---

## 5. Recommended Frontend Package.json for New Vite Project

```json
{
  "name": "eec-resource-management-system",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.9.0",
    "axios": "^1.7.7",
    "clsx": "^2.1.1",
    "lucide-react": "^0.453.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.53.0",
    "react-router-dom": "^6.27.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3",
    "vite": "^5.4.9"
  }
}
```
