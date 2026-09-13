# manxiang · 漫想江湖写作陪伴

用户是作者：先确认世界观和主角，与主角讨论重大事件，确认节点后，由固定版本的金庸 skill 扩写小说。服务端保存故事、章节、人物、事实、未解伏笔及历史版本。

- `/`：江湖写作工作台。
- `/comic`：原有漫画工作台，继续支持剧本、分镜和漫画生成。
- [产品需求](docs/PRD-写作陪伴助手.md) · [开发与验证说明](docs/开发交付.md)

## 本地启动

需要 Node.js 22.13+。安装后先构建一次以生成本地数据库配置：

```bash
npm run install:ci
npm run build
```

**仅在首次建立本地数据库时**，应用初始迁移；已有数据库不要重复执行这份 SQL：

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_wooden_nehzno.sql
```

启动：

```bash
npm run dev
```

打开终端打印的地址（默认 `http://localhost:5173`）。当前开发机已应用初始迁移，可直接启动。存档位于项目本地的 `.wrangler/state`，此目录不会上传 GitHub。

## 创作流程

1. 创建故事，输入不少于 8 字的江湖方向。
2. 在“连接 AI”中选择 DeepSeek 并填写自己的 API Key；默认模型为 `deepseek-flash`，也可切换 OpenAI（`gpt-4.1-mini`）。
3. 生成、编辑并确认世界观，再生成和确认主角与必要配角。
4. 与主角讨论当前事件，修改并确认事件卡。
5. 点击“把这个节点写成小说”。节点计划在正文提交前不会改变故事事实。
6. 继续下一个节点；也可以润色某个已写事件，比较候选后接受。
7. 手动整理章节，或在上下文达到阈值时自动整理。故事与原始讨论持续保存。
8. 随时导出 Markdown 或 JSON；在“章节与记忆”中导出历史快照。

API Key 只在页面内存中保留，经本站转发到所选服务的固定官方接口；不进入数据库或日志。刷新后需要重新填写。API 调用按使用者账户计费。作品使用当前浏览器的 HttpOnly 随机凭证访问，清除浏览器数据可能失去匿名存档入口。

## 金庸 skill

来源：[Wunicheng233/jin-yong-perspective](https://github.com/Wunicheng233/jin-yong-perspective)。固定 commit：`bfc14e72d73fe8ebe5b3e73a548b29d238027468`。

原文与来源记录位于 `vendor/jin-yong-perspective/`；服务端加载同一内容的构建模块，并在正文任务开始时核验 SHA-256。适配规则要求输出原创江湖小说，不让主角对话切换成技能顾问身份。模型与技能不负责直接提交正式状态，宿主工作流执行确认、校验和保存。

## 检查

```bash
npm test
npm run typecheck
npm run build
```

启动本地服务和数据库后，可以运行无付费调用的 API 验证：

```bash
npm run test:api
```

测试会创建独立临时存档，并输出清理 SQL 到 `/private/tmp/manxiang-smoke-cleanup.sql`。执行下列命令仅清理该次测试生成的记录：

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file /private/tmp/manxiang-smoke-cleanup.sql
```

## 部署说明

GitHub 托管源码。应用依赖 Worker 服务端和 D1 数据库，不能仅发布静态页面得到完整功能。构建产物兼容现有 Sites / Cloudflare Worker 流程；发布环境必须绑定 `DB` 并应用 `drizzle/` 中尚未执行的迁移。

尚未部署新的在线写作版本；真实模型生成尚未使用有效用户 Key 做付费联调。DeepSeek 接口参考 [官方接入指南](https://api-docs.deepseek.com/) 与 [JSON 输出说明](https://api-docs.deepseek.com/guides/json_mode/)。

## DeepSeek 配置

在 [DeepSeek 平台](https://platform.deepseek.com/api_keys) 创建 API Key，在写作工作台右上角“连接 AI”选择 DeepSeek 并保存，然后点击“生成世界观”开始使用。刷新页面后需重新填写；切换服务会清除旧 Key。无需修改代码或提交密钥到 GitHub。

所有写作 Agent 共用所选服务，使用 JSON 输出、结构校验和失败重试。DeepSeek 请求关闭思考模式，使用 `max_tokens`；OpenAI 保留原参数。漫画工作台也支持选择 DeepSeek 生成剧本与分镜；角色参考图和漫画画面仍由 OpenAI 绘图接口生成，需单独填写 OpenAI Key。密钥不会跨服务转发。

## 本地 OpenAI 网络连接

本地 Vite 开发中的 Worker 不自动沿用 macOS 系统代理。开发启动现在检测已启用的系统 HTTPS 代理，通过仅监听回环地址、带随机凭证的转发服务连接 OpenAI 官方接口。此服务只允许剧本、角色参考图与绘图三个固定接口，不记录密钥或正文；生产构建不启用转发服务，也不包含本机地址或转发凭证。

可以通过 `MANXIANG_AI_PROXY` 指定开发代理，也可设置为 `off` 禁用。修改系统代理后重启开发服务器。代理客户端须保持运行。DeepSeek 保持直接访问。

开发服务启动后运行 `node scripts/check-ai-network.mjs`：使用固定无效测试 Key 验证真实绘图接口的网络链路，不产生付费生成；它不代表真实 Key 的余额、模型权限或出图质量验证通过。

## OpenAI-Next 兼容接口

“连接 AI”中的 OpenAI 接口地址可选择 `https://api.openai-next.com/v1`。此地址是第三方服务，选择后请填写该平台提供的 Key；OpenAI 文本、角色参考图和漫画绘制会发送到该地址。DeepSeek 仍使用 DeepSeek 接口。切换地址会清除对应的旧 Key；默认仍为官方接口，不会自动转发官方密钥到第三方。

兼容接口是否支持当前 `gpt-4.1-mini`、`gpt-image-1`、JSON Schema 和图片编辑，取决于平台与账户权限；尚未使用该平台的真实 Key 完成生成验证。

## 日系彩漫画风 skill

选择“日系彩漫”后，角色参考图、漫画分格和单格重绘使用 `skills/japanese-color-comic/` 的模板，由 `lib/japanese-color-comic.ts` 确定性填充当前角色卡与分镜，再提交给已选择的图片接口，无需额外文本模型调用。模板包含手绘电影质感、角色一致性与反向约束，默认生成 1024×1024 方形图片。其他画风沿用原提示词与尺寸。

切换画风会同步更新当前作品，已有参考图和画面标记为待更新；原图保留到生成成功。选择选项本身不发起付费生成，点击参考图生成、绘制漫画或重绘时执行。

图片 URL 现在支持第三方公开 HTTPS CDN，不再要求固定下载域名。下载时检查公网 DNS、每次重定向、图片类型与大小，不转发 API Key。Vite 本地开发会让图片下载及 DNS 检查使用已配置的本机代理，避免生成接口可用但 CDN 直连失败。已用真实公开 WebP CDN 图片验证下载及数据转换；真实用户接口的付费出图仍需账户验证。
