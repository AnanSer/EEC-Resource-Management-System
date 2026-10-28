-- CreateTable
CREATE TABLE "resources" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "description" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "location" TEXT NOT NULL DEFAULT 'Central Store - Kersa',
    "departmentId" TEXT NOT NULL,
    "currentAssigneeId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "purchaseDate" TIMESTAMP(3),
    "purchaseCostETB" DOUBLE PRECISION,
    "currentValueETB" DOUBLE PRECISION,
    "warrantyExpiry" TIMESTAMP(3),
    "supplier" TEXT,
    "notes" TEXT,
    "specs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resources_itemCode_key" ON "resources"("itemCode");

-- CreateIndex
CREATE INDEX "resources_departmentId_idx" ON "resources"("departmentId");

-- CreateIndex
CREATE INDEX "resources_category_idx" ON "resources"("category");

-- CreateIndex
CREATE INDEX "resources_status_idx" ON "resources"("status");

-- CreateIndex
CREATE INDEX "resources_itemCode_idx" ON "resources"("itemCode");

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_currentAssigneeId_fkey" FOREIGN KEY ("currentAssigneeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
