"use client";

import { useEffect, useState } from "react";
import { Banknote, CalendarDays, Check, CircleHelp, House, Landmark, Newspaper, Percent, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { Ring } from "./charts";
import { MoneyField, RateInput, koreanWon, shortWon } from "./fields";
import { HOUSE_STEPS, RULES, calculateHouse, initialHouse, stepDate, type HousePlan } from "../lib/calc/housing";
import type { MarketInfo } from "../lib/server/market";

// 1년 안 내 집 마련: 필요한 현금, 대출 가능액(추정), 모자란 돈, 매달 더 모을 돈, 잔금일 기준 할 일.

export function HousingBoard({
  house,
  moveDate,
  onChange,
  annualIncome,
  currentAssets,
  monthlyNet,
  unassigned,
}: {
  house: HousePlan;
  moveDate: string;
  onChange: (patch: Partial<HousePlan>) => void;
  annualIncome: number;
  currentAssets: number;
  monthlyNet: number;
  unassigned: number;
}) {
  const [market, setMarket] = useState<MarketInfo | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/market")
      .then((response) => (response.ok ? (response.json() as Promise<MarketInfo>) : null))
      .then((info) => alive && setMarket(info))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const freshNews = (market?.regNews ?? []).filter((item) => item.id > house.newsSeen);
  const calc = calculateHouse(house, annualIncome, currentAssets, moveDate);
  const paymentShare = monthlyNet > 0 ? (calc.payment / monthlyNet) * 100 : 0;
  const today = new Date().toISOString().slice(0, 10);
  const limitText = {
    ltv: `집값의 ${Math.round(calc.ltv * 100)}%(LTV) 기준`,
    cap: "집값 구간별 대출 상한 기준",
    dsr: `연 소득의 ${Math.round(RULES.dsr * 100)}%만 갚을 수 있다는 기준(DSR)`,
  }[calc.limitedBy];

  return (
    <div className="content">
      <section className="card house-card">
        <div className="house-top">
          <Ring ratio={calc.needCash > 0 ? calc.willHave / calc.needCash : 0} size={88}>
            {calc.needCash > 0 ? Math.min(100, Math.round((calc.willHave / calc.needCash) * 100)) : 0}%
          </Ring>
          <div className="house-head">
            <span><CalendarDays size={14} /> 잔금까지 {calc.months}달</span>
            <strong className={calc.gap > 0 ? "negative" : ""}>{calc.gap > 0 ? `${koreanWon(calc.gap)} 부족` : `${koreanWon(-calc.gap)} 여유`}</strong>
            <small>모일 돈 {shortWon(calc.willHave)} / 필요 {shortWon(calc.needCash)}</small>
          </div>
        </div>
        {calc.gap > 0 && <p className="badge warn"><TriangleAlert size={14} /> 매달 {shortWon(calc.neededMonthly)} 모아야 맞아요</p>}

        <div className="price-bar" role="img" aria-label={`집값 ${koreanWon(house.targetPrice)} 중 대출 ${koreanWon(calc.loan)}, 내 돈 ${koreanWon(house.targetPrice - calc.loan)}`}>
          <span className="loan" style={{ flexGrow: calc.loan }} />
          <span className="mine" style={{ flexGrow: Math.max(0, house.targetPrice - calc.loan) }} />
        </div>
        <ul className="legend">
          <li><i className="loan" /><span>대출 <small>추정</small></span><b>{shortWon(calc.loan)}</b></li>
          <li><i className="mine" /><span>내 돈</span><b>{shortWon(house.targetPrice - calc.loan)}</b></li>
          <li><i className="extra" /><span>세금·수수료</span><b>{shortWon(calc.tax + calc.broker + house.otherCosts)}</b></li>
        </ul>

        <div className="stat-row">
          <div><Banknote size={18} /><small>계약금 10%</small><b>{shortWon(calc.contract)}</b>{calc.haveNow >= calc.contract ? <em className="good"><Check size={12} /> 가능</em> : <em className="bad">{shortWon(calc.contract - calc.haveNow)} 부족</em>}</div>
          <div><Landmark size={18} /><small>월 상환</small><b>{shortWon(calc.payment)}</b><em className={paymentShare > 40 ? "bad" : "good"}>월급의 {Math.round(paymentShare)}%</em></div>
        </div>
      </section>

      {market && (market.loanRate || market.regNews.length > 0) && (
        <section className="card market-card">
          <h3 className="card-title"><Newspaper size={18} /> 나라 소식</h3>
          {market.loanRate && (
            <div className="market-row">
              <span>
                <b><Percent size={14} /> 은행 주담대 평균 {market.loanRate.rate.toFixed(2)}%</b>
                <small>{market.loanRate.month.slice(0, 4)}년 {Number(market.loanRate.month.slice(5))}월 · 한국은행</small>
              </span>
              {Math.abs(market.loanRate.rate - house.loanRate) >= 0.01 ? (
                <button onClick={() => onChange({ loanRate: market.loanRate!.rate })}>적용</button>
              ) : (
                <em><Check size={12} /> 적용 중</em>
              )}
            </div>
          )}
          {freshNews.length > 0 ? (
            <div className="news-alert">
              <p className="badge warn"><TriangleAlert size={14} /> 대출 규제 새 소식 {freshNews.length}건 · 한도 숫자 확인 필요</p>
              <ul className="news-list">
                {freshNews.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      <b>{item.title}</b>
                      <small>{item.date.replace(/-/g, ".")} · 금융위원회</small>
                    </a>
                  </li>
                ))}
              </ul>
              <button className="text-button" onClick={() => onChange({ newsSeen: Math.max(...freshNews.map((item) => item.id)) })}>확인했어요</button>
            </div>
          ) : (
            <p className="badge good"><Check size={14} /> 새 규제 소식 없음</p>
          )}
        </section>
      )}

      <section className="card">
        <h3 className="card-title"><SlidersHorizontal size={18} /> 우리 조건</h3>
        <div className="form-grid">
          <MoneyField label="목표 집값" example={house.targetPrice === initialHouse.targetPrice} value={house.targetPrice} onChange={(targetPrice) => onChange({ targetPrice })} />
          <label className="field">
            <span>잔금일(입주 예정일)</span>
            <input className="plain-input" type="date" value={moveDate} onChange={(event) => onChange({ moveDate: event.target.value })} />
          </label>
          <MoneyField
            label="매달 집 목돈"
            example={house.monthlySaving === initialHouse.monthlySaving}
            hint={unassigned > 0 ? `여유 ${shortWon(unassigned)}` : "여유 없음"}
            value={house.monthlySaving}
            onChange={(monthlySaving) => onChange({ monthlySaving })}
          />
          <MoneyField label="돌려받을 전세보증금" value={house.jeonseDeposit} onChange={(jeonseDeposit) => onChange({ jeonseDeposit })} />
          <MoneyField label="기존 대출 1년 상환액" value={house.existingAnnualDebt} onChange={(existingAnnualDebt) => onChange({ existingAnnualDebt })} />
          <MoneyField label="등기·이사·기타 비용" example={house.otherCosts === initialHouse.otherCosts} value={house.otherCosts} onChange={(otherCosts) => onChange({ otherCosts })} />
        </div>
        <div className="toggle-group wide">
          <button className={house.capitalArea ? "active" : ""} onClick={() => onChange({ capitalArea: true })}>수도권·규제</button>
          <button className={!house.capitalArea ? "active" : ""} onClick={() => onChange({ capitalArea: false })}>그 밖</button>
        </div>
        <div className="toggle-group wide">
          <button className={house.firstHome ? "active" : ""} onClick={() => onChange({ firstHome: true })}><House size={14} /> 첫 집</button>
          <button className={!house.firstHome ? "active" : ""} onClick={() => onChange({ firstHome: false })}>산 적 있음</button>
        </div>
        <details className="advanced">
          <summary><Percent size={14} /> 금리·세율</summary>
          <div className="rate-grid">
            <label><span>대출 금리</span><div><RateInput value={house.loanRate} onChange={(loanRate) => onChange({ loanRate: Math.min(20, loanRate) })} /><b>%</b></div></label>
            <label><span>스트레스 가산</span><div><RateInput value={house.stressRate} onChange={(stressRate) => onChange({ stressRate: Math.min(5, stressRate) })} /><b>%p</b></div></label>
            <label><span>대출 기간</span><div><RateInput value={house.loanYears} onChange={(loanYears) => onChange({ loanYears: Math.min(50, Math.max(1, Math.round(loanYears))) })} /><b>년</b></div></label>
            <label><span>취득세율</span><div><RateInput value={house.taxRate} onChange={(taxRate) => onChange({ taxRate: Math.min(13.4, taxRate) })} /><b>%</b></div></label>
            <label><span>중개보수율</span><div><RateInput value={house.brokerRate} onChange={(brokerRate) => onChange({ brokerRate: Math.min(0.9, brokerRate) })} /><b>%</b></div></label>
          </div>
        </details>
        <details className="explain">
          <summary><CircleHelp size={14} /> 추정 기준</summary>
          <p>대출 한도 · 세금은 {RULES.checkedOn} 조사 숫자로 계산한 추정이에요(한도 기준: {limitText}). 연 소득은 두 사람 세전 연봉 합계 {koreanWon(annualIncome)}. 계약 전에 은행 · 주택도시기금에서 꼭 확인하세요.</p>
        </details>
      </section>

      <section className="card">
        <h3 className="card-title"><CalendarDays size={18} /> 잔금까지 할 일</h3>
        <ol className="steps">
          {HOUSE_STEPS.map((step) => {
            const date = stepDate(moveDate, step.offsetDays);
            const done = Boolean(house.done[step.id]);
            const late = !done && date !== "" && date < today;
            return (
              <li key={step.id} className={`${done ? "done" : ""} ${late ? "late" : ""}`}>
                <label>
                  <input type="checkbox" checked={done} onChange={(event) => onChange({ done: { ...house.done, [step.id]: event.target.checked } })} />
                  <span>
                    <b>{step.title}</b>
                    <small title={step.detail}>{date.slice(5).replace("-", "/")}{late ? " · 지났어요" : ""}</small>
                  </span>
                </label>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
