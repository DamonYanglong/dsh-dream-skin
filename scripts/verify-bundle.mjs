#!/usr/bin/env node
/**
 * verify-bundle — 产物形态守卫（M3-DESIGN J4：外部 require 白名单 = {react}）。
 *
 * 另核：ModuleLoader 注册恰一次、exports.apply/inject 存在（客户端插件形态契约）。
 * 违规输出 [V3] exit 1。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const bundle = readFileSync(join(root, "lib/client.js"), "utf8");
const errors = [];
const pass = (msg) => console.log(`  PASS ${msg}`);

const WHITELIST = new Set(["react"]);

const requires = [...bundle.matchAll(/require\((["'])([^"')]+)\1\)/g)].map((m) => m[2]);
const external = requires.filter((r) => !r.startsWith(".")); // 相对路径在内联产物中本不该有，一并视为外部
const offending = [...new Set(external.filter((r) => !WHITELIST.has(r)))];
if (offending.length > 0) errors.push(`J4 白名单外外部 require: ${offending.join(", ")}`);
else pass(`J4 外部 require ⊆ {${[...WHITELIST].join(", ")}}（共 ${requires.length} 处）`);

// 剥离块注释后再计数（模板头注释含示例调用）
const noComments = bundle.replace(/\/\*[\s\S]*?\*\//g, "");
const loads = (noComments.match(/window\.__ModuleLoader__\.load\(/g) ?? []).length;
if (loads !== 1) errors.push(`ModuleLoader 注册次数 = ${loads}（必须恰一次）`);
else pass("ModuleLoader 注册恰一次");

for (const key of ["exports.apply = apply", "exports.inject = inject"]) {
  if (!bundle.includes(key)) errors.push(`缺 ${key}（插件形态契约）`);
}
if (!errors.some((e) => e.includes("exports."))) pass("exports.apply/inject 在位");

if (errors.length > 0) {
  for (const e of errors) console.error(`[V3] verify-bundle: ${e}`);
  process.exit(1);
}
console.log("verify-bundle: OK");
