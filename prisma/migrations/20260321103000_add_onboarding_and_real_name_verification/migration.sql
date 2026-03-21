ALTER TABLE "users"
  ADD COLUMN "real_name_verified_at" TIMESTAMP(3),
  ADD COLUMN "real_name_provider" TEXT,
  ADD COLUMN "real_name_verified_name" TEXT,
  ADD COLUMN "real_name_id_number_masked" TEXT;

ALTER TABLE "guardian_profiles"
  ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);

ALTER TABLE "student_profiles"
  ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);

CREATE TABLE "real_name_verification_sessions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "ticket" TEXT,
  "start_url" TEXT,
  "result_payload" JSONB,
  "verified_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "real_name_verification_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "real_name_verification_sessions_ticket_key"
  ON "real_name_verification_sessions"("ticket");

CREATE INDEX "real_name_verification_sessions_user_id_status_idx"
  ON "real_name_verification_sessions"("user_id", "status");

ALTER TABLE "real_name_verification_sessions"
  ADD CONSTRAINT "real_name_verification_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
