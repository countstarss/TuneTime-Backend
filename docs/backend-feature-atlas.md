# TuneTime 后端功能图谱（Backend Feature Atlas）

这份文档的目标不是替代 Swagger，也不是替代实现代码，而是把 TuneTime 现在已经长出来的后端能力，压成一份适合日常判断和排查的“总索引”。

建议这样使用：

1. 先看“系统快照”和“模块图谱”，快速建立全局心智模型。
2. 再看“状态机图谱”和“跨角色数据流”，理解真实业务链路。
3. 最后把“接口总表”当作导航页，按模块回到具体 controller/service。

本文综合了下面几类来源：

- 后端代码与文档
  - `docs/project-overview.md`
  - `docs/schema-通俗说明.md`
  - `docs/订单履约补救一期后端方案.md`
  - `src/**/*.controller.ts`
  - `prisma/schema.prisma`
- TuneTime-WX 业务文档与小程序 service
  - [`../../TuneTime-WX/docs/flutter-feature-migration-inventory.md`](../../TuneTime-WX/docs/flutter-feature-migration-inventory.md)
  - [`../../TuneTime-WX/docs/flutter-mvp-feature-scope.md`](../../TuneTime-WX/docs/flutter-mvp-feature-scope.md)
  - [`../../TuneTime-WX/docs/wechat-quick-login.md`](../../TuneTime-WX/docs/wechat-quick-login.md)
  - [`../../TuneTime-WX/docs/order-lifecycle-scenario-matrix.md`](../../TuneTime-WX/docs/order-lifecycle-scenario-matrix.md)
  - [`../../TuneTime-WX/miniprogram/services`](../../TuneTime-WX/miniprogram/services)

## 1. 系统快照

| 指标 | 当前值 | 说明 |
| --- | --- | --- |
| Controller 入口组 | 15 | `root + 14` 个业务 controller 入口组 |
| HTTP 接口数 | 161 | 按当前 controller 路由统计 |
| Prisma model 数 | 39 | 含已开放域与未来资金/结算预留域 |
| 平台角色 | 5 | `SUPER_ADMIN`、`ADMIN`、`TEACHER`、`STUDENT`、`GUARDIAN` |
| 复杂度中心 | 4 个 | `bookings`、`auth`、`crm`、`teacher-availability` |

当前最值得优先建立认知的实现文件：

| 文件 | 约行数 | 为什么它复杂 |
| --- | ---: | --- |
| `src/bookings/bookings.service.ts` | 2554 | 订单主链路、支付推进、改约、争议、人工修复、自动巡检都在这里汇合 |
| `src/auth/auth.service.ts` | 1698 | 多登录方式、角色切换、profile snapshot、onboarding readiness、实名 |
| `src/crm/crm.service.ts` | 1625 | CRM 全域 CRUD、Customer 360、和业务域交叉引用 |
| `src/teacher-availability/teacher-availability.service.ts` | 1024 | 周模板、临时开放、block、预约占用叠加计算 |

一句话理解这套系统：

```text
User -> 角色壳子(Teacher/Guardian/Student) -> Booking -> Lesson -> Review
                                  \-> CRM / QA / 未来资金结算
```

## 2. 模块图谱

| 模块 | Endpoint 数 | 主要角色 | 核心模型 | 主要职责 | 关键状态 / 门槛 | TuneTime-WX 触点 |
| --- | ---: | --- | --- | --- | --- | --- |
| `root` | 2 | 公开 | 无 | 服务 smoke check、能力开关总表 | `system/capabilities` 给前端开关能力 | `services/booking.ts` |
| `auth` | 31 | 公开 + 所有登录用户 | `User` `Account` `UserRole` `RealNameVerificationSession` | 登录、角色切换、自助资料、onboarding、实名 | `activeRole`、`profileIds`、`onboardingState.*` | `app.ts`、`pages/index/index.ts`、`services/auth.ts` |
| `subjects` | 8 | 当前 controller 层公开 | `Subject` | 科目字典表 CRUD、前台激活科目列表 | 是否启用 | `services/subjects.ts` |
| `teachers` | 12 | `ADMIN` `SUPER_ADMIN` | `TeacherProfile` `TeacherSubject` `TeacherServiceArea` `TeacherCredential` | 老师主档、审核状态、后台资源替换 | `verificationStatus` 决定能否进入 discover / search | 主要由后台/Swagger 使用 |
| `teacher-availability` | 9 | 公开读 + `TEACHER` 自助写 | `TeacherAvailabilityRule` `TeacherAvailabilityBlock` `Booking` `BookingHold` | 老师未来可售卖时段、老师排班管理、按时间找老师 | `APPROVED` 老师才会对外可发现 | `services/teacher.ts`、`services/availability.ts` |
| `teacher-workbench` | 2 | `TEACHER` | `Booking` | 老师端待处理预约列表和详情 | 聚合 `PENDING_ACCEPTANCE` `PENDING_PAYMENT` `CONFIRMED` | `services/teacher-workbench.ts` |
| `guardians` | 8 | `ADMIN` `SUPER_ADMIN` | `GuardianProfile` | 家长档后台 CRUD | 管理端域，不是家长自助域 | 主要由后台/Swagger 使用 |
| `students` | 8 | `ADMIN` `SUPER_ADMIN` | `StudentProfile` `StudentGuardian` | 学生档后台 CRUD、家长绑定关系维护 | 管理端域 | 主要由后台/Swagger 使用 |
| `addresses` | 8 | 当前 controller 层公开 | `Address` | 地址簿 CRUD | 默认地址 / 归属关系 | 家长自助主链实际更多走 `auth/self/guardian/addresses` |
| `bookings` | 22 | `GUARDIAN` `TEACHER` `ADMIN` `SUPER_ADMIN` | `Booking` `BookingHold` `RescheduleRequest` `Lesson` `BookingExceptionCase` | 下单、占位、接单、支付、改约、取消、争议、人工修复 | `BookingStatus`、`PaymentStatus`、`completionStatus`、`exceptionStatus`、`settlementReadiness` | `services/booking.ts`、部分老师侧 flow |
| `lessons` | 11 | `TEACHER` `GUARDIAN` `ADMIN` `SUPER_ADMIN` | `Lesson` `LessonEvidence` | 课程记录、签到签退、反馈、证据 | `checkIn -> IN_PROGRESS`，`checkOut -> COMPLETED` | `services/review.ts` |
| `teacher-reviews` | 7 | `GUARDIAN` `TEACHER` `ADMIN` `SUPER_ADMIN` | `TeacherReview` | 创建/更新评价、老师评分汇总 | 一个 booking 只能有一条 review | `services/review.ts` |
| `calendar` | 1 | 登录用户（主要是 `GUARDIAN` / `TEACHER`） | `Booking` `Lesson` | 家长/老师统一课表视图 | 按角色过滤 booking | `services/calendar.ts` |
| `crm` | 29 | `CRM_AUTH` | `CrmLead` `CrmOpportunity` `CrmTask` `CrmActivity` `CrmCase` `CrmActionRun` | CRM 概览、客户 360、业务工单、AI 动作层 | `CrmAccessGuard`；当前屏蔽 `TEACHER` `STUDENT` | 当前主要不是小程序主链 |
| `test-support` | 3 | 当前 controller 层公开 | QA 场景与日志存储 | 固定账号、场景重置、模拟支付 | `TEST_SUPPORT_ENABLED` 或非 production | `services/dev-tools.ts` |
| 资金预留（无 controller） | 0 | 暂未开放 | `Wallet` `PaymentIntent` `WalletTransaction` `TeacherPayoutAccount` `Payout` | 为支付、结算、提现留好了模型 | 当前更多是 schema 预留，而非完整业务闭环 | 对应 WX 方案文档，未完整接通 |

## 3. 状态机图谱

### 3.1 登录、最小用户与可操作状态

TuneTime 的核心不是“先把资料填完再让你进”，而是：

```text
匿名访问
-> 微信小程序/短信/密码登录
-> 创建或命中 User
-> 创建最小角色壳子（requestedRole）
-> /auth/me 返回 onboardingState
-> 先进入浏览态
-> 关键动作前根据 onboardingState 做 gating
-> 完成 role-specific onboarding
-> 满足 phone / real-name / role-specific 条件
-> 放开下单 / 接单等关键动作
```

关键差异：

- `GUARDIAN`
  - 不是只有家长档案就能下单。
  - 还要求手机号、实名、至少一个孩子、默认地址、`canBook` 关系。
- `TEACHER`
  - 完成 onboarding 还不等于可接单。
  - 还要求实名认证和 `verificationStatus === APPROVED`。
- `STUDENT`
  - 后端支持独立学生角色，但 TuneTime-WX 当前主流程仍以家长代下单为主。

### 3.2 预约与履约主状态机

当前订单主链已经不是单层状态，而是多层叠加：

```text
BookingStatus
PENDING_ACCEPTANCE
-> PENDING_PAYMENT
-> CONFIRMED
-> IN_PROGRESS
-> COMPLETED
-> CANCELLED / REFUNDED / EXPIRED
```

同时叠加：

- `PaymentStatus`
  - `UNPAID`
  - `PAID`
  - `PARTIALLY_REFUNDED`
  - `REFUNDED`
  - `FAILED`
- `completionStatus`
  - `PENDING_TEACHER_RECORD`
  - `PENDING_GUARDIAN_CONFIRM`
  - `GUARDIAN_CONFIRMED`
  - `AUTO_CONFIRMED`
  - `DISPUTED`
- `exceptionStatus`
  - `NONE`
  - `OPEN`
  - `BLOCKING`
- `settlementReadiness`
  - `NOT_READY`
  - `READY`
  - `BLOCKED`

典型正向链路：

```text
BookingHold
-> Booking(PENDING_ACCEPTANCE / UNPAID)
-> Teacher accept
-> PENDING_PAYMENT / UNPAID
-> payment success
-> CONFIRMED / PAID
-> Lesson upsert
-> check-in
-> IN_PROGRESS / PAID
-> check-out
-> COMPLETED / PAID + PENDING_TEACHER_RECORD
-> teacher feedback
-> PENDING_GUARDIAN_CONFIRM
-> guardian confirm / auto confirm
-> GUARDIAN_CONFIRMED or AUTO_CONFIRMED
-> exceptionStatus == NONE 时 settlementReadiness = READY
```

### 3.3 老师可约时间生成公式

老师可售卖窗口来自三类数据叠加：

```text
周模板 weekly rules
+ 指定日期 extra slots
- 临时 block
- 已占用 Booking
- 已占用 BookingHold
= availability windows
```

这是整个下单链路的上游供给层。

### 3.4 CRM 流转

CRM 不是独立系统，而是业务域的运营镜像：

```text
Lead
-> Opportunity
-> Task / Activity
-> Case
-> Customer 360
-> AI action interpret / execute
-> CrmActionRun 审计
```

CRM 对业务对象的直接引用包括：

- `guardianProfileId`
- `studentProfileId`
- `teacherProfileId`
- `bookingId`
- `subjectId`

## 4. 跨角色数据流动过程

这一节把后端对象、TuneTime-WX 页面 / service、以及角色行为串在一起。

### 4.1 游客 / 首次登录用户

当前小程序已接通的真实入口在：

- `../../TuneTime-WX/miniprogram/pages/index/index.ts`
- `../../TuneTime-WX/miniprogram/app.ts`
- `../../TuneTime-WX/miniprogram/services/auth.ts`

真实链路：

```text
首页选择 requestedRole
-> wx.login()
-> POST /auth/wechat/miniapp-login
-> 后端 jscode2session
-> 命中或创建 User / Account / UserRole / 最小角色壳子
-> 返回 accessToken + user
-> 小程序缓存 tt_access_token
-> GET /auth/me 恢复会话
-> 页面根据 onboardingState 展示“浏览态”与 gating 提示
```

这个阶段的关键不是业务数据写得多，而是先建立下面几个全局锚点：

- `accessToken`
- `activeRole`
- `availableRoles`
- `profileIds`
- `onboardingState.teacher/guardian/student`
- `loginMethods`

### 4.2 家长（GUARDIAN）数据流

家长是当前 TuneTime-WX 主交易链的核心角色。

#### 入口与建档

```text
微信小程序登录
-> /auth/wechat/miniapp-login
-> 最小 Guardian 壳子
-> /auth/me
-> /auth/self/guardian-onboarding
```

家长 onboarding 会一次性写入或更新：

- `GuardianProfile`
- `StudentProfile`
- `StudentGuardian`
- `Address`

如果后续只修正局部资料，也会拆成自助接口：

- `/auth/self/guardian-profile`
- `/auth/self/guardian/students*`
- `/auth/self/guardian/addresses*`

#### 浏览与下单前校验

TuneTime-WX 当前已接或已定义的家长侧消费入口：

- `services/subjects.ts`
  - 读 `/subjects/active`
- `services/teacher.ts`
  - 读 `/teacher-availability/discover/teachers`
  - 读 `/teacher-availability/teachers/:teacherProfileId/windows`
- `services/auth.ts`
  - 读 `/auth/self/booking-context`

这里的数据流是：

```text
家长读取科目
-> 读取老师 discover 列表
-> 读取指定老师未来窗口
-> 读取 self booking context
-> 后端校验：
   家长档案 / 孩子 / 地址 / 老师审核 / 老师实名认证 / 科目配置 / canBook 关系
```

也就是说，下单前 gating 不是只在前端做提示，而是后端实打实二次校验。

#### 交易主链

当前家长侧真实交易入口主要在：

- `../../TuneTime-WX/miniprogram/services/booking.ts`

数据流：

```text
选择老师 + 科目 + 时间 + 孩子 + 地址
-> POST /bookings/holds
-> 写 BookingHold
-> POST /bookings/from-hold
-> 消费 hold，写 Booking
-> GET /bookings/mine
-> GET /bookings/mine/:id
-> PATCH /bookings/:id/payment
-> PATCH /bookings/:id/cancel
-> POST /bookings/:id/reschedule
-> PATCH /bookings/:id/reschedule/:requestId/respond
-> POST /bookings/:id/complete-confirm
-> POST /bookings/:id/disputes
```

家长侧写出的关键业务对象：

- `BookingHold`
- `Booking`
- `RescheduleRequest`
- `BookingExceptionCase`
- `TeacherReview`

家长侧消费的关键下游结果：

- 老师工作台待办
- `Lesson` 自动生成与履约推进
- 日历与订单详情
- CRM customer 360
- 未来结算 readiness

#### 课后反馈与评价

TuneTime-WX 当前 review service 覆盖：

- `/lessons/booking/:bookingId`
- `/lessons/:id/feedback`
- `/teacher-reviews/booking/:bookingId`
- `/teacher-reviews`
- `/teacher-reviews/:id`

这意味着家长不是只“看订单”，还会进入：

```text
Booking
-> Lesson
-> TeacherReview
```

### 4.3 老师（TEACHER）数据流

老师是供给侧与履约侧的核心角色。

#### 入口与建档

```text
微信小程序登录
-> /auth/wechat/miniapp-login
-> 最小 Teacher 壳子
-> /auth/me
-> /auth/self/teacher-onboarding
```

老师 onboarding 会写入或更新：

- `TeacherProfile`
- `TeacherSubject`
- `TeacherServiceArea`

后续老师自助补资料则走：

- `/auth/self/teacher-profile`

老师最终能否接单，不只取决于表单是否提交，还取决于：

- `realNameVerified`
- `verificationStatus === APPROVED`

#### 排班与供给发布

TuneTime-WX 老师排班 service 已经直接对接：

- `services/availability.ts`
  - `/teacher-availability/self/config`
  - `/teacher-availability/self/weekly-rules`
  - `/teacher-availability/self/blocks*`
  - `/teacher-availability/self/extra-slots*`

数据流：

```text
TeacherProfile
-> TeacherAvailabilityRule
-> TeacherAvailabilityBlock
-> 可约窗口计算
-> 被 discover/search 消费
-> 反过来进入 BookingHold / Booking 创建校验
```

#### 接单与履约

老师侧当前已经接上的交易 / 履约入口包括：

- `services/teacher-workbench.ts`
  - 读 `/teacher-workbench/bookings/pending*`
- `services/booking.ts`
  - 写 `/bookings/:id/respond`
- `services/review.ts`
  - 写 lesson feedback 相关接口

老师侧关键数据流：

```text
GET /teacher-workbench/bookings/pending
-> 读取 PENDING_ACCEPTANCE / PENDING_PAYMENT / CONFIRMED
-> PATCH /bookings/:id/respond or /accept
-> Booking.status 推进
-> POST /bookings/:id/arrival
-> PATCH /lessons/:id/check-in
-> PATCH /lessons/:id/check-out
-> PATCH /lessons/:id/feedback
-> POST /lessons/:id/evidences
```

老师侧写出的关键业务对象或字段：

- `Booking.respondedAt`
- `Booking.acceptedAt`
- `Lesson.checkInAt`
- `Lesson.checkOutAt`
- `Lesson.feedback*`
- `LessonEvidence`

老师侧产出的数据最终会被：

- 家长订单详情页
- 家长完课确认
- 评价与争议
- `settlementReadiness`
- CRM case / customer360

一起消费。

### 4.4 学生（STUDENT）数据流

学生角色在后端是完整角色，但在 TuneTime-WX 当前主链里仍然不是最中心的移动端入口。

要区分两条线：

#### 家长代管理孩子

这是当前主流路径：

```text
Guardian onboarding
-> StudentProfile
-> StudentGuardian(canBook / canViewLesson)
-> Booking.studentProfileId
-> Lesson.studentProfileId
-> TeacherReview.bookingId -> 间接回看学生相关履约
```

#### 学生独立账号

后端已经支持：

- `/auth/self/student-profile`
- `/auth/self/student-onboarding`

独立学生的核心门槛：

- 个人档案
- 年级
- 手机号已验证
- 实名

但从 TuneTime-WX 当前文档与页面规划看，学生更多还是作为未来扩展角色，而不是当前小程序 MVP 主入口。

### 4.5 管理员 / 运营 / CRM 数据流

这一条流基本不走 TuneTime-WX 主页面，而更多是后台 / Swagger / 运营侧。

#### 主数据管理

管理员直接维护：

- `/teachers/*`
- `/guardians/*`
- `/students/*`
- `/addresses/*`
- `/subjects/*`

这些接口直接写主数据档案，影响的是后续 discover、booking gating、calendar、CRM 全链路。

#### 履约兜底与售后

管理员直接参与：

- `/bookings/:id/payment`
- `/bookings/:id/disputes/:caseId/resolve`
- `/bookings/:id/ops/manual-repair`
- `/lessons/:id/attendance`

这些动作不会只改前台展示，而会真实影响：

- `BookingStatus`
- `PaymentStatus`
- `completionStatus`
- `exceptionStatus`
- `settlementReadiness`

#### CRM

CRM 把业务数据重新组织为运营视角：

```text
Guardian / Student / Teacher / Booking / Subject
-> customers
-> customer360
-> leads / opportunities / tasks / activities / cases
-> crm AI action preview / execute
-> CrmActionRun
```

CRM 不是“另起一套数据”，而是把主业务数据重新拼装成可跟进、可运营、可售后的视图。

### 4.6 QA / Demo 数据流

QA 辅助链现在也已经是正式的一条流：

```text
seed-demo / seed-crm-demo
-> /test-support/qa-scenario
-> /test-support/qa-scenario/reset
-> /test-support/qa-scenario/mock-payment
-> 反向推动 booking payment / event log / demo 账号状态
```

TuneTime-WX 已直接消费：

- `services/dev-tools.ts`

这让联调和演示不需要每次从真实订单手搓。

## 5. 角色-数据矩阵

| 角色 | 主要入口 | 主要读取 | 主要写入 | 核心状态 / gating | 下游影响 |
| --- | --- | --- | --- | --- | --- |
| 游客 / 首次用户 | `pages/index/index` -> `wx.login()` -> `/auth/wechat/miniapp-login` | `/auth/me`、`onboardingState` | `User` `Account` `UserRole` 最小角色壳子 | 浏览态先放行，关键动作前补资料 | 决定后续可走 guardian / teacher / student 哪条流 |
| 家长 | `services/auth.ts`、`services/teacher.ts`、`services/booking.ts` | 科目、老师窗口、booking context、我的订单、日历、lesson/review | `GuardianProfile` `StudentProfile` `StudentGuardian` `Address` `BookingHold` `Booking` `RescheduleRequest` `TeacherReview` `BookingExceptionCase` | `canBookLessons`、实名、手机号、默认地址、孩子关系 | 推动老师工作台、lesson、review、CRM、未来结算 |
| 老师 | `services/auth.ts`、`services/availability.ts`、`services/teacher-workbench.ts` | 待处理预约、自己的排班、日历 | `TeacherProfile` `TeacherSubject` `TeacherServiceArea` `TeacherAvailabilityRule` `TeacherAvailabilityBlock` `Lesson` `LessonEvidence` | `verificationStatus=APPROVED`、实名、可约时间配置 | 决定 discover / search 供给、订单接单、履约、结算 readiness |
| 学生 | 家长代管理为主；独立学生走 `/auth/self/student-*` | 课程、订单、日历的学生快照 | `StudentProfile` | 年级、手机号、实名 | 进入 booking/lesson/review/CRM |
| 管理员 / 运营 | 后台 / Swagger / CRM | 全量主数据、客户 360、工单、订单、课务 | 老师/家长/学生主档、支付修复、出勤修复、争议处理、CRM 对象、AI 动作 | 角色权限、`CrmAccessGuard`、审计 | 直接改写主业务状态和运营闭环 |
| QA / Demo | `services/dev-tools.ts` | QA 场景与日志 | 场景重置、模拟支付 | 环境开关 | 支持联调、回归和演示 |

## 6. TuneTime-WX 覆盖地图

这一节专门回答“WX 侧到底已经消费了哪些后端域”。

### 6.1 当前已存在的小程序 service 对应关系

| WX service | 面向角色 | 主要后端接口 | 对应业务阶段 |
| --- | --- | --- | --- |
| `services/auth.ts` | 游客 / 家长 / 老师 / 学生 | `/auth/*`、`/auth/self/guardian/*`、`/auth/self/*-profile`、`/auth/self/*-onboarding` | 登录、会话恢复、角色切换、自助资料、实名、booking context |
| `services/teacher.ts` | 家长 | `/teacher-availability/discover/teachers`、`/teacher-availability/teachers/:id/windows` | 发现老师、查看未来可约时间 |
| `services/subjects.ts` | 家长 | `/subjects/active` | 选科目 |
| `services/booking.ts` | 家长 / 老师 | `/system/capabilities`、`/bookings/holds`、`/bookings/from-hold`、`/bookings/mine*`、`/bookings/:id/respond` | 能力开关、下单、我的订单、老师响应 |
| `services/teacher-workbench.ts` | 老师 | `/teacher-workbench/bookings/pending*` | 老师待办工作台 |
| `services/availability.ts` | 老师 | `/teacher-availability/self/*` | 老师排班管理 |
| `services/calendar.ts` | 家长 / 老师 | `/calendar/me` | 我的课表 |
| `services/review.ts` | 家长 / 老师 | `/lessons/booking/:bookingId`、`/lessons/:id/feedback`、`/teacher-reviews/booking/:bookingId`、`/teacher-reviews*` | 履约记录、课后反馈、评价 |
| `services/dev-tools.ts` | QA | `/test-support/qa-scenario*` | 场景重置、模拟支付、测试账号 |

### 6.2 当前小程序实际落地 vs 文档规划

当前已经真实接通的最小链路：

- `pages/index/index.ts`
- `app.ts`
- `services/auth.ts`

它解决的是：

```text
登录
-> 最小会话恢复
-> onboardingState gating
-> 浏览态先进入
```

而 `../../TuneTime-WX/docs/flutter-mvp-feature-scope.md` 进一步定义了小程序 MVP 目标页：

- `auth/login`
- `onboarding/teacher`
- `onboarding/guardian`
- `teacher/detail`
- `booking/create`
- `booking/list`
- `booking/detail`
- `teacher-console/index`

也就是说，TuneTime-WX 现在不是“完全没业务”，而是已经有：

- 一条真实已接通的登录与浏览态入口
- 一组已经存在的 service 抽象
- 一套文档上明确的 MVP 页面落地顺序

这三者已经足够和后端主域对齐。

## 7. 接口总表

说明：

- 这一节按 controller 当前实际路由整理。
- `PUBLIC` 表示 controller 层未显式加 JWT/角色 guard，不代表未来一定应该公开。
- `AUTH_ANY_OR_SERVICE_SCOPED` 表示接口需要登录，但更细的所有权范围可能在 service 内继续收口。
- `CRM_AUTH` 表示 `JwtAuthGuard + CrmAccessGuard`。

### 7.1 root

| Method | Path | Roles | Summary |
| --- | --- | --- | --- |
| GET | `/` | `PUBLIC` | 基础 Hello World / smoke check 接口 |
| GET | `/system/capabilities` | `PUBLIC` | 返回前端能力开关，如 booking hold、calendar、manual repair 等 |

### 7.2 auth

| Method | Path | Roles | Summary |
| --- | --- | --- | --- |
| POST | `/auth/register` | `PUBLIC` | 兼容旧版的邮箱注册别名 |
| POST | `/auth/login` | `PUBLIC` | 兼容旧版的邮箱登录别名 |
| POST | `/auth/email/register` | `PUBLIC` | 邮箱注册 |
| POST | `/auth/email/login` | `PUBLIC` | 邮箱登录 |
| POST | `/auth/phone-password/login` | `PUBLIC` | 手机号密码登录 |
| POST | `/auth/sms/request-code` | `PUBLIC` | 请求短信验证码 |
| POST | `/auth/sms/verify` | `PUBLIC` | 短信验证码登录/注册 |
| POST | `/auth/wechat/app-login` | `PUBLIC` | 微信 App 快捷登录 |
| POST | `/auth/wechat/miniapp-login` | `PUBLIC` | 微信小程序快捷登录 |
| GET | `/auth/me` | `AUTH_ANY_OR_SERVICE_SCOPED` | 获取当前登录用户信息 |
| GET | `/auth/self/booking-context` | `AUTH_ANY_OR_SERVICE_SCOPED` | 获取当前账号的约课上下文 |
| GET | `/auth/self/guardian/students` | `GUARDIAN` | 获取当前家长名下的孩子资料列表 |
| POST | `/auth/self/guardian/students` | `GUARDIAN` | 为当前家长新增孩子资料 |
| PATCH | `/auth/self/guardian/students/:studentId` | `GUARDIAN` | 更新当前家长名下的孩子资料 |
| GET | `/auth/self/guardian/addresses` | `GUARDIAN` | 获取当前家长的地址列表 |
| POST | `/auth/self/guardian/addresses` | `GUARDIAN` | 为当前家长新增上课地址 |
| PATCH | `/auth/self/guardian/addresses/:addressId` | `GUARDIAN` | 更新当前家长的上课地址 |
| POST | `/auth/role/switch` | `AUTH_ANY_OR_SERVICE_SCOPED` | 切换当前活跃身份 |
| POST | `/auth/bind/phone/request` | `AUTH_ANY_OR_SERVICE_SCOPED` | 请求绑定手机号验证码 |
| POST | `/auth/bind/phone/confirm` | `AUTH_ANY_OR_SERVICE_SCOPED` | 确认绑定手机号 |
| POST | `/auth/bind/email-password` | `AUTH_ANY_OR_SERVICE_SCOPED` | 为当前账号绑定邮箱密码 |
| POST | `/auth/password/reset/request` | `AUTH_ANY_OR_SERVICE_SCOPED` | 向当前账号手机号发送设置/修改密码验证码 |
| POST | `/auth/password/reset/confirm` | `AUTH_ANY_OR_SERVICE_SCOPED` | 使用短信验证码设置/修改密码 |
| POST | `/auth/real-name/session` | `AUTH_ANY_OR_SERVICE_SCOPED` | 创建实名核身会话 |
| POST | `/auth/real-name/mock/complete` | `AUTH_ANY_OR_SERVICE_SCOPED` | 开发环境下完成模拟实名核身 |
| PATCH | `/auth/self/teacher-profile` | `TEACHER` | 老师自助更新个人档案 |
| PATCH | `/auth/self/teacher-onboarding` | `TEACHER` | 老师首登 onboarding 提交 |
| PATCH | `/auth/self/guardian-profile` | `GUARDIAN` | 家长自助更新个人档案 |
| PATCH | `/auth/self/guardian-onboarding` | `GUARDIAN` | 家长首登 onboarding 提交 |
| PATCH | `/auth/self/student-profile` | `STUDENT` | 学生自助更新个人档案 |
| PATCH | `/auth/self/student-onboarding` | `STUDENT` | 学生首登 onboarding 提交 |

### 7.3 subjects

| Method | Path | Roles | Summary |
| --- | --- | --- | --- |
| POST | `/subjects` | `PUBLIC` | 创建科目 |
| GET | `/subjects` | `PUBLIC` | 分页查询科目列表 |
| GET | `/subjects/active` | `PUBLIC` | 查询启用中的科目 |
| GET | `/subjects/code/:code` | `PUBLIC` | 按科目编码查询 |
| GET | `/subjects/:id` | `PUBLIC` | 查询科目详情 |
| PATCH | `/subjects/:id` | `PUBLIC` | 更新科目 |
| PATCH | `/subjects/:id/status` | `PUBLIC` | 切换科目启用状态 |
| DELETE | `/subjects/:id` | `PUBLIC` | 删除科目 |

### 7.4 teachers

| Method | Path | Roles | Summary |
| --- | --- | --- | --- |
| POST | `/teachers` | `ADMIN, SUPER_ADMIN` | 创建老师档案 |
| GET | `/teachers` | `ADMIN, SUPER_ADMIN` | 分页查询老师列表 |
| GET | `/teachers/verified` | `ADMIN, SUPER_ADMIN` | 查询已审核通过老师 |
| GET | `/teachers/user/:userId` | `ADMIN, SUPER_ADMIN` | 按 userId 查询老师档案 |
| GET | `/teachers/:id` | `ADMIN, SUPER_ADMIN` | 查询老师详情 |
| PATCH | `/teachers/:id` | `ADMIN, SUPER_ADMIN` | 更新老师档案 |
| PATCH | `/teachers/:id/verification` | `ADMIN, SUPER_ADMIN` | 更新老师审核状态 |
| PUT | `/teachers/:id/subjects` | `ADMIN, SUPER_ADMIN` | 整体替换老师科目配置 |
| PUT | `/teachers/:id/service-areas` | `ADMIN, SUPER_ADMIN` | 整体替换服务区域 |
| PUT | `/teachers/:id/availability-rules` | `ADMIN, SUPER_ADMIN` | 整体替换可预约规则 |
| PUT | `/teachers/:id/credentials` | `ADMIN, SUPER_ADMIN` | 整体替换老师资质材料 |
| DELETE | `/teachers/:id` | `ADMIN, SUPER_ADMIN` | 删除老师档案 |

### 7.5 teacher-availability

| Method | Path | Roles | Summary |
| --- | --- | --- | --- |
| GET | `/teacher-availability/teachers/:teacherProfileId/windows` | `PUBLIC` | 查询老师未来可售卖时段 |
| GET | `/teacher-availability/discover/teachers` | `PUBLIC` | 发现页读取真实老师列表及预览可约时段 |
| POST | `/teacher-availability/search` | `PUBLIC` | 按日期时间与科目搜索可接单老师 |
| GET | `/teacher-availability/self/config` | `TEACHER` | 读取老师自己的排班配置 |
| PATCH | `/teacher-availability/self/weekly-rules` | `TEACHER` | 整体替换老师自己的周模板 |
| POST | `/teacher-availability/self/blocks` | `TEACHER` | 老师新增不可约封锁时段 |
| DELETE | `/teacher-availability/self/blocks/:blockId` | `TEACHER` | 老师删除不可约封锁时段 |
| POST | `/teacher-availability/self/extra-slots` | `TEACHER` | 老师新增单日临时开放时段 |
| DELETE | `/teacher-availability/self/extra-slots/:ruleId` | `TEACHER` | 老师删除单日临时开放时段 |

### 7.6 teacher-workbench

| Method | Path | Roles | Summary |
| --- | --- | --- | --- |
| GET | `/teacher-workbench/bookings/pending` | `TEACHER` | 老师工作台待处理预约列表 |
| GET | `/teacher-workbench/bookings/pending/:id` | `TEACHER` | 老师工作台预约详情 |

### 7.7 guardians

| Method | Path | Roles | Summary |
| --- | --- | --- | --- |
| POST | `/guardians` | `ADMIN, SUPER_ADMIN` | 创建家长档案 |
| GET | `/guardians` | `ADMIN, SUPER_ADMIN` | 分页查询家长列表 |
| GET | `/guardians/user/:userId` | `ADMIN, SUPER_ADMIN` | 按 userId 查询家长档案 |
| GET | `/guardians/:id/students` | `ADMIN, SUPER_ADMIN` | 查询家长名下孩子列表 |
| GET | `/guardians/:id` | `ADMIN, SUPER_ADMIN` | 查询家长详情 |
| PATCH | `/guardians/:id` | `ADMIN, SUPER_ADMIN` | 更新家长档案 |
| PATCH | `/guardians/:id/default-address` | `ADMIN, SUPER_ADMIN` | 设置默认服务地址 |
| DELETE | `/guardians/:id` | `ADMIN, SUPER_ADMIN` | 删除家长档案 |

### 7.8 students

| Method | Path | Roles | Summary |
| --- | --- | --- | --- |
| POST | `/students` | `ADMIN, SUPER_ADMIN` | 创建学生档案 |
| GET | `/students` | `ADMIN, SUPER_ADMIN` | 分页查询学生列表 |
| GET | `/students/user/:userId` | `ADMIN, SUPER_ADMIN` | 按 userId 查询学生档案 |
| GET | `/students/:id` | `ADMIN, SUPER_ADMIN` | 查询学生详情 |
| PATCH | `/students/:id` | `ADMIN, SUPER_ADMIN` | 更新学生档案 |
| PATCH | `/students/:id/guardians` | `ADMIN, SUPER_ADMIN` | 新增或更新学生-家长绑定 |
| DELETE | `/students/:id/guardians/:guardianProfileId` | `ADMIN, SUPER_ADMIN` | 解除学生与家长绑定 |
| DELETE | `/students/:id` | `ADMIN, SUPER_ADMIN` | 删除学生档案 |

### 7.9 addresses

| Method | Path | Roles | Summary |
| --- | --- | --- | --- |
| POST | `/addresses` | `PUBLIC` | 创建地址 |
| GET | `/addresses` | `PUBLIC` | 分页查询地址列表 |
| GET | `/addresses/user/:userId` | `PUBLIC` | 按用户查询地址列表 |
| GET | `/addresses/user/:userId/default` | `PUBLIC` | 查询用户默认地址 |
| GET | `/addresses/:id` | `PUBLIC` | 查询地址详情 |
| PATCH | `/addresses/:id` | `PUBLIC` | 更新地址 |
| PATCH | `/addresses/:id/default` | `PUBLIC` | 设为默认地址 |
| DELETE | `/addresses/:id` | `PUBLIC` | 删除地址 |

### 7.10 bookings

| Method | Path | Roles | Summary |
| --- | --- | --- | --- |
| POST | `/bookings/from-hold` | `GUARDIAN` | 家长从占位创建预约 |
| POST | `/bookings/holds` | `GUARDIAN` | 家长创建预约占位 |
| POST | `/bookings` | `ADMIN, SUPER_ADMIN` | 创建预约 |
| GET | `/bookings` | `ADMIN, SUPER_ADMIN` | 分页查询预约列表 |
| GET | `/bookings/mine` | `GUARDIAN` | 家长查询自己的预约列表 |
| GET | `/bookings/mine/:id` | `GUARDIAN` | 家长查询自己的预约详情 |
| GET | `/bookings/booking-no/:bookingNo` | `ADMIN, SUPER_ADMIN` | 按预约单号查询详情 |
| GET | `/bookings/:id` | `TEACHER, GUARDIAN, ADMIN, SUPER_ADMIN` | 查询预约详情 |
| PATCH | `/bookings/:id` | `ADMIN, SUPER_ADMIN` | 更新预约 |
| PATCH | `/bookings/:id/respond` | `TEACHER` | 老师统一响应预约 |
| PATCH | `/bookings/:id/accept` | `TEACHER` | 老师接单 |
| PATCH | `/bookings/:id/guardian-confirm` | `GUARDIAN` | 家长确认预约 |
| PATCH | `/bookings/:id/payment` | `GUARDIAN, ADMIN, SUPER_ADMIN` | 更新预约支付状态 |
| PATCH | `/bookings/:id/cancel` | `GUARDIAN, TEACHER` | 取消预约 |
| POST | `/bookings/:id/reschedule` | `GUARDIAN, TEACHER` | 发起改约请求 |
| PATCH | `/bookings/:id/reschedule/:requestId/respond` | `GUARDIAN, TEACHER` | 响应改约请求 |
| POST | `/bookings/:id/arrival` | `TEACHER, ADMIN, SUPER_ADMIN` | 老师确认到达 |
| POST | `/bookings/:id/complete-confirm` | `GUARDIAN, ADMIN, SUPER_ADMIN` | 家长确认完课 |
| POST | `/bookings/:id/disputes` | `GUARDIAN, ADMIN, SUPER_ADMIN` | 发起订单争议 |
| POST | `/bookings/:id/disputes/:caseId/resolve` | `ADMIN, SUPER_ADMIN` | 处理订单争议 |
| POST | `/bookings/:id/ops/manual-repair` | `ADMIN, SUPER_ADMIN` | 后台人工修复订单 |
| DELETE | `/bookings/:id` | `ADMIN, SUPER_ADMIN` | 删除预约 |

### 7.11 lessons

| Method | Path | Roles | Summary |
| --- | --- | --- | --- |
| POST | `/lessons` | `ADMIN, SUPER_ADMIN` | 创建课程记录 |
| GET | `/lessons` | `ADMIN, SUPER_ADMIN` | 分页查询课程列表 |
| GET | `/lessons/booking/:bookingId` | `TEACHER, GUARDIAN, ADMIN, SUPER_ADMIN` | 按预约查询课程记录 |
| GET | `/lessons/:id` | `TEACHER, GUARDIAN, ADMIN, SUPER_ADMIN` | 查询课程详情 |
| PATCH | `/lessons/:id` | `ADMIN, SUPER_ADMIN` | 更新课程基础信息 |
| PATCH | `/lessons/:id/check-in` | `TEACHER, ADMIN, SUPER_ADMIN` | 课程签到 |
| PATCH | `/lessons/:id/check-out` | `TEACHER, ADMIN, SUPER_ADMIN` | 课程签退 |
| PATCH | `/lessons/:id/attendance` | `ADMIN, SUPER_ADMIN` | 手动更新课程出勤状态 |
| PATCH | `/lessons/:id/feedback` | `TEACHER, ADMIN, SUPER_ADMIN` | 提交课后反馈 |
| POST | `/lessons/:id/evidences` | `TEACHER, ADMIN, SUPER_ADMIN` | 上传课程证据 |
| DELETE | `/lessons/:id` | `ADMIN, SUPER_ADMIN` | 删除课程记录 |

### 7.12 teacher-reviews

| Method | Path | Roles | Summary |
| --- | --- | --- | --- |
| POST | `/teacher-reviews` | `GUARDIAN, ADMIN, SUPER_ADMIN` | 创建老师评价 |
| GET | `/teacher-reviews` | `GUARDIAN, ADMIN, SUPER_ADMIN` | 分页查询老师评价列表 |
| GET | `/teacher-reviews/booking/:bookingId` | `GUARDIAN, ADMIN, SUPER_ADMIN` | 按预约查询评价 |
| GET | `/teacher-reviews/teacher/:teacherProfileId/summary` | `TEACHER, GUARDIAN, ADMIN, SUPER_ADMIN` | 查询老师评价汇总 |
| GET | `/teacher-reviews/:id` | `GUARDIAN, ADMIN, SUPER_ADMIN` | 查询评价详情 |
| PATCH | `/teacher-reviews/:id` | `GUARDIAN, ADMIN, SUPER_ADMIN` | 更新老师评价 |
| DELETE | `/teacher-reviews/:id` | `GUARDIAN, ADMIN, SUPER_ADMIN` | 删除老师评价 |

### 7.13 calendar

| Method | Path | Roles | Summary |
| --- | --- | --- | --- |
| GET | `/calendar/me` | `AUTH_ANY_OR_SERVICE_SCOPED` | 查询当前账号课表 |

### 7.14 crm

| Method | Path | Roles | Summary |
| --- | --- | --- | --- |
| GET | `/crm/overview` | `CRM_AUTH` | CRM 概览看板 |
| GET | `/crm/customers` | `CRM_AUTH` | 客户列表 |
| GET | `/crm/customers/:guardianProfileId/360` | `CRM_AUTH` | 客户 360 视图 |
| GET | `/crm/leads` | `CRM_AUTH` | 线索列表 |
| POST | `/crm/leads` | `CRM_AUTH` | 创建线索 |
| GET | `/crm/leads/:id` | `CRM_AUTH` | 查询线索详情 |
| PATCH | `/crm/leads/:id` | `CRM_AUTH` | 更新线索 |
| DELETE | `/crm/leads/:id` | `CRM_AUTH` | 删除线索 |
| GET | `/crm/opportunities` | `CRM_AUTH` | 商机列表 |
| POST | `/crm/opportunities` | `CRM_AUTH` | 创建商机 |
| GET | `/crm/opportunities/:id` | `CRM_AUTH` | 查询商机详情 |
| PATCH | `/crm/opportunities/:id` | `CRM_AUTH` | 更新商机 |
| DELETE | `/crm/opportunities/:id` | `CRM_AUTH` | 删除商机 |
| GET | `/crm/tasks` | `CRM_AUTH` | CRM 任务列表 |
| POST | `/crm/tasks` | `CRM_AUTH` | 创建 CRM 任务 |
| GET | `/crm/tasks/:id` | `CRM_AUTH` | 查询 CRM 任务详情 |
| PATCH | `/crm/tasks/:id` | `CRM_AUTH` | 更新 CRM 任务 |
| DELETE | `/crm/tasks/:id` | `CRM_AUTH` | 删除 CRM 任务 |
| GET | `/crm/activities` | `CRM_AUTH` | 跟进活动列表 |
| POST | `/crm/activities` | `CRM_AUTH` | 创建跟进活动 |
| GET | `/crm/activities/:id` | `CRM_AUTH` | 查询跟进活动详情 |
| GET | `/crm/cases` | `CRM_AUTH` | CRM 工单列表 |
| POST | `/crm/cases` | `CRM_AUTH` | 创建 CRM 工单 |
| GET | `/crm/cases/:id` | `CRM_AUTH` | 查询 CRM 工单详情 |
| PATCH | `/crm/cases/:id` | `CRM_AUTH` | 更新 CRM 工单 |
| DELETE | `/crm/cases/:id` | `CRM_AUTH` | 删除 CRM 工单 |
| GET | `/crm/ai/actions` | `CRM_AUTH` | 列出受控 AI 动作 |
| POST | `/crm/ai/interpret` | `CRM_AUTH` | 把自然语言解释为 CRM 动作计划 |
| POST | `/crm/ai/execute` | `CRM_AUTH` | 执行或 dry-run CRM 动作 |

### 7.15 test-support

| Method | Path | Roles | Summary |
| --- | --- | --- | --- |
| GET | `/test-support/qa-scenario` | `PUBLIC` | 读取 Task 0 QA 场景、测试账号与事件日志 |
| POST | `/test-support/qa-scenario/reset` | `PUBLIC` | 重置固定 QA 场景到指定初始状态 |
| POST | `/test-support/qa-scenario/mock-payment` | `PUBLIC` | 对指定预约触发开发态模拟支付成功/失败 |

## 8. 最后给自己的读图顺序

如果下次你只想在 10 分钟内恢复项目认知，推荐按下面顺序：

1. 先扫第 2 节模块图谱，确认你这次要碰的是哪一个域。
2. 再看第 3 节状态机图谱，确认这个域真正推进的状态是什么。
3. 然后看第 4 节跨角色数据流，搞清楚前台是谁发起、后台写了哪些对象、谁会消费这些对象。
4. 最后到第 7 节接口总表，直接跳到对应 controller/service。

如果是具体改动任务，可以这样定位：

- 改登录 / 最小会话 / onboarding：先看 `auth`
- 改老师侧供给：先看 `teachers` + `teacher-availability`
- 改下单 / 支付 / 履约 / 补救：先看 `bookings` + `lessons`
- 改家长课后体验：先看 `bookings` + `teacher-reviews`
- 改老师端工作台：先看 `teacher-workbench` + `calendar`
- 改运营与客户跟进：先看 `crm`
- 做联调 / 演示 / 场景复位：先看 `test-support`
