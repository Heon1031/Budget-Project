import type { Bucket, BucketFlow, PersonFlow } from "./plan";

// 나누기 「매니저 한마디」: 비율을 바꿀 때마다 지금 가장 중요한 한 가지를 쉬운 말로 알려 주고,
// 할 수 있으면 「바로 맞추기」로 바꿀 비율까지 내놓는다. 규칙 순서가 곧 중요도다.
//  1) 100%를 넘음 → 줄이기 쉬운 바구니부터 골라 2개까지 제안(예비 · 여행 → 용돈 → 자기관리 → 저축 50% 넘는 몫 → 생활비)
//     · 적어 둔 항목(고정지출) 밑으로는 줄이라고 하지 않는다 · 방금 만진 바구니는 빼고 고른다
//  2) 쓰기 바구니 항목이 바구니 돈보다 많음 → 그만큼 % 늘리기
//  3) 100%가 안 됨 → 「저축에 넣기」 · 「용돈에 넣기」 중 고르게(저축이 50% 밑이면 저축을 먼저)
//  4) 쓰기 바구니에 항목보다 10만 원 넘게(2% 이상) 여유 → 저축이나 용돈으로 옮겨도 됨(생활비는 맨 뒤)
//  4-2) 저축 바구니 돈이 항목에 덜 담김 → 항목 늘리기 안내
//  5) 저축이 50% 밑 → 조금씩 옮겨 보기(바로 맞추기 없음)
//  6) 다 괜찮음 → 칭찬 + 1년 모일 돈
export type Advice = {
  tone: "good" | "tip" | "warn";
  text: string;
  // 「바로 맞추기」 버튼(0~2개). 첫 번째가 추천.
  actions: { label: string; buckets: Bucket[] }[];
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

// 줄이기 쉬운 순서(작을수록 먼저). 생활비는 꼭 필요한 돈이라 맨 뒤.
const FLEX_RANK: Record<string, number> = { "b-spare": 1, "b-trip": 1, "b-free": 2, "b-self": 3, "b-save": 4, "b-living": 5 };
const rankOf = (bucket: BucketFlow) => FLEX_RANK[bucket.id] ?? (bucket.kind === "free" ? 2 : bucket.kind === "save" ? 4 : 1.5);

export function adviseBuckets(buckets: Bucket[], pf: PersonFlow, justChanged?: string): Advice {
  const net = pf.net;
  // 바로 맞추기: 지금 보이는 비율(금액 고정 바구니는 다시 계산한 비율)에서 더하고 빼며, 고친 바구니는 금액 고정을 푼다.
  const setPercent = (list: Bucket[], changes: Record<string, number>) =>
    list.map((bucket) => {
      if (!(bucket.id in changes)) return bucket;
      const shown = pf.buckets.find((b) => b.id === bucket.id)?.percent ?? bucket.percent;
      return { ...bucket, percent: Math.max(0, Math.round((shown + changes[bucket.id]) * 10) / 10), fixed: undefined };
    });
  if (net <= 0) return { tone: "tip", text: "설정에서 연봉을 넣으면 바구니마다 얼마인지 알려 드릴게요.", actions: [] };
  const pct = (amount: number) => (amount / net) * 100;
  const flows = pf.buckets;
  const save = flows.find((bucket) => bucket.kind === "save");
  const free = flows.find((bucket) => bucket.kind === "free");
  const total = Math.round(pf.allocatedPercent * 10) / 10;

  // 1) 100% 넘음: 줄일 수 있는 만큼(항목 밑으로는 안 내려감)을 보고 쉬운 바구니부터 2개
  if (total > 100.05) {
    const over = Math.round((total - 100) * 10) / 10;
    const room = (bucket: BucketFlow) =>
      bucket.kind === "save" ? Math.max(0, bucket.percent - SAVE_GOAL) : bucket.planned > 0 ? Math.max(0, pct(bucket.left)) : bucket.percent;
    const candidates = flows
      .filter((bucket) => bucket.id !== justChanged && bucket.percent > 0)
      .map((bucket) => ({ bucket, room: Math.floor(room(bucket)) }))
      .filter((option) => option.room >= 1)
      .sort((a, b) => rankOf(a.bucket) - rankOf(b.bucket) || b.room - a.room)
      .map(({ bucket, room: r }) => ({ bucket, cut: Math.min(Math.ceil(over), r) }));
    // 한 번에 다 맞출 수 있는 바구니가 있으면 그것만(2개까지), 없으면 줄일 수 있는 만큼 큰 순서로 2개.
    const enough = candidates.filter((option) => option.cut >= over);
    const options = (enough.length ? enough : [...candidates].sort((a, b) => b.cut - a.cut)).slice(0, 2);
    if (options.length) {
      const full = options.filter((option) => option.cut >= over);
      const text = full.length
        ? `${over}% 넘었어요. ${full.map((option) => option.bucket.name).join(" 또는 ")}에서 ${Math.ceil(over)}% 줄이면 맞아요.`
        : `${over}% 넘었어요. ${options[0].bucket.name}에서 ${options[0].cut}%까지 줄일 수 있고, 나머지는 다른 바구니에서 줄여 주세요.`;
      return {
        tone: "warn",
        text,
        actions: options.map(({ bucket, cut }) => ({ label: `${bucket.name} -${cut}%`, buckets: setPercent(buckets, { [bucket.id]: -cut }) })),
      };
    }
    return { tone: "warn", text: `${over}% 넘었어요. 적어 둔 항목 때문에 더 줄일 곳이 없어요. 항목을 줄이거나 방금 올린 바구니를 낮춰 주세요.`, actions: [] };
  }

  // 2) 쓰기 바구니가 모자람(항목이 바구니 돈보다 많음)
  const short = flows.filter((bucket) => bucket.kind !== "save" && bucket.left < -10_000).sort((a, b) => a.left - b.left)[0];
  if (short) {
    const need = Math.ceil(pct(-short.left));
    return {
      tone: "warn",
      text: `${short.name} 항목이 바구니보다 ${money(-short.left)} 많아요. ${need}% 늘려야 매달 모자라지 않아요.`,
      actions: [{ label: `${short.name} +${need}%`, buckets: setPercent(buckets, { [short.id]: need }) }],
    };
  }

  // 3) 100%가 안 됨: 저축 · 용돈 중 고르게(저축이 50% 밑이면 저축이 첫 번째)
  if (total < 99.95) {
    const rest = Math.round((100 - total) * 10) / 10;
    const restMoney = (net * rest) / 100;
    const targets = [save, free].filter((bucket): bucket is BucketFlow => Boolean(bucket) && bucket!.id !== justChanged);
    if (save && save.percent >= SAVE_GOAL) targets.reverse();
    const lowSave = Boolean(save && save.percent < SAVE_GOAL);
    const parts = targets.map((bucket) =>
      bucket.kind === "save" ? `${bucket.name}에 넣으면 1년에 ${money(restMoney * 12)} 더 모여요` : `${bucket.name}에 넣어 마음 편히 써도 좋아요`,
    );
    return {
      tone: lowSave ? "tip" : "good",
      text: `${rest}%(${money(restMoney)})가 남아요.${parts.length ? ` ${parts.join(" · ")}.` : " 어느 바구니에 넣을지 골라 주세요."}`,
      actions: targets.map((bucket) => ({ label: `${bucket.name} +${rest}%`, buckets: setPercent(buckets, { [bucket.id]: rest }) })),
    };
  }

  // 4) 쓰기 바구니에 여유
  const spare = flows
    .filter((bucket) => bucket.kind === "spend" && bucket.id !== justChanged && bucket.planned > 0 && bucket.left >= SPARE_MIN)
    .sort((a, b) => rankOf(a) - rankOf(b) || b.left - a.left)[0];
  if (spare) {
    const move = Math.floor(pct(spare.left));
    if (move >= 2) {
      const targets = [save, free].filter((bucket): bucket is BucketFlow => Boolean(bucket));
      if (save && save.percent >= SAVE_GOAL) targets.reverse();
      if (targets.length) {
        return {
          tone: "good",
          text: `${eun(spare.name)} 항목보다 ${money(spare.left)} 여유 있어요. ${move}%를 저축으로 옮기면 1년에 ${money((net * move * 12) / 100)} 더 모이고, 용돈으로 옮겨 써도 좋아요.`,
          actions: targets.map((target) => ({ label: `${ro(target.name)} ${move}%`, buckets: setPercent(buckets, { [spare.id]: -move, [target.id]: move }) })),
        };
      }
    }
  }

  // 4-2) 저축 바구니 돈이 아직 항목(적금 · 주식 등)에 다 안 담김
  if (save && save.planned > 0 && save.left >= SPARE_MIN) {
    return { tone: "tip", text: `${save.name} 바구니 중 ${money(save.left)}이 아직 항목에 안 담겼어요. 적금·투자 항목에 넣으면 1년에 ${money(save.left * 12)} 더 모여요.`, actions: [] };
  }

  // 5) 저축이 50% 밑
  if (save && save.percent < SAVE_GOAL) {
    const gap = Math.round((SAVE_GOAL - save.percent) * 10) / 10;
    return { tone: "tip", text: `저축이 ${save.percent}%예요. 기본 50%까지 ${gap}%(${money((net * gap) / 100)}) 남았어요. 여유 있는 바구니에서 조금씩 옮겨 보세요.`, actions: [] };
  }

  // 6) 다 괜찮음
  return { tone: "good", text: `균형이 좋아요. 이대로면 1년에 ${money(pf.saveMonthly * 12)} 모여요.`, actions: [] };
}
