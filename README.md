# TuneTime API

TuneTime 是一个「上门私教撮合平台」后端基础工程，面向三个客户端：

- Admin 管理后台
- 教师端
- 学生/家长端

核心场景：家长充值、学生约课、教师按可预约时间接单、平台统一结算与管理。

## 技术栈

- NestJS 10
- Prisma 7 + PostgreSQL (Supabase)
- 自定义 JWT 鉴权（兼容 auth.js 体系，不依赖 Supabase Auth）

## Supabase 连接规范（最新实践）

本项目采用 Prisma 7 推荐的配置方式：

- 连接 URL 不再放在 `schema.prisma`
- 迁移连接放在根目录 `prisma.config.ts` 的 `datasource.url`
- 应用运行连接通过 `PrismaClient({ adapter })` 注入

你当前项目采用的 Supabase Pooler 配置（已写入模板）：

```txt
DATABASE_URL=postgresql://postgres.nzilaxhnxufmcedichvj:[YOUR-PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.nzilaxhnxufmcedichvj:[YOUR-PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
```

`prisma.config.ts` 当前配置：

```ts
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  datasource: { url: env('DIRECT_URL') },
});
```

## 环境变量

先复制模板，再编辑根目录 `.env`：

```bash
cp .env.example .env
```

然后填写：

- `SUPABASE_DB_PASSWORD`：你的数据库密码
- `SUPABASE_DB_PASSWORD_ENCODED`：URL 编码后的数据库密码（密码含 `%`、`!` 等字符时必须）
- `SUPABASE_POOLER_HOST`：Supabase Dashboard 里复制的 Pooler host
- `DATABASE_URL`：应用运行时连接串（池化）
- `DIRECT_URL`：Prisma Migrate 使用的连接串
- `AUTH_JWT_SECRET` / `AUTH_JWKS_URL`：你自己的 JWT 验证配置

## 快速启动

```bash
pnpm install
pnpm prisma:format
pnpm prisma:validate
pnpm prisma:generate
pnpm prisma:push
pnpm start:dev
```

## 云端推送 Schema

开发阶段直接推送到 Supabase 云端：

```bash
pnpm prisma:push
```

如果后续进入生产流程，建议改为 migration 流程：

```bash
pnpm prisma:migrate:dev --name init
pnpm prisma:migrate:deploy
```

## 当前 Schema 设计覆盖

- 鉴权与账号：`User`, `Account`, `Session`, `VerificationToken`, `Authenticator`, `UserRole`
- 教师域：`TeacherProfile`, `TeacherSubject`, `TeacherServiceArea`, `TeacherAvailabilityRule`, `TeacherAvailabilityBlock`, `TeacherCredential`
- 学生/家长域：`StudentProfile`, `GuardianProfile`, `StudentGuardian`, `Address`
- 交易与履约：`Booking`, `Lesson`, `TeacherReview`, `PaymentIntent`, `Wallet`, `WalletTransaction`, `Payout`, `TeacherPayoutAccount`
- 管理后台：`AdminAuditLog`

该结构已为三端能力预留了完整关系与索引，可直接进入 API 开发。

## Auth API

公开身份只允许注册/补充为 `TEACHER`、`GUARDIAN`、`STUDENT`。`ADMIN/SUPER_ADMIN` 只能使用已有账号登录。

- `POST /auth/register`
- `POST /auth/email/register`
  - body: `{ "name"?: string, "email": string, "password": string, "requestedRole": "TEACHER" | "GUARDIAN" | "STUDENT" }`
- `POST /auth/login`
- `POST /auth/email/login`
  - body: `{ "email": string, "password": string, "requestedRole"?: "TEACHER" | "GUARDIAN" | "STUDENT" }`
- `POST /auth/sms/request-code`
  - body: `{ "phone": "13800138000" }`
- `POST /auth/sms/verify`
  - body: `{ "phone": "13800138000", "code": "123456", "requestedRole"?: "TEACHER" | "GUARDIAN" | "STUDENT", "name"?: "王女士" }`
- `POST /auth/wechat/app-login`
  - body: `{ "code": "<wechat-app-oauth-code>", "requestedRole"?: "TEACHER" | "GUARDIAN" | "STUDENT" }`
- `POST /auth/role/switch`
  - header: `Authorization: Bearer <accessToken>`
  - body: `{ "role": "TEACHER" | "GUARDIAN" | "STUDENT" | "ADMIN" | "SUPER_ADMIN" }`
- `POST /auth/bind/phone/request`
- `POST /auth/bind/phone/confirm`
- `POST /auth/bind/email-password`
- `GET /auth/me`
  - header: `Authorization: Bearer <accessToken>`

登录接口返回：

```json
{
  "accessToken": "jwt-token",
  "user": {
    "id": "user_id",
    "name": "User Name",
    "email": "user@example.com",
    "phone": "13800138000",
    "avatarUrl": "https://...",
    "roles": ["GUARDIAN", "TEACHER"],
    "availableRoles": ["GUARDIAN", "TEACHER"],
    "primaryRole": "GUARDIAN",
    "activeRole": "GUARDIAN",
    "loginMethods": ["SMS", "WECHAT_APP"],
    "profileIds": {
      "teacherProfileId": "teacher_profile_id",
      "guardianProfileId": "guardian_profile_id",
      "studentProfileId": null
    },
    "onboardingState": {
      "teacher": {
        "profileExists": true,
        "onboardingCompleted": false,
        "verificationStatus": "PENDING",
        "canAcceptBookings": false
      },
      "guardian": {
        "profileExists": true,
        "phoneVerified": true
      },
      "student": {
        "profileExists": false,
        "phoneVerified": true
      }
    }
  }
}
```
