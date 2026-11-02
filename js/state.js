// Shared editor state. Feature modules attach behaviour to E at runtime to avoid import cycles.

export const E = {
  doc: null,          // the open presentation
  cur: 0,             // current slide index
  sel: new Set(),     // selected element ids on the current slide (or master)
  editing: null,      // id of the element whose text is being edited
  stripSel: new Set(),// selected slide ids in the filmstrip
  zoom: 1, fit: true, editMaster: false, dead: true, dirty: false, lockView: false, live: null, liveState: null,
  view: { notes: true, margins: true, grid: false, snapGrid: false, gridSize: 20, guides: true, panel: null, sorter: false, spell: true },
  ui: {}, clip: null, painter: null,
};

const PKEY = 'aslides.prefs';
const PDEF = { name: '', homeView: 'grid', homeSort: 'modified', notes: true, margins: true, grid: false, snapGrid: false, recentFonts: [], recentIcons: [], panelW: 300, stripW: 196 };
export const Prefs = (() => { try { return { ...PDEF, ...JSON.parse(localStorage.getItem(PKEY) || '{}') }; } catch { return { ...PDEF }; } })();
export function savePrefs() { try { localStorage.setItem(PKEY, JSON.stringify(Prefs)); } catch { /* private mode */ } }
export const me = () => Prefs.name || 'Saya';

// Current slide / element helpers.
export const slide = () => E.doc?.slides[E.cur];
export const els = () => (E.editMaster ? E.doc.master : slide()?.els) || [];
export const elById = id => els().find(e => e.id === id);
export const selEls = () => els().filter(e => E.sel.has(e.id));
export const one = () => { const s = selEls(); return s.length === 1 ? s[0] : null; };
