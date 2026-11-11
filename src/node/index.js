// dsh-dream-skin · node half
//
// 宿主半侧对齐 dsh-client-ui-brand-official 的空座位模式：不注册任何服务、
// 不加路由。唯一职责是声明带 volatile `theme` 字段的 Config——
// volatile 字段经 dsh-settings 投影为命名空间等于 profile 条目 id 的设置表单，
// 浏览器半侧通过 ctx.configForms.get("dsh-dream-skin") 读取与写入，
// 持久化由 Host settings（cordis.patch.yml）承担，皮肤不自建存储。
import z from "@deepseek-ai/schemastery";

/** 内置主题 id（M1 只移植 gothic-void-crusade）+ 关闭态。 */
export const THEME_IDS = ["off", "gothic-void-crusade"];

/** 皮肤选择：`off` = 完整还原官方外观。 */
export const Config = z.object({
  theme: z.union([...THEME_IDS]).default("off").volatile(),
  /** 背景透出度 0–100：越高背景图越透出（材质 alpha 阶梯按此缩放）。 */
  visibility: z.number().min(0).max(100).default(75).volatile(),
});

/** Host plugin body — 皮肤全部逻辑在浏览器半侧。 */
export function apply() {}
