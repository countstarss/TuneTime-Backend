-- CreateEnum
CREATE TYPE "CrmLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "CrmOpportunityStage" AS ENUM ('NEW', 'QUALIFIED', 'TRIAL_SCHEDULED', 'TRIAL_COMPLETED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "CrmTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CrmTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "CrmActivityType" AS ENUM ('NOTE', 'CALL', 'WECHAT', 'FOLLOW_UP', 'SYSTEM');

-- CreateTable
CREATE TABLE "crm_leads" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "wechat" TEXT,
    "city" TEXT,
    "source" TEXT,
    "status" "CrmLeadStatus" NOT NULL DEFAULT 'NEW',
    "interest_subject_id" TEXT,
    "budget_min" DECIMAL(10,2),
    "budget_max" DECIMAL(10,2),
    "desired_start_date" DATE,
    "notes" TEXT,
    "tags" JSONB,
    "owner_user_id" TEXT,
    "converted_guardian_profile_id" TEXT,
    "converted_student_profile_id" TEXT,
    "last_contacted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_opportunities" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "lead_id" TEXT,
    "guardian_profile_id" TEXT,
    "student_profile_id" TEXT,
    "teacher_profile_id" TEXT,
    "subject_id" TEXT,
    "booking_id" TEXT,
    "stage" "CrmOpportunityStage" NOT NULL DEFAULT 'NEW',
    "owner_user_id" TEXT,
    "estimated_value" DECIMAL(12,2),
    "expected_booking_at" TIMESTAMP(3),
    "next_follow_up_at" TIMESTAMP(3),
    "summary" TEXT,
    "loss_reason" TEXT,
    "last_activity_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CrmTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "CrmTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "lead_id" TEXT,
    "opportunity_id" TEXT,
    "guardian_profile_id" TEXT,
    "booking_id" TEXT,
    "assignee_user_id" TEXT,
    "created_by_user_id" TEXT,
    "due_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_activities" (
    "id" TEXT NOT NULL,
    "type" "CrmActivityType" NOT NULL,
    "content" TEXT NOT NULL,
    "lead_id" TEXT,
    "opportunity_id" TEXT,
    "guardian_profile_id" TEXT,
    "booking_id" TEXT,
    "created_by_user_id" TEXT,
    "happened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_leads_status_created_at_idx" ON "crm_leads"("status", "created_at");

-- CreateIndex
CREATE INDEX "crm_leads_owner_user_id_status_idx" ON "crm_leads"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "crm_leads_phone_idx" ON "crm_leads"("phone");

-- CreateIndex
CREATE INDEX "crm_leads_city_idx" ON "crm_leads"("city");

-- CreateIndex
CREATE INDEX "crm_opportunities_stage_created_at_idx" ON "crm_opportunities"("stage", "created_at");

-- CreateIndex
CREATE INDEX "crm_opportunities_owner_user_id_stage_idx" ON "crm_opportunities"("owner_user_id", "stage");

-- CreateIndex
CREATE INDEX "crm_opportunities_lead_id_idx" ON "crm_opportunities"("lead_id");

-- CreateIndex
CREATE INDEX "crm_opportunities_guardian_profile_id_idx" ON "crm_opportunities"("guardian_profile_id");

-- CreateIndex
CREATE INDEX "crm_opportunities_booking_id_idx" ON "crm_opportunities"("booking_id");

-- CreateIndex
CREATE INDEX "crm_tasks_status_due_at_idx" ON "crm_tasks"("status", "due_at");

-- CreateIndex
CREATE INDEX "crm_tasks_assignee_user_id_status_idx" ON "crm_tasks"("assignee_user_id", "status");

-- CreateIndex
CREATE INDEX "crm_tasks_lead_id_idx" ON "crm_tasks"("lead_id");

-- CreateIndex
CREATE INDEX "crm_tasks_opportunity_id_idx" ON "crm_tasks"("opportunity_id");

-- CreateIndex
CREATE INDEX "crm_tasks_booking_id_idx" ON "crm_tasks"("booking_id");

-- CreateIndex
CREATE INDEX "crm_activities_type_happened_at_idx" ON "crm_activities"("type", "happened_at");

-- CreateIndex
CREATE INDEX "crm_activities_lead_id_happened_at_idx" ON "crm_activities"("lead_id", "happened_at");

-- CreateIndex
CREATE INDEX "crm_activities_opportunity_id_happened_at_idx" ON "crm_activities"("opportunity_id", "happened_at");

-- CreateIndex
CREATE INDEX "crm_activities_booking_id_happened_at_idx" ON "crm_activities"("booking_id", "happened_at");

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
