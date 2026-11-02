// Theme: light/dark/system, accent, glass material, background, paper mode.

const KEY = 'aslides.ui';
const DEF = { mode: 'system', accent: 'blue', glass: 'liquid', bg: 'aurora', paperDark: false };
const mq = matchMedia('(prefers-color-scheme: dark)');

export const ACCENTS = [
  ['blue', 'Biru', '#1a73e8'], ['indigo', 'Nila', '#4f46e5'], ['violet', 'Ungu', '#7c3aed'], ['pink', 'Merah muda', '#d6336c'],
  ['red', 'Merah', '#d93025'], ['orange', 'Jingga', '#e8710a'], ['green', 'Hijau', '#188038'], ['teal', 'Toska', '#0d8a7f'], ['graphite', 'Grafit', '#4b5563'],
];

export const Theme = {
  p: (() => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEF }; } })(),
  get dark() { return this.p.mode === 'dark' || (this.p.mode === 'system' && mq.matches); },
  set(patch) {
    Object.assign(this.p, patch);
    try { localStorage.setItem(KEY, JSON.stringify(this.p)); } catch {}
    this.apply();
  },
  apply() {
    const r = document.documentElement;
    r.dataset.theme = this.dark ? 'dark' : 'light';
    r.dataset.accent = this.p.accent;
    r.dataset.glass = this.p.glass;
    r.dataset.bg = this.p.bg;
    r.classList.toggle('paper-dark', !!this.p.paperDark && this.dark);
    r.classList.toggle('can-refract', !!window.chrome);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', this.dark ? '#0c0f14' : '#eef2f7');
  },
};
mq.addEventListener?.('change', () => Theme.apply());

// Liquid-glass refraction: a displacement map that bends the backdrop near the panel edges.
export function installRefraction() {
  if (document.getElementById('lg-refract')) return;
  const N = 128, c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d'), img = x.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / (N - 1) * 2 - 1, v = j / (N - 1) * 2 - 1;
    const ex = Math.max(0, (Math.abs(u) - .86) / .14), ey = Math.max(0, (Math.abs(v) - .55) / .45);
    const dx = -Math.sign(u) * ex * ex, dy = -Math.sign(v) * ey * ey;
    const k = (j * N + i) * 4;
    img.data[k] = 128 + dx * 120; img.data[k + 1] = 128 + dy * 120; img.data[k + 2] = 128; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.innerHTML = `<filter id="lg-refract" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feImage href="${c.toDataURL()}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="26" xChannelSelector="R" yChannelSelector="G"/></filter>`;
  document.body.append(svg);
}
