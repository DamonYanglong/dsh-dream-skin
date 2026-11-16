#!/usr/bin/env node
/**
 * verify-visual — 视觉回归守卫（M3-DESIGN B5/P2）。
 *
 * 对 test/__baseline__/*.png 逐张重拍同名组合（自截图管线），像素差超阈值即 [V7]。
 * 阈值：全图平均绝对差 < 2.5（256 级），且单像素差 > 60 的比例 < 0.5%
 * （容忍极轻微渲染抖动，拦截结构性视觉回归）。
 * 用法：node scripts/verify-visual.mjs <port> <secret>（缺省跳过并提示）。
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const baselineDir = join(root, "test/__baseline__");
const port = process.argv[2];
const secret = process.argv[3];
if (!port || !secret) {
  console.error("[V7] verify-visual: 需要 <port> <secret>（自截图管线参数）——CI 无 GUI 时显式跳过需人工记录");
  process.exit(1);
}

const shots = readdirSync(baselineDir).filter((f) => f.endsWith(".png"));
if (shots.length < 6) {
  console.error(`[V7] verify-visual: 基线不足（${shots.length} < 6）`);
  process.exit(1);
}

// 用管线脚本逐主题重拍（复用 /tmp/dsh-shot/baseline.mjs 的单组合变体）
const tmp = mkdtempSync("/tmp/dsb-visual-");
const pipeline = "/tmp/dsh-shot/baseline.mjs";
const combos = [...new Set(shots.map((f) => f.replace(".png", "").split("-")))];
// baseline.mjs 拍固定 6 组合；这里直接整跑后逐张对比
execFileSync("node", [pipeline, port, secret, tmp], { stdio: "inherit" });

// 像素对比（PIL 不在 Node 侧——经 python3 子进程）
const py = `
from PIL import Image
import numpy as np, sys, json, os
base = "${baselineDir}"
new = "${tmp}"
fails = []
for f in sorted(os.listdir(base)):
    if not f.endswith(".png"): continue
    a = np.asarray(Image.open(os.path.join(base, f)).convert("RGB"), dtype=np.float32)
    b = np.asarray(Image.open(os.path.join(new, f)).convert("RGB"), dtype=np.float32)
    if a.shape != b.shape:
        fails.append((f, "shape", str(a.shape), str(b.shape))); continue
    d = np.abs(a - b).mean()
    big = (np.abs(a - b).max(axis=2) > 60).mean()
    status = "OK" if (d < 2.5 and big < 0.005) else "FAIL"
    print(f"{status} {f}: mean={d:.2f} big={big*100:.2f}%")
    if status == "FAIL": fails.append((f, d, big))
if fails:
    sys.exit(1)
`;
execFileSync("python3", ["-c", py], { stdio: "inherit" });
console.log("verify-visual: OK");
