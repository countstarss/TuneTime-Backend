# TuneTime 前后端新增代码评审

更新时间：2026-04-04

## 评审范围

本次评审基于两个仓库当前未提交的新增/修改代码：

- 后端：`/Users/luke/TuneTime/TuneTime-Backend`
- 前端：`/Users/luke/TuneTime/TuneTime-WX`

重点关注的新增能力是“小程序微信快捷登录 + 最小用户会话 + 浏览态 gating 演示”。

## 一句话结论

这批代码已经把“小程序拿 code -> 后端换微信身份 -> 自动创建最小用户 -> 返回业务 accessToken -> 前端恢复会话并展示 gating”这条主链路接通了。

静态检查和后端测试都通过，说明这批改动在工程层面是自洽的；但仍有 3 个值得尽快处理的风险：

1. `WECHAT_APP` 和 `WECHAT_MINIAPP` 当前按不同 provider 建账，同一微信用户未来跨端登录时可能被拆成两个用户。
2. 小程序默认 API 地址写死为 `http://127.0.0.1:5678`，只适合本地开发，不适合真机/预览/线上环境。
3. 小程序启动时会并发触发两次会话恢复，存在重复请求和状态竞争风险。

## 后端新增了什么

### 1. 新增微信小程序登录接口

新增接口：

- `POST /auth/wechat/miniapp-login`

核心行为：

- 接收 `code` 和 `requestedRole`
- 校验 `WECHAT_MINIAPP_APP_ID`、`WECHAT_MINIAPP_SECRET`
- 调微信 `jscode2session`
- 拿到 `openid/unionid`
- 复用统一的 `completeWechatLogin()` 收敛登录逻辑
- 给首次登录用户创建最小用户，并按 `requestedRole` 补角色壳子
- 返回业务 `accessToken + user`

关键文件：

- `src/auth/auth.controller.ts`
- `src/auth/auth.service.ts`
- `src/auth/wechat-auth.service.ts`
- `src/auth/dto/auth.dto.ts`

### 2. 把微信 App 和微信小程序区分成两个 provider

新增常量：

- `WECHAT_MINIAPP_PROVIDER = 'WECHAT_MINIAPP'`

同时保留原有：

- `WECHAT_APP_PROVIDER = 'WECHAT_APP'`

对应效果：

- 后端现在能区分“微信开放平台 App 登录”和“微信小程序登录”
- `loginMethods` 里也会回传 `WECHAT_MINIAPP`

关键文件：

- `src/auth/auth.constants.ts`
- `src/auth/auth.types.ts`
- `src/auth/auth.service.ts`

### 3. 身份绑定逻辑改成按 provider 处理

`IdentityLinkingService` 现在不再把所有微信登录都视为同一类账号，而是：

- 查询微信账号时按 `provider + unionId/openId` 查
- upsert 账号时按 `provider + unionId/openId/providerAccountId` 查

这让“小程序账号”和“微信 App 账号”在表里能并存，但也带来了跨端身份归并风险，后面风险章节会单独展开。

关键文件：

- `src/auth/identity-linking.service.ts`

### 4. 补了配置和文档

新增 env：

- `WECHAT_MINIAPP_APP_ID`
- `WECHAT_MINIAPP_SECRET`

并更新了：

- `.env.example`
- `README.md`
- `docs/auth-guide.md`

整体文档导向也变成了：

- 前期优先用小程序微信登录进入浏览态
- 短信/密码/微信 App 登录都可以后置

### 5. 补了后端测试

`auth.service.spec.ts` 增加了小程序登录的委托和响应断言，验证：

- `AuthService.loginWithWechatMiniapp()` 会委托 `WechatAuthService.loginWithMiniappCode()`
- 返回的 `user.loginMethods` 包含 `WECHAT_MINIAPP`

## 前端新增了什么

### 1. 从模板首页改成了真实登录入口页

首页已经不再是官方示例里的头像昵称 demo，而是：

- 先选默认进入身份：`GUARDIAN` / `TEACHER`
- 点击按钮执行微信快捷登录
- 登录后展示当前会话、身份、登录方式
- 用提示窗模拟“预约 / 下单 / 接单”的 gating

关键文件：

- `miniprogram/pages/index/index.ts`
- `miniprogram/pages/index/index.wxml`
- `miniprogram/pages/index/index.wxss`

### 2. 新增认证服务层和请求封装

新增文件：

- `miniprogram/services/auth.ts`
- `miniprogram/utils/request.ts`
- `miniprogram/utils/session.ts`
- `miniprogram/utils/config.ts`
- `miniprogram/types/auth.ts`

拆分后的职责：

- `services/auth.ts`：封装 `wx.login()` + `/auth/wechat/miniapp-login` + `/auth/me`
- `utils/request.ts`：统一请求和错误提取
- `utils/session.ts`：缓存 `tt_access_token` 和默认选中的角色
- `utils/config.ts`：解析 API base URL
- `types/auth.ts`：对齐后端会话与 onboarding 数据结构

### 3. 增加了全局会话恢复能力

`app.ts` 里新增了：

- `bootstrapSession()`
- `loginWithWechatMiniapp()`
- `logout()`

当前流程是：

- 小程序启动时读取本地 token
- 如果有 token，则调用 `/auth/me`
- 恢复成功就把 session 放进 `globalData`
- 恢复失败就清理本地 token

### 4. UI 层开始围绕“浏览态”设计

首页现在的文案和行为已经明显围绕新的产品策略：

- 先让用户进应用
- 不急着强迫填完整资料
- 到关键动作才拦截

这部分和后端 `onboardingState.teacher/guardian/student` 的设计已经形成了可联动关系。

## 现在这条链路是怎么跑通的

1. 用户在首页选择家长或老师身份。
2. 小程序调用 `wx.login()` 拿微信 `code`。
3. 小程序把 `code + requestedRole` 发到后端 `/auth/wechat/miniapp-login`。
4. 后端调用微信 `jscode2session`。
5. 后端按 `openid/unionid` 查账号。
6. 如果是首次登录，则创建最小 `user`，并补一个对应的角色壳子。
7. 后端签发业务 `accessToken`，返回完整 `AuthResponse`。
8. 小程序缓存 `tt_access_token`。
9. 小程序用返回的 `user` 渲染“当前会话状态”和“关键动作 gating 提示”。

## 风险检查

### P1: 微信 App 和小程序账号当前不会自动归并

现状：

- 小程序登录走 `WECHAT_MINIAPP`
- 微信 App 登录走 `WECHAT_APP`
- 查询和 upsert 都按 `provider` 做了强过滤

直接影响：

- 同一个用户如果先用小程序登录，再用微信 App 登录，即使两边拿到的是同一个 `unionId`，当前代码也不会把它们识别成同一个账号。
- 最终效果可能是生成两个 `user`，两边的角色、资料、预约记录和后续业务数据都会分叉。

为什么会发生：

- `findUserByWechatIdentity()` 查 `unionId/openId` 时带了 `provider`
- `upsertWechatAccount()` 查重时也带了 `provider`

涉及文件：

- `TuneTime-Backend/src/auth/wechat-auth.service.ts`
- `TuneTime-Backend/src/auth/identity-linking.service.ts`

建议：

- 如果产品目标是“同一微信主体在 App 和小程序侧共用一个业务账号”，应该引入“跨 provider 的 unionId 归并策略”。
- 最稳妥的方式是把“微信生态主体”抽象成统一 identity，再把 `WECHAT_APP` / `WECHAT_MINIAPP` 作为 channel 记录，而不是作为完全隔离的主身份。

### P2: 默认 API 地址只适合本地开发

现状：

- `miniprogram/utils/config.ts` 默认把 API base URL 写成 `http://127.0.0.1:5678`

直接影响：

- 微信开发者工具里，如果没放开域名校验或没手动改 storage，调用就可能失败。
- 真机、预览版、体验版里，`127.0.0.1` 指向的是设备本机，不是开发电脑。
- 小程序正式环境通常还要求 HTTPS 和合法域名白名单。

这意味着：

- 当前代码非常适合“本地开发联调”
- 但不适合直接拿去做预览包或线上验证

建议：

- 至少区分 `dev / preview / prod` 三套地址来源。
- 不要依赖 `127.0.0.1` 作为默认值，可以改为显式配置缺失时报错，避免误以为“已经能用”。

### P2: 启动时会并发恢复两次会话

现状：

- `app.ts` 的 `onLaunch()` 会主动调用一次 `bootstrapSession()`
- 首页 `onLoad()` 又会再调用一次 `refreshSession()`，而 `refreshSession()` 内部再次调用 `app.bootstrapSession()`

直接影响：

- 页面初始化阶段可能出现两次 `/auth/me` 请求
- 如果两个请求完成顺序不同，可能产生状态竞争
- 更极端一点，如果一个请求成功、另一个请求失败，晚回来的失败结果会把刚恢复好的 session 清掉

建议：

- 在 `App` 层缓存一次 in-flight promise
- 页面只订阅/等待现有恢复任务，不要再次发起新的恢复请求

## 目前没有看到的明显问题

下面这些方面当前看起来是健康的：

- 后端接口、DTO、`loginMethods`、文档、env 说明是一致的
- 小程序端类型定义和后端响应结构能对上
- 后端新增测试已覆盖核心 service 委托逻辑
- 本次改动没有看到明显的鉴权绕过
- 小程序没有把微信 `session_key` 落本地，安全上是对的

## 我实际做过的验证

已执行并通过：

- 后端测试：`pnpm test -- auth.service.spec.ts`
- 后端构建：`pnpm build`
- 小程序 TypeScript 检查：`npx tsc --noEmit`

说明：

- 这能证明当前代码在编译和单测层面没有直接破裂
- 但还不能替代真实微信环境联调

## 建议的下一步

如果你要继续推进这条链路，我建议按这个顺序收口：

1. 先决定“App 和小程序是否必须共用同一微信业务账号”。
2. 如果答案是是，优先修 identity 归并策略，再继续放大登录入口。
3. 把 API 地址配置正规化，至少支持开发 / 预览 / 生产三档。
4. 给 `bootstrapSession()` 做单飞控制，消掉双请求和竞态。
5. 再去接真实的预约页、下单页、老师工作台，把现在首页里的 gating 判定下沉成可复用逻辑。
