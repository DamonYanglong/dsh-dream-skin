# src/client — 浏览器半侧

`apply(ctx)` 流程（DESIGN §2，M1 实测校准后）：

1. 骨架样式表注入 — `<style data-plugin-css="dsh-dream-skin/skeleton">`，
   规则全部挂在 `html[data-dsb-on]` 门控上（off = 无匹配 = 完整还原）
2. `ctx.configForms.get("dsh-dream-skin")` 订阅 volatile `theme` 字段
   （镜像未就绪时视为 off）
3. `applyTheme(id)` — body 内联 `--dsb-*` 画布参数
   + `ctx.theme.overrideTokens("dsh-dream-skin", tokens)` 注册覆盖层
   （每 token `{light, dark}`，明暗切换由 theme runtime 自动取值，
   scrim 端点组由 CSS `:has(body[data-ds-dark-theme])` 自动切换，零 JS）
4. readability guard（M3）

模块划分：`bundle.template.js`（factory 模板，构建注入 CSS/token/资产 URL）/
`skeleton.css`（唯一全局样式表）/ `guard.ts`（M3）。

产物形态（`scripts/build.mjs`）：
- `lib/client.js` = `window.__ModuleLoader__.load({id, factory})` 注册形态，
  factory 物化时才执行副作用；无任何外部模块请求（服务依赖走 cordis
  `inject: ["theme", "configForms"]`），因此 `dsh.client.inject` 无需声明。
- 背景图引用编译为 `require.asset("plugins/dsh-dream-skin/assets/<name>-<sha1:12>.<ext>")`。
