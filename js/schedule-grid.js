/*
 * 사장님계산기 — 근무 시간표 드래그
 *  - PC: 마우스로 누른 채 드래그해서 칠하기
 *  - 휴대폰: 시작 칸 → 끝 칸 차례로 누르기 (드래그는 화면 스크롤과 부딪히므로)
 *  - 같은 칸을 두 번 누르면 그 요일을 지움
 *  - 키보드: 화살표로 이동, 스페이스/엔터로 누르기, Esc로 취소
 * 칠한 결과는 요일별 시작·종료 입력칸에 그대로 들어갑니다.
 */
(function (root) {
  'use strict';
  var D = root.SajangDays;
  var BASE = 360;          // 06:00 시작
  var SLOTS = 52;          // 30분 × 52칸 = 06:00 ~ 다음 날 08:00
  var VIEW_FROM = 4, VIEW_TO = 36; // 기본 표시: 08:00 ~ 24:00

  function t(min) {
    var m = ((min % 1440) + 1440) % 1440;
    return (m < 600 ? '0' : '') + Math.floor(m / 60) + ':' + (m % 60 < 10 ? '0' : '') + (m % 60);
  }
  function label(s) {
    var min = BASE + s * 30;
    return (min >= 1440 ? '익일 ' : '') + t(min);
  }

  function slotsOf(d) {
    var out = {};
    if (!d || !d.on) return out;
    var a = D.parseTime(d.start), b = D.parseTime(d.end);
    if (a === null || b === null || a === b) return out;
    var span = (b - a + 1440) % 1440;
    var s = a < BASE ? a + 1440 : a, e = s + span;
    var from = Math.max(0, Math.floor((s - BASE) / 30)), to = Math.min(SLOTS - 1, Math.ceil((e - BASE) / 30) - 1);
    for (var k = from; k <= to; k++) out[k] = true;
    return out;
  }

  function mount(el, opts) {
    var expanded = false, anchor = null, down = null, preview = null, cursor = { d: 0, s: 6 };
    var days = [];

    var html = '<div class="sg-bar"><span class="sg-status" aria-live="polite"></span>' +
      '<button type="button" class="btn btn-sm sg-expand">전체 시간 보기</button></div>' +
      '<p class="hint sg-help">PC는 드래그, 휴대폰은 <b>시작 칸 → 끝 칸</b>을 차례로 누르세요. 같은 칸을 두 번 누르면 그 요일이 지워집니다.</p>' +
      '<div class="sg-scroll" tabindex="0" role="grid" aria-label="주간 근무 시간표. 화살표로 이동하고 스페이스로 시작과 끝을 고르세요.">' +
      '<div class="sg-grid"><div class="sg-corner"></div>';
    D.NAMES.forEach(function (n) { html += '<div class="sg-head" role="columnheader">' + n + '</div>'; });
    for (var s = 0; s < SLOTS; s++) {
      var hidden = s < VIEW_FROM || s >= VIEW_TO ? ' sg-out' : '';
      html += '<div class="sg-time' + hidden + (s % 2 ? ' half' : '') + '" data-row="' + s + '">' + (s % 2 ? '' : label(s)) + '</div>';
      for (var d = 0; d < 7; d++) {
        html += '<div class="sg-cell' + hidden + (s % 2 ? ' half' : '') + '" role="gridcell" id="sg-' + d + '-' + s + '" data-d="' + d + '" data-s="' + s + '" aria-label="' + D.NAMES[d] + '요일 ' + label(s) + '"></div>';
      }
    }
    html += '</div></div>';
    el.innerHTML = html;

    var scroller = el.querySelector('.sg-scroll');
    var status = el.querySelector('.sg-status');
    var expandBtn = el.querySelector('.sg-expand');

    function cell(d, s) { return el.querySelector('#sg-' + d + '-' + s); }
    function cellFrom(target) { return target && target.closest ? target.closest('.sg-cell') : null; }

    function setExpanded(v) {
      expanded = v;
      el.classList.toggle('sg-expanded', v);
      expandBtn.textContent = v ? '기본 시간만 보기' : '전체 시간 보기';
    }
    expandBtn.addEventListener('click', function () { setExpanded(!expanded); });

    function commit(d, s1, s2) {
      var a = Math.min(s1, s2), b = Math.max(s1, s2);
      opts.onSet(d, t(BASE + a * 30), t(BASE + (b + 1) * 30));
    }

    function tap(d, s) {
      if (anchor && anchor.d === d) {
        var filled = !!slotsOf(days[d])[s];
        if (anchor.s === s && filled) opts.onSet(d, null, null);
        else commit(d, anchor.s, s);
        anchor = null;
      } else {
        anchor = { d: d, s: s };
      }
      paint();
    }

    function paint() {
      for (var d = 0; d < 7; d++) {
        var on = slotsOf(days[d]);
        for (var s = 0; s < SLOTS; s++) {
          var c = cell(d, s);
          var inPrev = preview && preview.d === d && s >= Math.min(preview.a, preview.b) && s <= Math.max(preview.a, preview.b);
          c.classList.toggle('on', !!on[s]);
          c.classList.toggle('prev', !!inPrev);
          c.classList.toggle('anchor', !!(anchor && anchor.d === d && anchor.s === s));
          c.classList.toggle('cur', cursor.d === d && cursor.s === s && el.classList.contains('sg-focus'));
          c.setAttribute('aria-selected', on[s] ? 'true' : 'false');
        }
      }
      var wm = D.weeklyMinutes(days);
      var msg = '주 ' + D.hm(wm) + ' → ';
      msg += wm >= 900 ? '<b class="ok">주휴수당 발생</b>' : wm === 0 ? '근무 시간을 칠해 주세요' : '15시간까지 ' + D.hm(900 - wm) + ' 남음 (주휴수당 없음)';
      if (anchor) msg = D.NAMES[anchor.d] + '요일 ' + label(anchor.s) + ' 선택됨 → <b>끝나는 칸</b>을 누르세요';
      status.innerHTML = msg;
      scroller.setAttribute('aria-activedescendant', 'sg-' + cursor.d + '-' + cursor.s);
    }

    /* 마우스·터치 */
    scroller.addEventListener('pointerdown', function (e) {
      var c = cellFrom(e.target);
      if (!c || (e.pointerType === 'mouse' && e.button !== 0)) return;
      down = { d: +c.dataset.d, s: +c.dataset.s, type: e.pointerType, x: e.clientX, y: e.clientY, moved: false };
      if (e.pointerType === 'mouse') e.preventDefault();
    });
    scroller.addEventListener('pointermove', function (e) {
      if (!down) return;
      if (down.type !== 'mouse') {
        if (Math.abs(e.clientX - down.x) > 8 || Math.abs(e.clientY - down.y) > 8) down.moved = true; // 스크롤로 판단
        return;
      }
      var c = cellFrom(document.elementFromPoint(e.clientX, e.clientY));
      if (!c || +c.dataset.d !== down.d) return;
      var s = +c.dataset.s;
      if (s !== down.s) down.moved = true;
      if (down.moved) { anchor = null; preview = { d: down.d, a: down.s, b: s }; paint(); }
    });
    function end(e) {
      if (!down) return;
      var dn = down; down = null;
      if (dn.type === 'mouse' && dn.moved && preview) {
        var p = preview; preview = null;
        commit(p.d, p.a, p.b);
        return;
      }
      preview = null;
      if (dn.type !== 'mouse' && dn.moved) return; // 스크롤한 경우 무시
      tap(dn.d, dn.s);
    }
    scroller.addEventListener('pointerup', end);
    scroller.addEventListener('pointercancel', function () { down = null; preview = null; paint(); });
    document.addEventListener('pointerup', function () { if (down && down.type === 'mouse') end(); });

    /* 키보드 */
    scroller.addEventListener('focus', function () { el.classList.add('sg-focus'); paint(); });
    scroller.addEventListener('blur', function () { el.classList.remove('sg-focus'); paint(); });
    scroller.addEventListener('keydown', function (e) {
      var k = e.key, moved = true;
      if (k === 'ArrowRight') cursor.d = Math.min(6, cursor.d + 1);
      else if (k === 'ArrowLeft') cursor.d = Math.max(0, cursor.d - 1);
      else if (k === 'ArrowDown') cursor.s = Math.min(SLOTS - 1, cursor.s + 1);
      else if (k === 'ArrowUp') cursor.s = Math.max(0, cursor.s - 1);
      else if (k === ' ' || k === 'Enter') { tap(cursor.d, cursor.s); moved = false; }
      else if (k === 'Escape') { anchor = null; moved = false; }
      else return;
      e.preventDefault();
      if (moved && (cursor.s < VIEW_FROM || cursor.s >= VIEW_TO) && !expanded) setExpanded(true);
      paint();
      if (moved) { var c = cell(cursor.d, cursor.s); if (c.scrollIntoView) c.scrollIntoView({ block: 'nearest' }); }
    });

    return {
      refresh: function (newDays) {
        days = newDays;
        // 기본 표시 범위 밖에 칠해진 칸이 있으면 전체 시간 보기로 전환
        if (!expanded) {
          for (var d = 0; d < 7; d++) {
            var on = slotsOf(days[d]);
            for (var s in on) if (s < VIEW_FROM || s >= VIEW_TO) { setExpanded(true); break; }
          }
        }
        paint();
      }
    };
  }

  root.SajangGrid = { mount: mount };
})(window);
