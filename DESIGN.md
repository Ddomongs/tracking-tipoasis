# 통관·배송 조회 디자인 시스템

> 이 문서가 화면 디자인의 **단일 기준**입니다. 값의 원본은 `app/styles/tokens.css`(화면)와 `lib/style/tokens.ts`(대비 검사)이고, `tests/unit/tokens.spec.ts`가 이 문서·CSS·TypeScript·Tailwind 설정·`design-system/` 미리보기가 같은 값을 쓰는지 검사합니다. 공통 부품은 `/internal/ui-kit`(내부 인증)에서 실제 코드로 볼 수 있습니다. 전략과 정보 구조는 `docs/superpowers/specs/2026-09-26-tracking-renewal-ia-design.md`를 따릅니다.

## 1. 원칙

- 고객은 배송이 궁금하거나 불안한 상태로 옵니다. 읽는 순서는 조회 → 지금 상태 → 예상일 → 해야 할 일이고, 자세한 처리 내역은 원할 때만 펼칩니다.
- 화면에서 가장 큰 글자는 도착 예상 날짜(32–40px)입니다. 마케팅 제목이 상태나 날짜보다 커지지 않습니다.
- 상태는 색·아이콘·글자를 함께 써서 알립니다(WCAG 1.4.1). 빨강은 '문제'에만 씁니다. '확인 필요'는 앰버 면에 잉크 글자입니다.
- 채움색 주 버튼은 화면당 1개입니다. 톡톡·스토어는 보조(외곽선 또는 텍스트)이고, 문제 상태에서만 톡톡이 주 버튼이 됩니다.
- 모션은 150–300ms 한 번뿐입니다(첫 화면 배송 장면 그림의 약 4초 한 번 재생은 예외, 7장). 무한 반복은 없고, 줄인 모션 설정이면 0입니다.
- 버리는 것: 글로우 그림자, 흐림 원형 장식, 격자 배경, 그라디언트 버튼, 장식용 번호(01/02/03), 뜻 없는 아이콘.
- 고객 언어로 씁니다. 브랜드·로봇·AI 표현을 쓰지 않고, 한글 문장은 낱말 단위로 줄을 바꿉니다(`word-break: keep-all`).
- 실제 고객 번호는 어디에도 쓰지 않습니다. 예시는 `0000 1234 5678`, `TEST 0000 0001`, `ABCD 0000 0000`처럼 0000·TEST·ABCD 계열만 씁니다.

## 2. 화면 스타일

| id | 고객에게 보이는 이름 | 상태 | 성격 |
|---|---|---|---|
| `signal` | 기본 | R3 기본값(구현됨) | 결과 상단을 상태 톤 단색 면으로 채우고 도착일을 굵고 크게 세웁니다. 장식 0. |
| `manifest` | 서류형 | R3b 구현(고객이 고름) | 차가운 종이 바탕, 라벨-값 괘선, 상태 도장 한 개, 고정폭 기입값. |
| `night` | 어두운 화면 | R3b 구현(고객이 고름, 기기 어두운 모드의 첫 방문 기본) | 채도를 뺀 어두운 바탕, 노선도형 여정, 평면 램프, 숫자 타일. |

- 스타일 = 토큰 세트(`html[data-style]` 범위의 CSS 변수) + 변형 슬롯 4개(8장). 부품 구조, DOM 순서, `data-*` 훅, 문구, 배치 규칙은 스타일과 무관합니다.
- 서버는 늘 `<html data-style="signal">`로 그립니다. `<head>`의 첫 페인트 전 스크립트가 저장된 선택(`localStorage` `tt:style`) 또는 기기 어두운 모드(`data-follow-dark`)에 따라 첫 페인트 전에 바꿉니다(16장). 서류형·어두운 화면 토큰은 14·15장입니다.
- `:root`에도 signal 값이 있어서 `data-style`이 없어도 기본 스타일로 보입니다.

## 3. 색 토큰 (signal)

`-tone-X`는 색면·표식 색, `-tone-X-on`은 그 색면 위 글자·아이콘, `-tone-X-ink`는 흰 면 위에서 그 톤을 글자·아이콘으로 쓸 때의 색입니다.

| 토큰 | 값 | Tailwind | 쓰임 |
|---|---|---|---|
| `--tt-ground` | `#EEEDE8` | `bg-tt-ground` | 페이지 바탕, 공지 배너, 중립 색면 |
| `--tt-surface` | `#FFFFFF` | `bg-tt-surface` | 번호 바, 카드, 입력칸 면 |
| `--tt-raised` | `#FFFFFF` | `bg-tt-raised` | 겹쳐 뜨는 면(signal은 surface와 같음) |
| `--tt-ink` | `#111110` | `text-tt-ink` | 본문 글자, 선, 외곽선 버튼 |
| `--tt-muted` | `#5C5B56` | `text-tt-muted` | 보조 글자(흰 면·바탕 위에서만) |
| `--tt-rule` | `#D3D2CB` | `border-tt-rule` | 장식 구분선(대비 요구 없음) |
| `--tt-control` | `#767570` | `border-tt-control` | 입력칸·라디오 경계(3:1) |
| `--tt-route` | `#85847E` | `bg-tt-route` | 흰 면 위의 경로·보조선(3:1) |
| `--tt-primary` | `#111110` | `bg-tt-primary` | 화면당 하나인 채움 버튼 |
| `--tt-on-primary` | `#FFFFFF` | `text-tt-on-primary` | 채움 버튼 글자 |
| `--tt-accent` | `#2244D1` | `bg-tt-accent` | 신호 파랑(링크에는 쓰지 않음) |
| `--tt-link` | `#111110` | `text-tt-link` | 텍스트 링크(잉크 + 2px 밑줄, '정상 진행' 파랑과 분리) |
| `--tt-focus` | `#111110` | `outline-tt-focus` | 흰 면·바탕 위 포커스 링 |
| `--tt-tile` | `#FFFFFF` | `bg-tt-tile` | 숫자 타일 면(signal은 surface와 같음) |
| `--tt-board` | `#111110` | `text-tt-board` | 숫자 타일 글자 |
| `--tt-tone-progress` | `#2244D1` | `bg-tt-progress` | 정상 진행 색면 |
| `--tt-tone-progress-on` | `#FFFFFF` | `text-tt-progress-on` | 정상 진행 색면 위 글자·아이콘 |
| `--tt-tone-progress-ink` | `#2244D1` | `text-tt-progress-ink` | 흰 면 위 정상 진행 글자·아이콘 |
| `--tt-tone-waiting` | `#CFCEC6` | `bg-tt-waiting` | 정보 대기 색면 |
| `--tt-tone-waiting-on` | `#111110` | `text-tt-waiting-on` | 정보 대기 색면 위 글자 |
| `--tt-tone-waiting-ink` | `#5C5B56` | `text-tt-waiting-ink` | 흰 면 위 정보 대기 글자 |
| `--tt-tone-attention` | `#F4BC00` | `bg-tt-attention` | 확인 필요 색면(앰버) |
| `--tt-tone-attention-on` | `#111110` | `text-tt-attention-on` | 확인 필요 색면 위 글자(잉크) |
| `--tt-tone-attention-ink` | `#8A5A00` | `text-tt-attention-ink` | 흰 면 위 확인 필요 글자 |
| `--tt-tone-problem` | `#C8261D` | `bg-tt-problem` | 문제 색면(빨강은 여기만) |
| `--tt-tone-problem-on` | `#FFFFFF` | `text-tt-problem-on` | 문제 색면 위 글자 |
| `--tt-tone-problem-ink` | `#C8261D` | `text-tt-problem-ink` | 흰 면 위 문제 글자 |
| `--tt-tone-done` | `#0B6B3E` | `bg-tt-done` | 완료 색면 |
| `--tt-tone-done-on` | `#FFFFFF` | `text-tt-done-on` | 완료 색면 위 글자 |
| `--tt-tone-done-ink` | `#0B6B3E` | `text-tt-done-ink` | 흰 면 위 완료 글자 |

## 4. 대비 기준

모든 구현 스타일이 아래 기준을 통과해야 합니다(`lib/style/tokens.ts`의 `CONTRAST_REQUIREMENTS`). 수치는 signal 값입니다.

| 글자 / 바탕 | signal | 기준 |
|---|---|---|
| `--tt-ink` / `--tt-surface` | 18.89:1 | 4.5:1 |
| `--tt-ink` / `--tt-ground` | 16.12:1 | 4.5:1 |
| `--tt-muted` / `--tt-surface` | 6.81:1 | 4.5:1 |
| `--tt-muted` / `--tt-ground` | 5.81:1 | 4.5:1 |
| `--tt-link` / `--tt-surface` | 18.89:1 | 4.5:1 |
| `--tt-link` / `--tt-ground` | 16.12:1 | 4.5:1 |
| `--tt-on-primary` / `--tt-primary` | 18.89:1 | 4.5:1 |
| `--tt-tone-progress-on` / `--tt-tone-progress` | 7.46:1 | 4.5:1 |
| `--tt-tone-waiting-on` / `--tt-tone-waiting` | 11.96:1 | 4.5:1 |
| `--tt-tone-attention-on` / `--tt-tone-attention` | 10.83:1 | 4.5:1 |
| `--tt-tone-problem-on` / `--tt-tone-problem` | 5.60:1 | 4.5:1 |
| `--tt-tone-done-on` / `--tt-tone-done` | 6.59:1 | 4.5:1 |
| `--tt-tone-progress-ink` / `--tt-surface` | 7.46:1 | 4.5:1 |
| `--tt-tone-waiting-ink` / `--tt-surface` | 6.81:1 | 4.5:1 |
| `--tt-tone-attention-ink` / `--tt-surface` | 5.93:1 | 4.5:1 |
| `--tt-tone-problem-ink` / `--tt-surface` | 5.60:1 | 4.5:1 |
| `--tt-tone-done-ink` / `--tt-surface` | 6.59:1 | 4.5:1 |
| `--tt-board` / `--tt-tile` | 18.89:1 | 4.5:1 |
| `--tt-control` / `--tt-surface` | 4.62:1 | 3:1 |
| `--tt-route` / `--tt-surface` | 3.75:1 | 3:1 |
| `--tt-focus` / `--tt-surface` | 18.89:1 | 3:1 |
| `--tt-focus` / `--tt-ground` | 16.12:1 | 3:1 |

- `--tt-muted`는 색면 위에서 1.03–4.31:1이라 쓰지 않습니다. 색면 안의 보조 글자는 색면 글자색(`--field-fg`)으로 바뀝니다.
- 포커스 링은 흰 면·바탕 위에서 `--tt-focus`, 색면 안에서 그 색면의 글자색이라 어디서나 3:1 이상입니다.
- 11px 이하 글자는 없습니다. 행동 문구는 14px 이상입니다.

## 5. 글자

- 본문·제목: 시스템 한글 고딕(`--tt-font-body`, `--tt-font-display`: Apple SD Gothic Neo, 맑은 고딕, Noto Sans KR …). 내려받는 파일 0KB.
- 조회번호 숫자: DM Mono 500 latin 서브셋 1파일(`--tt-font-mono`; `next/font`가 `--font-dm-mono`로 연결하고 preload).
- 폰트 예산: preload 2파일 이하(signal은 1), 첫 화면 100KB 이하. 서류형·어두운 화면의 서체는 그 스타일을 고른 경우에만 내려받습니다.
- 제목 굵기 `--tt-weight-display` 800. 줄 간격 `--tt-leading-tight` 1.25, `--tt-leading-body` 1.5. 숫자는 `tabular-nums`.

| 토큰 | 크기 | 줄 높이 | Tailwind | 쓰임 |
|---|---|---|---|---|
| `--tt-text-xs` | 12px | 18px | `text-tt-xs` | 척추 라벨, 고지, 원문 용어, 번호 바 라벨, 공지 배너 |
| `--tt-text-sm` | 14px | 20px | `text-tt-sm` | 칩, 이유 한 줄, 안내 줄, 배지 |
| `--tt-text-md` | 16px | 24px | `text-tt-md` | 본문, 버튼, 입력 |
| `--tt-text-lg` | 20px | 28px | `text-tt-lg` | 상태 제목(h2), 지금 할 일 제목(h3), 조회번호 |
| `--tt-text-xl` | 24px | 32px | `text-tt-xl` | 홈 제목(h1) |
| `--tt-text-eta` | 40px | 1.1 | `text-tt-eta` | 도착 예상 날짜(화면 최대 글자) |

## 6. 간격·크기·레이아웃

| 토큰 | signal | 쓰임 |
|---|---|---|
| `--tt-gutter` | 20px | 좌우 여백, 색면 안쪽 여백 |
| `--tt-header-h` | 48px | 헤더 높이 |
| `--tt-column` | 560px | 결과 왼쪽 열(데스크톱)과 본문 최대 폭 |
| `--tt-side` | 320px | 데스크톱 오른쪽 보조 열 |
| `--tt-status-field-max` | 300px | 375×812에서 상태 색면 높이 예산 |
| `--tt-anchor-reserve` | 64px | 모바일 하단 광고 앵커 높이 예약(`scroll-padding-bottom`) |
| `--tt-radius-button` | 0px | 버튼 모서리 |
| `--tt-radius-card` | 0px | 카드 모서리 |
| `--tt-border-button` | 2px | 외곽선 버튼 테두리 |
| `--tt-focus-width` | 3px | 포커스 링 두께 |
| `--tt-focus-offset` | 2px | 포커스 링 간격 |

- 375×812 첫 화면: 헤더 48 + 번호 바 56 + 상태 색면 300 이하 + 간격 16 → '지금 할 일'이 420px 안에서 시작합니다. 색면은 자르지 않고(`max-height` 금지) 내용 배치로 예산을 지킵니다.
- 320px에서 가로 스크롤 0, 조회번호 말줄임 0.
- 누르는 크기: 행동 44–52px(`md` 44, `lg` 52), 최소 24px.

## 7. 포커스와 모션

- 포커스: `.tt-focus` 한 클래스. `outline: var(--tt-focus-width) solid var(--tt-focus)`, `outline-offset: var(--tt-focus-offset)`. 색면 안에서는 링 색이 `--field-fg`로 바뀝니다.
- 모션 토큰: `--tt-motion-fast` 150ms(버튼 색 전환), `--tt-motion-base` 200ms, `--tt-motion-slow` 250ms, `--tt-ease` `cubic-bezier(0.2, 0, 0, 1)`.
- 움직이는 것은 두 가지뿐입니다: `tt-paint`(결과 상태 색면이 한 번 칠해짐, 200ms)와 `tt-grow`(척추의 지금 칸이 한 번 자람, 250ms). 2026-10-02(요청 ③④)부터 첫 화면 맨 위에 배송 장면 그림(`public/art/hero.svg`, 좁은 화면 `hero-m.svg`)이 있습니다. 그림 파일 안에서 비행기 도착 → 통관 도장 → 트럭 이동 → 집 도착을 약 4초 한 번 재생하고 멈추며(WCAG 2.2.2의 5초 안), 줄인 모션이면 처음부터 마지막 장면입니다. 날짜 숫자는 세어 올라가지 않습니다. `opacity: 0`에서 시작하는 모션은 쓰지 않습니다.
- 줄인 모션: `prefers-reduced-motion: reduce`이면 세 모션 토큰이 모두 0ms입니다(`:root, [data-style][data-style]` 규칙이라 스타일 파일이 되살릴 수 없음).

framer-motion 대체(패키지 제거는 S06):

| 지금(framer-motion) | 바뀐 뒤 |
|---|---|
| `HomePageClient` 결과 영역 `opacity 0 → 1`, `y 10 → 0`, 0.35s | 상태 색면의 `tt-paint` 200ms + 척추 `tt-grow` 250ms. 영역 자체는 움직이지 않음 |
| `HomePageClient` 보조 섹션 `opacity`, `y 8 → 0`, 0.3s | 움직이지 않음 |
| `TimelineStep` 항목마다 `opacity`, `y`, 0.25s | 움직이지 않음(처리 내역은 `<details>` 안) |
| `MotionConfig reducedMotion="user"`, `useReducedMotion` | CSS 모션 토큰 + `prefers-reduced-motion` |

## 8. 변형 슬롯과 `data-*` 훅

스타일마다 달라지는 곳은 네 슬롯뿐입니다. signal 모양은 `app/styles/tokens.css`에 있고, 다른 스타일은 `[data-style="…"] [data-slot="…"]` CSS와 `aria-hidden="true"`인 `data-deco` 요소로만 꾸밉니다.

| 슬롯 | signal | 서류형(R3b) | 어두운 화면(R3b) |
|---|---|---|---|
| `data-slot="status-head"` | 상태 톤 단색 면(`data-tone`). 안의 글자·선·링은 색면 글자색 한 가지 | 도장 | 램프 |
| `data-slot="eta"` | 굵고 큰 날짜 + 반전 D-n 칩 | 기입값 | 숫자 타일 |
| `data-slot="journey"` | 4구간 막대(지난 8px 채움, 지금 20px 채움, 남은 8px 외곽선) | 운송장 경로 | 노선도 |
| `data-slot="button"` | 모서리 0, 잉크 채움 / 2px 잉크 외곽선 / 잉크 밑줄 | 스타일 토큰 | 스타일 토큰 |

공통 부품이 그리는 훅(테스트와 스타일이 함께 씀):

| 훅 | 요소 | 값 |
|---|---|---|
| `data-tone` | 상태 색면, 상태 칩 | `neutral` `progress` `waiting` `attention` `problem` `done` |
| `data-status-chip` | 상태 칩 | `true` |
| `data-station` | 척추 `<li>` | `departed` `customs` `domestic` `arrived` |
| `data-station-state` | 척추 `<li>` | `done` `current` `todo` |
| `data-issue` | 표식이 붙은 척추 `<li>` | `stopped` `cut` `branch` |
| `data-spine-current` | 척추 `<ol>` | 구간 id 또는 `none` |
| `data-eta-kind` | 도착 예상 | `date` `today` `holidayAffected` `overdue` `deliveredOn` `pendingInfo` `withheld` `unknown` |
| `data-number-bar` | 번호 바 | `true` |
| `data-affiliate-group` | 스토어 링크 묶음 | `shortcut` `showcase` `pending` `deliveredLead` |
| `data-affiliate-disclosure` (+ `data-slot="disclosure"`) | 묶음의 첫 줄 고지. CSS는 `data-slot="disclosure"` 가 붙은 부품에만 적용(기존 결과 화면은 S07까지 제 모양 유지) | `coupang` |
| `data-link-placement` | 톡톡·스토어 링크 | 위치 id |
| `data-notice-kind` | 공지 줄 | `outage` `delay` `holiday` `info` |
| `data-variant` | 버튼·버튼 모양 링크(`data-slot="button"`) | 행동 무게 `primary` `secondary` `text` |

모양 전용 훅(스타일 CSS용, 비즈니스 규칙 테스트에는 쓰지 않음): `data-size`, `data-spine-part`, `data-eta-label`, `data-eta-value`, `data-eta-visual`, `data-eta-part`, `data-eta-digit`, `data-eta-dday`, `data-eta-badge`, `data-eta-caption`, `data-eta-text`, `data-tone-icon`, `data-notice-variant`, `data-number-bar-value`, `data-number-bar-actions`, `data-copy-fallback`.

## 9. 공통 부품 (`components/primitives/`)

부품은 뷰 모델 문자열과 명세가 정한 몇 개 문구('조회번호', '배송 여정 4구간', 구간 이름, '위치 확인 전', '인계 대기', '안내', ' 새 창으로 열기', 'D-')만 그립니다. 나머지 문구는 `config/site.config.ts`에서 옵니다. 부품은 live region을 만들지 않습니다.

| 부품 | 하는 일 | 지키는 규칙 |
|---|---|---|
| `Button` | `<button data-slot="button">` 주·보조·텍스트 | `md` 44px, `lg` 52px. `busy`는 `aria-busy`만 걸고 `disabled`로 막지 않음 |
| `ButtonLink` | 버튼 모양 링크 | 외부 링크는 새 창, `rel="noopener noreferrer"`, 이름 '{라벨} 새 창으로 열기'. 제휴면 `sponsored nofollow` 추가 |
| `ToneIcon` | 톤·표식 아이콘 | 늘 `aria-hidden`. 상태는 글자로도 씀 |
| `StatusChip` | '통관 대기 · 2/4' 같은 칩 | 흰 면에서는 톤 색면, 색면 안에서는 반전 |
| `JourneySpine` | 4구간 여정 | `<ol aria-label="배송 여정 4구간">`, `aria-current="step"` 정확히 1개, 위치 확인 전이면 0개 + '위치 확인 전'. 코드 4는 ②에 ✓와 '인계 대기'. 멈춤·끊김·갈림은 색+아이콘+글자 |
| `EtaDisplay` | 도착 예상 | 화면 최대 글자. 날짜는 숨은 문장 하나로 읽히고 숫자 조각은 `aria-hidden`. D-n은 일반 예상일에만, 연휴가 겹치면 배지로 대신 |
| `NumberBar` | '조회번호 · 택배사' + 번호 | 4자리 묶음 고정폭, 말줄임 0, 묶음 사이에서만 줄바꿈. 좁으면 버튼이 다음 줄로 |
| `CopyButton` | 복사 / 복사하고 열기 | 클립보드가 막히면 내용을 고른 읽기 전용 글상자. 예외를 던지지 않음. 알림은 호출한 쪽이 `onCopied`로 |
| `AffiliateLinkGroup` | 스토어 링크 묶음 | 제휴 링크가 하나라도 있으면 확정형 고지가 첫 줄, 없으면 고지 없음. `isAffiliate` 하나가 고지와 `rel`을 정함 |
| `NoticeBanner` | 공지 배너 / 카드 안 '안내' 줄 | live region 아님. '안내' + 본문 |
| `TalkLink` | 톡톡 링크 | 한 가지 모양을 세 무게(텍스트·보조·주)로. 헤더 말고는 말풍선 아이콘 |
| `LiveAnnouncer` | 화면에 하나뿐인 polite live region | R2에서 만든 것을 그대로 씀(`useAnnounce`) |

## 10. 배치·문구 규칙

- 결과 순서 고정: 번호 바 → 상태 카드 → 도착 예상 → 지금 할 일 → 마지막 처리 → `<details>` '처리 내역 N건 보기'. 이 사이에 광고·스토어·추천·배너를 넣지 않습니다.
- 톡톡은 화면당 최대 3곳(헤더, 상태별 1곳, 푸터), 모양 1종입니다.
- 스토어·제휴 링크 묶음은 확정형 고지를 첫 줄에 둡니다. 고지 문구는 `config/site.config.ts`의 `disclosures.coupang` 한 곳에서 옵니다. 지금 문구: 쿠팡 링크는 쿠팡 파트너스 활동의 일환으로, 구매 시 운영자가 수수료를 받습니다.
- 문제 상태(오류, 장기 정체, 기준일 경과, 택배사 조회 지연, 여러 택배사)에는 스토어·추천·광고가 없습니다.
- 정상 대기 상태에는 채움 버튼이 없고 '지금은 하실 일이 없어요'가 주인공입니다.

## 11. 검사

| 검사 | 파일 | 확인하는 것 |
|---|---|---|
| 토큰 | `tests/unit/tokens.spec.ts` | 대비 기준, CSS·TS·Tailwind·이 문서·`design-system/` 값 일치, signal 보완(앰버+잉크, 빨강은 문제만, 링크 색 분리) |
| 부품 모음 | `tests/e2e/ui-kit.spec.ts` | 11px 이하 글자 0, 글자 대비 4.5:1, 포커스 링 3px·3:1, 320px 가로 스크롤 0, `aria-current` 개수, 클립보드 폴백, 한 번 모션, 줄인 모션 0 |
| 폰트 예산 | `tests/budgets/font-preload.spec.ts` | preload 2파일 이하, 첫 화면 100KB 이하, 예전 본문 웹 폰트 없음(운영 빌드) |
| 자동 접근성 검사(axe) | `tests/e2e/ui-kit.spec.ts` | 승인 13 뒤에만 추가 |

## 12. 바꾸는 방법

- 색이나 크기를 바꿀 때는 `app/styles/tokens.css`, `lib/style/tokens.ts`, 이 문서의 표, `design-system/_base.css`(tokens.css를 그대로 복사)를 한 커밋에서 함께 바꾸고 `tests/unit/tokens.spec.ts`를 돌립니다.
- 대비 기준을 통과하지 못하는 값은 쓰지 않습니다. `/internal/ui-kit`의 색 토큰 절에서 실제 비율을 볼 수 있습니다.
- 새 스타일은 토큰 세트와 네 슬롯 CSS만 더합니다. 부품의 DOM, 훅, 문구는 바꾸지 않습니다.


## 13. 보조 영역과 광고 시점

- **추천**(`components/supplementary/RecommendationList.tsx`, 규칙은 `lib/tracking/recommendations.ts`): 결과가 허용할 때만(`view.revenue.recommendations`가 `none`이 아닐 때) 결과 흐름 뒤에 둡니다. 배송 완료는 `data-primary-end` 바로 뒤, 그 밖에는 처리 내역 뒤입니다. 상품의 `contexts`에 그 상태가 있고 유효기간 안에 있을 때만 보이고, 0개면 묶음이 없습니다. 승인 10 전에는 '운영자 추천' 창으로만 열고 가격·할인·'이번 주'를 쓰지 않습니다. 승인 10 뒤에는 인라인 목록이고, 상품 상세 링크가 필수이며, '이번 주'는 유효기간 7일 이하, 가격은 확인일 7일 이내일 때만 씁니다.
- **쇼케이스**(`components/supplementary/StoreShowcase.tsx`, `data-store-showcase`): 홈 조회 전 화면에서만, '보통 이렇게 걸려요' 아래에 둡니다. 확정형 고지가 첫 줄이고 네이버·쿠팡 두 링크가 보조 무게로 옵니다.
- **수동 광고 자리**(`components/ads/ManualAdSlot.tsx`, `data-ad-slot="manual"`): 페이지당 1개, `<main>`의 마지막(푸터 묶음 바로 앞)입니다. 홈과 광고가 허용된 결과에서만 그리고, 높이를 미리 잡아 둡니다(휴대폰 280px, 768px 이상 250px, `config.ads`). 광고 단위 ID(`ads.manualSlotId`, 승인 15)가 없으면 그리지 않습니다. 조회 중과 문제 상태에는 없습니다.
- **하단 여백**: `html { scroll-padding-bottom: var(--tt-anchor-reserve) }`. 값은 `ads.anchorReservePx`(64px)와 같습니다.
- **푸터**(`components/shell/SiteFooter.tsx`): 안내 문장, '개인정보처리방침', 톡톡 한 곳(배치 `footer`). 톡톡은 화면당 최대 3곳입니다.
- **광고 시점**(승인 7, `AD_TIMING_POLICY = "afterAllowedResult"`): 홈은 첫 결과가 광고 허용 상태로 확정되거나 고객이 쇼케이스까지 스크롤한 뒤, 딥링크는 주소 정리와 허용 결과가 모두 확인된 뒤 한 번 넣습니다. 문제 상태 결과가 보이는 동안에는 넣지 않고, 같은 탭에서 나중에 허용 결과가 나오면 넣습니다. 홈 수익이 크게 줄면(spec §17 Q5) `"afterScrub"`로 되돌립니다.

## 14. 색 토큰 (manifest)

서류형(A 세관 서류): 차가운 종이 바탕, 괘선, 상태는 도장 하나, 기입값은 고정폭 숫자. 링크는 잉크 + 밑줄(도장 청색과 분리). 값의 원본은 `app/styles/style-manifest.css`와 `lib/style/tokens.ts`(`MANIFEST_COLORS`)입니다.

| 토큰 | 값 | 쓰임 |
|---|---|---|
| `--tt-ground` | `#ECEFF3` | 페이지 바탕 |
| `--tt-surface` | `#FAFBFC` | 서류 면 · 카드·입력칸 |
| `--tt-raised` | `#FAFBFC` | 한 단계 위 층(서류 면과 같음) |
| `--tt-ink` | `#14213A` | 본문·서식 틀 |
| `--tt-muted` | `#4A566B` | 라벨·보조 문장 |
| `--tt-rule` | `#C4CCD7` | 칸 나눔 괘선(글자에 쓰지 않음) |
| `--tt-control` | `#6B7689` | 입력칸 테두리 |
| `--tt-route` | `#7D8899` | 척추 점선·빈 칸 |
| `--tt-primary` | `#1B4A9A` | 채움 주 버튼(세관 청색) |
| `--tt-on-primary` | `#FFFFFF` | 주 버튼 글자 |
| `--tt-accent` | `#1B4A9A` | 강조(세관 청색) |
| `--tt-link` | `#14213A` | 링크(잉크 + 밑줄) |
| `--tt-focus` | `#14213A` | 포커스 링 |
| `--tt-tile` | `#FAFBFC` | 숫자 칸(서류 면) |
| `--tt-board` | `#14213A` | 숫자 칸 글자 |
| `--tt-tone-progress` | `#1B4A9A` | 정상 진행 채움 |
| `--tt-tone-progress-on` | `#FFFFFF` | 정상 진행 채움 위 글자 |
| `--tt-tone-progress-ink` | `#1B4A9A` | 정상 진행 글자·도장 선 |
| `--tt-tone-waiting` | `#56627A` | 정보 대기 채움 |
| `--tt-tone-waiting-on` | `#FFFFFF` | 정보 대기 채움 위 글자 |
| `--tt-tone-waiting-ink` | `#56627A` | 정보 대기 글자·도장 선 |
| `--tt-tone-attention` | `#9A5A00` | 확인 필요 채움 |
| `--tt-tone-attention-on` | `#FFFFFF` | 확인 필요 채움 위 글자 |
| `--tt-tone-attention-ink` | `#9A5A00` | 확인 필요 글자·도장 선 |
| `--tt-tone-problem` | `#B3261E` | 문제 채움(빨강은 여기에만) |
| `--tt-tone-problem-on` | `#FFFFFF` | 문제 채움 위 글자 |
| `--tt-tone-problem-ink` | `#B3261E` | 문제 글자·도장 선 |
| `--tt-tone-done` | `#185C36` | 완료 채움 |
| `--tt-tone-done-on` | `#FFFFFF` | 완료 채움 위 글자 |
| `--tt-tone-done-ink` | `#185C36` | 완료 글자·도장 선 |

| 짝 | 대비 | 기준 |
|---|---|---|
| `--tt-ink` / `--tt-surface` | 15.49:1 | 4.5:1 |
| `--tt-ink` / `--tt-ground` | 13.92:1 | 4.5:1 |
| `--tt-muted` / `--tt-surface` | 7.15:1 | 4.5:1 |
| `--tt-muted` / `--tt-ground` | 6.42:1 | 4.5:1 |
| `--tt-link` / `--tt-surface` | 15.49:1 | 4.5:1 |
| `--tt-link` / `--tt-ground` | 13.92:1 | 4.5:1 |
| `--tt-on-primary` / `--tt-primary` | 8.42:1 | 4.5:1 |
| `--tt-tone-progress-on` / `--tt-tone-progress` | 8.42:1 | 4.5:1 |
| `--tt-tone-waiting-on` / `--tt-tone-waiting` | 6.13:1 | 4.5:1 |
| `--tt-tone-attention-on` / `--tt-tone-attention` | 5.47:1 | 4.5:1 |
| `--tt-tone-problem-on` / `--tt-tone-problem` | 6.54:1 | 4.5:1 |
| `--tt-tone-done-on` / `--tt-tone-done` | 8.01:1 | 4.5:1 |
| `--tt-tone-progress-ink` / `--tt-surface` | 8.13:1 | 4.5:1 |
| `--tt-tone-waiting-ink` / `--tt-surface` | 5.92:1 | 4.5:1 |
| `--tt-tone-attention-ink` / `--tt-surface` | 5.28:1 | 4.5:1 |
| `--tt-tone-problem-ink` / `--tt-surface` | 6.31:1 | 4.5:1 |
| `--tt-tone-done-ink` / `--tt-surface` | 7.73:1 | 4.5:1 |
| `--tt-board` / `--tt-tile` | 15.49:1 | 4.5:1 |
| `--tt-control` / `--tt-surface` | 4.43:1 | 3:1 |
| `--tt-route` / `--tt-surface` | 3.46:1 | 3:1 |
| `--tt-focus` / `--tt-surface` | 15.49:1 | 3:1 |
| `--tt-focus` / `--tt-ground` | 13.92:1 | 3:1 |

- 글꼴: 한글 제목은 설치된 명조(`AppleMyungjo`, `Nanum Myeongjo`, `Batang` …, 없으면 serif), 본문은 기본과 같은 시스템 고딕, 숫자는 IBM Plex Mono 600(`--font-plex-mono`, preload 없음). 웹 한글 제목 글꼴(Hahmlet)은 CSS 예산 때문에 쓰지 않습니다.
- 변형 슬롯: `status-head` 종이 면 + 2° 기울어진 겹테두리 도장 칩, `eta` 밑줄 칸 위 고정폭 기입값, `journey` 지나온 길 실선·남은 길 점선, `button` 모서리 2px·테두리 1px.

## 15. 색 토큰 (night)

어두운 화면(C 야간 관제): 채도를 뺀 어두운 바탕, 층은 흐림 없이 밝기 단계로만, 상태는 평면 램프, 날짜는 숫자 타일. 링크는 잉크 + 밑줄(램프 파랑과 분리). 값의 원본은 `app/styles/style-night.css`와 `lib/style/tokens.ts`(`NIGHT_COLORS`)입니다.

| 토큰 | 값 | 쓰임 |
|---|---|---|
| `--tt-ground` | `#0C1214` | 페이지 바탕 |
| `--tt-surface` | `#131B1E` | 결과 면 |
| `--tt-raised` | `#1A2428` | 상태 머리·한 단계 위 층 |
| `--tt-ink` | `#E6ECE9` | 본문 글자 |
| `--tt-muted` | `#9AA8AC` | 보조 글자 |
| `--tt-rule` | `#27343A` | 가는 선(글자에 쓰지 않음) |
| `--tt-control` | `#62757C` | 입력칸 테두리 |
| `--tt-route` | `#6E8288` | 노선 점선·빈 역 |
| `--tt-primary` | `#8FB3F0` | 채움 주 버튼(관제 파랑) |
| `--tt-on-primary` | `#0C1214` | 주 버튼 글자 |
| `--tt-accent` | `#8FB3F0` | 강조(관제 파랑) |
| `--tt-link` | `#E6ECE9` | 링크(잉크 + 밑줄) |
| `--tt-focus` | `#E6ECE9` | 포커스 링 |
| `--tt-tile` | `#080C0E` | 숫자 타일 바탕 |
| `--tt-board` | `#F1E8D4` | 숫자 타일 글자 |
| `--tt-tone-progress` | `#8FB3F0` | 정상 진행 램프·채움 |
| `--tt-tone-progress-on` | `#0C1214` | 정상 진행 채움 위 글자 |
| `--tt-tone-progress-ink` | `#8FB3F0` | 정상 진행 글자 |
| `--tt-tone-waiting` | `#A3AFB3` | 정보 대기 램프·채움 |
| `--tt-tone-waiting-on` | `#0C1214` | 정보 대기 채움 위 글자 |
| `--tt-tone-waiting-ink` | `#A3AFB3` | 정보 대기 글자 |
| `--tt-tone-attention` | `#E8A847` | 확인 필요 램프·채움 |
| `--tt-tone-attention-on` | `#0C1214` | 확인 필요 채움 위 글자 |
| `--tt-tone-attention-ink` | `#E8A847` | 확인 필요 글자 |
| `--tt-tone-problem` | `#EF7C71` | 문제 램프·채움(빨강 계열은 여기에만) |
| `--tt-tone-problem-on` | `#0C1214` | 문제 채움 위 글자 |
| `--tt-tone-problem-ink` | `#EF7C71` | 문제 글자 |
| `--tt-tone-done` | `#74CB9B` | 완료 램프·채움 |
| `--tt-tone-done-on` | `#0C1214` | 완료 채움 위 글자 |
| `--tt-tone-done-ink` | `#74CB9B` | 완료 글자 |

| 짝 | 대비 | 기준 |
|---|---|---|
| `--tt-ink` / `--tt-surface` | 14.58:1 | 4.5:1 |
| `--tt-ink` / `--tt-ground` | 15.77:1 | 4.5:1 |
| `--tt-muted` / `--tt-surface` | 7.12:1 | 4.5:1 |
| `--tt-muted` / `--tt-ground` | 7.71:1 | 4.5:1 |
| `--tt-link` / `--tt-surface` | 14.58:1 | 4.5:1 |
| `--tt-link` / `--tt-ground` | 15.77:1 | 4.5:1 |
| `--tt-on-primary` / `--tt-primary` | 8.88:1 | 4.5:1 |
| `--tt-tone-progress-on` / `--tt-tone-progress` | 8.88:1 | 4.5:1 |
| `--tt-tone-waiting-on` / `--tt-tone-waiting` | 8.40:1 | 4.5:1 |
| `--tt-tone-attention-on` / `--tt-tone-attention` | 9.10:1 | 4.5:1 |
| `--tt-tone-problem-on` / `--tt-tone-problem` | 7.01:1 | 4.5:1 |
| `--tt-tone-done-on` / `--tt-tone-done` | 9.67:1 | 4.5:1 |
| `--tt-tone-progress-ink` / `--tt-surface` | 8.21:1 | 4.5:1 |
| `--tt-tone-waiting-ink` / `--tt-surface` | 7.76:1 | 4.5:1 |
| `--tt-tone-attention-ink` / `--tt-surface` | 8.41:1 | 4.5:1 |
| `--tt-tone-problem-ink` / `--tt-surface` | 6.48:1 | 4.5:1 |
| `--tt-tone-done-ink` / `--tt-surface` | 8.94:1 | 4.5:1 |
| `--tt-board` / `--tt-tile` | 16.12:1 | 4.5:1 |
| `--tt-control` / `--tt-surface` | 3.62:1 | 3:1 |
| `--tt-route` / `--tt-surface` | 4.33:1 | 3:1 |
| `--tt-focus` / `--tt-surface` | 14.58:1 | 3:1 |
| `--tt-focus` / `--tt-ground` | 15.77:1 | 3:1 |

- 글꼴: 한글은 시스템 고딕, 숫자는 JetBrains Mono 500(`--font-jetbrains-mono`, preload 없음). `color-scheme: dark`로 스크롤 막대와 입력 부품도 어둡게 그립니다.
- 변형 슬롯: `status-head` 한 단계 밝은 층 + 상태 톤 윗선, 칩 앞 둥근 램프(`::before`), `eta` 숫자마다 `--tt-tile` 칸 위 `--tt-board` 글자, `journey` 가는 선·점선·둥근 현재 역, `button` 모서리 4px·테두리 1px.

## 16. 화면 스타일 고르기와 첫 페인트

- **고르기**: 푸터 바로 위 `StylePicker`(`components/shell/StylePicker.tsx`, `data-style-picker`). fieldset + legend '화면 스타일', 라디오 3개(기본·서류형·어두운 화면, 각 44px). 바꾸면 `html[data-style]`만 바뀌고 live region이 '화면 스타일을 {label}으로 바꿨어요'를 한 번 읽습니다. 부품의 DOM·`data-*` 훅·문구·배치는 스타일과 무관하고, `tests/unit/prepaint.spec.ts`가 스타일을 읽는 파일을 레이아웃·스타일 모듈·고르기 부품으로 제한합니다.
- **저장**: `localStorage` `tt:style` 한 값(`signal` | `manifest` | `night`). 개인정보가 아니고 서버로 보내지 않습니다. 저장소가 막히면 그 화면 안에서만 바뀝니다.
- **첫 페인트 전**: `lib/style/prepaint.ts`의 `PREPAINT_SCRIPT`가 `<head>`에서 스타일을 정합니다(저장된 선택 → 기기 어두운 모드면서 `data-follow-dark="1"`이면 night → 아니면 signal). 글이 상수라서 해시 `PREPAINT_SCRIPT_SHA256`가 CSP Report-Only의 `script-src`에 들어갑니다(`next.config.ts`). 글을 바꾸면 해시를 새로 계산하고 `tests/unit/prepaint.spec.ts`를 돌립니다. `data-follow-dark`는 `config/site.config.ts`의 `style.followSystemDark`(기본 true)입니다.
- **글꼴 예산**: 기본은 DM Mono 한 파일만 preload합니다. 서류형·어두운 화면의 숫자 글꼴은 preload하지 않고 그 스타일의 토큰에서만 쓰므로 그 스타일일 때만 내려받습니다(`tests/budgets/font-preload.spec.ts`).
- **검사**: `tests/unit/tokens.spec.ts`(세 스타일의 값·대비·보완), `tests/e2e/ui-kit.spec.ts`(스타일별 11px 이하 0·글자 대비·포커스 링·320px), `tests/e2e/style-picker.spec.ts`(첫 페인트 규칙, 고르기, 막힌 저장소), `tests/visual/style-matrix.spec.ts`(핵심 8상태 × 375·1440 × 3스타일 = 48장, `PW_VISUAL=1`), `tests/e2e/style-a11y.spec.ts`(승인 13 뒤 axe).
