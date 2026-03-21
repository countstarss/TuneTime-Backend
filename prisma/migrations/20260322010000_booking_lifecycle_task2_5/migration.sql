-- CreateEnum
CREATE TYPE "BookingHoldStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RescheduleRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "status_remark" TEXT;

-- CreateTable
CREATE TABLE "booking_holds" (
    "id" TEXT NOT NULL,
    "teacher_profile_id" TEXT NOT NULL,
    "student_profile_id" TEXT NOT NULL,
    "guardian_profile_id" TEXT,
    "subject_id" TEXT NOT NULL,
    "service_address_id" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "status" "BookingHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reschedule_requests" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "initiator_role" "PlatformRole" NOT NULL,
    "initiator_user_id" TEXT NOT NULL,
    "proposed_start_at" TIMESTAMP(3) NOT NULL,
    "proposed_end_at" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "RescheduleRequestStatus" NOT NULL DEFAULT 'PENDING',
    "responded_at" TIMESTAMP(3),
    "responded_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reschedule_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_holds_teacher_profile_id_start_at_end_at_status_idx" ON "booking_holds"("teacher_profile_id", "start_at", "end_at", "status");

-- CreateIndex
CREATE INDEX "booking_holds_created_by_user_id_status_expires_at_idx" ON "booking_holds"("created_by_user_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "booking_holds_guardian_profile_id_status_idx" ON "booking_holds"("guardian_profile_id", "status");

-- CreateIndex
CREATE INDEX "reschedule_requests_booking_id_status_created_at_idx" ON "reschedule_requests"("booking_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "reschedule_requests_initiator_user_id_status_created_at_idx" ON "reschedule_requests"("initiator_user_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
