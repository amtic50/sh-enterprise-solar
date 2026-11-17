// Tests for the v4 push: AI model lock, festival occasions, sent
// tracking, refer codes, and the advertising rules (no Rs 78,000, no
// APDCL, no install totals in advertising copy).
// Run: node tests/v4.test.js  (from ~/workspace/solar-vendor-demo)
// localStorage mock must be installed BEFORE requiring app.js.
global.localStorage = (function () {
  var mem = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    setItem: function (k, v) { mem[k] = String(v); },
    removeItem: function (k) { delete mem[k]; },
    _mem: mem
  };
})();
global.window = global;

var app = require('../app.js');
var assert = require('assert');
var passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log('ok - ' + name);
}

// ---------- 1. Gemini model locked to 3.5 Flash Lite ----------
ok('GEMINI_MODEL_ID is gemini-3.5-flash-lite', function () {
  assert.strictEqual(app.GEMINI_MODEL_ID, 'gemini-3.5-flash-lite');
});
ok('no normalizeGeminiModel export (superseded by the lock)', function () {
  assert.strictEqual(app.normalizeGeminiModel, undefined);
});

// ---------- 2. Festival occasions ----------
ok('DEFAULT_OCCASIONS has 9 verified occasions, sorted by date', function () {
  assert.strictEqual(app.DEFAULT_OCCASIONS.length, 9);
  var dates = app.sortedOccasions().map(function (o) { return o.date; });
  var sorted = dates.slice().sort();
  assert.deepStrictEqual(dates, sorted);
  assert.strictEqual(app.DEFAULT_OCCASIONS[0].id, 'christmas');
  assert.strictEqual(app.DEFAULT_OCCASIONS[0].date, '2026-12-25');
  assert.strictEqual(app.DEFAULT_OCCASIONS[8].id, 'durga-puja');
  assert.strictEqual(app.DEFAULT_OCCASIONS[8].date, '2027-10-05');
});
ok('nextOccasion is the first upcoming occasion', function () {
  var today = new Date().toISOString().slice(0, 10);
  var next = app.nextOccasion();
  assert.ok(next.date >= today);
  assert.ok(app.sortedOccasions().every(function (o) { return o.date < today || o.date >= next.date; }));
});
ok('setMsgOccasion + fillTemplate fill {occasion} and {greeting} (EN + AS)', function () {
  var c = { id: 'x', code: 'x', name: 'Ramesh Das', installDate: '2026-01-01', submittedOn: '2026-01-01', systemKw: 3, referredBy: null, referralCount: 0, rewards: [] };
  app.setMsgOccasion('holi');
  assert.strictEqual(app.currentOccasion().id, 'holi');
  assert.strictEqual(app.fillTemplate('Happy {occasion}! {greeting}', c, 'en'), 'Happy Holi! Happy Holi! 🎨');
  assert.strictEqual(app.fillTemplate('শুভেচ্ছা {occasion}! {greeting}', c, 'as'), 'শুভেচ্ছা হোলী! হোলীৰ শুভেচ্ছা! 🎨');
  app.setMsgOccasion(null);
});
ok('normalizeOccasions falls back to defaults on garbage', function () {
  assert.deepStrictEqual(app.normalizeOccasions(null), app.DEFAULT_OCCASIONS);
  assert.deepStrictEqual(app.normalizeOccasions([]), app.DEFAULT_OCCASIONS);
  assert.strictEqual(app.normalizeOccasions([{ name: 'Diwali', date: '2027-11-08' }])[0].id, 'diwali');
});

// ---------- 3. Sent tracking ----------
ok('toFirestore carries the sent fields', function () {
  var c = { consumerNo: '040000100001', name: 'Ramesh', systemKw: 3, lastSentAt: '2026-11-18T10:00:00.000Z', lastSentChannel: 'WhatsApp', lastSentTemplate: 'festival', lastSentStyle: 'funny', sentCount: 2, sentLog: [{ at: '2026-11-18T10:00:00.000Z', channel: 'WhatsApp', template: 'festival', style: 'funny' }] };
  var f = app.toFirestore(c);
  assert.strictEqual(f.lastSentAt, '2026-11-18T10:00:00.000Z');
  assert.strictEqual(f.lastSentChannel, 'WhatsApp');
  assert.strictEqual(f.lastSentTemplate, 'festival');
  assert.strictEqual(f.lastSentStyle, 'funny');
  assert.strictEqual(f.sentCount, 2);
  assert.strictEqual(f.sentLog.length, 1);
});
ok('recordSent stamps fields, increments, keeps a 10-entry log', function () {
  var c = { id: 't1', code: 't1', consumerNo: '040000100001', name: 'Ramesh', mobile: '9876543210', systemKw: 3, status: 'Subsidy Disbursal (Disbursed)' };
  return app.recordSent(c, 'WhatsApp', 'festival', 'regular').then(function () {
    assert.ok(c.lastSentAt);
    assert.strictEqual(c.lastSentChannel, 'WhatsApp');
    assert.strictEqual(c.lastSentTemplate, 'festival');
    assert.strictEqual(c.sentCount, 1);
    assert.strictEqual(c.sentLog.length, 1);
    assert.ok(app.sentLabel(c).indexOf('✅ Sent ') === 0);
    assert.ok(app.sentLabel(c).indexOf('WhatsApp') > 0);
    return app.recordSent(c, 'SMS', 'referral', 'funny');
  }).then(function () {
    assert.strictEqual(c.sentCount, 2);
    assert.strictEqual(c.lastSentChannel, 'SMS');
    assert.strictEqual(c.sentLog.length, 2);
    assert.strictEqual(c.sentLog[0].channel, 'SMS');
  });
});

// ---------- 4. Refer codes ----------
ok('makeReferCode format SH + 4 unambiguous chars, unique across 500 draws', function () {
  var taken = {};
  for (var i = 0; i < 500; i++) {
    var code = app.makeReferCode(taken);
    assert.ok(/^SH[A-Z2-9]{4}$/.test(code), code);
    assert.ok(!taken[code]);
    assert.ok('O0I1'.indexOf(code[2]) < 0 && 'O0I1'.indexOf(code[3]) < 0 && 'O0I1'.indexOf(code[4]) < 0 && 'O0I1'.indexOf(code[5]) < 0);
    taken[code] = true;
  }
});
ok('customerByReferCode is case-insensitive and returns null for unknown', function () {
  var list = [
    { id: 'a', referCode: 'SH7K2Q', name: 'Ramesh', consumerNo: '040000100001' },
    { id: 'b', referCode: 'SH3M8R', name: 'Anita', consumerNo: '040000100002' }
  ];
  assert.strictEqual(app.customerByReferCode('sh7k2q', list).id, 'a');
  assert.strictEqual(app.customerByReferCode(' SH3M8R ', list).id, 'b');
  assert.strictEqual(app.customerByReferCode('SH0000', list), null);
  assert.strictEqual(app.customerByReferCode('', list), null);
});
ok('referredEntry keeps first name + consumer no. only (no mobile), stage defaults to signedUp', function () {
  var e = app.referredEntry({ name: 'Ramesh Das', consumerNo: '040000100001', mobile: '9876543210' });
  assert.deepStrictEqual(e, { name: 'Ramesh', consumerNo: '040000100001', stage: 'signedUp' });
  assert.ok(!('mobile' in e));
  assert.deepStrictEqual(app.referredEntry({ name: 'Ramesh Das', consumerNo: '040000100001' }, 'solar'), { name: 'Ramesh', consumerNo: '040000100001', stage: 'solar' });
});
ok('toFirestore carries referCode + referred', function () {
  var f = app.toFirestore({ referCode: 'SH7K2Q', referred: [{ name: 'Babul', consumerNo: '040000100003' }] });
  assert.strictEqual(f.referCode, 'SH7K2Q');
  assert.deepStrictEqual(f.referred, [{ name: 'Babul', consumerNo: '040000100003' }]);
});

// ---------- 5. Advertising rules ----------
ok('no Rs 78,000 figure in any regular or funny template', function () {
  Object.keys(app.DEFAULT_TEMPLATES).forEach(function (k) {
    ['en', 'as'].forEach(function (lang) {
      var t = app.DEFAULT_TEMPLATES[k][lang];
      assert.ok(t.indexOf('78,000') < 0 && t.indexOf('78000') < 0, k + '/' + lang);
    });
  });
  Object.keys(app.FUNNY_TEMPLATES).forEach(function (k) {
    ['en', 'as'].forEach(function (lang) {
      var t = app.FUNNY_TEMPLATES[k][lang];
      assert.ok(t.indexOf('78,000') < 0 && t.indexOf('78000') < 0, 'funny ' + k + '/' + lang);
    });
  });
});
ok('no APDCL mention in templates or banner defaults', function () {
  var hay = JSON.stringify(app.DEFAULT_TEMPLATES) + JSON.stringify(app.FUNNY_TEMPLATES) + app.DEFAULT_SETTINGS.offerTitle + app.DEFAULT_SETTINGS.offerText;
  assert.ok(hay.indexOf('APDCL') < 0);
});
ok('no install totals (300+/305) in templates or banner defaults', function () {
  var hay = JSON.stringify(app.DEFAULT_TEMPLATES) + JSON.stringify(app.FUNNY_TEMPLATES) + app.DEFAULT_SETTINGS.offerTitle + app.DEFAULT_SETTINGS.offerText;
  assert.ok(hay.indexOf('300+') < 0 && hay.indexOf('305') < 0);
});
ok('banner default leads with the referral reward + care angle, no subsidy figure', function () {
  assert.ok(app.DEFAULT_SETTINGS.offerText.indexOf('Refer a friend and earn gifts!') === 0);
  assert.ok(app.DEFAULT_SETTINGS.offerText.indexOf('13 sub-divisions') > 0);
  assert.ok(app.DEFAULT_SETTINGS.offerText.indexOf('Kalpanagar') > 0);
  assert.ok(app.DEFAULT_SETTINGS.offerText.indexOf('78,000') < 0);
});
ok('offer hooks carry the trust lines (13 sub-divisions, care, office)', function () {
  var fest = app.DEFAULT_TEMPLATES.festival.en;
  assert.ok(fest.indexOf('13 sub-divisions') > 0);
  assert.ok(fest.indexOf('take care of every new customer') > 0);
  assert.ok(fest.indexOf('installation, paperwork, subsidy process and after-care') > 0);
  assert.ok(app.DEFAULT_TEMPLATES.anniversary.en.indexOf('take care of every new customer') > 0);
  assert.ok(app.DEFAULT_TEMPLATES.reminder_installation.en.indexOf('hands-on working experience') > 0);
});
ok('funny v2: 9 keys, festival (no puja), {poster} everywhere, {occasion} in festival', function () {
  assert.strictEqual(Object.keys(app.FUNNY_TEMPLATES).length, 9);
  assert.ok('festival' in app.FUNNY_TEMPLATES && !('puja' in app.FUNNY_TEMPLATES));
  Object.keys(app.FUNNY_TEMPLATES).forEach(function (k) {
    assert.ok(app.FUNNY_TEMPLATES[k].en.indexOf('{poster}') > 0, k);
    assert.ok(app.FUNNY_TEMPLATES[k].as.indexOf('{poster}') > 0, k);
  });
  assert.ok(app.FUNNY_TEMPLATES.festival.en.indexOf('{occasion}') > 0);
  assert.ok(app.FUNNY_TEMPLATES.festival.as.indexOf('{occasion}') > 0);
});
ok('quote math still keeps the subsidy slabs (30k/60k/78k)', function () {
  var fs = require('fs');
  var src = fs.readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(src.indexOf('amount: 78000') > 0);
  assert.ok(src.indexOf('3 kW+ ₹78,000') > 0);
});

// ---------- 6. Stored v3 meta upgrades to v4 on load ----------
(function () {
  var v3 = {
    templatesVersion: 3,
    settings: JSON.parse(JSON.stringify(app.DEFAULT_SETTINGS)),
    templates: JSON.parse(JSON.stringify(app.DEFAULT_TEMPLATES)),
    funnyTemplates: JSON.parse(JSON.stringify(app.FUNNY_TEMPLATES))
  };
  v3.settings.posterUrl = 'https://amtic50.github.io/sh-enterprise-solar/offer-poster.jpg';
  v3.settings.geminiModel = 'Gemini 3.5 Flash-Lite';
  v3.settings.offerText = app.OLD_OFFER_TEXT_V3;
  v3.settings.occasions = undefined;
  v3.templates.puja = v3.templates.festival;
  delete v3.templates.festival;
  global.localStorage.setItem(app.LS_KEY, JSON.stringify(v3));
  app.SampleDB.loadMeta().then(function (m) {
    assert.strictEqual(m.templatesVersion, app.TEMPLATES_VERSION);
    assert.ok('festival' in m.templates && !('puja' in m.templates));
    assert.strictEqual(m.settings.posterUrl, app.POSTER_SHORT_URL);
    assert.strictEqual(m.settings.geminiModel, 'gemini-3.5-flash-lite');
    assert.strictEqual(m.settings.offerText, app.DEFAULT_SETTINGS.offerText);
    assert.strictEqual(m.settings.occasions.length, 9);
    assert.strictEqual(m.settings.occasions[0].id, 'christmas');
    passed++;
    console.log('ok - stored v3 meta upgrades to the current version on load (festival key, short poster, locked model, 9 occasions)');
  }).catch(function (e) {
    console.log('FAIL - stored v3 meta upgrade: ' + (e && e.message));
    process.exitCode = 1;
  });
})();

setTimeout(function () {
  console.log('PASSED ' + passed + ' checks');
}, 100);
