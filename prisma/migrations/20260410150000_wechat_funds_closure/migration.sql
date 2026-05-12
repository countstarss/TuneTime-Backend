CREATE TYPE "PaymentRefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

CREATE TYPE "ReconciliationRunType" AS ENUM ('WECHAT_TRADE_BILL', 'WECHAT_REFUND_BILL');

CREATE TYPE "ReconciliationRunStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

CREATE TYPE "ReconciliationDifferenceType" AS ENUM ('MISSING_LOCAL', 'MISSING_PROVIDER', 'AMOUNT_MISMATCH', 'STATUS_MISMATCH', 'HASH_MISMATCH', 'PARSE_ERROR');

CREATE TYPE "ReconciliationDifferenceStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

ALTER TABLE "payouts"
ADD COLUMN "out_bill_no" TEXT,
ADD COLUMN "transfer_bill_no" TEXT,
ADD COLUMN "transfer_state" TEXT,
ADD COLUMN "package_info" TEXT,
ADD COLUMN "provider_metadata" JSONB;

CREATE TABLE "payment_refunds" (
    "id" TEXT NOT NULL,
    "payment_intent_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "out_refund_no" TEXT NOT NULL,
    "provider_refund_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'CNY',
    "status" "PaymentRefundStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "failure_reason" TEXT,
    "requested_by_user_id" TEXT,
    "provider_metadata" JSONB,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reconciliation_runs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "run_type" "ReconciliationRunType" NOT NULL,
    "bill_date" DATE NOT NULL,
    "status" "ReconciliationRunStatus" NOT NULL DEFAULT 'PENDING',
    "hash_type" TEXT,
    "hash_value" TEXT,
    "download_url" TEXT,
    "failure_reason" TEXT,
    "metadata" JSONB,
    "created_by_user_id" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconciliation_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reconciliation_differences" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "difference_type" "ReconciliationDifferenceType" NOT NULL,
    "status" "ReconciliationDifferenceStatus" NOT NULL DEFAULT 'OPEN',
    "reference_type" TEXT NOT NULL,
    "reference_id" TEXT,
    "summary" TEXT NOT NULL,
    "local_payload" JSONB,
    "provider_payload" JSONB,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconciliation_differences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_refunds_out_refund_no_key" ON "payment_refunds"("out_refund_no");
CREATE UNIQUE INDEX "payment_refunds_provider_refund_id_key" ON "payment_refunds"("provider_refund_id");
CREATE INDEX "payment_refunds_payment_intent_id_status_idx" ON "payment_refunds"("payment_intent_id", "status");
CREATE INDEX "payment_refunds_booking_id_status_idx" ON "payment_refunds"("booking_id", "status");
CREATE INDEX "payment_refunds_status_requested_at_idx" ON "payment_refunds"("status", "requested_at");

CREATE UNIQUE INDEX "payouts_out_bill_no_key" ON "payouts"("out_bill_no");
CREATE UNIQUE INDEX "payouts_transfer_bill_no_key" ON "payouts"("transfer_bill_no");

CREATE UNIQUE INDEX "wallet_transactions_wallet_id_booking_id_type_key" ON "wallet_transactions"("wallet_id", "booking_id", "type");

CREATE UNIQUE INDEX "reconciliation_runs_provider_run_type_bill_date_key" ON "reconciliation_runs"("provider", "run_type", "bill_date");
CREATE INDEX "reconciliation_runs_status_bill_date_idx" ON "reconciliation_runs"("status", "bill_date");

CREATE INDEX "reconciliation_differences_run_id_status_idx" ON "reconciliation_differences"("run_id", "status");
CREATE INDEX "reconciliation_differences_reference_type_reference_id_idx" ON "reconciliation_differences"("reference_type", "reference_id");

ALTER TABLE "payment_refunds"
ADD CONSTRAINT "payment_refunds_payment_intent_id_fkey"
FOREIGN KEY ("payment_intent_id") REFERENCES "payment_intents"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_refunds"
ADD CONSTRAINT "payment_refunds_booking_id_fkey"
FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_refunds"
ADD CONSTRAINT "payment_refunds_requested_by_user_id_fkey"
FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reconciliation_runs"
ADD CONSTRAINT "reconciliation_runs_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reconciliation_differences"
ADD CONSTRAINT "reconciliation_differences_run_id_fkey"
FOREIGN KEY ("run_id") REFERENCES "reconciliation_runs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
