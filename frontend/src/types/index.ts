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
  boloInspectionExpiry: string; // Ethiopian annual roadworthiness
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
  createdAt: string;
  updatedAt: string;
}

export interface AssetAssignment {
  id: string;
  resourceId: string;
  resourceName: string;
  resourceCode: string;
  employeeId: string;
  employeeName: string;
  departmentName: string;
  assignedBy: string;
  assignedAt: string;
  returnedAt?: string;
  expectedReturnDate?: string;
  purpose: string;
  conditionOnAssignment: ResourceCondition;
  conditionOnReturn?: ResourceCondition;
  status: 'ACTIVE' | 'RETURNED' | 'OVERDUE';
}

export interface MaintenanceTicket {
  id: string;
  ticketNumber: string;
  resourceId: string;
  resourceName: string;
  resourceCode: string;
  category: ResourceCategory;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_PARTS' | 'COMPLETED' | 'CANCELLED';
  reportedBy: string;
  assignedTechnician?: string;
  estimatedCostETB?: number;
  actualCostETB?: number;
  createdAt: string;
  completedAt?: string;
  serviceProvider?: string;
}

export interface InspectionTest {
  id: string;
  resourceId: string;
  resourceName: string;
  resourceCode: string;
  inspectionType: 'CALIBRATION' | 'ROADWORTHINESS_BOLO' | 'HYDRAUKIC' | 'SAFETY_AUDIT';
  passed: boolean;
  conductedBy: string;
  certificationNumber?: string;
  expiryDate: string;
  remarks: string;
  date: string;
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
  totalAssets: number;
  availableAssets: number;
  assignedAssets: number;
  maintenanceAssets: number;
  testingAssets: number;
  totalValueETB: number;
  categoryCounts: Record<ResourceCategory, number>;
  statusCounts: Record<ResourceStatus, number>;
  recentAlerts: NotificationItem[];
}
