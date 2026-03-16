-- CreateEnum
CREATE TYPE "CrmCaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CrmCasePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "CrmCaseCategory" AS ENUM ('SCHEDULE_CHANGE', 'COMPLAINT', 'REFUND', 'TEACHER_CHANGE', 'PAYMENT', 'OTHER');

-- CreateTable
CREATE TABLE "crm_cases" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "CrmCaseCategory" NOT NULL,
    "status" "CrmCaseStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "CrmCasePriority" NOT NULL DEFAULT 'MEDIUM',
    "lead_id" TEXT,
    "opportunity_id" TEXT,
    "guardian_profile_id" TEXT,
    "student_profile_id" TEXT,
    "teacher_profile_id" TEXT,
    "booking_id" TEXT,
    "owner_user_id" TEXT,
    "created_by_user_id" TEXT,
    "resolution_summary" TEXT,
    "next_action_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_cases_status_priority_created_at_idx" ON "crm_cases"("status", "priority", "created_at");

-- CreateIndex
CREATE INDEX "crm_cases_owner_user_id_status_idx" ON "crm_cases"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "crm_cases_guardian_profile_id_status_idx" ON "crm_cases"("guardian_profile_id", "status");

-- CreateIndex
CREATE INDEX "crm_cases_booking_id_status_idx" ON "crm_cases"("booking_id", "status");

-- CreateIndex
CREATE INDEX "crm_cases_lead_id_idx" ON "crm_cases"("lead_id");

-- CreateIndex
CREATE INDEX "crm_cases_opportunity_id_idx" ON "crm_cases"("opportunity_id");
-- AddForeignKey
ALTER TABLE "crm_cases" ADD CONSTRAINT "crm_cases_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_cases" ADD CONSTRAINT "crm_cases_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
