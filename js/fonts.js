// Font catalogue. Web-safe fonts use local stacks; others load lazily from Google Fonts.

export const FONTS = [
  { n: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { n: 'Calibri', css: 'Calibri, Carlito, "Segoe UI", sans-serif' },
  { n: 'Cambria', css: 'Cambria, Caladea, Georgia, serif' },
  { n: 'Comic Sans MS', css: '"Comic Sans MS", "Comic Neue", cursive' },
  { n: 'Courier New', css: '"Courier New", Courier, monospace' },
  { n: 'Garamond', css: 'Garamond, "EB Garamond", serif' },
  { n: 'Georgia', css: 'Georgia, serif' },
  { n: 'Helvetica', css: 'Helvetica, Arial, sans-serif' },
  { n: 'Tahoma', css: 'Tahoma, Verdana, sans-serif' },
  { n: 'Times New Roman', css: '"Times New Roman", Times, serif' },
  { n: 'Trebuchet MS', css: '"Trebuchet MS", sans-serif' },
  { n: 'Verdana', css: 'Verdana, sans-serif' },
  { n: 'Amatic SC', g: 'wght@400;700', css: '"Amatic SC", cursive' },
  { n: 'Caveat', g: 'wght@400;700', css: 'Caveat, cursive' },
  { n: 'Comfortaa', g: 'wght@400;700', css: 'Comfortaa, sans-serif' },
  { n: 'Dancing Script', g: 'wght@400;700', css: '"Dancing Script", cursive' },
  { n: 'EB Garamond', g: 'ital,wght@0,400;0,700;1,400;1,700', css: '"EB Garamond", serif' },
  { n: 'Inter', g: 'wght@400;700', css: 'Inter, sans-serif' },
  { n: 'Lato', g: 'ital,wght@0,400;0,700;1,400;1,700', css: 'Lato, sans-serif' },
  { n: 'Libre Baskerville', g: 'wght@400;700', css: '"Libre Baskerville", serif' },
  { n: 'Lobster', g: 'wght@400', css: 'Lobster, cursive' },
  { n: 'Lora', g: 'ital,wght@0,400;0,700;1,400;1,700', css: 'Lora, serif' },
  { n: 'Merriweather', g: 'ital,wght@0,400;0,700;1,400;1,700', css: 'Merriweather, serif' },
  { n: 'Montserrat', g: 'ital,wght@0,400;0,700;1,400;1,700', css: 'Montserrat, sans-serif' },
  { n: 'Nunito', g: 'ital,wght@0,400;0,700;1,400;1,700', css: 'Nunito, sans-serif' },
  { n: 'Open Sans', g: 'ital,wght@0,400;0,700;1,400;1,700', css: '"Open Sans", sans-serif' },
  { n: 'Oswald', g: 'wght@400;700', css: 'Oswald, sans-serif' },
  { n: 'Pacifico', g: 'wght@400', css: 'Pacifico, cursive' },
  { n: 'Playfair Display', g: 'ital,wght@0,400;0,700;1,400;1,700', css: '"Playfair Display", serif' },
  { n: 'Poppins', g: 'ital,wght@0,400;0,700;1,400;1,700', css: 'Poppins, sans-serif' },
  { n: 'PT Serif', g: 'ital,wght@0,400;0,700;1,400;1,700', css: '"PT Serif", serif' },
  { n: 'Raleway', g: 'ital,wght@0,400;0,700;1,400;1,700', css: 'Raleway, sans-serif' },
  { n: 'Roboto', g: 'ital,wght@0,400;0,700;1,400;1,700', css: 'Roboto, sans-serif' },
  { n: 'Roboto Mono', g: 'ital,wght@0,400;0,700;1,400;1,700', css: '"Roboto Mono", monospace' },
  { n: 'Source Sans 3', g: 'ital,wght@0,400;0,700;1,400;1,700', css: '"Source Sans 3", sans-serif' },
  { n: 'Source Serif 4', g: 'ital,wght@0,400;0,700;1,400;1,700', css: '"Source Serif 4", serif' },
];
const BY = new Map(FONTS.map(f => [f.n.toLowerCase(), f]));

export const fontCss = name => BY.get(String(name).toLowerCase())?.css || `"${name}", sans-serif`;
export function fontNameOf(cssFamily) {
  const first = String(cssFamily || '').split(',')[0].trim().replace(/^["']|["']$/g, '');
  const f = BY.get(first.toLowerCase());
  if (f) return f.n;
  for (const x of FONTS) if (x.css.toLowerCase().split(',').some(p => p.trim().replace(/"/g, '') === first.toLowerCase())) return x.n;
  return first || 'Arial';
}

const done = new Set();
export function ensureFont(name) {
  const f = BY.get(String(name).toLowerCase());
  if (!f?.g || done.has(f.n)) return;
  done.add(f.n);
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.n).replace(/%20/g, '+')}:${f.g}&display=swap`;
  document.head.append(l);
}
export function ensureAllFonts() { FONTS.forEach(f => ensureFont(f.n)); }
export function ensureFontsIn(html) {
  const re = /font-family:\s*([^;"]+|"[^"]+"[^;"]*)/gi;
  let m;
  while ((m = re.exec(html))) ensureFont(fontNameOf(m[1].replace(/&quot;/g, '"')));
}
