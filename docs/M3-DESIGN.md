# dsh-dream-skin M3 技术设计：工程化加固与分发就绪

> 依据 tech-design 规范编写（约束性文档 > 描述性文档）。
> 版本 v1.0（2026-11-16）· 状态：待评审
> 血缘：基于 M2 v34（45440a0）；范式参考 dsh-plugin-wallpaper-engine@1.4.2（下称 WE）。

---

## 1. 需求分析

### 1.1 背景

M2 交付了功能完备的皮肤插件，但暴露三类结构性问题：

| 问题 | 事实依据 |
|---|---|
| 源码脆弱 | `bundle.template.js` 已 1012 行单文件；M2 期间多次用"整串文本替换"编辑，引发 `z-index 丢失`（v26 事故）、`*/ 注释吞噬`（v19c 事故）、`双 try` 等隐性破坏，均由真机现象反推才发现 |
| 回归靠肉眼 | 冒烟测试只覆盖行为逻辑；样式表结构、路由表、产物形态无一致性机检 |
| 不可分发 | 无 icon/多语言/详情页/CHANGELOG/版本策略，npm 发布与 plugin-market 挂不上 |

WE 仓库证明了对应解法（kernel 拆分 + verify-* 守卫 + 机检文档 + 子包发布形态）。

### 1.2 目标

1. 源码模块化：客户端拆为 ≤10 个单一职责模块，构建期内联成 bundle（对齐 WE 的 INLINE_MODULES 纪律）
2. 血泪史机检化：每个历史事故对应一条 verify 守卫，CI 一条命令全跑
3. 分发就绪：npm 包通过官方 host-plugin 清单检查，可被 `install_bundle` 安装、被 plugin-market 索引
4. 色板管线：zds `theme.css` 的 `--color-*` 自动映射为 `dsw.json`（M2 遗留的 build-themes.mjs）

### 1.3 非目标

- 不做实时渲染/视频壁纸（WE 的领域）
- 不拆子包家族（单包规模未到阈值；WE 范式记录在案备用）
- 不改皮肤视觉行为（本里程碑零视觉变更，验收含"截图逐像素一致"）

---

## 2. 约束条件

### 2.1 禁止（违反 = 守卫测试失败）

| # | 禁止项 | 守卫 |
|---|---|---|
| J1 | 禁止 CSS 注释文本内出现 `*/` 序列（v19c：吞噬首条规则） | verify-skeleton |
| J2 | 禁止整串重写 canvas 元素样式/任何含多属性的 style 字符串（v26：z-index 丢失）；样式属性必须逐属性 API 写入或守卫锚点逐项断言 | verify-inline |
| J3 | 禁止在 CSS 值的逗号列表中使用 var() 占位（Edge 计算期静默失效，v14） | verify-skeleton |
| J4 | 禁止客户端 require 白名单（react）之外的任何外部模块（practices.md） | verify-bundle |
| J5 | 禁止手写 docs/ROUTE-INDEX.md（必须由构建生成） | verify-routes |
| J6 | 发布产物禁止包含 src/、.pi/、node_modules/（files 白名单制） | verify-package |

### 2.2 必须

| # | 必须项 | 依据 |
|---|---|---|
| M1 | 皮肤激活期间 html 必须携带兜底色（v34，WE 白闪结论） | verify-inline |
| M2 | body/#root 透明守卫与 html 兜底必须成对出现（off 时双双清除） | verify-skeleton |
| M3 | 画布/纱若回归元素形态，必须 `-webkit-app-region: initial !important`（WE #120） | verify-skeleton |
| M4 | 宿主路由新增/删除必须同步重生成 ROUTE-INDEX.md 并入同一次提交 | verify-routes |
| M5 | 每个模块文件头必须写职责一句话 + "不引用什么"边界声明（WE 纪律） | verify-structure |
| M6 | 发布前必须全量通过 `npm run verify`（= 全部 verify-* 守卫 + 冒烟 + 构建） | package.json script |

### 2.3 参考实现

| 参考 | 位置 | 借鉴点 |
|---|---|---|
| WE layer-core/occlusion | src/layer-core.js 文件头 | 通道共用核心的"判据"写法（文件头声明不引用的符号） |
| WE styles/base.js | CSS_BASE 常量 + 注释契约 | 样式即数据、坑位注释就地锚定 |
| WE verify 体系 | test/verify-*.mjs + docs/GUARD-MAP.md | 一事一守卫、文档-代码同提交纪律 |
| WE 构建 | scripts/build-client.mjs INLINE_MODULES | 模块内联进单 bundle 的构建期纪律 |
| WE 发布形态 | package.json files/exports + cordis.patch.yml 行集注释 | 单一真源的行集声明 |

---

## 3. 系统入口影响评估

DSH 插件的"入口"= 对宿主的一切暴露面：

| 入口 | 类型 | 本里程碑变化 |
|---|---|---|
| Loader 行（cordis.patch.yml） | 组合入口 | ✅ 无变化（仍是主包单行 insert） |
| 宿主 HTTP 路由 /api/dsh-dream-skin/* | 数据面 | ✏️ 新增 0 条、契约冻结；变化仅 = ROUTE-INDEX.md 从手工变生成 |
| client 席位（sidebar.panellist / main / settings.general.item） | UI 面 | ✅ 无变化 |
| Config schema（theme/visibility/bgPosX） | 配置面 | ✅ 无变化（bgPosX 保留但已废弃，M4 再清理） |
| dsh.client manifest | 构建面 | ✏️ 构建产物形态不变，源文件从单文件变多模块内联 |
| npm 包 / plugin-market | 分发面 | 🆕 新增：发布物、版本、市场条目 |

---

## 4. 技术方案

### 4.1 W1 源码模块化（拆分映射表）

```
src/client/
├── canvas.js        画布背景层（body 三层背景写入/清除 + html 兜底）
├── interest.js      兴趣中心检测（analyzeArt 移植版，纯函数）
├── palettes.js      derivePalettes/deriveTokens/withSidebarFill（纯函数）
├── zip.js           ZIP 解析器（纯函数，浏览器 API 仅 Blob/DecompressionStream）
├── settings.js      configForms 读写 + visibility/bgPos 计算
├── panel.js         面板页组件（卡片/滑杆/导入区）
├── row.js           设置行组件
├── locale.js        文案字典（纯数据）
└── apply.js         编排：sync/applyTheme/refreshImported/席位注册
```

- 构建规则：`build.mjs` 读模块清单 → 按 `INLINE_MODULES` 顺序拼接进 factory 作用域（模块间**禁止 import**，符号经显式导出表注入——与 WE 同款防 TDZ 纪律）
- 验收不变量：内联产物与现 bundle 逐字节等价不作要求，但**行为等价**由 W2 截图对比守卫钉死
- 冒烟测试的 vm 加载方式不变（仍是产物 lib/client.js）

### 4.2 W2 守卫测试族（血泪史 → 机检）

| 守卫 | 断言内容 | 对应历史事故 |
|---|---|---|
| verify-skeleton.mjs | 样式表 `/*` 与 `*/` 计数平衡；首条规则选择器 = 预期；CSS 值中逗号列表无 var()；透明守卫与兜底色规则成对存在 | v19c 注释吞噬 / v14 var 失效 / v25 守卫丢失 |
| verify-inline.mjs | 产物 bundle 中 canvas 样式字符串包含全部关键属性逐项锚点（position/inset/width/height/object-fit/z-index）；html 兜底写入与 clearCanvas 清除成对 | v26 z-index 丢失 / v34 |
| verify-bundle.mjs | 产物的外部 require 白名单 = {react}；`window.__ModuleLoader__.load` 恰一次；`exports.apply/inject` 存在 | practices.md 契约 |
| verify-routes.mjs | 从 lib/index.js 静态提取路由 path 集合 == docs/ROUTE-INDEX.md（生成物）行集 | WE ROUTE-INDEX 范式 |
| verify-structure.mjs | 每个新模块文件头含"职责/"不引用"声明；模块数 ≤12；单模块 ≤300 行 | WE 文件头纪律 |
| verify-package.mjs | `npm pack --dry-run` 文件清单 ⊆ files 白名单；exports 四项齐全；engines.dsh 存在 | host-plugin.md 清单 |
| verify-visual.mjs | 自截图管线（puppeteer）：M3 前后各截 3 主题 × 2 壳，像素差 ≤ 阈值（重构不改视觉） | 本里程碑特有 |

命令：`npm run verify` = verify-* 全族 + smoke-test + build（ exit 0 才算过）。

### 4.3 W3 分发就绪（发布物清单）

| 发布物 | 规范来源 | 要点 |
|---|---|---|
| icon.png/svg | host-plugin.md | 256KiB 内、调色盘图形、原创 |
| locale/{zh,en,ja,ko,de,fr,es,pt}.json | 同上 | meta.title/description + panel 文案外迁（现硬编码 zh/en） |
| plugin-detail.zh/en.md + preview.svg | plugin-details.md | 单图详情页 |
| docs/CHANGELOG.md | 惯例 | 语义化版本；M2 事故教训入 Known Issues |
| package.json | — | version 0.3.0；`dsh.engines.dsh: "^0.2.0"`；repository/license |
| 发布流 | 官方 | `npm publish` → 用户侧 `install_bundle <tarball|spec>` → plugin-market 索引条目 PR |

### 4.4 W4 色板管线（build-themes.mjs）

```
themes/<id>/theme.css (--color-* 块)
  → 正则提取 16 个语义色 → 按 DESIGN §5.1 映射表 → dsw.json (tokens)
  → 现有 build.mjs 消费（拆分材质 token → #root 作用域规则）
```

- 输入约束：色值仅接受 `#rrggbb`/`rgba()`（带 var() 的官方表达式原样透传）
- 产出校验：映射后 tokens 键集 == gothic 基准键集（多退少补报错）
- zds 四主题以该管线重新生成 dsw.json（人工调校值进 git 历史，可 diff 回溯）

---

## 5. 行为规范（W2 守卫的行为契约）

| # | 类别 | 场景 | 期望行为 |
|---|---|---|---|
| N1 | 正常 | `npm run verify` 全绿 | exit 0，输出各守卫 PASS 行 |
| N2 | 正常 | build 后 ROUTE-INDEX 再生成 | 与入库版本零 diff |
| B1 | 边界 | 样式表注入非法 `bg-layer-*/bg` 注释文本 | verify-skeleton exit≠0，报"注释不平衡" |
| B2 | 边界 | 产物 canvas 样式串缺任一关键属性 | verify-inline exit≠0，列出缺失属性名 |
| B3 | 边界 | 模块新增 import 语句 | verify-structure exit≠0（内联模块禁 import） |
| B4 | 边界 | npm pack 清单出现 src/ | verify-package exit≠0，列出越界文件 |
| B5 | 边界 | 重构后截图像素差 > 阈值 | verify-visual exit≠0，输出差异最大坐标 |
| E1 | 异常 | theme.css 色板缺 `--color-panel` | build-themes 以兜底色映射并 warn（不 fail，zds 部分主题本身缺色） |
| E2 | 异常 | theme.css 含 var() 引用色 | 原样透传进 light 值，dark 值仍需字面色（否则 fail 并指行号） |
| E3 | 异常 | verify-routes 静态提取失败（语法变化） | exit≠0 并提示"路由提取器需适配"，不静默通过 |

---

## 6. 错误码（verify/构建退出码约定）

| 码 | 含义 | 触发者 |
|---|---|---|
| V1 | 样式表结构违规（J1/J3/M2/M3） | verify-skeleton |
| V2 | 关键内联锚点缺失（J2/M1） | verify-inline |
| V3 | 外部依赖越界（J4） | verify-bundle |
| V4 | 路由表与代码不一致（J5/M4） | verify-routes |
| V5 | 模块结构违规（M5/B3） | verify-structure |
| V6 | 发布物违规（J6） | verify-package |
| V7 | 视觉回归（B5） | verify-visual |
| B  | 构建失败（含 W4 色板 fail） | build.mjs |

守卫输出格式统一：`[V1] verify-skeleton: <file>:<detail>`（可 grep）。

## 7. 实施计划

| 阶段 | 内容 | 产出 | 依赖 |
|---|---|---|---|
| P1 | 守卫先行：verify-skeleton/inline/bundle + `npm run verify` 骨架 | 三守卫红→绿 | 无 |
| P2 | 模块化拆分 + verify-structure/visual（拆前基线截图） | 新 src/client/ + 行为等价证明 | P1 |
| P3 | 路由索引生成 + verify-routes | ROUTE-INDEX.md 生成器 | P1 |
| P4 | 色板管线 + 四主题重生成 | build-themes.mjs | 无 |
| P5 | 分发物 + verify-package + 0.3.0 发布演练（本地 tarball 装） | 可安装 tarball | P2/P3 |
| P6 | plugin-market 索引条目 | 市场可见 | P5 |

每阶段独立提交、独立可回滚；P2 为最高风险项，单独窗口执行。

## 8. 风险评估

| 风险 | 概率 | 缓解 |
|---|---|---|
| 模块拆分引入行为漂移 | 中 | verify-visual 像素对比 + 冒烟 8 场景 + 拆前 git tag 基线 |
| 守卫过严阻碍迭代 | 中 | 每条守卫对应编号事故，新增守卫需在 PR 描述引用事故或预判 |
| W4 映射表与人工调校值冲突 | 低 | 生成值与现值 diff 全量入 commit，人工复核后合入 |
| npm 发布后 profile link 形态失效 | 低 | P5 先以 tarball 在第二 profile 实装验证 |

## 9. 验收标准（DoD）

1. `npm run verify` 在干净 checkout 上一条命令全绿（含 7 守卫 + 冒烟 + 构建）
2. `git diff` 证明 M3 首尾 3 主题 × 2 壳截图零差异（verify-visual 阈值内）
3. `npm pack` 产物 ≤ 1.2MB，文件清单全部命中 files 白名单
4. 干净 profile 中 `install_bundle <tarball>` → 皮肤面板/导入/切换/透出度全部可用（手测脚本清单）
5. docs/ROUTE-INDEX.md、docs/CHANGELOG.md、8 语 locale、icon、plugin-detail 齐备且过 host-plugin 清单
6. zds 四主题由管线生成，与 M2 人工值 diff 已复核

## 10. 单测/守卫清单（与 §5 一一对应）

N1→verify-orchestrator；N2→verify-routes；B1→verify-skeleton；B2→verify-inline；B3→verify-structure；B4→verify-package；B5→verify-visual；E1/E2→build-themes 自测；E3→verify-routes。

## 11. 版本历史

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-11-16 | 初稿（待评审） |
