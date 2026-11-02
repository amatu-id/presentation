// Live share links of Amatu Slides: "Lihat saja" / "Bisa mengedit" links to one server copy (see live.js),
// the guest route (?share=<key>), syncing the open editor, and the Bagikan dialog.
import { E, Prefs } from './state.js';
import { h, icon, toast, dialog } from './ui.js';
import { Store } from './store.js';
import { newPres, normalize } from './model.js';
import { Live, rpc, account, shareKey, linkFor, errText, merge3 } from './live.js';

export { shareKey };
const APP = 'presentation';
const KEYS = ['title', 'page', 'theme', 'master', 'slides', 'comments', 'hf', 'show'];
const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));

// ---------- presentation on the server ----------
export function payload() {
  const d = E.doc;
  if (!d) return null;
  if (E.editing) E.syncEditing?.();
  const o = {};
  for (const k of KEYS) o[k] = clone(d[k]);
  const used = JSON.stringify(o);   // images referenced by slides, master, theme background
  o.assets = Object.fromEntries(Object.entries(d.assets || {}).filter(([k]) => used.includes('a:' + k)));
  return o;
}
const byId = a => Object.fromEntries((a || []).map(c => [c.id, c]));
// Ordered lists of objects with ids merge per item; order follows mine, new items of theirs keep their place after.
function mergeList(bb, mm, tt) {
  const r = merge3(byId(bb), byId(mm), byId(tt));
  const order = [];
  const tl = tt || [], ml = mm || [];
  for (const x of ml) if (r[x.id] && !order.includes(x.id)) order.push(x.id);
  tl.forEach((x, i) => { if (r[x.id] && !order.includes(x.id)) { const prev = tl[i - 1]; const at = prev ? order.indexOf(prev.id) + 1 : 0; order.splice(at, 0, x.id); } });
  return order.map(id => r[id]);
}
// Slides merge per slide, and inside a slide per element, so two people editing different objects both keep their work.
export const mergePres = (b, m, t) => merge3(b || {}, m, t, {
  slides: (bb, mm, tt) => {
    const merged = mergeList(bb, mm, tt);
    const bm = byId(bb), mmm = byId(mm), tm = byId(tt);
    return merged.map(s => (bm[s.id] && mmm[s.id] && tm[s.id] ? { ...s, els: mergeList(bm[s.id].els, mmm[s.id].els, tm[s.id].els) } : s));
  },
  comments: mergeList,
  master: mergeList,
});

function applyDoc(x) {
  const d = E.doc;
  if (!d || E.dead || !x) return;
  for (const k of KEYS) if (x[k] !== undefined) d[k] = clone(x[k]);
  d.assets = { ...d.assets, ...(x.assets || {}) };
  normalize(d);
  if (document.activeElement !== E.ui.title) E.ui.title.value = d.title;
  document.title = d.title + ' - Amatu Slides';
  E.cur = Math.min(E.cur, d.slides.length - 1);
  E.sel = new Set([...E.sel].filter(id => (E.editMaster ? d.master : d.slides[E.cur].els).some(e => e.id === id)));
  E.render(); E.renderStrip?.(); E.updateNotes?.(); E.refreshPanel?.(); E.updateStatus?.(); E.updateToolbar?.();
}

// ---------- open through a link ----------
export async function openLink(key) {
  const id = 'sh-' + key.slice(0, 16).replace(/[^\w-]/g, '_');
  let d = await Store.get(id);
  if (!d) { d = newPres({ title: 'Memuat…' }); d.id = id; }
  if (d.share?.key !== key) d.share = { key, role: 'view', owner: false, rev: 0, clean: true };
  await Store.put(d);
  return id;
}

// ---------- editor session ----------
const persistSoon = (() => { let t = 0; return () => { clearTimeout(t); t = setTimeout(() => { if (E.doc && !E.dead) Store.put(E.doc).catch(() => { }); }, 800); }; })();
function setRole(s) {
  const view = !!(s && !s.owner && (s.role === 'view' || s.revoked));
  E.lockView = view;
  E.root?.classList.toggle('view-only', view);
  if (view) { if (E.editing) E.endEdit(true); E.sel = new Set(); E.drawOverlay?.(); }
  if (E.ui.title) E.ui.title.readOnly = view;
  E.updateNotes?.();
  E.render?.();
  let b = E.ui.badge;
  if (!s) { b?.remove(); E.ui.badge = null; return; }
  if (!b || !b.isConnected) { b = E.ui.badge = h('button', { class: 'share-badge', onclick: () => shareDialog() }); E.ui.saved.after(b); }
  const [ic, tx, tip, cls] = s.revoked ? ['link_off', 'Tautan tidak berlaku', 'Pemilik mematikan atau mengganti tautan ini', 'bad']
    : s.owner ? ['group', 'Dibagikan', 'Presentasi ini dibagikan dengan tautan', 'own']
      : s.role === 'edit' ? ['edit', 'Bisa mengedit', 'Anda membuka tautan edit', 'edit'] : ['visibility', 'Hanya melihat', 'Anda membuka tautan lihat saja', 'view'];
  b.className = 'share-badge ' + cls;
  b.replaceChildren(icon(ic), h('span', { class: 't' }, tx));
  b.dataset.tip = tip;
}
function status(st, info, e) {
  if (st === 'revoked') {
    const d = E.doc;
    if (d?.share && !d.share.owner) {
      d.share.revoked = true; setRole(d.share);
      E.live?.stop(); E.live = null;
      d.slides = [{ id: 'gone', layout: 'blank', els: [{ id: 'msg', type: 'text', x: 80, y: d.page.h / 2 - 40, w: d.page.w - 160, h: 80, rot: 0, html: '<p style="text-align:center">Tautan ini tidak berlaku lagi. Minta tautan baru kepada pemilik presentasi.</p>', box: { va: 'middle', pad: [8, 10, 8, 10] }, def: { size: 22 } }], anims: [], notes: '' }];
      E.cur = 0; E.render(); E.renderStrip?.();
      Store.remove(d.id).catch(() => { });
      E.dirty = false;
    }
    toast(errText({ code: 'notfound' }));
  }
  if (st === 'denied' || st === 'error') toast(errText(e || { code: 'denied' }));
  E.liveState = {
    synced: ['cloud_done', 'Tersinkron', 'Tersimpan di server berbagi' + (info?.by ? ' · terakhir diubah oleh ' + info.by : '')],
    saving: ['sync', 'Menyinkronkan…'], pending: ['sync', 'Menyinkronkan…'],
    offline: ['cloud_off', 'Offline', 'Tidak terhubung. Perubahan disimpan di perangkat dan dikirim saat online.'],
    revoked: ['link_off', 'Tautan tidak berlaku'], denied: ['block', 'Ditolak'], error: ['error', 'Gagal sinkron'],
  }[st] || E.liveState;
  E.setSaveState?.('saved');
}

export function attach(handle) {
  if (!handle || !E.doc) return handle;
  start();
  const destroy = handle.destroy;
  handle.destroy = async () => { if (E.live && !E.live.clean) await E.live.save().catch(() => { }); stop(); return destroy.call(handle); };
  return handle;
}
function stop() { E.live?.stop(); E.live = null; E.liveState = null; E.lockView = false; }
function start() {
  stop();
  const s = E.doc.share;
  setRole(s && s.role ? s : null);
  if (!s?.key) return;
  const doc = E.doc;
  const mine = () => E.doc === doc && !E.dead;
  const live = new Live(s.key, {
    payload: () => (mine() ? payload() : null),
    merge: mergePres,
    apply: x => { if (mine()) { applyDoc(x); persistSoon(); } },
    busy: () => !!(E.editing || document.querySelector('.show-root')),
    status: (st, info, e) => { if (mine()) status(st, info, e); },
    role: info => { if (!mine()) return; Object.assign(doc.share, { role: info.role, by: info.by, ownerName: info.owner, owner: s.owner || false }); setRole(doc.share); },
    name: () => E.doc?.title || '',
    by: () => account()?.u || Prefs.name || 'Tamu',
    persist: st => { if (mine()) { Object.assign(doc.share, st); persistSoon(); } },
  }, s);
  E.live = live;
  live.start().catch(e => status(e.code === 'notfound' ? 'revoked' : 'offline', null, e));
}

// ---------- Bagikan dialog ----------
export async function shareDialog() {
  if (E.dirty) await E.save();
  const doc = E.doc, acc = account();
  const body = h('div', { class: 'share-dlg' });
  const copyRow = (label, desc, url, on, onToggle, onReset) => {
    const inp = h('input', { class: 'tx', readonly: true, value: on ? url : 'Tautan dimatikan', disabled: !on, onfocus: e => e.target.select() });
    return h('div', { class: 'share-row' + (on ? '' : ' off') },
      h('div', { class: 'share-head' }, h('div', null, h('div', { style: { fontWeight: 600 } }, label), h('div', { class: 'muted small' }, desc)),
        onToggle ? h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: on, onchange: e => onToggle(e.target.checked) }), h('span')) : null),
      h('div', { class: 'share-link' }, inp,
        h('button', { class: 'btn btn-tonal', disabled: !on, onclick: () => { navigator.clipboard?.writeText(url).then(() => toast('Tautan disalin')); } }, icon('content_copy'), 'Salin'),
        onReset && on ? h('button', { class: 'ib', 'data-tip': 'Buat tautan baru (tautan lama berhenti berfungsi)', onclick: onReset }, icon('autorenew')) : null));
  };
  const note = (ic, title, text, ...more) => h('div', { class: 'row share-note', style: { alignItems: 'flex-start' } },
    h('div', { class: 'av', style: { background: 'var(--acc-soft)', color: 'var(--acc-tx)', boxShadow: 'none' } }, icon(ic)),
    h('div', null, h('div', { style: { fontWeight: 600 } }, title), h('div', { class: 'muted small' }, text), ...more));
  const files = () => h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } },
    h('button', { class: 'btn btn-ghost', onclick: () => E.run('dl-pptx') }, icon('download'), 'Unduh .pptx'),
    h('button', { class: 'btn btn-ghost', onclick: () => E.run('dl-pdf') }, icon('picture_as_pdf'), 'Unduh PDF'),
    h('button', { class: 'btn btn-ghost', onclick: () => E.run('dl-json') }, icon('data_object'), 'File .amslides'));

  const render = () => {
    const s = doc.share;
    const parts = [];
    if (s && !s.owner) {
      parts.push(note(s.role === 'edit' ? 'edit' : 'visibility', s.role === 'edit' ? 'Anda dapat mengedit presentasi ini' : 'Anda hanya dapat melihat presentasi ini',
        `Dibagikan oleh ${s.ownerName || 'pemilik'}. Perubahan tersimpan langsung untuk semua yang membuka tautan.`),
      copyRow('Tautan ini', 'Teruskan hanya ke orang yang Anda percaya.', linkFor(APP, s.key), true));
    } else if (!acc) {
      parts.push(note('login', 'Masuk ke Portal AMATU untuk membuat tautan berbagi', 'Tautan "Lihat saja" dan "Bisa mengedit" disimpan di akun AMATU Anda. Tanpa akun, Anda tetap bisa mengirim file .pptx / PDF / .amslides.'));
    } else if (!s) {
      parts.push(note('group_add', 'Bagikan dengan tautan', 'Presentasi diunggah ke server AMATU. Anda mendapat dua tautan: "Lihat saja" (penonton) dan "Bisa mengedit" (editor). Perubahan tersinkron otomatis untuk semua yang membukanya.'),
        doc.lock ? h('div', { class: 'muted small' }, icon('lock', 'xs'), ' Presentasi ini berkata sandi — tautan berbagi tetap dapat dibuka tanpa kata sandi.') : null,
        h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', onclick: create }, icon('link'), 'Buat tautan berbagi')));
    } else {
      parts.push(
        copyRow('Lihat saja (pelihat)', 'Siapa pun yang memiliki tautan dapat menonton & menjalankan tayangan slide, tanpa mengubahnya.', linkFor(APP, s.vkey), s.view_on !== false, on => set({ p_view: on }), () => set({ p_reset: 'view' })),
        copyRow('Bisa mengedit (editor)', 'Siapa pun yang memiliki tautan dapat mengedit seluruh presentasi.', linkFor(APP, s.ekey), s.edit_on !== false, on => set({ p_edit: on }), () => set({ p_reset: 'edit' })),
        h('div', { class: 'row' }, h('span', { class: 'muted small', style: { flex: 1 } }, s.by ? `Terakhir diubah oleh ${s.by}` : ''),
          h('button', { class: 'btn btn-danger', onclick: stopSharing }, icon('link_off'), 'Berhenti berbagi')));
    }
    parts.push(files());
    body.replaceChildren(...parts);
  };
  async function create() {
    try {
      const r = await rpc('amt_share_create', { p_token: acc.t, p_app: APP, p_doc: doc.id, p_name: doc.title, p_data: payload() });
      doc.share = { owner: true, id: r.id, key: r.okey, vkey: r.vkey, ekey: r.ekey, view_on: r.view_on, edit_on: r.edit_on, role: 'edit', rev: r.existing ? 0 : r.rev, clean: !r.existing };
      await Store.put(doc);
      start();
      render();
      toast('Tautan berbagi dibuat');
    } catch (e) { toast(errText(e)); }
  }
  async function set(args) {
    try {
      const r = await rpc('amt_share_set', { p_token: acc.t, p_id: doc.share.id, p_view: null, p_edit: null, p_reset: null, p_delete: false, ...args });
      Object.assign(doc.share, { vkey: r.vkey, ekey: r.ekey, view_on: r.view_on, edit_on: r.edit_on, key: r.okey });
      await Store.put(doc);
      render();
      if (args.p_reset) toast('Tautan baru dibuat. Tautan lama tidak berfungsi lagi.');
    } catch (e) { toast(errText(e)); }
  }
  async function stopSharing() {
    try {
      await rpc('amt_share_set', { p_token: acc.t, p_id: doc.share.id, p_view: null, p_edit: null, p_reset: null, p_delete: true });
      stop();
      doc.share = null;
      await Store.put(doc);
      setRole(null);
      E.setSaveState?.('saved');
      render();
      toast('Berhenti berbagi. Kedua tautan tidak berfungsi lagi.');
    } catch (e) { toast(errText(e)); }
  }
  if (acc && !doc.share) rpc('amt_share_mine', { p_token: acc.t, p_app: APP, p_doc: doc.id }).then(r => {
    if (r && !doc.share) { doc.share = { owner: true, id: r.id, key: r.okey, vkey: r.vkey, ekey: r.ekey, view_on: r.view_on, edit_on: r.edit_on, role: 'edit', rev: 0, clean: false }; Store.put(doc); start(); render(); }
  }).catch(() => { });
  render();
  dialog({ title: `Bagikan "${doc.title}"`, width: 580, body, buttons: [{ label: 'Selesai', primary: true }] });
}
