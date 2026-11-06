/* Shared frontend RB7 campus and travel-gap rules. */
(function (root) {
  const MAIN_CAMPUS = '140 Lê Trọng Tấn';
  // The dot-thi API currently omits SoTietDiChuyenToiThieu; keep its
  // backwards-compatible default here until that configuration is exposed.
  const DEFAULT_MIN_TRAVEL_SLOTS = 1;
  const EXTRA_WHITESPACE = /[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/g;

  function isMainCampusRoom(room) {
    const value = String(room || '');
    const separator = value.indexOf(' - ');
    if (separator < 0) return null;

    const campus = value.slice(separator + 3).replace(EXTRA_WHITESPACE, ' ').trim();
    if (!campus) return null;

    const campusKey = campus.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '');
    const mainKey = MAIN_CAMPUS.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '');
    return campusKey === mainKey;
  }

  function minTravelSlots(value) {
    if (value === undefined || value === null || value === '') return DEFAULT_MIN_TRAVEL_SLOTS;
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 4 ? number : null;
  }

  function teachingExamResult(room, teachingStart, teachingEnd, examStart, examEnd, minSlots) {
    if (isMainCampusRoom(room) !== false) return { eligible: false, violation: false };
    if (teachingStart <= examEnd && examStart <= teachingEnd) {
      return { eligible: false, violation: false };
    }

    let gap;
    if (teachingEnd < examStart) gap = examStart - teachingEnd - 1;
    else if (examEnd < teachingStart) gap = teachingStart - examEnd - 1;
    else return { eligible: false, violation: false };

    if (!Number.isInteger(minSlots) || minSlots < 1 || minSlots > 4) {
      return { eligible: true, violation: false };
    }
    return { eligible: true, violation: gap < minSlots };
  }

  root.RB7 = {
    DEFAULT_MIN_TRAVEL_SLOTS,
    isMainCampusRoom,
    minTravelSlots,
    teachingExamResult
  };
})(globalThis);
