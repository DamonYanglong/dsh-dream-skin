# DSH Dream Skin · 设计文档

> 给 DeepSeek Harness（DSH）Web GUI 换肤的官方插件。前身 [zcode-dream-skin](https://github.com/longfei5/zcode-dream-skin)
> 用本机回环 CDP 注入 ZCode 桌面端；本项目放弃 CDP，改为遵循 DSH 的插件规范
> （["Everything is a Plugin"](https://github.com/deepseek-ai/deepseek-harness)），
> 用插件资产管线发背景图、用主题 token 覆盖层换语义色、用插件样式表挂 scrim。

- 版本：v0.2（M1 实现基线，机制实测校准）
- 状态：M1 实现完成，真机验证中
- 上游调研结论见 [capabilities.md](capabilities.md)（含 M1 校准），token 映射目标见 [token-map.md](token-map.md)

---

## 1. 目标与非目标

### 目标

1. **背景图换肤**：DSH Web GUI（含桌面壳）获得全页背景图 + 方向渐变 scrim 的外观，视觉对齐
   Codex Dream Skin 的层叠模型（首页 hero-scrim / 对话页 task-fade + task-shade / 侧栏独立半透明）。
2. **语义色跟随主题**：`--dsw-alias-*` 语义 token 按皮肤主题色重绑，控件、边框、文字、
   滚动条自然继承主题色调。
3. **主题库兼容**：直接消化 zcode-dream-skin 的主题格式（`theme.json` + `theme.css` + 背景图），
   4 个内置主题先移植；后续可接 DreamSkin.cc 市场 ZIP。
4. **规范内运行**：无 CDP、无调试端口、无 app 改写。安装 = 插件组合；卸载 = 完整还原。
5. **明暗双态**：尊重用户内置 light/dark/system 偏好，皮肤为两种壳各出一套参数。

### 非目标

- 不替换 DSH 布局结构、不改 React 组件树（只在样式与 token 层工作 + 少量运行时 DOM 兜底）。
- 不做 DSH 官方推荐渠道上架（plugin-market 索引条目可做，但接受 web-styling 规范的字面冲突风险，
  见 §11 风险）。
- 不动 Host 侧任何行为（模型请求、会话、设置持久化机制一律不碰，除皮肤自身 volatile 字段）。
- M1–M4 不做主题 ZIP 导入 GUI（命令行/构建期导入先行，导入端点是 M5+ 议题）。

---

## 2. 总体架构

```
┌────────────────────────────── DSH 宿主（Node） ──────────────────────────────┐
│  cordis loader ── 挂载 dsh-dream-skin（node 半侧 = 空 Loader 座位）            │
│  职责：仅提供 profile 条目与 volatile 配置声明；皮肤全部逻辑在浏览器侧           │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │ /plugins bundle（client-modules 提供）
┌────────────────────────────── 浏览器（web GUI） ─────────────────────────────┐
│ dsh-dream-skin client bundle（platform: web）                                 │
│                                                                               │
│  ┌─ apply(ctx) ──────────────────────────────────────────────────────────┐   │
│  │ 1. 样式骨架   install(skeleton.css)        ← CSS Modules，随插件注入     │   │
│  │ 2. 主题注册   ctx.theme.override('dsb', layer)  ← token 覆盖层（明/暗）    │   │
│  │ 3. 参数应用   applyTheme(id)                                          │   │
│  │      · body 内联变量：--dsb-bg / --dsb-scrim-* / 重绑的 --dsw-alias-*    │   │
│  │      · 背景图 URL：构建期 import 的资产常量                              │   │
│  │ 4. 设置行     Config volatile: theme 字段 → 设置页「通用」分区            │   │
│  │ 5. 运行时兜底  readability guard（MutationObserver，§7）                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**三个决策点（与 zds 范式的差异）：**

**D1 · token 覆盖层，而非替换主题**
不用 `ctx.theme.register()` 注册整主题（那会绕开内置 light/dark/system 偏好，且第三方 id 不进
内置设置 schema）。改用 theme runtime 的 **override layer**：`stack 一层 token 覆盖，每 token
按当前 colorScheme 取值，移除即还原`。用户明暗偏好保持有效，皮肤卸载零残留。
（完整主题注册留作 M5+ 可选能力，用于"皮肤即主题"的深度模式。）

**D2 · 背景图走资产管线，运行时只换变量**
所有主题的背景图在构建期经 `src/client/assets/` 进入资产管线（内容哈希文件名 +
`/plugins/<pkg>/assets/` 同源 URL + immutable 缓存），JS 侧 import 得到 URL 常量。
scrim 骨架 CSS 只有一份（CSS Modules 注入），渐变端点色全部参数化为
`--dsb-scrim-*` 变量；**切换主题 = 改写 body 上一组内联变量**，不动态增删样式表。

**D3 · 优先变量重绑，结构选择器只做兜底**
DSH 组件是 CSS Modules 哈希类名、无 data-testid。zds 里"找 DOM 打补丁"的活，在 DSH 里
首先尝试 **token 重绑**（官方支持的正门，如滚动条 `--dsh-scrollbar-thumb` 重绑定先例）；
确实没有 token 出口的视觉（如侧栏毛玻璃层），才用稳定结构属性（`data-side`、
`data-composer-*` 等）+ `:has()` 组合选择器，集中登记在 `docs/selectors.md`（M1 建立），
DSH 版本升级时按单核对。

---

## 3. 主题包格式（输入）

**完全复用 zds 格式**，新增一个可选直通字段：

```
themes/<id>/
├── theme.json   # schema=zcode-dream-skin-theme/1（兼容原样读取）
├── theme.css    # zds 的 scrim 曲线原样保留；--color-* 块按 §5 映射表转换
└── background.* # jpg/png/webp，任意大小（资产管线无 data URI 体积问题）
```

`theme.json` 关键字段与消费方式：

| 字段 | DSH 侧消费 |
|---|---|
| `appearance: dark/light/adaptive` | dark/light 主题**只出对应壳的参数**，并建议用户切内置偏好（皮肤不强制改壳——内置偏好归用户，这是与 zds 的差异）；adaptive 出双套 |
| `colors.*`（10 个语义色） | 构建期推导 `--dsw-alias-*` 覆盖层（§5 映射表）|
| `art.focusX/focusY` | `background-position`（骨架 CSS 变量 `--dsb-bg-pos`）|
| `image` | 资产管线入口 |
| `dsw.tokens`（**新增，可选**） | 高级直通：`{"--dsw-alias-label-primary": {"light": "#…", "dark": "#…"}}` 直接并入覆盖层，优先级高于推导值 |

`theme.css` 的处理规则（构建期）：

- `html` 画布三段式（`background-size/position/repeat`）→ 骨架参数。
- 四组渐变 scrim（首页暗/浅、对话暗/浅）→ **原样保留曲线**，端点色改为
  `rgb(from var(--dsb-scrim-base) …)` 形式的变量引用（构建期把字面色替换为主题底色变量）。
- `html.dark{…} / html:not(.dark){…}` 里的 `--color-*` 覆盖 → 逐条查 §5 映射表：
  命中 → 转 `--dsw-alias-*`；未命中 → 构建警告并跳过（登记到构建报告）。
- ZCode 专属选择器（`aside[data-testid=…]`、`::-webkit-scrollbar-*` 等）→ 构建期跳过 +
  警告；DSH 等价物由骨架 CSS 用自己的选择器实现（侧栏、滚动条重绑）。
- `:has(.history-message)` 判定 → 换成 DSH 的页面态判定（见 §6.3，M1 探查后确定）。

---

## 4. 构建管线

```
themes/<id>/theme.json ─┐
themes/<id>/theme.css ──┤  scripts/build-themes.mjs
themes/<id>/background ─┘         │
                                  ├─ parse：json + css（零依赖手写解析，沿用 zds 正则路线）
                                  ├─ map：colors/*-css → dsw 覆盖层 JSON（§5）
                                  ├─ sanitize：文字色亮度兜底（§7.1，移植 cssColorLum）
                                  └─ emit：src/client/generated/themes.ts
                                        · THEMES: ThemeDef[]（id/name/params/dswTokens/bgUrl）
                                        · assets：background → src/client/assets/<id>-<hash>.<ext>

pnpm build（tsdown / 对齐 dsh 仓库工具链）
  └─ lib/client.js   ← window.__ModuleLoader__.load() factory 形态（硬性要求）
      lib/index.js   ← node 座位（空 apply）
      lib/assets/*   ← 内容哈希资产
package.json：dsh.client manifest（platform: web, inject: […], exports 含 ./assets/*）
```

**构建产物形态是硬边界**：client bundle 必须是 ModuleLoader factory 注册形式、资产 URL 必须
编译为 `require.asset("plugins/<pkg>/assets/…")` 调用、路径段 `encodeURIComponent` + 特殊字符
再编码。M1 的第一件事就是手工产出一个最小 bundle 在真机挂载验证，确认我们复刻的产物形态被
client-modules 接受，再决定自建工具链还是直接借 dsh 仓库的构建配置。

---

## 5. Token 映射（zds colors → `--dsw-alias-*`）

完整 114 个目标 token 见 [token-map.md](token-map.md)。核心映射与推导规则：

### 5.1 主映射表

| zds 来源 | DSH 目标（明/暗各一值） | 推导规则 |
|---|---|---|
| `colors.background` | `--dsw-alias-bg-base`、`bg-layer-1/2/3` | 层级容器**半透明化**而非实底：`color-mix(in srgb, <bg> 62%/72%/82%, transparent)`，让背景图透出（zds `--color-card` 的等价手法）|
| `colors.panel` | `settings-card-fill`、`markdown-code-block`、`tooltip-bg`、`toast-bg` | 面材质：`color-mix(<panel> 82%, transparent)`；tooltip/toast 用更高不透明度（可读性优先）|
| `colors.panelAlt` | `bg-layer-3`、`menu-group-header-fill` | 同上，稍深 |
| `colors.accent` / `accentAlt` | `state-business-primary`、`link`、`turn-trigger-bg(-hover)` | 色相替换，alpha 阶保持官方值；**不动** `brand-primary*`（品牌蓝区，避免大面积撞色）|
| `colors.text` | `label-primary` | 不透明，直接色值 |
| `colors.muted` | `label-secondary`、`label-tertiary`、`label-caption` | 不透明，按明度阶梯差 6%/12% 派生 |
| `colors.line` | `border-l1/l2/l3/l4`、`border-inverted(2)` | 主题色调 + 官方固有 alpha 阶（明 .0a/.1a/.1f/.29，暗 .0f/.1f/.29/.3f）|
| `--color-hover/selected/accent` 块 | `interactive-bg-hover(-active/-solid)` | accent 色 + 官方 alpha |
| `colors.secondary`/`highlight` | `interactive-bg-hover-danger`、`code-diff-*` 参考 | 次要装饰，默认不映射（避免语义误用），直通字段可覆盖 |
| `--color-terminal-*` | 终端侧栏变量（M1 探查具体 token 名） | 实底优先（终端可读性）|
| `::selection` 块 | `bg-document-selection` | accent 40% 官方形式 |

### 5.2 明暗双值规则

- 暗壳值：直接用主题暗色推导（zds `html.dark` 块）。
- 浅壳值：用 zds `html:not(.dark)` 块。~~主题只有暗套时浅壳输出 = 官方原值保留~~
  （v13 修正：该规则只适用于"用户永远暗壳"的假设；system 跟随 morning/午后切换壳后，
  材质/scrim 规则必须暗、浅两套都生成——亮图暗壳还要按画布亮度抬高 scrim 底线）。
- 主题声明 `adaptive` 时双套齐全才允许发布，构建期校验。

### 5.3 兜底顺序

`dsw.tokens` 直通 > theme.css 显式映射 > colors 推导 > 官方原值（不覆盖）。

---

## 6. 视觉层实现

### 6.1 背景画布（骨架 CSS，唯一全局样式表）

```css
/* skeleton.css（示意）——所有字面量在构建期/运行期由 --dsb-* 变量提供 */
html {
  background-size: auto, auto, cover !important;
  background-position: center, center, var(--dsb-bg-pos) !important;
  background-repeat: no-repeat !important;
}
html { background-image:
  linear-gradient(var(--dsb-hero-1), var(--dsb-hero-2), var(--dsb-hero-3), transparent),
  linear-gradient(var(--dsb-fade-1), var(--dsb-fade-2), var(--dsb-fade-3), var(--dsb-fade-4)),
  var(--dsb-bg) !important; }
```

`--dsb-*` 由 `applyTheme()` 写到 body 内联；明/暗切换（监听 `theme/change` 事件取
`snapshot.active.colorScheme`）刷新为对应端点组。

### 6.2 首页 / 对话页双态

zds 用 `:has(.history-message)` 区分。DSH 的等价判据 M1 探查（候选：会话界面 root 的
结构属性、`main` keyed slot 的激活态广播、或运行时 MutationObserver 打 `data-dsb-view`
标记到 html）。骨架 CSS 只消费 `html[data-dsb-view='home'|'task']`，判据实现集中在一个
模块里可替换。

### 6.3 侧栏与卡片

- 侧栏半透明 + 毛玻璃：优先重绑侧栏容器消费的 layer token；无 token 出口时用结构选择器
  （探查后登记 selectors.md）。毛玻璃 `backdrop-filter` 只作用于侧栏，避开官方
  `--dsw-menu-backdrop-filter` 管辖的菜单材质（不覆盖菜单 token，见 §11 规范风险）。
- 消息卡片化（zds `CHROME_CSS` 的 `.history-message` 卡片）：DSH 消息列有自己的容器与
  `data-side` 属性；M1 评估"卡片底"还是"直接 scrim 蒙层"——DSH 消息区默认无卡片底，
  走 scrim 蒙层可能已够，卡片化为可选增强。

### 6.4 滚动条

官方正门：重绑 `--dsh-scrollbar-thumb(-hover)` 到主题色调。不改 `scrollbar.css` 结构、
不写 `::-webkit-scrollbar` 规则（避免破坏双路径互斥构造）。

---

## 7. 可读性保障（从 zds 移植的引擎级兜底）

### 7.1 构建期文字色兜底（sanitize）

移植 `cssColorLum`：覆盖层里暗壳文字亮度 < 0.18 → 主题色相可读亮色；浅壳 > 0.82 → 可读
暗色。作用于 5.1 全部 `label-*` 与直通 token，构建警告输出纠正明细。

### 7.2 运行时 panel guard（M3）

MutationObserver 动态补底（zds PANEL_GUARD v6 的移植）：大面积、右侧、透明度过低的容器
补实底。DSH 侧适配点：面板判定的 DOM 特征、设置页"剥皮/恢复"逻辑（DSH 设置是全局面板，
判定比 ZCode 稳定：监听 `ctx.layout` 面板切换即可，不需要文本探测）。guard 全部操作集中在
插件自己挂的 `[data-dsb-guard]` 标记上，dispose 时逆向清理。

---

## 8. 设置与 UX

- **设置入口**：volatile Config 字段 `theme`（enum：`off` + 主题 id 列表，默认 `off`），
  由 settings 服务自动生成设置行，出现在设置页「通用」分区（紧邻官方外观行）。
- **切换语义**：`off` = 移除覆盖层 + 清空 `--dsb-*` + guard 撤除（完整还原官方外观）；
  选主题 = §2 apply 流程。
- **持久化**：volatile 字段经 profile patch 持久化（官方机制），皮肤不自己写存储。
- **明暗提示**：主题 `appearance: dark` 而当前壳为 light 时，设置行描述里提示切换内置
  外观偏好（不代改）。

---

## 9. 分发

1. **本地开发**：`pnpm build` → 产物挂载到 `$DSH_HOME` profile patch（`cordis.patch.yml`
   overlay）→ 刷新 Web GUI 验证。
2. **npm**：发包 `dsh-dream-skin`，用户经 plugin-manager `install_bundle` 安装。
3. **plugin-market**（可选）：自建或第三方索引收录条目（索引格式
   `dsh-plugin-market-index`）；接受 §11 的规范冲突风险。

版本耦合策略：package.json `peerDependencies` 声明已验证的 DSH 版本区间；DSH release
变化（client-modules 按 release 隔离 bundle）不吞兼容性——皮肤在新 release 上不加载时
页面保持官方外观，安全失败。

---

## 10. 里程碑

| 阶段 | 内容 | 验收 |
|---|---|---|
| **M0**（本仓库） | 仓库 + 设计文档 + token 清单/映射表 | 设计评审通过 |
| **M1** 最小验证 | 手工最小 bundle（gothic-void-crusade：bg + scrim + 10 个核心 token 覆盖层）| 真机：挂载生效、`off` 完整还原、刷新后自动生效、HMR 热替换 |
| **M2** 主题库 | 构建管线（build-themes.mjs）+ 4 主题移植 + 设置行切换 + 明暗双套 | 4 主题全部可切换、构建报告零未处理警告 |
| **M3** 可读性 | sanitize 移植 + panel guard + 侧栏/滚动条精修 + selectors.md | 亮图/暗图主题下全界面可读性人工审查 |
| **M4** 分发 | npm 包 + 安装文档 +（可选）market 索引条目 | 全新环境按文档安装成功 |

M1 是**证伪点**：若产物形态复刻不被接受或 token 覆盖层不达视觉预期，回此设计文档修订。

### M1 执行记录（2026-11-11）

**产物形态复刻成功（R1 解除）**：手工 bundle（`scripts/build.mjs` 产出
`window.__ModuleLoader__.load({id, factory})` 注册形态 + `require.asset()`
资产引用）无需借 dsh 仓库构建配置。零外部模块请求的插件连
`dsh.client.inject` 都不用声明——服务依赖全部走 cordis `inject`。

**API 校准（R2 解除）**：`ctx.theme.overrideTokens(source, tokens)`（非
`override`）；每 token `{light, dark}`，呈现器按活动 colorScheme 自动取值
→ 明暗切换零 JS。明暗 DOM 判据 `body[data-ds-dark-theme]`（非 `html.dark`）。

**配置通道校准**：ns = profile 条目 id；客户端 `ctx.configForms.get(ns)`
读 volatile 字段（ui-chat 先例），写入经 Host settings 持久化到
profile patch。~~自动表单暂无 UI 渲染方，M2 需自注册设置行 slot~~
（M2 v4 修正：设置行是 `settings.general.item` 自绘席位，见下方 M2 记录）。

**热重载边界（新发现，M1 末期修正）**：dsh-hmr watch profile patch 与
manifest（2s 防抖；manifest 仅 `dsh.profile.bundles` 有序列表变化触发），
重组合会**热替换链接包的构建产物**——开发闭环 = rebuild + 轻碰 patch，
无需重启或 GUI 操作。**profile 本地包必须做成 bundle**（`dsh.bundle.patch` +
bundles 列表 + insert 行，参照 dsh-work-x）才可被 Loader 解析；仅 symlink +
用户 patch 条目不入运行时解析表。资产路由 404/200 作激活探针。

**简化决策**：scrim 端点组不做 JS 切换——`:has(body[data-ds-dark-theme])`
纯 CSS 分组 + `html[data-dsb-on]` 总门控；对话页判据
`:has([data-conversation-scroll])`；浅壳 token 一律官方原值表达式
（gothic 只出暗套，天然满足 §5.2）。

---

### M2 执行记录（2026-11-11 · v4 思路修正）

**v1–v3 的错误路线（及教训）**：设置行先是外链 `require("@deepseek-ai/dsh-client-store")`
（v1 引发 web boot 崩溃），后在 v2/v3 里逆向压缩产物猜 `defineStore → {spec,create}`
工厂 + `options.store` + `inject(actions)` 契约——这是第一方包
（ui-theme AppearanceRow）经平台内部通道（dsh-client-store 模块 + standardHookProps
组装）的私有机制，**不对第三方开放**，行组件等待的 props 宿主根本不传
（slot 条目静默崩溃），设置行从未出现。

**权威契约（v4 全部落到文档/在线 inspect，不再逆向产物）**：

1. `settings.general.item` 注册选项**仅 `id` / `order` / `label**
   （`Slots.listSubTree` 实测）；label 支持 locale thunk。
   ui-settings-general README：「Each registrant owns its row copy and behavior」
   ——行组件必须**自包含**：状态自订阅 `configForms`、文案走 `ctx.locale.bind`、
   控件按官方 `--dsw-alias-*` token 自绘（practices.md：第三方禁止把任何
   Harness Client 包当模块 require；禁止往 `document.body` 追加元素——v3 的
   纯 DOM 浮动按钮也一并撤掉，官方全页浮层席位是 `shell.overlay`）。
2. 持久化正门 = 官方 settings 边界（M1 已实测的部分本来就对）：
   Host 半侧 volatile Config `theme` 字段 + 客户端 `ctx.configForms.get(entryId)`
   的 `getSnapshot/subscribe/set`（ui-settings README「Configuration forms」；
   ui-settings-general 自己的 `welcomeNoticeVersion` 就是这个模式的官方范例）。
3. 皮肤引擎（骨架样式表 + `overrideTokens` + `--dsb-*` 画布变量 + `off` 完整还原）
   自 M1 起未变；v4 只重写了设置行与清理了诊断产物。

**v13 真机双壳修正（2026-11-12）**：用户报告"切皮肤只有侧栏生效"。自截图管线
复现 = 浅壳下材质规则全不命中（v1–v12 只生成暗壳规则）；补浅壳变体后又暴露
**启动竞态**：`refreshImported` 挂在面板页 useEffect，而 main 席位页面只在面板
打开时挂载 → 启动后导入列表永远为空 → 持久化的导入主题被静默按 off 跳过。
修复：列表加载提升到 apply()（单飞 promise，面板挂载复用）+ 列表到位补 sync；
亮图暗壳的 scrim 底线按画布亮度自适应（0.6/0.35）。回归：冒烟测试启动竞态场景
+ 双壳截图验证（鲸鱼娘浅/暗、gothic 暗全部通过）。

**v14 焦点锚定（2026-11-12）**：百分比 background-position 在宽高比变化的
cover 裁切下守不住画面主体（窄窗口把鲸鱼娘整个挤出画面）。改为 JS 逐像素
布局：读图片自然宽高 + 窗口尺寸，把主题焦点（fx/fy）锚到视口中央（ZOOM
1.2× 留平移余量，clamp 防空隙），resize 监听重算；值直接写 html 内联
background-size/position（important）——var() 代入逗号列表在 Edge 被
判计算期无效（background-size/position 静默回退 UA 初始值，background-image
却正常生效，纯靠截图对比定位）。鲸鱼娘 fx 修正 0.72（导入缺 art 时的兜底
默认改 0.7）；list/asset fetch 加 cache: no-store。

**冒烟测试同步升级**：react stub 实现 `createElement/useState/useEffect`
（setState 触发重渲染），slots stub 只接受 `{name,id,order,label}`（出现越界
注册项直接失败），行组件以**无 props** 物化渲染——v2 那类「内部契约猜错」
的 bug 现在本地就会被打出来。

---

### M2 执行记录（2026-11-11 · v6 真机校准）

**v5 真机结果**：独立面板（`sidebar.panellist` 图标 + `main` keyed 页面，
skill-explorer 同款模式）真机渲染成功——客户端半侧物化、slots、locale、
configForms 全链路打通。但暴露两个视觉层 bug（v6 修复）：

1. **背景图从未生效（含 M1 时期）**：`--dsb-*` 画布变量挂在 `body` 上，
   消费方却是 `html`（background-image 在 html）——CSS 变量只向下继承，
   html 读不到 → 整条 background 声明 invalid-at-computed-value → 无背景。
   此前"皮肤生效"的观感全部来自 overrideTokens（文字/边框变色）。
   修复：画布变量改挂 `documentElement`，另加 `html[data-dsb-on] body
   { background-color: transparent }` 防实底遮图。
2. **设置页透底不可读**：`bg-base`/`bg-layer-1/2/3` 全局覆盖成 62–82%
   透明，设置面板卡片同吃这些 token。修复（= zcode「设置页保留原始」的
   DSH 等价实现）：材质 token 从全局 overrideTokens 拆出，构建期生成
   `html[data-dsb-on][data-dsb-theme=<id>]:has(body[data-ds-dark-theme]) #root`
   作用域规则——设置面板/菜单/浮层 portal 在 **#root 之外**，天然保持官方
   不透明材质；应用本体（#root 内）材质半透明、透出背景图。纯颜色类 token
   （label/border/accent/scrollbar…）保持全局覆盖（任何材质上都可读）。

---

## 11. 风险与开放问题

| # | 风险/问题 | 影响 | 缓解 |
|---|---|---|---|
| R1 | client bundle 产物形态复刻失败（factory 形式/资产改写细节） | M1 阻塞 | M1 第一周先手工做最小产物验证；不行则借 dsh 仓库构建配置出包 |
| R2 | override layer API 形态与源码理解有出入（当前基于反编译 bundle 阅读） | M1 返工 | M1 读 `@deepseek-ai/dsh-client-ui-theme` npm 包的 `.d.ts` 类型声明校准 |
| R3 | 首页/对话双态判据、侧栏选择器依赖 DSH 内部 DOM | DSH 升级后皮肤失效 | 判据集中在单模块 + selectors.md 登记；失效 = 退化为无 scrim 全背景，不破坏功能 |
| R4 | web-styling 规范冲突（全页样式、主题选择器归属） | 官方渠道审查不过 | 定位为个人/社区皮肤；market 索引自建；不改菜单/模态官方材质 |
| R5 | 主题素材版权（背景图来自 Codex Dream Skin，MIT/各异） | 分发受限 | NOTICE.md 延续 zds 清单；仅可再分发素材进包，其余走"用户自导入" |
| R6 | 菜单/elevation 材质被皮肤破坏（`--dsw-menu-surface-fill` 等官方锁 token） | 可读性/审查问题 | 映射表**明确排除** menu-surface、mask、elevation 系 token（§5 已排除）|
| Q1 | 桌面壳（Electron）与浏览器是否都吃同一 `/plugins` 资产路由？ | M1 验证项（client-modules 文档称 fetchBundle 同响应，待证） | — |
| Q2 | `--dsw-alias-*` 以外的组件局部变量（如终端、diff 视图）需要覆盖时如何加入？ | M3 扩展 | 直通字段 + token-map.md 增补 |

---

## 12. 参考

- DSH 仓库：<https://github.com/deepseek-ai/deepseek-harness>
- 关键文档：[client-modules（资产/加载）](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/client-modules/README.zh.md) ·
  [web-styling（样式规范）](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/web-styling.zh.md) ·
  [capability-seams（服务面）](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/capability-seams.zh.md) ·
  [cordis-tutorial（插件教程）](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-tutorial/01-first-plugin.zh.md)
- 前身项目：zcode-dream-skin（本仓库 `themes/` 格式的定义者）
- 上游致敬：[Fei-Away/Codex-Dream-Skin](https://github.com/Fei-Away/Codex-Dream-Skin)（MIT）
