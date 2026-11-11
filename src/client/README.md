# src/client — 浏览器半侧（M1 起）

`apply(ctx)` 流程（DESIGN §2）：

1. `install(skeleton.css)` — CSS Modules 骨架（scrim 参数化变量版）
2. `ctx.theme` override layer 注册（明/暗双值 token map，构建期生成）
3. `applyTheme(id)` — body 内联 `--dsb-*` + 重绑变量 + 背景图 URL
4. volatile Config `theme` 字段消费 + `theme/change` 监听（明暗切换刷新参数）
5. readability guard（M3）

模块划分：`index.ts`（apply）/ `skeleton.css` / `guard.ts`（M3）/
`generated/themes.ts`（构建产物，勿手改）。
