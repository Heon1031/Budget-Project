"use client";

import { useState } from "react";
import { CalendarDays, Plus, User, Users } from "lucide-react";
import { Bar, CATEGORY_ICONS } from "./charts";
import { MoneyField, shortWon, won } from "./fields";
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
  const grand = items.reduce((sum, item) => sum + item.amount, 0);
  const byCategory = FIXED_CATEGORIES.map((category) => [category, items.filter((item) => item.category === category).reduce((sum, item) => sum + item.amount, 0)] as const)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);

  const save = (item: FixedCost) => {
    const exists = items.some((current) => current.id === item.id);
    onChange(exists ? items.map((current) => (current.id === item.id ? item : current)) : [...items, item]);
    setEditing(null);
  };

  return (
    <div className="content">
      <section className="summary-main">
        <span className="hero-label"><CalendarDays size={16} /> 매달 고정지출</span>
        <strong>{won(grand)}</strong>
        <div className="hero-chips">
          {OWNERS.map((owner) => {
            const Icon = owner === "both" ? Users : User;
            return <span key={String(owner)}><Icon size={14} /> {ownerName(owner)} {shortWon(total(owner))}</span>;
          })}
        </div>
      </section>

      {byCategory.length > 0 && (
        <section className="card">
          <ul className="cat-bars">
            {byCategory.map(([category, amount]) => {
              const Icon = CATEGORY_ICONS[category];
              return (
                <li key={category}>
                  <span className="icon-dot"><Icon size={16} /></span>
                  <span className="cat-name">{category}</span>
                  <Bar value={amount} max={byCategory[0][1]} />
                  <b>{shortWon(amount)}</b>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {OWNERS.map((owner) => {
        const list = items.filter((item) => item.owner === owner).sort((a, b) => a.day - b.day);
        const OwnerIcon = owner === "both" ? Users : User;
        return (
          <section key={String(owner)} className="card">
            <div className="card-head">
              <h3 className="card-title"><OwnerIcon size={18} /> {ownerName(owner)}</h3>
              <b>{won(total(owner))}</b>
            </div>
            <ul className="row-list">
              {list.map((item) => {
                const Icon = CATEGORY_ICONS[item.category];
                return (
                  <li key={item.id}>
                    <button onClick={() => setEditing(item)}>
                      <span className="icon-dot"><Icon size={16} /></span>
                      <span>
                        <b>{item.name}</b>
                        <small>매달 {item.day}일</small>
                      </span>
                      <strong>{won(item.amount)}</strong>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button className="add-button" onClick={() => setEditing({ id: newId("f"), name: "", amount: 0, owner, category: owner === "both" ? "주거" : "구독", day: 1 })}>
              <Plus size={16} /> 추가
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
            <button key={category} className={draft.category === category ? "active" : ""} onClick={() => update({ category })}>
              {(() => { const Icon = CATEGORY_ICONS[category]; return <Icon size={14} />; })()} {category}
            </button>
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
