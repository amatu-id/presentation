// Command table, menu bar and keyboard shortcuts.
import { E, Prefs, savePrefs, slide, selEls, one, els } from './state.js';
import { h, icon, toast, closeMenus, palette, confirmDlg, ask } from './ui.js';
import * as O from './ops.js';
import { Hist } from './editor.js';
import { LAYOUTS, THEMES, SIZES, shapeEl, textEl } from './model.js';
import { SHAPES, CHART_TYPES, thumb, shapePath } from './render.js';
import { FONTS } from './fonts.js';
import * as Lock from './lock.js';

export const CMD = {};
const def = (id, c) => { CMD[id] = c; };
const D = () => import('./dialogs.js');
const P = () => import('./panels.js');
const IO = () => import('./io.js');
const SH = () => import('./present.js');
const has = () => selEls().length > 0;
const textSel = () => E.editing || selEls().some(e => e.type === 'text' || e.type === 'shape' || e.type === 'table');
const canEdit = () => !E.lockView;
const typeSel = t => { const e = one(); return !!e && (Array.isArray(t) ? t.includes(e.type) : e.type === t); };

export function run(id, ...a) {
  const c = CMD[id];
  if (!c) return;
  if (c.enabled && !c.enabled()) return;
  if (E.lockView && c.edit !== false && !c.view) { toast('Anda hanya dapat melihat presentasi ini'); return; }
  closeMenus(0);
  return c.run(...a);
}
E.run = run;

// ---------- File ----------
def('new', { label: 'Presentasi baru', icon: 'add', view: true, run: () => E.app.newPres() });
def('open', { label: 'Buka', icon: 'folder_open', kbd: 'Mod+O', view: true, run: () => E.app.openDialog() });
def('copy-pres', { label: 'Buat salinan', icon: 'content_copy', view: true, run: () => E.app.copyPres() });
def('import-pptx', { label: 'Impor slide (.pptx / .amslides)', icon: 'upload_file', run: () => IO().then(m => m.importInto()) });
def('dl-pptx', { label: 'Microsoft PowerPoint (.pptx)', icon: 'slideshow', view: true, run: () => IO().then(m => m.exportPptx()) });
def('dl-pdf', { label: 'Dokumen PDF (.pdf)', icon: 'picture_as_pdf', view: true, run: () => IO().then(m => m.printDialog(true)) });
def('dl-png', { label: 'Gambar PNG (slide ini)', icon: 'image', view: true, run: () => IO().then(m => m.exportImage('png')) });
def('dl-jpg', { label: 'Gambar JPEG (slide ini)', icon: 'image', view: true, run: () => IO().then(m => m.exportImage('jpeg')) });
def('dl-png-all', { label: 'Semua slide sebagai PNG (.zip)', icon: 'collections', view: true, run: () => IO().then(m => m.exportAllImages()) });
def('dl-json', { label: 'File Amatu Slides (.amslides)', icon: 'data_object', view: true, run: () => IO().then(m => m.exportJson()) });
def('dl-txt', { label: 'Teks biasa (.txt)', icon: 'notes', view: true, run: () => IO().then(m => m.exportText()) });
def('share', { label: 'Bagikan', icon: 'share', view: true, run: () => import('./sharing.js').then(m => m.shareDialog()) });
def('lock-set', { label: () => (E.doc?.lock ? 'Ubah kata sandi…' : 'Kunci dengan kata sandi…'), icon: 'lock', run: () => Lock.setDialog() });
def('lock-off', { label: 'Hapus kata sandi…', icon: 'lock_open', enabled: () => !!E.doc?.lock, run: () => Lock.removeDialog() });
def('lock-now', { label: 'Kunci sekarang', icon: 'lock_clock', enabled: () => !!E.doc?.lock, view: true, run: () => Lock.lockNow() });
def('page', { label: 'Penyiapan halaman (ukuran & margin)…', icon: 'aspect_ratio', run: () => D().then(m => m.pageSetupDialog()) });
def('print', { label: 'Pratinjau cetak & margin…', icon: 'print', kbd: 'Mod+P', view: true, run: () => IO().then(m => m.printDialog()) });
def('versions', { label: 'Histori versi', icon: 'history', kbd: 'Mod+Alt+Shift+H', view: true, run: () => P().then(m => m.openPanel('versions')) });
def('save-version', { label: 'Beri nama versi saat ini…', icon: 'bookmark_add', run: async () => { const n = await ask({ title: 'Beri nama versi', label: 'Nama versi', value: new Date().toLocaleString('id-ID'), ok: 'Simpan' }); if (n?.trim()) { const { addVersion } = await import('./editor.js'); await addVersion(n.trim()); toast('Versi disimpan'); } } });
def('rename', { label: 'Ganti nama', icon: 'drive_file_rename_outline', run: () => { E.ui.title.focus(); E.ui.title.select(); } });
def('trash', { label: 'Pindahkan ke sampah', icon: 'delete', run: () => E.app.trashPres() });
def('home', { label: 'Beranda Slides', icon: 'home', view: true, run: () => { location.hash = '#/'; } });

// ---------- Edit ----------
def('undo', { label: 'Urungkan', icon: 'undo', kbd: 'Mod+Z', enabled: () => Hist.can(-1), run: () => Hist.go(-1) });
def('redo', { label: 'Ulangi', icon: 'redo', kbd: 'Mod+Shift+Z', kbdAlt: 'Mod+Y', enabled: () => Hist.can(1), run: () => Hist.go(1) });
def('cut', { label: 'Potong', icon: 'content_cut', kbdShow: 'Mod+X', enabled: has, run: () => E.copy(true) });
def('copy', { label: 'Salin', icon: 'content_copy', kbdShow: 'Mod+C', enabled: has, view: true, run: () => E.copy(false).then(() => toast('Disalin')) });
def('paste', { label: 'Tempel', icon: 'content_paste', kbdShow: 'Mod+V', enabled: () => !!E.clip, run: () => E.pasteEls(E.clip) });
def('paste-plain', { label: 'Tempel tanpa format', icon: 'content_paste_go', kbdShow: 'Mod+Shift+V', run: () => { E.pastePlain = true; toast('Tekan ' + (navigator.platform.includes('Mac') ? '⌘V' : 'Ctrl+V') + ' di dalam teks'); } });
def('duplicate', { label: 'Duplikat', icon: 'library_add', kbd: 'Mod+D', enabled: has, run: () => O.duplicate() });
def('delete', { label: 'Hapus', icon: 'delete', kbd: 'Delete', kbdAlt: 'Backspace', enabled: has, run: () => E.deleteSel() });
def('selectall', { label: 'Pilih semua', icon: 'select_all', kbd: 'Mod+A', run: () => { if (E.editing) { E.selectAllText(); return; } E.select(els().filter(e => !e.hidden).map(e => e.id)); } });
def('deselect', { label: 'Batalkan pilihan', icon: 'deselect', enabled: has, run: () => E.deselect() });
def('find', { label: 'Temukan & ganti', icon: 'find_replace', kbd: 'Mod+Shift+H', kbdAlt: 'Mod+F', view: true, run: () => D().then(m => m.findDialog()) });

// ---------- View ----------
def('present', { label: 'Mulai dari awal', icon: 'slideshow', kbd: 'Mod+Shift+Enter', view: true, run: () => SH().then(m => m.startShow(0)) });
def('present-cur', { label: 'Mulai dari slide ini', icon: 'play_arrow', kbd: 'Mod+Enter', view: true, run: () => SH().then(m => m.startShow(E.cur)) });
def('presenter', { label: 'Tampilan penyaji', icon: 'co_present', view: true, run: () => SH().then(m => m.startShow(E.cur, { presenter: true })) });
def('rehearse', { label: 'Latihan pengaturan waktu', icon: 'timer', run: () => SH().then(m => m.startShow(0, { rehearse: true })) });
def('show-settings', { label: 'Pengaturan tayangan slide…', icon: 'settings_slow_motion', run: () => D().then(m => m.showSettingsDialog()) });
def('sorter', { label: 'Tampilan petak (penyortir slide)', icon: 'grid_view', kbd: 'Mod+Alt+1', view: true, checked: () => E.view.sorter, run: () => E.toggleSorter() });
def('notes', { label: 'Tampilkan catatan pembicara', icon: 'speaker_notes', view: true, checked: () => E.view.notes, run: () => { E.view.notes = Prefs.notes = !E.view.notes; savePrefs(); E.layout(); } });
def('margins', { label: 'Tampilkan garis margin', icon: 'border_outer', view: true, checked: () => E.view.margins, run: () => { E.view.margins = Prefs.margins = !E.view.margins; savePrefs(); E.drawOverlay(); } });
def('gridlines', { label: 'Tampilkan kisi', icon: 'grid_4x4', view: true, checked: () => E.view.grid, run: () => { E.view.grid = Prefs.grid = !E.view.grid; savePrefs(); E.drawOverlay(); } });
def('snapgrid', { label: 'Jepret ke kisi', icon: 'grid_goldenratio', view: true, checked: () => E.view.snapGrid, run: () => { E.view.snapGrid = Prefs.snapGrid = !E.view.snapGrid; savePrefs(); toast(E.view.snapGrid ? 'Jepret ke kisi aktif' : 'Jepret ke panduan pintar aktif'); } });
def('zoomin', { label: 'Perbesar', icon: 'zoom_in', kbd: 'Mod+Alt+=', view: true, run: () => E.zoomTo(E.zoom * 1.2) });
def('zoomout', { label: 'Perkecil', icon: 'zoom_out', kbd: 'Mod+Alt+-', view: true, run: () => E.zoomTo(E.zoom / 1.2) });
def('zoomfit', { label: 'Pas', icon: 'fit_screen', kbd: 'Mod+Alt+0', view: true, run: () => E.zoomTo('fit') });
def('master', { label: () => (E.editMaster ? 'Selesai mengedit master' : 'Edit master (elemen di semua slide)'), icon: 'dashboard_customize', checked: () => E.editMaster, run: () => E.toggleMaster() });
def('compact', { label: 'Mode kompak (sembunyikan menu)', icon: 'keyboard_arrow_up', kbd: 'Mod+Shift+F', view: true, checked: () => E.ui.top?.classList.contains('compact'), run: () => E.toggleCompact() });
def('fullscreen', { label: 'Layar penuh', icon: 'fullscreen', view: true, run: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()) });
def('ui-theme', { label: 'Tema & tampilan aplikasi…', icon: 'palette', view: true, run: () => D().then(m => m.uiThemeDialog()) });

// ---------- Insert ----------
def('img', { label: 'Unggah dari komputer', icon: 'upload', run: () => O.insertImage() });
def('img-url', { label: 'Dari URL', icon: 'link', run: () => O.insertImageUrl() });
def('img-camera', { label: 'Kamera', icon: 'photo_camera', run: () => D().then(m => m.cameraDialog()) });
def('img-replace', { label: 'Ganti gambar', icon: 'flip_camera_ios', enabled: () => typeSel('image'), run: () => O.replaceImage() });
def('textbox', { label: 'Kotak teks', icon: 'text_fields', run: () => E.setTool({ kind: 'text', make: () => ({ ...textElDefault() }) }) });
def('wordart', { label: 'WordArt', icon: 'format_shapes', run: () => O.insertWordArt(0) });
def('table', { label: 'Tabel', icon: 'table', run: () => O.insertTable(3, 3) });
def('chart-edit', { label: 'Edit data bagan…', icon: 'edit_note', enabled: () => typeSel('chart'), run: () => D().then(m => m.chartDialog(one())) });
def('icon', { label: 'Ikon…', icon: 'emoji_symbols', run: () => D().then(m => m.iconDialog()) });
def('icon-replace', { label: 'Ganti ikon…', icon: 'emoji_symbols', enabled: () => typeSel('icon'), run: () => D().then(m => m.iconDialog(one())) });
def('video', { label: 'Video…', icon: 'smart_display', run: () => D().then(m => m.videoDialog()) });
def('video-edit', { label: 'Opsi video…', icon: 'smart_display', enabled: () => typeSel('video'), run: () => D().then(m => m.videoDialog(one())) });
def('diagram', { label: 'Diagram (SmartArt)…', icon: 'account_tree', run: () => D().then(m => m.diagramDialog()) });
def('link', { label: 'Tautan', icon: 'link', kbd: 'Mod+K', run: () => O.fmt.link() });
def('comment', { label: 'Komentar', icon: 'add_comment', kbd: 'Mod+Alt+M', view: true, run: () => P().then(m => m.openPanel('comments', 'new')) });
def('newslide', { label: 'Slide baru', icon: 'add_box', kbd: 'Mod+M', run: () => O.addSlide() });
def('hf', { label: 'Header & footer (nomor slide, tanggal)…', icon: 'tag', run: () => D().then(m => m.headerFooterDialog()) });
def('special', { label: 'Karakter khusus…', icon: 'special_character', enabled: () => !!E.editing, run: () => D().then(m => m.charsDialog()) });

// ---------- Format ----------
def('bold', { label: 'Tebal', icon: 'format_bold', kbd: 'Mod+B', enabled: textSel, active: () => O.cmdState('bold'), run: () => O.fmt.bold() });
def('italic', { label: 'Miring', icon: 'format_italic', kbd: 'Mod+I', enabled: textSel, active: () => O.cmdState('italic'), run: () => O.fmt.italic() });
def('underline', { label: 'Garis bawah', icon: 'format_underlined', kbd: 'Mod+U', enabled: textSel, active: () => O.cmdState('underline'), run: () => O.fmt.underline() });
def('strike', { label: 'Coret', icon: 'strikethrough_s', kbd: 'Mod+Shift+X', enabled: textSel, run: () => O.fmt.strike() });
def('sup', { label: 'Superskrip', icon: 'superscript', kbd: 'Mod+.', enabled: textSel, run: () => O.fmt.sup() });
def('sub', { label: 'Subskrip', icon: 'subscript', kbd: 'Mod+,', enabled: textSel, run: () => O.fmt.sub() });
def('sizeup', { label: 'Perbesar ukuran font', icon: 'text_increase', kbd: 'Mod+Shift+.', enabled: textSel, run: () => O.fmt.grow(1) });
def('sizedown', { label: 'Perkecil ukuran font', icon: 'text_decrease', kbd: 'Mod+Shift+,', enabled: textSel, run: () => O.fmt.grow(-1) });
def('upper', { label: 'HURUF KAPITAL', icon: 'match_case', enabled: () => selEls().some(e => e.def || e.type === 'text'), run: () => O.fmt.upper() });
for (const [a, l, k] of [['left', 'Rata kiri', 'Mod+Shift+L'], ['center', 'Rata tengah', 'Mod+Shift+E'], ['right', 'Rata kanan', 'Mod+Shift+R'], ['justify', 'Rata kiri-kanan', 'Mod+Shift+J']])
  def('align-' + a, { label: l, icon: 'format_align_' + a, kbd: k, enabled: textSel, checked: () => O.currentAlign() === a, run: () => O.fmt.align(a) });
for (const [v, l, ic] of [['top', 'Atas', 'vertical_align_top'], ['middle', 'Tengah', 'vertical_align_center'], ['bottom', 'Bawah', 'vertical_align_bottom']])
  def('va-' + v, { label: l, icon: ic, enabled: () => selEls().some(e => e.box), checked: () => one()?.box?.va === v, run: () => O.fmt.valign(v) });
def('bullets', { label: 'Daftar berbutir', icon: 'format_list_bulleted', kbd: 'Mod+Shift+8', enabled: textSel, run: () => O.fmt.bullets() });
def('numbers', { label: 'Daftar bernomor', icon: 'format_list_numbered', kbd: 'Mod+Shift+7', enabled: textSel, run: () => O.fmt.numbers() });
def('indent', { label: 'Tambah indentasi', icon: 'format_indent_increase', kbd: 'Mod+]', enabled: textSel, run: () => O.fmt.indent() });
def('outdent', { label: 'Kurangi indentasi', icon: 'format_indent_decrease', kbd: 'Mod+[', enabled: textSel, run: () => O.fmt.outdent() });
def('clearfmt', { label: 'Hapus pemformatan', icon: 'format_clear', kbd: 'Mod+\\', enabled: textSel, run: () => O.fmt.clear() });
def('format', { label: 'Opsi format', icon: 'tune', view: true, run: () => P().then(m => m.openPanel('format')) });
def('painter', { label: 'Salin format (Format painter)', icon: 'format_paint', enabled: () => !!one(), active: () => !!E.painter, run: () => (E.painter ? E.setPainter(null) : E.setPainter(one())) });
def('eyedrop', { label: 'Pipet warna (Eyedropper)', icon: 'colorize', enabled: () => has() && 'EyeDropper' in window, run: async () => { try { const r = await new window.EyeDropper().open(); O.setProp(e => { if (e.type === 'line') e.stroke = { ...(e.stroke || { w: 2 }), c: r.sRGBHex }; else if (e.type === 'icon') e.color = r.sRGBHex; else e.fill = r.sRGBHex; }, 'Pipet warna'); } catch { /* cancelled */ } } });
def('img-reset', { label: 'Setel ulang gambar', icon: 'restart_alt', enabled: () => typeSel('image'), run: () => O.setProp(e => { delete e.ifx; delete e.crop; delete e.mask; delete e.shadow; delete e.stroke; e.rot = 0; }, 'Setel ulang gambar') });

// ---------- Slide ----------
def('dupslide', { label: 'Duplikat slide', icon: 'library_add', run: () => O.duplicateSlides() });
def('delslide', { label: 'Hapus slide', icon: 'delete', run: () => O.deleteSlides() });
def('skipslide', { label: () => (slide()?.skip ? 'Jangan lewati slide' : 'Lewati slide'), icon: 'visibility_off', run: () => O.skipSlides() });
def('slide-up', { label: 'Pindahkan slide ke atas', icon: 'arrow_upward', kbd: 'Mod+ArrowUp', run: () => O.moveSlides('up') });
def('slide-down', { label: 'Pindahkan slide ke bawah', icon: 'arrow_downward', kbd: 'Mod+ArrowDown', run: () => O.moveSlides('down') });
def('slide-start', { label: 'Pindahkan slide ke awal', icon: 'vertical_align_top', kbd: 'Mod+Shift+ArrowUp', run: () => O.moveSlides('start') });
def('slide-end', { label: 'Pindahkan slide ke akhir', icon: 'vertical_align_bottom', kbd: 'Mod+Shift+ArrowDown', run: () => O.moveSlides('end') });
def('bg', { label: 'Ubah latar belakang…', icon: 'format_color_fill', run: () => D().then(m => m.backgroundDialog()) });
def('transition', { label: 'Transisi…', icon: 'animation', run: () => P().then(m => m.openPanel('trans')) });
def('anim', { label: 'Animasi', icon: 'motion_photos_on', kbd: 'Mod+Alt+Shift+B', run: () => P().then(m => m.openPanel('anim')) });
def('theme', { label: 'Ubah tema', icon: 'palette', run: () => P().then(m => m.openPanel('theme')) });
def('section', { label: 'Tambah bagian', icon: 'segment', run: () => E.addSection() });
def('reset-slide', { label: 'Setel ulang tata letak slide', icon: 'restart_alt', run: () => O.resetSlide() });
def('design', { label: 'Ide desain (Designer)', icon: 'auto_awesome', run: () => P().then(m => m.openPanel('design')) });

// ---------- Arrange ----------
for (const [k, l, ic, kb] of [['front', 'Bawa ke depan', 'flip_to_front', 'Mod+Shift+ArrowUp'], ['forward', 'Bawa maju', 'arrow_upward', 'Mod+ArrowUp'], ['backward', 'Kirim mundur', 'arrow_downward', 'Mod+ArrowDown'], ['back', 'Kirim ke belakang', 'flip_to_back', 'Mod+Shift+ArrowDown']])
  def('z-' + k, { label: l, icon: ic, kbd: kb, enabled: has, run: () => O.zorder(k) });
for (const [k, l, ic] of [['left', 'Kiri', 'align_horizontal_left'], ['center', 'Tengah', 'align_horizontal_center'], ['right', 'Kanan', 'align_horizontal_right'], ['top', 'Atas', 'align_vertical_top'], ['middle', 'Tengah (vertikal)', 'align_vertical_center'], ['bottom', 'Bawah', 'align_vertical_bottom']])
  def('al-' + k, { label: l, icon: ic, enabled: has, run: () => O.align(k) });
def('center-h', { label: 'Tengahkan horizontal di slide', icon: 'align_horizontal_center', enabled: has, run: () => O.align('center', true) });
def('center-v', { label: 'Tengahkan vertikal di slide', icon: 'align_vertical_center', enabled: has, run: () => O.align('middle', true) });
def('dist-h', { label: 'Distribusikan horizontal', icon: 'horizontal_distribute', enabled: () => selEls().length > 2, run: () => O.distribute('h') });
def('dist-v', { label: 'Distribusikan vertikal', icon: 'vertical_distribute', enabled: () => selEls().length > 2, run: () => O.distribute('v') });
def('rot-cw', { label: 'Putar 90° searah jarum jam', icon: 'rotate_right', enabled: has, run: () => O.rotate('cw') });
def('rot-ccw', { label: 'Putar 90° berlawanan jarum jam', icon: 'rotate_left', enabled: has, run: () => O.rotate('ccw') });
def('flip-h', { label: 'Balik horizontal', icon: 'flip', enabled: has, run: () => O.rotate('h') });
def('flip-v', { label: 'Balik vertikal', icon: 'flip', enabled: has, run: () => O.rotate('v') });
def('group', { label: 'Kelompokkan', icon: 'group_work', kbd: 'Mod+Alt+G', enabled: () => selEls().length > 1, run: () => O.group() });
def('ungroup', { label: 'Pisahkan kelompok', icon: 'workspaces', kbd: 'Mod+Alt+Shift+G', enabled: () => selEls().some(e => e.group), run: () => O.ungroup() });
def('lockpos', { label: () => (selEls().length && selEls().every(e => e.locked) ? 'Buka kunci posisi' : 'Kunci posisi'), icon: 'lock', kbd: 'Mod+Shift+K', enabled: has, run: () => O.lockToggle() });
def('same-w', { label: 'Samakan lebar', icon: 'width', enabled: () => selEls().length > 1, run: () => O.sameSize('w') });
def('same-h', { label: 'Samakan tinggi', icon: 'height', enabled: () => selEls().length > 1, run: () => O.sameSize('h') });
def('selpane', { label: 'Panel seleksi', icon: 'layers', view: true, run: () => P().then(m => m.openPanel('select')) });

// ---------- Tools / Help ----------
def('spell', { label: 'Pemeriksa ejaan', icon: 'spellcheck', checked: () => E.view.spell, view: true, run: () => { E.view.spell = !E.view.spell; toast(E.view.spell ? 'Pemeriksa ejaan aktif' : 'Pemeriksa ejaan nonaktif'); } });
def('prefs', { label: 'Preferensi…', icon: 'manage_accounts', view: true, run: () => D().then(m => m.prefsDialog()) });
def('menusearch', { label: 'Telusuri menu', icon: 'search', kbd: 'Alt+/', view: true, run: () => D().then(m => m.menuSearch(MENUS)) });
def('shortcuts', { label: 'Pintasan keyboard', icon: 'keyboard', kbd: 'Mod+/', view: true, run: () => D().then(m => m.shortcutsDialog(CMD)) });
def('about', { label: 'Tentang Amatu Slides', icon: 'info', view: true, run: () => D().then(m => m.aboutDialog()) });
def('tbl-row-above', { label: 'Sisipkan baris di atas', icon: 'add_row_above', enabled: () => typeSel('table'), run: () => O.tbl.op('row-above') });
def('tbl-row-below', { label: 'Sisipkan baris di bawah', icon: 'add_row_below', enabled: () => typeSel('table'), run: () => O.tbl.op('row-below') });
def('tbl-col-left', { label: 'Sisipkan kolom di kiri', icon: 'add_column_left', enabled: () => typeSel('table'), run: () => O.tbl.op('col-left') });
def('tbl-col-right', { label: 'Sisipkan kolom di kanan', icon: 'add_column_right', enabled: () => typeSel('table'), run: () => O.tbl.op('col-right') });
def('tbl-del-row', { label: 'Hapus baris', icon: 'delete_sweep', enabled: () => typeSel('table'), run: () => O.tbl.op('del-row') });
def('tbl-del-col', { label: 'Hapus kolom', icon: 'delete_sweep', enabled: () => typeSel('table'), run: () => O.tbl.op('del-col') });
def('tbl-eq', { label: 'Ratakan lebar kolom', icon: 'view_column', enabled: () => typeSel('table'), run: () => O.tbl.op('eq-cols') });

const textElDefault = () => textEl({ w: 360, h: 54, box: { va: 'top', pad: [8, 10, 8, 10], fit: 'grow', cols: 1 }, def: { size: 18 } });

// ---------- sub-menu builders ----------
const C = id => {
  const c = CMD[id];
  return { label: typeof c.label === 'function' ? c.label() : c.label, icon: c.icon, kbd: c.kbd || c.kbdShow, enabled: c.enabled, checked: c.checked, run: () => run(id) };
};
export const layoutItems = (apply = true) => LAYOUTS.map(([id, name]) => ({ label: name, icon: LAYOUT_IC[id], checked: apply ? () => slide()?.layout === id : null, run: () => (apply ? O.setLayout(id) : O.addSlide(id)) }));
export const LAYOUT_IC = { title: 'title', section: 'segment', 'title-body': 'subject', two: 'view_column', compare: 'compare', 'title-only': 'title', caption: 'view_sidebar', 'main-point': 'format_quote', 'big-number': 'looks_one', picture: 'image', blank: 'crop_landscape' };
export const shapeItems = () => [{ el: () => h('div', { class: 'shape-grid' }, SHAPES.map(([k, l]) => h('button', { class: 'ib', 'data-tip': l, onclick: () => { closeMenus(0); E.setTool({ kind: 'shape', make: () => shapeOf(k) }); } }, shapeIcon(k)))) }];
export const lineItems = () => [['line', 'Garis', 'horizontal_rule'], ['arrow', 'Panah', 'arrow_right_alt'], ['dline', 'Panah dua arah', 'swap_horiz'], ['elbow', 'Konektor siku', 'turn_right'], ['curve', 'Kurva', 'gesture']].map(([k, l, ic]) => ({ label: l, icon: ic, run: () => E.setTool({ kind: 'line', make: () => shapeOf(k) }) }));
const shapeOf = k => shapeEl(k);
export function shapeIcon(k) {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '-2 -2 28 28'); s.setAttribute('width', 20); s.setAttribute('height', 20);
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', shapePath(k, 24, 24));
  p.setAttribute('style', 'fill:none;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round');
  s.append(p);
  return s;
}
export const tableItems = () => [{ el: () => tableGrid() }];
function tableGrid() {
  const N = 10;
  const lbl = h('div', { class: 'tgrid-l' }, '1 × 1');
  const g = h('div', { class: 'tgrid', style: { gridTemplateColumns: `repeat(${N}, 18px)` } });
  const cells = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < N; c++) {
    const i = h('i');
    i.onmouseenter = () => { cells.forEach(x => x.el.classList.toggle('on', x.r <= r && x.c <= c)); lbl.textContent = `${c + 1} × ${r + 1}`; };
    i.onclick = () => { closeMenus(0); O.insertTable(r + 1, c + 1); };
    cells.push({ el: i, r, c });
    g.append(i);
  }
  return h('div', { style: { padding: '6px 8px' } }, g, lbl);
}
export const chartItems = () => CHART_TYPES.map(([k, l, ic]) => ({ label: l, icon: ic, run: () => O.insertChart(k) }));
export const wordartItems = () => [{ el: () => h('div', { class: 'wa-grid' }, O.WORDART.map(([n], i) => h('button', { class: 'wa wa' + i, onclick: () => { closeMenus(0); O.insertWordArt(i); } }, n))) }];
export const fontItems = () => {
  const recent = Prefs.recentFonts.filter(n => FONTS.some(f => f.n === n)).slice(0, 5);
  const it = n => ({ label: n, style: { fontFamily: FONTS.find(f => f.n === n)?.css }, checked: () => O.currentFont() === n, run: () => { Prefs.recentFonts = [n, ...Prefs.recentFonts.filter(x => x !== n)].slice(0, 8); savePrefs(); O.fmt.font(n); } });
  import('./fonts.js').then(m => m.ensureAllFonts());
  return [{ label: 'Font tema: judul (' + E.doc.theme.f.head + ')', icon: 'title', run: () => O.withText(() => { document.execCommand('styleWithCSS', false, true); document.execCommand('fontName', false, 'var(--t-fh)'); }, d => { d.font = 'head'; }, 'Font') },
    { label: 'Font tema: isi (' + E.doc.theme.f.body + ')', icon: 'notes', run: () => O.withText(() => { document.execCommand('styleWithCSS', false, true); document.execCommand('fontName', false, 'var(--t-fb)'); }, d => { d.font = 'body'; }, 'Font') },
    { sep: true }, ...(recent.length ? [{ head: 'Terbaru' }, ...recent.map(it), { sep: true }] : []), ...FONTS.map(f => it(f.n))];
};
export const SIZES_PT = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 72, 96, 120];
export const spacingItems = () => [
  ...[['1', 'Tunggal'], ['1.15', '1,15'], ['1.5', '1,5'], ['2', 'Ganda']].map(([v, l]) => ({ label: l, run: () => O.fmt.lineHeight(v) })),
  { sep: true },
  { label: 'Tambah spasi sebelum paragraf', icon: 'vertical_align_top', run: () => O.fmt.paraSpace(12, null) },
  { label: 'Tambah spasi setelah paragraf', icon: 'vertical_align_bottom', run: () => O.fmt.paraSpace(null, 12) },
  { label: 'Hapus spasi paragraf', icon: 'remove', run: () => O.fmt.paraSpace(0, 0) },
  { sep: true },
  { label: 'Spasi kustom…', icon: 'tune', run: async () => { const v = await ask({ title: 'Spasi baris kustom', label: 'Spasi baris (mis. 1,3)', value: '1.2', ok: 'Terapkan' }); const n = parseFloat(String(v || '').replace(',', '.')); if (n > 0) O.fmt.lineHeight(String(n)); } },
];
export const bulletStyles = () => [['disc', '● Bulat'], ['circle', '○ Lingkaran'], ['square', '■ Kotak'], ['"✓  "', '✓ Centang'], ['"➤  "', '➤ Panah'], ['"–  "', '– Tanda hubung'], ['"★  "', '★ Bintang']].map(([v, l]) => ({ label: l, run: () => O.fmt.bullets(v) }));
export const numberStyles = () => [['decimal', '1. 2. 3.'], ['lower-alpha', 'a. b. c.'], ['upper-alpha', 'A. B. C.'], ['lower-roman', 'i. ii. iii.'], ['upper-roman', 'I. II. III.']].map(([v, l]) => ({ label: l, run: () => O.fmt.numbers(v) }));
export const colorMenu = (value, onPick, reset) => [{ el: () => palette({ value, reset, onPick: c => { closeMenus(0); onPick(c); } }) }, { el: () => themeSwatches(onPick) }];
export function themeSwatches(onPick) {
  const c = E.doc.theme.c;
  return h('div', { class: 'pal-theme' }, h('div', { class: 'pal-lbl' }, 'Warna tema'),
    h('div', { class: 'pal-row' }, ['bg', 'bg2', 'tx', 'tx2', 'title', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map(k => h('button', { class: 'pal-sw', style: { background: c[k] }, title: k, onclick: () => { closeMenus(0); onPick('@' + k); } }))));
}
export const weightItems = (cb) => [0.5, 1, 2, 3, 4, 6, 8, 12].map(w => ({ label: h('span', { class: 'wline', style: { borderTopWidth: w + 'px' } }), desc: null, cls: 'wl', run: () => cb(w) }));
export const dashItems = cb => [['solid', 'Garis'], ['dash', 'Putus-putus'], ['dot', 'Titik-titik'], ['dashdot', 'Putus titik'], ['long', 'Putus panjang']].map(([k, l]) => ({ label: l, run: () => cb(k) }));
export const headItems = (end) => [[null, 'Tidak ada'], ['arrow', 'Panah'], ['open', 'Panah terbuka'], ['dot', 'Bulatan']].map(([k, l]) => ({ label: l, checked: () => (one()?.[end] || null) === k, run: () => O.setProp(e => { if (e.type === 'line') e[end] = k; }, 'Ujung garis') }));
export const maskItems = () => [['rect', 'Persegi panjang'], ['round', 'Sudut bulat'], ['ellipse', 'Elips'], ['triangle', 'Segitiga'], ['diamond', 'Belah ketupat'], ['hexagon', 'Segi enam'], ['star5', 'Bintang'], ['heart', 'Hati'], ['callout', 'Balon teks'], ['arrowR', 'Panah']].map(([k, l]) => ({ label: l, icon: null, el: null, run: () => O.setProp(e => { if (e.type === 'image') { if (k === 'rect') delete e.mask; else e.mask = k; } }, 'Masker gambar') }));
export const zoomItems = () => [{ label: 'Pas', checked: () => E.fit, run: () => E.zoomTo('fit') }, { sep: true }, ...[50, 75, 100, 125, 150, 200].map(z => ({ label: z + '%', checked: () => !E.fit && Math.round(E.zoom * 100) === z, run: () => E.zoomTo(z / 100) }))];
export const themeItems = () => THEMES.map(t => ({ label: t.name, checked: () => E.doc.theme.id === t.id, run: () => O.applyTheme(t) }));
export const sizeItems = () => SIZES.map(([k, l]) => ({ label: l, checked: () => E.doc.page.size === k, run: () => D().then(m => m.pageSetupDialog(k)) }));

// ---------- menu bar ----------
const sub = (label, icon, items) => ({ label, icon, sub: items });
export const MENUS = [
  { label: 'File', items: () => [C('new'), C('open'), C('copy-pres'), C('import-pptx'), { sep: true }, C('share'),
    sub('Download', 'download', () => ['dl-pptx', 'dl-pdf', 'dl-png', 'dl-jpg', 'dl-png-all', 'dl-json', 'dl-txt'].map(C)),
    { sep: true }, sub('Kata sandi file', 'lock', () => [C('lock-set'), C('lock-off'), C('lock-now')]), C('page'),
    sub('Histori versi', 'history', () => [C('versions'), C('save-version')]), { sep: true }, C('rename'), C('trash'), { sep: true }, C('print')] },
  { label: 'Edit', items: () => [C('undo'), C('redo'), { sep: true }, C('cut'), C('copy'), C('paste'), C('paste-plain'), { sep: true }, C('duplicate'), C('delete'), C('selectall'), C('deselect'), { sep: true }, C('find')] },
  { label: 'Tampilan', items: () => [sub('Tayangan slide', 'slideshow', () => [C('present'), C('present-cur'), C('presenter'), C('rehearse'), C('show-settings')]), C('anim'), { sep: true }, C('sorter'), C('notes'), C('master'), { sep: true }, C('margins'), C('gridlines'), C('snapgrid'), { sep: true }, sub('Zoom', 'zoom_in', () => [C('zoomin'), C('zoomout'), C('zoomfit')]), C('compact'), C('fullscreen'), C('ui-theme')] },
  { label: 'Sisipkan', items: () => [sub('Gambar', 'image', () => [C('img'), C('img-url'), C('img-camera')]), C('textbox'), sub('WordArt', 'format_shapes', wordartItems), sub('Bentuk', 'category', shapeItems), sub('Garis', 'show_chart', lineItems), sub('Tabel', 'table', tableItems), sub('Bagan', 'bar_chart', chartItems), C('diagram'), C('icon'), C('video'), { sep: true }, C('anim'), C('link'), C('comment'), C('special'), { sep: true }, C('newslide'), C('hf')] },
  { label: 'Format', items: () => [sub('Teks', 'format_bold', () => ['bold', 'italic', 'underline', 'strike', 'sup', 'sub', 'sizeup', 'sizedown', 'upper'].map(C)), sub('Perataan & indentasi', 'format_align_left', () => ['align-left', 'align-center', 'align-right', 'align-justify', null, 'va-top', 'va-middle', 'va-bottom', null, 'indent', 'outdent'].map(x => (x ? C(x) : { sep: true }))), sub('Spasi baris & paragraf', 'format_line_spacing', spacingItems),
    sub('Butir & penomoran', 'format_list_bulleted', () => [C('bullets'), sub('Gaya butir', 'list', bulletStyles), C('numbers'), sub('Gaya penomoran', 'format_list_numbered', numberStyles)]), sub('Kolom teks', 'view_column', () => [1, 2, 3].map(n => ({ label: n + ' kolom', checked: () => (one()?.box?.cols || 1) === n, enabled: () => selEls().some(e => e.box), run: () => O.fmt.cols(n) }))),
    { sep: true }, C('clearfmt'), C('painter'), C('eyedrop'), { sep: true }, sub('Gambar', 'image', () => [C('img-replace'), sub('Masker bentuk', 'interests', maskItems), C('img-reset')]), sub('Tabel', 'table', () => ['tbl-row-above', 'tbl-row-below', 'tbl-col-left', 'tbl-col-right', 'tbl-del-row', 'tbl-del-col', 'tbl-eq'].map(C)), { sep: true }, C('format')] },
  { label: 'Slide', items: () => [C('newslide'), C('dupslide'), C('delslide'), C('skipslide'), sub('Pindahkan', 'swap_vert', () => ['slide-start', 'slide-up', 'slide-down', 'slide-end'].map(C)), { sep: true }, C('bg'), sub('Terapkan tata letak', 'dashboard', () => layoutItems(true)), C('reset-slide'), C('transition'), C('theme'), C('design'), { sep: true }, C('section'), C('hf'), C('master')] },
  { label: 'Susun', items: () => [sub('Urutan', 'layers', () => ['z-front', 'z-forward', 'z-backward', 'z-back'].map(C)), sub('Ratakan', 'align_horizontal_left', () => [C('al-left'), C('al-center'), C('al-right'), { sep: true }, C('al-top'), C('al-middle'), C('al-bottom')]), sub('Distribusikan', 'horizontal_distribute', () => [C('dist-h'), C('dist-v')]), sub('Tengahkan di slide', 'center_focus_strong', () => [C('center-h'), C('center-v')]), sub('Putar', 'rotate_right', () => ['rot-cw', 'rot-ccw', 'flip-h', 'flip-v'].map(C)), sub('Ukuran', 'straighten', () => [C('same-w'), C('same-h')]), { sep: true }, C('group'), C('ungroup'), C('lockpos'), { sep: true }, C('selpane')] },
  { label: 'Alat', items: () => [C('spell'), C('design'), C('rehearse'), C('selpane'), C('find'), { sep: true }, C('prefs')] },
  { label: 'Bantuan', items: () => [C('menusearch'), C('shortcuts'), C('about')] },
];

// ---------- keyboard ----------
const KEYMAP = new Map();
for (const [id, c] of Object.entries(CMD)) { if (c.kbd) KEYMAP.set(c.kbd, id); if (c.kbdAlt) KEYMAP.set(c.kbdAlt, id); }
KEYMAP.set('Mod+Shift+V', 'paste-plain');
KEYMAP.set('F5', 'present');
KEYMAP.set('Shift+F5', 'present-cur');
// Keys that keep their meaning while text is being edited.
const TEXT_OK = new Set(['bold', 'italic', 'underline', 'strike', 'sup', 'sub', 'sizeup', 'sizedown', 'align-left', 'align-center', 'align-right', 'align-justify', 'bullets', 'numbers', 'indent', 'outdent', 'clearfmt', 'link', 'undo', 'redo', 'comment', 'find', 'present', 'present-cur', 'menusearch', 'newslide', 'selectall']);
// Slide-reorder keys apply in the filmstrip; elsewhere Mod+Arrow changes stacking order.
E.runKey = (k, ev, editing) => {
  let id = KEYMAP.get(k);
  if (!id) return false;
  if (k === 'Mod+Shift+V') { E.pastePlain = true; return false; }
  if (editing && !TEXT_OK.has(id)) return false;
  if (editing && (id === 'undo' || id === 'redo')) { E.syncEditing(); E.endEdit(); }
  const inStrip = ev.target.closest?.('.strip, .sorter');
  if (/^Mod\+(Shift\+)?Arrow(Up|Down)$/.test(k)) id = inStrip || !selEls().length ? { 'Mod+ArrowUp': 'slide-up', 'Mod+ArrowDown': 'slide-down', 'Mod+Shift+ArrowUp': 'slide-start', 'Mod+Shift+ArrowDown': 'slide-end' }[k] : { 'Mod+ArrowUp': 'z-forward', 'Mod+ArrowDown': 'z-backward', 'Mod+Shift+ArrowUp': 'z-front', 'Mod+Shift+ArrowDown': 'z-back' }[k];
  if ((k === 'Delete' || k === 'Backspace') && inStrip) { run('delslide'); return true; }
  if (k === 'Mod+D' && inStrip) { run('dupslide'); return true; }
  if (k === 'Mod+A' && inStrip) { E.stripSel = new Set(E.doc.slides.map(s => s.id)); E.markStrip?.(); return true; }
  if ((k === 'Delete' || k === 'Backspace') && !selEls().length) return false;
  run(id);
  return true;
};
export { O, confirmDlg, thumb };
