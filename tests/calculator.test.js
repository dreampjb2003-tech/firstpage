// 실행: node tests/calculator.test.js  (PLAN.md 1-5 기준 예시 및 5-2 체크 항목 자동 검증)
const RATES = require('../js/rates.js');
// 기준 예시는 2026년 요율로 고정해서 검증 (오늘 날짜와 무관)
const R = RATES.resolve('2026-11-16');
const C = require('../js/calculator.js');
let fail = 0;
function eq(name, got, want) {
  const ok = Math.abs(got - want) < 1e-6;
  if (!ok) fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + ' → ' + got + (ok ? '' : ' (기대값 ' + want + ')'));
}
const day = (s, e, b) => ({ on: true, start: s, end: e, brk: b });
const off = { on: false, start: '09:00', end: '18:00', brk: 60 };
const base = (over) => Object.assign({
  wage: 10320, fivePlus: false, longTerm: true, industryId: 'food', customRate: '', headcount: 1,
  days: [day('09:00','18:00',60),day('09:00','18:00',60),day('09:00','18:00',60),day('09:00','18:00',60),day('09:00','18:00',60),off,off]
}, over);

let r = C.calculate(base(), R);
eq('주 근로시간', r.weeklyHours, 40);
eq('주휴시간', r.holidayHours, 8);
eq('월 유급시간', r.monthlyPaidHours, 209);
eq('월 기본급', r.basePay, 2156880);
eq('국민연금', r.insurance.np, 102450);
eq('건강보험', r.insurance.hi, 77530);
eq('장기요양', r.insurance.ltc, 10180);
eq('고용보험', r.insurance.ei, 24800);
eq('퇴직금 적립', r.severance, 179740);
eq('총액 - 산재', r.totalPerPerson - r.insurance.ia, 2551580);

r = C.calculate(base({ days: base().days.map((d,i)=> i===4 ? off : d) }), R);
eq('주 32시간 주휴시간', r.holidayHours, 6.4);

r = C.calculate(base({ days: [day('09:00','13:00',0),off,day('09:00','13:00',0),off,day('09:00','13:00',0),off,off] }), R);
eq('주 12시간 주휴 미발생', r.holidayEligible ? 1 : 0, 0);
eq('주 12시간 4대보험 의무 없음', r.insRequired ? 1 : 0, 0);
eq('주 12시간 국민연금 0', r.insurance.np, 0);
eq('주 12시간 산재는 계산', r.insurance.ia > 0 ? 1 : 0, 1);
eq('주 12시간 퇴직금 0', r.severance, 0);

const night = [day('22:00','06:00',60),off,off,off,off,off,off];
r = C.calculate(base({ fivePlus: true, days: night }), R);
eq('자정 넘김 근로시간', r.weeklyHours, 7);
eq('야간 시간(7h 상한)', r.nightHoursWeek, 7);
eq('5인 이상 야간가산', r.nightPremium, Math.round(7*10320*0.5*C.WEEKS_PER_MONTH));
r = C.calculate(base({ fivePlus: false, days: night }), R);
eq('5인 미만 야간가산 0', r.nightPremium, 0);
eq('5인 미만 참고금액 있음', r.refNightPremium > 0 ? 1 : 0, 1);

r = C.calculate(base({ fivePlus: true, days: [day('08:00','19:00',60),off,off,off,off,off,off] }), R);
eq('하루 10시간 연장 2시간', r.overtimeHoursWeek, 2);
r = C.calculate(base({ fivePlus: true, days: Array(6).fill(0).map(()=>day('09:00','17:00',0)).concat([off]) }), R);
eq('주 48시간(일 8h×6) 연장 8시간', r.overtimeHoursWeek, 8);

r = C.calculate(base({ longTerm: false }), R);
eq('1년 미만 퇴직금 0', r.severance, 0);
eq('1년 미만 적립 권장 참고', r.refSeverance, 179740);

r = C.calculate(base({ headcount: 3 }), R);
eq('직원 3명 합계', r.totalAll, r.totalPerPerson * 3);

r = C.calculate(base({ industryId: 'custom', customRate: '1' }), R);
eq('산재 직접입력 1%', r.insurance.ia, 21560);

r = C.calculate(base({ wage: '' }), R); eq('시급 빈칸 오류', r.ok ? 0 : 1, 1);
r = C.calculate(base({ wage: -5 }), R); eq('시급 음수 오류', r.ok ? 0 : 1, 1);
r = C.calculate(base({ wage: 9000 }), R); eq('최저임금 미달 경고(계산 진행)', r.ok && r.warnings.some(w=>w.includes('최저임금')) ? 1 : 0, 1);
r = C.calculate(base({ days: [off,off,off,off,off,off,off] }), R); eq('요일 없음 오류', r.ok ? 0 : 1, 1);
r = C.calculate(base({ days: [day('09:00','09:00',0),off,off,off,off,off,off] }), R); eq('시작=종료 오류', r.ok ? 0 : 1, 1);
r = C.calculate(base({ days: [day('09:00','10:00',90),off,off,off,off,off,off] }), R); eq('휴게 과다 오류', r.ok ? 0 : 1, 1);
r = C.calculate(base({ days: [day('09:00','18:00',30),off,off,off,off,off,off] }), R); eq('법정 휴게 미달 경고', r.warnings.some(w=>w.includes('휴게')) ? 1 : 0, 1);
r = C.calculate(base({ fivePlus: true, days: Array(6).fill(0).map(()=>day('08:00','19:00',60)).concat([off]) }), R);
eq('주 52시간 초과 경고', r.warnings.some(w=>w.includes('52')) ? 1 : 0, 1);
r = C.calculate(base({ headcount: 500 }), R); eq('직원 수 보정', r.headcount, 100);

// 적용 시작일 자동 반영
const R26 = RATES.resolve('2026-12-31'), R27 = RATES.resolve('2027-01-01');
eq('2026-12-31 국민연금 4.75%', R26.nationalPension.employer, 0.0475);
eq('2027-01-01 국민연금 5% 자동 적용', R27.nationalPension.employer, 0.05);
eq('2027-01-01 건강보험은 이전 값 유지', R27.healthInsurance.employer, 0.03595);
eq('2027년 최저임금 미입력 알림', R27.minimumWageStale ? 1 : 0, 1);
eq('2026년에는 알림 없음', R26.minimumWageStale ? 1 : 0, 0);
eq('2027년 국민연금 (기준 예시)', C.calculate(base(), R27).insurance.np, 107840);

console.log(fail ? '\n실패 ' + fail + '건' : '\n전체 통과');
process.exit(fail ? 1 : 0);
