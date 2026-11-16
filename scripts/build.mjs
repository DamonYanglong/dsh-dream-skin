#!/usr/bin/env node
/**
 * dsh-dream-skin · build（M1）
 *
 * 产出（对齐 dsh-client-modules「构建要求」的产物形态）：
 *   lib/index.js           node 半侧（src/node/index.js 原样复制，ESM）
 *   lib/client.js          浏览器半侧 bundle：ModuleLoader factory 形态，
 *                         CSS/token/资产 URL 在此注入
 *   lib/assets/<name>-<sha1:12>.<ext>
 *                         资产管线硬性形式：内容哈希文件名，
 *                         引用编译为 require.asset("plugins/<pkg>/assets/…")
 *
 * M2 的 build-themes.mjs 会把 theme.css 的映射推导接进来；M1 的 token
 * 覆盖层直接来自 themes/<id>/dsw.json（DESIGN §5 兜底顺序中的显式映射）。
 * 零 npm 依赖（node:crypto / node:fs）。
 */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const PKG = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).name;

/** "#0d0d0e" → "13 13 14"（CSS 空格三元组，供 rgb(var() / a) 引用）。 */
function hexToSpaceTriplet(hex) {
  const value = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(value)) throw new Error(`expect 6-digit hex, got ${hex}`);
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)).join(" ");
}

/** 每路径段 encodeURIComponent 后再编码 !'()*（client-modules 资产约定）。 */
function encodeAssetSegment(segment) {
  return encodeURIComponent(segment).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

// ---------- 输入 ----------
const themesDir = join(root, "themes");
const themeIds = readFileSync(join(root, "src/node/index.js"), "utf8").match(/THEME_IDS = \[(.*?)\]/s)[1]
  .split(",")
  .map((part) => part.trim().replace(/["'`]/g, ""))
  .filter((id) => id && id !== "off");

const themes = {};
/** 材质 token（bg-base / bg-layer-N）：不进全局 overrideTokens——半透明化只作用于
 *  #root（应用本体）；设置面板/菜单 portal 在 #root 外，保持官方不透明材质
 *  （v6 决策：zcode 的“设置页保留原始”等价实现）。 */
const LAYER_TOKEN_RE = /^--dsw-alias-(bg-base|bg-layer-\d+)$/;
const layerRules = [];
for (const id of themeIds) {
  const dir = join(themesDir, id);
  const theme = JSON.parse(readFileSync(join(dir, "theme.json"), "utf8"));
  const dsw = JSON.parse(readFileSync(join(dir, "dsw.json"), "utf8"));
  if (theme.id !== id) throw new Error(`themes/${id}/theme.json declares id "${theme.id}"`);
  themes[id] = {
    name: theme.name ?? id,
    fx: theme.art?.focusX ?? 0.5,
    fy: theme.art?.focusY ?? 0.5,
    dRgb: hexToSpaceTriplet(theme.colors.background),
    lRgb: dsw.scrimLightRgb,
    tokens: dsw.tokens,
  };
  // 拆分：材质 token → #root 作用域 CSS；alpha 参数化为 --dsb-a-* 变量
  // （applyTheme 按「背景透出度」实时缩放，面板滑杆直调）
  const decls = [];
  /** bg-base → base；bg-layer-N → N */
  const alphaVarOf = (tokenName) => tokenName.replace(/^--dsw-alias-bg-(base|layer-(\d+))$/, (_, kind, n) => (kind === "base" ? "base" : n));
  themes[id].alphas = {};
  for (const name of Object.keys(themes[id].tokens)) {
    if (!LAYER_TOKEN_RE.test(name)) continue;
    const key = alphaVarOf(name);
    const dark = themes[id].tokens[name].dark;
    const pct = dark.match(/(\d+(?:\.\d+)?)%,\s*transparent/);
    if (!pct) throw new Error(`themes/${id}/dsw.json: ${name}.dark 需为 color-mix(… N%, transparent)，got ${dark}`);
    themes[id].alphas[key] = Number(pct[1]) / 100;
    decls.push(`\t${name}: rgb(var(--dsb-d-rgb) / var(--dsb-a-${key}, ${pct[1]}%));`);
    delete themes[id].tokens[name];
  }
  if (decls.length > 0) {
    for (const [shell, not, rgbVar] of [
      ["暗", ":has(body[data-ds-dark-theme])", "--dsb-d-rgb"],
      ["浅", ":not(:has(body[data-ds-dark-theme]))", "--dsb-l-rgb"],
    ]) {
      layerRules.push(
        `/* ${id} 材质半透明化 · ${shell}壳（源自 dsw.json bg-* token；\n * ` +
          `#root 作用域 = 设置面板/菜单/浮层在 #root 外，保持官方材质；\n * ` +
          `alpha 经 --dsb-a-* 由「背景透出度」实时缩放）*/\n` +
          `html[data-dsb-on][data-dsb-theme=${JSON.stringify(id)}]${not} #root {\n` +
          `${decls.map((d) => d.replace("--dsb-d-rgb", rgbVar)).join("\n")}\n}`,
      );
    }
  }
}
// 通用兜底规则（不带主题 id 门控；暗/浅壳各一）：导入主题（运行时 id，构建期
// 未知）走默认 alpha 阶梯；内置主题的专属规则特异性更高，仍优先。
for (const [shell, not, rgbVar] of [
  ["暗", ":has(body[data-ds-dark-theme])", "--dsb-d-rgb"],
  ["浅", ":not(:has(body[data-ds-dark-theme]))", "--dsb-l-rgb"],
]) {
  layerRules.push(
    `/* 导入主题兜底 · ${shell}壳：默认材质阶梯（62/62/72/82）；\n * ` +
      `内置主题的专属规则（上方）特异性更高、覆盖本条 */\n` +
      `html[data-dsb-on]${not} #root {\n` +
      `\t--dsw-alias-bg-base: rgb(var(${rgbVar}) / var(--dsb-a-base, 62%));\n` +
      `\t--dsw-alias-bg-layer-1: rgb(var(${rgbVar}) / var(--dsb-a-1, 62%));\n` +
      `\t--dsw-alias-bg-layer-2: rgb(var(${rgbVar}) / var(--dsb-a-2, 72%));\n` +
      `\t--dsw-alias-bg-layer-3: rgb(var(${rgbVar}) / var(--dsb-a-3, 82%));\n}`,
  );
}

// ---------- 资产 ----------
const outLib = join(root, "lib");
const outAssets = join(outLib, "assets");
rmSync(outLib, { recursive: true, force: true });
mkdirSync(outAssets, { recursive: true });

const emitted = [];
for (const id of themeIds) {
  const theme = JSON.parse(readFileSync(join(themesDir, id, "theme.json"), "utf8"));
  const source = join(themesDir, id, theme.image);
  const bytes = readFileSync(source);
  const revision = createHash("sha1").update(bytes).digest("hex").slice(0, 12);
  const dot = theme.image.lastIndexOf(".");
  const name = `${theme.image.slice(0, dot)}-${revision}${theme.image.slice(dot)}`;
  if (!/\.(svg|png|webp|jpe?g)$/i.test(theme.image)) throw new Error(`asset extension not allowed: ${theme.image}`);
  copyFileSync(source, join(outAssets, name));
  emitted.push({ id, name, bytes: bytes.length });
}

// ---------- client bundle ----------
const skeletonCss =
  readFileSync(join(root, "src/client/skeleton.css"), "utf8") +
  (layerRules.length > 0 ? `\n\n/* ---- 材质半透明化 · #root 作用域（构建期生成，见 skeleton.css 头注）---- */\n${layerRules.join("\n\n")}\n` : "");
// M3 模块化：按 INLINE_MODULES 顺序内联 src/client/*.js（禁 import——符号经
// 拼接作用域流动，顺序即依赖；verify-structure 守卫此纪律）
const INLINE_MODULES = [
  "00-const.js", "10-locale.js", "20-color.js", "30-net.js",
  "40-engine.js", "50-components.js", "90-apply.js",
];
const template = INLINE_MODULES.map((m) => readFileSync(join(root, "src/client", m), "utf8")).join("\n\n");

// M1：单主题共用同一张背景（THEMES 键序即 themeIds 序）。
const bgName = emitted[0].name;
const bgUrlExpr = `require.asset(${JSON.stringify(`plugins/${PKG}/assets/${encodeAssetSegment(bgName)}`)})`;

const body = template
  .replace("__SKELETON_CSS_PLACEHOLDER__", () => JSON.stringify(skeletonCss))
  .replace("__THEMES_PLACEHOLDER__", () => JSON.stringify(themes))
  .replace("__BG_URL_PLACEHOLDER__", () => bgUrlExpr);

const bundle = `window.__ModuleLoader__.load({
	id: ${JSON.stringify(PKG)},
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${body
  .split("\n")
  .map((line) => `\t${line}`)
  .join("\n")}
		return module.exports;
	}
});
`;

writeFileSync(join(outLib, "client.js"), bundle);

// ---------- node half ----------
copyFileSync(join(root, "src/node/index.js"), join(outLib, "index.js"));

// ---------- 报告 ----------
console.log(`dsh-dream-skin build → lib/`);
for (const item of emitted) console.log(`  asset  ${item.name}  (${item.bytes} bytes)`);
console.log(`  client ${Object.keys(themes).length} theme(s): ${Object.keys(themes).join(", ")}`);
console.log(`  bg url ${bgUrlExpr}`);
