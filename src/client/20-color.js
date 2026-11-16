/*
 * 20-color.js — 颜色工具与调色板推导（纯函数）。
 * 职责：hex/hsl/亮度换算；上游 derivePalettes 移植；deriveTokens；withSidebarFill。
 * 不引用：DOM、网络、ctx；不持有状态。
 */
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
	// 官方侧栏有两层元素都消费此 token（sidebarCol + root/quietBars）同位叠加。
	// alpha 随「透出度」滑杆按比例联动，两壳都用主题暗调纱（v30：macOS
	// "深色侧栏+浅色内容"经典布局，左暗右亮；浅壳浓度较低保深色文字可读）
	"--dsw-specific-sidebar-fill": {
		light: "rgb(var(--dsb-d-rgb) / var(--dsb-a-side-l, 28%))",
		dark: "rgb(var(--dsb-d-rgb) / var(--dsb-a-side-d, 50%))",
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

