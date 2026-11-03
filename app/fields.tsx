"use client";

import { useState } from "react";

export const won = (value: number) => `${Math.round(Math.max(0, value)).toLocaleString("ko-KR")}원`;
export const signedWon = (value: number) =>
  `${value < 0 ? "-" : ""}${Math.round(Math.abs(value)).toLocaleString("ko-KR")}원`;
export const manwon = (value: number) => `${Math.round(Math.max(0, value) / 10_000).toLocaleString("ko-KR")}만원`;
export const parseWon = (value: string) => Number(value.replace(/[^\d]/g, "")) || 0;

export function MoneyField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}{hint && <small>{hint}</small>}</span>
      <div className="money-field">
        <input
          inputMode="numeric"
          value={value ? value.toLocaleString("ko-KR") : ""}
          onChange={(event) => onChange(parseWon(event.target.value))}
          placeholder="0"
        />
        <b>원</b>
      </div>
    </label>
  );
}

// 입력 중에는 친 글자를 그대로 보여 줘야 「12.」처럼 소수점을 이어서 칠 수 있다.
export function RateInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const safeValue = Number.isFinite(value) ? value : 0;
  return (
    <input
      inputMode="decimal"
      value={draft ?? String(Number(safeValue.toFixed(1)))}
      onChange={(event) => {
        const text = event.target.value.replace(/[^\d.]/g, "");
        setDraft(text);
        onChange(Number(text) || 0);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

// 큰 금액을 「1억 5,000만원」처럼 읽기 쉽게 쓴다.
export function koreanWon(value: number) {
  const man = Math.round(Math.abs(value) / 10_000);
  const eok = Math.floor(man / 10_000);
  const rest = man % 10_000;
  const text = eok > 0 ? `${eok}억${rest > 0 ? ` ${rest.toLocaleString("ko-KR")}만` : ""}원` : `${rest.toLocaleString("ko-KR")}만원`;
  return value < 0 ? `-${text}` : text;
}

// 그래프 옆에 붙이는 짧은 금액: 「1.9억」「128만」.
export function shortWon(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(abs >= 1_000_000_000 ? 0 : 1).replace(/\.0$/, "")}억`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000).toLocaleString("ko-KR")}만`;
  return `${sign}${Math.round(abs).toLocaleString("ko-KR")}원`;
}
