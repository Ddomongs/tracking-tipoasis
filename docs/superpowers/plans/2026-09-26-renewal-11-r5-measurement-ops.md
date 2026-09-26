# S11 — R5 Measurement and Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start a code-free observability baseline in the R0 week, then in R5 collect CSP Report-Only violations as number-free summary lines, add cookieless Vercel Web Analytics and Speed Insights that load only after the URL scrub and carry only route templates and enum events (approval 13), and hand the operator the KPI dashboard definition, the AdSense account checklist (approval 15), the strict-CSP decision record (approval 16) and the WAF proposal for `/internal`.

**Architecture:** Part A is one operator document written in the R0 week. Part B adds `lib/security/csp-report.ts` (zod-parsed report → five-key summary → rate-limited, de-duplicated log line) behind `app/api/csp-report/route.ts`, wires `reportUri` through `next.config.ts`, and makes number-route documents send the Report-Only policy without a report address (their report would carry the number in `document-uri`). Part C keeps the initial bundle tiny: `components/analytics/Analytics.tsx` evaluates a pure gate (`lib/analytics/gate.ts`: no number in the address, deep-link scrub confirmed, referrer at most a bare origin, never `/internal`) against S02's ad signals, and only then — after `load` and idle — imports `lib/analytics/runtime.ts`, which injects both vendor scripts with route templates (`lib/analytics/url-template.ts`) and a templating `beforeSend`, and turns the contract `data-*` hooks into enum-only events (`lib/analytics/dom-observer.ts`, `lib/analytics/events.ts`); `useLookup` reports each lookup start through a tiny queue (`lib/analytics/report.ts`). Part D is four operator documents whose structure (and ledger-dependent variant) is pinned by `tests/unit/ops-docs.spec.ts`.

**Tech Stack:** Next.js 16.3.6 App Router (Turbopack), React 19.3, TypeScript strict, zod 3.25 (server-side report parsing only), Playwright 1.55 (the only test runner; unit tests are Playwright tests without a `page`), `@vercel/analytics` ^2.0.1 and `@vercel/speed-insights` ^2.0.0 (approval 13; framework-agnostic `inject`/`pageview`/`track`/`injectSpeedInsights` entry points). Windows: every `npm`/`npx`/`node` command runs in PowerShell 5.1.

**Spec:** `docs/superpowers/specs/2026-09-26-tracking-renewal-ia-design.md` — §1 (success criteria, 톡톡 문의 KPI), §3 (candidate B scrub order), §10 (WAF proposal for failed `/internal` attempts), §11 (측정: 1단계 baseline, 3단계 analytics, KPI 1–7, 안전장치), §12 (Report-Only, strict CSP conflicts with static '/'), §13 ("정리 기준": style_select), §15 (R0 week baseline, R5), §16 items 13, 15, 16, §17 Q2 and Q5. Roadmap and shared contract: `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` (§2 dependency graph, §3 operator questions, §4 ledger, §6 Task 0, §7 gate, §9 S11 budgets, §10 File Map, §11.5 `SecurityHeaderOptions.reportUri`, §11.9 `AnalyticsEvent` / `templatePath`, §11.10 `captureThirdParty`, §11.13 hooks). Stage plans consumed: S01 (`…-01-r0-urgent-fixes.md`: `lib/security/headers.ts`, `next.config.ts`, `tests/unit/security-headers.spec.ts`, fixtures, stage-screens output path), S02 (`…-02-r1-number-protection.md`: `isNumberPath`, `ScrubStatus`, ad signals, `AdLoader`, `captureThirdParty`, `assertNoTrackingValues`, `waitForIdle`, privacy page text), S03 (`GUIDE_KEYS` and the domain types), S05 (`isStyleId`, `NoticeBanner`), S06 (`app/(public)/layout.tsx`, `data-view-state`), S07 (`data-result-view`, `details[data-history]`, `data-failure-cause`), S10 (`track_lookup` log line cited by the KPI documents), S08 (`…-08-supplementary-and-styles.md`: `[data-style-picker]` radios whose `value` is the `StyleId`, `html[data-style]`, `AD_TIMING_POLICY = "afterAllowedResult"` under approval 7, `ads.manualSlotId`, Task 12's `PREPAINT_CSP_SOURCE` in `next.config.ts` and in S01's config test, Task 14's style-independence scan in `tests/unit/prepaint.spec.ts` whose `ALLOWED` set S11 extends, per S08 open issue 13). Task 0 Step 9 re-checks every anchor before any task starts.

**Depends on:** Part A — nothing (roadmap §2: the baseline document needs nothing and runs in the R0 week). Parts B–D — S01, S02, S03, S05 (contract), and S06, S07, S08 including S08 Part B (R3b), because S11 edits files those stages modify first (roadmap §10 order for `app/(public)/layout.tsx`, `app/(public)/privacy/page.tsx`, `next.config.ts`, `tests/unit/security-headers.spec.ts`, `tests/unit/prepaint.spec.ts`) and reads their hooks; R5 is released after R3b in any case (roadmap §1, §5).

**Gated by:** approval 13 (Part C, Tasks C1–C6), approval 15 (Task D2A; Task D2 ships the '거절하면' checklist), approval 16 (Task D3A; Task D3 ships the '거절하면' decision).

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

**S11-specific constraints**
- Nothing S11 sends carries a number (spec §11 원칙, roadmap §9): an analytics page view carries one of four paths — `/`, `/privacy`, `/[trackingNumber]`, `/[unknown]` — and no query or hash; an event carries at most two properties, each an enum spelling or a boolean; the statistics scripts never load while the address carries a number, before a deep link's scrub is `scrubbed`, after a `failed` scrub, under `/internal`, or when `document.referrer` has more than a bare origin (the vendor script sends other-site referrers outside `beforeSend`'s reach).
- No cookies, no new storage keys (roadmap §11.14 stays as it is), no session replay, heatmap or input capture, no GA4 (spec §11 "3단계").
- CSP reports are never stored. The server keeps only `csp_report {"directive","blocked","blockedHost","documentKind","disposition"}` lines, at most 60 per minute and each distinct line once per 10 minutes per server instance. Number-route documents get the Report-Only policy without `report-uri`, so a browser never posts a report whose `document-uri` holds a number.
- New dependencies exist only under approval 13: `@vercel/analytics` ^2.0.1 and `@vercel/speed-insights` ^2.0.0 in `dependencies`. Nothing else is installed.
- Operator-only actions — reading Vercel Observability, switching Web Analytics / Speed Insights on in the Vercel project, AdSense account settings, Vercel Firewall rules, legal review of the policy text — are written as documents and hand-off steps. Agents never perform them and never call production endpoints.
- Operator documents under `docs/ops/` are written in Korean (the operator's language) and contain no 10+ digit run (S01's repo guard scans `docs/`); dates in them use the '10월 5일' form.
- Files S11 may touch: the files in "File Structure" below, nothing else. `lib/schemas.ts`, `lib/types.ts`, `lib/services/*`, `proxy.ts`, `app/api/track/route.ts` stay frozen.

## Review Focus

Conditions the spec implies but no requirement line names, most likely first. Each line names the test that pins it.

1. **A deep link whose scrub never completes** (an old in-app browser without `history.state.__NA`, or a slow device past `SCRUB_TIMEOUT_MS`): the statistics scripts must never load in that document and the queued `lookup_start` must be dropped, not sent later. Tests: Task C1 `analytics-events.spec.ts` "a failed scrub, /internal and a referrer with a path close the gate for the document" and "home documents load at once; deep-link documents only after a confirmed scrub"; Task C3 "a closed gate drops the queue and every later event".
2. **A customer who arrives from a web page that leaks its full address** (a shop order page such as `https://shop.example/orders/{번호}` with an `unsafe-url` referrer policy): no statistics for the whole visit, because the vendor script would send that referrer as `r`. Tests: Task C1 "a referrer is safe only when empty, from this host, or a bare origin"; Task C4 `analytics-privacy.spec.ts` "a referrer with a path keeps the scripts away for the whole visit" and "an origin-only referrer is sent as that origin and nothing more".
3. **A value that happens to carry a number reaches an event** (an operator names a notice `notice-{번호}`, a future component writes an unexpected `data-guide-key`, a placement attribute holds free text): the event is dropped, never sent. Tests: Task C2 "anything outside the enums is refused, including numbers smuggled into a field"; Task C5 "clicks, history, style and notices become enum-only events" (every sent property matches `PROPERTY_VALUE_PATTERN`).
4. **A report flood** (once S08 adds the pre-paint hash, CSP3 browsers ignore `'unsafe-inline'` in the Report-Only policy and report Next.js inline scripts on every page view): log lines stay bounded and identical lines are written once per window. Test: Task B1 `csp-report.spec.ts` "the limiter admits each distinct line once per ten minutes and at most sixty lines a minute".
5. **A report whose addresses all carry the number** (`document-uri`, `referrer`, `blocked-uri` with AdSense's `url=` parameter, `script-sample`, `source-file`): the summary line holds none of them, and number-route documents do not even send one. Tests: Task B1 "a legacy report becomes a fixed-shape summary without the addresses" and "a report with a number in every address is logged as a number-free summary and answered with 204"; Task B2 `tests/e2e/csp-report.spec.ts` "public pages report to the endpoint; number routes keep the policy without a report address".

Also pinned: React's development double effects and later signal changes never produce a second page view (Task C4 "home: one page view filed under '/' …" asserts exactly one view after a lookup), and `/internal` never loads the scripts (Task C5 "/internal never loads the statistics scripts …").

## Additions to the contract

Additive; no §11 name is renamed. Each item goes into the stage summary as a contract deviation (roadmap §5 "Contract changes").

1. **`AnalyticsEvent` (roadmap §11.9) gains three fields/members**, all enum-only: `lookup_start.repeat: boolean` (another start in the same document within 10 minutes — spec §11 KPI 4), `action.overdue: boolean` (KPI 2 excludes overdue clicks, KPI 3 counts them), and the action kind widens to `AnalyticsActionKind = ActionKind | "storeLink"` (store clicks for KPI 6; `ActionKind` has no store member). `lib/analytics/events.ts` also exports `WaitBucket`, `AnalyticsActionKind`, `AnalyticsPlacement`, `AnalyticsEventName`, `EventPropertyValue`, `EventPayload`, `LinkClickInput`, `ANALYTICS_EVENT_NAMES`, `LOOKUP_ENTRIES`, `FAILURE_CAUSES`, `ANALYTICS_ACTION_KINDS`, `TALK_PLACEMENTS`, `STORE_PLACEMENT_IDS`, `WAIT_BUCKETS`, `NOTICE_ID_PATTERN`, `PROPERTY_VALUE_PATTERN`, `isGuideKey`, `isFailureCause`, `isTalkPlacement`, `isStorePlacementId`, `waitBucket`, `stateToken`, `parseAnalyticsEvent`, `toEventPayload`, `classifyLinkClick`. Wire format: at most two properties per event (`lookup_settle` → `{ state: "inTransit" | "inTransit+overdue", wait }`, `action` → `{ action: "talk@header", state }`).
2. **`templatePath` (roadmap §11.9)** returns `/` and `/privacy` unchanged, `/[trackingNumber]` for number routes (`isNumberPath`), and `/[unknown]` for every other path, so no free text can leave through a path. `lib/analytics/url-template.ts` also exports `NUMBER_ROUTE_TEMPLATE`, `UNKNOWN_ROUTE_TEMPLATE`, `templateUrl`, `templateBeforeSend`, `isReferrerSafe`, `routeForDocument` (a deep-link document's first page view is filed under `/[trackingNumber]` although the address is already `/`).
3. **New S11 files (File Map additions):** `lib/analytics/gate.ts` (`AnalyticsGateDecision`, `AnalyticsGateInput`, `analyticsGate`), `lib/analytics/report.ts` (`MAX_QUEUED_EVENTS`, `REPEAT_WINDOW_MS`, `AnalyticsSink`, `PendingLookupStart`, `reportAnalyticsEvent`, `reportLookupStart`, `peekPendingLookupStart`, `consumePendingLookupStart`, `connectAnalyticsSink`, `disconnectAnalytics`, `resetAnalyticsReport`), `lib/analytics/dom-observer.ts` (`installAnalyticsObserver`), `lib/analytics/runtime.ts` (`SPEED_INSIGHTS_SAMPLE_RATE`, `AnalyticsRuntime`, `startAnalyticsRuntime`), `app/api/csp-report/route.ts` (listed in §10 already), `tests/support/insights-double.ts` (`installInsightsDoubles`, `insightsPosts`, `assertInsightsClean`, `isRecord`, `InsightsScriptKind`, `InsightsScriptRequest`, `InsightsPost`), `tests/e2e/csp-report.spec.ts`, `tests/unit/ops-docs.spec.ts`. Only S11 files import them, except `reportLookupStart` (imported by `components/lookup/useLookup.ts`).
4. **File Map modifications by S11 (rows gain "M S11"):** `components/lookup/useLookup.ts` (one import, one call in `submit`; signature unchanged), `components/primitives/NoticeBanner.tsx` (`data-notice-id` on both roots; no prop change), `lib/security/headers.ts` (the number-route rule overrides `Content-Security-Policy-Report-Only` with a report-address-free copy when `reportUri` is set), `tests/unit/security-headers.spec.ts` (the expected `next.config.ts` options gain `reportUri` next to S08's `extraScriptHashes`), `tests/unit/prepaint.spec.ts` (S08's style-independence scan: `lib/analytics/dom-observer.ts` joins its `ALLOWED` set, as S08 open issue 13 asks of the stage that adds a style reader; approval 13 only).
5. **New `data-*` hook:** `data-notice-id` on the `NoticeBanner` root (`aside` and `p`), value `NoticeView.id`.
6. **`lib/security/csp-report.ts` exports:** `CSP_REPORT_PATH` (`"/api/csp-report"`), `CSP_REPORT_MAX_BYTES` (16384), `CSP_REPORT_MAX_PER_BODY` (10), `CSP_LOG_EVENT` (`"csp_report"`), `CSP_LOG_LIMITS`, `CspDirective`, `BlockedKind`, `DocumentKind`, `CspReportSummary`, `parseCspReports`, `formatCspReportLog`, `CspReportLimiter`, `createCspReportLimiter`, `CspLogSink`, `setCspReportSink`, `handleCspReport`. `next.config.ts` keeps the literal `"/api/csp-report"` in a local constant (it cannot import `csp-report.ts`, whose imports use the `@/` alias); a unit test pins the two equal.
7. **Referrer rule (spec §11 "리퍼러를 지웁니다"):** `beforeSend` cannot reach the vendor script's referrer field, so S11 keeps the scripts off when the referrer has a path, query, hash or credentials, and lets a bare other-site origin (for example `https://m.search.naver.com/`) through. An origin names a site, not a customer; the operator can ask for "no referrer at all", which would mean overriding `document.referrer` for AdSense too (see "Open issues").
8. **Vendor entry points:** S11 uses the framework-agnostic `inject` / `pageview` / `track` (`@vercel/analytics`) and `injectSpeedInsights` (`@vercel/speed-insights`) instead of their `<Analytics/>` / `<SpeedInsights/>` components, whose Next.js variants compute routes from `useParams()` and would send a raw path when a param does not match (for example `%20`-encoded numbers). The contract's `components/analytics/Analytics.tsx` is S11's own gate component.
9. **Policy text location (Task C6):** the statistics sentences live in `app/(public)/privacy/page.tsx` next to S02's policy text (legal text, not UI copy from `config/site.config.ts`); the page gains the constant `R1_EFFECTIVE_DATE` so S02's change-log line keeps its own date.
10. **Stage-screen output path** follows S01's Addition 1: Task 0 Step 5 and gate G7 are the roadmap §6/§7 text with `test-artifacts/stage-screens/S11-before/` and `…/S11-after/` in place of `test-results/stage-screens/…` (Playwright empties `test-results/` at the start of every run, so Step 6 would delete the before-screens).

## File Structure

| Path | Action (task) | Responsibility |
|---|---|---|
| `docs/ops/observability-baseline.md` | Create (A1) | Weekly route counts, `/api/track` status codes, the 30 % deep-link rule, the manual 톡톡 classification sheet, AdSense and store backups |
| `tests/unit/ops-docs.spec.ts` | Create (A1), Modify (D1, D2, D3, D4) | Structure of every operator document; AdSense and CSP variants follow ledger rows 15 and 16 |
| `lib/security/csp-report.ts` | Create (B1) | Report parsing (zod), five-key summary, log line, limiter, sink seam, `handleCspReport` |
| `tests/unit/csp-report.spec.ts` | Create (B1), Modify (B2) | Summaries, limiter, handler (B1); route exports and `report-uri` wiring (B2) |
| `app/api/csp-report/route.ts` | Create (B2) | `POST` only, delegates to `handleCspReport` |
| `lib/security/headers.ts` | Modify (B2) | Number-route rule: Report-Only copy without `report-uri` when `reportUri` is set |
| `next.config.ts` | Modify (B2) | `buildSecurityHeaders({ …, reportUri: CSP_REPORT_URI })` |
| `tests/unit/security-headers.spec.ts` | Modify (B2) | S01's config test expects the `reportUri` option |
| `tests/e2e/csp-report.spec.ts` | Create (B2) | Headers per route, endpoint answers, browser reports around a deep link |
| `lib/analytics/url-template.ts` | Create (C1) | Path/URL templates, `beforeSend`, referrer rule, document route |
| `lib/analytics/gate.ts` | Create (C1) | `analyticsGate`: load / wait / never |
| `tests/unit/analytics-events.spec.ts` | Create (C1), Modify (C2, C3) | Templates and gate (C1); events (C2); report hand-off (C3) |
| `lib/analytics/events.ts` | Create (C2) | Event union, enum lists, validation, wire payload, link-click classification |
| `lib/analytics/report.ts` | Create (C3) | Per-document queue, lookup-start clock, sink connection |
| `package.json`, `package-lock.json` | Modify (C4) | `@vercel/analytics`, `@vercel/speed-insights` (approval 13) |
| `tests/support/insights-double.ts` | Create (C4) | Script doubles, payload parsing, `assertInsightsClean` |
| `tests/e2e/analytics-privacy.spec.ts` | Create (C4), Modify (C5, C6) | Loading rules and payload privacy (C4); hook events and `/internal` (C5); policy text (C6) |
| `lib/analytics/runtime.ts` | Create (C4), Modify (C5) | Vendor injection, page views, event sink (C4); DOM observer (C5) |
| `components/analytics/Analytics.tsx` | Create (C4) | Client gate component; lazy runtime after `load` + idle |
| `app/(public)/layout.tsx` | Modify (C4) | Mount `<Analytics />` after `<AdLoader />` |
| `components/lookup/useLookup.ts` | Modify (C4) | `reportLookupStart(request.entry, startedAt)` in `submit` |
| `lib/analytics/dom-observer.ts` | Create (C5) | Hooks → `lookup_settle`, `lookup_error`, `action`, `details_open`, `style_select`, `notice_view` |
| `components/primitives/NoticeBanner.tsx` | Modify (C5) | `data-notice-id` on both roots |
| `tests/unit/prepaint.spec.ts` | Modify (C5) | S08's style-independence scan allows `lib/analytics/dom-observer.ts` |
| `app/(public)/privacy/page.tsx` | Modify (C6) | Statistics disclosure, new 시행일 |
| `docs/ops/kpi-dashboard.md` | Create (D1) | Seven KPIs with both sources, events table, 15 % rule, enable steps |
| `docs/ops/adsense-settings-checklist.md` | Create (D2), Modify (D2A) | Vignette-only checklist (D2, '거절하면'); full approval-15 checklist (D2A) |
| `docs/ops/strict-csp-decision.md` | Create (D3), Modify (D3A) | Decision record: C안 (D3, '거절하면'); A안 adopted with start conditions (D3A) |
| `docs/ops/waf-internal-proposal.md` | Create (D4) | Two Vercel WAF rate-limit rules, log first |

**Budgets this stage owns (paste the measured values into the stage summary at G8):** analytics requests carry 0 tracking-like values (`tests/e2e/analytics-privacy.spec.ts`, every test calls `assertInsightsClean`); the CSP report endpoint stores and logs no number (`tests/unit/csp-report.spec.ts` endpoint rows, `tests/e2e/csp-report.spec.ts`); S07's `tests/budgets/js-budget.spec.ts` numbers before (Task 0 Step 6) and after (G6), with the `/` initial-bundle delta written down — the statistics runtime and both vendor scripts are lazy and must not count as initial.

## Execution Order and Gating

| Part | Tasks | Runs when | Fallback while not allowed (spec §16) |
|---|---|---|---|
| Start | Task 0 | before every part | — |
| A — baseline (R0 week) | A1 | the R0 week, on its own (roadmap §2) | — |
| Gate | Task Final | after Part A | — |
| B — CSP report collection | B1 → B2 | R5, after S06, S07 and S08 Part B (R3b) are merged | — (not gated) |
| C — statistics | C1 → C6 | approval 13 = `approved` | Mark C1–C6 SKIPPED "approval 13 pending": no package, no script, no event. Spec §16 item 13 '거절하면': judge by Observability route counts and the manual 톡톡 classification only — the KPI document (D1) already lists these as the fallback source. |
| D — operator documents | D1 → D2 → (D2A if approval 15 = `approved`) → D3 → (D3A if approval 16 = `approved`) → D4 | R5 | D2 is the approval-15 fallback ('비네트 추가 트리거만'); D3 is the approval-16 fallback ('1단계 헤더 유지') |
| Gate | Task Final | after Parts B–D | — |

Part A usually runs weeks before Parts B–D. Parts B–D re-use the branch `renewal/s11-r5-measurement-ops`: after Part A is merged, delete the old local branch (`git branch -D renewal/s11-r5-measurement-ops`), rename the Part A screen folders (`Rename-Item test-artifacts/stage-screens/S11-before S11A-before; Rename-Item test-artifacts/stage-screens/S11-after S11A-after`), and run Task 0 again (Step 10 marks A1 DONE-EARLIER).

## Conventions for this plan

- Shell: PowerShell 5.1 for `npm`, `npx`, `node` and `git` (no `&&`; use `;`). `$env:NAME='x'` sets a flag for the rest of the session; clear it with `$env:NAME=$null`. Paths with parentheses or brackets are quoted, and `Test-Path`/`Get-Content`/`Select-String` use `-LiteralPath`.
- **Unit run** (no web server): `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/<file>.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
- **Dev-mode run** (port 43210 free; Playwright starts `next dev`): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test <files>`
- **Production run** = `npm run build` (exit 0) → background PowerShell `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1` → wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200` → `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test <files>` → stop the server with `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }` and clear the flags `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`. `next start` warns `"next start" does not work with "output: standalone" configuration`; the server still runs.
- After a route file is added, delete stale generated route types before `npm run typecheck`: `if (Test-Path .next) { Remove-Item -Recurse -Force .next }`.
- Existing-file edits quote the exact text to find. Earlier stages may have reformatted the quoted text; if a quoted fragment is not found, apply the same change to the equivalent lines and write the difference into the stage summary. Task 0 Step 9 checks every anchor before any task starts.
- Digits in tests come from `tests/fixtures/tracking-fixtures.ts` only. This plan contains no 10+ digit run (S01's repo guard scans it).

---

### Task 0: Stage start

- [ ] **Step 1: Read approvals.** Open `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §4. For every approval number in this plan's "Gated by" list, write its Status into the stage summary. `pending`/`rejected` → execute the fallback steps and mark the gated task SKIPPED with the reason.
- [ ] **Step 2: Confirm dependencies.** Run (PowerShell): `git log --oneline claude/tipoasis-tracking-renewal-ae0e3a -40`
  Expected: a `merge: SNN …` commit for every stage in this plan's "Depends on" list.
- [ ] **Step 3: Branch.** Run: `git switch -c renewal/s11-r5-measurement-ops claude/tipoasis-tracking-renewal-ae0e3a`
  Expected: `Switched to a new branch 'renewal/s11-r5-measurement-ops'`.
- [ ] **Step 4: Port free.** Run: `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue`
  Expected: no output. Otherwise stop the listener: `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`
- [ ] **Step 5: Baseline build and before-screens.** Run `npm ci` only if `package-lock.json` changed since the last install in this worktree, then `npm run build`.
  Expected: build exits 0. Start the production server in a background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`
  Wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200`.
  Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='before'; $env:PW_STAGE='S11'; npx playwright test tests/tools/stage-screens.spec.ts`
  Expected: PNGs in `test-artifacts/stage-screens/S11-before/` for widths 320, 375, 768, 1024, 1440. (S01 creates the tool first; S01 runs this step after its Task 1.)
- [ ] **Step 6: Baseline suite.** With the server still running: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test`
  Expected: record "N passed / M skipped / 0 failed" in the stage summary. Then stop the server (Step 4 command) and clear the flags: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.

**S11 notes on the standard steps above**
- Step 1: the "Gated by" list is approvals 13, 15 and 16. Approval 13 selects Part C (`approved`) or its SKIPPED fallback. Approval 15 adds Task D2A. Approval 16 adds Task D3A. In the R0-week run (Part A) write the three statuses too; they decide nothing yet.
- Step 2: in the R0-week run (Part A) no merge is required (roadmap §2: "the baseline doc needs nothing"); write "Part A: dependencies not required" into the stage summary. For Parts B–D, `merge: S01 …`, `merge: S02 …`, `merge: S03 …`, `merge: S05 …`, `merge: S06 …`, `merge: S07 …` and S08's Part B merge (`merge: S08 supplementary areas and selectable styles`, or `merge: S08 Part B selectable styles` when S08 Part A was merged at the R3 checkpoint) must all be listed; a lone `merge: S08 Part A supplementary areas` is not enough (the picker, the pre-paint hash and the style scan are Part B). By R5 the last 40 commits no longer reach S01's merge, so confirm the list with the merges of the integration branch itself: `git log --oneline --merges --first-parent claude/tipoasis-tracking-renewal-ae0e3a | Select-String -Pattern 'merge: S0[1-8]'`. If one is missing, stop.
- Step 5 and gate G7: the output paths above and in G7 are the roadmap §6/§7 text with S01's Addition 1 applied (Additions item 10). If S01's tool does not exist yet (Part A in the R0 week before S01 Task 1 is merged), skip the stage-screens command and write "stage screens: tool not merged yet" into the stage summary.
- Step 6: in the Parts B–D run, copy the budget lines that `tests/budgets/js-budget.spec.ts` (S07) prints into the stage summary under "JS before S11"; G8 compares against them.

- [ ] **Step 7 (S11): Pick the part.** If `git log --oneline claude/tipoasis-tracking-renewal-ae0e3a | Select-String -Pattern 'docs: add the observability baseline procedure'` prints nothing (the whole history: Part A was merged in the R0 week, hundreds of commits before R5), this run is **Part A** (Task A1, then Task Final). Otherwise this run is **Parts B–D** (Tasks B1, B2, C1–C6 or their SKIPPED note, D1–D4 with D2A/D3A as the ledger says, then Task Final). Write the choice into the stage summary.

- [ ] **Step 8 (S11, Parts B–D only): Dependency artifacts exist.** Run:
  `Test-Path -LiteralPath lib/security/headers.ts, next.config.ts, tests/unit/security-headers.spec.ts, lib/privacy/number-patterns.ts, lib/privacy/url-scrub.ts, lib/ads/ad-signals.ts, lib/ads/ad-gate.ts, components/ads/AdLoader.tsx, tests/support/network-capture.ts, tests/fixtures/tracking-fixtures.ts, lib/tracking/types.ts, lib/style/styles.ts, components/lookup/useLookup.ts, components/primitives/NoticeBanner.tsx, components/result/ResultView.tsx, components/shell/StylePicker.tsx, "app/(public)/layout.tsx", "app/(public)/privacy/page.tsx", tests/budgets/js-budget.spec.ts, lib/style/prepaint.ts, tests/unit/prepaint.spec.ts`
  Expected: 21 lines `True`. Any `False` → stop; the owning stage is not merged (S01: `headers.ts`, `next.config.ts`, `security-headers.spec.ts`, `number-patterns.ts`, `tracking-fixtures.ts`; S02: `url-scrub.ts`, `ad-signals.ts`, `ad-gate.ts`, `AdLoader.tsx`, `network-capture.ts`; S03: `types.ts`; S05: `styles.ts`, `NoticeBanner.tsx`; S04/S06: `useLookup.ts`; S07: `ResultView.tsx`, `js-budget.spec.ts`; S08 Part B: `StylePicker.tsx`, `prepaint.ts`, `prepaint.spec.ts`; S01/S02/S06/S08: the two `app/(public)` files).

- [ ] **Step 9 (S11, Parts B–D only): Every anchor this plan edits is where the plan expects it.** Run each line and compare:
  1. `Select-String -LiteralPath lib/security/headers.ts -Pattern 'headers: \[\{ key: "X-Robots-Tag", value: NOINDEX \}\]'` → exactly 1 line (the number-route rule, Task B2 Step 5).
  2. `Select-String -LiteralPath next.config.ts -Pattern 'buildSecurityHeaders\('` → exactly 1 line, and it contains `buildSecurityHeaders({ extraScriptHashes: [PREPAINT_CSP_SOURCE] })` (S08 Task 12; Task B2 Step 6).
  3. `Select-String -LiteralPath tests/unit/security-headers.spec.ts -Pattern 'buildSecurityHeaders\(\{ extraScriptHashes: \[PREPAINT_CSP_SOURCE\] \}\)'` → exactly 1 line (the expected call in the test "next.config.ts serves these rules …" as S08 Task 12 left it; Task B2 Step 7).
  4. `Select-String -LiteralPath components/lookup/useLookup.ts -Pattern 'apply\(\{ type: "submit", request, at: startedAt \}\);'` → exactly 1 line (Task C4 Step 9).
  5. `Select-String -LiteralPath components/primitives/NoticeBanner.tsx -Pattern 'data-notice-kind=\{notice\.kind\}'` → exactly 2 lines (Task C5 Step 6).
  6. `Select-String -LiteralPath "app/(public)/layout.tsx" -Pattern '<AdLoader />|import \{ AdLoader \}'` → 2 lines (Task C4 Step 8).
  7. `Select-String -LiteralPath "app/(public)/privacy/page.tsx" -Encoding UTF8 -Pattern 'const LAST_UPDATED|const PREVIOUS_EFFECTIVE_DATE|2\. 자동으로 기록되는 정보|7\. 방침 변경|과도한 요청을 막기 위해'` → 5 lines (Task C6 Step 5).
  8. `git grep -n -e 'data-view-state=' -e 'data-result-view=' -e 'data-history' -e 'data-style-picker' -e 'data-failure-cause=' -- components` → at least one line for each of the five hooks (Task C5's observer reads them).
  9. `git grep -n -e 'data-link-placement' -e 'data-affiliate-group' -- components/primitives` → lines in `ButtonLink.tsx` and `AffiliateLinkGroup.tsx`.
  10. `Select-String -LiteralPath tests/unit/prepaint.spec.ts -Pattern '^\s+"components/shell/StylePicker\.tsx"$'` → exactly 1 line (the last entry of the `ALLOWED` set in S08's style-independence scan, Task C5 Step 7).
  Any mismatch → stop and report which task's anchor must be amended; do not improvise an edit on a different shape.

- [ ] **Step 10 (S11): Skip work that already exists.** Run: `git log --oneline claude/tipoasis-tracking-renewal-ae0e3a | Select-String -Pattern 'observability baseline|CSP report|report-uri|statistics|analytics|KPI dashboard|AdSense account|strict CSP|WAF'`
  Expected: in the R0-week run no hit equals an S11 commit message; in the Parts B–D run only Part A's commit and its `merge: S11 …` commit do. A hit whose subject equals the commit message in an S11 task's last step names a task that is already merged: mark it DONE-EARLIER in the stage summary and skip it. Hits that equal no S11 commit message are other stages' or older commits: ignore them.

---

## Part A — Observability baseline (R0 week, no code)

### Task A1: Observability baseline procedure

**Files:**
- Create: `docs/ops/observability-baseline.md`
- Test: `tests/unit/ops-docs.spec.ts` (create)

**Interfaces:**
- Consumes: nothing from other stages (roadmap §2). Cites S10's `track_lookup` log line and S09's [고객 링크 복사] by name only.
- Produces: `docs/ops/observability-baseline.md` (weekly table and 판정 기록 that `docs/ops/kpi-dashboard.md` compares against); `tests/unit/ops-docs.spec.ts` with the private helpers `read(relative)` and `expectAll(document, needles)` that Tasks D1–D4 reuse.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ops-docs.spec.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/** Structure checks for the operator documents S11 writes (roadmap §10.5). The repo guard (S01) checks their digits. */
const read = (relative: string): string => readFileSync(path.join(process.cwd(), relative), "utf8");

function expectAll(document: string, needles: readonly string[]): void {
  const text = read(document);
  for (const needle of needles) expect(text, `${document} must contain: ${needle}`).toContain(needle);
}

test.describe("operator documents (S11)", () => {
  test("the observability baseline has the routes, codes, 30 % rule and the weekly 톡톡 sheet", () => {
    expectAll("docs/ops/observability-baseline.md", [
      "최소 2주",
      "`/`",
      "`/[trackingNumber]`",
      "`/api/track`",
      "200, 400, 404, 429, 5xx",
      "딥링크 비중",
      "30 % 이상",
      "30 % 미만",
      "위치·언제 와요",
      "통관 지연·정체",
      "번호·조회 안 됨",
      "미수령",
      "개인통관고유부호",
      "기타",
      "조회 화면을 보고도 문의했는지",
      "저장소에 넣지 않고",
      "주간 기록 표",
      "판정 기록"
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ops-docs.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `1 failed` with `ENOENT: no such file or directory, open '…\docs\ops\observability-baseline.md'`.

- [ ] **Step 3: Write the baseline procedure**

Create `docs/ops/observability-baseline.md`:

```markdown
# 관측 기준선: 개편 전 최소 2주

- 목적: 개편(R3)의 효과를 비교할 기준을 코드 변경 없이 모읍니다(스펙 §11 "1단계: 지금, 코드 변경 0").
- 시작: R0(즉시 조치) 배포 주. 매주 월요일 오전에 지난주(월~일, KST) 값을 적습니다.
- 기간: 개편 배포 전 최소 2주, 가능하면 4주. 개편 뒤에도 같은 방식으로 4주를 더 적어 전후를 비교합니다(`kpi-dashboard.md`).
- 담당: 운영자. 에이전트는 Vercel·AdSense·파트너 대시보드에 접속하지 않습니다.
- 개인정보: 조회번호·전화번호·고객 이름·주문번호는 어디에도 옮겨 적지 않습니다. 건수만 적습니다.

## 1. 라우트별 요청 수(주간)

1. Vercel 대시보드 → 프로젝트 `tracking-tipoasis` → Observability → Edge Requests(없으면 Vercel Functions)를 엽니다.
2. 기간을 지난 7일로 두고 경로(Route)로 묶습니다.
3. `/`, `/[trackingNumber]`, `/api/track`의 요청 수를 아래 주간 표에 적습니다. 봇 필터가 있으면 봇을 뺀 값을 적고, 비고에 전체 값을 적습니다.
4. 화면 이름은 대시보드 버전에 따라 조금 다를 수 있습니다. 보이는 이름을 비고에 그대로 적습니다.

## 2. `/api/track` 상태 코드(주간)

- 같은 화면에서 `/api/track`을 상태 코드로 나눠 200, 400, 404, 429, 5xx(500·502·503·504 합계)를 적습니다.
- 상태 코드 나눔이 없으면 Logs 탭에서 경로 `/api/track`과 상태 코드로 걸러 셉니다. 로그 보관 기간이 짧으니 매주 월요일에 바로 적습니다.
- 승인 5(서버 경로)가 배포된 뒤에는 런타임 로그의 `track_lookup` 줄(S10)에서 `resultKind`, `elapsedBucket`별 건수도 비고에 적습니다.

## 3. 딥링크 비중과 30 % 규칙

- 딥링크 비중 = `/[trackingNumber]` 요청 ÷ (`/` 요청 + `/[trackingNumber]` 요청). 2주 합계로 계산합니다.
- 30 % 이상: 하이드레이션 전 조회 선시작을 후속 과제로 검토합니다(스펙 §11, 로드맵 §3 질문 2).
- 30 % 미만: 선시작은 보류하고, CS 답변과 주문·배송 알림에 `/{번호}` 링크를 넣는 일부터 합니다(S09 [고객 링크 복사]).
- 판정한 날짜, 기간, 비중, 결정을 이 문서 끝 "판정 기록"에 적습니다.

## 4. 톡톡 문의 주간 분류(수기)

한 문의는 한 분류로 셉니다. 고객이 가장 먼저 말한 이유를 기준으로 합니다.

| 분류 | 예 |
|---|---|
| 위치·언제 와요 | 지금 어디쯤인가요, 언제 도착하나요 |
| 통관 지연·정체 | 통관이 며칠째 그대로예요 |
| 번호·조회 안 됨 | 번호를 넣어도 결과가 안 나와요 |
| 미수령 | 배송 완료로 나오는데 못 받았어요 |
| 개인통관고유부호 | 부호가 다르다는 안내, 부호 수정 요청 |
| 기타 | 위에 없는 문의 |

- 문의마다 '조회 화면을 보고도 문의했는지'를 예·아니오·모름으로 표시합니다. 대화에 조회 화면 캡처나 조회 링크가 있거나, 고객이 조회 화면을 봤다고 말하면 '예'입니다.
- 분류는 건수만 셉니다. 대화 내용, 번호, 전화번호는 옮겨 적지 않습니다.

## 5. 함께 적어 둘 것

- R1(번호 보호) 배포 전: AdSense 보고서에서 지난 4주의 수익과 RPM을 `/`와 번호 주소 두 묶음의 합계로 적습니다. 페이지별로 내려받은 원본 파일에는 실제 조회번호가 들어 있으니 저장소에 넣지 않고 합계만 적습니다.
- 스토어 클릭: 네이버·쿠팡 파트너 대시보드에서 배치별 링크(`config/site.config.ts`의 `channels.naver.urls`, `channels.coupang.urls`: shortcut, showcase, pending, deliveredLead)의 주간 클릭 수를 적습니다.

## 주간 기록 표

| 주(월요일) | `/` | `/[trackingNumber]` | `/api/track` | 200 | 400 | 404 | 429 | 5xx | 딥링크 비중 | 톡톡 합계 | 위치·언제 와요 | 통관 지연·정체 | 번호·조회 안 됨 | 미수령 | 개인통관고유부호 | 기타 | 조회 화면 보고 문의 | 비고 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | | | | | | | | | |

## 판정 기록

| 날짜 | 기간 | 딥링크 비중 | 결정 |
|---|---|---|---|
| | | | |
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ops-docs.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `1 passed`.
If `tests/unit/real-number-guard.spec.ts` exists (`Test-Path tests/unit/real-number-guard.spec.ts` → `True` once S01 Task 4 is merged), run it too: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null` → 0 failed.

- [ ] **Step 5: Lint**

Run: `npx eslint tests/unit/ops-docs.spec.ts`
Expected: no output.

- [ ] **Step 6: Commit**

Run: `git add docs/ops/observability-baseline.md tests/unit/ops-docs.spec.ts; git commit -m "docs: add the observability baseline procedure for the R0 week"`
Expected: `2 files changed`.

- [ ] **Step 7: Hand the procedure to the operator**

Send `docs/ops/observability-baseline.md` with SendUserFile (caption: "R0 주부터 매주 월요일에 채울 관측 기준선입니다. 개편 전 최소 2주가 필요합니다."). Write into the stage summary: "baseline starts the Monday after the R0 deploy; the 30 % deep-link decision is due after two filled weeks".

---

## Part B — CSP Report-Only collection (R5)

### Task B1: Number-free CSP report summaries and the endpoint handler

**Files:**
- Create: `lib/security/csp-report.ts`
- Test: `tests/unit/csp-report.spec.ts` (create)

**Interfaces:**
- Consumes: `containsTrackingLikeValue(text: string): boolean` (S01, `lib/privacy/number-patterns.ts`); `z` (zod 3.25, server-side only); test-only `FAKE` (S01 fixtures).
- Produces (Additions item 6): `CSP_REPORT_PATH = "/api/csp-report"`, `CSP_REPORT_MAX_BYTES = 16384`, `CSP_REPORT_MAX_PER_BODY = 10`, `CSP_LOG_EVENT = "csp_report"`, `CSP_LOG_LIMITS = { windowMs: 60000, maxPerWindow: 60, dedupeMs: 600000, remembered: 200 }`, `type CspDirective`, `type BlockedKind = "inline" | "eval" | "data" | "blob" | "self" | "host" | "other"`, `type DocumentKind = "home" | "number" | "privacy" | "internal" | "other"`, `interface CspReportSummary { directive; blocked; blockedHost: string | null; documentKind; disposition: "enforce" | "report" }`, `parseCspReports(body: unknown): readonly CspReportSummary[]`, `formatCspReportLog(summary: CspReportSummary): string`, `interface CspReportLimiter { admit(line: string, now: number): boolean }`, `createCspReportLimiter(limits?): CspReportLimiter`, `type CspLogSink = (line: string) => void`, `setCspReportSink(next: CspLogSink | null): void`, `handleCspReport(request: Request, options?: { limiter?: CspReportLimiter; now?: () => number }): Promise<Response>`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/csp-report.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import {
  CSP_LOG_LIMITS,
  CSP_REPORT_MAX_BYTES,
  CSP_REPORT_PATH,
  createCspReportLimiter,
  formatCspReportLog,
  handleCspReport,
  parseCspReports,
  setCspReportSink
} from "@/lib/security/csp-report";
import type { CspReportSummary } from "@/lib/security/csp-report";
import { FAKE } from "../fixtures/tracking-fixtures";

const PAGE = "https://tracking.tipoasis.com";
const AD_SCRIPT = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-x&url=${encodeURIComponent(`${PAGE}/${FAKE.domestic}`)}`;

function legacyReport(fields: Readonly<Record<string, string | number>>): unknown {
  return { "csp-report": fields };
}

function reportRequest(body: string, headers: Readonly<Record<string, string>> = {}): Request {
  return new Request(`${PAGE}${CSP_REPORT_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/csp-report", ...headers },
    body
  });
}

test.describe("CSP report summaries (S11)", () => {
  test("a legacy report becomes a fixed-shape summary without the addresses", () => {
    const [summary] = parseCspReports(
      legacyReport({
        "document-uri": `${PAGE}/${FAKE.domestic}?c=CJ`,
        referrer: `https://shop.example/orders/${FAKE.domestic}`,
        "violated-directive": "script-src-elem",
        "effective-directive": "script-src-elem",
        "original-policy": "default-src 'self'",
        "blocked-uri": AD_SCRIPT,
        "source-file": `${PAGE}/${FAKE.domestic}`,
        "line-number": 1,
        "script-sample": `track(${FAKE.domestic})`,
        disposition: "report",
        "status-code": 200
      })
    );
    expect(summary).toEqual({
      directive: "script-src-elem",
      blocked: "host",
      blockedHost: "pagead2.googlesyndication.com",
      documentKind: "number",
      disposition: "report"
    });
  });

  test("a Reporting API batch keeps only csp-violation entries, at most ten", () => {
    const entry = {
      type: "csp-violation",
      url: `${PAGE}/`,
      body: { documentURL: `${PAGE}/`, effectiveDirective: "style-src-attr", blockedURL: "inline", disposition: "enforce", sample: FAKE.hbl }
    };
    const batch = [...Array.from({ length: 12 }, () => entry), { type: "deprecation", body: {} }];
    const summaries = parseCspReports(batch);
    expect(summaries).toHaveLength(10);
    expect(summaries[0]).toEqual({ directive: "style-src-attr", blocked: "inline", blockedHost: null, documentKind: "home", disposition: "enforce" });
  });

  test("blocked addresses and pages fall into small enums", () => {
    const summarize = (blockedUri: string, documentUri = `${PAGE}/`): CspReportSummary | undefined =>
      parseCspReports(legacyReport({ "document-uri": documentUri, "effective-directive": "img-src", "blocked-uri": blockedUri }))[0];
    expect(summarize("eval")?.blocked).toBe("eval");
    expect(summarize("wasm-eval")?.blocked).toBe("eval");
    expect(summarize("data")?.blocked).toBe("data");
    expect(summarize("data:image/png;base64,AAAA")?.blocked).toBe("data");
    expect(summarize("blob")?.blocked).toBe("blob");
    expect(summarize(`${PAGE}/_next/static/chunk.js`)).toMatchObject({ blocked: "self", blockedHost: null });
    expect(summarize(`https://${FAKE.domestic}.example/x.js`)).toMatchObject({ blocked: "host", blockedHost: "[redacted]" });
    expect(summarize("chrome-extension://abc/x.js")?.blocked).toBe("other");
    expect(summarize("")?.blocked).toBe("other");
    expect(summarize("inline", `${PAGE}/privacy`)?.documentKind).toBe("privacy");
    expect(summarize("inline", `${PAGE}/internal/cs-helper`)?.documentKind).toBe("internal");
    expect(summarize("inline", `${PAGE}/${FAKE.hbl}`)?.documentKind).toBe("number");
    expect(summarize("inline", `${PAGE}/a/b`)?.documentKind).toBe("other");
    expect(summarize("inline", "about:blank")?.documentKind).toBe("other");
    expect(parseCspReports(legacyReport({ "violated-directive": "require-trusted-types-for 'script'" }))[0]?.directive).toBe("other");
  });

  test("malformed bodies produce no summary", () => {
    for (const body of [null, "report", 12, {}, { "csp-report": "x" }, [{ type: "csp-violation" }], [{ type: 1, body: {} }]]) {
      expect(parseCspReports(body), JSON.stringify(body)).toEqual([]);
    }
  });

  test("a log line has five fixed keys and never a number", () => {
    const line = formatCspReportLog({
      directive: "script-src-elem",
      blocked: "host",
      blockedHost: "pagead2.googlesyndication.com",
      documentKind: "number",
      disposition: "report"
    });
    expect(line).toBe(
      'csp_report {"directive":"script-src-elem","blocked":"host","blockedHost":"pagead2.googlesyndication.com","documentKind":"number","disposition":"report"}'
    );
    expect(containsTrackingLikeValue(line)).toBe(false);
  });

  test("the limiter admits each distinct line once per ten minutes and at most sixty lines a minute", () => {
    const limiter = createCspReportLimiter();
    expect(limiter.admit("a", 0)).toBe(true);
    expect(limiter.admit("a", 1000)).toBe(false);
    expect(limiter.admit("a", CSP_LOG_LIMITS.dedupeMs)).toBe(true);
    const flood = createCspReportLimiter();
    const admitted = Array.from({ length: 100 }, (_, index) => flood.admit(`line-${index}`, 5)).filter(Boolean).length;
    expect(admitted).toBe(CSP_LOG_LIMITS.maxPerWindow);
    expect(flood.admit("next-minute", 5 + CSP_LOG_LIMITS.windowMs)).toBe(true);
  });
});

test.describe("CSP report endpoint (S11)", () => {
  const lines: string[] = [];
  test.beforeEach(() => {
    lines.length = 0;
    setCspReportSink((line) => lines.push(line));
  });
  test.afterEach(() => setCspReportSink(null));

  test("a report with a number in every address is logged as a number-free summary and answered with 204", async () => {
    const body = JSON.stringify(
      legacyReport({
        "document-uri": `${PAGE}/${FAKE.domestic}`,
        referrer: `https://shop.example/${FAKE.hbl}`,
        "effective-directive": "script-src-elem",
        "blocked-uri": AD_SCRIPT
      })
    );
    const response = await handleCspReport(reportRequest(body), { limiter: createCspReportLimiter(), now: () => 0 });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(lines).toHaveLength(1);
    expect(containsTrackingLikeValue(lines.join("\n"))).toBe(false);
  });

  test("oversized, foreign and malformed requests are ignored without a log line", async () => {
    const limiter = createCspReportLimiter();
    const valid = JSON.stringify(legacyReport({ "document-uri": `${PAGE}/`, "blocked-uri": "inline", "effective-directive": "script-src-elem" }));
    const requests = [
      reportRequest(valid, { "content-length": String(CSP_REPORT_MAX_BYTES + 1) }),
      reportRequest(`${valid}${" ".repeat(CSP_REPORT_MAX_BYTES)}`),
      reportRequest(valid, { "content-type": "text/plain" }),
      reportRequest("{not json")
    ];
    for (const request of requests) {
      const response = await handleCspReport(request, { limiter, now: () => 0 });
      expect(response.status).toBe(204);
    }
    expect(lines).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/csp-report.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading the file — `Error: Cannot find module '@/lib/security/csp-report'`.

- [ ] **Step 3: Write the module**

Create `lib/security/csp-report.ts`:

```ts
import { z } from "zod";
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";

/**
 * CSP Report-Only collection (spec §12 "최소 강제 CSP + Report-Only", §16 item 16: observe before deciding strict CSP).
 * Server only. A browser report carries the page address (document-uri), the blocked address and sometimes the referrer,
 * so nothing from it is stored or logged as-is: each report becomes a fixed-shape, number-free summary line, and the
 * lines are rate-limited and de-duplicated per server instance.
 */
export const CSP_REPORT_PATH = "/api/csp-report";
export const CSP_REPORT_MAX_BYTES = 16384;
export const CSP_REPORT_MAX_PER_BODY = 10;
export const CSP_LOG_EVENT = "csp_report";

const KNOWN_DIRECTIVES = [
  "default-src", "script-src", "script-src-elem", "script-src-attr", "style-src", "style-src-elem", "style-src-attr",
  "img-src", "font-src", "connect-src", "frame-src", "child-src", "worker-src", "manifest-src", "media-src",
  "object-src", "base-uri", "form-action", "frame-ancestors"
] as const;
export type CspDirective = (typeof KNOWN_DIRECTIVES)[number] | "other";
export type BlockedKind = "inline" | "eval" | "data" | "blob" | "self" | "host" | "other";
export type DocumentKind = "home" | "number" | "privacy" | "internal" | "other";

export interface CspReportSummary {
  readonly directive: CspDirective;
  readonly blocked: BlockedKind;
  readonly blockedHost: string | null; // hostname only, for "host"; "[redacted]" when it looks like it carries a number
  readonly documentKind: DocumentKind;
  readonly disposition: "enforce" | "report";
}

const LegacyReportSchema = z.object({
  "csp-report": z
    .object({
      "document-uri": z.string().max(4096).optional(),
      "violated-directive": z.string().max(1024).optional(),
      "effective-directive": z.string().max(256).optional(),
      "blocked-uri": z.string().max(4096).optional(),
      disposition: z.string().max(32).optional()
    })
    .passthrough()
});
const ReportingApiSchema = z
  .array(
    z
      .object({
        type: z.string(),
        body: z
          .object({
            documentURL: z.string().max(4096).optional(),
            effectiveDirective: z.string().max(256).optional(),
            blockedURL: z.string().max(4096).optional(),
            disposition: z.string().max(32).optional()
          })
          .passthrough()
      })
      .passthrough()
  )
  .max(100);

interface RawReport {
  readonly documentUri: string;
  readonly directive: string;
  readonly blockedUri: string;
  readonly disposition: string;
}

const SAFE_HOST = /^[a-z0-9.-]{1,253}$/;
const REDACTED_HOST = "[redacted]";

const isKnownDirective = (value: string): value is (typeof KNOWN_DIRECTIVES)[number] =>
  (KNOWN_DIRECTIVES as readonly string[]).includes(value);

function toDirective(value: string): CspDirective {
  const name = value.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return isKnownDirective(name) ? name : "other";
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function toDocumentKind(documentUri: string): DocumentKind {
  const url = parseUrl(documentUri);
  if (url === null) return "other";
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  if (path === "/privacy") return "privacy";
  if (path === "/internal" || path.startsWith("/internal/")) return "internal";
  return /^\/[^/.]+$/.test(path) ? "number" : "other";
}

function toBlocked(blockedUri: string, documentUri: string): Pick<CspReportSummary, "blocked" | "blockedHost"> {
  const value = blockedUri.trim().toLowerCase();
  if (value === "inline") return { blocked: "inline", blockedHost: null };
  if (value === "eval" || value === "wasm-eval") return { blocked: "eval", blockedHost: null };
  if (value === "data" || value.startsWith("data:")) return { blocked: "data", blockedHost: null };
  if (value === "blob" || value.startsWith("blob:")) return { blocked: "blob", blockedHost: null };
  const blocked = parseUrl(blockedUri);
  if (blocked === null || (blocked.protocol !== "https:" && blocked.protocol !== "http:")) return { blocked: "other", blockedHost: null };
  const page = parseUrl(documentUri);
  if (page !== null && page.origin === blocked.origin) return { blocked: "self", blockedHost: null };
  const host = blocked.hostname;
  const safe = SAFE_HOST.test(host) && !containsTrackingLikeValue(host);
  return { blocked: "host", blockedHost: safe ? host : REDACTED_HOST };
}

function toDisposition(value: string): CspReportSummary["disposition"] {
  return value.toLowerCase() === "enforce" ? "enforce" : "report";
}

function summarize(raw: RawReport): CspReportSummary {
  return {
    directive: toDirective(raw.directive),
    ...toBlocked(raw.blockedUri, raw.documentUri),
    documentKind: toDocumentKind(raw.documentUri),
    disposition: toDisposition(raw.disposition)
  };
}

/** Both report formats: `application/csp-report` (report-uri) and `application/reports+json` (Reporting API). */
export function parseCspReports(body: unknown): readonly CspReportSummary[] {
  const legacy = LegacyReportSchema.safeParse(body);
  if (legacy.success) {
    const report = legacy.data["csp-report"];
    return [
      summarize({
        documentUri: report["document-uri"] ?? "",
        directive: report["effective-directive"] ?? report["violated-directive"] ?? "",
        blockedUri: report["blocked-uri"] ?? "",
        disposition: report.disposition ?? ""
      })
    ];
  }
  const modern = ReportingApiSchema.safeParse(body);
  if (!modern.success) return [];
  return modern.data
    .filter((report) => report.type === "csp-violation")
    .slice(0, CSP_REPORT_MAX_PER_BODY)
    .map((report) =>
      summarize({
        documentUri: report.body.documentURL ?? "",
        directive: report.body.effectiveDirective ?? "",
        blockedUri: report.body.blockedURL ?? "",
        disposition: report.body.disposition ?? ""
      })
    );
}

/** `csp_report {"directive":…,"blocked":…,"blockedHost":…,"documentKind":…,"disposition":…}` — five fixed keys, no number. */
export function formatCspReportLog(summary: CspReportSummary): string {
  const line = `${CSP_LOG_EVENT} ${JSON.stringify({
    directive: summary.directive,
    blocked: summary.blocked,
    blockedHost: summary.blockedHost,
    documentKind: summary.documentKind,
    disposition: summary.disposition
  })}`;
  return containsTrackingLikeValue(line) ? `${CSP_LOG_EVENT} {"redacted":true}` : line;
}

export interface CspReportLimiter {
  /** true when this summary may be logged now: at most `maxPerWindow` lines per window, each distinct line once per `dedupeMs`. */
  readonly admit: (line: string, now: number) => boolean;
}

export const CSP_LOG_LIMITS = { windowMs: 60000, maxPerWindow: 60, dedupeMs: 600000, remembered: 200 } as const;

export function createCspReportLimiter(limits: typeof CSP_LOG_LIMITS = CSP_LOG_LIMITS): CspReportLimiter {
  let windowStart = Number.NEGATIVE_INFINITY;
  let count = 0;
  let seen: ReadonlyMap<string, number> = new Map();
  return {
    admit: (line: string, now: number): boolean => {
      if (now - windowStart >= limits.windowMs) {
        windowStart = now;
        count = 0;
      }
      const lastAt = seen.get(line);
      if (lastAt !== undefined && now - lastAt < limits.dedupeMs) return false;
      if (count >= limits.maxPerWindow) return false;
      count += 1;
      const recent = [...seen].filter(([, at]) => now - at < limits.dedupeMs).slice(-(limits.remembered - 1));
      seen = new Map([...recent, [line, now]]);
      return true;
    }
  };
}

export type CspLogSink = (line: string) => void;
const consoleSink: CspLogSink = (line) => console.info(line);
let sink: CspLogSink = consoleSink;

/** Test seam; null restores the console sink. */
export function setCspReportSink(next: CspLogSink | null): void {
  sink = next ?? consoleSink;
}

const ACCEPTED_TYPES = ["application/csp-report", "application/reports+json", "application/json"] as const;
const sharedLimiter = createCspReportLimiter();

function noContent(): Response {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

/**
 * POST /api/csp-report. Always answers 204 (a reporter learns nothing). Oversized, foreign or malformed bodies are ignored
 * without logging; valid reports become summary lines through the limiter.
 */
export async function handleCspReport(
  request: Request,
  options: { readonly limiter?: CspReportLimiter; readonly now?: () => number } = {}
): Promise<Response> {
  const limiter = options.limiter ?? sharedLimiter;
  const now = options.now ?? Date.now;
  const type = (request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (!(ACCEPTED_TYPES as readonly string[]).includes(type)) return noContent();
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > CSP_REPORT_MAX_BYTES) return noContent();
  let text: string;
  try {
    text = await request.text();
  } catch {
    return noContent();
  }
  if (text.length > CSP_REPORT_MAX_BYTES) return noContent();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return noContent();
  }
  for (const summary of parseCspReports(body)) {
    const line = formatCspReportLog(summary);
    if (limiter.admit(line, now())) sink(line);
  }
  return noContent();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/csp-report.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `8 passed`.

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck; npx eslint lib/security/csp-report.ts tests/unit/csp-report.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 6: Commit**

Run: `git add lib/security/csp-report.ts tests/unit/csp-report.spec.ts; git commit -m "feat: summarize CSP reports without numbers and rate-limit their log lines"`
Expected: `2 files changed`.

---

### Task B2: Report address wiring — endpoint, number-route override, `next.config.ts`

**Files:**
- Create: `app/api/csp-report/route.ts`
- Modify: `lib/security/headers.ts` (the `NUMBER_ROUTE_SOURCE` rule inside `buildSecurityHeaders`)
- Modify: `next.config.ts` (one constant after the imports; the `buildSecurityHeaders(` call)
- Modify: `tests/unit/security-headers.spec.ts` (one import; the expected value in the test "next.config.ts serves these rules and drops the X-Powered-By header")
- Test: `tests/unit/csp-report.spec.ts` (append), `tests/e2e/csp-report.spec.ts` (create)

**Interfaces:**
- Consumes: Task B1 (`CSP_REPORT_PATH`, `handleCspReport`); S01 `buildSecurityHeaders(options?: SecurityHeaderOptions): HeaderRule[]`, `NUMBER_ROUTE_SOURCE`, `HeaderRule`, `SecurityHeaderOptions.reportUri`; S08 Task 12's `next.config.ts` call `buildSecurityHeaders({ extraScriptHashes: [PREPAINT_CSP_SOURCE] })` and the same expected call in S01's config test (`PREPAINT_CSP_SOURCE` from `lib/style/prepaint.ts`); S02 `captureThirdParty`, `assertNoTrackingValues`, `waitForIdle`; S01 `FAKE`, `mockTrack`, `trackData`.
- Produces: `POST /api/csp-report` (always 204, `Cache-Control: no-store`; `GET` → 405); every public page's `Content-Security-Policy-Report-Only` ends with `report-uri /api/csp-report`; the number-route rule carries the same Report-Only policy without `report-uri` (only when a `reportUri` is set, so S01's option-less tests stay as they are).

- [ ] **Step 1: Append the failing wiring tests**

In `tests/unit/csp-report.spec.ts`, add below the existing import lines:

```ts
import { NUMBER_ROUTE_SOURCE, buildSecurityHeaders } from "@/lib/security/headers";
import type { HeaderRule } from "@/lib/security/headers";
import nextConfig from "@/next.config";
import * as route from "@/app/api/csp-report/route";
```

Append at the end of the file:

```ts
const reportOnlyOf = (rule: HeaderRule | undefined): string =>
  rule?.headers.find((header) => header.key === "Content-Security-Policy-Report-Only")?.value ?? "";

test("the route exports only POST", () => {
  expect(Object.keys(route).sort()).toEqual(["POST"]);
});

test.describe("report-uri wiring (S11)", () => {
  test("next.config.ts sends reports to the endpoint from every page except number routes", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const [allRoutes] = rules;
    const numberRoute = rules.find((rule) => rule.source === NUMBER_ROUTE_SOURCE);
    expect(reportOnlyOf(allRoutes)).toContain(`report-uri ${CSP_REPORT_PATH}`);
    expect(reportOnlyOf(numberRoute)).toContain("default-src 'self'");
    expect(reportOnlyOf(numberRoute)).not.toContain("report-uri");
  });

  test("the number-route override exists only when a report URI is set", () => {
    const numberRule = (rules: HeaderRule[]): HeaderRule | undefined => rules.find((rule) => rule.source === NUMBER_ROUTE_SOURCE);
    expect(reportOnlyOf(numberRule(buildSecurityHeaders()))).toBe("");
    const withUri = buildSecurityHeaders({ reportUri: CSP_REPORT_PATH, extraScriptHashes: ["'sha256-abc='"] });
    expect(reportOnlyOf(numberRule(withUri))).toBe(reportOnlyOf(withUri[0]).replace(`; report-uri ${CSP_REPORT_PATH}`, ""));
  });
});
```

- [ ] **Step 2: Write the failing E2E test**

Create `tests/e2e/csp-report.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { CSP_REPORT_PATH } from "@/lib/security/csp-report";
import { FAKE, mockTrack, trackData } from "../fixtures/tracking-fixtures";
import { assertNoTrackingValues, captureThirdParty, waitForIdle } from "../support/network-capture";

const REPORT_ONLY = "content-security-policy-report-only";

test.describe("CSP Report-Only collection (S11)", () => {
  test("public pages report to the endpoint; number routes keep the policy without a report address", async ({ request }) => {
    for (const path of ["/", "/privacy"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()[REPORT_ONLY], path).toContain(`report-uri ${CSP_REPORT_PATH}`);
    }
    for (const path of [`/${FAKE.domestic}`, `/${FAKE.hbl}`, `/${FAKE.deepLinkInvalid}`]) {
      const response = await request.get(path);
      const policy = response.headers()[REPORT_ONLY] ?? "";
      expect(policy, path).toContain("default-src 'self'");
      expect(policy, path).not.toContain("report-uri");
    }
  });

  test("the endpoint answers 204 with no body to any report and has no GET", async ({ request }) => {
    const report = {
      "csp-report": {
        "document-uri": `http://127.0.0.1:43210/${FAKE.domestic}`,
        "effective-directive": "script-src-elem",
        "blocked-uri": "inline"
      }
    };
    const valid = await request.post(CSP_REPORT_PATH, {
      headers: { "content-type": "application/csp-report" },
      data: JSON.stringify(report)
    });
    expect(valid.status()).toBe(204);
    expect(await valid.text()).toBe("");
    const garbage = await request.post(CSP_REPORT_PATH, { headers: { "content-type": "application/csp-report" }, data: "{not json" });
    expect(garbage.status()).toBe(204);
    const foreign = await request.post(CSP_REPORT_PATH, { headers: { "content-type": "text/plain" }, data: "hello" });
    expect(foreign.status()).toBe(204);
    expect((await request.get(CSP_REPORT_PATH)).status()).toBe(405);
  });

  test("every report the browser sends around a deep link is free of tracking values", async ({ page }) => {
    const capture = await captureThirdParty(page);
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }));
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator("[data-result-view] [data-guide-key]")).toBeVisible();
    await waitForIdle(page);
    await page.goto("/");
    await waitForIdle(page);
    const reports = capture.requests().filter((request) => new URL(request.url).pathname === CSP_REPORT_PATH);
    assertNoTrackingValues(reports);
  });
});
```

- [ ] **Step 3: Run both to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/csp-report.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading the file — `Error: Cannot find module '@/app/api/csp-report/route'`.
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/csp-report.spec.ts`
Expected: `2 failed, 1 passed` — "public pages report …" fails on `/` (`Expected substring: "report-uri /api/csp-report"`), "the endpoint answers 204 …" fails with `Expected: 204` / `Received: 404`; the deep-link report test passes (it only checks whatever reports were recorded).

- [ ] **Step 4: Create the route**

Create `app/api/csp-report/route.ts`:

```ts
import { handleCspReport } from "@/lib/security/csp-report";

/** Receives CSP Report-Only violations (report-uri in next.config.ts). Logic and privacy rules: lib/security/csp-report.ts. */
export async function POST(request: Request): Promise<Response> {
  return handleCspReport(request);
}
```

- [ ] **Step 5: Keep number-route documents from reporting**

In `lib/security/headers.ts`, replace

```ts
    {
      source: NUMBER_ROUTE_SOURCE,
      headers: [{ key: "X-Robots-Tag", value: NOINDEX }]
    },
```

with

```ts
    {
      source: NUMBER_ROUTE_SOURCE,
      headers: [
        { key: "X-Robots-Tag", value: NOINDEX },
        // S11: number-route documents never post CSP reports — a report would carry the number in its document-uri.
        ...(options.reportUri
          ? [{ key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp({ ...options, reportUri: null }) }]
          : [])
      ]
    },
```

Later rules override the same header key (S01's rule order: every route, number routes, `/internal`), so a number route gets the Report-Only policy without `report-uri`. `/internal` keeps the site-wide policy with `report-uri` (no number in its paths).

- [ ] **Step 6: Pass the report address from `next.config.ts`**

In `next.config.ts`, add below the line `import { PREPAINT_CSP_SOURCE } from "./lib/style/prepaint";` (S08's import, directly below S01's `import { buildSecurityHeaders } from "./lib/security/headers";`):

```ts

/**
 * CSP Report-Only violations go here (app/api/csp-report/route.ts). Equal to CSP_REPORT_PATH in lib/security/csp-report.ts,
 * pinned by tests/unit/csp-report.spec.ts; a literal because this file cannot import modules that use the "@/" alias.
 */
const CSP_REPORT_URI = "/api/csp-report";
```

Then, in the one `buildSecurityHeaders(` call checked by Task 0 Step 9 item 2, replace the text

```ts
buildSecurityHeaders({ extraScriptHashes: [PREPAINT_CSP_SOURCE] })
```

with

```ts
buildSecurityHeaders({ extraScriptHashes: [PREPAINT_CSP_SOURCE], reportUri: CSP_REPORT_URI })
```

Change nothing else in the file (S02's `redirects`, its `LEGACY_TRACKING_QUERY_VALUE` constant and S08's import stay; the `,` that S02 appended after the `headers` property stays). The `headers` entry then reads:

```ts
  headers: async () =>
    buildSecurityHeaders({ extraScriptHashes: [PREPAINT_CSP_SOURCE], reportUri: CSP_REPORT_URI }).map((rule) => ({
      source: rule.source,
      headers: [...rule.headers]
    })),
```

Check: `Select-String -LiteralPath next.config.ts -Pattern 'reportUri: CSP_REPORT_URI|const CSP_REPORT_URI'` → 2 lines.

- [ ] **Step 7: Update S01's config test to the new option**

In `tests/unit/security-headers.spec.ts`, add below `import { PREPAINT_CSP_SOURCE } from "@/lib/style/prepaint";` (S08's import, directly below `import nextConfig from "@/next.config";`):

```ts
import { CSP_REPORT_PATH } from "@/lib/security/csp-report";
```

In the test "next.config.ts serves these rules and drops the X-Powered-By header", replace the text of S08's expected call (Task 0 Step 9 item 3)

```ts
buildSecurityHeaders({ extraScriptHashes: [PREPAINT_CSP_SOURCE] })
```

with

```ts
buildSecurityHeaders({ extraScriptHashes: [PREPAINT_CSP_SOURCE], reportUri: CSP_REPORT_PATH })
```

and add one comment line directly below S08's comment `// S08: next.config.ts passes the pre-paint script's hash into the Report-Only script-src.`, so the assertion reads:

```ts
  // S08: next.config.ts passes the pre-paint script's hash into the Report-Only script-src.
  // S11: and the CSP report address (next.config.ts CSP_REPORT_URI, equal to CSP_REPORT_PATH).
  expect(await nextConfig.headers?.()).toEqual(
    buildSecurityHeaders({ extraScriptHashes: [PREPAINT_CSP_SOURCE], reportUri: CSP_REPORT_PATH }).map((rule) => ({
      source: rule.source,
      headers: [...rule.headers]
    }))
  );
```

Check: `Select-String -LiteralPath tests/unit/security-headers.spec.ts -Pattern 'reportUri: CSP_REPORT_PATH'` → 1 line. No other S01 assertion changes: its option-less `buildSecurityHeaders()` rows still expect the number-route rule to hold only `X-Robots-Tag`, and they still do; S01's options row (`extraScriptHashes: ["'sha256-abc='"], reportUri: "/api/csp-report"`) checks only the site-wide Report-Only value, which does not change.

- [ ] **Step 8: Run the unit tests to verify they pass**

Run: `if (Test-Path .next) { Remove-Item -Recurse -Force .next }; $env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/csp-report.spec.ts tests/unit/security-headers.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `csp-report.spec.ts` 11 passed and every `security-headers.spec.ts` test passed (7 in S01's version), 0 failed.

- [ ] **Step 9: Run the E2E tests in both modes**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/csp-report.spec.ts tests/e2e/security-headers.spec.ts tests/e2e/url-privacy.spec.ts`
Expected: 0 failed (`csp-report.spec.ts` 3 passed).
Production run (Conventions) of the same three files.
Expected: 0 failed. `url-privacy.spec.ts` (S02) now also sees the browser's CSP reports from `/` documents — they are first-party requests it records and checks — and still passes.

- [ ] **Step 10: Typecheck, lint, build**

Run: `npm run typecheck; npx eslint app/api/csp-report lib/security next.config.ts tests/unit/csp-report.spec.ts tests/unit/security-headers.spec.ts tests/e2e/csp-report.spec.ts; npm run build`
Expected: `tsc` exits 0; eslint prints nothing; the build's route table lists `ƒ /api/csp-report`.

- [ ] **Step 11: Commit**

Run: `git add app/api/csp-report/route.ts lib/security/headers.ts next.config.ts tests/unit/csp-report.spec.ts tests/unit/security-headers.spec.ts tests/e2e/csp-report.spec.ts; git commit -m "feat: collect CSP Report-Only violations at /api/csp-report except from number routes"`
Expected: `6 files changed`.

---

## Part C — Cookieless statistics (approval 13)

Every Part C task starts by confirming approval 13. While it is `pending` or `rejected`, skip C1–C6 as one block: write "Part C SKIPPED — approval 13 is `pending`" (or `rejected`, as the ledger row reads) "; spec §16 item 13 '거절하면': Observability route counts and the manual 톡톡 classification only (see `docs/ops/kpi-dashboard.md`, 대체 출처)" into the stage summary and continue with Part D.

### Task C1: Route templates and the statistics gate

**Files:**
- Create: `lib/analytics/url-template.ts`
- Create: `lib/analytics/gate.ts`
- Test: `tests/unit/analytics-events.spec.ts` (create)

**Interfaces:**
- Consumes: `isNumberPath(pathname: string): boolean`, `type ScrubStatus = "scrubbed" | "notNeeded" | "failed"` (S02, `lib/privacy/url-scrub.ts`); `containsTrackingLikeValue(text: string): boolean` (S01); test-only `FAKE`, `FAKE_GROUPED` (S01 fixtures).
- Produces: `templatePath(pathname: string): string` (contract §11.9, Additions item 2), `NUMBER_ROUTE_TEMPLATE = "/[trackingNumber]"`, `UNKNOWN_ROUTE_TEMPLATE = "/[unknown]"`, `templateUrl(url: string): string | null`, `templateBeforeSend<T extends { readonly url: string }>(event: T): T | null`, `isReferrerSafe(referrer: string, host: string): boolean`, `routeForDocument(entry: "home" | "deepLink", pathname: string): string`; `type AnalyticsGateDecision = "load" | "wait" | "never"`, `interface AnalyticsGateInput { pathname; search; hash; host; referrer; entry: "home" | "deepLink"; scrub: ScrubStatus | "pending" }`, `analyticsGate(input: AnalyticsGateInput): AnalyticsGateDecision`.

- [ ] **Step 1: Confirm approval 13 is recorded**

Open `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §4, row 13. Expected: `approved`. If not, stop: Part C is SKIPPED as described above (spec §16 item 13 '거절하면': Observability route counts and the manual 톡톡 classification only; accessibility stays manual).

- [ ] **Step 2: Write the failing test**

Create `tests/unit/analytics-events.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { analyticsGate } from "@/lib/analytics/gate";
import type { AnalyticsGateInput } from "@/lib/analytics/gate";
import {
  NUMBER_ROUTE_TEMPLATE,
  UNKNOWN_ROUTE_TEMPLATE,
  isReferrerSafe,
  routeForDocument,
  templateBeforeSend,
  templatePath,
  templateUrl
} from "@/lib/analytics/url-template";
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import { FAKE, FAKE_GROUPED } from "../fixtures/tracking-fixtures";

const ORIGIN = "https://tracking.tipoasis.com";
const HOST = "tracking.tipoasis.com";

test.describe("url templates (S11)", () => {
  const PATH_ROWS: ReadonlyArray<readonly [string, string]> = [
    ["/", "/"],
    ["", "/"],
    ["/privacy", "/privacy"],
    ["/privacy/", "/privacy"],
    [`/${FAKE.domestic}`, NUMBER_ROUTE_TEMPLATE],
    [`/${FAKE.domestic}/`, NUMBER_ROUTE_TEMPLATE],
    [`/${FAKE.hbl}`, NUMBER_ROUTE_TEMPLATE],
    [`/${FAKE.hbl.toLowerCase()}`, NUMBER_ROUTE_TEMPLATE],
    [`/${encodeURIComponent(FAKE_GROUPED.domestic)}`, NUMBER_ROUTE_TEMPLATE],
    ["/0000-1234-5678", NUMBER_ROUTE_TEMPLATE],
    [`/${FAKE.deepLinkInvalid}`, NUMBER_ROUTE_TEMPLATE],
    [`/${FAKE.cargo}`, NUMBER_ROUTE_TEMPLATE],
    [NUMBER_ROUTE_TEMPLATE, NUMBER_ROUTE_TEMPLATE],
    ["/robots.txt", UNKNOWN_ROUTE_TEMPLATE],
    [`/${FAKE.domestic}.html`, UNKNOWN_ROUTE_TEMPLATE],
    [`/a/${FAKE.domestic}`, UNKNOWN_ROUTE_TEMPLATE],
    ["/internal/cs-helper", UNKNOWN_ROUTE_TEMPLATE]
  ];

  test("every path becomes one of four constants", () => {
    for (const [pathname, expected] of PATH_ROWS) {
      expect(templatePath(pathname), pathname).toBe(expected);
    }
  });

  test("urls lose query, hash and credentials; unparsable urls are dropped", () => {
    expect(templateUrl(`${ORIGIN}/${FAKE.domestic}?c=CJ#top`)).toBe(`${ORIGIN}${NUMBER_ROUTE_TEMPLATE}`);
    expect(templateUrl(`${ORIGIN}/?trackingNumber=${FAKE.domestic}`)).toBe(`${ORIGIN}/`);
    expect(templateUrl(`${ORIGIN}/privacy?utm_source=mail#section-2`)).toBe(`${ORIGIN}/privacy`);
    expect(templateUrl(`https://user:secret@${HOST}/privacy`)).toBe(`${ORIGIN}/privacy`);
    expect(templateUrl(`/${FAKE.domestic}`)).toBeNull();
    expect(templateUrl("not a url")).toBeNull();
  });

  test("beforeSend keeps the event shape, templates the url and drops what it cannot parse", () => {
    expect(templateBeforeSend({ type: "pageview", url: `${ORIGIN}/${FAKE.hbl}#x` })).toEqual({
      type: "pageview",
      url: `${ORIGIN}${NUMBER_ROUTE_TEMPLATE}`
    });
    expect(templateBeforeSend({ type: "vital", url: `${ORIGIN}/?q=${FAKE.domestic}`, route: "/" })).toEqual({
      type: "vital",
      url: `${ORIGIN}/`,
      route: "/"
    });
    expect(templateBeforeSend({ type: "event", url: "::" })).toBeNull();
  });

  test("a referrer is safe only when empty, from this host, or a bare origin", () => {
    const rows: ReadonlyArray<readonly [string, boolean]> = [
      ["", true],
      [`${ORIGIN}/${FAKE.domestic}`, true],
      ["https://m.search.naver.com/", true],
      ["https://shop.example", true],
      [`https://shop.example/orders/${FAKE.domestic}`, false],
      ["https://shop.example/?q=1", false],
      ["https://shop.example/#frag", false],
      ["https://user:pw@shop.example/", false],
      [`https://${FAKE.domestic}.example/`, false],
      ["not a url", false]
    ];
    for (const [referrer, expected] of rows) {
      expect(isReferrerSafe(referrer, HOST), referrer).toBe(expected);
    }
  });

  test("a deep-link document's first page view is filed under the number route", () => {
    expect(routeForDocument("deepLink", "/")).toBe(NUMBER_ROUTE_TEMPLATE);
    expect(routeForDocument("home", "/")).toBe("/");
    expect(routeForDocument("home", "/privacy")).toBe("/privacy");
    expect(routeForDocument("home", `/${FAKE.domestic}`)).toBe(NUMBER_ROUTE_TEMPLATE);
  });

  test("template outputs never carry a tracking-like value", () => {
    for (const [pathname] of PATH_ROWS) {
      expect(containsTrackingLikeValue(templatePath(pathname)), pathname).toBe(false);
      expect(containsTrackingLikeValue(templateUrl(`${ORIGIN}${pathname}?x=${FAKE.domestic}`) ?? ""), pathname).toBe(false);
    }
  });
});

test.describe("analytics gate (S11)", () => {
  const base: AnalyticsGateInput = { pathname: "/", search: "", hash: "", host: HOST, referrer: "", entry: "home", scrub: "pending" };
  const gate = (patch: Partial<AnalyticsGateInput>) => analyticsGate({ ...base, ...patch });

  test("home documents load at once; deep-link documents only after a confirmed scrub", () => {
    expect(gate({})).toBe("load");
    expect(gate({ scrub: "notNeeded" })).toBe("load");
    expect(gate({ pathname: "/privacy" })).toBe("load");
    expect(gate({ entry: "deepLink", scrub: "pending" })).toBe("wait");
    expect(gate({ entry: "deepLink", scrub: "notNeeded" })).toBe("wait");
    expect(gate({ entry: "deepLink", scrub: "scrubbed" })).toBe("load");
  });

  test("an address that still carries a number waits, whatever the signals say", () => {
    for (const entry of ["home", "deepLink"] as const) {
      expect(gate({ entry, scrub: "scrubbed", pathname: `/${FAKE.domestic}` }), entry).toBe("wait");
      expect(gate({ entry, scrub: "scrubbed", pathname: `/${FAKE.hbl}` }), entry).toBe("wait");
      expect(gate({ entry, scrub: "scrubbed", search: `?trackingNumber=${FAKE.domesticAlt}` }), entry).toBe("wait");
      expect(gate({ entry, scrub: "scrubbed", search: "?trackingNumber=x" }), entry).toBe("wait");
      expect(gate({ entry, scrub: "scrubbed", hash: `#${FAKE.domestic}` }), entry).toBe("wait");
      expect(gate({ entry, scrub: "scrubbed", search: `?ref=${encodeURIComponent(FAKE_GROUPED.domestic)}` }), entry).toBe("wait");
    }
  });

  test("a failed scrub, /internal and a referrer with a path close the gate for the document", () => {
    expect(gate({ scrub: "failed" })).toBe("never");
    expect(gate({ entry: "deepLink", scrub: "failed" })).toBe("never");
    expect(gate({ pathname: "/internal" })).toBe("never");
    expect(gate({ pathname: "/internal/cs-helper" })).toBe("never");
    expect(gate({ referrer: `https://shop.example/orders/${FAKE.domestic}` })).toBe("never");
    expect(gate({ referrer: "https://shop.example/" })).toBe("load");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/analytics-events.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading the file — `Error: Cannot find module '@/lib/analytics/gate'`.

- [ ] **Step 4: Write the templates**

Create `lib/analytics/url-template.ts`:

```ts
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import { isNumberPath } from "@/lib/privacy/url-scrub";

/**
 * Address templating for the statistics tools (spec §11 "3단계": 경로는 템플릿, 쿼리·해시·리퍼러 제거).
 * Pure. Every path an analytics payload can carry is one of four constants, so no customer text can leave through it.
 */
export const NUMBER_ROUTE_TEMPLATE = "/[trackingNumber]";
export const UNKNOWN_ROUTE_TEMPLATE = "/[unknown]";

const KNOWN_PATHS: ReadonlySet<string> = new Set(["/", "/privacy"]);
const TRAILING_SLASHES = /\/+$/;

/** '/' and '/privacy' stay; number routes → '/[trackingNumber]'; anything else → '/[unknown]'. Query and hash are the caller's job. */
export function templatePath(pathname: string): string {
  const trimmed = pathname.replace(TRAILING_SLASHES, "");
  const path = trimmed === "" ? "/" : trimmed;
  if (KNOWN_PATHS.has(path)) return path;
  if (isNumberPath(path)) return NUMBER_ROUTE_TEMPLATE;
  return UNKNOWN_ROUTE_TEMPLATE;
}

/** origin + templatePath(pathname); query, hash and credentials dropped. null when `url` is not an absolute URL. */
export function templateUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${templatePath(parsed.pathname)}`;
  } catch {
    return null;
  }
}

/** beforeSend for Vercel Web Analytics and Speed Insights: the URL becomes a template; an unparsable URL drops the event. */
export function templateBeforeSend<T extends { readonly url: string }>(event: T): T | null {
  const url = templateUrl(event.url);
  return url === null ? null : { ...event, url };
}

/**
 * The analytics script sends document.referrer for other sites, outside beforeSend's reach. A referrer is safe when it is
 * empty, from this host (the script skips those), or a bare origin. Anything with a path, query, hash or credentials is not.
 */
export function isReferrerSafe(referrer: string, host: string): boolean {
  if (referrer === "") return true;
  let parsed: URL;
  try {
    parsed = new URL(referrer);
  } catch {
    return false;
  }
  if (parsed.host === host) return true;
  const bareOrigin = parsed.pathname === "/" && parsed.search === "" && parsed.hash === "";
  const noCredentials = parsed.username === "" && parsed.password === "";
  return bareOrigin && noCredentials && !containsTrackingLikeValue(parsed.host);
}

/** The route a document's first page view is filed under: a deep-link document is '/[trackingNumber]' even after the scrub. */
export function routeForDocument(entry: "home" | "deepLink", pathname: string): string {
  return entry === "deepLink" ? NUMBER_ROUTE_TEMPLATE : templatePath(pathname);
}
```

- [ ] **Step 5: Write the gate**

Create `lib/analytics/gate.ts`:

```ts
import { isReferrerSafe } from "@/lib/analytics/url-template";
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import { isNumberPath } from "@/lib/privacy/url-scrub";
import type { ScrubStatus } from "@/lib/privacy/url-scrub";

/**
 * When the statistics scripts may load in this document (spec §11 "주소 정리 뒤에만 로드", §3 candidate B). Pure, fail-closed.
 * "load": the address carries no number and the scrub (deep links) is confirmed. "wait": not yet. "never": not in this document.
 */
export type AnalyticsGateDecision = "load" | "wait" | "never";

export interface AnalyticsGateInput {
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
  readonly host: string;
  readonly referrer: string;
  readonly entry: "home" | "deepLink";
  readonly scrub: ScrubStatus | "pending";
}

function isInternalPath(pathname: string): boolean {
  return pathname === "/internal" || pathname.startsWith("/internal/");
}

function addressCarriesNumber(pathname: string, search: string, hash: string): boolean {
  if (isNumberPath(pathname)) return true;
  try {
    return new URLSearchParams(search).has("trackingNumber") || containsTrackingLikeValue(`${pathname}${search}${hash}`);
  } catch {
    return true;
  }
}

export function analyticsGate(input: AnalyticsGateInput): AnalyticsGateDecision {
  if (isInternalPath(input.pathname) || input.scrub === "failed") return "never";
  if (!isReferrerSafe(input.referrer, input.host)) return "never";
  if (addressCarriesNumber(input.pathname, input.search, input.hash)) return "wait";
  if (input.entry === "deepLink" && input.scrub !== "scrubbed") return "wait";
  return "load";
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/analytics-events.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `9 passed`.

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck; npx eslint lib/analytics tests/unit/analytics-events.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 8: Commit**

Run: `git add lib/analytics/url-template.ts lib/analytics/gate.ts tests/unit/analytics-events.spec.ts; git commit -m "feat: add route templates and a fail-closed gate for cookieless statistics"`
Expected: `3 files changed`.

---

### Task C2: Enum-only events

**Files:**
- Create: `lib/analytics/events.ts`
- Test: `tests/unit/analytics-events.spec.ts` (imports; append one describe block)

**Interfaces:**
- Consumes: `GUIDE_KEYS`, `GuideKey`, `LookupEntry`, `FailureCause`, `ActionKind`, `TalkPlacement`, `StorePlacementId` (S03, `lib/tracking/types.ts`); `isStyleId`, `StyleId` (S05, `lib/style/styles.ts`; the test also uses `STYLE_IDS`); `containsTrackingLikeValue` (S01).
- Produces (contract §11.9 plus Additions item 1): `type AnalyticsEvent` (eight members, S11 fields `repeat` and `overdue`), `type WaitBucket = "lt1" | "1to3" | "3to8" | "8to25" | "25to45" | "timeout"`, `type AnalyticsActionKind = ActionKind | "storeLink"`, `type AnalyticsPlacement = TalkPlacement | StorePlacementId`, `type AnalyticsEventName`, `type EventPropertyValue = string | boolean`, `interface EventPayload { name; properties: Readonly<Record<string, EventPropertyValue>> | undefined }`, `interface LinkClickInput { placement: string | null; href; talkHref: string | null; inStoreGroup; inResult; opensNewTab }`; lists `ANALYTICS_EVENT_NAMES`, `LOOKUP_ENTRIES`, `FAILURE_CAUSES`, `ANALYTICS_ACTION_KINDS`, `TALK_PLACEMENTS`, `STORE_PLACEMENT_IDS`, `WAIT_BUCKETS`; patterns `NOTICE_ID_PATTERN`, `PROPERTY_VALUE_PATTERN`; guards `isGuideKey`, `isFailureCause`, `isTalkPlacement`, `isStorePlacementId`; `waitBucket(elapsedMs: number, timedOut: boolean): WaitBucket`, `stateToken(guideKey: GuideKey, overdue: boolean): string`, `parseAnalyticsEvent(value: unknown): AnalyticsEvent | null`, `toEventPayload(event: AnalyticsEvent): EventPayload`, `classifyLinkClick(input: LinkClickInput): { kind: AnalyticsActionKind; placement: AnalyticsPlacement } | null`.

- [ ] **Step 1: Confirm approval 13 is recorded**

Roadmap §4 row 13 must read `approved`; otherwise stop (Part C SKIPPED, fallback as in Task C1 Step 1).

- [ ] **Step 2: Write the failing test**

In `tests/unit/analytics-events.spec.ts`:
(a) add as the first two lines of the file:

```ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
```

(b) add directly above `import { analyticsGate } from "@/lib/analytics/gate";`:

```ts
import {
  ANALYTICS_ACTION_KINDS,
  ANALYTICS_EVENT_NAMES,
  FAILURE_CAUSES,
  LOOKUP_ENTRIES,
  PROPERTY_VALUE_PATTERN,
  STORE_PLACEMENT_IDS,
  TALK_PLACEMENTS,
  WAIT_BUCKETS,
  classifyLinkClick,
  parseAnalyticsEvent,
  stateToken,
  toEventPayload,
  waitBucket
} from "@/lib/analytics/events";
import type { AnalyticsEvent, LinkClickInput } from "@/lib/analytics/events";
```

(c) add directly below `import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";`:

```ts
import { STYLE_IDS } from "@/lib/style/styles";
import { GUIDE_KEYS } from "@/lib/tracking/types";
```

(d) append at the end of the file:

```ts
const TALK_URL = "https://talk.naver.com/example";

/** Every event the union allows, with every enum member at least once. */
function everyEvent(): readonly AnalyticsEvent[] {
  const starts = LOOKUP_ENTRIES.flatMap((entry): AnalyticsEvent[] => [
    { name: "lookup_start", entry, repeat: false },
    { name: "lookup_start", entry, repeat: true }
  ]);
  const settles = GUIDE_KEYS.flatMap((guideKey) =>
    WAIT_BUCKETS.flatMap((wait): AnalyticsEvent[] => [
      { name: "lookup_settle", guideKey, overdue: false, wait },
      { name: "lookup_settle", guideKey, overdue: true, wait }
    ])
  );
  const actions = GUIDE_KEYS.flatMap((guideKey) =>
    ANALYTICS_ACTION_KINDS.flatMap((kind) =>
      [...TALK_PLACEMENTS, ...STORE_PLACEMENT_IDS].map(
        (placement): AnalyticsEvent => ({ name: "action", kind, placement, guideKey, overdue: guideKey === "inTransit" })
      )
    )
  );
  const errors = FAILURE_CAUSES.map((cause): AnalyticsEvent => ({ name: "lookup_error", cause }));
  const styles = STYLE_IDS.map((style): AnalyticsEvent => ({ name: "style_select", style }));
  const rest: readonly AnalyticsEvent[] = [
    { name: "details_open" },
    { name: "notice_view", id: "2026-chuseok" },
    { name: "helpful", value: "yes" },
    { name: "helpful", value: "no" }
  ];
  return [...starts, ...settles, ...actions, ...errors, ...styles, ...rest];
}

test.describe("analytics events (S11)", () => {
  test("every event maps to at most two enum properties and nothing tracking-like", () => {
    const events = everyEvent();
    expect(new Set(events.map((event) => event.name))).toEqual(new Set(ANALYTICS_EVENT_NAMES));
    for (const event of events) {
      expect(parseAnalyticsEvent(event), JSON.stringify(event)).toEqual(event);
      const payload = toEventPayload(event);
      expect(payload.name).toBe(event.name);
      const values = Object.values(payload.properties ?? {});
      expect(values.length, event.name).toBeLessThanOrEqual(2);
      for (const value of values) {
        if (typeof value === "string") expect(value, JSON.stringify(event)).toMatch(PROPERTY_VALUE_PATTERN);
        else expect(typeof value).toBe("boolean");
      }
      expect(containsTrackingLikeValue(JSON.stringify(payload)), JSON.stringify(payload)).toBe(false);
    }
  });

  test("payload shapes the KPI dashboard reads", () => {
    expect(toEventPayload({ name: "lookup_start", entry: "deepLink", repeat: false })).toEqual({
      name: "lookup_start",
      properties: { entry: "deepLink", repeat: false }
    });
    expect(toEventPayload({ name: "lookup_settle", guideKey: "customsWaiting", overdue: true, wait: "3to8" })).toEqual({
      name: "lookup_settle",
      properties: { state: "customsWaiting+overdue", wait: "3to8" }
    });
    expect(
      toEventPayload({ name: "action", kind: "storeLink", placement: "deliveredLead", guideKey: "delivered", overdue: false })
    ).toEqual({ name: "action", properties: { action: "storeLink@deliveredLead", state: "delivered" } });
    expect(toEventPayload({ name: "details_open" })).toEqual({ name: "details_open", properties: undefined });
    expect(stateToken("inTransit", false)).toBe("inTransit");
  });

  test("anything outside the enums is refused, including numbers smuggled into a field", () => {
    const refused: readonly unknown[] = [
      null,
      "lookup_start",
      [],
      { name: "page_view" },
      { name: "lookup_start", entry: FAKE.domestic, repeat: false },
      { name: "lookup_start", entry: "manual" },
      { name: "lookup_settle", guideKey: FAKE.hbl, overdue: false, wait: "lt1" },
      { name: "lookup_settle", guideKey: "inTransit", overdue: "no", wait: "lt1" },
      { name: "lookup_settle", guideKey: "inTransit", overdue: false, wait: "12s" },
      { name: "lookup_error", cause: "관리자에게 문의해주세요" },
      { name: "action", kind: "talk", placement: FAKE_GROUPED.domestic, guideKey: "idle", overdue: false },
      { name: "action", kind: "buy", placement: "header", guideKey: "idle", overdue: false },
      { name: "notice_view", id: FAKE.domestic },
      { name: "notice_view", id: `notice-${FAKE.domestic}` },
      { name: "notice_view", id: "공지" },
      { name: "notice_view", id: "Notice" },
      { name: "helpful", value: "maybe" },
      { name: "style_select", style: "dark" }
    ];
    for (const value of refused) {
      expect(parseAnalyticsEvent(value), JSON.stringify(value)).toBeNull();
    }
  });

  test("wait buckets follow spec §11 and a client timeout wins", () => {
    const rows: ReadonlyArray<readonly [number, boolean, string]> = [
      [0, false, "lt1"],
      [999, false, "lt1"],
      [1000, false, "1to3"],
      [2999, false, "1to3"],
      [3000, false, "3to8"],
      [7999, false, "3to8"],
      [8000, false, "8to25"],
      [24999, false, "8to25"],
      [25000, false, "25to45"],
      [60000, false, "25to45"],
      [Number.NaN, false, "lt1"],
      [-5, false, "lt1"],
      [300, true, "timeout"],
      [45000, true, "timeout"]
    ];
    for (const [elapsedMs, timedOut, expected] of rows) {
      expect(waitBucket(elapsedMs, timedOut), `${elapsedMs} ${timedOut}`).toBe(expected);
    }
  });

  test("link clicks map to actions from the contract hooks only", () => {
    const click = (patch: Partial<LinkClickInput>) =>
      classifyLinkClick({
        placement: null,
        href: "https://example.com/",
        talkHref: TALK_URL,
        inStoreGroup: false,
        inResult: false,
        opensNewTab: true,
        ...patch
      });
    expect(click({ placement: "header", href: TALK_URL })).toEqual({ kind: "talk", placement: "header" });
    expect(click({ placement: "shortcut", href: TALK_URL })).toEqual({ kind: "talk", placement: "shortcut" });
    // S06's ShortcutRow: the store links carry data-link-placement="shortcut" with no [data-affiliate-group] around them.
    expect(click({ placement: "shortcut" })).toEqual({ kind: "storeLink", placement: "shortcut" });
    expect(click({ placement: "shortcut", inStoreGroup: true })).toEqual({ kind: "storeLink", placement: "shortcut" });
    expect(click({ placement: "deliveredLead", inStoreGroup: true, inResult: true })).toEqual({
      kind: "storeLink",
      placement: "deliveredLead"
    });
    expect(click({ placement: "showcase" })).toEqual({ kind: "storeLink", placement: "showcase" });
    expect(click({ placement: "state", href: TALK_URL, inResult: true })).toEqual({ kind: "talk", placement: "state" });
    expect(click({ placement: "header", inStoreGroup: true })).toBeNull();
    expect(click({ placement: "sidebar" })).toBeNull();
    expect(click({ href: TALK_URL, inResult: true })).toEqual({ kind: "copyAndTalk", placement: "state" });
    expect(click({ href: `tel:${FAKE.phone}`, inResult: true, opensNewTab: false })).toEqual({ kind: "callDriver", placement: "state" });
    expect(click({ href: "https://carrier.example/track", inResult: true })).toEqual({ kind: "carrierOfficial", placement: "state" });
    expect(click({ href: "/privacy", inResult: true, opensNewTab: false })).toBeNull();
    // S08's RecommendationList: ButtonLink without a placement inside [data-recommended-products] in the result.
    expect(click({ inStoreGroup: true, inResult: true })).toBeNull();
    expect(click({ href: TALK_URL, inResult: false })).toBeNull();
    expect(click({ href: TALK_URL, talkHref: null, inResult: true })).toEqual({ kind: "carrierOfficial", placement: "state" });
  });

  test("no session replay, heatmap or input-capture tool is installed or called", () => {
    const pkg: unknown = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    const section = (key: string): readonly string[] => {
      if (typeof pkg !== "object" || pkg === null || !(key in pkg)) return [];
      const value: unknown = Reflect.get(pkg, key);
      return typeof value === "object" && value !== null ? Object.keys(value) : [];
    };
    const installed = [...section("dependencies"), ...section("devDependencies")];
    const forbiddenPackages =
      /hotjar|clarity|fullstory|logrocket|smartlook|mouseflow|posthog|mixpanel|amplitude|heap|rrweb|react-ga|ga4|gtag|google-analytics|segment/i;
    expect(installed.filter((name) => forbiddenPackages.test(name))).toEqual([]);

    const sourceFiles = (dir: string): readonly string[] =>
      readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return sourceFiles(full);
        return /\.(ts|tsx)$/.test(name) ? [full] : [];
      });
    const forbiddenCalls = /\bgtag\(|googletagmanager|hotjar|clarity\.ms|rrweb|sessionRecording|recordInput/;
    for (const file of ["app", "components", "lib"].flatMap((dir) => sourceFiles(path.join(process.cwd(), dir)))) {
      expect(forbiddenCalls.test(readFileSync(file, "utf8")), file).toBe(false);
    }
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/analytics-events.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading the file — `Error: Cannot find module '@/lib/analytics/events'`.

- [ ] **Step 4: Write the events module**

Create `lib/analytics/events.ts`:

```ts
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import { isStyleId } from "@/lib/style/styles";
import type { StyleId } from "@/lib/style/styles";
import { GUIDE_KEYS } from "@/lib/tracking/types";
import type { ActionKind, FailureCause, GuideKey, LookupEntry, StorePlacementId, TalkPlacement } from "@/lib/tracking/types";

/**
 * Enum-only analytics events (spec §11 "이벤트", roadmap §11.9). Pure. Nothing here can carry a number, a phone number or
 * free text: every property is an enum member, a boolean, or a config notice id checked against NOTICE_ID_PATTERN.
 * S11 additions to the contract type: lookup_start.repeat, action.overdue, action kind "storeLink".
 */
export type WaitBucket = "lt1" | "1to3" | "3to8" | "8to25" | "25to45" | "timeout";
export type AnalyticsActionKind = ActionKind | "storeLink";
export type AnalyticsPlacement = TalkPlacement | StorePlacementId;

export type AnalyticsEvent =
  | { readonly name: "lookup_start"; readonly entry: LookupEntry; readonly repeat: boolean }
  | { readonly name: "lookup_settle"; readonly guideKey: GuideKey; readonly overdue: boolean; readonly wait: WaitBucket }
  | { readonly name: "lookup_error"; readonly cause: FailureCause }
  | {
      readonly name: "action";
      readonly kind: AnalyticsActionKind;
      readonly placement: AnalyticsPlacement;
      readonly guideKey: GuideKey;
      readonly overdue: boolean;
    }
  | { readonly name: "details_open" }
  | { readonly name: "notice_view"; readonly id: string }
  | { readonly name: "helpful"; readonly value: "yes" | "no" }
  | { readonly name: "style_select"; readonly style: StyleId };
export type AnalyticsEventName = AnalyticsEvent["name"];

/** What goes to track(): at most two properties per event, each an enum string or a boolean. */
export type EventPropertyValue = string | boolean;
export interface EventPayload {
  readonly name: AnalyticsEventName;
  readonly properties: Readonly<Record<string, EventPropertyValue>> | undefined;
}

type EnumSet<K extends string> = Readonly<Record<K, true>>;

// Records keyed by the union: the compiler rejects a missing or an extra member, so these lists cannot drift from the types.
const EVENT_NAME_SET: EnumSet<AnalyticsEventName> = {
  lookup_start: true, lookup_settle: true, lookup_error: true, action: true,
  details_open: true, notice_view: true, helpful: true, style_select: true
};
const LOOKUP_ENTRY_SET: EnumSet<LookupEntry> = {
  manual: true, deepLink: true, restore: true, carrierChip: true, retry: true, autoRetryOnline: true
};
const FAILURE_CAUSE_SET: EnumSet<FailureCause> = {
  invalidNumber: true, notFound: true, rateLimited: true, upstreamTimeout: true, badGateway: true,
  network: true, offline: true, clientTimeout: true, serverError: true, contractViolation: true
};
const ACTION_KIND_SET: EnumSet<AnalyticsActionKind> = {
  fixNumber: true, retry: true, cancel: true, copyAndTalk: true, copyInquiry: true, talk: true,
  carrierOfficial: true, callDriver: true, copyReturnLink: true, chooseCarrier: true, undeliveredHelp: true, storeLink: true
};
const TALK_PLACEMENT_SET: EnumSet<TalkPlacement> = { header: true, shortcut: true, state: true, footer: true };
const STORE_PLACEMENT_SET: EnumSet<StorePlacementId> = { shortcut: true, showcase: true, pending: true, deliveredLead: true };
const WAIT_BUCKET_SET: EnumSet<WaitBucket> = {
  lt1: true, "1to3": true, "3to8": true, "8to25": true, "25to45": true, timeout: true
};

const keysOf = <K extends string>(set: EnumSet<K>): readonly K[] => Object.keys(set).filter((key): key is K => key in set);
function inSet<K extends string>(set: EnumSet<K>, value: unknown): value is K {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(set, value);
}

export const ANALYTICS_EVENT_NAMES: readonly AnalyticsEventName[] = keysOf(EVENT_NAME_SET);
export const LOOKUP_ENTRIES: readonly LookupEntry[] = keysOf(LOOKUP_ENTRY_SET);
export const FAILURE_CAUSES: readonly FailureCause[] = keysOf(FAILURE_CAUSE_SET);
export const ANALYTICS_ACTION_KINDS: readonly AnalyticsActionKind[] = keysOf(ACTION_KIND_SET);
export const TALK_PLACEMENTS: readonly TalkPlacement[] = keysOf(TALK_PLACEMENT_SET);
export const STORE_PLACEMENT_IDS: readonly StorePlacementId[] = keysOf(STORE_PLACEMENT_SET);
export const WAIT_BUCKETS: readonly WaitBucket[] = keysOf(WAIT_BUCKET_SET);

export const isGuideKey = (value: unknown): value is GuideKey =>
  typeof value === "string" && (GUIDE_KEYS as readonly string[]).includes(value);
export const isFailureCause = (value: unknown): value is FailureCause => inSet(FAILURE_CAUSE_SET, value);
export const isTalkPlacement = (value: unknown): value is TalkPlacement => inSet(TALK_PLACEMENT_SET, value);
export const isStorePlacementId = (value: unknown): value is StorePlacementId => inSet(STORE_PLACEMENT_SET, value);

/** Config notice ids such as '2026-chuseok' (lower-case letters, digits, hyphens; at most 48 characters). */
export const NOTICE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,47}$/;
/** Every string property value the payload may carry: enum spellings joined with '@' or '+'. */
export const PROPERTY_VALUE_PATTERN = /^[A-Za-z0-9@+-]{1,64}$/;

/** Spec §11 wait buckets. `timedOut` (our client timeout fired) wins over the elapsed time; waits past 45 s stay in "25to45". */
export function waitBucket(elapsedMs: number, timedOut: boolean): WaitBucket {
  if (timedOut) return "timeout";
  if (!Number.isFinite(elapsedMs) || elapsedMs < 1000) return "lt1";
  if (elapsedMs < 3000) return "1to3";
  if (elapsedMs < 8000) return "3to8";
  if (elapsedMs < 25000) return "8to25";
  return "25to45";
}

/** One property for the state and the overdue modifier ('inTransit', 'inTransit+overdue'). */
export function stateToken(guideKey: GuideKey, overdue: boolean): string {
  return overdue ? `${guideKey}+overdue` : guideKey;
}

type Fields = Readonly<Record<string, unknown>>;
const isFields = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);

/** Rebuilds an event from untrusted input (DOM attributes, queued objects). Anything outside the enums → null. */
export function parseAnalyticsEvent(value: unknown): AnalyticsEvent | null {
  if (!isFields(value) || !inSet(EVENT_NAME_SET, value.name)) return null;
  switch (value.name) {
    case "lookup_start":
      return inSet(LOOKUP_ENTRY_SET, value.entry) && typeof value.repeat === "boolean"
        ? { name: "lookup_start", entry: value.entry, repeat: value.repeat }
        : null;
    case "lookup_settle":
      return isGuideKey(value.guideKey) && typeof value.overdue === "boolean" && inSet(WAIT_BUCKET_SET, value.wait)
        ? { name: "lookup_settle", guideKey: value.guideKey, overdue: value.overdue, wait: value.wait }
        : null;
    case "lookup_error":
      return isFailureCause(value.cause) ? { name: "lookup_error", cause: value.cause } : null;
    case "action":
      return inSet(ACTION_KIND_SET, value.kind) &&
        (isTalkPlacement(value.placement) || isStorePlacementId(value.placement)) &&
        isGuideKey(value.guideKey) &&
        typeof value.overdue === "boolean"
        ? { name: "action", kind: value.kind, placement: value.placement, guideKey: value.guideKey, overdue: value.overdue }
        : null;
    case "details_open":
      return { name: "details_open" };
    case "notice_view":
      return typeof value.id === "string" && NOTICE_ID_PATTERN.test(value.id) && !containsTrackingLikeValue(value.id)
        ? { name: "notice_view", id: value.id }
        : null;
    case "helpful":
      return value.value === "yes" || value.value === "no" ? { name: "helpful", value: value.value } : null;
    case "style_select":
      return isStyleId(value.style) ? { name: "style_select", style: value.style } : null;
  }
}

/** The track() arguments for a valid event. */
export function toEventPayload(event: AnalyticsEvent): EventPayload {
  switch (event.name) {
    case "lookup_start":
      return { name: event.name, properties: { entry: event.entry, repeat: event.repeat } };
    case "lookup_settle":
      return { name: event.name, properties: { state: stateToken(event.guideKey, event.overdue), wait: event.wait } };
    case "lookup_error":
      return { name: event.name, properties: { cause: event.cause } };
    case "action":
      return {
        name: event.name,
        properties: { action: `${event.kind}@${event.placement}`, state: stateToken(event.guideKey, event.overdue) }
      };
    case "details_open":
      return { name: event.name, properties: undefined };
    case "notice_view":
      return { name: event.name, properties: { id: event.id } };
    case "helpful":
      return { name: event.name, properties: { value: event.value } };
    case "style_select":
      return { name: event.name, properties: { style: event.style } };
  }
}

export interface LinkClickInput {
  readonly placement: string | null; // data-link-placement
  readonly href: string;
  readonly talkHref: string | null;  // href of the header 톡톡 link on this page
  readonly inStoreGroup: boolean;    // inside [data-affiliate-group] or [data-recommended-products]
  readonly inResult: boolean;        // inside [data-result-view]
  readonly opensNewTab: boolean;
}

/**
 * Which action a link click is, from the contract hooks only (roadmap §11.13). null → not reported.
 * "shortcut" is both a TalkPlacement and a StorePlacementId (S06's ShortcutRow puts it on the 톡톡 link and on both
 * store links), so a "shortcut" link is 톡톡 only when its href is the page's 톡톡 address.
 */
export function classifyLinkClick(input: LinkClickInput): { readonly kind: AnalyticsActionKind; readonly placement: AnalyticsPlacement } | null {
  const { placement } = input;
  const isTalkHref = input.talkHref !== null && input.href === input.talkHref;
  if (placement !== null) {
    if (input.inStoreGroup) return isStorePlacementId(placement) ? { kind: "storeLink", placement } : null;
    if (isTalkPlacement(placement) && (isTalkHref || !isStorePlacementId(placement))) return { kind: "talk", placement };
    if (isStorePlacementId(placement)) return { kind: "storeLink", placement };
    return null;
  }
  // S08's RecommendationList links have no placement; no enum names them, so they are not reported.
  if (!input.inResult || input.inStoreGroup) return null;
  if (input.href.startsWith("tel:")) return { kind: "callDriver", placement: "state" };
  if (isTalkHref) return { kind: "copyAndTalk", placement: "state" };
  if (input.opensNewTab) return { kind: "carrierOfficial", placement: "state" };
  return null;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/analytics-events.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `15 passed`.

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck; npx eslint lib/analytics tests/unit/analytics-events.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 7: Commit**

Run: `git add lib/analytics/events.ts tests/unit/analytics-events.spec.ts; git commit -m "feat: define enum-only statistics events with at most two properties"`
Expected: `2 files changed`.

---

### Task C3: Per-document hand-off queue

**Files:**
- Create: `lib/analytics/report.ts`
- Test: `tests/unit/analytics-events.spec.ts` (one import; append one describe block)

**Interfaces:**
- Consumes: `type AnalyticsEvent` (Task C2; type-only, so `events.ts` stays out of the initial bundle), `type LookupEntry` (S03).
- Produces: `MAX_QUEUED_EVENTS = 20`, `REPEAT_WINDOW_MS = 600000`, `type AnalyticsSink = (event: AnalyticsEvent) => void`, `interface PendingLookupStart { seq: number; at: number }`, `reportAnalyticsEvent(event: AnalyticsEvent): void`, `reportLookupStart(entry: LookupEntry, at?: number): void` (Task C4 calls it from `useLookup`), `peekPendingLookupStart(): PendingLookupStart | null`, `consumePendingLookupStart(seq: number): void` (Task C5's observer), `connectAnalyticsSink(next: AnalyticsSink): void` (Task C4's runtime), `disconnectAnalytics(): void` (Task C4's gate component), `resetAnalyticsReport(): void` (tests only).

- [ ] **Step 1: Confirm approval 13 is recorded**

Roadmap §4 row 13 must read `approved`; otherwise stop (Part C SKIPPED; fallback as in Task C1 Step 1: spec §16 item 13 '거절하면' — Observability route counts and the manual 톡톡 classification only, as `docs/ops/kpi-dashboard.md` lists under 대체 출처).

- [ ] **Step 2: Write the failing test**

In `tests/unit/analytics-events.spec.ts`, add directly below the `from "@/lib/analytics/url-template";` import block:

```ts
import {
  MAX_QUEUED_EVENTS,
  REPEAT_WINDOW_MS,
  connectAnalyticsSink,
  consumePendingLookupStart,
  disconnectAnalytics,
  peekPendingLookupStart,
  reportAnalyticsEvent,
  reportLookupStart,
  resetAnalyticsReport
} from "@/lib/analytics/report";
```

Append at the end of the file:

```ts
test.describe("analytics report hand-off (S11)", () => {
  test.beforeEach(() => resetAnalyticsReport());

  test("events wait for the runtime, keep their order and are capped", () => {
    for (let index = 0; index < MAX_QUEUED_EVENTS + 5; index += 1) reportAnalyticsEvent({ name: "details_open" });
    reportAnalyticsEvent({ name: "style_select", style: "night" });
    const received: AnalyticsEvent[] = [];
    connectAnalyticsSink((event) => received.push(event));
    expect(received).toHaveLength(MAX_QUEUED_EVENTS);
    reportAnalyticsEvent({ name: "helpful", value: "yes" });
    expect(received.at(-1)).toEqual({ name: "helpful", value: "yes" });
  });

  test("a closed gate drops the queue and every later event", () => {
    reportAnalyticsEvent({ name: "details_open" });
    disconnectAnalytics();
    reportAnalyticsEvent({ name: "details_open" });
    const received: AnalyticsEvent[] = [];
    connectAnalyticsSink((event) => received.push(event));
    reportAnalyticsEvent({ name: "details_open" });
    expect(received).toEqual([]);
  });

  test("a lookup start is reported with its entry and marks repeats within ten minutes", () => {
    const received: AnalyticsEvent[] = [];
    connectAnalyticsSink((event) => received.push(event));
    reportLookupStart("deepLink", 1000);
    reportLookupStart("retry", 1000 + REPEAT_WINDOW_MS);
    reportLookupStart("manual", 1000 + 2 * REPEAT_WINDOW_MS + 1);
    expect(received).toEqual([
      { name: "lookup_start", entry: "deepLink", repeat: false },
      { name: "lookup_start", entry: "retry", repeat: true },
      { name: "lookup_start", entry: "manual", repeat: false }
    ]);
  });

  test("only the newest start is pending, and a stale settle does not consume it", () => {
    reportLookupStart("manual", 10);
    const first = peekPendingLookupStart();
    reportLookupStart("carrierChip", 20);
    const second = peekPendingLookupStart();
    expect(first?.seq).toBe(1);
    expect(second).toEqual({ seq: 2, at: 20 });
    consumePendingLookupStart(1);
    expect(peekPendingLookupStart()).toEqual(second);
    consumePendingLookupStart(2);
    expect(peekPendingLookupStart()).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/analytics-events.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading the file — `Error: Cannot find module '@/lib/analytics/report'`.

- [ ] **Step 4: Write the queue**

Create `lib/analytics/report.ts`:

```ts
import type { AnalyticsEvent } from "@/lib/analytics/events";
import type { LookupEntry } from "@/lib/tracking/types";

/**
 * Per-document hand-off between the page and the lazily loaded statistics runtime (S11). Tiny on purpose: it sits in the
 * initial bundle (useLookup imports it). Events wait here until the runtime connects; they are dropped for good when the
 * gate says "never" (fail-closed). Nothing is written to storage.
 */
export const MAX_QUEUED_EVENTS = 20;
/** Spec §11 KPI 4: a lookup that starts within 10 minutes of the previous one in the same document is a repeat. */
export const REPEAT_WINDOW_MS = 600000;

export type AnalyticsSink = (event: AnalyticsEvent) => void;
export interface PendingLookupStart {
  readonly seq: number;
  readonly at: number;
}

let sink: AnalyticsSink | null = null;
let closed = false;
let queue: readonly AnalyticsEvent[] = [];
let lastStartAt: number | null = null;
let startSeq = 0;
let pendingStart: PendingLookupStart | null = null;

export function reportAnalyticsEvent(event: AnalyticsEvent): void {
  if (closed) return;
  if (sink !== null) {
    sink(event);
    return;
  }
  if (queue.length < MAX_QUEUED_EVENTS) queue = [...queue, event];
}

/** Called by useLookup for every accepted request (submit, retry, carrier chip, restore, deep link, online re-lookup). */
export function reportLookupStart(entry: LookupEntry, at: number = performance.now()): void {
  const repeat = lastStartAt !== null && at - lastStartAt <= REPEAT_WINDOW_MS;
  startSeq += 1;
  lastStartAt = at;
  pendingStart = { seq: startSeq, at };
  reportAnalyticsEvent({ name: "lookup_start", entry, repeat });
}

/** The newest lookup start that has not been matched to a settled screen yet. */
export function peekPendingLookupStart(): PendingLookupStart | null {
  return pendingStart;
}

/** Marks that start as settled; a stale seq (a newer lookup started meanwhile) changes nothing. */
export function consumePendingLookupStart(seq: number): void {
  if (pendingStart !== null && pendingStart.seq === seq) pendingStart = null;
}

export function connectAnalyticsSink(next: AnalyticsSink): void {
  if (closed) return;
  sink = next;
  const waiting = queue;
  queue = [];
  waiting.forEach((event) => next(event));
}

/** The gate said "never" for this document: drop the queue and ignore every later event. */
export function disconnectAnalytics(): void {
  closed = true;
  sink = null;
  queue = [];
}

/** Test seam: a fresh document state. */
export function resetAnalyticsReport(): void {
  sink = null;
  closed = false;
  queue = [];
  lastStartAt = null;
  startSeq = 0;
  pendingStart = null;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/analytics-events.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `19 passed`.

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck; npx eslint lib/analytics tests/unit/analytics-events.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 7: Commit**

Run: `git add lib/analytics/report.ts tests/unit/analytics-events.spec.ts; git commit -m "feat: queue statistics events per document until the gate opens"`
Expected: `2 files changed`.

---

### Task C4: Statistics runtime behind the gate, mounted in the public layout

**Files:**
- Modify: `package.json`, `package-lock.json` (`npm install`)
- Create: `tests/support/insights-double.ts`
- Create: `lib/analytics/runtime.ts`
- Create: `components/analytics/Analytics.tsx`
- Modify: `app/(public)/layout.tsx` (one import; one element after `<AdLoader />`)
- Modify: `components/lookup/useLookup.ts` (one import; one call in `submit`)
- Test: `tests/e2e/analytics-privacy.spec.ts` (create)

**Interfaces:**
- Consumes: Tasks C1–C3 (`analyticsGate`, `routeForDocument`, `templateBeforeSend`, `templatePath`, `NUMBER_ROUTE_TEMPLATE`, `parseAnalyticsEvent`, `toEventPayload`, `connectAnalyticsSink`, `disconnectAnalytics`, `reportLookupStart`); S02 `getAdSignals(): AdSignals`, `subscribeAdSignals(listener): () => void`, `type AdSignals`, `captureThirdParty(page)`, `assertNoTrackingValues(requests)`, `waitForIdle(page)`, `type CapturedRequest`; S01 `containsTrackingLikeValue`, `FAKE`, `mockTrack`, `trackData`; `@vercel/analytics` `inject(props?)`, `pageview({ route, path })`, `track(name, properties?)`; `@vercel/speed-insights` `injectSpeedInsights(props?): { setRoute(route) } | null`.
- Produces: `startAnalyticsRuntime(options: { entry: "home" | "deepLink"; pathname: string }): AnalyticsRuntime` with `AnalyticsRuntime { pageview(pathname: string): void }`, `SPEED_INSIGHTS_SAMPLE_RATE = 1`; `Analytics(): null` (client; mounted once in `app/(public)/layout.tsx`); `useLookup` reports `lookup_start` for every accepted request; test support `installInsightsDoubles(page)`, `insightsPosts(requests)`, `assertInsightsClean(requests)`, `isRecord(value)`, `type InsightsScriptKind`, `interface InsightsScriptRequest { kind; url; locationAtRequest }`, `interface InsightsPost { endpoint: "view" | "event" | "vitals"; body }`.

- [ ] **Step 1: Confirm approval 13 is recorded**

Roadmap §4 row 13 must read `approved`; otherwise stop (Part C SKIPPED; fallback as in Task C1 Step 1: no package, no script, no event — Observability route counts and the manual 톡톡 classification only). Approval 13 is also the approval for the two new dependencies (spec §16 item 13).

- [ ] **Step 2: Install the two packages**

Run: `npm install @vercel/analytics@^2.0.1 @vercel/speed-insights@^2.0.0`
Expected: `added 2 packages` (neither has runtime dependencies), exit 0.
Run: `Select-String -LiteralPath package.json -Pattern '"@vercel/analytics"|"@vercel/speed-insights"'`
Expected: 2 lines, both inside `"dependencies"`.

- [ ] **Step 3: Write the script doubles**

Create `tests/support/insights-double.ts`:

```ts
import { expect } from "@playwright/test";
import type { Page, Request, Route } from "@playwright/test";
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import { assertNoTrackingValues } from "./network-capture";
import type { CapturedRequest } from "./network-capture";

/**
 * Test doubles for the two Vercel scripts (S11). They follow the public protocol of the real scripts as read on 2026-09-26
 * (va.vercel-scripts.com v1 script 0.1.3): the page queues commands in window.vaq / window.siq, the script applies the
 * page's beforeSend, the analytics payload is { o: url, sdkn, sdkv, ts, dp: route, r: other-site referrer, en, ed } and
 * the vitals payload is { speed, metrics: [{ id, type, route, href, value, attribution }] }. Unlike the real scripts they
 * post in development too, to first-party endpoints that captureThirdParty records.
 */
const ANALYTICS_DOUBLE = `(() => {
  if (window.vai) return;
  window.vai = true;
  const script = document.currentScript;
  const data = script ? script.dataset : {};
  let beforeSend = (event) => event;
  let route = null;
  let path = null;
  let firstView = true;
  const urlFor = () => {
    const href = location.href;
    if (!path) return href;
    const url = new URL(href);
    if (url.pathname === path) return href;
    url.pathname = path;
    url.search = "";
    return url.href;
  };
  const post = (kind, withReferrer, event) => {
    const out = beforeSend({ type: kind === "view" ? "pageview" : "event", url: urlFor() });
    if (!out) return;
    const referrer = document.referrer;
    const body = { o: out.url, sdkn: data.sdkn, sdkv: data.sdkv, ts: Date.now() };
    if (route) body.dp = route;
    if (withReferrer && referrer && !referrer.includes(location.host)) body.r = referrer;
    if (event) { body.en = event.name; if (event.data) body.ed = event.data; }
    void fetch("/_vercel/insights/" + kind, { method: "POST", body: JSON.stringify(body), keepalive: true });
  };
  window.va = (name, payload) => {
    if (name === "beforeSend" && typeof payload === "function") beforeSend = payload;
    if (name === "pageview" && payload) {
      if (payload.route) route = payload.route;
      if (payload.path) path = payload.path;
      post("view", firstView, null);
      firstView = false;
    }
    if (name === "event" && payload) post("event", true, { name: payload.name, data: payload.data });
  };
  (window.vaq || []).forEach(([name, payload]) => window.va(name, payload));
  if (!data.disableAutoTrack) { post("view", true, null); firstView = false; }
})();`;

const SPEED_INSIGHTS_DOUBLE = `(() => {
  if (window.sil) return;
  window.sil = true;
  const script = document.currentScript;
  let beforeSend = (event) => event;
  window.si = (name, payload) => { if (name === "beforeSend" && typeof payload === "function") beforeSend = payload; };
  (window.siq || []).forEach(([name, payload]) => window.si(name, payload));
  setTimeout(() => {
    const route = script ? script.dataset.route : undefined;
    const out = beforeSend({ type: "vital", url: location.href, route });
    if (!out) return;
    const id = "v3-" + Date.now() + "-" + (Math.floor(9e12 * Math.random()) + 1e12);
    const metric = { id, type: "FCP", route, href: out.url, value: Math.round(performance.now()), attribution: { eventTarget: "main" } };
    const body = { speed: "4g", metrics: [metric], scriptVersion: "double", sdkName: script && script.getAttribute("data-sdkn"), sdkVersion: script && script.getAttribute("data-sdkv") };
    void fetch("/_vercel/speed-insights/vitals", { method: "POST", body: JSON.stringify(body), keepalive: true });
  }, 50);
})();`;

export type InsightsScriptKind = "analytics" | "speedInsights";
export interface InsightsScriptRequest {
  readonly kind: InsightsScriptKind;
  readonly url: string;
  readonly locationAtRequest: string;
}

function scriptKind(url: URL): InsightsScriptKind | null {
  if (/\/speed-insights\/script(\.debug)?\.js$/.test(url.pathname)) return "speedInsights";
  if (/\/insights\/script\.js$/.test(url.pathname) || /^\/v1\/script(\.debug)?\.js$/.test(url.pathname)) return "analytics";
  return null;
}

function locationOf(request: Request): string {
  try {
    return request.frame().url();
  } catch {
    return "(no frame)";
  }
}

/** Serves the doubles for both script URLs (first-party in production, va.vercel-scripts.com in development).
 *  Register it AFTER captureThirdParty so it answers first. */
export async function installInsightsDoubles(page: Page): Promise<{ readonly scripts: () => readonly InsightsScriptRequest[] }> {
  const scripts: InsightsScriptRequest[] = [];
  await page.route(
    (url) => scriptKind(url) !== null,
    async (route: Route) => {
      const request = route.request();
      const kind = scriptKind(new URL(request.url()));
      if (kind === null) return route.fallback();
      scripts.push({ kind, url: request.url(), locationAtRequest: locationOf(request) });
      await route.fulfill({
        status: 200,
        contentType: "text/javascript",
        body: kind === "analytics" ? ANALYTICS_DOUBLE : SPEED_INSIGHTS_DOUBLE
      });
    }
  );
  return { scripts: () => [...scripts] };
}

export interface InsightsPost {
  readonly endpoint: "view" | "event" | "vitals";
  readonly body: Readonly<Record<string, unknown>>;
}

const ENDPOINTS: Readonly<Record<string, InsightsPost["endpoint"]>> = {
  "/_vercel/insights/view": "view",
  "/_vercel/insights/event": "event",
  "/_vercel/speed-insights/vitals": "vitals"
};

export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function insightsPosts(requests: readonly CapturedRequest[]): readonly InsightsPost[] {
  return requests.flatMap((request) => {
    const endpoint = ENDPOINTS[new URL(request.url).pathname];
    if (request.method !== "POST" || endpoint === undefined || request.postData === null) return [];
    const body: unknown = JSON.parse(request.postData);
    return isRecord(body) ? [{ endpoint, body }] : [];
  });
}

const DAY_MS = 86400000;
const METRIC_ID = /^v\d+-\d+-\d+$/;

/** Removes the vendors' own clock and random fields after checking their shape; everything else stays for the check. */
function withoutVendorClock(post: InsightsPost): unknown {
  const { ts, metrics, ...rest } = post.body;
  if (ts !== undefined) {
    expect(typeof ts === "number" && Math.abs(ts - Date.now()) < DAY_MS, "ts is the send time").toBe(true);
  }
  if (metrics === undefined) return rest;
  expect(Array.isArray(metrics), "metrics is a list").toBe(true);
  const list: readonly unknown[] = Array.isArray(metrics) ? metrics : [];
  return {
    ...rest,
    metrics: list.map((metric) => {
      if (!isRecord(metric)) return metric;
      const { id, ...fields } = metric;
      expect(typeof id === "string" && METRIC_ID.test(id), "metric id is the vendor's clock id").toBe(true);
      return fields;
    })
  };
}

/** Roadmap §9 S11: analytics requests carry 0 tracking-like values (URL, referer, page location and body). */
export function assertInsightsClean(requests: readonly CapturedRequest[]): void {
  assertNoTrackingValues(requests.map((request) => ({ ...request, postData: null })));
  for (const post of insightsPosts(requests)) {
    const cleaned = JSON.stringify(withoutVendorClock(post));
    expect(containsTrackingLikeValue(cleaned), `${post.endpoint} body carries a tracking-like value: ${cleaned}`).toBe(false);
  }
  const others = requests.filter((request) => ENDPOINTS[new URL(request.url).pathname] === undefined);
  assertNoTrackingValues(others);
}
```

- [ ] **Step 4: Write the failing E2E test**

Create `tests/e2e/analytics-privacy.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { NUMBER_ROUTE_TEMPLATE } from "@/lib/analytics/url-template";
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import { FAKE, mockTrack, trackData } from "../fixtures/tracking-fixtures";
import { captureThirdParty, waitForIdle } from "../support/network-capture";
import { assertInsightsClean, insightsPosts, installInsightsDoubles, isRecord } from "../support/insights-double";

const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";
const RESULT_CARD = "[data-result-view] [data-guide-key]";
const LOAD_TIMEOUT = { timeout: 15_000 } as const;

type Capture = Awaited<ReturnType<typeof captureThirdParty>>;
type Body = Readonly<Record<string, unknown>>;

async function watch(page: Page) {
  const capture = await captureThirdParty(page);
  const doubles = await installInsightsDoubles(page);
  return { capture, doubles };
}

const bodies = (capture: Capture, endpoint: "view" | "event" | "vitals"): readonly Body[] =>
  insightsPosts(capture.requests())
    .filter((post) => post.endpoint === endpoint)
    .map((post) => post.body);

function eventData(capture: Capture, name: string): readonly Body[] {
  return bodies(capture, "event")
    .filter((body) => body.en === name)
    .map((body) => (isRecord(body.ed) ? body.ed : {}));
}

async function lookupFromHome(page: Page, number: string): Promise<void> {
  const input = page.getByLabel(INPUT_LABEL, { exact: true });
  await input.fill(number);
  await input.press("Enter");
  await expect(page.locator(RESULT_CARD)).toBeVisible();
}

/** Two idle rounds after load: the gate has decided and a scheduled import would have started. */
async function settle(page: Page): Promise<void> {
  await waitForIdle(page);
  await waitForIdle(page);
}

test.describe("statistics privacy (S11, approval 13)", () => {
  test("home: one page view filed under '/', enum events, no cookies, nothing tracking-like", async ({ page, context }) => {
    const { capture, doubles } = await watch(page);
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }));
    await page.goto("/");
    await expect.poll(() => bodies(capture, "view").length, LOAD_TIMEOUT).toBe(1);
    const origin = new URL(page.url()).origin;
    expect(bodies(capture, "view")[0]).toMatchObject({ o: `${origin}/`, dp: "/" });
    expect(bodies(capture, "view")[0]).not.toHaveProperty("r");

    await lookupFromHome(page, FAKE.domestic);
    await expect.poll(() => eventData(capture, "lookup_start"), LOAD_TIMEOUT).toEqual([{ entry: "manual", repeat: false }]);
    await expect.poll(() => bodies(capture, "vitals").length, LOAD_TIMEOUT).toBeGreaterThan(0);
    expect(bodies(capture, "vitals")[0]).toMatchObject({ metrics: [{ route: "/", href: `${origin}/` }] });
    expect(doubles.scripts().map((script) => script.kind).sort()).toEqual(["analytics", "speedInsights"]);
    expect(bodies(capture, "view")).toHaveLength(1);

    expect(await context.cookies()).toEqual([]);
    const keys = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }));
    expect(keys.local.filter((key) => key !== "tt:style")).toEqual([]);
    expect(keys.session.filter((key) => key !== "tt:restore")).toEqual([]);
    assertInsightsClean(capture.requests());
  });

  test("deep link: the scripts load only after the number left the address; the view is filed under the template", async ({ page }) => {
    const { capture, doubles } = await watch(page);
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }));
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator(RESULT_CARD)).toBeVisible();
    await expect.poll(() => bodies(capture, "view").length, LOAD_TIMEOUT).toBe(1);
    const origin = new URL(page.url()).origin;
    expect(bodies(capture, "view")[0]).toMatchObject({ o: `${origin}${NUMBER_ROUTE_TEMPLATE}`, dp: NUMBER_ROUTE_TEMPLATE });
    expect(doubles.scripts().length).toBeGreaterThan(0);
    for (const script of doubles.scripts()) {
      expect(containsTrackingLikeValue(script.locationAtRequest), `${script.kind} requested at ${script.locationAtRequest}`).toBe(false);
    }
    await expect.poll(() => eventData(capture, "lookup_start"), LOAD_TIMEOUT).toEqual([{ entry: "deepLink", repeat: false }]);
    assertInsightsClean(capture.requests());
  });

  test("query and hash never reach a page view; a number in the query keeps the scripts away", async ({ page }) => {
    const { capture, doubles } = await watch(page);
    await page.goto("/privacy?utm_source=mail#section");
    await expect.poll(() => bodies(capture, "view").length, LOAD_TIMEOUT).toBe(1);
    const origin = new URL(page.url()).origin;
    expect(bodies(capture, "view")[0]).toMatchObject({ o: `${origin}/privacy`, dp: "/privacy" });

    const before = doubles.scripts().length;
    await page.goto(`/privacy?ref=${FAKE.domestic}`);
    await settle(page);
    expect(doubles.scripts()).toHaveLength(before);
    expect(bodies(capture, "view")).toHaveLength(1);
    assertInsightsClean(capture.requests());
  });

  test("a referrer with a path keeps the scripts away for the whole visit", async ({ page }) => {
    await page.addInitScript((value) => {
      Object.defineProperty(Document.prototype, "referrer", { configurable: true, get: () => value });
    }, `https://shop.example/orders/${FAKE.domestic}`);
    const { capture, doubles } = await watch(page);
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }));
    await page.goto("/");
    await lookupFromHome(page, FAKE.domestic);
    await settle(page);
    expect(doubles.scripts()).toEqual([]);
    expect(insightsPosts(capture.requests())).toEqual([]);
  });

  test("an origin-only referrer is sent as that origin and nothing more", async ({ page }) => {
    const referrer = "https://shop.example/";
    await page.addInitScript((value) => {
      Object.defineProperty(Document.prototype, "referrer", { configurable: true, get: () => value });
    }, referrer);
    const { capture } = await watch(page);
    await page.goto("/");
    await expect.poll(() => bodies(capture, "view").length, LOAD_TIMEOUT).toBe(1);
    expect(bodies(capture, "view")[0]?.r).toBe(referrer);
    assertInsightsClean(capture.requests());
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/analytics-privacy.spec.ts`
Expected: `4 failed, 1 passed` — "home …", "deep link …", "query and hash …" and "an origin-only referrer …" time out on `expect.poll(...).toBe(1)` with `Received: 0` (no statistics script exists yet); "a referrer with a path …" passes already and keeps guarding the gate.

- [ ] **Step 6: Write the runtime**

Create `lib/analytics/runtime.ts`:

```ts
import { inject, pageview, track } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";
import { parseAnalyticsEvent, toEventPayload } from "@/lib/analytics/events";
import { connectAnalyticsSink } from "@/lib/analytics/report";
import { routeForDocument, templateBeforeSend, templatePath } from "@/lib/analytics/url-template";

/**
 * The statistics runtime (spec §11 "3단계", approval 13). Loaded with import() only after analyticsGate said "load" and
 * the page went idle, so neither vendor script is in the initial bundle and neither sees a number in the address.
 * Cookieless Vercel Web Analytics + Speed Insights; page views carry route templates; events carry enums only.
 */
export const SPEED_INSIGHTS_SAMPLE_RATE = 1;

export interface AnalyticsRuntime {
  /** Reports a client-side page change (the path is templated). */
  readonly pageview: (pathname: string) => void;
}

function send(raw: unknown): void {
  const event = parseAnalyticsEvent(raw);
  if (event === null) return;
  const payload = toEventPayload(event);
  track(payload.name, payload.properties);
}

export function startAnalyticsRuntime(options: { readonly entry: "home" | "deepLink"; readonly pathname: string }): AnalyticsRuntime {
  const route = routeForDocument(options.entry, options.pathname);
  // disableAutoTrack: page views come only from pageview() below, never from the script watching history.pushState.
  inject({ mode: "auto", debug: false, framework: "next", disableAutoTrack: true, beforeSend: templateBeforeSend });
  pageview({ route, path: route });
  const speedInsights = injectSpeedInsights({
    framework: "next",
    debug: false,
    route,
    sampleRate: SPEED_INSIGHTS_SAMPLE_RATE,
    beforeSend: templateBeforeSend
  });
  connectAnalyticsSink(send);

  let lastPathname = options.pathname;
  return {
    pageview: (pathname: string): void => {
      if (pathname === lastPathname) return;
      lastPathname = pathname;
      const next = templatePath(pathname);
      pageview({ route: next, path: next });
      speedInsights?.setRoute(next);
    }
  };
}
```

- [ ] **Step 7: Write the gate component**

Create `components/analytics/Analytics.tsx`:

```tsx
"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { getAdSignals, subscribeAdSignals } from "@/lib/ads/ad-signals";
import type { AdSignals } from "@/lib/ads/ad-signals";
import { analyticsGate } from "@/lib/analytics/gate";
import { disconnectAnalytics } from "@/lib/analytics/report";
import type { AnalyticsRuntime } from "@/lib/analytics/runtime";

const IDLE_TIMEOUT_MS = 2000;
// Server snapshot: fail-closed until the browser knows the entry.
const SERVER_SIGNALS: AdSignals = { entry: "deepLink", scrub: "pending", resultAdsAllowed: null, scrolledPastLookup: false };
const getServerSignals = (): AdSignals => SERVER_SIGNALS;

let runtime: Promise<AnalyticsRuntime | null> | null = null;

function afterLoadAndIdle(run: () => void): void {
  const whenIdle = (): void => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
    else window.setTimeout(run, 1);
  };
  if (document.readyState === "complete") whenIdle();
  else window.addEventListener("load", whenIdle, { once: true });
}

function startRuntime(entry: AdSignals["entry"]): Promise<AnalyticsRuntime | null> {
  return new Promise((resolve) => {
    afterLoadAndIdle(() => {
      import("@/lib/analytics/runtime")
        .then((module) => resolve(module.startAnalyticsRuntime({ entry, pathname: window.location.pathname })))
        .catch(() => {
          // A chunk that cannot load (new deploy, offline) means no statistics in this document; the page is unaffected.
          disconnectAnalytics();
          resolve(null);
        });
    });
  });
}

/** Re-evaluated on every pathname or signal change; loads the runtime at most once per document. */
function syncAnalytics(signals: AdSignals): void {
  const { pathname, search, hash, host } = window.location;
  const decision = analyticsGate({ pathname, search, hash, host, referrer: document.referrer, entry: signals.entry, scrub: signals.scrub });
  if (decision === "never") {
    disconnectAnalytics();
    return;
  }
  if (decision === "wait") return;
  if (runtime === null) {
    runtime = startRuntime(signals.entry);
    return;
  }
  void runtime.then((started) => started?.pageview(window.location.pathname));
}

/**
 * Cookieless statistics for public pages (spec §11, approval 13). Mounted once in app/(public)/layout.tsx, never under
 * /internal. Loads nothing while the address carries a number, before a deep link's scrub is confirmed, or when the
 * referrer carries a path (fail-closed, same signals as the ad loader).
 */
export function Analytics(): null {
  // Only a re-evaluation trigger: client navigations and the scrub's replaceState change the pathname.
  const pathname = usePathname();
  const signals = useSyncExternalStore(subscribeAdSignals, getAdSignals, getServerSignals);
  useEffect(() => {
    syncAnalytics(signals);
  }, [pathname, signals]);
  return null;
}
```

- [ ] **Step 8: Mount it in the public layout**

In `app/(public)/layout.tsx`:
(a) add directly below the line `import { AdLoader } from "@/components/ads/AdLoader";`:

```tsx
import { Analytics } from "@/components/analytics/Analytics";
```

(b) on the line after `<AdLoader />`, with the same indentation, add:

```tsx
<Analytics />
```

Change nothing else (S06's provider and header, S08's picker and footer stay). Check: `Select-String -LiteralPath "app/(public)/layout.tsx" -Pattern "<AdLoader />|<Analytics />"` → 2 lines, `<Analytics />` right after `<AdLoader />`; `git grep -n "components/analytics/Analytics" -- app` → only `app/(public)/layout.tsx` (never `app/(internal)/`).

- [ ] **Step 9: Report every lookup start from `useLookup`**

In `components/lookup/useLookup.ts`:
(a) add to the import block, directly below the `@/components/primitives/LiveAnnouncer` import:

```ts
import { reportLookupStart } from "@/lib/analytics/report";
```

(b) replace

```ts
      apply({ type: "submit", request, at: startedAt });
```

with

```ts
      apply({ type: "submit", request, at: startedAt });
      // S11: one lookup_start per accepted request — the entry enum only; the number never leaves this hook.
      reportLookupStart(request.entry, startedAt);
```

`retry` and the online re-lookup call `submit`, so every entry (`manual`, `deepLink`, `restore`, `carrierChip`, `retry`, `autoRetryOnline`) passes through this line. The hook's signature and return value do not change (contract §11.9).

- [ ] **Step 10: Run the tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/analytics-privacy.spec.ts`
Expected: `5 passed`.
Run the suites that share the layout, the scrub and the lookup hook: `npx playwright test tests/e2e/url-privacy.spec.ts tests/e2e/session-restore.spec.ts tests/e2e/deep-link.spec.ts tests/e2e/home.spec.ts tests/e2e/result-states.spec.ts tests/e2e/loading-timeline.spec.ts tests/e2e/internal-isolation.spec.ts`
Expected: 0 failed (same pass counts as the Task 0 baseline for these files).
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/analytics-events.spec.ts tests/unit/module-boundaries.spec.ts tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: 0 failed (`useLookup` now reaches `lib/analytics/report.ts`, which imports types only; no zod, schema, CS or derive module).

- [ ] **Step 11: Production run and the JS budget**

Production run (Conventions) of `tests/e2e/analytics-privacy.spec.ts tests/e2e/url-privacy.spec.ts tests/budgets/js-budget.spec.ts`.
Expected: 0 failed. Write the JS budget lines into the stage summary under "JS after S11 (C4)". The `/` initial bundle may grow only by the gate: `Analytics.tsx`, `gate.ts`, `url-template.ts`, `report.ts` (about 2 KB gzip). `runtime.ts`, `events.ts` and both vendor packages load with `import()` after `load` and idle, so they are not initial. If the budget test fails and its output counts the runtime or `@vercel` chunks as initial, stop and report it to the operator (the test classifies lazy chunks as initial, S07); do not loosen the budget.
S07's other two budget tests do see the lazy statistics code, by design of their counting basis (S07 deviation 16): "'/{번호}' loads at most 195 KB …" adds every script loaded until the settled result and `networkidle`, and on a deep link the statistics chunk loads right after the scrub; "the lazy result chunk …" counts scripts that arrive after `networkidle` on `/`, which the statistics chunk normally precedes (load + idle, at most 2 s). Write the `'/{번호}' through the result` line and the `result chunk` line (with its file list) under "JS after S11 (C4)" too. If either fails because of the statistics chunk, stop and report both numbers to the operator; do not loosen the budget and do not delay the statistics past the measurement.

- [ ] **Step 12: Typecheck and lint**

Run: `npm run typecheck; npx eslint lib/analytics components/analytics components/lookup/useLookup.ts "app/(public)/layout.tsx" tests/support/insights-double.ts tests/e2e/analytics-privacy.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing (including the React Compiler rules on `Analytics.tsx`).

- [ ] **Step 13: Commit**

Run: `git add package.json package-lock.json lib/analytics/runtime.ts components/analytics/Analytics.tsx "app/(public)/layout.tsx" components/lookup/useLookup.ts tests/support/insights-double.ts tests/e2e/analytics-privacy.spec.ts; git commit -m "feat: load cookieless Vercel statistics only after the URL scrub with templated routes"`
Expected: `8 files changed`.

---

### Task C5: Enum events from the page hooks, and the notice id

**Files:**
- Create: `lib/analytics/dom-observer.ts`
- Modify: `lib/analytics/runtime.ts` (one import; one call)
- Modify: `components/primitives/NoticeBanner.tsx` (one attribute on each of the two roots)
- Modify: `tests/unit/prepaint.spec.ts` (S08; one entry in the `ALLOWED` set of the style-independence scan)
- Test: `tests/e2e/analytics-privacy.spec.ts` (two imports, one helper, two describe blocks)

**Interfaces:**
- Consumes: Task C2 (`classifyLinkClick`, `isFailureCause`, `isGuideKey`, `waitBucket`, `AnalyticsEvent`); Task C3 (`peekPendingLookupStart`, `consumePendingLookupStart`); S05 `isStyleId`; the hooks `[data-view-state]` (S06), `[data-result-view]`, `[data-guide-key]`, `[data-overdue]`, `[data-failure-cause]`, `details[data-history]` (S07), `a[data-link-placement]`, `[data-affiliate-group]` (S05), `[data-recommended-products]` (S08), `[data-style-picker]` radios (`value` = `StyleId`) and `html[data-style]` (S08); S08's `tests/unit/prepaint.spec.ts` scan (`ALLOWED` set, `STYLE_ACCESS = /data-style|dataset\.style|STYLE_STORAGE_KEY|tt:style|applyStyleChoice|readAppliedStyle/` over `app`, `components`, `lib`, `config`); S06's `ShortcutRow` (all three links `data-link-placement="shortcut"`, no `[data-affiliate-group]`); test-only `INTERNAL_TEST_CREDENTIALS` (`tests/internal-auth.ts`).
- Produces: `installAnalyticsObserver(emit: (event: AnalyticsEvent) => void, doc?: Document): () => void` — one `lookup_settle` per lookup (only after that lookup's loading screen was seen, or when it started before the observer existed), `lookup_error` with the cause, `action` for link clicks, `details_open` for `details[data-history]`, `style_select` from the picker, one `notice_view` per notice id per document; the hook `data-notice-id` on `NoticeBanner` (Additions item 5).

- [ ] **Step 1: Confirm approval 13 is recorded**

Roadmap §4 row 13 must read `approved`; otherwise stop (Part C SKIPPED; fallback as in Task C1 Step 1: spec §16 item 13 '거절하면' — Observability route counts and the manual 톡톡 classification only, as `docs/ops/kpi-dashboard.md` lists under 대체 출처).

- [ ] **Step 2: Write the failing E2E tests**

In `tests/e2e/analytics-privacy.spec.ts`:
(a) add directly below `import type { Page } from "@playwright/test";`:

```ts
import { ANALYTICS_EVENT_NAMES, PROPERTY_VALUE_PATTERN, WAIT_BUCKETS } from "@/lib/analytics/events";
```

(b) add directly below `import { FAKE, mockTrack, trackData } from "../fixtures/tracking-fixtures";`:

```ts
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
```

(c) add directly below the `bodies` helper (the statement that ends with `.map((post) => post.body);`), after one blank line:

```ts
const eventNames = (capture: Capture): readonly unknown[] => bodies(capture, "event").map((body) => body.en);
```

(d) append at the end of the file:

```ts
test.describe("statistics events from the page hooks (S11, approval 13)", () => {
  test("clicks, history, style and notices become enum-only events", async ({ page }) => {
    const { capture } = await watch(page);
    // Keep new-tab links from opening outside pages; the capture-phase listener still sees the click.
    await page.addInitScript(() => {
      window.addEventListener(
        "click",
        (event) => {
          const target = event.target;
          if (target instanceof Element && target.closest('a[target="_blank"]') !== null) event.preventDefault();
        },
        true
      );
    });
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }));
    await page.goto("/");
    await expect.poll(() => bodies(capture, "view").length, LOAD_TIMEOUT).toBe(1);

    await page.getByRole("banner").getByRole("link", { name: "문의 새 창으로 열기", exact: true }).click();
    await expect.poll(() => eventData(capture, "action"), LOAD_TIMEOUT).toContainEqual({ action: "talk@header", state: "idle" });

    await lookupFromHome(page, FAKE.domestic);
    await expect.poll(() => eventData(capture, "lookup_settle").length, LOAD_TIMEOUT).toBe(1);
    const [settled] = eventData(capture, "lookup_settle");
    // The fixture's dates are around FIXTURE_NOW; on a later real clock the same result may already be overdue.
    expect(["inTransit", "inTransit+overdue"]).toContain(settled?.state);
    expect(WAIT_BUCKETS).toContain(settled?.wait);

    await page.locator("details[data-history] > summary").click();
    await expect.poll(() => eventNames(capture), LOAD_TIMEOUT).toContain("details_open");

    await page.locator("[data-style-picker]").getByRole("radio", { name: "서류형", exact: true }).check();
    await expect.poll(() => eventData(capture, "style_select"), LOAD_TIMEOUT).toEqual([{ style: "manifest" }]);

    await page.evaluate(() => {
      const notice = document.createElement("aside");
      notice.setAttribute("data-notice-kind", "info");
      notice.setAttribute("data-notice-id", "e2e-notice");
      document.body.append(notice);
    });
    await expect.poll(() => eventData(capture, "notice_view"), LOAD_TIMEOUT).toContainEqual({ id: "e2e-notice" });

    for (const body of bodies(capture, "event")) {
      expect(ANALYTICS_EVENT_NAMES).toContain(body.en);
      const values = Object.values(isRecord(body.ed) ? body.ed : {});
      expect(values.length).toBeLessThanOrEqual(2);
      for (const value of values) {
        if (typeof value === "string") expect(value).toMatch(PROPERTY_VALUE_PATTERN);
        else expect(typeof value).toBe("boolean");
      }
    }
    assertInsightsClean(capture.requests());
  });

  test("a failed lookup reports its state and cause once", async ({ page }) => {
    const { capture } = await watch(page);
    await mockTrack(page, "upstreamTimeout504");
    await page.goto("/");
    await expect.poll(() => bodies(capture, "view").length, LOAD_TIMEOUT).toBe(1);
    await lookupFromHome(page, FAKE.domestic);
    await expect.poll(() => eventData(capture, "lookup_error"), LOAD_TIMEOUT).toEqual([{ cause: "upstreamTimeout" }]);
    expect(eventData(capture, "lookup_settle")).toHaveLength(1);
    expect(eventData(capture, "lookup_settle")[0]?.state).toBe("temporaryDelay");
    assertInsightsClean(capture.requests());
  });
});

test.describe("internal pages (S11, approval 13)", () => {
  test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

  test("/internal never loads the statistics scripts, and every notice banner carries its id", async ({ page }) => {
    const { capture, doubles } = await watch(page);
    await page.goto("/internal/ui-kit");
    await settle(page);
    expect(doubles.scripts()).toEqual([]);
    const banners = page.locator("[data-notice-variant]");
    expect(await banners.count()).toBeGreaterThan(0);
    for (const banner of await banners.all()) {
      await expect(banner).toHaveAttribute("data-notice-id", /^[a-z0-9][a-z0-9-]*$/);
    }
    expect(insightsPosts(capture.requests())).toEqual([]);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/analytics-privacy.spec.ts`
Expected: `3 failed, 5 passed` — "clicks, history, style and notices …" times out on the `action` poll (`Received: []`), "a failed lookup reports …" times out on the `lookup_error` poll, "/internal never loads …" fails on `toHaveAttribute("data-notice-id", …)` (the attribute does not exist yet); the five Task C4 tests pass.

- [ ] **Step 4: Write the observer**

Create `lib/analytics/dom-observer.ts`:

```ts
import { classifyLinkClick, isFailureCause, isGuideKey, waitBucket } from "@/lib/analytics/events";
import type { AnalyticsEvent } from "@/lib/analytics/events";
import { consumePendingLookupStart, peekPendingLookupStart } from "@/lib/analytics/report";
import { isStyleId } from "@/lib/style/styles";
import type { GuideKey } from "@/lib/tracking/types";

/**
 * Turns the contract data-* hooks (roadmap §11.13, S07 additions) into enum events. Browser only; lazy chunk.
 * It reads attributes and never text, input values or positions (spec §11: 리플레이·히트맵·입력 캡처 금지).
 */
const VIEW_STATE = "[data-view-state]";
const RESULT_CARD = "[data-result-view] [data-guide-key]";
const WATCHED_ATTRIBUTES = ["data-view-state", "data-result-view", "data-guide-key", "data-failure-cause", "data-overdue", "data-notice-id"];

interface ScreenState {
  readonly guideKey: GuideKey;
  readonly overdue: boolean;
}

/** The state a click happens in: 'idle'/'loading' from the mode, otherwise the status card's guide key. */
function currentState(doc: Document): ScreenState | null {
  const root = doc.querySelector(VIEW_STATE);
  if (root === null) return { guideKey: "idle", overdue: false };
  const mode = root.getAttribute("data-view-state");
  if (mode === "idle" || mode === "loading") return { guideKey: mode, overdue: false };
  const card = root.querySelector(RESULT_CARD) ?? root.querySelector("[data-guide-key]");
  const guideKey = card?.getAttribute("data-guide-key") ?? null;
  if (!isGuideKey(guideKey)) return null;
  return { guideKey, overdue: card?.getAttribute("data-overdue") === "true" };
}

export function installAnalyticsObserver(emit: (event: AnalyticsEvent) => void, doc: Document = document): () => void {
  const installedAt = performance.now();
  let armedSeq: number | null = null;
  let settledOnce = false;
  let reportedNotices: ReadonlySet<string> = new Set();

  /** One lookup_settle per lookup: only after this lookup's loading screen was seen (or it started before we were installed). */
  const scanSettle = (): void => {
    const pending = peekPendingLookupStart();
    const root = doc.querySelector(VIEW_STATE);
    if (pending === null || root === null) return;
    const mode = root.getAttribute("data-view-state");
    if (mode === "loading") {
      armedSeq = pending.seq;
      return;
    }
    if (mode !== "settled" && mode !== "error") return;
    const ready = armedSeq === pending.seq || (pending.at < installedAt && !settledOnce);
    const card = root.querySelector(RESULT_CARD);
    const guideKey = card?.getAttribute("data-guide-key") ?? null;
    if (!ready || card === null || !isGuideKey(guideKey)) return;
    consumePendingLookupStart(pending.seq);
    settledOnce = true;
    const causeValue = root.querySelector("[data-result-view] [data-failure-cause]")?.getAttribute("data-failure-cause") ?? null;
    const cause = isFailureCause(causeValue) ? causeValue : null;
    const overdue = card.getAttribute("data-overdue") === "true";
    emit({ name: "lookup_settle", guideKey, overdue, wait: waitBucket(performance.now() - pending.at, cause === "clientTimeout") });
    if (cause !== null) emit({ name: "lookup_error", cause });
  };

  const scanNotices = (): void => {
    doc.querySelectorAll("[data-notice-id]").forEach((element) => {
      const id = element.getAttribute("data-notice-id");
      if (id === null || reportedNotices.has(id)) return;
      reportedNotices = new Set([...reportedNotices, id]);
      emit({ name: "notice_view", id });
    });
  };

  const scan = (): void => {
    scanSettle();
    scanNotices();
  };

  const onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const link = classifyLinkClick({
      placement: anchor.getAttribute("data-link-placement"),
      href: anchor.getAttribute("href") ?? "",
      talkHref: doc.querySelector('a[data-link-placement="header"]')?.getAttribute("href") ?? null,
      inStoreGroup: anchor.closest("[data-affiliate-group], [data-recommended-products]") !== null,
      inResult: anchor.closest("[data-result-view]") !== null,
      opensNewTab: anchor.target === "_blank"
    });
    const state = currentState(doc);
    if (link === null || state === null) return;
    emit({ name: "action", kind: link.kind, placement: link.placement, guideKey: state.guideKey, overdue: state.overdue });
  };

  const onToggle = (event: Event): void => {
    const target = event.target;
    if (target instanceof HTMLDetailsElement && target.open && target.hasAttribute("data-history")) emit({ name: "details_open" });
  };

  const onChange = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.closest("[data-style-picker]") === null) return;
    if (isStyleId(target.value)) {
      emit({ name: "style_select", style: target.value });
      return;
    }
    // The picker's value is not a style id: read the style the page applied after its own change handler ran.
    window.requestAnimationFrame(() => {
      const style = doc.documentElement.getAttribute("data-style");
      if (isStyleId(style)) emit({ name: "style_select", style });
    });
  };

  const observer = new MutationObserver(scan);
  observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: WATCHED_ATTRIBUTES });
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("toggle", onToggle, true);
  doc.addEventListener("change", onChange, true);
  scan();
  return () => {
    observer.disconnect();
    doc.removeEventListener("click", onClick, true);
    doc.removeEventListener("toggle", onToggle, true);
    doc.removeEventListener("change", onChange, true);
  };
}
```

- [ ] **Step 5: Install it from the runtime**

In `lib/analytics/runtime.ts`:
(a) add directly below `import { injectSpeedInsights } from "@vercel/speed-insights";`:

```ts
import { installAnalyticsObserver } from "@/lib/analytics/dom-observer";
```

(b) replace

```ts
  connectAnalyticsSink(send);
```

with

```ts
  connectAnalyticsSink(send);
  installAnalyticsObserver(send);
```

- [ ] **Step 6: Give every notice banner its id**

In `components/primitives/NoticeBanner.tsx`, directly after each of the two lines `data-notice-kind={notice.kind}` (one on the banner `<aside>`, one on the inline `<p>`), add a line with the same indentation:

```tsx
data-notice-id={notice.id}
```

Check: `Select-String -LiteralPath components/primitives/NoticeBanner.tsx -Pattern "data-notice-id=\{notice\.id\}"` → 2 lines. The id comes from `config/site.config.ts` (`'2026-chuseok'`-style), never from customer input; the observer re-checks it against `NOTICE_ID_PATTERN` and the tracking-value rule before sending.

- [ ] **Step 7: Let S08's style-independence scan allow the observer**

The observer reads `[data-style-picker]` and `html[data-style]`, which S08's scan (`tests/unit/prepaint.spec.ts`, "only the root layout, the style modules and the picker read or write the style …") reports for any file outside its `ALLOWED` set. S08 open issue 13 asks the stage that adds such a reader to extend the set in the same commit.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/prepaint.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `1 failed`: the style-independence test lists `offenders` `["lib/analytics/dom-observer.ts"]`.
In `tests/unit/prepaint.spec.ts`, inside `const ALLOWED = new Set([ … ]);`, replace the last entry line

```ts
    "components/shell/StylePicker.tsx"
```

with

```ts
    "components/shell/StylePicker.tsx",
    // S11 (approval 13): the statistics observer reads the picker's radio value and html[data-style] for style_select only.
    "lib/analytics/dom-observer.ts"
```

Run the same command again.
Expected: 0 failed (every `prepaint.spec.ts` test passes).

- [ ] **Step 8: Run the tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/analytics-privacy.spec.ts tests/e2e/ui-kit.spec.ts tests/e2e/result-states.spec.ts tests/e2e/style-picker.spec.ts`
Expected: 0 failed (`analytics-privacy.spec.ts` 8 passed; the other three keep their Task 0 counts).
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/analytics-events.spec.ts tests/unit/prepaint.spec.ts tests/unit/module-boundaries.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: 0 failed.

- [ ] **Step 9: Production run**

Production run (Conventions) of `tests/e2e/analytics-privacy.spec.ts tests/e2e/url-privacy.spec.ts`.
Expected: 0 failed.

- [ ] **Step 10: Typecheck and lint**

Run: `npm run typecheck; npx eslint lib/analytics components/primitives/NoticeBanner.tsx tests/unit/prepaint.spec.ts tests/e2e/analytics-privacy.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 11: Commit**

Run: `git add lib/analytics/dom-observer.ts lib/analytics/runtime.ts components/primitives/NoticeBanner.tsx tests/unit/prepaint.spec.ts tests/e2e/analytics-privacy.spec.ts; git commit -m "feat: turn page hooks into enum-only statistics events"`
Expected: `5 files changed`.

---

### Task C6: Privacy policy discloses the cookieless statistics

**Files:**
- Modify: `app/(public)/privacy/page.tsx` (`LAST_UPDATED`; one new constant; section "2. 자동으로 기록되는 정보"; section "7. 방침 변경")
- Test: `tests/e2e/analytics-privacy.spec.ts` (append one test)

**Interfaces:**
- Consumes: S02's policy page (`LAST_UPDATED`, `PREVIOUS_EFFECTIVE_DATE`, the `sections` array, the R1 change-log line in section 7); S02's `tests/privacy.spec.ts` (must stay green).
- Produces: four policy sentences about Vercel Web Analytics and Speed Insights (cookieless, what is sent, loaded only after the number left the address, Vercel's processing), a new 시행일, and `R1_EFFECTIVE_DATE` holding the R1 date for the change log.

- [ ] **Step 1: Confirm approval 13 is recorded**

Roadmap §4 row 13 must read `approved`; otherwise stop (Part C SKIPPED; the policy keeps saying the service issues no identifying cookie, which stays true).

- [ ] **Step 2: Write the failing test**

Append at the end of `tests/e2e/analytics-privacy.spec.ts`:

```ts
test("the privacy policy discloses the cookieless statistics (S11, approval 13)", async ({ page }) => {
  await page.goto("/privacy");
  const policy = page.locator("main");
  for (const text of [
    "방문 통계를 위해 Vercel Web Analytics와 Vercel Speed Insights를 씁니다. 두 도구 모두 쿠키를 쓰지 않습니다.",
    "조회번호·전화번호·입력한 내용과 주소의 물음표(?)·샵(#) 뒤 내용은 보내지 않습니다.",
    "통계 코드는 주소에서 조회번호를 지운 뒤에만 불러옵니다."
  ]) {
    await expect(policy.getByText(text, { exact: false }).first(), text).toBeVisible();
  }
});
```

- [ ] **Step 3: Run it to verify it fails**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/analytics-privacy.spec.ts -g "privacy policy discloses"`
Expected: FAIL — `1 failed`: `toBeVisible` for "방문 통계를 위해 Vercel Web Analytics와 Vercel Speed Insights를 씁니다. …" finds no element.

- [ ] **Step 4: Pick the effective date**

Run: `Get-Date -Format "yyyy-M-d"` → e.g. `2027-1-4`. Write it as `YYYY년 M월 D일` (e.g. `2027년 1월 4일`). Task Final asks the operator to confirm it or replace it with the R5 deploy date.

- [ ] **Step 5: Edit the policy**

In `app/(public)/privacy/page.tsx`:
(a) Replace the line `const LAST_UPDATED = "2026년 10월 2일";` with the block below. The example values follow S02 Task 10: `2026년 10월 2일` is S02's example R1 date — the repository holds the date S02's Step 3 picked, so read the line first (`Select-String -LiteralPath "app/(public)/privacy/page.tsx" -Pattern 'const LAST_UPDATED'`) and use that exact string both in the line you replace and as the value of `R1_EFFECTIVE_DATE`; `2027년 1월 4일` is the Step 4 example — use the Step 4 date for `LAST_UPDATED`.

```ts
const LAST_UPDATED = "2027년 1월 4일";
/** The R1 (number protection) effective date, kept for the change log in section 7. */
const R1_EFFECTIVE_DATE = "2026년 10월 2일";
```

(b) In the section object whose `title` is `"2. 자동으로 기록되는 정보"`, directly after the body line that starts with `"과도한 요청을 막기 위해 접속 IP 기준 요청 횟수를`, add (put a comma after that line if it has none):

```ts
      "방문 통계를 위해 Vercel Web Analytics와 Vercel Speed Insights를 씁니다. 두 도구 모두 쿠키를 쓰지 않습니다.",
      "통계에는 화면 종류(조회 화면, 조회 결과 화면, 개인정보처리방침), 이용한 기능의 종류(조회 시작, 결과 상태, 누른 버튼의 종류)와 화면 표시 속도만 보냅니다. 조회번호·전화번호·입력한 내용과 주소의 물음표(?)·샵(#) 뒤 내용은 보내지 않습니다.",
      "통계 코드는 주소에서 조회번호를 지운 뒤에만 불러옵니다. 이전 페이지의 주소가 경로까지 전달된 방문에서는 통계를 보내지 않고, 다른 사이트에서 들어온 경우에는 그 사이트의 도메인만 남을 수 있습니다.",
      "통계 서비스 제공자(Vercel)는 요청을 처리하는 과정에서 접속 IP와 브라우저 정보를 다룰 수 있으며, 세부 처리는 Vercel의 개인정보 처리방침을 따릅니다."
```

(c) In the section object whose `title` is `"7. 방침 변경"`, the change-log line S02 wrote starts with `` `${LAST_UPDATED} 변경: `` and ends with `` 이전 시행일: ${PREVIOUS_EFFECTIVE_DATE}.` ``. Change its leading `${LAST_UPDATED}` to `${R1_EFFECTIVE_DATE}` (the R1 change keeps its own date), put a comma after that line, and add below it:

```ts
      `${LAST_UPDATED} 변경: 쿠키 없는 방문 통계(Vercel Web Analytics, Vercel Speed Insights) 안내를 추가했습니다. 이전 시행일: ${R1_EFFECTIVE_DATE}.`
```

Section 4 keeps "이 서비스 자체는 이용자를 식별하기 위한 쿠키를 별도로 발행하지 않습니다." — still true. No heading number changes, so S02's "8. 문의 채널" assertion stays valid.

- [ ] **Step 6: Run the tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/analytics-privacy.spec.ts tests/privacy.spec.ts`
Expected: 0 failed (`analytics-privacy.spec.ts` 9 passed; S02's policy test still finds its sentences, a `시행일: YYYY년 M월 D일` line that is not "2026년 9월 3일", and "8. 문의 채널").

- [ ] **Step 7: No real-number or forbidden-word regressions**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: 0 failed.

- [ ] **Step 8: Typecheck and lint**

Run: `npm run typecheck; npx eslint "app/(public)/privacy/page.tsx" tests/e2e/analytics-privacy.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 9: Commit**

Run: `git add "app/(public)/privacy/page.tsx" tests/e2e/analytics-privacy.spec.ts; git commit -m "docs: disclose cookieless statistics in the privacy policy"`
Expected: `2 files changed`. Write into the stage summary: "privacy text for statistics needs the operator's legal check (spec §16 item 6 recommends legal review of the policy); 시행일 to be confirmed against the R5 deploy date".

---

## Part D — Operator documents (R5)

All four documents are for the operator, in Korean, and are applied by the operator; `tests/unit/ops-docs.spec.ts` pins their structure. Each task ends with S01's repo guard (the documents live under `docs/`).

### Task D1: KPI dashboard definition

**Files:**
- Create: `docs/ops/kpi-dashboard.md`
- Test: `tests/unit/ops-docs.spec.ts` (append one describe block)

**Interfaces:**
- Consumes: Task A1 (`read`, `expectAll` in `tests/unit/ops-docs.spec.ts`; the weekly baseline); the event names and wire properties of Task C2 (whether or not Part C ran — the document lists the fallback source for every KPI); `AD_TIMING_POLICY` values (S02/S08, roadmap §11.9); S10's `track_lookup` line.
- Produces: `docs/ops/kpi-dashboard.md` — the seven spec §11 KPIs with formula, source after approval 13, fallback source, target; the events table; the '/' RPM 15 % rollback rule (roadmap §3 Q5); the enable steps the operator runs before the R5 deploy.

- [ ] **Step 1: Write the failing test**

Append at the end of `tests/unit/ops-docs.spec.ts`:

```ts

test.describe("operator documents, R5 (S11)", () => {
  test("the KPI dashboard defines the seven KPIs with both sources and the 15 % rule", () => {
    expectAll("docs/ops/kpi-dashboard.md", [
      "조회당 문의",
      "정상 대기 3상태의 톡톡 클릭률",
      "문제 상태 톡톡 중 문의 내용 복사 비율",
      "같은 탭 10분 안 재조회",
      "결과 대기 버킷",
      "delivered 스토어 클릭률과 '/' RPM",
      "필드 LCP·INP·CLS p75",
      "대체 출처",
      "`lookup_start`",
      "`lookup_settle`",
      "`lookup_error`",
      "`action`",
      "`details_open`",
      "`notice_view`",
      "`style_select`",
      "절반",
      "50 % 이상",
      "25초 초과 1 % 미만",
      "LCP 2.5초 이하, INP 200ms 이하, CLS 0.05 이하",
      "15 %",
      "`AD_TIMING_POLICY`",
      "`\"afterScrub\"`",
      "`\"neverOnNumberRoutes\"`",
      "Web Analytics를",
      "속성을 최대 2개"
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ops-docs.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `1 failed, 1 passed`; the KPI test fails with `ENOENT: no such file or directory, open '…\docs\ops\kpi-dashboard.md'`.

- [ ] **Step 3: Write the dashboard definition**

Create `docs/ops/kpi-dashboard.md`:

```markdown
# KPI 대시보드 정의

- 목적: 개편이 "가장 빨리 안심하고 다음 행동을 바로 안다"를 이뤘는지, 문의와 수익을 해치지 않았는지를 매주 같은 식으로 봅니다(스펙 §1 성공 기준, §11 KPI).
- 비교 창: 개편 전 4주(기준선, `observability-baseline.md`)와 개편 뒤 4주. 수익(KPI 6)은 배포 전후 2주씩 비교합니다.
- 출처: 승인 13이 있으면 Vercel Web Analytics 이벤트와 Speed Insights를 씁니다. 승인 13이 없으면 대체 출처(Observability 요청 수, 톡톡 수기 분류, AdSense·파트너 대시보드)만 씁니다. 아래 표에 두 출처를 모두 적어 둡니다.
- 개인정보: 이벤트와 보고서에는 조회번호·전화번호·입력 내용이 없습니다. 이 문서에도 적지 않습니다.

## 켜기 전 준비(승인 13, 운영자)

- Vercel 대시보드 → 프로젝트 `tracking-tipoasis` → Analytics에서 Web Analytics를, Speed Insights에서 Speed Insights를 켭니다. R5 배포 전에 켭니다.
- 사용자 지정 이벤트는 Vercel 요금제에 따라 쓸 수 있는 속성 수가 다릅니다. 이 사이트의 이벤트는 속성을 최대 2개만 보냅니다. 요금제 화면에서 사용자 지정 이벤트가 켜져 있는지 확인합니다.
- 배포 뒤 하루 안에 Web Analytics의 페이지 목록이 `/`, `/[trackingNumber]`, `/privacy`처럼 템플릿으로만 보이는지 확인합니다. 번호가 보이면 바로 Web Analytics를 끄고 알립니다.

## 이벤트(속성은 모두 정해진 값)

| 이벤트 | 속성 | 뜻 |
|---|---|---|
| `lookup_start` | `entry`(manual, deepLink, restore, carrierChip, retry, autoRetryOnline), `repeat`(같은 탭 10분 안 두 번째 이후 조회면 true) | 조회 시작 |
| `lookup_settle` | `state`(상태 키, 걱정 기준일이 지났으면 뒤에 `+overdue`), `wait`(lt1, 1to3, 3to8, 8to25, 25to45, timeout) | 결과나 오류가 화면에 나온 때 |
| `lookup_error` | `cause`(오류 원인 키) | 오류로 끝난 조회 |
| `action` | `action`(종류@자리, 예: talk@header, copyAndTalk@state, storeLink@deliveredLead), `state` | 링크 누름 |
| `details_open` | 없음 | 처리 내역 펼침 |
| `notice_view` | `id`(공지 id) | 공지가 화면에 나옴 |
| `style_select` | `style`(signal, manifest, night) | 화면 스타일 바꿈 |
| `helpful` | `value`(yes, no) | 정의만 있음(화면 없음) |

## KPI 표

| # | KPI | 식 | 출처(승인 13 이후) | 대체 출처 | 목표·경보 |
|---|---|---|---|---|---|
| 1 | 조회당 문의 | 주간 톡톡 문의 ÷ 주간 조회 | 분자: 수기 분류 합계. 분모: `lookup_start` 수 | 분모: Observability `/api/track` 요청 수 | 개편 뒤 4주 평균이 개편 전 4주보다 낮을 것 |
| 2 | 정상 대기 3상태의 톡톡 클릭률 | `action`(talk·copyAndTalk)이면서 `state`가 customsArrived, customsWaiting, customsCleared, handedToCarrier, pickedUp, inTransit 중 하나(`+overdue` 없음)인 수 ÷ 같은 `state`의 `lookup_settle` 수 | 이벤트 | 수기 분류 '위치·언제 와요' ÷ 조회 | 가설: 개편 전의 절반 |
| 3 | 문제 상태 톡톡 중 문의 내용 복사 비율 | copyAndTalk ÷ (talk + copyAndTalk), `state`가 오류·stale·lookupUnavailable·ambiguous 이거나 `+overdue` | 이벤트 | 톡톡 첫 메시지가 '[배송 문의] 조회번호 …' 형식인 문의 ÷ 문제 상태 문의(수기) | 50 % 이상 |
| 4 | 같은 탭 10분 안 재조회 | (`lookup_start`의 `repeat`=true 수 + `entry`=restore 수) ÷ `lookup_start` 수 | 이벤트 | 없음(측정 불가로 표시) | 개편 뒤 감소(불안의 대리 지표) |
| 5 | 결과 대기 버킷 | `wait`가 25to45 또는 timeout인 `lookup_settle` ÷ 전체 `lookup_settle` | 이벤트 | 승인 5 뒤 `track_lookup`의 `elapsedBucket`이 `ge15s`인 줄 ÷ 전체 `track_lookup` 줄(서버 처리 시간만 재고 가장 긴 버킷이 15초 이상이라 25초 초과를 직접 세지 못합니다. 이 비율이 1 % 미만이면 목표도 지킨 것으로 봅니다) | 25초 초과 1 % 미만 |
| 6 | delivered 스토어 클릭률과 '/' RPM | `action` storeLink@deliveredLead ÷ `state`=delivered인 `lookup_settle`; '/' RPM은 AdSense 보고서 | 이벤트 + AdSense | 파트너 대시보드의 deliveredLead 링크 클릭 수 + AdSense | '/' RPM 15 % 하락 시 되돌림 규칙 |
| 7 | 필드 LCP·INP·CLS p75 | Speed Insights의 경로별 p75(`/`, `/[trackingNumber]`) | Speed Insights | 없음(CI 예산 `tests/budgets`만) | LCP 2.5초 이하, INP 200ms 이하, CLS 0.05 이하 |

- 스타일 사용 비중: `style_select`의 `style`별 비중을 4주마다 봅니다. 거의 쓰이지 않는 스타일의 정리 여부는 운영자가 정합니다(스펙 §13 "정리 기준").

## 되돌림 규칙: '/' RPM 15 %

- 개편 뒤 2주의 '/' RPM 평균이 개편 전 2주보다 15 % 이상 낮으면, 홈 광고 로더 지연 규칙부터 되돌립니다(로드맵 §3 질문 5).
- 해당하는 경우: 승인 7로 `lib/ads/ad-gate.ts`의 `AD_TIMING_POLICY`가 `"afterAllowedResult"`일 때만입니다.
- 방법: `AD_TIMING_POLICY`를 승인 6 상태에 맞게 바꾸는 PR을 엽니다. 승인 6이 approved이면 `"afterScrub"`, 아니면 `"neverOnNumberRoutes"`. PR → CI → main 순서입니다.
- 되돌린 뒤 2주를 다시 비교하고 결과를 "결정 기록"에 적습니다.

## 주간 표

| 주(월요일) | KPI 1 | KPI 2 | KPI 3 | KPI 4 | KPI 5 | KPI 6 스토어 | KPI 6 '/' RPM | KPI 7 LCP | KPI 7 INP | KPI 7 CLS | 비고 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | | |

## 결정 기록

| 날짜 | 근거(KPI와 기간) | 결정 |
|---|---|---|
| | | |
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ops-docs.spec.ts tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: 0 failed (`ops-docs.spec.ts` 2 passed).

- [ ] **Step 5: Commit**

Run: `npx eslint tests/unit/ops-docs.spec.ts; git add docs/ops/kpi-dashboard.md tests/unit/ops-docs.spec.ts; git commit -m "docs: define the KPI dashboard with fallback sources and the RPM rollback rule"`
Expected: eslint prints nothing; `2 files changed`.

---

### Task D2: AdSense account checklist — the approval-15 fallback

**Files:**
- Create: `docs/ops/adsense-settings-checklist.md`
- Test: `tests/unit/ops-docs.spec.ts` (one helper; one test in the R5 block)

**Interfaces:**
- Consumes: the roadmap ledger row 15 (read by the test); `read`, `expectAll` (Task A1).
- Produces: the private test helper `ledgerStatus(approval: number): string` (Task D3 reuses it); `docs/ops/adsense-settings-checklist.md` in its spec §16 item 15 '거절하면' form — only the vignette extra trigger is switched off, in a week that is neither the R1 nor the R3 deploy week. Task D2A replaces it with the full list when approval 15 is `approved`.

- [ ] **Step 1: Write the failing test**

In `tests/unit/ops-docs.spec.ts`:
(a) add directly above the line `test.describe("operator documents (S11)", () => {`:

```ts
/** Status of an approval row in the roadmap ledger (§4): approved | pending | rejected. */
function ledgerStatus(approval: number): string {
  const ledger = read("docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md");
  const status = new RegExp(`^\\| ${approval} \\| [^|]+\\| (\\w+) \\|`, "m").exec(ledger)?.[1];
  expect(status, `approval ${approval} row not found in roadmap §4`).toBeTruthy();
  return status ?? "";
}
```

(b) replace the last line of the file, `});`, with:

```ts

  test("the AdSense checklist follows approval 15 and keeps the different-week rule", () => {
    const document = "docs/ops/adsense-settings-checklist.md";
    expectAll(document, ["비네트", "추가 트리거를 끕니다", "R1(후보 B) 배포 주와도, R3(새 화면) 배포 주와도 다른 주", "적용 기록"]);
    const text = read(document);
    const fullList = [
      "데스크톱 앵커를 끄고",
      "모바일 앵커는 하단 위치만",
      "페이지 내 광고(in-page): 끕니다",
      "데스크톱 왼쪽만",
      "`ads.manualSlotId`",
      "`/internal`로 시작하는 주소를 제외"
    ];
    if (ledgerStatus(15) === "approved") {
      for (const item of fullList) expect(text, item).toContain(item);
    } else {
      expect(text).toContain("'거절하면'");
      for (const item of fullList) expect(text, item).not.toContain(item);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ops-docs.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `1 failed, 2 passed`; the AdSense test fails with `ENOENT … adsense-settings-checklist.md`.

- [ ] **Step 3: Write the fallback checklist**

Create `docs/ops/adsense-settings-checklist.md`:

```markdown
# AdSense 계정 설정 체크리스트

- 승인 15: 미승인(로드맵 §4의 상태가 approved가 아님). 스펙 §16 항목 15의 '거절하면'에 따라 비네트 추가 트리거만 끄고 나머지는 그대로 둡니다. 요약과 다음 행동 사이에 자동 광고가 들어갈 가능성은 남습니다.
- 운영자가 AdSense 계정에서 직접 적용합니다. 에이전트는 계정에 접속하지 않습니다.
- 적용 주: R1(후보 B) 배포 주와도, R3(새 화면) 배포 주와도 다른 주에 적용합니다.
- 적용 전: 지난 2주의 '/' RPM과 전체 수익을 `kpi-dashboard.md` 주간 표에 적어 둡니다.

## 바꿀 설정

- [ ] 자동 광고 → 광고 형식 → 비네트: 추가 트리거를 끕니다.

## 그대로 두는 설정(승인 15가 나면 다시 봄)

- 사이드 레일 위치, 데스크톱 앵커, 모바일 앵커 위치, 페이지 내 광고(in-page), 푸터 앞 수동 광고 단위, `/internal` 페이지 제외.

## 적용 기록

| 날짜 | 바꾼 설정 | 확인한 사람 | 비고 |
|---|---|---|---|
| | | | |

## 적용 뒤

- 적용 뒤 2주의 '/' RPM과 수익을 적용 전 2주와 비교해 `kpi-dashboard.md` 결정 기록에 적습니다.
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ops-docs.spec.ts tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected with approval 15 `pending`/`rejected`: 0 failed (`ops-docs.spec.ts` 3 passed).
Expected with approval 15 `approved`: the AdSense test fails on `데스크톱 앵커를 끄고` — the ledger asks for the full list. Do not commit yet; run Task D2A now and commit both tasks together with D2A's commit message.

- [ ] **Step 5: Commit (approval 15 not approved)**

Run: `npx eslint tests/unit/ops-docs.spec.ts; git add docs/ops/adsense-settings-checklist.md tests/unit/ops-docs.spec.ts; git commit -m "docs: add the AdSense account checklist for the vignette extra trigger"`
Expected: eslint prints nothing; `2 files changed`.

---

### Task D2A (gated by approval 15): Full AdSense account checklist

**Files:**
- Modify: `docs/ops/adsense-settings-checklist.md` (whole file)

**Interfaces:**
- Consumes: Task D2 (the test and the fallback file).
- Produces: the spec §16 item 15 proposal as an operator checklist: vignette extra trigger off (30–60 minutes), side rail left only, desktop anchor off, anchor bottom only, in-page auto ads off, one manual unit before the footer (`ads.manualSlotId`, S08), `/internal` excluded, applied in a week that is neither the R1 nor the R3 deploy week.

- [ ] **Step 1: Confirm approval 15 is recorded**

Open `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §4, row 15. Expected: `approved`. If not, stop: Task D2 already shipped spec §16 item 15 '거절하면' — only the vignette extra trigger goes off and the rest stays, so an automatic ad can still land between the summary and the next action. Mark D2A SKIPPED with that reason.

- [ ] **Step 2: Run the test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ops-docs.spec.ts -g "AdSense"; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `1 failed`: `Expected substring: "데스크톱 앵커를 끄고"` (the file still holds the fallback list).

- [ ] **Step 3: Write the full checklist**

Replace the whole content of `docs/ops/adsense-settings-checklist.md` with:

```markdown
# AdSense 계정 설정 체크리스트

- 승인 15: approved(로드맵 §4). 운영자가 AdSense 계정에서 직접 적용합니다. 에이전트는 계정에 접속하지 않습니다.
- 적용 주: R1(후보 B) 배포 주와도, R3(새 화면) 배포 주와도 다른 주에 적용합니다. 효과를 따로 재기 위해서입니다(스펙 §11, §16 항목 15).
- 적용 전: 지난 2주의 '/' RPM과 전체 수익을 `kpi-dashboard.md` 주간 표에 적어 둡니다.
- 이유: 오버레이가 결과와 다음 행동을 덮지 않게 합니다.

## 바꿀 설정

- [ ] 자동 광고 → 광고 형식 → 비네트: 추가 트리거를 끕니다. 빈도는 30–60분에 한 번으로 둡니다.
- [ ] 자동 광고 → 오버레이 형식 → 사이드 레일: 데스크톱 왼쪽만 씁니다. 계정 화면에 왼쪽·오른쪽 선택이 없으면 사이드 레일을 끄고 적용 기록에 그렇게 적습니다.
- [ ] 자동 광고 → 오버레이 형식 → 앵커: 데스크톱 앵커를 끄고, 모바일 앵커는 하단 위치만 씁니다.
- [ ] 자동 광고 → 광고 형식 → 페이지 내 광고(in-page): 끕니다.
- [ ] 광고 단위 → 디스플레이 광고 단위 1개를 만듭니다. 푸터 바로 앞의 수동 슬롯 1개에만 씁니다. 만든 단위의 슬롯 ID를 `config/site.config.ts`의 `ads.manualSlotId`에 넣는 PR을 엽니다(S08 수동 슬롯, PR → CI → main).
- [ ] 사이트 → tracking.tipoasis.com → 자동 광고 → 페이지 제외: `/internal`로 시작하는 주소를 제외합니다.
- [ ] 저장하고 30분 뒤 휴대폰(가로 375px 안팎)과 데스크톱에서 '/'를 열어, 오버레이가 조회 영역과 결과의 지금 할 일을 가리지 않는지 봅니다.

## 적용 기록

| 날짜 | 바꾼 설정 | 확인한 사람 | 비고 |
|---|---|---|---|
| | | | |

## 적용 뒤

- 적용 뒤 2주의 '/' RPM과 수익을 적용 전 2주와 비교해 `kpi-dashboard.md` 결정 기록에 적습니다. 되돌릴지는 운영자가 정합니다.
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ops-docs.spec.ts tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: 0 failed.

- [ ] **Step 5: Commit**

Run: `git add docs/ops/adsense-settings-checklist.md tests/unit/ops-docs.spec.ts; git commit -m "docs: list the approved AdSense account settings for the operator"`
Expected: `1 file changed` (`2 files changed` when D2's files are committed here too).

---

### Task D3: Strict CSP decision record — the approval-16 fallback

**Files:**
- Create: `docs/ops/strict-csp-decision.md`
- Test: `tests/unit/ops-docs.spec.ts` (one test in the R5 block)

**Interfaces:**
- Consumes: `ledgerStatus` (Task D2), `read`, `expectAll` (Task A1); Part B's `csp_report` log line and its five keys (the record tells the operator how to read them).
- Produces: `docs/ops/strict-csp-decision.md` — background, options A/B/C, the two-week observation table, and the decision in its spec §16 item 16 '거절하면' form (C안: stage-1 headers stay). Task D3A replaces the decision section when approval 16 is `approved`.

- [ ] **Step 1: Write the failing test**

In `tests/unit/ops-docs.spec.ts`, replace the last line of the file, `});`, with:

```ts

  test("the strict CSP decision record follows approval 16", () => {
    const document = "docs/ops/strict-csp-decision.md";
    expectAll(document, ["## 배경", "## 선택지", "## 관찰 자료(결정 전 2주)", "## 결정", "`csp_report", "`documentKind`"]);
    const text = read(document);
    if (ledgerStatus(16) === "approved") {
      expect(text).toContain("A안 채택");
      expect(text).toContain("`proxy.ts` 변경에 대한 운영자 승인");
      expect(text).not.toContain("C안: 1단계 헤더를 유지합니다");
    } else {
      expect(text).toContain("C안: 1단계 헤더를 유지합니다(스펙 §16 항목 16 '거절하면')");
      expect(text).not.toContain("A안 채택");
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ops-docs.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `1 failed, 3 passed`; the CSP test fails with `ENOENT … strict-csp-decision.md`.

- [ ] **Step 3: Write the decision record**

Create `docs/ops/strict-csp-decision.md`:

```markdown
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

- 상태: 승인 16 미승인. C안: 1단계 헤더를 유지합니다(스펙 §16 항목 16 '거절하면'). Report-Only 관찰과 요약 로그는 계속합니다.
- 다시 볼 조건: 모르는 외부 주소의 스크립트 위반이 관찰되거나, '/'를 다른 이유로 동적 렌더로 바꾸게 되면 이 기록을 다시 엽니다.
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ops-docs.spec.ts tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected with approval 16 `pending`/`rejected`: 0 failed (`ops-docs.spec.ts` 4 passed).
Expected with approval 16 `approved`: the CSP test fails on `A안 채택`. Do not commit yet; run Task D3A now and commit both tasks with D3A's commit message.

- [ ] **Step 5: Commit (approval 16 not approved)**

Run: `npx eslint tests/unit/ops-docs.spec.ts; git add docs/ops/strict-csp-decision.md tests/unit/ops-docs.spec.ts; git commit -m "docs: record the strict CSP decision and the report observation procedure"`
Expected: eslint prints nothing; `2 files changed`.

---

### Task D3A (gated by approval 16): Adopt strict nonce CSP as a follow-up plan

**Files:**
- Modify: `docs/ops/strict-csp-decision.md` (the `## 결정` section)

**Interfaces:**
- Consumes: Task D3 (the test and the record).
- Produces: the decision "A안 채택" with the four start conditions of a separate follow-up plan (S12 candidate). S11 implements no enforcement: nonce CSP needs the frozen `proxy.ts`, a dynamic '/' and re-measured budgets, which are outside S11's scope and approvals.

- [ ] **Step 1: Confirm approval 16 is recorded**

Open roadmap §4, row 16. Expected: `approved`. If not, stop: Task D3 already recorded spec §16 item 16 '거절하면' — stage-1 headers (minimal enforced CSP + Report-Only) stay. Mark D3A SKIPPED with that reason.

- [ ] **Step 2: Run the test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ops-docs.spec.ts -g "strict CSP"; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `1 failed`: `Expected substring: "A안 채택"`.

- [ ] **Step 3: Record the decision**

In `docs/ops/strict-csp-decision.md`, replace everything from the line `## 결정` to the end of the file with:

```markdown
## 결정

- 상태: 승인 16 approved. A안 채택: nonce 기반 strict CSP를 강제하기로 합니다.
- 구현은 S11이 하지 않고 별도 계획(S12 후보)으로 합니다. 시작 조건은 네 가지입니다.
  1. 동결 파일 `proxy.ts` 변경에 대한 운영자 승인(요청마다 nonce를 만들고 헤더에 넣음).
  2. '/'를 동적 렌더로 바꾼 뒤 '/' HTML·LCP·CDN 예산을 다시 재는 계획(스펙 §12 목표 재확인).
  3. `AdLoader`, 화면 스타일 스크립트(S08), Next.js 인라인 스크립트에 nonce를 전달하는 설계.
  4. 관찰 자료 2주에서 광고 도메인 밖의 위반이 모두 설명될 것.
- 그때까지는 1단계 헤더와 Report-Only 관찰을 유지합니다.
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ops-docs.spec.ts tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: 0 failed.

- [ ] **Step 5: Commit**

Run: `git add docs/ops/strict-csp-decision.md tests/unit/ops-docs.spec.ts; git commit -m "docs: adopt strict nonce CSP as a follow-up plan with its start conditions"`
Expected: `1 file changed` (`2 files changed` when D3's files are committed here too). Write into the stage summary: "approval 16 approved — follow-up plan (S12 candidate) needs: proxy.ts change approval, dynamic '/' budget re-measurement, nonce hand-off design for AdLoader and the pre-paint script".

---

### Task D4: WAF proposal for `/internal`

**Files:**
- Create: `docs/ops/waf-internal-proposal.md`
- Test: `tests/unit/ops-docs.spec.ts` (one test in the R5 block)

**Interfaces:**
- Consumes: `read`, `expectAll` (Task A1); `CSP_REPORT_PATH` from Part B by value (`/api/csp-report`).
- Produces: `docs/ops/waf-internal-proposal.md` — rule 1 (IP rate limit on paths starting with `/internal`, log first, then 429), rule 2 (IP rate limit on `/api/csp-report`), the optional office-IP rule, apply/verify/rollback steps. The operator applies it; agents never change Firewall settings.

- [ ] **Step 1: Write the failing test**

In `tests/unit/ops-docs.spec.ts`, replace the last line of the file, `});`, with:

```ts

  test("the WAF proposal limits /internal and the report endpoint per IP, log first", () => {
    expectAll("docs/ops/waf-internal-proposal.md", [
      "`proxy.ts`",
      "401",
      "Starts with, `/internal`",
      "Equals, `/api/csp-report`",
      "Fixed Window, 창 60초, 기준 IP",
      "넘으면 429",
      "먼저 동작을 Log로",
      "## 되돌리기"
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ops-docs.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `1 failed, 4 passed`; the WAF test fails with `ENOENT … waf-internal-proposal.md`.

- [ ] **Step 3: Write the proposal**

Create `docs/ops/waf-internal-proposal.md`:

```markdown
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ops-docs.spec.ts tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: 0 failed (`ops-docs.spec.ts` 5 passed).

- [ ] **Step 5: Commit**

Run: `npx eslint tests/unit/ops-docs.spec.ts; git add docs/ops/waf-internal-proposal.md tests/unit/ops-docs.spec.ts; git commit -m "docs: propose Vercel WAF rate limits for /internal and the CSP report endpoint"`
Expected: eslint prints nothing; `2 files changed`.

- [ ] **Step 6: Hand the R5 documents to the operator**

Send `docs/ops/kpi-dashboard.md`, `docs/ops/adsense-settings-checklist.md`, `docs/ops/strict-csp-decision.md` and `docs/ops/waf-internal-proposal.md` with SendUserFile (caption: "R5 운영 문서: KPI 정의, AdSense 설정(배포와 다른 주), strict CSP 결정 기록, WAF 제안"). Add to the stage summary the operator's R5 list: switch on Web Analytics and Speed Insights in the Vercel project before the R5 deploy (approval 13 only); confirm custom events on the plan; apply the AdSense checklist in a week that is neither the R1 nor the R3 deploy week; collect two weeks of `csp_report` lines before revisiting approval 16; apply the WAF rules in Log mode first.

---

### Task Final: Stage gate

- [ ] **G1. Port free.** `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue` → no output (stop listeners otherwise).
- [ ] **G2. Lint.** `npm run lint` → exit 0, no errors, no warnings introduced by this stage.
- [ ] **G3. Typecheck.** `npm run typecheck` → exit 0.
- [ ] **G4. Build.** `npm run build` → exit 0. Route table: `ƒ /[trackingNumber]` always; `/` is `ƒ` in S01 (it still reads `searchParams`), `○ /` from S02 on, and `○ /` with `Revalidate 5m` from S06 on.
- [ ] **G5. Dev-mode E2E.** `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npm run test:e2e` → "N passed", 0 failed (skips allowed only for tests guarded by `PW_MODE`, `PW_SHOTS`, `PW_VISUAL`, or an approval-gated `test.skip` naming the approval).
- [ ] **G6. Production-mode E2E.** Re-run `npm run build` if `next start` reports a missing or stale build. Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait for `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` = `200`; then `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test` → 0 failed, including `tests/budgets/*`.
- [ ] **G7. After-screens.** Server still running: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='after'; $env:PW_STAGE='S11'; npx playwright test tests/tools/stage-screens.spec.ts` → PNGs in `test-artifacts/stage-screens/S11-after/` at 320, 375, 768, 1024, 1440. Compare with `S11-before/`; send both sets to the operator with SendUserFile. Stop the server (G1 command) and clear the flags: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.
- [ ] **G8. Budgets.** Paste the measured numbers of every budget this plan lists (from the G6 output) into the stage summary. Any budget over its fail line fails the gate.
- [ ] **G9. Code review.** Invoke the `code-review` skill on `git diff claude/tipoasis-tracking-renewal-ae0e3a...HEAD`. Fix every CRITICAL and HIGH finding; if code changed, re-run G2–G6.
- [ ] **G10. Verification.** Invoke `superpowers:verification-before-completion`; paste each command and its result line into the stage summary.
- [ ] **G11. Commit.** `git status` shows only this stage's files (see the roadmap File Map). Commit any remainder with a conventional message and no attribution trailer.
- [ ] **G12. No deploy.** Do not push to `main`; do not run `vercel deploy`. Push `renewal/s11-r5-measurement-ops` only if the operator asked. Hand the stage summary to the operator; merge into the integration branch only after acceptance (roadmap §5).

**S11 notes on the gate**
- Run the gate after Part A (R0 week) and again after Parts B–D. For Part A, G2–G6 only confirm that a documents-only change left everything green.
- G4 (Parts B–D): the route table also lists `ƒ /api/csp-report`; `○ /` with `Revalidate 5m` stays (the statistics gate is a client component and reads no request data).
- G6: `tests/e2e/analytics-privacy.spec.ts` (with approval 13) and `tests/e2e/csp-report.spec.ts` must pass in production mode; they are the S11 budgets of roadmap §9.
- G7: the output path above is the roadmap §7 text with S01's Addition 1 applied (Additions item 10). Check: `(Get-ChildItem test-artifacts/stage-screens/S11-after -Filter *.png).Count` equals `(Get-ChildItem test-artifacts/stage-screens/S11-before -Filter *.png).Count`. Expected differences from `S11-before/`: none, except the policy text on the privacy screens when Task C6 ran.
- G8 also lists S07's `'/{번호}' through the result` and `result chunk` lines (Task C4 Step 11): with approval 13 they include the lazy statistics chunk; a fail there stops the gate and goes to the operator, never a looser budget.
- G8: paste (1) the pass lines of `analytics-privacy.spec.ts` ("analytics requests carry 0 tracking-like values"; or "Part C SKIPPED — approval 13 `pending`", respectively `rejected`), (2) the pass lines of `csp-report.spec.ts` unit and E2E ("CSP report endpoint stores and logs no number"), (3) the JS budget lines before (Task 0 Step 6) and after (G6) with the `/` initial delta.
- G11: the files S11 may leave changed are the ones in "File Structure"; nothing under `lib/services/`, `lib/schemas.ts`, `lib/types.ts`, `proxy.ts` or `app/api/track/route.ts`.
- Stage summary additions: approvals 13/15/16 statuses and which of C1–C6, D2A, D3A ran; the Part C skip note if any; the contract deviations of "Additions to the contract"; the operator's R5 list from Task D4 Step 6; "privacy text needs legal check" (Task C6).

---

## Open issues for the operator and later stages

1. **Vercel plan and switches (approval 13).** Custom events and their property count depend on the Vercel plan; the payload uses at most two properties per event. The operator switches Web Analytics and Speed Insights on in the project before the R5 deploy; without that, production requests to `/_vercel/insights/script.js` return 404 and nothing is collected (the page is unaffected).
2. **Referrer origins.** The vendor script sends other-site referrers outside `beforeSend`'s reach. S11 keeps statistics off when a referrer carries more than a bare origin; bare origins (a site name, never a customer value) can reach Vercel. If the operator wants no referrer at all, the only lever is overriding `document.referrer` before the scripts load, which would also change what AdSense receives — a separate decision.
3. **Test doubles mirror the vendor protocol as read on 2026-09-26** (script 0.1.3: `window.vaq`/`window.siq` queues, `beforeSend` on `{ type, url }`, payload keys `o`, `dp`, `r`, `en`, `ed`, `ts`). If Vercel changes its script, the E2E doubles would no longer match it; S11's guarantees (gate, templated route/path, `beforeSend`, enum properties) do not depend on the script, but the operator's day-one check in `kpi-dashboard.md` ("pages appear only as templates") is the production confirmation.
4. **`helpful` has no screen.** The contract event exists and is validated, but the spec gives no copy for a "도움이 됐나요?" control and no stage renders one; it stays unused until the operator asks for it.
5. **CSP report volume.** Once S08's pre-paint hash is in the Report-Only `script-src`, CSP3 browsers ignore `'unsafe-inline'` there and report Next.js inline scripts on every `/` and `/privacy` view: one POST (function invocation) per violation. Log lines stay bounded; the invocation count is what WAF rule 2 limits. If the count matters, the Report-Only policy can drop the hash (S08) or the operator can skip rule 2's Log phase.
6. **Policy text.** The statistics sentences (Task C6) and the new 시행일 need the operator's legal check, like S02's text (spec §16 item 6).
7. **S08 shapes.** S11 now follows S08's plan as written: `buildSecurityHeaders({ extraScriptHashes: [PREPAINT_CSP_SOURCE] })` in `next.config.ts` and in S01's config test (Task B2 adds `reportUri` beside it), `StylePicker` radios whose `value` is the `StyleId` (the observer's fallback to `html[data-style]` stays as a guard), and the style-independence scan whose `ALLOWED` set gains `lib/analytics/dom-observer.ts` (Task C5 Step 7, S08 open issue 13). Task 0 Step 9 stops the stage if any of these anchors moved.
8. **JS budget measurement.** S07's `tests/budgets/js-budget.spec.ts` counts every script a deep link loads until the settled result (195 KB) and the scripts that arrive after `networkidle` on `/` (result chunk, 30 KB); the lazy statistics chunk is inside the first and normally outside the second. Task C4 Step 11 records both and stops rather than loosening a budget.
9. **Report bodies in S02's privacy checks.** `captureThirdParty` records `/api/csp-report` and `assertNoTrackingValues` checks its bodies. From Part B on, `/` and `/privacy` documents post reports whose bodies hold the page address (no number), the policy text and, in development, React's chunk file names (`eval` violations). A chunk name whose hash happened to contain a 10-digit decimal run would be flagged; if that ever happens, the fix belongs in S02's support module (exempt `/api/csp-report` bodies, which the server summarizes anyway), not in the policy.
10. **KPI 4 scope.** "Same-tab re-lookups within 10 minutes" is measured per document (in memory, no storage); a reload shows up as `entry: "restore"`, which the KPI adds separately.

---

## Self-Review

- **Spec coverage.** §11 1단계 (routes, status codes, ≥ 2 weeks, 30 % rule, manual 톡톡 sheet with the six categories and "조회 화면을 보고도 문의했는지", AdSense backup before B, store placements) → Task A1. §11 3단계 (cookieless Web Analytics + Speed Insights, load after the scrub, `beforeSend` path template, query/hash/referrer, the seven events, no replay/heatmap/input capture) → Tasks C1–C5 (referrer: Additions item 7). §11 KPI 1–7 and the 15 % RPM rule (§17 Q5) → Task D1. §11 안전장치 (third-party and first-party analytics requests carry no number) → Task C4/C5 `assertInsightsClean`. §12 Report-Only observation → Tasks B1–B2; strict nonce CSP decision (§16 item 16) → Tasks D3/D3A. §16 item 13 → Part C gating and fallback; item 15 → Tasks D2/D2A with the different-week rule; §10 WAF → Task D4. §13 "정리 기준" (style_select) → Tasks C2/C5 and D1. §15 R0-week baseline and R5 → Execution Order. Privacy policy update → Task C6.
- **Placeholder scan.** Every code step has complete code. Task C6 Step 5 shows example dates (`2027년 1월 4일` for the Step 4 date, `2026년 10월 2일` for S02's R1 date) with the exact rule for reading the real values, as S02 Task 10 does; Task B2 Steps 6–7 edit S08's concrete `buildSecurityHeaders({ extraScriptHashes: [PREPAINT_CSP_SOURCE] })` call. The documents' empty table rows are forms for the operator.
- **Cross-stage review (phase 4, 2026-09-27).** Inbound names re-checked against the producer plans as they stand: S01 (`buildSecurityHeaders`, `NUMBER_ROUTE_SOURCE`, the `NOINDEX` number-route line, `containsTrackingLikeValue`, `FAKE`/`FAKE_GROUPED` members, `mockTrack`, `trackData`, `"upstreamTimeout504"`, `INTERNAL_TEST_CREDENTIALS`), S02 (`isNumberPath`, `ScrubStatus`, `AdSignals`, `getAdSignals`, `subscribeAdSignals`, `captureThirdParty`, `assertNoTrackingValues`, `waitForIdle`, the policy constants and section lines), S03 (`GUIDE_KEYS` and the six unions, member for member), S04 (`useLookup`'s `apply({ type: "submit", request, at: startedAt });` and its `LiveAnnouncer` import), S05 (`isStyleId`, `STYLE_IDS`, the two `data-notice-kind={notice.kind}` lines, `data-notice-variant`, `/internal/ui-kit` demo notice ids), S06 (`data-view-state`, header `TalkLink` '문의', `ShortcutRow` placements), S07 (`data-result-view`, `details[data-history]`, `data-failure-cause` on the `FailureCard` root beside `data-guide-key`, the three `js-budget` tests), S08 (`PREPAINT_CSP_SOURCE` in `next.config.ts` and S01's config test, `StylePicker` radio values, the public layout with `<AdLoader />`, the `prepaint.spec.ts` `ALLOWED` set), S10 (`track_lookup` fields and `ElapsedBucket` members). Fixes applied: the S08 call shape in B2, the `ALLOWED` entry (C5 Step 7), the shared "shortcut" placement and S08's placement-less recommendation links in `classifyLinkClick`, the stage-screen path, the S08 Part B merge in Task 0, KPI 5's server-side fallback bucket.
- **Type consistency.** `templatePath`, `AnalyticsEvent` (plus `repeat`, `overdue`, `storeLink`), `analyticsGate`, `reportLookupStart`, `peekPendingLookupStart`/`consumePendingLookupStart`, `connectAnalyticsSink`/`disconnectAnalytics`, `installAnalyticsObserver`, `startAnalyticsRuntime`, `CSP_REPORT_PATH`, `handleCspReport` keep one spelling across Tasks B1–C6; S01/S02/S03/S05 names (`buildSecurityHeaders`, `NUMBER_ROUTE_SOURCE`, `isNumberPath`, `ScrubStatus`, `getAdSignals`, `subscribeAdSignals`, `captureThirdParty`, `assertNoTrackingValues`, `waitForIdle`, `GUIDE_KEYS`, `isStyleId`) are imported as their plans export them. Test counts: `csp-report.spec.ts` 8 → 11; `analytics-events.spec.ts` 9 → 15 → 19; `analytics-privacy.spec.ts` 5 → 8 → 9; `ops-docs.spec.ts` 1 → 2 → 3 → 4 → 5.
- **Verification during authoring.** The pure modules, the CSP module and route, the header override, the edited S01 config test, the unit tests, the doubles and the E2E specs were written into a scratch copy with the S01/S02 code from their plans and the published `@vercel/*` typings: `tsc --noEmit` and the repo's ESLint config (including the React Compiler rules) were clean, 42 unit tests passed (`analytics-events` 19, `csp-report` 11, `security-headers` 7, `ops-docs` 5), and the two ledger-dependent document tests were run with rows 15/16 both `pending` and `approved`. The E2E specs were type-checked but not run (they need the S06–S08 pages).
- **Review Focus.** Five lines, each with its test in Tasks B1, B2, C1, C2, C3, C4 or C5.
