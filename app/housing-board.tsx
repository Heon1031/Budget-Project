"use client";

import { useEffect, useState } from "react";
import { MoneyField, RateInput, koreanWon, won } from "./fields";
import { HOUSE_STEPS, RULES, calculateHouse, stepDate, type HousePlan } from "./lib/housing";
import type { MarketInfo } from "./lib/market";

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
        <div className="house-head">
          <span>잔금일까지 {calc.months}개월</span>
          <strong className={calc.gap > 0 ? "negative" : ""}>
            {calc.gap > 0 ? `${koreanWon(calc.gap)} 모자라요` : `${koreanWon(-calc.gap)} 여유 있어요`}
          </strong>
          <small>
            지금 속도(매달 {won(house.monthlySaving)})로 모으면 {koreanWon(calc.willHave)} · 필요한 현금 {koreanWon(calc.needCash)}
          </small>
          {calc.gap > 0 && (
            <p className="verdict talk">잔금일까지 맞추려면 매달 <b>{won(calc.neededMonthly)}</b>을 집 목돈 통장에 넣어야 해요.</p>
          )}
        </div>

        <div className="house-flow">
          <p><span>집값</span><b>{koreanWon(house.targetPrice)}</b></p>
          <p><span>대출 가능액 <small>추정 · {limitText}</small></span><b>-{koreanWon(calc.loan)}</b></p>
          <p><span>취득세 <small>{house.firstHome ? "생애최초 감면 반영" : "추정"}</small></span><b>+{won(calc.tax)}</b></p>
          <p><span>중개보수</span><b>+{won(calc.broker)}</b></p>
          <p><span>등기·이사·기타</span><b>+{won(house.otherCosts)}</b></p>
          <p className="total"><span>필요한 현금</span><b>{koreanWon(calc.needCash)}</b></p>
          <p><span>지금 가진 돈 <small>모은 자산 + 돌려받을 보증금</small></span><b>{koreanWon(calc.haveNow)}</b></p>
        </div>

        <div className="house-notes">
          <p>계약금(보통 10%) <b>{koreanWon(calc.contract)}</b> — 지금 가진 돈으로 {calc.haveNow >= calc.contract ? "낼 수 있어요" : `${koreanWon(calc.contract - calc.haveNow)} 모자라요`}</p>
          <p>대출 매달 상환 <b>{won(calc.payment)}</b> <small>({house.loanYears}년 · 연 {house.loanRate}% · 원리금균등)</small> — 둘의 실수령의 {Math.round(paymentShare)}%{paymentShare > 40 ? " · 부담이 커요" : ""}</p>
        </div>
      </section>

      {market && (market.loanRate || market.regNews.length > 0) && (
        <section className="card market-card">
          <h3 className="card-title">나라에서 나온 숫자</h3>
          {market.loanRate && (
            <div className="market-row">
              <span>
                <b>은행 주택담보대출 평균 금리 {market.loanRate.rate.toFixed(2)}%</b>
                <small>{market.loanRate.month.slice(0, 4)}년 {Number(market.loanRate.month.slice(5))}월 · 한국은행</small>
              </span>
              {Math.abs(market.loanRate.rate - house.loanRate) >= 0.01 ? (
                <button onClick={() => onChange({ loanRate: market.loanRate!.rate })}>내 계산에 쓰기</button>
              ) : (
                <em>계산에 쓰는 중</em>
              )}
            </div>
          )}
          {freshNews.length > 0 ? (
            <div className="news-alert">
              <p className="verdict talk">대출 규제 관련 새 소식이 {freshNews.length}건 있어요. 규제가 바뀌었다면 앱의 한도 계산 숫자도 고쳐야 해요.</p>
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
              <button className="text-button" onClick={() => onChange({ newsSeen: Math.max(...freshNews.map((item) => item.id)) })}>다 확인했어요</button>
            </div>
          ) : (
            <p className="muted small">새 대출 규제 소식은 없어요. 매일 아침 금융위원회 보도자료를 확인해요.</p>
          )}
        </section>
      )}

      <section className="card">
        <h3 className="card-title">우리 조건</h3>
        <div className="form-grid">
          <MoneyField label="목표 집값" value={house.targetPrice} onChange={(targetPrice) => onChange({ targetPrice })} />
          <label className="field">
            <span>잔금일(입주 예정일)</span>
            <input className="plain-input" type="date" value={moveDate} onChange={(event) => onChange({ moveDate: event.target.value })} />
          </label>
          <MoneyField
            label="매달 집 목돈"
            hint={unassigned > 0 ? `계획에서 남는 돈 ${won(unassigned)}` : "계획에서 남는 돈이 없어요"}
            value={house.monthlySaving}
            onChange={(monthlySaving) => onChange({ monthlySaving })}
          />
          <MoneyField label="돌려받을 전세보증금" value={house.jeonseDeposit} onChange={(jeonseDeposit) => onChange({ jeonseDeposit })} />
          <MoneyField label="기존 대출 1년 상환액" hint="신용·차 할부 등" value={house.existingAnnualDebt} onChange={(existingAnnualDebt) => onChange({ existingAnnualDebt })} />
          <MoneyField label="등기·이사·기타 비용" value={house.otherCosts} onChange={(otherCosts) => onChange({ otherCosts })} />
        </div>
        <div className="toggle-group wide">
          <button className={house.capitalArea ? "active" : ""} onClick={() => onChange({ capitalArea: true })}>수도권·규제지역</button>
          <button className={!house.capitalArea ? "active" : ""} onClick={() => onChange({ capitalArea: false })}>그 밖의 지역</button>
        </div>
        <div className="toggle-group wide">
          <button className={house.firstHome ? "active" : ""} onClick={() => onChange({ firstHome: true })}>둘 다 처음 사는 집</button>
          <button className={!house.firstHome ? "active" : ""} onClick={() => onChange({ firstHome: false })}>집을 산 적 있음</button>
        </div>
        <details className="advanced">
          <summary>금리·세율 직접 바꾸기</summary>
          <div className="rate-grid">
            <label><span>대출 금리</span><div><RateInput value={house.loanRate} onChange={(loanRate) => onChange({ loanRate: Math.min(20, loanRate) })} /><b>%</b></div></label>
            <label><span>스트레스 가산</span><div><RateInput value={house.stressRate} onChange={(stressRate) => onChange({ stressRate: Math.min(5, stressRate) })} /><b>%p</b></div></label>
            <label><span>대출 기간</span><div><RateInput value={house.loanYears} onChange={(loanYears) => onChange({ loanYears: Math.min(50, Math.max(1, Math.round(loanYears))) })} /><b>년</b></div></label>
            <label><span>취득세율</span><div><RateInput value={house.taxRate} onChange={(taxRate) => onChange({ taxRate: Math.min(13.4, taxRate) })} /><b>%</b></div></label>
            <label><span>중개보수율</span><div><RateInput value={house.brokerRate} onChange={(brokerRate) => onChange({ brokerRate: Math.min(0.9, brokerRate) })} /><b>%</b></div></label>
          </div>
        </details>
        <p className="muted small">
          대출 한도·세금은 {RULES.checkedOn} 기준으로 조사한 숫자로 계산한 <b>추정</b>이에요. 실제 한도는 은행 심사로 정해지니, 계약 전에 꼭 은행과 주택도시기금(디딤돌 등)에서 확인하세요.
          연 소득은 「계획」 탭의 두 사람 세전 연봉 합계({koreanWon(annualIncome)})를 써요.
        </p>
      </section>

      <section className="card">
        <h3 className="card-title">잔금일까지 할 일</h3>
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
                    <small>{date.replace(/-/g, ".")}{late ? " · 지났어요" : ""} — {step.detail}</small>
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
