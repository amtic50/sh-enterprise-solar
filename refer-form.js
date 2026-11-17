/* Shared referral-form logic for the public refer.html page.
   Browser: loaded as a classic script, exposes window.ReferForm.
   Node: module.exports = ReferForm (used by tests/v5-referral-form.test.js).
   This file has no DOM access and no Firebase import of its own — the
   caller passes a Firestore db handle to submitReferral. Validation is
   deliberately forgiving about typing (+91, spaces, dashes in mobiles;
   11-digit consumer numbers get the missing leading zero, the same
   convention the app uses everywhere else). No referral bonus amount
   is mentioned anywhere here — the vendor sets rewards in Settings.
   Two modes: 'referrer' (the customer refers a friend — both sides'
   details) and 'friend' (a friend who was referred opens the shared
   link and submits only their own details; the referrer is identified
   by the code). */
var ReferForm = (function () {
  /* Error codes returned by validateReferral; refer.html maps them to
     bilingual messages. Keep them short and stable. */
  var ERR_REQUIRED = 'required';
  var ERR_MOBILE = 'mobile';
  var ERR_CONSUMER_NO = 'consumerNo';
  var ERR_REFER_CODE = 'referCode';

  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function normMobile(s) {
    var d = digits(s);
    if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
    return d;
  }
  function normConsumerNo(s) {
    var d = digits(s);
    if (d.length === 11) d = '0' + d;
    return d;
  }
  function normReferCode(s) { return String(s || '').trim().toUpperCase(); }

  /* mode: 'referrer' (default) or 'friend'. In friend mode only the
     friend's own details and the refer code are required — the referrer
     is identified by the code, so their consumer number / mobile /
     address are not asked for (a name is accepted if the friend knows
     it). In referrer mode the code is optional. */
  function validateReferral(data, mode) {
    data = data || {};
    mode = mode === 'friend' ? 'friend' : 'referrer';
    var errors = {};
    var cleaned = {
      referrerName: String(data.referrerName || '').trim(),
      referrerConsumerNo: normConsumerNo(data.referrerConsumerNo),
      referrerMobile: normMobile(data.referrerMobile),
      referrerAddress: String(data.referrerAddress || '').trim(),
      referredName: String(data.referredName || '').trim(),
      referredMobile: normMobile(data.referredMobile),
      referredAddress: String(data.referredAddress || '').trim(),
      referCode: normReferCode(data.referCode)
    };
    if (mode === 'friend') {
      if (!cleaned.referredName) errors.referredName = ERR_REQUIRED;
      if (!/^[6-9]\d{9}$/.test(cleaned.referredMobile)) errors.referredMobile = ERR_MOBILE;
      if (!cleaned.referredAddress) errors.referredAddress = ERR_REQUIRED;
      if (!cleaned.referCode) errors.referCode = ERR_REQUIRED;
      else if (!/^SH[A-Z2-9]{4}$/.test(cleaned.referCode)) errors.referCode = ERR_REFER_CODE;
      /* Referrer fields are not required in friend mode; if the friend
         typed a consumer number / mobile, it must still be well-formed. */
      if (data.referrerConsumerNo && !/^\d{12}$/.test(cleaned.referrerConsumerNo)) errors.referrerConsumerNo = ERR_CONSUMER_NO;
      if (data.referrerMobile && !/^[6-9]\d{9}$/.test(cleaned.referrerMobile)) errors.referrerMobile = ERR_MOBILE;
      cleaned.referrerConsumerNo = '';
      cleaned.referrerMobile = '';
      cleaned.referrerAddress = '';
      return { ok: Object.keys(errors).length === 0, errors: errors, cleaned: cleaned, mode: mode };
    }
    if (!cleaned.referrerName) errors.referrerName = ERR_REQUIRED;
    if (!/^\d{12}$/.test(cleaned.referrerConsumerNo)) errors.referrerConsumerNo = ERR_CONSUMER_NO;
    if (!/^[6-9]\d{9}$/.test(cleaned.referrerMobile)) errors.referrerMobile = ERR_MOBILE;
    if (!cleaned.referrerAddress) errors.referrerAddress = ERR_REQUIRED;
    if (!cleaned.referredName) errors.referredName = ERR_REQUIRED;
    if (!/^[6-9]\d{9}$/.test(cleaned.referredMobile)) errors.referredMobile = ERR_MOBILE;
    if (!cleaned.referredAddress) errors.referredAddress = ERR_REQUIRED;
    if (cleaned.referCode && !/^SH[A-Z2-9]{4}$/.test(cleaned.referCode)) errors.referCode = ERR_REFER_CODE;
    return { ok: Object.keys(errors).length === 0, errors: errors, cleaned: cleaned, mode: mode };
  }

  /* The exact document written to the `referrals` collection. `now`
     is injectable for tests; defaults to the current time. `submittedBy`
     records who filled the form — the vendor list shows it. */
  function buildReferralDoc(data, now, mode) {
    var v = validateReferral(data, mode);
    if (!v.ok) return null;
    return {
      referrerName: v.cleaned.referrerName,
      referrerConsumerNo: v.cleaned.referrerConsumerNo,
      referrerMobile: v.cleaned.referrerMobile,
      referrerAddress: v.cleaned.referrerAddress,
      referredName: v.cleaned.referredName,
      referredMobile: v.cleaned.referredMobile,
      referredAddress: v.cleaned.referredAddress,
      referCode: v.cleaned.referCode,
      status: 'pending',
      submittedBy: v.mode,
      submittedAt: (now || new Date()).toISOString()
    };
  }

  /* One write, no login needed (the Firestore rules allow public
     CREATE on referrals/{id}). Returns the Firestore add() promise. */
  function submitReferral(db, data, now, mode) {
    var doc = buildReferralDoc(data, now, mode);
    if (!doc) return Promise.reject(new Error('invalid referral'));
    return db.collection('referrals').add(doc);
  }

  return {
    digits: digits,
    normMobile: normMobile,
    normConsumerNo: normConsumerNo,
    normReferCode: normReferCode,
    validateReferral: validateReferral,
    buildReferralDoc: buildReferralDoc,
    submitReferral: submitReferral
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ReferForm;
