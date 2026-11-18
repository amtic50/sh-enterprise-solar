// Tests for the v5 referral form + refer-and-earn flow:
// - public refer.html form validation (referrer mode + friend mode),
//   the exact referrals document, and the Firestore submit call
// - vendor side: findReferralLink, applyReferralConfirm, the journey
//   (Invited -> Signed up -> Got solar -> Reward earned), the share
//   message, and FirestoreDB listReferrals/saveReferral
// - firestore.rules: public create, vendor-only read/update/delete
// Run: node tests/v5-referral-form.test.js (from ~/workspace/solar-vendor-demo)
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

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var ReferForm = require('../refer-form.js');

// Mock Firestore: referrals collection (get/add/doc.set) + the meta doc
// shape the loadMeta tests use. Captures every write.
var mockReferralDocs = [];
var mockWrites = [];
function mockSnapshot(docs) {
  return {
    forEach: function (fn) { docs.forEach(function (d) { fn({ id: d.id, data: function () { return d; } }); }); }
  };
}
global.db = {
  collection: function (name) {
    if (name === 'referrals') {
      return {
        get: function () { return Promise.resolve(mockSnapshot(mockReferralDocs)); },
        add: function (data) {
          mockWrites.push({ collection: 'referrals', op: 'add', data: data });
          return Promise.resolve({ id: 'mock-ref-' + (mockWrites.length) });
        },
        doc: function (id) {
          return {
            set: function (data, opts) { mockWrites.push({ collection: 'referrals', op: 'set', id: id, data: data, opts: opts }); return Promise.resolve(); }
          };
        }
      };
    }
    return { doc: function () { return { get: function () { return Promise.resolve({ exists: false, data: function () { return null; } }); }, set: function (d, o) { mockWrites.push({ data: d, opts: o }); return Promise.resolve(); } }; } };
  }
};

var app = require('../app.js');
app._setDb(global.db);

var passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('  ok - ' + name); }
  catch (e) { failed++; console.log('  FAIL - ' + name + ': ' + e.message); }
}
async function checkAsync(name, fn) {
  try { await fn(); passed++; console.log('  ok - ' + name); }
  catch (e) { failed++; console.log('  FAIL - ' + name + ': ' + e.message); }
}

var VALID_REFERRER = {
  referrerName: 'Ramesh Das', referrerConsumerNo: '040000100001', referrerMobile: '9876543210',
  referrerAddress: 'Kalpanagar, Goalpara',
  referredName: 'Anita Rabha', referredMobile: '8765432109', referredAddress: 'Bhalukdubi, Goalpara',
  referCode: 'SH7K2Q'
};
var VALID_FRIEND = {
  referrerName: 'Ramesh', referrerConsumerNo: '', referrerMobile: '', referrerAddress: '',
  referredName: 'Anita Rabha', referredMobile: '8765432109', referredAddress: 'Bhalukdubi, Goalpara',
  referCode: 'SH7K2Q'
};

async function main() {
  console.log('v5 referral form + refer-and-earn tests');

  // ---------- 1. Referrer-mode validation ----------
  check('referrer mode: valid data passes, values normalized', function () {
    var v = ReferForm.validateReferral(VALID_REFERRER);
    assert.strictEqual(v.ok, true, JSON.stringify(v.errors));
    assert.strictEqual(v.cleaned.referrerMobile, '9876543210');
    assert.strictEqual(v.cleaned.referCode, 'SH7K2Q');
    assert.strictEqual(v.mode, 'referrer');
  });
  check('referrer mode: mobile accepts +91 / spaces / dashes', function () {
    var d = Object.assign({}, VALID_REFERRER, { referrerMobile: '+91 98765-43210', referredMobile: '91 8765432109' });
    var v = ReferForm.validateReferral(d);
    assert.strictEqual(v.ok, true, JSON.stringify(v.errors));
    assert.strictEqual(v.cleaned.referrerMobile, '9876543210');
    assert.strictEqual(v.cleaned.referredMobile, '8765432109');
  });
  check('referrer mode: 11-digit consumer number gets the leading zero', function () {
    var d = Object.assign({}, VALID_REFERRER, { referrerConsumerNo: '40000100001' });
    var v = ReferForm.validateReferral(d);
    assert.strictEqual(v.ok, true, JSON.stringify(v.errors));
    assert.strictEqual(v.cleaned.referrerConsumerNo, '040000100001');
  });
  check('referrer mode: missing referrer name / bad mobile / short consumer no. fail with codes', function () {
    var d = Object.assign({}, VALID_REFERRER, { referrerName: ' ', referrerMobile: '12345', referrerConsumerNo: '123' });
    var v = ReferForm.validateReferral(d);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.errors.referrerName, 'required');
    assert.strictEqual(v.errors.referrerMobile, 'mobile');
    assert.strictEqual(v.errors.referrerConsumerNo, 'consumerNo');
  });
  check('referrer mode: refer code optional, bad code fails', function () {
    var d1 = Object.assign({}, VALID_REFERRER, { referCode: '' });
    assert.strictEqual(ReferForm.validateReferral(d1).ok, true);
    var d2 = Object.assign({}, VALID_REFERRER, { referCode: 'XYZ123' });
    var v2 = ReferForm.validateReferral(d2);
    assert.strictEqual(v2.ok, false);
    assert.strictEqual(v2.errors.referCode, 'referCode');
  });

  // ---------- 2. Friend-mode validation ----------
  check('friend mode: valid with only friend details + code', function () {
    var v = ReferForm.validateReferral(VALID_FRIEND, 'friend');
    assert.strictEqual(v.ok, true, JSON.stringify(v.errors));
    assert.strictEqual(v.mode, 'friend');
    assert.strictEqual(v.cleaned.referrerConsumerNo, '');
  });
  check('friend mode: refer code is required', function () {
    var d = Object.assign({}, VALID_FRIEND, { referCode: '' });
    var v = ReferForm.validateReferral(d, 'friend');
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.errors.referCode, 'required');
  });
  check('friend mode: referrer name/address not required', function () {
    var d = Object.assign({}, VALID_FRIEND, { referrerName: '' });
    assert.strictEqual(ReferForm.validateReferral(d, 'friend').ok, true);
  });

  // ---------- 3. Document shape + submit ----------
  check('buildReferralDoc: exact fields, status pending, submittedBy, ISO submittedAt', function () {
    var now = new Date('2026-11-18T04:30:00.000Z');
    var doc = ReferForm.buildReferralDoc(VALID_REFERRER, now, 'referrer');
    assert.deepStrictEqual(Object.keys(doc).sort(), ['referCode', 'referredAddress', 'referredMobile', 'referredName', 'referrerAddress', 'referrerConsumerNo', 'referrerMobile', 'referrerName', 'status', 'submittedAt', 'submittedBy'].sort());
    assert.strictEqual(doc.status, 'pending');
    assert.strictEqual(doc.submittedBy, 'referrer');
    assert.strictEqual(doc.submittedAt, '2026-11-18T04:30:00.000Z');
    assert.strictEqual(doc.referrerConsumerNo, '040000100001');
  });
  check('buildReferralDoc: invalid data returns null; friend doc has empty referrer fields', function () {
    assert.strictEqual(ReferForm.buildReferralDoc(Object.assign({}, VALID_REFERRER, { referrerMobile: '1' })), null);
    var doc = ReferForm.buildReferralDoc(VALID_FRIEND, new Date('2026-11-18T04:30:00.000Z'), 'friend');
    assert.strictEqual(doc.submittedBy, 'friend');
    assert.strictEqual(doc.referrerConsumerNo, '');
    assert.strictEqual(doc.referrerMobile, '');
  });
  await checkAsync('submitReferral: writes one doc to referrals, rejects invalid', async function () {
    mockWrites = [];
    var ref = await ReferForm.submitReferral(global.db, VALID_REFERRER, new Date('2026-11-18T04:30:00.000Z'), 'referrer');
    assert.strictEqual(mockWrites.length, 1);
    assert.strictEqual(mockWrites[0].collection, 'referrals');
    assert.strictEqual(mockWrites[0].op, 'add');
    assert.strictEqual(mockWrites[0].data.status, 'pending');
    assert.ok(ref && ref.id, 'returns a doc ref');
    var threw = false;
    try { await ReferForm.submitReferral(global.db, { referrerName: '' }); } catch (e) { threw = true; }
    assert.strictEqual(threw, true, 'invalid referral rejects');
  });

  // ---------- 4. Vendor link + confirm (pure helpers) ----------
  var list = [
    { id: 'c1', code: 'c1', consumerNo: '040000100001', name: 'Ramesh Das', mobile: '9876543210', referCode: 'SH7K2Q', referredBy: null, rewards: [] },
    { id: 'c2', code: 'c2', consumerNo: '040000100002', name: 'Anita Rabha', mobile: '8765432109', referCode: 'SH3M8R', referredBy: null, rewards: [] },
    { id: 'c3', code: 'c3', consumerNo: '040000100003', name: 'Babul Hussain', mobile: '+91 76543 21098', referCode: 'SH9D4W', referredBy: 'c1', rewards: [] }
  ];
  check('normMobileDigits: strips +91, spaces, dashes', function () {
    assert.strictEqual(app.normMobileDigits('+91 98765-43210'), '9876543210');
    assert.strictEqual(app.normMobileDigits('91 8765432109'), '8765432109');
    assert.strictEqual(app.normMobileDigits(''), '');
  });
  check('findReferralLink: referrer by code, friend by mobile (91-prefix match)', function () {
    var link = app.findReferralLink({ referCode: 'sh7k2q', referredMobile: '91 8765432109' }, list);
    assert.strictEqual(link.referrer && link.referrer.id, 'c1');
    assert.strictEqual(link.referred && link.referred.id, 'c2');
  });
  check('findReferralLink: unknown code / unknown mobile give nulls, never throws', function () {
    var link = app.findReferralLink({ referCode: 'SHXXXX', referredMobile: '9999999999' }, list);
    assert.strictEqual(link.referrer, null);
    assert.strictEqual(link.referred, null);
    var link2 = app.findReferralLink({ referCode: '', referredMobile: '' }, list);
    assert.strictEqual(link2.referrer, null);
    assert.strictEqual(link2.referred, null);
  });
  check('applyReferralConfirm: links an unlinked friend (credits the count) + marks confirmed', function () {
    var r = { id: 'r1', referCode: 'SH7K2Q', referredMobile: '8765432109', status: 'pending' };
    var out = app.applyReferralConfirm(r, list);
    assert.strictEqual(r.status, 'confirmed');
    assert.ok(r.confirmedAt, 'confirmedAt set');
    assert.strictEqual(r.referredCustomerId, 'c2');
    assert.strictEqual(out.customerToSave && out.customerToSave.id, 'c2');
    assert.strictEqual(out.customerToSave.referredBy, 'c1', 'friend now linked to the referrer');
    // restore for later tests
    list[1].referredBy = null;
  });
  check('applyReferralConfirm: already-linked friend is not re-linked', function () {
    var r = { id: 'r2', referCode: 'SH7K2Q', referredMobile: '7654321098', status: 'pending' };
    var out = app.applyReferralConfirm(r, list);
    assert.strictEqual(r.status, 'confirmed');
    assert.strictEqual(r.referredCustomerId, 'c3');
    assert.strictEqual(out.customerToSave, null, 'c3 already has a referrer — do not overwrite');
    assert.strictEqual(list[2].referredBy, 'c1');
  });
  check('applyReferralConfirm: no referrer / no friend yet still confirms (status only)', function () {
    var r = { id: 'r3', referCode: 'SHXXXX', referredMobile: '9999999999', status: 'pending' };
    var out = app.applyReferralConfirm(r, list);
    assert.strictEqual(r.status, 'confirmed');
    assert.strictEqual(out.customerToSave, null);
    assert.strictEqual(r.referredCustomerId, undefined);
  });

  // ---------- 5. Journey ----------
  check('journeyForReferral: invited(1) -> signed up(2) -> got solar(3) -> reward earned(4)', function () {
    var referrer = list[0];
    var pending = { referCode: 'SH7K2Q', referredMobile: '9999999999', status: 'pending' };
    assert.strictEqual(app.journeyForReferral(pending, list, referrer, 0).done, 1);
    var linked = { referCode: 'SH7K2Q', referredMobile: '8765432109', status: 'pending' };
    assert.strictEqual(app.journeyForReferral(linked, list, referrer, 0).done, 2);
    var confirmed = { referCode: 'SH7K2Q', referredMobile: '8765432109', status: 'confirmed' };
    assert.strictEqual(app.journeyForReferral(confirmed, list, referrer, 1).done, 3, 'confirmed but no reward given yet');
    referrer.rewards = [{ tier: 1, label: 'Free panel cleaning', date: '2026-11-18' }];
    assert.strictEqual(app.journeyForReferral(confirmed, list, referrer, 1).done, 4, 'reward given for tier 1');
    assert.strictEqual(app.journeyForReferral(confirmed, list, referrer, 2).done, 3, 'second confirmed referral unlocked tier 2 — not given yet');
    referrer.rewards = [];
  });
  check('confirmedReferralsFor: only this code + confirmed, oldest first', function () {
    var refs = [
      { id: 'a', referCode: 'SH7K2Q', status: 'confirmed', confirmedAt: '2026-11-18T02:00:00.000Z' },
      { id: 'b', referCode: 'SH7K2Q', status: 'pending', submittedAt: '2026-11-18T01:00:00.000Z' },
      { id: 'c', referCode: 'SH3M8R', status: 'confirmed', confirmedAt: '2026-11-18T03:00:00.000Z' },
      { id: 'd', referCode: 'sh7k2q', status: 'confirmed', confirmedAt: '2026-11-18T01:00:00.000Z' }
    ];
    var out = app.confirmedReferralsFor('SH7K2Q', refs);
    assert.deepStrictEqual(out.map(function (r) { return r.id; }), ['d', 'a']);
  });
  check('journeyStepsHTML: four steps, done count matches', function () {
    var html = app.journeyStepsHTML(2);
    assert.ok(html.indexOf('Invited') >= 0 && html.indexOf('Signed up') >= 0 && html.indexOf('Got solar') >= 0 && html.indexOf('Reward earned') >= 0);
    assert.strictEqual((html.match(/class="step done"/g) || []).length, 2);
    assert.strictEqual((html.match(/class="step now"/g) || []).length, 1);
  });
  check('publicJourneyDone: furthest friend stage; 0 when nobody brought', function () {
    assert.strictEqual(app.publicJourneyDone({ referred: [] }), 0);
    assert.strictEqual(app.publicJourneyDone({ referred: [{ name: 'A', consumerNo: '1', stage: 'signedUp' }] }), 2);
    assert.strictEqual(app.publicJourneyDone({ referred: [{ name: 'A', consumerNo: '1' }, { name: 'B', consumerNo: '2', stage: 'solar' }] }), 3);
    assert.strictEqual(app.publicJourneyDone({ referred: [{ name: 'B', consumerNo: '2', stage: 'rewarded' }] }), 4);
  });
  check('referredEntry / referredStage: stage defaults to signedUp, given stage kept', function () {
    assert.strictEqual(app.referredStage({ name: 'A', consumerNo: '1' }), 'signedUp');
    assert.strictEqual(app.referredStage({ name: 'A', consumerNo: '1', stage: 'solar' }), 'solar');
    var e = app.referredEntry({ name: 'Anita Rabha', consumerNo: '040000100002' }, 'solar');
    assert.strictEqual(e.stage, 'solar');
    assert.strictEqual(e.name, 'Anita');
  });

  // ---------- 6. Share message + form link ----------
  check('referralFormLink: Node fallback is the relative form URL with the code', function () {
    assert.strictEqual(app.referralFormLink('SH7K2Q'), 'refer.html?ref=SH7K2Q');
  });
  check('referralShareText: code + poster + form link (WhatsApp); no 78000 / APDCL / totals', function () {
    var wa = app.referralShareText('SH7K2Q', 'Ramesh', true);
    assert.ok(wa.indexOf('SH7K2Q') >= 0, 'code in message');
    assert.ok(wa.indexOf('tinyurl.com/2875c3rt') >= 0, 'poster short link in message');
    assert.ok(wa.indexOf('refer.html?ref=SH7K2Q') >= 0, 'form link in WhatsApp message');
    assert.ok(wa.indexOf('13 sub-divisions and many more') >= 0, 'reach line as approved');
    assert.ok(wa.indexOf('Kalpana Cinema Hall') >= 0, 'office line as approved');
    assert.ok(wa.indexOf('after-care') >= 0, 'care angle as approved');
    assert.ok(wa.indexOf('Ramesh') >= 0, 'first name in message');
    assert.ok(wa.indexOf('13 টা মহকুমাত আৰু বহুতো ঠাইত') >= 0, 'Assamese reach line as approved');
    var native = app.referralShareText('SH7K2Q', 'Ramesh', false);
    assert.ok(native.indexOf('refer.html') < 0, 'native text leaves the form link to the shared URL');
    [wa, native].forEach(function (m) {
      assert.ok(m.indexOf('78,000') < 0 && m.indexOf('78000') < 0, 'no subsidy figure in advertising');
      assert.ok(m.indexOf('APDCL') < 0, 'no APDCL in advertising');
      assert.ok(!/300\+|305/.test(m), 'no install total in advertising');
    });
  });

  // ---------- 7. FirestoreDB referrals (mocked db) ----------
  await checkAsync('FirestoreDB.listReferrals: newest first', async function () {
    mockReferralDocs = [
      { id: 'r1', submittedAt: '2026-11-18T01:00:00.000Z', status: 'pending' },
      { id: 'r2', submittedAt: '2026-11-18T03:00:00.000Z', status: 'confirmed' },
      { id: 'r3', submittedAt: '2026-11-18T02:00:00.000Z', status: 'pending' }
    ];
    var list2 = await app.FirestoreDB.listReferrals();
    assert.deepStrictEqual(list2.map(function (r) { return r.id; }), ['r2', 'r3', 'r1']);
  });
  await checkAsync('FirestoreDB.saveReferral: writes the doc with merge', async function () {
    mockWrites = [];
    var r = { id: 'r1', referrerName: 'Ramesh Das', referrerConsumerNo: '040000100001', referrerMobile: '9876543210', referrerAddress: 'Kalpanagar', referredName: 'Anita', referredMobile: '8765432109', referredAddress: 'Bhalukdubi', referCode: 'SH7K2Q', status: 'confirmed', submittedBy: 'referrer', submittedAt: '2026-11-18T01:00:00.000Z', confirmedAt: '2026-11-18T02:00:00.000Z', referredCustomerId: 'c2' };
    await app.FirestoreDB.saveReferral(r);
    assert.strictEqual(mockWrites.length, 1);
    assert.strictEqual(mockWrites[0].op, 'set');
    assert.strictEqual(mockWrites[0].id, 'r1');
    assert.deepStrictEqual(mockWrites[0].opts, { merge: true });
    assert.strictEqual(mockWrites[0].data.status, 'confirmed');
    assert.strictEqual(mockWrites[0].data.referredCustomerId, 'c2');
  });

  // ---------- 8. Rules + form page ----------
  check('firestore.rules: referrals — public create, vendor-only read/update/delete', function () {
    var rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
    var block = rules.split('match /referrals/{docId}')[1].split('}')[0];
    assert.ok(/allow create:\s*if true/.test(block), 'public create');
    assert.ok(/allow read, update, delete:\s*if request\.auth != null/.test(block), 'vendor-only read/update/delete');
    assert.ok(rules.indexOf('Firebase console') >= 0, 'rules file notes the console publish step');
  });
  check('refer.html: bilingual, two modes, code prefill, no amounts / subsidy / APDCL', function () {
    var html = fs.readFileSync(path.join(__dirname, '..', 'refer.html'), 'utf8');
    assert.ok(html.indexOf('আপোনাৰ বিৱৰণ') >= 0, 'Assamese labels present');
    assert.ok(html.indexOf('setMode') >= 0 && html.indexOf("mode-friend") >= 0, 'mode toggle present');
    assert.ok(html.indexOf('URLSearchParams') >= 0 && html.indexOf("q.get('ref')") >= 0, 'code prefilled from ?ref=');
    assert.ok(html.indexOf('₹') < 0, 'no rupee amount anywhere on the form');
    assert.ok(html.indexOf('78,000') < 0 && html.indexOf('78000') < 0, 'no subsidy figure');
    assert.ok(html.indexOf('APDCL') < 0, 'no APDCL');
    assert.ok(html.indexOf('f-referrer-consumer') >= 0 && html.indexOf('f-referred-mobile') >= 0, 'all fields present');
    assert.ok(html.indexOf('\u09b0') < 0, 'no Bengali U+09B0 in the form');
  });
  check('refer-form.js: no amounts / subsidy / APDCL in the shared logic', function () {
    var js = fs.readFileSync(path.join(__dirname, '..', 'refer-form.js'), 'utf8');
    assert.ok(js.indexOf('₹') < 0 && js.indexOf('78000') < 0 && js.indexOf('APDCL') < 0);
  });

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

main().catch(function (e) { console.error(e); process.exit(1); });
