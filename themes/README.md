# themes/ — 主题源

格式与 zcode-dream-skin 完全兼容（`theme.json` schema `zcode-dream-skin-theme/1` +
`theme.css` + `background.*`），新增可选 `dsw.tokens` 直通字段。完整消费规则见
[docs/DESIGN.md §3](../docs/DESIGN.md)。

## 移植计划（M2）

| 主题 | appearance | 备注 |
|---|---|---|
| gothic-void-crusade | dark | M1 先行（最小验证用） |
| codex-deepseek | — | M2 |
| codex-preset-gothic-void-crusade | — | M2 |
| codex-preset-arina-hashimoto | — | M2（素材权利核对后决定入包或用户自导入） |

源仓库：../zcode-dream-skin/themes/。移植 = 复制 + `dsw.tokens` 增补，不修改原件。
