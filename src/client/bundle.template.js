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
const CANVAS_VARS = ["--dsb-bg", "--dsb-bg-pos", "--dsb-bg-size", "--dsb-d-rgb", "--dsb-l-rgb", "--dsb-scrim-k", "--dsb-a-base", "--dsb-a-1", "--dsb-a-2", "--dsb-a-3"];

/** 背景透出度默认值（0–100；与 Host Config 默认一致）。 */
const DEFAULT_VISIBILITY = 75;
/** 导入主题的默认材质 alpha 阶梯（DESIGN §5.1）。 */
const DEFAULT_ALPHAS = { base: 0.62, 1: 0.62, 2: 0.72, 3: 0.82 };

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

/* ---------- 调色板推导（移植 zcode-dream-skin/scripts/import-theme.mjs
 * derivePalettes——上游已踩平的坑：源文字色只进亮度合格的外壳；
 * 全部角色色 HSL 定亮度，暗/浅双壳各一套）。---------- */

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** "#rrggbb" → [r,g,b]；非法返回 null。 */
function hexToRgbArr(hex) {
	const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
	if (!m) return null;
	const n = parseInt(m[1], 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** [r,g,b] → [h(0-360), s(0-1), l(0-1)]。 */
function rgbToHsl([r, g, b]) {
	r /= 255; g /= 255; b /= 255;
	const max = Math.max(r, g, b), min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return [0, 0, l];
	const d = max - min;
	const sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h;
	if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
	else if (max === g) h = ((b - r) / d + 2) * 60;
	else h = ((r - g) / d + 4) * 60;
	return [h, sat, l];
}

/** [h,s,l] → [r,g,b]。 */
function hslToRgbArr([h, s, l]) {
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const hp = (((h % 360) + 360) % 360) / 60;
	const x = c * (1 - Math.abs((hp % 2) - 1));
	const [r1, g1, b1] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x]
		: hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
	const m = l - c / 2;
	return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

/** WCAG 相对亮度。 */
function relLum(rgb) {
	const lin = (u) => {
		u /= 255;
		return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

/** [h,s,l(,a)] → "hsl(H S% L%)" 或 "hsl(H S% L% / a)"。 */
const hslCss = ([h, s, l], a) =>
	a === undefined
		? `hsl(${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%)`
		: `hsl(${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}% / ${a})`;

/** [h,s,l] → "r g b" 空格三元组（画布 scrim 变量用）。 */
const hslTriplet = (hsl) =>
	hslToRgbArr(hsl)
		.map((v) => Math.round(v))
		.join(" ");

/** "hsl(H S% L%)" 字符串 → "r g b" 三元组（baseTone 已经是 hsl 字符串）。 */
function hslTripletFromString(hslStr) {
	const m = /hsl\(([\d.]+) ([\d.]+)% ([\d.]+)%\)/.exec(hslStr);
	return hslTriplet([Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100]);
}

/**
 * 上游 derivePalettes 的 DSH 移植：以底色（panel 色/图均值）定色相，
 * accent 定强调色相；输出暗/浅双壳的角色色与 scrim 底色。
 */
function derivePalettes(srcColors, baseRgb) {
	const [h, s] = rgbToHsl(baseRgb);
	const accentSrc = srcColors?.accent ? rgbToHsl(hexToRgbArr(srcColors.accent)) : null;
	const aHue = accentSrc?.[0] ?? h;
	const aSat = clamp01((accentSrc?.[1] ?? s) * 0.9 + 0.15);

	const sat = (x) => clamp01(s * x);
	// 源文字色只给亮度合格的外壳用（鲸鱼娘 #352970/#030303 进暗壳会不可读）
	const srcText = srcColors?.text;
	const srcMuted = srcColors?.muted;
	const darkFg = srcText && relLum(hexToRgbArr(srcText)) >= 0.5 ? srcText : hslCss([h, sat(0.25), 0.9]);
	const darkFgSubtle = srcMuted && relLum(hexToRgbArr(srcMuted)) >= 0.45 ? srcMuted : hslCss([h, sat(0.2), 0.72]);
	const lightFg = srcText && relLum(hexToRgbArr(srcText)) <= 0.62 ? srcText : hslCss([h, sat(0.2), 0.14]);

	const borderHue = aHue;
	return {
		dark: {
			fg: darkFg,
			fgSubtle: darkFgSubtle,
			fgSubtlest: hslCss([h, sat(0.18), 0.58]),
			border: (a) => hslCss([borderHue, aSat, 0.6], a),
			brand: hslCss([aHue, aSat, 0.62]),
			hoverFill: hslCss([aHue, aSat, 0.62], 0.1),
			scrollbar: hslCss([aHue, aSat, 0.62], 0.28),
			scrollbarHover: hslCss([aHue, aSat, 0.62], 0.45),
			baseTone: hslCss([h, sat(0.6), 0.05]),
		},
		light: {
			fg: lightFg,
			fgSubtle: hslCss([h, sat(0.18), 0.36]),
			fgSubtlest: hslCss([h, sat(0.15), 0.52]),
			border: (a) => hslCss([borderHue, aSat, 0.32], a),
			brand: hslCss([aHue, aSat, 0.38]),
			hoverFill: hslCss([aHue, aSat, 0.5], 0.18),
			scrollbar: "var(--dsw-static-neutral-200)",
			scrollbarHover: "var(--dsw-static-neutral-300)",
			baseTone: hslCss([h, sat(0.3), 0.94]),
		},
	};
}

/** 侧栏专用衬底（官方 token：「Sidebar column and title-row background」）：
 *  高不透明度主题色纱，与透出度滑杆解耦——侧栏可读性不随「拉满看图」牺牲，
 *  并与右侧主区（半透明、透出背景图）形成 zds 式的层次差。 */
const withSidebarFill = (tokens) => ({
	...tokens,
	// 注意：官方侧栏有两层元素都消费此 token（sidebarCol + root/quietBars），
	// 同位叠加；单层 0.4/0.45 → 组合 ≈ 0.6，接近 zds 的侧栏衬底强度
	"--dsw-specific-sidebar-fill": {
		light: "rgb(var(--dsb-l-rgb) / 0.45)",
		dark: "rgb(var(--dsb-d-rgb) / 0.4)",
	},
});

/** 导入主题的 token 覆盖层：双壳各一套（DSH §5.1 映射 × 上游调色板）。 */
function deriveTokens(colors, baseRgb) {
	const p = derivePalettes(colors ?? {}, baseRgb);
	return {
		"--dsw-alias-label-primary": { light: p.light.fg, dark: p.dark.fg },
		"--dsw-alias-label-secondary": { light: p.light.fgSubtle, dark: p.dark.fgSubtle },
		"--dsw-alias-label-tertiary": { light: p.light.fgSubtlest, dark: p.dark.fgSubtlest },
		"--dsw-alias-border-l1": { light: p.light.border(0.1), dark: p.dark.border(0.16) },
		"--dsw-alias-border-l2": { light: p.light.border(0.16), dark: p.dark.border(0.24) },
		"--dsw-alias-state-business-primary": { light: p.light.brand, dark: p.dark.brand },
		"--dsw-alias-link": { light: p.light.brand, dark: p.dark.brand },
		"--dsw-alias-interactive-bg-hover": { light: p.light.hoverFill, dark: p.dark.hoverFill },
		"--dsw-alias-scrollbar-bg-l1": { light: p.light.scrollbar, dark: p.dark.scrollbar },
		"--dsw-alias-scrollbar-hover-l1": { light: p.light.scrollbarHover, dark: p.dark.scrollbarHover },
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
	const response = await fetch(path, { cache: "no-store", ...init });
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
	/** 内置主题图的版本化 URL（list 路由填充；桌面端 /plugins/ 被 forwarder
	 *  改写 no-store → 大图每次重绘重拉 = 画布闪烁，故一律走自有 immutable 路由）。 */
	const builtinArt = new Map();
	const builtinUrl = (id) => builtinArt.get(id) ?? BG_URL;
	const importedUrl = (m) => `api/dsh-dream-skin/asset?id=${encodeURIComponent(m.id)}&file=${encodeURIComponent(m.image)}&v=${encodeURIComponent(m.rev ?? "")}`;
	/** 单飞加载：apply 物化时拉一次（v13c——此前挂在面板页 useEffect，
	 *  而 main 席位页面只在面板打开时挂载 → 启动后列表永远为空、
	 *  持久化的导入主题重启后永不生效）；面板挂载时复用同一 promise 保新鲜。 */
	let importedPromise = null;
	function refreshImported() {
		importedPromise ??= (async () => {
			try {
				const body = await apiJson("api/dsh-dream-skin/list");
				imported.clear();
				for (const m of Array.isArray(body.themes) ? body.themes : []) {
					if (typeof m?.id === "string" && typeof m.image === "string") imported.set(m.id, m);
				}
				for (const b of Array.isArray(body.builtins) ? body.builtins : []) {
					if (typeof b?.id === "string" && typeof b.rev === "string") {
						builtinArt.set(b.id, `api/dsh-dream-skin/builtin?id=${encodeURIComponent(b.id)}&v=${encodeURIComponent(b.rev)}`);
					}
				}
				// 列表到位必须补 sync：boot 时持久化的导入主题曾被静默按 off 跳过
				sync();
			} catch (error) {
				reportError("import-list", error);
			}
		})();
		return importedPromise;
	}

	/** 统一主题定义：内置（烘焙）与导入（manifest 推导）。 */
	function themeDefOf(id) {
		const builtin = THEMES[id];
		if (builtin !== undefined) {
			return { id, name: builtin.name, fx: builtin.fx, fy: builtin.fy, dRgb: builtin.dRgb, lRgb: builtin.lRgb, alphas: builtin.alphas ?? DEFAULT_ALPHAS, tokens: withSidebarFill(builtin.tokens), bgUrl: builtinUrl(id), imported: false };
		}
		const m = imported.get(id);
		if (m !== undefined) {
			// 双壳 scrim 底色 = 上游 baseTone（暗壳 H S×0.6 5%、浅壳 H S×0.3 94%）
			const baseRgb = hexToRgbArr(m.colors?.background ?? "#0d0d0e") ?? [13, 13, 14];
			const p = derivePalettes(m.colors ?? {}, baseRgb);
			return {
				id,
				name: m.name ?? id,
				fx: Number.isFinite(Number(m.fx)) ? Number(m.fx) : 0.5,
				fy: Number.isFinite(Number(m.fy)) ? Number(m.fy) : 0.5,
				dRgb: hslTripletFromString(p.dark.baseTone),
				lRgb: hslTripletFromString(p.light.baseTone),
				alphas: DEFAULT_ALPHAS,
				tokens: withSidebarFill(deriveTokens(m.colors ?? {}, baseRgb)),
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
		root.style.removeProperty("background-size");
		root.style.removeProperty("background-position");
	};

	/** 材质 alpha 与 scrim 强度随「透出度」缩放，但保底：
	 *  scrim 底线 0.35；材质 alpha 底线 0.06（官方容器嵌套多层各自消费
	 *  bg-layer token，0.18 的底线层层叠加会把亮画压成深灰——v15 实测）。
	 *  侧栏可读性由 --dsw-specific-sidebar-fill 专门保障。 */
	const applyAlphas = (def, v) => {
		for (const [key, d] of Object.entries(def.alphas ?? DEFAULT_ALPHAS)) {
			const a = Math.max(0.06, Math.min(0.95, (d * (100 - v)) / 45));
			root.style.setProperty(`--dsb-a-${key}`, a.toFixed(3));
		}
		// scrim 底线 0.35（侧栏可读性由 --dsw-specific-sidebar-fill 专门保障，
		// 不再叠全局 scrim——v15 修正：双叠把亮画暗壳压成近黑）
		const k = Math.max(0.35, (100 - Math.min(100, Math.max(0, v))) / 100);
		root.style.setProperty("--dsb-scrim-k", k.toFixed(3));
	};

	/** 背景定位（v14）：按窗口尺寸 + 图片自然宽高逐像素计算，把主题焦点
	 *  （def.fx/fy，画面主体）锚定到视口中央，并监听 resize 重算——百分比
	 *  定位在宽高比变化时守不住主体（窄窗口会把主体挤出画面）。轻微放大
	 *  （ZOOM 1.2×）留出平移余量，clamp 保证画布无空隙。 */
	const ZOOM = 1.2;
	const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
	const layoutImg = new Image();
	let layoutPending = null;
	const layoutCanvas = (def) => {
		layoutPending = def;
		if (typeof window === "undefined" || typeof Image === "undefined") return;
		if (layoutImg.src !== def.bgUrl) {
			layoutImg.onload = () => layoutCanvas(layoutPending);
			layoutImg.src = def.bgUrl;
			if (!layoutImg.complete) return;
		}
		if (!layoutImg.naturalWidth) return;
		const W = window.innerWidth, H = window.innerHeight;
		const scale = Math.max(W / layoutImg.naturalWidth, H / layoutImg.naturalHeight) * ZOOM;
		const Ws = layoutImg.naturalWidth * scale, Hs = layoutImg.naturalHeight * scale;
		const ox = clamp(W / 2 - Ws * def.fx, W - Ws, 0);
		const oy = clamp(H / 2 - Hs * def.fy, H - Hs, 0);
		// 直接写内联样式（var() 代入逗号列表在 Edge 计算期被判无效——v14 实测），
		// important 压过官方任何 html 背景规则
		root.style.setProperty("background-size", `auto, auto, ${Ws.toFixed(0)}px ${Hs.toFixed(0)}px`, "important");
		root.style.setProperty("background-position", `center, center, ${ox.toFixed(0)}px ${oy.toFixed(0)}px`, "important");
	};

	/** 切换防闪（v16）：旧实现立刻换 --dsb-bg URL → 旧图瞬间消失、新图
	 *  未解码 → 整页闪白再跳位置。现改为：先解码新图（预热缓存，onerror
	 *  也放行避免卡死），再一次性原子提交全部画布状态；快速连续切换以
	 *  序号防 superseded 回写。 */
	let applySeq = 0;
	const artCache = new Map();
	const preloadArt = (url) => {
		let p = artCache.get(url);
		if (p === undefined) {
			p = new Promise((resolve) => {
				const img = new Image();
				img.onload = img.onerror = () => resolve();
				img.src = url;
			});
			artCache.set(url, p);
		}
		return p;
	};
	const applyTheme = (id, v) => {
		const def = themeDefOf(id);
		if (def === undefined) return;
		const seq = ++applySeq;
		preloadArt(def.bgUrl).then(() => {
			if (seq !== applySeq || readTheme() !== id) return;
			root.style.setProperty("--dsb-bg", `url("${def.bgUrl}")`);
			root.style.setProperty("--dsb-d-rgb", def.dRgb);
			root.style.setProperty("--dsb-l-rgb", def.lRgb);
			root.setAttribute("data-dsb-on", "");
			root.setAttribute("data-dsb-theme", id);
			layoutCanvas(def);
			applyAlphas(def, v);
			if (disposeOverride === null) disposeOverride = ctx.theme.overrideTokens(PACKAGE_ID, def.tokens);
			current = id;
		});
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
	refreshImported();
	// 预热内置主题图（导入主题在 refreshImported 的 sync 提交时自然预热）
	for (const id of Object.keys(THEMES)) {
		const img = new Image();
		img.src = BG_URL;
	}

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
			refreshImported().finally(() => {
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
					bgUrl: builtinUrl(id),
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

	// 5b. 窗口自适应：resize 重算焦点锚定
	ctx.effect(() => {
		const relayout = () => {
			if (layoutPending) layoutCanvas(layoutPending);
		};
		window.addEventListener("resize", relayout);
		return () => window.removeEventListener("resize", relayout);
	}, `${PACKAGE_ID}: canvas relayout`);

	// 6. 兜底 teardown
	ctx.effect(() => () => {
		removeOverride();
		clearCanvas();
	}, `${PACKAGE_ID}: teardown`);
}

exports.apply = apply;
exports.inject = inject;
