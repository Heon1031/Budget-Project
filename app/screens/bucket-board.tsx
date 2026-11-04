"use client";

import { useState } from "react";
import { Plus, Trash2, TriangleAlert, Check, ChevronDown, Settings2, User } from "lucide-react";
import { BUCKET_ICON_MAP, bucketColor } from "./charts";
import { AmountInput, RateInput, SnapSlider, shortWon, won } from "./fields";
import { BUCKET_ICONS, BUCKET_TEMPLATE, initialState, newId, type Bucket, type BucketIcon, type BucketItem, type BucketKind, type Flow, type Person } from "../lib/calc/plan";

// 처음 들어 있던 예시 항목을 그대로 두었는지(이름 · 금액이 예시와 같음).
const isExampleItem = (who: 0 | 1, bucketId: string, item: BucketItem) =>
  initialState.people[who].buckets.some((bucket) => bucket.id === bucketId && bucket.items.some((it) => it.id === item.id && it.name === item.name && it.amount === item.amount));

// 막대 위 · 아래 글자 자리: 양 끝에서는 안쪽으로 붙여 잘리지 않게.
const tagAt = (at: number) =>
  at > 82 ? { right: `${Math.max(0, 100 - at)}%` } : at < 18 ? { left: `${Math.max(0, at)}%` } : { left: `${at}%`, transform: "translateX(-50%)" };

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
  // 항목 목록은 접어 두고, 누른 바구니만 연다. 비율만 만질 때는 카드가 짧아 스크롤이 적다.
  const [openIds, setOpenIds] = useState<string[]>([]);
  const toggleOpen = (id: string) => setOpenIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
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

      {/* 스크롤해도 위에 붙어 있는 전체 비율: 100%를 넘으면 넘은 만큼 빨갛게 */}
      <div className={`alloc-sticky ${over ? "over" : pf.allocatedPercent < 99.95 ? "under" : "done"}`} role="status" aria-live="polite">
        <div className="alloc-sticky-head">
          <b>{names[who]} 합계 {Math.round(pf.allocatedPercent)}%</b>
          <span>
            {over
              ? <><TriangleAlert size={14} /> {Math.round(pf.allocatedPercent - 100)}% 넘음 · {shortWon(pf.net * (pf.allocatedPercent - 100) / 100)}</>
              : pf.allocatedPercent < 99.95
                ? <>{Math.round(100 - pf.allocatedPercent)}% 남음 · {shortWon(pf.unallocated)}</>
                : <><Check size={14} /> 딱 100%</>}
          </span>
        </div>
        <div className="alloc-bar" role="img" aria-label={pf.buckets.map((b) => `${b.name} ${b.percent}%`).join(", ")}>
          {pf.buckets.map((bucket, index) => (
            <span key={bucket.id} style={{ flexGrow: Math.max(0, bucket.percent), background: bucketColor(index) }} title={`${bucket.name} ${bucket.percent}%`} />
          ))}
          {pf.allocatedPercent < 100 && <span className="rest" style={{ flexGrow: 100 - pf.allocatedPercent }} />}
          {over && <i className="over-zone" style={{ left: `${(100 / pf.allocatedPercent) * 100}%` }} />}
        </div>
      </div>

      <section className="summary-main">
        <span className="hero-label">{names[who]} 월 실수령</span>
        <strong>{won(pf.net)}</strong>
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
            <SnapSlider label={`${bucket.name} 비율`} value={bucket.percent} onChange={(percent) => updateBucket(bucket.id, { percent })} />
            <button className="items-toggle" aria-expanded={openIds.includes(bucket.id)} onClick={() => toggleOpen(bucket.id)}>
              <span>항목 {bucket.items.length}개 · {shortWon(bucket.planned)} 담음</span>
              <ChevronDown size={18} />
            </button>
            {openIds.includes(bucket.id) && <div className="items-body">
            {(() => {
              // 지금 담은 돈이 실수령의 몇 %인지(막대 위), 목표 바구니 %(막대 아래 눈금)를 그래프에 바로 적는다.
              const nowPercent = pf.net > 0 ? (bucket.planned / pf.net) * 100 : 0;
              const scale = Math.max(bucket.percent, nowPercent, 1);
              const goalAt = (bucket.percent / scale) * 100;
              const short = bucket.kind === "save" && bucket.left > 0;
              return (
                <>
                  <div className="goal-graph" role="img" aria-label={`담은 돈 ${Math.round(nowPercent)}%, 목표 ${bucket.percent}%`}>
                    <span className="goal-tag now" style={tagAt((nowPercent / scale) * 100)}>담은 <b>{Math.round(nowPercent)}%</b></span>
                    <div className="goal-bar">
                      <span className={bucket.left < 0 && bucket.kind !== "save" ? "over" : ""} style={{ width: `${(nowPercent / scale) * 100}%` }} />
                      <i style={{ left: `${goalAt}%` }} />
                    </div>
                    <span className="goal-tag goal" style={tagAt(goalAt)}>목표 {bucket.percent}%</span>
                  </div>
                  <p className="goal-text">
                    <b className={short ? "warn" : bucket.left < 0 && bucket.kind !== "save" ? "bad" : "good"}>
                      {bucket.kind === "save"
                        ? short ? `+${shortWon(bucket.left)} 더 담으면 채워요` : "목표 달성"
                        : bucket.left < 0 ? `${shortWon(-bucket.left)} 넘침` : bucket.kind === "free" ? `쓸 돈 ${shortWon(bucket.left)}` : `남음 ${shortWon(bucket.left)}`}
                    </b>
                  </p>
                </>
              );
            })()}
            <ul className="item-list">
              {bucket.items.map((item) => {
                const example = isExampleItem(who, bucket.id, item);
                return (
                <li key={item.id} className={example ? "is-example" : ""}>
                  <input
                    className="item-name"
                    value={example ? "" : item.name}
                    placeholder={example ? item.name : "항목 이름"}
                    maxLength={40}
                    aria-label="항목 이름"
                    onChange={(event) => updateBucket(bucket.id, { items: bucket.items.map((it) => (it.id === item.id ? { ...it, name: event.target.value } : it)) })}
                  />
                  <span className="item-amount">
                    <AmountInput
                      label={`${item.name} 금액`}
                      value={item.amount}
                      example={example}
                      onChange={(amount) => updateBucket(bucket.id, { items: bucket.items.map((it) => (it.id === item.id ? { ...it, amount } : it)) })}
                    />
                  </span>
                  <button className="icon-ghost" aria-label={`${item.name} 지우기`} onClick={() => updateBucket(bucket.id, { items: bucket.items.filter((it) => it.id !== item.id) })}><Trash2 size={16} /></button>
                </li>
                );
              })}
            </ul>
            <button className="add-button" onClick={() => updateBucket(bucket.id, { items: [...bucket.items, { id: newId("i"), name: "", amount: 0 }] })}><Plus size={16} /> 항목</button>
            </div>}
          </section>
        );
      })}

      <div className="bucket-tools">
        <button className="add-button" onClick={() => setBuckets([...person.buckets, { id: newId("b"), name: "새 바구니", icon: "sparkles", kind: "spend", percent: 0, items: [] }])}><Plus size={16} /> 바구니 추가</button>
        <button className="text-button" onClick={() => {
          if (confirm(`${names[who]}의 바구니 비율을 50·25·15·7·3으로 맞출까요? 항목은 그대로 둬요.`)) {
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
