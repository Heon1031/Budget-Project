---
name: duri-money
description: 둘이자산(Budget-Project)의 돈 계산(실수령액·약속·집 마련·대출 한도·취득세)이나 규제 숫자, 암호화·동기화 코드를 고칠 때 읽는다. 숫자 출처 규칙과 보안 규칙.
---

# 둘이자산 돈 · 보안 규칙

## 숫자
- 흐름 계산(바구니 금액 · 마음 편히 쓸 돈 · 1년 모일 돈)은 `app/lib/plan.ts`의 `computeFlow`, 해볼까 판정은 `app/wish-board.tsx`의 `judgeWish` 한곳에서만 한다.
- 두 사람의 실제 돈 숫자는 공개 저장소에 쓰지 않는다(예시값만). 실제 기록은 `../가계부_개인기록/`.
- 세금 · 4대보험은 `app/lib/plan.ts`의 `RULES`, 집 마련 규제는 `app/lib/housing.ts`의 `RULES`에만 둔다.
- 바꾸면 `docs/housing.md` 표(값 · 근거 · 날짜)를 같이 고친다. 블로그 출처만 있으면 「확인 필요」를 남긴다.
- 대출 한도 = min(LTV × 집값, 집값 구간별 상한, DSR로 역산한 원금). DSR 역산은 (연 소득 × DSR − 기존 연 상환액)을 스트레스 금리 포함 원리금균등 상환으로 나눠 원금을 구한다.
- 화면에 나오는 한도 · 세금은 모두 「추정」. 은행 심사 · 공식 자료를 대체하지 않는다고 적는다.
- 집 목돈은 원금 보장 상품을 기본으로 안내한다. 투자 권유 문구를 쓰지 않는다.

## 보안
- 서버로 보내는 모든 기록은 `encryptJson`을 거친다. 서버 코드는 내용을 해석하지 않는다.
- 열쇠 `extractable: false`. 비밀번호 · 확인값을 localStorage · URL · 로그에 두지 않는다.
- 새 API를 만들면 `authenticate`를 먼저 부르고, 응답에 `cache-control: no-store`.
- 고친 뒤 `npm run check:security`. 기록 모양을 바꾸면 예전 기록을 풀었을 때 깨지지 않게 기본값을 채운다.
