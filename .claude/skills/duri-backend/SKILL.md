---
name: duri-backend
description: 둘이자산(Budget-Project) 서버·보안 방에서 Cloudflare Worker, D1 표, 동기화(sync), 암호화(vault), QR 연결, 앱 잠금(패스키), 예약 작업(금리·규제 소식)을 고칠 때 읽는다.
---

# 둘이자산 서버 · 보안 규칙

## 구조
- Worker 입구 `worker/index.ts`(fetch + scheduled). API: `app/api/household` · `app/api/sync` · `app/api/market`.
- D1 표: `migrations/`. 표를 바꾸면 새 번호 파일을 더하고 `npm run db:local`로 시험. 실제 서버 반영(`db:remote`)과 배포는 총괄 방이 한다.
- 기록은 폰에서 `encryptJson`(AES-GCM) 후 `records`에 보관. 서버는 내용을 해석하지 않는다.
- 연결: 처음 시작한 폰이 무작위 비밀값 → HKDF → 열쇠 · 확인값. 상대 폰은 QR(`D1.` + 49바이트)로 받는다. 받는 폰은 QR을 보여 준 사람의 반대쪽.
- 잠금: WebAuthn 패스키(Face ID · 지문, 안 되면 폰 PIN). 서버를 거치지 않는다.

## 지킬 것
- 열쇠 `extractable: false`. 비밀값 · 확인값 · QR 코드는 localStorage · URL · 로그에 두지 않는다(IndexedDB 금고에만).
- 새 API는 `authenticate`를 먼저 부르고 `cache-control: no-store`. 공개 자료(`/api/market`)만 예외.
- 확인 실패 10번이면 15분 잠금. 없는 집과 틀린 확인값은 같은 말로 돌려준다.
- 바깥 사이트를 읽을 때 User-Agent에 개인 정보(메일 등)를 넣지 않는다.
- 고친 뒤 `npm run check:security`, `npm test`.
