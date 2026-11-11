// dsh-dream-skin · self-screenshot proxy
// 在 127.0.0.1:54199 起一个注入认证 cookie 的反代 → 目标 Harness web 端口。
// 用法：node proxy.mjs <targetPort> <secretBase64url>
import { createHash, createHmac } from "node:crypto";
import http from "node:http";

const TARGET_PORT = Number(process.argv[2] ?? 52463);
const SECRET_B64 = process.argv[3];
const LISTEN_PORT = 54199;
const AUTHORITY = `127.0.0.1:${TARGET_PORT}`;
const b64url = (buf) => buf.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");

const secret = Buffer.from(SECRET_B64.replaceAll("-", "+").replaceAll("_", "/"), "base64");
const cookieName = "dsh-auth-" + b64url(createHash("sha256").update(AUTHORITY).digest());
const issuedAt = Date.now();
const expiresAt = issuedAt + 30 * 1440 * 60 * 1000;
const body = b64url(Buffer.from(JSON.stringify({ version: 1, authority: AUTHORITY, issuedAt, expiresAt }), "utf8"));
const sig = b64url(createHmac("sha256", secret).update(body).digest());
const COOKIE = `${cookieName}=v1.${body}.${sig}`;
console.log("cookie name:", cookieName.slice(0, 24) + "…");

const server = http.createServer((req, res) => {
	const headers = { ...req.headers, host: AUTHORITY, cookie: COOKIE };
	console.log(">>", req.method, req.url, "| ws:", req.headers.upgrade ?? "-");
	const upstream = http.request(
		{ host: "127.0.0.1", port: TARGET_PORT, path: req.url, method: req.method, headers },
		(ur) => {
			const ctype = String(ur.headers["content-type"] ?? "");
			if (ctype.includes("text/html")) {
				const chunks = [];
				ur.on("data", (c) => chunks.push(c));
				ur.on("end", () => {
					let html = Buffer.concat(chunks).toString("utf8");
					html = html.replaceAll(`127.0.0.1:${TARGET_PORT}`, `127.0.0.1:${LISTEN_PORT}`);
					const outHeaders = { ...ur.headers };
					delete outHeaders["transfer-encoding"];
					outHeaders["content-length"] = Buffer.byteLength(html);
					res.writeHead(ur.statusCode, outHeaders);
					res.end(html);
				});
			} else {
				res.writeHead(ur.statusCode, ur.headers);
				ur.pipe(res);
			}
		},
	);
	upstream.on("error", (e) => {
		res.writeHead(502);
		res.end(String(e));
	});
	req.pipe(upstream);
});

// WebSocket / upgrade 隧道：改写 Host + 注入 cookie 后原样转发并双向接管
server.on("upgrade", (req, socket, head) => {
	console.log(">> WS upgrade", req.url);
	const lines = [];
	for (const [k, v] of Object.entries(req.headers)) {
		if (["host", "connection", "upgrade", "sec-websocket-key", "sec-websocket-version", "sec-websocket-extensions", "sec-websocket-protocol"].includes(k)) {
			lines.push(`${k.replace(/(^|-)(\w)/g, (m) => m.toUpperCase())}: ${k === "host" ? AUTHORITY : v}`);
		}
	}
	const outbound = http.request({
		host: "127.0.0.1",
		port: TARGET_PORT,
		path: req.url,
		headers: { ...req.headers, host: AUTHORITY, cookie: COOKIE },
	});
	outbound.end();
	outbound.on("upgrade", (ur, usocket, uhead) => {
		const respLines = [`HTTP/1.1 101 Switching Protocols`];
		for (const [k, v] of Object.entries(ur.headers)) respLines.push(`${k}: ${v}`);
		socket.write(respLines.join("\r\n") + "\r\n\r\n");
		if (uhead?.length) socket.write(uhead);
		usocket.pipe(socket);
		socket.pipe(usocket);
		socket.on("error", () => {});
		usocket.on("error", () => {});
	});
	outbound.on("error", () => socket.destroy());
});

server.listen(LISTEN_PORT, "127.0.0.1", () => console.log(`proxy :${LISTEN_PORT} → :${TARGET_PORT}`));
