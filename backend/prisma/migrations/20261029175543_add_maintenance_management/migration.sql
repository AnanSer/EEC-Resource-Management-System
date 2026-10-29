-- CreateTable
CREATE TABLE "maintenance_requests" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "reportedByName" TEXT NOT NULL,
    "reportedByRole" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "assignedTechnicianId" TEXT,
    "assignedTechnicianName" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "reportedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewComments" TEXT,
    "rejectionReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "diagnosis" TEXT,
    "repairActions" TEXT,
    "partsReplaced" TEXT,
    "estimatedCostETB" DOUBLE PRECISION,
    "actualCostETB" DOUBLE PRECISION,
    "resolutionNotes" TEXT,
    "outcome" TEXT,
    "custodyAction" TEXT,
    "custodianIdAtRequest" TEXT,
    "custodianNameAtRequest" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_logs" (
    "id" TEXT NOT NULL,
    "maintenanceRequestId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_inspections" (
    "id" TEXT NOT NULL,
    "maintenanceRequestId" TEXT,
    "resourceId" TEXT NOT NULL,
    "inspectionType" TEXT NOT NULL DEFAULT 'MAINTENANCE_QA',
    "passed" BOOLEAN NOT NULL,
    "findings" TEXT NOT NULL,
    "conductedById" TEXT,
    "conductedByName" TEXT NOT NULL,
    "certificationNumber" TEXT,
    "remarks" TEXT,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_requests_requestNumber_key" ON "maintenance_requests"("requestNumber");

-- CreateIndex
CREATE INDEX "maintenance_requests_resourceId_idx" ON "maintenance_requests"("resourceId");

-- CreateIndex
CREATE INDEX "maintenance_requests_departmentId_idx" ON "maintenance_requests"("departmentId");

-- CreateIndex
CREATE INDEX "maintenance_requests_status_idx" ON "maintenance_requests"("status");

-- CreateIndex
CREATE INDEX "maintenance_requests_priority_idx" ON "maintenance_requests"("priority");

-- CreateIndex
CREATE INDEX "maintenance_requests_reportedById_idx" ON "maintenance_requests"("reportedById");

-- CreateIndex
CREATE INDEX "maintenance_requests_assignedTechnicianId_idx" ON "maintenance_requests"("assignedTechnicianId");

-- CreateIndex
CREATE INDEX "maintenance_logs_maintenanceRequestId_idx" ON "maintenance_logs"("maintenanceRequestId");

-- CreateIndex
CREATE INDEX "maintenance_inspections_maintenanceRequestId_idx" ON "maintenance_inspections"("maintenanceRequestId");

-- CreateIndex
CREATE INDEX "maintenance_inspections_resourceId_idx" ON "maintenance_inspections"("resourceId");

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_maintenanceRequestId_fkey" FOREIGN KEY ("maintenanceRequestId") REFERENCES "maintenance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_inspections" ADD CONSTRAINT "maintenance_inspections_maintenanceRequestId_fkey" FOREIGN KEY ("maintenanceRequestId") REFERENCES "maintenance_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_inspections" ADD CONSTRAINT "maintenance_inspections_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
