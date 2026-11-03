"use client";

import { useState } from "react";
import { MoneyField, won } from "./fields";
import { FIXED_CATEGORIES, newId, type FixedCategory, type FixedCost, type Owner } from "./lib/plan";

// 고정지출: 매달 나가는 돈을 각자 · 공동으로 한 번 적어 둔다. 금액이 바뀔 때만 고친다.

const OWNERS: Owner[] = [0, 1, "both"];

export function FixedBoard({
  items,
  names,
  onChange,
}: {
  items: FixedCost[];
  names: [string, string];
  onChange: (items: FixedCost[]) => void;
}) {
  const [editing, setEditing] = useState<FixedCost | null>(null);
  const ownerName = (owner: Owner) => (owner === "both" ? "공동" : names[owner]);
  const total = (owner: Owner) => items.filter((item) => item.owner === owner).reduce((sum, item) => sum + item.amount, 0);

  const save = (item: FixedCost) => {
    const exists = items.some((current) => current.id === item.id);
    onChange(exists ? items.map((current) => (current.id === item.id ? item : current)) : [...items, item]);
    setEditing(null);
  };

  return (
    <div className="content">
      <section className="summary-main">
        <span>매달 나가는 고정지출</span>
        <strong>{won(items.reduce((sum, item) => sum + item.amount, 0))}</strong>
        <small>{OWNERS.map((owner) => `${ownerName(owner)} ${won(total(owner))}`).join(" · ")}</small>
      </section>

      {OWNERS.map((owner) => {
        const list = items.filter((item) => item.owner === owner).sort((a, b) => a.day - b.day);
        return (
          <section key={String(owner)} className="card">
            <div className="card-head">
              <h3 className="card-title">{ownerName(owner)}</h3>
              <b>{won(total(owner))}</b>
            </div>
            {list.length === 0 && <p className="muted small">아직 없어요.</p>}
            <ul className="row-list">
              {list.map((item) => (
                <li key={item.id}>
                  <button onClick={() => setEditing(item)}>
                    <span>
                      <b>{item.name}</b>
                      <small>{item.category} · 매달 {item.day}일</small>
                    </span>
                    <strong>{won(item.amount)}</strong>
                  </button>
                </li>
              ))}
            </ul>
            <button className="text-button" onClick={() => setEditing({ id: newId("f"), name: "", amount: 0, owner, category: owner === "both" ? "주거" : "구독", day: 1 })}>
              + {ownerName(owner)} 고정지출 추가
            </button>
          </section>
        );
      })}

      {editing && (
        <FixedEditor
          item={editing}
          names={names}
          isNew={!items.some((item) => item.id === editing.id)}
          onSave={save}
          onDelete={() => {
            onChange(items.filter((item) => item.id !== editing.id));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function FixedEditor({
  item,
  names,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  item: FixedCost;
  names: [string, string];
  isNew: boolean;
  onSave: (item: FixedCost) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(item);
  const update = (patch: Partial<FixedCost>) => setDraft((current) => ({ ...current, ...patch }));
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet" role="dialog" aria-label="고정지출 고치기" onClick={(event) => event.stopPropagation()}>
        <h3 className="card-title">{isNew ? "고정지출 추가" : "고정지출 고치기"}</h3>
        <label className="field">
          <span>이름</span>
          <input className="plain-input" value={draft.name} maxLength={40} placeholder="예: 넷플릭스, 필라테스" onChange={(event) => update({ name: event.target.value })} />
        </label>
        <MoneyField label="매달 금액" value={draft.amount} onChange={(amount) => update({ amount })} />
        <div className="toggle-group wide three">
          {OWNERS.map((owner) => (
            <button key={String(owner)} className={draft.owner === owner ? "active" : ""} onClick={() => update({ owner })}>
              {owner === "both" ? "공동" : names[owner]}
            </button>
          ))}
        </div>
        <div className="chip-row">
          {FIXED_CATEGORIES.map((category: FixedCategory) => (
            <button key={category} className={draft.category === category ? "active" : ""} onClick={() => update({ category })}>{category}</button>
          ))}
        </div>
        <label className="field">
          <span>매달 빠져나가는 날</span>
          <select className="plain-input" value={draft.day} onChange={(event) => update({ day: Number(event.target.value) })}>
            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day}일</option>)}
          </select>
        </label>
        <button className="primary" disabled={!draft.name.trim() || draft.amount <= 0} onClick={() => onSave({ ...draft, name: draft.name.trim() })}>저장</button>
        {!isNew && (
          <button className="danger" onClick={() => { if (confirm(`${item.name}을(를) 지울까요?`)) onDelete(); }}>지우기</button>
        )}
      </section>
    </div>
  );
}
