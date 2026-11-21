// Intro screen: plays the owner's chosen JARIN logo animation every time a page opens
// (website, Employee login, Member login), for the length the owner set, then dissolves
// through frosted glass into the page. Settings: Employee Dashboard → Themes → Logo animations.
// Shared by the website, the Member portal and the Employee Dashboard. Keep copies in sync.
import { DEFAULT_CONTENT, LOGO_VIDEOS, introFor } from './content.js';
import { supabase, configured } from './supabase.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CACHE = 'jarin-logo-reel';
const CSS = `html.jl-on,html.jl-on body{overflow:hidden}
.jl{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;overflow:hidden;background:rgba(11,9,8,1);
  -webkit-backdrop-filter:blur(30px) saturate(1.6);backdrop-filter:blur(30px) saturate(1.6);
  transition:background-color .9s cubic-bezier(.4,0,.2,1),-webkit-backdrop-filter 1s cubic-bezier(.4,0,.2,1),backdrop-filter 1s cubic-bezier(.4,0,.2,1),opacity .6s ease}
.jl-reel{width:min(520px,82vw,70vh);aspect-ratio:1;-webkit-mask-image:radial-gradient(closest-side,#000 78%,transparent 100%);mask-image:radial-gradient(closest-side,#000 78%,transparent 100%);
  transition:transform 1.1s cubic-bezier(.2,.7,.2,1),opacity .8s ease,filter .9s ease}
.jl-reel video{width:100%;height:100%;object-fit:cover;display:block;transition:opacity .35s ease}
.jl-reel.swap video{opacity:0}
.jl-bar{position:absolute;left:50%;bottom:calc(44px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:min(220px,50vw);height:2px;border-radius:2px;background:rgba(244,235,226,.12);overflow:hidden;transition:opacity .4s}
.jl-bar i{display:block;height:100%;width:0;background:#E8A272}
.jl-bar i.run{animation:jl-bar linear forwards}
@keyframes jl-bar{to{width:100%}}
.jl::after{content:"";position:absolute;inset:-20%;pointer-events:none;opacity:0;
  background:linear-gradient(105deg,transparent 35%,rgba(255,240,228,.16) 47%,rgba(255,255,255,.28) 50%,rgba(255,240,228,.16) 53%,transparent 65%);transform:translateX(-60%)}
.jl.glass{background:rgba(11,9,8,.28)}
.jl.glass::after{opacity:1;transform:translateX(60%);transition:transform 1.1s cubic-bezier(.4,0,.2,1),opacity .3s}
.jl.glass .jl-reel{transform:scale(1.14);opacity:0;filter:blur(10px)}
.jl.glass .jl-bar{opacity:0}
.jl.out{background:rgba(11,9,8,0);-webkit-backdrop-filter:blur(0) saturate(1);backdrop-filter:blur(0) saturate(1);opacity:0}
@media (prefers-reduced-motion: reduce){.jl,.jl-reel,.jl::after{transition-duration:.01s!important}}`;

const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch { return null; } };
const writeCache = v => { try { localStorage.setItem(CACHE, JSON.stringify(v)); } catch { /* storage off */ } };

// screen: 'website' | 'employee' | 'member'. Returns a promise that resolves when the page is revealed.
export function showLoader(screen = 'website') {
  if (document.querySelector('.jl')) return Promise.resolve();
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'jl'; el.setAttribute('role', 'img'); el.setAttribute('aria-label', 'JARIN Fitness Studio');
  el.innerHTML = `<div class="jl-reel" aria-hidden="true"><video muted playsinline preload="auto" disablepictureinpicture></video></div><div class="jl-bar" aria-hidden="true"><i></i></div>`;
  document.body.appendChild(el);
  document.documentElement.classList.add('jl-on');
  const reel = el.querySelector('.jl-reel'); const v = el.querySelector('video'); const bar = el.querySelector('.jl-bar i');
  v.muted = true;

  let done; const revealed = new Promise(r => { done = r; });
  let closed = false;
  const close = (fast = false) => {
    if (closed) return; closed = true;
    document.documentElement.classList.remove('jl-on');
    const finish = () => { v.pause(); el.remove(); style.remove(); done(); };
    if (fast) { el.classList.add('out'); setTimeout(finish, 600); return; }
    el.classList.add('glass');                                   // page appears behind frosted glass
    setTimeout(() => el.classList.add('out'), 650);               // glass clears
    setTimeout(finish, 1700);
  };

  let list = [], i = 0;
  const load = () => { const id = list[i]; v.poster = `/media/${id}.jpg`; v.src = `/media/${id}.mp4`; if (!reduced) v.play().catch(() => {}); };
  v.addEventListener('ended', () => {
    if (list.length < 2) return;
    reel.classList.add('swap');
    setTimeout(() => { i = (i + 1) % list.length; load(); reel.classList.remove('swap'); }, 300);
  });

  const start = rc => {
    const c = introFor(rc, screen);
    const enabled = ((rc && rc.videos) || DEFAULT_CONTENT.logo_reel.videos).filter(x => x.enabled !== false && LOGO_VIDEOS[x.id]).map(x => x.id);
    list = c.clip === 'all' ? enabled : [c.clip];
    if (!c.on || !list.length) { close(true); return; }
    v.loop = list.length === 1;
    load();
    const secs = reduced ? 1.5 : c.seconds;
    bar.style.animationDuration = secs + 's'; bar.classList.add('run');
    setTimeout(() => close(), secs * 1000);
  };

  // Use the owner's latest settings; fall back to the last ones seen on this device, then the defaults.
  let started = false;
  const go = rc => { if (!started) { started = true; start(rc); } };
  setTimeout(() => go(readCache() || DEFAULT_CONTENT.logo_reel), 900);
  if (configured) supabase.from('site_content').select('value').eq('key', 'logo_reel').maybeSingle()
    .then(({ data }) => { const rc = data ? data.value : DEFAULT_CONTENT.logo_reel; writeCache(rc); go(rc); }, () => go(readCache() || DEFAULT_CONTENT.logo_reel));
  else go(DEFAULT_CONTENT.logo_reel);
  return revealed;
}
