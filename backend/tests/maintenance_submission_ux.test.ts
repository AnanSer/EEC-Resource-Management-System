process.env.RMS_TEST_MODE = '1';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import prisma from '../src/lib/prisma';
import { hashPassword } from '../src/auth/password.js';

let server: http.Server;
let baseUrl: string;

async function createTestServer(): Promise<string> {
  const indexMod = await import('../src/index');
  server = indexMod.server;
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve(baseUrl);
    });
  });
}

async function request(method: string, path: string, options: { body?: any; cookie?: string } = {}) {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.cookie) {
    headers['Cookie'] = options.cookie;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const cookieHeader = res.headers.get('set-cookie');
  let body: any = null;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return {
    status: res.status,
    headers: res.headers,
    cookie: cookieHeader ? cookieHeader.split(';')[0] : null,
    body,
  };
}

async function loginUser(email: string, password = 'EEC-Secure2026!'): Promise<string> {
  const res = await request('POST', '/api/auth/login', {
    body: { email, password },
  });
  if (res.status !== 200 || !res.cookie) {
    throw new Error(`Login failed for ${email}: status ${res.status}`);
  }
  return res.cookie;
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`, detail || '');
    failed++;
  }
}

// Logic mirror of form submission UX handlers from MaintenancePage.tsx
interface FormState {
  selectedResourceId: string;
  ticketTitle: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  technician: string;
  estimatedCost: number;
  creating: boolean;
  createError: string | null;
  isCreateModalOpen: boolean;
  toastMessage: string | null;
  statusFilter: string;
  searchQuery: string;
}

function createInitialFormState(resourceId = ''): FormState {
  return {
    selectedResourceId: resourceId,
    ticketTitle: '',
    description: '',
    priority: 'MEDIUM',
    technician: '',
    estimatedCost: 10000,
    creating: false,
    createError: null,
    isCreateModalOpen: true,
    toastMessage: null,
    statusFilter: 'ALL',
    searchQuery: '',
  };
}

function simulateSubmitAttempt(state: FormState): { canSubmit: boolean; reason?: string } {
  // Guard against duplicate submission while in-flight
  if (state.creating) {
    return { canSubmit: false, reason: 'In-flight submission guard blocked concurrent duplicate call' };
  }
  if (!state.selectedResourceId) {
    return { canSubmit: false, reason: 'Please select a piece of equipment to report.' };
  }
  if (!state.ticketTitle.trim() || state.ticketTitle.trim().length < 3) {
    return { canSubmit: false, reason: 'Summary/title is required (minimum 3 characters)' };
  }
  if (!state.description.trim() || state.description.trim().length < 5) {
    return { canSubmit: false, reason: 'Detailed defect description is required (minimum 5 characters)' };
  }
  return { canSubmit: true };
}

function simulateSuccessReset(state: FormState, createdNumber: string) {
  // 1. Close modal automatically
  state.isCreateModalOpen = false;
  // 2. Reset form so old values do not appear next time
  state.selectedResourceId = '';
  state.ticketTitle = '';
  state.description = '';
  state.priority = 'MEDIUM';
  state.technician = '';
  state.estimatedCost = 10000;
  state.createError = null;
  // 3. Clear filters so newly submitted request appears in the list
  state.statusFilter = 'ALL';
  state.searchQuery = '';
  // 4. Set success toast
  state.toastMessage = `Maintenance request ${createdNumber} submitted successfully! Equipment marked under maintenance.`;
  // 5. Release in-flight flag
  state.creating = false;
}

function simulateFailurePreserve(state: FormState, errorMessage: string) {
  // Modal stays open
  state.isCreateModalOpen = true;
  // Form values PRESERVED - none are wiped
  // Error message displayed
  state.createError = errorMessage;
  // Release in-flight flag so user can retry
  state.creating = false;
}

class MaintenancePageSimulator {
  locationState: any;
  searchParams: URLSearchParams;
  initialTriggerProcessed = false;
  isCreateModalOpen = false;
  selectedResourceId = '';
  ticketTitle = '';
  description = '';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
  technician = '';
  estimatedCost = 10000;
  creating = false;
  createError: string | null = null;
  statusFilter = 'ALL';
  priorityFilter = 'ALL';
  searchQuery = '';
  toastMessage: string | null = null;
  tickets: any[] = [];
  metrics: any = null;
  resources: any[] = [];

  constructor(initialLocationState: any = null, initialParams = '') {
    this.locationState = initialLocationState || {};
    this.searchParams = new URLSearchParams(initialParams);
  }

  // Dedicated one-time effect for navigation or query parameter trigger (e.g. from ResourceDetailPage)
  runInitialNavigationEffect() {
    if (this.initialTriggerProcessed) return;

    const stateOpen = this.locationState?.openReportModal;
    const stateResourceId = this.locationState?.resourceId;
    const queryOpen = this.searchParams.get('openReportModal') === 'true' || this.searchParams.get('report') === 'true';
    const queryResourceId = this.searchParams.get('resourceId');

    if (stateOpen || queryOpen) {
      this.initialTriggerProcessed = true;
      const targetResourceId = stateResourceId || queryResourceId;
      if (targetResourceId) {
        this.selectedResourceId = targetResourceId;
      }
      this.isCreateModalOpen = true;

      // Immediately clear router state and query params so subsequent renders,
      // reloads, or data refreshes CANNOT reopen the modal.
      this.locationState = {};
      this.searchParams = new URLSearchParams();
    }
  }

  openCreateModal(preselectedResourceId?: string) {
    this.createError = null;
    if (preselectedResourceId) {
      this.selectedResourceId = preselectedResourceId;
    } else if (this.resources.length > 0 && !this.selectedResourceId) {
      this.selectedResourceId = this.resources[0].id;
    }
    this.isCreateModalOpen = true;
  }

  resetCreateForm() {
    this.selectedResourceId = '';
    this.ticketTitle = '';
    this.description = '';
    this.priority = 'MEDIUM';
    this.technician = '';
    this.estimatedCost = 10000;
    this.createError = null;
  }

  // loadData: PURE data fetcher, does NOT touch isCreateModalOpen!
  async loadData(cookie: string, overrideFilters?: { status?: string; priority?: string; search?: string }) {
    const activeStatus = overrideFilters?.status !== undefined ? overrideFilters.status : this.statusFilter;
    const activePriority = overrideFilters?.priority !== undefined ? overrideFilters.priority : this.priorityFilter;
    const activeSearch = overrideFilters?.search !== undefined ? overrideFilters.search : this.searchQuery;

    const [tRes, mRes] = await Promise.all([
      request('GET', `/api/maintenance?status=${activeStatus}&priority=${activePriority}&search=${encodeURIComponent(activeSearch)}`, { cookie }),
      request('GET', '/api/maintenance/metrics', { cookie }),
    ]);
    this.tickets = tRes.body.requests || [];
    this.metrics = mRes.body.metrics || null;
    // Load authorized resources
    const myAssetsRes = await request('GET', '/api/resources/my-assets', { cookie });
    this.resources = (myAssetsRes.body.resources || []).filter((r: any) => r.status !== 'MAINTENANCE');
    // Notice: NO modal manipulation here!
  }

  async handleCreateTicket(cookie: string) {
    if (this.creating) return;
    this.creating = true;
    this.createError = null;
    try {
      const res = await request('POST', '/api/maintenance', {
        cookie,
        body: {
          resourceId: this.selectedResourceId,
          title: this.ticketTitle,
          description: this.description,
          priority: this.priority,
          assignedTechnicianName: this.technician || undefined,
          estimatedCostETB: this.estimatedCost,
        },
      });

      if (res.status >= 400) {
        throw new Error(res.body.message || res.body.error || 'Ticket creation failed');
      }

      // 1. Close modal automatically and keep it closed
      this.isCreateModalOpen = false;

      // 2. Reset form completely so old values do not appear next time
      this.resetCreateForm();

      // 3. Clear any preselected resource or modal-opening trigger
      this.initialTriggerProcessed = true;
      this.locationState = {};
      this.searchParams = new URLSearchParams();

      // 4. Clear filters and search to guarantee newly created request appears in the list
      this.statusFilter = 'ALL';
      this.priorityFilter = 'ALL';
      this.searchQuery = '';

      // 5. Display clear success toast/message
      this.toastMessage = `Maintenance request ${res.body.request.requestNumber || res.body.request.id} submitted successfully! Equipment marked under maintenance.`;

      // 6. Refresh maintenance list and dashboard metrics from backend
      await this.loadData(cookie, { status: 'ALL', priority: 'ALL', search: '' });

      return res;
    } catch (err: any) {
      // On failed submission: keep modal open, preserve form values, show useful validation/server error
      this.createError = err.message || 'Ticket creation failed';
    } finally {
      this.creating = false;
    }
  }

  // Simulate subsequent React render pass (e.g. triggered by filter state change)
  async simulateSubsequentRender(cookie: string) {
    this.runInitialNavigationEffect();
    await this.loadData(cookie);
  }
}

async function runAllTests() {
  console.log('========================================================================');
  console.log('EEC RMS: Maintenance Fault Report Submission UX & Lifecycle Tests');
  console.log('========================================================================');

  await createTestServer();

  let adminCookie = '';
  let employeeCookie = '';
  let otherEmpCookie = '';
  let deptTid: any = null;
  let testAssetInCustody: any = null;
  let testUnassignedAsset: any = null;
  let empCustodyUser: any = null;
  let empCustodyRecord: any = null;
  let empOtherUser: any = null;
  let empOtherRecord: any = null;
  let testAssignment: any = null;
  let createdTicketId: string | null = null;

  try {
    // 1. Authenticate Admin
    console.log('\n--- 1. Authenticating Admin & Setup Department ---');
    adminCookie = await loginUser('admin@eec.gov.et');
    assert(!!adminCookie, 'Admin authenticated');

    deptTid = await prisma.department.findFirst({ where: { code: 'TID' } });
    assert(!!deptTid, 'TID department exists');

    // 2. Setup Test Employees with distinct roles & custody
    console.log('\n--- 2. Setting Up Test Employees with Distinct Roles ---');
    const ts = Date.now();
    const passwordHash = await hashPassword('EEC-Secure2026!');

    empCustodyUser = await prisma.user.create({
      data: {
        email: `custody.emp.${ts}@eec.gov.et`,
        fullName: `Custody Staff ${ts}`,
        passwordHash,
        role: 'EMPLOYEE',
        status: 'APPROVED',
        departmentId: deptTid.id,
      },
    });

    empCustodyRecord = await prisma.employee.create({
      data: {
        employeeId: `EMP-CUST-${ts}`,
        name: `Custody Staff ${ts}`,
        email: empCustodyUser.email,
        departmentId: deptTid.id,
        designation: 'Senior Geotechnical Surveyor',
        role: 'EMPLOYEE',
        isActive: true,
        userId: empCustodyUser.id,
      },
    });

    empOtherUser = await prisma.user.create({
      data: {
        email: `other.emp.${ts}@eec.gov.et`,
        fullName: `Other Staff ${ts}`,
        passwordHash,
        role: 'EMPLOYEE',
        status: 'APPROVED',
        departmentId: deptTid.id,
      },
    });

    empOtherRecord = await prisma.employee.create({
      data: {
        employeeId: `EMP-OTHR-${ts}`,
        name: `Other Staff ${ts}`,
        email: empOtherUser.email,
        departmentId: deptTid.id,
        designation: 'Junior Assistant Surveyor',
        role: 'EMPLOYEE',
        isActive: true,
        userId: empOtherUser.id,
      },
    });

    employeeCookie = await loginUser(empCustodyUser.email);
    assert(!!employeeCookie, 'Custodian employee session authenticated');

    otherEmpCookie = await loginUser(empOtherUser.email);
    assert(!!otherEmpCookie, 'Other employee session authenticated');

    // 3. Setup Equipment and Active Custody
    console.log('\n--- 3. Setting Up Equipment & Active Custody Assignment ---');
    testAssetInCustody = await prisma.resource.create({
      data: {
        itemCode: `EEC-SURV-CUST-${ts}`,
        name: 'Leica TS16 Total Station in Custody',
        category: 'SURVEYING_GEOTECHNICAL',
        subcategory: 'Total Station',
        status: 'ASSIGNED',
        condition: 'GOOD',
        location: 'Field Site - Mojo',
        departmentId: deptTid.id,
        currentAssigneeId: empCustodyRecord.id,
        purchaseDate: new Date('2025-01-10'),
        purchaseCostETB: 950000,
        currentValueETB: 900000,
      },
    });

    testAssignment = await prisma.resourceAssignment.create({
      data: {
        assignmentNumber: `ASGN-TEST-${ts}`,
        resourceId: testAssetInCustody.id,
        employeeId: empCustodyRecord.id,
        departmentId: deptTid.id,
        assignedByName: 'Admin Officer',
        assignedById: empCustodyUser.id,
        purpose: 'Topographic survey Modjo Expressway',
        status: 'ACTIVE',
        isCurrent: true,
      },
    });

    testUnassignedAsset = await prisma.resource.create({
      data: {
        itemCode: `EEC-SURV-UNAS-${ts}`,
        name: 'Unassigned Optical Level in Store',
        category: 'SURVEYING_GEOTECHNICAL',
        subcategory: 'Optical Level',
        status: 'AVAILABLE',
        condition: 'GOOD',
        location: 'Central Store - Kersa',
        departmentId: deptTid.id,
        purchaseDate: new Date('2025-01-10'),
        purchaseCostETB: 65000,
        currentValueETB: 60000,
      },
    });
    assert(!!testAssetInCustody, 'Assigned asset created with active custody');
    assert(!!testUnassignedAsset, 'Unassigned asset created in store');

    // 4. Employee Custody Authorization Check
    console.log('\n--- 4. Employee Custody Authorization Rules ---');

    // Other employee tries to report fault on custodian's asset -> rejected with 403
    const foreignCustodyRes = await request('POST', '/api/maintenance', {
      cookie: otherEmpCookie,
      body: {
        resourceId: testAssetInCustody.id,
        title: 'Unauthorized fault report attempt',
        description: 'Trying to report fault on another employee asset',
        priority: 'MEDIUM',
      },
    });
    assert(foreignCustodyRes.status === 403, 'Employee rejected when reporting asset assigned to someone else (403)');
    assert(
      (foreignCustodyRes.body.message || '').includes('active custody'),
      'Error explains employee may only report faults on equipment in their active custody'
    );

    // Other employee tries to report fault on unassigned store asset -> rejected with 403
    const unassignedEmpRes = await request('POST', '/api/maintenance', {
      cookie: otherEmpCookie,
      body: {
        resourceId: testUnassignedAsset.id,
        title: 'Unassigned equipment report',
        description: 'Employee trying to report unassigned equipment in warehouse',
        priority: 'MEDIUM',
      },
    });
    assert(unassignedEmpRes.status === 403, 'Employee rejected when reporting unassigned warehouse asset (403)');

    // 5. Validation Rejections & Form Data Preservation
    console.log('\n--- 5. Failed Submission & Preserved Form Data ---');

    // Form state initialized with user input
    const formState = createInitialFormState(testAssetInCustody.id);
    formState.ticketTitle = 'ED'; // invalid (< 3 chars)
    formState.description = 'Comp'; // invalid (< 5 chars)
    formState.priority = 'CRITICAL';
    formState.estimatedCost = 35000;

    // Frontend validation rejects short title
    const check1 = simulateSubmitAttempt(formState);
    assert(!check1.canSubmit, 'Frontend validation blocks submission with title < 3 chars');

    // Backend validation rejects title < 3 chars
    const shortTitleRes = await request('POST', '/api/maintenance', {
      cookie: employeeCookie,
      body: {
        resourceId: formState.selectedResourceId,
        title: 'ED',
        description: 'Valid long description of defect on EDM sensor',
        priority: formState.priority,
      },
    });
    assert(shortTitleRes.status === 400, 'Backend rejects title < 3 chars with 400');
    assert(
      (shortTitleRes.body.message || '').includes('minimum 3 characters'),
      'Error message clarifies minimum 3 characters requirement'
    );

    // Simulate failure handling: modal stays open, values preserved
    simulateFailurePreserve(formState, shortTitleRes.body.message);
    assert(formState.isCreateModalOpen === true, 'Modal remains open after failed submission');
    assert(formState.selectedResourceId === testAssetInCustody.id, 'selectedResourceId is preserved');
    assert(formState.ticketTitle === 'ED', 'ticketTitle is preserved');
    assert(formState.description === 'Comp', 'description is preserved');
    assert(formState.priority === 'CRITICAL', 'priority is preserved');
    assert(formState.estimatedCost === 35000, 'estimatedCost is preserved');
    assert(formState.createError === shortTitleRes.body.message, 'Useful error message is displayed to user');
    assert(formState.creating === false, 'Submit button restored (creating is false)');

    // Correct title, but description < 5 chars
    formState.ticketTitle = 'Total Station EDM sensor angular bias error';
    const shortDescRes = await request('POST', '/api/maintenance', {
      cookie: employeeCookie,
      body: {
        resourceId: formState.selectedResourceId,
        title: formState.ticketTitle,
        description: 'Bad',
        priority: formState.priority,
      },
    });
    assert(shortDescRes.status === 400, 'Backend rejects description < 5 chars with 400');
    simulateFailurePreserve(formState, shortDescRes.body.message);
    assert(formState.isCreateModalOpen === true, 'Modal remains open after second failed submission');
    assert(formState.ticketTitle === 'Total Station EDM sensor angular bias error', 'Corrected title is preserved');

    // 6. In-Flight Lock & Duplicate Submission Prevention
    console.log('\n--- 6. In-Flight Lock & Duplicate Submission Prevention ---');
    formState.description = 'The EDM distance measurement module fails with error E045 during distance measurement.';
    formState.creating = true; // In-flight lock activated

    // Rapid second click or repeated Enter press while creating === true
    const rapidClickAttempt = simulateSubmitAttempt(formState);
    assert(!rapidClickAttempt.canSubmit, 'In-flight guard blocks rapid second click or Enter press');
    assert(
      rapidClickAttempt.reason?.includes('In-flight submission guard'),
      'Guard provides duplicate prevention feedback'
    );
    formState.creating = false; // Reset lock for real submission

    // 7. Successful Submission Workflow
    console.log('\n--- 7. Successful Submission Workflow ---');
    const beforeMetrics = await request('GET', '/api/maintenance/metrics', { cookie: employeeCookie });
    const beforeTotalRequests = beforeMetrics.body.metrics?.totalRequests || 0;
    const beforeSubmittedCount = beforeMetrics.body.metrics?.submittedCount || 0;

    const validSubmission = await request('POST', '/api/maintenance', {
      cookie: employeeCookie,
      body: {
        resourceId: formState.selectedResourceId,
        title: formState.ticketTitle,
        description: formState.description,
        priority: formState.priority,
      },
    });
    assert(validSubmission.status === 201, 'Valid maintenance request accepted (201)');
    assert(validSubmission.body.success === true, 'Response indicates success: true');
    assert(validSubmission.body.request.status === 'SUBMITTED', 'Initial status is SUBMITTED');
    assert(validSubmission.body.request.title === formState.ticketTitle, 'Saved title matches submitted title');
    createdTicketId = validSubmission.body.request.id;
    const requestNumber = validSubmission.body.request.requestNumber;

    // Simulate success UX reset
    simulateSuccessReset(formState, requestNumber);
    assert(formState.isCreateModalOpen === false, 'Modal closed automatically on success');
    assert(formState.selectedResourceId === '', 'selectedResourceId reset to empty');
    assert(formState.ticketTitle === '', 'ticketTitle reset to empty');
    assert(formState.description === '', 'description reset to empty');
    assert(formState.priority === 'MEDIUM', 'priority reset to MEDIUM default');
    assert(formState.estimatedCost === 10000, 'estimatedCost reset to default');
    assert(formState.createError === null, 'createError cleared');
    assert(formState.statusFilter === 'ALL', 'statusFilter reset to ALL');
    assert(formState.searchQuery === '', 'searchQuery reset to empty');
    assert(
      formState.toastMessage?.includes(requestNumber),
      'Toast message includes new request number and confirms submission'
    );

    // Verify DB state of resource transitioned to MAINTENANCE
    const dbAsset = await prisma.resource.findUnique({ where: { id: testAssetInCustody.id } });
    assert(dbAsset?.status === 'MAINTENANCE', 'Resource status transitioned to MAINTENANCE in database');
    assert(dbAsset?.currentAssigneeId === empCustodyRecord.id, 'Resource custodian preserved for return-to-custodian workflow');

    // 8. Data Refresh & Verification that New Ticket Appears in List
    console.log('\n--- 8. Data Refresh & Verification of List & Metrics ---');

    // List tickets with status=ALL to verify newly submitted request is present
    const freshTicketsRes = await request('GET', '/api/maintenance?status=ALL', { cookie: employeeCookie });
    assert(freshTicketsRes.status === 200, 'GET /api/maintenance returns 200');
    const freshTickets = freshTicketsRes.body.requests || [];
    const foundNewTicket = freshTickets.find((t: any) => t.id === createdTicketId);
    assert(!!foundNewTicket, 'Newly submitted maintenance request appears in refreshed tickets list');
    assert(foundNewTicket?.requestNumber === requestNumber, 'Found ticket has matching requestNumber');
    assert(foundNewTicket?.status === 'SUBMITTED', 'Found ticket has SUBMITTED status');

    // Refresh metrics from backend
    const afterMetrics = await request('GET', '/api/maintenance/metrics', { cookie: employeeCookie });
    assert(afterMetrics.status === 200, 'GET /api/maintenance/metrics returns 200');
    const afterTotalRequests = afterMetrics.body.metrics?.totalRequests || 0;
    const afterSubmittedCount = afterMetrics.body.metrics?.submittedCount || 0;
    assert(afterTotalRequests === beforeTotalRequests + 1, 'Metrics totalRequests incremented by 1');
    assert(afterSubmittedCount === beforeSubmittedCount + 1, 'Metrics submittedCount incremented by 1');

    // 9. Backend Rejection of Duplicate Active Maintenance on Same Resource
    console.log('\n--- 9. Backend Rejection of Duplicate Active Maintenance ---');
    const duplicateRes = await request('POST', '/api/maintenance', {
      cookie: employeeCookie,
      body: {
        resourceId: testAssetInCustody.id,
        title: 'Duplicate maintenance report attempt',
        description: 'Trying to report second fault while asset is in maintenance',
        priority: 'HIGH',
      },
    });
    assert(duplicateRes.status === 409, 'Duplicate maintenance request rejected with 409 Conflict');
    assert(
      (duplicateRes.body.message || '').includes('already currently under MAINTENANCE') ||
      (duplicateRes.body.message || '').includes('is already open'),
      'Error message clarifies resource is already in maintenance'
    );

    // 10. Regression Test: Modal Remains Closed Across Submission, Refresh & Subsequent Renders
    console.log('\n--- 10. Regression: Modal Remains Closed Across Submission, Refresh & Subsequent Renders ---');
    
    // Create a second test asset in custody for testing the frontend component lifecycle
    const ts2 = Date.now() + 100;
    const testAsset2 = await prisma.resource.create({
      data: {
        itemCode: `EEC-SURV-MODAL-${ts2}`,
        name: 'Sokkia Auto-Level Modal Lifecycle Asset',
        category: 'SURVEYING_GEOTECHNICAL',
        subcategory: 'Auto-Level',
        departmentId: deptTid.id,
        status: 'ASSIGNED',
        currentAssigneeId: empCustodyRecord.id,
      },
    });

    const testAssignment2 = await prisma.resourceAssignment.create({
      data: {
        assignmentNumber: `ASGN-MODAL-${ts2}`,
        resourceId: testAsset2.id,
        employeeId: empCustodyRecord.id,
        departmentId: deptTid.id,
        assignedByName: 'Admin Officer',
        assignedById: empCustodyUser.id,
        purpose: 'Survey calibration verification',
        status: 'ACTIVE',
        isCurrent: true,
      },
    });

    // Sub-test 10A: Navigation with location.state -> Submit -> Refresh -> Subsequent renders
    console.log('  Sub-test 10A: Navigation trigger -> Submission -> LoadData -> Re-renders');
    const sim = new MaintenancePageSimulator({ openReportModal: true, resourceId: testAsset2.id });
    
    // Mount: runInitialNavigationEffect handles the navigation state
    sim.runInitialNavigationEffect();
    assert(sim.isCreateModalOpen === true, '10A: Report modal opened from navigation state');
    assert(sim.selectedResourceId === testAsset2.id, '10A: Preselected resource matches navigated asset');
    assert(sim.initialTriggerProcessed === true, '10A: Initial navigation trigger marked as processed');
    assert(Object.keys(sim.locationState).length === 0, '10A: locationState immediately cleared (history replaced)');

    // Fill form
    sim.ticketTitle = 'Auto-Level prism compensator stuck';
    sim.description = 'The air damping pendulum compensator is stuck and does not level automatically.';
    sim.priority = 'HIGH';

    // Submit ticket
    const regSubmitRes = await sim.handleCreateTicket(employeeCookie);
    assert(regSubmitRes?.status === 201, '10A: Submission succeeded with 201');
    assert(sim.isCreateModalOpen === false, '10A: Modal closed immediately on successful submission');
    assert(sim.selectedResourceId === '', '10A: selectedResourceId reset to empty');
    assert(sim.ticketTitle === '', '10A: ticketTitle reset to empty');
    assert(sim.description === '', '10A: description reset to empty');
    assert(sim.createError === null, '10A: createError is null');
    assert(sim.toastMessage?.includes('submitted successfully'), '10A: Success toast generated');

    // First subsequent render pass (e.g. useEffect from statusFilter / searchQuery reset)
    await sim.simulateSubsequentRender(employeeCookie);
    assert(sim.isCreateModalOpen === false, '10A: Modal remains strictly closed after first re-render and loadData()');

    // Second subsequent render pass (e.g. user toggles a table filter or search)
    sim.statusFilter = 'ALL';
    await sim.simulateSubsequentRender(employeeCookie);
    assert(sim.isCreateModalOpen === false, '10A: Modal remains closed after second re-render');

    // Third subsequent render pass (e.g. metrics or background interval update)
    await sim.simulateSubsequentRender(employeeCookie);
    assert(sim.isCreateModalOpen === false, '10A: Modal remains closed after third re-render');

    // Clean up created regression ticket from DB
    if (regSubmitRes?.body?.request?.id) {
      await prisma.maintenanceLog.deleteMany({ where: { maintenanceRequestId: regSubmitRes.body.request.id } });
      await prisma.maintenanceRequest.deleteMany({ where: { id: regSubmitRes.body.request.id } });
    }
    await prisma.resourceAssignment.deleteMany({ where: { resourceId: testAsset2.id } });
    await prisma.resource.deleteMany({ where: { id: testAsset2.id } });

    // Sub-test 10B: Failed submission keeps modal open and preserves entered values
    console.log('  Sub-test 10B: Failed submission preserves modal state and inputs');
    const simFail = new MaintenancePageSimulator();
    simFail.openCreateModal();
    assert(simFail.isCreateModalOpen === true, '10B: Modal opened via openCreateModal()');
    
    // Set invalid inputs
    simFail.selectedResourceId = testAssetInCustody.id; // already in maintenance -> will fail with 409
    simFail.ticketTitle = 'Retry test title';
    simFail.description = 'Valid length description for failure test';
    simFail.priority = 'CRITICAL';
    simFail.technician = 'Kenenisa Bekele';
    simFail.estimatedCost = 25000;

    await simFail.handleCreateTicket(employeeCookie);
    assert(simFail.isCreateModalOpen === true, '10B: Modal remains open after failed backend submission');
    assert(simFail.createError !== null, '10B: Error message displayed to user');
    assert(simFail.selectedResourceId === testAssetInCustody.id, '10B: selectedResourceId preserved on failure');
    assert(simFail.ticketTitle === 'Retry test title', '10B: ticketTitle preserved on failure');
    assert(simFail.description === 'Valid length description for failure test', '10B: description preserved on failure');
    assert(simFail.priority === 'CRITICAL', '10B: priority preserved on failure');
    assert(simFail.technician === 'Kenenisa Bekele', '10B: technician preserved on failure');
    assert(simFail.estimatedCost === 25000, '10B: estimatedCost preserved on failure');
    assert(simFail.creating === false, '10B: Submitting lock released, user can retry');

    // 11. Cleaning Up Test Records
    console.log('\n--- 11. Cleaning Up Test Records ---');
    if (createdTicketId) {
      await prisma.maintenanceLog.deleteMany({ where: { maintenanceRequestId: createdTicketId } });
      await prisma.maintenanceRequest.deleteMany({ where: { id: createdTicketId } });
    }
    await prisma.resourceAssignment.deleteMany({ where: { resourceId: testAssetInCustody.id } });
    await prisma.resource.deleteMany({
      where: { id: { in: [testAssetInCustody.id, testUnassignedAsset.id] } },
    });
    await prisma.employee.deleteMany({
      where: { id: { in: [empCustodyRecord.id, empOtherRecord.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [empCustodyUser.id, empOtherUser.id] } },
    });
    console.log('  ✓ Test maintenance requests, assignments, resources, employees, and users safely cleaned up');

  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n========================================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
