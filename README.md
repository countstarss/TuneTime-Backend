# TuneTime API

TuneTime 是一个「上门私教撮合平台」后端基础工程，面向三个客户端：

- Admin 管理后台
- 教师端
- 学生/家长端

核心场景：家长充值、学生约课、教师按可预约时间接单、平台统一结算与管理。

## 项目总览文档

如果你是第一次接手这个仓库，或者想让后续 agent 快速建立上下文，优先阅读：

- [docs/project-overview.md](./docs/project-overview.md)

## 当前阶段说明

当前仓库已经接入以下能力，但其中一部分仍然是开发态方案，不可直接视为生产可用：

- 短信验证码：开发环境下会退化为控制台输出验证码，不会真实下发短信
- 实名认证：开发环境下会创建实名会话并在调用 mock 完成接口后直接通过，不会拉起真实刷脸
- onboarding：已具备老师 / 家长 / 学生分角色资料收集与完成度计算，但只是首版流程
- 约课 gating：会根据资料完整度和实名状态限制关键业务

下面带有“上线前必须完成”的条目，必须在正式环境补齐。

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

### 运行时连库说明

- `prisma.config.ts` 使用 `DIRECT_URL` 做迁移
- 应用运行时当前优先使用 `DIRECT_URL`，其次才回退到 `DATABASE_URL`
- 这样做是为了避免本地开发时某些 Supabase pooler 网络环境不稳定导致 Nest 无法启动

### 上线前必须完成的环境配置

- 必须替换 `AUTH_JWT_SECRET`
  - 当前 `.env` 里的值只是占位，不可用于生产
- 必须配置真实短信服务
  - `TENCENT_SMS_SECRET_ID`
  - `TENCENT_SMS_SECRET_KEY`
  - `TENCENT_SMS_SDK_APP_ID`
  - `TENCENT_SMS_SIGN_NAME`
  - `TENCENT_SMS_TEMPLATE_LOGIN`
  - `TENCENT_SMS_TEMPLATE_PHONE_BIND`
  - 如果继续使用短信改密，还需要补齐密码相关模板
- 必须配置真实实名服务，或接入你们最终选定的供应商
  - 当前代码仅在配置齐腾讯云实名参数后才会走真实 provider
  - 未配置时默认回退到 `MOCK`
- 必须确认 `DATABASE_URL` / `DIRECT_URL` 都指向正式库
  - 不要继续使用开发库或个人 Supabase 项目
- 必须完成 CORS、部署域名、日志与错误告警配置

## 快速启动

```bash
pnpm install
pnpm prisma:format
pnpm prisma:validate
pnpm prisma:generate
pnpm prisma:push
pnpm start:dev
```

如果本机 Node 版本下 `prisma` CLI 出现 ESM 兼容问题，可以临时使用 Node 22 执行：

```bash
npx -y node@22 ./node_modules/prisma/build/index.js generate
npx -y node@22 ./node_modules/prisma/build/index.js migrate deploy
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

当前 onboarding / 实名相关 schema 已包含在迁移：

- `20260321103000_add_onboarding_and_real_name_verification`

内容包括：

- `users.real_name_*`
- `guardian_profiles.onboarding_completed_at`
- `student_profiles.onboarding_completed_at`
- `real_name_verification_sessions`

## 当前 Schema 设计覆盖

- 鉴权与账号：`User`, `Account`, `Session`, `VerificationToken`, `Authenticator`, `UserRole`
- 教师域：`TeacherProfile`, `TeacherSubject`, `TeacherServiceArea`, `TeacherAvailabilityRule`, `TeacherAvailabilityBlock`, `TeacherCredential`
- 学生/家长域：`StudentProfile`, `GuardianProfile`, `StudentGuardian`, `Address`
- 交易与履约：`Booking`, `Lesson`, `TeacherReview`, `PaymentIntent`, `Wallet`, `WalletTransaction`, `Payout`, `TeacherPayoutAccount`
- 管理后台：`AdminAuditLog`

该结构已为三端能力预留了完整关系与索引，可直接进入 API 开发。

## Auth API

公开身份只允许注册/补充为 `TEACHER`、`GUARDIAN`、`STUDENT`。`ADMIN/SUPER_ADMIN` 只能使用已有账号登录。

当前前期启动阶段建议把“小程序登录”当成唯一主入口来推进：

- 主入口：`POST /auth/wechat/miniapp-login`
- 先让用户拿到最小用户会话并进入浏览态
- 预约 / 下单 / 接单前再按资料完整度做 gating
- 短信、密码、微信 App 登录都可以后置

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
- `POST /auth/wechat/miniapp-login`
  - body: `{ "code": "<wechat-miniapp-login-code>", "requestedRole"?: "TEACHER" | "GUARDIAN" | "STUDENT" }`
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

新增的开发态接口与 onboarding 接口：

- `POST /auth/phone-password/login`
- `POST /auth/password/reset/request`
- `POST /auth/password/reset/confirm`
- `POST /auth/real-name/session`
- `POST /auth/real-name/mock/complete`
- `PATCH /auth/self/teacher-onboarding`
- `PATCH /auth/self/guardian-onboarding`
- `PATCH /auth/self/student-onboarding`

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
    "loginMethods": ["WECHAT_MINIAPP"],
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

## 开发态能力与上线要求

### 短信验证码

- 当前行为：
  - 未配置腾讯云短信时，验证码只会打印到后端日志
  - 适合本地开发、联调和测试
- 上线前必须完成：
  - 接入真实短信供应商
  - 完成登录、绑定手机号、修改密码等模板配置
  - 增加发送限流、黑名单、审计日志和运营商失败兜底

### 实名认证

- 当前行为：
  - `POST /auth/real-name/session` 会创建实名会话并持久化到数据库
  - 开发阶段调用 `POST /auth/real-name/mock/complete` 后会直接标记通过
  - 数据库会同步写入实名状态
- 上线前必须完成：
  - 接入真实实名供应商
  - 将 App 的 mock 完成按钮改为真实刷脸流程
  - 处理实名失败、重试、人工审核、黑名单和风控策略

### Onboarding 与资料完整度

- 当前行为：
  - 首次注册后会进入首登 onboarding
  - 老师 / 家长 / 学生会采集不同字段
  - 完整度不足时，约课/接单会被限制
- 上线前必须完成：
  - 复核每个角色的必填项与完成度权重
  - 明确哪些字段可以跳过，哪些字段必须阻断业务
  - 完成后台运营侧的资料审核/查看工具

### 约课主流程

- 当前行为：
  - 已根据资料完整度和实名状态做后端 gating
  - 基本订单创建逻辑可运行
- 上线前必须完成：
  - 支付、退款、结算、取消规则、超时关闭等资金链路
  - 教师排班、冲突校验、消息通知、订单生命周期监控

## 生产上线检查清单

- 完成数据库迁移并核对正式环境数据
- 完成 JWT、短信、实名、微信登录等正式密钥配置
- 关闭所有开发态 mock fallback
- 补齐日志、告警、埋点、审计与备份策略
- 对鉴权、资料提交、实名、约课、支付主链路做联调回归
