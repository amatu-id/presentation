// IndexedDB persistence. "meta" holds light listing data (cover = first slide for the home grid); "docs" holds content;
// "versions" holds snapshots.

const DBN = 'amatu-slides';
let dbp = null;
const bc = 'BroadcastChannel' in self ? new BroadcastChannel('aslides') : null;
const listeners = new Set();
bc && (bc.onmessage = e => listeners.forEach(f => f(e.data)));

function open() {
  return dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(DBN, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('meta', { keyPath: 'id' });
      d.createObjectStore('docs', { keyPath: 'id' });
      d.createObjectStore('versions', { keyPath: 'vid' }).createIndex('doc', 'doc');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = t => new Promise((res, rej) => { t.oncomplete = res; t.onerror = t.onabort = () => rej(t.error); });
async function os(name, mode = 'readonly') { return (await open()).transaction(name, mode).objectStore(name); }

const META = ['id', 'title', 'created', 'modified', 'opened', 'starred', 'trashed', 'cover', 'count', 'page'];
// A locked document keeps no readable preview in the listing.
// Cover = first slide with what it needs to render (theme, page, master, the images it uses).
function coverOf(d) {
  const s = d.slides?.[0];
  if (!s) return d.cover || null;
  const used = JSON.stringify([s, d.master, d.theme]);
  const assets = {};
  let n = 0;
  for (const [k, v] of Object.entries(d.assets || {})) if (used.includes('a:' + k) && (n += v.length) < 900000) assets[k] = v;
  return { slide: s, theme: d.theme, page: d.page, master: d.master, hf: d.hf, assets };
}
const metaOf = d => ({ ...Object.fromEntries(META.map(k => [k, d[k]])), count: d.slides?.length ?? d.count, ...(d.lock ? { cover: null, locked: true } : { cover: coverOf(d), locked: false }) });
const bodyOf = d => { const o = { ...d }; for (const k of META) if (k !== 'id' && k !== 'page') delete o[k]; delete o.locked; return o; };
const notify = msg => { bc?.postMessage(msg); listeners.forEach(f => f(msg)); };

export const Store = {
  onChange(f) { listeners.add(f); return () => listeners.delete(f); },
  async list() { return req((await os('meta')).getAll()); },
  async get(id) {
    const d = await open();
    const t = d.transaction(['meta', 'docs']);
    const [m, b] = await Promise.all([req(t.objectStore('meta').get(id)), req(t.objectStore('docs').get(id))]);
    return m && b ? { ...b, ...m } : null;
  },
  async put(doc) {
    const d = await open();
    const t = d.transaction(['meta', 'docs'], 'readwrite');
    t.objectStore('meta').put(metaOf(doc));
    t.objectStore('docs').put(bodyOf(doc));
    await done(t);
    notify({ t: 'put', id: doc.id });
  },
  async patch(id, patch) {
    const s = await os('meta', 'readwrite');
    const m = await req(s.get(id));
    if (!m) return;
    Object.assign(m, patch);
    await req(s.put(m));
    notify({ t: 'put', id });
  },
  async remove(id) {
    const d = await open();
    const t = d.transaction(['meta', 'docs', 'versions'], 'readwrite');
    t.objectStore('meta').delete(id);
    t.objectStore('docs').delete(id);
    const vs = t.objectStore('versions');
    const keys = await req(vs.index('doc').getAllKeys(id));
    keys.forEach(k => vs.delete(k));
    await done(t);
    notify({ t: 'del', id });
  },
  versions: {
    async list(doc) { return (await req((await os('versions')).index('doc').getAll(doc))).sort((a, b) => b.time - a.time); },
    async add(v) { await req((await os('versions', 'readwrite')).put(v)); },
    async del(vid) { await req((await os('versions', 'readwrite')).delete(vid)); },
    async rename(vid, name) { const s = await os('versions', 'readwrite'); const v = await req(s.get(vid)); if (v) { v.name = name; await req(s.put(v)); } },
  },
};
