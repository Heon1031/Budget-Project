"use client";

import { CalendarDays, Check, ChevronRight, House, PiggyBank, TrendingUp, TriangleAlert, Wallet } from "lucide-react";
import { Donut, GrowthBars, Legend, Ring, type Segment } from "./charts";
import { koreanWon, shortWon, won } from "./fields";
import type { Flow } from "./lib/plan";

// 첫 화면: 1년 뒤 모일 돈(막대), 각자 월급이 어디로 가는지(도넛), 내 집까지(고리).

type Targets = { targetNeeds: number; targetWants: number; targetSavings: number };

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
  const parts = [
    { icon: PiggyBank, label: "저축", value: flow.people[0].saving + flow.people[1].saving + flow.subscription },
    { icon: TrendingUp, label: "투자", value: flow.people[0].investing + flow.people[1].investing },
    { icon: House, label: "집", value: flow.houseMonthly },
  ];

  return (
    <div className="content">
      <section className="summary-main hero">
        <span className="hero-label"><PiggyBank size={16} /> 1년 뒤 모이는 돈</span>
        <strong>{koreanWon(flow.yearSaved)}</strong>
        <GrowthBars monthly={flow.monthlySaved} />
        <div className="hero-chips">
          {parts.map(({ icon: Icon, label, value }) => (
            <span key={label}><Icon size={14} /> {label} {shortWon(value)}</span>
          ))}
        </div>
      </section>

      <section className="card">
        <h3 className="card-title"><Wallet size={18} /> 이번 달 쓸 돈</h3>
        <div className="person-donuts">
          {flow.people.map((person, index) => {
            const segments: Segment[] = [
              { label: "필요", value: person.needs, color: "var(--chart-needs)" },
              { label: "하고 싶은", value: Math.max(0, person.wants), color: "var(--chart-wants)" },
              { label: "모으기", value: person.savings, color: "var(--chart-savings)" },
            ];
            const savingsPct = person.net > 0 ? (person.savings / person.net) * 100 : 0;
            const gap = targets[index].targetSavings - savingsPct;
            const short = person.free < 0;
            return (
              <div key={index} className={`person-donut person-${index + 1}`}>
                <b className="who">{names[index]}</b>
                <Donut segments={segments} center={short ? `-${shortWon(-person.free)}` : shortWon(person.free)} caption={short ? "부족" : "쓸 돈"} />
                <Legend segments={segments} total={person.net} />
                <p className={`badge ${short ? "bad" : gap > 1 ? "warn" : "good"}`}>
                  {short ? <TriangleAlert size={14} /> : gap > 1 ? <TriangleAlert size={14} /> : <Check size={14} />}
                  {short ? "쓸 돈 부족" : gap > 1 ? `+${shortWon((gap / 100) * person.net)} 더 모으기` : "목표 달성"}
                </p>
              </div>
            );
          })}
        </div>
        <details className="explain">
          <summary>계산 보기</summary>
          {flow.people.map((person, index) => (
            <p key={index}>
              <b>{names[index]}</b> 월급 {won(person.net)} − 내 고정 {won(person.ownFixed)} − 공동 몫 {won(person.jointShare)} − 저축·투자 {won(person.saving + person.investing)} = <b>{won(person.free)}</b>
            </p>
          ))}
          <p>공동 몫 = 공동 고정 {won(flow.jointFixed)} + 집 {won(flow.houseMonthly)}{flow.subscription > 0 ? ` + 청약 ${won(flow.subscription)}` : ""}, {flow.shares[0] === 0.5 ? "반씩" : `월급 비율 ${Math.round(flow.shares[0] * 100)}:${Math.round(flow.shares[1] * 100)}`}</p>
        </details>
      </section>

      <button className="house-row" onClick={() => onOpen("house")}>
        <Ring ratio={house.need > 0 ? house.have / house.need : 0}>{house.need > 0 ? Math.min(100, Math.round((house.have / house.need) * 100)) : 0}%</Ring>
        <span>
          <b><House size={16} /> 내 집</b>
          <small><CalendarDays size={13} /> {house.daysLeft > 0 ? `D-${house.daysLeft}` : "잔금일 지남"} · {shortWon(house.have)} / {shortWon(house.need)}</small>
        </span>
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
