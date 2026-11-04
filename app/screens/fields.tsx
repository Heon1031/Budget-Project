"use client";

import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";

export const won = (value: number) => `${Math.round(Math.max(0, value)).toLocaleString("ko-KR")}원`;
export const signedWon = (value: number) =>
  `${value < 0 ? "-" : ""}${Math.round(Math.abs(value)).toLocaleString("ko-KR")}원`;
export const manwon = (value: number) => `${Math.round(Math.max(0, value) / 10_000).toLocaleString("ko-KR")}만원`;
export const parseWon = (value: string) => Number(value.replace(/[^\d]/g, "")) || 0;

// 금액 단위: 화면 위 「단위」 필터 하나로 모든 금액 칸이 함께 바뀐다(원 · 만원 · 억원). 「7」 + 억원 = 7억 원.
export const UNITS = [
  { label: "원", size: 1 },
  { label: "만원", size: 10_000 },
  { label: "억원", size: 100_000_000 },
] as const;
export const UnitContext = createContext(1);

export function UnitFilter({ unit, onChange }: { unit: number; onChange: (unit: number) => void }) {
  return (
    <div className="unit-filter" role="radiogroup" aria-label="금액 단위">
      <span>단위</span>
      <div className="segmented">
        {UNITS.map((u, index) => (
          <button key={u.label} role="radio" aria-checked={unit === index} className={unit === index ? "active" : ""} onClick={() => onChange(index)}>
            {u.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const withCommas = (text: string) => {
  const [whole, fraction] = text.split(".");
  const formatted = whole ? Number(whole).toLocaleString("ko-KR") : "";
  return fraction !== undefined ? `${formatted || "0"}.${fraction}` : formatted;
};

const toText = (value: number, size: number) => {
  if (!value) return "";
  const shown = Math.round((value / size) * 10_000) / 10_000;
  return withCommas(String(shown));
};

// 「369만 2,693원」「7억원」처럼 소리 내 읽는 대로.
export function readWon(value: number) {
  const v = Math.round(Math.abs(value));
  if (v === 0) return "0원";
  const eok = Math.floor(v / 100_000_000);
  const man = Math.floor((v % 100_000_000) / 10_000);
  const rest = v % 10_000;
  const parts = [eok ? `${eok.toLocaleString("ko-KR")}억` : "", man ? `${man.toLocaleString("ko-KR")}만` : "", rest ? rest.toLocaleString("ko-KR") : ""].filter(Boolean);
  return `${value < 0 ? "-" : ""}${parts.join(" ")}원`;
}

// 금액 입력: 쉼표를 넣어도 커서가 튀지 않고, 누르면 전체가 선택돼 바로 고쳐 쓸 수 있다.
// 예시값이면 작고 옅은 안내 글자(placeholder)로만 보이고, 칸을 누르면 사라져 바로 우리 숫자를 친다.
export function AmountInput({ value, onChange, label, example = false }: { value: number; onChange: (value: number) => void; label?: string; example?: boolean }) {
  const unit = useContext(UnitContext);
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const size = UNITS[unit].size;
  const shown = toText(value, size);

  // 쉼표가 새로 생겨도 「입력한 숫자 몇 개 뒤」 자리에 커서를 다시 둔다.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input || caret.current === null || document.activeElement !== input) return;
    let seen = 0;
    let position = input.value.length;
    for (let i = 0; i < input.value.length; i += 1) {
      if (seen === caret.current) {
        position = i;
        break;
      }
      if (/[\d.]/.test(input.value[i])) seen += 1;
    }
    input.setSelectionRange(position, position);
    caret.current = null;
  });

  return (
    <span className={`amount-input ${example ? "is-example" : ""}`}>
      <input
        ref={inputRef}
        inputMode={unit === 0 ? "numeric" : "decimal"}
        aria-label={example ? `${label ?? "금액"} (예시 ${shown || 0})` : label}
        placeholder={example ? shown || "0" : "0"}
        value={draft !== null ? withCommas(draft) : example ? "" : shown}
        onFocus={(event) => {
          setDraft(example ? "" : shown.replace(/,/g, ""));
          event.target.select();
        }}
        onBlur={() => setDraft(null)}
        onChange={(event) => {
          const raw = event.target.value;
          const before = raw.slice(0, event.target.selectionStart ?? raw.length);
          caret.current = (before.match(/[\d.]/g) ?? []).length;
          let text = raw.replace(/[^\d.]/g, "");
          if (unit === 0) text = text.replace(/\./g, "");
          const dot = text.indexOf(".");
          if (dot >= 0) text = text.slice(0, dot + 1) + text.slice(dot + 1).replace(/\./g, "").slice(0, 4);
          setDraft(text);
          onChange(Math.round((Number(text) || 0) * size));
        }}
      />
      <b className="unit-suffix">{UNITS[unit].label}</b>
    </span>
  );
}

export function MoneyField({
  label,
  value,
  onChange,
  hint,
  example = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  // 아직 바꾸지 않은 예시값이면 작고 옅은 안내 글자로만 보이고, 누르면 사라진다.
  example?: boolean;
}) {
  return (
    <div className="field">
      <span>{label}{hint && <small>{hint}</small>}</span>
      <div className="money-field">
        <AmountInput value={value} onChange={onChange} label={label} example={example} />
      </div>
      {value >= 10_000 && !example && <em className="money-read">{readWon(value)}</em>}
    </div>
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
