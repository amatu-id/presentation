// Slide renderer shared by the editor stage, thumbnails, slideshow, presenter view, print and image export.
import { h, esc } from './ui.js';
import { col, resolveCol, TOKENS, pt2px, PH_HINT, frame } from './model.js';
import { fontCss, ensureFont } from './fonts.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
  kids.flat().forEach(k => k && el.append(k));
  return el;
};

// ---------- assets ----------
const blobs = new Map();
export function assetURL(pres, src) {
  if (!src) return '';
  if (!src.startsWith('a:')) return src;
  const d = pres.assets?.[src.slice(2)];
  if (!d) return '';
  let u = blobs.get(src);
  if (u && u.d === d) return u.url;
  try {
    const [head, b64] = d.split(',');
    const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/png';
    const bin = atob(b64), a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    u = { d, url: URL.createObjectURL(new Blob([a], { type: mime })) };
  } catch { u = { d, url: d }; }
  blobs.set(src, u);
  return u.url;
}

// ---------- theme ----------
export function themeVars(node, theme) {
  for (const k of TOKENS) node.style.setProperty('--t-' + k, theme.c[k]);
  node.style.setProperty('--t-fh', fontCss(theme.f.head));
  node.style.setProperty('--t-fb', fontCss(theme.f.body));
  ensureFont(theme.f.head); ensureFont(theme.f.body);
}
export function bgCss(bg, pres) {
  if (!bg) return { background: 'var(--t-bg)' };
  if (bg.t === 'grad') return { background: `${bg.radial ? 'radial-gradient(circle at 30% 30%' : `linear-gradient(${bg.ang ?? 135}deg`}, ${col(bg.c1)}, ${col(bg.c2)})` };
  if (bg.t === 'img') return { background: `${col(bg.c || '@bg')} url("${assetURL(pres, bg.src)}") center/${bg.fit === 'contain' ? 'contain' : bg.fit === 'tile' ? 'auto' : 'cover'} ${bg.fit === 'tile' ? 'repeat' : 'no-repeat'}` };
  return { background: col(bg.c) };
}

// ---------- shapes ----------
export const SHAPES = [
  ['rect', 'Persegi panjang'], ['round', 'Persegi sudut bulat'], ['snip', 'Sudut terpotong'], ['ellipse', 'Elips'], ['triangle', 'Segitiga'], ['rtriangle', 'Segitiga siku'],
  ['diamond', 'Belah ketupat'], ['parallelogram', 'Jajar genjang'], ['trapezoid', 'Trapesium'], ['pentagon', 'Segi lima'], ['hexagon', 'Segi enam'], ['octagon', 'Segi delapan'],
  ['star4', 'Bintang 4'], ['star5', 'Bintang 5'], ['star6', 'Bintang 6'], ['star12', 'Ledakan'], ['heart', 'Hati'], ['plus', 'Tambah'],
  ['arrowR', 'Panah kanan'], ['arrowL', 'Panah kiri'], ['arrowU', 'Panah atas'], ['arrowD', 'Panah bawah'], ['arrowLR', 'Panah dua arah'], ['chevron', 'Chevron'],
  ['homeplate', 'Segi lima panah'], ['callout', 'Balon teks'], ['calloutR', 'Balon bulat'], ['cloud', 'Awan'], ['donut', 'Donat'], ['frame', 'Bingkai'],
  ['can', 'Silinder'], ['cube', 'Kubus'], ['moon', 'Bulan'], ['lightning', 'Petir'], ['brace', 'Kurung kurawal'], ['wave', 'Gelombang'],
];
const poly = pts => 'M' + pts.map(p => p.map(v => +v.toFixed(2)).join(',')).join('L') + 'Z';
function star(n, w, h, inner) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = Math.PI * i / n - Math.PI / 2, r = i % 2 ? inner : 1;
    pts.push([w / 2 + Math.cos(a) * r * w / 2, h / 2 + Math.sin(a) * r * h / 2]);
  }
  return poly(pts);
}
const ngon = (n, w, h, rot = -Math.PI / 2) => poly(Array.from({ length: n }, (_, i) => [w / 2 + Math.cos(rot + i * 2 * Math.PI / n) * w / 2, h / 2 + Math.sin(rot + i * 2 * Math.PI / n) * h / 2]));
export function shapePath(s, w, h, adj = {}) {
  const m = Math.min(w, h);
  switch (s) {
    case 'rect': return `M0,0H${w}V${h}H0Z`;
    case 'round': { const r = Math.min(m / 2, (adj.r ?? .16) * m); return `M${r},0H${w - r}A${r},${r} 0 0 1 ${w},${r}V${h - r}A${r},${r} 0 0 1 ${w - r},${h}H${r}A${r},${r} 0 0 1 0,${h - r}V${r}A${r},${r} 0 0 1 ${r},0Z`; }
    case 'snip': { const r = m * .2; return poly([[0, 0], [w - r, 0], [w, r], [w, h], [r, h], [0, h - r]]); }
    case 'ellipse': return `M${w / 2},0A${w / 2},${h / 2} 0 1 1 ${w / 2},${h}A${w / 2},${h / 2} 0 1 1 ${w / 2},0Z`;
    case 'triangle': return poly([[w / 2, 0], [w, h], [0, h]]);
    case 'rtriangle': return poly([[0, 0], [w, h], [0, h]]);
    case 'diamond': return poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
    case 'parallelogram': return poly([[w * .22, 0], [w, 0], [w * .78, h], [0, h]]);
    case 'trapezoid': return poly([[w * .2, 0], [w * .8, 0], [w, h], [0, h]]);
    case 'pentagon': return ngon(5, w, h);
    case 'hexagon': return poly([[w * .25, 0], [w * .75, 0], [w, h / 2], [w * .75, h], [w * .25, h], [0, h / 2]]);
    case 'octagon': { const a = .29; return poly([[w * a, 0], [w * (1 - a), 0], [w, h * a], [w, h * (1 - a)], [w * (1 - a), h], [w * a, h], [0, h * (1 - a)], [0, h * a]]); }
    case 'star4': return star(4, w, h, .38);
    case 'star5': return star(5, w, h, .4);
    case 'star6': return star(6, w, h, .55);
    case 'star12': return star(12, w, h, .7);
    case 'heart': return `M${w / 2},${h * .25}C${w / 2},${h * .1} ${w * .35},0 ${w * .22},0C${w * .05},0 0,${h * .17} 0,${h * .32}C0,${h * .58} ${w * .3},${h * .75} ${w / 2},${h}C${w * .7},${h * .75} ${w},${h * .58} ${w},${h * .32}C${w},${h * .17} ${w * .95},0 ${w * .78},0C${w * .65},0 ${w / 2},${h * .1} ${w / 2},${h * .25}Z`;
    case 'plus': { const a = .33; return poly([[w * a, 0], [w * (1 - a), 0], [w * (1 - a), h * a], [w, h * a], [w, h * (1 - a)], [w * (1 - a), h * (1 - a)], [w * (1 - a), h], [w * a, h], [w * a, h * (1 - a)], [0, h * (1 - a)], [0, h * a], [w * a, h * a]]); }
    case 'arrowR': { const t = Math.min(w * .45, h * .9); return poly([[0, h * .28], [w - t, h * .28], [w - t, 0], [w, h / 2], [w - t, h], [w - t, h * .72], [0, h * .72]]); }
    case 'arrowL': { const t = Math.min(w * .45, h * .9); return poly([[w, h * .28], [t, h * .28], [t, 0], [0, h / 2], [t, h], [t, h * .72], [w, h * .72]]); }
    case 'arrowU': { const t = Math.min(h * .45, w * .9); return poly([[w * .28, h], [w * .28, t], [0, t], [w / 2, 0], [w, t], [w * .72, t], [w * .72, h]]); }
    case 'arrowD': { const t = Math.min(h * .45, w * .9); return poly([[w * .28, 0], [w * .72, 0], [w * .72, h - t], [w, h - t], [w / 2, h], [0, h - t], [w * .28, h - t]]); }
    case 'arrowLR': { const t = Math.min(w * .3, h * .9); return poly([[0, h / 2], [t, 0], [t, h * .28], [w - t, h * .28], [w - t, 0], [w, h / 2], [w - t, h], [w - t, h * .72], [t, h * .72], [t, h]]); }
    case 'chevron': { const t = Math.min(w * .4, h * .5); return poly([[0, 0], [w - t, 0], [w, h / 2], [w - t, h], [0, h], [t, h / 2]]); }
    case 'homeplate': { const t = Math.min(w * .35, h * .5); return poly([[0, 0], [w - t, 0], [w, h / 2], [w - t, h], [0, h]]); }
    case 'callout': return poly([[0, 0], [w, 0], [w, h * .75], [w * .42, h * .75], [w * .2, h], [w * .25, h * .75], [0, h * .75]]);
    case 'calloutR': return `M${w / 2},0A${w / 2},${h * .4} 0 1 1 ${w * .38},${h * .79}L${w * .18},${h}L${w * .24},${h * .74}A${w / 2},${h * .4} 0 0 1 ${w / 2},0Z`;
    case 'cloud': return `M${w * .25},${h * .85}C${w * .05},${h * .85} 0,${h * .6} ${w * .12},${h * .5}C${w * .02},${h * .3} ${w * .2},${h * .12} ${w * .35},${h * .22}C${w * .4},${h * .02} ${w * .65},0 ${w * .7},${h * .18}C${w * .85},${h * .08} ${w},${h * .25} ${w * .92},${h * .45}C${w * 1.02},${h * .6} ${w * .92},${h * .85} ${w * .75},${h * .85}Z`;
    case 'donut': { const r = .28; return `M${w / 2},0A${w / 2},${h / 2} 0 1 1 ${w / 2},${h}A${w / 2},${h / 2} 0 1 1 ${w / 2},0ZM${w / 2},${h * r}A${w / 2 - w * r},${h / 2 - h * r} 0 1 0 ${w / 2},${h - h * r}A${w / 2 - w * r},${h / 2 - h * r} 0 1 0 ${w / 2},${h * r}Z`; }
    case 'frame': { const t = m * .12; return `M0,0H${w}V${h}H0ZM${t},${t}V${h - t}H${w - t}V${t}Z`; }
    case 'can': { const r = Math.min(h * .15, w * .3); return `M0,${r}A${w / 2},${r} 0 0 1 ${w},${r}V${h - r}A${w / 2},${r} 0 0 1 0,${h - r}ZM0,${r}A${w / 2},${r} 0 0 0 ${w},${r}`; }
    case 'cube': { const d = m * .22; return `M0,${d}L${d},0H${w}V${h - d}L${w - d},${h}H0ZM0,${d}H${w - d}V${h}M${w - d},${d}L${w},0`; }
    case 'moon': return `M${w * .7},0A${w * .55},${h / 2} 0 1 0 ${w * .7},${h}A${w * .4},${h * .42} 0 1 1 ${w * .7},0Z`;
    case 'lightning': return poly([[w * .38, 0], [w * .7, 0], [w * .52, h * .38], [w * .8, h * .38], [w * .25, h], [w * .4, h * .52], [w * .15, h * .52]]);
    case 'brace': return `M${w * .75},0C${w * .4},0 ${w * .5},${h * .45} ${w * .15},${h / 2}C${w * .5},${h * .55} ${w * .4},${h} ${w * .75},${h}`;
    case 'wave': return `M0,${h * .15}C${w * .25},${-h * .1} ${w * .25},${h * .4} ${w / 2},${h * .15}C${w * .75},${-h * .1} ${w * .75},${h * .4} ${w},${h * .15}V${h * .85}C${w * .75},${h * 1.1} ${w * .75},${h * .6} ${w / 2},${h * .85}C${w * .25},${h * 1.1} ${w * .25},${h * .6} 0,${h * .85}Z`;
    default: return `M0,0H${w}V${h}H0Z`;
  }
}
const OPEN = new Set(['brace']);
// CSS clip-path for picture masks.
export function clipFor(s, w, h) {
  if (!s || s === 'rect') return '';
  if (s === 'ellipse') return 'ellipse(50% 50% at 50% 50%)';
  if (s === 'round') return `inset(0 round ${Math.min(w, h) * .12}px)`;
  return `path("${shapePath(s, w, h)}")`;
}

export const DASH = { solid: null, dash: '8 5', dot: '1.5 4', dashdot: '8 4 1.5 4', long: '14 6' };
const dashArr = (d, w) => DASH[d] ? DASH[d].split(' ').map(x => +x * Math.max(1, w / 2)).join(' ') : null;
const shadowCss = s => s ? `drop-shadow(${s.x ?? 2}px ${s.y ?? 4}px ${s.b ?? 8}px ${col(s.c || 'rgba(0,0,0,.35)')})` : '';
export function fillCss(f) {
  if (f == null || f === 'none') return 'none';
  if (typeof f === 'object' && f.t === 'grad') return null;
  return col(f);
}

// ---------- text ----------
// Default text style of an element (placeholders take theme fonts). Inline styles in html override it.
export function textStyle(e) {
  const d = e.def || {};
  const s = {};
  if (d.size) s.fontSize = pt2px(d.size) + 'px';
  s.fontFamily = d.font === 'head' ? 'var(--t-fh)' : d.font && d.font !== 'body' ? fontCss(d.font) : 'var(--t-fb)';
  if (d.font && d.font !== 'head' && d.font !== 'body') ensureFont(d.font);
  s.color = col(d.color || (e.type === 'shape' ? e.tcol || '#ffffff' : '@tx'));
  if (d.bold) s.fontWeight = '700';
  if (d.italic) s.fontStyle = 'italic';
  if (d.align) s.textAlign = d.align;
  if (d.lh) s.lineHeight = d.lh;
  if (d.ls) s.letterSpacing = d.ls + 'px';
  if (d.upper) s.textTransform = 'uppercase';
  return s;
}
// WordArt-like effects on the text box.
export function textFx(e, node) {
  const f = e.tfx;
  if (!f) return;
  const parts = [];
  if (f.shadow) parts.push(`${f.shadow.x ?? 2}px ${f.shadow.y ?? 3}px ${f.shadow.b ?? 4}px ${col(f.shadow.c || 'rgba(0,0,0,.4)')}`);
  if (f.glow) parts.push(`0 0 ${f.glow.b || 12}px ${col(f.glow.c || '@a1')}`, `0 0 ${(f.glow.b || 12) / 2}px ${col(f.glow.c || '@a1')}`);
  if (parts.length) node.style.textShadow = parts.join(',');
  if (f.outline) node.style.webkitTextStroke = `${f.outline.w || 1.5}px ${col(f.outline.c || '@tx')}`;
  if (f.grad) {
    node.style.backgroundImage = `linear-gradient(${f.grad.ang ?? 90}deg, ${col(f.grad.c1)}, ${col(f.grad.c2)})`;
    node.style.webkitBackgroundClip = 'text'; node.style.backgroundClip = 'text';
    node.classList.add('tx-grad');
  }
}

function textBox(e, o) {
  const b = e.box || {};
  const pad = b.pad || [8, 10, 8, 10];
  const tx = h('div', { class: 'tx' + (b.cols > 1 ? ' cols' : ''), dataset: { va: b.va || 'top' } });
  tx.style.padding = pad.map(v => v + 'px').join(' ');
  if (b.cols > 1) tx.style.setProperty('--cols', b.cols);
  const inner = h('div', { class: 'txi', html: e.html || '' });
  Object.assign(inner.style, textStyle(e));
  if (e.def?.list) inner.classList.add('autolist');
  if (b.dir === 'v') tx.classList.add('vert');
  textFx(e, inner);
  if (!e.html && e.ph && o.hint) { inner.classList.add('hint'); inner.dataset.hint = PH_HINT[e.ph] || 'Klik untuk menambahkan teks'; }
  tx.append(inner);
  return tx;
}

// Shrink text on overflow: CSS zoom on the inner block, found by binary search.
export function fitText(node) {
  const tx = node.querySelector(':scope > .tx'), inner = tx?.firstElementChild;
  if (!inner || node.dataset.fit !== 'shrink') return;
  inner.style.zoom = '';
  const room = tx.clientHeight - parseFloat(getComputedStyle(tx).paddingTop) - parseFloat(getComputedStyle(tx).paddingBottom);
  if (inner.scrollHeight <= room + 1 || room <= 0) return;
  let lo = .3, hi = 1;
  for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2; inner.style.zoom = m; if (inner.scrollHeight * m <= room + 1 || inner.getBoundingClientRect().height <= room + 1) lo = m; else hi = m; }
  inner.style.zoom = lo.toFixed(3);
}

// ---------- chart ----------
export const CHART_TYPES = [['col', 'Kolom', 'bar_chart'], ['bar', 'Batang', 'align_horizontal_left'], ['line', 'Garis', 'show_chart'], ['area', 'Area', 'area_chart'], ['pie', 'Pai', 'pie_chart'], ['donut', 'Donat', 'donut_large'], ['stack', 'Kolom bertumpuk', 'stacked_bar_chart']];
export function chartSvg(c, w, h) {
  const data = c.data || [];
  const series = (data[0] || []).slice(1);
  const cats = data.slice(1).map(r => r[0]);
  const vals = data.slice(1).map(r => r.slice(1).map(v => +v || 0));
  const colors = series.map((_, i) => col(c.colors?.[i] || '@a' + ((i % 6) + 1)));
  const s = svg('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, class: 'chart', style: 'overflow:visible;font-family:var(--t-fb)' });
  const fs = Math.max(10, Math.min(16, h / 22));
  const txc = col('@tx2');
  let top = 8;
  if (c.title) { s.append(svg('text', { x: w / 2, y: fs * 1.4, 'text-anchor': 'middle', 'font-size': fs * 1.25, 'font-weight': 700, style: `fill:${col('@tx')}` }, c.title)); top += fs * 1.8; }
  const legendH = c.legend !== false && series.length > 1 || (c.type === 'pie' || c.type === 'donut') ? fs * 2 : 0;
  if (c.type === 'pie' || c.type === 'donut') {
    const tot = vals.reduce((a, r) => a + Math.max(0, r[0]), 0) || 1;
    const R = Math.min(w, h - top - legendH) / 2 - 6, cx = w / 2, cy = top + R + 4;
    let a0 = -Math.PI / 2;
    vals.forEach((r, i) => {
      const v = Math.max(0, r[0]), a1 = a0 + v / tot * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0, cl = col(c.colors?.[i] || '@a' + ((i % 6) + 1));
      const p = v >= tot ? `M${cx},${cy - R}A${R},${R} 0 1 1 ${cx - .01},${cy - R}Z` : `M${cx},${cy}L${cx + R * Math.cos(a0)},${cy + R * Math.sin(a0)}A${R},${R} 0 ${large} 1 ${cx + R * Math.cos(a1)},${cy + R * Math.sin(a1)}Z`;
      s.append(svg('path', { d: p, style: `fill:${cl};stroke:var(--t-bg);stroke-width:2` }));
      if (c.labels !== false && v / tot > .04) {
        const am = (a0 + a1) / 2, rr = c.type === 'donut' ? R * .78 : R * .62;
        s.append(svg('text', { x: cx + rr * Math.cos(am), y: cy + rr * Math.sin(am) + fs / 3, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 600, style: 'fill:#fff' }, Math.round(v / tot * 100) + '%'));
      }
      a0 = a1;
    });
    if (c.type === 'donut') s.append(svg('circle', { cx, cy, r: R * .55, style: 'fill:var(--t-bg)' }));
    legend(s, cats, vals.map((_, i) => col(c.colors?.[i] || '@a' + ((i % 6) + 1))), w, h - legendH / 2, fs, txc);
    return s;
  }
  const horiz = c.type === 'bar';
  const stack = c.type === 'stack';
  const maxV = Math.max(1, ...(stack ? vals.map(r => r.reduce((a, b) => a + Math.max(0, b), 0)) : vals.flat()));
  const minV = Math.min(0, ...vals.flat());
  const nice = niceMax(maxV);
  const L = horiz ? Math.min(w * .3, fs * 7) : fs * 3.2, B = h - legendH - fs * 2, R = w - 6, T = top + 4;
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const v = minV + (nice - minV) * i / steps;
    if (horiz) {
      const x = L + (R - L) * i / steps;
      s.append(svg('line', { x1: x, y1: T, x2: x, y2: B, style: 'stroke:var(--t-tx2);stroke-opacity:.18' }));
      s.append(svg('text', { x, y: B + fs * 1.2, 'text-anchor': 'middle', 'font-size': fs * .85, style: `fill:${txc}` }, fmtV(v)));
    } else {
      const y = B - (B - T) * i / steps;
      s.append(svg('line', { x1: L, y1: y, x2: R, y2: y, style: 'stroke:var(--t-tx2);stroke-opacity:.18' }));
      s.append(svg('text', { x: L - 6, y: y + fs / 3, 'text-anchor': 'end', 'font-size': fs * .85, style: `fill:${txc}` }, fmtV(v)));
    }
  }
  const n = cats.length || 1, band = (horiz ? B - T : R - L) / n;
  const scale = v => (v - minV) / (nice - minV);
  if (c.type === 'line' || c.type === 'area') {
    series.forEach((_, si) => {
      const pts = vals.map((r, i) => [L + band * (i + .5), B - (B - T) * scale(r[si])]);
      if (c.type === 'area') s.append(svg('path', { d: `M${pts[0][0]},${B}L${pts.map(p => p.join(',')).join('L')}L${pts[pts.length - 1][0]},${B}Z`, style: `fill:${colors[si]};fill-opacity:.28` }));
      s.append(svg('path', { d: 'M' + pts.map(p => p.join(',')).join('L'), style: `fill:none;stroke:${colors[si]};stroke-width:${Math.max(2, fs / 5)};stroke-linejoin:round` }));
      pts.forEach((p, i) => { s.append(svg('circle', { cx: p[0], cy: p[1], r: Math.max(3, fs / 4), style: `fill:${colors[si]}` })); if (c.labels) s.append(svg('text', { x: p[0], y: p[1] - fs * .6, 'text-anchor': 'middle', 'font-size': fs * .8, style: `fill:${txc}` }, fmtV(vals[i][si]))); });
    });
  } else {
    const gw = band * .72, bw = stack ? gw : gw / Math.max(1, series.length);
    vals.forEach((r, i) => {
      let acc = 0;
      r.forEach((v, si) => {
        const start = stack ? acc : 0;
        const a = scale(Math.min(start, start + v)), b = scale(Math.max(start, start + v));
        acc += stack ? v : 0;
        const off = band * i + (band - gw) / 2 + (stack ? 0 : bw * si);
        let x, y, ww, hh;
        if (horiz) { x = L + (R - L) * a; ww = (R - L) * (b - a); y = T + off; hh = bw - 2; }
        else { y = B - (B - T) * b; hh = (B - T) * (b - a); x = L + off; ww = bw - 2; }
        s.append(svg('rect', { x, y, width: Math.max(0, ww), height: Math.max(0, hh), rx: 2, style: `fill:${colors[si]}` }));
        if (c.labels) s.append(svg('text', { x: horiz ? x + ww + 4 : x + ww / 2, y: horiz ? y + hh / 2 + fs / 3 : y - 4, 'text-anchor': horiz ? 'start' : 'middle', 'font-size': fs * .8, style: `fill:${txc}` }, fmtV(v)));
      });
    });
  }
  cats.forEach((cname, i) => {
    if (horiz) s.append(svg('text', { x: L - 6, y: T + band * (i + .5) + fs / 3, 'text-anchor': 'end', 'font-size': fs * .9, style: `fill:${txc}` }, String(cname ?? '')));
    else s.append(svg('text', { x: L + band * (i + .5), y: B + fs * 1.3, 'text-anchor': 'middle', 'font-size': fs * .9, style: `fill:${txc}` }, String(cname ?? '')));
  });
  s.append(svg('line', horiz ? { x1: L, y1: T, x2: L, y2: B, style: 'stroke:var(--t-tx2);stroke-opacity:.5' } : { x1: L, y1: B, x2: R, y2: B, style: 'stroke:var(--t-tx2);stroke-opacity:.5' }));
  if (legendH) legend(s, series, colors, w, h - legendH / 2, fs, txc);
  return s;
}
function legend(s, names, colors, w, y, fs, txc) {
  const widths = names.map(n => String(n).length * fs * .55 + fs * 2.2);
  let x = Math.max(0, (w - widths.reduce((a, b) => a + b, 0)) / 2);
  names.forEach((n, i) => {
    s.append(svg('rect', { x, y: y - fs * .45, width: fs * .9, height: fs * .9, rx: 2, style: `fill:${colors[i]}` }));
    s.append(svg('text', { x: x + fs * 1.3, y: y + fs * .35, 'font-size': fs * .9, style: `fill:${txc}` }, String(n)));
    x += widths[i];
  });
}
function niceMax(v) { const p = 10 ** Math.floor(Math.log10(v)); for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p; return 10 * p; }
const fmtV = v => Math.abs(v) >= 1e6 ? (v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt' : Math.abs(v) >= 1e3 ? (v / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' rb' : (+v).toLocaleString('id-ID', { maximumFractionDigits: 2 });

// ---------- table ----------
function tableEl(e) {
  const st = e.tstyle || {};
  const t = h('table', { class: 'tbl' + (st.head !== false ? ' head' : '') + (st.band !== false ? ' band' : '') + (st.firstCol ? ' fcol' : '') });
  t.style.setProperty('--tb-c', col(st.c || '@a1'));
  t.style.setProperty('--tb-line', col(st.line || '@tx2'));
  Object.assign(t.style, textStyle(e));
  const cg = h('colgroup');
  const cw = e.colW || e.rows[0].map(() => 1 / e.rows[0].length);
  cw.forEach(w => cg.append(h('col', { style: { width: (w * 100) + '%' } })));
  t.append(cg);
  const tb = h('tbody');
  e.rows.forEach((r, ri) => {
    const tr = h('tr');
    r.forEach((c, ci) => {
      if (c.skip) return;
      const td = h('td', { html: c.html || '', dataset: { r: ri, c: ci } });
      if (c.span) td.colSpan = c.span;
      if (c.rspan) td.rowSpan = c.rspan;
      if (c.fill) td.style.background = col(c.fill);
      if (c.va) td.style.verticalAlign = c.va;
      tr.append(td);
    });
    tb.append(tr);
  });
  t.append(tb);
  return t;
}

// ---------- video ----------
export function ytId(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// ---------- element ----------
export function bbox(e) {
  if (e.type === 'line') return { x: Math.min(e.x, e.x + e.w), y: Math.min(e.y, e.y + e.h), w: Math.abs(e.w), h: Math.abs(e.h) };
  return { x: e.x, y: e.y, w: e.w, h: e.h };
}

export function renderEl(pres, e, o = {}) {
  const b = bbox(e);
  const node = h('div', { class: 'el el-' + e.type, dataset: { id: e.id } });
  Object.assign(node.style, { left: b.x + 'px', top: b.y + 'px', width: Math.max(1, b.w) + 'px', height: Math.max(1, b.h) + 'px' });
  const tf = [];
  if (e.rot) tf.push(`rotate(${e.rot}deg)`);
  if (e.flipH) tf.push('scaleX(-1)');
  if (e.flipV) tf.push('scaleY(-1)');
  if (tf.length) node.style.transform = tf.join(' ');
  if (e.opacity != null && e.opacity < 1) node.style.opacity = e.opacity;
  if (e.hidden && !o.editor) node.style.display = 'none';
  if (e.hidden && o.editor) node.classList.add('is-hidden');
  if (e.link) node.dataset.link = e.link;

  if (e.type === 'text' || e.type === 'shape') {
    if (e.type === 'shape') {
      const s = svg('svg', { class: 'shp', viewBox: `0 0 ${e.w} ${e.h}`, width: e.w, height: e.h, preserveAspectRatio: 'none' });
      const d = shapePath(e.shape, e.w, e.h, e.adj);
      const p = svg('path', { d });
      let fill = fillCss(e.fill);
      if (fill === null) {
        const gid = 'g' + e.id + (o.sfx || '');
        const ang = (e.fill.ang ?? 90) * Math.PI / 180;
        s.append(svg('defs', {}, svg('linearGradient', { id: gid, x1: .5 - Math.cos(ang) / 2, y1: .5 - Math.sin(ang) / 2, x2: .5 + Math.cos(ang) / 2, y2: .5 + Math.sin(ang) / 2 },
          svg('stop', { offset: 0, style: `stop-color:${col(e.fill.c1)}` }), svg('stop', { offset: 1, style: `stop-color:${col(e.fill.c2)}` }))));
        fill = `url(#${gid})`;
      }
      const st = e.stroke;
      p.setAttribute('style', `fill:${OPEN.has(e.shape) ? 'none' : fill};${e.fillOp != null ? `fill-opacity:${e.fillOp};` : ''}stroke:${st ? col(st.c) : 'none'};stroke-width:${st ? st.w : 0};${st && DASH[st.dash] ? `stroke-dasharray:${dashArr(st.dash, st.w)};` : ''}stroke-linejoin:round;vector-effect:non-scaling-stroke`);
      s.append(p);
      if (e.shadow) s.style.filter = shadowCss(e.shadow);
      node.append(s);
    } else {
      if (e.fill && e.fill !== 'none') node.style.background = typeof e.fill === 'object' ? `linear-gradient(${e.fill.ang ?? 90}deg, ${col(e.fill.c1)}, ${col(e.fill.c2)})` : col(e.fill);
      if (e.stroke) node.style.outline = `${e.stroke.w}px ${e.stroke.dash && e.stroke.dash !== 'solid' ? 'dashed' : 'solid'} ${col(e.stroke.c)}`, node.style.outlineOffset = `-${e.stroke.w}px`;
      if (e.radius) node.style.borderRadius = e.radius + 'px';
      if (e.shadow) node.style.filter = shadowCss(e.shadow);
    }
    node.append(textBox(e, o));
    node.dataset.fit = e.box?.fit || 'none';
  } else if (e.type === 'line') {
    const w = Math.max(1, b.w), hh = Math.max(1, b.h);
    const x1 = e.w >= 0 ? 0 : w, y1 = e.h >= 0 ? 0 : hh, x2 = e.w >= 0 ? b.w : 0, y2 = e.h >= 0 ? b.h : 0;
    const s = svg('svg', { class: 'shp', width: w, height: hh, style: 'overflow:visible' });
    const st = e.stroke || { c: '@tx', w: 2 };
    const c = col(st.c);
    const mk = (id, kind) => {
      if (!kind) return null;
      const sz = 3 + st.w * .4;
      const shape = kind === 'dot' ? svg('circle', { cx: 5, cy: 5, r: 3.5, style: `fill:${c}` }) : kind === 'open' ? svg('path', { d: 'M1,1L9,5L1,9', style: `fill:none;stroke:${c};stroke-width:1.6` }) : svg('path', { d: 'M0,0L10,5L0,10Z', style: `fill:${c}` });
      return svg('marker', { id, viewBox: '0 0 10 10', refX: kind === 'dot' ? 5 : 8, refY: 5, markerWidth: sz, markerHeight: sz, orient: 'auto-start-reverse', markerUnits: 'strokeWidth' }, shape);
    };
    const hid = 'h' + e.id + (o.sfx || ''), tid = 't' + e.id + (o.sfx || '');
    const defs = svg('defs', {}, mk(hid, e.head), mk(tid, e.tail));
    let d;
    if (e.shape === 'elbow') d = `M${x1},${y1}H${(x1 + x2) / 2}V${y2}H${x2}`;
    else if (e.shape === 'curve') d = `M${x1},${y1}C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
    else d = `M${x1},${y1}L${x2},${y2}`;
    const p = svg('path', { d, 'marker-end': e.head ? `url(#${hid})` : null, 'marker-start': e.tail ? `url(#${tid})` : null, style: `fill:none;stroke:${c};stroke-width:${st.w};stroke-linecap:round;${DASH[st.dash] ? `stroke-dasharray:${dashArr(st.dash, st.w)};` : ''}` });
    s.append(defs, p);
    if (e.shadow) s.style.filter = shadowCss(e.shadow);
    node.append(s);
  } else if (e.type === 'image') {
    const url = assetURL(pres, e.src);
    if (url) {
      const img = h('img', { src: url, alt: e.alt || '', draggable: 'false', style: { objectFit: e.fit || 'cover' } });
      const fx = e.ifx || {};
      const f = [];
      if (fx.bright != null && fx.bright !== 100) f.push(`brightness(${fx.bright}%)`);
      if (fx.contrast != null && fx.contrast !== 100) f.push(`contrast(${fx.contrast}%)`);
      if (fx.sat != null && fx.sat !== 100) f.push(`saturate(${fx.sat}%)`);
      if (fx.gray) f.push(`grayscale(${fx.gray}%)`);
      if (fx.sepia) f.push(`sepia(${fx.sepia}%)`);
      if (fx.blur) f.push(`blur(${fx.blur}px)`);
      if (fx.hue) f.push(`hue-rotate(${fx.hue}deg)`);
      if (f.length) img.style.filter = f.join(' ');
      if (e.crop) { const c = e.crop; img.style.objectPosition = `${c.px ?? 50}% ${c.py ?? 50}%`; if (c.z && c.z !== 1) { img.style.transform = `scale(${c.z})`; img.style.transformOrigin = `${c.px ?? 50}% ${c.py ?? 50}%`; } }
      const wrap = h('div', { class: 'imgw' }, img);
      const cp = clipFor(e.mask, e.w, e.h);
      if (cp) wrap.style.clipPath = cp;
      if (e.radius && !e.mask) wrap.style.borderRadius = e.radius + 'px';
      if (e.stroke) { if (cp) node.append(svg('svg', { class: 'shp over', width: e.w, height: e.h }, svg('path', { d: shapePath(e.mask || 'rect', e.w, e.h), style: `fill:none;stroke:${col(e.stroke.c)};stroke-width:${e.stroke.w * 2};` }))); else { wrap.style.outline = `${e.stroke.w}px solid ${col(e.stroke.c)}`; wrap.style.outlineOffset = `-${e.stroke.w}px`; } }
      if (e.shadow) node.style.filter = shadowCss(e.shadow);
      node.prepend(wrap);
    } else {
      node.classList.add('img-ph');
      node.append(h('div', { class: 'img-ph-in' }, h('span', { class: 'ms' }, 'add_photo_alternate'), o.hint ? h('span', null, PH_HINT.picture) : null));
      if (!o.editor) node.style.display = 'none';
    }
  } else if (e.type === 'table') {
    node.append(tableEl(e));
  } else if (e.type === 'chart') {
    node.append(chartSvg(e.chart || {}, e.w, e.h));
  } else if (e.type === 'icon') {
    const i = h('span', { class: 'ms icon-el' + (e.filled ? ' fill' : '') }, e.name || 'star');
    Object.assign(i.style, { fontSize: Math.min(e.w, e.h) + 'px', color: col(e.color || '@a1') });
    if (e.shadow) i.style.filter = shadowCss(e.shadow);
    node.append(i);
  } else if (e.type === 'video') {
    const id = ytId(e.url);
    if (o.live && id) node.append(h('iframe', { src: `https://www.youtube-nocookie.com/embed/${id}?rel=0${e.autoplay ? '&autoplay=1&mute=1' : ''}${e.start ? '&start=' + e.start : ''}`, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true, style: { width: '100%', height: '100%', border: 0 } }));
    else if (o.live && e.src) node.append(h('video', { src: assetURL(pres, e.src), controls: true, style: { width: '100%', height: '100%', background: '#000' } }));
    else node.append(h('div', { class: 'vid-ph', style: id ? { backgroundImage: `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)` } : null }, h('span', { class: 'ms fill' }, 'play_circle')));
  }
  if (o.editor && e.locked) node.classList.add('is-locked');
  return node;
}

// ---------- decorations per theme ----------
function decoLayer(theme, slide, W, H) {
  const k = theme.deco;
  if (!k || slide.noDeco) return null;
  const big = slide.layout === 'title' || slide.layout === 'section';
  const s = svg('svg', { class: 'deco', viewBox: `0 0 ${W} ${H}`, width: W, height: H, preserveAspectRatio: 'none' });
  const A = n => `fill:var(--t-a${n})`;
  const add = (tag, a) => s.append(svg(tag, a));
  switch (k) {
    case 'bar': big ? add('rect', { x: 0, y: 0, width: W * .035, height: H, style: A(1) }) : add('rect', { x: 0, y: H * .06, width: W * .012, height: H * .16, style: A(1) }); break;
    case 'line': add('rect', { x: W * .06, y: big ? H * .585 : H * .21, width: big ? W * .12 : W * .07, height: 3, style: A(1) }); break;
    case 'glow':
      s.append(svg('defs', {}, svg('radialGradient', { id: 'gl1' }, svg('stop', { offset: 0, style: 'stop-color:var(--t-a1);stop-opacity:.55' }), svg('stop', { offset: 1, style: 'stop-color:var(--t-a1);stop-opacity:0' })),
        svg('radialGradient', { id: 'gl2' }, svg('stop', { offset: 0, style: 'stop-color:var(--t-a2);stop-opacity:.45' }), svg('stop', { offset: 1, style: 'stop-color:var(--t-a2);stop-opacity:0' }))));
      add('ellipse', { cx: W * .9, cy: H * .1, rx: W * .35, ry: H * .55, fill: 'url(#gl1)' });
      add('ellipse', { cx: W * .05, cy: H * .95, rx: W * .3, ry: H * .5, fill: 'url(#gl2)' });
      break;
    case 'corner': add('path', { d: `M${W},${H * (big ? .45 : .75)}L${W},${H}L${W * (big ? .7 : .86)},${H}Z`, style: A(1) }); add('path', { d: `M${W},${H * (big ? .62 : .85)}L${W},${H}L${W * (big ? .82 : .93)},${H}Z`, style: A(2) + ';opacity:.85' }); break;
    case 'side': big ? add('rect', { x: W * .72, y: 0, width: W * .28, height: H, style: 'fill:var(--t-bg2)' }) : add('rect', { x: 0, y: 0, width: W * .008, height: H, style: A(1) }); if (big) add('rect', { x: W * .72, y: 0, width: 4, height: H, style: A(1) }); break;
    case 'band': add('rect', { x: 0, y: 0, width: W, height: big ? H : H * .025, style: big ? 'fill:var(--t-bg2)' : A(1) }); if (big) add('rect', { x: 0, y: H * .9, width: W, height: H * .1, style: A(1) }); break;
    case 'block': add('rect', { x: W * .045, y: H * .07, width: big ? W * .06 : W * .02, height: big ? W * .06 : W * .02, style: A(1) }); break;
    case 'wave': add('path', { d: `M0,${H * .86}C${W * .25},${H * .78} ${W * .5},${H * .96} ${W},${H * .84}V${H}H0Z`, style: A(1) + ';opacity:.85' }); add('path', { d: `M0,${H * .92}C${W * .3},${H * .86} ${W * .6},${H}  ${W},${H * .9}V${H}H0Z`, style: A(3) + ';opacity:.8' }); break;
    case 'circle': add('circle', { cx: W * (big ? .82 : .96), cy: H * (big ? .5 : .1), r: H * (big ? .55 : .22), style: A(1) + ';opacity:.14' }); add('circle', { cx: W * .04, cy: H * .95, r: H * .12, style: A(2) + ';opacity:.12' }); break;
    case 'blob': add('path', { d: `M${W * .78},0C${W * .82},${H * .2} ${W * .95},${H * .25} ${W},${H * .2}V0Z`, style: A(1) + ';opacity:.85' }); add('path', { d: `M0,${H}C${W * .05},${H * .82} ${W * .14},${H * .86} ${W * .2},${H}Z`, style: A(3) + ';opacity:.8' }); break;
    case 'gold': add('rect', { x: W * .025, y: H * .045, width: W * .95, height: H * .91, style: 'fill:none;stroke:var(--t-a1);stroke-width:1.5;opacity:.7' }); break;
    case 'aurora':
      s.append(svg('defs', {}, svg('filter', { id: 'au' }, svg('feGaussianBlur', { stdDeviation: Math.min(W, H) * .08 }))));
      add('ellipse', { cx: W * .15, cy: H * .2, rx: W * .25, ry: H * .3, style: A(1) + ';opacity:.35', filter: 'url(#au)' });
      add('ellipse', { cx: W * .85, cy: H * .3, rx: W * .22, ry: H * .3, style: A(3) + ';opacity:.3', filter: 'url(#au)' });
      add('ellipse', { cx: W * .55, cy: H * .95, rx: W * .3, ry: H * .25, style: A(2) + ';opacity:.32', filter: 'url(#au)' });
      break;
    case 'stripe': {
      const y = H - H * .045, pat = svg('pattern', { id: 'stp', width: 24, height: 24, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, svg('rect', { width: 12, height: 24, style: A(1) }), svg('rect', { x: 12, width: 12, height: 24, style: A(2) }));
      s.append(svg('defs', {}, pat)); add('rect', { x: 0, y, width: W, height: H - y, fill: 'url(#stp)' });
      if (big) add('rect', { x: 0, y: 0, width: W * .03, height: H, style: A(1) });
      break;
    }
  }
  return s;
}

// Header & footer layer: slide number, date, footer text inside the margins.
function hfLayer(pres, slide, idx) {
  const hf = pres.hf;
  if (!hf || (!hf.num && !hf.date && !hf.footer) || slide.noHf || (hf.skipTitle && slide.layout === 'title')) return null;
  const f = frame(pres);
  const y = f.b - 22;
  const box = h('div', { class: 'hf-layer', style: { left: f.l + 'px', width: f.W + 'px', top: Math.min(y, pres.page.h - 26) + 'px' } },
    h('span', null, hf.date ? (hf.dateText || new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })) : ''),
    h('span', null, hf.footer || ''),
    h('span', null, hf.num ? String(idx + 1) : ''));
  return box;
}

// opts: editor (selection data + hidden els), hint (placeholder hints), live (iframes), sfx (svg id suffix), idx (slide number)
export function renderSlide(pres, slide, o = {}) {
  const { w, h: H } = pres.page;
  const root = h('div', { class: 'sl', dataset: { slide: slide.id } });
  Object.assign(root.style, { width: w + 'px', height: H + 'px' });
  themeVars(root, pres.theme);
  Object.assign(root.style, bgCss(slide.bg || pres.theme.bg || (pres.theme.bgImg ? { t: 'img', src: pres.theme.bgImg } : null), pres));
  const d = decoLayer(pres.theme, slide, w, H);
  if (d) root.append(d);
  if (!slide.hideMaster && pres.master?.length) {
    const m = h('div', { class: 'master-layer' + (o.editMaster ? ' editing' : '') });
    for (const e of pres.master) m.append(renderEl(pres, e, { ...o, sfx: (o.sfx || '') + 'm' }));
    root.append(m);
  }
  if (!o.editMaster) for (const e of slide.els) root.append(renderEl(pres, e, o));
  const hf = hfLayer(pres, slide, o.idx ?? pres.slides.indexOf(slide));
  if (hf) root.append(hf);
  return root;
}
export function fitAll(root) { root.querySelectorAll('.el[data-fit="shrink"]').forEach(fitText); }

// Thumbnail: a scaled slide inside a box of the given width.
export function thumb(pres, slide, width, o = {}) {
  const { w, h: H } = pres.page;
  const k = width / w;
  const box = h('div', { class: 'thumb-sl', style: o.fluid ? { width: '100%', aspectRatio: `${w} / ${H}` } : { width: width + 'px', height: Math.round(H * k) + 'px' } });
  const s = renderSlide(pres, slide, { sfx: 'th' + Math.random().toString(36).slice(2, 6), ...o });
  s.style.transform = `scale(${k})`;
  box.append(s);
  // fluid: follows the width of its container
  if (o.fluid) new ResizeObserver(() => { if (box.clientWidth) s.style.transform = `scale(${box.clientWidth / w})`; }).observe(box);
  if (o.fit !== false) requestAnimationFrame(() => fitAll(s));
  return box;
}
export { svg, esc };
