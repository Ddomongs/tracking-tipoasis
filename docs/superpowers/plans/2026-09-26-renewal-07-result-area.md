# S07 — Result Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the transitional R2 status slot and every legacy result component with the R3 result area: a lazily loaded `ResultView` (≤ 30 KB) that renders the fixed order 상태 카드 → 도착 예상 → 지금 할 일 → 마지막 처리 → `<details>` 처리 내역 for every §7 state, an initial-bundle `LoadingCard`, a `FailureCard` for every error row, the desktop two-column layout, and the read-only / mobile-frame modes the CS preview needs — then migrate the result E2E contract from copy to hooks and lock the JS budgets.

**Architecture:** Everything the result area shows comes from one `TrackingViewModel` (S03 `deriveTrackingView`). `components/result/result-module.ts` is the only lazy entry (it re-exports `ResultView`, `deriveTrackingView` and `siteConfig`); `load-result-module.ts` memoizes the dynamic import and is preloaded on submit and on deep-link start. A small initial-bundle island, `ResultSlot`, sits where S06's `LegacyResultSection` was: it shows `LoadingCard` while loading, derives the view in an effect when the lookup settles (so `now` is the settle time, never render time), then renders the lazy `ResultView` and owns the focus move to the status `h2`, the one live sentence and the document title. Components are tested first through an internal harness page (`/internal/result-kit`) that renders any view model the test derives in Node, then end to end through real deep links and manual lookups.

**Tech Stack:** Next.js 16.3.6 App Router (Turbopack), React 19.3 (`useEffectEvent`), TypeScript strict, Tailwind CSS 3.4 with the S05 `tt-*` keys, S05 primitives, S03 pure modules, Playwright 1.55 (the only runner; `tests/unit/*` without a page).

**Spec:** `docs/superpowers/specs/2026-09-26-tracking-renewal-ia-design.md` — §1 (E2E-locked rules, success criterion "결과 첫 화면에 상태·예상일·지금 할 일"), §2 원칙 1–4, §3 (데스크톱 1440 two columns), §5 (loading timeline, per-cause errors, focus and live region), §6 (result order, number bar, status card, spine, ETA, 지금 할 일, overdue, 상세, 결과 도착 시), §7 (every row from loading to ambiguous), §8 (placement per state), §12 (a11y and JS budgets), §13 (B supplements: field cap, amber attention), §14 (component boundaries and the test contract), §16 items 2, 3, 4, 13. **Roadmap and shared contract:** `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` (§4 approvals, §6 Task 0, §7 gate, §9 budgets, §10 File Map, §11 contract; every cross-stage name below is used exactly as written there). **Upstream plans consumed:** S01 (`tests/fixtures/tracking-fixtures.ts`, `tests/support/prod-mode.ts`, stage-screens tool), S02 (`lib/clipboard.ts`, return-link E2E), S03 (`lib/tracking/*`, `config/site.config.ts`, `tests/fixtures/derive-scenarios.ts`), S04 (`useLookup`, `LiveAnnouncer`, `components/status-slot/*`, its E2E files), S05 (`components/primitives/*`, `app/styles/tokens.css`), S06 (`LookupController`, `LegacyResultSection`, `tests/e2e/RULE-MAP.md`).

**Depends on:** S03, S05, S06 (and through them S01, S02, S04 — all merged into `claude/tipoasis-tracking-renewal-ae0e3a` before this stage starts).

**Gated by:** approval 2 (BLOCKING for the whole stage; the result test migration in Task 8 follows it), approval 3 (Task 13: error-screen button weights), approval 4 (Task 14: the pending CTA help line), approval 13 (Task 15: `tests/e2e/result-a11y.spec.ts` with `@axe-core/playwright`).

**Release / order:** R3, user order #3. Branch `renewal/s07-result-area`.

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

**S07-specific constraints**
- `ResultView` renders only view-model strings, config copy, and the few spec-given literals this stage owns: '마지막 처리', '처리 내역', '전체 보기', '택배사 선택'. The only config change of this stage is Task 2's four `resultCopy` fields (return-link and inquiry feedback); every other string comes from `TrackingViewModel`, `LoadingViewModel` or S05 primitives.
- `ResultView` never renders the number bar. `LookupController` (S06) renders `NumberBar` above the result slot; the CS preview (S09) composes `NumberBar` + `ResultView` the same way.
- Nothing under `components/result/` renders `aria-live`, `role="status"` or `role="alert"`. The one announcer is S04's `LiveAnnouncerProvider`; `ResultSlot` calls `useAnnounce()` once per settled view.
- Initial-bundle files of this stage are exactly `components/result/ResultSlot.tsx`, `components/result/LoadingCard.tsx` and `components/result/load-result-module.ts`. They never statically import `ResultView.tsx`, `result-module.ts`, `lib/tracking/derive-view.ts`, `lib/tracking/derive/*`, `zod`, `lib/schemas.ts`, `lib/config/{schema,server,invariants}.ts`, `lib/delivery-carriers.ts` or `lib/cs/*` (`tests/unit/result-module.spec.ts`).
- Lint is eslint-config-next 16 with eslint-plugin-react-hooks 7 (`set-state-in-effect`, `refs`, `purity`, `static-components` are errors). Therefore: no synchronous `setState` inside an effect body (state changes happen in event handlers, timers or promise callbacks), no `ref.current` reads or writes during render, no `new Date()`/`Date.now()` during render, no component created during render, and effect-only callbacks use React 19's `useEffectEvent`.
- `invalidNumber` failures are shown by the lookup form area (S06 owns the invalid-input error block with `data-guide-key="invalidNumber"`, contract §11.13); `ResultSlot` renders nothing for them. `FailureCard` still renders invalid views so the CS preview can show every state.
- Every existing E2E business rule keeps an assertion. The S07 rows of `tests/e2e/RULE-MAP.md` are written before any old assertion is removed, and old tests are removed only after their new assertions pass (spec §14 test contract 1; Task 8).
- `/internal/result-kit` is a test harness: internal route group (basic auth, `noindex`, no ads), renders only the view model a test hands it through `window.__ttResultKit`, and is never linked from a public page.
- Stage screenshots go to `test-artifacts/stage-screens/S07-{before,after}/` (S01 "Additions to the contract" item 1: Playwright empties `test-results/` at the start of every run, so Task 0 Step 6 would delete before-screens written there). Task 0 Step 5 and gate G7 below are the roadmap §6/§7 text with that one path applied, as S03, S04 and S06 did.
- No real or unidentified tracking number, phone number or fragment of one appears in code, tests, test titles, commit messages or screenshots; tests take numbers from `tests/fixtures/tracking-fixtures.ts` and `tests/fixtures/derive-scenarios.ts` only.

## Review Focus

Conditions the spec implies but no rule names; each is pinned by a test in the owning task.

1. **A customer whose browser is not on Korean time** (an overseas buyer with the system zone `America/New_York`, or a device clock hours off): the dates, D-n, worry line and the overdue switch on the real page must equal the KST view derived in Node; overdue flips at KST midnight even when it is still the previous evening locally. Owner: Task 8 (`tests/e2e/result-states.spec.ts` "a browser in America/New_York shows the KST view").
2. **Clipboard blocked in the result screen** (Naver/Kakao in-app browsers reject `navigator.clipboard.writeText` and `execCommand('copy')` returns `false`): [문의 내용 복사하고 톡톡 열기] must still open 톡톡 and leave a selectable box with the exact inquiry text; [다시 볼 링크 복사] must show a pre-selected read-only box with the return link. Owner: Task 2 (`tests/e2e/result-kit.spec.ts` "blocked clipboard …").
3. **The lazy result module cannot load** (a new deploy replaced the chunks while the tab stayed open, or the connection dropped right after the lookup): the area must show the 톡톡 fallback instead of an empty space or a card that spins forever, and opening the link again must show the result. Owner: Task 8 (`tests/e2e/result-states.spec.ts` "a result module that cannot load …"); the loader forgets a failed import so the next lookup tries again (Task 1, `tests/unit/result-module.spec.ts` "a failed import is retried").
4. **Very long values at 320 px** (an 18-digit cargo number inside the inquiry text, a 40-character event place, a long original customs term): no horizontal scroll, words wrap, nothing is truncated. Owner: Task 5 (`tests/e2e/result-kit.spec.ts` "long places, terms and inquiry text wrap at 320 px").
5. **Double activation** (a double click or double tap on a carrier chip; repeated clicks on [다시 조회] during the 429 countdown): exactly one carrier choice is reported and no retry is reported before the countdown ends. Owners: Task 3 ("a double click reports one choice") and Task 6 ("429: …").

## Additions to the contract

Everything below is additive; no §11 name is renamed or retyped. Each item goes into the stage summary as a contract deviation so the roadmap can be amended (roadmap §5 "Contract changes").

1. **`ResultViewProps` gains `readonly failureCause?: FailureCause`.** `LookupOutcome` carries the cause, `TrackingViewModel` does not; `ResultSlot` (and the CS preview) pass it so `FailureCard`'s root can carry `data-failure-cause` (contract §11.13).
2. **New S07 export `ResultSlot` (`components/result/ResultSlot.tsx`, client, initial bundle)** with `ResultSlotProps { entry: TrackingEntry; loadingConfig: LoadingConfig; state: LookupState; loading: LoadingViewModel | null; onAction: (action: ResultAction) => void; headingRef?: React.RefObject<HTMLHeadingElement | null>; onView?: (view: TrackingViewModel) => void; renderRecommendations?: (view: TrackingViewModel, outcome: LookupOutcome) => React.ReactNode }`. `LookupController` renders it where `LegacyResultSection` was. It shows `LoadingCard` (first paint of a deep link included), derives the view in an effect when the lookup settles, renders the lazy `ResultView`, sets the document title, announces `view.liveMessage` once, and moves focus to the status `h2` (deep links, restores and online auto-retries only when the customer has not interacted). It also preloads the result module on submit, on deep-link start, and when focus enters `[data-lookup-form]` (lookup intent), so an offline error can still be drawn. S08 passes recommendations through `renderRecommendations` and reads the view through `onView`.
3. **`LoadingCard` renders every stage including `"instant"`;** the caller decides visibility. `ResultSlot` hides it during the instant stage only for `entry: "manual"` (the form's busy label covers 0–0.4 s).
4. **`loadResultModule()` forgets a failed import** so the next call retries (Review Focus 3).
5. **[다시 볼 링크 복사] is `ReturnLinkAction` (`components/result/ReturnLinkAction.tsx`), not `CopyButton`.** S02's note said `CopyButton`, but the spec wants the share sheet first on mobile and `CopyButton` has no share mode. It keeps S02's accessible name, share/copy/fallback behavior and `textarea[readonly][data-copy-fallback]`.
6. **`ResultCopyConfig` gains four fields** (Task 2): `returnLinkCopied` '링크를 복사했어요', `returnLinkShared` '링크를 공유했어요', `returnLinkFallback` '아래 링크를 길게 눌러 복사해 주세요.' (S02's transitional strings, moved into config), `inquiryCopied` '문의 내용을 복사했어요'; each with the empty slot list in `RESULT_COPY_SLOTS`. File Map rows `lib/config/types.ts`, `lib/config/invariants.ts` and `config/site.config.ts` gain "M S07".
7. **File Map additions (all C S07):** `components/result/ActionControl.tsx`, `components/result/ReturnLinkAction.tsx`, `components/result/HelpItems.tsx`, `components/result/details.ts`, `components/result/ResultSlot.tsx`, `app/(internal)/internal/result-kit/page.tsx`, `app/(internal)/internal/result-kit/ResultKitHarness.tsx`, `tests/e2e/result-kit.spec.ts`, `tests/unit/result-module.spec.ts`. With approval 13 and no earlier stage having added it: `package.json`, `package-lock.json` (M S07, `@axe-core/playwright` dev dependency).
8. **`data-*` hooks added by S07** (tests and S08/S09 may select them): `data-result-view` (`settled|error`, `ResultView` root), `data-result-main`, `data-side-column`, `data-frame` (`responsive|mobile`), `data-read-only`, `data-recovery` (recovery row in `FailureCard`), `data-auxiliary-line`, `data-worry-line`, `data-next-note`, `data-inquiry-preview`, `data-last-event`, `data-history` (the `<details>`), `data-history-empty`, `data-history-segment`, `data-history-recent`, `data-help` (help `<details>`, value = help id), `data-help-list`, `data-delivered-help`, `data-carrier-chooser`, `data-recommendation-slot`, `data-result-pending`, `data-result-module-failure`, `data-loading-skeleton` (`journey|eta|next-action`), `data-loading-extra`, `data-loading-elapsed`, `data-spinner`, `data-cooldown`, `data-result-kit` (`ready`, harness only).
9. **Internal harness API (tests only):** `window.__ttResultKit: ResultKitApi { show(scene: ResultKitScene): void; actions(): readonly ResultAction[] }` with `ResultKitScene = { kind: "result"; view; frame?; readOnly?; failureCause?; withRecommendation? } | { kind: "loading"; loading }` (the loading scene is added in Task 7).

## File Structure

| File | Action (task) | Responsibility |
|---|---|---|
| `components/result/StatusCard.tsx` | Create (1) | 상태 카드: chip, status `h2` (focus target), reason, spine, in-card '안내', `EtaDisplay`, auxiliary rows — inside the `status-head` field |
| `components/result/ResultView.tsx` | Create (1), Modify (2, 3, 4, 5, 6, 14) | Lazy root: settled flow or `FailureCard`, two-column layout, mobile frame, read-only guard, external-link reporting |
| `components/result/result-module.ts` | Create (1) | The one lazy entry (contract §11.9) |
| `components/result/load-result-module.ts` | Create (1) | Memoized dynamic import, preload, retry after failure |
| `app/(internal)/internal/result-kit/page.tsx`, `ResultKitHarness.tsx` | Create (1), Modify harness (7) | Internal test harness rendering any view model or loading model |
| `config/site.config.ts`, `lib/config/types.ts`, `lib/config/invariants.ts` | Modify (2) | Four `resultCopy` feedback strings |
| `components/result/ActionControl.tsx` | Create (2) | One `ActionView` → the matching control (button, link, copy, return link, retry with cooldown) |
| `components/result/ReturnLinkAction.tsx` | Create (2) | [다시 볼 링크 복사]: share sheet first on touch screens, copy, selectable fallback |
| `components/result/details.ts` | Create (2) | `openDetails(id)` for in-page help and '전체 보기' |
| `components/result/NextActionBlock.tsx` | Create (2), Modify (14) | 지금 할 일: heading, sentence, ≤ 1 primary, 1–2 secondary, worry line with one 톡톡 link, stores in the rule's order, chooser slot, note |
| `components/result/CarrierChooser.tsx` | Create (3) | fieldset '택배사 선택' with five 44 px radio chips; pointer choice or Space/Enter chooses |
| `components/result/LastEventLine.tsx`, `HistoryDetails.tsx`, `HelpItems.tsx`, `DeliveredHelp.tsx` | Create (4) | 마지막 처리, `<details>` 처리 내역 by station, help `<details>`, 미수령 안내 |
| `components/result/SideColumn.tsx` | Create (5) | Desktop right column: recent 3 + 전체 보기, help items |
| `components/status-slot/FailureNotice.tsx` → `components/result/FailureCard.tsx` | Move + rewrite (6) | Error status card with recovery row, error CTA block (톡톡 first), help |
| `components/status-slot/LoadingTimeline.tsx` → `components/result/LoadingCard.tsx` | Move + rewrite (7) | Initial-bundle loading card for every stage; finite spinner |
| `components/result/ResultSlot.tsx` | Create (8) | Initial-bundle island replacing `LegacyResultSection` |
| `components/lookup/LookupController.tsx` | Modify (8, 9) | Render `ResultSlot`; drop S06's settle derivation/focus/title/announce; legacy recommendations through `next/dynamic` |
| `components/lookup/lookup-display.ts`, `tests/unit/lookup-display.spec.ts` | Modify (Task 9 Part A, applied in Task 8 Step 8 (h)) | One result display instead of S06's `pending`/`slot` split |
| `tests/e2e/RULE-MAP.md` | Modify (8) | S07 rule → assertion rows |
| `tests/unit/normalizer.spec.ts` | Create (8) | The normalizer assertions moved out of `tests/tracking.spec.ts` |
| `tests/tracking.spec.ts` | Delete (8) | Every remaining rule has a new assertion |
| `tests/privacy.spec.ts` | Modify (8) | The stale test moves to `result-states.spec.ts` |
| `tests/e2e/status-slot.spec.ts`, `loading-timeline.spec.ts`, `failure-causes.spec.ts`, `cta-consistency.spec.ts`, `tests/support/status-slot.ts` | Modify (8, 10) | Selectors moved to the R3 DOM (the helper's `statusSlot` and a new `RESULT_SLOT_CONTENT`); no assertion or expected value dropped; expectations through `deriveResultView` (10) |
| `tests/e2e/result-states.spec.ts` | Create (8), Modify (13) | Every §7 row end to end through deep links and manual lookups |
| `tests/e2e/result-layout.spec.ts` | Create (8), Modify (9) | Focus, live sentence, title, fill without jump; then order, first view, B field cap, desktop, 320 px |
| `components/lookup/LegacyResultSection.tsx`, `components/status-slot/*`, `components/CustomerCta.tsx`, `CustomsTimeline.tsx`, `DeliveryTimeline.tsx`, `TimelineStep.tsx`, `ReturnLinkButton.tsx` | Delete (10) | Legacy result UI |
| `tests/budgets/js-budget.spec.ts` | Create (11) | `/` initial, route code, result chunk, `/[번호]` total |
| `tests/tools/stage-screens.spec.ts` | Modify (12) | Append result scenarios |
| `tests/e2e/result-a11y.spec.ts` | Create (15, approval 13) | axe WCAG 2.2 AA per key state |
| `tests/unit/result-module.spec.ts` | Create (1), Modify (2, 10) | Lazy module, retry, initial-bundle boundary, copy additions, legacy files gone |
| `tests/e2e/result-kit.spec.ts` | Create (1), Modify (2–7, 14) | Component contracts through the harness |

Execution order: Task 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → gated Tasks 13–15 (each checks the ledger first) → Task Final.

## Conventions for this plan

- Shell: PowerShell 5.1 for `npm`, `npx`, `node` and `git` (no `&&`; use `;`). `$env:NAME='x'` sets a flag for the rest of the session; clear it with `$env:NAME=$null`. Quote every path that contains `(`, `)`, `[` or `]`.
- **Unit run** = `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test <files>; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null` (these tests never open a page).
- **Dev-mode run** = port 43210 free, then `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test <files>` (Playwright starts `next dev` with `INTERNAL_ACCESS_PASSWORD`, so `/internal/result-kit` answers the test credentials).
- **Production run** = `npm run build` → background PowerShell `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1` → wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200` → `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test <files>` → stop the server with `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }` and clear the flags `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.
- Every result expectation that is not an E2E-locked string (§11.11) is computed in the test with `deriveTrackingView(outcome, now, siteConfig)` or `deriveLoadingView(...)`, so the tests lock rules, roles and hooks — not copy (approval 2).

---

### Task 0: Stage start

- [ ] **Step 1: Read approvals.** Open `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §4. For every approval number in this plan's "Gated by" list, write its Status into the stage summary. `pending`/`rejected` → execute the fallback steps and mark the gated task SKIPPED with the reason.
- [ ] **Step 2: Confirm dependencies.** Run (PowerShell): `git log --oneline claude/tipoasis-tracking-renewal-ae0e3a -40`
  Expected: a `merge: SNN …` commit for every stage in this plan's "Depends on" list.
- [ ] **Step 3: Branch.** Run: `git switch -c renewal/s07-result-area claude/tipoasis-tracking-renewal-ae0e3a`
  Expected: `Switched to a new branch 'renewal/s07-result-area'`.
- [ ] **Step 4: Port free.** Run: `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue`
  Expected: no output. Otherwise stop the listener: `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`
- [ ] **Step 5: Baseline build and before-screens.** Run `npm ci` only if `package-lock.json` changed since the last install in this worktree, then `npm run build`.
  Expected: build exits 0. Start the production server in a background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`
  Wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200`.
  Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='before'; $env:PW_STAGE='S07'; npx playwright test tests/tools/stage-screens.spec.ts`
  Expected: PNGs in `test-artifacts/stage-screens/S07-before/` for widths 320, 375, 768, 1024, 1440. (S01 creates the tool first; S01 runs this step after its Task 1.)
- [ ] **Step 6: Baseline suite.** With the server still running: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test`
  Expected: record "N passed / M skipped / 0 failed" in the stage summary. Then stop the server (Step 4 command) and clear the flags: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.

**S07 notes on the standard steps above**
- Step 1: the "Gated by" list is 2, 3, 4, 13. Approval 2 is BLOCKING (Step 7 below). Approvals 3, 4 and 13 only gate Tasks 13, 14 and 15.
- Step 2: expected merges are `merge: S03 …`, `merge: S05 …`, `merge: S06 …`, and (through them) `merge: S01 …`, `merge: S02 …`, `merge: S04 …`.
- Step 5: the path is S01 Addition 1's (roadmap amendment requested). The tool has S01's seven scenarios plus whatever S04 and S06 appended.

- [ ] **Step 7 (S07): Approval 2 is decided.** In the roadmap §4 ledger, read row 2 ("Home restructure + test contract").
  Expected: `approved`. If it says `pending`, STOP: the roadmap marks approval 2 as blocking for S07 ("the operator must decide before they start"); write "S07 blocked on approval 2" in the stage summary and hand back to the operator. If it says `rejected`, STOP as well: the fallback ("new state sentences fixed to the current test copy, no config-driven copy") contradicts this plan's design, and S07 must be re-planned — write "S07 needs a re-plan under the approval-2 fallback" and hand back.
- [ ] **Step 8 (S07): The artifacts this stage consumes exist.** Run:
  `Test-Path components/status-slot/StatusSlot.tsx, components/status-slot/LoadingTimeline.tsx, components/status-slot/FailureNotice.tsx, components/status-slot/ResultSummary.tsx, components/status-slot/WorryLine.tsx, components/status-slot/CopyInquiryButton.tsx, components/lookup/LookupController.tsx, components/lookup/LegacyResultSection.tsx, components/lookup/useLookup.ts, components/primitives/LiveAnnouncer.tsx, components/primitives/EtaDisplay.tsx, components/primitives/CopyButton.tsx, components/primitives/AffiliateLinkGroup.tsx, lib/tracking/derive-view.ts, lib/tracking/loading-view.ts, lib/tracking/lookup-state.ts, lib/clipboard.ts, config/site.config.ts, lib/config/invariants.ts, tests/fixtures/derive-scenarios.ts, tests/fixtures/tracking-fixtures.ts, tests/e2e/RULE-MAP.md, "app/(internal)/layout.tsx", app/styles/tokens.css`
  Expected: 24 lines `True`. A `False` means the owning stage (S03, S04, S05 or S06) is not merged as the contract describes — stop and name the missing file in the stage summary.
  Then run: `Test-Path tests/tracking.spec.ts, components/CustomerCta.tsx, components/CustomsTimeline.tsx, components/DeliveryTimeline.tsx, components/TimelineStep.tsx, components/ReturnLinkButton.tsx`
  Expected: six lines `True` (S06 keeps them for `LegacyResultSection`). A `False` is fine only for `tests/tracking.spec.ts` (S06 may have emptied and deleted it); note it — Task 8 then has nothing to delete there.
- [ ] **Step 9 (S07): Record the S04/S06 surface Task 8 replaces.** Run:
  `Select-String -Path components/lookup/LookupController.tsx -Pattern 'LegacyResultSection|LegacyDeriver|LoadingTimeline|FailureNotice|deriveTrackingView|derive-view|useAnnounce|announce\(|document\.title|headingRef|\.focus\(|onSettled|handleSettled|handleAction|computeDisplay|setAdSignals|RecommendedProducts|useLookup\(|onAction|LoadingConfig' | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" }`
  Expected: a numbered list. S06's plan (Task 5 Step 11) writes these as `const { state, loading, submit, retry, cancel, reset } = useLookup({ config: LOADING_CONFIG, onSettled: handleSettled });`, `const handleAction = useCallback(`, `const headingRef = useRef<HTMLHeadingElement | null>(null);`, `<LegacyResultSection` and the `getLoadedLegacyDeriver`/`loadLegacyDeriver` import; if a line differs, the recorded spelling is what Task 8 Step 8 edits. Copy it into the stage summary under "LookupController before S07"; Task 8 Step 8 uses it to find (a) the `useLookup(...)` call and the `LoadingConfig` value it receives, (b) the `<LegacyResultSection …/>` element and its props, (c) the result action handler, (d) the status-heading ref, (e) every statement that uses a derived view on settle (title, announcement, focus, ad signals).
  Run: `Get-ChildItem -Recurse -Include *.ts,*.tsx app, components, lib | Select-String -Pattern 'status-slot/|LegacyResultSection|CustomerCta|CustomsTimeline|DeliveryTimeline|TimelineStep|ReturnLinkButton' | ForEach-Object { "$($_.Path.Replace((Get-Location).Path + '\', '')):$($_.LineNumber)" }`
  Expected: importers only inside `components/status-slot/`, `components/lookup/LegacyResultSection.tsx`, `components/lookup/LookupController.tsx` and the legacy components themselves. Record the list; Task 10 deletes every file on it except `LookupController.tsx`.
- [ ] **Step 10 (S07): Record the tests Task 8 migrates.** Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test --list tests/tracking.spec.ts tests/privacy.spec.ts tests/e2e/status-slot.spec.ts tests/e2e/loading-timeline.spec.ts tests/e2e/failure-causes.spec.ts tests/e2e/cta-consistency.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
  Expected: the list of test titles per file (no test runs). Copy it into the stage summary; Task 8 maps every title in `tests/tracking.spec.ts` and the stale test in `tests/privacy.spec.ts` to a RULE-MAP row before deleting it.
  Run: `Select-String -Path tests/e2e/status-slot.spec.ts, tests/e2e/loading-timeline.spec.ts, tests/e2e/failure-causes.spec.ts, tests/e2e/cta-consistency.spec.ts -Pattern 'data-[a-z-]+' -AllMatches | ForEach-Object { $_.Matches.Value } | Sort-Object -Unique`
  Expected: the set of `data-*` hooks S04's E2E files select. Record it; Task 8 Step 12 rewrites only hooks outside the contract table (§11.13).
- [ ] **Step 11 (S07): Nothing of S07 exists yet.** Run: `Test-Path components/result, "app/(internal)/internal/result-kit", tests/e2e/result-states.spec.ts, tests/budgets/js-budget.spec.ts; git log --oneline --all -- components/result | Select-Object -First 5`
  Expected: four lines `False` and no log lines. If anything exists (a parallel or hotfix branch), stop and compare it with this plan task by task; skip only steps whose files already match this plan exactly and record them in the stage summary.

---

### Task 1: Lazy result module, status card and the internal result harness

**Files:**
- Create: `components/result/StatusCard.tsx`
- Create: `components/result/ResultView.tsx` (first version: status card only)
- Create: `components/result/result-module.ts`
- Create: `components/result/load-result-module.ts`
- Create: `app/(internal)/internal/result-kit/page.tsx`
- Create: `app/(internal)/internal/result-kit/ResultKitHarness.tsx`
- Test: `tests/unit/result-module.spec.ts` (create), `tests/e2e/result-kit.spec.ts` (create)

**Interfaces:**
- Consumes: `TrackingViewModel`, `ResultAction`, `FailureCause`, `LookupOutcome` (`@/lib/tracking/types`, S03); `deriveTrackingView` (`@/lib/tracking/derive-view`, S03); `siteConfig` (`@/config/site.config`, S03); `StatusChip({ tone, text })`, `JourneySpine({ spine })`, `EtaDisplay({ eta })`, `NoticeBanner({ notice, variant })` (S05); test fixtures `success`, `customsWaitingData`, `pendingData` (`tests/fixtures/derive-scenarios.ts`, S03), `FIXTURE_NOW` (S01), `INTERNAL_TEST_CREDENTIALS` (`tests/internal-auth.ts`).
- Produces: `ResultViewProps` (contract §11.9 + `failureCause?: FailureCause`); `ResultView(props: ResultViewProps): React.JSX.Element`; `StatusCard(props: { view: TrackingViewModel; titleId: string; headingRef?: React.Ref<HTMLHeadingElement>; children?: React.ReactNode }): React.JSX.Element`; `result-module.ts` exports `ResultView`, `deriveTrackingView`, `siteConfig`; `type ResultModule`, `loadResultModule(): Promise<ResultModule>`, `preloadResultModule(): void`; the harness route `/internal/result-kit` with `window.__ttResultKit: ResultKitApi`; exported `ResultKitScene`, `ResultKitApi` types.

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/result-module.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { loadResultModule } from "@/components/result/load-result-module";
import { siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";

const ROOT = process.cwd();
/** Static import/export-from statements; `import type`/`export type` are type-only (erased at build). Dynamic import() never matches. */
const STATIC_IMPORT = /(?:^|[\n;])\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\s+from\s+)?["']([^"']+)["']/g;

/** Files of this stage that ship in the initial bundle; a file is checked once its task has created it. */
const INITIAL_BUNDLE_RESULT_FILES: readonly string[] = [
  "components/result/load-result-module.ts",
  "components/result/LoadingCard.tsx",
  "components/result/ResultSlot.tsx"
];
/** What only the lazy result chunk (or the server) may reach. */
const LAZY_ONLY: readonly RegExp[] = [
  /^pkg:zod$/,
  /^lib\/schemas\.ts$/,
  /^lib\/config\/(schema|invariants|server)\.ts$/,
  /^lib\/cs\//,
  /^lib\/delivery-carriers\.ts$/,
  /^lib\/tracking\/derive-view\.ts$/,
  /^lib\/tracking\/derive\//,
  /^components\/result\/(ResultView\.tsx|result-module\.ts)$/
];

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

function readSource(file: string): string {
  return stripComments(readFileSync(path.join(ROOT, file), "utf8"));
}

function resolveImport(specifier: string, fromFile: string): string {
  const base = specifier.startsWith("@/")
    ? specifier.slice(2)
    : specifier.startsWith(".")
      ? path.posix.join(path.posix.dirname(fromFile), specifier)
      : null;
  if (base === null) return `pkg:${specifier}`;
  const found = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((candidate) => {
    const absolute = path.join(ROOT, candidate);
    return existsSync(absolute) && statSync(absolute).isFile();
  });
  return found ?? `missing:${base}`;
}

function runtimeImports(file: string): readonly string[] {
  return Array.from(readSource(file).matchAll(STATIC_IMPORT))
    .filter((match) => match[1] === undefined)
    .map((match) => resolveImport(match[2], file));
}

function staticClosure(entry: string): ReadonlySet<string> {
  const seen = new Set<string>();
  const queue: string[] = [entry];
  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined || seen.has(current)) continue;
    seen.add(current);
    if (/\.(ts|tsx)$/.test(current) && !current.startsWith("pkg:") && !current.startsWith("missing:")) {
      queue.push(...runtimeImports(current));
    }
  }
  return seen;
}

test.describe("lazy result module", () => {
  test("loadResultModule returns one memoized module with ResultView, deriveTrackingView and siteConfig", async () => {
    const first = loadResultModule();
    expect(loadResultModule()).toBe(first);
    const loaded = await first;
    expect(typeof loaded.ResultView).toBe("function");
    expect(loaded.deriveTrackingView).toBe(deriveTrackingView);
    expect(loaded.siteConfig).toBe(siteConfig);
  });

  test("a failed import is retried: the loader imports ./result-module and forgets a rejected promise", () => {
    const source = readSource("components/result/load-result-module.ts");
    expect(source).toMatch(/import\(\s*["']\.\/result-module["']\s*\)/);
    expect(source).toMatch(/\.catch\(/);
    expect(source).toMatch(/pending\s*=\s*null/);
  });

  test("the scanner sees ResultView and derive-view behind the lazy entry (self-check)", () => {
    expect([...staticClosure("components/result/result-module.ts")]).toEqual(
      expect.arrayContaining(["components/result/ResultView.tsx", "lib/tracking/derive-view.ts", "config/site.config.ts"])
    );
  });

  test("initial-bundle result files reach no lazy-only module statically", () => {
    const present = INITIAL_BUNDLE_RESULT_FILES.filter((file) => existsSync(path.join(ROOT, file)));
    expect(present).toContain("components/result/load-result-module.ts");
    const offenders = present.flatMap((entry) =>
      [...staticClosure(entry)]
        .filter((target) => LAZY_ONLY.some((pattern) => pattern.test(target)))
        .map((target) => `${entry} → ${target}`)
    );
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/result-module.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading the file — `Error: Cannot find module '@/components/result/load-result-module'` (0 tests run).

- [ ] **Step 3: Write the failing harness test**

Create `tests/e2e/result-kit.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";
import { siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import type { FailureCause, LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
import { customsWaitingData, pendingData, success } from "../fixtures/derive-scenarios";
import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";

/**
 * Component contracts of the result area through the internal harness (/internal/result-kit).
 * Every view model is derived here, in Node, with the shipped config — the page only renders it.
 */
test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

interface KitOptions {
  readonly frame?: "responsive" | "mobile";
  readonly readOnly?: boolean;
  readonly failureCause?: FailureCause;
  readonly withRecommendation?: boolean;
}

const at = (iso: string): Date => new Date(iso);

function viewFor(outcome: LookupOutcome, now: Date = FIXTURE_NOW): TrackingViewModel {
  return deriveTrackingView(outcome, now, siteConfig);
}

async function openKit(page: Page, width = 375, height = 812): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto("/internal/result-kit");
  await expect(page.locator('[data-result-kit="ready"]')).toBeAttached();
}

async function showView(page: Page, view: TrackingViewModel, options: KitOptions = {}): Promise<void> {
  await page.evaluate(
    ({ nextView, nextOptions }) => {
      const kit = window.__ttResultKit;
      if (kit === undefined) throw new Error("result kit is not ready");
      kit.show({ kind: "result", view: nextView, ...nextOptions });
    },
    { nextView: view, nextOptions: options }
  );
  await expect(page.locator("[data-result-view]")).toBeVisible();
}

test.describe("status card", () => {
  test("customs waiting: chip, focusable h2, reason, one current station, the in-card notice and the ETA as the largest text", async ({ page }) => {
    const view = viewFor(success(customsWaitingData()));
    await openKit(page);
    await showView(page, view);
    const root = page.locator("[data-result-view]");
    await expect(root).toHaveAttribute("data-result-view", "settled");
    await expect(root).toHaveAttribute("data-ad-exclude", "true");
    const card = root.locator("[data-guide-key]");
    await expect(card).toHaveAttribute("data-guide-key", "customsWaiting");
    await expect(card).toHaveAttribute("data-overdue", "false");
    await expect(card).toHaveAttribute("data-tone", view.tone);
    const field = card.locator('[data-slot="status-head"]');
    await expect(field).toHaveAttribute("data-tone", view.tone);
    await expect(field.locator("[data-status-chip]")).toHaveText(view.chip ?? "");
    const title = card.getByRole("heading", { level: 2 });
    await expect(title).toHaveText(view.title);
    await expect(title).toHaveAttribute("tabindex", "-1");
    expect(await title.getAttribute("role")).toBeNull();
    await expect(field.getByText(view.reason ?? "", { exact: true })).toBeVisible();
    await expect(field.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(field.locator("[data-spine-current]")).toHaveAttribute("data-spine-current", "customs");
    await expect(field.locator('[data-slot="eta"]')).toHaveAttribute("data-eta-kind", view.eta.kind);
    expect(view.notice).not.toBeNull();
    await expect(field.locator('[data-notice-variant="inline"]')).toContainText(view.notice?.body ?? "");
    const sizes = await card.evaluate((element) => {
      const visual = element.querySelector("[data-eta-visual]");
      const textSizes = Array.from(element.querySelectorAll("*"))
        .filter((node) =>
          Array.from(node.childNodes).some((child) => child.nodeType === Node.TEXT_NODE && (child.textContent ?? "").trim() !== "")
        )
        .filter((node) => node.closest(".sr-only") === null)
        .map((node) => Number.parseFloat(getComputedStyle(node).fontSize));
      return { eta: visual === null ? 0 : Number.parseFloat(getComputedStyle(visual).fontSize), max: Math.max(...textSizes) };
    });
    expect(sizes.eta).toBeGreaterThanOrEqual(32);
    expect(sizes.max).toBe(sizes.eta);
  });

  test("overdue keeps the station, switches to the attention tone and marks data-overdue", async ({ page }) => {
    const view = viewFor(success(customsWaitingData()), at("2026-09-29T09:00:00+09:00"));
    expect(view.overdue).toBe(true);
    await openKit(page);
    await showView(page, view);
    const card = page.locator("[data-result-view] [data-guide-key]");
    await expect(card).toHaveAttribute("data-overdue", "true");
    await expect(card).toHaveAttribute("data-tone", "attention");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(view.title);
    await expect(card.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(card.locator('[data-slot="eta"]')).toHaveAttribute("data-eta-kind", "overdue");
  });

  test("pending: no station marker, '위치 확인 전' and the pending ETA text", async ({ page }) => {
    const view = viewFor(success(pendingData()));
    await openKit(page);
    await showView(page, view);
    const card = page.locator("[data-result-view] [data-guide-key]");
    await expect(card).toHaveAttribute("data-guide-key", "pending");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText("통관 정보 등록 전");
    await expect(card.locator('[aria-current="step"]')).toHaveCount(0);
    await expect(card.locator('[data-spine-part="unknown"]')).toHaveText("위치 확인 전");
    await expect(card.locator('[data-slot="eta"]')).toHaveAttribute("data-eta-kind", "pendingInfo");
    await expect(card.locator("[data-eta-text]")).toHaveText("정보 등록 후 안내");
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-kit.spec.ts`
Expected: FAIL — `3 failed`; each stops at `expect(locator('[data-result-kit="ready"]')).toBeAttached()` ("element(s) not found": `/internal/result-kit` is a 404 page).

- [ ] **Step 5: Create the status card**

Create `components/result/StatusCard.tsx`:

```tsx
import { EtaDisplay } from "@/components/primitives/EtaDisplay";
import { JourneySpine } from "@/components/primitives/JourneySpine";
import { NoticeBanner } from "@/components/primitives/NoticeBanner";
import { StatusChip } from "@/components/primitives/StatusChip";
import type { TrackingViewModel } from "@/lib/tracking/types";

export interface StatusCardProps {
  readonly view: TrackingViewModel;
  readonly titleId: string;
  readonly headingRef?: React.Ref<HTMLHeadingElement>;
  /** Extra rows at the bottom of the field (the auxiliary '택배사 조회가 잠시 늦어요 [다시 조회]' line). */
  readonly children?: React.ReactNode;
}

/**
 * 상태 카드 (spec §6): chip, the status h2 (focus target: tabindex -1, never role=alert), the reason,
 * the 4-station spine, the in-card '안내' line and then 도착 예상 — all inside the active style's status-head field.
 * data-guide-key / data-overdue / data-tone on the root are the E2E hooks (contract §11.13).
 */
export function StatusCard({ view, titleId, headingRef, children }: StatusCardProps): React.JSX.Element {
  return (
    <section
      data-guide-key={view.guideKey}
      data-overdue={view.overdue ? "true" : "false"}
      data-tone={view.tone}
      aria-labelledby={titleId}
    >
      <div data-slot="status-head" data-tone={view.tone}>
        <div className="flex flex-col items-start gap-2">
          {view.chip === null ? null : <StatusChip tone={view.tone} text={view.chip} />}
          <div className="flex flex-col gap-1">
            <h2
              id={titleId}
              ref={headingRef}
              tabIndex={-1}
              className="tt-focus m-0 font-tt-display text-tt-lg [font-weight:var(--tt-weight-display)] [word-break:keep-all]"
            >
              {view.title}
            </h2>
            {view.reason === null ? null : (
              <p className="m-0 text-tt-sm font-medium [overflow-wrap:anywhere] [word-break:keep-all]">{view.reason}</p>
            )}
          </div>
        </div>
        <JourneySpine spine={view.spine} />
        {view.notice === null ? null : <NoticeBanner notice={view.notice} variant="inline" />}
        <EtaDisplay eta={view.eta} />
        {children}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Create the first `ResultView`**

Create `components/result/ResultView.tsx`:

```tsx
"use client";

import { useId } from "react";
import type { FailureCause, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
import { StatusCard } from "./StatusCard";

export interface ResultViewProps {
  readonly view: TrackingViewModel;
  readonly onAction: (action: ResultAction) => void;
  readonly headingRef?: React.Ref<HTMLHeadingElement>;
  /** Placed per view.revenue.recommendations and guideKey; never between the fixed-order blocks. */
  readonly recommendationSlot?: React.ReactNode;
  /** CS preview: actions inert, no focus moves. */
  readonly readOnly?: boolean;
  /** "mobile" forces the 375 px single column (CS preview). */
  readonly frame?: "responsive" | "mobile";
  /** S07 addition: the cause behind an error view, for data-failure-cause on the failure card. */
  readonly failureCause?: FailureCause;
}

/**
 * The result area (spec §6–§7), loaded lazily through result-module.ts. It renders only the view model, in the fixed
 * order 상태 카드 → 도착 예상 → 지금 할 일 → 마지막 처리 → 처리 내역. The number bar above it belongs to the caller.
 */
export function ResultView({ view, headingRef, readOnly = false, frame = "responsive" }: ResultViewProps): React.JSX.Element {
  const baseId = useId();
  return (
    <div
      data-result-view={view.mode}
      data-ad-exclude="true"
      data-frame={frame}
      data-read-only={readOnly ? "true" : undefined}
      className="mx-auto flex w-full flex-col gap-4"
    >
      <div data-result-main="true" className="flex min-w-0 flex-col gap-4">
        <StatusCard view={view} titleId={`${baseId}-title`} headingRef={headingRef} />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create the lazy entry and its loader**

Create `components/result/result-module.ts`:

```ts
/** The one lazy entry of the result area (roadmap §11.9). Only load-result-module.ts imports it, dynamically. */
export { ResultView } from "./ResultView";
export { deriveTrackingView } from "@/lib/tracking/derive-view";
export { siteConfig } from "@/config/site.config";
```

Create `components/result/load-result-module.ts`:

```ts
/** Initial-bundle loader of the lazy result chunk (roadmap §11.9). Never imports result-module.ts statically. */
export type ResultModule = typeof import("./result-module");

let pending: Promise<ResultModule> | null = null;

/** Memoized dynamic import. A failed import is forgotten, so the next call (the next lookup) tries again. */
export function loadResultModule(): Promise<ResultModule> {
  if (pending === null) {
    pending = import("./result-module").catch((error: unknown) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

/** Starts the download early (submit, deep-link start, focus in the lookup form). Never throws. */
export function preloadResultModule(): void {
  loadResultModule().catch(() => undefined);
}
```

- [ ] **Step 8: Create the internal harness**

Create `app/(internal)/internal/result-kit/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ResultKitHarness } from "./ResultKitHarness";

export const metadata: Metadata = {
  title: "결과 화면 점검",
  robots: { index: false, follow: false }
};

/** Internal test harness: renders the result area for view models handed over by E2E tests. Never linked publicly. */
export default function ResultKitPage(): React.JSX.Element {
  return <ResultKitHarness />;
}
```

Create `app/(internal)/internal/result-kit/ResultKitHarness.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ResultView } from "@/components/result/ResultView";
import type { FailureCause, ResultAction, TrackingViewModel } from "@/lib/tracking/types";

export type ResultKitScene = {
  readonly kind: "result";
  readonly view: TrackingViewModel;
  readonly frame?: "responsive" | "mobile";
  readonly readOnly?: boolean;
  readonly failureCause?: FailureCause;
  readonly withRecommendation?: boolean;
};

export interface ResultKitApi {
  readonly show: (scene: ResultKitScene) => void;
  readonly actions: () => readonly ResultAction[];
}

declare global {
  interface Window {
    __ttResultKit?: ResultKitApi;
  }
}

interface ShownScene {
  readonly scene: ResultKitScene;
  readonly serial: number;
}

/** Stand-in for the recommendation list (S08) so tests can check where the slot goes. */
function KitRecommendation({ context }: { readonly context: string }): React.JSX.Element {
  return (
    <section data-recommended-products={context} className="bg-tt-surface px-[var(--tt-gutter)] py-4 text-tt-sm text-tt-ink">
      추천 자리 (점검용)
    </section>
  );
}

/**
 * Tests call window.__ttResultKit.show(scene) with a view model derived in Node and read the reported ResultActions
 * with actions(). Each show() remounts the scene (fresh component state) and clears the action log.
 */
export function ResultKitHarness(): React.JSX.Element {
  const [shown, setShown] = useState<ShownScene | null>(null);
  const actionsRef = useRef<readonly ResultAction[]>([]);
  const rootRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    window.__ttResultKit = {
      show: (scene) => {
        actionsRef.current = [];
        setShown((previous) => ({ scene, serial: (previous?.serial ?? 0) + 1 }));
      },
      actions: () => actionsRef.current
    };
    rootRef.current?.setAttribute("data-result-kit", "ready");
    return () => {
      delete window.__ttResultKit;
    };
  }, []);

  const record = (action: ResultAction): void => {
    actionsRef.current = [...actionsRef.current, action];
  };

  const scene = shown === null ? null : shown.scene;
  const context = scene === null ? null : scene.view.revenue.recommendationContext;
  return (
    <main ref={rootRef} className="min-h-screen bg-tt-ground py-4 text-tt-ink">
      <h1 className="sr-only">결과 화면 점검</h1>
      {scene === null || shown === null ? null : (
        <ResultView
          key={shown.serial}
          view={scene.view}
          onAction={record}
          headingRef={headingRef}
          readOnly={scene.readOnly}
          frame={scene.frame}
          failureCause={scene.failureCause}
          recommendationSlot={
            scene.withRecommendation === true && context !== null ? <KitRecommendation context={context} /> : undefined
          }
        />
      )}
    </main>
  );
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/result-module.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `4 passed`.
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-kit.spec.ts`
Expected: `3 passed`.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0 with no new warnings. S03's `tests/unit/module-boundaries.spec.ts` must stay green: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/module-boundaries.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null` → all passed (nothing in `components/lookup|primitives|shell` imports the new files yet).

- [ ] **Step 10: Commit**

```powershell
git add components/result/StatusCard.tsx components/result/ResultView.tsx components/result/result-module.ts components/result/load-result-module.ts "app/(internal)/internal/result-kit/page.tsx" "app/(internal)/internal/result-kit/ResultKitHarness.tsx" tests/unit/result-module.spec.ts tests/e2e/result-kit.spec.ts
git commit -m "feat: add the lazy result module, the status card and an internal result harness"
```

---

### Task 2: 지금 할 일 with the return-link control

**Files:**
- Modify: `lib/config/types.ts` (inside `ResultCopyConfig`, after the `chooseCarrierSentence` line)
- Modify: `config/site.config.ts` (inside `resultCopy`, the `chooseCarrierSentence` line)
- Modify: `lib/config/invariants.ts` (inside `RESULT_COPY_SLOTS`, the `customsCheckNote … chooseCarrierSentence` line)
- Create: `components/result/details.ts`
- Create: `components/result/ReturnLinkAction.tsx`
- Create: `components/result/ActionControl.tsx`
- Create: `components/result/NextActionBlock.tsx`
- Modify: `components/result/ResultView.tsx` (whole file)
- Test: `tests/unit/result-module.spec.ts` (import line + one test), `tests/e2e/result-kit.spec.ts` (import block + helpers + two describe blocks + one test)

**Interfaces:**
- Consumes: Task 1 (`ResultView`, `StatusCard`, harness); `ActionView`, `ActionKind`, `ResultAction` (S03); `Button`, `ButtonSize` (S05 `Button.tsx`), `ButtonLink`, `CopyButton`, `TalkLink`, `AffiliateLinkGroup` (S05); `shareOrCopyLink`, `ShareOutcome` (`lib/clipboard.ts`, S02); `resultCopy`, `stateGuide`, `channels` (config); `SiteConfigSchema`, `formatConfigIssues` (`lib/config/schema.ts`, S03).
- Produces: `ResultCopyConfig.returnLinkCopied | returnLinkShared | returnLinkFallback | inquiryCopied: string`; `openDetails(id: string): void`; `ReturnLinkAction(props: { action: ActionView; link: string; onAction: (action: ResultAction) => void }): React.JSX.Element`; `ActionControl(props: ActionControlProps): React.JSX.Element | null` with `ActionControlProps { action; onAction; inquiryCopy: string | null; returnLink: string; undeliveredHelpId: string | null }`; `NextActionBlock(props: { view; headingId: string; onAction; undeliveredHelpId: string | null }): React.JSX.Element` (root `section[data-cta-state]`); `ResultView` now renders the auxiliary line, `NextActionBlock`, and reports `openedExternal` for outside links.

- [ ] **Step 1: Write the failing unit test**

In `tests/unit/result-module.spec.ts`, replace the line `import { siteConfig } from "@/config/site.config";` with:

```ts
import { resultCopy, siteConfig } from "@/config/site.config";
import { SiteConfigSchema, formatConfigIssues } from "@/lib/config/schema";
```

Append to the end of the file:

```ts
test("resultCopy carries the return-link and inquiry feedback strings, and the shipped config still parses", () => {
  expect([resultCopy.returnLinkCopied, resultCopy.returnLinkShared, resultCopy.returnLinkFallback, resultCopy.inquiryCopied]).toEqual([
    "링크를 복사했어요",
    "링크를 공유했어요",
    "아래 링크를 길게 눌러 복사해 주세요.",
    "문의 내용을 복사했어요"
  ]);
  const parsed = SiteConfigSchema.safeParse(siteConfig);
  expect(parsed.success ? "" : formatConfigIssues(parsed.error)).toBe("");
});
```

- [ ] **Step 2: Write the failing harness tests**

In `tests/e2e/result-kit.spec.ts`, replace the whole import block (the seven `import` lines at the top) with:

```ts
import { expect, test, type Page } from "@playwright/test";
import { disclosures, siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import type { FailureCause, LookupOutcome, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
import {
  OCTOBER_NOW, carrierCutData, customsWaitingData, deliveredData, inTransitData, lookupUnavailableData, pendingData, staleData,
  success
} from "../fixtures/derive-scenarios";
import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";
```

Directly below the `showView` function, add:

```ts
const TALK_URL = siteConfig.channels.talk.url;
const TALK_NAME = `${siteConfig.channels.talk.labels.cta} 새 창으로 열기`;
const COPY_AND_TALK_NAME = `${siteConfig.channels.talk.labels.copyAndTalk} 새 창으로 열기`;
const RETURN_LINK_NAME = "다시 볼 링크 복사";

async function kitActions(page: Page): Promise<readonly ResultAction[]> {
  return page.evaluate(() => window.__ttResultKit?.actions() ?? []);
}

/** Popups opened by result links (carrier, 톡톡) must not reach the internet. */
async function blockOtherHosts(page: Page): Promise<void> {
  await page.context().route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
}

/** Naver/Kakao in-app browser: no share sheet, the Clipboard API rejects, execCommand('copy') fails. */
async function blockClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (): Promise<void> => Promise.reject(new DOMException("Write permission denied.", "NotAllowedError")) }
    });
    Object.defineProperty(document, "execCommand", { configurable: true, value: (): boolean => false });
  });
}

async function removeShareSheet(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
}
```

Append to the end of the file:

```ts
test.describe("지금 할 일", () => {
  test("normal waiting: the sentence leads, no filled button, one 톡톡 link bound to the worry line", async ({ page }) => {
    const view = viewFor(success(customsWaitingData()));
    await openKit(page);
    await showView(page, view);
    const cta = page.locator('[data-cta-state="customsWaiting"]');
    await expect(cta.getByRole("heading", { level: 3 })).toHaveText(view.nextAction.heading ?? "");
    await expect(cta.getByText(view.nextAction.sentence, { exact: true })).toBeVisible();
    await expect(cta.locator('[data-slot="button"][data-variant="primary"]')).toHaveCount(0);
    const worry = cta.locator("[data-worry-line]");
    await expect(worry).toContainText(view.nextAction.worry?.text ?? "");
    await expect(worry.getByRole("link", { name: TALK_NAME })).toBeVisible();
    await expect(cta.locator(`a[href="${TALK_URL}"]`)).toHaveCount(1);
    await expect(cta.getByRole("button", { name: RETURN_LINK_NAME })).toBeVisible();
  });

  test("pending: 번호 수정 first, then 톡톡, the disclosure before the affiliate store link, and the recheck note", async ({ page }) => {
    const view = viewFor(success(pendingData()));
    await openKit(page);
    await showView(page, view);
    const cta = page.locator('[data-cta-state="pending"]');
    await expect(cta.getByRole("heading", { level: 3 })).toHaveText("아직 국내 배송 정보가 없어요");
    const fix = cta.getByRole("button", { name: view.nextAction.primary?.label ?? "" });
    await expect(fix).toHaveAttribute("data-variant", "primary");
    await expect(cta.getByRole("link", { name: TALK_NAME })).toBeVisible();
    await expect(cta.locator(`a[href="${TALK_URL}"]`)).toHaveCount(1);
    const group = cta.locator('[data-affiliate-group="pending"]');
    await expect(group.locator("[data-affiliate-disclosure]")).toHaveText(disclosures.coupang);
    await expect(group.getByRole("link", { name: "네이버 스토어 보기 새 창으로 열기" })).toBeVisible();
    await expect(group.getByRole("link", { name: "쿠팡 스토어 보기 새 창으로 열기" })).toHaveAttribute("rel", /sponsored/);
    const disclosureFirst = await group.evaluate((element) => {
      const disclosure = element.querySelector("[data-affiliate-disclosure]");
      const firstLink = element.querySelector("a");
      return disclosure !== null && firstLink !== null && (disclosure.compareDocumentPosition(firstLink) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    });
    expect(disclosureFirst).toBe(true);
    await expect(cta.locator("[data-next-note]")).toHaveText(siteConfig.durations.pendingRecheck);
    await fix.click();
    expect(await kitActions(page)).toEqual([{ kind: "fixNumber" }]);
  });

  test("delivered: the two store links lead 지금 할 일 and 톡톡 follows them", async ({ page }) => {
    const view = viewFor(success(deliveredData()));
    await openKit(page);
    await showView(page, view);
    const cta = page.locator('[data-cta-state="delivered"]');
    await expect(cta.getByRole("heading", { level: 3 })).toHaveText("배송이 완료됐어요");
    const firstTwo = await cta
      .locator("a[href]")
      .evaluateAll((links) =>
        links.slice(0, 2).map((link) => link.closest("[data-affiliate-group]")?.getAttribute("data-affiliate-group") ?? "none")
      );
    expect(firstTwo).toEqual(["deliveredLead", "deliveredLead"]);
    await expect(cta.locator("[data-affiliate-disclosure]")).toHaveText(disclosures.coupang);
    await expect(cta.getByRole("link", { name: "네이버 스토어 보기 새 창으로 열기" })).toHaveAttribute("data-variant", "primary");
    await expect(cta.getByRole("link", { name: TALK_NAME })).toBeVisible();
    await expect(cta.getByRole("button", { name: "받지 못하셨나요?" })).toBeVisible();
    expect(view.nextAction.primary).toBeNull();
  });

  test("in transit: the carrier's live link is the primary, the driver call is a tel link, no store link", async ({ page }) => {
    await blockOtherHosts(page);
    const view = viewFor(success(inTransitData()), OCTOBER_NOW);
    await openKit(page);
    await showView(page, view);
    const cta = page.locator('[data-cta-state="inTransit"]');
    await expect(cta.getByRole("heading", { level: 3 })).toHaveText("배송이 진행 중이에요");
    const live = cta.getByRole("link", { name: `${view.nextAction.primary?.label ?? ""} 새 창으로 열기` });
    await expect(live).toHaveAttribute("href", view.carrier.officialUrl ?? "");
    await expect(live).toHaveAttribute("target", "_blank");
    await expect(live).toHaveAttribute("data-variant", "primary");
    await expect(cta.getByRole("link", { name: "기사님께 전화" })).toHaveAttribute("href", /^tel:/);
    await expect(cta.locator("[data-affiliate-group]")).toHaveCount(0);
    const popup = page.waitForEvent("popup");
    await live.click();
    await (await popup).close();
    expect(await kitActions(page)).toEqual([{ kind: "openedExternal", target: "carrier" }]);
  });

  test("carrier lookup delay with a known carrier: the official link is the primary and 다시 조회 reports a retry", async ({ page }) => {
    const view = viewFor(success(lookupUnavailableData("CJ")));
    await openKit(page);
    await showView(page, view);
    const cta = page.locator('[data-cta-state="lookupUnavailable"]');
    const official = cta.getByRole("link", { name: `${view.nextAction.primary?.label ?? ""} 새 창으로 열기` });
    await expect(official).toHaveAttribute("href", view.carrier.officialUrl ?? "");
    await expect(official).toHaveAttribute("data-variant", "primary");
    await cta.getByRole("button", { name: "다시 조회" }).click();
    expect(await kitActions(page)).toEqual([{ kind: "retry" }]);
  });

  test("a carrier lookup delay under customs: the cut mark and a 다시 조회 line inside the card", async ({ page }) => {
    const view = viewFor(success(carrierCutData()));
    await openKit(page);
    await showView(page, view);
    const field = page.locator('[data-result-view] [data-slot="status-head"]');
    await expect(field.locator('[data-station="domestic"]')).toHaveAttribute("data-issue", "cut");
    const line = field.locator("[data-auxiliary-line]");
    await expect(line).toContainText(view.auxiliaryLine?.text ?? "");
    await line.getByRole("button", { name: "다시 조회" }).click();
    expect(await kitActions(page)).toEqual([{ kind: "retry" }]);
  });

  test("지금 할 일 shows at most one filled control in every settled state", async ({ page }) => {
    const views = [
      viewFor(success(customsWaitingData())),
      viewFor(success(pendingData())),
      viewFor(success(deliveredData())),
      viewFor(success(staleData())),
      viewFor(success(inTransitData()), OCTOBER_NOW),
      viewFor(success(lookupUnavailableData("CJ"))),
      viewFor(success(customsWaitingData()), at("2026-09-29T09:00:00+09:00"))
    ];
    await openKit(page);
    for (const view of views) {
      await showView(page, view);
      const cta = page.locator(`[data-cta-state="${view.ctaState}"]`);
      await expect(cta, view.guideKey).toBeVisible();
      const filled = view.nextAction.primary !== null || view.nextAction.stores?.placement === "deliveredLead" ? 1 : 0;
      await expect(cta.locator('[data-slot="button"][data-variant="primary"]'), view.guideKey).toHaveCount(filled);
    }
  });
});

test.describe("clipboard", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("copy-and-talk copies the inquiry text in the click that opens 톡톡 and shows what is copied", async ({ page }) => {
    await blockOtherHosts(page);
    const view = viewFor(success(staleData()));
    await openKit(page);
    await showView(page, view);
    const cta = page.locator('[data-cta-state="stale"]');
    await expect(cta.locator("[data-inquiry-preview]")).toHaveText(view.inquiryCopy ?? "");
    const link = cta.getByRole("link", { name: COPY_AND_TALK_NAME });
    await expect(link).toHaveAttribute("data-variant", "primary");
    await expect(link).toHaveAttribute("href", TALK_URL);
    const popup = page.waitForEvent("popup");
    await link.click();
    await (await popup).close();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(view.inquiryCopy);
    await expect
      .poll(() => kitActions(page))
      .toEqual(expect.arrayContaining([{ kind: "copied", what: "inquiry", outcome: "copied" }, { kind: "openedExternal", target: "talk" }]));
  });

  test("the return link copies view.returnLink and says so", async ({ page }) => {
    await removeShareSheet(page);
    const view = viewFor(success(customsWaitingData()));
    await openKit(page);
    await showView(page, view);
    await page.getByRole("button", { name: RETURN_LINK_NAME }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(view.returnLink);
    await expect(page.getByRole("button", { name: siteConfig.resultCopy.returnLinkCopied })).toBeVisible();
    expect(await kitActions(page)).toEqual([{ kind: "copied", what: "returnLink", outcome: "copied" }]);
  });
});

test("blocked clipboard: copy-and-talk still opens 톡톡 with a selectable box; the return link box is pre-selected", async ({ page }) => {
  await blockClipboard(page);
  await blockOtherHosts(page);
  const stale = viewFor(success(staleData()));
  await openKit(page);
  await showView(page, stale);
  const popup = page.waitForEvent("popup");
  await page.getByRole("link", { name: COPY_AND_TALK_NAME }).click();
  await (await popup).close();
  await expect(page.locator("textarea[data-copy-fallback]")).toHaveValue(stale.inquiryCopy ?? "");
  const waiting = viewFor(success(customsWaitingData()));
  await showView(page, waiting);
  await page.getByRole("button", { name: RETURN_LINK_NAME }).click();
  const box = page.locator("textarea[readonly]");
  await expect(box).toHaveValue(waiting.returnLink);
  await expect
    .poll(() => box.evaluate((element) => (element instanceof HTMLTextAreaElement ? element.selectionEnd - element.selectionStart : -1)))
    .toBe(waiting.returnLink.length);
  expect(await kitActions(page)).toEqual([{ kind: "copied", what: "returnLink", outcome: "fallback" }]);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/result-module.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `1 failed, 4 passed` — the new test: `Expected: ["링크를 복사했어요", …] Received: [undefined, undefined, undefined, undefined]`.
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-kit.spec.ts`
Expected: `10 failed, 3 passed` — every new test waits for `[data-cta-state=…]` or a CTA control that does not exist yet ("element(s) not found").

- [ ] **Step 4: Add the four feedback strings to the config**

In `lib/config/types.ts`, replace the line

```ts
  readonly chooseCarrierSentence: string;  // lookupUnavailable without an official link
```

with

```ts
  readonly chooseCarrierSentence: string;  // lookupUnavailable without an official link
  readonly returnLinkCopied: string;       // '링크를 복사했어요' (S07)
  readonly returnLinkShared: string;       // '링크를 공유했어요' (S07)
  readonly returnLinkFallback: string;     // '아래 링크를 길게 눌러 복사해 주세요.' (S07)
  readonly inquiryCopied: string;          // '문의 내용을 복사했어요' (S07)
```

In `config/site.config.ts`, replace the line

```ts
  chooseCarrierSentence: "택배사를 고르시면 같은 번호로 바로 다시 조회해요."
```

with

```ts
  chooseCarrierSentence: "택배사를 고르시면 같은 번호로 바로 다시 조회해요.",
  // [다시 볼 링크 복사]와 문의 내용 복사를 누른 뒤 버튼에 잠깐 보이는 문구, 복사가 막힌 앱에서 보이는 안내
  returnLinkCopied: "링크를 복사했어요",
  returnLinkShared: "링크를 공유했어요",
  returnLinkFallback: "아래 링크를 길게 눌러 복사해 주세요.",
  inquiryCopied: "문의 내용을 복사했어요"
```

In `lib/config/invariants.ts`, replace the line

```ts
  customsCheckNote: [], chooseCarrierSentence: []
```

with

```ts
  customsCheckNote: [], chooseCarrierSentence: [],
  returnLinkCopied: [], returnLinkShared: [], returnLinkFallback: [], inquiryCopied: []
```

Run: `npm run typecheck`
Expected: exit 0. If it reports that `tests/fixtures/config-fixtures.ts` builds a `resultCopy` literal without the four fields, add the same four `key: "value"` lines (copied from above) to that literal and run `npm run typecheck` again (exit 0); name the file in the stage summary.

- [ ] **Step 5: Create the details helper and the return-link control**

Create `components/result/details.ts`:

```ts
/** Opens a <details> element by id and moves focus to its summary ('받지 못하셨나요?', '전체 보기'). Browser only. */
export function openDetails(id: string): void {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLDetailsElement)) return;
  element.open = true;
  const summary = element.querySelector("summary");
  if (summary instanceof HTMLElement) summary.focus();
}
```

Create `components/result/ReturnLinkAction.tsx`:

```tsx
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/primitives/Button";
import { resultCopy, stateGuide } from "@/config/site.config";
import { shareOrCopyLink, type ShareOutcome } from "@/lib/clipboard";
import type { ActionView, ResultAction } from "@/lib/tracking/types";

const LABEL_RESET_MS = 3000;

type ReturnLinkState = "idle" | "copied" | "shared" | "fallback";

function prefersShareSheet(): boolean {
  try {
    return typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

function stateAfter(outcome: ShareOutcome): ReturnLinkState | null {
  switch (outcome) {
    case "copied":
      return "copied";
    case "shared":
      return "shared";
    case "fallback":
      return "fallback";
    case "dismissed":
      return null;
  }
}

export interface ReturnLinkActionProps {
  readonly action: ActionView;
  readonly link: string;
  readonly onAction: (action: ResultAction) => void;
}

/**
 * [다시 볼 링크 복사] (spec §3 공유): the share sheet first on touch screens, otherwise the clipboard; when both are
 * blocked (in-app browsers) a read-only box with the link appears, focused and fully selected. Keeps S02's behavior.
 */
export function ReturnLinkAction({ action, link, onAction }: ReturnLinkActionProps): React.JSX.Element {
  const [state, setState] = useState<ReturnLinkState>("idle");
  const fallbackId = useId();
  const fallbackRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (state === "fallback") {
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
      return undefined;
    }
    if (state === "idle") return undefined;
    const timer = window.setTimeout(() => setState("idle"), LABEL_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  const handleClick = (): void => {
    void shareOrCopyLink({ url: link, title: stateGuide.idle.docTitle, preferShare: prefersShareSheet() }).then((outcome) => {
      const next = stateAfter(outcome);
      if (next === null) return;
      setState(next);
      if (outcome === "copied" || outcome === "fallback") onAction({ kind: "copied", what: "returnLink", outcome });
    });
  };

  const label = state === "copied" ? resultCopy.returnLinkCopied : state === "shared" ? resultCopy.returnLinkShared : action.label;
  return (
    <div className="flex max-w-full flex-col items-start gap-2">
      <Button variant={action.weight} size="md" onClick={handleClick}>
        {label}
      </Button>
      {state === "fallback" ? (
        <div className="flex w-full flex-col gap-1">
          <label htmlFor={fallbackId} className="text-tt-sm [word-break:keep-all]">
            {resultCopy.returnLinkFallback}
          </label>
          <textarea
            id={fallbackId}
            ref={fallbackRef}
            readOnly
            rows={2}
            value={link}
            data-copy-fallback="true"
            className="tt-focus block w-full min-w-0 resize-none border-2 border-solid border-tt-ink bg-tt-surface p-2 font-tt-mono text-tt-sm text-tt-ink [overflow-wrap:anywhere]"
          />
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 6: Create the action control**

Create `components/result/ActionControl.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button, type ButtonSize } from "@/components/primitives/Button";
import { ButtonLink } from "@/components/primitives/ButtonLink";
import { CopyButton } from "@/components/primitives/CopyButton";
import { TalkLink } from "@/components/primitives/TalkLink";
import { resultCopy } from "@/config/site.config";
import type { ActionView, ResultAction } from "@/lib/tracking/types";
import { openDetails } from "./details";
import { ReturnLinkAction } from "./ReturnLinkAction";

export interface ActionControlProps {
  readonly action: ActionView;
  readonly onAction: (action: ResultAction) => void;
  readonly inquiryCopy: string | null;
  readonly returnLink: string;
  /** id of the 미수령 안내 <details> (delivered), or null. */
  readonly undeliveredHelpId: string | null;
}

const ONE_SECOND_MS = 1000;

function sizeOf(action: ActionView): ButtonSize {
  return action.weight === "primary" ? "lg" : "md";
}

/** [다시 조회]: during a 429 countdown it stays focusable but inert (aria-disabled; never `disabled`, spec §5). */
function RetryControl({ action, onRetry }: { readonly action: ActionView; readonly onRetry: () => void }): React.JSX.Element {
  const [remaining, setRemaining] = useState(action.cooldownSeconds ?? 0);
  useEffect(() => {
    if (remaining <= 0) return undefined;
    const timer = window.setTimeout(() => setRemaining((value) => value - 1), ONE_SECOND_MS);
    return () => window.clearTimeout(timer);
  }, [remaining]);
  const waiting = remaining > 0;
  return (
    <Button
      variant={action.weight}
      size={sizeOf(action)}
      aria-disabled={waiting ? true : undefined}
      data-cooldown={waiting ? String(remaining) : undefined}
      onClick={() => {
        if (!waiting) onRetry();
      }}
    >
      {action.label}
    </Button>
  );
}

/** [문의 내용 복사하고 톡톡 열기]: copies and opens 톡톡 in one click, then shows exactly what was copied. */
function InquiryCopyAction({
  action,
  inquiryCopy,
  onAction
}: {
  readonly action: ActionView;
  readonly inquiryCopy: string | null;
  readonly onAction: (action: ResultAction) => void;
}): React.JSX.Element | null {
  if (action.href === null) return null;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <CopyButton
        mode="copyAndOpen"
        text={inquiryCopy ?? ""}
        label={action.label}
        href={action.href}
        variant={action.weight}
        onCopied={(outcome) => onAction({ kind: "copied", what: "inquiry", outcome })}
      />
      {inquiryCopy === null ? null : (
        <p
          data-inquiry-preview="true"
          className="m-0 border-0 border-l-4 border-solid border-tt-rule pl-3 font-tt-mono text-tt-xs text-tt-ink [overflow-wrap:anywhere]"
        >
          {inquiryCopy}
        </p>
      )}
    </div>
  );
}

/** One ActionView → the one control that performs it. Labels always come from the view (config copy). */
export function ActionControl({ action, onAction, inquiryCopy, returnLink, undeliveredHelpId }: ActionControlProps): React.JSX.Element | null {
  switch (action.kind) {
    case "talk":
      return action.href === null ? null : <TalkLink href={action.href} label={action.label} weight={action.weight} placement="state" />;
    case "copyAndTalk":
      return <InquiryCopyAction action={action} inquiryCopy={inquiryCopy} onAction={onAction} />;
    case "copyInquiry":
      return (
        <CopyButton
          mode="copy"
          text={inquiryCopy ?? ""}
          label={action.label}
          copiedLabel={resultCopy.inquiryCopied}
          variant={action.weight}
          onCopied={(outcome) => onAction({ kind: "copied", what: "inquiry", outcome })}
        />
      );
    case "fixNumber":
      return (
        <Button variant={action.weight} size={sizeOf(action)} onClick={() => onAction({ kind: "fixNumber" })}>
          {action.label}
        </Button>
      );
    case "retry":
      return <RetryControl action={action} onRetry={() => onAction({ kind: "retry" })} />;
    case "cancel":
      return (
        <Button variant={action.weight} size={sizeOf(action)} onClick={() => onAction({ kind: "cancel" })}>
          {action.label}
        </Button>
      );
    case "carrierOfficial":
      return action.href === null ? null : (
        <ButtonLink href={action.href} variant={action.weight} size={sizeOf(action)} external label={action.label} />
      );
    case "callDriver":
      return action.href === null ? null : (
        <ButtonLink href={action.href} variant={action.weight} size={sizeOf(action)} label={action.label} />
      );
    case "copyReturnLink":
      return <ReturnLinkAction action={action} link={returnLink} onAction={onAction} />;
    case "chooseCarrier":
      return null; // chips come from nextAction.carrierChoices (CarrierChooser)
    case "undeliveredHelp":
      return (
        <Button
          variant={action.weight}
          size={sizeOf(action)}
          aria-controls={undeliveredHelpId ?? undefined}
          onClick={() => {
            if (undeliveredHelpId !== null) openDetails(undeliveredHelpId);
          }}
        >
          {action.label}
        </Button>
      );
  }
}
```

- [ ] **Step 7: Create 지금 할 일**

Create `components/result/NextActionBlock.tsx`:

```tsx
import { AffiliateLinkGroup } from "@/components/primitives/AffiliateLinkGroup";
import { TalkLink } from "@/components/primitives/TalkLink";
import type { ActionKind, ActionView, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
import { ActionControl } from "./ActionControl";

const TALK_KINDS: ReadonlySet<ActionKind> = new Set<ActionKind>(["talk", "copyAndTalk"]);

export interface NextActionBlockProps {
  readonly view: TrackingViewModel;
  readonly headingId: string;
  readonly onAction: (action: ResultAction) => void;
  readonly undeliveredHelpId: string | null;
}

/**
 * 지금 할 일 (spec §6): one sentence, at most one filled action, one or two secondary ones.
 * Store links lead only for delivered (spec §8 "스토어 선두") and follow 톡톡 for pending (purchase choices after the
 * disclosure). 톡톡 appears once: the worry line gets its own 톡톡 link only when no 톡톡 control is in the block.
 */
export function NextActionBlock({ view, headingId, onAction, undeliveredHelpId }: NextActionBlockProps): React.JSX.Element {
  const next = view.nextAction;
  const controls = [next.primary, ...next.secondary].filter((item): item is ActionView => item !== null);
  const hasTalk = controls.some((item) => TALK_KINDS.has(item.kind));
  const storesLead = next.stores !== null && next.stores.placement === "deliveredLead";
  const render = (item: ActionView): React.JSX.Element => (
    <ActionControl
      key={`${item.kind}:${item.label}`}
      action={item}
      onAction={onAction}
      inquiryCopy={view.inquiryCopy}
      returnLink={view.returnLink}
      undeliveredHelpId={undeliveredHelpId}
    />
  );
  return (
    <section
      data-cta-state={view.ctaState}
      aria-labelledby={next.heading === null ? undefined : headingId}
      className="flex min-w-0 flex-col gap-3 bg-tt-surface px-[var(--tt-gutter)] py-4 text-tt-ink"
    >
      {next.heading === null ? null : (
        <h3 id={headingId} className="m-0 font-tt-display text-tt-md [font-weight:var(--tt-weight-display)] [word-break:keep-all]">
          {next.heading}
        </h3>
      )}
      <p className="m-0 text-tt-md font-bold [word-break:keep-all]">{next.sentence}</p>
      {storesLead && next.stores !== null ? <AffiliateLinkGroup stores={next.stores} /> : null}
      {next.primary === null ? null : <div className="flex flex-col items-stretch">{render(next.primary)}</div>}
      {next.secondary.length === 0 ? null : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{next.secondary.map(render)}</div>
      )}
      {next.worry === null ? null : (
        <p data-worry-line="true" className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-tt-sm [word-break:keep-all]">
          <span>{next.worry.text}</span>
          {hasTalk || next.worry.talk.href === null ? null : (
            <TalkLink href={next.worry.talk.href} label={next.worry.talk.label} weight="text" placement="state" />
          )}
        </p>
      )}
      {!storesLead && next.stores !== null ? <AffiliateLinkGroup stores={next.stores} /> : null}
      {next.note === null ? null : (
        <p data-next-note="true" className="m-0 text-tt-sm text-tt-muted [word-break:keep-all]">
          {next.note}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 8: Render the auxiliary line and 지금 할 일 in `ResultView`**

Replace the whole content of `components/result/ResultView.tsx` with:

```tsx
"use client";

import { useId } from "react";
import { channels } from "@/config/site.config";
import type { FailureCause, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
import { ActionControl } from "./ActionControl";
import { NextActionBlock } from "./NextActionBlock";
import { StatusCard } from "./StatusCard";

export interface ResultViewProps {
  readonly view: TrackingViewModel;
  readonly onAction: (action: ResultAction) => void;
  readonly headingRef?: React.Ref<HTMLHeadingElement>;
  /** Placed per view.revenue.recommendations and guideKey; never between the fixed-order blocks. */
  readonly recommendationSlot?: React.ReactNode;
  /** CS preview: actions inert, no focus moves. */
  readonly readOnly?: boolean;
  /** "mobile" forces the 375 px single column (CS preview). */
  readonly frame?: "responsive" | "mobile";
  /** S07 addition: the cause behind an error view, for data-failure-cause on the failure card. */
  readonly failureCause?: FailureCause;
}

type ExternalTarget = Extract<ResultAction, { kind: "openedExternal" }>["target"];

/** Which outside place a result link opens (reported for analytics, S11). */
function externalTarget(anchor: HTMLAnchorElement): ExternalTarget | null {
  const href = anchor.getAttribute("href") ?? "";
  if (href.startsWith("tel:")) return "driver";
  if (anchor.target !== "_blank") return null;
  if (href === channels.talk.url) return "talk";
  if (anchor.closest("[data-affiliate-group], [data-recommended-products]") !== null) return "store";
  return "carrier";
}

function reportExternal(event: React.MouseEvent<HTMLElement>, onAction: (action: ResultAction) => void): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return;
  const kind = externalTarget(anchor);
  if (kind !== null) onAction({ kind: "openedExternal", target: kind });
}

/**
 * The result area (spec §6–§7), loaded lazily through result-module.ts. It renders only the view model, in the fixed
 * order 상태 카드 → 도착 예상 → 지금 할 일 → 마지막 처리 → 처리 내역. The number bar above it belongs to the caller.
 */
export function ResultView({ view, onAction, headingRef, readOnly = false, frame = "responsive" }: ResultViewProps): React.JSX.Element {
  const baseId = useId();
  const auxiliary = view.auxiliaryLine;
  return (
    <div
      data-result-view={view.mode}
      data-ad-exclude="true"
      data-frame={frame}
      data-read-only={readOnly ? "true" : undefined}
      onClick={(event) => reportExternal(event, onAction)}
      className="mx-auto flex w-full flex-col gap-4"
    >
      <div data-result-main="true" className="flex min-w-0 flex-col gap-4">
        <StatusCard view={view} titleId={`${baseId}-title`} headingRef={headingRef}>
          {auxiliary === null ? null : (
            <p data-auxiliary-line="true" className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-tt-sm font-medium [word-break:keep-all]">
              <span>{auxiliary.text}</span>
              {auxiliary.action === null ? null : (
                <ActionControl
                  action={auxiliary.action}
                  onAction={onAction}
                  inquiryCopy={view.inquiryCopy}
                  returnLink={view.returnLink}
                  undeliveredHelpId={null}
                />
              )}
            </p>
          )}
        </StatusCard>
        <NextActionBlock view={view} headingId={`${baseId}-next`} onAction={onAction} undeliveredHelpId={null} />
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/result-module.spec.ts tests/unit/config.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed (`5 passed` in `result-module.spec.ts`; S03's `config.spec.ts` unchanged and green — its invariants also scan the four new strings). If a `config.spec.ts` test pins the exact key list of `resultCopy`, append `"returnLinkCopied", "returnLinkShared", "returnLinkFallback", "inquiryCopied"` to that list (the only allowed edit of that S03 file), re-run, and name it in the stage summary.
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-kit.spec.ts tests/e2e/return-link.spec.ts`
Expected: `result-kit.spec.ts` `13 passed`; S02's `return-link.spec.ts` still passes (it still runs against `ReturnLinkButton` on the live page until Task 8).
Run: `npm run typecheck; npm run lint`
Expected: both exit 0, no new warnings.

- [ ] **Step 10: Commit**

```powershell
git add lib/config/types.ts config/site.config.ts lib/config/invariants.ts components/result/details.ts components/result/ReturnLinkAction.tsx components/result/ActionControl.tsx components/result/NextActionBlock.tsx components/result/ResultView.tsx tests/unit/result-module.spec.ts tests/e2e/result-kit.spec.ts
git commit -m "feat: render 지금 할 일 with one 톡톡 place, the return-link control and copy feedback"
```

(If Step 4 had to touch `tests/fixtures/config-fixtures.ts`, add it to the `git add` line.)

---

### Task 3: Carrier chooser (fieldset + radio chips)

**Files:**
- Create: `components/result/CarrierChooser.tsx`
- Modify: `components/result/NextActionBlock.tsx` (props interface, signature, one render line)
- Modify: `components/result/ResultView.tsx` (import, `NextActionBlock` element)
- Test: `tests/e2e/result-kit.spec.ts` (import block, one describe block)

**Interfaces:**
- Consumes: `CarrierChoiceView`, `ConcreteCarrierCode` (S03); `buttonClassName(variant, size, extra?)` (S05 `Button.tsx`); `NextActionBlock` (Task 2).
- Produces: `CarrierChooser(props: { choices: readonly CarrierChoiceView[]; onChoose: (carrier: ConcreteCarrierCode) => void }): React.JSX.Element` (root `fieldset[data-carrier-chooser]`, legend '택배사 선택'); `NextActionBlockProps.carrierChooser?: React.ReactNode`; `ResultView` reports `{ kind: "chooseCarrier", carrier }`.

- [ ] **Step 1: Write the failing tests**

In `tests/e2e/result-kit.spec.ts`, replace the `from "../fixtures/derive-scenarios";` import (the multi-line one) with:

```ts
import {
  OCTOBER_NOW, ambiguousData, carrierCutData, customsWaitingData, deliveredData, inTransitData, lookupUnavailableData, pendingData,
  staleData, success
} from "../fixtures/derive-scenarios";
```

Append to the end of the file:

```ts
test.describe("carrier chooser", () => {
  test("ambiguous: a '택배사 선택' group of five 44 px radio chips; a pointer choice reports chooseCarrier", async ({ page }) => {
    const view = viewFor(success(ambiguousData()));
    await openKit(page);
    await showView(page, view);
    const group = page.locator('[data-cta-state="ambiguous"]').getByRole("group", { name: "택배사 선택" });
    await expect(group.getByRole("radio")).toHaveCount(5);
    await expect(group.locator("label")).toHaveText((view.nextAction.carrierChoices ?? []).map((choice) => choice.name));
    const heights = await group.locator("label").evaluateAll((labels) => labels.map((label) => label.getBoundingClientRect().height));
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
    await group.getByRole("radio", { name: "한진택배" }).click();
    expect(await kitActions(page)).toEqual([{ kind: "chooseCarrier", carrier: "HANJIN" }]);
  });

  test("a double click reports one choice", async ({ page }) => {
    await openKit(page);
    await showView(page, viewFor(success(ambiguousData())));
    await page.getByRole("group", { name: "택배사 선택" }).getByText("롯데택배", { exact: true }).dblclick();
    expect(await kitActions(page)).toEqual([{ kind: "chooseCarrier", carrier: "LOTTE" }]);
  });

  test("keyboard: arrows move without choosing; Space or Enter chooses the focused carrier", async ({ page }) => {
    await openKit(page);
    await showView(page, viewFor(success(ambiguousData())));
    const group = page.getByRole("group", { name: "택배사 선택" });
    await group.getByRole("radio", { name: "CJ대한통운" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "우체국택배" })).toBeFocused();
    expect(await kitActions(page)).toEqual([]);
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "한진택배" })).toBeFocused();
    await page.keyboard.press("Enter");
    expect(await kitActions(page)).toEqual([
      { kind: "chooseCarrier", carrier: "EPOST" },
      { kind: "chooseCarrier", carrier: "HANJIN" }
    ]);
  });

  test("a carrier lookup delay without an official link offers the same chooser under its sentence", async ({ page }) => {
    const view = viewFor(success(lookupUnavailableData("AUTO")));
    await openKit(page);
    await showView(page, view);
    const cta = page.locator('[data-cta-state="lookupUnavailable"]');
    await expect(cta.getByText(view.nextAction.sentence, { exact: true })).toBeVisible();
    await expect(cta.getByRole("group", { name: "택배사 선택" }).getByRole("radio")).toHaveCount(5);
    await expect(cta.locator('[data-slot="button"][data-variant="primary"]')).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-kit.spec.ts -g "carrier chooser"`
Expected: `4 failed` — `getByRole('group', { name: '택배사 선택' })` resolves to nothing.

- [ ] **Step 3: Create the chooser**

Create `components/result/CarrierChooser.tsx`:

```tsx
"use client";

import { useId, useRef } from "react";
import { buttonClassName } from "@/components/primitives/Button";
import type { CarrierChoiceView, ConcreteCarrierCode } from "@/lib/tracking/types";

const LEGEND = "택배사 선택";
/** A second activation of the same chip inside this window (double click, label + input click) is the same choice. */
const REPEAT_GUARD_MS = 600;

export interface CarrierChooserProps {
  readonly choices: readonly CarrierChoiceView[];
  readonly onChoose: (carrier: ConcreteCarrierCode) => void;
}

/**
 * fieldset '택배사 선택' with one 44 px radio chip per carrier (spec §7 ambiguous / lookupUnavailable, §12 "carriers as
 * fieldset + radio"). A pointer click chooses at once; the keyboard moves with the arrow keys and chooses with Space or
 * Enter, so arrowing through the group never starts a lookup (WCAG 3.2.2).
 */
export function CarrierChooser({ choices, onChoose }: CarrierChooserProps): React.JSX.Element {
  const name = useId();
  const lastChoiceRef = useRef<{ readonly code: ConcreteCarrierCode; readonly at: number } | null>(null);

  const choose = (code: ConcreteCarrierCode): void => {
    const now = Date.now();
    const last = lastChoiceRef.current;
    if (last !== null && last.code === code && now - last.at < REPEAT_GUARD_MS) return;
    lastChoiceRef.current = { code, at: now };
    onChoose(code);
  };

  return (
    <fieldset data-carrier-chooser="true" className="m-0 min-w-0 border-0 p-0">
      <legend className="sr-only">{LEGEND}</legend>
      <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3">
        {choices.map((choice) => (
          <label
            key={choice.code}
            className={buttonClassName("secondary", "md", "cursor-pointer")}
            onClick={(event) => {
              // Pointer clicks carry detail ≥ 1; clicks the browser synthesizes for keyboard selection carry 0.
              if (event.detail > 0) choose(choice.code);
            }}
          >
            <input
              type="radio"
              name={name}
              value={choice.code}
              className="tt-focus m-0 h-5 w-5 shrink-0 accent-[var(--tt-ink)]"
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                choose(choice.code);
              }}
            />
            <span>{choice.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 4: Give 지금 할 일 a chooser slot and fill it**

In `components/result/NextActionBlock.tsx`:
(a) replace

```tsx
  readonly undeliveredHelpId: string | null;
}
```

with

```tsx
  readonly undeliveredHelpId: string | null;
  /** CarrierChooser for ambiguous results and carrier delays without an official link. */
  readonly carrierChooser?: React.ReactNode;
}
```

(b) replace `export function NextActionBlock({ view, headingId, onAction, undeliveredHelpId }: NextActionBlockProps): React.JSX.Element {` with

```tsx
export function NextActionBlock({ view, headingId, onAction, undeliveredHelpId, carrierChooser }: NextActionBlockProps): React.JSX.Element {
```

(c) replace `      {!storesLead && next.stores !== null ? <AffiliateLinkGroup stores={next.stores} /> : null}` with

```tsx
      {!storesLead && next.stores !== null ? <AffiliateLinkGroup stores={next.stores} /> : null}
      {carrierChooser}
```

In `components/result/ResultView.tsx`:
(a) replace `import { ActionControl } from "./ActionControl";` with

```tsx
import { ActionControl } from "./ActionControl";
import { CarrierChooser } from "./CarrierChooser";
```

(b) replace `        <NextActionBlock view={view} headingId={`${baseId}-next`} onAction={onAction} undeliveredHelpId={null} />` with

```tsx
        <NextActionBlock
          view={view}
          headingId={`${baseId}-next`}
          onAction={onAction}
          undeliveredHelpId={null}
          carrierChooser={
            view.nextAction.carrierChoices === null ? undefined : (
              <CarrierChooser
                choices={view.nextAction.carrierChoices}
                onChoose={(carrier) => onAction({ kind: "chooseCarrier", carrier })}
              />
            )
          }
        />
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-kit.spec.ts`
Expected: `17 passed`.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0, no new warnings.

- [ ] **Step 6: Commit**

```powershell
git add components/result/CarrierChooser.tsx components/result/NextActionBlock.tsx components/result/ResultView.tsx tests/e2e/result-kit.spec.ts
git commit -m "feat: choose a carrier with radio chips that never re-look up while arrowing"
```

---

### Task 4: Last event, 처리 내역, 미수령 안내, help items and the recommendation slot

**Files:**
- Create: `components/result/LastEventLine.tsx`
- Create: `components/result/HistoryDetails.tsx`
- Create: `components/result/HelpItems.tsx`
- Create: `components/result/DeliveredHelp.tsx`
- Modify: `components/result/ResultView.tsx` (whole file)
- Test: `tests/e2e/result-kit.spec.ts` (one helper, one describe block)

**Interfaces:**
- Consumes: `LastEventView`, `HistoryView`, `HistoryEventView`, `HelpItemView` (S03); Tasks 1–3.
- Produces: `LastEventLine(props: { lastEvent: LastEventView | null })` (`p[data-last-event]`); `HistoryDetails(props: { history: HistoryView; id: string })` (`details[data-history]` or `p[data-history-empty]`); `HistoryEventItem(props: { event: HistoryEventView })`; `HelpDetails(props: { item: HelpItemView; id?: string; deliveredHelp?: boolean })`, `HelpItems(props: { items: readonly HelpItemView[] })` (`div[data-help-list]`); `UNDELIVERED_HELP_ITEM_ID = "undelivered"`, `DeliveredHelp(props: { item: HelpItemView; id: string })` (`details[data-delivered-help]`); in `ResultView`: `div[data-primary-end]` after the last event, `div[data-recommendation-slot]` after the marker for delivered and after the history otherwise, nothing when `view.revenue.recommendations === "none"`.

- [ ] **Step 1: Write the failing tests**

In `tests/e2e/result-kit.spec.ts`, directly below the `removeShareSheet` function, add:

```ts
/** True when `second` comes after `first` in document order (both must exist). */
async function follows(page: Page, first: string, second: string): Promise<boolean> {
  return page.evaluate(
    ([one, two]) => {
      const a = document.querySelector(one);
      const b = document.querySelector(two);
      return a !== null && b !== null && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    },
    [first, second] as const
  );
}
```

Append to the end of the file:

```ts
test.describe("last event, history, help and the recommendation slot", () => {
  test("the fixed order: status h2 → ETA → 지금 할 일 → last event → primary-end → 처리 내역", async ({ page }) => {
    await openKit(page);
    await showView(page, viewFor(success(customsWaitingData())));
    const chain = [
      "[data-result-view] h2",
      '[data-result-view] [data-slot="eta"]',
      "[data-result-view] [data-cta-state]",
      "[data-result-view] [data-last-event]",
      "[data-result-view] [data-primary-end]",
      "[data-result-view] details[data-history]"
    ];
    for (let index = 1; index < chain.length; index += 1) {
      expect(await follows(page, chain[index - 1], chain[index]), chain[index]).toBe(true);
    }
  });

  test("마지막 처리 line, then a closed '처리 내역' details grouped by station without aria-current", async ({ page }) => {
    const view = viewFor(success(customsWaitingData()));
    await openKit(page);
    await showView(page, view);
    const root = page.locator("[data-result-view]");
    const last = root.locator("[data-last-event]");
    await expect(last).toContainText("마지막 처리");
    await expect(last).toContainText(view.lastEvent?.text ?? "");
    await expect(last).toContainText(view.lastEvent?.original ?? "");
    const history = root.locator("details[data-history]");
    await expect(history).not.toHaveAttribute("open");
    await expect(history.locator("summary")).toHaveText(view.history.summaryText);
    await history.locator("summary").click();
    await expect(history).toHaveAttribute("open", "");
    await expect(history.locator("[data-history-segment]")).toHaveCount(view.history.segments.length);
    await expect(history.locator("li")).toHaveCount(view.history.count);
    await expect(history.locator("[aria-current]")).toHaveCount(0);
  });

  test("pending shows one sentence instead of an empty history", async ({ page }) => {
    const view = viewFor(success(pendingData()));
    await openKit(page);
    await showView(page, view);
    await expect(page.locator("[data-history-empty]")).toHaveText(view.history.emptyText ?? "");
    await expect(page.locator("details[data-history]")).toHaveCount(0);
  });

  test("받지 못하셨나요? opens the 미수령 안내 and focuses its summary", async ({ page }) => {
    await openKit(page);
    await showView(page, viewFor(success(deliveredData())));
    const help = page.locator("details[data-delivered-help]");
    await expect(help).not.toHaveAttribute("open");
    await page.locator('[data-cta-state="delivered"]').getByRole("button", { name: "받지 못하셨나요?" }).click();
    await expect(help).toHaveAttribute("open", "");
    await expect(help.locator("summary")).toBeFocused();
  });

  test("help items follow the view: stale opens the customs-delay item", async ({ page }) => {
    const view = viewFor(success(staleData()));
    await openKit(page);
    await showView(page, view);
    const shown = await page
      .locator("[data-result-view] details[data-help]")
      .evaluateAll((items) => items.map((item) => [item.getAttribute("data-help"), item instanceof HTMLDetailsElement && item.open]));
    expect(shown).toEqual(view.help.map((item) => [item.id, item.defaultOpen]));
  });

  test("the recommendation slot: after the history, right after primary-end for delivered, absent without recommendations", async ({ page }) => {
    await openKit(page);
    await showView(page, viewFor(success(inTransitData()), OCTOBER_NOW), { withRecommendation: true });
    const slot = "[data-result-view] [data-recommendation-slot]";
    await expect(page.locator(`${slot} [data-recommended-products="inTransit"]`)).toBeVisible();
    expect(await follows(page, "[data-result-view] [data-primary-end]", slot)).toBe(true);
    expect(await follows(page, "[data-result-view] details[data-history]", slot)).toBe(true);

    await showView(page, viewFor(success(deliveredData())), { withRecommendation: true });
    await expect(page.locator(`${slot} [data-recommended-products="delivered"]`)).toBeVisible();
    expect(await follows(page, "[data-result-view] [data-primary-end]", slot)).toBe(true);
    expect(await follows(page, slot, "[data-result-view] details[data-history]")).toBe(true);

    await showView(page, viewFor(success(staleData())), { withRecommendation: true });
    await expect(page.locator('[data-cta-state="stale"]')).toBeVisible();
    await expect(page.locator(slot)).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-kit.spec.ts -g "last event, history"`
Expected: `6 failed` — `[data-last-event]`, `details[data-history]`, `[data-history-empty]`, `details[data-delivered-help]`, `details[data-help]` and `[data-recommendation-slot]` do not exist yet.

- [ ] **Step 3: Create the detail components**

Create `components/result/LastEventLine.tsx`:

```tsx
import type { LastEventView } from "@/lib/tracking/types";

const LAST_EVENT_LABEL = "마지막 처리";

/** 마지막 처리 (spec §6 상세): '9월 23일 (수) 14:10 · 통관 접수', the place, and the original term in small print. */
export function LastEventLine({ lastEvent }: { readonly lastEvent: LastEventView | null }): React.JSX.Element | null {
  if (lastEvent === null) return null;
  return (
    <p
      data-last-event="true"
      className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-[var(--tt-gutter)] text-tt-sm text-tt-ink [overflow-wrap:anywhere] [word-break:keep-all]"
    >
      <span className="font-bold">{LAST_EVENT_LABEL}</span>
      <span>{lastEvent.place === null ? lastEvent.text : `${lastEvent.text} · ${lastEvent.place}`}</span>
      {lastEvent.original === null ? null : <span className="text-tt-xs text-tt-muted">{lastEvent.original}</span>}
    </p>
  );
}
```

Create `components/result/HistoryDetails.tsx`:

```tsx
import type { HistoryEventView, HistoryView } from "@/lib/tracking/types";

/** One event of the vertical history: time, customer label (· place), original term. Never aria-current. */
export function HistoryEventItem({ event }: { readonly event: HistoryEventView }): React.JSX.Element {
  return (
    <li className="flex flex-col gap-0.5 border-0 border-l-2 border-solid border-tt-rule pl-3 [overflow-wrap:anywhere] [word-break:keep-all]">
      <time dateTime={event.at} className="text-tt-xs font-medium text-tt-muted">
        {event.timeText}
      </time>
      <span className="text-tt-sm font-bold">
        {event.label}
        {event.place === null ? null : <span className="font-medium"> · {event.place}</span>}
      </span>
      {event.original === null ? null : <span className="text-tt-xs text-tt-muted">{event.original}</span>}
    </li>
  );
}

/**
 * <details> '처리 내역 N건 보기 · 마지막 …' (spec §6 상세): closed by default; inside, the stations the shipment passed,
 * each with its events in time order. With no events it is one sentence instead of an empty box (spec §7 pending).
 */
export function HistoryDetails({ history, id }: { readonly history: HistoryView; readonly id: string }): React.JSX.Element | null {
  if (history.count === 0) {
    return history.emptyText === null ? null : (
      <p data-history-empty="true" className="m-0 px-[var(--tt-gutter)] text-tt-sm text-tt-muted [word-break:keep-all]">
        {history.emptyText}
      </p>
    );
  }
  return (
    <details id={id} data-history="true" className="bg-tt-surface px-[var(--tt-gutter)] text-tt-ink">
      <summary className="tt-focus flex min-h-[44px] cursor-pointer items-center text-tt-sm font-bold [word-break:keep-all]">
        {history.summaryText}
      </summary>
      <div className="flex flex-col gap-4 pb-4">
        {history.segments.map((segment) => (
          <section
            key={segment.station}
            data-history-segment={segment.station}
            aria-labelledby={`${id}-${segment.station}`}
            className="flex flex-col gap-2"
          >
            <h3 id={`${id}-${segment.station}`} className="m-0 text-tt-sm font-bold">
              {segment.title}
            </h3>
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {segment.events.map((event, index) => (
                <HistoryEventItem key={`${event.at}-${index}`} event={event} />
              ))}
            </ol>
          </section>
        ))}
      </div>
    </details>
  );
}
```

Create `components/result/HelpItems.tsx`:

```tsx
import type { HelpItemView } from "@/lib/tracking/types";

/** One help item as a <details> (open when the view says defaultOpen). Contains no links: 톡톡 stays in one place. */
export function HelpDetails({
  item,
  id,
  deliveredHelp = false
}: {
  readonly item: HelpItemView;
  readonly id?: string;
  readonly deliveredHelp?: boolean;
}): React.JSX.Element {
  return (
    <details
      id={id}
      data-help={item.id}
      data-delivered-help={deliveredHelp ? "true" : undefined}
      open={item.defaultOpen}
      className="bg-tt-surface px-[var(--tt-gutter)] text-tt-ink"
    >
      <summary className="tt-focus flex min-h-[44px] cursor-pointer items-center text-tt-sm font-bold [word-break:keep-all]">
        {item.summary}
      </summary>
      <div className="flex flex-col gap-1 pb-3">
        {item.body.map((line) => (
          <p key={line} className="m-0 text-tt-sm [overflow-wrap:anywhere] [word-break:keep-all]">
            {line}
          </p>
        ))}
      </div>
    </details>
  );
}

/** The state's help items in config order (config/site.config.ts help[].showIn / openIn). */
export function HelpItems({ items }: { readonly items: readonly HelpItemView[] }): React.JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <div data-help-list="true" className="flex flex-col gap-2">
      {items.map((item) => (
        <HelpDetails key={item.id} item={item} />
      ))}
    </div>
  );
}
```

Create `components/result/DeliveredHelp.tsx`:

```tsx
import type { HelpItemView } from "@/lib/tracking/types";
import { HelpDetails } from "./HelpItems";

/** The config help id (config/site.config.ts help[].id) whose body is the 미수령 안내 of a delivered result. */
export const UNDELIVERED_HELP_ITEM_ID = "undelivered";

/**
 * 미수령 안내 (spec §7 delivered): 문 앞·경비실·택배함 → 기사님 → 24시간 뒤 톡톡, as text. It sits in the main column right
 * after 처리 내역 and is opened by [받지 못하셨나요?] (`openDetails(id)`).
 */
export function DeliveredHelp({ item, id }: { readonly item: HelpItemView; readonly id: string }): React.JSX.Element {
  return <HelpDetails item={item} id={id} deliveredHelp />;
}
```

- [ ] **Step 4: Compose the full settled flow in `ResultView`**

Replace the whole content of `components/result/ResultView.tsx` with:

```tsx
"use client";

import { useId } from "react";
import { channels } from "@/config/site.config";
import type { FailureCause, HelpItemView, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
import { ActionControl } from "./ActionControl";
import { CarrierChooser } from "./CarrierChooser";
import { DeliveredHelp, UNDELIVERED_HELP_ITEM_ID } from "./DeliveredHelp";
import { HelpItems } from "./HelpItems";
import { HistoryDetails } from "./HistoryDetails";
import { LastEventLine } from "./LastEventLine";
import { NextActionBlock } from "./NextActionBlock";
import { StatusCard } from "./StatusCard";

export interface ResultViewProps {
  readonly view: TrackingViewModel;
  readonly onAction: (action: ResultAction) => void;
  readonly headingRef?: React.Ref<HTMLHeadingElement>;
  /** Placed per view.revenue.recommendations and guideKey; never between the fixed-order blocks. */
  readonly recommendationSlot?: React.ReactNode;
  /** CS preview: actions inert, no focus moves. */
  readonly readOnly?: boolean;
  /** "mobile" forces the 375 px single column (CS preview). */
  readonly frame?: "responsive" | "mobile";
  /** S07 addition: the cause behind an error view, for data-failure-cause on the failure card. */
  readonly failureCause?: FailureCause;
}

type ExternalTarget = Extract<ResultAction, { kind: "openedExternal" }>["target"];

/** Which outside place a result link opens (reported for analytics, S11). */
function externalTarget(anchor: HTMLAnchorElement): ExternalTarget | null {
  const href = anchor.getAttribute("href") ?? "";
  if (href.startsWith("tel:")) return "driver";
  if (anchor.target !== "_blank") return null;
  if (href === channels.talk.url) return "talk";
  if (anchor.closest("[data-affiliate-group], [data-recommended-products]") !== null) return "store";
  return "carrier";
}

function reportExternal(event: React.MouseEvent<HTMLElement>, onAction: (action: ResultAction) => void): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return;
  const kind = externalTarget(anchor);
  if (kind !== null) onAction({ kind: "openedExternal", target: kind });
}

function AuxiliaryLine({
  view,
  onAction
}: {
  readonly view: TrackingViewModel;
  readonly onAction: (action: ResultAction) => void;
}): React.JSX.Element | null {
  const line = view.auxiliaryLine;
  if (line === null) return null;
  return (
    <p data-auxiliary-line="true" className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-tt-sm font-medium [word-break:keep-all]">
      <span>{line.text}</span>
      {line.action === null ? null : (
        <ActionControl action={line.action} onAction={onAction} inquiryCopy={view.inquiryCopy} returnLink={view.returnLink} undeliveredHelpId={null} />
      )}
    </p>
  );
}

/**
 * The result area (spec §6–§7), loaded lazily through result-module.ts. It renders only the view model, in the fixed
 * order 상태 카드 → 도착 예상 → 지금 할 일 → 마지막 처리 (data-primary-end) → 처리 내역. Recommendations come right after
 * the marker for delivered (spec §7 "CTA 바로 아래") and after 처리 내역 otherwise — never between the fixed blocks.
 * The number bar above it belongs to the caller.
 */
export function ResultView({ view, onAction, headingRef, recommendationSlot, readOnly = false, frame = "responsive" }: ResultViewProps): React.JSX.Element {
  const baseId = useId();
  const historyId = `${baseId}-history`;
  const undeliveredId = `${baseId}-undelivered`;
  const undelivered: HelpItemView | null = view.help.find((item) => item.id === UNDELIVERED_HELP_ITEM_ID) ?? null;
  const otherHelp = view.help.filter((item) => item.id !== UNDELIVERED_HELP_ITEM_ID);
  const choices = view.nextAction.carrierChoices;
  const hasRecommendations = view.revenue.recommendations !== "none" && recommendationSlot !== undefined && recommendationSlot !== null;
  const recommendations = hasRecommendations ? <div data-recommendation-slot="true">{recommendationSlot}</div> : null;
  const recommendationsLead = view.guideKey === "delivered";
  return (
    <div
      data-result-view={view.mode}
      data-ad-exclude="true"
      data-frame={frame}
      data-read-only={readOnly ? "true" : undefined}
      onClick={(event) => reportExternal(event, onAction)}
      className="mx-auto flex w-full flex-col gap-4"
    >
      <div data-result-main="true" className="flex min-w-0 flex-col gap-4">
        <StatusCard view={view} titleId={`${baseId}-title`} headingRef={headingRef}>
          <AuxiliaryLine view={view} onAction={onAction} />
        </StatusCard>
        <NextActionBlock
          view={view}
          headingId={`${baseId}-next`}
          onAction={onAction}
          undeliveredHelpId={undelivered === null ? null : undeliveredId}
          carrierChooser={
            choices === null ? undefined : (
              <CarrierChooser choices={choices} onChoose={(carrier) => onAction({ kind: "chooseCarrier", carrier })} />
            )
          }
        />
        <LastEventLine lastEvent={view.lastEvent} />
        <div data-primary-end="true" aria-hidden="true" />
        {recommendationsLead ? recommendations : null}
        <HistoryDetails history={view.history} id={historyId} />
        {undelivered === null ? null : <DeliveredHelp item={undelivered} id={undeliveredId} />}
        {recommendationsLead ? null : recommendations}
        <HelpItems items={otherHelp} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-kit.spec.ts`
Expected: `23 passed`.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0, no new warnings.

- [ ] **Step 6: Commit**

```powershell
git add components/result/LastEventLine.tsx components/result/HistoryDetails.tsx components/result/HelpItems.tsx components/result/DeliveredHelp.tsx components/result/ResultView.tsx tests/e2e/result-kit.spec.ts
git commit -m "feat: add 마지막 처리, the 처리 내역 details, help items and the recommendation slot rules"
```

---

### Task 5: Side column, desktop two columns, mobile frame and read-only mode

**Files:**
- Create: `components/result/SideColumn.tsx`
- Modify: `components/result/ResultView.tsx` (whole file)
- Test: `tests/e2e/result-kit.spec.ts` (import block, one describe block)

**Interfaces:**
- Consumes: `HistoryEventItem` (Task 4), `HelpItems` (Task 4), `openDetails` (Task 2), `Button` (S05); tokens `--tt-column` (560 px) and `--tt-side` (320 px) (S05); `groupTrackingNumber(raw: string): string` (S03, test only); `FAKE.cargo` (S01, test only).
- Produces: `SideColumn(props: { view: TrackingViewModel; frame: "responsive" | "mobile"; historyId: string; help: readonly HelpItemView[] }): React.JSX.Element | null` (`div[data-side-column]`, recent list `section[data-history-recent]` visible from 1024 px); `ResultView` layouts: responsive = one column below 1024 px, `560 px | 320 px` grid from 1024 px; `frame="mobile"` = one 375 px column at any width; `readOnly` = every link, button, radio and label click is swallowed (no navigation, no copy, no `onAction`), `<details>` still toggle.

- [ ] **Step 1: Write the failing tests**

In `tests/e2e/result-kit.spec.ts`, replace the two imports

```ts
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import type { FailureCause, LookupOutcome, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
```

with

```ts
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import { groupTrackingNumber } from "@/lib/tracking/number-format";
import type { FailureCause, LookupOutcome, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
```

and replace `import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";` with `import { FAKE, FIXTURE_NOW } from "../fixtures/tracking-fixtures";`.

Append to the end of the file:

```ts
test.describe("layout and modes", () => {
  test("desktop 1440: a 560 px main column with a 320 px side column to its right; 전체 보기 opens the history", async ({ page }) => {
    const view = viewFor(success(inTransitData()), OCTOBER_NOW);
    await openKit(page, 1440, 900);
    await showView(page, view);
    const main = await page.locator("[data-result-main]").boundingBox();
    const side = await page.locator("[data-side-column]").boundingBox();
    expect(Math.round(main?.width ?? 0)).toBe(560);
    expect(Math.round(side?.width ?? 0)).toBe(320);
    expect(side?.x ?? 0).toBeGreaterThan((main?.x ?? 0) + (main?.width ?? 0));
    const recent = page.locator("[data-history-recent]");
    await expect(recent.locator("li")).toHaveCount(view.history.recent.length);
    await recent.getByRole("button", { name: "전체 보기" }).click();
    await expect(page.locator("details[data-history]")).toHaveAttribute("open", "");
    await expect(page.locator("details[data-history] summary")).toBeFocused();
  });

  test("below 1024 px the side column follows the main column and the recent list stays hidden", async ({ page }) => {
    await openKit(page, 768, 1024);
    await showView(page, viewFor(success(inTransitData()), OCTOBER_NOW));
    const main = await page.locator("[data-result-main]").boundingBox();
    const side = await page.locator("[data-side-column]").boundingBox();
    expect(side?.y ?? 0).toBeGreaterThanOrEqual((main?.y ?? 0) + (main?.height ?? 0) - 1);
    await expect(page.locator("[data-history-recent]")).toBeHidden();
  });

  test("the mobile frame keeps one 375 px column even at 1440 and renders no recent list", async ({ page }) => {
    await openKit(page, 1440, 900);
    await showView(page, viewFor(success(inTransitData()), OCTOBER_NOW), { frame: "mobile" });
    const root = page.locator("[data-result-view]");
    await expect(root).toHaveAttribute("data-frame", "mobile");
    expect((await root.boundingBox())?.width ?? 0).toBeLessThanOrEqual(375);
    await expect(page.locator("[data-history-recent]")).toHaveCount(0);
    const main = await page.locator("[data-result-main]").boundingBox();
    const side = await page.locator("[data-side-column]").boundingBox();
    expect(side?.y ?? 0).toBeGreaterThanOrEqual((main?.y ?? 0) + (main?.height ?? 0) - 1);
  });

  test("read-only: links and buttons do nothing and report nothing, the details still open", async ({ page }) => {
    await blockOtherHosts(page);
    await openKit(page);
    await showView(page, viewFor(success(deliveredData())), { readOnly: true });
    await expect(page.locator("[data-result-view]")).toHaveAttribute("data-read-only", "true");
    let popups = 0;
    page.on("popup", () => {
      popups += 1;
    });
    await page.getByRole("link", { name: "네이버 스토어 보기 새 창으로 열기" }).click();
    await page.locator('[data-cta-state="delivered"]').getByRole("button", { name: "받지 못하셨나요?" }).click();
    // A popup that slipped past the guard would open within this time.
    await page.waitForTimeout(500);
    expect(popups).toBe(0);
    await expect(page.locator("details[data-delivered-help]")).not.toHaveAttribute("open");
    expect(await kitActions(page)).toEqual([]);
    await page.locator("details[data-history] summary").click();
    await expect(page.locator("details[data-history]")).toHaveAttribute("open", "");
  });

  test("long places, terms and inquiry text wrap at 320 px", async ({ page }) => {
    const base = viewFor(success(staleData()));
    const longPlace = "경기도 광주시 도척면 도척윗로 물류센터 제2동 통관 대기 구역 하역장";
    const longTerm = "통관목록심사완료및보세운송신고수리후반출대기";
    const view: TrackingViewModel = {
      ...base,
      lastEvent: base.lastEvent === null ? null : { ...base.lastEvent, place: longPlace, original: longTerm },
      history: {
        ...base.history,
        segments: base.history.segments.map((segment) => ({
          ...segment,
          events: segment.events.map((event) => ({ ...event, place: longPlace, original: longTerm }))
        }))
      },
      inquiryCopy: base.inquiryCopy === null ? null : base.inquiryCopy.replace(base.number.grouped, groupTrackingNumber(FAKE.cargo))
    };
    await openKit(page, 320, 800);
    await showView(page, view);
    await page.locator("details[data-history] summary").click();
    await expect(page.locator("[data-inquiry-preview]")).toHaveText(view.inquiryCopy ?? "");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("320 px: no horizontal scroll in pending, delivered, ambiguous and overdue results", async ({ page }) => {
    await openKit(page, 320, 800);
    for (const view of [
      viewFor(success(pendingData())),
      viewFor(success(deliveredData())),
      viewFor(success(ambiguousData())),
      viewFor(success(customsWaitingData()), at("2026-09-29T09:00:00+09:00"))
    ]) {
      await showView(page, view);
      await expect(page.locator(`[data-cta-state="${view.ctaState}"]`)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, view.guideKey).toBeLessThanOrEqual(0);
    }
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-kit.spec.ts -g "layout and modes"`
Expected: `4 failed, 2 passed` — failing: desktop (`[data-side-column]` has no box), below 1024 px (same), mobile frame (same), read-only (the naver link opens a popup: `popups` is 1). The two 320 px tests already pass (the columns stack and text wraps); they pin Review Focus 4 from here on.

- [ ] **Step 3: Create the side column**

Create `components/result/SideColumn.tsx`:

```tsx
import { Button } from "@/components/primitives/Button";
import type { HelpItemView, TrackingViewModel } from "@/lib/tracking/types";
import { openDetails } from "./details";
import { HelpItems } from "./HelpItems";
import { HistoryEventItem } from "./HistoryDetails";

const RECENT_HEADING = "처리 내역";
const SHOW_ALL = "전체 보기";

export interface SideColumnProps {
  readonly view: TrackingViewModel;
  readonly frame: "responsive" | "mobile";
  readonly historyId: string;
  readonly help: readonly HelpItemView[];
}

/**
 * Right column on desktop (spec §3 데스크톱 1440: 320 px beside the 560 px result): the newest three events with
 * '전체 보기' (opens 처리 내역) and the help items. Below 1024 px — and always in the mobile frame — it follows the main
 * column and the recent list is not shown, because the 처리 내역 details already hold the history.
 */
export function SideColumn({ view, frame, historyId, help }: SideColumnProps): React.JSX.Element | null {
  const recent = view.history.recent;
  const showRecent = frame === "responsive" && recent.length > 0;
  if (!showRecent && help.length === 0) return null;
  return (
    <div data-side-column="true" className="flex min-w-0 flex-col gap-4">
      {showRecent ? (
        <section
          data-history-recent="true"
          aria-labelledby={`${historyId}-recent`}
          className="hidden flex-col gap-3 bg-tt-surface px-4 py-4 text-tt-ink lg:flex"
        >
          <h3 id={`${historyId}-recent`} className="m-0 text-tt-sm font-bold">
            {RECENT_HEADING}
          </h3>
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {recent.map((event, index) => (
              <HistoryEventItem key={`${event.at}-${index}`} event={event} />
            ))}
          </ol>
          <Button variant="text" aria-controls={historyId} onClick={() => openDetails(historyId)}>
            {SHOW_ALL}
          </Button>
        </section>
      ) : null}
      <HelpItems items={help} />
    </div>
  );
}
```

- [ ] **Step 4: Layouts, frame and read-only mode in `ResultView`**

Replace the whole content of `components/result/ResultView.tsx` with:

```tsx
"use client";

import { useId } from "react";
import { channels } from "@/config/site.config";
import type { FailureCause, HelpItemView, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
import { ActionControl } from "./ActionControl";
import { CarrierChooser } from "./CarrierChooser";
import { DeliveredHelp, UNDELIVERED_HELP_ITEM_ID } from "./DeliveredHelp";
import { HistoryDetails } from "./HistoryDetails";
import { LastEventLine } from "./LastEventLine";
import { NextActionBlock } from "./NextActionBlock";
import { SideColumn } from "./SideColumn";
import { StatusCard } from "./StatusCard";

export interface ResultViewProps {
  readonly view: TrackingViewModel;
  readonly onAction: (action: ResultAction) => void;
  readonly headingRef?: React.Ref<HTMLHeadingElement>;
  /** Placed per view.revenue.recommendations and guideKey; never between the fixed-order blocks. */
  readonly recommendationSlot?: React.ReactNode;
  /** CS preview: actions inert, no focus moves. */
  readonly readOnly?: boolean;
  /** "mobile" forces the 375 px single column (CS preview). */
  readonly frame?: "responsive" | "mobile";
  /** S07 addition: the cause behind an error view, for data-failure-cause on the failure card. */
  readonly failureCause?: FailureCause;
}

/**
 * One column below 1024 px; from 1024 px the 560 px result with the 320 px side column (spec §3 데스크톱). At least as tall
 * as the viewport under the header and number bar (48 + 56 px = 6.5rem), so nothing below moves into view when the
 * result replaces the loading card (CLS ≤ 0.05).
 */
const RESPONSIVE_LAYOUT =
  "mx-auto flex min-h-[calc(100svh_-_6.5rem)] w-full flex-col gap-4 lg:grid lg:w-[calc(var(--tt-column)_+_var(--tt-side)_+_2rem)] lg:max-w-full lg:grid-cols-[minmax(0,var(--tt-column))_var(--tt-side)] lg:items-start lg:gap-8";
/** The CS preview's phone frame: one 375 px column at any window width. */
const MOBILE_FRAME_LAYOUT = "mx-auto flex w-full max-w-[375px] flex-col gap-4";

type ExternalTarget = Extract<ResultAction, { kind: "openedExternal" }>["target"];

const ignoreAction = (): void => undefined;

/** Which outside place a result link opens (reported for analytics, S11). */
function externalTarget(anchor: HTMLAnchorElement): ExternalTarget | null {
  const href = anchor.getAttribute("href") ?? "";
  if (href.startsWith("tel:")) return "driver";
  if (anchor.target !== "_blank") return null;
  if (href === channels.talk.url) return "talk";
  if (anchor.closest("[data-affiliate-group], [data-recommended-products]") !== null) return "store";
  return "carrier";
}

function reportExternal(event: React.MouseEvent<HTMLElement>, onAction: (action: ResultAction) => void): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return;
  const kind = externalTarget(anchor);
  if (kind !== null) onAction({ kind: "openedExternal", target: kind });
}

/** Read-only (CS preview): swallow activation of links, buttons, radios and chip labels before any handler runs. */
function blockActivation(event: React.MouseEvent<HTMLElement>): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest("a[href], button, input, label") === null) return;
  event.preventDefault();
  event.stopPropagation();
}

function AuxiliaryLine({
  view,
  onAction
}: {
  readonly view: TrackingViewModel;
  readonly onAction: (action: ResultAction) => void;
}): React.JSX.Element | null {
  const line = view.auxiliaryLine;
  if (line === null) return null;
  return (
    <p data-auxiliary-line="true" className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-tt-sm font-medium [word-break:keep-all]">
      <span>{line.text}</span>
      {line.action === null ? null : (
        <ActionControl action={line.action} onAction={onAction} inquiryCopy={view.inquiryCopy} returnLink={view.returnLink} undeliveredHelpId={null} />
      )}
    </p>
  );
}

/**
 * The result area (spec §6–§7), loaded lazily through result-module.ts. It renders only the view model, in the fixed
 * order 상태 카드 → 도착 예상 → 지금 할 일 → 마지막 처리 (data-primary-end) → 처리 내역. Recommendations come right after
 * the marker for delivered (spec §7 "CTA 바로 아래") and after 처리 내역 otherwise — never between the fixed blocks.
 * The number bar above it belongs to the caller.
 */
export function ResultView({
  view,
  onAction,
  headingRef,
  recommendationSlot,
  readOnly = false,
  frame = "responsive"
}: ResultViewProps): React.JSX.Element {
  const baseId = useId();
  const act = readOnly ? ignoreAction : onAction;
  const historyId = `${baseId}-history`;
  const undeliveredId = `${baseId}-undelivered`;
  const undelivered: HelpItemView | null = view.help.find((item) => item.id === UNDELIVERED_HELP_ITEM_ID) ?? null;
  const otherHelp = view.help.filter((item) => item.id !== UNDELIVERED_HELP_ITEM_ID);
  const choices = view.nextAction.carrierChoices;
  const hasRecommendations = view.revenue.recommendations !== "none" && recommendationSlot !== undefined && recommendationSlot !== null;
  const recommendations = hasRecommendations ? <div data-recommendation-slot="true">{recommendationSlot}</div> : null;
  const recommendationsLead = view.guideKey === "delivered";
  return (
    <div
      data-result-view={view.mode}
      data-ad-exclude="true"
      data-frame={frame}
      data-read-only={readOnly ? "true" : undefined}
      onClickCapture={readOnly ? blockActivation : undefined}
      onClick={readOnly ? undefined : (event) => reportExternal(event, onAction)}
      className={frame === "mobile" ? MOBILE_FRAME_LAYOUT : RESPONSIVE_LAYOUT}
    >
      <div data-result-main="true" className="flex min-w-0 flex-col gap-4">
        <StatusCard view={view} titleId={`${baseId}-title`} headingRef={headingRef}>
          <AuxiliaryLine view={view} onAction={act} />
        </StatusCard>
        <NextActionBlock
          view={view}
          headingId={`${baseId}-next`}
          onAction={act}
          undeliveredHelpId={undelivered === null ? null : undeliveredId}
          carrierChooser={
            choices === null ? undefined : (
              <CarrierChooser choices={choices} onChoose={(carrier) => act({ kind: "chooseCarrier", carrier })} />
            )
          }
        />
        <LastEventLine lastEvent={view.lastEvent} />
        <div data-primary-end="true" aria-hidden="true" />
        {recommendationsLead ? recommendations : null}
        <HistoryDetails history={view.history} id={historyId} />
        {undelivered === null ? null : <DeliveredHelp item={undelivered} id={undeliveredId} />}
        {recommendationsLead ? null : recommendations}
      </div>
      <SideColumn view={view} frame={frame} historyId={historyId} help={otherHelp} />
    </div>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-kit.spec.ts`
Expected: `29 passed` (the "help items follow the view" test of Task 4 still passes: the help `<details>` moved into the side column, which follows the main column at 375 px).
Run: `npm run typecheck; npm run lint`
Expected: both exit 0, no new warnings.

- [ ] **Step 6: Commit**

```powershell
git add components/result/SideColumn.tsx components/result/ResultView.tsx tests/e2e/result-kit.spec.ts
git commit -m "feat: lay the result out in two desktop columns with a mobile frame and a read-only mode"
```

---

### Task 6: `FailureCard` (moved from S04's `FailureNotice`) and the error branch

**Files:**
- Move: `components/status-slot/FailureNotice.tsx` → `components/result/FailureCard.tsx` (pure `git mv` commit first, so `git log --follow` keeps S04's history)
- Restore (transitional, deleted by Task 10): `components/status-slot/FailureNotice.tsx` and its importers exactly as before the move
- Rewrite: `components/result/FailureCard.tsx` (whole file)
- Modify: `components/result/ResultView.tsx` (whole file)
- Test: `tests/e2e/result-kit.spec.ts` (import block, one helper, one describe block)

**Interfaces:**
- Consumes: Tasks 1–5 (`ActionControl`, `HelpItems`, `ResultView`); `StatusChip`, `JourneySpine`, `NoticeBanner` (S05); error views from `deriveTrackingView(failure(cause, options), now, siteConfig)` (S03; `failure` from `tests/fixtures/derive-scenarios.ts`).
- Produces: `FailureCard(props: { view: TrackingViewModel; titleId: string; ctaHeadingId: string; onAction: (action: ResultAction) => void; headingRef?: React.Ref<HTMLHeadingElement>; failureCause?: FailureCause }): React.JSX.Element` — root `section[data-guide-key][data-failure-cause][data-tone][data-overdue="false"]`, recovery row `[data-recovery]` inside the `status-head` field, error block `section[data-cta-state="error"]` whose links follow the view order (톡톡 first), help items, `[data-primary-end]`; `ResultView` renders it for `view.mode === "error"` (no side column).

- [ ] **Step 1: Find the importers of `FailureNotice`**

Run: `Get-ChildItem -Recurse -Include *.ts,*.tsx app, components | Select-String -Pattern 'status-slot/FailureNotice|from "\./FailureNotice"' | ForEach-Object { "$($_.Path.Replace((Get-Location).Path + '\', '')):$($_.LineNumber): $($_.Line.Trim())" }`
Expected: one or more lines, at least `components\status-slot\StatusSlot.tsx:<n>: import … from "./FailureNotice";`. Write the list down; Steps 2 and 4 touch exactly these files.

- [ ] **Step 2: Move the file without changing its content**

Run: `git mv components/status-slot/FailureNotice.tsx components/result/FailureCard.tsx`
Then, with the Edit tool:
- in `components/result/FailureCard.tsx`, replace every `from "./` with `from "@/components/status-slot/` (its sibling imports stay valid after the move; skip this if it has none);
- in each importer from Step 1, replace the specifier `"./FailureNotice"` or `"@/components/status-slot/FailureNotice"` with `"@/components/result/FailureCard"`.
Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit the pure move**

Run: `git add -A components/status-slot components/result/FailureCard.tsx; git add <each importer from Step 1>; git commit -m "refactor: move FailureNotice to components/result/FailureCard.tsx"`
Run: `git show --stat --find-renames HEAD`
Expected: `components/{status-slot/FailureNotice.tsx => result/FailureCard.tsx}` listed as a rename (similarity ≥ 90 %), plus the importers with one changed line each.

- [ ] **Step 4: Put the transitional copy back for the R2 slot**

`StatusSlot` (S04) keeps rendering the old notice until Task 8 switches the page, and Task 10 deletes both. Run:
`git checkout HEAD~1 -- components/status-slot/FailureNotice.tsx <each importer from Step 1>`
Run: `npm run typecheck; git status --short`
Expected: typecheck exit 0; status shows `A  components/status-slot/FailureNotice.tsx` and the importers as modified (back to their pre-move import line).

- [ ] **Step 5: Write the failing tests**

In `tests/e2e/result-kit.spec.ts`:
(a) replace `import type { FailureCause, LookupOutcome, ResultAction, TrackingViewModel } from "@/lib/tracking/types";` with

```ts
import type { ActionView, FailureCause, LookupOutcome, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
```

(b) replace the `from "../fixtures/derive-scenarios";` import with

```ts
import {
  OCTOBER_NOW, ambiguousData, carrierCutData, customsWaitingData, deliveredData, failure, inTransitData, lookupUnavailableData,
  pendingData, staleData, success
} from "../fixtures/derive-scenarios";
```

(c) directly below the `follows` function, add:

```ts
const RECOVERY_KINDS: readonly ActionView["kind"][] = ["fixNumber", "retry"];

function viewActions(view: TrackingViewModel): readonly ActionView[] {
  return [view.nextAction.primary, ...view.nextAction.secondary].filter((item): item is ActionView => item !== null);
}

/** Links of the error block in view order: every action that is not a recovery step and has an href. */
function inquiryHrefs(view: TrackingViewModel): readonly string[] {
  return viewActions(view)
    .filter((item) => !RECOVERY_KINDS.includes(item.kind) && item.href !== null)
    .map((item) => item.href ?? "");
}
```

(d) append to the end of the file:

```ts
test.describe("failure card", () => {
  test("NOT_FOUND: 번호 수정 in the card, 톡톡 first in the error block, the worry line without a second 톡톡 link, no store", async ({ page }) => {
    const view = viewFor(failure("notFound"));
    await openKit(page);
    await showView(page, view, { failureCause: "notFound" });
    await expect(page.locator("[data-result-view]")).toHaveAttribute("data-result-view", "error");
    const card = page.locator("[data-result-view] [data-guide-key]");
    await expect(card).toHaveAttribute("data-guide-key", "notFound");
    await expect(card).toHaveAttribute("data-failure-cause", "notFound");
    await expect(card).toHaveAttribute("data-tone", "attention");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(view.title);
    const field = card.locator('[data-slot="status-head"]');
    await expect(field.locator('[aria-current="step"]')).toHaveCount(0);
    await expect(field.locator('[data-spine-part="unknown"]')).toHaveText("위치 확인 전");
    const fix = viewActions(view).find((item) => item.kind === "fixNumber");
    const fixButton = field.locator("[data-recovery]").getByRole("button", { name: fix?.label ?? "" });
    await expect(fixButton).toHaveAttribute("data-variant", fix?.weight ?? "");
    await expect(field.locator("[data-auxiliary-line]")).toHaveCount(view.auxiliaryLine === null ? 0 : 1);
    const cta = card.locator('[data-cta-state="error"]');
    await expect(cta.getByRole("heading", { level: 3 })).toHaveText(view.nextAction.heading ?? "");
    await expect(cta.locator(`a[href="${TALK_URL}"]`)).toHaveCount(1);
    await expect(cta.locator("[data-worry-line]")).toHaveText(view.nextAction.worry?.text ?? "");
    await expect(card.locator("[data-affiliate-group]")).toHaveCount(0);
    await expect(card.locator("details[data-help]")).toHaveCount(view.help.length);
    await fixButton.click();
    expect(await kitActions(page)).toEqual([{ kind: "fixNumber" }]);
  });

  test("every error view: recovery steps in the card, 톡톡 first in the only error block, no ETA, no store", async ({ page }) => {
    await openKit(page);
    const causes: readonly FailureCause[] = [
      "invalidNumber", "notFound", "rateLimited", "upstreamTimeout", "badGateway", "network", "offline", "clientTimeout", "serverError",
      "contractViolation"
    ];
    for (const cause of causes) {
      const view = viewFor(failure(cause));
      await showView(page, view, { failureCause: cause });
      const card = page.locator(`[data-result-view] [data-failure-cause="${cause}"]`);
      await expect(card, cause).toHaveAttribute("data-guide-key", view.guideKey);
      const cta = page.locator('[data-cta-state="error"]');
      await expect(cta, cause).toHaveCount(1);
      const hrefs = await cta.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
      expect(hrefs, cause).toEqual(inquiryHrefs(view));
      expect(hrefs[0], cause).toBe(TALK_URL);
      const recoveryCount = viewActions(view).filter((item) => RECOVERY_KINDS.includes(item.kind)).length;
      await expect(card.locator("[data-recovery] button"), cause).toHaveCount(recoveryCount);
      await expect(card.locator('[data-slot="eta"]'), cause).toHaveCount(0);
      await expect(card.locator("[data-affiliate-group]"), cause).toHaveCount(0);
    }
  });

  test("429: 다시 조회 waits out the countdown; clicks before it report nothing", async ({ page }) => {
    await page.clock.install({ time: FIXTURE_NOW });
    const view = viewFor(failure("rateLimited"));
    await openKit(page);
    await showView(page, view, { failureCause: "rateLimited" });
    await expect(page.locator("[data-result-view] [data-guide-key]")).toContainText(view.reason ?? "");
    const retry = page.locator("[data-recovery]").getByRole("button", { name: "다시 조회" });
    await expect(retry).toHaveAttribute("aria-disabled", "true");
    // Playwright treats aria-disabled as disabled; force the clicks a customer can still make.
    await retry.click({ force: true });
    await retry.dblclick({ force: true });
    expect(await kitActions(page)).toEqual([]);
    await page.clock.runFor(10_000);
    await expect(retry).not.toHaveAttribute("aria-disabled");
    await retry.click();
    expect(await kitActions(page)).toEqual([{ kind: "retry" }]);
  });

  test("server error: 문의 내용 복사하고 톡톡 열기 leads the error block with the copied text shown; 다시 조회 stays in the card", async ({ page }) => {
    const view = viewFor(failure("serverError"));
    await openKit(page);
    await showView(page, view, { failureCause: "serverError" });
    const card = page.locator("[data-result-view] [data-guide-key]");
    await expect(card).toHaveAttribute("data-tone", "problem");
    const cta = card.locator('[data-cta-state="error"]');
    const first = cta.locator("a[href]").first();
    await expect(first).toHaveAccessibleName(COPY_AND_TALK_NAME);
    await expect(first).toHaveAttribute("data-variant", "primary");
    await expect(cta.locator("[data-inquiry-preview]")).toHaveText(view.inquiryCopy ?? "");
    await expect(card.locator("[data-recovery]").getByRole("button", { name: "다시 조회" })).toBeVisible();
  });

  test("two failures in a row: 톡톡 becomes the filled primary and the recovery step stays in the card", async ({ page }) => {
    const view = viewFor(failure("network", { consecutiveFailures: 2 }));
    expect(view.nextAction.primary?.kind).toBe("copyAndTalk");
    await openKit(page);
    await showView(page, view, { failureCause: "network" });
    const card = page.locator("[data-result-view] [data-guide-key]");
    await expect(card.locator('[data-cta-state="error"] a[href]').first()).toHaveAccessibleName(COPY_AND_TALK_NAME);
    await expect(card.locator("[data-recovery]").getByRole("button", { name: "다시 조회" })).toHaveAttribute("data-variant", "secondary");
  });

  test("no response: the recovery steps in the card and no '번호 문제는 아니에요'", async ({ page }) => {
    const view = viewFor(failure("clientTimeout"));
    await openKit(page);
    await showView(page, view, { failureCause: "clientTimeout" });
    const card = page.locator("[data-result-view] [data-guide-key]");
    await expect(card).toHaveAttribute("data-guide-key", "noResponse");
    await expect(card).not.toContainText("번호 문제는 아니에요");
    const recoveryLabels = viewActions(view)
      .filter((item) => RECOVERY_KINDS.includes(item.kind))
      .map((item) => item.label);
    expect(recoveryLabels).toContain("다시 조회");
    await expect(card.locator("[data-recovery] button")).toHaveText(recoveryLabels);
  });

  test("a delay with a chosen carrier: 톡톡 first, then that carrier's official lookup", async ({ page }) => {
    const view = viewFor(failure("upstreamTimeout", { carrier: "CJ" }));
    await openKit(page);
    await showView(page, view, { failureCause: "upstreamTimeout" });
    const hrefs = await page
      .locator('[data-cta-state="error"] a[href]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    expect(hrefs).toEqual(inquiryHrefs(view));
    expect(hrefs[0]).toBe(TALK_URL);
  });

  test("the invalid view (CS preview) shows the input sentence as its title and 톡톡 as the only link", async ({ page }) => {
    const view = viewFor(failure("invalidNumber"));
    await openKit(page);
    await showView(page, view, { failureCause: "invalidNumber" });
    await expect(page.locator("[data-result-view] h2")).toHaveText(view.title);
    const hrefs = await page.locator('[data-cta-state="error"] a[href]').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(hrefs).toEqual([TALK_URL]);
  });
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-kit.spec.ts -g "failure card"`
Expected: `8 failed` — error views still render as a settled status card: `data-result-view` is `error` but there is no `[data-failure-cause]`, no `[data-recovery]` and no `[data-cta-state="error"]` block.

- [ ] **Step 7: Write the new `FailureCard`**

Replace the whole content of `components/result/FailureCard.tsx` with:

```tsx
"use client";

import { JourneySpine } from "@/components/primitives/JourneySpine";
import { NoticeBanner } from "@/components/primitives/NoticeBanner";
import { StatusChip } from "@/components/primitives/StatusChip";
import type { ActionKind, ActionView, FailureCause, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
import { ActionControl } from "./ActionControl";
import { HelpItems } from "./HelpItems";

/** What the customer can do alone (spec §5, approval 3): these stay in the status card; the rest are inquiry steps. */
const RECOVERY_KINDS: ReadonlySet<ActionKind> = new Set<ActionKind>(["fixNumber", "retry"]);

export interface FailureCardProps {
  readonly view: TrackingViewModel;
  readonly titleId: string;
  readonly ctaHeadingId: string;
  readonly onAction: (action: ResultAction) => void;
  readonly headingRef?: React.Ref<HTMLHeadingElement>;
  readonly failureCause?: FailureCause;
}

/**
 * Error rows of spec §7: NOT_FOUND, 일시 지연 (429 countdown, 503/504, non-JSON), 오프라인, 응답 없음, SERVER_ERROR and
 * 계약 위반 — and the INVALID view for the CS preview. The status card carries the cause's recovery steps ([번호 수정],
 * [다시 조회]); the error block's first link is 톡톡 or [문의 내용 복사하고 톡톡 열기], and it holds no store link (spec §8).
 * Weights come from the view, so the approval-3 fallback is a config change only.
 */
export function FailureCard({ view, titleId, ctaHeadingId, onAction, headingRef, failureCause }: FailureCardProps): React.JSX.Element {
  const next = view.nextAction;
  const actions = [next.primary, ...next.secondary].filter((item): item is ActionView => item !== null);
  const recovery = actions.filter((item) => RECOVERY_KINDS.has(item.kind));
  const inquiry = actions.filter((item) => !RECOVERY_KINDS.has(item.kind));
  const line = view.auxiliaryLine;
  const render = (item: ActionView): React.JSX.Element => (
    <ActionControl
      key={`${item.kind}:${item.label}`}
      action={item}
      onAction={onAction}
      inquiryCopy={view.inquiryCopy}
      returnLink={view.returnLink}
      undeliveredHelpId={null}
    />
  );
  return (
    <section
      data-guide-key={view.guideKey}
      data-failure-cause={failureCause}
      data-overdue="false"
      data-tone={view.tone}
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-4"
    >
      <div data-slot="status-head" data-tone={view.tone}>
        <div className="flex flex-col items-start gap-2">
          {view.chip === null ? null : <StatusChip tone={view.tone} text={view.chip} />}
          <div className="flex flex-col gap-1">
            <h2
              id={titleId}
              ref={headingRef}
              tabIndex={-1}
              className="tt-focus m-0 font-tt-display text-tt-lg [font-weight:var(--tt-weight-display)] [word-break:keep-all]"
            >
              {view.title}
            </h2>
            {view.reason === null ? null : <p className="m-0 text-tt-sm font-medium [word-break:keep-all]">{view.reason}</p>}
          </div>
        </div>
        {view.guideKey === "notFound" ? <JourneySpine spine={view.spine} /> : null}
        {view.notice === null ? null : <NoticeBanner notice={view.notice} variant="inline" />}
        {recovery.length === 0 ? null : (
          <div data-recovery="true" className="flex flex-wrap items-center gap-2">
            {recovery.map(render)}
          </div>
        )}
        {line === null ? null : (
          <p data-auxiliary-line="true" className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-tt-sm font-medium [word-break:keep-all]">
            <span>{line.text}</span>
            {line.action === null ? null : render(line.action)}
          </p>
        )}
      </div>
      <section
        data-cta-state="error"
        aria-labelledby={next.heading === null ? undefined : ctaHeadingId}
        className="flex min-w-0 flex-col gap-3 bg-tt-surface px-[var(--tt-gutter)] py-4 text-tt-ink"
      >
        {next.heading === null ? null : (
          <h3 id={ctaHeadingId} className="m-0 font-tt-display text-tt-md [font-weight:var(--tt-weight-display)] [word-break:keep-all]">
            {next.heading}
          </h3>
        )}
        <p className="m-0 text-tt-md font-bold [word-break:keep-all]">{next.sentence}</p>
        {inquiry.length === 0 ? null : <div className="flex flex-col items-start gap-2">{inquiry.map(render)}</div>}
        {next.worry === null ? null : (
          <p data-worry-line="true" className="m-0 text-tt-sm [word-break:keep-all]">
            {next.worry.text}
          </p>
        )}
      </section>
      <HelpItems items={view.help} />
      <div data-primary-end="true" aria-hidden="true" />
    </section>
  );
}
```

- [ ] **Step 8: Render errors with `FailureCard` in `ResultView`**

Replace the whole content of `components/result/ResultView.tsx` with (the settled flow moves into a module-level `SettledFlow`; nothing else changes for settled views):

```tsx
"use client";

import { useId } from "react";
import { channels } from "@/config/site.config";
import type { FailureCause, HelpItemView, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
import { ActionControl } from "./ActionControl";
import { CarrierChooser } from "./CarrierChooser";
import { DeliveredHelp, UNDELIVERED_HELP_ITEM_ID } from "./DeliveredHelp";
import { FailureCard } from "./FailureCard";
import { HistoryDetails } from "./HistoryDetails";
import { LastEventLine } from "./LastEventLine";
import { NextActionBlock } from "./NextActionBlock";
import { SideColumn } from "./SideColumn";
import { StatusCard } from "./StatusCard";

export interface ResultViewProps {
  readonly view: TrackingViewModel;
  readonly onAction: (action: ResultAction) => void;
  readonly headingRef?: React.Ref<HTMLHeadingElement>;
  /** Placed per view.revenue.recommendations and guideKey; never between the fixed-order blocks. */
  readonly recommendationSlot?: React.ReactNode;
  /** CS preview: actions inert, no focus moves. */
  readonly readOnly?: boolean;
  /** "mobile" forces the 375 px single column (CS preview). */
  readonly frame?: "responsive" | "mobile";
  /** S07 addition: the cause behind an error view, for data-failure-cause on the failure card. */
  readonly failureCause?: FailureCause;
}

/**
 * One column below 1024 px; from 1024 px the 560 px result with the 320 px side column (spec §3 데스크톱). At least as tall
 * as the viewport under the header and number bar (48 + 56 px = 6.5rem), so nothing below moves into view when the
 * result replaces the loading card (CLS ≤ 0.05).
 */
const RESPONSIVE_LAYOUT =
  "mx-auto flex min-h-[calc(100svh_-_6.5rem)] w-full flex-col gap-4 lg:grid lg:w-[calc(var(--tt-column)_+_var(--tt-side)_+_2rem)] lg:max-w-full lg:grid-cols-[minmax(0,var(--tt-column))_var(--tt-side)] lg:items-start lg:gap-8";
/** The CS preview's phone frame: one 375 px column at any window width. */
const MOBILE_FRAME_LAYOUT = "mx-auto flex w-full max-w-[375px] flex-col gap-4";

type ExternalTarget = Extract<ResultAction, { kind: "openedExternal" }>["target"];

const ignoreAction = (): void => undefined;

/** Which outside place a result link opens (reported for analytics, S11). */
function externalTarget(anchor: HTMLAnchorElement): ExternalTarget | null {
  const href = anchor.getAttribute("href") ?? "";
  if (href.startsWith("tel:")) return "driver";
  if (anchor.target !== "_blank") return null;
  if (href === channels.talk.url) return "talk";
  if (anchor.closest("[data-affiliate-group], [data-recommended-products]") !== null) return "store";
  return "carrier";
}

function reportExternal(event: React.MouseEvent<HTMLElement>, onAction: (action: ResultAction) => void): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return;
  const kind = externalTarget(anchor);
  if (kind !== null) onAction({ kind: "openedExternal", target: kind });
}

/** Read-only (CS preview): swallow activation of links, buttons, radios and chip labels before any handler runs. */
function blockActivation(event: React.MouseEvent<HTMLElement>): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest("a[href], button, input, label") === null) return;
  event.preventDefault();
  event.stopPropagation();
}

function AuxiliaryLine({
  view,
  onAction
}: {
  readonly view: TrackingViewModel;
  readonly onAction: (action: ResultAction) => void;
}): React.JSX.Element | null {
  const line = view.auxiliaryLine;
  if (line === null) return null;
  return (
    <p data-auxiliary-line="true" className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-tt-sm font-medium [word-break:keep-all]">
      <span>{line.text}</span>
      {line.action === null ? null : (
        <ActionControl action={line.action} onAction={onAction} inquiryCopy={view.inquiryCopy} returnLink={view.returnLink} undeliveredHelpId={null} />
      )}
    </p>
  );
}

interface SettledFlowProps {
  readonly view: TrackingViewModel;
  readonly baseId: string;
  readonly onAction: (action: ResultAction) => void;
  readonly headingRef?: React.Ref<HTMLHeadingElement>;
  readonly recommendationSlot?: React.ReactNode;
}

/**
 * 상태 카드 → 도착 예상 → 지금 할 일 → 마지막 처리 (data-primary-end) → 처리 내역 (spec §6). Recommendations come right
 * after the marker for delivered (spec §7 "CTA 바로 아래") and after 처리 내역 otherwise — never between the fixed blocks.
 */
function SettledFlow({ view, baseId, onAction, headingRef, recommendationSlot }: SettledFlowProps): React.JSX.Element {
  const undelivered: HelpItemView | null = view.help.find((item) => item.id === UNDELIVERED_HELP_ITEM_ID) ?? null;
  const undeliveredId = `${baseId}-undelivered`;
  const choices = view.nextAction.carrierChoices;
  const hasRecommendations = view.revenue.recommendations !== "none" && recommendationSlot !== undefined && recommendationSlot !== null;
  const recommendations = hasRecommendations ? <div data-recommendation-slot="true">{recommendationSlot}</div> : null;
  const recommendationsLead = view.guideKey === "delivered";
  return (
    <>
      <StatusCard view={view} titleId={`${baseId}-title`} headingRef={headingRef}>
        <AuxiliaryLine view={view} onAction={onAction} />
      </StatusCard>
      <NextActionBlock
        view={view}
        headingId={`${baseId}-next`}
        onAction={onAction}
        undeliveredHelpId={undelivered === null ? null : undeliveredId}
        carrierChooser={
          choices === null ? undefined : (
            <CarrierChooser choices={choices} onChoose={(carrier) => onAction({ kind: "chooseCarrier", carrier })} />
          )
        }
      />
      <LastEventLine lastEvent={view.lastEvent} />
      <div data-primary-end="true" aria-hidden="true" />
      {recommendationsLead ? recommendations : null}
      <HistoryDetails history={view.history} id={`${baseId}-history`} />
      {undelivered === null ? null : <DeliveredHelp item={undelivered} id={undeliveredId} />}
      {recommendationsLead ? null : recommendations}
    </>
  );
}

/**
 * The result area (spec §6–§7), loaded lazily through result-module.ts. It renders only the view model: the settled
 * flow with its side column, or the failure card for error views. The number bar above it belongs to the caller.
 */
export function ResultView({
  view,
  onAction,
  headingRef,
  recommendationSlot,
  readOnly = false,
  frame = "responsive",
  failureCause
}: ResultViewProps): React.JSX.Element {
  const baseId = useId();
  const act = readOnly ? ignoreAction : onAction;
  const otherHelp = view.help.filter((item) => item.id !== UNDELIVERED_HELP_ITEM_ID);
  return (
    <div
      data-result-view={view.mode}
      data-ad-exclude="true"
      data-frame={frame}
      data-read-only={readOnly ? "true" : undefined}
      onClickCapture={readOnly ? blockActivation : undefined}
      onClick={readOnly ? undefined : (event) => reportExternal(event, onAction)}
      className={frame === "mobile" ? MOBILE_FRAME_LAYOUT : RESPONSIVE_LAYOUT}
    >
      <div data-result-main="true" className="flex min-w-0 flex-col gap-4">
        {view.mode === "error" ? (
          <FailureCard
            view={view}
            titleId={`${baseId}-title`}
            ctaHeadingId={`${baseId}-next`}
            onAction={act}
            headingRef={headingRef}
            failureCause={failureCause}
          />
        ) : (
          <SettledFlow view={view} baseId={baseId} onAction={act} headingRef={headingRef} recommendationSlot={recommendationSlot} />
        )}
      </div>
      {view.mode === "error" ? null : <SideColumn view={view} frame={frame} historyId={`${baseId}-history`} help={otherHelp} />}
    </div>
  );
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-kit.spec.ts`
Expected: `37 passed`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/failure-causes.spec.ts tests/e2e/status-slot.spec.ts`
Expected: the same pass count as the Task 0 baseline (the live page still uses the transitional `components/status-slot/FailureNotice.tsx`).
Run: `npm run typecheck; npm run lint`
Expected: both exit 0, no new warnings.

- [ ] **Step 10: Commit**

```powershell
git add components/result/FailureCard.tsx components/result/ResultView.tsx components/status-slot/FailureNotice.tsx tests/e2e/result-kit.spec.ts
git add <each importer from Step 1>
git commit -m "feat: show every error row as a failure card with recovery first and 톡톡 first in the error block"
```

---

### Task 7: `LoadingCard` (moved from S04's `LoadingTimeline`)

**Files:**
- Move: `components/status-slot/LoadingTimeline.tsx` → `components/result/LoadingCard.tsx` (pure `git mv` commit first)
- Restore (transitional, deleted by Task 10): `components/status-slot/LoadingTimeline.tsx` and its importers exactly as before the move
- Rewrite: `components/result/LoadingCard.tsx` (whole file)
- Modify: `app/(internal)/internal/result-kit/ResultKitHarness.tsx` (whole file: loading scenes)
- Test: `tests/e2e/result-kit.spec.ts` (import block, one helper, one describe block)

**Interfaces:**
- Consumes: `LoadingViewModel` (S03); `deriveLoadingView(input, { lookup, notices })` (S03, tests only); `Button`, `ButtonLink`, `NoticeBanner` (S05).
- Produces: `LoadingCard(props: { loading: LoadingViewModel; onCancel: () => void }): React.JSX.Element` (contract §11.9) — root `section[data-loading-stage][data-guide-key="loading"][aria-busy="true"][data-ad-exclude="true"]`, renders every stage including `"instant"`, skeletons `[data-loading-skeleton="journey|eta|next-action"]` (aria-hidden), `[data-loading-extra]`, `[data-loading-elapsed]`, cancel button, the carrier's official link, `[data-spinner]` animated at most 5 turns (never under reduced motion); harness scene `{ kind: "loading"; loading: LoadingViewModel }`.

- [ ] **Step 1: Find the importers of `LoadingTimeline`**

Run: `Get-ChildItem -Recurse -Include *.ts,*.tsx app, components | Select-String -Pattern 'status-slot/LoadingTimeline|from "\./LoadingTimeline"' | ForEach-Object { "$($_.Path.Replace((Get-Location).Path + '\', '')):$($_.LineNumber): $($_.Line.Trim())" }`
Expected: at least `components\status-slot\StatusSlot.tsx`; S06 files (`LegacyResultSection.tsx`, `LookupController.tsx`) may appear if S06 renders the SSR loading card directly. Write the list down.

- [ ] **Step 2: Move the file without changing its content**

Run: `git mv components/status-slot/LoadingTimeline.tsx components/result/LoadingCard.tsx`
With the Edit tool: in `components/result/LoadingCard.tsx` replace every `from "./` with `from "@/components/status-slot/` (skip if none); in each importer from Step 1 replace `"./LoadingTimeline"` or `"@/components/status-slot/LoadingTimeline"` with `"@/components/result/LoadingCard"`.
Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit the pure move**

Run: `git add -A components/status-slot components/result/LoadingCard.tsx; git add <each importer from Step 1>; git commit -m "refactor: move LoadingTimeline to components/result/LoadingCard.tsx"`
Run: `git show --stat --find-renames HEAD`
Expected: `components/{status-slot/LoadingTimeline.tsx => result/LoadingCard.tsx}` listed as a rename.

- [ ] **Step 4: Put the transitional copy back**

Run: `git checkout HEAD~1 -- components/status-slot/LoadingTimeline.tsx <each importer from Step 1>`
Run: `npm run typecheck; git status --short`
Expected: typecheck exit 0; `A  components/status-slot/LoadingTimeline.tsx` and the importers modified back to their old import line.

- [ ] **Step 5: Write the failing tests**

In `tests/e2e/result-kit.spec.ts`:
(a) replace `import { disclosures, siteConfig } from "@/config/site.config";` with

```ts
import { disclosures, lookup, notices, siteConfig } from "@/config/site.config";
```

(b) replace `import { deriveTrackingView } from "@/lib/tracking/derive-view";` with

```ts
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import { deriveLoadingView } from "@/lib/tracking/loading-view";
```

(c) replace `import type { ActionView, FailureCause, LookupOutcome, ResultAction, TrackingViewModel } from "@/lib/tracking/types";` with

```ts
import type { ActionView, FailureCause, LoadingViewModel, LookupOutcome, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
import type { DeliveryCarrierCode } from "@/lib/types";
```

(d) directly below the `inquiryHrefs` function, add:

```ts
function loadingAt(elapsedMs: number, carrier: DeliveryCarrierCode = "AUTO", reducedMotion = false): LoadingViewModel {
  return deriveLoadingView(
    { request: { number: FAKE.hbl, carrier, entry: "deepLink" }, elapsedMs, reducedMotion, now: FIXTURE_NOW },
    { lookup, notices }
  );
}

async function showLoading(page: Page, loading: LoadingViewModel): Promise<void> {
  await page.evaluate((nextLoading) => {
    const kit = window.__ttResultKit;
    if (kit === undefined) throw new Error("result kit is not ready");
    kit.show({ kind: "loading", loading: nextLoading });
  }, loading);
  await expect(page.locator(`[data-loading-stage="${loading.stage}"]`)).toBeVisible();
}
```

(e) append to the end of the file:

```ts
test.describe("loading card", () => {
  test("short wait: '조회하고 있어요', aria-busy, static skeletons, no cancel yet", async ({ page }) => {
    const model = loadingAt(1_000);
    expect(model.stage).toBe("short");
    await openKit(page);
    await showLoading(page, model);
    const card = page.locator("[data-loading-stage]");
    await expect(card).toHaveAttribute("data-guide-key", "loading");
    await expect(card).toHaveAttribute("aria-busy", "true");
    await expect(card).toHaveAttribute("data-ad-exclude", "true");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(model.title);
    await expect(card.getByText(model.body, { exact: true })).toBeVisible();
    for (const part of ["journey", "eta", "next-action"]) {
      await expect(card.locator(`[data-loading-skeleton="${part}"]`), part).toHaveAttribute("aria-hidden", "true");
    }
    await expect(card.getByRole("button")).toHaveCount(0);
  });

  test("3 s: the long-wait sentence and [조회 취소], which reports cancel", async ({ page }) => {
    const model = loadingAt(3_500);
    expect(model.stage).toBe("long");
    await openKit(page);
    await showLoading(page, model);
    const card = page.locator("[data-loading-stage]");
    await expect(card.locator("[data-loading-extra]")).toHaveText(model.extra ?? "");
    await card.getByRole("button", { name: model.cancel?.label ?? "" }).click();
    expect(await kitActions(page)).toEqual([{ kind: "cancel" }]);
  });

  test("8 s with a chosen carrier: the elapsed time and the carrier's official link; the spinner has stopped", async ({ page }) => {
    const model = loadingAt(9_000, "CJ");
    expect(model.stage).toBe("veryLong");
    await openKit(page);
    await showLoading(page, model);
    const card = page.locator("[data-loading-stage]");
    await expect(card.locator("[data-loading-extra]")).toHaveText(model.extra ?? "");
    await expect(card.locator("[data-loading-elapsed]")).toHaveText(model.elapsedText ?? "");
    const official = card.getByRole("link", { name: `${model.carrierOfficial?.label ?? ""} 새 창으로 열기` });
    await expect(official).toHaveAttribute("href", model.carrierOfficial?.href ?? "");
    await expect(card.locator("[data-spinner]")).toHaveCount(0);
  });

  test("the spinner turns a finite number of times, and not at all with reduced motion", async ({ page }) => {
    await openKit(page);
    await showLoading(page, loadingAt(1_000));
    const timing = await page.locator("[data-spinner]").evaluate((element) =>
      element.getAnimations().map((animation) => {
        const effect = animation.effect?.getTiming();
        return { iterations: effect?.iterations ?? 0, duration: Number(effect?.duration ?? 0) };
      })
    );
    expect(timing).toEqual([{ iterations: 5, duration: 1_000 }]);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await showLoading(page, loadingAt(1_000, "AUTO", true));
    await expect(page.locator("[data-spinner]")).toHaveCount(0);
    await showLoading(page, { ...loadingAt(1_000), spinnerActive: true });
    expect(await page.locator("[data-spinner]").evaluate((element) => element.getAnimations().length)).toBe(0);
  });

  test("an outage notice shows as the in-card '안내' line", async ({ page }) => {
    const model: LoadingViewModel = {
      ...loadingAt(1_000),
      outageNotice: { id: "kit-outage", kind: "outage", title: "통관 조회 점검", body: "UNI-PASS 점검(22:00~24:00) 중에는 통관 정보가 늦게 보일 수 있어요" }
    };
    await openKit(page);
    await showLoading(page, model);
    await expect(page.locator('[data-loading-stage] [data-notice-kind="outage"]')).toContainText(model.outageNotice?.body ?? "");
  });
});
```

- [ ] **Step 6: Let the harness show loading scenes**

Replace the whole content of `app/(internal)/internal/result-kit/ResultKitHarness.tsx` with:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { LoadingCard } from "@/components/result/LoadingCard";
import { ResultView } from "@/components/result/ResultView";
import type { FailureCause, LoadingViewModel, ResultAction, TrackingViewModel } from "@/lib/tracking/types";

export type ResultKitScene =
  | {
      readonly kind: "result";
      readonly view: TrackingViewModel;
      readonly frame?: "responsive" | "mobile";
      readonly readOnly?: boolean;
      readonly failureCause?: FailureCause;
      readonly withRecommendation?: boolean;
    }
  | { readonly kind: "loading"; readonly loading: LoadingViewModel };

export interface ResultKitApi {
  readonly show: (scene: ResultKitScene) => void;
  readonly actions: () => readonly ResultAction[];
}

declare global {
  interface Window {
    __ttResultKit?: ResultKitApi;
  }
}

interface ShownScene {
  readonly scene: ResultKitScene;
  readonly serial: number;
}

/** Stand-in for the recommendation list (S08) so tests can check where the slot goes. */
function KitRecommendation({ context }: { readonly context: string }): React.JSX.Element {
  return (
    <section data-recommended-products={context} className="bg-tt-surface px-[var(--tt-gutter)] py-4 text-tt-sm text-tt-ink">
      추천 자리 (점검용)
    </section>
  );
}

function KitScene({
  scene,
  record,
  headingRef
}: {
  readonly scene: ResultKitScene;
  readonly record: (action: ResultAction) => void;
  readonly headingRef: React.RefObject<HTMLHeadingElement | null>;
}): React.JSX.Element {
  if (scene.kind === "loading") return <LoadingCard loading={scene.loading} onCancel={() => record({ kind: "cancel" })} />;
  const context = scene.view.revenue.recommendationContext;
  return (
    <ResultView
      view={scene.view}
      onAction={record}
      headingRef={headingRef}
      readOnly={scene.readOnly}
      frame={scene.frame}
      failureCause={scene.failureCause}
      recommendationSlot={scene.withRecommendation === true && context !== null ? <KitRecommendation context={context} /> : undefined}
    />
  );
}

/**
 * Tests call window.__ttResultKit.show(scene) with a view (or loading) model derived in Node and read the reported
 * ResultActions with actions(). Each show() remounts the scene (fresh component state) and clears the action log.
 */
export function ResultKitHarness(): React.JSX.Element {
  const [shown, setShown] = useState<ShownScene | null>(null);
  const actionsRef = useRef<readonly ResultAction[]>([]);
  const rootRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    window.__ttResultKit = {
      show: (scene) => {
        actionsRef.current = [];
        setShown((previous) => ({ scene, serial: (previous?.serial ?? 0) + 1 }));
      },
      actions: () => actionsRef.current
    };
    rootRef.current?.setAttribute("data-result-kit", "ready");
    return () => {
      delete window.__ttResultKit;
    };
  }, []);

  const record = (action: ResultAction): void => {
    actionsRef.current = [...actionsRef.current, action];
  };

  return (
    <main ref={rootRef} className="min-h-screen bg-tt-ground py-4 text-tt-ink">
      <h1 className="sr-only">결과 화면 점검</h1>
      {shown === null ? null : <KitScene key={shown.serial} scene={shown.scene} record={record} headingRef={headingRef} />}
    </main>
  );
}
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-kit.spec.ts -g "loading card"`
Expected: `5 failed` — `components/result/LoadingCard.tsx` still holds S04's component (moved in Step 2), which neither exports `LoadingCard` with the contract props nor renders `[data-loading-skeleton]`; typically the dev server reports `Export LoadingCard doesn't exist in target module` and every test times out waiting for `[data-loading-stage="…"]`.

- [ ] **Step 8: Write the new `LoadingCard`**

Replace the whole content of `components/result/LoadingCard.tsx` with:

```tsx
"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/primitives/Button";
import { ButtonLink } from "@/components/primitives/ButtonLink";
import { NoticeBanner } from "@/components/primitives/NoticeBanner";
import type { LoadingViewModel } from "@/lib/tracking/types";

const SPIN_MS = 1000;
/** spinnerStopMs (5 s) ÷ SPIN_MS: at most five turns; after 5 s the model drops the spinner (spec §5, WCAG 2.2.2). */
const SPIN_TURNS = 5;
const SKELETON_STATIONS = [0, 1, 2, 3] as const;

/** Rotates the element a fixed number of turns. Never loops and never runs under reduced motion. */
function useFiniteSpin(active: boolean): React.RefObject<HTMLSpanElement | null> {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!active || element === null || typeof element.animate !== "function") return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const animation = element.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], {
      duration: SPIN_MS,
      iterations: SPIN_TURNS,
      easing: "linear"
    });
    return () => animation.cancel();
  }, [active]);
  return ref;
}

export interface LoadingCardProps {
  readonly loading: LoadingViewModel;
  readonly onCancel: () => void;
}

/**
 * The status card while a lookup runs (spec §5, §7 loading): '조회하고 있어요' and the body, the 3 s / 8 s sentences,
 * '12초째', [조회 취소] from 3 s, the chosen carrier's official lookup from 8 s, and static skeletons as tall as the
 * result and at least as tall as the viewport under the header and number bar, so the result fills the same place
 * without a scroll jump or a layout shift below it. Renders every stage; the caller decides whether
 * the "instant" stage is shown. Never a live region: announcements go through the one LiveAnnouncer.
 */
export function LoadingCard({ loading, onCancel }: LoadingCardProps): React.JSX.Element {
  const titleId = useId();
  const spinnerRef = useFiniteSpin(loading.spinnerActive);
  const cancel = loading.cancel;
  const official = loading.carrierOfficial;
  return (
    <section
      data-loading-stage={loading.stage}
      data-guide-key="loading"
      data-ad-exclude="true"
      aria-busy="true"
      aria-labelledby={titleId}
      className="flex min-h-[calc(100svh_-_6.5rem)] min-w-0 flex-col gap-4"
    >
      <div data-slot="status-head" data-tone="neutral">
        <div className="flex items-start gap-3">
          {loading.spinnerActive ? (
            <span
              ref={spinnerRef}
              data-spinner="true"
              aria-hidden="true"
              className="mt-1 inline-block h-5 w-5 shrink-0 rounded-full border-[3px] border-solid border-current border-r-transparent"
            />
          ) : null}
          <div className="flex min-w-0 flex-col gap-1">
            <h2
              id={titleId}
              tabIndex={-1}
              className="tt-focus m-0 font-tt-display text-tt-lg [font-weight:var(--tt-weight-display)] [word-break:keep-all]"
            >
              {loading.title}
            </h2>
            <p className="m-0 text-tt-sm font-medium [word-break:keep-all]">{loading.body}</p>
          </div>
        </div>
        {loading.outageNotice === null ? null : <NoticeBanner notice={loading.outageNotice} variant="inline" />}
        {loading.extra === null ? null : (
          <p data-loading-extra="true" className="m-0 text-tt-sm font-bold [word-break:keep-all]">
            {loading.extra}
          </p>
        )}
        {loading.elapsedText === null ? null : (
          <p data-loading-elapsed="true" className="m-0 text-tt-sm [font-variant-numeric:tabular-nums]">
            {loading.elapsedText}
          </p>
        )}
        <div data-loading-skeleton="journey" aria-hidden="true" className="grid h-11 grid-cols-4 items-end gap-1">
          {SKELETON_STATIONS.map((station) => (
            <span key={station} className="h-2 border-2 border-solid border-current opacity-40" />
          ))}
        </div>
        <div data-loading-skeleton="eta" aria-hidden="true" className="h-16" />
        {cancel === null && official === null ? null : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {cancel === null ? null : (
              <Button variant={cancel.weight} onClick={onCancel}>
                {cancel.label}
              </Button>
            )}
            {official === null || official.href === null ? null : (
              <ButtonLink href={official.href} variant={official.weight} external label={official.label} />
            )}
          </div>
        )}
      </div>
      <div data-loading-skeleton="next-action" aria-hidden="true" className="min-h-[176px] bg-tt-surface" />
    </section>
  );
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-kit.spec.ts`
Expected: `42 passed`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/result-module.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `5 passed` (the boundary test now also scans `LoadingCard.tsx`).
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/loading-timeline.spec.ts tests/e2e/deep-link.spec.ts`
Expected: the Task 0 baseline pass count (the live page still uses the transitional `LoadingTimeline`).
Run: `npm run typecheck; npm run lint`
Expected: both exit 0, no new warnings.

- [ ] **Step 10: Commit**

```powershell
git add components/result/LoadingCard.tsx components/status-slot/LoadingTimeline.tsx "app/(internal)/internal/result-kit/ResultKitHarness.tsx" tests/e2e/result-kit.spec.ts
git add <each importer from Step 1>
git commit -m "feat: add the initial-bundle LoadingCard with static skeletons and a finite spinner"
```

---

### Task 8 (gated by approval 2): Switch the page to the new result area and migrate the result tests

**Files:**
- Create: `components/result/ResultSlot.tsx`
- Modify: `components/lookup/LookupController.tsx` (imports, one module-level constant, the result handler, the `<LegacyResultSection …/>` element, S06's settle-time view code — lines recorded in Task 0 Step 9)
- Modify: `components/lookup/lookup-display.ts`, `tests/unit/lookup-display.spec.ts` (Task 9 Steps 1 and 4, applied in Step 8 (h))
- Modify (only when Step 11 finds an S04 ledger fallback still active): the Task 10 Part A files (`components/result/approvals.ts` created, `components/result/result-module.ts`, `components/result/FailureCard.tsx`, `tests/unit/result-approvals.spec.ts` created)
- Modify: `tests/e2e/RULE-MAP.md` (append the S07 section)
- Create: `tests/unit/normalizer.spec.ts`
- Create: `tests/e2e/result-states.spec.ts`
- Create: `tests/e2e/result-layout.spec.ts` (focus, live sentence, title, fill)
- Delete: `tests/tracking.spec.ts`
- Modify: `tests/privacy.spec.ts` (remove the stale test)
- Modify: `tests/e2e/status-slot.spec.ts`, `tests/e2e/loading-timeline.spec.ts`, `tests/e2e/failure-causes.spec.ts`, `tests/e2e/cta-consistency.spec.ts` and S04's helper `tests/support/status-slot.ts` (selectors only, per the Step 12 table)

**Interfaces:**
- Consumes: `useLookup(options): UseLookupResult` (`state`, `loading`, `submit`, `retry`, `cancel`, `reset`; S04), `useAnnounce()` (S04), `setAdSignals(patch)` (S02), `LookupState` (`lib/tracking/lookup-state.ts`, S04), `TrackingEntry`, `LookupOutcome`, `LoadingViewModel`, `ResultAction`, `TrackingViewModel` (S03), `LoadingConfig` (S03), `deriveLoadingView` (S03), `loadResultModule`, `preloadResultModule`, `ResultModule` (Task 1), `LoadingCard` (Task 7), `TalkLink` (S05), `channels` (config); test fixtures `trackData`, `mockTrack`, `successBody`, `FAKE`, `FIXTURE_NOW`, `FailureFixture` (S01) and `success`, `failure`, `customsWaitingData`, `inTransitData`, `OCTOBER_NOW` (S03).
- Produces: `ResultSlot(props: ResultSlotProps): React.JSX.Element | null` with `ResultSlotProps` (Additions item 2); `LookupController` renders it in place of `LegacyResultSection`, reports the settled view through `onView`, passes legacy recommendations through `renderRecommendations`, and handles `chooseCarrier` and `cancel`. The live page now shows `LoadingCard`, `ResultView` and `FailureCard`; `components/status-slot/*`, `LegacyResultSection` and the legacy result components are unused (Task 10 deletes them).

- [ ] **Step 1: Confirm approval 2 is recorded**

Open `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §4, row 2. Expected: `approved`. If not, stop this task (Task 0 Step 7 already stopped the stage). Spec §16 item 2 "거절하면": new state sentences would have to stay equal to the current test copy and could not come from config, and every restructure would need hand-edited tests — this plan's design does not apply and S07 has to be re-planned.

- [ ] **Step 2: Write the S07 rows of the rule → assertion map (before any test is removed)**

Append to the end of `tests/e2e/RULE-MAP.md`:

```markdown

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
| S07-12 | 결과 슬롯 규칙: 단계 문구, 원인별 오류, 포커스·낭독, CTA 일관성 (§5) | S04 status-slot / loading-timeline / failure-causes / cta-consistency specs | the same files with R3 selectors (Task 8 Step 12 table; no assertion or expected value dropped); result-layout › "focus, live sentence, title and fill" | selectors migrated |
```

If Task 0 Step 10 listed a `tests/tracking.spec.ts` title that none of the rows above (nor an S06 row) names, add a row for it now with its rule and new assertion; if no new assertion covers it, add one to `tests/e2e/result-states.spec.ts` in Step 5 first.

- [ ] **Step 3: Move the normalizer assertions into a unit test**

Create `tests/unit/normalizer.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { normalizeTrackingData } from "@/lib/services/normalizer";
import { FAKE } from "../fixtures/tracking-fixtures";

test("normalizer calculates a clear customs completion estimate while customs is waiting", () => {
  const data = normalizeTrackingData({
    trackingNumber: FAKE.domestic,
    type: "DOMESTIC",
    customsEvents: [{ status: "통관목록접수", statusCode: 2, datetime: "2026-07-13T10:17:07+09:00" }],
    deliveryLookup: { carrier: "국내택배 자동 조회", carrierCode: "AUTO", events: [] },
    now: new Date("2026-07-13T12:00:00+09:00")
  });

  expect(data.currentStatusCode).toBe(2);
  expect(data.estimatedCustomsClearanceDate).toBe("2026-07-14T01:17:07.000Z");
  expect(data.estimatedDeliveryDate).toBe("2026-07-17T01:17:07.000Z");
});

test("estimates that already passed move to today and are marked adjusted", () => {
  const data = normalizeTrackingData({
    trackingNumber: FAKE.domestic,
    type: "DOMESTIC",
    customsEvents: [{ status: "통관목록접수", statusCode: 2, datetime: "2026-07-16T10:31:53+09:00" }],
    deliveryLookup: { carrier: "국내택배 자동 조회", carrierCode: "AUTO", events: [] },
    now: new Date("2026-07-20T12:00:00+09:00")
  });

  expect(data.estimatedCustomsClearanceDate).toBe("2026-07-20T00:00:00+09:00");
  expect(data.estimatedDeliveryDate).toBe("2026-07-22T15:00:00.000Z");
  expect(data.customs.estimateAdjusted).toBe(true);
});
```

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/normalizer.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `2 passed` — these pin the frozen normalizer's existing behavior (7월 14일/17일 and the 7월 20일/23일 recalculation the old UI test showed), so they pass immediately.

- [ ] **Step 4: Write the result-state E2E (rules through hooks)**

Create `tests/e2e/result-states.spec.ts`:

```ts
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { channels, disclosures, lookup, siteConfig } from "@/config/site.config";
import { getDeliveryCarrier } from "@/lib/delivery-carriers";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import type { LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";
import { OCTOBER_NOW, customsWaitingData, failure, inTransitData, success } from "../fixtures/derive-scenarios";
import { FAKE, FIXTURE_NOW, mockTrack, successBody, trackData, type FailureFixture } from "../fixtures/tracking-fixtures";

/**
 * Every §7 row end to end (deep links and manual lookups against mocked /api/track). Business rules are asserted
 * through hooks and roles; expected copy that is not E2E-locked comes from deriveTrackingView with the shipped config.
 */
const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";
const TALK_URL = channels.talk.url;
const TALK_NAME = `${channels.talk.labels.cta} 새 창으로 열기`;
const COPY_AND_TALK_NAME = `${channels.talk.labels.copyAndTalk} 새 창으로 열기`;
const STORE_HREFS: readonly string[] = [...Object.values(channels.naver.urls), ...Object.values(channels.coupang.urls)];
const OVERDUE_NOW = new Date("2026-09-29T09:00:00+09:00");

function viewFor(outcome: LookupOutcome, now: Date = FIXTURE_NOW): TrackingViewModel {
  return deriveTrackingView(outcome, now, siteConfig);
}

async function blockOtherHosts(page: Page): Promise<void> {
  await page.context().route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
}

/** Opens `/{number}` with /api/track answering `reply`; the browser clock reads `now` (timers keep running). */
async function openDeepLink(
  page: Page,
  reply: TrackResponseData | FailureFixture,
  options: { readonly now?: Date; readonly delayMs?: number } = {}
): Promise<void> {
  await page.clock.setFixedTime(options.now ?? FIXTURE_NOW);
  await blockOtherHosts(page);
  await mockTrack(page, reply, { delayMs: options.delayMs });
  await page.goto(`/${typeof reply === "string" ? FAKE.domestic : reply.trackingNumber}`);
}

/** Answers POST /api/track with `replies` in order (the last one repeats) and records every request body. */
async function mockTrackSequence(page: Page, replies: readonly TrackResponseData[], bodies: unknown[]): Promise<void> {
  let index = 0;
  await page.route("**/api/track", async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    bodies.push(route.request().postDataJSON());
    const reply = replies[Math.min(index, replies.length - 1)];
    index += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: successBody(reply) });
  });
}

function resultCard(page: Page): Locator {
  return page.locator("[data-result-view] [data-guide-key]");
}

async function storeLinkCount(scope: Locator): Promise<number> {
  const hrefs = await scope.locator("a[href]").evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href") ?? ""));
  return hrefs.filter((href) => STORE_HREFS.includes(href)).length;
}

/** Store links anywhere on the page that come before `marker` in document order. */
async function storeLinksBefore(page: Page, marker: string): Promise<number> {
  return page.evaluate(
    ({ selector, hrefs }) => {
      const end = document.querySelector(selector);
      if (end === null) return -1;
      return Array.from(document.querySelectorAll("a[href]")).filter(
        (anchor) =>
          hrefs.includes(anchor.getAttribute("href") ?? "") && (anchor.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      ).length;
    },
    { selector: marker, hrefs: [...STORE_HREFS] }
  );
}

test.describe("loading", () => {
  test("a deep link shows '조회하고 있어요' in the server HTML and the result fills the same place", async ({ page, request }) => {
    const html = await (await request.get(`/${FAKE.hbl}`)).text();
    expect(html).toContain('data-loading-stage="instant"');
    expect(html).toContain(lookup.copy.title);
    await openDeepLink(page, trackData("customsWaiting"), { delayMs: 1_500 });
    const loadingCard = page.locator("[data-loading-stage]");
    await expect(loadingCard.getByRole("heading", { level: 2 })).toHaveText(lookup.copy.title);
    await expect(loadingCard).toHaveAttribute("aria-busy", "true");
    await expect(resultCard(page)).toHaveAttribute("data-guide-key", "customsWaiting");
    await expect(page.locator("[data-loading-stage]")).toHaveCount(0);
  });

  test("long waits add the 3 s sentence and [조회 취소]; cancelling keeps the number for editing", async ({ page }) => {
    await page.clock.install({ time: FIXTURE_NOW });
    await blockOtherHosts(page);
    await page.route("**/api/track", () => undefined); // never answers
    await page.goto(`/${FAKE.domestic}`);
    const loadingCard = page.locator("[data-loading-stage]");
    await expect(loadingCard.getByRole("heading", { level: 2 })).toHaveText(lookup.copy.title);
    await page.clock.runFor(3_100);
    await expect(loadingCard).toHaveAttribute("data-loading-stage", "long");
    await expect(loadingCard.locator("[data-loading-extra]")).toHaveText(lookup.copy.longWait);
    await loadingCard.getByRole("button", { name: lookup.copy.cancel }).click();
    await expect(page.locator("[data-loading-stage]")).toHaveCount(0);
    const value = await page.getByLabel(INPUT_LABEL, { exact: true }).inputValue();
    expect(value.replace(/[\s-]/g, "")).toBe(FAKE.domestic);
  });
});

test.describe("errors", () => {
  test("NOT_FOUND: 번호 수정 in the card, 톡톡 first in the only error block, no store link anywhere in the result", async ({ page }) => {
    const view = viewFor(failure("notFound"));
    await openDeepLink(page, "notFound404");
    const card = resultCard(page);
    await expect(card).toHaveAttribute("data-guide-key", "notFound");
    await expect(card).toHaveAttribute("data-failure-cause", "notFound");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(view.title);
    await expect(card.locator('[aria-current="step"]')).toHaveCount(0);
    const fix = [view.nextAction.primary, ...view.nextAction.secondary].find((item) => item?.kind === "fixNumber");
    await expect(card.locator("[data-recovery]").getByRole("button", { name: fix?.label ?? "" })).toBeVisible();
    const cta = page.locator('[data-cta-state="error"]');
    await expect(cta).toHaveCount(1);
    expect(await cta.locator("a[href]").first().getAttribute("href")).toBe(TALK_URL);
    await expect(card.locator("[data-auxiliary-line]")).toHaveCount(lookup.notFoundServiceCaveat ? 1 : 0);
    expect(await storeLinkCount(page.locator("[data-view-state]"))).toBe(0);
  });

  for (const fixture of [
    "notFound404", "rateLimited429", "upstreamTimeout504", "unavailable503", "serverError500", "badGatewayHtml502", "contractViolation200"
  ] as const) {
    test(`every error response keeps 톡톡 first and shows no store or ETA: ${fixture}`, async ({ page }) => {
      await openDeepLink(page, fixture);
      await expect(page.locator("[data-result-view]")).toHaveAttribute("data-result-view", "error");
      const cta = page.locator('[data-cta-state="error"]');
      await expect(cta).toHaveCount(1);
      expect(await cta.locator("a[href]").first().getAttribute("href")).toBe(TALK_URL);
      await expect(page.locator('[data-result-view] [data-slot="eta"]')).toHaveCount(0);
      expect(await storeLinkCount(page.locator("[data-view-state]"))).toBe(0);
      await expect(page.locator("[data-result-view]")).not.toContainText("관리자에게 문의해주세요");
    });
  }

  test("429: [다시 조회] waits out the countdown, then looks the number up again", async ({ page }) => {
    await page.clock.install({ time: FIXTURE_NOW });
    await blockOtherHosts(page);
    const bodies: unknown[] = [];
    await mockTrack(page, "rateLimited429", { onRequest: (body) => bodies.push(body) });
    await page.goto(`/${FAKE.domestic}`);
    const retry = page.locator("[data-recovery]").getByRole("button", { name: "다시 조회" });
    await expect(retry).toHaveAttribute("aria-disabled", "true");
    // Playwright treats aria-disabled as disabled; force the click a customer can still make.
    await retry.click({ force: true });
    expect(bodies).toHaveLength(1);
    await page.clock.runFor(lookup.rateLimitCooldownSeconds * 1_000);
    await expect(retry).not.toHaveAttribute("aria-disabled");
    await retry.click();
    await expect.poll(() => bodies.length).toBe(2);
  });

  test("server error: [문의 내용 복사하고 톡톡 열기] leads the error block and shows the copied text", async ({ page }) => {
    const view = viewFor(failure("serverError"));
    await openDeepLink(page, "serverError500");
    const cta = page.locator('[data-cta-state="error"]');
    await expect(cta.locator("a[href]").first()).toHaveAccessibleName(COPY_AND_TALK_NAME);
    await expect(cta.locator("[data-inquiry-preview]")).toHaveText(view.inquiryCopy ?? "");
  });

  test("no response after the client timeout: no '번호 문제는 아니에요', 톡톡 first", async ({ page }) => {
    await page.clock.install({ time: FIXTURE_NOW });
    await blockOtherHosts(page);
    await page.route("**/api/track", () => undefined); // never answers
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator("[data-loading-stage]")).toBeVisible();
    await page.clock.runFor(lookup.timeoutMs + 1_000);
    const card = resultCard(page);
    await expect(card).toHaveAttribute("data-guide-key", "noResponse");
    await expect(card).not.toContainText("번호 문제는 아니에요");
    expect(await page.locator('[data-cta-state="error"] a[href]').first().getAttribute("href")).toBe(TALK_URL);
  });

  test("two failures in a row make [문의 내용 복사하고 톡톡 열기] the filled primary", async ({ page }) => {
    await openDeepLink(page, "upstreamTimeout504");
    await expect(resultCard(page)).toHaveAttribute("data-guide-key", "temporaryDelay");
    await page.locator("[data-recovery]").getByRole("button", { name: "다시 조회" }).click();
    const first = page.locator('[data-cta-state="error"] a[href]').first();
    await expect(first).toHaveAccessibleName(COPY_AND_TALK_NAME);
    await expect(first).toHaveAttribute("data-variant", "primary");
  });

  test("offline: the offline card, then one automatic lookup when the connection returns", async ({ page }) => {
    await page.clock.setFixedTime(FIXTURE_NOW);
    await blockOtherHosts(page);
    await mockTrack(page, trackData("inTransit"));
    await page.goto("/");
    const input = page.getByLabel(INPUT_LABEL, { exact: true });
    await input.fill(FAKE.hbl);
    await page.waitForLoadState("networkidle"); // focus in the lookup form preloads the result module
    await page.context().setOffline(true);
    await input.press("Enter");
    await expect(resultCard(page)).toHaveAttribute("data-guide-key", "offline");
    await page.context().setOffline(false);
    await expect(resultCard(page)).toHaveAttribute("data-guide-key", "inTransit");
  });

  test("an invalid number: one error block below the form with 톡톡 first, and no store link", async ({ page }) => {
    await blockOtherHosts(page);
    await page.goto("/");
    const input = page.getByLabel(INPUT_LABEL, { exact: true });
    await input.fill(FAKE.invalidShort);
    await input.press("Enter");
    await expect(page.locator('[data-guide-key="invalidNumber"]')).toBeVisible();
    const cta = page.locator('[data-cta-state="error"]');
    await expect(cta).toHaveCount(1);
    expect(await cta.locator("a[href]").first().getAttribute("href")).toBe(TALK_URL);
    await expect(page.locator("[data-result-view]")).toHaveCount(0);
    expect(await storeLinkCount(page.locator("[data-view-state]"))).toBe(0);
  });

  test("a result module that cannot load leaves the 톡톡 fallback; opening the link again shows the result", async ({ page }) => {
    let blockResultChunk = true;
    await page.route("**/_next/static/**/*.js", async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (blockResultChunk && body.includes("data-primary-end")) {
        await route.abort();
        return;
      }
      await route.fulfill({ response, body });
    });
    await openDeepLink(page, trackData("inTransit"));
    const fallback = page.locator("[data-result-module-failure]");
    await expect(fallback.getByRole("link", { name: TALK_NAME })).toBeVisible();
    await expect(page.locator("[data-loading-stage]")).toHaveCount(0);
    blockResultChunk = false;
    await page.goto(`/${FAKE.hbl}`);
    await expect(resultCard(page)).toHaveAttribute("data-guide-key", "inTransit");
  });
});

test.describe("settled states", () => {
  test("pending: '통관 정보 등록 전', '정보 등록 후 안내', 톡톡 and the purchase choices after the disclosure", async ({ page }) => {
    await openDeepLink(page, trackData("pending"));
    const card = resultCard(page);
    await expect(card).toHaveAttribute("data-guide-key", "pending");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText("통관 정보 등록 전");
    await expect(card.locator('[data-slot="eta"]')).toHaveAttribute("data-eta-kind", "pendingInfo");
    await expect(card.locator("[data-eta-text]")).toHaveText("정보 등록 후 안내");
    const cta = page.locator('[data-cta-state="pending"]');
    await expect(cta.getByRole("heading", { level: 3 })).toHaveText("아직 국내 배송 정보가 없어요");
    await expect(cta.getByRole("link", { name: TALK_NAME })).toBeVisible();
    await expect(cta.locator("[data-affiliate-disclosure]")).toHaveText(disclosures.coupang);
    await expect(cta.getByRole("link", { name: "네이버 스토어 보기 새 창으로 열기" })).toBeVisible();
    await expect(cta.getByRole("link", { name: "쿠팡 스토어 보기 새 창으로 열기" })).toHaveAttribute("rel", /sponsored/);
    expect(await storeLinksBefore(page, "[data-result-view] [data-primary-end]")).toBe(2);
    await expect(page.locator('[data-recommended-products="pending"]')).toBeVisible();
  });

  test("customs waiting: holiday badge instead of D-n, the notice line, no filled button, a worry line with 톡톡", async ({ page }) => {
    const data = trackData("customsWaiting");
    const view = viewFor(success(data));
    await openDeepLink(page, data);
    const card = resultCard(page);
    await expect(card).toHaveAttribute("data-guide-key", "customsWaiting");
    await expect(card).toHaveAttribute("data-tone", "progress");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(view.title);
    await expect(card.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(card.locator('[data-slot="eta"]')).toHaveAttribute("data-eta-kind", view.eta.kind);
    await expect(card.locator("[data-eta-dday]")).toHaveCount(0);
    if (view.eta.kind === "holidayAffected") await expect(card.locator("[data-eta-badge]")).toHaveText(view.eta.badge);
    await expect(card.locator('[data-notice-variant="inline"]')).toHaveCount(view.notice === null ? 0 : 1);
    const cta = page.locator('[data-cta-state="customsWaiting"]');
    await expect(cta.locator('[data-slot="button"][data-variant="primary"]')).toHaveCount(0);
    await expect(cta.locator("[data-worry-line]")).toContainText(view.nextAction.worry?.text ?? "");
    await expect(cta.locator(`a[href="${TALK_URL}"]`)).toHaveCount(1);
    await expect(page.locator("[data-result-view] details[data-history] summary")).toHaveText(view.history.summaryText);
  });

  test("customs cleared: the customs station stays current with '인계 대기' and the cleared date as the caption", async ({ page }) => {
    const data = trackData("customsCleared");
    const view = viewFor(success(data));
    await openDeepLink(page, data);
    const card = resultCard(page);
    await expect(card).toHaveAttribute("data-guide-key", "customsCleared");
    await expect(card.locator('[data-station="customs"]')).toHaveAttribute("aria-current", "step");
    await expect(card.locator('[data-station="customs"] [data-spine-part="sub"]')).toHaveText("인계 대기");
    const caption = "caption" in view.eta ? view.eta.caption : null;
    if (caption !== null) await expect(card.locator("[data-eta-caption]")).toHaveText(caption);
    await expect(page.locator('[data-cta-state="customsCleared"]')).toBeVisible();
  });

  test("picked up: 'CJ대한통운 기사님 픽업 완료!' and the carrier's official lookup as the primary", async ({ page }) => {
    const data = trackData("pickedUp");
    const view = viewFor(success(data));
    await openDeepLink(page, data);
    await expect(resultCard(page).getByRole("heading", { level: 2 })).toHaveText("CJ대한통운 기사님 픽업 완료!");
    const cta = page.locator('[data-cta-state="customsCleared"]');
    const official = cta.locator("a[href]").first();
    await expect(official).toHaveAttribute("href", view.carrier.officialUrl ?? "");
    await expect(official).toHaveAttribute("data-variant", "primary");
  });

  test("in transit: '국내 배송 중', the carrier's live link first, no store link before the primary end", async ({ page }) => {
    const data = inTransitData();
    const view = viewFor(success(data), OCTOBER_NOW);
    await openDeepLink(page, data, { now: OCTOBER_NOW });
    const card = resultCard(page);
    await expect(card.getByRole("heading", { level: 2 })).toHaveText("국내 배송 중");
    await expect(card.locator('[data-slot="eta"]')).toHaveAttribute("data-eta-kind", view.eta.kind);
    const cta = page.locator('[data-cta-state="inTransit"]');
    await expect(cta.getByRole("heading", { level: 3 })).toHaveText("배송이 진행 중이에요");
    await expect(cta.locator("a[href]").first()).toHaveAttribute("href", view.carrier.officialUrl ?? "");
    await expect(cta.getByRole("link", { name: TALK_NAME })).toBeVisible();
    expect(await storeLinksBefore(page, "[data-result-view] [data-primary-end]")).toBe(0);
    await expect(page.locator('[data-recommended-products="inTransit"]')).toBeVisible();
  });

  test("delivered: '배송 완료', '배송 완료일', and 지금 할 일 leads with the two store links", async ({ page }) => {
    await openDeepLink(page, trackData("delivered"));
    const card = resultCard(page);
    await expect(card.getByRole("heading", { level: 2 })).toHaveText("배송 완료");
    await expect(card.locator('[data-slot="eta"]')).toHaveAttribute("data-eta-kind", "deliveredOn");
    await expect(card.locator("[data-eta-label]")).toHaveText("배송 완료일");
    const cta = page.locator('[data-cta-state="delivered"]');
    await expect(cta.getByRole("heading", { level: 3 })).toHaveText("배송이 완료됐어요");
    const firstTwo = await cta.locator("a[href]").evaluateAll((links) => links.slice(0, 2).map((link) => link.getAttribute("href") ?? ""));
    expect(firstTwo).toEqual([channels.naver.urls.deliveredLead, channels.coupang.urls.deliveredLead]);
    await expect(cta.locator("[data-affiliate-disclosure]")).toHaveText(disclosures.coupang);
    await expect(cta.getByRole("link", { name: TALK_NAME })).toBeVisible();
    await expect(page.locator('[data-recommended-products="delivered"]')).toBeVisible();
  });

  test("overdue: attention tone, [문의 내용 복사하고 톡톡 열기] first, no recommendations or store links", async ({ page }) => {
    const data = customsWaitingData();
    const view = viewFor(success(data), OVERDUE_NOW);
    expect(view.overdue).toBe(true);
    await openDeepLink(page, data, { now: OVERDUE_NOW });
    const card = resultCard(page);
    await expect(card).toHaveAttribute("data-overdue", "true");
    await expect(card).toHaveAttribute("data-tone", "attention");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(view.title);
    await expect(page.locator('[data-cta-state="customsWaiting"] a[href]').first()).toHaveAccessibleName(COPY_AND_TALK_NAME);
    await expect(page.locator("[data-recommended-products]")).toHaveCount(0);
    expect(await storeLinkCount(page.locator("[data-view-state]"))).toBe(0);
  });

  test("stale: a verification prompt instead of an estimate — withheld ETA, '멈춤', copy-and-talk first, no '오늘 예상'", async ({ page }) => {
    await openDeepLink(page, trackData("stale"));
    const card = resultCard(page);
    await expect(card).toHaveAttribute("data-guide-key", "stale");
    await expect(card).toHaveAttribute("data-tone", "attention");
    await expect(card.locator('[data-slot="eta"]')).toHaveAttribute("data-eta-kind", "withheld");
    await expect(card.locator("[data-eta-text]")).toHaveText("지금은 도착 예상일을 안내하기 어려워요");
    await expect(page.locator("[data-result-view]")).not.toContainText("오늘 예상");
    await expect(card.locator('[data-issue="stopped"]')).toHaveCount(1);
    await expect(page.locator('[data-cta-state="stale"] a[href]').first()).toHaveAccessibleName(COPY_AND_TALK_NAME);
    await expect(page.locator("[data-recommended-products]")).toHaveCount(0);
  });

  test("carrier lookup delay with a known carrier: the cut mark and that carrier's official lookup first", async ({ page }) => {
    const data = trackData("lookupUnavailableCarrier");
    const view = viewFor(success(data));
    await openDeepLink(page, data);
    const card = resultCard(page);
    await expect(card).toHaveAttribute("data-guide-key", "lookupUnavailable");
    await expect(card.locator('[data-issue="cut"]')).toHaveCount(1);
    await expect(page.locator('[data-cta-state="lookupUnavailable"] a[href]').first()).toHaveAttribute("href", view.carrier.officialUrl ?? "");
    await expect(page.locator("[data-carrier-chooser]")).toHaveCount(0);
  });

  test("carrier lookup delay without a carrier: choosing 한진택배 looks the same number up again with that carrier", async ({ page }) => {
    const bodies: unknown[] = [];
    await page.clock.setFixedTime(FIXTURE_NOW);
    await blockOtherHosts(page);
    await mockTrackSequence(page, [trackData("lookupUnavailableAuto"), trackData("inTransit", { trackingNumber: FAKE.domestic })], bodies);
    await page.goto(`/${FAKE.domestic}`);
    await page.getByRole("group", { name: "택배사 선택" }).getByRole("radio", { name: "한진택배" }).click();
    await expect(resultCard(page)).toHaveAttribute("data-guide-key", "inTransit");
    expect(bodies).toEqual([
      { trackingNumber: FAKE.domestic, carrierCode: "AUTO" },
      { trackingNumber: FAKE.domestic, carrierCode: "HANJIN" }
    ]);
  });

  test("ambiguous: arrowing through the carriers starts nothing; Space chooses and looks up again", async ({ page }) => {
    const bodies: unknown[] = [];
    await page.clock.setFixedTime(FIXTURE_NOW);
    await blockOtherHosts(page);
    await mockTrackSequence(page, [trackData("ambiguous"), trackData("inTransit", { trackingNumber: FAKE.domestic })], bodies);
    await page.goto(`/${FAKE.domestic}`);
    const group = page.getByRole("group", { name: "택배사 선택" });
    await group.getByRole("radio", { name: "CJ대한통운" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "우체국택배" })).toBeFocused();
    expect(bodies).toHaveLength(1);
    await page.keyboard.press("Space");
    await expect(resultCard(page)).toHaveAttribute("data-guide-key", "inTransit");
    expect(bodies[1]).toEqual({ trackingNumber: FAKE.domestic, carrierCode: "EPOST" });
  });

  test("a carrier lookup delay under customs: the auxiliary [다시 조회] looks the same number up again", async ({ page }) => {
    const bodies: unknown[] = [];
    await page.clock.setFixedTime(FIXTURE_NOW);
    await blockOtherHosts(page);
    const data = trackData("customsWithCarrierCut");
    await mockTrackSequence(page, [data], bodies);
    await page.goto(`/${data.trackingNumber}`);
    const line = resultCard(page).locator("[data-auxiliary-line]");
    await expect(resultCard(page).locator('[data-station="domestic"]')).toHaveAttribute("data-issue", "cut");
    await line.getByRole("button", { name: "다시 조회" }).click();
    await expect.poll(() => bodies.length).toBe(2);
    expect(bodies[1]).toEqual(bodies[0]);
  });

  test("a carrier chosen in the form reaches the request, the number bar and the official link", async ({ page }) => {
    const bodies: unknown[] = [];
    await page.clock.setFixedTime(FIXTURE_NOW);
    await blockOtherHosts(page);
    const base = trackData("inTransit", { trackingNumber: FAKE.domestic });
    const data: TrackResponseData = {
      ...base,
      delivery: {
        ...base.delivery,
        carrier: "한진택배",
        carrierCode: "HANJIN",
        invoiceNumber: FAKE.domestic,
        trackingUrl: getDeliveryCarrier("HANJIN").trackingUrl(FAKE.domestic)
      }
    };
    await mockTrack(page, data, { onRequest: (body) => bodies.push(body) });
    await page.goto("/");
    await page.getByRole("combobox", { name: "국내 택배사" }).selectOption("HANJIN");
    const input = page.getByLabel(INPUT_LABEL, { exact: true });
    await input.fill(FAKE.domestic);
    await input.press("Enter");
    await expect(resultCard(page)).toHaveAttribute("data-guide-key", "inTransit");
    expect(bodies).toEqual([{ trackingNumber: FAKE.domestic, carrierCode: "HANJIN" }]);
    await expect(page.locator("[data-number-bar]")).toContainText("한진택배");
    await expect(page.locator('[data-cta-state="inTransit"] a[href]').first()).toHaveAttribute("href", data.delivery.trackingUrl ?? "");
  });
});

test.describe("a browser in America/New_York", () => {
  test.use({ timezoneId: "America/New_York" });

  test("a browser in America/New_York shows the KST view: the date and the worry line", async ({ page }) => {
    const data = customsWaitingData();
    const view = viewFor(success(data));
    await openDeepLink(page, data);
    const card = resultCard(page);
    if ("date" in view.eta) await expect(card.locator('[data-slot="eta"] [data-eta-value] .sr-only')).toHaveText(view.eta.date.label);
    await expect(page.locator('[data-cta-state="customsWaiting"] [data-worry-line]')).toContainText(view.nextAction.worry?.text ?? "");
    await expect(card).toHaveAttribute("data-overdue", "false");
  });

  test("overdue flips at KST midnight while it is still the day before in New York", async ({ page }) => {
    await openDeepLink(page, customsWaitingData(), { now: new Date("2026-09-29T00:00:30+09:00") });
    await expect(resultCard(page)).toHaveAttribute("data-overdue", "true");
  });
});
```

- [ ] **Step 5: Write the focus, live-sentence, title and fill E2E**

Create `tests/e2e/result-layout.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";
import { siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import { success } from "../fixtures/derive-scenarios";
import { FAKE, FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";

const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";

async function blockOtherHosts(page: Page): Promise<void> {
  await page.context().route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
}

async function openDeepLink(page: Page, delayMs: number, state: Parameters<typeof trackData>[0] = "customsWaiting"): Promise<void> {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await blockOtherHosts(page);
  await mockTrack(page, trackData(state), { delayMs });
  await page.goto(`/${FAKE.hbl}`);
}

/** Records every non-empty text the one polite live region shows. */
async function recordLiveRegion(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const texts: string[] = [];
    Object.defineProperty(window, "__ttLiveTexts", { value: texts });
    const attach = (): void => {
      const region = document.querySelector("[data-live-region]");
      if (region === null) {
        requestAnimationFrame(attach);
        return;
      }
      new MutationObserver(() => {
        const text = (region.textContent ?? "").trim();
        if (text !== "") texts.push(text);
      }).observe(region, { childList: true, characterData: true, subtree: true });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attach);
    else attach();
  });
}

async function liveTexts(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const value: unknown = Reflect.get(window, "__ttLiveTexts");
    return Array.isArray(value) ? value.map((item) => String(item)) : [];
  });
}

/** Sums layout-shift values without recent input into window.__ttCls (resettable from the test). */
async function installLayoutShiftMeter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let total = 0;
    Object.defineProperty(window, "__ttCls", {
      get: () => total,
      set: (value: number) => {
        total = value;
      }
    });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { readonly value?: number; readonly hadRecentInput?: boolean };
        if (shift.hadRecentInput !== true) total += shift.value ?? 0;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

test.describe("focus, live sentence, title and fill", () => {
  test("after a manual lookup focus moves to the status h2, which is not an alert, without scrolling", async ({ page }) => {
    await page.clock.setFixedTime(FIXTURE_NOW);
    await blockOtherHosts(page);
    await mockTrack(page, trackData("inTransit"));
    await page.goto("/");
    const input = page.getByLabel(INPUT_LABEL, { exact: true });
    await input.fill(FAKE.hbl);
    await input.press("Enter");
    const heading = page.locator("[data-result-view] h2");
    await expect(heading).toBeFocused();
    expect(await heading.getAttribute("role")).toBeNull();
    await expect(page.locator('[data-result-view] [role="alert"], [data-result-view] [role="status"], [data-result-view] [aria-live]')).toHaveCount(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("a deep link moves focus to the status h2 when the customer did nothing", async ({ page }) => {
    await openDeepLink(page, 600);
    await expect(page.locator("[data-result-view] h2")).toBeFocused();
  });

  test("a deep link leaves focus alone when the customer pressed a key while it loaded", async ({ page }) => {
    await openDeepLink(page, 2_000);
    await expect(page.locator("[data-loading-stage]")).toBeVisible();
    await page.keyboard.press("Tab");
    const heading = page.locator("[data-result-view] h2");
    await expect(heading).toBeVisible();
    await expect(heading).not.toBeFocused();
  });

  test("the one polite live region reads the result sentence exactly once", async ({ page }) => {
    const view = deriveTrackingView(success(trackData("customsWaiting")), FIXTURE_NOW, siteConfig);
    await recordLiveRegion(page);
    await openDeepLink(page, 800);
    await expect(page.locator("[data-result-view] h2")).toBeVisible();
    await expect.poll(() => liveTexts(page)).toContain(view.liveMessage);
    // A duplicate announcement (for example from an old settle handler) would arrive within this time.
    await page.waitForTimeout(800);
    await expect(page.locator("[data-live-region]")).toHaveCount(1);
    expect((await liveTexts(page)).filter((text) => text === view.liveMessage)).toHaveLength(1);
  });

  test("the document title names the state, never the number", async ({ page }) => {
    const view = deriveTrackingView(success(trackData("customsWaiting")), FIXTURE_NOW, siteConfig);
    await openDeepLink(page, 1_000);
    await expect(page.locator("[data-loading-stage]")).toBeVisible();
    expect(await page.title()).not.toBe(view.documentTitle);
    await expect(page).toHaveTitle(view.documentTitle);
    expect(await page.title()).not.toMatch(/\d{4}/);
  });

  test("the result fills the loading card's place: no scroll jump and CLS ≤ 0.05 at 375×812", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await installLayoutShiftMeter(page);
    await openDeepLink(page, 1_200);
    const loadingCard = page.locator("[data-loading-stage]");
    await expect(loadingCard).toBeVisible();
    const before = await loadingCard.evaluate((element) => ({ top: element.getBoundingClientRect().top, scroll: window.scrollY }));
    await page.evaluate(() => {
      Reflect.set(window, "__ttCls", 0);
    });
    const card = page.locator("[data-result-view] [data-guide-key]");
    await expect(card).toBeVisible();
    const after = await card.evaluate((element) => ({ top: element.getBoundingClientRect().top, scroll: window.scrollY }));
    expect(after.scroll).toBe(before.scroll);
    expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(1);
    const cls = await page.evaluate(() => Number(Reflect.get(window, "__ttCls")));
    // Printed for the stage gate (G8).
    console.info(`[budget] result fill CLS at 375x812: ${cls.toFixed(3)} (max 0.05)`);
    expect(cls).toBeLessThanOrEqual(0.05);
  });
});
```

- [ ] **Step 6: Run the new E2E to verify it fails on the R2 result slot**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-states.spec.ts tests/e2e/result-layout.spec.ts`
Expected: FAIL — every test that locates `[data-result-view]`, `[data-recovery]`, `[data-result-module-failure]` or `[data-loading-skeleton]`-based fill fails with "element(s) not found"/timeout (the page still renders `LegacyResultSection`). Tests that only touch S06's surfaces (for example the invalid-number test) may already pass. Record "N failed, M passed".

- [ ] **Step 7: Create `ResultSlot`**

Create `components/result/ResultSlot.tsx`:

```tsx
"use client";

import { createElement, useEffect, useEffectEvent, useRef, useState } from "react";
import { useAnnounce } from "@/components/primitives/LiveAnnouncer";
import { TalkLink } from "@/components/primitives/TalkLink";
import { channels } from "@/config/site.config";
import type { LoadingConfig } from "@/lib/config/types";
import { deriveLoadingView } from "@/lib/tracking/loading-view";
import type { LookupState } from "@/lib/tracking/lookup-state";
import type {
  LoadingViewModel,
  LookupEntry,
  LookupOutcome,
  ResultAction,
  TrackingEntry,
  TrackingViewModel
} from "@/lib/tracking/types";
import { LoadingCard } from "./LoadingCard";
import { loadResultModule, preloadResultModule, type ResultModule } from "./load-result-module";

export interface ResultSlotProps {
  readonly entry: TrackingEntry;
  readonly loadingConfig: LoadingConfig;
  readonly state: LookupState;
  readonly loading: LoadingViewModel | null;
  readonly onAction: (action: ResultAction) => void;
  readonly headingRef?: React.RefObject<HTMLHeadingElement | null>;
  /** Called once per settled view, after it is on screen (ad signals, the number bar's carrier label, S08 extras). */
  readonly onView?: (view: TrackingViewModel) => void;
  readonly renderRecommendations?: (view: TrackingViewModel, outcome: LookupOutcome) => React.ReactNode;
}

type SettledState = Extract<LookupState, { readonly phase: "settled" | "error" }>;

interface Shown {
  readonly state: SettledState;
  readonly view: TrackingViewModel;
  readonly module: ResultModule;
}

/** The first-paint card of a deep link shows no notice, so it needs no clock; a constant keeps SSR and hydration equal. */
const FIRST_PAINT_NOW = new Date(0);
/** Lookups the customer did not start on this screen: focus moves only if they have not interacted meanwhile (spec §5). */
const QUIET_ENTRIES: ReadonlySet<LookupEntry> = new Set<LookupEntry>(["deepLink", "restore", "autoRetryOnline"]);
/** What counts as the customer interacting (the same four events S06's LookupController used): taps, keys, wheel and touch scrolls. */
const INTERACTION_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

function isSettled(state: LookupState): state is SettledState {
  return state.phase === "settled" || state.phase === "error";
}

/** Invalid numbers are shown by the lookup form (S06, data-guide-key="invalidNumber"); the result slot stays empty. */
function isInvalid(state: LookupState): boolean {
  return state.phase === "error" && state.outcome.cause === "invalidNumber";
}

function firstPaintLoading(entry: TrackingEntry, state: LookupState, config: LoadingConfig): LoadingViewModel | null {
  if (entry.kind !== "deepLink" || state.phase !== "idle" || state.lastRequest !== null) return null;
  return deriveLoadingView(
    {
      request: { number: entry.number, carrier: entry.carrier, entry: "deepLink" },
      elapsedMs: 0,
      reducedMotion: false,
      now: FIRST_PAINT_NOW
    },
    { lookup: config.lookup, notices: [] }
  );
}

function visibleLoading(state: LookupState, loading: LoadingViewModel | null): LoadingViewModel | null {
  if (state.phase !== "loading" || loading === null) return null;
  // A manual lookup shows only the busy button label for the first 0.4 s (spec §5).
  return loading.stage === "instant" && state.request.entry === "manual" ? null : loading;
}

function focusHeading(heading: HTMLHeadingElement | null): void {
  if (heading === null) return;
  heading.focus({ preventScroll: true });
  const box = heading.getBoundingClientRect();
  if (box.bottom < 0 || box.top > window.innerHeight) heading.scrollIntoView({ block: "start" });
}

/** The result chunk could not load (a deploy replaced it, or the connection dropped): 톡톡 stays reachable. */
function ModuleFailure(): React.JSX.Element {
  return (
    <section
      data-cta-state="error"
      data-result-module-failure="true"
      className="flex min-h-[calc(100svh_-_6.5rem)] flex-col gap-3 bg-tt-surface px-[var(--tt-gutter)] py-4"
    >
      <TalkLink href={channels.talk.url} label={channels.talk.labels.cta} weight="primary" placement="state" />
    </section>
  );
}

/** Keeps the loading card's place for the moment between the settle and the lazy chunk (no jump, no shift). */
function PendingPlaceholder(): React.JSX.Element {
  return <div data-result-pending="true" aria-hidden="true" className="min-h-[calc(100svh_-_6.5rem)]" />;
}

/**
 * The result slot of the lookup screen (spec §5–§7): LoadingCard while a lookup runs (and on a deep link's first
 * paint), then the lazy ResultView for the settled or failed lookup. It owns what happens when a result arrives:
 * the document title (never the number), one live sentence, and the focus move to the status h2.
 */
export function ResultSlot({
  entry,
  loadingConfig,
  state,
  loading,
  onAction,
  headingRef,
  onView,
  renderRecommendations
}: ResultSlotProps): React.JSX.Element | null {
  const [shown, setShown] = useState<Shown | null>(null);
  const [failed, setFailed] = useState<SettledState | null>(null);
  const localHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const initialTitleRef = useRef<string | null>(null);
  const interactedRef = useRef(false);
  const announce = useAnnounce();
  const targetRef = headingRef ?? localHeadingRef;

  // The page's own title comes back in idle and loading; interactions gate the deep-link focus move; focus entering the
  // lookup form is intent, so the result chunk downloads while the customer types (an offline error can still be drawn).
  useEffect(() => {
    initialTitleRef.current = document.title;
    const markInteraction = (): void => {
      interactedRef.current = true;
    };
    const preloadOnIntent = (event: FocusEvent): void => {
      if (event.target instanceof Element && event.target.closest("[data-lookup-form]") !== null) preloadResultModule();
    };
    for (const type of INTERACTION_EVENTS) window.addEventListener(type, markInteraction, { capture: true, passive: true });
    document.addEventListener("focusin", preloadOnIntent);
    return () => {
      for (const type of INTERACTION_EVENTS) window.removeEventListener(type, markInteraction, { capture: true });
      document.removeEventListener("focusin", preloadOnIntent);
    };
  }, []);

  useEffect(() => {
    if (state.phase === "loading" || entry.kind === "deepLink") preloadResultModule();
  }, [state.phase, entry.kind]);

  useEffect(() => {
    if (state.phase !== "idle" && state.phase !== "loading") return;
    if (initialTitleRef.current !== null) document.title = initialTitleRef.current;
  }, [state.phase]);

  // Derive when the lookup settles. `now` is read here, after the commit — never during render (spec §7 overdue).
  useEffect(() => {
    if (!isSettled(state) || isInvalid(state)) return undefined;
    let active = true;
    const now = new Date();
    loadResultModule().then(
      (module) => {
        if (active) setShown({ state, view: module.deriveTrackingView(state.outcome, now, module.siteConfig), module });
      },
      () => {
        if (active) setFailed(state);
      }
    );
    return () => {
      active = false;
    };
  }, [state]);

  const presentView = useEffectEvent((next: Shown): void => {
    document.title = next.view.documentTitle;
    announce(next.view.liveMessage);
    onView?.(next.view);
    const quiet = QUIET_ENTRIES.has(next.state.outcome.request.entry);
    if (!quiet || !interactedRef.current) focusHeading(targetRef.current);
    interactedRef.current = false;
  });

  useEffect(() => {
    if (shown !== null) presentView(shown);
  }, [shown]);

  if (isSettled(state)) {
    if (isInvalid(state)) return null;
    if (shown !== null && shown.state === state) {
      // The lazy component is a module singleton with a stable identity; createElement renders it without a JSX tag.
      return createElement(shown.module.ResultView, {
        view: shown.view,
        onAction,
        headingRef: targetRef,
        failureCause: state.phase === "error" ? state.outcome.cause : undefined,
        recommendationSlot: renderRecommendations?.(shown.view, state.outcome)
      });
    }
    return failed === state ? <ModuleFailure /> : <PendingPlaceholder />;
  }
  const card = visibleLoading(state, loading) ?? firstPaintLoading(entry, state, loadingConfig);
  return card === null ? null : <LoadingCard loading={card} onCancel={() => onAction({ kind: "cancel" })} />;
}
```

- [ ] **Step 8: Render `ResultSlot` in `LookupController`**

Work in `components/lookup/LookupController.tsx`, using the lines recorded in Task 0 Step 9.

(a) Imports — add (merge a type-only line with an existing `@/lib/tracking/types` type import if there is one):

```tsx
import dynamic from "next/dynamic";
import { ResultSlot } from "@/components/result/ResultSlot";
import type { LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";
```

and delete the import of `LegacyResultSection` (and of `LoadingTimeline`/`LoadingCard` if LookupController rendered the SSR loading card itself). Keep the existing `setAdSignals` import (S02, `@/lib/ads/ad-signals`); add `import { setAdSignals } from "@/lib/ads/ad-signals";` only if it is missing.

(b) Module level, below the imports:

```tsx
/** The R2 recommendation component, kept until S08 replaces it; loaded only when a result allows recommendations. */
const LegacyRecommendedProducts = dynamic(
  () => import("@/components/RecommendedProducts").then((module) => module.RecommendedProducts),
  { ssr: false }
);
```

(c) Inside the component, next to the other handlers (S06 destructures the `useLookup(...)` result into `state`, `loading`, `submit`, `retry`, `cancel`, `reset` and already imports `useState` from `react`):

```tsx
  const [settledView, setSettledView] = useState<TrackingViewModel | null>(null);

  const handleView = (view: TrackingViewModel): void => {
    setSettledView(view);
    setAdSignals({ resultAdsAllowed: view.revenue.adsAllowed });
  };

  const renderRecommendations = (view: TrackingViewModel, outcome: LookupOutcome): React.ReactNode =>
    outcome.kind === "success" &&
    view.revenue.recommendations === "inline" &&
    (view.revenue.recommendationContext === "pending" ||
      view.revenue.recommendationContext === "inTransit" ||
      view.revenue.recommendationContext === "delivered") ? (
      <LegacyRecommendedProducts context={view.revenue.recommendationContext} />
    ) : null;
```

S04 Task 6 gave the legacy list the props `{ context: RecommendationStage }` (`"pending" | "inTransit" | "delivered"`) and showed it only where the view places inline recommendations (S04's `recommendationStageOf`); the condition above is the same rule, so customs rows (`"optional"`), overdue and problem rows show no legacy list. The statement keeps its first line and its closing `) : null;` exactly as written: S08 Task 3 finds it by them. Check S04's props first: `Select-String -Path components/RecommendedProducts.tsx -Pattern 'readonly context: RecommendationStage|export type RecommendationStage'` → two lines. If instead it prints nothing and the file still declares `readonly statusCode: StatusCode;` (S04 Task 6 was executed differently), replace only the `<LegacyRecommendedProducts … />` element with `<LegacyRecommendedProducts statusCode={outcome.data.currentStatusCode} isPending={view.revenue.recommendationContext === "pending"} />` and record it in the stage summary.

(d) The result-action handler is S06's `handleAction` (the function passed to `LegacyResultSection`'s `onAction`). S06 Task 5 Step 11 already gives it both branches the result area needs; keep them exactly as S06 wrote them:

```tsx
        case "cancel":
          openForm("cancel", activeRequest);
          return;
        case "chooseCarrier":
          if (activeRequest === null) return;
          setCarrier(action.carrier);
          beginLookup({ number: activeRequest.number, carrier: action.carrier, entry: "carrierChip" });
          return;
```

`openForm("cancel", …)` cancels the lookup, keeps the number in the input and moves focus there (spec §5 [조회 취소]); `beginLookup` saves the restore entry and submits. Only if Task 0 Step 9 recorded a handler without one of these branches, add the missing branch in this form (as `if (action.kind === "…") { …; return; }` at its top when the handler is not a `switch`).

(e) Replace the whole `<LegacyResultSection … />` element with:

```tsx
          <ResultSlot
            entry={entry}
            loadingConfig={LOADING_CONFIG}
            state={state}
            loading={loading}
            onAction={handleAction}
            headingRef={headingRef}
            onView={handleView}
            renderRecommendations={renderRecommendations}
          />
```

These are S06's names: `entry` (`LookupControllerProps.entry`), `LOADING_CONFIG` (the `LoadingConfig` passed to `useLookup({ config })`), `state` and `loading` (from `useLookup`), `handleAction` (step (d)) and `headingRef` (the status-heading ref). In the `ReplayFrame` variant (S06 Task 5 Step 12 shipped the same-address entry) write `state={shownState}`. If Task 0 Step 9 recorded other spellings, use those.

(f) Delete S06's settle-time view code recorded in Task 0 Step 9 (e): the view derivation, the result `document.title` assignment, announcements of `liveMessage` on settle, the focus move to `headingRef` on settle, and any direct rendering of the loading card. In S06's file these are: the `handleSettled` callback (and `onSettled: handleSettled` in the `useLookup` call — `ResultSlot` derives on settle), `deriveSafely`, the `getLoadedLegacyDeriver`/`loadLegacyDeriver`/`LegacyDeriver` names of the `@/components/lookup/LegacyResultSection` import (the whole import line goes with `LegacyResultSection`) and the `void loadLegacyDeriver().catch(() => undefined);` line in `beginLookup` (`ResultSlot` preloads the result module), `derived`/`setDerived`, `derivedSeqRef`, `handledSeqRef`, the `settled`/`settledEntry` constants with the effect that sets the result title, announces and focuses, and the `settled.view === null` branch that rendered `FailureFallback guideKey="serverError"` (`ResultSlot` shows its module-failure block instead). Delete `PASSIVE_ENTRIES`, `interactedRef` and its `INTERACTION_EVENTS` effect too: they served only that focus rule, and `ResultSlot` tracks interaction itself. Keep `announce` (S06 Task 6 announces the paste notice with it), the loading announcements (S04's `useLookup` makes them), the URL scrub, session restore, `openForm`, `beginLookup`, ad-signal wiring that does not use the view, and S06's `pageTitleOf` with its `pageTitle` effect and title constants: they set only the home, INVALID and '조회 중' titles of the form and loading displays (it returns `null` for a settled result, whose title `ResultSlot` sets), and because a parent's effect runs after its child's, they win over `ResultSlot`'s restore of the load-time title — so after [다른 번호 조회] on a deep link the home form shows the home title, not the deep link's '조회 중 · 배송 조회'. Wherever S06 read its derived view (the number bar's `carrierLabel` reads `settled?.view?.carrier.barLabel`), read `settledView?.carrier.barLabel` instead.

(g) The number bar and the result slot sit in the same dynamic area as before (`[data-view-state]`); do not move them.

(h) S06's display table cannot work without the `derived` input step (f) removed: `computeDisplay` (S06 Task 5 Step 3) returns `pending` until a derived view with the outcome's key arrives, and `LegacyResultSection`'s slot display is where the element of step (e) sits. So apply Task 9 Steps 1, 4 and 5 now, in that order (the `lookup-display.spec.ts` rewrite, the new display table, and the always-mounted result area in `LookupController`; Task 9 Step 5 (d) replaces this step's `settledView` lines with the `SettledViewRecord` version, and its (g) replaces the expression around step (e)'s element). Write "Task 9 Part A done in Task 8" into the stage summary; Task 9 then starts at Step 2.

Run: `Select-String -Path components/lookup/LookupController.tsx -Pattern 'LegacyResultSection|LegacyDeriver|LoadingTimeline|PendingCard|deriveTrackingView|derive-view|documentTitle|liveMessage|handleSettled|outcomeKey'`
Expected: no output.
Run: `Select-String -Path components/lookup/LookupController.tsx -Pattern 'document\.title'`
Expected: exactly one line, `if (pageTitle !== null) document.title = pageTitle;` (S06's form and loading titles).
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/lookup-display.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `7 passed`.
Run: `if (Test-Path .next) { Remove-Item -Recurse -Force .next }; npm run typecheck; npm run lint`
Expected: both exit 0, no new warnings (an unused-variable error names S06 code step (f) left behind: delete it).

- [ ] **Step 9: Run the new E2E to verify it passes**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-states.spec.ts tests/e2e/result-layout.spec.ts tests/e2e/result-kit.spec.ts tests/e2e/return-link.spec.ts`
Expected: all passed (`result-states.spec.ts` 32, `result-layout.spec.ts` 6, `result-kit.spec.ts` 42, S02's `return-link.spec.ts` 6 — its button is now `ReturnLinkAction`).
If "an invalid number: …" fails because `[data-cta-state="error"]` has count 0, S06's form mode renders no error block for client-side invalid input: in `components/result/ResultSlot.tsx` delete the line `    if (isInvalid(state)) return null;` and change `if (!isSettled(state) || isInvalid(state)) return undefined;` to `if (!isSettled(state)) return undefined;`, and at the top of `presentView` add `if (next.view.guideKey === "invalidNumber") { document.title = next.view.documentTitle; return; }` (the form keeps focus on the input, spec §7 INVALID); re-run until the test passes and record the change in the stage summary.

- [ ] **Step 10: Remove the old result tests that the new assertions replace**

1. Confirm every title in `tests/tracking.spec.ts` is mapped. Run:
   `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $titles = npx playwright test --list tests/tracking.spec.ts | ForEach-Object { if ($_ -match '\.ts:\d+:\d+\s›\s(.+)$') { $Matches[1] } }; $map = Get-Content tests/e2e/RULE-MAP.md -Raw -Encoding UTF8; $titles | Where-Object { -not $map.Contains($_) }; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
   Expected: no output (every remaining title appears in a RULE-MAP row — S06's or S07's). A printed title means a rule without a new assertion: add its row in Step 2's section and its assertion to `result-states.spec.ts` before going on.
2. Delete the file: `git rm tests/tracking.spec.ts`
3. In `tests/privacy.spec.ts`, delete the whole block that starts with `test("a stale shipment shows a verification prompt instead of a delivery estimate", async ({ page }) => {` and ends with its closing `});` (rule S07-10 now lives in `result-states.spec.ts`). Then remove the imports only that test used — S04 Addition 8 names them: `deriveStatusView` (the `@/components/status-slot/status-view` import line), `resultCopy`, `TrackResponseData`, `FIXTURE_NOW` and `mockTrack` (drop a name from a shared import line; drop the line when nothing is left on it).
Run: `Select-String -Path tests/privacy.spec.ts -Pattern 'status-slot/|deriveStatusView|a stale shipment'; npx eslint tests/privacy.spec.ts`
Expected: no output from either (an unused-import warning names a name still to remove).
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/privacy.spec.ts`
Expected: all passed (only the policy tests remain).

- [ ] **Step 11: Run S04's E2E files against the R3 DOM**

First check which of S04's ledger fallbacks the four specs still compute: they build their expected views with S04's `deriveStatusView` (`deriveTrackingView` + `applyApprovalFallbacks(view, STATUS_SLOT_APPROVALS)`), while the page now renders plain `deriveTrackingView` until Task 10 Part A.
Run: `Select-String -Path components/status-slot/status-view.ts -Pattern 'STATUS_SLOT_APPROVALS: StatusSlotApprovals = \{ approval2: true, approval3: true \}'`
Expected: one line only when approvals 2 and 3 are both granted and S04's Tasks 9 and 10 flipped the constant. With the ledger as it stands (approval 3 `pending`) it prints nothing: `failure-causes.spec.ts` › "the filled primary on an error follows the approval-3 ledger" would expect `talk` where the page shows the cause's recovery action (and, if S04's approval-2 flip never ran, the settled-state specs would expect S04's legacy wording). Those are expectation-source differences, not S07 regressions: apply Task 10 Steps 1–5 now (Part A: `approvals.ts`, `deriveResultView` in `ResultSlot`, the S04 specs pointed at `deriveResultView`; Step 5's check prints only `tests\unit\status-view.spec.ts` lines because Step 10 above already removed the other importers), run its Step 6 (unit and E2E runs, RULE-MAP rows S07-13 to S07-15) after Step 12 below, skip its Step 7 commit (Step 14 below commits those files), and write "Task 10 Part A done in Task 8" into the stage summary.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/status-slot.spec.ts tests/e2e/loading-timeline.spec.ts tests/e2e/failure-causes.spec.ts tests/e2e/cta-consistency.spec.ts`
Expected: either all passed (S04 selected only contract hooks) or failures whose error names a locator. Go to Step 12 for each failure.

- [ ] **Step 12: Rewrite only the selectors S04 used for its transitional DOM**

For each failing locator apply the matching row; never delete an assertion and never change an expected value (text, count, attribute value, request body). If a failure is a wrong value rather than a missing element and no row below names that assertion (the spinner, `data-action-*` and loading-card rows move a value check to another element or spelling), it is a rule regression in S07 code — fix the code, not the test. If a failing locator matches no row, stop and report it in the stage summary.

| Selector in S04's E2E | What it meant | R3 selector |
|---|---|---|
| a slot root such as `[data-status-slot]` | the one R2 status slot | `[data-view-state]` (S06 dynamic area) — or drop it from the chain when a contract hook follows |
| `[data-tracking-result-summary="true"]` | legacy result summary | `[data-result-view] [data-guide-key]` |
| `[data-delivery-estimate="true"]` | legacy ETA panel | `[data-result-view] [data-slot="eta"]` |
| `[data-customs-estimate="true"]` | legacy customs estimate | `[data-result-view] [data-eta-caption]` |
| S04 `WorryLine` root (for example `[data-worry-line]`) | worry sentence | `[data-cta-state] [data-worry-line]` (same hook on `NextActionBlock`, text only when 톡톡 is already in the block) |
| `getByRole("button", { name: "문의 내용 복사하고 톡톡 열기" })` (S04 `CopyInquiryButton`) | copy + open 톡톡 | `getByRole("link", { name: "문의 내용 복사하고 톡톡 열기 새 창으로 열기" })` |
| `getByRole("button", { name: "다시 볼 링크 복사" })` inside an S04 container | return link | unchanged name; scope to `[data-cta-state]` |
| `[data-loading-stage]`, `[data-failure-cause]`, `[data-guide-key]`, `[data-overdue]`, `[data-cta-state]`, `[data-eta-kind]`, `[data-live-region]` | contract hooks (§11.13) | unchanged |
| the status `h2` found by role inside an S04 container | status heading | `page.locator("[data-result-view] h2")` (settled/error) or `page.locator("[data-loading-stage] h2")` (loading) |
| S04's `statusSlot` helper (`tests/support/status-slot.ts`: `page.locator("#tracking-panel [data-status-slot]")`) | the one R2 status slot | `page.locator("#tracking-panel [data-view-state]")` (S06 `section#tracking`). The `#tracking-panel` prefix stays valid: S06 Addition 11 keeps `<div id="tracking-panel">` around `LookupController` in `TrackingPage` and S07 does not remove it, so the other `#tracking-panel …` selectors (`form[aria-busy]`, `[data-affiliate-disclosure]`, S04's `submitButton`) keep working unchanged |
| `expect(statusSlot(page)).toHaveCount(0)` | the slot shows nothing (a manual lookup's first 0.4 s; after [조회 취소]; a late answer after cancel) | `expect(page.locator(RESULT_SLOT_CONTENT)).toHaveCount(0)` — add `export const RESULT_SLOT_CONTENT = "[data-loading-stage], [data-result-view], [data-result-pending], [data-result-module-failure]";` (every root `ResultSlot` can render) to `tests/support/status-slot.ts` and import it where used; the expected count stays 0 |
| `[data-status-slot="V"]` or `toHaveAttribute("data-status-slot", V)`, V = `loading` / `error` / `settled` | the slot's phase | `[data-view-state="V"]` / `toHaveAttribute("data-view-state", V)` — the same three values (S06 contract hook); on `statusSlot(page)` itself: `expect(statusSlot(page)).toHaveAttribute("data-view-state", V)` |
| `toContainText(<grouped number>)` / `toContainText(lookup.copy.carrierAuto)` on S04's loading card (`statusSlot(page).locator("[data-loading-stage]")`) | the loading screen shows the number and '택배사 자동 확인' | the same assertion on `page.locator("[data-number-bar]")` — S06's `NumberBar` above the result area carries both (`requestCarrierView(…).barLabel` while loading); S07's `LoadingCard` does not repeat them (spec §6: the number bar is the one place for the number) |
| `getByRole("group", { name: "택배사 선택" })` then `.getByRole("button")` / `.getByRole("button", { name: N })` | the carrier chips | `.getByRole("radio")` / `.getByRole("radio", { name: N })` — S07's `CarrierChooser` is `fieldset[data-carrier-chooser]` with legend '택배사 선택' and five radios named by the carrier (spec §12 "carriers as fieldset + radio"); count 5 and the names stay |
| `[data-cta-state="delivered"] details` with text '받지 못하셨나요?' (S04 kept 미수령 안내 inside 지금 할 일) | 미수령 안내 | `page.locator("details[data-delivered-help]")` — S07's `DeliveredHelp` sits right after 처리 내역 and [받지 못하셨나요?] in 지금 할 일 opens it; its `summary` text and body lines are unchanged |
| `getByRole("heading", { name: "국내 배송 진행 상황" })` or '상세 진행 내역' inside the result region (the legacy `DeliveryTimeline` / details headings) | the on-demand history is inside the one '배송 조회 결과' region | `locator("details[data-history]")` in the same region, `toBeVisible()` — the legacy timelines are gone (Task 10); the history is S07's `HistoryDetails` '처리 내역 N건 보기' |
| `[data-action-weight="W"]` or `toHaveAttribute("data-action-weight", W)`, W = `primary` / `secondary` / `text` (S04 Addition 4) | the action's weight | `[data-slot="button"][data-variant="W"]` / `toHaveAttribute("data-variant", W)` (S05 `Button`, `ButtonLink`, `TalkLink`, `CopyButton` all carry both) |
| `[data-action-kind="K"]` for an `ActionKind` K (to click it or read it) | the control of action K | the control named by the view's action of kind K: take `a` = the `ActionView` with `kind === K` among `view.nextAction.primary`, `view.nextAction.secondary`, `view.nextAction.worry?.talk` and `view.auxiliaryLine?.action` of the view the test already computes (S04's `deriveStatusView(…)` until Task 10, `deriveResultView(…)` after it; if the test has none, `deriveResultView(<the outcome it mocks>, FIXTURE_NOW)`), then `getByRole("button", { name: a.label, exact: true })` when `a.href === null`, else `getByRole("link", { name: a.external ? `${a.label} 새 창으로 열기` : a.label, exact: true })` |
| `toHaveAttribute("data-action-kind", K)` on a located control | which action it is | `toHaveAccessibleName(<the name the row above gives for kind K>)` — the expected kind stays the same, only its spelling moves from the hook to the name |
| `[data-action-kind="store"]` (S04's store links) | a store link | `[data-affiliate-group] a` |
| `toHaveAttribute("data-spinner", "on")` / `"off"` | the spinner turns / has stopped | `[data-spinner]` `toHaveCount(1)` / `toHaveCount(0)` (`LoadingCard` renders the spinner element only while it turns, Task 7) |
| `[data-loading-skeleton]` (S04: one element, value `true`) | the static skeleton | `[data-loading-skeleton="journey"]` (`LoadingCard` has three: `journey`, `eta`, `next-action`) |
| `[data-carrier-choice="C"]` | one carrier chip | `page.locator("[data-carrier-chooser]").getByRole("radio", { name: <the view's carrierChoices entry with code C>.name })` |
| `[data-worry-line]`, `[data-inquiry-preview]`, `[data-last-event]`, `textarea[data-copy-fallback]` (value `true`) | worry line, copied inquiry text, last event, copy fallback box | unchanged (same hooks and values in `NextActionBlock`, `ActionControl`, `LastEventLine`, S05 `CopyButton` and `ReturnLinkAction`) |

Selectors written as strings inside `page.evaluate` follow the same rows. One known case fails as a wrong value, not as a missing locator: `status-slot.spec.ts` › "a manual result fills the slot under the form: …" reads `document.querySelector("#tracking-panel [data-status-slot] [data-guide-key]")` and `document.querySelector("#tracking-panel [data-status-slot] [data-cta-state]")`, so `expect(cardBeforeCta).toBe(true)` receives `false`. Re-point both strings by the slot-root row to `#tracking-panel [data-view-state] [data-guide-key]` and `#tracking-panel [data-view-state] [data-cta-state]`; this is a selector fix, not a rule regression. Check that no other string selector is left: `Select-String -Path tests/e2e/*.spec.ts, tests/support/status-slot.ts -Pattern 'data-status-slot'` → no output.
When the rewritten selector lives in `tests/support/status-slot.ts` (S04's helpers), edit it there once; the four specs keep importing it. Re-run Step 11 until all pass. List every replaced selector (file, old → new) in the stage summary and in the S07-12 row's "New assertion" cell of `tests/e2e/RULE-MAP.md`. If Step 11 applied Task 10 Part A, run Task 10 Step 6 now.

- [ ] **Step 13: Run the whole suite in dev mode**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test`
Expected: 0 failed (skips only for `PW_MODE`/`PW_SHOTS`/`PW_VISUAL`-guarded or approval-gated tests). This includes S02's `url-privacy`/`session-restore`/`return-link` specs (they wait for the '다시 볼 링크 복사' button, which the in-transit fixture still shows), S03's `module-boundaries.spec.ts` (LookupController now reaches `ResultSlot` → `load-result-module`, never `ResultView` or `derive-view` statically), and S06's `home`/`deep-link`/`lookup-input` specs.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed (the boundary test in `result-module.spec.ts` now also scans `ResultSlot.tsx`).

- [ ] **Step 14: Commit**

```powershell
git add components/result/ResultSlot.tsx components/lookup/LookupController.tsx components/lookup/lookup-display.ts tests/unit/lookup-display.spec.ts tests/e2e/RULE-MAP.md tests/unit/normalizer.spec.ts tests/e2e/result-states.spec.ts tests/e2e/result-layout.spec.ts tests/privacy.spec.ts tests/e2e/status-slot.spec.ts tests/e2e/loading-timeline.spec.ts tests/e2e/failure-causes.spec.ts tests/e2e/cta-consistency.spec.ts tests/support/status-slot.ts
git commit -m "feat: switch the page to the lazy result view and migrate the result tests to rules and hooks"
```

(`git rm` in Step 10 already staged the deletion of `tests/tracking.spec.ts`; `lookup-display.ts` and its spec changed in Step 8 (h). When Step 11 applied Task 10 Part A, run `git add components/result/approvals.ts components/result/result-module.ts components/result/FailureCard.tsx tests/unit/result-approvals.spec.ts` before the commit.)

---

### Task 9: The live result page — one result area in the lookup island, then the page layout

Task 8 moved derivation, title, announcement and focus into `ResultSlot`, but S06's display table waits for a derived view before it leaves its `pending` card (`computeDisplay` → `settledDisplay(outcome, derived)`), and S06 mounts the result slot only in its `slot` display. Part A (Steps 1–7) replaces that split with one result area that is always mounted (so focus in the lookup form can preload the result module, Additions item 2) and keys the number bar's carrier label to the settle it belongs to. Part B (Steps 8–13) gives the result modes their page layout: the status field right under the number bar (B field cap), the 560 + 320 px desktop grid beyond S06's 560 px main column, and the first-view and 320 px checks. Task 8 Step 8 (h) already applied Steps 1, 4 and 5 (Task 8 cannot compile without them): start at Step 2; in Step 3 the unit run prints `7 passed` and the three new E2E tests may already pass (record which); run Step 5's two checks as regression checks, then Step 6. If Task 8's executor reshaped anything differently, replace that interim code with the code below; the checks in Steps 5 and 11 name what must be gone.

**Files:**
- Modify: `components/lookup/lookup-display.ts` (whole file; S06-owned, S06 Addition 2 lets S07 change it)
- Modify: `tests/unit/lookup-display.spec.ts` (whole file)
- Modify: `components/lookup/LookupController.tsx` (display call, settled-view state, `loadingLike`, the result-area expression, the section class)
- Test: `tests/e2e/result-layout.spec.ts` (import block; two describe blocks)

**Interfaces:**
- Consumes: `LookupState`, `INITIAL_LOOKUP_STATE` (`lib/tracking/lookup-state.ts`, S04); `LoadingViewModel`, `LookupRequest`, `TrackingEntry`, `NoticeView`, `ViewMode`, `LookupOutcome`, `TrackingViewModel` (S03); `activeNotices`, `toNoticeView` (S03 `lib/tracking/notices.ts`); `Notice`, `LoadingConfig` (S03 `lib/config/types.ts`); `requestCarrierView` (S03 `lib/tracking/carriers.ts`); `ResultSlot` (Task 8); S06's `LookupController` internals named in Task 0 Step 9; tokens `--tt-column`, `--tt-side`, `--tt-status-field-max` (S05); test fixtures `OCTOBER_NOW`, `customsWaitingData`, `failure`, `inTransitData`, `success` (S03), `FAKE`, `FIXTURE_NOW`, `mockTrack`, `trackData`, `FailureFixture` (S01).
- Produces: `LookupDisplay = { kind: "form"; busy: boolean; invalid: InvalidInput | null } | { kind: "result"; request: LookupRequest }`; `DisplayInput { state; loading; entry; formOpen; localInvalid }` (no `derived`); `computeDisplay(input: DisplayInput): LookupDisplay`; `viewModeOf(display: LookupDisplay, phase: LookupState["phase"]): ViewMode`; `stillActiveHomeNotice` unchanged; `DerivedView` and `outcomeKey` removed. In `LookupController`: `ResultSlot` always mounted inside `div[data-result-area]` (`display: contents` in form modes), a settled view keyed by `settledAt`, and the result-mode section class (no gap under the number bar; from 1024 px it widens by `var(--tt-side) + 2rem` with negative margins so the `560 | 320` grid fits while `/` stays one 560 px column).

**Part A — one result area**

- [ ] **Step 1: Write the failing unit test**

Replace the whole content of `tests/unit/lookup-display.spec.ts` with (the INVALID, view-mode and home-notice rows are S06's, unchanged; the four display rows now expect the result area):

```ts
import { expect, test } from "@playwright/test";
import { lookup, notices } from "@/config/site.config";
import { computeDisplay, stillActiveHomeNotice, viewModeOf, type DisplayInput } from "@/components/lookup/lookup-display";
import type { LoadingConfig, Notice } from "@/lib/config/types";
import { deriveLoadingView } from "@/lib/tracking/loading-view";
import { INITIAL_LOOKUP_STATE, type LookupState } from "@/lib/tracking/lookup-state";
import { toNoticeView } from "@/lib/tracking/notices";
import type { FailureCause, LoadingViewModel, LookupOutcome, LookupRequest, TrackingEntry } from "@/lib/tracking/types";
import { FAKE, FIXTURE_NOW, trackData } from "../fixtures/tracking-fixtures";

const LOADING_CONFIG: LoadingConfig = { lookup, notices };
const MANUAL: LookupRequest = { number: FAKE.domestic, carrier: "AUTO", entry: "manual" };
const DEEP_REQUEST: LookupRequest = { number: FAKE.hbl, carrier: "CJ", entry: "deepLink" };
const HOME: TrackingEntry = { kind: "home" };
const DEEP: TrackingEntry = { kind: "deepLink", number: FAKE.hbl, carrier: "CJ" };

const loadingAt = (request: LookupRequest, elapsedMs: number): LoadingViewModel =>
  deriveLoadingView({ request, elapsedMs, reducedMotion: false, now: FIXTURE_NOW }, LOADING_CONFIG);
const loadingState = (request: LookupRequest): LookupState => ({ phase: "loading", request, startedAt: 1, failureStreak: 0 });
const SUCCESS: Extract<LookupOutcome, { kind: "success" }> = {
  kind: "success",
  request: MANUAL,
  data: trackData("inTransit", { trackingNumber: FAKE.domestic })
};
const failure = (cause: FailureCause): Extract<LookupOutcome, { kind: "failure" }> => ({
  kind: "failure",
  request: MANUAL,
  cause,
  consecutiveFailures: 1
});
const BASE: DisplayInput = { state: INITIAL_LOOKUP_STATE, loading: null, entry: HOME, formOpen: true, localInvalid: null };

const HOME_NOTICE: Notice = {
  id: "test-home-notice",
  kind: "holiday",
  title: "연휴 배송 안내",
  body: "연휴에는 통관·택배가 쉬어요. 다음 영업일부터 순서대로 진행돼요.",
  startsAt: "2026-09-21T00:00:00+09:00",
  endsAt: "2026-09-29T00:00:00+09:00",
  home: true,
  guideKeys: [],
  cs: false
};

test("idle: the home shows the form, an unopened deep link shows the result area (its first-paint loading card)", () => {
  expect(computeDisplay(BASE)).toEqual({ kind: "form", busy: false, invalid: null });
  expect(computeDisplay({ ...BASE, entry: DEEP, formOpen: false })).toEqual({ kind: "result", request: DEEP_REQUEST });
  expect(computeDisplay({ ...BASE, entry: DEEP, formOpen: true })).toEqual({ kind: "form", busy: false, invalid: null });
});

test("a manual lookup keeps the busy form for the first 0.4 s, then the result area takes over", () => {
  const state = loadingState(MANUAL);
  expect(computeDisplay({ ...BASE, state, loading: loadingAt(MANUAL, 0) })).toEqual({ kind: "form", busy: true, invalid: null });
  expect(computeDisplay({ ...BASE, state, loading: loadingAt(MANUAL, 500) })).toEqual({ kind: "result", request: MANUAL });
  expect(computeDisplay({ ...BASE, state, loading: loadingAt(MANUAL, 9000) })).toEqual({ kind: "result", request: MANUAL });
});

test("deep links, restores, retries and carrier chips show the result area from the first moment", () => {
  for (const entry of ["deepLink", "restore", "retry", "carrierChip", "autoRetryOnline"] as const) {
    const request: LookupRequest = { ...MANUAL, entry };
    expect(
      computeDisplay({ ...BASE, entry: DEEP, formOpen: false, state: loadingState(request), loading: loadingAt(request, 0) }),
      entry
    ).toEqual({ kind: "result", request });
  }
});

test("a settled or failed lookup shows the result area at once; the result slot derives its view", () => {
  const settled: LookupState = { phase: "settled", outcome: SUCCESS, settledAt: 2 };
  expect(computeDisplay({ ...BASE, state: settled })).toEqual({ kind: "result", request: MANUAL });
  const error: LookupState = { phase: "error", outcome: failure("notFound"), settledAt: 3 };
  expect(computeDisplay({ ...BASE, state: error })).toEqual({ kind: "result", request: MANUAL });
});

test("a server INVALID answer and a failed pre-check both reopen the form with the error", () => {
  const error: LookupState = { phase: "error", outcome: failure("invalidNumber"), settledAt: 3 };
  expect(computeDisplay({ ...BASE, state: error })).toEqual({ kind: "form", busy: false, invalid: { diagnosis: null, attempt: 0 } });
  const local = { diagnosis: "지금 5자리예요", attempt: 2 };
  expect(computeDisplay({ ...BASE, state: loadingState(MANUAL), loading: loadingAt(MANUAL, 500), localInvalid: local })).toEqual({
    kind: "form",
    busy: false,
    invalid: local
  });
});

test("view modes follow the display", () => {
  expect(viewModeOf({ kind: "form", busy: false, invalid: null }, "idle")).toBe("idle");
  expect(viewModeOf({ kind: "form", busy: true, invalid: null }, "loading")).toBe("loading");
  expect(viewModeOf({ kind: "form", busy: false, invalid: { diagnosis: null, attempt: 0 } }, "error")).toBe("error");
  expect(viewModeOf({ kind: "result", request: DEEP_REQUEST }, "idle")).toBe("loading");
  expect(viewModeOf({ kind: "result", request: MANUAL }, "loading")).toBe("loading");
  expect(viewModeOf({ kind: "result", request: MANUAL }, "settled")).toBe("settled");
  expect(viewModeOf({ kind: "result", request: MANUAL }, "error")).toBe("error");
});

test("the home notice survives only while it is active on the customer's clock", () => {
  const view = toNoticeView(HOME_NOTICE);
  expect(stillActiveHomeNotice(view, [HOME_NOTICE], FIXTURE_NOW.getTime())).toEqual(view);
  expect(stillActiveHomeNotice(view, [HOME_NOTICE], Date.parse(HOME_NOTICE.endsAt))).toBeNull();
  expect(stillActiveHomeNotice(view, [], FIXTURE_NOW.getTime())).toBeNull();
  expect(stillActiveHomeNotice(view, [HOME_NOTICE], null)).toEqual(view);
  expect(stillActiveHomeNotice(null, [HOME_NOTICE], FIXTURE_NOW.getTime())).toBeNull();
});
```

- [ ] **Step 2: Write the failing E2E tests**

Append to the end of `tests/e2e/result-layout.spec.ts`:

```ts
test.describe("one result area (Task 9)", () => {
  test("the lookup area says loading while the card waits and settled once the result shows", async ({ page }) => {
    const view = deriveTrackingView(success(trackData("customsWaiting")), FIXTURE_NOW, siteConfig);
    await openDeepLink(page, 1_500);
    await expect(page.locator('[data-view-state="loading"] [data-loading-stage]')).toBeVisible();
    await expect(page.locator('[data-view-state="settled"] [data-result-view="settled"]')).toBeVisible();
    await expect(page.locator("[data-number-bar]")).toContainText(view.carrier.barLabel);
  });

  test("a failed lookup reports error on the lookup area", async ({ page }) => {
    await page.clock.setFixedTime(FIXTURE_NOW);
    await blockOtherHosts(page);
    await mockTrack(page, "notFound404");
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator('[data-view-state="error"] [data-result-view="error"]')).toBeVisible();
  });

  test("focus in the lookup form downloads the result module before any lookup", async ({ page }) => {
    await blockOtherHosts(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const resultChunk = page.waitForResponse(async (response) => {
      if (response.request().resourceType() !== "script") return false;
      if (!new URL(response.url()).pathname.startsWith("/_next/")) return false;
      return (await response.text()).includes("data-primary-end");
    });
    await page.getByLabel(INPUT_LABEL, { exact: true }).focus();
    await resultChunk;
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/lookup-display.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `4 failed, 3 passed` — the idle, manual and deep-link rows receive `{ kind: "pending", … }` or `{ kind: "slot", … }` where `{ kind: "result", … }` is expected, and the settled row stops with `TypeError: Cannot read properties of undefined (reading 'key')` (the old table still reads a `derived` input). The INVALID, view-mode and notice rows already pass.
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-layout.spec.ts -g "one result area"`
Expected: at least "focus in the lookup form …" fails with a test timeout (the result slot is not mounted while the form shows, so nothing preloads). The other two fail or pass depending on how Task 8 Step 8 wired the interim display; record which.

- [ ] **Step 4: Replace the display table**

Replace the whole content of `components/lookup/lookup-display.ts` with:

```ts
/**
 * What the lookup island shows (spec §3 "화면 모드는 컴포넌트 상태", §5 시간축). Pure: the island passes its state in and
 * renders the display it gets back. Modes never live in the URL (GAP1-10). Since S07 the result area (loading card, result,
 * failure card) is one display: ResultSlot derives the view itself when the lookup settles.
 */
import type { Notice } from "@/lib/config/types";
import type { LookupState } from "@/lib/tracking/lookup-state";
import { activeNotices } from "@/lib/tracking/notices";
import type { LoadingViewModel, LookupRequest, NoticeView, TrackingEntry, ViewMode } from "@/lib/tracking/types";

/** The error under the input: from the client pre-check, or a server INVALID answer (diagnosis null). */
export interface InvalidInput {
  readonly diagnosis: string | null;
  /** Grows with every failed attempt so the role=alert sentence is announced again. */
  readonly attempt: number;
}

export type LookupDisplay =
  | { readonly kind: "form"; readonly busy: boolean; readonly invalid: InvalidInput | null }
  | { readonly kind: "result"; readonly request: LookupRequest };

export interface DisplayInput {
  readonly state: LookupState;
  readonly loading: LoadingViewModel | null;
  readonly entry: TrackingEntry;
  /** False only for a deep link whose form the customer has not opened. */
  readonly formOpen: boolean;
  readonly localInvalid: InvalidInput | null;
}

/**
 * form   — idle, the INVALID screen, and a manual lookup's first 0.4 s (only the button label changes, spec §5);
 * result — the number bar and the result area: a deep link before its lookup starts (first-paint loading card), any
 *          non-manual lookup from its first moment, a manual lookup from 0.4 s, and every settled or failed lookup.
 */
export function computeDisplay(input: DisplayInput): LookupDisplay {
  const { state, loading, entry, formOpen, localInvalid } = input;
  if (localInvalid !== null) return { kind: "form", busy: false, invalid: localInvalid };
  switch (state.phase) {
    case "idle":
      if (!formOpen && entry.kind === "deepLink") {
        return { kind: "result", request: { number: entry.number, carrier: entry.carrier, entry: "deepLink" } };
      }
      return { kind: "form", busy: false, invalid: null };
    case "loading":
      if ((loading?.stage ?? "instant") === "instant" && state.request.entry === "manual") {
        return { kind: "form", busy: true, invalid: null };
      }
      return { kind: "result", request: state.request };
    case "error":
      if (state.outcome.cause === "invalidNumber") return { kind: "form", busy: false, invalid: { diagnosis: null, attempt: 0 } };
      return { kind: "result", request: state.outcome.request };
    case "settled":
      return { kind: "result", request: state.outcome.request };
  }
}

export function viewModeOf(display: LookupDisplay, phase: LookupState["phase"]): ViewMode {
  if (display.kind === "form") {
    if (display.invalid !== null) return "error";
    return display.busy ? "loading" : "idle";
  }
  if (phase === "settled") return "settled";
  return phase === "error" ? "error" : "loading";
}

/**
 * '/' is static and cached for up to 5 minutes, so the server-picked home notice may already have ended by the time the
 * customer sees it. After mount it survives only while it is still active at the customer's clock (spec §9 "'/'는
 * 마운트 뒤 KST로 다시 걸러"). `nowMs` is null while hydrating: the server pick is kept so the HTML matches.
 */
export function stillActiveHomeNotice(notice: NoticeView | null, all: readonly Notice[], nowMs: number | null): NoticeView | null {
  if (notice === null || nowMs === null) return notice;
  return activeNotices(all, new Date(nowMs), { kind: "home" }).some((item) => item.id === notice.id) ? notice : null;
}
```

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/lookup-display.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `7 passed`. (`npm run typecheck` fails until Step 5 — `LookupController.tsx` still names the removed kinds.)

- [ ] **Step 5: Mount the result area once in `LookupController`**

Work in `components/lookup/LookupController.tsx`.

(a) Imports. From the `@/components/lookup/lookup-display` import remove `outcomeKey` and `type DerivedView` (keep `computeDisplay`, `stillActiveHomeNotice`, `viewModeOf`, `type InvalidInput` and whatever else is still used). Delete the import of `PendingCard` and any remaining import from `@/components/lookup/LegacyResultSection`. Keep `useState` in the `react` import.

(b) Directly below the imports' last line add:

```tsx
/** The settled view that is on screen, keyed by the settle it belongs to, so the next lookup never shows its carrier label. */
interface SettledViewRecord {
  readonly settledAt: number;
  readonly view: TrackingViewModel;
}
```

(c) Replace the `computeDisplay(...)` call with `computeDisplay({ state, loading, entry, formOpen, localInvalid })` — or, when the file contains `ReplayFrame` (S06 Task 5 Step 12 shipped the same-address entry), with `computeDisplay({ state: shownState, loading, entry, formOpen, localInvalid })`.

(d) Replace Task 8's `const [settledView, setSettledView] = useState<TrackingViewModel | null>(null);` and its `handleView` function with:

```tsx
  const [settledView, setSettledView] = useState<SettledViewRecord | null>(null);

  // ResultSlot calls this once per settled view, after it is on screen (Task 8, Additions item 2).
  const handleView = (view: TrackingViewModel): void => {
    if (state.phase !== "settled" && state.phase !== "error") return;
    setSettledView({ settledAt: state.settledAt, view });
    setAdSignals({ resultAdsAllowed: view.revenue.adsAllowed });
  };

  const currentView =
    settledView !== null && (state.phase === "settled" || state.phase === "error") && settledView.settledAt === state.settledAt
      ? settledView.view
      : null;
```

When the file contains `ReplayFrame`, write `shownState` instead of `state` in these eight lines, and move into `handleView`, directly after `setAdSignals(…)`, the two statements that record the screen for Forward and push the history entry (delete them wherever Task 8 left them):

```tsx
    if (!replaying) lastShownRef.current = { state: shownState };
    if (manualPendingRef.current) {
      manualPendingRef.current = false;
      pushLookupHistoryEntry();
    }
```

and change the `ReplayFrame` interface to `interface ReplayFrame { readonly state: Extract<LookupState, { readonly phase: "settled" | "error" }>; }` (the result slot re-derives a replayed screen from its state). Inside `handleView` the narrowed `shownState.phase` check above already makes `{ state: shownState }` a valid `ReplayFrame`.

(e) Replace the statement that starts with `const carrierLabel =` with:

```tsx
  const carrierLabel =
    currentView?.carrier.barLabel ??
    (activeRequest === null ? "" : requestCarrierView(activeRequest, lookupConfig.copy.carrierAuto).barLabel);
```

(f) Replace the statement that starts with `const loadingLike =` with:

```tsx
  // The first-paint card of a deep link (idle) and every loading stage keep the result area's reserved height (S06 CLS budget).
  const loadingLike = display.kind === "result" && state.phase !== "settled" && state.phase !== "error";
```

(use `shownState.phase` in place of `state.phase` in the `ReplayFrame` variant).

(g) Replace the whole expression that renders the result area — it starts with `{display.kind === "form" ? null : (` and contains `aria-busy` and `<ResultSlot` (S06 Task 5 Step 11, edited by Task 8 Step 8) — with:

```tsx
        {/* Always mounted: while the form shows it renders nothing, but focus in the form preloads the result module. */}
        <div
          data-result-area="true"
          aria-busy={loadingLike || undefined}
          className={display.kind === "form" ? "contents" : loadingLike ? "min-h-[560px]" : undefined}
        >
          <ResultSlot
            entry={entry}
            loadingConfig={LOADING_CONFIG}
            state={state}
            loading={loading}
            onAction={handleAction}
            headingRef={headingRef}
            onView={handleView}
            renderRecommendations={renderRecommendations}
          />
        </div>
```

using LookupController's own names for the four identifiers Task 8 Step 8 (e) listed (`entry`, `LOADING_CONFIG`, `handleAction`, `headingRef`), and `state={shownState}` in the `ReplayFrame` variant.

Run: `Select-String -Path components/lookup/LookupController.tsx -Pattern '"pending"|"slot"|derived|outcomeKey|PendingCard|LegacyResultSection|getLoadedLegacyDeriver'`
Expected: no output.
Run: `if (Test-Path .next) { Remove-Item -Recurse -Force .next }; npm run typecheck; npm run lint`
Expected: both exit 0. If lint reports `react-hooks/refs` for `lastShownRef`/`manualPendingRef` inside `handleView`, it is a callback the compiler cannot prove is an event handler: wrap `handleView` in `useEffectEvent` (React 19.2+, already used by `ResultSlot`) — `const handleView = useEffectEvent((view: TrackingViewModel): void => { … });` — and run lint again.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/lookup-display.spec.ts tests/unit/module-boundaries.spec.ts tests/unit/result-module.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed.
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-layout.spec.ts tests/e2e/result-states.spec.ts tests/e2e/deep-link.spec.ts tests/e2e/home.spec.ts tests/e2e/lookup-input.spec.ts`
Expected: 0 failed (production-only tests skipped). `result-layout.spec.ts` now has 9 tests; `result-states.spec.ts` "offline: …" passes because focus in the form preloaded the module; S06's deep-link and home tests pass unchanged (the first paint of a deep link is `ResultSlot`'s `LoadingCard` with the same '조회하고 있어요' heading inside the same `min-h-[560px]` area).

- [ ] **Step 7: Commit**

```powershell
git add components/lookup/lookup-display.ts tests/unit/lookup-display.spec.ts components/lookup/LookupController.tsx tests/e2e/result-layout.spec.ts
git commit -m "refactor: mount one result area in the lookup island and key the number bar label to its settle"
```

**Part B — page layout of the result modes**

- [ ] **Step 8: Write the layout tests**

In `tests/e2e/result-layout.spec.ts`:
(a) replace `import { success } from "../fixtures/derive-scenarios";` with

```ts
import { OCTOBER_NOW, customsWaitingData, failure, inTransitData, success } from "../fixtures/derive-scenarios";
```

(b) replace `import { FAKE, FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";` with

```ts
import { FAKE, FIXTURE_NOW, mockTrack, trackData, type FailureFixture } from "../fixtures/tracking-fixtures";
```

(c) directly below `import { deriveTrackingView } from "@/lib/tracking/derive-view";` add

```ts
import type { LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";
```

(d) append to the end of the file:

```ts
interface LiveScene {
  readonly key: string;
  readonly reply: TrackResponseData | FailureFixture;
  readonly outcome: LookupOutcome;
  readonly now: Date;
}

const OVERDUE_NOW = new Date("2026-09-29T09:00:00+09:00");
/** Spec §6 / S05 Addition 5: header 48 + number bar 56 + status field ≤ 300 + gap 16 → 지금 할 일 starts by 420 px at 375×812. */
const NEXT_ACTION_TOP_MAX = 420;

function scene(key: string, data: TrackResponseData, now: Date = FIXTURE_NOW): LiveScene {
  return { key, reply: data, outcome: success(data), now };
}

const IN_TRANSIT = scene("inTransit", inTransitData(), OCTOBER_NOW);
const DELIVERED = scene("delivered", trackData("delivered"));
/** The §7 rows as a deep link shows them (the 8 key states of spec §13 plus the carrier-delay and NOT_FOUND rows). */
const KEY_SCENES: readonly LiveScene[] = [
  scene("pending", trackData("pending")),
  scene("customsWaiting", trackData("customsWaiting")),
  scene("customsCleared", trackData("customsCleared")),
  IN_TRANSIT,
  DELIVERED,
  scene("overdue", customsWaitingData(), OVERDUE_NOW),
  scene("stale", trackData("stale")),
  scene("lookupUnavailable", trackData("lookupUnavailableCarrier")),
  scene("ambiguous", trackData("ambiguous")),
  { key: "notFound", reply: "notFound404", outcome: failure("notFound"), now: FIXTURE_NOW }
];

function viewOf(item: LiveScene): TrackingViewModel {
  return deriveTrackingView(item.outcome, item.now, siteConfig);
}

/** Opens the scene as a deep link and waits for its status heading (the page clock reads the scene's `now`). */
async function openScene(page: Page, item: LiveScene): Promise<void> {
  await page.clock.setFixedTime(item.now);
  await blockOtherHosts(page);
  await mockTrack(page, item.reply);
  await page.goto(`/${typeof item.reply === "string" ? FAKE.domestic : item.reply.trackingNumber}`);
  await expect(page.locator("[data-result-view] h2")).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function bottomOf(page: Page, selector: string): Promise<number> {
  const box = await page.locator(selector).first().boundingBox();
  return box === null ? Number.POSITIVE_INFINITY : box.y + box.height;
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test.describe("result page layout (Task 9)", () => {
  test("the live result keeps the fixed order, with no store, ad or recommendation before the primary end", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openScene(page, IN_TRANSIT);
    const chain = [
      "[data-number-bar]",
      "[data-result-view] h2",
      '[data-result-view] [data-slot="eta"]',
      "[data-result-view] [data-cta-state]",
      "[data-result-view] [data-last-event]",
      "[data-result-view] [data-primary-end]"
    ];
    const outOfOrder = await page.evaluate((selectors) => {
      const nodes = selectors.map((selector) => document.querySelector(selector));
      return selectors.filter((selector, index) => {
        const node = nodes[index] ?? null;
        if (node === null) return true;
        const previous = index === 0 ? null : (nodes[index - 1] ?? null);
        return previous !== null && (previous.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) === 0;
      });
    }, chain);
    expect(outOfOrder).toEqual([]);
    const between = await page.evaluate(() => {
      const start = document.querySelector("[data-number-bar]");
      const end = document.querySelector("[data-result-view] [data-primary-end]");
      if (start === null || end === null) return -1;
      return Array.from(document.querySelectorAll("[data-recommended-products], [data-ad-slot], ins.adsbygoogle, [data-affiliate-group]")).filter(
        (node) =>
          (start.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 &&
          (node.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      ).length;
    });
    expect(between).toBe(0);
  });

  test("375×812: status, ETA and 지금 할 일 are in the first view in every key state", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 375, height: 812 });
    for (const item of KEY_SCENES) {
      const view = viewOf(item);
      await openScene(page, item);
      expect(await bottomOf(page, "[data-result-view] h2"), `${item.key}: status`).toBeLessThanOrEqual(812);
      if (view.eta.kind !== "none") {
        expect(await bottomOf(page, '[data-result-view] [data-slot="eta"]'), `${item.key}: ETA`).toBeLessThanOrEqual(812);
      }
      const cta = page.locator("[data-result-view] [data-cta-state]");
      const sentence = await cta.getByText(view.nextAction.sentence, { exact: true }).boundingBox();
      const top = (await cta.boundingBox())?.y ?? Number.POSITIVE_INFINITY;
      // Printed for the stage gate (G8).
      console.info(`[budget] 지금 할 일 top at 375x812 (${item.key}): ${Math.round(top)} px`);
      expect(sentence === null ? Number.POSITIVE_INFINITY : sentence.y + sentence.height, `${item.key}: 지금 할 일`).toBeLessThanOrEqual(812);
    }
  });

  test("B field cap: in plain states the status field fits --tt-status-field-max and 지금 할 일 starts by 420 px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    for (const item of [IN_TRANSIT, DELIVERED]) {
      await openScene(page, item);
      const fieldMax = await page.evaluate(() =>
        Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tt-status-field-max"))
      );
      const field = await page.locator('[data-result-view] [data-slot="status-head"]').boundingBox();
      const cta = await page.locator("[data-result-view] [data-cta-state]").boundingBox();
      const height = field?.height ?? Number.POSITIVE_INFINITY;
      const top = cta?.y ?? Number.POSITIVE_INFINITY;
      // Printed for the stage gate (G8).
      console.info(
        `[budget] status field at 375x812 (${item.key}): ${Math.round(height)} px (max ${fieldMax} px); 지금 할 일 top ${Math.round(top)} px (max ${NEXT_ACTION_TOP_MAX} px)`
      );
      expect(fieldMax).toBe(300);
      expect(height, item.key).toBeLessThanOrEqual(fieldMax);
      expect(top, item.key).toBeLessThanOrEqual(NEXT_ACTION_TOP_MAX);
    }
  });

  test("desktop 1440: the 560 px result and the 320 px side column sit side by side under the number bar; '/' stays one 560 px column", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openScene(page, IN_TRANSIT);
    const bar = await page.locator("[data-number-bar]").boundingBox();
    const main = await page.locator("[data-result-main]").boundingBox();
    const side = await page.locator("[data-side-column]").boundingBox();
    expect(Math.round(main?.width ?? 0)).toBe(560);
    expect(Math.round(side?.width ?? 0)).toBe(320);
    expect(side?.x ?? 0).toBeGreaterThan((main?.x ?? 0) + (main?.width ?? 0));
    expect(Math.abs((side?.y ?? 0) - (main?.y ?? 0))).toBeLessThanOrEqual(1);
    expect((bar?.y ?? 0) + (bar?.height ?? 0)).toBeLessThanOrEqual((main?.y ?? 0) + 1);
    await expect(page.locator("[data-history-recent]")).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await page.goto("/");
    const idle = await page.locator('[data-view-state="idle"]').boundingBox();
    expect(Math.round(idle?.width ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(560);
  });

  test("320 px: no horizontal scroll in pending, delivered, ambiguous and NOT_FOUND results", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 320, height: 800 });
    for (const item of KEY_SCENES.filter((candidate) => ["pending", "delivered", "ambiguous", "notFound"].includes(candidate.key))) {
      await openScene(page, item);
      expect(await horizontalOverflow(page), item.key).toBeLessThanOrEqual(0);
    }
  });
});
```

- [ ] **Step 9: Run them to verify the desktop test fails**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-layout.spec.ts -g "result page layout"`
Expected: FAIL — `1 failed, 4 passed` at least: the desktop test receives a main column of about `208` instead of `560` (the grid is squeezed into S06's 560 px `<main>`). The B field cap test may also fail by the 16 px gap S06 puts between the number bar and the result; record its `[budget]` line either way.

- [ ] **Step 10: Give the result modes their section class**

In `components/lookup/LookupController.tsx`:
(a) below the `SettledViewRecord` interface (Step 5 b) add

```tsx
/** Form modes: S06's lookup column (keep the class S06 shipped; Task 7 Step 6 may have shortened its gap). */
const SECTION_FORM_CLASS = "flex flex-col gap-4 pb-6";
/**
 * Result modes: the status field sits right under the number bar (no gap: S05 Addition 5, header 48 + number bar 56 + field
 * ≤ 300 + 16 → 지금 할 일 by 420 px at 375×812). From 1024 px the section reaches past the 560 px main column on both sides
 * by (320 px + 2rem) / 2, so the result grid gets 560 + 320 px while '/' stays one 560 px column (spec §3, §4).
 */
const SECTION_RESULT_CLASS = "flex flex-col bg-tt-surface pb-6 lg:-mx-[calc((var(--tt-side)_+_2rem)/2)]";
```

If the `<section id="tracking" …>` element's `className` is not exactly `"flex flex-col gap-4 pb-6"` (S06 Task 7 Step 6 may have changed `gap-4` to `gap-3`), write its current value into `SECTION_FORM_CLASS` instead.

(b) on the `<section id="tracking" …>` element replace its `className="…"` attribute with

```tsx
        className={display.kind === "form" ? SECTION_FORM_CLASS : SECTION_RESULT_CLASS}
```

Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 11: Run the tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-layout.spec.ts tests/e2e/result-states.spec.ts tests/e2e/result-kit.spec.ts tests/e2e/home.spec.ts tests/e2e/deep-link.spec.ts`
Expected: 0 failed; `result-layout.spec.ts` `14 passed`. Copy the `[budget] 지금 할 일 top …` (10 lines) and `[budget] status field …` (2 lines) into the stage summary.
If the B field cap test still fails, do not clip text (`max-height` is forbidden, S05 Addition 5). Read the printed field height, then in `components/result/StatusCard.tsx` change the chip/title wrapper `className="flex flex-col items-start gap-2"` to `className="flex flex-col items-start gap-1.5"` and re-run once. If it still exceeds, stop and report the measured heights in the stage summary: the remaining lever is the length of `stateGuide.<key>.reason` copy in `config/site.config.ts`, which is the operator's call.
Run: `Select-String -Path components/lookup/LookupController.tsx -Pattern 'SECTION_RESULT_CLASS|data-result-area'`
Expected: three lines (the constant, its use, the wrapper).

- [ ] **Step 12: Run the whole suite in dev mode**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test`
Expected: 0 failed. The home geometry (`[geometry]` of S06 Task 7 or 7F) is unchanged: form modes keep S06's class, and the always-mounted result area has no box while the form shows (`display: contents`).

- [ ] **Step 13: Commit**

```powershell
git add components/lookup/LookupController.tsx tests/e2e/result-layout.spec.ts
git commit -m "feat: lay the live result out under the number bar with the desktop two-column grid"
```

(Add `components/result/StatusCard.tsx` if Step 11 changed it.)

---

### Task 10: The approval-3 fallback moves into the result module; the legacy result UI is deleted

S04 kept the ledger fallbacks in `components/status-slot/status-view.ts` (`deriveStatusView` = `deriveTrackingView` + `applyApprovalFallbacks`), and every S04 E2E computes its expectations with it (S04 contract deviation 1: "S07's `FailureCard` must make the same ledger decision"). Task 8 switched the page to `deriveTrackingView` alone, so while approval 3 is not granted the R3 page would show the approval-3 weights without the approval. Part A (Steps 1–7) moves the talk-first transform into the lazy result module with a ledger-checked flag and points S04's tests at it; approval 2 is granted (Task 0 Step 7), so S04's wording overlay is retired, not moved. Part B (Steps 8–13) deletes every legacy result file. When the stage summary says "Task 10 Part A done in Task 8" (Task 8 Step 11 found an S04 fallback still active), start at Step 8.

**Files:**
- Create: `components/result/approvals.ts`
- Modify: `components/result/result-module.ts` (one export line)
- Modify: `components/result/ResultSlot.tsx` (one line in the settle effect)
- Modify: `components/result/FailureCard.tsx` (one doc-comment line)
- Modify: `tests/e2e/status-slot.spec.ts`, `tests/e2e/failure-causes.spec.ts`, `tests/e2e/cta-consistency.spec.ts` (the import of the rendered view; identifiers)
- Modify: `tests/e2e/result-states.spec.ts` (one import line, one describe block)
- Modify: `tests/e2e/RULE-MAP.md` (three rows)
- Modify: `tests/unit/result-module.spec.ts` (fs import line, one test)
- Delete: `components/status-slot/` (all of it: S04's `StatusSlot.tsx`, `status-view.ts`, `SlotParts.tsx`, `ResultSummary.tsx`, `WorryLine.tsx`, `CopyInquiryButton.tsx` and the transitional `LoadingTimeline.tsx`, `FailureNotice.tsx` Tasks 6–7 restored), `components/lookup/LegacyResultSection.tsx`, `components/lookup/PendingCard.tsx`, `components/CustomerCta.tsx`, `components/CustomsTimeline.tsx`, `components/DeliveryTimeline.tsx`, `components/TimelineStep.tsx`, `components/ReturnLinkButton.tsx`, `tests/unit/status-view.spec.ts`
- Test: `tests/unit/result-approvals.spec.ts` (create)

**Interfaces:**
- Consumes: `deriveTrackingView` (S03), `siteConfig` (config), `ActionKind`, `LookupOutcome`, `TrackingViewModel` (S03 types); `loadResultModule` (Task 1); the roadmap §4 ledger row 3; S04's test files as listed in Task 0 Step 10; fixtures `OCTOBER_NOW`, `customsWaitingData`, `failure`, `inTransitData`, `success` (S03), `FIXTURE_NOW` (S01).
- Produces: `interface ResultApprovals { readonly approval3: boolean }`; `RESULT_APPROVALS: ResultApprovals` (`{ approval3: false }` while the ledger says `pending`; Task 13 flips it); `applyResultApprovals(view: TrackingViewModel, approvals: ResultApprovals): TrackingViewModel` (returns the same object when approval 3 is granted or the view is not an error with a recovery primary); `deriveResultView(outcome: LookupOutcome, now: Date): TrackingViewModel` — the exact view the customer page renders, exported by `result-module.ts` next to the contract's three names and used by `ResultSlot`. After Part B no file under `app`, `components`, `lib` or `tests` imports a legacy result file.

**Part A — the approval-3 decision in the result module**

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/result-approvals.spec.ts` (the five "approval 3 pending" rows are S04's `tests/unit/status-view.spec.ts` rows with `applyApprovalFallbacks(view, ONLY_APPROVAL_2)` → `applyResultApprovals(view, PENDING)`; if the repository copy of those five rows differs from the code below — S04 may have adjusted an expectation while executing — keep the repository's expectations, they are what R2 shipped):

```ts
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { RESULT_APPROVALS, applyResultApprovals, deriveResultView, type ResultApprovals } from "@/components/result/approvals";
import { loadResultModule } from "@/components/result/load-result-module";
import { siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import type { LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";
import { OCTOBER_NOW, customsWaitingData, failure, inTransitData, success } from "../fixtures/derive-scenarios";
import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";

const PENDING: ResultApprovals = { approval3: false };
const APPROVED: ResultApprovals = { approval3: true };

const base = (outcome: LookupOutcome, now: Date = FIXTURE_NOW): TrackingViewModel => deriveTrackingView(outcome, now, siteConfig);

test("RESULT_APPROVALS follows approval 3 in the roadmap ledger", () => {
  const ledger = readFileSync(path.join(process.cwd(), "docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md"), "utf8");
  const status = /^\| 3 \| [^|]+\| (\w+) \|/m.exec(ledger)?.[1];
  expect(status, "approval 3 row not found in roadmap §4").toBeTruthy();
  expect(RESULT_APPROVALS.approval3).toBe(status === "approved");
});

test("with approval 3 the view passes through untouched", () => {
  for (const outcome of [success(customsWaitingData()), failure("notFound"), failure("clientTimeout")]) {
    const view = base(outcome);
    expect(applyResultApprovals(view, APPROVED)).toBe(view);
  }
});

test("deriveResultView is deriveTrackingView plus the ledger's approval-3 decision, and the lazy module exports it", async () => {
  const outcome = failure("notFound");
  expect(deriveResultView(outcome, FIXTURE_NOW)).toEqual(applyResultApprovals(base(outcome), RESULT_APPROVALS));
  expect((await loadResultModule()).deriveResultView).toBe(deriveResultView);
});

test.describe("approval 3 pending: 톡톡 is the filled primary on error screens", () => {
  test("NOT_FOUND: 톡톡 leads and [번호 수정] becomes a secondary", () => {
    const view = applyResultApprovals(base(failure("notFound")), PENDING);
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
    const view = applyResultApprovals(base(failure("clientTimeout")), PENDING);
    expect(view.nextAction.primary?.kind).toBe("talk");
    expect(view.nextAction.secondary.map((action) => [action.kind, action.weight])).toEqual([
      ["retry", "secondary"],
      ["fixNumber", "secondary"]
    ]);
  });

  test("429 keeps the countdown on the demoted [다시 조회]", () => {
    const view = applyResultApprovals(base(failure("rateLimited")), PENDING);
    expect(view.nextAction.secondary[0]).toMatchObject({
      kind: "retry",
      weight: "secondary",
      cooldownSeconds: siteConfig.lookup.rateLimitCooldownSeconds
    });
  });

  test("server errors and a second failure in a row keep copy-and-talk", () => {
    for (const outcome of [failure("serverError"), failure("network", { consecutiveFailures: 2 })]) {
      const view = base(outcome);
      expect(applyResultApprovals(view, PENDING)).toBe(view);
    }
  });

  test("result views are never touched by the approval-3 fallback", () => {
    const view = base(success(inTransitData()), OCTOBER_NOW);
    expect(applyResultApprovals(view, PENDING)).toBe(view);
  });
});
```

- [ ] **Step 2: Write the failing live-page test**

In `tests/e2e/result-states.spec.ts`, directly below `import { expect, test, type Locator, type Page, type Route } from "@playwright/test";` add

```ts
import { RESULT_APPROVALS } from "@/components/result/approvals";
```

and append to the end of the file:

```ts
test.describe("approval 3 on the live page (ledger decision)", () => {
  for (const fixture of ["notFound404", "upstreamTimeout504"] as const) {
    test(`${fixture}: the error screen follows the approval-3 decision in the ledger`, async ({ page }) => {
      await openDeepLink(page, fixture);
      const card = resultCard(page);
      await expect(card).toHaveAttribute("data-failure-cause", /\w+/);
      const firstLink = page.locator('[data-cta-state="error"] a[href]').first();
      await expect(firstLink).toHaveAttribute("href", TALK_URL);
      const recovery = card.locator('[data-recovery] [data-slot="button"]');
      await expect(recovery.first()).toBeVisible();
      if (RESULT_APPROVALS.approval3) {
        // Spec §16 item 3 proposal: the cause's recovery action leads the card; 톡톡 stays the error block's first link.
        await expect(recovery.first()).toHaveAttribute("data-variant", "primary");
        await expect(firstLink).not.toHaveAttribute("data-variant", "primary");
      } else {
        // Roadmap §4 row 3 fallback: 톡톡 is the filled primary; [번호 수정]/[다시 조회] are secondary.
        await expect(firstLink).toHaveAccessibleName(TALK_NAME);
        await expect(firstLink).toHaveAttribute("data-variant", "primary");
        await expect(card.locator('[data-slot="button"][data-variant="primary"]')).toHaveCount(1);
        const variants = await recovery.evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-variant")));
        expect(variants.every((variant) => variant === "secondary")).toBe(true);
      }
    });
  }
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/result-approvals.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading — `Error: Cannot find module '@/components/result/approvals'` (0 tests run).
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-states.spec.ts -g "approval 3 on the live page"`
Expected: FAIL while loading the file with the same missing-module error.

- [ ] **Step 4: Write the approvals module and render its view**

Create `components/result/approvals.ts`:

```ts
import { siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import type { ActionKind, LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";

/**
 * Roadmap §4 ledger values the result area needs. tests/unit/result-approvals.spec.ts fails when this and the ledger
 * disagree; Task 13 of the S07 plan flips approval3 when the operator records approval 3. Lazy chunk only (it pulls in
 * deriveTrackingView): reached through result-module.ts.
 */
export interface ResultApprovals {
  /** 승인 3: the cause's recovery action leads error screens. Until then 톡톡 is the filled primary and [번호 수정]/[다시 조회] are secondary. */
  readonly approval3: boolean;
}

/** Approval 3 is pending in roadmap §4 → fallback (spec §16 item 3 "거절하면"). */
export const RESULT_APPROVALS: ResultApprovals = { approval3: false };

const RECOVERY_KINDS: ReadonlySet<ActionKind> = new Set<ActionKind>(["fixNumber", "retry"]);

/** Approval-3 fallback: 톡톡 becomes the filled primary; the recovery action moves to the secondaries (as S04's R2 slot did). */
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

export function applyResultApprovals(view: TrackingViewModel, approvals: ResultApprovals): TrackingViewModel {
  return approvals.approval3 ? view : withTalkFirst(view);
}

/** The view the customer page renders for a settled lookup; `now` is the client's clock when it settled (spec §6 overdue). */
export function deriveResultView(outcome: LookupOutcome, now: Date): TrackingViewModel {
  return applyResultApprovals(deriveTrackingView(outcome, now, siteConfig), RESULT_APPROVALS);
}
```

In `components/result/result-module.ts`, append the line:

```ts
export { deriveResultView } from "./approvals";
```

In `components/result/ResultSlot.tsx` replace

```tsx
        if (active) setShown({ state, view: module.deriveTrackingView(state.outcome, now, module.siteConfig), module });
```

with

```tsx
        if (active) setShown({ state, view: module.deriveResultView(state.outcome, now), module });
```

In `components/result/FailureCard.tsx` replace the doc-comment line

```tsx
 * Weights come from the view, so the approval-3 fallback is a config change only.
```

with

```tsx
 * Weights come from the view; the approval-3 fallback is applied to that view by deriveResultView (approvals.ts).
```

- [ ] **Step 5: Point S04's E2E expectations at the view the page renders**

With the Edit tool:
1. In `tests/e2e/status-slot.spec.ts` and `tests/e2e/cta-consistency.spec.ts` replace `import { deriveStatusView } from "@/components/status-slot/status-view";` with `import { deriveResultView } from "@/components/result/approvals";`, then replace every `deriveStatusView(` with `deriveResultView(` (replace_all).
2. In `tests/e2e/failure-causes.spec.ts` replace `import { STATUS_SLOT_APPROVALS, deriveStatusView } from "@/components/status-slot/status-view";` with `import { RESULT_APPROVALS, deriveResultView } from "@/components/result/approvals";`, then replace every `STATUS_SLOT_APPROVALS.approval3` with `RESULT_APPROVALS.approval3`, every `STATUS_SLOT_APPROVALS.approval2` (if S04 Task 10 left any) with `true` (approval 2 is granted — Task 0 Step 7), and every `deriveStatusView(` with `deriveResultView(` (replace_all each).
3. If S04's approval-2 task (S04 Task 10) ran, `tests/e2e/status-slot.spec.ts` imports `import { LEGACY_RESULT_COPY, deriveStatusView } from "@/components/status-slot/status-view";` instead of the line in item 1: replace that line with `import { deriveResultView } from "@/components/result/approvals";`, and in its test "approval 2: results show the configured wording, with no pre-renewal overlay" replace `LEGACY_RESULT_COPY.customsWaitingTitle` with `"통관대기"` and `LEGACY_RESULT_COPY.sentences.customsWaiting` with `"정상 통관 대기 상태입니다. 지금은 별도 문의 없이 조금만 기다려 주세요."` — the values of S04's `LEGACY_RESULT_COPY`, which the page must still never show; the assertions and their expected values stay as they are.
4. If Task 0 Step 10 listed another test that imports `@/components/status-slot/status-view`, apply the same replacements there.

Run: `Get-ChildItem -Recurse -Include *.ts tests | Select-String -Pattern 'status-slot/|STATUS_SLOT_APPROVALS|deriveStatusView' | ForEach-Object { "$($_.Path.Replace((Get-Location).Path + '\', '')):$($_.LineNumber)" }`
Expected: only `tests\unit\status-view.spec.ts` lines (deleted in Part B). `../support/status-slot` imports do not match (no slash after the name) and stay: S04's E2E helpers keep serving those four specs.

- [ ] **Step 6: Run the tests to verify they pass, and record the rule rows**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/result-approvals.spec.ts tests/unit/result-module.spec.ts tests/unit/module-boundaries.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed (`result-approvals.spec.ts` `8 passed`). If Task 0 Step 1 recorded approval 3 as `approved`, the ledger row fails here with `Expected: true, Received: false`: apply Task 13 Step 3 now, run again, and mark Task 13 "done in Task 10".
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-states.spec.ts tests/e2e/status-slot.spec.ts tests/e2e/failure-causes.spec.ts tests/e2e/cta-consistency.spec.ts tests/e2e/result-kit.spec.ts`
Expected: 0 failed; the two new live-page tests take the branch the ledger names (the fallback branch while row 3 is `pending`).
Append to the S07 table in `tests/e2e/RULE-MAP.md` (below row S07-12):

```markdown
| S07-13 | 승인 3 대기 중 오류 화면: 톡톡이 채움 주 버튼, [번호 수정]·[다시 조회]는 보조 (roadmap §4 row 3 fallback) | unit/status-view › "approval 3 pending: …" (5 tests), "ledger: approval 3 is pending" | unit/result-approvals › "approval 3 pending: …" (5 tests), "RESULT_APPROVALS follows approval 3 in the roadmap ledger"; result-states › "approval 3 on the live page …" ×2 | migrated |
| S07-14 | 승인 2 대기 중 결과 문구 유지 (roadmap §4 row 2 fallback) | unit/status-view › "approval 2 pending: …" (5 tests), "ledger: approval 2 is pending" | none — approval 2 is granted (S07 Task 0 Step 7), so the wording overlay no longer applies | retired (approval 2) |
| S07-15 | S04 E2E expectations equal the view the page renders | status-slot / failure-causes / cta-consistency specs through `deriveStatusView` | the same specs through `deriveResultView` (`deriveTrackingView` + the ledger's approval-3 decision) | migrated |
```

- [ ] **Step 7: Commit**

```powershell
git add components/result/approvals.ts components/result/result-module.ts components/result/ResultSlot.tsx components/result/FailureCard.tsx tests/unit/result-approvals.spec.ts tests/e2e/result-states.spec.ts tests/e2e/status-slot.spec.ts tests/e2e/failure-causes.spec.ts tests/e2e/cta-consistency.spec.ts tests/e2e/RULE-MAP.md
git commit -m "feat: keep the approval-3 fallback in the result module and point the S04 tests at it"
```

**Part B — delete the legacy result UI**

- [ ] **Step 8: Write the failing test**

In `tests/unit/result-module.spec.ts` replace `import { existsSync, readFileSync, statSync } from "node:fs";` with

```ts
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
```

and append to the end of the file:

```ts
/** Legacy result UI S07 deletes (roadmap File Map §10.3, S04 Addition 3, S06 Addition 2). */
const LEGACY_RESULT_PATHS: readonly string[] = [
  "components/status-slot",
  "components/lookup/LegacyResultSection.tsx",
  "components/lookup/PendingCard.tsx",
  "components/CustomerCta.tsx",
  "components/CustomsTimeline.tsx",
  "components/DeliveryTimeline.tsx",
  "components/TimelineStep.tsx",
  "components/ReturnLinkButton.tsx",
  "tests/unit/status-view.spec.ts"
];
/** An import specifier that names a legacy file (tests/support/status-slot.ts — S04's E2E helpers — is not one). */
const LEGACY_IMPORT =
  /["'](?:@\/components\/|(?:\.{1,2}\/)+)(?:[\w-]+\/)*(?:status-slot\/[\w-]+|LegacyResultSection|PendingCard|CustomerCta|CustomsTimeline|DeliveryTimeline|TimelineStep|ReturnLinkButton)["']/;

function sourceFilesUnder(directory: string): readonly string[] {
  return readdirSync(path.join(ROOT, directory), { recursive: true, encoding: "utf8" })
    .filter((entry) => /\.(ts|tsx)$/.test(entry))
    .map((entry) => path.posix.join(directory, entry.split(path.sep).join("/")));
}

test("the legacy result UI is gone and nothing imports it", () => {
  expect(LEGACY_RESULT_PATHS.filter((file) => existsSync(path.join(ROOT, file)))).toEqual([]);
  const offenders = ["app", "components", "lib", "tests"]
    .flatMap(sourceFilesUnder)
    .filter((file) => file !== "tests/unit/result-module.spec.ts" && LEGACY_IMPORT.test(readSource(file)));
  expect(offenders).toEqual([]);
});
```

- [ ] **Step 9: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/result-module.spec.ts -g "legacy result UI"; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `Expected: []`, `Received: ["components/status-slot", "components/lookup/LegacyResultSection.tsx", …]` (every path still exists).

- [ ] **Step 10: Confirm nothing outside the legacy set still uses it**

Run: `Get-ChildItem -Recurse -Include *.ts,*.tsx app, components, lib, tests | Select-String -Pattern 'status-slot/|LegacyResultSection|PendingCard|CustomerCta|CustomsTimeline|DeliveryTimeline|TimelineStep|ReturnLinkButton' | ForEach-Object { "$($_.Path.Replace((Get-Location).Path + '\', '')):$($_.LineNumber)" }`
Expected: lines only inside the files listed in `LEGACY_RESULT_PATHS` (they import each other) and the new test itself. In any other file, a line that only mentions a name in a comment is fine (reword the comment if it now misleads); an import or JSX use (for example in `components/InternalCsHelper.tsx` or an `app/` page) is a consumer this plan does not know: stop and name it in the stage summary.

- [ ] **Step 11: Delete the files**

Run: `git rm -r -q components/status-slot components/lookup/LegacyResultSection.tsx components/lookup/PendingCard.tsx components/CustomerCta.tsx components/CustomsTimeline.tsx components/DeliveryTimeline.tsx components/TimelineStep.tsx components/ReturnLinkButton.tsx tests/unit/status-view.spec.ts`
Run: `git status --short`
Expected: only `D ` lines for those paths (plus the modified `tests/unit/result-module.spec.ts`). `lib/storefront.ts`, `components/AnimatedIcon.tsx`, `components/ui/card.tsx`, `components/RecommendedProducts.tsx` and `.tt-legacy-dark` stay: their remaining users are S08's and S09's to delete (roadmap File Map).

- [ ] **Step 12: Run everything that could notice**

Run: `if (Test-Path .next) { Remove-Item -Recurse -Force .next }; npm run typecheck; npm run lint`
Expected: both exit 0.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed (`result-module.spec.ts` `6 passed`; `tests/unit/status-view.spec.ts` no longer exists).
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test`
Expected: 0 failed, including S02's `return-link.spec.ts` (the button is `ReturnLinkAction` since Task 8) and S04's four E2E files.
Run: `npm run build`
Expected: exit 0; route table as in the gate (G4).

- [ ] **Step 13: Commit**

```powershell
git add tests/unit/result-module.spec.ts
git commit -m "refactor: delete the legacy result components and the R2 status slot"
```

(`git rm` in Step 11 already staged the deletions.)

---

### Task 11: JS budgets for `/`, the result chunk and `/{번호}`

**Files:**
- Create: `tests/budgets/js-budget.spec.ts`

**Interfaces:**
- Consumes: `IS_PRODUCTION_RUN` (S01 `tests/support/prod-mode.ts`); `FAKE`, `mockTrack`, `trackData` (S01); the always-mounted result area (Task 9: focus in `[data-lookup-form]` preloads the result module); `/privacy` as the platform floor (static page, no client code of its own).
- Produces: the S07 row of roadmap §9 as production-only tests with `[js-budget]` output lines for G8 — `'/'` initial module JavaScript (gzip -9) ≤ 175 KB fail line, 165 KB target, warning at 145 KB; the `'/'`-only part ("app") ≤ 25 KB; no zod and no result-view code in the initial chunks; the lazy result chunk ≤ 30 KB; everything a deep link loads through a settled result ≤ 195 KB. 1 KB = 1024 B (as S06's HTML budget). The counting basis is Phase 1's (`gap-GAP3/m-bytes.cjs`): module `<script src>` files of the server HTML, each compressed with gzip level 9 — 217,057 B on `/` before the renewal, platform floor 138,783 B measured on `/privacy`.

- [ ] **Step 1: Write the budget tests**

Create `tests/budgets/js-budget.spec.ts`:

```ts
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { gzipSync } from "node:zlib";
import { mockTrack, trackData } from "../fixtures/tracking-fixtures";
import { IS_PRODUCTION_RUN } from "../support/prod-mode";

/**
 * Spec §12 JS budgets: module scripts only, each file compressed with gzip level 9, 1 KB = 1024 B. The basis matches the
 * Phase 1 measurement (217,057 B on '/' before the renewal; platform floor 138,783 B on '/privacy').
 */
const KB = 1024;
const HOME_TARGET_BYTES = 165 * KB;
const HOME_FAIL_BYTES = 175 * KB;
const HOME_WARN_BYTES = 145 * KB;
const APP_MAX_BYTES = 25 * KB;
const RESULT_CHUNK_MAX_BYTES = 30 * KB;
const DEEP_LINK_MAX_BYTES = 195 * KB;
const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";
/** Text that only lazy code contains: zod (response parsing, loaded by fetchTrack) and the result view (data-primary-end). */
const LAZY_ONLY_SIGNATURES: readonly string[] = ["ZodError", "data-primary-end"];

interface ScriptTag {
  readonly src: string;
  readonly noModule: boolean;
}

interface Measured {
  readonly path: string;
  readonly raw: Buffer;
  readonly gzip: number;
}

function scriptTags(html: string): readonly ScriptTag[] {
  return Array.from(html.matchAll(/<script\b[^>]*\ssrc="([^"]+)"[^>]*>/g), (match) => ({
    src: match[1].replace(/&amp;/g, "&"),
    noModule: /\snomodule\b/i.test(match[0])
  }));
}

function pathOf(url: string): string {
  return new URL(url, "http://127.0.0.1").pathname;
}

const measured = new Map<string, Measured>();

async function measure(request: APIRequestContext, url: string): Promise<Measured> {
  const key = pathOf(url);
  const known = measured.get(key);
  if (known !== undefined) return known;
  const response = await request.get(key);
  expect(response.status(), key).toBe(200);
  const raw = await response.body();
  const item: Measured = { path: key, raw, gzip: gzipSync(raw, { level: 9 }).byteLength };
  measured.set(key, item);
  return item;
}

/** The module scripts the server HTML of `route` names (nomodule polyfills excluded). */
async function initialScripts(request: APIRequestContext, route: string): Promise<readonly Measured[]> {
  const response = await request.get(route);
  expect(response.status(), route).toBe(200);
  const tags = scriptTags(await response.text()).filter((tag) => !tag.noModule);
  return Promise.all(tags.map((tag) => measure(request, tag.src)));
}

function total(items: readonly Measured[]): number {
  return items.reduce((sum, item) => sum + item.gzip, 0);
}

function describeFiles(items: readonly Measured[]): string {
  return items.map((item) => `${item.path.split("/").pop() ?? item.path} ${item.gzip} B`).join(", ");
}

function kb(bytes: number): string {
  return `${(bytes / KB).toFixed(1)} KB`;
}

/** First-party script paths the page requests from now on. */
function recordScripts(page: Page): () => readonly string[] {
  const seen = new Set<string>();
  page.on("request", (request) => {
    if (request.resourceType() !== "script") return;
    const url = new URL(request.url());
    if (url.pathname.startsWith("/_next/")) seen.add(url.pathname);
  });
  return () => [...seen];
}

async function blockOtherHosts(page: Page): Promise<void> {
  await page.context().route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
}

test.describe("JS budgets (S07)", () => {
  test.skip(!IS_PRODUCTION_RUN, "budgets run against next start");

  test("'/' initial JavaScript stays under 175 KB with the app part at most 25 KB and no lazy-only code", async ({ request }) => {
    const home = await initialScripts(request, "/");
    const platform = await initialScripts(request, "/privacy");
    const platformPaths = new Set(platform.map((item) => item.path));
    const app = home.filter((item) => !platformPaths.has(item.path));
    const homeBytes = total(home);
    const appBytes = total(app);
    console.info(`[js-budget] platform floor ('/privacy'): ${total(platform)} B in ${platform.length} files`);
    console.info(`[js-budget] '/' initial: ${homeBytes} B = ${kb(homeBytes)} (target 165 KB, warn from 145 KB, fail above 175 KB)`);
    console.info(`[js-budget] '/' app: ${appBytes} B = ${kb(appBytes)} (max 25 KB) — ${describeFiles(app)}`);
    if (homeBytes >= HOME_WARN_BYTES) {
      test.info().annotations.push({ type: "warning", description: `'/' initial ${kb(homeBytes)} is at or above 145 KB` });
    }
    if (homeBytes > HOME_TARGET_BYTES) {
      test.info().annotations.push({ type: "warning", description: `'/' initial ${kb(homeBytes)} is above the 165 KB target` });
    }
    const lazyOnly = home.flatMap((item) =>
      LAZY_ONLY_SIGNATURES.filter((signature) => item.raw.includes(signature)).map((signature) => `${item.path}: ${signature}`)
    );
    expect(lazyOnly).toEqual([]);
    expect(homeBytes).toBeLessThanOrEqual(HOME_FAIL_BYTES);
    expect(appBytes).toBeLessThanOrEqual(APP_MAX_BYTES);
  });

  test("the lazy result chunk is at most 30 KB and arrives only when a lookup is near", async ({ page, request }) => {
    await blockOtherHosts(page);
    const scripts = recordScripts(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const before = new Set(scripts());
    const early = await Promise.all([...before].map((item) => measure(request, item)));
    expect(early.filter((item) => item.raw.includes("data-primary-end")).map((item) => item.path)).toEqual([]);
    const resultResponse = page.waitForResponse(
      async (response) => response.request().resourceType() === "script" && (await response.body()).includes("data-primary-end")
    );
    await page.getByLabel(INPUT_LABEL, { exact: true }).focus();
    await resultResponse;
    // Sibling chunks of the same dynamic import are requested together with it; give their requests a moment to register.
    await page.waitForTimeout(300);
    const chunk = await Promise.all(scripts().filter((item) => !before.has(item)).map((item) => measure(request, item)));
    const bytes = total(chunk);
    console.info(`[js-budget] result chunk: ${bytes} B = ${kb(bytes)} in ${chunk.length} file(s) (max 30 KB) — ${describeFiles(chunk)}`);
    expect(chunk.some((item) => item.raw.includes("data-primary-end"))).toBe(true);
    expect(bytes).toBeLessThanOrEqual(RESULT_CHUNK_MAX_BYTES);
  });

  test("'/{번호}' loads at most 195 KB of JavaScript through a settled result", async ({ page, request }) => {
    await blockOtherHosts(page);
    const scripts = recordScripts(page);
    const data = trackData("inTransit");
    await mockTrack(page, data);
    await page.goto(`/${data.trackingNumber}`);
    await expect(page.locator("[data-result-view]")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const initial = await initialScripts(request, `/${data.trackingNumber}`);
    const paths = new Set<string>([...initial.map((item) => item.path), ...scripts()]);
    const loaded = await Promise.all([...paths].map((item) => measure(request, item)));
    const bytes = total(loaded);
    console.info(`[js-budget] '/{번호}' through the result: ${bytes} B = ${kb(bytes)} in ${loaded.length} files (max 195 KB)`);
    expect(bytes).toBeLessThanOrEqual(DEEP_LINK_MAX_BYTES);
  });
});
```

- [ ] **Step 2: Check that the file is skipped outside production runs**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE=$null; npx playwright test tests/budgets/js-budget.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `3 skipped`, 0 failed.
Run: `npm run typecheck; npx eslint tests/budgets/js-budget.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 3: Run the budgets against the production build**

These measure what Tasks 1–10 built, so they are expected to pass on the first run; each fails when its line is crossed (a regression check, as S06's budgets).
Run: `npm run build` → exit 0. Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test tests/budgets/js-budget.spec.ts tests/budgets/html-budget.spec.ts tests/budgets/lcp-budget.spec.ts`
Expected: `3 passed` for `js-budget.spec.ts`, S06's budget files unchanged and passing. Copy the five `[js-budget]` lines into the stage summary (and any `warning` annotation).
If a line is crossed:
- `lazyOnly` is not `[]`: a static import pulls zod or the result view into the initial bundle past `tests/unit/result-module.spec.ts` and S03's `module-boundaries.spec.ts`. The failure names the chunk. To find the import, add `"components/lookup/LookupController.tsx"` to `INITIAL_BUNDLE_RESULT_FILES` in `tests/unit/result-module.spec.ts` for one run of `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/result-module.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null` — it prints every `entry → lazy-only module` pair the island reaches statically. Fix that import (never the signature list) and remove the temporary entry.
- `'/' app` above 25 KB with no lazy-only code: the printed app files are the lookup island. The known large import is the whole `config/site.config.ts` behind `stateGuide` (S06 open issue 2); passing the INVALID copy and document titles from `TrackingPage` as props changes `LookupControllerProps` (contract §11.9), so stop, record the measured sizes and propose the amendment (roadmap §5) instead of changing the contract in this stage.
- result chunk above 30 KB: move the parts of `ResultView` that render after `[data-primary-end]` — `SideColumn`, `HistoryDetails`, `DeliveredHelp`, `HelpItems` — behind `next/dynamic(() => import(…), { ssr: false })` inside `components/result/ResultView.tsx`, re-run Tasks 4–5's `result-kit` tests and this budget, and note the second lazy chunk in the stage summary.
- `'/{번호}'` above 195 KB: it is the sum of the two above plus the zod chunk `fetchTrack` loads; fix whichever part grew.
Stop the server and clear the flags (Conventions).

- [ ] **Step 4: Commit**

```powershell
git add tests/budgets/js-budget.spec.ts
git commit -m "test: lock the JS budgets for '/', the lazy result chunk and deep links"
```

---

### Task 12: Stage screens for the result rows

**Files:**
- Modify: `tests/tools/stage-screens.spec.ts` (one import line; six `SCENARIOS` entries appended — S01's tool: later stages append only)

**Interfaces:**
- Consumes: S01's tool (`StageScenario { name; path; prepare? }`, `SCENARIOS`, the clock pinned to `FIXTURE_NOW` before `prepare` runs), `FAKE`, `mockTrack`, `trackData` (S01), `customsWaitingData` (S03); the scenarios S01, S04 and S06 already appended (home, pending, customsWaiting, inTransit, delivered, NOT_FOUND, privacy, server error, 429, stale, ambiguous, INVALID deep link).
- Produces: six more scenarios for G7 — `deeplink-customsCleared`, `deeplink-pickedUp`, `deeplink-lookupUnavailable`, `deeplink-chooseCarrier`, `deeplink-carrierCut`, `deeplink-overdue`; with the existing ones they cover every settled §7 row, and the 1024/1440 px shots show the desktop two-column result.

- [ ] **Step 1: Append the scenarios**

In `tests/tools/stage-screens.spec.ts`, directly below `import { FAKE, FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";` add

```ts
import { customsWaitingData } from "../fixtures/derive-scenarios";
```

Replace S06's entry

```ts
  { name: "deeplink-invalid", path: `/${FAKE.deepLinkInvalid}` },
```

(with or without its trailing comma) with

```ts
  { name: "deeplink-invalid", path: `/${FAKE.deepLinkInvalid}` },
  // S07: result rows the earlier scenarios do not show (the 1024 and 1440 px shots show the desktop two-column result).
  {
    name: "deeplink-customsCleared",
    path: `/${trackData("customsCleared").trackingNumber}`,
    prepare: (page) => mockTrack(page, trackData("customsCleared"))
  },
  {
    name: "deeplink-pickedUp",
    path: `/${trackData("pickedUp").trackingNumber}`,
    prepare: (page) => mockTrack(page, trackData("pickedUp"))
  },
  {
    name: "deeplink-lookupUnavailable",
    path: `/${trackData("lookupUnavailableCarrier").trackingNumber}`,
    prepare: (page) => mockTrack(page, trackData("lookupUnavailableCarrier"))
  },
  {
    name: "deeplink-chooseCarrier",
    path: `/${trackData("lookupUnavailableAuto").trackingNumber}`,
    prepare: (page) => mockTrack(page, trackData("lookupUnavailableAuto"))
  },
  {
    name: "deeplink-carrierCut",
    path: `/${trackData("customsWithCarrierCut").trackingNumber}`,
    prepare: (page) => mockTrack(page, trackData("customsWithCarrierCut"))
  },
  {
    // Overdue: the tool pins FIXTURE_NOW first; this scenario moves the page clock past the worry date (9/29, KST).
    name: "deeplink-overdue",
    path: `/${FAKE.hbl}`,
    prepare: async (page) => {
      await page.clock.setFixedTime(new Date("2026-09-29T09:00:00+09:00"));
      await mockTrack(page, customsWaitingData());
    }
  },
```

If `deeplink-invalid` is not the last entry (a later branch appended more), put the S07 block after the last entry instead.

- [ ] **Step 2: Verify the tool still skips without its flags**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/tools/stage-screens.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: every test skipped, 0 failed; the count grew by 30 (six scenarios × five widths) — `90 skipped` after S01's 7, S04's 4 and S06's 1 scenario.
Run: `npm run typecheck; npx eslint tests/tools/stage-screens.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.
(The screens themselves are taken in G7 against the production build; `S07-before/` from Task 0 Step 5 has none of these six names, which is expected.)

- [ ] **Step 3: Commit**

```powershell
git add tests/tools/stage-screens.spec.ts
git commit -m "test: add the S07 result rows to the stage screens"
```

---

### Task 13 (gated by approval 3): Recovery action first on error screens

**Files:**
- Modify: `components/result/approvals.ts` (the `RESULT_APPROVALS` line and its comment)
- Modify: `tests/e2e/RULE-MAP.md` (row S07-13 status, one new row)

**Interfaces:**
- Consumes: roadmap §4 row 3; `RESULT_APPROVALS` and its ledger test (Task 10); the ledger-aware live-page tests (Task 10 Step 2) and S04's `failure-causes.spec.ts` (`RESULT_APPROVALS.approval3 ? "fixNumber" : "talk"`).
- Produces: `RESULT_APPROVALS = { approval3: true }` — `deriveResultView` passes S03's view through, so the cause's recovery action (`stateGuide.<errorKey>.primaryAction`: [번호 수정] for NOT_FOUND, [다시 조회] for 일시 지연·오프라인·응답 없음, [문의 내용 복사하고 톡톡 열기] for SERVER_ERROR) is the filled primary in the status card while 톡톡 stays the error block's first link.

- [ ] **Step 1: Confirm approval 3 is recorded in the roadmap approval ledger; if not, stop**

Run: `Select-String -LiteralPath docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md -Pattern "^\| 3 \|"`
Expected to continue: the row reads `| 3 | Error rule wording (recovery action first, 톡톡 first link) | approved | …`.
If the Status is `pending` or `rejected`: stop here and mark Task 13 SKIPPED in the stage summary with this reason — "approval 3 is <status>; S07 ships the spec §16 item 3 fallback '오류 화면에서 톡톡을 채움색 주 버튼으로 두고 [번호 수정]·[다시 조회]는 보조로 내립니다' through `RESULT_APPROVALS = { approval3: false }` (Task 10), asserted by `tests/unit/result-approvals.spec.ts` and `tests/e2e/result-states.spec.ts` › 'approval 3 on the live page …'. When approval 3 is granted later, only this task is re-opened (roadmap §4)." (If Task 10 Step 6 already applied Step 3 because the ledger said `approved` at that time, mark this task "done in Task 10" and go to Step 5.)

- [ ] **Step 2: See the ledger test fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/result-approvals.spec.ts -g "follows approval 3"; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `Expected: true`, `Received: false`.

- [ ] **Step 3: Flip the flag**

In `components/result/approvals.ts` replace

```ts
/** Approval 3 is pending in roadmap §4 → fallback (spec §16 item 3 "거절하면"). */
export const RESULT_APPROVALS: ResultApprovals = { approval3: false };
```

with

```ts
/** Approval 3 is recorded in roadmap §4: the cause's recovery action leads the error card (spec §16 item 3). */
export const RESULT_APPROVALS: ResultApprovals = { approval3: true };
```

- [ ] **Step 4: Run the tests**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/result-approvals.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `8 passed` (the five fallback rows call `applyResultApprovals` with an explicit `PENDING` and keep documenting the fallback).
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-states.spec.ts tests/e2e/failure-causes.spec.ts tests/e2e/status-slot.spec.ts tests/e2e/result-kit.spec.ts`
Expected: 0 failed; "approval 3 on the live page …" now takes the approved branch (the first recovery button is `data-variant="primary"`, the 톡톡 link is not), and every "… 톡톡 first …" test still passes.

- [ ] **Step 5: Record the rule and commit**

In `tests/e2e/RULE-MAP.md` set the Status of row S07-13 to `superseded (approval 3 granted, Task 13)` and append below row S07-15:

```markdown
| S07-16 | 오류 → 문의 우선, 승인 3 문언: 오류 블록 첫 링크는 톡톡, 스토어 0; 상태 카드에는 원인별 복구 조작이 채움 주 버튼 (NOT_FOUND [번호 수정], 일시 지연·오프라인·응답 없음 [다시 조회]); SERVER_ERROR·계약 위반은 [문의 내용 복사하고 톡톡 열기] | tracking.spec › "error state prioritizes inquiry without store promotion" (row S07-5) | result-states › "approval 3 on the live page …" ×2 (approved branch), "every error response keeps 톡톡 first …" ×7, "server error: …"; result-kit › "failure card › …"; S04 failure-causes (`RESULT_APPROVALS.approval3`) | migrated (approval 3) |
```

```powershell
git add components/result/approvals.ts tests/e2e/RULE-MAP.md
git commit -m "feat: lead error cards with the recovery action (approval 3)"
```

---

### Task 14 (gated by approval 4): The pending help line in 지금 할 일

**Files:**
- Modify: `components/result/HelpItems.tsx` (`HelpItems`; new `helpDetailsId`)
- Modify: `components/result/SideColumn.tsx` (props interface, signature, one element)
- Modify: `components/result/NextActionBlock.tsx` (imports, `HelpLink`, props interface, signature, one render block)
- Modify: `components/result/ResultView.tsx` (imports, `pendingHelpLink`, two elements)
- Test: `tests/e2e/result-kit.spec.ts` (one describe block), `tests/e2e/result-states.spec.ts` (one describe block)

**Interfaces:**
- Consumes: roadmap §4 row 4; `HelpItemView` (S03); the config help item `order-check` ('주문내역에서 확인', shown on pending and NOT_FOUND — S03 ships it under both the approval and the fallback); `openDetails` (Task 2); `Button` (S05); `HelpDetails` (Task 4).
- Produces: `helpDetailsId(prefix: string, helpId: string): string` (`${prefix}-help-${helpId}`); `HelpItems(props: { items; idPrefix?: string })`; `SideColumnProps.helpIdPrefix?: string`; `interface HelpLink { id: string; helpId: string; label: string }`; `NextActionBlockProps.helpLink?: HelpLink | null` rendered as a text button `[data-help-link={helpId}]` right after the pending purchase choices; in `ResultView`, pending results get the link to their `order-check` help (spec §7 pending: "목적지는 현행 스토어 유지 + '주문내역에서 확인' 도움말").

- [ ] **Step 1: Confirm approval 4 is recorded in the roadmap approval ledger; if not, stop**

Run: `Select-String -LiteralPath docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md -Pattern "^\| 4 \|"`
Expected to continue: `| 4 | Pending recheck copy + purchase-choice destination | approved | …`.
If the Status is `pending` or `rejected`: stop and mark Task 14 SKIPPED — "approval 4 is <status>; spec §16 item 4 '거절하면: 현행 문구와 목적지를 그대로 씁니다. 설계는 그대로 동작합니다.' — the recheck sentence '정보 반영까지 시간이 걸릴 수 있어 2~3시간 뒤 다시 확인해 주세요.' and the store-home destinations stay as S03 ships them, and the '주문내역에서 확인' help item stays in the help list of pending and NOT_FOUND results (roadmap §4 row 4 fallback); 지금 할 일 gets no help line."

- [ ] **Step 2: Scope check**

Read the ledger row's note. If the approval chose the option "비제휴 '네이버에서 주문 확인 · 쿠팡에서 주문 확인' 링크로 바꾸고 제휴 스토어는 하단으로" (spec §16 item 4 선택안), stop after this step: it changes the pending CTA order and needs per-placement affiliate flags that `StoreChannel` does not have (S03 Task 15 Step 2) — a contract amendment (roadmap §5) for the operator to schedule. Record it in the stage summary. Otherwise continue.

- [ ] **Step 3: Write the failing tests**

Append to the end of `tests/e2e/result-kit.spec.ts`:

```ts
test.describe("pending help line (approval 4)", () => {
  test("pending: the help line follows the purchase choices and opens the order-check help with its summary focused", async ({ page }) => {
    const view = viewFor(success(pendingData()));
    const help = view.help.find((item) => item.id === "order-check");
    expect(help).toBeDefined();
    await openKit(page);
    await showView(page, view);
    const line = page.locator('[data-cta-state="pending"]').getByRole("button", { name: help?.summary ?? "" });
    await expect(line).toHaveAttribute("data-help-link", "order-check");
    expect(await follows(page, '[data-cta-state="pending"] [data-affiliate-group]', '[data-cta-state="pending"] [data-help-link]')).toBe(true);
    const details = page.locator('[data-result-view] details[data-help="order-check"]');
    await expect(details).not.toHaveAttribute("open");
    await line.click();
    await expect(details).toHaveAttribute("open", "");
    await expect(details.locator("summary")).toBeFocused();
    expect(await kitActions(page)).toEqual([]);
  });

  test("the help line belongs to pending only", async ({ page }) => {
    await openKit(page);
    await showView(page, viewFor(failure("notFound")), { failureCause: "notFound" });
    await expect(page.locator("[data-help-link]")).toHaveCount(0);
    await showView(page, viewFor(success(customsWaitingData())));
    await expect(page.locator("[data-help-link]")).toHaveCount(0);
  });
});
```

Append to the end of `tests/e2e/result-states.spec.ts`:

```ts
test.describe("pending help line (approval 4)", () => {
  test("pending: the help line after the purchase choices opens the order-check help", async ({ page }) => {
    const data = trackData("pending");
    const help = viewFor(success(data)).help.find((item) => item.id === "order-check");
    await openDeepLink(page, data);
    const line = page.locator('[data-cta-state="pending"] [data-help-link="order-check"]');
    await expect(line).toHaveText(help?.summary ?? "");
    await line.click();
    await expect(page.locator('[data-result-view] details[data-help="order-check"]')).toHaveAttribute("open", "");
  });
});
```

- [ ] **Step 4: Run them to verify they fail**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-kit.spec.ts tests/e2e/result-states.spec.ts -g "pending help line"`
Expected: `2 failed, 1 passed` — the two "follows/opens" tests find no `[data-help-link]`; "belongs to pending only" already passes and guards the other states.

- [ ] **Step 5: Give help items addressable ids**

In `components/result/HelpItems.tsx` replace

```tsx
/** The state's help items in config order (config/site.config.ts help[].showIn / openIn). */
export function HelpItems({ items }: { readonly items: readonly HelpItemView[] }): React.JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <div data-help-list="true" className="flex flex-col gap-2">
      {items.map((item) => (
        <HelpDetails key={item.id} item={item} />
      ))}
    </div>
  );
}
```

with

```tsx
/** The DOM id of a help item's <details>, so a line elsewhere in the result can open it with openDetails(). */
export function helpDetailsId(prefix: string, helpId: string): string {
  return `${prefix}-help-${helpId}`;
}

/** The state's help items in config order (config/site.config.ts help[].showIn / openIn). */
export function HelpItems({
  items,
  idPrefix
}: {
  readonly items: readonly HelpItemView[];
  /** When set, every item gets the id helpDetailsId(idPrefix, item.id). */
  readonly idPrefix?: string;
}): React.JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <div data-help-list="true" className="flex flex-col gap-2">
      {items.map((item) => (
        <HelpDetails key={item.id} item={item} id={idPrefix === undefined ? undefined : helpDetailsId(idPrefix, item.id)} />
      ))}
    </div>
  );
}
```

In `components/result/SideColumn.tsx`:
(a) replace

```tsx
  readonly help: readonly HelpItemView[];
}
```

with

```tsx
  readonly help: readonly HelpItemView[];
  /** Prefix for the help items' ids (helpDetailsId), so 지금 할 일 can open one of them. */
  readonly helpIdPrefix?: string;
}
```

(b) replace `export function SideColumn({ view, frame, historyId, help }: SideColumnProps): React.JSX.Element | null {` with

```tsx
export function SideColumn({ view, frame, historyId, help, helpIdPrefix }: SideColumnProps): React.JSX.Element | null {
```

(c) replace `      <HelpItems items={help} />` with `      <HelpItems items={help} idPrefix={helpIdPrefix} />`.

- [ ] **Step 6: Render the help line in 지금 할 일**

In `components/result/NextActionBlock.tsx`:
(a) replace `import { AffiliateLinkGroup } from "@/components/primitives/AffiliateLinkGroup";` with

```tsx
import { AffiliateLinkGroup } from "@/components/primitives/AffiliateLinkGroup";
import { Button } from "@/components/primitives/Button";
```

and replace `import { ActionControl } from "./ActionControl";` with

```tsx
import { ActionControl } from "./ActionControl";
import { openDetails } from "./details";
```

(b) directly below the line `const TALK_KINDS: ReadonlySet<ActionKind> = new Set<ActionKind>(["talk", "copyAndTalk"]);` add

```tsx

/** A text button in 지금 할 일 that opens one help item elsewhere in the result (pending purchase choices → 'order-check'). */
export interface HelpLink {
  /** DOM id of the help <details> (helpDetailsId). */
  readonly id: string;
  /** config help id, for the data-help-link hook. */
  readonly helpId: string;
  readonly label: string;
}
```

(c) replace

```tsx
  readonly carrierChooser?: React.ReactNode;
}
```

with

```tsx
  readonly carrierChooser?: React.ReactNode;
  /** Pending: '주문내역에서 확인' right after the purchase choices (approval 4). */
  readonly helpLink?: HelpLink | null;
}
```

(d) replace `export function NextActionBlock({ view, headingId, onAction, undeliveredHelpId, carrierChooser }: NextActionBlockProps): React.JSX.Element {` with

```tsx
export function NextActionBlock({
  view,
  headingId,
  onAction,
  undeliveredHelpId,
  carrierChooser,
  helpLink
}: NextActionBlockProps): React.JSX.Element {
```

(e) replace

```tsx
      {!storesLead && next.stores !== null ? <AffiliateLinkGroup stores={next.stores} /> : null}
      {carrierChooser}
```

with

```tsx
      {!storesLead && next.stores !== null ? <AffiliateLinkGroup stores={next.stores} /> : null}
      {helpLink === undefined || helpLink === null ? null : (
        <div>
          <Button variant="text" data-help-link={helpLink.helpId} aria-controls={helpLink.id} onClick={() => openDetails(helpLink.id)}>
            {helpLink.label}
          </Button>
        </div>
      )}
      {carrierChooser}
```

In `components/result/ResultView.tsx`:
(a) replace `import { FailureCard } from "./FailureCard";` with

```tsx
import { FailureCard } from "./FailureCard";
import { helpDetailsId } from "./HelpItems";
```

and replace `import { NextActionBlock } from "./NextActionBlock";` with `import { NextActionBlock, type HelpLink } from "./NextActionBlock";`.
(b) directly below the line `const ignoreAction = (): void => undefined;` add

```tsx

/** config help id the pending purchase choices point to (spec §7 pending "'주문내역에서 확인' 도움말", approval 4). */
const ORDER_CHECK_HELP_ID = "order-check";

function pendingHelpLink(view: TrackingViewModel, baseId: string): HelpLink | null {
  if (view.guideKey !== "pending") return null;
  const item = view.help.find((help) => help.id === ORDER_CHECK_HELP_ID);
  return item === undefined ? null : { id: helpDetailsId(baseId, item.id), helpId: item.id, label: item.summary };
}
```

(c) in `SettledFlow`, replace

```tsx
        carrierChooser={
          choices === null ? undefined : (
            <CarrierChooser choices={choices} onChoose={(carrier) => onAction({ kind: "chooseCarrier", carrier })} />
          )
        }
      />
```

with

```tsx
        carrierChooser={
          choices === null ? undefined : (
            <CarrierChooser choices={choices} onChoose={(carrier) => onAction({ kind: "chooseCarrier", carrier })} />
          )
        }
        helpLink={pendingHelpLink(view, baseId)}
      />
```

(d) replace

```tsx
      {view.mode === "error" ? null : <SideColumn view={view} frame={frame} historyId={`${baseId}-history`} help={otherHelp} />}
```

with

```tsx
      {view.mode === "error" ? null : (
        <SideColumn view={view} frame={frame} historyId={`${baseId}-history`} help={otherHelp} helpIdPrefix={baseId} />
      )}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-kit.spec.ts tests/e2e/result-states.spec.ts`
Expected: 0 failed (`result-kit.spec.ts` `44 passed`; the pending row of "지금 할 일 shows at most one filled control" still counts one filled control — the help line is a text button).
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.
In read-only mode (CS preview) the help line is swallowed like every other button (`blockActivation`, Task 5); nothing else changes.

- [ ] **Step 8: Commit**

```powershell
git add components/result/HelpItems.tsx components/result/SideColumn.tsx components/result/NextActionBlock.tsx components/result/ResultView.tsx tests/e2e/result-kit.spec.ts tests/e2e/result-states.spec.ts
git commit -m "feat: point the pending purchase choices at the order-check help (approval 4)"
```

---

### Task 15 (gated by approval 13): axe on the result area

**Files:**
- Create: `tests/e2e/result-a11y.spec.ts`
- Modify (only if no earlier stage added it): `package.json`, `package-lock.json` (dev dependency `@axe-core/playwright`)

**Interfaces:**
- Consumes: `@axe-core/playwright` `AxeBuilder` (dev dependency added by the first stage that ran with approval 13 granted — S05 Task 16 pins `^4.10.2`); fixtures `OCTOBER_NOW`, `customsWaitingData`, `inTransitData` (S03), `FAKE`, `FIXTURE_NOW`, `mockTrack`, `trackData`, `FailureFixture` (S01).
- Produces: `describe("result area accessibility (S07, approval 13)")` — WCAG 2.0/2.1/2.2 A+AA tags over the loading card and the key result rows at 375×812 and 1280×900, plus the opened history and delivered help; legacy blocks S08 replaces (`.tt-legacy-dark`, the legacy `[data-recommended-products]` card) are excluded.

- [ ] **Step 1: Confirm approval 13 is recorded in the roadmap approval ledger; if not, stop**

Run: `Select-String -LiteralPath docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md -Pattern "^\| 13 \|"`
Expected to continue: `| 13 | New services/dependencies (…) | approved | …`.
If the Status is `pending` or `rejected`: stop, mark Task 15 SKIPPED, and do the fallback (spec §16 item 13 "거절하면: … 접근성은 수동으로 점검합니다"; roadmap §4 row 13 "Manual a11y checklist + structural tests without axe"). The structural tests stay the automated check (`result-kit`: roles, focus target, one current station, radio chips, 44 px targets, 320 px; `result-layout`: focus, one live sentence, order). Walk this checklist once (Playwright's headed Chromium against the dev server that `npx playwright test` starts) and paste each result line into the stage summary:
  1. Keyboard only on a delivered result: run `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/result-states.spec.ts -g "delivered: " --headed --debug` and use "Step over" in the Playwright Inspector until the result is on screen (the test's mocked deep link), then: focus is on the status heading; Tab reaches the two store links, 톡톡, [받지 못하셨나요?], [다시 볼 링크 복사], '처리 내역 N건 보기' and the help items in that order; every focus ring is visible on the colored field and on white.
  2. NVDA + Chrome in the same kind of headed run (`-g "customs waiting: "`): '조회를 시작했어요' is read once, then exactly one result sentence; the status heading is not announced as an alert.
  3. The ambiguous result (`-g "ambiguous: arrowing"`, headed, stepped to the result): arrow keys move between the five carriers without starting a lookup; Space starts it.
  4. 400 % browser zoom at 1280 px (320 CSS px) in the headed runs of the pending, delivered and NOT_FOUND tests: no horizontal scroll; the number is never cut.
  5. Windows contrast theme and "animation effects off" (Settings → Accessibility): the status field, the spine and the loading card stay readable, and nothing moves.

- [ ] **Step 2: Write the test**

Create `tests/e2e/result-a11y.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { TrackResponseData } from "@/lib/types";
import { OCTOBER_NOW, customsWaitingData, inTransitData } from "../fixtures/derive-scenarios";
import { FAKE, FIXTURE_NOW, mockTrack, trackData, type FailureFixture } from "../fixtures/tracking-fixtures";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const OVERDUE_NOW = new Date("2026-09-29T09:00:00+09:00");

interface A11yScene {
  readonly name: string;
  readonly reply: TrackResponseData | FailureFixture;
  readonly now: Date;
  readonly delayMs?: number;
  readonly ready: string;
}

const SCENES: readonly A11yScene[] = [
  { name: "loading", reply: trackData("customsWaiting"), now: FIXTURE_NOW, delayMs: 20_000, ready: "[data-loading-stage]" },
  { name: "pending", reply: trackData("pending"), now: FIXTURE_NOW, ready: "[data-result-view]" },
  { name: "customsWaiting", reply: trackData("customsWaiting"), now: FIXTURE_NOW, ready: "[data-result-view]" },
  { name: "inTransit", reply: inTransitData(), now: OCTOBER_NOW, ready: "[data-result-view]" },
  { name: "delivered", reply: trackData("delivered"), now: FIXTURE_NOW, ready: "[data-result-view]" },
  { name: "overdue", reply: customsWaitingData(), now: OVERDUE_NOW, ready: "[data-result-view]" },
  { name: "stale", reply: trackData("stale"), now: FIXTURE_NOW, ready: "[data-result-view]" },
  { name: "ambiguous", reply: trackData("ambiguous"), now: FIXTURE_NOW, ready: "[data-result-view]" },
  { name: "notFound", reply: "notFound404", now: FIXTURE_NOW, ready: "[data-result-view]" },
  { name: "serverError", reply: "serverError500", now: FIXTURE_NOW, ready: "[data-result-view]" }
];

async function blockOtherHosts(page: Page): Promise<void> {
  await page.context().route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
}

async function open(page: Page, scene: A11yScene): Promise<void> {
  await page.clock.setFixedTime(scene.now);
  await mockTrack(page, scene.reply, { delayMs: scene.delayMs });
  await page.goto(`/${typeof scene.reply === "string" ? FAKE.domestic : scene.reply.trackingNumber}`);
  await expect(page.locator(scene.ready)).toBeVisible();
}

/** Violations as 'scene: rule — targets'. Legacy blocks S08 replaces (footer/showcase bands, the legacy recommendation card) are excluded. */
async function violationsOf(page: Page, label: string): Promise<readonly string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .exclude(".tt-legacy-dark")
    .exclude("[data-recommended-products]")
    .analyze();
  return results.violations.map((violation) => `${label}: ${violation.id} — ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
}

test.describe("result area accessibility (S07, approval 13)", () => {
  test.describe.configure({ timeout: 150_000 });

  for (const [width, height] of [
    [375, 812],
    [1280, 900]
  ] as const) {
    test(`no WCAG 2.2 AA violations in the loading card and the key result rows at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await blockOtherHosts(page);
      const found: string[] = [];
      for (const scene of SCENES) {
        await open(page, scene);
        found.push(...(await violationsOf(page, scene.name)));
      }
      expect(found).toEqual([]);
    });
  }

  test("opened history and 미수령 안내 stay clean at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await blockOtherHosts(page);
    await open(page, { name: "delivered", reply: trackData("delivered"), now: FIXTURE_NOW, ready: "[data-result-view]" });
    await page.locator("details[data-history] summary").click();
    await page.locator('[data-cta-state="delivered"]').getByRole("button", { name: "받지 못하셨나요?" }).click();
    await expect(page.locator("details[data-delivered-help]")).toHaveAttribute("open", "");
    expect(await violationsOf(page, "delivered, details open")).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it to verify it fails without the package**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-a11y.spec.ts`
Expected: FAIL while loading — `Error: Cannot find module '@axe-core/playwright'` (0 tests run), unless an earlier stage already installed it (then the tests run: go to Step 5).

- [ ] **Step 4: Install the dev dependency if it is missing**

Run: `Select-String -Path package.json -Pattern '"@axe-core/playwright"'`
Expected: a match → skip the install (S05 or S06 added it under the same approval). No match → run `npm install --save-dev @axe-core/playwright@^4.10.2`
Expected: exit 0; `package.json` `devDependencies` lists `"@axe-core/playwright": "^4.10.2"`; include `package.json` and `package-lock.json` in Step 6's commit.

- [ ] **Step 5: Run it to verify it passes**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/result-a11y.spec.ts`
Expected: `3 passed`. A violation prints `scene: rule — targets`: fix the S07 component that owns the target (never exclude more or relax the tags) and run again. A violation inside a primitive (`[data-slot]`, `[data-status-chip]`, `[data-number-bar]`) belongs to S05: record it in the stage summary and fix it there only with the operator's go-ahead.

- [ ] **Step 6: Commit**

```powershell
git add tests/e2e/result-a11y.spec.ts
git commit -m "test: run axe on the loading card and the key result rows"
```

(Add `package.json package-lock.json` when Step 4 installed the package.)

---

### Task Final: Stage gate

- [ ] **G1. Port free.** `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue` → no output (stop listeners otherwise).
- [ ] **G2. Lint.** `npm run lint` → exit 0, no errors, no warnings introduced by this stage.
- [ ] **G3. Typecheck.** `npm run typecheck` → exit 0.
- [ ] **G4. Build.** `npm run build` → exit 0. Route table: `ƒ /[trackingNumber]` always; `/` is `ƒ` in S01 (it still reads `searchParams`), `○ /` from S02 on, and `○ /` with `Revalidate 5m` from S06 on.
- [ ] **G5. Dev-mode E2E.** `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npm run test:e2e` → "N passed", 0 failed (skips allowed only for tests guarded by `PW_MODE`, `PW_SHOTS`, `PW_VISUAL`, or an approval-gated `test.skip` naming the approval).
- [ ] **G6. Production-mode E2E.** Re-run `npm run build` if `next start` reports a missing or stale build. Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait for `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` = `200`; then `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test` → 0 failed, including `tests/budgets/*`.
- [ ] **G7. After-screens.** Server still running: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='after'; $env:PW_STAGE='S07'; npx playwright test tests/tools/stage-screens.spec.ts` → PNGs in `test-artifacts/stage-screens/S07-after/` at 320, 375, 768, 1024, 1440. Compare with `S07-before/`; send both sets to the operator with SendUserFile. Stop the server (G1 command) and clear the flags: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.
- [ ] **G8. Budgets.** Paste the measured numbers of every budget this plan lists (from the G6 output) into the stage summary. Any budget over its fail line fails the gate.
- [ ] **G9. Code review.** Invoke the `code-review` skill on `git diff claude/tipoasis-tracking-renewal-ae0e3a...HEAD`. Fix every CRITICAL and HIGH finding; if code changed, re-run G2–G6.
- [ ] **G10. Verification.** Invoke `superpowers:verification-before-completion`; paste each command and its result line into the stage summary.
- [ ] **G11. Commit.** `git status` shows only this stage's files (see the roadmap File Map). Commit any remainder with a conventional message and no attribution trailer.
- [ ] **G12. No deploy.** Do not push to `main`; do not run `vercel deploy`. Push `renewal/s07-result-area` only if the operator asked. Hand the stage summary to the operator; merge into the integration branch only after acceptance (roadmap §5).

**S07 notes on the standard gate above**
- G4: `○ /` with `Revalidate 5m` and `ƒ /[trackingNumber]` as in S06; the only new route is `/internal/result-kit` (behind the `/internal` basic auth and `noindex`; either `○` or `ƒ` is fine).
- G5: allowed skips are every `tests/budgets/*` test (production only, including the three of `js-budget.spec.ts`), the stage-screens tool (no `PW_SHOTS`) and S06's production-only deep-link cache test. When approval 13 is not granted `tests/e2e/result-a11y.spec.ts` does not exist (Task 15 SKIPPED), so it adds no skip.
- G6: `tests/budgets/js-budget.spec.ts` (3 tests) runs here next to S01's, S05's and S06's budgets, which must stay green: the result area may not break the home HTML, LCP, deep-link first paint, CLS or font budgets.
- G7: the path is S01 Addition 1's. Every `deeplink-*` shot changes (the R3 result area replaces the R2 slot and the legacy details); `home-*`, `deeplink-invalid-*` and `privacy-*` must look as in `S07-before/` (the result area renders nothing in form modes). The six S07 scenarios (Task 12) exist only in the after-set; at 1024 and 1440 px every settled result shows the 560 px result beside the 320 px side column.
- G8 budget lines: the five `[js-budget]` lines (platform floor, `'/'` initial with its target/warning annotation, `'/'` app, result chunk, `'/{번호}'` through the result) from Task 11; `[budget] result fill CLS at 375x812` from Task 8; the ten `[budget] 지금 할 일 top at 375x812 (…)` lines and the two `[budget] status field at 375x812 (…)` lines from Task 9; and, unchanged since S06/S05, `[html-budget]`, `[lcp-budget]`, `[fcp-budget]`, `[cls-budget]`, `[font-budget]`. Fail lines: `'/'` initial above 175 KB, app above 25 KB, result chunk above 30 KB, `'/{번호}'` above 195 KB, CLS above 0.05, status field above 300 px, 지금 할 일 starting lower than 420 px in the plain states, or its sentence ending lower than 812 px in any key state.
- G11: this stage's files are the File Structure table above plus "Additions to the contract (continued)" items 10–14 below; `tests/support/status-slot.ts` is modified by Task 8 Step 12 (its `statusSlot` locator names `data-status-slot`, which no R3 element carries).
- Stage summary also lists: the statuses of approvals 2, 3, 4 and 13 and which of Tasks 13, 14, 15 ran or were SKIPPED (with the fallback evidence: Task 15's manual checklist results); the Task 0 records (Steps 9 and 10); the selectors Task 8 Step 12 replaced; any edit Task 2 Step 4 or Step 9 made to S03's `tests/fixtures/config-fixtures.ts` or `tests/unit/config.spec.ts`; whether Task 9 Step 11 needed the `StatusCard` gap lever; "Task 9 Part A done in Task 8" and whether Task 8 Step 11 also applied Task 10 Part A early; the contract deviations (Additions 1–19) and the open issues below.

---

## Additions to the contract (continued, Tasks 9–15)

Additive; no §11 name is renamed or retyped. Reported as contract deviations together with items 1–9 above.

10. **`components/result/approvals.ts` (C S07, lazy chunk only):** `interface ResultApprovals { readonly approval3: boolean }`, `RESULT_APPROVALS` (kept equal to the roadmap §4 ledger by `tests/unit/result-approvals.spec.ts`), `applyResultApprovals(view: TrackingViewModel, approvals: ResultApprovals): TrackingViewModel`, `deriveResultView(outcome: LookupOutcome, now: Date): TrackingViewModel`. `result-module.ts` exports `deriveResultView` as a fourth name next to the three in §11.9, and `ResultSlot` renders its views. The approval-3 fallback is a view transform, as in S04's R2 slot (S04 contract deviation 1), not the config change S03 Addition 10 proposed: S03's `derive-view.spec.ts` stays pinned to the approval-3 proposal against `siteConfig`, and customers keep R2's '톡톡으로 문의하기' as the filled primary until approval 3. The Task 6 `FailureCard` doc comment is corrected in Task 10 Step 4.
11. **`components/lookup/lookup-display.ts` reshaped (S06-owned; S06 Addition 2 lets S07 change it):** `LookupDisplay = { kind: "form"; busy; invalid } | { kind: "result"; request }`; `DisplayInput` without `derived`; `DerivedView` and `outcomeKey` are removed; `InvalidInput`, `computeDisplay`, `viewModeOf` and `stillActiveHomeNotice` keep their names. `tests/unit/lookup-display.spec.ts` is rewritten with the same seven rows. File Map rows for both gain "M S07".
12. **`LookupController` (M S07) beyond Task 8:** `div[data-result-area]` (new hook) is always mounted around `ResultSlot` and is `display: contents` while the form shows; the settled view is kept as `SettledViewRecord { settledAt; view }` so the number bar never shows a previous lookup's carrier; result modes use `SECTION_RESULT_CLASS` — no gap under the number bar and, from 1024 px, `lg:-mx-[calc((var(--tt-side)_+_2rem)/2)]` so the result grid gets 560 + 320 px while `TrackingPage`'s 560 px `<main>` (S06) and the home column stay as they are.
13. **File Map deletions beyond §10.3 (D S07):** `components/lookup/PendingCard.tsx` (C S06), `components/status-slot/status-view.ts` and `components/status-slot/SlotParts.tsx` (S04-private, deleted with the folder), `tests/unit/status-view.spec.ts` (C S04; rows moved per RULE-MAP S07-13/S07-14). **Kept (S04 Addition 3 agrees):** `tests/support/status-slot.ts` — S04's four E2E specs still import its helpers after Task 8 moved their selectors; S07 modifies it (M S07: `statusSlot` re-pointed to `#tracking-panel [data-view-state]`, new export `RESULT_SLOT_CONTENT`). S06's transitional `<div id="tracking-panel">` (S06 Addition 11) stays in `TrackingPage`; S07 does not edit that file.
14. **File Map additions and modifications:** C S07 `components/result/approvals.ts`, `tests/unit/result-approvals.spec.ts`; M S07 `tests/e2e/status-slot.spec.ts`, `tests/e2e/failure-causes.spec.ts`, `tests/e2e/cta-consistency.spec.ts` (their view import, besides Task 8's selectors), `tests/e2e/result-states.spec.ts` (Tasks 10 and 14 besides 8), `components/result/StatusCard.tsx` (only if Task 9 Step 11 used the gap lever), `components/result/FailureCard.tsx` (Task 10 comment), `components/result/HelpItems.tsx`, `SideColumn.tsx`, `NextActionBlock.tsx`, `ResultView.tsx` (Task 14, approval 4).
15. **Help ids and the pending help line (Task 14, approval 4; private to `components/result/`):** `helpDetailsId(prefix: string, helpId: string): string` and `HelpItems({ items, idPrefix? })` in `HelpItems.tsx`; `SideColumnProps.helpIdPrefix?: string`; `interface HelpLink { id: string; helpId: string; label: string }` and `NextActionBlockProps.helpLink?: HelpLink | null` in `NextActionBlock.tsx`; hook `data-help-link` (value = config help id, `order-check`).
16. **JS budget basis (Task 11):** module `<script src>` files of the server HTML, gzip level 9 per file, 1 KB = 1024 B (Phase 1's `m-bytes.cjs` basis); "app" = `/` module files that `/privacy` does not load; "result chunk" = first-party scripts requested after focus enters `[data-lookup-form]`; `/[번호]` total = the deep link's HTML module scripts plus every first-party script requested until `[data-result-view]` shows. `ZodError` and `data-primary-end` must not occur in `/`'s initial chunks.
17. **Budget output lines for G8:** `[js-budget] …` (5), `[budget] 지금 할 일 top at 375x812 (<guideKey or row>): N px` (10), `[budget] status field at 375x812 (<row>): N px (max 300 px); 지금 할 일 top N px (max 420 px)` (2), `[budget] result fill CLS at 375x812: N (max 0.05)` (Task 8).
18. **Stage-screen scenarios (Task 12):** `deeplink-customsCleared`, `deeplink-pickedUp`, `deeplink-lookupUnavailable`, `deeplink-chooseCarrier`, `deeplink-carrierCut`, `deeplink-overdue`; S08 appends after them.
19. **`tests/e2e/RULE-MAP.md` rows S07-13 to S07-15** (Task 10) and **S07-16** (Task 13, only with approval 3).

## Open issues for the operator and later stages

1. **Task 8 and S06's display table (resolved in review).** S06's final `lookup-display.ts` keeps the `pending`/`slot` split that waits for a derived view, which Task 8 Step 8 (f) removes. Task 8 Step 8 (h) therefore applies Task 9 Steps 1, 4 and 5 inside Task 8 and records "Task 9 Part A done in Task 8"; Task 9 starts at Step 2. Likewise Task 8 Step 11 applies Task 10 Part A early whenever S04's `STATUS_SLOT_APPROVALS` still holds a `false` (approval 3 is `pending` in the ledger today), because S04's specs compute their expectations through S04's fallbacks.
2. **Client-side titles in form modes (resolved in review).** `ResultSlot` sets the result titles and restores the load-time title while idle or loading; `LookupController` keeps S06's `pageTitleOf` effect (home, INVALID and '조회 중' titles for the form and loading displays, `null` for results), which runs after `ResultSlot`'s child effect and so wins. Task 8 Step 8 (f) keeps it and checks that it is the only `document.title` assignment left in `LookupController`.
3. **Spec wording for approval 3.** §16 item 3 names [번호 수정] as the recovery action for '응답 없음'; §7 'error · 응답 없음' names [다시 조회] as the main action. S03's config (`noResponse.primaryAction: "retry"`) and RULE-MAP row S07-16 follow §7. The operator should confirm this when recording approval 3.
4. **Approval 4 fallback wording.** The ledger fallback says "add the '주문내역에서 확인' help" (S03 ships the help item either way), while spec §16 item 4 "거절하면" only keeps the copy and destinations. S07 gates only the help line inside 지금 할 일 (Task 14); the help item in the help list is not gated.
5. **Field cap on notice days.** The ≤ 300 px field / ≤ 420 px 지금 할 일 checks run on the October in-transit and the delivered results. On notice days the customs-waiting field also holds the '안내' line and the holiday badge (spec §7 customsWaiting shows both), so it is taller by design; the first-view test still requires 지금 할 일 inside 812 px there. Reaching 420 px on notice days would need the '안내' line outside the field, which spec §6 ("카드 안 '안내' 한 줄") does not allow without an operator decision.
6. **Legacy recommendation card until S08.** Recommendations are S04's `RecommendedProducts`, loaded through `next/dynamic` (Task 8); it keeps its own dark card and an 11 px badge. `tests/e2e/result-a11y.spec.ts` excludes `[data-recommended-products]` for that reason; S08's `RecommendationList` replaces it and must drop the exclusion.
7. **CS preview (S09).** To show exactly what customers see, S09 renders `ResultView` with `deriveResultView` views (Addition 10) and passes `failureCause` (Addition 1). S09 imports `ResultView` and `deriveResultView` statically on the internal page instead of through `loadResultModule()` (S09 contract deviation 1): `/internal/cs-helper` has no JS budget and its preview must render synchronously, and the lazy-chunk rule (§11.1 rule 3) and this stage's `result-module.spec.ts` scan cover only the public initial-bundle files. That static import is therefore not a violation of this plan. It stays acceptable only while S07's `js-budget.spec.ts` numbers for `/`, the result chunk and `/{번호}` do not grow when S09 merges (S09's G8 re-checks them); if they grow, S09 switches `ScreenAndReply` and its bulk derive to `loadResultModule()` (S09 open issue 1).
8. **JS budget risk.** The lookup island imports the whole `config/site.config.ts` (S06 open issue 2). If Task 11 measures the app part above 25 KB, the known fix changes `LookupControllerProps` (contract §11.9), so Task 11 stops and reports instead of changing the contract.
9. **Approval 3's ledger test and parallel branches.** `tests/unit/result-approvals.spec.ts` reads the ledger file on the branch under test; a release branch cut before the ledger row changes keeps the old flag, which is correct, but whoever records approval 3 must run Task 13 on the integration branch before the next release or that unit test fails there.

## Self-Review

- **Spec coverage.** §1 success criterion "결과 첫 화면에 상태·예상일·지금 할 일" → Task 9 "375×812: status, ETA and 지금 할 일 are in the first view in every key state"; E2E-locked rules → Task 8 (RULE-MAP S07-1 … S07-12) with Task 10 (S07-13 … S07-15) and Task 13 (S07-16). §2 원칙 1–4 → one slot for loading/error/result (Tasks 7–9), result modes show only the fixed flow before `[data-primary-end]` (Tasks 4, 9), one view model (Tasks 1–8 render only `TrackingViewModel`), '지금은 하실 일이 없어요' without a filled button (Task 2). §3 데스크톱 1440 (560 + 320, recent 3 + 전체 보기) → Tasks 5 and 9; 공유 (share sheet first) → Task 2. §5 time axis, cancel, 429 countdown, offline re-lookup, two-failure escalation, no raw server text, focus and one live region → Tasks 6–8 (and Task 9 for the offline preload). §6 fixed order, number bar (S05/S06, kept by Task 9's layout), status card with chip/h2/reason/spine/'안내', ETA largest text with D-n and holiday badge, 지금 할 일 with the worry line bound to 톡톡, overdue, 마지막 처리 + `<details>` 처리 내역, fill without scroll jump, one live sentence, document title → Tasks 1–5, 8, 9. §7 every row (loading short/long, INVALID in the form, NOT_FOUND with the caveat line, 일시 지연/429/오프라인, 응답 없음, SERVER_ERROR/계약 위반, pending, customsArrived/Waiting/Cleared/handed/pickedUp, inTransit with the carrier's live link and driver call, delivered with 미수령 안내, overdue, stale, lookupUnavailable, ambiguous) → Tasks 1–8 (harness and live page), Task 12 screens. §8 placement (disclosure first, stores lead only for delivered, none in problem states, recommendations after the history or right after `[data-primary-end]` for delivered, 톡톡 once per state block) → Tasks 2, 4, 8, 9. §12 targets 44 px (Task 3), `<details>`, fieldset + radio, no dialogs, 320 px (Tasks 5, 9), finite spinner and reduced motion (Task 7), JS budgets (Task 11), CLS (Task 8), axe with approval 13 (Task 15). §13 B supplements: field cap (Task 9), amber/ink for 확인 필요 and red only for 문제 (tones from the view, S05 CSS; Task 6 asserts `attention`/`problem`), style-independent DOM and hooks (every task uses hooks, not style classes). §14 component boundaries (lazy `ResultView` ≤ 30 KB, `LoadingCard` initial, CS preview through `readOnly`/`frame`), test contract items 1–3 → Tasks 1, 5, 8, 11. §16 items 2, 3, 4, 13 → Task 0 Step 7 and Task 8; Tasks 10/13; Task 14; Task 15, each with its fallback.
- **Placeholder scan.** No "TBD", "TODO" or "similar to Task N". Steps that depend on code earlier stages may have shaped differently (Task 8 Step 8, Task 9 Step 5, Task 10 Step 5) name the exact text to find, the replacement, and a `Select-String` check whose expected output proves the edit; branch points (the `ReplayFrame` variant, S06 Task 7 Step 6's gap, an already-installed axe package, an approval recorded before its gated task) give both concrete paths.
- **Type consistency.** Contract names are used as written: `ResultViewProps`, `ResultView`, `ResultModule`, `loadResultModule`, `preloadResultModule`, `LoadingCard`, `useLookup`, `useAnnounce`, `LookupControllerProps`, `deriveTrackingView`, `deriveLoadingView`, `TrackingViewModel`, `LoadingViewModel`, `LookupOutcome`, `LookupState`, `ResultAction`, `ActionView`, `ActionKind`, `FailureCause`, `setAdSignals`, `shareOrCopyLink`, `IS_PRODUCTION_RUN`, `mockTrack`, `trackData`, `FailureFixture`, `FAKE`, `FIXTURE_NOW`. S07-private names keep one spelling across tasks: `ResultSlot`/`ResultSlotProps`, `StatusCard`, `NextActionBlock`/`NextActionBlockProps`/`HelpLink`, `ActionControl`, `ReturnLinkAction`, `CarrierChooser`, `LastEventLine`, `HistoryDetails`/`HistoryEventItem`, `HelpItems`/`HelpDetails`/`helpDetailsId`, `DeliveredHelp`/`UNDELIVERED_HELP_ITEM_ID`, `SideColumn`/`SideColumnProps`, `FailureCard`, `openDetails`, `ResultApprovals`/`RESULT_APPROVALS`/`applyResultApprovals`/`deriveResultView`, `SettledViewRecord`, `SECTION_FORM_CLASS`/`SECTION_RESULT_CLASS`, `ResultKitScene`/`ResultKitApi`. Test totals: `result-kit.spec.ts` 3 → 13 → 17 → 23 → 29 → 37 → 42 → 44 (Task 14); `result-module.spec.ts` 4 → 5 → 6; `result-states.spec.ts` 32 → 34 → 35 (Task 14); `result-layout.spec.ts` 6 → 9 → 14; `lookup-display.spec.ts` 7; `result-approvals.spec.ts` 8; `normalizer.spec.ts` 2; `js-budget.spec.ts` 3; `result-a11y.spec.ts` 3.
- **Review Focus.** (1) browser outside KST → Task 8 `result-states` "a browser in America/New_York …" ×2 (the pure KST rows are S03's); (2) blocked clipboard → Task 2 `result-kit` "blocked clipboard: …"; (3) a result module that cannot load → Task 8 `result-states` "a result module that cannot load …" and Task 1 `result-module` "a failed import is retried …", plus Task 9's preload on focus so an offline error can still be drawn; (4) long values at 320 px → Task 5 `result-kit` "long places, terms and inquiry text wrap at 320 px" and Task 9 "320 px: no horizontal scroll …" on the live page; (5) double activation → Task 3 "a double click reports one choice" and Task 6 "429: …". No roadmap Review Focus line is assigned to S07.
