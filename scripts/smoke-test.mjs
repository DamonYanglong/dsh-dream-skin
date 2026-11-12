#!/usr/bin/env node
/**
 * dsh-dream-skin · client bundle 冒烟测试（零依赖，v5 契约）
 *
 * stub 层实现「权威文档契约」（slot-catalog.ts 源码 + ui-settings/slots 文档）：
 * - require 白名单仅 react：出现任何其他 external require 直接失败
 *   （practices.md：禁止把 Harness Client 包当模块加载）。
 * - settings.general.item：注册选项 {name,id,order,label}，无 props 物化，
 *   行自绘自管（catalog 原话：owner passes no props at all）。
 * - sidebar.panellist：id 即面板 id，图标收 {size, active} owner props。
 * - main：keyed by 面板 id，无 props 物化（skill-explorer 同款已验证模式）。
 * - configForms.get(entryId) → {getSnapshot,subscribe,set}；locale.register/bind。
 * - react stub：createElement + 按组件隔离的 useState/useEffect，setState 重渲染。
 * 场景：挂载 → 设置行 → 面板图标/页面 → off 完整还原 → 写路径 → dispose 清理。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import vm from "node:vm";
import assert from "node:assert";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const bundle = readFileSync(join(root, "lib/client.js"), "utf8");

// ---------- stub react（createElement + 按调用序分配的 hooks 槽 + setState 重渲染） ----------
const hookSlots = new Map(); // component -> { idx, cells: [{initialized, value}] }
const renderCounts = new Map(); // component -> 已渲染次数
const effectCleanups = [];
let rendering = null;
const renderTree = (component, props) => {
	rendering = component;
	const slots = hookSlots.get(component) ?? { idx: 0, cells: [] };
	slots.idx = 0;
	hookSlots.set(component, slots);
	try {
		const tree = component(props);
		renderCounts.set(component, (renderCounts.get(component) ?? 0) + 1);
		return tree;
	} finally {
		rendering = null;
	}
};
const rerender = (component) => {
	if (component === rowComponent) rowTree = renderTree(component);
	if (component === pageComponent) pageTree = renderTree(component);
};
let rowComponent = null;
let pageComponent = null;
let rowTree = null;
let pageTree = null;
const reactStub = {
	/** DOM 元素构造节点；函数组件就地求值（hooks 归属该组件）。 */
	createElement(type, props, ...children) {
		if (typeof type === "function") {
			const outer = rendering;
			rendering = type;
			try {
				return type({ ...props, children: children.length <= 1 ? children[0] : children });
			} finally {
				rendering = outer;
			}
		}
		return { type, props: props ?? {}, children: children.flat() };
	},
	/** 槽位按调用序分配（同组件多次 useState 各占一格，重渲染对齐）。 */
	useState(init) {
		const slots = hookSlots.get(rendering) ?? { idx: 0, cells: [] };
		hookSlots.set(rendering, slots);
		const i = slots.idx++;
		let cell = slots.cells[i];
		if (cell === undefined) {
			cell = { initialized: false, value: undefined };
			slots.cells[i] = cell;
		}
		if (!cell.initialized) {
			cell.value = typeof init === "function" ? init() : init;
			cell.initialized = true;
		}
		const component = rendering;
		return [
			cell.value,
			(next) => {
				cell.value = typeof next === "function" ? next(cell.value) : next;
				if (component) rerender(component);
			},
		];
	},
	/** 真实语义按 deps（组件内均为 []）只在首次挂载渲染时执行一次。 */
	useEffect(fn) {
		if ((renderCounts.get(rendering) ?? 0) === 0) effectCleanups.push(fn() ?? null);
	},
};

// require 白名单 = 平台静态表内第三方唯一可依赖项（官方 decoration 模板同款）
const externals = { react: reactStub };

/** MutationObserver stub：记录观察目标，供 dispose 断言。 */
class MutationObserverStub {
	constructor(fn) { this.fn = fn; }
	observe() { MutationObserverStub.instances.push(this); }
	disconnect() { this.disconnected = true; }
}
MutationObserverStub.instances = [];
const MutationObserver = MutationObserverStub;

// ---------- stub DOM ----------
const head = { children: new Set(), appendChild(el) { this.children.add(el); return el; } };
const htmlEl = {
	attrs: new Map(),
	style: {
		map: new Map(),
		setProperty(k, v) { this.map.set(k, v); },
		removeProperty(k) { this.map.delete(k); },
		getPropertyValue(k) { return this.map.get(k) ?? ""; },
	},
	setAttribute(k, v) { this.attrs.set(k, v); },
	removeAttribute(k) { this.attrs.delete(k); },
};
const bodyChildrenStore = new Set();
const bodyEl = {
	attrs: new Map([["data-ds-dark-theme", ""]]),
	hasAttribute(k) { return this.attrs.has(k); },
	appendChild(el) { bodyChildrenStore.add(el); return el; },
	style: {
		map: new Map(),
		setProperty(k, v, prio) { this.map.set(k, v); },
		removeProperty(k) { this.map.delete(k); },
		getPropertyValue(k) { return this.map.get(k) ?? ""; },
	},
};
let styleTag = null;
const documentStub = {
	head,
	documentElement: htmlEl,
	body: bodyEl,
	createElement(tag) {
		const el = {
			tagName: tag.toUpperCase(),
			dataset: {},
			className: "",
			textContent: "",
			title: "",
			removed: false,
			isConnected: true,
			style: {
				map: new Map(),
				setProperty(k, v, prio) { this.map.set(k, v); },
				removeProperty(k) { this.map.delete(k); },
				getPropertyValue(k) { return this.map.get(k) ?? ""; },
			},
			attrs: new Map(),
			getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; },
			setAttribute(k, v) { this.attrs.set(k, String(v)); },
			listeners: new Map(),
			addEventListener(type, fn) { this.listeners.set(type, fn); },
			remove() {
				this.removed = true;
				this.isConnected = false;
				if (this === styleTag) head.children.delete(this);
				bodyChildrenStore.delete(this);
			},
		};
		if (el.tagName === "STYLE") styleTag = el;
		return el;
	},
};

// ---------- run bundle ----------
const loaded = [];
const windowStub = {};
windowStub.innerWidth = 1680;
windowStub.innerHeight = 1050;
const windowStubListeners = new Map();
windowStub.addEventListener = (t, fn) => windowStubListeners.set(t, fn);
windowStub.removeEventListener = (t) => windowStubListeners.delete(t);
const requireStub = (request) => {
	if (!(request in externals)) throw new Error(`unexpected external require: ${request}`);
	return externals[request];
};
requireStub.asset = (ref) => `#asset:${ref}`;

/** Image stub：同步 complete + 自然尺寸，立即触发 onload → layoutCanvas。 */
class ImageStub {
	set src(v) { this._src = v; this.naturalWidth = 2560; this.naturalHeight = 1440; this.complete = true; if (this.onload) this.onload(); }
	get src() { return this._src; }
}
const context = { window: windowStub, console, Symbol, JSON, Object, Number, Math, Array, document: documentStub, fetch: fetchStub, Image: ImageStub, MutationObserver: MutationObserverStub };
/** 同源 fetch stub：list 路由返回鲸鱼娘（源文字色不可直接进暗壳的回归样例）。 */
const fetchCalls = [];
function fetchStub(path, init) {
	fetchCalls.push({ path, init });
	return Promise.resolve({
		ok: true,
		json: async () => ({
			themes: [
				{
					id: "codex-deepseek",
					name: "DeepSeek-鲸鱼娘",
					image: "background.jpg",
					rev: "807018-1700000000000",
					colors: { background: "#cdd7e1", text: "#352970", muted: "#030303", accent: "#bf7a40" },
				},
			],
		}),
	});
}
windowStub.__ModuleLoader__ = { load(row) { loaded.push(row); } };
vm.createContext(context);
vm.runInContext(bundle, context, { filename: "lib/client.js" });
assert.equal(loaded.length, 1, "bundle registers exactly one row");
assert.equal(loaded[0].id, "dsh-dream-skin");

const exports = loaded[0].factory(requireStub);
assert.equal(typeof exports.apply, "function");
assert.deepEqual(exports.inject, ["theme", "configForms", "locale", "slots"]);

// ---------- stub cordis ctx ----------
const effects = [];
let overrideLayer = null;
const formListeners = new Set();
const formWrites = [];
let settingsValue;
/** slot name -> {options, Component}（物化 = 渲染）。 */
const registrations = new Map();
const localeRegistry = new Map();
let currentLocale = "zh";

const ctx = {
	effect(fn) {
		const entry = { fn, cleanup: null };
		effects.push(entry);
		entry.cleanup = fn() ?? null;
		return () => disposeEntry(entry);
	},
	theme: {
		overrideTokens(source, tokens) {
			overrideLayer = { source, tokens, disposed: false };
			return () => {
				overrideLayer.disposed = true;
				overrideLayer = null;
			};
		},
	},
	configForms: {
		get(ns) {
			assert.equal(ns, "dsh-dream-skin");
			return {
				getSnapshot: () => ({ value: settingsValue }),
				subscribe(fn) {
					formListeners.add(fn);
					return () => formListeners.delete(fn);
				},
				set(field, value) {
					formWrites.push({ field, value });
				},
			};
		},
	},
	locale: {
		register(ns, dicts) {
			localeRegistry.set(ns, dicts);
			return () => localeRegistry.delete(ns);
		},
		bind(ns) {
			return (key) => localeRegistry.get(ns)?.[currentLocale]?.[key] ?? key;
		},
	},
	slots: {
		inject(slotName, register) {
			registrations.set(slotName, register());
		},
		/** 宿主物化 = 渲染组件（settings 行/面板页无 props；图标收 {size,active}）。 */
		register(options, Component) {
			assert.equal(typeof Component, "function", "component must be a function");
			for (const key of Object.keys(options)) {
				assert.ok(
					["name", "id", "order", "label", "key"].includes(key),
					`registration option '${key}' is not in the documented contract`,
				);
			}
			return { options, Component };
		},
	},
};
function disposeEntry(entry) {
	entry.cleanup?.();
	const i = effects.indexOf(entry);
	if (i >= 0) effects.splice(i, 1);
}

/** 从渲染树里找第一个匹配节点。 */
function findNode(node, pred) {
	if (!node || typeof node !== "object") return null;
	if (pred(node)) return node;
	for (const child of node.children ?? []) {
		const hit = findNode(child, pred);
		if (hit) return hit;
	}
	return null;
}
const byClass = (cls) => (n) => n.props.className === cls;
const byTag = (tag) => (n) => n.type === tag;
const allNodes = function* (node) {
	if (!node || typeof node !== "object") return;
	yield node;
	for (const child of node.children ?? []) yield* allNodes(child);
};

const canvasEl = () => [...bodyChildrenStore].find((el) => el.className === "dsb_canvas");
const scrimEl = () => [...bodyChildrenStore].find((el) => el.className === "dsb_scrim");

// ---------- 场景 1：settings 未就绪（mirror value undefined）→ off，不抛 ----------
exports.apply(ctx);
const styleTags = () => (styleTag && !styleTag.removed && styleTag.tagName === "STYLE" ? [styleTag] : []);
assert.equal(styleTags().length, 1, "skeleton style installed");
assert.equal(styleTags()[0].dataset.pluginCss, "dsh-dream-skin/skeleton");
assert.ok(styleTags()[0].textContent.includes('html[data-dsb-on][data-dsb-theme="gothic-void-crusade"]'), "layer scoping rule baked into skeleton");
assert.ok(styleTags()[0].textContent.includes("rgb(var(--dsb-d-rgb) / var(--dsb-a-base"), "layer colors parameterized by theme base color + alpha var");
assert.equal(htmlEl.attrs.has("data-dsb-on"), false, "off before settings arrive");
assert.equal(overrideLayer, null);
assert.ok(localeRegistry.has("dsh-dream-skin"), "locale dictionaries registered");
assert.equal(typeof windowStub.__dsb__, "object", "debug handle exposed");

// ---------- 场景 2：三处注册齐全（行 + 侧栏图标 + 主栏页面） ----------
assert.ok(registrations.has("settings.general.item"), "settings row registered");
assert.ok(registrations.has("sidebar.panellist"), "sidebar icon registered");
assert.ok(registrations.has("main"), "main page registered");
const row = registrations.get("settings.general.item");
const icon = registrations.get("sidebar.panellist");
const page = registrations.get("main");
assert.equal(row.options.id, "dream-skin");
assert.equal(typeof row.options.label, "function", "row label thunk");
assert.equal(row.options.label(), "皮肤");
assert.equal(icon.options.id, "dsh-dream-skin", "panel id = package id");
assert.equal(typeof icon.options.label, "function");
assert.equal(page.options.key, "dsh-dream-skin", "main keyed by panel id");

// ---------- 场景 3：设置行无 props 物化渲染 ----------
rowComponent = row.Component;
rowTree = renderTree(rowComponent);
assert.ok(findNode(rowTree, byClass("dsb_settingsRowTitle")).children.includes("皮肤"), "row renders its own title");
const select1 = findNode(rowTree, byTag("select"));
assert.equal(select1.props.value, "off");
assert.deepEqual(select1.children.map((o) => o.children[0]), ["官方默认", "Gothic Void Crusade"]);

// ---------- 场景 4：图标收 {size, active}；页面无 props 渲染主题卡 ----------
const iconTree = renderTree(icon.Component, { size: 20, active: false });
assert.equal(iconTree.type, "svg");
assert.equal(iconTree.props.width, 20);
pageComponent = page.Component;
pageTree = renderTree(pageComponent);
const grids = [...allNodes(pageTree)].filter((n) => n.props.className === "dsb_panelGrid" && Array.isArray(n.children));
assert.equal(grids.length, 1, "built-in grid only while no imports loaded");
const cardsOff = grids[0].children.filter((n) => n.type === "button");
assert.equal(cardsOff.length, 2, "off card + 1 theme card");
const activeClasses = cardsOff.map((c) => String(c.props.className).includes("dsb_cardActive"));
assert.deepEqual(activeClasses, [true, false], "off card is active initially");
const themeCard = cardsOff[1];
assert.ok(themeCard.children[0].props.style.backgroundImage.includes("#asset:"), "theme card thumbnail uses asset URL");
assert.ok([...allNodes(pageTree)].some((n) => n.type === "input" && n.props.type === "file" && "webkitdirectory" in n.props), "folder import input rendered");

// ---------- 场景 5：表单推送主题 → 画布生效 + 行/页面自订阅重渲染 ----------
settingsValue = { theme: "gothic-void-crusade" };
for (const fn of formListeners) fn();
await new Promise((resolve) => setImmediate(resolve)); // v16: applyTheme 走预解码微任务提交
assert.ok(fetchCalls.some((c) => c.path === "api/dsh-dream-skin/list"), "panel fetched the imported list");
assert.equal(htmlEl.attrs.get("data-dsb-on"), "", "canvas gate on");
assert.equal(htmlEl.attrs.get("data-dsb-theme"), "gothic-void-crusade", "theme gate for scoped layer rules");
const canvas = canvasEl();
assert.ok(canvas, "canvas img element appended to body");
assert.equal(canvas.attrs.get("src"), "#asset:plugins/dsh-dream-skin/assets/background-e84cc454728d.jpg", "canvas img carries builtin art URL (require.asset pipeline)");
assert.ok(scrimEl(), "scrim overlay element appended");
assert.ok(overrideLayer, "override layer registered");
assert.equal(overrideLayer.source, "dsh-dream-skin");
assert.equal(overrideLayer.tokens["--dsw-alias-label-primary"].dark, "#f3ead7");
assert.equal(overrideLayer.tokens["--dsw-alias-label-primary"].light, "var(--dsw-static-neutral-bluish-1000)");
assert.equal(overrideLayer.tokens["--dsw-alias-bg-layer-1"], undefined, "material tokens NOT in global override (scoped to #root instead)");
assert.equal(overrideLayer.tokens["--dsw-alias-bg-base"], undefined);
assert.equal(htmlEl.style.map.get("--dsb-a-base"), "0.344", "alpha ladder scaled by default visibility 75 (0.62×25/45)");
assert.equal(htmlEl.style.map.get("--dsb-a-3"), "0.456", "higher layers keep more opacity (0.82×25/45)");
assert.equal(htmlEl.style.map.get("--dsb-scrim-k"), "0.350", "scrim strength has 0.35 readability floor at v=75");
assert.ok(styleTags()[0].textContent.includes("calc(0.90 * var(--dsb-scrim-k"), "scrim endpoints consume the strength factor");
assert.ok(
	styleTags()[0].textContent.includes("html[data-dsb-on]:has(body[data-ds-dark-theme]) #root {"),
	"generic fallback layer rule covers imported theme ids (dark shell)",
);
assert.ok(
	styleTags()[0].textContent.includes("html[data-dsb-on]:not(:has(body[data-ds-dark-theme])) #root {"),
	"light-shell fallback layer rule exists (v13: system-following shells)",
);
assert.ok(
	styleTags()[0].textContent.includes("rgb(var(--dsb-l-rgb) / var(--dsb-a-base"),
	"light materials use the light scrim base",
);
assert.ok(styleTags()[0].textContent.includes("var(--dsb-a-base"), "generated rule consumes alpha vars");
assert.equal(findNode(rowTree, byTag("select")).props.value, "gothic-void-crusade", "row re-rendered");
assert.ok(
	String(findNode(pageTree, byClass("dsb_panelGrid")).children[1].props.className).includes("dsb_cardActive"),
	"page re-rendered: theme card active",
);
// 幂等：同值不重复注册覆盖层
for (const fn of formListeners) fn();
assert.ok(overrideLayer && !overrideLayer.disposed);

// ---------- 场景 6：行 select / 页面卡片 → 走 configForms 写路径，未知 id 不写 ----------
findNode(rowTree, byTag("select")).props.onChange({ target: { value: "off" } });
findNode(rowTree, byTag("select")).props.onChange({ target: { value: "nope" } });
assert.deepEqual(formWrites, [{ field: "theme", value: "off" }], "row select writes valid ids only");
formWrites.length = 0;
[...allNodes(pageTree)].filter((n) => n.type === "button" && String(n.props.className).includes("dsb_card"))[1].props.onClick();
assert.deepEqual(formWrites, [{ field: "theme", value: "gothic-void-crusade" }], "theme card click writes");
formWrites.length = 0;
windowStub.__dsb__.setTheme("off");
windowStub.__dsb__.setTheme("nope");
assert.deepEqual(formWrites, [{ field: "theme", value: "off" }], "debug handle writes valid ids only");
formWrites.length = 0;

// ---------- 场景 6b：透出度滑杆 → 即时预览 + 持久化写 ----------
settingsValue = { theme: "gothic-void-crusade", visibility: 75 };
for (const fn of formListeners) fn();
const slider = findNode(pageTree, (n) => n.type === "input" && n.props.type === "range");
assert.ok(slider, "visibility slider rendered while a theme is active");
slider.props.onChange({ target: { value: "90" } });
assert.deepEqual(formWrites, [{ field: "visibility", value: 90 }], "slider persists through configForms");
assert.equal(htmlEl.style.map.get("--dsb-a-base"), "0.138", "slider tunes alphas with 0.06 floor (0.62x10/45)");
assert.equal(htmlEl.style.map.get("--dsb-scrim-k"), "0.350", "slider scales scrim with 0.35 readability floor");
formWrites.length = 0;

// ---------- 场景 6c：面板只保留透出度滑杆（v10 移除位置滑杆） ----------
const sliders = [...allNodes(pageTree)].filter((n) => n.type === "input" && n.props.type === "range");
assert.equal(sliders.length, 1, "visibility slider only");

// ---------- 场景 7：切回 off → 完整还原 ----------
settingsValue = { theme: "off" };
for (const fn of formListeners) fn();
assert.equal(htmlEl.attrs.has("data-dsb-on"), false, "gate removed");
assert.equal(htmlEl.attrs.has("data-dsb-theme"), false, "theme gate removed");
assert.equal(htmlEl.style.map.size, 0, "canvas vars cleared");
assert.equal(overrideLayer, null, "override layer removed");
assert.equal(findNode(rowTree, byTag("select")).props.value, "off", "row back to off");

// ---------- 场景 9a：启动竞态（v13 回归）——导入主题在列表返回前不应用，返回后补 sync 生效 ----------
// 真机事故：重启后持久化的 codex-deepseek 在 boot 时列表未回，sync 静默按 off
// 跳过且列表到位后无人再触发 → 导入主题重启后永远不生效。
settingsValue = { theme: "codex-deepseek", visibility: 100, bgPosX: 39 };
for (const fn of formListeners) fn(); // 列表未回时表单已推送（模拟真实时序）
assert.equal(htmlEl.attrs.has("data-dsb-on"), false, "race window: imported theme NOT applied before list arrives");

// ---------- 场景 9：导入主题双壳适配（鲸鱼娘回归：源色不直通暗壳/浅壳） ----------
await new Promise((resolve) => setImmediate(resolve)); // flush refreshImported 链
assert.equal(htmlEl.attrs.has("data-dsb-on"), true, "list arrival re-syncs: persisted imported theme now applied");
rerender(pageComponent); // setImportedList 触发的重渲染
const grids2 = [...allNodes(pageTree)].filter((n) => n.props.className === "dsb_panelGrid" && Array.isArray(n.children));
assert.equal(grids2.length, 2, "builtin grid + imported grid");
const importedCards = grids2[1].children.filter((n) => n.type === "button");
assert.equal(importedCards.length, 1, "whale card rendered");
assert.equal(importedCards[0].children[1].children[0], "DeepSeek-鲸鱼娘", "imported card label");
importedCards[0].props.onClick();
assert.deepEqual(formWrites, [{ field: "theme", value: "codex-deepseek" }], "imported card picks via configForms");
formWrites.length = 0;
settingsValue = { theme: "codex-deepseek" };
for (const fn of formListeners) fn();
await new Promise((resolve) => setImmediate(resolve)); // 预解码提交
assert.equal(overrideLayer.source, "dsh-dream-skin");
const sidebarFill = overrideLayer.tokens["--dsw-specific-sidebar-fill"];
assert.equal(sidebarFill.dark, "rgb(var(--dsb-d-rgb) / 0.4)", "sidebar veil token overridden (two official layers stack; tuned for combined ~0.6)");
assert.equal(sidebarFill.light, "rgb(var(--dsb-l-rgb) / 0.45)");
const labels = overrideLayer.tokens["--dsw-alias-label-primary"];
assert.notEqual(labels.dark, "#352970", "dark label NOT the raw navy source");
assert.ok(labels.dark.startsWith("hsl(") && /90\.0%/.test(labels.dark), "dark label derived at fixed readable lightness (upstream rule)");
assert.equal(labels.light, "#352970", "light shell passes the dark source text through (upstream rule: lum 0.035 <= 0.62 → readable on light scrim)");
assert.ok(!overrideLayer.tokens["--dsw-alias-label-secondary"].dark.startsWith("#030303"), "near-black muted never passes through");
assert.equal(htmlEl.style.map.get("--dsb-scrim-k"), "0.350", "scrim floor stays 0.35; sidebar readability is the sidebar token job (v15)");
const dRgb = htmlEl.style.map.get("--dsb-d-rgb").split(" ").map(Number);
const lRgb = htmlEl.style.map.get("--dsb-l-rgb").split(" ").map(Number);
assert.ok(dRgb.every((v) => v < 30), "dark-shell scrim base is near-black of theme hue (no white wash)");
assert.ok(lRgb.every((v) => v > 200), "light-shell scrim base is near-white of theme hue");
assert.equal(canvasEl().attrs.get("src"), "api/dsh-dream-skin/asset?id=codex-deepseek&file=background.jpg&v=807018-1700000000000", "imported asset URL content-versioned for immutable caching");
const objPos = canvasEl().style.map.get("object-position");
assert.equal(objPos, "50% 50%", "v21: cover + theme focus (Codex default center)");

// ---------- 场景 8：dispose（HMR/停用）→ 样式表与全局状态全清 ----------
settingsValue = { theme: "gothic-void-crusade" };
for (const fn of formListeners) fn();
assert.ok(overrideLayer && !overrideLayer.disposed);
while (effects.length > 0) disposeEntry(effects[effects.length - 1]);
assert.equal(styleTags().length, 0, "style tag removed on dispose");
assert.equal(windowStub.__dsb__, undefined, "debug handle removed on dispose");
assert.equal(htmlEl.attrs.has("data-dsb-on"), false);
assert.equal(htmlEl.style.map.size, 0);

console.log("smoke-test: 8 scenarios passed ✓");

