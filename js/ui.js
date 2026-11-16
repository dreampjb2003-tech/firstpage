/*
 * 사장님계산기 — 화면 처리 (입력 읽기, 결과 그리기, 저장, 링크 복사, 인쇄)
 * 모든 계산은 브라우저 안에서만 이루어지며 서버로 아무것도 보내지 않습니다.
 */
(function () {
  'use strict';
  var R = window.SAJANG_RATES;
  var C = window.SajangCalc;
  var fmt = C.fmt;
  var STORE_KEY = 'sajang-calc-v1';
  var form = document.getElementById('calc-form');
  if (!form) return;

  var $ = function (id) { return document.getElementById(id); };
  var daysBox = $('days');
  var resultBox = $('result');
  var errorBox = $('errors');

  var DEFAULT = {
    wage: String(R.minimumWage), fivePlus: false, longTerm: true, industryId: R.industrial[0].id,
    customRate: '', headcount: '1',
    days: [0, 1, 2, 3, 4, 5, 6].map(function (i) {
      return { on: i < 5, start: '09:00', end: '18:00', brk: 60 };
    })
  };

  var PRESETS = {
    full: function () { return DEFAULT.days.map(function (d) { return clone(d); }); },
    weekend: function () {
      return [0, 1, 2, 3, 4, 5, 6].map(function (i) { return { on: i >= 5, start: '10:00', end: '19:00', brk: 60 }; });
    },
    evening: function () {
      return [0, 1, 2, 3, 4, 5, 6].map(function (i) { return { on: i < 5, start: '18:00', end: '22:00', brk: 0 }; });
    },
    night: function () {
      return [0, 1, 2, 3, 4, 5, 6].map(function (i) { return { on: i < 5, start: '22:00', end: '07:00', brk: 60 }; });
    }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- 화면 구성 ---------- */
  function buildIndustry() {
    var sel = $('industry');
    var html = '';
    R.industrial.forEach(function (it) {
      html += '<option value="' + it.id + '">' + it.label + ' ' + (Math.round(it.rate * 10000) / 100) + '%</option>';
    });
    html += '<option value="custom">직접 입력</option>';
    sel.innerHTML = html;
  }

  function buildDays() { window.SajangDays.build(daysBox); }

  /* ---------- 상태 읽기/쓰기 ---------- */
  function radio(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : null;
  }
  function setRadio(name, val) {
    var el = form.querySelector('input[name="' + name + '"][value="' + val + '"]');
    if (el) el.checked = true;
  }

  function readState() {
    var days = window.SajangDays.read(daysBox);
    return {
      wage: $('wage').value.replace(/,/g, '').trim(),
      fivePlus: radio('fivePlus') === '1',
      longTerm: radio('longTerm') === '1',
      industryId: $('industry').value,
      customRate: $('customRate').value.trim(),
      headcount: $('headcount').value.trim(),
      days: days
    };
  }

  function writeState(s) {
    $('wage').value = s.wage;
    setRadio('fivePlus', s.fivePlus ? '1' : '0');
    setRadio('longTerm', s.longTerm ? '1' : '0');
    $('industry').value = s.industryId;
    if (!$('industry').value) $('industry').value = R.industrial[0].id;
    $('customRate').value = s.customRate || '';
    $('headcount').value = s.headcount;
    writeDays(s.days);
  }

  function writeDays(days) { window.SajangDays.write(daysBox, days); }

  /* ---------- 저장 (이 기기에만) ---------- */
  function save(s) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* 저장 불가 환경: 무시 */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? sanitize(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }

  /* 저장값·링크값 검증: 형식이 틀리면 기본값 사용 */
  function sanitize(o) {
    if (!o || typeof o !== 'object') return null;
    var s = clone(DEFAULT);
    if (/^\d{1,7}$/.test(String(o.wage))) s.wage = String(o.wage);
    s.fivePlus = !!o.fivePlus;
    s.longTerm = o.longTerm !== false;
    var ids = R.industrial.map(function (x) { return x.id; }).concat(['custom']);
    if (ids.indexOf(o.industryId) >= 0) s.industryId = o.industryId;
    if (/^\d{1,2}(\.\d{1,3})?$/.test(String(o.customRate))) s.customRate = String(o.customRate);
    if (/^\d{1,3}$/.test(String(o.headcount))) s.headcount = String(o.headcount);
    if (Array.isArray(o.days) && o.days.length === 7) {
      s.days = o.days.map(function (d, i) {
        var ok = d && /^\d{2}:\d{2}$/.test(d.start) && /^\d{2}:\d{2}$/.test(d.end) && /^\d{1,3}$/.test(String(d.brk));
        return ok ? { on: !!d.on, start: d.start, end: d.end, brk: Number(d.brk) } : clone(DEFAULT.days[i]);
      });
    }
    return s;
  }

  /* ---------- 링크 (주소창 쿼리, 서버 전송 없음) ---------- */
  function toQuery(s) {
    var d = s.days.map(function (x) {
      return (x.on ? '1' : '0') + '-' + x.start.replace(':', '') + '-' + x.end.replace(':', '') + '-' + x.brk;
    }).join('_');
    var p = new URLSearchParams({
      w: s.wage, f: s.fivePlus ? '1' : '0', l: s.longTerm ? '1' : '0',
      i: s.industryId, n: s.headcount, d: d
    });
    if (s.industryId === 'custom') p.set('c', s.customRate);
    return '?' + p.toString();
  }
  function fromQuery(q) {
    var p = new URLSearchParams(q);
    if (!p.has('w') || !p.has('d')) return null;
    var days = (p.get('d') || '').split('_').map(function (t) {
      var m = /^([01])-(\d{2})(\d{2})-(\d{2})(\d{2})-(\d{1,3})$/.exec(t);
      return m ? { on: m[1] === '1', start: m[2] + ':' + m[3], end: m[4] + ':' + m[5], brk: m[6] } : null;
    });
    return sanitize({
      wage: p.get('w'), fivePlus: p.get('f') === '1', longTerm: p.get('l') !== '0',
      industryId: p.get('i'), customRate: p.get('c') || '', headcount: p.get('n') || '1', days: days
    });
  }

  /* ---------- 계산 및 결과 그리기 ---------- */
  function hm(hours) {
    var t = Math.round(hours * 60);
    var h = Math.floor(t / 60), m = t % 60;
    return h + '시간' + (m ? ' ' + m + '분' : '');
  }
  function won(n) { return fmt(n) + '원'; }
  function pct(r) { return (Math.round(r * 100000) / 1000) + '%'; }

  function updateDaySums(s) { window.SajangDays.sums(daysBox, s.days); }

  function clearInvalid() {
    form.querySelectorAll('.invalid').forEach(function (el) { el.classList.remove('invalid'); });
  }

  function markInvalid(field) {
    if (field === 'wage') $('wage').classList.add('invalid');
    else if (field === 'customRate') $('customRate').classList.add('invalid');
    else if (field === 'days') daysBox.classList.add('invalid');
    else if (/^day\d$/.test(field)) {
      daysBox.querySelector('[data-day="' + field.slice(3) + '"]').querySelectorAll('input[type="time"], input[type="number"]').forEach(function (el) { el.classList.add('invalid'); });
    }
  }

  function formulaRow(label, value, formula, sub) {
    return '<tr><td>' + label + (sub ? '<small>' + sub + '</small>' : '') +
      (formula ? '<details class="formula"><summary>계산식 보기</summary><div>' + formula + '</div></details>' : '') +
      '</td><td class="num">' + won(value) + '</td></tr>';
  }

  function isBlank(s) {
    return s.wage === '' && !s.days.some(function (d) { return d.on; });
  }

  function render(res, s) {
    clearInvalid();
    errorBox.innerHTML = '';
    if (isBlank(s)) {
      // '지우기' 직후: 오류 대신 안내만 표시
      errorBox.innerHTML = '<div class="note note-info">시급을 입력하고 근무하는 요일을 체크하면 결과가 바로 나타납니다. 처음이라면 위의 \'예시 값 넣기\'를 눌러 보세요.</div>';
      resultBox.hidden = true;
      return;
    }
    if (!res.ok) {
      var eh = '<div class="note note-err" role="alert"><ul>';
      res.errors.forEach(function (e) { eh += '<li>' + e.msg + '</li>'; markInvalid(e.field); });
      eh += '</ul></div>';
      errorBox.innerHTML = eh;
      resultBox.hidden = true;
      return;
    }
    resultBox.hidden = false;
    var W = C.WEEKS_PER_MONTH.toFixed(3);
    var ins = res.insurance;
    var h = '';

    // 경고·안내
    if (res.warnings.length) {
      h += '<div class="note note-warn" role="status"><ul>';
      res.warnings.forEach(function (w) { h += '<li>' + w + '</li>'; });
      h += '</ul></div>';
    }
    res.info.forEach(function (t) { h += '<div class="note note-info">' + t + '</div>'; });

    // 요약 카드
    h += '<div class="summary" aria-live="polite">' +
      '<div class="label">사장님이 실제로 쓰는 월 총 인건비 (1인)</div>' +
      '<div class="big">' + won(res.totalPerPerson) + '</div>' +
      '<div class="sub">' +
        '<div>' + res.headcount + '명 합계<b>' + won(res.totalAll) + '</b></div>' +
        '<div>연간 환산<b>' + won(res.annual) + '</b></div>' +
      '</div>' +
      (res.realHourly ? '<div class="real">실제 시간당 비용 <b>약 ' + won(Math.round(res.realHourly / 10) * 10) + '</b> · 시급의 <b>' + res.realMultiple.toFixed(2) + '배</b></div>' : '') +
      '</div>';

    // 판정 배지
    function badge(ok, yes, no) { return '<li class="badge ' + (ok ? 'yes' : 'no') + '">' + (ok ? '✓ ' + yes : '✕ ' + no) + '</li>'; }
    h += '<ul class="badges">' +
      badge(res.holidayEligible, '주휴수당 발생', '주휴수당 없음') +
      badge(res.insRequired, '4대보험 가입 의무', '4대보험 의무 없음(산재 제외)') +
      badge(res.severanceEligible, '퇴직금 적립 대상', '퇴직금 대상 아님') +
      badge(res.fivePlus, '야간·연장 가산 적용', '가산수당 의무 없음(5인 미만)') +
      '</ul>';

    h += '<p class="muted">주 ' + res.workDays + '일 · 주 근로 ' + hm(res.weeklyHours) +
      ' · 주휴 ' + hm(res.holidayHours) + ' · 야간 ' + hm(res.nightHoursWeek) + ' · 연장 ' + hm(res.overtimeHoursWeek) + ' (주 기준)</p>';

    // 상세 내역
    h += '<h3>상세 내역 (월, 1인 기준)</h3><div class="table-scroll"><table class="detail fit"><thead><tr><th>항목</th><th class="num">금액</th></tr></thead><tbody>';
    h += formulaRow('기본급 (주휴수당 포함)', res.basePay,
      '월 유급시간 ' + res.monthlyPaidHours + '시간 × 시급 ' + won(res.wage) + '<br>월 유급시간 = (주 근로 ' + hm(res.weeklyHours) + ' + 주휴 ' + hm(res.holidayHours) + ') × ' + W + '주, 올림',
      res.holidayEligible ? '이 중 주휴수당 약 ' + won(res.holidayPayMonthly) : '주 15시간 미만 → 주휴수당 없음');
    if (res.fivePlus) {
      h += formulaRow('야간 가산수당', res.nightPremium, '주 야간 ' + hm(res.nightHoursWeek) + ' × 시급 × 0.5 × ' + W + '주', '22:00~06:00 근무');
      h += formulaRow('연장 가산수당', res.otPremium, '주 연장 ' + hm(res.overtimeHoursWeek) + ' × 시급 × 0.5 × ' + W + '주', '하루 8시간·주 40시간 초과');
    }
    h += '<tr class="total"><td>월 임금 총액</td><td class="num">' + won(res.monthlyWage) + '</td></tr>';
    var insSub = res.insRequired ? '' : '월 60시간 미만 → 가입 의무 없음';
    h += formulaRow('국민연금 (사업주)', ins.np, '월 임금 × ' + pct(R.nationalPension.employer) + ' (기준소득월액 상·하한 적용), 10원 미만 절사', insSub);
    h += formulaRow('건강보험 (사업주)', ins.hi, '월 임금 × ' + pct(R.healthInsurance.employer) + ', 10원 미만 절사', insSub);
    h += formulaRow('장기요양보험 (사업주)', ins.ltc, '사업주 건강보험료 × ' + pct(R.longTermCare.ratioOfHealth), insSub);
    h += formulaRow('고용보험 (사업주)', ins.ei, '월 임금 × ' + pct(R.employmentInsurance.employer) + ' (150인 미만)', insSub);
    h += formulaRow('산재보험 (전액 사업주)', ins.ia, '월 임금 × ' + pct(res.iaRate), res.iaLabel);
    h += formulaRow('퇴직금 월 적립액', res.severance, '월 임금 총액 ÷ 12',
      res.severanceEligible ? '1년 이상 근무 시 발생' : (res.refSeverance ? '1년 미만 → 아직 의무 없음' : '주 15시간 미만 → 대상 아님'));
    h += '<tr class="total"><td>월 총 인건비 (1인)</td><td class="num">' + won(res.totalPerPerson) + '</td></tr>';
    if (!res.fivePlus && (res.refNightPremium || res.refOtPremium)) {
      if (res.refNightPremium) h += '<tr class="ref"><td>참고: 야간 가산을 지급한다면<small>5인 미만은 법적 의무 없음</small></td><td class="num">+' + won(res.refNightPremium) + '</td></tr>';
      if (res.refOtPremium) h += '<tr class="ref"><td>참고: 연장 가산을 지급한다면<small>5인 미만은 법적 의무 없음</small></td><td class="num">+' + won(res.refOtPremium) + '</td></tr>';
    }
    if (res.refSeverance) {
      h += '<tr class="ref"><td>참고: 1년을 넘기면 퇴직금<small>매달 미리 적립해 두기를 권장</small></td><td class="num">+' + won(res.refSeverance) + '</td></tr>';
    }
    h += '</tbody></table></div>';

    // 3.3% 비교
    h += '<h3>3.3% 프리랜서 처리 vs 4대보험 가입 (월)</h3><div class="table-scroll"><table class="fit"><thead><tr><th>구분</th><th class="num">3.3% 처리</th><th class="num">4대보험 가입</th></tr></thead><tbody>' +
      '<tr><td>사장님 지출<small>퇴직금 적립 제외</small></td><td class="num">' + won(res.freelance.employerCost) + '</td><td class="num">' + won(res.employed.employerCost) + '</td></tr>' +
      '<tr><td>사업주 보험료</td><td class="num">0원</td><td class="num">' + won(ins.total) + '</td></tr>' +
      '<tr><td>알바생 실수령<small>참고, 소득세 제외</small></td><td class="num">' + won(res.freelance.workerNet) + '</td><td class="num">' + won(res.employed.workerNet) + '</td></tr>' +
      '<tr><td>주휴수당·퇴직금</td><td>근로자로 판정되면 똑같이 지급 의무</td><td>지급 의무</td></tr>' +
      '<tr class="total"><td>월 차이</td><td class="num">—</td><td class="num">+' + won(res.diff) + '</td></tr>' +
      '</tbody></table></div>' +
      '<div class="note note-err"><strong>주의:</strong> 알바생을 3.3%로 처리할 수 있는 경우는 매우 제한적입니다. 정해진 시간·장소에서 사장님의 지시를 받고 일한다면 근로자로 판정될 가능성이 높고, 그러면 4대보험료가 소급 부과되고 가산금이 붙을 수 있습니다. <a href="guide/#freelance">자세히 보기</a></div>';

    // 기준
    var vd = R.verifiedDate ? R.verifiedDate : '<span class="todo">[직접 작성 필요]</span>';
    h += '<p class="basis">' + R.effectiveFrom + ' 적용 기준 · 요율 최종 확인일 ' + vd +
      (R.industrialVerified ? '' : ' · <span class="todo">산재보험 요율 확인 필요</span>') +
      (R.minimumWageStale ? ' · <span class="todo">' + R.asOf.slice(0, 4) + '년 최저임금 반영 필요</span>' : '') +
      (R.upcoming.length ? ' · 예정된 변경: ' + R.upcoming.join(', ') + ' (시작일에 자동 반영)' : '') +
      ' · 월 환산 ' + W + '주 · 결과는 참고용이며 실제 금액과 다를 수 있습니다. 두루누리 사회보험료 지원 대상이면 국민연금·고용보험 일부를 지원받을 수 있습니다(<a href="https://insurancesupport.or.kr/" target="_blank" rel="noopener">두루누리 공식 사이트</a>).</p>';

    $('result-body').innerHTML = h;
  }

  function run(opts) {
    var s = readState();
    $('customRateWrap').hidden = s.industryId !== 'custom';
    updateDaySums(s);
    var res = C.calculate(s, R);
    render(res, s);
    if (grid) grid.refresh(s.days);
    if (contractBox) window.SajangContract.update(contractBox, s, res);
    save(s);
    if (opts && opts.scroll && res.ok) resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return s;
  }

  /* ---------- 부가 기능 ---------- */
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2000);
  }

  function copyLink() {
    var url = location.origin + location.pathname + toQuery(readState());
    var done = function () { toast('입력값이 담긴 링크를 복사했습니다'); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(done, function () { window.prompt('아래 링크를 복사하세요', url); });
    } else {
      window.prompt('아래 링크를 복사하세요', url);
    }
  }

  var BLANK = {
    wage: '', fivePlus: false, longTerm: true, industryId: R.industrial[0].id, customRate: '', headcount: '1',
    days: [0, 1, 2, 3, 4, 5, 6].map(function () { return { on: false, start: '09:00', end: '18:00', brk: 60 }; })
  };

  /* 본문 속 기준값(data-r)을 현재 적용값으로 채움 → 요율이 바뀌면 글도 자동으로 바뀜 */
  function fillRates() {
    var map = {
      mw: fmt(R.minimumWage),
      mwYear: String(R.minimumWageYear),
      effectiveFrom: R.effectiveFrom,
      verified: R.verifiedDate || '[직접 작성 필요]',
      npTotal: pct(R.nationalPension.employer + R.nationalPension.employee),
      npEr: pct(R.nationalPension.employer),
      npEe: pct(R.nationalPension.employee),
      hiTotal: pct(R.healthInsurance.employer + R.healthInsurance.employee),
      hiEr: pct(R.healthInsurance.employer),
      hiEe: pct(R.healthInsurance.employee),
      ltc: pct(R.longTermCare.ratioOfHealth),
      eiTotal: pct(R.employmentInsurance.employer + R.employmentInsurance.employee),
      eiEr: pct(R.employmentInsurance.employer),
      eiEe: pct(R.employmentInsurance.employee)
    };
    document.querySelectorAll('[data-r]').forEach(function (el) {
      var k = el.getAttribute('data-r');
      if (map[k] !== undefined) el.textContent = map[k];
    });
    if (R.verifiedDate) document.querySelectorAll('[data-r="verified"]').forEach(function (el) { el.classList.remove('todo'); });
  }

  /* ---------- 시작 ---------- */
  window.sajangToast = toast;
  fillRates();
  buildIndustry();
  buildDays();
  var grid = null, contractBox = $('contract');
  if ($('schedule-grid') && window.SajangGrid) {
    grid = window.SajangGrid.mount($('schedule-grid'), {
      onSet: function (i, start, end) { window.SajangDays.setDay(daysBox, i, start, end); run(); }
    });
  }
  if (contractBox && window.SajangContract) window.SajangContract.mount(contractBox);
  writeState(fromQuery(location.search) || load() || clone(DEFAULT));

  form.addEventListener('input', function () { run(); });
  form.addEventListener('change', function () { run(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); run({ scroll: true }); });

  document.querySelectorAll('[data-preset]').forEach(function (b) {
    b.addEventListener('click', function () {
      var p = b.getAttribute('data-preset');
      if (p === 'example') writeState(clone(DEFAULT));
      else if (p === 'clear') writeState(BLANK);
      else writeDays(PRESETS[p]());
      run();
    });
  });
  $('btn-copy').addEventListener('click', copyLink);
  $('btn-print').addEventListener('click', function () { window.print(); });
  $('btn-reset').addEventListener('click', function () {
    writeState(clone(DEFAULT));
    run();
    form.scrollIntoView({ behavior: 'smooth' });
  });

  run();
})();
