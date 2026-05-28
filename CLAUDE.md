# CLAUDE.md

이 문서는 `통관정보 웹페이지 생성` 프로젝트의 기본 개발 규칙과 작업 컨텍스트를 정의한다.

## 1) 프로젝트 목적

- 구매대행 고객이 통관/국내 배송 상태를 단일 페이지에서 조회할 수 있게 하여 CS 문의를 줄인다.
- 운영 URL은 `https://tracking.tipoasis.com`을 기준으로 한다.
- 개인정보 최소 수집 원칙을 지키며 조회 기록은 저장하지 않는다.

## 2) 기술 스택

- Framework: Next.js 14 (App Router)
- Language: TypeScript
- UI: React 18, Tailwind CSS 3.4, shadcn/ui, Radix UI 기반 컴포넌트
- Data parsing: `xml2js` (UNI-PASS XML), `cheerio` (CJ HTML)
- Validation: `zod`
- Cache: `node-cache` (15분 기본 TTL)
- Animation: `framer-motion`
- Test: Playwright (E2E)
- Hosting: ChemiCloud Shared Hosting (Node.js App, Node 18+)

## 3) 코딩 규칙

- Type safety 우선: `any` 사용 금지, 임시 무시 주석(`@ts-ignore`) 금지.
- API 키는 서버 전용으로 사용하고 `NEXT_PUBLIC_` 접두사에 넣지 않는다.
- 클라이언트는 외부 API를 직접 호출하지 않고 `POST /api/track`만 사용한다.
- 입력/응답은 Zod 스키마로 런타임 검증한다.
- 버그 수정 시 범위를 최소화하고 리팩터링과 분리한다.
- 기존 파일/패턴이 존재하면 우선적으로 동일한 스타일을 따른다.

## 4) 디렉토리 구조 기준

- `app/`: App Router, 페이지/레이아웃/API route
- `components/`: UI/도메인 컴포넌트
- `lib/services/`: 통관/배송/식별/정규화 서비스
- `lib/`: 캐시, 스키마, 타입, 공통 유틸
- `tests/`: Playwright E2E
- `public/`: 정적 파일

## 5) 개발 워크플로우

1. Plan.md 기준으로 현재 Phase 범위를 먼저 확정한다.
2. 구현 전 입력/출력 스키마와 에러 코드를 먼저 고정한다.
3. 서버 API(route/services) 구현 후 UI 컴포넌트 연결 순서로 진행한다.
4. 각 Phase 종료 시 검증 루프를 실행한다.

## 6) Phase 검증 루프 (빠른 루프)

- Lint/Typecheck: 타입 및 정적 검사
- Build: `next build` 성공 확인
- E2E smoke: 핵심 1~2 시나리오 우선 확인
- 결과 기록: 실패 원인/수정 포인트를 Plan.md 또는 작업 로그에 반영

## 7) 반복 패턴 슬래시 커맨드 표준

자주 반복되는 절차는 슬래시 커맨드로 고정해 작업 시간을 줄인다.

- `/phase-kickoff`: 이번 Phase 목표/범위/완료 조건 정리
- `/phase-verify`: lint/typecheck/build/e2e smoke 일괄 실행
- `/api-contract-check`: Zod 스키마와 API 응답 형태 일치 검토
- `/deploy-check`: 환경변수/standalone 빌드/런타임 확인

새 반복 패턴이 2회 이상 발생하면 슬래시 커맨드 후보로 추가한다.

## 8) 배포 이슈 재발 방지 규칙 (CloudLinux)

- 배포/재배포 지시가 들어오면 `DEPLOYMENT.md`의 `CloudLinux Safe Deploy (Next.js standalone)` 절을 우선 참조한다.
- cPanel `Application startup file`은 반드시 `.next/standalone/server.js`로 유지한다.
- 배포 아카이브에는 루트 `node_modules/`를 포함하지 않는다.
- 화면 스타일 깨짐 발생 시 `.next/standalone/.next/static` 및 `.next/standalone/public` 존재 여부를 먼저 확인한다.
