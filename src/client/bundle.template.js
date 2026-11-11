/*
 * dsh-dream-skin · client bundle 模板（M1，手工产物形态）
 *
 * scripts/build.mjs 把本文件包进 ModuleLoader factory：
 *   window.__ModuleLoader__.load({ id: "dsh-dream-skin", factory: (require) => {...} })
 * 并注入三个占位值：骨架 CSS 字符串、主题定义 JSON、背景图 require.asset 表达式
 * （注入点见下方 SKELETON_CSS / THEMES / BG_URL 三个 const 声明）。
 * 产物形态对齐 asar 内官方包（dsh-client-modules README「构建要求」）：
 * bundle 只注册 factory，副作用在物化时运行；资产引用编译为
 * require.asset("plugins/<pkg>/assets/<emitted path>") 同步调用。
 *
 * 本 bundle 无任何外部模块请求（不 require React/cordis 等），
 * 服务依赖经 cordis inject 声明：theme（覆盖层 API）+ configForms（设置镜像）。
 */

const PACKAGE_ID = "dsh-dream-skin";
/** volatile Config 命名空间 = profile 条目 id（dsh-settings describe 约定）。 */
const SETTINGS_NS = "dsh-dream-skin";
/** 骨架样式表（唯一全局样式表，见 skeleton.css 注释）。 */
const SKELETON_CSS = __SKELETON_CSS_PLACEHOLDER__;
/** 主题定义（构建期从 themes/<id>/ 生成：参数 + 覆盖层 token）。 */
const THEMES = __THEMES_PLACEHOLDER__;
/** 背景图 URL（构建期资产管线：内容哈希文件名 + require.asset 调用）。 */
const BG_URL = __BG_URL_PLACEHOLDER__;

/** 骨架 CSS 消费的 body 内联变量（teardown 时逐一清除）。 */
const CANVAS_VARS = ["--dsb-bg", "--dsb-bg-pos", "--dsb-d-rgb", "--dsb-l-rgb"];

/** Required services: theme runtime (override layer) + settings mirror. */
const inject = ["theme", "configForms"];

/**
 * Client plugin body：挂骨架样式表，跟随 configForms 镜像应用/移除主题。
 * @param ctx Client root context.
 */
function apply(ctx) {
	if (typeof document === "undefined") return;

	// 1. 骨架样式表（CSS Modules 等价物：插件持有的全局样式，
	//    <style data-plugin-css="<pkg>/<file>">，dispose/HMR 时移除）
	ctx.effect(() => {
		const tag = document.createElement("style");
		tag.dataset.plugin = PACKAGE_ID;
		tag.dataset.pluginCss = `${PACKAGE_ID}/skeleton`;
		tag.textContent = SKELETON_CSS;
		document.head.appendChild(tag);
		return () => {
			tag.remove();
		};
	}, `${PACKAGE_ID}: skeleton stylesheet`);

	const root = document.documentElement;
	const body = document.body;
	let current = "off";
	let disposeOverride = null;

	/** 移除 token 覆盖层（基主题不动，移除即还原官方值）。 */
	const removeOverride = () => {
		disposeOverride?.();
		disposeOverride = null;
	};

	/** 清空骨架画布变量 + 关闭 html 门控属性（完整还原官方外观）。 */
	const clearCanvas = () => {
		root.removeAttribute("data-dsb-on");
		for (const name of CANVAS_VARS) body.style.removeProperty(name);
	};

	/** 应用一个主题：画布参数 + token 覆盖层（幂等注册，同 source 整层替换）。 */
	const applyTheme = (id) => {
		const theme = THEMES[id];
		if (theme === undefined) {
			clearCanvas();
			removeOverride();
			current = "off";
			return;
		}
		body.style.setProperty("--dsb-bg", `url("${BG_URL}")`);
		body.style.setProperty("--dsb-bg-pos", theme.bgPos);
		body.style.setProperty("--dsb-d-rgb", theme.dRgb);
		body.style.setProperty("--dsb-l-rgb", theme.lRgb);
		root.setAttribute("data-dsb-on", "");
		if (disposeOverride === null) disposeOverride = ctx.theme.overrideTokens(PACKAGE_ID, theme.tokens);
		current = id;
	};

	// 2. 跟随设置镜像（volatile theme 字段经 Host settings 投影，
	//    镜像未就绪时 value 为 undefined → 视为 off）
	const settings = ctx.configForms.get(SETTINGS_NS);
	const sync = () => {
		const value = settings.getSnapshot().value?.theme ?? "off";
		if (value === current) return;
		if (value === "off") {
			removeOverride();
			clearCanvas();
			current = "off";
			return;
		}
		applyTheme(value);
	};
	ctx.effect(() => settings.subscribe(sync), `${PACKAGE_ID}: settings mirror`);
	sync();

	// 3. 兜底 teardown（dispose/HMR：样式表由 effect 1 移除，这里收覆盖层与画布）
	ctx.effect(() => () => {
		removeOverride();
		clearCanvas();
	}, `${PACKAGE_ID}: teardown`);
}

exports.apply = apply;
exports.inject = inject;
