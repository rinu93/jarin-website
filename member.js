import './portal.css';
import { logoUrl, BRAND, MARK, TAGLINE } from './brand.js';
import { invoiceData, invoiceHtml, INVOICE_CSS, printInvoice } from './invoice.js';
import { supabase, configured } from './supabase.js';
import { SITE, DAYS, openStatus, fmtTime } from './site-config.js';
import { esc, parse, today, addDays, addMonths, diffDays, mKey, curMonth, shiftMonth, fmtDate, fmtShort, fmtMonth, lineChart } from './lib.js';

const PLANS = { 'Monthly': 1, 'Quarterly': 3, 'Half-yearly': 6, 'Annual': 12 };
const $ = s => document.querySelector(s);
const root = $('#root');
let session = null, me = null, recovery = false, sessionUser = null;
const D = { member: null, payments: [], visits: [], history: [], offers: [], mine: [], settings: { currency: '₹', gymName: BRAND } };
const ui = { calMonth: curMonth() };
const money = n => (D.settings.currency || '₹') + Math.round(Number(n || 0)).toLocaleString('en-IN');

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3200); }
function friendly(e) {
  const m = (e && (e.message || e.error_description)) || String(e);
  if (/Invalid login/i.test(m)) return 'That email and password don’t match. Try again or reset your password.';
  if (/Email not confirmed/i.test(m)) return 'Please confirm your email first. Open the link we emailed you, then sign in.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Could not reach the server. Check your internet connection and try again.';
  return m;
}

/* ================= auth screens ================= */
function authCard(inner) {
  document.body.classList.add('authpage');
  root.innerHTML = `<div class="auth"><div class="auth-card"><img class="auth-logo" src="${logoUrl}" alt="${BRAND} – ${TAGLINE}" width="1000" height="375"><div class="meta" style="text-transform:uppercase;letter-spacing:.2em;font-size:11px;font-weight:600">Member portal</div>${inner}<a class="meta" href="/" style="text-decoration:none">← Back to website</a></div></div>`;
}
function renderLogin(mode = 'signin', msg = '') {
  const signup = mode === 'signup', forgot = mode === 'forgot';
  authCard(`<h2>${signup ? 'Create your member login' : forgot ? 'Reset your password' : 'Member sign in'}</h2>
  ${signup ? '<p class="meta" style="margin:0">Already a member? Use the <b>same email you gave at the front desk</b> and we\'ll find your membership. New here? You get your Membership ID as soon as you confirm your email.</p>' : ''}
  <form id="authForm" class="form" data-mode="${mode}">
    ${signup ? `<label for="a_name">Full name<input id="a_name" name="name" required autocomplete="name"></label><label for="a_phone">Phone<input id="a_phone" name="phone" type="tel" required autocomplete="tel" placeholder="+91"></label>` : ''}
    <label for="a_email">Email<input id="a_email" name="email" type="email" required autocomplete="email"></label>
    ${forgot ? '' : `<label for="a_pw">Password<input id="a_pw" name="password" type="password" required minlength="8" autocomplete="${signup ? 'new-password' : 'current-password'}">${signup ? '<span class="hint">At least 8 characters</span>' : ''}</label>`}
    <div id="authMsg">${msg}</div>
    <button class="btn primary" type="submit">${signup ? 'Create login' : forgot ? 'Send reset link' : 'Sign in'}</button>
  </form>
  <div class="meta" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
    ${signup || forgot ? `<button class="linkbtn" data-auth="signin">Back to sign in</button>` : `<button class="linkbtn" data-auth="signup">New here? Create login</button><button class="linkbtn" data-auth="forgot">Forgot password?</button>`}
  </div>`);
}
function renderLink(msg = '') {
  authCard(`<h2>Link your membership</h2>
  <p class="meta" style="margin:0">Enter the Membership ID on your receipt or ask the front desk (for example <span class="mid">JFS-M-0042</span>). Your login email <b>${esc(me.email)}</b> must match the email on your membership.</p>
  <form id="linkForm" class="form"><label for="l_code">Membership ID<input id="l_code" name="code" required autocomplete="off" placeholder="JFS-M-0000" style="text-transform:uppercase;font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em"></label>
  <div id="authMsg">${msg}</div><button class="btn primary" type="submit">Link my membership</button></form>
  <div class="actions"><button class="btn sm" data-act="signOut">Sign out</button></div>`);
}
function renderExpired() {
  const asked = me.extension_requested_at;
  authCard(`<h2>Your portal access has ended</h2><p>Your Member portal access ended on <b>${esc(fmtDate(me.access_until))}</b>. Ask the gym to extend it.</p>
  ${asked ? `<div class="ok">Extension requested on ${esc(new Date(asked).toLocaleDateString())}. You’ll get access again as soon as the gym approves it.</div>` : `<form id="extForm" class="form"><label for="x_note">Message to the gym (optional)<textarea id="x_note" name="note" maxlength="300" placeholder="e.g. I renewed my membership, please extend my access"></textarea></label><div id="authMsg"></div><button class="btn primary" type="submit">Request extension</button></form>`}
  <div class="actions"><button class="btn sm" data-act="signOut">Sign out</button></div>`);
}
function renderStaffAccount() {
  authCard(`<h2>This is an employee login</h2><p>${esc(me.email)} belongs to the JARIN team, so it opens the Employee portal.</p>
  <div class="actions"><a class="btn primary" href="${SITE.dashboardUrl}">Go to Employee Dashboard</a><button class="btn" data-act="signOut">Sign out</button></div>`);
}
function renderNewPassword() {
  authCard(`<h2>Choose a new password</h2><form id="pwForm" class="form"><label for="np">New password<input id="np" name="password" type="password" minlength="8" required autocomplete="new-password"></label><div id="authMsg"></div><button class="btn primary" type="submit">Save password</button></form>`);
}

/* ================= data ================= */
async function q(p) { const { data, error } = await p; if (error) throw error; return data; }
async function loadData() {
  const mid = me.member_id;
  const [m, pays, vis, hist, offers, st, mine] = await Promise.all([
    q(supabase.from('members').select('*').eq('id', mid).maybeSingle()),
    q(supabase.from('payments').select('*').eq('member_id', mid).order('paid_on', { ascending: false })),
    q(supabase.from('attendance').select('visit_date,visit_time').eq('member_id', mid).gte('visit_date', addDays(today(), -400))),
    q(supabase.from('member_history').select('changed_at,changes').eq('member_id', mid).order('changed_at')),
    q(supabase.from('offers').select('title,details,tag,valid_until').order('created_at', { ascending: false })),
    q(supabase.from('settings').select('gym_name,currency').eq('id', 1).maybeSingle()),
    q(supabase.from('member_offers').select('title,details,valid_until,status,created_by_name').eq('member_id', mid).eq('status', 'active')),
  ]);
  D.mine = mine.filter(o => !o.valid_until || o.valid_until >= today());
  D.member = m; D.payments = pays; D.visits = vis; D.history = hist; D.offers = offers;
  if (st) D.settings = { gymName: st.gym_name || BRAND, currency: st.currency || '₹' };
}

/* ================= member dashboard ================= */
function status(m) {
  const left = m.expiry_date ? diffDays(m.expiry_date, today()) : -9999;
  if (m.frozen) return { label: 'Frozen', cls: 'neutral', left };
  if (!m.expiry_date) return { label: 'No plan yet', cls: 'neutral', left: 9999, none: true };
  if (left < 0) return { label: `Expired ${-left} day${left === -1 ? '' : 's'} ago`, cls: 'bad', left };
  if (left <= 7) return { label: left === 0 ? 'Expires today' : `${left} day${left === 1 ? '' : 's'} left`, cls: 'warn', left };
  return { label: 'Active', cls: 'good', left };
}
function bmi(h, w) { h = Number(h); w = Number(w); if (!h || !w) return null; const v = Math.round(w / ((h / 100) ** 2) * 10) / 10; return { v, label: v < 18.5 ? 'Underweight' : v < 25 ? 'Healthy' : v < 30 ? 'Overweight' : 'Obese', cls: v < 18.5 ? 'warn' : v < 25 ? 'good' : v < 30 ? 'warn' : 'bad' }; }

function ring(left, total) {
  const pct = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0; const r = 52, c = 2 * Math.PI * r;
  return `<svg viewBox="0 0 130 130" class="ring" role="img" aria-label="${Math.max(left, 0)} days left"><circle cx="65" cy="65" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="10"/>${pct > 0 ? `<circle cx="65" cy="65" r="${r}" fill="none" stroke="url(#rg)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(c * pct).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 65 65)"/>` : ''}<defs><linearGradient id="rg" x1="0" x2="1"><stop offset="0" stop-color="#F2B58A"/><stop offset="1" stop-color="#C77B49"/></linearGradient></defs><text x="65" y="64" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="700" font-size="38" fill="var(--fg)">${Math.max(left, 0)}</text><text x="65" y="86" text-anchor="middle" font-size="11" letter-spacing="2" fill="var(--muted)">DAYS LEFT</text></svg>`;
}
function calendar(month, visitSet) {
  const first = parse(month + '-01'); const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; let cells = '';
  for (let i = 0; i < lead; i++) cells += '<span class="cal-d empty"></span>';
  for (let d = 1; d <= days; d++) {
    const iso = `${month}-${String(d).padStart(2, '0')}`;
    cells += `<span class="cal-d ${visitSet.has(iso) ? 'hit' : ''} ${iso === today() ? 'now' : ''}" title="${visitSet.has(iso) ? 'Visited' : ''}">${d}</span>`;
  }
  return `<div class="cal">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span class="cal-h">${x}</span>`).join('')}${cells}</div>`;
}

function renderDashboard() {
  document.body.classList.remove('authpage');
  const m = D.member;
  if (!m) { authCard('<h2>Membership not found</h2><p>Your login is linked to a membership that no longer exists. Please speak to the front desk.</p><div class="actions"><button class="btn" data-act="signOut">Sign out</button></div>'); return; }
  const st = status(m); const total = m.join_date && m.expiry_date ? Math.max(1, diffDays(m.expiry_date, addDays(addMonths(m.expiry_date, -(PLANS[m.plan] || 1)), 1)) + 1) : 30;
  const vset = new Set(D.visits.map(v => v.visit_date)); const vm = D.visits.filter(v => mKey(v.visit_date) === curMonth()).length;
  const wkStart = addDays(today(), -((new Date().getDay() + 6) % 7)); const vw = D.visits.filter(v => v.visit_date >= wkStart).length;
  const wpts = []; for (const h of D.history) { const c = h.changes && h.changes.weight_kg; if (c && c[1] != null) wpts.push({ label: fmtShort(String(h.changed_at).slice(0, 10)), v: Number(c[1]) }); }
  if (!wpts.length && m.weight_kg) wpts.push({ label: 'Now', v: Number(m.weight_kg) });
  const wDelta = wpts.length > 1 ? Math.round((wpts[wpts.length - 1].v - wpts[0].v) * 10) / 10 : null;
  const b = bmi(m.height_cm, m.weight_kg);
  const first = (m.name || me.full_name || '').split(' ')[0];
  const wa = SITE.whatsapp ? `https://wa.me/${String(SITE.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${D.settings.gymName}, I'd like to renew my membership. ID: ${m.member_code}, ${m.name}.`)}` : null;
  const os = openStatus(); const todayName = DAYS[(new Date().getDay() + 6) % 7];
  const lastVisit = D.visits.map(v => v.visit_date).sort().pop();

  root.innerHTML = `<div class="mp">
  <header class="mp-top"><div class="mp-in">
    <a class="brand" href="/" style="text-decoration:none;color:inherit" aria-label="${esc(BRAND)} website">${MARK}<div class="wordmark"><b>JARIN</b><small>FITNESS STUDIO</small></div></a>
    <div class="actions"><span class="meta mp-hi">Member portal</span><a class="btn sm" href="/">Website</a><button class="btn sm" data-act="signOut">Sign out</button></div>
  </div></header>
  <main class="mp-main">
    ${session.user.user_metadata && session.user.user_metadata.invited_role && !session.user.user_metadata.password_set ? `<form id="setPwForm" class="panel" style="flex-direction:row;flex-wrap:wrap;align-items:end;gap:12px"><div style="flex:1;min-width:220px"><b>Set a password</b><div class="meta">You signed in with an email link. Set a password to sign in normally next time.</div></div><label class="meta" style="display:flex;flex-direction:column;gap:4px">New password<input class="field-inline" type="password" name="password" minlength="8" required autocomplete="new-password"></label><button class="btn primary" type="submit">Save password</button><div id="authMsg"></div></form>` : ''}
    <div class="head"><div><h1>Hi, ${esc(first)}</h1><div class="sub">${esc(TAGLINE)}${me.access_until ? ` · portal access until ${esc(fmtDate(me.access_until))}` : ''}</div></div></div>

    <div class="mp-hero">
      <div class="mcard">
        <div class="mcard-top">${MARK}<span class="chip ${st.cls}">${esc(st.label)}</span></div>
        <div class="mcard-id">${esc(m.member_code)}</div>
        <div class="mcard-name">${esc(m.name)}</div>
        <div class="mcard-row"><div><small>Plan</small><b>${esc(m.plan)}</b></div><div><small>Valid till</small><b>${esc(fmtDate(m.expiry_date))}</b></div><div><small>Member since</small><b>${esc(fmtDate(m.join_date))}</b></div></div>
        <div class="mcard-foot">JARIN FITNESS STUDIO · show this at the front desk</div>
      </div>
      <section class="panel mp-ring">${ring(st.left, total)}
        ${st.none ? `<div class="meta" style="text-align:center">Your Membership ID is ready. Pick a plan at the front desk or on WhatsApp to start training.</div><div class="actions" style="justify-content:center">${wa ? `<a class="btn primary" href="${wa}" target="_blank" rel="noopener">Start on WhatsApp</a>` : ''}<a class="btn" href="/#plans">See plans</a></div>` : st.left <= 15 ? `<div class="meta" style="text-align:center">${st.left < 0 ? 'Your membership has ended.' : 'Your membership ends soon.'} Renew to keep your streak going.</div><div class="actions" style="justify-content:center">${wa ? `<a class="btn primary" href="${wa}" target="_blank" rel="noopener">Renew on WhatsApp</a>` : ''}<span class="meta" style="user-select:all">${esc(SITE.phone)}</span></div>` : `<div class="meta" style="text-align:center">Renews on ${esc(fmtDate(addDays(m.expiry_date, 1)))}</div>`}
      </section>
    </div>

    <div class="kpis">
      <div class="kpi"><span class="lbl">Visits this month</span><span class="val">${vm}</span><span class="note">${vw} this week${lastVisit ? ' · last ' + esc(fmtShort(lastVisit)) : ''}</span></div>
      <div class="kpi"><span class="lbl">Visits · last 12 months</span><span class="val">${D.visits.length}</span><span class="note">keep showing up</span></div>
      <div class="kpi"><span class="lbl">Weight</span><span class="val">${m.weight_kg ? esc(m.weight_kg) + '<span style="font-size:18px"> kg</span>' : '—'}</span><span class="note">${wDelta !== null ? (wDelta > 0 ? '+' : '') + wDelta + ' kg since first record' : 'measured at your check-ups'}</span></div>
      <div class="kpi"><span class="lbl">BMI</span><span class="val">${b ? b.v : '—'}</span><span class="note">${b ? `<span class="chip ${b.cls}">${b.label}</span>` : 'needs height and weight'}</span></div>
    </div>

    ${D.mine.length ? `<section class="panel" style="border-color:var(--accent);background:linear-gradient(135deg,#2A1C14,var(--surface) 60%)"><div class="panel-head"><h2>🎁 Your personal renewal offer</h2><span class="meta">just for you</span></div><div class="mp-offers">${D.mine.map(o => `<article class="mp-offer"><h3>${esc(o.title)}</h3>${o.details ? `<p>${esc(o.details)}</p>` : ''}${o.valid_until ? `<small>Valid till ${esc(fmtDate(o.valid_until))}</small>` : ''}${o.created_by_name ? `<p style="margin-top:8px">From ${esc(o.created_by_name)}, ${esc(D.settings.gymName)}</p>` : ''}</article>`).join('')}</div>${wa ? `<div class="actions"><a class="btn primary" href="${wa.replace(encodeURIComponent("I'd like to renew my membership."), encodeURIComponent("I'd like to renew with my personal offer."))}" target="_blank" rel="noopener">Claim on WhatsApp</a></div>` : ''}</section>` : ''}

    ${D.offers.length ? `<section class="panel"><div class="panel-head"><h2>Offers for you</h2><span class="meta">ask at the front desk to claim</span></div><div class="mp-offers">${D.offers.map(o => `<article class="mp-offer">${o.tag ? `<b>${esc(o.tag)}</b>` : ''}<h3>${esc(o.title)}</h3>${o.details ? `<p>${esc(o.details)}</p>` : ''}${o.valid_until ? `<small>Valid till ${esc(fmtDate(o.valid_until))}</small>` : ''}</article>`).join('')}</div></section>` : ''}

    <div class="grid2">
      <section class="panel"><div class="panel-head"><h2>Visits · ${esc(fmtMonth(ui.calMonth))}</h2><div class="actions"><button class="btn sm" data-act="calPrev" aria-label="Previous month">‹</button><button class="btn sm" data-act="calNext" aria-label="Next month" ${ui.calMonth >= curMonth() ? 'disabled' : ''}>›</button></div></div>
        ${calendar(ui.calMonth, vset)}<div class="meta">${D.visits.filter(v => mKey(v.visit_date) === ui.calMonth).length} visits this month. Highlighted days are when you checked in.</div></section>
      <section class="panel"><div class="panel-head"><h2>Weight progress</h2><span class="meta">${wpts.length} record${wpts.length === 1 ? '' : 's'}</span></div>
        ${wpts.length > 1 ? lineChart(wpts) : '<div class="empty">Your coach records your weight at check-ups. Once there are two readings, your progress line appears here.</div>'}</section>
    </div>

    <div class="grid2">
      <section class="panel"><h2>My details</h2>
        <dl class="dl">${[['Membership ID', `<span class="mid">${esc(m.member_code)}</span>`], ['Phone', esc(m.phone || '—')], ['Email', esc(m.email || '—')], ['Height', m.height_cm ? esc(m.height_cm) + ' cm' : '—'], ['Goal', esc(m.goal || '—')], ['Trainer', esc(m.trainer || '—')], ['Joining offer', esc(m.offer || '—')]].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        <div class="meta">Something wrong? Ask the front desk to update it.</div></section>
      <section class="panel"><h2>Payments</h2>
        ${D.payments.length ? `<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>For</th><th>Offer</th><th class="num">Amount</th><th>Invoice</th></tr></thead><tbody>${D.payments.map(p => `<tr><td>${esc(fmtDate(p.paid_on))}</td><td>${p.type === 'registration' ? 'Registration fee' : (p.type === 'new' ? 'Joining' : 'Renewal') + ' · ' + esc(p.plan || '')}</td><td>${esc(p.offer || '—')}</td><td class="num">${esc(money(p.amount))}</td><td>${p.invoice_no ? `<button class="btn sm" data-act="invoice" data-inv="${esc(p.invoice_no)}">${esc(p.invoice_no)}</button>` : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No payments recorded.</div>'}</section>
    </div>

    <section class="panel"><div class="panel-head"><h2>Studio hours</h2><span class="chip ${os.open ? 'good' : 'neutral'}">${esc(os.label)}</span></div>
      <div class="mp-hours">${DAYS.map(d => { const s = SITE.hours[d] || []; return `<div class="${d === todayName ? 'today' : ''}"><small>${d.slice(0, 3)}</small><b>${s.length ? s.map(([a, z]) => `${fmtTime(a)}–${fmtTime(z)}`).join(', ') : 'Closed'}</b></div>`; }).join('')}</div>
      <div class="meta">${esc(SITE.addressLines.join(', '))} · <span style="user-select:all">${esc(SITE.phone)}</span>${SITE.whatsapp ? ` · <a href="https://wa.me/${String(SITE.whatsapp).replace(/\D/g, '')}" target="_blank" rel="noopener">WhatsApp us</a>` : ''}</div></section>
  </main></div>`;
}

/* ================= flow ================= */
function render() {
  if (!configured) { authCard('<h2>Almost there</h2><p>The Member portal isn\'t connected to its database yet. The gym team needs to finish setting it up.</p>'); return; }
  if (recovery) return renderNewPassword();
  if (!session) return renderLogin();
  if (!me) { authCard('<div class="empty">Signing you in…</div>'); return; }
  if (['owner', 'manager', 'trainer', 'receptionist'].includes(me.role)) return renderStaffAccount();
  if (me.role === 'member' && me.access_until && me.access_until < today()) return renderExpired();
  if (me.role !== 'member' || !me.member_id) return renderLink();
  if (!D.member) { authCard('<div class="empty">Loading your membership…</div>'); return; }
  renderDashboard();
}
async function onSession(s) {
  const uid = s ? s.user.id : null;
  if (uid && uid === sessionUser && me) { session = s; return; }
  sessionUser = uid; session = s;
  if (!session) { me = null; D.member = null; render(); return; }
  const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  me = data || { id: session.user.id, email: session.user.email, role: 'pending' };
  if (me.role !== 'member' || !me.member_id) {   // apply an invitation from the gym, if any
    try { const r = await supabase.rpc('claim_invitation'); if (r.data && r.data.ok) { const again = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(); if (again.data) me = again.data; } } catch (e) { /* ignore */ }
  }
  if (!['owner', 'manager', 'trainer', 'receptionist'].includes(me.role) && (me.role !== 'member' || !me.member_id)) {   // give website sign-ups their Membership ID
    try {
      const r = await supabase.rpc('ensure_my_membership');
      if (r.data && r.data.ok) { const again = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(); if (again.data) me = again.data; if (r.data.created) toast(`Welcome! Your Membership ID is ${r.data.code}`); }
    } catch (e) { /* fall back to linking by ID */ }
  }
  render();
  if (me.role === 'member' && me.member_id && !(me.access_until && me.access_until < today())) { try { await loadData(); } catch (e) { toast(friendly(e)); } render(); }
}

document.addEventListener('click', async e => {
  const a = e.target.closest('[data-auth]'); if (a) { e.preventDefault(); renderLogin(a.dataset.auth); return; }
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act;
  if (act === 'signOut') { await supabase.auth.signOut(); location.href = '/'; }
  if (act === 'invoice') {
    const m = D.member; const rows = D.payments.filter(p => p.invoice_no === el.dataset.inv);
    const inv = invoiceData({ code: m.member_code, name: m.name, phone: m.phone, email: m.email, plan: m.plan, joinDate: m.join_date, expiryDate: m.expiry_date }, rows);
    if (!printInvoice(inv)) toast('Allow pop-ups to open your invoice.');
  }
  if (act === 'calPrev') { ui.calMonth = shiftMonth(ui.calMonth, -1); renderDashboard(); }
  if (act === 'calNext') { ui.calMonth = shiftMonth(ui.calMonth, 1); renderDashboard(); }
});
document.addEventListener('submit', async e => {
  const f = e.target; const msg = $('#authMsg'); e.preventDefault();
  const v = Object.fromEntries(new FormData(f)); const btn = f.querySelector('[type=submit]'); if (btn) btn.disabled = true; if (msg) msg.innerHTML = '';
  try {
    if (f.id === 'authForm') {
      if (f.dataset.mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: v.email, password: v.password, options: { data: { full_name: v.name, phone: (v.phone || '').trim(), portal: 'member' }, emailRedirectTo: location.origin + '/member.html' } });
        if (error) throw error;
        if (!data.session) { renderLogin('signin', `<div class="ok">Login created. Open the confirmation link we sent to ${esc(v.email)}, then sign in here.</div>`); return; }
      } else if (f.dataset.mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(v.email, { redirectTo: location.origin + '/member.html' }); if (error) throw error;
        msg.innerHTML = `<div class="ok">If ${esc(v.email)} has a login, a reset link is on its way.</div>`;
      } else { const { error } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password }); if (error) throw error; }
    }
    if (f.id === 'linkForm') {
      const { data, error } = await supabase.rpc('link_my_membership', { p_code: v.code.trim() }); if (error) throw error;
      if (!data.ok) {
        const reasons = { no_match: `We couldn't match that Membership ID to ${esc(me.email)}. Check the ID, or ask the front desk to update the email on your membership.`, already_linked: 'That membership is already linked to another login. Please speak to the front desk.', email_not_confirmed: 'Please confirm your email first using the link we sent you.', staff_account: 'This login belongs to an employee.' };
        msg.innerHTML = `<div class="err">${reasons[data.reason] || 'Linking failed. Please try again.'}</div>`; return;
      }
      toast('Membership linked. Welcome!'); me = null; sessionUser = null; await onSession(session); return;
    }
    if (f.id === 'extForm') { const { error } = await supabase.rpc('request_access_extension', { p_note: v.note || null }); if (error) throw error; const again = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(); if (again.data) me = again.data; render(); return; }
    if (f.id === 'setPwForm') { const { error } = await supabase.auth.updateUser({ password: v.password, data: { password_set: true } }); if (error) throw error; const { data } = await supabase.auth.getSession(); session = data.session || session; toast('Password saved'); renderDashboard(); return; }
    if (f.id === 'pwForm') { const { error } = await supabase.auth.updateUser({ password: v.password }); if (error) throw error; recovery = false; toast('Password updated'); me = null; sessionUser = null; await onSession(session); }
  } catch (err) { if (msg) msg.innerHTML = `<div class="err">${esc(friendly(err))}</div>`; }
  finally { if (btn) btn.disabled = false; }
});

if (!configured) render();
else {
  authCard('<div class="empty">Loading…</div>');
  supabase.auth.onAuthStateChange((event, s) => {
    if (event === 'PASSWORD_RECOVERY') { session = s; recovery = true; render(); return; }
    if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') { session = s; return; }
    setTimeout(() => onSession(s), 0);
  });
  // live refresh when the front desk checks you in or records a payment
  supabase.channel('member-live').on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => { if (me && me.member_id) loadData().then(render).catch(() => {}); }).subscribe();
}
