# 제안: /internal 실패 시도 제한(Vercel WAF)

- 상태: 제안. 운영자가 Vercel 대시보드의 Firewall에서 적용합니다. 에이전트는 방화벽 설정을 바꾸지 않습니다.
- 배경: `/internal`은 `proxy.ts`의 기본 인증으로 보호됩니다. 비밀번호를 여러 번 틀려도 막는 장치가 없습니다(스펙 §10 "실패 시도 제한은 Vercel WAF 규칙으로 제안", SEC-07).
- 한계: WAF 규칙은 요청을 보고 판단하므로 틀린 비밀번호 응답(401)만 골라 셀 수 없습니다. 그래서 `/internal` 요청 전체를 IP별로 제한합니다. CS 담당자는 분당 몇 번만 페이지를 열고, 일괄 조회는 `/api/track`으로 가므로 이 제한에 걸리지 않습니다.

## 규칙 1: /internal 요청 제한

- 이름: `internal-rate-limit`
- 조건: Request Path, Starts with, `/internal`
- 동작: Rate Limit, Fixed Window, 창 60초, 기준 IP, 한도 20회, 넘으면 429(기본 응답), 막는 시간 10분
- 도입: 먼저 동작을 Log로 두고 1주 동안 걸린 요청이 CS 담당자의 정상 사용인지 봅니다. 정상 사용이 걸리지 않았으면 429로 바꿉니다.

## 규칙 2: /api/csp-report 요청 제한

- 이름: `csp-report-rate-limit`
- 조건: Request Path, Equals, `/api/csp-report`
- 동작: Rate Limit, Fixed Window, 창 60초, 기준 IP, 한도 30회, 넘으면 429
- 이유: 보고서 엔드포인트는 누구나 POST할 수 있습니다. 서버는 로그 줄 수를 스스로 제한하지만, 함수 호출 수는 이 규칙으로 줄입니다.

## 선택: 사무실 IP만 허용

- CS 담당자가 고정 IP에서만 일한다면 규칙 1 앞에 "Request Path가 `/internal`로 시작하고 IP가 사무실 IP가 아니면 Deny" 규칙을 둘 수 있습니다. 재택·휴대폰 작업이 있으면 쓰지 않습니다.

## 적용 순서

1. Vercel 대시보드 → 프로젝트 `tracking-tipoasis` → Firewall → Rules → New Rule에서 규칙 1을 만들고 Publish합니다.
2. 같은 방법으로 규칙 2를 만들고 Publish합니다.
3. 확인: 규칙 1을 429로 바꾼 뒤, 틀린 비밀번호로 `/internal/cs-helper`를 1분 안에 21번 이상 열면 429가 나오는지 봅니다. 10분 뒤 다시 열리는지도 봅니다.
4. 적용한 날짜와 한도를 아래 표에 적습니다.

| 날짜 | 규칙 | 동작(Log·429) | 한도 | 확인한 사람 |
|---|---|---|---|---|
| | | | | |

## 되돌리기

- Firewall → Rules에서 규칙을 끄고 Publish합니다. 기본 인증은 그대로 남습니다.
