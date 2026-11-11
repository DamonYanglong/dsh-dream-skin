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

## 本地挂载（M1/M2 开发流程）

1. `npm install && npm run build`
2. `ln -sfn $PWD ~/.dsh/profiles/<profile>/node_modules/dsh-dream-skin`
3. profile `package.json`：dependencies 加 `"dsh-dream-skin": "link:~/<repo 路径>"`
   **且** `dsh.profile.bundles` 加 `"dsh-dream-skin"`（两处都要——运行时解析表
   只收 installation 闭包 + 选中 bundle 的闭包，仅 symlink 不入表）。
   本包自带 `cordis.patch.yml`（`dsh.bundle.patch`）用 `insert` 提供 Loader 条目。
4. 主题选择写 profile 用户 patch 的 config 覆盖行：
   ```yaml
   - id: dsh-dream-skin
     name: dsh-dream-skin
     config:
       theme: gothic-void-crusade   # off = 还原官方外观
   ```
   或直接在设置 → 通用 → 皮肤 行切换（写入走同一条路）。
5. **热更新闭环（dsh-hmr）**：宿主 watch profile patch + manifest（2s 防抖）；
   重组合会热替换链接包的构建产物。改完代码 `npm run build` 后对 patch
   做一次无害编辑（如追加/改写一行注释）触发重组合即可，无需重启或 GUI 操作。
6. 验证：`curl -o /dev/null -w %{http_code}
   http://127.0.0.1:<port>/plugins/dsh-dream-skin/assets/<emitted>` →
   200（未激活/解析失败均为 404）。
