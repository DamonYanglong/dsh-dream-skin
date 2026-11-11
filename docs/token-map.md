# `--dsw-alias-*` Token 清单与映射处置（v0.1）

> 从本机 DSH 0.2.2-rc.1 的 `@deepseek-ai/dsh-client-ui-theme/lib/client.js`（app.asar 内）
> 提取，共 114 个。值为「明 | 暗」两套（个别单值 token 只有暗壳变体）。
> 处置标签对应 DESIGN.md §5：**映射**=直接色值替换；**推导**=color-mix 半透明/材质化；
> **重绑目标**=经组件局部变量重绑；**官方保留**=不覆盖；**官方锁**=明确禁止覆盖。
> 处置为 v0.1 初判（按 token 名模式），M2 逐个对照真实 UI 细化。

## 映射（31）

| token | 官方值（明 \| 暗） | 说明 |
|---|---|---|
| `--dsw-alias-bg-document-selection` | `color-mix(in srgb, var(--dsw-static-blue-500) 40%, transparent)` | ← colors.accent 40%（官方形式） |
| `--dsw-alias-border-inverted` | `#0000 \\| #ffffff0f` | ← colors.line + 官方固有 alpha 阶 |
| `--dsw-alias-border-inverted2` | `#0000 \\| #ffffff14` | ← colors.line + 官方固有 alpha 阶 |
| `--dsw-alias-border-l1` | `#0000000a \\| #ffffff0f` | ← colors.line + 官方固有 alpha 阶 |
| `--dsw-alias-border-l2` | `#0000001a \\| #ffffff1f` | ← colors.line + 官方固有 alpha 阶 |
| `--dsw-alias-border-l2-darkmode-thin` | `#0000001a \\| #ffffff0f` | ← colors.line + 官方固有 alpha 阶 |
| `--dsw-alias-border-l3` | `#0000001f \\| #ffffff29` | ← colors.line + 官方固有 alpha 阶 |
| `--dsw-alias-border-l4` | `#00000029 \\| #fff3` | ← colors.line + 官方固有 alpha 阶 |
| `--dsw-alias-interactive-bg-active` | `#2631481a \\| #ffffff24` | ← colors.accent + 官方 alpha |
| `--dsw-alias-interactive-bg-hover` | `#2631480f \\| #ffffff14` | ← colors.accent + 官方 alpha |
| `--dsw-alias-interactive-bg-hover-accent` | `#26314824 \\| #ffffff3d` | ← colors.accent + 官方 alpha |
| `--dsw-alias-interactive-bg-hover-danger` | `#ec13130d \\| #f25a5a26` | ← colors.accent + 官方 alpha |
| `--dsw-alias-interactive-bg-hover-solid` | `var(--dsw-static-neutral-bluish-75) \\| var(--dsw-static-neutral-bluish-800)` | ← colors.accent + 官方 alpha |
| `--dsw-alias-label-caption` | `var(--dsw-static-neutral-bluish-400) \\| var(--dsw-static-neutral-bluish-600)` | ← colors.text / muted（不透明，sanitize 兜底） |
| `--dsw-alias-label-deep-diving` | `color-mix(in srgb, var(--dsw-static-deepseek-500) 70%, var(--dsw-static-blue-950)) \\| color-mix(in srgb, var(--dsw-static-deepseek-450) 55%, var(--dsw-static-neutral-bluish-400))` | ← colors.text / muted（不透明，sanitize 兜底） |
| `--dsw-alias-label-deep-diving-shimmer` | `color-mix(in srgb, var(--dsw-static-deepseek-500) 30%, var(--dsw-static-blue-950)) \\| color-mix(in srgb, var(--dsw-static-blue-300) 65%, var(--dsw-static-deepseek-400))` | ← colors.text / muted（不透明，sanitize 兜底） |
| `--dsw-alias-label-dimmed` | `var(--dsw-static-neutral-bluish-200) \\| var(--dsw-static-neutral-bluish-750)` | ← colors.text / muted（不透明，sanitize 兜底） |
| `--dsw-alias-label-document-preview` | `var(--dsw-static-neutral-bluish-700) \\| var(--dsw-static-neutral-bluish-300)` | ← colors.text / muted（不透明，sanitize 兜底） |
| `--dsw-alias-label-primary` | `var(--dsw-static-neutral-bluish-1000) \\| var(--dsw-static-neutral-bluish-50)` | ← colors.text / muted（不透明，sanitize 兜底） |
| `--dsw-alias-label-primary-bluish` | `var(--dsw-static-blue-900) \\| var(--dsw-static-neutral-bluish-50)` | ← colors.text / muted（不透明，sanitize 兜底） |
| `--dsw-alias-label-primary-dimmed` | `var(--dsw-static-neutral-bluish-950) \\| var(--dsw-static-neutral-bluish-100)` | ← colors.text / muted（不透明，sanitize 兜底） |
| `--dsw-alias-label-primary-foreground` | `var(--dsw-static-neutral-bluish-00) \\| var(--dsw-static-neutral-bluish-1000)` | ← colors.text / muted（不透明，sanitize 兜底） |
| `--dsw-alias-label-primary-inverted` | `var(--dsw-static-neutral-bluish-00) \\| var(--dsw-static-neutral-bluish-800)` | ← colors.text / muted（不透明，sanitize 兜底） |
| `--dsw-alias-label-secondary` | `var(--dsw-static-neutral-bluish-700) \\| var(--dsw-static-neutral-bluish-300)` | ← colors.text / muted（不透明，sanitize 兜底） |
| `--dsw-alias-label-shimmer` | `color-mix(in srgb, var(--dsw-static-neutral-1000) 30%, transparent) \\| color-mix(in srgb, var(--dsw-static-neutral-00) 45%, transparent)` | ← colors.text / muted（不透明，sanitize 兜底） |
| `--dsw-alias-label-tertiary` | `var(--dsw-static-neutral-bluish-600) \\| var(--dsw-static-neutral-bluish-400)` | ← colors.text / muted（不透明，sanitize 兜底） |
| `--dsw-alias-link` | `var(--dsw-static-deepseek-500) \\| var(--dsw-static-deepseek-400)` | ← colors.accent |
| `--dsw-alias-state-business-primary` | `var(--dsw-static-deepseek-500) \\| var(--dsw-static-deepseek-400)` | ← colors.accent（accentAlt 作 hover 梯度） |
| `--dsw-alias-state-business-tertiary` | `var(--dsw-static-deepseek-100) \\| var(--dsw-static-deepseek-800)` | ← colors.accent（accentAlt 作 hover 梯度） |
| `--dsw-alias-turn-trigger-bg` | `var(--dsw-alias-markdown-code-block) \\| var(--dsw-alias-interactive-bg-hover)` | ← colors.accent |
| `--dsw-alias-turn-trigger-bg-hover` | `var(--dsw-alias-interactive-bg-hover) \\| var(--dsw-alias-interactive-bg-active)` | ← colors.accent |

## 推导（21）

| token | 官方值（明 \| 暗） | 说明 |
|---|---|---|
| `--dsw-alias-bg-base` | `var(--dsw-static-neutral-bluish-00) \\| var(--dsw-static-neutral-bluish-950)` | ← colors.background/panel 半透明化（color-mix，让背景图透出） |
| `--dsw-alias-bg-document-preview` | `var(--dsw-static-neutral-bluish-100) \\| var(--dsw-static-neutral-bluish-950)` | ← colors.background/panel 半透明化（color-mix，让背景图透出） |
| `--dsw-alias-bg-layer-1` | `var(--dsw-static-neutral-bluish-00) \\| var(--dsw-static-neutral-bluish-875)` | ← colors.background/panel 半透明化（color-mix，让背景图透出） |
| `--dsw-alias-bg-layer-2` | `var(--dsw-static-neutral-bluish-00) \\| var(--dsw-static-neutral-bluish-850)` | ← colors.background/panel 半透明化（color-mix，让背景图透出） |
| `--dsw-alias-bg-layer-3` | `var(--dsw-static-neutral-bluish-00) \\| var(--dsw-static-neutral-bluish-800)` | ← colors.background/panel 半透明化（color-mix，让背景图透出） |
| `--dsw-alias-bg-module-platform` | `var(--dsw-static-neutral-bluish-60) \\| var(--dsw-static-neutral-bluish-800)` | ← colors.background/panel 半透明化（color-mix，让背景图透出） |
| `--dsw-alias-bg-multi-select` | `var(--dsw-static-neutral-bluish-60) \\| var(--dsw-static-neutral-850)` | ← colors.background/panel 半透明化（color-mix，让背景图透出） |
| `--dsw-alias-bg-overlay` | `var(--dsw-static-neutral-bluish-150) \\| var(--dsw-static-neutral-bluish-700)` | ← colors.background/panel 半透明化（color-mix，让背景图透出） |
| `--dsw-alias-bg-skeleton` | `#0000000a \\| #ffffff14` | ← colors.background/panel 半透明化（color-mix，让背景图透出） |
| `--dsw-alias-markdown-citation` | `var(--dsw-static-neutral-bluish-100) \\| var(--dsw-static-neutral-bluish-800)` | ← colors.panel（代码块/引用/标签材质） |
| `--dsw-alias-markdown-code-block` | `var(--dsw-static-neutral-bluish-50) \\| var(--dsw-static-neutral-bluish-900)` | ← colors.panel（代码块/引用/标签材质） |
| `--dsw-alias-markdown-code-block-banner` | `var(--dsw-static-neutral-bluish-50) \\| var(--dsw-static-neutral-bluish-850)` | ← colors.panel（代码块/引用/标签材质） |
| `--dsw-alias-markdown-code-segment-selected` | `var(--dsw-static-neutral-bluish-00) \\| var(--dsw-static-neutral-bluish-800)` | ← colors.panel（代码块/引用/标签材质） |
| `--dsw-alias-markdown-code-segment-unselected` | `var(--dsw-static-neutral-bluish-75) \\| var(--dsw-static-neutral-bluish-900)` | ← colors.panel（代码块/引用/标签材质） |
| `--dsw-alias-markdown-inline-code` | `var(--dsw-static-neutral-50) \\| var(--dsw-static-neutral-800)` | ← colors.panel（代码块/引用/标签材质） |
| `--dsw-alias-markdown-placeholder` | `var(--dsw-static-neutral-bluish-60) \\| var(--dsw-static-neutral-bluish-850)` | ← colors.panel（代码块/引用/标签材质） |
| `--dsw-alias-markdown-tag` | `var(--dsw-static-neutral-bluish-75) \\| var(--dsw-static-neutral-bluish-850)` | ← colors.panel（代码块/引用/标签材质） |
| `--dsw-alias-toast-bg` | `var(--dsw-static-neutral-bluish-800) \\| var(--dsw-static-neutral-bluish-750)` | ← colors.panel 高不透明度（可读性优先） |
| `--dsw-alias-toast-label` | `var(--dsw-static-neutral-bluish-00)` | ← colors.panel 高不透明度（可读性优先） |
| `--dsw-alias-tooltip-bg` | `var(--dsw-static-neutral-bluish-850) \\| var(--dsw-static-neutral-bluish-750)` | ← colors.panel 高不透明度（可读性优先） |
| `--dsw-alias-tooltip-key-bg` | `color-mix(in srgb, var(--dsw-alias-tooltip-bg), white 18%)` | ← colors.panel 高不透明度（可读性优先） |

## 重绑目标（4）

| token | 官方值（明 \| 暗） | 说明 |
|---|---|---|
| `--dsw-alias-scrollbar-bg-l1` | `var(--dsw-static-neutral-200) \\| var(--dsw-static-neutral-700)` | 经 --dsh-scrollbar-thumb(-hover) 重绑主题色调（官方正门） |
| `--dsw-alias-scrollbar-bg-l2` | `var(--dsw-static-neutral-200) \\| var(--dsw-static-neutral-600)` | 经 --dsh-scrollbar-thumb(-hover) 重绑主题色调（官方正门） |
| `--dsw-alias-scrollbar-hover-l1` | `var(--dsw-static-neutral-300) \\| var(--dsw-static-neutral-600)` | 经 --dsh-scrollbar-thumb(-hover) 重绑主题色调（官方正门） |
| `--dsw-alias-scrollbar-hover-l2` | `var(--dsw-static-neutral-300) \\| var(--dsw-static-neutral-550)` | 经 --dsh-scrollbar-thumb(-hover) 重绑主题色调（官方正门） |

## 推导(可选)（12）

| token | 官方值（明 \| 暗） | 说明 |
|---|---|---|
| `--dsw-alias-button-contrast-fill` | `var(--dsw-static-neutral-bluish-700) \\| var(--dsw-static-neutral-bluish-50)` | ← layer/panel 推导；默认只动 ghost-active 系，其余直通可覆盖 |
| `--dsw-alias-button-elevated-fill` | `var(--dsw-static-neutral-bluish-00) \\| var(--dsw-static-neutral-bluish-750)` | ← layer/panel 推导；默认只动 ghost-active 系，其余直通可覆盖 |
| `--dsw-alias-button-floating-fill` | `var(--dsw-static-neutral-bluish-00) \\| var(--dsw-static-neutral-bluish-850)` | ← layer/panel 推导；默认只动 ghost-active 系，其余直通可覆盖 |
| `--dsw-alias-button-floating-hover` | `var(--dsw-static-neutral-bluish-75) \\| var(--dsw-static-neutral-bluish-800)` | ← layer/panel 推导；默认只动 ghost-active 系，其余直通可覆盖 |
| `--dsw-alias-button-ghost-active-border` | `var(--dsw-static-neutral-bluish-500) \\| var(--dsw-static-neutral-bluish-600)` | ← layer/panel 推导；默认只动 ghost-active 系，其余直通可覆盖 |
| `--dsw-alias-button-ghost-active-fill` | `var(--dsw-static-neutral-bluish-100) \\| var(--dsw-static-neutral-bluish-750)` | ← layer/panel 推导；默认只动 ghost-active 系，其余直通可覆盖 |
| `--dsw-alias-button-ghost-active-hover` | `var(--dsw-static-neutral-bluish-150) \\| var(--dsw-static-neutral-bluish-700)` | ← layer/panel 推导；默认只动 ghost-active 系，其余直通可覆盖 |
| `--dsw-alias-button-info-fill` | `var(--dsw-static-deepseek-500) \\| var(--dsw-static-deepseek-400)` | ← layer/panel 推导；默认只动 ghost-active 系，其余直通可覆盖 |
| `--dsw-alias-button-info-hover` | `var(--dsw-static-deepseek-400) \\| var(--dsw-static-deepseek-500)` | ← layer/panel 推导；默认只动 ghost-active 系，其余直通可覆盖 |
| `--dsw-alias-button-tool-bar-fill` | `#54555780` | ← layer/panel 推导；默认只动 ghost-active 系，其余直通可覆盖 |
| `--dsw-alias-button-tool-bar-fill-invisible` | `#1f1f1f5c` | ← layer/panel 推导；默认只动 ghost-active 系，其余直通可覆盖 |
| `--dsw-alias-button-tool-bar-hover` | `#54555799` | ← layer/panel 推导；默认只动 ghost-active 系，其余直通可覆盖 |

## 官方保留（37）

| token | 官方值（明 \| 暗） | 说明 |
|---|---|---|
| `--dsw-alias-brand-primary` | `var(--dsw-static-neutral-bluish-1000) \\| var(--dsw-static-neutral-bluish-50)` | 品牌区（deepseek 蓝），避免大面积撞色 |
| `--dsw-alias-brand-primary-invert` | `var(--dsw-static-neutral-bluish-1000) \\| var(--dsw-static-neutral-bluish-50)` | 品牌区（deepseek 蓝），避免大面积撞色 |
| `--dsw-alias-brand-primary-new-colorprimary-new-color` | `#4176e6 \\| var(--dsw-static-deepseek-450)` | 品牌区（deepseek 蓝），避免大面积撞色 |
| `--dsw-alias-brand-text` | `var(--dsw-static-neutral-bluish-1000) \\| var(--dsw-static-neutral-bluish-50)` | 品牌区（deepseek 蓝），避免大面积撞色 |
| `--dsw-alias-button-primary-dimmed` | `var(--dsw-static-neutral-bluish-100) \\| var(--dsw-static-neutral-bluish-750)` | 品牌区（deepseek 蓝），避免大面积撞色 |
| `--dsw-alias-button-primary-fill` | `var(--dsw-alias-brand-primary)` | 品牌区（deepseek 蓝），避免大面积撞色 |
| `--dsw-alias-button-primary-hover` | `var(--dsw-static-neutral-bluish-750) \\| var(--dsw-static-neutral-bluish-100)` | 品牌区（deepseek 蓝），避免大面积撞色 |
| `--dsw-alias-code-diff-added` | `var(--dsw-static-green-500-a08) \\| var(--dsw-static-green-500-a12)` | diff 底色体系自洽；直通字段可覆盖 |
| `--dsw-alias-code-diff-deleted` | `var(--dsw-static-red-600-a08) \\| var(--dsw-static-red-400-a12)` | diff 底色体系自洽；直通字段可覆盖 |
| `--dsw-alias-file-diff-added-bg` | `#e6f4e7 \\| #1f3124` | diff 底色体系自洽；直通字段可覆盖 |
| `--dsw-alias-file-diff-added-gutter` | `#edf7ed \\| #132016` | diff 底色体系自洽；直通字段可覆盖 |
| `--dsw-alias-file-diff-added-marker` | `#01a241 \\| #41c977` | diff 底色体系自洽；直通字段可覆盖 |
| `--dsw-alias-file-diff-deleted-bg` | `#fce6e2 \\| #3c1f1b` | diff 底色体系自洽；直通字段可覆盖 |
| `--dsw-alias-file-diff-deleted-gutter` | `#fdece9 \\| #28130e` | diff 底色体系自洽；直通字段可覆盖 |
| `--dsw-alias-file-diff-deleted-marker` | `#ba2723 \\| #fa423e` | diff 底色体系自洽；直通字段可覆盖 |
| `--dsw-alias-illustration-background` | `var(--dsw-static-neutral-bluish-55) \\| var(--dsw-static-neutral-bluish-850)` | 分层插画配色，与皮肤无争用 |
| `--dsw-alias-illustration-backing` | `var(--dsw-static-neutral-bluish-310) \\| var(--dsw-static-neutral-bluish-750)` | 分层插画配色，与皮肤无争用 |
| `--dsw-alias-illustration-detail` | `var(--dsw-static-neutral-bluish-310) \\| var(--dsw-static-neutral-bluish-600)` | 分层插画配色，与皮肤无争用 |
| `--dsw-alias-illustration-inset` | `var(--dsw-alias-illustration-surface) \\| var(--dsw-alias-illustration-backing)` | 分层插画配色，与皮肤无争用 |
| `--dsw-alias-illustration-shadow` | `var(--dsw-alias-illustration-surface) \\| var(--dsw-alias-illustration-backing)` | 分层插画配色，与皮肤无争用 |
| `--dsw-alias-illustration-surface` | `var(--dsw-static-neutral-bluish-90) \\| var(--dsw-static-neutral-bluish-700)` | 分层插画配色，与皮肤无争用 |
| `--dsw-alias-onboarding-accent` | `#3964fe` | 局部视觉，不动 |
| `--dsw-alias-onboarding-card-fill` | `color-mix(in srgb, var(--dsw-static-neutral-bluish-00) 80%, transparent) \\| color-mix(in srgb, var(--dsw-static-neutral-bluish-850) 80%, transparent)` | 局部视觉，不动 |
| `--dsw-alias-onboarding-checkbox-border` | `color-mix(in srgb, var(--dsw-static-neutral-bluish-1000) 20%, transparent) \\| var(--dsw-alias-border-l2)` | 局部视觉，不动 |
| `--dsw-alias-onboarding-secondary-fill` | `var(--dsw-static-neutral-bluish-00) \\| #48494c` | 局部视觉，不动 |
| `--dsw-alias-state-done-primary` | `var(--dsw-static-violet-600) \\| var(--dsw-static-violet-400)` | 语义状态色（成功/警告/错误/完成/空闲），换色伤语义 |
| `--dsw-alias-state-error-primary` | `var(--dsw-static-red-600) \\| var(--dsw-static-red-400)` | 语义状态色（成功/警告/错误/完成/空闲），换色伤语义 |
| `--dsw-alias-state-error-secondary` | `var(--dsw-static-red-400)` | 语义状态色（成功/警告/错误/完成/空闲），换色伤语义 |
| `--dsw-alias-state-idle-primary` | `var(--dsw-static-neutral-300) \\| var(--dsw-static-neutral-600)` | 语义状态色（成功/警告/错误/完成/空闲），换色伤语义 |
| `--dsw-alias-state-success-primary` | `var(--dsw-static-green-500)` | 语义状态色（成功/警告/错误/完成/空闲），换色伤语义 |
| `--dsw-alias-state-success-secondary` | `var(--dsw-static-green-400)` | 语义状态色（成功/警告/错误/完成/空闲），换色伤语义 |
| `--dsw-alias-state-success-tertiary` | `var(--dsw-static-green-100) \\| var(--dsw-static-green-900)` | 语义状态色（成功/警告/错误/完成/空闲），换色伤语义 |
| `--dsw-alias-state-warn-label` | `var(--dsw-static-amber-600)` | 语义状态色（成功/警告/错误/完成/空闲），换色伤语义 |
| `--dsw-alias-state-warn-primary` | `var(--dsw-static-amber-500)` | 语义状态色（成功/警告/错误/完成/空闲），换色伤语义 |
| `--dsw-alias-state-warn-secondary` | `var(--dsw-static-amber-400)` | 语义状态色（成功/警告/错误/完成/空闲），换色伤语义 |
| `--dsw-alias-state-warn-tertiary` | `var(--dsw-static-amber-100) \\| var(--dsw-static-amber-900)` | 语义状态色（成功/警告/错误/完成/空闲），换色伤语义 |
| `--dsw-alias-switch-thumb` | `var(--dsw-static-neutral-bluish-00) \\| var(--dsw-static-neutral-bluish-400)` | 局部视觉，不动 |

## 官方锁（7）

| token | 官方值（明 \| 暗） | 说明 |
|---|---|---|
| `--dsw-alias-bg-mask-1` | `#0000003d \\| #00000080` | 模态遮罩保留黑色半透明（规范明文） |
| `--dsw-alias-bg-mask-2` | `#0000001f \\| #0003` | 模态遮罩保留黑色半透明（规范明文） |
| `--dsw-alias-bg-mask-3` | `#0000007a` | 模态遮罩保留黑色半透明（规范明文） |
| `--dsw-alias-bg-mask-drop` | `#ffffffb3 \\| #272730b3` | 模态遮罩保留黑色半透明（规范明文） |
| `--dsw-alias-bg-mask-photo` | `#000000e0` | 模态遮罩保留黑色半透明（规范明文） |
| `--dsw-alias-menu-group-header-fill` | `#f8f9faf0 \\| #303136f0` | 菜单材质由 web-styling 明确保护（--dsw-menu-surface-fill/backdrop-filter 不得覆盖） |
| `--dsw-alias-menu-icon` | `var(--dsw-static-neutral-bluish-800) \\| var(--dsw-alias-label-primary-dimmed)` | 菜单材质由 web-styling 明确保护（--dsw-menu-surface-fill/backdrop-filter 不得覆盖） |

## 别名引用（自动跟随）

以下 token 的官方值就是别的 alias token 引用，覆盖上游后自动跟随，无需单独处理：

| token | 官方值 |
|---|---|
| `--dsw-alias-settings-card-fill` | `var(--dsw-alias-bg-layer-2)` |
| `--dsw-alias-settings-card-stroke` | `var(--dsw-alias-border-l4)` |

## 提取方法（复现）

```bash
# 解析 app.asar pickle header → 定位 ui-theme client bundle → 正则提取全部声明
node -e "…见 docs/capabilities.md §5…"
```
