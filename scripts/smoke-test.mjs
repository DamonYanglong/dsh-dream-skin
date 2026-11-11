#!/usr/bin/env node
/**
 * dsh-dream-skin · client bundle 冒烟测试（零依赖）
 *
 * 用 stub 的 ModuleLoader / cordis ctx / DOM 加载 lib/client.js，
 * 验证 M1 的核心状态机：挂载生效 → off 完整还原 → dispose 清理。
 * 真机视觉验证见 README M1 验收项。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import assert from "node:assert";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const bundle = readFileSync(join(root, "lib/client.js"), "utf8");

// ---------- stub DOM ----------
const makeStyle = () => ({
  tagName: "STYLE",
  dataset: {},
  textContent: "",
  remove() {
    this.removed = true;
    head.children.delete(this);
  },
});
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
  createElement(tag) { return makeStyle(); },
};

// ---------- stub module loader / theme runtime / settings ----------
const loaded = [];
const windowStub = {};
const requireStub = Object.assign(() => { throw new Error("bundle should not require externals"); }, {
  asset: (ref) => `#asset:${ref}`,
});

// ---------- run bundle ----------
const context = {
  window: windowStub,
  console,
  Symbol,
  JSON,
  Object,
  document: documentStub,
};
windowStub.__ModuleLoader__ = {
  load(row) { loaded.push(row); },
};
vm.createContext(context);
vm.runInContext(bundle, context, { filename: "lib/client.js" });
assert.equal(loaded.length, 1, "bundle registers exactly one row");
assert.equal(loaded[0].id, "dsh-dream-skin");

// materialize the factory
const exports = loaded[0].factory(requireStub);
assert.equal(typeof exports.apply, "function");
assert.deepEqual(exports.inject, ["theme", "configForms"]);

// ---------- stub cordis ctx ----------
const effects = [];
let overrideLayer = null;
const listeners = {};
const settingsListeners = new Set();
let settingsValue; // undefined until served

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
      };
    },
  },
  on(event, fn) {
    (listeners[event] ??= []).push(fn);
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

// ---------- 场景 2：选择主题 → 生效 ----------
settingsValue = { theme: "gothic-void-crusade" };
for (const fn of settingsListeners) fn();
assert.equal(htmlEl.attrs.get("data-dsb-on"), "", "canvas gate on");
assert.equal(bodyEl.style.map.get("--dsb-bg"), 'url("#asset:plugins/dsh-dream-skin/assets/background-e84cc454728d.jpg")');
assert.equal(bodyEl.style.map.get("--dsb-bg-pos"), "76% 45%");
assert.equal(bodyEl.style.map.get("--dsb-d-rgb"), "13 13 14");
assert.equal(bodyEl.style.map.get("--dsb-l-rgb"), "248 243 230");
assert.ok(overrideLayer, "override layer registered");
assert.equal(overrideLayer.source, "dsh-dream-skin");
assert.ok(overrideLayer.tokens["--dsw-alias-label-primary"].dark === "#f3ead7");
assert.ok(overrideLayer.tokens["--dsw-alias-label-primary"].light === "var(--dsw-static-neutral-bluish-1000)");
// 幂等：同值不重复注册
for (const fn of settingsListeners) fn();
assert.ok(overrideLayer && !overrideLayer.disposed);

// ---------- 场景 3：切回 off → 完整还原 ----------
settingsValue = { theme: "off" };
for (const fn of settingsListeners) fn();
assert.equal(htmlEl.attrs.has("data-dsb-on"), false, "gate removed");
assert.equal(bodyEl.style.map.size, 0, "canvas vars cleared");
assert.equal(overrideLayer, null, "override layer removed");

// ---------- 场景 4：未知 id → 安全退 off ----------
settingsValue = { theme: "nope" };
for (const fn of settingsListeners) fn();
assert.equal(htmlEl.attrs.has("data-dsb-on"), false);

// ---------- 场景 5：dispose（HMR/停用）→ 样式表与状态全清 ----------
settingsValue = { theme: "gothic-void-crusade" };
for (const fn of settingsListeners) fn();
assert.ok(overrideLayer && !overrideLayer.disposed);
while (effects.length > 0) disposeEntry(effects[effects.length - 1]);
assert.equal(styleTags().length, 0, "style tag removed on dispose");
assert.equal(htmlEl.attrs.has("data-dsb-on"), false);
assert.equal(bodyEl.style.map.size, 0);

console.log("smoke-test: 5 scenarios passed ✓");
