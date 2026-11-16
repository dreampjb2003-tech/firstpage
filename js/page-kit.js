/*
 * 사장님계산기 — 계산기 페이지 공통 처리
 * 입력 읽기/쓰기, 예시 값·지우기, 이 기기 저장, 입력값 링크, 인쇄, 오류 표시, 기준값 표시.
 * 모든 계산은 브라우저 안에서만 이루어지며 서버로 아무것도 보내지 않습니다.
 */
(function (root) {
  'use strict';
  var R = root.SAJANG_RATES, C = root.SajangCalc, D = root.SajangDays;
  var $ = function (id) { return document.getElementById(id); };

  function pct(r) { return (Math.round(r * 100000) / 1000) + '%'; }

  function fillRates() {
    var map = {
      mw: C.fmt(R.minimumWage), mwYear: String(R.minimumWageYear), effectiveFrom: R.effectiveFrom,
      verified: R.verifiedDate || '[직접 작성 필요]',
      npTotal: pct(R.nationalPension.employer + R.nationalPension.employee), npEr: pct(R.nationalPension.employer), npEe: pct(R.nationalPension.employee),
      hiTotal: pct(R.healthInsurance.employer + R.healthInsurance.employee), hiEr: pct(R.healthInsurance.employer), hiEe: pct(R.healthInsurance.employee),
      ltc: pct(R.longTermCare.ratioOfHealth),
      eiTotal: pct(R.employmentInsurance.employer + R.employmentInsurance.employee), eiEr: pct(R.employmentInsurance.employer), eiEe: pct(R.employmentInsurance.employee),
      npMin: C.fmt(R.nationalPension.baseMin), npMax: C.fmt(R.nationalPension.baseMax)
    };
    document.querySelectorAll('[data-r]').forEach(function (el) {
      var k = el.getAttribute('data-r');
      if (map[k] !== undefined) el.textContent = map[k];
      if (k === 'verified' && R.verifiedDate) el.classList.remove('todo');
    });
  }

  function toast(msg) {
    var t = $('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2000);
  }

  function basis() {
    var vd = R.verifiedDate ? R.verifiedDate : '<span class="todo">[직접 작성 필요]</span>';
    return '<p class="basis">' + R.effectiveFrom + ' 적용 기준 · 공식 고시 확인일 ' + vd +
      (R.minimumWageStale ? ' · <span class="todo">' + R.asOf.slice(0, 4) + '년 최저임금 반영 필요</span>' : '') +
      (R.upcoming.length ? ' · 예정된 변경: ' + R.upcoming.join(', ') + ' (시작일에 자동 반영)' : '') +
      ' · 결과는 참고용 추정치이며 실제 금액과 다를 수 있습니다.</p>';
  }

  /*
   * cfg = { key, fields:[name...], days:bool, defaults:{}, blank:{}, presets:{name: fn(state)},
   *         compute: fn(state) → {ok, errors, html}, isBlank: fn(state) }
   */
  function init(cfg) {
    var form = $('calc-form'); if (!form) return;
    var resultBox = $('result'), body = $('result-body'), errorBox = $('errors');
    var daysBox = cfg.days ? $('days') : null, grid = null;

    function el(name) { return form.querySelectorAll('[name="' + name + '"]'); }

    function read() {
      var s = {};
      cfg.fields.forEach(function (n) {
        var els = el(n); if (!els.length) return;
        var e = els[0];
        if (e.type === 'radio') { var c = form.querySelector('[name="' + n + '"]:checked'); s[n] = c ? c.value : ''; }
        else s[n] = String(e.value).replace(/,/g, '').trim();
      });
      if (daysBox) s.days = D.read(daysBox);
      return s;
    }

    function write(s) {
      cfg.fields.forEach(function (n) {
        var els = el(n); if (!els.length || s[n] === undefined) return;
        if (els[0].type === 'radio') els.forEach(function (e) { e.checked = e.value === String(s[n]); });
        else els[0].value = s[n];
      });
      if (daysBox && s.days) D.write(daysBox, s.days);
    }

    function clone(o) { return JSON.parse(JSON.stringify(o)); }

    function sanitize(o) {
      if (!o || typeof o !== 'object') return null;
      var s = clone(cfg.defaults);
      cfg.fields.forEach(function (n) {
        if (o[n] === undefined || o[n] === null) return;
        var v = String(o[n]);
        if (v.length <= 20 && /^[0-9A-Za-z.\-_]*$/.test(v)) s[n] = v;
      });
      if (daysBox) s.days = D.sanitize(o.days, cfg.defaults.days);
      return s;
    }

    function toQuery(s) {
      var p = new URLSearchParams();
      cfg.fields.forEach(function (n) { if (s[n] !== undefined && s[n] !== '') p.set(n, s[n]); });
      if (daysBox) p.set('d', D.encode(s.days));
      return '?' + p.toString();
    }
    function fromQuery(q) {
      var p = new URLSearchParams(q), o = {}, any = false;
      cfg.fields.forEach(function (n) { if (p.has(n)) { o[n] = p.get(n); any = true; } });
      if (daysBox && p.has('d')) { o.days = D.decode(p.get('d')); any = true; }
      return any ? sanitize(o) : null;
    }
    function save(s) { try { localStorage.setItem(cfg.key, JSON.stringify(s)); } catch (e) { /* 무시 */ } }
    function load() { try { var r = localStorage.getItem(cfg.key); return r ? sanitize(JSON.parse(r)) : null; } catch (e) { return null; } }

    function modeSync(s) {
      document.querySelectorAll('[data-show-when]').forEach(function (e) {
        var parts = e.getAttribute('data-show-when').split('=');
        e.hidden = String(s[parts[0]]) !== parts[1];
      });
    }

    function render(s) {
      form.querySelectorAll('.invalid').forEach(function (e) { e.classList.remove('invalid'); });
      errorBox.innerHTML = '';
      if (cfg.isBlank && cfg.isBlank(s)) {
        errorBox.innerHTML = '<div class="note note-info">값을 입력하면 결과가 바로 나타납니다. 처음이라면 위의 \'예시 값 넣기\'를 눌러 보세요.</div>';
        resultBox.hidden = true; return { ok: false };
      }
      var out = cfg.compute(s);
      if (!out.ok) {
        var h = '<div class="note note-err" role="alert"><ul>';
        out.errors.forEach(function (e) {
          h += '<li>' + e.msg + '</li>';
          if (e.field === 'days' && daysBox) daysBox.classList.add('invalid');
          else if (/^day\d$/.test(e.field) && daysBox) daysBox.querySelector('[data-day="' + e.field.slice(3) + '"]').querySelectorAll('input[type="time"],input[type="number"]').forEach(function (x) { x.classList.add('invalid'); });
          else el(e.field).forEach(function (x) { if (x.type !== 'radio') x.classList.add('invalid'); });
        });
        errorBox.innerHTML = h + '</ul></div>';
        resultBox.hidden = true; return out;
      }
      var w = '';
      if (out.warnings && out.warnings.length) {
        w = '<div class="note note-warn" role="status"><ul>' + out.warnings.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>';
      }
      body.innerHTML = w + out.html + basis();
      resultBox.hidden = false;
      return out;
    }

    function run(opts) {
      var s = read();
      modeSync(s);
      if (daysBox) { D.sums(daysBox, s.days); if (grid) grid.refresh(s.days); }
      var out = render(s);
      save(s);
      if (opts && opts.scroll && out.ok) resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // 시작
    fillRates();
    if (cfg.setup) cfg.setup(form);
    if (daysBox) D.build(daysBox);
    if (daysBox && $('schedule-grid') && root.SajangGrid) {
      grid = root.SajangGrid.mount($('schedule-grid'), { onSet: function (i, a, b) { D.setDay(daysBox, i, a, b); run(); } });
    }
    write(fromQuery(location.search) || load() || clone(cfg.defaults));

    form.addEventListener('input', function () { run(); });
    form.addEventListener('change', function () { run(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); run({ scroll: true }); });
    document.querySelectorAll('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = b.getAttribute('data-preset');
        if (p === 'example') write(clone(cfg.defaults));
        else if (p === 'clear') write(clone(cfg.blank));
        else if (daysBox && D.PRESETS[p]) D.write(daysBox, D.PRESETS[p]());
        run();
      });
    });
    var copy = $('btn-copy'), print = $('btn-print'), reset = $('btn-reset');
    if (copy) copy.addEventListener('click', function () {
      var url = location.origin + location.pathname + toQuery(read());
      if (navigator.clipboard && root.isSecureContext) navigator.clipboard.writeText(url).then(function () { toast('입력값이 담긴 링크를 복사했습니다'); }, function () { root.prompt('아래 링크를 복사하세요', url); });
      else root.prompt('아래 링크를 복사하세요', url);
    });
    if (print) print.addEventListener('click', function () { root.print(); });
    if (reset) reset.addEventListener('click', function () { write(clone(cfg.defaults)); run(); form.scrollIntoView({ behavior: 'smooth' }); });
    run();
  }

  /* 결과 화면 조각 */
  function won(n) { return C.fmt(n) + '원'; }
  function summary(label, big, subs) {
    var h = '<div class="summary" aria-live="polite"><div class="label">' + label + '</div><div class="big">' + big + '</div>';
    if (subs && subs.length) h += '<div class="sub">' + subs.map(function (s) { return '<div>' + s[0] + '<b>' + s[1] + '</b></div>'; }).join('') + '</div>';
    return h + '</div>';
  }
  function badges(list) {
    return '<ul class="badges">' + list.map(function (b) { return '<li class="badge ' + (b[0] ? 'yes' : 'no') + '">' + (b[0] ? '✓ ' + b[1] : '✕ ' + b[2]) + '</li>'; }).join('') + '</ul>';
  }
  function table(title, head, rows) {
    var h = (title ? '<h3>' + title + '</h3>' : '') + '<div class="table-scroll"><table class="fit detail"><thead><tr>' +
      head.map(function (x, i) { return '<th' + (i ? ' class="num"' : '') + '>' + x + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      var cls = r.cls ? ' class="' + r.cls + '"' : '';
      h += '<tr' + cls + '>' + r.cells.map(function (c, i) { return i ? '<td class="num">' + c + '</td>' : '<td>' + c + '</td>'; }).join('') + '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  root.SajangPage = { init: init, won: won, summary: summary, badges: badges, table: table, pct: pct, toast: toast };
})(window);
