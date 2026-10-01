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
| M1 | "semantic motion is finite and honors reduced-motion" | finite motion; reduced motion respected | `tests/e2e/home.spec.ts` → "no infinite animation runs, and reduced motion stops every animation"; `tests/budgets/motion-budget.spec.ts` → "no infinite animation 8 s after load: home, a loading deep link and a settled result", "reduced motion: nothing animates on home and on a settled result" | migrated (Task 5); budget added (Task 9) |
| L1 | "tablet layout keeps motion inside the viewport" | no horizontal scroll | `tests/e2e/home.spec.ts` → "no horizontal scroll at 320, 768 and 1280 px" | migrated (Task 5) |
| L2 | "desktop layout keeps motion inside the viewport" | no horizontal scroll | same as L1 | migrated (Task 5) |
| P1 | "mobile first view exposes consultation and store shortcuts" | 모바일 첫 화면에 상담·스토어 바로가기 | approval 1: `tests/e2e/home.spec.ts` → "the row is in the first view at 390×844, 375×812 and 360×780 and nothing covers the lookup button or the row"; fallback: "the collapsed 상담·스토어 button is in the first view and never covers the lookup panel", "opening it shows 톡톡, 네이버 and 쿠팡 shortcuts" | migrated (Task 7) |
| S1 | "home offers transparent storefront choices without interrupting tracking" | store choices come with the disclosure; nothing interrupts the lookup | approval 1: `tests/e2e/home.spec.ts` → "the definitive disclosure comes before the coupang link, and only affiliate links are sponsored" + the trial clicks of P1's test; fallback: P1's fallback tests. The legacy showcase assertions stay until S08 replaces the showcase | popup step migrated (Task 7); showcase part migrated (S08-2) |
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
| S6 | `tests/privacy.spec.ts` → "privacy policy is reachable from the footer and explains the no-storage rule" | the policy article's 톡톡 link opens a new tab | same test, locator `exact: true` (the public layout now mounts the footer on `/privacy`, whose 톡톡 link is named "톡톡으로 문의하기 새 창으로 열기") | re-pointed (Task 4); reverted to the plain locator in S08 Task 6 (the token footer's 톡톡 is named "톡톡 상담 …") |

## N — new S06 assertions without a legacy counterpart

- `tests/e2e/deep-link.spec.ts`: server shell without JavaScript, three-way split, path variants, `?c=`, `noindex`, focus/live/title rules after a deep-link lookup, 320 px cargo number, production cache headers.
- `tests/e2e/lookup-input.spec.ts`: input attributes, normalization, pre-check with diagnosis, confusable question, paste extraction and [되돌리기], busy form, no-JavaScript paths.
- `tests/e2e/home.spec.ts`: header, skip link, one live region, one filled button, mode changes on `/`, shortcut row geometry (approval 1), typical durations, notice re-filter, token colors.
- `tests/budgets/{html-budget,motion-budget,lcp-budget}.spec.ts`.


## S07 — result area (approval 2)

Rows added by S07. "Old" is the assertion that locked the rule before R3; "New" is the assertion that locks it now. An old assertion was removed only after its new one passed (spec §14 test contract 1). Expected strings that are not E2E-locked (§11.11 of the roadmap) are computed in the tests with `deriveTrackingView`, so copy changes in `config/site.config.ts` never break a rule test.

| # | Rule (spec) | Old assertion (file › test) | New assertion (file › test) | Status |
|---|---|---|---|---|
| S07-1 | 결과 요약: 상태 → 큰 도착 예상 → 통관 예상은 보조 (§6, §18) | tracking.spec › "tracking result leads with delivery date and keeps customs estimate secondary" | result-states › "customs waiting: …"; result-kit › "status card › customs waiting: …" (ETA is the largest text); unit/normalizer › "normalizer calculates a clear customs completion estimate while customs is waiting" | migrated |
| S07-2 | 지난 예상일은 다시 계산 (§18) + 모바일 가로 넘침 0 | tracking.spec › "an overdue customs estimate is recalculated and remains readable on mobile" | unit/normalizer › "estimates that already passed move to today and are marked adjusted"; result-kit › "layout and modes › 320 px: no horizontal scroll …" | migrated |
| S07-3 | 픽업 문구 '{carrier} 기사님 픽업 완료!' (roadmap §11.11) | tracking.spec › "pickup status names the carrier pickup and prioritizes the delivery estimate" | result-states › "picked up: …" | migrated |
| S07-4 | 택배사 직접 선택 → 요청 본문·번호 바·공식 링크 | tracking.spec › "user can choose a representative domestic carrier before tracking" | result-states › "a carrier chosen in the form reaches the request, the number bar and the official link" (the skip-link check lives in S06's home.spec) | migrated |
| S07-5 | 오류 → 문의 우선·스토어 홍보 없음 (§1, §8) | tracking.spec › "error state prioritizes inquiry without store promotion" | result-states › "NOT_FOUND: …", "every error response keeps 톡톡 first …" ×7, "an invalid number: …"; result-kit › "failure card › every error view: …" | migrated |
| S07-6 | 국내 도착 전 → 문의 + 구매처 선택지, 고지 선행, 쿠팡 sponsored (§1, §8) | tracking.spec › "pending state offers inquiry and purchase-channel choices" | result-states › "pending: …"; result-kit › "지금 할 일 › pending: …" | migrated |
| S07-7 | 국내 도착 전 추천 노출 | same test (dialog trigger and dialog content) | result-states › "pending: …" (`[data-recommended-products="pending"]` after 처리 내역); dialog content → S08 `recommendations.spec.ts` (approval 10) | migrated (content: S08) |
| S07-8 | 배송 중 → 쇼핑 링크는 주 흐름 밖 (§1) | tracking.spec › "in-transit state keeps shopping links out of the primary flow" | result-states › "in transit: …" (0 store links before `[data-primary-end]`, recommendations after it) | migrated |
| S07-9 | 배송 완료 → 스토어 선두 (§1) | tracking.spec › "delivered state leads with store choices" | result-states › "delivered: …"; result-kit › "지금 할 일 › delivered: …" | migrated |
| S07-10 | 오래된 이력 → 예상일 대신 확인 안내 (§1) | privacy.spec › "a stale shipment shows a verification prompt instead of a delivery estimate" | result-states › "stale: …" | migrated |
| S07-11 | 유한 모션·reduced-motion (결과 영역) | tracking.spec › in-transit `[data-motion-visual="result"]` | result-kit › "loading card › the spinner turns a finite number of times …"; S06 motion-budget | migrated |
| S07-12 | 결과 슬롯 규칙: 단계 문구, 원인별 오류, 포커스·낭독, CTA 일관성 (§5) | S04 status-slot / loading-timeline / failure-causes / cta-consistency specs | the same files with R3 selectors (Task 8 Step 12 table; no assertion or expected value dropped): statusSlot → `#tracking-panel [data-view-state]`; `data-status-slot` → `data-view-state`; `data-action-weight` W → `[data-slot="button"][data-variant=W]`; `data-action-kind` K → the control named by the view's action of kind K (`actionControl`/`actionName` in tests/support/status-slot.ts); empty slot → `RESULT_SLOT_CONTENT` count 0; spinner on/off → `[data-spinner]` count 1/0; skeleton → `[data-loading-skeleton="journey"]`; loading number/carrier → `[data-number-bar]`; chips → radios in `[data-carrier-chooser]`; 미수령 안내 → `details[data-delivered-help]`; legacy details heading → `details[data-history]`; error reason `getByRole("alert")` → the reason text in the failure card (S07 announces errors through the one live region, no role=alert under components/result); result-layout › "focus, live sentence, title and fill" | selectors migrated |
| S07-13 | 승인 3 대기 중 오류 화면: 톡톡이 채움 주 버튼, [번호 수정]·[다시 조회]는 보조 (roadmap §4 row 3 fallback) | unit/status-view › "approval 3 pending: …" (5 tests), "ledger: approval 3 is pending" | unit/result-approvals › "approval 3 pending: …" (5 tests), "RESULT_APPROVALS follows approval 3 in the roadmap ledger"; result-states › "approval 3 on the live page …" ×2 | superseded (approval 3 granted, Task 13) |
| S07-14 | 승인 2 대기 중 결과 문구 유지 (roadmap §4 row 2 fallback) | unit/status-view › "approval 2 pending: …" (5 tests), "ledger: approval 2 is pending" | none — approval 2 is granted (S07 Task 0 Step 7), so the wording overlay no longer applies | retired (approval 2) |
| S07-15 | S04 E2E expectations equal the view the page renders | status-slot / failure-causes / cta-consistency specs through `deriveStatusView` | the same specs through `deriveResultView` (`deriveTrackingView` + the ledger's approval-3 decision) | migrated |
| S07-16 | 오류 → 문의 우선, 승인 3 문언: 오류 블록 첫 링크는 톡톡, 스토어 0; 상태 카드에는 원인별 복구 조작이 채움 주 버튼 (NOT_FOUND [번호 수정], 일시 지연·오프라인·응답 없음 [다시 조회]); SERVER_ERROR·계약 위반은 [문의 내용 복사하고 톡톡 열기] | tracking.spec › "error state prioritizes inquiry without store promotion" (row S07-5) | result-states › "approval 3 on the live page …" ×2 (approved branch), "every error response keeps 톡톡 first …" ×7, "server error: …"; result-kit › "failure card › …"; S04 failure-causes (`RESULT_APPROVALS.approval3`) | migrated (approval 3) |


## S08 — supplementary areas and styles

Rows added by S08. An old assertion is removed only after its new one passed (spec §14 test contract 1). Expected values that are not E2E-locked strings (roadmap §11.11) are computed in the tests with `deriveTrackingView` and `recommendationsForView`, so config copy changes never break a rule test.

| # | Rule (spec) | Old assertion (file › test) | New assertion (file › test) | Status |
|---|---|---|---|---|
| S08-1 | 국내 도착 전 추천 노출 — the content part of S07-7 (§8 추천, §16 item 10 거절하면: '운영자 추천' 창, 가격·할인 없음) | tracking.spec › "pending state offers inquiry and purchase-channel choices" (dialog trigger and content; the file was deleted by S07 after S07-7) | recommendations › "pending: '운영자 추천' follows 처리 내역 …", "no product link is in the page until the dialog opens …", "where recommendations appear" ×8, "after every validity span has ended …" | migrated (Task 3) |
| S08-2 | 홈은 투명한 스토어 선택지 — 쇼케이스 부분 (S06 row S1 "showcase part kept → S08"; §4 첫 화면 아래, §8 고지 선행) | tracking.spec › "home offers transparent storefront choices without interrupting tracking" (showcase heading, links and disclosure; the file was deleted by S07) | ad-placement › "home store showcase (S08)" ×4 | migrated (Task 4) |
| S08-3 | 오류·결과 화면에는 쇼케이스 없음; 조회 전 홈에는 있음 (§8 표) | cta-consistency › "the idle page keeps its store shortcuts" and "…: no store, showcase, popup, recommendation or sponsored link anywhere on the page"; failure-causes › the error rows and "invalid400 (S06): …" — all selecting the legacy `[data-storefront-showcase]` | the same tests with `[data-store-showcase]` (selector only; no assertion or expected value changed); ad-placement › "the showcase is home-only …" ×3 | selectors migrated (Task 4) |
| S08-4 | 푸터: 개인정보처리방침 링크와 톡톡 한 곳, 톡톡은 화면당 최대 3곳 (§8 문의, §12 3.2.6) | privacy.spec › "privacy policy is reachable from the footer and explains the no-storage rule" (footer link part — kept unchanged) | ad-placement › "footer (S08)" ×4 | added (Task 5); privacy.spec kept |
| S08-5 | 광고 로더 시점: 홈은 허용 결과 확정 또는 쇼케이스까지 스크롤 뒤, 딥링크는 주소 정리 + 허용 결과 뒤, 문제 상태 동안 보류 (§8 광고, §16 item 7) | internal-isolation › "public pages still load the AdSense loader (control)" (loader right after load on '/'); url-privacy rows are policy-aware and stay | ad-placement › "ad timing (S08, approval 7)" ×4; internal-isolation control test scrolls to the showcase first; unit ad-gate › "afterAllowedResult (approval 7): …" | migrated (Task 9) |

## I — internal CS desk (S09)

The CS helper suite (`tests/internal-cs-helper.spec.ts`, S01 + S04) is staff tooling, not one of the E2E-locked customer rules, but its rules move the same way: the new assertion passes before the old test is removed (spec §14 test contract item 1). New assertions live in `tests/e2e/internal-bulk.spec.ts` (B), `tests/e2e/internal-mismatch.spec.ts` (M) and `tests/e2e/internal-desk.spec.ts` (D). Titles are exact.

| Id | Legacy test (`tests/internal-cs-helper.spec.ts`) | Business rule | New assertion (file → test) | Status |
|---|---|---|---|---|
| I1 | "internal helper generates a copy-ready delivery reply from an invoice" | One number gives a copy-ready reply built by `buildCsReply` from the view the customer sees; carrier and number are shown; the reply carries the customer link and no internal label or server wording; a copy control exists | B → "one number: the row shows the number and carrier, and the replies equal buildCsReply over the customer's view"; "the copy buttons copy the short reply, the long reply and the customer link" | migrated (Task 10) |
| I2 | "internal helper answers pending invoices from the same view and saves nothing" | pending gets its reply from the same view; looking numbers up stores nothing in the browser | B → "pending: the reply comes from the same view, and a run stores nothing in the browser" | migrated (Task 10) |
| I3 | "internal helper turns a failed lookup into a CS reply, never the server message" | a failed lookup gets the CS error reply; the server's message is never shown | B → "a failed lookup gets the CS error reply, never the server message" | migrated (Task 10) |
| I4 | "internal helper stores customs mismatch drafts locally" | a draft is saved with the phone, the memo and the template text and survives a reload; the tool itself sends nothing (the disabled '알림톡 준비중'). The phone is now shown masked (spec §10) | M → "a saved draft is listed with the masked phone, memo and template text and survives a reload"; "the tool never sends messages: a record offers copy, status and delete only" | migrated (Task 9) |
| I5 | "internal helper keeps mismatch drafts for 14 days and can clear them all" | legacy drafts migrate, expired ones are dropped, the retention is stated, [전체 삭제] clears storage | M → "legacy drafts are migrated, expired ones dropped, and [전체 삭제] clears everything" (approval 14: "legacy drafts move into this tab's list, expired ones are dropped, and [전체 삭제] clears everything") | migrated (Task 9) |
| I6 | "internal helper still works when the browser refuses storage" | the tab opens with an empty list; saving explains the refusal in Korean | M → "a browser that refuses storage still opens and explains why saving failed" | migrated (Task 9) |

New S09 assertions without a legacy counterpart: D (tablist/tab/tabpanel semantics, keyboard, `?tab=`, kept panel state, the four spec tabs); B (paste parsing, 20-number limit and [멈추기], problem-first order, the 375 px read-only customer screen, ≥ 1000 ms spacing with the chosen carrier, overlapping runs, blocked clipboard); M (masking, phone copy, status, template copy, missing phone; approval 14: tab-only default, 7-day keep, expiry); `tests/e2e/internal-preview.spec.ts` (every state's screen and replies equal the Node derivation, fake numbers only, read-only, 375 px); `tests/e2e/internal-notices.spec.ts` (lists, places, holiday and simulated screens follow the chosen KST time, also in a non-KST browser).
