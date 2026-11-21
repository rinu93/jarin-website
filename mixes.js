// JARIN "workout mixes" — the animated website background.
// Each mix is a colour palette + a motion style + a tempo (BPM). The owner manages the list
// from the Employee Dashboard → Website themes; the website rotates through the enabled ones.
// This file is shared by the website and the dashboard (live preview). Keep both copies in sync.

export const MOTIONS = {
  ember: 'Embers: sparks rising off the bar',
  pulse: 'Pulse: rings that beat with the tempo',
  flow: 'Flow: slow ribbons, calm and steady',
  grid: 'Grid: neon floor racing towards you',
  aurora: 'Aurora: soft curtains of light',
};
export const DAYPARTS = { any: 'Any time', morning: 'Morning (5 – 11 AM)', midday: 'Midday (11 AM – 4 PM)', evening: 'Evening (4 – 9 PM)', night: 'Night (9 PM – 5 AM)' };

export const DEFAULT_MIXES = [
  { id: 'beast-mode', name: 'Beast Mode', tagline: 'Heavy compound lifts. Copper heat.', a: '#E8A272', b: '#B86B3C', c: '#FF7A33', motion: 'ember', bpm: 138, daypart: 'evening' },
  { id: 'cardio-rush', name: 'Cardio Rush', tagline: 'Intervals, sprints and a racing heart.', a: '#FF8A8A', b: '#C2334A', c: '#FF3D6E', motion: 'pulse', bpm: 165, daypart: 'morning' },
  { id: 'sunrise-session', name: 'Sunrise Session', tagline: 'First light, first rep.', a: '#FFC56B', b: '#D9822B', c: '#FF9A5B', motion: 'aurora', bpm: 108, daypart: 'morning' },
  { id: 'zen-stretch', name: 'Zen Stretch', tagline: 'Mobility, breath and recovery.', a: '#7FE0C8', b: '#2F8F7E', c: '#8FD3FF', motion: 'flow', bpm: 72, daypart: 'midday' },
  { id: 'iron-steel', name: 'Iron & Steel', tagline: 'Cold steel, clean form.', a: '#9CC4FF', b: '#4A6FA5', c: '#D6E6FF', motion: 'pulse', bpm: 120, daypart: 'midday' },
  { id: 'night-grind', name: 'Night Grind', tagline: 'After hours. Neon on the floor.', a: '#B9A0FF', b: '#6A4FD8', c: '#FF6BD6', motion: 'grid', bpm: 128, daypart: 'night' },
];
export const DEFAULT_CONFIG = { mode: 'rotate', intervalSec: 40, pinned: null, visitorControls: true };

export const fromRow = r => ({ id: r.id, name: r.name, tagline: r.tagline || '', a: r.color_a, b: r.color_b, c: r.color_c, motion: MOTIONS[r.motion] ? r.motion : 'ember', bpm: Math.min(200, Math.max(50, Number(r.bpm) || 120)), daypart: r.daypart || 'any', enabled: r.enabled !== false, sort: r.sort ?? 0, builtin: !!r.builtin });
export const configFromRow = r => r ? { mode: r.mode, intervalSec: Number(r.interval_sec) || 40, pinned: r.pinned || null, visitorControls: r.visitor_controls !== false } : { ...DEFAULT_CONFIG };

/* ---------------- colour helpers ---------------- */
const hex = h => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const lerp = (x, y, t) => x + (y - x) * t;
const mixRgb = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t), lerp(p[2], q[2], t)];
export const lighten = (h, t) => toHex(mixRgb(hex(h), [255, 255, 255], t));
const lum = h => { const c = hex(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const contrast = (x, y) => { const [p, q] = [lum(x), lum(y)].sort((m, n) => n - m); return (p + 0.05) / (q + 0.05); };
// The accent is used for text on the near-black page and as a button with dark text on it.
export function readability(mix) {
  const onPage = contrast(mix.a, '#0B0908'); const onButton = contrast(mix.a, '#1A0F07');
  return { onPage, onButton, ok: onPage >= 4.5 && onButton >= 4.5 };
}

/* ---------------- which mix plays now ---------------- */
export function daypartNow(d = new Date()) {
  const h = d.getHours();
  return h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 16 ? 'midday' : h >= 16 && h < 21 ? 'evening' : 'night';
}
export function playlist(mixes, config, now = new Date()) {
  const on = mixes.filter(m => m.enabled !== false).sort((x, y) => (x.sort ?? 0) - (y.sort ?? 0));
  if (!on.length) return [DEFAULT_MIXES[0]];
  if (config.mode === 'pinned') return [on.find(m => m.id === config.pinned) || on[0]];
  if (config.mode === 'daypart') { const dp = daypartNow(now); const fit = on.filter(m => m.daypart === dp || m.daypart === 'any'); return fit.length ? fit : on; }
  return on;
}

/* ---------------- the stage (canvas renderer) ---------------- */
// createStage(canvas, { reduced, scale }) → { setMix(mix), pause(), play(), destroy() }
export function createStage(canvas, opts = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const reduced = !!opts.reduced;
  let W = 0, H = 0, dpr = 1, raf = 0, running = !reduced, t0 = performance.now();
  let cur = null, prev = null, fadeStart = 0;
  const FADE = 1800;
  const sparks = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 1.6, v: 0.3 + Math.random() * 0.9, w: Math.random() * Math.PI * 2 }));

  function size() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(opts.maxDpr || 1.5, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  }
  const beat = (t, bpm) => Math.pow(Math.max(0, Math.cos(Math.PI * 2 * t * bpm / 60)), 10);
  const rgba = (rgb, a) => `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${a})`;

  function blobs(m, t, k) {
    const cols = [hex(m.a), hex(m.b), hex(m.c)];
    const sp = 0.03 + m.bpm / 6000;
    const P = [[0.78 + 0.12 * Math.sin(t * sp * 2.1), 0.32 + 0.14 * Math.cos(t * sp * 1.7), 0.62],
      [0.18 + 0.14 * Math.cos(t * sp * 1.3), 0.72 + 0.1 * Math.sin(t * sp * 1.9), 0.55],
      [0.5 + 0.22 * Math.sin(t * sp * 0.9 + 1), 0.48 + 0.18 * Math.sin(t * sp * 1.1), 0.42]];
    ctx.globalCompositeOperation = 'lighter';
    P.forEach(([x, y, r], i) => {
      const R = Math.max(W, H) * r;
      const g = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, R);
      g.addColorStop(0, rgba(cols[i], 0.22 * k)); g.addColorStop(1, rgba(cols[i], 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });
    ctx.globalCompositeOperation = 'source-over';
  }
  function overlay(m, t, k) {
    const a = hex(m.a), c = hex(m.c); const b = beat(t, m.bpm);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (m.motion === 'ember') {
      for (const p of sparks) {
        const y = 1 - ((p.y + t * p.v * (m.bpm / 900)) % 1.1);
        const x = p.x + Math.sin(t * 0.8 + p.w) * 0.02;
        const r = p.s * dpr * (1.2 + b * 0.8);
        ctx.fillStyle = rgba(p.s > 1.2 ? c : a, (0.18 + 0.55 * (1 - y)) * k * 0.6);
        ctx.beginPath(); ctx.arc(x * W, y * H, r, 0, Math.PI * 2); ctx.fill();
      }
    } else if (m.motion === 'pulse') {
      const cx = W * 0.72, cy = H * 0.42; const base = Math.min(W, H) * 0.12;
      ctx.lineWidth = 1.5 * dpr;
      for (let i = 0; i < 6; i++) {
        const ph = ((t * m.bpm / 60) + i / 6) % 1;
        ctx.strokeStyle = rgba(i % 2 ? c : a, (1 - ph) * 0.28 * k);
        ctx.beginPath(); ctx.arc(cx, cy, base + ph * Math.max(W, H) * 0.55, 0, Math.PI * 2); ctx.stroke();
      }
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * (1.4 + b));
      g.addColorStop(0, rgba(a, 0.18 * k * (0.5 + b))); g.addColorStop(1, rgba(a, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } else if (m.motion === 'flow') {
      for (let j = 0; j < 4; j++) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 16 * dpr) {
          const y = H * (0.3 + j * 0.14) + Math.sin(x / W * Math.PI * 2 + t * 0.35 + j) * H * 0.06 + Math.sin(x / W * 9 + t * 0.5) * H * 0.012;
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = rgba(j % 2 ? c : a, 0.16 * k); ctx.lineWidth = (26 - j * 5) * dpr; ctx.stroke();
      }
    } else if (m.motion === 'grid') {
      const hz = H * 0.58; const speed = t * m.bpm / 120;
      ctx.lineWidth = 1 * dpr;
      for (let i = 0; i < 14; i++) {
        const z = ((i + speed) % 14) / 14; const y = hz + (H - hz) * z * z;
        ctx.strokeStyle = rgba(a, 0.08 + 0.22 * z * k); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      for (let i = -12; i <= 12; i++) {
        ctx.strokeStyle = rgba(c, 0.14 * k); ctx.beginPath(); ctx.moveTo(W / 2 + i * W * 0.02, hz); ctx.lineTo(W / 2 + i * W * 0.16, H); ctx.stroke();
      }
      const g = ctx.createLinearGradient(0, hz - H * 0.18, 0, hz + 2);
      g.addColorStop(0, rgba(c, 0)); g.addColorStop(1, rgba(c, 0.22 * k * (0.7 + 0.3 * b)));
      ctx.fillStyle = g; ctx.fillRect(0, hz - H * 0.18, W, H * 0.18);
    } else if (m.motion === 'aurora') {
      for (let j = 0; j < 5; j++) {
        const x0 = W * (0.1 + j * 0.2) + Math.sin(t * 0.25 + j) * W * 0.06;
        const g = ctx.createLinearGradient(0, 0, 0, H * 0.8);
        g.addColorStop(0, rgba(j % 2 ? a : c, 0)); g.addColorStop(0.45, rgba(j % 2 ? a : c, 0.12 * k)); g.addColorStop(1, rgba(j % 2 ? a : c, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(x0, 0);
        for (let y = 0; y <= H * 0.8; y += 20 * dpr) ctx.lineTo(x0 + Math.sin(y / H * 6 + t * 0.6 + j) * W * 0.04, y);
        for (let y = H * 0.8; y >= 0; y -= 20 * dpr) ctx.lineTo(x0 + W * 0.08 + Math.sin(y / H * 6 + t * 0.6 + j + 0.8) * W * 0.04, y);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }
  function frame(now) {
    const t = (now - t0) / 1000;
    ctx.fillStyle = '#0B0908'; ctx.fillRect(0, 0, W, H);
    const f = prev ? Math.min(1, (now - fadeStart) / FADE) : 1;
    if (prev && f < 1) { blobs(prev, t, 1 - f); overlay(prev, t, 1 - f); }
    if (cur) { blobs(cur, t, f); overlay(cur, t, f); }
    if (prev && f >= 1) prev = null;
    // soft vignette keeps text areas calm
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(11,9,8,0)'); v.addColorStop(1, 'rgba(11,9,8,.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  function loop(now) { if (!running) { raf = 0; return; } frame(now); raf = requestAnimationFrame(loop); }
  const kick = () => { if (running && !raf) raf = requestAnimationFrame(loop); };
  const onResize = () => { size(); if (!running) frame(performance.now()); };
  const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else kick(); };
  size(); addEventListener('resize', onResize); document.addEventListener('visibilitychange', onVis);
  let ro = null; if (window.ResizeObserver) { ro = new ResizeObserver(onResize); ro.observe(canvas); }

  return {
    setMix(m, { instant = false } = {}) {
      if (cur && m && cur.id === m.id && cur.a === m.a && cur.motion === m.motion && cur.bpm === m.bpm && cur.b === m.b && cur.c === m.c) return;
      prev = instant || reduced ? null : cur; cur = m; fadeStart = performance.now();
      if (!running) frame(performance.now() + FADE); else kick();
    },
    pause() { running = false; },
    play() { if (reduced) return; running = true; kick(); },
    get playing() { return running; },
    destroy() { running = false; cancelAnimationFrame(raf); removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis); if (ro) ro.disconnect(); },
  };
}

/* ---------------- tint the page with a mix ---------------- */
export function applyMixVars(el, m) {
  el.style.setProperty('--cu', m.a);
  el.style.setProperty('--cu-deep', m.b);
  el.style.setProperty('--glow', m.c);
  el.style.setProperty('--cu-hi', lighten(m.a, 0.35));
  el.style.setProperty('--beat', (60 / m.bpm).toFixed(3) + 's');
}
