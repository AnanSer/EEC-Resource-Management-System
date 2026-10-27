# 04. Data Model and API Specification

## 1. Relational Database Schema (Prisma ORM)

The data architecture is implemented using PostgreSQL via Prisma ORM (`backend/prisma/schema.prisma`). It consists of **11 core business models** and **4 isolated Better Auth tables**.

### 1.1 Complete Enums Reference

```prisma
enum UserRole {
  ADMIN
  IT_TECHNICIAN
  DEPARTMENT_MANAGER
  EMPLOYEE
  STORE_KEEPER
}

enum AccountStatus {
  PENDING
  APPROVED
  REJECTED
  SUSPENDED
}

enum AssetCategory {
  LAPTOP
  DESKTOP
  PRINTER
  SCANNER
  ROUTER
  SWITCH
  PROJECTOR
  MONITOR
  SERVER
  UPS
  OTHER
}

enum AssetStatus {
  AVAILABLE
  ASSIGNED
  MAINTENANCE
  TESTING
  RETIRED
  DISPOSED
}

enum AssetCondition {
  EXCELLENT
  GOOD
  FAIR
  NEEDS_REPAIR
  DAMAGED
  RETIRED
}

enum MaintenanceStatus {
  OPEN
  IN_PROGRESS
  TESTING
  ON_HOLD
  COMPLETED
  CANCELLED
}

enum MaintenancePriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum InspectionStatus {
  PENDING
  PASSED
  FAILED
  NEEDS_REPAIR
}

enum RequestStatus {
  PENDING
  APPROVED
  REJECTED
  FULFILLED
  CANCELLED
}

enum ReturnRequestStatus {
  PENDING
  RECEIVED
  CANCELLED
}

enum NotificationType {
  INFO
  SUCCESS
  WARNING
  ERROR
  MAINTENANCE
  TESTING
  ACCOUNT
  WARRANTY
}
```

---

### 1.2 Core Business Models & Constraints

#### 1. `Department`
- **Purpose**: Represents corporate divisions, engineering sectors, directorates, and branches.
- **Fields**:
  - `id`: `String` (UUID, Primary Key)
  - `name`: `String` (e.g. "Transport Infrastructure Services")
  - `code`: `String` (**Unique**, e.g. "EEC-TIS")
  - `description`: `String?`
  - `location`: `String?` (Campus/Building location)
  - `officeLocation`: `String?` (Room/Suite)
  - `building`: `String?`
  - `floor`: `String?`
  - `headOfDepartment`: `String?`
  - `isActive`: `Boolean` (Default: `true`)
  - `createdAt`: `DateTime` (Default: `now()`)
  - `updatedAt`: `DateTime` (Auto-updated)
- **Relations**: Has many `employees`, `assets`, `assetRequests`, `returnRequests`.

#### 2. `User`
- **Purpose**: Business identity, role assignment, and account status tracking.
- **Fields**:
  - `id`: `String` (UUID, Primary Key)
  - `email`: `String` (**Unique**)
  - `passwordHash`: `String` (Contains placeholder `BETTER_AUTH_MANAGED` when handled by Better Auth)
  - `role`: `UserRole` (Default: `EMPLOYEE`)
  - `status`: `AccountStatus` (Default: `PENDING`)
  - `isEmailVerified`: `Boolean` (Default: `false`)
  - `lastLoginAt`: `DateTime?`
- **Relations**: 1-to-1 with `EmployeeProfile`, 1-to-many with `Notification`, `AuditLog`, and relations to `AssetRequest` (`approvedRequests`, `rejectedRequests`, `fulfilledRequests`) and `AssetReturnRequest` (`receivedReturns`).

#### 3. `EmployeeProfile`
- **Purpose**: Personnel records and custodial binding for assets and requests.
- **Fields**:
  - `id`: `String` (UUID, Primary Key)
  - `userId`: `String` (**Unique**, FK to `User.id`, `onDelete: Cascade`)
  - `employeeId`: `String` (**Unique**, e.g. "EEC-EMP-0104")
  - `firstName`: `String`
  - `lastName`: `String`
  - `phone`: `String?`
  - `jobTitle`: `String`
  - `departmentId`: `String` (FK to `Department.id`)
  - `officeLocation`: `String?`
  - `isActive`: `Boolean` (Default: `true`)
- **Relations**: Belongs to `User` and `Department`. Has many `assetAssignments`, `assetRequests`, `returnRequests`.

#### 4. `Asset`
- **Purpose**: Core asset tracking record and physical custody attributes.
- **Fields**:
  - `id`: `String` (UUID, Primary Key)
  - `assetCode`: `String` (**Unique**, e.g. "EEC-LAP-0012")
  - `name`: `String`
  - `category`: `AssetCategory`
  - `brand`: `String?`
  - `model`: `String?`
  - `serialNumber`: `String` (**Unique**)
  - `status`: `AssetStatus` (Default: `AVAILABLE`)
  - `condition`: `AssetCondition` (Default: `GOOD`)
  - `departmentId`: `String?` (FK to `Department.id`)
  - `location`: `String?` (Warehouse shelf or room location)
  - `purchaseDate`: `DateTime?`
  - `purchasePrice`: `Decimal(12, 2)?`
  - `warrantyExpiry`: `DateTime?`
  - `notes`: `String?`
- **Relations**: Belongs to `Department`. Has many `assignments`, `maintenanceTickets`, `assetRequests`, `returnRequests`.

#### 5. `AssetAssignment`
- **Purpose**: Historical and active assignment records binding an asset to a staff member.
- **Fields**:
  - `id`: `String` (UUID, Primary Key)
  - `assetId`: `String` (FK to `Asset.id`, `onDelete: Cascade`)
  - `employeeId`: `String` (FK to `EmployeeProfile.id`)
  - `assignedDate`: `DateTime` (Default: `now()`)
  - `returnedDate`: `DateTime?`
  - `conditionOnAssign`: `String?`
  - `conditionOnReturn`: `String?`
  - `isCurrent`: `Boolean` (Default: `true`, indexed for high-performance active custody lookup)
  - `notes`: `String?`

#### 6. `AssetRequest` (`asset_requests`)
- **Purpose**: Requisition ticket lifecycle tracking from submission to physical handover.
- **Fields**:
  - `id`: `String` (UUID, Primary Key)
  - `requestNumber`: `String` (**Unique**, e.g. "REQ-20261027-0001")
  - `requesterId`: `String` (FK to `EmployeeProfile.id`)
  - `departmentId`: `String` (FK to `Department.id`)
  - `category`: `AssetCategory`
  - `description`: `String`
  - `notes`: `String?`
  - `status`: `RequestStatus` (Default: `PENDING`)
  - `approvedById`: `String?` (FK to `User.id`)
  - `approvedAt`: `DateTime?`
  - `approvalRemarks`: `String?`
  - `rejectedById`: `String?` (FK to `User.id`)
  - `rejectedAt`: `DateTime?`
  - `rejectionReason`: `String?`
  - `fulfilledById`: `String?` (FK to `User.id`)
  - `fulfilledAt`: `DateTime?`
  - `assetId`: `String?` (FK to allocated `Asset.id`)
  - `handoverNotes`: `String?`

#### 7. `AssetReturnRequest` (`asset_return_requests`)
- **Purpose**: Scheduled asset surrender workflow and warehouse check-in logging.
- **Fields**:
  - `id`: `String` (UUID, Primary Key)
  - `requestNumber`: `String` (**Unique**, e.g. "RET-20261027-0001")
  - `requesterId`: `String` (FK to `EmployeeProfile.id`)
  - `assetId`: `String` (FK to `Asset.id`)
  - `departmentId`: `String` (FK to `Department.id`)
  - `status`: `ReturnRequestStatus` (Default: `PENDING`)
  - `reason`: `String`
  - `requestedAt`: `DateTime` (Default: `now()`)
  - `receivedById`: `String?` (FK to `User.id`)
  - `receivedAt`: `DateTime?`
  - `conditionOnReturn`: `String?`
  - `returnLocation`: `String?`
  - `notes`: `String?`

#### 8. `MaintenanceTicket`
- **Purpose**: Hardware repair tickets, technical diagnostic notes, and cost ledger.
- **Fields**:
  - `id`: `String` (UUID, Primary Key)
  - `ticketNumber`: `String` (**Unique**, e.g. "TKT-20261027-0001")
  - `assetId`: `String` (FK to `Asset.id`)
  - `title`: `String`
  - `description`: `String`
  - `priority`: `MaintenancePriority` (Default: `MEDIUM`)
  - `status`: `MaintenanceStatus` (Default: `OPEN`)
  - `cost`: `Decimal(10, 2)?`
  - `startDate`: `DateTime?`
  - `completedDate`: `DateTime?`
  - `reportedBy`: `String?`
  - `assignedTechnician`: `String?`
  - `resolutionNotes`: `String?`

#### 9. `InspectionTest`
- **Purpose**: Quality assurance verification checklist for maintenance tickets.
- **Fields**:
  - `id`: `String` (UUID, Primary Key)
  - `ticketId`: `String` (FK to `MaintenanceTicket.id`, `onDelete: Cascade`)
  - `testType`: `String`
  - `status`: `InspectionStatus` (Default: `PENDING`)
  - `testedBy`: `String`
  - `testDate`: `DateTime` (Default: `now()`)
  - `findings`: `String?`
  - `recommendations`: `String?`
  - `passed`: `Boolean` (Default: `false`)

#### 10. `Notification`
- **Purpose**: Persistent in-app user notifications.
- **Fields**:
  - `id`: `String` (UUID, Primary Key)
  - `userId`: `String` (FK to `User.id`, `onDelete: Cascade`)
  - `title`: `String`
  - `message`: `String`
  - `type`: `NotificationType`
  - `link`: `String?` (Target dashboard route)
  - `isRead`: `Boolean` (Default: `false`)

#### 11. `SystemSettings`
- **Purpose**: Single-row configuration storing enterprise branding and regional settings.
- **Fields**:
  - `organizationName`: `String` ("Ethiopian Engineering Corporation")
  - `organizationShortName`: `String` ("EEC")
  - `supportEmail`: `String`
  - `supportPhone`: `String`
  - `headquartersAddress`: `String`
  - `logoUrl`: `String?`
  - `defaultLanguage`: `String` (Default: "EN")
  - `timezone`: `String` (Default: "Africa/Addis_Ababa")
  - `dateFormat`: `String` (Default: "DD/MM/YYYY")

---

## 2. Main REST Endpoints & API Specification

### 2.1 Identity & Authentication (`/api/identity` & `/api/auth`)

| Method | Endpoint | Access / Roles | Request Payload / Query | Response Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/identity/departments` | Public | None | Active departments for registration dropdown |
| `POST` | `/api/identity/register` | Public | `{ email, password, fullName, employeeId, departmentId, position, phone, requestedRole? }` | Registers Better Auth credentials; creates `User` (status: `PENDING`) and `EmployeeProfile` |
| `GET` | `/api/identity/pending` | `ADMIN` | `?page=1&limit=10&search=&departmentId=` | Paginated pending user requests |
| `PATCH` | `/api/identity/:id/approve` | `ADMIN` | `{ role?: UserRole }` | Approves user (`status = APPROVED`), sends welcome email, auto-syncs email verification |
| `PATCH` | `/api/identity/:id/reject` | `ADMIN` | `{ reason: string }` | Rejects user (`status = REJECTED`), records reason |
| `PATCH` | `/api/identity/:id/suspend` | `ADMIN` | None | Suspends user (`status = SUSPENDED`) |
| `GET` | `/api/auth/me` | Authenticated | None | Returns session data, business user, profile, department, and role |
| `ALL` | `/api/auth/*splat` | Public / Auth | Form/JSON body stream | Better Auth internal handler (sign-in, sign-out, session) |

---

### 2.2 Asset Requests Module (`/api/requests`)

| Method | Endpoint | Access / Roles | Request Payload / Query | Response Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/requests` | All Authenticated (Scoped by role) | `?status=&category=&departmentId=&search=&page=1&limit=10` | Role-scoped requests list. Staff see own; Managers see department; Store Keepers see approved/fulfilled; Admins see all |
| `POST` | `/api/requests` | Staff, Managers, Techs, Admin | `{ category, description, notes? }` | Submits requisition; assigns `REQ-YYYYMMDD-XXXX`; notifies Admins |
| `GET` | `/api/requests/:id` | Scoped by role | None | Single request details with requester profile, approvals, and allocated asset |
| `POST` | `/api/requests/:id/approve` | `ADMIN` | `{ approvalRemarks?: string }` | Approves request (`status: APPROVED`). Notifies requester and Store Keepers. Does NOT modify asset inventory |
| `POST` | `/api/requests/:id/reject` | `ADMIN` | `{ rejectionReason: string }` | Rejects request (`status: REJECTED`). Notifies requester |
| `POST` | `/api/requests/:id/fulfill` | `STORE_KEEPER`, `ADMIN` | `{ assetId: string, conditionOnAssign?: string, handoverNotes?: string }` | Atomic physical handover: validates asset is available and category matches, creates assignment, marks request fulfilled |
| `POST` | `/api/requests/:id/cancel` | Requester or `ADMIN` | None | Cancels request (allowed only if `PENDING`) |

---

### 2.3 Asset Returns Module (`/api/returns`)

| Method | Endpoint | Access / Roles | Request Payload / Query | Response Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/returns` | All Authenticated (Scoped by role) | `?status=&departmentId=&search=&page=1&limit=10` | Paginated return requests list |
| `POST` | `/api/returns` | Staff, Managers, Techs, Admin | `{ assetId: string, reason: string, notes?: string }` | Submits return request for an assigned asset (`status: PENDING`). Notifies Store Keepers |
| `POST` | `/api/returns/walk-in` | `STORE_KEEPER`, `ADMIN` | `{ assetId: string, conditionOnReturn: string, returnLocation: string, notes?: string }` | Immediate walk-in receiving without prior request. Closes assignment, sets asset to `AVAILABLE`, creates `RECEIVED` log |
| `GET` | `/api/returns/:id` | Scoped by role | None | Single return request details |
| `POST` | `/api/returns/:id/receive` | `STORE_KEEPER`, `ADMIN` | `{ conditionOnReturn?: string, returnLocation: string, notes?: string }` | Receives scheduled return: closes assignment, sets asset `AVAILABLE`, marks return `RECEIVED` |
| `POST` | `/api/returns/:id/cancel` | Requester or `ADMIN` | None | Cancels pending return request |

---

### 2.4 Store Operations & Inventory Module (`/api/store` & `/api/assets`)

| Method | Endpoint | Access / Roles | Request Payload / Query | Response Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/store/dashboard` | `STORE_KEEPER`, `ADMIN` | None | Store Keeper operations dashboard KPIs (available, assigned, maintenance, pending handovers, pending returns) |
| `GET` | `/api/assets/inventory` | `ADMIN`, `IT_TECHNICIAN`, `DEPARTMENT_MANAGER`, `STORE_KEEPER` | `?departmentId=` | Dynamic inventory counts, category breakdown, and location breakdown |
| `GET` | `/api/store/assets/:assetId/movement-history` | Authenticated | None | Chronological timeline of asset lifecycle events |
| `PATCH` | `/api/assets/:id/location` | `STORE_KEEPER`, `IT_TECHNICIAN`, `ADMIN` | `{ location: string }` | Updates physical storage location without touching status or assignments |
| `GET` | `/api/assets` | Scoped by role | `?category=&status=&condition=&search=&page=1&limit=10` | Asset catalog |
| `POST` | `/api/assets` | `ADMIN`, `IT_TECHNICIAN` | `{ assetCode, name, category, brand, model, serialNumber, condition, departmentId?, location?, purchaseDate?, purchasePrice?, warrantyExpiry?, notes? }` | Registers new asset |
| `PUT` | `/api/assets/:id` | `ADMIN`, `IT_TECHNICIAN` | Asset fields | Updates asset metadata |
| `PATCH` | `/api/assets/:id/status` | `ADMIN`, `IT_TECHNICIAN` | `{ status: AssetStatus, condition?: AssetCondition }` | Administrative status change |

---

### 2.5 Maintenance & QA Testing Modules (`/api/maintenance` & `/api/testing`)

| Method | Endpoint | Access / Roles | Request Payload / Query | Response Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/maintenance/stats` | `ADMIN`, `IT_TECHNICIAN`, `DEPARTMENT_MANAGER` | None | Maintenance dashboard statistics (open, in progress, testing, completed) |
| `GET` | `/api/maintenance` | Scoped by role | `?status=&priority=&category=&technician=&search=&page=1&limit=10` | Paginated tickets list |
| `POST` | `/api/maintenance` | All Authenticated | `{ assetId, title, description, priority?, assignedTechnician?, cost? }` | Opens ticket, sets asset status to `MAINTENANCE` |
| `GET` | `/api/maintenance/:id` | Scoped by role | None | Single ticket with attached inspection tests and current asset holder |
| `PUT` | `/api/maintenance/:id` | `ADMIN`, `IT_TECHNICIAN` | Ticket update DTO | Updates technician, cost, dates, notes |
| `PATCH` | `/api/maintenance/:id/status` | `ADMIN`, `IT_TECHNICIAN` | `{ status: MaintenanceStatus, resolutionNotes?: string }` | Status update. If `COMPLETED`, strictly requires passing QA test |
| `GET` | `/api/testing/:ticketId` | `ADMIN`, `IT_TECHNICIAN` | None | Inspection tests for a specific ticket |
| `POST` | `/api/testing` | `ADMIN`, `IT_TECHNICIAN` | `{ ticketId, testType, status, findings?, recommendations?, passed: boolean }` | Records inspection test |
| `PUT` | `/api/testing/:id` | `ADMIN`, `IT_TECHNICIAN` | Inspection test DTO | Modifies inspection test result |

---

## 3. Strict Backend Business Rules & Invariants

The following rules **must reside strictly on the backend** and never be entrusted solely to frontend UI checks:

1. **Atomic Concurrency during Handover (`fulfillRequest`)**:
   - Must run inside a Prisma interactive transaction (`prisma.$transaction`).
   - Must re-query the asset within the transaction to verify `status === 'AVAILABLE'`.
   - Must prevent double-allocation if two store keepers attempt to hand over the same physical device at the same time.

2. **Atomic Custody Handover (`receiveReturn`)**:
   - Must mark the existing assignment `isCurrent = false` and set `returnedDate = now()`.
   - Must update `Asset.status = 'AVAILABLE'` and `Asset.location = returnLocation` in the same transaction.

3. **Maintenance Completion Prerequisite (`updateStatus`)**:
   - Must inspect `ticket.inspectionTests`. If the latest test has `passed !== true`, the backend must reject the completion with `422 Unprocessable Entity`.

4. **Dynamic Inventory Single Source of Truth**:
   - The backend must never store static counter columns like `availableCount` in a department or category table.
   - All inventory totals must be derived via database aggregation (`prisma.asset.count` / `groupBy`) to eliminate synchronization drift.

5. **Department Boundary Enforcement (`requireDepartmentAccess`)**:
   - Department Managers and Employees must be prevented from querying or mutating resources outside their assigned `departmentId`.
   - The backend checks `user.employeeProfile.departmentId` directly against the database record, not from client-supplied claims.
