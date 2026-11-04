// 두 사람의 월급 · 저축 · 고정지출 · 하고 싶은 것을 담는 계획. 서버에는 암호화돼 「plan」 기록 하나로 간다.
import { initialHouse, type HousePlan } from "./housing";

export type Person = {
  name: string;
  annualGross: number;
  monthlyNonTaxable: number;
  actualNet: number;
  monthlyDeposit: number;
  monthlyInvest: number;
  monthlyPension: number;
  monthlyEmergency: number;
  buckets: Bucket[];
  // 각자 정한 목표 비율(실수령 기준, 합 100): 꼭 필요한 돈 · 하고 싶은 돈 · 모으는 돈
  targetNeeds: number;
  targetWants: number;
  targetSavings: number;
  foodRate: number;
  cultureRate: number;
  travelRate: number;
  cashRate: number;
};

export type Plan = {
  currentAssets: number;
  jeonseLoan: number;
  mortgageLoan: number;
  monthlyRent: number;
  otherLoan: number;
  housingSubscription: number;
  electricity: number;
  gas: number;
  water: number;
  telecom: number;
  managementFee: number;
};

export type Owner = 0 | 1 | "both";

export const FIXED_CATEGORIES = ["주거", "생활", "통신", "보험", "교통", "대출", "학원·배움", "운동·건강", "취미", "구독", "기타"] as const;
export type FixedCategory = (typeof FIXED_CATEGORIES)[number];

// 50/30/20식으로 나눌 때 「꼭 필요한 돈」으로 보는 분류. 나머지는 「하고 싶은 돈」.
export const NEED_CATEGORIES: readonly FixedCategory[] = ["주거", "생활", "통신", "보험", "교통", "대출"];

export const RATIO_PRESETS = [
  { id: "save-first", label: "먼저 모으기", needs: 40, wants: 10, savings: 50, note: "맞벌이 신혼부부에게 국내 재무 기사들이 권하는 「저축 50% 이상」" },
  { id: "50-30-20", label: "50/30/20", needs: 50, wants: 30, savings: 20, note: "엘리자베스 워런 『All Your Worth』(2005), 세후 소득 기준" },
] as const;

// 매달 나가는 돈. owner가 "both"면 공동 부담(나누는 방식은 shareRule).
export type FixedCost = { id: string; name: string; amount: number; owner: Owner; category: FixedCategory; day: number };

// 해 보고 싶은 것. once는 한 번 드는 돈(피부과, 헬스 등록), monthly는 매달 드는 돈(레슨).
export type Wish = { id: string; name: string; amount: number; kind: "once" | "monthly"; owner: Owner };

// 바구니: 각자 실수령을 %로 나눠 담는 칸. save = 모으는 돈(1년 모일 돈에 들어감), spend = 쓰는 돈, free = 마음 편히 쓰는 돈(용돈).
export type BucketKind = "save" | "spend" | "free";
export const BUCKET_ICONS = ["piggy", "cart", "heart", "wallet", "plane", "shield", "users", "home", "sparkles"] as const;
export type BucketIcon = (typeof BUCKET_ICONS)[number];
export type BucketItem = { id: string; name: string; amount: number };
export type Bucket = { id: string; name: string; icon: BucketIcon; kind: BucketKind; percent: number; items: BucketItem[] };

// 기본 바구니 틀: 저축·투자 50(맞벌이 신혼 「저축 50% 이상」 조언) · 생활비 25 · 자기관리 15 · 용돈 7 · 여행 3 · 예비 0.
export const BUCKET_TEMPLATE: Omit<Bucket, "items">[] = [
  { id: "b-save", name: "저축·투자", icon: "piggy", kind: "save", percent: 50 },
  { id: "b-living", name: "생활비", icon: "cart", kind: "spend", percent: 25 },
  { id: "b-self", name: "자기관리", icon: "heart", kind: "spend", percent: 15 },
  { id: "b-free", name: "용돈", icon: "wallet", kind: "free", percent: 7 },
  { id: "b-trip", name: "여행", icon: "plane", kind: "spend", percent: 3 },
  { id: "b-spare", name: "예비", icon: "shield", kind: "spend", percent: 0 },
];

const exampleBuckets = (items: Record<string, [string, number][]>): Bucket[] =>
  BUCKET_TEMPLATE.map((bucket) => ({
    ...bucket,
    items: (items[bucket.id] ?? []).map(([name, amount], index) => ({ id: `${bucket.id}-${index}`, name, amount })),
  }));

export type AppState = {
  people: [Person, Person];
  plan: Plan;
  marriageRegistered: boolean;
  house: HousePlan;
  fixedCosts: FixedCost[];
  wishes: Wish[];
  shareRule: "income" | "half";
};

export const STORAGE_KEY = "duri-asset-plan-v4";
export const RULES = {
  year: 2026,
  pensionEmployee: 0.0475,
  pensionMin: 410_000,
  pensionMax: 6_590_000,
  healthEmployee: 0.03595,
  longTermCareTotal: 0.009448,
  healthTotal: 0.0719,
  employmentEmployee: 0.009,
};

export const initialState: AppState = {
  people: [
    {
      name: "남편",
      annualGross: 52_000_000,
      monthlyNonTaxable: 200_000,
      actualNet: 0,
      monthlyDeposit: 700_000,
      monthlyInvest: 400_000,
      monthlyPension: 150_000,
      monthlyEmergency: 100_000,
      buckets: exampleBuckets({
        "b-save": [["적금", 600_000], ["주식", 400_000], ["연금", 200_000], ["비상금", 100_000]],
        "b-living": [["공동 통장", 400_000], ["식비", 300_000], ["교통·통신", 150_000]],
        "b-self": [["운동", 100_000], ["보험", 80_000]],
        "b-trip": [["여행 적금", 100_000]],
      }),
      foodRate: 15,
      cultureRate: 5,
      travelRate: 5,
      cashRate: 10,
      targetNeeds: 40,
      targetWants: 10,
      targetSavings: 50,
    },
    {
      name: "아내",
      annualGross: 40_000_000,
      monthlyNonTaxable: 200_000,
      actualNet: 0,
      monthlyDeposit: 500_000,
      monthlyInvest: 300_000,
      monthlyPension: 120_000,
      monthlyEmergency: 80_000,
      buckets: exampleBuckets({
        "b-save": [["적금", 500_000], ["주식", 300_000], ["청약", 100_000]],
        "b-living": [["공동 통장", 400_000], ["식비", 200_000], ["교통·통신", 100_000]],
        "b-self": [["요가", 120_000], ["보험", 90_000]],
        "b-trip": [["여행 적금", 80_000]],
      }),
      foodRate: 15,
      cultureRate: 5,
      travelRate: 5,
      cashRate: 10,
      targetNeeds: 40,
      targetWants: 10,
      targetSavings: 50,
    },
  ],
  plan: {
    currentAssets: 30_000_000,
    jeonseLoan: 500_000,
    mortgageLoan: 0,
    monthlyRent: 0,
    otherLoan: 0,
    housingSubscription: 250_000,
    electricity: 60_000,
    gas: 50_000,
    water: 25_000,
    telecom: 70_000,
    managementFee: 150_000,
  },
  marriageRegistered: false,
  house: initialHouse,
  fixedCosts: [
    { id: "f-rent", name: "전세대출 이자", amount: 500_000, owner: "both", category: "주거", day: 25 },
    { id: "f-manage", name: "관리비·공과금", amount: 285_000, owner: "both", category: "주거", day: 25 },
    { id: "f-internet", name: "인터넷", amount: 30_000, owner: "both", category: "통신", day: 10 },
    { id: "f-living", name: "공동 생활비(장보기·외식)", amount: 1_000_000, owner: "both", category: "생활", day: 1 },
    { id: "f-a-phone", name: "휴대폰", amount: 55_000, owner: 0, category: "통신", day: 15 },
    { id: "f-a-gym", name: "헬스장", amount: 60_000, owner: 0, category: "운동·건강", day: 5 },
    { id: "f-a-ott", name: "넷플릭스", amount: 13_500, owner: 0, category: "구독", day: 12 },
    { id: "f-b-phone", name: "휴대폰", amount: 45_000, owner: 1, category: "통신", day: 15 },
    { id: "f-b-pilates", name: "필라테스", amount: 200_000, owner: 1, category: "운동·건강", day: 1 },
    { id: "f-b-english", name: "영어 학원", amount: 180_000, owner: 1, category: "학원·배움", day: 3 },
  ],
  wishes: [
    { id: "w-skin", name: "피부과 관리", amount: 300_000, kind: "once", owner: 1 },
    { id: "w-pt", name: "PT 10회 등록", amount: 600_000, kind: "once", owner: 0 },
    { id: "w-golf", name: "골프 레슨", amount: 200_000, kind: "monthly", owner: 0 },
  ],
  shareRule: "income",
};

// 저장된 값에서 기본값과 같은 종류인 항목만 가져온다. 새 항목이 생겨도 예전 저장값이 깨지지 않는다.
export function mergeDefaults<T extends Record<string, unknown>>(defaults: T, source: unknown): T {
  const input = source && typeof source === "object" ? (source as Record<string, unknown>) : {};
  const merged = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T & string)[]) {
    const value = input[key];
    if (typeof value !== typeof defaults[key]) continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    merged[key] = value as T[typeof key];
  }
  return merged;
}

export function restoreState(saved: unknown): AppState {
  const data = saved && typeof saved === "object" ? (saved as Partial<AppState>) : {};
  const people = Array.isArray(data.people) ? data.people : [];
  return {
    people: [0, 1].map((index) => {
      const person = renameDefault(mergeDefaults(initialState.people[index], people[index]), index === 0 ? "나" : "배우자", index === 0 ? "남편" : "아내");
      const raw = (people[index] as Partial<Person> | undefined)?.buckets;
      const fixedCosts = Array.isArray(data.fixedCosts) ? data.fixedCosts.flatMap(cleanFixed) : [];
      return { ...person, buckets: Array.isArray(raw) ? raw.flatMap(cleanBucket) : migrateBuckets(person, index as 0 | 1, fixedCosts) };
    }) as [Person, Person],
    plan: mergeDefaults(initialState.plan, data.plan),
    house: mergeDefaults(initialHouse, data.house),
    marriageRegistered:
      typeof data.marriageRegistered === "boolean" ? data.marriageRegistered : initialState.marriageRegistered,
    fixedCosts: Array.isArray(data.fixedCosts) ? data.fixedCosts.flatMap(cleanFixed) : migrateFixed(data.plan),
    wishes: Array.isArray(data.wishes) ? data.wishes.flatMap(cleanWish) : initialState.wishes,
    shareRule: data.shareRule === "half" ? "half" : "income",
  };
}

// 예전 기본 이름(나 · 배우자)은 「누가 주인」처럼 읽혀서 남편 · 아내로 바꾼다. 직접 바꾼 이름은 그대로 둔다.
const renameDefault = (person: Person, oldName: string, newName: string) => (person.name === oldName ? { ...person, name: newName } : person);

const isOwner = (value: unknown): value is Owner => value === 0 || value === 1 || value === "both";
const money = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0);

function cleanFixed(item: unknown): FixedCost[] {
  const raw = (item ?? {}) as Partial<FixedCost>;
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return [];
  const category = FIXED_CATEGORIES.includes(raw.category as FixedCategory)
    ? (raw.category as FixedCategory)
    : (raw.category as string) === "배움·운동" // 분류를 나누기 전에 저장한 항목
      ? (/헬스|필라테스|요가|운동|PT|수영|클라이밍|골프/.test(String(raw.name)) ? "운동·건강" : "학원·배움")
      : "기타";
  const day = typeof raw.day === "number" && raw.day >= 1 && raw.day <= 31 ? Math.round(raw.day) : 1;
  return [{ id: raw.id, name: raw.name.slice(0, 40), amount: money(raw.amount), owner: isOwner(raw.owner) ? raw.owner : "both", category, day }];
}

function cleanWish(item: unknown): Wish[] {
  const raw = (item ?? {}) as Partial<Wish>;
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return [];
  return [{ id: raw.id, name: raw.name.slice(0, 40), amount: money(raw.amount), kind: raw.kind === "monthly" ? "monthly" : "once", owner: isOwner(raw.owner) ? raw.owner : "both" }];
}

// 고정지출 목록이 생기기 전에 저장한 계획: 주거비 칸들을 공동 고정지출로 옮긴다.
function migrateFixed(planSource: unknown): FixedCost[] {
  const plan = mergeDefaults(initialState.plan, planSource);
  const items: [string, keyof Plan, FixedCategory][] = [
    ["전세대출 상환", "jeonseLoan", "주거"],
    ["주택대출 상환", "mortgageLoan", "주거"],
    ["월세", "monthlyRent", "주거"],
    ["기타 대출 상환", "otherLoan", "대출"],
    ["전기요금", "electricity", "주거"],
    ["가스·난방비", "gas", "주거"],
    ["수도요금", "water", "주거"],
    ["인터넷·공용 통신", "telecom", "통신"],
    ["관리비", "managementFee", "주거"],
  ];
  return items
    .filter(([, key]) => plan[key] > 0)
    .map(([name, key, category]) => ({ id: `f-${key}`, name, amount: plan[key], owner: "both" as const, category, day: 25 }));
}

function cleanBucket(item: unknown): Bucket[] {
  const raw = (item ?? {}) as Partial<Bucket>;
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return [];
  const percent = typeof raw.percent === "number" && Number.isFinite(raw.percent) ? Math.min(100, Math.max(0, raw.percent)) : 0;
  const items = Array.isArray(raw.items)
    ? raw.items.flatMap((entry) => {
        const it = (entry ?? {}) as Partial<BucketItem>;
        return typeof it.id === "string" && typeof it.name === "string" ? [{ id: it.id, name: it.name.slice(0, 40), amount: money(it.amount) }] : [];
      })
    : [];
  return [{
    id: raw.id,
    name: raw.name.slice(0, 20),
    icon: BUCKET_ICONS.includes(raw.icon as BucketIcon) ? (raw.icon as BucketIcon) : "sparkles",
    kind: raw.kind === "save" || raw.kind === "free" ? raw.kind : "spend",
    percent,
    items,
  }];
}

// 바구니가 생기기 전 계획: 저축 칸 · 각자 고정지출을 기본 바구니에 옮겨 담는다(공동 고정지출은 사람마다 내는 몫이 달라 옮기지 않음).
function migrateBuckets(person: Person, index: 0 | 1, fixedCosts: FixedCost[]): Bucket[] {
  const saves: [string, number][] = [
    ["예금·적금", person.monthlyDeposit],
    ["비상금", person.monthlyEmergency],
    ["주식·펀드", person.monthlyInvest],
    ["연금·IRP", person.monthlyPension],
  ];
  const target: Record<FixedCategory, string> = {
    주거: "b-living", 생활: "b-living", 통신: "b-living", 교통: "b-living", 대출: "b-living",
    보험: "b-self", "학원·배움": "b-self", "운동·건강": "b-self",
    취미: "b-free", 구독: "b-free", 기타: "b-free",
  };
  return BUCKET_TEMPLATE.map((bucket) => ({
    ...bucket,
    items: [
      ...(bucket.id === "b-save" ? saves.filter(([, amount]) => amount > 0).map(([name, amount], i) => ({ id: `${bucket.id}-m${i}`, name, amount })) : []),
      ...fixedCosts.filter((item) => item.owner === index && target[item.category] === bucket.id).map((item) => ({ id: item.id, name: item.name, amount: item.amount })),
    ],
  }));
}

export const newId = (prefix: string) =>
  `${prefix}-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => byte.toString(36).padStart(2, "0")).join("")}`;

export type BucketFlow = Bucket & { budget: number; planned: number; left: number };

export type PersonFlow = {
  net: number;
  buckets: BucketFlow[];
  allocatedPercent: number;
  // 바구니에 나누지 않은 돈(음수면 100%를 넘게 나눈 것)
  unallocated: number;
  // 마음 편히 쓸 돈 = 용돈 바구니에서 정해 둔 항목을 뺀 돈 + 나누지 않은 돈
  free: number;
  saveMonthly: number;
};

export type Flow = {
  people: [PersonFlow, PersonFlow];
  monthlySaved: number;
  yearSaved: number;
  totalNet: number;
};

export function computeFlow(state: AppState, nets: [number, number]): Flow {
  const people = state.people.map((person, index) => {
    const net = nets[index];
    const buckets = person.buckets.map((bucket) => {
      const budget = Math.round((net * bucket.percent) / 100);
      const planned = bucket.items.reduce((sum, item) => sum + item.amount, 0);
      return { ...bucket, budget, planned, left: budget - planned };
    });
    const allocatedPercent = person.buckets.reduce((sum, bucket) => sum + bucket.percent, 0);
    const unallocated = net - buckets.reduce((sum, bucket) => sum + bucket.budget, 0);
    const freeLeft = buckets.filter((bucket) => bucket.kind === "free").reduce((sum, bucket) => sum + bucket.left, 0);
    // 모으는 돈은 실제로 정해 둔 항목을 쓰고, 항목이 없으면 바구니 금액을 쓴다.
    const saveMonthly = buckets.filter((bucket) => bucket.kind === "save").reduce((sum, bucket) => sum + (bucket.planned > 0 ? bucket.planned : bucket.budget), 0);
    return { net, buckets, allocatedPercent, unallocated, free: freeLeft + Math.max(0, unallocated), saveMonthly };
  }) as [PersonFlow, PersonFlow];
  const monthlySaved = people[0].saveMonthly + people[1].saveMonthly;
  return { people, monthlySaved, yearSaved: monthlySaved * 12, totalNet: nets[0] + nets[1] };
}

const round10 = (value: number) => Math.floor(value / 10) * 10;

function earnedIncomeDeduction(gross: number) {
  if (gross <= 5_000_000) return gross * 0.7;
  if (gross <= 15_000_000) return 3_500_000 + (gross - 5_000_000) * 0.4;
  if (gross <= 45_000_000) return 7_500_000 + (gross - 15_000_000) * 0.15;
  if (gross <= 100_000_000) return 12_000_000 + (gross - 45_000_000) * 0.05;
  return Math.min(20_000_000, 14_750_000 + (gross - 100_000_000) * 0.02);
}

function progressiveIncomeTax(base: number) {
  if (base <= 14_000_000) return base * 0.06;
  if (base <= 50_000_000) return base * 0.15 - 1_260_000;
  if (base <= 88_000_000) return base * 0.24 - 5_760_000;
  if (base <= 150_000_000) return base * 0.35 - 15_440_000;
  if (base <= 300_000_000) return base * 0.38 - 19_940_000;
  if (base <= 500_000_000) return base * 0.4 - 25_940_000;
  if (base <= 1_000_000_000) return base * 0.42 - 35_940_000;
  return base * 0.45 - 65_940_000;
}

function earnedIncomeTaxCredit(calculatedTax: number, gross: number) {
  const raw = calculatedTax <= 1_300_000
    ? calculatedTax * 0.55
    : 715_000 + (calculatedTax - 1_300_000) * 0.3;
  let cap = 740_000;
  if (gross > 33_000_000 && gross <= 70_000_000) {
    cap = Math.max(660_000, 740_000 - (gross - 33_000_000) * 0.008);
  } else if (gross > 70_000_000 && gross <= 120_000_000) {
    cap = Math.max(500_000, 660_000 - (gross - 70_000_000) * 0.5);
  } else if (gross > 120_000_000) {
    cap = Math.max(200_000, 500_000 - (gross - 120_000_000) * 0.5);
  }
  return Math.min(raw, cap);
}

export function calculateSalary(person: Person) {
  const monthlyGross = person.annualGross / 12;
  const taxableMonthly = Math.max(0, monthlyGross - person.monthlyNonTaxable);
  const pensionBase = taxableMonthly > 0
    ? Math.min(RULES.pensionMax, Math.max(RULES.pensionMin, Math.floor(taxableMonthly / 1000) * 1000))
    : 0;
  const pension = round10(pensionBase * RULES.pensionEmployee);
  const health = round10(taxableMonthly * RULES.healthEmployee);
  const longTermCare = round10(health * (RULES.longTermCareTotal / RULES.healthTotal));
  const employment = round10(taxableMonthly * RULES.employmentEmployee);
  const annualInsurance = (pension + health + longTermCare + employment) * 12;

  const annualTaxableSalary = taxableMonthly * 12;
  const earnedIncome = Math.max(0, annualTaxableSalary - earnedIncomeDeduction(annualTaxableSalary));
  const taxBase = Math.max(0, earnedIncome - 1_500_000 - annualInsurance);
  const calculatedTax = Math.max(0, progressiveIncomeTax(taxBase));
  const annualIncomeTax = Math.max(
    0,
    calculatedTax - earnedIncomeTaxCredit(calculatedTax, annualTaxableSalary) - 130_000,
  );
  const incomeTax = round10(annualIncomeTax / 12);
  const localIncomeTax = round10(incomeTax * 0.1);
  const estimatedNet = Math.max(
    0,
    monthlyGross - pension - health - longTermCare - employment - incomeTax - localIncomeTax,
  );

  return {
    monthlyGross,
    taxableMonthly,
    pension,
    health,
    longTermCare,
    employment,
    incomeTax,
    localIncomeTax,
    estimatedNet,
    net: person.actualNet > 0 ? person.actualNet : estimatedNet,
    isActual: person.actualNet > 0,
  };
}

