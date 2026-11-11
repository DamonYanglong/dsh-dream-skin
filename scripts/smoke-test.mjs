#!/usr/bin/env node
/**
 * dsh-dream-skin · client bundle 冒烟测试（零依赖）
 *
 * 用 stub 的 ModuleLoader / cordis ctx / DOM / react / store 加载 lib/client.js，
 * 验证核心状态机：挂载生效 → off 完整还原 → 未知 id 安全退化 → dispose 清理
 * → 设置行注册与写入路径。
 * 真机视觉验证见 README M1/M2 验收项。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import vm from "node:vm";
import assert from "node:assert";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const bundle = readFileSync(join(root, "lib/client.js"), "utf8");

// ---------- stub react / dsh-client-store ----------
const reactStub = {
  createElement(type, props, ...children) {
    return { type, props: props ?? {}, children };
  },
};
function defineStoreStub({ init, actions }) {
  const listeners = new Set();
  const store = {
    data: init(),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSnapshot() {
      return store.data;
    },
  };
  for (const [name, action] of Object.entries(actions)) {
    store[name] = (...args) => {
      action(store.data, ...args);
      for (const fn of listeners) fn();
    };
  }
  return store;
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
    getPropertyValue(k) { return this.map.get(k) ?? ""; },
  },
};
const documentStub = {
  head,
  documentElement: htmlEl,
  body: bodyEl,
  createElement() {
    return {
      tagName: "STYLE",
      dataset: {},
      textContent: "",
      removed: false,
      remove() {
        this.removed = true;
        head.children.delete(this);
      },
    };
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
const settingsListeners = new Set();
const settingsWrites = [];
let settingsValue;
let registeredRow = null;
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
    bind(ns) {
      const dict = localeRegistry.get(ns) ?? {};
      return (key) => dict.zh?.[key] ?? key;
    },
  },
  slots: {
    inject(slotName, register) {
      registeredRow = register();
    },
    register(options, Component) {
      return { options, Component };
    },
  },
};
function disposeEntry(entry) {
  entry.cleanup?.();
  const i = effects.indexOf(entry);
  if (i >= 0) effects.splice(i, 1);
}

// ---------- 场景 1：settings 未就绪（mirror value undefined）→ off ----------
exports.apply(ctx);
const styleTags = () => [...head.children].filter((el) => el.tagName === "STYLE");
assert.equal(styleTags().length, 1, "skeleton style installed");
assert.equal(styleTags()[0].dataset.pluginCss, "dsh-dream-skin/skeleton");
assert.equal(htmlEl.attrs.has("data-dsb-on"), false, "off before settings arrive");
assert.equal(overrideLayer, null);

// ---------- 场景 2：设置行注册 + 文案 ----------
assert.ok(registeredRow, "settings row registered");
assert.equal(registeredRow.options.id, "dream-skin");
assert.equal(registeredRow.options.locale, "dsh-dream-skin");
assert.equal(typeof registeredRow.Component, "function");
assert.ok(localeRegistry.has("dsh-dream-skin"), "locale dictionaries registered");

// ---------- 场景 3：选择主题 → 生效 ----------
settingsValue = { theme: "gothic-void-crusade" };
for (const fn of settingsListeners) fn();
assert.equal(htmlEl.attrs.get("data-dsb-on"), "", "canvas gate on");
assert.equal(bodyEl.style.map.get("--dsb-bg"), 'url("#asset:plugins/dsh-dream-skin/assets/background-e84cc454728d.jpg")');
assert.equal(bodyEl.style.map.get("--dsb-bg-pos"), "76% 45%");
assert.ok(overrideLayer, "override layer registered");
assert.equal(overrideLayer.source, "dsh-dream-skin");
assert.equal(overrideLayer.tokens["--dsw-alias-label-primary"].dark, "#f3ead7");
assert.equal(overrideLayer.tokens["--dsw-alias-label-primary"].light, "var(--dsw-static-neutral-bluish-1000)");
// 幂等：同值不重复注册
for (const fn of settingsListeners) fn();
assert.ok(overrideLayer && !overrideLayer.disposed);

// ---------- 场景 4：设置行 setTheme → 写 configForms，未知 id 拒绝 ----------
const actions = registeredRow.options.inject();
actions.setTheme("off");
actions.setTheme("nope");
assert.deepEqual(settingsWrites, [{ field: "theme", value: "off" }], "only valid ids reach the settings write");

// ---------- 场景 5：切回 off → 完整还原 ----------
settingsValue = { theme: "off" };
for (const fn of settingsListeners) fn();
assert.equal(htmlEl.attrs.has("data-dsb-on"), false, "gate removed");
assert.equal(bodyEl.style.map.size, 0, "canvas vars cleared");
assert.equal(overrideLayer, null, "override layer removed");

// ---------- 场景 6：dispose（HMR/停用）→ 样式表与状态全清 ----------
settingsValue = { theme: "gothic-void-crusade" };
for (const fn of settingsListeners) fn();
assert.ok(overrideLayer && !overrideLayer.disposed);
while (effects.length > 0) disposeEntry(effects[effects.length - 1]);
assert.equal(styleTags().length, 0, "style tag removed on dispose");
assert.equal(htmlEl.attrs.has("data-dsb-on"), false);
assert.equal(bodyEl.style.map.size, 0);

console.log("smoke-test: 6 scenarios passed ✓");
