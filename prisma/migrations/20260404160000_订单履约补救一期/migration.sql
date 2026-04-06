-- CreateEnum
CREATE TYPE "BookingCompletionStatus" AS ENUM ('PENDING_TEACHER_RECORD', 'PENDING_GUARDIAN_CONFIRM', 'GUARDIAN_CONFIRMED', 'AUTO_CONFIRMED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "BookingExceptionStatus" AS ENUM ('NONE', 'OPEN', 'BLOCKING');

-- CreateEnum
CREATE TYPE "SettlementReadiness" AS ENUM ('NOT_READY', 'READY', 'BLOCKED');

-- CreateEnum
CREATE TYPE "BookingExceptionType" AS ENUM ('PAYMENT_MISMATCH', 'OVERDUE_NOT_STARTED', 'OVERDUE_NOT_FINISHED', 'ARRIVAL_DISPUTE', 'NO_FEEDBACK', 'LESSON_QUALITY_DISPUTE', 'DURATION_DISPUTE', 'MANUAL_REPAIR_REQUIRED');

-- CreateEnum
CREATE TYPE "ResponsibilityType" AS ENUM ('TEACHER', 'GUARDIAN', 'PLATFORM', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BookingExceptionCaseStatus" AS ENUM ('OPEN', 'WAITING_TEACHER', 'WAITING_GUARDIAN', 'WAITING_ADMIN', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LessonEvidenceType" AS ENUM ('ARRIVAL_PHOTO', 'ARRIVAL_VIDEO', 'RESULT_PHOTO', 'RESULT_VIDEO', 'OTHER');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "completion_confirmed_at" TIMESTAMP(3),
ADD COLUMN     "completion_status" "BookingCompletionStatus" NOT NULL DEFAULT 'PENDING_TEACHER_RECORD',
ADD COLUMN     "exception_status" "BookingExceptionStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "settlement_readiness" "SettlementReadiness" NOT NULL DEFAULT 'NOT_READY';

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "arrival_address" TEXT,
ADD COLUMN     "arrival_confirmed_at" TIMESTAMP(3),
ADD COLUMN     "arrival_latitude" DECIMAL(10,7),
ADD COLUMN     "arrival_longitude" DECIMAL(10,7),
ADD COLUMN     "arrival_note" TEXT;

-- CreateTable
CREATE TABLE "booking_exception_cases" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "exception_type" "BookingExceptionType" NOT NULL,
    "status" "BookingExceptionCaseStatus" NOT NULL DEFAULT 'OPEN',
    "responsibility_type" "ResponsibilityType" NOT NULL DEFAULT 'UNKNOWN',
    "summary" TEXT NOT NULL,
    "resolution" TEXT,
    "metadata" JSONB,
    "created_by_user_id" TEXT,
    "resolved_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_exception_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_evidences" (
    "id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "type" "LessonEvidenceType" NOT NULL,
    "url" TEXT NOT NULL,
    "note" TEXT,
    "uploaded_by_user_id" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_exception_cases_status_created_at_idx" ON "booking_exception_cases"("status", "created_at");

-- CreateIndex
CREATE INDEX "booking_exception_cases_responsibility_type_status_idx" ON "booking_exception_cases"("responsibility_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "booking_exception_cases_booking_id_exception_type_key" ON "booking_exception_cases"("booking_id", "exception_type");

-- CreateIndex
CREATE INDEX "lesson_evidences_lesson_id_type_uploaded_at_idx" ON "lesson_evidences"("lesson_id", "type", "uploaded_at");

-- CreateIndex
CREATE INDEX "lesson_evidences_uploaded_by_user_id_uploaded_at_idx" ON "lesson_evidences"("uploaded_by_user_id", "uploaded_at");

-- AddForeignKey
ALTER TABLE "booking_exception_cases" ADD CONSTRAINT "booking_exception_cases_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_evidences" ADD CONSTRAINT "lesson_evidences_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

