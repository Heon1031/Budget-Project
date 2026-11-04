import { readMarket } from "../../lib/server/market";

// 공개 자료(금리 · 규제 소식)라 로그인 없이 준다. 개인 기록은 여기 없다.
export async function GET() {
  try {
    return Response.json(await readMarket(), { headers: { "cache-control": "public, max-age=3600" } });
  } catch {
    return Response.json({ loanRate: null, regNews: [], updatedAt: null }, { headers: { "cache-control": "no-store" } });
  }
}
