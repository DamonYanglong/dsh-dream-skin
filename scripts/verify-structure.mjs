#!/usr/bin/env node
/**
 * verify-structure — 模块结构守卫（M3-DESIGN M5/B3）。
 *
 * 内联模块纪律：src/client/*.js 禁 import/export（构建按 INLINE_MODULES 顺序拼接，
 * 符号经作用域流动）；文件头必须含「职责」与「不引用」声明；模块数 ≤12；
 * 单模块 ≤450 行（组件工厂 50-components 上限 500）。违规输出 [V5] exit 1。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = join(root, "src/client");
const errors = [];
const pass = (msg) => console.log(`  PASS ${msg}`);

const files = readdirSync(dir).filter((f) => f.endsWith(".js"));
if (files.length > 12) errors.push(`模块数 ${files.length} > 12`);
else pass(`模块数 ${files.length} ≤ 12`);

for (const f of files) {
  const text = readFileSync(join(dir, f), "utf8");
  const lines = text.split("\n").length;
  const limit = f.startsWith("50-") ? 500 : 450;
  if (lines > limit) errors.push(`${f} 行数 ${lines} > ${limit}`);
  if (/^\s*(import|export)\s/m.test(text)) errors.push(`B3 ${f} 含 import/export（内联模块禁用）`);
  const head = text.slice(0, 800);
  if (!/职责/.test(head)) errors.push(`M5 ${f} 文件头缺「职责」声明`);
  if (!/不引用/.test(head)) errors.push(`M5 ${f} 文件头缺「不引用」边界声明`);
}
if (!errors.some((e) => e.startsWith("B3"))) pass("无 import/export 语句");
if (!errors.some((e) => e.includes("行数"))) pass("模块行数全部在限内");
if (!errors.some((e) => e.startsWith("M5"))) pass("文件头职责/边界声明齐全");

// 编排模块必须存在且引擎/组件工厂可寻
for (const must of ["40-engine.js", "50-components.js", "90-apply.js"]) {
  if (!files.includes(must)) errors.push(`缺编排模块 ${must}`);
}

if (errors.length > 0) {
  for (const e of errors) console.error(`[V5] verify-structure: ${e}`);
  process.exit(1);
}
console.log("verify-structure: OK");
