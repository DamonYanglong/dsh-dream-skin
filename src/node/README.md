# src/node — 宿主半侧

对齐 dsh-client-ui-brand-official 的空座位模式：`apply()` 为空，
不注册任何服务、不加路由。唯一职责是导出带 volatile 字段的 `Config`：

```js
const Config = z.object({
  theme: z.union(["off", "gothic-void-crusade"]).default("off").volatile(),
});
```

volatile 字段经 dsh-settings 投影为设置表单（命名空间 = profile 条目 id
`dsh-dream-skin`），浏览器半侧经 `ctx.configForms` 读写，持久化由 Host
settings（cordis.patch.yml）承担——皮肤不自建存储。

依赖 `@deepseek-ai/schemastery`（宿主侧包，profile 内可解析）。
