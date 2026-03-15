-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'PENDING_ACCEPTANCE';

-- AlterEnum
ALTER TYPE "CredentialType" ADD VALUE 'NO_CRIMINAL_RECORD';

-- AlterTable
ALTER TABLE "teacher_profiles" ADD COLUMN     "agreement_accepted_at" TIMESTAMP(3),
ADD COLUMN     "agreement_version" TEXT,
ADD COLUMN     "interview_notes" TEXT,
ADD COLUMN     "interviewed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "date_of_birth" DATE,
ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "guardian_confirmed_at" TIMESTAMP(3),
ADD COLUMN     "is_trial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "plan_summary" TEXT,
ADD COLUMN     "teacher_accepted_at" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'PENDING_ACCEPTANCE';

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "check_in_address" TEXT,
ADD COLUMN     "check_in_at" TIMESTAMP(3),
ADD COLUMN     "check_in_latitude" DECIMAL(10,7),
ADD COLUMN     "check_in_longitude" DECIMAL(10,7),
ADD COLUMN     "check_out_address" TEXT,
ADD COLUMN     "check_out_at" TIMESTAMP(3),
ADD COLUMN     "check_out_latitude" DECIMAL(10,7),
ADD COLUMN     "check_out_longitude" DECIMAL(10,7),
ADD COLUMN     "feedback_submitted_at" TIMESTAMP(3),
ADD COLUMN     "outcome_video_url" TEXT;

-- AlterTable
ALTER TABLE "teacher_reviews" ADD COLUMN     "improvement_notes" TEXT,
ADD COLUMN     "lesson_quality_rating" INTEGER,
ADD COLUMN     "teacher_performance_rating" INTEGER;

