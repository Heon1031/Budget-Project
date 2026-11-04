"use client";

import { useState } from "react";
import { Plus, Trash2, TriangleAlert, Check, Settings2, User } from "lucide-react";
import { BUCKET_ICON_MAP, bucketColor } from "./charts";
import { RateInput, shortWon, won } from "./fields";
import { BUCKET_ICONS, BUCKET_TEMPLATE, newId, type Bucket, type BucketIcon, type BucketKind, type Flow, type Person } from "./lib/plan";

// 나누기: 각자 실수령을 바구니(%)로 나누고, 바구니 안에 매달 나가는 항목을 담는다.

const KIND_LABEL: Record<BucketKind, string> = { save: "모으기", spend: "쓰기", free: "용돈" };

export function BucketBoard({
  people,
  flow,
  names,
  me,
  onPerson,
}: {
  people: [Person, Person];
  flow: Flow;
  names: [string, string];
  me: 0 | 1;
  onPerson: (index: 0 | 1, patch: Partial<Person>) => void;
}) {
  const [who, setWho] = useState<0 | 1>(me);
  const [editing, setEditing] = useState<Bucket | null>(null);
  const person = people[who];
  const pf = flow.people[who];
  const setBuckets = (buckets: Bucket[]) => onPerson(who, { buckets });
  const updateBucket = (id: string, patch: Partial<Bucket>) => setBuckets(person.buckets.map((bucket) => (bucket.id === id ? { ...bucket, ...patch } : bucket)));
  const over = pf.allocatedPercent > 100.05;

  return (
    <div className="content">
      <div className="toggle-group wide">
        {([0, 1] as const).map((index) => (
          <button key={index} className={who === index ? "active" : ""} onClick={() => setWho(index)}><User size={15} /> {names[index]}</button>
        ))}
      </div>

      <section className="summary-main">
        <span className="hero-label">{names[who]} 월 실수령</span>
        <strong>{won(pf.net)}</strong>
        <div className="alloc-bar" role="img" aria-label={pf.buckets.map((b) => `${b.name} ${b.percent}%`).join(", ")}>
          {pf.buckets.map((bucket, index) => (
            <span key={bucket.id} style={{ flexGrow: Math.max(0, bucket.percent), background: bucketColor(index) }} title={`${bucket.name} ${bucket.percent}%`} />
          ))}
          {pf.allocatedPercent < 100 && <span className="rest" style={{ flexGrow: 100 - pf.allocatedPercent }} />}
        </div>
        <p className={`hero-note ${over ? "bad" : ""}`}>
          {over ? <TriangleAlert size={14} /> : <Check size={14} />}
          {over ? `${Math.round(pf.allocatedPercent)}% · 100%를 넘었어요` : pf.allocatedPercent < 99.95 ? `${Math.round(pf.allocatedPercent)}% 나눔 · 남은 ${shortWon(pf.unallocated)}` : "100% 다 나눴어요"}
        </p>
      </section>

      {pf.buckets.map((bucket, index) => {
        const Icon = BUCKET_ICON_MAP[bucket.icon];
        return (
          <section key={bucket.id} className="card bucket-card" style={{ ["--bucket-color" as string]: bucketColor(index) }}>
            <div className="bucket-head">
              <span className="bucket-icon"><Icon size={18} /></span>
              <span className="bucket-title">
                <b>{bucket.name}</b>
                <small>{KIND_LABEL[bucket.kind]} · {won(bucket.budget)}</small>
              </span>
              <label className="bucket-percent"><RateInput value={bucket.percent} onChange={(percent) => updateBucket(bucket.id, { percent: Math.min(100, percent) })} /><b>%</b></label>
              <button className="icon-close" aria-label={`${bucket.name} 바구니 고치기`} onClick={() => setEditing(person.buckets[index])}><Settings2 size={18} /></button>
            </div>
            <i className={`hbar ${bucket.left < 0 ? "bad" : ""}`} aria-hidden="true"><span style={{ width: `${bucket.budget > 0 ? Math.min(100, (bucket.planned / bucket.budget) * 100) : bucket.planned > 0 ? 100 : 0}%`, background: bucket.left < 0 ? undefined : "var(--bucket-color)" }} /></i>
            <p className={`bucket-left ${bucket.left < 0 ? "bad" : ""}`}>
              {bucket.items.length === 0 ? (bucket.kind === "free" ? `마음 편히 쓸 돈 ${won(bucket.budget)}` : "항목 없음") : bucket.left < 0 ? `${won(-bucket.left)} 넘침` : `정한 것 ${shortWon(bucket.planned)} · 남음 ${shortWon(bucket.left)}`}
            </p>
            <ul className="item-list">
              {bucket.items.map((item) => (
                <li key={item.id}>
                  <input
                    className="item-name"
                    value={item.name}
                    maxLength={40}
                    aria-label="항목 이름"
                    onChange={(event) => updateBucket(bucket.id, { items: bucket.items.map((it) => (it.id === item.id ? { ...it, name: event.target.value } : it)) })}
                  />
                  <span className="item-amount">
                    <input
                      inputMode="numeric"
                      aria-label={`${item.name} 금액`}
                      value={item.amount ? item.amount.toLocaleString("ko-KR") : ""}
                      placeholder="0"
                      onChange={(event) => updateBucket(bucket.id, { items: bucket.items.map((it) => (it.id === item.id ? { ...it, amount: Number(event.target.value.replace(/[^\d]/g, "")) || 0 } : it)) })}
                    />
                    <b>원</b>
                  </span>
                  <button className="icon-ghost" aria-label={`${item.name} 지우기`} onClick={() => updateBucket(bucket.id, { items: bucket.items.filter((it) => it.id !== item.id) })}><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
            <button className="add-button" onClick={() => updateBucket(bucket.id, { items: [...bucket.items, { id: newId("i"), name: "", amount: 0 }] })}><Plus size={16} /> 항목</button>
          </section>
        );
      })}

      <div className="bucket-tools">
        <button className="add-button" onClick={() => setBuckets([...person.buckets, { id: newId("b"), name: "새 바구니", icon: "sparkles", kind: "spend", percent: 0, items: [] }])}><Plus size={16} /> 바구니 추가</button>
        <button className="text-button" onClick={() => {
          if (confirm(`${names[who]}의 바구니 비율을 40·35·15·7·3으로 맞출까요? 항목은 그대로 둬요.`)) {
            setBuckets(person.buckets.map((bucket) => {
              const template = BUCKET_TEMPLATE.find((t) => t.id === bucket.id);
              return template ? { ...bucket, percent: template.percent } : bucket;
            }));
          }
        }}>기본 비율로</button>
      </div>

      {editing && (
        <BucketEditor
          bucket={editing}
          onSave={(next) => {
            updateBucket(next.id, next);
            setEditing(null);
          }}
          onDelete={() => {
            setBuckets(person.buckets.filter((bucket) => bucket.id !== editing.id));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function BucketEditor({ bucket, onSave, onDelete, onClose }: { bucket: Bucket; onSave: (bucket: Bucket) => void; onDelete: () => void; onClose: () => void }) {
  const [draft, setDraft] = useState(bucket);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet" role="dialog" aria-label="바구니 고치기" onClick={(event) => event.stopPropagation()}>
        <h3 className="card-title">바구니 고치기</h3>
        <label className="field">
          <span>이름</span>
          <input className="plain-input" value={draft.name} maxLength={20} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </label>
        <div className="toggle-group wide three">
          {(["save", "spend", "free"] as BucketKind[]).map((kind) => (
            <button key={kind} className={draft.kind === kind ? "active" : ""} onClick={() => setDraft({ ...draft, kind })}>{KIND_LABEL[kind]}</button>
          ))}
        </div>
        <div className="chip-row">
          {BUCKET_ICONS.map((icon: BucketIcon) => {
            const Icon = BUCKET_ICON_MAP[icon];
            return <button key={icon} aria-label={icon} className={draft.icon === icon ? "active" : ""} onClick={() => setDraft({ ...draft, icon })}><Icon size={16} /></button>;
          })}
        </div>
        <button className="primary" disabled={!draft.name.trim()} onClick={() => onSave({ ...draft, name: draft.name.trim() })}>저장</button>
        <button className="danger" onClick={() => { if (confirm(`${bucket.name} 바구니를 지울까요? 안의 항목도 지워져요.`)) onDelete(); }}>바구니 지우기</button>
      </section>
    </div>
  );
}
