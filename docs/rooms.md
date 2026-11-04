# 방(세션) 나누기 (2026-11-04)

한 방이 모든 걸 하면 대화가 길어지고 실수가 늘어서, 기능별로 방을 나눈다. 방마다 **맡은 파일 · 읽을 스킬 · 하지 말 것**을 정해 둔다.

## 방 목록

| 방 | 맡은 일 | 맡은 파일 | 먼저 읽을 스킬 |
|---|---|---|---|
| **총괄** (지금 방) | 방 사이 조정, 합치기(merge), **배포는 이 방만** | `docs/rooms.md` · `docs/decisions.md` · `wrangler.jsonc` | — |
| **화면** (프론트엔드) | 화면 · 디자인(애플 + 토스 느낌) · 입력 편의 | `app/*.tsx`(아래 제외) · `app/globals.css` · `app/charts.tsx` · `app/fields.tsx` · `public/` | `duri-design` |
| **서버 · 보안** (백엔드) | Cloudflare Worker · D1 · 동기화 · 암호화 · QR 연결 · 잠금 · 예약 작업(금리 · 규제 소식) | `worker/` · `app/api/` · `app/lib/server-store.ts` · `app/lib/sync.ts` · `app/lib/vault.ts` · `app/lib/lock.ts` · `app/lib/market.ts` · `app/connect-panel.tsx` · `app/qr.tsx` · `app/lock-screen.tsx` · `migrations/` · `scripts/` | `duri-backend` |
| **계산** (돈 규칙) | 실수령 · 바구니 계산 · 해볼까 판정 · 집 마련 계산 · 규제 숫자 | `app/lib/plan.ts` · `app/lib/housing.ts` · `judgeWish`(`app/wish-board.tsx`) · `docs/housing.md` | `duri-money` |
| **점검** (읽기만) | UI · UX · GUI · 접근성 점검, 보고서만 쓴다(코드는 안 고침) | `docs/audit/` | `duri-audit` |

## 같이 지킬 것
- 각 방은 **자기 git worktree(가지)**에서 일한다. 같은 파일을 두 방이 동시에 고치지 않는다. 남의 파일을 고쳐야 하면 고치지 말고 그 방 몫이라고 적어 둔다.
- 배포(`npm run deploy`) · `main`에 합치기 · GitHub 올리기는 **총괄 방만** 한다. 다른 방은 커밋까지만.
- 두 사람의 실제 돈 숫자는 이 저장소(공개)에 쓰지 않는다. 실제 기록은 `../가계부_개인기록/`.
- 방끼리 넘길 일은 `docs/handoff/<받는 방>.md`에 적는다(직접 메시지를 보내지 않음).
- 훅(`.claude/settings.json`)은 모든 방에 같이 걸린다: 고친 뒤 타입 · 보안 점검, 커밋 전 전체 시험.
