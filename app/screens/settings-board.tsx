"use client";

import { useState } from "react";
import { FileUp, Users } from "lucide-react";
import { MoneyField, won } from "./fields";
import { initialState, restoreState, type AppState, type Person, type calculateSalary } from "../lib/calc/plan";

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
  const [importNote, setImportNote] = useState<string | null>(null);

  // 계획 파일 불러오기: 폰 안에서만 읽는다(서버로 바로 보내지 않음). 바꾼 계획은 평소처럼 암호화돼 상대 폰과 맞춰진다.
  // 파일에 있는 칸만 바꾸고, 없는 칸(예: 아내 연봉)은 지금 값을 그대로 둔다.
  const importPlan = async (file: File) => {
    try {
      if (file.size > 200_000) throw new Error("파일이 너무 커요");
      const data = JSON.parse(await file.text()) as { duriPlan?: unknown; people?: unknown };
      if (data.duriPlan !== 1 || !Array.isArray(data.people) || data.people.length !== 2) throw new Error("둘이자산 계획 파일이 아니에요");
      const incoming = data.people as Partial<Person>[];
      if (!confirm("남편 · 아내의 월급과 바구니를 이 파일 내용으로 바꿀까요? 연결돼 있으면 상대 폰에도 바뀌어요.")) return;
      const people = restoreState({ people: state.people.map((current, index) => ({ ...current, ...incoming[index] })) }).people;
      onState({ people });
      setImportNote(`불러왔어요 · ${people.map((person) => `${person.name} 바구니 ${person.buckets.length}개`).join(" · ")}`);
    } catch (error) {
      setImportNote(`불러오지 못했어요: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    }
  };

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

      <section className="card import-card">
        <h3 className="card-title"><FileUp size={18} /> 계획 파일 불러오기</h3>
        <p className="muted small">메모에서 옮긴 계획 파일(.json)로 월급 · 바구니 · 항목을 한 번에 채워요. 파일은 이 폰 안에서만 읽어요.</p>
        <label className="add-button import-button">
          <FileUp size={16} /> 파일 고르기
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void importPlan(file);
            }}
          />
        </label>
        {importNote && <p className="muted small" role="status">{importNote}</p>}
      </section>

      {children}
    </div>
  );
}
