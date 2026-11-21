// Website side of the workout mixes: loads the owner's mixes, rotates them, and shows a
// Spotify-style "Now playing" control so visitors can skip or pause the moving background.
import { DEFAULT_MIXES, DEFAULT_CONFIG, fromRow, configFromRow, playlist, createStage, applyMixVars } from './mixes.js';
import { supabase, configured } from './supabase.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY = 'jarin-mix';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = { get() { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch { return {}; } }, set(v) { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } } };

let mixes = DEFAULT_MIXES.map(m => ({ ...m, enabled: true }));
let config = { ...DEFAULT_CONFIG };
let list = [], idx = 0, stage, el, timer = 0, startedAt = 0, paused = false, remaining = 0;

export function mountPlayer() {
  const canvas = document.createElement('canvas');
  canvas.id = 'stage'; canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  stage = createStage(canvas, { reduced });

  el = document.createElement('div');
  el.className = 'np'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Background theme');
  document.body.appendChild(el);
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-np]'); if (!b) return;
    if (b.dataset.np === 'next') step(1);
    if (b.dataset.np === 'prev') step(-1);
    if (b.dataset.np === 'toggle') togglePause();
  });

  const saved = store.get();
  paused = !!saved.paused || reduced;
  rebuild(saved.id);
  load();
}

async function load() {
  if (!configured) return;
  try {
    const [t, c] = await Promise.all([
      supabase.from('site_themes').select('*').eq('enabled', true).order('sort'),
      supabase.from('site_theme_config').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (!t.error && t.data && t.data.length) mixes = t.data.map(fromRow);
    if (!c.error && c.data) config = configFromRow(c.data);
    rebuild(list[idx] && list[idx].id);
    // the owner's changes show up live, without a reload
    supabase.channel('jfs-themes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_themes' }, () => reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_theme_config' }, () => reload())
      .subscribe();
  } catch { /* keep the built-in mixes */ }
}
let reloadT = 0;
function reload() { clearTimeout(reloadT); reloadT = setTimeout(load, 300); }

function rebuild(keepId) {
  list = playlist(mixes, config);
  const i = list.findIndex(m => m.id === keepId);
  idx = i >= 0 ? i : 0;
  play(true);
}
function play(fresh) {
  const m = list[idx];
  applyMixVars(document.documentElement, m);
  stage.setMix(m);
  if (paused) stage.pause(); else stage.play();
  store.set({ id: m.id, paused });
  clearTimeout(timer);
  if (fresh) remaining = config.intervalSec * 1000;
  if (!paused && list.length > 1) { startedAt = performance.now(); timer = setTimeout(() => step(1), remaining); }
  draw();
}
function step(d) {
  if (list.length < 2) return;
  idx = (idx + d + list.length) % list.length;
  play(true);
}
function togglePause() {
  paused = !paused;
  if (paused) { remaining = Math.max(1000, remaining - (performance.now() - startedAt)); clearTimeout(timer); stage.pause(); }
  play(false);
}

function draw() {
  const m = list[idx]; const many = list.length > 1; const ctl = config.visitorControls;
  const label = config.mode === 'pinned' ? 'Today’s mix' : config.mode === 'daypart' ? 'Playing this hour' : 'Now playing';
  el.classList.toggle('paused', paused);
  el.style.setProperty('--dur', (remaining / 1000) + 's');
  el.style.setProperty('--from', Math.max(0, Math.min(100, (1 - remaining / (config.intervalSec * 1000)) * 100)) + '%');
  el.innerHTML = `
    <span class="np-art" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="np-txt"><small>${label}</small><b>${esc(m.name)}</b><span>${m.bpm} BPM${m.tagline ? ' · ' + esc(m.tagline) : ''}</span></span>
    <span class="np-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    ${ctl ? `<span class="np-ctl">
      ${many ? `<button data-np="prev" aria-label="Previous theme"><svg viewBox="0 0 24 24"><path d="M6 5v14M19 5l-10 7 10 7z"/></svg></button>` : ''}
      ${reduced ? '' : `<button data-np="toggle" aria-label="${paused ? 'Play background animation' : 'Pause background animation'}">${paused ? '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M7 4h4v16H7zM14 4h4v16h-4z"/></svg>'}</button>`}
      ${many ? `<button data-np="next" aria-label="Next theme"><svg viewBox="0 0 24 24"><path d="M18 5v14M5 5l10 7-10 7z"/></svg></button>` : ''}
    </span>` : ''}
    ${many ? `<span class="np-bar" aria-hidden="true"><i ${paused ? '' : 'class="run"'}></i></span>` : ''}`;
}
