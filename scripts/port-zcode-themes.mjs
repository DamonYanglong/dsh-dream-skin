#!/usr/bin/env node
/**
 * dsh-dream-skin · zcode 主题预导入（一次性/可重复）
 *
 * 把 zcode-dream-skin 仓库的 themes/<id>/（zds 格式）转换为
 * ~/.dsh/dream-skins/<id>/{skin.json, background.*}（运行时导入格式）。
 * 重复执行幂等（覆盖同 id 的导入，不影响内置主题）。
 *
 * 用法：node scripts/port-zcode-themes.mjs [zcode 仓库路径]
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const srcRoot = process.argv[2] ?? join(homedir(), "ZCodeProject", "zcode-dream-skin", "themes");
const destRoot = join(homedir(), ".dsh", "dream-skins");

if (!existsSync(srcRoot)) {
	console.error(`source not found: ${srcRoot}`);
	process.exit(1);
}
const { readdirSync } = await import("node:fs");

let count = 0;
for (const id of readdirSync(srcRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
	const dir = join(srcRoot, id);
	const manifest = JSON.parse(readFileSync(join(dir, "theme.json"), "utf8"));
	if (!manifest.image) {
		console.warn(`skip ${id}: no image`);
		continue;
	}
	const ext = manifest.image.split(".").pop().toLowerCase();
	if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
		console.warn(`skip ${id}: image ext ${ext}`);
		continue;
	}
	const skin = {
		id,
		name: manifest.name ?? id,
		appearance: ["dark", "light", "adaptive"].includes(manifest.appearance) ? manifest.appearance : "adaptive",
		fx: manifest.art?.focusX ?? 0.5,
		fy: manifest.art?.focusY ?? 0.5,
		image: `background.${ext}`,
		colors: {
			background: manifest.colors?.background ?? manifest.derivedFrom?.averageColor ?? "#0d0d0e",
			text: manifest.colors?.text ?? manifest.sourceColors?.text,
			muted: manifest.colors?.muted ?? manifest.sourceColors?.muted,
			accent: manifest.colors?.accent ?? manifest.sourceColors?.accent,
			line: manifest.colors?.line,
		},
		importedFrom: "zcode-dream-skin",
	};
	const dest = join(destRoot, id);
	rmSync(dest, { recursive: true, force: true });
	mkdirSync(dest, { recursive: true });
	copyFileSync(join(dir, manifest.image), join(dest, skin.image));
	writeFileSync(join(dest, "skin.json"), JSON.stringify(skin, null, "\t"));
	console.log(`imported ${id} — ${skin.name}`);
	count++;
}
console.log(`${count} theme(s) → ${destRoot}`);
