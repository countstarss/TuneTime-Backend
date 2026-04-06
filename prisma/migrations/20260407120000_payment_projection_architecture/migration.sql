ALTER TABLE "payment_intents"
ADD COLUMN "expires_at" TIMESTAMP(3),
ADD COLUMN "provider_prepay_id" TEXT,
ADD COLUMN "prepay_expires_at" TIMESTAMP(3),
ADD COLUMN "provider_metadata" JSONB,
ADD COLUMN "last_notified_at" TIMESTAMP(3);

CREATE TABLE "payment_provider_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "payment_intent_id" TEXT,
    "headers_digest" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "process_result" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_provider_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_provider_events_provider_event_id_key"
ON "payment_provider_events"("provider", "event_id");

CREATE INDEX "payment_provider_events_payment_intent_id_received_at_idx"
ON "payment_provider_events"("payment_intent_id", "received_at");

CREATE INDEX "payment_provider_events_provider_received_at_idx"
ON "payment_provider_events"("provider", "received_at");

ALTER TABLE "payment_provider_events"
ADD CONSTRAINT "payment_provider_events_payment_intent_id_fkey"
FOREIGN KEY ("payment_intent_id") REFERENCES "payment_intents"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
