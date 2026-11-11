# scripts — 构建管线（M2 起）

## build-themes.mjs

```
themes/<id>/ → 解析 theme.json/theme.css
  → §5 映射表转换 --color-* → --dsw-alias-* 覆盖层（明/暗）
  → sanitize 文字色亮度兜底（移植 zds cssColorLum）
  → 背景 assets 哈希复制到 src/client/assets/
  → 生成 src/client/generated/themes.ts
  → 构建报告（未命中映射的声明逐条列出）
```

零 npm 依赖（沿用 zds 手写解析路线）；MD1 探明的产物形态要求见 DESIGN §4。
