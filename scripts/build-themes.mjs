#!/usr/bin/env node
/**
 * build-themes — zds theme.css → dsw.json 色板管线（M3-DESIGN W4）。
 *
 * 输入：zds 主题目录（theme.css 的 html.dark / html:not(.dark) 两块 --color-*
 *       语义变量 + theme.json 的 colors.background / art）。
 * 输出：dsw.json（与 themes/gothic-void-crusade/dsw.json 同构——键集是
 *       契约，多退少补即 fail）。
 * 映射真源：gothic 手工调校值（见 git 历史首版），本文件把它参数化：
 *   dark 块：foreground→label-primary、foreground-subtle→label-secondary、
 *     foreground-subtlest→label-tertiary、hover→interactive-bg-hover/border-l1、
 *     selected→border-l2、brand→state-business-primary、terminal-selection→
 *     scrollbar-bg、border-hover→scrollbar-hover；
 *   浅壳沿用 gothic 惯例 = 官方 static 表达式（v13 双壳决议）；
 *   scrimLightRgb = 浅块 hero scrim 首端点色。
 * E1：源色缺 → gothic 同位兜底并 warn（zds 部分主题本身缺色）。
 * E2：var() 引用色仅允许出现在 light 值；dark 值必须是字面色。
 * 用法：node scripts/build-themes.mjs <zds-theme-dir> [--write <out>]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const srcDir = args[0];
const writeIdx = args.indexOf("--write");
const outPath = writeIdx >= 0 ? args[writeIdx + 1] : null;
if (!srcDir || !existsSync(join(srcDir, "theme.css"))) {
  console.error("用法: node scripts/build-themes.mjs <zds-theme-dir> [--write <dsw.json>]");
  process.exit(1);
}

/** 契约键集（gothic 基准）。 */
const TOKEN_KEYS = [
  "--dsw-alias-bg-base", "--dsw-alias-bg-layer-1", "--dsw-alias-bg-layer-2", "--dsw-alias-bg-layer-3",
  "--dsw-alias-label-primary", "--dsw-alias-label-secondary", "--dsw-alias-label-tertiary",
  "--dsw-alias-border-l1", "--dsw-alias-border-l2",
  "--dsw-alias-state-business-primary", "--dsw-alias-link", "--dsw-alias-interactive-bg-hover",
  "--dsw-alias-scrollbar-bg-l1", "--dsw-alias-scrollbar-hover-l1",
  "--dsw-alias-bg-document-selection", "--dsw-specific-sidebar-fill",
];

/** 解析 CSS 颜色变量块：返回 { dark: {name: value}, light: {...} }。 */
function parseColorVars(css) {
  const blocks = { dark: {}, light: {} };
  // html.dark { ... } 与 html:not(.dark) { ... }（zds 两块语义覆盖）
  for (const m of css.matchAll(/html\.dark\s*\{([^{}]+)\}/g)) collect(m[1], blocks.dark);
  for (const m of css.matchAll(/html:not\(\.dark\)\s*\{([^{}]+)\}/g)) collect(m[1], blocks.light);
  return blocks;
  function collect(body, into) {
    for (const v of body.matchAll(/--([a-z-]+)\s*:\s*([^;]+);/gi)) {
      // zds 语义变量带 color- 前缀（--color-foreground）；映射用裸名
      into[v[1].replace(/^color-/, "")] = v[2].replace(/\s*!important\s*$/, "").trim();
    }
  }
}

/** 提取 hero scrim 首端点色（浅块第一个 linear-gradient 的首个 rgb/rgba）。 */
function scrimLight(css) {
  const lightHero = css.match(/html:not\(\.dark\):not\(:has\([^)]*\)\)\s*\{[^{}]*linear-gradient\([^)]*rgb[a]?\(([^)]+)\)/s)
    ?? css.match(/html:not\(\.dark\)[^{]*\{[^{}]*linear-gradient\([^)]*rgb[a]?\(([^)]+)\)/s);
  const raw = lightHero?.[1] ?? "248, 243, 230";
  return raw.split(/[,\s/]+/).filter(Boolean).slice(0, 3).join(" ");
}

/** E2：dark 值必须是字面色（#hex/rgb/rgba/color-mix），var() 只许进 light。 */
function literalOr(value, label, fallback, warnings) {
  if (value === undefined) {
    warnings.push(`E1 ${label} 缺源色，用兜底 ${fallback}`);
    return fallback;
  }
  if (/var\(/.test(value)) {
    console.error(`[B] build-themes: E2 ${label} 源值为 var() 引用（${value}）——dark 值必须是字面色`);
    process.exit(1);
  }
  return value;
}

const css = readFileSync(join(srcDir, "theme.css"), "utf8");
const manifest = JSON.parse(readFileSync(join(srcDir, "theme.json"), "utf8"));
const vars = parseColorVars(css);
const d = vars.dark;
const warnings = [];
const bg = manifest.colors?.background ?? "#0d0d0e";
const OFFICIAL = (n) => `var(--dsw-static-neutral-bluish-${n})`;

const tokens = {};
// 材质阶梯（build.mjs 再拆 #root 作用域规则；这里给 color-mix 字面量）
for (const [key, alpha] of [["--dsw-alias-bg-base", 62], ["--dsw-alias-bg-layer-1", 62], ["--dsw-alias-bg-layer-2", 72], ["--dsw-alias-bg-layer-3", 82]]) {
  tokens[key] = { light: OFFICIAL("00"), dark: `color-mix(in srgb, ${bg} ${alpha}%, transparent)` };
}
tokens["--dsw-alias-label-primary"] = { light: OFFICIAL("1000"), dark: literalOr(d.foreground ?? manifest.colors?.text, "foreground/theme.json.text", "#f3ead7", warnings) };
tokens["--dsw-alias-label-secondary"] = { light: OFFICIAL("700"), dark: literalOr(d["foreground-subtle"], "foreground-subtle", "#b5a386", warnings) };
tokens["--dsw-alias-label-tertiary"] = { light: OFFICIAL("600"), dark: literalOr(d["foreground-subtlest"], "foreground-subtlest", "#8f8168", warnings) };
tokens["--dsw-alias-border-l1"] = { light: "#0000000a", dark: literalOr(d.hover, "hover", "rgba(200, 165, 90, 0.1)", warnings) };
tokens["--dsw-alias-border-l2"] = { light: "#0000001a", dark: literalOr(d.selected, "selected", "rgba(200, 165, 90, 0.16)", warnings) };
tokens["--dsw-alias-state-business-primary"] = { light: "var(--dsw-static-deepseek-500)", dark: literalOr(d.brand, "brand", "#c8a55a", warnings) };
tokens["--dsw-alias-link"] = { light: "var(--dsw-static-deepseek-500)", dark: literalOr(d["trajectory-user"] ?? d.brand, "trajectory-user", "#d9b96e", warnings) };
tokens["--dsw-alias-interactive-bg-hover"] = { light: "#2631480f", dark: literalOr(d.hover, "hover", "rgba(200, 165, 90, 0.1)", warnings) };
tokens["--dsw-alias-scrollbar-bg-l1"] = { light: "var(--dsw-static-neutral-200)", dark: literalOr(d["terminal-selection"], "terminal-selection", "rgba(200, 165, 90, 0.28)", warnings) };
tokens["--dsw-alias-scrollbar-hover-l1"] = { light: "var(--dsw-static-neutral-300)", dark: literalOr(d["border-hover"], "border-hover", "rgba(200, 165, 90, 0.45)", warnings) };

tokens["--dsw-alias-bg-document-selection"] = {
  light: `color-mix(in srgb, ${literalOr(d.brand, "brand", "#c8a55a", warnings)} 40%, transparent)`,
  dark: `color-mix(in srgb, ${literalOr(d.brand, "brand", "#c8a55a", warnings)} 40%, transparent)`,
};
// sidebar-fill：运行时 withSidebarFill 会覆盖；此处仅保键集契约（gothic 调校值：
// dark = popover-header @0.66，light = 官方 static）
const ph = literalOr(d["popover-header"], "popover-header", "rgba(23, 21, 19, 0.97)", warnings);
tokens["--dsw-specific-sidebar-fill"] = {
  light: "var(--dsw-static-neutral-bluish-50)",
  dark: ph.replace(/[\d.]+\)$/, "0.66)"),
};

// 契约校验：键集与 gothic 基准完全一致
const got = Object.keys(tokens).sort().join(",");
const want = [...TOKEN_KEYS].sort().join(",");
if (got !== want) {
  console.error(`[B] build-themes: 键集与基准不一致\n  多: ${(Object.keys(tokens).filter((k) => !TOKEN_KEYS.includes(k))).join(",") || "-"}\n  少: ${(TOKEN_KEYS.filter((k) => !(k in tokens))).join(",") || "-"}`);
  process.exit(1);
}

const dsw = { scrimLightRgb: scrimLight(css), tokens };
const json = JSON.stringify(dsw, null, 2) + "\n";
if (outPath) {
  writeFileSync(outPath, json);
  console.log(`dsw.json → ${outPath}`);
} else {
  process.stdout.write(json);
}
for (const w of warnings) console.warn(`  WARN ${w}`);
