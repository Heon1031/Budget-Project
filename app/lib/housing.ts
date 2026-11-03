// 집 마련 계산(추정). 규제 숫자는 여기 RULES에만 두고 출처·기준일은 docs/housing.md에 적는다.

export const RULES = {
  checkedOn: "2026-11-03",
  ltvFirstHome: 0.7,
  ltvRegulated: 0.4,
  ltvOther: 0.7,
  dsr: 0.4,
  // 집값 구간별 구입 주담대 상한(수도권·규제지역)
  priceCaps: [
    { upTo: 1_500_000_000, cap: 600_000_000 },
    { upTo: 2_500_000_000, cap: 400_000_000 },
    { upTo: Infinity, cap: 200_000_000 },
  ],
  firstHomeTaxRelief: 2_000_000,
  contractRate: 0.1,
};

export type HousePlan = {
  targetPrice: number;
  capitalArea: boolean;
  firstHome: boolean;
  loanRate: number;
  stressRate: number;
  loanYears: number;
  existingAnnualDebt: number;
  jeonseDeposit: number;
  monthlySaving: number;
  moveDate: string;
  taxRate: number;
  brokerRate: number;
  otherCosts: number;
  done: Record<string, boolean>;
};

export function defaultMoveDate(now = new Date()) {
  const date = new Date(now.getFullYear() + 1, now.getMonth(), 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export const initialHouse: HousePlan = {
  targetPrice: 600_000_000,
  capitalArea: true,
  firstHome: true,
  loanRate: 4.0,
  stressRate: 1.5,
  loanYears: 30,
  existingAnnualDebt: 0,
  jeonseDeposit: 0,
  monthlySaving: 800_000,
  moveDate: "",
  taxRate: 1.1,
  brokerRate: 0.4,
  otherCosts: 5_000_000,
  done: {},
};

// 원리금균등: 매달 낼 돈 → 빌릴 수 있는 원금
function principalFromPayment(monthlyPayment: number, annualRatePercent: number, years: number) {
  const months = years * 12;
  const rate = annualRatePercent / 100 / 12;
  if (monthlyPayment <= 0 || months <= 0) return 0;
  if (rate === 0) return monthlyPayment * months;
  return (monthlyPayment * (1 - (1 + rate) ** -months)) / rate;
}

export function monthlyPayment(principal: number, annualRatePercent: number, years: number) {
  const months = years * 12;
  const rate = annualRatePercent / 100 / 12;
  if (principal <= 0 || months <= 0) return 0;
  if (rate === 0) return principal / months;
  return (principal * rate) / (1 - (1 + rate) ** -months);
}

export function monthsUntil(dateText: string, now = new Date()) {
  const [year, month] = dateText.split("-").map(Number);
  if (!year || !month) return 0;
  return Math.max(0, (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth()));
}

export function calculateHouse(house: HousePlan, annualIncome: number, currentAssets: number, moveDate: string) {
  const price = house.targetPrice;
  const ltv = house.capitalArea ? (house.firstHome ? RULES.ltvFirstHome : RULES.ltvRegulated) : RULES.ltvOther;
  const byLtv = price * ltv;
  const byCap = house.capitalArea ? (RULES.priceCaps.find((step) => price <= step.upTo)?.cap ?? 0) : Infinity;
  const yearlyRoom = Math.max(0, annualIncome * RULES.dsr - house.existingAnnualDebt);
  const byDsr = principalFromPayment(yearlyRoom / 12, house.loanRate + house.stressRate, house.loanYears);
  const loan = Math.max(0, Math.min(byLtv, byCap, byDsr));
  const limitedBy = loan === byDsr ? "dsr" : loan === byCap ? "cap" : "ltv";

  const taxBeforeRelief = price * (house.taxRate / 100);
  const tax = Math.max(0, taxBeforeRelief - (house.firstHome ? Math.min(RULES.firstHomeTaxRelief, taxBeforeRelief) : 0));
  const broker = price * (house.brokerRate / 100);
  const needCash = price - loan + tax + broker + house.otherCosts;

  const haveNow = currentAssets + house.jeonseDeposit;
  const months = monthsUntil(moveDate);
  const willHave = haveNow + house.monthlySaving * months;
  const gap = needCash - willHave;
  const neededMonthly = months > 0 ? Math.max(0, (needCash - haveNow) / months) : Math.max(0, needCash - haveNow);
  const payment = monthlyPayment(loan, house.loanRate, house.loanYears);
  const contract = price * RULES.contractRate;

  return { ltv, byLtv, byCap, byDsr, loan, limitedBy, tax, broker, needCash, haveNow, months, willHave, gap, neededMonthly, payment, contract };
}

// 잔금일 기준 할 일. 날짜는 일반적인 안내이고 계약마다 다르다.
export const HOUSE_STEPS: { id: string; offsetDays: number; title: string; detail: string }[] = [
  { id: "loan-check", offsetDays: -180, title: "대출 한도 미리 알아보기", detail: "은행 2~3곳에서 한도·금리 상담. 정책대출(디딤돌 등) 자격도 확인" },
  { id: "notify-landlord", offsetDays: -150, title: "집주인에게 이사 계획 알리기", detail: "전세 만기 6~2개월 전에 계약 연장 안 함을 알리고, 보증금 돌려받을 날짜를 맞춰요" },
  { id: "house-hunt", offsetDays: -120, title: "집 보러 다니기 · 시세 확인", detail: "실거래가, 등기부등본(빚·압류), 관리비를 확인해요" },
  { id: "contract", offsetDays: -90, title: "매매 계약 · 계약금 내기", detail: "보통 집값의 10%. 특약(대출 안 나오면 해제 등)을 꼭 넣어요" },
  { id: "loan-apply", offsetDays: -60, title: "대출 신청", detail: "잔금 1~2개월 전. 소득·재직 서류 준비" },
  { id: "moving", offsetDays: -30, title: "이사 업체 예약 · 보증금 반환일 확정", detail: "잔금일과 전세보증금 받는 날을 같은 날로 맞춰요" },
  { id: "closing", offsetDays: 0, title: "잔금 · 등기 · 보증금 받기", detail: "잔금 내고 소유권 이전 등기. 같은 날 전세보증금을 받아요" },
  { id: "move-in", offsetDays: 14, title: "전입신고", detail: "이사 후 14일 안. 생애최초 감면·대출 조건(실거주)과도 이어져요" },
  { id: "acq-tax", offsetDays: 60, title: "취득세 신고·납부", detail: "잔금일(취득일)부터 60일 안. 생애최초 감면 신청" },
];

export function stepDate(moveDate: string, offsetDays: number) {
  const [year, month, day] = moveDate.split("-").map(Number);
  if (!year) return "";
  const date = new Date(year, month - 1, day || 1);
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
