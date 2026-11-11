# DSH 插件能力调研笔记（M0 基线）

> 结论来源：开源仓库文档（github.com/deepseek-ai/deepseek-harness）+ 本机
> `DeepSeek Harness.app` 的 `app.asar` 内插件包源码与 README（版本 0.2.2-rc.1）。
> 本文件是 DESIGN.md 决策的证据链，标注了每条结论的出处。

## 1. 插件体系总览

- Cordis 插件模型：`export function apply(ctx)`；宿主侧组合由 profile YAML（`cordis.patch.yml` + overlay patch）声明。
  教程：[01-first-plugin](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-tutorial/01-first-plugin.zh.md)、
  [07-into-the-harness](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-tutorial/07-into-the-harness.zh.md)。
- 服务缝隙全景：[capability-seams](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/capability-seams.zh.md)
  （100+ `ctx.*` 服务；换肤只涉及其中的 `theme`、`settings`、`layout` 客户端面）。
- 浏览器插件包：`package.json` 声明 `dsh.client`（`platform: 'web'`、`inject`、可选 `immediately`），
  导出 `./client` bundle；宿主半侧扫描组合启动图，浏览器惰性加载。
  来源：client-modules README（asar 内 + 仓库 `packages/client/client-modules/README.zh.md`）。

## 2. 与换肤相关的四个已验证机制

### 2.1 资产管线（背景图的正门）

- `"./assets/*": "./lib/assets/*"` 导出 → `/plugins/<package>/assets/<emitted path>` 路由。
- 构建产出带内容 revision 的文件名（SHA-1 前 12 位），CSS `url()` 编译为
  `require.asset("plugins/<pkg>/assets/…")` 同步调用；路径段 `encodeURIComponent` 后再编码
  `!'()*`。
- 只允许 `.svg/.png/.webp/.jpg/.jpeg`；响应 `immutable` 缓存 + etag；SVG 附 `script-src 'none'`。
- 活例：`dsh-client-ui-chat` 的 `running-whale@2x-06738fa29b2f.png`（asar 内验证）。
- 未激活包的资产路径返回 404 → 皮肤资产随插件启用/禁用自然上下线。

### 2.2 插件样式注入

- CSS Modules 编译进 client bundle，factory 物化时注入
  `<style data-plugin-css="<pkg>/<file>">`；插件卸载/HMR 移除（ui-theme `lib/client.js` 源码验证）。
- 规范层面（web-styling.zh.md）：功能组件不得定义全局主题/主题选择器——皮肤是刻意的例外，
  见 DESIGN §11 R4。

### 2.3 theme runtime 与 override layer

- `ctx.theme`（ui-theme 提供，ui-layout 呈现器消费）：`register({id, colorScheme, tokens, icons})`
  注册整主题；第三方 id 不进内置设置 schema（light/dark/system）。
- **override layer**（client.js 源码验证）："在活动主题之上叠一层 token 覆盖——基主题不动，
  层按 seq 序组合、逐 token 后者胜，移除该层恢复其覆盖的内容"；每 token 为
  `{light, dark}` 双值 map，按活动 colorScheme 取值；re-register 同 source 即整层替换。
  → DESIGN 决策 D1 的依据：皮肤用 override layer，不动内置偏好。
- 呈现器把别名 token 写为 body 内联变量（ui-layout README「主题呈现」节）→ 覆盖层值会
  正常落到 DOM。
- dispose 语义：register 的主题若背书当前 preference 会重置为默认——又一个不用 register 的理由。

### 2.4 设置面

- volatile Config 字段自动生成设置表单行（dsh-settings README）：皮肤只需声明
  `theme: Schema.string().default('off')` 类字段 + `.volatile()`，表单/持久化/revision 冲突
  全部由官方机制承担。
- 设置页是 `main` keyed slot 的全局面板 → guard 的"设置页剥皮"可监听面板切换实现，无需
  ZCode 时代的文本探测（apply.mjs `settingsOpen()`）。

## 3. 结构选择器现状（asar 验证）

- DSH 组件 = CSS Modules 哈希类名（如 `RrNL-q_group`），**无 data-testid**。
- 存在的稳定属性：`data-side`（消息侧）、`data-composer-*`、`data-queue-dock`、`data-phase`、
  `data-selected`、`data-dragging`、`data-input-modality`（html 级）、`data-ds-dark-theme`（body 级）、
  `data-platform`（html 级）。
- 布局三栏（ui-layout）：侧栏 264–420px / `main` keyed slot / rightbar；`shell.bottom`、`shell.leading`、
  `shell.overlay` 座位。皮肤主要需要"侧栏容器"与"会话 vs 全局面板"的判据 → M1 探查，登记
  `docs/selectors.md`。

## 4. 分发渠道

- 本地：profile patch（`cordis.patch.yml` overlay / `--patch`）。
- npm：plugin-manager `installBundle` 安装任意 npm 包为 profile bundle。
- plugin-market：用户自配索引（`dsh-plugin-market-index` 格式校验），Discover 浏览安装；
  索引条目支持分类/标签/多语言详情。官方 bundle 列表（24 个）无任何皮肤类插件——
  赛道空白。

## 5. 版本事实（asar 提取，2026-11-11）

- DSH 桌面版插件包版本：`0.2.2-rc.1`；`@deepseek-ai/*` 包共 332 个。
- `--dsw-alias-*` token 共 **114 个**（完整清单与映射处置见 [token-map.md](token-map.md)），
  提取方法：
  ```bash
  node -e '<解析 asar header，正则匹配 --dsw-alias-[a-z0-9-]+:\s*([^;}]+)>'
  ```
- 滚动条重绑先例：`--dsh-scrollbar-thumb(-hover)` 在 body 绑 l1、高层级表面自绑 l2、
  `transparent` 为合法目标（ui-theme README「滚动条重新绑定」节）——DESIGN §6.4 的依据。

## 6. 明确排除的能力（不做）

- `ctx.theme.register` 整主题注册（M5+ 再议，见 DESIGN D1）。
- `ThemeDefinition.icons` 图标替换（皮肤不换产品图标，避免审查面扩大）。
- Host 侧服务（webServer 路由等）——皮肤纯客户端。
