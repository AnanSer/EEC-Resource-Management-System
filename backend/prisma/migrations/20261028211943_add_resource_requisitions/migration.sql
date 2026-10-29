-- CreateTable
CREATE TABLE "resource_requisitions" (
    "id" TEXT NOT NULL,
    "requisitionNumber" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterRole" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "employeeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "itemDescription" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'ROUTINE',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requiredDate" TIMESTAMP(3),
    "isDirectAllocation" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalComments" TEXT,
    "rejectionReason" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "fulfilledResourceId" TEXT,
    "fulfilledAssignmentId" TEXT,
    "fulfilledById" TEXT,
    "fulfilledByName" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "handoverNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resource_requisitions_requisitionNumber_key" ON "resource_requisitions"("requisitionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "resource_requisitions_fulfilledAssignmentId_key" ON "resource_requisitions"("fulfilledAssignmentId");

-- CreateIndex
CREATE INDEX "resource_requisitions_employeeId_idx" ON "resource_requisitions"("employeeId");

-- CreateIndex
CREATE INDEX "resource_requisitions_departmentId_idx" ON "resource_requisitions"("departmentId");

-- CreateIndex
CREATE INDEX "resource_requisitions_status_idx" ON "resource_requisitions"("status");

-- CreateIndex
CREATE INDEX "resource_requisitions_category_idx" ON "resource_requisitions"("category");

-- AddForeignKey
ALTER TABLE "resource_requisitions" ADD CONSTRAINT "resource_requisitions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_requisitions" ADD CONSTRAINT "resource_requisitions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_requisitions" ADD CONSTRAINT "resource_requisitions_fulfilledResourceId_fkey" FOREIGN KEY ("fulfilledResourceId") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_requisitions" ADD CONSTRAINT "resource_requisitions_fulfilledAssignmentId_fkey" FOREIGN KEY ("fulfilledAssignmentId") REFERENCES "resource_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
