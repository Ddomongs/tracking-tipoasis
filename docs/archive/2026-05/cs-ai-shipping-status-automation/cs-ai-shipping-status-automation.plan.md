# CS AI Shipping Status Automation Planning Document

> **Summary**: QuickStar 배송대행지 상태를 내부 CS AI비서가 사용할 수 있는 안전한 자동 응답 데이터로 정규화한다.
>
> **Project**: tracking-tipoasis
> **Version**: 0.1
> **Author**: Codex
> **Date**: 2026-05-31
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

스마트스토어 고객 문의 중 "배송 어디까지 왔나요?", "통관이 왜 지연되나요?", "운송장번호 알려주세요" 유형을 내부 CS AI비서가 빠르고 일관되게 응대할 수 있도록 QuickStar 신청서 조회 API 응답을 CS 응답용 상태 모델로 변환한다.

### 1.2 Background

현재 고객 공개 조회 페이지는 HBL/화물관리번호 기반 UNI-PASS 통관 조회와 국내 운송장 기반 CJ대한통운 배송 조회에 집중한다. 하지만 실제 CS에서는 국내 송장이 발급되기 전 배송대행지 상태, 출고보류, 무게측정, 결제확인, 통관번호 불일치 같은 선행 이슈가 더 자주 문의로 들어온다.

QuickStar 신청서 조회 API는 `invoice`, `invoiceNo`, `orderState`, `pending`, `RecInfo[].unipassResult`를 제공하므로 고객에게 노출할 최소 정보와 내부 조치가 필요한 경고를 분리하면 CS 자동화에 바로 활용할 수 있다.

### 1.3 Related Documents

- Project plan: `Plan.md`
- Deployment notes: `DEPLOYMENT.md`
- Current public API: `app/api/track/route.ts`
- Current schemas: `lib/schemas.ts`, `lib/types.ts`
- QuickStar reference: user-provided OPEN API v1.0 excerpts

---

## 2. Scope

### 2.1 In Scope

- [ ] 운송장번호만 입력하면 현재 보유한 통관/배송 조회 로직을 기준으로 고객 안내 문구를 생성하는 내부 화면 설계
- [ ] 배송 안내 문구를 복사/붙여넣기 할 수 있는 복사 기능 설계
- [ ] 배송 안내 조회 결과는 별도 저장하지 않는 정책 수립
- [ ] 통관부호 불일치 전용 탭 설계
- [ ] 통관부호 불일치 대상자의 휴대폰 번호와 안내 내용을 저장하고 목록에서 확인하는 기능 설계
- [ ] 향후 카카오 알림톡 API 연동을 고려한 템플릿, 발송 버튼, 발송 이력 구조 초안 정의
- [ ] QuickStar 신청서 조회 API를 호출하는 서버 전용 클라이언트 설계
- [ ] `orderState`, `pending`, `invoice`, `invoiceNo`, `RecInfo[].unipassResult` 중심의 내부 CS 상태 모델 정의
- [ ] 스마트스토어 문의 응대용 자동 답변 템플릿 매핑
- [ ] 통관번호 불일치, 출고보류, 결제대기/확인중 등 내부 조치 필요 상태 감지
- [ ] 개인정보 최소화: AI비서/응답 API에는 주소, 전화번호, 개인통관번호 원문 미전달
- [ ] 캐시 TTL, 장애 fallback, 에러 코드 정책 수립
- [ ] 1차 내부 API 후보 설계: `POST /api/internal/cs-shipping-status`

### 2.2 Out of Scope

- 고객 공개 페이지에 QuickStar 원본 데이터를 직접 노출
- QuickStar 신청서 접수, 수정, 폐기 자동화
- 스마트스토어 API/톡톡/CRM/카카오 알림톡 실제 발송 연동
- 배송 안내 조회 기록 저장
- 개인정보 원문 영구 저장
- CJ 외 택배사의 상세 배송 이벤트 파싱 구현
- QuickStar 회원가입 API 또는 API 계정 생성 자동화

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 신청번호 또는 그룹번호로 QuickStar 신청서 조회 API를 호출한다. | High | Pending |
| FR-02 | `invoice`와 `invoiceNo`를 국내 운송장 안내 문구로 변환한다. | High | Pending |
| FR-03 | `orderState`를 고객 친화적인 배송대행지 단계와 CS 답변 템플릿으로 매핑한다. | High | Pending |
| FR-04 | `RecInfo[].unipassResult`가 `0`이면 통관번호 불일치 경고와 내부 조치 안내를 생성한다. | High | Pending |
| FR-05 | `pending`이 `1`이면 출고보류 상태를 감지하고 자동 답변을 보수적으로 생성한다. | High | Pending |
| FR-06 | QuickStar 원본 응답에서 주소, 전화번호, 개인통관번호 등 민감 필드를 제거한 내부 DTO만 반환한다. | High | Pending |
| FR-07 | 택배사 코드 `26`은 CJ대한통운으로 우선 매핑하고, 미지원 코드는 코드값과 "확인 필요" 상태로 반환한다. | Medium | Pending |
| FR-08 | API 장애/타임아웃/조회 결과 없음에 대해 CS AI비서가 사용할 수 있는 안전한 fallback 메시지를 반환한다. | Medium | Pending |
| FR-09 | 같은 신청번호 반복 조회는 짧은 TTL 캐시로 외부 API 호출을 줄인다. | Medium | Pending |
| FR-10 | 내부 CS 화면에서 운송장번호만 입력해 배송 상태 기반 고객 안내문을 생성한다. | High | Pending |
| FR-11 | 생성된 배송 안내문은 버튼 클릭으로 클립보드에 복사할 수 있어야 한다. | High | Pending |
| FR-12 | 배송 안내 조회 결과와 복사 이력은 저장하지 않는다. | High | Pending |
| FR-13 | 내부 CS 화면에 `배송 안내` 탭과 `통관부호 불일치` 탭을 분리 구성한다. | High | Pending |
| FR-14 | 통관부호 불일치 탭에서 휴대폰 번호, 운송장/주문 메모, 안내 내용을 저장할 수 있어야 한다. | High | Pending |
| FR-15 | 저장된 통관부호 불일치 항목은 목록에서 휴대폰 번호와 내용을 확인하고 복사할 수 있어야 한다. | High | Pending |
| FR-16 | 카카오 알림톡 API 연동 전까지 발송 버튼은 비활성/준비중 상태로 두되, 향후 템플릿 발송과 이력관리 확장이 가능해야 한다. | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Security | QuickStar API key와 user-session은 서버 환경변수로만 관리한다. | `.env.example`, 코드 리뷰 |
| Privacy | 배송 안내 조회 기록은 저장하지 않고, 통관부호 불일치 탭은 문자 발송에 필요한 휴대폰 번호와 안내 내용만 저장한다. | DTO 테스트, 저장 데이터 검증 |
| Reliability | QuickStar 장애 시 AI비서가 허위 상태를 답하지 않고 확인 요청 문구를 반환한다. | mocked API failure test |
| Performance | 캐시 hit 기준 300ms 이내, 외부 API call 기준 5초 timeout 정책을 둔다. | API route test/log |
| Maintainability | 상태 코드와 답변 템플릿은 별도 매핑 파일에서 관리한다. | 코드 구조 리뷰 |

---

## 4. CS Status Model

### 4.1 Input Candidates

1. `orderNo`: QuickStar 그룹번호 또는 신청번호
2. `userId`: QuickStar 회원아이디, 서버 설정 기본값 사용 가능
3. `questionType`: 선택값. `shipping_status`, `invoice_request`, `customs_delay`, `general`
4. `invoiceNumber`: 내부 CS 화면의 배송 안내 탭에서 사용하는 국내 운송장번호

### 4.2 Normalized Internal DTO

```ts
type CsShippingStatus = {
  lookupId: string;
  source: "quickstar";
  stateCode: string | null;
  stateLabel: string;
  stateStage:
    | "warehouse_waiting"
    | "warehouse_processing"
    | "payment_pending"
    | "preparing_dispatch"
    | "dispatched"
    | "discarded"
    | "unknown";
  pending: boolean;
  carrierCode: string | null;
  carrierName: string | null;
  invoiceNumber: string | null;
  customsIdentity:
    | "matched"
    | "mismatched"
    | "unknown"
    | "not_available";
  customerReply: string;
  internalAlerts: string[];
  nextAction: string | null;
  confidence: "high" | "medium" | "low";
  checkedAt: string;
};
```

### 4.3 Internal CS Tool Draft

내부 CS 도구는 공개 고객 조회 페이지와 분리된 화면으로 설계한다. 1차 목표는 상담원이 운송장번호만 입력해 고객에게 붙여넣을 수 있는 안내문을 얻고, 통관부호 불일치 대상자는 별도 탭에 저장해 문자 발송 준비 목록으로 관리하는 것이다.

| Tab | Input | Output | Save Policy |
|-----|-------|--------|-------------|
| 배송 안내 | 운송장번호 | 현재 상태, 최근 처리 이력, 복사 가능한 고객 안내문 | 저장 안 함 |
| 통관부호 불일치 | 휴대폰 번호, 운송장/주문 메모, 안내 내용 | 저장 목록, 내용 복사, 향후 발송 버튼 자리 | 저장 |

배송 안내 탭은 기존 `POST /api/track` 또는 후속 내부 CS API를 통해 얻은 `currentStatus`, `delivery.invoiceNumber`, `delivery.carrier`, 최신 배송/통관 이벤트를 바탕으로 문구를 생성한다.

통관부호 불일치 탭은 초기에는 문자 발송 전 수동 관리용으로 동작한다. 다음 단계에서 카카오 알림톡 API를 연결할 때 동일한 저장 데이터에 `templateCode`, `sendStatus`, `sentAt`, `providerMessageId`, `failureReason` 필드를 추가할 수 있도록 설계한다.

### 4.4 QuickStar State Mapping Draft

| QuickStar field | Value | Normalized Stage | CS Meaning | Reply Direction |
|-----------------|-------|------------------|------------|-----------------|
| `orderState` | empty | `warehouse_waiting` | 입고대기 또는 입고완료 | 아직 배송대행지 처리 단계로 안내 |
| `orderState` | `303` | `warehouse_processing` | 무게측정 | 무게 측정 후 결제/출고 단계 예정 |
| `orderState` | `304` | `payment_pending` | 결제대기 | 결제 확인 필요 가능성 안내 |
| `orderState` | `305` | `payment_pending` | 결제확인중 | 결제 확인 후 출고 준비 예정 |
| `orderState` | `306` | `preparing_dispatch` | 출고준비 | 국내/통관 진행 전 출고 준비 중 |
| `orderState` | `307` | `dispatched` | 출고완료 | 송장 있으면 운송장 안내, 없으면 반영 대기 |
| `orderState` | `_peki` | `discarded` | 폐기 | 내부 확인 필요, 자동 긍정 답변 금지 |
| `orderState` | `303_peki` | `discarded` | 무게측정 후 폐기 | 내부 확인 필요, 자동 긍정 답변 금지 |

### 4.5 Unipass Result Mapping Draft

| QuickStar field | Value | Meaning | Internal Handling |
|-----------------|-------|---------|-------------------|
| `RecInfo[].unipassResult` | `1` | 통관번호 일치 | 정상 안내 가능 |
| `RecInfo[].unipassResult` | `0` | 통관번호 불일치 | 고객 답변 전 내부 알림 생성, 자동 출고 안내 금지 |
| `RecInfo[].unipassResult` | `3` | 기타/확인 필요 | 보수적 안내, 내부 확인 권장 |
| missing | - | 확인 불가 | AI비서 응답 confidence 낮춤 |

---

## 5. Success Criteria

### 5.1 Definition of Done

- [ ] QuickStar 조회 응답 fixture 기반으로 상태 정규화 테스트가 통과한다.
- [ ] `invoice`가 있으면 고객 답변에 운송장번호와 택배사명이 포함된다.
- [ ] 운송장번호만 입력해 복사 가능한 배송 안내문을 생성할 수 있다.
- [ ] 배송 안내 조회 결과는 저장되지 않는다.
- [ ] 통관부호 불일치 탭에서 휴대폰 번호와 안내 내용을 저장하고 다시 확인할 수 있다.
- [ ] 통관부호 불일치 안내 내용은 복사할 수 있다.
- [ ] 카카오 알림톡 발송 버튼과 이력관리 확장 지점이 설계되어 있다.
- [ ] `unipassResult = 0`이면 고객에게 단정 답변하지 않고 내부 조치 알림이 생성된다.
- [ ] 민감 필드가 내부 API 응답 DTO에 포함되지 않는다.
- [ ] QuickStar 장애/timeout/조회 실패 시 안전한 fallback 응답이 반환된다.
- [ ] `.env.example`에 QuickStar 서버 전용 환경변수 예시가 추가된다.
- [ ] 린트, 타입체크, 빌드가 통과한다.

### 5.2 Quality Criteria

- [ ] 상태 매핑 로직은 순수 함수로 분리되어 단위 테스트가 가능하다.
- [ ] 답변 템플릿은 코드에 흩어지지 않고 한 곳에서 관리된다.
- [ ] 고객 공개 API와 내부 CS API의 응답 스키마가 분리된다.
- [ ] 조회 기록을 저장하지 않는다. 캐시는 메모리 TTL만 사용한다.

---

## 6. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| QuickStar API key/token 노출 | High | Medium | 서버 전용 환경변수 사용, 기존 노출 키는 재발급 검토 |
| 개인정보가 AI비서로 과다 전달 | High | Medium | 원본 응답을 DTO 변환 후 폐기, allowlist 방식 반환 |
| 상태 코드 의미 오해로 잘못된 CS 답변 생성 | High | Medium | 상태 매핑 fixture 테스트와 "confidence" 필드 도입 |
| QuickStar 장애 시 허위 답변 | Medium | Medium | timeout과 fallback 답변, `unknown` 상태 처리 |
| `invoiceNo` 코드가 CJ 외 택배사일 때 배송조회 불가 | Medium | Medium | 1차는 택배사명 안내만 제공, 상세 조회는 후속 확장 |
| 고객 공개 페이지와 내부 CS 기능이 섞임 | Medium | Low | `/api/internal/*`로 분리하고 공개 UI에는 연결하지 않음 |

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Characteristics | Selected |
|-------|-----------------|:--------:|
| **Starter** | Simple structure, static sites | - |
| **Dynamic** | Feature-based modules, BaaS/API integration | Yes |
| **Enterprise** | Strict layer separation, microservices | - |

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Public vs internal API | Extend `/api/track` / create internal endpoint | Internal endpoint | CS AI비서 전용 정보와 공개 고객 조회 정보를 분리한다. |
| QuickStar client location | API route inline / service module | `lib/services/quickstar.ts` | 기존 `customs.ts`, `delivery.ts` 패턴과 맞춘다. |
| State mapping | Inline conditionals / pure mapper | `lib/services/cs-status.ts` | 테스트와 유지보수성을 높인다. |
| Validation | Manual checks / Zod schemas | Zod schemas | 프로젝트 규칙과 일치한다. |
| Cache | No cache / node-cache | node-cache TTL | 동일 문의 반복 대응 시 외부 API 부하를 줄인다. |
| Storage | Persist all lookups / mismatch-only storage / no persistence | Mismatch-only storage | 배송 안내는 저장하지 않고 통관부호 불일치 문자 준비 데이터만 저장한다. |

### 7.3 Candidate File Layout

```text
app/
  api/
    internal/
      cs-shipping-status/
        route.ts
  internal/
    cs-helper/
      page.tsx
components/
  InternalCsHelper.tsx
lib/
  services/
    quickstar.ts
    cs-status.ts
    cs-reply-template.ts
  schemas.ts
  types.ts
tests/
  cs-shipping-status.spec.ts
  internal-cs-helper.spec.ts
```

### 7.4 Environment Variables

```text
QUICKSTAR_USER_ID=
QUICKSTAR_USER_SESSION=
QUICKSTAR_APPLICATION_INQUIRY_URL=https://quickstar.co.kr/elpisapi2/applicationInquiry_api.php
```

`QUICKSTAR_MEMBER_JOIN_KEY`, `QUICKSTAR_EXTRA_SERVICE_KEY` 등 접수/조회 외 키는 1차 범위에서 사용하지 않는다.

---

## 8. Implementation Phases

### Phase 1: Contract and Fixtures

- 운송장번호 입력 기반 배송 안내 화면 요구사항 확정
- 통관부호 불일치 저장 데이터 모델 확정
- QuickStar 신청서 조회 성공/결과없음/통관번호불일치/출고완료 fixture 작성
- 내부 CS 응답 DTO와 Zod 스키마 확정
- 상태 코드와 답변 템플릿 초안 확정

### Phase 2: QuickStar Client

- 서버 전용 QuickStar 조회 client 구현
- timeout, HTTP error, API error response 정규화
- node-cache 기반 TTL 캐시 적용

### Phase 3: CS Status Normalizer

- `orderState`, `pending`, `invoiceNo`, `unipassResult` 매핑 함수 구현
- 고객 답변 문구와 내부 알림 생성
- 민감 필드 allowlist 검증

### Phase 4: Internal CS UI

- 배송 안내 탭 구현: 운송장번호 입력, 상태 조회, 고객 안내문 생성, 복사 버튼
- 배송 안내 탭은 조회/복사 이력을 저장하지 않음
- 통관부호 불일치 탭 구현: 휴대폰 번호, 운송장/주문 메모, 안내 내용 입력 및 저장
- 저장된 불일치 항목 목록, 내용 복사, 삭제/정리 흐름 구현
- 카카오 알림톡 발송 버튼은 준비중 상태로 배치하고 실제 발송은 후속 Phase로 분리

### Phase 5: Internal API

- `POST /api/internal/cs-shipping-status` 구현
- 요청 검증, 인증/보호 방식 결정
- CS AI비서 연동용 JSON 응답 반환

### Phase 6: Kakao Alimtalk Preparation

- 알림톡 템플릿 코드, 템플릿 변수, 발송 대상, 발송 상태 모델 정의
- 발송 이력 테이블 또는 저장소 구조 설계
- API provider 장애/실패 재시도 정책 초안 작성
- 실제 카카오 알림톡 API 연동은 별도 승인 후 구현

### Phase 7: Verification

- unit/route test 작성
- 내부 CS 화면 E2E: 배송 안내문 생성/복사, 불일치 항목 저장/목록 확인
- lint/typecheck/build 실행
- 대표 CS 시나리오 5개 수동 검증

---

## 9. Example Reply Templates

### 9.1 Invoice Available

```text
현재 출고가 완료되어 국내 배송 단계로 넘어갔습니다. 택배사는 {carrierName}, 운송장번호는 {invoiceNumber}입니다.
```

### 9.1.1 Invoice Only Delivery Guide

```text
현재 {carrierName} 운송장번호 {invoiceNumber}는 {currentStatus} 단계로 확인됩니다.
최근 처리: {latestEventStatus} ({latestEventDatetime}, {latestEventLocation})
```

### 9.2 Weight Measurement

```text
현재 배송대행지에서 무게 측정 단계입니다. 무게 측정과 배송비 확인이 끝나면 결제 확인 및 출고 준비 단계로 진행됩니다.
```

### 9.3 Payment Confirmation

```text
현재 배송비 결제 확인 중입니다. 확인이 완료되면 출고 준비 단계로 넘어갑니다.
```

### 9.4 Customs Identity Mismatch

```text
현재 통관정보 확인이 필요하여 출고 전 확인 단계에 있습니다. 정확한 확인 후 안내드리겠습니다.
```

Internal alert:

```text
통관번호 불일치 감지: 수취인 정보와 개인통관 정보 확인 필요
```

SMS draft:

```text
안녕하세요. 통관 진행을 위해 수취인명과 개인통관고유부호 정보 확인이 필요합니다.
주문 시 입력하신 수취인명과 개인통관고유부호가 일치하지 않아 출고 전 확인 단계에 있습니다.
정확한 수취인명과 개인통관고유부호를 확인 후 회신 부탁드립니다.
```

### 9.5 Unknown or API Failure

```text
현재 배송대행지 상태 조회가 지연되고 있어 정확한 상태 확인 후 다시 안내드리겠습니다.
```

---

## 10. Open Questions for Design Phase

- 내부 API 보호 방식은 무엇으로 할 것인가: shared secret header, 관리자 세션, InsForge auth 중 선택 필요
- CS AI비서가 직접 호출할 것인가, 아니면 운영자 도구/중간 서버가 호출할 것인가
- 입력값은 QuickStar `groupCode`만 받을 것인가, `appCode`, 스마트스토어 주문번호 매핑까지 받을 것인가
- 자동 답변 문구를 어느 톤으로 고정할 것인가: 친절형, 짧은 안내형, 사과 포함형
- 통관번호 불일치 시 고객에게 바로 정보 수정 요청을 보낼 권한이 있는가
- 통관부호 불일치 저장소는 1차에서 브라우저 localStorage로 둘 것인가, InsForge DB 테이블로 둘 것인가
- 문자 발송용 휴대폰 번호 보관 기간과 삭제 정책은 어떻게 둘 것인가
- 카카오 알림톡 템플릿 검수 문구와 버튼 구성은 어떤 톤으로 확정할 것인가

---

## 11. Next Steps

1. [ ] Design 문서 작성: `docs/02-design/features/cs-ai-shipping-status-automation.design.md`
2. [ ] QuickStar 실제 조회 응답 샘플 2~3개 확보 및 민감정보 마스킹
3. [ ] 내부 API 보호 방식 결정
4. [ ] 상태 코드/답변 템플릿 최종 검토
5. [ ] 배송 안내 탭과 통관부호 불일치 탭의 저장 정책 확정
6. [ ] 구현 시작

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-05-31 | Initial PDCA plan draft for internal CS AI shipping status automation | Codex |
| 0.2 | 2026-05-31 | Added invoice-only CS guide UI, copy workflow, customs mismatch storage tab, and future Kakao Alimtalk plan | Codex |
