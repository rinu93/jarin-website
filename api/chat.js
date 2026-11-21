// JARIN website chat assistant — Vercel serverless function (POST /api/chat)
//
// Answers visitors' questions from the gym's own details (site-config.js) and saves
// enquiries straight into the Employee Dashboard (Supabase `enquiries`, source "Chatbot").
//
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   ANTHROPIC_API_KEY        required for AI replies; without it the website uses its guided mode
//   CHAT_MODEL               optional, defaults to claude-opus-5-5 (e.g. claude-haiku-5-5 to cut cost)
//   VITE_SUPABASE_URL        same values the website already uses
//   VITE_SUPABASE_ANON_KEY
import Anthropic from '@anthropic-ai/sdk';
import { SITE, waNumber } from '../site-config.js';
import { contentFromRows, describeContent, money as rupees } from '../content.js';

const MODEL = process.env.CHAT_MODEL || 'claude-opus-5-5';
// Server-side refusal fallback is available on these models; others run without it.
const SUPPORTS_FALLBACK = /^claude-(opus-5|sonnet-5-5|fable-5)/.test(MODEL);

const LIMITS = { messages: 30, charsPerMessage: 1500, totalChars: 14000, toolRounds: 4 };

/* ---------------- knowledge ---------------- */
const money = n => '₹' + Number(n).toLocaleString('en-IN');
function gymFacts() {
  // Stable details only. Prices, plans, hours and offers come from the dashboard (LIVE DETAILS).
  return [
    `Gym: ${SITE.name}. Tagline: ${SITE.tagline}`,
    `About: ${SITE.intro}`,
    `Address: ${SITE.addressLines.join(', ')}. Landmark: ${SITE.landmark || '—'}. Parking: ${SITE.parking || '—'}.`,
    `Phone: ${SITE.phone}. WhatsApp: +${waNumber()}. Email: ${SITE.email}.${SITE.instagram ? ` Instagram: @${SITE.instagram}.` : ''}`,
    `Training styles:\n${SITE.services.map(s => `- ${s.title}: ${s.text}`).join('\n')}`,
    `Equipment:\n${SITE.equipment.map(e => `- ${e.title}: ${e.items.join(', ')}`).join('\n')}`,
    `Member portal features:\n${(SITE.digital || []).map(d => `- ${d.title}: ${d.text}`).join('\n')}`,
    `Trial day: a tour, a body composition check and a guided workout with a trainer; no obligation to join. The price is in LIVE DETAILS.`,
  ].filter(Boolean).join('\n\n');
}

// Stable text first so it can be cached between requests.
const SYSTEM = `You are the JARIN Assistant, the chat helper on the website of ${SITE.name}, a gym.

How to answer:
- Answer only from the GYM FACTS, LIVE DETAILS and LIVE OFFERS below. Never invent prices, discounts, timings, services or staff names. If something isn't covered, say so plainly and offer to have the team call back.
- Keep replies short: 1–3 sentences, or a few short lines for lists like timings or plans. Friendly and direct, like a helpful front-desk person.
- Prices are in rupees (₹). Mention the one-time registration fee when someone asks about joining costs.
- Reply in the visitor's language when they write in Tamil, Malayalam or Hindi; otherwise English.
- Don't give medical advice; suggest speaking to a coach or doctor.
- Never ask for payment details, passwords or ID numbers.

Collecting an enquiry:
- When the visitor wants a trial day, wants to join, asks for a call back, or asks something you can't answer, offer to take their details.
- You need their name and a phone number (at least 8 digits). Also ask what they're interested in and the best time to visit, but don't insist.
- Read the details back in one line and ask them to confirm. Only after they confirm, call submit_enquiry once.
- After it's saved, tell them a JARIN coach will call within one working day, and mention they can also WhatsApp +${waNumber()}.

GYM FACTS
${gymFacts()}`;

const TOOLS = [{
  name: 'submit_enquiry',
  description: 'Save a visitor enquiry for the JARIN team to call back. Call only after the visitor has confirmed their name and phone number.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string', description: "Visitor's name" },
      phone: { type: 'string', description: 'Phone number with at least 8 digits' },
      email: { type: 'string', description: 'Email, or empty string if not given' },
      interest: { type: 'string', description: 'What they want, e.g. Free trial, Weight loss, Annual plan' },
      preferred_time: { type: 'string', description: 'Best time to visit or call, or empty string' },
      message: { type: 'string', description: 'One-line summary of their goal or question, or empty string' },
    },
    required: ['name', 'phone', 'email', 'interest', 'preferred_time', 'message'],
  },
}];

/* ---------------- live details and offers (cached 5 minutes) ---------------- */
let liveCache = { at: 0, text: '' };
async function liveOffers(fetchImpl) {
  if (Date.now() - liveCache.at < 300000) return liveCache.text;
  let content = contentFromRows([]); let offers = 'No special offers are live right now.';
  try {
    const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY;
    if (url && key) {
      const h = { headers: { apikey: key, Authorization: `Bearer ${key}` } };
      const [rc, ro] = await Promise.all([
        fetchImpl(`${url}/rest/v1/site_content?select=key,value`, h),
        fetchImpl(`${url}/rest/v1/offers?select=title,details,tag,valid_until,starts_on,kind,highlight,price_rows&order=sort.asc&limit=12`, h),
      ]);
      if (rc.ok) content = contentFromRows(await rc.json());
      if (ro.ok) {
        const rows = await ro.json();
        if (rows.length) offers = rows.map(o => `- [${o.kind || 'seasonal'}] ${o.title}${o.tag ? ` (${o.tag})` : ''}${o.highlight ? `, ${o.highlight}` : ''}${o.details ? `: ${o.details}` : ''}${Array.isArray(o.price_rows) && o.price_rows.length ? ` Prices: ${o.price_rows.map(r => `${r.label} ${r.was ? rupees(r.was) + ' → ' : ''}${rupees(r.now)}`).join('; ')}.` : ''}${o.starts_on ? ` Starts ${o.starts_on}.` : ''}${o.valid_until ? ` Valid till ${o.valid_until}.` : ''}`).join('\n');
      }
    }
  } catch { /* fall back to the built-in details */ }
  const text = `LIVE DETAILS\n${describeContent(content)}\n\nLIVE OFFERS\n${offers}`;
  liveCache = { at: Date.now(), text };
  return text;
}

/* ---------------- saving an enquiry ---------------- */
function transcriptOf(history) {
  return history.map(m => `${m.role === 'user' ? 'Visitor' : 'JARIN'}: ${m.content}`).join('\n').slice(-11000);
}
async function saveEnquiry(input, history, fetchImpl) {
  const name = String(input.name || '').trim().slice(0, 100);
  const phone = String(input.phone || '').trim().slice(0, 30);
  if (!name) return { ok: false, error: 'Name is missing. Ask the visitor for their name.' };
  if (phone.replace(/\D/g, '').length < 8) return { ok: false, error: 'Phone number needs at least 8 digits. Ask the visitor to check it.' };
  const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: false, error: 'Enquiry storage is not configured. Ask the visitor to WhatsApp or call the gym instead.' };
  const body = {
    name, phone,
    email: String(input.email || '').trim().slice(0, 200) || null,
    interest: String(input.interest || '').trim().slice(0, 100) || 'Chat enquiry',
    preferred_time: String(input.preferred_time || '').trim().slice(0, 100) || null,
    message: String(input.message || '').trim().slice(0, 1000) || null,
    source: 'Chatbot',
    transcript: transcriptOf(history),
  };
  const r = await fetchImpl(`${url}/rest/v1/enquiries`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!r.ok) return { ok: false, error: 'Saving failed. Apologise briefly and ask the visitor to WhatsApp or call the gym instead.' };
  return { ok: true };
}

/* ---------------- request validation ---------------- */
function cleanHistory(raw) {
  if (!Array.isArray(raw) || !raw.length) return null;
  const msgs = raw.slice(-LIMITS.messages)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.slice(0, LIMITS.charsPerMessage) }));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return null;
  if (msgs.reduce((n, m) => n + m.content.length, 0) > LIMITS.totalChars) return null;
  return msgs;
}

/* ---------------- the conversation loop ---------------- */
export function createHandler({ client, fetchImpl = fetch } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST' }); return; }
    if (!client) { res.status(503).json({ fallback: true, error: 'AI replies are not configured' }); return; }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const history = cleanHistory(body.messages);
    if (!history) { res.status(400).json({ error: 'Send a non-empty conversation that ends with the visitor’s message.' }); return; }

    const messages = history.map(m => ({ role: m.role, content: m.content }));
    const offers = await liveOffers(fetchImpl);
    let saved = false;
    try {
      for (let round = 0; round <= LIMITS.toolRounds; round++) {
        const params = {
          model: MODEL,
          max_tokens: 4000,
          output_config: { effort: 'low' },
          system: [
            { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: offers },
          ],
          tools: TOOLS,
          tool_choice: { type: 'auto' },
          messages,
        };
        const response = SUPPORTS_FALLBACK
          ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
          : await client.messages.create(params);

        if (response.stop_reason === 'refusal') {
          res.status(200).json({ reply: `Sorry, I can't help with that here. For anything else, WhatsApp us on +${waNumber()} or call ${SITE.phone}.`, saved });
          return;
        }
        const toolUses = response.content.filter(b => b.type === 'tool_use');
        if (response.stop_reason !== 'tool_use' || !toolUses.length) {
          const reply = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
          res.status(200).json({ reply: reply || `Sorry, I didn't catch that. Could you rephrase? You can also WhatsApp us on +${waNumber()}.`, saved });
          return;
        }
        messages.push({ role: 'assistant', content: response.content });
        const results = [];
        for (const tu of toolUses) {
          if (tu.name !== 'submit_enquiry' || saved) {
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: saved ? 'Already saved; do not save again.' : 'Unknown tool.', is_error: !saved });
            continue;
          }
          const r = await saveEnquiry(tu.input || {}, history, fetchImpl);
          if (r.ok) saved = true;
          results.push({ type: 'tool_result', tool_use_id: tu.id, content: r.ok ? 'Saved. The team will call back within one working day.' : r.error, is_error: !r.ok });
        }
        messages.push({ role: 'user', content: results });
      }
      res.status(200).json({ reply: `Thanks! ${saved ? 'Your details are saved and a coach will call you soon.' : `Please WhatsApp us on +${waNumber()} and we'll help right away.`}`, saved });
    } catch (err) {
      const status = err instanceof Anthropic.RateLimitError ? 429 : err instanceof Anthropic.APIError ? 502 : 500;
      console.error('chat error', status, err && err.message);
      res.status(status).json({ fallback: true, error: 'The assistant is busy right now.' });
    }
  };
}

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
export default createHandler({ client });
