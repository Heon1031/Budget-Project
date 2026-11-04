"use client";

import { ArrowDownRight, ArrowUpRight, ClipboardCheck, Flag, TriangleAlert, Undo2 } from "lucide-react";
import type { ChangeGroup, ConfirmedPlan } from "../lib/calc/changes";
import { shortWon } from "./fields";

// 나누기 「바꿀 일」 카드: 기준 계획과 비교해 은행 · 증권 앱에서 바꿀 일을 순서(번호)대로.
// 카드 하나에 주 버튼 하나(「다 바꿨어요」). 되돌리기는 글자 버튼 + 확인.

const dateText = (at: string) => {
  const [, m, d] = at.split("-").map(Number);
  return m && d ? `${m}월 ${d}일` : at;
};

export function ChangesCard({
  confirmed,
  groups,
  onConfirm,
  onRevert,
}: {
  confirmed?: ConfirmedPlan;
  groups: ChangeGroup[];
  onConfirm: () => void;
  onRevert: () => void;
}) {
  if (!confirmed) {
    return (
      <section className="card changes-card start" id="changes">
        <span className="changes-icon"><Flag size={18} /></span>
        <div>
          <b>지금 계획을 기준으로 정해 둘까요?</b>
          <p>다음에 비율을 바꾸면, 은행 앱에서 바꿀 일을 순서대로 알려 드려요.</p>
        </div>
        <button className="primary" onClick={onConfirm}>지금 계획을 기준으로</button>
      </section>
    );
  }

  if (groups.length === 0) {
    return <p className="changes-none" id="changes"><ClipboardCheck size={14} /> 기준({dateText(confirmed.at)})과 같아요 · 바꿀 일 없음</p>;
  }

  // 번호는 경고 줄을 빼고 전체에서 1, 2, 3… (렌더 중에 값을 바꾸지 않게 미리 계산)
  const warnBefore = groups.flatMap((group) => group.lines).map((line, index, all) => index + 1 - all.slice(0, index + 1).filter((l) => l.tone === "warn").length);
  const offsets = groups.map((_, index) => groups.slice(0, index).reduce((sum, group) => sum + group.lines.length, 0));
  const saveDelta = groups.reduce((sum, group) => sum + (group.after - group.before), 0);
  return (
    <section className="card changes-card" id="changes">
      <div className="changes-head">
        <span className="changes-icon"><ClipboardCheck size={18} /></span>
        <div>
          <b>바꿀 일 {groups.reduce((sum, group) => sum + group.lines.length, 0)}개</b>
          <small>기준 {dateText(confirmed.at)}과 비교 · 위에서부터 차례로</small>
        </div>
      </div>

      {groups.map((group, groupIndex) => {
        const max = Math.max(group.before, group.after, 1);
        const down = group.after < group.before;
        return (
          <div key={group.id} className="change-group">
            <div className="change-group-head">
              <b>{group.title}</b>
              <span className={down ? "down" : "up"}>
                {down ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                {shortWon(group.before)} → {shortWon(group.after)}
              </span>
            </div>
            {/* 전(회색) · 후(색) 두 줄 막대: 같은 눈금 */}
            <div className="change-bars" aria-hidden="true">
              <i className="before" style={{ width: `${(group.before / max) * 100}%` }} />
              <i className={`after ${down ? "down" : "up"}`} style={{ width: `${(group.after / max) * 100}%` }} />
            </div>
            <ol>
              {group.lines.map((line, lineIndex) => {
                const step = warnBefore[offsets[groupIndex] + lineIndex];
                return (
                  <li key={line.id} className={line.tone === "warn" ? "warn" : ""}>
                    <span className="step-no">{line.tone === "warn" ? <TriangleAlert size={13} /> : step}</span>
                    <div>
                      <p>{line.text}</p>
                      <small className="where">{line.where}</small>
                      {line.note && <small className="note">{line.note}</small>}
                    </div>
                    {line.delta !== 0 && <b className={line.delta < 0 ? "down" : "up"}>{line.delta > 0 ? "+" : "-"}{shortWon(Math.abs(line.delta))}</b>}
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}

      <p className="changes-sum">월급날 보내는 돈 합계 {saveDelta === 0 ? "그대로" : `${saveDelta > 0 ? "+" : "-"}${shortWon(Math.abs(saveDelta))}`} · 바꾼 뒤 다음 이체일을 한 번 확인해 보세요</p>
      <button className="primary" onClick={onConfirm}>다 바꿨어요 · 새 기준으로</button>
      <button
        className="text-button changes-revert"
        onClick={() => {
          if (confirm(`${dateText(confirmed.at)} 기준 계획으로 되돌릴까요? 지금 바꾼 비율과 항목은 사라져요.`)) onRevert();
        }}
      >
        <Undo2 size={14} /> {dateText(confirmed.at)} 기준으로 되돌리기
      </button>
    </section>
  );
}
