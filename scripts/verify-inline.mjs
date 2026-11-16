#!/usr/bin/env node
/**
 * verify-inline — 关键内联锚点守卫（M3-DESIGN J2/M1；v26/v34 事故）。
 *
 * 检查构建产物 lib/client.js：
 *   J2  body 背景层的四个关键属性逐项写入锚点（v26：整串重写丢 z-index 的教训
 *       ——画布现为 body 背景层，锚点= image/size/position/repeat 四写入 + 清除成对）
 *   M1  html 兜底色写入与清除成对（v34：白闪）
 * 全部锚点来自 applyTheme 提交块与 clearCanvas，缺一即 [V2] exit 1。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const bundle = readFileSync(join(root, "lib/client.js"), "utf8");
const errors = [];
const pass = (msg) => console.log(`  PASS ${msg}`);

/** body 背景四写入 + 清除成对 */
const bodyWrites = [
  ['setProperty("background-image"', "背景图三层写入"],
  ['setProperty("background-size"', "背景尺寸写入"],
  ['setProperty("background-position"', "背景定位写入"],
  ['setProperty("background-repeat"', "平铺写入"],
];
const bodyClears = [
  ['removeProperty("background-image"', "背景图清除"],
  ['removeProperty("background-size"', "背景尺寸清除"],
  ['removeProperty("background-position"', "背景定位清除"],
  ['removeProperty("background-repeat"', "平铺清除"],
];
for (const [needle, label] of [...bodyWrites, ...bodyClears]) {
  const n = bundle.split(needle).length - 1;
  if (n < 1) errors.push(`J2 ${label}锚点缺失（${needle}）`);
}
if (!errors.some((e) => e.startsWith("J2"))) pass("J2 body 背景四写入×四清除锚点齐全");

/** M1 html 兜底：写入（applyTheme）与清除（clearCanvas）成对 */
const underlayWrite = /root\.style\.setProperty\("background-color"/.test(bundle);
const underlayClear = /root\.style\.removeProperty\("background-color"\)/.test(bundle);
if (!underlayWrite) errors.push("M1 html 兜底色写入缺失（applyTheme）");
if (!underlayClear) errors.push("M1 html 兜底色清除缺失（clearCanvas）——off 态必须完整还原");
if (underlayWrite && underlayClear) pass("M1 html 兜底写入/清除成对");

/** J2 附则：禁止整串 cssText 重写（v26 事故根源） */
if (/\.cssText\s*=/.test(bundle)) errors.push("J2 产物含 cssText 整串赋值（必须逐属性 API）");
else pass("J2 无 cssText 整串赋值");

if (errors.length > 0) {
  for (const e of errors) console.error(`[V2] verify-inline: ${e}`);
  process.exit(1);
}
console.log("verify-inline: OK");
