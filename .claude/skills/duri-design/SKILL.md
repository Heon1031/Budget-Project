---
name: duri-design
description: 둘이자산(Budget-Project) 화면·문구·레이아웃을 만들거나 고칠 때 읽는다. 탭 구조, 색, 글자 크기, 버튼 규칙, 쉬운 말 쓰기, 휴대폰 확인 방법.
---

# 둘이자산 화면 규칙

1. `docs/design.md`의 탭 구조(이번 달 · 집 마련 · 계획 · 연결)와 통장 표를 따른다. 새 기능은 이 넷 중 하나에 넣고, 탭을 늘리기 전에 사용자에게 묻는다.
2. 휴대폰 375px에서 먼저 맞춘다. 가로 스크롤 금지. 아래 탭바(72px)에 내용이 가리지 않게 한다.
3. 글자 12px 이상(보조 11px), 입력 16px, 누르는 곳 44px 이상.
4. 카드 하나에 주 버튼 `button.primary` 하나. 지우기 · 끊기는 `button.danger` + `confirm`.
5. 색 · 글자 크기는 `app/globals.css` `:root` 토큰만 쓴다(`docs/design.md` 디자인 규칙). 새 색은 밝은 · 어두운 모드 값을 함께 정의한다. 글꼴은 Pretendard 하나.
6. 문구: 쉬운 한국어, 존댓말 「~해요」. 전문용어는 괄호로 풀이. 음수는 「○원 부족」. 추정 숫자에는 「추정」.
7. 금액 입력은 `app/fields.tsx`의 `MoneyField`, 비율은 `RateInput`을 쓴다.
8. 확인: 미리보기를 모바일(375×812), 밝은 · 어두운 모드 둘 다로 띄우고 `get_page_text` · 스크린샷으로 본다. 가로 넘침은 `document.documentElement.scrollWidth`로 잰다.
