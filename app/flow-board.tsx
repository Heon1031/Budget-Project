"use client";

import { koreanWon, won } from "./fields";
import type { Flow } from "./lib/plan";

// 첫 화면: 이대로 살면 1년에 얼마 모이는지, 이번 달 각자 마음 편히 쓸 돈, 내 집까지의 거리.

type Targets = { targetNeeds: number; targetWants: number; targetSavings: number };

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

export function FlowBoard({
  flow,
  names,
  targets,
  house,
  onOpen,
}: {
  flow: Flow;
  names: [string, string];
  targets: [Targets, Targets];
  house: { daysLeft: number; have: number; need: number };
  onOpen: (tab: "fixed" | "wish" | "house" | "settings") => void;
}) {
  const short = flow.people.map((person) => person.free < 0);
  const parts = [
    { label: "저축", value: flow.people[0].saving + flow.people[1].saving + flow.subscription },
    { label: "투자", value: flow.people[0].investing + flow.people[1].investing },
    { label: "집 목돈", value: flow.houseMonthly },
  ];

  return (
    <div className="content">
      <section className="summary-main">
        <span>이대로 살면 1년 뒤</span>
        <strong>{koreanWon(flow.yearSaved)} 모여요</strong>
        <small>매달 {won(flow.monthlySaved)}씩 · {parts.filter((part) => part.value > 0).map((part) => `${part.label} ${koreanWon(part.value)}`).join(" · ")}</small>
      </section>

      <section className="card">
        <h3 className="card-title">이번 달 마음 편히 쓸 돈</h3>
        <div className="free-grid">
          {flow.people.map((person, index) => (
            <div key={index} className={`free-card person-${index + 1} ${short[index] ? "short" : ""}`}>
              <span>{names[index]}</span>
              <strong>{short[index] ? `${won(-person.free)} 부족` : won(person.free)}</strong>
              <small>하루 {won(Math.max(0, person.free) / 30)}꼴</small>
            </div>
          ))}
        </div>
        <ul className="flow-lines">
          {flow.people.map((person, index) => (
            <li key={index}>
              <b>{names[index]}</b>
              <span>
                월급 {won(person.net)} − 내 고정지출 {won(person.ownFixed)} − 공동 몫 {won(person.jointShare)} − 저축·투자 {won(person.saving + person.investing)}
              </span>
            </li>
          ))}
        </ul>
        {(short[0] || short[1]) && (
          <p className="verdict no">쓸 돈이 마이너스예요. 고정지출을 줄이거나 저축·투자 금액을 조정해야 해요.</p>
        )}
        <p className="muted small">
          공동 몫 = 공동 고정지출 {won(flow.jointFixed)} + 집 목돈 {won(flow.houseMonthly)}
          {flow.subscription > 0 ? ` + 청약 ${won(flow.subscription)}` : ""}을 {flow.shares[0] === 0.5 ? "반씩" : `월급 비율(${Math.round(flow.shares[0] * 100)}:${Math.round(flow.shares[1] * 100)})로`} 나눈 돈
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">월급 나누기</h3>
          <button className="text-button" onClick={() => onOpen("settings")}>목표 바꾸기</button>
        </div>
        {flow.people.map((person, index) => {
          const needs = pct(person.needs, person.net);
          const wants = pct(Math.max(0, person.wants), person.net);
          const savings = pct(person.savings, person.net);
          const target = targets[index];
          const gap = target.targetSavings - savings;
          return (
            <div key={index} className="ratio-row">
              <div className="ratio-head">
                <b>{names[index]}</b>
                <small>목표 {target.targetNeeds} · {target.targetWants} · {target.targetSavings}</small>
              </div>
              <div className="ratio-bar" aria-hidden="true">
                <span className="needs" style={{ width: `${needs}%` }} />
                <span className="wants" style={{ width: `${wants}%` }} />
                <span className="savings" style={{ width: `${savings}%` }} />
              </div>
              <div className="ratio-legend">
                <span><i className="needs" />꼭 필요 {Math.round(needs)}%</span>
                <span><i className="wants" />하고 싶은 {Math.round(wants)}%</span>
                <span><i className="savings" />모으기 {Math.round(savings)}%</span>
              </div>
              <p className={`ratio-note ${gap > 1 ? "warn" : "good"}`}>
                {gap > 1
                  ? `목표보다 ${Math.round(gap)}%p 덜 모아요 · 매달 ${won((gap / 100) * person.net)} 더 떼면 맞아요`
                  : savings - target.targetSavings > 1
                    ? `목표보다 ${Math.round(savings - target.targetSavings)}%p 더 모으고 있어요`
                    : "목표만큼 모으고 있어요"}
                {needs - target.targetNeeds > 1 ? ` · 꼭 필요한 돈이 목표보다 ${Math.round(needs - target.targetNeeds)}%p 많아요` : ""}
              </p>
            </div>
          );
        })}
      </section>

      <button className="summary-house" onClick={() => onOpen("house")}>
        <span>내 집까지 {house.daysLeft > 0 ? `D-${house.daysLeft}` : "잔금일 지남"}</span>
        <b>{koreanWon(house.have)} <small>모일 예정 · 필요 {koreanWon(house.need)}</small></b>
        <i className="meter"><span style={{ width: `${house.need > 0 ? Math.min(100, (house.have / house.need) * 100) : 0}%` }} /></i>
      </button>

      <div className="quick-links">
        <button onClick={() => onOpen("wish")}><b>해볼까?</b><small>피부과, 헬스 등록… 지금 해도 될지 보기</small></button>
        <button onClick={() => onOpen("fixed")}><b>고정지출</b><small>매달 나가는 돈 정리하기</small></button>
      </div>
    </div>
  );
}
