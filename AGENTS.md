# 둘이자산 — 작업 규칙

부부의 「큰 흐름」 앱: 각자 · 공동 고정지출을 적어 두면 1년에 모일 돈, 이번 달 각자 마음 편히 쓸 돈, 하고 싶은 것을 해도 되는지를 보여 주고 1년 안 내 집 마련을 준비한다. Cloudflare Workers + D1, 기록은 폰에서 암호화.

## 먼저 읽을 것
- `docs/design.md` — 기능 · 화면 구조 · 디자인 규칙 (정한 것)
- `docs/housing.md` — 집 마련 계산 기준과 출처 · 기준일
- `docs/decisions.md` — 결정 기록 (날짜순)

## 지킬 것
- **보안:** 서버로 가는 기록은 반드시 `app/lib/vault.ts`의 `encryptJson`을 거친다. 열쇠는 `extractable: false`, 비밀번호 · 확인값은 localStorage · URL에 두지 않는다. `/api` 응답은 캐시하지 않는다. `npm run check:security`가 이걸 훑는다.
- **돈 숫자:** 세율 · 대출 규제 · 요율처럼 바뀌는 숫자는 코드에 흩뿌리지 않고 한곳(`app/lib/housing.ts`의 `RULES`, `app/lib/plan.ts`의 `RULES`)에 두고, `docs/housing.md`에 출처 · 기준일을 적는다. 화면에는 「추정」「확인 필요」를 붙인다.
- **화면:** 휴대폰(375px) 먼저. 글자 12px 이상, 누르는 곳 44px 이상. 카드 하나에 주 버튼 하나.
- **말:** 화면 문구는 쉬운 한국어. 전문용어는 처음에 풀어 쓴다(예: DSR → 「연 소득 대비 1년 대출 상환액 비율」).
- 데이터 모양을 바꾸면 `restoreState` · `mergeDefaults`로 예전 저장값이 깨지지 않게 한다.

## 시험
- `npm test` (빌드 + 화면 렌더링 시험), `npx tsc --noEmit`, `npm run lint`, `npm run check:security`
- 로컬 실행: `npm run db:local` 후 `npm run dev`
- Claude 훅(`.claude/settings.json`): 코드 수정 뒤 타입 · 보안 점검, 커밋 전 전체 시험을 자동으로 돌린다.
