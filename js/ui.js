// Small DOM toolkit: elements, menus, dialogs, tooltips, toasts, color palette.

export const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}

export const icon = (name, cls) => h('span', { class: 'ms' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' }, name);

export function uid(n = 10) {
  const a = 'abcdefghijkmnopqrstuvwxyz23456789';
  let s = '';
  for (const x of crypto.getRandomValues(new Uint8Array(n))) s += a[x % a.length];
  return s;
}
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function debounce(fn, ms) {
  let t;
  const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  f.cancel = () => clearTimeout(t);
  f.now = (...a) => { clearTimeout(t); fn(...a); };
  return f;
}
export function rafOnce(fn) {
  let p = false;
  return () => { if (p) return; p = true; requestAnimationFrame(() => { p = false; fn(); }); };
}

const KMAP_MAC = { Mod: '⌘', Alt: '⌥', Shift: '⇧', Ctrl: '⌃', Enter: '↩', Backspace: '⌫', Escape: 'esc' };
export function kbdLabel(k) {
  if (!k) return '';
  const p = k.split('+');
  if (isMac) return p.map(x => KMAP_MAC[x] || x).join('');
  return p.map(x => (x === 'Mod' ? 'Ctrl' : x)).join('+');
}
const CODE = { Period: '.', Comma: ',', Slash: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Semicolon: ';', Quote: "'", Backquote: '`', Space: 'Space' };
export function keyOf(e) {
  let k = e.code || '';
  if (k.startsWith('Key')) k = k.slice(3);
  else if (k.startsWith('Digit')) k = k.slice(5);
  else if (k.startsWith('Numpad') && /\d$/.test(k)) k = k.slice(6);
  else k = CODE[k] || e.key;
  const mod = isMac ? e.metaKey : e.ctrlKey;
  return (mod ? 'Mod+' : '') + (e.altKey ? 'Alt+' : '') + (e.shiftKey ? 'Shift+' : '') + k;
}

const DTF_T = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });
export function fmtWhen(ts) {
  if (!ts) return '';
  const d = new Date(ts), n = new Date();
  if (d.toDateString() === n.toDateString()) return DTF_T.format(d);
  const y = new Date(n); y.setDate(n.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Kemarin';
  return d.toLocaleDateString('id-ID', d.getFullYear() === n.getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}
export function fmtFull(ts) {
  return new Date(ts).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export const fmtNum = n => new Intl.NumberFormat('id-ID').format(n);

export function hashColor(s) {
  const C = ['#1a73e8', '#d93025', '#188038', '#e37400', '#9334e6', '#c2185b', '#00838f', '#5f6368', '#3949ab', '#6d4c41'];
  let x = 0;
  for (const ch of String(s)) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  return C[x % C.length];
}
export function initials(name) {
  const p = String(name || '?').trim().split(/\s+/);
  return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
export const avatar = (name, cls = '') => h('div', { class: 'av ' + cls, style: { background: hashColor(name) }, title: name }, initials(name));

/* ---------- Tooltip ---------- */
let tipEl = null, tipT = 0;
function hideTip() { clearTimeout(tipT); tipEl?.remove(); tipEl = null; }
function showTip(t) {
  hideTip();
  if (!t.isConnected) return;
  tipEl = h('div', { class: 'tip' }, t.dataset.tip, t.dataset.kbd ? h('span', { class: 'tip-k' }, kbdLabel(t.dataset.kbd)) : null);
  tipEl._for = t;
  document.body.append(tipEl);
  const r = t.getBoundingClientRect(), tr = tipEl.getBoundingClientRect();
  let x = r.left + r.width / 2 - tr.width / 2;
  x = Math.max(6, Math.min(innerWidth - tr.width - 6, x));
  let y = r.bottom + 6;
  if (y + tr.height > innerHeight - 4) y = r.top - tr.height - 6;
  tipEl.style.left = x + 'px';
  tipEl.style.top = y + 'px';
}
document.addEventListener('mouseover', e => {
  const t = e.target.closest?.('[data-tip]');
  if (!t) { if (tipEl || tipT) hideTip(); return; }
  if (tipEl?._for === t) return;
  hideTip();
  tipT = setTimeout(() => showTip(t), 480);
});
document.addEventListener('mousedown', hideTip, true);
document.addEventListener('keydown', hideTip, true);

/* ---------- Toast ---------- */
let toastEl = null;
export function toast(msg, o = {}) {
  toastEl?.remove();
  const el = toastEl = h('div', { class: 'toast glass-strong', role: 'status' },
    h('span', null, msg),
    o.action ? h('button', { class: 'btn-text', onclick: () => { o.onAction?.(); el.remove(); } }, o.action) : null);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 260); }, o.ms || 3600);
}

/* ---------- Menus ---------- */
const stack = [];
export const menuOpen = () => stack.length > 0;
export const menuAnchor = () => stack[0]?.anchorEl || null;
export function closeMenus(from = 0) {
  while (stack.length > from) {
    const m = stack.pop();
    m.el.remove();
    m.anchorEl?.classList.remove('open');
    m.onClose?.();
  }
}
export function toggleMenu(anchor, items, o) {
  if (stack[0]?.anchorEl === anchor) { closeMenus(0); return null; }
  return openMenu(anchor, items, o);
}

export function openMenu(anchor, items, o = {}) {
  const level = o.level || 0;
  closeMenus(level);
  const el = h('div', { class: 'menu glass-strong' + (o.cls ? ' ' + o.cls : ''), role: 'menu', tabindex: '-1' });
  if (o.width) el.style.width = o.width + 'px';
  el.addEventListener('mousedown', e => { if (!e.target.closest('input, textarea, select, [contenteditable]')) e.preventDefault(); });
  const list = typeof items === 'function' ? items() : items;
  for (const it of list) {
    if (!it) continue;
    if (it.sep) { if (el.lastChild && !el.lastChild.classList.contains('menu-sep')) el.append(h('div', { class: 'menu-sep' })); continue; }
    if (it.head) { el.append(h('div', { class: 'menu-head' }, it.head)); continue; }
    if (it.el) { el.append(typeof it.el === 'function' ? it.el() : it.el); continue; }
    const dis = it.enabled ? !it.enabled() : false;
    const chk = it.checked ? !!it.checked() : undefined;
    const row = h('div', {
      class: 'mi' + (dis ? ' dis' : '') + (it.desc ? ' tall' : '') + (it.cls ? ' ' + it.cls : ''),
      role: chk === undefined ? 'menuitem' : 'menuitemcheckbox', 'aria-checked': chk === undefined ? null : String(chk), 'aria-disabled': dis ? 'true' : null,
    },
      h('span', { class: 'mi-ic' }, chk ? icon('check') : it.icon ? icon(it.icon) : null),
      h('span', { class: 'mi-l', style: it.style || null }, it.label, it.desc ? h('span', { class: 'desc' }, it.desc) : null),
      it.kbd ? h('span', { class: 'mi-k' }, kbdLabel(it.kbd)) : null,
      it.sub ? icon('chevron_right', 'mi-sub sm') : null);
    row._it = it;
    if (it.sub) {
      row._open = () => {
        if (dis) return;
        if (stack[level + 1]?.from === row) return;
        openMenu(row, it.sub, { level: level + 1, side: 'right', cls: it.subCls });
        stack[level + 1].from = row;
      };
      row.addEventListener('mouseenter', () => { clearTimeout(el._t); el._t = setTimeout(row._open, it.run ? 380 : 130); });
      row.addEventListener('click', it.run ? () => { if (dis) return; closeMenus(0); it.run(); } : row._open);
    } else {
      row.addEventListener('mouseenter', () => { clearTimeout(el._t); el._t = setTimeout(() => closeMenus(level + 1), 220); });
      row.addEventListener('click', () => { if (dis) return; if (!it.keep) closeMenus(0); it.run?.(); });
    }
    el.append(row);
  }
  if (el.lastChild?.classList?.contains('menu-sep')) el.lastChild.remove();
  document.body.append(el);
  placeFloating(el, anchor, o.side || 'below', o.align);
  const rec = { el, anchorEl: anchor instanceof Element ? anchor : null, onClose: o.onClose };
  stack[level] = rec;
  if (rec.anchorEl && level === 0) rec.anchorEl.classList.add('open');
  if (o.focus !== false && !el.querySelector('input,textarea')) el.focus({ preventScroll: true });
  return el;
}

export function placeFloating(el, a, side = 'below', align) {
  const r = a instanceof Element ? a.getBoundingClientRect() : { left: a.x, right: a.x + (a.w || 0), top: a.y, bottom: a.y + (a.h || 0) };
  el.style.maxHeight = (innerHeight - 16) + 'px';
  const m = el.getBoundingClientRect();
  let x, y;
  if (side === 'right') {
    x = r.right - 2; y = r.top - 7;
    if (x + m.width > innerWidth - 8) x = r.left - m.width + 2;
  } else if (side === 'above') {
    x = r.left; y = r.top - m.height - 6;
    if (y < 8) y = r.bottom + 6;
  } else {
    x = align === 'right' ? r.right - m.width : align === 'center' ? (r.left + r.right) / 2 - m.width / 2 : r.left;
    y = r.bottom + 5;
    if (y + m.height > innerHeight - 8) { const up = r.top - m.height - 5; y = up > 8 ? up : Math.max(8, innerHeight - m.height - 8); }
  }
  el.style.left = Math.max(8, Math.min(x, innerWidth - m.width - 8)) + 'px';
  el.style.top = Math.max(8, Math.min(y, innerHeight - m.height - 8)) + 'px';
}

document.addEventListener('mousedown', e => {
  if (!stack.length) return;
  if (e.target.closest?.('.menu')) return;
  if (stack[0].anchorEl?.contains(e.target)) return;
  closeMenus(0);
}, true);
addEventListener('resize', () => closeMenus(0));
addEventListener('blur', () => closeMenus(0));

document.addEventListener('keydown', e => {
  if (!stack.length) return;
  const top = stack[stack.length - 1];
  if (e.target.closest?.('.menu input, .menu textarea')) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenus(stack.length - 1); } return; }
  const rows = $$('.mi:not(.dis)', top.el);
  let i = rows.findIndex(r => r.classList.contains('hov'));
  const set = j => { rows.forEach(r => r.classList.remove('hov')); if (rows[j]) { rows[j].classList.add('hov'); rows[j].scrollIntoView({ block: 'nearest' }); } };
  const k = e.key;
  if (k === 'ArrowDown') { set((i + 1) % rows.length); }
  else if (k === 'ArrowUp') { set(i <= 0 ? rows.length - 1 : i - 1); }
  else if (k === 'ArrowRight' && rows[i]?._open) { rows[i]._open(); const sub = stack[stack.length - 1]; $('.mi:not(.dis)', sub.el)?.classList.add('hov'); }
  else if (k === 'ArrowLeft' && stack.length > 1) { closeMenus(stack.length - 1); }
  else if (k === 'Enter' || k === ' ') { if (rows[i]) rows[i].click(); else return; }
  else if (k === 'Escape') { closeMenus(stack.length - 1); }
  else if (k === 'Tab') { closeMenus(0); return; }
  else return;
  e.preventDefault(); e.stopPropagation();
}, true);

/* ---------- Dialogs ---------- */
const dlgStack = [];
export const dialogOpen = () => dlgStack.length > 0;
export function dialog({ title, body, buttons = [{ label: 'Selesai', primary: true }], width = 460, cls = '', onOpen, dismiss = true }) {
  return new Promise(resolve => {
    closeMenus(0);
    const prev = document.activeElement;
    const ov = h('div', { class: 'dlg-ov' });
    const box = h('div', { class: 'dlg glass-strong ' + cls, role: 'dialog', 'aria-modal': 'true', 'aria-label': title, style: { width: typeof width === 'number' ? width + 'px' : width } });
    let done = false;
    const close = v => {
      if (done) return; done = true;
      ov.classList.remove('in');
      setTimeout(() => ov.remove(), 180);
      dlgStack.splice(dlgStack.indexOf(ov), 1);
      if (prev?.isConnected && !dlgStack.length) try { prev.focus({ preventScroll: true }); } catch {}
      resolve(v);
    };
    const bodyEl = typeof body === 'function' ? body(close) : body;
    const btns = buttons.map(b => b.spacer ? h('div', { class: 'grow' }) :
      h('button', {
        class: 'btn ' + (b.danger ? 'btn-danger' : b.primary ? 'btn-primary' : 'btn-ghost'), 'data-primary': b.primary ? '1' : null,
        onclick: async () => { const r = b.action ? await b.action(close) : b.value; if (r !== false) close(r === undefined ? (b.value ?? true) : r); },
      }, b.label));
    box.append(
      h('div', { class: 'dlg-h' }, h('div', { class: 'dlg-t' }, title), h('button', { class: 'ib', 'aria-label': 'Tutup', onclick: () => close(null) }, icon('close'))),
      h('div', { class: 'dlg-b' }, bodyEl),
      buttons.length ? h('div', { class: 'dlg-f' }, btns) : null);
    ov.append(box);
    ov.addEventListener('mousedown', e => { if (e.target === ov && dismiss) close(null); });
    ov.addEventListener('keydown', e => {
      if (dlgStack[dlgStack.length - 1] !== ov) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); }
      else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && !e.target.isContentEditable) {
        const p = box.querySelector('[data-primary]');
        if (p) { e.preventDefault(); p.click(); }
      }
      e.stopPropagation();
    });
    document.body.append(ov);
    dlgStack.push(ov);
    requestAnimationFrame(() => ov.classList.add('in'));
    onOpen?.(box, close);
    const f = box.querySelector('[autofocus]') || box.querySelector('.dlg-b input:not([type=checkbox]):not([type=radio]), .dlg-b textarea, .dlg-b select');
    (f || box.querySelector('[data-primary]') || box).focus?.({ preventScroll: true });
    if (f?.select && f.type !== 'number') f.select();
  });
}
export function ask({ title, label, value = '', placeholder = '', ok = 'OK', type = 'text' }) {
  const inp = h('input', { class: 'tx', type, value, placeholder, autofocus: true });
  return dialog({
    title, width: 420,
    body: h('div', { class: 'fx' }, label ? h('span', { class: 'fx-l' }, label) : null, inp),
    buttons: [{ label: 'Batal', value: null }, { label: ok, primary: true, action: () => inp.value }],
  });
}
export function confirmDlg(title, msg, ok = 'Lanjutkan', danger = false) {
  return dialog({ title, width: 420, body: h('p', { class: 'muted', style: { margin: 0 } }, msg), buttons: [{ label: 'Batal', value: false }, { label: ok, primary: !danger, danger, value: true }] }).then(v => !!v);
}

/* ---------- Form helpers ---------- */
export const field = (label, input, hint) => h('label', { class: 'fx' }, h('span', { class: 'fx-l' }, label), input, hint ? h('span', { class: 'small muted' }, hint) : null);
export function select(opts, value, onchange) {
  const s = h('select', { class: 'tx' }, opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: String(v) === String(value) || null }, l); }));
  if (onchange) s.addEventListener('change', () => onchange(s.value));
  return s;
}
export function numInput(value, { min, max, step = 0.1, onchange } = {}) {
  const i = h('input', { class: 'tx', type: 'number', value, min, max, step, inputmode: 'decimal' });
  if (onchange) i.addEventListener('input', () => onchange(parseFloat(i.value)));
  return i;
}
export function toggle(label, checked, onchange) {
  const inp = h('input', { type: 'checkbox', checked: checked || null });
  if (onchange) inp.addEventListener('change', () => onchange(inp.checked));
  const l = h('label', { class: 'sw' }, inp, h('i'), h('span', null, label));
  l.input = inp;
  return l;
}
export function segmented(opts, value, onchange) {
  const el = h('div', { class: 'seg', role: 'radiogroup' });
  el.value = value;
  for (const [v, l, ic] of opts) {
    const b = h('button', { type: 'button', class: v === value ? 'on' : '', role: 'radio', 'aria-checked': String(v === value) }, ic ? icon(ic, 'sm') : null, l);
    b.onclick = () => { el.value = v; [...el.children].forEach(c => { c.classList.toggle('on', c === b); c.setAttribute('aria-checked', String(c === b)); }); onchange?.(v); };
    el.append(b);
  }
  return el;
}
export function tabs(defs) {
  const bar = h('div', { class: 'tabs', role: 'tablist' });
  const panes = h('div');
  const sel = i => { [...bar.children].forEach((b, j) => b.classList.toggle('on', i === j)); [...panes.children].forEach((p, j) => p.hidden = i !== j); };
  defs.forEach(([label, pane], i) => { bar.append(h('button', { type: 'button', role: 'tab', onclick: () => sel(i) }, label)); panes.append(pane); });
  sel(0);
  return h('div', null, bar, panes);
}

/* ---------- Color palette ---------- */
export const PALETTE = [
  ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff'],
  ['#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff'],
  ['#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc'],
  ['#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd'],
  ['#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0'],
  ['#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79'],
  ['#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47'],
  ['#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130'],
];
export function toHex(c) {
  if (!c) return '';
  c = String(c).trim();
  if (c.startsWith('#')) return c.length === 4 ? '#' + [...c.slice(1)].map(x => x + x).join('') : c.toLowerCase().slice(0, 7);
  const m = c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
  if (!m) return '';
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return 'transparent';
  return '#' + [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, '0')).join('');
}
export function palette({ value, onPick, reset }) {
  const cur = toHex(value);
  let custom = [];
  try { custom = JSON.parse(localStorage.getItem('aslides.colors') || '[]'); } catch {}
  const sw = c => h('button', { class: 'pal-sw' + (c === cur ? ' on' : ''), style: { background: c }, title: c, 'aria-label': c, onclick: () => { onPick(c); } }, c === cur ? icon('check') : null);
  const wrap = h('div', { class: 'pal' });
  if (reset) wrap.append(h('div', { class: 'pal-top' }, h('button', { class: 'btn-text', style: { paddingLeft: '4px' }, onclick: () => onPick(null) }, icon('format_color_reset', 'sm'), ' ', reset)));
  PALETTE.forEach((row, i) => { wrap.append(h('div', { class: 'pal-row', style: i === 1 ? { marginBottom: '6px' } : i === 0 ? { marginBottom: '2px' } : null }, row.map(sw))); });
  const pick = h('input', { type: 'color', value: cur && cur !== 'transparent' ? cur : '#1a73e8', style: { position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none' } });
  pick.addEventListener('change', () => {
    const c = pick.value;
    custom = [c, ...custom.filter(x => x !== c)].slice(0, 10);
    try { localStorage.setItem('aslides.colors', JSON.stringify(custom)); } catch {}
    onPick(c);
  });
  wrap.append(h('div', { class: 'pal-lbl' }, 'Kustom'),
    h('div', { class: 'pal-row' }, custom.map(sw), h('button', { class: 'pal-sw', style: { background: 'var(--hov)', boxShadow: 'inset 0 0 0 1px var(--line2)' }, 'aria-label': 'Warna kustom', onclick: () => pick.click() }, h('span', { class: 'ms', style: { color: 'var(--tx2)', mixBlendMode: 'normal' } }, 'add')), pick));
  return wrap;
}

/* ---------- Misc ---------- */
const loaded = {};
export function loadScript(src) {
  return loaded[src] ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = res;
    s.onerror = () => { delete loaded[src]; rej(new Error('Gagal memuat pustaka. Periksa koneksi internet.')); };
    document.head.append(s);
  });
}
export function loadCSS(href) {
  return loaded[href] ||= new Promise(res => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href; l.onload = res; l.onerror = res;
    document.head.append(l);
  });
}
export function downloadBlob(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export function readFile(file, as = 'dataURL') {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result); r.onerror = () => rej(r.error);
    if (as === 'text') r.readAsText(file); else if (as === 'buffer') r.readAsArrayBuffer(file); else r.readAsDataURL(file);
  });
}
export function pickFile(accept, multiple = false) {
  return new Promise(res => {
    const i = h('input', { type: 'file', accept, multiple: multiple || null, style: { display: 'none' } });
    i.onchange = () => { res([...i.files]); i.remove(); };
    document.body.append(i); i.click();
  });
}
export function dataURLtoBlob(d) {
  const [head, b64] = d.split(',');
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  if (!/;base64/.test(head)) return new Blob([decodeURIComponent(b64)], { type: mime });
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: mime });
}
export const safeName = s => (String(s || 'Dokumen').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Dokumen').slice(0, 120);
