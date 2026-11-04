"use client";

import { CalendarDays, Check, ChevronRight, House, Info, PiggyBank, TriangleAlert, Wallet } from "lucide-react";
import { Donut, GrowthBars, Legend, Ring, bucketColor, type Segment } from "./charts";
import { koreanWon, shortWon } from "./fields";
import type { Flow } from "./lib/plan";

// 첫 화면: 1년 뒤 모일 돈(막대), 각자 월급이 바구니로 어떻게 나뉘는지(도넛, 가운데 = 마음 편히 쓸 돈), 내 집까지(고리).

export function FlowBoard({
  flow,
  names,
  house,
  example,
  onOpen,
}: {
  flow: Flow;
  names: [string, string];
  example: boolean;
  house: { daysLeft: number; have: number; need: number };
  onOpen: (tab: "buckets" | "wish" | "house" | "settings") => void;
}) {
  return (
    <div className="content">
      {example && (
        <button className="example-banner" onClick={() => onOpen("buckets")}>
          <Info size={16} /> 회색 숫자는 예시예요 · 나누기 · 설정에서 우리 숫자로 바꿔 주세요
        </button>
      )}
      <section className="summary-main hero">
        <span className="hero-label"><PiggyBank size={16} /> 1년 뒤 모이는 돈</span>
        <strong>{koreanWon(flow.yearSaved)}</strong>
        <GrowthBars monthly={flow.monthlySaved} />
        <div className="hero-chips">
          {flow.people.map((person, index) => (
            <span key={index}><PiggyBank size={14} /> {names[index]} {shortWon(person.saveMonthly)}/월</span>
          ))}
        </div>
      </section>

      <section className="card">
        <h3 className="card-title"><Wallet size={18} /> 이번 달 마음 편히 쓸 돈</h3>
        <div className="person-donuts">
          {flow.people.map((person, index) => {
            const segments: Segment[] = person.buckets
              .map((bucket, i) => ({ label: bucket.name, value: bucket.budget, color: bucketColor(i) }))
              .filter((segment) => segment.value > 0);
            if (person.unallocated >= 1000) segments.push({ label: "안 나눈 돈", value: person.unallocated, color: "var(--line-strong)" });
            const over = person.allocatedPercent > 100.05;
            const overflowing = person.buckets.filter((bucket) => bucket.left < 0 && bucket.kind !== "save");
            const save = person.buckets.find((bucket) => bucket.kind === "save" && bucket.left > 0);
            const warn = over || overflowing.length > 0 || Boolean(save);
            return (
              <button key={index} className={`person-donut person-${index + 1}`} onClick={() => onOpen("buckets")}>
                <b className="who">{names[index]}</b>
                <Donut segments={segments} center={shortWon(person.free)} caption="쓸 돈" />
                <Legend segments={segments} total={person.net} />
                <p className={`badge ${warn ? "warn" : "good"}`}>
                  {warn ? <TriangleAlert size={14} /> : <Check size={14} />}
                  {over ? "100% 넘게 나눔" : overflowing.length ? `${overflowing[0].name} 넘침` : save ? `+${shortWon(save.left)} 더 모으면 ${save.percent}%` : "목표 달성"}
                </p>
              </button>
            );
          })}
        </div>
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
