-- CreateTable
CREATE TABLE "resource_assignments" (
    "id" TEXT NOT NULL,
    "assignmentNumber" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "assignedByName" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturnDate" TIMESTAMP(3),
    "purpose" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "returnedAt" TIMESTAMP(3),
    "returnCondition" TEXT,
    "returnLocation" TEXT,
    "returnNotes" TEXT,
    "returnReceivedByName" TEXT,
    "returnReceivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custody_transfers" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "fromAssignmentId" TEXT,
    "toAssignmentId" TEXT,
    "fromEmployeeId" TEXT NOT NULL,
    "toEmployeeId" TEXT NOT NULL,
    "fromDepartmentId" TEXT NOT NULL,
    "toDepartmentId" TEXT NOT NULL,
    "transferredByName" TEXT NOT NULL,
    "transferredById" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custody_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resource_assignments_assignmentNumber_key" ON "resource_assignments"("assignmentNumber");

-- CreateIndex
CREATE INDEX "resource_assignments_resourceId_idx" ON "resource_assignments"("resourceId");

-- CreateIndex
CREATE INDEX "resource_assignments_employeeId_idx" ON "resource_assignments"("employeeId");

-- CreateIndex
CREATE INDEX "resource_assignments_departmentId_idx" ON "resource_assignments"("departmentId");

-- CreateIndex
CREATE INDEX "resource_assignments_status_idx" ON "resource_assignments"("status");

-- CreateIndex
CREATE INDEX "resource_assignments_isCurrent_idx" ON "resource_assignments"("isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "custody_transfers_transferNumber_key" ON "custody_transfers"("transferNumber");

-- CreateIndex
CREATE INDEX "custody_transfers_resourceId_idx" ON "custody_transfers"("resourceId");

-- CreateIndex
CREATE INDEX "custody_transfers_fromEmployeeId_idx" ON "custody_transfers"("fromEmployeeId");

-- CreateIndex
CREATE INDEX "custody_transfers_toEmployeeId_idx" ON "custody_transfers"("toEmployeeId");

-- AddForeignKey
ALTER TABLE "resource_assignments" ADD CONSTRAINT "resource_assignments_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_assignments" ADD CONSTRAINT "resource_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_assignments" ADD CONSTRAINT "resource_assignments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_transfers" ADD CONSTRAINT "custody_transfers_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_transfers" ADD CONSTRAINT "custody_transfers_fromAssignmentId_fkey" FOREIGN KEY ("fromAssignmentId") REFERENCES "resource_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_transfers" ADD CONSTRAINT "custody_transfers_toAssignmentId_fkey" FOREIGN KEY ("toAssignmentId") REFERENCES "resource_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_transfers" ADD CONSTRAINT "custody_transfers_fromEmployeeId_fkey" FOREIGN KEY ("fromEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_transfers" ADD CONSTRAINT "custody_transfers_toEmployeeId_fkey" FOREIGN KEY ("toEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_transfers" ADD CONSTRAINT "custody_transfers_fromDepartmentId_fkey" FOREIGN KEY ("fromDepartmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_transfers" ADD CONSTRAINT "custody_transfers_toDepartmentId_fkey" FOREIGN KEY ("toDepartmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
