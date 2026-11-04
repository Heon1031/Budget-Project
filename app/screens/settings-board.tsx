"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { MoneyField, won } from "./fields";
import { initialState, type AppState, type Person, type calculateSalary } from "../lib/calc/plan";

// 설정: 두 사람의 월급(실수령 추정) · 매달 저축 · 투자, 공동 몫 나누는 방식, 모은 자산.

type Salary = ReturnType<typeof calculateSalary>;

export function SettingsBoard({
  state,
  salary,
  onPerson,
  onState,
  children,
}: {
  state: AppState;
  salary: [Salary, Salary];
  onPerson: (index: 0 | 1, patch: Partial<Person>) => void;
  onState: (patch: Partial<AppState>) => void;
  children?: React.ReactNode;
}) {
  const [openBreakdown, setOpenBreakdown] = useState<0 | 1 | null>(null);

  return (
    <div className="content">
      {state.people.map((person, index) => {
        const calc = salary[index];
        const i = index as 0 | 1;
        return (
          <section key={index} className={`card person-${index + 1}`}>
            <div className="person-title">
              <span>{(person.name || (index === 0 ? "남편" : "아내")).slice(0, 1)}</span>
              <input aria-label={`${index + 1}번째 사람 이름`} value={person.name} onChange={(event) => onPerson(i, { name: event.target.value })} />
            </div>
            <MoneyField label="세전 연봉" example={person.annualGross === initialState.people[i].annualGross} value={person.annualGross} onChange={(annualGross) => onPerson(i, { annualGross })} />
            <MoneyField label="월 비과세 급여" hint="식대 등" example={person.monthlyNonTaxable === initialState.people[i].monthlyNonTaxable} value={person.monthlyNonTaxable} onChange={(monthlyNonTaxable) => onPerson(i, { monthlyNonTaxable })} />
            <div className="net-result">
              <span>{calc.isActual ? "급여명세서 실수령액" : "예상 월 실수령액 (추정)"}</span>
              <strong>{won(calc.net)}</strong>
            </div>
            <MoneyField label="실제 실수령액" hint="선택" value={person.actualNet} onChange={(actualNet) => onPerson(i, { actualNet })} />
            <button className="breakdown-button" onClick={() => setOpenBreakdown(openBreakdown === i ? null : i)}>
              공제 내역 {openBreakdown === i ? "접기 −" : "보기 +"}
            </button>
            {openBreakdown === i && (
              <div className="deductions">
                <p><span>국민연금</span><b>-{won(calc.pension)}</b></p>
                <p><span>건강보험</span><b>-{won(calc.health)}</b></p>
                <p><span>장기요양</span><b>-{won(calc.longTermCare)}</b></p>
                <p><span>고용보험</span><b>-{won(calc.employment)}</b></p>
                <p><span>소득세(추정)</span><b>-{won(calc.incomeTax)}</b></p>
                <p><span>지방소득세(추정)</span><b>-{won(calc.localIncomeTax)}</b></p>
              </div>
            )}
          </section>
        );
      })}

      <section className="card">
        <h3 className="card-title"><Users size={18} /> 둘이 함께</h3>
        <MoneyField label="지금까지 모은 자산" example={state.plan.currentAssets === initialState.plan.currentAssets} value={state.plan.currentAssets} onChange={(currentAssets) => onState({ plan: { ...state.plan, currentAssets } })} />
        <p className="muted small">저축 · 투자 · 생활비 같은 매달 돈은 「나누기」 탭의 바구니에 담아요.</p>
      </section>

      {children}
    </div>
  );
}
