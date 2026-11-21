// Logo reel: plays the owner's chosen JARIN logo animations one after another, blended into
// the animated background (black becomes transparent). Reduced motion shows a still frame.
import { LOGO_VIDEOS } from './content.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountReel(el, cfg) {
  if (!el) return;
  const list = (cfg && cfg.enabled !== false ? cfg.videos || [] : []).filter(v => v.enabled !== false && LOGO_VIDEOS[v.id]);
  const sig = JSON.stringify(list.map(v => v.id));
  if (el.dataset.reel === sig && el.querySelector('video')) return;
  el.dataset.reel = sig;
  el.innerHTML = '';
  el.hidden = !list.length;
  if (!list.length) return;
  let i = 0;
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
  v.preload = 'metadata'; v.disablePictureInPicture = true; v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1;
  const load = () => { const id = list[i].id; v.poster = `/media/${id}.jpg`; v.src = `/media/${id}.mp4`; el.dataset.clip = id; };
  load();
  el.appendChild(v);
  if (reduced) return;                                   // poster only
  v.addEventListener('ended', () => { i = (i + 1) % list.length; el.classList.add('swap'); setTimeout(() => { load(); v.play().catch(() => {}); el.classList.remove('swap'); }, 250); });
  if (list.length === 1) v.loop = true;
  // only play while visible, to save battery and data
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }), { threshold: 0.2 });
  io.observe(el);
}
