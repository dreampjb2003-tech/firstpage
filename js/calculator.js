/*
 * 사장님계산기 — 계산 로직 (화면과 분리된 순수 함수)
 * 입력값은 이 파일 안에서만 계산되며 어디로도 전송되지 않습니다.
 */
(function (root) {
  'use strict';

  var WEEKS_PER_MONTH = 365 / 7 / 12; // ≈ 4.345주
  var DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];
  // 야간(22:00~06:00) 구간, 분 단위. 자정을 넘긴 근무는 최대 2880분(이틀째 24:00)까지.
  var NIGHT_WINDOWS = [[0, 360], [1320, 1800], [2760, 2880]];

  function floor10(x) {
    return Math.floor(x / 10 + 1e-9) * 10;
  }

  function parseTime(s) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var h = +m[1], mi = +m[2];
    if (h > 23 || mi > 59) return null;
    return h * 60 + mi;
  }

  function overlap(a1, a2, b1, b2) {
    return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
  }

  function nightMinutes(start, end) {
    var sum = 0;
    for (var i = 0; i < NIGHT_WINDOWS.length; i++) {
      sum += overlap(start, end, NIGHT_WINDOWS[i][0], NIGHT_WINDOWS[i][1]);
    }
    return sum;
  }

  /* 하루 근무 분석 */
  function analyzeDay(day, idx) {
    var name = DAY_NAMES[idx] + '요일';
    var out = { worked: 0, night: 0, overtime: 0, errors: [], warnings: [] };
    var s = parseTime(day.start), e = parseTime(day.end);
    if (s === null || e === null) {
      out.errors.push({ field: 'day' + idx, msg: name + ': 시작·종료 시각을 올바르게 입력해 주세요.' });
      return out;
    }
    if (s === e) {
      out.errors.push({ field: 'day' + idx, msg: name + ': 시작과 종료 시각이 같습니다.' });
      return out;
    }
    if (e < s) e += 1440; // 자정을 넘긴 근무
    var span = e - s;
    var brk = Number(day.brk);
    if (!isFinite(brk) || brk < 0 || brk !== Math.floor(brk)) {
      out.errors.push({ field: 'day' + idx, msg: name + ': 휴게시간은 0분 이상의 정수로 입력해 주세요.' });
      return out;
    }
    if (brk >= span) {
      out.errors.push({ field: 'day' + idx, msg: name + ': 휴게시간이 근무시간보다 깁니다.' });
      return out;
    }
    out.worked = span - brk;
    // 가정: 휴게시간은 야간 구간과 겹치지 않는다고 보고, 야간 시간은 실근로시간을 넘지 않게만 제한
    out.night = Math.min(nightMinutes(s, e), out.worked);
    out.overtime = Math.max(0, out.worked - 480);

    // 법정 휴게: 4시간 근무에 30분, 8시간 근무에 1시간 이상
    var need = out.worked >= 480 ? 60 : out.worked >= 240 ? 30 : 0;
    if (brk < need) {
      out.warnings.push(name + ': 근무 ' + (need === 60 ? '8시간' : '4시간') +
        ' 이상이면 휴게 ' + (need === 60 ? '1시간' : '30분') + ' 이상을 주어야 합니다.');
    }
    return out;
  }

  /*
   * input = {
   *   wage: 시급(원), fivePlus: 5인 이상 여부(bool),
   *   days: [{on, start:'HH:MM', end:'HH:MM', brk:분}] × 7 (월~일),
   *   longTerm: 1년 이상(bool), industryId, customRate(%), headcount
   * }
   */
  function calculate(input, R) {
    var errors = [], warnings = [], info = [];
    var wage = Number(input.wage);
    if (input.wage === '' || input.wage === null || !isFinite(wage) || wage < 1 || wage > 1000000) {
      errors.push({ field: 'wage', msg: '시급을 1원 이상의 숫자로 입력해 주세요.' });
    }
    wage = Math.round(wage);

    var headcount = Math.round(Number(input.headcount));
    if (!isFinite(headcount) || headcount < 1 || headcount > 100) {
      warnings.push('직원 수는 1~100명 사이로 입력해 주세요. (자동으로 보정했습니다)');
      headcount = !isFinite(headcount) || headcount < 1 ? 1 : 100;
    }

    // 산재 요율
    var iaRate = null, iaLabel = '';
    if (input.industryId === 'custom') {
      var cr = Number(input.customRate);
      if (input.customRate === '' || !isFinite(cr) || cr < 0 || cr > 20) {
        errors.push({ field: 'customRate', msg: '산재보험 요율을 0~20(%) 사이로 입력해 주세요.' });
      } else {
        iaRate = cr / 100;
        iaLabel = '직접 입력 ' + cr + '%';
      }
    } else {
      for (var k = 0; k < R.industrial.length; k++) {
        if (R.industrial[k].id === input.industryId) {
          iaRate = R.industrial[k].rate;
          iaLabel = R.industrial[k].label;
        }
      }
      if (iaRate === null) {
        iaRate = R.industrial[0].rate;
        iaLabel = R.industrial[0].label;
      }
    }

    // 근무 스케줄
    var days = input.days || [];
    var weeklyMin = 0, nightMin = 0, dailyOtMin = 0, workDays = 0;
    for (var i = 0; i < 7; i++) {
      var d = days[i];
      if (!d || !d.on) continue;
      workDays++;
      var a = analyzeDay(d, i);
      errors = errors.concat(a.errors);
      warnings = warnings.concat(a.warnings);
      weeklyMin += a.worked;
      nightMin += a.night;
      dailyOtMin += a.overtime;
    }
    if (workDays === 0) {
      errors.push({ field: 'days', msg: '근무하는 요일을 하나 이상 선택해 주세요.' });
    }

    if (errors.length) return { ok: false, errors: errors, warnings: warnings };

    // 연장시간 = 일 8시간 초과분 + (그것을 뺀 나머지가 주 40시간을 넘는 분량)
    var otMin = dailyOtMin + Math.max(0, weeklyMin - dailyOtMin - 2400);
    var weeklyHours = weeklyMin / 60;

    // 경고·안내
    if (wage < R.minimumWage) {
      warnings.push(R.minimumWageYear + '년 최저임금(' + fmt(R.minimumWage) + '원)보다 낮습니다. 최저임금 미달은 법 위반입니다.');
    }
    if (input.fivePlus && weeklyHours > 52) {
      warnings.push('주 52시간(연장 12시간 포함)을 넘습니다. 5인 이상 사업장은 주 52시간을 넘길 수 없습니다.');
    }

    // 주휴수당
    var holidayEligible = weeklyHours >= R.weeklyHolidayMinHours;
    var holidayHours = holidayEligible ? Math.min(weeklyHours / 40 * 8, 8) : 0;
    if (!holidayEligible) {
      info.push('초단시간 근로자(주 15시간 미만): 주휴수당·퇴직금·국민연금·건강보험·고용보험 의무가 없고, 산재보험만 의무입니다.');
    }

    // 월 환산
    var monthlyPaidHours = Math.ceil((weeklyHours + holidayHours) * WEEKS_PER_MONTH - 1e-9);
    var basePay = Math.round(monthlyPaidHours * wage);
    var holidayPayMonthly = Math.round(holidayHours * wage * WEEKS_PER_MONTH);

    // 가산수당 (5인 이상만 의무)
    var nightPremiumCalc = Math.round(nightMin / 60 * wage * 0.5 * WEEKS_PER_MONTH);
    var otPremiumCalc = Math.round(otMin / 60 * wage * 0.5 * WEEKS_PER_MONTH);
    var nightPremium = input.fivePlus ? nightPremiumCalc : 0;
    var otPremium = input.fivePlus ? otPremiumCalc : 0;

    var monthlyWage = basePay + nightPremium + otPremium;

    // 4대보험 가입 의무 (산재 제외): 월 소정근로시간 60시간 이상
    var monthlyWorkHours = weeklyHours * WEEKS_PER_MONTH;
    var insRequired = monthlyWorkHours >= R.insuranceMinMonthlyHours;

    var np = 0, hi = 0, ltc = 0, ei = 0, npW = 0, hiW = 0, ltcW = 0, eiW = 0;
    if (insRequired) {
      var npBase = Math.min(Math.max(monthlyWage, R.nationalPension.baseMin), R.nationalPension.baseMax);
      np = floor10(npBase * R.nationalPension.employer);
      hi = floor10(monthlyWage * R.healthInsurance.employer);
      ltc = floor10(hi * R.longTermCare.ratioOfHealth);
      ei = floor10(monthlyWage * R.employmentInsurance.employer);
      npW = floor10(npBase * R.nationalPension.employee);
      hiW = floor10(monthlyWage * R.healthInsurance.employee);
      ltcW = floor10(hiW * R.longTermCare.ratioOfHealth);
      eiW = floor10(monthlyWage * R.employmentInsurance.employee);
    }
    var ia = floor10(monthlyWage * iaRate);
    var insTotal = np + hi + ltc + ei + ia;

    // 퇴직금 월 적립액
    var severanceEligible = !!input.longTerm && weeklyHours >= R.weeklyHolidayMinHours;
    var severanceCalc = Math.round(monthlyWage / 12);
    var severance = severanceEligible ? severanceCalc : 0;

    var totalPerPerson = monthlyWage + insTotal + severance;

    // 3.3% 비교 (근로자 실수령은 근로소득세 제외한 참고값)
    var withholding = floor10(monthlyWage * R.freelanceWithholding);
    var employeeNet = monthlyWage - (npW + hiW + ltcW + eiW);

    return {
      ok: true,
      errors: [],
      warnings: warnings,
      info: info,
      year: R.minimumWageYear,
      wage: wage,
      fivePlus: !!input.fivePlus,
      headcount: headcount,
      weeklyHours: weeklyHours,
      workDays: workDays,
      nightHoursWeek: nightMin / 60,
      overtimeHoursWeek: otMin / 60,
      holidayEligible: holidayEligible,
      holidayHours: holidayHours,
      holidayPayMonthly: holidayPayMonthly,
      monthlyPaidHours: monthlyPaidHours,
      monthlyWorkHours: monthlyWorkHours,
      basePay: basePay,
      nightPremium: nightPremium,
      otPremium: otPremium,
      refNightPremium: input.fivePlus ? 0 : nightPremiumCalc,
      refOtPremium: input.fivePlus ? 0 : otPremiumCalc,
      monthlyWage: monthlyWage,
      insRequired: insRequired,
      insurance: { np: np, hi: hi, ltc: ltc, ei: ei, ia: ia, total: insTotal },
      employeeInsurance: { np: npW, hi: hiW, ltc: ltcW, ei: eiW, total: npW + hiW + ltcW + eiW },
      iaRate: iaRate,
      iaLabel: iaLabel,
      severanceEligible: severanceEligible,
      severance: severance,
      refSeverance: severanceEligible ? 0 : (weeklyHours >= R.weeklyHolidayMinHours ? severanceCalc : 0),
      totalPerPerson: totalPerPerson,
      totalAll: totalPerPerson * headcount,
      annual: totalPerPerson * headcount * 12,
      freelance: {
        employerCost: monthlyWage,
        workerNet: monthlyWage - withholding,
        withholding: withholding
      },
      employed: {
        employerCost: monthlyWage + insTotal,
        workerNet: employeeNet
      },
      diff: insTotal
    };
  }

  function fmt(n) {
    return Math.round(n).toLocaleString('ko-KR');
  }

  var API = {
    calculate: calculate,
    parseTime: parseTime,
    nightMinutes: nightMinutes,
    fmt: fmt,
    WEEKS_PER_MONTH: WEEKS_PER_MONTH,
    DAY_NAMES: DAY_NAMES
  };
  root.SajangCalc = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
