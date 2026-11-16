/*
 * 40-engine.js — 皮肤引擎工厂（主题解析/画布提交/设置同步）。
 * 职责：createSkinEngine(ctx, io)（io = { form, reportError }）返回
 *   { sync, refreshImported, themeDefOf, anyTheme, applyAlphas, builtinUrl,
 *      imported, readTheme, readVisibility, current(仅 getter) }；
 *   持有导入表/builtinArt/interestCache 运行态；原子切换（预解码 + seq 防回写）。
 * 不引用：React、locale、slots、面板/设置行组件（对 UI 一概无知）。
 */
function createSkinEngine(ctx, io) {
	const form = ctx.configForms.get(ENTRY_ID);
	const readTheme = () => io.form.getSnapshot().value?.theme ?? "off";
	const readVisibility = () => {
		const n = io.form.getSnapshot().value?.visibility;
		return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : DEFAULT_VISIBILITY;
	};

	/** 导入主题表（Host list 路由填充；id -> manifest）。 */
	const imported = new Map();
	/** 内置主题图的版本化 URL（list 路由填充；桌面端 /plugins/ 被 forwarder
	 *  改写 no-store → 大图每次重绘重拉 = 画布闪烁，故一律走自有 immutable 路由）。 */
	const builtinArt = new Map();
	const builtinUrl = (id) => builtinArt.get(id) ?? BG_URL;
	const importedUrl = (m) => `api/dsh-dream-skin/asset?id=${encodeURIComponent(m.id)}&file=${encodeURIComponent(m.image)}&v=${encodeURIComponent(m.rev ?? "")}`;
	/** 并发去重、串行重取（v33 修正：v13c 的单飞缓存把首次列表永久缓存，
	 *  导入/删除后的 refresh 拿到的是旧 promise → map 缺新 id → 设置回显
	 *  到达时 themeDefOf 查不到 → 新皮肤被当 off 清掉（导入后不自动选中）；
	 *  删除后列表同样不刷新。现在每次调用都重新拉取，仅在飞行中去重）。 */
	let importedInflight = null;
	function refreshImported() {
		if (importedInflight) return importedInflight;
		importedInflight = (async () => {
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
			io.reportError("import-list", error);
		} finally {
			importedInflight = null;
		}
		})();
		return importedInflight;
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
		// 恢复官方背景（材质/艺术图层与 html 兜底色卸下后，官方底色自然回归）
		document.body.style.removeProperty("background-image");
		document.body.style.removeProperty("background-size");
		document.body.style.removeProperty("background-position");
		document.body.style.removeProperty("background-repeat");
		document.body.style.removeProperty("background-color");
		root.style.removeProperty("background-color");
	};

	/** 材质 alpha 与 scrim 强度随「透出度」缩放，但保底：
	 *  scrim 底线 0.35；材质 alpha 底线 0.06（官方容器嵌套多层各自消费
	 *  bg-layer token，0.18 的底线层层叠加会把亮画压成深灰——v15 实测）。
	 *  侧栏可读性由 --dsw-specific-sidebar-fill 专门保障。 */
	const applyAlphas = (def, v) => {
		for (const [key, d] of Object.entries({ ...DEFAULT_ALPHAS, ...(def.alphas ?? {}) })) {
		// 底值分档：暗壳侧栏 0.50（双层≈0.75，对齐 zds 暗壳侧栏 0.72-0.84
		// 的近实底强度——亮色画下读作真正的深色侧栏）；浅壳 0.16；材质 0.06
		const floor = key === "side-d" ? 0.5 : key === "side-l" ? 0.18 : 0.06;
		const a = Math.max(floor, Math.min(0.95, (d * (100 - v)) / 45));
		root.style.setProperty(`--dsb-a-${key}`, a.toFixed(3));
		}
		// scrim 底线 0.35（侧栏可读性由 --dsw-specific-sidebar-fill 专门保障，
		// 不再叠全局 scrim——v15 修正：双叠把亮画暗壳压成近黑）
		const k = Math.max(0.35, (100 - Math.min(100, Math.max(0, v))) / 100);
		root.style.setProperty("--dsb-scrim-k", k.toFixed(3));
	};

	/** 画布元素（v19 架构）：固定定位 <img>（object-fit: contain 原生自适应
	 *  居中、永不裁切）+ scrim 覆盖层（文字对比纱）+ html 底色（边带）。
	 *  此前用 html 多层 background 承载，Edge 对逗号列表 var() 的静默失效
	 *  导致图片层不绘制（v14–v18 反复翻车），img 元素则保证绘制。 */


	/** 兴趣中心检测（v22）——忠实移植上游 Codex Dream Skin renderer-inject.js
	 *  的 analyzeArt()（MIT）：96px 降采样 → 逐像素亮度/饱和度采样 → 左右 38%
	 *  区域信息量（stddev×0.58 + 边缘密度×0.42）判定安全侧 → 显著性加权
	 *  （亮度差 0.48 + 饱和度 0.34 + 边缘 0.28）质心为焦点 → 安全侧约束
	 *  （安全侧在左则焦点 ≥0.64，在右则 ≤0.36）→ clamp。结果按 URL 缓存。 */
	const interestCache = new Map();
	const detectInterestCenter = (def) => {
		if (interestCache.has(def.bgUrl)) return interestCache.get(def.bgUrl);
		const result = new Promise((resolve) => {
		const image = new Image();
		const timer = setTimeout(() => resolve({ focusX: 0.5, focusY: 0.5 }), 6000);
		image.onerror = () => { clearTimeout(timer); resolve({ focusX: 0.5, focusY: 0.5 }); };
		image.onload = () => {
			try {
				clearTimeout(timer);
				const ratio = image.naturalWidth / image.naturalHeight;
				const width = Math.max(16, Math.round(ratio >= 1 ? 96 : 96 * ratio));
				const height = Math.max(16, Math.round(ratio >= 1 ? 96 / ratio : 96));
				const canvas = document.createElement("canvas");
				canvas.width = width;
				canvas.height = height;
				const context = canvas.getContext?.("2d", { willReadFrequently: true });
				if (!context) throw new Error("no canvas");
				context.drawImage(image, 0, 0, width, height);
				const data = context.getImageData(0, 0, width, height).data;
				const samples = new Array(width * height);
				let lightTotal = 0, count = 0;
				for (let y = 0; y < height; y += 1) {
					for (let x = 0; x < width; x += 1) {
						const o = (y * width + x) * 4;
						const rgb = { r: data[o], g: data[o + 1], b: data[o + 2] };
						const values = [rgb.r, rgb.g, rgb.b].map((v) => v / 255);
						const max = Math.max(...values), min = Math.min(...values);
						const light = (max + min) / 2;
						const saturation = max === min ? 0
							: light > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
						samples[y * width + x] = { light, saturation };
						lightTotal += light;
						count += 1;
					}
				}
				if (!count) throw new Error("no pixels");
				const brightness = lightTotal / count;
				const zoneInfo = (start, end) => {
					let total = 0, totalSq = 0, edges = 0, edgeCount = 0, pixels = 0;
					for (let y = 0; y < height; y += 1) {
						for (let x = start; x < end; x += 1) {
							const sm = samples[y * width + x];
							if (!sm) continue;
							total += sm.light;
							totalSq += sm.light * sm.light;
							pixels += 1;
							const prev = x > start ? samples[y * width + x - 1] : null;
							const above = y > 0 ? samples[(y - 1) * width + x] : null;
							if (prev) { edges += Math.abs(sm.light - prev.light); edgeCount += 1; }
							if (above) { edges += Math.abs(sm.light - above.light); edgeCount += 1; }
						}
					}
					const mean = pixels ? total / pixels : 0;
					const variance = pixels ? Math.max(0, totalSq / pixels - mean * mean) : 1;
					return Math.sqrt(variance) * 0.58 + (edgeCount ? edges / edgeCount : 1) * 0.42;
				};
				const zoneW = Math.max(1, Math.floor(width * 0.38));
				const leftInfo = zoneInfo(0, zoneW);
				const rightInfo = zoneInfo(width - zoneW, width);
				let safeArea = "center";
				if (leftInfo < rightInfo * 0.86) safeArea = "left";
				else if (rightInfo < leftInfo * 0.86) safeArea = "right";
				let saliencyTotal = 0, sx = 0, sy = 0;
				for (let y = 0; y < height; y += 1) {
					for (let x = 0; x < width; x += 1) {
						const sm = samples[y * width + x];
						if (!sm) continue;
						const prev = x > 0 ? samples[y * width + x - 1] : null;
						const above = y > 0 ? samples[(y - 1) * width + x] : null;
						const edge = (prev ? Math.abs(sm.light - prev.light) : 0) +
							(above ? Math.abs(sm.light - above.light) : 0);
						const weight = 0.01 + Math.abs(sm.light - brightness) * 0.48 +
							sm.saturation * 0.34 + edge * 0.28;
						saliencyTotal += weight;
						sx += ((x + 0.5) / width) * weight;
						sy += ((y + 0.5) / height) * weight;
					}
				}
				let focusX = saliencyTotal ? sx / saliencyTotal : 0.5;
				let focusY = saliencyTotal ? sy / saliencyTotal : 0.5;
				if (safeArea === "left") focusX = Math.max(0.64, focusX);
				if (safeArea === "right") focusX = Math.min(0.36, focusX);
				focusX = Math.min(0.88, Math.max(0.12, focusX));
				focusY = Math.min(0.82, Math.max(0.18, focusY));
				clearTimeout(timer);
				resolve({ focusX, focusY, safeArea, brightness });
			} catch {
				clearTimeout(timer);
				resolve({ focusX: 0.5, focusY: 0.5 });
			}
		};
		image.src = def.bgUrl;
		});
		interestCache.set(def.bgUrl, result);
		return result;
	};

	/** 切换防闪（v16）：新图解码完成后一次性原子提交（序号防回写）。 */
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
		preloadArt(def.bgUrl).then(async () => {
		if (seq !== applySeq || readTheme() !== id) return;
		// Codex 预设同款：cover + 主题焦点（缺省 50% 50% 正中间）
		const focus = await detectInterestCenter(def).catch(() => null);
		const fx = focus?.focusX ?? (Number.isFinite(Number(def.fx)) ? Number(def.fx) : 0.5);
		const fy = focus?.focusY ?? (Number.isFinite(Number(def.fy)) ? Number(def.fy) : 0.5);
		root.style.setProperty("--dsb-d-rgb", def.dRgb);
		root.style.setProperty("--dsb-l-rgb", def.lRgb);
		const artUrl = `url("${def.bgUrl}")`;
		const bodyStyle = document.body.style;
		bodyStyle.setProperty("background-image", `linear-gradient(180deg, var(--dsb-fade-1) 0%, var(--dsb-fade-2) 32%, var(--dsb-fade-3) 68%, var(--dsb-fade-4) 100%), linear-gradient(90deg, var(--dsb-shade-1) 0%, var(--dsb-shade-2) 48%, var(--dsb-shade-3) 100%), ${artUrl}`, "important");
		bodyStyle.setProperty("background-size", "100% 100%, 100% 100%, cover", "important");
		bodyStyle.setProperty("background-position", `50% 50%, 50% 50%, ${(fx * 100).toFixed(0)}% ${(fy * 100).toFixed(0)}%`, "important");
		bodyStyle.setProperty("background-repeat", "no-repeat", "important");
		// 画布兜底色（学 dsh-plugin-wallpaper-engine）：窗口状态切换时负 z
		// 背景层像素可能未被合成，露出 Electron 底板白色；把根元素背景钉成
		// 主题代表色，掉层时退化成同色底而非白闪。只写 html 不写 body
		//（darwin 下宿主规则强制 body 透明让位窗口材质）。
		const darkShell = document.body?.hasAttribute("data-ds-dark-theme");
		root.style.setProperty("background-color", darkShell ? `rgb(${def.dRgb})` : `rgb(${def.lRgb})`, "important");
		root.setAttribute("data-dsb-on", "");
		root.setAttribute("data-dsb-theme", id);
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

	return {
		sync, refreshImported, themeDefOf, anyTheme, applyAlphas,
		builtinUrl, imported, readTheme, readVisibility,
		removeOverride, clearCanvas,
		get current() { return current; },
	};
}
