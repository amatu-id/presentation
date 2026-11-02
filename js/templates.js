// Template gallery: ready-made decks built from layouts + theme (every text stays editable).
import { newPres, newSlide, cloneTheme, themeById, paras, shapeEl, textEl, frame, BOX } from './model.js';
import { uid } from './ui.js';

const P = s => `<p>${s}</p>`;
const L = (...items) => `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
function deck(theme, build) {
  return () => {
    const p = newPres({ theme: cloneTheme(themeById(theme)) });
    p.slides = [];
    const add = (layout, fill = {}, extra) => { const s = newSlide(p, layout, fill); if (extra) extra(s, frame(p), p); p.slides.push(s); return s; };
    build(add, p);
    return p;
  };
}
const chart = (type, data, f, o = {}) => ({ id: uid(8), type: 'chart', x: o.x ?? f.l, y: o.y ?? f.t + 96, w: o.w ?? f.W, h: o.h ?? f.H - 96, rot: 0, chart: { type, data, legend: true, labels: o.labels ?? false, title: o.title || '' } });
const table = (rows, f, o = {}) => ({ id: uid(8), type: 'table', x: o.x ?? f.l, y: o.y ?? f.t + 100, w: o.w ?? f.W, h: o.h ?? rows.length * 40, rot: 0, rows: rows.map(r => r.map(c => ({ html: c ? `<p>${c}</p>` : '' }))), colW: rows[0].map(() => 1 / rows[0].length), tstyle: { head: true, band: true, c: '@a1' }, def: { size: 14 } });
const card = (f, i, n, title, text, icon) => {
  const gap = 18, w = (f.W - gap * (n - 1)) / n, x = f.l + i * (w + gap), y = f.t + 110, hh = f.H - 110;
  return [
    shapeEl('round', { x, y, w, h: hh, fill: '@bg2', adj: { r: .08 }, html: '', name: 'Kartu ' + (i + 1) }),
    { id: uid(8), type: 'icon', name: icon, x: x + 20, y: y + 20, w: 44, h: 44, rot: 0, color: '@a' + ((i % 6) + 1) },
    textEl({ x: x + 14, y: y + 74, w: w - 28, h: 40, html: P(title), def: { size: 18, bold: true, font: 'head', color: '@title' }, box: BOX() }),
    textEl({ x: x + 14, y: y + 116, w: w - 28, h: hh - 130, html: P(text), def: { size: 13, color: '@tx2' }, box: BOX() }),
  ];
};

export const TEMPLATES = [
  { id: 'blank', name: 'Presentasi kosong', make: () => newPres() },
  { id: 'pitch', cat: 'Bisnis', name: 'Pitch deck startup', sub: 'Momentum', make: deck('momentum', add => {
    add('title', { title: P('Nama Startup'), subtitle: P('Solusi sederhana untuk masalah besar · Pitch 2026') });
    add('title-body', { title: P('Masalah'), body: L('Pelanggan kesulitan menemukan …', 'Proses saat ini lambat & mahal', 'Belum ada solusi yang terjangkau') });
    add('title-only', { title: P('Solusi kami') }, (s, f) => s.els.push(...card(f, 0, 3, 'Cepat', 'Selesai dalam hitungan menit, bukan hari.', 'bolt'), ...card(f, 1, 3, 'Hemat', 'Biaya 60% lebih rendah dari cara lama.', 'savings'), ...card(f, 2, 3, 'Mudah', 'Tanpa pelatihan, langsung dari ponsel.', 'touch_app')));
    add('big-number', { title: P('Rp 2,4 T'), body: P('Ukuran pasar yang dapat dijangkau di Indonesia') });
    add('title-only', { title: P('Pertumbuhan pengguna') }, (s, f) => s.els.push(chart('col', [['', 'Pengguna aktif'], ['Q1', 1200], ['Q2', 2600], ['Q3', 5100], ['Q4', 9800]], f, { labels: true })));
    add('two', { title: P('Model bisnis'), body: L('Langganan bulanan', 'Biaya transaksi 2%'), body2: L('Paket perusahaan', 'Kemitraan distribusi') });
    add('section', { title: P('Terima kasih'), subtitle: P('nama@startup.id · 0812-0000-0000') });
  }) },
  { id: 'proyek', cat: 'Bisnis', name: 'Laporan progres proyek', sub: 'Konstruksi', make: deck('konstruksi', add => {
    add('title', { title: P('Laporan Progres Proyek'), subtitle: P('Pembangunan Gedung · Minggu ke-12') });
    add('title-body', { title: P('Ringkasan'), body: L('Progres fisik 46,2% (rencana 44,0%)', 'Pekerjaan struktur lantai 3 selesai', 'Material besi & beton tersedia untuk 2 minggu', 'Tidak ada kecelakaan kerja') });
    add('title-only', { title: P('Kurva S: rencana vs realisasi') }, (s, f) => s.els.push(chart('line', [['', 'Rencana', 'Realisasi'], ['M2', 4, 3], ['M4', 10, 9], ['M6', 18, 17], ['M8', 27, 26], ['M10', 36, 37], ['M12', 44, 46.2]], f, { labels: false })));
    add('title-only', { title: P('Status pekerjaan') }, (s, f) => s.els.push(table([['Pekerjaan', 'Bobot', 'Progres', 'Status'], ['Persiapan', '5%', '100%', 'Selesai'], ['Struktur', '40%', '72%', 'Berjalan'], ['Arsitektur', '35%', '18%', 'Berjalan'], ['MEP', '20%', '6%', 'Mulai']], f)));
    add('compare', { title: P('Kendala & tindak lanjut'), head: P('Kendala'), head2: P('Tindak lanjut'), body: L('Hujan 3 hari', 'Keterlambatan pengiriman bekisting'), body2: L('Tambah shift malam', 'Pemasok cadangan disiapkan') });
    add('title-body', { title: P('Rencana minggu depan'), body: L('Pengecoran pelat lantai 4', 'Pemasangan dinding bata lantai 2', 'Uji tekan beton sampel minggu 11') });
    add('section', { title: P('Terima kasih'), subtitle: P('Tim Pelaksana Proyek') });
  }) },
  { id: 'rapat', cat: 'Bisnis', name: 'Rapat mingguan', sub: 'Sederhana Terang', make: deck('sederhana', add => {
    add('title', { title: P('Rapat Mingguan Tim'), subtitle: P('Senin, 09.00 · Ruang Rapat 2') });
    add('title-body', { title: P('Agenda'), body: L('Pembaruan dari setiap divisi', 'Angka minggu ini', 'Keputusan & tugas', 'Lain-lain') });
    add('title-only', { title: P('Angka minggu ini') }, (s, f) => s.els.push(chart('bar', [['', 'Minggu lalu', 'Minggu ini'], ['Penjualan', 82, 95], ['Prospek', 40, 52], ['Keluhan', 9, 5]], f, { labels: true })));
    add('title-only', { title: P('Tugas & penanggung jawab') }, (s, f) => s.els.push(table([['Tugas', 'PIC', 'Tenggat', 'Status'], ['Proposal klien A', 'Rina', 'Rabu', 'Berjalan'], ['Rekap stok', 'Budi', 'Kamis', 'Belum'], ['Laporan pajak', 'Sari', 'Jumat', 'Selesai']], f)));
    add('main-point', { title: P('Fokus minggu ini: tutup 3 kontrak baru') });
  }) },
  { id: 'kuliah', cat: 'Pendidikan', name: 'Materi kuliah / pelatihan', sub: 'Fokus', make: deck('fokus', add => {
    add('title', { title: P('Judul Materi'), subtitle: P('Pertemuan 1 · Nama Pengajar') });
    add('title-body', { title: P('Tujuan pembelajaran'), body: L('Memahami konsep dasar …', 'Mampu menerapkan … pada studi kasus', 'Menilai kelebihan & kekurangan …') });
    add('section', { title: P('Bagian 1: Konsep dasar'), subtitle: P('Definisi, sejarah, dan istilah penting') });
    add('two', { title: P('Definisi & contoh'), body: P('Definisi singkat konsep yang dibahas dalam satu atau dua kalimat.'), body2: L('Contoh 1', 'Contoh 2', 'Contoh 3') });
    add('main-point', { title: P('"Kutipan atau ide utama yang ingin diingat peserta."') });
    add('title-body', { title: P('Kuis singkat'), body: `<ol><li>Pertanyaan pertama?</li><li>Pertanyaan kedua?</li><li>Pertanyaan ketiga?</li></ol>` });
    add('title-body', { title: P('Rangkuman'), body: L('Poin penting 1', 'Poin penting 2', 'Bacaan lanjutan: …') });
  }) },
  { id: 'keuangan', cat: 'Bisnis', name: 'Laporan keuangan', sub: 'Arus', make: deck('arus', add => {
    add('title', { title: P('Laporan Keuangan Triwulan'), subtitle: P('Q3 2026 · Divisi Keuangan') });
    add('title-only', { title: P('Pendapatan vs beban') }, (s, f) => s.els.push(chart('col', [['', 'Pendapatan', 'Beban'], ['Jul', 420, 310], ['Agu', 465, 330], ['Sep', 510, 352]], f, { labels: true })));
    add('title-only', { title: P('Komposisi beban') }, (s, f) => s.els.push(chart('donut', [['', 'Beban'], ['Gaji', 45], ['Operasional', 25], ['Pemasaran', 18], ['Lainnya', 12]], f, { labels: true })));
    add('title-only', { title: P('Ringkasan laba rugi (juta Rp)') }, (s, f) => s.els.push(table([['Pos', 'Juli', 'Agustus', 'September'], ['Pendapatan', '420', '465', '510'], ['Beban', '310', '330', '352'], ['Laba bersih', '110', '135', '158']], f)));
    add('big-number', { title: P('+43,6%'), body: P('Kenaikan laba bersih dibanding triwulan lalu') });
  }) },
  { id: 'portofolio', cat: 'Kreatif', name: 'Portofolio', sub: 'Pergeseran', make: deck('pergeseran', add => {
    add('title', { title: P('Portofolio'), subtitle: P('Nama Anda · Desainer & Pengembang') });
    add('picture', { title: P('Proyek 1'), body: P('Deskripsi singkat proyek, peran Anda, dan hasilnya.') });
    add('picture', { title: P('Proyek 2'), body: P('Tantangan, proses, dan dampak yang dicapai.') });
    add('title-only', { title: P('Keahlian') }, (s, f) => s.els.push(...card(f, 0, 3, 'Desain', 'UI/UX, identitas visual, ilustrasi.', 'palette'), ...card(f, 1, 3, 'Kode', 'Web app, otomasi, data.', 'code'), ...card(f, 2, 3, 'Strategi', 'Riset pengguna & produk.', 'insights')));
    add('section', { title: P('Mari bekerja sama'), subtitle: P('email@anda.com') });
  }) },
  { id: 'acara', cat: 'Kreatif', name: 'Proposal acara', sub: 'Koral', make: deck('koral', add => {
    add('title', { title: P('Festival Komunitas 2026'), subtitle: P('Proposal kerja sama sponsor') });
    add('title-body', { title: P('Tentang acara'), body: L('3 hari · 5.000 pengunjung', '40 tenant UMKM', 'Panggung musik & lomba') });
    add('title-only', { title: P('Paket sponsor') }, (s, f) => s.els.push(table([['Paket', 'Nilai', 'Benefit'], ['Platinum', 'Rp 50 jt', 'Logo utama, booth besar, 5 sesi panggung'], ['Gold', 'Rp 25 jt', 'Logo, booth sedang, 2 sesi'], ['Silver', 'Rp 10 jt', 'Logo di banner']], f)));
    add('main-point', { title: P('Bersama membangun komunitas yang kreatif & produktif') });
  }) },
  { id: 'produk', cat: 'Kreatif', name: 'Peluncuran produk', sub: 'Liquid Glass', make: deck('liquid', add => {
    add('title', { title: P('Produk Baru'), subtitle: P('Lebih ringan. Lebih cepat. Lebih pintar.') });
    add('title-only', { title: P('Fitur utama') }, (s, f) => s.els.push(...card(f, 0, 3, 'Baterai 2 hari', 'Hemat daya dengan chip baru.', 'battery_charging_full'), ...card(f, 1, 3, 'Layar terang', '2000 nit untuk di luar ruangan.', 'sunny'), ...card(f, 2, 3, 'Aman', 'Enkripsi di perangkat.', 'shield')));
    add('big-number', { title: P('Rp 4,99 jt'), body: P('Tersedia mulai 1 Desember') });
    add('section', { title: P('Pesan sekarang'), subtitle: P('produk.id') });
  }) },
  { id: 'gelap', cat: 'Dasar', name: 'Sederhana gelap', sub: 'Sederhana Gelap', make: deck('gelap', add => { add('title', { title: P('Judul presentasi'), subtitle: P('Subjudul') }); add('title-body', {}); }) },
  { id: 'swiss', cat: 'Dasar', name: 'Swiss minimal', sub: 'Swiss', make: deck('swiss', add => { add('title', { title: P('Judul presentasi'), subtitle: P('Subjudul') }); add('title-body', {}); }) },
  { id: 'eksekutif', cat: 'Dasar', name: 'Eksekutif', sub: 'Eksekutif', make: deck('eksekutif', add => { add('title', { title: P('Rencana Strategis'), subtitle: P('Rapat Direksi 2026') }); add('title-body', {}); }) },
  { id: 'mint', cat: 'Dasar', name: 'Mint segar', sub: 'Mint', make: deck('mint', add => { add('title', { title: P('Judul presentasi'), subtitle: P('Subjudul') }); add('title-body', {}); }) },
];
export { paras };
