-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "resourceId" TEXT,
    "resourceName" TEXT,
    "resourceCode" TEXT,
    "resourceCategory" TEXT,
    "departmentId" TEXT,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "referenceId" TEXT,
    "details" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_events_resourceId_idx" ON "audit_events"("resourceId");

-- CreateIndex
CREATE INDEX "audit_events_departmentId_idx" ON "audit_events"("departmentId");

-- CreateIndex
CREATE INDEX "audit_events_actorId_idx" ON "audit_events"("actorId");

-- CreateIndex
CREATE INDEX "audit_events_actionType_idx" ON "audit_events"("actionType");

-- CreateIndex
CREATE INDEX "audit_events_timestamp_idx" ON "audit_events"("timestamp");

-- CreateIndex
CREATE INDEX "audit_events_referenceId_idx" ON "audit_events"("referenceId");

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
