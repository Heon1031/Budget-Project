"use client";

import { useState } from "react";
import { MoneyField, won } from "./fields";
import type { AppState, Person, calculateSalary } from "./lib/plan";

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
              <span>{index === 0 ? "A" : "B"}</span>
              <input aria-label={`${index + 1}번째 사람 이름`} value={person.name} onChange={(event) => onPerson(i, { name: event.target.value })} />
            </div>
            <MoneyField label="세전 연봉" value={person.annualGross} onChange={(annualGross) => onPerson(i, { annualGross })} />
            <MoneyField label="월 비과세 급여" hint="식대 등" value={person.monthlyNonTaxable} onChange={(monthlyNonTaxable) => onPerson(i, { monthlyNonTaxable })} />
            <div className="net-result">
              <span>{calc.isActual ? "급여명세서 실수령액" : "예상 월 실수령액 (추정)"}</span>
              <strong>{won(calc.net)}</strong>
            </div>
            <MoneyField label="실제 실수령액" hint="알면 넣어 주세요 · 더 정확해요" value={person.actualNet} onChange={(actualNet) => onPerson(i, { actualNet })} />
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
            <h4 className="sub-title">매달 먼저 떼는 돈</h4>
            <div className="form-grid">
              <MoneyField label="예금·적금" value={person.monthlyDeposit} onChange={(monthlyDeposit) => onPerson(i, { monthlyDeposit })} />
              <MoneyField label="비상금" value={person.monthlyEmergency} onChange={(monthlyEmergency) => onPerson(i, { monthlyEmergency })} />
              <MoneyField label="주식·펀드" value={person.monthlyInvest} onChange={(monthlyInvest) => onPerson(i, { monthlyInvest })} />
              <MoneyField label="연금·IRP" value={person.monthlyPension} onChange={(monthlyPension) => onPerson(i, { monthlyPension })} />
            </div>
          </section>
        );
      })}

      <section className="card">
        <h3 className="card-title">둘이 함께</h3>
        <MoneyField label="지금까지 모은 자산" hint="집 마련 계산에 써요" value={state.plan.currentAssets} onChange={(currentAssets) => onState({ plan: { ...state.plan, currentAssets } })} />
        <MoneyField label="매달 청약 저축" value={state.plan.housingSubscription} onChange={(housingSubscription) => onState({ plan: { ...state.plan, housingSubscription } })} />
        <div className="field">
          <span>공동 몫 나누는 방식 <small>공동 고정지출 · 집 목돈 · 청약</small></span>
          <div className="toggle-group wide" style={{ marginTop: 0 }}>
            <button className={state.shareRule === "income" ? "active" : ""} onClick={() => onState({ shareRule: "income" })}>월급 비율대로</button>
            <button className={state.shareRule === "half" ? "active" : ""} onClick={() => onState({ shareRule: "half" })}>반씩</button>
          </div>
        </div>
        <p className="muted small">실수령액은 2026년 4대보험 요율과 소득세 구간으로 계산한 추정이에요. 급여명세서 금액을 넣으면 그 값을 써요.</p>
      </section>

      {children}
    </div>
  );
}
