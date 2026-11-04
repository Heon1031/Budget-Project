import type { PersonFlow } from "./plan";

// 「기준 계획」(마지막으로 「다 바꿨어요」를 누른 때)과 지금 계획을 비교해 실제로 바꿀 일을 순서대로 정리한다.
// 통장 쪼개기 흐름: 월급 → 바구니 통장(자동이체) → 항목(적금 · 카드 · 구독).
//  - 바구니 돈을 줄일 때: 항목을 먼저 줄이고 → 월급날 자동이체를 나중에(먼저 줄이면 바구니 통장 잔액이 모자람)
//  - 늘릴 때: 월급날 자동이체를 먼저 늘리고 → 항목을 나중에
//  - 바구니는 줄었는데 항목 합이 그대로면 「줄일 항목을 골라야 해요」를 맨 위에
// 앱은 은행 앱 안을 볼 수 없으니 줄마다 체크칸은 두지 않는다(거짓 상태가 생김). 다 했으면 「다 바꿨어요」 한 번.
// 2026-11-04 다섯 역할(반대 · 개선 · 부부 · 금융 실무 · UX) 검토를 거쳐 정함.

export type ConfirmedPlan = {
  at: string; // 기준으로 삼은 날 YYYY-MM-DD
  // 되돌리기에 쓰려고 비율 · 종류 · 아이콘도 같이 둔다. budget은 그날 실수령 기준 금액.
  buckets: { id: string; name: string; icon: string; kind: "save" | "spend" | "free"; percent: number; budget: number; items: { id: string; name: string; amount: number }[] }[];
};

export type ChangeLine = { id: string; text: string; where: string; note?: string; delta: number; tone?: "warn" };
export type ChangeGroup = { id: string; title: string; before: number; after: number; lines: ChangeLine[] };

const MIN_GAP = 10_000; // 1만 원 밑 차이는 반올림 차이로 보고 넘긴다

export function snapshotPlan(pf: PersonFlow, at: string): ConfirmedPlan {
  return {
    at,
    buckets: pf.buckets.map((bucket) => ({
      id: bucket.id,
      name: bucket.name,
      icon: bucket.icon,
      kind: bucket.kind,
      percent: bucket.percent,
      budget: bucket.budget,
      items: bucket.items.map((item) => ({ id: item.id, name: item.name, amount: item.amount })),
    })),
  };
}

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0);
const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");

// 저장값을 믿지 않고 모양을 다시 맞춘다(예전 저장값 · 상대 폰 값이 깨져 있어도 앱이 멈추지 않게).
export function cleanConfirmed(raw: unknown): ConfirmedPlan | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const data = raw as Partial<ConfirmedPlan>;
  if (typeof data.at !== "string" || !Array.isArray(data.buckets)) return undefined;
  return {
    at: data.at.slice(0, 10),
    buckets: data.buckets.flatMap((bucket) => {
      const b = (bucket ?? {}) as Partial<ConfirmedPlan["buckets"][number]>;
      if (typeof b.id !== "string") return [];
      const items = Array.isArray(b.items)
        ? b.items.flatMap((item) => (item && typeof item.id === "string" ? [{ id: item.id, name: text(item.name, 40), amount: num(item.amount) }] : []))
        : [];
      const percent = typeof b.percent === "number" && Number.isFinite(b.percent) ? Math.min(100, Math.max(0, b.percent)) : 0;
      const kind = b.kind === "save" || b.kind === "free" ? b.kind : "spend";
      return [{ id: b.id, name: text(b.name, 20), icon: text(b.icon, 20), kind, percent, budget: num(b.budget), items }];
    }),
  };
}

// 항목 이름으로 「어디서 바꾸는지」와 주의할 점을 짐작한다. 짐작이라 「~일 거예요」 정도로만 쓰고, 모르면 일반 안내.
export function whereToChange(name: string): { where: string; note?: string } {
  if (/청약/.test(name)) return { where: "은행 앱 · 자동이체", note: "월 납입 인정 한도가 있어요. 한도 넘는 돈은 인정 안 될 수 있어요(확인 필요)." };
  if (/적금/.test(name)) return { where: "은행 앱 · 자동이체", note: "정기적금은 금액을 못 바꿔요. 해지하면 이자 손해라 그대로 두고 다른 항목을 바꾸는 게 나을 수 있어요. 자유적금은 금액만 바꾸면 돼요." };
  if (/연금|IRP/i.test(name)) return { where: "증권 · 은행 앱", note: "세액공제 한도를 넘는지 확인해 보세요." };
  if (/예금|파킹|비상금|저금/.test(name)) return { where: "은행 앱 · 자동이체" };
  if (/주식|펀드|ETF|ISA|코인|비트|투자|모으기/i.test(name)) return { where: "증권 앱 · 모으기(자동투자)", note: "보통 다음 이체일부터 바뀌어요." };
  if (/보험/.test(name)) return { where: "보험사 앱 · 설계사", note: "줄이면 보장이 바뀔 수 있어요." };
  if (/통신|휴대폰|핸드폰|폰|인터넷/.test(name)) return { where: "통신사 앱 · 요금제" };
  if (/구독|넷플|유튜브|OTT|멜론|쿠팡|디즈니|티빙|웨이브/i.test(name)) return { where: "앱 구독 관리" };
  if (/학원|운동|헬스|필라테스|PT|요가|수영|레슨|피부/i.test(name)) return { where: "다음 결제 · 등록 전" };
  if (/공동|모임/.test(name)) return { where: "모임 통장 · 자동이체" };
  return { where: "결제 · 자동이체 금액" };
}

const won = (value: number) => {
  const abs = Math.abs(Math.round(value));
  if (abs >= 10_000) return `${Math.round(abs / 10_000).toLocaleString("ko-KR")}만`;
  return `${abs.toLocaleString("ko-KR")}원`;
};
const signed = (value: number) => `${value > 0 ? "+" : "-"}${won(value)}`;

export function diffPlan(confirmed: ConfirmedPlan, pf: PersonFlow): ChangeGroup[] {
  const groups: ChangeGroup[] = [];
  const before = new Map(confirmed.buckets.map((bucket) => [bucket.id, bucket]));

  for (const bucket of pf.buckets) {
    const old = before.get(bucket.id);
    before.delete(bucket.id);
    const oldBudget = old?.budget ?? 0;
    const gap = bucket.budget - oldBudget;

    const transfer: ChangeLine[] =
      Math.abs(gap) >= MIN_GAP
        ? [{ id: `${bucket.id}-move`, text: `월급날 ${bucket.name} 통장으로 ${won(oldBudget)} → ${won(bucket.budget)}`, where: "월급 통장 · 자동이체", delta: gap }]
        : [];

    const items: ChangeLine[] = [];
    const oldItems = new Map((old?.items ?? []).map((item) => [item.id, item]));
    for (const item of bucket.items) {
      const was = oldItems.get(item.id);
      oldItems.delete(item.id);
      const label = item.name || "이름 없는 항목";
      const hint = whereToChange(label);
      if (!was) {
        if (item.amount >= MIN_GAP) items.push({ id: item.id, text: `${label} 새로 시작 · 월 ${won(item.amount)}`, ...hint, delta: item.amount });
      } else if (Math.abs(item.amount - was.amount) >= MIN_GAP) {
        items.push({ id: item.id, text: `${label} ${won(was.amount)} → ${won(item.amount)}`, ...hint, delta: item.amount - was.amount });
      }
    }
    for (const gone of oldItems.values()) {
      if (gone.amount >= MIN_GAP) items.push({ id: gone.id, text: `${gone.name || "항목"} 그만하기 · 월 ${won(gone.amount)}`, ...whereToChange(gone.name), delta: -gone.amount });
    }

    // 바구니는 줄였는데 항목 합이 새 바구니 돈보다 많으면, 무엇을 줄일지 먼저 정해야 한다.
    const lines: ChangeLine[] = [];
    if (bucket.kind !== "save" && bucket.planned - bucket.budget >= MIN_GAP && gap < 0) {
      lines.push({
        id: `${bucket.id}-pick`,
        text: `항목 합이 바구니보다 ${won(bucket.planned - bucket.budget)} 많아요. 줄일 항목을 먼저 골라 주세요`,
        where: "아래 항목 펼쳐서 고치기",
        delta: 0,
        tone: "warn",
      });
    }
    // 줄일 때는 항목 → 이체, 늘릴 때는 이체 → 항목.
    lines.push(...(gap < 0 ? [...items, ...transfer] : [...transfer, ...items]));

    if (lines.length) groups.push({ id: bucket.id, title: old ? bucket.name : `${bucket.name} (새 바구니)`, before: oldBudget, after: bucket.budget, lines });
  }
  for (const gone of before.values()) {
    if (gone.budget >= MIN_GAP) {
      groups.push({
        id: gone.id,
        title: `${gone.name} (없앤 바구니)`,
        before: gone.budget,
        after: 0,
        lines: [{ id: `${gone.id}-move`, text: `월급날 ${gone.name} 통장으로 보내던 ${won(gone.budget)} 멈추기`, where: "월급 통장 · 자동이체", delta: -gone.budget }],
      });
    }
  }
  return groups;
}

export const changeCount = (groups: ChangeGroup[]) => groups.reduce((sum, group) => sum + group.lines.length, 0);
export { signed as signedShort };
