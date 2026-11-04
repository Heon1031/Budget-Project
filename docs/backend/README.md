# 서버 · 보안

코드
- 서버(Cloudflare Worker): `worker/index.ts`, `app/api/`(household · sync · market), `app/lib/server/`(`server-store.ts` 저장 · 확인, `market.ts` 금리 · 규제 소식)
- 폰 안 보안: `app/lib/secure/`(`vault.ts` 암호화 · QR 코드, `sync.ts` 동기화, `lock.ts` Face ID 잠금), 화면 `app/secure/`(연결 · QR · 잠금)
- 표: `migrations/`, 설정: `wrangler.jsonc`, 점검 스크립트: `scripts/`

규칙은 `duri-backend` 스킬. 할 일은 [todo.md](todo.md).
