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
