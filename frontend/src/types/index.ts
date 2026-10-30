// Ethiopian Engineering Corporation - Resource Management System (RMS)
// Core Domain Types & Enumerations

export type UserRole = 
  | 'ADMIN'
  | 'STORE_KEEPER'
  | 'IT_TECHNICIAN'
  | 'DEPARTMENT_MANAGER'
  | 'EMPLOYEE';

export type ResourceCategory =
  | 'IT_EQUIPMENT'
  | 'VEHICLES'
  | 'HEAVY_MACHINERY'
  | 'SURVEYING_GEOTECHNICAL'
  | 'CAMP_FACILITY_FURNITURE';

export type ResourceStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'MAINTENANCE'
  | 'TESTING'
  | 'RETIRED'
  | 'DISPOSED';

export type ResourceCondition =
  | 'EXCELLENT'
  | 'GOOD'
  | 'FAIR'
  | 'NEEDS_REPAIR'
  | 'DAMAGED'
  | 'RETIRED';

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  managerName?: string;
  location: string;
  employeeCount: number;
  assetCount: number;
  budgetCode?: string;
  createdAt: string;
}

export interface Employee {
  id: string;
  employeeId: string; // e.g. EEC-EMP-1042
  name: string;
  email: string;
  phone: string;
  departmentId: string;
  departmentName?: string;
  designation: string;
  role: UserRole;
  isActive: boolean;
  avatarUrl?: string;
  hireDate: string;
}

export interface UserApproval {
  id: string;
  name: string;
  email: string;
  departmentId: string;
  departmentName: string;
  designation: string;
  requestedRole: UserRole;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

// Category-specific extension specifications
export interface ITSpecs {
  serialNumber: string;
  brand: string;
  model: string;
  processor?: string;
  ramGb?: number;
  storageGb?: number;
  os?: string;
  macAddress?: string;
  ipAddress?: string;
  warrantyExpiry?: string;
}

export interface VehicleSpecs {
  plateNumber: string; // e.g. 3-45892 ET
  chassisNumber: string;
  engineNumber: string;
  make: string;
  model: string;
  year: number;
  fuelType: 'DIESEL' | 'PETROL' | 'HYBRID' | 'ELECTRIC';
  currentMileageKm: number;
  lastServiceKm: number;
  insuranceExpiry: string;
  boloInspectionExpiry: string; // Ethiopian annual roadworthiness inspection
}

export interface HeavyMachinerySpecs {
  engineNumber: string;
  serialNumber: string;
  make: string;
  model: string;
  year: number;
  operatingHours: number;
  fuelType: 'DIESEL';
  hydraulicInspectionDate?: string;
  siteLocation: string; // e.g. Kobra Multi-purpose Dam Project
}

export interface SurveyingSpecs {
  serialNumber: string;
  make: string;
  model: string;
  accuracyGrade: string;
  calibrationDate: string;
  nextCalibrationDue: string;
  calibrationCertificateNumber: string;
  laserClass?: string;
}

export interface Resource {
  id: string;
  itemCode: string; // e.g. EEC-IT-2024-0012
  name: string;
  category: ResourceCategory;
  subcategory: string;
  status: ResourceStatus;
  condition: ResourceCondition;
  location: string;
  currentDepartmentId?: string;
  departmentId?: string;
  currentDepartmentName?: string;
  currentAssigneeId?: string;
  currentAssigneeName?: string;
  assignedAt?: string;
  purchaseDate: string;
  purchaseCostETB: number;
  currentValueETB: number;
  supplier?: string;
  qrCodeUrl?: string;
  notes?: string;
  // Polymorphic specs
  itSpecs?: ITSpecs;
  vehicleSpecs?: VehicleSpecs;
  machinerySpecs?: HeavyMachinerySpecs;
  surveyingSpecs?: SurveyingSpecs;
  historicalContext?: HistoricalAssignmentContext;
  createdAt: string;
  updatedAt: string;
}

export interface HistoricalAssignmentContext {
  isHistoricalAccess: boolean;
  assignmentNumber?: string;
  historicalAssigneeId?: string;
  historicalAssigneeName?: string;
  assignmentDepartmentId?: string;
  assignmentDepartmentName?: string;
  assignedAt?: string;
  returnedAt?: string;
  expectedReturnDate?: string;
  purpose?: string;
  conclusionStatus?: string;
  conditionOnAssignment?: ResourceCondition;
  conditionOnReturn?: ResourceCondition;
  returnLocation?: string;
  returnNotes?: string;
  returnReceivedByName?: string;
  isCurrentCustodian: boolean;
}

export interface AssetAssignment {
  id: string;
  assignmentNumber?: string;
  resourceId: string;
  resourceName: string;
  resourceCode: string;
  resourceCategory?: ResourceCategory;
  employeeId: string;
  employeeName: string;
  employeeDesignation?: string;
  departmentId: string;
  departmentName: string;
  departmentCode?: string;
  assignedBy: string;
  assignedById?: string;
  assignedAt: string;
  returnedAt?: string;
  expectedReturnDate?: string;
  purpose: string;
  notes?: string;
  conditionOnAssignment: ResourceCondition;
  conditionOnReturn?: ResourceCondition;
  returnLocation?: string;
  returnNotes?: string;
  returnReceivedByName?: string;
  isCurrent: boolean;
  status: 'ACTIVE' | 'RETURNED' | 'TRANSFERRED' | 'OVERDUE';
}

export interface CustodyTransfer {
  id: string;
  transferNumber: string;
  resourceId: string;
  resourceName: string;
  resourceCode: string;
  fromAssignmentId?: string;
  toAssignmentId?: string;
  fromEmployeeId: string;
  fromEmployeeName: string;
  toEmployeeId: string;
  toEmployeeName: string;
  fromDepartmentId: string;
  fromDepartmentName: string;
  toDepartmentId: string;
  toDepartmentName: string;
  transferredByName: string;
  reason?: string;
  notes?: string;
  transferredAt: string;
  createdAt: string;
}

export type RequisitionStatus = 
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'FULFILLED'
  | 'CANCELLED';

export interface ResourceRequisition {
  id: string;
  requisitionNumber: string; // e.g. REQ-2026-0042
  requesterId: string;
  requesterName: string;
  requesterRole: UserRole;
  employeeId?: string;
  employeeName?: string;
  departmentId: string;
  departmentName: string;
  category: ResourceCategory;
  itemDescription: string;
  justification: string;
  urgency: 'ROUTINE' | 'URGENT' | 'EMERGENCY_PROJECT';
  status: RequisitionStatus;
  requiredDate: string;
  isDirectAllocation?: boolean;
  approvedBy?: string;
  approvedAt?: string;
  approvalComments?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  fulfilledResourceId?: string;
  fulfilledResourceName?: string;
  fulfilledResourceCode?: string;
  fulfilledAt?: string;
  fulfilledBy?: string;
  handoverNotes?: string;
  createdAt: string;
}

export type ReturnType = 'SCHEDULED' | 'WALK_IN';
export type ReturnStatus = 'PENDING' | 'RECEIVED' | 'CANCELLED';

export interface AssetReturnRecord {
  id: string;
  returnNumber: string; // e.g. RET-2026-0018
  type: ReturnType;
  resourceId: string;
  resourceName: string;
  resourceCode: string;
  assignmentId: string;
  employeeId: string;
  employeeName: string;
  departmentName: string;
  status: ReturnStatus;
  reason: string;
  conditionOnReturn?: ResourceCondition;
  returnLocation?: string;
  receivedBy?: string;
  receivedAt?: string;
  handoverNotes?: string;
  createdAt: string;
}

export type MaintenanceStatus = 
  | 'SUBMITTED' 
  | 'APPROVED' 
  | 'IN_PROGRESS' 
  | 'ON_HOLD' 
  | 'COMPLETED' 
  | 'REJECTED'
  | 'OPEN'
  | 'TESTING'
  | 'CANCELLED';

export interface MaintenanceLogEntry {
  id: string;
  fromStatus?: string;
  toStatus: string;
  action: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  notes?: string;
  createdAt: string;
}

export interface MaintenanceTicket {
  id: string;
  requestNumber?: string;
  ticketNumber?: string;
  resourceId: string;
  resourceName: string;
  resourceCode: string;
  category?: ResourceCategory;
  resourceCategory?: ResourceCategory;
  resourceStatus?: ResourceStatus;
  resourceCondition?: ResourceCondition;
  departmentId?: string;
  departmentName?: string;
  departmentCode?: string;
  reportedById?: string;
  reportedByName?: string;
  reportedByRole?: string;
  reportedBy?: string;
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  assignedTechnician?: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: MaintenanceStatus;
  reportedDate?: string;
  reviewedById?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewComments?: string;
  rejectionReason?: string;
  startedAt?: string;
  startDate?: string;
  completedAt?: string;
  diagnosis?: string;
  repairActions?: string;
  partsReplaced?: string;
  estimatedCostETB?: number;
  actualCostETB?: number;
  resolutionNotes?: string;
  outcome?: string;
  custodyAction?: string;
  custodianIdAtRequest?: string;
  custodianNameAtRequest?: string;
  currentAssigneeId?: string;
  currentAssigneeName?: string;
  serviceProvider?: string;
  findings?: string;
  logs?: MaintenanceLogEntry[];
  inspections?: InspectionTest[];
  createdAt: string;
  updatedAt?: string;
}

export interface InspectionTest {
  id: string;
  ticketId?: string; // Links to Maintenance ticket if QA test
  resourceId: string;
  resourceName: string;
  resourceCode: string;
  inspectionType: 'CALIBRATION' | 'ROADWORTHINESS_BOLO' | 'HYDRAULIC' | 'SAFETY_AUDIT' | 'MAINTENANCE_QA';
  passed: boolean;
  findings: string;
  conductedBy: string;
  certificationNumber?: string;
  expiryDate?: string;
  remarks: string;
  date: string;
  inspectedAt?: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS';
  isRead: boolean;
  createdAt: string;
  link?: string;
}

export interface DashboardMetrics {
  scope?: 'CORPORATION' | 'DEPARTMENT';
  departmentId?: string | null;
  departmentName?: string | null;
  departmentCode?: string | null;
  totalAssets: number;
  availableAssets: number;
  assignedAssets: number;
  maintenanceAssets: number;
  testingAssets: number;
  retiredAssets?: number;
  totalValueETB: number;
  utilizationRate?: number;
  categoryCounts: Record<string, number>;
  categoryValues?: Record<string, number>;
  categoryPercentages?: Record<string, number>;
  statusCounts: Record<string, number>;
  recentAlerts: NotificationItem[];
}

export interface ReportFilterParams {
  startDate?: string;
  endDate?: string;
  departmentId?: string;
  category?: string;
  status?: string;
  maintenanceStatus?: string;
}

export interface CategoryDistributionItem {
  category: string;
  count: number;
  totalValueETB: number;
  available: number;
  assigned: number;
  maintenance: number;
}

export interface DepartmentDistributionItem {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  count: number;
  totalValueETB: number;
}

export interface CustodyDeptItem {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  count: number;
}

export interface CustodyEmployeeItem {
  employeeId: string;
  employeeName: string;
  departmentName: string;
  count: number;
}

export interface MaintenanceCostCategoryItem {
  category: string;
  count: number;
  actualCostETB: number;
}

export interface RecentActivityItem {
  type: 'ASSIGNMENT' | 'TRANSFER' | 'MAINTENANCE';
  id: string;
  referenceCode: string;
  title: string;
  resourceId: string;
  resourceName: string;
  resourceCode: string;
  actorName: string;
  departmentName: string;
  timestamp: string;
  status: string;
}

export interface ReportOverviewData {
  metadata: {
    scope: 'CORPORATION' | 'DEPARTMENT' | 'EMPLOYEE' | 'STORE' | 'TECHNICAL';
    scopeLabel: string;
    departmentId?: string;
    departmentName?: string;
    departmentCode?: string;
    generatedAt: string;
    filtersApplied: {
      startDate: string | null;
      endDate: string | null;
      departmentId: string;
      category: string;
      status: string;
      maintenanceStatus: string;
    };
  };
  overview: {
    totalResources: number;
    available: number;
    assigned: number;
    underMaintenance: number;
    retired: number;
    disposed: number;
    totalPurchaseCostETB: number;
    totalCurrentValueETB: number;
  };
  distribution: {
    byCategory: CategoryDistributionItem[];
    byDepartment: DepartmentDistributionItem[];
  };
  custody: {
    totalActiveAssignments: number;
    totalUnassigned: number;
    byDepartment: CustodyDeptItem[];
    byEmployee: CustodyEmployeeItem[];
  };
  maintenance: {
    byStatus: {
      SUBMITTED: number;
      APPROVED: number;
      IN_PROGRESS: number;
      ON_HOLD: number;
      COMPLETED: number;
      REJECTED: number;
      total: number;
    };
    totalEstimatedCostETB: number;
    totalActualCostETB: number;
    byCategory: MaintenanceCostCategoryItem[];
  };
  recentActivities: RecentActivityItem[];
}
