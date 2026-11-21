// Interaction layer, inspired by the best-UI examples (Popin, Fit Song, M&C Saatchi, White Coffee):
// a quick preloader, scroll-driven type, a marquee band, a scrubbed step line, parallax + tilt on
// the equipment art, and magnetic primary buttons. Everything is skipped for reduced motion.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

/* Preloader: plates load onto the bar once per visit, never longer than ~0.9s. */
export function preloader() {
  let seen = false; try { seen = sessionStorage.getItem('jarin-pre') === '1'; sessionStorage.setItem('jarin-pre', '1'); } catch { /* ignore */ }
  if (reduced || seen) return;
  const p = document.createElement('div');
  p.className = 'pre'; p.setAttribute('aria-hidden', 'true');
  p.innerHTML = '<div class="pre-in"><span><i></i><i></i><i></i></span><b>JARIN</b><span class="r"><i></i><i></i><i></i></span></div>';
  document.body.appendChild(p);
  const done = () => { p.classList.add('out'); setTimeout(() => p.remove(), 600); };
  setTimeout(done, 900);
}

/* Marquee band: drifts on its own, speeds up with scroll velocity. */
export function marquee() {
  const rows = [...document.querySelectorAll('.mq-row')];
  if (!rows.length) return;
  if (reduced) return;
  let x = 0, v = 0, lastY = scrollY, raf = 0;
  const widths = rows.map(r => r.firstElementChild.getBoundingClientRect().width);
  const tick = () => {
    const dy = scrollY - lastY; lastY = scrollY;
    v = v * 0.9 + Math.min(40, Math.abs(dy)) * 0.12;
    x += 0.6 + v;
    rows.forEach((r, i) => { const w = widths[i] || 1; const off = (x % w); r.style.transform = `translate3d(${i % 2 ? off - w : -off}px,0,0)`; });
    raf = requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { if (!raf) raf = requestAnimationFrame(tick); } else { cancelAnimationFrame(raf); raf = 0; } }));
  io.observe(document.querySelector('.mq'));
}

/* Scroll-linked motion: hero lines slide apart, the rack lifts, steps line fills, equipment art drifts. */
export function scrollFx() {
  if (reduced) return;
  const lines = [...document.querySelectorAll('.hero h1 span')];
  const rack = document.querySelector('.rack');
  const steps = document.querySelector('.steps');
  const arts = [...document.querySelectorAll('.eq-art svg')];
  let ticking = false;
  const update = () => {
    ticking = false;
    const vh = innerHeight; const y = scrollY;
    const p = Math.min(1, y / (vh * 0.9));
    lines.forEach((l, i) => { l.style.transform = `translate3d(${(i % 2 ? 1 : -1) * p * 90}px,0,0)`; l.style.opacity = String(1 - p * 0.55); });
    if (rack) rack.style.transform = `translate3d(0,${-p * 40}px,0) scale(${1 + p * 0.06})`;
    if (steps) {
      const r = steps.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (vh * 0.7 - r.top) / r.height));
      steps.style.setProperty('--fill-n', f.toFixed(3));
      steps.querySelectorAll('li').forEach((li, i, all) => li.classList.toggle('lit', f >= (i + 0.35) / all.length));
    }
    arts.forEach(a => { const r = a.parentElement.getBoundingClientRect(); const c = (r.top + r.height / 2 - vh / 2) / vh; a.style.transform = `translate3d(0,${c * -18}px,0)`; });
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); update();
}

/* Pointer micro-interactions: tilt cards toward the cursor, primary buttons lean in. */
export function pointerFx() {
  if (reduced || !fine) return;
  document.querySelectorAll('.eq, .plan').forEach(card => {
    if (card.dataset.fx) return; card.dataset.fx = '1';
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) translateY(-4px)`;
      card.style.setProperty('--mx', ((px + 0.5) * 100).toFixed(1) + '%'); card.style.setProperty('--my', ((py + 0.5) * 100).toFixed(1) + '%');
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
  document.querySelectorAll('.btn-cu').forEach(b => {
    if (b.dataset.fx) return; b.dataset.fx = '1';
    b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${((e.clientX - r.left) / r.width - 0.5) * 8}px,${((e.clientY - r.top) / r.height - 0.5) * 6}px)`; });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });
}
