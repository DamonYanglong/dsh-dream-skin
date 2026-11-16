/*
 * 30-net.js — 网络与诊断小工具。
 * 职责：base64 分块编码；同源 apiJson（no-store）；reportError DOM 诊断；导入资产 URL 拼装。
 * 不引用：ctx、form、主题表（reportError 仅触 document/console）。
 */
/** ArrayBuffer → base64（分块，避免参数栈超限）。 */
function bufferToBase64(buffer) {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	const CHUNK = 0x8000;
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return btoa(binary);
}

/** 同源 fetch 的 JSON 封装（document-relative 路径）。 */
async function apiJson(path, init) {
	const response = await fetch(path, { cache: "no-store", ...init });
	const body = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
	return body;
}

	/** 把错误记录到 DOM（data-dsb-error）并打到控制台，便于真机诊断。 */
const reportError = (stage, error) => {
	try {
		const message = `${stage}: ${error instanceof Error ? `${error.message}` : String(error)}`;
		console.error(`[dsh-dream-skin] ${message}`, error);
		document.documentElement.setAttribute("data-dsb-error", message);
	} catch {
		/* 报错路径自身不抛 */
	}
};


const importedUrl = (m) => `api/dsh-dream-skin/asset?id=${encodeURIComponent(m.id)}&file=${encodeURIComponent(m.image)}&v=${encodeURIComponent(m.rev ?? "")}`;
