# CS AI Shipping Status Automation Design Document

> **Summary**: 내부 CS 상담원이 운송장 기반 배송 안내문을 즉시 생성하고, 통관부호 불일치 대상자를 문자/알림톡 발송 준비 목록으로 관리하는 설계.
>
> **Project**: tracking-tipoasis
> **Version**: 0.1
> **Author**: Codex
> **Date**: 2026-05-31
> **Status**: Draft
> **Planning Doc**: [cs-ai-shipping-status-automation.plan.md](../../01-plan/features/cs-ai-shipping-status-automation.plan.md)

---

## 1. Overview

### 1.1 Design Goals

- 운송장번호 하나만 입력해 기존 `POST /api/track` 결과 기반의 고객 안내문을 생성한다.
- 배송 안내문은 상담원이 바로 복사/붙여넣기 할 수 있게 하며, 조회/복사 이력은 저장하지 않는다.
- 통관부호 불일치 고객은 별도 탭에서 휴대폰 번호와 안내 내용을 저장해 문자 발송 준비 목록으로 관리한다.
- 카카오 알림톡 API 연동 전까지는 발송 버튼을 준비중 상태로 두고, 이후 템플릿 발송/이력관리 필드를 확장 가능하게 설계한다.
- 공개 고객 조회 페이지와 내부 CS 도구를 라우팅, 타입, 저장 정책에서 분리한다.

### 1.2 Design Principles

- **Privacy by default**: 배송 안내 조회 기록은 저장하지 않고, 불일치 탭도 문자 발송에 필요한 최소 정보만 저장한다.
- **Internal tool separation**: 내부 CS 화면은 `/internal/cs-helper` 하위에 두고 공개 홈 화면과 섞지 않는다.
- **Template-first replies**: 고객 안내 문구는 하드코딩 분산 없이 템플릿/빌더 함수에서 생성한다.
- **Progressive storage**: 1차는 빠른 운영 검증을 위해 `localStorage`, 2차는 알림톡/이력관리 시 InsForge DB로 이전한다.
- **No false certainty**: 조회 실패, 상태 미확인, 통관부호 불일치 상태에서는 단정적인 정상 진행 안내를 금지한다.

---

## 2. Architecture

### 2.1 Component Diagram

```text
Internal CS Page (/internal/cs-helper)
  ├─ Delivery Guide Tab
  │   ├─ invoiceNumber input
  │   ├─ POST /api/track
  │   ├─ buildCsDeliveryGuide()
  │   └─ clipboard copy
  │
  └─ Customs Mismatch Tab
      ├─ phone/content form
      ├─ template selector
      ├─ localStorage mismatch records
      ├─ clipboard copy
      └─ future Kakao Alimtalk send button

Server
  ├─ existing POST /api/track
  └─ future POST /api/internal/cs-shipping-status

External
  ├─ UNI-PASS / customstrack fallback
  ├─ CJ delivery lookup
  └─ future QuickStar + Kakao Alimtalk
```

### 2.2 Data Flow

#### 배송 안내 탭

```text
운송장번호 입력
  -> client validation
  -> POST /api/track
  -> TrackResponseData
  -> buildCsDeliveryGuide()
  -> textarea에 고객 안내문 표시
  -> 상담원이 복사
  -> 저장 없음
```

#### 통관부호 불일치 탭

```text
휴대폰 번호 + 운송장/주문 메모 + 안내 템플릿
  -> client validation
  -> MismatchRecord 생성
  -> localStorage 저장
  -> 목록 표시
  -> 내용 복사 또는 삭제
  -> future: Kakao Alimtalk API 발송 + 이력 저장
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|------------|---------|
| `InternalCsHelper` | React client state, existing UI components | 내부 탭 UI와 입력/복사/저장 흐름 |
| `buildCsDeliveryGuide` | `TrackResponseData` | 배송 상태를 고객 안내문으로 변환 |
| `CUSTOMS_MISMATCH_TEMPLATES` | static template map | 문자/알림톡 안내 문구 초안 |
| `POST /api/track` | existing tracking services | 운송장 배송/통관 정보 조회 |
| `localStorage` | browser storage | 1차 통관부호 불일치 준비 목록 저장 |
| Future InsForge table | InsForge Postgres | 알림톡 발송 대상/이력 저장 |
| Future Kakao provider | Kakao Alimtalk API | 템플릿 메시지 발송 |

---

## 3. Data Model

### 3.1 Delivery Guide DTO

```ts
type CsReplyTone = "standard" | "delay" | "completed" | "needs_review";

type CsDeliveryGuide = {
  invoiceNumber: string;
  carrierName: string;
  currentStatus: string;
  latestEvent: {
    status: string;
    datetime: string;
    location?: string;
    detail?: string;
  } | null;
  reply: string;
  tone: CsReplyTone;
};
```

This DTO is derived from `TrackResponseData` and is not persisted.

### 3.2 Customs Mismatch Record

```ts
type MismatchRecord = {
  id: string;
  phone: string;
  content: string;
  trackingMemo: string;
  templateKey: "default" | "recipient" | "hold";
  createdAt: string;
  updatedAt?: string;
};
```

1차 저장 위치는 browser `localStorage`다. 저장 키는 아래처럼 고정한다.

```text
tracking-tipoasis:customs-mismatch-records
```

### 3.3 Future Alimtalk Record

카카오 알림톡 연동 시 `MismatchRecord`를 아래 구조로 확장하거나 InsForge DB 테이블로 이전한다.

```ts
type AlimtalkSendRecord = MismatchRecord & {
  templateCode: string;
  sendStatus: "draft" | "ready" | "sending" | "sent" | "failed";
  sentAt?: string;
  providerMessageId?: string;
  failureReason?: string;
};
```

### 3.4 Future InsForge Table Draft

```sql
create table cs_customs_mismatch_messages (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  tracking_memo text,
  content text not null,
  template_key text not null default 'default',
  template_code text,
  send_status text not null default 'draft',
  sent_at timestamptz,
  provider_message_id text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

RLS/auth는 알림톡 실제 발송 단계에서 관리자 인증 방식과 함께 확정한다.

---

## 4. API Specification

### 4.1 Existing API Reuse

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/track` | 운송장번호 기반 배송/통관 조회 | Public existing route |

Request:

```json
{
  "trackingNumber": "520671340641"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "trackingNumber": "520671340641",
    "currentStatus": "배송중",
    "delivery": {
      "carrier": "CJ대한통운",
      "invoiceNumber": "520671340641",
      "events": []
    }
  }
}
```

### 4.2 Future Internal CS API

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/internal/cs-shipping-status` | QuickStar + existing tracking 기반 CS 응답 DTO 생성 | Required |
| GET | `/api/internal/customs-mismatch` | 저장된 통관부호 불일치 안내 목록 조회 | Required |
| POST | `/api/internal/customs-mismatch` | 통관부호 불일치 안내 draft 저장 | Required |
| POST | `/api/internal/customs-mismatch/:id/send` | future 카카오 알림톡 발송 | Required |

1차 구현에서는 `GET/POST /api/internal/customs-mismatch`를 만들지 않고 `localStorage`만 사용한다. InsForge DB로 이전할 때 위 API를 추가한다.

### 4.3 Internal Status Response

```ts
type InternalCsStatusResponse = {
  success: true;
  data: {
    deliveryGuide?: CsDeliveryGuide;
    quickstarStatus?: CsShippingStatus;
    warnings: string[];
    checkedAt: string;
  };
};
```

---

## 5. UI/UX Design

### 5.1 Screen Layout

```text
/internal/cs-helper

+---------------------------------------------------------+
| Internal CS Desk                                        |
| 배송/통관 고객 응대 문구 생성 도구                         |
+------------------------+--------------------------------+
| [배송 안내] [통관부호 불일치]                              |
+------------------------+--------------------------------+
| 배송 안내 탭                                             |
| - 운송장번호 입력                                        |
| - 조회 버튼                                             |
| - 상태 요약 카드                                         |
| - 고객 안내문 textarea                                   |
| - 복사 버튼                                             |
+---------------------------------------------------------+

통관부호 불일치 탭
+------------------------+--------------------------------+
| 입력 폼                  | 저장 목록                       |
| - 휴대폰 번호             | - 휴대폰 번호                   |
| - 운송장/주문 메모         | - 저장 일시                     |
| - 템플릿 선택             | - 안내 내용                     |
| - 안내 내용 textarea      | - 복사 버튼                     |
| - 저장 / 내용 복사         | - 발송 버튼(준비중)             |
+------------------------+--------------------------------+
```

### 5.2 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `InternalCsHelperPage` | `app/internal/cs-helper/page.tsx` | 내부 CS 도구 라우트 |
| `InternalCsHelper` | `components/InternalCsHelper.tsx` | 탭 UI, 입력, 조회, 복사, 저장 목록 |
| `buildCsDeliveryGuide` | `lib/services/cs-reply-template.ts` | 배송 안내문 생성 |
| `CUSTOMS_MISMATCH_TEMPLATES` | `lib/services/cs-reply-template.ts` | 불일치 문자/알림톡 템플릿 |
| `MismatchRecordStorage` | `lib/services/cs-mismatch-storage.ts` 또는 component-local helper | 1차 localStorage read/write |

### 5.3 UX Rules

- 배송 안내 탭은 조회 성공 후 안내문이 자동 생성되지만 자동 저장하지 않는다.
- 복사 성공 시 `복사됨` 상태를 1.5초 내외로 표시한다.
- 통관부호 불일치 탭의 발송 버튼은 1차에서 disabled 상태와 `알림톡 연동 예정` tooltip/text를 표시한다.
- 휴대폰 번호와 안내 내용이 없으면 저장하지 않는다.
- 불일치 저장 목록에는 삭제 기능을 둬 운영자가 잘못 저장한 항목을 정리할 수 있게 한다.

---

## 6. Error Handling

| Case | User Message | Handling |
|------|--------------|----------|
| Empty invoice | 운송장번호를 입력해주세요. | Client-side validation |
| Invalid tracking response | 배송 정보를 조회하지 못했습니다. 잠시 후 다시 시도해주세요. | Do not create reply |
| `isPending` result | 아직 배송 이력이 확인되지 않습니다. | Delay tone reply |
| No delivery but customs complete | 통관 완료 후 국내 택배 인계를 기다리는 단계입니다. | Conservative reply |
| Clipboard failure | 복사에 실패했습니다. 내용을 직접 선택해 복사해주세요. | Keep textarea visible |
| Empty mismatch phone/content | 휴대폰 번호와 안내 내용을 입력해주세요. | Client-side validation |
| localStorage parse failure | 저장 목록을 불러오지 못했습니다. 새 목록으로 시작합니다. | Fail closed, do not crash |

---

## 7. Security and Privacy

- 배송 안내 탭의 조회 결과와 복사 여부는 저장하지 않는다.
- 통관부호 불일치 탭은 1차에서 휴대폰 번호, 메모, 안내 내용만 저장한다.
- 개인통관고유부호 원문은 저장 필드에 넣지 않는다.
- QuickStar `user-session`과 API key는 서버 환경변수로만 관리한다.
- future InsForge DB 전환 시 관리자 인증과 RLS 정책이 확정되기 전까지 배포하지 않는다.
- future 알림톡 API key는 서버 전용 환경변수로만 관리한다.

---

## 8. Test Plan

| Type | Target | Tool |
|------|--------|------|
| Unit | `buildCsDeliveryGuide` 상태별 문구 | TypeScript test runner or route-free unit test |
| Unit | mismatch record validation/storage helper | TypeScript test runner |
| E2E | 운송장 입력 -> 안내문 생성 -> 복사 버튼 표시 | Playwright with `/api/track` mock |
| E2E | 통관부호 불일치 탭 -> 휴대폰/내용 저장 -> 목록 표시 | Playwright |
| E2E | 페이지 reload 후 localStorage 목록 유지 | Playwright |
| Static | Type/lint/build | `npm run typecheck`, `npm run lint`, `npm run build` |

### 8.1 Required Scenarios

1. 배송중 운송장: `currentStatusCode = 6`, 최신 배송 이벤트 포함
2. 배송완료 운송장: `currentStatusCode = 7`
3. 도착전 운송장: `isPending = true`
4. 통관완료/택배 인계 전: customs event only
5. 통관부호 불일치 저장: 휴대폰 번호 + 템플릿 내용 저장
6. 불일치 목록 복사: 저장된 메시지 복사 가능

---

## 9. Implementation Guide

### 9.1 Implementation Order

1. [ ] `lib/services/cs-reply-template.ts`에 배송 안내/불일치 템플릿 순수 함수 작성
2. [ ] `components/InternalCsHelper.tsx`에 탭 UI와 local state 구현
3. [ ] `/internal/cs-helper` 페이지 추가
4. [ ] 배송 안내 탭에서 `POST /api/track` 호출 및 복사 기능 연결
5. [ ] 통관부호 불일치 탭에서 localStorage 저장/목록/삭제/복사 구현
6. [ ] 알림톡 발송 버튼은 disabled 상태로 UI 자리만 배치
7. [ ] Playwright E2E 추가
8. [ ] lint/typecheck/build 검증

### 9.2 First Implementation Storage Decision

1차 구현은 `localStorage`를 사용한다.

Rationale:

- 사용자가 명시한 배송 안내는 저장하지 않아야 한다.
- 통관부호 불일치 저장은 문자 발송 준비용의 작은 운영 목록이다.
- 카카오 알림톡 API와 이력관리를 붙이기 전에는 DB/RLS/관리자 인증 설계가 과하다.
- 향후 알림톡 자동화 시점에 InsForge DB로 이전하는 편이 발송 이력 요구와 잘 맞다.

### 9.3 Migration Trigger to InsForge

아래 조건 중 하나가 생기면 `localStorage`에서 InsForge DB로 이전한다.

- 여러 PC/상담원이 같은 불일치 목록을 공유해야 한다.
- 카카오 알림톡 발송 이력을 보존해야 한다.
- 발송 성공/실패/재시도 관리가 필요하다.
- 휴대폰 번호 보관 기간/삭제 정책을 중앙에서 통제해야 한다.

---

## 10. Open Decisions

| Decision | Default | When to Revisit |
|----------|---------|-----------------|
| Internal route protection | 1차는 숨은 내부 URL, 배포 전 shared secret/auth 추가 | 외부 배포 전 |
| Mismatch storage | `localStorage` | 알림톡/공유 상담 도입 시 |
| Kakao send button | disabled placeholder | 알림톡 API provider/key 확정 시 |
| Message tone | 친절하고 짧은 안내형 | 실제 CS 문구 검토 후 |
| QuickStar integration | design included, 구현은 API credential 확인 후 | 실제 token 확보 후 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-05-31 | Initial technical design for internal CS helper, mismatch storage, and future Alimtalk flow | Codex |
