-- CreateEnum
CREATE TYPE "AuthCodeChannel" AS ENUM ('SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "AuthCodePurpose" AS ENUM ('LOGIN_OR_REGISTER', 'PHONE_BIND', 'EMAIL_VERIFY', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "users"
ADD COLUMN "phone_verified_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "accounts"
ADD COLUMN "provider_app_id" TEXT,
ADD COLUMN "union_id" TEXT,
ADD COLUMN "open_id" TEXT,
ADD COLUMN "profile_raw" JSONB,
ADD COLUMN "last_login_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "teacher_profiles"
ALTER COLUMN "employment_type" DROP NOT NULL;

-- AlterTable
ALTER TABLE "student_profiles"
ALTER COLUMN "grade_level" DROP NOT NULL;

-- CreateTable
CREATE TABLE "auth_verification_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "channel" "AuthCodeChannel" NOT NULL,
    "purpose" "AuthCodePurpose" NOT NULL,
    "target" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounts_provider_union_id_idx" ON "accounts"("provider", "union_id");

-- CreateIndex
CREATE INDEX "accounts_provider_open_id_idx" ON "accounts"("provider", "open_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_union_id_key" ON "accounts"("provider", "union_id") WHERE "union_id" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_open_id_key" ON "accounts"("provider", "open_id") WHERE "open_id" IS NOT NULL;

-- CreateIndex
CREATE INDEX "auth_verification_codes_channel_purpose_target_sent_at_idx" ON "auth_verification_codes"("channel", "purpose", "target", "sent_at");

-- CreateIndex
CREATE INDEX "auth_verification_codes_target_consumed_at_expires_at_idx" ON "auth_verification_codes"("target", "consumed_at", "expires_at");

-- CreateIndex
CREATE INDEX "auth_verification_codes_user_id_purpose_idx" ON "auth_verification_codes"("user_id", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_single_primary_per_user_idx" ON "user_roles"("user_id") WHERE "is_primary" = true;

-- AddForeignKey
ALTER TABLE "auth_verification_codes"
ADD CONSTRAINT "auth_verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
