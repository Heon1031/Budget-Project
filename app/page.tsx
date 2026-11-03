"use client";

import { useEffect, useMemo, useState } from "react";
import { ConnectPanel } from "./connect-panel";
import { MoneyField, RateInput, manwon, parseWon, signedWon, won } from "./fields";
import { forgetCache, useSharedRecords } from "./lib/sync";
import { clearVault, loadVault, type Vault } from "./lib/vault";
import { HousingBoard } from "./housing-board";
import { calculateHouse, daysUntil, defaultMoveDate, initialHouse, type HousePlan } from "./lib/housing";
import { MonthBoard, type PromiseAmounts } from "./month-board";

type Person = {
  name: string;
  annualGross: number;
  monthlyNonTaxable: number;
  actualNet: number;
  monthlyDeposit: number;
  monthlyInvest: number;
  monthlyPension: number;
  monthlyEmergency: number;
  foodRate: number;
  cultureRate: number;
  travelRate: number;
  cashRate: number;
};

type Plan = {
  currentAssets: number;
  jeonseLoan: number;
  mortgageLoan: number;
  monthlyRent: number;
  otherLoan: number;
  housingSubscription: number;
  electricity: number;
  gas: number;
  water: number;
  telecom: number;
  managementFee: number;
};

type AppState = {
  people: [Person, Person];
  plan: Plan;
  marriageRegistered: boolean;
  house: HousePlan;
};

const STORAGE_KEY = "duri-asset-plan-v4";
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
      monthlyDeposit: 700_000,
      monthlyInvest: 400_000,
      monthlyPension: 150_000,
      monthlyEmergency: 100_000,
      foodRate: 15,
      cultureRate: 5,
      travelRate: 5,
      cashRate: 10,
    },
    {
      name: "배우자",
      annualGross: 40_000_000,
      monthlyNonTaxable: 200_000,
      actualNet: 0,
      monthlyDeposit: 500_000,
      monthlyInvest: 300_000,
      monthlyPension: 120_000,
      monthlyEmergency: 80_000,
      foodRate: 15,
      cultureRate: 5,
      travelRate: 5,
      cashRate: 10,
    },
  ],
  plan: {
    currentAssets: 30_000_000,
    jeonseLoan: 500_000,
    mortgageLoan: 0,
    monthlyRent: 0,
    otherLoan: 0,
    housingSubscription: 250_000,
    electricity: 60_000,
    gas: 50_000,
    water: 25_000,
    telecom: 70_000,
    managementFee: 150_000,
  },
  marriageRegistered: false,
  house: initialHouse,
};

// 저장된 값에서 기본값과 같은 종류인 항목만 가져온다. 새 항목이 생겨도 예전 저장값이 깨지지 않는다.
function mergeDefaults<T extends Record<string, unknown>>(defaults: T, source: unknown): T {
  const input = source && typeof source === "object" ? (source as Record<string, unknown>) : {};
  const merged = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T & string)[]) {
    const value = input[key];
    if (typeof value !== typeof defaults[key]) continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    merged[key] = value as T[typeof key];
  }
  return merged;
}

function restoreState(saved: unknown): AppState {
  const data = saved && typeof saved === "object" ? (saved as Partial<AppState>) : {};
  const people = Array.isArray(data.people) ? data.people : [];
  return {
    people: [
      mergeDefaults(initialState.people[0], people[0]),
      mergeDefaults(initialState.people[1], people[1]),
    ],
    plan: mergeDefaults(initialState.plan, data.plan),
    house: mergeDefaults(initialHouse, data.house),
    marriageRegistered:
      typeof data.marriageRegistered === "boolean" ? data.marriageRegistered : initialState.marriageRegistered,
  };
}

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

function AllocationField({
  label,
  rate,
  net,
  onChange,
  guide,
}: {
  label: string;
  rate: number;
  net: number;
  onChange: (value: number) => void;
  guide: string;
}) {
  const safeRate = Number.isFinite(rate) ? rate : 0;
  const amount = net * (safeRate / 100);
  return (
    <div className="rate-field">
      <span><strong>{label}</strong><small>{guide}</small></span>
      <div className="dual-inputs">
        <label>
          <span>금액</span>
          <div><input inputMode="numeric" value={Math.round(amount).toLocaleString("ko-KR")} onChange={(event) => onChange(net > 0 ? Math.min(100, (parseWon(event.target.value) / net) * 100) : 0)} /><b>원</b></div>
        </label>
        <label>
          <span>비율</span>
          <div><RateInput value={safeRate} onChange={(value) => onChange(Math.min(100, Math.max(0, value)))} /><b>%</b></div>
        </label>
      </div>
    </div>
  );
}

export default function Home() {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [openBreakdown, setOpenBreakdown] = useState<0 | 1 | null>(null);
  const [openInvestment, setOpenInvestment] = useState<0 | 1 | null>(0);
  const [vault, setVault] = useState<Vault | null>(null);
  const [tab, setTab] = useState<"month" | "house" | "plan" | "connect">("plan");
  const shared = useSharedRecords(vault);
  const { write: writeShared, loaded: sharedLoaded, pulled: sharedPulled } = shared;
  // 서버와 마지막으로 맞춘 계획(JSON). 같은 내용을 다시 보내거나, 보낸 걸 다시 덮어쓰지 않으려고 둔다.
  const [syncedPlanJson, setSyncedPlanJson] = useState("");
  const [seenRemotePlan, setSeenRemotePlan] = useState<unknown>(undefined);

  useEffect(() => {
    void loadVault().then((stored) => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setState(restoreState(JSON.parse(saved)));
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
      if (stored) {
        setVault(stored);
        setTab("month");
      }
      setHydrated(true);
    });
  }, []);

  // 연결 전에는 이 폰에만 저장한다. 연결 뒤에는 암호화된 기록만 남기고 평문 저장본은 지운다.
  useEffect(() => {
    if (!hydrated) return;
    if (vault) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated, vault]);

  const remotePlan = shared.records.get("plan");
  if (remotePlan !== seenRemotePlan) {
    setSeenRemotePlan(remotePlan);
    const json = remotePlan ? JSON.stringify(remotePlan) : "";
    if (remotePlan && json !== syncedPlanJson) {
      setSyncedPlanJson(json);
      setState(restoreState(remotePlan));
    }
  }

  // 처음 연결한 폰은 서버 계획을 먼저 받아 본 뒤에야 내 계획을 보낸다(상대 계획을 덮어쓰지 않게).
  const canSendPlan = Boolean(vault) && sharedLoaded && (sharedPulled || remotePlan !== undefined);
  useEffect(() => {
    if (!canSendPlan) return;
    const json = JSON.stringify(state);
    if (json === syncedPlanJson) return;
    const timer = setTimeout(() => {
      setSyncedPlanJson(json);
      void writeShared("plan", state);
    }, 800);
    return () => clearTimeout(timer);
  }, [canSendPlan, state, syncedPlanJson, writeShared]);

  const disconnect = async () => {
    if (vault) forgetCache(vault.householdId);
    await clearVault();
    setVault(null);
    setSyncedPlanJson("");
    setState(initialState);
    setTab("plan");
  };

  const salary = useMemo(
    () => state.people.map(calculateSalary) as [ReturnType<typeof calculateSalary>, ReturnType<typeof calculateSalary>],
    [state.people],
  );

  const result = useMemo(() => {
    const totalNet = salary[0].net + salary[1].net;
    const shares: [number, number] = totalNet > 0
      ? [salary[0].net / totalNet, salary[1].net / totalNet]
      : [0.5, 0.5];
    const personal = state.people.map((person, index) => {
      const net = salary[index].net;
      const investment =
        person.monthlyDeposit +
        person.monthlyInvest +
        person.monthlyPension +
        person.monthlyEmergency;
      const investmentRate = net > 0 ? (investment / net) * 100 : 0;
      const food = net * (person.foodRate / 100);
      const culture = net * (person.cultureRate / 100);
      const travel = net * (person.travelRate / 100);
      const cash = net * (person.cashRate / 100);
      const total = investment + food + culture + travel + cash;
      return { investment, investmentRate, food, culture, travel, cash, total, remaining: net - total };
    }) as [
      { investment: number; investmentRate: number; food: number; culture: number; travel: number; cash: number; total: number; remaining: number },
      { investment: number; investmentRate: number; food: number; culture: number; travel: number; cash: number; total: number; remaining: number },
    ];
    const housingOutflow =
      state.plan.jeonseLoan +
      state.plan.mortgageLoan +
      state.plan.monthlyRent +
      state.plan.otherLoan +
      state.plan.housingSubscription +
      state.plan.electricity +
      state.plan.gas +
      state.plan.water +
      state.plan.telecom +
      state.plan.managementFee;
    const monthlyAssetContribution =
      personal[0].investment +
      personal[1].investment +
      state.plan.housingSubscription;
    const housingExpense = housingOutflow - state.plan.housingSubscription;
    const monthlySpending =
      personal[0].food +
      personal[0].culture +
      personal[0].travel +
      personal[0].cash +
      personal[1].food +
      personal[1].culture +
      personal[1].travel +
      personal[1].cash +
      housingExpense;
    const householdRemaining = totalNet - monthlyAssetContribution - monthlySpending;
    const projection = [1, 3, 5, 10].map((years) => {
      const months = years * 12;
      return {
        years,
        amount: state.plan.currentAssets + monthlyAssetContribution * months,
      };
    });
    return {
      totalNet,
      shares,
      personal,
      housingOutflow,
      housingExpense,
      monthlyAssetContribution,
      monthlySpending,
      householdRemaining,
      projection,
    };
  }, [salary, state.plan, state.people]);

  // 「계획」 탭 숫자를 이번 달 약속 칸으로 옮긴 값.
  const suggestion = useMemo<PromiseAmounts>(() => {
    const [a, b] = state.people;
    return {
      saving: Math.round(a.monthlyDeposit + a.monthlyEmergency + b.monthlyDeposit + b.monthlyEmergency + state.plan.housingSubscription),
      house: Math.round(state.house.monthlySaving),
      invest: Math.round(a.monthlyInvest + a.monthlyPension + b.monthlyInvest + b.monthlyPension),
      fixed: Math.round(result.housingExpense),
      living: Math.round(
        result.personal[0].food + result.personal[0].culture + result.personal[0].travel +
        result.personal[1].food + result.personal[1].culture + result.personal[1].travel,
      ),
      allowance: [Math.round(result.personal[0].cash), Math.round(result.personal[1].cash)],
      threshold: 100_000,
    };
  }, [result, state.people, state.plan.housingSubscription, state.house.monthlySaving]);
  const moveDate = state.house.moveDate || defaultMoveDate();
  const houseCalc = calculateHouse(state.house, state.people[0].annualGross + state.people[1].annualGross, state.plan.currentAssets, moveDate);
  const houseDaysLeft = daysUntil(moveDate);
  const names: [string, string] = [state.people[0].name || "A", state.people[1].name || "B"];

  const updatePerson = (index: 0 | 1, patch: Partial<Person>) => {
    setState((current) => {
      const people = [...current.people] as [Person, Person];
      people[index] = { ...people[index], ...patch };
      return { ...current, people };
    });
  };

  const updatePlan = (patch: Partial<Plan>) =>
    setState((current) => ({ ...current, plan: { ...current.plan, ...patch } }));

  const updateInvestmentRate = (index: 0 | 1, rate: number) => {
    const person = state.people[index];
    const target = salary[index].net * (Math.min(100, Math.max(0, rate)) / 100);
    const current =
      person.monthlyDeposit +
      person.monthlyInvest +
      person.monthlyPension +
      person.monthlyEmergency;
    if (current <= 0) {
      updatePerson(index, { monthlyDeposit: Math.round(target) });
      return;
    }
    const scale = target / current;
    updatePerson(index, {
      monthlyDeposit: Math.round(person.monthlyDeposit * scale),
      monthlyInvest: Math.round(person.monthlyInvest * scale),
      monthlyPension: Math.round(person.monthlyPension * scale),
      monthlyEmergency: Math.round(person.monthlyEmergency * scale),
    });
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-mark">둘</span><span>둘이자산</span></a>
        <span className="save-dot">{vault ? "● 둘이 함께 저장 · 암호화" : "● 이 폰에만 저장"}</span>
        {tab === "plan" && (
          <button onClick={() => {
            if (confirm(vault ? "계획을 예시값으로 바꿀까요? 상대 폰의 계획도 함께 바뀌어요." : "계획을 예시값으로 바꿀까요?")) setState(initialState);
          }}>예시값으로 초기화</button>
        )}
      </header>

      {tab === "month" && (
        <div className="layout">
          {vault && sharedLoaded ? (
            <MonthBoard
              records={shared.records}
              write={writeShared}
              me={vault.me}
              names={names}
              suggestion={suggestion}
              totalNet={result.totalNet}
              house={{ daysLeft: houseDaysLeft, have: houseCalc.willHave, need: houseCalc.needCash }}
              onOpenHouse={() => setTab("house")}
            />
          ) : vault ? (
            <section className="card"><p className="muted">기록을 여는 중…</p></section>
          ) : (
            <section className="card connect-card">
              <h2>먼저 두 폰을 연결해요</h2>
              <p className="muted">이번 달 약속과 생활비 기록은 둘이 함께 봐야 해서, 연결한 뒤에 쓸 수 있어요.</p>
              <button className="primary" onClick={() => setTab("connect")}>연결하러 가기</button>
            </section>
          )}
        </div>
      )}

      {tab === "house" && (
        <div className="layout">
          <HousingBoard
            house={state.house}
            moveDate={moveDate}
            onChange={(patch) => setState((current) => ({ ...current, house: { ...current.house, ...patch } }))}
            annualIncome={state.people[0].annualGross + state.people[1].annualGross}
            currentAssets={state.plan.currentAssets}
            monthlyNet={result.totalNet}
            unassigned={result.householdRemaining}
          />
        </div>
      )}

      {tab === "connect" && (
        <div className="layout">
          <ConnectPanel
            vault={vault}
            names={names}
            status={shared.status}
            error={shared.error}
            pendingCount={shared.pendingCount}
            onConnected={(connected) => {
              setVault(connected);
              setTab("month");
            }}
            onDisconnect={() => void disconnect()}
            onSync={() => void shared.syncNow()}
          />
        </div>
      )}

      {tab === "plan" && (
      <div className="layout" id="top">
        <div className="content">
          <section className="card">
            <div className="title-row">
              <div><span className="step">01</span><div><h2>우리 둘의 월급과 예산</h2><p>왼쪽은 나, 오른쪽은 배우자가 각자 입력해요</p></div></div>
              <span className="official-badge">공식 요율 반영</span>
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
                    <div className="personal-divider"><span>실수령액 100% 나누기</span></div>
                    <div className="rate-list">
                      <div className="investment-group">
                        <div className="investment-toggle">
                          <button onClick={() => setOpenInvestment(openInvestment === index ? null : index as 0 | 1)}>
                            <strong>투자·적금</strong><small>권장 30~40% · {openInvestment === index ? "접기 −" : "세부 입력 +"}</small>
                          </button>
                          <label>
                            <span>합계 비율</span>
                            <div><RateInput value={result.personal[index].investmentRate} onChange={(rate) => updateInvestmentRate(index as 0 | 1, rate)} /><b>%</b></div>
                          </label>
                          <p>{won(result.personal[index].investment)}</p>
                        </div>
                        {openInvestment === index && (
                          <div className="investment-details">
                            <MoneyField label="예금·적금" value={person.monthlyDeposit} onChange={(monthlyDeposit) => updatePerson(index as 0 | 1, { monthlyDeposit })} />
                            <MoneyField label="주식·펀드" value={person.monthlyInvest} onChange={(monthlyInvest) => updatePerson(index as 0 | 1, { monthlyInvest })} />
                            <MoneyField label="연금·IRP" value={person.monthlyPension} onChange={(monthlyPension) => updatePerson(index as 0 | 1, { monthlyPension })} />
                            <MoneyField label="비상금" value={person.monthlyEmergency} onChange={(monthlyEmergency) => updatePerson(index as 0 | 1, { monthlyEmergency })} />
                          </div>
                        )}
                      </div>
                      <AllocationField
                        label="식생활비"
                        guide="권장 10~15%"
                        rate={person.foodRate}
                        net={calc.net}
                        onChange={(foodRate) => updatePerson(index as 0 | 1, { foodRate })}
                      />
                      <AllocationField
                        label="문화·레저"
                        guide="권장 5~10%"
                        rate={person.cultureRate}
                        net={calc.net}
                        onChange={(cultureRate) => updatePerson(index as 0 | 1, { cultureRate })}
                      />
                      <AllocationField
                        label="여행 적립"
                        guide="권장 5%"
                        rate={person.travelRate}
                        net={calc.net}
                        onChange={(travelRate) => updatePerson(index as 0 | 1, { travelRate })}
                      />
                      <AllocationField
                        label="현금·용돈"
                        guide="권장 10%"
                        rate={person.cashRate}
                        net={calc.net}
                        onChange={(cashRate) => updatePerson(index as 0 | 1, { cashRate })}
                      />
                    </div>
                    <div className={`allocation-total ${result.personal[index].remaining < 0 ? "over" : ""}`}>
                      <span>정한 비율</span>
                      <strong>{Math.round(result.personal[index].investmentRate + person.foodRate + person.cultureRate + person.travelRate + person.cashRate)}%</strong>
                      <small>{result.personal[index].remaining < 0 ? `실수령액보다 ${won(Math.abs(result.personal[index].remaining))} 많아요. 비율을 줄여주세요.` : `남은 금액 ${won(result.personal[index].remaining)} · 공동 주거비에 쓰거나 추가 저축할 수 있어요`}</small>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="couple-totals">
              <div><span>둘의 월 실수령 합계</span><strong>{won(result.totalNet)}</strong></div>
              <div><span>1번에서 계획한 합계</span><strong>{won(result.personal[0].total + result.personal[1].total)}</strong></div>
              <div className={(result.personal[0].remaining + result.personal[1].remaining) < 0 ? "negative" : ""}><span>1번 후 남은 합계</span><strong>{signedWon(result.personal[0].remaining + result.personal[1].remaining)}</strong></div>
            </div>
          </section>

          <section className="card">
            <div className="title-row">
              <div><span className="step">02</span><div><h2>둘이 함께 내는 주거비</h2><p>집과 대출에 들어가는 공통 금액을 한곳에 모아요</p></div></div>
            </div>
            <div className="housing-grid">
              <MoneyField label="현재 함께 모은 자산" value={state.plan.currentAssets} onChange={(currentAssets) => updatePlan({ currentAssets })} />
              <MoneyField label="월 전세대출 상환" value={state.plan.jeonseLoan} onChange={(jeonseLoan) => updatePlan({ jeonseLoan })} />
              <MoneyField label="월 주택대출 상환" value={state.plan.mortgageLoan} onChange={(mortgageLoan) => updatePlan({ mortgageLoan })} />
              <MoneyField label="월세" value={state.plan.monthlyRent} onChange={(monthlyRent) => updatePlan({ monthlyRent })} />
              <MoneyField label="기타 대출 상환" value={state.plan.otherLoan} onChange={(otherLoan) => updatePlan({ otherLoan })} />
              <MoneyField label="월 청약 저축" value={state.plan.housingSubscription} onChange={(housingSubscription) => updatePlan({ housingSubscription })} />
              <MoneyField label="전기요금" value={state.plan.electricity} onChange={(electricity) => updatePlan({ electricity })} />
              <MoneyField label="가스·난방비" value={state.plan.gas} onChange={(gas) => updatePlan({ gas })} />
              <MoneyField label="수도요금" value={state.plan.water} onChange={(water) => updatePlan({ water })} />
              <MoneyField label="인터넷·공용 통신" value={state.plan.telecom} onChange={(telecom) => updatePlan({ telecom })} />
              <MoneyField label="관리비" value={state.plan.managementFee} onChange={(managementFee) => updatePlan({ managementFee })} />
            </div>
            <div className="housing-summary">
              <div><span>매달 공통 주거 관련</span><strong>{won(result.housingOutflow)}</strong></div>
              <div><span>소득 비중으로 나누면</span><p>{state.people[0].name} {won(result.housingOutflow * result.shares[0])}<br />{state.people[1].name} {won(result.housingOutflow * result.shares[1])}</p></div>
            </div>
            <div className="projection">
              <div className="projection-head">
                <div><strong>이 속도로 모으면</strong><span>수익률을 가정하지 않고 현재 자산 + 매달 투자·적금·청약만 계산</span></div>
                <b>월 {won(result.monthlyAssetContribution)} 적립</b>
              </div>
              <div className="projection-grid">
                {result.projection.map((item) => (
                  <div key={item.years}><span>{item.years}년 뒤</span><strong>{manwon(item.amount)}</strong></div>
                ))}
              </div>
            </div>
          </section>

          <section className="marriage-note deferred">
            <div>
              <strong>혼인신고 안내는 계산 뒤에서 참고</strong>
              <p>4대보험 요율은 같고, 배우자 공제·혼인세액공제 등 연말정산 항목에서 차이가 생길 수 있어요.</p>
            </div>
            <div className="toggle-group">
              <button className={!state.marriageRegistered ? "active" : ""} onClick={() => setState((v) => ({ ...v, marriageRegistered: false }))}>혼인신고 전</button>
              <button className={state.marriageRegistered ? "active" : ""} onClick={() => setState((v) => ({ ...v, marriageRegistered: true }))}>혼인신고 완료</button>
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
          <h2>우리 돈의 현재 흐름</h2>

          <div className="big-result">
            <span>합산 월 실수령액</span>
            <strong>{won(result.totalNet)}</strong>
          </div>

          <div className="flow">
            <p><span>투자·적금·청약</span><b>{won(result.monthlyAssetContribution)}</b></p>
            <p><span>식생활·문화·여행·용돈</span><b>-{won(result.monthlySpending - result.housingExpense)}</b></p>
            <p><span>공통 주거·대출</span><b>-{won(result.housingExpense)}</b></p>
          </div>

          <div className="investment">
            <span>아직 정하지 않은 월 금액</span>
            <strong>{signedWon(result.householdRemaining)}</strong>
            <small>용돈·교육비·추가 투자 등 다음 단계에서 나눌 수 있는 금액</small>
          </div>

          <div className="contributions">
            <span>각자의 실수령액 100% 계획</span>
            {[0, 1].map((index) => (
              <p key={index}>
                <span>{state.people[index].name} <small>{Math.round(result.personal[index].investmentRate + state.people[index].foodRate + state.people[index].cultureRate + state.people[index].travelRate + state.people[index].cashRate)}% 계획</small></span>
                <b className={result.personal[index].remaining < 0 ? "negative" : ""}>
                  {result.personal[index].remaining < 0
                    ? `${won(-result.personal[index].remaining)} 부족`
                    : `${won(result.personal[index].remaining)} 남음`}
                </b>
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
      )}

      <footer>
        <span>둘이자산 · 신혼부부 자산형성 플래너</span>
        <p>본 결과는 참고용 추정이며 급여명세서·연말정산·금융상담을 대체하지 않습니다.</p>
      </footer>

      <nav className="tabbar" aria-label="화면 바꾸기">
        <button className={tab === "month" ? "active" : ""} onClick={() => setTab("month")}><span>✓</span>이번 달</button>
        <button className={tab === "house" ? "active" : ""} onClick={() => setTab("house")}><span>⌂</span>집 마련</button>
        <button className={tab === "plan" ? "active" : ""} onClick={() => setTab("plan")}><span>₩</span>계획</button>
        <button className={tab === "connect" ? "active" : ""} onClick={() => setTab("connect")}><span>⇄</span>연결</button>
      </nav>
    </main>
  );
}
