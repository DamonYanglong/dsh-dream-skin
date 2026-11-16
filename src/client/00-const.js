/*
 * 00-const.js — 包级常量与构建期注入点。
 * 职责：声明插件身份、画布变量清单、默认参数、服务依赖。
 * 不引用：任何运行时上下文（ctx/form 均不可见）。
 */
const react = require("react");

const PACKAGE_ID = "dsh-dream-skin";
/** volatile Config 命名空间 = profile 条目 id（ui-settings「Configuration forms」）。 */
const ENTRY_ID = "dsh-dream-skin";
/** 设置行文案命名空间（ctx.locale.register）。 */
const LOCALE_NS = "dsh-dream-skin";
/** 骨架样式表（唯一全局样式表，见 skeleton.css 注释）。 */
const SKELETON_CSS = __SKELETON_CSS_PLACEHOLDER__;
/** 内置主题定义（构建期从 themes/<id>/ 生成）。 */
const THEMES = __THEMES_PLACEHOLDER__;
/** 内置背景图 URL（构建期资产管线）。 */
const BG_URL = __BG_URL_PLACEHOLDER__;

/** 骨架 CSS 消费的 html 内联变量（teardown 时逐一清除）。 */
const CANVAS_VARS = ["--dsb-d-rgb", "--dsb-l-rgb", "--dsb-scrim-k", "--dsb-a-base", "--dsb-a-1", "--dsb-a-2", "--dsb-a-3", "--dsb-a-side-d", "--dsb-a-side-l"];

/** 背景透出度默认值（0–100；与 Host Config 默认一致）。 */
const DEFAULT_VISIBILITY = 75;
/** 导入主题的默认材质 alpha 阶梯（DESIGN §5.1）。 */
const DEFAULT_ALPHAS = { base: 0.62, 1: 0.62, 2: 0.72, 3: 0.82, "side-l": 0.42, "side-d": 0.72 };

/** Required services: theme runtime, settings forms, locale, slots. */
const inject = ["theme", "configForms", "locale", "slots"];
