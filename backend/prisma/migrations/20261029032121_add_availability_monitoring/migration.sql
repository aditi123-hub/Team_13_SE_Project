-- CreateTable
CREATE TABLE "AvailabilityCheck" (
    "id" SERIAL NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isHealthy" BOOLEAN NOT NULL,
    "responseTimeMs" INTEGER,
    "statusCode" INTEGER,

    CONSTRAINT "AvailabilityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityIncident" (
    "id" SERIAL NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recoveredAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilityIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledMaintenance" (
    "id" SERIAL NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvailabilityCheck_checkedAt_idx" ON "AvailabilityCheck"("checkedAt");

-- CreateIndex
CREATE INDEX "AvailabilityCheck_isHealthy_checkedAt_idx" ON "AvailabilityCheck"("isHealthy", "checkedAt");

-- CreateIndex
CREATE INDEX "AvailabilityIncident_startedAt_idx" ON "AvailabilityIncident"("startedAt");

-- CreateIndex
CREATE INDEX "AvailabilityIncident_recoveredAt_idx" ON "AvailabilityIncident"("recoveredAt");

-- CreateIndex
CREATE INDEX "ScheduledMaintenance_startAt_endAt_idx" ON "ScheduledMaintenance"("startAt", "endAt");
