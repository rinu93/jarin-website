// Shared helpers: dates, escaping, charts.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const pad = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const today = () => iso(new Date());
export const nowTime = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const addMonths = (s, n) => {
  const d = parse(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return iso(d);
};
export const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 864e5);
export const mKey = s => String(s).slice(0, 7);
export const curMonth = () => mKey(today());
export const shiftMonth = (m, n) => mKey(addMonths(m + '-01', n));
export const fmtDate = s => s ? parse(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const fmtShort = s => s ? parse(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—';
export const fmtMonth = m => parse(m + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
export const fmtMonthS = m => parse(m + '-01').toLocaleDateString(undefined, { month: 'short' });

export function niceMax(v) {
  if (v <= 0) return 4;
  const p = 10 ** Math.floor(Math.log10(v)); const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function gridLines(max, { W, L, R, T, ih }, fmt) {
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const y = T + ih - ih * i / 4;
    g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="grid"/><text x="${L - 6}" y="${y + 4}" class="ax" text-anchor="end">${esc(fmt(max * i / 4))}</text>`;
  }
  return g;
}

// pts: [{label, tick, v, hl}]
export function barChart(pts, { fmt = v => Math.round(v), h = 200 } = {}) {
  const W = 640, H = h, L = 46, R = 8, T = 12, B = 26, iw = W - L - R, ih = H - T - B;
  const max = niceMax(Math.max(0, ...pts.map(p => p.v)));
  const bw = iw / Math.max(pts.length, 1);
  let g = gridLines(max, { W, L, R, T, ih }, fmt);
  pts.forEach((p, i) => {
    const bh = ih * p.v / max, x = L + i * bw + bw * .18, w = bw * .64;
    g += `<rect x="${x.toFixed(1)}" y="${(T + ih - bh).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(bh, 0).toFixed(1)}" rx="2" class="${p.hl ? 'bar-hl' : 'bar'}"><title>${esc(p.label)}: ${esc(fmt(p.v))}</title></rect>`;
    if (p.tick) g += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 8}" class="ax" text-anchor="middle">${esc(p.tick)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Bar chart">${g}</svg>`;
}

// pts: [{tick, target, actual, hl}]
export function pairChart(pts, { fmt = v => Math.round(v), h = 220 } = {}) {
  const W = 640, H = h, L = 52, R = 8, T = 12, B = 26, iw = W - L - R, ih = H - T - B;
  const max = niceMax(Math.max(0, ...pts.flatMap(p => [p.target || 0, p.actual || 0])));
  const bw = iw / Math.max(pts.length, 1);
  let g = gridLines(max, { W, L, R, T, ih }, fmt);
  pts.forEach((p, i) => {
    const x0 = L + i * bw + bw * .14, w = bw * .34;
    const th = ih * (p.target || 0) / max, ah = ih * (p.actual || 0) / max;
    g += `<rect x="${x0.toFixed(1)}" y="${(T + ih - th).toFixed(1)}" width="${w.toFixed(1)}" height="${th.toFixed(1)}" rx="2" class="bar-t"><title>${esc(p.tick)} target: ${esc(fmt(p.target || 0))}</title></rect>`;
    g += `<rect x="${(x0 + w + 2).toFixed(1)}" y="${(T + ih - ah).toFixed(1)}" width="${w.toFixed(1)}" height="${ah.toFixed(1)}" rx="2" class="${p.hl ? 'bar-hl' : 'bar'}"><title>${esc(p.tick)} achieved: ${esc(fmt(p.actual || 0))}</title></rect>`;
    g += `<text x="${(x0 + w + 1).toFixed(1)}" y="${H - 8}" class="ax" text-anchor="middle">${esc(p.tick)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Target versus achieved">${g}</svg>`;
}

export function toCsv(rows) {
  return rows.map(r => r.map(v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');
}
export function download(filename, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// pts: [{label, v}] in time order. Draws a line with dots; y-axis fits the data range.
export function lineChart(pts, { fmt = v => v, h = 180 } = {}) {
  const W = 640, H = h, L = 46, R = 14, T = 14, B = 26, iw = W - L - R, ih = H - T - B;
  const vals = pts.map(p => p.v);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const padv = Math.max(1, (hi - lo) * 0.15); lo = Math.floor(lo - padv); hi = Math.ceil(hi + padv);
  const y = v => T + ih - ih * (v - lo) / (hi - lo);
  const x = i => L + (pts.length === 1 ? iw / 2 : iw * i / (pts.length - 1));
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = lo + (hi - lo) * i / 4, yy = y(v);
    g += `<line x1="${L}" x2="${W - R}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" class="grid"/><text x="${L - 6}" y="${(yy + 4).toFixed(1)}" class="ax" text-anchor="end">${esc(fmt(Math.round(v * 10) / 10))}</text>`;
  }
  g += `<polyline fill="none" class="line" points="${pts.map((p, i) => x(i).toFixed(1) + ',' + y(p.v).toFixed(1)).join(' ')}"/>`;
  pts.forEach((p, i) => {
    g += `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${i === pts.length - 1 ? 5 : 3.5}" class="${i === pts.length - 1 ? 'dot-hl' : 'dot'}"><title>${esc(p.label)}: ${esc(fmt(p.v))}</title></circle>`;
    if (i === 0 || i === pts.length - 1 || pts.length <= 6) g += `<text x="${x(i).toFixed(1)}" y="${H - 8}" class="ax" text-anchor="${i === 0 && pts.length > 1 ? 'start' : i === pts.length - 1 && pts.length > 1 ? 'end' : 'middle'}">${esc(p.label)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Line chart">${g}</svg>`;
}

// Grouped bars for two series (e.g. income vs expenses). pts: [{tick, a, b, hl}]
export function dualChart(pts, { fmt = v => Math.round(v), h = 230, labels = ['A', 'B'] } = {}) {
  const W = 640, H = h, L = 56, R = 8, T = 12, B = 26, iw = W - L - R, ih = H - T - B;
  const max = niceMax(Math.max(0, ...pts.flatMap(p => [p.a || 0, p.b || 0])));
  const bw = iw / Math.max(pts.length, 1);
  let g = gridLines(max, { W, L, R, T, ih }, fmt);
  pts.forEach((p, i) => {
    const x0 = L + i * bw + bw * .14, w = bw * .34;
    const ah = ih * (p.a || 0) / max, bh = ih * (p.b || 0) / max;
    g += `<rect x="${x0.toFixed(1)}" y="${(T + ih - ah).toFixed(1)}" width="${w.toFixed(1)}" height="${ah.toFixed(1)}" rx="2" class="bar-inc"><title>${esc(p.tick)} ${esc(labels[0])}: ${esc(fmt(p.a || 0))}</title></rect>`;
    g += `<rect x="${(x0 + w + 2).toFixed(1)}" y="${(T + ih - bh).toFixed(1)}" width="${w.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" class="bar-exp"><title>${esc(p.tick)} ${esc(labels[1])}: ${esc(fmt(p.b || 0))}</title></rect>`;
    g += `<text x="${(x0 + w + 1).toFixed(1)}" y="${H - 8}" class="ax${p.hl ? ' ax-hl' : ''}" text-anchor="middle">${esc(p.tick)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(labels[0])} versus ${esc(labels[1])}">${g}</svg>`;
}
