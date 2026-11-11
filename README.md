# DSH Dream Skin

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）Web GUI 换肤的
官方插件：全页背景图 + 方向渐变 scrim + `--dsw-alias-*` 语义色重绑。视觉范式继承
[zcode-dream-skin](https://github.com/longfei5/zcode-dream-skin) 与其上游
[Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin)（MIT），
工程范式从「CDP 注入」迁移到「DSH 插件体系」——无调试端口、无 app 改写，
安装即组合，卸载即还原。

**状态：M2 进行中**（皮肤本体真机验证通过；设置行 v4 重写，见 [docs/DESIGN.md](docs/DESIGN.md) M2 记录）。

## 工作原理（一句话版）

浏览器插件包经 DSH client-modules 加载：资产管线发背景图（内容哈希 + 同源 URL），
`ctx.theme.overrideTokens` 覆盖层按明/暗双值重绑语义 token，插件样式表挂 scrim 骨架，
volatile Config `theme` 字段控制开关。详见 [docs/capabilities.md](docs/capabilities.md)。

## 构建 / 冒烟 / 挂载

```bash
npm install && npm run build     # lib/{index.js,client.js,assets/}
node scripts/smoke-test.mjs      # 状态机冒烟（挂载/off/还原/清理）
```

本地挂载（开发流程）见 [scripts/README.md](scripts/README.md)。要点：dsh-hmr
watch profile patch 与 manifest（2s 防抖），重组合会热替换链接包的构建产物——
改完代码 `npm run build` 后轻碰 patch 一行注释即可，无需重启。

## 文档

| 文件 | 内容 |
|---|---|
| [docs/DESIGN.md](docs/DESIGN.md) | 设计文档：架构、主题管线、token 映射、里程碑、风险 |
| [docs/capabilities.md](docs/capabilities.md) | DSH 插件能力调研（证据链 + 出处，M1 已实测校准） |
| [docs/token-map.md](docs/token-map.md) | 114 个 `--dsw-alias-*` token 清单与映射处置 |
| [docs/selectors.md](docs/selectors.md) | 结构选择器登记表（M2） |

## 里程碑

- **M0** ✅ 仓库 + 设计
- **M1** 🔨 最小验证：单主题真机跑通「挂载 → 生效 → off 完整还原」（gothic-void-crusade）
- **M2** 构建管线 + 4 主题移植 + 设置行切换
- **M3** 可读性兜底（sanitize + panel guard）+ 侧栏精修
- **M4** npm 分发 + 安装文档

## License

MIT。背景图素材归属见 [NOTICE.md](NOTICE.md)。
