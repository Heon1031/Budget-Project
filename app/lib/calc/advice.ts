import type { Bucket, PersonFlow } from "./plan";

// 나누기 「매니저 한마디」: 비율을 바꿀 때마다 지금 가장 중요한 한 가지를 쉬운 말로 알려 주고,
// 할 수 있으면 「바로 맞추기」로 바꿀 비율까지 내놓는다. 규칙 순서가 곧 중요도다.
//  1) 100%를 넘음 → 여유 있는 쓰기 바구니(없으면 용돈 · 여행)에서 줄이기
//  2) 쓰기 바구니 항목이 바구니 돈보다 많음 → 그만큼 % 늘리기
//  3) 100%가 안 됨 → 저축이 50% 밑이면 저축에, 아니면 용돈에
//  4) 쓰기 바구니에 항목보다 10만 원 넘게(2% 이상) 여유 → 용돈으로 옮겨도 됨
//  4-2) 저축 바구니 돈이 항목에 덜 담김 → 항목 늘리기 안내
//  5) 저축이 50% 밑 → 조금씩 옮겨 보기(바로 맞추기 없음)
//  6) 다 괜찮음 → 칭찬 + 1년 모일 돈
export type Advice = {
  tone: "good" | "tip" | "warn";
  text: string;
  action?: { label: string; buckets: Bucket[] };
};

const SAVE_GOAL = 50;
const SPARE_MIN = 100_000;

const money = (value: number) => {
  const abs = Math.abs(Math.round(value));
  if (abs >= 100_000_000) return `${(abs / 100_000_000).toFixed(1).replace(/\.0$/, "")}억`;
  if (abs >= 10_000) return `${Math.round(abs / 10_000).toLocaleString("ko-KR")}만`;
  return `${abs.toLocaleString("ko-KR")}원`;
};

// 받침에 따라 조사를 고른다: 「저축·투자로」「용돈으로」, 「생활비는」「여행은」.
const lastCode = (word: string) => word.charCodeAt(word.length - 1) - 0xac00;
const hasBatchim = (word: string) => { const code = lastCode(word); return code >= 0 && code <= 11171 && code % 28 !== 0; };
const ro = (word: string) => `${word}${hasBatchim(word) && lastCode(word) % 28 !== 8 ? "으로" : "로"}`;
const eun = (word: string) => `${word}${hasBatchim(word) ? "은" : "는"}`;

const setPercent = (buckets: Bucket[], changes: Record<string, number>) =>
  buckets.map((bucket) => (bucket.id in changes ? { ...bucket, percent: Math.max(0, Math.round((bucket.percent + changes[bucket.id]) * 10) / 10) } : bucket));

export function adviseBuckets(buckets: Bucket[], pf: PersonFlow): Advice {
  const net = pf.net;
  if (net <= 0) return { tone: "tip", text: "설정에서 연봉을 넣으면 바구니마다 얼마인지 알려 드릴게요." };
  const pct = (amount: number) => (amount / net) * 100;
  const flows = pf.buckets;
  const save = flows.find((bucket) => bucket.kind === "save");
  const free = flows.find((bucket) => bucket.kind === "free");
  const total = Math.round(pf.allocatedPercent * 10) / 10;

  // 1) 100% 넘음
  if (total > 100.05) {
    const over = Math.round((total - 100) * 10) / 10;
    const spareFirst = flows
      .filter((bucket) => bucket.kind !== "save" && bucket.percent > 0)
      .map((bucket) => ({ bucket, spare: bucket.planned > 0 ? Math.max(0, pct(bucket.left)) : bucket.kind === "free" || bucket.id === "b-trip" ? bucket.percent : 0 }))
      .sort((a, b) => b.spare - a.spare);
    const pick = spareFirst[0];
    if (pick && pick.spare >= 0.5) {
      // 사람이 맞추기 쉬운 정수 % 로 제안한다.
      const cut = Math.max(1, Math.min(Math.ceil(over), Math.floor(pick.spare), Math.floor(pick.bucket.percent)));
      const rest = Math.round((over - cut) * 10) / 10;
      return {
        tone: "warn",
        text: rest > 0 ? `${over}% 넘게 나눴어요. ${pick.bucket.name}에서 ${cut}%를 줄이고, 나머지 ${rest}%는 다른 바구니에서 줄여 주세요.` : `${over}% 넘게 나눴어요. ${pick.bucket.name}에서 ${cut}% 줄이면 딱 맞아요.`,
        action: { label: `${pick.bucket.name} -${cut}%`, buckets: setPercent(buckets, { [pick.bucket.id]: -cut }) },
      };
    }
    return { tone: "warn", text: `${over}% 넘게 나눴어요. 어느 바구니든 합쳐서 ${over}%만 줄여 주세요.` };
  }

  // 2) 쓰기 바구니가 모자람(항목이 바구니 돈보다 많음)
  const short = flows.filter((bucket) => bucket.kind !== "save" && bucket.left < -10_000).sort((a, b) => a.left - b.left)[0];
  if (short) {
    const need = Math.ceil(pct(-short.left));
    return {
      tone: "warn",
      text: `${short.name} 항목이 바구니보다 ${money(-short.left)} 많아요. ${need}% 늘려야 매달 모자라지 않아요.`,
      action: { label: `${short.name} +${need}%`, buckets: setPercent(buckets, { [short.id]: need }) },
    };
  }

  // 3) 100%가 안 됨
  if (total < 99.95) {
    const rest = Math.round((100 - total) * 10) / 10;
    const restMoney = (net * rest) / 100;
    if (save && save.percent < SAVE_GOAL) {
      return {
        tone: "tip",
        text: `${rest}%(${money(restMoney)})가 남아요. 저축에 넣으면 1년에 ${money(restMoney * 12)} 더 모여요.`,
        action: { label: `저축 +${rest}%`, buckets: setPercent(buckets, { [save.id]: rest }) },
      };
    }
    if (free) {
      return {
        tone: "good",
        text: `저축은 넉넉해요. 남은 ${rest}%(${money(restMoney)})는 용돈에 넣어 마음 편히 써도 좋아요.`,
        action: { label: `용돈 +${rest}%`, buckets: setPercent(buckets, { [free.id]: rest }) },
      };
    }
    return { tone: "tip", text: `${rest}%(${money(restMoney)})가 아직 어디에도 안 들어갔어요.` };
  }

  // 4) 쓰기 바구니에 여유
  const spare = flows
    .filter((bucket) => bucket.kind === "spend" && bucket.planned > 0 && bucket.left >= SPARE_MIN)
    .sort((a, b) => b.left - a.left)[0];
  if (spare) {
    const move = Math.floor(pct(spare.left));
    if (move >= 2) {
      const target = save && save.percent < SAVE_GOAL ? save : free;
      if (target) {
        const why = target.kind === "save" ? `${ro(target.name)} 옮기면 1년에 ${money((net * move * 12) / 100)} 더 모여요` : `${ro(target.name)} 옮겨 마음 편히 써도 좋아요`;
        return {
          tone: "good",
          text: `${eun(spare.name)} 항목보다 ${money(spare.left)} 여유 있어요. ${move}%를 ${why}.`,
          action: { label: `${ro(target.name)} ${move}%`, buckets: setPercent(buckets, { [spare.id]: -move, [target.id]: move }) },
        };
      }
    }
  }

  // 4-2) 저축 바구니 돈이 아직 항목(적금 · 주식 등)에 다 안 담김
  if (save && save.planned > 0 && save.left >= SPARE_MIN) {
    return { tone: "tip", text: `${save.name} 바구니 중 ${money(save.left)}이 아직 항목에 안 담겼어요. 적금·투자 항목에 넣으면 1년에 ${money(save.left * 12)} 더 모여요.` };
  }

  // 5) 저축이 50% 밑
  if (save && save.percent < SAVE_GOAL) {
    const gap = Math.round((SAVE_GOAL - save.percent) * 10) / 10;
    return { tone: "tip", text: `저축이 ${save.percent}%예요. 기본 50%까지 ${gap}%(${money((net * gap) / 100)}) 남았어요. 여유 있는 바구니에서 조금씩 옮겨 보세요.` };
  }

  // 6) 다 괜찮음
  return { tone: "good", text: `균형이 좋아요. 이대로면 1년에 ${money(pf.saveMonthly * 12)} 모여요.` };
}
