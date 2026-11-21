// Member invoice + welcome note. Shared by the Employee Dashboard and the Member portal.
// One invoice = the payments saved together (same invoice number), e.g. registration + plan.
export const GYM = {
  name: 'JARIN Fitness Studio',
  address: 'Behind Vasanth & Co, Main Road, Thuckalay, Tamil Nadu 629175',
  phone: '+91 95000 77641',
  email: 'enquiry@jarinfitness.com',
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rs = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const d8 = d => d ? new Date(String(d).slice(0, 10) + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const label = p => p.type === 'registration' ? 'One-time registration fee' : `${p.type === 'new' ? 'Membership' : 'Renewal'}${p.plan ? ` · ${p.plan} plan` : ''}`;

// member: { code, name, phone, email, plan, joinDate, expiryDate }   pays: payment rows sharing one invoice_no
export function invoiceData(member, pays, extra = {}) {
  const rows = pays.slice().sort((a, b) => (a.type === 'registration' ? -1 : 0) - (b.type === 'registration' ? -1 : 0));
  const total = rows.reduce((t, p) => t + Number(p.amount || 0), 0);
  const isNew = rows.some(p => p.type === 'new' || p.type === 'registration');
  return { no: rows[0]?.invoice_no || '—', date: rows[0]?.paid_on || rows[0]?.date, mode: rows.find(p => p.mode)?.mode || '', rows, total, isNew, member, note: extra.note || '', portal: extra.portal || '' };
}

export function invoiceHtml(inv) {
  const m = inv.member;
  return `<div class="inv">
  <div class="inv-head"><div><b class="inv-gym">${esc(GYM.name)}</b><div>${esc(GYM.address)}</div><div>${esc(GYM.phone)} · ${esc(GYM.email)}</div></div>
    <div class="inv-no"><b>Invoice</b><div>${esc(inv.no)}</div><div>${esc(d8(inv.date))}</div><span class="inv-paid">Paid</span></div></div>
  <div class="inv-to"><div><small>Billed to</small><b>${esc(m.name)}</b><div>Membership ID ${esc(m.code)}</div>${m.phone ? `<div>${esc(m.phone)}</div>` : ''}${m.email ? `<div>${esc(m.email)}</div>` : ''}</div>
    <div><small>Subscription</small><b>${esc(m.plan || '—')} plan</b><div>${esc(d8(m.joinDate))} – ${esc(d8(m.expiryDate))}</div></div></div>
  <table class="inv-t"><thead><tr><th>Item</th><th>Offer</th><th class="r">Amount</th></tr></thead><tbody>
    ${inv.rows.map(p => `<tr><td>${esc(label(p))}</td><td>${esc(p.offer || '—')}</td><td class="r">${esc(rs(p.amount))}</td></tr>`).join('')}
  </tbody><tfoot><tr><td colspan="2">Total paid${inv.mode ? ` · ${esc(inv.mode)}` : ''}</td><td class="r">${esc(rs(inv.total))}</td></tr></tfoot></table>
  <p class="inv-note">${inv.isNew ? 'Welcome to the JARIN family. ' : 'Thank you for renewing. '}Glow up. Lift up. Level up.${inv.note ? `<br>${esc(inv.note)}` : ''}</p>
</div>`;
}

export const INVOICE_CSS = `.inv{font-family:"Instrument Sans",system-ui,sans-serif;color:#1A0F07;background:#fff;max-width:720px;margin:0 auto;padding:32px;font-size:14px;line-height:1.5}
.inv-head{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #E8A272;padding-bottom:16px}
.inv-gym{font:800 24px/1 "Big Shoulders Display",Impact,sans-serif;text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:6px;color:#B86B3C}
.inv-no{text-align:right}.inv-no b{font:800 22px/1 "Big Shoulders Display",Impact,sans-serif;text-transform:uppercase}
.inv-paid{display:inline-block;margin-top:6px;background:#E8F7EE;color:#1E7B46;border-radius:10px;padding:2px 10px;font-weight:700;font-size:12px}
.inv-to{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:20px 0}.inv-to small{display:block;color:#7A6A5E;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.inv-to b{font-size:16px}
.inv-t{width:100%;border-collapse:collapse}.inv-t th,.inv-t td{padding:10px 8px;border-bottom:1px solid #EADFD5;text-align:left}.inv-t th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#7A6A5E}
.inv-t .r{text-align:right;font-variant-numeric:tabular-nums}.inv-t tfoot td{font-weight:800;font-size:16px;border-bottom:0;border-top:2px solid #1A0F07}
.inv-note{margin-top:20px;color:#7A6A5E;font-size:12.5px}`;

// Plain-text welcome + summary, for email and WhatsApp.
export function welcomeText(inv) {
  const m = inv.member; const first = String(m.name || '').split(' ')[0];
  const items = inv.rows.map(p => `- ${label(p)}${p.offer ? ` (${p.offer})` : ''}: ${rs(p.amount)}`).join('\n');
  return `${inv.isNew ? `Hi ${first}, welcome to ${GYM.name}!` : `Hi ${first}, thank you for renewing at ${GYM.name}!`}

Membership ID: ${m.code}
Plan: ${m.plan || '—'} · ${d8(m.joinDate)} to ${d8(m.expiryDate)}

Invoice ${inv.no} · ${d8(inv.date)}
${items}
Total paid: ${rs(inv.total)}${inv.mode ? ` by ${inv.mode}` : ''}
${inv.portal ? `\nSee your membership card, visits and progress in the member portal: ${inv.portal} (sign in with this email).\n` : ''}
${GYM.name} · ${GYM.phone}
Glow up. Lift up. Level up.`;
}
export const welcomeSubject = inv => inv.isNew ? `Welcome to ${GYM.name} · Invoice ${inv.no}` : `Your ${GYM.name} renewal · Invoice ${inv.no}`;

// Opens the invoice in a print window, where it can be printed or saved as PDF.
export function printInvoice(inv) {
  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.no)} · ${esc(GYM.name)}</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800&family=Instrument+Sans:wght@400;600;700&display=swap">
    <style>body{margin:0;background:#fff}${INVOICE_CSS}@media print{.inv{padding:0}}</style></head><body>${invoiceHtml(inv)}
    <script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`);
  w.document.close();
  return true;
}
