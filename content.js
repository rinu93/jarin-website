// Website content the owner and manager edit in the Employee Dashboard → Website content.
// The values below are the built-in defaults (from the JARIN fee guide and offers sheets); the
// live values come from the `site_content` table and replace them as soon as they load.
// Shared by the website, the chat assistant (api/chat.js) and the dashboard. Keep copies in sync.

export const DEFAULT_CONTENT = {
  facts: [
    { value: '2,000 sq ft', label: 'Fully air-conditioned training floor' },
    { value: '6 AM – 10:30 PM', label: 'Open every day, 16.5 hours' },
    { value: 'Cult International', label: 'Endurance equipment partner' },
    { value: '3 trainers', label: 'On the floor, including a female trainer' },
  ],
  fees: { registration: 1500, ptMonthly: 6000, trialPass: 300, locker: 300, gstNote: 'Prices in Indian Rupees, exclusive of GST as applicable.', banner: 'Grand opening · December 2026' },
  plans: [
    { id: 'monthly', name: 'Monthly', price: 1500, months: 1, cult: false, popular: false, enabled: true },
    { id: 'half-yearly', name: 'Half-yearly', price: 9000, months: 6, cult: false, popular: false, enabled: true },
    { id: 'annual', name: 'Annual', price: 18000, months: 12, cult: true, popular: true, enabled: true },
  ],
  benefits: [
    { text: 'Floor guidance from our trainers', who: 'all' },
    { text: 'Locker room and changing rooms', who: 'all' },
    { text: 'Clean bathrooms', who: 'all' },
    { text: 'Refreshment stall', who: 'all' },
    { text: 'Bodybuilding gallery and magazines', who: 'all' },
    { text: 'Cult app access', who: 'annual' },
  ],
  services: [
    { title: 'Diet & supplements', note: 'Plans built around your goal and routine.', items: [['First consultation', 1000], ['Monthly diet plan + follow-ups', 1500], ['Supplement guidance', 500]] },
    { title: 'Physiotherapy', note: 'Injury recovery and mobility care.', items: [['Assessment', 800], ['Single session', 700], ['6-session pack', 3900]] },
    { title: 'Workout stall', note: 'Items subject to availability.', items: [['Protein shake', 180], ['Gym towel', 250], ['Shaker bottle', 350], ['Resistance band', 400], ['Lifting gloves', 500], ['Jarin branded tee', 600]] },
  ],
  terms: [
    'Memberships are personal and non-transferable; fees are paid in advance.',
    'Offers cannot be combined. Special packages are approved by the studio manager.',
  ],
  hours: { open: '06:00', close: '22:30', closed: [], note: '' },
  logo_reel: {
    screens: { website: { on: true, clip: 'all', seconds: 15 }, employee: { on: true, clip: 'iron-lock', seconds: 10 }, member: { on: true, clip: 'rep-pulse', seconds: 8 } },
    dashboard: true, videos: [{ id: 'ember-aura', name: 'Ember Aura', enabled: true }, { id: 'iron-lock', name: 'Iron Lock', enabled: true }, { id: 'rep-pulse', name: 'Rep Pulse', enabled: true }] },
};
export const LOGO_VIDEOS = { 'ember-aura': 'Ember Aura', 'iron-lock': 'Iron Lock', 'rep-pulse': 'Rep Pulse' };
// Intro screens: which logo animation plays, and for how long, when each page opens.
export const INTRO_SCREENS = { website: 'Website', employee: 'Employee login', member: 'Member login' };
export function introFor(rc, key) {
  const d = DEFAULT_CONTENT.logo_reel.screens[key]; const s = (rc && rc.screens && rc.screens[key]) || {};
  const legacy = key === 'website' && rc && !rc.screens ? { on: rc.loader !== false, seconds: rc.loaderSeconds } : {};
  const c = { ...d, ...legacy, ...s };
  if (c.clip !== 'all' && !LOGO_VIDEOS[c.clip]) c.clip = 'all';
  c.seconds = Math.min(60, Math.max(2, Number(c.seconds) || d.seconds));
  return c;
}
export const OFFER_KINDS = { seasonal: 'Seasonal', student: 'Students', special: 'Special packages', referral: 'Referral rewards' };
export const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function contentFromRows(rows) {
  const c = JSON.parse(JSON.stringify(DEFAULT_CONTENT));
  for (const r of rows || []) if (r && r.key in c && r.value != null) c[r.key] = r.value;
  return c;
}
export const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');
export const livePlans = c => (c.plans || []).filter(p => p.enabled !== false);
export const perMonth = p => Math.round(p.price / Math.max(1, p.months));
export const periodLabel = p => p.months === 1 ? 'for 1 month' : `for ${p.months} months`;
export const hoursToWeek = h => Object.fromEntries(WEEK.map(d => [d, (h.closed || []).includes(d) ? [] : [[h.open, h.close]]]));

// Copy the live content into the website's SITE object (used by the chat's quick answers and hours).
export function applyToSite(SITE, c) {
  SITE.content = c;
  SITE.plans = livePlans(c).map(p => ({ name: p.name, price: p.price, period: periodLabel(p) }));
  SITE.registrationFee = c.fees.registration;
  SITE.hours = hoursToWeek(c.hours);
  SITE.hoursNote = c.hours.note || '';
}

// Plain-text summary for the AI assistant.
export function describeContent(c) {
  const fmt = t => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
  const plans = livePlans(c).map(p => `- ${p.name}: ${money(p.price)} ${periodLabel(p)} (works out to ${money(perMonth(p))} a month; pay on joining ${money(p.price + c.fees.registration)} including registration)${p.cult ? '; includes Cult app access' : ''}`).join('\n');
  const annualNames = livePlans(c).filter(p => p.cult).map(p => p.name).join(', ') || 'annual';
  return [
    `Quick facts: ${c.facts.map(f => `${f.value}: ${f.label}`).join('; ')}.`,
    `Opening hours: ${fmt(c.hours.open)} – ${fmt(c.hours.close)} every day${(c.hours.closed || []).length ? ` except ${c.hours.closed.join(', ')}` : ''}.${c.hours.note ? ' ' + c.hours.note : ''}`,
    `Membership plans:\n${plans}`,
    `One-time registration fee: ${money(c.fees.registration)}, on every plan.`,
    `Personal trainer add-on: ${money(c.fees.ptMonthly)} per month on any plan (one-to-one coaching with their own plan).`,
    `One-day trial pass: ${c.fees.trialPass ? money(c.fees.trialPass) : 'free'}. Personal locker: ${money(c.fees.locker)} per month.`,
    `Included with every plan: ${c.benefits.filter(b => b.who === 'all').map(b => b.text).join('; ')}. Only with ${annualNames}: ${c.benefits.filter(b => b.who === 'annual').map(b => b.text).join('; ') || 'nothing extra'}.`,
    `Extra services:\n${c.services.map(s => `- ${s.title} (${s.note}): ${s.items.map(([n, p]) => `${n} ${money(p)}`).join(', ')}`).join('\n')}`,
    `Terms: ${c.terms.join(' ')} ${c.fees.gstNote}`,
  ].join('\n\n');
}
