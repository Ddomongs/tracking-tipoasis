# tracking-tipoasis 디자인 시스템 미리보기

`../DESIGN.md`(단일 기준)에 적힌 토큰과 공통 부품을 그대로 그린 HTML 미리보기입니다. 모든 파일은 `_base.css` 하나만 씁니다.
`_base.css`는 `app/styles/tokens.css`를 한 글자도 바꾸지 않고 담고 있어서, 토큰을 바꾸면 그 절을 다시 복사해야 합니다(`tests/unit/tokens.spec.ts`가 검사).
색은 모두 `var(--tt-*)`로만 씁니다. 각 HTML은 `<!-- @dsCard group="..." -->` 표시로 시작해 Claude Design이 카드로 읽습니다.
예시 번호는 `0000 1234 5678` 같은 가짜 번호만 씁니다.

Claude Design의 디자인 시스템 프로젝트로 보내기(대화형 Claude Code 세션에서):

1. 이 컴퓨터에서 `/design-login`을 한 번 실행합니다.
2. `design-system/`을 "tracking-tipoasis" 디자인 시스템 프로젝트로 동기화해 달라고 요청합니다.

파일:

- `foundations/colors.html` — signal 색 토큰 30개와 색면 위 글자 대비
- `foundations/typography.html` — 글자 크기 6단계와 서체
- `foundations/spacing.html` — 여백·크기 토큰과 375×812 첫 화면 예산
- `components/buttons.html` — 버튼 슬롯, 톡톡 링크, 복사 폴백, 색면 안 버튼
- `components/status.html` — 상태 칩, 상태 색면 5톤, 도착 예상 표기
- `components/journey-spine.html` — 4구간 척추의 상태별 모양
- `components/cards.html` — 결과 화면 한 장(번호 바 → 상태 색면 → 지금 할 일 → 마지막 처리)
- `components/customer-cta.html` — 상태별 '지금 할 일' 블록과 스토어 링크 묶음
- `components/tracking-form.html` — 홈 조회 영역과 상담·스토어 바로가기 행

서류형·어두운 화면 스타일 미리보기는 R3b에서 더합니다.
