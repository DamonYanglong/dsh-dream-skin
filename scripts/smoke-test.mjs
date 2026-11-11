#!/usr/bin/env node
/**
 * dsh-dream-skin · client bundle 冒烟测试（零依赖，v4 契约）
 *
 * stub 层实现「权威文档契约」（v2 逆向 store 契约的路线已废弃：
 * 第一方 defineStore/inject(actions) 组装是平台内部通道，不对第三方开放）：
 * - require 白名单仅 react：出现任何其他 external require 直接失败
 *   （practices.md：禁止把 Harness Client 包当模块加载）。
 * - slots.register 只收 {name,id,order,label}（Slots 在线目录），
 *   物化 = 无 props 渲染组件（ui-settings-general：「registrant owns its row copy
 *   and behavior」——宿主不传 store/actions/t）。
 * - configForms.get(entryId) 返回 {getSnapshot,subscribe,set}（ui-settings README）。
 * - locale.register(ns,dicts) + bind(ns) → t（Client Service 目录）。
 * - react stub 实现 createElement/useState/useEffect，setState 触发重渲染，
 *   验证行组件自身跟随表单镜像。
 * 场景：挂载生效 → 设置行注册/无 props 渲染 → off 完整还原 → 写路径 → dispose 清理。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import vm from "node:vm";
import assert from "node:assert";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const bundle = readFileSync(join(root, "lib/client.js"), "utf8");

// ---------- stub react（createElement + 可重渲染的 useState + useEffect） ----------
let currentTree = null;
const rowState = { initialized: false, value: undefined };
const effectCleanups = [];
let renderCount = 0;
const rerenderRow = () => {
	assert.ok(rerenderRow.component, "setState outside a rendered component");
	currentTree = rerenderRow.component();
	renderCount++;
};
const reactStub = {
	createElement(type, props, ...children) {
		return { type, props: props ?? {}, children: children.flat() };
	},
	useState(init) {
		if (!rowState.initialized) {
			rowState.value = typeof init === "function" ? init() : init;
			rowState.initialized = true;
		}
		return [
			rowState.value,
			(next) => {
				rowState.value = typeof next === "function" ? next(rowState.value) : next;
				rerenderRow();
			},
		];
	},
	/** 真实语义按 deps（组件内均为 []）只在首次挂载渲染时执行一次。 */
	useEffect(fn) {
		if (renderCount === 0) effectCleanups.push(fn() ?? null);
	},
};

// require 白名单 = 平台静态表内第三方唯一可依赖项（官方 decoration 模板同款）
const externals = { react: reactStub };

// ---------- stub DOM ----------
const head = { children: new Set(), appendChild(el) { this.children.add(el); return el; } };
const htmlEl = {
	attrs: new Map(),
	setAttribute(k, v) { this.attrs.set(k, v); },
	removeAttribute(k) { this.attrs.delete(k); },
};
const bodyEl = {
	style: {
		map: new Map(),
		setProperty(k, v) { this.map.set(k, v); },
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
			listeners: new Map(),
			addEventListener(type, fn) { this.listeners.set(type, fn); },
			remove() {
				this.removed = true;
				if (this === styleTag) head.children.delete(this);
			},
		};
		if (el.tagName === "STYLE") styleTag = el;
		return el;
	},
};

// ---------- run bundle ----------
const loaded = [];
const windowStub = {};
const requireStub = (request) => {
	if (!(request in externals)) throw new Error(`unexpected external require: ${request}`);
	return externals[request];
};
requireStub.asset = (ref) => `#asset:${ref}`;

const context = { window: windowStub, console, Symbol, JSON, Object, document: documentStub };
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
let registration = null;
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
			assert.equal(slotName, "settings.general.item");
			registration = register();
		},
		/** 宿主物化 = 无 props 渲染（registrant 自绘行；不传 store/actions/t）。 */
		register(options, Component) {
			assert.equal(typeof Component, "function", "row component must be a function");
			for (const key of Object.keys(options)) {
				assert.ok(
					["name", "id", "order", "label"].includes(key),
					`registration option '${key}' is not in the documented contract (id/order/label)`,
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
const byClass = (cls) => (n) => n.type === "div" && n.props.className === cls;
const selectNode = (n) => n.type === "select";

// ---------- 场景 1：settings 未就绪（mirror value undefined）→ off，不抛 ----------
exports.apply(ctx);
const styleTags = () => (styleTag && !styleTag.removed && styleTag.tagName === "STYLE" ? [styleTag] : []);
assert.equal(styleTags().length, 1, "skeleton style installed");
assert.equal(styleTags()[0].dataset.pluginCss, "dsh-dream-skin/skeleton");
assert.equal(htmlEl.attrs.has("data-dsb-on"), false, "off before settings arrive");
assert.equal(overrideLayer, null);
assert.ok(localeRegistry.has("dsh-dream-skin"), "locale dictionaries registered");
assert.equal(typeof windowStub.__dsb__, "object", "debug handle exposed");

// ---------- 场景 2：设置行注册（仅 id/order/label）+ 无 props 渲染 ----------
assert.ok(registration, "settings row registered");
assert.equal(registration.options.id, "dream-skin");
assert.equal(registration.options.name, "settings.general.item");
assert.equal(typeof registration.options.label, "function", "label is a locale-following thunk");
assert.equal(registration.options.label(), "皮肤", "label thunk resolves via locale");
rerenderRow.component = registration.Component;
rerenderRow(); // 宿主物化：无 props（renderCount 0 → 1，effect 仅此一次）
assert.ok(findNode(currentTree, byClass("dsb_settingsRowTitle")), "row renders its own title");
assert.ok(findNode(currentTree, byClass("dsb_settingsRowTitle")).children.includes("皮肤"), "title copy from locale");
const select1 = findNode(currentTree, selectNode);
assert.ok(select1, "row renders its own select control");
assert.equal(select1.props.value, "off", "select follows form mirror (off)");
const optionLabels = select1.children.map((o) => o.children[0]);
assert.deepEqual(optionLabels, ["官方默认", "Gothic Void Crusade"], "options: off + built themes");

// ---------- 场景 3：表单推送到主题 → 画布生效 + 行自订阅重渲染 ----------
settingsValue = { theme: "gothic-void-crusade" };
for (const fn of formListeners) fn();
assert.equal(htmlEl.attrs.get("data-dsb-on"), "", "canvas gate on");
assert.equal(bodyEl.style.map.get("--dsb-bg"), 'url("#asset:plugins/dsh-dream-skin/assets/background-e84cc454728d.jpg")');
assert.equal(bodyEl.style.map.get("--dsb-bg-pos"), "76% 45%");
assert.ok(overrideLayer, "override layer registered");
assert.equal(overrideLayer.source, "dsh-dream-skin");
assert.equal(overrideLayer.tokens["--dsw-alias-label-primary"].dark, "#f3ead7");
assert.equal(overrideLayer.tokens["--dsw-alias-label-primary"].light, "var(--dsw-static-neutral-bluish-1000)");
assert.equal(findNode(currentTree, selectNode).props.value, "gothic-void-crusade", "row re-rendered via its own subscription");
// 幂等：同值不重复注册覆盖层
for (const fn of formListeners) fn();
assert.ok(overrideLayer && !overrideLayer.disposed);

// ---------- 场景 4：行内 select 提交 → 走 configForms 写路径，未知 id 不写 ----------
const select2 = findNode(currentTree, selectNode);
select2.props.onChange({ target: { value: "off" } });
select2.props.onChange({ target: { value: "nope" } });
assert.deepEqual(formWrites, [{ field: "theme", value: "off" }], "only valid ids reach the settings write");
formWrites.length = 0;
windowStub.__dsb__.setTheme("gothic-void-crusade");
windowStub.__dsb__.setTheme("nope");
assert.deepEqual(formWrites, [{ field: "theme", value: "gothic-void-crusade" }], "debug handle writes valid ids only");

// ---------- 场景 5：切回 off → 完整还原 ----------
settingsValue = { theme: "off" };
for (const fn of formListeners) fn();
assert.equal(htmlEl.attrs.has("data-dsb-on"), false, "gate removed");
assert.equal(bodyEl.style.map.size, 0, "canvas vars cleared");
assert.equal(overrideLayer, null, "override layer removed");
assert.equal(findNode(currentTree, selectNode).props.value, "off", "row back to off");

// ---------- 场景 6：dispose（HMR/停用）→ 样式表与全局状态全清 ----------
settingsValue = { theme: "gothic-void-crusade" };
for (const fn of formListeners) fn();
assert.ok(overrideLayer && !overrideLayer.disposed);
while (effects.length > 0) disposeEntry(effects[effects.length - 1]);
assert.equal(styleTags().length, 0, "style tag removed on dispose");
assert.equal(windowStub.__dsb__, undefined, "debug handle removed on dispose");
assert.equal(htmlEl.attrs.has("data-dsb-on"), false);
assert.equal(bodyEl.style.map.size, 0);

console.log("smoke-test: 6 scenarios passed ✓");
