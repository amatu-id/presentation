// Import / export: PowerPoint (.pptx via PptxGenJS + transitions patched in with JSZip), PPTX import, PDF print with
// page margins and handouts, PNG/JPEG images, .amslides JSON, plain text outline.
import { E, slide } from './state.js';
import { h, icon, toast, dialog, field, select, toggle, numInput, loadScript, downloadBlob, safeName, pickFile, readFile, uid, toHex } from './ui.js';
import { renderSlide, fitAll, bbox, shapePath } from './render.js';
import { Store } from './store.js';
import { newPres, normalize, resolveCol, htmlText, slideTitle, CONTENT_KEYS, cloneTheme, THEMES, escHtml, BOX, frame, px2cm } from './model.js';

const PPTX_JS = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
const JSZIP = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
const H2I = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js';
const IN = px => +(px / 96).toFixed(4);

// Offscreen rendering so computed styles (theme fonts/colours, shrink-to-fit) are real.
function offscreen(d, s, i) {
  const host = h('div', { class: 'offscreen' });
  document.body.append(host);
  const n = renderSlide(d, s, { idx: i, sfx: 'x' + i });
  host.append(n);
  fitAll(n);
  return { host, n };
}
const hex = c => { const x = toHex(c); return x && x !== 'transparent' ? x.slice(1).toUpperCase() : null; };
const alphaOf = c => { const m = String(c).match(/rgba\([^)]*,\s*([\d.]+)\)/); return m ? +m[1] : 1; };

// SVG string with theme variables resolved → PNG data URL.
async function svgPng(svgEl, theme, w, hgt) {
  let s = new XMLSerializer().serializeToString(svgEl);
  s = s.replace(/var\(--t-(\w+)\)/g, (_, k) => theme.c[k] || '#000');
  if (!/xmlns=/.test(s)) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  await img.decode().catch(() => { });
  const c = document.createElement('canvas');
  c.width = Math.round(w * 2); c.height = Math.round(hgt * 2);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}
async function bgPng(bg, d, w, hgt) {
  const c = document.createElement('canvas');
  c.width = Math.round(w); c.height = Math.round(hgt);
  const x = c.getContext('2d');
  const col = v => resolveCol(v, d.theme);
  let g;
  if (bg.radial) g = x.createRadialGradient(w * .3, hgt * .3, 0, w * .3, hgt * .3, Math.hypot(w, hgt));
  else { const a = (bg.ang ?? 135) * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a), L = (Math.abs(w * dx) + Math.abs(hgt * dy)) / 2; g = x.createLinearGradient(w / 2 - dx * L, hgt / 2 - dy * L, w / 2 + dx * L, hgt / 2 + dy * L); }
  g.addColorStop(0, col(bg.c1)); g.addColorStop(1, col(bg.c2));
  x.fillStyle = g; x.fillRect(0, 0, w, hgt);
  return c.toDataURL('image/png');
}
function iconPng(name, color, filled, size) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(size * 2);
  const x = c.getContext('2d');
  x.font = `${filled ? "'FILL' 1, " : ''}${c.width}px "Material Symbols Outlined"`;
  x.font = `${c.width}px "Material Symbols Outlined"`;
  x.fillStyle = color; x.textBaseline = 'middle'; x.textAlign = 'center';
  x.fillText(name, c.width / 2, c.height / 2);
  return c.toDataURL('image/png');
}
async function srcData(d, src) {
  if (!src) return null;
  if (src.startsWith('a:')) return d.assets[src.slice(2)] || null;
  if (src.startsWith('data:')) return src;
  try { const b = await (await fetch(src)).blob(); return await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); } catch { return null; }
}

// HTML text → PptxGenJS runs, styles read from the rendered DOM.
function runs(host, zoom = 1) {
  const out = [];
  const blocks = [...host.querySelectorAll('p, li')].filter(b => !b.querySelector('p, li'));
  const list = blocks.length ? blocks : [host];
  list.forEach((b, bi) => {
    const li = b.tagName === 'LI' ? b : null;
    const depth = li ? Math.max(0, $parents(li, 'ul, ol') - 1) : 0;
    const bs = getComputedStyle(b);
    const para = { align: { left: 'left', start: 'left', center: 'center', right: 'right', end: 'right', justify: 'justify' }[bs.textAlign] || 'left', lineSpacingMultiple: parseFloat(bs.lineHeight) / parseFloat(bs.fontSize) > 0 ? +(parseFloat(bs.lineHeight) / parseFloat(bs.fontSize) / 1.2).toFixed(2) || undefined : undefined };
    if (li) { const lst = li.parentElement; para.bullet = lst.tagName === 'OL' ? { type: 'number' } : true; para.indentLevel = depth; }
    const texts = [];
    const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    let t;
    while ((t = w.nextNode())) { if (t.parentElement.closest('p, li') !== b && blocks.length) continue; texts.push(t); }
    if (!texts.length) texts.push({ textContent: '', parentElement: b });
    texts.forEach((tn, ti) => {
      const cs = getComputedStyle(tn.parentElement);
      const deco = cs.textDecorationLine || '';
      const o = {
        fontSize: +(parseFloat(cs.fontSize) * .75 * zoom).toFixed(1), fontFace: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
        color: hex(cs.webkitTextFillColor && cs.webkitTextFillColor !== cs.color && cs.webkitTextFillColor !== 'rgba(0, 0, 0, 0)' ? cs.webkitTextFillColor : cs.color) || '000000',
        bold: +cs.fontWeight >= 600, italic: cs.fontStyle === 'italic',
        underline: deco.includes('underline') || tn.parentElement.closest('u') ? { style: 'sng' } : undefined, strike: deco.includes('line-through') ? 'sngStrike' : undefined,
        superscript: !!tn.parentElement.closest('sup'), subscript: !!tn.parentElement.closest('sub'),
        highlight: hex(cs.backgroundColor) || undefined,
        hyperlink: tn.parentElement.closest('a[href]') ? { url: tn.parentElement.closest('a[href]').href } : undefined,
        charSpacing: parseFloat(cs.letterSpacing) ? +(parseFloat(cs.letterSpacing) * .75).toFixed(1) : undefined,
      };
      if (ti === 0) Object.assign(o, para);
      if (ti === texts.length - 1 && bi < list.length - 1) o.breakLine = true;
      let text = tn.textContent;
      if (cs.textTransform === 'uppercase') text = text.toUpperCase();
      out.push({ text, options: o });
    });
  });
  return out;
}
const $parents = (n, sel) => { let c = 0; for (let p = n.parentElement; p; p = p.parentElement) if (p.matches(sel)) c++; return c; };
const PRST = { rect: 'rect', round: 'roundRect', snip: 'snip1Rect', ellipse: 'ellipse', triangle: 'triangle', rtriangle: 'rtTriangle', diamond: 'diamond', parallelogram: 'parallelogram', trapezoid: 'trapezoid', pentagon: 'pentagon', hexagon: 'hexagon', octagon: 'octagon', star4: 'star4', star5: 'star5', star6: 'star6', star12: 'star12', heart: 'heart', plus: 'plus', arrowR: 'rightArrow', arrowL: 'leftArrow', arrowU: 'upArrow', arrowD: 'downArrow', arrowLR: 'leftRightArrow', chevron: 'chevron', homeplate: 'homePlate', callout: 'wedgeRectCallout', calloutR: 'wedgeEllipseCallout', cloud: 'cloud', donut: 'donut', frame: 'frame', can: 'can', cube: 'cube', moon: 'moon', lightning: 'lightningBolt', brace: 'leftBrace', wave: 'wave' };
const DASHT = { solid: 'solid', dash: 'dash', dot: 'sysDot', dashdot: 'dashDot', long: 'lgDash' };

export async function exportPptx() {
  const d = E.doc;
  if (E.editing) E.endEdit();
  toast('Menyiapkan PowerPoint…', { ms: 2000 });
  try { await loadScript(PPTX_JS); await loadScript(JSZIP); } catch (e) { toast(e.message); return; }
  const P = new window.PptxGenJS();
  P.defineLayout({ name: 'AMATU', width: IN(d.page.w), height: IN(d.page.h) });
  P.layout = 'AMATU';
  P.title = d.title; P.author = (await import('./state.js')).me(); P.company = 'Amatu Slides';
  const col = c => hex(resolveCol(c, d.theme));
  for (const [i, s] of d.slides.entries()) {
    const sl = P.addSlide();
    const { host, n } = offscreen(d, s, i);
    try {
      const bg = s.bg || d.theme.bg || (d.theme.bgImg ? { t: 'img', src: d.theme.bgImg } : null);
      if (!bg || bg.t === 'color') sl.background = { color: col(bg?.c || '@bg') || 'FFFFFF' };
      else if (bg.t === 'grad') sl.background = { data: await bgPng(bg, d, d.page.w, d.page.h) };
      else if (bg.t === 'img') { const dd = await srcData(d, bg.src); if (dd) sl.background = { data: dd }; }
      const deco = n.querySelector(':scope > svg.deco');
      if (deco) sl.addImage({ data: await svgPng(deco, d.theme, d.page.w, d.page.h), x: 0, y: 0, w: IN(d.page.w), h: IN(d.page.h) });
      const all = [...(s.hideMaster ? [] : d.master), ...s.els];
      for (const e of all) {
        if (e.hidden) continue;
        const node = n.querySelector(`.el[data-id="${e.id}"]`);
        await addEl(P, sl, d, e, node, col);
      }
      const hf = n.querySelector('.hf-layer');
      if (hf) { const f = frame(d); const sp = [...hf.children]; const w3 = f.W / 3; sp.forEach((x, k) => { if (x.textContent) sl.addText(x.textContent, { x: IN(f.l + k * w3), y: IN(f.b - 24), w: IN(w3), h: IN(22), fontSize: 10, color: col('@tx2'), align: ['left', 'center', 'right'][k], fontFace: d.theme.f.body }); }); }
      if (s.notes) sl.addNotes(s.notes);
    } finally { host.remove(); }
  }
  const buf = await P.write({ outputType: 'arraybuffer' });
  const zip = await window.JSZip.loadAsync(buf);
  await patchTransitions(zip, d);
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  downloadBlob(blob, safeName(d.title) + '.pptx');
  toast('PowerPoint diunduh' + (d.slides.some(s => s.anims?.length) ? ' (animasi objek tidak ikut; transisi ikut)' : ''));
}
async function addEl(P, sl, d, e, node, col) {
  const b = bbox(e);
  const geo = { x: IN(b.x), y: IN(b.y), w: IN(Math.max(1, b.w)), h: IN(Math.max(1, b.h)), rotate: e.rot || 0, flipH: !!e.flipH, flipV: !!e.flipV };
  const shadow = e.shadow ? { type: 'outer', blur: Math.round((e.shadow.b ?? 8) * .75), offset: Math.round(Math.hypot(e.shadow.x ?? 2, e.shadow.y ?? 4) * .75), angle: Math.round(((Math.atan2(e.shadow.y ?? 4, e.shadow.x ?? 2) * 180 / Math.PI) + 360) % 360), color: col(e.shadow.c?.startsWith?.('rgba') ? '#000000' : e.shadow.c) || '000000', opacity: .35 } : undefined;
  const line = e.stroke ? { color: col(e.stroke.c) || '000000', width: +(e.stroke.w * .75).toFixed(2), dashType: DASHT[e.stroke.dash] || 'solid' } : undefined;
  const opac = e.opacity != null && e.opacity < 1 ? Math.round((1 - e.opacity) * 100) : 0;
  const fill = f => {
    if (!f || f === 'none') return undefined;
    if (typeof f === 'object') return { color: col(f.c1) || 'FFFFFF', transparency: opac };
    const c = resolveCol(f, d.theme);
    return { color: hex(c) || 'FFFFFF', transparency: Math.max(opac, Math.round((1 - alphaOf(c) * (e.fillOp ?? 1)) * 100)) };
  };
  if (e.type === 'text' || e.type === 'shape') {
    const txi = node?.querySelector('.txi');
    const zoom = parseFloat(txi?.style.zoom) || 1;
    const r = txi && (e.html || '').trim() ? runs(txi, zoom) : [];
    const pad = e.box?.pad || [8, 10, 8, 10];
    const opt = { ...geo, shape: e.type === 'shape' ? PRST[e.shape] || 'rect' : (e.radius ? 'roundRect' : 'rect'), fill: fill(e.fill), line, shadow, valign: { top: 'top', middle: 'middle', bottom: 'bottom' }[e.box?.va || 'top'], margin: pad.map(v => +(v * .75).toFixed(1)), fit: e.box?.fit === 'shrink' ? 'shrink' : e.box?.fit === 'grow' ? 'resize' : undefined, autoFit: false, wrap: true, columns: e.box?.cols > 1 ? e.box.cols : undefined, vert: e.box?.dir === 'v' ? 'eaVert' : undefined };
    if (e.type === 'text' && e.radius) opt.rectRadius = Math.min(1, e.radius / Math.min(b.w, b.h));
    if (e.type === 'shape' && e.shape === 'round') opt.rectRadius = e.adj?.r ?? .16;
    if (e.link) opt.hyperlink = e.link.startsWith('#slide:') ? { slide: d.slides.findIndex(s => s.id === e.link.slice(7)) + 1 } : { url: e.link };
    sl.addText(r.length ? r : '', opt);
  } else if (e.type === 'line') {
    const st = e.stroke || { c: '@tx', w: 2 };
    let head = e.head, tail = e.tail;
    const flipH = e.w < 0 && e.h >= 0, flipV = e.h < 0 && e.w >= 0;
    if (e.w < 0 && e.h < 0) [head, tail] = [tail, head];
    const at = k => (k === 'arrow' ? 'triangle' : k === 'open' ? 'arrow' : k === 'dot' ? 'oval' : undefined);
    sl.addShape(e.shape === 'elbow' ? 'bentConnector3' : e.shape === 'curve' ? 'curvedConnector3' : 'line', { x: geo.x, y: geo.y, w: geo.w, h: Math.max(.0001, geo.h), flipH, flipV, line: { color: col(st.c) || '000000', width: +(st.w * .75).toFixed(2), dashType: DASHT[st.dash] || 'solid', endArrowType: at(head), beginArrowType: at(tail) } });
  } else if (e.type === 'image') {
    const data = await srcData(d, e.src);
    if (!data) return;
    const o = { ...geo, data, sizing: e.fit === 'contain' ? { type: 'contain', w: geo.w, h: geo.h } : e.fit === 'fill' ? undefined : { type: 'cover', w: geo.w, h: geo.h }, rounding: e.mask === 'ellipse', shadow, transparency: opac || undefined, altText: e.alt || undefined };
    if (e.link) o.hyperlink = e.link.startsWith('#slide:') ? { slide: d.slides.findIndex(s => s.id === e.link.slice(7)) + 1 } : { url: e.link };
    sl.addImage(o);
  } else if (e.type === 'table') {
    const st = e.tstyle || {};
    const tc = col(st.c || '@a1') || '1A73E8';
    const rows = e.rows.map((r, ri) => r.filter(c => !c.skip).map((c, ci) => {
      const td = node?.querySelector(`td[data-r="${ri}"][data-c="${ci}"]`);
      const cs = td ? getComputedStyle(td) : null;
      const head = st.head !== false && ri === 0;
      return { text: htmlText(c.html), options: { bold: head || (st.firstCol && ci === 0) || (cs && +cs.fontWeight >= 600), color: head ? 'FFFFFF' : hex(cs?.color) || col('@tx'), fill: { color: c.fill ? col(c.fill) : head ? tc : hex(cs?.backgroundColor) || 'FFFFFF' }, fontSize: +(parseFloat(cs?.fontSize || 18) * .75).toFixed(1), fontFace: cs?.fontFamily.split(',')[0].replace(/["']/g, ''), align: cs?.textAlign === 'center' ? 'center' : cs?.textAlign === 'right' ? 'right' : 'left', colspan: c.span, rowspan: c.rspan, valign: 'middle' } };
    }));
    sl.addTable(rows, { x: geo.x, y: geo.y, w: geo.w, colW: (e.colW || []).map(f => +(f * geo.w).toFixed(3)), border: { type: 'solid', pt: .75, color: col(st.line || '@tx2') || 'BBBBBB' }, autoPage: false });
  } else if (e.type === 'chart') {
    const c = e.chart, data = c.data || [];
    const cats = data.slice(1).map(r => String(r[0] ?? ''));
    const series = (data[0] || []).slice(1).map((nm, si) => ({ name: String(nm), labels: cats, values: data.slice(1).map(r => +r[si + 1] || 0) }));
    const T = P.ChartType;
    const type = { col: T.bar, bar: T.bar, stack: T.bar, line: T.line, area: T.area, pie: T.pie, donut: T.doughnut }[c.type] || T.bar;
    const colors = (c.type === 'pie' || c.type === 'donut' ? cats : series).map((_, k) => col(c.colors?.[k] || '@a' + ((k % 6) + 1)));
    sl.addChart(type, c.type === 'pie' || c.type === 'donut' ? series.slice(0, 1) : series, { ...geo, barDir: c.type === 'bar' ? 'bar' : 'col', barGrouping: c.type === 'stack' ? 'stacked' : 'clustered', chartColors: colors, showLegend: c.legend !== false, legendPos: 'b', showTitle: !!c.title, title: c.title || undefined, showValue: !!c.labels, showPercent: (c.type === 'pie' || c.type === 'donut') && c.labels !== false, catAxisLabelColor: col('@tx2'), valAxisLabelColor: col('@tx2'), legendColor: col('@tx2'), titleColor: col('@tx'), dataLabelColor: c.type === 'pie' || c.type === 'donut' ? 'FFFFFF' : col('@tx2'), holeSize: 55 });
  } else if (e.type === 'icon') {
    const color = resolveCol(e.color || '@a1', d.theme);
    sl.addImage({ ...geo, data: iconPng(e.name, color, e.filled, Math.min(b.w, b.h)) });
  } else if (e.type === 'video') {
    const id = (e.url || '').match(/([\w-]{11})/)?.[1];
    sl.addText([{ text: '▶ Video', options: { bold: true, fontSize: 20, color: 'FFFFFF', breakLine: true, hyperlink: e.url ? { url: e.url } : undefined } }, { text: e.url || '', options: { fontSize: 11, color: 'DDDDDD' } }], { ...geo, fill: { color: '000000' }, align: 'center', valign: 'middle' });
    void id;
  }
}
// Slide transitions (and auto-advance) written into the slide XML; PptxGenJS has no API for them.
async function patchTransitions(zip, d) {
  const XML = { fade: '<p:fade/>', dissolve: '<p:dissolve/>', push: dir => `<p:push dir="${dir}"/>`, wipe: dir => `<p:wipe dir="${dir}"/>`, cover: dir => `<p:cover dir="${dir}"/>`, uncover: dir => `<p:pull dir="${dir}"/>`, split: '<p:split orient="vert" dir="out"/>', zoom: '<p:zoom/>', flip: '<p:fade/>', cube: dir => `<p:push dir="${dir}"/>`, morph: '<p:fade/>' };
  const DIR = { left: 'l', right: 'r', up: 'u', down: 'd' };
  for (const [i, s] of d.slides.entries()) {
    const path = `ppt/slides/slide${i + 1}.xml`;
    const f = zip.file(path);
    if (!f) continue;
    let x = await f.async('string');
    const t = s.trans;
    if (s.skip) x = x.replace('<p:sld ', '<p:sld show="0" ');
    if (t && ((t.type && t.type !== 'none') || t.auto != null)) {
      const spd = (t.dur ?? .7) < .5 ? 'fast' : (t.dur ?? .7) > 1.2 ? 'slow' : 'med';
      const k = XML[t.type];
      const inner = !k ? '' : typeof k === 'function' ? k(DIR[t.dir || 'left'] || 'l') : k;
      const tr = `<p:transition spd="${spd}"${t.auto != null ? ` advTm="${Math.round(t.auto * 1000)}"` : ''}>${inner}</p:transition>`;
      x = x.includes('</p:clrMapOvr>') ? x.replace('</p:clrMapOvr>', '</p:clrMapOvr>' + tr) : x.replace('</p:cSld>', '</p:cSld>' + tr);
    }
    zip.file(path, x);
  }
}

// ---------- PDF / print with margins & handouts ----------
export async function printDialog(pdf) {
  const d = E.doc;
  const P = d.print = { layout: 'slide', paper: 'slide', orient: 'landscape', m: { t: 0, r: 0, b: 0, l: 0 }, skipped: false, bg: true, num: false, frame: false, ...(d.print || {}) };
  const layout = select([['slide', '1 slide per halaman'], ['notes', 'Slide dengan catatan pembicara'], ['h2', 'Handout 2 slide'], ['h3', 'Handout 3 slide (dengan garis catatan)'], ['h4', 'Handout 4 slide'], ['h6', 'Handout 6 slide'], ['h9', 'Handout 9 slide']], P.layout, v => { P.layout = v; if (v !== 'slide' && P.paper === 'slide') { P.paper = 'a4'; paper.value = 'a4'; } P.orient = v === 'slide' ? 'landscape' : v === 'h4' || v === 'h9' ? 'landscape' : 'portrait'; orient.value = P.orient; if (v !== 'slide' && Object.values(P.m).every(x => !x)) for (const k in mIn) { mIn[k].value = 12.7; P.m[k] = 12.7; } draw(); });
  const paper = select([['slide', 'Sesuai ukuran slide'], ['a4', 'A4'], ['letter', 'Letter'], ['legal', 'Legal'], ['f4', 'F4 / Folio']], P.paper, v => { P.paper = v; draw(); });
  const orient = select([['landscape', 'Mendatar'], ['portrait', 'Tegak']], P.orient, v => { P.orient = v; draw(); });
  const mIn = {};
  for (const k of ['t', 'r', 'b', 'l']) { mIn[k] = numInput(P.m[k], { step: 1, min: 0, max: 80 }); mIn[k].addEventListener('input', () => { P.m[k] = Math.max(0, +mIn[k].value || 0); draw(); }); }
  const presets = h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, [['Tanpa margin', 0], ['Sempit', 6], ['Normal', 12.7], ['Lebar', 25.4]].map(([l, v]) => h('button', { class: 'btn btn-ghost sm', type: 'button', onclick: () => { for (const k in mIn) { mIn[k].value = v; P.m[k] = v; } draw(); } }, l)));
  const opts = h('div', { class: 'row', style: { gap: '14px', flexWrap: 'wrap' } },
    toggle('Sertakan slide yang dilewati', P.skipped, v => { P.skipped = v; }), toggle('Cetak latar belakang', P.bg, v => { P.bg = v; }), toggle('Nomor halaman', P.num, v => { P.num = v; }), toggle('Bingkai slide', P.frame, v => { P.frame = v; }));
  const prev = h('div', { class: 'print-prev' });
  function draw() {
    const [pw, ph] = paperMM(P, d);
    const k = Math.min(200 / pw, 220 / ph);
    const page = h('div', { class: 'pp', style: { width: pw * k + 'px', height: ph * k + 'px' } });
    const inner = h('div', { class: 'ppi', style: { left: P.m.l * k + 'px', right: P.m.r * k + 'px', top: P.m.t * k + 'px', bottom: P.m.b * k + 'px' } });
    const n = { slide: 1, notes: 1, h2: 2, h3: 3, h4: 4, h6: 6, h9: 9 }[P.layout];
    for (let i = 0; i < n; i++) inner.append(h('i', { class: 'l-' + P.layout }));
    page.append(inner);
    prev.replaceChildren(page, h('div', { class: 'small muted' }, `${pw} × ${ph} mm`));
  }
  draw();
  const ok = await dialog({
    title: pdf ? 'Unduh PDF' : 'Pratinjau cetak', width: 680,
    body: h('div', { class: 'print-dlg' }, h('div', { style: { display: 'grid', gap: '10px' } }, field('Tata letak', layout), h('div', { class: 'grid2' }, field('Ukuran kertas', paper), field('Orientasi', orient)),
      h('div', { class: 'fx-l', style: { fontWeight: 600 } }, 'Margin halaman (mm)'), h('div', { class: 'grid4' }, field('Atas', mIn.t), field('Bawah', mIn.b), field('Kiri', mIn.l), field('Kanan', mIn.r)), presets, opts,
      pdf ? h('p', { class: 'small muted', style: { margin: 0 } }, 'Di jendela cetak, pilih Tujuan: "Simpan sebagai PDF".') : null), prev),
    buttons: [{ label: 'Batal', value: false }, { label: pdf ? 'Buat PDF' : 'Cetak', primary: true, value: true }],
  });
  if (!ok) return;
  E.dirty = true; E.saveSoon();
  await printNow(P, d);
}
function paperMM(P, d) {
  if (P.paper === 'slide') return [Math.round(px2cm(d.page.w) * 10), Math.round(px2cm(d.page.h) * 10)];
  const s = { a4: [210, 297], letter: [216, 279], legal: [216, 356], f4: [215, 330] }[P.paper] || [210, 297];
  return P.orient === 'landscape' ? [s[1], s[0]] : s;
}
async function printNow(P, d) {
  if (E.editing) E.endEdit();
  const [pw, ph] = paperMM(P, d);
  const mm = 96 / 25.4;
  const iw = (pw - P.m.l - P.m.r) * mm, ih = (ph - P.m.t - P.m.b) * mm;
  const list = d.slides.map((s, i) => [s, i]).filter(([s]) => P.skipped || !s.skip);
  const per = { slide: 1, notes: 1, h2: 2, h3: 3, h4: 4, h6: 6, h9: 9 }[P.layout];
  const root = h('div', { id: 'print-root', class: P.bg ? '' : 'nobg' });
  const style = h('style', null, `@page { size: ${pw}mm ${ph}mm; margin: ${P.m.t}mm ${P.m.r}mm ${P.m.b}mm ${P.m.l}mm; }`);
  const slideBox = (s, i, w, hh) => {
    const k = Math.min(w / d.page.w, hh / d.page.h);
    const box = h('div', { class: 'pr-sl' + (P.frame ? ' framed' : ''), style: { width: d.page.w * k + 'px', height: d.page.h * k + 'px' } });
    const n = renderSlide(d, s, { idx: i, sfx: 'p' + i });
    n.style.transform = `scale(${k})`;
    box.append(n);
    return box;
  };
  let pageNo = 0;
  for (let p = 0; p < list.length; p += per) {
    const page = h('div', { class: 'pr-page', style: { width: iw + 'px', height: ih + 'px' } });
    pageNo++;
    const chunk = list.slice(p, p + per);
    if (P.layout === 'slide') page.append(slideBox(chunk[0][0], chunk[0][1], iw, ih));
    else if (P.layout === 'notes') {
      const [s, i] = chunk[0];
      page.classList.add('pr-notes');
      page.append(slideBox(s, i, iw, ih * .5), h('div', { class: 'pr-ntext' }, s.notes || ''));
    } else {
      const cols = per === 3 ? 1 : per === 2 ? 1 : per === 4 ? 2 : 3, rows = Math.ceil(per / cols);
      page.classList.add('pr-hand', 'h' + per);
      const cw = per === 3 ? iw * .5 : iw / cols - 16, chh = ih / rows - 16;
      for (const [s, i] of chunk) page.append(h('div', { class: 'pr-cell' }, slideBox(s, i, cw, chh), per === 3 ? h('div', { class: 'pr-lines' }) : null));
    }
    if (P.num) page.append(h('div', { class: 'pr-num' }, String(pageNo)));
    root.append(page);
  }
  document.head.append(style);
  document.body.append(root);
  root.querySelectorAll('.sl').forEach(fitAll);
  await document.fonts?.ready;
  await Promise.all([...root.querySelectorAll('img')].map(i => i.decode?.().catch(() => { })));
  document.documentElement.classList.add('printing');
  setTimeout(() => {
    print();
    setTimeout(() => { document.documentElement.classList.remove('printing'); root.remove(); style.remove(); }, 400);
  }, 120);
}

// ---------- images ----------
async function slidePng(d, s, i, type = 'png', scale = 2) {
  await loadScript(H2I);
  const { host, n } = offscreen(d, s, i);
  try {
    await document.fonts?.ready;
    const o = { width: d.page.w, height: d.page.h, pixelRatio: scale, cacheBust: false, skipFonts: false, quality: .92, backgroundColor: '#ffffff' };
    return type === 'jpeg' ? await window.htmlToImage.toJpeg(n, o) : await window.htmlToImage.toPng(n, o);
  } finally { host.remove(); }
}
export async function exportImage(type = 'png') {
  const d = E.doc;
  try {
    toast('Membuat gambar…', { ms: 1500 });
    const url = await slidePng(d, slide(), E.cur, type);
    downloadBlob(await (await fetch(url)).blob(), `${safeName(d.title)} - slide ${E.cur + 1}.${type === 'jpeg' ? 'jpg' : 'png'}`);
  } catch (e) { console.error(e); toast('Gagal membuat gambar: ' + (e.message || e)); }
}
export async function exportAllImages() {
  const d = E.doc;
  try {
    await loadScript(JSZIP);
    const zip = new window.JSZip();
    for (const [i, s] of d.slides.entries()) {
      toast(`Membuat gambar ${i + 1}/${d.slides.length}…`, { ms: 1200 });
      const url = await slidePng(d, s, i, 'png');
      zip.file(`slide-${String(i + 1).padStart(2, '0')}.png`, url.split(',')[1], { base64: true });
    }
    downloadBlob(await zip.generateAsync({ type: 'blob' }), safeName(d.title) + ' - slide.zip');
  } catch (e) { console.error(e); toast('Gagal: ' + (e.message || e)); }
}
export async function thumbDataUrl(d, s, i) { return slidePng(d, s, i, 'jpeg', .5); }

// ---------- JSON / text ----------
export function exportJson() {
  const d = E.doc, o = { format: 'amatu-slides', v: 1 };
  for (const k of CONTENT_KEYS) o[k] = d[k];
  downloadBlob(new Blob([JSON.stringify(o)], { type: 'application/json' }), safeName(d.title) + '.amslides');
}
export function exportText() {
  const d = E.doc;
  const t = d.slides.map((s, i) => `Slide ${i + 1}: ${slideTitle(s)}\n` + s.els.filter(e => e.html && e.ph !== 'title').map(e => htmlText(e.html.replace(/<\/(p|li)>/g, '\n'))).join('\n') + (s.notes ? `\n[Catatan] ${s.notes}` : '')).join('\n\n');
  downloadBlob(new Blob([t], { type: 'text/plain;charset=utf-8' }), safeName(d.title) + '.txt');
}

// ---------- import ----------
// New presentation from a file (home screen / drag & drop). Returns its id.
export async function importFile(file) {
  const name = file.name.replace(/\.[^.]+$/, '');
  const ext = file.name.split('.').pop().toLowerCase();
  let p;
  if (ext === 'pptx') p = await parsePptx(await readFile(file, 'buffer'), name);
  else if (ext === 'amslides' || ext === 'json') { const o = JSON.parse(await readFile(file, 'text')); p = newPres({ title: o.title || name }); for (const k of CONTENT_KEYS) if (o[k] !== undefined) p[k] = o[k]; normalize(p); }
  else if (file.type.startsWith('image/')) { p = newPres({ title: name }); const url = await readFile(file); p.assets.i1 = url; p.slides = [{ id: uid(8), layout: 'blank', els: [{ id: uid(8), type: 'image', src: 'a:i1', x: 0, y: 0, w: p.page.w, h: p.page.h, rot: 0, fit: 'contain' }], anims: [], notes: '' }]; }
  else throw new Error('format tidak didukung (gunakan .pptx, .amslides, atau gambar)');
  await Store.put(p);
  return p.id;
}
// Insert slides from a file into the open presentation.
export async function importInto() {
  const [f] = await pickFile('.pptx,.amslides,.json');
  if (!f) return;
  try {
    toast('Mengimpor ' + f.name + '…', { ms: 2000 });
    const ext = f.name.split('.').pop().toLowerCase();
    const src = ext === 'pptx' ? await parsePptx(await readFile(f, 'buffer'), f.name) : (() => { throw 0; })();
    const d = E.doc;
    Object.assign(d.assets, src.assets);
    const k = d.page.w / src.page.w, k2 = d.page.h / src.page.h;
    for (const s of src.slides) for (const e of s.els) { e.x *= k; e.w *= k; e.y *= k2; e.h *= k2; }
    d.slides.splice(E.cur + 1, 0, ...src.slides);
    E.commit('Impor slide', 'all');
    toast(`${src.slides.length} slide diimpor`);
  } catch (e) {
    if (f.name.match(/\.(amslides|json)$/i)) {
      const o = JSON.parse(await readFile(f, 'text'));
      const d = E.doc;
      Object.assign(d.assets, o.assets || {});
      d.slides.splice(E.cur + 1, 0, ...(o.slides || []).map(s => ({ ...s, id: uid(8) })));
      E.commit('Impor slide', 'all');
      return;
    }
    console.error(e); toast('Gagal mengimpor: ' + (e?.message || 'file tidak valid'));
  }
}

const EMU = 9525; // EMU per pixel at 96 dpi
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', bmp: 'image/bmp', webp: 'image/webp', emf: '', wmf: '', tif: '', tiff: '' };
export async function parsePptx(buf, title) {
  await loadScript(JSZIP);
  const zip = await window.JSZip.loadAsync(buf);
  const X = async p => { const f = zip.file(p); return f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null; };
  const all = (n, tag) => n ? [...n.getElementsByTagNameNS('*', tag)] : [];
  const one = (n, tag) => all(n, tag)[0] || null;
  const kids = (n, tag) => n ? [...n.children].filter(c => c.localName === tag) : [];
  const kid = (n, tag) => kids(n, tag)[0] || null;
  const rels = async p => {
    const dir = p.replace(/[^/]+$/, ''), base = p.replace(/^.*\//, '');
    const x = await X(dir + '_rels/' + base + '.rels');
    const m = {};
    for (const r of all(x, 'Relationship')) m[r.getAttribute('Id')] = { type: r.getAttribute('Type').split('/').pop(), target: norm(dir, r.getAttribute('Target')) };
    return m;
  };
  const norm = (dir, t) => { const parts = (t.startsWith('/') ? t.slice(1) : dir + t).split('/'); const o = []; for (const s of parts) { if (s === '..') o.pop(); else if (s !== '.') o.push(s); } return o.join('/'); };

  const pres = await X('ppt/presentation.xml');
  const sz = one(pres, 'sldSz');
  const W = Math.round(+sz.getAttribute('cx') / EMU), H = Math.round(+sz.getAttribute('cy') / EMU);
  const prels = await rels('ppt/presentation.xml');
  const p = newPres({ title: (title || 'Presentasi').replace(/\.pptx$/i, '') });
  p.page = { size: 'custom', w: W, h: H, margin: { ...p.page.margin } };
  if (Math.abs(W / H - 16 / 9) < .01) p.page.size = '16:9'; else if (Math.abs(W / H - 4 / 3) < .01) p.page.size = '4:3';
  p.slides = [];

  // theme colours & fonts
  const themeRel = Object.values(prels).find(r => r.type === 'theme');
  const th = cloneTheme(THEMES[0]);
  th.id = 'impor'; th.name = 'Tema impor';
  const scheme = {};
  if (themeRel) {
    const tx = await X(themeRel.target);
    const cs = one(tx, 'clrScheme');
    if (cs) for (const c of [...cs.children]) { const v = one(c, 'srgbClr')?.getAttribute('val') || one(c, 'sysClr')?.getAttribute('lastClr'); if (v) scheme[c.localName] = '#' + v; }
    const major = one(one(tx, 'majorFont'), 'latin')?.getAttribute('typeface'), minor = one(one(tx, 'minorFont'), 'latin')?.getAttribute('typeface');
    if (major) th.f.head = major; if (minor) th.f.body = minor;
    Object.assign(th.c, { bg: scheme.lt1 || '#ffffff', bg2: scheme.lt2 || '#f1f3f4', tx: scheme.dk1 || '#000000', tx2: scheme.dk2 || '#444444', title: scheme.dk1 || '#000000', a1: scheme.accent1 || th.c.a1, a2: scheme.accent2 || th.c.a2, a3: scheme.accent3 || th.c.a3, a4: scheme.accent4 || th.c.a4, a5: scheme.accent5 || th.c.a5, a6: scheme.accent6 || th.c.a6 });
  }
  th.deco = null;
  p.theme = th;
  const SCH = { tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2' };
  const colorOf = n => {
    if (!n) return null;
    const s = kid(n, 'srgbClr'), sc = kid(n, 'schemeClr'), sy = kid(n, 'sysClr'), pc = kid(n, 'prstClr');
    let c = s ? '#' + s.getAttribute('val') : sc ? scheme[SCH[sc.getAttribute('val')] || sc.getAttribute('val')] : sy ? '#' + (sy.getAttribute('lastClr') || '000000') : pc ? pc.getAttribute('val') : null;
    const mod = s || sc || sy;
    const lm = mod && kid(mod, 'lumMod'), lo = mod && kid(mod, 'lumOff');
    if (c && c.startsWith('#') && (lm || lo)) c = lum(c, lm ? +lm.getAttribute('val') / 1e5 : 1, lo ? +lo.getAttribute('val') / 1e5 : 0);
    const a = mod && kid(mod, 'alpha');
    if (c && a) c = rgba(c, +a.getAttribute('val') / 1e5);
    return c;
  };
  const media = {};
  const asset = async target => {
    if (media[target]) return media[target];
    const f = zip.file(target);
    const ext = target.split('.').pop().toLowerCase();
    if (!f || !MIME[ext]) return null;
    const id = uid(10);
    p.assets[id] = `data:${MIME[ext]};base64,` + await f.async('base64');
    return (media[target] = 'a:' + id);
  };
  const xfrmOf = sp => { const x = one(kid(sp, 'spPr') || kid(sp, 'grpSpPr') || sp, 'xfrm'); return x; };
  const geom = (xf, G) => {
    if (!xf) return null;
    const off = kid(xf, 'off'), ext = kid(xf, 'ext');
    if (!off || !ext) return null;
    let x = +off.getAttribute('x'), y = +off.getAttribute('y'), w = +ext.getAttribute('cx'), hh = +ext.getAttribute('cy');
    if (G) { x = G.ox + (x - G.cx) * G.sx; y = G.oy + (y - G.cy) * G.sy; w *= G.sx; hh *= G.sy; }
    return { x: x / EMU, y: y / EMU, w: w / EMU, h: hh / EMU, rot: (+xf.getAttribute('rot') || 0) / 60000, flipH: xf.getAttribute('flipH') === '1', flipV: xf.getAttribute('flipV') === '1' };
  };
  // placeholder geometry & text defaults from layout / master
  const phInfo = async (layoutPath) => {
    const res = { list: [] };
    const lay = await X(layoutPath);
    const lr = await rels(layoutPath);
    const mr = Object.values(lr).find(r => r.type === 'slideMaster');
    const mas = mr ? await X(mr.target) : null;
    for (const doc of [lay, mas]) for (const sp of all(doc, 'sp')) {
      const ph = one(sp, 'ph');
      if (!ph) continue;
      const g = geom(xfrmOf(sp));
      const sz2 = one(one(sp, 'lstStyle'), 'defRPr')?.getAttribute('sz');
      res.list.push({ type: ph.getAttribute('type') || 'body', idx: ph.getAttribute('idx'), g, size: sz2 ? +sz2 / 100 : null, layout: doc === lay });
    }
    if (mas) { const ts = one(mas, 'titleStyle'), bs = one(mas, 'bodyStyle'); res.titleSz = +(one(one(ts, 'lvl1pPr'), 'defRPr')?.getAttribute('sz') || 4400) / 100; res.bodySz = +(one(one(bs, 'lvl1pPr'), 'defRPr')?.getAttribute('sz') || 2800) / 100; }
    return res;
  };
  const phCache = {};
  const findPh = (info, type, idx) => info.list.find(x => x.layout && ((idx != null && x.idx === idx) || (x.type === type))) || info.list.find(x => x.type === type || (type === 'ctrTitle' && x.type === 'title') || (type === 'subTitle' && x.type === 'body'));

  const textHtml = (tb, defSz) => {
    if (!tb) return '';
    const out = [];
    let list = null;
    const bodyPr = kid(tb, 'bodyPr');
    const auto = bodyPr && (kid(bodyPr, 'normAutofit'));
    const scale = auto?.getAttribute('fontScale') ? +auto.getAttribute('fontScale') / 1e5 : 1;
    for (const para of kids(tb, 'p')) {
      const pPr = kid(para, 'pPr');
      const algn = { ctr: 'center', r: 'right', just: 'justify' }[pPr?.getAttribute('algn')] || '';
      const bullet = pPr && (kid(pPr, 'buChar') || kid(pPr, 'buAutoNum')) && !kid(pPr, 'buNone');
      const num = pPr && kid(pPr, 'buAutoNum');
      let inner = '';
      for (const r of [...para.children]) {
        if (r.localName === 'br') { inner += '<br>'; continue; }
        if (r.localName !== 'r' && r.localName !== 'fld') continue;
        const t = kid(r, 't')?.textContent || '';
        const rp = kid(r, 'rPr');
        const st = [];
        if (rp?.getAttribute('sz')) st.push(`font-size:${(+rp.getAttribute('sz') / 100 * scale * 96 / 72).toFixed(1)}px`);
        const c = colorOf(kid(rp, 'solidFill'));
        if (c) st.push('color:' + c);
        const lat = kid(rp, 'latin')?.getAttribute('typeface');
        if (lat && !lat.startsWith('+')) st.push(`font-family:"${lat}"`);
        if (rp?.getAttribute('b') === '1') st.push('font-weight:700');
        if (rp?.getAttribute('i') === '1') st.push('font-style:italic');
        const deco = [rp?.getAttribute('u') && rp.getAttribute('u') !== 'none' ? 'underline' : '', rp?.getAttribute('strike') && rp.getAttribute('strike') !== 'noStrike' ? 'line-through' : ''].filter(Boolean).join(' ');
        if (deco) st.push('text-decoration:' + deco);
        let seg = escHtml(t);
        if (st.length) seg = `<span style="${st.join(';')}">${seg}</span>`;
        inner += seg;
      }
      const pst = algn ? ` style="text-align:${algn}"` : '';
      if (bullet) {
        const tag = num ? 'ol' : 'ul';
        if (!list || list.tag !== tag) { list = { tag, items: [] }; out.push(list); }
        list.items.push(`<li${pst}>${inner || '<br>'}</li>`);
      } else { list = null; out.push(`<p${pst}>${inner || '<br>'}</p>`); }
    }
    void defSz;
    return out.map(x => (typeof x === 'string' ? x : `<${x.tag}>${x.items.join('')}</${x.tag}>`)).join('');
  };

  const slideIds = all(pres, 'sldId');
  for (const sid of slideIds) {
    const rel = prels[sid.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || sid.getAttribute('r:id')];
    if (!rel) continue;
    const sx = await X(rel.target);
    const sr = await rels(rel.target);
    const layRel = Object.values(sr).find(r => r.type === 'slideLayout');
    const info = layRel ? (phCache[layRel.target] ||= await phInfo(layRel.target)) : { list: [] };
    const s = { id: uid(8), layout: 'blank', els: [], anims: [], notes: '', bg: null };
    if (sx.documentElement.getAttribute('show') === '0') s.skip = true;
    const bgPr = one(sx, 'bgPr');
    if (bgPr) { const c = colorOf(kid(bgPr, 'solidFill')); if (c) s.bg = { t: 'color', c }; const blip = one(kid(bgPr, 'blipFill'), 'blip'); if (blip) { const r = sr[blip.getAttribute('r:embed') || blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed')]; const a = r && await asset(r.target); if (a) s.bg = { t: 'img', src: a, fit: 'cover' }; } }
    const walk = async (tree, G) => {
      for (const n of [...tree.children]) {
        const ln = n.localName;
        if (ln === 'grpSp') {
          const xf = xfrmOf(n);
          const off = kid(xf, 'off'), ext = kid(xf, 'ext'), co = kid(xf, 'chOff'), ce = kid(xf, 'chExt');
          let g2 = G;
          if (off && ext && co && ce) {
            const base = { ox: +off.getAttribute('x'), oy: +off.getAttribute('y'), cx: +co.getAttribute('x'), cy: +co.getAttribute('y'), sx: (+ext.getAttribute('cx') / (+ce.getAttribute('cx') || 1)) || 1, sy: (+ext.getAttribute('cy') / (+ce.getAttribute('cy') || 1)) || 1 };
            g2 = G ? { ox: G.ox + (base.ox - G.cx) * G.sx, oy: G.oy + (base.oy - G.cy) * G.sy, cx: base.cx, cy: base.cy, sx: base.sx * G.sx, sy: base.sy * G.sy } : base;
          }
          await walk(n, g2);
        } else if (ln === 'sp' || ln === 'cxnSp') {
          const ph = one(kid(n, 'nvSpPr'), 'ph');
          let g = geom(xfrmOf(n), G);
          const phType = ph ? ph.getAttribute('type') || 'body' : null;
          let pinfo = null;
          if (ph) { pinfo = findPh(info, phType, ph.getAttribute('idx')); if (!g) g = pinfo?.g; }
          if (!g) continue;
          if (['dt', 'ftr', 'sldNum'].includes(phType)) continue;
          const spPr = kid(n, 'spPr');
          const prst = one(spPr, 'prstGeom')?.getAttribute('prst');
          const fillC = kid(spPr, 'noFill') ? null : colorOf(kid(spPr, 'solidFill'));
          const lnN = kid(spPr, 'ln');
          const stroke = lnN && !kid(lnN, 'noFill') && colorOf(kid(lnN, 'solidFill')) ? { c: colorOf(kid(lnN, 'solidFill')), w: Math.max(.5, (+lnN.getAttribute('w') || 12700) / EMU), dash: 'solid' } : null;
          if (ln === 'cxnSp' || ['line', 'straightConnector1', 'bentConnector3', 'curvedConnector3'].includes(prst)) {
            const hE = kid(lnN, 'headEnd')?.getAttribute('type'), tE = kid(lnN, 'tailEnd')?.getAttribute('type');
            const e = { id: uid(8), type: 'line', shape: prst?.startsWith('bent') ? 'elbow' : prst?.startsWith('curved') ? 'curve' : 'line', x: g.x, y: g.y, w: g.w, h: g.h, rot: 0, stroke: stroke || { c: '@tx', w: 2, dash: 'solid' }, head: tE && tE !== 'none' ? 'arrow' : null, tail: hE && hE !== 'none' ? 'arrow' : null };
            if (g.flipH) { e.x += e.w; e.w = -e.w; } if (g.flipV) { e.y += e.h; e.h = -e.h; }
            s.els.push(e); continue;
          }
          const tb = kid(n, 'txBody');
          const bodyPr = kid(tb, 'bodyPr');
          const va = { ctr: 'middle', b: 'bottom' }[bodyPr?.getAttribute('anchor')] || (phType === 'ctrTitle' || phType === 'title' ? 'middle' : 'top');
          const pad = bodyPr ? ['tIns', 'rIns', 'bIns', 'lIns'].map((k, i) => (bodyPr.getAttribute(k) != null ? +bodyPr.getAttribute(k) / EMU : [4.8, 9.6, 4.8, 9.6][i])) : [4.8, 9.6, 4.8, 9.6];
          const html = textHtml(tb);
          const isTitle = phType === 'title' || phType === 'ctrTitle';
          const def = { size: pinfo?.size || (isTitle ? info.titleSz || 44 : phType ? info.bodySz || 28 : 18), font: isTitle ? 'head' : 'body', color: isTitle ? '@title' : '@tx' };
          const shapeK = prst && prst !== 'rect' ? Object.keys(PRST).find(k => PRST[k] === prst) : null;
          const e = { id: uid(8), type: shapeK || (fillC && prst && prst !== 'rect') ? 'shape' : 'text', x: g.x, y: g.y, w: g.w, h: g.h, rot: g.rot, flipH: g.flipH || undefined, flipV: g.flipV || undefined, html, box: { ...BOX(), va, pad, fit: kid(bodyPr, 'normAutofit') ? 'shrink' : 'none' }, def };
          if (e.type === 'shape') { e.shape = shapeK || 'rect'; e.fill = fillC; e.tcol = '@tx'; def.color = '@tx'; } else if (fillC) e.fill = fillC;
          if (stroke) e.stroke = stroke;
          if (ph) e.ph = isTitle ? 'title' : phType === 'subTitle' ? 'subtitle' : 'body';
          if (!html && !fillC && !stroke) continue;
          s.els.push(e);
        } else if (ln === 'pic') {
          const g = geom(xfrmOf(n), G);
          const blip = one(n, 'blip');
          const rid = blip?.getAttribute('r:embed') || blip?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed');
          const a = rid && sr[rid] ? await asset(sr[rid].target) : null;
          if (g && a) s.els.push({ id: uid(8), type: 'image', src: a, x: g.x, y: g.y, w: g.w, h: g.h, rot: g.rot, flipH: g.flipH || undefined, fit: 'fill', mask: one(n, 'prstGeom')?.getAttribute('prst') === 'ellipse' ? 'ellipse' : undefined });
        } else if (ln === 'graphicFrame') {
          const xf = one(n, 'xfrm');
          const g = geom(xf, G);
          const tbl = one(n, 'tbl');
          if (g && tbl) {
            const cols = all(one(tbl, 'tblGrid'), 'gridCol').map(c => +c.getAttribute('w'));
            const tot = cols.reduce((a, b) => a + b, 0) || 1;
            const rows = kids(tbl, 'tr').map(tr => kids(tr, 'tc').map(tc => ({ html: textHtml(kid(tc, 'txBody')), span: +tc.getAttribute('gridSpan') || undefined, rspan: +tc.getAttribute('rowSpan') || undefined, skip: tc.getAttribute('hMerge') === '1' || tc.getAttribute('vMerge') === '1' || undefined, fill: colorOf(kid(kid(tc, 'tcPr'), 'solidFill')) || undefined })));
            if (rows.length) s.els.push({ id: uid(8), type: 'table', x: g.x, y: g.y, w: g.w, h: g.h, rot: 0, rows, colW: cols.map(c => c / tot), tstyle: { head: true, band: true, c: '@a1' }, def: { size: 14 } });
          }
        }
      }
    };
    const tree = one(sx, 'spTree');
    if (tree) await walk(tree, null);
    const notesRel = Object.values(sr).find(r => r.type === 'notesSlide');
    if (notesRel) {
      const nx = await X(notesRel.target);
      for (const sp of all(nx, 'sp')) { const ph = one(sp, 'ph'); if (ph?.getAttribute('type') === 'body') s.notes = all(sp, 'p').map(pp => all(pp, 't').map(t => t.textContent).join('')).join('\n').trim(); }
    }
    const t = s.els.find(e => e.ph === 'title');
    s.layout = t && s.els.some(e => e.ph === 'subtitle') ? 'title' : t ? 'title-body' : 'blank';
    p.slides.push(s);
  }
  if (!p.slides.length) p.slides.push({ id: uid(8), layout: 'blank', els: [], anims: [], notes: '' });
  return normalize(p);
}
function lum(hexc, mod, off) {
  const n = parseInt(hexc.slice(1), 16);
  let [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let hh = 0, s = 0, l = (mx + mn) / 2;
  if (mx !== mn) { const dd = mx - mn; s = l > .5 ? dd / (2 - mx - mn) : dd / (mx + mn); hh = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; hh /= 6; }
  l = Math.min(1, Math.max(0, l * mod + off));
  const f = (pp, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp; };
  if (!s) r = g = b = l; else { const q = l < .5 ? l * (1 + s) : l + s - l * s, pp = 2 * l - q; r = f(pp, q, hh + 1 / 3); g = f(pp, q, hh); b = f(pp, q, hh - 1 / 3); }
  return '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}
const rgba = (hexc, a) => { const n = parseInt(hexc.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
export { shapePath, icon };
