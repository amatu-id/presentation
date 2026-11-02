// Slideshow: transitions (incl. Morph), PowerPoint-style animation steps, presenter view with an audience window,
// pen / highlighter / laser, slide navigator, rehearse timings, kiosk loop.
import { E } from './state.js';
import { h, icon, toast, dialog, confirmDlg } from './ui.js';
import { renderSlide, fitAll } from './render.js';
import { slideTitle } from './model.js';

// ---------- animation effects ----------
function frames(a, node, W, H) {
  const base = node.style.transform || '';
  const T = t => (t ? t + ' ' : '') + base;
  const r = { left: node.offsetLeft, top: node.offsetTop, w: node.offsetWidth, h: node.offsetHeight };
  const dir = a.dir || 'bottom';
  const off = { bottom: `translateY(${H - r.top + 10}px)`, top: `translateY(${-(r.top + r.h + 10)}px)`, left: `translateX(${-(r.left + r.w + 10)}px)`, right: `translateX(${W - r.left + 10}px)` }[dir];
  const clipFrom = { bottom: 'inset(100% 0 0 0)', top: 'inset(0 0 100% 0)', left: 'inset(0 100% 0 0)', right: 'inset(0 0 0 100%)' }[dir];
  switch (a.eff) {
    case 'appear': return [[{ opacity: 0 }, { opacity: 1 }], 1];
    case 'fade': return [[{ opacity: 0 }, { opacity: 1 }]];
    case 'fly': return [[{ transform: T(off) }, { transform: T('') }], 0, 'cubic-bezier(.2,.8,.2,1)'];
    case 'float': return [[{ opacity: 0, transform: T('translateY(48px)') }, { opacity: 1, transform: T('') }], 0, 'cubic-bezier(.2,.8,.2,1)'];
    case 'zoom': return [[{ opacity: 0, transform: T('scale(.3)') }, { opacity: 1, transform: T('') }], 0, 'cubic-bezier(.2,.8,.2,1)'];
    case 'grow': return [[{ opacity: 0, transform: T('scale(.1) rotate(-200deg)') }, { opacity: 1, transform: T('') }]];
    case 'wipe': return [[{ clipPath: clipFrom }, { clipPath: 'inset(0 0 0 0)' }]];
    case 'split': return [[{ clipPath: 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0 0 0)' }]];
    case 'bounce': return [[{ opacity: 0, transform: T('translateY(-260px)'), offset: 0 }, { opacity: 1, transform: T(''), offset: .5 }, { transform: T('translateY(-50px)'), offset: .68 }, { transform: T(''), offset: .82 }, { transform: T('translateY(-14px)'), offset: .92 }, { opacity: 1, transform: T('') }], 0, 'ease-in'];
    case 'rise': return [[{ opacity: 0, transform: T('translateY(80px)') }, { opacity: 1, transform: T('translateY(-6px)'), offset: .85 }, { opacity: 1, transform: T('') }], 0, 'ease-out'];
    case 'spin': return [[{ opacity: 0, transform: T('rotate(-360deg) scale(.4)') }, { opacity: 1, transform: T('') }], 0, 'ease-out'];
    case 'blur': return [[{ opacity: 0, filter: 'blur(24px)' }, { opacity: 1, filter: 'blur(0)' }]];
    case 'pulse': return [[{ transform: T('') }, { transform: T('scale(1.12)') }, { transform: T('') }]];
    case 'spin360': return [[{ transform: T('') }, { transform: T('rotate(360deg)') }]];
    case 'growshrink': return [[{ transform: T('') }, { transform: T('scale(1.35)') }, { transform: T('') }]];
    case 'teeter': return [[{ transform: T('') }, { transform: T('rotate(6deg)') }, { transform: T('rotate(-6deg)') }, { transform: T('rotate(4deg)') }, { transform: T('rotate(-3deg)') }, { transform: T('') }]];
    case 'flash': return [[{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }, { opacity: 0 }, { opacity: 1 }]];
    case 'wave': return [[{ transform: T('') }, { transform: T('translateY(-14px) skewX(-6deg)') }, { transform: T('translateY(6px) skewX(4deg)') }, { transform: T('') }]];
    case 'bold': return [[{ filter: 'none', transform: T('') }, { filter: 'brightness(1.25) drop-shadow(0 0 8px rgba(255,255,255,.6))', transform: T('scale(1.06)') }, { filter: 'none', transform: T('') }]];
    case 'disappear': return [[{ opacity: 1 }, { opacity: 0 }], 1];
    case 'fadeout': return [[{ opacity: 1 }, { opacity: 0 }]];
    case 'flyout': return [[{ transform: T('') }, { transform: T(off) }], 0, 'cubic-bezier(.6,0,.8,.2)'];
    case 'floatout': return [[{ opacity: 1, transform: T('') }, { opacity: 0, transform: T('translateY(-48px)') }]];
    case 'zoomout': return [[{ opacity: 1, transform: T('') }, { opacity: 0, transform: T('scale(.3)') }]];
    case 'wipeout': return [[{ clipPath: 'inset(0 0 0 0)' }, { clipPath: clipFrom }]];
    case 'sinkout': return [[{ opacity: 1, transform: T('') }, { opacity: 0, transform: T('translateY(80px)') }], 0, 'ease-in'];
    default: return [[{ opacity: 0 }, { opacity: 1 }]];
  }
}
const isIn = a => a.kind === 'in';
// Initial state of a slide before its animations: entrance targets are hidden.
function prepare(root, anims) {
  const seen = new Set();
  for (const a of anims) {
    if (seen.has(a.el)) continue;
    seen.add(a.el);
    const n = root.querySelector(`.el[data-id="${a.el}"]`);
    if (n && isIn(a)) {
      if (a.byPara) paras(n).forEach(p => { p.style.visibility = 'hidden'; });
      else n.style.visibility = 'hidden';
    }
  }
}
const paras = n => [...n.querySelectorAll('.txi > p, .txi > ul > li, .txi > ol > li')];
// Final state (when stepping backwards onto a slide): entrance shown, exit hidden.
function finalState(root, anims) {
  for (const a of anims) {
    const n = root.querySelector(`.el[data-id="${a.el}"]`);
    if (!n) continue;
    if (isIn(a)) { n.style.visibility = ''; paras(n).forEach(p => { p.style.visibility = ''; }); }
    if (a.kind === 'out') n.style.visibility = 'hidden';
  }
}
// Steps: a 'click' item starts a new step; 'with' joins at the previous start; 'after' starts when the previous ends.
export function buildSteps(anims) {
  const steps = [];
  let cur = null, prevStart = 0, prevEnd = 0;
  for (const a of anims) {
    if (a.start === 'click' || !cur) { cur = { auto: a.start !== 'click', items: [] }; steps.push(cur); prevStart = 0; prevEnd = 0; if (a.start === 'click') { prevStart = prevEnd = 0; } }
    const at = a.start === 'after' ? prevEnd : prevStart;
    const len = (a.delay || 0) + (a.dur || 0) * (a.kind === 'emph' ? (a.rep || 1) : 1) * (a.byPara ? 1.6 : 1);
    cur.items.push({ a, at });
    prevStart = at; prevEnd = Math.max(prevEnd, at + len);
    cur.len = Math.max(cur.len || 0, at + len);
  }
  return steps;
}
function playItem(root, it, W, H, speed = 1) {
  const { a, at } = it;
  const n = root.querySelector(`.el[data-id="${a.el}"]`);
  if (!n) return [];
  const targets = a.byPara && (isIn(a) || a.kind === 'out') ? paras(n) : [n];
  if (a.byPara && isIn(a)) n.style.visibility = '';
  return targets.map((t, i) => {
    const [kf, instant, easing] = frames(a, t === n ? n : t, W, H);
    const dur = instant ? 1 : Math.max(1, (a.dur || .5) * 1000 / speed);
    const delay = ((at + (a.delay || 0)) * 1000 + i * dur * .6) / speed;
    const anim = t.animate(kf, { duration: dur, delay, easing: easing || 'ease', fill: 'both', iterations: a.kind === 'emph' ? (a.rep || 1) : 1 });
    if (isIn(a)) setTimeout(() => { t.style.visibility = ''; }, delay);
    if (a.kind === 'out') anim.finished.then(() => { t.style.visibility = 'hidden'; }).catch(() => { });
    return anim;
  });
}
// Editor preview: plays all given animations in order (clicks become "after previous").
export function playAnims(root, anims, o = {}) {
  if (!root || !anims.length) return () => { };
  const list = anims.map((a, i) => ({ ...a, start: i === 0 ? 'with' : a.start === 'click' ? 'after' : a.start }));
  const all = [];
  root.querySelectorAll('.el').forEach(n => { n.style.visibility = ''; });
  prepare(root, list);
  const steps = buildSteps(list);
  const W = root.offsetWidth, H = root.offsetHeight;
  steps.forEach(st => st.items.forEach(it => all.push(...playItem(root, it, W, H))));
  let done = false;
  const stop = () => { if (done) return; done = true; all.forEach(a => a.cancel()); root.querySelectorAll('.el').forEach(n => { n.style.visibility = ''; }); root.querySelectorAll('.txi > *, .txi li').forEach(n => { n.style.visibility = ''; }); };
  Promise.all(all.map(a => a.finished.catch(() => { }))).then(() => setTimeout(() => { if (o.preview) E.render(); stop(); }, 600));
  return stop;
}

// ---------- transitions ----------
function transition(stage, oldN, newN, t, W, H, oldSlide, newSlide) {
  const type = t?.type || 'none';
  const dur = Math.max(100, (t?.dur ?? .7) * 1000);
  if (!oldN || type === 'none') { oldN?.remove(); return Promise.resolve(); }
  const dir = t.dir || 'left';
  const vec = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
  // translate after the base transform so it is in slide pixels (the base scales the slide to the screen)
  const tx = k => `translate(${vec[0] * k * W}px, ${vec[1] * k * H}px)`;
  const bt = n => n.style.transform;
  const o = { duration: dur, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' };
  let anims = [];
  const A = (n, kf, opt = o) => anims.push(n.animate(kf, opt));
  const ob = bt(oldN), nb = bt(newN);
  switch (type) {
    case 'fade': A(newN, [{ opacity: 0 }, { opacity: 1 }]); break;
    case 'dissolve': A(newN, [{ opacity: 0, filter: 'blur(12px) saturate(.4)' }, { opacity: 1, filter: 'none' }]); break;
    case 'push': A(oldN, [{ transform: ob }, { transform: ob + ' ' + tx(1) }]); A(newN, [{ transform: nb + ' ' + tx(-1) }, { transform: nb }]); break;
    case 'cover': A(newN, [{ transform: nb + ' ' + tx(-1) }, { transform: nb }]); break;
    case 'uncover': stage.append(oldN); A(oldN, [{ transform: ob }, { transform: ob + ' ' + tx(1) }]); break;
    case 'wipe': A(newN, [{ clipPath: { left: 'inset(0 0 0 100%)', right: 'inset(0 100% 0 0)', up: 'inset(100% 0 0 0)', down: 'inset(0 0 100% 0)' }[dir] }, { clipPath: 'inset(0 0 0 0)' }]); break;
    case 'split': A(newN, [{ clipPath: 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0 0 0)' }]); break;
    case 'zoom': A(newN, [{ opacity: 0, transform: nb + ' scale(.6)' }, { opacity: 1, transform: nb }]); A(oldN, [{ opacity: 1, transform: ob }, { opacity: 0, transform: ob + ' scale(1.25)' }]); break;
    case 'flip': {
      const half = { ...o, duration: dur / 2 };
      A(oldN, [{ transform: ob + ' perspective(2000px) rotateY(0)' }, { transform: ob + ' perspective(2000px) rotateY(90deg)' }], half);
      A(newN, [{ transform: nb + ' perspective(2000px) rotateY(-90deg)' }, { transform: nb + ' perspective(2000px) rotateY(0)' }], { ...half, delay: dur / 2 });
      break;
    }
    case 'cube': {
      const ax = vec[0] ? 'Y' : 'X', sgn = vec[0] ? -vec[0] : vec[1];
      const d = (vec[0] ? W : H) / 2;
      A(oldN, [{ transform: `${ob} perspective(${W * 2}px) translateZ(-${d}px) rotate${ax}(0) translateZ(${d}px)` }, { transform: `${ob} perspective(${W * 2}px) translateZ(-${d}px) rotate${ax}(${90 * sgn}deg) translateZ(${d}px)` }]);
      A(newN, [{ transform: `${nb} perspective(${W * 2}px) translateZ(-${d}px) rotate${ax}(${-90 * sgn}deg) translateZ(${d}px)` }, { transform: `${nb} perspective(${W * 2}px) translateZ(-${d}px) rotate${ax}(0) translateZ(${d}px)` }]);
      break;
    }
    case 'morph': anims = morph(oldN, newN, oldSlide, newSlide, o); break;
    default: break;
  }
  return Promise.all(anims.map(a => a.finished.catch(() => { }))).then(() => { oldN.remove(); anims.forEach(a => { try { a.commitStyles?.(); } catch { /* */ } a.cancel(); }); });
}
// Morph: elements that share an origin (duplicated slides keep `mid`) move from old to new geometry.
function morph(oldN, newN, os, ns, o) {
  const key = e => e.mid || e.id;
  const anims = [];
  const used = new Set();
  for (const e of ns?.els || []) {
    const m = (os?.els || []).find(x => !used.has(x.id) && (key(x) === key(e) || x.id === e.mid || x.mid === e.id));
    const nn = newN.querySelector(`.el[data-id="${e.id}"]`);
    if (!nn) continue;
    if (!m) { anims.push(nn.animate([{ opacity: 0 }, { opacity: 0, offset: .4 }, { opacity: 1 }], o)); continue; }
    used.add(m.id);
    const on = oldN.querySelector(`.el[data-id="${m.id}"]`);
    if (!on) continue;
    on.style.visibility = 'hidden';
    const from = { left: on.style.left, top: on.style.top, width: on.style.width, height: on.style.height, transform: on.style.transform || 'none', opacity: on.style.opacity || 1 };
    const to = { left: nn.style.left, top: nn.style.top, width: nn.style.width, height: nn.style.height, transform: nn.style.transform || 'none', opacity: nn.style.opacity || 1 };
    anims.push(nn.animate([from, to], { ...o, easing: 'cubic-bezier(.45,0,.2,1)' }));
  }
  anims.push(oldN.animate([{ opacity: 1 }, { opacity: 0 }], { ...o, duration: o.duration * .6 }));
  anims.push(newN.animate([{ background: getComputedStyle(oldN).background }, { background: getComputedStyle(newN).background }], o));
  return anims;
}

export function previewTransition(i) {
  const d = E.doc, s = d.slides[i];
  if (!E.stage || !s) return;
  const prev = d.slides[i - 1] || { ...s, els: [], bg: { t: 'color', c: '#000000' } };
  const k = E.zoom;
  const box = h('div', { class: 'trans-prev' });
  const mk = sl => { const n = renderSlide(d, sl, { idx: d.slides.indexOf(sl), sfx: 'tp' + Math.random().toString(36).slice(2, 5) }); n.style.transformOrigin = '0 0'; n.style.transform = `scale(${k})`; return n; };
  const a = mk(prev), b = mk(s);
  box.append(a, b);
  E.stage.append(box);
  fitAll(a); fitAll(b);
  const anims = s.anims || [];
  prepare(b, anims);
  transition(box, a, b, s.trans, d.page.w, d.page.h, prev, s).then(() => {
    const st = buildSteps(anims).filter(x => x.auto)[0];
    if (st) st.items.forEach(it => playItem(b, it, d.page.w, d.page.h));
    setTimeout(() => box.remove(), st ? st.len * 1000 + 500 : 400);
  });
}

// ---------- slideshow ----------
let S = null;
export async function startShow(from = 0, o = {}) {
  if (S) return;
  if (E.editing) E.endEdit();
  const d = E.doc;
  const order = d.slides.map((s, i) => i).filter(i => !d.slides[i].skip || i === from);
  if (!order.length) return toast('Semua slide dilewati');
  let pos = Math.max(0, order.indexOf(from));
  if (pos < 0) pos = 0;
  const W = d.page.w, H = d.page.h;
  S = { d, order, pos, step: 0, steps: [], node: null, timers: [], ink: new Map(), tool: null, black: null, t0: Date.now(), slideT0: Date.now(), times: {}, paused: 0, pauseAt: 0, o, screens: [] };

  const root = h('div', { class: 'show-root' + (o.presenter ? ' presenter' : '') });
  document.body.append(root);
  S.root = root;
  if (o.presenter) {
    const aud = window.open('', 'amatu-audience', 'popup,width=1280,height=760');
    if (aud && !aud.closed) {
      aud.document.open();
      const base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
      aud.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${d.title.replace(/</g, '')} — Tayangan</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..24,300..500,0..1,0&display=block"><link rel="stylesheet" href="${base}css/app.css"><link rel="stylesheet" href="${base}css/slides.css">${[...document.querySelectorAll('link[href*="fonts.googleapis.com/css2?family="]')].map(l => l.outerHTML).join('')}</head><body class="aud"><div class="show-root aud-root"><div class="show-stage"></div><div class="aud-hint">Klik di sini lalu tekan F untuk layar penuh</div></div></body></html>`);
      aud.document.close();
      S.aud = aud;
      const ar = aud.document.querySelector('.aud-root');
      S.screens.push({ win: aud, stage: ar.querySelector('.show-stage'), root: ar });
      aud.addEventListener('keydown', onKey);
      aud.document.addEventListener('click', ev => { if (ev.target.closest('iframe, a')) return; aud.document.querySelector('.aud-hint')?.remove(); next(); });
      aud.addEventListener('beforeunload', () => { if (S?.aud === aud) S.aud = null; });
    } else toast('Jendela penonton diblokir browser. Izinkan pop-up untuk situs ini.');
    buildConsole(root);
  } else {
    const stage = h('div', { class: 'show-stage' });
    root.append(stage, controls());
    S.screens.push({ win: window, stage, root, main: true });
    root.requestFullscreen?.().catch(() => { });
  }
  root.addEventListener('click', onClick);
  root.addEventListener('contextmenu', ev => { ev.preventDefault(); prev(); });
  document.addEventListener('keydown', onKey, true);
  addEventListener('resize', fitScreens);
  document.addEventListener('fullscreenchange', onFs);
  show(pos, 0, true);
  if (o.rehearse) toast('Latihan: waktu setiap slide dicatat', { ms: 2500 });
}

function stopTimers() { S.timers.forEach(clearTimeout); S.timers = []; }
function fitScreens() {
  if (!S) return;
  for (const sc of S.screens) {
    const r = sc.stage.getBoundingClientRect();
    const k = Math.min(r.width / S.d.page.w, r.height / S.d.page.h) || 1;
    sc.k = k;
    sc.stage.querySelectorAll(':scope > .sl').forEach(n => { n.style.transform = `translate(-50%, -50%) scale(${k})`; });
    sc.stage.querySelectorAll(':scope > canvas.ink').forEach(c => sizeInk(sc, c));
  }
  if (S.o.presenter) renderConsole();
}
function slideNode(i, sfx) {
  const d = S.d, s = d.slides[i];
  const n = renderSlide(d, s, { live: true, idx: i, sfx });
  n.classList.add('show-sl');
  return n;
}
// Show slide at order position p. stepTo: how many animation steps are already done (Infinity = end state).
function show(p, stepTo = 0, first = false) {
  const d = S.d;
  stopTimers();
  recordTime();
  if (p >= S.order.length) {
    if (d.show.loop || d.show.kiosk) p = 0;
    else { endScreen(); return; }
  }
  if (p < 0) p = 0;
  const prevIdx = S.order[S.pos];
  const prevSlide = d.slides[prevIdx];
  const backwards = p < S.pos;
  S.pos = p;
  const i = S.order[p], s = d.slides[i];
  S.steps = buildSteps(s.anims || []);
  S.step = 0;
  S.ended = false;
  S.slideT0 = Date.now();
  for (const sc of S.screens) {
    const old = sc.stage.querySelector(':scope > .sl:not(.leaving)');
    sc.stage.querySelector('.show-end')?.remove();
    const n = slideNode(i, 's' + (sc.main ? 'm' : 'a') + p);
    sc.stage.querySelectorAll(':scope > canvas.ink').forEach(c => c.remove());
    sc.stage.append(n);
    const r = sc.stage.getBoundingClientRect();
    sc.k = Math.min(r.width / d.page.w, r.height / d.page.h) || 1;
    n.style.transform = `translate(-50%, -50%) scale(${sc.k})`;
    fitAll(n);
    sc.node = n;
    if (stepTo === Infinity) finalState(n, s.anims || []); else prepare(n, s.anims || []);
    if (old) { old.classList.add('leaving'); old.style.pointerEvents = 'none'; }
    const t = first || backwards ? null : s.trans;
    transition(sc.stage, old, n, t, d.page.w, d.page.h, prevSlide, s).then(() => { sc.stage.querySelectorAll(':scope > .sl.leaving').forEach(x => x.remove()); });
    addInk(sc, i);
  }
  if (stepTo === Infinity) S.step = S.steps.length;
  else {
    const tdur = first || backwards ? 0 : (s.trans?.type && s.trans.type !== 'none' ? (s.trans.dur ?? .7) : 0);
    S.timers.push(setTimeout(() => runAuto(), tdur * 1000));
  }
  if (S.o.presenter) renderConsole();
  updateCounter();
}
// Steps flagged auto (start with/after previous) play without a click; then the slide may auto-advance.
function runAuto() {
  if (!S) return;
  while (S.step < S.steps.length && S.steps[S.step].auto) playStep();
  scheduleAdvance();
}
function scheduleAdvance() {
  const s = S.d.slides[S.order[S.pos]];
  const auto = s.trans?.auto ?? (S.d.show.auto ? S.d.show.autoSec || 5 : null);
  if (auto == null || S.o.rehearse || S.pausedShow) return;
  if (S.step < S.steps.length) { const len = S.steps.slice(S.step).reduce((a, st) => a + (st.len || 0), 0); S.timers.push(setTimeout(() => { while (S && S.step < S.steps.length) playStep(); scheduleAdvance(); }, Math.max(auto * 1000, 100))); void len; return; }
  S.timers.push(setTimeout(() => next(), auto * 1000));
}
function playStep() {
  const st = S.steps[S.step++];
  if (!st) return;
  for (const sc of S.screens) st.items.forEach(it => playItem(sc.node, it, S.d.page.w, S.d.page.h));
  if (S.o.presenter) renderConsole();
}
function next() {
  if (!S) return;
  if (S.ended) { endShow(); return; }
  if (S.step < S.steps.length) { stopTimers(); playStep(); while (S.step < S.steps.length && S.steps[S.step].auto) playStep(); scheduleAdvance(); return; }
  show(S.pos + 1);
}
function prev() {
  if (!S) return;
  if (S.ended) { S.ended = false; show(S.order.length - 1, Infinity); return; }
  if (S.pos === 0) { show(0, 0, true); return; }
  show(S.pos - 1, Infinity);
}
function goTo(i) {
  if (!S) return;
  let p = S.order.indexOf(i);
  if (p < 0) { S.order.push(i); S.order.sort((a, b) => a - b); p = S.order.indexOf(i); }
  show(p, 0);
}
function endScreen() {
  S.ended = true;
  for (const sc of S.screens) {
    sc.stage.querySelectorAll(':scope > .sl, :scope > canvas.ink').forEach(x => x.remove());
    sc.stage.append(h('div', { class: 'show-end' }, 'Akhir tayangan slide. Klik untuk keluar.'));
  }
  if (S.o.presenter) renderConsole();
}
function recordTime() {
  if (!S || S.ended) return;
  const i = S.order[S.pos];
  if (i == null) return;
  S.times[i] = (S.times[i] || 0) + (Date.now() - S.slideT0) / 1000;
}
async function endShow() {
  if (!S) return;
  recordTime();
  const st = S;
  S = null;
  stopTimersOf(st);
  document.removeEventListener('keydown', onKey, true);
  removeEventListener('resize', fitScreens);
  document.removeEventListener('fullscreenchange', onFs);
  if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
  st.aud?.close();
  st.root.remove();
  clearInterval(st.clock);
  if (st.o.rehearse) {
    const total = Object.values(st.times).reduce((a, b) => a + b, 0);
    if (await confirmDlg('Simpan pengaturan waktu?', `Total waktu ${fmtT(total)}. Simpan durasi setiap slide sebagai "maju otomatis"?`, 'Simpan')) {
      for (const [i, t] of Object.entries(st.times)) { const s = st.d.slides[i]; if (s) s.trans = { type: 'none', dur: .7, ...(s.trans || {}), auto: Math.round(t * 10) / 10 }; }
      E.commit('Pengaturan waktu', 'all');
    }
  }
  const last = st.order[st.pos];
  if (last != null && E.doc === st.d) E.goSlide(Math.min(last, st.d.slides.length - 1));
}
function stopTimersOf(st) { st.timers.forEach(clearTimeout); }
function onFs() { if (S && !S.o.presenter && !document.fullscreenElement && S.wasFs) endShow(); if (document.fullscreenElement) S && (S.wasFs = true); setTimeout(fitScreens, 50); }

let typed = '';
function onKey(ev) {
  if (!S) return;
  if (ev.target.closest?.('input, textarea')) return;
  const k = ev.key;
  ev.stopPropagation();
  if (/^\d$/.test(k)) { typed += k; return; }
  if (k === 'Enter' && typed) { goTo(Math.min(S.d.slides.length, +typed) - 1); typed = ''; ev.preventDefault(); return; }
  typed = '';
  const map = {
    ArrowRight: next, ArrowDown: next, ' ': next, PageDown: next, Enter: next, n: next, N: next,
    ArrowLeft: prev, ArrowUp: prev, PageUp: prev, Backspace: prev, p: prev, P: prev,
    Home: () => show(0, 0), End: () => show(S.order.length - 1, Infinity), Escape: () => (S.tool ? setTool(null) : endShow()),
    b: () => blank('#000'), B: () => blank('#000'), '.': () => blank('#000'), w: () => blank('#fff'), W: () => blank('#fff'), ',': () => blank('#fff'),
    l: () => setTool(S.tool === 'laser' ? null : 'laser'), L: () => setTool(S.tool === 'laser' ? null : 'laser'),
    d: () => setTool(S.tool === 'pen' ? null : 'pen'), D: () => setTool(S.tool === 'pen' ? null : 'pen'),
    h: () => setTool(S.tool === 'hl' ? null : 'hl'), H: () => setTool(S.tool === 'hl' ? null : 'hl'),
    e: clearInk, E: clearInk, g: navigator_, G: navigator_, f: () => S.root.requestFullscreen?.(), F: () => S.root.requestFullscreen?.(), '?': help,
  };
  const fn = map[k];
  if (fn) { ev.preventDefault(); fn(); }
}
function onClick(ev) {
  if (!S || S.tool) return;
  if (ev.target.closest('.show-ctl, .pc-side, .pc-bar, .show-nav, iframe, video, button, input, .pc-notes')) return;
  const link = ev.target.closest('[data-link]')?.dataset.link;
  if (link) {
    if (link.startsWith('#slide:')) { const i = S.d.slides.findIndex(s => s.id === link.slice(7)); if (i >= 0) goTo(i); }
    else window.open(link, '_blank', 'noopener');
    return;
  }
  if (S.o.presenter && !ev.target.closest('.pc-cur')) return;
  next();
}
function blank(c) {
  if (!S) return;
  if (S.black) { S.black.forEach(x => x.remove()); S.black = null; return; }
  S.black = S.screens.map(sc => { const b = h('div', { class: 'show-blank', style: { background: c } }); b.onclick = () => blank(c); sc.root.append(b); return b; });
}
function updateCounter() { if (S?.counter) S.counter.textContent = `${S.order[S.pos] + 1} / ${S.d.slides.length}`; }

// ---------- ink: pen / highlighter / laser ----------
function sizeInk(sc, c) {
  const n = sc.node;
  if (!n) return;
  const r = n.getBoundingClientRect(), sr = sc.stage.getBoundingClientRect();
  Object.assign(c.style, { left: r.left - sr.left + 'px', top: r.top - sr.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  c.width = S.d.page.w * 2; c.height = S.d.page.h * 2;
  drawInk(sc, c);
}
function addInk(sc, i) {
  const c = h('canvas', { class: 'ink' });
  c._i = i;
  sc.stage.append(c);
  sc.ink = c;
  requestAnimationFrame(() => sizeInk(sc, c));
  c.addEventListener('pointerdown', ev => inkDown(ev, sc));
}
function drawInk(sc, c) {
  const x = c.getContext('2d');
  x.clearRect(0, 0, c.width, c.height);
  for (const st of S.ink.get(c._i) || []) {
    x.globalAlpha = st.hl ? .35 : 1;
    x.strokeStyle = st.c; x.lineWidth = st.w * 2; x.lineCap = x.lineJoin = 'round';
    x.beginPath();
    st.p.forEach(([px, py], j) => (j ? x.lineTo(px * 2, py * 2) : x.moveTo(px * 2, py * 2)));
    x.stroke();
  }
  x.globalAlpha = 1;
}
function inkPt(ev, sc) { const r = sc.ink.getBoundingClientRect(); return [(ev.clientX - r.left) / r.width * S.d.page.w, (ev.clientY - r.top) / r.height * S.d.page.h]; }
function inkDown(ev, sc) {
  if (!S.tool || S.tool === 'laser') return;
  ev.preventDefault(); ev.stopPropagation();
  const i = sc.ink._i;
  const st = { c: S.tool === 'hl' ? '#ffeb3b' : S.d.show.pen || '#ff1744', w: S.tool === 'hl' ? 18 : 3, hl: S.tool === 'hl', p: [inkPt(ev, sc)] };
  if (!S.ink.has(i)) S.ink.set(i, []);
  S.ink.get(i).push(st);
  const mv = e => { st.p.push(inkPt(e, sc)); S.screens.forEach(s => s.ink && s.ink._i === i && drawInk(s, s.ink)); };
  const up = () => { sc.win.removeEventListener('pointermove', mv); sc.win.removeEventListener('pointerup', up); };
  sc.win.addEventListener('pointermove', mv); sc.win.addEventListener('pointerup', up);
}
function clearInk() { if (!S) return; S.ink.delete(S.order[S.pos]); S.screens.forEach(sc => sc.ink && drawInk(sc, sc.ink)); }
function setTool(t) {
  S.tool = t;
  for (const sc of S.screens) {
    sc.root.classList.toggle('tool-pen', t === 'pen' || t === 'hl');
    sc.root.classList.toggle('tool-laser', t === 'laser');
    sc.ink && (sc.ink.style.pointerEvents = t === 'pen' || t === 'hl' ? 'auto' : 'none');
    if (t === 'laser' && !sc.laser) {
      sc.laser = h('div', { class: 'laser', style: { background: S.d.show.laser || '#ff1744' } });
      sc.root.append(sc.laser);
      sc.lmv = e => { sc.laser.style.left = e.clientX + 'px'; sc.laser.style.top = e.clientY + 'px'; mirrorLaser(sc, e); };
      sc.win.addEventListener('pointermove', sc.lmv);
    }
    if (t !== 'laser' && sc.laser) { sc.laser.remove(); sc.laser = null; sc.win.removeEventListener('pointermove', sc.lmv); }
  }
  S.root.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
}
// Presenter console laser shows on the audience screen at the same slide position.
function mirrorLaser(sc, e) {
  if (!S.o.presenter || !sc.main) return;
  const n = sc.node?.getBoundingClientRect();
  if (!n) return;
  const fx = (e.clientX - n.left) / n.width, fy = (e.clientY - n.top) / n.height;
  for (const o of S.screens) if (o !== sc && o.node && o.laser) { const r = o.node.getBoundingClientRect(); o.laser.style.left = r.left + fx * r.width + 'px'; o.laser.style.top = r.top + fy * r.height + 'px'; }
}

// ---------- controls / navigator / help ----------
function controls() {
  const b = (ic, tip, fn, tool) => h('button', { class: 'ib', 'data-tip': tip, dataset: tool ? { tool } : null, onclick: ev => { ev.stopPropagation(); fn(); } }, icon(ic));
  S.counter = h('span', { class: 'cnt' });
  return h('div', { class: 'show-ctl' }, b('arrow_back', 'Sebelumnya (←)', prev), S.counter, b('arrow_forward', 'Berikutnya (→)', next),
    h('i', { class: 'sep' }), b('edit', 'Pena (D)', () => setTool(S.tool === 'pen' ? null : 'pen'), 'pen'), b('ink_highlighter', 'Stabilo (H)', () => setTool(S.tool === 'hl' ? null : 'hl'), 'hl'), b('my_location', 'Penunjuk laser (L)', () => setTool(S.tool === 'laser' ? null : 'laser'), 'laser'), b('ink_eraser', 'Hapus coretan (E)', clearInk),
    h('i', { class: 'sep' }), b('grid_view', 'Semua slide (G)', navigator_), b('fullscreen', 'Layar penuh (F)', () => (document.fullscreenElement ? document.exitFullscreen() : S.root.requestFullscreen?.())), b('help', 'Pintasan (?)', help), b('close', 'Akhiri (Esc)', endShow));
}
function navigator_() {
  if (!S) return;
  const old = S.root.querySelector('.show-nav');
  if (old) { old.remove(); return; }
  const nav = h('div', { class: 'show-nav' }, h('div', { class: 'nav-grid' }, S.d.slides.map((s, i) => {
    const box = h('button', { class: 'nav-it' + (i === S.order[S.pos] ? ' on' : '') + (s.skip ? ' skip' : ''), onclick: ev => { ev.stopPropagation(); nav.remove(); goTo(i); } });
    import('./render.js').then(m => box.append(m.thumb(S.d, s, 200, { idx: i }), h('span', null, `${i + 1}. ${slideTitle(s).slice(0, 40)}`)));
    return box;
  })));
  nav.onclick = ev => { if (ev.target === nav) nav.remove(); };
  S.root.append(nav);
}
function help() {
  dialog({ title: 'Pintasan tayangan slide', width: 480, body: h('div', { class: 'kb-grid' }, [['Berikutnya', '→ ↓ Spasi N Enter klik'], ['Sebelumnya', '← ↑ P Backspace klik kanan'], ['Ke slide nomor', 'angka + Enter'], ['Layar hitam / putih', 'B / W'], ['Pena / stabilo', 'D / H'], ['Penunjuk laser', 'L'], ['Hapus coretan', 'E'], ['Semua slide', 'G'], ['Layar penuh', 'F'], ['Akhiri', 'Esc']].flatMap(([a, b]) => [h('div', null, a), h('div', null, b)])) });
}
const fmtT = s => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60), x = s % 60; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };

// ---------- presenter console ----------
function buildConsole(root) {
  const cur = h('div', { class: 'pc-cur show-stage' });
  const nextBox = h('div', { class: 'pc-next' });
  const notes = h('div', { class: 'pc-notes' });
  const timer = h('div', { class: 'pc-timer' });
  const clock = h('div', { class: 'pc-clock' });
  S.counter = h('span', { class: 'cnt' });
  let fs = 22;
  const zoomN = d => { fs = Math.max(12, Math.min(48, fs + d)); notes.style.fontSize = fs + 'px'; };
  const b = (ic, tip, fn, tool) => h('button', { class: 'ib', 'data-tip': tip, dataset: tool ? { tool } : null, onclick: ev => { ev.stopPropagation(); fn(); } }, icon(ic));
  const pauseB = b('pause', 'Jeda timer', () => { if (S.pauseAt) { S.paused += Date.now() - S.pauseAt; S.pauseAt = 0; pauseB.firstChild.textContent = 'pause'; } else { S.pauseAt = Date.now(); pauseB.firstChild.textContent = 'play_arrow'; } });
  const bar = h('div', { class: 'pc-bar' }, b('arrow_back', 'Sebelumnya', prev), S.counter, b('arrow_forward', 'Berikutnya', next), h('i', { class: 'sep' }),
    b('edit', 'Pena', () => setTool(S.tool === 'pen' ? null : 'pen'), 'pen'), b('ink_highlighter', 'Stabilo', () => setTool(S.tool === 'hl' ? null : 'hl'), 'hl'), b('my_location', 'Laser', () => setTool(S.tool === 'laser' ? null : 'laser'), 'laser'), b('ink_eraser', 'Hapus coretan', clearInk),
    b('dark_mode', 'Layar hitam', () => blank('#000')), b('grid_view', 'Semua slide', navigator_), h('div', { class: 'grow' }),
    b('text_decrease', 'Perkecil catatan', () => zoomN(-2)), b('text_increase', 'Perbesar catatan', () => zoomN(2)),
    h('button', { class: 'btn btn-danger', onclick: endShow }, 'Akhiri tayangan'));
  root.append(h('div', { class: 'pc' },
    h('div', { class: 'pc-top' }, h('div', { class: 'pc-tm' }, pauseB, timer, b('restart_alt', 'Atur ulang timer', () => { S.t0 = Date.now(); S.paused = 0; S.pauseAt = 0; })), clock),
    h('div', { class: 'pc-main' }, cur, h('div', { class: 'pc-side' }, h('div', { class: 'pc-lbl' }, 'Berikutnya'), nextBox, h('div', { class: 'pc-lbl' }, 'Catatan pembicara'), notes)),
    bar));
  notes.style.fontSize = fs + 'px';
  S.screens.push({ win: window, stage: cur, root, main: true });
  S.pc = { nextBox, notes, timer, clock };
  S.clock = setInterval(tick, 500);
  tick();
}
function tick() {
  if (!S?.pc) return;
  const el = (S.pauseAt || Date.now()) - S.t0 - S.paused;
  S.pc.timer.textContent = fmtT(el / 1000);
  S.pc.clock.textContent = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const s = S.d.slides[S.order[S.pos]];
  S.pc.timer.title = `Slide ini: ${fmtT((Date.now() - S.slideT0) / 1000)}`;
  if (s?.trans?.auto && S.o.rehearse) S.pc.timer.classList.toggle('over', (Date.now() - S.slideT0) / 1000 > s.trans.auto);
}
function renderConsole() {
  if (!S?.pc) return;
  const d = S.d;
  const i = S.order[S.pos];
  const { nextBox, notes } = S.pc;
  if (S.ended) { nextBox.replaceChildren(h('div', { class: 'pc-endtxt' }, 'Akhir tayangan')); notes.textContent = ''; return; }
  const left = S.steps.length - S.step;
  const ni = S.order[S.pos + 1];
  const w = nextBox.clientWidth || 320;
  import('./render.js').then(m => {
    if (!S) return;
    nextBox.replaceChildren(left > 0 ? h('div', { class: 'pc-anim' }, icon('motion_photos_on', 'sm'), `${left} animasi lagi di slide ini`) : ni != null ? m.thumb(d, d.slides[ni], w, { idx: ni }) : h('div', { class: 'pc-endtxt' }, 'Akhir tayangan'));
  });
  notes.textContent = d.slides[i]?.notes || 'Tidak ada catatan untuk slide ini.';
  notes.classList.toggle('muted', !d.slides[i]?.notes);
}
export { endShow };
