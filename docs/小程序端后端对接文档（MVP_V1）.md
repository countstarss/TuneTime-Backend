# TuneTime 小程序端后端对接文档（MVP_V1）

更新时间：2026-04-07

适用对象：

- TuneTime 小程序端开发
- 当前后端仓库 `/Users/luke/TuneTime/TuneTime-Backend`
- 当前 V1 MVP 收束版本

本文目标不是罗列全部后端接口，而是给小程序端一份“现在还能用什么、不能再用什么、应该怎么改”的对接说明。

## 1. 先说结论

当前 V1 MVP 只保留下面这条最小闭环：

```text
短信验证码登录
-> 老师 / 家长 onboarding
-> 老师列表 / 搜索 / 定向老师详情
-> 查询老师可约时段
-> 创建 booking hold
-> 从 hold 创建 booking
-> 老师工作台查看待处理预约
-> 老师接单
-> 家长查看自己的订单结果
```

这意味着小程序端需要同步收口：

- 登录入口以短信验证码为准，不再以微信小程序登录为主
- 不再依赖课表、评价、lesson、测试工具、模拟支付
- 不再依赖老师拒单、家长确认、支付推进、取消、改约等二期接口
- 可以恢复老师列表、老师搜索、老师端自助排班、家长多孩子/多地址、老师/家长独立资料编辑

运行时能力请以 `GET /system/capabilities` 为准。

## 2. 当前后端默认开放能力

当前代码里默认开启的 capability：

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
- `teacherDiscover`
- `teacherSearch`
- `teacherAvailabilityManage`
- `teacherProfileManage`
- `guardianProfileManage`

对应小程序实际可用接口：

- `GET /system/capabilities`
- `POST /auth/sms/request-code`
- `POST /auth/sms/verify`
- `GET /auth/me`
- `GET /auth/self/booking-context`
- `PATCH /auth/self/teacher-onboarding`
- `PATCH /auth/self/guardian-onboarding`
- `PATCH /auth/self/teacher-profile`
- `PATCH /auth/self/guardian-profile`
- `GET /auth/self/guardian/students`
- `POST /auth/self/guardian/students`
- `PATCH /auth/self/guardian/students/:studentId`
- `GET /auth/self/guardian/addresses`
- `POST /auth/self/guardian/addresses`
- `PATCH /auth/self/guardian/addresses/:addressId`
- `GET /subjects/active`
- `GET /teacher-availability/discover/teachers`
- `POST /teacher-availability/search`
- `GET /teacher-availability/teachers/:teacherProfileId/summary`
- `GET /teacher-availability/teachers/:teacherProfileId/windows`
- `GET /teacher-availability/self/config`
- `PATCH /teacher-availability/self/weekly-rules`
- `POST /teacher-availability/self/blocks`
- `DELETE /teacher-availability/self/blocks/:blockId`
- `POST /teacher-availability/self/extra-slots`
- `DELETE /teacher-availability/self/extra-slots/:ruleId`
- `POST /bookings/holds`
- `POST /bookings/from-hold`
- `GET /bookings/mine`
- `GET /bookings/mine/:id`
- `GET /bookings/:id`
- `GET /teacher-workbench/bookings/pending`
- `GET /teacher-workbench/bookings/pending/:id`
- `PATCH /bookings/:id/accept`

## 3. 小程序端需要按 capability 区分处理的能力

下面这些是当前小程序仓库里仍需显式按 capability 处理的调用：

| 小程序现有调用 | 当前状态 | 处理建议 |
| --- | --- | --- |
| `POST /auth/wechat/miniapp-login` | 关闭 | 删掉微信快捷登录主流程，统一走短信验证码 |
| `POST /auth/role/switch` | 关闭 | 不做会话内切角色；登录时用 `requestedRole` 决定身份 |
| `GET /teacher-availability/discover/teachers` | 开放 | 可恢复老师列表页，默认拉 14 天内预览时段 |
| `POST /teacher-availability/search` | 开放 | 可恢复按上课时间 + 科目搜索老师 |
| `GET /teacher-availability/self/config` 及 `self/*` | 开放 | 老师端可恢复排班管理入口 |
| `PATCH /bookings/:id/respond` | 关闭 | 老师侧只保留 `PATCH /bookings/:id/accept` |
| `PATCH /bookings/:id/payment` | 已移除 | 小程序端不要再做支付推进联调，真实支付只走 `/payments/bookings/:bookingId/prepare` |
| `PATCH /bookings/:id/cancel` | 关闭 | 小程序端不要再做取消联调 |
| `GET /calendar/me` | 关闭 | 课表页下线或纯静态占位 |
| `/lessons/*` | 关闭 | lesson 记录页下线 |
| `/teacher-reviews/*` | 关闭 | 评价页下线 |
| `/test-support/*` | 关闭 | 开发工具页下线 |
| `/auth/self/guardian/students*` | 开放 | 可恢复多孩子自助管理 |
| `/auth/self/guardian/addresses*` | 开放 | 可恢复多地址自助管理 |
| `/auth/self/teacher-profile` / `/auth/self/guardian-profile` | 开放 | 可恢复独立资料编辑页，不必强依赖 onboarding |

后端关闭这些能力时，统一返回：

```json
{
  "code": "FEATURE_DISABLED_IN_MVP",
  "capability": "xxx",
  "message": "Capability \"xxx\" is disabled in the V1 MVP scope."
}
```

## 4. 小程序端推荐的页面/链路收口

### 4.1 登录

保留：

- 手机号输入
- 验证码发送
- 验证码登录
- 登录时选择 `GUARDIAN` / `TEACHER`

移除：

- 微信小程序快捷登录
- 登录后角色切换入口

### 4.2 家长端

保留：

- 首登 onboarding
- 老师列表
- 搜索老师
- 科目读取
- 定向老师详情
- 老师可约时段
- 下单创建 hold
- 从 hold 创建 booking
- 我的订单列表 / 详情

移除：

- 课表页
- 评价页
- 取消 / 支付 / 改约 / 争议

### 4.3 老师端

保留：

- 首登 onboarding
- 独立资料编辑
- 自助排班管理
- 工作台待处理订单列表
- 待处理订单详情
- 接单

移除：

- 老师课表
- lesson 反馈
- 拒单

## 5. 鉴权与会话规则

### 5.1 统一鉴权头

需要登录的接口统一传：

```http
Authorization: Bearer <accessToken>
```

### 5.2 当前 activeRole 的确定方式

当前 V1 不开放 `role/switch`。

所以小程序端要遵守这条规则：

- 登录时传 `requestedRole`
- 后端会给该用户补对应角色壳子，并把该角色设为当前主角色
- 返回的 `accessToken` 会带上当前 `activeRole`
- 如果同一手机号要切换到另一身份，只能重新走一次短信验证并传新的 `requestedRole`

建议：

- 每次登录都明确传 `requestedRole`
- 小程序端不要假设“一个 token 可以在前台随意切老师/家长身份”

### 5.3 是否允许继续下一步，以 `/auth/me` 为唯一准绳

不要在前端自行推断是否可以下单 / 接单，统一看：

- 家长：`user.onboardingState.guardian.canBookLessons`
- 老师：`user.onboardingState.teacher.canAcceptBookings`

即使页面文案里有实名、审核、资料完整度等概念，前端也不要自己拼条件，直接以后端返回布尔值为准。

## 6. 开放接口说明

### 6.1 系统能力

### `GET /system/capabilities`

用途：

- 小程序启动时读取当前后端是否开放某项能力
- 做页面级开关，而不是本地写死

建议至少关注这些字段：

- `smsAuth`
- `teacherOnboarding`
- `guardianOnboarding`
- `teacherDetail`
- `teacherAvailabilityWindows`
- `bookingHold`
- `bookingCreate`
- `bookingMine`
- `teacherWorkbench`
- `teacherAccept`

### 6.2 登录与会话

### `POST /auth/sms/request-code`

请求体：

```json
{
  "phone": "13800138000"
}
```

返回：

```json
{
  "success": true,
  "expiresInSeconds": 600,
  "cooldownSeconds": 60
}
```

说明：

- 手机号只接受中国大陆手机号
- 默认验证码 6 位
- 默认有效期 600 秒
- 默认重发冷却 60 秒
- 开发环境未配腾讯短信时，验证码会打印到后端日志
- 冷却期内重复发送会返回 `429`

### `POST /auth/sms/verify`

请求体：

```json
{
  "phone": "13800138000",
  "code": "123456",
  "requestedRole": "GUARDIAN",
  "name": "王女士"
}
```

说明：

- 首次短信登录时 `requestedRole` 必传
- 当前公开身份只允许：
  - `GUARDIAN`
  - `TEACHER`
  - `STUDENT`
- 小程序当前建议只使用：
  - `GUARDIAN`
  - `TEACHER`

返回：

```json
{
  "accessToken": "jwt-token",
  "user": {
    "id": "user_xxx",
    "activeRole": "GUARDIAN",
    "roles": ["GUARDIAN"],
    "loginMethods": ["SMS"],
    "profileIds": {
      "teacherProfileId": null,
      "guardianProfileId": "guardian_xxx",
      "studentProfileId": null
    },
    "onboardingState": {
      "guardian": {
        "completionPercent": 50,
        "missingRequiredItems": ["紧急联系人", "孩子信息", "默认上课地址"],
        "canBookLessons": false
      }
    }
  }
}
```

### `GET /auth/me`

用途：

- 恢复会话
- 拿当前登录用户、当前 activeRole、资料快照、onboarding 状态

前端必须使用的字段：

- `user.activeRole`
- `user.roles`
- `user.profileIds`
- `user.onboardingState.teacher`
- `user.onboardingState.guardian`
- `user.teacherProfile`
- `user.guardianProfile`

重点字段解释：

| 字段 | 含义 | 小程序用途 |
| --- | --- | --- |
| `onboardingState.teacher.completionPercent` | 老师资料完成度 | 进度条 / 提示文案 |
| `onboardingState.teacher.missingRequiredItems` | 老师缺失必填项 | 指引继续完善 |
| `onboardingState.teacher.canAcceptBookings` | 老师是否可接单 | 工作台入口与按钮 gating |
| `onboardingState.guardian.completionPercent` | 家长资料完成度 | 进度条 / 提示文案 |
| `onboardingState.guardian.missingRequiredItems` | 家长缺失必填项 | 指引继续完善 |
| `onboardingState.guardian.canBookLessons` | 家长是否可下单 | 下单按钮 gating |
| `profileIds.guardianProfileId` | 家长档案 ID | 订单上下文/后续展示 |
| `profileIds.teacherProfileId` | 老师档案 ID | 工作台等页面使用 |

### `GET /auth/self/booking-context`

仅家长端使用。

返回：

- `guardianProfileId`
- `students`
- `addresses`

适用场景：

- 下单页加载“孩子 + 上课地址”选择器

返回结构示意：

```json
{
  "guardianProfileId": "guardian_xxx",
  "students": [
    {
      "id": "student_xxx",
      "displayName": "小宇",
      "gradeLevel": "PRIMARY"
    }
  ],
  "addresses": [
    {
      "id": "addr_xxx",
      "label": "家里",
      "contactName": "王女士",
      "contactPhone": "13800138000",
      "province": "天津市",
      "city": "天津市",
      "district": "南开区",
      "street": "黄河道100号",
      "building": "3号楼501",
      "isDefault": true
    }
  ]
}
```

### 6.3 onboarding

### `PATCH /auth/self/guardian-onboarding`

用途：

- 家长首登资料提交
- 在 V1 中同时承担：
  - 家长档案补全
  - 单个孩子信息录入/更新
  - 默认上课地址录入/更新

请求体示例：

```json
{
  "displayName": "王女士",
  "emergencyContactName": "王先生",
  "emergencyContactPhone": "13900139000",
  "student": {
    "displayName": "小宇",
    "gradeLevel": "PRIMARY",
    "schoolName": "南开实验小学"
  },
  "defaultServiceAddress": {
    "label": "家里",
    "contactName": "王女士",
    "contactPhone": "13800138000",
    "province": "天津市",
    "city": "天津市",
    "district": "南开区",
    "street": "黄河道100号",
    "building": "3号楼501"
  },
  "onboardingCompleted": true
}
```

注意：

- 家长 onboarding 仍然是首登建档主入口
- 当前也开放了独立的孩子管理、地址管理、家长资料编辑
- 小程序可以把 onboarding 和后续资料维护分开处理

### `PATCH /auth/self/teacher-onboarding`

用途：

- 老师首登资料提交

请求体示例：

```json
{
  "displayName": "李老师",
  "bio": "8年钢琴启蒙经验",
  "employmentType": "PART_TIME",
  "baseHourlyRate": 260,
  "serviceRadiusKm": 8,
  "acceptTrial": true,
  "maxTravelMinutes": 40,
  "agreementAcceptedAt": "2026-04-07T12:00:00.000Z",
  "agreementVersion": "mvp-v1",
  "subjects": [
    {
      "subjectId": "subject_piano",
      "hourlyRate": 260,
      "trialRate": 199,
      "experienceYears": 8
    }
  ],
  "serviceAreas": [
    {
      "province": "天津市",
      "city": "天津市",
      "district": "南开区",
      "radiusKm": 8
    }
  ],
  "onboardingCompleted": true
}
```

注意：

- 老师 onboarding 负责首登建档
- 当前也开放了 `PATCH /auth/self/teacher-profile` 与 `teacher-availability/self/*`
- 小程序可以保留“我的资料”和“我的排班”两个独立入口
- `canAcceptBookings` 是否为 `true` 只看 `/auth/me`

### 6.4 科目

### `GET /subjects/active`

用途：

- 读取启用中的科目列表
- 下单页、onboarding 页的科目选择器使用

返回字段：

- `id`
- `code`
- `name`
- `description`
- `isActive`

### 6.5 老师详情与时段

当前 V1 已经恢复老师列表与老师搜索。

推荐链路：

- 先通过 `GET /teacher-availability/discover/teachers` 拉老师列表
- 或通过 `POST /teacher-availability/search` 按“上课时间 + 科目”筛老师
- 再进入 `GET /teacher-availability/teachers/:teacherProfileId/summary`
- 最后读取 `GET /teacher-availability/teachers/:teacherProfileId/windows`

如果已经在业务上下文里拿到 `teacherProfileId`，仍然可以直接进入老师详情。

### `GET /teacher-availability/discover/teachers`

用途：

- 发现页读取老师列表
- 每位老师附带少量未来可约时段预览

查询参数：

- `from` 可选，默认当前时间
- `to` 可选，默认 `from + 14 天`
- `windowLimit` 可选，默认 3

### `POST /teacher-availability/search`

用途：

- 按上课开始时间 + 科目搜索可接单老师

请求体：

```json
{
  "startAt": "2026-04-10T11:00:00.000Z",
  "subject": "钢琴",
  "durationMinutes": 60
}
```

说明：

- `subject` 可传科目名、科目 code、科目 ID
- 返回结果只包含在目标起始时间真的有匹配时段的老师

### `GET /teacher-availability/teachers/:teacherProfileId/summary`

用途：

- 读取老师最小公开详情
- 仅当该老师当前属于“可展示老师”时才会返回成功

返回字段：

- `id`
- `displayName`
- `bio`
- `baseHourlyRate`
- `district`
- `ratingAvg`
- `ratingCount`
- `experienceYears`
- `verificationStatus`
- `employmentType`
- `subjects`
- `subjectIds`
- `primarySubjectId`
- `credentials`

调用失败时的前端建议：

- `404`：按“老师当前不可展示或已下线”处理
- 不要在前端继续兜底展示旧缓存资料

### `GET /teacher-availability/teachers/:teacherProfileId/windows`

查询参数：

- `from`
- `to`

示例：

```http
GET /teacher-availability/teachers/teacher_xxx/windows?from=2026-04-08T00:00:00.000Z&to=2026-04-22T23:59:59.999Z
```

返回：

```json
{
  "teacherProfileId": "teacher_xxx",
  "windows": [
    {
      "startAt": "2026-04-10T11:00:00.000Z",
      "endAt": "2026-04-10T12:00:00.000Z",
      "timezone": "Asia/Shanghai",
      "weekday": "FRIDAY",
      "durationMinutes": 60
    }
  ]
}
```

说明：

- 这些窗口已经扣除了：
  - 老师不可约 block
  - 已有 booking
  - 已有 active hold
- 所以小程序直接用来展示和选择即可
- 返回空数组是合法结果，表示当前时间范围内暂无可预约时段

### 6.6 家长下单

### `POST /bookings/holds`

用途：

- 正式创建 booking 前，先锁定时段

请求体：

```json
{
  "teacherProfileId": "teacher_xxx",
  "studentProfileId": "student_xxx",
  "subjectId": "subject_piano",
  "serviceAddressId": "addr_xxx",
  "startAt": "2026-04-10T11:00:00.000Z",
  "endAt": "2026-04-10T12:00:00.000Z",
  "timezone": "Asia/Shanghai",
  "notes": "孩子零基础，希望节奏慢一点"
}
```

返回：

```json
{
  "id": "hold_xxx",
  "teacherProfileId": "teacher_xxx",
  "studentProfileId": "student_xxx",
  "guardianProfileId": "guardian_xxx",
  "subjectId": "subject_piano",
  "serviceAddressId": "addr_xxx",
  "startAt": "2026-04-10T11:00:00.000Z",
  "endAt": "2026-04-10T12:00:00.000Z",
  "status": "ACTIVE",
  "expiresAt": "2026-04-10T11:05:00.000Z",
  "timezone": "Asia/Shanghai"
}
```

关键规则：

- hold 默认只保留 5 分钟
- 若老师或学生该时段已有 booking 或 active hold，会创建失败
- 若该时段不在老师可售卖窗口内，会创建失败

特别注意：

- `notes` 目前不会落到 hold 响应里
- 真正持久化到 booking 的备注，请在下一步 `POST /bookings/from-hold` 再传一次

### `POST /bookings/from-hold`

用途：

- 消费有效 hold，正式生成 booking

请求体：

```json
{
  "holdId": "hold_xxx",
  "isTrial": false,
  "planSummary": "首节课先做基础评估",
  "notes": "门口有门禁，请提前联系"
}
```

创建成功后的默认状态：

- `status = PENDING_ACCEPTANCE`
- `paymentStatus = UNPAID`
- `paymentDueAt = 当前时间 + 30分钟`

说明：

- 家长只能消费自己创建的 hold
- hold 失效或过期后，必须重新选时段

### `GET /bookings/mine`

用途：

- 家长查询自己的订单列表

支持查询参数：

- `page`
- `pageSize`
- `status`
- `paymentStatus`
- `from`
- `to`

### `GET /bookings/mine/:id`

用途：

- 家长查询自己的订单详情

### `GET /bookings/:id`

用途：

- 通用订单详情接口
- 当前允许 `GUARDIAN` / `TEACHER` / `ADMIN` / `SUPER_ADMIN`

对小程序的建议：

- 家长侧优先继续使用 `GET /bookings/mine/:id`
- 老师待处理详情优先使用工作台详情接口

### 6.7 老师工作台

### `GET /teacher-workbench/bookings/pending`

用途：

- 老师待处理订单列表

当前只返回 3 类状态：

- `PENDING_ACCEPTANCE`
- `PENDING_PAYMENT`
- `CONFIRMED`

支持参数：

- `page`
- `pageSize`

返回中有 `summary`：

```json
{
  "summary": {
    "pendingAcceptance": 1,
    "pendingPayment": 2,
    "confirmed": 3
  }
}
```

### `GET /teacher-workbench/bookings/pending/:id`

用途：

- 老师查看待处理订单详情

限制：

- 只能看自己的订单
- 只允许看待处理范围内的订单

### `PATCH /bookings/:id/accept`

用途：

- 老师接单

请求体示例：

```json
{
  "acceptedAt": "2026-04-07T13:00:00.000Z",
  "planSummary": "首节课先做手型和节奏评估"
}
```

状态变化：

```text
PENDING_ACCEPTANCE
-> PENDING_PAYMENT
```

同时：

- `teacherAcceptedAt` 会写入
- `paymentDueAt` 会刷新为当前时间 + 30 分钟

特别注意：

- V1 只保留“接单”
- 不保留“拒单”统一响应接口
- 所以小程序端不要再调用 `/bookings/:id/respond`

## 7. 订单状态说明

当前后端完整枚举很多，但 V1 小程序主链建议只关注以下状态：

| 字段 | 当前会看到的值 | 说明 |
| --- | --- | --- |
| `status` | `PENDING_ACCEPTANCE` | 家长已下单，等待老师接单 |
| `status` | `PENDING_PAYMENT` | 老师已接单，等待支付能力接通或后续补齐 |
| `status` | `CONFIRMED` | 订单已确认 |
| `paymentStatus` | `UNPAID` | 当前 V1 默认仍以未支付为主 |
| `paymentStatus` | `PAID` | 仅在后续能力开放或后台推进时可能出现 |

对于小程序端：

- 不要再自行推导完整履约状态机
- 当前页面优先围绕：
  - 待接单
  - 待支付
  - 已确认

## 8. 建议小程序端立即调整的 service 映射

### 8.1 `services/auth.ts`

保留：

- `requestSmsCode`
- `verifySmsCode`
- `fetchMe`
- `fetchSelfBookingContext`
- `updateTeacherOnboarding`
- `updateGuardianOnboarding`

移除或停用：

- `loginWithWechatMiniapp`
- `switchRole`
- `updateStudentProfile`

### 8.2 `services/teacher.ts`

建议保留：

- `discoverTeachers`
  - 对接 `GET /teacher-availability/discover/teachers`
- `searchTeachers`
  - 对接 `POST /teacher-availability/search`
- `getTeacherPublicProfile(teacherProfileId)`
  - 对接 `GET /teacher-availability/teachers/:teacherProfileId/summary`
- `getTeacherAvailabilityWindows`

### 8.3 `services/booking.ts`

保留：

- `fetchSystemCapabilities`
- `createBookingHold`
- `createBookingFromHold`
- `listMyBookings`
- `getMyBookingDetail`

停用：

- `respondBooking`

老师端请改用：

- `GET /teacher-workbench/bookings/pending`
- `GET /teacher-workbench/bookings/pending/:id`
- `PATCH /bookings/:id/accept`

### 8.4 `services/availability.ts`

建议保留。

原因：

- 当前 V1 已开放老师自助排班管理
- 可继续承接 `self/config`、`weekly-rules`、`blocks`、`extra-slots`

### 8.5 `services/calendar.ts`

停用。

原因：

- `calendar` capability 默认关闭

### 8.6 `services/review.ts`

停用。

原因：

- `lessons`
- `teacherReviews`

这两组 capability 默认关闭

### 8.7 `services/dev-tools.ts`

停用。

原因：

- `testSupport` capability 默认关闭

## 9. 联调时必须遵守的约束

### 9.1 不要把 capability 写死在前端

推荐做法：

1. 小程序启动时请求 `GET /system/capabilities`
2. 页面按 capability 控制入口显隐
3. 即使 capability 本地判断为 true，真正动作前仍以后端返回结果为准

### 9.2 不要自己拼 readiness 逻辑

统一只看：

- `canBookLessons`
- `canAcceptBookings`

### 9.3 时间一律传 ISO 字符串

建议统一传带时区的 ISO 8601，例如：

```text
2026-04-10T11:00:00.000Z
```

不要只传本地格式字符串。

### 9.4 家长下单必须先 hold，再 from-hold

不要绕过 hold 直接创建订单。

当前 V1 对家长端开放的是：

```text
/bookings/holds
-> /bookings/from-hold
```

### 9.5 老师端只接单，不拒单

老师待处理页面只需要：

- 查看待处理订单
- 查看待处理详情
- 接单

不要再保留拒单按钮。

## 10. 给小程序端的最小改造清单

按优先级建议这样改：

1. 登录页改成短信验证码主入口，移除微信快捷登录。
2. 去掉角色切换接口依赖，登录时明确传 `requestedRole`。
3. 恢复发现页老师目录，对接 `/teacher-availability/discover/teachers`。
4. 恢复搜索页，对接 `/teacher-availability/search`。
5. 新增老师详情接口 `/teacher-availability/teachers/:teacherProfileId/summary`。
6. 家长下单页保留：
   - `/subjects/active`
   - `/auth/self/booking-context`
   - `/teacher-availability/discover/teachers`
   - `/teacher-availability/search`
   - `/teacher-availability/teachers/:id/windows`
   - `/bookings/holds`
   - `/bookings/from-hold`
7. 老师端工作台保留：
   - `/teacher-workbench/bookings/pending`
   - `/teacher-workbench/bookings/pending/:id`
   - `/bookings/:id/accept`
8. 可恢复：
   - 家长多孩子管理
   - 家长多地址管理
   - 老师资料独立编辑
   - 家长资料独立编辑
   - 老师排班管理
9. 继续下掉：
   - 日历
   - lesson
   - review
   - dev tools
   - 拒单
   - 支付推进
   - 取消 / 改约 / 争议

## 11. 本文档覆盖范围外的事项

以下内容在当前 V1 不作为小程序联调目标：

- 微信小程序登录
- 微信 App 登录
- 角色切换
- 实名流程页面
- 支付页面
- 取消 / 改约 / 争议
- lesson 记录
- 教师评价
- 课表
- CRM
- QA 测试工具

如果后续 capability 重新打开，再单独补一版文档，不要提前接入。
