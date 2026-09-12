# manxiang · 漫想 AI 漫画工作台

一句故事 → 可编辑剧本 → 角色设定与参考图 → 4/6/8 格分镜 → 逐格绘制与 PNG 长图导出。

## 本地运行

Node.js 22.13+。首次安装：`npm run install:ci`，启动：`npm run dev`，打开终端打印的地址。

「体验示例」载入预先编写的四格故事和一张 AI 插画；不会伪装成即时生成。点击「连接 AI」，输入自己的 OpenAI API Key，然后生成新作品。Key 仅存在页面内存，每次请求经本站服务端传给固定的 OpenAI 官方地址；不写日志、localStorage 或项目文件。刷新会丢失 Key 和作品，请在离开前导出剧本/分镜或完整 PNG 漫画。

文本模型 `gpt-4.1-mini`，图像模型 `gpt-image-1`。按 API 账户计费，账户需具备对应权限。未填写 Key 时不调用模型。参考图每次重新生成都会标记现有分镜图过期；之后通过 Images Edits API 提供同一参考图逐格绘制。修改对白仅影响排版，修改画面描述只标记该格过期。修改剧本要求显式重拆分镜。中途失败保留前面成功的画面，后续继续只生成缺失或过期的格子。

导出包括 Markdown 剧本与分镜、包含所有画面和对白的 PNG 长图。没有服务端项目存储或跨设备协作。

## 验证

`npx tsc --noEmit`

`node --input-type=module -e 'import {build} from "esbuild"; await build({entryPoints:["tests/generation.test.ts"],bundle:true,platform:"node",format:"esm",outfile:"/tmp/comic-generation-test.mjs"});'`

`node --test /tmp/comic-generation-test.mjs`

`npm run build`

测试使用模拟供应商响应，覆盖 schema 校验、分镜数、错误脱敏、角色参考图传递。未使用用户 Key 进行付费的真实模型联调。WebMCP 提供读取作品、切换编辑阶段两个工具；当前工具环境没有支持该协议的验证上下文，尚未实机验证。

## API 合同来源

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI Image Generation](https://developers.openai.com/api/docs/guides/image-generation)

## 已知边界

角色参考图能帮助保持一致性，不能保证每个细节完全一致。单次请求超时后，供应商可能仍在处理；手动重试可能产生另一笔 API 用量。图像在当前页面内存中处理，适用于短篇。私人部署是当前交付范围，不具备公共多租户服务的账户、配额与计费管理。
