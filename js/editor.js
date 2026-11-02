// Slide editor: stage rendering, selection, move/resize/rotate with smart guides, text editing, history, saving.
import { E, Prefs, savePrefs, slide, els, elById, selEls, one } from './state.js';
import { h, icon, toast, closeMenus, menuOpen, dialogOpen, uid, keyOf, debounce, rafOnce } from './ui.js';
import { Store } from './store.js';
import { frame, normalize, CONTENT_KEYS, cloneEls, textEl, htmlText } from './model.js';
import { renderSlide, renderEl, fitAll, fitText, bbox, assetURL } from './render.js';
import * as Lock from './lock.js';

const R2D = 180 / Math.PI;

// ---------- history ----------
const HKEYS = ['slides', 'master', 'theme', 'page', 'hf', 'comments', 'show'];
export const Hist = {
  stack: [], i: -1,
  snap() { const d = E.doc, o = {}; for (const k of HKEYS) o[k] = d[k]; return JSON.stringify(o); },
  reset() { this.stack = [{ s: this.snap(), cur: E.cur, sel: [] }]; this.i = 0; },
  push(label) {
    const s = this.snap();
    if (this.stack[this.i]?.s === s) return false;
    this.stack.splice(this.i + 1);
    this.stack.push({ s, label, cur: E.cur, sel: [...E.sel] });
    if (this.stack.length > 120) this.stack.shift();
    this.i = this.stack.length - 1;
    return true;
  },
  can(d) { return d < 0 ? this.i > 0 : this.i < this.stack.length - 1; },
  go(d) {
    if (!this.can(d)) return;
    if (E.editing) endEdit(true);
    const from = this.stack[this.i];
    this.i += d;
    const st = this.stack[this.i];
    Object.assign(E.doc, JSON.parse(st.s));
    normalize(E.doc);
    const ref = d < 0 ? from : st;
    E.cur = Math.max(0, Math.min(E.doc.slides.length - 1, ref.cur ?? E.cur));
    E.sel = new Set((ref.sel || []).filter(id => elById(id)));
    afterChange('all');
    toast(d < 0 ? `Diurungkan${from.label ? ': ' + from.label : ''}` : `Diulangi${st.label ? ': ' + st.label : ''}`, { ms: 1400 });
  },
};

// ---------- saving ----------
const saveSoon = debounce(() => E.save(), 700);
async function save() {
  const d = E.doc;
  if (!d || (d.share?.revoked && !d.share.owner)) return;
  d.modified = Date.now();
  try { setSaved('saving'); await Store.put(d); E.dirty = false; setSaved('saved'); } catch (e) { console.error(e); setSaved('error'); }
  maybeVersion();
}
let lastVer = 0;
async function maybeVersion(force, name) {
  const d = E.doc;
  if (!d) return;
  if (!force && Date.now() - lastVer < 10 * 60e3) return;
  lastVer = Date.now();
  const data = {};
  for (const k of CONTENT_KEYS) if (k !== 'assets') data[k] = d[k];
  await Store.versions.add({ vid: uid(10), doc: d.id, time: Date.now(), name: name || null, data: JSON.parse(JSON.stringify(data)) });
  const list = await Store.versions.list(d.id);
  for (const v of list.filter(v => !v.name).slice(60)) await Store.versions.del(v.vid);
}
export const addVersion = name => maybeVersion(true, name);
function setSaved(s) { E.setSaveState?.(s); }

// ---------- change pipeline ----------
// strip: 'cur' re-renders the current thumbnail, 'all' the whole filmstrip, false none.
function afterChange(strip = 'cur') {
  E.render();
  if (strip === 'all') E.renderStrip?.(); else if (strip) E.renderThumb?.(E.cur);
  E.updateToolbar?.();
  E.refreshPanel?.();
  E.updateStatus?.();
}
E.commit = (label, strip = 'cur') => {
  if (E.lockView) { toast('Anda hanya dapat melihat presentasi ini'); E.revertView(); return; }
  if (!Hist.push(label)) { afterChange(strip); return; }
  E.dirty = true;
  saveSoon();
  afterChange(strip);
  E.live?.changed();
};
E.revertView = () => { const st = Hist.stack[Hist.i]; if (st) { Object.assign(E.doc, JSON.parse(st.s)); normalize(E.doc); afterChange('all'); } };
E.save = save;
E.saveSoon = saveSoon;

// ---------- stage ----------
export function buildStage() {
  E.scroll = h('div', { class: 'stage-scroll', tabindex: '-1' });
  E.pad = h('div', { class: 'stage-pad' });
  E.stage = h('div', { class: 'stage' });
  E.ovl = h('div', { class: 'ovl' });
  E.pad.append(E.stage);
  E.scroll.append(E.pad);
  E.scroll.addEventListener('pointerdown', onDown);
  E.scroll.addEventListener('dblclick', onDbl);
  E.scroll.addEventListener('contextmenu', e => { const t = hitEl(e); if (t && !E.sel.has(t)) { E.sel = new Set(groupOf(t)); drawOverlay(); E.updateToolbar?.(); } e.preventDefault(); if (E.editing) return; E.contextMenu?.(e); });
  E.scroll.addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(E.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); } }, { passive: false });
  new ResizeObserver(rafOnce(() => { if (E.fit) setZoom('fit'); else layoutStage(); })).observe(E.scroll);
  return E.scroll;
}

export function setZoom(z) {
  const d = E.doc;
  if (!d) return;
  if (z === 'fit') {
    E.fit = true;
    const W = E.scroll.clientWidth - 56, H = E.scroll.clientHeight - 56;
    z = Math.max(.1, Math.min(W / d.page.w, H / d.page.h));
  } else { E.fit = false; z = Math.max(.1, Math.min(4, z)); }
  E.zoom = z;
  layoutStage();
  E.render();
  E.updateStatus?.();
  E.updateToolbar?.();
}
function layoutStage() {
  const d = E.doc;
  const w = d.page.w * E.zoom, hh = d.page.h * E.zoom;
  Object.assign(E.stage.style, { width: w + 'px', height: hh + 'px' });
  const W = Math.max(E.scroll.clientWidth, w + 56), H = Math.max(E.scroll.clientHeight, hh + 56);
  Object.assign(E.pad.style, { width: W + 'px', height: H + 'px' });
  Object.assign(E.stage.style, { left: (W - w) / 2 + 'px', top: (H - hh) / 2 + 'px' });
}

E.render = () => {
  const d = E.doc, s = slide();
  if (!d || !s || E.dead) return;
  if (E.editing) { drawOverlay(); return; }
  const node = renderSlide(d, s, { editor: true, hint: !E.lockView, editMaster: E.editMaster, idx: E.cur });
  node.style.transform = `scale(${E.zoom})`;
  node.classList.add('main');
  if (E.editMaster) node.classList.add('edit-master');
  E.stage.replaceChildren(node, E.ovl);
  E.slideNode = node;
  fitAll(node);
  drawOverlay();
};

const nodeOf = id => E.slideNode?.querySelector(`.el[data-id="${id}"]`);
// Selection boxes, handles, margin guides, grid and comment pins in screen pixels over the stage.
export function drawOverlay(guides) {
  const d = E.doc, z = E.zoom;
  if (!d || !E.ovl) return;
  const o = E.ovl;
  o.replaceChildren();
  if (E.view.grid) o.append(h('div', { class: 'gridlines', style: { backgroundSize: `${E.view.gridSize * z}px ${E.view.gridSize * z}px` } }));
  if (E.view.margins) {
    const f = frame(d);
    o.append(h('div', { class: 'mg', style: { left: f.l * z + 'px', top: f.t * z + 'px', width: f.W * z + 'px', height: f.H * z + 'px' } }));
  }
  if (E.editMaster) o.append(h('div', { class: 'master-badge' }, icon('dashboard_customize', 'xs'), 'Mengedit master — elemen tampil di semua slide'));
  for (const g of guides || []) o.append(h('div', { class: 'guide ' + g.k, style: g.k === 'v' ? { left: g.v * z + 'px', top: g.a * z + 'px', height: (g.b - g.a) * z + 'px' } : { top: g.v * z + 'px', left: g.a * z + 'px', width: (g.b - g.a) * z + 'px' } }));
  const list = selEls();
  for (const e of list) {
    const b = bbox(e);
    const box = h('div', { class: 'selbox' + (E.editing === e.id ? ' editing' : '') + (e.locked ? ' locked' : '') + (list.length > 1 ? ' multi' : ''), style: { left: b.x * z + 'px', top: b.y * z + 'px', width: b.w * z + 'px', height: b.h * z + 'px', transform: e.rot ? `rotate(${e.rot}deg)` : null } });
    if (e.type === 'line') box.classList.add('line');
    o.append(box);
    if (list.length === 1 && !e.locked && E.editing !== e.id && !E.lockView) {
      if (e.type === 'line') {
        for (const [k, x, y] of [['p1', e.x, e.y], ['p2', e.x + e.w, e.y + e.h]]) o.append(h('div', { class: 'hd pt', dataset: { h: k }, style: { left: x * z + 'px', top: y * z + 'px' } }));
      } else {
        for (const k of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) box.append(h('div', { class: 'hd', dataset: { h: k } }));
        box.append(h('div', { class: 'hd-rot', dataset: { h: 'rot' } }, h('i')));
      }
    }
  }
  if (list.length > 1) {
    const u = union(list);
    const box = h('div', { class: 'selbox group', style: { left: u.x * z + 'px', top: u.y * z + 'px', width: u.w * z + 'px', height: u.h * z + 'px' } });
    if (!E.lockView && !list.some(e => e.locked)) for (const k of ['nw', 'ne', 'se', 'sw']) box.append(h('div', { class: 'hd', dataset: { h: k } }));
    o.append(box);
  }
  // comment pins
  if (!E.editMaster) {
    const sid = slide()?.id;
    const pins = (d.comments || []).filter(c => c.slide === sid && !c.done);
    pins.forEach((c, i) => {
      const e = c.el && elById(c.el);
      const b = e ? bbox(e) : { x: d.page.w - 40, y: 10, w: 30, h: 0 };
      o.append(h('button', { class: 'cpin', style: { left: (b.x + b.w) * z - 6 + 'px', top: b.y * z - 14 + i * 4 + 'px' }, 'data-tip': `${c.author}: ${c.text}`, onclick: ev => { ev.stopPropagation(); E.openPanel?.('comments', c.id); } }, icon('chat_bubble', 'fill xs')));
    });
  }
  E.ovlMarq && o.append(E.ovlMarq);
}
E.drawOverlay = drawOverlay;
const union = list => {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const e of list) {
    const b = rotBox(e);
    x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y); x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
};
export { union };
// Axis-aligned box of a rotated element.
function rotBox(e) {
  const b = bbox(e);
  if (!e.rot) return b;
  const a = e.rot / R2D, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const w = b.w * c + b.h * s, hh = b.w * s + b.h * c;
  return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - hh / 2, w, h: hh };
}

// ---------- selection ----------
const groupOf = id => { const e = elById(id); return e?.group ? els().filter(x => x.group === e.group).map(x => x.id) : [id]; };
E.select = (ids, add) => {
  if (E.editing) endEdit();
  if (!add) E.sel = new Set();
  for (const id of ids) for (const g of groupOf(id)) E.sel.add(g);
  drawOverlay(); E.updateToolbar?.(); E.refreshPanel?.('sel');
};
E.deselect = () => { if (E.editing) endEdit(); E.sel = new Set(); drawOverlay(); E.updateToolbar?.(); E.refreshPanel?.('sel'); };

function pt(ev) {
  const r = E.stage.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / E.zoom, y: (ev.clientY - r.top) / E.zoom };
}
function hitEl(ev) {
  const n = ev.target.closest?.('.el[data-id]');
  if (!n || !E.slideNode?.contains(n)) return null;
  const inMaster = !!n.closest('.master-layer');
  if (inMaster !== !!E.editMaster) return null;
  return n.dataset.id;
}

// ---------- pointer ----------
let drag = null;
function onDown(ev) {
  if (ev.button !== 0 && ev.button !== 2) return;
  if (E.painter && ev.button === 0) { const id = hitEl(ev); if (id) { E.applyPainter(id); ev.preventDefault(); return; } }
  if (ev.button === 2) return;
  closeMenus(0);
  const hd = ev.target.closest('[data-h]');
  if (E.editing) {
    const ed = nodeOf(E.editing);
    if (ed && ed.contains(ev.target) && !hd) return;   // caret placement inside the edited text
    endEdit();
  }
  if (E.lockView) { const id = hitEl(ev); if (id) { const e = elById(id); if (e?.link) E.followLink?.(e.link); } return; }
  const p = pt(ev);
  if (E.insertTool) { ev.preventDefault(); startInsert(ev, p); return; }
  if (hd) { ev.preventDefault(); startHandle(ev, hd.dataset.h, p); return; }
  const id = hitEl(ev);
  if (!id) {
    if (!ev.shiftKey) E.deselect();
    startMarquee(ev, p);
    return;
  }
  ev.preventDefault();
  E.scroll.focus({ preventScroll: true });
  const was = E.sel.has(id) && E.sel.size === groupOf(id).length;
  if (ev.shiftKey || ev.metaKey || ev.ctrlKey) {
    if (E.sel.has(id)) { for (const g of groupOf(id)) E.sel.delete(g); drawOverlay(); E.updateToolbar?.(); return; }
    E.select([id], true);
  } else if (!E.sel.has(id)) E.select([id]);
  const e = elById(id);
  const moving = selEls().filter(x => !x.locked);
  drag = { kind: 'move', p0: p, ev0: ev, start: moving.map(x => ({ e: x, x: x.x, y: x.y })), moved: false, clickEdit: was && !e.group && (e.type === 'text' || e.type === 'shape' || e.type === 'table') && !e.locked, id };
  bindDrag();
}
function onDbl(ev) {
  if (E.lockView || E.editing) return;
  const id = hitEl(ev);
  if (!id) return;
  const e = elById(id);
  if (e.locked) return;
  if (e.group && E.sel.size > 1) { E.sel = new Set([id]); drawOverlay(); }
  if (e.type === 'text' || e.type === 'shape' || e.type === 'table') startEdit(id, ev);
  else if (e.type === 'image') E.run?.(e.src ? 'format' : 'img-replace');
  else if (e.type === 'chart') E.run?.('chart-edit');
  else if (e.type === 'video') E.run?.('video-edit');
  else if (e.type === 'icon') E.run?.('icon-replace');
}

function bindDrag() {
  const move = ev => onMove(ev), up = ev => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); onUp(ev); };
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
}

function snapTargets(skip) {
  const d = E.doc, f = frame(d), xs = [0, d.page.w / 2, d.page.w], ys = [0, d.page.h / 2, d.page.h];
  if (E.view.margins) { xs.push(f.l, f.r); ys.push(f.t, f.b); }
  for (const e of els()) {
    if (skip.has(e.id) || e.hidden) continue;
    const b = rotBox(e);
    xs.push(b.x, b.x + b.w / 2, b.x + b.w); ys.push(b.y, b.y + b.h / 2, b.y + b.h);
  }
  return { xs, ys };
}
function snap(vals, targets, th) {
  let best = null;
  for (const v of vals) for (const t of targets) { const dd = t - v; if (Math.abs(dd) <= th && (!best || Math.abs(dd) < Math.abs(best.d))) best = { d: dd, t }; }
  return best;
}
const gridSnap = v => Math.round(v / E.view.gridSize) * E.view.gridSize;

function onMove(ev) {
  if (!drag) return;
  const p = pt(ev);
  let dx = p.x - drag.p0.x, dy = p.y - drag.p0.y;
  if (drag.kind === 'move') {
    if (!drag.moved && Math.hypot(dx * E.zoom, dy * E.zoom) < 4) return;
    drag.moved = true;
    if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    const list = drag.start.map(s => s.e);
    if (!list.length) return;
    const u0 = union(list.map((e, i) => ({ ...e, x: drag.start[i].x, y: drag.start[i].y })));
    const guides = [];
    if (!ev.altKey) {
      if (E.view.snapGrid) { dx = gridSnap(u0.x + dx) - u0.x; dy = gridSnap(u0.y + dy) - u0.y; }
      else {
        drag.tg ||= snapTargets(new Set(list.map(e => e.id)));
        const th = 6 / E.zoom;
        const sx = snap([u0.x + dx, u0.x + u0.w / 2 + dx, u0.x + u0.w + dx], drag.tg.xs, th);
        const sy = snap([u0.y + dy, u0.y + u0.h / 2 + dy, u0.y + u0.h + dy], drag.tg.ys, th);
        if (sx) { dx += sx.d; guides.push({ k: 'v', v: sx.t, a: 0, b: E.doc.page.h }); }
        if (sy) { dy += sy.d; guides.push({ k: 'h', v: sy.t, a: 0, b: E.doc.page.w }); }
      }
    }
    drag.start.forEach(s => { s.e.x = Math.round((s.x + dx) * 10) / 10; s.e.y = Math.round((s.y + dy) * 10) / 10; placeNode(s.e); });
    drawOverlay(guides);
    E.showDim?.(ev, `${Math.round(union(list).x)}, ${Math.round(union(list).y)}`);
  } else if (drag.kind === 'resize') resizeMove(ev, p);
  else if (drag.kind === 'group') groupMove(ev, p);
  else if (drag.kind === 'rot') {
    const e = drag.e, c = { x: e.x + e.w / 2, y: e.y + e.h / 2 };
    let a = Math.atan2(p.y - c.y, p.x - c.x) * R2D + 90;
    if (ev.shiftKey) a = Math.round(a / 15) * 15;
    else for (const s of [0, 90, 180, 270, 360]) if (Math.abs(a - s) < 3 || Math.abs(a + 360 - s) < 3) a = s;
    e.rot = Math.round(((a % 360) + 360) % 360);
    if (e.rot === 360) e.rot = 0;
    placeNode(e); drawOverlay();
    E.showDim?.(ev, e.rot + '°');
  } else if (drag.kind === 'pt') {
    const e = drag.e;
    let x = p.x, y = p.y;
    const ox = drag.which === 'p1' ? drag.s.x + drag.s.w : drag.s.x, oy = drag.which === 'p1' ? drag.s.y + drag.s.h : drag.s.y;
    if (ev.shiftKey) { const a = Math.round(Math.atan2(y - oy, x - ox) / (Math.PI / 4)) * (Math.PI / 4), r = Math.hypot(x - ox, y - oy); x = ox + r * Math.cos(a); y = oy + r * Math.sin(a); }
    else if (!ev.altKey) { drag.tg ||= snapTargets(new Set([e.id])); const sx = snap([x], drag.tg.xs, 6 / E.zoom), sy = snap([y], drag.tg.ys, 6 / E.zoom); if (sx) x += sx.d; if (sy) y += sy.d; }
    if (drag.which === 'p1') { e.x = x; e.y = y; e.w = ox - x; e.h = oy - y; } else { e.w = x - e.x; e.h = y - e.y; }
    replaceNode(e); drawOverlay();
    E.showDim?.(ev, Math.round(Math.hypot(e.w, e.h)) + ' px');
  } else if (drag.kind === 'marq') {
    const x = Math.min(p.x, drag.p0.x), y = Math.min(p.y, drag.p0.y), w = Math.abs(dx), hh = Math.abs(dy);
    const z = E.zoom;
    E.ovlMarq = h('div', { class: 'marq', style: { left: x * z + 'px', top: y * z + 'px', width: w * z + 'px', height: hh * z + 'px' } });
    const hit = els().filter(e => { const b = rotBox(e); return !e.hidden && b.x < x + w && b.x + b.w > x && b.y < y + hh && b.y + b.h > y; }).map(e => e.id);
    E.sel = new Set([...drag.base, ...hit.flatMap(groupOf)]);
    drawOverlay();
  } else if (drag.kind === 'insert') {
    const x = Math.min(p.x, drag.p0.x), y = Math.min(p.y, drag.p0.y);
    let w = Math.abs(dx), hh = Math.abs(dy);
    if (ev.shiftKey) w = hh = Math.max(w, hh);
    const z = E.zoom;
    E.ovlMarq = h('div', { class: 'marq ins', style: { left: x * z + 'px', top: y * z + 'px', width: w * z + 'px', height: hh * z + 'px' } });
    drawOverlay();
  }
}
function onUp(ev) {
  const d = drag;
  drag = null;
  E.ovlMarq = null;
  E.hideDim?.();
  if (!d) return;
  if (d.kind === 'move') {
    if (d.moved) { E.commit('Pindahkan'); return; }
    if (d.clickEdit && !ev.shiftKey && !ev.metaKey && !ev.ctrlKey) { startEdit(d.id, ev); return; }
    drawOverlay();
  } else if (d.kind === 'marq') { drawOverlay(); E.updateToolbar?.(); E.refreshPanel?.('sel'); }
  else if (d.kind === 'insert') finishInsert(d, pt(ev), ev);
  else E.commit(d.kind === 'rot' ? 'Putar' : 'Ubah ukuran');
}
function startMarquee(ev, p) { drag = { kind: 'marq', p0: p, base: ev.shiftKey ? [...E.sel] : [] }; bindDrag(); }

function startHandle(ev, k, p) {
  const list = selEls();
  if (k === 'p1' || k === 'p2') { const e = list[0]; drag = { kind: 'pt', which: k, e, s: { ...e }, p0: p }; bindDrag(); return; }
  if (list.length > 1) {
    const u = union(list);
    drag = { kind: 'group', k, p0: p, u, start: list.map(e => ({ e, x: e.x, y: e.y, w: e.w, h: e.h, size: e.def?.size })) };
    bindDrag(); return;
  }
  const e = list[0];
  if (!e) return;
  if (k === 'rot') { drag = { kind: 'rot', e, p0: p }; bindDrag(); return; }
  drag = { kind: 'resize', k, e, p0: p, s: { x: e.x, y: e.y, w: e.w, h: e.h }, ratio: e.w / Math.max(1, e.h) };
  bindDrag();
}
// Resize in the element's own (rotated) frame, keeping the opposite handle fixed.
function resizeMove(ev, p) {
  const { e, k, s } = drag;
  const dxs = k.includes('e') ? 1 : k.includes('w') ? -1 : 0, dys = k.includes('s') ? 1 : k.includes('n') ? -1 : 0;
  const th = (e.rot || 0) / R2D, cos = Math.cos(th), sin = Math.sin(th);
  const c = { x: s.x + s.w / 2, y: s.y + s.h / 2 };
  const lx = (p.x - c.x) * cos + (p.y - c.y) * sin, ly = -(p.x - c.x) * sin + (p.y - c.y) * cos;
  const ax = -dxs * s.w / 2, ay = -dys * s.h / 2;
  let w = dxs ? Math.max(4, dxs * (lx - ax)) : s.w, hh = dys ? Math.max(4, dys * (ly - ay)) : s.h;
  const keep = ev.shiftKey !== (e.type === 'image' || e.type === 'icon');
  if (keep && dxs && dys) { if (w / hh > drag.ratio) hh = w / drag.ratio; else w = hh * drag.ratio; }
  else if (keep && dxs) hh = w / drag.ratio;
  else if (keep && dys) w = hh * drag.ratio;
  if (!ev.altKey && !e.rot && !E.view.snapGrid) {
    drag.tg ||= snapTargets(new Set([e.id]));
    const t = 6 / E.zoom;
    if (dxs) { const edge = dxs > 0 ? s.x + w : s.x + s.w - w; const sx = snap([edge], drag.tg.xs, t); if (sx) w += dxs * sx.d; }
    if (dys) { const edge = dys > 0 ? s.y + hh : s.y + s.h - hh; const sy = snap([edge], drag.tg.ys, t); if (sy) hh += dys * sy.d; }
  } else if (E.view.snapGrid && !e.rot) {
    if (dxs) w = Math.max(4, dxs > 0 ? gridSnap(s.x + w) - s.x : s.x + s.w - gridSnap(s.x + s.w - w));
    if (dys) hh = Math.max(4, dys > 0 ? gridSnap(s.y + hh) - s.y : s.y + s.h - gridSnap(s.y + s.h - hh));
  }
  const ncx = ax + dxs * w / 2, ncy = ay + dys * hh / 2;
  const cx = c.x + ncx * cos - ncy * sin, cy = c.y + ncx * sin + ncy * cos;
  e.w = Math.round(w * 10) / 10; e.h = Math.round(hh * 10) / 10; e.x = Math.round((cx - w / 2) * 10) / 10; e.y = Math.round((cy - hh / 2) * 10) / 10;
  if (e.type === 'table' || e.type === 'chart' || e.type === 'shape') replaceNode(e); else placeNode(e);
  drawOverlay();
  E.showDim?.(ev, `${Math.round(e.w)} × ${Math.round(e.h)}`);
}
function groupMove(ev, p) {
  const { u, k } = drag;
  const ax = k.includes('w') ? u.x + u.w : u.x, ay = k.includes('n') ? u.y + u.h : u.y;
  let sx = Math.abs(p.x - ax) / Math.max(1, u.w), sy = Math.abs(p.y - ay) / Math.max(1, u.h);
  const s = ev.shiftKey ? Math.max(sx, sy) : Math.max(sx, sy);
  sx = sy = Math.max(.05, s);
  for (const st of drag.start) {
    const e = st.e;
    e.x = ax + (st.x - ax) * sx; e.y = ay + (st.y - ay) * sy; e.w = st.w * sx; e.h = st.h * sy;
    if (k.includes('w')) e.x = ax - (ax - st.x) * sx;
    if (st.size && ev.altKey) e.def.size = Math.max(4, Math.round(st.size * s));
    replaceNode(e);
  }
  drawOverlay();
}
function placeNode(e) {
  const n = nodeOf(e.id);
  if (!n) return;
  const b = bbox(e);
  Object.assign(n.style, { left: b.x + 'px', top: b.y + 'px', width: Math.max(1, b.w) + 'px', height: Math.max(1, b.h) + 'px' });
  const tf = [];
  if (e.rot) tf.push(`rotate(${e.rot}deg)`);
  if (e.flipH) tf.push('scaleX(-1)');
  if (e.flipV) tf.push('scaleY(-1)');
  n.style.transform = tf.join(' ');
  if (n.dataset.fit === 'shrink') fitText(n);
}
function replaceNode(e) {
  const n = nodeOf(e.id);
  if (!n) return;
  const m = renderEl(E.doc, e, { editor: true, hint: true });
  n.replaceWith(m);
  if (m.dataset.fit === 'shrink') fitText(m);
}
E.placeNode = placeNode;
E.replaceNode = replaceNode;

// ---------- insert tool (draw a text box / shape / line on the slide) ----------
function startInsert(ev, p) { drag = { kind: 'insert', p0: p, tool: E.insertTool }; bindDrag(); }
function finishInsert(d, p, ev) {
  const t = d.tool;
  E.setTool(null);
  let x = Math.min(p.x, d.p0.x), y = Math.min(p.y, d.p0.y), w = Math.abs(p.x - d.p0.x), hh = Math.abs(p.y - d.p0.y);
  const click = w < 5 && hh < 5;
  if (ev.shiftKey && !click) w = hh = Math.max(w, hh);
  let e;
  if (t.kind === 'line') {
    e = t.make();
    if (click) { e.x = d.p0.x; e.y = d.p0.y; } else { e.x = d.p0.x; e.y = d.p0.y; e.w = p.x - d.p0.x; e.h = p.y - d.p0.y; }
  } else {
    e = t.make();
    if (click) { e.x = d.p0.x - e.w / 2; e.y = d.p0.y - e.h / 2; } else Object.assign(e, { x, y, w, h: t.kind === 'text' ? Math.max(hh, 40) : hh });
  }
  els().push(e);
  E.sel = new Set([e.id]);
  E.commit('Sisipkan');
  if (t.kind === 'text') startEdit(e.id);
}
E.setTool = t => { E.insertTool = t; E.root?.classList.toggle('tool-on', !!t); E.updateToolbar?.(); };

// ---------- text editing ----------
const sanitizeDoc = document.implementation.createHTMLDocument('');
const OK_TAGS = new Set(['P', 'BR', 'SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SUB', 'SUP', 'UL', 'OL', 'LI', 'A', 'FONT']);
export function cleanHtml(html) {
  const box = sanitizeDoc.createElement('div');
  box.innerHTML = html;
  const walk = n => {
    for (const c of [...n.childNodes]) {
      if (c.nodeType === 8) { c.remove(); continue; }
      if (c.nodeType !== 1) continue;
      walk(c);
      if (c.tagName === 'DIV' || /^H\d$/.test(c.tagName) || c.tagName === 'BLOCKQUOTE') { const p = sanitizeDoc.createElement('p'); p.setAttribute('style', c.getAttribute('style') || ''); if (!p.getAttribute('style')) p.removeAttribute('style'); p.append(...c.childNodes); c.replaceWith(p); continue; }
      if (!OK_TAGS.has(c.tagName)) { c.replaceWith(...c.childNodes); continue; }
      for (const a of [...c.attributes]) if (!['style', 'href', 'target', 'color', 'face'].includes(a.name)) c.removeAttribute(a.name);
      if (c.tagName === 'A') { const href = c.getAttribute('href') || ''; if (/^\s*javascript:/i.test(href)) c.removeAttribute('href'); c.setAttribute('target', '_blank'); }
      if (c.tagName === 'SPAN' && !c.getAttribute('style')) c.replaceWith(...c.childNodes);
    }
  };
  walk(box);
  // bare text / inline at top level → paragraph
  const out = sanitizeDoc.createElement('div');
  let p = null;
  for (const c of [...box.childNodes]) {
    if (c.nodeType === 1 && (c.tagName === 'P' || c.tagName === 'UL' || c.tagName === 'OL')) { p = null; out.append(c); continue; }
    if (c.nodeType === 3 && !c.textContent.trim() && !p) continue;
    if (!p) { p = sanitizeDoc.createElement('p'); out.append(p); }
    p.append(c);
  }
  return out.innerHTML;
}
export const isEmptyHtml = html => !htmlText(html) && !/<img/i.test(html || '');

export function startEdit(id, ev) {
  if (E.lockView) return;
  const e = elById(id);
  if (!e || e.locked) return;
  if (E.editing) endEdit();
  E.sel = new Set([id]);
  const node = nodeOf(id);
  if (!node) return;
  E.editing = id;
  node.classList.add('editing');
  E.root.classList.add('text-editing');
  if (e.type === 'table') {
    const cells = [...node.querySelectorAll('td')];
    cells.forEach(td => { td.contentEditable = 'true'; td.spellcheck = E.view.spell; });
    const target = ev ? document.elementFromPoint(ev.clientX, ev.clientY)?.closest('td') : null;
    const td = target && node.contains(target) ? target : cells[0];
    td?.focus();
    if (ev) placeCaret(ev); else selectAllIn(td);
    node.addEventListener('keydown', tableKeys);
    node.addEventListener('input', () => E.markTyping());
    drawOverlay(); E.updateToolbar?.();
    return;
  }
  const txi = node.querySelector('.txi');
  if (txi.classList.contains('hint')) { txi.classList.remove('hint'); delete txi.dataset.hint; }
  if (!txi.innerHTML.trim() && e.def?.list) txi.innerHTML = '<ul><li><br></li></ul>';
  else if (!txi.innerHTML.trim()) txi.innerHTML = '<p><br></p>';
  txi.contentEditable = 'true';
  txi.spellcheck = E.view.spell;
  txi.focus({ preventScroll: true });
  if (ev && !e.html) caretEnd(txi);
  else if (ev) placeCaret(ev);
  else if (!e.html) caretEnd(txi);
  else selectAllIn(txi);
  txi.oninput = () => onTextInput(e, node, txi);
  txi.onpaste = onTextPaste;
  txi.onkeydown = ev2 => { if (ev2.key === 'Tab') { ev2.preventDefault(); document.execCommand(ev2.shiftKey ? 'outdent' : 'indent'); } };
  document.addEventListener('selectionchange', onSelChange);
  drawOverlay();
  E.updateToolbar?.();
}
E.startEdit = startEdit;
const onSelChange = rafOnce(() => { if (E.editing) E.updateToolbar?.(); });
function placeCaret(ev) {
  let r = null;
  if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(ev.clientX, ev.clientY);
  else if (document.caretPositionFromPoint) { const c = document.caretPositionFromPoint(ev.clientX, ev.clientY); if (c) { r = document.createRange(); r.setStart(c.offsetNode, c.offset); } }
  if (r) { const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
}
function caretEnd(n) { const r = document.createRange(); r.selectNodeContents(n); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
function selectAllIn(n) { if (!n) return; const r = document.createRange(); r.selectNodeContents(n); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
E.selectAllText = () => { const n = nodeOf(E.editing); const t = n?.querySelector('.txi') || document.activeElement?.closest?.('td'); if (t) selectAllIn(t); };

function onTextInput(e, node, txi) {
  if (e.box?.fit === 'grow' || (e.type === 'text' && !e.ph && e.box?.fit !== 'shrink' && e.box?.fit !== 'none')) {
    const tx = node.querySelector('.tx');
    const need = txi.scrollHeight * (parseFloat(txi.style.zoom) || 1) + parseFloat(getComputedStyle(tx).paddingTop) + parseFloat(getComputedStyle(tx).paddingBottom);
    if (Math.abs(need - e.h) > 1 && (need > e.h || e.box?.fit === 'grow')) { e.h = Math.ceil(need); node.style.height = e.h + 'px'; drawOverlay(); }
  } else if (node.dataset.fit === 'shrink') fitText(node);
  E.markTyping();
}
E.markTyping = (() => { const t = debounce(() => { if (E.editing) { syncEditing(); E.commit('Ketik', 'cur'); } }, 1200); return t; })();
function onTextPaste(ev) {
  const d = ev.clipboardData;
  if (!d) return;
  ev.preventDefault();
  const html = d.getData('text/html');
  if (html && !ev.shiftKey && !E.pastePlain) {
    const clean = cleanHtml(html).replace(/font-size:[^;"]*;?/g, '').replace(/font-family:[^;"]*;?/g, '').replace(/ style=""/g, '');
    document.execCommand('insertHTML', false, clean);
  } else document.execCommand('insertText', false, d.getData('text/plain'));
  E.pastePlain = false;
}
function tableKeys(ev) {
  if (ev.key !== 'Tab') return;
  ev.preventDefault();
  const td = ev.target.closest('td');
  const cells = [...ev.currentTarget.querySelectorAll('td')];
  let i = cells.indexOf(td) + (ev.shiftKey ? -1 : 1);
  if (i >= cells.length) { syncEditing(); E.run?.('tbl-row-below'); return; }
  i = Math.max(0, i);
  cells[i].focus(); selectAllIn(cells[i]);
}
// Copy the live DOM of the edited element back into the model (without leaving edit mode).
function syncEditing() {
  const e = elById(E.editing), node = nodeOf(E.editing);
  if (!e || !node) return;
  if (e.type === 'table') {
    node.querySelectorAll('td').forEach(td => { const c = e.rows[+td.dataset.r]?.[+td.dataset.c]; if (c) c.html = cleanHtml(td.innerHTML); });
  } else {
    const txi = node.querySelector('.txi');
    e.html = isEmptyHtml(txi.innerHTML) ? '' : cleanHtml(txi.innerHTML);
  }
}
E.syncEditing = syncEditing;
export function endEdit(silent) {
  const id = E.editing;
  if (!id) return;
  E.markTyping.cancel?.();
  syncEditing();
  const e = elById(id);
  const node = nodeOf(id);
  node?.removeEventListener('keydown', tableKeys);
  document.removeEventListener('selectionchange', onSelChange);
  E.editing = null;
  E.root.classList.remove('text-editing');
  getSelection()?.removeAllRanges();
  if (e && e.type === 'text' && !e.ph && isEmptyHtml(e.html) && !e.fill) { E.doc && els().splice(els().indexOf(e), 1); E.sel.delete(id); }
  if (silent) return;
  E.commit('Edit teks');
}
E.endEdit = endEdit;

// ---------- keyboard ----------
export function onKey(ev) {
  if (E.dead || dialogOpen() || document.querySelector('.show-root')) return;
  const k = keyOf(ev);
  const inField = ev.target.closest?.('input, textarea, select, [contenteditable="true"]') && !ev.target.closest('.stage');
  if (E.editing) {
    if (k === 'Escape') { ev.preventDefault(); const id = E.editing; endEdit(); E.sel = new Set([id]); drawOverlay(); E.updateToolbar?.(); return; }
    if (E.runKey?.(k, ev, true)) ev.preventDefault();
    return;
  }
  if (inField && !ev.target.closest('.strip')) { if (!k.startsWith('Mod+') || ['Mod+A', 'Mod+C', 'Mod+V', 'Mod+X', 'Mod+Z'].includes(k)) return; }
  if (menuOpen()) return;
  if (E.runKey?.(k, ev, false)) { ev.preventDefault(); return; }
  const list = selEls();
  if (ev.target.closest?.('.strip') && !list.length) return;
  if (k === 'Escape') { if (E.insertTool) E.setTool(null); else if (E.painter) E.setPainter(null); else E.deselect(); return; }
  if (!list.length) {
    if (k === 'ArrowDown' || k === 'ArrowRight' || k === 'PageDown') { ev.preventDefault(); E.goSlide(E.cur + 1); }
    else if (k === 'ArrowUp' || k === 'ArrowLeft' || k === 'PageUp') { ev.preventDefault(); E.goSlide(E.cur - 1); }
    else if (k === 'Home') E.goSlide(0); else if (k === 'End') E.goSlide(E.doc.slides.length - 1);
    return;
  }
  const nudge = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const base = k.replace('Shift+', '');
  if (nudge[base] && !E.lockView) {
    ev.preventDefault();
    const n = k.includes('Shift') ? 10 : 1;
    for (const e of list) if (!e.locked) { e.x += nudge[base][0] * n; e.y += nudge[base][1] * n; placeNode(e); }
    drawOverlay();
    E.nudgeCommit();
    return;
  }
  if ((k === 'Enter' || k === 'F2') && list.length === 1 && ['text', 'shape', 'table'].includes(list[0].type)) { ev.preventDefault(); startEdit(list[0].id); return; }
  if (k === 'Tab' || k === 'Shift+Tab') {
    ev.preventDefault();
    const all = els();
    if (!all.length) return;
    const i = all.findIndex(e => e.id === list[list.length - 1].id);
    const j = (i + (k === 'Tab' ? 1 : -1) + all.length) % all.length;
    E.select([all[j].id]);
    return;
  }
  // typing a character on a selected text box starts editing it (like Google Slides)
  if (ev.key.length === 1 && !ev.metaKey && !ev.ctrlKey && !ev.altKey && list.length === 1 && ['text', 'shape'].includes(list[0].type) && !list[0].locked && !E.lockView) {
    ev.preventDefault();
    startEdit(list[0].id);
    const e = list[0];
    if (!e.html) { E.selectAllText(); }
    else { const n = nodeOf(e.id).querySelector('.txi'); caretEnd(n); }
    document.execCommand('insertText', false, ev.key);
  }
}
E.nudgeCommit = debounce(() => E.commit('Geser'), 400);

// ---------- clipboard ----------
const CLIP = 'AMATU-SLIDES:';
function assetsOf(list) {
  const s = JSON.stringify(list), a = {};
  for (const [k, v] of Object.entries(E.doc.assets)) if (s.includes('a:' + k)) a[k] = v;
  return a;
}
E.copy = async (cut) => {
  const list = selEls();
  if (!list.length) return false;
  E.clip = { els: JSON.parse(JSON.stringify(list)), assets: assetsOf(list) };
  try { await navigator.clipboard.writeText(CLIP + JSON.stringify(E.clip)); } catch { /* clipboard permission */ }
  if (cut) E.deleteSel('Potong');
  return true;
};
E.pasteEls = (clip, shift = 16) => {
  if (!clip?.els?.length) return;
  Object.assign(E.doc.assets, clip.assets || {});
  const fresh = cloneEls(clip.els);
  const gm = {};
  for (const e of fresh) { if (e.group) e.group = gm[e.group] ||= 'g' + uid(6); e.x += shift; if (e.type !== 'line' || true) e.y += shift; delete e.ph; delete e.mid; }
  els().push(...fresh);
  E.sel = new Set(fresh.map(e => e.id));
  E.commit('Tempel');
};
export async function onPaste(ev) {
  if (E.dead || E.editing || dialogOpen() || document.querySelector('.show-root')) return;
  if (ev.target.closest?.('input, textarea') && !ev.target.closest('.stage')) return;
  if (E.lockView) return;
  const d = ev.clipboardData;
  const txt = d?.getData('text/plain') || '';
  if (ev.target.closest?.('.strip') && E.slideClip) { ev.preventDefault(); E.pasteSlides?.(); return; }
  if (txt.startsWith(CLIP)) { ev.preventDefault(); try { const c = JSON.parse(txt.slice(CLIP.length)); E.clip = c; E.pasteEls(c); } catch { /* corrupt */ } return; }
  const files = [...(d?.files || [])].filter(f => f.type.startsWith('image/'));
  if (files.length) { ev.preventDefault(); for (const f of files) await E.insertImageFile?.(f); return; }
  if (txt.trim()) {
    ev.preventDefault();
    const e = textEl({ html: txt.split(/\r?\n/).map(l => `<p>${l.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) || '<br>'}</p>`).join(''), box: { va: 'top', pad: [8, 10, 8, 10], fit: 'grow', cols: 1 }, def: { size: 18 } });
    const f = frame(E.doc);
    Object.assign(e, { x: f.l + 40, y: f.t + 80, w: Math.min(600, f.W - 80) });
    els().push(e);
    E.sel = new Set([e.id]);
    E.commit('Tempel teks');
    requestAnimationFrame(() => { const n = nodeOf(e.id); if (n) { const tx = n.querySelector('.txi'); e.h = Math.max(40, tx.scrollHeight + 20); E.render(); } });
  }
}
E.deleteSel = (label = 'Hapus') => {
  const list = selEls().filter(e => !e.locked);
  if (!list.length) return;
  const arr = els();
  for (const e of list) {
    if (e.ph && !E.editMaster) { /* removing a placeholder removes it for good, like Slides */ }
    arr.splice(arr.indexOf(e), 1);
  }
  const s = slide();
  if (s) s.anims = (s.anims || []).filter(a => !list.some(e => e.id === a.el));
  E.sel = new Set();
  E.commit(label);
};

// ---------- slides ----------
E.goSlide = (i, keepSel) => {
  const d = E.doc;
  if (!d) return;
  i = Math.max(0, Math.min(d.slides.length - 1, i));
  if (E.editing) endEdit();
  const changed = i !== E.cur;
  E.cur = i;
  if (!keepSel) E.sel = new Set();
  if (!E.stripSel.has(d.slides[i].id) || E.stripSel.size <= 1) E.stripSel = new Set([d.slides[i].id]);
  E.render();
  E.markStrip?.();
  if (changed) { E.updateNotes?.(); E.refreshPanel?.('slide'); }
  E.updateToolbar?.();
  E.updateStatus?.();
};

// ---------- open / close ----------
export async function openEditor(root, id, app) {
  let d = await Store.get(id);
  if (!d) { toast('Presentasi tidak ditemukan'); location.hash = '#/'; return null; }
  normalize(d);
  if (d.lock && !Lock.isOpen(d) && !d.share?.key) {
    const ok = await Lock.gate(root, d);
    if (!ok) { location.hash = '#/'; return null; }
  }
  E.doc = d;
  E.dead = false;
  E.cur = 0; E.sel = new Set(); E.editing = null; E.editMaster = false; E.lockView = false; E.dirty = false;
  E.stripSel = new Set([d.slides[0]?.id]);
  E.view.notes = Prefs.notes; E.view.margins = Prefs.margins; E.view.grid = Prefs.grid; E.view.snapGrid = Prefs.snapGrid;
  E.app = app;
  d.opened = Date.now();
  Store.patch(d.id, { opened: d.opened }).catch(() => { });
  const { buildEditorChrome } = await import('./chrome.js');
  const node = buildEditorChrome();
  root.replaceChildren(node);
  document.title = d.title + ' - Amatu Slides';
  Hist.reset();
  lastVer = Date.now() - 9 * 60e3;
  E.renderStrip?.();
  E.updateNotes?.();
  requestAnimationFrame(() => { setZoom('fit'); E.updateToolbar?.(); E.updateStatus?.(); });
  const keyH = ev => onKey(ev), pasteH = ev => onPaste(ev);
  const copyH = ev => {
    if (E.dead || E.editing || ev.target.closest?.('input, textarea')) return;
    if (ev.target.closest?.('.strip') && E.copySlides?.(ev.type === 'cut')) { ev.preventDefault(); return; }
    if (selEls().length) { ev.preventDefault(); const list = selEls(); E.clip = { els: JSON.parse(JSON.stringify(list)), assets: assetsOf(list) }; ev.clipboardData.setData('text/plain', CLIP + JSON.stringify(E.clip)); if (ev.type === 'cut') E.deleteSel('Potong'); }
  };
  document.addEventListener('keydown', keyH);
  document.addEventListener('paste', pasteH);
  document.addEventListener('copy', copyH);
  document.addEventListener('cut', copyH);
  const unload = () => { if (E.editing) syncEditing(); if (E.dirty) save(); };
  addEventListener('beforeunload', unload);
  const offStore = Store.onChange(async m => {   // another tab changed this presentation
    if (m.id !== d.id || m.t !== 'put' || E.dirty || E.editing || E.live) return;
    const fresh = await Store.get(d.id);
    if (!fresh || fresh.modified <= d.modified) return;
    for (const k of CONTENT_KEYS) d[k] = fresh[k];
    normalize(d);
    E.cur = Math.min(E.cur, d.slides.length - 1);
    Hist.reset();
    afterChange('all');
  });
  return {
    async destroy() {
      if (E.editing) endEdit(true);
      if (E.dirty) await save();
      document.removeEventListener('keydown', keyH);
      document.removeEventListener('paste', pasteH);
      document.removeEventListener('copy', copyH);
      document.removeEventListener('cut', copyH);
      removeEventListener('beforeunload', unload);
      offStore();
      E.dead = true;
      E.doc = null;
      closeMenus(0);
      document.querySelectorAll('.dimtip').forEach(x => x.remove());
    },
  };
}

export { setZoom as zoomTo, afterChange, assetURL, savePrefs };
