#!/usr/bin/env node
/**
 * verify-skeleton — 样式表结构守卫（M3-DESIGN J1/J3/M2 + 首条规则锚点）。
 *
 * [V1] 违规输出 `[V1] verify-skeleton: <detail>` 并 exit 1；全绿输出 PASS 行。
 * 守卫对象：src/client/skeleton.css（源）——产物由 build 注入，源即真源。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cssPath = join(root, "src/client/skeleton.css");
const css = readFileSync(cssPath, "utf8");
const errors = [];
const pass = (msg) => console.log(`  PASS ${msg}`);

// ── J1：注释平衡（v19c 事故：注释文本内的 `*/` 提前终止注释，吞噬首条规则）──
const open = (css.match(/\/\*/g) ?? []).length;
const close = (css.match(/\*\//g) ?? []).length;
if (open !== close) errors.push(`J1 注释不平衡: /* ×${open} vs */ ×${close}（注释文本内出现 */ 会吞规则）`);
else pass(`J1 注释平衡 (${open} 对)`);

// ── J3：逗号列表值中的 var()（v14 事故：Edge 计算期静默失效）──
// 逐声明扫：`prop: a, b, c;` 中任一分量含 var() 且整个值含逗号 → 违规
// （单值 var() 合法；只有「逗号列表 + var」组合才踩 Edge 坑）
for (const m of css.matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/g)) {
  const [, prop, value] = m;
  // v14 精确范围：多值列表型背景 longhand + var()（渐变函数内逗号与 var 回退逗号均合法）
  if (/^background-(size|position)$/.test(prop) && value.includes("var(")) {
    errors.push(`J3 ${prop} 含 var()（多值列表属性，Edge 计算期静默失效）: ${value.trim().slice(0, 60)}`);
  }
}
if (!errors.some((e) => e.startsWith("J3"))) pass("J3 逗号列表无 var()");

// ── M2：透明守卫与兜底成对（v25 事故：守卫丢失→UI 全被盖）──
const guardOn = /html\[data-dsb-on\]\s+body,\s*\n\s*html\[data-dsb-on\]\s+#root\s*\{\s*\n\s*background-color:\s*transparent\s*!important;/.test(css);
if (!guardOn) errors.push("M2 透明守卫规则缺失（html[data-dsb-on] body/#root → transparent !important）");
else pass("M2 透明守卫在位");

// ── M3：元素形态画布的拖拽区规则（WE #120；当前 body 背景架构下为预防性在位）──
const dragRule = /-webkit-app-region:\s*initial\s*!important/.test(css);
const usesCanvasElement = /dsb_canvas/.test(css) || /dsb_canvas/.test(readFileSync(join(root, "src/client/bundle.template.js"), "utf8"));
if (usesCanvasElement && !dragRule) errors.push("M3 画布元素形态存在但缺 -webkit-app-region: initial !important（拖拽区会被几何挖除）");
else pass(`M3 拖拽区${usesCanvasElement ? "规则在位（元素形态）" : "（body 背景形态，无 hit-test 面）"}`);

// ── 首条规则锚点（v19c：首条规则最容易被注释事故吞噬）──
const firstRule = css.match(/([^{}]+)\{/);
const firstSel = firstRule ? firstRule[1].replace(/\/\*[\s\S]*?\*\//g, "").trim() : "";
const EXPECTED_FIRST = "html[data-dsb-on] body";
if (!firstSel.includes(EXPECTED_FIRST)) errors.push(`首条规则选择器异常: 期望含 "${EXPECTED_FIRST}"，实际 "${firstSel.slice(0, 40)}"`);
else pass(`首条规则锚点 (${EXPECTED_FIRST})`);

if (errors.length > 0) {
  for (const e of errors) console.error(`[V1] verify-skeleton: ${e}`);
  process.exit(1);
}
console.log("verify-skeleton: OK");
