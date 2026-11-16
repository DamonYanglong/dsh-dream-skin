/*
 * 50-components.js — UI 组件工厂（面板页/侧栏图标/设置行）。
 * 职责：createPanelComponents(d)（d = { react, t, form, engine, THEMES }）返回
 *   { ThemeCard, SkinPanelPage, SkinPanelIcon, SkinRow }；全部自绘自管
 *   （slot 契约：宿主不传 props；状态经 d.form/d.engine 读写）。
 * 不引用：网络、全局 DOM 副作用（纯 React 渲染）。
 */
function createPanelComponents(d) {
	const react = d.react;

	/* ---------- 面板组件 ---------- */

	/** 主题卡片：缩略图 + 名称；导入卡带删除角标。 */
	function ThemeCard({ id, label, hint, active, onPick, onRemove, bgUrl, removeLabel }) {
	const isOff = id === "off";
	const children = [
	d.react.createElement(
	"div",
	{
		className: "dsb_cardThumb",
		style: isOff ? undefined : { backgroundImage: `url("${bgUrl}")` },
	},
	isOff ? d.react.createElement("span", { className: "dsb_cardOffGlyph" }, "DSH") : null,
	),
	d.react.createElement("div", { className: "dsb_cardName" }, label),
	hint ? d.react.createElement("div", { className: "dsb_cardHint" }, hint) : null,
	];
	if (onRemove !== undefined) {
	children.push(
	d.react.createElement(
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
	return d.react.createElement(
	"button",
	{ type: "button", className: active ? "dsb_card dsb_cardActive" : "dsb_card", onClick: onPick },
	children,
	);
	}

	function SkinPanelPage() {
	const [value, setValue] = d.react.useState(d.engine.readTheme);
	const [vis, setVis] = d.react.useState(d.engine.readVisibility);
	const [importedList, setImportedList] = d.react.useState([]);
	const [importBusy, setImportBusy] = d.react.useState(false);
	const [importError, setImportError] = d.react.useState(null);
	d.react.useEffect(
	() =>
	d.form.subscribe(() => {
		setValue(d.engine.readTheme());
		setVis(d.engine.readVisibility());
	}),
	[],
	);
	d.react.useEffect(() => {
	let alive = true;
	d.engine.refreshImported().finally(() => {
	if (alive) setImportedList([...d.engine.imported.values()]);
	});
	return () => {
	alive = false;
	};
	}, []);
	const pick = (id) => {
	if (d.engine.anyTheme(id)) d.form.set("theme", id);
	};
	const slideVis = (n) => {
	if (!Number.isFinite(n)) return;
	const clamped = Math.min(100, Math.max(0, n));
	setVis(clamped);
	const def = d.engine.themeDefOf(value);
	if (def !== undefined) d.engine.applyAlphas(def, clamped);
	d.form.set("visibility", clamped);
	};
	const removeImported = (id) => {
	apiJson("api/dsh-dream-skin/remove", { method: "POST", body: JSON.stringify({ id }) })
	.then(() => d.engine.refreshImported())
	.then(() => setImportedList([...d.engine.imported.values()]))
	.then(() => {
		if (d.engine.readTheme() === id) d.form.set("theme", "off");
	})
	.catch((error) => setImportError(String(error?.message ?? error)));
	};
	/** 提交核心：清单 + 图片字节 → POST /import → 刷新 → 自动选中。 */
	const submitImport = async (manifest, imageBytes, ext) => {
	const created = await apiJson("api/dsh-dream-skin/import", {
	method: "POST",
	body: JSON.stringify({
		id: manifest.id,
		name: manifest.name,
		appearance: manifest.appearance,
		fx: manifest.art?.focusX,
		fy: manifest.art?.focusY,
		imageExt: ext,
		imageBase64: bufferToBase64(imageBytes),
		colors: {
			background: manifest.colors?.background ?? manifest.derivedFrom?.averageColor,
			text: manifest.colors?.text ?? manifest.sourceColors?.text,
			muted: manifest.colors?.muted ?? manifest.sourceColors?.muted,
			accent: manifest.colors?.accent ?? manifest.sourceColors?.accent,
			line: manifest.colors?.line,
		},
	}),
	});
	await d.engine.refreshImported();
	setImportedList([...d.engine.imported.values()]);
	d.form.set("theme", created.id);
	};

	/** ZIP 解析（零依赖）：central directory 定位条目，method 0 直读、
	 *  method 8 走 DecompressionStream("deflate-raw")（Chromium 103+ 内置）。
	 *  包规范同 Codex：theme.json + 背景图位于根目录或单层顶层文件夹。 */
	async function readZipEntries(file) {
	const buf = new DataView(await file.arrayBuffer());
	let eocd = -1;
	for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65558); i--) {
	if (buf.getUint32(i, true) === 0x06054b50) {
		eocd = i;
		break;
	}
	}
	if (eocd < 0) throw new Error("not a zip archive");
	const count = buf.getUint16(eocd + 10, true);
	let ptr = buf.getUint32(eocd + 16, true);
	const central = [];
	for (let n = 0; n < count; n++) {
	if (buf.getUint32(ptr, true) !== 0x02014b50) throw new Error("bad central directory");
	const method = buf.getUint16(ptr + 10, true);
	const csize = buf.getUint32(ptr + 20, true);
	const nameLen = buf.getUint16(ptr + 28, true);
	const extraLen = buf.getUint16(ptr + 30, true);
	const commentLen = buf.getUint16(ptr + 32, true);
	const localOff = buf.getUint32(ptr + 42, true);
	const name = new TextDecoder().decode(new Uint8Array(buf.buffer, ptr + 46, nameLen));
	if (!name.endsWith("/")) central.push({ name, method, csize, localOff });
	ptr += 46 + nameLen + extraLen + commentLen;
	}
	const entries = new Map();
	for (const e of central) {
	const lp = e.localOff;
	if (buf.getUint32(lp, true) !== 0x04034b50) throw new Error("bad local header");
	const lname = buf.getUint16(lp + 26, true);
	const lextra = buf.getUint16(lp + 28, true);
	const start = lp + 30 + lname + lextra;
	const raw = new Uint8Array(buf.buffer, start, e.csize);
	if (e.method === 0) entries.set(e.name, raw);
	else if (e.method === 8) {
		const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
		entries.set(e.name, new Uint8Array(await new Response(stream).arrayBuffer()));
	} else throw new Error(`unsupported compression method ${e.method}`);
	}
	return entries;
	}

	/** ZIP 导入（主入口）。 */
	const importZip = async (zipFile) => {
	setImportBusy(true);
	setImportError(null);
	try {
	const entries = await readZipEntries(zipFile);
	const names = [...entries.keys()];
	const findEntry = (target) => names.find((n) => n === target || n.endsWith("/" + target));
	const jsonName = findEntry("theme.json") ?? names.find((n) => n.endsWith(".json"));
	if (jsonName === undefined) throw new Error(d.t("panel.import.hint"));
	const manifest = JSON.parse(new TextDecoder().decode(entries.get(jsonName)));
	const imgName = (manifest.image ? findEntry(manifest.image) : undefined) ?? names.find((n) => /\.(jpe?g|png|webp)$/i.test(n));
	if (imgName === undefined) throw new Error(d.t("panel.import.hint"));
	const ext = (imgName.split(".").pop() ?? "jpg").toLowerCase();
	await submitImport(manifest, entries.get(imgName), ext);
	} catch (error) {
	setImportError(String(error?.message ?? error));
	} finally {
	setImportBusy(false);
	}
	};

	/** 文件夹导入（次要入口）。 */
	const importFolder = async (fileList) => {
	const files = [...fileList];
	const jsonFile = files.find((f) => f.name === "theme.json") ?? files.find((f) => f.name.endsWith(".json"));
	const imageFile = files.find((f) => /\.(jpe?g|png|webp)$/i.test(f.name));
	if (jsonFile === undefined || imageFile === undefined) {
	setImportError(d.t("panel.import.hint"));
	return;
	}
	setImportBusy(true);
	setImportError(null);
	try {
	const manifest = JSON.parse(await jsonFile.text());
	const imageBuffer = await imageFile.arrayBuffer();
	const ext = (imageFile.name.split(".").pop() ?? "jpg").toLowerCase();
	await submitImport(manifest, imageBuffer, ext);
	} catch (error) {
	setImportError(String(error?.message ?? error));
	} finally {
	setImportBusy(false);
	}
	};
	const def = d.engine.themeDefOf(value);
	const tunable = def !== undefined;
	const builtinCards = [
	d.react.createElement(ThemeCard, {
	key: "off",
	id: "off",
	label: d.t("panel.theme.off"),
	hint: d.t("panel.theme.off.hint"),
	active: value === "off",
	onPick: () => pick("off"),
	}),
	...Object.keys(THEMES).map((id) =>
	d.react.createElement(ThemeCard, {
		key: id,
		id,
		label: THEMES[id].name ?? id,
		hint: null,
		active: value === id,
		onPick: () => pick(id),
		bgUrl: d.engine.builtinUrl(id),
	}),
	),
	];
	const importedCards = importedList
	.filter((m) => THEMES[m.id] === undefined)
	.map((m) =>
	d.react.createElement(ThemeCard, {
	key: m.id,
	id: m.id,
	label: m.name ?? m.id,
	hint: m.importedFrom ?? null,
	active: value === m.id,
	onPick: () => pick(m.id),
	onRemove: () => removeImported(m.id),
	removeLabel: d.t("panel.remove"),
	bgUrl: importedUrl(m),
	}),
	);
	return d.react.createElement(
	"div",
	{ className: "dsb_panel" },
	d.react.createElement("h1", { className: "dsb_panelTitle" }, d.t("panel.title")),
	d.react.createElement("p", { className: "dsb_panelSubtitle" }, d.t("panel.subtitle")),
	d.react.createElement("div", { className: "dsb_sectionTitle" }, d.t("panel.builtin")),
	d.react.createElement("div", { className: "dsb_panelGrid" }, builtinCards),
	d.react.createElement(
	"div",
	{ className: "dsb_importHead" },
	d.react.createElement("div", { className: "dsb_sectionTitle" }, d.t("panel.imported")),
	d.react.createElement(
		"label",
		{ className: importBusy ? "dsb_importButton dsb_busy" : "dsb_importButton" },
		importBusy ? d.t("panel.import.busy") : d.t("panel.import.zip"),
		d.react.createElement("input", {
			type: "file",
			accept: ".zip,application/zip",
			onChange: (event) => {
				const f = event.target.files?.[0];
				if (f) void importZip(f);
				event.target.value = "";
			},
		}),
	),
	d.react.createElement(
		"label",
		{ className: "dsb_importButton dsb_importFolder", title: d.t("panel.import.folder.hint") },
		d.t("panel.import.folder"),
		d.react.createElement("input", {
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
	importError !== null ? d.react.createElement("div", { className: "dsb_importError" }, `${d.t("panel.import.fail")}: ${importError}`) : null,
	importedCards.length > 0 ? d.react.createElement("div", { className: "dsb_panelGrid" }, importedCards) : d.react.createElement("div", { className: "dsb_cardHint" }, d.t("panel.import.hint")),
	tunable
	? d.react.createElement(
			"div",
			{ className: "dsb_panelSliders" },
			d.react.createElement(
				"label",
				{ className: "dsb_panelSlider" },
				d.react.createElement("span", { className: "dsb_panelSliderLabel" }, d.t("panel.visibility")),
				d.react.createElement("input", {
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
	return d.react.createElement(
	"svg",
	{
	viewBox: "0 0 24 24",
	width: px,
	height: px,
	"aria-hidden": true,
	style: { display: "block", pointerEvents: "none" },
	},
	d.react.createElement("path", {
	d: "M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 0-4H12a1.5 1.5 0 0 1 0-3h5.5A3.5 3.5 0 0 0 21 10.5 7.5 7.5 0 0 0 12 3Z",
	fill: "none",
	stroke: active ? "var(--dsw-alias-state-business-primary)" : "currentColor",
	"stroke-width": 1.6,
	"stroke-linejoin": "round",
	}),
	d.react.createElement("circle", { cx: 8, cy: 9.5, r: 1.1, fill: "currentColor" }),
	d.react.createElement("circle", { cx: 12, cy: 7.5, r: 1.1, fill: "currentColor" }),
	d.react.createElement("circle", { cx: 7, cy: 14, r: 1.1, fill: "currentColor" }),
	);
	}

	

	/** 设置行（自绘自管）。 */
	function SkinRow() {
	const [value, setValue] = d.react.useState(d.engine.readTheme);
	d.react.useEffect(() => d.form.subscribe(() => setValue(d.engine.readTheme())), []);
	const options = [
	{ id: "off", label: d.t("row.theme.off") },
	...Object.keys(THEMES).map((id) => ({ id, label: THEMES[id].name ?? id })),
	...[...d.engine.imported.values()].map((m) => ({ id: m.id, label: m.name ?? m.id })),
	];
	return d.react.createElement(
	"div",
	{ className: "dsb_settingsRow" },
	d.react.createElement("div", { className: "dsb_settingsRowTitle" }, d.t("row.title")),
	d.react.createElement(
	"div",
	{ className: "dsb_settingsRowControl" },
	d.react.createElement(
		"select",
		{
			className: "dsb_themeSelect",
			value,
			onChange: (event) => {
				if (d.engine.anyTheme(event.target.value)) d.form.set("theme", event.target.value);
			},
		},
		options.map(({ id, label }) => d.react.createElement("option", { key: id, value: id }, label)),
	),
	),
	);
	}

	return { ThemeCard, SkinPanelPage, SkinPanelIcon, SkinRow };
}
