"use client";

import { useState } from "react";
import { Check, Clock, ListPlus, Repeat, Sparkles, TriangleAlert, Trash2, User, Users, Zap, type LucideIcon } from "lucide-react";
import { Bar } from "./charts";
import { MoneyField, shortWon } from "./fields";
import { initialState, newId, type Flow, type Owner, type Wish } from "../lib/calc/plan";

// 해볼까?: 하고 싶은 것을 지금 해도 되는지 한 줄로, 쓸 돈 대비 얼마인지 막대로 보여 준다.

type Verdict = { tone: "yes" | "talk" | "no"; title: string; detail: string; free: number };

const TONE_ICON: Record<Verdict["tone"], LucideIcon> = { yes: Check, talk: Clock, no: TriangleAlert };

// 매달 하는 걸 시작하면 「자기관리」 바구니(없으면 첫 쓰기 바구니)에 담긴다. 그 바구니에 남은 돈을 먼저 쓴다.
function monthlyRoom(flow: Flow, owner: 0 | 1) {
  const person = flow.people[owner];
  const target = person.buckets.find((bucket) => bucket.id === "b-self") ?? person.buckets.find((bucket) => bucket.kind === "spend");
  return { name: target?.name ?? "바구니", left: Math.max(0, target?.left ?? 0) };
}

export function judgeWish(wish: Wish, flow: Flow): Verdict {
  const owners: (0 | 1)[] = wish.owner === "both" ? [0, 1] : [wish.owner];
  const free = owners.reduce<number>((sum, owner) => sum + flow.people[owner].free, 0);
  const yearCut = (cut: number) => `1년 −${shortWon(cut)}`;
  if (wish.amount <= 0) return { tone: "talk", title: "금액을 넣어 주세요", detail: "", free };
  if (wish.kind === "once") {
    if (free >= wish.amount) return { tone: "yes", title: "지금 돼요", detail: `남는 돈 ${shortWon(free - wish.amount)}`, free };
    if (free > 0) {
      const months = Math.ceil(wish.amount / free);
      return { tone: "talk", title: `${months}달 모으면 돼요`, detail: `지금 하면 ${yearCut(wish.amount - free)}`, free };
    }
    return { tone: "no", title: "지금은 어려워요", detail: `하려면 ${yearCut(wish.amount)}`, free };
  }
  const rooms = owners.map((owner) => monthlyRoom(flow, owner));
  const roomLeft = rooms.reduce((sum, room) => sum + room.left, 0);
  const room = roomLeft + free;
  if (roomLeft >= wish.amount) return { tone: "yes", title: `${rooms[0].name} 남은 돈으로 돼요`, detail: `${rooms[0].name} 남음 ${shortWon(roomLeft - wish.amount)}`, free: room };
  if (room >= wish.amount) return { tone: "yes", title: "매달 해도 돼요", detail: `쓸 돈 ${shortWon(free)} → ${shortWon(room - wish.amount)}`, free: room };
  return { tone: "no", title: "저축을 줄여야 해요", detail: yearCut((wish.amount - Math.max(0, room)) * 12), free: room };
}

function VerdictLine({ verdict, amount }: { verdict: Verdict; amount: number }) {
  const Icon = TONE_ICON[verdict.tone];
  return (
    <div className={`verdict-line ${verdict.tone}`}>
      <Icon size={18} />
      <span>
        <b>{verdict.title}</b>
        {verdict.detail && <small>{verdict.detail}</small>}
      </span>
      <Bar value={amount} max={Math.max(verdict.free, 1)} tone={amount > verdict.free ? "bad" : "brand"} />
    </div>
  );
}

export function WishBoard({
  wishes,
  flow,
  names,
  onChange,
  onStartMonthly,
}: {
  wishes: Wish[];
  flow: Flow;
  names: [string, string];
  onChange: (wishes: Wish[]) => void;
  onStartMonthly: (wish: Wish) => void;
}) {
  const [draft, setDraft] = useState<Wish>(() => ({ id: newId("w"), name: "", amount: 0, kind: "once", owner: 0 }));
  const ownerName = (owner: Owner) => (owner === "both" ? "둘이" : names[owner]);
  const ownerIcon = (owner: Owner) => (owner === "both" ? Users : User);

  return (
    <div className="content">
      <section className="card">
        <h3 className="card-title"><Sparkles size={18} /> 해볼까?</h3>
        <label className="field">
          <span>무엇을</span>
          <input className="plain-input" value={draft.name} maxLength={40} placeholder="피부과, 헬스 등록…" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <MoneyField label="얼마" value={draft.amount} onChange={(amount) => setDraft((current) => ({ ...current, amount }))} />
        <div className="toggle-group wide">
          <button className={draft.kind === "once" ? "active" : ""} onClick={() => setDraft((current) => ({ ...current, kind: "once" }))}><Zap size={15} /> 한 번</button>
          <button className={draft.kind === "monthly" ? "active" : ""} onClick={() => setDraft((current) => ({ ...current, kind: "monthly" }))}><Repeat size={15} /> 매달</button>
        </div>
        <div className="toggle-group wide three">
          {([0, 1, "both"] as Owner[]).map((owner) => {
            const Icon = ownerIcon(owner);
            return (
              <button key={String(owner)} className={draft.owner === owner ? "active" : ""} onClick={() => setDraft((current) => ({ ...current, owner }))}>
                <Icon size={15} /> {ownerName(owner)}
              </button>
            );
          })}
        </div>
        {draft.amount > 0 && <VerdictLine verdict={judgeWish(draft, flow)} amount={draft.amount} />}
        <button
          className="primary"
          disabled={!draft.name.trim() || draft.amount <= 0}
          onClick={() => {
            onChange([{ ...draft, name: draft.name.trim() }, ...wishes]);
            setDraft({ id: newId("w"), name: "", amount: 0, kind: draft.kind, owner: draft.owner });
          }}
        >
          <ListPlus size={18} /> 담기
        </button>
      </section>

      {wishes.length > 0 && (
        <section className="card">
          <ul className="wish-list">
            {wishes.map((wish) => {
              const verdict = judgeWish(wish, flow);
              const OwnerIcon = ownerIcon(wish.owner);
              return (
                <li key={wish.id} className={initialState.wishes.some((example) => example.id === wish.id) ? "is-example" : ""}>
                  <div className="wish-head">
                    <span>
                      <b>{wish.name}</b>
                      <small><OwnerIcon size={12} /> {ownerName(wish.owner)} · {wish.kind === "once" ? <Zap size={12} /> : <Repeat size={12} />} {shortWon(wish.amount)}</small>
                    </span>
                    <div className="icon-actions">
                      {wish.kind === "monthly" ? (
                        <button aria-label="시작했어요 · 바구니에 담기" title="바구니에 담기" onClick={() => onStartMonthly(wish)}>
                          <ListPlus size={18} />
                        </button>
                      ) : (
                        <button aria-label="했어요" title="했어요" onClick={() => onChange(wishes.filter((item) => item.id !== wish.id))}><Check size={18} /></button>
                      )}
                      <button aria-label="지우기" title="지우기" className="ghost" onClick={() => onChange(wishes.filter((item) => item.id !== wish.id))}><Trash2 size={18} /></button>
                    </div>
                  </div>
                  <VerdictLine verdict={verdict} amount={wish.amount} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
