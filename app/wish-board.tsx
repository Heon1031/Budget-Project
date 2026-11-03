"use client";

import { useState } from "react";
import { MoneyField, koreanWon, won } from "./fields";
import { newId, type FixedCost, type Flow, type Owner, type Wish } from "./lib/plan";

// 해볼까?: 피부과 · 헬스 등록 · 레슨처럼 하고 싶은 것을 지금 해도 되는지, 1년 흐름이 어떻게 바뀌는지 보여 준다.

type Verdict = { tone: "yes" | "talk" | "no"; title: string; detail: string };

export function judgeWish(wish: Wish, flow: Flow): Verdict {
  const free = wish.owner === "both" ? flow.people[0].free + flow.people[1].free : flow.people[wish.owner].free;
  const yearAfter = (cut: number) => `1년 모일 돈 ${koreanWon(flow.yearSaved)} → ${koreanWon(flow.yearSaved - cut)}`;
  if (wish.amount <= 0) return { tone: "talk", title: "금액을 넣어 주세요", detail: "" };
  if (wish.kind === "once") {
    if (free >= wish.amount) {
      return { tone: "yes", title: "이번 달 용돈으로 돼요", detail: `쓰고 나면 이번 달 ${won(free - wish.amount)} 남아요.` };
    }
    if (free > 0) {
      const months = Math.ceil(wish.amount / free);
      return { tone: "talk", title: `용돈 ${months}개월 모으면 돼요`, detail: `지금 하려면 저축에서 ${won(wish.amount - free)}을 꺼내야 해요 · ${yearAfter(wish.amount - free)}` };
    }
    return { tone: "no", title: "지금 용돈으로는 어려워요", detail: `저축에서 꺼내면 ${yearAfter(wish.amount)}` };
  }
  if (free >= wish.amount) {
    return { tone: "yes", title: "매달 해도 돼요", detail: `매달 쓸 돈이 ${won(free)} → ${won(free - wish.amount)}이 돼요. 1년 모일 돈은 그대로예요.` };
  }
  const cut = (wish.amount - Math.max(0, free)) * 12;
  return { tone: "no", title: "매달 하려면 저축을 줄여야 해요", detail: `매달 ${won(wish.amount - Math.max(0, free))}씩 · ${yearAfter(cut)}` };
}

export function WishBoard({
  wishes,
  flow,
  names,
  onChange,
  onMoveToFixed,
}: {
  wishes: Wish[];
  flow: Flow;
  names: [string, string];
  onChange: (wishes: Wish[]) => void;
  onMoveToFixed: (fixed: FixedCost, wishId: string) => void;
}) {
  const [draft, setDraft] = useState<Wish>(() => ({ id: newId("w"), name: "", amount: 0, kind: "once", owner: 0 }));
  const ownerName = (owner: Owner) => (owner === "both" ? "둘이" : names[owner]);
  const preview = judgeWish(draft, flow);

  return (
    <div className="content">
      <section className="card">
        <h3 className="card-title">해볼까?</h3>
        <p className="muted small">하고 싶은 걸 넣으면 이번 달 마음 편히 쓸 돈으로 되는지, 1년 흐름이 어떻게 바뀌는지 알려 줘요.</p>
        <label className="field">
          <span>무엇을</span>
          <input className="plain-input" value={draft.name} maxLength={40} placeholder="예: 피부과, 헬스 등록, 골프 레슨" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <MoneyField label="얼마" value={draft.amount} onChange={(amount) => setDraft((current) => ({ ...current, amount }))} />
        <div className="toggle-group wide">
          <button className={draft.kind === "once" ? "active" : ""} onClick={() => setDraft((current) => ({ ...current, kind: "once" }))}>한 번</button>
          <button className={draft.kind === "monthly" ? "active" : ""} onClick={() => setDraft((current) => ({ ...current, kind: "monthly" }))}>매달</button>
        </div>
        <div className="toggle-group wide three">
          {([0, 1, "both"] as Owner[]).map((owner) => (
            <button key={String(owner)} className={draft.owner === owner ? "active" : ""} onClick={() => setDraft((current) => ({ ...current, owner }))}>{ownerName(owner)}</button>
          ))}
        </div>
        {draft.amount > 0 && (
          <div className={`verdict ${preview.tone}`}>
            <b>{preview.title}</b>
            <p>{preview.detail}</p>
          </div>
        )}
        <button
          className="primary"
          disabled={!draft.name.trim() || draft.amount <= 0}
          onClick={() => {
            onChange([{ ...draft, name: draft.name.trim() }, ...wishes]);
            setDraft({ id: newId("w"), name: "", amount: 0, kind: draft.kind, owner: draft.owner });
          }}
        >
          목록에 담기
        </button>
      </section>

      {wishes.length > 0 && (
        <section className="card">
          <h3 className="card-title">담아 둔 것</h3>
          <ul className="wish-list">
            {wishes.map((wish) => {
              const verdict = judgeWish(wish, flow);
              return (
                <li key={wish.id}>
                  <div className="wish-head">
                    <span>
                      <b>{wish.name}</b>
                      <small>{ownerName(wish.owner)} · {wish.kind === "once" ? "한 번" : "매달"} {won(wish.amount)}</small>
                    </span>
                    <em className={verdict.tone}>{verdict.title}</em>
                  </div>
                  <p className="muted small">{verdict.detail}</p>
                  <div className="wish-actions">
                    {wish.kind === "monthly" ? (
                      <button onClick={() => onMoveToFixed({ id: newId("f"), name: wish.name, amount: wish.amount, owner: wish.owner, category: "배움·운동", day: 1 }, wish.id)}>
                        시작했어요 · 고정지출로 옮기기
                      </button>
                    ) : (
                      <button onClick={() => onChange(wishes.filter((item) => item.id !== wish.id))}>했어요 · 목록에서 빼기</button>
                    )}
                    <button className="ghost" onClick={() => onChange(wishes.filter((item) => item.id !== wish.id))}>지우기</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
