# 05. Frontend Architecture & Design System Reference

## 1. Visual Identity & Brand Design Tokens

The original application implements a custom corporate identity reflecting the **Ethiopian Engineering Corporation (EEC)** brand guidelines. In the new React + Vite project, these exact design tokens should be preserved.

### 1.1 Color Palette Tokens

| Token Name | Hex Code | Tailwind Token | Applied Usage |
| :--- | :--- | :--- | :--- |
| **Primary Brand Teal** | `#083D4A` | `colors.eec.primary` | Sidebar background, primary brand headers, major buttons, modal headers |
| **Accent Tech Cyan** | `#00A7D6` | `colors.eec.accent` | Active icon highlights, hyperlinks, focus rings, primary CTA hover states |
| **Active Terracotta** | `#C96F59` | `colors.eec.active` | Active sidebar indicator border (`.nav-item-active::before`), warning badges |
| **App Canvas Background**| `#F4F8FA` | `colors.eec.background`| Main application background canvas (soft cool grey-teal) |
| **Surface / Card** | `#FFFFFF` | `colors.eec.card` | Card panels, data table surfaces, modal containers |
| **Slate Typography** | `#1E293B` | `colors.eec.text` | Primary body typography (Slate 800) |
| **Corporate Splash Dark**| `#052831` | Custom Hex | Deep corporate background during initial auth boot and splash animation |

### 1.2 Typography & Elevation
- **Font Family**: `'Inter', system-ui, -apple-system, sans-serif`
- **Headings**: Semibold (`font-semibold` / 600) and Bold (`font-bold` / 700) with tracking `-0.015em`.
- **Card Shadow (`shadow-card`)**: `0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.07)`
- **Sidebar Shadow (`shadow-sidebar`)**: `2px 0 8px 0 rgba(8,61,74,0.08)`
- **Border Radius**: Cards use `rounded-xl` (12px); buttons and badges use `rounded-lg` (8px).

---

## 2. Core Layout Architecture

The frontend uses a dual-layout structure:
1. **Auth Layout (`app/(auth)/layout.tsx`)**:
   - Clean, centered card presentation on `#052831` or `#F4F8FA`.
   - Contains the official `EECLogo` with full corporate bilingual title (English & Amharic).
   - Designed for zero distraction during sign-in, self-registration, and password recovery.

2. **Dashboard Shell Layout (`app/(dashboard)/layout.tsx`)**:
   - **Persistent Left Sidebar (`Sidebar.tsx`)**:
     - Collapsible between full width (`w-64`) and compact icon rail (`w-20`).
     - Includes collapse toggle button with chevron animation.
     - Dynamic role-tailored navigation items filtered via `usePermissions()`.
     - Active item visual treatment: soft cyan background tint (`bg-eec-accent/10`) and vertical terracotta accent stripe (`#C96F59`).
   - **Sticky Top Navigation Bar (`Navbar.tsx`)**:
     - Dynamic breadcrumb path (`Breadcrumb.tsx`).
     - Universal search input with keyboard shortcut `/`.
     - **Notification Center**: Bell icon with unread count pill badge and live dropdown showing unread alerts.
     - **User Profile Dropdown (`UserAvatar.tsx`)**:
       - Displays user initials with avatar background.
       - Shows full name, email, role badge, and account status badge.
       - Quick links to Profile, Settings, and Sign Out action.
   - **Main Content Canvas (`<main className="flex-1 overflow-y-auto p-6">`)**:
     - Independent vertical scrolling container with custom slim scrollbars.

---

## 3. Sidebar Navigation by Role Matrix

The original navigation configuration (`src/lib/authorization/navigation.ts`) maps every route to allowed roles:

| Route / Page | Label | Icon | ADMIN | IT_TECHNICIAN | DEPARTMENT_MANAGER | EMPLOYEE | STORE_KEEPER |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `/dashboard` | Dashboard | `LayoutDashboard` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/departments` | Departments | `Building2` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `/employees` | Employees | `Users` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `/users/pending`| Pending Approvals | `UserCheck` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/assets` | Assets | `Package` | ✅ | ✅ | ✅ | ❌ | ✅ |
| `/store` | Store Operations | `Store` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `/store/inventory`| Inventory | `Warehouse` | ✅ | ✅ | ✅ | ❌ | ✅ |
| `/store/requests`| Store Requests | `PackageCheck` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `/store/returns` | Returns | `RotateCcw` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `/requests` | Asset Requests | `ClipboardCheck` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `/assignments` | Assignments | `ClipboardList` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/maintenance` | Maintenance | `Wrench` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/testing` | Testing | `FlaskConical` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/my-requests` | My Requests | `SendHorizontal` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `/my-assets` | My Assets | `Laptop` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `/my-maintenance`| My Maintenance | `Wrench` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `/reports` | Reports | `BarChart3` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `/profile` | Profile | `UserCircle` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/settings` | Settings | `Settings` | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 4. Key Reusable UI Components

The new React + Vite application should recreate these tested components from `components/ui/`:

### 4.1 `StatusBadge.tsx`
Renders standardized status pills across the application with matching semantic colors and dot indicators:
- **Available / Approved / Passed**: Emerald (`bg-emerald-50 text-emerald-700 border-emerald-200`)
- **Assigned / Fulfilled**: Blue (`bg-blue-50 text-blue-700 border-blue-200`)
- **Pending / In Progress / Open**: Amber (`bg-amber-50 text-amber-700 border-amber-200`)
- **Maintenance / Needs Repair**: Orange / Purple (`bg-orange-50 text-orange-700 border-orange-200`)
- **Testing**: Cyan / Sky (`bg-sky-50 text-sky-700 border-sky-200`)
- **Rejected / Damaged / Suspended**: Rose (`bg-rose-50 text-rose-700 border-rose-200`)
- **Retired / Cancelled**: Slate (`bg-slate-100 text-slate-600 border-slate-200`)

### 4.2 `StatCard.tsx`
Metric card displayed at the top of dashboard and report pages:
- **Props**: `title`, `value`, `icon`, `trend`, `colorVariant` (`teal`, `blue`, `amber`, `rose`, `slate`), `subtitle`.
- Features an icon container with subtle background tint and bold statistical figure.

### 4.3 `PageHeader.tsx`
Standardized header bar used at the top of every dashboard view:
- **Props**: `title`, `description`, `badge`, `breadcrumbs`, `actions` (e.g. "+ Register Asset", "Export CSV").

### 4.4 `SearchInput.tsx`
- Search input with leading search icon, clear button (`X`), and debounce logic (300ms) to prevent overwhelming the API during typing.

### 4.5 `ConfirmationModal.tsx`
- Accessible dialog for critical operations (e.g., approving an account, rejecting a request, confirming a physical return).
- Includes title, warning message, confirm button (with loading spinner state), and cancel button.

### 4.6 `Toast.tsx` & `useToast()`
- Floating toast alert system mounted via `ToastProvider` in the layout.
- Methods: `toast.success()`, `toast.error()`, `toast.warning()`, `toast.info()`.
- Auto-dismiss after 4 seconds with manual close button.

### 4.7 `EmptyState.tsx`
- Displayed when list queries return 0 items.
- Features an icon container, descriptive message ("No pending requests found"), and an optional primary action button ("Submit New Request").

---

## 5. Client State Management & Caching

The frontend does not use heavy Redux; instead, it uses a lightweight, clean **React Context + Service** pattern:

### 5.1 `AuthSessionContext.tsx`
- Provides authenticated session data, current business role, account status, and employee profile.
- **In-Memory Request Deduplication**: If multiple components call `fetchAuthSession()` simultaneously during page load, it merges them into a single in-flight promise.
- **Heartbeat Session Validation**: Periodically checks the session every 60 seconds; if the backend flags the account as `SUSPENDED`, it signs out and redirects to `/login`.

### 5.2 `AppDataCacheContext.tsx`
- A lightweight in-memory cache for primary datasets (`departments`, `inventory`, `notifications`).
- Provides `prefetch(key, fetcher)` and `invalidate(prefix)`.
- **Background Pre-Warming**: In `Sidebar.tsx`, after mount, it uses `requestIdleCallback` (or `setTimeout`) to pre-warm the primary dataset for the user's specific role while the CPU is idle.

### 5.3 `usePermissions.ts`
- Custom hook providing:
  ```typescript
  const { role, can, isAdmin, isTechnician, isDepartmentManager, isEmployee, isStoreKeeper } = usePermissions();
  ```
- Simplifies conditional rendering of buttons and tabs:
  ```tsx
  {can(PERMISSIONS.ASSETS_CREATE) && (
    <Button onClick={() => openModal()}>Register Asset</Button>
  )}
  ```

---

## 6. Functional Behaviors Worth Preserving in the New React App

1. **Root Boot Animation**: Clean, branded splash screen that verifies the session concurrently before routing to `/login` or `/dashboard`.
2. **Instant Sidebar Role Filtering**: Nav items never flash unauthorized routes; role checking happens immediately on session availability.
3. **Optimistic Badge Updates**: Notification bell badge decrements immediately upon opening or marking read.
4. **Modal Form Feedback**: Handover and Return modals show selected asset details and current holder before confirmation.
5. **Role-Tailored Dashboards**: The `/dashboard` route renders different KPI cards and quick actions based on whether the logged-in user is an Admin, Store Keeper, Manager, or Employee.
