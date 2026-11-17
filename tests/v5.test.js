// Tests for the v5 push: {referCode} in the message itself, {link} on
// festival + anniversary, and the stored-template upgrade actually
// replacing stale keys. The v4 bug: FirestoreDB.loadMeta wrote the
// upgrade with set(..., {merge:true}), and Firestore merge merges map
// keys — so the old "puja" key survived inside the stored templates
// map. The banner upgraded (scalars merge fine) but the templates did
// not. v5 writes the upgrade as a full set and prunes unknown keys.
// Run: node tests/v5.test.js  (from ~/workspace/solar-vendor-demo)
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

// Mock Firestore BEFORE requiring app.js, so FirestoreDB.loadMeta can be
// exercised in Node. Captures every write (data + options).
var mockDoc = null;    // the stored meta doc the mock returns
var mockWrites = [];
global.db = {
  collection: function () {
    return {
      doc: function () {
        return {
          get: function () { return Promise.resolve({ exists: mockDoc !== null, data: function () { return mockDoc; } }); },
          set: function (data, opts) { mockWrites.push({ data: data, opts: opts }); return Promise.resolve(); }
        };
      }
    };
  }
};

var app = require('../app.js');
var assert = require('assert');
// Point the module's Firestore handle at the mock (app.js declares its
// own `var db`, so a global assignment would not reach it).
app._setDb(global.db);
var passed = 0;
var failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('ok - ' + name); }
  catch (e) { failures.push(name); console.log('FAIL - ' + name + ': ' + e.message); }
}
function checkAsync(name, fn) {
  return Promise.resolve().then(fn).then(function () { passed++; console.log('ok - ' + name); })
    .catch(function (e) { failures.push(name); console.log('FAIL - ' + name + ': ' + e.message); });
}
function cust(over) {
  var c = { id: 'x1', code: '01x1', name: 'Ramesh Das', installDate: '2026-01-01', submittedOn: '2026-01-01', systemKw: 3, status: 'Subsidy Disbursal (Disbursed)', referredBy: null, referralCount: 0, rewards: [], referCode: 'SH7K2Q' };
  return Object.assign(c, over || {});
}
/* A stored v3 meta: puja key (old wording, Rs 78,000), no festival key,
   templatesVersion 3, old offer/poster/model — as the live Firestore doc
   held after the v3 check. */
function storedV3Meta() {
  var t = JSON.parse(JSON.stringify(app.DEFAULT_TEMPLATES));
  var f = JSON.parse(JSON.stringify(app.FUNNY_TEMPLATES));
  t.puja = { en: 'Old puja offer — get up to ₹78,000 subsidy!', as: 'পুৰণি পূজা অফাৰ — ₹78,000 চাবচিডি!' };
  f.puja = { en: 'Old funny puja — ₹78,000!', as: 'পুৰণি পূজা — ₹78,000!' };
  delete t.festival; delete f.festival;
  var s = JSON.parse(JSON.stringify(app.DEFAULT_SETTINGS));
  s.offerText = app.OLD_OFFER_TEXT_V3;
  s.posterUrl = app.OLD_POSTER_URL;
  s.geminiModel = 'Gemini 3.5 Flash-Lite';
  s.occasions = undefined;
  return { templatesVersion: 3, settings: s, templates: t, funnyTemplates: f };
}
/* The merge-bug state: version already 4 (v4 upgrade ran) but the stale
   puja key survived inside the stored maps. */
function storedV4WithStalePuja() {
  var m = storedV3Meta();
  m.templates = JSON.parse(JSON.stringify(app.DEFAULT_TEMPLATES));
  m.funnyTemplates = JSON.parse(JSON.stringify(app.FUNNY_TEMPLATES));
  m.templates.puja = { en: 'Old puja offer — get up to ₹78,000 subsidy!', as: 'পুৰণি পূজা অফাৰ — ₹78,000 চাবচিডি!' };
  m.funnyTemplates.puja = { en: 'Old funny puja — ₹78,000!', as: 'পুৰণি পূজা — ₹78,000!' };
  m.templatesVersion = 4;
  return m;
}
function no78000(hay, where) {
  assert.ok(hay.indexOf('78,000') < 0 && hay.indexOf('78000') < 0, where);
}

(async function main() {
  // ---------- 1. Version ----------
  check('TEMPLATES_VERSION is 5', function () {
    assert.strictEqual(app.TEMPLATES_VERSION, 5);
  });

  // ---------- 2. {referCode} fills from the customer ----------
  ['festival', 'referral', 'anniversary'].forEach(function (key) {
    check('{referCode} fills in ' + key + ' (regular + funny, EN + AS)', function () {
      ['regular', 'funny'].forEach(function (style) {
        var m = app.buildMessage(key, cust(), style);
        assert.ok(m.en.indexOf('SH7K2Q') > 0, key + '/' + style + '/en');
        assert.ok(m.as.indexOf('SH7K2Q') > 0, key + '/' + style + '/as');
        assert.ok(m.combined.indexOf('{referCode}') < 0, key + '/' + style + ' literal left');
      });
    });
  });
  check('{referCode} is generated (never empty) when the customer has none, and stable', function () {
    var c = cust({ referCode: '' });
    var m1 = app.buildMessage('festival', c, 'regular');
    assert.ok(c.referCode, 'code assigned to the customer');
    assert.ok(/^SH[A-Z2-9]{4}$/.test(c.referCode), c.referCode);
    assert.ok(m1.combined.indexOf(c.referCode) > 0, 'first message shows it');
    assert.ok(m1.combined.indexOf('{referCode}') < 0, 'no literal left');
    var m2 = app.buildMessage('referral', c, 'funny');
    assert.ok(m2.combined.indexOf(c.referCode) > 0, 'second message shows the SAME code');
  });

  // ---------- 3. {link} on festival + anniversary (+ referral regular) ----------
  check('{link} present in festival + anniversary (both styles) and referral regular', function () {
    ['festival', 'anniversary'].forEach(function (key) {
      assert.ok(app.DEFAULT_TEMPLATES[key].en.indexOf('{link}') > 0, 'regular ' + key + '/en');
      assert.ok(app.DEFAULT_TEMPLATES[key].as.indexOf('{link}') > 0, 'regular ' + key + '/as');
      assert.ok(app.FUNNY_TEMPLATES[key].en.indexOf('{link}') > 0, 'funny ' + key + '/en');
      assert.ok(app.FUNNY_TEMPLATES[key].as.indexOf('{link}') > 0, 'funny ' + key + '/as');
    });
    assert.ok(app.DEFAULT_TEMPLATES.referral.en.indexOf('{link}') > 0, 'regular referral/en');
    assert.ok(app.DEFAULT_TEMPLATES.referral.as.indexOf('{link}') > 0, 'regular referral/as');
    var m = app.buildMessage('festival', cust(), 'regular');
    assert.ok(m.combined.indexOf('?c=01x1') > 0, 'filled reward link is the customer reward page');
    assert.ok(m.combined.indexOf('{link}') < 0, 'no literal left');
  });
  check('no placeholder literal survives in any festival/referral/anniversary message', function () {
    ['festival', 'referral', 'anniversary'].forEach(function (key) {
      ['regular', 'funny'].forEach(function (style) {
        var m = app.buildMessage(key, cust(), style);
        assert.ok(!/\{[a-zA-Z]+\}/.test(m.combined), key + '/' + style + ' has an unfilled placeholder');
      });
    });
  });

  // ---------- 4. Advertising rules ----------
  check('no Rs 78,000 figure in any regular or funny template', function () {
    Object.keys(app.DEFAULT_TEMPLATES).forEach(function (k) {
      ['en', 'as'].forEach(function (lang) { no78000(app.DEFAULT_TEMPLATES[k][lang], k + '/' + lang); });
    });
    Object.keys(app.FUNNY_TEMPLATES).forEach(function (k) {
      ['en', 'as'].forEach(function (lang) { no78000(app.FUNNY_TEMPLATES[k][lang], 'funny ' + k + '/' + lang); });
    });
  });
  check('no APDCL mention in templates or banner defaults', function () {
    var hay = JSON.stringify(app.DEFAULT_TEMPLATES) + JSON.stringify(app.FUNNY_TEMPLATES) + app.DEFAULT_SETTINGS.offerTitle + app.DEFAULT_SETTINGS.offerText;
    assert.ok(hay.indexOf('APDCL') < 0);
  });
  check('no install totals (300+/305) in templates or banner defaults', function () {
    var hay = JSON.stringify(app.DEFAULT_TEMPLATES) + JSON.stringify(app.FUNNY_TEMPLATES) + app.DEFAULT_SETTINGS.offerTitle + app.DEFAULT_SETTINGS.offerText;
    assert.ok(hay.indexOf('300+') < 0 && hay.indexOf('305') < 0);
  });
  check('quote math still keeps the subsidy slabs (30k/60k/78k)', function () {
    var fs = require('fs');
    var src = fs.readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
    assert.ok(src.indexOf('amount: 78000') > 0);
    assert.ok(src.indexOf('3 kW+ ₹78,000') > 0);
  });
  check('pruneStoredTemplates drops unknown keys, keeps known edited values', function () {
    var stored = JSON.parse(JSON.stringify(app.DEFAULT_TEMPLATES));
    stored.festival.en = 'VENDOR EDIT keeps me';
    stored.puja = { en: 'stale', as: 'stale' };
    var out = app.pruneStoredTemplates(stored, { puja: { en: 'stale', as: 'stale' } });
    assert.strictEqual(out.templates.festival.en, 'VENDOR EDIT keeps me');
    assert.ok(!('puja' in out.templates) && !('puja' in out.funnyTemplates));
    assert.strictEqual(Object.keys(out.templates).length, Object.keys(app.DEFAULT_TEMPLATES).length);
  });

  // ---------- 5. SampleDB upgrade from stored v3 ----------
  await checkAsync('SampleDB: stored v3 meta (puja, version 3) upgrades to v5 with {referCode}, no puja, no 78,000', function () {
    global.localStorage.setItem(app.LS_KEY, JSON.stringify(storedV3Meta()));
    return app.SampleDB.loadMeta().then(function (m) {
      assert.strictEqual(m.templatesVersion, 5);
      assert.ok('festival' in m.templates && !('puja' in m.templates));
      assert.ok('festival' in m.funnyTemplates && !('puja' in m.funnyTemplates));
      assert.ok(m.templates.festival.en.indexOf('{referCode}') > 0);
      assert.ok(m.templates.festival.en.indexOf('{link}') > 0);
      assert.ok(m.funnyTemplates.festival.en.indexOf('{referCode}') > 0);
      no78000(JSON.stringify(m.templates) + JSON.stringify(m.funnyTemplates), 'upgraded templates');
      assert.strictEqual(m.settings.posterUrl, app.POSTER_SHORT_URL);
      assert.strictEqual(m.settings.geminiModel, 'gemini-3.5-flash-lite');
      assert.strictEqual(m.settings.offerText, app.DEFAULT_SETTINGS.offerText);
      assert.strictEqual(m.settings.occasions.length, 9);
      var saved = JSON.parse(global.localStorage.getItem(app.LS_KEY));
      assert.strictEqual(saved.templatesVersion, 5);
      assert.ok(!('puja' in saved.templates) && !('puja' in saved.funnyTemplates));
    });
  });
  await checkAsync('SampleDB: stored v4 WITH stale puja key (merge-bug state) upgrades to v5, puja gone', function () {
    global.localStorage.setItem(app.LS_KEY, JSON.stringify(storedV4WithStalePuja()));
    return app.SampleDB.loadMeta().then(function (m) {
      assert.strictEqual(m.templatesVersion, 5);
      assert.ok(!('puja' in m.templates) && !('puja' in m.funnyTemplates));
      assert.ok(m.templates.festival.en.indexOf('{referCode}') > 0);
    });
  });

  // ---------- 6. FirestoreDB upgrade (mocked db) ----------
  await checkAsync('FirestoreDB: stored v3 upgrades to v5 via a FULL set (no merge), puja gone', function () {
    mockDoc = storedV3Meta();
    mockWrites = [];
    return app.FirestoreDB.loadMeta().then(function (m) {
      assert.strictEqual(m.templatesVersion, 5);
      assert.ok('festival' in m.templates && !('puja' in m.templates));
      assert.ok('festival' in m.funnyTemplates && !('puja' in m.funnyTemplates));
      assert.ok(m.templates.festival.en.indexOf('{referCode}') > 0);
      assert.ok(m.templates.referral.en.indexOf('{referCode}') > 0);
      assert.ok(m.templates.anniversary.en.indexOf('{link}') > 0);
      no78000(JSON.stringify(m.templates) + JSON.stringify(m.funnyTemplates), 'upgraded templates');
      assert.strictEqual(m.settings.posterUrl, app.POSTER_SHORT_URL);
      assert.strictEqual(m.settings.geminiModel, 'gemini-3.5-flash-lite');
      assert.strictEqual(m.settings.offerText, app.DEFAULT_SETTINGS.offerText);
      assert.strictEqual(m.settings.occasions.length, 9);
      // The write must be a full set — no merge option — or Firestore
      // would merge the old puja key back into the stored map.
      assert.strictEqual(mockWrites.length, 1, 'one upgrade write, got ' + mockWrites.length);
      assert.strictEqual(mockWrites[0].opts, undefined, 'upgrade write must not pass {merge:true}');
      assert.ok(!('puja' in mockWrites[0].data.templates), 'written templates have no puja key');
      assert.strictEqual(mockWrites[0].data.templatesVersion, 5);
    });
  });
  await checkAsync('FirestoreDB: merge path prunes a stray puja key from a current (v5) doc, no write', function () {
    var doc = storedV4WithStalePuja();
    doc.templatesVersion = 5;
    doc.settings = JSON.parse(JSON.stringify(app.DEFAULT_SETTINGS));
    mockDoc = doc;
    mockWrites = [];
    return app.FirestoreDB.loadMeta().then(function (m) {
      assert.strictEqual(m.templatesVersion, 5);
      assert.ok(!('puja' in m.templates) && !('puja' in m.funnyTemplates));
      assert.ok(m.templates.festival.en.indexOf('{referCode}') > 0);
      assert.strictEqual(mockWrites.length, 0, 'no write when model/poster already current');
    });
  });

  console.log('PASSED ' + passed + ' checks' + (failures.length ? ' — ' + failures.length + ' FAILED: ' + failures.join(', ') : ''));
  if (failures.length) process.exitCode = 1;
})();
