# AGENTS.md

This file is the handoff guide for coding agents working in this repository.
Read it before changing code, then use the referenced source files as the
source of truth.

## Project Snapshot

TuneTime Backend is a NestJS 10 API for an in-home music tutor marketplace.
It serves guardian/student clients, teacher clients, and admin operations.

Core stack:

- NestJS 10 with controller/service modules
- Prisma 7 with PostgreSQL, currently documented for Supabase
- Custom JWT auth via `jose`
- Swagger at `/docs`
- Jest unit tests

The application entrypoints are:

- `src/main.ts`: app bootstrap, validation pipe, CORS, Swagger, port `5678`
- `src/app.module.ts`: root module wiring and global `FeatureGateGuard`
- `src/app.controller.ts`: smoke check and `GET /system/capabilities`

## First Files To Read

For a new task, skim these in order:

1. `docs/V1_MVP_边界.md`
2. `docs/项目总览.md`
3. `src/common/mvp-capabilities.ts`
4. `src/app.module.ts`
5. `prisma/schema.prisma`
6. The controller and service for the feature you are touching

If docs and code disagree, trust the code and `GET /system/capabilities`.
Some docs are written as planning/hand-off notes and may lag recent feature
flags.

## Runtime Boundaries

The repository keeps more code than the current MVP exposes. Runtime access is
controlled by capability flags in `src/common/mvp-capabilities.ts` and enforced
by the global `FeatureGateGuard`.

Important rules:

- Do not bypass `@RequireCapability(...)`.
- Do not expose a post-MVP route by accident.
- Use `GET /system/capabilities` as the frontend-facing runtime contract.
- If enabling a capability, update docs and tests that describe the MVP surface.
- The `payment` capability can be overridden by `PAYMENT_ENABLED`.

Current code also contains modules for payments, refunds, wallet settlement,
payouts, lesson evidence, disputes, and lifecycle automation. They may be more
complete than the public MVP surface.

## Module Map

- `auth/`: SMS, email/password, WeChat login, JWT issuing/verification, role
  switching, phone/email binding, onboarding, real-name verification.
- `common/`: feature gate, capability list, decorators, MVP helpers.
- `prisma/`: Prisma service and database client setup.
- `subjects/`: subject dictionary.
- `teachers/`: admin-side teacher profile/resource management.
- `teacher-availability/`: public teacher discovery, availability windows,
  teacher self-service weekly rules, blocks, and extra slots.
- `teacher-workbench/`: teacher pending booking list/detail.
- `guardians/`, `students/`, `addresses/`: admin CRUD and profile data.
- `bookings/`: booking holds, booking creation, teacher acceptance, payment
  projection hooks, cancellation, reschedule, disputes, manual repair.
- `lessons/`: lesson records, check-in/check-out, attendance, feedback, evidence.
- `teacher-reviews/`: review CRUD and teacher rating summaries.
- `payments/`: WeChat JSAPI payment, provider callbacks, refunds, wallet
  transactions, payouts, reconciliation, payment lifecycle sweep.
- `calendar/`: role-aware personal calendar projection.
- `test-support/`: QA scenario reset and mock helpers.

## Main Business Flow

The primary marketplace flow is:

```text
login/register
-> create User + UserRole + role profile
-> teacher/guardian onboarding
-> teacher availability/discovery
-> guardian creates BookingHold
-> guardian creates Booking from hold
-> teacher accepts in workbench
-> payment intent is prepared
-> WeChat callback or reconcile applies payment state
-> Lesson is created/upserted after payment success
-> lesson check-in/check-out and feedback
-> completion/settlement/payout paths
```

The central booking state is `BookingStatus`, but production behavior also
depends on `PaymentStatus`, `BookingCompletionStatus`,
`BookingExceptionStatus`, and `SettlementReadiness`.

## High-Complexity Files

Be extra careful in these files:

- `src/bookings/bookings.service.ts`: largest state machine; many business
  invariants meet here.
- `src/auth/auth.service.ts`: profile snapshots, onboarding readiness, auth
  response shape.
- `src/teacher-availability/teacher-availability.service.ts`: availability
  generation from weekly rules, extra slots, blocks, bookings, and holds.
- `src/payments/payments.service.ts`: WeChat payment preparation, callback, and
  reconciliation.
- `src/payments/funds.service.ts`: refunds, teacher wallet settlement, payouts,
  reconciliation.
- `src/payments/booking-payment-projector.service.ts`: maps payment intent
  status to booking and lesson changes.
- `src/payments/wechat-pay.client.ts`: provider signing, verification, and API
  payload handling.

## Database Notes

Prisma schema lives in `prisma/schema.prisma`.

Migrations are in `prisma/migrations/`. Prisma 7 configuration lives in
`prisma.config.ts`; migrations use `DIRECT_URL`. The application runtime
Prisma client in `src/prisma/prisma.service.ts` requires `DATABASE_URL`.

Before changing schema:

- Prefer migrations over direct `db push` for durable work.
- Update DTOs, service includes/selects, tests, and seed data if the shape
  changes.
- Watch for enum values used in state-machine logic.

## Auth And Roles

JWT verification is in `src/auth/supabase-auth.guard.ts` and `src/auth/verify-jwt.ts`.
Despite the guard name, auth is custom JWT and does not depend on Supabase Auth.

Role access is active-role based:

- Token payload can contain `activeRole`.
- `JwtAuthGuard` resolves the user's roles from the database.
- `RolesGuard` checks `@RequireRoles(...)` against the active role.

Public self-registration/role bootstrapping is only for `TEACHER`, `GUARDIAN`,
and `STUDENT`. Admin roles must already exist.

## Coding Conventions

- Follow existing Nest module patterns: controller delegates, service owns
  business rules, DTOs define request/response shape.
- Use Prisma structured queries and transactions instead of ad hoc SQL unless a
  migration requires SQL.
- Keep feature changes inside the relevant domain module.
- Preserve capability guards and role guards on new routes.
- Prefer small, explicit helpers in large services; avoid broad refactors mixed
  with behavior changes.
- Error messages are often Chinese because the client-facing API is Chinese.

## Test And Verification Commands

Common commands:

```bash
pnpm prisma:validate
pnpm prisma:generate
pnpm test
pnpm test -- <name>.spec.ts
pnpm build
```

Useful local startup:

```bash
pnpm start:dev
```

Swagger should be available at:

```text
http://localhost:5678/docs
```

If Prisma CLI has local Node/ESM issues, check `README.md` for the Node 22
fallback commands.

## Git Hygiene For Agents

This repository may have user or previous-agent changes already present.

- Always run `git status --short --branch` before editing.
- Do not revert or stage unrelated changes.
- When asked to commit, stage only files you intentionally changed.
- If a task touches files with existing uncommitted edits, inspect them and work
  with the current content.

## Quick Task Routing

- Auth, login, token, role, onboarding: start in `src/auth/`.
- Booking holds, order state, teacher acceptance: start in `src/bookings/`.
- Teacher listing or time windows: start in `src/teacher-availability/`.
- Teacher pending order UI data: start in `src/teacher-workbench/`.
- WeChat payment or payment state: start in `src/payments/`.
- Lesson attendance or feedback: start in `src/lessons/`.
- Schema changes: start in `prisma/schema.prisma`, then update services/tests.

