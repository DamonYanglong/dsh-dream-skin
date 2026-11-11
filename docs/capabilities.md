# DSH 插件能力调研笔记（M0 基线 → M1 实测校准）

> 结论来源：开源仓库文档（github.com/deepseek-ai/deepseek-harness）+ 本机
> `DeepSeek Harness.app` 的 `app.asar` 内插件包源码与 README（版本 0.2.2-rc.1）。
> 本文件是 DESIGN.md 决策的证据链，标注了每条结论的出处。
> **M1 校准（2026-11-11）**：下述 API 均已在真机产物上确认，修正处以
> 「M1 校准」标注；未标注的为 M0 推断且未推翻。

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

### 2.3 theme runtime 与 override layer（M1 已实测校准）

- `ctx.theme`（ui-theme 提供，ui-layout 呈现器消费）：`register({id, colorScheme, tokens, icons})`
  注册整主题；第三方 id 不进内置设置 schema（light/dark/system）。
- **override layer**（client.js 源码验证，**M1 校准：方法名是
  `overrideTokens(source, tokens)`**，DESIGN v0.1 写的 `override` 不存在）：
  在活动主题之上叠一层 token 覆盖——基主题不动，层按 seq 序组合、逐 token
  后者胜，移除该层恢复其覆盖的内容；每 token 为 `{light, dark}` 双值 map，
  按**活动 colorScheme 自动取值**（明暗切换零 JS）；re-register 同 source
  即整层替换；裸字符串值抛教学型 TypeError。返回 disposer。
  → DESIGN 决策 D1 的依据：皮肤用 override layer，不动内置偏好。
- 呈现器把别名 token 写为 body 内联变量（ui-layout README「主题呈现」节）→ 覆盖层值会
  正常落到 DOM。**light 值填官方原值表达式（如 `var(--dsw-static-neutral-bluish-1000)`）
  即等效「浅壳不覆盖」——M1 采用**。
- dispose 语义：register 的主题若背书当前 preference 会重置为默认——又一个不用 register 的理由。
- **M1 校准**：明暗判据是 `body[data-ds-dark-theme]`（ui-theme boot script 设置），
  不是 `html.dark`；对话页稳定判据 `html:has([data-conversation-scroll])`（ui-chat
  滚动容器 data 属性，M2 迁入 selectors.md）。

### 2.4 设置面（M1 已实测校准）

- volatile Config 字段自动生成设置表单行（dsh-settings README）：皮肤只需声明
  `theme: Schema.string().default('off')` 类字段 + `.volatile()`，表单/持久化/revision 冲突
  全部由官方机制承担。
- **M1 校准**：dsh-settings `describe()` 以 **profile 条目 id 为命名空间**（ns =
  entry.options.id）；客户端读取模式是 `ctx.configForms.get(ns)`（ui-chat 先例）：
  `.getSnapshot().value.<field>` / `.subscribe(fn)` / `.set(field, value)`，value 在
  镜像就绪前为 undefined。写入经 Host settings 持久化到 profile patch。
- **M1 校准**：README 称 autoGenerate「目前没有已发布的客户端这样做」属实——自动
  表单暂无 UI 渲染方，M2 的「设置行切换」需按 ui-theme 模式注册
  `settings.general.item` slot 自渲染。
- 设置页是 `main` keyed slot 的全局面板 → guard 的"设置页剥皮"可监听面板切换实现，无需
  ZCode 时代的文本探测（apply.mjs `settingsOpen()`）。

### 2.5 宿主热重载边界（M1 新增，重要；M1 末期修正）

- **dsh-hmr watch profile patch + manifest**（`watchConfig`，chokidar 精确路径 +
  2s awaitWriteFinish）：profile 用户 patch、home patch、profile `package.json`
  变化触发 `reconcileProfile`。manifest 通知仅在**有序 `dsh.profile.bundles`
  列表变化**时触发重载；config-editor 保存与 plugin-manager 操作也走同一队列。
- **重组合热替换链接包的构建产物**：`node_modules` 下已安装包与已链接（symlink）
  包的目标文件变化，在下一次重组合时生效，无需重启（README「使用本包」）。
  因此开发闭环 = rebuild + 轻碰 patch（如改写一行注释），页面经 HMR 自动跟随。
- 注意 `hmr` 条目的模块监听默认忽略 `**/node_modules`——构建产物变化本身
  不触发事件，需要一次 patch/manifest 编辑或 PM 操作来触发重组合。
- 新增 Loader 条目激活链：patch/manifest 变化 → reconcile → Loader 挂 node 半侧
  （校验 Config）→ client-modules 对账读 manifest + bundle 元数据 → 图发布 →
  页面经 SSE/HMR 跟随。
- **profile 本地包必须做成 bundle** 才可被 Loader 解析（`dsh.bundle.patch` +
  `dsh.profile.bundles` 列表 + insert 行；参照 dsh-work-x）。仅 symlink +
  用户 patch 条目不够——运行时解析表只收 installation 闭包 + 选中 bundle 的闭包。
- 资产路由是激活探针：`/plugins/<pkg>/assets/…` 对未激活/解析失败一律 404，
  活动条目 200（无需认证）。

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
