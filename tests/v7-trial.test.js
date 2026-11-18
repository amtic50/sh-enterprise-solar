// Tests for the v7 limited demo / trial mode:
// - ?demo= flag detection + per-browser persistence (?demo=1 on, ?demo=0 off)
// - trial limits: 5 messages AND 3 days from first use, whichever first
// - trial state lives in Firestore (meta/trial); normal mode never reads it
// - demo mode never changes the data source (real Firestore customers when
//   logged in; sample preview only when logged out, as today)
// - lock screen shows no customer data
// Run: node tests/v7-trial.test.js  (from ~/workspace/solar-vendor-demo)
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

// Mock Firestore BEFORE requiring app.js. Records every call so the tests
// can prove the trial only ever touches meta/trial — never customers.
var mockTrialDoc = null;
var mockCalls = [];
var mockGetError = false;
global.db = {
  collection: function (name) {
    return {
      doc: function (id) {
        return {
          get: function () {
            mockCalls.push({ collection: name, doc: id, op: 'get' });
            if (mockGetError) return Promise.reject(new Error('mock get failed'));
            return Promise.resolve({ exists: mockTrialDoc !== null, data: function () { return mockTrialDoc; } });
          },
          set: function (data, opts) {
            mockCalls.push({ collection: name, doc: id, op: 'set', data: JSON.parse(JSON.stringify(data)), opts: opts || null });
            if (opts && opts.merge) mockTrialDoc = Object.assign({}, mockTrialDoc || {}, JSON.parse(JSON.stringify(data)));
            else mockTrialDoc = JSON.parse(JSON.stringify(data));
            return Promise.resolve();
          }
        };
      }
    };
  }
};

var app = require('../app.js');
var assert = require('assert');
app._setDb(global.db);
app._setFirebaseReady(true);
app._setAuthed(true);

var passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('ok - ' + name); }
  catch (e) { failed++; console.log('FAIL - ' + name + ': ' + e.message); }
}
function checkAsync(name, fn) {
  return Promise.resolve().then(fn).then(function () { passed++; console.log('ok - ' + name); })
    .catch(function (e) { failed++; console.log('FAIL - ' + name + ': ' + e.message); });
}
function clearStorage() {
  var m = global.localStorage._mem;
  Object.keys(m).forEach(function (k) { delete m[k]; });
}
function resetState() {
  mockTrialDoc = null; mockCalls = []; mockGetError = false;
  app._setDemoMode(false);
  app._setTrial(null);
  clearStorage();
}
function trialAt(sent, startISO) {
  return { startedAt: startISO || null, days: 3, messageLimit: 5, messagesSent: sent };
}

async function main() {
  // ---------- 1. Demo flag detection + persistence ----------
  check('demoFlagFromSearch: ?demo=1 on, ?demo=0 off, anything else null', function () {
    assert.strictEqual(app.demoFlagFromSearch('?demo=1'), 'on');
    assert.strictEqual(app.demoFlagFromSearch('?demo=0'), 'off');
    assert.strictEqual(app.demoFlagFromSearch(''), null);
    assert.strictEqual(app.demoFlagFromSearch('?c=01x0ejil'), null);
    assert.strictEqual(app.demoFlagFromSearch('?demo=2'), null);
    assert.strictEqual(app.demoFlagFromSearch('?demo=1&c=x'), 'on');
  });
  check('detectDemoMode: URL flag wins and persists; removing it does not escape', function () {
    clearStorage();
    assert.strictEqual(app.detectDemoMode('?demo=1'), true);
    assert.strictEqual(JSON.parse(global.localStorage.getItem(app.TRIAL_LS_KEY)), '1', 'flag saved (store JSON-encodes it)');
    assert.strictEqual(app.detectDemoMode(''), true, 'persisted flag keeps demo on');
    assert.strictEqual(app.detectDemoMode('?demo=0'), false);
    assert.strictEqual(JSON.parse(global.localStorage.getItem(app.TRIAL_LS_KEY)), '0');
    assert.strictEqual(app.detectDemoMode(''), false);
  });

  // ---------- 2. Pure trial math ----------
  check('defaultTrial: 3 days, 5 messages, not started', function () {
    assert.deepStrictEqual(app.defaultTrial(), { startedAt: null, days: 3, messageLimit: 5, messagesSent: 0 });
  });
  check('message cap: 5 allowed, 6th blocked (trialMessagesLeft / trialIsLocked)', function () {
    assert.strictEqual(app.trialMessagesLeft(trialAt(0)), 5);
    assert.strictEqual(app.trialMessagesLeft(trialAt(4)), 1);
    assert.strictEqual(app.trialMessagesLeft(trialAt(5)), 0);
    assert.strictEqual(app.trialMessagesLeft(trialAt(9)), 0);
    assert.strictEqual(app.trialIsLocked(trialAt(4), Date.now()), false);
    assert.strictEqual(app.trialIsLocked(trialAt(5), Date.now()), true);
    assert.strictEqual(app.trialIsLocked(null, Date.now()), false);
  });
  check('day expiry: 3 days from start; days left counts down', function () {
    var start = Date.parse('2026-11-18T00:00:00.000Z');
    var t = trialAt(0, '2026-11-18T00:00:00.000Z');
    assert.strictEqual(app.trialIsExpired(t, start + 2 * 86400000), false);
    assert.strictEqual(app.trialDaysLeft(t, start + 2 * 86400000), 1);
    assert.strictEqual(app.trialIsExpired(t, start + 3 * 86400000), true);
    assert.strictEqual(app.trialDaysLeft(t, start + 3 * 86400000), 0);
    assert.strictEqual(app.trialIsLocked(t, start + 3 * 86400000), true);
    assert.strictEqual(app.trialIsExpired(trialAt(0, null), Date.now()), false, 'not started yet never expires');
  });

  // ---------- 3. Module-state gate ----------
  check('trialAllowShare/trialLocked: normal mode never locked, demo fails open when unloaded', function () {
    resetState();
    app._setTrial(trialAt(5, '2026-11-18T00:00:00.000Z'));
    assert.strictEqual(app.trialAllowShare(), true, 'normal mode allows even with a locked trial set');
    assert.strictEqual(app.trialLocked(), false, 'normal mode never locked');
    app._setDemoMode(true);
    assert.strictEqual(app.trialAllowShare(), false, 'demo + 5 sent blocks');
    assert.strictEqual(app.trialLocked(), true);
    app._setTrial(null);
    assert.strictEqual(app.trialAllowShare(), true, 'demo + trial not loaded fails open');
    assert.strictEqual(app.trialLocked(), false);
    app._setTrial(trialAt(0, new Date().toISOString()));
    assert.strictEqual(app.trialAllowShare(), true);
  });

  // ---------- 4. loadTrial ----------
  await checkAsync('loadTrial: normal mode never reads the trial doc', async function () {
    resetState();
    app._setDemoMode(false);
    var t = await app.loadTrial();
    assert.strictEqual(t, null);
    assert.strictEqual(mockCalls.length, 0, 'no Firestore calls in normal mode');
  });
  await checkAsync('loadTrial: first demo load creates the trial doc and starts the clock', async function () {
    resetState();
    app._setDemoMode(true);
    var before = Date.now();
    var t = await app.loadTrial();
    assert.ok(t && t.startedAt, 'startedAt set');
    assert.ok(Date.parse(t.startedAt) >= before - 1000, 'startedAt is now');
    assert.strictEqual(t.messagesSent, 0);
    assert.strictEqual(mockTrialDoc.startedAt, t.startedAt, 'doc written');
    var sets = mockCalls.filter(function (c) { return c.op === 'set'; });
    assert.strictEqual(sets.length, 1);
    assert.strictEqual(sets[0].collection, 'meta');
    assert.strictEqual(sets[0].doc, 'trial');
    assert.strictEqual(sets[0].opts, null, 'create is a full set, not a merge');
  });
  await checkAsync('loadTrial: existing trial is kept; startedAt is set only once', async function () {
    resetState();
    app._setDemoMode(true);
    mockTrialDoc = { startedAt: '2026-11-18T00:00:00.000Z', days: 3, messageLimit: 5, messagesSent: 2 };
    var t = await app.loadTrial();
    assert.strictEqual(t.startedAt, '2026-11-18T00:00:00.000Z');
    assert.strictEqual(t.messagesSent, 2);
    assert.strictEqual(mockCalls.filter(function (c) { return c.op === 'set'; }).length, 0, 'no write when startedAt already set');
    mockTrialDoc = { startedAt: null, days: 3, messageLimit: 5, messagesSent: 0 };
    mockCalls = [];
    t = await app.loadTrial();
    assert.ok(t.startedAt, 'startedAt set on null');
    assert.strictEqual(mockCalls.filter(function (c) { return c.op === 'set'; }).length, 1);
  });
  await checkAsync('loadTrial: read failure fails open (demo runs unlocked, banner says so)', async function () {
    resetState();
    app._setDemoMode(true);
    mockGetError = true;
    var t = await app.loadTrial();
    assert.strictEqual(t, null);
    assert.strictEqual(app.trialAllowShare(), true);
    assert.strictEqual(app.trialLocked(), false);
    assert.ok(app.trialBannerHTML().indexOf('could not be checked') >= 0, 'banner reports the failure');
  });

  // ---------- 5. Counting + cap ----------
  await checkAsync('trialRecordShare: counts up to 5, 6th blocked; merge writes to meta/trial', async function () {
    resetState();
    app._setDemoMode(true);
    app._setTrial(trialAt(0, new Date().toISOString()));
    for (var i = 0; i < 5; i++) {
      assert.strictEqual(app.trialAllowShare(), true, 'share ' + (i + 1) + ' allowed');
      app.trialRecordShare();
    }
    assert.strictEqual(app._getTrial().messagesSent, 5);
    assert.strictEqual(app.trialAllowShare(), false, '6th share blocked');
    assert.strictEqual(app.trialLocked(), true);
    var writes = mockCalls.filter(function (c) { return c.op === 'set'; });
    assert.strictEqual(writes.length, 5);
    assert.ok(writes.every(function (w) { return w.collection === 'meta' && w.doc === 'trial' && w.opts && w.opts.merge === true; }), 'merge writes to meta/trial only');
    assert.strictEqual(mockTrialDoc.messagesSent, 5);
  });
  check('trialRecordShare: no-op in normal mode (no count, no write)', function () {
    resetState();
    app._setTrial(trialAt(0, new Date().toISOString()));
    app.trialRecordShare();
    assert.strictEqual(app._getTrial().messagesSent, 0);
    assert.strictEqual(mockCalls.length, 0);
  });
  await checkAsync('resetTrial: clears startedAt + messagesSent, writes the whole doc', async function () {
    resetState();
    app._setDemoMode(true);
    mockTrialDoc = { startedAt: '2026-11-18T00:00:00.000Z', days: 3, messageLimit: 5, messagesSent: 5 };
    var t = await app.resetTrial();
    assert.strictEqual(t.startedAt, null);
    assert.strictEqual(t.messagesSent, 0);
    assert.strictEqual(mockTrialDoc.startedAt, null);
    assert.strictEqual(mockTrialDoc.messagesSent, 0);
    assert.strictEqual(app.trialAllowShare(), true, 'fresh trial allows shares again');
  });
  await checkAsync('recordSent: a vendor send counts against the trial in demo mode only', async function () {
    resetState();
    var list = await app.SampleDB.listCustomers();
    var c = list[0];
    app._setTrial(trialAt(0, new Date().toISOString()));
    await app.recordSent(c, 'WhatsApp', 'festival', 'regular');
    assert.strictEqual(app._getTrial().messagesSent, 0, 'normal mode does not count');
    app._setDemoMode(true);
    await app.recordSent(c, 'SMS', 'festival', 'regular');
    assert.strictEqual(app._getTrial().messagesSent, 1, 'demo mode counts the send');
  });

  // ---------- 6. Demo never changes the data source ----------
  await checkAsync('demo mode never touches customer data or the data source', async function () {
    resetState();
    var modeBefore = app._getMode();
    app._setDemoMode(true);
    await app.loadTrial();
    app._setTrial(trialAt(0, new Date().toISOString()));
    app.trialRecordShare();
    await app.resetTrial();
    assert.strictEqual(app._getMode(), modeBefore, 'mode unchanged by trial operations');
    assert.ok(mockCalls.length > 0, 'trial did use Firestore (not a vacuous pass)');
    assert.ok(mockCalls.every(function (c) { return c.collection === 'meta' && c.doc === 'trial'; }), 'trial only ever touches meta/trial, never customers');
  });

  // ---------- 7. Lock screen + banner: no customer data, no banned copy ----------
  check('trialLockHTML: no customer data, states the trial terms + contact Amit', function () {
    var html = app.trialLockHTML();
    assert.ok(html.indexOf('5 messages over 3 days') >= 0, 'trial terms stated');
    assert.ok(/contact Amit/i.test(html), 'contact Amit');
    assert.ok(!/\d{12}/.test(html), 'no 12-digit consumer number');
    assert.ok(html.indexOf('040000') < 0, 'no consumer number prefix');
    ['Ramesh Das', 'Anita Rabha', 'Babul Hussain', '9876543210', '8765432109'].forEach(function (s) {
      assert.ok(html.indexOf(s) < 0, 'no customer data: ' + s);
    });
    assert.ok(html.indexOf('78,000') < 0 && html.indexOf('78000') < 0, 'no subsidy figure');
    assert.ok(html.indexOf('APDCL') < 0, 'no APDCL');
  });
  check('trialBannerHTML: demo shows counts, normal mode shows nothing, no customer data', function () {
    resetState();
    assert.strictEqual(app.trialBannerHTML(), '', 'no banner in normal mode');
    app._setDemoMode(true);
    app._setTrial(trialAt(2, new Date().toISOString()));
    var b = app.trialBannerHTML();
    assert.ok(b.indexOf('3 of 5 messages left') >= 0, 'messages left shown');
    assert.ok(b.indexOf('DEMO') >= 0);
    assert.ok(!/\d{12}/.test(b), 'no customer data in banner');
    assert.ok(b.indexOf('78,000') < 0 && b.indexOf('APDCL') < 0, 'no subsidy/APDCL in banner');
  });

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

main().catch(function (e) { console.error(e); process.exit(1); });
