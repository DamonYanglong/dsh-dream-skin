#!/usr/bin/env node
/**
 * verify-routes — ROUTE-INDEX.md 与代码一致性守卫（M3-DESIGN J5/M4）。
 *
 * 再生内容与入库文件零 diff 才算过；提取数 < 4 视为提取器失配（E3），
 * 显式失败而非静默通过。违规输出 [V4] exit 1。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractRoutes, renderIndex } from "./gen-route-index.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const host = readFileSync(join(root, "lib/index.js"), "utf8");
const committed = readFileSync(join(root, "docs/ROUTE-INDEX.md"), "utf8");

const routes = extractRoutes(host);
if (routes.length < 4) {
  console.error(`[V4] verify-routes: 提取数 ${routes.length} < 4 —— 提取器需适配（E3），不静默通过`);
  process.exit(1);
}
// 日期行随天变化会导致假阳性：比较时统一剥掉生成日期
const strip = (s) => s.replace(/生成于 [^。\n]+/, "生成于 <date>");
if (strip(renderIndex(routes, "x")) !== strip(committed)) {
  console.error("[V4] verify-routes: docs/ROUTE-INDEX.md 与 lib/index.js 不一致 —— 运行 `npm run routes` 后随代码同提交（M4）");
  process.exit(1);
}
console.log(`  PASS 路由表一致（${routes.length} 条）`);
console.log("verify-routes: OK");
