/*
 * dsh-dream-skin · client bundle 模板（M2 v4）
 *
 * scripts/build.mjs 把本文件包进 ModuleLoader factory：
 *   window.__ModuleLoader__.load({ id: "dsh-dream-skin", factory: (require) => {...} })
 * 并注入三个占位值：骨架 CSS 字符串、主题定义 JSON、背景图 require.asset 表达式
 * （注入点见下方 SKELETON_CSS / THEMES / BG_URL 三个 const 声明）。
 * 产物形态对齐 asar 内官方包（dsh-client-modules README「构建要求」）：
 * bundle 只注册 factory，副作用在物化时运行；资产引用编译为
 * require.asset("plugins/<pkg>/assets/<emitted path>") 同步调用。
 *
 * 契约来源（v4 起全部为权威文档/在线 inspect，不再逆向压缩产物）：
 *   - require("react")：平台静态表（decoration 官方模板同款）。
 *     禁止 require 任何 Harness Client 包（dsh-client-store / ui-primitives 等）——
 *     practices.md 明文：第三方插件不得把 Harness Client 包当模块加载，
 *     第一方设置行的 store/inject(actions) 组装是平台内部通道，不对第三方开放。
 *   - ctx.theme.overrideTokens(source, tokens)：ui-theme README「Registering a theme」
 *     （第三方主题 = 别名 token 覆盖层；id 不进内置设置 schema）。
 *   - ctx.configForms.get(entryId) + form.set / getSnapshot / subscribe：
 *     ui-settings README「Configuration forms」——entryId = profile Loader 条目 id，
 *     持久化经 Host settings 服务写入 profile patch，皮肤不自建存储。
 *   - ctx.locale.register(ns, dicts) / ctx.locale.bind(ns)：Client Service 目录。
 *   - ctx.slots.inject("settings.general.item", ...) + register({name,id,order,label}, Row)：
 *     Slots 在线目录——注册选项仅 id/order/label；行内容与行为完全由注册者自绘
 *     （ui-settings-general README：「Each registrant owns its row copy and behavior」，
 *     宿主不传 store/actions props）。Row 组件必须自包含：状态订阅 configForms、
 *     文案走 locale、控件按官方 token 自绘。
 *
 * 服务依赖经 cordis inject 声明（缺失则条目不激活，皮肤整体安全失败）：
 *   theme（覆盖层 API）、configForms（设置表单）、locale（行文案）、slots（行注册）。
 */

const react = require("react");

const PACKAGE_ID = "dsh-dream-skin";
/** volatile Config 命名空间 = profile 条目 id（ui-settings「Configuration forms」）。 */
const ENTRY_ID = "dsh-dream-skin";
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

/** 设置行 + 面板文案（M2：zh/en 先行，M4 分发前补齐 locale/*.json 八语）。 */
const LOCALE = {
	zh: {
		"row.title": "皮肤",
		"row.theme.off": "官方默认",
		"panel.label": "皮肤",
		"panel.title": "皮肤",
		"panel.subtitle": "为整个界面换上背景图与主题色",
		"panel.theme.off": "官方默认",
		"panel.theme.off.hint": "还原官方外观",
	},
	en: {
		"row.title": "Skin",
		"row.theme.off": "Official default",
		"panel.label": "Skin",
		"panel.title": "Skin",
		"panel.subtitle": "Background art and theme colors for the whole interface",
		"panel.theme.off": "Official default",
		"panel.theme.off.hint": "Restore the stock appearance",
	},
};

/** Required services: theme runtime, settings forms, locale, slots. */
const inject = ["theme", "configForms", "locale", "slots"];

/**
 * Client plugin body：挂骨架样式表、跟随设置表单应用皮肤、注册自绘设置行。
 * @param ctx Client root context.
 */
function apply(ctx) {
	if (typeof document === "undefined") return;

	/** 把错误记录到 DOM（data-dsb-error）并打到控制台，便于真机诊断。 */
	const reportError = (stage, error) => {
		try {
			const message = `${stage}: ${error instanceof Error ? `${error.message}` : String(error)}`;
			console.error(`[dsh-dream-skin] ${message}`, error);
			document.documentElement.setAttribute("data-dsb-error", message);
		} catch {
			/* 报错路径自身不抛 */
		}
	};

	// 1. 骨架样式表（插件持有的全局样式，dispose/HMR 时移除）
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

	// 2. 文案：注册词典 + 绑定翻译函数（bind 在调用时按当前 locale 取词）
	ctx.effect(() => ctx.locale.register(LOCALE_NS, LOCALE), `${PACKAGE_ID}: dictionaries`);
	const t = ctx.locale.bind(LOCALE_NS);

	// 3. 设置表单（ui-settings 公共边界）：读 accepted value、写经 Host 持久化
	const form = ctx.configForms.get(ENTRY_ID);
	/** 镜像未就绪时 value 为 undefined → 视为 off。 */
	const readTheme = () => form.getSnapshot().value?.theme ?? "off";

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
		if (theme === undefined) return;
		body.style.setProperty("--dsb-bg", `url("${BG_URL}")`);
		body.style.setProperty("--dsb-bg-pos", theme.bgPos);
		body.style.setProperty("--dsb-d-rgb", theme.dRgb);
		body.style.setProperty("--dsb-l-rgb", theme.lRgb);
		root.setAttribute("data-dsb-on", "");
		if (disposeOverride === null) disposeOverride = ctx.theme.overrideTokens(PACKAGE_ID, theme.tokens);
		current = id;
	};

	/** 跟随设置表单（写答案折入共享镜像；连接重置/文档更新均触发订阅）。 */
	const sync = () => {
		const value = readTheme();
		if (value === current) return;
		if (value === "off" || THEMES[value] === undefined) {
			removeOverride();
			clearCanvas();
			current = "off";
			return;
		}
		applyTheme(value);
	};
	ctx.effect(() => form.subscribe(sync), `${PACKAGE_ID}: settings form mirror`);
	sync();

	/**
	 * 设置行组件（自包含契约）：宿主不传 props——状态自订阅 configForms、
	 * 文案走 locale、控件按官方 token 自绘（practices.md：第三方不得加载
	 * Harness Client 包，样式只依赖 --dsw-alias-* 语义 token）。
	 */
	function SkinRow() {
		const [value, setValue] = react.useState(readTheme);
		react.useEffect(() => form.subscribe(() => setValue(readTheme())), []);
		const options = [
			{ id: "off", label: t("row.theme.off") },
			...Object.keys(THEMES).map((id) => ({ id, label: THEMES[id].name ?? id })),
		];
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
							const id = event.target.value;
							if (id === "off" || THEMES[id] !== undefined) form.set("theme", id);
						},
					},
					options.map(({ id, label }) =>
						react.createElement("option", { key: id, value: id }, label),
					),
				),
			),
		);
	}

	// 4. 注册设置行（「通用」分区；注册选项仅 id/order/label——Slots 目录实测，
	//    label 支持跟随 locale 的 thunk）。独立防抖：异常记录到 data-dsb-error，
	//    皮肤画布逻辑（步骤 3）不受影响。
	try {
		ctx.slots.inject("settings.general.item", () =>
			ctx.slots.register(
				{
					name: "settings.general.item",
					id: "dream-skin",
					order: 13,
					label: () => t("row.title"),
				},
				SkinRow,
			),
		);
	} catch (error) {
		reportError("settings-row", error);
	}

	// 5. 独立面板（skill-explorer 同款已验证模式）：侧栏图标（sidebar.panellist，
	//    id 即面板 id）+ 主栏整页（main，keyed by 面板 id）。图标收 {size, active}
	//    owner props；页面无 props，全部经 apply 闭包（slots 文档：service 留在
	//    apply closure，只向组件投影数据与 callback）。
	function SkinPanelIcon({ size, active }) {
		const px = typeof size === "number" ? size : 20;
		return react.createElement(
			"svg",
			{
				viewBox: "0 0 24 24",
				width: px,
				height: px,
				"aria-hidden": true,
				style: { display: "block", pointerEvents: "none" },
			},
			react.createElement("path", {
				d: "M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 0-4H12a1.5 1.5 0 0 1 0-3h5.5A3.5 3.5 0 0 0 21 10.5 7.5 7.5 0 0 0 12 3Z",
				fill: "none",
				stroke: active ? "var(--dsw-alias-state-business-primary)" : "currentColor",
				"stroke-width": 1.6,
				"stroke-linejoin": "round",
			}),
			react.createElement("circle", { cx: 8, cy: 9.5, r: 1.1, fill: "currentColor" }),
			react.createElement("circle", { cx: 12, cy: 7.5, r: 1.1, fill: "currentColor" }),
			react.createElement("circle", { cx: 7, cy: 14, r: 1.1, fill: "currentColor" }),
		);
	}

	/** 主题卡片：背景缩略图（资产 URL）+ 名称；off 卡用官方材质。 */
	function ThemeCard({ id, label, hint, active, onPick }) {
		const isOff = id === "off";
		return react.createElement(
			"button",
			{
				type: "button",
				className: active ? "dsb_card dsb_cardActive" : "dsb_card",
				onClick: onPick,
			},
			react.createElement(
				"div",
				{
					className: "dsb_cardThumb",
					style: isOff ? undefined : { backgroundImage: `url("${BG_URL}")` },
				},
				isOff ? react.createElement("span", { className: "dsb_cardOffGlyph" }, "DSH") : null,
			),
			react.createElement("div", { className: "dsb_cardName" }, label),
			hint ? react.createElement("div", { className: "dsb_cardHint" }, hint) : null,
		);
	}

	function SkinPanelPage() {
		const [value, setValue] = react.useState(readTheme);
		react.useEffect(() => form.subscribe(() => setValue(readTheme())), []);
		const pick = (id) => {
			if (id === "off" || THEMES[id] !== undefined) form.set("theme", id);
		};
		return react.createElement(
			"div",
			{ className: "dsb_panel" },
			react.createElement("h1", { className: "dsb_panelTitle" }, t("panel.title")),
			react.createElement("p", { className: "dsb_panelSubtitle" }, t("panel.subtitle")),
			react.createElement(
				"div",
				{ className: "dsb_panelGrid" },
				react.createElement(ThemeCard, {
					id: "off",
					label: t("panel.theme.off"),
					hint: t("panel.theme.off.hint"),
					active: value === "off",
					onPick: () => pick("off"),
				}),
				Object.keys(THEMES).map((id) =>
					react.createElement(ThemeCard, {
						key: id,
						id,
						label: THEMES[id].name ?? id,
						hint: null,
						active: value === id,
						onPick: () => pick(id),
					}),
				),
			),
		);
	}

	try {
		ctx.slots.inject("sidebar.panellist", () =>
			ctx.slots.register(
				{
					name: "sidebar.panellist",
					id: PACKAGE_ID,
					order: 40,
					label: () => t("panel.label"),
				},
				SkinPanelIcon,
			),
		);
		ctx.slots.inject("main", () =>
			ctx.slots.register(
				{
					name: "main",
					key: PACKAGE_ID,
				},
				SkinPanelPage,
			),
		);
	} catch (error) {
		reportError("panel", error);
	}

	// 6. 调试句柄（devtools 里 window.__dsb__ 可查状态/手切主题；dispose 时清除）
	ctx.effect(() => () => {
		delete window.__dsb__;
	}, `${PACKAGE_ID}: debug handle`);
	window.__dsb__ = {
		get current() {
			return current;
		},
		themes: Object.keys(THEMES),
		setTheme: (id) => {
			if (id !== "off" && THEMES[id] === undefined) return false;
			form.set("theme", id);
			return true;
		},
	};

	// 7. 兜底 teardown（dispose/HMR：样式表由步骤 1 移除，这里收覆盖层与画布）
	ctx.effect(() => () => {
		removeOverride();
		clearCanvas();
	}, `${PACKAGE_ID}: teardown`);
}

exports.apply = apply;
exports.inject = inject;
