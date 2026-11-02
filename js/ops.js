// Editing operations: text formatting, inserting, arranging, slides, themes, page setup.
import { E, slide, els, elById, selEls, one } from './state.js';
import { h, toast, uid, readFile, pickFile, ask } from './ui.js';
import { frame, layoutBoxes, phEl, newSlide, cloneSlide, textEl, shapeEl, imageEl, cloneTheme, themeById, paras, pt2px, px2pt, BOX, DEF_MARGIN } from './model.js';
import { bbox, fitText } from './render.js';
import { fontCss, fontNameOf, ensureFont } from './fonts.js';
import { union } from './editor.js';

const nodeOf = id => E.slideNode?.querySelector(`.el[data-id="${id}"]`);
const textual = e => e && (e.type === 'text' || e.type === 'shape' || e.type === 'table');

// ---------- text formatting ----------
// While editing: execCommand on the selection. With boxes selected: apply to all of their text at once
// (temporarily editable, select all, execCommand) — empty placeholders store the style in their defaults.
function exec(cmd, val = null, css = true) {
  document.execCommand('styleWithCSS', false, css);
  document.execCommand(cmd, false, val);
}
function editable(e) {
  const n = nodeOf(e.id);
  if (!n) return null;
  if (e.type === 'table') return n.querySelector('table');
  return n.querySelector('.txi');
}
function readBack(e, host) {
  if (e.type === 'table') host.querySelectorAll('td').forEach(td => { const c = e.rows[+td.dataset.r]?.[+td.dataset.c]; if (c) c.html = E.clean(td.innerHTML); });
  else e.html = E.clean(host.innerHTML);
}
export function withText(fn, defFn, label = 'Format teks') {
  if (E.editing) { fn(); E.markTyping(); E.updateToolbar?.(); return; }
  const list = selEls().filter(textual);
  if (!list.length) return;
  const sel = getSelection();
  for (const e of list) {
    const empty = e.type !== 'table' && !e.html;
    if (empty) { e.def ||= {}; defFn?.(e.def, e); continue; }
    const host = editable(e);
    if (!host) continue;
    host.contentEditable = 'true';
    if (e.type === 'table') host.querySelectorAll('td').forEach(td => td.removeAttribute('contenteditable'));
    host.focus({ preventScroll: true });
    const r = document.createRange(); r.selectNodeContents(host); sel.removeAllRanges(); sel.addRange(r);
    fn(e);
    readBack(e, host);
    host.removeAttribute('contenteditable');
  }
  sel.removeAllRanges();
  E.scroll?.focus({ preventScroll: true });
  E.commit(label);
}
export const fmt = {
  bold: () => withText(() => exec('bold'), d => { d.bold = !d.bold; }),
  italic: () => withText(() => exec('italic'), d => { d.italic = !d.italic; }),
  underline: () => withText(() => exec('underline')),
  strike: () => withText(() => exec('strikeThrough')),
  sup: () => withText(() => exec('superscript', null, false)),
  sub: () => withText(() => exec('subscript', null, false)),
  color: c => withText(() => exec('foreColor', c || '#000000'), d => { d.color = c; }, 'Warna teks'),
  hilite: c => withText(() => exec('hiliteColor', c || 'transparent'), null, 'Sorotan'),
  font: name => { ensureFont(name); withText(() => exec('fontName', fontCss(name)), d => { d.font = name; }, 'Font'); },
  size: pt => withText(() => setSize(pt), d => { d.size = pt; }, 'Ukuran font'),
  grow: dir => withText(e => stepSize(dir), d => { d.size = Math.max(4, (d.size || 18) + dir * 2); }, 'Ukuran font'),
  align: a => withText(() => exec({ left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight', justify: 'justifyFull' }[a]), d => { d.align = a; }, 'Perataan'),
  bullets: style => withText(() => list('ul', style), d => { d.list = true; }, 'Butir'),
  numbers: style => withText(() => list('ol', style), null, 'Penomoran'),
  indent: () => withText(() => exec('indent')),
  outdent: () => withText(() => exec('outdent')),
  clear: () => withText(e => { exec('removeFormat', null, false); const host = e ? editable(e) : document.activeElement; host?.querySelectorAll?.('[style]').forEach(x => { if (x.tagName !== 'LI' && x.tagName !== 'UL' && x.tagName !== 'OL') x.removeAttribute('style'); }); }, d => { delete d.bold; delete d.italic; }, 'Hapus format'),
  lineHeight: v => {
    if (E.editing) { blocksInSel().forEach(b => { b.style.lineHeight = v; }); E.markTyping(); return; }
    for (const e of selEls().filter(textual)) { e.def ||= {}; e.def.lh = v; e.html = (e.html || '').replace(/line-height:[^;"]*;?/g, ''); }
    E.commit('Spasi baris');
  },
  paraSpace: (before, after) => {
    const set = b => { if (before != null) b.style.marginTop = before + 'px'; if (after != null) b.style.marginBottom = after + 'px'; };
    if (E.editing) { blocksInSel().forEach(set); E.markTyping(); return; }
    withText(e => { editable(e)?.querySelectorAll('p, li').forEach(set); }, null, 'Spasi paragraf');
  },
  link: async () => {
    const e = one();
    if (E.editing) {
      const r = getSelection().rangeCount ? getSelection().getRangeAt(0).cloneRange() : null;
      const url = await E.linkDialog?.('');
      if (!url) return;
      const s = getSelection(); s.removeAllRanges(); if (r) s.addRange(r);
      if (r && r.collapsed) exec('insertHTML', `<a href="${url.replace(/"/g, '&quot;')}">${url.replace(/[<>&]/g, '')}</a>`);
      else exec('createLink', url);
      E.markTyping();
      return;
    }
    if (!e) return toast('Pilih objek atau teks untuk ditautkan');
    const url = await E.linkDialog?.(e.link || '', true);
    if (url == null) return;
    if (url) e.link = url; else delete e.link;
    E.commit('Tautan');
  },
  upper: () => { for (const e of selEls().filter(textual)) { e.def ||= {}; e.def.upper = !e.def.upper; } E.commit('Huruf kapital'); },
  cols: n => { for (const e of selEls().filter(x => x.box)) e.box.cols = n; E.commit('Kolom teks'); },
  valign: v => { for (const e of selEls().filter(x => x.box)) e.box.va = v; E.commit('Perataan vertikal'); },
};
function setSize(pt) {
  document.execCommand('styleWithCSS', false, false);
  document.execCommand('fontSize', false, '7');
  const host = getSelection().anchorNode?.parentElement?.closest('.txi, table') || document.activeElement;
  host?.querySelectorAll?.('font[size="7"]').forEach(f => {
    const s = document.createElement('span');
    s.style.fontSize = pt2px(pt) + 'px';
    s.append(...f.childNodes);
    s.querySelectorAll('[style*="font-size"]').forEach(x => x.style.removeProperty('font-size'));
    f.replaceWith(s);
  });
}
function stepSize(dir) {
  const cur = currentSize() || 18;
  const steps = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96, 120, 144];
  const next = dir > 0 ? steps.find(s => s > cur + .4) || cur + 12 : [...steps].reverse().find(s => s < cur - .4) || Math.max(4, cur - 1);
  setSize(next);
}
function list(tag, style) {
  const cmd = tag === 'ul' ? 'insertUnorderedList' : 'insertOrderedList';
  const inList = () => { const n = getSelection().anchorNode; return (n?.nodeType === 1 ? n : n?.parentElement)?.closest(tag); };
  if (!inList() || !style) exec(cmd, null, false);
  if (style) {
    const host = getSelection().anchorNode?.parentElement?.closest('.txi, td') || document.activeElement;
    const lists = new Set(blocksInSel().map(b => b.closest(tag)).filter(Boolean));
    if (!lists.size) host?.querySelectorAll?.(tag).forEach(l => lists.add(l));
    lists.forEach(l => { l.style.listStyleType = style.startsWith('"') ? style : style; });
  }
}
function blocksInSel() {
  const s = getSelection();
  if (!s.rangeCount) return [];
  const r = s.getRangeAt(0);
  const host = (r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement).closest('.txi, td');
  if (!host) return [];
  const all = [...host.querySelectorAll('p, li')];
  const hit = all.filter(b => r.intersectsNode(b) && !b.querySelector('p, li'));
  if (hit.length) return hit;
  const one = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement).closest('p, li');
  return one ? [one] : [];
}
// Current text style for the toolbar (selection while editing, else first selected box).
function probe() {
  if (E.editing) {
    const n = getSelection().anchorNode;
    const el = n?.nodeType === 1 ? n : n?.parentElement;
    return el?.closest('.txi, td') ? el : nodeOf(E.editing)?.querySelector('.txi');
  }
  const e = selEls().find(textual);
  if (!e) return null;
  const n = nodeOf(e.id);
  if (!n) return null;
  const w = document.createTreeWalker(n.querySelector('.txi, table') || n, NodeFilter.SHOW_TEXT);
  let t; while ((t = w.nextNode())) if (t.textContent.trim()) return t.parentElement;
  return n.querySelector('.txi, td');
}
export function currentSize() { const p = probe(); if (!p) return null; const z = parseFloat(p.closest('.txi')?.style.zoom) || 1; return Math.round(px2pt(parseFloat(getComputedStyle(p).fontSize)) * z * 2) / 2; }
export function currentFont() { const p = probe(); return p ? fontNameOf(getComputedStyle(p).fontFamily) : 'Arial'; }
export function currentColor() { const p = probe(); return p ? getComputedStyle(p).color : '#000'; }
export function currentAlign() { const p = probe(); const a = p ? getComputedStyle(p.closest('p, li, td, .txi') || p).textAlign : 'left'; return a === 'start' ? 'left' : a === 'end' ? 'right' : a; }
export function cmdState(c) {
  if (E.editing) { try { return document.queryCommandState(c); } catch { return false; } }
  const p = probe();
  if (!p) return false;
  const cs = getComputedStyle(p);
  if (c === 'bold') return +cs.fontWeight >= 600;
  if (c === 'italic') return cs.fontStyle === 'italic';
  if (c === 'underline') return /underline/.test(cs.textDecorationLine) || !!p.closest('u');
  if (c === 'strikeThrough') return /line-through/.test(cs.textDecorationLine) || !!p.closest('s, strike');
  return false;
}

// ---------- element properties ----------
export function setProp(fn, label = 'Format') {
  const list = selEls();
  if (!list.length) return;
  for (const e of list) fn(e);
  E.commit(label);
}

// ---------- insert ----------
function center(e, f = frame(E.doc)) {
  e.x = Math.round(f.l + (f.W - e.w) / 2); e.y = Math.round(f.t + (f.H - e.h) / 2);
  return e;
}
export function addEl(e, label = 'Sisipkan') {
  if (E.editing) E.endEdit(true);
  els().push(e);
  E.sel = new Set([e.id]);
  E.commit(label);
  return e;
}
export function insertText(o = {}) {
  const e = textEl({ w: 400, h: 54, html: '', box: { ...BOX(), fit: 'grow' }, def: { size: 18 }, ...o });
  center(e);
  addEl(e, 'Kotak teks');
  E.startEdit(e.id);
}
export const WORDART = [
  ['Gradien', { size: 60, bold: true, font: 'head' }, { grad: { c1: '@a1', c2: '@a2', ang: 90 } }],
  ['Garis tepi', { size: 60, bold: true, font: 'head', color: '@bg' }, { outline: { c: '@a1', w: 2 } }],
  ['Bayangan', { size: 60, bold: true, font: 'head', color: '@a1' }, { shadow: { x: 4, y: 5, b: 6, c: 'rgba(0,0,0,.35)' } }],
  ['Cahaya', { size: 60, bold: true, font: 'head', color: '#ffffff' }, { glow: { c: '@a1', b: 16 } }],
  ['Retro', { size: 60, bold: true, font: 'head', color: '@a3' }, { shadow: { x: 4, y: 4, b: 0, c: '@a2' } }],
  ['Neon', { size: 60, bold: true, font: 'head', color: '@a6' }, { glow: { c: '@a6', b: 20 }, outline: { c: '#ffffff', w: 1 } }],
];
export function insertWordArt(i = 0) {
  const [, def, tfx] = WORDART[i];
  const e = textEl({ w: 640, h: 110, html: '<p style="text-align:center">Teks Anda di sini</p>', box: { ...BOX(), va: 'middle', fit: 'grow' }, def: { ...def }, tfx: JSON.parse(JSON.stringify(tfx)) });
  center(e);
  addEl(e, 'WordArt');
  E.startEdit(e.id);
  E.selectAllText();
}
export function insertShape(shape) {
  const e = shapeEl(shape);
  if (shape === 'line' || shape === 'arrow' || shape === 'dline' || shape === 'elbow' || shape === 'curve') { const f = frame(E.doc); e.x = f.l + f.W / 2 - 120; e.y = f.t + f.H / 2; e.w = 240; e.h = shape === 'elbow' || shape === 'curve' ? 120 : 0; }
  else { if (['ellipse', 'star5', 'star4', 'star6', 'star12', 'heart', 'plus', 'octagon', 'pentagon', 'hexagon', 'donut', 'moon', 'cube'].includes(shape)) e.w = e.h = 160; center(e); }
  return addEl(e, 'Bentuk');
}
const MAXPX = 1920;
async function shrinkImage(file) {
  const url = await readFile(file);
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return { url, w: 0, h: 0 };
  const img = await loadImg(url);
  let { naturalWidth: w, naturalHeight: hh } = img;
  if (w <= MAXPX && hh <= MAXPX && url.length < 1.5e6) return { url, w, h: hh };
  const k = Math.min(1, MAXPX / Math.max(w, hh));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(hh * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const png = file.type === 'image/png';
  return { url: c.toDataURL(png ? 'image/png' : 'image/jpeg', .86), w: c.width, h: c.height };
}
export const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
export function addAsset(dataUrl) {
  for (const [k, v] of Object.entries(E.doc.assets)) if (v === dataUrl) return 'a:' + k;
  const id = uid(10);
  E.doc.assets[id] = dataUrl;
  return 'a:' + id;
}
// Image into the selected picture placeholder, or a new picture fitted inside the margins.
export async function insertImageFile(file, target) {
  if (!file.type.startsWith('image/')) return;
  const r = await shrinkImage(file);
  let w = r.w, hh = r.h;
  if (!w) { const i = await loadImg(r.url).catch(() => null); w = i?.naturalWidth || 400; hh = i?.naturalHeight || 300; }
  placeImage(addAsset(r.url), w, hh, target);
}
export function placeImage(src, w, hh, target) {
  const ph = target || selEls().find(e => e.type === 'image' && (!e.src || e.ph === 'picture')) || (!selEls().length ? els().find(e => e.type === 'image' && e.ph === 'picture' && !e.src) : null);
  if (ph) { ph.src = src; ph.fit = 'cover'; E.sel = new Set([ph.id]); E.commit('Gambar'); return ph; }
  const f = frame(E.doc);
  const k = Math.min(1, f.W * .7 / w, f.H * .8 / hh);
  const e = imageEl(src, Math.round(w * k), Math.round(hh * k));
  center(e, f);
  return addEl(e, 'Gambar');
}
export async function insertImage() {
  const files = await pickFile('image/*', true);
  for (const f of files) await insertImageFile(f);
}
export async function insertImageUrl() {
  const url = await ask({ title: 'Sisipkan gambar dari URL', label: 'Tempel URL gambar (https://…)', placeholder: 'https://', ok: 'Sisipkan' });
  if (!url?.trim()) return;
  try {
    const img = await loadImg(url.trim());
    placeImage(url.trim(), img.naturalWidth, img.naturalHeight);
  } catch { toast('Gambar tidak dapat dimuat dari URL itu'); }
}
export async function replaceImage() {
  const e = one();
  if (!e || e.type !== 'image') return;
  const [f] = await pickFile('image/*');
  if (!f) return;
  const r = await shrinkImage(f);
  e.src = addAsset(r.url);
  delete e.crop;
  E.commit('Ganti gambar');
}
export function insertTable(r, c) {
  const f = frame(E.doc);
  const w = Math.min(f.W, c * 160), hh = Math.min(f.H - 60, r * 40);
  const e = {
    id: uid(8), type: 'table', x: 0, y: 0, w, h: hh, rot: 0,
    rows: Array.from({ length: r }, () => Array.from({ length: c }, () => ({ html: '' }))),
    colW: Array.from({ length: c }, () => 1 / c), tstyle: { head: true, band: true, c: '@a1' }, def: { size: 14 },
  };
  center(e, f);
  addEl(e, 'Tabel');
}
export const tbl = {
  cell() { const td = document.activeElement?.closest?.('td') || getSelection().anchorNode?.parentElement?.closest('td'); return td ? { r: +td.dataset.r, c: +td.dataset.c } : null; },
  op(kind) {
    const e = one();
    if (!e || e.type !== 'table') return;
    if (E.editing) E.syncEditing();
    const at = this.cell() || { r: e.rows.length - 1, c: e.rows[0].length - 1 };
    const C = e.rows[0].length;
    const blank = () => ({ html: '' });
    if (kind === 'row-above' || kind === 'row-below') { e.rows.splice(at.r + (kind === 'row-below' ? 1 : 0), 0, Array.from({ length: C }, blank)); e.h += e.h / (e.rows.length - 1); }
    if (kind === 'col-left' || kind === 'col-right') { const i = at.c + (kind === 'col-right' ? 1 : 0); e.rows.forEach(r => r.splice(i, 0, blank())); e.colW.splice(i, 0, 1 / C); const s = e.colW.reduce((a, b) => a + b, 0); e.colW = e.colW.map(x => x / s); }
    if (kind === 'del-row' && e.rows.length > 1) { e.rows.splice(at.r, 1); e.h -= e.h / (e.rows.length + 1); }
    if (kind === 'del-col' && C > 1) { e.rows.forEach(r => r.splice(at.c, 1)); e.colW.splice(at.c, 1); const s = e.colW.reduce((a, b) => a + b, 0); e.colW = e.colW.map(x => x / s); }
    if (kind === 'eq-cols') e.colW = e.colW.map(() => 1 / C);
    const was = E.editing;
    if (was) E.endEdit(true);
    E.commit('Tabel');
    if (was) E.startEdit(e.id);
  },
};
export const CHART_SAMPLE = () => [['', 'Penjualan', 'Target'], ['Jan', 42, 40], ['Feb', 55, 48], ['Mar', 61, 56], ['Apr', 74, 64]];
export function insertChart(type) {
  const f = frame(E.doc);
  const e = { id: uid(8), type: 'chart', x: 0, y: 0, w: Math.min(640, f.W), h: Math.min(360, f.H), rot: 0, chart: { type, data: type === 'pie' || type === 'donut' ? [['', 'Porsi'], ['Produk A', 45], ['Produk B', 30], ['Produk C', 25]] : CHART_SAMPLE(), title: '', legend: true, labels: type === 'pie' || type === 'donut' } };
  center(e, f);
  addEl(e, 'Bagan');
}
export function insertIcon(name, filled) {
  const e = { id: uid(8), type: 'icon', name, filled: !!filled, x: 0, y: 0, w: 96, h: 96, rot: 0, color: '@a1' };
  center(e);
  addEl(e, 'Ikon');
}
export function insertVideo(url, src) {
  const f = frame(E.doc);
  const e = { id: uid(8), type: 'video', url: url || '', src: src || '', x: 0, y: 0, w: Math.min(640, f.W), h: Math.min(360, f.W * 9 / 16), rot: 0 };
  center(e, f);
  addEl(e, 'Video');
}

// Diagram (SmartArt-like): grouped shapes generated from a list of lines.
export const DIAGRAMS = [
  ['process', 'Proses', 'arrow_right_alt'], ['chevrons', 'Chevron', 'double_arrow'], ['cycle', 'Siklus', 'autorenew'], ['list', 'Daftar blok', 'view_agenda'],
  ['pyramid', 'Piramida', 'change_history'], ['hierarchy', 'Hierarki', 'account_tree'], ['timeline', 'Garis waktu', 'timeline'], ['venn', 'Venn', 'join'], ['matrix', 'Matriks 2×2', 'grid_view'], ['funnel', 'Corong', 'filter_alt'],
];
export function makeDiagram(kind, items) {
  const f = frame(E.doc);
  const n = Math.max(1, items.length), g = 'g' + uid(6), out = [];
  const W = f.W, H = f.H * .78, X = f.l, Y = f.t + f.H * .18;
  const col = i => '@a' + ((i % 6) + 1);
  const shp = (shape, x, y, w, hh, i, o = {}) => out.push(shapeEl(shape, { x, y, w, h: hh, fill: col(i), html: `<p style="text-align:center">${items[i] ?? ''}</p>`, def: { size: Math.max(10, Math.min(20, 64 / Math.sqrt(n))), bold: true }, group: g, ...o }));
  if (kind === 'process' || kind === 'chevrons') {
    const gap = kind === 'process' ? 36 : -14, w = (W - gap * (n - 1)) / n, hh = Math.min(H * .5, 130);
    items.forEach((_, i) => {
      const x = X + i * (w + gap);
      shp(kind === 'process' ? 'round' : i ? 'chevron' : 'homeplate', x, Y + (H - hh) / 2, w, hh, i);
      if (kind === 'process' && i < n - 1) out.push(shapeEl('arrowR', { x: x + w + 6, y: Y + H / 2 - 14, w: gap - 12, h: 28, fill: '@tx2', group: g }));
    });
  } else if (kind === 'cycle') {
    const R = Math.min(W, H) * .36, cx = X + W / 2, cy = Y + H / 2, s = Math.min(150, R * 1.1);
    items.forEach((_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; shp('ellipse', cx + R * Math.cos(a) - s / 2, cy + R * Math.sin(a) - s / 2, s, s, i); });
    out.unshift(shapeEl('donut', { x: cx - R, y: cy - R, w: R * 2, h: R * 2, fill: '@bg2', group: g }));
  } else if (kind === 'list') {
    const gap = 12, hh = (H - gap * (n - 1)) / n;
    items.forEach((_, i) => shp('round', X + W * .1, Y + i * (hh + gap), W * .8, hh, i, { html: `<p>${items[i]}</p>`, box: { ...BOX(), va: 'middle', pad: [6, 20, 6, 20] } }));
  } else if (kind === 'pyramid' || kind === 'funnel') {
    const hh = H / n;
    items.forEach((_, i) => {
      const k = kind === 'pyramid' ? (i + 1) / n : 1 - i / n * .75, w = W * .7 * k;
      shp(kind === 'pyramid' && i === 0 ? 'triangle' : 'trapezoid', X + (W - w) / 2, Y + i * hh, w, hh - 4, i, kind === 'funnel' ? { flipV: true } : {});
    });
  } else if (kind === 'hierarchy') {
    const top = items[0] ?? '', kids = items.slice(1), m = Math.max(1, kids.length);
    const bw = Math.min(220, (W - 20 * (m - 1)) / m), bh = 70;
    shp('round', X + (W - bw) / 2, Y, bw, bh, 0);
    const y2 = Y + H - bh - 20;
    kids.forEach((_, j) => {
      const x = X + (W - (m * bw + (m - 1) * 20)) / 2 + j * (bw + 20);
      out.push(shapeEl('elbow', { x: X + W / 2, y: Y + bh, w: x + bw / 2 - (X + W / 2), h: y2 - Y - bh, stroke: { c: '@tx2', w: 2 }, head: null, group: g }));
      shp('round', x, y2, bw, bh, j + 1);
    });
    void top;
  } else if (kind === 'timeline') {
    out.push(shapeEl('arrow', { x: X, y: Y + H / 2, w: W, h: 0, stroke: { c: '@tx2', w: 4 }, head: 'arrow', group: g }));
    items.forEach((t, i) => {
      const x = X + (i + .5) * W / n;
      out.push(shapeEl('ellipse', { x: x - 12, y: Y + H / 2 - 12, w: 24, h: 24, fill: col(i), group: g }));
      out.push(textEl({ x: x - W / n / 2 + 4, y: i % 2 ? Y + H / 2 + 24 : Y + H / 2 - 90, w: W / n - 8, h: 66, html: `<p style="text-align:center">${t}</p>`, def: { size: 14 }, box: { ...BOX(), va: i % 2 ? 'top' : 'bottom' }, group: g }));
    });
  } else if (kind === 'venn') {
    const s = Math.min(H * .7, W * .36), cx = X + W / 2, cy = Y + H / 2;
    const pos = n === 2 ? [[-s * .3, 0], [s * .3, 0]] : [[0, -s * .25], [-s * .3, s * .2], [s * .3, s * .2]];
    items.slice(0, pos.length).forEach((_, i) => shp('ellipse', cx + pos[i][0] - s / 2, cy + pos[i][1] - s / 2, s, s, i, { fillOp: .6 }));
  } else if (kind === 'matrix') {
    const w = W * .36, hh = H * .44;
    items.slice(0, 4).forEach((_, i) => shp('round', X + W / 2 - w - 6 + (i % 2) * (w + 12), Y + (H - 2 * hh - 12) / 2 + Math.floor(i / 2) * (hh + 12), w, hh, i));
  }
  if (out.length === 1) delete out[0].group;
  return out;
}
export function insertDiagram(kind, items) {
  const list = makeDiagram(kind, items.length ? items : ['Langkah 1', 'Langkah 2', 'Langkah 3']);
  if (E.editing) E.endEdit(true);
  els().push(...list);
  E.sel = new Set(list.map(e => e.id));
  E.commit('Diagram');
}

// ---------- arrange ----------
export function zorder(kind) {
  const arr = els(), list = selEls();
  if (!list.length) return;
  const ids = new Set(list.map(e => e.id));
  const rest = arr.filter(e => !ids.has(e.id));
  if (kind === 'front') arr.splice(0, arr.length, ...rest, ...list);
  else if (kind === 'back') arr.splice(0, arr.length, ...list, ...rest);
  else {
    const idx = list.map(e => arr.indexOf(e)).sort((a, b) => kind === 'forward' ? b - a : a - b);
    for (const i of idx) {
      const j = kind === 'forward' ? i + 1 : i - 1;
      if (j < 0 || j >= arr.length || ids.has(arr[j].id)) continue;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  E.commit('Urutan');
}
// Align to the slide (one object) or to the selection (several).
export function align(kind, toSlide) {
  const list = selEls().filter(e => !e.locked);
  if (!list.length) return;
  const d = E.doc;
  const ref = toSlide || list.length === 1 ? { x: 0, y: 0, w: d.page.w, h: d.page.h } : union(list);
  const groups = groupsOf(list);
  for (const g of groups) {
    const b = union(g);
    let dx = 0, dy = 0;
    if (kind === 'left') dx = ref.x - b.x;
    if (kind === 'center') dx = ref.x + ref.w / 2 - (b.x + b.w / 2);
    if (kind === 'right') dx = ref.x + ref.w - (b.x + b.w);
    if (kind === 'top') dy = ref.y - b.y;
    if (kind === 'middle') dy = ref.y + ref.h / 2 - (b.y + b.h / 2);
    if (kind === 'bottom') dy = ref.y + ref.h - (b.y + b.h);
    g.forEach(e => { e.x += dx; e.y += dy; });
  }
  E.commit('Ratakan');
}
function groupsOf(list) {
  const m = new Map();
  for (const e of list) { const k = e.group || e.id; if (!m.has(k)) m.set(k, []); m.get(k).push(e); }
  return [...m.values()];
}
export function distribute(axis) {
  const gs = groupsOf(selEls().filter(e => !e.locked)).map(g => ({ g, b: union(g) }));
  if (gs.length < 3) return toast('Pilih minimal 3 objek untuk didistribusikan');
  const X = axis === 'h' ? 'x' : 'y', W = axis === 'h' ? 'w' : 'h';
  gs.sort((a, b) => a.b[X] - b.b[X]);
  const first = gs[0].b, last = gs[gs.length - 1].b;
  const total = gs.reduce((s, o) => s + o.b[W], 0);
  const gap = (last[X] + last[W] - first[X] - total) / (gs.length - 1);
  let pos = first[X];
  for (const o of gs) { const d = pos - o.b[X]; o.g.forEach(e => { e[X] += d; }); pos += o.b[W] + gap; }
  E.commit('Distribusikan');
}
export function rotate(kind) {
  setProp(e => {
    if (kind === 'cw') e.rot = ((e.rot || 0) + 90) % 360;
    if (kind === 'ccw') e.rot = ((e.rot || 0) + 270) % 360;
    if (kind === 'h') e.flipH = !e.flipH;
    if (kind === 'v') e.flipV = !e.flipV;
    if (kind === 'reset') { e.rot = 0; e.flipH = e.flipV = false; }
  }, 'Putar');
}
export function group() {
  const list = selEls();
  if (list.length < 2) return;
  const g = 'g' + uid(6);
  list.forEach(e => { e.group = g; });
  E.commit('Kelompokkan');
}
export function ungroup() { setProp(e => { delete e.group; }, 'Pisahkan kelompok'); }
export function lockToggle() { const lock = !selEls().every(e => e.locked); setProp(e => { e.locked = lock; }, lock ? 'Kunci posisi' : 'Buka kunci'); }
export function duplicate() {
  const list = selEls();
  if (!list.length) return;
  E.pasteEls({ els: JSON.parse(JSON.stringify(list)), assets: {} }, 16);
}
export function sameSize(kind) {
  const list = selEls();
  if (list.length < 2) return;
  const r = list[0];
  for (const e of list.slice(1)) { if (kind !== 'h') e.w = r.w; if (kind !== 'w') e.h = r.h; }
  E.commit('Samakan ukuran');
}

// ---------- format painter ----------
const STYLE_KEYS = ['fill', 'stroke', 'shadow', 'opacity', 'tcol', 'def', 'tfx', 'box', 'radius', 'ifx', 'mask', 'head', 'tail', 'fillOp', 'tstyle'];
E.setPainter = (src, keep) => {
  E.painter = src ? { src: JSON.parse(JSON.stringify(src)), keep } : null;
  E.root?.classList.toggle('painting', !!src);
  E.updateToolbar?.();
  if (src) toast('Klik objek untuk menerapkan format' + (keep ? ' (Esc untuk berhenti)' : ''), { ms: 2200 });
};
E.applyPainter = id => {
  const e = elById(id), s = E.painter?.src;
  if (!e || !s) return;
  for (const k of STYLE_KEYS) {
    if (!(k in s)) continue;
    if (k === 'box' && e.box) { e.box = { ...e.box, va: s.box.va, pad: s.box.pad }; continue; }
    if (k === 'def' && s.def) { e.def = { ...(e.def || {}), ...s.def }; if (e.html) e.html = e.html.replace(/(font-size|font-family|color|font-weight|font-style):[^;"]*;?/g, ''); continue; }
    if ((e.type === 'line') !== (s.type === 'line') && (k === 'fill' || k === 'head' || k === 'tail')) continue;
    e[k] = JSON.parse(JSON.stringify(s[k]));
  }
  E.sel = new Set([id]);
  if (!E.painter.keep) E.setPainter(null);
  E.commit('Salin format');
};

// ---------- slides ----------
const targetIdx = () => { const ids = E.stripSel.size ? [...E.stripSel] : [slide().id]; return E.doc.slides.map((s, i) => (ids.includes(s.id) ? i : -1)).filter(i => i >= 0); };
export function addSlide(layout, at) {
  const d = E.doc;
  const cur = slide();
  const lay = layout || (cur?.layout === 'title' ? 'title-body' : cur?.layout && cur.layout !== 'blank' ? cur.layout : 'title-body');
  const s = newSlide(d, lay);
  const i = at ?? E.cur + 1;
  d.slides.splice(i, 0, s);
  E.cur = i;
  E.sel = new Set();
  E.stripSel = new Set([s.id]);
  E.commit('Slide baru', 'all');
}
export function duplicateSlides() {
  const d = E.doc, idx = targetIdx();
  const copies = idx.map(i => cloneSlide(d.slides[i]));
  const at = Math.max(...idx) + 1;
  d.slides.splice(at, 0, ...copies);
  E.cur = at;
  E.stripSel = new Set(copies.map(s => s.id));
  E.commit('Duplikat slide', 'all');
}
export function deleteSlides() {
  const d = E.doc, idx = targetIdx();
  if (idx.length >= d.slides.length) { d.slides = [newSlide(d, 'title')]; }
  else for (const i of [...idx].sort((a, b) => b - a)) d.slides.splice(i, 1);
  const ids = new Set(d.slides.map(s => s.id));
  d.comments = d.comments.filter(c => ids.has(c.slide));
  E.cur = Math.min(idx[0], d.slides.length - 1);
  E.stripSel = new Set([d.slides[E.cur].id]);
  E.sel = new Set();
  E.commit('Hapus slide', 'all');
}
export function moveSlides(to) {
  const d = E.doc, idx = targetIdx();
  const moving = idx.map(i => d.slides[i]);
  const rest = d.slides.filter(s => !moving.includes(s));
  let at = to === 'start' ? 0 : to === 'end' ? rest.length : to === 'up' ? Math.max(0, idx[0] - 1) : to === 'down' ? Math.min(rest.length, idx[0] + 1) : to;
  at = Math.max(0, Math.min(rest.length, at));
  rest.splice(at, 0, ...moving);
  d.slides = rest;
  E.cur = d.slides.indexOf(moving[0]);
  E.commit('Pindahkan slide', 'all');
}
export function skipSlides() {
  const d = E.doc, idx = targetIdx();
  const skip = !idx.every(i => d.slides[i].skip);
  idx.forEach(i => { d.slides[i].skip = skip; });
  E.commit(skip ? 'Lewati slide' : 'Tampilkan slide', 'all');
}
// Apply a layout: keep the text of matching placeholders, move them to the new boxes; drop empty ones.
export function applyLayout(id, sl = slide()) {
  const d = E.doc;
  const boxes = layoutBoxes(id, d);
  const old = sl.els;
  const used = new Set();
  const out = [];
  for (const b of boxes) {
    const m = old.find(e => e.ph === b.role && !used.has(e.id)) || (b.role.startsWith('body') ? old.find(e => e.ph?.startsWith('body') && !used.has(e.id)) : null) || (b.role === 'subtitle' ? old.find(e => e.ph === 'body' && !used.has(e.id)) : null);
    const fresh = phEl(b, m?.html || '');
    if (m) { used.add(m.id); Object.assign(m, { x: fresh.x, y: fresh.y, w: fresh.w, h: fresh.h, ph: b.role, def: { ...fresh.def, ...(m.def?.color && m.def.color !== fresh.def?.color && !m.ph ? { color: m.def.color } : {}) } }); if (m.box) m.box.va = fresh.box?.va || m.box.va; out.push(m); }
    else out.push(fresh);
  }
  for (const e of old) if (!used.has(e.id) && (!e.ph || e.html || (e.type === 'image' && e.src))) { if (e.ph) delete e.ph; out.push(e); }
  sl.els = out;
  sl.layout = id;
}
export function setLayout(id) {
  const d = E.doc, idx = targetIdx();
  for (const i of idx) applyLayout(id, d.slides[i]);
  E.sel = new Set();
  E.commit('Tata letak', 'all');
}
export function resetSlide() { const s = slide(); applyLayout(s.layout || 'title-body', s); E.commit('Setel ulang slide'); }

// ---------- theme / page ----------
export function applyTheme(t) {
  const d = E.doc;
  d.theme = cloneTheme(t);
  E.commit('Tema', 'all');
}
export function setPage(size, w, hh, margin, reflow) {
  const d = E.doc;
  const sx = w / d.page.w, sy = hh / d.page.h;
  const scaleEls = list => list.forEach(e => { e.x *= sx; e.y *= sy; e.w *= sx; e.h *= sy; });
  if (sx !== 1 || sy !== 1) { d.slides.forEach(s => scaleEls(s.els)); scaleEls(d.master); }
  d.page = { ...d.page, size, w, h: hh, margin: { ...DEF_MARGIN, ...margin } };
  if (reflow) for (const s of d.slides) {
    const boxes = layoutBoxes(s.layout, d);
    for (const b of boxes) { const e = s.els.find(x => x.ph === b.role); if (e) Object.assign(e, { x: b.x, y: b.y, w: b.w, h: b.h }); }
  }
  E.commit('Penyiapan halaman', 'all');
  E.zoomTo?.('fit');
}
export function setBackground(bg, all) {
  const d = E.doc;
  if (all) { d.theme.bg = bg; d.slides.forEach(s => { s.bg = null; }); }
  else targetIdx().forEach(i => { d.slides[i].bg = bg; });
  E.commit('Latar belakang', 'all');
}

// ---------- find & replace ----------
export function findAll(q, o = {}) {
  if (!q) return [];
  const re = new RegExp(o.regex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), o.case ? 'g' : 'gi');
  const hits = [];
  E.doc.slides.forEach((s, si) => {
    for (const e of s.els) {
      const texts = e.rows ? e.rows.flat().map(c => c.html) : [e.html];
      for (const t of texts) { const n = (E.text(t).match(re) || []).length; if (n) hits.push({ si, id: e.id, n }); }
    }
    if (o.notes && s.notes && re.test(s.notes)) hits.push({ si, notes: true, n: (s.notes.match(re) || []).length });
    re.lastIndex = 0;
  });
  return hits;
}
export function replaceAll(q, rep, o = {}) {
  const re = new RegExp(o.regex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), o.case ? 'g' : 'gi');
  let n = 0;
  const sub = html => {
    const t = document.createElement('template');
    t.innerHTML = html;
    const w = document.createTreeWalker(t.content, NodeFilter.SHOW_TEXT);
    let x;
    while ((x = w.nextNode())) { const v = x.textContent.replace(re, () => { n++; return rep; }); if (v !== x.textContent) x.textContent = v; }
    return t.innerHTML;
  };
  for (const s of E.doc.slides) {
    for (const e of s.els) { if (e.html) e.html = sub(e.html); if (e.rows) e.rows.flat().forEach(c => { if (c.html) c.html = sub(c.html); }); }
    if (o.notes && s.notes) s.notes = s.notes.replace(re, () => { n++; return rep; });
  }
  if (n) E.commit('Ganti semua', 'all');
  return n;
}

export { fitText, bbox, paras };
