# E2E rule → assertion map

Spec §14 test contract item 1 and approval 2: every business rule the old copy-bound E2E tests protected is carried by a new structural assertion (roles, `data-*` hooks, config values) **before** the old test is removed. This file is the ledger of that migration. Titles are exact test titles.

Status values: `pending (Task N)` — the new assertion is planned in that task; `migrated (Task N)` — the new assertion passed and the old test was removed in that task; `retired (approval 2)` — a decoration the spec deletes (§4 "삭제하는 것"), asserted as absent; `kept → S07` / `kept → S08` — still asserted by the old test until that stage migrates it.

## H — home and lookup area (S06)

| Id | Legacy test (`tests/tracking.spec.ts`) | Business rule | New assertion (file → test) | Status |
|---|---|---|---|---|
| H1 | "home uses customer language without brand, robot, or AI copy" | 고객 언어(브랜드·로봇·AI 문구 금지); `google-anno-skip` on `<body>`; home h1 '통관부터 국내 배송까지 한 번에 확인'; the input and [조회하기] are visible | `tests/e2e/home.spec.ts` → "home copy speaks customer language: no AI, robot or brand slogans"; "one h1 and the lookup form come first; the hero decorations are gone" | migrated (Task 5) |
| H1r | same test: the '구매 고객을 위한 배송조회' badge, LogisticsFlow, the AssuranceRail region, the input shake and the pointer/submit cues | decorations the spec deletes (§4) | `tests/e2e/home.spec.ts` → "one h1 and the lookup form come first; the hero decorations are gone" (hooks counted as 0) | retired (approval 2) |
| F1 | "the lookup form shows the format hint instead of example numbers" (added by S01) | real numbers nowhere; the non-clickable format hint describes the input | `tests/e2e/lookup-input.spec.ts` → "the format hint replaces example numbers and describes the input" | migrated (Task 5) |
| C1 | "user can choose a representative domestic carrier before tracking" | the chosen carrier travels with the request; the skip link is off-screen until focused; the result links the carrier's official page | `tests/e2e/lookup-input.spec.ts` → "the carrier choice lists the five carriers and travels with the request"; `tests/e2e/home.spec.ts` → "the skip link stays off-screen until it is focused"; result part → S07 | kept → S07 (S06 adds the lookup assertions; S07 removes the test) |
| M1 | "semantic motion is finite and honors reduced-motion" | finite motion; reduced motion respected | `tests/e2e/home.spec.ts` → "no infinite animation runs, and reduced motion stops every animation"; `tests/budgets/motion-budget.spec.ts` → "no infinite animation 8 s after load: home, a loading deep link and a settled result", "reduced motion: nothing animates on home and on a settled result" | migrated (Task 5); budget pending (Task 9) |
| L1 | "tablet layout keeps motion inside the viewport" | no horizontal scroll | `tests/e2e/home.spec.ts` → "no horizontal scroll at 320, 768 and 1280 px" | migrated (Task 5) |
| L2 | "desktop layout keeps motion inside the viewport" | no horizontal scroll | same as L1 | migrated (Task 5) |
| P1 | "mobile first view exposes consultation and store shortcuts" | 모바일 첫 화면에 상담·스토어 바로가기 | approval 1: `tests/e2e/home.spec.ts` → "the row is in the first view at 390×844, 375×812 and 360×780 and nothing covers the lookup button or the row"; fallback: "the collapsed 상담·스토어 button is in the first view and never covers the lookup panel", "opening it shows 톡톡, 네이버 and 쿠팡 shortcuts" | migrated (Task 7) |
| S1 | "home offers transparent storefront choices without interrupting tracking" | store choices come with the disclosure; nothing interrupts the lookup | approval 1: `tests/e2e/home.spec.ts` → "the definitive disclosure comes before the coupang link, and only affiliate links are sponsored" + the trial clicks of P1's test; fallback: P1's fallback tests. The legacy showcase assertions stay until S08 replaces the showcase | popup step migrated (Task 7); showcase part kept → S08 |
| O1 | "an overdue customs estimate is recalculated and remains readable on mobile" — its popup-closing step only | none (the step existed because the popup covered the form) | — | step removed (Task 7); test kept → S07 |

## R — result area (unchanged by S06; S07 migrates)

| Id | Legacy test (`tests/tracking.spec.ts`) | Business rule | Status |
|---|---|---|---|
| R1 | "normalizer calculates a clear customs completion estimate while customs is waiting" | customs estimate computation | kept → S07 (moves to `tests/unit/normalizer.spec.ts`) |
| R2 | "tracking result leads with delivery date and keeps customs estimate secondary" | 예상일이 먼저, 통관 예상은 보조 | kept → S07 |
| R3 | "an overdue customs estimate is recalculated and remains readable on mobile" | overdue estimate readable at 390 px | kept → S07 |
| R4 | "pickup status names the carrier pickup and prioritizes the delivery estimate" | 기사님 픽업 문언, 예상일 우선 | kept → S07 |
| R5 | "error state prioritizes inquiry without store promotion" | 오류는 문의 우선·스토어 홍보 없음 | kept → S07 |
| R6 | "pending state offers inquiry and purchase-channel choices" | 국내 도착 전은 문의 + 구매처 선택지 | kept → S07 |
| R7 | "in-transit state keeps shopping links out of the primary flow" | 배송 중은 쇼핑 링크를 주 흐름 밖에 | kept → S07 |
| R8 | "delivered state leads with store choices" | 배송 완료는 스토어 선두 | kept → S07 |

S02's E2E files (`url-privacy`, `session-restore`, `return-link`, `legacy-query-redirect`) select stage-independent hooks and are not changed by S06. S04's (`status-slot`, `loading-timeline`, `failure-causes`, `cta-consistency`) keep running on the S06 page (its `#tracking-panel` id stays on a wrapper in `TrackingPage`); S06 changes only the rows of section S.

## S — S04 E2E assertions re-pointed by S06 (Task 5 Steps 14 and 16)

The rule of each row is unchanged; only the element moved (spec §3/§7: the form shows only in idle and INVALID modes, and the INVALID error sits at the input).

| Id | S04 file → test | What moved | New assertion (file → test) | Status |
|---|---|---|---|---|
| S1 | `failure-causes.spec.ts` (import of `INVALID_NUMBER_ERROR_ID`) | the constant left the deleted `components/TrackingForm.tsx` | same constant and value from `components/lookup/LookupForm.tsx` | re-pointed (Task 5) |
| S2 | `failure-causes.spec.ts` → "invalid400: the cause's own notice, 톡톡 first in the block, no stores and no server wording" (and, when S04 Task 9 ran, "invalid400 (approval 3): the recovery action leads and 톡톡 stays the first link of the block") | a server INVALID answer renders at the input, not in the status slot | `failure-causes.spec.ts` → "invalid400 (S06): a server INVALID answer reopens the form with the error at the input, 톡톡 first in the error block" (the loops skip `invalid400`) | re-pointed (Task 5) |
| S3 | `cta-consistency.spec.ts` → "invalid400: no store, showcase, popup, recommendation or sponsored link anywhere on the page" | the error block of a server INVALID answer sits under the form | the same test finds `[data-cta-state="error"]` on the page instead of inside the slot | re-pointed (Task 5) |
| S4 | `status-slot.spec.ts` → "deep link: focus stays where the customer is once they interacted; the live region still reads the result" | a loading deep link shows the number bar, not the input | the customer's focus is the skip link (Tab); it is still there after the result is read | re-pointed (Task 5) |
| S5 | `status-slot.spec.ts` → "carrier chips look the same number up again with the chosen carrier" | result modes hide the form | [다른 번호 조회] brings the form back with the chosen carrier | re-pointed (Task 5) |
| S6 | `tests/privacy.spec.ts` → "privacy policy is reachable from the footer and explains the no-storage rule" | the policy article's 톡톡 link opens a new tab | same test, locator `exact: true` (the public layout now mounts the footer on `/privacy`, whose 톡톡 link is named "톡톡으로 문의하기 새 창으로 열기") | re-pointed (Task 4) |

## N — new S06 assertions without a legacy counterpart

- `tests/e2e/deep-link.spec.ts`: server shell without JavaScript, three-way split, path variants, `?c=`, `noindex`, focus/live/title rules after a deep-link lookup, 320 px cargo number, production cache headers.
- `tests/e2e/lookup-input.spec.ts`: input attributes, normalization, pre-check with diagnosis, confusable question, paste extraction and [되돌리기], busy form, no-JavaScript paths.
- `tests/e2e/home.spec.ts`: header, skip link, one live region, one filled button, mode changes on `/`, shortcut row geometry (approval 1), typical durations, notice re-filter, token colors.
- `tests/budgets/{html-budget,motion-budget,lcp-budget}.spec.ts`.
