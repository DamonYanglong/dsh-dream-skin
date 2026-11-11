#!/usr/bin/env node
/**
 * dsh-dream-skin · client bundle 冒烟测试（零依赖）
 *
 * stub 层实现「真实契约」而非宽松近似（2026-11-11 web boot 翻车教训）：
 * - defineStore(spec) 返回 {spec, create(scopeKey)} 工厂（真实 dsh-client-store 契约），
 *   create 返回 {actions, getSnapshot, subscribe}；插件侧不能直接调工厂方法。
 * - slots 宿主物化 options.store 工厂、把 actions 包传给 inject(actions) 回调
 *   （ui-theme bound 模式），并把 spec.actions 校验为函数。
 * 场景：挂载生效 → 设置行注册/物化 → off 完整还原 → 写路径 → dispose 清理。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import vm from "node:vm";
import assert from "node:assert";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const bundle = readFileSync(join(root, "lib/client.js"), "utf8");

// ---------- stub react（真实契约：createElement 即可） ----------
const reactStub = {
	createElement(type, props, ...children) {
		return { type, props: props ?? {}, children };
	},
};

// ---------- stub dsh-client-store（真实 defineStore 契约：{spec, create} 工厂） ----------
function defineStoreStub(spec) {
	assert.equal(typeof spec.init, "function", "spec.init must be a function");
	for (const [name, action] of Object.entries(spec.actions ?? {})) {
		assert.equal(typeof action, "function", `spec.actions.${name} must be a function`);
	}
	return {
		spec,
		create() {
			const listeners = new Set();
			let data = spec.init();
			const handle = {
				getSnapshot: () => data,
				subscribe(fn) {
					listeners.add(fn);
					return () => listeners.delete(fn);
				},
			};
			for (const [name, action] of Object.entries(spec.actions ?? {})) {
				handle[name] = (...args) => {
					const draft = { ...data };
					action(draft, ...args);
					data = draft;
					for (const fn of listeners) fn();
				};
			}
			return handle;
		},
	};
}
const externals = {
	react: reactStub,
	"@deepseek-ai/dsh-client-store": { defineStore: defineStoreStub },
};

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
		getPropertyValue(k) { this.map.get(k) ?? ""; },
	},
};
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
			addEventListener(type, fn) {
				this.listeners.set(type, fn);
			},
			remove() {
				this.removed = true;
				if (this === styleTag) head.children.delete(this);
			},
		};
		if (el.tagName === "STYLE") styleTag = el;
		return el;
	},
};
let styleTag = null;

const bodyChildren = () => bodyChildrenStore;
const bodyChildrenStore = new Set();
bodyEl.appendChild = (el) => {
	bodyChildrenStore.add(el);
	return el;
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
const settingsListeners = new Set();
const settingsWrites = [];
let settingsValue;
let registration = null;
const localeRegistry = new Map();

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
					settingsListeners.add(fn);
					return () => settingsListeners.delete(fn);
				},
				set(field, value) {
					settingsWrites.push({ field, value });
				},
			};
		},
	},
	locale: {
		register(ns, dict) {
			localeRegistry.set(ns, dict);
			return () => localeRegistry.delete(ns);
		},
	},
	slots: {
		inject(slotName, register) {
			assert.equal(slotName, "settings.general.item");
			registration = register();
		},
		/** 宿主侧物化：store 工厂 create() → actions 传给 inject 回调（ui-theme bound 模式）。 */
		register(options, Component) {
			assert.equal(typeof Component, "function", "row component must be a function");
			const storeHandle = options.store.create("root");
			const actions = { sync: storeHandle.sync };
			const row = { options, Component, storeHandle, actions };
			row.bound = options.inject(actions);
			return row;
		},
	},
};
function disposeEntry(entry) {
	entry.cleanup?.();
	const i = effects.indexOf(entry);
	if (i >= 0) effects.splice(i, 1);
}

// ---------- 场景 1：settings 未就绪（mirror value undefined）→ off，不抛 ----------
exports.apply(ctx);
const styleTags = () => (styleTag && !styleTag.removed && styleTag.tagName === "STYLE" ? [styleTag] : []);
assert.equal(styleTags().length, 1, "skeleton style installed");
assert.equal(styleTags()[0].dataset.pluginCss, "dsh-dream-skin/skeleton");
assert.equal(htmlEl.attrs.has("data-dsb-on"), false, "off before settings arrive");
assert.equal(overrideLayer, null);
// 浮动按钮已挂载，显示 off 态文案
const pill = [...bodyChildren()].find((el) => el.className === "dsb_pill");
assert.ok(pill, "theme pill mounted");
assert.ok(pill.textContent.includes("官方"), "pill shows off state");
assert.equal(typeof windowStub.__dsb__, "object", "debug handle exposed");

// ---------- 场景 2：设置行注册 + 宿主物化（inject 回调拿到真实 actions 包） ----------
assert.ok(registration, "settings row registered");
assert.equal(registration.options.id, "dream-skin");
assert.equal(typeof registration.actions.sync, "function", "host materialized store actions");
assert.deepEqual(Object.keys(registration.bound), ["setTheme"], "row actions surface");
assert.ok(localeRegistry.has("dsh-dream-skin"), "locale dictionaries registered");
// 物化时 inject 回调触发 sync → store 已收到当前值（off）
assert.equal(registration.storeHandle.getSnapshot().theme, "off");

// ---------- 场景 3：选择主题 → 生效 + 行 store 同步 ----------
settingsValue = { theme: "gothic-void-crusade" };
for (const fn of settingsListeners) fn();
assert.equal(htmlEl.attrs.get("data-dsb-on"), "", "canvas gate on");
assert.equal(bodyEl.style.map.get("--dsb-bg"), 'url("#asset:plugins/dsh-dream-skin/assets/background-e84cc454728d.jpg")');
assert.equal(bodyEl.style.map.get("--dsb-bg-pos"), "76% 45%");
assert.ok(overrideLayer, "override layer registered");
assert.equal(overrideLayer.source, "dsh-dream-skin");
assert.equal(overrideLayer.tokens["--dsw-alias-label-primary"].dark, "#f3ead7");
assert.equal(overrideLayer.tokens["--dsw-alias-label-primary"].light, "var(--dsw-static-neutral-bluish-1000)");
assert.equal(registration.storeHandle.getSnapshot().theme, "gothic-void-crusade", "row store synced");
assert.ok(pill.textContent.includes("Gothic"), "pill shows theme state");
// 幂等：同值不重复注册
for (const fn of settingsListeners) fn();
assert.ok(overrideLayer && !overrideLayer.disposed);

// ---------- 场景 4：设置行 setTheme / 浮动按钮点击 → 写 configForms，未知 id 拒绝 ----------
registration.bound.setTheme("off");
registration.bound.setTheme("nope");
assert.deepEqual(settingsWrites, [{ field: "theme", value: "off" }], "only valid ids reach the settings write");
settingsWrites.length = 0;
pill.listeners.get("click")();
assert.deepEqual(settingsWrites, [{ field: "theme", value: "off" }], "pill click cycles the active theme back to off");

// ---------- 场景 5：切回 off → 完整还原 ----------
settingsValue = { theme: "off" };
for (const fn of settingsListeners) fn();
assert.equal(htmlEl.attrs.has("data-dsb-on"), false, "gate removed");
assert.equal(bodyEl.style.map.size, 0, "canvas vars cleared");
assert.equal(overrideLayer, null, "override layer removed");
assert.equal(registration.storeHandle.getSnapshot().theme, "off");

// ---------- 场景 6：dispose（HMR/停用）→ 样式表/按钮与状态全清 ----------
settingsValue = { theme: "gothic-void-crusade" };
for (const fn of settingsListeners) fn();
assert.ok(overrideLayer && !overrideLayer.disposed);
while (effects.length > 0) disposeEntry(effects[effects.length - 1]);
assert.equal(styleTags().length, 0, "style tag removed on dispose");
assert.equal(pill.removed, true, "pill removed on dispose");
assert.equal(windowStub.__dsb__, undefined, "debug handle removed on dispose");
assert.equal(htmlEl.attrs.has("data-dsb-on"), false);
assert.equal(bodyEl.style.map.size, 0);

console.log("smoke-test: 6 scenarios passed ✓");
