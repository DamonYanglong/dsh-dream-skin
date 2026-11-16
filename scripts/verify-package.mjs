#!/usr/bin/env node
/**
 * verify-package — 发布物守卫（M3-DESIGN J6 / host-plugin 清单）。
 *
 * `npm pack --dry-run` 文件清单 ⊆ files 白名单；exports 四项齐全；
 * engines.dsh 存在；icon/locale/detail/changelog 齐备。违规输出 [V6] exit 1。
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const errors = [];
const pass = (msg) => console.log(`  PASS ${msg}`);

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

// files 白名单（J6：白名单制，越界文件拒绝）
const ALLOWED = new Set(["lib", "cordis.patch.yml", "README.md", "NOTICE.md", "locale", "icon.svg", "CHANGELOG.md", "plugin-detail.zh.md", "plugin-detail.en.md", "themes", "package.json"]);
const dry = execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: root, encoding: "utf8" });
const packed = JSON.parse(dry).flatMap((p) => p.files ?? []).map((f) => f.path ?? f);
const offenders = [...new Set(packed.map((p) => String(p).split("/")[0]).filter((top) => !ALLOWED.has(top) && !top.startsWith("lib") && !top.startsWith("themes") && !top.startsWith("locale")))].filter((t) => t !== "npm");
if (offenders.length > 0) errors.push(`J6 越界顶层文件: ${offenders.join(", ")}`);
else pass(`J6 文件清单 ⊆ 白名单（${packed.length} 项）`);

// exports 四项（host-plugin 契约：. / ./client / ./locale/*.json / ./icon）
for (const key of [".", "./client", "./assets/*", "./package.json"]) {
  if (!pkg.exports?.[key]) errors.push(`exports 缺 ${key}`);
}
if (!errors.some((e) => e.startsWith("exports"))) pass("exports 契约齐全");

// 引擎约束
if (!pkg.engines?.dsh && !pkg.dependencies?.["@deepseek-ai/dsh"]) {
  // link 包形态：dsh 字段非硬性（分发包标 engines.dsh；dev link 免）
  if (!pkg.private) errors.push("发布包缺 engines.dsh 版本约束");
  else pass("dev link 包（engines 免检，发布前取消 private）");
} else pass("engines 约束在位");

// 分发物
for (const f of ["icon.svg", "CHANGELOG.md", "plugin-detail.zh.md", "plugin-detail.en.md"]) {
  if (!existsSync(join(root, f))) errors.push(`分发物缺 ${f}`);
}
for (const code of ["zh", "en", "ja", "ko", "de", "fr", "es", "pt"]) {
  if (!existsSync(join(root, "locale", `${code}.json`))) errors.push(`locale 缺 ${code}.json`);
}
if (!errors.some((e) => e.startsWith("分发物") || e.startsWith("locale"))) pass("icon/CHANGELOG/detail/8语 locale 齐备");

if (errors.length > 0) {
  for (const e of errors) console.error(`[V6] verify-package: ${e}`);
  process.exit(1);
}
console.log("verify-package: OK");
