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

// ---------- v2 계산기 (PLAN.md v2 5-3 기준값) ----------
r = C.calculate(base(), R);
eq('실제 시간당 비용 배수 약 1.43 (산재 포함)', Math.round(r.realMultiple*100)/100, 1.43);
eq('실제 시간당 비용 (산재 제외) 약 14,680', Math.round((r.totalPerPerson-r.insurance.ia)/(40*C.WEEKS_PER_MONTH)/10)*10, 14680);

r = C.weeklyHoliday({ wage: 10320, weeklyHours: 20, attended: true }, R);
eq('주휴: 주 20시간 → 4시간', r.holidayHours, 4);
eq('주휴: 주 20시간 주휴수당(주)', r.weeklyPay, 41280);
r = C.weeklyHoliday({ wage: 10320, weeklyHours: 20, attended: false }, R);
eq('주휴: 개근 아님 → 0원', r.weeklyPay, 0);
r = C.weeklyHoliday({ wage: 10320, weeklyHours: 14, attended: true }, R);
eq('주휴: 14시간 → 1시간 남음', r.remainingTo15, 1);
r = C.weeklyHoliday({ wage: 10320, weeklyHours: 45, attended: true }, R);
eq('주휴: 45시간 → 상한 8시간', r.holidayHours, 8);
r = C.weeklyHoliday({ wage: '', weeklyHours: 20 }, R); eq('주휴: 시급 빈칸 오류', r.ok ? 0 : 1, 1);

r = C.insurance({ pay: 2156880, monthlyHours: 174, industryId: 'food' }, R);
eq('4대보험 국민연금', r.employer.np, 102450); eq('4대보험 건강', r.employer.hi, 77530);
eq('4대보험 장기요양', r.employer.ltc, 10180); eq('4대보험 고용', r.employer.ei, 24800);
eq('4대보험 근로자 고용 0.9%', r.employee.ei, 19410);
r = C.insurance({ pay: 500000, monthlyHours: 52, industryId: 'food' }, R);
eq('4대보험 월 60시간 미만 → 국민연금 0', r.employer.np, 0);
eq('4대보험 월 60시간 미만 → 산재는 계산', r.employer.ia > 0 ? 1 : 0, 1);
r = C.insurance({ pay: 300000, monthlyHours: 80, industryId: 'food' }, R);
eq('4대보험 국민연금 하한 적용', r.employer.np, 19000);
r = C.insurance({ pay: 0, monthlyHours: 174, industryId: 'food' }, R); eq('4대보험 0원 오류', r.ok ? 0 : 1, 1);

r = C.hourlyMonthly({ direction: 'h2m', amount: 10320, weeklyHours: 40, includeHoliday: true }, R);
eq('시급→월급 209시간', r.monthlyPaidHours, 209); eq('시급→월급 금액', r.monthly, 2156880);
r = C.hourlyMonthly({ direction: 'm2h', amount: 2500000, weeklyHours: 40, includeHoliday: true }, R);
eq('월급→시급 약 11,962원', Math.round(r.hourly), 11962);
r = C.hourlyMonthly({ direction: 'm2h', amount: 2000000, weeklyHours: 40, includeHoliday: true }, R);
eq('월급 200만원 최저임금 미달', r.belowMin ? 1 : 0, 1);
r = C.hourlyMonthly({ direction: 'h2m', amount: 10320, weeklyHours: 60 }, R); eq('주 52시간 초과 오류', r.ok ? 0 : 1, 1);

r = C.nightDirect({ wage: 10320, nightHours: 40, fivePlus: true }, R);
eq('야간 직접입력 40시간 → 896,857원', r.nightPremium, 896857);
r = C.nightDirect({ wage: 10320, nightHours: 40, fivePlus: false }, R);
eq('야간 5인 미만 → 0원 + 참고', r.nightPremium === 0 && r.refNightPremium === 896857 ? 1 : 0, 1);

r = C.severance({ start: '2025-01-01', lastDay: '2026-06-30', wage3: 6470640, over15: true });
eq('퇴직금 재직일수 546', r.days, 546); eq('퇴직금 산정기간 91일', r.periodDays, 91);
eq('퇴직금 약 3,191,001원', r.severance, 3191001);
r = C.severance({ start: '2025-08-01', lastDay: '2026-06-30', wage3: 6470640, over15: true });
eq('퇴직금 11개월 → 대상 아님', r.eligible ? 1 : 0, 0); eq('퇴직금 남은 일수 > 0', r.remainingDays > 0 ? 1 : 0, 1);
r = C.severance({ start: '2025-01-01', lastDay: '2026-06-30', wage3: 6470640, over15: false });
eq('퇴직금 주 15시간 미만 → 0원', r.severance, 0);
r = C.severance({ start: '2026-06-30', lastDay: '2025-01-01', wage3: 1 }); eq('퇴직금 날짜 역전 오류', r.ok ? 0 : 1, 1);
r = C.severance({ start: '2025-01-31', lastDay: '2026-05-30', wage3: 6000000 });
eq('퇴직금 말일 처리(5/31-3개월=2/28)', r.periodStart === '2026-02-28' ? 1 : 0, 1);

console.log(fail ? '\n실패 ' + fail + '건' : '\n전체 통과');
process.exit(fail ? 1 : 0);
