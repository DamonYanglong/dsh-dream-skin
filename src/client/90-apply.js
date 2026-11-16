/*
 * 90-apply.js — 插件编排器（唯一宿主入口）。
 * 职责：装样式表/文案 → 建 engine 与组件 → 注册三席位（侧栏图标/主栏页/设置行）
 *   → 调试句柄 → teardown；自身零业务逻辑。
 * 不引用：主题解析细节、颜色推导、ZIP（全部经 engine/components 模块）。
 */
function apply(ctx) {
	if (typeof document === "undefined") return;

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

	// 2. 文案：注册词典 + 绑定翻译函数
	ctx.effect(() => ctx.locale.register(LOCALE_NS, LOCALE), `${PACKAGE_ID}: dictionaries`);
	const t = ctx.locale.bind(LOCALE_NS);

	// 3. 引擎 + 组件
	const form = ctx.configForms.get(ENTRY_ID);
	const engine = createSkinEngine(ctx, { form, reportError });
	const { ThemeCard, SkinPanelPage, SkinPanelIcon, SkinRow } = createPanelComponents({
		react, t, form, engine, THEMES,
	});

	ctx.effect(() => form.subscribe(engine.sync), `${PACKAGE_ID}: settings form mirror`);
	engine.sync();
	engine.refreshImported();
	// 预热内置主题图（导入主题在 refreshImported 的 sync 提交时自然预热）
	for (const id of Object.keys(THEMES)) {
		const img = new Image();
		img.src = BG_URL;
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

	// 5. 调试句柄
	ctx.effect(() => () => {
		delete window.__dsb__;
	}, `${PACKAGE_ID}: debug handle`);
	window.__dsb__ = {
		get current() {
			return engine.current;
		},
		themes: Object.keys(THEMES),
		get imported() {
			return [...engine.imported.keys()];
		},
		setTheme: (id) => {
			if (!engine.anyTheme(id)) return false;
			form.set("theme", id);
			return true;
		},
	};

	// 6. 兜底 teardown（dispose/HMR：样式表由步骤 1 移除，这里收覆盖层与画布）
	ctx.effect(() => () => {
		engine.removeOverride();
		engine.clearCanvas();
	}, `${PACKAGE_ID}: teardown`);
}

exports.apply = apply;
exports.inject = inject;
