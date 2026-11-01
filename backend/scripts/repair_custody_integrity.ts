import prisma from '../src/lib/prisma';

async function main() {
  console.log('================================================================');
  console.log('EEC RMS: Custody & Return Eligibility Data Integrity Audit');
  console.log('================================================================');

  const allResources = await prisma.resource.findMany({
    include: {
      currentAssignee: true,
      department: true,
      assignments: {
        include: { employee: true, department: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const allAssignments = await prisma.resourceAssignment.findMany({
    include: {
      resource: true,
      employee: true,
      department: true,
    },
  });

  console.log(`Total Resources: ${allResources.length}`);
  console.log(`Total Assignments: ${allAssignments.length}\n`);

  // 1. Resources with stale currentAssigneeId
  const staleCurrentAssignee = allResources.filter((r) => {
    if (!r.currentAssigneeId) return false;
    const matchingActive = r.assignments.find(
      (a) => a.isCurrent && a.status === 'ACTIVE' && a.employeeId === r.currentAssigneeId
    );
    return !matchingActive;
  });

  // 2. Resources with status ASSIGNED but no active assignment
  const assignedNoActive = allResources.filter((r) => {
    if (r.status !== 'ASSIGNED') return false;
    const active = r.assignments.filter((a) => a.isCurrent && a.status === 'ACTIVE');
    return active.length === 0;
  });

  // 3. Active assignments whose resource status is not ASSIGNED
  const activeAsgnResourceNotAssigned = allAssignments.filter((a) => {
    if (!a.isCurrent || a.status !== 'ACTIVE') return false;
    return a.resource.status !== 'ASSIGNED';
  });

  // 4. Multiple active assignments for the same resource
  const activeCountByResource: Record<string, number> = {};
  allAssignments.forEach((a) => {
    if (a.isCurrent && a.status === 'ACTIVE') {
      activeCountByResource[a.resourceId] = (activeCountByResource[a.resourceId] || 0) + 1;
    }
  });
  const multipleActive = Object.entries(activeCountByResource).filter(([_, c]) => c > 1);

  // 5. Active assignments that disagree with currentAssigneeId
  const activeDisagreeWithAssignee = allAssignments.filter((a) => {
    if (!a.isCurrent || a.status !== 'ACTIVE') return false;
    return a.resource.currentAssigneeId !== a.employeeId;
  });

  // 6. Returned or transferred assignments still marked current
  const closedStillCurrent = allAssignments.filter(
    (a) => (a.status === 'RETURNED' || a.status === 'TRANSFERRED') && a.isCurrent
  );

  console.log('--- 1. Resources with stale currentAssigneeId ---');
  console.log(`Count: ${staleCurrentAssignee.length}`);
  staleCurrentAssignee.forEach((r) => {
    console.log(`  - [${r.itemCode}] "${r.name}" (status: ${r.status}) Assignee: ${r.currentAssignee?.name} (${r.currentAssignee?.employeeId})`);
  });

  console.log('\n--- 2. Resources with status ASSIGNED but no active assignment ---');
  console.log(`Count: ${assignedNoActive.length}`);
  assignedNoActive.forEach((r) => {
    console.log(`  - [${r.itemCode}] "${r.name}" (assignee: ${r.currentAssignee?.name})`);
  });

  console.log('\n--- 3. Active assignments whose resource status is not ASSIGNED ---');
  console.log(`Count: ${activeAsgnResourceNotAssigned.length}`);
  activeAsgnResourceNotAssigned.forEach((a) => {
    console.log(`  - [${a.assignmentNumber}] Resource: [${a.resource.itemCode}] Status: ${a.resource.status} Custodian: ${a.employee.name}`);
  });

  console.log('\n--- 4. Multiple active assignments for the same resource ---');
  console.log(`Count: ${multipleActive.length}`);

  console.log('\n--- 5. Active assignments that disagree with currentAssigneeId ---');
  console.log(`Count: ${activeDisagreeWithAssignee.length}`);
  activeDisagreeWithAssignee.forEach((a) => {
    console.log(`  - [${a.assignmentNumber}] Resource: [${a.resource.itemCode}] AssigneeId: ${a.resource.currentAssigneeId} vs AsgnEmp: ${a.employeeId}`);
  });

  console.log('\n--- 6. Returned or transferred assignments still marked current ---');
  console.log(`Count: ${closedStillCurrent.length}`);

  // REPAIR RELIABLE RECORDS
  console.log('\n================================================================');
  console.log('REPAIRING RECORDS WHERE STATE IS RELIABLY ESTABLISHED FROM HISTORY');
  console.log('================================================================');

  // 1. Repair EEC-CUSTODY-TEST-04: Returned assignment ASN-TEST-CUSTODY-04 exists
  const res04 = await prisma.resource.findUnique({
    where: { itemCode: 'EEC-CUSTODY-TEST-04' },
    include: { assignments: true },
  });
  if (res04 && res04.assignments.some((a) => a.status === 'RETURNED')) {
    await prisma.resource.update({
      where: { id: res04.id },
      data: {
        status: 'AVAILABLE',
        currentAssigneeId: null,
      },
    });
    console.log('✓ Repaired EEC-CUSTODY-TEST-04: Updated status to AVAILABLE and cleared stale currentAssigneeId based on RETURNED assignment history.');
  }

  // 2. Repair EEC-CUSTODY-TEST-02: Unassigned equipment with 0 assignments
  const res02 = await prisma.resource.findUnique({
    where: { itemCode: 'EEC-CUSTODY-TEST-02' },
    include: { assignments: true },
  });
  if (res02 && res02.assignments.length === 0 && res02.status === 'ASSIGNED') {
    await prisma.resource.update({
      where: { id: res02.id },
      data: {
        status: 'AVAILABLE',
        currentAssigneeId: null,
      },
    });
    console.log('✓ Repaired EEC-CUSTODY-TEST-02: Updated status to AVAILABLE and cleared stale currentAssigneeId (unassigned asset with 0 assignments).');
  }

  // 3. Repair EEC-CUSTODY-TEST-05: Unassigned equipment with 0 assignments
  const res05 = await prisma.resource.findUnique({
    where: { itemCode: 'EEC-CUSTODY-TEST-05' },
    include: { assignments: true },
  });
  if (res05 && res05.assignments.length === 0 && res05.status === 'ASSIGNED') {
    await prisma.resource.update({
      where: { id: res05.id },
      data: {
        status: 'AVAILABLE',
        currentAssigneeId: null,
      },
    });
    console.log('✓ Repaired EEC-CUSTODY-TEST-05: Updated status to AVAILABLE and cleared stale currentAssigneeId (no assignment record).');
  }

  // 4. Clean up ephemeral test records with prefix TEST-RES- and 0 assignments
  const testResToDelete = await prisma.resource.findMany({
    where: {
      itemCode: { startsWith: 'TEST-RES-' },
      assignments: { none: {} },
    },
  });
  for (const tr of testResToDelete) {
    await prisma.auditEvent.deleteMany({ where: { resourceId: tr.id } });
    await prisma.resource.delete({ where: { id: tr.id } });
    console.log(`✓ Cleaned up abandoned test resource: [${tr.itemCode}] "${tr.name}"`);
  }

  console.log('\nData integrity check and reliable repairs completed.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});

