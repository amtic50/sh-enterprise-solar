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

/* The ONLY Gemini model the app uses — locked at Amit's instruction.
   No model choice, no fallback. */
var GEMINI_MODEL_ID = 'gemini-3.5-flash-lite';

/* Festival occasions for the "Festival offer" template. Dates verified
   Nov 2026: Christmas 25 Dec 2026 and New Year 1 Jan 2027 are fixed;
   Magh Bihu 15 Jan 2027, Saraswati Puja 11 Feb 2027, Holi 22 Mar 2027,
   Rongali Bihu 15 Apr 2027, Durga Puja 5 Oct 2027 (Shashthi) from the
   Assamese/panchang calendars; Eid-ul-Fitr 10 Mar 2027 and Eid-ul-Adha
   17 May 2027 from the Government of India 2027 holiday list — both
   Eids depend on moon sighting and can shift by a day. The vendor can
   add occasions in Settings. */
var DEFAULT_OCCASIONS = [
  { id: 'christmas', name: 'Christmas', nameAs: 'বৰদিন', date: '2026-12-25', en: 'Merry Christmas! 🎄', as: 'শুভ বৰদিন! 🎄' },
  { id: 'new-year', name: 'New Year', nameAs: 'নৱবৰ্ষ', date: '2027-01-01', en: 'Happy New Year! 🎆', as: 'শুভ নৱবৰ্ষ! 🎆' },
  { id: 'magh-bihu', name: 'Magh Bihu', nameAs: 'মাঘ বিহু', date: '2027-01-15', en: 'Happy Magh Bihu! 🔥', as: 'মাঘ বিহুৰ শুভেচ্ছা! 🔥' },
  { id: 'saraswati-puja', name: 'Saraswati Puja', nameAs: 'সৰস্বতী পূজা', date: '2027-02-11', en: 'Happy Saraswati Puja! 📚', as: 'সৰস্বতী পূজাৰ শুভেচ্ছা! 📚' },
  { id: 'eid-fitr', name: 'Eid-ul-Fitr', nameAs: 'ঈদ-উল-ফিতৰ', date: '2027-03-10', en: 'Eid Mubarak! 🌙', as: 'ঈদ মোবাৰক! 🌙' },
  { id: 'holi', name: 'Holi', nameAs: 'হোলী', date: '2027-03-22', en: 'Happy Holi! 🎨', as: 'হোলীৰ শুভেচ্ছা! 🎨' },
  { id: 'rongali-bihu', name: 'Rongali Bihu', nameAs: 'ৰঙালী বিহু', date: '2027-04-15', en: 'Happy Rongali Bihu! 🌾', as: 'ৰঙালী বিহুৰ শুভেচ্ছা! 🌾' },
  { id: 'eid-adha', name: 'Eid-ul-Adha', nameAs: 'ঈদ-উল-আজহা', date: '2027-05-17', en: 'Eid Mubarak! 🌙', as: 'ঈদ মোবাৰক! 🌙' },
  { id: 'durga-puja', name: 'Durga Puja', nameAs: 'দুৰ্গা পূজা', date: '2027-10-05', en: 'Happy Durga Puja! 🌺', as: 'দুৰ্গা পূজাৰ শুভেচ্ছা! 🌺' }
];
/* The old long poster URL. The v4 upgrade replaces a stored posterUrl
   still equal to this with the short link, so messages stop exposing
   the repo URL. Backup short link (do not use unless TinyURL fails):
   https://is.gd/Q2yefd */
var OLD_POSTER_URL = 'https://amtic50.github.io/sh-enterprise-solar/offer-poster.jpg';
var POSTER_SHORT_URL = 'https://tinyurl.com/2875c3rt';

var DEFAULT_SETTINGS = {
  businessName: 'SH Enterprise',
  businessShort: 'Green Energy',
  owner: 'Saiful',
  address: 'Kalpanagar, near Kalpana Cinema Hall, Goalpara, Assam',
  phone: '',
  gstPct: 13.8,
  offerTitle: '🎉 BUMPER OFFER 🎁',
  offerText: 'Refer a friend and earn gifts! We take care of every new customer — installation, paperwork, subsidy process and after-care. Solar installed across 13 sub-divisions. Visit our own office in Kalpanagar, Goalpara (near Kalpana Cinema Hall).',
  offerValidTill: '',
  posterUrl: POSTER_SHORT_URL,
  occasions: JSON.parse(JSON.stringify(DEFAULT_OCCASIONS)),
  geminiApiKey: '',
  geminiModel: GEMINI_MODEL_ID,
  tiers: { '1': 'Free panel cleaning', '2': '₹500 gift', '3': '₹1,500 gift' }
};

/* The offer the v2 defaults led with (subsidy first). The v3 upgrade
   replaces stored settings that still equal these with the new
   referral-first wording; a vendor's own edits are left alone. */
var OLD_OFFER_TITLE = '🎉 BUMPER OFFER ☀️';
var OLD_OFFER_TEXT = 'PM Surya Ghar subsidy up to ₹78,000 on rooftop solar — plus gifts for every friend you refer! 🎁';
/* The v3 banner text (also subsidy-led). The v4 upgrade replaces stored
   settings that still equal either old text with the new wording. */
var OLD_OFFER_TEXT_V3 = 'Refer a friend and earn gifts! Plus PM Surya Ghar subsidy up to ₹78,000 on rooftop solar.';

/* Message templates version. Bump this when DEFAULT_TEMPLATES is rewritten:
   loadMeta replaces stored templates older than this version, because a
   stored meta doc otherwise overrides the new defaults with the old wording.
   A vendor's own edits are kept only when the stored version is current.
   v4: Puja offer -> Festival offer with an occasion picker; poster link
   is the short link.
   v5: festival/referral/anniversary messages now print the customer's
   refer code ({referCode}) and reward link ({link}); the stored-template
   upgrade now replaces the stored maps wholesale — a Firestore merge
   kept the old "puja" key alive inside the stored map after v4. */
var TEMPLATES_VERSION = 5;

var DEFAULT_TEMPLATES = {
  festival: {
    en: "☀️🎉 SH ENTERPRISE • GREEN ENERGY 🎉☀️\n🙏 Namaskar {name}! ☀️ It's been {months} since you went solar with us — thank you for trusting us! {greeting} This {occasion}, share the sunshine: we take care of every new customer — installation, paperwork, subsidy process and after-care — and we have installed solar across 13 sub-divisions. Bring a friend and earn a gift for every friend you bring! 🎁 Your refer code: {referCode} — share it with your friends and earn a gift for each one! Your rewards page: {link} Know someone who wants solar? Send them to us — your gift is waiting! ✨ See our bumper offer poster: {poster} — Saiful, SH Enterprise (Green Energy), Kalpanagar 🌞",
    as: "☀️🎉 SH ENTERPRISE • GREEN ENERGY 🎉☀️\n🙏 নমস্কাৰ {name}! ☀️ আপুনি আমাৰ পৰা ছোলাৰ লগোৱা {months} হ'ল — আপোনাৰ বিশ্বাসৰ বাবে ধন্যবাদ! {greeting} এই {occasion}ত ৰ'দৰ পোহৰ বিলাওক: আমি প্ৰতিজন নতুন গ্ৰাহকৰ যত্ন লওঁ — লগোৱা, কাগজপত্ৰ, চাবচিডিৰ কাম আৰু পিছৰ যত্ন — আৰু আমি ১৩টা মহকুমাত ছোলাৰ লগাইছোঁ। বন্ধুক আনিলে প্ৰতিজনৰ বাবে উপহাৰ পাব! 🎁 আপোনাৰ ৰেফাৰ ক'ড: {referCode} — বন্ধুসকলৰ লগত শ্বেয়াৰ কৰক, প্ৰতিজনৰ বাবে উপহাৰ পাব! আপোনাৰ উপহাৰ ইয়াত চাওক: {link} চিনাকি কোনোবাই ছোলাৰ লগাব বিচাৰিছে নেকি? আমাৰ ওচৰলৈ পঠিয়াওক — আপোনাৰ উপহাৰ ৰৈ আছে! ✨ আমাৰ বাম্পাৰ অফাৰ পষ্টাৰ চাওক: {poster} — ছাইফুল, SH Enterprise (Green Energy), কল্পনানগৰ 🌞"
  },
  referral: {
    en: "☀️🎉 SH ENTERPRISE • GREEN ENERGY 🎉☀️\n🙏 Namaskar {name}! 🎉 Wonderful news — because of you, another home is shining with solar! You have brought {count} friend(s) to us so far. 🌞 Bring one more friend and your next gift is yours! 🎁 Your refer code: {referCode} — share it with your friends and earn a gift for each one! We take care of every new customer — and we have installed solar across 13 sub-divisions. Our own office in Kalpanagar is always open for you. Check your rewards here: {link} See our bumper offer poster: {poster} — Saiful, SH Enterprise (Green Energy) ✨",
    as: "☀️🎉 SH ENTERPRISE • GREEN ENERGY 🎉☀️\n🙏 নমস্কাৰ {name}! 🎉 ভাল খবৰ — আপোনাৰ বাবে আন এখন ঘৰতো ছোলাৰ জিলিকিছে! আপুনি এতিয়ালৈকে {count} জন বন্ধুক আমাৰ ওচৰলৈ আনিছে। 🌞 আৰু এজন বন্ধুক আনিলে আপোনাৰ পৰৱৰ্তী উপহাৰটো পাব! 🎁 আপোনাৰ ৰেফাৰ ক'ড: {referCode} — বন্ধুসকলৰ লগত শ্বেয়াৰ কৰক, প্ৰতিজনৰ বাবে উপহাৰ পাব! আমি প্ৰতিজন নতুন গ্ৰাহকৰ যত্ন লওঁ — আৰু আমি ১৩টা মহকুমাত ছোলাৰ লগাইছোঁ। কল্পনানগৰত আমাৰ নিজৰ কাৰ্যালয় আপোনাৰ বাবে সদায় খোলা। আপোনাৰ উপহাৰ ইয়াত চাওক: {link} আমাৰ বাম্পাৰ অফাৰ পষ্টাৰ চাওক: {poster} — ছাইফুল, SH Enterprise (Green Energy) ✨"
  },
  anniversary: {
    en: "☀️🎉 SH ENTERPRISE • GREEN ENERGY 🎉☀️\n🙏 Namaskar {name}! 🎉☀️ Happy 1-year solar anniversary! A full year since we installed solar at your home — your electricity bill must be smiling by now. 😊 Need a panel cleaning or a free check-up? Just message us anytime! And if a friend wants solar, we take care of every new customer — installation, paperwork, subsidy process and after-care — plus a gift for you! 🎁 Your refer code: {referCode} — share it with your friends and earn a gift for each one! Your rewards page: {link} See our bumper offer poster: {poster} — Saiful, SH Enterprise (Green Energy)",
    as: "☀️🎉 SH ENTERPRISE • GREEN ENERGY 🎉☀️\n🙏 নমস্কাৰ {name}! 🎉☀️ ছোলাৰৰ ১ বছৰ সম্পূৰ্ণ হোৱাৰ শুভেচ্ছা! আপোনাৰ ঘৰত ছোলাৰ লগোৱা এবছৰ হ'ল — বিদ্যুৎ বিল নিশ্চয় কমিছে। 😊 পেনেল চাফা বা বিনামূলীয়া পৰীক্ষা লাগিলে আমাক মেছেজ কৰক! আৰু কোনো বন্ধুৱে ছোলাৰ লগাব বিচাৰিলে আমি প্ৰতিজন নতুন গ্ৰাহকৰ যত্ন লওঁ — লগোৱা, কাগজপত্ৰ, চাবচিডিৰ কাম আৰু পিছৰ যত্ন — আৰু আপোনাৰ বাবেও উপহাৰ আছে! 🎁 আপোনাৰ ৰেফাৰ ক'ড: {referCode} — বন্ধুসকলৰ লগত শ্বেয়াৰ কৰক, প্ৰতিজনৰ বাবে উপহাৰ পাব! আপোনাৰ উপহাৰ ইয়াত চাওক: {link} আমাৰ বাম্পাৰ অফাৰ পষ্টাৰ চাওক: {poster} — ছাইফুল, SH Enterprise (Green Energy)"
  },
  reminder_not_redeemed: {
    en: "☀️🎉 SH ENTERPRISE • GREEN ENERGY 🎉☀️\n🙏 Namaskar {name}! ⏰ Your {kw} kW solar is installed — but your subsidy is still waiting to be redeemed! 💰 Don't miss it: open the PM Surya Ghar portal and redeem your subsidy today, or just message us and we will help you do it. ✅ See our bumper offer poster: {poster} — Saiful, SH Enterprise (Green Energy)",
    as: "☀️🎉 SH ENTERPRISE • GREEN ENERGY 🎉☀️\n🙏 নমস্কাৰ {name}! ⏰ আপোনাৰ {kw} kW ছোলাৰ লগোৱা হৈ গৈছে — কিন্তু আপোনাৰ চাবচিডিটো এতিয়াও ৰিডিম কৰা হোৱা নাই! 💰 হেৰুৱাব নালাগে: আজিয়েই PM Surya Ghar পৰ্টেলত ৰিডিম কৰক, নহ'লে আমাক মেছেজ কৰক — আমি সহায় কৰিম। ✅ আমাৰ বাম্পাৰ অফাৰ পষ্টাৰ চাওক: {poster} — ছাইফুল, SH Enterprise (Green Energy)"
  },
  reminder_return: {
    en: "☀️🎉 SH ENTERPRISE • GREEN ENERGY 🎉☀️\n🙏 Namaskar {name}! 📄 Your subsidy application came back for one small correction — no need to worry! Just send us the corrected document or photo and we will resubmit it right away. ✅ Message us now and let's get your subsidy moving! 💰 See our bumper offer poster: {poster} — Saiful, SH Enterprise (Green Energy)",
    as: "☀️🎉 SH ENTERPRISE • GREEN ENERGY 🎉☀️\n🙏 নমস্কাৰ {name}! 📄 আপোনাৰ চাবচিডি আবেদনখন সৰু ভুল এটাৰ বাবে ঘূৰাই দিয়া হৈছে — চিন্তা কৰিব নালাগে! শুদ্ধ কাগজ বা ফটো আমাক পঠিয়াওক, আমি তৎক্ষণাৎ আকৌ জমা দিম। ✅ এতিয়াই মেছেজ কৰক, চাবচিডিটো সোনকালে পোৱাৰ ব্যৱস্থা কৰোঁ! 💰 আমাৰ বাম্পাৰ অফাৰ পষ্টাৰ চাওক: {poster} — ছাইফুল, SH Enterprise (Green Energy)"
  },
  reminder_installation: {
    en: "☀️🎉 SH ENTERPRISE • GREEN ENERGY 🎉☀️\n🙏 Namaskar {name}! ☀️ Your {kw} kW solar is ready to shine at your home — we are just waiting for your date! 📅 Tell us a day that suits you and our team will come and install it. Plus, we take care of everything for you — installation, paperwork, subsidy process and after-care. Our team has hands-on working experience in electrical and solar work, and our own office in Kalpanagar is always there if you need us! 💰 See our bumper offer poster: {poster} — Saiful, SH Enterprise (Green Energy)",
    as: "☀️🎉 SH ENTERPRISE • GREEN ENERGY 🎉☀️\n🙏 নমস্কাৰ {name}! ☀️ আপোনাৰ {kw} kW ছোলাৰ আপোনাৰ ঘৰত জিলিকিবলৈ সাজু — আমি কেৱল আপোনাৰ দিনটোৰ অপেক্ষাত! 📅 সুবিধাৰ দিন এটা জনাওক, আমাৰ দলে আহি লগাই দিব। লগতে, আপোনাৰ বাবে সকলো কামতে আমি সহায় কৰিম — লগোৱা, কাগজপত্ৰ, চাবচিডিৰ কাম আৰু পিছৰ যত্ন। আমাৰ দলৰ বৈদ্যুতিক আৰু ছোলাৰ কামৰ প্ৰত্যক্ষ অভিজ্ঞতা আছে, আৰু কল্পনানগৰত আমাৰ নিজৰ কাৰ্যালয় আছে — প্ৰয়োজন হ'লেই আহিব পাৰে! 💰 আমাৰ বাম্পাৰ অফাৰ পষ্টাৰ চাওক: {poster} — ছাইফুল, SH Enterprise (Green Energy)"
  },
  reminder_agreement: {
    en: "☀️🎉 SH ENTERPRISE • GREEN ENERGY 🎉☀️\n🙏 Namaskar {name}! 📝 Your solar agreement is the last step before installation — just one signature away! ✍️ Please send us a photo of the signed agreement and we will upload it on the portal for you right away. ✅ See our bumper offer poster: {poster} — Saiful, SH Enterprise (Green Energy)",
    as: "☀️🎉 SH ENTERPRISE • GREEN ENERGY 🎉☀️\n🙏 নমস্কাৰ {name}! 📝 আপোনাৰ ছোলাৰ এগ্ৰিমেণ্টখনেই লগোৱাৰ আগৰ শেষ খোজ — মাত্ৰ এটা চহীৰ দূৰত্বত! ✍️ চহী কৰা এগ্ৰিমেণ্টৰ ফটো আমাক পঠিয়াওক, আমি তৎক্ষণাৎ পৰ্টেলত আপলোড কৰি দিম। ✅ আমাৰ বাম্পাৰ অফাৰ পষ্টাৰ চাওক: {poster} — ছাইফুল, SH Enterprise (Green Energy)"
  },
  reminder_inspection: {
    en: "☀️🎉 SH ENTERPRISE • GREEN ENERGY 🎉☀️\n🙏 Namaskar {name}! 🔍 The inspection of your {kw} kW solar plant is coming up — almost there! ✅ Please keep the plant area clear and your documents ready. The inspector may visit any day. Questions? Just message us! 📱 See our bumper offer poster: {poster} — Saiful, SH Enterprise (Green Energy)",
    as: "☀️🎉 SH ENTERPRISE • GREEN ENERGY 🎉☀️\n🙏 নমস্কাৰ {name}! 🔍 আপোনাৰ {kw} kW ছোলাৰ প্লাণ্টৰ পৰিদৰ্শন আহি আছে — আৰু অলপ বাকী! ✅ প্লাণ্টৰ ঠাই মুকলি ৰাখক আৰু কাগজবোৰ সাজু ৰাখক। পৰিদৰ্শক যিকোনো দিন আহিব পাৰে। কিবা প্ৰশ্ন থাকিলে আমাক মেছেজ কৰক! 📱 আমাৰ বাম্পাৰ অফাৰ পষ্টাৰ চাওক: {poster} — ছাইফুল, SH Enterprise (Green Energy)"
  },
  reminder_disbursal: {
    en: "☀️🎉 SH ENTERPRISE • GREEN ENERGY 🎉☀️\n🙏 Namaskar {name}! 🎉 Good news — your subsidy is approved! 💰 The money is on its way from the department to your bank account. We are following up every day, and the moment it arrives we will message you. ✅ See our bumper offer poster: {poster} — Saiful, SH Enterprise (Green Energy)",
    as: "☀️🎉 SH ENTERPRISE • GREEN ENERGY 🎉☀️\n🙏 নমস্কাৰ {name}! 🎉 ভাল খবৰ — আপোনাৰ চাবচিডি অনুমোদন হৈছে! 💰 টকা বিভাগৰ পৰা আপোনাৰ বেংক একাউণ্টলৈ আহি আছে। আমি প্ৰতিদিনে তাৰ পিছত লাগি আছোঁ — টকা সোমোৱা মাত্ৰকে আপোনাক জনাম। ✅ আমাৰ বাম্পাৰ অফাৰ পষ্টাৰ চাওক: {poster} — ছাইফুল, SH Enterprise (Green Energy)"
  }
};
/* Funny / meme-style variants of the same 9 templates, v2 (funnier),
   written with Gemini and baked in. The festival one uses {occasion}.
   The Messages tab and the customer page let the vendor swap
   Regular <-> Funny per message. */
var FUNNY_TEMPLATES = {
  "anniversary": {
    "as": "☀️✨--- SH ENTERPRISE ---✨☀️\n{name}, আপোনাৰ ছলাৰ লগোৱা {months} মাহ হ'ল! আপোনাৰ বিজুলী মিটাৰখনে নিশ্চয় আজিকালি হাই-ভল্টেজ বিলৰ নাটকত ভাগ ল'বলৈ পোৱা নাই! আজি পেনেলে চাফা কৰিম আহিম। আপোনাৰ ৰেফাৰ ক'ড: {referCode} — শ্বেয়াৰ কৰক, প্ৰতিজন বন্ধুৰ বাবে উপহাৰ পাব! আপোনাৰ উপহাৰ ইয়াত চাওক: {link} আমাৰ বাম্পাৰ অফাৰ পষ্টাৰ চাওক: {poster}\n— ছাইফুল, এছ এইচ এণ্টাৰপ্ৰাইজ (গ্ৰীণ এনাৰ্জি)",
    "en": "☀️✨--- SH ENTERPRISE ---✨☀️\nHappy {months}-month Solarversary, {name}! Your meter is probably missing the drama of high bills. Time for a free check-up/cleaning! Your refer code: {referCode} — share it and earn a gift for every friend! Your rewards page: {link} See our bumper offer poster: {poster}\n— Saiful, SH Enterprise (Green Energy)"
  },
  "festival": {
    "as": "☀️✨--- SH ENTERPRISE ---✨☀️\nঐ {name}, {occasion} আহি পালে! কিন্তু বিজুলীৰ বিলখন দেখি মনটো বেয়া নকৰিব। সূৰ্যৰ পৰা ফ্ৰী বিজুলী লওক! বন্ধু এজনক ৰেফাৰ কৰক আৰু উপহাৰ পাব। আপোনাৰ ৰেফাৰ ক'ড: {referCode} — শ্বেয়াৰ কৰক, প্ৰতিজন বন্ধুৰ বাবে উপহাৰ পাব! আপোনাৰ উপহাৰ ইয়াত চাওক: {link} আমাৰ বাম্পাৰ অফাৰ পষ্টাৰ চাওক: {poster}\n— ছাইফুল, এছ এইচ এণ্টাৰপ্ৰাইজ (গ্ৰীণ এনাৰ্জি)",
    "en": "☀️✨--- SH ENTERPRISE ---✨☀️\nHey {name}! {occasion} is here, but don't let your electricity bill spoil the mood. Let the sun pay for your lights! Refer a friend and get a surprise gift. Your refer code: {referCode} — share it and earn a gift for every friend! Your rewards page: {link} See our bumper offer poster: {poster}\n— Saiful, SH Enterprise (Green Energy)"
  },
  "referral": {
    "as": "☀️✨--- SH ENTERPRISE ---✨☀️\nধন্যবাদ {name}! আপুনি ইতিমধ্যে {count} জন বন্ধুৰ নাম দিছে। এনেকৈয়ে আগুৱাই যাওক আৰু পৰৱৰ্তী পুৰস্কাৰটো লৈ লওক! আপোনাৰ ৰেফাৰ ক'ড: {referCode} — শ্বেয়াৰ কৰক, প্ৰতিজন বন্ধুৰ বাবে উপহাৰ পাব! আমাৰ বাম্পাৰ অফাৰ পষ্টাৰ চাওক: {poster}\n— ছাইফুল, এছ এইচ এণ্টাৰপ্ৰাইজ (গ্ৰীণ এনাৰ্জি)",
    "en": "☀️✨--- SH ENTERPRISE ---✨☀️\nThanks {name}! You've already referred {count} friends. Keep it up and grab the next big reward! Your refer code: {referCode} — share it and earn a gift for every friend! See our bumper offer poster: {poster}\n— Saiful, SH Enterprise (Green Energy)"
  },
  "reminder_agreement": {
    "as": "☀️✨--- SH ENTERPRISE ---✨☀️\n{name}, কেৱল এগ্ৰিমেণ্টখনৰ ফটো এখন লাগে। পঠিয়াই দিয়ক, যাতে আমি আপোনাৰ টকা বচাব পৰা কামটো আৰম্ভ কৰিব পাৰো! আমাৰ বাম্পাৰ অফাৰ পষ্টাৰ চাওক: {poster}\n— ছাইফুল, এছ এইচ এণ্টাৰপ্ৰাইজ (গ্ৰীণ এনাৰ্জি)",
    "en": "☀️✨--- SH ENTERPRISE ---✨☀️\n{name}, just need that agreement photo to make things official. Send it over so we can start saving your money! See our bumper offer poster: {poster}\n— Saiful, SH Enterprise (Green Energy)"
  },
  "reminder_disbursal": {
    "as": "☀️✨--- SH ENTERPRISE ---✨☀️\n{name}, ভাল খবৰ! চাবচিডি এপ্ৰুভ হৈ গৈছে। টকাখিনি সোনকালে পাবলৈ আমি বিভাগীয় বিষয়াৰ লগত কথা পাতি আছোঁ। খবৰ দিম! আমাৰ বাম্পাৰ অফাৰ পষ্টাৰ চাওক: {poster}\n— ছাইফুল, এছ এইচ এণ্টাৰপ্ৰাইজ (গ্ৰীণ এনাৰ্জি)",
    "en": "☀️✨--- SH ENTERPRISE ---✨☀️\n{name}, the good news is the subsidy is approved! We are pushing the department for the final money transfer. Stay tuned! See our bumper offer poster: {poster}\n— Saiful, SH Enterprise (Green Energy)"
  },
  "reminder_inspection": {
    "as": "☀️✨--- SH ENTERPRISE ---✨☀️\n{name}, ইনস্পেকচন আহিব ধৰিছে! ছাদখন পৰিষ্কাৰ কৰি ৰাখিব আৰু কাগজ-পত্ৰবোৰ সাজু কৰি থ'ব। সকলো যাতে ধুনীয়াকৈ হয়। আমাৰ বাম্পাৰ অফাৰ পষ্টাৰ চাওক: {poster}\n— ছাইফুল, এছ এইচ এণ্টাৰপ্ৰাইজ (গ্ৰীণ এনাৰ্জি)",
    "en": "☀️✨--- SH ENTERPRISE ---✨☀️\n{name}, inspection is coming! Please keep the rooftop clean and documents handy. Let's make it smooth. See our bumper offer poster: {poster}\n— Saiful, SH Enterprise (Green Energy)"
  },
  "reminder_installation": {
    "as": "☀️✨--- SH ENTERPRISE ---✨☀️\n{name}, আপোনাৰ ছাদখনে কেতিয়াৰ পৰা {kw}kW ছলাৰ পাৱাৰ পাব? ইনষ্টলেচনৰ বাবে এটা দিন ঠিক কৰক! আমাৰ বাম্পাৰ অফাৰ পষ্টাৰ চাওক: {poster}\n— ছাইফুল, এছ এইচ এণ্টাৰপ্ৰাইজ (গ্ৰীণ এনাৰ্জি)",
    "en": "☀️✨--- SH ENTERPRISE ---✨☀️\n{name}, your rooftop is waiting for its {kw}kW sun-power upgrade! When are we coming to install? Pick a date! See our bumper offer poster: {poster}\n— Saiful, SH Enterprise (Green Energy)"
  },
  "reminder_not_redeemed": {
    "as": "☀️✨--- SH ENTERPRISE ---✨☀️\n{name}, আপোনাৰ ছলাৰ ৰেডী, কিন্তু চাবচিডি ফাইলটো টোপনি গৈ আছে। সোনকালে জগাই দিয়ক, নহ'লে সি আৰু এলাহী হৈ পৰিব! আমাৰ বাম্পাৰ অফাৰ পষ্টাৰ চাওক: {poster}\n— ছাইফুল, এছ এইচ এণ্টাৰপ্ৰাইজ (গ্ৰীণ এনাৰ্জি)",
    "en": "☀️✨--- SH ENTERPRISE ---✨☀️\n{name}, your solar is ready but your subsidy file is hibernating. Wake it up before it gets too lazy! See our bumper offer poster: {poster}\n— Saiful, SH Enterprise (Green Energy)"
  },
  "reminder_return": {
    "as": "☀️✨--- SH ENTERPRISE ---✨☀️\nঐ {name}, অফিচৰ পৰা ফাইলটো অলপ ভুলৰ বাবে ঘূৰাই দিছে। চিন্তা নকৰিব, মাত্ৰ সেই কাগজখন পঠিয়াই দিয়ক, আমি ঠিক কৰি দিম! আমাৰ বাম্পাৰ অফাৰ পষ্টাৰ চাওক: {poster}\n— ছাইফুল, এছ এইচ এণ্টাৰপ্ৰাইজ (গ্ৰীণ এনাৰ্জি)",
    "en": "☀️✨--- SH ENTERPRISE ---✨☀️\nOops! {name}, the office sent your file back for a tiny correction. Don't worry, just send the document and we'll fix it! See our bumper offer poster: {poster}\n— Saiful, SH Enterprise (Green Energy)"
  }
};
/* Drop stored template keys that no longer exist in the current defaults
   (e.g. "puja" after v4). The vendor cannot create new keys — the
   Settings editor only edits the keys in TEMPLATE_NAMES — so an unknown
   stored key is always stale, never a deliberate edit. Known keys keep
   the vendor's stored wording. */
function pruneStoredTemplates(t, f) {
  var out = {}, fout = {};
  Object.keys(DEFAULT_TEMPLATES).forEach(function (k) { if (t && t[k]) out[k] = t[k]; });
  Object.keys(FUNNY_TEMPLATES).forEach(function (k) { if (f && f[k]) fout[k] = f[k]; });
  return { templates: out, funnyTemplates: fout };
}
var REMINDER_BY_STAGE = {
  'Subsidy Request (Not Redeemed)': 'reminder_not_redeemed',
  'Subsidy Request (Return)': 'reminder_return',
  'Installation (Pending)': 'reminder_installation',
  'Upload Agreement (Pending)': 'reminder_agreement',
  'Inspection (Pending)': 'reminder_inspection',
  'Subsidy Disbursal (Pending)': 'reminder_disbursal'
};
var TEMPLATE_NAMES = {
  festival: 'Festival offer', referral: 'Referral progress', anniversary: 'One-year anniversary',
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
    { id: 'demo-a1k9', code: 'demo-a1k9', consumerNo: '040000100001', name: 'Ramesh Das', mobile: '9876543210', address: 'Kalpanagar, Goalpara', area: 'Goalpara', installDate: '2026-10-20', submittedOn: '2026-09-15', systemKw: 3, status: 'Subsidy Disbursal (Disbursed)', applicationNo: 'DEMO-NP-0001', subDivision: 'Goalpara Electrical Sub-Division', duplicate: false, reverification: false, referredBy: 'demo-h8t2', referralCount: 2, rewards: [], referred: [{name:'Monowar', consumerNo:'040000100006'}, {name:'Sunita', consumerNo:'040000100007'}], referCode: 'SH7K2Q' },
    { id: 'demo-b2m8', code: 'demo-b2m8', consumerNo: '040000100002', name: 'Anita Rabha', mobile: '8765432109', address: 'Bhalukdubi, Goalpara', area: 'Goalpara', installDate: '2026-03-15', submittedOn: '2026-02-10', systemKw: 2, status: 'Subsidy Disbursal (Disbursed)', applicationNo: 'DEMO-NP-0002', subDivision: 'Goalpara Electrical Sub-Division', duplicate: false, reverification: false, referredBy: null, referralCount: 3, rewards: [], referred: [{name:'Babul', consumerNo:'040000100003'}, {name:'Priya', consumerNo:'040000100004'}, {name:'Jiten', consumerNo:'040000100005'}], referCode: 'SH3M8R' },
    { id: 'demo-c3n7', code: 'demo-c3n7', consumerNo: '040000100003', name: 'Babul Hussain', mobile: '7654321098', address: 'Nayapara, Goalpara', area: 'Goalpara', installDate: '', submittedOn: '2026-10-02', systemKw: 5, status: 'Installation (Pending)', applicationNo: 'DEMO-NP-0003', subDivision: 'Goalpara Electrical Sub-Division', duplicate: false, reverification: false, referredBy: 'demo-b2m8', referralCount: 0, rewards: [], referCode: 'SH9D4W' },
    { id: 'demo-d4p6', code: 'demo-d4p6', consumerNo: '040000100004', name: 'Priya Sharma', mobile: '9876501234', address: 'Agia, Goalpara', area: 'Goalpara', installDate: '2026-08-02', submittedOn: '2026-06-18', systemKw: 1, status: 'Subsidy Request (Redeemed)', applicationNo: 'DEMO-NP-0004', subDivision: 'Goalpara Electrical Sub-Division', duplicate: false, reverification: false, referredBy: 'demo-b2m8', referralCount: 0, rewards: [], referCode: 'SH5P6T' },
    { id: 'demo-e5q5', code: 'demo-e5q5', consumerNo: '040000100005', name: 'Jiten Kalita', mobile: '8765409876', address: 'Baladmari, Goalpara', area: 'Goalpara', installDate: '2026-11-14', submittedOn: '2026-11-05', systemKw: 2, status: 'Subsidy Disbursal (Disbursed)', applicationNo: 'DEMO-NP-0005', subDivision: 'Goalpara Electrical Sub-Division', duplicate: false, reverification: false, referredBy: 'demo-b2m8', referralCount: 0, rewards: [], referCode: 'SH2B8N' },
    { id: 'demo-f6r4', code: 'demo-f6r4', consumerNo: '040000100006', name: 'Monowar Ali', mobile: '7654012345', address: 'Bapuji Nagar, Goalpara', area: 'Goalpara', installDate: '', submittedOn: '2026-04-05', systemKw: 3, status: 'Inspection (Pending)', applicationNo: 'DEMO-NP-0006', subDivision: 'Goalpara Electrical Sub-Division', duplicate: false, reverification: false, referredBy: 'demo-a1k9', referralCount: 0, rewards: [], referCode: 'SH8F3K' },
    { id: 'demo-g7s3', code: 'demo-g7s3', consumerNo: '040000100007', name: 'Sunita Devi', mobile: '9876123450', address: 'Kalpanagar, Goalpara', area: 'Goalpara', installDate: '', submittedOn: '2025-12-12', systemKw: 2, status: 'Subsidy Request (Return)', applicationNo: 'DEMO-NP-0007', subDivision: 'Goalpara Electrical Sub-Division', duplicate: false, reverification: true, referredBy: 'demo-a1k9', referralCount: 0, rewards: [], referCode: 'SH4G7X' },
    { id: 'demo-h8t2', code: 'demo-h8t2', consumerNo: '040000100008', name: 'Abdul Karim', mobile: '8765987654', address: 'Bhalukdubi, Goalpara', area: 'Goalpara', installDate: '2026-01-10', submittedOn: '2025-11-20', systemKw: 4, status: 'Subsidy Disbursal (Disbursed)', applicationNo: 'DEMO-NP-0008', subDivision: 'Goalpara Electrical Sub-Division', duplicate: true, reverification: false, referredBy: null, referralCount: 1, rewards: [], referred: [{name:'Ramesh', consumerNo:'040000100001'}], referCode: 'SH6Q9M' }
  ];
}
function defaultMeta() {
  return {
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
    templates: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)),
    funnyTemplates: JSON.parse(JSON.stringify(FUNNY_TEMPLATES)),
    templatesVersion: TEMPLATES_VERSION
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
var referrals = [];          // referral submissions (vendor only; sample preview: none)
var referralsLoadError = false; // true when the vendor list could not be read (e.g. rules not published yet)
var mode = 'sample';         // 'sample' | 'firestore'
var authed = false;
var firebaseReady = false;
var db = null, auth = null;

function saveMeta() { store.save(LS_KEY, meta); }

/* ---- Demo / trial mode (v7) ----
   A limited demo for a friend: the app runs in trial mode when the main
   page URL carries ?demo=1. The flag persists per-browser (localStorage)
   so removing ?demo=1 from the URL does not escape the trial; ?demo=0
   clears it. The trial allows 5 messages over 3 days from first use
   (whichever comes first), then the whole site locks. Trial state lives
   in Firestore (meta/trial) so clearing browser storage cannot reset
   it. Normal (non-demo) use NEVER reads the trial doc and is never
   locked or counted by it. Demo mode never changes the data source:
   when logged in, the app loads the REAL Firestore customers, exactly
   as the normal app does; the 8 sample customers appear only in the
   logged-out preview, as today. */
var TRIAL_LS_KEY = 'sh-solar-trial-v1';
var TRIAL_DAYS = 3;
var TRIAL_MESSAGE_LIMIT = 5;
var demoMode = false;      /* true when this browser is in demo/trial mode */
var trial = null;          /* loaded trial doc {startedAt, days, messageLimit, messagesSent}, or null */
var trialLoadError = false; /* the trial doc could not be read (demo mode only) */

function defaultTrial() {
  return { startedAt: null, days: TRIAL_DAYS, messageLimit: TRIAL_MESSAGE_LIMIT, messagesSent: 0 };
}
/* The ?demo= value in a URL: '1' turns the trial on, '0' turns it off,
   anything else is not a demo flag. */
function demoFlagFromSearch(search) {
  try {
    var v = new URLSearchParams(search || '').get('demo');
    if (v === '1') return 'on';
    if (v === '0') return 'off';
    return null;
  } catch (e) { return null; }
}
/* Work out demo mode for this browser: the URL flag wins and is saved;
   otherwise the saved per-browser flag decides. */
function detectDemoMode(search) {
  var flag = demoFlagFromSearch(search);
  if (flag === 'on') { store.save(TRIAL_LS_KEY, '1'); return true; }
  if (flag === 'off') { store.save(TRIAL_LS_KEY, '0'); return false; }
  return store.load(TRIAL_LS_KEY) === '1';
}
function trialMessagesLeft(t) {
  if (!t) return TRIAL_MESSAGE_LIMIT;
  var limit = (typeof t.messageLimit === 'number' && t.messageLimit > 0) ? t.messageLimit : TRIAL_MESSAGE_LIMIT;
  var sent = (typeof t.messagesSent === 'number' && t.messagesSent >= 0) ? t.messagesSent : 0;
  return Math.max(0, limit - sent);
}
function trialDaysLeft(t, nowMs) {
  if (!t || !t.startedAt) return TRIAL_DAYS;
  var start = Date.parse(t.startedAt);
  if (isNaN(start)) return TRIAL_DAYS;
  var days = (typeof t.days === 'number' && t.days > 0) ? t.days : TRIAL_DAYS;
  return Math.max(0, Math.ceil((start + days * 86400000 - nowMs) / 86400000));
}
function trialIsExpired(t, nowMs) {
  if (!t || !t.startedAt) return false;
  var start = Date.parse(t.startedAt);
  if (isNaN(start)) return false;
  var days = (typeof t.days === 'number' && t.days > 0) ? t.days : TRIAL_DAYS;
  return nowMs >= start + days * 86400000;
}
function trialIsLocked(t, nowMs) {
  if (!t) return false;
  return trialMessagesLeft(t) <= 0 || trialIsExpired(t, nowMs);
}
/* Is this browser's demo trial currently locked? Only ever true in
   demo mode; normal use is never locked. */
function trialLocked() {
  if (!demoMode) return false;
  return trialIsLocked(trial, Date.now());
}
/* May a share/send go ahead? In demo mode a locked trial blocks it; a
   trial that has not loaded yet fails open (never block on a read
   failure). */
function trialAllowShare() {
  if (!demoMode) return true;
  if (!trial) return true;
  return !trialIsLocked(trial, Date.now());
}
/* Load the trial doc (demo mode only, vendor login only — the meta
   rules are vendor-only). Sets startedAt on first demo load. Never
   rejects; a failure leaves trial null (demo runs unlocked) and sets
   trialLoadError. Normal mode never calls this. */
function loadTrial() {
  if (!demoMode || !firebaseReady || !authed || typeof db === 'undefined' || !db) return Promise.resolve(null);
  trialLoadError = false;
  return db.collection('meta').doc('trial').get().then(function (doc) {
    if (!doc.exists) {
      trial = defaultTrial();
      trial.startedAt = new Date().toISOString();
      return db.collection('meta').doc('trial').set(trial).then(function () { return trial; }).catch(function () { return trial; });
    }
    var d = doc.data() || {};
    trial = {
      startedAt: d.startedAt || null,
      days: (typeof d.days === 'number' && d.days > 0) ? d.days : TRIAL_DAYS,
      messageLimit: (typeof d.messageLimit === 'number' && d.messageLimit > 0) ? d.messageLimit : TRIAL_MESSAGE_LIMIT,
      messagesSent: (typeof d.messagesSent === 'number' && d.messagesSent >= 0) ? d.messagesSent : 0
    };
    if (!trial.startedAt) {
      trial.startedAt = new Date().toISOString();
      return db.collection('meta').doc('trial').set(trial).then(function () { return trial; }).catch(function () { return trial; });
    }
    return trial;
  }).catch(function () { trial = null; trialLoadError = true; return null; });
}
/* Count one share/send against the trial (demo mode only). The in-memory
   count rises at once so the cap holds for this session even if the
   Firestore write fails; the write is best-effort. */
function trialRecordShare() {
  if (!demoMode || !trial) return;
  trial.messagesSent = (trial.messagesSent || 0) + 1;
  if (firebaseReady && authed && typeof db !== 'undefined' && db) {
    db.collection('meta').doc('trial').set({ messagesSent: trial.messagesSent }, { merge: true }).catch(function () {});
  }
}
/* Reset the trial (vendor only): clears the start and the sent count so
   the demo can be given again. The next demo-mode load starts a fresh
   3 days. Writes the whole trial doc. */
function resetTrial() {
  trial = defaultTrial();
  if (firebaseReady && authed && typeof db !== 'undefined' && db) {
    return db.collection('meta').doc('trial').set(trial).then(function () { return trial; }).catch(function () { return trial; });
  }
  return Promise.resolve(trial);
}
/* One line of trial status for Settings (demo mode). Dates and trial
   counts only — never customer data. */
function trialStatusText() {
  if (!trial) return trialLoadError ? 'Trial status could not be checked.' : 'Trial status loading…';
  var started = String(trial.startedAt || '').slice(0, 10) || 'not started yet';
  return 'Started ' + started + ' · ' + trialDaysLeft(trial, Date.now()) + ' day(s) left · ' + (trial.messagesSent || 0) + ' of ' + (trial.messageLimit || TRIAL_MESSAGE_LIMIT) + ' messages sent · ' + trialMessagesLeft(trial) + ' left.';
}
/* The trial banner shown in demo mode (not locked). Trial counts only —
   never customer data. */
function trialBannerHTML() {
  if (!demoMode) return '';
  if (!trial) {
    if (trialLoadError) return '<div class="notice">⏳ <b>DEMO — trial</b> · Trial status could not be checked — the demo is running without limits for now.</div>';
    return '<div class="notice">⏳ <b>DEMO — trial</b> · Trial status loading… this demo allows 5 messages over 3 days.</div>';
  }
  var days = trialDaysLeft(trial, Date.now());
  return '<div class="notice">⏳ <b>DEMO — trial</b> · ' + trialMessagesLeft(trial) + ' of ' + (trial.messageLimit || TRIAL_MESSAGE_LIMIT) + ' messages left · ' + days + ' day' + (days === 1 ? '' : 's') + ' left. When the trial ends the app locks — contact Amit to continue.</div>';
}
/* The lock screen: shown instead of the whole app when the demo trial
   has ended. No customer data of any kind on it. The "Check again"
   button reloads the page (re-reads the trial doc), so the app opens
   again once Amit has reset the trial. */
function trialLockHTML() {
  return '<div class="card" style="max-width:520px;margin:30px auto;text-align:center">' +
    '<h2 style="margin-top:0">⏰ Demo trial ended</h2>' +
    '<p>This demo of the SH Enterprise Solar app allowed 5 messages over 3 days. The trial has now ended.</p>' +
    '<p>To keep using the app, please contact Amit to continue.</p>' +
    '<p class="sub">SH Enterprise (Green Energy) · Kalpanagar, Goalpara</p>' +
    '<div class="btnrow" style="justify-content:center"><button class="secondary" onclick="location.reload()">↻ Check again</button></div></div>';
}

/* ---- pure helpers ---- */
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fmtINR(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }
function inr(n) { return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || 'Friend'; }
/* ---- festival occasions ---- */
var msgOccasionId = null;   /* selected occasion id; null = next upcoming */
/* Validate an occasions list; fall back to the built-in list when it is
   missing, empty or malformed. Always returns a fresh copy. */
function normalizeOccasions(list) {
  if (Array.isArray(list) && list.length) {
    var out = [];
    list.forEach(function (o) {
      if (!o || !o.name) return;
      var id = String(o.id || o.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'occasion';
      out.push({
        id: id,
        name: String(o.name),
        nameAs: String(o.nameAs || o.name),
        date: String(o.date || ''),
        en: String(o.en || ('Happy ' + o.name + '!')),
        as: String(o.as || ((o.nameAs || o.name) + 'ৰ শুভেচ্ছা!'))
      });
    });
    if (out.length) return out;
  }
  return JSON.parse(JSON.stringify(DEFAULT_OCCASIONS));
}
/* Occasions sorted by date (earliest first). */
function sortedOccasions() {
  var list = normalizeOccasions((meta.settings && meta.settings.occasions) || DEFAULT_OCCASIONS);
  list.sort(function (a, b) { return (a.date || '9999').localeCompare(b.date || '9999'); });
  return list;
}
/* The next upcoming occasion (first with date >= today); if all are past, the earliest. */
function nextOccasion() {
  var list = sortedOccasions();
  if (!list.length) return null;
  var today = new Date().toISOString().slice(0, 10);
  for (var i = 0; i < list.length; i++) {
    if ((list[i].date || '') >= today) return list[i];
  }
  return list[0];
}
function currentOccasion() {
  var list = sortedOccasions();
  if (!list.length) return null;
  if (msgOccasionId) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === msgOccasionId) return list[i];
    }
  }
  return nextOccasion();
}
function setMsgOccasion(id) { msgOccasionId = id; }
function occasionName(lang) {
  var o = currentOccasion();
  if (!o) return '';
  return lang === 'as' ? o.nameAs : o.name;
}
function occasionGreeting(lang) {
  var o = currentOccasion();
  if (!o) return '';
  return lang === 'as' ? o.as : o.en;
}
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
/* ---- refer codes: short, sayable codes ("SH" + 4 chars, no look-alike
   letters/digits) for customers to share with friends. The reward-link
   code (doc id, 8 random chars) is too unfriendly to dictate, so the
   refer code is a separate stored field, unique across customers. */
var REFER_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function makeReferCode(taken) {
  taken = taken || {};
  var code;
  do {
    code = 'SH';
    for (var i = 0; i < 4; i++) code += REFER_CODE_CHARS[Math.floor(Math.random() * REFER_CODE_CHARS.length)];
  } while (taken[code]);
  return code;
}
/* Find a customer by refer code (case-insensitive). Pass a list to
   search that list; otherwise searches the loaded customers. */
function customerByReferCode(code, list) {
  if (!code) return null;
  var norm = String(code).trim().toUpperCase();
  var pool = list || customers;
  return pool.find(function (c) { return (c.referCode || '').toUpperCase() === norm; }) || null;
}
/* Map of refer codes already in use (for generating a unique new one). */
function referCodeTaken() {
  var taken = {};
  customers.forEach(function (c) { if (c.referCode) taken[String(c.referCode).toUpperCase()] = true; });
  return taken;
}
/* One entry of a referrer's stored referred-list: first name + consumer
   no. ONLY — never a mobile. The public reward page can only read a
   single doc, so it reads this list instead of querying all customers. */
/* A friend on a referrer's stored list. `stage` is the referral
   journey state the customer reward page can read (the public page can
   only read its own customer doc, never the referrals collection):
   signedUp (friend is a customer) -> solar (vendor confirmed the
   friend got solar) -> rewarded (the tier reward was given). Entries
   written before stages existed read as signedUp. */
function referredEntry(c, stage) { return { name: firstName(c.name), consumerNo: c.consumerNo, stage: stage || 'signedUp' }; }
function referredStage(x) { return (x && x.stage) || 'signedUp'; }
/* Keep each referrer's stored referred-list in sync after a customer's
   referredBy changes (old referrer loses the entry, new one gains it). */
function syncReferrerLists(c, oldReferredBy) {
  var jobs = [];
  var newRef = c.referredBy ? customerById(c.referredBy) : null;
  var oldRef = oldReferredBy ? customerById(oldReferredBy) : null;
  if (oldRef && (!newRef || oldRef.id !== newRef.id)) {
    oldRef.referred = (oldRef.referred || []).filter(function (x) { return x.consumerNo !== c.consumerNo; });
    jobs.push(activeDB.saveCustomer(oldRef));
  }
  if (newRef && newRef.id !== c.id) {
    var list = (newRef.referred || []).slice();
    if (!list.some(function (x) { return x.consumerNo === c.consumerNo; })) list.push(referredEntry(c, stageForNewEntry(newRef, c)));
    newRef.referred = list;
    jobs.push(activeDB.saveCustomer(newRef));
  }
  return Promise.all(jobs);
}
/* Stage for a friend being added to a referrer's list: if the vendor
   already confirmed that friend's referral (the friend got solar), the
   entry starts at "solar" instead of "signed up". Needs the referrals
   list loaded; before it loads this safely returns "signed up". */
function stageForNewEntry(referrer, c) {
  if (!referrer || !referrals || !referrals.length) return 'signedUp';
  var confirmed = referrals.some(function (r) {
    return r.status === 'confirmed' && String(r.referCode || '').toUpperCase() === String(referrer.referCode || '').toUpperCase() && normMobileDigits(r.referredMobile) === normMobileDigits(c.mobile);
  });
  return confirmed ? 'solar' : 'signedUp';
}

/* ---- referral submissions (public form -> referrals collection) ---- */
/* Mobile normalisation, kept in sync with refer-form.js (the public
   form uses the same rule): strip non-digits, drop a leading 91. */
function normMobileDigits(s) {
  var d = String(s || '').replace(/\D/g, '');
  if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
  return d;
}
/* Link a referral submission to the people it involves: the referrer
   (by refer code) and the referred friend (by mobile, if they are a
   customer yet). Returns { referrer, referred } with nulls when not found. */
function findReferralLink(ref, list) {
  list = list || customers || [];
  var referrer = ref.referCode ? customerByReferCode(ref.referCode, list) : null;
  var rm = normMobileDigits(ref.referredMobile);
  var referred = rm ? list.find(function (x) { return normMobileDigits(x.mobile) === rm; }) : null;
  return { referrer: referrer || null, referred: referred || null };
}
/* Referral journey: 1 Invited -> 2 Friend signed up -> 3 Friend got
   solar -> 4 Reward earned. The reward is earned only at the confirmed
   stage. `confirmedIndex` is this referral's 1-based position among
   the referrer's confirmed referrals, oldest first (0 when not
   confirmed); the k-th confirmed referral unlocked tier min(3, k), and
   its reward counts as earned once the referrer has been given at
   least that many rewards. Returns { done, linked, referrer, referred }. */
function journeyForReferral(ref, list, referrer, confirmedIndex) {
  var link = findReferralLink(ref, list);
  var done = 1;
  if (link.referred) done = 2;
  if (ref.status === 'confirmed') done = 3;
  if (ref.status === 'confirmed' && confirmedIndex > 0) {
    var unlocked = Math.min(3, confirmedIndex);
    var given = (referrer && referrer.rewards ? referrer.rewards.length : 0);
    if (given >= unlocked) done = 4;
  }
  return { done: done, linked: !!link.referred, referrer: link.referrer, referred: link.referred };
}
/* The four journey steps as a strip: done steps green, the next step
   outlined. Used by the vendor referral list and the reward page. */
function journeyStepsHTML(done) {
  var labels = ['Invited', 'Signed up', 'Got solar', 'Reward earned'];
  return '<div class="steps">' + labels.map(function (l, i) {
    var n = i + 1;
    return '<div class="step' + (n <= done ? ' done' : n === done + 1 ? ' now' : '') + '">' + (n <= done ? '✓ ' : '') + l + '</div>';
  }).join('') + '</div>';
}
/* Link to the public referral form with this customer's code prefilled
   — this is the link friends open to submit their details. */
function referralFormLink(code) {
  if (typeof location !== 'undefined' && location.href) {
    var base = location.href.split('?')[0].split('#')[0].replace(/index\.html$/, '');
    if (base.slice(-1) !== '/') base += '/';
    return base + 'refer.html?ref=' + encodeURIComponent(code || '');
  }
  return 'refer.html?ref=' + encodeURIComponent(code || '');
}
/* The message a customer shares with a friend: their code, the offer
   poster, and — for WhatsApp — the referral form link (the friend
   opens it, the code is prefilled, they submit their details). The
   native share sheet gets the form link as the shared URL instead, so
   it is not duplicated in the text. Bilingual (English + Assamese),
   like the vendor message templates. No subsidy figure, no APDCL, no
   install total — advertising rules. */
function referralShareText(code, first, includeFormLink) {
  var en = 'Hi! I\'m ' + first + ' — I got rooftop solar for my home from SH Enterprise (Green Energy), Kalpanagar, Goalpara — and honestly, the care is what stood out. They didn\'t just install the panels and leave. They handled everything: installation, paperwork, the subsidy process, and after-care, so I never had to chase anyone. They have their own office in Kalpanagar, near Kalpana Cinema Hall, and they\'ve installed solar across 13 sub-divisions and many more places — so you\'re dealing with a team that\'s actually here. If you\'re thinking of going solar, use my refer code ' + code + ' when you contact them — you\'ll get a special discount as a friend of mine. See the offer: ' + POSTER_SHORT_URL + '.';
  var as = 'নমস্কাৰ! মই ' + first + ' — মই মোৰ ঘৰৰ বাবে SH Enterprise (Green Energy), কল্পনানগৰ, গোৱালপাৰাৰ পৰা ছোলাৰ লৈছোঁ। আটাইতকৈ ভাল লগা কথাটো হ\'ল — তেওঁলোকে কেৱল পেনেল লগাই থৈ যোৱা নাই। ইনষ্টলেচন, কাগজ-পত্ৰ, চাবচিডি প্ৰক্ৰিয়া আৰু পিছৰ সেৱা — সকলোৰে যত্ন লৈছে। তেওঁলোকৰ নিজা কাৰ্যালয় কল্পনানগৰত, কল্পনা চিনেমা হলৰ ওচৰত, আৰু তেওঁলোকে 13 টা মহকুমাত আৰু বহুতো ঠাইত ছোলাৰ লগাইছে — আপুনি ইয়াতে থকা দল এটাৰ লগত কথা পাতিছে। আপুনি ছোলাৰ ল\'ব বিচাৰিলে মোৰ ৰেফাৰ ক\'ড ' + code + ' ব্যৱহাৰ কৰি যোগাযোগ কৰক — মোৰ বন্ধু হিচাপে বিশেষ ৰেহাই পাব। অফাৰটো চাওক: ' + POSTER_SHORT_URL + '।';
  if (includeFormLink) {
    en += ' Send your details here and they\'ll take it from there: ' + referralFormLink(code);
    as += ' আপোনাৰ তথ্য ইয়াত পঠিয়াওক: ' + referralFormLink(code);
  } else {
    en += ' Send your details on the link I\'m sharing and they\'ll take it from there.';
    as += ' মই শ্বেয়াৰ কৰা লিংকত আপোনাৰ তথ্য পঠিয়াওক।';
  }
  return en + '\n\n' + as;
}
/* How far a customer is along the referral journey, from what the
   public page can read (their own doc only): the furthest stage any
   friend they brought has reached. 0 = nothing yet. */
function publicJourneyDone(c) {
  var done = 0;
  (c.referred || []).forEach(function (x) {
    var st = referredStage(x);
    var idx = st === 'rewarded' ? 4 : st === 'solar' ? 3 : 2;
    if (idx > done) done = idx;
  });
  return done;
}
/* The referrer's confirmed referrals, oldest first — used to work out
   which tier each confirmation unlocked. */
function confirmedReferralsFor(code, list) {
  if (!code) return [];
  return (list || referrals || []).filter(function (r) {
    return String(r.referCode || '').toUpperCase() === String(code).toUpperCase() && r.status === 'confirmed';
  }).sort(function (a, b) { return String(a.confirmedAt || a.submittedAt || '').localeCompare(String(b.confirmedAt || b.submittedAt || '')); });
}
/* What confirming a referral does (pure part, tested in Node): mark it
   confirmed, and if the referred friend is already a customer with no
   referrer yet, link them to the referrer — which is what credits the
   referrer's referral count (the count is computed live from customers'
   referredBy). Returns { referral, customerToSave }. The caller saves
   both, syncs the referrer lists and refreshes. */
function applyReferralConfirm(r, list) {
  var link = findReferralLink(r, list);
  r.status = 'confirmed';
  r.confirmedAt = new Date().toISOString();
  var toSave = null;
  if (link.referred) {
    r.referredCustomerId = link.referred.id;
    if (link.referrer && !link.referred.referredBy) {
      link.referred.referredBy = link.referrer.id;
      toSave = link.referred;
    }
  }
  return { referral: r, customerToSave: toSave };
}
/* Heal stored journey stages after the referrals load (runs once per
   login, only writes when a stage is actually stale): a friend whose
   referral is confirmed reads "solar" on the referrer's list, and
   "rewarded" once the tier reward for that confirmation was given. */
function healReferralStages() {
  if (activeDB.mode !== 'firestore' || !referrals || !referrals.length) return Promise.resolve();
  var jobs = [];
  customers.forEach(function (ref) {
    var changed = false;
    (ref.referred || []).forEach(function (entry) {
      var friend = customers.find(function (x) { return x.consumerNo === entry.consumerNo; });
      if (!friend) return;
      var rel = referrals.find(function (r) {
        return r.status === 'confirmed' && String(r.referCode || '').toUpperCase() === String(ref.referCode || '').toUpperCase() && normMobileDigits(r.referredMobile) === normMobileDigits(friend.mobile);
      });
      if (!rel) return;
      var idx = confirmedReferralsFor(ref.referCode, referrals).findIndex(function (x) { return x.id === rel.id; }) + 1;
      var j = journeyForReferral(rel, customers, ref, idx);
      var want = j.done >= 4 ? 'rewarded' : 'solar';
      if (referredStage(entry) !== want && referredStage(entry) !== 'rewarded') { entry.stage = want; changed = true; }
    });
    if (changed) jobs.push(activeDB.saveCustomer(ref));
  });
  return Promise.all(jobs);
}
/* Rebuild every referrer's stored referred-list from the loaded list
   (one Firestore batch in the real app). Runs once per session after
   customers load; later calls are a no-op. */
var referrerListsEnsured = false;
function ensureReferrerLists(list) {
  if (referrerListsEnsured) return Promise.resolve(list);
  referrerListsEnsured = true;
  var byRef = {};
  list.forEach(function (x) {
    if (!x.referredBy) return;
    /* Preserve a stored journey stage when rebuilding a list — the
       rebuild must not wipe a friend back to "signed up". */
    var referrer = list.find(function (r) { return r.id === x.referredBy; });
    var oldEntry = referrer ? (referrer.referred || []).find(function (e) { return e.consumerNo === x.consumerNo; }) : null;
    (byRef[x.referredBy] = byRef[x.referredBy] || []).push(referredEntry(x, oldEntry && oldEntry.stage));
  });
  var stale = list.filter(function (x) {
    return JSON.stringify(x.referred || []) !== JSON.stringify(byRef[x.id] || []);
  });
  if (!stale.length) return Promise.resolve(list);
  stale.forEach(function (x) { x.referred = byRef[x.id] || []; });
  if (activeDB.mode === 'firestore' && typeof db !== 'undefined' && db) {
    var batch = db.batch();
    stale.forEach(function (x) { batch.set(db.collection('customers').doc(x.id), { referred: x.referred }, { merge: true }); });
    return batch.commit().then(function () { return list; }).catch(function () { return list; });
  }
  return Promise.resolve(list);
}
/* Give every customer without one a unique refer code, and save the new
   codes back (one Firestore batch in the real app). Runs once per
   session after customers load; later calls are a no-op. */
var referCodesEnsured = false;
function ensureReferCodes(list) {
  if (referCodesEnsured) return Promise.resolve(list);
  referCodesEnsured = true;
  var taken = referCodeTaken();
  var missing = list.filter(function (c) { return !c.referCode; });
  if (!missing.length) return Promise.resolve(list);
  missing.forEach(function (c) {
    c.referCode = makeReferCode(taken);
    taken[c.referCode] = true;
  });
  if (activeDB.mode === 'firestore' && typeof db !== 'undefined' && db) {
    var batch = db.batch();
    missing.forEach(function (c) { batch.set(db.collection('customers').doc(c.id), { referCode: c.referCode }, { merge: true }); });
    return batch.commit().then(function () { return list; }).catch(function () { return list; });
  }
  return Promise.resolve(list);
}
/* Give one customer (e.g. on their public reward page) a unique refer
   code, checking Firestore for a collision first. */
function ensureCustomerReferCode(c) {
  if (!c || c.referCode) return Promise.resolve(c);
  if (activeDB.mode === 'firestore' && typeof db !== 'undefined' && db) {
    var code = makeReferCode({});
    return db.collection('customers').where('referCode', '==', code).get().then(function (snap) {
      if (!snap.empty) return ensureCustomerReferCode(c); /* collision — retry */
      c.referCode = code;
      return db.collection('customers').doc(c.id).set({ referCode: code }, { merge: true }).then(function () { return c; });
    }).catch(function () { c.referCode = code; return c; });
  }
  c.referCode = makeReferCode({});
  return Promise.resolve(c);
}
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
/* ---- sent tracking: the app only knows the vendor tapped to send
   (WhatsApp/SMS open an external app), so "sent" means tapped, not
   delivered — the UI says so wherever it shows it. */
function recordSent(c, channel, templateKey, style) {
  if (!c) return Promise.resolve();
  /* A vendor message going out counts against the demo trial (demo mode
     only — this is a no-op in normal use). The app can't see whether
     WhatsApp/SMS actually delivered it, so the tap counts as sent. */
  trialRecordShare();
  var now = new Date().toISOString();
  c.lastSentAt = now;
  c.lastSentChannel = channel;
  c.lastSentTemplate = templateKey || '';
  c.lastSentStyle = style || '';
  c.sentCount = (c.sentCount || 0) + 1;
  var log = (c.sentLog || []).slice();
  log.unshift({ at: now, channel: channel, template: templateKey || '', style: style || '' });
  c.sentLog = log.slice(0, 10);
  return activeDB.saveCustomer(c).then(function () { return refreshCustomers(); });
}
function sentLabel(c) {
  if (!c || !c.lastSentAt) return '';
  var d = new Date(c.lastSentAt);
  if (isNaN(d.getTime())) return '';
  var date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  var time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return '✅ Sent ' + date + ', ' + time + ' via ' + (c.lastSentChannel || 'message');
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
  /* The refer code must never render empty: the message IS the customer
     sharing it. The login backfill normally gives every customer a code,
     but a message can be built before it runs — so generate one here the
     same way (unique against the loaded list) and save it back in the
     background so the next message shows the same code. Demo/sample ids
     are skipped: they never reach Firestore. */
  var refCode = c.referCode;
  if (!refCode) {
    refCode = makeReferCode(referCodeTaken());
    c.referCode = refCode;
    if (c.id && c.id.indexOf('demo-') !== 0 && c.id.indexOf('smp-') !== 0 && typeof activeDB !== 'undefined' && activeDB && activeDB.saveCustomer) {
      try { activeDB.saveCustomer(c); } catch (e) {}
    }
  }
  return text
    .replace(/\{name\}/g, firstName(c.name))
    .replace(/\{months\}/g, monthsText(m, lang))
    .replace(/\{count\}/g, String(referralCount(c.id)))
    .replace(/\{kw\}/g, String(c.systemKw == null ? '' : c.systemKw))
    .replace(/\{link\}/g, rewardLink(c))
    .replace(/\{poster\}/g, (meta.settings && meta.settings.posterUrl) || DEFAULT_SETTINGS.posterUrl)
    .replace(/\{occasion\}/g, occasionName(lang))
    .replace(/\{greeting\}/g, occasionGreeting(lang))
    .replace(/\{referCode\}/g, refCode);
}
function buildMessage(key, c, style) {
  var t = (style === 'funny')
    ? ((meta.funnyTemplates && meta.funnyTemplates[key]) || FUNNY_TEMPLATES[key] || DEFAULT_TEMPLATES[key])
    : ((meta.templates && meta.templates[key]) || DEFAULT_TEMPLATES[key]);
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
    if (f.sent === 'sent' && !c.lastSentAt) return false;
    if (f.sent === 'notsent' && c.lastSentAt) return false;
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
    rewards: c.rewards || [],
    referCode: c.referCode || '',
    referred: c.referred || [],
    lastSentAt: c.lastSentAt || '', lastSentChannel: c.lastSentChannel || '',
    lastSentTemplate: c.lastSentTemplate || '', lastSentStyle: c.lastSentStyle || '',
    sentCount: +c.sentCount || 0, sentLog: (c.sentLog || []).slice(0, 10)
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
    rewards: d.rewards || [],
    referCode: d.referCode || '',
    referred: d.referred || [],
    lastSentAt: d.lastSentAt || '', lastSentChannel: d.lastSentChannel || '',
    lastSentTemplate: d.lastSentTemplate || '', lastSentStyle: d.lastSentStyle || '',
    sentCount: +d.sentCount || 0, sentLog: d.sentLog || []
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
    if (!c.referCode) c.referCode = makeReferCode(referCodeTaken());
    var i = list.findIndex(function (x) { return x.id === c.id; });
    if (i >= 0) list[i] = c; else list.push(c);
    store.save(SAMPLE_LS_KEY, list);
    return Promise.resolve(c);
  },
  /* Referral submissions: the sample preview has none. */
  listReferrals: function () { return Promise.resolve([]); },
  saveReferral: function (r) { return Promise.resolve(r); },
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
        var c = { id: 'smp-' + newCode(), code: newCode(), consumerNo: row.consumerNo, name: row.name, mobile: row.mobile, address: row.address || '', area: row.area || 'Goalpara', installDate: row.installDate || '', submittedOn: row.submittedOn || '', systemKw: row.systemKw || 0, status: row.status || 'Upload Agreement (Pending)', applicationNo: row.applicationNo || '', subDivision: row.subDivision || '', duplicate: !!row.duplicate, reverification: !!row.reverification, referredBy: null, referralCount: 0, rewards: [], referCode: makeReferCode(referCodeTaken()) };
        list.push(c); byConsumer[c.consumerNo] = c; added++;
      }
    });
    parsed.rows.forEach(function (row) {
      if (!row.referredByConsumerNo) return;
      var t = byConsumer[row.consumerNo], r = byConsumer[row.referredByConsumerNo];
      if (t && r && t.id !== r.id) t.referredBy = r.id;
    });
    /* rebuild each referrer's stored referred-list from the resolved links */
    var byRef = {};
    list.forEach(function (x) { if (x.referredBy) { (byRef[x.referredBy] = byRef[x.referredBy] || []).push(referredEntry(x)); } });
    list.forEach(function (x) { x.referred = byRef[x.id] || []; });
    store.save(SAMPLE_LS_KEY, list);
    return Promise.resolve({ added: added, updated: updated });
  },
  loadMeta: function () {
    var stored = store.load(LS_KEY);
    if (!stored) return Promise.resolve(defaultMeta());
    var storedVersion = stored.templatesVersion || 0;
    if (storedVersion < TEMPLATES_VERSION) {
      /* Templates were rewritten in v5 (festival/referral/anniversary
         messages now print the customer's refer code and reward link).
         Stored old templates would override the new defaults —
         replace them wholesale and save the upgrade back so the next
         load already has v5. The replace must be wholesale, not a
         merge: a merge would keep stale keys (e.g. the old "puja"
         key) inside the stored template maps. */
      var upgradedSettings = Object.assign({}, DEFAULT_SETTINGS, stored.settings || {});
      if (upgradedSettings.offerTitle === OLD_OFFER_TITLE) upgradedSettings.offerTitle = DEFAULT_SETTINGS.offerTitle;
      if (upgradedSettings.offerText === OLD_OFFER_TEXT || upgradedSettings.offerText === OLD_OFFER_TEXT_V3) upgradedSettings.offerText = DEFAULT_SETTINGS.offerText;
      upgradedSettings.geminiModel = GEMINI_MODEL_ID;
      if (upgradedSettings.posterUrl === OLD_POSTER_URL) upgradedSettings.posterUrl = POSTER_SHORT_URL;
      upgradedSettings.occasions = normalizeOccasions(upgradedSettings.occasions);
      var upgraded = {
        settings: upgradedSettings,
        templates: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)),
        funnyTemplates: JSON.parse(JSON.stringify(FUNNY_TEMPLATES)),
        templatesVersion: TEMPLATES_VERSION
      };
      store.save(LS_KEY, upgraded);
      return Promise.resolve(upgraded);
    }
    stored.settings = Object.assign({}, DEFAULT_SETTINGS, stored.settings || {});
    var pruned = pruneStoredTemplates(stored.templates, stored.funnyTemplates);
    stored.templates = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)), pruned.templates);
    stored.funnyTemplates = Object.assign({}, JSON.parse(JSON.stringify(FUNNY_TEMPLATES)), pruned.funnyTemplates);
    /* The model is locked and the poster link is the short link — force
       any stored value that still differs, and save back once. */
    var needsSave = false;
    if (stored.settings.geminiModel !== GEMINI_MODEL_ID) { stored.settings.geminiModel = GEMINI_MODEL_ID; needsSave = true; }
    if (stored.settings.posterUrl === OLD_POSTER_URL) { stored.settings.posterUrl = POSTER_SHORT_URL; needsSave = true; }
    stored.settings.occasions = normalizeOccasions(stored.settings.occasions);
    if (needsSave) store.save(LS_KEY, stored);
    return Promise.resolve(stored);
  },
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
    if (!c.referCode) c.referCode = makeReferCode(referCodeTaken());
    return db.collection('customers').doc(c.id).set(toFirestore(c), { merge: true }).then(function () { return c; });
  },
  /* Referral submissions: newest first. The vendor list reads them;
     the public form only ever writes (rules: public create, vendor read). */
  listReferrals: function () {
    return db.collection('referrals').get().then(function (snap) {
      var list = [];
      snap.forEach(function (doc) { var d = doc.data(); d.id = doc.id; list.push(d); });
      list.sort(function (a, b) { return String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')); });
      return list;
    });
  },
  saveReferral: function (r) {
    return db.collection('referrals').doc(r.id).set({
      referrerName: r.referrerName || '', referrerConsumerNo: r.referrerConsumerNo || '',
      referrerMobile: r.referrerMobile || '', referrerAddress: r.referrerAddress || '',
      referredName: r.referredName || '', referredMobile: r.referredMobile || '',
      referredAddress: r.referredAddress || '', referCode: r.referCode || '',
      status: r.status || 'pending', submittedBy: r.submittedBy || 'referrer',
      submittedAt: r.submittedAt || '', confirmedAt: r.confirmedAt || '',
      referredCustomerId: r.referredCustomerId || ''
    }, { merge: true }).then(function () { return r; });
  },
  importRows: function (parsed) {
    var self = this;
    return self.listCustomers().then(function (existing) {
      var byConsumer = {};
      existing.forEach(function (x) { byConsumer[x.consumerNo] = x; });
      var takenCodes = {};
      existing.forEach(function (x) { if (x.referCode) takenCodes[String(x.referCode).toUpperCase()] = true; });
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
            var c = { id: id, code: id, consumerNo: row.consumerNo, name: row.name, mobile: row.mobile, address: row.address || '', area: row.area || 'Goalpara', installDate: row.installDate || '', submittedOn: row.submittedOn || '', systemKw: row.systemKw || 0, status: row.status || 'Upload Agreement (Pending)', applicationNo: row.applicationNo || '', subDivision: row.subDivision || '', duplicate: !!row.duplicate, reverification: !!row.reverification, referredBy: null, referralCount: 0, rewards: [], referCode: makeReferCode(takenCodes) };
            takenCodes[c.referCode] = true;
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
        /* rebuild each referrer's stored referred-list from the resolved links */
        var byRef = {};
        list.forEach(function (x) { if (x.referredBy) { (byRef[x.referredBy] = byRef[x.referredBy] || []).push(referredEntry(x)); } });
        list.forEach(function (x) {
          var wantList = byRef[x.id] || [];
          if (JSON.stringify(x.referred || []) !== JSON.stringify(wantList)) { b2.update(db.collection('customers').doc(x.id), { referred: wantList }); n++; }
        });
        return n ? b2.commit() : Promise.resolve();
      }).then(function () { return { added: added, updated: updated }; });
    });
  },
  loadMeta: function () {
    return db.collection('meta').doc('settings').get().then(function (doc) {
      if (!doc.exists) return defaultMeta();
      var d = doc.data();
      var settings = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
      /* The model is locked and the poster link is the short link —
         force any stored value that still differs. The upgrade branch
         below saves it back; the normal path saves it back when it
         changed, so the next login already has it. */
      var rawModel = settings.geminiModel;
      settings.geminiModel = GEMINI_MODEL_ID;
      var modelFixed = settings.geminiModel !== rawModel;
      var rawPoster = settings.posterUrl;
      if (rawPoster === OLD_POSTER_URL) settings.posterUrl = POSTER_SHORT_URL;
      var posterFixed = settings.posterUrl !== rawPoster;
      settings.occasions = normalizeOccasions(settings.occasions);
      var storedVersion = d.templatesVersion || 0;
      if (storedVersion < TEMPLATES_VERSION) {
        /* Templates were rewritten in v5 (festival/referral/anniversary
           messages now print the customer's refer code and reward link).
           The stored doc still holds the old wording, and it overrides
           the new defaults — replace it and save the upgrade back so
           the next login already has v5. The write below is a FULL set,
           NOT a merge: Firestore merge merges map keys, so the v4
           upgrade's merged write kept the old "puja" key alive inside
           the stored templates map (the banner upgraded, the templates
           did not). A full set replaces the doc, so stale keys are
           actually deleted. The doc only holds the four fields this
           file manages. No human has edited templates yet, so nothing
           deliberate is lost. */
        if (settings.offerTitle === OLD_OFFER_TITLE) settings.offerTitle = DEFAULT_SETTINGS.offerTitle;
        if (settings.offerText === OLD_OFFER_TEXT || settings.offerText === OLD_OFFER_TEXT_V3) settings.offerText = DEFAULT_SETTINGS.offerText;
        var upgraded = {
          settings: settings,
          templates: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)),
          funnyTemplates: JSON.parse(JSON.stringify(FUNNY_TEMPLATES)),
          templatesVersion: TEMPLATES_VERSION
        };
        return db.collection('meta').doc('settings').set(upgraded).then(function () { return upgraded; });
      }
      var pruned = pruneStoredTemplates(d.templates, d.funnyTemplates);
      var result = {
        settings: settings,
        templates: Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)), pruned.templates),
        funnyTemplates: Object.assign({}, JSON.parse(JSON.stringify(FUNNY_TEMPLATES)), pruned.funnyTemplates),
        templatesVersion: storedVersion
      };
      if (!modelFixed && !posterFixed) return result;
      return db.collection('meta').doc('settings').set({ settings: settings }, { merge: true }).then(function () { return result; });
    });
  },
  saveMeta: function (m) {
    /* Full set, NOT a merge: saveMeta always writes all four fields,
       and a merge would keep stale template keys (e.g. "puja") alive
       in the stored maps. The doc only holds these four fields. */
    return db.collection('meta').doc('settings').set({ settings: m.settings, templates: m.templates, funnyTemplates: m.funnyTemplates || JSON.parse(JSON.stringify(FUNNY_TEMPLATES)), templatesVersion: m.templatesVersion || TEMPLATES_VERSION });
  }
};

var activeDB = SampleDB;
function refreshCustomers() {
  return activeDB.listCustomers().then(function (list) {
    customers = list;
    return ensureReferCodes(list).then(ensureReferrerLists);
  });
}
/* Load the vendor's referral submissions. A failure (e.g. the new
   Firestore rules for `referrals` not published yet) leaves an empty
   list and sets the flag the Rewards tab shows — it never breaks login. */
function refreshReferrals() {
  return activeDB.listReferrals().then(function (list) {
    referrals = list;
    referralsLoadError = false;
    return list;
  }).catch(function () {
    referrals = [];
    referralsLoadError = true;
    return referrals;
  });
}
function refreshMeta() {
  return activeDB.loadMeta().then(function (m) { meta = m; return m; });
}

/* ===================== UI (browser only) ===================== */
if (typeof document !== 'undefined') {
  var view = null, tabs = null;
  /* PWA install: capture the browser's install prompt so Settings can
     show an "Install app" button. iOS has no such event — Settings
     shows the Share → Add to Home Screen hint instead. */
  var deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
  });
  window.installApp = function () {
    if (!deferredInstallPrompt) { alert('Install is not available yet — open this site in Chrome on Android, then try again from Settings. On iPhone, use Share → Add to Home Screen.'); return; }
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(function () { deferredInstallPrompt = null; });
  };
  var NAV = [
    ['#messages', '💬 Messages'], ['#reminders', '⏰ Reminders'], ['#dashboard', '📊 Dashboard'],
    ['#customers', '👥 Customers'], ['#quote', '🧾 Make a quote'],
    ['#rewards', '🎁 Rewards'], ['#settings', '⚙️ Settings']
  ];
  var listState = { q: '', status: '', subDiv: '', kw: '', sent: '', sort: 'submitted-desc' };
  var msgKey = 'festival';
  var msgStyle = 'regular';   /* 'regular' | 'funny' — Messages tab + customer page */
  var msgAI = null;           /* Gemini-personalized message {en, as, combined} or null */
  var msgAIStatus = null;     /* inline status line for the AI button (never alert()) */
  /* Messages tab state: which template, which customer, search, disbursed-only filter. */
  var msgCustomerId = null;
  var msgSearch = '';
  var msgOnlyDisbursed = false;
  var refFilter = 'pending'; // Rewards tab: which referral submissions to show
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
     to hide it. The bumper offer is the referral reward plus the care
     angle — the subsidy figure is never in it. The vendor replaces it
     with his real offer. */
  function offerBannerHTML() {
    var o = meta.settings;
    if (!o.offerTitle && !o.offerText) return '';
    var valid = o.offerValidTill ? ' · Valid till ' + esc(fmtDate(o.offerValidTill)) : '';
    return '<div class="offer-banner"><div class="offer-title">' + esc(o.offerTitle) + '</div>' +
      '<div class="offer-text">' + esc(o.offerText) + valid + '</div></div>';
  }
  /* Hint under every SMS button: the sms: prefill works in Google
     Messages, but SMS Organizer and Truecaller do not support it — the
     vendor should switch the default SMS app to Google Messages. */
  function smsHint() {
    return '<p class="sub sms-hint">📱 Works best with Google Messages — if your SMS app opens without the number and message, switch your default SMS app to Google Messages.</p>';
  }
  function renderTabs(active) {
    tabs.innerHTML = NAV.map(function (n) {
      return '<a href="' + n[0] + '" class="' + (active === n[0] ? 'active' : '') + '">' + n[1] + '</a>';
    }).join('') + '<a href="#logout" style="margin-left:auto">Log out (' + esc((auth && auth.currentUser && auth.currentUser.email) || 'vendor') + ')</a>';
    tabs.style.display = 'flex';
  }
  function renderTrialLock() {
    view.innerHTML = trialLockHTML();
  }
  /* Prepend the trial banner to the current view (demo mode only). */
  function prependTrialBanner() {
    if (!demoMode || !view) return;
    view.insertAdjacentHTML('afterbegin', trialBannerHTML());
  }
  function route() {
    /* Demo trial ended: the whole site locks — no view, no data. */
    if (demoMode && trialLocked()) { tabs.style.display = 'none'; renderTrialLock(); return; }
    var code = publicCode();
    if (code) { tabs.style.display = 'none'; renderPublic(code); return; }
    if (!authed) { tabs.style.display = 'none'; renderLoggedOut(); return; }
    var h = location.hash || '#messages';
    if (h === '#logout') { doLogout(); return; }
    if (h.indexOf('#customer-') === 0) { renderTabs('#customers'); renderCustomer(h.slice('#customer-'.length)); prependTrialBanner(); return; }
    renderTabs(h.split('?')[0]);
    if (h === '#messages') renderMessages();
    else if (h === '#reminders') renderReminders();
    else if (h === '#sent') renderSentList();
    else if (h === '#customers') renderCustomers();
    else if (h === '#quote') renderQuote();
    else if (h === '#rewards') renderRewards();
    else if (h === '#settings') renderSettings();
    else renderDashboard();
    prependTrialBanner();
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
    view.innerHTML = trialBannerHTML() +
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
      (sentLabel(c) ? '<div class="cust-row"><span style="color:var(--muted);font-size:12.5px">' + esc(sentLabel(c)) + '</span></div>' : '') +
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
    if (!trialAllowShare()) { route(); return; }
    var msg = buildReminder(c);
    if (!msg) return;
    var old = btn ? btn.textContent : '';
    if (btn) { btn.textContent = 'Opening WhatsApp…'; }
    window.open(waLink(c, msg.combined), '_blank');
    setTimeout(function () { if (btn) btn.textContent = old; }, 2000);
    recordSent(c, 'WhatsApp', REMINDER_BY_STAGE[c.status], 'regular').then(function () { route(); });
  };
  window.remindSms = function (id, btn) {
    var c = customerById(id);
    if (!c) return;
    if (!trialAllowShare()) { route(); return; }
    var msg = buildReminder(c);
    if (!msg) return;
    var old = btn ? btn.textContent : '';
    if (btn) { btn.textContent = 'Opening SMS…'; }
    openSms(c, msg.combined);
    setTimeout(function () { if (btn) btn.textContent = old; }, 2000);
    recordSent(c, 'SMS', REMINDER_BY_STAGE[c.status], 'regular').then(function () { route(); });
  };
  window.copyReminder = function (id, btn) {
    var c = customerById(id);
    if (!c) return;
    if (!trialAllowShare()) { route(); return; }
    var msg = buildReminder(c);
    if (!msg) return;
    copyText(msg.combined, btn);
    recordSent(c, 'Copy', REMINDER_BY_STAGE[c.status], 'regular').then(function () { route(); });
  };

  /* ---- Messages tab: pick template → pick customer → tap send ---- */
  function previewCustomer() {
    return { id: '__preview', code: '__preview', name: 'Ramesh', mobile: '', systemKw: 3,
      installDate: '2026-01-01', submittedOn: '2026-01-01', referredBy: null, referralCount: 0, rewards: [] };
  }
  /* The message text currently shown: a Gemini-personalized version when
     one was just made, otherwise the chosen template (regular/funny). */
  window.currentMsgText = function (c) {
    if (msgAI) return msgAI.combined;
    return buildMessage(msgKey, c, msgStyle).combined;
  };
  /* Show the AI status line under the button and re-render the current
     view. Never alert() here — this browser auto-dismisses native
     dialogs, so an alert shows nothing at all. */
  function showAIStatus(text) {
    msgAIStatus = text;
    if (typeof location !== 'undefined' && location.hash.indexOf('#customer-') === 0) renderCustomer(location.hash.slice('#customer-'.length));
    else renderMessages();
  }
  /* Personalize the shown message with Gemini. The API key comes from
     Settings (stored in the Firestore meta doc only, never in the repo
     or logs). No key -> inline hint where to get a free one. */
  window.personalizeMessage = function (customerId, btn) {
    var c = customerId ? customerById(customerId) : (msgCustomerId ? customerById(msgCustomerId) : null);
    if (!c) { showAIStatus('Pick a customer first — tap a name below.'); return; }
    var s = meta.settings || {};
    var key = (s.geminiApiKey || '').trim();
    if (!key) { showAIStatus('Add your free Gemini API key in Settings — get one at Google AI Studio (aistudio.google.com).'); return; }
    var model = GEMINI_MODEL_ID;
    var base = buildMessage(msgKey, c, msgStyle);
    var months = monthsBetween(c.installDate || c.submittedOn);
    var prompt = 'You write WhatsApp messages for a rooftop solar vendor in Goalpara, Assam. Rewrite the message below to be warmer and more personal for this customer. Keep it short and friendly, in the same two parts: first the English version, then the same message in Assamese (proper Assamese script). Keep the customer first name, all numbers, the reward link and the poster link exactly as they are — do not change, drop or invent any of them. Reply ONLY with JSON: {"en": "...", "as": "..."}.\n\nCustomer: first name ' + firstName(c.name) + ', ' + months + ' month(s) since install, ' + c.systemKw + ' kW system, ' + referralCount(c.id) + ' referral(s), stage: ' + c.status + '.\n\nMessage:\n' + base.combined;
    var old = btn ? btn.textContent : '';
    if (btn) btn.textContent = '✨ Personalizing…';
    fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } })
    }).then(function (resp) { return resp.json(); }).then(function (data) {
      var text = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
      if (!text) throw new Error('empty');
      var out = JSON.parse(text);
      if (!out.en || !out.as) throw new Error('bad');
      msgAI = { en: out.en, as: out.as, combined: out.en + '\n\n' + out.as };
      msgAIStatus = null;
      if (location.hash.indexOf('#customer-') === 0) renderCustomer(location.hash.slice('#customer-'.length));
      else renderMessages();
    }).catch(function () {
      showAIStatus('Could not personalize — check the Gemini API key and model in Settings and try again.');
    }).finally(function () { if (btn) btn.textContent = old; });
  };

  window.sendMsg = function (kind, btn) {
    var c = msgCustomerId ? customerById(msgCustomerId) : null;
    if (!c) { showAIStatus('Pick a customer first — tap a name below.'); return; }
    if (!trialAllowShare()) { route(); return; }
    var msg = currentMsgText(c);
    var channel = kind === 'wa' ? 'WhatsApp' : kind === 'sms' ? 'SMS' : 'Copy';
    if (kind === 'wa') window.open(waLink(c, msg), '_blank');
    else if (kind === 'sms') openSms(c, msg);
    else copyText(msg, btn);
    /* Record the tap as sent (the app can't see whether WhatsApp/SMS
       actually delivered it — the UI says so). */
    recordSent(c, channel, msgKey, msgAI ? 'AI' : msgStyle).then(function () { route(); });
  };
  /* Customer-detail message buttons — same send + record as the
     Messages tab, so the Sent list sees them too. */
  window.msgCustomerWa = function (id) {
    var c = customerById(id);
    if (!c) return;
    if (!trialAllowShare()) { route(); return; }
    window.open(waLink(c, currentMsgText(c)), '_blank');
    recordSent(c, 'WhatsApp', msgKey, msgAI ? 'AI' : msgStyle).then(function () { route(); });
  };
  window.msgCustomerSms = function (id) {
    var c = customerById(id);
    if (!c) return;
    if (!trialAllowShare()) { route(); return; }
    openSms(c, currentMsgText(c));
    recordSent(c, 'SMS', msgKey, msgAI ? 'AI' : msgStyle).then(function () { route(); });
  };
  window.msgCustomerCopy = function (id, btn) {
    var c = customerById(id);
    if (!c) return;
    if (!trialAllowShare()) { route(); return; }
    copyText(currentMsgText(c), btn);
    recordSent(c, 'Copy', msgKey, msgAI ? 'AI' : msgStyle).then(function () { route(); });
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
      return '<div class="pick-row" onclick="msgCustomerId=\'' + x.id + '\';msgAI=null;msgAIStatus=null;renderMessages()"><div><b>' + esc(x.name) + '</b> · ' + esc(x.consumerNo) + '<br><span style="color:var(--muted);font-size:12.5px">' + esc(stageEmoji(x.status)) + ' ' + esc(x.status) + ' · ' + esc(x.systemKw) + ' kW</span>' + (sentLabel(x) ? '<br><span style="color:var(--muted);font-size:12.5px">' + esc(sentLabel(x)) + '</span>' : '') + '</div><span style="font-size:22px;color:var(--muted)">›</span></div>';
    }).join('');
    var occ = currentOccasion();
    var occOptions = sortedOccasions().map(function (o) {
      return '<option value="' + esc(o.id) + '"' + (occ && occ.id === o.id ? ' selected' : '') + '>' + esc(o.name) + ' · ' + esc(fmtDate(o.date)) + '</option>';
    }).join('');
    var msgText = currentMsgText(c || previewCustomer());
    view.innerHTML =
      '<h2>💬 Messages</h2><p class="sub">Pick a template, pick a customer, tap send. English + Assamese in one message — name, months, referrals and reward link fill in by themselves. “Sent” means you tapped to send — the app can’t confirm delivery in WhatsApp or SMS. <a href="#sent">📤 Sent list →</a></p>' +
      offerBannerHTML() +
      (mode === 'sample' ? sampleBanner() : '') +
      '<div class="card"><h3 style="margin-top:0">1 · Choose a message 💬</h3>' +
      '<select id="msgTpl2" onchange="msgKey=this.value;msgAI=null;msgAIStatus=null;renderMessages()">' + tplOptions + '</select>' +
      (msgKey === 'festival' ? '<select id="msgOcc" style="margin-top:8px" onchange="setMsgOccasion(this.value);msgAI=null;msgAIStatus=null;renderMessages()">' + occOptions + '</select><p class="sub">Occasion fills into the message — add more occasions in Settings.</p>' : '') +
      '<div class="btnrow" style="margin-top:8px"><button class="' + (msgStyle === 'regular' ? '' : 'secondary') + '" onclick="msgStyle=\'regular\';msgAI=null;msgAIStatus=null;renderMessages()">😊 Regular</button>' +
      '<button class="' + (msgStyle === 'funny' ? '' : 'secondary') + '" onclick="msgStyle=\'funny\';msgAI=null;msgAIStatus=null;renderMessages()">😂 Funny</button></div></div>' +
      '<div class="card"><h3 style="margin-top:0">2 · Choose a customer 👥</h3>' +
      (c ? '<p style="margin:0 0 10px">✅ <b>' + esc(c.name) + '</b> · ' + esc(c.consumerNo) + ' · ' + esc(c.systemKw) + ' kW · ' + esc(c.status) + ' <a href="#" onclick="msgCustomerId=null;msgAI=null;msgAIStatus=null;renderMessages();return false;">Change</a></p>'
        : '<div class="btnrow" style="margin:0 0 10px"><button class="' + (msgOnlyDisbursed ? 'secondary' : '') + '" onclick="msgOnlyDisbursed=false;renderMessages()">All customers</button>' +
          '<button class="' + (msgOnlyDisbursed ? '' : 'secondary') + '" onclick="msgOnlyDisbursed=true;renderMessages()">✅ Disbursed only</button></div>' +
          '<input id="mq" placeholder="Search name, consumer no., mobile…" value="' + esc(msgSearch) + '" oninput="msgSearch=this.value;renderMessages()">' +
          '<div style="margin-top:6px">' + (pickRows || '<p class="sub">No customers match.</p>') + '</div>' +
          '<p class="sub" style="margin-top:8px">💡 Tip: switch to “Disbursed only” to message your happy customers one by one for referrals.</p>') +
      '</div>' +
      '<div class="card"><h3 style="margin-top:0">3 · Preview &amp; send ' + (c ? 'to ' + esc(firstName(c.name)) : '(sample preview — pick a customer to fill in their details)') + '</h3>' +
      '<div class="msgbox">' + esc(msgText) + '</div>' +
      (msgAI ? '<p class="sub">✨ AI-personalized version — <a href="#" onclick="msgAI=null;msgAIStatus=null;renderMessages();return false;">use the template instead</a></p>' : '') +
      '<div class="btnrow big">' +
      '<button class="whatsapp" onclick="sendMsg(\'wa\', this)">💬 WhatsApp</button>' +
      '<button class="sms" onclick="sendMsg(\'sms\', this)">✉️ SMS</button>' +
      '<button class="secondary" onclick="sendMsg(\'copy\', this)">📋 Copy message</button>' +
      '<button class="secondary" onclick="personalizeMessage(null, this)">✨ Personalize with AI</button>' +
      '</div>' +
      (msgAIStatus ? '<p class="sub ai-status">⚠️ ' + esc(msgAIStatus) + '</p>' : '') +
      ((meta.settings && meta.settings.geminiApiKey) ? '' : '<p class="sub">✨ Personalize with AI needs a key — add your free Gemini API key in Settings (get one at Google AI Studio, aistudio.google.com).</p>') +
      smsHint() + '</div>';
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
          '<button class="secondary" onclick="copyReminder(\'' + c.id + '\', this)">Copy</button></div></div>';
      }).join('');
      return '<div class="card"><h3 style="margin-top:0">' + esc(stageEmoji(st)) + ' ' + esc(st) + ' — ' + list.length + '</h3><p class="sub">' + esc(NEEDS_ACTION[st]) + '</p>' + rows + '</div>';
    }).join('');
    view.innerHTML =
      '<h2>⏰ Reminders</h2><p class="sub">' + (total ? total + ' customer' + (total === 1 ? '' : 's') + ' stuck — tap WhatsApp, SMS or Copy to nudge them.' : 'Nothing stuck — every application is moving. 🎉') + '</p>' +
      (mode === 'sample' ? sampleBanner() : '') +
      smsHint() +
      (blocks || '<div class="card"><p>Nothing stuck — every application is moving. 🎉</p></div>');
  }

  /* ---- Sent list: everyone messaged from the app, newest first ---- */
  function renderSentList() {
    var sent = customers.filter(function (c) { return !!c.lastSentAt; }).slice()
      .sort(function (a, b) { return (b.lastSentAt || '').localeCompare(a.lastSentAt || ''); });
    var rows = sent.map(function (c) {
      return '<div class="pick-row" onclick="location.hash=\'#customer-' + c.id + '\'"><div><b>' + esc(c.name) + '</b> · ' + esc(c.consumerNo) + '<br><span style="color:var(--muted);font-size:12.5px">' + esc(sentLabel(c)) + (c.lastSentTemplate ? ' · ' + esc(TEMPLATE_NAMES[c.lastSentTemplate] || c.lastSentTemplate) : '') + (c.sentCount > 1 ? ' · ' + c.sentCount + ' sends' : '') + '</span></div><span style="font-size:22px;color:var(--muted)">›</span></div>';
    }).join('');
    view.innerHTML =
      '<p><a href="#messages">← Messages</a></p>' +
      '<h2>📤 Sent list</h2>' +
      '<p class="sub">Everyone you have messaged from this app, newest first. “Sent” means you tapped WhatsApp, SMS or Copy — the app can’t see whether the message was actually delivered.</p>' +
      (mode === 'sample' ? sampleBanner() : '') +
      (rows ? '<div class="card">' + rows + '</div>' : '<div class="card"><p>Nothing sent yet — send your first message from the Messages tab.</p></div>');
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
      '<select id="csent" onchange="listState.sent=this.value;renderCustomers()"><option value="">Sent: all</option>' +
      '<option value="sent"' + (listState.sent === 'sent' ? ' selected' : '') + '>✅ Sent</option>' +
      '<option value="notsent"' + (listState.sent === 'notsent' ? ' selected' : '') + '>Not sent yet</option></select>' +
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
    var msgText = currentMsgText(c);
    var flags = (c.duplicate ? ' <span class="pill due">Duplicate entry — check</span>' : '') +
      (c.reverification ? ' <span class="pill due">Reverification needed</span>' : '');
    var remind = buildReminder(c);
    var occ = currentOccasion();
    var occOptions = sortedOccasions().map(function (o) {
      return '<option value="' + esc(o.id) + '"' + (occ && occ.id === o.id ? ' selected' : '') + '>' + esc(o.name) + ' · ' + esc(fmtDate(o.date)) + '</option>';
    }).join('');
    view.innerHTML =
      '<p><a href="#customers">← Customers</a></p>' +
      '<h2>' + esc(c.name) + '</h2>' +
      '<p class="sub">' + esc(c.area) + ' · ' + esc(c.systemKw) + ' kW · ' + esc(c.status) + flags + '</p>' +
      (sentLabel(c) ? '<p class="sub">' + esc(sentLabel(c)) + (c.sentCount > 1 ? ' · ' + c.sentCount + ' sends' : '') + (c.lastSentTemplate ? ' · ' + esc(TEMPLATE_NAMES[c.lastSentTemplate] || c.lastSentTemplate) : '') + '</p>' : '') +
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
      '<dt>Your refer code</dt><dd><b>' + esc(c.referCode || '—') + '</b> ' + (c.referCode ? '<button class="secondary" onclick="copyText(\'' + esc(c.referCode) + '\', this)">Copy code</button>' : '') + '</dd>' +
      '<dt>Referred</dt><dd>' + (refs.length ? refs.map(function (r) { return esc(r.name) + ' (' + esc(r.consumerNo) + ')'; }).join(', ') : 'Nobody yet') + '</dd>' +
      '</dl></div>' +
      (remind ? '<div class="card"><h3 style="margin-top:0">Needs action ⏰</h3><p>' + esc(NEEDS_ACTION[c.status] || '') + '</p><div class="msgbox">' + esc(remind.combined) + '</div><div class="btnrow"><button class="whatsapp" onclick="remindCustomer(\'' + c.id + '\', this)">Remind on WhatsApp</button><button class="sms" onclick="remindSms(\'' + c.id + '\', this)">Remind by SMS</button><button class="secondary" onclick="copyReminder(\'' + c.id + '\', this)">Copy</button></div>' + smsHint() + '</div>' : '') +
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
      '<div class="row"><select id="msgTpl" onchange="msgKey=this.value;msgAI=null;msgAIStatus=null;renderCustomer(\'' + c.id + '\')">' +
      ['festival', 'referral', 'anniversary'].map(function (k) { return '<option value="' + k + '"' + (msgKey === k ? ' selected' : '') + '>' + TEMPLATE_NAMES[k] + '</option>'; }).join('') +
      '</select></div>' +
      (msgKey === 'festival' ? '<div class="row" style="margin-top:8px"><select id="msgOcc" onchange="setMsgOccasion(this.value);msgAI=null;msgAIStatus=null;renderCustomer(\'' + c.id + '\')">' + occOptions + '</select></div>' : '') +
      '<div class="btnrow" style="margin-top:8px"><button class="' + (msgStyle === 'regular' ? '' : 'secondary') + '" onclick="msgStyle=\'regular\';msgAI=null;msgAIStatus=null;renderCustomer(\'' + c.id + '\')">😊 Regular</button>' +
      '<button class="' + (msgStyle === 'funny' ? '' : 'secondary') + '" onclick="msgStyle=\'funny\';msgAI=null;msgAIStatus=null;renderCustomer(\'' + c.id + '\')">😂 Funny</button></div>' +
      '<p class="sub">English + Assamese in one message. Name, months since install, referral count and reward link are filled in automatically.</p>' +
      '<div class="msgbox">' + esc(msgText) + '</div>' +
      (msgAI ? '<p class="sub">✨ AI-personalized version — <a href="#" onclick="msgAI=null;msgAIStatus=null;renderCustomer(\'' + c.id + '\');return false;">use the template instead</a></p>' : '') +
      '<div class="btnrow">' +
      '<button class="whatsapp" onclick="msgCustomerWa(\'' + c.id + '\')">WhatsApp</button>' +
      '<button class="sms" onclick="msgCustomerSms(\'' + c.id + '\')">SMS</button>' +
      '<button class="secondary" onclick="msgCustomerCopy(\'' + c.id + '\', this)">Copy message</button>' +
      '<button class="secondary" onclick="personalizeMessage(\'' + c.id + '\', this)">✨ Personalize with AI</button>' +
      '</div>' +
      (msgAIStatus ? '<p class="sub ai-status">⚠️ ' + esc(msgAIStatus) + '</p>' : '') +
      ((meta.settings && meta.settings.geminiApiKey) ? '' : '<p class="sub">✨ Personalize with AI needs a key — add your free Gemini API key in Settings (get one at Google AI Studio, aistudio.google.com).</p>') +
      smsHint() + '</div>' +
      '<div class="card"><h3 style="margin-top:0">Edit details</h3>' +
      '<label>Address</label><input id="f-address" value="' + esc(c.address) + '">' +
      '<label>Install date</label><input id="f-install" type="date" value="' + esc(c.installDate) + '">' +
      '<label>Stage</label><select id="f-status">' + STAGES.map(function (st) { return '<option' + (c.status === st ? ' selected' : '') + '>' + st + '</option>'; }).join('') + '</select>' +
      '<label>Referred by (refer code)</label><input id="f-refcode" value="' + esc((c.referredBy && customerById(c.referredBy) ? customerById(c.referredBy).referCode : '') || '') + '" placeholder="e.g. SH7K2Q" oninput="refCodeChanged()">' +
      '<p class="sub" id="f-refname">' + (c.referredBy && customerById(c.referredBy) ? 'Referred by: ' + esc(customerById(c.referredBy).name) + ' (' + esc(customerById(c.referredBy).consumerNo) + ')' : 'No referrer') + '</p>' +
      '<label>Or pick the referrer by name</label><select id="f-ref" onchange="refSelectChanged()"><option value="">Nobody</option>' + customers.filter(function (x) { return x.id !== c.id; }).map(function (x) { return '<option value="' + x.id + '"' + (c.referredBy === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>' +
      '<p class="sub" id="f-ref-status"></p>' +
      '<div class="btnrow"><button onclick="saveCustomer(\'' + c.id + '\')">Save changes</button></div></div>';
  }
  /* Keep the refer-code input and the referrer select in sync on the
     edit form: typing a code picks the matching customer, and picking a
     name fills in that customer's code. */
  window.refCodeChanged = function () {
    var codeEl = document.getElementById('f-refcode');
    var nameEl = document.getElementById('f-refname');
    var sel = document.getElementById('f-ref');
    if (!codeEl) return;
    var code = codeEl.value.trim();
    if (!code) { if (sel) sel.value = ''; if (nameEl) nameEl.textContent = 'No referrer'; return; }
    var r = customerByReferCode(code);
    if (r) { if (sel) sel.value = r.id; if (nameEl) nameEl.textContent = 'Referred by: ' + r.name + ' (' + r.consumerNo + ')'; }
    else { if (sel) sel.value = ''; if (nameEl) nameEl.textContent = '⚠️ No customer has that code'; }
  };
  window.refSelectChanged = function () {
    var sel = document.getElementById('f-ref');
    var codeEl = document.getElementById('f-refcode');
    var nameEl = document.getElementById('f-refname');
    var r = sel && sel.value ? customerById(sel.value) : null;
    if (codeEl) codeEl.value = r ? (r.referCode || '') : '';
    if (nameEl) nameEl.textContent = r ? 'Referred by: ' + r.name + ' (' + r.consumerNo + ')' : 'No referrer';
  };
  window.saveCustomer = function (id) {
    var c = customerById(id);
    if (!c) return;
    var refCode = document.getElementById('f-refcode').value.trim();
    if (refCode && !customerByReferCode(refCode)) {
      var st = document.getElementById('f-ref-status');
      if (st) st.textContent = '⚠️ No customer has that refer code — fix it or clear it before saving.';
      return;
    }
    var oldReferredBy = c.referredBy;
    c.address = document.getElementById('f-address').value.trim();
    c.installDate = document.getElementById('f-install').value;
    c.status = document.getElementById('f-status').value;
    c.referredBy = document.getElementById('f-ref').value || null;
    activeDB.saveCustomer(c).then(function () { return syncReferrerLists(c, oldReferredBy); }).then(function () { return refreshCustomers(); }).then(function () { renderCustomer(id); });
  };
  window.giveTierReward = function (id) {
    var c = customerById(id);
    var t = tierReached(c);
    if (!t) return;
    c.rewards.push({ tier: t, label: meta.settings.tiers[String(t)], date: new Date().toISOString().slice(0, 10), custom: false });
    /* The reward just given covers the first t confirmed referrals —
       those friends move to "Reward earned" on the referrer's list. */
    confirmedReferralsFor(c.referCode, referrals).slice(0, t).forEach(function (rel) {
      var link = findReferralLink(rel, customers);
      if (!link.referred) return;
      var entry = (c.referred || []).find(function (x) { return x.consumerNo === link.referred.consumerNo; });
      if (entry) entry.stage = 'rewarded';
    });
    activeDB.saveCustomer(c).then(function () { return refreshCustomers(); }).then(function () { renderCustomer(id); });
  };
  /* Confirm a referral submission: the friend got solar. Links the
     friend to the referrer when possible (that credits the referral
     count), moves the friend's entry to "got solar", and refreshes. */
  window.confirmReferral = function (id) {
    var r = referrals.find(function (x) { return x.id === id; });
    if (!r || r.status !== 'pending') return;
    var done = applyReferralConfirm(r, customers);
    var chain = Promise.resolve();
    if (done.customerToSave) {
      chain = chain.then(function () { return activeDB.saveCustomer(done.customerToSave); })
        .then(function () { return syncReferrerLists(done.customerToSave, null); });
    }
    chain = chain.then(function () { return activeDB.saveReferral(r); })
      .then(function () {
        var link = findReferralLink(r, customers);
        if (link.referrer && link.referred) {
          var entry = (link.referrer.referred || []).find(function (x) { return x.consumerNo === link.referred.consumerNo; });
          if (entry && referredStage(entry) !== 'rewarded') { entry.stage = 'solar'; return activeDB.saveCustomer(link.referrer); }
        }
        return null;
      })
      .then(function () { return refreshReferrals(); })
      .then(function () { return refreshCustomers(); })
      .then(function () { renderRewards(); });
  };
  window.dismissReferral = function (id) {
    var r = referrals.find(function (x) { return x.id === id; });
    if (!r || r.status !== 'pending') return;
    r.status = 'dismissed';
    activeDB.saveReferral(r).then(function () { return refreshReferrals(); }).then(function () { renderRewards(); });
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
      '<label>Referred by (refer code — optional)</label><input id="n-refcode" placeholder="e.g. SH7K2Q" oninput="showRefName()">' +
      '<p class="sub" id="n-refname"></p>' +
      '<div class="btnrow"><button onclick="addCustomer()">Save customer</button></div></div>';
  }
  /* Live lookup for the "Referred by" code on the add-customer form. */
  window.showRefName = function () {
    var el = document.getElementById('n-refname');
    var codeEl = document.getElementById('n-refcode');
    if (!el || !codeEl) return;
    var code = codeEl.value.trim();
    if (!code) { el.textContent = ''; return; }
    var r = customerByReferCode(code);
    el.textContent = r ? 'Referred by: ' + r.name + ' (' + r.consumerNo + ')' : '⚠️ No customer has that refer code — check it.';
  };
  window.addCustomer = function () {
    var consumerNo = document.getElementById('n-consumer').value.trim();
    var name = document.getElementById('n-name').value.trim();
    var mobile = document.getElementById('n-mobile').value.replace(/\D/g, '').slice(-10);
    if (!consumerNo || !name || !mobile) { alert('Consumer number, name and mobile are needed.'); return; }
    var refCode = document.getElementById('n-refcode').value.trim();
    var referrer = refCode ? customerByReferCode(refCode) : null;
    if (refCode && !referrer) { var el = document.getElementById('n-refname'); if (el) el.textContent = '⚠️ No customer has that refer code — fix it or clear it before saving.'; return; }
    var c = {
      id: '', code: '', consumerNo: consumerNo, name: name, mobile: mobile,
      address: document.getElementById('n-address').value.trim(),
      area: document.getElementById('n-area').value.trim() || 'Goalpara',
      systemKw: parseFloat(document.getElementById('n-kw').value) || 0,
      status: document.getElementById('n-status').value,
      submittedOn: document.getElementById('n-submitted').value,
      installDate: document.getElementById('n-install').value,
      applicationNo: '', subDivision: '', duplicate: false, reverification: false,
      referredBy: referrer ? referrer.id : null, referralCount: 0, rewards: []
    };
    activeDB.saveCustomer(c).then(function () { return syncReferrerLists(c, null); }).then(function () { return refreshCustomers(); }).then(function () { location.hash = '#customers'; renderCustomers(); });
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
    var referrers = customers.filter(function (c) { return referralCount(c.id) > 0; }).sort(function (a, b) { return referralCount(b.id) - referralCount(a.id); });
    var refRows = referrers.map(function (r) {
      var refs = referredList(r.id);
      return '<div class="pick-row" style="cursor:pointer" onclick="location.hash=\'#customer-' + r.id + '\'"><div><b>' + esc(r.name) + '</b> · ' + esc(r.consumerNo) + ' · Code <b>' + esc(r.referCode || '—') + '</b><br><span style="color:var(--muted);font-size:12.5px">' + refs.length + ' referral' + (refs.length > 1 ? 's' : '') + ' · ' + (tierReached(r) ? 'Level ' + tierReached(r) + ' — ' + esc(s.tiers[String(tierReached(r))]) : 'No tier yet') + '<br>Brought: ' + (refs.length ? refs.map(function (x) { return esc(firstName(x.name)) + ' (' + esc(x.consumerNo) + ')'; }).join(', ') : '—') + '</span></div><span style="font-size:22px;color:var(--muted)">›</span></div>';
    }).join('');
    /* Referral submissions from the public form, with the journey
       (Invited -> Signed up -> Got solar -> Reward earned) per referral. */
    var pendingCount = referrals.filter(function (r) { return r.status === 'pending'; }).length;
    var refList = refFilter === 'all' ? referrals : referrals.filter(function (r) { return r.status === refFilter; });
    var submissionRows = refList.map(function (r) {
      var link = findReferralLink(r, customers);
      var confirmedIdx = r.status === 'confirmed' ? confirmedReferralsFor(r.referCode, referrals).findIndex(function (x) { return x.id === r.id; }) + 1 : 0;
      var j = journeyForReferral(r, customers, link.referrer, confirmedIdx);
      var date = (r.submittedAt || '').slice(0, 10);
      var by = (r.referrerName ? esc(r.referrerName) : (link.referrer ? esc(link.referrer.name) : 'Friend submission')) +
        (r.referrerConsumerNo ? ' · ' + esc(r.referrerConsumerNo) : '') +
        (r.referrerMobile ? ' · ' + esc(r.referrerMobile) : '') +
        (r.referCode ? ' · Code <b>' + esc(r.referCode) + '</b>' : '') +
        ' <span class="pill ' + (r.status === 'confirmed' ? 'ok' : r.status === 'dismissed' ? 'due' : 'info') + '">' + esc(r.status) + '</span>';
      var who = '<b>' + esc(r.referredName || '—') + '</b> · ' + esc(r.referredMobile || '') +
        (r.referredAddress ? '<br><span style="color:var(--muted);font-size:12.5px">' + esc(r.referredAddress) + '</span>' : '');
      var linkedNote = (j.linked && link.referred)
        ? '<p class="sub">Friend is a customer: ' + esc(link.referred.name) + ' (' + esc(link.referred.consumerNo) + ')</p>'
        : (r.status === 'pending' ? '<p class="sub">Friend is not a customer yet — add them with this refer code when they install solar.</p>' : '');
      var actions = r.status === 'pending'
        ? '<div class="btnrow remind-btns"><button onclick="confirmReferral(\'' + r.id + '\')">✓ Confirm — friend got solar</button><button class="secondary" onclick="dismissReferral(\'' + r.id + '\')">Dismiss</button></div>'
        : '';
      return '<div class="pick-row" style="display:block;cursor:default"><div>' + by + '<br>' + who +
        '<br><span style="color:var(--muted);font-size:12.5px">' + (date ? fmtDate(date) + ' · ' : '') + (r.submittedBy === 'friend' ? 'Submitted by the friend' : 'Submitted by the referrer') + '</span></div>' +
        journeyStepsHTML(j.done) + linkedNote + actions + '</div>';
    }).join('');
    view.innerHTML =
      '<h2>🎁 Rewards</h2><p class="sub">Tiered rewards: 1 referral, 2 referrals, 3 or more. Change the rewards in Settings — the app counts everything for you.</p>' +
      (mode === 'sample' ? sampleBanner() : '') +
      '<div class="card"><h3 style="margin-top:0">Reward tiers (from Settings)</h3>' +
      '<p>1 referral → <b>' + esc(s.tiers['1']) + '</b><br>2 referrals → <b>' + esc(s.tiers['2']) + '</b><br>3+ referrals → <b>' + esc(s.tiers['3']) + '</b></p>' +
      '<p class="sub">' + dueList.length + ' customer(s) have a reward due right now.</p></div>' +
      '<div class="card" style="padding:4px 14px;overflow-x:auto"><table class="list"><thead><tr><th>Customer</th><th>Referrals</th><th>Tier reached</th><th>Status</th><th>Rewards given</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="5">No customers yet.</td></tr>') + '</tbody></table></div>' +
      '<div class="card"><h3 style="margin-top:0">Refer tracker — who brought whom</h3>' +
      '<p class="sub">Every customer who referred someone, and who they brought (first name + consumer no. only).</p>' +
      (refRows || '<p class="sub">No referrals yet.</p>') + '</div>' +
      '<div class="card"><h3 style="margin-top:0">📩 Referral submissions</h3>' +
      '<p class="sub">From the public referral form. Confirm only when the referred person actually gets solar — confirming links them to the referrer and counts towards the reward. The reward is earned only at the confirmed stage.</p>' +
      (referralsLoadError ? '<p class="sub">⚠️ Referral submissions could not be loaded — the Firestore rules for the referrals collection are not published yet. Publish firestore.rules in the Firebase console (Firestore &gt; Rules &gt; Publish), then reload.</p>' : '') +
      '<div class="row"><select onchange="refFilter=this.value;renderRewards()">' +
      ['pending', 'confirmed', 'dismissed', 'all'].map(function (f) { return '<option value="' + f + '"' + (refFilter === f ? ' selected' : '') + '>' + f.charAt(0).toUpperCase() + f.slice(1) + (f === 'pending' ? ' (' + pendingCount + ')' : '') + '</option>'; }).join('') +
      '</select></div>' +
      (submissionRows || '<p class="sub">No referral submissions ' + (refFilter === 'all' ? 'yet' : 'with this status') + '.</p>') + '</div>';
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
      '<div class="card"><h3 style="margin-top:0">📲 Install app</h3>' +
      ((typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent || ''))
        ? '<p>On iPhone: tap Share → Add to Home Screen to install SH Solar on your home screen.</p>'
        : '<p class="sub">Install SH Solar on your phone for one-tap access, even offline.</p><div class="btnrow"><button onclick="installApp()">📲 Install app</button></div>' +
          (deferredInstallPrompt ? '' : '<p class="sub">If the button does nothing yet, open this site in Chrome on Android and come back here — the install prompt appears once the browser offers it.</p>')) +
      '</div>' +
      (demoMode
        ? '<div class="card"><h3 style="margin-top:0">⏳ Demo trial</h3>' +
          '<p class="sub">This browser is running the limited demo (5 messages over 3 days). ' + esc(trialStatusText()) + '</p>' +
          '<div class="btnrow"><button class="secondary" onclick="resetTrialFromSettings()">Reset trial</button>' +
          '<button class="secondary" onclick="exitDemo()">Exit demo</button></div></div>'
        : '<div class="card"><h3 style="margin-top:0">⏳ Demo trial</h3>' +
          '<p class="sub">The limited demo (5 messages over 3 days) is given to a friend from a demo link. Resetting it here clears the start date and the sent count so the demo can be given again — use it after the demo ends or after the friend pays. This only writes the trial record; it does not read or change anything else.</p>' +
          '<div class="btnrow"><button class="secondary" onclick="resetDemoTrial()">Reset demo trial</button></div></div>') +
      '<div class="card"><h3 style="margin-top:0">🎉 Bumper offer banner</h3>' +
      '<p class="sub">Shown bright on the Dashboard and Messages tab. Change it to your real offer — or clear the title and text to hide the banner.</p>' +
      '<label>Offer title</label><input id="s-offer-title" value="' + esc(s.offerTitle || '') + '">' +
      '<label>Offer text</label><textarea id="s-offer-text">' + esc(s.offerText || '') + '</textarea>' +
      '<label>Valid till (optional)</label><input id="s-offer-till" type="date" value="' + esc(s.offerValidTill || '') + '">' +
      '</div>' +
      '<div class="card"><h3 style="margin-top:0">🎉 Festival occasions</h3>' +
      '<p class="sub">Occasions for the Festival offer message — the picker shows them by date, and the message fills in the occasion name and greeting. Add your own (e.g. Diwali) or delete one you don’t need.</p>' +
      sortedOccasions().map(function (o) {
        return '<p style="margin:4px 0">🎉 <b>' + esc(o.name) + '</b> · ' + esc(fmtDate(o.date)) + ' <a href="#" onclick="deleteOccasion(\'' + esc(o.id) + '\');return false;">Delete</a></p>';
      }).join('') +
      '<div class="row"><input id="s-occ-name" placeholder="Occasion name, e.g. Diwali"><input id="s-occ-date" type="date"></div>' +
      '<div class="row"><input id="s-occ-en" placeholder="English greeting, e.g. Happy Diwali! 🪔"><input id="s-occ-as" placeholder="Assamese greeting, e.g. দীপাৱলীৰ শুভেচ্ছা! 🪔"></div>' +
      '<div class="btnrow"><button class="secondary" onclick="addOccasion()">+ Add occasion</button></div></div>' +
      '<div class="card"><h3 style="margin-top:0">Reward tiers</h3>' +
      '<label>1 referral gets</label><input id="s-t1" value="' + esc(s.tiers['1']) + '">' +
      '<label>2 referrals get</label><input id="s-t2" value="' + esc(s.tiers['2']) + '">' +
      '<label>3+ referrals get</label><input id="s-t3" value="' + esc(s.tiers['3']) + '">' +
      '<p class="sub">These are editable examples — set what you actually give.</p></div>' +
      '<div class="card"><h3 style="margin-top:0">✨ AI personalization (Gemini)</h3>' +
      '<p class="sub">Powers the “Personalize with AI” button in Messages. The key is stored in Firebase only — never in the app code or this public site. Get a free key at Google AI Studio (aistudio.google.com). Model: Gemini 3.5 Flash-Lite (fixed).</p>' +
      '<label>Gemini API key</label><input id="s-gemini-key" type="password" autocomplete="new-password" value="' + esc(s.geminiApiKey || '') + '" placeholder="Paste your Gemini API key">' +
      '</div>' +
      '<div class="card"><h3 style="margin-top:0">Message templates (English + Assamese in one message)</h3>' +
      '<p class="sub">Placeholders: {name} first name · {months} months since install · {count} referrals · {kw} system size · {link} reward link · {poster} offer poster link · {occasion} festival name · {greeting} festival greeting · {referCode} refer code. The app fills them in for each customer.</p>' +
      Object.keys(TEMPLATE_NAMES).map(function (k) {
        return '<label>' + TEMPLATE_NAMES[k] + ' — English</label><textarea id="t-' + k + '-en">' + esc(t[k].en) + '</textarea>' +
          '<label>' + TEMPLATE_NAMES[k] + ' — Assamese</label><textarea id="t-' + k + '-as">' + esc(t[k].as) + '</textarea>';
      }).join('') + '</div>' +
      '<div class="btnrow"><button onclick="saveSettings()">Save settings</button>' +
      '<button class="secondary" onclick="resetTemplates()">Reset messages to the latest version</button>' +
      '<button class="secondary" onclick="if(confirm(\'Reset the sample preview to the 8 demo customers?\')){store.save(SAMPLE_LS_KEY, demoCustomers());route();}">Reset sample data</button></div>';
  }
  /* Demo trial controls (vendor only). Reset clears the start date and
     the sent count so the demo can be given again; the next demo-mode
     load starts a fresh 3 days. The normal-mode button is write-only —
     it never reads the trial doc, so normal use is never affected by
     the trial. Exit demo clears this browser's demo flag and reloads
     the normal site. */
  window.resetTrialFromSettings = function () {
    if (!confirm('Reset the demo trial? This clears the start date and the sent count, so the demo can be given again.')) return;
    resetTrial().then(function () { location.reload(); });
  };
  window.resetDemoTrial = function () {
    if (!confirm('Reset the demo trial? This clears the start date and the sent count, so the demo can be given again.')) return;
    resetTrial().then(function () { alert('Demo trial reset.'); });
  };
  window.exitDemo = function () {
    store.save(TRIAL_LS_KEY, '0');
    demoMode = false;
    location.href = location.pathname + (location.hash || '#messages');
  };
  /* Restore the current built-in message templates (the latest version).
     Use after a template rewrite, or if the vendor's edits go wrong. */
  window.resetTemplates = function () {
    if (!confirm('Reset all message templates to the latest version? Any edits you made to the messages will be replaced.')) return;
    meta.templates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
    meta.funnyTemplates = JSON.parse(JSON.stringify(FUNNY_TEMPLATES));
    meta.templatesVersion = TEMPLATES_VERSION;
    activeDB.saveMeta(meta).then(function () { saveMeta(); renderSettings(); alert('Messages reset to the latest version.'); });
  };
  window.addOccasion = function () {
    var name = document.getElementById('s-occ-name').value.trim();
    var date = document.getElementById('s-occ-date').value;
    var en = document.getElementById('s-occ-en').value.trim();
    var as = document.getElementById('s-occ-as').value.trim();
    if (!name || !date) { alert('Occasion name and date are needed.'); return; }
    var list = normalizeOccasions(meta.settings.occasions);
    var id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'occasion';
    if (list.some(function (o) { return o.id === id; })) id = id + '-' + date;
    list.push({ id: id, name: name, nameAs: name, date: date, en: en || ('Happy ' + name + '!'), as: as || (name + 'ৰ শুভেচ্ছা!') });
    meta.settings.occasions = list;
    activeDB.saveMeta(meta).then(function () { saveMeta(); renderSettings(); });
  };
  window.deleteOccasion = function (id) {
    meta.settings.occasions = normalizeOccasions(meta.settings.occasions).filter(function (o) { return o.id !== id; });
    if (msgOccasionId === id) msgOccasionId = null;
    activeDB.saveMeta(meta).then(function () { saveMeta(); renderSettings(); });
  };
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
    meta.settings.geminiApiKey = document.getElementById('s-gemini-key').value.trim();
    /* The model is locked — a save always writes the single model id. */
    meta.settings.geminiModel = GEMINI_MODEL_ID;
    meta.settings.tiers['1'] = document.getElementById('s-t1').value.trim();
    meta.settings.tiers['2'] = document.getElementById('s-t2').value.trim();
    meta.settings.tiers['3'] = document.getElementById('s-t3').value.trim();
    Object.keys(TEMPLATE_NAMES).forEach(function (k) {
      meta.templates[k].en = document.getElementById('t-' + k + '-en').value;
      meta.templates[k].as = document.getElementById('t-' + k + '-as').value;
    });
    activeDB.saveMeta(meta).then(function () { saveMeta(); alert('Settings saved.'); });
  };

  /* Share a customer's refer code on WhatsApp: first name, the referral
     offer, the code and the short poster link. The friend's benefit is
     worded generically ("a special discount") — the vendor sets the
     actual rewards in Settings; no amount is invented here. */
  /* The share helpers (referralFormLink / referralShareText) live at
     module scope so Node tests can use them; these are the tap handlers. */
  window.shareReferral = function (code, first) {
    if (!trialAllowShare()) { route(); return; }
    window.open('https://wa.me/?text=' + encodeURIComponent(referralShareText(code, first, true)), '_blank');
    trialRecordShare();
  };
  /* Native share sheet where the browser has one (phone share sheet),
     WhatsApp as the fallback. */
  window.shareReferralNative = function (code, first) {
    if (!trialAllowShare()) { route(); return; }
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: 'SH Enterprise Solar — refer a friend', text: referralShareText(code, first, false), url: referralFormLink(code) }).catch(function () {});
      trialRecordShare();
    } else {
      window.shareReferral(code, first);
    }
  };
  /* Pick a friend from the phone's contacts (Contact Picker API — Chrome
     on Android) and open WhatsApp to that friend with the referral
     message. Where the API is not supported the button is not shown and
     the share sheet is the way in. */
  window.pickContactAndShare = function (code, first) {
    if (!trialAllowShare()) { route(); return; }
    if (!(typeof navigator !== 'undefined' && navigator.contacts && typeof navigator.contacts.select === 'function')) { window.shareReferralNative(code, first); return; }
    navigator.contacts.select(['name', 'tel'], { multiple: false }).then(function (picked) {
      var contact = (picked || [])[0];
      if (!contact) return;
      var digits = normMobileDigits((contact.tel || [])[0]);
      if (!/^[6-9]\d{9}$/.test(digits)) {
        var st = document.getElementById('contact-status');
        if (st) st.textContent = 'That contact has no mobile number — pick another, or share normally.';
        return;
      }
      window.open('https://wa.me/91' + digits + '?text=' + encodeURIComponent(referralShareText(code, first, true)), '_blank');
      trialRecordShare();
    }).catch(function () {});
  };
  /* Notification permission, asked early on the reward page only: the
     customer taps the button (permissions need a tap — they cannot be
     requested silently), and only while the permission is undecided.
     NOTE: asking early prepares the device; actually delivering a push
     later needs a push backend (e.g. FCM) — that is a follow-up, not
     part of this page. Until then the app cannot send the notification. */
  function notifyCardHTML() {
    if (typeof Notification === 'undefined') return '';
    if (Notification.permission === 'granted') return '<p class="sub">🔔 Notifications on — we\'ll tell you when a friend signs up, when their solar is confirmed, and when your reward is earned.</p>';
    if (Notification.permission !== 'default') return '';
    return '<div class="card notify-card"><h3 style="margin-top:0">🔔 Stay in the loop</h3>' +
      '<p class="sub">Allow notifications and we\'ll tell you when a friend signs up, when their solar is confirmed, and when your reward is earned.</p>' +
      '<div class="btnrow"><button onclick="enableNotifications()">Enable notifications</button></div></div>';
  }
  window.enableNotifications = function () {
    if (typeof Notification === 'undefined') return;
    try {
      var p = Notification.requestPermission();
      if (p && p.then) p.then(function () { route(); }).catch(function () {});
      else route();
    } catch (e) { /* leave the card as it is */ }
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
      var contactsSupported = (typeof navigator !== 'undefined' && navigator.contacts && typeof navigator.contacts.select === 'function');
      var stageLabel = { signedUp: 'Signed up', solar: 'Got solar', rewarded: 'Reward earned' };
      view.innerHTML = trialBannerHTML() +
        '<div class="card" style="max-width:520px;margin:30px auto">' +
        (isSample ? '<p class="sub"><b>SAMPLE PREVIEW</b> — sample customer page.</p>' : '') +
        '<p class="sub">SH Enterprise (Green Energy) · Kalpanagar, Goalpara</p>' +
        '<h2 style="margin-top:0">Namaskar, ' + esc(firstName(c.name)) + '</h2>' +
        '<p>Your solar rewards with us:</p>' +
        '<div class="stats"><div class="stat"><div class="num">' + rc + '</div><div class="lbl">Friends you brought</div></div>' +
        '<div class="stat"><div class="num">' + (t ? 'Level ' + t : '—') + '</div><div class="lbl">Reward tier</div></div></div>' +
        '<div class="tier-progress" style="margin-top:14px"><div style="width:' + Math.min(100, rc / 3 * 100) + '%"></div></div>' +
        '<p class="sub">' + rc + ' of 3 referrals towards the top reward. ' + esc(nextLabel) + '</p>' +
        '<h3>🎁 Refer &amp; earn — your refer code</h3>' +
        '<p style="font-size:34px;letter-spacing:4px;margin:4px 0"><b>' + esc(c.referCode || '') + '</b></p>' +
        '<div class="btnrow big"><button onclick="shareReferralNative(\'' + esc(c.referCode || '') + '\', \'' + esc(firstName(c.name)).replace(/\'/g, "\\'") + '\')">📤 Share</button>' +
        '<button class="whatsapp" onclick="shareReferral(\'' + esc(c.referCode || '') + '\', \'' + esc(firstName(c.name)).replace(/\'/g, "\\'") + '\')">💬 WhatsApp</button></div>' +
        (contactsSupported ? '<div class="btnrow" style="margin-top:8px"><button class="secondary" onclick="pickContactAndShare(\'' + esc(c.referCode || '') + '\', \'' + esc(firstName(c.name)).replace(/\'/g, "\\'") + '\')">👥 Pick a friend from contacts</button></div><p class="sub" id="contact-status"></p>' : '') +
        '<div class="btnrow" style="margin-top:8px"><button class="secondary" onclick="copyText(\'' + esc(c.referCode || '') + '\', this)">📋 Copy code</button>' +
        '<button onclick="location.href=\'refer.html?ref=' + encodeURIComponent(c.referCode || '') + '\'">🎁 Refer a friend — send the form</button></div>' +
        '<p class="sub">Give this code to a friend — when they install solar with us and mention your code, your friend gets a special discount, and you earn a reward. We take care of every new customer: installation, paperwork, subsidy process and after-care.</p>' +
        notifyCardHTML() +
        '<h3>How referring works</h3>' +
        journeyStepsHTML(publicJourneyDone(c)) +
        '<p class="sub">Your reward is earned only when your friend\'s solar is installed and we confirm it.</p>' +
        '<h3>Friends you brought</h3>' +
        ((c.referred || []).length ? '<p>' + (c.referred || []).map(function (x) { return '✓ ' + esc(x.name) + ' (' + esc(x.consumerNo) + ') — ' + (stageLabel[referredStage(x)] || 'Signed up'); }).join('<br>') + '</p>' : '<p class="sub">Nobody yet — share your code above to start.</p>') +
        '<h3>Rewards you have earned</h3>' +
        ((c.rewards || []).length ? '<p>' + c.rewards.map(function (r) { return '✓ ' + esc(r.label) + ' (' + esc(r.date) + ')'; }).join('<br>') + '</p>' : '<p class="sub">No rewards yet — bring a friend who installs solar and your first reward is yours.</p>') +
        '<p class="sub">Reward tiers: 1 referral → ' + esc(s.tiers['1']) + ' · 2 → ' + esc(s.tiers['2']) + ' · 3+ → ' + esc(s.tiers['3']) + '</p>' +
        '<p class="sub">No login needed. Your details are shown only through your personal link.</p>' +
        '</div>';
    }
    if (firebaseReady && mode === 'firestore') {
      FirestoreDB.getCustomerByCode(code).then(function (c) {
        if (!c) { show(customerByCode(code) || demoCustomers().find(function (x) { return x.code === code; }) || null, true); return; }
        return ensureCustomerReferCode(c).then(function (c2) { customers = [c2]; show(c2, false); });
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
          /* Demo mode loads the trial (sets the 3-day clock on first
             demo use) before anything else. If the trial has ended,
             the lock screen shows and no customer data is loaded. */
          refreshMeta().then(loadTrial).then(function () {
            if (demoMode && trialLocked()) { route(); return; }
            return refreshCustomers().then(refreshReferrals).then(healReferralStages).then(function () { route(); });
          });
        });
        return true;
      }
    } catch (e) { firebaseReady = false; }
    return false;
  }

  document.addEventListener('DOMContentLoaded', function () {
    view = document.getElementById('view');
    tabs = document.getElementById('tabs');
    /* Demo / trial mode: the ?demo= flag in the URL wins and is saved
       per-browser; otherwise the saved flag decides. */
    demoMode = detectDemoMode(typeof location !== 'undefined' ? location.search : '');
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
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

/* Node tests: expose the pure helpers (the browser ignores this). */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GEMINI_MODEL_ID: GEMINI_MODEL_ID,
    SampleDB: SampleDB,
    FirestoreDB: FirestoreDB,
    pruneStoredTemplates: pruneStoredTemplates,
    buildMessage: buildMessage,
    /* Test hook (Node tests only): point the Firestore handle at a mock. */
    _setDb: function (mock) { db = mock; },
    DEFAULT_OCCASIONS: DEFAULT_OCCASIONS,
    OLD_POSTER_URL: OLD_POSTER_URL,
    POSTER_SHORT_URL: POSTER_SHORT_URL,
    TEMPLATES_VERSION: TEMPLATES_VERSION,
    fillTemplate: fillTemplate,
    normalizeOccasions: normalizeOccasions,
    sortedOccasions: sortedOccasions,
    nextOccasion: nextOccasion,
    currentOccasion: currentOccasion,
    setMsgOccasion: setMsgOccasion,
    recordSent: recordSent,
    sentLabel: sentLabel,
    toFirestore: toFirestore,
    LS_KEY: LS_KEY,
    makeReferCode: makeReferCode,
    customerByReferCode: customerByReferCode,
    referCodeTaken: referCodeTaken,
    referredEntry: referredEntry,
    referredStage: referredStage,
    syncReferrerLists: syncReferrerLists,
    ensureReferCodes: ensureReferCodes,
    ensureReferrerLists: ensureReferrerLists,
    normMobileDigits: normMobileDigits,
    findReferralLink: findReferralLink,
    journeyForReferral: journeyForReferral,
    confirmedReferralsFor: confirmedReferralsFor,
    applyReferralConfirm: applyReferralConfirm,
    journeyStepsHTML: journeyStepsHTML,
    publicJourneyDone: publicJourneyDone,
    referralFormLink: referralFormLink,
    referralShareText: referralShareText,
    healReferralStages: healReferralStages,
    DEFAULT_TEMPLATES: DEFAULT_TEMPLATES,
    FUNNY_TEMPLATES: FUNNY_TEMPLATES,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    OLD_OFFER_TEXT_V3: OLD_OFFER_TEXT_V3,
    /* Demo / trial mode (v7) — pure helpers + test hooks. */
    TRIAL_DAYS: TRIAL_DAYS,
    TRIAL_MESSAGE_LIMIT: TRIAL_MESSAGE_LIMIT,
    TRIAL_LS_KEY: TRIAL_LS_KEY,
    demoFlagFromSearch: demoFlagFromSearch,
    detectDemoMode: detectDemoMode,
    defaultTrial: defaultTrial,
    trialMessagesLeft: trialMessagesLeft,
    trialDaysLeft: trialDaysLeft,
    trialIsExpired: trialIsExpired,
    trialIsLocked: trialIsLocked,
    trialBannerHTML: trialBannerHTML,
    trialLockHTML: trialLockHTML,
    loadTrial: loadTrial,
    resetTrial: resetTrial,
    trialRecordShare: trialRecordShare,
    trialAllowShare: trialAllowShare,
    trialLocked: trialLocked,
    _setDemoMode: function (v) { demoMode = !!v; },
    _isDemoMode: function () { return demoMode; },
    _setTrial: function (t) { trial = t; },
    _getTrial: function () { return trial; },
    _getMode: function () { return mode; },
    _setAuthed: function (v) { authed = !!v; },
    _setFirebaseReady: function (v) { firebaseReady = !!v; }
  };
}
