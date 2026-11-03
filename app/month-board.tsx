"use client";

import { useMemo, useState } from "react";
import { MoneyField, signedWon, won } from "./fields";

// 이번 달 약속과 공동 생활비 기록. 「이거 사도 돼?」를 사람 대신 숫자가 답한다.

export type PromiseAmounts = {
  saving: number;
  invest: number;
  fixed: number;
  living: number;
  allowance: [number, number];
  threshold: number;
};

export type MonthPromise = PromiseAmounts & {
  agreed: [boolean, boolean];
};

export type Expense = {
  date: string;
  amount: number;
  memo: string;
  person: 0 | 1;
  discussed: boolean;
};

export const promiseId = (month: string) => `promise:${month}`;
const newExpenseId = () =>
  `expense:${Array.from(crypto.getRandomValues(new Uint8Array(9)), (byte) => byte.toString(36).padStart(2, "0")).join("")}`;

export function currentMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function today() {
  const date = new Date();
  return `${currentMonth(date)}-${String(date.getDate()).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number) {
  const [year, mon] = month.split("-").map(Number);
  return currentMonth(new Date(year, mon - 1 + delta, 1));
}

function daysLeft(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  if (month !== currentMonth()) return month > currentMonth() ? lastDay : 0;
  return lastDay - new Date().getDate() + 1;
}

const promiseTotal = (amounts: PromiseAmounts) =>
  amounts.saving + amounts.invest + amounts.fixed + amounts.living + amounts.allowance[0] + amounts.allowance[1];

const sameAmounts = (a: PromiseAmounts, b: PromiseAmounts) =>
  a.saving === b.saving && a.invest === b.invest && a.fixed === b.fixed && a.living === b.living &&
  a.allowance[0] === b.allowance[0] && a.allowance[1] === b.allowance[1] && a.threshold === b.threshold;

// 쉼표가 든 칸은 엑셀에서 칸이 나뉘지 않게 따옴표로 감싼다. =, + 로 시작하면 수식으로 읽히지 않게 앞에 ' 를 붙인다.
function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@]/.test(text) && typeof value === "string") text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const body = "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function MonthBoard({
  records,
  write,
  me,
  names,
  suggestion,
  totalNet,
}: {
  records: Map<string, unknown>;
  write: (id: string, value: unknown | null) => Promise<void>;
  me: 0 | 1;
  names: [string, string];
  suggestion: PromiseAmounts;
  totalNet: number;
}) {
  const [month, setMonth] = useState(currentMonth);
  const saved = records.get(promiseId(month)) as MonthPromise | undefined;
  const previous = records.get(promiseId(shiftMonth(month, -1))) as MonthPromise | undefined;
  const [draft, setDraft] = useState<PromiseAmounts | null>(null);
  const [editing, setEditing] = useState(false);

  const expenses = useMemo(
    () =>
      [...records.entries()]
        .filter(([id, value]) => id.startsWith("expense:") && (value as Expense).date?.startsWith(month))
        .map(([id, value]) => ({ id, ...(value as Expense) }))
        .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1)),
    [month, records],
  );

  const promise = saved;
  const shown: PromiseAmounts = draft ?? saved ?? previous ?? suggestion;
  const spent = expenses.reduce((sum, item) => sum + item.amount, 0);
  const remaining = (promise?.living ?? 0) - spent;
  const days = daysLeft(month);
  const bothAgreed = promise?.agreed[0] && promise?.agreed[1];

  const savePromise = async () => {
    // 약속 금액이 바뀌면 다시 둘 다 합의해야 한다. 고친 사람은 고친 내용에 합의한 것으로 본다.
    const changed = !saved || !sameAmounts(saved, shown);
    const agreed: [boolean, boolean] = changed
      ? [me === 0, me === 1]
      : saved.agreed;
    await write(promiseId(month), { ...shown, agreed });
    setDraft(null);
    setEditing(false);
  };

  const agree = async () => {
    if (!saved) return;
    const agreed: [boolean, boolean] = [...saved.agreed];
    agreed[me] = true;
    await write(promiseId(month), { ...saved, agreed });
  };

  const updateDraft = (patch: Partial<PromiseAmounts>) => setDraft({ ...shown, ...patch });
  const setAllowance = (index: 0 | 1, value: number) => {
    const allowance: [number, number] = [...shown.allowance];
    allowance[index] = value;
    updateDraft({ allowance });
  };

  const exportMonth = () => {
    const rows: (string | number)[][] = [
      ["둘이자산", `${month} 기록`],
      [],
      ["약속", "금액"],
      ["저축", shown.saving],
      ["투자", shown.invest],
      ["고정 지출(주거·대출·공과금)", shown.fixed],
      ["공동 생활비", shown.living],
      [`${names[0]} 용돈`, shown.allowance[0]],
      [`${names[1]} 용돈`, shown.allowance[1]],
      ["상의 기준", shown.threshold],
      ["합의", promise ? `${names[0]} ${promise.agreed[0] ? "O" : "X"} / ${names[1]} ${promise.agreed[1] ? "O" : "X"}` : "약속 없음"],
      [],
      ["날짜", "쓴 사람", "내용", "금액", "상의함"],
      ...[...expenses].reverse().map((item) => [item.date, names[item.person], item.memo, item.amount, item.discussed ? "O" : ""]),
      [],
      ["공동 생활비 쓴 합계", spent],
      ["남은 공동 생활비", remaining],
    ];
    downloadCsv(`둘이자산_${month}.csv`, rows);
  };

  return (
    <div className="content">
      <section className="card month-card">
        <div className="month-nav">
          <button aria-label="이전 달" onClick={() => { setMonth(shiftMonth(month, -1)); setDraft(null); setEditing(false); }}>‹</button>
          <h2>{Number(month.slice(5))}월 약속</h2>
          <button aria-label="다음 달" onClick={() => { setMonth(shiftMonth(month, 1)); setDraft(null); setEditing(false); }}>›</button>
        </div>

        <div className={`agree-status ${bothAgreed ? "done" : ""}`}>
          {!promise && <span>아직 이번 달 약속이 없어요. 금액을 정하고 저장해 주세요.</span>}
          {promise && (
            <>
              <span>{names[0]} {promise.agreed[0] ? "합의 ✓" : "대기"}</span>
              <span>{names[1]} {promise.agreed[1] ? "합의 ✓" : "대기"}</span>
            </>
          )}
        </div>

        {!editing && promise ? (
          <div className="promise-list">
            <p><span>저축</span><b>{won(promise.saving)}</b></p>
            <p><span>투자</span><b>{won(promise.invest)}</b></p>
            <p><span>고정 지출 <small>주거·대출·공과금</small></span><b>{won(promise.fixed)}</b></p>
            <p><span>공동 생활비</span><b>{won(promise.living)}</b></p>
            <p><span>{names[0]} 용돈 <small>묻지 않고 써요</small></span><b>{won(promise.allowance[0])}</b></p>
            <p><span>{names[1]} 용돈 <small>묻지 않고 써요</small></span><b>{won(promise.allowance[1])}</b></p>
            <p className="threshold"><span>상의 기준</span><b>{won(promise.threshold)} 이상은 같이 정해요</b></p>
          </div>
        ) : (
          <div className="promise-edit">
            <MoneyField label="저축" hint="예금·적금·청약·비상금" value={shown.saving} onChange={(saving) => updateDraft({ saving })} />
            <MoneyField label="투자" hint="주식·펀드·연금" value={shown.invest} onChange={(invest) => updateDraft({ invest })} />
            <MoneyField label="고정 지출" hint="주거·대출·공과금" value={shown.fixed} onChange={(fixed) => updateDraft({ fixed })} />
            <MoneyField label="공동 생활비" hint="식비·문화·여행" value={shown.living} onChange={(living) => updateDraft({ living })} />
            <MoneyField label={`${names[0]} 용돈`} value={shown.allowance[0]} onChange={(value) => setAllowance(0, value)} />
            <MoneyField label={`${names[1]} 용돈`} value={shown.allowance[1]} onChange={(value) => setAllowance(1, value)} />
            <MoneyField label="상의 기준" hint="이 금액 이상은 같이 정해요" value={shown.threshold} onChange={(threshold) => updateDraft({ threshold })} />
            <div className={`promise-sum ${promiseTotal(shown) > totalNet ? "over" : ""}`}>
              <span>약속 합계 {won(promiseTotal(shown))} / 둘의 실수령 {won(totalNet)}</span>
              <b>{promiseTotal(shown) > totalNet ? `${won(promiseTotal(shown) - totalNet)} 넘쳐요` : `${won(totalNet - promiseTotal(shown))} 남아요`}</b>
            </div>
            <button className="text-button" onClick={() => setDraft({ ...suggestion })}>「계획」 탭 금액으로 채우기</button>
          </div>
        )}

        <div className="promise-actions">
          {editing || !promise ? (
            <>
              <button className="primary" onClick={() => void savePromise()}>약속 저장{promise ? "" : "하고 합의"}</button>
              {promise && <button onClick={() => { setDraft(null); setEditing(false); }}>취소</button>}
            </>
          ) : (
            <>
              {!promise.agreed[me] && <button className="primary" onClick={() => void agree()}>{names[me]}: 이 약속에 합의</button>}
              <button onClick={() => setEditing(true)}>약속 고치기</button>
            </>
          )}
        </div>
      </section>

      {promise && (
        <LivingTracker
          key={month}
          month={month}
          promise={promise}
          remaining={remaining}
          spent={spent}
          days={days}
          me={me}
          names={names}
          expenses={expenses}
          write={write}
        />
      )}

      <button className="export-button" onClick={exportMonth}>{Number(month.slice(5))}월 기록 엑셀로 내보내기</button>
    </div>
  );
}

function LivingTracker({
  month,
  promise,
  remaining,
  spent,
  days,
  me,
  names,
  expenses,
  write,
}: {
  month: string;
  promise: MonthPromise;
  remaining: number;
  spent: number;
  days: number;
  me: 0 | 1;
  names: [string, string];
  expenses: (Expense & { id: string })[];
  write: (id: string, value: unknown | null) => Promise<void>;
}) {
  const [amount, setAmount] = useState(0);
  const [memo, setMemo] = useState("");
  const [discussed, setDiscussed] = useState(false);
  const isThisMonth = month === currentMonth();
  const [date, setDate] = useState(() => (isThisMonth ? today() : `${month}-01`));
  const usedRate = promise.living > 0 ? Math.min(100, (spent / promise.living) * 100) : 100;
  const needsTalk = amount >= promise.threshold && promise.threshold > 0;
  const tooMuch = amount > remaining;

  let verdict: { tone: "yes" | "talk" | "no"; text: string } | null = null;
  if (amount > 0) {
    if (tooMuch) verdict = { tone: "no", text: `이번 달 생활비가 ${won(amount - remaining)} 모자라요. 같이 정해요.` };
    else if (needsTalk) verdict = { tone: "talk", text: `상의 기준(${won(promise.threshold)}) 이상이에요. 같이 정하고 기록해요.` };
    else {
      const after = remaining - amount;
      verdict = { tone: "yes", text: `사도 돼요. 사고 나면 ${won(after)} 남아요${days > 0 ? ` (하루 ${won(after / days)}꼴)` : ""}.` };
    }
  }

  const canRecord = amount > 0 && date.startsWith(month) && (!(needsTalk || tooMuch) || discussed);

  const record = async () => {
    if (!canRecord) return;
    const expense: Expense = { date, amount, memo: memo.trim().slice(0, 60), person: me, discussed: needsTalk || tooMuch };
    await write(newExpenseId(), expense);
    setAmount(0);
    setMemo("");
    setDiscussed(false);
  };

  return (
    <section className="card living-card">
      <div className="living-head">
        <span>남은 공동 생활비</span>
        <strong className={remaining < 0 ? "negative" : ""}>{signedWon(remaining)}</strong>
        <small>{won(promise.living)} 중 {won(spent)} 씀{days > 0 && remaining > 0 ? ` · 남은 ${days}일, 하루 ${won(remaining / days)}꼴` : ""}</small>
        <div className="meter"><span style={{ width: `${usedRate}%` }} className={remaining < 0 ? "over" : ""} /></div>
      </div>

      <div className="spend-form">
        <strong>이거 사도 돼?</strong>
        <MoneyField label="금액" value={amount} onChange={setAmount} />
        <label className="field">
          <span>내용</span>
          <input className="plain-input" value={memo} maxLength={60} placeholder="예: 장보기" onChange={(event) => setMemo(event.target.value)} />
        </label>
        <label className="field">
          <span>날짜</span>
          <input className="plain-input" type="date" value={date} min={`${month}-01`} max={`${month}-31`} onChange={(event) => setDate(event.target.value)} />
        </label>
        {verdict && <p className={`verdict ${verdict.tone}`}>{verdict.text}</p>}
        {(needsTalk || tooMuch) && amount > 0 && (
          <label className="check">
            <input type="checkbox" checked={discussed} onChange={(event) => setDiscussed(event.target.checked)} />
            둘이 상의했어요
          </label>
        )}
        <button className="primary" disabled={!canRecord} onClick={() => void record()}>{names[me]} 이름으로 기록</button>
      </div>

      <div className="expense-list">
        {expenses.length === 0 && <p className="empty">아직 기록이 없어요.</p>}
        {expenses.map((item) => (
          <p key={item.id}>
            <span>
              <b>{item.memo || "공동 생활비"}</b>
              <small>{item.date.slice(5).replace("-", "/")} · {names[item.person]}{item.discussed ? " · 상의함" : ""}</small>
            </span>
            <b>{won(item.amount)}</b>
            {item.person === me && (
              <button aria-label="기록 지우기" onClick={() => { if (confirm(`${item.memo || "이 기록"} ${won(item.amount)}을 지울까요?`)) void write(item.id, null); }}>×</button>
            )}
          </p>
        ))}
      </div>
    </section>
  );
}
