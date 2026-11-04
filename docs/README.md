# 문서 · 폴더 안내

일을 할 때는 **그 영역의 폴더만 열고** 그 안의 README · todo부터 읽는다.

| 영역 | 문서 폴더 | 코드 폴더 | 스킬 |
|---|---|---|---|
| 공통 | [common/](common/) — 앱이 무엇인지 · 화면 구조(`product.md`), 결정 기록(`decisions.md`) | `app/page.tsx` | — |
| 화면 | [frontend/](frontend/) — 디자인 규칙 · 할 일 | `app/screens/` · `app/globals.css` · `public/` | `duri-design` |
| 서버 · 보안 | [backend/](backend/) — 구조 · 할 일 | `worker/` · `app/api/` · `app/lib/server/` · `app/lib/secure/` · `app/secure/` · `migrations/` | `duri-backend` |
| 계산 | [calc/](calc/) — 바구니 · 흐름 계산, 집 마련 규제 숫자 | `app/lib/calc/` | `duri-money` |
| 점검 | [audit/](audit/) — UI · UX · 접근성 점검 보고서 · 할 일 | (읽기만) | `duri-audit` |

- 한 영역 일을 하다가 다른 영역 일이 생기면 그 영역의 `todo.md`에 한 줄 적는다.
- 두 사람의 실제 돈 숫자는 이 저장소(공개)에 쓰지 않는다. 실제 기록은 `../가계부_개인기록/`.
