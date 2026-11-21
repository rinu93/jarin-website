// =====================================================================
//  JARIN Fitness Studio — website details
//  Edit the text between the quotes, save, and upload this file to GitHub.
//  Lines marked  ✏️  still hold sample values: replace them with your real details.
// =====================================================================

export const SITE = {
  name: 'JARIN Fitness Studio',
  // Address of the Employee Dashboard site (used by the "Employee" button). Updated after deployment.
  dashboardUrl: 'https://jarin-dashboard.vercel.app',
  tagline: 'Glow up. Lift up. Level up.',
  intro: 'Thuckalay’s digital gym. Train with expert coaches, then watch every visit and every kilo add up in your member app.',

  // ---------- Contact ----------
  phone: '+91 95000 77641',                       // ✏️ shown on the site and used for "Call us"
  whatsapp: '919500077641',                       // ✏️ country code + number (spaces and + are removed automatically)
  email: 'enquiry@jarinfitness.com',                // ✏️
  instagram: 'jarinfitness',                      // ✏️ Instagram username without @ (leave '' to hide)

  // ---------- Location ----------
  addressLines: ['Behind Vasanth & Co, Main Road', 'Thuckalay, Tamil Nadu 629175'],   // ✏️
  mapQuery: 'JARIN Fitness Studio, Thuckalay',               // ✏️ what to search on Google Maps, e.g. 'JARIN Fitness Studio, Kochi'
  landmark: 'Behind Vasanth & Co',                    // ✏️ e.g. 'Opposite City Mall'
  parking: 'Free parking for bikes and cars',     // ✏️

  // ---------- Opening hours ----------
  // Set in the Employee Dashboard → Website content (these are only the defaults).
  hours: Object.fromEntries(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => [d, [['06:00', '22:30']]])),
  hoursNote: '',

  // ---------- Services (icon: strength, cardio, hiit, pt, nutrition, functional, yoga, boxing, transformation, ladies) ----------
  // Training styles only: prices, personal training, diet and physio are managed as Website content.
  services: [
    { icon: 'strength',       title: 'Strength Training',   text: 'Power racks, platforms and a full dumbbell range. Learn to lift with perfect form.' },
    { icon: 'cardio',         title: 'Cardio Zone',         text: 'Treadmills, bikes, cross-trainers and rowers to build your engine.' },
    { icon: 'hiit',           title: 'HIIT & Group Circuits', text: 'High-energy circuits that torch calories and build stamina, coached in small groups.' },
    { icon: 'functional',     title: 'Functional Training', text: 'Sleds, battle ropes and kettlebells for real-world strength and agility.' },
    { icon: 'transformation', title: 'Body Transformation', text: '12-week programmes with check-ins, measurements and progress tracking.' },
  ],                                              // ✏️ remove or edit any service

  // ---------- Equipment zones (art: treadmill, rack, dumbbells, kettlebell, bike, cable) ----------
  equipment: [
    { art: 'treadmill',  title: 'Cardio Deck',        items: ['Commercial treadmills','Stairmil', 'Spin & air bikes', 'Cross-trainers', 'Rowing machines'] },
    { art: 'rack',       title: 'Strength Machines',  items: ['Leg press & hack squat', 'Chest & shoulder press', 'Lat pulldown & rows', 'Smith machine'] },
    { art: 'dumbbells',  title: 'Free Weights',       items: ['Dumbbells 2.5 – 50 kg', 'Olympic barbells & plates', 'Adjustable benches', 'Lifting platforms'] },
    { art: 'kettlebell', title: 'Functional Area',    items: ['Training track & sled', 'Bench, Kettlebells & medicine balls', 'Battle ropes', 'TRX & plyo boxes'] },
  ],                                              // ✏️

  currency: '₹',
  // Plans, fees, benefits, extra services and terms are edited in the Employee Dashboard → Website content.

  // ---------- Why JARIN: the digital gym (icon: app, qr, chart, bell, gift, calendar) ----------
  digital: [
    { icon: 'app',      title: 'Your gym in your pocket',  text: 'Member portal with a digital membership card, plan details and days left, on any phone.' },
    { icon: 'qr',       title: 'Digital check-in',         text: 'Every visit is logged automatically, so your attendance calendar builds itself.' },
    { icon: 'chart',    title: 'Progress you can see',     text: 'Weight and BMI tracked at every check-up, plotted as a progress line in your portal.' },
    { icon: 'bell',     title: 'Smart reminders',          text: 'WhatsApp reminders before your renewal, so your streak never breaks.' },
    { icon: 'gift',     title: 'Personal offers',          text: 'Your coach can send renewal offers made just for you, straight to your portal.' },
  ],

};

// WhatsApp needs digits only (country code + number)
export const waNumber = () => String(SITE.whatsapp || SITE.phone || '').replace(/\D/g, '');
export const telNumber = () => String(SITE.phone || '').replace(/[^\d+]/g, '');

// Days in display order
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Returns { open: bool, label: '...' } for right now, using the visitor's clock.
export function openStatus(now = new Date()) {
  const js = now.getDay(); // 0 = Sunday
  const dayName = DAYS[(js + 6) % 7];
  const mins = now.getHours() * 60 + now.getMinutes();
  const toM = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fmt = t => { const [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; const hh = ((h + 11) % 12) + 1; return `${hh}:${String(m).padStart(2, '0')} ${ap}`; };
  for (const [a, b] of SITE.hours[dayName] || []) {
    if (mins >= toM(a) && mins < toM(b)) return { open: true, label: `Open now · until ${fmt(b)}` };
  }
  // next opening, today or later this week
  for (let i = 0; i < 7; i++) {
    const d = DAYS[(js + 6 + i) % 7];
    for (const [a] of SITE.hours[d] || []) {
      if (i === 0 && toM(a) <= mins) continue;
      return { open: false, label: `Closed · opens ${i === 0 ? 'today' : i === 1 ? 'tomorrow' : d} at ${fmt(a)}` };
    }
  }
  return { open: false, label: 'Closed' };
}
export const fmtTime = t => { const [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`; };
