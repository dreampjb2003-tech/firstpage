/*
 * 사장님계산기 — 요일별 근무 입력칸 (여러 계산기 페이지가 함께 사용)
 */
(function (root) {
  'use strict';
  var NAMES = ['월', '화', '수', '목', '금', '토', '일'];

  function mk(onFn, start, end, brk) {
    return [0, 1, 2, 3, 4, 5, 6].map(function (i) { return { on: onFn(i), start: start, end: end, brk: brk }; });
  }
  var PRESETS = {
    full: function () { return mk(function (i) { return i < 5; }, '09:00', '18:00', 60); },
    weekend: function () { return mk(function (i) { return i >= 5; }, '10:00', '19:00', 60); },
    evening: function () { return mk(function (i) { return i < 5; }, '18:00', '22:00', 0); },
    night: function () { return mk(function (i) { return i < 5; }, '22:00', '07:00', 60); },
    blank: function () { return mk(function () { return false; }, '09:00', '18:00', 60); }
  };

  function parseTime(s) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ''));
    if (!m || +m[1] > 23 || +m[2] > 59) return null;
    return +m[1] * 60 + +m[2];
  }

  function workedMinutes(d) {
    if (!d || !d.on) return 0;
    var a = parseTime(d.start), b = parseTime(d.end);
    if (a === null || b === null || a === b) return 0;
    if (b < a) b += 1440;
    var w = b - a - (Number(d.brk) || 0);
    return w > 0 ? w : 0;
  }

  function weeklyMinutes(days) {
    return days.reduce(function (sum, d) { return sum + workedMinutes(d); }, 0);
  }

  function hm(min) {
    var h = Math.floor(min / 60), m = Math.round(min % 60);
    return h + '시간' + (m ? ' ' + m + '분' : '');
  }

  function q(box, i, k) { return box.querySelector('[data-i="' + i + '"][data-k="' + k + '"]'); }

  function build(box) {
    var html = '';
    NAMES.forEach(function (n, i) {
      html +=
        '<div class="day" data-day="' + i + '">' +
          '<label class="day-head"><input type="checkbox" data-k="on" data-i="' + i + '"> ' + n + '요일' +
          '<span class="day-sum" data-sum="' + i + '"></span></label>' +
          '<div class="day-body">' +
            '<label>시작<input type="time" step="600" data-k="start" data-i="' + i + '"></label>' +
            '<label>종료<input type="time" step="600" data-k="end" data-i="' + i + '"></label>' +
            '<label class="brk">휴게(분)<input type="number" inputmode="numeric" min="0" max="600" step="10" data-k="brk" data-i="' + i + '"></label>' +
          '</div>' +
        '</div>';
    });
    box.innerHTML = html;
  }

  function read(box) {
    var days = [];
    for (var i = 0; i < 7; i++) {
      days.push({
        on: q(box, i, 'on').checked,
        start: q(box, i, 'start').value,
        end: q(box, i, 'end').value,
        brk: q(box, i, 'brk').value === '' ? '' : Number(q(box, i, 'brk').value)
      });
    }
    return days;
  }

  function write(box, days) {
    for (var i = 0; i < 7; i++) {
      var d = days[i] || PRESETS.blank()[i];
      q(box, i, 'on').checked = !!d.on;
      q(box, i, 'start').value = d.start;
      q(box, i, 'end').value = d.end;
      q(box, i, 'brk').value = d.brk;
    }
  }

  /* 한 요일만 바꾸기 (시간표 드래그에서 사용). start가 null이면 그 요일을 끔 */
  function setDay(box, i, start, end) {
    if (start === null) { q(box, i, 'on').checked = false; return; }
    var wasOn = q(box, i, 'on').checked;
    q(box, i, 'on').checked = true;
    q(box, i, 'start').value = start;
    q(box, i, 'end').value = end;
    var brk = q(box, i, 'brk');
    // 새로 켠 요일이거나 휴게시간이 비어 있으면 법정 최소 휴게시간으로 채움
    // (4시간 근무에 30분, 8시간 근무에 1시간 → 머무는 시간 4시간 30분 초과 30분, 9시간 초과 1시간)
    if (!wasOn || brk.value === '') {
      var a = parseTime(start), b = parseTime(end);
      if (b <= a) b += 1440;
      var span = b - a;
      brk.value = span >= 540 ? 60 : span >= 270 ? 30 : 0;
    }
  }

  function sums(box, days) {
    days.forEach(function (d, i) {
      var el = box.querySelector('[data-day="' + i + '"]');
      el.classList.toggle('on', !!d.on);
      var w = workedMinutes(d);
      box.querySelector('[data-sum="' + i + '"]').textContent = d.on && w ? hm(w) : '';
    });
  }

  function sanitize(arr, fallback) {
    if (!Array.isArray(arr) || arr.length !== 7) return fallback;
    return arr.map(function (d, i) {
      var ok = d && /^\d{2}:\d{2}$/.test(d.start) && /^\d{2}:\d{2}$/.test(d.end) && /^\d{1,3}$/.test(String(d.brk));
      return ok ? { on: !!d.on, start: d.start, end: d.end, brk: Number(d.brk) } : fallback[i];
    });
  }

  function encode(days) {
    return days.map(function (x) {
      return (x.on ? '1' : '0') + '-' + x.start.replace(':', '') + '-' + x.end.replace(':', '') + '-' + x.brk;
    }).join('_');
  }

  function decode(str) {
    var out = String(str || '').split('_').map(function (t) {
      var m = /^([01])-(\d{2})(\d{2})-(\d{2})(\d{2})-(\d{1,3})$/.exec(t);
      return m ? { on: m[1] === '1', start: m[2] + ':' + m[3], end: m[4] + ':' + m[5], brk: m[6] } : null;
    });
    return out.length === 7 ? out : null;
  }

  root.SajangDays = {
    NAMES: NAMES, PRESETS: PRESETS, parseTime: parseTime, workedMinutes: workedMinutes,
    weeklyMinutes: weeklyMinutes, hm: hm, build: build, read: read, write: write, setDay: setDay,
    sums: sums, sanitize: sanitize, encode: encode, decode: decode
  };
})(window);
