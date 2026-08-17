/* 竹知了 —— Node 冒烟测试（不依赖浏览器，仅验证纯逻辑）
 * 用法：node _smoke.js
 * 验证：1) 采样合成无 NaN、能量正常、无缝循环衔接
 *       2) 自动甩模式能加速到发声转速并累计圈数
 *       3) 松手后自然减速，最终垂落在绳子最低处
 */
'use strict';
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('FAIL: 未找到 <script> 块'); process.exit(1); }

// 用假 module 环境执行页面脚本（window/document 不存在 → 不启动游戏）
const mod = { exports: {} };
const fn = new Function('module', 'exports', m[1]);
fn(mod, mod.exports);
const { CFG, makeState, physicsResize, physicsAnchor, physicsStep, buildSample } = mod.exports;

let fails = 0;
function ok(cond, msg) {
  if (cond) console.log('  ok -', msg);
  else { console.error('  FAIL -', msg); fails++; }
}

/* ---------- 1. 采样 ---------- */
console.log('[1] 采样合成 buildSample');
const sr = 44100;
const buf = buildSample(sr);
ok(buf instanceof Float32Array, '返回 Float32Array');
ok(buf.length === Math.floor(sr * 1.72), '长度 = 1.72s（' + buf.length + ' 采样）');
let peak = 0, nan = false, rms = 0;
for (let i = 0; i < buf.length; i++) {
  if (!isFinite(buf[i])) nan = true;
  peak = Math.max(peak, Math.abs(buf[i]));
  rms += buf[i] * buf[i];
}
rms = Math.sqrt(rms / buf.length);
ok(!nan, '无 NaN/Infinity');
ok(peak > 0.4 && peak <= 1.0, '峰值在合理范围 peak=' + peak.toFixed(3));
ok(rms > 0.02, '有足够能量 rms=' + rms.toFixed(3));
const seam = Math.abs(buf[buf.length - 1] - buf[0]);
ok(seam < 0.05, '循环衔接连续 |tail-head|=' + seam.toFixed(4));

/* ---------- 2. 自动甩加速 ---------- */
console.log('[2] 自动甩模式（2.35 圈/秒）');
const st = makeState();
physicsResize(st, 500, 800);
st.anchor.x = 250; st.anchor.y = 336;
st.bob.x = st.anchor.x; st.bob.y = st.anchor.y + st.L;
st.mode = 'auto';
let revs = 0, maxRps = 0, nan2 = false;
const N1 = 240 * 3;
for (let i = 0; i < N1; i++) {
  const dtf = 1 / 240;
  st.time += dtf;
  const ax0 = st.anchor.x, ay0 = st.anchor.y;
  physicsAnchor(st, dtf);
  const avx = (st.anchor.x - ax0) / dtf, avy = (st.anchor.y - ay0) / dtf;
  physicsStep(st, 1 / 240, avx, avy, () => revs++);
  if (!isFinite(st.bob.x) || !isFinite(st.bob.y) || !isFinite(st.bob.vx) || !isFinite(st.bob.vy)) nan2 = true;
  maxRps = Math.max(maxRps, st.revPerSec);
}
ok(!nan2, '数值稳定（无 NaN）');
ok(maxRps > 1.8, '达到高转速 maxRps=' + maxRps.toFixed(2) + '（阈值 1.8）');
ok(st.sounding, '绳子绷紧且发声 sounding=' + st.sounding + ' rps=' + st.revPerSec.toFixed(2) + ' taut=' + st.taut);
ok(revs >= 5, '累计圈数 >= 5，实际 ' + revs);

/* ---------- 3. 松手自然减速垂落 ---------- */
console.log('[3] 松手后自然减速');
st.mode = 'manual';
st.finger = null;
let nan3 = false, maxDist = 0;
const N2 = 240 * 12;
for (let i = 0; i < N2; i++) {
  const dtf = 1 / 240;
  st.time += dtf;
  const ax0 = st.anchor.x, ay0 = st.anchor.y;
  physicsAnchor(st, dtf);
  const avx = (st.anchor.x - ax0) / dtf, avy = (st.anchor.y - ay0) / dtf;
  physicsStep(st, 1 / 240, avx, avy, null);
  if (!isFinite(st.bob.x) || !isFinite(st.bob.y) || !isFinite(st.bob.vx) || !isFinite(st.bob.vy)) nan3 = true;
  const d = Math.hypot(st.bob.x - st.anchor.x, st.bob.y - st.anchor.y);
  maxDist = Math.max(maxDist, d);
}
ok(!nan3, '数值稳定（无 NaN）');
const spd = Math.hypot(st.bob.vx, st.bob.vy);
ok(spd < 40, '已基本静止 speed=' + spd.toFixed(1) + ' px/s');
const dist = Math.hypot(st.bob.x - st.anchor.x, st.bob.y - st.anchor.y);
ok(Math.abs(dist - st.L) < 5, '垂落在绳长位置 dist=' + dist.toFixed(2) + ' L=' + st.L.toFixed(2));
ok(st.bob.y > st.anchor.y - 1, '位于锚点下方（重力最低处）');

console.log(fails === 0 ? '\n全部通过 ✅' : '\n存在 ' + fails + ' 项失败 ❌');
process.exit(fails === 0 ? 0 : 1);
