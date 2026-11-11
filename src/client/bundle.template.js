/*
 * dsh-dream-skin · client bundle 模板（M1 手工产物形态 + M2 设置行）
 *
 * scripts/build.mjs 把本文件包进 ModuleLoader factory：
 *   window.__ModuleLoader__.load({ id: "dsh-dream-skin", factory: (require) => {...} })
 * 并注入三个占位值：骨架 CSS 字符串、主题定义 JSON、背景图 require.asset 表达式
 * （注入点见下方 SKELETON_CSS / THEMES / BG_URL 三个 const 声明）。
 * 产物形态对齐 asar 内官方包（dsh-client-modules README「构建要求」）：
 * bundle 只注册 factory，副作用在物化时运行；资产引用编译为
 * require.asset("plugins/<pkg>/assets/<emitted path>") 同步调用。
 *
 * 外部模块请求仅限平台静态表（react / dsh-client-store），无需 dsh.client.inject。
 * 服务依赖经 cordis inject 声明：
 *   theme（覆盖层 API）、configForms（设置镜像）、locale（设置行文案）、slots（设置行注册）。
 */

const react = require("react");
const { defineStore } = require("@deepseek-ai/dsh-client-store");

const PACKAGE_ID = "dsh-dream-skin";
/** volatile Config 命名空间 = profile 条目 id（dsh-settings describe 约定）。 */
const SETTINGS_NS = "dsh-dream-skin";
/** 设置行文案命名空间（ctx.locale.register）。 */
const LOCALE_NS = "dsh-dream-skin";
/** 骨架样式表（唯一全局样式表，见 skeleton.css 注释）。 */
const SKELETON_CSS = __SKELETON_CSS_PLACEHOLDER__;
/** 主题定义（构建期从 themes/<id>/ 生成：参数 + 覆盖层 token）。 */
const THEMES = __THEMES_PLACEHOLDER__;
/** 背景图 URL（构建期资产管线：内容哈希文件名 + require.asset 调用）。 */
const BG_URL = __BG_URL_PLACEHOLDER__;

/** 骨架 CSS 消费的 body 内联变量（teardown 时逐一清除）。 */
const CANVAS_VARS = ["--dsb-bg", "--dsb-bg-pos", "--dsb-d-rgb", "--dsb-l-rgb"];

/** 设置行文案（M2：zh/en 先行，M4 分发前补齐 locale/*.json 八语）。 */
const LOCALE = {
	zh: {
		"row.title": "皮肤",
		"row.theme.off": "官方默认",
		"row.themeHint.dark": "此主题为暗色系，建议配合内置外观的深色模式使用",
	},
	en: {
		"row.title": "Skin",
		"row.theme.off": "Official default",
		"row.themeHint.dark": "Dark-oriented theme; pairs best with the built-in dark appearance",
	},
};

/** Required services: theme runtime, settings mirror, locale, slots. */
const inject = ["theme", "configForms", "locale", "slots"];

/** 主题下拉选项（off + 构建期主题表）。 */
function themeOptions(t) {
	return [
		{ id: "off", label: t("row.theme.off") },
		...Object.keys(THEMES).map((id) => ({ id, label: THEMES[id].name ?? id })),
	];
}

/**
 * 设置行组件：皮肤选择（契约 = ui-theme AppearanceRow：props 收
 * { t, useStore, ...inject 返回的 actions }）。
 */
function ThemeRow({ t, setTheme, useStore }) {
	const value = useStore((s) => s.theme);
	const options = themeOptions(t);
	return react.createElement(
		"div",
		{ className: "dsb_settingsRow" },
		react.createElement("div", { className: "dsb_settingsRowTitle" }, t("row.title")),
		react.createElement(
			"div",
			{ className: "dsb_settingsRowControl" },
			react.createElement(
				"select",
				{
					className: "dsb_themeSelect",
					value,
					onChange: (event) => {
						setTheme(event.target.value);
					},
				},
				options.map(({ id, label }) =>
					react.createElement("option", { key: id, value: id }, label),
				),
			),
		),
	);
}

/**
 * Client plugin body：挂骨架样式表 + 设置行，跟随 configForms 镜像应用/移除主题。
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
	let mirrorSeq = 0;

	/** 设置行 store（契约 = ui-theme createAppearanceRowStore：revision 单调防回放）。 */
	const rowStore = defineStore({
		init: () => ({ theme: "off", revision: -1 }),
		actions: {
			sync: (draft, theme, revision) => {
				if (revision <= draft.revision) return;
				draft.theme = theme;
				draft.revision = revision;
			},
		},
	});

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
		rowStore.sync(value, ++mirrorSeq);
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

	// 3. 设置行（「通用」分区，紧随官方外观/字号行；契约 = ui-theme appearance 行）
	ctx.effect(() => ctx.locale.register(LOCALE_NS, LOCALE), `${PACKAGE_ID}: settings row dictionaries`);
	ctx.slots.inject("settings.general.item", () =>
		ctx.slots.register(
			{
				name: "settings.general.item",
				id: "dream-skin",
				order: 13,
				store: rowStore,
				locale: LOCALE_NS,
				inject: () => ({
					/** 写入经 Host settings 持久化到 profile patch（官方机制）。 */
					setTheme: (id) => {
						if (id !== "off" && THEMES[id] === undefined) return;
						settings.set("theme", id);
					},
				}),
			},
			ThemeRow,
		),
	);

	// 4. 兜底 teardown（dispose/HMR：样式表由 effect 1 移除，这里收覆盖层与画布）
	ctx.effect(() => () => {
		removeOverride();
		clearCanvas();
	}, `${PACKAGE_ID}: teardown`);
}

exports.apply = apply;
exports.inject = inject;
