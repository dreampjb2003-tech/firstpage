/*
 * 사장님계산기 — 기준값 일정표 (매년 이 파일만 고치면 됩니다)
 *
 * 작동 방식
 *   SCHEDULE의 각 항목은 "from(적용 시작일)부터 바뀌는 값"입니다.
 *   계산기는 오늘 날짜 기준으로 시작일이 지난 항목을 순서대로 덮어써서 사용합니다.
 *   → 이미 공지된 인상을 미리 넣어 두면, 그 날짜가 되는 순간 자동으로 반영됩니다.
 *   → 바뀌지 않는 값은 적지 않아도 이전 값이 그대로 이어집니다.
 *   주소 뒤에 ?asof=2027-01-01 을 붙이면 그 날짜 기준으로 미리 볼 수 있습니다.
 *
 * ⚠️ 출시 전 반드시 공식 고시와 하나씩 대조하세요.
 *   - 최저임금: 최저임금위원회 / 고용노동부 고시
 *   - 국민연금·건강보험·장기요양·고용보험: 4대사회보험 정보연계센터, 각 공단 고시
 *   - 산재보험 업종별 요율: 근로복지공단 / 고용노동부 고시
 */
(function (root) {
  'use strict';

  var SCHEDULE = [
    {
      from: '2026-01-01',
      note: '2026년 최저임금·4대보험 요율',
      values: {
        minimumWage: 10320,
        minimumWageYear: 2026,
        // 국민연금 (총 9.5% → 사업주·근로자 각 4.75%)
        // 기준소득월액 하한·상한은 매년 7월 변경 — 확인 필요
        nationalPension: { employer: 0.0475, employee: 0.0475, baseMin: 400000, baseMax: 6370000 },
        // 건강보험 (총 7.19% → 각 3.595%)
        healthInsurance: { employer: 0.03595, employee: 0.03595 },
        // 장기요양보험: 건강보험료 × 13.14%
        longTermCare: { ratioOfHealth: 0.1314 },
        // 고용보험: 사업주 = 실업급여 0.9% + 고용안정·직업능력개발 0.25%(150인 미만)
        employmentInsurance: { employer: 0.0115, employee: 0.009 },
        // 산재보험 업종별 요율 (전액 사업주, 출퇴근재해 요율 포함 값)
        // [직접 작성 필요] 아래 값은 임시값입니다. 근로복지공단 고시로 확인 후 고치고
        // industrialVerified를 true로 바꾸세요.
        industrialVerified: false,
        industrial: [
          { id: 'food', label: '도소매·음식·숙박업', rate: 0.0086 },
          { id: 'edu', label: '교육서비스업', rate: 0.0066 },
          { id: 'service', label: '보건·여가 서비스업', rate: 0.0066 },
          { id: 'etc', label: '기타의 각종사업', rate: 0.0096 }
        ],

        // 두루누리 사회보험료 지원 — [직접 작성 필요] 두루누리 공식 사이트에서 올해 기준 확인 후
        // 값을 고치고 verified를 true로 바꾸세요. 아래는 확인 전 임시값입니다.
        durunuri: {
          verified: false,
          maxWorkers: 10,        // 근로자 수 이 숫자 미만 사업장
          payLimit: 2700000,     // 월평균보수 이 금액 미만
          rate: 0.8,             // 신규 가입자 지원율
          months: 36,            // 최대 지원 개월 수
          eiRate: 0.009          // 지원 대상 고용보험료율(실업급여분, 사업주·근로자 각각)
        },

        // 일용근로소득 원천징수 — [직접 작성 필요] 국세청 안내로 확인 후 verified를 true로 바꾸세요.
        dailyWorker: {
          verified: false,
          deduction: 150000,     // 1일 근로소득공제
          rate: 0.06,            // 세율
          credit: 0.55,          // 근로소득세액공제율
          minTax: 1000,          // 소액부징수: 원천징수세액이 이 금액 미만이면 징수하지 않음
          localRate: 0.1         // 지방소득세 = 소득세 × 10%
        }
      }
    },
    {
      from: '2027-01-01',
      note: '국민연금 보험료율 9.5% → 10% (2025년 국민연금법 개정으로 공지된 단계적 인상)',
      values: {
        nationalPension: { employer: 0.05, employee: 0.05, baseMin: 400000, baseMax: 6370000 }
      }
    }
    // [직접 작성 필요] 2027년 최저임금이 고시되면 아래 형식으로 추가하세요.
    // ,{ from: '2027-01-01', note: '2027년 최저임금', values: { minimumWage: 00000, minimumWageYear: 2027 } }
  ];

  // 매년 바뀌지 않는 기준
  var FIXED = {
    freelanceWithholding: 0.033,     // 3.3% (소득세 3% + 지방소득세 0.3%)
    insuranceMinMonthlyHours: 60,    // 4대보험(산재 제외) 가입 의무: 월 소정근로 60시간
    weeklyHolidayMinHours: 15        // 주휴수당 발생: 주 소정근로 15시간
  };

  // [직접 작성 필요] 위 값들을 공식 고시와 직접 대조한 날짜 (예: '2026-12-01')
  var VERIFIED_DATE = '';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* date('YYYY-MM-DD') 기준으로 적용되는 값을 합쳐서 돌려줌 */
  function resolve(date) {
    var R = {}, k, applied = [];
    for (k in FIXED) R[k] = FIXED[k];
    var list = SCHEDULE.slice().sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : 0; });
    list.forEach(function (e) {
      if (e.from <= date) {
        for (var key in e.values) R[key] = e.values[key];
        applied.push(e);
      }
    });
    R.asOf = date;
    R.effectiveFrom = applied.length ? applied[applied.length - 1].from : list[0].from;
    R.appliedNotes = applied.map(function (e) { return e.from + ' ' + e.note; });
    R.upcoming = list.filter(function (e) { return e.from > date; }).map(function (e) { return e.from + ' ' + e.note; });
    R.verifiedDate = VERIFIED_DATE;
    // 오늘 연도의 최저임금이 아직 입력되지 않았으면 운영자에게 알림
    R.minimumWageStale = R.minimumWageYear < +date.slice(0, 4);
    return R;
  }

  var asof = today();
  try {
    var m = /[?&]asof=(\d{4}-\d{2}-\d{2})(?:&|$)/.exec(root.location ? root.location.search : '');
    if (m) asof = m[1];
  } catch (e) { /* 무시 */ }

  var CURRENT = resolve(asof);
  CURRENT.resolve = resolve;
  CURRENT.SCHEDULE = SCHEDULE;

  root.SAJANG_RATES = CURRENT;
  if (typeof module !== 'undefined' && module.exports) module.exports = CURRENT;
})(typeof window !== 'undefined' ? window : globalThis);
