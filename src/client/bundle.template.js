/*
 * dsh-dream-skin · client bundle 模板（M2 v9）
 *
 * scripts/build.mjs 把本文件包进 ModuleLoader factory：
 *   window.__ModuleLoader__.load({ id: "dsh-dream-skin", factory: (require) => {...} })
 * 并注入三个占位值：骨架 CSS 字符串、主题定义 JSON、背景图 require.asset 表达式。
 *
 * 契约来源（全部为权威文档/在线 inspect）：
 *   - require("react")：平台静态表（官方 decoration 模板同款）；禁止 require
 *     任何 Harness Client 包（practices.md）。
 *   - ctx.theme.overrideTokens(source, tokens)：ui-theme README。
 *   - ctx.configForms.get(entryId)：ui-settings README（volatile 字段镜像）。
 *   - ctx.slots.inject/register：Slots 目录 + slot-catalog.ts。
 *   - Host 半侧路由 /api/dsh-dream-skin/*：skill-explorer 同款
 *     webServer exact 路由 + 同源 fetch（document-relative，无前导斜杠——
 *     GUI 带 <base href>，根绝对路径会逃出子路径部署）。
 *
 * 主题模型（v9）：内置主题（构建期烘焙）与导入主题（~/.dsh/dream-skins，
 * Host list 路由枚举）在运行时统一为 themeDef：{name, fx, fy, dRgb, lRgb,
 * alphas, tokens, bgUrl}；导入主题的 tokens/alpha 由 colors 现场推导。
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
const CANVAS_VARS = ["--dsb-bg", "--dsb-bg-pos", "--dsb-d-rgb", "--dsb-l-rgb", "--dsb-scrim-k", "--dsb-a-base", "--dsb-a-1", "--dsb-a-2", "--dsb-a-3"];

/** 背景透出度默认值（0–100；与 Host Config 默认一致）。 */
const DEFAULT_VISIBILITY = 75;
/** 导入主题的默认材质 alpha 阶梯（DESIGN §5.1）。 */
const DEFAULT_ALPHAS = { base: 0.62, 1: 0.62, 2: 0.72, 3: 0.82 };
/** 浅壳 scrim 底色兜底（zds 浅组 panel 色）。 */
const DEFAULT_L_RGB = "248 243 230";

/** 文案（M2：zh/en 先行）。 */
const LOCALE = {
	zh: {
		"row.title": "皮肤",
		"row.theme.off": "官方默认",
		"panel.label": "皮肤",
		"panel.title": "皮肤",
		"panel.subtitle": "为整个界面换上背景图与主题色",
		"panel.theme.off": "官方默认",
		"panel.theme.off.hint": "还原官方外观",
		"panel.builtin": "内置主题",
		"panel.imported": "导入的皮肤",
		"panel.import": "导入皮肤",
		"panel.import.hint": "选择一个主题文件夹（含 theme.json 与背景图，zcode-dream-skin 格式）",
		"panel.import.busy": "导入中…",
		"panel.import.fail": "导入失败",
		"panel.remove": "删除",
		"panel.visibility": "背景透出度",
	},
	en: {
		"row.title": "Skin",
		"row.theme.off": "Official default",
		"panel.label": "Skin",
		"panel.title": "Skin",
		"panel.subtitle": "Background art and theme colors for the whole interface",
		"panel.theme.off": "Official default",
		"panel.theme.off.hint": "Restore the stock appearance",
		"panel.builtin": "Built-in themes",
		"panel.imported": "Imported skins",
		"panel.import": "Import skin",
		"panel.import.hint": "Pick a theme folder (theme.json + background, zcode-dream-skin format)",
		"panel.import.busy": "Importing…",
		"panel.import.fail": "Import failed",
		"panel.remove": "Remove",
		"panel.visibility": "Background visibility",
	},
};

/** Required services: theme runtime, settings forms, locale, slots. */
const inject = ["theme", "configForms", "locale", "slots"];

/* ---------- 小工具 ---------- */

/** "#0d0d0e" → "13 13 14"（CSS 空格三元组）。 */
function hexToTriplet(hex) {
	const value = String(hex ?? "").trim().replace(/^#/, "");
	if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
	return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)).join(" ");
}

/** "#c8a55a" + 0.1 → "rgba(200, 165, 90 / 0.1)"（现代空格语法）。 */
function hexAlpha(hex, a) {
	const t = hexToTriplet(hex);
	return t === null ? null : `rgb(${t} / ${a})`;
}

/** 导入主题的 token 覆盖层（DESIGN §5.1 核心映射；缺色用 gothic 系兜底）。 */
function deriveTokens(colors) {
	const text = colors.text ?? "#f3ead7";
	const muted = colors.muted ?? "#b5a386";
	const accent = colors.accent ?? "#c8a55a";
	const line = hexToTriplet(colors.line ?? accent);
	const line1 = line === null ? "rgb(200 165 90 / 0.1)" : `rgb(${line} / 0.1)`;
	const line2 = line === null ? "rgb(200 165 90 / 0.16)" : `rgb(${line} / 0.16)`;
	const light = (expr) => ({ light: expr, dark: "" });
	return {
		"--dsw-alias-label-primary": { light: "var(--dsw-static-neutral-bluish-1000)", dark: text },
		"--dsw-alias-label-secondary": { light: "var(--dsw-static-neutral-bluish-700)", dark: muted },
		"--dsw-alias-label-tertiary": { light: "var(--dsw-static-neutral-bluish-600)", dark: colors.muted2 ?? muted },
		"--dsw-alias-border-l1": { light: "#0000000a", dark: line1 },
		"--dsw-alias-border-l2": { light: "#0000001a", dark: line2 },
		"--dsw-alias-state-business-primary": { light: "var(--dsw-static-deepseek-500)", dark: accent },
		"--dsw-alias-link": { light: "var(--dsw-static-deepseek-500)", dark: colors.accentAlt ?? accent },
		"--dsw-alias-interactive-bg-hover": {
			light: "#2631480f",
			dark: hexAlpha(accent, 0.1) ?? "rgb(200 165 90 / 0.1)",
		},
		"--dsw-alias-scrollbar-bg-l1": { light: "var(--dsw-static-neutral-200)", dark: hexAlpha(accent, 0.28) ?? "rgb(200 165 90 / 0.28)" },
		"--dsw-alias-scrollbar-hover-l1": { light: "var(--dsw-static-neutral-300)", dark: hexAlpha(accent, 0.45) ?? "rgb(200 165 90 / 0.45)" },
	};
}

/** ArrayBuffer → base64（分块，避免参数栈超限）。 */
function bufferToBase64(buffer) {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	const CHUNK = 0x8000;
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return btoa(binary);
}

/** 同源 fetch 的 JSON 封装（document-relative 路径）。 */
async function apiJson(path, init) {
	const response = await fetch(path, init);
	const body = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
	return body;
}

/**
 * Client plugin body：挂骨架样式表、跟随设置表单应用皮肤、注册面板与设置行。
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

	// 1. 骨架样式表
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

	// 2. 文案
	ctx.effect(() => ctx.locale.register(LOCALE_NS, LOCALE), `${PACKAGE_ID}: dictionaries`);
	const t = ctx.locale.bind(LOCALE_NS);

	// 3. 设置表单 + 导入主题登记表
	const form = ctx.configForms.get(ENTRY_ID);
	const readTheme = () => form.getSnapshot().value?.theme ?? "off";
	const readVisibility = () => {
		const n = form.getSnapshot().value?.visibility;
		return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : DEFAULT_VISIBILITY;
	};

	/** 导入主题表（Host list 路由填充；id -> manifest）。 */
	const imported = new Map();
	const importedUrl = (m) => `api/dsh-dream-skin/asset?id=${encodeURIComponent(m.id)}&file=${encodeURIComponent(m.image)}`;
	async function refreshImported() {
		try {
			const body = await apiJson("api/dsh-dream-skin/list");
			imported.clear();
			for (const m of Array.isArray(body.themes) ? body.themes : []) {
				if (typeof m?.id === "string" && typeof m.image === "string") imported.set(m.id, m);
			}
		} catch (error) {
			reportError("import-list", error);
		}
	}

	/** 统一主题定义：内置（烘焙）与导入（manifest 推导）。 */
	function themeDefOf(id) {
		const builtin = THEMES[id];
		if (builtin !== undefined) {
			return { id, name: builtin.name, fx: builtin.fx, fy: builtin.fy, dRgb: builtin.dRgb, lRgb: builtin.lRgb, alphas: builtin.alphas ?? DEFAULT_ALPHAS, tokens: builtin.tokens, bgUrl: BG_URL, imported: false };
		}
		const m = imported.get(id);
		if (m !== undefined) {
			const base = hexToTriplet(m.colors?.background ?? "#0d0d0e") ?? "13 13 14";
			return {
				id,
				name: m.name ?? id,
				fx: Number.isFinite(Number(m.fx)) ? Number(m.fx) : 0.5,
				fy: Number.isFinite(Number(m.fy)) ? Number(m.fy) : 0.5,
				dRgb: base,
				lRgb: DEFAULT_L_RGB,
				alphas: DEFAULT_ALPHAS,
				tokens: deriveTokens(m.colors ?? {}),
				bgUrl: importedUrl(m),
				imported: true,
			};
		}
		return undefined;
	}
	const anyTheme = (id) => id === "off" || THEMES[id] !== undefined || imported.has(id);

	const root = document.documentElement;
	let current = "off";
	let currentVis = DEFAULT_VISIBILITY;
	let disposeOverride = null;

	const removeOverride = () => {
		disposeOverride?.();
		disposeOverride = null;
	};

	const clearCanvas = () => {
		root.removeAttribute("data-dsb-on");
		root.removeAttribute("data-dsb-theme");
		for (const name of CANVAS_VARS) root.style.removeProperty(name);
	};

	/** 材质 alpha 与 scrim 强度随「透出度」缩放（v8 公式）。 */
	const applyAlphas = (def, v) => {
		for (const [key, d] of Object.entries(def.alphas ?? DEFAULT_ALPHAS)) {
			const a = Math.min(0.95, Math.max(0.05, (d * (100 - v)) / 45));
			root.style.setProperty(`--dsb-a-${key}`, a.toFixed(3));
		}
		root.style.setProperty("--dsb-scrim-k", ((100 - Math.min(100, Math.max(0, v))) / 100).toFixed(3));
	};

	/** 背景画布定位：居中 + cover 随窗口自适应（v10 用户决策，移除位置滑杆）。 */
	const applyPos = () => {
		root.style.setProperty("--dsb-bg-pos", "center");
	};

	/** 应用主题：画布参数 + 材质 alpha + token 覆盖层（幂等注册）。 */
	const applyTheme = (id, v) => {
		const def = themeDefOf(id);
		if (def === undefined) return;
		root.style.setProperty("--dsb-bg", `url("${def.bgUrl}")`);
		root.style.setProperty("--dsb-d-rgb", def.dRgb);
		root.style.setProperty("--dsb-l-rgb", def.lRgb);
		root.setAttribute("data-dsb-on", "");
		root.setAttribute("data-dsb-theme", id);
		applyPos();
		applyAlphas(def, v);
		if (disposeOverride === null) disposeOverride = ctx.theme.overrideTokens(PACKAGE_ID, def.tokens);
		current = id;
	};

	/** 跟随设置表单（theme / visibility 变化）。 */
	const sync = () => {
		const value = readTheme();
		const v = readVisibility();
		if (value === "off" || themeDefOf(value) === undefined) {
			if (current !== "off") {
				removeOverride();
				clearCanvas();
				current = "off";
			}
			return;
		}
		if (value !== current) {
			applyTheme(value, v);
			currentVis = v;
			return;
		}
		if (v !== currentVis) {
			applyAlphas(themeDefOf(value), v);
			currentVis = v;
		}
	};
	ctx.effect(() => form.subscribe(sync), `${PACKAGE_ID}: settings form mirror`);
	sync();

	/* ---------- 面板组件 ---------- */

	/** 主题卡片：缩略图 + 名称；导入卡带删除角标。 */
	function ThemeCard({ id, label, hint, active, onPick, onRemove, bgUrl, removeLabel }) {
		const isOff = id === "off";
		const children = [
			react.createElement(
				"div",
				{
					className: "dsb_cardThumb",
					style: isOff ? undefined : { backgroundImage: `url("${bgUrl}")` },
				},
				isOff ? react.createElement("span", { className: "dsb_cardOffGlyph" }, "DSH") : null,
			),
			react.createElement("div", { className: "dsb_cardName" }, label),
			hint ? react.createElement("div", { className: "dsb_cardHint" }, hint) : null,
		];
		if (onRemove !== undefined) {
			children.push(
				react.createElement(
					"button",
					{
						type: "button",
						className: "dsb_cardRemove",
						title: removeLabel,
						onClick: (event) => {
							event.stopPropagation();
							onRemove();
						},
					},
					"×",
				),
			);
		}
		return react.createElement(
			"button",
			{ type: "button", className: active ? "dsb_card dsb_cardActive" : "dsb_card", onClick: onPick },
			children,
		);
	}

	function SkinPanelPage() {
		const [value, setValue] = react.useState(readTheme);
		const [vis, setVis] = react.useState(readVisibility);
		const [importedList, setImportedList] = react.useState([]);
		const [importBusy, setImportBusy] = react.useState(false);
		const [importError, setImportError] = react.useState(null);
		react.useEffect(
			() =>
				form.subscribe(() => {
					setValue(readTheme());
					setVis(readVisibility());
				}),
			[],
		);
		react.useEffect(() => {
			let alive = true;
			refreshImported()
				.catch(() => {})
				.finally(() => {
					if (alive) setImportedList([...imported.values()]);
				});
			return () => {
				alive = false;
			};
		}, []);
		const pick = (id) => {
			if (anyTheme(id)) form.set("theme", id);
		};
		const slideVis = (n) => {
			if (!Number.isFinite(n)) return;
			const clamped = Math.min(100, Math.max(0, n));
			setVis(clamped);
			const def = themeDefOf(value);
			if (def !== undefined) applyAlphas(def, clamped);
			form.set("visibility", clamped);
		};
		const removeImported = (id) => {
			apiJson("api/dsh-dream-skin/remove", { method: "POST", body: JSON.stringify({ id }) })
				.then(() => refreshImported())
				.then(() => setImportedList([...imported.values()]))
				.then(() => {
					if (readTheme() === id) form.set("theme", "off");
				})
				.catch((error) => setImportError(String(error?.message ?? error)));
		};
		/** 文件夹导入：theme.json + 背景图 → POST /import → 刷新 → 自动选中新皮肤。 */
		const importFolder = async (fileList) => {
			const files = [...fileList];
			const jsonFile = files.find((f) => f.name === "theme.json") ?? files.find((f) => f.name.endsWith(".json"));
			const imageFile = files.find((f) => /\.(jpe?g|png|webp)$/i.test(f.name));
			if (jsonFile === undefined || imageFile === undefined) {
				setImportError(t("panel.import.hint"));
				return;
			}
			setImportBusy(true);
			setImportError(null);
			try {
				const manifest = JSON.parse(await jsonFile.text());
				const imageBuffer = await imageFile.arrayBuffer();
				const ext = (imageFile.name.split(".").pop() ?? "jpg").toLowerCase();
				const created = await apiJson("api/dsh-dream-skin/import", {
					method: "POST",
					body: JSON.stringify({
						id: manifest.id,
						name: manifest.name,
						appearance: manifest.appearance,
						fx: manifest.art?.focusX,
						fy: manifest.art?.focusY,
						imageExt: ext,
						imageBase64: bufferToBase64(imageBuffer),
						colors: {
							background: manifest.colors?.background ?? manifest.derivedFrom?.averageColor,
							text: manifest.colors?.text ?? manifest.sourceColors?.text,
							muted: manifest.colors?.muted ?? manifest.sourceColors?.muted,
							accent: manifest.colors?.accent ?? manifest.sourceColors?.accent,
							line: manifest.colors?.line,
						},
					}),
				});
				await refreshImported();
				setImportedList([...imported.values()]);
				form.set("theme", created.id);
			} catch (error) {
				setImportError(String(error?.message ?? error));
			} finally {
				setImportBusy(false);
			}
		};
		const def = themeDefOf(value);
		const tunable = def !== undefined;
		const builtinCards = [
			react.createElement(ThemeCard, {
				key: "off",
				id: "off",
				label: t("panel.theme.off"),
				hint: t("panel.theme.off.hint"),
				active: value === "off",
				onPick: () => pick("off"),
			}),
			...Object.keys(THEMES).map((id) =>
				react.createElement(ThemeCard, {
					key: id,
					id,
					label: THEMES[id].name ?? id,
					hint: null,
					active: value === id,
					onPick: () => pick(id),
					bgUrl: BG_URL,
				}),
			),
		];
		const importedCards = importedList
			.filter((m) => THEMES[m.id] === undefined)
			.map((m) =>
			react.createElement(ThemeCard, {
				key: m.id,
				id: m.id,
				label: m.name ?? m.id,
				hint: m.importedFrom ?? null,
				active: value === m.id,
				onPick: () => pick(m.id),
				onRemove: () => removeImported(m.id),
				removeLabel: t("panel.remove"),
				bgUrl: importedUrl(m),
			}),
		);
		return react.createElement(
			"div",
			{ className: "dsb_panel" },
			react.createElement("h1", { className: "dsb_panelTitle" }, t("panel.title")),
			react.createElement("p", { className: "dsb_panelSubtitle" }, t("panel.subtitle")),
			react.createElement("div", { className: "dsb_sectionTitle" }, t("panel.builtin")),
			react.createElement("div", { className: "dsb_panelGrid" }, builtinCards),
			react.createElement(
				"div",
				{ className: "dsb_importHead" },
				react.createElement("div", { className: "dsb_sectionTitle" }, t("panel.imported")),
				react.createElement(
					"label",
					{ className: importBusy ? "dsb_importButton dsb_busy" : "dsb_importButton" },
					importBusy ? t("panel.import.busy") : t("panel.import"),
					react.createElement("input", {
						type: "file",
						webkitdirectory: "",
						multiple: true,
						onChange: (event) => {
							if (event.target.files?.length > 0) void importFolder(event.target.files);
							event.target.value = "";
						},
					}),
				),
			),
			importError !== null ? react.createElement("div", { className: "dsb_importError" }, `${t("panel.import.fail")}: ${importError}`) : null,
			importedCards.length > 0 ? react.createElement("div", { className: "dsb_panelGrid" }, importedCards) : react.createElement("div", { className: "dsb_cardHint" }, t("panel.import.hint")),
			tunable
				? react.createElement(
						"div",
						{ className: "dsb_panelSliders" },
						react.createElement(
							"label",
							{ className: "dsb_panelSlider" },
							react.createElement("span", { className: "dsb_panelSliderLabel" }, t("panel.visibility")),
							react.createElement("input", {
								type: "range",
								min: 0,
								max: 100,
								step: 1,
								value: vis,
								onChange: (event) => slideVis(Number(event.target.value)),
							}),
						),
					)
				: null,
		);
	}

	/** 侧栏图标（{size, active} owner props）。 */
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

	// 4. 注册席位（自绘自管契约：宿主不传 props）
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
		reportError("slots", error);
	}

	/** 设置行（自绘自管）。 */
	function SkinRow() {
		const [value, setValue] = react.useState(readTheme);
		react.useEffect(() => form.subscribe(() => setValue(readTheme())), []);
		const options = [
			{ id: "off", label: t("row.theme.off") },
			...Object.keys(THEMES).map((id) => ({ id, label: THEMES[id].name ?? id })),
			...[...imported.values()].map((m) => ({ id: m.id, label: m.name ?? m.id })),
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
							if (anyTheme(event.target.value)) form.set("theme", event.target.value);
						},
					},
					options.map(({ id, label }) => react.createElement("option", { key: id, value: id }, label)),
				),
			),
		);
	}

	// 5. 调试句柄
	ctx.effect(() => () => {
		delete window.__dsb__;
	}, `${PACKAGE_ID}: debug handle`);
	window.__dsb__ = {
		get current() {
			return current;
		},
		themes: Object.keys(THEMES),
		get imported() {
			return [...imported.keys()];
		},
		setTheme: (id) => {
			if (!anyTheme(id)) return false;
			form.set("theme", id);
			return true;
		},
	};

	// 6. 兜底 teardown
	ctx.effect(() => () => {
		removeOverride();
		clearCanvas();
	}, `${PACKAGE_ID}: teardown`);
}

exports.apply = apply;
exports.inject = inject;
