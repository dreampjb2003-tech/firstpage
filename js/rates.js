/*
 * 사장님계산기 — 연도별 기준값 (매년 이 파일만 고치면 됩니다)
 *
 * ⚠️ 출시 전 반드시 공식 고시와 하나씩 대조하세요.
 *   - 최저임금: 최저임금위원회 / 고용노동부 고시
 *   - 국민연금·건강보험·장기요양·고용보험: 4대사회보험 정보연계센터, 각 공단 고시
 *   - 산재보험 업종별 요율: 근로복지공단 / 고용노동부 고시
 * 대조를 마치면 verifiedDate에 확인한 날짜를 'YYYY-MM-DD' 형식으로 적으세요.
 * (비워 두면 결과 화면에 "확인 필요"가 표시됩니다.)
 */
(function (root) {
  'use strict';

  var RATES = {
    year: 2026,

    // [직접 작성 필요] 공식 고시를 직접 확인한 날짜 (예: '2026-12-01')
    verifiedDate: '',

    // 최저임금 (시급, 원)
    minimumWage: 10320,

    // 국민연금 (총 9.5% → 사업주·근로자 각 4.75%)
    nationalPension: {
      employer: 0.0475,
      employee: 0.0475,
      // 기준소득월액 하한·상한 (매년 7월 변경) — 확인 필요
      baseMin: 400000,
      baseMax: 6370000
    },

    // 건강보험 (총 7.19% → 각 3.595%)
    healthInsurance: { employer: 0.03595, employee: 0.03595 },

    // 장기요양보험: 건강보험료 × 13.14%
    longTermCare: { ratioOfHealth: 0.1314 },

    // 고용보험
    employmentInsurance: {
      employer: 0.0115, // 실업급여 0.9% + 고용안정·직업능력개발 0.25% (150인 미만)
      employee: 0.009
    },

    // 산재보험 업종별 요율 (전액 사업주 부담, 출퇴근재해 요율 포함 값으로 입력)
    // [직접 작성 필요] 아래 값은 임시값입니다. 근로복지공단 고시로 확인 후 고치고
    // industrialVerified를 true로 바꾸세요.
    industrialVerified: false,
    industrial: [
      { id: 'food', label: '도소매·음식·숙박업 (카페·음식점·편의점)', rate: 0.0086 },
      { id: 'edu', label: '교육서비스업 (학원 등)', rate: 0.0066 },
      { id: 'service', label: '전문·보건·여가 관련 서비스업', rate: 0.0066 },
      { id: 'etc', label: '기타의 각종사업', rate: 0.0096 }
    ],

    // 3.3% 사업소득 원천징수 (소득세 3% + 지방소득세 0.3%)
    freelanceWithholding: 0.033,

    // 4대보험(산재 제외) 가입 의무 기준: 월 소정근로시간
    insuranceMinMonthlyHours: 60,

    // 주휴수당 발생 기준: 주 소정근로시간
    weeklyHolidayMinHours: 15
  };

  root.SAJANG_RATES = RATES;
  if (typeof module !== 'undefined' && module.exports) module.exports = RATES;
})(typeof window !== 'undefined' ? window : globalThis);
