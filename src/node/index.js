// dsh-dream-skin · node half
//
// 职责（v9 起）：
// 1. 声明 volatile Config（theme / visibility / bgPosX）——读写走 ui-settings
//    公共边界（ctx.configForms），持久化由 Host settings 承担。
// 2. 导入皮肤的宿主侧：~/.dsh/dream-skins/<id>/{skin.json,background.*}
//    的清单/资产服务 + 导入/删除路由（skill-explorer 同款 webServer.register
//    exact 路由，loopback-only）。
import z from "@deepseek-ai/schemastery";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** 内置主题 id（M1 只移植 gothic-void-crusade）+ 关闭态。 */
export const THEME_IDS = ["off", "gothic-void-crusade"];

/**
 * theme：任意字符串——内置 id 或导入的皮肤 id（导入集是运行时的，
 * 无法进静态 schema；未知 id 客户端安全退化为 off）。
 * bgPosX：-1 = 跟随主题 art.focusX；0–100 = 用户固定横向位置。
 */
export const Config = z.object({
  theme: z.string().default("off").volatile(),
  visibility: z.number().min(0).max(100).default(75).volatile(),
  bgPosX: z.number().min(-1).max(100).default(-1).volatile(),
});

/** 导入皮肤的用户目录（跨插件更新存活）。 */
const SKINS_DIR = join(homedir(), ".dsh", "dream-skins");
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const IMAGE_RE = /^[\w.-]+$/i;
const IMAGE_EXT_RE = /\.(jpe?g|png|webp)$/i;
const MIME_OF = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export const inject = ["webServer"];

/** loopback-only 守卫（导入/删除是本机操作；远端浏览器拒绝）。 */
const isLoopback = (req) => {
	const addr = req.socket?.remoteAddress ?? "";
	return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
};

const json = (res, status, body) => {
	const payload = JSON.stringify(body);
	res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
	res.end(payload);
};

/** 读 JSON body（上限保护；畸形返回 null）。 */
async function readJson(req, maxBytes = 16 * 1024 * 1024) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		size += chunk.length;
		if (size > maxBytes) {
			req.destroy();
			return null;
		}
		chunks.push(chunk);
	}
	try {
		const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
		return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

/** 读取全部导入清单（目录不存在 = 空表）。 */
async function listSkins() {
	if (!existsSync(SKINS_DIR)) return [];
	const out = [];
	for (const entry of await readdir(SKINS_DIR, { withFileTypes: true })) {
		if (!entry.isDirectory() || !ID_RE.test(entry.name)) continue;
		try {
			const manifest = JSON.parse(await readFile(join(SKINS_DIR, entry.name, "skin.json"), "utf8"));
			if (manifest?.id === entry.name && typeof manifest.image === "string") out.push(manifest);
		} catch {
			/* 损坏的清单跳过，不殃及其他 */
		}
	}
	return out;
}

/** id slug 化（导入名 → 目录名）。 */
const slugify = (s) =>
	String(s)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64) || "skin";

export function apply(ctx) {
	const guard = (req, res, method) => {
		if (!isLoopback(req)) {
			json(res, 403, { error: "forbidden: loopback-only" });
			return false;
		}
		if (req.method !== method) {
			json(res, 405, { error: `method not allowed: ${req.method}` });
			return false;
		}
		return true;
	};

	const routes = [
		{
			kind: "exact",
			path: "/api/dsh-dream-skin/list",
			handler: async (req, res) => {
				if (!guard(req, res, "GET")) return;
				try {
					json(res, 200, { themes: await listSkins() });
				} catch (error) {
					json(res, 500, { error: String(error) });
				}
			},
		},
		{
			kind: "exact",
			path: "/api/dsh-dream-skin/asset",
			handler: async (req, res) => {
				if (!guard(req, res, "GET")) return;
				try {
					const url = new URL(req.url ?? "/", "http://x");
					const id = url.searchParams.get("id") ?? "";
					const file = url.searchParams.get("file") ?? "";
					if (!ID_RE.test(id) || !IMAGE_RE.test(file) || !IMAGE_EXT_RE.test(file)) {
						json(res, 400, { error: "bad id or file" });
						return;
					}
					const bytes = await readFile(join(SKINS_DIR, id, file));
					res.writeHead(200, { "content-type": MIME_OF[file.split(".").pop().toLowerCase()], "cache-control": "no-store" });
					res.end(bytes);
				} catch {
					json(res, 404, { error: "not found" });
				}
			},
		},
		{
			kind: "exact",
			path: "/api/dsh-dream-skin/import",
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJson(req);
				if (body === null) {
					json(res, 400, { error: "bad json body" });
					return;
				}
				try {
					const name = String(body.name ?? "").trim().slice(0, 64) || "Imported skin";
					let id = slugify(body.id ?? name);
					if (!ID_RE.test(id)) id = "skin";
					// 重名追加序号，不覆盖既有导入
					if (existsSync(join(SKINS_DIR, id))) {
						for (let n = 2; n < 1000; n++) {
							const cand = `${id}-${n}`;
							if (!existsSync(join(SKINS_DIR, cand))) {
								id = cand;
								break;
							}
						}
					}
					const imageExt = String(body.imageExt ?? "").toLowerCase();
					if (!["jpg", "jpeg", "png", "webp"].includes(imageExt)) {
						json(res, 400, { error: "imageExt must be jpg|jpeg|png|webp" });
						return;
					}
					const bin = Buffer.from(String(body.imageBase64 ?? ""), "base64");
					if (bin.length === 0 || bin.length > MAX_IMAGE_BYTES) {
						json(res, 400, { error: `background must be 1B..${MAX_IMAGE_BYTES}B` });
						return;
					}
					const manifest = {
						id,
						name,
						appearance: ["dark", "light", "adaptive"].includes(body.appearance) ? body.appearance : "adaptive",
						fx: Number.isFinite(Number(body.fx)) ? Math.min(1, Math.max(0, Number(body.fx))) : 0.5,
						fy: Number.isFinite(Number(body.fy)) ? Math.min(1, Math.max(0, Number(body.fy))) : 0.5,
						image: `background.${imageExt}`,
						colors: typeof body.colors === "object" && body.colors !== null ? body.colors : {},
					};
					await mkdir(join(SKINS_DIR, id), { recursive: true });
					await writeFile(join(SKINS_DIR, id, manifest.image), bin);
					await writeFile(join(SKINS_DIR, id, "skin.json"), JSON.stringify(manifest, null, "\t"));
					json(res, 200, manifest);
				} catch (error) {
					json(res, 500, { error: String(error) });
				}
			},
		},
		{
			kind: "exact",
			path: "/api/dsh-dream-skin/remove",
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJson(req, 1024 * 1024);
				const id = String(body?.id ?? "");
				if (body === null || !ID_RE.test(id)) {
					json(res, 400, { error: "bad id" });
					return;
				}
				try {
					if (!existsSync(join(SKINS_DIR, id, "skin.json"))) {
						json(res, 404, { error: "not found" });
						return;
					}
					await rm(join(SKINS_DIR, id), { recursive: true, force: true });
					json(res, 200, { removed: id });
				} catch (error) {
					json(res, 500, { error: String(error) });
				}
			},
		},
	];

	ctx.effect(() => {
		const disposers = routes.map((route) => ctx.webServer.register(route));
		return () => {
			for (const dispose of disposers) dispose?.();
		};
	}, "dsh-dream-skin: skin library routes");
}
