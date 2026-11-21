// JARIN Assistant — website chat widget.
// AI mode: talks to /api/chat (Claude). If that isn't configured or is busy, it switches to a
// guided mode that answers from site-config.js and collects enquiries itself. Both modes save
// enquiries with source "Chatbot" so they appear in the Employee Dashboard.
import './chat.css';
import { SITE, DAYS, openStatus, fmtTime, waNumber, telNumber } from './site-config.js';
import { MARK } from './brand.js';
import { supabase, configured } from './supabase.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '₹' + Number(n).toLocaleString('en-IN');
const KEY = 'jarin-chat-v1';
const GREETING = `Hi, I'm the JARIN assistant. Ask me about timings, plans, fees and offers, or book a trial day. I can also take your number for a call back.`;
const CHIPS = ['Timings', 'Plans & fees', 'Offers', 'Where are you?', 'Book a trial day'];

let state = { open: false, mode: 'ai', messages: [], lead: null, busy: false, saved: false };
try { const s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (s && Array.isArray(s.messages)) state = { ...state, ...s, open: false, busy: false }; } catch { /* private mode */ }
const persist = () => { try { sessionStorage.setItem(KEY, JSON.stringify({ mode: state.mode, messages: state.messages.slice(-40), lead: state.lead, saved: state.saved })); } catch { /* ignore */ } };

/* ---------------- guided answers ---------------- */
function hoursText() {
  return DAYS.map(d => `${d.slice(0, 3)}: ${(SITE.hours[d] || []).length ? SITE.hours[d].map(([a, b]) => `${fmtTime(a)}–${fmtTime(b)}`).join(', ') : 'Closed'}`).join('\n') + `\n${openStatus().label}.` + (SITE.hoursNote ? `\n${SITE.hoursNote}` : '');
}
function plansText() {
  const c = SITE.content || {}; const f = c.fees || {};
  return SITE.plans.map(p => `${p.name}: ${money(p.price)} ${p.period}`).join('\n') + (SITE.registrationFee ? `\nOne-time registration: ${money(SITE.registrationFee)} on every plan.` : '')
    + ((c.plans || []).some(p => p.cult && p.enabled !== false) ? `\nThe Cult app comes with ${(c.plans || []).filter(p => p.cult).map(p => p.name).join(' / ')} plans.` : '')
    + (f.ptMonthly ? `\nPersonal trainer: ${money(f.ptMonthly)} a month, on any plan.` : '') + `\nAsk me about offers to see current discounts.`;
}
function offersText() {
  const list = (SITE.offers || []);
  if (!list.length) return 'No special offers are live right now. I can have the team call you with the best price.';
  return list.slice(0, 6).map(o => `• ${o.title}${o.tag ? ` (${o.tag})` : ''}${o.highlight ? `, ${o.highlight}` : ''}`).join('\n') + '\nOffers cannot be combined. Want a coach to call you about one?';
}
const ANSWERS = [
  { k: /(time|timing|hour|open|close|when)/i, a: () => hoursText() },
  { k: /(plan|fee|price|cost|charge|month|annual|quarter|rate|registration|kitna|evlo|ethra)/i, a: () => plansText() },
  { k: /(where|address|location|map|direction|reach|parking)/i, a: () => `${SITE.addressLines.join(', ')}${SITE.landmark ? ` (${SITE.landmark})` : ''}.\n${SITE.parking || ''}\nDirections: https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(SITE.mapQuery)}` },
  { k: /(\bac\b|air[- ]?con|cool|condition)/i, a: () => `Yes, the whole 2,000 sq ft floor is air-conditioned.` },
  { k: /(offer|discount|deal|student|college|school|referral|refer|new year|pre-?opening)/i, a: () => offersText() },
  { k: /(ladies|women|female|girl)/i, a: () => 'Yes, we have a female trainer on the floor, and you can book her as your personal trainer.' },
  { k: /(trial|day pass|try)/i, a: () => { const f = (SITE.content || {}).fees || {}; return `A one-day trial pass is ${f.trialPass ? money(f.trialPass) : 'free'}. Say "call me" and a coach will fix a day with you.`; } },
  { k: /(diet|supplement|physio|injury|stall|shake|towel|locker)/i, a: () => { const c = SITE.content || {}; return (c.services || []).map(s => `${s.title}: ${s.items.map(([n, p]) => `${n} ${money(p)}`).join(', ')}`).join('\n') + (c.fees && c.fees.locker ? `\nPersonal locker: ${money(c.fees.locker)} a month.` : ''); } },
  { k: /(trainer|coach|personal|pt\b)/i, a: () => { const f = (SITE.content || {}).fees || {}; return `Our trainers guide you on the floor. A personal trainer is ${f.ptMonthly ? money(f.ptMonthly) + ' a month' : 'available'} on any plan, with a female trainer available.`; } },
  { k: /(equipment|machine|treadmill|weight|dumbbell|cardio)/i, a: () => SITE.equipment.map(e => `${e.title}: ${e.items.slice(0, 3).join(', ')}`).join('\n') },
  { k: /(service|class|hiit|yoga|diet|nutrition|program)/i, a: () => SITE.services.map(s => `• ${s.title}`).join('\n') },
  { k: /(app|portal|digital|track|progress)/i, a: () => `Members get their own portal with a digital card, visit history, weight and BMI progress, and personal renewal offers.` },
  { k: /(contact|phone|call|number|whatsapp|email)/i, a: () => `Call ${SITE.phone}, WhatsApp +${waNumber()}, or email ${SITE.email}.` },
];
const wantsLead = t => /(free trial|\btrial\b|\bjoin\b|\bbook\b|call me|callback|call back|register|sign ?up|enrol|talk to)/i.test(t);

/* ---------------- UI ---------------- */
let root;
export function mountChat() {
  root = document.createElement('div');
  root.className = 'jc';
  root.innerHTML = `<button class="jc-launch" aria-label="Chat with the JARIN assistant" aria-expanded="false">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg><span>Ask JARIN</span></button>
    <section class="jc-panel" role="dialog" aria-label="JARIN assistant" hidden>
      <header class="jc-head">${MARK}<div><b>JARIN assistant</b><small id="jcMode">Replies instantly</small></div><button class="jc-x" aria-label="Close chat">×</button></header>
      <div class="jc-log" id="jcLog" aria-live="polite"></div>
      <div class="jc-chips" id="jcChips"></div>
      <form class="jc-input" id="jcForm"><input id="jcText" autocomplete="off" maxlength="600" placeholder="Type your question" aria-label="Message"><button type="submit" aria-label="Send"><svg viewBox="0 0 24 24"><path d="M4 12l16-8-6 16-2.5-6.5z"/></svg></button></form>
      <p class="jc-foot">Prefer WhatsApp? <a href="https://wa.me/${waNumber()}" target="_blank" rel="noopener">Message +${waNumber()}</a></p>
    </section>`;
  document.body.appendChild(root);
  root.querySelector('.jc-launch').addEventListener('click', () => (state.open ? closeChat() : openChat()));
  root.querySelector('.jc-x').addEventListener('click', closeChat);
  root.querySelector('#jcForm').addEventListener('submit', e => { e.preventDefault(); const i = root.querySelector('#jcText'); const t = i.value.trim(); if (!t || state.busy) return; i.value = ''; send(t); });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') closeChat(); });
  draw();
}
export function openChat() {
  state.open = true; root.classList.add('on'); root.querySelector('.jc-panel').hidden = false; root.querySelector('.jc-launch').setAttribute('aria-expanded', 'true');
  if (!state.messages.length) { state.messages.push({ role: 'assistant', content: GREETING }); persist(); }
  draw(); setTimeout(() => root.querySelector('#jcText').focus(), 50);
}
function closeChat() { state.open = false; root.classList.remove('on'); root.querySelector('.jc-panel').hidden = true; root.querySelector('.jc-launch').setAttribute('aria-expanded', 'false'); }

const linkify = t => esc(t).replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">open link</a>').replace(/\n/g, '<br>');
function draw() {
  if (!root) return;
  const log = root.querySelector('#jcLog');
  log.innerHTML = state.messages.map(m => `<div class="jc-msg ${m.role}">${linkify(m.content)}</div>`).join('') + (state.busy ? '<div class="jc-msg assistant typing"><i></i><i></i><i></i></div>' : '');
  log.scrollTop = log.scrollHeight;
  const chips = state.lead ? leadChips() : (state.messages.length <= 2 ? CHIPS : []);
  root.querySelector('#jcChips').innerHTML = chips.map(c => `<button type="button">${esc(c)}</button>`).join('');
  root.querySelectorAll('#jcChips button').forEach(b => b.addEventListener('click', () => !state.busy && send(b.textContent)));
  root.querySelector('#jcMode').textContent = state.mode === 'ai' ? 'Replies instantly' : 'Quick answers · a coach follows up';
}
function say(text) { state.messages.push({ role: 'assistant', content: text }); persist(); draw(); }

async function send(text) {
  state.messages.push({ role: 'user', content: text }); persist(); draw();
  if (state.mode === 'ai' && !state.lead) {
    state.busy = true; draw();
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: state.messages.slice(-24) }) });
      const data = await r.json().catch(() => ({}));
      state.busy = false;
      if (r.ok && data.reply) { if (data.saved) state.saved = true; say(data.reply); return; }
      state.mode = 'guided'; // not configured or busy: carry on in guided mode
    } catch { state.busy = false; state.mode = 'guided'; }
  }
  guided(text);
}

/* ---------------- guided mode: answers + enquiry capture ---------------- */
function leadChips() {
  if (!state.lead) return [];
  if (state.lead.step === 'interest') return ['Trial day', 'Annual plan', 'Weight loss', 'Personal trainer', 'Student offer'];
  if (state.lead.step === 'time') return ['Morning', 'Midday', 'Evening', 'Weekend'];
  if (state.lead.step === 'confirm') return ['Yes, send it', 'Change details'];
  return [];
}
function startLead(reason) {
  if (state.saved) { say(`You're already on our call-back list. A coach will call you soon, or WhatsApp +${waNumber()} anytime.`); return; }
  state.lead = { step: 'name', reason };
  say(`Happy to help. What's your name?`);
}
async function guided(text) {
  const L = state.lead;
  if (L) {
    if (/^(cancel|stop|no thanks)/i.test(text)) { state.lead = null; say('No problem. Ask me anything else.'); return; }
    if (L.step === 'name') { L.name = text.slice(0, 100); L.step = 'phone'; say(`Thanks, ${L.name.split(' ')[0]}. What's the best phone number to reach you?`); return; }
    if (L.step === 'phone') {
      if (text.replace(/\D/g, '').length < 8) { say('That number looks short. Please type it with at least 8 digits.'); return; }
      L.phone = text.slice(0, 30); L.step = 'interest'; say('What are you interested in?'); return;
    }
    if (L.step === 'interest') { L.interest = text.slice(0, 100); L.step = 'time'; say('When is the best time for you to visit?'); return; }
    if (L.step === 'time') { L.time = text.slice(0, 100); L.step = 'confirm'; say(`Please check: ${L.name}, ${L.phone}, interested in ${L.interest}, best time ${L.time}. Shall I send this to the team?`); return; }
    if (L.step === 'confirm') {
      if (/^(yes|y|ok|sure|send|confirm|haan|aama|athe)/i.test(text)) { await saveLead(); return; }
      state.lead = { step: 'name', reason: L.reason }; say("Let's fix it. What's your name?"); return;
    }
  }
  if (/^(book a trial day|book a free trial|talk to a coach)$/i.test(text) || wantsLead(text)) { startLead(text); return; }
  const hit = ANSWERS.find(x => x.k.test(text));
  if (hit) { say(hit.a() + `\n\nWant a coach to call you? Just say "call me".`); return; }
  if (/^(hi|hello|hey|vanakkam|namaskaram)/i.test(text)) { say(`Hello! What would you like to know? Timings, plans, location, or a free trial?`); return; }
  say(`I don't have that answer here. I can have the team call you back: say "call me", or WhatsApp +${waNumber()} / call ${SITE.phone}.`);
}
async function saveLead() {
  const L = state.lead; state.busy = true; draw();
  const transcript = state.messages.map(m => `${m.role === 'user' ? 'Visitor' : 'JARIN'}: ${m.content}`).join('\n').slice(-11000);
  let ok = false;
  if (configured) {
    const { error } = await supabase.from('enquiries').insert({ name: L.name, phone: L.phone, interest: L.interest || 'Chat enquiry', preferred_time: L.time || null, message: L.reason ? `Chat: ${L.reason}`.slice(0, 1000) : null, source: 'Chatbot', transcript });
    ok = !error;
  }
  state.busy = false; state.lead = null;
  if (ok) { state.saved = true; say(`Sent! A JARIN coach will call ${L.name.split(' ')[0]} within one working day. You can also WhatsApp +${waNumber()}.`); }
  else say(`Sorry, that didn't go through. Please WhatsApp +${waNumber()} or call ${SITE.phone} and we'll sort it out right away.`);
}
