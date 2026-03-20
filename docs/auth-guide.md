不止是配 `env`。你还需要把数据库 schema 应用掉，并按你想启用的能力准备第三方平台。最实用的方式是按功能拆目标。

**先说结论**
如果你现在只想把后端跑起来并先验证邮箱登录，最小闭环是：

1. 配数据库和 JWT 相关 env
2. 执行一次 Prisma migration
3. 启动后端
4. 用 `/auth/email/register` 和 `/auth/email/login` 测

如果你要继续开短信或微信，还要分别补对应平台配置。

**功能依赖图**
- 邮箱注册/登录
  - 必需：`DATABASE_URL`、`DIRECT_URL`、`AUTH_JWT_SECRET`
  - 建议：`AUTH_CODE_SECRET`
  - 不依赖：腾讯短信、微信开放平台
- 短信验证码登录
  - 开发可用：只靠数据库 + JWT 就能跑，短信验证码会打印到后端日志
  - 生产必需：腾讯云短信相关 env 全配齐
- 微信 App 快捷登录
  - 必需：`WECHAT_APP_APP_ID`、`WECHAT_APP_SECRET`
  - 同时需要：Flutter 客户端接微信 SDK 并拿到 `code`
  - 注意：这是“App 登录”，不是小程序登录
- 绑定手机号
  - 开发可用：不配腾讯短信也能走，验证码看后端日志
  - 生产：依赖腾讯短信
- 角色切换 / 自助更新资料
  - 只依赖数据库 + JWT
- 管理后台继续用邮箱密码
  - 必需：数据库 + JWT + `ADMIN_CORS_ORIGIN`

**你要配的 env，按优先级分**
在 [`.env.example`](/Users/luke/TuneTime/TuneTime-Backend/.env.example) 里已经列好了。

第一组：后端必须有
- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_JWT_SECRET`
- `ADMIN_CORS_ORIGIN`

第二组：强烈建议补上
- `AUTH_CODE_SECRET`
- `AUTH_JWT_ISSUER`
- `AUTH_JWT_AUDIENCE`

第三组：短信功能
- `AUTH_CODE_TTL_SECONDS`
- `AUTH_CODE_RESEND_COOLDOWN_SECONDS`
- `AUTH_CODE_MAX_ATTEMPTS`
- `TENCENT_SMS_SECRET_ID`
- `TENCENT_SMS_SECRET_KEY`
- `TENCENT_SMS_REGION`
- `TENCENT_SMS_SDK_APP_ID`
- `TENCENT_SMS_SIGN_NAME`
- `TENCENT_SMS_TEMPLATE_LOGIN`
- `TENCENT_SMS_TEMPLATE_PHONE_BIND`

第四组：微信 App 登录
- `WECHAT_APP_APP_ID`
- `WECHAT_APP_SECRET`

**推荐你按这个顺序推进**
第一阶段：先跑邮箱
- 配好数据库和 JWT
- 执行 migration
- 启动服务
- 验证 `/auth/email/register`、`/auth/email/login`、`/auth/me`

第二阶段：再开短信
- 不配腾讯短信，先用开发模式
- 请求 `/auth/sms/request-code`
- 去后端日志里看验证码
- 用 `/auth/sms/verify` 走通注册登录一体
- 都通了再接腾讯短信

第三阶段：最后开微信
- 去微信开放平台申请 App
- 拿到 `AppID/AppSecret`
- Flutter 端接微信 SDK，换到 `code`
- 后端打 `/auth/wechat/app-login`
- 再测手机号绑定 `/auth/bind/phone/request` 和 `/auth/bind/phone/confirm`

**短信这块你最容易踩的点**
- 现在代码支持“无腾讯短信 env 时走开发模式”，验证码会打印到日志，不会真实发送
- 一旦你想上真短信，腾讯模板要和代码参数一致
- 当前发送参数是两个模板变量：
  - 验证码
  - 有效分钟数
- 所以腾讯模板内容必须按这个格式设计

**微信这块你最容易踩的点**
- 后端只负责“拿 `code` 去微信换 `access_token/openid/unionid`”
- `code` 不是后端自己生成的，必须由 Flutter App 端微信授权拿到
- 所以只配后端 env 还不够，移动端必须同时接入微信 SDK
- 如果 Flutter 端还没接，你现在先没法真正测通 `/auth/wechat/app-login`

**除了 env，还必须做的一步**
这次 auth 改了 Prisma schema，所以你需要把数据库升级掉。至少做一次：

```bash
cd /Users/luke/TuneTime/TuneTime-Backend
/Users/luke/.nvm/versions/node/v22.16.0/bin/node ./node_modules/prisma/build/index.js migrate deploy
```

开发环境如果你习惯 `db push` 也可以，但既然已经有 migration，优先 `migrate deploy`。

**我建议你现在的最小目标**
先只做这 3 件事：
- 配好数据库/JWT env
- 跑 migration
- 先用邮箱和开发模式短信把 auth 主链打通

等这两条都稳定了，再去接腾讯短信和微信 App 登录。这样节奏最稳。

如果你愿意，我下一步可以直接给你一份“可复制的 `.env` 填写模板 + 本地验证 checklist + curl/Postman 测试顺序”。