# TuneTime Backend V1 MVP 边界

这份文档是当前后端 V1 MVP 的唯一范围说明。

目标只有一个：先跑通最小交易闭环，不让前端、后续 Agent、或新同学误接入二期能力。

## 1. V1 核心闭环

V1 只保留下面这条链路：

```text
短信验证码登录
-> 老师 / 家长 onboarding
-> 定向老师详情
-> 创建 booking hold
-> 从 hold 创建 booking
-> 老师在工作台接单
-> 家长查看订单结果
```

只要这条链路能稳定跑通，V1 就算成立。

## 2. V1 默认开放能力

运行时以 `GET /system/capabilities` 为准。

当前默认开放：

- `smsAuth`
- `sessionRestore`
- `teacherOnboarding`
- `guardianOnboarding`
- `bookingContext`
- `subjects`
- `teacherDetail`
- `teacherAvailabilityWindows`
- `bookingHold`
- `bookingCreate`
- `bookingMine`
- `teacherWorkbench`
- `teacherAccept`

对应主接口：

- `POST /auth/sms/request-code`
- `POST /auth/sms/verify`
- `GET /auth/me`
- `GET /auth/self/booking-context`
- `PATCH /auth/self/teacher-onboarding`
- `PATCH /auth/self/guardian-onboarding`
- `GET /subjects/active`
- `GET /teacher-availability/teachers/:teacherProfileId/summary`
- `GET /teacher-availability/teachers/:teacherProfileId/windows`
- `POST /bookings/holds`
- `POST /bookings/from-hold`
- `GET /bookings/mine`
- `GET /bookings/mine/:id`
- `GET /bookings/:id`
- `GET /teacher-workbench/bookings/pending`
- `GET /teacher-workbench/bookings/pending/:id`
- `PATCH /bookings/:id/accept`

## 3. 保留但默认关闭的能力

下面这些能力代码保留、数据结构保留，但在 V1 默认关闭：

- 认证扩展：
  - `emailPasswordAuth`
  - `phonePasswordAuth`
  - `wechatAuth`
  - `roleSwitch`
  - `bindPhone`
  - `bindEmailPassword`
  - `passwordReset`
  - `realNameVerification`
  - `studentRole`
  - `teacherProfileManage`
  - `guardianProfileManage`
- 供给扩展：
  - `teacherDiscover`
  - `teacherSearch`
  - `teacherAvailabilityManage`
  - `teacherAdmin`
  - `guardianAdmin`
  - `studentAdmin`
  - `addressAdmin`
  - `subjectAdmin`
- 订单强化：
  - `bookingAdmin`
  - `teacherRespond`
  - `guardianConfirm`
  - `payment`
  - `cancelBooking`
  - `reschedule`
  - `arrival`
  - `completionConfirm`
  - `dispute`
  - `manualRepair`
  - `lifecycleAutomation`
- 履约与外围：
  - `lessons`
  - `teacherReviews`
  - `calendar`
  - `crm`
  - `testSupport`
  - `lessonEvidence`

其中 `crm` 在当前 `codex/mvp-backend-v1` 分支里进一步做了硬剔除：

- CRM 源码目录仍保留
- 但 `AppModule` 不再加载 `CrmModule`
- 运行时、Swagger、路由注册里都不会出现 CRM
- 如果后续要恢复，再重新挂回模块即可

这些能力关闭时，接口统一返回：

```json
{
  "code": "FEATURE_DISABLED_IN_MVP",
  "message": "Capability \"...\" is disabled in the V1 MVP scope."
}
```

## 4. 标签规则

- `@post-mvp`
  - 表示这段能力在 V1 默认关闭，但代码保留，后续可以通过 capability 打开
- `FIXME(dev-mvp)`
  - 表示这是为了跑通 V1 闭环而做的临时放宽
  - 例如默认排班预置、readiness 放宽
  - 它不等于“后续功能”

## 5. 数据层策略

V1 不删任何表，也不回滚已有 schema 语义。

这意味着下面这些数据模型和字段继续保留，但默认不进入联调范围：

- `Wallet`
- `WalletTransaction`
- `PaymentIntent`
- `TeacherPayoutAccount`
- `Payout`
- `BookingExceptionCase`
- `LessonEvidence`
- `settlementReadiness`
- `exceptionStatus`
- `completionStatus`

## 6. 恢复策略

后续如果要放开某块功能，只做两步：

1. 在 `src/common/mvp-capabilities.ts` 把对应 capability 改成 `true`
2. 再安排前端 / Agent 联调

除非明确进入二期，不要绕过 capability 直接使用 `@post-mvp` 接口。
