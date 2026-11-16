/*
 * 사장님계산기 — 계산기 페이지별 설정 (body의 data-calc 값으로 선택)
 */
(function (root) {
  'use strict';
  var R = root.SAJANG_RATES, C = root.SajangCalc, D = root.SajangDays, P = root.SajangPage;
  var won = P.won, fmt = C.fmt;
  var hm = function (h) { return D.hm(Math.round(h * 60)); };
  var W = C.WEEKS_PER_MONTH;

  function industryOptions(sel) {
    var html = '';
    R.industrial.forEach(function (it) { html += '<option value="' + it.id + '">' + it.label + ' ' + (Math.round(it.rate * 10000) / 100) + '%</option>'; });
    sel.innerHTML = html + '<option value="custom">직접 입력</option>';
  }

  var PAGES = {
    /* ② 주휴수당 */
    'weekly-holiday-pay': {
      key: 'sajang-weekly-v1', days: true,
      fields: ['wage', 'mode', 'weeklyHours', 'attended'],
      defaults: { wage: String(R.minimumWage), mode: 'schedule', weeklyHours: '20', attended: '1',
        days: [0, 1, 2, 3, 4, 5, 6].map(function (i) { return { on: i < 5, start: '13:00', end: '17:00', brk: 0 }; }) },
      blank: { wage: '', mode: 'schedule', weeklyHours: '', attended: '1', days: D.PRESETS.blank() },
      isBlank: function (s) { return s.wage === '' && (s.mode === 'direct' ? s.weeklyHours === '' : !s.days.some(function (d) { return d.on; })); },
      compute: function (s) {
        var wh;
        if (s.mode === 'direct') wh = s.weeklyHours;
        else {
          if (!s.days.some(function (d) { return d.on; })) return { ok: false, errors: [{ field: 'days', msg: '근무하는 요일을 하나 이상 선택해 주세요.' }] };
          wh = D.weeklyMinutes(s.days) / 60;
          if (wh <= 0) return { ok: false, errors: [{ field: 'days', msg: '근무 시각과 휴게시간을 확인해 주세요.' }] };
        }
        var r = C.weeklyHoliday({ wage: s.wage, weeklyHours: wh, attended: s.attended !== '0' }, R);
        if (!r.ok) return r;
        var h = P.summary('주휴수당 (월 환산)', won(r.monthlyPay), [['1주', won(r.weeklyPay)], ['주휴 포함 월급', won(r.monthlyWage)]]);
        h += P.badges([[r.eligibleByHours, '주 15시간 이상', '주 15시간 미만'], [r.attended, '개근', '결근 있음'], [r.eligible, '주휴수당 발생', '주휴수당 없음']]);
        if (!r.eligibleByHours) h += '<div class="note note-info">주 15시간까지 <b>' + hm(r.remainingTo15) + '</b> 남았습니다. 15시간 미만인 초단시간 근로자는 주휴수당·퇴직금·연차 적용이 제외됩니다.</div>';
        else if (!r.attended) h += '<div class="note note-info">그 주에 정해진 근무일을 결근하면 그 주의 주휴수당은 없습니다. 지각·조퇴는 결근이 아닙니다.</div>';
        h += P.table('상세 내역', ['항목', '값'], [
          { cells: ['주 소정근로시간', hm(r.weeklyHours)] },
          { cells: ['주휴시간 (주 시간 ÷ 40 × 8, 최대 8시간)', hm(r.holidayHours)] },
          { cells: ['주휴수당 (1주)', won(r.weeklyPay)] },
          { cells: ['주휴수당 (월, × ' + W.toFixed(3) + '주)', won(r.monthlyPay)] },
          { cells: ['월 유급시간 (주휴 포함, 올림)', r.monthlyPaidHours + '시간'] },
          { cls: 'total', cells: ['주휴 포함 월급', won(r.monthlyWage)] }
        ]);
        h += '<p class="muted">사장님 입장의 4대보험·퇴직금까지 더한 총 인건비는 <a href="../../">알바 인건비 계산기</a>에서 볼 수 있습니다.</p>';
        return { ok: true, warnings: r.warnings, html: h };
      }
    },

    /* ③ 4대보험 */
    'insurance': {
      key: 'sajang-insurance-v1',
      fields: ['pay', 'monthlyHours', 'industryId', 'customRate'],
      defaults: { pay: '2156880', monthlyHours: '174', industryId: R.industrial[0].id, customRate: '' },
      blank: { pay: '', monthlyHours: '174', industryId: R.industrial[0].id, customRate: '' },
      isBlank: function (s) { return s.pay === ''; },
      setup: function (form) { industryOptions(form.querySelector('[name="industryId"]')); },
      compute: function (s) {
        var r = C.insurance(s, R);
        if (!r.ok) return r;
        var e = r.employer, w = r.employee;
        var h = P.summary('사장님이 내는 4대보험료 (월)', won(e.total), [['사장님 총 지출', won(r.employerCost)], ['알바생 실수령 (참고)', won(r.workerNet)]]);
        h += P.badges([[r.required, '국민연금·건강·고용 가입 대상', '월 60시간 미만: 산재만 의무']]);
        h += P.table('항목별 보험료', ['보험', '사장님', '알바생'], [
          { cells: ['국민연금', won(e.np), won(w.np)] },
          { cells: ['건강보험', won(e.hi), won(w.hi)] },
          { cells: ['장기요양보험', won(e.ltc), won(w.ltc)] },
          { cells: ['고용보험', won(e.ei), won(w.ei)] },
          { cells: ['산재보험<small>' + r.iaLabel + ' ' + P.pct(r.iaRate) + '</small>', won(e.ia), '0원'] },
          { cls: 'total', cells: ['합계', won(e.total), won(w.total)] }
        ]);
        if (!R.industrialVerified) h += '<p class="muted"><span class="todo">산재보험 업종 요율 확인 필요</span> — 사업장 요율을 알면 \'직접 입력\'을 고르세요.</p>';
        h += '<p class="muted">알바생 실수령은 4대보험만 뺀 참고값이며 근로소득세는 빼지 않았습니다.</p>';
        return { ok: true, warnings: r.warnings, html: h };
      }
    },

    /* ④ 시급 ↔ 월급 */
    'hourly-monthly': {
      key: 'sajang-hourly-v1',
      fields: ['direction', 'amount', 'weeklyHours', 'includeHoliday'],
      defaults: { direction: 'h2m', amount: String(R.minimumWage), weeklyHours: '40', includeHoliday: '1' },
      blank: { direction: 'h2m', amount: '', weeklyHours: '40', includeHoliday: '1' },
      isBlank: function (s) { return s.amount === ''; },
      compute: function (s) {
        var lbl = document.getElementById('amount-label');
        if (lbl) lbl.textContent = s.direction === 'm2h' ? '월급 (세전)' : '시급';
        var r = C.hourlyMonthly({ direction: s.direction, amount: s.amount, weeklyHours: s.weeklyHours, includeHoliday: s.includeHoliday !== '0' }, R);
        if (!r.ok) return r;
        var h = r.direction === 'm2h'
          ? P.summary('환산 시급', '약 ' + won(Math.round(r.hourly)), [['월 유급시간', r.monthlyPaidHours + '시간'], ['연봉 (×12)', won(r.annual)]])
          : P.summary('월급 (세전)', won(r.monthly), [['월 유급시간', r.monthlyPaidHours + '시간'], ['연봉 (×12)', won(r.annual)]]);
        h += P.badges([[!r.belowMin, R.minimumWageYear + '년 최저임금 이상', '최저임금 미달'], [r.holidayHours > 0, '주휴수당 포함', '주휴수당 없음']]);
        h += P.table('계산 내역', ['항목', '값'], [
          { cells: ['주 소정근로시간', hm(r.weeklyHours)] },
          { cells: ['주휴시간', hm(r.holidayHours)] },
          { cells: ['월 유급시간 = (주 근로 + 주휴) × ' + W.toFixed(3) + '주, 올림', r.monthlyPaidHours + '시간'] },
          { cells: ['시급', won(Math.round(r.hourly))] },
          { cells: ['월급', won(r.monthly)] },
          { cells: ['같은 시간의 최저임금 월급', won(r.minMonthly)] }
        ]);
        return { ok: true, warnings: r.warnings, html: h };
      }
    },

    /* ⑤ 야간수당 */
    'night-pay': {
      key: 'sajang-night-v1', days: true,
      fields: ['fivePlus', 'wage', 'mode', 'nightHours'],
      defaults: { fivePlus: '1', wage: String(R.minimumWage), mode: 'schedule', nightHours: '40', days: D.PRESETS.night() },
      blank: { fivePlus: '1', wage: '', mode: 'schedule', nightHours: '', days: D.PRESETS.blank() },
      isBlank: function (s) { return s.wage === '' && (s.mode === 'direct' ? s.nightHours === '' : !s.days.some(function (d) { return d.on; })); },
      compute: function (s) {
        var five = s.fivePlus === '1', r, extra = '';
        if (s.mode === 'direct') {
          r = C.nightDirect({ wage: s.wage, nightHours: s.nightHours, fivePlus: five }, R);
          if (!r.ok) return r;
        } else {
          var full = C.calculate({ wage: s.wage, fivePlus: five, longTerm: true, industryId: R.industrial[0].id, headcount: 1, days: s.days }, R);
          if (!full.ok) return full;
          r = { ok: true, warnings: full.warnings, nightHoursWeek: full.nightHoursWeek, nightPremium: full.nightPremium, refNightPremium: full.refNightPremium,
            nightHoursMonth: full.nightHoursWeek * W, fivePlus: five };
          if (full.overtimeHoursWeek > 0) extra = '<div class="note note-info">연장근로도 주 ' + hm(full.overtimeHoursWeek) + ' 있습니다. ' +
            (five ? '연장 가산수당 월 ' + won(full.otPremium) + '이 별도로 붙습니다(야간과 겹치면 둘 다 가산).' : '5인 미만은 연장 가산 의무도 없습니다.') + '</div>';
        }
        var amount = five ? r.nightPremium : 0;
        var h = P.summary('야간 가산수당 (월)', won(amount), [['주 야간시간', hm(r.nightHoursWeek)], ['월 야간시간', hm(r.nightHoursMonth)]]);
        h += P.badges([[five, '5인 이상: 가산 의무', '5인 미만: 가산 의무 없음'], [r.nightHoursWeek > 0, '야간근로 있음', '야간근로 없음']]);
        h += extra;
        var rows = [
          { cells: ['주 야간근로시간 (22:00~06:00)', hm(r.nightHoursWeek)] },
          { cells: ['월 야간근로시간 (× ' + W.toFixed(3) + '주)', hm(r.nightHoursMonth)] },
          { cls: 'total', cells: ['야간 가산수당 (시급 × 50%)', won(amount)] }
        ];
        if (!five && r.refNightPremium) rows.push({ cls: 'ref', cells: ['참고: 지급한다면<small>5인 미만은 법적 의무 없음</small>', '+' + won(r.refNightPremium)] });
        h += P.table('계산 내역', ['항목', '값'], rows);
        h += '<p class="muted">야간 시간에 대한 기본 시급(100%)은 기본급에 이미 들어 있고, 여기서는 추가로 붙는 50%만 계산합니다. 휴게시간은 야간 구간에서 빼지 않는다고 가정했습니다.</p>';
        return { ok: true, warnings: r.warnings, html: h };
      }
    },

    /* ⑥ 퇴직금 */
    'severance': {
      key: 'sajang-severance-v1',
      fields: ['start', 'lastDay', 'wageMode', 'monthly', 'wage3', 'over15', 'bonusAnnual', 'leavePayAnnual'],
      defaults: { start: '2025-01-01', lastDay: '2026-06-30', wageMode: 'monthly', monthly: '2156880', wage3: '6470640', over15: '1', bonusAnnual: '', leavePayAnnual: '' },
      blank: { start: '', lastDay: '', wageMode: 'monthly', monthly: '', wage3: '', over15: '1', bonusAnnual: '', leavePayAnnual: '' },
      isBlank: function (s) { return s.start === '' && s.lastDay === '' && (s.wageMode === 'monthly' ? s.monthly === '' : s.wage3 === ''); },
      compute: function (s) {
        var w3 = s.wageMode === 'monthly' ? (s.monthly === '' ? '' : C.num(s.monthly) * 3) : s.wage3;
        var r = C.severance({ start: s.start, lastDay: s.lastDay, wage3: w3, over15: s.over15 !== '0', bonusAnnual: s.bonusAnnual, leavePayAnnual: s.leavePayAnnual });
        if (!r.ok) {
          r.errors.forEach(function (e) { if (e.field === 'wage3' && s.wageMode === 'monthly') { e.field = 'monthly'; e.msg = '월급을 1원 이상의 숫자로 입력해 주세요.'; } });
          return r;
        }
        var h = r.eligible
          ? P.summary('예상 퇴직금', won(r.severance), [['재직일수', fmt(r.days) + '일'], ['지급 기한', r.payDeadline]])
          : P.summary('예상 퇴직금', '0원', [['재직일수', fmt(r.days) + '일'], [r.over15 ? '1년까지 남은 일수' : '사유', r.over15 ? fmt(r.remainingDays) + '일' : '주 15시간 미만']]);
        h += P.badges([[r.days >= 365, '1년 이상 근무', '1년 미만 근무'], [r.over15, '주 15시간 이상', '주 15시간 미만'], [r.eligible, '퇴직금 지급 대상', '퇴직금 대상 아님']]);
        if (!r.eligible && r.over15) h += '<div class="note note-info">재직 1년이 되면 퇴직금이 발생합니다. 이 조건이면 1년 시점에 약 ' + won(Math.round(r.avgWage * 30)) + '이 필요하니 매달 ' + won(r.monthlyReserve) + '씩 미리 적립해 두세요.</div>';
        h += P.table('계산 내역', ['항목', '값'], [
          { cells: ['재직 기간', s.start + ' ~ ' + s.lastDay + ' (' + fmt(r.days) + '일)'] },
          { cells: ['평균임금 산정 기간', r.periodStart + ' ~ ' + r.periodEnd + ' (' + r.periodDays + '일)'] },
          { cells: ['3개월 임금 총액' + (C.num(s.bonusAnnual) || C.num(s.leavePayAnnual) ? '<small>상여금·연차수당의 3/12 포함</small>' : ''), won(Math.round(C.num(w3) + (C.num(s.bonusAnnual) || 0) * 3 / 12 + (C.num(s.leavePayAnnual) || 0) * 3 / 12))] },
          { cells: ['1일 평균임금', won(Math.round(r.avgWage))] },
          { cells: ['퇴직금 = 평균임금 × 30 × 재직일수 ÷ 365', won(r.estimate)] },
          { cls: 'total', cells: ['예상 퇴직금', won(r.severance)] },
          { cells: ['지급 기한 (퇴직일 ' + r.retireDate + '부터 14일)', r.payDeadline] },
          { cells: ['매달 적립 권장액', won(r.monthlyReserve)] }
        ]);
        h += '<p class="muted">평균임금이 통상임금보다 낮으면 통상임금으로 계산합니다. 퇴직소득세는 계산하지 않았습니다. 정확한 금액은 고용노동부 퇴직금 계산기로 한 번 더 확인하세요.</p>';
        return { ok: true, warnings: r.warnings, html: h };
      }
    }
    ,
    /* ⑦ 최저임금 */
    'minimum-wage': {
      key: 'sajang-minwage-v1',
      fields: ['payType', 'amount', 'dailyHours', 'weeklyHours'],
      defaults: { payType: 'monthly', amount: '2000000', dailyHours: '8', weeklyHours: '40' },
      blank: { payType: 'monthly', amount: '', dailyHours: '8', weeklyHours: '40' },
      isBlank: function (s) { return s.amount === ''; },
      compute: function (s) {
        var lbl = document.getElementById('amount-label');
        if (lbl) lbl.textContent = { hourly: '시급', daily: '일급', monthly: '월급 (최저임금에 들어가는 임금)' }[s.payType] || '금액';
        var r = C.minimumWage(s, R);
        if (!r.ok) return r;
        var unit = { hourly: '1시간', daily: '하루', monthly: '한 달' }[r.payType];
        var h = r.below
          ? P.summary(r.year + '년 최저임금 미달', unit + ' ' + won(r.shortUnit) + ' 부족', [['환산 시급', '약 ' + won(Math.round(r.hourly))], ['최저임금', won(r.minimumWage)]])
          : P.summary(r.year + '년 최저임금 충족', '환산 시급 약 ' + won(Math.round(r.hourly)), [['최저임금', won(r.minimumWage)], [unit + ' 여유', won(r.surplus)]]);
        h += P.badges([[!r.below, '최저임금 이상', '최저임금 미달']]);
        var rows = [{ cells: ['입력한 금액', won(r.amount)] }];
        if (r.payType === 'daily') rows.push({ cells: ['하루 근로시간', hm(r.hours)] });
        if (r.payType === 'monthly') rows.push({ cells: ['월 유급시간 (주휴 포함)', r.hours + '시간'] });
        rows.push({ cells: ['환산 시급', won(Math.round(r.hourly))] });
        rows.push({ cells: [r.year + '년 최저임금 (시급)', won(r.minimumWage)] });
        rows.push({ cells: ['같은 시간의 최저임금 (' + unit + ')', won(r.unitMin)] });
        rows.push({ cls: 'total', cells: [r.below ? '부족액 (' + unit + ')' : '최저임금보다 많은 금액 (' + unit + ')', won(r.below ? r.shortUnit : r.surplus)] });
        h += P.table('계산 내역', ['항목', '값'], rows);
        if (r.below) h += '<div class="note note-err">최저임금보다 적게 주면 차액을 지급해야 하고 처벌 대상이 될 수 있습니다. 시급을 올리거나 근로시간을 실제에 맞게 조정하세요.</div>';
        h += '<p class="muted">연장·야간·휴일 가산수당, 결혼수당 같은 비정기 수당은 최저임금 계산에 넣지 않습니다. 수습 기간 감액은 계산하지 않았습니다.</p>';
        return { ok: true, warnings: r.warnings, html: h };
      }
    },

    /* ⑧ 두루누리 */
    'durunuri': {
      key: 'sajang-durunuri-v1',
      fields: ['workers', 'pay', 'newHire'],
      defaults: { workers: '3', pay: '2156880', newHire: '1' },
      blank: { workers: '', pay: '', newHire: '1' },
      isBlank: function (s) { return s.workers === '' && s.pay === ''; },
      compute: function (s) {
        var r = C.durunuri({ workers: s.workers, pay: s.pay, newHire: s.newHire !== '0' }, R);
        if (!r.ok) return r;
        var c = r.cfg, h = '';
        if (!r.verified) h += '<div class="note note-err"><strong>기준값 확인 전</strong> — 지원 기준(사업장 규모, 보수 기준액, 지원율, 기간)이 아직 공식 기준과 대조되지 않은 임시값입니다. 실제 지원 여부와 금액은 <a href="https://insurancesupport.or.kr/" target="_blank" rel="noopener">두루누리 공식 사이트</a>에서 확인하세요.</div>';
        h += r.eligible
          ? P.summary('사장님 몫 지원 예상액 (월)', won(r.employer.total), [['알바생 몫 지원', won(r.employee.total)], ['최대 ' + c.months + '개월 합계', won(r.maxTotal)]])
          : P.summary('지원 예상액 (월)', '0원', [['사장님 몫', '대상 아님'], ['알바생 몫', '대상 아님']]);
        h += P.badges([[r.okSize, '근로자 ' + c.maxWorkers + '명 미만', '근로자 ' + c.maxWorkers + '명 이상'], [r.okPay, '보수 ' + fmt(c.payLimit) + '원 미만', '보수 기준 초과'], [r.newHire, '신규 가입자', '신규 가입 아님']]);
        h += P.table('보험료와 지원액 (월)', ['항목', '사장님', '알바생'], [
          { cells: ['국민연금 보험료', won(r.before.np), won(r.before.npW)] },
          { cells: ['국민연금 지원 (' + Math.round(c.rate * 100) + '%)', '−' + won(r.employer.np), '−' + won(r.employee.np)] },
          { cells: ['고용보험(실업급여분) 보험료', won(r.before.ei), won(r.before.eiW)] },
          { cells: ['고용보험 지원 (' + Math.round(c.rate * 100) + '%)', '−' + won(r.employer.ei), '−' + won(r.employee.ei)] },
          { cls: 'total', cells: ['월 지원 합계', won(r.employer.total), won(r.employee.total)] }
        ]);
        h += '<p class="muted">지원은 신청해야 받을 수 있고, 재산·소득 요건과 과거 가입 이력에 따라 대상에서 빠질 수 있습니다. 건강보험·산재보험은 지원 대상이 아닙니다.</p>';
        return { ok: true, warnings: r.warnings, html: h };
      }
    },

    /* ⑨ 일용직 세금 */
    'daily-worker-tax': {
      key: 'sajang-dailytax-v1',
      fields: ['dailyWage', 'days', 'payMode'],
      defaults: { dailyWage: '200000', days: '5', payMode: 'daily' },
      blank: { dailyWage: '', days: '1', payMode: 'daily' },
      isBlank: function (s) { return s.dailyWage === ''; },
      compute: function (s) {
        var r = C.dailyTax(s, R);
        if (!r.ok) return r;
        var c = r.cfg, h = '';
        if (!r.verified) h += '<div class="note note-warn"><span class="todo">기준값 확인 필요</span> 일용근로소득 공제액·세율·세액공제·소액부징수 기준을 국세청 안내와 대조하기 전입니다.</div>';
        h += P.summary('원천징수할 세금 (' + r.days + '일 합계)', won(r.withheld), [['알바생 실수령', won(r.net)], ['지급 총액', won(r.gross)]]);
        h += P.badges([[!r.taxFree, '과세 대상 일급', '일급 ' + fmt(c.deduction) + '원 이하: 세금 없음'], [!r.exempt, '징수', '소액부징수 (1,000원 미만)']]);
        h += P.table('계산 내역', ['항목', '값'], [
          { cells: ['일급 − 1일 공제 ' + fmt(c.deduction) + '원', won(Math.max(0, r.dailyWage - c.deduction))] },
          { cells: ['× 세율 ' + Math.round(c.rate * 100) + '% × (1 − 세액공제 ' + Math.round(c.credit * 100) + '%)', won(Math.round(r.rawDay)) + ' /일'] },
          { cells: ['지급 방식', r.lump ? r.days + '일분을 모아서 한 번에 지급' : '매일 지급'] },
          { cells: ['소득세', won(r.totalTax)] },
          { cells: ['지방소득세 (소득세의 10%)', won(r.totalLocal)] },
          { cls: 'total', cells: ['원천징수 합계', won(r.withheld)] },
          { cells: ['참고: 알바생 고용보험료 (0.9%)', won(r.eiWorker)] }
        ]);
        if (r.exempt) h += '<div class="note note-info">한 번 지급할 때 원천징수할 소득세가 1,000원 미만이면 걷지 않습니다(소액부징수). 여러 날을 모아서 지급하면 합계 세액이 1,000원을 넘어 세금이 생길 수 있습니다.</div>';
        h += '<p class="muted">사장님은 일용근로소득 지급명세서를 기한 안에 제출하고, 고용보험 근로내용확인신고를 해야 합니다.</p>';
        return { ok: true, warnings: r.warnings, html: h };
      }
    }
  };

  var name = document.body.getAttribute('data-calc');
  if (PAGES[name]) P.init(PAGES[name]);
})(window);
