# S04 — R2 Status Slot on the Current Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the current (dark, legacy) page, replace the three scattered loading/error/result renderings with one status slot directly under the lookup form — staged loading copy with [조회 취소] and a 45 s client timeout, per-cause errors that never show server wording, and a result summary whose every sentence, button, store link and recommendation comes from `deriveTrackingView` — so the 8 GAP3-06 contradictions disappear, focus and the one polite live region behave as spec §5 says, and the internal CS helper answers from the same view model.

**Architecture:** Three pure or browser modules own the behavior: `lib/tracking/lookup-state.ts` (reducer with the failure streak), `lib/tracking/fetch-track.ts` (the only `/api/track` caller; schema parsing through a dynamic import) and `components/lookup/useLookup.ts` (one request per loading state, one timer to the next visible change, one automatic re-lookup after an offline failure). `components/primitives/LiveAnnouncer.tsx` provides the page's single polite live region. `components/HomePageClient.tsx` owns the controlled `TrackingForm`, derives the view once per settled request (`deriveStatusView` = `deriveTrackingView` + the transitional approval fallbacks) and renders `components/status-slot/StatusSlot.tsx` inside the lookup card. `CustomerCta` becomes the view-driven "지금 할 일" block; `RecommendedProducts` shows only where the view allows it. The legacy summary, error and spinner components are deleted as soon as nothing renders them.

**Tech Stack:** Next.js 16.3.6 App Router, React 19.3, TypeScript strict, Tailwind CSS 3.4 (legacy classes only — S05 builds tokens in parallel), zod 3.25 (loaded lazily by `fetchTrack`), Playwright 1.55+ as the only test runner (unit tests are Playwright tests without `page`; E2E pin the page clock). Windows: every `npm`/`npx`/`node` command runs in PowerShell 5.1.

**Spec:** `docs/superpowers/specs/2026-09-26-tracking-renewal-ia-design.md` — §2 원칙 1·3·6, §5 (time axis, causes, focus and live region), §6 (order, spine, ETA, 지금 할 일, overdue), §7 (per-state rows: loading, every error row, pending, customsWaiting, customsCleared, inTransit, delivered, overdue, stale, lookupUnavailable, ambiguous), §8 (placement table), §10 (CS reply from the same view), §12 (WCAG rules for live regions, focus, aria-busy), §14 (test contract), §15 R2, §16 items 2 and 3, §18 keep-list. **Roadmap and shared contract:** `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` (§4 ledger, §6 Task 0, §7 gate, §9 budgets, §10 File Map, §11 contract). **Stage plans consumed:** `…-01-r0-urgent-fixes.md` (fixtures, `lib/site.ts`, `lib/cs/mismatch-storage.ts`, format hint), `…-02-r1-number-protection.md` (`lib/clipboard.ts`, `ReturnLinkButton`, scrub and restore in `HomePageClient`, the optional same-address history entry), `…-03-r2-state-core.md` (types, config incl. `resultCopy`, `deriveTrackingView`, `deriveLoadingView`, `nextLoadingChangeMs`, `classifyFailure`, `buildCsReply`, `tests/fixtures/{config-fixtures,derive-scenarios}.ts`, the module-boundary test). **Evidence:** GAP3-06 (12 variants, 8 contradictions) and GAP2-01 (NOT_FOUND path 29.19–40.19 s) in `C:/Users/sos84/AppData/Local/Temp/claude/C--Users-sos84-OneDrive-------------04------01------------05----------------claude-worktrees-tipoasis-tracking-renewal-ae0e3a/3566a5b8-54f5-4bd4-bd54-e5e56b713935/scratchpad/phase1/results-run2/gaps.json`.

**Depends on:** S02 (R1 number protection), S03 (R2 state core); S01 through both.
**Gated by:** approval 2 (Task 10: replace copy-bound result assertions), approval 3 (Task 9: recovery action as the error screen's primary).
**Release / order:** R2 (with S03), prerequisite stage. Branch `renewal/s04-r2-status-slot`.

---

## Global Constraints

Every task in every stage plan implicitly includes these. Values are copied from the spec; Korean strings are verbatim.

**Product and scope**
- Operating URL is `https://tracking.tipoasis.com`. Customers arrive both through `/{번호}` links and direct entry on `/`; both are first-class entrances (spec §1).
- Reading order: 조회 → 지금 상태 → 예상일 → 해야 할 일; detailed history only on demand (§1).
- The two old example numbers in `components/TrackingForm.tsx` (`SAMPLE_NUMBERS`) are real customers' shipments. Real numbers appear nowhere: screens, tests, docs, design canvases, CS examples use only `0000`·`ABCD`·`TEST` series (§4). All unidentified 12-digit numbers found in tests are treated as real (§17 Q4 default).
- Do not change: the `POST /api/track` request/response contract (`lib/schemas.ts`), `lib/types.ts`, the lookup/parse logic in `lib/services/{customs,customstrack,delivery,carrier-html,http,identifier,normalizer}.ts`, `lib/cache.ts`, `lib/rate-limit.ts`, `lib/delivery-carriers.ts`, `proxy.ts`, `app/api/track/route.ts` — except S10 under approval 5 (contract still unchanged). The two CS helpers that live in `lib/services/` (`cs-mismatch-storage.ts`, `cs-reply-template.ts`) are not lookup logic and are moved to `lib/cs/` (S01, S04).
- The client calls only `/api/track`. API keys are server-only (never `NEXT_PUBLIC_`). No lookup history is stored on the server.
- E2E-locked business rules (§1): 오류는 문의 우선·스토어 홍보 없음; 국내 도착 전은 문의 + 구매처 선택지; 배송 중은 쇼핑 링크를 주 흐름 밖에; 배송 완료는 스토어 선두; 모바일 첫 화면에 상담·스토어 바로가기; 오래된 이력은 예상일 대신 확인 안내; 고객 언어(브랜드·로봇·AI 문구 금지); 유한 모션과 reduced-motion 존중. Changing their wording or visual hierarchy requires the approval named in §4.
- Keep `data-ad-exclude` on the lookup and result areas and `google-anno-skip` on `<body>` (§1, §8).
- Korean customer language, WCAG 2.2 AA, full keyboard operation (§1).
- New external services and new npm dependencies are proposed only; installing them requires approval 13 (§1, §16).

**Routes and privacy (§3, §5, §8, §12)**
- `/`: static render + `revalidate = 300`; never reads `searchParams`. `/?trackingNumber=X` → 307 to `/X` via `next.config` `redirects` (`has` query).
- `/{번호}`: server uses `identifyTrackingNumber` only. Valid → SSR result shell (number bar + '조회하고 있어요' card); alphanumeric 6–30 chars but invalid → INVALID screen SSR without calling the API; anything else (e.g. a dot in the path) → real 404. Optional `?c=CJ|EPOST|HANJIN|LOTTE|LOGEN`. Response: `X-Robots-Tag: noindex`, `Cache-Control` private·no-store; the document title never contains the number.
- `/privacy` static; `/internal/cs-helper` in the `(internal)` route group with no ads/analytics/public header; basic auth kept; `noindex`·`no-store`·`no-referrer`. `robots.txt` and `sitemap.xml` are real routes.
- Candidate B order (GAP1-02): ① SSR shell has 0 ad scripts ② lookup starts right after hydration ③ `useEffect` checks `history.state.__NA` (rAF retry; if never present → no ads) ④ sessionStorage gets 1 entry {번호, 택배사, 시각} ⑤ `replaceState(null,'','/')` (hash included) ⑥ re-check pathname `'/'` → urlSafe. Head-inline scrubbing is forbidden (GAP1-01). `data-page-url` on the loader is forbidden (GAP1-03).
- Restore: only on `reload` and `back_forward` navigations, tab-only (sessionStorage), 1 entry, 30 minutes.
- Same-address `pushState` for back navigation is added only after the local-router regression passes.
- `Referrer-Policy: strict-origin` on every route.
- Third-party requests (URL and body) contain 0 runs of 10+ digits and 0 HBL-pattern tokens (checked by E2E); the only exception is the `/api/track` POST body.

**Loading and failure (§5)**
- 0–0.4 s: only the button label '조회 중…'. 0.4–3 s: '조회하고 있어요' + static skeleton of the result's height. 3 s: '해외 화물은 여러 해의 기록을 찾아서 조금 더 걸려요. 보통 10초 안에 끝나요.' + [조회 취소]. 8 s: '기록이 없는 번호는 30초 가까이 걸릴 수 있어요. 번호가 맞는지 한 번 봐 주세요.' (live once) + elapsed '12초째' (5 s steps); if a carrier was chosen, '택배사 공식 조회로 먼저 보기'. Spinner stops after 5 s; no time-filled percent bar.
- Client timeout: 45 s before approval-5 deployment, 25 s after (`config.lookup.timeoutMs`).
- Inputs are never `disabled` while loading; use `aria-busy`. A new submit aborts the previous request (AbortController).
- 429 → 10 s countdown before [다시 조회] is enabled (no auto retry). Offline → one automatic re-lookup when back online. Two consecutive failures → 톡톡 becomes the primary button. Server raw messages ('관리자에게 문의해주세요') are never shown.
- One polite live region exists in the layout before any announcement. Results/errors move focus to the visible status `h2` (`tabindex=-1`); deep links move focus only if the customer has not interacted. `role=alert` only on error sentences, never on the focused heading.

**Result area (§6, §7)**
- Fixed order: 번호 바 → 상태 카드 → 도착 예상 → 지금 할 일 → 마지막 처리; then `<details>` '처리 내역 N건 보기'. No ads/stores/recommendations/banners between them. Visually hidden `h1` '배송 조회 결과' + status `h2`.
- Number bar: 4-character groups, monospace digits, 0 truncation; at 320 px [번호 변경]/[다시 조회] wrap to the next line.
- Journey: one horizontal 4-station spine `<ol aria-label='배송 여정 4구간'>` with exactly one `aria-current=step` (0 when 위치 확인 전). Stations ①해외 출발 ②입항·통관 ③국내 배송 ④도착. Codes 1–3 and 4 (통관 완료·인계 대기) → ②, 5–6 → ③, 7 → ④. pending·NOT_FOUND → '위치 확인 전' with no marker. Issue marks 멈춤(stale)·끊김(carrier lookup delay)·갈림(multiple carriers) use color + icon + text.
- Tones: 정상 진행, 정보 대기, 확인 필요, 문제, 완료. Red only for 문제.
- ETA is the largest text (32–40 px) with D-n; holiday overlap → badge '추석 연휴 영향 · 1~2일 늦어질 수 있어요' and D-n / '오늘 예상' hidden. stale → '지금은 도착 예상일을 안내하기 어려워요'; pending → '정보 등록 후 안내'.
- 지금 할 일: one sentence, at most 1 primary action, 1–2 secondary. Normal waiting states have no filled button and say '지금은 하실 일이 없어요'. Worry date line binds to a 톡톡 text link.
- Overdue: when today (KST) is after the worry date, the same state switches to '확인 필요' tone; [문의 내용 복사하고 톡톡 열기] becomes primary; recommendations and ads 0. Judged with the client KST time when the result settles (never during render).
- Deriving priority: 오류 > ambiguous(이벤트 0) > lookupUnavailable(이벤트 0) > pending > delivered(7) > stale > inTransit(6) > customsCleared(4–5) > customsWaiting(1–3), then overdue (§14).

**Placement (§8)**
- Store/affiliate blocks start with the definitive disclosure; `isAffiliate` alone decides `rel="sponsored nofollow"` and the disclosure.
- 톡톡: at most 3 places per screen (header, one state place, footer), one visual style.
- Ads: loader only when the URL has no number, the ad-allowed state is confirmed, and the path is not `/internal`. Manual slot: 1 per page, right before the footer, reserved `min-height` (mobile 280 px, desktop 250 px), `scroll-padding-bottom` equal to the anchor height. "Problem state ads 0" = manual slot 0 + no new loader.
- Recommendations: inline only; only items inside their validity window; 0 items → no block; '이번 주' label only if the validity window is ≤ 7 days; price only with a product-detail link and a check date within 7 days.

**Config (§9)**
- `config/site.config.ts` (Korean comments), `lib/config/schema.ts` (zod + `superRefine`, Korean messages such as 'notices[0].endsAt: 종료 시각이 시작보다 빠릅니다'), parse in a server-only module; the client gets only validated plain objects; CS templates in an internal-only file.
- stateGuide tokens: only `{etaDate}` `{worryDate}` `{lastEventDate}` `{carrier}` `{staleDays}`. `staleDays` equals the server's 14.
- Invariants: problem states → stores·ads·recommendations 0; inTransit → stores 0; delivered → stores lead; pending → 문의 + 구매처; affiliate placements require the disclosure; any copy with a 10+ digit run, an HBL pattern, or 'AI·인공지능·로봇·봇' fails.
- Notices: priority outage > delay > holiday > info; title ≤ 20 chars, body ≤ 80 chars; KST windows; one per screen; never announced on page load; `/` re-filters with KST after mount.
- Holidays: badge + D-n suppression + business-day worry dates. Example: 통관 완료 9/23(수) → 인계 걱정 기준 9/29(화). The build warns about missing holidays in the next 60 days.

**Accessibility, performance, security budgets (§12)**
- 2.5.8 targets ≥ 24 px, actions 44–52 px; 1.4.11 focus ring ≥ 3:1; 1.4.3 body text ≥ 4.5:1; 0 text at ≤ 11 px; 1.4.10 no horizontal scroll at 320 px; 2.2.2 no infinite animation, reduced-motion → 0 motion; `<details>` for history; carriers as fieldset + radio; no dialogs.
- JS (module, gzip -9): `/` initial ≤ 165 KB (app ≤ 25 KB; fail above 175 KB), lazy result chunk ≤ 30 KB, `/[번호]` total ≤ 195 KB, warn at 145 KB (platform floor 138,783 B).
- Fonts: ≤ 2 preload files, ≤ 100 KB in the first view. CSS ≤ 25 KB. `/` HTML ≤ 35 KB, CDN HIT.
- LCP: `/` ≤ 2.0 s on Slow 4G, field p75 ≤ 2.5 s; deep-link shell first paint ≤ 1.0 s on Fast 4G. CLS ≤ 0.05. INP p75 ≤ 200 ms. No SSR `opacity:0`.
- Security headers stage 1: `poweredByHeader: false`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin`, minimal `Permissions-Policy`, minimal enforced CSP + CSP Report-Only, HSTS `includeSubDomains`. Strict nonce CSP is approval 16.

**Visual (§13)**
- Drop glow shadows, blur blobs, grid backgrounds, gradient buttons, decorative 01/02/03 numbers, meaningless icons (Sparkles·DB). One filled primary button per screen. Motion 150–300 ms fade/height once; no infinite loop; reduced-motion → 0.
- Styles: 기본(B `signal`, default) · 서류형(A `manifest`) · 어두운 화면(C `night`). Picker: fieldset + legend '화면 스타일', 3 radios (44 px each), right above the footer. First visit: stored choice, else `signal`, but `night` when `prefers-color-scheme: dark` and `style.followSystemDark` (default `true`). Storage: `localStorage` `tt:style` = `signal` | `manifest` | `night`, try/catch, never sent to a server. A tiny inline `<head>` script sets `html[data-style]` before first paint; `/` stays static; under an enforced CSP the script is allowed by hash (no `unsafe-inline`). Style = token set + 4 variant slots (status head, ETA display, journey figure, button corner/fill); structure, DOM order, `data-*` hooks, copy and placement are style-independent. Default style: system gothic + 1 numeric subset file. Other styles' fonts download only when chosen. Switching announces '화면 스타일을 서류형으로 바꿨어요' once. Visual matrix 8 key states × 2 widths × 3 styles = 48 shots; axe and contrast tests repeat per style.
- B supplements: cap the result color field so 지금 할 일 starts within ~420 px at 375×812; '확인 필요' = amber field with ink text, red only for '문제'; link color separate from the '정상 진행' tone; the home shortcut row bottom at ~500 px (≤ 550 px at 375×667).

**Engineering**
- TypeScript strict; no `any`; no `@ts-ignore`; validate inputs/responses with zod at boundaries.
- Windows: Node/npm/npx are not on the Bash tool's PATH; every npm/npx command runs in PowerShell 5.1 (no `&&`; chain with `;`; env vars via `$env:NAME='x'`).
- A config-protection hook blocks agent edits to ESLint/formatter config (`eslint.config.mjs` etc.). Any such change is a step that hands the operator a PowerShell command to run.
- Conventional commits (`feat|fix|refactor|docs|test|chore|perf|ci`), no attribution trailer.
- Never push to `main` (push = production deploy) and never run `vercel deploy` without explicit operator approval.


**Stage-specific (S04)**
- S04 works on the CURRENT page (dark legacy styling). The status slot sits inside the light lookup card `#tracking-panel`, directly under the form (spec §15 R2 "StatusSlot을 현 폼 바로 아래에"). No tokens and no `components/primitives/*` other than `LiveAnnouncer` (S05 runs in parallel); legacy Tailwind classes only. Text is never below 12 px (`text-xs`), actions are at least 44 px high (`min-h-11`) except inline text links (`min-h-6`, 24 px).
- Every customer sentence in the slot comes from the view model (`deriveTrackingView` through `deriveStatusView`) or from `config/site.config.ts`. Exceptions, all transitional and reported as deviations: the approval fallbacks in `components/status-slot/status-view.ts` and the clipboard-fallback hint in `CopyInquiryButton`. Spec strings that are also selectors (§11.11) are used as literals: '조회번호', '배송 여정 4구간', '인계 대기', '위치 확인 전', '택배사 선택', '안내'.
- Time: overdue and stale are judged with the client's clock when a result settles (`onSettled(outcome, now)`), never during render. Every S04 E2E pins the page clock (`page.clock.setFixedTime`, or `page.clock.install` + `pauseAt` when timers must be driven).
- S10 Part B compatibility (S10 plan, cross-stage requirement 6): S04 tests read `lookup.timeoutMs`, `lookup.stageMs`, `lookup.skeletonDelayMs`, `lookup.spinnerStopMs`, `lookup.elapsedStepSeconds`, `lookup.rateLimitCooldownSeconds` and `lookup.notFoundServiceCaveat` from `@/config/site.config`; the slow-but-valid delay is `Math.min(29_190, lookup.timeoutMs - 4_000)`.
- Approvals 2 and 3 are read from the ledger in Task 0. While approval 2 is not granted, the result sentences the pre-renewal E2E asserts stay byte-identical on screen (Task 3 overlay) and only selectors that pointed into deleted legacy components are re-pointed (rule → assertion map, Task 6). While approval 3 is not granted, 톡톡 is the filled primary on every error screen and [번호 수정]/[다시 조회] are secondary (Task 3 transform).
- S02's privacy suites (`tests/e2e/url-privacy.spec.ts`, `session-restore.spec.ts`, `return-link.spec.ts`, `legacy-query-redirect.spec.ts`) must stay green unchanged: they select only the input label, the Enter key, the button '다시 볼 링크 복사' (the "result settled" hook) and `data-ad-loader`. S04 renders `ReturnLinkButton` in every settled result.
- Numbers in tests come only from `tests/fixtures/tracking-fixtures.ts`; no test or plan text contains a 10+ digit run that does not start with `0000`.

## Review Focus

Conditions the spec implies but no requirement line names; each is pinned by a test in the owning task.

1. **A second submit before the first answer, or a late first answer** (Enter pressed twice, the number corrected mid-lookup, a slow first answer arriving after the second): only the latest request settles the slot, a late answer changes nothing, and the failure streak counts only the same number. Pinned: Task 1 "late answers after cancel or settle change nothing", "a different number starts a new streak at 1"; Task 4 E2E "a new submit aborts the previous request and ignores its late answer".
2. **Answers that are not what the contract promises** (an HTML 502, a 200 HTML page, a JSON error with the wrong content type, an empty body, `{ "success": true }` without data): each maps to a cause, nothing crashes, and no server wording reaches the screen. Pinned: Task 2 units "a 200 HTML page is not JSON", "a JSON error body is read as JSON even with a wrong content type", "an empty body is not JSON"; Task 5 E2E table over all eight failure fixtures.
3. **Connection flapping** (offline failure, the connection returns, the automatic re-lookup fails offline again): exactly one automatic re-lookup, never a loop. Pinned: Task 5 E2E "offline: one automatic re-lookup when the connection returns, never a second in a row".
4. **A customer who scrolls, taps or types while a deep link is still loading**: focus stays where the customer is; the live region still reads the result. Pinned: Task 6 E2E "deep link: focus stays where the customer is once they interacted".
5. **In-app browsers that refuse the clipboard** (roadmap Review Focus 3, S04 part): [문의 내용 복사하고 톡톡 열기] still opens 톡톡 and a read-only, pre-selected box shows the inquiry text. Pinned: Task 6 E2E "blocked clipboard shows the inquiry in a selectable box".

## Additions to the contract

Reported to the roadmap owner; nothing here renames or retypes a §11 name.

1. **`lib/tracking/lookup-state.ts` also exports `lastRequestOf(state: LookupState): LookupRequest | null`** (the request [다시 조회] repeats; `useLookup.retry` uses it).
2. **`LookupState.startedAt`/`settledAt` and `LookupEvent.at` carry `performance.now()` values** (monotonic milliseconds, faked by `page.clock` in tests), not epoch time. The wall-clock `now` for KST judgments is passed separately to `onSettled`.
3. **S04-private files (File Map additions; deleted by S07 with `components/status-slot/` and the S04 E2E rewrite):** `components/status-slot/status-view.ts` (`StatusSlotApprovals`, `STATUS_SLOT_APPROVALS`, `LEGACY_RESULT_COPY`, `applyApprovalFallbacks`, `deriveStatusView`), `components/status-slot/SlotParts.tsx` (`RECOVERY_KINDS`, `TONE_BORDER`, `actionClassName`, `ActionControl`, `NumberLine`, `ChipLine`, `NoticeLine`, `AuxiliaryLine`), `tests/support/status-slot.ts` (E2E helpers), `tests/unit/status-view.spec.ts`. File Map row changes: `tests/unit/mismatch-storage.spec.ts` gains "M S04" (import path only).
4. **S04-private `data-*` hooks** (S07 rewrites the selectors): `data-status-slot` (`loading` | `error` | `settled`) on the slot root, `data-action-kind` + `data-action-weight` on every action control, `data-spinner` (`on` | `off`), `data-loading-skeleton`, `data-worry-line`, `data-inquiry-preview`, `data-carrier-choice`, `data-last-event`, `data-copy-fallback` (same name S02's `ReturnLinkButton` uses). S04 also puts S05's hook names on its transitional markup with the contract values: `data-tone`, `data-station`, `data-station-state`, `data-issue`, `data-spine-current`, `data-affiliate-group`, `data-affiliate-disclosure`, `data-link-placement`, `data-notice-kind`.
5. **Transitional component props (S04-private):** `TrackingForm` becomes controlled (`value`, `onValueChange`, `carrier`, `onCarrierChange`, `onSubmit`, `busy`, `invalid`, `inputRef`, `surface`) and exports `INVALID_NUMBER_ERROR_ID`; S02's transitional props (`onSuccess`, `onError`, `onLoading`, `onSubmitted`, `initialTrackingNumber`, `initialCarrier`) and `TrackingFormSubmitSource` are removed (their behavior moves into `HomePageClient`). `CustomerCta` gains `variant: "view"` (`{ view, onAction }`) and exports `INLINE_HELP_IDS`; its legacy `variant: "result"` is removed in Task 6; `variant: "floating"` stays for S06 to delete. `RecommendedProducts` props become `{ context: "pending" | "inTransit" | "delivered" }` (exported type `RecommendationStage`).

## Contract deviations

1. **Approval-3 fallback is a view transform in the transitional slot, not a config edit.** S03 addition 10 proposes setting the error rows' `primaryAction` to `"copyAndTalk"` in `config/site.config.ts`. S04 instead promotes the existing `talk` action to the filled primary (`applyApprovalFallbacks`), because (a) spec §16 item 3 "거절하면" asks for 톡톡 as the filled primary, which the config route would render as '문의 내용 복사하고 톡톡 열기' and so break the E2E-locked '톡톡으로 문의하기' error link while approval 2 is pending, and (b) S03's `derive-view.spec.ts` pins the approval-3 proposal against `siteConfig`. S07's `FailureCard` must make the same ledger decision.
2. **Approval-2 fallback is a wording overlay (`LEGACY_RESULT_COPY`) in the transitional slot, not a `stateGuide` edit,** because S03's `derive-view.spec.ts`, `config.spec.ts` and `cs-reply.spec.ts` pin the spec §7 copy through `FIXTURE_CONFIG = { ...siteConfig }`. The internal CS reply keeps the spec copy.
3. **`components/HomePageClient.tsx` (legacy, deleted by S06) imports `siteConfig` and `deriveTrackingView` statically** (through `status-view.ts`); roadmap §11.7 reserves `siteConfig` for the lazy result chunk and server code. S06/S07's `LookupController` uses `loadResultModule()`.
4. **One transitional stage-authored string outside the config:** '아래 문의 내용을 길게 눌러 복사해 주세요.' (`CopyInquiryButton` fallback label), mirroring S02's `ReturnLinkButton`; S07 replaces the component with S05's `CopyButton` and config copy.
5. **Stage screens live in `test-artifacts/stage-screens/`** (S01 addition 1): wherever the verbatim Task 0 Step 5 or gate G7 says `test-results/stage-screens/…`, read `test-artifacts/stage-screens/…`.

## File Structure

| File | Action (task) | Responsibility |
|---|---|---|
| `lib/tracking/lookup-state.ts` | Create (1) | Pure reducer: idle/loading/settled/error, failure streak, `lastRequestOf` |
| `tests/unit/lookup-state.spec.ts` | Create (1) | Reducer rows |
| `lib/tracking/fetch-track.ts` | Create (2) | The only `/api/track` caller: timeout, abort, `FailureInput` mapping, lazy schema |
| `tests/unit/fetch-track.spec.ts` | Create (2) | Fetch stubs for every failure fixture, network, timeout, abort |
| `components/status-slot/status-view.ts` | Create (3), Modify (9, 10) | Approval ledger for the slot, legacy wording overlay, talk-first transform, `deriveStatusView` |
| `tests/unit/status-view.spec.ts` | Create (3), Modify (9, 10) | Fallback rows |
| `components/primitives/LiveAnnouncer.tsx` | Create (4) | The one polite live region + `useAnnounce` |
| `components/lookup/useLookup.ts` | Create (4) | Request lifecycle, timeout, stage timer, reduced motion, online re-lookup |
| `components/status-slot/LoadingTimeline.tsx` | Create (4) | Staged loading card with [조회 취소] and a static skeleton |
| `components/status-slot/StatusSlot.tsx` | Create (4), Modify (5, 6) | One slot: loading → error → result |
| `components/TrackingForm.tsx` | Rewrite (4) | Controlled form, `aria-busy`, never `disabled`, invalid-number wiring |
| `components/HomePageClient.tsx` | Rewrite (4, 6), Modify (5, 7) | Live region provider, `useLookup`, restore/scrub/history (S02), focus rules, placements |
| `components/LoadingSpinner.tsx`, `components/ErrorMessage.tsx`, `components/ui/skeleton.tsx`, `components/ui/alert.tsx` | Delete (4) | Replaced by the slot |
| `tests/support/status-slot.ts` | Create (4) | E2E helpers: held responses, lookup, slot locators, paused clock |
| `tests/e2e/loading-timeline.spec.ts` | Create (4) | Time axis, live region, busy form, cancel, abort, 29.19 s |
| `components/status-slot/SlotParts.tsx` | Create (5) | Action controls (429 cooldown), number/chip/notice/auxiliary lines |
| `components/status-slot/FailureNotice.tsx` | Create (5) | Per-cause error card, alert sentence, recovery actions |
| `components/status-slot/WorryLine.tsx` | Create (5) | Worry-date sentence bound to the 톡톡 link |
| `components/status-slot/CopyInquiryButton.tsx` | Create (5) | Copy the inquiry and open 톡톡, selectable fallback |
| `components/CustomerCta.tsx` | Modify (5, 6) | View-driven "지금 할 일" block; legacy result variant removed (6) |
| `tests/e2e/failure-causes.spec.ts` | Create (5) | Every cause, 429 countdown, offline re-lookup, escalation, timeout |
| `components/status-slot/ResultSummary.tsx` | Create (6) | Status card, 4-station spine, arrival estimate |
| `components/RecommendedProducts.tsx` | Modify (6) | Shown only where the view allows, context from the view |
| `components/TrackingResultSummary.tsx` | Delete (6) | Replaced by `ResultSummary` |
| `tests/e2e/status-slot.spec.ts` | Create (6) | Focus, live region, worry line, overdue, copy-and-talk, carrier chips |
| `tests/tracking.spec.ts`, `tests/privacy.spec.ts` | Modify (6, 10) | Selector re-points (6); copy-bound → hooks (10, approval 2) |
| `tests/e2e/cta-consistency.spec.ts` | Create (7) | GAP3-06: 12 variants + 5 error codes, stores/recommendations placement |
| `tests/tools/stage-screens.spec.ts` | Modify (7) | Append S04 scenarios |
| `lib/cs/mismatch-templates.ts` | Create (8) | `CUSTOMS_MISMATCH_TEMPLATES`, `CustomsMismatchTemplateKey` |
| `lib/cs/mismatch-storage.ts`, `tests/unit/mismatch-storage.spec.ts` | Modify (8) | Import path |
| `components/InternalCsHelper.tsx` | Modify (8) | `fetchTrack` + `deriveTrackingView` + `buildCsReply` |
| `lib/services/cs-reply-template.ts` | Delete (8) | Replaced |
| `tests/internal-cs-helper.spec.ts` | Modify (8) | Reply equals `buildCsReply` for the same view |

Execution order: Task 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → gated Tasks 9 (approval 3) and 10 (approval 2), each checking the ledger first → Task Final.

**Commands used throughout (PowerShell 5.1, repo root):**
- Unit tests (no web server): `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/<file>.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
- Dev-mode E2E (port 43210 free; Playwright starts `next dev`): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test <files>`
- Port check / stop: `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue` → no output; otherwise `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`
- Paths with parentheses or brackets are quoted; `Test-Path`/`Get-Content`/`Select-String` use `-LiteralPath`.
- Line numbers below refer to the files as S01–S03 leave them. Every edit quotes the exact text to find; files S04 rewrites are given in full.

---

### Task 0: Stage start

- [ ] **Step 1: Read approvals.** Open `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §4. For every approval number in this plan's "Gated by" list, write its Status into the stage summary. `pending`/`rejected` → execute the fallback steps and mark the gated task SKIPPED with the reason.
- [ ] **Step 2: Confirm dependencies.** Run (PowerShell): `git log --oneline claude/tipoasis-tracking-renewal-ae0e3a -40`
  Expected: a `merge: SNN …` commit for every stage in this plan's "Depends on" list.
- [ ] **Step 3: Branch.** Run: `git switch -c renewal/s04-r2-status-slot claude/tipoasis-tracking-renewal-ae0e3a`
  Expected: `Switched to a new branch 'renewal/s04-r2-status-slot'`.
- [ ] **Step 4: Port free.** Run: `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue`
  Expected: no output. Otherwise stop the listener: `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`
- [ ] **Step 5: Baseline build and before-screens.** Run `npm ci` only if `package-lock.json` changed since the last install in this worktree, then `npm run build`.
  Expected: build exits 0. Start the production server in a background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`
  Wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200`.
  Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='before'; $env:PW_STAGE='S04'; npx playwright test tests/tools/stage-screens.spec.ts`
  Expected: PNGs in `test-results/stage-screens/S04-before/` for widths 320, 375, 768, 1024, 1440. (S01 creates the tool first; S01 runs this step after its Task 1.)
- [ ] **Step 6: Baseline suite.** With the server still running: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test`
  Expected: record "N passed / M skipped / 0 failed" in the stage summary. Then stop the server (Step 4 command) and clear the flags: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.

**S04 notes on the standard steps above**
- Step 1: the "Gated by" list is approvals 2 and 3. Their fallbacks are built into Tasks 3 and 6 (`STATUS_SLOT_APPROVALS = { approval2: false, approval3: false }`); Task 9 (approval 3) and Task 10 (approval 2) run only when the ledger says `approved`.
- Step 2: expected `merge: S02 …` and `merge: S03 …` (and `merge: S01 …` below them).
- Step 5: the PNGs land in `test-artifacts/stage-screens/S04-before/` (S01 addition 1).

- [ ] **Step 7 (stage-specific): The artifacts S04 consumes exist.** Run:
  `Test-Path -LiteralPath tests/fixtures/tracking-fixtures.ts, tests/fixtures/config-fixtures.ts, tests/fixtures/derive-scenarios.ts, lib/site.ts, lib/clipboard.ts, lib/cs/mismatch-storage.ts, lib/privacy/session-restore.ts, lib/privacy/url-scrub.ts, lib/ads/ad-signals.ts, components/ReturnLinkButton.tsx, config/site.config.ts, lib/tracking/types.ts, lib/tracking/classify-failure.ts, lib/tracking/loading-view.ts, lib/tracking/derive-view.ts, lib/tracking/carriers.ts, lib/tracking/template.ts, lib/cs/cs-reply.ts, tests/unit/module-boundaries.spec.ts`
  Expected: nineteen lines `True`. Any `False` → stop; a dependency is not merged.
- [ ] **Step 8 (stage-specific): The names S04 imports are exported as the plans say.** Run:
  `Select-String -LiteralPath lib/tracking/loading-view.ts, lib/tracking/derive-view.ts, lib/tracking/classify-failure.ts, lib/tracking/carriers.ts, lib/tracking/template.ts, lib/cs/cs-reply.ts, lib/clipboard.ts, config/site.config.ts, tests/fixtures/derive-scenarios.ts -Pattern 'export (async )?(function|const) (deriveLoadingView|nextLoadingChangeMs|deriveTrackingView|classifyFailure|carrierOfficialUrl|fillSlots|buildCsReply|copyText|lookup|notices|resultCopy|stateGuide|siteConfig|success|failure)\b' | Measure-Object | Select-Object -ExpandProperty Count`
  Expected: `15`. A lower count → open the files: a missing or renamed name means the dependency deviates from its plan; stop and reconcile before Task 1.
- [ ] **Step 9 (stage-specific): Nothing of S04 exists yet, and the real example numbers are gone.** Run:
  `Test-Path -LiteralPath lib/tracking/lookup-state.ts, lib/tracking/fetch-track.ts, components/lookup/useLookup.ts, components/status-slot; git log --all --oneline -- lib/tracking/lookup-state.ts components/status-slot | Select-Object -First 5; git grep -c SAMPLE_NUMBERS -- components`
  Expected: four lines `False`, no log lines, and no `git grep` output (S01 removed the constant). If an S04 file or commit exists (a hotfix or parallel branch), stop and compare it with this plan task by task; skip only steps whose files already match exactly and list them in the stage summary.
- [ ] **Step 10 (stage-specific): Did S02 ship the same-address history entry?** Run: `Select-String -LiteralPath components/HomePageClient.tsx -Pattern 'ttLookup' | Measure-Object | Select-Object -ExpandProperty Count`
  Expected: a number. Write "S02 history entry: shipped" (count > 0) or "not shipped" (0) into the stage summary. Task 4 Step 5 keeps or drops the block marked `S02-HISTORY-ENTRY` accordingly.
- [ ] **Step 11 (stage-specific): Record the inherited page shape.** Run: `git grep -n -e "scrubNumberFromUrl" -e "readRestoreEntry" -e "ReturnLinkButton" -e "onSubmitted" -e "initialCarrier" -e "initial={false}" -- components/HomePageClient.tsx components/TrackingForm.tsx`
  Expected: `HomePageClient.tsx` shows the S02 scrub effect, the restore snapshot helpers, `ReturnLinkButton` under the result summary, `onSubmitted`/`initialCarrier` on `<TrackingForm …>` and the S01 hero `initial={false}`; `TrackingForm.tsx` shows the `onSubmitted`/`initialCarrier` props. Task 4 rewrites both files and keeps every one of these behaviors; a difference (e.g. a hotfix changed the scrub call) is carried into the Task 4 files and noted in the stage summary.

---

### Task 1: Lookup state reducer

**Files:**
- Create: `lib/tracking/lookup-state.ts`
- Test: `tests/unit/lookup-state.spec.ts`

**Interfaces:**
- Consumes: `FailureCause`, `LookupOutcome`, `LookupRequest` (`lib/tracking/types.ts`, S03); `TrackResponseData` (`lib/types.ts`); test-only `FAKE`, `trackData` (S01 fixtures).
- Produces (contract §11.8): `type LookupState`, `type LookupEvent`, `INITIAL_LOOKUP_STATE: LookupState` (`{ phase: "idle", lastRequest: null, failureStreak: 0 }`), `lookupReducer(state: LookupState, event: LookupEvent): LookupState`; addition 1: `lastRequestOf(state: LookupState): LookupRequest | null`. Pure (contract §11.1 rule 5): time arrives only as `event.at`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lookup-state.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { INITIAL_LOOKUP_STATE, lastRequestOf, lookupReducer } from "@/lib/tracking/lookup-state";
import type { LookupEvent, LookupState } from "@/lib/tracking/lookup-state";
import type { LookupRequest } from "@/lib/tracking/types";
import { FAKE, trackData } from "../fixtures/tracking-fixtures";

const DOMESTIC: LookupRequest = { number: FAKE.domestic, carrier: "AUTO", entry: "manual" };
const DOMESTIC_RETRY: LookupRequest = { ...DOMESTIC, entry: "retry" };
const HBL: LookupRequest = { number: FAKE.hbl, carrier: "CJ", entry: "manual" };

const submit = (request: LookupRequest, at: number): LookupEvent => ({ type: "submit", request, at });
const fail = (at: number): LookupEvent => ({ type: "failed", cause: "upstreamTimeout", at });
const run = (events: readonly LookupEvent[], from: LookupState = INITIAL_LOOKUP_STATE): LookupState =>
  events.reduce((state, event) => lookupReducer(state, event), from);
const streakOf = (state: LookupState): number => (state.phase === "error" ? state.outcome.consecutiveFailures : -1);

test("starts idle with no request and no failures", () => {
  expect(INITIAL_LOOKUP_STATE).toEqual({ phase: "idle", lastRequest: null, failureStreak: 0 });
  expect(lastRequestOf(INITIAL_LOOKUP_STATE)).toBeNull();
});

test("submit starts loading at the event time", () => {
  expect(run([submit(DOMESTIC, 100)])).toEqual({ phase: "loading", request: DOMESTIC, startedAt: 100, failureStreak: 0 });
});

test("an answer settles the request that was loading", () => {
  const data = trackData("inTransit");
  expect(run([submit(DOMESTIC, 100), { type: "succeeded", data, at: 900 }])).toEqual({
    phase: "settled",
    outcome: { kind: "success", request: DOMESTIC, data },
    settledAt: 900
  });
});

test("failures for the same number count up across retries", () => {
  expect(run([submit(DOMESTIC, 0), fail(10), submit(DOMESTIC_RETRY, 20), fail(30)])).toEqual({
    phase: "error",
    outcome: { kind: "failure", request: DOMESTIC_RETRY, cause: "upstreamTimeout", consecutiveFailures: 2 },
    settledAt: 30
  });
});

test("a different number starts a new streak at 1", () => {
  expect(streakOf(run([submit(DOMESTIC, 0), fail(10), submit(HBL, 20), fail(30)]))).toBe(1);
});

test("a success resets the streak", () => {
  const events: LookupEvent[] = [
    submit(DOMESTIC, 0),
    fail(10),
    submit(DOMESTIC_RETRY, 20),
    { type: "succeeded", data: trackData("pending"), at: 30 },
    submit(DOMESTIC_RETRY, 40),
    fail(50)
  ];
  expect(streakOf(run(events))).toBe(1);
});

test("cancel returns to idle and keeps the request and the streak", () => {
  const cancelled = run([submit(DOMESTIC, 0), fail(10), submit(DOMESTIC_RETRY, 20), { type: "cancelled" }]);
  expect(cancelled).toEqual({ phase: "idle", lastRequest: DOMESTIC_RETRY, failureStreak: 1 });
  expect(streakOf(run([submit(DOMESTIC_RETRY, 30), fail(40)], cancelled))).toBe(2);
});

test("late answers after cancel or settle change nothing", () => {
  const settled = run([submit(DOMESTIC, 0), { type: "succeeded", data: trackData("delivered"), at: 10 }]);
  const failed = run([submit(DOMESTIC, 0), fail(10)]);
  const cancelled = run([submit(DOMESTIC, 0), { type: "cancelled" }]);
  for (const state of [INITIAL_LOOKUP_STATE, settled, failed, cancelled]) {
    expect(lookupReducer(state, { type: "succeeded", data: trackData("pending"), at: 99 })).toBe(state);
    expect(lookupReducer(state, fail(99))).toBe(state);
    expect(lookupReducer(state, { type: "cancelled" })).toBe(state);
  }
});

test("reset forgets everything", () => {
  expect(run([submit(DOMESTIC, 0), fail(10), { type: "reset" }])).toBe(INITIAL_LOOKUP_STATE);
});

test("the last request is the one [다시 조회] repeats, in every phase", () => {
  expect(lastRequestOf(run([submit(DOMESTIC, 0)]))).toEqual(DOMESTIC);
  expect(lastRequestOf(run([submit(DOMESTIC, 0), fail(1)]))).toEqual(DOMESTIC);
  expect(lastRequestOf(run([submit(HBL, 0), { type: "succeeded", data: trackData("inTransit"), at: 1 }]))).toEqual(HBL);
  expect(lastRequestOf(run([submit(HBL, 0), { type: "cancelled" }]))).toEqual(HBL);
});

test("the reducer never mutates the state it receives", () => {
  const loading = Object.freeze(run([submit(DOMESTIC, 0)]));
  const snapshot = JSON.stringify(loading);
  lookupReducer(loading, fail(5));
  lookupReducer(loading, { type: "cancelled" });
  expect(JSON.stringify(loading)).toBe(snapshot);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/lookup-state.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading — `Error: Cannot find module '@/lib/tracking/lookup-state'` (0 tests run).

- [ ] **Step 3: Write the reducer**

Create `lib/tracking/lookup-state.ts`:

```ts
import type { FailureCause, LookupOutcome, LookupRequest } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

// Pure (contract §11.1 rule 5): every time value arrives in an event (`at`, performance.now() in useLookup), never from a clock here.

type SuccessOutcome = Extract<LookupOutcome, { kind: "success" }>;
type FailureOutcome = Extract<LookupOutcome, { kind: "failure" }>;

export type LookupState =
  | { readonly phase: "idle"; readonly lastRequest: LookupRequest | null; readonly failureStreak: number }
  | { readonly phase: "loading"; readonly request: LookupRequest; readonly startedAt: number; readonly failureStreak: number }
  | { readonly phase: "settled"; readonly outcome: SuccessOutcome; readonly settledAt: number }
  | { readonly phase: "error"; readonly outcome: FailureOutcome; readonly settledAt: number };

export type LookupEvent =
  | { readonly type: "submit"; readonly request: LookupRequest; readonly at: number }
  | { readonly type: "succeeded"; readonly data: TrackResponseData; readonly at: number }
  | { readonly type: "failed"; readonly cause: FailureCause; readonly at: number }
  | { readonly type: "cancelled" }
  | { readonly type: "reset" };

export const INITIAL_LOOKUP_STATE: LookupState = { phase: "idle", lastRequest: null, failureStreak: 0 };

/** The request [다시 조회] repeats; null before the first lookup (S04 addition 1). */
export function lastRequestOf(state: LookupState): LookupRequest | null {
  switch (state.phase) {
    case "idle":
      return state.lastRequest;
    case "loading":
      return state.request;
    case "settled":
    case "error":
      return state.outcome.request;
  }
}

/** Failures in a row for `number`: the streak survives retries and cancels of the same number only (spec §5 "2회 연속 실패"). */
function streakFor(state: LookupState, number: string): number {
  switch (state.phase) {
    case "idle":
      return state.lastRequest?.number === number ? state.failureStreak : 0;
    case "loading":
      return state.request.number === number ? state.failureStreak : 0;
    case "settled":
      return 0;
    case "error":
      return state.outcome.request.number === number ? state.outcome.consecutiveFailures : 0;
  }
}

export function lookupReducer(state: LookupState, event: LookupEvent): LookupState {
  switch (event.type) {
    case "submit":
      return {
        phase: "loading",
        request: event.request,
        startedAt: event.at,
        failureStreak: streakFor(state, event.request.number)
      };
    case "succeeded":
      if (state.phase !== "loading") return state; // a late answer after a cancel or a newer submit changes nothing
      return { phase: "settled", outcome: { kind: "success", request: state.request, data: event.data }, settledAt: event.at };
    case "failed":
      if (state.phase !== "loading") return state;
      return {
        phase: "error",
        outcome: { kind: "failure", request: state.request, cause: event.cause, consecutiveFailures: state.failureStreak + 1 },
        settledAt: event.at
      };
    case "cancelled":
      if (state.phase !== "loading") return state;
      return { phase: "idle", lastRequest: state.request, failureStreak: state.failureStreak };
    case "reset":
      return INITIAL_LOOKUP_STATE;
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/lookup-state.spec.ts tests/unit/module-boundaries.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `17 passed` (11 reducer tests + the 6 module-boundary tests; the purity scan now includes `lib/tracking/lookup-state.ts`).
Run: `npm run typecheck; npx eslint lib/tracking/lookup-state.ts tests/unit/lookup-state.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 5: Commit**

```powershell
git add lib/tracking/lookup-state.ts tests/unit/lookup-state.spec.ts
git commit -m "feat: add the lookup state reducer with the failure streak"
```

---

### Task 2: `fetchTrack` — the only `/api/track` caller

**Files:**
- Create: `lib/tracking/fetch-track.ts`
- Test: `tests/unit/fetch-track.spec.ts`

**Interfaces:**
- Consumes: `FailureInput`, `LookupRequest` (S03 types); `ApiTrackResponseSchema` (`lib/schemas.ts`, frozen) through a dynamic `import()`; test-only `classifyFailure` (S03), `FAILURE_RESPONSES`, `FAKE`, `successBody`, `trackData`, `type FailureFixture` (S01).
- Produces (contract §11.8): `type FetchTrackResult = { kind: "success"; data } | { kind: "failure"; input: FailureInput } | { kind: "aborted" }`, `fetchTrack(request: LookupRequest, options: { signal: AbortSignal; timeoutMs: number }): Promise<FetchTrackResult>`. Mapping: any body that is not JSON → `{ kind: "http", status, code: null, isJson: false }`; a JSON non-2xx → `{ kind: "http", status, code: error.code | null, isJson: true }`; a 2xx whose body fails `ApiTrackResponseSchema` (or is `success: false`) → `{ kind: "contract" }`; a rejected fetch → `{ kind: "network", online: navigator.onLine !== false }`; our timer → `{ kind: "timeout" }`; the caller's signal → `{ kind: "aborted" }`. Server `message` text is never read.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/fetch-track.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
// Loads the schema module into the Node test runner's CommonJS cache so fetchTrack's dynamic import("@/lib/schemas") resolves here;
// Next.js code-splits the same import in the browser bundle.
import { ApiTrackResponseSchema } from "@/lib/schemas";
import { classifyFailure } from "@/lib/tracking/classify-failure";
import { fetchTrack } from "@/lib/tracking/fetch-track";
import type { FetchTrackResult } from "@/lib/tracking/fetch-track";
import type { FailureCause, LookupRequest } from "@/lib/tracking/types";
import { FAILURE_RESPONSES, FAKE, successBody, trackData } from "../fixtures/tracking-fixtures";
import type { FailureFixture } from "../fixtures/tracking-fixtures";

const REQUEST: LookupRequest = { number: FAKE.domestic, carrier: "HANJIN", entry: "manual" };
const LONG_TIMEOUT_MS = 5_000;
const SHORT_TIMEOUT_MS = 30;

interface SeenCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
}
type FetchStub = (input: unknown, init?: RequestInit) => Promise<Response>;

let calls: SeenCall[] = [];
const realFetch: unknown = Reflect.get(globalThis, "fetch");
const realNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

function setFetch(stub: FetchStub): void {
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: (input: unknown, init?: RequestInit): Promise<Response> => {
      calls.push({ url: String(input), init });
      return stub(input, init);
    }
  });
}

function answer(reply: { readonly status: number; readonly contentType: string; readonly body: string }): void {
  setFetch(async () => new Response(reply.body, { status: reply.status, headers: { "content-type": reply.contentType } }));
}

/** A server that never answers: the request ends only when its signal aborts, like a real fetch. */
function hang(): void {
  setFetch(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("The operation was aborted.", "AbortError")));
      })
  );
}

function setOnline(online: boolean): void {
  Object.defineProperty(globalThis, "navigator", { configurable: true, get: () => ({ onLine: online }) });
}

function run(timeoutMs = LONG_TIMEOUT_MS, signal: AbortSignal = new AbortController().signal): Promise<FetchTrackResult> {
  return fetchTrack(REQUEST, { signal, timeoutMs });
}

function inputOf(result: FetchTrackResult): Extract<FetchTrackResult, { kind: "failure" }>["input"] {
  if (result.kind !== "failure") throw new Error(`expected a failure, got ${result.kind}`);
  return result.input;
}

test.beforeEach(() => {
  calls = [];
});

test.afterEach(() => {
  Object.defineProperty(globalThis, "fetch", { configurable: true, writable: true, value: realFetch });
  if (realNavigator) Object.defineProperty(globalThis, "navigator", realNavigator);
  else Reflect.deleteProperty(globalThis, "navigator");
});

test("posts the number and the carrier to /api/track and returns the parsed data", async () => {
  const data = trackData("inTransit");
  answer({ status: 200, contentType: "application/json", body: successBody(data) });
  expect(await run()).toEqual({ kind: "success", data });
  expect(ApiTrackResponseSchema.safeParse(JSON.parse(successBody(data))).success).toBe(true);
  expect(calls).toHaveLength(1);
  expect(calls[0]?.url).toBe("/api/track");
  expect(calls[0]?.init?.method).toBe("POST");
  expect(calls[0]?.init?.cache).toBe("no-store");
  expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ trackingNumber: FAKE.domestic, carrierCode: "HANJIN" });
});

const EXPECTED: Readonly<Record<FailureFixture, { readonly result: FetchTrackResult; readonly cause: FailureCause }>> = {
  invalid400: { result: { kind: "failure", input: { kind: "http", status: 400, code: "INVALID_NUMBER", isJson: true } }, cause: "invalidNumber" },
  notFound404: { result: { kind: "failure", input: { kind: "http", status: 404, code: "NOT_FOUND", isJson: true } }, cause: "notFound" },
  rateLimited429: { result: { kind: "failure", input: { kind: "http", status: 429, code: "RATE_LIMITED", isJson: true } }, cause: "rateLimited" },
  upstreamTimeout504: { result: { kind: "failure", input: { kind: "http", status: 504, code: "API_TIMEOUT", isJson: true } }, cause: "upstreamTimeout" },
  unavailable503: { result: { kind: "failure", input: { kind: "http", status: 503, code: "API_TIMEOUT", isJson: true } }, cause: "upstreamTimeout" },
  serverError500: { result: { kind: "failure", input: { kind: "http", status: 500, code: "SERVER_ERROR", isJson: true } }, cause: "serverError" },
  badGatewayHtml502: { result: { kind: "failure", input: { kind: "http", status: 502, code: null, isJson: false } }, cause: "badGateway" },
  contractViolation200: { result: { kind: "failure", input: { kind: "contract" } }, cause: "contractViolation" }
};

for (const name of Object.keys(EXPECTED) as FailureFixture[]) {
  test(`${name}: mapped to what the client observed, never to the server message`, async () => {
    answer(FAILURE_RESPONSES[name]);
    const result = await run();
    expect(result).toEqual(EXPECTED[name].result);
    expect(classifyFailure(inputOf(result))).toBe(EXPECTED[name].cause);
    expect(JSON.stringify(result)).not.toContain("message");
  });
}

test("a JSON error body is read as JSON even with a wrong content type", async () => {
  answer({ ...FAILURE_RESPONSES.notFound404, contentType: "text/plain" });
  expect(await run()).toEqual({ kind: "failure", input: { kind: "http", status: 404, code: "NOT_FOUND", isJson: true } });
});

test("a 200 HTML page is not JSON and reads as a temporary gateway problem", async () => {
  answer({ status: 200, contentType: "text/html", body: "<html><body>maintenance</body></html>" });
  const input = inputOf(await run());
  expect(input).toEqual({ kind: "http", status: 200, code: null, isJson: false });
  expect(classifyFailure(input)).toBe("badGateway");
});

test("an empty body is not JSON", async () => {
  answer({ status: 503, contentType: "application/json", body: "" });
  expect(inputOf(await run())).toEqual({ kind: "http", status: 503, code: null, isJson: false });
});

test("a failed request reads as network while online and as offline while offline", async () => {
  setFetch(async () => {
    throw new TypeError("Failed to fetch");
  });
  setOnline(true);
  const online = inputOf(await run());
  expect(online).toEqual({ kind: "network", online: true });
  expect(classifyFailure(online)).toBe("network");
  setOnline(false);
  const offline = inputOf(await run());
  expect(offline).toEqual({ kind: "network", online: false });
  expect(classifyFailure(offline)).toBe("offline");
});

test("our timeout stops the request and reports a timeout", async () => {
  hang();
  const started = Date.now();
  const input = inputOf(await run(SHORT_TIMEOUT_MS));
  expect(input).toEqual({ kind: "timeout" });
  expect(classifyFailure(input)).toBe("clientTimeout");
  expect(Date.now() - started).toBeLessThan(LONG_TIMEOUT_MS);
  expect(calls[0]?.init?.signal?.aborted).toBe(true);
});

test("the caller's abort ends the request as aborted, not as a failure", async () => {
  hang();
  const controller = new AbortController();
  const pending = run(LONG_TIMEOUT_MS, controller.signal);
  setTimeout(() => controller.abort(), 10);
  expect(await pending).toEqual({ kind: "aborted" });
});

test("an already aborted signal never calls the server", async () => {
  answer({ status: 200, contentType: "application/json", body: successBody(trackData("pending")) });
  const controller = new AbortController();
  controller.abort();
  expect(await run(LONG_TIMEOUT_MS, controller.signal)).toEqual({ kind: "aborted" });
  expect(calls).toEqual([]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/fetch-track.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading — `Error: Cannot find module '@/lib/tracking/fetch-track'` (0 tests run).

- [ ] **Step 3: Write the fetcher**

Create `lib/tracking/fetch-track.ts`:

```ts
import type { FailureInput, LookupRequest } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

// Browser module (contract §11.2): the only client code that calls /api/track. The response schema (zod) loads with a dynamic import on
// the first 2xx body, so the initial bundle never contains it (contract §11.1 rule 3). Server `message` text is never read (spec §5).

export type FetchTrackResult =
  | { readonly kind: "success"; readonly data: TrackResponseData }
  | { readonly kind: "failure"; readonly input: FailureInput }
  | { readonly kind: "aborted" }; // caller aborted (cancel or superseded)

const TRACK_ENDPOINT = "/api/track";

type StopReason = "caller" | "timeout";
type ParsedBody = { readonly ok: true; readonly value: unknown } | { readonly ok: false };

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function parseJson(text: string): ParsedBody {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false }; // HTML error pages and empty bodies are "not JSON", never a crash
  }
}

/** `error.code` of a JSON error body (`{ success: false, error: { code } }`); null for any other shape. */
function errorCodeOf(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("error" in value)) return null;
  const error: unknown = value.error;
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

async function readBody(status: number, ok: boolean, text: string): Promise<FetchTrackResult> {
  const body = parseJson(text);
  if (!body.ok) return { kind: "failure", input: { kind: "http", status, code: null, isJson: false } };
  if (!ok) return { kind: "failure", input: { kind: "http", status, code: errorCodeOf(body.value), isJson: true } };
  const { ApiTrackResponseSchema } = await import("@/lib/schemas");
  const parsed = ApiTrackResponseSchema.safeParse(body.value);
  if (parsed.success && parsed.data.success) return { kind: "success", data: parsed.data.data };
  return { kind: "failure", input: { kind: "contract" } };
}

export async function fetchTrack(
  request: LookupRequest,
  options: { readonly signal: AbortSignal; readonly timeoutMs: number }
): Promise<FetchTrackResult> {
  if (options.signal.aborted) return { kind: "aborted" };
  const controller = new AbortController();
  let stopped: StopReason | null = null;
  const stop = (reason: StopReason): void => {
    if (stopped !== null) return;
    stopped = reason;
    controller.abort();
  };
  const onCallerAbort = (): void => stop("caller");
  options.signal.addEventListener("abort", onCallerAbort, { once: true });
  const timer = setTimeout(() => stop("timeout"), options.timeoutMs);
  const interrupted = (): FetchTrackResult | null => {
    if (stopped === "caller") return { kind: "aborted" };
    if (stopped === "timeout") return { kind: "failure", input: { kind: "timeout" } };
    return null;
  };

  try {
    const response = await fetch(TRACK_ENDPOINT, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trackingNumber: request.number, carrierCode: request.carrier }),
      signal: controller.signal
    });
    const text = await response.text();
    const result = interrupted() ?? (await readBody(response.status, response.ok, text));
    return interrupted() ?? result;
  } catch {
    // A TypeError on network loss, an AbortError when stopped, or a failed chunk load of the schema all land here.
    return interrupted() ?? { kind: "failure", input: { kind: "network", online: isOnline() } };
  } finally {
    clearTimeout(timer);
    options.signal.removeEventListener("abort", onCallerAbort);
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/fetch-track.spec.ts tests/unit/module-boundaries.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `22 passed` (16 fetch tests + 6 module-boundary tests; `fetch-track.ts` is the purity scan's one exception and reaches `lib/schemas.ts` only through `import()`).
Run: `npm run typecheck; npx eslint lib/tracking/fetch-track.ts tests/unit/fetch-track.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 5: Commit**

```powershell
git add lib/tracking/fetch-track.ts tests/unit/fetch-track.spec.ts
git commit -m "feat: add fetchTrack with timeout, abort and failure mapping"
```

---

### Task 3: The status view — `deriveTrackingView` plus the approval fallbacks

**Files:**
- Create: `components/status-slot/status-view.ts`
- Test: `tests/unit/status-view.spec.ts`

**Interfaces:**
- Consumes: `deriveTrackingView(outcome, now, config)` (S03), `siteConfig`, `resultCopy` (`config/site.config.ts`, S03), `fillSlots` (`lib/tracking/template.ts`, S03), types `ActionView`, `EtaView`, `GuideKey`, `LookupOutcome`, `TrackingViewModel`; test-only `tests/fixtures/derive-scenarios.ts` (S03: `success`, `failure`, `customsWaitingData`, `pickedUpData`, `inTransitData`, `deliveredData`, `staleData`, `pendingData`, `OCTOBER_NOW`, `PICKUP_NOW`), `FIXTURE_NOW` (S01).
- Produces (S04-private, addition 3): `interface StatusSlotApprovals { approval2: boolean; approval3: boolean }`, `STATUS_SLOT_APPROVALS` (`{ approval2: false, approval3: false }` until Tasks 9/10), `LEGACY_RESULT_COPY`, `applyApprovalFallbacks(view: TrackingViewModel, approvals: StatusSlotApprovals): TrackingViewModel` (returns the same object when both approvals are granted), `deriveStatusView(outcome: LookupOutcome, now: Date): TrackingViewModel` — the exact view the customer page renders; every S04 E2E computes its expectations with it.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/status-view.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import {
  LEGACY_RESULT_COPY,
  STATUS_SLOT_APPROVALS,
  applyApprovalFallbacks,
  deriveStatusView
} from "@/components/status-slot/status-view";
import { siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import type { EtaView, LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";
import {
  OCTOBER_NOW,
  PICKUP_NOW,
  customsWaitingData,
  deliveredData,
  failure,
  inTransitData,
  pendingData,
  pickedUpData,
  staleData,
  success
} from "../fixtures/derive-scenarios";
import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";

const BOTH_PENDING = { approval2: false, approval3: false } as const;
const BOTH_APPROVED = { approval2: true, approval3: true } as const;
const ONLY_APPROVAL_2 = { approval2: true, approval3: false } as const;
const ONLY_APPROVAL_3 = { approval2: false, approval3: true } as const;

const base = (outcome: LookupOutcome, now: Date = FIXTURE_NOW): TrackingViewModel => deriveTrackingView(outcome, now, siteConfig);
const captionOf = (eta: EtaView): string | null =>
  eta.kind === "date" || eta.kind === "today" || eta.kind === "holidayAffected" ? eta.caption : null;

// The two ledger rows mirror roadmap §4; Task 10 (approval 2) and Task 9 (approval 3) flip them one at a time.
test("ledger: approval 2 is pending (roadmap §4)", () => {
  expect(STATUS_SLOT_APPROVALS.approval2).toBe(BOTH_PENDING.approval2);
});

test("ledger: approval 3 is pending (roadmap §4)", () => {
  expect(STATUS_SLOT_APPROVALS.approval3).toBe(BOTH_PENDING.approval3);
});

test("with both approvals the view passes through untouched", () => {
  for (const outcome of [success(customsWaitingData()), failure("notFound"), failure("clientTimeout")]) {
    const view = base(outcome);
    expect(applyApprovalFallbacks(view, BOTH_APPROVED)).toBe(view);
  }
});

test("deriveStatusView is deriveTrackingView plus the ledger's fallbacks", () => {
  const outcome = success(customsWaitingData());
  expect(deriveStatusView(outcome, FIXTURE_NOW)).toEqual(applyApprovalFallbacks(base(outcome), STATUS_SLOT_APPROVALS));
});

test.describe("approval 3 pending: 톡톡 is the filled primary on error screens", () => {
  test("NOT_FOUND: 톡톡 leads and [번호 수정] becomes a secondary", () => {
    const view = applyApprovalFallbacks(base(failure("notFound")), ONLY_APPROVAL_2);
    expect(view.nextAction.primary).toEqual({
      kind: "talk",
      label: siteConfig.channels.talk.labels.cta,
      weight: "primary",
      href: siteConfig.channels.talk.url,
      external: true,
      cooldownSeconds: null
    });
    const extra = siteConfig.lookup.notFoundServiceCaveat ? "copyReturnLink" : "retry";
    expect(view.nextAction.secondary.map((action) => [action.kind, action.weight])).toEqual([
      ["fixNumber", "secondary"],
      [extra, "text"]
    ]);
    expect(view.inquiryCopy).toBeNull();
  });

  test("client timeout: [다시 조회] and [번호 수정] are both secondary", () => {
    const view = applyApprovalFallbacks(base(failure("clientTimeout")), ONLY_APPROVAL_2);
    expect(view.nextAction.primary?.kind).toBe("talk");
    expect(view.nextAction.secondary.map((action) => [action.kind, action.weight])).toEqual([
      ["retry", "secondary"],
      ["fixNumber", "secondary"]
    ]);
  });

  test("429 keeps the countdown on the demoted [다시 조회]", () => {
    const view = applyApprovalFallbacks(base(failure("rateLimited")), ONLY_APPROVAL_2);
    expect(view.nextAction.secondary[0]).toMatchObject({
      kind: "retry",
      weight: "secondary",
      cooldownSeconds: siteConfig.lookup.rateLimitCooldownSeconds
    });
  });

  test("server errors and a second failure in a row keep copy-and-talk", () => {
    for (const outcome of [failure("serverError"), failure("network", { consecutiveFailures: 2 })]) {
      const view = base(outcome);
      expect(applyApprovalFallbacks(view, ONLY_APPROVAL_2)).toBe(view);
    }
  });

  test("result views are never touched by the approval-3 fallback", () => {
    const view = base(success(inTransitData()), OCTOBER_NOW);
    expect(applyApprovalFallbacks(view, ONLY_APPROVAL_2)).toBe(view);
  });
});

test.describe("approval 2 pending: the tested result wording stays", () => {
  const legacy = (outcome: LookupOutcome, now: Date = FIXTURE_NOW): TrackingViewModel =>
    applyApprovalFallbacks(base(outcome, now), ONLY_APPROVAL_3);

  test("customs waiting: '통관대기', the pre-renewal sentence, the estimate label and caption", () => {
    const original = base(success(customsWaitingData()));
    const view = legacy(success(customsWaitingData()));
    expect(view.title).toBe(LEGACY_RESULT_COPY.customsWaitingTitle);
    expect(view.nextAction.sentence).toBe(LEGACY_RESULT_COPY.sentences.customsWaiting);
    if (view.eta.kind !== "date" && view.eta.kind !== "holidayAffected") throw new Error(`unexpected ETA kind ${view.eta.kind}`);
    expect(view.eta.label).toBe(LEGACY_RESULT_COPY.etaLabel);
    expect(captionOf(view.eta)).toMatch(/^통관완료 예상일 /);
    expect(view.liveMessage).toBe(`${LEGACY_RESULT_COPY.customsWaitingTitle} · ${LEGACY_RESULT_COPY.etaLabel} ${view.eta.date.label}`);
    expect([view.guideKey, view.ctaState, view.tone, view.revenue, view.nextAction.worry]).toEqual([
      original.guideKey,
      original.ctaState,
      original.tone,
      original.revenue,
      original.nextAction.worry
    ]);
  });

  test("picked up: the pre-renewal reason with the carrier and the pickup sentence", () => {
    const view = legacy(success(pickedUpData()), PICKUP_NOW);
    expect(view.title).toBe("CJ대한통운 기사님 픽업 완료!");
    expect(view.reason).toBe("CJ대한통운 기사님이 상품을 인수해 배송 출발을 준비하고 있습니다.");
    expect(view.nextAction.sentence).toBe(LEGACY_RESULT_COPY.sentences.pickedUp);
    expect(captionOf(view.eta) ?? "").toMatch(/^통관 완료일 /);
  });

  test("in transit and delivered: the pre-renewal next-action sentences", () => {
    const transit = legacy(success(inTransitData()), OCTOBER_NOW);
    expect(transit.nextAction.sentence).toBe(LEGACY_RESULT_COPY.sentences.inTransit);
    expect(transit.eta.kind === "today" ? transit.eta.label : transit.eta.kind).toBe(siteConfig.resultCopy.etaTodayLabel);
    const delivered = legacy(success(deliveredData()));
    expect(delivered.nextAction.sentence).toBe(LEGACY_RESULT_COPY.sentences.delivered);
    expect(delivered.eta).toEqual(base(success(deliveredData())).eta);
  });

  test("stale: the verification wording instead of an estimate", () => {
    const view = legacy(success(staleData()));
    expect(view.guideKey).toBe("stale");
    expect(view.eta).toEqual({ kind: "withheld", label: LEGACY_RESULT_COPY.etaLabel, text: LEGACY_RESULT_COPY.staleEtaText });
    expect(view.nextAction.sentence).toContain("마지막 처리 이후 오래 지났습니다");
    expect(view.nextAction.primary?.kind).toBe("copyAndTalk");
  });

  test("pending, overdue and error views keep their own copy", () => {
    const rows: ReadonlyArray<readonly [LookupOutcome, Date]> = [
      [success(pendingData()), FIXTURE_NOW],
      [success(customsWaitingData()), new Date("2026-09-29T00:00:00+09:00")],
      [failure("notFound"), FIXTURE_NOW]
    ];
    for (const [outcome, now] of rows) {
      const view = base(outcome, now);
      expect(applyApprovalFallbacks(view, ONLY_APPROVAL_3)).toEqual(view);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/status-view.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading — `Error: Cannot find module '@/components/status-slot/status-view'`.

- [ ] **Step 3: Write the status view module**

Create `components/status-slot/status-view.ts`:

```ts
import { resultCopy, siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import { fillSlots } from "@/lib/tracking/template";
import type { ActionView, EtaView, GuideKey, LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";

// Transitional (S04; deleted by S07 with components/status-slot/). The customer page renders exactly deriveStatusView(); the internal
// CS helper keeps deriveTrackingView() so CS replies use the spec copy.

/** Roadmap §4 ledger values this slot needs. The S04 plan's Task 9 (approval 3) and Task 10 (approval 2) flip them. */
export interface StatusSlotApprovals {
  /** 승인 2: copy-bound E2E assertions may change. Until then the tested result sentences stay as they were. */
  readonly approval2: boolean;
  /** 승인 3: the recovery action leads error screens. Until then 톡톡 is the filled primary and [번호 수정]/[다시 조회] are secondary. */
  readonly approval3: boolean;
}

export const STATUS_SLOT_APPROVALS: StatusSlotApprovals = { approval2: false, approval3: false };

/** The pre-renewal result wording that tests/tracking.spec.ts and tests/privacy.spec.ts assert (roadmap §4, "S04 fallback"). */
export const LEGACY_RESULT_COPY = {
  etaLabel: "배송 완료 예상일",
  customsEstimateCaption: "통관완료 예상일 {date}",
  customsDoneCaption: "통관 완료일 {date}",
  staleEtaText: "배송 이력 확인 필요",
  customsWaitingTitle: "통관대기",
  pickedUpReason: "{carrier} 기사님이 상품을 인수해 배송 출발을 준비하고 있습니다.",
  sentences: {
    customsWaiting: "정상 통관 대기 상태입니다. 지금은 별도 문의 없이 조금만 기다려 주세요.",
    pickedUp: "픽업이 완료됐습니다. 배송 이동이 시작되면 현재 위치가 업데이트됩니다.",
    inTransit: "배송 중입니다. 문자로 안내된 배송 예정 시간을 확인해 주세요.",
    delivered: "배송이 완료됐습니다. 상품 상태를 확인해 주세요.",
    stale: "마지막 처리 이후 오래 지났습니다. 문의 내용을 복사해 톡톡으로 보내 주세요."
  }
} as const;

type LegacySentenceKey = keyof typeof LEGACY_RESULT_COPY.sentences;

const RECOVERY_KINDS: ReadonlySet<ActionView["kind"]> = new Set<ActionView["kind"]>(["fixNumber", "retry"]);

function isLegacySentenceKey(key: GuideKey): key is LegacySentenceKey {
  return key in LEGACY_RESULT_COPY.sentences;
}

/** '통관 완료 예상 ' from '통관 완료 예상 {date}': the part of a caption template before the date. */
function captionPrefix(template: string): string {
  return template.split("{date}")[0] ?? template;
}

function legacyCaption(caption: string | null): string | null {
  if (caption === null) return null;
  const estimate = captionPrefix(resultCopy.customsEstimateCaption);
  const done = captionPrefix(resultCopy.customsDoneCaption);
  if (caption.startsWith(estimate)) return fillSlots(LEGACY_RESULT_COPY.customsEstimateCaption, { date: caption.slice(estimate.length) });
  if (caption.startsWith(done)) return fillSlots(LEGACY_RESULT_COPY.customsDoneCaption, { date: caption.slice(done.length) });
  return caption;
}

function legacyEta(eta: EtaView, key: GuideKey): EtaView {
  switch (eta.kind) {
    case "date":
    case "holidayAffected":
      return { ...eta, label: LEGACY_RESULT_COPY.etaLabel, caption: legacyCaption(eta.caption) };
    case "today":
      return { ...eta, caption: legacyCaption(eta.caption) }; // '오늘 예상' was the pre-renewal badge too
    case "unknown":
      return { ...eta, label: LEGACY_RESULT_COPY.etaLabel };
    case "withheld":
      return key === "stale" ? { ...eta, label: LEGACY_RESULT_COPY.etaLabel, text: LEGACY_RESULT_COPY.staleEtaText } : eta;
    case "none":
    case "pendingInfo":
    case "overdue":
    case "deliveredOn":
      return eta;
  }
}

/** Same sentence shape as deriveTrackingView's live message: the status title plus the ETA line. */
function liveMessageFor(title: string, eta: EtaView): string {
  switch (eta.kind) {
    case "none":
      return title;
    case "pendingInfo":
    case "withheld":
    case "unknown":
      return `${title} · ${eta.label} ${eta.text}`;
    default:
      return `${title} · ${eta.label} ${eta.date.label}`;
  }
}

function withLegacyCopy(view: TrackingViewModel): TrackingViewModel {
  if (view.mode !== "settled" || view.overdue) return view;
  const key = view.guideKey;
  const carrier = view.carrier.name ?? resultCopy.carrierUnknown;
  const title = key === "customsWaiting" ? LEGACY_RESULT_COPY.customsWaitingTitle : view.title;
  const reason = key === "pickedUp" ? fillSlots(LEGACY_RESULT_COPY.pickedUpReason, { carrier }) : view.reason;
  const sentence = isLegacySentenceKey(key) ? LEGACY_RESULT_COPY.sentences[key] : view.nextAction.sentence;
  const eta = legacyEta(view.eta, key);
  const liveMessage = title === view.title && eta === view.eta ? view.liveMessage : liveMessageFor(title, eta);
  return { ...view, title, reason, eta, liveMessage, nextAction: { ...view.nextAction, sentence } };
}

/** Approval-3 fallback (spec §16 item 3 "거절하면"): 톡톡 becomes the filled primary; the recovery action moves to the secondaries. */
function withTalkFirst(view: TrackingViewModel): TrackingViewModel {
  const { primary, secondary } = view.nextAction;
  if (view.mode !== "error" || primary === null || !RECOVERY_KINDS.has(primary.kind)) return view;
  const talk = secondary.find((action) => action.kind === "talk");
  if (talk === undefined) return view;
  return {
    ...view,
    nextAction: {
      ...view.nextAction,
      primary: { ...talk, weight: "primary" },
      secondary: [{ ...primary, weight: "secondary" }, ...secondary.filter((action) => action !== talk)]
    }
  };
}

export function applyApprovalFallbacks(view: TrackingViewModel, approvals: StatusSlotApprovals): TrackingViewModel {
  const talkFirst = approvals.approval3 ? view : withTalkFirst(view);
  return approvals.approval2 ? talkFirst : withLegacyCopy(talkFirst);
}

/** The view the R2 page renders for a settled lookup; `now` is the client's clock when the result settled (spec §6 overdue). */
export function deriveStatusView(outcome: LookupOutcome, now: Date): TrackingViewModel {
  return applyApprovalFallbacks(deriveTrackingView(outcome, now, siteConfig), STATUS_SLOT_APPROVALS);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/status-view.spec.ts tests/unit/derive-view.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `14 passed` for `status-view.spec.ts`, and `derive-view.spec.ts` unchanged at its S03 count (62 without S03's gated tasks) — S04 never edits `config/site.config.ts`.
Run: `npm run typecheck; npx eslint components/status-slot/status-view.ts tests/unit/status-view.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 5: Commit**

```powershell
git add components/status-slot/status-view.ts tests/unit/status-view.spec.ts
git commit -m "feat: add the status view with the approval-2 and approval-3 fallbacks"
```

---

### Task 4: One live region, the lookup hook and the loading card on the current page

**Files:**
- Create: `components/primitives/LiveAnnouncer.tsx`, `components/lookup/useLookup.ts`, `components/status-slot/LoadingTimeline.tsx`, `components/status-slot/StatusSlot.tsx`
- Create: `tests/support/status-slot.ts`
- Rewrite: `components/TrackingForm.tsx` (whole file), `components/HomePageClient.tsx` (whole file)
- Delete: `components/LoadingSpinner.tsx`, `components/ErrorMessage.tsx`, `components/ui/skeleton.tsx`, `components/ui/alert.tsx`
- Test: `tests/e2e/loading-timeline.spec.ts`

**Interfaces:**
- Consumes: `fetchTrack` (Task 2), `lookupReducer`, `INITIAL_LOOKUP_STATE`, `lastRequestOf`, `LookupState`, `LookupEvent` (Task 1), `deriveStatusView` (Task 3), `deriveLoadingView`, `nextLoadingChangeMs`, `classifyFailure` (S03), `lookup`, `notices` (`config/site.config.ts`), `LoadingConfig` (`lib/config/types.ts`); S02's `scrubNumberFromUrl`, `SCRUB_TIMEOUT_MS`, `saveRestoreEntry`, `readRestoreEntry`, `currentNavigationKind`, `RestoreEntry`, `setAdSignals`, `ReturnLinkButton`; test-only `holdTrack`-style route control (new support file), `carrierOfficialUrl`, `fillSlots` (S03), `FAKE`, `FAKE_GROUPED`, `FIXTURE_NOW`, `trackData`, `FAILURE_RESPONSES`, `successBody` (S01).
- Produces (contract §11.9): `LiveAnnouncerProvider(props: { children: React.ReactNode }): React.JSX.Element` (renders `<div data-live-region="polite" role="status" aria-live="polite" aria-atomic="true" className="sr-only">`), `useAnnounce(): (message: string) => void`; `interface UseLookupOptions { config: LoadingConfig; onSettled?: (outcome: LookupOutcome, now: Date) => void }`, `interface UseLookupResult { state; loading; submit; retry; cancel; reset }`, `useLookup(options: UseLookupOptions): UseLookupResult`; `interface StatusSlotProps { state; loading; view; onAction; headingRef }`, `StatusSlot(props): React.JSX.Element | null` (this task: the loading card; Tasks 5–6 add errors and results); `LoadingTimeline(props: { loading: LoadingViewModel; onCancel: () => void }): React.JSX.Element` (root `data-loading-stage`); S04-private `TrackingForm` (controlled) and `INVALID_NUMBER_ERROR_ID = "tracking-invalid-error"`; test support `INPUT_LABEL`, `CARRIER_LABEL`, `PAUSE_OFFSET_MS`, `PAUSED_NOW`, `APP_LIVE_REGIONS`, `statusSlot`, `liveRegion`, `submitButton`, `blockThirdParty`, `lookUp`, `openPaused`, `manualRequest`, `holdTrack` → `HeldTrack { bodies(); waitForRequests(count); release(index, response) }`.
- Behavior: settled results still render through the legacy result section and errors through the legacy error CTA block until Tasks 5–6 (blocks marked `S04-BRIDGE`), but the view is already derived on every settle (live region, focus target).

- [ ] **Step 1: Write the E2E support helpers**

Create `tests/support/status-slot.ts`:

```ts
import type { Locator, Page, Route } from "@playwright/test";
import type { LookupRequest } from "@/lib/tracking/types";
import type { DeliveryCarrierCode, TrackResponseData } from "@/lib/types";
import { FAILURE_RESPONSES, FIXTURE_NOW, successBody } from "../fixtures/tracking-fixtures";
import type { FailureFixture } from "../fixtures/tracking-fixtures";

/** Helpers for the S04 status-slot E2E (S07 rewrites these specs for the R3 DOM and deletes this file). */

export const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";
export const CARRIER_LABEL = "국내 택배사";
/** Fake time pauses this long after FIXTURE_NOW: later than any dev-server compile that ran on the still-flowing fake clock. */
export const PAUSE_OFFSET_MS = 120_000;
export const PAUSED_NOW = new Date(FIXTURE_NOW.getTime() + PAUSE_OFFSET_MS);
/** Live regions the application renders. Next.js adds its own route announcer (shadow DOM, id below) for route changes only. */
export const APP_LIVE_REGIONS = "[aria-live]:not(#__next-route-announcer__)";

export const statusSlot = (page: Page): Locator => page.locator("#tracking-panel [data-status-slot]");
export const liveRegion = (page: Page): Locator => page.locator('[data-live-region="polite"]');
export const submitButton = (page: Page): Locator => page.locator('#tracking-panel form button[type="submit"]');

export function manualRequest(number: string, carrier: DeliveryCarrierCode = "AUTO"): LookupRequest {
  return { number, carrier, entry: "manual" };
}

/** Aborts every request that leaves the local server, in every page of the context (AdSense, 톡톡 and store tabs). */
export async function blockThirdParty(page: Page): Promise<void> {
  await page.context().route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
}

export async function lookUp(page: Page, number: string, carrier?: DeliveryCarrierCode): Promise<void> {
  if (carrier !== undefined) await page.getByRole("combobox", { name: CARRIER_LABEL }).selectOption(carrier);
  await page.getByLabel(INPUT_LABEL, { exact: true }).fill(number);
  await submitButton(page).click();
}

/** Installs the page clock at FIXTURE_NOW, opens `path`, then pauses time so only page.clock.runFor moves clocks and timers. */
export async function openPaused(page: Page, path = "/"): Promise<void> {
  await page.clock.install({ time: FIXTURE_NOW });
  await page.goto(path);
  await page.getByLabel(INPUT_LABEL, { exact: true }).waitFor();
  await page.clock.pauseAt(PAUSED_NOW);
}

interface HeldRequest {
  readonly route: Route;
  readonly body: unknown;
}

export interface HeldTrack {
  readonly bodies: () => readonly unknown[];
  readonly waitForRequests: (count: number) => Promise<void>;
  readonly release: (index: number, response: TrackResponseData | FailureFixture) => Promise<void>;
}

/** Holds every POST /api/track until the test releases it with a canned answer (other methods fall through). */
export async function holdTrack(page: Page): Promise<HeldTrack> {
  const held: HeldRequest[] = [];
  const waiters: Array<{ readonly count: number; readonly resolve: () => void }> = [];
  await page.route("**/api/track", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    const body: unknown = route.request().postDataJSON();
    held.push({ route, body });
    for (const waiter of waiters) if (held.length >= waiter.count) waiter.resolve();
  });
  return {
    bodies: () => held.map((item) => item.body),
    waitForRequests: (count) =>
      held.length >= count ? Promise.resolve() : new Promise<void>((resolve) => waiters.push({ count, resolve })),
    release: async (index, response) => {
      const item = held[index];
      if (item === undefined) throw new Error(`no held /api/track request #${index}`);
      const reply =
        typeof response === "string"
          ? FAILURE_RESPONSES[response]
          : { status: 200, contentType: "application/json", body: successBody(response) };
      try {
        await item.route.fulfill(reply);
      } catch (error) {
        // The page aborted this request (cancel or a newer submit): answering it is expected to fail.
        const abandoned =
          item.route.request().failure() !== null || (error instanceof Error && /closed|disposed|handled|abort/i.test(error.message));
        if (!abandoned) throw error;
      }
    }
  };
}
```

- [ ] **Step 2: Write the failing E2E test**

Create `tests/e2e/loading-timeline.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { lookup } from "@/config/site.config";
import { carrierOfficialUrl } from "@/lib/tracking/carriers";
import { fillSlots } from "@/lib/tracking/template";
import { FAKE, FAKE_GROUPED, trackData } from "../fixtures/tracking-fixtures";
import {
  APP_LIVE_REGIONS,
  CARRIER_LABEL,
  INPUT_LABEL,
  blockThirdParty,
  holdTrack,
  liveRegion,
  lookUp,
  openPaused,
  statusSlot,
  submitButton
} from "../support/status-slot";

const [LONG_WAIT_MS, VERY_LONG_WAIT_MS] = lookup.stageMs;
/** GAP2-01: a no-result answer took up to 29.19 s before the server fix; after R4 the slow-but-valid case stays inside the timeout. */
const SLOW_VALID_MS = Math.min(29_190, lookup.timeoutMs - 4_000);
/** LiveAnnouncer empties the region first and writes 60 ms later. */
const ANNOUNCE_MS = 100;
/** Negative checks: time for a wrongly applied late answer to render. */
const SETTLE_MS = 500;

const elapsedText = (elapsedMs: number): string => fillSlots(lookup.copy.elapsed, { seconds: String(Math.ceil(elapsedMs / 1000)) });

test.beforeEach(async ({ page }) => {
  await blockThirdParty(page);
});

test("one polite live region is in the server HTML and stays the only one", async ({ page, request }) => {
  const html = await (await request.get("/")).text();
  expect(html.match(/aria-live=/g) ?? []).toHaveLength(1);
  expect(html).toContain('data-live-region="polite"');
  await page.goto("/");
  const regions = page.locator(APP_LIVE_REGIONS);
  await expect(regions).toHaveCount(1);
  await expect(regions).toHaveAttribute("role", "status");
  await expect(regions).toHaveAttribute("aria-atomic", "true");
  await expect(regions).toHaveText("");
});

test("0–0.4 s: only the submit label changes; nothing is disabled and the form says it is busy", async ({ page }) => {
  const held = await holdTrack(page);
  await openPaused(page);
  await lookUp(page, FAKE.domestic);
  await held.waitForRequests(1);
  await expect(submitButton(page)).toHaveText(lookup.copy.submitting);
  await expect(submitButton(page)).toBeEnabled();
  await expect(page.getByLabel(INPUT_LABEL, { exact: true })).toBeEnabled();
  await expect(page.getByRole("combobox", { name: CARRIER_LABEL })).toBeEnabled();
  await expect(page.locator('#tracking-panel form[aria-busy="true"]')).toHaveCount(1);
  await page.clock.runFor(lookup.skeletonDelayMs - 1);
  await expect(statusSlot(page)).toHaveCount(0);
});

test("0.4–3 s: the loading card under the form with the number and a static skeleton; '조회를 시작했어요' is read", async ({ page }) => {
  const held = await holdTrack(page);
  await openPaused(page);
  await lookUp(page, FAKE.domestic);
  await held.waitForRequests(1);
  await page.clock.runFor(lookup.skeletonDelayMs);
  await expect(statusSlot(page)).toHaveAttribute("data-status-slot", "loading");
  const card = statusSlot(page).locator("[data-loading-stage]");
  await expect(card).toHaveAttribute("data-loading-stage", "short");
  await expect(card.getByRole("heading", { level: 2 })).toHaveText(lookup.copy.title);
  await expect(card.getByText(lookup.copy.body)).toBeVisible();
  await expect(card).toContainText(FAKE_GROUPED.domestic);
  await expect(card).toContainText(lookup.copy.carrierAuto);
  await expect(card.locator("[data-loading-skeleton]")).toBeVisible();
  await expect(card.getByRole("button", { name: lookup.copy.cancel })).toHaveCount(0);
  await page.clock.runFor(ANNOUNCE_MS);
  await expect(liveRegion(page)).toHaveText(lookup.copy.started);
  await expect(page.locator(APP_LIVE_REGIONS)).toHaveCount(1);
});

test("3 s, 5 s and 8 s: [조회 취소], the spinner stops, the very-long sentence is read, elapsed time in steps", async ({ page }) => {
  const held = await holdTrack(page);
  await openPaused(page);
  await lookUp(page, FAKE.domestic);
  await held.waitForRequests(1);
  const card = statusSlot(page).locator("[data-loading-stage]");
  const spinner = card.locator("[data-spinner]");

  await page.clock.runFor(LONG_WAIT_MS);
  await expect(card).toHaveAttribute("data-loading-stage", "long");
  await expect(card.getByText(lookup.copy.longWait)).toBeVisible();
  await expect(card.getByText(lookup.copy.longWait)).not.toContainText("번호 문제는 아니에요");
  await expect(card.getByRole("button", { name: lookup.copy.cancel })).toBeVisible();
  await expect(spinner).toHaveAttribute("data-spinner", "on");

  await page.clock.runFor(lookup.spinnerStopMs - LONG_WAIT_MS);
  await expect(spinner).toHaveAttribute("data-spinner", "off");

  await page.clock.runFor(VERY_LONG_WAIT_MS - lookup.spinnerStopMs);
  await expect(card).toHaveAttribute("data-loading-stage", "veryLong");
  await expect(card.getByText(lookup.copy.veryLongWait)).toBeVisible();
  await expect(card.getByText(elapsedText(VERY_LONG_WAIT_MS))).toBeVisible();
  await page.clock.runFor(ANNOUNCE_MS);
  await expect(liveRegion(page)).toHaveText(lookup.copy.veryLongWait);

  await page.clock.runFor(lookup.elapsedStepSeconds * 1000);
  await expect(card.getByText(elapsedText(VERY_LONG_WAIT_MS + lookup.elapsedStepSeconds * 1000))).toBeVisible();
  await expect(spinner).toHaveAttribute("data-spinner", "off");
  await expect(liveRegion(page)).toHaveText(lookup.copy.veryLongWait);
});

test("reduced motion: the spinner never turns", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const held = await holdTrack(page);
  await openPaused(page);
  await lookUp(page, FAKE.domestic);
  await held.waitForRequests(1);
  await page.clock.runFor(lookup.skeletonDelayMs);
  await expect(statusSlot(page).locator("[data-spinner]")).toHaveAttribute("data-spinner", "off");
});

test("a chosen carrier: '택배사 공식 조회로 먼저 보기' appears with the very-long sentence", async ({ page }) => {
  const held = await holdTrack(page);
  await openPaused(page);
  await lookUp(page, FAKE.domestic, "CJ");
  await held.waitForRequests(1);
  expect(held.bodies()).toEqual([{ trackingNumber: FAKE.domestic, carrierCode: "CJ" }]);
  const official = statusSlot(page).getByRole("link", { name: `${lookup.copy.carrierOfficialFirst} 새 창으로 열기` });
  await page.clock.runFor(VERY_LONG_WAIT_MS - 1);
  await expect(official).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(official).toHaveAttribute("href", carrierOfficialUrl("CJ", FAKE.domestic) ?? "");
  await expect(official).toHaveAttribute("target", "_blank");
});

test("[조회 취소] keeps the number, returns to the form and ignores the late answer", async ({ page }) => {
  const held = await holdTrack(page);
  await openPaused(page);
  await lookUp(page, FAKE.domestic);
  await held.waitForRequests(1);
  await page.clock.runFor(LONG_WAIT_MS);
  await statusSlot(page).getByRole("button", { name: lookup.copy.cancel }).click();
  await expect(statusSlot(page)).toHaveCount(0);
  const input = page.getByLabel(INPUT_LABEL, { exact: true });
  await expect(input).toHaveValue(FAKE.domestic);
  await expect(input).toBeFocused();
  await expect(submitButton(page)).toHaveText(lookup.copy.submit);
  await held.release(0, trackData("pending"));
  await page.waitForTimeout(SETTLE_MS);
  await expect(statusSlot(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "통관 정보 등록 전" })).toHaveCount(0);
});

test("a new submit aborts the previous request and ignores its late answer", async ({ page }) => {
  const held = await holdTrack(page);
  await openPaused(page);
  await lookUp(page, FAKE.domestic);
  await held.waitForRequests(1);
  await lookUp(page, FAKE.hbl);
  await held.waitForRequests(2);
  expect(held.bodies()).toEqual([
    { trackingNumber: FAKE.domestic, carrierCode: "AUTO" },
    { trackingNumber: FAKE.hbl, carrierCode: "AUTO" }
  ]);
  await held.release(1, trackData("inTransit"));
  await expect(page.getByRole("heading", { name: "국내 배송 중" })).toBeVisible();
  await held.release(0, trackData("pending"));
  await page.waitForTimeout(SETTLE_MS);
  await expect(page.getByRole("heading", { name: "통관 정보 등록 전" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "국내 배송 중" })).toBeVisible();
});

test("a slow but valid answer (29.19 s before the server fix) still shows its result", async ({ page }) => {
  const held = await holdTrack(page);
  await openPaused(page);
  await lookUp(page, FAKE.domestic);
  await held.waitForRequests(1);
  await page.clock.runFor(SLOW_VALID_MS);
  await expect(statusSlot(page).locator("[data-loading-stage]")).toHaveAttribute("data-loading-stage", "veryLong");
  await held.release(0, trackData("pending"));
  await expect(page.getByRole("heading", { name: "통관 정보 등록 전" })).toBeVisible();
  await expect(page.locator('[data-cta-state="error"]')).toHaveCount(0);
});
```

- [ ] **Step 3: Run it to verify it fails**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/loading-timeline.spec.ts`
Expected: FAIL — `9 failed`. The first test fails at `expect(received).toHaveLength(expected)` (0 live regions in the HTML); the timeline tests fail at `toHaveText("조회 중…")` or at the `[data-status-slot]` / `[data-loading-stage]` locators (element(s) not found); "a new submit aborts…" fails because both requests stay alive and the first answer replaces the second.

- [ ] **Step 4: Write the live region, the hook, the loading card and the slot**

Create `components/primitives/LiveAnnouncer.tsx`:

```tsx
"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

// The page's one polite live region (spec §5, §12; contract §11.9). It is part of the server HTML, so it exists before any announcement.
// Only this component renders aria-live; primitives never do (S05). Error sentences use role="alert" in place instead.

type Announce = (message: string) => void;

/** The region is emptied first and written this much later, so the same sentence twice is read twice. */
const WRITE_AFTER_CLEAR_MS = 60;
const noAnnounce: Announce = () => undefined;

const AnnounceContext = createContext<Announce>(noAnnounce);

export function LiveAnnouncerProvider({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  const [message, setMessage] = useState("");
  const timerRef = useRef<number | null>(null);

  const announce = useCallback<Announce>((next) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setMessage("");
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setMessage(next);
    }, WRITE_AFTER_CLEAR_MS);
  }, []);

  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div data-live-region="polite" role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </div>
    </AnnounceContext.Provider>
  );
}

/** Clears, then sets the region's text (contract §11.9). Outside a provider it does nothing. */
export function useAnnounce(): Announce {
  return useContext(AnnounceContext);
}
```

Create `components/lookup/useLookup.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAnnounce } from "@/components/primitives/LiveAnnouncer";
import type { LoadingConfig } from "@/lib/config/types";
import { classifyFailure } from "@/lib/tracking/classify-failure";
import { fetchTrack } from "@/lib/tracking/fetch-track";
import { deriveLoadingView, nextLoadingChangeMs } from "@/lib/tracking/loading-view";
import { INITIAL_LOOKUP_STATE, lastRequestOf, lookupReducer } from "@/lib/tracking/lookup-state";
import type { LookupEvent, LookupState } from "@/lib/tracking/lookup-state";
import type { LoadingViewModel, LookupOutcome, LookupRequest } from "@/lib/tracking/types";

// Client hook (contract §11.9; S06 may change internals only). Initial bundle: no zod, no derive code (module-boundary test).

export interface UseLookupOptions {
  readonly config: LoadingConfig;
  readonly onSettled?: (outcome: LookupOutcome, now: Date) => void; // called once per settled request, outside render
}

export interface UseLookupResult {
  readonly state: LookupState;
  readonly loading: LoadingViewModel | null; // recomputed only at stage boundaries and elapsed steps
  readonly submit: (request: LookupRequest) => void; // aborts the previous request
  readonly retry: () => void; // re-submits the last request with entry "retry"
  readonly cancel: () => void; // back to idle, number kept
  readonly reset: () => void;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const readReducedMotion = (): boolean => window.matchMedia(REDUCED_MOTION_QUERY).matches;
const serverReducedMotion = (): boolean => false;

export function useLookup({ config, onSettled }: UseLookupOptions): UseLookupResult {
  const [state, setState] = useState<LookupState>(INITIAL_LOOKUP_STATE);
  const [loading, setLoading] = useState<LoadingViewModel | null>(null);
  const stateRef = useRef<LookupState>(INITIAL_LOOKUP_STATE);
  const onSettledRef = useRef(onSettled);
  const announce = useAnnounce();
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, serverReducedMotion);

  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  /** Applies one event and returns the next state at once, so a settled outcome (with its failure streak) is known right here. */
  const apply = useCallback((event: LookupEvent): LookupState => {
    const next = lookupReducer(stateRef.current, event);
    stateRef.current = next;
    setState(next);
    return next;
  }, []);

  const loadingAt = useCallback(
    (request: LookupRequest, startedAt: number): LoadingViewModel =>
      deriveLoadingView({ request, elapsedMs: performance.now() - startedAt, reducedMotion, now: new Date() }, config),
    [config, reducedMotion]
  );

  const submit = useCallback(
    (request: LookupRequest): void => {
      const startedAt = performance.now();
      apply({ type: "submit", request, at: startedAt });
      setLoading(loadingAt(request, startedAt));
    },
    [apply, loadingAt]
  );

  const retry = useCallback((): void => {
    const last = lastRequestOf(stateRef.current);
    if (last !== null) submit({ ...last, entry: "retry" });
  }, [submit]);

  const cancel = useCallback((): void => {
    setLoading(null);
    apply({ type: "cancelled" });
  }, [apply]);

  const reset = useCallback((): void => {
    setLoading(null);
    apply({ type: "reset" });
  }, [apply]);

  // One request per loading state: a newer submit, a cancel, a reset or unmount aborts it (spec §5, AbortController per submit).
  useEffect(() => {
    if (state.phase !== "loading") return undefined;
    const { request } = state;
    const controller = new AbortController();
    void fetchTrack(request, { signal: controller.signal, timeoutMs: config.lookup.timeoutMs }).then((result) => {
      if (controller.signal.aborted || result.kind === "aborted") return;
      const now = new Date();
      const at = performance.now();
      setLoading(null);
      const next =
        result.kind === "success"
          ? apply({ type: "succeeded", data: result.data, at })
          : apply({ type: "failed", cause: classifyFailure(result.input), at });
      if (next.phase === "settled" || next.phase === "error") onSettledRef.current?.(next.outcome, now);
    });
    return () => controller.abort();
  }, [apply, config.lookup.timeoutMs, state]);

  // One timer to the next visible change (0.4 s, 3 s, 5 s, 8 s, then every elapsedStepSeconds), never a ticking loop.
  useEffect(() => {
    if (state.phase !== "loading" || loading === null) return undefined;
    const { request, startedAt } = state;
    const elapsed = performance.now() - startedAt;
    const delay = Math.max(0, nextLoadingChangeMs(elapsed, config) - elapsed);
    const timer = window.setTimeout(() => {
      const next = loadingAt(request, startedAt);
      setLoading(next);
      if (next.stage !== loading.stage && next.announcement !== null) announce(next.announcement);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [announce, config, loading, loadingAt, state]);

  // Offline: one automatic re-lookup when the connection returns (spec §5), never a second one in a row.
  useEffect(() => {
    if (state.phase !== "error" || state.outcome.cause !== "offline" || state.outcome.request.entry === "autoRetryOnline") {
      return undefined;
    }
    const request = state.outcome.request;
    const onOnline = (): void => submit({ ...request, entry: "autoRetryOnline" });
    window.addEventListener("online", onOnline, { once: true });
    return () => window.removeEventListener("online", onOnline);
  }, [state, submit]);

  return { state, loading, submit, retry, cancel, reset };
}
```

Create `components/status-slot/LoadingTimeline.tsx`:

```tsx
"use client";

import type { LoadingViewModel } from "@/lib/tracking/types";

// Transitional (S07 moves it to components/result/LoadingCard.tsx). Nothing here is a live region: useLookup announces the stage
// sentences through LiveAnnouncer. The skeleton is static (no shimmer) and the spinner stops at 5 s or never turns with reduced motion.

const SECONDARY =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-400 bg-white px-4 text-sm font-semibold text-slate-900 hover:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2";
const TEXT_LINK =
  "inline-flex min-h-6 items-center text-sm font-semibold text-cyan-800 underline underline-offset-2 hover:text-cyan-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2";

export function LoadingTimeline({
  loading,
  onCancel
}: {
  readonly loading: LoadingViewModel;
  readonly onCancel: () => void;
}): React.JSX.Element {
  return (
    <div
      data-loading-stage={loading.stage}
      aria-busy="true"
      className="space-y-3 rounded-2xl border-2 border-slate-200 bg-white p-4 text-slate-900"
    >
      <p className="break-keep text-sm text-slate-600">
        조회번호 <span className="whitespace-nowrap font-mono font-semibold tabular-nums text-slate-900">{loading.number.grouped}</span> ·{" "}
        {loading.carrier.barLabel}
      </p>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          data-spinner={loading.spinnerActive ? "on" : "off"}
          className={`inline-block h-5 w-5 shrink-0 rounded-full border-2 border-slate-300 border-t-slate-900 ${
            loading.spinnerActive ? "animate-spin" : ""
          }`}
        />
        <h2 className="break-keep text-lg font-bold">{loading.title}</h2>
      </div>
      <p className="break-keep text-sm leading-6 text-slate-700">{loading.body}</p>
      {loading.outageNotice ? (
        <p data-notice-kind={loading.outageNotice.kind} className="break-keep rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800">
          <span className="font-semibold">안내</span> {loading.outageNotice.title} · {loading.outageNotice.body}
        </p>
      ) : null}
      {loading.extra ? <p className="break-keep text-sm font-semibold leading-6 text-slate-900">{loading.extra}</p> : null}
      {loading.elapsedText ? <p className="text-sm tabular-nums text-slate-600">{loading.elapsedText}</p> : null}
      {loading.cancel || loading.carrierOfficial?.href ? (
        <div className="flex flex-wrap items-center gap-3">
          {loading.cancel ? (
            <button type="button" onClick={onCancel} className={SECONDARY}>
              {loading.cancel.label}
            </button>
          ) : null}
          {loading.carrierOfficial?.href ? (
            <a
              href={loading.carrierOfficial.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${loading.carrierOfficial.label} 새 창으로 열기`}
              className={TEXT_LINK}
            >
              {loading.carrierOfficial.label}
            </a>
          ) : null}
        </div>
      ) : null}
      <div aria-hidden="true" data-loading-skeleton="true" className="space-y-2">
        <div className="h-16 rounded-xl bg-slate-100" />
        <div className="h-24 rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}
```

Create `components/status-slot/StatusSlot.tsx`:

```tsx
"use client";

import { LoadingTimeline } from "@/components/status-slot/LoadingTimeline";
import type { LookupState } from "@/lib/tracking/lookup-state";
import type { LoadingViewModel, ResultAction, TrackingViewModel } from "@/lib/tracking/types";

// Transitional (contract §11.9; deleted by S07). One slot directly under the lookup form: loading, then the error or the result, in the
// same place (spec §2 원칙 1, §5). This task renders the loading card; Tasks 5 and 6 of the S04 plan add errors and results.

export interface StatusSlotProps {
  readonly state: LookupState;
  readonly loading: LoadingViewModel | null;
  readonly view: TrackingViewModel | null;
  readonly onAction: (action: ResultAction) => void;
  readonly headingRef: React.RefObject<HTMLHeadingElement | null>;
}

export function StatusSlot({ state, loading, onAction }: StatusSlotProps): React.JSX.Element | null {
  if (state.phase !== "loading") return null;
  // 0–0.4 s: only the submit label changes (spec §5); from 0.4 s the loading card fills the slot.
  if (loading === null || loading.stage === "instant") return null;
  return (
    <div data-status-slot="loading" className="mt-5">
      <LoadingTimeline loading={loading} onCancel={() => onAction({ kind: "cancel" })} />
    </div>
  );
}
```

- [ ] **Step 5: Rewrite the form and the page**

Replace the whole content of `components/TrackingForm.tsx` with:

```tsx
"use client";

import { ArrowRight, ChevronsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lookup } from "@/config/site.config";
import { DELIVERY_CARRIER_OPTIONS, DeliveryCarrierCodeSchema } from "@/lib/delivery-carriers";
import type { DeliveryCarrierCode } from "@/lib/types";
import { cn } from "@/lib/utils";

// Transitional (deleted by S06). Controlled by HomePageClient, which owns the lookup (useLookup). While a lookup runs nothing is
// disabled: the form is aria-busy and the button reads '조회 중…'; a new submit replaces the running lookup (spec §5).

type TrackingFormProps = {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly carrier: DeliveryCarrierCode;
  readonly onCarrierChange: (carrier: DeliveryCarrierCode) => void;
  readonly onSubmit: () => void;
  readonly busy: boolean;
  /** True while the slot under the form shows the invalid-number sentence (rendered by FailureNotice with this id). */
  readonly invalid: boolean;
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
  readonly surface?: "dark" | "light";
};

/** id of the invalid-number sentence (role="alert") that the input names in aria-describedby. */
export const INVALID_NUMBER_ERROR_ID = "tracking-invalid-error";
const TRACKING_HELP_ID = "tracking-format-help";
const TRACKING_INPUT_CUE_ID = "tracking-input-cue";

export const TrackingForm = ({
  value,
  onValueChange,
  carrier,
  onCarrierChange,
  onSubmit,
  busy,
  invalid,
  inputRef,
  surface = "dark"
}: TrackingFormProps) => {
  const isLight = surface === "light";
  const needsInputAttention = value.trim().length === 0 && !busy;
  const describedBy = invalid
    ? `${TRACKING_INPUT_CUE_ID} ${TRACKING_HELP_ID} ${INVALID_NUMBER_ERROR_ID}`
    : `${TRACKING_INPUT_CUE_ID} ${TRACKING_HELP_ID}`;

  return (
    <div className="pointer-events-auto space-y-4">
      <form
        className="space-y-4"
        aria-busy={busy || undefined}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div>
          <label htmlFor="delivery-carrier" className={cn("block text-sm font-semibold", isLight ? "text-slate-800" : "text-slate-100")}>
            국내 택배사
          </label>
          <select
            id="delivery-carrier"
            name="carrierCode"
            value={carrier}
            onChange={(event) => {
              const parsed = DeliveryCarrierCodeSchema.safeParse(event.target.value);
              if (parsed.success) onCarrierChange(parsed.data);
            }}
            className={cn(
              "mt-2 h-14 w-full min-w-0 rounded-xl border px-4 text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-400/70",
              isLight
                ? "border-slate-300 bg-slate-50 text-slate-800 hover:border-cyan-400"
                : "border-slate-600/80 bg-slate-950/60 text-slate-100 hover:border-cyan-300/60"
            )}
          >
            {DELIVERY_CARRIER_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.code === "AUTO" ? "자동으로 찾기" : option.name}
              </option>
            ))}
          </select>
          <p className={cn("mt-2 text-xs", isLight ? "text-slate-600" : "text-slate-400")}>
            택배사를 모르시면 자동으로 찾기를 선택하세요.
          </p>
        </div>
        <div>
          <label htmlFor="tracking-number" className={cn("block text-sm font-semibold", isLight ? "text-slate-800" : "text-slate-100")}>
            조회번호 (HBL 또는 운송장)
          </label>
          <p
            id={TRACKING_INPUT_CUE_ID}
            data-input-attention-cue="true"
            className={cn(
              "mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-black shadow-sm transition",
              isLight ? "border-cyan-300 bg-cyan-50 text-cyan-800" : "border-cyan-200/35 bg-cyan-300/10 text-cyan-100",
              needsInputAttention && "motion-cue-pop"
            )}
          >
            운송장 번호는 바로 아래 칸에 넣어 주세요!
            <ChevronsDown
              data-motion-cue="tracking-input-pointer"
              className={cn("h-5 w-5 shrink-0", needsInputAttention && "motion-input-pointer")}
              aria-hidden="true"
            />
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <div className="min-w-0 flex-1">
              <Input
                ref={inputRef}
                id="tracking-number"
                name="trackingNumber"
                data-input-shake={needsInputAttention ? "active" : "idle"}
                value={value}
                onChange={(event) => onValueChange(event.target.value)}
                placeholder="여기에 운송장 / HBL 번호를 입력하세요"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                required
                autoComplete="off"
                autoCapitalize="characters"
                enterKeyHint="search"
                inputMode="text"
                spellCheck={false}
                className={cn(
                  "h-14 text-base font-semibold",
                  isLight
                    ? "border-cyan-400 bg-white text-slate-950 placeholder:text-slate-500 focus-visible:ring-cyan-500/60"
                    : "border-cyan-300/60",
                  needsInputAttention && "motion-input-attention"
                )}
              />
            </div>
            <Button type="submit" className="gap-2 sm:w-36">
              {busy ? (
                lookup.copy.submitting
              ) : (
                <>
                  {lookup.copy.submit}
                  <ArrowRight data-motion-cue="tracking-submit" className="motion-cue-right h-4 w-4" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
      <p id={TRACKING_HELP_ID} className={cn("break-keep text-xs leading-5", isLight ? "text-slate-600" : "text-slate-400")}>
        {lookup.copy.formatHint}
      </p>
      <p className="text-xs leading-5 text-slate-500">
        참고: UNI-PASS 통관조회는 HBL/화물관리번호에서만 동작하며, 국내 운송장은 택배사 배송조회 기준으로 표시됩니다.
      </p>
    </div>
  );
};
```

Replace the whole content of `components/HomePageClient.tsx` with the file below. It keeps every S02 behavior (the candidate-B scrub effect, the restore snapshot, `saveRestoreEntry` on every lookup start, `ReturnLinkButton` under the result) and moves the lookup out of `TrackingForm` into `useLookup`. **If Task 0 Step 10 wrote "S02 history entry: not shipped"**, delete every block between `// S02-HISTORY-ENTRY:BEGIN` and `// S02-HISTORY-ENTRY:END` (both marker lines included) and every line that ends with `// S02-HISTORY-ENTRY` before saving.

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { motion, MotionConfig, useReducedMotion } from "framer-motion";
import { AssuranceRail } from "@/components/AssuranceRail";
import { CustomerCta } from "@/components/CustomerCta";
import type { ResultCustomerCtaState } from "@/components/CustomerCta";
import { CustomsTimeline } from "@/components/CustomsTimeline";
import { DeliveryTimeline } from "@/components/DeliveryTimeline";
import { LogisticsFlow } from "@/components/LogisticsFlow";
import { RecommendedProducts } from "@/components/RecommendedProducts";
import { ReturnLinkButton } from "@/components/ReturnLinkButton";
import { ServiceGuide } from "@/components/ServiceGuide";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StoreContactPopup } from "@/components/StoreContactPopup";
import { StorefrontShowcase } from "@/components/StorefrontShowcase";
import { TrackingForm } from "@/components/TrackingForm";
import { TrackingResultSummary } from "@/components/TrackingResultSummary";
import { useLookup } from "@/components/lookup/useLookup";
import { LiveAnnouncerProvider, useAnnounce } from "@/components/primitives/LiveAnnouncer";
import { StatusSlot } from "@/components/status-slot/StatusSlot";
import { deriveStatusView } from "@/components/status-slot/status-view";
import { Card } from "@/components/ui/card";
import { lookup as lookupSettings, notices } from "@/config/site.config";
import { setAdSignals } from "@/lib/ads/ad-signals";
import type { LoadingConfig } from "@/lib/config/types";
import { currentNavigationKind, readRestoreEntry, saveRestoreEntry } from "@/lib/privacy/session-restore";
import type { RestoreEntry } from "@/lib/privacy/session-restore";
import { SCRUB_TIMEOUT_MS, scrubNumberFromUrl } from "@/lib/privacy/url-scrub";
import { INITIAL_LOOKUP_STATE } from "@/lib/tracking/lookup-state";
import type { LookupOutcome, LookupRequest, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
import type { DeliveryCarrierCode, TrackResponseData } from "@/lib/types";

type HomePageClientProps = {
  initialTrackingNumber: string;
};

const LOADING_CONFIG: LoadingConfig = { lookup: lookupSettings, notices };

/** Transitional normalization of a typed number (S06's normalizeInput replaces it): half-width digits, no spaces or hyphens, uppercase. */
const toRequestNumber = (value: string): string =>
  value
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/[\s-]/g, "")
    .toUpperCase();

// S04-BRIDGE:settled — legacy result section helpers until Task 6 of the S04 plan.
const getResultCustomerCtaState = (data: TrackResponseData): ResultCustomerCtaState => {
  if (data.delivery.ambiguous) return "pending";
  if (data.delivery.lookupUnavailable) return "pending";
  if (data.isPending) return "pending";
  if (data.currentStatusCode === 7) return "delivered";
  return "inTransit";
};

const getDeliveryWaitingMessage = (data: TrackResponseData): string | undefined => {
  if (data.delivery.events.length > 0) return undefined;

  if (data.delivery.ambiguous) {
    return "같은 번호가 여러 택배사에서 확인됐습니다. 위에서 택배사를 선택해 다시 조회해 주세요.";
  }

  if (data.delivery.lookupUnavailable) {
    return data.delivery.trackingUrl
      ? "택배사 조회가 지연되고 있습니다. 아래 링크에서 확인해 주세요."
      : "자동 조회가 지연되고 있습니다. 위에서 택배사를 선택해 다시 조회해 주세요.";
  }

  if (data.isPending) {
    return "상품이 아직 국내 도착 전이라 통관·배송 내역이 없습니다. 구매한 쇼핑몰을 선택하거나 톡톡으로 문의해 주세요.";
  }

  if (data.customs.events.length > 0 && data.currentStatusCode >= 4) {
    return "택배사 인계를 기다리고 있습니다. 보통 통관 완료 후 0~1영업일 내 인계됩니다.";
  }

  return undefined;
};

// Session restore (spec §3, S02): only in reload/back_forward documents, read once per document, and dropped as
// soon as any lookup starts in this document (so an in-app return to '/' does not replay it). The server
// snapshot is null, so the static '/' HTML and the first client render stay identical.
let restoreSnapshot: RestoreEntry | null | undefined;
let restoreConsumed = false;
const subscribeToNothing = (): (() => void) => () => undefined;
const getRestoreSnapshot = (): RestoreEntry | null => {
  if (restoreConsumed) return null;
  if (restoreSnapshot === undefined) {
    restoreSnapshot = readRestoreEntry({ now: Date.now(), navigation: currentNavigationKind() });
  }
  return restoreSnapshot;
};
const getServerRestoreSnapshot = (): RestoreEntry | null => null;
const markRestoreConsumed = (): void => {
  restoreConsumed = true;
};

// S02-HISTORY-ENTRY:BEGIN
// Same-address history entry (spec §3 뒤로가기, S02 Task 11): when a manual lookup settles on '/', push '/' once more so that
// Back returns to the lookup form instead of leaving the site.
const LOOKUP_HISTORY_MARK = "ttLookup";
const isLookupHistoryEntry = (state: unknown): boolean =>
  typeof state === "object" && state !== null && LOOKUP_HISTORY_MARK in state;
const pushLookupHistoryEntry = (): void => {
  const { pathname, search, hash } = window.location;
  if (pathname !== "/" || search !== "" || hash !== "") return;
  if (isLookupHistoryEntry(window.history.state)) return;
  window.history.pushState({ [LOOKUP_HISTORY_MARK]: true }, "", "/");
};
// S02-HISTORY-ENTRY:END

/** Any of these since the page loaded means the customer is busy elsewhere: a deep-link result then must not take focus (spec §5). */
const INTERACTION_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

type FocusTarget = "heading" | "input" | null;

function HomePageContent({ initialTrackingNumber }: HomePageClientProps) {
  const prefersReducedMotion = useReducedMotion();
  const announce = useAnnounce();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const interactedRef = useRef(false);
  const focusTargetRef = useRef<FocusTarget>(null);
  const startedInitialRef = useRef<string | null>(null);
  const manualLookupPendingRef = useRef(false); // S02-HISTORY-ENTRY
  const [view, setView] = useState<TrackingViewModel | null>(null);
  const [resultHidden, setResultHidden] = useState(false);

  // Candidate B (spec §3, S02): the lookup has already started (effect below). Once the App Router has committed, stash the number
  // for restore, remove it from the URL, and report the result to the ad gate.
  useEffect(() => {
    if (!initialTrackingNumber) return;
    void scrubNumberFromUrl({
      timeoutMs: SCRUB_TIMEOUT_MS,
      beforeReplace: () => saveRestoreEntry({ number: initialTrackingNumber, carrier: "AUTO", savedAt: Date.now() })
    }).then((status) => {
      if (status === "scrubbed" || status === "failed") setAdSignals({ scrub: status });
    });
  }, [initialTrackingNumber]);

  const restoreEntry = useSyncExternalStore(subscribeToNothing, getRestoreSnapshot, getServerRestoreSnapshot);
  const restoredRequest = initialTrackingNumber ? null : restoreEntry;
  const initialRequest = useMemo<LookupRequest | null>(() => {
    if (initialTrackingNumber) return { number: toRequestNumber(initialTrackingNumber), carrier: "AUTO", entry: "deepLink" };
    if (restoredRequest) return { number: restoredRequest.number, carrier: restoredRequest.carrier, entry: "restore" };
    return null;
  }, [initialTrackingNumber, restoredRequest]);
  const initialKey = initialRequest === null ? null : `${initialRequest.entry}:${initialRequest.number}:${initialRequest.carrier}`;

  const [value, setValue] = useState(initialTrackingNumber);
  const [carrier, setCarrier] = useState<DeliveryCarrierCode>("AUTO");
  const [syncedInitialKey, setSyncedInitialKey] = useState<string | null>(null);
  // A deep link or a restored lookup fills the form during render rather than in an effect (S02 pattern).
  if (initialRequest !== null && initialKey !== syncedInitialKey) {
    setSyncedInitialKey(initialKey);
    setValue(initialRequest.number);
    setCarrier(initialRequest.carrier);
  }

  const handleSettled = useCallback(
    (outcome: LookupOutcome, now: Date) => {
      const next = deriveStatusView(outcome, now);
      setView(next);
      if (next.mode === "settled") announce(next.liveMessage);
      const fromLink = outcome.request.entry === "deepLink" || outcome.request.entry === "restore";
      focusTargetRef.current = fromLink && interactedRef.current ? null : next.guideKey === "invalidNumber" ? "input" : "heading";
      // S02-HISTORY-ENTRY:BEGIN
      if (manualLookupPendingRef.current) {
        manualLookupPendingRef.current = false;
        pushLookupHistoryEntry();
      }
      // S02-HISTORY-ENTRY:END
    },
    [announce]
  );

  const { state, loading, submit, retry, cancel } = useLookup({ config: LOADING_CONFIG, onSettled: handleSettled });

  /** Every lookup start overwrites the tab's restore entry and consumes a pending restore (S02). */
  const beginLookup = useCallback(
    (request: LookupRequest) => {
      markRestoreConsumed();
      saveRestoreEntry({ number: request.number, carrier: request.carrier, savedAt: Date.now() });
      manualLookupPendingRef.current = request.entry === "manual"; // S02-HISTORY-ENTRY
      submit(request);
    },
    [submit]
  );

  // Deep links and restored lookups start right after hydration (candidate B ②); the ref keeps Strict Mode from starting twice.
  useEffect(() => {
    if (initialRequest === null || startedInitialRef.current === initialKey) return;
    startedInitialRef.current = initialKey;
    beginLookup(initialRequest);
  }, [beginLookup, initialKey, initialRequest]);

  useEffect(() => {
    const markInteracted = (): void => {
      interactedRef.current = true;
    };
    for (const name of INTERACTION_EVENTS) window.addEventListener(name, markInteracted, { capture: true, passive: true });
    return () => {
      for (const name of INTERACTION_EVENTS) window.removeEventListener(name, markInteracted, { capture: true });
    };
  }, []);

  // After a settled view is on screen: focus the visible status heading, or the input for a malformed number (spec §5).
  useEffect(() => {
    const target = focusTargetRef.current;
    if (target === null || view === null) return;
    focusTargetRef.current = null;
    if (target === "input") inputRef.current?.focus();
    else headingRef.current?.focus();
  }, [view]);

  // S02-HISTORY-ENTRY:BEGIN
  useEffect(() => {
    const onPopState = (event: PopStateEvent): void => {
      if (window.location.pathname !== "/") return;
      setResultHidden(!isLookupHistoryEntry(event.state));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  // S02-HISTORY-ENTRY:END

  const handleFormSubmit = useCallback(() => {
    const number = toRequestNumber(value);
    if (number === "") {
      inputRef.current?.focus();
      return;
    }
    setResultHidden(false);
    beginLookup({ number, carrier, entry: "manual" });
  }, [beginLookup, carrier, value]);

  const handleAction = useCallback(
    (action: ResultAction) => {
      switch (action.kind) {
        case "fixNumber":
          inputRef.current?.focus();
          inputRef.current?.select();
          return;
        case "retry":
          retry();
          return;
        case "cancel":
          cancel();
          inputRef.current?.focus();
          return;
        case "chooseCarrier":
          setCarrier(action.carrier);
          beginLookup({ number: view?.number.raw ?? toRequestNumber(value), carrier: action.carrier, entry: "carrierChip" });
          return;
        case "copied":
        case "openedExternal":
          return;
      }
    },
    [beginLookup, cancel, retry, value, view]
  );

  const slotState = resultHidden ? INITIAL_LOOKUP_STATE : state;
  const slotView = resultHidden ? null : view;
  const idle = slotState.phase === "idle";
  const busy = state.phase === "loading";
  const invalid = slotState.phase === "error" && slotView?.guideKey === "invalidNumber";
  const settledData = slotState.phase === "settled" ? slotState.outcome.data : null;
  // Store link and showcase keep the pre-renewal rule until Task 7 of the S04 plan narrows them to the idle page.
  const showStorefront = idle || settledData?.currentStatusCode === 7;

  return (
    <MotionConfig reducedMotion="user">
      <SiteHeader showStorefront={showStorefront} />
      <StoreContactPopup visible={idle} />
      <main id="main-content" className="mx-auto min-h-[100dvh] w-full max-w-6xl px-4 pb-10 sm:px-6">
        <section id="tracking" data-ad-exclude="true" className="scroll-mt-24 pb-9 pt-4 sm:pb-14 sm:pt-10">
          <motion.div
            className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-8"
            // No enter animation for the lookup hero: the server HTML must paint it (spec §12, PERF-02).
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
          >
            <div className="lg:col-span-6">
              <div className="inline-flex rounded-lg border border-cyan-300/35 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100">
                구매 고객을 위한 배송조회
              </div>
              <h1 className="mt-5 max-w-2xl break-keep text-balance text-[2rem] font-semibold leading-[1.12] text-slate-50 sm:mt-6 sm:text-5xl lg:text-5xl">
                통관부터 국내 배송까지 <span className="whitespace-nowrap text-cyan-200">한 번에 확인</span>
              </h1>
              <p className="section-copy mt-4 max-w-xl text-sm sm:mt-5 sm:text-base">
                HBL 또는 운송장 번호 하나로 현재 통관 단계와 국내 배송 내역을 확인하세요. <span className="whitespace-nowrap">기다려야 하는 이유와</span>{" "}
                <span className="whitespace-nowrap">다음 행동까지 안내합니다.</span>
              </p>

              <LogisticsFlow />
            </div>

            <Card
              id="tracking-panel"
              data-ad-exclude="true"
              className="relative overflow-hidden rounded-[1.4rem] border-white/70 bg-slate-50 p-4 text-slate-950 shadow-2xl sm:p-7 lg:col-span-6 lg:p-8"
            >
              <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-cyan-300/30 blur-3xl" aria-hidden="true" />
              <div className="relative">
                <p className="text-sm font-semibold text-cyan-700">배송 조회</p>
                <h2 className="mt-2 break-keep text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">내 배송은 어디쯤일까요?</h2>
                <p className="mt-3 break-keep text-sm leading-6 text-slate-600">
                  번호를 입력하면 조회 시점 기준 최신 정보를 불러옵니다.
                </p>
                <div className="mt-6">
                  <TrackingForm
                    value={value}
                    onValueChange={setValue}
                    carrier={carrier}
                    onCarrierChange={setCarrier}
                    onSubmit={handleFormSubmit}
                    busy={busy}
                    invalid={invalid}
                    inputRef={inputRef}
                    surface="light"
                  />
                  <StatusSlot state={slotState} loading={loading} view={slotView} onAction={handleAction} headingRef={headingRef} />
                </div>
              </div>
            </Card>
          </motion.div>

          <div className="mt-6">
            <AssuranceRail />
          </div>
        </section>

        <div className="mx-auto max-w-5xl">
          {/* S04-BRIDGE:error — legacy error CTA block until Task 5 of the S04 plan. */}
          {slotState.phase === "error" ? (
            <section className="mb-8 space-y-3">
              <CustomerCta variant="result" state="error" />
            </section>
          ) : null}

          {/* S04-BRIDGE:settled — legacy result section until Task 6 of the S04 plan. */}
          {settledData ? (
            <section className="space-y-4 pb-8" aria-labelledby="tracking-result-title" data-ad-exclude="true">
              <h2 ref={headingRef} id="tracking-result-title" tabIndex={-1} className="sr-only scroll-mt-24 outline-none">
                배송 조회 결과
              </h2>
              <TrackingResultSummary data={settledData} />
              <ReturnLinkButton
                key={`${settledData.trackingNumber}:${settledData.delivery.carrierCode}`}
                number={settledData.trackingNumber}
                carrier={settledData.delivery.carrierCode}
              />
              <section className="space-y-3 pt-3" aria-labelledby="tracking-details-title">
                <div>
                  <h3 id="tracking-details-title" className="text-lg font-bold text-slate-50">상세 진행 내역</h3>
                  <p className="mt-1 text-sm text-slate-400">최근 통관과 국내 배송 내역이 필요한 경우에만 확인하세요.</p>
                </div>
                <div className="grid items-start gap-4 lg:grid-cols-2">
                  <div className="order-2 lg:order-1">
                    <CustomsTimeline events={settledData.customs.events} />
                  </div>
                  <div className="order-1 lg:order-2">
                    <DeliveryTimeline delivery={settledData.delivery} waitingMessage={getDeliveryWaitingMessage(settledData)} />
                  </div>
                </div>
              </section>
              <CustomerCta variant="result" state={getResultCustomerCtaState(settledData)} />
              <RecommendedProducts
                statusCode={settledData.currentStatusCode}
                isPending={settledData.isPending || settledData.delivery.lookupUnavailable || settledData.delivery.ambiguous}
              />
            </section>
          ) : null}
        </div>

        {showStorefront ? <StorefrontShowcase /> : null}
        <ServiceGuide />
        <SiteFooter />
      </main>
    </MotionConfig>
  );
}

export const HomePageClient = ({ initialTrackingNumber }: HomePageClientProps) => (
  <LiveAnnouncerProvider>
    <HomePageContent initialTrackingNumber={initialTrackingNumber} />
  </LiveAnnouncerProvider>
);
```

- [ ] **Step 6: Delete the components the slot replaced**

Use the Grep tool with pattern `LoadingSpinner|ErrorMessage|ui/skeleton|ui/alert` over `app/`, `components/`, `lib/`, `tests/`. Expected: matches only inside the four files about to be deleted.
Run: `git rm components/LoadingSpinner.tsx components/ErrorMessage.tsx components/ui/skeleton.tsx components/ui/alert.tsx`
Expected: `rm 'components/LoadingSpinner.tsx'` and three more `rm` lines.

- [ ] **Step 7: Run the new spec to verify it passes**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/loading-timeline.spec.ts`
Expected: `9 passed`.

- [ ] **Step 8: Nothing else moved**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/tracking.spec.ts tests/privacy.spec.ts tests/e2e`
Expected: 0 failed (the pre-renewal result assertions still see the legacy summary through the `S04-BRIDGE:settled` block; S02's url-privacy, session-restore and return-link suites pass unchanged).
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: 0 failed (module boundaries: `components/lookup/useLookup.ts` and `components/primitives/LiveAnnouncer.tsx` reach no zod, schema, CS or derive module).
Run: `npm run typecheck; npm run lint`
Expected: both exit 0 (in particular no `react-hooks/set-state-in-effect`, `react-hooks/refs` or `react-hooks/purity` findings: clocks are read in callbacks and effects, refs are written outside render).

- [ ] **Step 9: Commit**

```powershell
git add components/primitives/LiveAnnouncer.tsx components/lookup/useLookup.ts components/status-slot/LoadingTimeline.tsx components/status-slot/StatusSlot.tsx components/TrackingForm.tsx components/HomePageClient.tsx tests/support/status-slot.ts tests/e2e/loading-timeline.spec.ts
git commit -m "feat: run lookups through useLookup with a staged loading card and one live region"
```
Expected: one commit; `git status --short` is clean (the four deletions were staged by `git rm`).

---

### Task 5: Errors by cause in the slot

**Files:**
- Create: `components/status-slot/SlotParts.tsx`, `components/status-slot/FailureNotice.tsx`, `components/status-slot/WorryLine.tsx`, `components/status-slot/CopyInquiryButton.tsx`
- Rewrite: `components/CustomerCta.tsx` (whole file: legacy variants kept verbatim, `variant: "view"` added)
- Modify: `components/status-slot/StatusSlot.tsx` (whole file), `components/HomePageClient.tsx` (delete the `S04-BRIDGE:error` block)
- Test: `tests/e2e/failure-causes.spec.ts`

**Interfaces:**
- Consumes: `deriveStatusView`, `STATUS_SLOT_APPROVALS` (Task 3); `StatusSlotProps`, `INVALID_NUMBER_ERROR_ID`, support helpers (Task 4); `copyText`, `CopyOutcome` (`lib/clipboard.ts`, S02); `ReturnLinkButton` (S02); `TrackingViewModel`, `ActionView`, `ActionWeight`, `WorryLineView`, `StoreLinksView`, `CarrierChoiceView`, `HelpItemView`, `NoticeView`, `NumberView`, `Tone`, `FailureCause`, `ResultAction` (S03 types); `siteConfig`, `lookup` (config); `FAILURE_RESPONSES`, `mockTrack`, `successBody`, `trackData`, `FAKE`, `FIXTURE_NOW` (S01).
- Produces: `FailureNotice(props: { view; cause: FailureCause; headingRef; onAction }): React.JSX.Element` (root `data-failure-cause`, `data-guide-key`, `data-overdue="false"`, `data-tone`; `h2` with `tabIndex={-1}` and `role="alert"` only on the reason sentence; for `invalidNumber` the title itself is the `role="alert"` sentence with id `INVALID_NUMBER_ERROR_ID`), `WorryLine(props: { worry: WorryLineView; showTalk: boolean })`, `CopyInquiryButton(props: { label; href; text; weight; onCopied? })`, `SlotParts` exports (`RECOVERY_KINDS`, `TONE_BORDER`, `actionClassName`, `ActionControl`, `NumberLine`, `ChipLine`, `NoticeLine`, `AuxiliaryLine`), `CustomerCta` `variant: "view"` (root `<section data-cta-state={view.ctaState}>`; on errors it leaves `fixNumber`/`retry` to the card, so its first link is 톡톡) and `INLINE_HELP_IDS`. `StatusSlot` renders `data-status-slot="error"` with the card, the CTA block and the help details.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/failure-causes.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { STATUS_SLOT_APPROVALS, deriveStatusView } from "@/components/status-slot/status-view";
import { INVALID_NUMBER_ERROR_ID } from "@/components/TrackingForm";
import { lookup, siteConfig } from "@/config/site.config";
import type { FailureCause, TrackingViewModel } from "@/lib/tracking/types";
import { FAILURE_RESPONSES, FAKE, FIXTURE_NOW, mockTrack, successBody, trackData } from "../fixtures/tracking-fixtures";
import type { FailureFixture } from "../fixtures/tracking-fixtures";
import {
  INPUT_LABEL,
  PAUSED_NOW,
  blockThirdParty,
  holdTrack,
  lookUp,
  manualRequest,
  openPaused,
  statusSlot
} from "../support/status-slot";

const CAUSE_BY_FIXTURE: Readonly<Record<FailureFixture, FailureCause>> = {
  invalid400: "invalidNumber",
  notFound404: "notFound",
  rateLimited429: "rateLimited",
  upstreamTimeout504: "upstreamTimeout",
  unavailable503: "upstreamTimeout",
  serverError500: "serverError",
  badGatewayHtml502: "badGateway",
  contractViolation200: "contractViolation"
};
/** Negative checks: time for a wrongly started request to show up. */
const SETTLE_MS = 500;

function expectedFailure(cause: FailureCause, number: string, now: Date = FIXTURE_NOW, consecutiveFailures = 1): TrackingViewModel {
  return deriveStatusView({ kind: "failure", request: manualRequest(number), cause, consecutiveFailures }, now);
}

/** The server's own sentence in a failure fixture (never shown to customers), or null when the body has none. */
function serverMessageOf(fixture: FailureFixture): string | null {
  try {
    const body: unknown = JSON.parse(FAILURE_RESPONSES[fixture].body);
    if (typeof body !== "object" || body === null || !("error" in body)) return null;
    const error: unknown = body.error;
    if (typeof error !== "object" || error === null || !("message" in error)) return null;
    return typeof error.message === "string" ? error.message : null;
  } catch {
    return null;
  }
}

async function setNavigatorOnline(page: Page, online: boolean): Promise<void> {
  await page.evaluate((value) => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => value });
  }, online);
}

async function dispatchOnline(page: Page): Promise<void> {
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
}

test.beforeEach(async ({ page }) => {
  await blockThirdParty(page);
});

for (const fixture of Object.keys(CAUSE_BY_FIXTURE) as FailureFixture[]) {
  test(`${fixture}: the cause's own notice, 톡톡 first in the block, no stores and no server wording`, async ({ page }) => {
    const cause = CAUSE_BY_FIXTURE[fixture];
    const view = expectedFailure(cause, FAKE.domestic);
    await page.clock.setFixedTime(FIXTURE_NOW);
    await mockTrack(page, fixture);
    await page.goto("/");
    await lookUp(page, FAKE.domestic);

    const slot = statusSlot(page);
    await expect(slot).toHaveAttribute("data-status-slot", "error");
    const notice = slot.locator(`[data-failure-cause="${cause}"]`);
    await expect(notice).toHaveAttribute("data-guide-key", view.guideKey);
    if (view.guideKey === "invalidNumber") {
      await expect(notice.getByRole("alert")).toHaveText(view.title);
      await expect(notice.getByRole("heading")).toHaveCount(0);
    } else {
      const heading = notice.getByRole("heading", { level: 2 });
      await expect(heading).toHaveText(view.title);
      await expect(heading).toBeFocused();
      await expect(heading).not.toHaveAttribute("role", "alert");
      await expect(notice.getByRole("alert")).toHaveText(view.reason ?? "");
    }

    const cta = slot.locator('[data-cta-state="error"]');
    await expect(cta.getByRole("heading", { level: 3 })).toHaveText(view.nextAction.heading ?? "");
    await expect(cta.getByRole("link").first()).toHaveAttribute("href", siteConfig.channels.talk.url);
    await expect(slot.locator('[data-action-weight="primary"]')).toHaveCount(1);
    await expect(page.locator('a[rel~="sponsored"]')).toHaveCount(0);
    await expect(page.locator("[data-affiliate-group], [data-recommended-products], [data-storefront-showcase]")).toHaveCount(0);
    const message = serverMessageOf(fixture);
    if (message !== null) await expect(page.getByText(message)).toHaveCount(0);
  });
}

test("an invalid number keeps focus in the input and describes the error there", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, "invalid400");
  await page.goto("/");
  await lookUp(page, FAKE.deepLinkInvalid);
  const input = page.getByLabel(INPUT_LABEL, { exact: true });
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  expect(((await input.getAttribute("aria-describedby")) ?? "").split(" ")).toContain(INVALID_NUMBER_ERROR_ID);
  const sentence = page.locator(`#${INVALID_NUMBER_ERROR_ID}`);
  await expect(sentence).toHaveText(expectedFailure("invalidNumber", FAKE.deepLinkInvalid).title);
  await expect(sentence).toHaveAttribute("role", "alert");
});

test("[번호 수정] puts the cursor back in the number field with the number selected", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, "notFound404");
  await page.goto("/");
  await lookUp(page, FAKE.domestic);
  await statusSlot(page).locator('[data-action-kind="fixNumber"]').click();
  const input = page.getByLabel(INPUT_LABEL, { exact: true });
  await expect(input).toBeFocused();
  const selected = await input.evaluate((element) =>
    element instanceof HTMLInputElement ? (element.selectionEnd ?? 0) - (element.selectionStart ?? 0) : -1
  );
  expect(selected).toBe(FAKE.domestic.length);
});

test("the filled primary on an error follows the approval-3 ledger", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, "notFound404");
  await page.goto("/");
  await lookUp(page, FAKE.domestic);
  const view = expectedFailure("notFound", FAKE.domestic);
  expect(view.nextAction.primary?.kind).toBe(STATUS_SLOT_APPROVALS.approval3 ? "fixNumber" : "talk");
  await expect(statusSlot(page).locator('[data-action-weight="primary"]')).toHaveAttribute(
    "data-action-kind",
    view.nextAction.primary?.kind ?? "none"
  );
});

test("NOT_FOUND shows the service caveat line only while lookup.notFoundServiceCaveat is on", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, "notFound404");
  await page.goto("/");
  await lookUp(page, FAKE.domestic);
  await expect(statusSlot(page).locator('[data-failure-cause="notFound"]')).toBeVisible();
  await expect(statusSlot(page).getByText(siteConfig.resultCopy.notFoundCaveat)).toHaveCount(lookup.notFoundServiceCaveat ? 1 : 0);
});

test("429: [다시 조회] waits out the countdown, then looks up again; nothing retries by itself", async ({ page }) => {
  const bodies: unknown[] = [];
  await mockTrack(page, "rateLimited429", { onRequest: (body) => bodies.push(body) });
  await openPaused(page);
  await lookUp(page, FAKE.domestic);
  const slot = statusSlot(page);
  const view = expectedFailure("rateLimited", FAKE.domestic, PAUSED_NOW);
  await expect(slot.locator('[data-failure-cause="rateLimited"]').getByRole("alert")).toHaveText(view.reason ?? "");
  const retry = slot.locator('[data-action-kind="retry"]');
  await expect(retry).toHaveAttribute("aria-disabled", "true");
  await retry.click({ force: true });
  await page.clock.runFor(1_000);
  expect(bodies).toHaveLength(1);
  await page.clock.runFor(lookup.rateLimitCooldownSeconds * 1000);
  await expect(retry).not.toHaveAttribute("aria-disabled", "true");
  await retry.click();
  await expect.poll(() => bodies.length).toBe(2);
});

test("a network error while online is a temporary delay, not a number problem", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await page.route("**/api/track", (route) => (route.request().method() === "POST" ? route.abort("failed") : route.fallback()));
  await page.goto("/");
  await lookUp(page, FAKE.domestic);
  const notice = statusSlot(page).locator('[data-failure-cause="network"]');
  await expect(notice).toHaveAttribute("data-guide-key", "temporaryDelay");
  await expect(notice.getByRole("alert")).toHaveText(expectedFailure("network", FAKE.domestic).reason ?? "");
});

test("offline: one automatic re-lookup when the connection returns", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const bodies: unknown[] = [];
  let reachable = false;
  await page.route("**/api/track", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    bodies.push(route.request().postDataJSON());
    if (!reachable) {
      await route.abort("internetdisconnected");
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: successBody(trackData("inTransit")) });
  });
  await page.goto("/");
  await setNavigatorOnline(page, false);
  await lookUp(page, FAKE.hbl);
  const notice = statusSlot(page).locator('[data-failure-cause="offline"]');
  await expect(notice.getByRole("heading", { level: 2 })).toHaveText(expectedFailure("offline", FAKE.hbl).title);
  expect(bodies).toHaveLength(1);
  reachable = true;
  await setNavigatorOnline(page, true);
  await dispatchOnline(page);
  await expect(page.getByRole("heading", { name: "국내 배송 중" })).toBeVisible();
  expect(bodies).toHaveLength(2);
});

test("offline: the automatic re-lookup happens once, never a second time in a row", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const bodies: unknown[] = [];
  await page.route("**/api/track", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    bodies.push(route.request().postDataJSON());
    await route.abort("internetdisconnected");
  });
  await page.goto("/");
  await setNavigatorOnline(page, false);
  await lookUp(page, FAKE.hbl);
  await expect(statusSlot(page).locator('[data-failure-cause="offline"]')).toBeVisible();
  // The connection flaps: "online" fires, but the automatic re-lookup fails offline again.
  await dispatchOnline(page);
  await expect.poll(() => bodies.length).toBe(2);
  await expect(statusSlot(page).locator('[data-failure-cause="offline"]')).toBeVisible();
  await dispatchOnline(page);
  await page.waitForTimeout(SETTLE_MS);
  expect(bodies).toHaveLength(2);
});

test("a second failure in a row makes [문의 내용 복사하고 톡톡 열기] the filled primary with the inquiry text", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, "upstreamTimeout504");
  await page.goto("/");
  await lookUp(page, FAKE.domestic);
  const slot = statusSlot(page);
  await expect(slot.locator('[data-failure-cause="upstreamTimeout"]')).toBeVisible();
  await slot.locator('[data-action-kind="retry"]').click();
  const view = deriveStatusView(
    { kind: "failure", request: { ...manualRequest(FAKE.domestic), entry: "retry" }, cause: "upstreamTimeout", consecutiveFailures: 2 },
    FIXTURE_NOW
  );
  const primary = slot.locator('[data-action-weight="primary"]');
  await expect(primary).toHaveAttribute("data-action-kind", "copyAndTalk");
  await expect(primary).toHaveAccessibleName(`${view.nextAction.primary?.label ?? ""} 새 창으로 열기`);
  await expect(slot.locator("[data-inquiry-preview]")).toHaveText(view.inquiryCopy ?? "");
  await expect(slot.locator('[data-cta-state="error"]').getByRole("link").first()).toHaveAttribute("data-action-kind", "copyAndTalk");
});

test("the client timeout stops the lookup and does not blame the number", async ({ page }) => {
  const held = await holdTrack(page);
  await openPaused(page);
  await lookUp(page, FAKE.domestic);
  await held.waitForRequests(1);
  await page.clock.runFor(lookup.timeoutMs);
  const view = expectedFailure("clientTimeout", FAKE.domestic, PAUSED_NOW);
  const notice = statusSlot(page).locator('[data-failure-cause="clientTimeout"]');
  await expect(notice).toHaveAttribute("data-guide-key", "noResponse");
  const heading = notice.getByRole("heading", { level: 2 });
  await expect(heading).toHaveText(view.title);
  await expect(heading).toBeFocused();
  await expect(notice.getByRole("alert")).toHaveText(view.reason ?? "");
  await expect(notice.getByRole("alert")).not.toContainText("번호 문제는 아니에요");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/failure-causes.spec.ts`
Expected: FAIL — `18 failed`; each stops at a `[data-status-slot]` / `[data-failure-cause=…]` / `#tracking-invalid-error` locator (element(s) not found): errors still render only the legacy CTA block below the hero.

- [ ] **Step 3: Write the shared slot parts**

Create `components/status-slot/SlotParts.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { ActionView, ActionWeight, NoticeView, NumberView, ResultAction, Tone, TrackingViewModel } from "@/lib/tracking/types";

// Transitional parts shared by the R2 status slot and CustomerCta (deleted by S07 with components/status-slot/). Light surface inside
// the lookup card. Weights come from the view; one filled button per screen is the view's rule (spec §13 버튼 계층).

/** Actions the customer can take alone; on error screens the card shows them and the CTA block shows 톡톡 (spec §16 item 3). */
export const RECOVERY_KINDS: ReadonlySet<ActionView["kind"]> = new Set<ActionView["kind"]>(["fixNumber", "retry"]);

export const TONE_BORDER: Readonly<Record<Tone, string>> = {
  neutral: "border-slate-200",
  progress: "border-cyan-300",
  waiting: "border-slate-300",
  attention: "border-amber-400",
  problem: "border-rose-400",
  done: "border-emerald-400"
};

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2";
const WEIGHT_CLASS: Readonly<Record<ActionWeight, string>> = {
  primary: `inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 ${FOCUS_RING}`,
  secondary: `inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-400 bg-white px-4 text-sm font-semibold text-slate-900 hover:border-slate-700 ${FOCUS_RING}`,
  text: `inline-flex min-h-6 items-center text-sm font-semibold text-cyan-800 underline underline-offset-2 hover:text-cyan-950 ${FOCUS_RING}`
};
const COOLDOWN_TICK_MS = 1000;

export function actionClassName(weight: ActionWeight): string {
  return `${WEIGHT_CLASS[weight]} aria-disabled:cursor-not-allowed aria-disabled:opacity-60`;
}

type ExternalTarget = Extract<ResultAction, { kind: "openedExternal" }>["target"];

function externalTarget(kind: ActionView["kind"]): ExternalTarget {
  if (kind === "talk" || kind === "copyAndTalk") return "talk";
  if (kind === "callDriver") return "driver";
  if (kind === "carrierOfficial") return "carrier";
  return "store";
}

function inPageAction(kind: ActionView["kind"]): ResultAction | null {
  if (kind === "fixNumber") return { kind: "fixNumber" };
  if (kind === "retry") return { kind: "retry" };
  if (kind === "cancel") return { kind: "cancel" };
  return null;
}

/** Seconds left before a 429 retry may run: the view's cooldown counted down (spec §5: 10 s, then enabled; no automatic retry). */
function useCooldown(seconds: number | null): number {
  const [remaining, setRemaining] = useState(seconds ?? 0);
  useEffect(() => {
    if (seconds === null || seconds <= 0) return undefined;
    const endsAt = Date.now() + seconds * 1000;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) window.clearInterval(timer);
    }, COOLDOWN_TICK_MS);
    return () => window.clearInterval(timer);
  }, [seconds]);
  return remaining;
}

export function ActionControl({
  action,
  onAction
}: {
  readonly action: ActionView;
  readonly onAction: (action: ResultAction) => void;
}): React.JSX.Element | null {
  const remaining = useCooldown(action.cooldownSeconds);
  if (action.href !== null) {
    return (
      <a
        href={action.href}
        target={action.external ? "_blank" : undefined}
        rel={action.external ? "noopener noreferrer" : undefined}
        aria-label={action.external ? `${action.label} 새 창으로 열기` : undefined}
        data-action-kind={action.kind}
        data-action-weight={action.weight}
        className={actionClassName(action.weight)}
        onClick={() => onAction({ kind: "openedExternal", target: externalTarget(action.kind) })}
      >
        {action.label}
      </a>
    );
  }
  const result = inPageAction(action.kind);
  if (result === null) return null;
  const cooling = remaining > 0;
  return (
    <button
      type="button"
      aria-disabled={cooling || undefined}
      data-action-kind={action.kind}
      data-action-weight={action.weight}
      className={actionClassName(action.weight)}
      onClick={() => {
        if (!cooling) onAction(result);
      }}
    >
      {action.label}
      {cooling ? (
        <span aria-hidden="true" className="ml-1 tabular-nums">
          ({remaining})
        </span>
      ) : null}
    </button>
  );
}

export function NumberLine({ number, carrierLabel }: { readonly number: NumberView; readonly carrierLabel: string }): React.JSX.Element {
  return (
    <p className="break-keep text-sm text-slate-600">
      조회번호 <span className="whitespace-nowrap font-mono font-semibold tabular-nums text-slate-900">{number.grouped}</span> · {carrierLabel}
    </p>
  );
}

/** '확인 필요 · 2/4' renders as two spans so the state word stays a text of its own. */
export function ChipLine({ chip }: { readonly chip: string }): React.JSX.Element {
  const [state, position] = chip.split(" · ");
  return (
    <p className="text-sm font-semibold text-slate-700">
      <span>{state}</span>
      {position ? <span className="tabular-nums"> · {position}</span> : null}
    </p>
  );
}

/** The in-card '안내' line (spec §6: a state notice lives inside the card, never between the blocks). Never a live region. */
export function NoticeLine({ notice }: { readonly notice: NoticeView }): React.JSX.Element {
  return (
    <p data-notice-kind={notice.kind} className="break-keep rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800">
      <span className="font-semibold">안내</span> {notice.title} · {notice.body}
    </p>
  );
}

export function AuxiliaryLine({
  line,
  onAction
}: {
  readonly line: NonNullable<TrackingViewModel["auxiliaryLine"]>;
  readonly onAction: (action: ResultAction) => void;
}): React.JSX.Element {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 break-keep text-sm text-slate-700">
      <span>{line.text}</span>
      {line.action ? <ActionControl action={line.action} onAction={onAction} /> : null}
    </p>
  );
}
```

- [ ] **Step 4: Write the failure card, the worry line and the copy-and-talk button**

Create `components/status-slot/FailureNotice.tsx`:

```tsx
"use client";

import { INVALID_NUMBER_ERROR_ID } from "@/components/TrackingForm";
import { ActionControl, AuxiliaryLine, ChipLine, NoticeLine, NumberLine, RECOVERY_KINDS, TONE_BORDER } from "@/components/status-slot/SlotParts";
import type { ActionView, FailureCause, ResultAction, TrackingViewModel } from "@/lib/tracking/types";

// Transitional (S07 moves it to components/result/FailureCard.tsx). The card names the cause and holds the customer's own recovery
// action; 톡톡 is the first link of the CTA block below. role="alert" is only on the error sentence, never on the focused heading.

export interface FailureNoticeProps {
  readonly view: TrackingViewModel;
  readonly cause: FailureCause;
  readonly headingRef: React.RefObject<HTMLHeadingElement | null>;
  readonly onAction: (action: ResultAction) => void;
}

export function FailureNotice({ view, cause, headingRef, onAction }: FailureNoticeProps): React.JSX.Element {
  const recovery = [view.nextAction.primary, ...view.nextAction.secondary].filter(
    (action): action is ActionView => action !== null && RECOVERY_KINDS.has(action.kind)
  );
  const invalid = view.guideKey === "invalidNumber";
  return (
    <div
      data-failure-cause={cause}
      data-guide-key={view.guideKey}
      data-overdue="false"
      data-tone={view.tone}
      className={`space-y-3 rounded-2xl border-2 bg-white p-4 text-slate-900 ${TONE_BORDER[view.tone]}`}
    >
      <NumberLine number={view.number} carrierLabel={view.carrier.barLabel} />
      {view.chip ? <ChipLine chip={view.chip} /> : null}
      {invalid ? (
        // The input keeps focus and points here with aria-describedby (spec §5 INVALID).
        <p id={INVALID_NUMBER_ERROR_ID} role="alert" className="break-keep text-base font-semibold leading-7">
          {view.title}
        </p>
      ) : (
        <>
          <h2 ref={headingRef} tabIndex={-1} className="break-keep text-xl font-bold leading-snug outline-none">
            {view.title}
          </h2>
          {view.reason ? (
            <p role="alert" className="break-keep text-sm leading-6 text-slate-800">
              {view.reason}
            </p>
          ) : null}
        </>
      )}
      {view.notice ? <NoticeLine notice={view.notice} /> : null}
      {recovery.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {recovery.map((action) => (
            <ActionControl key={`${action.kind}-${action.weight}`} action={action} onAction={onAction} />
          ))}
        </div>
      ) : null}
      {view.auxiliaryLine ? <AuxiliaryLine line={view.auxiliaryLine} onAction={onAction} /> : null}
    </div>
  );
}
```

Create `components/status-slot/WorryLine.tsx`:

```tsx
import { actionClassName } from "@/components/status-slot/SlotParts";
import type { WorryLineView } from "@/lib/tracking/types";

// Transitional (deleted by S07). The worry date bound to a 톡톡 text link (spec §6 지금 할 일). `showTalk` is false when the block
// already has 톡톡 as its filled primary, so each block carries one plain 톡톡 link.

export function WorryLine({ worry, showTalk }: { readonly worry: WorryLineView; readonly showTalk: boolean }): React.JSX.Element {
  return (
    <p data-worry-line="true" className="flex flex-wrap items-center gap-x-3 gap-y-1 break-keep text-sm leading-6 text-slate-800">
      <span>{worry.text}</span>
      {showTalk && worry.talk.href !== null ? (
        <a
          href={worry.talk.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${worry.talk.label} 새 창으로 열기`}
          data-action-kind={worry.talk.kind}
          data-action-weight={worry.talk.weight}
          className={actionClassName(worry.talk.weight)}
        >
          {worry.talk.label}
        </a>
      ) : null}
    </p>
  );
}
```

Create `components/status-slot/CopyInquiryButton.tsx`:

```tsx
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { actionClassName } from "@/components/status-slot/SlotParts";
import { copyText } from "@/lib/clipboard";
import type { CopyOutcome } from "@/lib/clipboard";
import type { ActionWeight } from "@/lib/tracking/types";

// Transitional (S07 uses S05's CopyButton mode "copyAndOpen"). One click copies the inquiry text and opens 톡톡 in a new tab. When the
// browser refuses the clipboard (in-app webviews), a read-only, pre-selected box shows the same text (roadmap Review Focus 3).
const FALLBACK_LABEL = "아래 문의 내용을 길게 눌러 복사해 주세요.";

export function CopyInquiryButton({
  label,
  href,
  text,
  weight,
  onCopied
}: {
  readonly label: string;
  readonly href: string;
  readonly text: string;
  readonly weight: ActionWeight;
  readonly onCopied?: (outcome: CopyOutcome) => void;
}): React.JSX.Element {
  const [outcome, setOutcome] = useState<CopyOutcome | null>(null);
  const boxId = useId();
  const boxRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (outcome !== "fallback") return;
    boxRef.current?.focus();
    boxRef.current?.select();
  }, [outcome]);

  return (
    <div className="w-full space-y-2">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${label} 새 창으로 열기`}
        data-action-kind="copyAndTalk"
        data-action-weight={weight}
        className={actionClassName(weight)}
        onClick={() => {
          void copyText(text).then((result) => {
            setOutcome(result);
            onCopied?.(result);
          });
        }}
      >
        {label}
      </a>
      <p data-inquiry-preview="true" className="break-words font-mono text-xs leading-5 text-slate-600">
        {text}
      </p>
      {outcome === "fallback" ? (
        <div>
          <label htmlFor={boxId} className="block break-keep text-sm text-slate-700">
            {FALLBACK_LABEL}
          </label>
          <textarea
            id={boxId}
            ref={boxRef}
            readOnly
            rows={3}
            value={text}
            data-copy-fallback="true"
            className="mt-1 w-full resize-none rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          />
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Make `CustomerCta` view-driven and put errors in the slot**

Replace the whole content of `components/CustomerCta.tsx` with (the `floating` and `result` variants are the pre-S04 code, unchanged; `result` goes away in Task 6):

```tsx
"use client";

import { useId } from "react";
import { ExternalLink, MessageCircle, ShoppingBag, Store } from "lucide-react";
import { ReturnLinkButton } from "@/components/ReturnLinkButton";
import { CopyInquiryButton } from "@/components/status-slot/CopyInquiryButton";
import { ActionControl, RECOVERY_KINDS, actionClassName } from "@/components/status-slot/SlotParts";
import { WorryLine } from "@/components/status-slot/WorryLine";
import { COUPANG_STORE_URL, NAVER_STORE_URL, TALK_URL } from "@/lib/storefront";
import type { ActionView, CarrierChoiceView, HelpItemView, ResultAction, StoreLinksView, TrackingViewModel } from "@/lib/tracking/types";
import { cn } from "@/lib/utils";

export type CustomerCtaState = "idle" | "error" | "pending" | "inTransit" | "delivered";
export type ResultCustomerCtaState = Exclude<CustomerCtaState, "idle">;

type LegacyCtaProps =
  | {
      readonly variant: "floating";
      readonly state: "idle";
    }
  | {
      readonly variant: "result";
      readonly state: ResultCustomerCtaState;
    };

type CustomerCtaProps =
  | LegacyCtaProps
  | {
      readonly variant: "view";
      readonly view: TrackingViewModel;
      readonly onAction: (action: ResultAction) => void;
    };

const linkByKey = {
  naver: {
    label: "네이버 스토어 보기",
    href: NAVER_STORE_URL,
    icon: Store,
    className:
      "border-[#03c75a]/55 bg-slate-900/75 text-slate-100 hover:border-[#03c75a]/90 hover:bg-[#03c75a]/15"
  },
  coupang: {
    label: "쿠팡 스토어 보기",
    href: COUPANG_STORE_URL,
    icon: ShoppingBag,
    className:
      "border-amber-300/55 bg-amber-300/10 text-amber-50 hover:border-amber-200/90 hover:bg-amber-300/20"
  },
  talk: {
    label: "톡톡으로 문의하기",
    href: TALK_URL,
    icon: MessageCircle,
    className:
      "border-[#03c75a]/70 bg-[#03c75a] text-slate-950 shadow-[0_10px_24px_rgba(3,199,90,0.24)] hover:bg-emerald-400"
  }
} as const;

type CtaLinkKey = keyof typeof linkByKey;

type CtaContent = {
  readonly title: string;
  readonly description: string;
  readonly links: readonly CtaLinkKey[];
};

const contentByState: Record<CustomerCtaState, CtaContent> = {
  idle: {
    title: "문의가 필요하신가요?",
    description: "주문·상품 문의는 톡톡으로 남겨 주세요.",
    links: ["talk"]
  },
  error: {
    title: "조회가 잘되지 않나요?",
    description: "조회번호를 다시 확인하거나 톡톡으로 문의하세요.",
    links: ["talk"]
  },
  pending: {
    title: "아직 국내 배송 정보가 없어요",
    description: "구매한 쇼핑몰을 선택하거나 톡톡으로 문의하세요.",
    links: ["talk", "naver", "coupang"]
  },
  inTransit: {
    title: "배송이 진행 중이에요",
    description: "위 배송 내역에서 위치를 확인하세요.",
    links: ["talk"]
  },
  delivered: {
    title: "배송이 완료됐어요",
    description: "재구매나 다른 상품이 필요하면 스토어를 둘러보세요.",
    links: ["naver", "coupang", "talk"]
  }
};

const borderByState: Record<CustomerCtaState, string> = {
  idle: "border-emerald-300/30",
  error: "border-rose-300/35",
  pending: "border-amber-300/35",
  inTransit: "border-cyan-300/30",
  delivered: "border-emerald-300/35"
};

// The render type stays wide so Task 6 can drop the public "result" variant without touching this body.
const LegacyCta = ({ variant, state }: { readonly variant: LegacyCtaProps["variant"]; readonly state: CustomerCtaState }) => {
  const isFloating = variant === "floating";
  const content = contentByState[state];
  const hasAffiliateLink = content.links.includes("coupang");

  return (
    <nav
      aria-label="배송 및 기타 문의"
      data-cta-state={state}
      data-cta-variant={variant}
      className={cn(
        "pointer-events-auto rounded-2xl border bg-slate-950/95 shadow-[0_18px_45px_rgba(2,6,23,0.5)] backdrop-blur-xl",
        isFloating
          ? "mt-4 p-3 sm:ml-auto sm:w-80"
          : "p-4 sm:p-5",
        borderByState[state]
      )}
    >
      <div className={cn("space-y-1", !isFloating && "max-w-3xl")}>
        <p className="text-xs font-semibold text-emerald-200">배송 및 기타 문의</p>
        <h2 className={cn("font-semibold text-slate-50", isFloating ? "text-base" : "text-lg sm:text-xl")}>{content.title}</h2>
        <p className="break-keep text-sm leading-6 text-slate-300">{content.description}</p>
      </div>

      <div
        className={cn(
          "mt-3 grid gap-2",
          content.links.length === 3 ? "sm:grid-cols-3" : "sm:max-w-md",
          isFloating && "grid-cols-1"
        )}
      >
        {content.links.map((key) => {
          const link = linkByKey[key];
          const Icon = link.icon;
          const isDeliveredTalk = state === "delivered" && key === "talk";

          return (
            <a
              key={key}
              href={link.href}
              target="_blank"
              rel={key === "coupang" ? "sponsored nofollow noopener noreferrer" : "noopener noreferrer"}
              aria-label={`${link.label} 새 창으로 열기`}
              className={cn(
                "inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/80",
                link.className,
                isDeliveredTalk && "border-slate-600 bg-slate-900/80 text-slate-200 shadow-none hover:border-slate-500 hover:bg-slate-800"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{link.label}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
            </a>
          );
        })}
      </div>
      {hasAffiliateLink ? (
        <p className="mt-3 break-keep text-xs leading-5 text-slate-300">
          쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.
        </p>
      ) : null}
    </nav>
  );
};

// ---- View-driven "지금 할 일" block (S04; deleted by S07 with the file) ----

/** Help items this block shows inline ('받지 못하셨나요?'); StatusSlot leaves them out of its help list. */
export const INLINE_HELP_IDS: ReadonlySet<string> = new Set(["undelivered"]);
const RENDERED_SEPARATELY: ReadonlySet<ActionView["kind"]> = new Set<ActionView["kind"]>(["copyReturnLink", "undeliveredHelp"]);
const CARRIER_CHOICE_LEGEND = "택배사 선택";
const UNLABELLED_BLOCK_NAME = "지금 할 일";

/** Actions of the block in view order. On errors the card holds [번호 수정]/[다시 조회], so the block's first link is 톡톡. */
function ctaActions(view: TrackingViewModel): readonly ActionView[] {
  const listed = [view.nextAction.primary, ...view.nextAction.secondary].filter(
    (action): action is ActionView =>
      action !== null && !RENDERED_SEPARATELY.has(action.kind) && !(view.mode === "error" && RECOVERY_KINDS.has(action.kind))
  );
  // One plain 톡톡 link per block: the worry line carries it unless 톡톡 is the filled primary (spec §6 걱정 기준 → 톡톡).
  if (view.nextAction.worry === null) return listed;
  return listed.filter((action) => action.kind !== "talk" || action.weight === "primary");
}

/** Disclosure first, then the links (spec §8; isAffiliate alone decides rel="sponsored nofollow"). */
function StoreLinks({ stores }: { readonly stores: StoreLinksView }): React.JSX.Element {
  return (
    <div data-affiliate-group={stores.placement} className="space-y-2">
      {stores.disclosure ? (
        <p data-affiliate-disclosure="coupang" className="break-keep text-xs leading-5 text-slate-600">
          {stores.disclosure}
        </p>
      ) : null}
      {stores.intro ? <p className="break-keep text-sm text-slate-800">{stores.intro}</p> : null}
      <div className="flex flex-wrap gap-2">
        {stores.links.map((link) => (
          <a
            key={link.channel}
            href={link.href}
            target="_blank"
            rel={link.isAffiliate ? "sponsored nofollow noopener noreferrer" : "noopener noreferrer"}
            aria-label={`${link.label} 새 창으로 열기`}
            data-link-placement={stores.placement}
            data-action-kind="store"
            data-action-weight={link.weight}
            className={actionClassName(link.weight)}
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function CarrierChoices({
  choices,
  onAction
}: {
  readonly choices: readonly CarrierChoiceView[];
  readonly onAction: (action: ResultAction) => void;
}): React.JSX.Element {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-slate-900">{CARRIER_CHOICE_LEGEND}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((choice) => (
          <button
            key={choice.code}
            type="button"
            data-carrier-choice={choice.code}
            className={actionClassName("secondary")}
            onClick={() => onAction({ kind: "chooseCarrier", carrier: choice.code })}
          >
            {choice.name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function UndeliveredHelp({ summary, help }: { readonly summary: string; readonly help: HelpItemView }): React.JSX.Element {
  return (
    <details className="rounded-xl border border-slate-200 p-3 text-sm text-slate-800">
      <summary className="cursor-pointer font-semibold text-cyan-800">{summary}</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {help.body.map((line) => (
          <li key={line} className="break-keep">
            {line}
          </li>
        ))}
      </ul>
    </details>
  );
}

function CtaAction({
  action,
  view,
  onAction
}: {
  readonly action: ActionView;
  readonly view: TrackingViewModel;
  readonly onAction: (action: ResultAction) => void;
}): React.JSX.Element | null {
  if (action.kind === "copyAndTalk" && action.href !== null && view.inquiryCopy !== null) {
    return (
      <CopyInquiryButton
        label={action.label}
        href={action.href}
        text={view.inquiryCopy}
        weight={action.weight}
        onCopied={(outcome) => onAction({ kind: "copied", what: "inquiry", outcome })}
      />
    );
  }
  return <ActionControl action={action} onAction={onAction} />;
}

function ViewCta({ view, onAction }: { readonly view: TrackingViewModel; readonly onAction: (action: ResultAction) => void }): React.JSX.Element {
  const headingId = useId();
  const next = view.nextAction;
  const actions = ctaActions(view);
  const all = [next.primary, ...next.secondary];
  const talkIsPrimary = actions.some((action) => action.kind === "talk" && action.weight === "primary");
  const storesLead = view.revenue.stores === "ctaLead";
  const undelivered = all.find((action) => action?.kind === "undeliveredHelp") ?? null;
  const undeliveredHelp = view.help.find((item) => item.id === "undelivered") ?? null;
  const showReturnLink = view.mode === "settled" || all.some((action) => action?.kind === "copyReturnLink");
  return (
    <section
      data-cta-state={view.ctaState}
      aria-labelledby={next.heading ? headingId : undefined}
      aria-label={next.heading ? undefined : UNLABELLED_BLOCK_NAME}
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900"
    >
      {next.heading ? (
        <h3 id={headingId} className="break-keep text-base font-bold">
          {next.heading}
        </h3>
      ) : null}
      <p className="break-keep text-sm leading-6 text-slate-800">{next.sentence}</p>
      {storesLead && next.stores ? <StoreLinks stores={next.stores} /> : null}
      {actions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          {actions.map((action) => (
            <CtaAction key={`${action.kind}-${action.weight}`} action={action} view={view} onAction={onAction} />
          ))}
        </div>
      ) : null}
      {next.carrierChoices ? <CarrierChoices choices={next.carrierChoices} onAction={onAction} /> : null}
      {next.worry ? <WorryLine worry={next.worry} showTalk={!talkIsPrimary} /> : null}
      {next.note ? <p className="break-keep text-sm leading-6 text-slate-700">{next.note}</p> : null}
      {!storesLead && next.stores ? <StoreLinks stores={next.stores} /> : null}
      {undelivered && undeliveredHelp ? <UndeliveredHelp summary={undelivered.label} help={undeliveredHelp} /> : null}
      {showReturnLink ? <ReturnLinkButton key={view.returnLink} number={view.number.raw} carrier={view.carrier.code} /> : null}
    </section>
  );
}

export const CustomerCta = (props: CustomerCtaProps) =>
  props.variant === "view" ? <ViewCta view={props.view} onAction={props.onAction} /> : <LegacyCta {...props} />;
```

Replace the whole content of `components/status-slot/StatusSlot.tsx` with:

```tsx
"use client";

import { CustomerCta, INLINE_HELP_IDS } from "@/components/CustomerCta";
import { FailureNotice } from "@/components/status-slot/FailureNotice";
import { LoadingTimeline } from "@/components/status-slot/LoadingTimeline";
import type { LookupState } from "@/lib/tracking/lookup-state";
import type { HelpItemView, LoadingViewModel, ResultAction, TrackingViewModel } from "@/lib/tracking/types";

// Transitional (contract §11.9; deleted by S07). One slot directly under the lookup form: loading, then the error or the result, in the
// same place (spec §2 원칙 1, §5). Results arrive in Task 6 of the S04 plan.

export interface StatusSlotProps {
  readonly state: LookupState;
  readonly loading: LoadingViewModel | null;
  readonly view: TrackingViewModel | null;
  readonly onAction: (action: ResultAction) => void;
  readonly headingRef: React.RefObject<HTMLHeadingElement | null>;
}

function HelpList({ items }: { readonly items: readonly HelpItemView[] }): React.JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <details key={item.id} open={item.defaultOpen} className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800">
          <summary className="cursor-pointer font-semibold">{item.summary}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {item.body.map((line) => (
              <li key={line} className="break-keep">
                {line}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

export function StatusSlot({ state, loading, view, onAction, headingRef }: StatusSlotProps): React.JSX.Element | null {
  if (state.phase === "idle") return null;
  if (state.phase === "loading") {
    // 0–0.4 s: only the submit label changes (spec §5); from 0.4 s the loading card fills the slot.
    if (loading === null || loading.stage === "instant") return null;
    return (
      <div data-status-slot="loading" className="mt-5">
        <LoadingTimeline loading={loading} onCancel={() => onAction({ kind: "cancel" })} />
      </div>
    );
  }
  if (view === null || state.phase === "settled") return null;
  const help = view.help.filter((item) => !INLINE_HELP_IDS.has(item.id));
  return (
    <div data-status-slot="error" className="mt-5 space-y-4">
      <FailureNotice key={state.settledAt} view={view} cause={state.outcome.cause} headingRef={headingRef} onAction={onAction} />
      <CustomerCta key={`cta-${state.settledAt}`} variant="view" view={view} onAction={onAction} />
      <HelpList items={help} />
    </div>
  );
}
```

In `components/HomePageClient.tsx` delete this block (and the empty line after it):

```tsx
          {/* S04-BRIDGE:error — legacy error CTA block until Task 5 of the S04 plan. */}
          {slotState.phase === "error" ? (
            <section className="mb-8 space-y-3">
              <CustomerCta variant="result" state="error" />
            </section>
          ) : null}

```

- [ ] **Step 6: Run the tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/failure-causes.spec.ts tests/e2e/loading-timeline.spec.ts`
Expected: `27 passed` (18 + 9).
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/tracking.spec.ts tests/privacy.spec.ts tests/e2e`
Expected: 0 failed. The pre-renewal test "error state prioritizes inquiry without store promotion" now finds `[data-cta-state="error"]` inside the slot: heading '조회가 잘되지 않나요?', one link '톡톡으로 문의하기 새 창으로 열기' (the filled primary while approval 3 is pending), no store link.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck; npm run lint`
Expected: 0 failed; typecheck and lint exit 0.

- [ ] **Step 7: Commit**

```powershell
git add components/status-slot/SlotParts.tsx components/status-slot/FailureNotice.tsx components/status-slot/WorryLine.tsx components/status-slot/CopyInquiryButton.tsx components/status-slot/StatusSlot.tsx components/CustomerCta.tsx components/HomePageClient.tsx tests/e2e/failure-causes.spec.ts
git commit -m "feat: show cause-specific errors in the status slot with 톡톡 first and no server wording"
```

---

### Task 6: Results in the slot; the legacy result summary retires

**Files:**
- Create: `components/status-slot/ResultSummary.tsx`
- Modify: `components/status-slot/StatusSlot.tsx` (whole file), `components/HomePageClient.tsx` (imports, the bridge helper, one derived constant, the `S04-BRIDGE:settled` block), `components/CustomerCta.tsx` (drop the legacy `result` variant), `components/RecommendedProducts.tsx` (props, lines 1–40)
- Delete: `components/TrackingResultSummary.tsx`
- Test: `tests/e2e/status-slot.spec.ts` (create); `tests/tracking.spec.ts`, `tests/privacy.spec.ts` (re-point selectors under the approval-2 fallback, rule → assertion map below)

**Interfaces:**
- Consumes: Tasks 3–5 (`deriveStatusView`, `StatusSlot`, `FailureNotice`, `CustomerCta` view variant, `INLINE_HELP_IDS`, `SlotParts`), `resultCopy` (config; station names), view types (`EtaView`, `SpineView`, `StationId`, `LastEventView`); test-only `trackData`, `mockTrack`, `FAKE`, `FIXTURE_NOW` (S01), `siteConfig`, `resultCopy`.
- Produces: `ResultSummary(props: { view; headingRef; onAction }): React.JSX.Element` — status card root with `data-guide-key`, `data-overdue` (`"true"`/`"false"`), `data-tone`; `h2` (`tabIndex={-1}`) with the view title; `<ol aria-label="배송 여정 4구간">` with `data-spine-current`, one `<li>` per station (`data-station`, `data-station-state`, `data-issue`, exactly one `aria-current="step"` unless the position is unknown); the ETA block with `data-eta-kind` (ETA date 32–40 px, the largest text). `StatusSlot` renders `data-status-slot="settled"`: `ResultSummary` → `CustomerCta` (지금 할 일, incl. `ReturnLinkButton`) → last-event line → help details. Below the hero, `<section aria-label="배송 조회 결과" data-ad-exclude="true">` keeps the legacy timelines and the inline `RecommendedProducts` only where `view.revenue.recommendations === "inline"`. `RecommendedProducts` props: `{ context: RecommendationStage }`.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/status-slot.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { deriveStatusView } from "@/components/status-slot/status-view";
import { resultCopy, siteConfig } from "@/config/site.config";
import type { LookupEntry, TrackingViewModel } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";
import { FAKE, FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";
import {
  APP_LIVE_REGIONS,
  CARRIER_LABEL,
  INPUT_LABEL,
  blockThirdParty,
  holdTrack,
  liveRegion,
  lookUp,
  statusSlot
} from "../support/status-slot";

/** Two days after the worry date of the customs-waiting fixture (9/28, Mon): the same state is now overdue (spec §6). */
const OVERDUE_NOW = new Date("2026-09-30T10:00:00+09:00");

function expectedResult(data: TrackResponseData, now: Date = FIXTURE_NOW, entry: LookupEntry = "manual"): TrackingViewModel {
  return deriveStatusView({ kind: "success", request: { number: data.trackingNumber, carrier: "AUTO", entry }, data }, now);
}

async function showResult(page: Page, data: TrackResponseData, now: Date): Promise<void> {
  await page.clock.setFixedTime(now);
  await mockTrack(page, data);
  await page.goto("/");
  await lookUp(page, data.trackingNumber);
  await expect(statusSlot(page)).toHaveAttribute("data-status-slot", "settled");
}

test.beforeEach(async ({ page }) => {
  await blockThirdParty(page);
});

test("a manual result fills the slot under the form: status card, spine and estimate, then 지금 할 일", async ({ page }) => {
  const data = trackData("customsWaiting");
  const view = expectedResult(data);
  await showResult(page, data, FIXTURE_NOW);
  const slot = statusSlot(page);
  const card = slot.locator("[data-guide-key]");
  await expect(card).toHaveAttribute("data-guide-key", view.guideKey);
  await expect(card).toHaveAttribute("data-overdue", "false");
  await expect(card).toHaveAttribute("data-tone", view.tone);
  const heading = card.getByRole("heading", { level: 2 });
  await expect(heading).toHaveText(view.title);
  await expect(heading).toBeFocused();
  await expect(card.getByRole("list", { name: "배송 여정 4구간" }).locator('[aria-current="step"]')).toHaveCount(
    view.spine.current === null ? 0 : 1
  );
  await expect(card.locator("[data-eta-kind]")).toHaveAttribute("data-eta-kind", view.eta.kind);
  await expect(slot.locator("[data-cta-state]")).toHaveAttribute("data-cta-state", view.ctaState);
  const cardBeforeCta = await page.evaluate(() => {
    const status = document.querySelector("#tracking-panel [data-status-slot] [data-guide-key]");
    const cta = document.querySelector("#tracking-panel [data-status-slot] [data-cta-state]");
    return status !== null && cta !== null && (status.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  });
  expect(cardBeforeCta).toBe(true);
  await expect(slot.getByRole("alert")).toHaveCount(0);
  await expect(liveRegion(page)).toHaveText(view.liveMessage);
  await expect(page.locator(APP_LIVE_REGIONS)).toHaveCount(1);
});

test("normal waiting: no filled button, the worry date is bound to the 톡톡 link, the return link is there", async ({ page }) => {
  const data = trackData("customsWaiting");
  const view = expectedResult(data);
  await showResult(page, data, FIXTURE_NOW);
  const slot = statusSlot(page);
  await expect(slot.locator('[data-action-weight="primary"]')).toHaveCount(0);
  const worry = slot.locator("[data-worry-line]");
  await expect(worry).toContainText(view.nextAction.worry?.text ?? "");
  await expect(worry.getByRole("link", { name: `${siteConfig.channels.talk.labels.cta} 새 창으로 열기` })).toHaveAttribute(
    "href",
    siteConfig.channels.talk.url
  );
  await expect(slot.getByRole("button", { name: resultCopy.actionReturnLink })).toBeVisible();
});

test("overdue: the same state turns to '확인 필요' with copy-and-talk first and no recommendations", async ({ page }) => {
  const data = trackData("customsWaiting");
  const view = expectedResult(data, OVERDUE_NOW);
  expect(view.overdue).toBe(true);
  await showResult(page, data, OVERDUE_NOW);
  const slot = statusSlot(page);
  const card = slot.locator("[data-guide-key]");
  await expect(card).toHaveAttribute("data-overdue", "true");
  await expect(card).toHaveAttribute("data-tone", "attention");
  await expect(card.getByRole("heading", { level: 2 })).toHaveText(view.title);
  const primary = slot.locator('[data-action-weight="primary"]');
  await expect(primary).toHaveCount(1);
  await expect(primary).toHaveAttribute("data-action-kind", "copyAndTalk");
  await expect(slot.locator("[data-inquiry-preview]")).toHaveText(view.inquiryCopy ?? "");
  await expect(page.locator("[data-recommended-products]")).toHaveCount(0);
  await expect(page.locator('a[rel~="sponsored"]')).toHaveCount(0);
});

test.describe("copying the inquiry", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("one click copies the inquiry and opens 톡톡 in a new tab", async ({ page }) => {
    const data = trackData("customsWaiting");
    const view = expectedResult(data, OVERDUE_NOW);
    await showResult(page, data, OVERDUE_NOW);
    const link = statusSlot(page).locator('[data-action-kind="copyAndTalk"]');
    await expect(link).toHaveAttribute("href", siteConfig.channels.talk.url);
    await expect(link).toHaveAttribute("target", "_blank");
    const popup = page.waitForEvent("popup");
    await link.click();
    await (await popup).close();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(view.inquiryCopy ?? "");
  });
});

test("blocked clipboard shows the inquiry in a read-only, pre-selected box", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (): Promise<void> => Promise.reject(new DOMException("Write permission denied.", "NotAllowedError")) }
    });
    Object.defineProperty(document, "execCommand", { configurable: true, value: (): boolean => false });
  });
  const data = trackData("customsWaiting");
  const view = expectedResult(data, OVERDUE_NOW);
  await showResult(page, data, OVERDUE_NOW);
  const popup = page.waitForEvent("popup");
  await statusSlot(page).locator('[data-action-kind="copyAndTalk"]').click();
  await (await popup).close();
  const box = statusSlot(page).locator('textarea[data-copy-fallback="true"]');
  await expect(box).toHaveValue(view.inquiryCopy ?? "");
  await expect(box).toHaveAttribute("readonly", "");
  await expect
    .poll(() => box.evaluate((element) => (element instanceof HTMLTextAreaElement ? element.selectionEnd - element.selectionStart : -1)))
    .toBe((view.inquiryCopy ?? "").length);
});

test("deep link: the result takes focus when the customer has not touched the page", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const data = trackData("inTransit");
  await mockTrack(page, data, { delayMs: 300 });
  await page.goto(`/${data.trackingNumber}`);
  const heading = statusSlot(page).locator("[data-guide-key]").getByRole("heading", { level: 2 });
  await expect(heading).toHaveText(expectedResult(data, FIXTURE_NOW, "deepLink").title);
  await expect(heading).toBeFocused();
});

test("deep link: focus stays where the customer is once they interacted; the live region still reads the result", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const held = await holdTrack(page);
  const data = trackData("inTransit");
  await page.goto(`/${data.trackingNumber}`);
  await held.waitForRequests(1);
  const input = page.getByLabel(INPUT_LABEL, { exact: true });
  await input.click();
  await held.release(0, data);
  await expect(liveRegion(page)).toHaveText(expectedResult(data, FIXTURE_NOW, "deepLink").liveMessage);
  await expect(input).toBeFocused();
});

test("carrier chips look the same number up again with the chosen carrier", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const bodies: unknown[] = [];
  await mockTrack(page, trackData("ambiguous"), { onRequest: (body) => bodies.push(body) });
  await page.goto("/");
  await lookUp(page, FAKE.domestic);
  const chips = statusSlot(page).getByRole("group", { name: "택배사 선택" });
  await expect(chips.getByRole("button")).toHaveCount(5);
  await chips.getByRole("button", { name: "CJ대한통운" }).click();
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1]).toEqual({ trackingNumber: FAKE.domestic, carrierCode: "CJ" });
  await expect(page.getByRole("combobox", { name: CARRIER_LABEL })).toHaveValue("CJ");
});

test("delivered: '받지 못하셨나요?' opens the pickup help inside 지금 할 일", async ({ page }) => {
  await showResult(page, trackData("delivered"), FIXTURE_NOW);
  const help = statusSlot(page).locator('[data-cta-state="delivered"] details', { hasText: resultCopy.actionUndelivered });
  await help.locator("summary").click();
  const lines = siteConfig.help.find((item) => item.id === "undelivered")?.body ?? [];
  expect(lines.length).toBeGreaterThan(0);
  for (const line of lines) await expect(help.getByText(line)).toBeVisible();
});

test("the details below the slot are one result region; the legacy summary is gone", async ({ page }) => {
  await showResult(page, trackData("inTransit"), FIXTURE_NOW);
  const region = page.getByRole("region", { name: "배송 조회 결과" });
  await expect(region).toHaveAttribute("data-ad-exclude", "true");
  await expect(region.getByRole("heading", { name: "국내 배송 진행 상황" })).toBeVisible();
  await expect(page.locator('[data-tracking-result-summary="true"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "국내 배송 중" })).toHaveCount(1);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/status-slot.spec.ts`
Expected: FAIL — `10 failed`: results still render in the legacy section, so `[data-status-slot="settled"]` is never found (the chips test stops at the `group` locator, the last test at `[data-tracking-result-summary]` count 1).

- [ ] **Step 3: Write the result summary and the settled slot**

Create `components/status-slot/ResultSummary.tsx`:

```tsx
"use client";

import { AuxiliaryLine, ChipLine, NoticeLine, NumberLine, TONE_BORDER } from "@/components/status-slot/SlotParts";
import { resultCopy } from "@/config/site.config";
import type { EtaView, ResultAction, SpineView, StationId, TrackingViewModel } from "@/lib/tracking/types";

// Transitional (deleted by S07; ResultView replaces it). Status card, 4-station journey and the arrival estimate, in the spec §6 order.
// The estimate date is the largest text (32–40 px); the spine has exactly one aria-current="step", none before the location is known.

const STATIONS: readonly StationId[] = ["departed", "customs", "domestic", "arrived"];
const STATION_LABELS: Readonly<Record<StationId, string>> = {
  departed: resultCopy.stationDeparted,
  customs: resultCopy.stationCustoms,
  domestic: resultCopy.stationDomestic,
  arrived: resultCopy.stationArrived
};
const SPINE_LABEL = "배송 여정 4구간";
const HANDOFF_PENDING = "인계 대기";
const POSITION_UNKNOWN = "위치 확인 전";

type StationState = "done" | "current" | "todo";

const STATION_CLASS: Readonly<Record<StationState, string>> = {
  done: "border-slate-300 bg-slate-100 text-slate-800",
  current: "border-slate-900 bg-slate-900 font-semibold text-white",
  todo: "border-dashed border-slate-300 bg-white text-slate-600"
};

function stationState(index: number, currentIndex: number): StationState {
  if (currentIndex < 0 || index > currentIndex) return "todo";
  return index === currentIndex ? "current" : "done";
}

function Spine({ spine }: { readonly spine: SpineView }): React.JSX.Element {
  const currentIndex = spine.current === null ? -1 : STATIONS.indexOf(spine.current);
  return (
    <div className="space-y-1">
      <ol aria-label={SPINE_LABEL} data-spine-current={spine.current ?? "none"} className="grid grid-cols-4 gap-1 text-center text-xs">
        {STATIONS.map((station, index) => {
          const state = stationState(index, currentIndex);
          const issue = spine.issue !== null && spine.issue.at === station ? spine.issue : null;
          return (
            <li
              key={station}
              data-station={station}
              data-station-state={state}
              data-issue={issue?.kind}
              aria-current={state === "current" ? "step" : undefined}
              className={`rounded-lg border px-1 py-2 ${STATION_CLASS[state]} ${issue ? "ring-2 ring-amber-400" : ""}`}
            >
              <span className="block break-keep">{STATION_LABELS[station]}</span>
              {state === "current" && spine.handoffPending ? <span className="block">{HANDOFF_PENDING}</span> : null}
              {issue ? <span className="block font-bold">{issue.label}</span> : null}
            </li>
          );
        })}
      </ol>
      {spine.current === null ? <p className="text-xs text-slate-600">{POSITION_UNKNOWN}</p> : null}
    </div>
  );
}

function BigDate({ label, muted = false }: { readonly label: string; readonly muted?: boolean }): React.JSX.Element {
  return (
    <p
      className={`break-keep text-[2rem] font-black leading-none tracking-tight tabular-nums sm:text-[2.5rem] ${
        muted ? "text-slate-500" : "text-slate-950"
      }`}
    >
      {label}
    </p>
  );
}

function Caption({ text }: { readonly text: string | null }): React.JSX.Element | null {
  return text === null ? null : <p className="break-keep text-sm text-slate-600">{text}</p>;
}

function EtaValue({ eta }: { readonly eta: Exclude<EtaView, { kind: "none" }> }): React.JSX.Element {
  switch (eta.kind) {
    case "date":
      return (
        <>
          <BigDate label={eta.date.label} />
          <p>
            <span className="inline-flex rounded-full bg-slate-900 px-2 py-0.5 text-xs font-bold tabular-nums text-white">D-{eta.dday}</span>
          </p>
          <Caption text={eta.caption} />
        </>
      );
    case "today":
      return (
        <>
          <BigDate label={eta.date.label} />
          <Caption text={eta.caption} />
        </>
      );
    case "holidayAffected":
      return (
        <>
          <BigDate label={eta.date.label} />
          <p>
            <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">{eta.badge}</span>
          </p>
          <Caption text={eta.caption} />
        </>
      );
    case "overdue":
      return <BigDate label={eta.date.label} muted />;
    case "deliveredOn":
      return <BigDate label={eta.date.label} />;
    case "pendingInfo":
    case "withheld":
    case "unknown":
      return <p className="break-keep text-lg font-bold leading-snug">{eta.text}</p>;
  }
}

function EtaBlock({ eta }: { readonly eta: EtaView }): React.JSX.Element | null {
  if (eta.kind === "none") return null;
  return (
    <div data-eta-kind={eta.kind} className="space-y-2 rounded-xl bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-700">{eta.label}</p>
      <EtaValue eta={eta} />
    </div>
  );
}

export interface ResultSummaryProps {
  readonly view: TrackingViewModel;
  readonly headingRef: React.RefObject<HTMLHeadingElement | null>;
  readonly onAction: (action: ResultAction) => void;
}

export function ResultSummary({ view, headingRef, onAction }: ResultSummaryProps): React.JSX.Element {
  return (
    <div
      data-guide-key={view.guideKey}
      data-overdue={view.overdue ? "true" : "false"}
      data-tone={view.tone}
      className={`space-y-3 rounded-2xl border-2 bg-white p-4 text-slate-900 ${TONE_BORDER[view.tone]}`}
    >
      <NumberLine number={view.number} carrierLabel={view.carrier.barLabel} />
      {view.chip ? <ChipLine chip={view.chip} /> : null}
      <h2 ref={headingRef} tabIndex={-1} className="break-keep text-xl font-bold leading-snug outline-none">
        {view.title}
      </h2>
      {view.reason ? <p className="break-keep text-sm leading-6 text-slate-800">{view.reason}</p> : null}
      {view.notice ? <NoticeLine notice={view.notice} /> : null}
      <Spine spine={view.spine} />
      <EtaBlock eta={view.eta} />
      {view.auxiliaryLine ? <AuxiliaryLine line={view.auxiliaryLine} onAction={onAction} /> : null}
    </div>
  );
}
```

Replace the whole content of `components/status-slot/StatusSlot.tsx` with:

```tsx
"use client";

import { CustomerCta, INLINE_HELP_IDS } from "@/components/CustomerCta";
import { FailureNotice } from "@/components/status-slot/FailureNotice";
import { LoadingTimeline } from "@/components/status-slot/LoadingTimeline";
import { ResultSummary } from "@/components/status-slot/ResultSummary";
import type { LookupState } from "@/lib/tracking/lookup-state";
import type { HelpItemView, LastEventView, LoadingViewModel, ResultAction, TrackingViewModel } from "@/lib/tracking/types";

// Transitional (contract §11.9; deleted by S07). One slot directly under the lookup form: loading, then the error or the result, in the
// same place (spec §2 원칙 1, §5). Result order (spec §6): status card → 지금 할 일 → last event → help, all before any store or ad.

export interface StatusSlotProps {
  readonly state: LookupState;
  readonly loading: LoadingViewModel | null;
  readonly view: TrackingViewModel | null;
  readonly onAction: (action: ResultAction) => void;
  readonly headingRef: React.RefObject<HTMLHeadingElement | null>;
}

function LastEventLine({ lastEvent }: { readonly lastEvent: LastEventView }): React.JSX.Element {
  return (
    <p data-last-event="true" className="break-keep text-sm text-slate-700">
      {lastEvent.text}
      {lastEvent.original ? <span className="ml-1 text-xs text-slate-500">({lastEvent.original})</span> : null}
    </p>
  );
}

function HelpList({ items }: { readonly items: readonly HelpItemView[] }): React.JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <details key={item.id} open={item.defaultOpen} className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800">
          <summary className="cursor-pointer font-semibold">{item.summary}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {item.body.map((line) => (
              <li key={line} className="break-keep">
                {line}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

export function StatusSlot({ state, loading, view, onAction, headingRef }: StatusSlotProps): React.JSX.Element | null {
  if (state.phase === "idle") return null;
  if (state.phase === "loading") {
    // 0–0.4 s: only the submit label changes (spec §5); from 0.4 s the loading card fills the slot.
    if (loading === null || loading.stage === "instant") return null;
    return (
      <div data-status-slot="loading" className="mt-5">
        <LoadingTimeline loading={loading} onCancel={() => onAction({ kind: "cancel" })} />
      </div>
    );
  }
  if (view === null) return null;
  const help = view.help.filter((item) => !INLINE_HELP_IDS.has(item.id));
  if (state.phase === "error") {
    return (
      <div data-status-slot="error" className="mt-5 space-y-4">
        <FailureNotice key={state.settledAt} view={view} cause={state.outcome.cause} headingRef={headingRef} onAction={onAction} />
        <CustomerCta key={`cta-${state.settledAt}`} variant="view" view={view} onAction={onAction} />
        <HelpList items={help} />
      </div>
    );
  }
  return (
    <div data-status-slot="settled" className="mt-5 space-y-4">
      <ResultSummary key={state.settledAt} view={view} headingRef={headingRef} onAction={onAction} />
      <CustomerCta key={`cta-${state.settledAt}`} variant="view" view={view} onAction={onAction} />
      {view.lastEvent ? <LastEventLine lastEvent={view.lastEvent} /> : null}
      <HelpList items={help} />
    </div>
  );
}
```

- [ ] **Step 4: Retire the legacy result section**

(a) `components/RecommendedProducts.tsx` — replace

```tsx
import type { StatusCode } from "@/lib/types";

type RecommendedProductsProps = {
  readonly statusCode: StatusCode;
  readonly isPending?: boolean;
};
```

with

```tsx
type RecommendedProductsProps = {
  readonly context: RecommendationStage;
};
```

replace

```tsx
export const RecommendedProducts = ({ statusCode, isPending }: RecommendedProductsProps) => {
```

with

```tsx
/** Where the view places inline recommendations on the R2 page (S08 replaces this component). */
export type RecommendationStage = keyof typeof recommendationByStage;

export const RecommendedProducts = ({ context }: RecommendedProductsProps) => {
```

and replace

```tsx
  const stage = isPending || statusCode <= 4 ? "pending" : statusCode === 7 ? "delivered" : "inTransit";
```

with

```tsx
  const stage = context;
```

(b) `components/CustomerCta.tsx` — replace

```tsx
type LegacyCtaProps =
  | {
      readonly variant: "floating";
      readonly state: "idle";
    }
  | {
      readonly variant: "result";
      readonly state: ResultCustomerCtaState;
    };
```

with

```tsx
/** Only the unused floating variant is left for S06 to delete; results use variant "view". */
type LegacyCtaProps = {
  readonly variant: "floating";
  readonly state: "idle";
};
```

(c) `components/HomePageClient.tsx` — replace the import lines

```tsx
import { AssuranceRail } from "@/components/AssuranceRail";
import { CustomerCta } from "@/components/CustomerCta";
import type { ResultCustomerCtaState } from "@/components/CustomerCta";
import { CustomsTimeline } from "@/components/CustomsTimeline";
import { DeliveryTimeline } from "@/components/DeliveryTimeline";
import { LogisticsFlow } from "@/components/LogisticsFlow";
import { RecommendedProducts } from "@/components/RecommendedProducts";
import { ReturnLinkButton } from "@/components/ReturnLinkButton";
import { ServiceGuide } from "@/components/ServiceGuide";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StoreContactPopup } from "@/components/StoreContactPopup";
import { StorefrontShowcase } from "@/components/StorefrontShowcase";
import { TrackingForm } from "@/components/TrackingForm";
import { TrackingResultSummary } from "@/components/TrackingResultSummary";
```

with

```tsx
import { AssuranceRail } from "@/components/AssuranceRail";
import { CustomsTimeline } from "@/components/CustomsTimeline";
import { DeliveryTimeline } from "@/components/DeliveryTimeline";
import { LogisticsFlow } from "@/components/LogisticsFlow";
import { RecommendedProducts } from "@/components/RecommendedProducts";
import type { RecommendationStage } from "@/components/RecommendedProducts";
import { ServiceGuide } from "@/components/ServiceGuide";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StoreContactPopup } from "@/components/StoreContactPopup";
import { StorefrontShowcase } from "@/components/StorefrontShowcase";
import { TrackingForm } from "@/components/TrackingForm";
```

replace

```tsx
// S04-BRIDGE:settled — legacy result section helpers until Task 6 of the S04 plan.
const getResultCustomerCtaState = (data: TrackResponseData): ResultCustomerCtaState => {
  if (data.delivery.ambiguous) return "pending";
  if (data.delivery.lookupUnavailable) return "pending";
  if (data.isPending) return "pending";
  if (data.currentStatusCode === 7) return "delivered";
  return "inTransit";
};
```

with

```tsx
/** Inline recommendations only where the view places them (spec §8); the legacy list knows pending, in transit and delivered. */
const recommendationStageOf = (view: TrackingViewModel | null): RecommendationStage | null => {
  if (view === null || view.mode !== "settled" || view.revenue.recommendations !== "inline") return null;
  const context = view.revenue.recommendationContext;
  return context === "pending" || context === "inTransit" || context === "delivered" ? context : null;
};

// The legacy timelines stay below the slot as the details until S07 moves the history into the result view.
```

replace

```tsx
  const settledData = slotState.phase === "settled" ? slotState.outcome.data : null;
```

with

```tsx
  const settledData = slotState.phase === "settled" ? slotState.outcome.data : null;
  const recommendationStage = recommendationStageOf(slotView);
```

and replace the whole `S04-BRIDGE:settled` block — from the line `          {/* S04-BRIDGE:settled — legacy result section until Task 6 of the S04 plan. */}` through the `          ) : null}` that closes it (the line before `        </div>`) — with:

```tsx
          {settledData ? (
            <section aria-label="배송 조회 결과" data-ad-exclude="true" className="space-y-4 pb-8">
              <section className="space-y-3 pt-3" aria-labelledby="tracking-details-title">
                <div>
                  <h3 id="tracking-details-title" className="text-lg font-bold text-slate-50">상세 진행 내역</h3>
                  <p className="mt-1 text-sm text-slate-400">최근 통관과 국내 배송 내역이 필요한 경우에만 확인하세요.</p>
                </div>
                <div className="grid items-start gap-4 lg:grid-cols-2">
                  <div className="order-2 lg:order-1">
                    <CustomsTimeline events={settledData.customs.events} />
                  </div>
                  <div className="order-1 lg:order-2">
                    <DeliveryTimeline delivery={settledData.delivery} waitingMessage={getDeliveryWaitingMessage(settledData)} />
                  </div>
                </div>
              </section>
              {recommendationStage ? <RecommendedProducts context={recommendationStage} /> : null}
            </section>
          ) : null}
```

(d) Delete the legacy summary: use the Grep tool with pattern `TrackingResultSummary` over `app/`, `components/`, `lib/`. Expected: matches only in `components/TrackingResultSummary.tsx`. Run: `git rm components/TrackingResultSummary.tsx`.

- [ ] **Step 5: Re-point the pre-renewal result assertions (approval-2 fallback)**

Rule → assertion map for the result assertions of `tests/tracking.spec.ts` and `tests/privacy.spec.ts`. "Kept" = byte-identical wording on screen (the `LEGACY_RESULT_COPY` overlay or S03 copy that already equals it); "re-pointed" = same wording, new container; "remapped" = the assertion named a deleted legacy decoration, so the rule it protected is asserted structurally. Task 10 (approval 2) converts the kept copy to hooks.

| Test | Business rule it locks | Old assertion | S04 (approval 2 pending) | Task 10 (approval 2 granted) |
|---|---|---|---|---|
| tracking result leads with delivery date… | 결과 요약: 상태 → 도착 예상 → 통관 예상 보조 | `[data-tracking-result-summary]`, `[data-delivery-estimate]`, `[data-customs-estimate]` | re-pointed: `[data-status-slot="settled"]`, `[data-eta-kind]` | same |
| 〃 | 〃 | heading '통관대기', '배송 완료 예상일', '정상 통관 대기 상태입니다…' | kept (overlay) | `view.title`, `view.eta.label`, `view.nextAction.sentence` from `deriveStatusView` |
| 〃 | 〃 | exact '통관완료 예상일' + /7월 14일/ | kept wording, matched as `/^통관완료 예상일 .*7월 14일/` (one caption element) | caption = `view.eta.caption` |
| 〃 | 진행 표시 | '전체 흐름 한눈에 보기' | remapped: spine `배송 여정 4구간` has one `aria-current="step"` | same |
| an overdue customs estimate is recalculated… | 오래된 예상일 재계산 | '오늘 예상' customs badge, '현재 통관 상태를 반영해 예상일을 다시 계산했습니다.' | remapped: the recalculated dates '7월 23일 (목)' / '7월 20일 (월)' visible and '7월 17일 (금)' absent (kept) | same dates + heading from `view.title` |
| pickup status… | 픽업 문구, 예상일 우선 | heading, reason, sentence, '배송 완료 예상일', '통관 완료일' | kept (overlay); page clock pinned to 7/14 16:00 KST (the client now judges stale with its clock, spec §6) | `view.*` fields |
| user can choose a representative domestic carrier | 택배사 선택과 공식 링크 | region '배송 조회 결과' + '한진택배' + '한진택배 공식 배송조회' link | unchanged (the details region keeps the name and the timeline link) | unchanged |
| error state prioritizes inquiry… | 오류 → 문의 우선·스토어 0 | `[data-cta-state="error"]` heading, 톡톡 link, no naver | unchanged | unchanged |
| pending state offers inquiry and purchase-channel choices | 도착 전 → 문의 + 구매처, 고지 | `[data-tracking-result-summary]` | re-pointed; every string kept (S03 copy equals it) | `view.*` + `disclosures.coupang` |
| in-transit state keeps shopping links out of the primary flow | 배송 중 → 쇼핑 링크 주 흐름 밖 | heading, '배송 완료 예상일', sentence | kept (overlay), re-pointed | `view.*` |
| 〃 | 〃 | `[data-motion-visual="result"]` | removed: decoration of the deleted summary (motion rules stay in the home motion tests) | — |
| 〃 | 〃 | link '기타 문의는 톡톡으로 문의하기' | removed: duplicate of the CTA 톡톡 link assertion in the same test | — |
| 〃 | 〃 | list '배송 진행 구간' with '국내 배송' | remapped: spine current station contains '국내 배송' | same |
| delivered state leads with store choices | 완료 → 스토어 선두 | `[data-tracking-result-summary]`, '배송 완료일', sentence | re-pointed; kept (ETA label `deliveredOn`, overlay sentence) | `view.*` |
| privacy: a stale shipment shows a verification prompt | 오래된 이력 → 예상일 대신 확인 안내 | '배송 이력 확인 필요', exact '확인 필요', no '오늘 예상', '마지막 처리 이후 오래 지났습니다' | re-pointed; kept (overlay ETA text and sentence; the chip's state word is its own span) | `[data-eta-kind="withheld"]` + `view.*` |

Apply the edits (Edit tool; each old block is unique in its file):

In `tests/tracking.spec.ts` replace

```ts
  const summary = page.locator('[data-tracking-result-summary="true"]');
  const deliveryEstimate = summary.locator('[data-delivery-estimate="true"]');
  await expect(summary.getByRole("heading", { name: "통관대기" })).toBeVisible();
  await expect(deliveryEstimate.getByText("배송 완료 예상일", { exact: true })).toBeVisible();
  await expect(deliveryEstimate.getByText(/7월 17일/)).toBeVisible();
  const customsEstimate = deliveryEstimate.locator('[data-customs-estimate="true"]');
  await expect(customsEstimate.getByText("통관완료 예상일", { exact: true })).toBeVisible();
  await expect(customsEstimate.getByText(/7월 14일/)).toBeVisible();
  await expect(summary.getByText("정상 통관 대기 상태입니다. 지금은 별도 문의 없이 조금만 기다려 주세요.")).toBeVisible();
  await expect(summary.getByText("전체 흐름 한눈에 보기", { exact: true })).toBeVisible();
  await expect(summary.getByText("전체 진행 단계", { exact: true })).toHaveCount(0);
```

with

```ts
  const summary = page.locator('[data-status-slot="settled"]');
  const deliveryEstimate = summary.locator("[data-eta-kind]");
  await expect(summary.getByRole("heading", { name: "통관대기" })).toBeVisible();
  await expect(deliveryEstimate.getByText("배송 완료 예상일", { exact: true })).toBeVisible();
  await expect(deliveryEstimate.getByText(/7월 17일/)).toBeVisible();
  await expect(deliveryEstimate.getByText(/^통관완료 예상일 .*7월 14일/)).toBeVisible();
  await expect(summary.getByText("정상 통관 대기 상태입니다. 지금은 별도 문의 없이 조금만 기다려 주세요.")).toBeVisible();
  await expect(summary.getByRole("list", { name: "배송 여정 4구간" }).locator('[aria-current="step"]')).toHaveCount(1);
  await expect(summary.getByText("전체 진행 단계", { exact: true })).toHaveCount(0);
```

replace

```ts
  const summary = page.locator('[data-tracking-result-summary="true"]');
  await expect(summary.getByRole("heading", { name: "통관대기" })).toBeVisible();
  await expect(summary.getByText("7월 23일 (목)")).toBeVisible();
  await expect(summary.getByText("7월 20일 (월)")).toBeVisible();
  await expect(summary.getByText("오늘 예상")).toBeVisible();
  await expect(summary.getByText("현재 통관 상태를 반영해 예상일을 다시 계산했습니다.")).toBeVisible();
  await expect(summary.getByText("7월 17일 (금)")).toHaveCount(0);
```

with

```ts
  const summary = page.locator('[data-status-slot="settled"]');
  await expect(summary.getByRole("heading", { name: "통관대기" })).toBeVisible();
  await expect(summary.getByText("7월 23일 (목)")).toBeVisible();
  await expect(summary.getByText("7월 20일 (월)")).toBeVisible();
  await expect(summary.getByText("7월 17일 (금)")).toHaveCount(0);
```

replace

```ts
  await submitTracking(page);

  const summary = page.locator('[data-tracking-result-summary="true"]');
  const deliveryEstimate = summary.locator('[data-delivery-estimate="true"]');
  await expect(summary.getByRole("heading", { name: "CJ대한통운 기사님 픽업 완료!" })).toBeVisible();
  await expect(summary.getByText("CJ대한통운 기사님이 상품을 인수해 배송 출발을 준비하고 있습니다.")).toBeVisible();
  await expect(summary.getByText("픽업이 완료됐습니다. 배송 이동이 시작되면 현재 위치가 업데이트됩니다.")).toBeVisible();
  await expect(deliveryEstimate.getByText("배송 완료 예상일", { exact: true })).toBeVisible();
  await expect(deliveryEstimate.getByText(/7월 16일/)).toBeVisible();
  const customsEstimate = deliveryEstimate.locator('[data-customs-estimate="true"]');
  await expect(customsEstimate.getByText("통관 완료일", { exact: true })).toBeVisible();
  await expect(customsEstimate.getByText(/7월 14일/)).toBeVisible();
```

with

```ts
  // The client judges stale and overdue with its own clock when a result settles (spec §6): pin it to the fixture's day.
  await page.clock.setFixedTime(new Date("2026-07-14T16:00:00+09:00"));
  await submitTracking(page);

  const summary = page.locator('[data-status-slot="settled"]');
  const deliveryEstimate = summary.locator("[data-eta-kind]");
  await expect(summary.getByRole("heading", { name: "CJ대한통운 기사님 픽업 완료!" })).toBeVisible();
  await expect(summary.getByText("CJ대한통운 기사님이 상품을 인수해 배송 출발을 준비하고 있습니다.")).toBeVisible();
  await expect(summary.getByText("픽업이 완료됐습니다. 배송 이동이 시작되면 현재 위치가 업데이트됩니다.")).toBeVisible();
  await expect(deliveryEstimate.getByText("배송 완료 예상일", { exact: true })).toBeVisible();
  await expect(deliveryEstimate.getByText(/7월 16일/)).toBeVisible();
  await expect(deliveryEstimate.getByText(/^통관 완료일 .*7월 14일/)).toBeVisible();
```

replace

```ts
  const cta = page.locator('[data-cta-state="pending"]');
  const summary = page.locator('[data-tracking-result-summary="true"]');
```

with

```ts
  const cta = page.locator('[data-cta-state="pending"]');
  const summary = page.locator('[data-status-slot="settled"]');
```

replace

```ts
  const cta = page.locator('[data-cta-state="inTransit"]');
  const summary = page.locator('[data-tracking-result-summary="true"]');
  await expect(summary.getByRole("heading", { name: "국내 배송 중" })).toBeVisible();
  await expect(summary.getByText("배송 완료 예상일", { exact: true })).toBeVisible();
  await expect(summary.getByText("배송 중입니다. 문자로 안내된 배송 예정 시간을 확인해 주세요.")).toBeVisible();
  await expect(summary.locator('[data-motion-visual="result"]')).toBeVisible();
  await expect(summary.getByRole("link", { name: "기타 문의는 톡톡으로 문의하기 새 창으로 열기" })).toBeVisible();
  await expect(summary.getByRole("list", { name: "배송 진행 구간" }).getByText("국내 배송", { exact: true })).toBeVisible();
```

with

```ts
  const cta = page.locator('[data-cta-state="inTransit"]');
  const summary = page.locator('[data-status-slot="settled"]');
  await expect(summary.getByRole("heading", { name: "국내 배송 중" })).toBeVisible();
  await expect(summary.getByText("배송 완료 예상일", { exact: true })).toBeVisible();
  await expect(summary.getByText("배송 중입니다. 문자로 안내된 배송 예정 시간을 확인해 주세요.")).toBeVisible();
  await expect(summary.getByRole("list", { name: "배송 여정 4구간" }).locator('[aria-current="step"]')).toContainText("국내 배송");
```

and replace

```ts
  const cta = page.locator('[data-cta-state="delivered"]');
  const summary = page.locator('[data-tracking-result-summary="true"]');
```

with

```ts
  const cta = page.locator('[data-cta-state="delivered"]');
  const summary = page.locator('[data-status-slot="settled"]');
```

In `tests/privacy.spec.ts` replace

```ts
  const summary = page.locator('[data-tracking-result-summary="true"]');
  await expect(summary.getByText("배송 이력 확인 필요")).toBeVisible();
```

with

```ts
  const summary = page.locator('[data-status-slot="settled"]');
  await expect(summary.getByText("배송 이력 확인 필요")).toBeVisible();
```

Use the Grep tool with pattern `data-tracking-result-summary|data-delivery-estimate|data-customs-estimate|data-motion-visual="result"` over `tests/`. Expected: matches only in `tests/e2e/status-slot.spec.ts` (its "legacy summary is gone" check).

- [ ] **Step 6: Run the tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/status-slot.spec.ts`
Expected: `10 passed`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/tracking.spec.ts tests/privacy.spec.ts tests/e2e`
Expected: 0 failed — including S02's return-link, session-restore and url-privacy suites (the button '다시 볼 링크 복사' now sits in the 지금 할 일 block of every settled result).
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck; npm run lint`
Expected: 0 failed; typecheck and lint exit 0.

- [ ] **Step 7: Commit**

```powershell
git add components/status-slot/ResultSummary.tsx components/status-slot/StatusSlot.tsx components/HomePageClient.tsx components/CustomerCta.tsx components/RecommendedProducts.tsx tests/e2e/status-slot.spec.ts tests/tracking.spec.ts tests/privacy.spec.ts
git commit -m "feat: render results in the status slot from the view model and retire the legacy summary"
```
Expected: one commit including the staged deletion of `components/TrackingResultSummary.tsx`.

---

### Task 7: No stores where the state forbids them — the GAP3-06 table on the page

**Files:**
- Modify: `components/HomePageClient.tsx` (the `showStorefront` constant)
- Modify: `tests/tools/stage-screens.spec.ts` (append four scenarios to `SCENARIOS`)
- Test: `tests/e2e/cta-consistency.spec.ts`

**Interfaces:**
- Consumes: `deriveStatusView` (Task 3), the slot and `CustomerCta` hooks (Tasks 5–6), `channels`, `disclosures` (config), `PROBLEM_GUIDE_KEYS` (S03 types), `GAP3_06_VARIANTS`, `trackData`, `mockTrack`, `FAKE`, `FIXTURE_NOW` (S01), support helpers (Task 4).
- Produces: the header "스토어" anchor, `StorefrontShowcase` and `StoreContactPopup` render only on the idle page; outside 지금 할 일 no store link exists in any result or error state (spec §7–§8: problem states 0, in transit 0, delivered leads inside the block, pending as purchase choices inside the block). Stage screens gain `deeplink-serverError`, `deeplink-rateLimited`, `deeplink-stale`, `deeplink-ambiguous`.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/cta-consistency.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { deriveStatusView } from "@/components/status-slot/status-view";
import { channels, disclosures } from "@/config/site.config";
import { PROBLEM_GUIDE_KEYS } from "@/lib/tracking/types";
import type { ActionView, FailureCause, GuideKey, StoreLinkView } from "@/lib/tracking/types";
import { FAKE, FIXTURE_NOW, GAP3_06_VARIANTS, mockTrack, trackData } from "../fixtures/tracking-fixtures";
import type { FailureFixture } from "../fixtures/tracking-fixtures";
import { blockThirdParty, lookUp, manualRequest, statusSlot } from "../support/status-slot";

const PROBLEM_KEYS: ReadonlySet<GuideKey> = new Set<GuideKey>(PROBLEM_GUIDE_KEYS);
const STORE_HREFS: readonly string[] = [...new Set([...Object.values(channels.naver.urls), ...Object.values(channels.coupang.urls)])];
/** Store links anywhere: the CTA's purchase choices and store lead, the showcase, the popup, and the header's '#storefront' anchor. */
const STORE_LINKS = STORE_HREFS.map((href) => `a[href="${href}"]`).join(", ");
const PAGE_STORE_PLACEMENTS = `${STORE_LINKS}, a[href="#storefront"]`;
/** The five API error codes GAP3-06 counts next to the 12 data variants. */
const ERROR_FIXTURES: ReadonlyArray<readonly [FailureFixture, FailureCause]> = [
  ["invalid400", "invalidNumber"],
  ["upstreamTimeout504", "upstreamTimeout"],
  ["notFound404", "notFound"],
  ["serverError500", "serverError"],
  ["rateLimited429", "rateLimited"]
];

async function precedes(page: Page, first: string, second: string): Promise<boolean> {
  return page.evaluate(
    ([a, b]) => {
      const x = document.querySelector(a);
      const y = document.querySelector(b);
      return x !== null && y !== null && (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    },
    [first, second] as const
  );
}

test.beforeEach(async ({ page }) => {
  await blockThirdParty(page);
  await page.clock.setFixedTime(FIXTURE_NOW);
});

test("the idle page keeps its store shortcuts", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.locator("[data-storefront-showcase]")).toBeVisible();
  await expect(page.locator(PAGE_STORE_PLACEMENTS).first()).toBeAttached();
});

for (const state of GAP3_06_VARIANTS) {
  test(`${state}: status, 지금 할 일, stores and recommendations tell the same story`, async ({ page }) => {
    const data = trackData(state);
    const view = deriveStatusView({ kind: "success", request: manualRequest(data.trackingNumber), data }, FIXTURE_NOW);
    await mockTrack(page, data);
    await page.goto("/");
    await lookUp(page, data.trackingNumber);

    const slot = statusSlot(page);
    await expect(slot.locator("[data-guide-key]")).toHaveAttribute("data-guide-key", view.guideKey);
    const cta = slot.locator("[data-cta-state]");
    await expect(cta).toHaveAttribute("data-cta-state", view.ctaState);
    if (view.nextAction.heading !== null) await expect(cta.getByRole("heading", { level: 3 })).toHaveText(view.nextAction.heading);
    await expect(cta.getByText(view.nextAction.sentence, { exact: true })).toBeVisible();

    const stores = view.nextAction.stores;
    const problem = PROBLEM_KEYS.has(view.guideKey) || view.overdue;
    if (problem || view.guideKey === "inTransit" || stores === null) {
      await expect(page.locator(PAGE_STORE_PLACEMENTS)).toHaveCount(0);
      await expect(page.locator('a[rel~="sponsored"]')).toHaveCount(0);
    } else {
      await expect(cta.locator(STORE_LINKS)).toHaveCount(stores.links.length);
      await expect(page.locator(PAGE_STORE_PLACEMENTS)).toHaveCount(stores.links.length);
      await expect(cta.locator("[data-affiliate-disclosure]")).toHaveText(disclosures.coupang);
      expect(await precedes(page, "#tracking-panel [data-affiliate-disclosure]", '#tracking-panel [data-cta-state] a[rel~="sponsored"]')).toBe(true);
    }
    if (view.guideKey === "delivered") {
      const firstTwo = await cta.getByRole("link").evaluateAll((links) => links.slice(0, 2).map((link) => link.getAttribute("href")));
      expect(firstTwo).toEqual((stores?.links ?? []).map((link) => link.href));
    }
    if (view.guideKey === "stale") {
      await expect(slot.locator("[data-eta-kind]")).toHaveAttribute("data-eta-kind", "withheld");
      await expect(slot.getByText("오늘 예상")).toHaveCount(0);
    }

    const weighted: ReadonlyArray<ActionView | StoreLinkView | null> = [view.nextAction.primary, ...(stores?.links ?? [])];
    const filled = weighted.filter((item) => item !== null && item.weight === "primary").length;
    await expect(slot.locator('[data-action-weight="primary"]')).toHaveCount(filled);
    await expect(page.locator("[data-recommended-products]")).toHaveCount(view.revenue.recommendations === "inline" ? 1 : 0);
  });
}

for (const [fixture, cause] of ERROR_FIXTURES) {
  test(`${fixture}: no store, showcase, popup, recommendation or sponsored link anywhere on the page`, async ({ page }) => {
    const view = deriveStatusView({ kind: "failure", request: manualRequest(FAKE.domestic), cause, consecutiveFailures: 1 }, FIXTURE_NOW);
    expect(view.revenue).toMatchObject({ stores: "none", recommendations: "none", adsAllowed: false });
    await mockTrack(page, fixture);
    await page.goto("/");
    await lookUp(page, FAKE.domestic);
    await expect(statusSlot(page).locator('[data-cta-state="error"]')).toBeVisible();
    await expect(page.locator(PAGE_STORE_PLACEMENTS)).toHaveCount(0);
    await expect(page.locator('a[rel~="sponsored"], [data-recommended-products], [data-storefront-showcase], [data-contact-popup]')).toHaveCount(0);
  });
}
```

- [ ] **Step 2: Run it to verify it fails**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/cta-consistency.spec.ts`
Expected: FAIL — `1 failed, 17 passed`: "delivered: …" fails at `expect(page.locator(PAGE_STORE_PLACEMENTS)).toHaveCount(2)` (received more: the showcase and the header "스토어" anchor still follow the pre-renewal code-7 rule). Every other row already passes after Tasks 4–6 — they are the GAP3-06 lock.

- [ ] **Step 3: Narrow the page-level store placements to the idle page**

In `components/HomePageClient.tsx` replace

```tsx
  // Store link and showcase keep the pre-renewal rule until Task 7 of the S04 plan narrows them to the idle page.
  const showStorefront = idle || settledData?.currentStatusCode === 7;
```

with

```tsx
  // Stores outside 지금 할 일 only on the idle page (spec §7–§8): problem states and in transit show none, delivered leads in the block.
  const showStorefront = idle;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/cta-consistency.spec.ts tests/e2e/status-slot.spec.ts tests/tracking.spec.ts tests/privacy.spec.ts`
Expected: `cta-consistency.spec.ts` `18 passed`; the other files 0 failed (the delivered test keeps its CTA store links; "home offers transparent storefront choices" still sees the showcase on the idle page).

- [ ] **Step 5: Add the S04 stage screens**

In `tests/tools/stage-screens.spec.ts` replace

```ts
  { name: "privacy", path: "/privacy" }
];
```

with

```ts
  { name: "privacy", path: "/privacy" },
  // S04: the status slot's problem and choice states (deep links; the tool pins the page clock to FIXTURE_NOW).
  { name: "deeplink-serverError", path: `/${FAKE.domestic}`, prepare: (page) => mockTrack(page, "serverError500") },
  { name: "deeplink-rateLimited", path: `/${FAKE.domestic}`, prepare: (page) => mockTrack(page, "rateLimited429") },
  { name: "deeplink-stale", path: `/${FAKE.hbl}`, prepare: (page) => mockTrack(page, trackData("stale")) },
  { name: "deeplink-ambiguous", path: `/${FAKE.domestic}`, prepare: (page) => mockTrack(page, trackData("ambiguous")) }
];
```

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/tools/stage-screens.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `55 skipped` (11 scenarios × 5 widths; the tool runs only with `PW_SHOTS`), 0 failed.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```powershell
git add components/HomePageClient.tsx tests/e2e/cta-consistency.spec.ts tests/tools/stage-screens.spec.ts
git commit -m "fix: keep store placements out of every result state and lock GAP3-06 on the page"
```

---

### Task 8: The internal CS helper answers from the same view model

**Files:**
- Create: `lib/cs/mismatch-templates.ts`
- Modify: `components/InternalCsHelper.tsx` (imports lines 17–35, the message constant block, `guide` state, `handleDeliveryLookup`, the guide display block)
- Modify: `lib/cs/mismatch-storage.ts` (line 2, the template-key import), `tests/unit/mismatch-storage.spec.ts` (the template import line)
- Delete: `lib/services/cs-reply-template.ts`
- Test: `tests/internal-cs-helper.spec.ts` (replace the two delivery tests, add one), `tests/unit/mismatch-storage.spec.ts`

**Interfaces:**
- Consumes: `fetchTrack` (Task 2), `classifyFailure`, `deriveTrackingView`, `buildCsReply`, `CsReply` (S03), `siteConfig` (config), `MISMATCH_LEGACY_KEY` (S01); test-only `mockTrack`, `FAKE`, `FIXTURE_NOW` (S01).
- Produces (File Map §10.2): `lib/cs/mismatch-templates.ts` exporting `CUSTOMS_MISMATCH_TEMPLATES` (the three drafts, byte-identical) and `type CustomsMismatchTemplateKey` (contract §11.9 note: "S04 moves it to lib/cs/mismatch-templates.ts"). The helper's delivery tab shows the carrier, the raw number, the view title and `buildCsReply(view).long` in the '고객 안내문' box — a failed lookup gets the CS error template, never the server's message (spec §10 "NOT_FOUND, ambiguous, lookupUnavailable, 오류 템플릿").
- Rule → assertion (the CS helper is staff tooling, not one of the E2E-locked customer rules; spec §16 item 2 names the customer suites): "copy-ready delivery reply from an invoice" and "pending invoices without saving a guide" keep their rules; the pre-renewal sentence is replaced by equality with `buildCsReply` over the same view (`toHaveValue(expected.long)`), the carrier and raw-number checks stay, the no-save check stays. If the operator reads approval 2 as covering this internal suite, run this task after approval 2 and list it under Task 10's SKIP note.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/mismatch-storage.spec.ts` replace the line

```ts
import { CUSTOMS_MISMATCH_TEMPLATES, type CustomsMismatchTemplateKey } from "@/lib/services/cs-reply-template";
```

with

```ts
import { CUSTOMS_MISMATCH_TEMPLATES, type CustomsMismatchTemplateKey } from "@/lib/cs/mismatch-templates";
```

In `tests/internal-cs-helper.spec.ts`:

(a) Replace the fixture import line `import { FAKE, FIXTURE_NOW } from "./fixtures/tracking-fixtures";` (S01 Task 8) with:

```ts
import { siteConfig } from "@/config/site.config";
import { buildCsReply } from "@/lib/cs/cs-reply";
import type { CsReply } from "@/lib/cs/cs-reply";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import type { LookupOutcome } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";
import { FAKE, FIXTURE_NOW, mockTrack } from "./fixtures/tracking-fixtures";
```

(b) Replace the two tests "internal helper generates a copy-ready delivery reply from an invoice" and "internal helper handles pending domestic invoices without saving a guide" (from the first `test("internal helper generates a copy-ready delivery reply from an invoice"` line through the `});` that closes the pending test) with:

```ts
/** The helper judges stale and overdue with the staff member's clock, like the customer page: pin it to the fixtures' day. */
const CS_NOW = new Date("2026-05-31T12:00:00+09:00");
const CS_REQUEST = { number: FAKE.domestic, carrier: "AUTO", entry: "manual" } as const;

const IN_TRANSIT: TrackResponseData = {
  trackingNumber: FAKE.domestic,
  type: "DOMESTIC",
  currentStatus: "배송중",
  currentStatusCode: 6,
  customs: { events: [] },
  delivery: {
    carrier: "CJ대한통운",
    carrierCode: "CJ",
    invoiceNumber: FAKE.domestic,
    events: [
      { status: "배송중", statusCode: 6, datetime: "2026-05-31T08:30:00.000+09:00", location: "인천허브", detail: "간선상차" }
    ]
  },
  timeline: [],
  lastUpdated: "2026-05-31T08:30:00.000+09:00"
};

const PENDING: TrackResponseData = {
  trackingNumber: FAKE.domestic,
  type: "DOMESTIC",
  currentStatus: "도착전",
  currentStatusCode: 1,
  isPending: true,
  customs: { events: [] },
  delivery: { carrier: "CJ대한통운", carrierCode: "CJ", invoiceNumber: FAKE.domestic, events: [] },
  timeline: [],
  lastUpdated: "2026-05-31T08:30:00.000+09:00"
};

/** What the helper must show: buildCsReply over the same view model the customer page derives (spec §10). */
function expectedReply(outcome: LookupOutcome): CsReply {
  const view = deriveTrackingView(outcome, CS_NOW, siteConfig);
  return buildCsReply(view, { now: CS_NOW, notices: siteConfig.notices });
}

async function lookUpInHelper(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/internal/cs-helper");
  await page.getByLabel("운송장번호").fill(FAKE.domestic);
  await page.getByRole("button", { name: "조회" }).click();
}

test("internal helper generates a copy-ready delivery reply from an invoice", async ({ page }) => {
  await page.clock.setFixedTime(CS_NOW);
  await mockTrack(page, IN_TRANSIT);
  await lookUpInHelper(page);

  const reply = expectedReply({ kind: "success", request: CS_REQUEST, data: IN_TRANSIT });
  await expect(page.getByText("CJ대한통운", { exact: true })).toBeVisible();
  await expect(page.getByText(FAKE.domestic).first()).toBeVisible();
  await expect(page.getByLabel("고객 안내문")).toHaveValue(reply.long);
  expect(reply.long).toContain(reply.customerLink);
  expect(reply.long).not.toMatch(/택배사 자동 확인|관리자에게/);
  await expect(page.getByRole("button", { name: "복사" })).toBeVisible();
});

test("internal helper answers pending invoices from the same view and saves nothing", async ({ page }) => {
  await page.clock.setFixedTime(CS_NOW);
  await mockTrack(page, PENDING);
  await lookUpInHelper(page);

  await expect(page.getByLabel("고객 안내문")).toHaveValue(expectedReply({ kind: "success", request: CS_REQUEST, data: PENDING }).long);
  const savedRecords = await page.evaluate((key) => window.localStorage.getItem(key), MISMATCH_LEGACY_KEY);
  expect(savedRecords).toBeNull();
});

test("internal helper turns a failed lookup into a CS reply, never the server message", async ({ page }) => {
  await page.clock.setFixedTime(CS_NOW);
  await mockTrack(page, "notFound404");
  await lookUpInHelper(page);

  const reply = expectedReply({ kind: "failure", request: CS_REQUEST, cause: "notFound", consecutiveFailures: 1 });
  await expect(page.getByLabel("고객 안내문")).toHaveValue(reply.long);
  await expect(page.getByText("해당 번호로 통관/배송 정보를 찾을 수 없습니다")).toHaveCount(0);
});
```

Then replace `async function lookUpInHelper(page: import("@playwright/test").Page): Promise<void> {` with `async function lookUpInHelper(page: Page): Promise<void> {` and add `import type { Page } from "@playwright/test";` below the file's first line (`import { expect, test } from "@playwright/test";`).

- [ ] **Step 2: Run them to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/mismatch-storage.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading — `Error: Cannot find module '@/lib/cs/mismatch-templates'`.
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/internal-cs-helper.spec.ts`
Expected: FAIL — `3 failed, 3 passed`: the three delivery tests fail at `toHaveValue(...)` (the box still holds the pre-renewal '현재 CJ대한통운 운송장번호 …' text, and the NOT_FOUND lookup shows the server message in the error line instead of a reply); the three mismatch tests pass.

- [ ] **Step 3: Move the mismatch templates and switch the helper**

Create `lib/cs/mismatch-templates.ts`:

```ts
// Internal-only (contract §11.1 rule 4): SMS drafts for customs-code mismatches, moved from lib/services/cs-reply-template.ts (S04).

export const CUSTOMS_MISMATCH_TEMPLATES = {
  default:
    "안녕하세요. 통관 진행을 위해 수취인명과 개인통관고유부호 정보 확인이 필요합니다.\n주문 시 입력하신 수취인명과 개인통관고유부호가 일치하지 않아 출고 전 확인 단계에 있습니다.\n정확한 수취인명과 개인통관고유부호를 확인 후 회신 부탁드립니다.",
  recipient:
    "안녕하세요. 통관 정보 확인 중 수취인 정보 확인이 필요하여 안내드립니다.\n개인통관고유부호는 수취인 본인 명의와 일치해야 통관이 가능합니다.\n수취인명, 연락처, 개인통관고유부호를 다시 확인 후 회신 부탁드립니다.",
  hold:
    "안녕하세요. 현재 통관정보 불일치로 출고가 보류될 수 있어 안내드립니다.\n정확한 개인통관고유부호 확인 후 회신 주시면 확인 후 진행 도와드리겠습니다."
} as const;

export type CustomsMismatchTemplateKey = keyof typeof CUSTOMS_MISMATCH_TEMPLATES;
```

In `lib/cs/mismatch-storage.ts` replace

```ts
import type { CustomsMismatchTemplateKey } from "@/lib/services/cs-reply-template";
```

with

```ts
import type { CustomsMismatchTemplateKey } from "@/lib/cs/mismatch-templates";
```

In `components/InternalCsHelper.tsx`:

(a) Replace

```tsx
import {
  CUSTOMS_MISMATCH_TEMPLATES,
  buildCsDeliveryGuide,
  type CsDeliveryGuide,
  type CustomsMismatchTemplateKey
} from "@/lib/services/cs-reply-template";
```

with

```tsx
import { siteConfig } from "@/config/site.config";
import { buildCsReply, type CsReply } from "@/lib/cs/cs-reply";
import { CUSTOMS_MISMATCH_TEMPLATES, type CustomsMismatchTemplateKey } from "@/lib/cs/mismatch-templates";
```

(b) Replace

```tsx
import { ApiTrackResponseSchema } from "@/lib/schemas";
```

with

```tsx
import { classifyFailure } from "@/lib/tracking/classify-failure";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import { fetchTrack } from "@/lib/tracking/fetch-track";
import type { LookupOutcome, LookupRequest, TrackingViewModel } from "@/lib/tracking/types";
```

(c) Directly below the line `const STORAGE_REFUSED_MESSAGE = "이 브라우저에서는 목록을 저장할 수 없어요. 내용 복사 버튼으로 옮겨 주세요.";` (S01) insert:

```tsx

/** One lookup's CS answer: the view model the customer would see and the reply built from it (spec §10). */
interface DeliveryGuide {
  readonly view: TrackingViewModel;
  readonly reply: CsReply;
}

/** The number shape the customer page sends (S09's desk takes S06's normalizeInput instead). */
const toLookupNumber = (value: string): string => value.trim().replace(/[\s-]/g, "").toUpperCase();
```

(d) Replace `  const [guide, setGuide] = useState<CsDeliveryGuide | null>(null);` with `  const [guide, setGuide] = useState<DeliveryGuide | null>(null);`

(e) Replace the whole `handleDeliveryLookup` function (from `  const handleDeliveryLookup = async (event: FormEvent<HTMLFormElement>) => {` through its closing `  };`, the pre-renewal version that calls `fetch("/api/track", …)` and `buildCsDeliveryGuide`) with:

```tsx
  const handleDeliveryLookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const number = toLookupNumber(invoiceNumber);
    if (!number) {
      setError("운송장번호를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setGuide(null);

    // Same path as the customer page: fetchTrack → deriveTrackingView → buildCsReply. A failed lookup gets the CS error
    // template, never the server's own message (spec §5, §10).
    const request: LookupRequest = { number, carrier: "AUTO", entry: "manual" };
    const result = await fetchTrack(request, { signal: new AbortController().signal, timeoutMs: siteConfig.lookup.timeoutMs });
    setLoading(false);
    if (result.kind === "aborted") return;
    const now = new Date();
    const outcome: LookupOutcome =
      result.kind === "success"
        ? { kind: "success", request, data: result.data }
        : { kind: "failure", request, cause: classifyFailure(result.input), consecutiveFailures: 1 };
    const view = deriveTrackingView(outcome, now, siteConfig);
    setGuide({ view, reply: buildCsReply(view, { now, notices: siteConfig.notices }) });
  };
```

(f) Replace the three summary boxes

```tsx
                  <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs text-slate-400">택배사</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{guide.carrierName}</p>
                  </div>
                  <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs text-slate-400">운송장</p>
                    <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-100">{guide.invoiceNumber}</p>
                  </div>
                  <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs text-slate-400">상태</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{guide.currentStatus}</p>
                  </div>
```

with

```tsx
                  <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs text-slate-400">택배사</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{guide.view.carrier.name ?? guide.view.carrier.barLabel}</p>
                  </div>
                  <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs text-slate-400">운송장</p>
                    <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-100">{guide.view.number.raw}</p>
                  </div>
                  <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs text-slate-400">상태</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{guide.view.title}</p>
                  </div>
```

and replace `onClick={() => handleCopy("delivery", guide.reply)}` with `onClick={() => handleCopy("delivery", guide.reply.long)}` and `value={guide.reply}` with `value={guide.reply.long}`.

(g) Delete the old module: use the Grep tool with pattern `cs-reply-template|buildCsDeliveryGuide|CsDeliveryGuide` over `app/`, `components/`, `lib/`, `tests/`. Expected: matches only in `lib/services/cs-reply-template.ts`. Run: `git rm lib/services/cs-reply-template.ts`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/mismatch-storage.spec.ts tests/unit/module-boundaries.spec.ts tests/unit/cs-reply.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `21 passed` (8 + 6 + 7; `lib/cs/*` is still imported only by internal files).
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/internal-cs-helper.spec.ts tests/internal-access.spec.ts tests/e2e/internal-isolation.spec.ts`
Expected: 0 failed (`internal-cs-helper.spec.ts`: `6 passed`).
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```powershell
git add lib/cs/mismatch-templates.ts lib/cs/mismatch-storage.ts components/InternalCsHelper.tsx tests/internal-cs-helper.spec.ts tests/unit/mismatch-storage.spec.ts
git commit -m "refactor: build internal CS replies with buildCsReply and move the mismatch templates to lib/cs"
```
Expected: one commit including the staged deletion of `lib/services/cs-reply-template.ts`.

---

### Task 9: Approval 3 — the cause's own recovery action leads the error card (gated)

**Files:**
- Modify: `components/status-slot/status-view.ts` (the `STATUS_SLOT_APPROVALS` line only)
- Test: `tests/unit/status-view.spec.ts` (the approval-3 ledger test, one import line, one appended block), `tests/e2e/failure-causes.spec.ts` (one import line, appended tests)

**Interfaces:**
- Consumes: `STATUS_SLOT_APPROVALS`, `deriveStatusView`, `applyApprovalFallbacks` (Task 3); `FailureNotice` (root `data-failure-cause`, recovery row), `CustomerCta` `variant: "view"` (톡톡 first; recovery kinds left to the card) (Task 5); `ActionKind`, `FailureCause` (S03 `lib/tracking/types.ts`); `failure` (S03 `tests/fixtures/derive-scenarios.ts`); `mockTrack`, `FailureFixture`, `FAKE`, `FIXTURE_NOW` (S01); `holdTrack`, `openPaused`, `PAUSED_NOW`, `lookUp`, `statusSlot` (Task 4); the Task 5 test-local `CAUSE_BY_FIXTURE` and `expectedFailure`.
- Produces: `STATUS_SLOT_APPROVALS.approval3 === true`. Error screens then render `deriveTrackingView`'s own weights (S03 config rows, spec §7 and §16 item 3 as approved): the cause's recovery action is the one filled button inside the failure card — [번호 수정] for invalidNumber and notFound, [다시 조회] for temporaryDelay (429 with its countdown, 503/504, non-JSON), offline and noResponse; serverError (500 and contract violations) keeps [문의 내용 복사하고 톡톡 열기] as the filled primary; 톡톡 stays the first link of `[data-cta-state="error"]` (an outlined action, or on NOT_FOUND the worry line's text link); a second failure in a row still promotes copy-and-talk (S03). No name, type or hook changes.

- [ ] **Step 1: Confirm approval 3 is recorded in the roadmap approval ledger; if not, stop.**

Run: `Select-String -LiteralPath docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md -Pattern '^\| 3 \|'`
Expected: one line whose Status column (the third cell) starts with `approved`. Any other status (`pending`, `rejected`, empty) → do not run Steps 2–8; write "Task 9 SKIPPED — approval 3 is `<status>`" into the stage summary. The spec §16 item 3 '거절하면' behaviour is already live from Task 3 and stays: "오류 화면에서 톡톡을 채움색 주 버튼으로 두고 [번호 수정]·[다시 조회]는 보조로 내립니다" (`STATUS_SLOT_APPROVALS.approval3 = false` → `withTalkFirst`). S07's `FailureCard` must make the same ledger decision (contract deviation 1).

- [ ] **Step 2: Rule → assertion map (approval 3)**

The approved wording (spec §16 item 3 제안): '모든 오류에서 [data-cta-state=error] 블록의 첫 링크는 톡톡이고 스토어는 0개다. 상태 카드에는 원인별 복구 조작이 먼저 보인다.' No pre-renewal assertion pinned 톡톡 as the *filled* button, so nothing is removed; the new visual hierarchy gets new assertions.

| Test | Rule before (E2E lock) | Rule after approval 3 | Assertion change |
|---|---|---|---|
| `tests/tracking.spec.ts` › "error state prioritizes inquiry without store promotion" | 오류는 문의 우선·스토어 홍보 없음 | 오류 블록 첫 링크 톡톡·스토어 0 | none — the block heading, a '톡톡으로 문의하기 새 창으로 열기' link inside `[data-cta-state="error"]` and 0 naver links all still hold (on NOT_FOUND the link is the worry line's 톡톡 link) |
| `failure-causes.spec.ts` › "`<fixture>`: the cause's own notice, 톡톡 first in the block, no stores and no server wording" | 블록 첫 링크 톡톡, 채움 버튼 1개, 스토어 0 | same | none |
| `failure-causes.spec.ts` › "the filled primary on an error follows the approval-3 ledger" | reads the ledger | reads the ledger | none (now expects `fixNumber`) |
| `failure-causes.spec.ts` › "`<fixture>` (approval 3): the recovery action leads and 톡톡 stays the first link of the block" (8 rows) | — | 카드에 원인별 복구 조작 먼저; SERVER_ERROR는 문의 내용 복사가 주 버튼 | added |
| `failure-causes.spec.ts` › "client timeout (approval 3): …" | — | 응답 없음: [다시 조회] 주, [번호 수정] 보조 (spec §7 'error · 응답 없음') | added |
| `status-view.spec.ts` › ledger row | approval 3 pending | approval 3 approved | flipped; plus "error views are deriveTrackingView's own" |

- [ ] **Step 3: Write the failing unit tests**

In `tests/unit/status-view.spec.ts`:

(a) replace

```ts
test("ledger: approval 3 is pending (roadmap §4)", () => {
  expect(STATUS_SLOT_APPROVALS.approval3).toBe(BOTH_PENDING.approval3);
});
```

with

```ts
test("ledger: approval 3 is approved (roadmap §4)", () => {
  expect(STATUS_SLOT_APPROVALS.approval3).not.toBe(BOTH_PENDING.approval3);
});
```

(`BOTH_PENDING` stays referenced, so the file lints whether or not Task 10 ran first.)

(b) replace `import type { EtaView, LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";` with

```ts
import type { EtaView, FailureCause, LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";
```

(c) append at the end of the file:

```ts
const ALL_CAUSES: readonly FailureCause[] = [
  "invalidNumber",
  "notFound",
  "rateLimited",
  "upstreamTimeout",
  "badGateway",
  "network",
  "offline",
  "clientTimeout",
  "serverError",
  "contractViolation"
];

test("approval 3 granted: the page's error views are deriveTrackingView's own, recovery action first", () => {
  for (const cause of ALL_CAUSES) {
    for (const consecutiveFailures of [1, 2]) {
      const outcome = failure(cause, { consecutiveFailures });
      expect(deriveStatusView(outcome, FIXTURE_NOW), `${cause} × ${consecutiveFailures}`).toEqual(base(outcome));
    }
  }
});
```

- [ ] **Step 4: Write the failing E2E tests**

In `tests/e2e/failure-causes.spec.ts`:

(a) replace `import type { FailureCause, TrackingViewModel } from "@/lib/tracking/types";` with

```ts
import type { ActionKind, FailureCause, TrackingViewModel } from "@/lib/tracking/types";
```

(b) append at the end of the file:

```ts
/** Spec §16 item 3 as approved, with the §7 rows: the failure card leads with the cause's own recovery action. */
const APPROVED_PRIMARY: Readonly<Record<FailureFixture, ActionKind>> = {
  invalid400: "fixNumber",
  notFound404: "fixNumber",
  rateLimited429: "retry",
  upstreamTimeout504: "retry",
  unavailable503: "retry",
  serverError500: "copyAndTalk",
  badGatewayHtml502: "retry",
  contractViolation200: "copyAndTalk"
};

for (const fixture of Object.keys(APPROVED_PRIMARY) as FailureFixture[]) {
  test(`${fixture} (approval 3): the recovery action leads and 톡톡 stays the first link of the block`, async ({ page }) => {
    const cause = CAUSE_BY_FIXTURE[fixture];
    const kind = APPROVED_PRIMARY[fixture];
    expect(expectedFailure(cause, FAKE.domestic).nextAction.primary?.kind).toBe(kind);
    await page.clock.setFixedTime(FIXTURE_NOW);
    await mockTrack(page, fixture);
    await page.goto("/");
    await lookUp(page, FAKE.domestic);

    const slot = statusSlot(page);
    const primary = slot.locator('[data-action-weight="primary"]');
    await expect(primary).toHaveCount(1);
    await expect(primary).toHaveAttribute("data-action-kind", kind);
    const cta = slot.locator('[data-cta-state="error"]');
    const firstLink = cta.getByRole("link").first();
    await expect(firstLink).toHaveAttribute("href", siteConfig.channels.talk.url);
    if (kind === "copyAndTalk") {
      await expect(cta.locator('[data-action-weight="primary"]')).toHaveAttribute("data-action-kind", "copyAndTalk");
    } else {
      await expect(slot.locator(`[data-failure-cause="${cause}"] [data-action-weight="primary"]`)).toHaveAttribute(
        "data-action-kind",
        kind
      );
      await expect(firstLink).not.toHaveAttribute("data-action-weight", "primary");
    }
  });
}

test("client timeout (approval 3): [다시 조회] leads the card, [번호 수정] follows, 톡톡 stays the first link", async ({ page }) => {
  const held = await holdTrack(page);
  await openPaused(page);
  await lookUp(page, FAKE.domestic);
  await held.waitForRequests(1);
  await page.clock.runFor(lookup.timeoutMs);
  // Spec §7 'error · 응답 없음': 주 행동 [다시 조회](번호 확인 문장 바로 뒤), 보조 [번호 수정].
  expect(expectedFailure("clientTimeout", FAKE.domestic, PAUSED_NOW).nextAction.primary?.kind).toBe("retry");
  const notice = statusSlot(page).locator('[data-failure-cause="clientTimeout"]');
  await expect(notice.locator('[data-action-weight="primary"]')).toHaveAttribute("data-action-kind", "retry");
  await expect(notice.locator('[data-action-kind="fixNumber"]')).toHaveAttribute("data-action-weight", "secondary");
  await expect(statusSlot(page).locator('[data-cta-state="error"]').getByRole("link").first()).toHaveAttribute(
    "href",
    siteConfig.channels.talk.url
  );
});
```

- [ ] **Step 5: Run them to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/status-view.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `2 failed`: "ledger: approval 3 is approved (roadmap §4)" (`expect(received).not.toBe(expected)`, received `false`) and "approval 3 granted: …" (first message `invalidNumber × 1`: the transformed view's `primary.kind` is `"talk"`, deriveTrackingView's is `"fixNumber"`). Every other test in the file passes.
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/failure-causes.spec.ts`
Expected: FAIL — `7 failed`: the approval-3 rows for `invalid400`, `notFound404`, `rateLimited429`, `upstreamTimeout504`, `unavailable503`, `badGatewayHtml502` (each at its first `expect`: expected `"fixNumber"` or `"retry"`, received `"talk"`) and "client timeout (approval 3): …" (expected `"retry"`, received `"talk"`). The `serverError500` and `contractViolation200` rows already pass (copy-and-talk leads under either ledger value), and the 18 Task 5 tests pass.

- [ ] **Step 6: Record the approval in the slot's ledger**

In `components/status-slot/status-view.ts` replace `approval3: false };` with `approval3: true };` (the only occurrence, at the end of the `export const STATUS_SLOT_APPROVALS: StatusSlotApprovals = { … };` line; `approval2` keeps whatever value it has).

- [ ] **Step 7: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/status-view.spec.ts tests/unit/derive-view.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: 0 failed (`status-view.spec.ts`: the "approval 3 pending: …" describe block still passes because it passes its approvals explicitly; `derive-view.spec.ts` unchanged).
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/failure-causes.spec.ts`
Expected: `27 passed` (18 + 9).
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/tracking.spec.ts tests/privacy.spec.ts tests/e2e`
Expected: 0 failed — "error state prioritizes inquiry without store promotion" passes unchanged, `cta-consistency.spec.ts` error rows still find 0 stores, `loading-timeline.spec.ts` and `status-slot.spec.ts` are untouched by the ledger.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 8: Commit**

```powershell
git add components/status-slot/status-view.ts tests/unit/status-view.spec.ts tests/e2e/failure-causes.spec.ts
git commit -m "feat: lead error cards with the cause's recovery action (approval 3)"
```
Expected: one commit. Write "Task 9 DONE — approval 3 approved" into the stage summary.

---

### Task 10: Approval 2 — result rules asserted through the view; the configured copy on screen (gated)

**Files:**
- Modify: `components/status-slot/status-view.ts` (the `STATUS_SLOT_APPROVALS` line only)
- Modify: `tests/tracking.spec.ts` (imports; `createTrackData`; three helpers; the result blocks of "tracking result leads…", "an overdue customs estimate…", "pickup status…"; the heads of the pending, in-transit and delivered tests; `mockTrackSuccess` removed)
- Modify: `tests/privacy.spec.ts` (the fixture import line; the stale test)
- Modify: `tests/e2e/loading-timeline.spec.ts`, `tests/e2e/failure-causes.spec.ts`, `tests/e2e/status-slot.spec.ts` (state headings → hooks; `status-slot.spec.ts` also gains two import changes and one test)
- Test: `tests/unit/status-view.spec.ts` (the approval-2 ledger test, one import line, one appended test)

**Interfaces:**
- Consumes: `deriveStatusView`, `LEGACY_RESULT_COPY`, `STATUS_SLOT_APPROVALS` (Task 3); `deriveTrackingView` (S03), `channels`, `disclosures`, `resultCopy`, `siteConfig` (`config/site.config.ts`, S03); `FIXTURE_NOW`, `mockTrack`, `trackData`, `GAP3_06_VARIANTS`, `FAKE` (S01); `success`, `pickedUpData`, `inTransitData`, `PICKUP_NOW`, `OCTOBER_NOW` (S03 `tests/fixtures/derive-scenarios.ts`); hooks `data-status-slot`, `data-guide-key`, `data-eta-kind`, `data-station`, `data-cta-state`, `data-affiliate-disclosure`, `data-action-weight`, `data-action-kind` (Tasks 5–6); `statusSlot`, `showResult`, `expectedResult`, `liveRegion` (Tasks 4 and 6).
- Produces: `STATUS_SLOT_APPROVALS.approval2 === true` → every settled view on the page equals `deriveTrackingView`'s (spec §7 copy from `config/site.config.ts`, changeable by config alone). The pre-renewal result tests assert their rules through `deriveStatusView` and hooks, never through sentence literals (spec §14 테스트 계약 1–3). Test-local helpers in `tests/tracking.spec.ts`: `resultView(data, now)`, `STORE_LINKS`, `disclosureComesFirst(page, ctaState)`, and `createTrackData(state, now?)`. `LEGACY_RESULT_COPY` and `applyApprovalFallbacks` stay (unit-tested, no longer reached by the page) until S07 deletes `components/status-slot/`.

- [ ] **Step 1: Confirm approval 2 is recorded in the roadmap approval ledger; if not, stop.**

Run: `Select-String -LiteralPath docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md -Pattern '^\| 2 \|'`
Expected: one line whose Status column (the third cell) starts with `approved`. Any other status → do not run Steps 2–14; write "Task 10 SKIPPED — approval 2 is `<status>`" into the stage summary. The spec §16 item 2 '거절하면' behaviour stays live from Tasks 3 and 6: "새 상태 문장을 현 테스트 문구에 맞춰 고정해야 해서 설정 기반 문구를 쓸 수 없고, 개편 때마다 테스트를 손으로 고쳐야 합니다" — the `LEGACY_RESULT_COPY` overlay keeps the asserted sentences byte-identical and the Task 6 literal assertions stay. Also note in the summary that S06 and S07 are blocked by approval 2 (roadmap §4). If the operator ruled that approval 2 also covers the internal CS suite and Task 8 was therefore held back, list Task 8 under this SKIPPED line too.
If approval 2 is approved and Task 8 was held back for it, run Task 8 now, before Step 3.

- [ ] **Step 2: Rule → assertion map (approval 2, final form)**

Every row keeps its business rule; the literal wording moves to the view model (which reads `config/site.config.ts`) and to hooks. Data facts (dates computed from the fixture, the carrier name) stay pinned in Node next to the view.

| Test | Business rule | Literal assertions removed | View/hook assertions that replace them |
|---|---|---|---|
| tracking › "tracking result leads with delivery date and keeps customs estimate secondary" | 결과 요약: 상태 → 도착 예상 → 통관 예상 보조 | h2 '통관대기'; '배송 완료 예상일'; `/7월 17일/`; `/^통관완료 예상일 .*7월 14일/`; '정상 통관 대기 상태입니다…' | status h2 = `view.title`; `[data-eta-kind="date"]` shows `view.eta.label`, `view.eta.date.label`, `view.eta.caption`; Node: `eta.date.key` = 2026-07-17 and the caption contains '7월 14일'; 지금 할 일 shows `view.nextAction.sentence`; spine `aria-current` count 1 (kept) |
| tracking › "an overdue customs estimate is recalculated and remains readable on mobile" | 오래된 예상일 재계산 | h2 '통관대기' | status h2 = `view.title`; the recalculated dates (data) and the 390 px overflow check kept |
| tracking › "pickup status names the carrier pickup and prioritizes the delivery estimate" | 기사님 픽업 문언, 예상일 우선 | h2, reason, sentence, '배송 완료 예상일', `/7월 16일/`, `/^통관 완료일 .*7월 14일/` | h2 = `view.title` and contains 'CJ대한통운'; reason and sentence from the view; ETA label/date/caption from the view; Node: `eta.date.key` = 2026-07-16, caption contains '7월 14일' |
| tracking › "pending state offers inquiry and purchase-channel choices" | 도착 전 → 문의 + 구매처, 고지 선행 | h2 '통관 정보 등록 전'; '정보 등록 후 안내'; the recheck sentence; CTA h3; 톡톡/네이버/쿠팡 link names; `rel` sponsored; the disclosure sentence | h2 = `view.title`; `[data-eta-kind="pendingInfo"]` = `view.eta.text`; `view.nextAction.sentence` and `view.nextAction.note` (the recheck sentence, `durations.pendingRecheck`); CTA h3 = `view.nextAction.heading`; 톡톡 link named from `channels.talk.labels.cta`; each `view.nextAction.stores` link by label with its `href` and `rel` by `isAffiliate`; disclosure = `disclosures.coupang` and before the sponsored link; the recommendations dialog part is unchanged (S08) |
| tracking › "in-transit state keeps shopping links out of the primary flow" | 배송 중 → 쇼핑 링크 주 흐름 밖 | h2 '국내 배송 중'; '배송 완료 예상일'; the sentence; spine text '국내 배송'; CTA h3; 톡톡 name; 네이버/쿠팡 names at 0 | h2, ETA label, sentence and CTA h3 from the view; `[data-station="domestic"]` is `aria-current="step"`; 톡톡 link from config; `view.nextAction.stores` null, 0 config store hrefs and 0 sponsored links in the block; 0 recommendations inside `#tracking-panel` (they sit below it; the visible-below assertions are kept) |
| tracking › "delivered state leads with store choices" | 배송 완료 → 스토어 선두 | h2 '배송 완료'; '배송 완료일'; the sentence; CTA h3; store and 톡톡 names; the disclosure sentence | h2, `[data-eta-kind="deliveredOn"]` label, sentence, CTA h3 from the view; the block's first two links are the `view.nextAction.stores` hrefs in order; 톡톡 link from config; disclosure = `disclosures.coupang`, before the sponsored link |
| privacy › "a stale shipment shows a verification prompt instead of a delivery estimate" | 오래된 이력 → 예상일 대신 확인 안내 | '배송 이력 확인 필요'; exact '확인 필요'; '오늘 예상' at 0; '마지막 처리 이후 오래 지났습니다' | `[data-eta-kind="withheld"]` = `view.eta.text`; chip state word from `view.chip`; `resultCopy.etaTodayLabel` at 0; `view.nextAction.sentence`; copy-and-talk is the one filled button |
| tracking › "error state prioritizes inquiry without store promotion"; "user can choose a representative domestic carrier before tracking" | 오류 → 문의 우선·스토어 0; 택배사 선택과 공식 링크 | none (the error block's heading is config copy that approval 2 does not change; the carrier assertions read the legacy details, which S07 migrates) | — |
| S04 E2E: `loading-timeline.spec.ts` (3 tests), `failure-causes.spec.ts` › offline re-lookup, `status-slot.spec.ts` › "the details below the slot are one result region…" | the right (latest) result settles the slot; one status h2 | state headings '통관 정보 등록 전', '국내 배송 중' | `[data-guide-key="pending"]` / `[data-guide-key="inTransit"]` inside the slot; the one-h2 check reads `expectedResult(…).title` |

Nothing is removed without a replacement in the same test. Order of work: add the new assertions next to the old ones (each old line carries the marker `// approval-2 literal`), see both pass while the ledger still says pending, delete the marked lines, then flip the ledger (spec §14 테스트 계약 1).

- [ ] **Step 3: Add the view assertions next to the literal ones in `tests/tracking.spec.ts`**

Use the Edit tool for each change (every old block below is unique in the file).

(a) Replace

```ts
import type { StatusCode, TrackResponseData } from "@/lib/types";
import { FAKE } from "./fixtures/tracking-fixtures";
```

with

```ts
import { deriveStatusView } from "@/components/status-slot/status-view";
import { channels, disclosures } from "@/config/site.config";
import type { TrackingViewModel } from "@/lib/tracking/types";
import type { StatusCode, TrackResponseData } from "@/lib/types";
import { FAKE, FIXTURE_NOW, mockTrack } from "./fixtures/tracking-fixtures";
```

(b) Replace

```ts
const createTrackData = (state: MockTrackingState): TrackResponseData => {
  const estimatedDeliveryDate = new Date();
  if (state.code !== 7) estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 3);
  const estimatedCustomsClearanceDate = new Date();
  estimatedCustomsClearanceDate.setDate(estimatedCustomsClearanceDate.getDate() - 1);
```

with

```ts
/** `now` defaults to the real clock; the state tests pass the instant they pin the page clock to, so Node derives the same view. */
const createTrackData = (state: MockTrackingState, now: Date = new Date()): TrackResponseData => {
  const estimatedDeliveryDate = new Date(now.getTime());
  if (state.code !== 7) estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 3);
  const estimatedCustomsClearanceDate = new Date(now.getTime());
  estimatedCustomsClearanceDate.setDate(estimatedCustomsClearanceDate.getDate() - 1);
```

and replace `    lastUpdated: new Date().toISOString()` with `    lastUpdated: now.toISOString()`.

(c) Insert directly above the line `test("normalizer calculates a clear customs completion estimate while customs is waiting", () => {`:

```ts
/** The view the status slot renders for a manual lookup of `data` settled at `now` (approval 2: the rules are asserted through it). */
const resultView = (data: TrackResponseData, now: Date): TrackingViewModel =>
  deriveStatusView({ kind: "success", request: { number: data.trackingNumber, carrier: "AUTO", entry: "manual" }, data }, now);

/** Every store link the config can place (naver and coupang, all placements). */
const STORE_LINKS = [...new Set([...Object.values(channels.naver.urls), ...Object.values(channels.coupang.urls)])]
  .map((href) => `a[href="${href}"]`)
  .join(", ");

/** Spec §8: inside a CTA block the affiliate disclosure comes before the first sponsored link. */
const disclosureComesFirst = (page: Page, ctaState: string): Promise<boolean> =>
  page.evaluate((state) => {
    const block = document.querySelector(`[data-cta-state="${state}"]`);
    const disclosure = block?.querySelector("[data-affiliate-disclosure]") ?? null;
    const sponsored = block?.querySelector('a[rel~="sponsored"]') ?? null;
    return (
      disclosure !== null &&
      sponsored !== null &&
      (disclosure.compareDocumentPosition(sponsored) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    );
  }, ctaState);

```

(d) "tracking result leads…" — replace

```ts
  await expect(summary.getByRole("heading", { name: "통관대기" })).toBeVisible();
  await expect(deliveryEstimate.getByText("배송 완료 예상일", { exact: true })).toBeVisible();
  await expect(deliveryEstimate.getByText(/7월 17일/)).toBeVisible();
  await expect(deliveryEstimate.getByText(/^통관완료 예상일 .*7월 14일/)).toBeVisible();
  await expect(summary.getByText("정상 통관 대기 상태입니다. 지금은 별도 문의 없이 조금만 기다려 주세요.")).toBeVisible();
```

with

```ts
  const view = resultView(data, new Date("2026-07-13T12:00:00+09:00"));
  if (view.eta.kind !== "date") throw new Error(`unexpected ETA kind ${view.eta.kind}`);
  expect(view.eta.date.key).toBe("2026-07-17");
  expect(view.eta.caption ?? "").toContain("7월 14일");
  await expect(summary.locator("[data-guide-key]").getByRole("heading", { level: 2 })).toHaveText(view.title);
  await expect(deliveryEstimate).toHaveAttribute("data-eta-kind", "date");
  await expect(deliveryEstimate.getByText(view.eta.label, { exact: true })).toBeVisible();
  await expect(deliveryEstimate.getByText(view.eta.date.label, { exact: true })).toBeVisible();
  await expect(deliveryEstimate.getByText(view.eta.caption ?? "", { exact: true })).toBeVisible();
  await expect(summary.getByText(view.nextAction.sentence, { exact: true })).toBeVisible();
  await expect(summary.getByRole("heading", { name: "통관대기" })).toBeVisible(); // approval-2 literal
  await expect(deliveryEstimate.getByText("배송 완료 예상일", { exact: true })).toBeVisible(); // approval-2 literal
  await expect(deliveryEstimate.getByText(/7월 17일/)).toBeVisible(); // approval-2 literal
  await expect(deliveryEstimate.getByText(/^통관완료 예상일 .*7월 14일/)).toBeVisible(); // approval-2 literal
  await expect(summary.getByText("정상 통관 대기 상태입니다. 지금은 별도 문의 없이 조금만 기다려 주세요.")).toBeVisible(); // approval-2 literal
```

(e) "an overdue customs estimate…" — replace

```ts
  await expect(summary.getByRole("heading", { name: "통관대기" })).toBeVisible();
  await expect(summary.getByText("7월 23일 (목)")).toBeVisible();
```

with

```ts
  const view = resultView(data, new Date("2026-07-20T12:00:00+09:00"));
  await expect(summary.locator("[data-guide-key]").getByRole("heading", { level: 2 })).toHaveText(view.title);
  await expect(summary.getByRole("heading", { name: "통관대기" })).toBeVisible(); // approval-2 literal
  await expect(summary.getByText("7월 23일 (목)")).toBeVisible();
```

(f) "pickup status…" — replace

```ts
  await expect(summary.getByRole("heading", { name: "CJ대한통운 기사님 픽업 완료!" })).toBeVisible();
  await expect(summary.getByText("CJ대한통운 기사님이 상품을 인수해 배송 출발을 준비하고 있습니다.")).toBeVisible();
  await expect(summary.getByText("픽업이 완료됐습니다. 배송 이동이 시작되면 현재 위치가 업데이트됩니다.")).toBeVisible();
  await expect(deliveryEstimate.getByText("배송 완료 예상일", { exact: true })).toBeVisible();
  await expect(deliveryEstimate.getByText(/7월 16일/)).toBeVisible();
  await expect(deliveryEstimate.getByText(/^통관 완료일 .*7월 14일/)).toBeVisible();
```

with

```ts
  const view = resultView(data, new Date("2026-07-14T16:00:00+09:00"));
  if (view.eta.kind !== "date") throw new Error(`unexpected ETA kind ${view.eta.kind}`);
  expect(view.eta.date.key).toBe("2026-07-16");
  expect(view.eta.caption ?? "").toContain("7월 14일");
  expect(view.title).toContain("CJ대한통운");
  await expect(summary.locator("[data-guide-key]").getByRole("heading", { level: 2 })).toHaveText(view.title);
  await expect(summary.getByText(view.reason ?? "", { exact: true })).toBeVisible();
  await expect(summary.getByText(view.nextAction.sentence, { exact: true })).toBeVisible();
  await expect(deliveryEstimate.getByText(view.eta.label, { exact: true })).toBeVisible();
  await expect(deliveryEstimate.getByText(view.eta.date.label, { exact: true })).toBeVisible();
  await expect(deliveryEstimate.getByText(view.eta.caption ?? "", { exact: true })).toBeVisible();
  await expect(summary.getByRole("heading", { name: "CJ대한통운 기사님 픽업 완료!" })).toBeVisible(); // approval-2 literal
  await expect(summary.getByText("CJ대한통운 기사님이 상품을 인수해 배송 출발을 준비하고 있습니다.")).toBeVisible(); // approval-2 literal
  await expect(summary.getByText("픽업이 완료됐습니다. 배송 이동이 시작되면 현재 위치가 업데이트됩니다.")).toBeVisible(); // approval-2 literal
  await expect(deliveryEstimate.getByText("배송 완료 예상일", { exact: true })).toBeVisible(); // approval-2 literal
  await expect(deliveryEstimate.getByText(/7월 16일/)).toBeVisible(); // approval-2 literal
  await expect(deliveryEstimate.getByText(/^통관 완료일 .*7월 14일/)).toBeVisible(); // approval-2 literal
```

(g) Delete the helper the three state tests no longer use — replace

```ts
const mockTrackSuccess = async (page: Page, state: MockTrackingState): Promise<void> => {
  await page.route("**/api/track", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: createTrackData(state) })
    });
  });
};

const submitTracking
```

with

```ts
const submitTracking
```

(h) Pending — replace

```ts
test("pending state offers inquiry and purchase-channel choices", async ({ page }) => {
  await mockTrackSuccess(page, { status: "도착전", code: 1, isPending: true });
  await submitTracking(page);

  const cta = page.locator('[data-cta-state="pending"]');
  const summary = page.locator('[data-status-slot="settled"]');
  await expect(summary.getByRole("heading", { name: "통관 정보 등록 전" })).toBeVisible();
  await expect(summary.getByText("정보 등록 후 안내", { exact: true })).toBeVisible();
  await expect(summary.getByText("정보 반영까지 시간이 걸릴 수 있어 2~3시간 뒤 다시 확인해 주세요.")).toBeVisible();
  await expect(cta.getByRole("heading", { name: "아직 국내 배송 정보가 없어요" })).toBeVisible();
  await expect(cta.getByRole("link", { name: "톡톡으로 문의하기 새 창으로 열기" })).toBeVisible();
  await expect(cta.getByRole("link", { name: "네이버 스토어 보기 새 창으로 열기" })).toBeVisible();
  const coupangLink = cta.getByRole("link", { name: "쿠팡 스토어 보기 새 창으로 열기" });
  await expect(coupangLink).toBeVisible();
  await expect(coupangLink).toHaveAttribute("rel", /sponsored/);
  await expect(
    cta.getByText("쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.")
  ).toBeVisible();
```

with

```ts
test("pending state offers inquiry and purchase-channel choices", async ({ page }) => {
  const data = createTrackData({ status: "도착전", code: 1, isPending: true }, FIXTURE_NOW);
  const view = resultView(data, FIXTURE_NOW);
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, data);
  await submitTracking(page);

  const cta = page.locator('[data-cta-state="pending"]');
  const summary = page.locator('[data-status-slot="settled"]');
  if (view.eta.kind !== "pendingInfo") throw new Error(`unexpected ETA kind ${view.eta.kind}`);
  const stores = view.nextAction.stores;
  if (stores === null) throw new Error("pending must offer the purchase choices");
  if (view.nextAction.note === null) throw new Error("pending must show the recheck sentence");
  expect(stores.links.some((link) => link.isAffiliate)).toBe(true);
  await expect(summary.locator("[data-guide-key]").getByRole("heading", { level: 2 })).toHaveText(view.title);
  await expect(summary.locator('[data-eta-kind="pendingInfo"]').getByText(view.eta.text, { exact: true })).toBeVisible();
  await expect(cta.getByText(view.nextAction.sentence, { exact: true })).toBeVisible();
  await expect(cta.getByText(view.nextAction.note, { exact: true })).toBeVisible();
  await expect(cta.getByRole("heading", { level: 3 })).toHaveText(view.nextAction.heading ?? "");
  await expect(cta.getByRole("link", { name: `${channels.talk.labels.cta} 새 창으로 열기` })).toBeVisible();
  for (const link of stores.links) {
    const storeLink = cta.getByRole("link", { name: `${link.label} 새 창으로 열기` });
    await expect(storeLink).toHaveAttribute("href", link.href);
    if (link.isAffiliate) await expect(storeLink).toHaveAttribute("rel", /sponsored/);
    else await expect(storeLink).not.toHaveAttribute("rel", /sponsored/);
  }
  await expect(cta.locator("[data-affiliate-disclosure]")).toHaveText(disclosures.coupang);
  expect(await disclosureComesFirst(page, "pending")).toBe(true);
  await expect(summary.getByRole("heading", { name: "통관 정보 등록 전" })).toBeVisible(); // approval-2 literal
  await expect(summary.getByText("정보 등록 후 안내", { exact: true })).toBeVisible(); // approval-2 literal
  await expect(summary.getByText("정보 반영까지 시간이 걸릴 수 있어 2~3시간 뒤 다시 확인해 주세요.")).toBeVisible(); // approval-2 literal
  await expect(cta.getByRole("heading", { name: "아직 국내 배송 정보가 없어요" })).toBeVisible(); // approval-2 literal
  await expect(cta.getByRole("link", { name: "톡톡으로 문의하기 새 창으로 열기" })).toBeVisible(); // approval-2 literal
  await expect(cta.getByRole("link", { name: "네이버 스토어 보기 새 창으로 열기" })).toBeVisible(); // approval-2 literal
  const coupangLink = cta.getByRole("link", { name: "쿠팡 스토어 보기 새 창으로 열기" }); // approval-2 literal
  await expect(coupangLink).toBeVisible(); // approval-2 literal
  await expect(coupangLink).toHaveAttribute("rel", /sponsored/); // approval-2 literal
  await expect(cta.getByText("쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.")).toBeVisible(); // approval-2 literal
```

(If approval 4 was granted before this stage and the recheck line of this test already reads `durations.pendingRecheck` instead of the '2~3시간' literal — the approval-4 case in the Self-Review — the old block contains that line; carry it over unchanged and do not mark it: it reads the config, so Step 6 keeps it and its `durations` import stays used.)

(i) In transit — replace

```ts
test("in-transit state keeps shopping links out of the primary flow", async ({ page }) => {
  await mockTrackSuccess(page, { status: "배송중", code: 6, isPending: false });
  await submitTracking(page);

  const cta = page.locator('[data-cta-state="inTransit"]');
  const summary = page.locator('[data-status-slot="settled"]');
  await expect(summary.getByRole("heading", { name: "국내 배송 중" })).toBeVisible();
  await expect(summary.getByText("배송 완료 예상일", { exact: true })).toBeVisible();
  await expect(summary.getByText("배송 중입니다. 문자로 안내된 배송 예정 시간을 확인해 주세요.")).toBeVisible();
  await expect(summary.getByRole("list", { name: "배송 여정 4구간" }).locator('[aria-current="step"]')).toContainText("국내 배송");
  await expect(cta.getByRole("heading", { name: "배송이 진행 중이에요" })).toBeVisible();
  await expect(cta.getByRole("link", { name: "톡톡으로 문의하기 새 창으로 열기" })).toBeVisible();
  await expect(cta.getByRole("link", { name: "네이버 스토어 보기 새 창으로 열기" })).toHaveCount(0);
  await expect(cta.getByRole("link", { name: "쿠팡 스토어 보기 새 창으로 열기" })).toHaveCount(0);
```

with

```ts
test("in-transit state keeps shopping links out of the primary flow", async ({ page }) => {
  const data = createTrackData({ status: "배송중", code: 6, isPending: false }, FIXTURE_NOW);
  const view = resultView(data, FIXTURE_NOW);
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, data);
  await submitTracking(page);

  const cta = page.locator('[data-cta-state="inTransit"]');
  const summary = page.locator('[data-status-slot="settled"]');
  if (view.eta.kind === "none") throw new Error("in transit must show an arrival estimate");
  expect(view.nextAction.stores).toBeNull();
  await expect(summary.locator("[data-guide-key]").getByRole("heading", { level: 2 })).toHaveText(view.title);
  await expect(summary.locator("[data-eta-kind]").getByText(view.eta.label, { exact: true })).toBeVisible();
  await expect(cta.getByText(view.nextAction.sentence, { exact: true })).toBeVisible();
  await expect(summary.locator('[data-station="domestic"]')).toHaveAttribute("aria-current", "step");
  await expect(cta.getByRole("heading", { level: 3 })).toHaveText(view.nextAction.heading ?? "");
  await expect(cta.getByRole("link", { name: `${channels.talk.labels.cta} 새 창으로 열기` })).toBeVisible();
  await expect(cta.locator(STORE_LINKS)).toHaveCount(0);
  await expect(cta.locator('a[rel~="sponsored"]')).toHaveCount(0);
  await expect(page.locator("#tracking-panel [data-recommended-products]")).toHaveCount(0);
  await expect(summary.getByRole("heading", { name: "국내 배송 중" })).toBeVisible(); // approval-2 literal
  await expect(summary.getByText("배송 완료 예상일", { exact: true })).toBeVisible(); // approval-2 literal
  await expect(summary.getByText("배송 중입니다. 문자로 안내된 배송 예정 시간을 확인해 주세요.")).toBeVisible(); // approval-2 literal
  await expect(summary.getByRole("list", { name: "배송 여정 4구간" }).locator('[aria-current="step"]')).toContainText("국내 배송"); // approval-2 literal
  await expect(cta.getByRole("heading", { name: "배송이 진행 중이에요" })).toBeVisible(); // approval-2 literal
  await expect(cta.getByRole("link", { name: "톡톡으로 문의하기 새 창으로 열기" })).toBeVisible(); // approval-2 literal
  await expect(cta.getByRole("link", { name: "네이버 스토어 보기 새 창으로 열기" })).toHaveCount(0); // approval-2 literal
  await expect(cta.getByRole("link", { name: "쿠팡 스토어 보기 새 창으로 열기" })).toHaveCount(0); // approval-2 literal
```

(The test's last two lines — `[data-recommended-products="inTransit"]` and `[data-motion-cue="weekly-best"]` visible below the slot — stay.)

(j) Delivered — replace

```ts
test("delivered state leads with store choices", async ({ page }) => {
  await mockTrackSuccess(page, { status: "배송완료", code: 7, isPending: false });
  await submitTracking(page);

  const cta = page.locator('[data-cta-state="delivered"]');
  const summary = page.locator('[data-status-slot="settled"]');
  await expect(summary.getByRole("heading", { name: "배송 완료" })).toBeVisible();
  await expect(summary.getByText("배송 완료일", { exact: true })).toBeVisible();
  await expect(summary.getByText("배송이 완료됐습니다. 상품 상태를 확인해 주세요.")).toBeVisible();
  await expect(cta.getByRole("heading", { name: "배송이 완료됐어요" })).toBeVisible();
  await expect(cta.getByRole("link", { name: "네이버 스토어 보기 새 창으로 열기" })).toBeVisible();
  await expect(cta.getByRole("link", { name: "쿠팡 스토어 보기 새 창으로 열기" })).toBeVisible();
  await expect(cta.getByRole("link", { name: "톡톡으로 문의하기 새 창으로 열기" })).toBeVisible();
  await expect(
    cta.getByText("쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.")
  ).toBeVisible();
```

with

```ts
test("delivered state leads with store choices", async ({ page }) => {
  const data = createTrackData({ status: "배송완료", code: 7, isPending: false }, FIXTURE_NOW);
  const view = resultView(data, FIXTURE_NOW);
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, data);
  await submitTracking(page);

  const cta = page.locator('[data-cta-state="delivered"]');
  const summary = page.locator('[data-status-slot="settled"]');
  if (view.eta.kind !== "deliveredOn") throw new Error(`unexpected ETA kind ${view.eta.kind}`);
  const stores = view.nextAction.stores;
  if (stores === null) throw new Error("delivered must lead with the stores");
  await expect(summary.locator("[data-guide-key]").getByRole("heading", { level: 2 })).toHaveText(view.title);
  await expect(summary.locator('[data-eta-kind="deliveredOn"]').getByText(view.eta.label, { exact: true })).toBeVisible();
  await expect(cta.getByText(view.nextAction.sentence, { exact: true })).toBeVisible();
  await expect(cta.getByRole("heading", { level: 3 })).toHaveText(view.nextAction.heading ?? "");
  const firstTwo = await cta.getByRole("link").evaluateAll((links) => links.slice(0, 2).map((link) => link.getAttribute("href")));
  expect(firstTwo).toEqual(stores.links.map((link) => link.href));
  await expect(cta.getByRole("link", { name: `${channels.talk.labels.cta} 새 창으로 열기` })).toBeVisible();
  await expect(cta.locator("[data-affiliate-disclosure]")).toHaveText(disclosures.coupang);
  expect(await disclosureComesFirst(page, "delivered")).toBe(true);
  await expect(summary.getByRole("heading", { name: "배송 완료" })).toBeVisible(); // approval-2 literal
  await expect(summary.getByText("배송 완료일", { exact: true })).toBeVisible(); // approval-2 literal
  await expect(summary.getByText("배송이 완료됐습니다. 상품 상태를 확인해 주세요.")).toBeVisible(); // approval-2 literal
  await expect(cta.getByRole("heading", { name: "배송이 완료됐어요" })).toBeVisible(); // approval-2 literal
  await expect(cta.getByRole("link", { name: "네이버 스토어 보기 새 창으로 열기" })).toBeVisible(); // approval-2 literal
  await expect(cta.getByRole("link", { name: "쿠팡 스토어 보기 새 창으로 열기" })).toBeVisible(); // approval-2 literal
  await expect(cta.getByRole("link", { name: "톡톡으로 문의하기 새 창으로 열기" })).toBeVisible(); // approval-2 literal
  await expect(cta.getByText("쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.")).toBeVisible(); // approval-2 literal
```

(The test's last line — `[data-recommended-products="delivered"]` visible — stays.)

- [ ] **Step 4: Add the view assertions next to the literal ones in `tests/privacy.spec.ts`**

(a) Replace `import { FAKE } from "./fixtures/tracking-fixtures";` with

```ts
import { deriveStatusView } from "@/components/status-slot/status-view";
import { resultCopy } from "@/config/site.config";
import type { TrackResponseData } from "@/lib/types";
import { FAKE, FIXTURE_NOW, mockTrack } from "./fixtures/tracking-fixtures";
```

(b) Replace the whole stale test — from the line `test("a stale shipment shows a verification prompt instead of a delivery estimate", async ({ page }) => {` through its closing `});` — which after S01 and Task 6 reads

```ts
test("a stale shipment shows a verification prompt instead of a delivery estimate", async ({ page }) => {
  await page.route("**/api/track", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          trackingNumber: FAKE.domestic,
          type: "DOMESTIC",
          currentStatus: "통관완료",
          currentStatusCode: 4,
          estimateStale: true,
          estimatedCustomsClearanceDate: "2026-02-13T12:00:00+09:00",
          customs: {
            events: [{ status: "통관완료", statusCode: 4, datetime: "2026-02-13T12:00:00+09:00" }]
          },
          delivery: { carrier: "국내택배 자동 조회", carrierCode: "AUTO", invoiceNumber: FAKE.domestic, events: [] },
          timeline: [],
          lastUpdated: "2026-02-13T12:00:00+09:00"
        }
      })
    });
  });

  await page.goto(`/${FAKE.domestic}`);

  const summary = page.locator('[data-status-slot="settled"]');
  await expect(summary.getByText("배송 이력 확인 필요")).toBeVisible();
  await expect(summary.getByText("확인 필요", { exact: true })).toBeVisible();
  await expect(summary.getByText("오늘 예상")).toHaveCount(0);
  await expect(summary.getByText("마지막 처리 이후 오래 지났습니다", { exact: false })).toBeVisible();
});
```

with

```ts
test("a stale shipment shows a verification prompt instead of a delivery estimate", async ({ page }) => {
  const data: TrackResponseData = {
    trackingNumber: FAKE.domestic,
    type: "DOMESTIC",
    currentStatus: "통관완료",
    currentStatusCode: 4,
    estimateStale: true,
    estimatedCustomsClearanceDate: "2026-02-13T12:00:00+09:00",
    customs: {
      events: [{ status: "통관완료", statusCode: 4, datetime: "2026-02-13T12:00:00+09:00" }]
    },
    delivery: { carrier: "국내택배 자동 조회", carrierCode: "AUTO", invoiceNumber: FAKE.domestic, events: [] },
    timeline: [],
    lastUpdated: "2026-02-13T12:00:00+09:00"
  };
  const view = deriveStatusView(
    { kind: "success", request: { number: FAKE.domestic, carrier: "AUTO", entry: "deepLink" }, data },
    FIXTURE_NOW
  );
  if (view.eta.kind !== "withheld") throw new Error(`unexpected ETA kind ${view.eta.kind}`);
  const chipState = (view.chip ?? "").split(" · ")[0] ?? "";
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, data);

  await page.goto(`/${FAKE.domestic}`);

  const summary = page.locator('[data-status-slot="settled"]');
  await expect(summary.locator('[data-eta-kind="withheld"]').getByText(view.eta.text, { exact: true })).toBeVisible();
  await expect(summary.getByText(chipState, { exact: true })).toBeVisible();
  await expect(summary.getByText(resultCopy.etaTodayLabel)).toHaveCount(0);
  await expect(summary.getByText(view.nextAction.sentence, { exact: true })).toBeVisible();
  await expect(summary.locator('[data-action-weight="primary"]')).toHaveAttribute("data-action-kind", "copyAndTalk");
  await expect(summary.getByText("배송 이력 확인 필요")).toBeVisible(); // approval-2 literal
  await expect(summary.getByText("확인 필요", { exact: true })).toBeVisible(); // approval-2 literal
  await expect(summary.getByText("오늘 예상")).toHaveCount(0); // approval-2 literal
  await expect(summary.getByText("마지막 처리 이후 오래 지났습니다", { exact: false })).toBeVisible(); // approval-2 literal
});
```

- [ ] **Step 5: Run both sets while the ledger still says pending**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/tracking.spec.ts tests/privacy.spec.ts`
Expected: 0 failed. The literal and the view assertions pass side by side because `STATUS_SLOT_APPROVALS.approval2` is still `false`: the page shows the `LEGACY_RESULT_COPY` overlay, which is exactly what `deriveStatusView` returns. A failure here means a view assertion names the wrong element — fix the new line, never the marked one.
Run: `npm run typecheck; npx eslint tests/tracking.spec.ts tests/privacy.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing (`mockTrackSuccess` is gone, every new import is used).

- [ ] **Step 6: Delete the marked literal assertions**

Run: `node -e "const fs=require('fs');for(const f of process.argv.slice(1)){const t=fs.readFileSync(f,'utf8');fs.writeFileSync(f,t.split('\n').filter((l)=>!l.trimEnd().endsWith('// approval-2 literal')).join('\n'));}" tests/tracking.spec.ts tests/privacy.spec.ts`
Expected: no output.
Run: `Select-String -LiteralPath tests/tracking.spec.ts, tests/privacy.spec.ts -Pattern 'approval-2 literal|통관대기|정상 통관 대기|배송 이력 확인 필요|배송 완료 예상일|mockTrackSuccess'`
Expected: no output.

- [ ] **Step 7: Run them again**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/tracking.spec.ts tests/privacy.spec.ts`
Expected: 0 failed, the same test count as Step 5.
Run: `npm run typecheck; npx eslint tests/tracking.spec.ts tests/privacy.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 8: Point S04's own E2E at hooks instead of state headings**

Use the Edit tool:
- `tests/e2e/loading-timeline.spec.ts` (replace_all: true): `page.getByRole("heading", { name: "통관 정보 등록 전" })` → `statusSlot(page).locator('[data-guide-key="pending"]')` (3 occurrences: the cancel test, the new-submit test, the slow-answer test).
- `tests/e2e/loading-timeline.spec.ts` (replace_all: true): `page.getByRole("heading", { name: "국내 배송 중" })` → `statusSlot(page).locator('[data-guide-key="inTransit"]')` (2 occurrences, the new-submit test).
- `tests/e2e/failure-causes.spec.ts`: `page.getByRole("heading", { name: "국내 배송 중" })` → `statusSlot(page).locator('[data-guide-key="inTransit"]')` (1 occurrence, "offline: one automatic re-lookup when the connection returns").
- `tests/e2e/status-slot.spec.ts`: `page.getByRole("heading", { level: 2, name: "국내 배송 중" })` → `page.getByRole("heading", { level: 2, name: expectedResult(trackData("inTransit")).title })` (1 occurrence, "the details below the slot are one result region; the legacy summary is gone").

Run: `Select-String -LiteralPath tests/e2e/loading-timeline.spec.ts, tests/e2e/failure-causes.spec.ts, tests/e2e/status-slot.spec.ts -Pattern '"통관 정보 등록 전"|"국내 배송 중"'`
Expected: no output.
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/loading-timeline.spec.ts tests/e2e/failure-causes.spec.ts tests/e2e/status-slot.spec.ts`
Expected: 0 failed (same counts as before this step).

- [ ] **Step 9: Commit the test contract change**

```powershell
git add tests/tracking.spec.ts tests/privacy.spec.ts tests/e2e/loading-timeline.spec.ts tests/e2e/failure-causes.spec.ts tests/e2e/status-slot.spec.ts
git commit -m "test: assert the result rules through the view model and hooks (approval 2)"
```

- [ ] **Step 10: Write the failing tests for the configured copy**

In `tests/unit/status-view.spec.ts`:

(a) replace

```ts
test("ledger: approval 2 is pending (roadmap §4)", () => {
  expect(STATUS_SLOT_APPROVALS.approval2).toBe(BOTH_PENDING.approval2);
});
```

with

```ts
test("ledger: approval 2 is approved (roadmap §4)", () => {
  expect(STATUS_SLOT_APPROVALS.approval2).not.toBe(BOTH_PENDING.approval2);
});
```

(b) replace `import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";` with

```ts
import { FIXTURE_NOW, GAP3_06_VARIANTS, trackData } from "../fixtures/tracking-fixtures";
```

(c) append at the end of the file:

```ts
test("approval 2 granted: the page's result views are deriveTrackingView's own, with the configured copy", () => {
  for (const state of GAP3_06_VARIANTS) {
    const outcome = success(trackData(state));
    expect(deriveStatusView(outcome, FIXTURE_NOW), state).toEqual(base(outcome));
  }
  const pickedUp = success(pickedUpData());
  expect(deriveStatusView(pickedUp, PICKUP_NOW)).toEqual(base(pickedUp, PICKUP_NOW));
  const inTransit = success(inTransitData());
  expect(deriveStatusView(inTransit, OCTOBER_NOW)).toEqual(base(inTransit, OCTOBER_NOW));
});
```

In `tests/e2e/status-slot.spec.ts`:

(d) replace `import { deriveStatusView } from "@/components/status-slot/status-view";` with

```ts
import { LEGACY_RESULT_COPY, deriveStatusView } from "@/components/status-slot/status-view";
```

(e) replace `import type { LookupEntry, TrackingViewModel } from "@/lib/tracking/types";` with

```ts
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import type { LookupEntry, TrackingViewModel } from "@/lib/tracking/types";
```

(f) append at the end of the file:

```ts
test("approval 2: results show the configured wording, with no pre-renewal overlay", async ({ page }) => {
  const data = trackData("customsWaiting");
  const configured = deriveTrackingView(
    { kind: "success", request: { number: data.trackingNumber, carrier: "AUTO", entry: "manual" }, data },
    FIXTURE_NOW,
    siteConfig
  );
  expect(configured.title).not.toBe(LEGACY_RESULT_COPY.customsWaitingTitle);
  await showResult(page, data, FIXTURE_NOW);
  const slot = statusSlot(page);
  await expect(slot.locator("[data-guide-key]").getByRole("heading", { level: 2 })).toHaveText(configured.title);
  await expect(slot.getByText(configured.nextAction.sentence, { exact: true })).toBeVisible();
  await expect(slot.getByText(LEGACY_RESULT_COPY.sentences.customsWaiting, { exact: true })).toHaveCount(0);
  await expect(liveRegion(page)).toHaveText(configured.liveMessage);
});
```

- [ ] **Step 11: Run them to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/status-view.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `2 failed`: "ledger: approval 2 is approved (roadmap §4)" (received `false`) and "approval 2 granted: …" (the message names the first GAP3-06 variant the overlay changes — `customsArrived` or `customsWaiting` — with the overlay's ETA label '배송 완료 예상일' or title '통관대기' against the configured copy). Every other test passes.
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/status-slot.spec.ts`
Expected: FAIL — `1 failed`: "approval 2: results show the configured wording…" at the h2 `toHaveText` (received '통관대기'); the other tests pass.

- [ ] **Step 12: Record the approval in the slot's ledger**

In `components/status-slot/status-view.ts` replace `{ approval2: false,` with `{ approval2: true,` (the only occurrence, in the `STATUS_SLOT_APPROVALS` line; `approval3` keeps whatever value it has).

- [ ] **Step 13: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: 0 failed (`status-view.spec.ts`: the "approval 2 pending: …" describe block still passes because it passes its approvals explicitly; `derive-view.spec.ts`, `config.spec.ts`, `cs-reply.spec.ts` unchanged — S04 never edits `config/site.config.ts`).
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/tracking.spec.ts tests/privacy.spec.ts tests/internal-cs-helper.spec.ts tests/e2e`
Expected: 0 failed — the result tests now see the spec §7 copy through the same view assertions; `status-slot.spec.ts` gains 1 pass; S02's suites pass unchanged.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 14: Commit**

```powershell
git add components/status-slot/status-view.ts tests/unit/status-view.spec.ts tests/e2e/status-slot.spec.ts
git commit -m "feat: show the configured result copy in the status slot (approval 2)"
```
Expected: one commit. Write "Task 10 DONE — approval 2 approved; the page renders deriveTrackingView's copy" into the stage summary.

---

### Task Final: Stage gate

- [ ] **G1. Port free.** `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue` → no output (stop listeners otherwise).
- [ ] **G2. Lint.** `npm run lint` → exit 0, no errors, no warnings introduced by this stage.
- [ ] **G3. Typecheck.** `npm run typecheck` → exit 0.
- [ ] **G4. Build.** `npm run build` → exit 0. Route table: `ƒ /[trackingNumber]` always; `/` is `ƒ` in S01 (it still reads `searchParams`), `○ /` from S02 on, and `○ /` with `Revalidate 5m` from S06 on.
- [ ] **G5. Dev-mode E2E.** `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npm run test:e2e` → "N passed", 0 failed (skips allowed only for tests guarded by `PW_MODE`, `PW_SHOTS`, `PW_VISUAL`, or an approval-gated `test.skip` naming the approval).
- [ ] **G6. Production-mode E2E.** Re-run `npm run build` if `next start` reports a missing or stale build. Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait for `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` = `200`; then `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test` → 0 failed, including `tests/budgets/*`.
- [ ] **G7. After-screens.** Server still running: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='after'; $env:PW_STAGE='S04'; npx playwright test tests/tools/stage-screens.spec.ts` → PNGs in `test-results/stage-screens/S04-after/` at 320, 375, 768, 1024, 1440. Compare with `S04-before/`; send both sets to the operator with SendUserFile. Stop the server (G1 command) and clear the flags: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.
- [ ] **G8. Budgets.** Paste the measured numbers of every budget this plan lists (from the G6 output) into the stage summary. Any budget over its fail line fails the gate.
- [ ] **G9. Code review.** Invoke the `code-review` skill on `git diff claude/tipoasis-tracking-renewal-ae0e3a...HEAD`. Fix every CRITICAL and HIGH finding; if code changed, re-run G2–G6.
- [ ] **G10. Verification.** Invoke `superpowers:verification-before-completion`; paste each command and its result line into the stage summary.
- [ ] **G11. Commit.** `git status` shows only this stage's files (see the roadmap File Map). Commit any remainder with a conventional message and no attribution trailer.
- [ ] **G12. No deploy.** Do not push to `main`; do not run `vercel deploy`. Push `renewal/s04-r2-status-slot` only if the operator asked. Hand the stage summary to the operator; merge into the integration branch only after acceptance (roadmap §5).

**S04 notes on the gate steps above**
- G4: the expected route table is `ƒ /[trackingNumber]` and `○ /`. S04 adds only client code and static config reads; a `ƒ /` means a server read of `searchParams`, `headers()` or `cookies()` crept into `app/(public)/page.tsx` or its imports — find it with `git diff claude/tipoasis-tracking-renewal-ae0e3a...HEAD -- app` and remove it before going on.
- G5: `npm run test:e2e` is `playwright test`, so it also runs `tests/unit/*` (module boundaries, the real-number guard, the reducer, the fetcher, the status view). S04 adds no `test.skip`: Tasks 9 and 10 add their tests only when their approval is recorded. Approval-4 case: if G5 (or an earlier run in Task 6) fails only at `tests/tracking.spec.ts` › "pending state offers inquiry and purchase-channel choices" on the literal '정보 반영까지 시간이 걸릴 수 있어 2~3시간 뒤 다시 확인해 주세요.' because approval 4 was granted and S03 Task 15 changed `durations.pendingRecheck`, replace that one literal with `durations.pendingRecheck` (add `durations` to an `@/config/site.config` import) as S03 Task 15 Step 6 prescribes, re-run, and record it in the stage summary.
- G7: the PNGs land in `test-artifacts/stage-screens/S04-after/` (S01 addition 1; read every `test-results/stage-screens/…` path above that way). Task 7 appended four scenarios (`deeplink-serverError`, `deeplink-rateLimited`, `deeplink-stale`, `deeplink-ambiguous`), so the after-set has 55 PNGs (11 scenarios × 5 widths) while the before-set from Task 0 has none of those four; say so when sending both sets.
- G8: S04's budgets (roadmap §9) are behavioural. Paste the G6 result lines of: `loading-timeline.spec.ts` › "a slow but valid answer (29.19 s before the server fix) still shows its result" (the delay used is `Math.min(29_190, lookup.timeoutMs - 4_000)` ms; write the number), "one polite live region is in the server HTML and stays the only one"; focus: `status-slot.spec.ts` › "a manual result fills the slot under the form…", "deep link: the result takes focus when the customer has not touched the page", "deep link: focus stays where the customer is once they interacted…", and `failure-causes.spec.ts` › "an invalid number keeps focus in the input and describes the error there". S01's font-preload budget in `tests/budgets/*` must stay green. JS size budgets start at S07; note in the summary that `components/HomePageClient.tsx` imports `siteConfig` and `deriveTrackingView` statically until S06/S07 (contract deviation 3).
- G9: ask the review to check in particular: no `setState` during render or in effects without a guard (`react-hooks/*`), clocks read only in callbacks/effects, one filled button per screen, `role="alert"` never on a focused heading, no server `message` text reaching the DOM, and `fetchTrack` being the only `/api/track` caller in `components/` and `lib/tracking/`.
- [ ] **G10a (S04, run before G11): Leftovers and invariants.**
  Run: `git grep -n -e "S04-BRIDGE" -e "TrackingResultSummary" -e "components/LoadingSpinner" -e "components/ErrorMessage" -e "components/ui/alert" -e "components/ui/skeleton" -e "cs-reply-template" -e "buildCsDeliveryGuide" -- app components lib tests`
  Expected: no output.
  Run: `git grep -n "관리자에게" -- components lib`
  Expected: no output (the server wording lives only in `app/api/track/route.ts`, which S04 does not touch).
  Run: `git grep -n -e "aria-live" -e "role=.status" -- app components`
  Expected: exactly one line, in `components/primitives/LiveAnnouncer.tsx`. A line from another file breaks spec §5 "one polite live region" — remove it (S05 primitives must not render live regions either, contract §11.9). (The patterns use `.` for the quote character: PowerShell 5.1 strips embedded double quotes from native-command arguments.)
  Run: `git grep -n "role=.alert" -- app components`
  Expected: exactly two lines, both in `components/status-slot/FailureNotice.tsx` (the invalid-number sentence and the error reason).
  Run: `git grep -n "fetch(" -- components lib/tracking`
  Expected: exactly one line, `lib/tracking/fetch-track.ts: … const response = await fetch(TRACK_ENDPOINT, {` — no component calls `fetch` (the page goes through `useLookup`, the internal helper through `fetchTrack`).
- G11: `git diff --name-status claude/tipoasis-tracking-renewal-ae0e3a...HEAD` must list exactly —
  A: `lib/tracking/lookup-state.ts`, `lib/tracking/fetch-track.ts`, `lib/cs/mismatch-templates.ts`, `components/primitives/LiveAnnouncer.tsx`, `components/lookup/useLookup.ts`, `components/status-slot/{status-view.ts,StatusSlot.tsx,LoadingTimeline.tsx,SlotParts.tsx,FailureNotice.tsx,WorryLine.tsx,CopyInquiryButton.tsx,ResultSummary.tsx}`, `tests/unit/{lookup-state,fetch-track,status-view}.spec.ts`, `tests/e2e/{loading-timeline,failure-causes,status-slot,cta-consistency}.spec.ts`, `tests/support/status-slot.ts`;
  M: `components/TrackingForm.tsx`, `components/HomePageClient.tsx`, `components/CustomerCta.tsx`, `components/RecommendedProducts.tsx`, `components/InternalCsHelper.tsx`, `lib/cs/mismatch-storage.ts`, `tests/unit/mismatch-storage.spec.ts`, `tests/tracking.spec.ts`, `tests/privacy.spec.ts`, `tests/internal-cs-helper.spec.ts`, `tests/tools/stage-screens.spec.ts`;
  D: `components/LoadingSpinner.tsx`, `components/ErrorMessage.tsx`, `components/ui/skeleton.tsx`, `components/ui/alert.tsx`, `components/TrackingResultSummary.tsx`, `lib/services/cs-reply-template.ts`.
  `config/site.config.ts`, `lib/tracking/*` other than the two new files, `lib/schemas.ts`, `lib/types.ts`, `lib/services/*` (apart from the deletion) and `app/api/track/route.ts` must not appear.
- G12: the stage summary contains — the approval statuses read in Task 0 and the result of Tasks 9 and 10 (DONE or SKIPPED with the reason); "S02 history entry: shipped / not shipped" (Task 0 Step 10) and whether the `S02-HISTORY-ENTRY` blocks were kept; whether Task 8 ran before or after approval 2 (Task 8's rule note); the baseline counts (Task 0 Step 6) and the G5/G6 counts; the G8 lines; the before/after screen sets; contract deviations 1–6 and additions 1–8 of this plan; the open issues listed in the Self-Review.

---

## Additions to the contract (continued, Tasks 9–10 and the gate)

6. **No new cross-stage names.** Tasks 9 and 10 add only test-local helpers: `ALL_CAUSES` (`tests/unit/status-view.spec.ts`), `APPROVED_PRIMARY` (`tests/e2e/failure-causes.spec.ts`), `resultView`, `STORE_LINKS`, `disclosureComesFirst` and the optional `now` parameter of `createTrackData` (`tests/tracking.spec.ts`).
7. **File Structure rows extended:** `tests/e2e/failure-causes.spec.ts` is also modified by Tasks 9 and 10, `tests/e2e/loading-timeline.spec.ts` and `tests/e2e/status-slot.spec.ts` by Task 10 (all three are S04-created files, so the roadmap File Map is unchanged).
8. **Imports S07 must clean up:** after Task 10, `tests/tracking.spec.ts` and `tests/privacy.spec.ts` import S04-private `deriveStatusView` (plus `channels`, `disclosures`, `resultCopy`, `FIXTURE_NOW`, `mockTrack`, `TrackResponseData`). S07 Task 8 deletes `tests/tracking.spec.ts` and removes the privacy stale test before S07 Task 10 deletes `components/status-slot/`; when it removes the stale test it must also remove the imports only that test used (`deriveStatusView`, `resultCopy`, `TrackResponseData`, `FIXTURE_NOW`, `mockTrack`), or lint fails on unused imports.

## Contract deviations (continued)

6. **Tasks 9 and 10 flip the S04 ledger constant and keep the fallback code.** After a flip, `LEGACY_RESULT_COPY` / `withLegacyCopy` (approval 2) or `withTalkFirst` (approval 3) no longer reach the page but stay in `components/status-slot/status-view.ts` with their unit tests, because the ledger is read per stage and S07 deletes the directory anyway; removing them would make the two gated tasks order-dependent.

---

## Self-Review

**1. Spec and scope coverage** (stage scope S04 → task):

| Scope item | Task |
|---|---|
| `lib/tracking/lookup-state.ts`: reducer, failure streak, late answers ignored | 1 |
| `lib/tracking/fetch-track.ts`: only `/api/track` caller, lazy schema, `FailureInput` for non-JSON / wrong content type / empty body / contract violation / network vs offline / timeout / abort; server `message` never read | 2 |
| `components/lookup/useLookup.ts`: AbortController per submit, `config.lookup.timeoutMs` (45 s before approval 5), stage timers 0.4/3/8 s, spinner stop at 5 s, elapsed 5 s steps, reduced motion, one automatic re-lookup when back online | 4 (tests 4 and 5) |
| 429 countdown on [다시 조회], no automatic retry | 5 (`SlotParts.useCooldown`, E2E "429: …") |
| `components/primitives/LiveAnnouncer.tsx`: one polite region in the server HTML | 4 |
| `StatusSlot` directly under the current form; `LoadingTimeline` with [조회 취소]; `FailureNotice`; `ResultSummary`; `WorryLine`; `CopyInquiryButton` with the clipboard fallback | 4, 5, 6 |
| Focus to the visible status `h2` (`tabindex=-1`); deep links only if the customer has not interacted; invalid number keeps focus in the input | 4 (`HomePageClient`), tests 5–6 |
| `role="alert"` only on error sentences; inputs `aria-busy`, never `disabled` | 4, 5; G10a greps |
| Per-cause errors, no server wording, 2 consecutive failures promote copy-and-talk | 5 |
| Worry-date line bound to 톡톡; [문의 내용 복사하고 톡톡 열기] | 5, 6 |
| GAP3-06: `CustomerCta`, `RecommendedProducts` and the summary from the view; no affiliate/recommendation in problem states; page-level store placements only on idle | 5, 6, 7 |
| `InternalCsHelper` → `buildCsReply`; `CUSTOMS_MISMATCH_TEMPLATES` → `lib/cs/mismatch-templates.ts`; delete `lib/services/cs-reply-template.ts` | 8 |
| Delete `TrackingResultSummary`, `ErrorMessage`, `LoadingSpinner`, `components/ui/{alert,skeleton}.tsx` | 4, 6; G10a |
| Tests: `tests/unit/{lookup-state,fetch-track}.spec.ts`, `tests/e2e/{status-slot,loading-timeline (29.19 s pending still renders pending),failure-causes,cta-consistency}.spec.ts`; tracking/privacy/internal-cs-helper updates | 1, 2, 4, 5, 6, 7, 8, 10 |
| Approval 2 (copy-bound assertion replacement) with its fallback | 3 (fallback), 6 (re-point), 10 (gated) |
| Approval 3 (error button weights) with its fallback | 3 (fallback), 9 (gated) |
| Stage start / gate | 0, Final |

No scope item is without a task.

**2. Placeholder scan.** Searched the plan for "TBD", "TODO", "implement later", "similar to Task", "add appropriate", "handle edge cases": none. Every code step shows the code; every run step names the PowerShell command and the expected result. Conditional steps (Task 0 Step 10's `S02-HISTORY-ENTRY` blocks, the approval gates, the approval-4 case) say exactly what to do in each branch.

**3. Type and name consistency.** Checked across tasks: `LookupState`, `LookupEvent`, `INITIAL_LOOKUP_STATE`, `lookupReducer`, `lastRequestOf` (1 → 4); `FetchTrackResult`, `fetchTrack` (2 → 4, 8); `StatusSlotApprovals`, `STATUS_SLOT_APPROVALS`, `LEGACY_RESULT_COPY`, `applyApprovalFallbacks`, `deriveStatusView` (3 → 4–7, 9, 10); `LiveAnnouncerProvider`, `useAnnounce`, `UseLookupOptions`, `UseLookupResult`, `useLookup`, `StatusSlotProps`, `INVALID_NUMBER_ERROR_ID` (4 → 5–7); `RECOVERY_KINDS`, `TONE_BORDER`, `actionClassName`, `ActionControl`, `INLINE_HELP_IDS` (5 → 6); `CAUSE_BY_FIXTURE`, `expectedFailure` (Task 5 test-local → Task 9); `expectedResult`, `showResult` (Task 6 test-local → Task 10); support helpers `statusSlot`, `liveRegion`, `lookUp`, `openPaused`, `holdTrack`, `PAUSED_NOW`, `manualRequest` (4 → 5–10). Contract names are used as §11 spells them (`deriveTrackingView(outcome, now, config)`, `buildCsReply(view, { now, notices })`, `classifyFailure`, `ActionKind`, `FailureCause`, `FailureFixture`, `GAP3_06_VARIANTS`, `mockTrack(page, response, options)`). Tasks 9 and 10 edit disjoint anchors (`approval3: false };` vs `{ approval2: false,`; different import lines; `BOTH_PENDING` stays referenced by both ledger tests), so either may run first or alone.

**4. Review Focus.** The five items at the top are each pinned by a named test (Tasks 1, 2, 4, 5, 6). Tasks 9–10 add no new input class; the one new failure mode they introduce — running the two gated tasks in either order — is handled by the disjoint edits above.

**Cross-stage notes and open issues found while writing Tasks 9–Final**
- **Spec wording on 응답 없음 (approval 3).** Spec §16 item 3's proposal lists "INVALID·NOT_FOUND·응답 없음은 [번호 수정]", while the §7 row 'error · 응답 없음' says 주 행동 [다시 조회], 보조 [번호 수정]; S03's config follows §7 (`noResponse.primaryAction: "retry"`). Task 9 pins §7. If the operator's approval means [번호 수정] for 응답 없음, S03's config row changes and Task 9's `client timeout (approval 3)` expectation changes with it.
- **Approval 4 while approval 2 is pending.** Task 6 keeps the pending test's '2~3시간' literal (S03 copy equals it only while approval 4 is pending). If approval 4 is granted first, that literal must read `durations.pendingRecheck` (S03 Task 15 Step 6); Task Final's G5 note and Task 10 (h) carry the instruction.
- **S07 clean-up of the imports added by Task 10** (addition 8).
- **The approval-3 decision must be mirrored by S07's `FailureCard`** (contract deviation 1): S07 derives with `deriveTrackingView`, which is the approval-3 behaviour; while approval 3 is pending S07 needs the talk-first transform too.
