"use client";

import { ArrowDownLeft, ArrowUpRight, Check, Home, Plus, Trash2, TriangleAlert, Users } from "lucide-react";
import { COMMON_TRANSFER, HOUSEHOLD_SHARE, PERSONAL_IN_COMMON, newId, type CommonAccount, type Person, type PersonFlow } from "../lib/calc/plan";
import { AmountInput, shortWon, won } from "./fields";

// 나누기 「공동」: 토스 모임통장 같은 공동 통장 한 곳.
//  - 들어오는 돈: 각자 바구니에서 「공동 통장 · 모임」 이름의 항목(따로 적지 않음 → 두 번 적을 일이 없다)
//  - 나가는 돈: 여기서만 적는다(장보기 · 전기 · 가스 …)
//  - 아래 「집에 내는 몫」: 공동 통장 + 전세 · 월세 · 대출 이자 · 관리비 항목을 사람별로 모아 보여 준다(판정은 하지 않음)

const QUICK = ["공동 장보기", "전기", "가스", "수도", "관리비", "생필품"];

export function CommonBoard({
  common,
  people,
  flows,
  names,
  onChange,
}: {
  common: CommonAccount;
  people: [Person, Person];
  flows: [PersonFlow, PersonFlow];
  names: [string, string];
  onChange: (common: CommonAccount) => void;
}) {
  const inflow = people.map((person) =>
    person.buckets.flatMap((bucket) => bucket.items).filter((item) => COMMON_TRANSFER.test(item.name)).reduce((sum, item) => sum + item.amount, 0),
  ) as [number, number];
  const totalIn = inflow[0] + inflow[1];
  const totalOut = common.items.reduce((sum, item) => sum + item.amount, 0);
  const left = totalIn - totalOut;
  const max = Math.max(totalIn, totalOut, 1);

  const share = people.map((person) =>
    person.buckets.flatMap((bucket) => bucket.items).filter((item) => HOUSEHOLD_SHARE.test(item.name) && !PERSONAL_IN_COMMON.test(item.name)),
  );
  const shareSum = share.map((items) => items.reduce((sum, item) => sum + item.amount, 0)) as [number, number];
  const shareTotal = shareSum[0] + shareSum[1];
  const netTotal = flows[0].net + flows[1].net;
  const fair = flows.map((flow) => (netTotal > 0 ? (shareTotal * flow.net) / netTotal : 0));
  const ratio = flows.map((flow) => (netTotal > 0 ? Math.round((flow.net / netTotal) * 100) : 50));

  const setItems = (items: CommonAccount["items"]) => onChange({ ...common, items });
  const used = new Set(common.items.map((item) => item.name));

  return (
    <>
      <section className="summary-main common-hero">
        <span className="hero-label"><Users size={16} /> {common.name}</span>
        <strong>{won(left)}</strong>
        <p className="hero-sub">{left >= 0 ? "매달 남아요" : "매달 모자라요"} · 들어옴 {shortWon(totalIn)} · 나감 {shortWon(totalOut)}</p>
        {/* 들어옴(두 사람 몫) · 나감 두 줄 막대: 같은 눈금 */}
        <div className="common-bars" role="img" aria-label={`들어옴 ${won(totalIn)}, 나감 ${won(totalOut)}`}>
          <div className="common-bar in" style={{ width: `${(totalIn / max) * 100}%` }}>
            <span className="who-1" style={{ flexGrow: inflow[0] || 0.0001 }} />
            <span className="who-2" style={{ flexGrow: inflow[1] || 0.0001 }} />
          </div>
          <div className="common-bar out" style={{ width: `${(totalOut / max) * 100}%` }} />
        </div>
        <div className="common-legend">
          <span><i className="who-1" /> {names[0]} {shortWon(inflow[0])}</span>
          <span><i className="who-2" /> {names[1]} {shortWon(inflow[1])}</span>
          <span><i className="out" /> 나감 {shortWon(totalOut)}</span>
        </div>
      </section>

      {totalIn === 0 && (
        <p className="manager-tip tip"><TriangleAlert size={14} /><span>각자 생활비 바구니에 「공동 통장」 항목을 넣으면 여기로 들어오는 돈이 잡혀요.</span></p>
      )}

      <section className="card bucket-card">
        <div className="common-head">
          <span className="bucket-icon" style={{ ["--bucket-color" as string]: "var(--brand)" }}><ArrowUpRight size={18} /></span>
          <span className="bucket-title"><b>나가는 것</b><small>{common.name}에서 매달 · {won(totalOut)}</small></span>
        </div>
        <ul className="item-list">
          {common.items.map((item) => (
            <li key={item.id}>
              <input
                className="item-name"
                value={item.name}
                maxLength={40}
                aria-label="항목 이름"
                placeholder="항목 이름"
                onChange={(event) => setItems(common.items.map((it) => (it.id === item.id ? { ...it, name: event.target.value } : it)))}
              />
              <span className="item-amount">
                <AmountInput label={`${item.name} 금액`} value={item.amount} onChange={(amount) => setItems(common.items.map((it) => (it.id === item.id ? { ...it, amount } : it)))} />
              </span>
              <button className="icon-ghost" aria-label={`${item.name} 지우기`} onClick={() => setItems(common.items.filter((it) => it.id !== item.id))}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
        <div className="quick-chips">
          {QUICK.filter((name) => !used.has(name)).map((name) => (
            <button key={name} onClick={() => setItems([...common.items, { id: newId("c"), name, amount: 0 }])}><Plus size={14} /> {name}</button>
          ))}
          <button onClick={() => setItems([...common.items, { id: newId("c"), name: "", amount: 0 }])}><Plus size={14} /> 직접 쓰기</button>
        </div>
      </section>

      <section className="card bucket-card">
        <div className="common-head">
          <span className="bucket-icon" style={{ ["--bucket-color" as string]: "var(--partner)" }}><ArrowDownLeft size={18} /></span>
          <span className="bucket-title"><b>들어오는 것</b><small>각자 바구니의 「공동 통장 · 모임」 항목에서 가져와요</small></span>
        </div>
        <ul className="common-rows">
          {names.map((name, index) => (
            <li key={name}><span><i className={`who-${index + 1}`} /> {name}</span><b>{won(inflow[index])}</b></li>
          ))}
        </ul>
      </section>

      <section className="card bucket-card">
        <div className="common-head">
          <span className="bucket-icon" style={{ ["--bucket-color" as string]: "var(--good)" }}><Home size={18} /></span>
          <span className="bucket-title"><b>집에 내는 몫</b><small>공동 통장 + 전세 · 월세 · 대출 이자 · 관리비 (개인 식비는 빼고)</small></span>
        </div>
        <div className="share-bar" role="img" aria-label={names.map((name, index) => `${name} ${won(shareSum[index])}`).join(", ")}>
          <span className="who-1" style={{ flexGrow: shareSum[0] || 0.0001 }} />
          <span className="who-2" style={{ flexGrow: shareSum[1] || 0.0001 }} />
          <i style={{ left: `${ratio[0]}%` }} aria-hidden="true" />
        </div>
        <ul className="common-rows">
          {names.map((name, index) => (
            <li key={name}>
              <span><i className={`who-${index + 1}`} /> {name} <small>{share[index].map((item) => item.name).join(" · ") || "없음"}</small></span>
              <b>{won(shareSum[index])} <small>{flows[index].net > 0 ? `실수령의 ${Math.round((shareSum[index] / flows[index].net) * 100)}%` : ""}</small></b>
            </li>
          ))}
        </ul>
        <p className="muted small"><Check size={13} /> 소득 비율({ratio[0]}:{ratio[1]})로 나누면 {names[0]} {shortWon(fair[0])} · {names[1]} {shortWon(fair[1])} (막대의 세로선) — 참고만 하세요.</p>
      </section>
    </>
  );
}
