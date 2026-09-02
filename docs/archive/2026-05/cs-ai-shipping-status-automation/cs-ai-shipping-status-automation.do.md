# CS AI Shipping Status Automation Implementation Guide

> **Summary**: 내부 CS 도구의 배송 안내 탭과 통관부호 불일치 탭을 구현하기 위한 실행 체크리스트.
>
> **Project**: tracking-tipoasis
> **Author**: Codex
> **Date**: 2026-05-31
> **Status**: Ready for Implementation
> **Design Doc**: [cs-ai-shipping-status-automation.design.md](./cs-ai-shipping-status-automation.design.md)

---

## 1. Pre-Implementation Checklist

- [ ] Plan document reviewed: `docs/01-plan/features/cs-ai-shipping-status-automation.plan.md`
- [ ] Design document reviewed: `docs/02-design/features/cs-ai-shipping-status-automation.design.md`
- [ ] Existing public tracking flow reviewed: `app/api/track/route.ts`
- [ ] Existing shared types reviewed: `lib/types.ts`
- [ ] Existing UI conventions reviewed: `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/card.tsx`
- [ ] No new dependency required for Phase 1
- [ ] 배송 안내 탭은 조회/복사 이력을 저장하지 않는다는 정책 확인
- [ ] 통관부호 불일치 탭은 1차 저장소로 `localStorage`를 사용한다는 정책 확인

---

## 2. Implementation Order

### 2.1 Phase 1: Data Layer

| Priority | Task | File/Location | Status |
|:--------:|------|---------------|:------:|
| 1 | `CsReplyTone`, `CsDeliveryGuide`, `MismatchRecord` 타입 정의 | `lib/services/cs-reply-template.ts` 또는 `lib/types.ts` | Pending |
| 2 | 통관부호 불일치 템플릿 key 정의: `default`, `recipient`, `hold` | `lib/services/cs-reply-template.ts` | Pending |
| 3 | `localStorage` key 상수 정의: `tracking-tipoasis:customs-mismatch-records` | `components/InternalCsHelper.tsx` 또는 helper module | Pending |

Implementation note:

- Phase 1에서는 InsForge DB 테이블을 만들지 않는다.
- 향후 알림톡 연동 시 `MismatchRecord`를 `AlimtalkSendRecord`로 확장한다.

### 2.2 Phase 2: Business Logic

| Priority | Task | File/Location | Status |
|:--------:|------|---------------|:------:|
| 4 | `buildCsDeliveryGuide(data: TrackResponseData)` 구현 | `lib/services/cs-reply-template.ts` | Pending |
| 5 | 최신 배송/통관 이벤트 선택 함수 구현 | `lib/services/cs-reply-template.ts` | Pending |
| 6 | 배송 상태별 안내문 생성 규칙 구현 | `lib/services/cs-reply-template.ts` | Pending |
| 7 | 통관부호 불일치 SMS 템플릿 map 구현 | `lib/services/cs-reply-template.ts` | Pending |
| 8 | `localStorage` read/write/delete helper 구현 | `components/InternalCsHelper.tsx` 또는 helper module | Pending |

배송 안내문 생성 규칙:

| Case | Condition | Reply Tone |
|------|-----------|------------|
| 배송 이력 없음 | `data.isPending === true` | `delay` |
| 배송완료 | `currentStatusCode >= 7` | `completed` |
| 국내 배송 이벤트 있음 | `delivery.events.length > 0` | `standard` |
| 통관 완료 후 인계 전 | `customs.events.length > 0 && currentStatusCode >= 4` | `delay` |
| 기타 | fallback | `needs_review` |

### 2.3 Phase 3: UI Components

| Priority | Task | File/Location | Status |
|:--------:|------|---------------|:------:|
| 9 | 내부 페이지 생성 | `app/internal/cs-helper/page.tsx` | Pending |
| 10 | 내부 CS 도구 client component 생성 | `components/InternalCsHelper.tsx` | Pending |
| 11 | `배송 안내` / `통관부호 불일치` 탭 상태 구현 | `components/InternalCsHelper.tsx` | Pending |
| 12 | 배송 안내 폼 구현: 운송장번호 input, 조회 button | `components/InternalCsHelper.tsx` | Pending |
| 13 | 안내문 textarea와 복사 button 구현 | `components/InternalCsHelper.tsx` | Pending |
| 14 | 통관부호 불일치 폼 구현: 휴대폰 번호, 운송장/주문 메모, 템플릿, 내용 | `components/InternalCsHelper.tsx` | Pending |
| 15 | 불일치 저장 목록 구현: phone, memo, content, createdAt, copy, delete | `components/InternalCsHelper.tsx` | Pending |
| 16 | 카카오 알림톡 발송 button placeholder 구현 | `components/InternalCsHelper.tsx` | Pending |

UI rules:

- 내부 도구 첫 화면은 마케팅/랜딩 페이지가 아니라 바로 CS 작업 화면이어야 한다.
- 기존 앱의 어두운 작업형 톤과 맞추되, 내부 도구는 정보 밀도를 높인다.
- 버튼에는 가능한 lucide icon을 사용한다.
- 탭/입력/목록/복사 상태는 모바일과 데스크톱 모두에서 텍스트가 넘치지 않아야 한다.

### 2.4 Phase 4: Integration

| Priority | Task | File/Location | Status |
|:--------:|------|---------------|:------:|
| 17 | 배송 안내 탭에서 `POST /api/track` 호출 | `components/InternalCsHelper.tsx` | Pending |
| 18 | API 성공 시 `buildCsDeliveryGuide`로 안내문 생성 | `components/InternalCsHelper.tsx` | Pending |
| 19 | API 실패/invalid input/error state 처리 | `components/InternalCsHelper.tsx` | Pending |
| 20 | `navigator.clipboard.writeText` 복사 기능 연결 | `components/InternalCsHelper.tsx` | Pending |
| 21 | 복사 성공 상태 `복사됨` 표시 | `components/InternalCsHelper.tsx` | Pending |
| 22 | 통관부호 불일치 저장/삭제 후 localStorage 동기화 | `components/InternalCsHelper.tsx` | Pending |

### 2.5 Phase 5: Verification

| Priority | Task | File/Location | Status |
|:--------:|------|---------------|:------:|
| 23 | 배송 안내 E2E 작성 | `tests/internal-cs-helper.spec.ts` | Pending |
| 24 | 통관부호 불일치 저장 E2E 작성 | `tests/internal-cs-helper.spec.ts` | Pending |
| 25 | localStorage reload persistence E2E 작성 | `tests/internal-cs-helper.spec.ts` | Pending |
| 26 | lint 실행 | `npm run lint` | Pending |
| 27 | typecheck 실행 | `npm run typecheck` | Pending |
| 28 | build 실행 | `npm run build` | Pending |

---

## 3. Key Files

### 3.1 New Files

| File Path | Purpose |
|-----------|---------|
| `lib/services/cs-reply-template.ts` | 배송 안내문 생성, 통관부호 불일치 템플릿 |
| `components/InternalCsHelper.tsx` | 내부 CS 도구 client UI |
| `app/internal/cs-helper/page.tsx` | 내부 CS 도구 route |
| `tests/internal-cs-helper.spec.ts` | 내부 CS 도구 Playwright 검증 |

### 3.2 Files to Modify

| File Path | Changes |
|-----------|---------|
| `lib/types.ts` | 필요한 경우 공통 타입만 추가. 가능하면 새 서비스 파일 내부 타입으로 제한 |
| `components/ui/button.tsx` | 수정 금지 우선. 기존 variant로 부족할 때만 최소 수정 |
| `components/ui/input.tsx` | 수정 금지 우선 |
| `app/api/track/route.ts` | 수정 금지 우선. 배송 안내 탭은 기존 API contract를 재사용 |

### 3.3 Files Not to Touch in Phase 1

| File Path | Reason |
|-----------|--------|
| `app/page.tsx` | 공개 고객 조회 페이지와 내부 도구 분리 |
| `components/HomePageClient.tsx` | 공개 고객 UX 변경 금지 |
| `lib/services/quickstar.ts` | QuickStar 실제 연동은 다음 단계에서 credentials 확인 후 |
| InsForge migrations | localStorage 1차 구현이므로 DB 변경 없음 |

---

## 4. Dependencies

No new dependencies in Phase 1.

Use existing dependencies:

- `lucide-react`: icons
- `zod`: if shared validation is introduced
- `@playwright/test`: E2E verification
- existing UI primitives under `components/ui`

Do not add:

- state management libraries
- clipboard libraries
- database clients
- Kakao SDK/API client

---

## 5. Implementation Details

### 5.1 `buildCsDeliveryGuide`

Input:

```ts
buildCsDeliveryGuide(data: TrackResponseData): CsDeliveryGuide
```

Output must include:

- `invoiceNumber`
- `carrierName`
- `currentStatus`
- `latestEvent`
- `reply`
- `tone`

Reply examples:

```text
현재 CJ대한통운 운송장번호 520671340641는 배송중 단계로 확인됩니다.
최근 처리: 배송중 (2026. 05. 31. 08:30, 인천허브)
```

```text
현재 CJ대한통운 운송장번호 520671340641는 아직 배송 이력이 확인되지 않습니다.
상품이 국내 도착 전이거나 택배사 전산 반영 전일 수 있어 확인되는 즉시 안내드리겠습니다.
```

### 5.2 Customs Mismatch Templates

Template keys:

```ts
type CustomsMismatchTemplateKey = "default" | "recipient" | "hold";
```

Default SMS draft:

```text
안녕하세요. 통관 진행을 위해 수취인명과 개인통관고유부호 정보 확인이 필요합니다.
주문 시 입력하신 수취인명과 개인통관고유부호가 일치하지 않아 출고 전 확인 단계에 있습니다.
정확한 수취인명과 개인통관고유부호를 확인 후 회신 부탁드립니다.
```

### 5.3 Local Storage Contract

Storage key:

```text
tracking-tipoasis:customs-mismatch-records
```

Record:

```ts
type MismatchRecord = {
  id: string;
  phone: string;
  content: string;
  trackingMemo: string;
  templateKey: CustomsMismatchTemplateKey;
  createdAt: string;
  updatedAt?: string;
};
```

Storage functions:

- `readStoredRecords(): MismatchRecord[]`
- `writeStoredRecords(records: MismatchRecord[]): void`
- `createRecordId(): string`
- `normalizePhone(value: string): string`

### 5.4 Copy Behavior

Use:

```ts
await navigator.clipboard.writeText(text)
```

Fallback:

- If clipboard API fails, keep textarea visible and show manual copy message.
- Do not add extra dependency.

### 5.5 Kakao Alimtalk Placeholder

The button must exist visually but stay disabled in Phase 1.

Button label:

```text
알림톡 준비중
```

Future fields:

- `templateCode`
- `sendStatus`
- `sentAt`
- `providerMessageId`
- `failureReason`

---

## 6. Test Scenarios

### 6.1 Delivery Guide E2E

Mock `/api/track` response:

- `trackingNumber`: `520671340641`
- `currentStatus`: `배송중`
- `currentStatusCode`: `6`
- `delivery.carrier`: `CJ대한통운`
- `delivery.invoiceNumber`: `520671340641`
- one latest delivery event

Assertions:

- `/internal/cs-helper` renders.
- `운송장번호` input exists.
- after submit, guide text includes carrier and invoice number.
- copy button exists.

### 6.2 Pending Delivery E2E

Mock `isPending = true`.

Assertions:

- guide text says 배송 이력 미확인.
- no saved record is created.

### 6.3 Customs Mismatch E2E

Actions:

- switch to `통관부호 불일치` tab.
- enter phone `010-1234-5678`.
- choose default template.
- save.

Assertions:

- record appears in list.
- content is visible.
- copy button exists.
- disabled 알림톡 button exists.
- after reload, record remains.

---

## 7. Post-Implementation

### 7.1 Self-Review Checklist

- [ ] No implementation stores delivery guide lookups or copy history.
- [ ] Mismatch records do not store personal customs code.
- [ ] No new dependency was added.
- [ ] Public home page behavior remains unchanged.
- [ ] Internal route is isolated under `/internal/cs-helper`.
- [ ] Loading, error, empty, copied, saved states are visible.
- [ ] Mobile layout does not overflow.
- [ ] Desktop layout supports repeated CS work without excessive scrolling.

### 7.2 Verification Commands

```bash
npm run lint
npm run typecheck
npm run build
npx playwright test tests/internal-cs-helper.spec.ts
```

### 7.3 Ready for Check Phase

When all implementation and verification items are complete, run:

```text
$pdca analyze cs-ai-shipping-status-automation
```

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-05-31 | Implementation guide created from design document | Codex |
