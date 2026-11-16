#!/usr/bin/env node
/**
 * gen-route-index — 从 lib/index.js 静态提取宿主路由，生成 docs/ROUTE-INDEX.md。
 *
 * M3-DESIGN J5/M4：该文件是生成物（WE 范式），禁止手编；
 * verify-routes.mjs 负责再生 diff 一致性。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const host = readFileSync(join(root, "lib/index.js"), "utf8");

/** 提取 { path, method }：path 字面量 + 其后 handler 内 guard(...,"METHOD")。 */
export function extractRoutes(source) {
  const routes = [];
  const re = /path:\s*"(\/api\/[^"]+)"[\s\S]{0,400}?guard\(req,\s*res,\s*"(GET|POST)"\)/g;
  for (const m of source.matchAll(re)) routes.push({ path: m[1], method: m[2] });
  return routes;
}

export function renderIndex(routes, generatedAt) {
  const rows = routes
    .map((r) => `| \`${r.method}\` | \`${r.path}\` |`)
    .join("\n");
  return `# ROUTE-INDEX — 宿主 HTTP 路由（生成物）

> 由 scripts/gen-route-index.mjs 从 lib/index.js 静态提取生成于 ${generatedAt}。
> **禁止手编**（M3-DESIGN J5）；新增/删除路由后运行 \`npm run routes\` 再提交。
> 守卫：scripts/verify-routes.mjs 再生 diff 必须为零。

| Method | Path |
|---|---|
${rows}
`;
}

const routes = extractRoutes(host);
if (routes.length < 4) {
  console.error(`[B] gen-route-index: 仅提取到 ${routes.length} 条路由（提取器可能需适配路由写法变化）`);
  process.exit(1);
}
const out = renderIndex(routes, new Date().toISOString().slice(0, 10));
writeFileSync(join(root, "docs/ROUTE-INDEX.md"), out);
console.log(`ROUTE-INDEX 重新生成：${routes.length} 条路由`);
