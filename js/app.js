// App shell: routing between home and editor, presentation-level actions.
import { E, Prefs } from './state.js';
import { h, icon, toast, dialog, fmtWhen, closeMenus, pickFile } from './ui.js';
import { Theme, installRefraction } from './theme.js';
import { Store } from './store.js';
import { newPres } from './model.js';
import { mountHome } from './home.js';
import { openEditor } from './editor.js';
import * as Share from './sharing.js';
import './commands.js';

Theme.apply();
installRefraction();
const root = document.getElementById('app');
let current = null, busy = false, linkKey = Share.shareKey();

const go = (id, show) => { location.hash = '#/d/' + id + (show ? '?show=1' : ''); };
const app = {
  async newPres() { const d = newPres(); await Store.put(d); go(d.id); },
  async importFiles(files) {
    const { importFile } = await import('./io.js');
    let last = null;
    for (const f of files) {
      try { toast(`Membuka ${f.name}…`, { ms: 1500 }); last = await importFile(f); }
      catch (e) { console.error(e); toast(`Gagal membuka ${f.name}: ${e.message || 'format tidak didukung'}`); }
    }
    if (last) go(last);
  },
  async copyPres() {
    if (E.dirty) await E.save();
    const src = E.doc;
    const d = newPres({ ...JSON.parse(JSON.stringify(src)), title: 'Salinan ' + src.title, created: Date.now(), modified: Date.now() });
    d.id = newPres().id;
    delete d.share;
    await Store.put(d);
    toast('Salinan dibuat', { action: 'Buka', onAction: () => go(d.id) });
  },
  async trashPres() {
    const id = E.doc.id, title = E.doc.title;
    if (E.dirty) await E.save();
    await Store.patch(id, { trashed: Date.now() });
    location.hash = '#/';
    toast(`"${title}" dipindahkan ke sampah`, { action: 'Urungkan', onAction: async () => { await Store.patch(id, { trashed: 0 }); go(id); } });
  },
  async openDialog() {
    const docs = (await Store.list()).filter(d => !d.trashed).sort((a, b) => (b.opened || 0) - (a.opened || 0));
    const q = h('input', { class: 'tx', placeholder: 'Telusuri presentasi', autofocus: true });
    const list = h('div', { class: 'open-list' });
    let closeAll = () => { };
    const draw = () => {
      const s = q.value.trim().toLowerCase();
      const res = docs.filter(d => !s || (d.title || '').toLowerCase().includes(s));
      list.replaceChildren(...res.map(d => h('div', { class: 'dl-r', onclick: () => { closeAll(); go(d.id); } }, h('div', { class: 'dl-n' }, icon(d.locked ? 'lock' : 'slideshow'), h('span', null, d.title || 'Tanpa judul')), h('div', { class: 'muted' }, fmtWhen(d.opened || d.modified)))));
      if (!res.length) list.append(h('div', { class: 'ol-empty' }, 'Tidak ada presentasi'));
    };
    q.addEventListener('input', draw);
    draw();
    dialog({
      title: 'Buka presentasi', width: 560, body: h('div', null, q, list),
      onOpen: (box, close) => { closeAll = () => close(null); },
      buttons: [{ label: 'Unggah dari perangkat', action: async c => { const f = await pickFile('.pptx,.amslides,.json'); if (f.length) { c(null); app.importFiles(f); } return false; } }, { spacer: true }, { label: 'Batal', value: null }],
    });
  },
};

async function route() {
  if (busy) return;
  busy = true;
  try {
    closeMenus(0);
    document.querySelectorAll('.tip, .dimtip').forEach(x => x.remove());
    const hash = location.hash;
    if (current) { await current.destroy?.(); current = null; }
    if (linkKey) {   // ?share=<key>: open the shared presentation (cached under its own id)
      const id = await Share.openLink(linkKey);
      linkKey = null;
      history.replaceState(null, '', location.pathname + location.search + '#/d/' + id);
      busy = false;
      return route();
    }
    const m = hash.match(/^#\/d\/([\w-]+)(\?show=1)?/);
    if (m) {
      current = Share.attach(await openEditor(root, m[1], app));
      if (m[2] && current) { history.replaceState(null, '', location.pathname + location.search + '#/d/' + m[1]); setTimeout(() => E.run('present'), 400); }
    } else {
      document.title = 'Amatu Slides';
      current = mountHome(root, {
        openDoc: go,
        openTheme: () => import('./dialogs.js').then(m2 => m2.uiThemeDialog()),
        openPrefs: async () => { const d = await import('./dialogs.js'); if (await d.prefsDialog()) route(); },
        importFiles: app.importFiles,
      });
    }
  } catch (e) {
    console.error(e);
    toast('Terjadi kesalahan: ' + (e.message || e));
  } finally { busy = false; }
}
addEventListener('hashchange', route);
route();

if (!Prefs.name) document.documentElement.dataset.firstRun = '1';
