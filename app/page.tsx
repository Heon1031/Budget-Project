"use client";

import { useEffect, useMemo, useState } from "react";

type Person = {
  name: string;
  annualGross: number;
  monthlyNonTaxable: number;
  actualNet: number;
  monthlyInvestment: number;
  monthlyFood: number;
  monthlyHousing: number;
  monthlyCulture: number;
  annualTravel: number;
};

type Plan = {
  currentAssets: number;
  targetAssets: number;
  targetMonths: number;
  livingCost: number;
  debtPayment: number;
  allowanceA: number;
  allowanceB: number;
  academyCost: number;
};

type AppState = {
  people: [Person, Person];
  plan: Plan;
  marriageRegistered: boolean;
};

const STORAGE_KEY = "duri-asset-plan-v2";
const RULES = {
  year: 2026,
  pensionEmployee: 0.0475,
  pensionMin: 410_000,
  pensionMax: 6_590_000,
  healthEmployee: 0.03595,
  longTermCareTotal: 0.009448,
  healthTotal: 0.0719,
  employmentEmployee: 0.009,
};

const initialState: AppState = {
  people: [
    {
      name: "나",
      annualGross: 52_000_000,
      monthlyNonTaxable: 200_000,
      actualNet: 0,
      monthlyInvestment: 1_100_000,
      monthlyFood: 500_000,
      monthlyHousing: 700_000,
      monthlyCulture: 200_000,
      annualTravel: 2_600_000,
    },
    {
      name: "배우자",
      annualGross: 40_000_000,
      monthlyNonTaxable: 200_000,
      actualNet: 0,
      monthlyInvestment: 900_000,
      monthlyFood: 400_000,
      monthlyHousing: 600_000,
      monthlyCulture: 160_000,
      annualTravel: 2_000_000,
    },
  ],
  plan: {
    currentAssets: 30_000_000,
    targetAssets: 100_000_000,
    targetMonths: 60,
    livingCost: 2_200_000,
    debtPayment: 0,
    allowanceA: 300_000,
    allowanceB: 300_000,
    academyCost: 300_000,
  },
  marriageRegistered: false,
};

const won = (value: number) => `${Math.round(Math.max(0, value)).toLocaleString("ko-KR")}원`;
const signedWon = (value: number) =>
  `${value < 0 ? "-" : ""}${Math.round(Math.abs(value)).toLocaleString("ko-KR")}원`;
const manwon = (value: number) => `${Math.round(Math.max(0, value) / 10_000).toLocaleString("ko-KR")}만원`;
const parseWon = (value: string) => Number(value.replace(/[^\d]/g, "")) || 0;
const round10 = (value: number) => Math.floor(value / 10) * 10;

function earnedIncomeDeduction(gross: number) {
  if (gross <= 5_000_000) return gross * 0.7;
  if (gross <= 15_000_000) return 3_500_000 + (gross - 5_000_000) * 0.4;
  if (gross <= 45_000_000) return 7_500_000 + (gross - 15_000_000) * 0.15;
  if (gross <= 100_000_000) return 12_000_000 + (gross - 45_000_000) * 0.05;
  return Math.min(20_000_000, 14_750_000 + (gross - 100_000_000) * 0.02);
}

function progressiveIncomeTax(base: number) {
  if (base <= 14_000_000) return base * 0.06;
  if (base <= 50_000_000) return base * 0.15 - 1_260_000;
  if (base <= 88_000_000) return base * 0.24 - 5_760_000;
  if (base <= 150_000_000) return base * 0.35 - 15_440_000;
  if (base <= 300_000_000) return base * 0.38 - 19_940_000;
  if (base <= 500_000_000) return base * 0.4 - 25_940_000;
  if (base <= 1_000_000_000) return base * 0.42 - 35_940_000;
  return base * 0.45 - 65_940_000;
}

function earnedIncomeTaxCredit(calculatedTax: number, gross: number) {
  const raw = calculatedTax <= 1_300_000
    ? calculatedTax * 0.55
    : 715_000 + (calculatedTax - 1_300_000) * 0.3;
  let cap = 740_000;
  if (gross > 33_000_000 && gross <= 70_000_000) {
    cap = Math.max(660_000, 740_000 - (gross - 33_000_000) * 0.008);
  } else if (gross > 70_000_000 && gross <= 120_000_000) {
    cap = Math.max(500_000, 660_000 - (gross - 70_000_000) * 0.5);
  } else if (gross > 120_000_000) {
    cap = Math.max(200_000, 500_000 - (gross - 120_000_000) * 0.5);
  }
  return Math.min(raw, cap);
}

function calculateSalary(person: Person) {
  const monthlyGross = person.annualGross / 12;
  const taxableMonthly = Math.max(0, monthlyGross - person.monthlyNonTaxable);
  const pensionBase = taxableMonthly > 0
    ? Math.min(RULES.pensionMax, Math.max(RULES.pensionMin, Math.floor(taxableMonthly / 1000) * 1000))
    : 0;
  const pension = round10(pensionBase * RULES.pensionEmployee);
  const health = round10(taxableMonthly * RULES.healthEmployee);
  const longTermCare = round10(health * (RULES.longTermCareTotal / RULES.healthTotal));
  const employment = round10(taxableMonthly * RULES.employmentEmployee);
  const annualInsurance = (pension + health + longTermCare + employment) * 12;

  const annualTaxableSalary = taxableMonthly * 12;
  const earnedIncome = Math.max(0, annualTaxableSalary - earnedIncomeDeduction(annualTaxableSalary));
  const taxBase = Math.max(0, earnedIncome - 1_500_000 - annualInsurance);
  const calculatedTax = Math.max(0, progressiveIncomeTax(taxBase));
  const annualIncomeTax = Math.max(
    0,
    calculatedTax - earnedIncomeTaxCredit(calculatedTax, annualTaxableSalary) - 130_000,
  );
  const incomeTax = round10(annualIncomeTax / 12);
  const localIncomeTax = round10(incomeTax * 0.1);
  const estimatedNet = Math.max(
    0,
    monthlyGross - pension - health - longTermCare - employment - incomeTax - localIncomeTax,
  );

  return {
    monthlyGross,
    taxableMonthly,
    pension,
    health,
    longTermCare,
    employment,
    incomeTax,
    localIncomeTax,
    estimatedNet,
    net: person.actualNet > 0 ? person.actualNet : estimatedNet,
    isActual: person.actualNet > 0,
  };
}

function MoneyField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}{hint && <small>{hint}</small>}</span>
      <div className="money-field">
        <input
          inputMode="numeric"
          value={value ? value.toLocaleString("ko-KR") : ""}
          onChange={(event) => onChange(parseWon(event.target.value))}
          placeholder="0"
        />
        <b>원</b>
      </div>
    </label>
  );
}

export default function Home() {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [openBreakdown, setOpenBreakdown] = useState<0 | 1 | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setState(JSON.parse(saved) as AppState);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const salary = useMemo(
    () => state.people.map(calculateSalary) as [ReturnType<typeof calculateSalary>, ReturnType<typeof calculateSalary>],
    [state.people],
  );

  const result = useMemo(() => {
    const totalNet = salary[0].net + salary[1].net;
    const shares: [number, number] = totalNet > 0
      ? [salary[0].net / totalNet, salary[1].net / totalNet]
      : [0.5, 0.5];
    const assetGap = Math.max(0, state.plan.targetAssets - state.plan.currentAssets);
    const requiredAssetMonthly = state.plan.targetMonths > 0 ? assetGap / state.plan.targetMonths : assetGap;
    const essential = state.plan.livingCost + state.plan.debtPayment;
    const jointNeed = essential + requiredAssetMonthly;
    const afterGoal = totalNet - jointNeed;
    const allowances = state.plan.allowanceA + state.plan.allowanceB;
    const afterAllowances = afterGoal - allowances;
    const academyPossible = afterAllowances >= state.plan.academyCost;
    const extraInvestment = Math.max(0, afterAllowances - state.plan.academyCost);
    const shortfall = Math.max(0, -(afterAllowances - state.plan.academyCost));
    const monthsAtCurrentPace = assetGap > 0 && requiredAssetMonthly + extraInvestment > 0
      ? Math.ceil(assetGap / (requiredAssetMonthly + extraInvestment))
      : 0;
    const personalBudgets = state.people.map((person) =>
      (person.monthlyInvestment || 0) +
      (person.monthlyFood || 0) +
      (person.monthlyHousing || 0) +
      (person.monthlyCulture || 0) +
      (person.annualTravel || 0) / 12,
    ) as [number, number];
    const personalRemaining = personalBudgets.map((budget, index) =>
      salary[index].net - budget,
    ) as [number, number];
    return {
      totalNet,
      shares,
      assetGap,
      requiredAssetMonthly,
      essential,
      jointNeed,
      afterGoal,
      academyPossible,
      extraInvestment,
      shortfall,
      monthsAtCurrentPace,
      personalBudgets,
      personalRemaining,
    };
  }, [salary, state.plan, state.people]);

  const updatePerson = (index: 0 | 1, patch: Partial<Person>) => {
    setState((current) => {
      const people = [...current.people] as [Person, Person];
      people[index] = { ...people[index], ...patch };
      return { ...current, people };
    });
  };

  const updatePlan = (patch: Partial<Plan>) =>
    setState((current) => ({ ...current, plan: { ...current.plan, ...patch } }));

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-mark">둘</span><span>둘이자산</span></a>
        <span className="save-dot">● 이 기기에 자동 저장</span>
        <button onClick={() => setState(initialState)}>예시값으로 초기화</button>
      </header>

      <div className="layout" id="top">
        <div className="content">
          <section className="card">
            <div className="title-row">
              <div><span className="step">01</span><div><h2>우리 둘의 월급과 예산</h2><p>왼쪽은 나, 오른쪽은 배우자가 각자 입력해요</p></div></div>
              <span className="official-badge">공식 요율 반영</span>
            </div>

            <div className="marriage-note">
              <div>
                <strong>현재 혼인신고 상태</strong>
                <p>혼인신고 여부는 4대보험 요율을 바꾸지 않지만, 배우자 공제·혼인세액공제 등에는 영향을 줄 수 있어요.</p>
              </div>
              <div className="toggle-group">
                <button className={!state.marriageRegistered ? "active" : ""} onClick={() => setState((v) => ({ ...v, marriageRegistered: false }))}>혼인신고 전</button>
                <button className={state.marriageRegistered ? "active" : ""} onClick={() => setState((v) => ({ ...v, marriageRegistered: true }))}>혼인신고 완료</button>
              </div>
            </div>

            <div className="salary-grid">
              {state.people.map((person, index) => {
                const calc = salary[index];
                return (
                  <article className={`salary-card person-${index + 1}`} key={index}>
                    <div className="person-title">
                      <span>{index === 0 ? "A" : "B"}</span>
                      <input
                        aria-label={`${index + 1}번째 사람 이름`}
                        value={person.name}
                        onChange={(event) => updatePerson(index as 0 | 1, { name: event.target.value })}
                      />
                    </div>
                    <MoneyField label="세전 연봉" value={person.annualGross} onChange={(annualGross) => updatePerson(index as 0 | 1, { annualGross })} />
                    <MoneyField label="월 비과세 급여" hint="식대 등" value={person.monthlyNonTaxable} onChange={(monthlyNonTaxable) => updatePerson(index as 0 | 1, { monthlyNonTaxable })} />
                    <div className="net-result">
                      <span>{calc.isActual ? "급여명세서 실수령액" : "예상 월 실수령액"}</span>
                      <strong>{won(calc.net)}</strong>
                      <small>월 세전 {won(calc.monthlyGross)}</small>
                    </div>
                    <MoneyField
                      label="실제 실수령액"
                      hint="선택 입력"
                      value={person.actualNet}
                      onChange={(actualNet) => updatePerson(index as 0 | 1, { actualNet })}
                    />
                    <button className="breakdown-button" onClick={() => setOpenBreakdown(openBreakdown === index ? null : index as 0 | 1)}>
                      공제 내역 {openBreakdown === index ? "접기 −" : "보기 +"}
                    </button>
                    {openBreakdown === index && (
                      <div className="deductions">
                        <p><span>국민연금</span><b>-{won(calc.pension)}</b></p>
                        <p><span>건강보험</span><b>-{won(calc.health)}</b></p>
                        <p><span>장기요양</span><b>-{won(calc.longTermCare)}</b></p>
                        <p><span>고용보험</span><b>-{won(calc.employment)}</b></p>
                        <p><span>예상 소득세</span><b>-{won(calc.incomeTax)}</b></p>
                        <p><span>예상 지방소득세</span><b>-{won(calc.localIncomeTax)}</b></p>
                      </div>
                    )}
                    <div className="personal-divider"><span>각자 쓰는 돈</span></div>
                    <MoneyField
                      label="월 투자·적금"
                      hint={`권장 30%↑ · 현재 ${calc.net ? Math.round(((person.monthlyInvestment || 0) / calc.net) * 100) : 0}%`}
                      value={person.monthlyInvestment || 0}
                      onChange={(monthlyInvestment) => updatePerson(index as 0 | 1, { monthlyInvestment })}
                    />
                    <MoneyField
                      label="월 식생활비"
                      hint={`권장 15% 이내 · 현재 ${calc.net ? Math.round(((person.monthlyFood || 0) / calc.net) * 100) : 0}%`}
                      value={person.monthlyFood || 0}
                      onChange={(monthlyFood) => updatePerson(index as 0 | 1, { monthlyFood })}
                    />
                    <MoneyField
                      label="월 주거비"
                      hint={calc.net ? `실수령의 ${Math.round(((person.monthlyHousing || 0) / calc.net) * 100)}%` : "직접 입력"}
                      value={person.monthlyHousing || 0}
                      onChange={(monthlyHousing) => updatePerson(index as 0 | 1, { monthlyHousing })}
                    />
                    <MoneyField
                      label="월 문화·레저비"
                      hint={`연봉 5%÷12 기준 ${manwon(person.annualGross * 0.05 / 12)}`}
                      value={person.monthlyCulture || 0}
                      onChange={(monthlyCulture) => updatePerson(index as 0 | 1, { monthlyCulture })}
                    />
                    <MoneyField
                      label="연간 여행비"
                      hint={`연봉 5% 기준 ${manwon(person.annualGross * 0.05)}`}
                      value={person.annualTravel || 0}
                      onChange={(annualTravel) => updatePerson(index as 0 | 1, { annualTravel })}
                    />
                    <div className={`personal-balance ${result.personalRemaining[index] < 0 ? "negative" : ""}`}>
                      <span>계획하고 남는 월 금액</span>
                      <strong>{signedWon(result.personalRemaining[index])}</strong>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="income-share">
              <div className="share-labels">
                <p><strong>{state.people[0].name} {Math.round(result.shares[0] * 100)}%</strong><span>{won(salary[0].net)}</span></p>
                <p><strong>{state.people[1].name} {Math.round(result.shares[1] * 100)}%</strong><span>{won(salary[1].net)}</span></p>
              </div>
              <div className="share-bar"><span style={{ width: `${result.shares[0] * 100}%` }} /></div>
              <small>합산 실수령액 {won(result.totalNet)}을 기준으로 한 소득 비중이에요.</small>
            </div>
          </section>

          <section className="card">
            <div className="title-row">
              <div><span className="step">02</span><div><h2>우리 자산 목표</h2><p>목표를 월 단위 행동으로 바꿔요</p></div></div>
            </div>
            <div className="goal-grid">
              <MoneyField label="현재 함께 모은 자산" value={state.plan.currentAssets} onChange={(currentAssets) => updatePlan({ currentAssets })} />
              <MoneyField label="목표 자산" value={state.plan.targetAssets} onChange={(targetAssets) => updatePlan({ targetAssets })} />
              <label className="field">
                <span>목표 기간<small>개월</small></span>
                <div className="money-field"><input inputMode="numeric" value={state.plan.targetMonths} onChange={(e) => updatePlan({ targetMonths: Number(e.target.value) || 0 })} /><b>개월</b></div>
              </label>
            </div>
            <div className="goal-callout">
              <div><span>목표까지 남은 금액</span><strong>{manwon(result.assetGap)}</strong></div>
              <div><span>매달 필요한 자산형성액</span><strong>{manwon(result.requiredAssetMonthly)}</strong></div>
              <div><span>예상 달성</span><strong>{result.monthsAtCurrentPace || state.plan.targetMonths}개월</strong></div>
            </div>
          </section>

          <section className="card">
            <div className="title-row">
              <div><span className="step">03</span><div><h2>이번 달 선택</h2><p>생활비·용돈·학원비를 넣어 가능 여부를 확인해요</p></div></div>
            </div>
            <div className="choice-grid">
              <MoneyField label="공동 생활비" value={state.plan.livingCost} onChange={(livingCost) => updatePlan({ livingCost })} />
              <MoneyField label="대출 상환액" value={state.plan.debtPayment} onChange={(debtPayment) => updatePlan({ debtPayment })} />
              <MoneyField label={`${state.people[0].name} 월 용돈`} value={state.plan.allowanceA} onChange={(allowanceA) => updatePlan({ allowanceA })} />
              <MoneyField label={`${state.people[1].name} 월 용돈`} value={state.plan.allowanceB} onChange={(allowanceB) => updatePlan({ allowanceB })} />
              <MoneyField label="다니고 싶은 학원비" value={state.plan.academyCost} onChange={(academyCost) => updatePlan({ academyCost })} />
            </div>
          </section>

          <section className="sources-card">
            <div>
              <span className="source-check">✓</span>
              <div><strong>2026년 8월 공식 자료 기준</strong><p>국가 사이트를 매 계산마다 호출하지 않고, 공개된 요율을 버전 관리해 안정적으로 계산합니다.</p></div>
            </div>
            <div className="source-links">
              <a href="https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0097M0.do" target="_blank" rel="noreferrer">국민연금공단 4대보험 ↗</a>
              <a href="https://edi.nhis.or.kr/portal/images/popup/20251204_pop01longdesc.html" target="_blank" rel="noreferrer">건강보험공단 요율 ↗</a>
              <a href="https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7862&mi=6583" target="_blank" rel="noreferrer">국세청 간이세액표 ↗</a>
            </div>
          </section>
        </div>

        <aside className="result-panel" aria-live="polite">
          <span className="panel-kicker">OUR ASSET PLAN</span>
          <h2>이번 달 결론</h2>

          <div className="big-result">
            <span>합산 월 실수령액</span>
            <strong>{won(result.totalNet)}</strong>
          </div>

          <div className="flow">
            <p><span>필수 생활·상환</span><b>-{won(result.essential)}</b></p>
            <p><span>목표 자산형성</span><b>-{won(result.requiredAssetMonthly)}</b></p>
            <p><span>두 사람 용돈</span><b>-{won(state.plan.allowanceA + state.plan.allowanceB)}</b></p>
            <p><span>희망 학원비</span><b>-{won(state.plan.academyCost)}</b></p>
          </div>

          <div className={`decision ${result.academyPossible ? "yes" : "no"}`}>
            <span>{result.academyPossible ? "가능" : "조정 필요"}</span>
            <div>
              <strong>학원, {result.academyPossible ? "다닐 수 있어요" : "지금은 부담돼요"}</strong>
              <p>{result.academyPossible ? `목표를 지키고도 월 ${manwon(result.extraInvestment)}이 남아요.` : `월 ${manwon(result.shortfall)}을 더 줄이거나 목표 기간을 늘려야 해요.`}</p>
            </div>
          </div>

          <div className="investment">
            <span>추가 투자 가능액</span>
            <strong>{won(result.extraInvestment)}</strong>
            <small>목표 자산형성액과 희망 지출을 모두 반영한 뒤 남는 금액</small>
          </div>

          <div className="contributions">
            <span>소득 비중으로 보면 이번 달 공동 필요액</span>
            {[0, 1].map((index) => (
              <p key={index}>
                <span>{state.people[index].name} <small>{Math.round(result.shares[index] * 100)}%</small></span>
                <b>{won(result.jointNeed * result.shares[index])}</b>
              </p>
            ))}
          </div>

          <div className="marriage-info">
            <strong>{state.marriageRegistered ? "혼인신고 완료 기준" : "혼인신고 전 기준"}</strong>
            <p>{state.marriageRegistered
              ? "혼인신고한 해에는 요건 충족 시 1인당 50만원 혼인세액공제를 검토할 수 있어요. 월 급여세와는 별도로 연말정산에서 반영됩니다."
              : "사실혼 배우자는 배우자 기본공제와 2024~2026년 혼인세액공제 대상이 아닙니다. 두 사람의 급여세는 각각 독립적으로 계산했어요."}</p>
          </div>
        </aside>
      </div>

      <footer>
        <span>둘이자산 · 신혼부부 자산형성 플래너</span>
        <p>본 결과는 참고용 추정이며 급여명세서·연말정산·금융상담을 대체하지 않습니다.</p>
      </footer>
    </main>
  );
}
