/*
 * 사장님계산기 — 근로계약서 핵심 조항 요약표
 * 계산기에 입력한 조건으로 근로계약서에 적어야 할 항목을 정리합니다.
 * 서버나 AI를 쓰지 않고 브라우저 안에서만 만들며, 법적 효력이 있는 계약서가 아닙니다.
 */
(function (root) {
  'use strict';
  var D = root.SajangDays;
  var C = root.SajangCalc;
  var KEY = 'sajang-contract-v1';
  var FIELDS = [
    { k: 'period', label: '근로계약 기간', ph: '예: 2027-01-01부터 기간 정함 없음' },
    { k: 'place', label: '근무 장소', ph: '예: ○○카페 ○○점' },
    { k: 'job', label: '업무 내용', ph: '예: 음료 제조, 매장 정리' },
    { k: 'payday', label: '임금 지급일', ph: '예: 매월 10일' },
    { k: 'payway', label: '지급 방법', ph: '예: 근로자 명의 예금통장 입금' },
    { k: 'holiday', label: '주휴일', ph: '예: 매주 일요일' }
  ];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* 무시 */ } }

  function mount(el) {
    var saved = load();
    var inputs = {};
    FIELDS.forEach(function (f) {
      inputs[f.k] = '<input type="text" class="cs-input" data-cs="' + f.k + '" placeholder="' + esc(f.ph) + '" value="' + esc(saved[f.k] || '') + '" aria-label="' + f.label + '">';
    });
    el.innerHTML =
      '<h3 id="cs-title">근로계약서 핵심 조항 요약</h3>' +
      '<p class="muted">위에 입력한 조건으로 근로계약서에 반드시 적어야 할 항목을 정리했습니다. 빈칸은 직접 채우세요. 입력한 내용은 이 기기에만 저장됩니다.</p>' +
      '<div class="table-scroll"><table class="fit cs-table" aria-labelledby="cs-title"><tbody>' +
        '<tr><th scope="row">임금</th><td data-out="wage"></td></tr>' +
        '<tr><th scope="row">임금 구성</th><td data-out="parts"></td></tr>' +
        '<tr><th scope="row">임금 지급일</th><td>' + inputs.payday + '</td></tr>' +
        '<tr><th scope="row">지급 방법</th><td>' + inputs.payway + '</td></tr>' +
        '<tr><th scope="row">소정근로시간</th><td data-out="hours"></td></tr>' +
        '<tr><th scope="row">근로일·근로일별 근로시간</th><td data-out="days"></td></tr>' +
        '<tr><th scope="row">주휴일</th><td>' + inputs.holiday + '<small data-out="holidayNote"></small></td></tr>' +
        '<tr><th scope="row">연차유급휴가</th><td data-out="leave"></td></tr>' +
        '<tr><th scope="row">사회보험</th><td data-out="insurance"></td></tr>' +
        '<tr><th scope="row">근로계약 기간</th><td>' + inputs.period + '</td></tr>' +
        '<tr><th scope="row">근무 장소</th><td>' + inputs.place + '</td></tr>' +
        '<tr><th scope="row">업무 내용</th><td>' + inputs.job + '</td></tr>' +
      '</tbody></table></div>' +
      '<div class="note note-info">이 표는 <strong>법적 효력이 있는 계약서가 아닙니다.</strong> 고용노동부 <a href="https://www.moel.go.kr/" target="_blank" rel="noopener">표준근로계약서(단시간 근로자용)</a>에 옮겨 적고 서명한 뒤 1부를 근로자에게 주세요. 단시간 근로자는 근로일과 근로일별 근로시간을 반드시 적어야 합니다.</div>' +
      '<div class="actions no-print-inner"><button type="button" class="btn" data-cs-copy>요약 텍스트 복사</button></div>';

    el.addEventListener('input', function (e) {
      if (!e.target.matches('.cs-input')) return;
      var v = load(); v[e.target.getAttribute('data-cs')] = e.target.value; save(v);
    });
    el.querySelector('[data-cs-copy]').addEventListener('click', function () {
      var lines = ['[근로계약서 핵심 조항 요약]'];
      el.querySelectorAll('.cs-table tr').forEach(function (tr) {
        var th = tr.querySelector('th').textContent;
        var td = tr.querySelector('td');
        var inp = td.querySelector('input');
        var val = inp ? (inp.value || '________') : td.innerText.replace(/\s+/g, ' ').trim();
        lines.push('- ' + th + ': ' + val);
      });
      lines.push('※ 참고용 요약이며 법적 효력이 있는 계약서가 아닙니다.');
      var text = lines.join('\n');
      if (navigator.clipboard && root.isSecureContext) navigator.clipboard.writeText(text).then(function () { if (root.sajangToast) root.sajangToast('요약을 복사했습니다'); });
      else root.prompt('아래 내용을 복사하세요', text);
    });
  }

  function update(el, state, res) {
    el.hidden = !res.ok;
    if (!res.ok) return;
    var out = function (k, html) { el.querySelector('[data-out="' + k + '"]').innerHTML = html; };
    out('wage', '시급 ' + C.fmt(res.wage) + '원 (월 환산 약 ' + C.fmt(res.monthlyWage) + '원, 주휴·가산 포함)');
    var parts = ['기본급(시급 × 근로시간)'];
    if (res.holidayEligible) parts.push('주휴수당(주 ' + D.hm(res.holidayHours * 60) + ')');
    if (res.fivePlus) parts.push('야간·연장 가산수당(통상임금의 50%)');
    out('parts', parts.join(', '));
    out('hours', '1주 ' + D.hm(res.weeklyHours * 60) + ' (주 ' + res.workDays + '일)');
    var dl = [];
    state.days.forEach(function (d, i) {
      if (d.on) dl.push(D.NAMES[i] + ' ' + d.start + '~' + d.end + (Number(d.brk) ? ' (휴게 ' + d.brk + '분)' : ''));
    });
    out('days', dl.map(esc).join('<br>'));
    out('holidayNote', res.holidayEligible ? '' : '주 15시간 미만: 유급 주휴일 부여 의무 없음');
    out('leave', res.weeklyHours < 15 ? '주 15시간 미만: 연차유급휴가 적용 제외' :
      res.fivePlus ? '근로기준법에 따라 부여 (단시간 근로자는 근로시간에 비례)' : '5인 미만 사업장: 법적 의무 없음');
    out('insurance', res.insRequired ? '국민연금·건강보험·고용보험·산재보험 가입' : '산재보험 가입 (월 60시간 미만으로 나머지는 원칙적으로 의무 없음)');
  }

  root.SajangContract = { mount: mount, update: update };
})(window);
