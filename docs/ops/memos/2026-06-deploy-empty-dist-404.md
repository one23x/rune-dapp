# 部署空 dist → 整站 404(「找不到网页」)

## 问题
`wrangler pages deploy` 之后,Pages 站点**直接打开/刷新深链 404**(浏览器「找不到网页」),严重时 root `/` 也 404。表现:在 app 里**点链接能进**(客户端路由),但**直接打开或刷新** `/app/strategy/hl`、`/app/profile` 等深链 → 404。wrangler 输出里有个 tell:`✨ Success! Uploaded 0 files (5 already uploaded)`(只传了 _headers/_redirects 等几个,没有 index.html/assets)。

## 根因
deploy 时 `dist/public` 是**空的或残缺的**。并发/残留的 `vite build`(`build:mainnet`)在另一个进程里 `emptyOutDir` 清空了输出目录,恰好在 `wrangler pages deploy dist/public` 读取目录时没内容 → 部署出一个**不含 index.html/assets 的残缺 deployment** → 静态资源全 404;SPA fallback(`dist/public/_redirects` 的 `/* /index.html 200`)也因为没有 index.html 可回退而失效。
- 触发场景:连续多次"改→build→deploy",前一个后台 build 还没结束就又 kick 了一个,或 deploy 在 build 写 dist 的中途执行。
- 注意区分:SPA 深链本就靠 `_redirects` 的 catch-all 把 `/app/*` 回退到 index.html;`_routes.json` `include:["/engine/*"]` 只让 /engine/* 跑 Function。**只要 index.html 在,深链就该 200** —— 深链 404 = 部署残缺,不是路由配置问题。

## 解决方案
1. **deploy 前自检**(必做):
   - `ls dist/public/assets | wc -l` → 应 ~240+
   - `test -f dist/public/index.html && echo ok || echo MISSING`
   - 可选:`grep -rl "<本次改动的已知字符串>" dist/public/assets` 确认新代码进了包
2. **不让多个 build 并发**:deploy 前 `pkill -f "vite build"`,`rm -rf dist`,跑**单次**干净 `pnpm build:mainnet`,等日志出现 `✓ built in` 再 deploy。
3. 修复 = 干净重 build + 重部署到同一分支:`wrangler pages deploy dist/public --project-name rune-lastest --branch <main|feat-decision-log-preview> --commit-dirty=true`(CF creds 从 `prod-access.env` export `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`)。
4. 验证:`curl -s -o /dev/null -w '%{http_code}' https://<host>/app/profile` 应 **200**。用**无 CF Access** 的 `rune-final.pages.dev`(main)或 `<branch>.rune-final.pages.dev`(预览)验;`rune-ai.io`/`rune.one-agents.com` 挂 CF Access,公网 curl 返 403 是正常,别误判成挂了。

## 进度/状态
- 2026-06-18 **已缓解(纪律 + 部署前自检)**。当时把 `feat-decision-log-preview` 部署成空 dist(Uploaded 0 files)→ 整站/深链 404(用户报「找不到网页」);`rm -rf dist` + 单次干净 `build:mainnet` + 重部署后 `/app/*` 全 200。无代码改动,纯部署流程问题。
