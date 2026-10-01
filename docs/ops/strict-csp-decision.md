# 결정 기록: strict nonce CSP (승인 16)

## 배경

- R0부터 보안 헤더 1단계를 씁니다: 최소 강제 CSP(`base-uri`, `object-src`, `frame-ancestors`, `form-action`)와 넓은 Report-Only 정책(`lib/security/headers.ts`).
- R5부터 Report-Only 위반을 `/api/csp-report`로 모읍니다(`lib/security/csp-report.ts`). 번호 경로 문서는 보고하지 않습니다. 보고서의 문서 주소(document-uri)에 조회번호가 들어가기 때문입니다.
- 서버는 보고서를 저장하지 않고, 번호 없는 요약 한 줄(`csp_report {...}`)만 런타임 로그에 남깁니다. 같은 줄은 서버 인스턴스마다 10분에 한 번, 분당 최대 60줄입니다.
- strict nonce CSP는 요청마다 새 nonce를 페이지에 넣어야 합니다. 그러려면 '/'를 정적 렌더(CDN HIT, revalidate 300초)에서 요청마다 그리는 동적 렌더로 바꿔야 해서, 스펙 §12의 '/' HTML·LCP·CDN 목표와 부딪힙니다(스펙 §16 항목 16).

## 선택지

| 안 | 내용 | 치르는 것 | 남는 위험 |
|---|---|---|---|
| A | nonce 기반 strict CSP를 강제합니다. `proxy.ts`에서 요청마다 nonce를 만들고 헤더에 넣으며, 공개 페이지를 모두 동적 렌더로 바꿉니다. | '/'의 CDN HIT, TTFB와 LCP 여유. 동결 파일 `proxy.ts` 변경 승인. 광고 로더(`AdLoader`)와 화면 스타일 스크립트에 nonce 전달. | 광고 스크립트가 넣는 하위 스크립트가 막히면 광고가 사라질 수 있음 |
| B | 해시 기반 strict CSP로 정적 렌더를 지킵니다. | Next.js가 페이지마다 넣는 인라인 스크립트의 해시를 빌드마다 모아야 함 | 빌드마다 해시가 바뀌어 운영 부담이 큼 |
| C | 1단계 헤더를 유지하고 Report-Only 관찰을 계속합니다. | 없음 | 스크립트 주입 방어가 브라우저 기본값과 최소 강제 CSP에 머묾 |

## 관찰 자료(결정 전 2주)

- Vercel 대시보드 → 프로젝트 `tracking-tipoasis` → Logs에서 `csp_report`로 검색합니다.
- 하루에 나타난 서로 다른 줄을 `directive`, `blocked`, `blockedHost`, `documentKind`별로 셉니다. 같은 줄은 인스턴스마다 10분에 한 번만 남으므로, 숫자는 "위반 종류가 나타난 빈도"로 읽습니다.
- 특히 볼 것: `blocked` = inline(Next.js 인라인 스크립트), `blockedHost`가 광고 도메인이 아닌 외부 주소(모르는 스크립트), `documentKind` = internal(내부 도구).

| 날짜 | directive | blocked | blockedHost | documentKind | 줄 수 |
|---|---|---|---|---|---|
| | | | | | |

## 결정

- 상태: 승인 16 보류(2026-09-27, Report-Only 관찰 뒤 결정). C안: 1단계 헤더를 유지합니다(스펙 §16 항목 16 '거절하면'). Report-Only 관찰과 요약 로그는 계속합니다.
- 다시 볼 조건: 모르는 외부 주소의 스크립트 위반이 관찰되거나, '/'를 다른 이유로 동적 렌더로 바꾸게 되면 이 기록을 다시 엽니다.
