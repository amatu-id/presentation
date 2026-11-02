// Right side panels: format options, animations, transitions, theme, comments, selection pane, versions, design ideas.
import { E, Prefs, savePrefs, me, slide, els, elById, selEls, one } from './state.js';
import { h, icon, toast, toggleMenu, closeMenus, palette, avatar, fmtWhen, fmtFull, confirmDlg, uid, select, toHex, pickFile, readFile } from './ui.js';
import * as O from './ops.js';
import { THEMES, TOKENS, TOKEN_NAMES, cloneTheme, px2cm, cm2px, layoutName, LAYOUTS, frame, htmlText, slideTitle, newSlide, shapeEl, CONTENT_KEYS, normalize } from './model.js';
import { thumb, renderSlide, fitAll, bbox, CHART_TYPES } from './render.js';
import { FONTS } from './fonts.js';
import { Store } from './store.js';
import { colorMenu } from './commands.js';

const TITLES = { format: 'Opsi format', anim: 'Animasi', trans: 'Transisi', theme: 'Tema', comments: 'Komentar', select: 'Panel seleksi', versions: 'Histori versi', design: 'Ide desain' };
let body = null, kind = null, arg = null;

export function openPanel(k, a) {
  if (E.view.panel === k && a == null) { closePanel(); return; }
  E.view.panel = kind = k; arg = a;
  const close = h('button', { class: 'ib', 'aria-label': 'Tutup', onclick: closePanel }, icon('close'));
  body = h('div', { class: 'side-b' });
  E.side.replaceChildren(h('div', { class: 'side right glass sl-side' }, h('div', { class: 'side-h' }, h('div', { class: 't' }, TITLES[k]), close), body));
  E.layout();
  render();
  E.updateToolbar?.();
}
export function closePanel() {
  E.view.panel = kind = null;
  stopPreview();
  E.side.replaceChildren();
  E.layout();
  E.updateToolbar?.();
}
E.openPanel = openPanel;
// Re-render on selection / slide / document changes, but never under the user's fingers.
E.refreshPanel = why => {
  if (!kind || !body) return;
  const a = document.activeElement;   // never re-render under a field the user is typing in
  if (a && body.contains(a) && a.matches('textarea, input:not([type=checkbox]):not([type=range]):not([type=color])') && why !== 'sel' && why !== 'slide') return;
  render();
};
function render() {
  if (!body || E.dead) return;
  const st = body.scrollTop;
  const fn = { format: formatPanel, anim: animPanel, trans: transPanel, theme: themePanel, comments: commentsPanel, select: selectPane, versions: versionsPanel, design: designPanel }[kind];
  const out = fn?.();
  const put = o => { body.replaceChildren(...[o].flat(Infinity).filter(x => x != null && x !== false)); body.scrollTop = st; };
  if (out instanceof Promise) out.then(put); else put(out);
}

// ---------- form bits ----------
const open = new Set(JSON.parse(localStorage.getItem('aslides.fopen') || '["size","fill","text","img","anim"]'));
function sec(id, title, ...kids) {
  const d = h('details', { class: 'fsec', open: open.has(id) || null }, h('summary', null, title), h('div', { class: 'fsec-b' }, kids));
  d.addEventListener('toggle', () => { if (d.open) open.add(id); else open.delete(id); try { localStorage.setItem('aslides.fopen', JSON.stringify([...open])); } catch { /* */ } });
  return d;
}
const row = (label, ...kids) => h('div', { class: 'frow' }, h('span', { class: 'fl' }, label), h('div', { class: 'fc' }, kids));
function num(value, onchange, o = {}) {
  const i = h('input', { class: 'tx num', type: 'number', value: value == null ? '' : +(+value).toFixed(o.dp ?? 2), step: o.step ?? .1, min: o.min, max: o.max });
  i.addEventListener('change', () => { const v = parseFloat(i.value); if (!isNaN(v)) onchange(v); });
  return o.unit ? h('label', { class: 'num-u' }, i, h('span', null, o.unit)) : i;
}
function slider(value, min, max, step, onchange, fmt = v => v) {
  const out = h('span', { class: 'sv' }, fmt(value));
  const i = h('input', { type: 'range', min, max, step, value });
  let t = 0;
  i.addEventListener('input', () => { out.textContent = fmt(+i.value); onchange(+i.value, false); clearTimeout(t); t = setTimeout(() => onchange(+i.value, true), 350); });
  return h('div', { class: 'slider' }, i, out);
}
function colorPick(value, onPick, reset) {
  const v = typeof value === 'string' && value[0] === '@' ? E.doc.theme.c[value.slice(1)] : value;
  const b = h('button', { class: 'cpick' }, h('i', { style: { background: v || 'transparent' } }), h('span', null, value ? (value[0] === '@' ? TOKEN_NAMES[value.slice(1)] : toHex(v)) : (reset || 'Tidak ada')), icon('arrow_drop_down', 'sm'));
  b.onclick = () => toggleMenu(b, () => colorMenu(v, onPick, reset), { cls: 'pop' });
  return b;
}
function check(label, on, onchange) {
  const i = h('input', { type: 'checkbox', checked: on || null });
  i.addEventListener('change', () => onchange(i.checked));
  return h('label', { class: 'fchk' }, i, h('span', null, label));
}
function seg(opts, value, onchange) {
  return h('div', { class: 'seg sm' }, opts.map(([v, l, ic]) => h('button', { class: v === value ? 'on' : '', 'data-tip': ic ? l : null, onclick: () => onchange(v) }, ic ? icon(ic, 'sm') : l)));
}
// Live preview while dragging a slider, commit on release.
const live = (fn, label) => (v, done) => { for (const e of selEls()) fn(e, v); if (done) E.commit(label); else for (const e of selEls()) E.replaceNode(e); E.drawOverlay(); };

// ---------- format options ----------
function formatPanel() {
  const list = selEls();
  if (!list.length) return slideOptions();
  const e = list[0], multi = list.length > 1;
  const out = [];
  const b = bbox(e);
  const cm = v => +px2cm(v).toFixed(2);
  out.push(h('div', { class: 'muted small fhint' }, multi ? `${list.length} objek dipilih` : objName(e)));
  out.push(sec('size', 'Ukuran & rotasi',
    row('Lebar', num(cm(b.w), v => O.setProp(x => { const r = x.h / x.w; x.w = cm2px(v); if (keep()) x.h = x.w * r; }, 'Ukuran'), { unit: 'cm' })),
    row('Tinggi', num(cm(b.h), v => O.setProp(x => { const r = x.w / x.h; x.h = cm2px(v); if (keep()) x.w = x.h * r; }, 'Ukuran'), { unit: 'cm' })),
    row('', check('Kunci rasio aspek', Prefs.keepRatio, v => { Prefs.keepRatio = v; savePrefs(); })),
    e.type !== 'line' ? row('Rotasi', num(e.rot || 0, v => O.setProp(x => { x.rot = ((v % 360) + 360) % 360; }, 'Putar'), { unit: '°', step: 1, dp: 0 }), h('button', { class: 'ib sm', 'data-tip': 'Putar 90°', onclick: () => O.rotate('cw') }, icon('rotate_right')), h('button', { class: 'ib sm', 'data-tip': 'Balik horizontal', onclick: () => O.rotate('h') }, icon('flip')), h('button', { class: 'ib sm', 'data-tip': 'Balik vertikal', onclick: () => O.rotate('v') }, icon('flip', 'rot90'))) : null));
  out.push(sec('pos', 'Posisi',
    row('X dari kiri', num(cm(b.x), v => O.setProp(x => { x.x = cm2px(v); }, 'Posisi'), { unit: 'cm' })),
    row('Y dari atas', num(cm(b.y), v => O.setProp(x => { x.y = cm2px(v); }, 'Posisi'), { unit: 'cm' })),
    row('Ratakan', ...['al-left', 'al-center', 'al-right', 'al-top', 'al-middle', 'al-bottom'].map(id => h('button', { class: 'ib sm', 'data-tip': E.run && id, onclick: () => E.run(id) }, icon({ 'al-left': 'align_horizontal_left', 'al-center': 'align_horizontal_center', 'al-right': 'align_horizontal_right', 'al-top': 'align_vertical_top', 'al-middle': 'align_vertical_center', 'al-bottom': 'align_vertical_bottom' }[id]))))));

  if (e.type === 'shape' || e.type === 'text' || e.type === 'image') {
    const f = e.fill;
    const kindF = f && typeof f === 'object' ? 'grad' : f ? 'solid' : 'none';
    out.push(sec('fill', e.type === 'image' ? 'Garis batas' : 'Isian & garis',
      e.type !== 'image' ? row('Isian', seg([['none', 'Tidak ada'], ['solid', 'Warna'], ['grad', 'Gradien']], kindF, v => O.setProp(x => { x.fill = v === 'none' ? null : v === 'solid' ? (typeof x.fill === 'string' ? x.fill : '@a1') : { t: 'grad', c1: typeof x.fill === 'string' ? x.fill : '@a1', c2: '@a2', ang: 90 }; }, 'Isian'))) : null,
      kindF === 'solid' && e.type !== 'image' ? row('Warna', colorPick(f, c => O.setProp(x => { x.fill = c; }, 'Isian'))) : null,
      kindF === 'grad' ? [row('Warna 1', colorPick(f.c1, c => O.setProp(x => { if (typeof x.fill === 'object') x.fill.c1 = c; }, 'Gradien'))), row('Warna 2', colorPick(f.c2, c => O.setProp(x => { if (typeof x.fill === 'object') x.fill.c2 = c; }, 'Gradien'))),
        row('Sudut', slider(f.ang ?? 90, 0, 360, 5, live((x, v) => { if (typeof x.fill === 'object') x.fill.ang = v; }, 'Gradien'), v => v + '°'))] : null,
      kindF !== 'none' && e.type === 'shape' ? row('Transparansi', slider(Math.round((1 - (e.fillOp ?? 1)) * 100), 0, 100, 1, live((x, v) => { x.fillOp = 1 - v / 100; }, 'Transparansi'), v => v + '%')) : null,
      row('Garis', colorPick(e.stroke?.c, c => O.setProp(x => { if (c == null) delete x.stroke; else x.stroke = { w: 2, dash: 'solid', ...(x.stroke || {}), c }; }, 'Garis'), 'Tidak ada')),
      e.stroke ? row('Tebal', num(e.stroke.w, v => O.setProp(x => { if (x.stroke) x.stroke.w = Math.max(.25, v); }, 'Garis'), { unit: 'px', step: .5 }), select([['solid', 'Garis'], ['dash', 'Putus-putus'], ['dot', 'Titik'], ['dashdot', 'Putus titik'], ['long', 'Putus panjang']], e.stroke.dash || 'solid', v => O.setProp(x => { if (x.stroke) x.stroke.dash = v; }, 'Garis'))) : null,
      e.type === 'shape' && e.shape === 'round' ? row('Sudut', slider(Math.round((e.adj?.r ?? .16) * 100), 0, 50, 1, live((x, v) => { x.adj = { ...(x.adj || {}), r: v / 100 }; }, 'Sudut'), v => v + '%')) : null,
      e.type === 'text' || e.type === 'image' ? row('Sudut bulat', slider(e.radius || 0, 0, 120, 1, live((x, v) => { x.radius = v; }, 'Sudut'), v => v + ' px')) : null,
      row('Opasitas', slider(Math.round((e.opacity ?? 1) * 100), 5, 100, 1, live((x, v) => { x.opacity = v / 100; }, 'Opasitas'), v => v + '%'))));
  }
  if (e.type === 'line') {
    out.push(sec('fill', 'Garis',
      row('Warna', colorPick(e.stroke?.c, c => O.setProp(x => { x.stroke = { w: 2, ...(x.stroke || {}), c: c || '@tx' }; }, 'Garis'))),
      row('Tebal', num(e.stroke?.w ?? 2, v => O.setProp(x => { x.stroke = { c: '@tx', ...(x.stroke || {}), w: Math.max(.25, v) }; }, 'Garis'), { unit: 'px', step: .5 })),
      row('Gaya', select([['solid', 'Garis'], ['dash', 'Putus-putus'], ['dot', 'Titik'], ['dashdot', 'Putus titik'], ['long', 'Putus panjang']], e.stroke?.dash || 'solid', v => O.setProp(x => { x.stroke = { c: '@tx', w: 2, ...(x.stroke || {}), dash: v }; }, 'Garis'))),
      row('Jenis', select([['line', 'Lurus'], ['elbow', 'Siku'], ['curve', 'Kurva']], ['elbow', 'curve'].includes(e.shape) ? e.shape : 'line', v => O.setProp(x => { x.shape = v; }, 'Jenis garis'))),
      row('Awal', select([['', 'Tidak ada'], ['arrow', 'Panah'], ['open', 'Panah terbuka'], ['dot', 'Bulatan']], e.tail || '', v => O.setProp(x => { x.tail = v || null; }, 'Ujung'))),
      row('Akhir', select([['', 'Tidak ada'], ['arrow', 'Panah'], ['open', 'Panah terbuka'], ['dot', 'Bulatan']], e.head || '', v => O.setProp(x => { x.head = v || null; }, 'Ujung')))));
  }
  if (e.box) {
    const pad = e.box.pad || [8, 10, 8, 10];
    out.push(sec('text', 'Kotak teks',
      row('Vertikal', seg([['top', 'Atas', 'vertical_align_top'], ['middle', 'Tengah', 'vertical_align_center'], ['bottom', 'Bawah', 'vertical_align_bottom']], e.box.va || 'top', v => O.fmt.valign(v))),
      row('Penyesuaian', select([['none', 'Jangan sesuaikan otomatis'], ['shrink', 'Perkecil teks saat meluap'], ['grow', 'Ubah ukuran bentuk agar pas']], e.box.fit || 'none', v => O.setProp(x => { if (x.box) x.box.fit = v; }, 'Penyesuaian otomatis'))),
      row('Kolom', seg([[1, '1'], [2, '2'], [3, '3']], e.box.cols || 1, v => O.fmt.cols(v))),
      row('Margin atas', num(pad[0], v => O.setProp(x => { x.box.pad = [...(x.box.pad || pad)]; x.box.pad[0] = v; }, 'Padding'), { unit: 'px', step: 1, dp: 0 })),
      row('Margin kanan', num(pad[1], v => O.setProp(x => { x.box.pad = [...(x.box.pad || pad)]; x.box.pad[1] = v; }, 'Padding'), { unit: 'px', step: 1, dp: 0 })),
      row('Margin bawah', num(pad[2], v => O.setProp(x => { x.box.pad = [...(x.box.pad || pad)]; x.box.pad[2] = v; }, 'Padding'), { unit: 'px', step: 1, dp: 0 })),
      row('Margin kiri', num(pad[3], v => O.setProp(x => { x.box.pad = [...(x.box.pad || pad)]; x.box.pad[3] = v; }, 'Padding'), { unit: 'px', step: 1, dp: 0 })),
      row('Spasi huruf', slider(e.def?.ls || 0, -3, 20, .5, live((x, v) => { x.def = { ...(x.def || {}), ls: v }; }, 'Spasi huruf'), v => v + ' px')),
      row('Arah', seg([['h', 'Mendatar'], ['v', 'Tegak']], e.box.dir || 'h', v => O.setProp(x => { if (x.box) x.box.dir = v; }, 'Arah teks')))));
    const tf = e.tfx || {};
    const setFx = (k, v) => O.setProp(x => { x.tfx = { ...(x.tfx || {}) }; if (v == null) delete x.tfx[k]; else x.tfx[k] = v; if (!Object.keys(x.tfx).length) delete x.tfx; }, 'Efek teks');
    out.push(sec('wordart', 'Efek teks (WordArt)',
      row('Gradien', check('', !!tf.grad, v => setFx('grad', v ? { c1: '@a1', c2: '@a2', ang: 90 } : null)), tf.grad ? [colorPick(tf.grad.c1, c => setFx('grad', { ...tf.grad, c1: c })), colorPick(tf.grad.c2, c => setFx('grad', { ...tf.grad, c2: c }))] : null),
      row('Garis tepi', check('', !!tf.outline, v => setFx('outline', v ? { c: '@a1', w: 1.5 } : null)), tf.outline ? [colorPick(tf.outline.c, c => setFx('outline', { ...tf.outline, c })), num(tf.outline.w, v => setFx('outline', { ...tf.outline, w: v }), { unit: 'px', step: .5 })] : null),
      row('Bayangan', check('', !!tf.shadow, v => setFx('shadow', v ? { x: 2, y: 3, b: 4, c: 'rgba(0,0,0,.4)' } : null)), tf.shadow ? colorPick(tf.shadow.c, c => setFx('shadow', { ...tf.shadow, c })) : null),
      row('Cahaya', check('', !!tf.glow, v => setFx('glow', v ? { c: '@a1', b: 12 } : null)), tf.glow ? [colorPick(tf.glow.c, c => setFx('glow', { ...tf.glow, c })), num(tf.glow.b, v => setFx('glow', { ...tf.glow, b: v }), { unit: 'px', step: 1 })] : null),
      h('div', { class: 'wa-grid sm' }, O.WORDART.map(([n, def, tfx], i) => h('button', { class: 'wa wa' + i, onclick: () => O.setProp(x => { x.tfx = JSON.parse(JSON.stringify(tfx)); x.def = { ...(x.def || {}), ...def, size: x.def?.size || def.size }; }, 'WordArt') }, n)))));
  }
  if (e.type !== 'table' && e.type !== 'video') {
    const s = e.shadow;
    const setSh = p => O.setProp(x => { x.shadow = { x: 3, y: 5, b: 10, c: 'rgba(0,0,0,.35)', ...(x.shadow || {}), ...p }; }, 'Bayangan');
    out.push(sec('shadow', 'Bayangan',
      row('', check('Bayangan jatuh', !!s, v => O.setProp(x => { if (v) x.shadow = { x: 3, y: 5, b: 10, c: 'rgba(0,0,0,.35)' }; else delete x.shadow; }, 'Bayangan'))),
      s ? [row('Warna', colorPick(s.c, c => setSh({ c: c || 'rgba(0,0,0,.35)' }))), row('Buram', slider(s.b ?? 10, 0, 40, 1, live((x, v) => { if (x.shadow) x.shadow.b = v; }, 'Bayangan'), v => v + ' px')),
        row('Jarak X', slider(s.x ?? 3, -30, 30, 1, live((x, v) => { if (x.shadow) x.shadow.x = v; }, 'Bayangan'), v => v + ' px')), row('Jarak Y', slider(s.y ?? 5, -30, 30, 1, live((x, v) => { if (x.shadow) x.shadow.y = v; }, 'Bayangan'), v => v + ' px'))] : null));
  }
  if (e.type === 'image') {
    const fx = e.ifx || {};
    const setI = (k, def) => live((x, v) => { x.ifx = { ...(x.ifx || {}) }; if (v === def) delete x.ifx[k]; else x.ifx[k] = v; }, 'Koreksi gambar');
    const cr = e.crop || {};
    out.push(sec('img', 'Gambar',
      row('Isi bingkai', seg([['cover', 'Penuhi'], ['contain', 'Muat'], ['fill', 'Regang']], e.fit || 'cover', v => O.setProp(x => { x.fit = v; }, 'Isi bingkai'))),
      row('Perbesar', slider(Math.round((cr.z || 1) * 100), 100, 400, 5, live((x, v) => { x.crop = { ...(x.crop || {}), z: v / 100 }; }, 'Pangkas'), v => v + '%')),
      row('Geser X', slider(cr.px ?? 50, 0, 100, 1, live((x, v) => { x.crop = { ...(x.crop || {}), px: v }; }, 'Pangkas'), v => v + '%')),
      row('Geser Y', slider(cr.py ?? 50, 0, 100, 1, live((x, v) => { x.crop = { ...(x.crop || {}), py: v }; }, 'Pangkas'), v => v + '%')),
      row('Kecerahan', slider(fx.bright ?? 100, 0, 200, 1, setI('bright', 100), v => v + '%')),
      row('Kontras', slider(fx.contrast ?? 100, 0, 200, 1, setI('contrast', 100), v => v + '%')),
      row('Saturasi', slider(fx.sat ?? 100, 0, 200, 1, setI('sat', 100), v => v + '%')),
      row('Hitam putih', slider(fx.gray ?? 0, 0, 100, 1, setI('gray', 0), v => v + '%')),
      row('Sepia', slider(fx.sepia ?? 0, 0, 100, 1, setI('sepia', 0), v => v + '%')),
      row('Rona', slider(fx.hue ?? 0, 0, 360, 1, setI('hue', 0), v => v + '°')),
      row('Buram', slider(fx.blur ?? 0, 0, 20, .5, setI('blur', 0), v => v + ' px')),
      row('', h('button', { class: 'btn btn-ghost', onclick: () => E.run('img-replace') }, icon('flip_camera_ios'), 'Ganti'), h('button', { class: 'btn btn-ghost', onclick: () => E.run('img-reset') }, icon('restart_alt'), 'Setel ulang')),
      row('Teks alt', (() => { const t = h('input', { class: 'tx', value: e.alt || '', placeholder: 'Deskripsi gambar' }); t.onchange = () => O.setProp(x => { x.alt = t.value; }, 'Teks alt'); return t; })())));
  }
  if (e.type === 'table') {
    const st = e.tstyle || {};
    const setT = p => O.setProp(x => { x.tstyle = { ...(x.tstyle || {}), ...p }; }, 'Gaya tabel');
    out.push(sec('tbl', 'Tabel',
      row('', check('Baris judul', st.head !== false, v => setT({ head: v }))), row('', check('Baris berpita', st.band !== false, v => setT({ band: v }))), row('', check('Kolom pertama', !!st.firstCol, v => setT({ firstCol: v }))),
      row('Warna', colorPick(st.c || '@a1', c => setT({ c: c || '@a1' }))), row('Garis', colorPick(st.line || '@tx2', c => setT({ line: c || '@tx2' }))),
      row('Ukuran teks', num(e.def?.size || 14, v => O.setProp(x => { x.def = { ...(x.def || {}), size: v }; }, 'Ukuran teks'), { unit: 'pt', step: 1, dp: 0 })),
      h('div', { class: 'btn-grid' }, ['tbl-row-above', 'tbl-row-below', 'tbl-col-left', 'tbl-col-right', 'tbl-del-row', 'tbl-del-col', 'tbl-eq'].map(id => h('button', { class: 'btn btn-ghost sm', onclick: () => E.run(id) }, id.replace('tbl-', '').replace('row-above', '+ Baris atas').replace('row-below', '+ Baris bawah').replace('col-left', '+ Kolom kiri').replace('col-right', '+ Kolom kanan').replace('del-row', '− Baris').replace('del-col', '− Kolom').replace('eq', 'Ratakan kolom'))))));
  }
  if (e.type === 'chart') {
    const c = e.chart;
    const setC = p => O.setProp(x => { x.chart = { ...x.chart, ...p }; }, 'Bagan');
    out.push(sec('chart', 'Bagan',
      row('Jenis', select(CHART_TYPES.map(([k, l]) => [k, l]), c.type, v => setC({ type: v }))),
      row('Judul', (() => { const t = h('input', { class: 'tx', value: c.title || '' }); t.onchange = () => setC({ title: t.value }); return t; })()),
      row('', check('Legenda', c.legend !== false, v => setC({ legend: v }))), row('', check('Label data', !!c.labels, v => setC({ labels: v }))),
      row('', h('button', { class: 'btn btn-tonal', onclick: () => E.run('chart-edit') }, icon('edit_note'), 'Edit data…'))));
  }
  if (e.type === 'icon') out.push(sec('icon', 'Ikon', row('Warna', colorPick(e.color || '@a1', c => O.setProp(x => { x.color = c || '@a1'; }, 'Warna ikon'))), row('', check('Terisi', !!e.filled, v => O.setProp(x => { x.filled = v; }, 'Ikon'))), row('', h('button', { class: 'btn btn-ghost', onclick: () => E.run('icon-replace') }, 'Ganti ikon…'))));
  if (e.type === 'video') out.push(sec('video', 'Video', row('', h('button', { class: 'btn btn-tonal', onclick: () => E.run('video-edit') }, icon('smart_display'), 'Opsi video…'))));
  out.push(sec('link', 'Tautan & nama',
    row('Nama', (() => { const t = h('input', { class: 'tx', value: e.name || '', placeholder: objName(e) }); t.onchange = () => O.setProp(x => { x.name = t.value.trim() || undefined; }, 'Nama objek'); return t; })()),
    row('Tautan', h('span', { class: 'small ellip' }, e.link ? (e.link.startsWith('#slide:') ? 'Ke slide ' + (E.doc.slides.findIndex(s => s.id === e.link.slice(7)) + 1) : e.link) : 'Tidak ada'), h('button', { class: 'ib sm', onclick: () => E.run('link') }, icon('edit'))),
    row('', check('Kunci posisi', !!e.locked, v => O.setProp(x => { x.locked = v; }, 'Kunci')))));
  return out;
}
const keep = () => !!Prefs.keepRatio;
export function objName(e) {
  if (e.name) return e.name;
  const t = htmlText(e.html || '');
  const base = { text: 'Kotak teks', shape: 'Bentuk', line: 'Garis', image: 'Gambar', table: 'Tabel', chart: 'Bagan', icon: 'Ikon', video: 'Video' }[e.type] || 'Objek';
  return e.ph === 'title' ? 'Judul' + (t ? ': ' + t.slice(0, 24) : '') : t ? `${base}: ${t.slice(0, 26)}` : base;
}

function slideOptions() {
  const s = slide(), d = E.doc;
  const bg = s.bg;
  return [
    h('div', { class: 'muted small fhint' }, `Slide ${E.cur + 1} · ${layoutName(s.layout)}`),
    sec('sbg', 'Latar belakang slide',
      row('Jenis', seg([['', 'Tema'], ['color', 'Warna'], ['grad', 'Gradien'], ['img', 'Gambar']], bg?.t || '', v => O.setBackground(v === '' ? null : v === 'color' ? { t: 'color', c: '@bg2' } : v === 'grad' ? { t: 'grad', c1: '@a1', c2: '@a2', ang: 135 } : bg?.t === 'img' ? bg : null) || (v === 'img' && pickBg()))),
      bg?.t === 'color' ? row('Warna', colorPick(bg.c, c => O.setBackground({ t: 'color', c: c || '@bg' }))) : null,
      bg?.t === 'grad' ? [row('Warna 1', colorPick(bg.c1, c => O.setBackground({ ...bg, c1: c || '@a1' }))), row('Warna 2', colorPick(bg.c2, c => O.setBackground({ ...bg, c2: c || '@a2' }))), row('Sudut', num(bg.ang ?? 135, v => O.setBackground({ ...bg, ang: v }), { unit: '°', step: 5, dp: 0 })), row('', check('Radial', !!bg.radial, v => O.setBackground({ ...bg, radial: v })))] : null,
      bg?.t === 'img' ? [row('Ukuran', select([['cover', 'Penuhi'], ['contain', 'Muat'], ['tile', 'Ubin']], bg.fit || 'cover', v => O.setBackground({ ...bg, fit: v }))), row('', h('button', { class: 'btn btn-ghost', onclick: pickBg }, 'Ganti gambar…'))] : null,
      row('', h('button', { class: 'btn btn-ghost', onclick: () => { O.setBackground(s.bg, true); toast('Latar belakang diterapkan ke tema'); } }, icon('select_all'), 'Terapkan ke semua slide'))),
    sec('slay', 'Tata letak', h('div', { class: 'lay-grid' }, LAYOUTS.map(([id, n]) => h('button', { class: 'lay' + (s.layout === id ? ' on' : ''), onclick: () => O.setLayout(id) }, layoutThumb(id), h('span', null, n))))),
    sec('sopt', 'Opsi slide',
      row('', check('Lewati saat presentasi', !!s.skip, v => { s.skip = v; E.commit('Lewati slide', 'all'); })),
      row('', check('Sembunyikan objek master', !!s.hideMaster, v => { s.hideMaster = v; E.commit('Master'); })),
      row('', check('Sembunyikan hiasan tema', !!s.noDeco, v => { s.noDeco = v; E.commit('Hiasan tema'); })),
      row('', check('Sembunyikan header & footer', !!s.noHf, v => { s.noHf = v; E.commit('Header & footer'); }))),
    sec('sdoc', 'Presentasi', row('Ukuran', h('span', { class: 'small' }, `${(+px2cm(d.page.w).toFixed(1))} × ${(+px2cm(d.page.h).toFixed(1))} cm`), h('button', { class: 'btn btn-ghost sm', onclick: () => E.run('page') }, 'Ubah…')),
      row('Margin', h('span', { class: 'small' }, ['t', 'r', 'b', 'l'].map(k => (+d.page.margin[k]).toFixed(2).replace('.', ',')).join(' / ') + ' cm'), h('button', { class: 'btn btn-ghost sm', onclick: () => E.run('page') }, 'Ubah…'))),
  ];
}
async function pickBg() {
  const [f] = await pickFile('image/*');
  if (!f) return;
  const url = await readFile(f);
  O.setBackground({ t: 'img', src: O.addAsset(url), fit: 'cover' });
}
function layoutThumb(id) {
  const d = E.doc;
  const fake = newSlide(d, id);
  fake.els.forEach(e => { if (e.type === 'text') e.html = `<p>${e.ph === 'title' ? 'Judul' : e.ph === 'subtitle' ? 'Subjudul' : '— — —'}</p>`; });
  return thumb(d, fake, 96);
}

// ---------- animations (PowerPoint-style animation pane) ----------
export const EFFECTS = {
  in: [['appear', 'Muncul'], ['fade', 'Pudar'], ['fly', 'Terbang masuk'], ['float', 'Mengambang masuk'], ['zoom', 'Perbesar'], ['grow', 'Tumbuh & putar'], ['wipe', 'Sapu'], ['split', 'Belah'], ['bounce', 'Pantul'], ['rise', 'Naik'], ['spin', 'Putar masuk'], ['blur', 'Fokus']],
  emph: [['pulse', 'Denyut'], ['spin360', 'Berputar'], ['growshrink', 'Membesar'], ['teeter', 'Bergoyang'], ['flash', 'Berkedip'], ['wave', 'Gelombang'], ['bold', 'Tebal sesaat']],
  out: [['disappear', 'Hilang'], ['fadeout', 'Pudar keluar'], ['flyout', 'Terbang keluar'], ['floatout', 'Mengambang keluar'], ['zoomout', 'Perkecil'], ['wipeout', 'Sapu keluar'], ['sinkout', 'Tenggelam']],
};
export const KIND_N = { in: 'Masuk', emph: 'Penekanan', out: 'Keluar' };
export const effName = (k, eff) => (EFFECTS[k]?.find(x => x[0] === eff) || [, eff])[1];
const DIRS = [['bottom', 'Dari bawah'], ['left', 'Dari kiri'], ['right', 'Dari kanan'], ['top', 'Dari atas']];
function animPanel() {
  const s = slide();
  s.anims ||= [];
  const list = selEls();
  const add = h('button', { class: 'btn btn-primary', disabled: !list.length || null }, icon('add'), 'Tambah animasi');
  add.onclick = () => toggleMenu(add, () => Object.entries(EFFECTS).flatMap(([k, arr]) => [{ head: KIND_N[k] }, ...arr.map(([eff, n]) => ({ label: n, icon: k === 'in' ? 'login' : k === 'out' ? 'logout' : 'auto_awesome', run: () => {
    for (const e of selEls()) s.anims.push({ id: uid(6), el: e.id, kind: k, eff, dur: eff === 'appear' || eff === 'disappear' ? 0 : .6, delay: 0, start: s.anims.length ? 'click' : 'click', dir: 'bottom' });
    E.commit('Animasi', 'cur'); preview(s.anims.slice(-list.length));
  } }))]), { width: 240 });
  const items = s.anims.map((a, i) => {
    const e = s.els.find(x => x.id === a.el);
    if (!e) return null;
    const step = s.anims.slice(0, i + 1).filter(x => x.start === 'click').length;
    const setA = p => { Object.assign(a, p); E.commit('Animasi', 'cur'); };
    const det = h('details', { class: 'anim-it' + (E.sel.has(a.el) ? ' on' : ''), open: arg === a.id || E.sel.has(a.el) || null },
      h('summary', null, h('span', { class: 'an-n' }, a.start === 'click' ? String(step) : ''), icon(a.kind === 'in' ? 'login' : a.kind === 'out' ? 'logout' : 'auto_awesome', 'sm an-k ' + a.kind),
        h('span', { class: 'an-t' }, h('b', null, effName(a.kind, a.eff)), h('span', { class: 'muted small' }, objName(e))),
        h('button', { class: 'ib sm', 'data-tip': 'Naikkan', onclick: ev => { ev.preventDefault(); if (i) { [s.anims[i - 1], s.anims[i]] = [s.anims[i], s.anims[i - 1]]; E.commit('Urutan animasi', 'cur'); } } }, icon('arrow_upward')),
        h('button', { class: 'ib sm', 'data-tip': 'Turunkan', onclick: ev => { ev.preventDefault(); if (i < s.anims.length - 1) { [s.anims[i + 1], s.anims[i]] = [s.anims[i], s.anims[i + 1]]; E.commit('Urutan animasi', 'cur'); } } }, icon('arrow_downward')),
        h('button', { class: 'ib sm', 'data-tip': 'Hapus', onclick: ev => { ev.preventDefault(); s.anims.splice(i, 1); E.commit('Hapus animasi', 'cur'); } }, icon('delete'))),
      h('div', { class: 'fsec-b' },
        row('Efek', select(Object.entries(EFFECTS).flatMap(([k, arr]) => arr.map(([v, n]) => [k + ':' + v, KIND_N[k] + ' · ' + n])), a.kind + ':' + a.eff, v => { const [k, eff] = v.split(':'); setA({ kind: k, eff }); })),
        ['fly', 'float', 'wipe', 'flyout', 'floatout', 'wipeout'].includes(a.eff) ? row('Arah', select(DIRS, a.dir || 'bottom', v => setA({ dir: v }))) : null,
        row('Mulai', select([['click', 'Saat diklik'], ['with', 'Bersama sebelumnya'], ['after', 'Setelah sebelumnya']], a.start, v => setA({ start: v }))),
        row('Durasi', num(a.dur, v => setA({ dur: Math.max(0, v) }), { unit: 'dtk', step: .1 })),
        row('Tunda', num(a.delay || 0, v => setA({ delay: Math.max(0, v) }), { unit: 'dtk', step: .1 })),
        a.kind === 'emph' ? row('Ulangi', num(a.rep || 1, v => setA({ rep: Math.max(1, Math.round(v)) }), { step: 1, dp: 0 })) : null,
        e.type === 'text' || e.type === 'shape' ? row('', check('Per paragraf', !!a.byPara, v => setA({ byPara: v }))) : null));
    det.querySelector('summary').addEventListener('click', ev => { if (ev.target.closest('button')) return; E.select([a.el]); });
    return det;
  });
  return [
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, add,
      h('button', { class: 'btn btn-ghost', disabled: !s.anims.length || null, onclick: () => preview(s.anims) }, icon('play_arrow'), 'Putar')),
    !list.length ? h('div', { class: 'muted small fhint' }, 'Pilih objek di slide untuk menambahkan animasi masuk, penekanan, atau keluar.') : null,
    s.anims.length ? h('div', { class: 'anim-list' }, items) : h('div', { class: 'ol-empty' }, 'Belum ada animasi di slide ini'),
    h('div', { class: 'muted small fhint' }, 'Nomor = urutan klik saat presentasi. "Bersama/Setelah sebelumnya" berjalan otomatis.'),
  ];
}
let prevStop = null;
function stopPreview() { prevStop?.(); prevStop = null; }
async function preview(list) {
  stopPreview();
  const { playAnims } = await import('./present.js');
  E.deselect();
  prevStop = playAnims(E.slideNode, list, { preview: true });
}

// ---------- transitions ----------
export const TRANS = [['none', 'Tidak ada', 'block'], ['fade', 'Pudar', 'gradient'], ['dissolve', 'Larut', 'blur_on'], ['push', 'Dorong', 'arrow_forward'], ['wipe', 'Sapu', 'swipe_right'], ['cover', 'Tutup', 'flip_to_front'], ['uncover', 'Buka', 'flip_to_back'], ['split', 'Belah', 'vertical_split'], ['zoom', 'Zoom', 'zoom_in'], ['flip', 'Balik', 'flip'], ['cube', 'Kubus', 'view_in_ar'], ['morph', 'Morph', 'auto_fix_high']];
function transPanel() {
  const s = slide();
  const t = s.trans || { type: 'none' };
  const set = p => { s.trans = { type: 'none', dur: .7, dir: 'left', ...(s.trans || {}), ...p }; E.commit('Transisi', 'cur'); };
  return [
    h('div', { class: 'muted small fhint' }, `Transisi masuk ke slide ${E.cur + 1}`),
    h('div', { class: 'tr-grid' }, TRANS.map(([k, n, ic]) => h('button', { class: 'tr' + ((t.type || 'none') === k ? ' on' : ''), onclick: () => { set({ type: k }); if (k !== 'none') previewTrans(); } }, icon(ic), h('span', null, n)))),
    t.type && t.type !== 'none' ? [
      ['push', 'wipe', 'cover', 'uncover', 'cube'].includes(t.type) ? row('Arah', select([['left', 'Dari kanan'], ['right', 'Dari kiri'], ['up', 'Dari bawah'], ['down', 'Dari atas']], t.dir || 'left', v => set({ dir: v }))) : null,
      row('Durasi', slider(t.dur ?? .7, .2, 3, .1, (v, done) => { if (done) set({ dur: v }); }, v => v.toFixed(1).replace('.', ',') + ' dtk')),
      t.type === 'morph' ? h('div', { class: 'muted small fhint' }, 'Morph menggerakkan objek yang sama (hasil duplikat slide) dari posisi slide sebelumnya ke posisi baru secara halus.') : null,
    ] : null,
    sec('auto', 'Maju otomatis',
      row('', check('Setelah', s.trans?.auto != null, v => set({ auto: v ? 5 : null }))),
      s.trans?.auto != null ? row('Detik', num(s.trans.auto, v => set({ auto: Math.max(0, v) }), { unit: 'dtk', step: .5 })) : null),
    h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', marginTop: '10px' } },
      h('button', { class: 'btn btn-ghost', onclick: previewTrans }, icon('play_arrow'), 'Putar'),
      h('button', { class: 'btn btn-tonal', onclick: () => { for (const x of E.doc.slides) x.trans = JSON.parse(JSON.stringify(s.trans || { type: 'none' })); E.commit('Transisi semua slide', 'all'); toast('Transisi diterapkan ke semua slide'); } }, icon('select_all'), 'Terapkan ke semua')),
  ];
}
async function previewTrans() {
  const { previewTransition } = await import('./present.js');
  previewTransition(E.cur);
}

// ---------- theme ----------
function themePanel() {
  const d = E.doc;
  const sample = d.slides.find(s => s.layout === 'title') || d.slides[0];
  const grid = h('div', { class: 'th-grid' }, THEMES.map(t => {
    const fake = { ...d, theme: cloneTheme(t) };
    return h('button', { class: 'th' + (d.theme.id === t.id ? ' on' : ''), onclick: () => O.applyTheme(t) }, thumb(fake, sample, 120, { fit: false }), h('span', null, t.name));
  }));
  const th = d.theme;
  const setC = (k, v) => { th.c[k] = v; th.id = 'custom'; th.name = 'Kustom'; E.commit('Warna tema', 'all'); };
  const colors = h('div', { class: 'tok-grid' }, TOKENS.map(k => {
    const i = h('input', { type: 'color', value: toHex(th.c[k]) || '#000000' });
    i.addEventListener('change', () => setC(k, i.value));
    return h('label', { class: 'tok' }, i, h('span', null, TOKEN_NAMES[k]));
  }));
  const fonts = [['head', 'Font judul'], ['body', 'Font isi']].map(([k, l]) => row(l, select(FONTS.map(f => f.n), th.f[k], v => { th.f[k] = v; E.commit('Font tema', 'all'); })));
  return [
    h('div', { class: 'muted small fhint' }, 'Tema mengubah warna, font, dan hiasan semua slide.'),
    grid,
    sec('tcol', 'Sesuaikan warna tema', colors),
    sec('tfont', 'Font tema', fonts),
    sec('tbg', 'Gambar latar tema', row('', h('button', { class: 'btn btn-ghost', onclick: async () => { const [f] = await pickFile('image/*'); if (!f) return; th.bgImg = O.addAsset(await readFile(f)); E.commit('Latar tema', 'all'); } }, icon('image'), 'Pilih gambar…'), th.bgImg ? h('button', { class: 'btn btn-ghost', onclick: () => { th.bgImg = null; E.commit('Latar tema', 'all'); } }, 'Hapus') : null),
      row('Hiasan', select([['', 'Tidak ada'], ...[...new Set(THEMES.map(t => t.deco).filter(Boolean))].map(x => [x, x])], th.deco || '', v => { th.deco = v || null; E.commit('Hiasan tema', 'all'); }))),
    sec('tmaster', 'Master', row('', h('button', { class: 'btn btn-tonal', onclick: () => E.toggleMaster() }, icon('dashboard_customize'), E.editMaster ? 'Selesai mengedit master' : 'Edit master')),
      h('div', { class: 'muted small' }, 'Logo atau teks di master tampil di semua slide (bisa disembunyikan per slide).')),
  ];
}

// ---------- comments ----------
function commentsPanel() {
  const d = E.doc;
  const sid = slide().id;
  let showAll = Prefs.cmtAll ?? false, showDone = false;
  const target = one();
  const ta = h('textarea', { class: 'tx', rows: 3, placeholder: target ? `Komentar pada "${objName(target)}"` : `Komentar pada slide ${E.cur + 1}`, autofocus: arg === 'new' || null });
  const addBtn = h('button', { class: 'btn btn-primary', onclick: () => {
    const t = ta.value.trim();
    if (!t) return;
    d.comments.push({ id: uid(8), slide: sid, el: target?.id || null, author: me(), text: t, time: Date.now(), replies: [], done: false });
    E.commit('Komentar', false);
  } }, 'Komentar');
  const form = h('div', { class: 'cc-form glass' }, h('div', { class: 'cc-who' }, avatar(me(), 'sm'), h('b', null, me())), ta, h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, addBtn));
  const list = d.comments.filter(c => (showAll || c.slide === sid) && (showDone || !c.done));
  const card = c => {
    const si = d.slides.findIndex(s => s.id === c.slide);
    const rep = h('input', { class: 'tx', placeholder: 'Balas…' });
    rep.addEventListener('keydown', e => { if (e.key === 'Enter' && rep.value.trim()) { c.replies.push({ author: me(), text: rep.value.trim(), time: Date.now() }); E.commit('Balas komentar', false); } });
    return h('div', { class: 'cc on' + (c.done ? ' done' : '') + (arg === c.id ? ' hl' : '') },
      h('div', { class: 'cc-h' }, avatar(c.author, 'sm'), h('div', { class: 'cc-who' }, h('b', null, c.author), h('span', { title: fmtFull(c.time) }, fmtWhen(c.time) + (showAll ? ` · slide ${si + 1}` : ''))),
        h('button', { class: 'ib sm', 'data-tip': c.done ? 'Buka kembali' : 'Selesaikan', onclick: () => { c.done = !c.done; E.commit('Komentar', false); } }, icon(c.done ? 'undo' : 'check')),
        h('button', { class: 'ib sm', 'data-tip': 'Hapus', onclick: async () => { if (await confirmDlg('Hapus komentar?', 'Komentar dan balasannya akan dihapus.', 'Hapus', true)) { d.comments.splice(d.comments.indexOf(c), 1); E.commit('Hapus komentar', false); } } }, icon('delete'))),
      h('div', { class: 'cc-txt', onclick: () => { if (si >= 0 && si !== E.cur) E.goSlide(si); if (c.el && elById(c.el)) E.select([c.el]); } }, c.el ? h('div', { class: 'cc-q' }, objName(d.slides[si]?.els.find(x => x.id === c.el) || { type: 'x' })) : null, c.text),
      c.replies.map(r => h('div', { class: 'cc-rep' }, h('div', { class: 'cc-who' }, h('b', null, r.author), h('span', null, fmtWhen(r.time))), h('div', null, r.text))),
      c.done ? null : rep);
  };
  return [
    E.lockView ? null : form,
    h('div', { class: 'row', style: { gap: '10px', margin: '6px 0', flexWrap: 'wrap' } },
      check('Semua slide', showAll, v => { Prefs.cmtAll = v; savePrefs(); render(); }),
      h('span', { class: 'muted small' }, `${d.comments.filter(c => !c.done).length} terbuka`)),
    list.length ? list.map(card) : h('div', { class: 'ol-empty' }, 'Belum ada komentar'),
  ];
}

// ---------- selection pane ----------
function selectPane() {
  const list = [...els()].reverse();
  const it = e => {
    const name = h('span', { class: 'sp-n' }, objName(e));
    name.ondblclick = () => { name.contentEditable = 'true'; name.focus(); document.execCommand('selectAll'); };
    name.onblur = () => { if (name.isContentEditable) { name.contentEditable = 'false'; const v = name.textContent.trim(); e.name = v || undefined; E.commit('Nama objek'); } };
    name.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); name.blur(); } };
    return h('div', { class: 'sp-it' + (E.sel.has(e.id) ? ' on' : '') + (e.hidden ? ' off' : ''), onclick: ev => { if (ev.target.closest('button') || name.isContentEditable) return; E.select([e.id], ev.shiftKey || ev.metaKey); } },
      icon({ text: 'text_fields', shape: 'category', line: 'show_chart', image: 'image', table: 'table', chart: 'bar_chart', icon: 'emoji_symbols', video: 'smart_display' }[e.type] || 'square', 'sm'), name,
      e.group ? icon('group_work', 'xs muted') : null,
      h('button', { class: 'ib sm', 'data-tip': e.hidden ? 'Tampilkan' : 'Sembunyikan', onclick: () => { e.hidden = !e.hidden; E.commit('Visibilitas'); } }, icon(e.hidden ? 'visibility_off' : 'visibility')),
      h('button', { class: 'ib sm', 'data-tip': e.locked ? 'Buka kunci' : 'Kunci', onclick: () => { e.locked = !e.locked; E.commit('Kunci'); } }, icon(e.locked ? 'lock' : 'lock_open')));
  };
  return [
    h('div', { class: 'row', style: { gap: '6px', marginBottom: '8px', flexWrap: 'wrap' } },
      h('button', { class: 'btn btn-ghost sm', onclick: () => { els().forEach(e => { e.hidden = false; }); E.commit('Tampilkan semua'); } }, 'Tampilkan semua'),
      h('button', { class: 'btn btn-ghost sm', onclick: () => { els().forEach(e => { e.hidden = true; }); E.commit('Sembunyikan semua'); } }, 'Sembunyikan semua'),
      h('button', { class: 'ib sm', 'data-tip': 'Bawa maju', onclick: () => E.run('z-forward') }, icon('arrow_upward')), h('button', { class: 'ib sm', 'data-tip': 'Kirim mundur', onclick: () => E.run('z-backward') }, icon('arrow_downward'))),
    list.length ? h('div', { class: 'sp-list' }, list.map(it)) : h('div', { class: 'ol-empty' }, 'Slide ini kosong'),
    h('div', { class: 'muted small fhint' }, 'Paling atas = paling depan. Klik dua kali nama untuk mengganti.'),
  ];
}

// ---------- versions ----------
async function versionsPanel() {
  const d = E.doc;
  const list = await Store.versions.list(d.id);
  const { addVersion } = await import('./editor.js');
  return [
    h('div', { class: 'row', style: { gap: '8px', marginBottom: '10px' } }, h('button', { class: 'btn btn-tonal', onclick: async () => { await addVersion(); render(); toast('Versi disimpan'); } }, icon('bookmark_add'), 'Simpan versi sekarang')),
    list.length ? h('div', { class: 'vlist' }, list.map(v => h('div', { class: 'v' },
      h('div', null, h('b', null, v.name || fmtFull(v.time)), h('small', null, (v.name ? fmtFull(v.time) + ' · ' : '') + `${v.data.slides?.length || 0} slide`)),
      h('button', { class: 'ib sm', 'data-tip': 'Pulihkan versi ini', onclick: async () => {
        if (!(await confirmDlg('Pulihkan versi?', 'Presentasi akan kembali ke versi ini. Versi saat ini disimpan dulu di histori.', 'Pulihkan'))) return;
        await addVersion('Sebelum pemulihan ' + new Date().toLocaleTimeString('id-ID'));
        for (const k of CONTENT_KEYS) if (k !== 'assets' && v.data[k] !== undefined) d[k] = JSON.parse(JSON.stringify(v.data[k]));
        normalize(d);
        E.cur = 0; E.sel = new Set();
        E.commit('Pulihkan versi', 'all');
        toast('Versi dipulihkan');
      } }, icon('restore')),
      h('button', { class: 'ib sm', 'data-tip': 'Hapus', onclick: async () => { await Store.versions.del(v.vid); render(); } }, icon('delete'))))) : h('div', { class: 'ol-empty' }, 'Belum ada versi. Versi otomatis tersimpan tiap 10 menit saat Anda mengedit.'),
  ];
}

// ---------- design ideas (Designer) ----------
function designPanel() {
  const s = slide();
  const ideas = designIdeas(s);
  return [
    h('div', { class: 'muted small fhint' }, 'Tata letak alternatif untuk isi slide ini. Klik untuk menerapkan — bisa diurungkan.'),
    h('div', { class: 'dz-grid' }, ideas.map(idea => h('button', { class: 'dz', onclick: () => { s.els = idea.slide.els; s.bg = idea.slide.bg; s.layout = idea.slide.layout; E.sel = new Set(); E.commit('Ide desain'); } }, thumb(E.doc, idea.slide, 248), h('span', null, idea.name)))),
  ];
}
export function designIdeas(s) {
  const d = E.doc, f = frame(d), W = d.page.w, H = d.page.h;
  const T = s.els.find(e => e.ph === 'title') || s.els.find(e => e.type === 'text' && e.html);
  const body = s.els.filter(e => e !== T && (e.type === 'text') && e.html);
  const imgs = s.els.filter(e => e.type === 'image' && e.src);
  const rest = s.els.filter(e => e !== T && !body.includes(e) && !imgs.includes(e) && !(e.ph && !e.html && !(e.type === 'image' && e.src)));
  const cp = o => JSON.parse(JSON.stringify(o));
  const white = e => { e.def = { ...(e.def || {}), color: '#ffffff' }; e.html = (e.html || '').replace(/color:[^;"]*;?/g, ''); };
  const make = (name, fn) => {
    const n = { ...cp(s), els: [] };
    const t = T ? cp(T) : null, b = body.map(cp), im = imgs.map(cp), r = rest.map(cp);
    fn(n, t, b, im, r);
    n.els = [...n.els, ...r, ...im.filter(x => !n.els.includes(x)), t, ...b].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
    return { name, slide: n };
  };
  const stackText = (t, b, x, y, w, hgt, o = {}) => {
    if (t) Object.assign(t, { x, y, w, h: Math.min(hgt * .32, 140), rot: 0 }), t.box = { ...(t.box || {}), va: 'bottom', fit: 'shrink' }, t.def = { ...(t.def || {}), align: o.align || null, size: o.ts || t.def?.size || 32 };
    const by = t ? y + Math.min(hgt * .32, 140) + 12 : y;
    const bh = (y + hgt - by) / Math.max(1, b.length);
    b.forEach((e, i) => { Object.assign(e, { x, y: by + i * bh, w, h: bh - 8, rot: 0 }); e.box = { ...(e.box || {}), fit: 'shrink' }; if (o.align) e.def = { ...(e.def || {}), align: o.align }; });
  };
  const out = [];
  if (imgs.length) {
    const [img] = imgs;
    out.push(make('Gambar kanan', (n, t, b, im) => { Object.assign(im[0], { x: W / 2, y: 0, w: W / 2, h: H, rot: 0, mask: null, radius: 0 }); im.slice(1).forEach(x => { x.hidden = false; }); stackText(t, b, f.l, f.t + f.H * .08, W / 2 - f.l - 30, f.H * .84); }));
    out.push(make('Gambar kiri', (n, t, b, im) => { Object.assign(im[0], { x: 0, y: 0, w: W * .45, h: H, rot: 0, radius: 0 }); stackText(t, b, W * .45 + 36, f.t + f.H * .08, f.r - W * .45 - 36, f.H * .84); }));
    out.push(make('Gambar latar', (n, t, b, im) => {
      Object.assign(im[0], { x: 0, y: 0, w: W, h: H, rot: 0, radius: 0 });
      n.els.push(im[0], shapeEl('rect', { x: 0, y: 0, w: W, h: H, fill: '#000000', fillOp: .45, html: '', name: 'Lapisan gelap' }));
      if (t) white(t); b.forEach(white);
      stackText(t, b, f.l + f.W * .1, f.t + f.H * .2, f.W * .8, f.H * .6, { align: 'center', ts: 40 });
    }));
    out.push(make('Pita gambar atas', (n, t, b, im) => { Object.assign(im[0], { x: 0, y: 0, w: W, h: H * .45, rot: 0, radius: 0 }); stackText(t, b, f.l, H * .45 + 14, f.W, f.b - H * .45 - 14); }));
    out.push(make('Bingkai bulat', (n, t, b, im) => { const sz = Math.min(f.H * .8, W * .38); Object.assign(im[0], { x: f.r - sz, y: f.t + (f.H - sz) / 2, w: sz, h: sz, rot: 0, mask: 'ellipse' }); stackText(t, b, f.l, f.t + f.H * .1, f.r - sz - f.l - 40, f.H * .8); }));
    if (imgs.length > 1) out.push(make('Galeri', (n, t, b, im) => {
      const m = im.length, cols = Math.min(3, m), rows = Math.ceil(m / cols), top = t ? f.t + 80 : f.t;
      const cw = (f.W - 16 * (cols - 1)) / cols, ch = (f.b - top - 16 * (rows - 1)) / rows;
      im.forEach((x, i) => Object.assign(x, { x: f.l + (i % cols) * (cw + 16), y: top + Math.floor(i / cols) * (ch + 16), w: cw, h: ch, rot: 0, radius: 10, mask: null }));
      if (t) Object.assign(t, { x: f.l, y: f.t, w: f.W, h: 64 });
      b.forEach(x => { x.hidden = true; });
    }));
    void img;
  }
  out.push(make('Bilah aksen', (n, t, b) => { n.els.push(shapeEl('rect', { x: f.l, y: f.t + f.H * .1, w: 10, h: f.H * .8, fill: '@a1', name: 'Bilah aksen' })); stackText(t, b, f.l + 34, f.t + f.H * .1, f.W - 34, f.H * .8); }));
  out.push(make('Panel warna', (n, t, b) => {
    n.els.push(shapeEl('rect', { x: 0, y: 0, w: W * .4, h: H, fill: '@a1', name: 'Panel' }));
    if (t) { Object.assign(t, { x: f.l, y: f.t, w: W * .4 - f.l - 24, h: f.H, rot: 0 }); t.box = { ...(t.box || {}), va: 'middle', fit: 'shrink' }; white(t); }
    b.forEach((e, i) => Object.assign(e, { x: W * .4 + 36, y: f.t + i * f.H / b.length, w: f.r - W * .4 - 36, h: f.H / b.length - 8, rot: 0 }));
  }));
  out.push(make('Kartu', (n, t, b) => {
    n.bg = { t: 'color', c: '@bg2' };
    n.els.push(shapeEl('round', { x: f.l + f.W * .06, y: f.t + f.H * .06, w: f.W * .88, h: f.H * .88, fill: '@bg', adj: { r: .06 }, shadow: { x: 0, y: 8, b: 24, c: 'rgba(0,0,0,.15)' }, name: 'Kartu' }));
    stackText(t, b, f.l + f.W * .12, f.t + f.H * .14, f.W * .76, f.H * .72);
  }));
  out.push(make('Tengah besar', (n, t, b) => { stackText(t, b, f.l + f.W * .08, f.t + f.H * .16, f.W * .84, f.H * .7, { align: 'center', ts: 44 }); n.els.push(shapeEl('rect', { x: W / 2 - 40, y: f.t + f.H * .16 + Math.min(f.H * .7 * .32, 140) + 2, w: 80, h: 4, fill: '@a1', name: 'Garis' })); }));
  out.push(make('Gradien berani', (n, t, b) => { n.bg = { t: 'grad', c1: '@a1', c2: '@a2', ang: 135 }; if (t) white(t); b.forEach(white); stackText(t, b, f.l, f.t + f.H * .15, f.W * .8, f.H * .7); }));
  return out;
}
export { render as refresh };
