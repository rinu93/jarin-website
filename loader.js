// Loading screen: plays the owner's JARIN logo animations for a set time (default 15 s), then
// reveals the site. Shown once per visit, always skippable (button, Esc, or a tap anywhere).
// Reduced motion: a still logo for a moment instead.
import { DEFAULT_CONTENT, LOGO_VIDEOS } from './content.js';
import { supabase, configured } from './supabase.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function showLoader() {
  let seen = false;
  try { seen = sessionStorage.getItem('jarin-loader') === '1'; sessionStorage.setItem('jarin-loader', '1'); } catch { /* private mode */ }
  if (seen) return;

  const el = document.createElement('div');
  el.className = 'loader';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'JARIN Fitness Studio is loading');
  el.innerHTML = `<div class="loader-reel" aria-hidden="true"><video muted playsinline preload="auto"></video></div>
    <div class="loader-bar" aria-hidden="true"><i></i></div>
    <button class="loader-skip" type="button">Skip intro</button>`;
  document.body.appendChild(el);
  document.documentElement.classList.add('loading');
  const v = el.querySelector('video'); const bar = el.querySelector('.loader-bar i');
  v.muted = true; v.setAttribute('playsinline', '');
  el.querySelector('.loader-skip').focus({ preventScroll: true });

  let list = [], i = 0, timer = 0, closed = false;
  const close = () => {
    if (closed) return; closed = true; clearTimeout(timer);
    el.classList.add('out'); document.documentElement.classList.remove('loading');
    removeEventListener('keydown', onKey);
    setTimeout(() => { v.pause(); el.remove(); }, 600);
  };
  const onKey = e => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(); } };
  addEventListener('keydown', onKey);
  el.addEventListener('click', close);

  const play = () => {
    const id = list[i].id;
    v.poster = `/media/${id}.jpg`; v.src = `/media/${id}.mp4`;
    if (!reduced) v.play().catch(() => {});
  };
  v.addEventListener('ended', () => { i = (i + 1) % list.length; play(); });

  const start = cfg => {
    if (closed) return;
    list = ((cfg && cfg.videos) || []).filter(x => x.enabled !== false && LOGO_VIDEOS[x.id]);
    if (!list.length || (cfg && cfg.loader === false)) { close(); return; }
    const secs = reduced ? 2 : Math.min(60, Math.max(3, Number(cfg.loaderSeconds) || 15));
    play();
    bar.style.animationDuration = secs + 's'; bar.classList.add('run');
    timer = setTimeout(close, secs * 1000);
  };

  // Use the owner's settings if they arrive quickly; otherwise start with the defaults.
  let started = false;
  const go = cfg => { if (!started) { started = true; start(cfg); } };
  setTimeout(() => go(DEFAULT_CONTENT.logo_reel), 700);
  if (configured) supabase.from('site_content').select('value').eq('key', 'logo_reel').maybeSingle()
    .then(({ data }) => go(data ? data.value : DEFAULT_CONTENT.logo_reel), () => go(DEFAULT_CONTENT.logo_reel));
  else go(DEFAULT_CONTENT.logo_reel);
}
