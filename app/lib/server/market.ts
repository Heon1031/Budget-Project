// 공개 시장 정보 모으기: 하루 한 번 서버 예약 작업(worker/index.ts scheduled)이 부른다.
// - 한국은행 ECOS: 예금은행 가중평균금리(신규취급액) 주택담보대출, 통계표 121Y006 · 항목 BECBLA0302
// - 금융위원회 보도자료 목록에서 대출 규제 관련 제목만 골라 둔다. 숫자는 사람이 확인한 뒤 RULES에 반영한다.

export type LoanRate = { month: string; rate: number; source: string };
export type RegNews = { id: number; title: string; date: string; url: string };
export type MarketInfo = { loanRate: LoanRate | null; regNews: RegNews[]; updatedAt: number | null };

const FSC_LIST = "https://www.fsc.go.kr/no010101";
const NEWS_WORDS = /주택담보|주담대|LTV|DSR|가계부채|가계대출|대출\s*규제|부동산|디딤돌|정책대출|전세대출/;

async function database() {
  const { env } = await import("cloudflare:workers");
  return env;
}

function yyyymm(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function fetchLoanRate(apiKey: string, now = new Date()): Promise<LoanRate | null> {
  const start = yyyymm(new Date(now.getFullYear(), now.getMonth() - 8, 1));
  const end = yyyymm(now);
  // sample 키는 10줄까지만 주므로 9달 범위로 묻는다.
  const url = `https://ecos.bok.or.kr/api/StatisticSearch/${encodeURIComponent(apiKey)}/json/kr/1/10/121Y006/M/${start}/${end}/BECBLA0302`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`ECOS 응답 ${response.status}`);
  const body = (await response.json()) as { StatisticSearch?: { row?: { TIME: string; DATA_VALUE: string }[] } };
  const rows = body.StatisticSearch?.row ?? [];
  const last = rows.at(-1);
  if (!last) return null;
  const rate = Number(last.DATA_VALUE);
  if (!Number.isFinite(rate)) return null;
  return { month: `${last.TIME.slice(0, 4)}-${last.TIME.slice(4, 6)}`, rate, source: "한국은행 ECOS 예금은행 주택담보대출 가중평균금리(신규취급액)" };
}

const decodeHtml = (text: string) =>
  text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

export function parseFscList(html: string): RegNews[] {
  const items: RegNews[] = [];
  for (const block of html.split("<li>").slice(1)) {
    const link = block.match(/href="\/no010101\/(\d+)[^"]*"\s+title="([^"]+)"/);
    const date = block.match(/(\d{4}-\d{2}-\d{2})/);
    if (!link || !date) continue;
    const title = decodeHtml(link[2]);
    if (!NEWS_WORDS.test(title)) continue;
    items.push({ id: Number(link[1]), title, date: date[1], url: `${FSC_LIST}/${link[1]}` });
  }
  return items;
}

// 목록을 넘겨 보는 대신 제목 검색을 쓴다. 규제 글은 드물어서 최근 몇 쪽에는 없을 때가 많다.
const SEARCH_WORDS = ["주택담보", "DSR", "LTV", "가계부채"];

export async function fetchRegNews(now = new Date()): Promise<RegNews[]> {
  const pages = await Promise.all(
    SEARCH_WORDS.map(async (word) => {
      const response = await fetch(`${FSC_LIST}?srchKey=sj&srchText=${encodeURIComponent(word)}`, {
        headers: { "user-agent": "duri-budget/1.0 (+household app)" },
      });
      if (!response.ok) throw new Error(`금융위원회 응답 ${response.status}`);
      return parseFscList(await response.text());
    }),
  );
  const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10);
  const seen = new Set<number>();
  return pages
    .flat()
    .filter((item) => item.date >= yearAgo && !seen.has(item.id) && seen.add(item.id))
    .sort((a, b) => b.id - a.id)
    .slice(0, 20);
}

async function save(key: string, value: unknown) {
  const env = await database();
  await env.DB.prepare(
    "INSERT INTO market_info (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
  )
    .bind(key, JSON.stringify(value), Date.now())
    .run();
}

// 한쪽이 실패해도 다른 쪽은 저장한다. 실패 이유는 로그로만 남긴다(개인 정보 없음).
export async function refreshMarket() {
  const env = await database();
  const results: string[] = [];
  if (env.ECOS_API_KEY) {
    try {
      const rate = await fetchLoanRate(env.ECOS_API_KEY);
      if (rate) await save("loanRate", rate);
      results.push(`금리 ${rate?.month ?? "없음"}`);
    } catch (error) {
      results.push(`금리 실패: ${error instanceof Error ? error.message : error}`);
    }
  } else {
    results.push("금리 건너뜀: ECOS_API_KEY 없음");
  }
  try {
    const news = await fetchRegNews();
    await save("regNews", news);
    results.push(`규제 소식 ${news.length}건`);
  } catch (error) {
    results.push(`규제 소식 실패: ${error instanceof Error ? error.message : error}`);
  }
  console.warn(`[market] ${results.join(" · ")}`);
  return results;
}

export async function readMarket(): Promise<MarketInfo> {
  const env = await database();
  const { results } = await env.DB.prepare("SELECT key, value, updated_at FROM market_info").all<{ key: string; value: string; updated_at: number }>();
  const byKey = new Map(results.map((row) => [row.key, row]));
  const parse = <T,>(key: string, fallback: T): T => {
    try {
      return byKey.has(key) ? (JSON.parse(byKey.get(key)!.value) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  const updatedAt = results.length ? Math.max(...results.map((row) => row.updated_at)) : null;
  return { loanRate: parse<LoanRate | null>("loanRate", null), regNews: parse<RegNews[]>("regNews", []), updatedAt };
}
