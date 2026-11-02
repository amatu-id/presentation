// Presentation model: slide sizes, margins, themes, layouts, element factories.
// Coordinates are slide pixels at 96 px per inch (16:9 = 960 × 540 = 10 × 5.625 in, like Google Slides).
// Colours may be theme tokens ('@bg', '@tx', '@tx2', '@title', '@a1'…'@a6') so a theme change recolours the deck.
import { uid } from './ui.js';

export const PX_IN = 96;
export const cm2px = cm => cm / 2.54 * PX_IN;
export const px2cm = px => px / PX_IN * 2.54;
export const pt2px = pt => pt * 96 / 72;
export const px2pt = px => px * 72 / 96;

export const SIZES = [
  ['16:9', 'Layar lebar 16:9', 960, 540],
  ['16:10', 'Layar lebar 16:10', 960, 600],
  ['4:3', 'Standar 4:3', 960, 720],
  ['a4', 'Kertas A4 (mendatar)', 1123, 794],
  ['letter', 'Letter (mendatar)', 1056, 816],
  ['1:1', 'Persegi 1:1 (media sosial)', 810, 810],
  ['9:16', 'Potret 9:16 (story)', 540, 960],
  ['a4p', 'Kertas A4 (tegak)', 794, 1123],
];
export const DEF_MARGIN = { t: 1.27, r: 1.27, b: 1.27, l: 1.27 };   // cm (0,5 inci seperti PowerPoint)

// ---------- themes ----------
// c: bg, tx (body text), tx2 (muted), title, a1..a6 accents, bg2 (alt panel). f: heading/body fonts.
export const THEMES = [
  { id: 'sederhana', name: 'Sederhana Terang', c: { bg: '#ffffff', bg2: '#f1f3f4', tx: '#3c4043', tx2: '#5f6368', title: '#202124', a1: '#1a73e8', a2: '#ea4335', a3: '#fbbc04', a4: '#34a853', a5: '#ff6d01', a6: '#46bdc6' }, f: { head: 'Arial', body: 'Arial' } },
  { id: 'gelap', name: 'Sederhana Gelap', c: { bg: '#1e1f22', bg2: '#2b2d31', tx: '#e8eaed', tx2: '#bdc1c6', title: '#ffffff', a1: '#8ab4f8', a2: '#f28b82', a3: '#fdd663', a4: '#81c995', a5: '#fcad70', a6: '#78d9ec' }, f: { head: 'Arial', body: 'Arial' } },
  { id: 'arus', name: 'Arus', c: { bg: '#ffffff', bg2: '#eaf1fb', tx: '#334155', tx2: '#64748b', title: '#0b3a75', a1: '#0b57d0', a2: '#00a3bf', a3: '#f59e0b', a4: '#16a34a', a5: '#db2777', a6: '#7c3aed' }, f: { head: 'Montserrat', body: 'Open Sans' }, deco: 'bar' },
  { id: 'fokus', name: 'Fokus', c: { bg: '#fbfaf7', bg2: '#efe9df', tx: '#3d3a35', tx2: '#77716a', title: '#1f1c18', a1: '#c0392b', a2: '#2c3e50', a3: '#d4a017', a4: '#5d8a66', a5: '#8e5572', a6: '#3b7ea1' }, f: { head: 'Playfair Display', body: 'Lato' }, deco: 'line' },
  { id: 'pergeseran', name: 'Pergeseran', c: { bg: '#0f172a', bg2: '#1e293b', tx: '#e2e8f0', tx2: '#94a3b8', title: '#ffffff', a1: '#38bdf8', a2: '#a78bfa', a3: '#f472b6', a4: '#34d399', a5: '#fbbf24', a6: '#fb7185' }, f: { head: 'Poppins', body: 'Inter' }, deco: 'glow' },
  { id: 'momentum', name: 'Momentum', c: { bg: '#ffffff', bg2: '#fff4e5', tx: '#3f3f46', tx2: '#71717a', title: '#18181b', a1: '#f97316', a2: '#0ea5e9', a3: '#84cc16', a4: '#e11d48', a5: '#8b5cf6', a6: '#14b8a6' }, f: { head: 'Oswald', body: 'Roboto' }, deco: 'corner' },
  { id: 'paradigma', name: 'Paradigma', c: { bg: '#f7f7f2', bg2: '#e4ece2', tx: '#2f3e2f', tx2: '#5e6e5e', title: '#1d3b2a', a1: '#2d6a4f', a2: '#b08968', a3: '#d4a373', a4: '#52796f', a5: '#bc4749', a6: '#386641' }, f: { head: 'Lora', body: 'Source Sans 3' }, deco: 'side' },
  { id: 'material', name: 'Material', c: { bg: '#ffffff', bg2: '#ede7f6', tx: '#37474f', tx2: '#607d8b', title: '#311b92', a1: '#673ab7', a2: '#ff4081', a3: '#ffc107', a4: '#00bfa5', a5: '#ff5722', a6: '#03a9f4' }, f: { head: 'Roboto', body: 'Roboto' }, deco: 'band' },
  { id: 'swiss', name: 'Swiss', c: { bg: '#ffffff', bg2: '#f2f2f2', tx: '#1a1a1a', tx2: '#666666', title: '#000000', a1: '#e30613', a2: '#1a1a1a', a3: '#808080', a4: '#0066cc', a5: '#ff9900', a6: '#009966' }, f: { head: 'Helvetica', body: 'Helvetica' }, deco: 'block' },
  { id: 'pantai', name: 'Pantai', c: { bg: '#fffaf0', bg2: '#e6f7f5', tx: '#264653', tx2: '#4f6d7a', title: '#1d3557', a1: '#2a9d8f', a2: '#e76f51', a3: '#f4a261', a4: '#e9c46a', a5: '#457b9d', a6: '#264653' }, f: { head: 'Comfortaa', body: 'Nunito' }, deco: 'wave' },
  { id: 'mint', name: 'Mint', c: { bg: '#f0fbf6', bg2: '#d6f3e6', tx: '#21443a', tx2: '#4f7466', title: '#0e3b2e', a1: '#10b981', a2: '#0f766e', a3: '#f59e0b', a4: '#3b82f6', a5: '#ef4444', a6: '#8b5cf6' }, f: { head: 'Raleway', body: 'Lato' }, deco: 'circle' },
  { id: 'koral', name: 'Koral', c: { bg: '#fff5f3', bg2: '#ffe1da', tx: '#4a2c2a', tx2: '#8a5d58', title: '#3a1714', a1: '#ff6f61', a2: '#6b5b95', a3: '#feb236', a4: '#88b04b', a5: '#d64161', a6: '#00a4ad' }, f: { head: 'Poppins', body: 'Nunito' }, deco: 'blob' },
  { id: 'penulis', name: 'Penulis Modern', c: { bg: '#fdfcf9', bg2: '#f1ede4', tx: '#333333', tx2: '#6f6f6f', title: '#111111', a1: '#b5651d', a2: '#3d405b', a3: '#81b29a', a4: '#e07a5f', a5: '#f2cc8f', a6: '#5c8001' }, f: { head: 'Libre Baskerville', body: 'Source Serif 4' }, deco: 'line' },
  { id: 'eksekutif', name: 'Eksekutif', c: { bg: '#10243e', bg2: '#183457', tx: '#dbe4f0', tx2: '#9fb3cc', title: '#ffffff', a1: '#d4af37', a2: '#5ea3e0', a3: '#e07a5f', a4: '#7fb685', a5: '#c084fc', a6: '#f2c14e' }, f: { head: 'Merriweather', body: 'Open Sans' }, deco: 'gold' },
  { id: 'liquid', name: 'Liquid Glass', c: { bg: '#e9eefc', bg2: 'rgba(255,255,255,.6)', tx: '#1f2937', tx2: '#4b5563', title: '#0f172a', a1: '#4f46e5', a2: '#06b6d4', a3: '#ec4899', a4: '#22c55e', a5: '#f59e0b', a6: '#8b5cf6' }, f: { head: 'Inter', body: 'Inter' }, deco: 'aurora' },
  { id: 'konstruksi', name: 'Konstruksi', c: { bg: '#ffffff', bg2: '#fff7d6', tx: '#2b2b2b', tx2: '#666666', title: '#1b1b1b', a1: '#f2b705', a2: '#1b1b1b', a3: '#d9480f', a4: '#2f9e44', a5: '#1971c2', a6: '#868e96' }, f: { head: 'Oswald', body: 'Roboto' }, deco: 'stripe' },
];
export const themeById = id => THEMES.find(t => t.id === id) || THEMES[0];
export const cloneTheme = t => JSON.parse(JSON.stringify({ id: t.id, name: t.name, c: t.c, f: t.f, deco: t.deco || null, bgImg: t.bgImg || null }));

// Theme tokens → CSS variables on a slide root.
export const TOKENS = ['bg', 'bg2', 'tx', 'tx2', 'title', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6'];
export const TOKEN_NAMES = { bg: 'Latar', bg2: 'Latar 2', tx: 'Teks', tx2: 'Teks 2', title: 'Judul', a1: 'Aksen 1', a2: 'Aksen 2', a3: 'Aksen 3', a4: 'Aksen 4', a5: 'Aksen 5', a6: 'Aksen 6' };
export const col = c => (c == null ? 'transparent' : typeof c === 'string' && c[0] === '@' ? `var(--t-${c.slice(1)})` : c);
export function resolveCol(c, theme) {
  if (c == null) return null;
  if (typeof c === 'string' && c[0] === '@') return theme?.c?.[c.slice(1)] || '#000000';
  return c;
}

// ---------- layouts ----------
// Placeholder boxes depend on the slide size and margins, so changing margins can reflow them.
export const LAYOUTS = [
  ['title', 'Slide judul'], ['section', 'Header bagian'], ['title-body', 'Judul dan isi'], ['two', 'Judul dan dua kolom'],
  ['compare', 'Perbandingan'], ['title-only', 'Judul saja'], ['caption', 'Satu kolom teks'], ['main-point', 'Poin utama'],
  ['big-number', 'Angka besar'], ['picture', 'Gambar dengan keterangan'], ['blank', 'Kosong'],
];
export const layoutName = id => (LAYOUTS.find(l => l[0] === id) || [, 'Kustom'])[1];

export function frame(pres) {
  const { w, h } = pres.page, m = pres.page.margin || DEF_MARGIN;
  const l = cm2px(m.l), r = w - cm2px(m.r), t = cm2px(m.t), b = h - cm2px(m.b);
  return { l, r, t, b, W: r - l, H: b - t, w, h };
}

const P = (role, x, y, w, h, extra = {}) => ({ role, x, y, w, h, ...extra });
export function layoutBoxes(id, pres) {
  const f = frame(pres), k = Math.min(f.w / 960, f.h / 540);
  const gap = 24 * k, th = Math.max(56, 80 * k);
  switch (id) {
    case 'title': return [P('title', f.l, f.t + f.H * .3, f.W, f.H * .26, { va: 'bottom', size: 44, align: 'center' }), P('subtitle', f.l, f.t + f.H * .6, f.W, f.H * .14, { size: 20, align: 'center' })];
    case 'section': return [P('title', f.l, f.t + f.H * .38, f.W, f.H * .22, { va: 'middle', size: 40 }), P('subtitle', f.l, f.t + f.H * .62, f.W, f.H * .12, { size: 18 })];
    case 'title-body': return [P('title', f.l, f.t, f.W, th, { va: 'bottom', size: 32 }), P('body', f.l, f.t + th + gap * .6, f.W, f.H - th - gap * .6, { size: 18 })];
    case 'two': return [P('title', f.l, f.t, f.W, th, { va: 'bottom', size: 32 }), P('body', f.l, f.t + th + gap * .6, (f.W - gap) / 2, f.H - th - gap * .6, { size: 18 }), P('body2', f.l + (f.W + gap) / 2, f.t + th + gap * .6, (f.W - gap) / 2, f.H - th - gap * .6, { size: 18 })];
    case 'compare': {
      const y = f.t + th + gap * .6, hh = 40 * k, cw = (f.W - gap) / 2;
      return [P('title', f.l, f.t, f.W, th, { va: 'bottom', size: 32 }), P('head', f.l, y, cw, hh, { size: 20, bold: true }), P('head2', f.l + cw + gap, y, cw, hh, { size: 20, bold: true }),
        P('body', f.l, y + hh + 8, cw, f.b - y - hh - 8, { size: 16 }), P('body2', f.l + cw + gap, y + hh + 8, cw, f.b - y - hh - 8, { size: 16 })];
    }
    case 'title-only': return [P('title', f.l, f.t, f.W, th, { va: 'bottom', size: 32 })];
    case 'caption': return [P('title', f.l, f.t + f.H * .05, f.W * .42, f.H * .3, { va: 'bottom', size: 28 }), P('body', f.l, f.t + f.H * .4, f.W * .42, f.H * .6, { size: 16 })];
    case 'main-point': return [P('title', f.l + f.W * .06, f.t + f.H * .2, f.W * .88, f.H * .6, { va: 'middle', size: 40 })];
    case 'big-number': return [P('title', f.l, f.t + f.H * .12, f.W, f.H * .45, { va: 'bottom', size: 96, align: 'center', color: '@a1' }), P('body', f.l, f.t + f.H * .62, f.W, f.H * .2, { size: 20, align: 'center' })];
    case 'picture': return [P('picture', f.l, f.t, f.W * .58, f.H), P('title', f.l + f.W * .62, f.t + f.H * .1, f.W * .38, f.H * .3, { va: 'bottom', size: 28 }), P('body', f.l + f.W * .62, f.t + f.H * .44, f.W * .38, f.H * .5, { size: 16 })];
    default: return [];
  }
}
export const PH_HINT = {
  title: 'Klik untuk menambahkan judul', subtitle: 'Klik untuk menambahkan subjudul', body: 'Klik untuk menambahkan teks', body2: 'Klik untuk menambahkan teks',
  head: 'Klik untuk menambahkan judul kolom', head2: 'Klik untuk menambahkan judul kolom', picture: 'Klik dua kali untuk menambahkan gambar',
};

// ---------- elements ----------
export const BOX = () => ({ va: 'top', pad: [8, 10, 8, 10], fit: 'none', cols: 1 });
export function textEl(o = {}) {
  return { id: uid(8), type: 'text', x: 100, y: 100, w: 360, h: 60, rot: 0, html: '', box: BOX(), ...o };
}
export function shapeEl(shape, o = {}) {
  const line = shape === 'line' || shape === 'arrow' || shape === 'dline' || shape === 'elbow' || shape === 'curve';
  if (line) return { id: uid(8), type: 'line', shape, x: 200, y: 200, w: 240, h: 0, rot: 0, stroke: { c: '@tx', w: 2, dash: 'solid' }, head: shape === 'arrow' ? 'arrow' : shape === 'dline' ? 'arrow' : null, tail: shape === 'dline' ? 'arrow' : null, ...o };
  return { id: uid(8), type: 'shape', shape, x: 200, y: 150, w: 200, h: 140, rot: 0, fill: '@a1', stroke: null, html: '', box: { ...BOX(), va: 'middle' }, tcol: '#ffffff', ...o };
}
export function imageEl(src, w, h, o = {}) { return { id: uid(8), type: 'image', src, x: 100, y: 100, w, h, rot: 0, fit: 'cover', ...o }; }

// Paragraph html from plain text lines.
export const escHtml = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function paras(text, o = {}) {
  const lines = Array.isArray(text) ? text : String(text).split('\n');
  const st = (o.align ? `text-align:${o.align};` : '');
  if (o.list) return `<ul>${lines.map(l => `<li>${escHtml(l)}</li>`).join('')}</ul>`;
  return lines.map(l => `<p${st ? ` style="${st}"` : ''}>${escHtml(l) || '<br>'}</p>`).join('');
}

// Element filling a placeholder box. Fresh placeholders keep html '' and show the hint in the editor only.
export function phEl(b, html = '') {
  if (b.role === 'picture') return { id: uid(8), type: 'image', ph: 'picture', src: '', x: b.x, y: b.y, w: b.w, h: b.h, rot: 0, fit: 'cover' };
  const body = b.role.startsWith('body');
  return {
    id: uid(8), type: 'text', ph: b.role, x: b.x, y: b.y, w: b.w, h: b.h, rot: 0, html,
    box: { ...BOX(), va: b.va || 'top', fit: body ? 'shrink' : 'none' },
    def: { size: b.size, font: b.role === 'title' || b.role.startsWith('head') ? 'head' : 'body', color: b.color || (b.role === 'title' ? '@title' : b.role === 'subtitle' ? '@tx2' : '@tx'), bold: !!b.bold, align: b.align || null, list: body },
  };
}

export function newSlide(pres, layout = 'title-body', fill = {}) {
  const els = layoutBoxes(layout, pres).map(b => phEl(b, fill[b.role] || ''));
  return { id: uid(8), layout, els, notes: '', bg: null, trans: null, anims: [] };
}

export function newPres(o = {}) {
  const now = Date.now();
  const sz = SIZES[0];
  const p = {
    id: uid(12), title: 'Presentasi tanpa judul', created: now, modified: now, opened: now, starred: false, trashed: 0,
    page: { size: sz[0], w: sz[2], h: sz[3], margin: { ...DEF_MARGIN } },
    theme: cloneTheme(THEMES[0]), master: [], slides: [], assets: {}, comments: [],
    hf: { num: false, date: false, dateText: '', footer: '', skipTitle: true },
    show: { loop: false, auto: false, laser: '#ff1744', pen: '#ff1744' },
    ...o,
  };
  if (!p.slides.length) p.slides.push(newSlide(p, 'title'));
  return normalize(p);
}

export function normalize(p) {
  p.page ||= { size: '16:9', w: 960, h: 540 };
  p.page.margin = { ...DEF_MARGIN, ...(p.page.margin || {}) };
  p.theme ||= cloneTheme(THEMES[0]);
  p.theme.c = { ...THEMES[0].c, ...(p.theme.c || {}) };
  p.theme.f = { ...THEMES[0].f, ...(p.theme.f || {}) };
  p.master ||= [];
  p.slides ||= [];
  p.assets ||= {};
  p.comments ||= [];
  p.hf = { num: false, date: false, dateText: '', footer: '', skipTitle: true, ...(p.hf || {}) };
  p.show = { loop: false, auto: false, laser: '#ff1744', pen: '#ff1744', ...(p.show || {}) };
  for (const s of p.slides) {
    s.id ||= uid(8); s.els ||= []; s.anims ||= []; s.notes ??= '';
    for (const e of s.els) { e.id ||= uid(8); e.rot ||= 0; }
  }
  return p;
}

// Everything that should look the same on every device (used for share payloads, versions, history).
export const CONTENT_KEYS = ['title', 'page', 'theme', 'master', 'slides', 'assets', 'comments', 'hf', 'show'];

export const slideText = s => (s?.els || []).map(e => htmlText(e.html) + (e.rows ? e.rows.flat().map(c => htmlText(c.html)).join(' ') : '')).join(' ').trim();
export function htmlText(html) {
  if (!html) return '';
  const t = document.createElement('template');
  t.innerHTML = html.replace(/<\/(p|li|div|h\d)>/g, '$& ').replace(/<br\s*\/?>/g, ' ');
  return t.content.textContent.replace(/\s+/g, ' ').trim();
}
export const slideTitle = s => htmlText(s.els.find(e => e.ph === 'title')?.html) || htmlText(s.els.find(e => e.html)?.html) || '';

// Copy elements with fresh ids; keep a morph id (mid) so Morph can pair them across slides.
export const cloneEls = els => els.map(e => ({ ...JSON.parse(JSON.stringify(e)), id: uid(8), mid: e.mid || e.id }));
export function cloneSlide(s) {
  const map = {};
  const els = s.els.map(e => { const n = { ...JSON.parse(JSON.stringify(e)), id: uid(8), mid: e.mid || e.id }; map[e.id] = n.id; return n; });
  for (const e of els) if (e.group) e.group = 'g' + (map[e.group.slice(1)] || e.group.slice(1));
  return { ...JSON.parse(JSON.stringify(s)), id: uid(8), els, anims: (s.anims || []).filter(a => map[a.el]).map(a => ({ ...a, id: uid(6), el: map[a.el] })), section: null };
}
