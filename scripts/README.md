# scripts — 构建与验证

## build.mjs（`pnpm run build` / `npm run build`）

```
themes/<id>/{theme.json, dsw.json, image}
  → 资产：sha1 前 12 位做 revision，lib/assets/<name>-<rev>.<ext>，
          引用编译为 require.asset("plugins/dsh-dream-skin/assets/…")
          （路径段 encodeURIComponent 后再编码 !'()*）
  → lib/client.js：ModuleLoader factory 形态 bundle
        （src/client/bundle.template.js 注入 CSS/token/资产 URL）
  → lib/index.js：node 半侧原样复制（ESM）
```

零 npm 依赖（node:crypto / node:fs）。token 覆盖层 M1 直接取
`themes/<id>/dsw.json`（显式映射）；M2 的 theme.css 映射推导管线
（build-themes.mjs）在此之上扩展。

## smoke-test.mjs

stub DOM/cordis ctx 加载 `lib/client.js`，验证状态机：
挂载生效 → off 完整还原 → 未知 id 安全退化 → dispose 全清理。
`node scripts/smoke-test.mjs`

## 本地挂载（M1 开发流程）

1. `npm install && npm run build`
2. `ln -sfn $PWD ~/.dsh/profiles/<profile>/node_modules/dsh-dream-skin`
3. profile `cordis.patch.yml` 追加：
   ```yaml
   - id: dsh-dream-skin
     name: dsh-dream-skin
     config:
       theme: gothic-void-crusade   # off = 还原官方外观
   ```
4. 宿主**不会自动重读 patch**——在 GUI 设置→插件里开关任意插件触发
   reconcile（或重启宿主），页面经 HMR 自动加载/卸载皮肤。
5. 验证：`curl -o /dev/null -w %{http_code}
   http://127.0.0.1:<port>/plugins/dsh-dream-skin/assets/<emitted>` →
   200（未激活/解析失败均为 404）。
