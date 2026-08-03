"use client";

import { useEffect, useMemo, useState } from "react";

type Person = {
  name: string;
  annualGross: number;
  monthlyNet: number;
};

type SplitMode = "income" | "equal" | "custom";

type Category = {
  id: string;
  label: string;
  description: string;
  rate: number;
  current: number;
  tone: string;
};

type BudgetState = {
  people: [Person, Person];
  splitMode: SplitMode;
  customShare: number;
  categories: Category[];
};

const STORAGE_KEY = "duri-budget-v1";
const ESTIMATED_NET_RATE = 0.82;

const defaultCategories: Category[] = [
  { id: "housing", label: "주거비", description: "월세·대출·관리비", rate: 25, current: 0, tone: "#397b72" },
  { id: "food", label: "식비·생활비", description: "장보기·외식·생필품", rate: 12, current: 0, tone: "#d68c5b" },
  { id: "transport", label: "교통·차량", description: "대중교통·유류·차량 유지", rate: 8, current: 0, tone: "#6d7fb5" },
  { id: "insurance", label: "보험·의료", description: "보장성 보험·진료·약", rate: 7, current: 0, tone: "#9a78a8" },
  { id: "utilities", label: "공과금", description: "전기·가스·수도", rate: 4, current: 0, tone: "#d1a743" },
  { id: "telecom", label: "통신·구독", description: "휴대폰·인터넷·공용 구독", rate: 3, current: 0, tone: "#588dac" },
  { id: "leisure", label: "여가·데이트", description: "함께 쓰는 취미·문화생활", rate: 7, current: 0, tone: "#c47272" },
  { id: "irregular", label: "비정기 적립", description: "여행·경조사·명절", rate: 5, current: 0, tone: "#75966a" },
  { id: "buffer", label: "기타·완충", description: "예상 밖의 작은 지출", rate: 4, current: 0, tone: "#8e8a80" },
];

const sampleState: BudgetState = {
  people: [
    { name: "나", annualGross: 52000000, monthlyNet: 3500000 },
    { name: "배우자", annualGross: 40000000, monthlyNet: 2800000 },
  ],
  splitMode: "income",
  customShare: 56,
  categories: defaultCategories,
};

const emptyState: BudgetState = {
  people: [
    { name: "나", annualGross: 0, monthlyNet: 0 },
    { name: "배우자", annualGross: 0, monthlyNet: 0 },
  ],
  splitMode: "income",
  customShare: 50,
  categories: defaultCategories,
};

const won = (value: number) =>
  `${Math.max(0, Math.round(value)).toLocaleString("ko-KR")}원`;

const compactWon = (value: number) => {
  if (value >= 10000) return `${Math.round(value / 10000).toLocaleString("ko-KR")}만원`;
  return won(value);
};

const parseAmount = (value: string) =>
  Number(value.replace(/[^\d]/g, "")) || 0;

function resolveMonthlyIncome(person: Person) {
  if (person.monthlyNet > 0) return person.monthlyNet;
  return Math.round((person.annualGross / 12) * ESTIMATED_NET_RATE);
}

export default function Home() {
  const [state, setState] = useState<BudgetState>(sampleState);
  const [hydrated, setHydrated] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setState(JSON.parse(saved) as BudgetState);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const result = useMemo(() => {
    const incomes = state.people.map(resolveMonthlyIncome) as [number, number];
    const totalIncome = incomes[0] + incomes[1];
    let shareA = 0.5;
    if (state.splitMode === "income" && totalIncome > 0) shareA = incomes[0] / totalIncome;
    if (state.splitMode === "custom") shareA = state.customShare / 100;

    const livingRate = state.categories.reduce((sum, item) => sum + item.rate, 0) / 100;
    const livingBudget = Math.round(totalIncome * livingRate);
    const savingsTarget = Math.max(0, totalIncome - livingBudget);
    const contributionA = Math.round(livingBudget * shareA);
    const contributionB = livingBudget - contributionA;
    const currentTotal = state.categories.reduce((sum, item) => sum + item.current, 0);
    const currentEntered = state.categories.some((item) => item.current > 0);
    const overspend = Math.max(0, currentTotal - livingBudget);
    const remaining = totalIncome - currentTotal - savingsTarget;
    return {
      incomes,
      totalIncome,
      shareA,
      shareB: 1 - shareA,
      livingRate,
      livingBudget,
      savingsTarget,
      contributionA,
      contributionB,
      currentTotal,
      currentEntered,
      overspend,
      remaining,
    };
  }, [state]);

  const updatePerson = (index: 0 | 1, patch: Partial<Person>) => {
    setState((current) => {
      const people = [...current.people] as [Person, Person];
      people[index] = { ...people[index], ...patch };
      return { ...current, people };
    });
  };

  const updateCategoryCurrent = (id: string, current: number) => {
    setState((value) => ({
      ...value,
      categories: value.categories.map((item) =>
        item.id === id ? { ...item, current } : item,
      ),
    }));
  };

  const reset = () => {
    setState(emptyState);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const topSavings = state.categories
    .map((item) => {
      const target = result.totalIncome * (item.rate / 100);
      return { ...item, target, gap: Math.max(0, item.current - target) };
    })
    .filter((item) => item.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="둘이살림 처음으로">
          <span className="brand-mark">둘</span>
          <span>둘이살림</span>
        </a>
        <div className="save-status" aria-live="polite">
          <span className="status-dot" />
          이 기기에 자동 저장
        </div>
        <button className="text-button" onClick={reset}>입력 초기화</button>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow">COUPLE BUDGET PLANNER</div>
        <h1>둘의 소득에 맞춰,<br /><em>공평하게 나누는 생활비</em></h1>
        <p>실수령액과 분담 방식을 입력하면 매달 함께 쓸 금액, 각자 낼 금액, 저축 목표를 한눈에 계산해요.</p>
        <div className="privacy-note">🔒 입력한 금액은 서버로 전송되지 않고 이 브라우저에만 저장돼요.</div>
      </section>

      <div className="page-grid">
        <div className="main-column">
          <section className="card income-card">
            <div className="section-heading">
              <div><span className="step">01</span><h2>우리 소득 입력</h2></div>
              <span className="badge neutral">예시 금액</span>
            </div>
            <p className="section-copy">월 실수령액을 알고 있다면 꼭 입력해 주세요. 더 현실적인 예산이 됩니다.</p>
            <div className="people-grid">
              {state.people.map((person, index) => (
                <fieldset className={`person person-${index + 1}`} key={index}>
                  <legend>
                    <span className="person-chip">{index === 0 ? "A" : "B"}</span>
                    <input
                      className="name-input"
                      aria-label={`${index + 1}번째 사람 이름`}
                      value={person.name}
                      onChange={(event) => updatePerson(index as 0 | 1, { name: event.target.value })}
                    />
                  </legend>
                  <label>
                    <span>세전 연봉</span>
                    <div className="money-input">
                      <input
                        inputMode="numeric"
                        aria-label={`${person.name} 세전 연봉`}
                        value={person.annualGross ? person.annualGross.toLocaleString("ko-KR") : ""}
                        placeholder="50,000,000"
                        onChange={(event) => updatePerson(index as 0 | 1, { annualGross: parseAmount(event.target.value) })}
                      />
                      <span>원</span>
                    </div>
                  </label>
                  <label>
                    <span>월 실수령액 <small>권장</small></span>
                    <div className="money-input">
                      <input
                        inputMode="numeric"
                        aria-label={`${person.name} 월 실수령액`}
                        value={person.monthlyNet ? person.monthlyNet.toLocaleString("ko-KR") : ""}
                        placeholder="급여명세서 기준"
                        onChange={(event) => updatePerson(index as 0 | 1, { monthlyNet: parseAmount(event.target.value) })}
                      />
                      <span>원</span>
                    </div>
                  </label>
                  {!person.monthlyNet && person.annualGross > 0 && (
                    <p className="estimate">참고 추정: 월 {won(resolveMonthlyIncome(person))}</p>
                  )}
                </fieldset>
              ))}
            </div>
            <p className="fine-print">실수령액 미입력 시 연봉의 82%를 12개월로 나눈 참고값을 사용합니다. 세금·4대보험·비과세·부양가족에 따라 실제 금액과 다를 수 있어요.</p>
          </section>

          <section className="card">
            <div className="section-heading">
              <div><span className="step">02</span><h2>공동비용 분담 방식</h2></div>
            </div>
            <div className="segment" role="group" aria-label="분담 방식">
              {([
                ["income", "소득 비례", "추천"],
                ["equal", "반반", ""],
                ["custom", "직접 설정", ""],
              ] as const).map(([value, label, tag]) => (
                <button
                  key={value}
                  className={state.splitMode === value ? "active" : ""}
                  onClick={() => setState((current) => ({ ...current, splitMode: value }))}
                >
                  {label} {tag && <small>{tag}</small>}
                </button>
              ))}
            </div>
            {state.splitMode === "custom" && (
              <div className="ratio-control">
                <div className="ratio-labels">
                  <strong>{state.people[0].name} {state.customShare}%</strong>
                  <strong>{state.people[1].name} {100 - state.customShare}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={state.customShare}
                  aria-label={`${state.people[0].name} 부담 비율`}
                  onChange={(event) => setState((current) => ({ ...current, customShare: Number(event.target.value) }))}
                />
              </div>
            )}
            <div className="ratio-summary">
              <div>
                <span className="avatar a">A</span>
                <p>{state.people[0].name}<strong>{Math.round(result.shareA * 100)}%</strong></p>
              </div>
              <div className="ratio-bar" aria-label={`분담 비율 ${Math.round(result.shareA * 100)} 대 ${Math.round(result.shareB * 100)}`}>
                <span style={{ width: `${result.shareA * 100}%` }} />
              </div>
              <div className="right">
                <p>{state.people[1].name}<strong>{Math.round(result.shareB * 100)}%</strong></p>
                <span className="avatar b">B</span>
              </div>
            </div>
            <p className="helper">
              {state.splitMode === "income" && "월 실수령액 차이를 반영해 부담해요."}
              {state.splitMode === "equal" && "소득과 관계없이 같은 금액을 부담해요."}
              {state.splitMode === "custom" && "두 분이 합의한 비율로 직접 나눠요."}
            </p>
          </section>

          <section className="card budget-card">
            <div className="section-heading">
              <div><span className="step">03</span><h2>카테고리별 권장 예산</h2></div>
              <span className="badge">합산 실수령 기준</span>
            </div>
            <div className="category-list">
              {state.categories.map((item) => {
                const budget = Math.round(result.totalIncome * (item.rate / 100));
                return (
                  <div className="category-row" key={item.id}>
                    <div className="category-icon" style={{ background: `${item.tone}20`, color: item.tone }}>
                      {item.label.slice(0, 1)}
                    </div>
                    <div className="category-main">
                      <div className="category-title">
                        <div><strong>{item.label}</strong><span>{item.description}</span></div>
                        <div className="category-amount"><strong>{won(budget)}</strong><span>소득의 {item.rate}%</span></div>
                      </div>
                      <div className="category-bar"><span style={{ width: `${Math.min(100, (item.rate / 30) * 100)}%`, background: item.tone }} /></div>
                      <div className="split-detail">
                        <span>{state.people[0].name} {won(budget * result.shareA)}</span>
                        <span>{state.people[1].name} {won(budget * result.shareB)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="guide-note">
              <strong>이 비율은 어디서 왔나요?</strong>
              자녀가 없는 맞벌이 가구가 시작하기 쉬운 예산 휴리스틱이에요. 실제 고정비와 목표에 맞게 조정해야 하며 공식 금융 기준은 아닙니다.
            </div>
          </section>

          <section className="card compare-card">
            <button className="accordion-button" onClick={() => setShowCurrent((value) => !value)} aria-expanded={showCurrent}>
              <span><span className="step">04</span><strong>현재 지출도 비교하기</strong><small>선택</small></span>
              <span>{showCurrent ? "접기 −" : "열기 +"}</span>
            </button>
            {showCurrent && (
              <div className="current-grid">
                <p>최근 한 달 지출을 입력하면 어디서 얼마나 줄일지 계산해요.</p>
                {state.categories.map((item) => {
                  const target = result.totalIncome * (item.rate / 100);
                  const over = item.current > target;
                  return (
                    <label key={item.id}>
                      <span>{item.label}{over && <small className="over">권장 초과</small>}</span>
                      <div className="money-input compact">
                        <input
                          inputMode="numeric"
                          value={item.current ? item.current.toLocaleString("ko-KR") : ""}
                          placeholder={won(target).replace("원", "")}
                          onChange={(event) => updateCategoryCurrent(item.id, parseAmount(event.target.value))}
                        />
                        <span>원</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="side-column" aria-live="polite">
          <section className="summary-card">
            <span className="summary-kicker">THIS MONTH</span>
            <h2>이번 달 우리 계획</h2>
            <div className="income-total">
              <span>합산 월 가용소득</span>
              <strong>{won(result.totalIncome)}</strong>
            </div>
            <div className="summary-split">
              <div><span>권장 공동생활비</span><strong>{won(result.livingBudget)}</strong><small>소득의 {Math.round(result.livingRate * 100)}%</small></div>
              <div className="savings"><span>권장 저축 목표</span><strong>{won(result.savingsTarget)}</strong><small>소득의 {Math.round((1 - result.livingRate) * 100)}%</small></div>
            </div>
            <div className="transfer-title">매달 공동계좌에</div>
            <div className="transfer">
              <div><span className="avatar a">A</span><p>{state.people[0].name}<strong>{won(result.contributionA)}</strong><small>내 소득의 {result.incomes[0] ? Math.round((result.contributionA / result.incomes[0]) * 100) : 0}%</small></p></div>
              <span className="plus">+</span>
              <div><span className="avatar b">B</span><p>{state.people[1].name}<strong>{won(result.contributionB)}</strong><small>내 소득의 {result.incomes[1] ? Math.round((result.contributionB / result.incomes[1]) * 100) : 0}%</small></p></div>
            </div>
            <div className="summary-footer">
              <span>각자 남는 금액</span>
              <p>{state.people[0].name} {won(result.incomes[0] - result.contributionA)} · {state.people[1].name} {won(result.incomes[1] - result.contributionB)}</p>
            </div>
          </section>

          <section className="advice-card">
            <div className="advice-heading"><span>↗</span><div><small>SMART SAVING</small><h3>얼마나 아끼면 좋을까요?</h3></div></div>
            {!result.currentEntered ? (
              <>
                <p className="advice-lead">현재 지출을 입력하기 전에는 <strong>월 {won(result.savingsTarget)}</strong>을 먼저 떼어두는 것을 목표로 해보세요.</p>
                <ol>
                  <li><span>1</span><p><strong>급여일 자동이체</strong>지출 전에 저축 목표를 공동 저축계좌로 옮겨요.</p></li>
                  <li><span>2</span><p><strong>비상금 먼저</strong>필수생활비 3~6개월분을 먼저 마련해요.</p></li>
                  <li><span>3</span><p><strong>현재 지출 비교</strong>왼쪽 04번에 실제 지출을 넣으면 절약 우선순위를 찾아드려요.</p></li>
                </ol>
              </>
            ) : (
              <>
                <p className="advice-lead">
                  현재 지출은 <strong>{won(result.currentTotal)}</strong>.
                  {result.overspend > 0 ? ` 권장 생활비보다 ${won(result.overspend)} 많아요.` : ` 권장 범위 안이에요.`}
                </p>
                {topSavings.length ? (
                  <ol>
                    {topSavings.map((item, index) => (
                      <li key={item.id}><span>{index + 1}</span><p><strong>{item.label}에서 약 {won(item.gap)}</strong>권장 상한까지 줄일 여지가 있어요.</p></li>
                    ))}
                  </ol>
                ) : (
                  <div className="success-note">✓ 모든 입력 항목이 권장 상한 안에 있어요. 남는 금액을 비상금이나 목표저축으로 옮겨보세요.</div>
                )}
              </>
            )}
          </section>

          <section className="disclaimer">
            <strong>참고해 주세요</strong>
            <p>결과는 입력 정보에 따른 예산 참고안이며 세무·투자·대출 상담을 대신하지 않습니다. 실제 급여와 금융 조건을 확인한 뒤 결정하세요.</p>
          </section>
        </aside>
      </div>

      <footer>
        <span className="brand"><span className="brand-mark">둘</span><span>둘이살림</span></span>
        <p>돈 이야기가 다툼이 아닌, 함께 만드는 계획이 되도록.</p>
      </footer>
    </main>
  );
}
