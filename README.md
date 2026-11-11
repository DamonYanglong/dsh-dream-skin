# DSH Dream Skin

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）Web GUI 换肤的
官方插件：全页背景图 + 方向渐变 scrim + `--dsw-alias-*` 语义色重绑。视觉范式继承
[zcode-dream-skin](https://github.com/longfei5/zcode-dream-skin) 与其上游
[Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin)（MIT），
工程范式从「CDP 注入」迁移到「DSH 插件体系」——无调试端口、无 app 改写，
安装即组合，卸载即还原。

**状态：设计阶段（M0）**，尚不可安装。设计见 [docs/DESIGN.md](docs/DESIGN.md)。

## 工作原理（一句话版）

浏览器插件包经 DSH client-modules 加载：资产管线发背景图（内容哈希 + 同源 URL），
`ctx.theme` override layer 按明/暗双值重绑语义 token，CSS Modules 样式表挂 scrim 骨架，
volatile Config 生成设置行做主题切换。详见 [docs/capabilities.md](docs/capabilities.md)。

## 文档

| 文件 | 内容 |
|---|---|
| [docs/DESIGN.md](docs/DESIGN.md) | 设计文档：架构、主题管线、token 映射、里程碑、风险 |
| [docs/capabilities.md](docs/capabilities.md) | DSH 插件能力调研（证据链 + 出处） |
| [docs/token-map.md](docs/token-map.md) | 114 个 `--dsw-alias-*` token 清单与映射处置 |
| `docs/selectors.md`（M1） | 结构选择器登记表（DSH 升级时的核对清单） |

## 里程碑

- **M0** ✅ 仓库 + 设计
- **M1** 最小验证：单主题真机跑通「挂载 → 生效 → off 完整还原」
- **M2** 构建管线 + 4 主题移植 + 设置行切换
- **M3** 可读性兜底（sanitize + panel guard）+ 侧栏精修
- **M4** npm 分发 + 安装文档

## License

MIT。背景图素材归属见 [NOTICE.md](NOTICE.md)。
