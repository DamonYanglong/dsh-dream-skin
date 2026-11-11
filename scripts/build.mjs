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
for (const id of themeIds) {
  const dir = join(themesDir, id);
  const theme = JSON.parse(readFileSync(join(dir, "theme.json"), "utf8"));
  const dsw = JSON.parse(readFileSync(join(dir, "dsw.json"), "utf8"));
  if (theme.id !== id) throw new Error(`themes/${id}/theme.json declares id "${theme.id}"`);
  themes[id] = {
    bgPos: `${Math.round(theme.art.focusX * 100)}% ${Math.round(theme.art.focusY * 100)}%`,
    dRgb: hexToSpaceTriplet(theme.colors.background),
    lRgb: dsw.scrimLightRgb,
    tokens: dsw.tokens,
  };
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
const skeletonCss = readFileSync(join(root, "src/client/skeleton.css"), "utf8");
const template = readFileSync(join(root, "src/client/bundle.template.js"), "utf8");

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
