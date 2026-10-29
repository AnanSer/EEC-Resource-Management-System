import prisma from '../src/lib/prisma';

async function main() {
  const inconsistent = await prisma.resource.findMany({
    where: {
      status: 'AVAILABLE',
      currentAssigneeId: { not: null },
    },
    include: {
      currentAssignee: true,
      department: true,
    },
  });

  console.log(`Found ${inconsistent.length} inconsistent resources.`);

  for (const res of inconsistent) {
    const existingActive = await prisma.resourceAssignment.findFirst({
      where: {
        resourceId: res.id,
        isCurrent: true,
      },
    });

    await prisma.$transaction(async (tx) => {
      await tx.resource.update({
        where: { id: res.id },
        data: {
          status: 'ASSIGNED',
          assignedAt: res.assignedAt || res.purchaseDate || new Date(),
        },
      });

      if (!existingActive && res.currentAssigneeId) {
        const count = await tx.resourceAssignment.count();
        const rand = Math.floor(1000 + Math.random() * 9000);
        const asgnNum = `ASGN-2026-${String(count + 1).padStart(4, '0')}-${rand}`;
        await tx.resourceAssignment.create({
          data: {
            assignmentNumber: asgnNum,
            resourceId: res.id,
            employeeId: res.currentAssigneeId,
            departmentId: res.departmentId,
            assignedByName: 'Chief Store Keeper (Initial Seed)',
            assignedAt: res.purchaseDate || new Date(),
            purpose: res.description || 'Assigned for operational project duties',
            status: 'ACTIVE',
            isCurrent: true,
          },
        });
        console.log(`Created active assignment ${asgnNum} for ${res.itemCode} to ${res.currentAssignee?.name}`);
      }
    });

    console.log(`Synchronized ${res.itemCode} to status ASSIGNED`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

