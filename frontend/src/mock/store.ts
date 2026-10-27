import { 
  Department, 
  Employee, 
  Resource, 
  NotificationItem, 
  AssetAssignment, 
  ResourceRequisition, 
  AssetReturnRecord, 
  MaintenanceTicket, 
  InspectionTest, 
  UserApproval 
} from '../types';
import { MOCK_DEPARTMENTS } from './departments.mock';
import { MOCK_EMPLOYEES } from './employees.mock';
import { MOCK_RESOURCES } from './resources.mock';

class MockDataStore {
  private departments: Department[] = [...MOCK_DEPARTMENTS];
  private employees: Employee[] = [...MOCK_EMPLOYEES];
  private resources: Resource[] = [...MOCK_RESOURCES];

  // 1. Asset Assignments
  private assignments: AssetAssignment[] = [
    {
      id: 'asgn-001',
      resourceId: 'res-surv-001',
      resourceName: 'Leica TS20 Robotic Total Station (0.5 arc-second)',
      resourceCode: 'EEC-SURV-2023-004',
      employeeId: 'emp-006',
      employeeName: 'Selamawit Kedir',
      departmentId: 'dept-103',
      departmentName: 'Geotechnical & Surveying Engineering',
      assignedBy: 'Abebe Kassaye (Chief Store Keeper)',
      assignedAt: '2024-01-15T09:00:00Z',
      expectedReturnDate: '2026-12-31',
      purpose: 'Awash-Kombolcha railway geodetic alignment monitoring',
      conditionOnAssignment: 'EXCELLENT',
      isCurrent: true,
      status: 'ACTIVE'
    },
    {
      id: 'asgn-002',
      resourceId: 'res-veh-001',
      resourceName: 'Toyota Land Cruiser HZ 76 4x4 Station Wagon',
      resourceCode: 'EEC-VEHC-2022-081',
      employeeId: 'emp-005',
      employeeName: 'Teshome Wolde',
      departmentId: 'dept-101',
      departmentName: 'Transport & Infrastructure Design',
      assignedBy: 'Abebe Kassaye (Chief Store Keeper)',
      assignedAt: '2024-04-10T08:00:00Z',
      expectedReturnDate: '2027-01-01',
      purpose: 'Highlands highway feasibility field team transport',
      conditionOnAssignment: 'GOOD',
      isCurrent: true,
      status: 'ACTIVE'
    },
    {
      id: 'asgn-003',
      resourceId: 'res-mach-001',
      resourceName: 'Caterpillar 336D Large Hydraulic Excavator',
      resourceCode: 'EEC-MACH-2021-009',
      employeeId: 'emp-008',
      employeeName: 'Hasmel Hailu',
      departmentId: 'dept-102',
      departmentName: 'Water Resources & Irrigation',
      assignedBy: 'Abebe Kassaye (Chief Store Keeper)',
      assignedAt: '2023-11-01T07:00:00Z',
      expectedReturnDate: '2026-11-01',
      purpose: 'Canal excavation and embankment preparation in Kebri Dehar',
      conditionOnAssignment: 'GOOD',
      isCurrent: true,
      status: 'ACTIVE'
    }
  ];

  // 2. Requisitions
  private requisitions: ResourceRequisition[] = [
    {
      id: 'req-001',
      requisitionNumber: 'REQ-2026-0031',
      requesterId: 'emp-005',
      requesterName: 'Teshome Wolde',
      requesterRole: 'EMPLOYEE',
      departmentId: 'dept-101',
      departmentName: 'Transport & Infrastructure Design',
      category: 'IT_EQUIPMENT',
      itemDescription: 'High-end engineering workstation laptop for Civil 3D corridor modelling',
      justification: 'Current assigned field laptop lacks GPU power for 20km highway surface meshing',
      urgency: 'URGENT',
      status: 'PENDING',
      requiredDate: '2026-11-15',
      createdAt: '2026-10-24T10:15:00Z'
    },
    {
      id: 'req-002',
      requisitionNumber: 'REQ-2026-0028',
      requesterId: 'emp-004',
      requesterName: 'Eng. Wondwessen Mikeru',
      requesterRole: 'DEPARTMENT_MANAGER',
      departmentId: 'dept-101',
      departmentName: 'Transport & Infrastructure Design',
      category: 'VEHICLES',
      itemDescription: 'Heavy-duty 4x4 pickup for bridge inspection site visit in Oromia',
      justification: 'Quarterly bridge integrity inspection scheduled next week',
      urgency: 'ROUTINE',
      status: 'APPROVED',
      requiredDate: '2026-11-05',
      approvedBy: 'Alemu Mekete (Admin)',
      approvedAt: '2026-10-25T14:30:00Z',
      createdAt: '2026-10-23T09:00:00Z'
    },
    {
      id: 'req-003',
      requisitionNumber: 'REQ-2026-0019',
      requesterId: 'emp-006',
      requesterName: 'Selamawit Kedir',
      requesterRole: 'EMPLOYEE',
      departmentId: 'dept-103',
      departmentName: 'Geotechnical & Surveying Engineering',
      category: 'SURVEYING_GEOTECHNICAL',
      itemDescription: 'High-precision GNSS Rover set with RTK radio',
      justification: 'Additional survey crew joining railway alignment study',
      urgency: 'ROUTINE',
      status: 'FULFILLED',
      requiredDate: '2026-01-20',
      approvedBy: 'Alemu Mekete (Admin)',
      approvedAt: '2026-01-12T11:00:00Z',
      fulfilledResourceId: 'res-surv-001',
      fulfilledResourceName: 'Leica TS20 Robotic Total Station',
      fulfilledResourceCode: 'EEC-SURV-2023-004',
      fulfilledAt: '2024-01-15T09:00:00Z',
      fulfilledBy: 'Abebe Kassaye (Chief Store Keeper)',
      handoverNotes: 'Issued in protective flight case with dual battery pack and calibration certificate copy',
      createdAt: '2026-01-10T08:30:00Z'
    }
  ];

  // 3. Asset Returns
  private returns: AssetReturnRecord[] = [
    {
      id: 'ret-001',
      returnNumber: 'RET-2026-0009',
      type: 'SCHEDULED',
      resourceId: 'res-surv-002',
      resourceName: 'Trimble R12 GNSS Satellite Receiver with IMU',
      resourceCode: 'EEC-SURV-2022-092',
      assignmentId: 'asgn-old-088',
      employeeId: 'emp-006',
      employeeName: 'Selamawit Kedir',
      departmentName: 'Geotechnical & Surveying Engineering',
      status: 'RECEIVED',
      reason: 'Internal UHF radio board failed in field; returned for workshop servicing',
      conditionOnReturn: 'NEEDS_REPAIR',
      returnLocation: 'Kersa Central Warehouse | Repair Shop',
      receivedBy: 'Abebe Kassaye',
      receivedAt: '2026-10-20T08:00:00Z',
      handoverNotes: 'UHF module antenna connector loose; redirected to maintenance team ticket MT-2026-001',
      createdAt: '2026-10-19T14:20:00Z'
    }
  ];

  // 4. Maintenance Tickets
  private maintenanceTickets: MaintenanceTicket[] = [
    {
      id: 'ticket-001',
      ticketNumber: 'MT-2026-001',
      resourceId: 'res-surv-002',
      resourceName: 'Trimble R12 GNSS Satellite Receiver with IMU',
      resourceCode: 'EEC-SURV-2022-092',
      category: 'SURVEYING_GEOTECHNICAL',
      title: 'UHF Internal Radio Module Failure',
      description: 'Receiver drops radio link after 10 minutes of base station streaming. Diagnostics show internal transmitter heating.',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      reportedBy: 'Selamawit Kedir',
      assignedTechnician: 'Tigist Asfiwa',
      estimatedCostETB: 45000,
      actualCostETB: 38000,
      startDate: '2026-10-21T09:00:00Z',
      serviceProvider: 'GeoMaps Authorized Service Addis',
      findings: 'Original RF capacitor replaced. Ready for bench QA calibration test.',
      createdAt: '2026-10-20T10:00:00Z'
    },
    {
      id: 'ticket-002',
      ticketNumber: 'MT-2026-002',
      resourceId: 'res-veh-002',
      resourceName: 'Isuzu FYZ 35-Ton Compactor Truck',
      resourceCode: 'EEC-VEHC-2020-012',
      category: 'VEHICLES',
      title: 'Pneumatic Brake Actuator Calibration',
      description: 'Annual brake system pressure differential test required for commercial road safety clearance.',
      priority: 'MEDIUM',
      status: 'TESTING',
      reportedBy: 'Yeshiwas Tessema (CSM)',
      assignedTechnician: 'Ato Mulugeta (Depot Head)',
      estimatedCostETB: 12000,
      actualCostETB: 11500,
      startDate: '2026-10-23T08:30:00Z',
      serviceProvider: 'EEC Central Heavy Transport Workshop',
      findings: 'Dual air tank seals replaced. Currently undergoing 8.5 bar hold pressure test.',
      createdAt: '2026-10-22T08:00:00Z'
    }
  ];

  // 5. Inspection & Testing Records
  private inspections: InspectionTest[] = [
    {
      id: 'insp-001',
      resourceId: 'res-surv-001',
      resourceName: 'Leica TS20 Robotic Total Station',
      resourceCode: 'EEC-SURV-2023-004',
      inspectionType: 'CALIBRATION',
      passed: true,
      findings: 'Collimation error: 0.12 arc-sec (within 0.5 arc-sec tolerance). Distance EDM accuracy 1mm + 1.5ppm verified on baseline.',
      conductedBy: 'National Metrology Institute of Ethiopia (NMIE)',
      certificationNumber: 'EEC-CAL-2025-8891',
      expiryDate: '2026-12-01',
      remarks: 'Certified for high-speed rail alignment surveying',
      date: '2025-12-01',
      createdAt: '2025-12-01T10:00:00Z'
    },
    {
      id: 'insp-002',
      ticketId: 'ticket-002',
      resourceId: 'res-veh-002',
      resourceName: 'Isuzu FYZ 35-Ton Compactor Truck',
      resourceCode: 'EEC-VEHC-2020-012',
      inspectionType: 'ROADWORTHINESS_BOLO',
      passed: true,
      findings: 'Brake efficiency at 68% (standard >= 50%). Smoke opacity within legal limits. Lighting and steering play pass.',
      conductedBy: 'Federal Transport Authority Inspection Center #3',
      certificationNumber: 'BOLO-2026-ADDIS-89912',
      expiryDate: '2027-01-31',
      remarks: 'Roadworthiness Bolo passed without reservations',
      date: '2026-10-24',
      createdAt: '2026-10-24T14:00:00Z'
    }
  ];

  // 6. User Approvals
  private userApprovals: UserApproval[] = [
    {
      id: 'appr-001',
      name: 'Kassahun Bekele',
      email: 'kassahun.bekele@eec.gov.et',
      departmentId: 'dept-102',
      departmentName: 'Water Resources & Irrigation',
      designation: 'Hydraulic Structures Engineer',
      requestedRole: 'EMPLOYEE',
      status: 'PENDING',
      createdAt: '2026-10-26T09:30:00Z'
    },
    {
      id: 'appr-002',
      name: 'Martha Hailu',
      email: 'martha.hailu@eec.gov.et',
      departmentId: 'dept-108',
      departmentName: 'Procurement & Property Administration',
      designation: 'Assistant Property Officer',
      requestedRole: 'STORE_KEEPER',
      status: 'PENDING',
      createdAt: '2026-10-25T11:00:00Z'
    }
  ];

  // 7. Notifications
  private notifications: NotificationItem[] = [
    {
      id: 'notif-001',
      title: 'Vehicle Bolo Inspection Due',
      message: 'Toyota Land Cruiser (3-45892 ET) inspection expires in 34 days.',
      type: 'WARNING',
      isRead: false,
      createdAt: '2026-10-26T08:00:00Z'
    },
    {
      id: 'notif-002',
      title: 'Surveying Calibration Approved',
      message: 'Leica TS20 Robotic Total Station successfully certified by NQI.',
      type: 'SUCCESS',
      isRead: true,
      createdAt: '2026-10-20T09:30:00Z'
    },
    {
      id: 'notif-003',
      title: 'Maintenance Request Pending',
      message: 'Trimble R12 GNSS unit is waiting for replacement UHF module.',
      type: 'ALERT',
      isRead: false,
      createdAt: '2026-10-18T14:00:00Z'
    }
  ];

  // --- Departments & Employees ---
  async getDepartments(): Promise<Department[]> {
    await this.latency();
    return [...this.departments];
  }

  async addDepartment(d: Omit<Department, 'id' | 'createdAt'>): Promise<Department> {
    await this.latency();
    const newDept: Department = {
      ...d,
      id: 'dept-' + Math.floor(100 + Math.random() * 900),
      createdAt: new Date().toISOString()
    };
    this.departments.push(newDept);
    return newDept;
  }

  async getEmployees(): Promise<Employee[]> {
    await this.latency();
    return [...this.employees];
  }

  async addEmployee(e: Omit<Employee, 'id'>): Promise<Employee> {
    await this.latency();
    const newEmp: Employee = {
      ...e,
      id: 'emp-' + Math.floor(100 + Math.random() * 900)
    };
    this.employees.push(newEmp);
    return newEmp;
  }

  // --- Resources ---
  async getResources(): Promise<Resource[]> {
    await this.latency();
    return [...this.resources];
  }

  async getResourceById(id: string): Promise<Resource | null> {
    await this.latency();
    const r = this.resources.find(item => item.id === id);
    return r ? { ...r } : null;
  }

  async addResource(resource: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>): Promise<Resource> {
    await this.latency();
    const newId = 'res-' + Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();
    const newResource: Resource = {
      ...resource,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };
    this.resources.unshift(newResource);
    return newResource;
  }

  async updateResource(id: string, updates: Partial<Resource>): Promise<Resource | null> {
    await this.latency();
    const index = this.resources.findIndex(r => r.id === id);
    if (index === -1) return null;
    this.resources[index] = {
      ...this.resources[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    return { ...this.resources[index] };
  }

  // --- Assignments & Transfers ---
  async getAssignments(): Promise<AssetAssignment[]> {
    await this.latency();
    return [...this.assignments];
  }

  async createDirectAssignment(payload: {
    resourceId: string;
    employeeId: string;
    purpose: string;
    expectedReturnDate?: string;
    assignedBy: string;
  }): Promise<AssetAssignment> {
    await this.latency();
    const res = this.resources.find(r => r.id === payload.resourceId);
    if (!res) throw new Error('Asset not found');
    if (res.status !== 'AVAILABLE') throw new Error('Asset must be strictly AVAILABLE for assignment');

    const emp = this.employees.find(e => e.id === payload.employeeId);
    if (!emp) throw new Error('Employee not found');

    const now = new Date().toISOString();
    const newAsgn: AssetAssignment = {
      id: 'asgn-' + Math.random().toString(36).substr(2, 8),
      resourceId: res.id,
      resourceName: res.name,
      resourceCode: res.itemCode,
      employeeId: emp.id,
      employeeName: emp.name,
      departmentId: emp.departmentId,
      departmentName: emp.departmentName || 'EEC Department',
      assignedBy: payload.assignedBy,
      assignedAt: now,
      expectedReturnDate: payload.expectedReturnDate,
      purpose: payload.purpose,
      conditionOnAssignment: res.condition,
      isCurrent: true,
      status: 'ACTIVE'
    };

    // Update asset state atomically
    res.status = 'ASSIGNED';
    res.currentAssigneeId = emp.id;
    res.currentAssigneeName = emp.name;
    res.currentDepartmentId = emp.departmentId;
    res.currentDepartmentName = emp.departmentName;
    res.assignedAt = now;

    this.assignments.unshift(newAsgn);
    this.addNotification({
      title: 'Resource Assigned',
      message: `${res.name} (${res.itemCode}) assigned to ${emp.name}.`,
      type: 'SUCCESS'
    });

    return newAsgn;
  }

  async transferCustody(payload: {
    resourceId: string;
    newEmployeeId: string;
    transferNotes: string;
    transferredBy: string;
  }): Promise<AssetAssignment> {
    await this.latency();
    const res = this.resources.find(r => r.id === payload.resourceId);
    if (!res) throw new Error('Asset not found');
    if (res.status !== 'ASSIGNED') throw new Error('Asset must be currently ASSIGNED to transfer custody');

    const newEmp = this.employees.find(e => e.id === payload.newEmployeeId);
    if (!newEmp) throw new Error('New custodian not found');
    if (newEmp.id === res.currentAssigneeId) throw new Error('Cannot transfer to current custodian');

    const now = new Date().toISOString();

    // 1. Mark existing active assignment as transferred
    const currentAsgn = this.assignments.find(a => a.resourceId === res.id && a.isCurrent);
    if (currentAsgn) {
      currentAsgn.isCurrent = false;
      currentAsgn.status = 'TRANSFERRED';
      currentAsgn.returnedAt = now;
    }

    // 2. Create new assignment
    const newAsgn: AssetAssignment = {
      id: 'asgn-' + Math.random().toString(36).substr(2, 8),
      resourceId: res.id,
      resourceName: res.name,
      resourceCode: res.itemCode,
      employeeId: newEmp.id,
      employeeName: newEmp.name,
      departmentId: newEmp.departmentId,
      departmentName: newEmp.departmentName || 'EEC Department',
      assignedBy: payload.transferredBy,
      assignedAt: now,
      purpose: `Transferred from ${res.currentAssigneeName || 'previous holder'}: ${payload.transferNotes}`,
      conditionOnAssignment: res.condition,
      isCurrent: true,
      status: 'ACTIVE'
    };

    // 3. Update asset
    res.currentAssigneeId = newEmp.id;
    res.currentAssigneeName = newEmp.name;
    res.currentDepartmentId = newEmp.departmentId;
    res.currentDepartmentName = newEmp.departmentName;
    res.assignedAt = now;

    this.assignments.unshift(newAsgn);
    this.addNotification({
      title: 'Custody Transferred',
      message: `${res.name} transferred to ${newEmp.name}.`,
      type: 'INFO'
    });

    return newAsgn;
  }

  // --- Requisitions ---
  async getRequisitions(): Promise<ResourceRequisition[]> {
    await this.latency();
    return [...this.requisitions];
  }

  async submitRequisition(req: {
    requesterId: string;
    requesterName: string;
    requesterRole: any;
    departmentId: string;
    departmentName: string;
    category: any;
    itemDescription: string;
    justification: string;
    urgency: any;
    requiredDate: string;
  }): Promise<ResourceRequisition> {
    await this.latency();
    const newReq: ResourceRequisition = {
      ...req,
      id: 'req-' + Math.random().toString(36).substr(2, 8),
      requisitionNumber: 'REQ-2026-' + Math.floor(1000 + Math.random() * 9000),
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
    this.requisitions.unshift(newReq);
    this.addNotification({
      title: 'New Requisition Submitted',
      message: `${req.requesterName} submitted requisition ${newReq.requisitionNumber} for ${req.category}.`,
      type: 'INFO'
    });
    return newReq;
  }

  async approveRequisition(id: string, adminName: string): Promise<ResourceRequisition> {
    await this.latency();
    const req = this.requisitions.find(r => r.id === id);
    if (!req) throw new Error('Requisition not found');
    if (req.status !== 'PENDING') throw new Error('Only PENDING requisitions can be approved');

    req.status = 'APPROVED';
    req.approvedBy = adminName;
    req.approvedAt = new Date().toISOString();

    this.addNotification({
      title: 'Requisition Approved',
      message: `Requisition ${req.requisitionNumber} approved by ${adminName}. Ready for Store fulfillment.`,
      type: 'SUCCESS'
    });

    return { ...req };
  }

  async rejectRequisition(id: string, reason: string): Promise<ResourceRequisition> {
    await this.latency();
    const req = this.requisitions.find(r => r.id === id);
    if (!req) throw new Error('Requisition not found');
    if (req.status !== 'PENDING') throw new Error('Only PENDING requisitions can be rejected');
    if (!reason || reason.trim().length < 3) throw new Error('Rejection reason must be at least 3 characters');

    req.status = 'REJECTED';
    req.rejectionReason = reason;

    this.addNotification({
      title: 'Requisition Rejected',
      message: `Requisition ${req.requisitionNumber} rejected: ${reason}`,
      type: 'ALERT'
    });

    return { ...req };
  }

  async cancelRequisition(id: string, requesterId: string): Promise<ResourceRequisition> {
    await this.latency();
    const req = this.requisitions.find(r => r.id === id);
    if (!req) throw new Error('Requisition not found');
    if (req.status !== 'PENDING') throw new Error('Only PENDING requisitions can be cancelled by requester');
    if (req.requesterId !== requesterId) throw new Error('Unauthorized: only the original requester can cancel');

    req.status = 'CANCELLED';
    return { ...req };
  }

  async fulfillRequisition(payload: {
    requisitionId: string;
    resourceId: string;
    storeKeeperName: string;
    handoverNotes?: string;
  }): Promise<ResourceRequisition> {
    await this.latency();
    const req = this.requisitions.find(r => r.id === payload.requisitionId);
    if (!req) throw new Error('Requisition not found');
    if (req.status !== 'APPROVED') throw new Error('Only APPROVED requisitions can be fulfilled by Store Keeper');

    const res = this.resources.find(r => r.id === payload.resourceId);
    if (!res) throw new Error('Asset not found');
    if (res.status !== 'AVAILABLE') throw new Error('Selected asset is no longer AVAILABLE in store');
    if (res.category !== req.category) {
      throw new Error(`Category mismatch: Requisition requires ${req.category}, but selected asset is ${res.category}`);
    }

    const now = new Date().toISOString();

    // 1. Update requisition
    req.status = 'FULFILLED';
    req.fulfilledResourceId = res.id;
    req.fulfilledResourceName = res.name;
    req.fulfilledResourceCode = res.itemCode;
    req.fulfilledAt = now;
    req.fulfilledBy = payload.storeKeeperName;
    req.handoverNotes = payload.handoverNotes;

    // 2. Create AssetAssignment
    const newAsgn: AssetAssignment = {
      id: 'asgn-' + Math.random().toString(36).substr(2, 8),
      resourceId: res.id,
      resourceName: res.name,
      resourceCode: res.itemCode,
      employeeId: req.requesterId,
      employeeName: req.requesterName,
      departmentId: req.departmentId,
      departmentName: req.departmentName,
      assignedBy: payload.storeKeeperName,
      assignedAt: now,
      expectedReturnDate: req.requiredDate,
      purpose: `Fulfilled via Requisition ${req.requisitionNumber}: ${req.itemDescription}`,
      conditionOnAssignment: res.condition,
      isCurrent: true,
      status: 'ACTIVE'
    };
    this.assignments.unshift(newAsgn);

    // 3. Update asset status
    res.status = 'ASSIGNED';
    res.currentAssigneeId = req.requesterId;
    res.currentAssigneeName = req.requesterName;
    res.currentDepartmentId = req.departmentId;
    res.currentDepartmentName = req.departmentName;
    res.assignedAt = now;

    this.addNotification({
      title: 'Requisition Handover Completed',
      message: `${res.name} handed over to ${req.requesterName} by ${payload.storeKeeperName}.`,
      type: 'SUCCESS'
    });

    return { ...req };
  }

  // --- Returns ---
  async getReturns(): Promise<AssetReturnRecord[]> {
    await this.latency();
    return [...this.returns];
  }

  async requestReturn(payload: {
    resourceId: string;
    reason: string;
    employeeId: string;
  }): Promise<AssetReturnRecord> {
    await this.latency();
    const res = this.resources.find(r => r.id === payload.resourceId);
    if (!res) throw new Error('Asset not found');
    if (res.status !== 'ASSIGNED') throw new Error('Only ASSIGNED assets can be returned');

    const activeAsgn = this.assignments.find(a => a.resourceId === res.id && a.isCurrent);
    if (!activeAsgn) throw new Error('No active assignment record found for this asset');

    // Prevent duplicate pending return
    const existingPending = this.returns.find(ret => ret.resourceId === res.id && ret.status === 'PENDING');
    if (existingPending) throw new Error('A return request is already pending for this asset');

    const newRet: AssetReturnRecord = {
      id: 'ret-' + Math.random().toString(36).substr(2, 8),
      returnNumber: 'RET-2026-' + Math.floor(1000 + Math.random() * 9000),
      type: 'SCHEDULED',
      resourceId: res.id,
      resourceName: res.name,
      resourceCode: res.itemCode,
      assignmentId: activeAsgn.id,
      employeeId: activeAsgn.employeeId,
      employeeName: activeAsgn.employeeName,
      departmentName: activeAsgn.departmentName,
      status: 'PENDING',
      reason: payload.reason,
      createdAt: new Date().toISOString()
    };

    this.returns.unshift(newRet);
    this.addNotification({
      title: 'Return Request Submitted',
      message: `Return scheduled for ${res.name} by ${activeAsgn.employeeName}.`,
      type: 'INFO'
    });

    return newRet;
  }

  async receiveReturn(payload: {
    returnId?: string;
    resourceId: string;
    conditionOnReturn: any;
    returnLocation: string;
    receivedBy: string;
    handoverNotes?: string;
    isWalkIn?: boolean;
  }): Promise<AssetReturnRecord> {
    await this.latency();
    const res = this.resources.find(r => r.id === payload.resourceId);
    if (!res) throw new Error('Asset not found');
    if (res.status !== 'ASSIGNED') throw new Error('Cannot return an asset that is not currently ASSIGNED');

    const activeAsgn = this.assignments.find(a => a.resourceId === res.id && a.isCurrent);
    if (!activeAsgn) throw new Error('Cannot return: active assignment not found');

    const now = new Date().toISOString();

    // 1. Close active assignment
    activeAsgn.isCurrent = false;
    activeAsgn.status = 'RETURNED';
    activeAsgn.returnedAt = now;
    activeAsgn.conditionOnReturn = payload.conditionOnReturn;

    // 2. Update resource back to store
    res.status = 'AVAILABLE';
    res.condition = payload.conditionOnReturn;
    res.location = payload.returnLocation;
    res.currentAssigneeId = undefined;
    res.currentAssigneeName = undefined;
    res.assignedAt = undefined;

    // 3. Update return record or create walk-in record
    let retRecord: AssetReturnRecord;
    if (payload.returnId) {
      const existing = this.returns.find(r => r.id === payload.returnId);
      if (!existing) throw new Error('Return record not found');
      existing.status = 'RECEIVED';
      existing.receivedBy = payload.receivedBy;
      existing.receivedAt = now;
      existing.conditionOnReturn = payload.conditionOnReturn;
      existing.returnLocation = payload.returnLocation;
      existing.handoverNotes = payload.handoverNotes;
      retRecord = existing;
    } else {
      retRecord = {
        id: 'ret-' + Math.random().toString(36).substr(2, 8),
        returnNumber: 'RET-2026-WALK-' + Math.floor(100 + Math.random() * 900),
        type: 'WALK_IN',
        resourceId: res.id,
        resourceName: res.name,
        resourceCode: res.itemCode,
        assignmentId: activeAsgn.id,
        employeeId: activeAsgn.employeeId,
        employeeName: activeAsgn.employeeName,
        departmentName: activeAsgn.departmentName,
        status: 'RECEIVED',
        reason: 'Direct walk-in return processed at store counter',
        conditionOnReturn: payload.conditionOnReturn,
        returnLocation: payload.returnLocation,
        receivedBy: payload.receivedBy,
        receivedAt: now,
        handoverNotes: payload.handoverNotes,
        createdAt: now
      };
      this.returns.unshift(retRecord);
    }

    this.addNotification({
      title: 'Asset Return Processed',
      message: `${res.name} received by ${payload.receivedBy} at ${payload.returnLocation}.`,
      type: 'SUCCESS'
    });

    return retRecord;
  }

  // --- Maintenance & Inspection Tickets ---
  async getMaintenanceTickets(): Promise<MaintenanceTicket[]> {
    await this.latency();
    return [...this.maintenanceTickets];
  }

  async createMaintenanceTicket(payload: {
    resourceId: string;
    title: string;
    description: string;
    priority: any;
    reportedBy: string;
    assignedTechnician?: string;
    estimatedCostETB?: number;
  }): Promise<MaintenanceTicket> {
    await this.latency();
    const res = this.resources.find(r => r.id === payload.resourceId);
    if (!res) throw new Error('Asset not found');

    const newTicket: MaintenanceTicket = {
      id: 'ticket-' + Math.random().toString(36).substr(2, 8),
      ticketNumber: 'MT-2026-' + Math.floor(100 + Math.random() * 900),
      resourceId: res.id,
      resourceName: res.name,
      resourceCode: res.itemCode,
      category: res.category,
      title: payload.title,
      description: payload.description,
      priority: payload.priority,
      status: 'OPEN',
      reportedBy: payload.reportedBy,
      assignedTechnician: payload.assignedTechnician,
      estimatedCostETB: payload.estimatedCostETB,
      createdAt: new Date().toISOString()
    };

    // Transition asset into MAINTENANCE status
    res.status = 'MAINTENANCE';

    this.maintenanceTickets.unshift(newTicket);
    this.addNotification({
      title: 'Maintenance Ticket Created',
      message: `Work order ${newTicket.ticketNumber} opened for ${res.name}.`,
      type: 'ALERT'
    });

    return newTicket;
  }

  async updateMaintenanceStatus(id: string, newStatus: any, updates?: Partial<MaintenanceTicket>): Promise<MaintenanceTicket> {
    await this.latency();
    const ticket = this.maintenanceTickets.find(t => t.id === id);
    if (!ticket) throw new Error('Maintenance ticket not found');

    const res = this.resources.find(r => r.id === ticket.resourceId);
    if (!res) throw new Error('Associated asset not found');

    // Strict Business Invariant: Cannot complete ticket without passing QA test
    if (newStatus === 'COMPLETED') {
      const tests = this.inspections.filter(i => i.ticketId === ticket.id || i.resourceId === res.id);
      const latestTest = tests[0];
      if (!latestTest || !latestTest.passed) {
        throw new Error('MANDATORY QA PREREQUISITE: Cannot complete maintenance ticket because no passing inspection test was recorded for this repair.');
      }

      // Check if asset had an active assignment before maintenance
      const hasActiveAsgn = this.assignments.some(a => a.resourceId === res.id && a.isCurrent);
      res.status = hasActiveAsgn ? 'ASSIGNED' : 'AVAILABLE';
      ticket.completedAt = new Date().toISOString();
    } else if (newStatus === 'TESTING') {
      res.status = 'TESTING';
    } else if (newStatus === 'IN_PROGRESS') {
      res.status = 'MAINTENANCE';
    }

    ticket.status = newStatus;
    if (updates) {
      Object.assign(ticket, updates);
    }

    return { ...ticket };
  }

  async getInspections(): Promise<InspectionTest[]> {
    await this.latency();
    return [...this.inspections];
  }

  async recordInspection(payload: {
    ticketId?: string;
    resourceId: string;
    inspectionType: any;
    passed: boolean;
    findings: string;
    conductedBy: string;
    certificationNumber?: string;
    expiryDate?: string;
    remarks: string;
  }): Promise<InspectionTest> {
    await this.latency();
    const res = this.resources.find(r => r.id === payload.resourceId);
    if (!res) throw new Error('Asset not found');

    const newInsp: InspectionTest = {
      id: 'insp-' + Math.random().toString(36).substr(2, 8),
      ticketId: payload.ticketId,
      resourceId: res.id,
      resourceName: res.name,
      resourceCode: res.itemCode,
      inspectionType: payload.inspectionType,
      passed: payload.passed,
      findings: payload.findings,
      conductedBy: payload.conductedBy,
      certificationNumber: payload.certificationNumber,
      expiryDate: payload.expiryDate,
      remarks: payload.remarks,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };

    this.inspections.unshift(newInsp);

    // If inspection is tied to a maintenance ticket in TESTING state:
    if (payload.ticketId) {
      const ticket = this.maintenanceTickets.find(t => t.id === payload.ticketId);
      if (ticket) {
        if (!payload.passed) {
          // If QA failed, revert ticket to IN_PROGRESS
          ticket.status = 'IN_PROGRESS';
          res.status = 'MAINTENANCE';
        }
      }
    }

    this.addNotification({
      title: `Inspection ${payload.passed ? 'PASSED' : 'FAILED'}`,
      message: `${payload.inspectionType} inspection for ${res.name}: ${payload.passed ? 'Certified compliant.' : 'Failed QA; further repairs required.'}`,
      type: payload.passed ? 'SUCCESS' : 'WARNING'
    });

    return newInsp;
  }

  // --- User Approvals ---
  async getUserApprovals(): Promise<UserApproval[]> {
    await this.latency();
    return [...this.userApprovals];
  }

  async approveUser(id: string, reviewedBy: string): Promise<UserApproval> {
    await this.latency();
    const req = this.userApprovals.find(u => u.id === id);
    if (!req) throw new Error('Approval request not found');

    req.status = 'APPROVED';
    req.reviewedBy = reviewedBy;
    req.reviewedAt = new Date().toISOString();

    // Auto-create active Employee record
    const newEmp: Employee = {
      id: 'emp-' + Math.floor(100 + Math.random() * 900),
      employeeId: 'EEC-EMP-' + Math.floor(400 + Math.random() * 500),
      name: req.name,
      email: req.email,
      phone: '+251 911 ' + Math.floor(100000 + Math.random() * 900000),
      departmentId: req.departmentId,
      departmentName: req.departmentName,
      designation: req.designation,
      role: req.requestedRole,
      isActive: true,
      hireDate: new Date().toISOString().split('T')[0]
    };
    this.employees.push(newEmp);

    this.addNotification({
      title: 'User Access Approved',
      message: `User ${req.name} approved as ${req.requestedRole} by ${reviewedBy}.`,
      type: 'SUCCESS'
    });

    return { ...req };
  }

  async rejectUser(id: string, reason: string): Promise<UserApproval> {
    await this.latency();
    const req = this.userApprovals.find(u => u.id === id);
    if (!req) throw new Error('Approval request not found');

    req.status = 'REJECTED';
    req.rejectionReason = reason;
    req.reviewedAt = new Date().toISOString();

    return { ...req };
  }

  // --- Notifications ---
  async getNotifications(): Promise<NotificationItem[]> {
    await this.latency();
    return [...this.notifications];
  }

  async markAllNotificationsRead(): Promise<void> {
    this.notifications.forEach(n => { n.isRead = true; });
  }

  async resetToInitial(): Promise<void> {
    this.notifications.forEach(n => { n.isRead = false; });
  }

  async markNotificationRead(id: string): Promise<void> {
    const notif = this.notifications.find(n => n.id === id);
    if (notif) notif.isRead = true;
  }

  private addNotification(n: Omit<NotificationItem, 'id' | 'createdAt' | 'isRead'>) {
    this.notifications.unshift({
      ...n,
      id: 'notif-' + Math.random().toString(36).substr(2, 7),
      isRead: false,
      createdAt: new Date().toISOString()
    });
  }

  private latency(ms: number = 60): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const mockStore = new MockDataStore();
