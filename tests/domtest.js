/* 竹知了 —— 端到端冒烟：用最小 DOM 桩在 Node 中运行 init + 主循环 + 渲染若干帧
 * 用法：node _domtest.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);

/* ---------- 最小 DOM / window 桩 ---------- */
// ctx 方法被调用后应返回一个带 addColorStop 的对象（供渐变使用）
function makeCtxFn(){
  const ret = { addColorStop(){} };
  const f = function(){ return ret; };
  f.ret = ret;
  return f;
}
const ctxStub = new Proxy({}, {
  get(t, p){
    if (p === 'canvas') return {};
    if (p in t) return t[p];
    t[p] = makeCtxFn();
    return t[p];
  },
  set(t, p, v){ t[p] = v; return true; }
});

function makeEl(id){
  const el = {
    id, textContent: '', innerHTML: '', value: '', className: '', style: {},
    dataset: {},
    children: [],
    classList: {
      _s: new Set(),
      add(c){ this._s.add(c); },
      remove(c){ this._s.delete(c); },
      toggle(c, f){ if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else { f ? this._s.add(c) : this._s.delete(c); } }
    },
    addEventListener(){},
    removeEventListener(){},
    appendChild(ch){ this.children.push(ch); },
    removeChild(ch){ const i = this.children.indexOf(ch); if (i >= 0) this.children.splice(i, 1); },
    querySelectorAll(){ return []; },
    getContext(){ return ctxStub; },
    setPointerCapture(){},
    select(){},
    parentNode: null
  };
  return el;
}

const els = {};
const localStorageMem = {};
global.localStorage = {
  getItem: k => (k in localStorageMem ? localStorageMem[k] : null),
  setItem: (k, v) => { localStorageMem[k] = String(v); },
  removeItem: k => { delete localStorageMem[k]; }
};
global.performance = global.performance || { now: () => Date.now() };
// 页面脚本使用全局 requestAnimationFrame（浏览器中即 window 属性）
global.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);
global.document = {
  readyState: 'complete',
  body: makeEl('body'),
  getElementById(id){ return els[id] || (els[id] = makeEl(id)); },
  createElement(){ return makeEl(''); },
  addEventListener(){},
  querySelectorAll(){ return []; }
};
global.window = {
  addEventListener(){},
  devicePixelRatio: 2,
  innerWidth: 390, innerHeight: 780,
  requestAnimationFrame(cb){ setTimeout(() => cb(performance.now()), 16); },
  isSecureContext: true,
  AudioContext: undefined,
  DeviceOrientationEvent: undefined,
  DeviceMotionEvent: undefined,
  location: { href: 'file:///test/index.html' }
};
// Node 24 自带只读 global.navigator（share/clipboard 均为 undefined，无需覆盖）

/* ---------- 运行页面脚本 ---------- */
const mod = { exports: {} };
const fn = new Function('module', 'exports', m[1]);
fn(mod, mod.exports);

console.log('init 已执行，等待主循环运行若干帧…');
setTimeout(() => {
  const st = mod.exports && mod.exports.makeState ? null : null; // 游戏内部 state 无法直接读取，改从行为断言
  console.log('主循环已运行（未抛出异常即通过）✅');
  process.exit(0);
}, 400);

// 若帧回调内抛错，Node 默认打印堆栈并以非零码退出 → 测试失败
