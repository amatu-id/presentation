// Editor chrome: title bar, menu bar, contextual toolbar, filmstrip, slide sorter, notes, status bar.
import { E, Prefs, savePrefs, me, slide, selEls, one, els } from './state.js';
import { h, icon, toast, openMenu, toggleMenu, closeMenus, menuAnchor, avatar, toHex, ask, confirmDlg, rafOnce } from './ui.js';
import { CMD, run, MENUS, fontItems, SIZES_PT, spacingItems, bulletStyles, numberStyles, zoomItems, layoutItems, shapeItems, lineItems, colorMenu, weightItems, dashItems, headItems, maskItems, tableItems, chartItems, LAYOUT_IC } from './commands.js';
import * as O from './ops.js';
import { buildStage, setZoom, drawOverlay, cleanHtml, Hist } from './editor.js';
import { thumb } from './render.js';
import { htmlText, layoutName, cloneSlide } from './model.js';

const noFocus = el => { el.addEventListener('mousedown', e => { if (e.target.tagName !== 'INPUT') e.preventDefault(); }); return el; };
function B(id, ic, cls) {
  const c = CMD[id];
  const lb = typeof c.label === 'function' ? c.label() : c.label;
  const b = noFocus(h('button', { class: 'ib' + (cls ? ' ' + cls : ''), 'data-tip': lb, 'data-kbd': c.kbd || c.kbdShow || null, 'aria-label': lb, dataset: { cmd: id } }, icon(ic || c.icon)));
  b.onclick = () => run(id);
  return b;
}
function drop(cls, tip, items, o) {
  const b = noFocus(h('button', { class: 'tb-drop ' + cls, 'data-tip': tip, 'aria-haspopup': 'true' }, h('span', { class: 'l' }), icon('arrow_drop_down')));
  b.onclick = () => toggleMenu(b, items, o);
  return b;
}
function iconDrop(ic, tip, items, o) {
  const b = noFocus(h('button', { class: 'ib drop', 'data-tip': tip, 'aria-label': tip }, icon(ic), h('span', { class: 'ms mini' }, 'arrow_drop_down')));
  b.onclick = () => toggleMenu(b, items, o);
  return b;
}
function split(id, items, tip) {
  const a = noFocus(h('button', { class: 'ib arr', 'data-tip': tip, 'aria-label': tip }, icon('arrow_drop_down')));
  a.onclick = () => toggleMenu(a, items);
  return h('div', { class: 'split' }, B(id), a);
}
const sep = () => h('div', { class: 'tb-sep' });
// Colour button with a bar showing the current colour.
function colorBtn(ic, tip, get, pick, reset) {
  const bar = h('span', { class: 'bar' });
  const b = noFocus(h('button', { class: 'ib cbtn', 'data-tip': tip, 'aria-label': tip }, icon(ic), bar));
  b.onclick = () => toggleMenu(b, () => colorMenu(get(), pick, reset), { cls: 'pop' });
  b._bar = bar; b._get = get;
  return b;
}
const resolve = c => (typeof c === 'string' && c[0] === '@' ? E.doc.theme.c[c.slice(1)] : c);

export function buildEditorChrome() {
  const ui = E.ui = {};
  const root = h('div', { class: 'ed sl-ed' });
  E.root = root;

  // ----- title row -----
  ui.title = h('input', { class: 'ed-title', spellcheck: 'false', 'aria-label': 'Nama presentasi', maxlength: 200, value: E.doc.title });
  ui.title.addEventListener('change', () => { const t = ui.title.value.trim() || 'Presentasi tanpa judul'; ui.title.value = t; if (E.lockView) { ui.title.value = E.doc.title; return; } E.doc.title = t; document.title = t + ' - Amatu Slides'; E.dirty = true; E.save(); E.live?.changed(); });
  ui.title.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') { if (e.key === 'Escape') ui.title.value = E.doc.title; ui.title.blur(); E.scroll.focus(); } });
  ui.star = noFocus(h('button', { class: 'ib sm', 'data-tip': 'Beri bintang', 'aria-label': 'Beri bintang', onclick: () => { E.doc.starred = !E.doc.starred; E.save(); updateTitle(); } }, icon('star')));
  ui.lockB = noFocus(h('button', { class: 'ib sm', hidden: true, 'data-tip': 'Dikunci dengan kata sandi', 'aria-label': 'Kunci presentasi' }, icon('lock', 'fill')));
  ui.lockB.onclick = () => toggleMenu(ui.lockB, () => ['lock-now', 'lock-set', 'lock-off'].map(id => ({ label: typeof CMD[id].label === 'function' ? CMD[id].label() : CMD[id].label, icon: CMD[id].icon, enabled: CMD[id].enabled, run: () => run(id) })));
  ui.saved = h('span', { class: 'ed-saved', 'data-tip': 'Semua perubahan tersimpan di perangkat ini' }, icon('cloud_done'), h('span', { class: 't' }, 'Tersimpan'));
  ui.menubar = h('nav', { class: 'menubar', role: 'menubar' }, MENUS.map(m => {
    const b = h('button', { role: 'menuitem', 'aria-haspopup': 'true' }, m.label);
    b.addEventListener('mousedown', e => e.preventDefault());
    b.onclick = () => toggleMenu(b, m.items);
    b.addEventListener('mouseenter', () => { const a = menuAnchor(); if (a && a !== b && a.parentElement === ui.menubar) openMenu(b, m.items); });
    return b;
  }));
  const showMain = h('button', { class: 'btn btn-tonal show-btn', onclick: () => run('present-cur') }, icon('slideshow'), h('span', { class: 't' }, 'Tayangan slide'));
  const showArr = noFocus(h('button', { class: 'btn btn-tonal show-arr', 'aria-label': 'Opsi tayangan slide' }, icon('arrow_drop_down')));
  showArr.onclick = () => toggleMenu(showArr, () => ['present', 'present-cur', 'presenter', 'rehearse', 'show-settings'].map(id => ({ label: CMD[id].label, icon: CMD[id].icon, kbd: CMD[id].kbd, run: () => run(id) })), { align: 'right' });
  ui.av = h('button', { class: 'ib round hide-sm', style: { width: '42px', height: '42px' }, 'data-tip': me(), onclick: () => run('prefs') }, avatar(me()));
  const actions = h('div', { class: 'ed-act' },
    noFocus(h('button', { class: 'ib hide-sm', 'data-tip': 'Histori versi', onclick: () => run('versions') }, icon('history'))),
    noFocus(h('button', { class: 'ib', 'data-tip': 'Komentar', onclick: () => import('./panels.js').then(m => m.openPanel('comments')) }, icon('comment'))),
    h('div', { class: 'split show-split' }, showMain, showArr),
    h('button', { class: 'btn btn-primary share', onclick: () => run('share') }, icon('lock_open'), h('span', { class: 't' }, 'Bagikan')),
    ui.av);

  // ----- toolbar -----
  ui.search = noFocus(h('button', { class: 'tb-search', 'data-tip': 'Telusuri menu', 'data-kbd': 'Alt+/', onclick: () => run('menusearch') }, icon('search'), h('span', { class: 'hide-sm' }, 'Menu')));
  const newSlide = split('newslide', () => layoutItems(false), 'Slide baru dengan tata letak');
  ui.zoom = drop('tb-zoom', 'Zoom', zoomItems);
  const selTool = noFocus(h('button', { class: 'ib', 'data-tip': 'Pilih', 'aria-label': 'Pilih', onclick: () => E.setTool(null) }, icon('arrow_selector_tool')));
  ui.selTool = selTool;
  const imgDrop = iconDrop('image', 'Sisipkan gambar', () => ['img', 'img-url', 'img-camera'].map(id => ({ label: CMD[id].label, icon: CMD[id].icon, run: () => run(id) })));
  const shpDrop = iconDrop('category', 'Bentuk', shapeItems, { cls: 'pop' });
  const lineDrop = iconDrop('show_chart', 'Garis', lineItems);
  const tblDrop = iconDrop('table', 'Tabel', tableItems, { cls: 'pop' });
  const chartDrop = iconDrop('bar_chart', 'Bagan', chartItems);
  ui.textTool = B('textbox');

  // context: nothing selected
  const bgBtn = noFocus(h('button', { class: 'tb-txt', onclick: () => run('bg') }, 'Latar belakang'));
  ui.layoutDrop = noFocus(h('button', { class: 'tb-txt', 'aria-haspopup': 'true' }, 'Tata letak', icon('arrow_drop_down')));
  ui.layoutDrop.onclick = () => toggleMenu(ui.layoutDrop, () => layoutItems(true));
  const themeBtn = noFocus(h('button', { class: 'tb-txt', onclick: () => run('theme') }, 'Tema'));
  const transBtn = noFocus(h('button', { class: 'tb-txt', onclick: () => run('transition') }, 'Transisi'));

  // context: shapes / boxes
  ui.fill = colorBtn('format_color_fill', 'Warna isian', () => resolve(one()?.fill), c => O.setProp(e => { if (e.type !== 'line') e.fill = c ?? null; }, 'Warna isian'), 'Transparan');
  ui.stroke = colorBtn('border_color', 'Warna garis batas', () => resolve(one()?.stroke?.c), c => O.setProp(e => { if (c == null) delete e.stroke; else e.stroke = { w: 2, dash: 'solid', ...(e.stroke || {}), c }; }, 'Warna garis'), 'Transparan');
  const weight = iconDrop('line_weight', 'Ketebalan garis', () => weightItems(w => O.setProp(e => { e.stroke = { c: '@tx', dash: 'solid', ...(e.stroke || {}), w }; }, 'Ketebalan garis')));
  const dash = iconDrop('line_style', 'Tanda hubung garis', () => dashItems(d => O.setProp(e => { e.stroke = { c: '@tx', w: 2, ...(e.stroke || {}), dash: d }; }, 'Gaya garis')));
  const headS = iconDrop('line_start', 'Awal garis', () => headItems('tail'));
  const headE = iconDrop('line_end', 'Akhir garis', () => headItems('head'));
  const imgRep = noFocus(h('button', { class: 'tb-txt', onclick: () => run('img-replace') }, 'Ganti gambar'));
  const mask = iconDrop('interests', 'Masker gambar', maskItems);
  ui.iconColor = colorBtn('palette', 'Warna ikon', () => resolve(one()?.color), c => O.setProp(e => { e.color = c || '@a1'; }, 'Warna ikon'));
  const chartEd = noFocus(h('button', { class: 'tb-txt', onclick: () => run('chart-edit') }, 'Edit data'));
  const vidOpt = noFocus(h('button', { class: 'tb-txt', onclick: () => run('video-edit') }, 'Opsi video'));
  const tblOps = iconDrop('table_rows', 'Baris & kolom', () => ['tbl-row-above', 'tbl-row-below', 'tbl-col-left', 'tbl-col-right', 'tbl-del-row', 'tbl-del-col', 'tbl-eq'].map(id => ({ label: CMD[id].label, icon: CMD[id].icon, run: () => run(id) })));

  // context: text
  ui.font = drop('tb-font', 'Font', fontItems, { width: 250 });
  ui.sizeIn = h('input', { 'aria-label': 'Ukuran font', inputmode: 'decimal' });
  let sizeRange = null;
  ui.sizeIn.addEventListener('mousedown', () => { const s = getSelection(); sizeRange = E.editing && s.rangeCount ? s.getRangeAt(0).cloneRange() : null; });
  const restore = () => { if (sizeRange && E.editing) { const n = E.slideNode.querySelector(`.el[data-id="${E.editing}"] .txi`); n?.focus({ preventScroll: true }); const s = getSelection(); s.removeAllRanges(); s.addRange(sizeRange); } };
  const applySize = v => { closeMenus(0); restore(); if (v > 0) O.fmt.size(v); };
  ui.sizeIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applySize(parseFloat(ui.sizeIn.value.replace(',', '.'))); } if (e.key === 'Escape') { closeMenus(0); restore(); } });
  ui.sizeIn.addEventListener('focus', () => { ui.sizeIn.select(); openMenu(ui.sizeIn, SIZES_PT.map(s => ({ label: String(s), run: () => applySize(s) })), { focus: false, width: 80 }); });
  const size = h('div', { class: 'tb-size' }, B('sizedown', 'remove'), ui.sizeIn, B('sizeup', 'add'));
  ui.tcol = colorBtn('format_color_text', 'Warna teks', () => O.currentColor(), c => O.fmt.color(c || '#000000'));
  ui.hcol = colorBtn('ink_highlighter', 'Warna sorotan', () => null, c => O.fmt.hilite(c || 'transparent'), 'Tidak ada');
  ui.align = noFocus(h('button', { class: 'ib', 'data-tip': 'Perataan', 'aria-label': 'Perataan' }, icon('format_align_left')));
  ui.align.onclick = () => toggleMenu(ui.align, () => [...['align-left', 'align-center', 'align-right', 'align-justify'].map(id => ({ label: CMD[id].label, icon: CMD[id].icon, kbd: CMD[id].kbd, checked: CMD[id].checked, run: () => run(id) })), { sep: true }, ...['va-top', 'va-middle', 'va-bottom'].map(id => ({ label: 'Vertikal: ' + CMD[id].label, icon: CMD[id].icon, checked: CMD[id].checked, run: () => run(id) }))]);
  const lh = iconDrop('format_line_spacing', 'Spasi baris & paragraf', spacingItems);

  const g = (ctx, ...kids) => h('div', { class: 'tb-g', dataset: { ctx } }, kids);
  ui.groups = [
    g('all', B('undo'), B('redo'), B('painter'), ui.zoom), sep(),
    g('all', selTool, ui.textTool, imgDrop, shpDrop, lineDrop, tblDrop, chartDrop, B('comment', 'add_comment')),
    h('div', { class: 'tb-sep', dataset: { ctx: 'none' } }), g('none', bgBtn, ui.layoutDrop, themeBtn, transBtn),
    h('div', { class: 'tb-sep', dataset: { ctx: 'fill' } }), g('fill', ui.fill, ui.stroke, weight, dash),
    h('div', { class: 'tb-sep', dataset: { ctx: 'line' } }), g('line', ui.strokeL = colorBtn('border_color', 'Warna garis', () => resolve(one()?.stroke?.c), c => O.setProp(e => { e.stroke = { w: 2, dash: 'solid', ...(e.stroke || {}), c: c || '@tx' }; }, 'Warna garis')), weight.cloneNode(true), dash.cloneNode(true), headS, headE),
    h('div', { class: 'tb-sep', dataset: { ctx: 'image' } }), g('image', imgRep, mask),
    h('div', { class: 'tb-sep', dataset: { ctx: 'icon' } }), g('icon', ui.iconColor, B('icon-replace')),
    h('div', { class: 'tb-sep', dataset: { ctx: 'chart' } }), g('chart', chartEd),
    h('div', { class: 'tb-sep', dataset: { ctx: 'video' } }), g('video', vidOpt),
    h('div', { class: 'tb-sep', dataset: { ctx: 'table' } }), g('table', tblOps),
    h('div', { class: 'tb-sep', dataset: { ctx: 'text' } }), g('text', ui.font), g('text', size),
    g('text', B('bold'), B('italic'), B('underline'), ui.tcol, ui.hcol), g('text', B('link')), g('text', ui.align, lh, split('bullets', bulletStyles, 'Gaya butir'), split('numbers', numberStyles, 'Gaya penomoran'), B('outdent'), B('indent'), B('clearfmt')),
  ];
  // the cloned weight/dash dropdowns lose their handlers
  const lineGroup = ui.groups.find(x => x.dataset?.ctx === 'line' && x.classList.contains('tb-g'));
  const [wc, dc] = [...lineGroup.children].slice(1, 3);
  wc.onclick = () => toggleMenu(wc, () => weightItems(w => O.setProp(e => { e.stroke = { c: '@tx', dash: 'solid', ...(e.stroke || {}), w }; }, 'Ketebalan garis')));
  dc.onclick = () => toggleMenu(dc, () => dashItems(d => O.setProp(e => { e.stroke = { c: '@tx', w: 2, ...(e.stroke || {}), dash: d }; }, 'Gaya garis')));
  noFocus(wc); noFocus(dc);

  ui.animBtn = noFocus(h('button', { class: 'tb-txt', onclick: () => run('anim') }, icon('motion_photos_on', 'sm'), h('span', { class: 'hide-sm' }, 'Animasi')));
  ui.fmtBtn = noFocus(h('button', { class: 'tb-txt', onclick: () => run('format') }, icon('tune', 'sm'), h('span', { class: 'hide-sm' }, 'Opsi format')));
  ui.compactBtn = noFocus(h('button', { class: 'ib', 'data-tip': 'Sembunyikan menu', 'data-kbd': 'Mod+Shift+F', onclick: () => E.toggleCompact() }, icon('keyboard_arrow_up')));
  ui.toolbar = h('div', { class: 'toolbar', role: 'toolbar', 'aria-label': 'Alat' }, ui.search, newSlide, sep(), h('div', { class: 'tb-scroll' }, ui.groups), h('div', { class: 'tb-right' }, ui.animBtn, ui.fmtBtn, ui.compactBtn));

  ui.top = h('header', { class: 'ed-top glass refract' },
    h('div', { class: 'ed-r1' },
      h('a', { class: 'ed-logo', href: '#/', 'data-tip': 'Beranda Slides', 'aria-label': 'Beranda Slides' }, h('img', { src: 'assets/icon.svg', alt: '' })),
      h('div', { class: 'ed-tw' }, h('div', { class: 'ed-trow' }, ui.title, ui.star, ui.lockB, ui.saved), ui.menubar),
      actions),
    ui.toolbar);

  // ----- filmstrip -----
  E.strip = h('div', { class: 'strip glass', tabindex: '0', 'aria-label': 'Slide' });
  E.strip.addEventListener('contextmenu', e => { const it = e.target.closest('.st-it'); if (it) { e.preventDefault(); const id = it.dataset.id; if (!E.stripSel.has(id)) { E.goSlide(+it.dataset.i); } stripMenu(e); } });
  const stripWrap = h('aside', { class: 'strip-wrap' }, E.strip, h('button', { class: 'strip-add btn btn-tonal', onclick: () => O.addSlide() }, icon('add'), 'Slide baru'));

  // ----- stage + notes -----
  const stage = buildStage();
  E.notes = h('textarea', { class: 'notes-ta', placeholder: 'Klik untuk menambahkan catatan pembicara', spellcheck: 'true' });
  E.notes.addEventListener('input', () => { if (E.lockView) return; slide().notes = E.notes.value; notesCommit(); });
  const notesCommit = (() => { let t; return () => { clearTimeout(t); t = setTimeout(() => E.commit('Catatan', false), 700); }; })();
  ui.notesBox = h('div', { class: 'notes glass' }, h('div', { class: 'notes-grip', onpointerdown: gripDown }), E.notes);
  ui.stageArea = h('main', { class: 'stage-area' }, stage, ui.notesBox);

  // ----- status bar -----
  ui.stSlide = h('span', { class: 'st' });
  ui.zLabel = h('button', { class: 'st', 'data-tip': 'Zoom' });
  ui.zLabel.onclick = () => toggleMenu(ui.zLabel, zoomItems, { side: 'above', align: 'right' });
  ui.vNorm = noFocus(h('button', { class: 'ib', 'data-tip': 'Normal', onclick: () => { if (E.view.sorter) E.toggleSorter(); } }, icon('view_sidebar')));
  ui.vSort = noFocus(h('button', { class: 'ib', 'data-tip': 'Tampilan petak', onclick: () => run('sorter') }, icon('grid_view')));
  ui.vNotes = noFocus(h('button', { class: 'ib', 'data-tip': 'Catatan pembicara', onclick: () => run('notes') }, icon('speaker_notes')));
  ui.status = h('footer', { class: 'status glass refract' }, ui.stSlide, h('div', { class: 'tb-sep' }), ui.vNorm, ui.vSort, ui.vNotes, h('div', { class: 'tb-sep' }),
    noFocus(h('button', { class: 'ib', 'aria-label': 'Perkecil', onclick: () => run('zoomout') }, icon('remove'))), ui.zLabel,
    noFocus(h('button', { class: 'ib', 'aria-label': 'Perbesar', onclick: () => run('zoomin') }, icon('add'))),
    noFocus(h('button', { class: 'ib', 'data-tip': 'Pas', onclick: () => run('zoomfit') }, icon('fit_screen'))),
    noFocus(h('button', { class: 'ib', 'data-tip': 'Tayangan slide', onclick: () => run('present-cur') }, icon('slideshow'))));

  E.side = h('div', { class: 'side-host' });
  root.append(stripWrap, ui.stageArea, E.side, ui.top, ui.status);
  updateTitle();
  E.layout();
  return root;
}

function gripDown(ev) {
  ev.preventDefault();
  const y0 = ev.clientY, h0 = E.ui.notesBox.offsetHeight;
  const mv = e => { const v = Math.max(60, Math.min(innerHeight * .5, h0 - (e.clientY - y0))); E.root.style.setProperty('--notes-h', v + 'px'); };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
}

function updateTitle() {
  const ui = E.ui, d = E.doc;
  if (!ui.star) return;
  ui.star.replaceChildren(icon('star', d.starred ? 'fill star-on' : ''));
  ui.lockB.hidden = !d.lock;
}
E.updateTitle = updateTitle;
E.layout = () => {
  const r = E.root;
  if (!r) return;
  r.classList.toggle('no-notes', !E.view.notes);
  r.classList.toggle('has-side', !!E.view.panel);
  r.classList.toggle('sorting', !!E.view.sorter);
  r.style.setProperty('--strip-w', Prefs.stripW + 'px');
  if (E.fit) requestAnimationFrame(() => setZoom('fit'));
};
E.toggleCompact = () => { E.ui.top.classList.toggle('compact'); E.root.classList.toggle('compact', E.ui.top.classList.contains('compact')); E.ui.compactBtn.firstChild.textContent = E.ui.top.classList.contains('compact') ? 'keyboard_arrow_down' : 'keyboard_arrow_up'; E.layout(); };
E.toggleMaster = () => { if (E.editing) E.endEdit(); E.editMaster = !E.editMaster; E.sel = new Set(); E.render(); E.updateToolbar(); toast(E.editMaster ? 'Mode edit master: objek di sini tampil di semua slide' : 'Selesai mengedit master'); };
E.setSaveState = s => {
  const el = E.ui.saved;
  if (!el) return;
  const live = E.live && s !== 'error' && E.liveState;
  if (live) { el.classList.toggle('saving', live[0] === 'sync'); el.replaceChildren(icon(live[0]), h('span', { class: 't' }, live[1])); el.dataset.tip = live[2] || live[1]; return; }
  el.classList.toggle('saving', s === 'saving');
  el.replaceChildren(icon(s === 'saving' ? 'sync' : s === 'error' ? 'cloud_off' : 'cloud_done'), h('span', { class: 't' }, s === 'saving' ? 'Menyimpan…' : s === 'error' ? 'Gagal menyimpan' : 'Tersimpan'));
};
E.clean = cleanHtml;
E.text = htmlText;
E.zoomTo = setZoom;
E.insertImageFile = f => O.insertImageFile(f);
E.followLink = link => { if (link.startsWith('#slide:')) { const i = E.doc.slides.findIndex(s => s.id === link.slice(7)); if (i >= 0) E.goSlide(i); } else window.open(link, '_blank', 'noopener'); };
E.linkDialog = (v, slides) => import('./dialogs.js').then(m => m.linkDialog(v, slides));

// ----- toolbar state -----
function ctxOf() {
  if (E.editing) { const e = one(); return new Set(['text', e?.type === 'shape' ? 'fill' : null, e?.type === 'table' ? 'table' : null].filter(Boolean)); }
  const list = selEls();
  if (!list.length) return new Set(['none']);
  const s = new Set();
  for (const e of list) {
    if (e.type === 'text' || e.type === 'shape') { s.add('text'); s.add('fill'); }
    if (e.type === 'table') { s.add('text'); s.add('table'); }
    if (e.type === 'line') s.add('line');
    if (e.type === 'image') { s.add('image'); s.add('fill'); }
    if (e.type === 'icon') s.add('icon');
    if (e.type === 'chart') s.add('chart');
    if (e.type === 'video') s.add('video');
  }
  if (list.length === 1 && list[0].type === 'image') s.delete('fill');
  return s;
}
E.updateToolbar = rafOnce(() => {
  const ui = E.ui;
  if (!ui.toolbar || !E.doc) return;
  const ctx = ctxOf();
  for (const el of ui.toolbar.querySelectorAll('[data-ctx]')) el.hidden = el.dataset.ctx !== 'all' && !ctx.has(el.dataset.ctx);
  for (const b of ui.toolbar.querySelectorAll('[data-cmd]')) {
    const c = CMD[b.dataset.cmd];
    b.classList.toggle('on', !!c.active?.());
    b.classList.toggle('dis', c.enabled ? !c.enabled() : false);
  }
  ui.selTool.classList.toggle('on', !E.insertTool);
  ui.textTool.classList.toggle('on', E.insertTool?.kind === 'text');
  ui.zoom.querySelector('.l').textContent = E.fit ? 'Pas' : Math.round(E.zoom * 100) + '%';
  if (ctx.has('text')) {
    ui.font.querySelector('.l').textContent = O.currentFont();
    if (document.activeElement !== ui.sizeIn) ui.sizeIn.value = String(O.currentSize() ?? '').replace('.', ',');
    ui.align.firstChild.textContent = 'format_align_' + (O.currentAlign() || 'left');
    ui.tcol._bar.style.color = toHex(O.currentColor()) || '#000';
  }
  const e = one();
  ui.fill._bar.style.color = e && e.fill && typeof e.fill === 'string' ? resolve(e.fill) : 'transparent';
  ui.stroke._bar.style.color = e?.stroke ? resolve(e.stroke.c) : 'transparent';
  ui.strokeL._bar.style.color = e?.stroke ? resolve(e.stroke.c) : '#000';
  ui.iconColor._bar.style.color = e?.color ? resolve(e.color) : 'transparent';
  ui.animBtn.classList.toggle('on', E.view.panel === 'anim');
  ui.fmtBtn.classList.toggle('on', E.view.panel === 'format');
  E.ui.saved && E.root.classList.toggle('view-only', !!E.lockView);
});
E.updateStatus = rafOnce(() => {
  const ui = E.ui;
  if (!ui.stSlide || !E.doc) return;
  ui.stSlide.textContent = `Slide ${E.cur + 1} dari ${E.doc.slides.length}` + (E.editMaster ? ' · Master' : '');
  ui.zLabel.textContent = Math.round(E.zoom * 100) + '%';
  ui.vNotes.classList.toggle('on', E.view.notes);
  ui.vSort.classList.toggle('on', !!E.view.sorter);
  ui.vNorm.classList.toggle('on', !E.view.sorter);
});
E.updateNotes = () => { if (E.notes && document.activeElement !== E.notes) E.notes.value = slide()?.notes || ''; E.notes.readOnly = !!E.lockView; E.notes.placeholder = E.lockView ? 'Tidak ada catatan pembicara' : 'Klik untuk menambahkan catatan pembicara'; };

// dimension tooltip while dragging
let dimEl = null;
E.showDim = (ev, text) => {
  dimEl ||= document.body.appendChild(h('div', { class: 'dimtip' }));
  dimEl.textContent = text;
  dimEl.style.left = ev.clientX + 14 + 'px';
  dimEl.style.top = ev.clientY + 16 + 'px';
};
E.hideDim = () => { dimEl?.remove(); dimEl = null; };

// ----- filmstrip -----
function stripW() { return Prefs.stripW - 52; }
let thumbs = [];
E.renderStrip = () => {
  const d = E.doc;
  if (!E.strip || !d) return;
  const w = stripW();
  const out = [];
  thumbs = [];
  d.slides.forEach((s, i) => {
    if (s.section) out.push(sectionRow(s, i));
    const t = thumb(d, s, w, { idx: i });
    const it = h('div', { class: 'st-it' + (s.skip ? ' skip' : ''), dataset: { id: s.id, i }, tabindex: '-1' },
      h('div', { class: 'st-n' }, String(i + 1), s.skip ? icon('visibility_off', 'xs') : null, s.anims?.length || (s.trans && s.trans.type !== 'none') ? icon('motion_photos_on', 'xs') : null),
      h('div', { class: 'st-t' }, t));
    it.addEventListener('pointerdown', ev => stripDown(ev, it));
    thumbs[i] = it;
    out.push(it);
  });
  E.strip.replaceChildren(...out);
  E.markStrip();
  if (E.view.sorter) renderSorter();
};
E.renderThumb = i => {
  const d = E.doc, it = thumbs[i], s = d?.slides[i];
  if (!it || !s || it.dataset.id !== s.id) return E.renderStrip();
  it.querySelector('.st-t').replaceChildren(thumb(d, s, stripW(), { idx: i }));
  it.querySelector('.st-n').replaceChildren(String(i + 1), s.skip ? icon('visibility_off', 'xs') : '', s.anims?.length || (s.trans && s.trans.type !== 'none') ? icon('motion_photos_on', 'xs') : '');
  if (E.view.sorter) renderSorter();
};
E.markStrip = () => {
  const d = E.doc;
  thumbs.forEach((it, i) => { it.classList.toggle('cur', i === E.cur); it.classList.toggle('sel', E.stripSel.has(d.slides[i]?.id)); });
  thumbs[E.cur]?.scrollIntoView({ block: 'nearest' });
  sorterEl?.querySelectorAll('.so-it').forEach((it, i) => { it.classList.toggle('cur', i === E.cur); it.classList.toggle('sel', E.stripSel.has(d.slides[i]?.id)); });
};
function sectionRow(s, i) {
  const r = h('div', { class: 'st-sec' }, icon('segment', 'xs'), h('span', null, s.section));
  r.onclick = () => toggleMenu(r, [
    { label: 'Ganti nama bagian', icon: 'edit', run: async () => { const n = await ask({ title: 'Ganti nama bagian', value: s.section, ok: 'Simpan' }); if (n?.trim()) { s.section = n.trim(); E.commit('Bagian', 'all'); } } },
    { label: 'Hapus bagian', icon: 'delete', run: () => { s.section = null; E.commit('Hapus bagian', 'all'); } },
    { label: 'Pilih semua slide di bagian', icon: 'select_all', run: () => { const d = E.doc; const ids = []; for (let j = i; j < d.slides.length && (j === i || !d.slides[j].section); j++) ids.push(d.slides[j].id); E.stripSel = new Set(ids); E.markStrip(); } },
  ]);
  return r;
}
E.addSection = async () => {
  const s = slide();
  const n = await ask({ title: 'Tambah bagian', label: 'Nama bagian (mulai di slide ini)', value: s.section || 'Bagian baru', ok: 'Tambah' });
  if (!n?.trim()) return;
  s.section = n.trim();
  E.commit('Bagian', 'all');
};
function stripDown(ev, it) {
  if (ev.button !== 0) return;
  const d = E.doc, i = +it.dataset.i, id = it.dataset.id;
  E.strip.focus({ preventScroll: true });
  if (ev.shiftKey) {
    const a = Math.min(E.cur, i), b = Math.max(E.cur, i);
    E.stripSel = new Set(d.slides.slice(a, b + 1).map(s => s.id));
    E.markStrip(); return;
  }
  if (ev.metaKey || ev.ctrlKey) {
    if (E.stripSel.has(id) && E.stripSel.size > 1) E.stripSel.delete(id); else E.stripSel.add(id);
    E.goSlide(i, false);
    E.stripSel.add(d.slides[i].id);
    E.markStrip(); return;
  }
  if (!E.stripSel.has(id)) E.stripSel = new Set([id]);
  E.goSlide(i);
  if (E.stripSel.size <= 1) E.stripSel = new Set([id]);
  startSlideDrag(ev, E.strip, '.st-it', 'y');
}
// Drag slides (filmstrip: vertical, sorter: grid) to reorder.
function startSlideDrag(ev, box, sel, axis) {
  if (E.lockView) return;
  const y0 = ev.clientY, x0 = ev.clientX;
  let on = false, mark = null, to = -1;
  const items = () => [...box.querySelectorAll(sel)];
  const mv = e => {
    if (!on && Math.hypot(e.clientX - x0, e.clientY - y0) < 6) return;
    on = true;
    box.classList.add('dragging');
    const list = items();
    to = list.length;
    for (const [j, it] of list.entries()) {
      const r = it.getBoundingClientRect();
      if (axis === 'y' ? e.clientY < r.top + r.height / 2 : (e.clientY < r.bottom && e.clientX < r.left + r.width / 2) || e.clientY < r.top) { to = j; break; }
    }
    mark ||= h('div', { class: 'drop-mark ' + axis });
    const ref = list[to] || list[list.length - 1];
    const r = ref.getBoundingClientRect(), br = box.getBoundingClientRect();
    if (axis === 'y') Object.assign(mark.style, { top: (to < list.length ? r.top : r.bottom) - br.top + box.scrollTop - 4 + 'px', left: '10px', right: '10px' });
    else Object.assign(mark.style, { left: (to < list.length ? r.left : r.right) - br.left + box.scrollLeft - 6 + 'px', top: r.top - br.top + box.scrollTop + 'px', height: r.height + 'px' });
    if (!mark.isConnected) box.append(mark);
    if (e.clientY < br.top + 30) box.scrollTop -= 10; else if (e.clientY > br.bottom - 30) box.scrollTop += 10;
  };
  const up = () => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
    mark?.remove(); box.classList.remove('dragging');
    if (!on || to < 0) return;
    const d = E.doc;
    const moving = d.slides.filter(s => E.stripSel.has(s.id));
    const before = d.slides.slice(0, to).filter(s => !E.stripSel.has(s.id)).length;
    const rest = d.slides.filter(s => !E.stripSel.has(s.id));
    rest.splice(before, 0, ...moving);
    if (rest.every((s, k) => s === d.slides[k])) return;
    d.slides = rest;
    E.cur = d.slides.indexOf(moving[0]);
    E.commit('Pindahkan slide', 'all');
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
}
function stripMenu(ev) {
  const C = id => ({ label: typeof CMD[id].label === 'function' ? CMD[id].label() : CMD[id].label, icon: CMD[id].icon, kbd: CMD[id].kbd, run: () => run(id) });
  openMenu({ x: ev.clientX, y: ev.clientY }, [
    C('newslide'), C('dupslide'), C('delslide'), C('skipslide'), { sep: true },
    { label: 'Salin slide', icon: 'content_copy', run: () => E.copySlides() }, { label: 'Tempel slide', icon: 'content_paste', enabled: () => !!E.slideClip, run: () => E.pasteSlides() }, { sep: true },
    { label: 'Ubah tata letak', icon: 'dashboard', sub: () => layoutItems(true) }, C('bg'), C('transition'), { sep: true },
    C('section'), C('slide-start'), C('slide-end'),
  ]);
}
E.copySlides = cut => {
  const d = E.doc;
  const list = d.slides.filter(s => E.stripSel.has(s.id));
  if (!list.length) return false;
  const s = JSON.stringify(list);
  E.slideClip = { slides: JSON.parse(s), assets: Object.fromEntries(Object.entries(d.assets).filter(([k]) => s.includes('a:' + k))), theme: d.theme };
  if (cut) O.deleteSlides(); else toast(list.length + ' slide disalin');
  return true;
};
E.pasteSlides = () => {
  const c = E.slideClip;
  if (!c) return;
  const d = E.doc;
  Object.assign(d.assets, c.assets);
  const fresh = c.slides.map(cloneSlide);
  d.slides.splice(E.cur + 1, 0, ...fresh);
  E.cur += 1;
  E.stripSel = new Set(fresh.map(s => s.id));
  E.commit('Tempel slide', 'all');
};

// ----- slide sorter (grid view) -----
let sorterEl = null;
E.toggleSorter = () => {
  if (E.editing) E.endEdit();
  E.view.sorter = !E.view.sorter;
  if (E.view.sorter) renderSorter(); else { sorterEl?.remove(); sorterEl = null; }
  E.layout(); E.updateStatus();
};
function renderSorter() {
  const d = E.doc;
  sorterEl ||= h('div', { class: 'sorter', tabindex: '0' });
  if (!sorterEl.isConnected) E.ui.stageArea.append(sorterEl);
  const W = Prefs.sorterW || 220;
  const size = h('input', { type: 'range', min: 140, max: 420, value: W, 'aria-label': 'Ukuran gambar mini', oninput: e => { Prefs.sorterW = +e.target.value; savePrefs(); renderSorter(); } });
  const grid = h('div', { class: 'so-grid' }, d.slides.map((s, i) => {
    const it = h('div', { class: 'so-it' + (s.skip ? ' skip' : ''), dataset: { id: s.id, i } }, thumb(d, s, W, { idx: i }), h('div', { class: 'so-n' }, String(i + 1), h('span', { class: 'muted' }, s.section ? ' · ' + s.section : '')));
    it.addEventListener('pointerdown', ev => {
      if (ev.button !== 0) return;
      if (ev.metaKey || ev.ctrlKey) { if (E.stripSel.has(s.id)) E.stripSel.delete(s.id); else E.stripSel.add(s.id); E.markStrip(); return; }
      if (ev.shiftKey) { const a = Math.min(E.cur, i), b = Math.max(E.cur, i); E.stripSel = new Set(d.slides.slice(a, b + 1).map(x => x.id)); E.markStrip(); return; }
      if (!E.stripSel.has(s.id)) E.stripSel = new Set([s.id]);
      E.cur = i; E.markStrip(); E.updateStatus();
      startSlideDrag(ev, grid, '.so-it', 'x');
    });
    it.addEventListener('dblclick', () => { E.toggleSorter(); E.goSlide(i); });
    it.addEventListener('contextmenu', e => { e.preventDefault(); if (!E.stripSel.has(s.id)) { E.stripSel = new Set([s.id]); E.cur = i; E.markStrip(); } stripMenu(e); });
    return it;
  }));
  sorterEl.replaceChildren(h('div', { class: 'so-bar' }, h('b', null, 'Penyortir slide'), h('span', { class: 'muted small' }, 'Seret untuk mengurutkan · klik dua kali untuk membuka'), h('div', { class: 'grow' }), icon('photo_size_select_small', 'sm'), size,
    h('button', { class: 'btn btn-tonal', onclick: () => E.toggleSorter() }, icon('close'), 'Tutup')), grid);
  E.markStrip();
}

// ----- element context menu -----
E.contextMenu = ev => {
  const list = selEls();
  const C = id => { const c = CMD[id]; return { label: typeof c.label === 'function' ? c.label() : c.label, icon: c.icon, kbd: c.kbd || c.kbdShow, enabled: c.enabled, run: () => run(id) }; };
  const items = list.length ? [
    C('cut'), C('copy'), C('paste'), C('duplicate'), C('delete'), { sep: true },
    C('comment'), C('link'), C('anim'), { sep: true },
    { label: 'Urutan', icon: 'layers', sub: () => ['z-front', 'z-forward', 'z-backward', 'z-back'].map(C) },
    { label: 'Ratakan', icon: 'align_horizontal_left', sub: () => ['al-left', 'al-center', 'al-right', 'al-top', 'al-middle', 'al-bottom', 'center-h', 'center-v'].map(C) },
    { label: 'Putar', icon: 'rotate_right', sub: () => ['rot-cw', 'rot-ccw', 'flip-h', 'flip-v'].map(C) },
    list.length > 1 ? C('group') : null, list.some(e => e.group) ? C('ungroup') : null, C('lockpos'), { sep: true },
    one()?.type === 'image' ? C('img-replace') : null, one()?.type === 'chart' ? C('chart-edit') : null,
    C('painter'), C('format'),
  ] : [C('paste'), { sep: true }, C('bg'), { label: 'Tata letak', icon: 'dashboard', sub: () => layoutItems(true) }, C('theme'), C('transition'), C('design'), { sep: true }, C('newslide'), C('selectall')];
  openMenu({ x: ev.clientX, y: ev.clientY }, items);
};
export { drawOverlay, Hist, LAYOUT_IC, layoutName, confirmDlg };
