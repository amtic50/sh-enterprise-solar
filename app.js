/* SH Enterprise (Green Energy) — solar vendor app. REAL product.
   Vanilla JS + Firebase (Auth + Firestore). No framework, no build step.
   - Frontend: GitHub Pages (public repo — NEVER any customer data in it).
   - Backend: Firebase Auth (vendor email/password login) + Cloud Firestore.
   - firebase-config.js holds the real Firebase web config (filled in by the
     project owner — this file ships with empty placeholders, never invent one).
   - Logged-out visitors see a small clearly-marked SAMPLE preview only.
   - After vendor login, sample data disappears; only real Firestore data shows.
   UPGRADE PATH (later): Google Drive (via Apps Script) for photos/documents;
   Capacitor wraps this same site into the Android APK; staff logins. */

var LS_KEY = 'sh-solar-v1';
var SAMPLE_LS_KEY = 'sh-solar-sample-v1';

/* The 8 real pipeline stages from the PM Surya Ghar portal export, in workflow order. */
var STAGES = [
  'Upload Agreement (Pending)',
  'Inspection (Pending)',
  'Installation (Pending)',
  'Subsidy Request (Not Redeemed)',
  'Subsidy Request (Redeemed)',
  'Subsidy Request (Return)',
  'Subsidy Disbursal (Pending)',
  'Subsidy Disbursal (Disbursed)'
];
/* Stuck stages shown in "Needs action", with what is needed next. */
var NEEDS_ACTION = {
  'Subsidy Request (Not Redeemed)': 'Subsidy not redeemed yet — remind them to redeem it.',
  'Subsidy Request (Return)': 'Returned for correction — fix and resubmit.',
  'Installation (Pending)': 'Installation not done yet — fix a date.',
  'Upload Agreement (Pending)': 'Agreement not uploaded yet.',
  'Inspection (Pending)': 'Inspection pending.',
  'Subsidy Disbursal (Pending)': 'Disbursal pending with the department.'
};
var DONE_STAGE = 'Subsidy Disbursal (Disbursed)';

/* Emoji for each pipeline stage — shown on status pills and headings. */
var STAGE_EMOJI = {
  'Subsidy Disbursal (Disbursed)': '✅',
  'Installation (Pending)': '🔧',
  'Upload Agreement (Pending)': '📝',
  'Inspection (Pending)': '🔍',
  'Subsidy Request (Not Redeemed)': '⏰',
  'Subsidy Request (Redeemed)': '📤',
  'Subsidy Request (Return)': '↩️',
  'Subsidy Disbursal (Pending)': '💰'
};
function stageEmoji(st) { return STAGE_EMOJI[st] || '•'; }

var SUBSIDY_SLABS = [
  { maxKw: 1, amount: 30000 },
  { maxKw: 2, amount: 60000 },
  { maxKw: Infinity, amount: 78000 }
];
function subsidyFor(kw) {
  for (var i = 0; i < SUBSIDY_SLABS.length; i++) {
    if (kw <= SUBSIDY_SLABS[i].maxKw) return SUBSIDY_SLABS[i].amount;
  }
  return 78000;
}

var DEFAULT_SETTINGS = {
  businessName: 'SH Enterprise',
  businessShort: 'Green Energy',
  owner: 'Saiful',
  address: 'Kalpanagar, near Kalpana Cinema Hall, Goalpara, Assam',
  phone: '',
  gstPct: 13.8,
  offerTitle: '🎉 BUMPER OFFER ☀️',
  offerText: 'PM Surya Ghar subsidy up to ₹78,000 on rooftop solar — plus gifts for every friend you refer! 🎁',
  offerValidTill: '',
  tiers: { '1': 'Free panel cleaning', '2': '₹500 gift', '3': '₹1,500 gift' }
};

var DEFAULT_TEMPLATES = {
  puja: {
    en: "🙏 Namaskar {name}! ☀️ It's been {months} since you went solar with us — thank you for trusting us! This Puja, share the sunshine: PM Surya Ghar subsidy up to ₹78,000 on rooftop solar, plus a gift for you for every friend you bring! 🎁 Know someone who wants solar? Send them to us — your gift is waiting! ✨ — Saiful, SH Enterprise (Green Energy), Kalpanagar 🌞",
    as: "🙏 নমস্কাৰ {name}! ☀️ আপুনি আমাৰ পৰা ছোলাৰ লগোৱা {months} হ'ল — আপোনাৰ বিশ্বাসৰ বাবে ধন্যবাদ! এই পূজাত ৰ'দৰ পোহৰ বিলাওক: PM Surya Ghar চাবচিডিৰে ₹78,000 লৈকে ৰেহাই, আৰু আপুনি অনা প্ৰতিজন বন্ধুৰ বাবে উপহাৰ! 🎁 চিনাকি কোনোবাই ছোলাৰ লগাব বিচাৰিছে নেকি? আমাৰ ওচৰলৈ পঠিয়াওক — আপোনাৰ উপহাৰ ৰৈ আছে! ✨ — ছাইফুল, SH Enterprise (Green Energy), কল্পনানগৰ 🌞"
  },
  referral: {
    en: "🙏 Namaskar {name}! 🎉 Wonderful news — because of you, another home is shining with solar! You have brought {count} friend(s) to us so far. 🌞 Bring one more friend and your next gift is yours! 🎁 Check your rewards here: {link} — Saiful, SH Enterprise (Green Energy) ✨",
    as: "🙏 নমস্কাৰ {name}! 🎉 ভাল খবৰ — আপোনাৰ বাবে আন এখন ঘৰতো ছোলাৰ জিলিকিছে! আপুনি এতিয়ালৈকে {count} জন বন্ধুক আমাৰ ওচৰলৈ আনিছে। 🌞 আৰু এজন বন্ধুক আনিলে আপোনাৰ পৰৱৰ্তী উপহাৰটো পাব! 🎁 আপোনাৰ উপহাৰ ইয়াত চাওক: {link} — ছাইফুল, SH Enterprise (Green Energy) ✨"
  },
  anniversary: {
    en: "🙏 Namaskar {name}! 🎉☀️ Happy 1-year solar anniversary! A full year since we installed solar at your home — your electricity bill must be smiling by now. 😊 Need a panel cleaning or a free check-up? Just message us anytime! And if a friend wants solar, PM Surya Ghar subsidy up to ₹78,000 is waiting — plus a gift for you! 🎁 — Saiful, SH Enterprise (Green Energy)",
    as: "🙏 নমস্কাৰ {name}! 🎉☀️ ছোলাৰৰ ১ বছৰ সম্পূৰ্ণ হোৱাৰ শুভেচ্ছা! আপোনাৰ ঘৰত ছোলাৰ লগোৱা এবছৰ হ'ল — বিদ্যুৎ বিল নিশ্চয় কমিছে। 😊 পেনেল চাফা বা বিনামূলীয়া পৰীক্ষা লাগিলে আমাক মেছেজ কৰক! আৰু কোনো বন্ধুৱে ছোলাৰ লগাব বিচাৰিলে PM Surya Ghar চাবচিডি ₹78,000 লৈকে পাব — আপোনাৰ বাবেও উপহাৰ আছে! 🎁 — ছাইফুল, SH Enterprise (Green Energy)"
  },
  reminder_not_redeemed: {
    en: "🙏 Namaskar {name}! ⏰ Your {kw} kW solar is installed — but your subsidy is still waiting to be redeemed! 💰 Don't miss it: open the PM Surya Ghar portal and redeem your subsidy today, or just message us and we will help you do it. ✅ — Saiful, SH Enterprise (Green Energy)",
    as: "🙏 নমস্কাৰ {name}! ⏰ আপোনাৰ {kw} kW ছোলাৰ লগোৱা হৈ গৈছে — কিন্তু আপোনাৰ চাবচিডিটো এতিয়াও ৰিডিম কৰা হোৱা নাই! 💰 হেৰুৱাব নালাগে: আজিয়েই PM Surya Ghar পৰ্টেলত ৰিডিম কৰক, নহ'লে আমাক মেছেজ কৰক — আমি সহায় কৰিম। ✅ — ছাইফুল, SH Enterprise (Green Energy)"
  },
  reminder_return: {
    en: "🙏 Namaskar {name}! 📄 Your subsidy application came back for one small correction — no need to worry! Just send us the corrected document or photo and we will resubmit it right away. ✅ Message us now and let's get your subsidy moving! 💰 — Saiful, SH Enterprise (Green Energy)",
    as: "🙏 নমস্কাৰ {name}! 📄 আপোনাৰ চাবচিডি আবেদনখন সৰু ভুল এটাৰ বাবে ঘূৰাই দিয়া হৈছে — চিন্তা কৰিব নালাগে! শুদ্ধ কাগজ বা ফটো আমাক পঠিয়াওক, আমি তৎক্ষণাৎ আকৌ জমা দিম। ✅ এতিয়াই মেছেজ কৰক, চাবচিডিটো সোনকালে পোৱাৰ ব্যৱস্থা কৰোঁ! 💰 — ছাইফুল, SH Enterprise (Green Energy)"
  },
  reminder_installation: {
    en: "🙏 Namaskar {name}! ☀️ Your {kw} kW solar is ready to shine at your home — we are just waiting for your date! 📅 Tell us a day that suits you and our team will come and install it. Plus, PM Surya Ghar subsidy up to ₹78,000 is waiting for you after installation! 💰 — Saiful, SH Enterprise (Green Energy)",
    as: "🙏 নমস্কাৰ {name}! ☀️ আপোনাৰ {kw} kW ছোলাৰ আপোনাৰ ঘৰত জিলিকিবলৈ সাজু — আমি কেৱল আপোনাৰ দিনটোৰ অপেক্ষাত! 📅 সুবিধাৰ দিন এটা জনাওক, আমাৰ দলে আহি লগাই দিব। লগোৱাৰ পিছত PM Surya Ghar চাবচিডি ₹78,000 লৈকে আপোনাৰ বাবে ৰৈ আছে! 💰 — ছাইফুল, SH Enterprise (Green Energy)"
  },
  reminder_agreement: {
    en: "🙏 Namaskar {name}! 📝 Your solar agreement is the last step before installation — just one signature away! ✍️ Please send us a photo of the signed agreement and we will upload it on the portal for you right away. ✅ — Saiful, SH Enterprise (Green Energy)",
    as: "🙏 নমস্কাৰ {name}! 📝 আপোনাৰ ছোলাৰ এগ্ৰিমেণ্টখনেই লগোৱাৰ আগৰ শেষ খোজ — মাত্ৰ এটা চহীৰ দূৰত্বত! ✍️ চহী কৰা এগ্ৰিমেণ্টৰ ফটো আমাক পঠিয়াওক, আমি তৎক্ষণাৎ পৰ্টেলত আপলোড কৰি দিম। ✅ — ছাইফুল, SH Enterprise (Green Energy)"
  },
  reminder_inspection: {
    en: "🙏 Namaskar {name}! 🔍 The inspection of your {kw} kW solar plant is coming up — almost there! ✅ Please keep the plant area clear and your documents ready. The inspector may visit any day. Questions? Just message us! 📱 — Saiful, SH Enterprise (Green Energy)",
    as: "🙏 নমস্কাৰ {name}! 🔍 আপোনাৰ {kw} kW ছোলাৰ প্লাণ্টৰ পৰিদৰ্শন আহি আছে — আৰু অলপ বাকী! ✅ প্লাণ্টৰ ঠাই মুকলি ৰাখক আৰু কাগজবোৰ সাজু ৰাখক। পৰিদৰ্শক যিকোনো দিন আহিব পাৰে। কিবা প্ৰশ্ন থাকিলে আমাক মেছেজ কৰক! 📱 — ছাইফুল, SH Enterprise (Green Energy)"
  },
  reminder_disbursal: {
    en: "🙏 Namaskar {name}! 🎉 Good news — your subsidy is approved! 💰 The money is on its way from the department to your bank account. We are following up every day, and the moment it arrives we will message you. ✅ — Saiful, SH Enterprise (Green Energy)",
    as: "🙏 নমস্কাৰ {name}! 🎉 ভাল খবৰ — আপোনাৰ চাবচিডি অনুমোদন হৈছে! 💰 টকা বিভাগৰ পৰা আপোনাৰ বেংক একাউণ্টলৈ আহি আছে। আমি প্ৰতিদিনে তাৰ পিছত লাগি আছোঁ — টকা সোমোৱা মাত্ৰকে আপোনাক জনাম। ✅ — ছাইফুল, SH Enterprise (Green Energy)"
  }
};
var REMINDER_BY_STAGE = {
  'Subsidy Request (Not Redeemed)': 'reminder_not_redeemed',
  'Subsidy Request (Return)': 'reminder_return',
  'Installation (Pending)': 'reminder_installation',
  'Upload Agreement (Pending)': 'reminder_agreement',
  'Inspection (Pending)': 'reminder_inspection',
  'Subsidy Disbursal (Pending)': 'reminder_disbursal'
};
var TEMPLATE_NAMES = {
  puja: 'Puja offer', referral: 'Referral progress', anniversary: 'One-year anniversary',
  reminder_not_redeemed: 'Reminder — subsidy not redeemed',
  reminder_return: 'Reminder — application returned',
  reminder_installation: 'Reminder — installation pending',
  reminder_agreement: 'Reminder — agreement not uploaded',
  reminder_inspection: 'Reminder — inspection pending',
  reminder_disbursal: 'Reminder — disbursal pending'
};

/* ---- SAMPLE customers: shown ONLY to logged-out visitors, clearly marked.
   Clearly fake numbers (04000010000x). Real customers live in Firestore. ---- */
function demoCustomers() {
  return [
    { id: 'demo-a1k9', code: 'demo-a1k9', consumerNo: '040000100001', name: 'Ramesh Das', mobile: '9876543210', address: 'Kalpanagar, Goalpara', area: 'Goalpara', installDate: '2026-10-20', submittedOn: '2026-09-15', systemKw: 3, status: 'Subsidy Disbursal (Disbursed)', applicationNo: 'DEMO-NP-0001', subDivision: 'Goalpara Electrical Sub-Division', duplicate: false, reverification: false, referredBy: 'demo-h8t2', referralCount: 2, rewards: [] },
    { id: 'demo-b2m8', code: 'demo-b2m8', consumerNo: '040000100002', name: 'Anita Rabha', mobile: '8765432109', address: 'Bhalukdubi, Goalpara', area: 'Goalpara', installDate: '2026-03-15', submittedOn: '2026-02-10', systemKw: 2, status: 'Subsidy Disbursal (Disbursed)', applicationNo: 'DEMO-NP-0002', subDivision: 'Goalpara Electrical Sub-Division', duplicate: false, reverification: false, referredBy: null, referralCount: 3, rewards: [] },
    { id: 'demo-c3n7', code: 'demo-c3n7', consumerNo: '040000100003', name: 'Babul Hussain', mobile: '7654321098', address: 'Nayapara, Goalpara', area: 'Goalpara', installDate: '', submittedOn: '2026-10-02', systemKw: 5, status: 'Installation (Pending)', applicationNo: 'DEMO-NP-0003', subDivision: 'Goalpara Electrical Sub-Division', duplicate: false, reverification: false, referredBy: 'demo-b2m8', referralCount: 0, rewards: [] },
    { id: 'demo-d4p6', code: 'demo-d4p6', consumerNo: '040000100004', name: 'Priya Sharma', mobile: '9876501234', address: 'Agia, Goalpara', area: 'Goalpara', installDate: '2026-08-02', submittedOn: '2026-06-18', systemKw: 1, status: 'Subsidy Request (Redeemed)', applicationNo: 'DEMO-NP-0004', subDivision: 'Goalpara Electrical Sub-Division', duplicate: false, reverification: false, referredBy: 'demo-b2m8', referralCount: 0, rewards: [] },
    { id: 'demo-e5q5', code: 'demo-e5q5', consumerNo: '040000100005', name: 'Jiten Kalita', mobile: '8765409876', address: 'Baladmari, Goalpara', area: 'Goalpara', installDate: '2026-11-14', submittedOn: '2026-11-05', systemKw: 2, status: 'Subsidy Disbursal (Disbursed)', applicationNo: 'DEMO-NP-0005', subDivision: 'Goalpara Electrical Sub-Division', duplicate: false, reverification: false, referredBy: 'demo-b2m8', referralCount: 0, rewards: [] },
    { id: 'demo-f6r4', code: 'demo-f6r4', consumerNo: '040000100006', name: 'Monowar Ali', mobile: '7654012345', address: 'Bapuji Nagar, Goalpara', area: 'Goalpara', installDate: '', submittedOn: '2026-04-05', systemKw: 3, status: 'Inspection (Pending)', applicationNo: 'DEMO-NP-0006', subDivision: 'Goalpara Electrical Sub-Division', duplicate: false, reverification: false, referredBy: 'demo-a1k9', referralCount: 0, rewards: [] },
    { id: 'demo-g7s3', code: 'demo-g7s3', consumerNo: '040000100007', name: 'Sunita Devi', mobile: '9876123450', address: 'Kalpanagar, Goalpara', area: 'Goalpara', installDate: '', submittedOn: '2025-12-12', systemKw: 2, status: 'Subsidy Request (Return)', applicationNo: 'DEMO-NP-0007', subDivision: 'Goalpara Electrical Sub-Division', duplicate: false, reverification: true, referredBy: 'demo-a1k9', referralCount: 0, rewards: [] },
    { id: 'demo-h8t2', code: 'demo-h8t2', consumerNo: '040000100008', name: 'Abdul Karim', mobile: '8765987654', address: 'Bhalukdubi, Goalpara', area: 'Goalpara', installDate: '2026-01-10', submittedOn: '2025-11-20', systemKw: 4, status: 'Subsidy Disbursal (Disbursed)', applicationNo: 'DEMO-NP-0008', subDivision: 'Goalpara Electrical Sub-Division', duplicate: true, reverification: false, referredBy: null, referralCount: 1, rewards: [] }
  ];
}
function defaultMeta() {
  return {
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
    templates: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES))
  };
}

/* ---- local storage helpers (guarded for Node tests) ---- */
var store = {
  load: function (key) {
    try {
      if (typeof localStorage === 'undefined') return null;
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },
  save: function (key, val) {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
};

/* ---- in-memory working state ---- */
var meta = store.load(LS_KEY) || defaultMeta();
var customers = [];          // current list (sample preview OR Firestore)
var mode = 'sample';         // 'sample' | 'firestore'
var authed = false;
var firebaseReady = false;
var db = null, auth = null;

function saveMeta() { store.save(LS_KEY, meta); }

/* ---- pure helpers ---- */
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fmtINR(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }
function inr(n) { return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || 'Friend'; }
var AS_DIGITS = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
function asDigits(s) { return String(s).replace(/[0-9]/g, function (d) { return AS_DIGITS[d]; }); }
function monthsBetween(fromISO, toDate) {
  if (!fromISO) return 0;
  var from = new Date(fromISO + 'T00:00:00');
  var to = toDate || new Date();
  if (isNaN(from.getTime())) return 0;
  var m = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) m -= 1;
  return Math.max(0, m);
}
function monthsText(n, lang) {
  if (lang === 'as') return asDigits(n) + ' মাহ';
  return n === 1 ? '1 month' : n + ' months';
}
function parseDMY(s) {
  if (!s) return '';
  s = String(s).trim();
  var m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/);
  if (m) {
    var yy = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
    return yy + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s;
}
function fmtDate(iso) {
  if (!iso) return '—';
  var d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function newCode() { return Math.random().toString(36).slice(2, 10); }
function customerById(id) { return customers.find(function (c) { return c.id === id; }) || null; }
function customerByCode(code) { return customers.find(function (c) { return c.code === code; }) || null; }
function referralCount(id) { return customers.filter(function (c) { return c.referredBy === id; }).length; }
function referredList(id) { return customers.filter(function (c) { return c.referredBy === id; }); }
function tierReached(c) {
  var n = referralCount(c.id);
  if (n >= 3) return 3;
  if (n >= 2) return 2;
  if (n >= 1) return 1;
  return 0;
}
function recordedTierReward(c, tier) {
  return (c.rewards || []).some(function (r) { return r.tier === tier; });
}
function rewardDue(c) {
  var t = tierReached(c);
  return t > 0 && !recordedTierReward(c, t);
}
function rewardLink(c) {
  if (typeof location !== 'undefined' && location.href) {
    var base = location.href.split('?')[0].split('#')[0];
    return base + '?c=' + c.code;
  }
  return '?c=' + c.code;
}
function fillTemplate(text, c, lang) {
  var baseDate = c.installDate || c.submittedOn;
  var m = monthsBetween(baseDate);
  return text
    .replace(/\{name\}/g, firstName(c.name))
    .replace(/\{months\}/g, monthsText(m, lang))
    .replace(/\{count\}/g, String(referralCount(c.id)))
    .replace(/\{kw\}/g, String(c.systemKw == null ? '' : c.systemKw))
    .replace(/\{link\}/g, rewardLink(c));
}
function buildMessage(key, c) {
  var t = (meta.templates && meta.templates[key]) || DEFAULT_TEMPLATES[key];
  return { en: fillTemplate(t.en, c, 'en'), as: fillTemplate(t.as, c, 'as'),
    combined: fillTemplate(t.en, c, 'en') + '\n\n' + fillTemplate(t.as, c, 'as') };
}
function buildReminder(c) {
  var key = REMINDER_BY_STAGE[c.status];
  if (!key) return null;
  return buildMessage(key, c);
}
function waLink(c, msg) {
  var mob = String(c.mobile || '').replace(/\D/g, '');
  if (mob.length === 10) mob = '91' + mob;
  return 'https://wa.me/' + mob + '?text=' + encodeURIComponent(msg);
}
/* SMS link — platform-aware: Android uses ?body=, iOS uses &body=.
   The number is always in +91 international format, the message is encoded.
   A website cannot send an SMS by itself — this link opens the phone's SMS
   app with the number and message already filled in; the vendor taps send. */
function smsLink(c, msg) {
  var mob = String(c.mobile || '').replace(/\D/g, '');
  if (mob.length === 10) mob = '91' + mob;
  var ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
  var sep = /iPhone|iPad|iPod/i.test(ua) ? '&' : '?';
  return 'sms:+' + mob + sep + 'body=' + encodeURIComponent(msg);
}
/* Fire an SMS link with a real anchor click — more reliable on mobile
   browsers than assigning location.href. */
function openSms(c, msg) {
  var a = document.createElement('a');
  a.href = smsLink(c, msg);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
function computeQuote(q) {
  var panel = +q.panel || 0, inverter = +q.inverter || 0, structure = +q.structure || 0,
      install = +q.installation || 0, other = +q.other || 0;
  var subtotal = panel + inverter + structure + install + other;
  var gstPct = +q.gstPct || 0;
  var gst = Math.round(subtotal * gstPct / 100);
  var total = subtotal + gst;
  var subsidy = subsidyFor(+q.kw || 0);
  var net = total - subsidy;
  return { panel: panel, inverter: inverter, structure: structure, installation: install, other: other, subtotal: subtotal, gstPct: gstPct, gst: gst, total: total, subsidy: subsidy, net: net };
}
function quoteText(q, calc, customerName) {
  var s = meta.settings;
  return [
    s.businessName + ' (' + s.businessShort + ')', s.address,
    'Solar Quotation' + (customerName ? ' — ' + customerName : ''),
    'System: ' + q.kw + ' kW',
    'Panels: ' + inr(calc.panel), 'Inverter: ' + inr(calc.inverter),
    'Structure: ' + inr(calc.structure), 'Installation: ' + inr(calc.installation),
    'Other: ' + inr(calc.other), 'Subtotal: ' + inr(calc.subtotal),
    'GST (' + calc.gstPct + '%): ' + inr(calc.gst), 'Total: ' + inr(calc.total),
    'PM Surya Ghar subsidy: -' + inr(calc.subsidy), 'Net payable: ' + inr(calc.net),
    'Valid for 15 days.'
  ].join('\n');
}

/* ---- CSV: parse a line with quoted fields ---- */
function parseCSVLine(line) {
  var out = [], cur = '', inQ = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQ = false; }
      } else { cur += ch; }
    } else if (ch === '"') { inQ = true; }
    else if (ch === ',') { out.push(cur); cur = ''; }
    else { cur += ch; }
  }
  out.push(cur);
  return out;
}
function normHeader(h) { return String(h || '').trim().toLowerCase().replace(/\s+/g, ' '); }

/* Parse a customer CSV. Accepts the PM Surya Ghar portal export columns exactly,
   or the simple columns (consumer number, name, mobile, address, install date,
   system kw, referred by). Returns { rows, imported, skipped, errors, isPortal }. */
function parseCustomerCSV(text) {
  var lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(function (l) { return l.trim() !== ''; });
  if (lines.length < 2) return { rows: [], imported: 0, skipped: 0, errors: ['File has no data rows.'], isPortal: false };
  var headers = parseCSVLine(lines[0]).map(normHeader);
  function col() {
    for (var i = 0; i < arguments.length; i++) {
      var idx = headers.indexOf(arguments[i]);
      if (idx >= 0) return idx;
    }
    return -1;
  }
  var isPortal = col('application number') >= 0 || col('submitted on') >= 0;
  var idx = {
    appNo: col('application number'),
    subDiv: col('sub division name'),
    consumerNo: col('consumer number'),
    name: col('consumer name', 'name'),
    mobile: col('mobile no.', 'mobile', 'mobile number'),
    kw: col('proposed capacity (kwp)', 'system kw', 'capacity (kw)', 'kw'),
    status: col('status', 'stage'),
    submittedOn: col('submitted on', 'application date'),
    reverif: col('reverification'),
    dup: col('duplicate sr. no.', 'duplicate'),
    address: col('address'),
    installDate: col('install date', 'installation date'),
    referredBy: col('referred by', 'referrer')
  };
  var rows = [], skipped = 0, errors = [];
  var seen = {};
  for (var r = 1; r < lines.length; r++) {
    var vals = parseCSVLine(lines[r]);
    function v(i) { return i >= 0 && i < vals.length ? String(vals[i]).trim() : ''; }
    var consumerNo = v(idx.consumerNo);
    var mobile = v(idx.mobile).replace(/\D/g, '').slice(-10);
    var name = v(idx.name);
    if (!consumerNo || !name || !mobile) { skipped++; continue; }
    if (seen[consumerNo]) { skipped++; continue; }
    seen[consumerNo] = true;
    var kw = parseFloat(v(idx.kw)) || 0;
    var status = v(idx.status) || 'Upload Agreement (Pending)';
    var subDiv = v(idx.subDiv);
    var area = subDiv ? subDiv.replace(/ electrical sub-division/i, '').trim() : (v(idx.address).split(',').pop() || '').trim();
    rows.push({
      consumerNo: consumerNo, name: name, mobile: mobile,
      address: v(idx.address),
      area: area || 'Goalpara',
      installDate: parseDMY(v(idx.installDate)),
      submittedOn: parseDMY(v(idx.submittedOn)),
      systemKw: kw, status: status,
      applicationNo: v(idx.appNo),
      subDivision: subDiv,
      duplicate: /^y(es)?$/i.test(v(idx.dup)),
      reverification: /^y(es)?$/i.test(v(idx.reverif)),
      referredByConsumerNo: v(idx.referredBy) || null
    });
  }
  return { rows: rows, imported: rows.length, skipped: skipped, errors: errors, isPortal: isPortal };
}
function csvEscape(v) {
  v = String(v == null ? '' : v);
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function exportCustomersCSV(list) {
  var head = ['Application Number', 'Sub Division Name', 'Consumer Number', 'Consumer Name', 'Mobile No.', 'Proposed Capacity (kWp)', 'Status', 'Submitted On', 'Reverification', 'Duplicate Sr. No.', 'Address', 'Install Date', 'Referred By (Consumer No.)'];
  var lines = [head.join(',')];
  list.forEach(function (c) {
    var ref = c.referredBy ? (customerById(c.referredBy) || {}).consumerNo || '' : '';
    lines.push([
      c.applicationNo, c.subDivision, c.consumerNo, c.name, c.mobile, c.systemKw, c.status,
      c.submittedOn, c.reverification ? 'Yes' : 'No', c.duplicate ? 'Yes' : 'No',
      c.address, c.installDate, ref
    ].map(csvEscape).join(','));
  });
  return lines.join('\n');
}

/* ---- dashboard aggregates (computed, never invented) ---- */
function dashboardStats(list) {
  var now = new Date();
  var ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  var totalKw = list.reduce(function (a, c) { return a + (+c.systemKw || 0); }, 0);
  var appsThisMonth = list.filter(function (c) { return (c.submittedOn || '').slice(0, 7) === ym; }).length;
  var referralsTotal = list.filter(function (c) { return !!c.referredBy; }).length;
  var due = list.filter(rewardDue).length;
  var stageCounts = {};
  STAGES.forEach(function (s) { stageCounts[s] = 0; });
  var other = 0;
  list.forEach(function (c) {
    if (stageCounts.hasOwnProperty(c.status)) stageCounts[c.status]++;
    else other++;
  });
  var perMonth = {};
  list.forEach(function (c) {
    var key = (c.submittedOn || '').slice(0, 7);
    if (key) perMonth[key] = (perMonth[key] || 0) + 1;
  });
  var needsAction = {};
  Object.keys(NEEDS_ACTION).forEach(function (st) {
    needsAction[st] = list.filter(function (c) { return c.status === st; });
  });
  var doneCount = list.filter(function (c) { return c.status === DONE_STAGE; }).length;
  return { total: list.length, appsThisMonth: appsThisMonth, totalKw: totalKw, referralsTotal: referralsTotal, rewardsDue: due, stageCounts: stageCounts, otherStages: other, perMonth: perMonth, needsAction: needsAction, doneCount: doneCount };
}
function sortCustomers(list, sortKey) {
  var arr = list.slice();
  function dateVal(c, field) { return c[field] || '9999-99-99'; }
  if (sortKey === 'submitted-desc') arr.sort(function (a, b) { return dateVal(b, 'submittedOn').localeCompare(dateVal(a, 'submittedOn')); });
  else if (sortKey === 'submitted-asc') arr.sort(function (a, b) { return dateVal(a, 'submittedOn').localeCompare(dateVal(b, 'submittedOn')); });
  else if (sortKey === 'installed-desc') arr.sort(function (a, b) { return dateVal(b, 'installDate').localeCompare(dateVal(a, 'installDate')); });
  else if (sortKey === 'installed-asc') arr.sort(function (a, b) { return dateVal(a, 'installDate').localeCompare(dateVal(b, 'installDate')); });
  else if (sortKey === 'name') arr.sort(function (a, b) { return a.name.localeCompare(b.name); });
  return arr;
}
function filterCustomers(list, f) {
  var q = (f.q || '').toLowerCase();
  return list.filter(function (c) {
    if (f.status && c.status !== f.status) return false;
    if (f.subDiv && c.subDivision !== f.subDiv) return false;
    if (f.kw && String(c.systemKw) !== String(f.kw)) return false;
    if (q && (c.name + ' ' + c.consumerNo + ' ' + c.mobile + ' ' + (c.address || '')).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}

/* ---- Firestore mapping: doc id = the reward-link code ---- */
function toFirestore(c) {
  return {
    consumerNo: c.consumerNo || '', name: c.name || '', mobile: c.mobile || '',
    address: c.address || '', area: c.area || '', installDate: c.installDate || '',
    submittedOn: c.submittedOn || '', systemKw: +c.systemKw || 0, status: c.status || 'Upload Agreement (Pending)',
    applicationNo: c.applicationNo || '', subDivision: c.subDivision || '',
    duplicate: !!c.duplicate, reverification: !!c.reverification,
    referredBy: c.referredBy || null, referralCount: +c.referralCount || 0,
    rewards: c.rewards || []
  };
}
function fromFirestore(doc) {
  var d = doc.data();
  return {
    id: doc.id, code: doc.id,
    consumerNo: d.consumerNo || '', name: d.name || '', mobile: d.mobile || '',
    address: d.address || '', area: d.area || '', installDate: d.installDate || '',
    submittedOn: d.submittedOn || '', systemKw: +d.systemKw || 0,
    status: d.status || 'Upload Agreement (Pending)',
    applicationNo: d.applicationNo || '', subDivision: d.subDivision || '',
    duplicate: !!d.duplicate, reverification: !!d.reverification,
    referredBy: d.referredBy || null, referralCount: +d.referralCount || 0,
    rewards: d.rewards || []
  };
}
function computeReferralCounts(list) {
  var counts = {};
  list.forEach(function (c) { if (c.referredBy) counts[c.referredBy] = (counts[c.referredBy] || 0) + 1; });
  return counts;
}

/* ===================== Data layer ===================== */
/* SampleDB: logged-out preview only. FirestoreDB: the real backend. */
var SampleDB = {
  mode: 'sample',
  listCustomers: function () { return Promise.resolve(demoCustomers()); },
  getCustomerByCode: function (code) {
    var c = demoCustomers().find(function (x) { return x.code === code; });
    return Promise.resolve(c || null);
  },
  saveCustomer: function (c) {
    var list = store.load(SAMPLE_LS_KEY) || demoCustomers();
    var i = list.findIndex(function (x) { return x.id === c.id; });
    if (i >= 0) list[i] = c; else list.push(c);
    store.save(SAMPLE_LS_KEY, list);
    return Promise.resolve(c);
  },
  importRows: function (parsed) {
    var list = store.load(SAMPLE_LS_KEY) || demoCustomers();
    var byConsumer = {};
    list.forEach(function (x) { byConsumer[x.consumerNo] = x; });
    var added = 0, updated = 0;
    parsed.rows.forEach(function (row) {
      var ex = byConsumer[row.consumerNo];
      if (ex) {
        ['applicationNo', 'subDivision', 'systemKw', 'status', 'submittedOn', 'duplicate', 'reverification', 'area'].forEach(function (f) {
          if (row[f] !== '' && row[f] !== undefined && row[f] !== null) ex[f] = row[f];
        });
        if (row.address) ex.address = row.address;
        if (row.installDate) ex.installDate = row.installDate;
        updated++;
      } else {
        var c = { id: 'smp-' + newCode(), code: newCode(), consumerNo: row.consumerNo, name: row.name, mobile: row.mobile, address: row.address || '', area: row.area || 'Goalpara', installDate: row.installDate || '', submittedOn: row.submittedOn || '', systemKw: row.systemKw || 0, status: row.status || 'Upload Agreement (Pending)', applicationNo: row.applicationNo || '', subDivision: row.subDivision || '', duplicate: !!row.duplicate, reverification: !!row.reverification, referredBy: null, referralCount: 0, rewards: [] };
        list.push(c); byConsumer[c.consumerNo] = c; added++;
      }
    });
    parsed.rows.forEach(function (row) {
      if (!row.referredByConsumerNo) return;
      var t = byConsumer[row.consumerNo], r = byConsumer[row.referredByConsumerNo];
      if (t && r && t.id !== r.id) t.referredBy = r.id;
    });
    store.save(SAMPLE_LS_KEY, list);
    return Promise.resolve({ added: added, updated: updated });
  },
  loadMeta: function () { return Promise.resolve(store.load(LS_KEY) || defaultMeta()); },
  saveMeta: function (m) { store.save(LS_KEY, m); return Promise.resolve(); }
};

var FirestoreDB = {
  mode: 'firestore',
  col: function () { return db.collection('customers'); },
  listCustomers: function () {
    return db.collection('customers').get().then(function (snap) {
      var list = [];
      snap.forEach(function (doc) { list.push(fromFirestore(doc)); });
      return list;
    });
  },
  getCustomerByCode: function (code) {
    return db.collection('customers').doc(code).get().then(function (doc) {
      return doc.exists ? fromFirestore(doc) : null;
    });
  },
  saveCustomer: function (c) {
    if (!c.id || c.id.indexOf('demo-') === 0 || c.id.indexOf('smp-') === 0) { c.id = newCode(); c.code = c.id; }
    return db.collection('customers').doc(c.id).set(toFirestore(c), { merge: true }).then(function () { return c; });
  },
  importRows: function (parsed) {
    var self = this;
    return self.listCustomers().then(function (existing) {
      var byConsumer = {};
      existing.forEach(function (x) { byConsumer[x.consumerNo] = x; });
      var batch = db.batch();
      var ops = 0, added = 0, updated = 0;
      var writes = [];
      function flush() {
        if (ops === 0) return Promise.resolve();
        var b = batch; batch = db.batch(); ops = 0;
        writes.push(b.commit());
        return Promise.resolve();
      }
      var chain = Promise.resolve();
      parsed.rows.forEach(function (row) {
        chain = chain.then(function () {
          var ex = byConsumer[row.consumerNo];
          if (ex) {
            var upd = {};
            ['applicationNo', 'subDivision', 'systemKw', 'status', 'submittedOn', 'duplicate', 'reverification', 'area'].forEach(function (f) {
              if (row[f] !== '' && row[f] !== undefined && row[f] !== null) upd[f] = row[f];
            });
            if (row.address) upd.address = row.address;
            if (row.installDate) upd.installDate = row.installDate;
            batch.update(db.collection('customers').doc(ex.id), upd);
            ops++; updated++;
          } else {
            var id = newCode();
            var c = { id: id, code: id, consumerNo: row.consumerNo, name: row.name, mobile: row.mobile, address: row.address || '', area: row.area || 'Goalpara', installDate: row.installDate || '', submittedOn: row.submittedOn || '', systemKw: row.systemKw || 0, status: row.status || 'Upload Agreement (Pending)', applicationNo: row.applicationNo || '', subDivision: row.subDivision || '', duplicate: !!row.duplicate, reverification: !!row.reverification, referredBy: null, referralCount: 0, rewards: [] };
            batch.set(db.collection('customers').doc(id), toFirestore(c));
            byConsumer[row.consumerNo] = c;
            ops++; added++;
          }
          if (ops >= 400) return flush();
          return Promise.resolve();
        });
      });
      return chain.then(flush).then(function () { return Promise.all(writes); }).then(function () {
        /* resolve "referred by" consumer numbers, then refresh referral counts */
        return self.listCustomers();
      }).then(function (list) {
        var byC = {};
        list.forEach(function (x) { byC[x.consumerNo] = x; });
        var b2 = db.batch(); var n = 0;
        parsed.rows.forEach(function (row) {
          if (!row.referredByConsumerNo) return;
          var t = byC[row.consumerNo], r = byC[row.referredByConsumerNo];
          if (t && r && t.id !== r.id && t.referredBy !== r.id) {
            b2.update(db.collection('customers').doc(t.id), { referredBy: r.id }); n++;
          }
        });
        var counts = computeReferralCounts(list);
        list.forEach(function (x) {
          var want = counts[x.id] || 0;
          if ((x.referralCount || 0) !== want) { b2.update(db.collection('customers').doc(x.id), { referralCount: want }); n++; }
        });
        return n ? b2.commit() : Promise.resolve();
      }).then(function () { return { added: added, updated: updated }; });
    });
  },
  loadMeta: function () {
    return db.collection('meta').doc('settings').get().then(function (doc) {
      if (!doc.exists) return defaultMeta();
      var d = doc.data();
      return { settings: Object.assign({}, DEFAULT_SETTINGS, d.settings || {}), templates: Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)), d.templates || {}) };
    });
  },
  saveMeta: function (m) {
    return db.collection('meta').doc('settings').set({ settings: m.settings, templates: m.templates }, { merge: true });
  }
};

var activeDB = SampleDB;
function refreshCustomers() {
  return activeDB.listCustomers().then(function (list) {
    customers = list;
    return list;
  });
}
function refreshMeta() {
  return activeDB.loadMeta().then(function (m) { meta = m; return m; });
}

/* ===================== UI (browser only) ===================== */
if (typeof document !== 'undefined') {
  var view = null, tabs = null;
  var NAV = [
    ['#messages', '💬 Messages'], ['#reminders', '⏰ Reminders'], ['#dashboard', '📊 Dashboard'],
    ['#customers', '👥 Customers'], ['#quote', '🧾 Make a quote'],
    ['#rewards', '🎁 Rewards'], ['#settings', '⚙️ Settings']
  ];
  var listState = { q: '', status: '', subDiv: '', kw: '', sort: 'submitted-desc' };
  var msgKey = 'puja';
  /* Messages tab state: which template, which customer, search, disbursed-only filter. */
  var msgCustomerId = null;
  var msgSearch = '';
  var msgOnlyDisbursed = false;
  var quoteState = { name: '', kw: 3, panel: 150000, inverter: 45000, structure: 25000, installation: 15000, other: 5000, gstPct: null, calc: null };

  function publicCode() {
    try { return new URLSearchParams(location.search).get('c') || ''; } catch (e) { return ''; }
  }
  function sampleBanner() {
    return '<div class="notice"><b>SAMPLE PREVIEW</b> — these are sample customers, not real ones. Log in as the vendor to see the real customer list. Real customer data is never on this public site.</div>';
  }
  function noBackendNote() {
    return firebaseReady ? '' : '<div class="notice"><b>Backend not connected yet.</b> The Firebase project is being set up — this page is running on sample data until the login is wired in.</div>';
  }
  /* Bumper-offer banner — bright, editable in Settings. Shown on the
     Dashboard and the Messages tab. Clear the title + text in Settings
     to hide it. The default text states only the real PM Surya Ghar
     subsidy slabs — the vendor replaces it with his real offer. */
  function offerBannerHTML() {
    var o = meta.settings;
    if (!o.offerTitle && !o.offerText) return '';
    var valid = o.offerValidTill ? ' · Valid till ' + esc(fmtDate(o.offerValidTill)) : '';
    return '<div class="offer-banner"><div class="offer-title">' + esc(o.offerTitle) + '</div>' +
      '<div class="offer-text">' + esc(o.offerText) + valid + '</div></div>';
  }
  /* Honest hint under every SMS button: a website cannot send an SMS
     by itself — the phone's SMS app does the sending. */
  function smsHint() {
    return '<p class="sub sms-hint">📱 Opens your phone\u2019s SMS app with the number and message already filled in — just tap send.</p>';
  }
  function renderTabs(active) {
    tabs.innerHTML = NAV.map(function (n) {
      return '<a href="' + n[0] + '" class="' + (active === n[0] ? 'active' : '') + '">' + n[1] + '</a>';
    }).join('') + '<a href="#logout" style="margin-left:auto">Log out (' + esc((auth && auth.currentUser && auth.currentUser.email) || 'vendor') + ')</a>';
    tabs.style.display = 'flex';
  }
  function route() {
    var code = publicCode();
    if (code) { tabs.style.display = 'none'; renderPublic(code); return; }
    if (!authed) { tabs.style.display = 'none'; renderLoggedOut(); return; }
    var h = location.hash || '#messages';
    if (h === '#logout') { doLogout(); return; }
    if (h.indexOf('#customer-') === 0) { renderTabs('#customers'); renderCustomer(h.slice('#customer-'.length)); return; }
    renderTabs(h.split('?')[0]);
    if (h === '#messages') renderMessages();
    else if (h === '#reminders') renderReminders();
    else if (h === '#customers') renderCustomers();
    else if (h === '#quote') renderQuote();
    else if (h === '#rewards') renderRewards();
    else if (h === '#settings') renderSettings();
    else renderDashboard();
  }
  function doLogin(email, pass) {
    if (!firebaseReady) { alert('Backend not connected yet — the Firebase login is being set up.'); return; }
    auth.signInWithEmailAndPassword(email, pass).catch(function (err) {
      var el = document.getElementById('login-error');
      if (el) el.textContent = 'Login failed: ' + (err && err.message ? err.message : 'check email and password.');
    });
  }
  function doLogout() {
    if (auth) { auth.signOut(); } else { authed = false; mode = 'sample'; activeDB = SampleDB; route(); }
  }
  window.demoLoginSubmit = function (ev) {
    if (ev) ev.preventDefault();
    var email = document.getElementById('login-email').value.trim();
    var pass = document.getElementById('login-pass').value;
    doLogin(email, pass);
  };

  function renderLoggedOut() {
    customers = demoCustomers();
    view.innerHTML =
      '<div class="login-wrap"><div class="card">' +
      '<h2 style="margin-top:0">Vendor login</h2>' +
      '<p class="sub">SH Enterprise (Green Energy) · Kalpanagar, Goalpara</p>' +
      (firebaseReady
        ? '<form onsubmit="demoLoginSubmit(event)"><label style="text-align:left">Email</label><input id="login-email" type="email" required placeholder="vendor email"><label style="text-align:left">Password</label><input id="login-pass" type="password" required placeholder="password"><p id="login-error" style="color:#b91c1c"></p><button type="submit" style="width:100%;padding:13px">Log in</button></form>'
        : '<p>' + noBackendNote() + '</p>') +
      '<p class="sub" style="margin-top:14px">Real customer data lives in Firebase behind this login. Photos and documents will live on Google Drive.</p>' +
      '</div></div>' +
      '<h2>Sample preview</h2>' + sampleBanner() +
      '<div id="sample-cards"></div>';
    renderCustomerCards(demoCustomers(), document.getElementById('sample-cards'), true);
  }

  function cardHTML(c) {
    var rc = referralCount(c.id);
    return '<div class="cust-card" onclick="location.hash=\'#customer-' + c.id + '\'">' +
      '<div class="cust-name">' + esc(c.name) + '</div>' +
      '<div class="cust-sub">' + esc(c.consumerNo) + ' · ' + esc(c.area) + '</div>' +
      '<div class="cust-row"><span class="pill">' + esc(stageEmoji(c.status)) + ' ' + esc(c.status) + '</span><span class="pill info">⚡ ' + esc(c.systemKw) + ' kW</span></div>' +
      '<div class="cust-row"><span>Applied ' + esc(fmtDate(c.submittedOn)) + '</span>' +
      (c.installDate ? '<span>Installed ' + esc(fmtDate(c.installDate)) + '</span>' : '<span style="color:var(--muted)">Not installed yet</span>') + '</div>' +
      (rc ? '<div class="cust-row"><span class="pill ok">' + rc + ' referral' + (rc > 1 ? 's' : '') + '</span>' + (rewardDue(c) ? '<span class="pill due">Reward due</span>' : '') + '</div>' : '') +
      ((c.duplicate || c.reverification) ? '<div class="cust-row">' + (c.duplicate ? '<span class="pill due">Duplicate</span>' : '') + (c.reverification ? '<span class="pill due">Reverification</span>' : '') + '</div>' : '') +
      '</div>';
  }
  function renderCustomerCards(list, container, isSample) {
    if (!list.length) { container.innerHTML = '<p class="sub">No customers match.</p>'; return; }
    container.innerHTML = '<div class="cards">' + list.map(cardHTML).join('') + '</div>';
  }

  function renderDashboard() {
    var s = dashboardStats(customers);
    var months = Object.keys(s.perMonth).sort().slice(-6);
    var max = Math.max.apply(null, months.map(function (m) { return s.perMonth[m]; }).concat([1]));
    var bars = months.map(function (m) {
      var d = new Date(m + '-01T00:00:00');
      var label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      var w = Math.round(s.perMonth[m] / max * 100);
      return '<div class="bar-row"><span class="mon">' + label + '</span><div class="bar" style="width:' + w + '%"></div><span class="cnt">' + s.perMonth[m] + '</span></div>';
    }).join('');
    var stageRows = STAGES.map(function (st) {
      return '<div class="bar-row"><span class="mon" style="width:230px">' + esc(st) + '</span><span class="cnt">' + s.stageCounts[st] + '</span></div>';
    }).join('') + (s.otherStages ? '<div class="bar-row"><span class="mon" style="width:230px">Other</span><span class="cnt">' + s.otherStages + '</span></div>' : '');
    var stuckTotal = Object.keys(NEEDS_ACTION).reduce(function (a, st) { return a + s.needsAction[st].length; }, 0);
    var stuckLine = stuckTotal === 0 ? 'Nothing stuck — every application is moving. 🎉'
      : stuckTotal === 1 ? '1 customer needs a reminder'
      : stuckTotal + ' customers need a reminder';
    var set = meta.settings;
    view.innerHTML =
      '<div class="hero"><div class="hero-name">☀️ ' + esc(set.businessName) + ' <span>· ' + esc(set.businessShort) + '</span></div>' +
      '<div class="hero-tag">🌞 Rooftop solar, made simple — PM Surya Ghar</div>' +
      '<div class="hero-sub">' + esc(set.address) + '</div></div>' +
      offerBannerHTML() +
      (mode === 'sample' ? sampleBanner() : '') +
      '<div class="stats">' +
      '<div class="stat"><div class="num">' + s.total + '</div><div class="lbl">👥 Total customers</div></div>' +
      '<div class="stat"><div class="num">' + s.appsThisMonth + '</div><div class="lbl">📅 Applications this month</div></div>' +
      '<div class="stat"><div class="num">' + s.totalKw + '</div><div class="lbl">⚡ Total kW proposed</div></div>' +
      '<div class="stat"><div class="num">' + s.referralsTotal + '</div><div class="lbl">🤝 Referred customers</div></div>' +
      '<div class="stat warn"><div class="num">' + s.rewardsDue + '</div><div class="lbl">🎁 Rewards due</div></div>' +
      '<div class="stat"><div class="num">' + s.doneCount + '</div><div class="lbl">✅ Subsidy disbursed (done)</div></div>' +
      '</div>' +
      '<div class="card reminder-summary"><p style="margin:0">⏰ <b>' + esc(stuckLine) + '</b> — subsidy stuck, installation or inspection pending. <a href="#reminders">Open Reminders →</a></p></div>' +
      '<div class="card"><p><b>' + s.doneCount + ' customers have their subsidy disbursed</b> — these are the ones to message for referrals and festival offers. <a href="#customers" onclick="listState.status=\'' + DONE_STAGE + '\'">See them →</a></p></div>' +
      '<div class="card"><h3 style="margin-top:0">Pipeline — portal stages</h3>' + stageRows + '</div>' +
      '<div class="card"><h3 style="margin-top:0">Applications per month</h3>' + (bars || '<p class="sub">No application dates yet.</p>') + '</div>';
  }
  window.remindCustomer = function (id, btn) {
    var c = customerById(id);
    if (!c) return;
    var msg = buildReminder(c);
    if (!msg) return;
    var old = btn ? btn.textContent : '';
    if (btn) { btn.textContent = 'Opening WhatsApp…'; }
    window.open(waLink(c, msg.combined), '_blank');
    setTimeout(function () { if (btn) btn.textContent = old; }, 2000);
  };
  window.remindSms = function (id, btn) {
    var c = customerById(id);
    if (!c) return;
    var msg = buildReminder(c);
    if (!msg) return;
    var old = btn ? btn.textContent : '';
    if (btn) { btn.textContent = 'Opening SMS…'; }
    openSms(c, msg.combined);
    setTimeout(function () { if (btn) btn.textContent = old; }, 2000);
  };

  /* ---- Messages tab: pick template → pick customer → tap send ---- */
  function previewCustomer() {
    return { id: '__preview', code: '__preview', name: 'Ramesh', mobile: '', systemKw: 3,
      installDate: '2026-01-01', submittedOn: '2026-01-01', referredBy: null, referralCount: 0, rewards: [] };
  }
  window.sendMsg = function (kind, btn) {
    var c = msgCustomerId ? customerById(msgCustomerId) : null;
    if (!c) { alert('Pick a customer first — tap a name below.'); return; }
    var msg = buildMessage(msgKey, c).combined;
    if (kind === 'wa') window.open(waLink(c, msg), '_blank');
    else if (kind === 'sms') openSms(c, msg);
    else copyText(msg, btn);
  };
  function renderMessages() {
    var c = msgCustomerId ? customerById(msgCustomerId) : null;
    var q = msgSearch.toLowerCase();
    var pool = customers.filter(function (x) { return !msgOnlyDisbursed || x.status === DONE_STAGE; });
    var matches = pool.filter(function (x) {
      return !q || (x.name + ' ' + x.consumerNo + ' ' + x.mobile).toLowerCase().indexOf(q) >= 0;
    }).slice(0, 8);
    var tplOptions = Object.keys(TEMPLATE_NAMES).map(function (k) {
      return '<option value="' + k + '"' + (msgKey === k ? ' selected' : '') + '>' + TEMPLATE_NAMES[k] + '</option>';
    }).join('');
    var pickRows = matches.map(function (x) {
      return '<div class="pick-row" onclick="msgCustomerId=\'' + x.id + '\';renderMessages()"><div><b>' + esc(x.name) + '</b> · ' + esc(x.consumerNo) + '<br><span style="color:var(--muted);font-size:12.5px">' + esc(stageEmoji(x.status)) + ' ' + esc(x.status) + ' · ' + esc(x.systemKw) + ' kW</span></div><span style="font-size:22px;color:var(--muted)">›</span></div>';
    }).join('');
    var msg = buildMessage(msgKey, c || previewCustomer());
    view.innerHTML =
      '<h2>💬 Messages</h2><p class="sub">Pick a template, pick a customer, tap send. English + Assamese in one message — name, months, referrals and reward link fill in by themselves.</p>' +
      offerBannerHTML() +
      (mode === 'sample' ? sampleBanner() : '') +
      '<div class="card"><h3 style="margin-top:0">1 · Choose a message 💬</h3>' +
      '<select id="msgTpl2" onchange="msgKey=this.value;renderMessages()">' + tplOptions + '</select></div>' +
      '<div class="card"><h3 style="margin-top:0">2 · Choose a customer 👥</h3>' +
      (c ? '<p style="margin:0 0 10px">✅ <b>' + esc(c.name) + '</b> · ' + esc(c.consumerNo) + ' · ' + esc(c.systemKw) + ' kW · ' + esc(c.status) + ' <a href="#" onclick="msgCustomerId=null;renderMessages();return false;">Change</a></p>'
        : '<div class="btnrow" style="margin:0 0 10px"><button class="' + (msgOnlyDisbursed ? 'secondary' : '') + '" onclick="msgOnlyDisbursed=false;renderMessages()">All customers</button>' +
          '<button class="' + (msgOnlyDisbursed ? '' : 'secondary') + '" onclick="msgOnlyDisbursed=true;renderMessages()">✅ Disbursed only</button></div>' +
          '<input id="mq" placeholder="Search name, consumer no., mobile…" value="' + esc(msgSearch) + '" oninput="msgSearch=this.value;renderMessages()">' +
          '<div style="margin-top:6px">' + (pickRows || '<p class="sub">No customers match.</p>') + '</div>' +
          '<p class="sub" style="margin-top:8px">💡 Tip: switch to “Disbursed only” to message your happy customers one by one for referrals.</p>') +
      '</div>' +
      '<div class="card"><h3 style="margin-top:0">3 · Preview &amp; send ' + (c ? 'to ' + esc(firstName(c.name)) : '(sample preview — pick a customer to fill in their details)') + '</h3>' +
      '<div class="msgbox">' + esc(msg.combined) + '</div>' +
      '<div class="btnrow big">' +
      '<button class="whatsapp" onclick="sendMsg(\'wa\', this)">💬 WhatsApp</button>' +
      '<button class="sms" onclick="sendMsg(\'sms\', this)">✉️ SMS</button>' +
      '<button class="secondary" onclick="sendMsg(\'copy\', this)">📋 Copy message</button>' +
      '</div>' + smsHint() + '</div>';
    var mq = document.getElementById('mq');
    if (mq) { mq.focus(); mq.setSelectionRange(mq.value.length, mq.value.length); }
  }

  /* ---- Reminders tab: the stuck stages, with a Remind button each ---- */
  function renderReminders() {
    var s = dashboardStats(customers);
    var total = Object.keys(NEEDS_ACTION).reduce(function (a, st) { return a + s.needsAction[st].length; }, 0);
    var blocks = Object.keys(NEEDS_ACTION).map(function (st) {
      var list = s.needsAction[st];
      if (!list.length) return '';
      var rows = list.map(function (c) {
        return '<div class="need-row"><div><b>' + esc(c.name) + '</b> · ' + esc(c.consumerNo) + ' · ' + esc(c.systemKw) + ' kW<br><span style="color:var(--muted);font-size:12.5px">' + esc(NEEDS_ACTION[st]) + ' Applied ' + esc(fmtDate(c.submittedOn)) + '.</span></div>' +
          '<div class="btnrow remind-btns"><button class="whatsapp" onclick="remindCustomer(\'' + c.id + '\', this)">WhatsApp</button>' +
          '<button class="sms" onclick="remindSms(\'' + c.id + '\', this)">SMS</button>' +
          '<button class="secondary" onclick="copyText(buildReminder(customerById(\'' + c.id + '\')).combined, this)">Copy</button></div></div>';
      }).join('');
      return '<div class="card"><h3 style="margin-top:0">' + esc(stageEmoji(st)) + ' ' + esc(st) + ' — ' + list.length + '</h3><p class="sub">' + esc(NEEDS_ACTION[st]) + '</p>' + rows + '</div>';
    }).join('');
    view.innerHTML =
      '<h2>⏰ Reminders</h2><p class="sub">' + (total ? total + ' customer' + (total === 1 ? '' : 's') + ' stuck — tap WhatsApp, SMS or Copy to nudge them.' : 'Nothing stuck — every application is moving. 🎉') + '</p>' +
      (mode === 'sample' ? sampleBanner() : '') +
      smsHint() +
      (blocks || '<div class="card"><p>Nothing stuck — every application is moving. 🎉</p></div>');
  }

  function renderCustomers() {
    var subs = [], kws = [];
    customers.forEach(function (c) {
      if (c.subDivision && subs.indexOf(c.subDivision) < 0) subs.push(c.subDivision);
      if (kws.indexOf(String(c.systemKw)) < 0) kws.push(String(c.systemKw));
    });
    subs.sort(); kws.sort(function (a, b) { return parseFloat(a) - parseFloat(b); });
    var filtered = filterCustomers(customers, listState);
    var sorted = sortCustomers(filtered, listState.sort);
    view.innerHTML =
      '<h2>👥 Customers (' + sorted.length + ')</h2>' +
      '<p class="sub">Card by card — one tap opens the customer, with WhatsApp and SMS ready.</p>' +
      (mode === 'sample' ? sampleBanner() : '') +
      '<div class="card"><div class="row">' +
      '<input id="cq" placeholder="Search name, consumer no., mobile…" value="' + esc(listState.q) + '" oninput="listState.q=this.value;renderCustomers()">' +
      '<select id="csort" onchange="listState.sort=this.value;renderCustomers()">' +
      '<option value="submitted-desc"' + (listState.sort === 'submitted-desc' ? ' selected' : '') + '>Applied: newest first</option>' +
      '<option value="submitted-asc"' + (listState.sort === 'submitted-asc' ? ' selected' : '') + '>Applied: oldest first</option>' +
      '<option value="installed-desc"' + (listState.sort === 'installed-desc' ? ' selected' : '') + '>Installed: newest first</option>' +
      '<option value="installed-asc"' + (listState.sort === 'installed-asc' ? ' selected' : '') + '>Installed: oldest first</option>' +
      '<option value="name"' + (listState.sort === 'name' ? ' selected' : '') + '>Name A–Z</option></select>' +
      '</div><div class="row" style="margin-top:8px">' +
      '<select id="cstage" onchange="listState.status=this.value;renderCustomers()"><option value="">All stages</option>' +
      STAGES.map(function (st) { return '<option ' + (listState.status === st ? ' selected' : '') + ' value="' + esc(st) + '">' + esc(st) + '</option>'; }).join('') + '</select>' +
      '<select id="csub" onchange="listState.subDiv=this.value;renderCustomers()"><option value="">All sub-divisions</option>' +
      subs.map(function (a) { return '<option ' + (listState.subDiv === a ? 'selected' : '') + ' value="' + esc(a) + '">' + esc(a.replace(/ Electrical Sub-Division/i, '')) + '</option>'; }).join('') + '</select>' +
      '<select id="ckw" onchange="listState.kw=this.value;renderCustomers()"><option value="">All sizes</option>' +
      kws.map(function (k) { return '<option ' + (listState.kw === k ? 'selected' : '') + ' value="' + esc(k) + '">' + esc(k) + ' kW</option>'; }).join('') + '</select>' +
      '</div><div class="btnrow">' +
      '<button class="secondary" onclick="location.hash=\'#customer-new\'">+ Add customer</button>' +
      '<button class="secondary" onclick="document.getElementById(\'csvfile\').click()">Import CSV (portal export)</button>' +
      '<button class="secondary" onclick="downloadCSV()">Export CSV</button>' +
      '<input type="file" id="csvfile" accept=".csv" style="display:none" onchange="importCSVFile(this)">' +
      '</div><p class="sub" style="margin-top:8px">Import accepts the PM Surya Ghar portal export columns (Application Number, Sub Division Name, Consumer Number, Consumer Name, Mobile No., Proposed Capacity, Status, Submitted On, Reverification, Duplicate) or a simple list (consumer number, name, mobile, address, install date, system kW, referred by). The export has no address or install date — add those on the customer page later.</p></div>' +
      '<div id="cust-cards"></div>';
    renderCustomerCards(sorted, document.getElementById('cust-cards'), mode === 'sample');
    var cq = document.getElementById('cq');
    if (cq) { cq.focus(); cq.setSelectionRange(cq.value.length, cq.value.length); }
  }
  window.importCSVFile = function (input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var parsed = parseCustomerCSV(reader.result);
      activeDB.importRows(parsed).then(function (res) {
        return refreshCustomers().then(function () {
          alert('Imported ' + res.added + ' new, updated ' + res.updated + ' existing, skipped ' + parsed.skipped + ' row(s).' + (parsed.isPortal ? ' Portal export format detected.' : ''));
          renderCustomers();
        });
      }).catch(function (err) { alert('Import failed: ' + (err && err.message ? err.message : err)); });
    };
    reader.readAsText(file);
  };
  window.downloadCSV = function () {
    var blob = new Blob([exportCustomersCSV(customers)], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sh-enterprise-customers.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  };

  function renderCustomer(id) {
    var c = customerById(id);
    if (!c) { renderNewCustomer(); return; }
    var rc = referralCount(c.id);
    var refs = referredList(c.id);
    var t = tierReached(c);
    var link = rewardLink(c);
    var msg = buildMessage(msgKey, c);
    var flags = (c.duplicate ? ' <span class="pill due">Duplicate entry — check</span>' : '') +
      (c.reverification ? ' <span class="pill due">Reverification needed</span>' : '');
    var remind = buildReminder(c);
    view.innerHTML =
      '<p><a href="#customers">← Customers</a></p>' +
      '<h2>' + esc(c.name) + '</h2>' +
      '<p class="sub">' + esc(c.area) + ' · ' + esc(c.systemKw) + ' kW · ' + esc(c.status) + flags + '</p>' +
      (mode === 'sample' ? sampleBanner() : '') +
      '<div class="card"><dl class="kv">' +
      '<dt>Consumer no.</dt><dd>' + esc(c.consumerNo) + '</dd>' +
      '<dt>Mobile</dt><dd>' + esc(c.mobile) + '</dd>' +
      '<dt>Address</dt><dd>' + esc(c.address || 'Not added yet — the portal export has no address column.') + '</dd>' +
      '<dt>Application no.</dt><dd>' + esc(c.applicationNo || '—') + '</dd>' +
      '<dt>Sub-division</dt><dd>' + esc(c.subDivision || '—') + '</dd>' +
      '<dt>Applied on</dt><dd>' + esc(fmtDate(c.submittedOn)) + ' (portal “Submitted On”)</dd>' +
      '<dt>Installed on</dt><dd>' + esc(fmtDate(c.installDate)) + (c.installDate ? '' : ' — not in the portal export; add it here when the plant is installed.') + '</dd>' +
      '<dt>System</dt><dd>' + esc(c.systemKw) + ' kW</dd>' +
      '<dt>Referred by</dt><dd>' + (c.referredBy && customerById(c.referredBy) ? esc(customerById(c.referredBy).name) : '—') + '</dd>' +
      '<dt>Referred</dt><dd>' + (refs.length ? refs.map(function (r) { return esc(r.name); }).join(', ') : 'Nobody yet') + '</dd>' +
      '</dl></div>' +
      (remind ? '<div class="card"><h3 style="margin-top:0">Needs action ⏰</h3><p>' + esc(NEEDS_ACTION[c.status] || '') + '</p><div class="msgbox">' + esc(remind.combined) + '</div><div class="btnrow"><button class="whatsapp" onclick="window.open(waLink(customerById(\'' + c.id + '\'), buildReminder(customerById(\'' + c.id + '\')).combined), \'_blank\')">Remind on WhatsApp</button><button class="sms" onclick="openSms(customerById(\'' + c.id + '\'), buildReminder(customerById(\'' + c.id + '\')).combined)">Remind by SMS</button><button class="secondary" onclick="copyText(buildReminder(customerById(\'' + c.id + '\')).combined, this)">Copy</button></div>' + smsHint() + '</div>' : '') +
      '<div class="card"><h3 style="margin-top:0">Rewards</h3>' +
      '<p>Referrals: <b>' + rc + '</b> · Tier reached: <b>' + (t ? 'Level ' + t + ' — ' + esc(meta.settings.tiers[String(t)]) : 'None yet') + '</b> ' +
      (rewardDue(c) ? '<span class="pill due">Reward due — ' + esc(meta.settings.tiers[String(t)]) + '</span>' : '<span class="pill ok">Nothing due</span>') + '</p>' +
      '<div class="tier-progress"><div style="width:' + Math.min(100, rc / 3 * 100) + '%"></div></div>' +
      '<p class="sub">' + rc + ' of 3 referrals towards the top reward.</p>' +
      ((c.rewards || []).length ? '<p>Rewards given: ' + c.rewards.map(function (r) { return esc(r.label) + ' (' + esc(r.date) + ')'; }).join(', ') + '</p>' : '<p class="sub">No rewards recorded yet.</p>') +
      '<div class="row"><input id="customReward" placeholder="Custom reward, e.g. Free inverter check"><button onclick="giveCustomReward(\'' + c.id + '\')">Send custom reward</button></div>' +
      (rewardDue(c) ? '<div class="btnrow"><button onclick="giveTierReward(\'' + c.id + '\')">Give tier reward: ' + esc(meta.settings.tiers[String(t)]) + '</button></div>' : '') +
      '<p class="sub" style="margin-top:10px">Customer reward link (no login needed):<br><a href="' + esc(link) + '" target="_blank">' + esc(link) + '</a></p>' +
      '<div class="btnrow"><button class="secondary" onclick="copyText(\'' + esc(link).replace(/'/g, "\\'") + '\', this)">Copy reward link</button></div>' +
      '</div>' +
      '<div class="card"><h3 style="margin-top:0">Message this customer</h3>' +
      '<div class="row"><select id="msgTpl" onchange="msgKey=this.value;renderCustomer(\'' + c.id + '\')">' +
      ['puja', 'referral', 'anniversary'].map(function (k) { return '<option value="' + k + '"' + (msgKey === k ? ' selected' : '') + '>' + TEMPLATE_NAMES[k] + '</option>'; }).join('') +
      '</select></div>' +
      '<p class="sub">English + Assamese in one message. Name, months since install, referral count and reward link are filled in automatically.</p>' +
      '<div class="msgbox">' + esc(msg.combined) + '</div>' +
      '<div class="btnrow">' +
      '<button class="whatsapp" onclick="window.open(waLink(customerById(\'' + c.id + '\'), buildMessage(msgKey, customerById(\'' + c.id + '\')).combined), \'_blank\')">WhatsApp</button>' +
      '<button class="sms" onclick="openSms(customerById(\'' + c.id + '\'), buildMessage(msgKey, customerById(\'' + c.id + '\')).combined)">SMS</button>' +
      '<button class="secondary" onclick="copyText(buildMessage(msgKey, customerById(\'' + c.id + '\')).combined, this)">Copy message</button>' +
      '</div>' + smsHint() + '</div>' +
      '<div class="card"><h3 style="margin-top:0">Edit details</h3>' +
      '<label>Address</label><input id="f-address" value="' + esc(c.address) + '">' +
      '<label>Install date</label><input id="f-install" type="date" value="' + esc(c.installDate) + '">' +
      '<label>Stage</label><select id="f-status">' + STAGES.map(function (st) { return '<option' + (c.status === st ? ' selected' : '') + '>' + st + '</option>'; }).join('') + '</select>' +
      '<label>Referred by</label><select id="f-ref"><option value="">Nobody</option>' + customers.filter(function (x) { return x.id !== c.id; }).map(function (x) { return '<option value="' + x.id + '"' + (c.referredBy === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>' +
      '<div class="btnrow"><button onclick="saveCustomer(\'' + c.id + '\')">Save changes</button></div></div>';
  }
  window.saveCustomer = function (id) {
    var c = customerById(id);
    if (!c) return;
    c.address = document.getElementById('f-address').value.trim();
    c.installDate = document.getElementById('f-install').value;
    c.status = document.getElementById('f-status').value;
    c.referredBy = document.getElementById('f-ref').value || null;
    activeDB.saveCustomer(c).then(function () { return refreshCustomers(); }).then(function () { renderCustomer(id); });
  };
  window.giveTierReward = function (id) {
    var c = customerById(id);
    var t = tierReached(c);
    if (!t) return;
    c.rewards.push({ tier: t, label: meta.settings.tiers[String(t)], date: new Date().toISOString().slice(0, 10), custom: false });
    activeDB.saveCustomer(c).then(function () { return refreshCustomers(); }).then(function () { renderCustomer(id); });
  };
  window.giveCustomReward = function (id) {
    var c = customerById(id);
    var v = document.getElementById('customReward').value.trim();
    if (!v) { alert('Type the reward first.'); return; }
    c.rewards.push({ tier: 0, label: v, date: new Date().toISOString().slice(0, 10), custom: true });
    activeDB.saveCustomer(c).then(function () { return refreshCustomers(); }).then(function () { renderCustomer(id); });
  };
  window.copyText = function (text, btn) {
    function done() { if (btn) { var old = btn.textContent; btn.textContent = 'Copied!'; setTimeout(function () { btn.textContent = old; }, 1500); } }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, done); }
    else { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta); done(); }
  };
  function renderNewCustomer() {
    view.innerHTML =
      '<p><a href="#customers">← Customers</a></p><h2>Add customer</h2>' +
      '<div class="card">' +
      '<label>Consumer number</label><input id="n-consumer">' +
      '<label>Name</label><input id="n-name">' +
      '<label>Mobile (10 digits)</label><input id="n-mobile" inputmode="numeric">' +
      '<label>Address (optional — not in portal export)</label><input id="n-address">' +
      '<label>Area</label><input id="n-area" value="Goalpara">' +
      '<label>System size (kW)</label><input id="n-kw" type="number" step="0.1" value="3">' +
      '<label>Applied on</label><input id="n-submitted" type="date">' +
      '<label>Install date (optional)</label><input id="n-install" type="date">' +
      '<label>Stage</label><select id="n-status">' + STAGES.map(function (st) { return '<option>' + st + '</option>'; }).join('') + '</select>' +
      '<div class="btnrow"><button onclick="addCustomer()">Save customer</button></div></div>';
  }
  window.addCustomer = function () {
    var consumerNo = document.getElementById('n-consumer').value.trim();
    var name = document.getElementById('n-name').value.trim();
    var mobile = document.getElementById('n-mobile').value.replace(/\D/g, '').slice(-10);
    if (!consumerNo || !name || !mobile) { alert('Consumer number, name and mobile are needed.'); return; }
    var c = {
      id: '', code: '', consumerNo: consumerNo, name: name, mobile: mobile,
      address: document.getElementById('n-address').value.trim(),
      area: document.getElementById('n-area').value.trim() || 'Goalpara',
      systemKw: parseFloat(document.getElementById('n-kw').value) || 0,
      status: document.getElementById('n-status').value,
      submittedOn: document.getElementById('n-submitted').value,
      installDate: document.getElementById('n-install').value,
      applicationNo: '', subDivision: '', duplicate: false, reverification: false,
      referredBy: null, referralCount: 0, rewards: []
    };
    activeDB.saveCustomer(c).then(function () { return refreshCustomers(); }).then(function () { location.hash = '#customers'; renderCustomers(); });
  };

  function renderQuote() {
    var s = meta.settings;
    var gstPct = quoteState.gstPct == null ? s.gstPct : quoteState.gstPct;
    var qhtml = quoteState.calc ? quoteHTML(quoteState.calc, quoteState.name) : '';
    view.innerHTML =
      '<h2>🧾 Make a quote</h2><p class="sub">Fill the numbers — the quotation builds itself. Subsidy follows the PM Surya Ghar slabs: 1 kW ₹30,000 · 2 kW ₹60,000 · 3 kW+ ₹78,000.</p>' +
      (mode === 'sample' ? sampleBanner() : '') +
      '<div class="card">' +
      '<label>Customer name</label><input id="q-name" value="' + esc(quoteState.name) + '" placeholder="e.g. Ramesh Das">' +
      '<div class="row"><div><label>System size (kW)</label><input id="q-kw" type="number" step="0.1" value="' + esc(quoteState.kw) + '"></div>' +
      '<div><label>GST %</label><input id="q-gst" type="number" step="0.1" value="' + esc(gstPct) + '"></div></div>' +
      '<label>Panels (₹)</label><input id="q-panel" type="number" value="' + esc(quoteState.panel) + '">' +
      '<label>Inverter (₹)</label><input id="q-inverter" type="number" value="' + esc(quoteState.inverter) + '">' +
      '<label>Structure (₹)</label><input id="q-structure" type="number" value="' + esc(quoteState.structure) + '">' +
      '<label>Installation (₹)</label><input id="q-installation" type="number" value="' + esc(quoteState.installation) + '">' +
      '<label>Other charges (₹)</label><input id="q-other" type="number" value="' + esc(quoteState.other) + '">' +
      '<div class="btnrow"><button onclick="makeQuote()">Generate quote</button></div></div>' +
      '<div id="quote-out">' + qhtml + '</div>';
  }
  window.makeQuote = function () {
    quoteState.name = document.getElementById('q-name').value.trim();
    quoteState.kw = parseFloat(document.getElementById('q-kw').value) || 0;
    quoteState.panel = +document.getElementById('q-panel').value || 0;
    quoteState.inverter = +document.getElementById('q-inverter').value || 0;
    quoteState.structure = +document.getElementById('q-structure').value || 0;
    quoteState.installation = +document.getElementById('q-installation').value || 0;
    quoteState.other = +document.getElementById('q-other').value || 0;
    quoteState.gstPct = +document.getElementById('q-gst').value || 0;
    quoteState.calc = computeQuote({ kw: quoteState.kw, panel: quoteState.panel, inverter: quoteState.inverter, structure: quoteState.structure, installation: quoteState.installation, other: quoteState.other, gstPct: quoteState.gstPct });
    document.getElementById('quote-out').innerHTML = quoteHTML(quoteState.calc, quoteState.name);
    document.getElementById('quote-out').scrollIntoView();
  };
  function quoteHTML(calc, customerName) {
    var s = meta.settings;
    var q = { kw: quoteState.kw, panel: quoteState.panel, inverter: quoteState.inverter, structure: quoteState.structure, installation: quoteState.installation, other: quoteState.other, gstPct: quoteState.gstPct };
    var text = quoteText(q, calc, customerName);
    return '<div class="quote"><h3>' + esc(s.businessName) + ' (' + esc(s.businessShort) + ')</h3>' +
      '<p class="sub">' + esc(s.address) + (s.phone ? ' · ' + esc(s.phone) : '') + '</p>' +
      '<p><b>Quotation' + (customerName ? ' — ' + esc(customerName) : '') + '</b><br><span class="sub">' + new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) + ' · Valid for 15 days</span></p>' +
      '<table><tr><td>System size</td><td>' + esc(q.kw) + ' kW</td></tr>' +
      '<tr><td>Panels</td><td>' + inr(calc.panel) + '</td></tr>' +
      '<tr><td>Inverter</td><td>' + inr(calc.inverter) + '</td></tr>' +
      '<tr><td>Structure</td><td>' + inr(calc.structure) + '</td></tr>' +
      '<tr><td>Installation</td><td>' + inr(calc.installation) + '</td></tr>' +
      '<tr><td>Other charges</td><td>' + inr(calc.other) + '</td></tr>' +
      '<tr><td>Subtotal</td><td>' + inr(calc.subtotal) + '</td></tr>' +
      '<tr><td>GST (' + calc.gstPct + '%)</td><td>' + inr(calc.gst) + '</td></tr>' +
      '<tr class="total"><td>Total</td><td>' + inr(calc.total) + '</td></tr>' +
      '<tr><td>PM Surya Ghar subsidy</td><td>− ' + inr(calc.subsidy) + '</td></tr>' +
      '<tr class="net"><td>Net payable</td><td>' + inr(calc.net) + '</td></tr></table>' +
      '<p class="sub">Subsidy is paid by the government to the customer\u2019s bank account after installation and net-metering, as per PM Surya Ghar rules.</p>' +
      '<div class="btnrow no-print"><button onclick="window.print()">Print / Save as PDF</button>' +
      '<button class="secondary" onclick="copyText(document.getElementById(\'quote-text\').value, this)">Copy quote for WhatsApp</button></div>' +
      '<textarea id="quote-text" style="display:none">' + esc(text) + '</textarea></div>';
  }

  function renderRewards() {
    var s = meta.settings;
    var dueList = customers.filter(rewardDue);
    var rows = customers.map(function (c) {
      var rc = referralCount(c.id), t = tierReached(c);
      return '<tr onclick="location.hash=\'#customer-' + c.id + '\'"><td><b>' + esc(c.name) + '</b></td>' +
        '<td>' + rc + '</td><td>' + (t ? 'Level ' + t + ' — ' + esc(s.tiers[String(t)]) : '—') + '</td>' +
        '<td>' + (rewardDue(c) ? '<span class="pill due">Reward due</span>' : '<span class="pill ok">Nothing due</span>') + '</td>' +
        '<td>' + (c.rewards || []).map(function (r) { return esc(r.label); }).join(', ') + '</td></tr>';
    }).join('');
    view.innerHTML =
      '<h2>🎁 Rewards</h2><p class="sub">Tiered rewards: 1 referral, 2 referrals, 3 or more. Change the rewards in Settings — the app counts everything for you.</p>' +
      (mode === 'sample' ? sampleBanner() : '') +
      '<div class="card"><h3 style="margin-top:0">Reward tiers (from Settings)</h3>' +
      '<p>1 referral → <b>' + esc(s.tiers['1']) + '</b><br>2 referrals → <b>' + esc(s.tiers['2']) + '</b><br>3+ referrals → <b>' + esc(s.tiers['3']) + '</b></p>' +
      '<p class="sub">' + dueList.length + ' customer(s) have a reward due right now.</p></div>' +
      '<div class="card" style="padding:4px 14px;overflow-x:auto"><table class="list"><thead><tr><th>Customer</th><th>Referrals</th><th>Tier reached</th><th>Status</th><th>Rewards given</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="5">No customers yet.</td></tr>') + '</tbody></table></div>';
  }

  function renderSettings() {
    var s = meta.settings, t = meta.templates;
    view.innerHTML =
      '<h2>⚙️ Settings — master data</h2><p class="sub">' + (mode === 'firestore' ? 'Saved in Firebase — shared with the vendor login.' : 'Saved on this device (sample preview). After login, settings live in Firebase.') + '</p>' +
      '<div class="card"><h3 style="margin-top:0">Business</h3>' +
      '<label>Business name</label><input id="s-name" value="' + esc(s.businessName) + '">' +
      '<label>Short name</label><input id="s-short" value="' + esc(s.businessShort) + '">' +
      '<label>Your name</label><input id="s-owner" value="' + esc(s.owner) + '">' +
      '<label>Address</label><input id="s-address" value="' + esc(s.address) + '">' +
      '<label>Phone</label><input id="s-phone" value="' + esc(s.phone) + '">' +
      '<label>Default GST %</label><input id="s-gst" type="number" step="0.1" value="' + esc(s.gstPct) + '">' +
      '</div>' +
      '<div class="card"><h3 style="margin-top:0">🎉 Bumper offer banner</h3>' +
      '<p class="sub">Shown bright on the Dashboard and Messages tab. Change it to your real offer — or clear the title and text to hide the banner.</p>' +
      '<label>Offer title</label><input id="s-offer-title" value="' + esc(s.offerTitle || '') + '">' +
      '<label>Offer text</label><textarea id="s-offer-text">' + esc(s.offerText || '') + '</textarea>' +
      '<label>Valid till (optional)</label><input id="s-offer-till" type="date" value="' + esc(s.offerValidTill || '') + '">' +
      '</div>' +
      '<div class="card"><h3 style="margin-top:0">Reward tiers</h3>' +
      '<label>1 referral gets</label><input id="s-t1" value="' + esc(s.tiers['1']) + '">' +
      '<label>2 referrals get</label><input id="s-t2" value="' + esc(s.tiers['2']) + '">' +
      '<label>3+ referrals get</label><input id="s-t3" value="' + esc(s.tiers['3']) + '">' +
      '<p class="sub">These are editable examples — set what you actually give.</p></div>' +
      '<div class="card"><h3 style="margin-top:0">Message templates (English + Assamese in one message)</h3>' +
      '<p class="sub">Placeholders: {name} first name · {months} months since install · {count} referrals · {kw} system size · {link} reward link. The app fills them in for each customer.</p>' +
      Object.keys(TEMPLATE_NAMES).map(function (k) {
        return '<label>' + TEMPLATE_NAMES[k] + ' — English</label><textarea id="t-' + k + '-en">' + esc(t[k].en) + '</textarea>' +
          '<label>' + TEMPLATE_NAMES[k] + ' — Assamese</label><textarea id="t-' + k + '-as">' + esc(t[k].as) + '</textarea>';
      }).join('') + '</div>' +
      '<div class="btnrow"><button onclick="saveSettings()">Save settings</button>' +
      '<button class="secondary" onclick="if(confirm(\'Reset the sample preview to the 8 demo customers?\')){store.save(SAMPLE_LS_KEY, demoCustomers());route();}">Reset sample data</button></div>';
  }
  window.saveSettings = function () {
    meta.settings.businessName = document.getElementById('s-name').value.trim();
    meta.settings.businessShort = document.getElementById('s-short').value.trim();
    meta.settings.owner = document.getElementById('s-owner').value.trim();
    meta.settings.address = document.getElementById('s-address').value.trim();
    meta.settings.phone = document.getElementById('s-phone').value.trim();
    meta.settings.gstPct = parseFloat(document.getElementById('s-gst').value) || 13.8;
    meta.settings.offerTitle = document.getElementById('s-offer-title').value.trim();
    meta.settings.offerText = document.getElementById('s-offer-text').value.trim();
    meta.settings.offerValidTill = document.getElementById('s-offer-till').value;
    meta.settings.tiers['1'] = document.getElementById('s-t1').value.trim();
    meta.settings.tiers['2'] = document.getElementById('s-t2').value.trim();
    meta.settings.tiers['3'] = document.getElementById('s-t3').value.trim();
    Object.keys(TEMPLATE_NAMES).forEach(function (k) {
      meta.templates[k].en = document.getElementById('t-' + k + '-en').value;
      meta.templates[k].as = document.getElementById('t-' + k + '-as').value;
    });
    activeDB.saveMeta(meta).then(function () { saveMeta(); alert('Settings saved.'); });
  };

  function renderPublic(code) {
    function show(c, isSample) {
      if (!c) {
        view.innerHTML = '<div class="card"><h2>Link not found</h2><p>This reward link is not valid. Please ask SH Enterprise for a fresh link.</p></div>';
        return;
      }
      var rc = referralCount(c.id), t = tierReached(c);
      var s = meta.settings;
      var nextLabel = t >= 3 ? 'You are at the top tier.' : (t === 2 ? '1 more referral for the top reward: ' + s.tiers['3'] : t === 1 ? '1 more referral for: ' + s.tiers['2'] : 'Your first referral earns: ' + s.tiers['1']);
      view.innerHTML =
        '<div class="card" style="max-width:520px;margin:30px auto">' +
        (isSample ? '<p class="sub"><b>SAMPLE PREVIEW</b> — sample customer page.</p>' : '') +
        '<p class="sub">SH Enterprise (Green Energy) · Kalpanagar, Goalpara</p>' +
        '<h2 style="margin-top:0">Namaskar, ' + esc(firstName(c.name)) + '</h2>' +
        '<p>Your solar rewards with us:</p>' +
        '<div class="stats"><div class="stat"><div class="num">' + rc + '</div><div class="lbl">Friends you brought</div></div>' +
        '<div class="stat"><div class="num">' + (t ? 'Level ' + t : '—') + '</div><div class="lbl">Reward tier</div></div></div>' +
        '<div class="tier-progress" style="margin-top:14px"><div style="width:' + Math.min(100, rc / 3 * 100) + '%"></div></div>' +
        '<p class="sub">' + rc + ' of 3 referrals towards the top reward. ' + esc(nextLabel) + '</p>' +
        '<h3>Rewards you have earned</h3>' +
        ((c.rewards || []).length ? '<p>' + c.rewards.map(function (r) { return '✓ ' + esc(r.label) + ' (' + esc(r.date) + ')'; }).join('<br>') + '</p>' : '<p class="sub">No rewards yet — bring a friend who installs solar and your first reward is yours.</p>') +
        '<p class="sub">Reward tiers: 1 referral → ' + esc(s.tiers['1']) + ' · 2 → ' + esc(s.tiers['2']) + ' · 3+ → ' + esc(s.tiers['3']) + '</p>' +
        '<p class="sub">No login needed. Your details are shown only through your personal link.</p>' +
        '</div>';
    }
    if (firebaseReady && mode === 'firestore') {
      FirestoreDB.getCustomerByCode(code).then(function (c) {
        if (c) { customers = [c]; show(c, false); }
        else show(customerByCode(code) || demoCustomers().find(function (x) { return x.code === code; }) || null, true);
      }).catch(function () { show(null, false); });
    } else {
      var c = demoCustomers().find(function (x) { return x.code === code; });
      if (c) { customers = demoCustomers(); show(c, true); }
      else show(null, false);
    }
  }

  /* ---- boot ---- */
  function initFirebase() {
    try {
      var cfg = (typeof window !== 'undefined' && window.FIREBASE_CONFIG) ? window.FIREBASE_CONFIG : null;
      if (cfg && cfg.apiKey && typeof firebase !== 'undefined') {
        if (!firebase.apps.length) firebase.initializeApp(cfg);
        auth = firebase.auth();
        db = firebase.firestore();
        firebaseReady = true;
        auth.onAuthStateChanged(function (user) {
          authed = !!user;
          mode = authed ? 'firestore' : 'sample';
          activeDB = authed ? FirestoreDB : SampleDB;
          refreshMeta().then(refreshCustomers).then(function () { route(); });
        });
        return true;
      }
    } catch (e) { firebaseReady = false; }
    return false;
  }

  document.addEventListener('DOMContentLoaded', function () {
    view = document.getElementById('view');
    tabs = document.getElementById('tabs');
    window.addEventListener('hashchange', route);
    var booted = initFirebase();
    if (!booted) {
      firebaseReady = false;
      authed = false;
      activeDB = SampleDB;
      refreshMeta().then(function () { route(); });
    } else {
      /* onAuthStateChanged drives the first route; show login meanwhile */
      route();
    }
  });
}
