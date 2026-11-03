"use client";

import { koreanWon, won } from "./fields";
import type { Flow } from "./lib/plan";

// 첫 화면: 이대로 살면 1년에 얼마 모이는지, 이번 달 각자 마음 편히 쓸 돈, 내 집까지의 거리.

export function FlowBoard({
  flow,
  names,
  house,
  onOpen,
}: {
  flow: Flow;
  names: [string, string];
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
