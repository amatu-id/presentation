// Home screen: template gallery and presentation list.
import { h, icon, toast, toggleMenu, closeMenus, fmtWhen, fmtFull, ask, confirmDlg, pickFile, avatar, debounce } from './ui.js';
import { Store } from './store.js';
import { TEMPLATES } from './templates.js';
import { newPres, normalize } from './model.js';
import { thumb } from './render.js';
import { Prefs, savePrefs, me } from './state.js';

const BLANK_SVG = '<svg viewBox="0 0 48 48"><path d="M24 10v28M10 24h28" stroke="url(#bg)" stroke-width="4" stroke-linecap="round"/><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6b026"/><stop offset=".5" stop-color="#ef6c00"/><stop offset="1" stop-color="#e53935"/></linearGradient></defs></svg>';
const EMPTY_SVG = '<svg viewBox="0 0 120 100" fill="none"><rect x="20" y="22" width="80" height="50" rx="6" fill="var(--glass3)" stroke="var(--line2)"/><rect x="28" y="14" width="80" height="50" rx="6" fill="var(--paper)" stroke="var(--line2)"/><rect x="40" y="28" width="40" height="5" rx="2.5" fill="var(--accent)" opacity=".8"/><rect x="40" y="39" width="56" height="3" rx="1.5" fill="var(--line2)"/><rect x="40" y="46" width="48" height="3" rx="1.5" fill="var(--line2)"/><path d="M60 72v12M48 86h24" stroke="var(--line2)" stroke-width="3" stroke-linecap="round"/></svg>';

function coverThumb(d, w) {
  const c = d.cover;
  if (!c?.slide) return h('div', { class: 'thumb sl-thumb blank' });
  const fake = normalize({ id: d.id, page: c.page || d.page, theme: c.theme, master: c.master || [], hf: c.hf, assets: c.assets || {}, slides: [c.slide] });
  return h('div', { class: 'thumb sl-thumb' }, thumb(fake, c.slide, w, { idx: 0, fluid: true }));
}

export function mountHome(root, { openDoc, openTheme, openPrefs, importFiles }) {
  let docs = [], q = '', filter = 'all';
  let view = Prefs.homeView || 'grid', sort = Prefs.homeSort || 'modified';
  const el = h('div', { class: 'home sl-home' });

  const search = h('input', { type: 'search', placeholder: 'Telusuri presentasi', 'aria-label': 'Telusuri presentasi' });
  const clear = h('button', { class: 'ib sm', 'aria-label': 'Hapus penelusuran', style: { visibility: 'hidden' }, onclick: () => { search.value = ''; q = ''; clear.style.visibility = 'hidden'; render(); search.focus(); } }, icon('close'));
  search.addEventListener('input', debounce(() => { q = search.value.trim().toLowerCase(); clear.style.visibility = q ? 'visible' : 'hidden'; render(); }, 120));

  const top = h('header', { class: 'h-top glass refract' },
    h('a', { class: 'brand', href: '#/' }, h('img', { src: 'assets/icon.svg', alt: '' }), h('span', null, 'Amatu'), h('b', null, 'Slides')),
    h('label', { class: 'h-search' }, icon('search'), search, clear),
    h('div', { class: 'h-right' },
      h('button', { class: 'ib hide-xs', 'data-tip': 'Buka file (.pptx, .amslides)', onclick: openFile }, icon('folder_open')),
      h('button', { class: 'ib', 'data-tip': 'Tema & tampilan', onclick: openTheme }, icon('palette')),
      h('button', { class: 'ib round', 'data-tip': me(), onclick: openPrefs, style: { width: '40px', height: '40px' } }, avatar(me()))));

  const tplRow = h('div', { class: 'tpl-row' });
  const tplToggle = h('button', { class: 'btn-text', onclick: () => { tplSec.classList.toggle('all'); tplToggle.lastChild.textContent = tplSec.classList.contains('all') ? 'unfold_less' : 'unfold_more'; } }, 'Galeri template ', icon('unfold_more', 'sm'));
  const tplSec = h('section', { class: 'h-tpl glass' }, h('div', { class: 'wrap' }, h('div', { class: 'sec-h' }, h('h2', null, 'Mulai presentasi baru'), tplToggle), tplRow));
  for (const t of TEMPLATES) {
    const th = h('div', { class: 'thumb sl-thumb' + (t.id === 'blank' ? ' blank' : '') });
    if (t.id === 'blank') th.innerHTML = BLANK_SVG;
    else requestAnimationFrame(() => { const p = t.make(); th.append(thumb(p, p.slides[0], 176, { idx: 0, fluid: true })); });
    tplRow.append(h('button', { class: 'tpl', onclick: () => fromTemplate(t) }, th, h('div', null, h('div', { class: 'tpl-n' }, t.name), t.sub ? h('div', { class: 'tpl-s' }, t.sub) : null)));
  }

  const listTitle = h('h2');
  const filterBtn = h('button', { class: 'btn btn-ghost', style: { height: '34px', color: 'var(--tx2)' } });
  const viewBtn = h('button', { class: 'ib' });
  const sortBtn = h('button', { class: 'ib', 'data-tip': 'Opsi urutan' }, icon('sort_by_alpha'));
  const listBox = h('div');
  const docsSec = h('section', { class: 'wrap h-docs' },
    h('div', { class: 'sec-h' }, listTitle, filterBtn, viewBtn, sortBtn, h('button', { class: 'ib', 'data-tip': 'Buka file', onclick: openFile }, icon('upload_file'))),
    listBox);
  filterBtn.onclick = () => toggleMenu(filterBtn, [
    { label: 'Semua presentasi', icon: 'slideshow', checked: () => filter === 'all', run: () => { filter = 'all'; render(); } },
    { label: 'Berbintang', icon: 'star', checked: () => filter === 'starred', run: () => { filter = 'starred'; render(); } },
    { label: 'Dibagikan dengan saya', icon: 'group', checked: () => filter === 'shared', run: () => { filter = 'shared'; render(); } },
    { sep: true },
    { label: 'Sampah', icon: 'delete', checked: () => filter === 'trash', run: () => { filter = 'trash'; render(); } },
  ]);
  viewBtn.onclick = () => { view = view === 'grid' ? 'list' : 'grid'; Prefs.homeView = view; savePrefs(); render(); };
  sortBtn.onclick = () => toggleMenu(sortBtn, [
    { head: 'Urutkan menurut' },
    { label: 'Terakhir diubah', checked: () => sort === 'modified', run: () => setSort('modified') },
    { label: 'Terakhir dibuka', checked: () => sort === 'opened', run: () => setSort('opened') },
    { label: 'Judul', checked: () => sort === 'title', run: () => setSort('title') },
    { label: 'Tanggal dibuat', checked: () => sort === 'created', run: () => setSort('created') },
  ], { align: 'right' });
  const setSort = s => { sort = s; Prefs.homeSort = s; savePrefs(); render(); };

  const fab = h('button', { class: 'fab', 'aria-label': 'Presentasi baru', onclick: () => fromTemplate(TEMPLATES[0]) }, icon('add'));
  el.append(top, tplSec, docsSec, fab);
  root.replaceChildren(el);

  let dragN = 0, hint = null;
  const dz = e => e.dataTransfer?.types?.includes('Files');
  el.addEventListener('dragenter', e => { if (!dz(e)) return; e.preventDefault(); if (dragN++ === 0) { hint = h('div', { class: 'drop-hint' }, 'Lepaskan untuk membuka file (.pptx, .amslides, gambar)'); document.body.append(hint); } });
  el.addEventListener('dragleave', () => { if (--dragN <= 0) { dragN = 0; hint?.remove(); } });
  el.addEventListener('dragover', e => { if (dz(e)) e.preventDefault(); });
  el.addEventListener('drop', e => { if (!dz(e)) return; e.preventDefault(); dragN = 0; hint?.remove(); importFiles([...e.dataTransfer.files]); });

  async function load() {
    docs = await Store.list();
    const cutoff = Date.now() - 30 * 864e5;
    for (const d of docs.filter(d => d.trashed && d.trashed < cutoff)) await Store.remove(d.id);
    docs = docs.filter(d => !(d.trashed && d.trashed < cutoff));
    render();
  }
  function render() {
    const names = { trash: 'Sampah', starred: 'Berbintang', shared: 'Dibagikan dengan saya', all: 'Presentasi terbaru' };
    listTitle.textContent = q ? 'Hasil penelusuran' : names[filter];
    filterBtn.replaceChildren(filter === 'all' ? 'Semua presentasi' : names[filter], icon('arrow_drop_down', 'sm'));
    viewBtn.replaceChildren(icon(view === 'grid' ? 'view_list' : 'grid_view'));
    viewBtn.dataset.tip = view === 'grid' ? 'Tampilan daftar' : 'Tampilan petak';
    let list = docs.filter(d => filter === 'trash' ? d.trashed : !d.trashed && (filter !== 'starred' || d.starred) && (filter !== 'shared' || d.id.startsWith('sh-')));
    if (q) list = list.filter(d => (d.title || '').toLowerCase().includes(q));
    list.sort((a, b) => sort === 'title' ? (a.title || '').localeCompare(b.title || '', 'id') : (b[sort] || 0) - (a[sort] || 0));
    if (!list.length) {
      listBox.replaceChildren(h('div', { class: 'empty glass', html: EMPTY_SVG },
        h('h3', null, q ? 'Tidak ada presentasi yang cocok' : filter === 'trash' ? 'Sampah kosong' : filter === 'starred' ? 'Belum ada presentasi berbintang' : 'Belum ada presentasi'),
        h('div', null, q ? 'Coba kata kunci lain.' : filter === 'trash' ? 'Presentasi di sampah dihapus permanen setelah 30 hari.' : 'Pilih template di atas atau buka file PowerPoint (.pptx) dari perangkat Anda.')));
      return;
    }
    const when = d => sort === 'opened' ? 'Dibuka ' + fmtWhen(d.opened) : sort === 'created' ? 'Dibuat ' + fmtWhen(d.created) : 'Diubah ' + fmtWhen(d.modified);
    const ic = d => (d.locked ? 'lock' : d.id.startsWith('sh-') ? 'group' : 'slideshow');
    if (view === 'grid') {
      listBox.replaceChildren(h('div', { class: 'doc-grid sl-grid' }, list.map(d => {
        const more = h('button', { class: 'ib sm', 'aria-label': 'Opsi lainnya', onclick: e => { e.stopPropagation(); toggleMenu(more, () => cardMenu(d), { align: 'right' }); } }, icon('more_vert'));
        return h('div', { class: 'dcard glass', tabindex: '0', role: 'button', 'aria-label': d.title, onclick: () => open(d), onkeydown: e => { if (e.key === 'Enter') open(d); } },
          d.locked ? h('div', { class: 'thumb sl-thumb lk-thumb' }, icon('lock', 'fill')) : coverThumb(d, 232),
          h('div', { class: 'dcard-f' }, h('div', { class: 'dcard-t', title: d.title }, d.title || 'Tanpa judul'),
            h('div', { class: 'dcard-m' }, icon(ic(d)), d.starred ? icon('star', 'fill star-on xs') : null, h('span', { title: fmtFull(d.modified) }, when(d) + (d.count ? ` · ${d.count} slide` : ''))), more));
      })));
    } else {
      listBox.replaceChildren(h('div', { class: 'dlist glass' },
        h('div', { class: 'dl-h' }, h('div', null, 'Nama'), h('div', null, 'Terakhir dibuka'), h('div', null, 'Terakhir diubah'), h('div')),
        list.map(d => {
          const more = h('button', { class: 'ib sm', 'aria-label': 'Opsi lainnya', onclick: e => { e.stopPropagation(); toggleMenu(more, () => cardMenu(d), { align: 'right' }); } }, icon('more_vert'));
          return h('div', { class: 'dl-r', onclick: () => open(d) },
            h('div', { class: 'dl-n' }, icon(ic(d)), d.starred ? icon('star', 'fill star-on xs') : null, h('span', null, d.title || 'Tanpa judul')),
            h('div', { class: 'muted' }, fmtWhen(d.opened)), h('div', { class: 'muted' }, fmtWhen(d.modified)), more);
        })));
    }
  }
  function cardMenu(d) {
    if (d.trashed) return [
      { label: 'Pulihkan', icon: 'restore_from_trash', run: async () => { await Store.patch(d.id, { trashed: 0 }); toast('Presentasi dipulihkan'); load(); } },
      { label: 'Hapus selamanya', icon: 'delete_forever', run: async () => { if (await confirmDlg('Hapus selamanya?', `"${d.title}" akan dihapus permanen dan tidak dapat dipulihkan.`, 'Hapus selamanya', true)) { await Store.remove(d.id); load(); } } },
    ];
    return [
      { label: 'Ganti nama', icon: 'drive_file_rename_outline', run: async () => { const t = await ask({ title: 'Ganti nama', label: 'Nama baru presentasi', value: d.title, ok: 'Simpan' }); if (t?.trim()) { await Store.patch(d.id, { title: t.trim() }); const full = await Store.get(d.id); if (full) { full.title = t.trim(); await Store.put(full); } load(); } } },
      { label: d.starred ? 'Hapus bintang' : 'Beri bintang', icon: 'star', run: async () => { await Store.patch(d.id, { starred: !d.starred }); load(); } },
      { label: 'Buat salinan', icon: 'content_copy', run: async () => { const full = await Store.get(d.id); const c = newPres({ ...full, id: undefined, title: 'Salinan ' + full.title, share: null, created: Date.now(), modified: Date.now() }); c.id = newPres().id; delete c.share; await Store.put(c); toast('Salinan dibuat'); load(); } },
      { label: 'Mulai tayangan slide', icon: 'slideshow', run: () => { openDoc(d.id, true); } },
      { label: 'Buka di tab baru', icon: 'open_in_new', run: () => window.open(location.pathname + location.search + '#/d/' + d.id, '_blank') },
      { sep: true },
      { label: 'Hapus', icon: 'delete', run: async () => { await Store.patch(d.id, { trashed: Date.now() }); toast(`"${d.title}" dipindahkan ke sampah`, { action: 'Urungkan', onAction: async () => { await Store.patch(d.id, { trashed: 0 }); load(); } }); load(); } },
    ];
  }
  function open(d) {
    if (d.trashed) { toast('Pulihkan presentasi ini dari sampah untuk membukanya'); return; }
    openDoc(d.id);
  }
  async function fromTemplate(t) {
    const p = t.make();
    if (t.id !== 'blank') p.title = t.name;
    await Store.put(p);
    openDoc(p.id);
  }
  async function openFile() {
    const files = await pickFile('.pptx,.amslides,.json,image/*', true);
    if (files.length) importFiles(files);
  }
  const off = Store.onChange(() => load());
  load();
  return { destroy() { off(); closeMenus(0); } };
}
