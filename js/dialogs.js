// Dialogs: page setup & margins, links, charts, icons, video, diagrams, header/footer, find & replace, background,
// slideshow settings, camera, special characters, preferences, app theme, shortcuts, menu search.
import { E, Prefs, savePrefs, me, slide, one } from './state.js';
import { h, icon, toast, dialog, field, select, toggle, segmented, numInput, kbdLabel, closeMenus, pickFile, readFile } from './ui.js';
import { Theme, ACCENTS } from './theme.js';
import * as O from './ops.js';
import { SIZES, px2cm, cm2px, DEF_MARGIN, slideTitle } from './model.js';
import { chartSvg, CHART_TYPES, ytId, thumb } from './render.js';

// ---------- page setup: size + margins ----------
export function pageSetupDialog(preset) {
  const d = E.doc;
  let size = preset || d.page.size || '16:9';
  const wIn = numInput(+px2cm(d.page.w).toFixed(2), { step: .1, min: 5, max: 150 });
  const hIn = numInput(+px2cm(d.page.h).toFixed(2), { step: .1, min: 5, max: 150 });
  const sizeSel = select([...SIZES.map(s => [s[0], s[1]]), ['custom', 'Kustom']], size, v => { size = v; const s = SIZES.find(x => x[0] === v); if (s) { wIn.value = +px2cm(s[2]).toFixed(2); hIn.value = +px2cm(s[3]).toFixed(2); } draw(); });
  [wIn, hIn].forEach(i => i.addEventListener('input', () => { size = 'custom'; sizeSel.value = 'custom'; draw(); }));
  const m = { ...DEF_MARGIN, ...d.page.margin };
  const mIn = {};
  for (const k of ['t', 'b', 'l', 'r']) { mIn[k] = numInput(m[k], { step: .1, min: 0, max: 20 }); mIn[k].addEventListener('input', draw); }
  const presets = h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } },
    [['Normal', 1.27], ['Sempit', .64], ['Lebar', 2.54], ['Tanpa margin', 0]].map(([l, v]) => h('button', { class: 'btn btn-ghost sm', type: 'button', onclick: () => { for (const k in mIn) mIn[k].value = v; draw(); } }, l)));
  const reflow = toggle('Pindahkan placeholder (judul & isi) mengikuti margin baru', true);
  const prev = h('div', { class: 'pg-prev2' });
  function draw() {
    const W = cm2px(+wIn.value || 25.4), H = cm2px(+hIn.value || 14.29);
    const k = Math.min(240 / W, 150 / H);
    const mm = k / 2.54 * 96;
    prev.replaceChildren(h('div', { class: 'pp', style: { width: W * k + 'px', height: H * k + 'px' } },
      h('i', { style: { left: (+mIn.l.value || 0) * mm + 'px', right: (+mIn.r.value || 0) * mm + 'px', top: (+mIn.t.value || 0) * mm + 'px', bottom: (+mIn.b.value || 0) * mm + 'px' } })));
  }
  draw();
  return dialog({
    title: 'Penyiapan halaman', width: 560,
    body: h('div', { style: { display: 'grid', gap: '14px' } },
      h('div', { class: 'grid2' }, h('div', { style: { display: 'grid', gap: '10px' } }, field('Ukuran slide', sizeSel), h('div', { class: 'grid2' }, field('Lebar (cm)', wIn), field('Tinggi (cm)', hIn))), prev),
      h('div', { class: 'fx-l', style: { marginTop: '4px', fontWeight: 600 } }, 'Margin slide (cm)'),
      h('div', { class: 'grid4' }, field('Atas', mIn.t), field('Bawah', mIn.b), field('Kiri', mIn.l), field('Kanan', mIn.r)),
      presets, reflow,
      h('p', { class: 'small muted', style: { margin: 0 } }, 'Margin menjadi area aman: garis panduan putus-putus di editor, tempat placeholder tata letak, posisi header/footer, dan objek menempel ke margin saat digeser. Margin cetak/PDF diatur di File › Pratinjau cetak.')),
    buttons: [{ label: 'Batal', value: false }, { label: 'Terapkan', primary: true, action: () => {
      const W = cm2px(Math.max(5, +wIn.value)), H = cm2px(Math.max(5, +hIn.value));
      const mg = Object.fromEntries(Object.entries(mIn).map(([k, i]) => [k, Math.max(0, +i.value || 0)]));
      if (cm2px(mg.l + mg.r) >= W - 40 || cm2px(mg.t + mg.b) >= H - 40) { toast('Margin terlalu besar untuk ukuran slide'); return false; }
      O.setPage(size, Math.round(W), Math.round(H), mg, reflow.input.checked);
      toast('Ukuran & margin diterapkan');
      return true;
    } }],
  });
}

// ---------- link ----------
export function linkDialog(value = '', allowSlides = true) {
  const d = E.doc;
  const inp = h('input', { class: 'tx', value: value.startsWith('#slide:') ? '' : value, placeholder: 'https://…', autofocus: true });
  let slideId = value.startsWith('#slide:') ? value.slice(7) : '';
  const list = h('div', { class: 'link-slides' }, d.slides.map((s, i) => h('button', { type: 'button', class: 'ls' + (s.id === slideId ? ' on' : ''), onclick: e => { slideId = s.id; inp.value = ''; list.querySelectorAll('.ls').forEach(x => x.classList.toggle('on', x === e.currentTarget)); } }, h('b', null, i + 1 + '.'), ' ', slideTitle(s).slice(0, 48) || 'Tanpa judul')));
  return dialog({
    title: 'Tautan', width: 480,
    body: h('div', { style: { display: 'grid', gap: '10px' } }, field('Alamat web', inp), allowSlides ? [h('div', { class: 'fx-l' }, 'Atau tautkan ke slide di presentasi ini'), list] : null),
    buttons: [value ? { label: 'Hapus tautan', value: '' } : null, { spacer: true }, { label: 'Batal', value: null }, { label: 'Terapkan', primary: true, action: () => {
      let u = inp.value.trim();
      if (u && !/^(https?:|mailto:|tel:)/i.test(u)) u = 'https://' + u;
      return u || (slideId ? '#slide:' + slideId : '');
    } }].filter(Boolean),
  });
}

// ---------- chart data ----------
export async function chartDialog(e) {
  if (!e || e.type !== 'chart') return;
  const c = JSON.parse(JSON.stringify(e.chart));
  const R = () => c.data.length, C = () => c.data[0].length;
  const prev = h('div', { class: 'chart-prev' });
  const tbl = h('table', { class: 'chart-data' });
  const typeSel = select(CHART_TYPES.map(([k, l]) => [k, l]), c.type, v => { c.type = v; draw(); });
  const title = h('input', { class: 'tx', value: c.title || '', placeholder: 'Judul bagan' });
  title.oninput = () => { c.title = title.value; draw(); };
  function table() {
    tbl.replaceChildren(...c.data.map((r, ri) => h('tr', null, r.map((v, ci) => {
      const i = h('input', { value: v ?? '', inputmode: ri && ci ? 'decimal' : null });
      i.oninput = () => { c.data[ri][ci] = ri && ci ? (i.value === '' ? '' : +i.value.replace(',', '.')) : i.value; draw(); };
      return h('td', null, i);
    }))));
  }
  function draw() {
    const box = h('div', { class: 'sl', style: { width: '480px', height: '270px', position: 'relative' } });
    import('./render.js').then(m => { m.themeVars(box, E.doc.theme); box.style.background = 'var(--t-bg)'; box.append(chartSvg(c, 480, 270)); prev.replaceChildren(box); });
  }
  const btns = h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } },
    h('button', { class: 'btn btn-ghost sm', onclick: () => { c.data.push([`Kategori ${R()}`, ...Array(C() - 1).fill(0)]); table(); draw(); } }, '+ Baris'),
    h('button', { class: 'btn btn-ghost sm', onclick: () => { if (R() > 2) { c.data.pop(); table(); draw(); } } }, '− Baris'),
    h('button', { class: 'btn btn-ghost sm', onclick: () => { c.data.forEach((r, i) => r.push(i ? 0 : `Seri ${C()}`)); table(); draw(); } }, '+ Seri'),
    h('button', { class: 'btn btn-ghost sm', onclick: () => { if (C() > 2) { c.data.forEach(r => r.pop()); table(); draw(); } } }, '− Seri'),
    h('button', { class: 'btn btn-ghost sm', onclick: async () => { const [f] = await pickFile('.csv,.txt'); if (!f) return; const t = await readFile(f, 'text'); const rows = t.trim().split(/\r?\n/).map(l => l.split(/[;,\t]/)); c.data = rows.map((r, i) => r.map((v, j) => (i && j ? +v.replace(',', '.') || 0 : v))); table(); draw(); } }, 'Impor CSV'));
  table(); draw();
  const ok = await dialog({ title: 'Data bagan', width: 820, body: h('div', { class: 'chart-dlg' }, h('div', null, h('div', { class: 'grid2' }, field('Jenis', typeSel), field('Judul', title)), h('div', { class: 'chart-scroll' }, tbl), btns), prev), buttons: [{ label: 'Batal', value: false }, { label: 'Terapkan', primary: true, value: true }] });
  if (!ok) return;
  e.chart = c;
  E.commit('Data bagan');
}

// ---------- icons ----------
const ICONS = ['home', 'star', 'favorite', 'check_circle', 'cancel', 'info', 'warning', 'help', 'lightbulb', 'bolt', 'rocket_launch', 'flag', 'emoji_events', 'workspace_premium', 'verified', 'thumb_up', 'thumb_down', 'person', 'group', 'groups', 'handshake', 'school', 'work', 'business_center', 'apartment', 'factory', 'construction', 'engineering', 'architecture', 'foundation', 'handyman', 'build', 'hardware', 'local_shipping', 'directions_car', 'flight', 'train', 'directions_boat', 'map', 'location_on', 'public', 'language', 'schedule', 'calendar_month', 'event', 'alarm', 'timer', 'hourglass_empty', 'payments', 'attach_money', 'savings', 'account_balance', 'credit_card', 'shopping_cart', 'storefront', 'sell', 'receipt_long', 'trending_up', 'trending_down', 'bar_chart', 'pie_chart', 'show_chart', 'analytics', 'insights', 'query_stats', 'monitoring', 'dashboard', 'description', 'folder', 'inventory_2', 'mail', 'call', 'chat', 'forum', 'campaign', 'notifications', 'settings', 'tune', 'search', 'visibility', 'lock', 'security', 'shield', 'key', 'cloud', 'wifi', 'computer', 'smartphone', 'devices', 'memory', 'code', 'terminal', 'database', 'hub', 'api', 'smart_toy', 'psychology', 'science', 'biotech', 'eco', 'park', 'water_drop', 'local_fire_department', 'sunny', 'nightlight', 'restaurant', 'local_cafe', 'health_and_safety', 'medical_services', 'fitness_center', 'sports_soccer', 'music_note', 'photo_camera', 'movie', 'palette', 'brush', 'edit', 'draw', 'auto_awesome', 'celebration', 'cake', 'redeem', 'diamond', 'target', 'track_changes', 'route', 'alt_route', 'sync', 'autorenew', 'arrow_forward', 'arrow_back', 'arrow_upward', 'arrow_downward', 'north_east', 'add', 'remove', 'close', 'done', 'priority_high', 'percent', 'calculate', 'straighten', 'square_foot', 'layers', 'category', 'extension', 'link', 'share', 'download', 'upload', 'print', 'qr_code_2'];
export function iconDialog(target) {
  const q = h('input', { class: 'tx', placeholder: 'Cari ikon (bahasa Inggris, mis. truck, money, chart) atau ketik nama Material Symbol', autofocus: true });
  let filled = !!target?.filled;
  const grid = h('div', { class: 'icon-grid' });
  const draw = () => {
    const s = q.value.trim().toLowerCase().replace(/\s+/g, '_');
    let list = ICONS.filter(n => !s || n.includes(s));
    if (s && !list.includes(s) && /^[a-z0-9_]+$/.test(s)) list = [s, ...list];
    grid.replaceChildren(...list.map(n => h('button', { class: 'ic', 'data-tip': n.replace(/_/g, ' '), onclick: () => { close?.(); if (target) { target.name = n; target.filled = filled; E.commit('Ganti ikon'); } else O.insertIcon(n, filled); Prefs.recentIcons = [n, ...Prefs.recentIcons.filter(x => x !== n)].slice(0, 16); savePrefs(); } }, h('span', { class: 'ms' + (filled ? ' fill' : '') }, n))));
  };
  let close = null;
  q.addEventListener('input', draw);
  draw();
  dialog({ title: target ? 'Ganti ikon' : 'Sisipkan ikon', width: 640, body: h('div', { style: { display: 'grid', gap: '10px' } }, q, toggle('Gaya terisi', filled, v => { filled = v; draw(); }), grid), buttons: [{ label: 'Tutup', value: null }], onOpen: (b, c) => { close = () => c(null); } });
}

// ---------- video ----------
export async function videoDialog(target) {
  const url = h('input', { class: 'tx', value: target?.url || '', placeholder: 'https://www.youtube.com/watch?v=… atau youtu.be/…', autofocus: true });
  const start = numInput(target?.start || 0, { step: 1, min: 0 });
  const auto = toggle('Putar otomatis saat slide tampil (tanpa suara)', !!target?.autoplay);
  const prev = h('div', { class: 'vid-prev' });
  const draw = () => { const id = ytId(url.value); prev.replaceChildren(id ? h('img', { src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, alt: '' }) : h('span', { class: 'muted small' }, 'Tempel tautan YouTube untuk pratinjau')); };
  url.addEventListener('input', draw);
  draw();
  let file = null;
  const r = await dialog({
    title: target ? 'Opsi video' : 'Sisipkan video', width: 520,
    body: h('div', { style: { display: 'grid', gap: '12px' } }, field('Tautan YouTube', url), prev, h('div', { class: 'grid2' }, field('Mulai pada detik', start), h('div')), auto,
      target ? null : h('div', { class: 'row' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: async () => { const [f] = await pickFile('video/mp4,video/webm'); if (!f) return; if (f.size > 12e6) { toast('Video terlalu besar (maks. 12 MB). Gunakan YouTube untuk video besar.'); return; } file = await readFile(f); toast('Video dipilih: ' + f.name); } }, icon('upload'), 'Unggah video kecil (≤ 12 MB)'))),
    buttons: [{ label: 'Batal', value: null }, { label: target ? 'Simpan' : 'Sisipkan', primary: true, value: true }],
  });
  if (!r) return;
  if (!file && url.value && !ytId(url.value)) { toast('Tautan YouTube tidak dikenali'); return; }
  if (target) { Object.assign(target, { url: url.value.trim(), start: +start.value || 0, autoplay: auto.input.checked }); E.commit('Video'); return; }
  O.insertVideo(url.value.trim(), file ? O.addAsset(file) : '');
  const e = one();
  if (e) { e.start = +start.value || 0; e.autoplay = auto.input.checked; }
}

// ---------- diagram (SmartArt) ----------
export async function diagramDialog() {
  let kind = 'process';
  const ta = h('textarea', { class: 'tx', rows: 6 }, 'Perencanaan\nPelaksanaan\nPengawasan\nEvaluasi');
  const prev = h('div', { class: 'dg-prev' });
  const kinds = h('div', { class: 'dg-kinds' }, O.DIAGRAMS.map(([k, n, ic]) => h('button', { type: 'button', class: 'dg' + (k === kind ? ' on' : ''), onclick: e => { kind = k; kinds.querySelectorAll('.dg').forEach(x => x.classList.toggle('on', x === e.currentTarget)); draw(); } }, icon(ic), h('span', null, n))));
  const items = () => ta.value.split('\n').map(s => s.trim()).filter(Boolean);
  function draw() {
    const d = E.doc;
    const fake = { id: 'x', layout: 'blank', els: O.makeDiagram(kind, items().length ? items() : ['A', 'B', 'C']), anims: [] };
    prev.replaceChildren(thumb(d, fake, 340));
  }
  ta.addEventListener('input', draw);
  draw();
  const ok = await dialog({ title: 'Diagram (SmartArt)', width: 760, body: h('div', { class: 'dg-dlg' }, h('div', { style: { display: 'grid', gap: '10px' } }, kinds, field('Isi (satu baris per butir; hierarki: baris pertama = puncak)', ta)), prev), buttons: [{ label: 'Batal', value: false }, { label: 'Sisipkan', primary: true, value: true }] });
  if (ok) O.insertDiagram(kind, items());
}

// ---------- header & footer ----------
export async function headerFooterDialog() {
  const d = E.doc, hf = { ...d.hf };
  const num = toggle('Nomor slide', hf.num), date = toggle('Tanggal', hf.date), skip = toggle('Jangan tampilkan di slide judul', hf.skipTitle);
  const dt = h('input', { class: 'tx', value: hf.dateText || '', placeholder: 'Kosong = tanggal hari ini otomatis' });
  const ft = h('input', { class: 'tx', value: hf.footer || '', placeholder: 'mis. Nama perusahaan · Rahasia' });
  const ok = await dialog({ title: 'Header & footer', width: 460, body: h('div', { style: { display: 'grid', gap: '12px' } }, num, date, field('Teks tanggal', dt), field('Footer', ft), skip, h('p', { class: 'small muted', style: { margin: 0 } }, 'Ditampilkan di bagian bawah, di dalam margin slide.')), buttons: [{ label: 'Batal', value: false }, { label: 'Terapkan ke semua', primary: true, value: true }] });
  if (!ok) return;
  d.hf = { num: num.input.checked, date: date.input.checked, dateText: dt.value.trim(), footer: ft.value.trim(), skipTitle: skip.input.checked };
  E.commit('Header & footer', 'all');
}

// ---------- background ----------
export function backgroundDialog() { E.deselect(); E.openPanel('format'); }

// ---------- find & replace ----------
export function findDialog() {
  const q = h('input', { class: 'tx', placeholder: 'Temukan', autofocus: true });
  const r = h('input', { class: 'tx', placeholder: 'Ganti dengan' });
  const cs = toggle('Cocokkan huruf besar/kecil', false), notes = toggle('Termasuk catatan pembicara', true);
  const info = h('div', { class: 'small muted' });
  let hits = [], idx = -1;
  const opts = () => ({ case: cs.input.checked, notes: notes.input.checked });
  const search = () => { hits = O.findAll(q.value, opts()); idx = -1; info.textContent = q.value ? `${hits.reduce((a, x) => a + x.n, 0)} kecocokan di ${new Set(hits.map(x => x.si)).size} slide` : ''; };
  q.addEventListener('input', search);
  const go = dir => {
    if (!hits.length) return;
    idx = (idx + dir + hits.length) % hits.length;
    const x = hits[idx];
    E.goSlide(x.si);
    if (x.id) E.select([x.id]);
    info.textContent = `${idx + 1} dari ${hits.length} lokasi`;
  };
  dialog({
    title: 'Temukan & ganti', width: 460, cls: 'nonmodal',
    body: h('div', { style: { display: 'grid', gap: '10px' } }, q, r, h('div', { class: 'row', style: { gap: '14px', flexWrap: 'wrap' } }, cs, notes), info,
      h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } },
        h('button', { class: 'btn btn-ghost', onclick: () => go(-1) }, icon('keyboard_arrow_up'), 'Sebelumnya'),
        h('button', { class: 'btn btn-ghost', onclick: () => go(1) }, icon('keyboard_arrow_down'), 'Berikutnya'),
        h('button', { class: 'btn btn-tonal', onclick: () => { if (!q.value) return; const n = O.replaceAll(q.value, r.value, opts()); toast(n ? `${n} diganti` : 'Tidak ada yang cocok'); search(); } }, 'Ganti semua'))),
    buttons: [{ label: 'Selesai', primary: true }],
  });
}

// ---------- slideshow settings ----------
export async function showSettingsDialog() {
  const s = { ...E.doc.show };
  const loop = toggle('Ulangi terus sampai Esc ditekan (kios)', s.loop);
  const auto = toggle('Maju otomatis untuk slide tanpa waktu sendiri', s.auto);
  const sec = numInput(s.autoSec || 5, { step: 1, min: 1 });
  const pen = h('input', { type: 'color', class: 'tx', value: s.pen || '#ff1744' }), laser = h('input', { type: 'color', class: 'tx', value: s.laser || '#ff1744' });
  const ok = await dialog({ title: 'Pengaturan tayangan slide', width: 460, body: h('div', { style: { display: 'grid', gap: '12px' } }, loop, auto, field('Detik per slide (maju otomatis)', sec), h('div', { class: 'grid2' }, field('Warna pena', pen), field('Warna laser', laser))), buttons: [{ label: 'Batal', value: false }, { label: 'Simpan', primary: true, value: true }] });
  if (!ok) return;
  E.doc.show = { ...s, loop: loop.input.checked, auto: auto.input.checked, autoSec: +sec.value || 5, pen: pen.value, laser: laser.value };
  E.commit('Pengaturan tayangan', false);
}

// ---------- camera ----------
export async function cameraDialog() {
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } }); } catch { toast('Kamera tidak tersedia atau izin ditolak'); return; }
  const v = h('video', { autoplay: true, playsinline: true, muted: true, style: { width: '100%', borderRadius: '12px', background: '#000' } });
  v.srcObject = stream;
  const ok = await dialog({ title: 'Ambil foto', width: 640, body: v, buttons: [{ label: 'Batal', value: false }, { label: 'Ambil', primary: true, value: true }] });
  if (ok) {
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    O.placeImage(O.addAsset(c.toDataURL('image/jpeg', .88)), c.width, c.height);
  }
  stream.getTracks().forEach(t => t.stop());
}

// ---------- special characters ----------
const CHARS = '→←↑↓↔⇒⇐⇔•◦▪▫★☆✓✔✕✖±×÷≈≠≤≥∞√∑∏∆∂∫πΩμαβγδθλσφ°′″‰€£¥¢©®™§¶†‡…–—«»“”‘’¹²³¼½¾①②③④⑤⑥⑦⑧⑨⑩♠♣♥♦☎✉✈⌚⌛☀☁☂☃⚡♻⚠⛔✅❌❗❓💡📌📈📉📊';
export function charsDialog() {
  const sel = getSelection(), r = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  dialog({ title: 'Karakter khusus', width: 460, body: (close) => h('div', { class: 'chars' }, [...CHARS].map(c => h('button', { onclick: () => { close(null); if (r) { sel.removeAllRanges(); sel.addRange(r); } document.execCommand('insertText', false, c); E.markTyping?.(); } }, c))), buttons: [] });
}

// ---------- preferences / app theme ----------
export async function prefsDialog() {
  const name = h('input', { class: 'tx', value: Prefs.name, placeholder: 'Nama yang tampil di komentar & berbagi' });
  const ok = await dialog({ title: 'Preferensi', width: 420, body: h('div', { style: { display: 'grid', gap: '12px' } }, field('Nama Anda', name)), buttons: [{ label: 'Batal', value: false }, { label: 'Simpan', primary: true, value: true }] });
  if (!ok) return false;
  Prefs.name = name.value.trim();
  savePrefs();
  E.ui?.av?.replaceChildren?.((await import('./ui.js')).avatar(me()));
  return true;
}
export function uiThemeDialog() {
  const p = Theme.p;
  const modes = segmented([['light', 'Terang', 'light_mode'], ['dark', 'Gelap', 'dark_mode'], ['system', 'Sistem', 'contrast']], p.mode, v => Theme.set({ mode: v }));
  const accents = h('div', { class: 'acc-row' }, ACCENTS.map(([k, l, c]) => h('button', { class: 'acc' + (p.accent === k ? ' on' : ''), style: { background: c }, title: l, onclick: e => { Theme.set({ accent: k }); [...accents.children].forEach(x => x.classList.toggle('on', x === e.currentTarget)); } })));
  const glass = segmented([['liquid', 'Liquid glass', 'water_drop'], ['frost', 'Kaca buram', 'blur_on'], ['solid', 'Solid', 'rectangle']], p.glass, v => Theme.set({ glass: v }));
  const bg = segmented([['aurora', 'Aurora'], ['soft', 'Lembut'], ['plain', 'Polos']], p.bg, v => Theme.set({ bg: v }));
  dialog({ title: 'Tema & tampilan aplikasi', width: 520, body: h('div', { style: { display: 'grid', gap: '16px' } }, field('Mode', modes), field('Warna aksen', accents), field('Material antarmuka', glass), field('Latar belakang', bg)), buttons: [{ label: 'Selesai', primary: true }] });
}

// ---------- help ----------
export function shortcutsDialog(CMD) {
  const groups = { Umum: ['menusearch', 'find', 'print', 'newslide', 'present', 'present-cur', 'shortcuts'], Edit: ['undo', 'redo', 'cut', 'copy', 'paste', 'duplicate', 'delete', 'selectall', 'link', 'comment'], 'Format teks': ['bold', 'italic', 'underline', 'strike', 'sup', 'sub', 'sizeup', 'sizedown', 'align-left', 'align-center', 'align-right', 'align-justify', 'bullets', 'numbers', 'indent', 'outdent', 'clearfmt'], Susun: ['group', 'ungroup', 'z-front', 'z-forward', 'z-backward', 'z-back', 'lockpos'], Tampilan: ['zoomin', 'zoomout', 'zoomfit', 'sorter', 'compact'] };
  const grid = h('div', { class: 'kb-grid' });
  for (const [g, ids] of Object.entries(groups)) {
    grid.append(h('div', { class: 'kb-h' }, g));
    for (const id of ids) { const c = CMD[id]; if (!c?.kbd && !c?.kbdShow) continue; grid.append(h('div', null, typeof c.label === 'function' ? c.label() : c.label), h('div', null, kbdLabel(c.kbd || c.kbdShow))); }
  }
  grid.append(h('div', { class: 'kb-h' }, 'Objek'), h('div', null, 'Geser 1 px / 10 px'), h('div', null, '← → ↑ ↓ / ⇧ + panah'), h('div', null, 'Edit teks objek terpilih'), h('div', null, 'Enter'), h('div', null, 'Pilih objek berikutnya'), h('div', null, 'Tab'), h('div', null, 'Tanpa jepret saat menggeser'), h('div', null, 'tahan ⌥ / Alt'), h('div', null, 'Jaga rasio / sudut 15°'), h('div', null, 'tahan ⇧ Shift'));
  dialog({ title: 'Pintasan keyboard', width: 600, body: grid, buttons: [{ label: 'Tutup', primary: true }] });
}
export function aboutDialog() {
  dialog({
    title: 'Tentang Amatu Slides', width: 460,
    body: h('div', { style: { display: 'grid', gap: '12px', justifyItems: 'center', textAlign: 'center' } },
      h('img', { src: 'assets/icon.svg', alt: '', style: { width: '72px', height: '72px', filter: 'drop-shadow(0 8px 18px rgba(230,120,20,.35))' } }),
      h('div', { style: { fontSize: '20px', fontWeight: 600 } }, 'Amatu Slides'),
      h('div', { class: 'muted' }, 'Presentasi di browser ala Google Slides dengan fitur PowerPoint: animasi, transisi Morph, tampilan penyaji, Designer, SmartArt, WordArt, master, ekspor PowerPoint (.pptx) & PDF.'),
      h('div', { class: 'muted small' }, 'Presentasi tersimpan di perangkat ini; di Portal AMATU tersinkron ke akun Anda. Tautan berbagi disimpan di server AMATU.')),
    buttons: [{ label: 'Tutup', primary: true }],
  });
}
export function menuSearch(MENUS) {
  const all = [];
  const walk = (items, path) => { for (const it of (typeof items === 'function' ? items() : items) || []) { if (!it || it.sep || it.head || it.el) continue; const label = typeof it.label === 'string' ? it.label : ''; if (it.sub) walk(it.sub, [...path, label]); else if (it.run && label) all.push({ ...it, path: path.join(' › ') }); } };
  MENUS.forEach(m => walk(m.items, [m.label]));
  const q = h('input', { class: 'tx', placeholder: 'Ketik nama perintah…', autofocus: true });
  const list = h('div', { class: 'open-list' });
  let close = null, sel = 0, res = [];
  const draw = () => {
    const s = q.value.trim().toLowerCase();
    res = all.filter(x => !s || x.label.toLowerCase().includes(s) || x.path.toLowerCase().includes(s)).slice(0, 40);
    sel = Math.min(sel, res.length - 1);
    list.replaceChildren(...res.map((x, i) => h('div', { class: 'dl-r' + (i === sel ? ' hov' : ''), onclick: () => { close(); x.run(); } }, h('div', { class: 'dl-n' }, icon(x.icon || 'chevron_right'), h('span', null, x.label)), h('div', { class: 'muted small' }, x.path))));
  };
  q.addEventListener('input', () => { sel = 0; draw(); });
  q.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { sel = Math.min(res.length - 1, sel + 1); draw(); e.preventDefault(); } if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); } if (e.key === 'Enter' && res[sel]) { e.preventDefault(); e.stopPropagation(); close(); res[sel].run(); } });
  draw();
  dialog({ title: 'Telusuri menu', width: 520, body: h('div', null, q, list), buttons: [], onOpen: (b, c) => { close = () => c(null); } });
  closeMenus(0);
}
