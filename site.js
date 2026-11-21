import './site.css';
import { SITE, openStatus, fmtTime, waNumber, telNumber } from './site-config.js';
import { DEFAULT_CONTENT, contentFromRows, applyToSite, livePlans, perMonth, periodLabel, money as rupees, OFFER_KINDS } from './content.js';
import { mountReel } from './reel.js';
import { MARK, BRAND } from './brand.js';
import { supabase, configured } from './supabase.js';
import { mountChat, openChat } from './chat.js';
import { mountPlayer } from './player.js';
import { preloader, marquee as marqueeFx, scrollFx, pointerFx } from './fx.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => (SITE.currency || '₹') + Number(n).toLocaleString('en-IN');
const plates = '<span class="plates" aria-hidden="true"><i></i><i></i><i></i></span>';

/* ---------------- icons (24×24 line) ---------------- */
const I = {
  strength: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  cardio: '<path d="M12 20s-7.5-4.6-9.2-9.2A5 5 0 0 1 12 6.6a5 5 0 0 1 9.2 4.2C19.5 15.4 12 20 12 20z"/><path d="M6.5 12h2.8l1.6-2.6 2.2 5.2 1.6-2.6h2.8"/>',
  hiit: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 2.5v3.5M9.5 2.5h5"/><path d="M13 9l-2.8 4.6h3.6L11 18"/>',
  pt: '<circle cx="12" cy="7" r="3.5"/><path d="M4.5 21v-1.5A5.5 5.5 0 0 1 10 14h4a5.5 5.5 0 0 1 5.5 5.5V21"/><path d="M15.5 3.5l1.6 1.6 3.2-3.2"/>',
  nutrition: '<path d="M12 7.5c-1.2-1.8-4.3-2.6-6.2-.8-3.1 3-1 10.3 2.2 12.4 1.5 1 2.6.6 4 0 1.4.6 2.5 1 4 0 3.2-2.1 5.3-9.4 2.2-12.4-1.9-1.8-5-1-6.2.8z"/><path d="M12 7.5c0-2.2 1.2-4.2 3.5-5"/>',
  functional: '<path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><path d="M6 15.5a6 6 0 0 1 12 0c0 2.2-1 3.5-1 3.5H7s-1-1.3-1-3.5z"/>',
  transformation: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  ladies: '<circle cx="12" cy="8.5" r="5"/><path d="M12 13.5V21M9 18h6"/>',
  yoga: '<circle cx="12" cy="4.5" r="2"/><path d="M12 8v5M4.5 10.5l7.5 2.5 7.5-2.5M7.5 21l4.5-8 4.5 8"/>',
  boxing: '<path d="M7 9a5 5 0 0 1 10 0v4.5a5 5 0 0 1-5 5H9a2 2 0 0 1-2-2z"/><path d="M7 13H6a2 2 0 0 1 0-4h1M9 18.5V21h7v-2.5"/>',
  app: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/><rect x="9" y="6" width="6" height="4" rx="1"/>',
  qr: '<rect x="3.5" y="3.5" width="6" height="6" rx="1"/><rect x="14.5" y="3.5" width="6" height="6" rx="1"/><rect x="3.5" y="14.5" width="6" height="6" rx="1"/><path d="M14.5 14.5h2.5v2.5M20.5 14.5v.5M14.5 20.5h6v-3"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M7.5 15l3.5-4 3 2.5 4.5-6"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  gift: '<rect x="3.5" y="9" width="17" height="11.5" rx="1.5"/><path d="M3.5 13h17M12 9v11.5M12 9c-1.5-3.5-6-4-6-1.5S10 9 12 9zm0 0c1.5-3.5 6-4 6-1.5S14 9 12 9z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M8.5 14.5l2.3 2.3 4.7-4.6"/>',
  snow: '<path d="M12 2.5v19M4 7l16 10M20 7L4 17"/><path d="M9.5 4.5L12 6l2.5-1.5M9.5 19.5L12 18l2.5 1.5"/>',
  locker: '<rect x="4.5" y="2.5" width="15" height="19" rx="1.5"/><path d="M12 2.5v19M8 8v2M16 8v2"/>',
  water: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  shield: '<path d="M12 2.5l7.5 3v6c0 5-3.3 8.5-7.5 10-4.2-1.5-7.5-5-7.5-10v-6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  coach: '<circle cx="12" cy="6.5" r="3.5"/><path d="M5 21v-2a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v2"/>',
  car: '<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v3H3zM7 19v2M17 19v2"/>',
  phone: '<path d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  chat: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  insta: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  member: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16a3.3 3.3 0 0 1 6.4 0M14 10h4M14 13.5h3"/>',
  staff: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2M3 12.5h18"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  sq: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.5h17M9.5 3.5v17"/>',
};
const icon = k => `<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k] || I.strength}</svg>`;

/* ---------------- the rack: one bar, plates of rising height (from the logo) ---------------- */
function rack() {
  // right-hand stack mirrors the logo: plates get taller towards the inside
  const R = [[1052, 76, 30, 108, 'p1'], [1010, 46, 36, 168, 'p2'], [962, 12, 42, 236, 'p3']];
  const L = [[108, 76, 30, 108, 'q1'], [146, 46, 36, 168, 'q2'], [196, 12, 42, 236, 'q3']];
  const plate = ([x, y, w, h, c], dir) => `<g class="plate ${c}" style="--from:${dir * 140}px"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="url(#cu)"/><rect x="${x + 5}" y="${y + 12}" width="4" height="${h - 24}" rx="2" fill="#FFE3CC" opacity=".35"/></g>`;
  return `<div class="rack" aria-hidden="true"><svg viewBox="0 0 1200 260" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id="cu" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--cu-hi)"/><stop offset=".5" style="stop-color:var(--cu)"/><stop offset="1" style="stop-color:var(--cu-deep)"/></linearGradient>
      <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4E4038"/><stop offset=".5" stop-color="#C9A58A"/><stop offset="1" stop-color="#2E2520"/></linearGradient>
      <radialGradient id="floor" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity=".7"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse cx="600" cy="252" rx="560" ry="10" fill="url(#floor)"/>
    <rect class="bar" x="20" y="124" width="1160" height="12" rx="6"/>
    <g stroke="#2A221D" stroke-opacity=".6">${Array.from({ length: 40 }, (_, i) => `<path d="M${430 + i * 8.5} 125v10"/>`).join('')}</g>
    <rect x="248" y="112" width="14" height="36" rx="3" fill="url(#steel)"/><rect x="938" y="112" width="14" height="36" rx="3" fill="url(#steel)"/>
    ${L.map(p => plate(p, -1)).join('')}${R.map(p => plate(p, 1)).join('')}
  </svg></div>`;
}

const EQ_ART = {
  treadmill: `<svg viewBox="0 0 200 150"><path class="soft" d="M14 136h172"/><path d="M26 118 L172 100 L176 111 L30 129 Z"/><circle cx="34" cy="124" r="5"/><circle cx="168" cy="106" r="5"/><path class="soft" d="M50 117l100-12M60 120l90-11"/><path d="M152 102 L138 42"/><path d="M146 66 L110 72"/><rect x="118" y="24" width="48" height="20" rx="4" transform="rotate(-12 142 34)"/></svg>`,
  rack: `<svg viewBox="0 0 200 150"><path class="soft" d="M10 138h180"/><path d="M48 138V16M152 138V16M40 16h120M48 60h-8M152 60h8"/><path d="M14 58h172" stroke-width="4"/><rect x="18" y="38" width="12" height="40" rx="3" class="fillcu"/><rect x="30" y="44" width="8" height="28" rx="2" class="fillcu"/><rect x="170" y="38" width="12" height="40" rx="3" class="fillcu"/><rect x="162" y="44" width="8" height="28" rx="2" class="fillcu"/><path d="M70 112h60M78 112v26M122 112v26"/></svg>`,
  dumbbells: `<svg viewBox="0 0 200 150"><path class="soft" d="M10 140h180"/><path d="M20 76h160M14 116h172M30 76l-12 64M170 76l12 64"/>${[30, 66, 102, 138].map((x, i) => { const h = 12 + i * 3; return `<path d="M${x} ${70 - h / 2}h24"/><rect x="${x - 2}" y="${70 - h}" width="7" height="${h}" rx="2" class="fillcu"/><rect x="${x + 19}" y="${70 - h}" width="7" height="${h}" rx="2" class="fillcu"/>`; }).join('')}${[24, 64, 104, 144].map((x, i) => { const h = 16 + i * 3; return `<path d="M${x} ${110 - h / 2}h30"/><rect x="${x - 2}" y="${110 - h}" width="9" height="${h}" rx="2" class="fillcu"/><rect x="${x + 23}" y="${110 - h}" width="9" height="${h}" rx="2" class="fillcu"/>`; }).join('')}</svg>`,
  kettlebell: `<svg viewBox="0 0 200 150"><path class="soft" d="M10 138h180"/><path d="M60 78V60a24 24 0 0 1 48 0v18" stroke-width="6"/><path d="M48 104a36 36 0 1 1 72 0c0 16-6 28-9 34H57c-3-6-9-18-9-34z" class="fillcu"/><path d="M134 104V94a14 14 0 0 1 28 0v10" stroke-width="4"/><path d="M128 120a20 20 0 1 1 40 0c0 8-3 14-5 18h-30c-2-4-5-10-5-18z" class="fillcu" opacity=".75"/></svg>`,
};


/* ---------------- content (live from the dashboard, defaults until it loads) ---------------- */
let C = contentFromRows([]);
let OFFERS = [];
applyToSite(SITE, C);
const cultPlans = () => livePlans(C).filter(p => p.cult).map(p => p.name);

/* ---------------- sections ----------------
   Order: hero (facts) → plans → what you get → offers → trial → training → member app → extras
   → equipment → visit → good to know. Each fact appears once; later sections refer back to it. */
const dashUrl = SITE.dashboardUrl || '#';
const header = () => `<header class="top" id="top"><div class="wrap top-in">
  <a class="logo" href="#" aria-label="${esc(BRAND)} home">${MARK}<span class="wm"><b>JARIN</b><small>FITNESS STUDIO</small></span></a>
  <nav class="nav" aria-label="Sections"><a href="#plans">Plans</a><a href="#offers" id="navOffers" hidden>Offers</a><a href="#trial">Trial</a><a href="#training">Training</a><a href="#digital">App</a><a href="#visit">Visit</a></nav>
  <div class="logins" role="group" aria-label="Sign in">
    <a href="${esc(dashUrl)}" aria-label="Employee login">${icon('staff')}<span>Employee</span></a>
    <a class="member" href="/member" aria-label="Member login">${icon('member')}<span>Member</span></a>
  </div>
  <button class="burger" id="burger" aria-label="Open menu" aria-expanded="false">${icon('menu')}</button>
</div></header>`;

const FACT_ICONS = ['sq', 'calendar', 'strength', 'coach'];
const facts = () => `<div class="facts" id="facts">${C.facts.slice(0, 4).map((f, i) => `<div class="fact">${icon(FACT_ICONS[i] || 'check')}<div><b>${esc(f.value)}</b><span>${esc(f.label)}</span></div></div>`).join('')}</div>`;

function hero() {
  const st = openStatus();
  return `<section class="hero"><div class="wrap">
    <div class="hero-grid">
      <div>
        <div class="hero-top">${C.fees.banner ? `<span class="banner" id="banner">${esc(C.fees.banner)}</span>` : '<span id="banner" hidden></span>'}<p class="open ${st.open ? 'on' : ''}" id="openNow"><i></i><span>${esc(st.label)}</span></p></div>
        <h1><span>Glow up.</span><span>Lift up.</span><span>Level up.</span></h1>
        <p class="lede">${esc(SITE.intro)}</p>
        <div class="cta"><a class="btn btn-cu" href="#trial">Book a trial day</a><a class="btn btn-line" href="#plans">See plans</a></div>
      </div>
      <div class="reel" id="reel" aria-hidden="true"></div>
    </div>
    ${rack()}
    ${facts()}
  </div></section>`;
}

function marquee() {
  const set = ['Strength', 'HIIT', 'Cardio', 'Functional', 'Bodybuilding', 'Personal training'].map(w => `<span>${esc(w)}</span><i></i>`).join('');
  const alt = ['Push day', 'Pull day', 'Leg day', 'Core', 'Mobility', 'Morning grind', 'Evening pump'].map(w => `<span>${esc(w)}</span><i></i>`).join('');
  return `<div class="mq" aria-hidden="true"><div class="mq-row"><div>${set}</div><div>${set}</div></div><div class="mq-row out"><div>${alt}</div><div>${alt}</div></div></div>`;
}

function plans() {
  const ps = livePlans(C); const f = C.fees;
  const same = ps.length > 1 && ps.every(p => perMonth(p) === perMonth(ps[0]));
  return `<section id="plans"><div class="wrap">
    <div class="sec-top"><div>${plates}<h2>Pick your plan</h2></div><p class="lede">${same ? `The same ${esc(rupees(perMonth(ps[0])))} a month, whichever plan you choose.` : 'Longer plans cost less per month.'}${cultPlans().length ? ` Go ${esc(cultPlans().join(' or ').toLowerCase())} to unlock the Cult app.` : ''}</p></div>
    <ol class="psteps">
      <li class="pstep"><span class="pnum">Step 1</span><div><h3>One-time registration</h3><p>Paid once when you join, on every plan.</p></div><b class="pprice">${esc(rupees(f.registration))}</b></li>
      <li class="pstep wide"><span class="pnum">Step 2</span><div><h3>Choose your membership</h3></div>
        <div class="plan-grid">${ps.map(p => `<article class="plan ${p.popular ? 'pop' : ''}">${p.popular ? '<span class="tag">Most chosen</span>' : ''}
          <h3>${esc(p.name)}</h3><div class="price">${esc(rupees(p.price))}<small>${esc(periodLabel(p))}</small></div>
          <ul>${same ? '' : `<li>${icon('check')}<span>Works out to ${esc(rupees(perMonth(p)))} a month</span></li>`}<li>${icon('check')}<span>Pay on joining ${esc(rupees(p.price + f.registration))}, registration included</span></li>${p.cult ? `<li class="cult">${icon('app')}<span>Cult app access included</span></li>` : ''}</ul>
          <a class="btn ${p.popular ? 'btn-cu' : 'btn-line'} btn-sm" href="#trial" data-plan="${esc(p.name)}">Choose ${esc(p.name)}</a></article>`).join('')}</div></li>
      <li class="pstep"><span class="pnum">Step 3 · optional</span><div><h3>Add a personal trainer</h3><p>One-to-one coaching with a plan of your own, on any membership.</p></div><b class="pprice">${esc(rupees(f.ptMonthly))}<small>/month</small></b></li>
    </ol>
    ${f.locker ? `<p class="note">Want your own locker? A personal locker is ${esc(rupees(f.locker))} a month.</p>` : ''}
  </div></section>`;
}

function benefits() {
  const ps = livePlans(C);
  const has = (b, p) => b.who === 'all' || (b.who === 'annual' && p.cult);
  return `<section id="benefits"><div class="wrap">
    <div class="sec-top"><div>${plates}<h2>What you get</h2></div><p class="lede">Every plan opens the full floor at all opening hours. Here is what comes with each one.</p></div>
    <div class="ben-wrap"><table class="ben"><thead><tr><th scope="col">Benefit</th>${ps.map(p => `<th scope="col">${esc(p.name)}</th>`).join('')}</tr></thead>
      <tbody>${C.benefits.map(b => `<tr><th scope="row">${esc(b.text)}</th>${ps.map(p => `<td>${has(b, p) ? `<span class="yes" aria-label="Included">${icon('check')}</span>` : '<span class="no" aria-label="Not included">–</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  </div></section>`;
}

const offers = () => `<section id="offers" hidden><div class="wrap">
  <div class="sec-top"><div>${plates}<h2>Offers</h2></div><p class="lede">Limited-time prices, student rates and rewards for bringing friends.</p></div>
  <div class="tabs" role="tablist" aria-label="Offer types" id="offerTabs"></div>
  <div class="offer-grid" id="offerList" role="tabpanel"></div>
</div></section>`;

function trial() {
  const interests = ['Membership enquiry', ...livePlans(C).map(p => `${p.name} plan`), 'Personal trainer', ...SITE.services.map(s => s.title), ...C.services.map(s => s.title)];
  const pass = C.fees.trialPass ? `The one-day pass is ${rupees(C.fees.trialPass)}.` : 'Your trial day is free.';
  return `<section class="trial" id="trial"><div class="wrap tg">
    <div>
      ${plates}
      <h2>Try a day at JARIN</h2>
      <p class="lede" id="trialLede">Send your details and a coach calls to fix your trial day. ${esc(pass)}</p>
      <ol class="steps">
        <li><b>1</b><div><h3>Book a slot</h3><p>Send the form, or ask the assistant in the corner of the page.</p></div></li>
        <li><b>2</b><div><h3>Tour and body check</h3><p>See the floor, meet a coach and get a body composition reading.</p></div></li>
        <li><b>3</b><div><h3>Train with a coach</h3><p>A guided workout planned around your goal. No obligation to join.</p></div></li>
      </ol>
    </div>
    <form class="form" id="trialForm" novalidate>
      <h3>Book a trial day</h3>
      <label>Full name<input id="t_name" name="name" required maxlength="100" autocomplete="name"></label>
      <label>Phone<input id="t_phone" name="phone" type="tel" required maxlength="30" autocomplete="tel" placeholder="+91"></label>
      <label class="full">Email (optional)<input id="t_email" name="email" type="email" maxlength="200" autocomplete="email"></label>
      <label>Interested in<select id="t_interest" name="interest">${[...new Set(interests)].map(x => `<option>${esc(x)}</option>`).join('')}</select></label>
      <label>Best time<select id="t_time" name="preferred_time"><option>Morning (6 – 10 AM)</option><option>Midday (10 AM – 4 PM)</option><option>Evening (4 – 10:30 PM)</option><option>Weekend</option></select></label>
      <label class="full">Your goal (optional)<textarea id="t_msg" name="message" maxlength="1000" placeholder="For example: lose 8 kg before March"></textarea></label>
      <label class="hp" aria-hidden="true">Leave empty<input name="website" tabindex="-1" autocomplete="off"></label>
      <button class="btn btn-cu full" type="submit">Book my trial day</button>
      <div class="msg" id="trialMsg" role="status"></div>
      <p class="alt">Rather chat? <button type="button" data-open-chat>Ask the JARIN assistant</button></p>
    </form>
  </div></section>`;
}

const training = () => `<section id="training"><div class="wrap">
  <div class="sec-top"><div>${plates}<h2>Train your way</h2></div><p class="lede">From your first squat to your next personal best, our trainers plan the work and keep you accountable.</p></div>
  <div class="train-list">${SITE.services.map(s => `<article class="tr"><div class="ic">${icon(s.icon)}</div><div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div></article>`).join('')}</div>
</div></section>`;

function phone() {
  const on = [1, 2, 4, 5, 7, 8, 9, 11, 12, 14, 15, 16, 18, 19, 21, 22, 23, 25, 26];
  return `<div class="phone-wrap" aria-hidden="true"><div class="phone"><div class="notch"></div><div class="screen">
    <div class="ph-hi">${MARK}Hi, Anjali</div>
    <div class="card"><div class="card-top">${MARK}<i>Active</i></div><b>JFS-0042</b><span>Anjali Menon</span><div class="row"><div><small>PLAN</small>Annual</div><div><small>VALID TILL</small>28 Feb</div></div></div>
    <div class="ph-stats"><div><b>16</b><small>visits this month</small></div><div><b style="color:var(--cu)">−4.2</b><small>kg since joining</small></div></div>
    <div class="ph-cal">${Array.from({ length: 28 }, (_, i) => `<span class="${on.includes(i + 1) ? 'on' : ''}">${i + 1}</span>`).join('')}</div>
    <div class="ph-offer">🎁 <b>A renewal offer</b> made just for you</div>
  </div></div></div>`;
}
const digital = () => `<section class="digital" id="digital"><div class="wrap">
  <div class="dg">
    ${phone()}
    <div>
      ${plates}
      <h2>Your gym in your pocket</h2>
      <p class="lede">Your membership card, every visit, your weight and BMI, and your renewal offers live in your own member portal.</p>
      <ul class="dig-list">${(SITE.digital || []).filter(d => d.icon !== 'app').map(d => `<li>${icon(d.icon)}<div><h3>${esc(d.title)}</h3><p>${esc(d.text)}</p></div></li>`).join('')}</ul>
      <div class="cta"><a class="btn btn-line btn-sm" href="/member">${icon('member')}Open the member portal</a></div>
    </div>
  </div>
</div></section>`;

const extras = () => `<section id="extras"><div class="wrap">
  <div class="sec-top"><div>${plates}<h2>Go further</h2></div><p class="lede">Expert support and everything you need on the floor. Ask at the front desk.</p></div>
  <div class="ex-grid">${C.services.map(s => `<article class="ex"><h3>${esc(s.title)}</h3><ul>${(s.items || []).map(([n, p]) => `<li><span>${esc(n)}</span><b>${esc(rupees(p))}</b></li>`).join('')}</ul>${s.note ? `<p>${esc(s.note)}</p>` : ''}</article>`).join('')}</div>
</div></section>`;

const equipment = () => `<section class="equipment" id="equipment"><div class="wrap">
  <div class="sec-top"><div>${plates}<h2>The floor</h2></div><p class="lede">Every machine is serviced on schedule and tracked in our maintenance log.</p></div>
  <div class="eq-grid">${SITE.equipment.map(e => `<article class="eq"><div class="eq-art" aria-hidden="true">${EQ_ART[e.art] || EQ_ART.dumbbells}</div><div class="eq-body"><h3>${esc(e.title)}</h3><ul>${e.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></article>`).join('')}</div>
</div></section>`;

function visit() {
  const dir = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(SITE.mapQuery)}`;
  const closed = C.hours.closed || [];
  return `<section id="visit"><div class="wrap">
    <div class="sec-top"><div>${plates}<h2>Visit the studio</h2></div><p class="lede">${esc(SITE.landmark ? `Find us ${SITE.landmark.charAt(0).toLowerCase() + SITE.landmark.slice(1)}, on Main Road, Thuckalay.` : SITE.addressLines.join(', '))}</p></div>
    <div class="vg">
      <div class="box">
        <ul class="contact">
          <li>${icon('pin')}<div>${SITE.addressLines.map(esc).join('<br>')}</div></li>
          ${closed.length ? `<li>${icon('calendar')}<span>Closed on ${esc(closed.join(', '))}</span></li>` : ''}
          ${C.hours.note ? `<li>${icon('calendar')}<span>${esc(C.hours.note)}</span></li>` : ''}
          ${SITE.parking ? `<li>${icon('car')}<span>${esc(SITE.parking)}</span></li>` : ''}
          <li>${icon('phone')}<a href="tel:${esc(telNumber())}">${esc(SITE.phone)}</a></li>
          <li>${icon('chat')}<a href="https://wa.me/${waNumber()}" target="_blank" rel="noopener">WhatsApp +${esc(waNumber())}</a></li>
          <li>${icon('mail')}<a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a></li>
          ${SITE.instagram ? `<li>${icon('insta')}<a href="https://instagram.com/${esc(SITE.instagram)}" target="_blank" rel="noopener">@${esc(SITE.instagram)}</a></li>` : ''}
        </ul>
        <div class="cta"><a class="btn btn-cu btn-sm" href="${dir}" target="_blank" rel="noopener">Get directions</a><a class="btn btn-line btn-sm" href="https://wa.me/${waNumber()}?text=${encodeURIComponent('Hi JARIN, I would like to know about your latest offers.')}" target="_blank" rel="noopener">Ask about offers</a></div>
      </div>
      <div class="map"><a class="map-fb" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SITE.mapQuery)}" target="_blank" rel="noopener">${icon('pin')}<b>${esc(SITE.name)}</b><span>Open in Google Maps</span></a>
        <iframe title="Map of ${esc(SITE.name)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${encodeURIComponent(SITE.mapQuery)}&output=embed"></iframe></div>
    </div>
  </div></section>`;
}

const terms = () => `<section id="terms" class="terms"><div class="wrap"><h2>Good to know</h2><ul>${C.terms.map(t => `<li>${esc(t)}</li>`).join('')}<li>${esc(C.fees.gstNote)}</li></ul></div></section>`;

const footer = () => `<footer><div class="wrap">
  <div class="fg">
    <div><a class="logo" href="#">${MARK}<span class="wm"><b>JARIN</b><small>FITNESS STUDIO</small></span></a></div>
    <div><h4>Explore</h4><ul><li><a href="#plans">Plans</a></li><li><a href="#offers">Offers</a></li><li><a href="#trial">Trial day</a></li><li><a href="#training">Training</a></li><li><a href="#extras">Diet, physio & stall</a></li></ul></div>
    <div><h4>Sign in</h4><ul><li><a href="/member">Member portal</a></li><li><a href="${esc(dashUrl)}">Employee dashboard</a></li></ul></div>
  </div>
  <div class="legal"><span>© ${new Date().getFullYear()} ${esc(BRAND)}</span><span>Thuckalay, Tamil Nadu</span></div>
</div></footer>`;

/* ---------------- render ---------------- */
preloader();
mountPlayer();
document.getElementById('app').innerHTML = header() + '<main>' + hero() + marquee() + plans() + benefits() + offers() + trial() + training() + digital() + extras() + equipment() + visit() + terms() + '</main>' + footer();
mountChat();
marqueeFx(); scrollFx(); pointerFx();
mountReel(document.getElementById('reel'), C.logo_reel);

const top = document.getElementById('top');
const onScroll = () => top.classList.toggle('solid', window.scrollY > 10);
addEventListener('scroll', onScroll, { passive: true }); onScroll();
const burger = document.getElementById('burger');
burger.addEventListener('click', () => { const o = top.classList.toggle('open'); burger.setAttribute('aria-expanded', String(o)); });
top.querySelectorAll('.nav a').forEach(a => a.addEventListener('click', () => { top.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }));
document.addEventListener('click', e => {
  if (e.target.closest('[data-open-chat]')) { openChat(); return; }
  const plan = e.target.closest('[data-plan]');
  if (plan) { const sel = document.getElementById('t_interest'); const want = `${plan.dataset.plan} plan`; if ([...sel.options].some(o => o.value === want)) sel.value = want; const m = document.getElementById('t_msg'); if (!m.value) m.value = `I'm interested in the ${plan.dataset.plan} plan.`; }
  const claim = e.target.closest('[data-claim]');
  if (claim) { document.getElementById('t_interest').value = 'Membership enquiry'; const m = document.getElementById('t_msg'); m.value = `I'd like the "${claim.dataset.claim}" offer.`; }
  const tab = e.target.closest('[data-kind]');
  if (tab) { offerKind = tab.dataset.kind; drawOffers(); }
});
const refreshOpen = () => { const st = openStatus(); const el = document.getElementById('openNow'); el.classList.toggle('on', st.open); el.querySelector('span').textContent = st.label; };
setInterval(refreshOpen, 60000);

/* ---------------- offers ---------------- */
let offerKind = 'seasonal';
const fmtD = d => new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
function drawOffers() {
  const kinds = Object.keys(OFFER_KINDS).filter(k => OFFERS.some(o => (o.kind || 'seasonal') === k));
  if (!kinds.includes(offerKind)) offerKind = kinds[0];
  document.getElementById('offerTabs').innerHTML = kinds.length > 1 ? kinds.map(k => `<button role="tab" data-kind="${k}" aria-selected="${k === offerKind}">${esc(OFFER_KINDS[k])}</button>`).join('') : '';
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('offerList').innerHTML = OFFERS.filter(o => (o.kind || 'seasonal') === offerKind).map(o => {
    const soon = o.starts_on && o.starts_on > today;
    const rows = Array.isArray(o.price_rows) ? o.price_rows : [];
    return `<article class="offer">
      <div class="offer-top">${o.tag ? `<div class="big">${esc(o.tag)}</div>` : ''}${o.highlight ? `<span class="hl">${esc(o.highlight)}</span>` : ''}</div>
      <h3>${esc(o.title)}</h3>
      ${rows.length ? `<ul class="prows">${rows.map(r => `<li><span>${esc(r.label)}</span><span>${r.was && Number(r.was) !== Number(r.now) ? `<s>${esc(rupees(r.was))}</s>` : ''}<b>${esc(rupees(r.now))}</b></span></li>`).join('')}</ul>` : ''}
      ${o.details ? `<p>${esc(o.details)}</p>` : ''}
      ${soon ? `<small>Starts ${esc(fmtD(o.starts_on))}</small>` : o.valid_until ? `<small>Valid till ${esc(fmtD(o.valid_until))}</small>` : ''}
      <div class="cta" style="margin-top:auto;padding-top:18px"><a class="btn btn-line btn-sm" href="#trial" data-claim="${esc(o.title)}">${soon ? 'Reserve this offer' : 'Claim this offer'}</a></div></article>`;
  }).join('');
}

/* ---------------- live content and offers ---------------- */
function refreshContent() {
  const swap = (id, html) => { const el = document.getElementById(id); if (el) el.outerHTML = html; };
  swap('facts', facts());
  const b = document.getElementById('banner'); if (b) { b.hidden = !C.fees.banner; b.textContent = C.fees.banner || ''; }
  swap('plans', plans()); swap('benefits', benefits()); swap('extras', extras()); swap('visit', visit()); swap('terms', terms());
  const lede = document.getElementById('trialLede'); if (lede) lede.textContent = `Send your details and a coach calls to fix your trial day. ${C.fees.trialPass ? `The one-day pass is ${rupees(C.fees.trialPass)}.` : 'Your trial day is free.'}`;
  const sel = document.getElementById('t_interest'); if (sel) { const cur = sel.value; const list = [...new Set(['Membership enquiry', ...livePlans(C).map(p => `${p.name} plan`), 'Personal trainer', ...SITE.services.map(s => s.title), ...C.services.map(s => s.title)])]; sel.innerHTML = list.map(x => `<option>${esc(x)}</option>`).join(''); if (list.includes(cur)) sel.value = cur; }
  mountReel(document.getElementById('reel'), C.logo_reel);
  refreshOpen(); pointerFx();
}
async function loadLive() {
  if (!configured) return;
  const [c, o] = await Promise.all([
    supabase.from('site_content').select('key,value'),
    supabase.from('offers').select('title,details,tag,valid_until,kind,starts_on,price_rows,highlight,sort,audience').order('sort'),
  ]);
  if (!c.error && c.data && c.data.length) { C = contentFromRows(c.data); applyToSite(SITE, C); refreshContent(); }
  if (!o.error && o.data) {
    OFFERS = o.data.slice().sort((x, y) => (x.sort ?? 0) - (y.sort ?? 0)); SITE.offers = OFFERS;
    const has = OFFERS.length > 0; document.getElementById('offers').hidden = !has; document.getElementById('navOffers').hidden = !has;
    if (has) drawOffers();
  }
}
loadLive().catch(() => { /* defaults stay */ });
if (configured) {
  let t = 0; const again = () => { clearTimeout(t); t = setTimeout(() => loadLive().catch(() => {}), 400); };
  supabase.channel('jfs-content').on('postgres_changes', { event: '*', schema: 'public', table: 'site_content' }, again).on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, again).subscribe();
}

/* trial form → enquiries */
const form = document.getElementById('trialForm');
form.addEventListener('submit', async e => {
  e.preventDefault();
  const msg = document.getElementById('trialMsg'); const btn = form.querySelector('[type=submit]');
  const v = Object.fromEntries(new FormData(form));
  const say = (cls, t) => { msg.className = 'msg ' + cls; msg.textContent = t; };
  if (v.website) { form.reset(); say('ok', 'Thanks! We will call you shortly.'); return; }
  if (!v.name.trim()) return say('err', 'Enter your name.');
  if (v.phone.replace(/\D/g, '').length < 8) return say('err', 'Enter a phone number with at least 8 digits so we can call you.');
  if (!configured) return say('err', `Online booking isn't set up yet. Call us on ${SITE.phone}.`);
  btn.disabled = true; btn.textContent = 'Sending…';
  const { error } = await supabase.from('enquiries').insert({ name: v.name.trim(), phone: v.phone.trim(), email: v.email.trim() || null, interest: v.interest, preferred_time: v.preferred_time, message: v.message.trim() || null, source: 'Website form' });
  btn.disabled = false; btn.textContent = 'Book my trial day';
  if (error) return say('err', `That didn't go through. Try again, or call us on ${SITE.phone}.`);
  form.reset(); say('ok', `Thanks, ${v.name.trim().split(' ')[0]}. A JARIN coach will call you within one working day.`);
});
