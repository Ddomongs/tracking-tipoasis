# R2 State Core (pure modules and config) — Stage S03 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the renewal one validated operator config (`config/site.config.ts`) and one set of pure, time-zone-proof functions (`lib/tracking/*`, `lib/cs/*`) that turn a lookup outcome into every customer and CS sentence, so that the 12 GAP3-06 state variants show 0 contradictions and every later stage only renders view models.

**Architecture:** `config/site.config.ts` holds operator data as typed named exports (type-only imports, so client code can import one section). `lib/config/schema.ts` (+ private `lib/config/invariants.ts`) validates it with zod and Korean messages; `lib/config/server.ts` parses it once and `app/layout.tsx` calls it so `next build` fails on bad config. `lib/tracking/*` are pure functions of `(input, now, config)`: KST arithmetic without `Intl`, business days with holidays, notices, failure classification, the loading view and `deriveTrackingView` (split into private `lib/tracking/derive/*.ts` helpers). `lib/cs/*` builds internal CS replies from the same view model. No UI changes in this stage.

**Tech Stack:** Next.js 16.3.6 App Router, React 19.3, TypeScript strict, zod 3.25 (server/internal only), Playwright 1.55 as the only runner (every S03 test is a `tests/unit/*.spec.ts` Playwright test without `page`).

**Spec:** `docs/superpowers/specs/2026-09-26-tracking-renewal-ia-design.md` — §5 (loading and failure), §6–§7 (result area and the per-state table), §8 (placement rules), §9 (config, notices, holidays), §10 (CS reply), §14 (pure modules, test contract), §16 items 4, 8, 9, §17 Q1/Q3 (defaults). **Roadmap and shared contract:** `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §11 (every name, path, type, hook and fixture below is used exactly as written there; additions are listed in "Additions to the contract"). **Phase 1 evidence:** GAP3-06 in `C:/Users/sos84/AppData/Local/Temp/claude/C--Users-sos84-OneDrive-------------04------01------------05----------------claude-worktrees-tipoasis-tracking-renewal-ae0e3a/3566a5b8-54f5-4bd4-bd54-e5e56b713935/scratchpad/phase1/results-run2/gaps.json` (12 variants, 8 contradictions) and `…/phase1/gap-GAP3/m-states.cjs` (the variant generator).

**Depends on:** S01 (R0 urgent fixes — `tests/fixtures/tracking-fixtures.ts`, `lib/site.ts`, `lib/privacy/number-patterns.ts`, the real-number guard, the `(public)`/`(internal)` route groups, `app/layout.tsx` without AdSense).
**Gated by:** approval 4 (Task 15: `durations.pendingRecheck`, `channels.*.urls.pending`), approval 8 (Task 17: holiday date shift, a contract amendment), approval 9 (Task 16: `disclosures.coupang` wording).
**Release / order:** R2 (with S04), prerequisite stage. Branch `renewal/s03-r2-state-core`.

---

## Global Constraints

Copied verbatim from the roadmap; stage-specific lines follow.

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

**Stage-specific (S03)**
- S03 ships no UI. The only runtime changes outside new modules are: `app/layout.tsx` calls `getSiteConfig()` (build-time validation) and `lib/storefront.ts` re-exports the same three URLs from `config/site.config.ts`. Screens are identical before and after the stage.
- No existing E2E assertion changes in S03, so there is no rule → assertion migration here. The legacy components keep their hard-coded copy until S04/S06/S07 replace them; S03's config values do not reach the current screens.
- Every S03 test is a Playwright unit test in `tests/unit/` and runs without a web server: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/<file>; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`.
- Tests take numbers only from `tests/fixtures/tracking-fixtures.ts` (`FAKE`, `FAKE_GROUPED`) and never write a digit run of 10+ digits that does not start with `0000`. Expected `tel:` values are built from `FAKE.phone`.
- Tests that depend on lookup timing or the NOT_FOUND caveat set those values explicitly (`withConfig({ lookup: … })` or a local `LoadingConfig`), so S10 Part B can flip `lookup.timeoutMs`, `lookup.notFoundServiceCaveat` and `lookup.stageMs` without editing S03 tests; `tests/unit/config.spec.ts` accepts both the pre-R4 and the R4 values.
- `config/site.config.ts` has only `import type` statements (client code imports single named exports). `lib/tracking/*` obeys contract §11.1 rule 5 (time only from `now: Date`). Neither may import zod; `tests/unit/module-boundaries.spec.ts` (Task 14) enforces it.
- Customer copy the spec gives is used verbatim. Copy the spec does not give lives in `config/site.config.ts` (`stateGuide`, `resultCopy`, `help`) so the operator and later stages change it in one place. Two exceptions, both internal protocol or internal-only text: the inquiry-copy format in `lib/tracking/inquiry-copy.ts` (the CS tool parses it) and the CS reply templates in `lib/cs/cs-templates.ts`.
- Holiday data for 2026–2027 was checked on 2026-09-26 against the 2027 월력요항 (published 2026-06-29) and the 2026 law changes (노동절 from 2026-05-01, 제헌절 from 2026-05-11); Task 5 Step 3 repeats that check against the official source before committing.
- Stage screenshots go to `test-artifacts/stage-screens/S03-before/` and `test-artifacts/stage-screens/S03-after/` (S01 "Additions to the contract" item 1: Playwright empties `test-results/` at the start of every run, so before-screens written there would be deleted by Task 0 Step 6). Task 0 Step 5 and gate G7 below already use that path.
- S10 Part B (its Task B1 Step 5) greps `tests/` for `timeoutMs|45000|notFoundServiceCaveat|조회 서비스 사정으로|stageMs`. In S03's files it finds `tests/unit/config.spec.ts` (accepts the pre-R4 and the R4 set; S10 edits this file) and explicit-value fixtures in `tests/unit/derive-view.spec.ts` (`withConfig({ lookup: { notFoundServiceCaveat: true } })` / `false`, the caveat sentence asserted only under the `true` fixture) and `tests/unit/loading-view.spec.ts` (the local `LOADING` config and the `withConfig({ lookup: { stageMs: [3000, 7000], timeoutMs: 25000, … } })` row). None of them reads the shipped `lookup` values, so they stay green after the flip and are not literals that block it.
- The approval-2 and approval-3 fallbacks are view-layer transforms owned by S04 (`components/status-slot/status-view.ts`: `LEGACY_RESULT_COPY`, `applyApprovalFallbacks`) and S07 (`components/result/approvals.ts`: `applyResultApprovals`, `deriveResultView`). S03 ships the spec §7 copy and the §7 error-row actions in `config/site.config.ts`; no fallback edits that file, and the `derive-view`, `config` and `cs-reply` specs pin the shipped values.

## Review Focus

Conditions the spec implies but no rule names; the pinning test is added to the owning task.

1. **Customer device not in KST** (overseas buyer with `TZ=America/New_York`, or a phone clock hours off): ETA labels, D-n, worry dates, overdue and notice windows come from the `now` argument in `Asia/Seoul`; overdue flips exactly at KST midnight after the worry date. Owner: Task 2 (`kst-time.spec.ts` "same answers in America/New_York") and Task 9/10 (`derive-view.spec.ts` "…in America/New_York" rows and the 23:59:59 / 00:00:00 boundary rows).
2. **Carrier data with broken or unordered event times** (an empty `datetime`, a non-date string, events not sorted by time, a missing `location`): history, last event, worry dates and stale checks skip unparsable events and sort the rest; no view string ever contains `Invalid Date`, `NaN` or `undefined`. Owner: Task 10 ("broken event times never leak into the view").
3. **Operator config typos** (a notice whose `endsAt` precedes `startsAt`, an `http://` or foreign-host link, a pasted real waybill in a notice, a token the renderer does not know, `staleDays` changed to 15): the build fails with one Korean line per problem that names the exact path. Owner: Task 6 (`config.spec.ts` rows "notice limits, windows and ids", "links must be https on an allowed host", "copy with a real-looking number, an HBL token or AI wording fails", "stateGuide copy uses only the five tokens; other copy uses none or its fixed slots", "staleDays must equal the server's 14") and Task 7 (`config.spec.ts` "parseSiteConfig throws with one Korean line per problem" plus Step 7, which proves that `next build` stops on a broken `config/site.config.ts`).
4. **Holiday data running out** (a December build without next year's 월력요항): business days silently lose holidays, so the build must warn with the missing year and the first affected date. Owner: Task 7 (`holidayCoverageWarnings` rows for a covered window, a window crossing into 2028, and an empty holiday list).
5. **A customer pastes an edited inquiry message into 톡톡** (chat text around it, line breaks, full-width digits, the number followed by other words without the ' / ' separator): the CS side extracts the number only when the segment after '조회번호' is a clean identifier and otherwise returns `null` — never a wrong number. Owner: Task 8 (`inquiry-copy.spec.ts` paste rows).

## Additions to the contract

Everything below is additive; no §11 name is renamed or retyped. Each item goes into the stage summary as a contract deviation so the roadmap can be amended (§5 "Contract changes").

1. **New module `lib/tracking/carriers.ts` (S03, pure, client-safe)** — carrier names and official tracking URLs without importing `lib/delivery-carriers.ts` (which imports zod and must not reach the initial bundle through `deriveLoadingView`): `export const CONCRETE_CARRIER_CODES: readonly ConcreteCarrierCode[]` (`["CJ","EPOST","HANJIN","LOTTE","LOGEN"]`), `export const CARRIER_NAMES: Readonly<Record<ConcreteCarrierCode, string>>`, `export function isConcreteCarrier(code: DeliveryCarrierCode): code is ConcreteCarrierCode`, `export function carrierOfficialUrl(code: DeliveryCarrierCode, invoiceNumber: string): string | null`, `export function carrierDisplayName(rawName: string | null | undefined, code: DeliveryCarrierCode): string | null` (never returns the internal '택배사 자동 확인'), `export function requestCarrierView(request: LookupRequest, unknownLabel: string): CarrierView`. Parity with `lib/delivery-carriers.ts` is tested in the new `tests/unit/carriers.spec.ts`. S06 should take carrier option names from here, not from `lib/delivery-carriers.ts`.
2. **`SiteConfig.resultCopy: ResultCopyConfig`** (type in `lib/config/types.ts`, named export `resultCopy` in `config/site.config.ts`) — the stage-authored result copy the spec does not give per state: ETA labels ('도착 예상', '오늘 예상', '예상했던 날짜', '배송 완료일'), ETA texts, captions, carrier bar labels, issue labels ('멈춤' '끊김' '갈림'), station names, history summary templates, action labels ('번호 수정', '다시 조회', '{carrier} 공식 배송조회', '{carrier}에서 실시간 위치 보기', '기사님께 전화', '다시 볼 링크 복사', '받지 못하셨나요?'), the pending store intro, the NOT_FOUND caveat line, the carrier-cut line, the 429 reason, the overdue sentence and chip, the customs-check note, the choose-carrier sentence. Each field has a fixed slot list (`{date}`, `{n}`, `{time}`, `{seconds}`, `{carrier}`) checked by the schema. The slot table `RESULT_COPY_SLOTS` (in `lib/config/invariants.ts`) is exported and is the single list of `resultCopy` keys: `ResultCopySchema` derives its keys from it. Later stages extend `ResultCopyConfig` by editing three places together — the interface in `lib/config/types.ts`, the `RESULT_COPY_SLOTS` entry, and the `resultCopy` value in `config/site.config.ts` — so no S03 test changes: S07 (its addition 6: `returnLinkCopied`, `returnLinkShared`, `returnLinkFallback`, `inquiryCopied`) and S08 (its addition 3: `recommendationsOpen`, `recommendationsClose`, `recommendationPriceChecked` with `{date}`, `showcaseTitle`, `footerNote`, `adSlotLabel`). S06 (its addition 3) adds `LookupConfig.copy.noscriptNotice` the same way through the type, the `LookupSchema` copy object in `lib/config/schema.ts` and the value (S03 keeps no slot table for `lookup.copy`; only `lookup.copy.elapsed` has a fixed `{seconds}` slot). File Map rows needed: `lib/config/types.ts` C S03, M S06, M S07, M S08; `lib/config/schema.ts` C S03, M S06; `lib/config/invariants.ts` C S03, M S07, M S08; `config/site.config.ts` C S03, M S06, M S07, M S08 (+ approval-10 `featuredProducts` values), M S10; `tests/unit/config.spec.ts` C S03, M S06, M S10.
3. **`LookupConfig.copy` gains `carrierAuto: string`** ('택배사 자동 확인', the loading-only number-bar suffix) **and `typicalSummary: string`** ('보통 이렇게 걸려요', the summary of the typical-durations details that S06/S07 render from `durations.typical`).
4. **`EtaView` `holidayAffected` gains `readonly holidayName: string`** (e.g. '추석 연휴'), so the CS reply can say '추석 연휴 영향으로 1~2일 늦어질 수 있습니다' without parsing the badge.
5. **`EtaView` `today` uses `label: '오늘 예상'`** (answers S05 addition 9); `date` keeps the real date and `caption` stays the secondary line. When the estimate lies before today's KST date, `today` shows today's date.
6. **`lib/tracking/template.ts` adds `export function fillSlots(template: string, values: Readonly<Record<string, string | undefined>>): string`** for non-stateGuide templates (`{seconds}`, `{n}`, `{time}`, `{date}`); `fillCopy` delegates to it.
7. **`lib/tracking/loading-view.ts` adds `export function nextLoadingChangeMs(elapsedMs: number, config: LoadingConfig): number`** — the next elapsed time at which `deriveLoadingView` returns a different model (skeleton delay, stage bounds, spinner stop, then every `elapsedStepSeconds` after the very-long stage starts). S04's `useLookup` can schedule one timer with it. The elapsed text shows `veryLongStart + k × step` seconds (8, 13, 18 … with the defaults).
8. **Worry-date bases, clarified** (contract §11.6 "Worry dates"): `customsArrived`/`customsWaiting` base = the earlier of the KST date of `estimatedCustomsClearanceDate` and (last customs event date + `stages.customs.max` days); `customsCleared`/`handedToCarrier`/`pickedUp` base = the later of the code-4 event date and the last delivery event date (fallbacks `estimatedCustomsClearanceDate`, then the last customs event); `inTransit` base = the earlier of the KST date of `estimatedDeliveryDate` and (last delivery event date + `stages.domestic.max` days). Reason: the normalizer moves past estimates to "today", so the contract's literal bases would move the worry date every day and overdue would never trigger; a pickup after a long customs wait would be overdue on arrival. With un-moved estimates the results equal the contract's (spec example 통관 완료 9/23 → 9/29 holds).
9. **`guideKeyForData` also detects stale from `now`** (last valid event older than `durations.staleDays`, code ≠ 7), matching the server rule, so a result cached across days still switches to `stale`.
10. **Error rows' `GuideRow.primaryAction` decides the recovery action** (`fixNumber` for invalidNumber/notFound, `retry` for temporaryDelay/offline/noResponse as in the spec §7 rows, `copyAndTalk` for serverError). The 톡톡 action is always the first link of the error CTA block. For `noResponse` the other recovery action is the secondary (`retry` row → [번호 수정] secondary; a `fixNumber` row → [다시 조회] secondary), so changing that one row is enough if the approval-3 decision names [번호 수정] for 응답 없음 (spec §16 item 3; Open Issue 6). A `copyAndTalk` row makes 톡톡 the filled primary and the recovery action a secondary (tested in Task 11). **The approval-3 fallback while approval 3 is pending is not a config edit:** S04 (`applyApprovalFallbacks` in `components/status-slot/status-view.ts`) and S07 (`applyResultApprovals` in `components/result/approvals.ts`) promote 톡톡 to the filled primary in the view layer, because a `copyAndTalk` row would replace the E2E-locked '톡톡으로 문의하기' error link with '문의 내용 복사하고 톡톡 열기' while approval 2 is pending, and S03's specs pin the shipped rows. `config/site.config.ts` keeps the rows above.
11. **`lib/config/server.ts` adds `export function parseSiteConfig(value: unknown): SiteConfig`** (throws `Error` with `formatConfigIssues` lines; used by `getSiteConfig` and tests) and **`export const HOLIDAY_WINDOW_DAYS = 60`**. `getSiteConfig()` itself logs `holidayCoverageWarnings(config, new Date())` with `console.warn` once, on its first parse; `app/layout.tsx` only calls `getSiteConfig()`.
12. **`formatConfigIssues` translates zod's built-in issue codes into Korean** (`invalid_type`, `invalid_enum_value`, `invalid_literal`, `unrecognized_keys`, `too_small`, `too_big`, `invalid_string`); the path of the whole object prints as `(설정 전체)`.
13. **Config invariants beyond §11 "Config"** (all Korean, all in `lib/config/invariants.ts`): day counts in `stateGuide.notFound.worry` / `stateGuide.pending.worry` / `stateGuide.notFound.reason` must match `durations.worry.notFoundDays` / `pendingDays` / `stages.visibleAfterDeparture`; `overdueTitle` non-null exactly for `OVERDUE_CAPABLE_KEYS` whose `worry` contains `{worryDate}`; `docTitle` has no digits or tokens; tone `problem` only on error keys; customsArrived/customsWaiting/customsCleared have `primaryAction: "none"`; `loading` has no stores/recommendations/ads; stale/pending/delivered have ETA modes withheld/pendingInfo/deliveredOn; `lookup` timings increase; notices/featured/help/holiday ids unique; `help[].openIn ⊆ showIn`; a price needs `priceCheckedAt`; non-stateGuide copy has no `{…}` tokens except the fixed slots.
14. **Private files (File Map additions, S03-owned, not imported by other stages):** `lib/config/invariants.ts` (superRefine rules; the one exception is the exported `RESULT_COPY_SLOTS`, which S07 and S08 extend and import in their tests — addition 2), `lib/tracking/derive/{events,keys,worry,spine,eta,carrier-view,actions,history,next-action,success-view,failure-view,shared}.ts`. **Test files:** `tests/unit/carriers.spec.ts`, and the fixture module `tests/fixtures/derive-scenarios.ts` (explicit `normalizeTrackingData` inputs for the per-state rows; S04/S07/S09 may import it for their own tests).
15. **`lib/cs/cs-templates.ts` adds `export const CS_PHRASES`** (the ETA, worry, overdue, notice, last-event and link sentences shared by all states).

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `lib/tracking/types.ts` | Create | All cross-stage domain types and key lists (§11.6, + `holidayName`) |
| `lib/config/types.ts` | Create | Config types (§11.7, + `ResultCopyConfig`, `carrierAuto`, `typicalSummary`) |
| `lib/tracking/classify-failure.ts` | Create | `FailureInput` → `FailureCause` → error `GuideKey` |
| `lib/tracking/time.ts` | Create | KST keys and formats by UTC+9 arithmetic, business days, holiday overlap |
| `lib/tracking/number-format.ts` | Create | 4-character grouping |
| `lib/tracking/template.ts` | Create | Token list, `tokensIn`, `fillCopy`, `fillSlots` |
| `lib/tracking/glossary.ts` | Create | Customs/carrier term → customer label |
| `lib/tracking/carriers.ts` | Create | Carrier names, official URLs, display names, request carrier view |
| `lib/tracking/notices.ts` | Create | Active notices per slot, priority, view |
| `config/site.config.ts` | Create | Operator data with Korean comments (13 named exports + `siteConfig`) |
| `lib/config/schema.ts` | Create | zod object schema, `SiteConfigSchema`, `formatConfigIssues` |
| `lib/config/invariants.ts` | Create | `checkInvariants` (superRefine), slot table |
| `lib/config/server.ts` | Create | `parseSiteConfig`, memoized `getSiteConfig`, `holidayCoverageWarnings` |
| `app/layout.tsx` | Modify | Call `getSiteConfig()` in `RootLayout` |
| `lib/storefront.ts` | Modify (lines 1–3) | Re-export the three URLs from `channels` |
| `DEPLOYMENT.md` | Modify (append) | Section '운영 설정 바꾸기' |
| `lib/tracking/inquiry-copy.ts` | Create | Inquiry copy build/parse (CS protocol) |
| `lib/tracking/derive/events.ts` | Create | Valid, sorted events; latest-event helpers |
| `lib/tracking/derive/keys.ts` | Create | `DataGuideKey`, code → key, stale check, CTA state |
| `lib/tracking/derive/worry.ts` | Create | Worry-date bases, `isOverdue` |
| `lib/tracking/derive/spine.ts` | Create | `SpineView` |
| `lib/tracking/derive/eta.ts` | Create | `EtaView`, captions |
| `lib/tracking/derive/carrier-view.ts` | Create | `CarrierView` for results |
| `lib/tracking/derive/actions.ts` | Create | `ActionView` builders |
| `lib/tracking/derive/history.ts` | Create | Last event, history, segments |
| `lib/tracking/derive/shared.ts` | Create | Number view, notice, help, revenue, live message |
| `lib/tracking/derive/next-action.ts` | Create | `NextActionView` for data states |
| `lib/tracking/derive/success-view.ts` | Create | Result view model |
| `lib/tracking/derive/failure-view.ts` | Create | Error view model |
| `lib/tracking/derive-view.ts` | Create | Contract exports (`deriveTrackingView`, `guideKeyForData`, `worryDateKey`, `isOverdue`) |
| `lib/tracking/loading-view.ts` | Create | `deriveLoadingView`, `loadingStageAt`, `nextLoadingChangeMs` |
| `lib/cs/cs-templates.ts` | Create | Internal CS templates per `GuideKey`, shared phrases |
| `lib/cs/cs-reply.ts` | Create | `buildCsReply` |
| `tests/fixtures/config-fixtures.ts` | Create | `FIXTURE_CONFIG`, `withConfig`, `DeepPartialConfig`, fixture notices/holidays/featured |
| `tests/fixtures/derive-scenarios.ts` | Create | Per-state `TrackResponseData` builders and outcome helpers |
| `tests/unit/classify-failure.spec.ts`, `kst-time.spec.ts`, `number-format.spec.ts`, `template.spec.ts`, `glossary.spec.ts`, `carriers.spec.ts`, `notices.spec.ts`, `config.spec.ts`, `inquiry-copy.spec.ts`, `derive-view.spec.ts`, `loading-view.spec.ts`, `cs-reply.spec.ts`, `module-boundaries.spec.ts` | Create | Unit tests (Playwright, no page) |

Execution order: Task 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → gated Tasks 15–17 (each checks the ledger first) → Task Final.

---

### Task 0: Stage start

- [ ] **Step 1: Read approvals.** Open `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §4. For every approval number in this plan's "Gated by" list, write its Status into the stage summary. `pending`/`rejected` → execute the fallback steps and mark the gated task SKIPPED with the reason.
- [ ] **Step 2: Confirm dependencies.** Run (PowerShell): `git log --oneline claude/tipoasis-tracking-renewal-ae0e3a -40`
  Expected: a `merge: SNN …` commit for every stage in this plan's "Depends on" list.
- [ ] **Step 3: Branch.** Run: `git switch -c renewal/s03-r2-state-core claude/tipoasis-tracking-renewal-ae0e3a`
  Expected: `Switched to a new branch 'renewal/s03-r2-state-core'`.
- [ ] **Step 4: Port free.** Run: `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue`
  Expected: no output. Otherwise stop the listener: `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`
- [ ] **Step 5: Baseline build and before-screens.** Run `npm ci` only if `package-lock.json` changed since the last install in this worktree, then `npm run build`.
  Expected: build exits 0. Start the production server in a background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`
  Wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200`.
  Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='before'; $env:PW_STAGE='S03'; npx playwright test tests/tools/stage-screens.spec.ts`
  Expected: PNGs in `test-artifacts/stage-screens/S03-before/` for widths 320, 375, 768, 1024, 1440. (S01 creates the tool first; S01 runs this step after its Task 1.)
- [ ] **Step 6: Baseline suite.** With the server still running: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test`
  Expected: record "N passed / M skipped / 0 failed" in the stage summary. Then stop the server (Step 4 command) and clear the flags: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.
- [ ] **Step 7 (stage-specific): S01 artifacts this stage imports exist.** Run:
  `Test-Path lib/site.ts, lib/privacy/number-patterns.ts, tests/fixtures/tracking-fixtures.ts, tests/support/prod-mode.ts, "app/(internal)/layout.tsx"`
  Expected: five lines `True`. Then run: `Select-String -Path lib/site.ts, lib/privacy/number-patterns.ts, tests/fixtures/tracking-fixtures.ts -Pattern 'export (const|function|async function|type) (SITE_ORIGIN|buildReturnLink|DIGIT_RUN_PATTERN|HBL_LIKE_PATTERN|FIXTURE_NOW|FAKE|FAKE_GROUPED|GAP3_06_VARIANTS|trackData)\b' | Measure-Object | Select-Object -ExpandProperty Count`
  Expected: `9`. If the count is lower, open the three files: names exported through an `export { … }` list are fine; a name that is missing or spelled differently means S01 is not merged as the contract describes (§11.3, §11.4, §11.10) — stop.
- [ ] **Step 8 (stage-specific): Nothing of S03 exists yet (no parallel or hotfix work to reconcile).** Run: `Test-Path config/site.config.ts, lib/config, lib/tracking, lib/cs/cs-reply.ts; git log --oneline --all -- config/site.config.ts lib/tracking | Select-Object -First 5`
  Expected: four lines `False` and no log lines. If any file or commit exists (e.g. a hotfix branch already added part of this stage), stop and compare it with this plan task by task; skip only the steps whose files already match this plan exactly and record the skipped steps in the stage summary.
- [ ] **Step 9 (stage-specific): `app/layout.tsx` is the S01 version.** Run: `Select-String -Path app/layout.tsx -Pattern 'adsbygoogle|Space_Grotesk|export default function RootLayout'`
  Expected: exactly one match, the `RootLayout` line (S01 removed AdSense and Space Grotesk). Task 7 inserts one import and one call into this file.

---

### Task 1: Domain types, config types and failure classification

**Files:**
- Create: `lib/tracking/types.ts`
- Create: `lib/config/types.ts`
- Create: `lib/tracking/classify-failure.ts`
- Test: `tests/unit/classify-failure.spec.ts`

**Interfaces:**
- Consumes: `ApiError`, `DeliveryCarrierCode`, `TrackResponseData` from `@/lib/types` (frozen).
- Produces: every type and key list of contract §11.6 (`GUIDE_KEYS`, `GuideKey`, `ERROR_GUIDE_KEYS`, `PROBLEM_GUIDE_KEYS`, `OVERDUE_CAPABLE_KEYS`, `Tone`, `StatusTone`, `InquiryLevel`, `RevenueTier`, `StorePlacement`, `StorePlacementId`, `TalkPlacement`, `RecommendationPlacement`, `RecommendationContext`, `EtaMode`, `PrimaryActionKind`, `CtaState`, `StationId`, `SpineIssue`, `ViewMode`, `LookupEntry`, `ConcreteCarrierCode`, `ApiErrorCode`, `InvalidReason`, `NoticeKind`, `FailureCause`, `FailureInput`, `LookupRequest`, `LookupOutcome`, `TrackingEntry`, `NumberView`, `CarrierView`, `SpineView`, `EtaDate`, `EtaView` (+ `holidayName`), `EtaKind`, `ActionKind`, `ActionWeight`, `ActionView`, `WorryLineView`, `StoreLinkView`, `StoreLinksView`, `CarrierChoiceView`, `NextActionView`, `NoticeView`, `LastEventView`, `HistoryEventView`, `HistorySegmentView`, `HistoryView`, `HelpItemView`, `RetryView`, `RevenueView`, `TrackingViewModel`, `LoadingStage`, `LoadingViewModel`, `ResultAction`); every config type of §11.7 plus `ResultCopyConfig`; `classifyFailure(input: FailureInput): FailureCause`, `guideKeyForFailure(cause: FailureCause): GuideKey`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/classify-failure.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { classifyFailure, guideKeyForFailure } from "@/lib/tracking/classify-failure";
import { ERROR_GUIDE_KEYS, GUIDE_KEYS, OVERDUE_CAPABLE_KEYS, PROBLEM_GUIDE_KEYS } from "@/lib/tracking/types";
import type { FailureCause, FailureInput, GuideKey } from "@/lib/tracking/types";

test.describe("guide key lists", () => {
  test("there are 19 unique guide keys", () => {
    expect(GUIDE_KEYS).toHaveLength(19);
    expect(new Set(GUIDE_KEYS).size).toBe(19);
  });

  test("problem keys are the error keys plus the three data problems", () => {
    const all = new Set<GuideKey>(GUIDE_KEYS);
    expect(ERROR_GUIDE_KEYS.every((key) => all.has(key))).toBe(true);
    expect([...PROBLEM_GUIDE_KEYS]).toEqual([...ERROR_GUIDE_KEYS, "stale", "lookupUnavailable", "ambiguous"]);
  });

  test("overdue applies only to the six normal progress keys", () => {
    const problems = new Set<GuideKey>(PROBLEM_GUIDE_KEYS);
    expect(OVERDUE_CAPABLE_KEYS.filter((key) => problems.has(key))).toEqual([]);
    expect([...OVERDUE_CAPABLE_KEYS]).toEqual([
      "customsArrived", "customsWaiting", "customsCleared", "handedToCarrier", "pickedUp", "inTransit"
    ]);
  });
});

interface Row {
  readonly name: string;
  readonly input: FailureInput;
  readonly cause: FailureCause;
  readonly key: GuideKey;
}

const ROWS: readonly Row[] = [
  { name: "client pre-check", input: { kind: "precheck", reason: "tooShort" }, cause: "invalidNumber", key: "invalidNumber" },
  { name: "HTTP 400 JSON INVALID_NUMBER", input: { kind: "http", status: 400, code: "INVALID_NUMBER", isJson: true }, cause: "invalidNumber", key: "invalidNumber" },
  { name: "HTTP 413 without JSON", input: { kind: "http", status: 413, code: null, isJson: false }, cause: "invalidNumber", key: "invalidNumber" },
  { name: "HTTP 415 JSON", input: { kind: "http", status: 415, code: "INVALID_NUMBER", isJson: true }, cause: "invalidNumber", key: "invalidNumber" },
  { name: "HTTP 404 JSON NOT_FOUND", input: { kind: "http", status: 404, code: "NOT_FOUND", isJson: true }, cause: "notFound", key: "notFound" },
  { name: "HTTP 404 HTML page", input: { kind: "http", status: 404, code: null, isJson: false }, cause: "badGateway", key: "temporaryDelay" },
  { name: "HTTP 429 JSON RATE_LIMITED", input: { kind: "http", status: 429, code: "RATE_LIMITED", isJson: true }, cause: "rateLimited", key: "temporaryDelay" },
  { name: "HTTP 429 without JSON", input: { kind: "http", status: 429, code: null, isJson: false }, cause: "rateLimited", key: "temporaryDelay" },
  { name: "HTTP 503 JSON API_TIMEOUT", input: { kind: "http", status: 503, code: "API_TIMEOUT", isJson: true }, cause: "upstreamTimeout", key: "temporaryDelay" },
  { name: "HTTP 504 JSON API_TIMEOUT", input: { kind: "http", status: 504, code: "API_TIMEOUT", isJson: true }, cause: "upstreamTimeout", key: "temporaryDelay" },
  { name: "HTTP 408 JSON", input: { kind: "http", status: 408, code: null, isJson: true }, cause: "upstreamTimeout", key: "temporaryDelay" },
  { name: "HTML 502", input: { kind: "http", status: 502, code: null, isJson: false }, cause: "badGateway", key: "temporaryDelay" },
  { name: "HTTP 500 JSON SERVER_ERROR", input: { kind: "http", status: 500, code: "SERVER_ERROR", isJson: true }, cause: "serverError", key: "serverError" },
  { name: "HTTP 404 JSON with another code", input: { kind: "http", status: 404, code: "SERVER_ERROR", isJson: true }, cause: "serverError", key: "serverError" },
  { name: "HTTP 200 body fails the response schema", input: { kind: "contract" }, cause: "contractViolation", key: "serverError" },
  { name: "fetch TypeError while online", input: { kind: "network", online: true }, cause: "network", key: "temporaryDelay" },
  { name: "fetch TypeError while offline", input: { kind: "network", online: false }, cause: "offline", key: "offline" },
  { name: "our AbortController timeout", input: { kind: "timeout" }, cause: "clientTimeout", key: "noResponse" }
];

for (const row of ROWS) {
  test(`${row.name} → ${row.cause} → ${row.key}`, () => {
    expect(classifyFailure(row.input)).toBe(row.cause);
    expect(guideKeyForFailure(row.cause)).toBe(row.key);
  });
}

test("every failure cause maps to an error guide key", () => {
  const errors = new Set<GuideKey>(ERROR_GUIDE_KEYS);
  const causes: readonly FailureCause[] = [
    "invalidNumber", "notFound", "rateLimited", "upstreamTimeout", "badGateway",
    "network", "offline", "clientTimeout", "serverError", "contractViolation"
  ];
  expect(causes.filter((cause) => !errors.has(guideKeyForFailure(cause)))).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/classify-failure.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — Playwright reports an import error for `@/lib/tracking/classify-failure` (e.g. `Cannot find module`), 0 tests run.

- [ ] **Step 3: Write the domain types**

Create `lib/tracking/types.ts` (contract §11.6 verbatim; the only addition is `holidayName` on `holidayAffected`, contract addition 4):

```ts
import type { ApiError, DeliveryCarrierCode, TrackResponseData } from "@/lib/types";

export const GUIDE_KEYS = [
  "idle", "loading",
  "invalidNumber", "notFound", "temporaryDelay", "offline", "noResponse", "serverError",
  "pending", "customsArrived", "customsWaiting", "customsCleared", "handedToCarrier", "pickedUp",
  "inTransit", "delivered", "stale", "lookupUnavailable", "ambiguous"
] as const;
export type GuideKey = (typeof GUIDE_KEYS)[number];

export const ERROR_GUIDE_KEYS = ["invalidNumber", "notFound", "temporaryDelay", "offline", "noResponse", "serverError"] as const;
export const PROBLEM_GUIDE_KEYS = [...ERROR_GUIDE_KEYS, "stale", "lookupUnavailable", "ambiguous"] as const;
export const OVERDUE_CAPABLE_KEYS = ["customsArrived", "customsWaiting", "customsCleared", "handedToCarrier", "pickedUp", "inTransit"] as const;

export type Tone = "neutral" | "progress" | "waiting" | "attention" | "problem" | "done";
export type StatusTone = Exclude<Tone, "neutral">;
export type InquiryLevel = "header" | "shortcutRow" | "blockFirstLink" | "ctaButton" | "worryLink" | "textLink" | "afterStores" | "primary";
export type RevenueTier = "none" | "quiet" | "lead";
export type StorePlacement = "none" | "shortcutRow" | "purchaseChoices" | "ctaLead";
export type StorePlacementId = "shortcut" | "showcase" | "pending" | "deliveredLead";
export type TalkPlacement = "header" | "shortcut" | "state" | "footer";
export type RecommendationPlacement = "none" | "optional" | "inline";
export type RecommendationContext = "pending" | "customsWaiting" | "customsCleared" | "inTransit" | "delivered";
export type EtaMode = "none" | "estimate" | "pendingInfo" | "withheld" | "deliveredOn";
export type PrimaryActionKind = "none" | "submit" | "fixNumber" | "retry" | "copyAndTalk" | "carrierOfficial" | "chooseCarrier" | "storeLead";
export type CtaState = "error" | "pending" | "customsWaiting" | "customsCleared" | "inTransit" | "delivered" | "stale" | "lookupUnavailable" | "ambiguous";
export type StationId = "departed" | "customs" | "domestic" | "arrived";
export type SpineIssue = "stopped" | "cut" | "branch";
export type ViewMode = "idle" | "loading" | "settled" | "error";
export type LookupEntry = "manual" | "deepLink" | "restore" | "carrierChip" | "retry" | "autoRetryOnline";
export type ConcreteCarrierCode = Exclude<DeliveryCarrierCode, "AUTO">;
export type ApiErrorCode = ApiError["code"];
export type InvalidReason = "empty" | "tooShort" | "tooLong" | "confusableLetter" | "badFormat";
export type NoticeKind = "outage" | "delay" | "holiday" | "info";

export type FailureCause =
  | "invalidNumber"      // client pre-check, HTTP 400/413/415, invalid deep link
  | "notFound"           // HTTP 404 with JSON code NOT_FOUND
  | "rateLimited"        // HTTP 429
  | "upstreamTimeout"    // HTTP 503/504 (JSON API_TIMEOUT) and 408
  | "badGateway"         // any non-JSON response (e.g. HTML 502/404)
  | "network"            // fetch TypeError while navigator.onLine === true
  | "offline"            // fetch TypeError while navigator.onLine === false
  | "clientTimeout"      // our AbortController timeout fired
  | "serverError"        // HTTP 500 JSON SERVER_ERROR and any other JSON non-2xx not listed above
  | "contractViolation"; // HTTP 200 whose body fails ApiTrackResponseSchema

export type FailureInput =
  | { readonly kind: "precheck"; readonly reason: InvalidReason }
  | { readonly kind: "http"; readonly status: number; readonly code: string | null; readonly isJson: boolean }
  | { readonly kind: "contract" }
  | { readonly kind: "network"; readonly online: boolean }
  | { readonly kind: "timeout" };

export interface LookupRequest {
  readonly number: string;               // normalized: uppercase, no spaces/hyphens, half-width digits
  readonly carrier: DeliveryCarrierCode; // "AUTO" when not chosen
  readonly entry: LookupEntry;
}

export type LookupOutcome =
  | { readonly kind: "success"; readonly request: LookupRequest; readonly data: TrackResponseData }
  | { readonly kind: "failure"; readonly request: LookupRequest; readonly cause: FailureCause; readonly consecutiveFailures: number };

export type TrackingEntry =
  | { readonly kind: "home" }
  | { readonly kind: "deepLink"; readonly number: string; readonly carrier: DeliveryCarrierCode }
  | { readonly kind: "invalidDeepLink"; readonly input: string };

// ---------- view model ----------
export interface NumberView { readonly raw: string; readonly grouped: string }

export interface CarrierView {
  readonly code: DeliveryCarrierCode;
  readonly name: string | null;        // null when unknown; the internal label '택배사 자동 확인' is never a name
  readonly barLabel: string;           // number-bar suffix: carrier name | '택배사 자동 확인' (loading only) | '택배사 배정 전' | '택배사'
  readonly officialUrl: string | null; // delivery.trackingUrl or getDeliveryCarrier(code).trackingUrl(number) when code !== "AUTO"
}

export interface SpineView {
  readonly current: StationId | null;  // null = 위치 확인 전: 0 markers, no aria-current
  readonly issue: { readonly at: StationId; readonly kind: SpineIssue; readonly label: string } | null; // label '멈춤' | '끊김' | '갈림'
  readonly handoffPending: boolean;    // code 4: customs station done + '인계 대기'
  readonly positionLabel: string | null; // '2/4'; null when current is null
}

export interface EtaDate {
  readonly key: string;     // 'YYYY-MM-DD' in KST
  readonly label: string;   // '9월 30일 (수)'
  readonly month: number;   // 9
  readonly day: number;     // 30
  readonly weekday: string; // '수'
}

export type EtaView =
  | { readonly kind: "none" }
  | { readonly kind: "date"; readonly label: string; readonly date: EtaDate; readonly dday: number; readonly caption: string | null }
  | { readonly kind: "today"; readonly label: string; readonly date: EtaDate; readonly caption: string | null }
  | { readonly kind: "holidayAffected"; readonly label: string; readonly date: EtaDate; readonly badge: string; readonly holidayName: string; readonly caption: string | null }
  | { readonly kind: "overdue"; readonly label: string; readonly date: EtaDate }        // label '예상했던 날짜'
  | { readonly kind: "deliveredOn"; readonly label: string; readonly date: EtaDate }    // label '배송 완료일'
  | { readonly kind: "pendingInfo"; readonly label: string; readonly text: string }     // text '정보 등록 후 안내'
  | { readonly kind: "withheld"; readonly label: string; readonly text: string }        // text '지금은 도착 예상일을 안내하기 어려워요'
  | { readonly kind: "unknown"; readonly label: string; readonly text: string };        // estimate missing
export type EtaKind = EtaView["kind"];

export type ActionKind =
  | "fixNumber" | "retry" | "cancel" | "copyAndTalk" | "copyInquiry" | "talk"
  | "carrierOfficial" | "callDriver" | "copyReturnLink" | "chooseCarrier" | "undeliveredHelp";
export type ActionWeight = "primary" | "secondary" | "text";
export interface ActionView {
  readonly kind: ActionKind;
  readonly label: string;
  readonly weight: ActionWeight;
  readonly href: string | null;            // external or tel: link; null for in-page actions
  readonly external: boolean;              // new tab
  readonly cooldownSeconds: number | null; // 429: enabled after this many seconds
}

export interface WorryLineView {
  readonly dateKey: string | null; // 'YYYY-MM-DD' when date-based; null for notFound/pending day counts
  readonly text: string;           // '9월 29일(화)까지 그대로면 알려 주세요'
  readonly talk: ActionView;       // weight "text"
}

export interface StoreLinkView {
  readonly channel: "naver" | "coupang";
  readonly label: string;          // '네이버 스토어 보기' | '쿠팡 스토어 보기'
  readonly href: string;           // placement-specific URL from config.channels
  readonly isAffiliate: boolean;
  readonly weight: ActionWeight;
}
export interface StoreLinksView {
  readonly placement: StorePlacementId;
  readonly intro: string | null;       // pending: '주문하신 곳에서도 배송 안내를 볼 수 있어요'
  readonly disclosure: string | null;  // non-null iff some link isAffiliate
  readonly links: readonly StoreLinkView[];
}

export interface CarrierChoiceView { readonly code: ConcreteCarrierCode; readonly name: string }

export interface NextActionView {
  readonly heading: string | null;              // h3
  readonly sentence: string;
  readonly primary: ActionView | null;          // at most one filled action
  readonly secondary: readonly ActionView[];    // 0–2
  readonly worry: WorryLineView | null;
  readonly stores: StoreLinksView | null;
  readonly carrierChoices: readonly CarrierChoiceView[] | null; // ambiguous; lookupUnavailable without officialUrl
  readonly note: string | null;
}

export interface NoticeView { readonly id: string; readonly kind: NoticeKind; readonly title: string; readonly body: string }

export interface LastEventView {
  readonly at: string;              // ISO instant
  readonly label: string;           // glossary label '통관 접수'
  readonly original: string | null; // '통관목록접수' when different from label
  readonly place: string | null;
  readonly text: string;            // '9월 23일 (수) 14:10 · 통관 접수'
}
export interface HistoryEventView {
  readonly at: string; readonly timeText: string; readonly label: string; readonly original: string | null; readonly place: string | null;
}
export interface HistorySegmentView { readonly station: StationId; readonly title: string; readonly events: readonly HistoryEventView[] }
export interface HistoryView {
  readonly count: number;
  readonly summaryText: string;      // '처리 내역 11건 보기 · 마지막 9월 23일 14:10'
  readonly emptyText: string | null; // '아직 처리 내역이 없어요' when count === 0
  readonly segments: readonly HistorySegmentView[];
  readonly recent: readonly HistoryEventView[]; // newest 3 (desktop side column)
}

export interface HelpItemView { readonly id: string; readonly summary: string; readonly body: readonly string[]; readonly defaultOpen: boolean }
export interface RetryView { readonly cooldownSeconds: number | null; readonly autoRetryWhenOnline: boolean; readonly escalated: boolean }
export interface RevenueView {
  readonly tier: RevenueTier;
  readonly stores: StorePlacement;
  readonly recommendations: RecommendationPlacement;
  readonly recommendationContext: RecommendationContext | null;
  readonly adsAllowed: boolean;      // tier !== "none" && !overdue && mode === "settled"
}

export interface TrackingViewModel {
  readonly guideKey: GuideKey;
  readonly mode: "settled" | "error";
  readonly tone: Tone;               // after the overdue override
  readonly overdue: boolean;
  readonly number: NumberView;
  readonly carrier: CarrierView;
  readonly chip: string | null;      // '통관 대기 · 2/4', '확인 필요 · 2/4', '국내 도착 전', '조회 오류', '도착 · 4/4'
  readonly title: string;            // status h2, tokens resolved
  readonly reason: string | null;
  readonly notice: NoticeView | null;// in-card '안내' line
  readonly spine: SpineView;
  readonly eta: EtaView;
  readonly nextAction: NextActionView;
  readonly lastEvent: LastEventView | null;
  readonly history: HistoryView;
  readonly ctaState: CtaState;
  readonly inquiryLevel: InquiryLevel;
  readonly revenue: RevenueView;
  readonly retry: RetryView | null;  // error modes only
  readonly auxiliaryLine: { readonly text: string; readonly action: ActionView | null } | null; // NOT_FOUND caveat; '택배사 조회가 잠시 늦어요' + [다시 조회]
  readonly help: readonly HelpItemView[];
  readonly inquiryCopy: string | null; // non-null when a copyAndTalk/copyInquiry action exists
  readonly returnLink: string;         // buildReturnLink(number.raw, carrier.code)
  readonly documentTitle: string;      // `${row.docTitle} · 배송 조회`, never contains the number
  readonly liveMessage: string;        // one sentence for the live region
}

export type LoadingStage = "instant" | "short" | "long" | "veryLong"; // [0,400ms) [400ms,3s) [3s,8s) [8s,timeout)
export interface LoadingViewModel {
  readonly stage: LoadingStage;
  readonly number: NumberView;
  readonly carrier: CarrierView;
  readonly title: string;               // '조회하고 있어요'
  readonly body: string;                // '관세청 통관 정보와 택배사 배송 정보를 함께 확인해요'
  readonly extra: string | null;        // 3 s / 8 s copy
  readonly elapsedText: string | null;  // '12초째' from 8 s, 5 s steps
  readonly cancel: ActionView | null;   // from 3 s
  readonly carrierOfficial: ActionView | null; // from 8 s when carrier !== "AUTO"
  readonly spinnerActive: boolean;      // false from 5 s or with reduced motion
  readonly announcement: string | null; // '조회를 시작했어요' on entering "short"; the 8 s sentence on entering "veryLong"
  readonly submitLabel: string;         // '조회 중…'
  readonly outageNotice: NoticeView | null;
}

export type ResultAction =
  | { readonly kind: "fixNumber" }
  | { readonly kind: "retry" }
  | { readonly kind: "cancel" }
  | { readonly kind: "chooseCarrier"; readonly carrier: ConcreteCarrierCode }
  | { readonly kind: "copied"; readonly what: "inquiry" | "returnLink"; readonly outcome: "copied" | "fallback" } // same union as CopyOutcome in lib/clipboard.ts (S03 must not import S02 modules)
  | { readonly kind: "openedExternal"; readonly target: "talk" | "carrier" | "store" | "driver" };
```

- [ ] **Step 4: Write the config types**

Create `lib/config/types.ts` (contract §11.7 verbatim plus contract additions 2 and 3):

```ts
import type {
  EtaMode, GuideKey, InquiryLevel, NoticeKind, PrimaryActionKind, RecommendationContext, RecommendationPlacement,
  RevenueTier, StationId, StorePlacement, StorePlacementId, Tone
} from "@/lib/tracking/types";

export type ChannelId = "talk" | "naver" | "coupang";
export type StoreChannelId = Exclude<ChannelId, "talk">;

export interface TalkChannel {
  readonly url: string; // https only
  readonly labels: {
    readonly header: string;      // '문의'
    readonly shortcut: string;    // '톡톡 상담'
    readonly cta: string;         // '톡톡으로 문의하기'
    readonly copyAndTalk: string; // '문의 내용 복사하고 톡톡 열기'
    readonly footer: string;      // '톡톡 상담'
  };
}
export interface StoreChannel {
  readonly name: string;       // '네이버 스토어' | '쿠팡 스토어'
  readonly linkLabel: string;  // '네이버 스토어 보기' | '쿠팡 스토어 보기'
  readonly isAffiliate: boolean; // naver false, coupang true
  readonly urls: Readonly<Record<StorePlacementId, string>>; // per-placement link ids for partner dashboards
}
export interface ChannelsConfig {
  readonly talk: TalkChannel;
  readonly naver: StoreChannel;
  readonly coupang: StoreChannel;
  readonly allowedHosts: readonly string[];
}
export interface DisclosuresConfig { readonly coupang: string }

export interface HolidayPeriod {
  readonly id: string;               // '2026-chuseok'
  readonly name: string;             // '추석 연휴'
  readonly dates: readonly string[]; // 'YYYY-MM-DD'
  readonly badge: string;            // '추석 연휴 영향 · 1~2일 늦어질 수 있어요'
}
export interface CalendarConfig {
  readonly timeZone: "Asia/Seoul";
  readonly holidays: readonly HolidayPeriod[];
  readonly carrierDeliversSaturday: boolean; // default false
}

export interface DayRange { readonly min: number; readonly max: number }
export interface DurationsConfig {
  readonly stages: {
    readonly visibleAfterDeparture: DayRange; // HBL searchable 3~7 days after departure
    readonly customs: DayRange;               // 1~2 days
    readonly handoffBusinessDays: DayRange;   // 0~1 business days
    readonly domestic: DayRange;              // 1~2 days
  };
  readonly typical: readonly { readonly station: StationId; readonly text: string }[]; // '보통 이렇게 걸려요'
  readonly worry: {
    readonly afterEstimateBusinessDays: number;  // 1
    readonly afterClearanceBusinessDays: number; // 2
    readonly notFoundDays: number;               // 7
    readonly pendingDays: number;                // 10
    readonly undeliveredHours: number;           // 24
  };
  readonly staleDays: number;        // must equal 14
  readonly pendingRecheck: string;   // approval 4
}

export interface LookupConfig {
  readonly skeletonDelayMs: number;            // 400
  readonly stageMs: readonly [number, number]; // [3000, 8000]
  readonly spinnerStopMs: number;              // 5000
  readonly elapsedStepSeconds: number;         // 5
  readonly timeoutMs: number;                  // 45000 until approval-5 deployment, then 25000
  readonly rateLimitCooldownSeconds: number;   // 10
  readonly notFoundServiceCaveat: boolean;     // true until approval-5 deployment
  readonly copy: {
    readonly submit: string;               // '조회하기'
    readonly submitting: string;           // '조회 중…'
    readonly title: string;                // '조회하고 있어요'
    readonly body: string;                 // '관세청 통관 정보와 택배사 배송 정보를 함께 확인해요'
    readonly started: string;              // '조회를 시작했어요'
    readonly longWait: string;             // 3 s sentence
    readonly veryLongWait: string;         // 8 s sentence
    readonly elapsed: string;              // '{seconds}초째'
    readonly cancel: string;               // '조회 취소'
    readonly carrierOfficialFirst: string; // '택배사 공식 조회로 먼저 보기'
    readonly formatHint: string;           // §11.11
    readonly numberFinderSummary: string;  // '번호는 어디서 찾나요?'
    readonly numberFinderItems: readonly string[]; // 네이버 주문상세 → 배송조회, 쿠팡 주문목록 → 배송조회, 톡톡 출고 안내문
    readonly carrierAuto: string;          // '택배사 자동 확인' (S03 addition: loading-only number-bar suffix)
    readonly typicalSummary: string;       // '보통 이렇게 걸려요' (S03 addition)
  };
}

export interface GuideRow {
  readonly tone: Tone;
  readonly chip: string | null;          // base chip text; derive appends ' · n/4'
  readonly docTitle: string;             // '통관 대기 중' (no tokens, no digits)
  readonly title: string;                // h2; tokens allowed
  readonly overdueTitle: string | null;  // non-null exactly for OVERDUE_CAPABLE_KEYS
  readonly reason: string | null;
  readonly ctaHeading: string | null;    // h3 of 지금 할 일
  readonly nextAction: string;
  readonly worry: string | null;         // tokens allowed ({worryDate})
  readonly primaryAction: PrimaryActionKind;
  readonly inquiryLevel: InquiryLevel;
  readonly revenueTier: RevenueTier;
  readonly stores: StorePlacement;
  readonly recommendations: RecommendationPlacement;
  readonly etaMode: EtaMode;
}

export interface GlossaryEntry { readonly source: string; readonly label: string } // '수입신고수리' → '통관 완료'
export interface HelpEntry {
  readonly id: string;
  readonly summary: string;
  readonly body: readonly string[];
  readonly showIn: readonly GuideKey[];
  readonly openIn: readonly GuideKey[];
}
export interface FeaturedItem {
  readonly id: string;
  readonly name: string;
  readonly channel: StoreChannelId;
  readonly href: string;                  // product detail https URL
  readonly isAffiliate: boolean;
  readonly validFrom: string;             // ISO with +09:00
  readonly validUntil: string;            // ISO with +09:00
  readonly priceLabel: string | null;
  readonly priceCheckedAt: string | null; // ISO; price shown only when within 7 days of now
  readonly contexts: readonly RecommendationContext[];
}
export interface Notice {
  readonly id: string;
  readonly kind: NoticeKind;
  readonly title: string;        // ≤ 20 chars
  readonly body: string;         // ≤ 80 chars
  readonly startsAt: string;     // ISO +09:00
  readonly endsAt: string;       // ISO +09:00, > startsAt
  readonly home: boolean;        // home banner
  readonly guideKeys: readonly GuideKey[]; // result in-card line
  readonly cs: boolean;          // appended to CS replies
}
export interface AdsConfig {
  readonly manualSlotId: string | null; // AdSense ad unit id (approval 15); null → slot not rendered
  readonly minHeightMobilePx: number;   // 280
  readonly minHeightDesktopPx: number;  // 250
  readonly anchorReservePx: number;     // 64; S08 verifies against a real anchor and amends the value
}
export interface StyleConfig { readonly followSystemDark: boolean } // default true

/** S03 addition: result copy the spec does not give per state. Slots per field are fixed in lib/config/invariants.ts. */
export interface ResultCopyConfig {
  readonly etaLabel: string;               // '도착 예상'
  readonly etaTodayLabel: string;          // '오늘 예상'
  readonly etaOverdueLabel: string;        // '예상했던 날짜'
  readonly etaDeliveredLabel: string;      // '배송 완료일'
  readonly etaPendingText: string;         // '정보 등록 후 안내'
  readonly etaWithheldText: string;        // '지금은 도착 예상일을 안내하기 어려워요'
  readonly etaUnknownText: string;         // estimate missing
  readonly customsEstimateCaption: string; // '통관 완료 예상 {date}'
  readonly customsDoneCaption: string;     // '통관 완료 {date}'
  readonly overdueChip: string;            // '확인 필요'
  readonly overdueSentence: string;        // 지금 할 일 sentence under overdue
  readonly carrierUnknown: string;         // '택배사'
  readonly carrierUnassigned: string;      // '택배사 배정 전'
  readonly issueStopped: string;           // '멈춤'
  readonly issueCut: string;               // '끊김'
  readonly issueBranch: string;            // '갈림'
  readonly stationDeparted: string;        // '해외 출발'
  readonly stationCustoms: string;         // '입항·통관'
  readonly stationDomestic: string;        // '국내 배송'
  readonly stationArrived: string;         // '도착'
  readonly historySummary: string;         // '처리 내역 {n}건 보기'
  readonly historyLast: string;            // '마지막 {time}'
  readonly historyEmpty: string;           // '아직 처리 내역이 없어요'
  readonly actionFixNumber: string;        // '번호 수정'
  readonly actionRetry: string;            // '다시 조회'
  readonly actionCarrierOfficial: string;  // '{carrier} 공식 배송조회'
  readonly actionCarrierLive: string;      // '{carrier}에서 실시간 위치 보기'
  readonly actionCallDriver: string;       // '기사님께 전화'
  readonly actionReturnLink: string;       // '다시 볼 링크 복사'
  readonly actionUndelivered: string;      // '받지 못하셨나요?'
  readonly pendingStoresIntro: string;     // '주문하신 곳에서도 배송 안내를 볼 수 있어요'
  readonly notFoundCaveat: string;         // '조회 서비스 사정으로 결과가 없을 수도 있어요'
  readonly carrierCutLine: string;         // '택배사 조회가 잠시 늦어요'
  readonly rateLimitedReason: string;      // '조회가 몰려 {seconds}초 뒤 다시 조회할 수 있어요'
  readonly customsCheckNote: string;       // '개인통관고유부호와 수취인 이름이 주문 정보와 같은지도 확인해 주세요'
  readonly chooseCarrierSentence: string;  // lookupUnavailable without an official link
}

export interface SiteConfig {
  readonly channels: ChannelsConfig;
  readonly disclosures: DisclosuresConfig;
  readonly calendar: CalendarConfig;
  readonly durations: DurationsConfig;
  readonly lookup: LookupConfig;
  readonly stateGuide: Readonly<Record<GuideKey, GuideRow>>;
  readonly glossary: readonly GlossaryEntry[];
  readonly help: readonly HelpEntry[];
  readonly featuredProducts: readonly FeaturedItem[];
  readonly notices: readonly Notice[];
  readonly ads: AdsConfig;
  readonly style: StyleConfig;
  readonly resultCopy: ResultCopyConfig;
}
export type LoadingConfig = Pick<SiteConfig, "lookup" | "notices">;
```

- [ ] **Step 5: Write the failure classifier**

Create `lib/tracking/classify-failure.ts`:

```ts
import type { FailureCause, FailureInput, GuideKey } from "@/lib/tracking/types";

const INVALID_STATUSES: ReadonlySet<number> = new Set([400, 413, 415]);
const UPSTREAM_TIMEOUT_STATUSES: ReadonlySet<number> = new Set([408, 503, 504]);
const RATE_LIMITED_STATUS = 429;
const NOT_FOUND_STATUS = 404;

const GUIDE_KEY_BY_CAUSE: Readonly<Record<FailureCause, GuideKey>> = {
  invalidNumber: "invalidNumber",
  notFound: "notFound",
  rateLimited: "temporaryDelay",
  upstreamTimeout: "temporaryDelay",
  badGateway: "temporaryDelay",
  network: "temporaryDelay",
  offline: "offline",
  clientTimeout: "noResponse",
  serverError: "serverError",
  contractViolation: "serverError"
};

function classifyHttp(status: number, code: string | null, isJson: boolean): FailureCause {
  if (status === RATE_LIMITED_STATUS) return "rateLimited";
  if (INVALID_STATUSES.has(status)) return "invalidNumber";
  if (!isJson) return "badGateway";
  if (status === NOT_FOUND_STATUS && code === "NOT_FOUND") return "notFound";
  if (UPSTREAM_TIMEOUT_STATUSES.has(status)) return "upstreamTimeout";
  return "serverError";
}

/** Maps what the client observed to one failure cause. Server message text is never used. */
export function classifyFailure(input: FailureInput): FailureCause {
  switch (input.kind) {
    case "precheck":
      return "invalidNumber";
    case "contract":
      return "contractViolation";
    case "network":
      return input.online ? "network" : "offline";
    case "timeout":
      return "clientTimeout";
    case "http":
      return classifyHttp(input.status, input.code, input.isJson);
  }
}

export function guideKeyForFailure(cause: FailureCause): GuideKey {
  return GUIDE_KEY_BY_CAUSE[cause];
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/classify-failure.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck`
Expected: `22 passed`; typecheck exits 0.

- [ ] **Step 7: Commit**

```powershell
git add lib/tracking/types.ts lib/config/types.ts lib/tracking/classify-failure.ts tests/unit/classify-failure.spec.ts; git commit -m "feat: add renewal domain types, config types and failure classification"
```

---

### Task 2: KST time, business days and holiday overlap

**Files:**
- Create: `lib/tracking/time.ts`
- Test: `tests/unit/kst-time.spec.ts`

**Interfaces:**
- Consumes: `CalendarConfig`, `HolidayPeriod` from `@/lib/config/types` (Task 1).
- Produces (contract §11.8): `KstDateKey`, `BusinessDayKind`, `kstDateKey(instant: Date): KstDateKey`, `parseInstant(iso: string): Date | null`, `formatKstDate(value: Date | KstDateKey): string` ('9월 30일 (수)'), `formatKstDateTight` ('9월 29일(화)'), `formatKstDateTime(instant: Date)` ('9월 23일 (수) 14:10'), `formatKstShortDateTime(instant: Date)` ('9월 23일 14:10'), `formatKstTime(instant: Date)` ('14:10'), `weekdayLabel(key)`, `addCalendarDays(key, days)`, `calendarDaysBetween(from, to)`, `isHoliday(key, calendar)`, `isBusinessDay(key, calendar, kind)`, `businessDaysAfter(start, count, calendar, kind)`, `holidayPeriodBetween(from, to, calendar)`. KST is computed as UTC+9 arithmetic (Korea has no DST), so the result never depends on the machine time zone and no `Intl` data ships to the client.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/kst-time.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import type { CalendarConfig } from "@/lib/config/types";
import {
  addCalendarDays, businessDaysAfter, calendarDaysBetween, formatKstDate, formatKstDateTight, formatKstDateTime,
  formatKstShortDateTime, formatKstTime, holidayPeriodBetween, isBusinessDay, isHoliday, kstDateKey, parseInstant, weekdayLabel
} from "@/lib/tracking/time";

const CALENDAR: CalendarConfig = {
  timeZone: "Asia/Seoul",
  carrierDeliversSaturday: false,
  holidays: [
    { id: "2026-chuseok", name: "추석 연휴", dates: ["2026-09-24", "2026-09-25", "2026-09-26"], badge: "추석 연휴 영향 · 1~2일 늦어질 수 있어요" },
    { id: "2026-foundation-day", name: "개천절", dates: ["2026-10-03", "2026-10-05"], badge: "개천절 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-hangul-day", name: "한글날", dates: ["2026-10-09"], badge: "한글날 영향 · 1일 늦어질 수 있어요" }
  ]
};
const SATURDAY_CALENDAR: CalendarConfig = { ...CALENDAR, carrierDeliversSaturday: true };

function describeTimeRows(): void {
  test("KST date keys switch at KST midnight", () => {
    expect(kstDateKey(new Date("2026-09-26T23:59:59+09:00"))).toBe("2026-09-26");
    expect(kstDateKey(new Date("2026-09-26T15:00:00Z"))).toBe("2026-09-27");
    expect(kstDateKey(new Date("2026-09-26T14:59:59Z"))).toBe("2026-09-26");
  });

  test("KST formats", () => {
    expect(formatKstDate("2026-09-30")).toBe("9월 30일 (수)");
    expect(formatKstDate(new Date("2026-09-30T23:30:00+09:00"))).toBe("9월 30일 (수)");
    expect(formatKstDateTight("2026-09-29")).toBe("9월 29일(화)");
    expect(formatKstDateTime(new Date("2026-09-23T14:10:00+09:00"))).toBe("9월 23일 (수) 14:10");
    expect(formatKstShortDateTime(new Date("2026-09-23T05:10:00Z"))).toBe("9월 23일 14:10");
    expect(formatKstTime(new Date("2026-10-12T08:05:00+09:00"))).toBe("08:05");
    expect(weekdayLabel("2026-09-26")).toBe("토");
  });
}

test.describe("KST keys and formats", () => {
  describeTimeRows();

  test("parseInstant returns null for anything that is not a date", () => {
    expect(parseInstant("")).toBeNull();
    expect(parseInstant("not-a-date")).toBeNull();
    expect(parseInstant("2026-09-23T14:10:00+09:00")?.toISOString()).toBe("2026-09-23T05:10:00.000Z");
  });

  test("calendar day arithmetic crosses months and years", () => {
    expect(addCalendarDays("2026-09-30", 2)).toBe("2026-10-02");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCalendarDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(calendarDaysBetween("2026-09-26", "2026-09-30")).toBe(4);
    expect(calendarDaysBetween("2026-09-30", "2026-09-26")).toBe(-4);
  });

  test("malformed or impossible date keys throw instead of producing NaN", () => {
    expect(() => formatKstDate("2026-02-30")).toThrow("없는 날짜입니다: 2026-02-30");
    expect(() => addCalendarDays("2026/09/30", 1)).toThrow("날짜 키 형식이 아닙니다: 2026/09/30");
  });
});

test.describe("business days", () => {
  test("holidays and weekends are not business days; Saturday counts only for carriers that deliver on Saturday", () => {
    expect(isHoliday("2026-09-25", CALENDAR)).toBe(true);
    expect(isHoliday("2026-10-04", CALENDAR)).toBe(false);
    expect(isBusinessDay("2026-09-28", CALENDAR, "customs")).toBe(true);
    expect(isBusinessDay("2026-09-26", CALENDAR, "delivery")).toBe(false);
    expect(isBusinessDay("2026-10-05", CALENDAR, "customs")).toBe(false);
    expect(isBusinessDay("2026-10-10", CALENDAR, "delivery")).toBe(false);
    expect(isBusinessDay("2026-10-10", SATURDAY_CALENDAR, "delivery")).toBe(true);
    expect(isBusinessDay("2026-10-10", SATURDAY_CALENDAR, "customs")).toBe(false);
    expect(isBusinessDay("2026-10-11", SATURDAY_CALENDAR, "delivery")).toBe(false);
  });

  test("spec example: customs cleared on 9/23 → handoff worry date 9/29", () => {
    expect(businessDaysAfter("2026-09-23", 2, CALENDAR, "customs")).toBe("2026-09-29");
  });

  test("business days skip the Chuseok holidays, 개천절 and its substitute day", () => {
    expect(businessDaysAfter("2026-09-25", 1, CALENDAR, "customs")).toBe("2026-09-28");
    expect(businessDaysAfter("2026-10-02", 1, CALENDAR, "customs")).toBe("2026-10-06");
    expect(businessDaysAfter("2026-10-08", 1, CALENDAR, "delivery")).toBe("2026-10-12");
    expect(businessDaysAfter("2026-10-08", 1, SATURDAY_CALENDAR, "delivery")).toBe("2026-10-10");
    expect(businessDaysAfter("2026-09-28", 0, CALENDAR, "customs")).toBe("2026-09-28");
  });

  test("a negative business-day count throws", () => {
    expect(() => businessDaysAfter("2026-09-28", -1, CALENDAR, "customs")).toThrow("영업일 수가 올바르지 않습니다: -1");
  });

  test("holiday overlap finds the first period touching the closed interval", () => {
    expect(holidayPeriodBetween("2026-09-23", "2026-09-30", CALENDAR)?.id).toBe("2026-chuseok");
    expect(holidayPeriodBetween("2026-09-26", "2026-09-26", CALENDAR)?.id).toBe("2026-chuseok");
    expect(holidayPeriodBetween("2026-09-28", "2026-10-02", CALENDAR)).toBeNull();
    expect(holidayPeriodBetween("2026-10-04", "2026-10-04", CALENDAR)).toBeNull();
    expect(holidayPeriodBetween("2026-10-05", "2026-10-05", CALENDAR)?.id).toBe("2026-foundation-day");
    expect(holidayPeriodBetween("2026-10-10", "2026-10-01", CALENDAR)).toBeNull();
  });
});

test.describe("same answers in America/New_York", () => {
  let previousTz: string | undefined;

  test.beforeAll(() => {
    previousTz = process.env.TZ;
    process.env.TZ = "America/New_York";
  });

  test.afterAll(() => {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  });

  test("the process really runs in New York time", () => {
    expect(new Date("2026-09-26T00:00:00Z").getHours()).toBe(20);
  });

  describeTimeRows();

  test("business days are unchanged", () => {
    expect(businessDaysAfter("2026-09-23", 2, CALENDAR, "customs")).toBe("2026-09-29");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/kst-time.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — import error for `@/lib/tracking/time`, 0 tests run.

- [ ] **Step 3: Write the implementation**

Create `lib/tracking/time.ts`:

```ts
import type { CalendarConfig, HolidayPeriod } from "@/lib/config/types";

export type KstDateKey = string; // 'YYYY-MM-DD'
export type BusinessDayKind = "customs" | "delivery"; // delivery counts Saturday iff calendar.carrierDeliversSaturday

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // Korea has no daylight saving time
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_BUSINESS_DAY_SCAN = 400;
const SUNDAY = 0;
const SATURDAY = 6;

const pad2 = (value: number): string => String(value).padStart(2, "0");

function kstShifted(instant: Date): Date {
  return new Date(instant.getTime() + KST_OFFSET_MS);
}

function keyToUtcMs(key: KstDateKey): number {
  const match = DATE_KEY_PATTERN.exec(key);
  if (!match) throw new Error(`날짜 키 형식이 아닙니다: ${key}`);
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (new Date(ms).toISOString().slice(0, 10) !== key) throw new Error(`없는 날짜입니다: ${key}`);
  return ms;
}

function toKey(value: Date | KstDateKey): KstDateKey {
  return typeof value === "string" ? value : kstDateKey(value);
}

function monthDay(key: KstDateKey): { readonly month: number; readonly day: number } {
  const date = new Date(keyToUtcMs(key));
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function weekdayIndex(key: KstDateKey): number {
  return new Date(keyToUtcMs(key)).getUTCDay();
}

export function kstDateKey(instant: Date): KstDateKey {
  return kstShifted(instant).toISOString().slice(0, 10);
}

export function parseInstant(iso: string): Date | null {
  const value = new Date(iso);
  return Number.isNaN(value.getTime()) ? null : value;
}

export function weekdayLabel(key: KstDateKey): string {
  return WEEKDAYS[weekdayIndex(key)];
}

/** '9월 30일 (수)' */
export function formatKstDate(value: Date | KstDateKey): string {
  const key = toKey(value);
  const { month, day } = monthDay(key);
  return `${month}월 ${day}일 (${weekdayLabel(key)})`;
}

/** '9월 29일(화)' — used inside sentences such as '…까지 그대로면 알려 주세요' */
export function formatKstDateTight(value: Date | KstDateKey): string {
  const key = toKey(value);
  const { month, day } = monthDay(key);
  return `${month}월 ${day}일(${weekdayLabel(key)})`;
}

/** '14:10' */
export function formatKstTime(instant: Date): string {
  const shifted = kstShifted(instant);
  return `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}`;
}

/** '9월 23일 (수) 14:10' */
export function formatKstDateTime(instant: Date): string {
  return `${formatKstDate(instant)} ${formatKstTime(instant)}`;
}

/** '9월 23일 14:10' */
export function formatKstShortDateTime(instant: Date): string {
  const { month, day } = monthDay(kstDateKey(instant));
  return `${month}월 ${day}일 ${formatKstTime(instant)}`;
}

export function addCalendarDays(key: KstDateKey, days: number): KstDateKey {
  return new Date(keyToUtcMs(key) + days * DAY_MS).toISOString().slice(0, 10);
}

export function calendarDaysBetween(from: KstDateKey, to: KstDateKey): number {
  return Math.round((keyToUtcMs(to) - keyToUtcMs(from)) / DAY_MS);
}

export function isHoliday(key: KstDateKey, calendar: CalendarConfig): boolean {
  return calendar.holidays.some((period) => period.dates.includes(key));
}

export function isBusinessDay(key: KstDateKey, calendar: CalendarConfig, kind: BusinessDayKind): boolean {
  const weekday = weekdayIndex(key);
  if (weekday === SUNDAY) return false;
  if (weekday === SATURDAY && !(kind === "delivery" && calendar.carrierDeliversSaturday)) return false;
  return !isHoliday(key, calendar);
}

/** The `count`-th business day strictly after `start` (count 0 → start). */
export function businessDaysAfter(start: KstDateKey, count: number, calendar: CalendarConfig, kind: BusinessDayKind): KstDateKey {
  if (!Number.isInteger(count) || count < 0) throw new Error(`영업일 수가 올바르지 않습니다: ${count}`);
  keyToUtcMs(start);
  let current = start;
  let found = 0;
  let scanned = 0;
  while (found < count) {
    current = addCalendarDays(current, 1);
    scanned += 1;
    if (scanned > MAX_BUSINESS_DAY_SCAN) throw new Error(`영업일을 찾지 못했습니다: ${start}`);
    if (isBusinessDay(current, calendar, kind)) found += 1;
  }
  return current;
}

/** First holiday period with a date inside [from, to]; null when from > to or none overlaps. */
export function holidayPeriodBetween(from: KstDateKey, to: KstDateKey, calendar: CalendarConfig): HolidayPeriod | null {
  if (from > to) return null;
  return calendar.holidays.find((period) => period.dates.some((date) => date >= from && date <= to)) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/kst-time.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck`
Expected: `14 passed`; typecheck exits 0. (If "the process really runs in New York time" fails, the Node build ignores runtime `TZ` changes: record it in the stage summary and run this file once with `$env:TZ='America/New_York'` set before `npx playwright test` to prove the rows; do not delete the test.)

- [ ] **Step 5: Commit**

```powershell
git add lib/tracking/time.ts tests/unit/kst-time.spec.ts; git commit -m "feat: add KST time, business-day and holiday helpers"
```

### Task 3: Number grouping, copy templates and the glossary

**Files:**
- Create: `lib/tracking/number-format.ts`, `lib/tracking/template.ts`, `lib/tracking/glossary.ts`
- Test: `tests/unit/number-format.spec.ts`, `tests/unit/template.spec.ts`, `tests/unit/glossary.spec.ts`

**Interfaces:**
- Consumes: `GlossaryEntry` from `@/lib/config/types` (Task 1); `FAKE`, `FAKE_GROUPED` from `tests/fixtures/tracking-fixtures.ts` (S01).
- Produces: `groupTrackingNumber(raw: string): string`; `type CopyToken`, `COPY_TOKENS: readonly CopyToken[]`, `tokensIn(template: string): readonly string[]`, `fillCopy(template: string, values: Readonly<Partial<Record<CopyToken, string>>>): string`, `fillSlots(template: string, values: Readonly<Record<string, string | undefined>>): string` (addition 6); `glossaryLabel(status: string, glossary: readonly GlossaryEntry[]): { readonly label: string; readonly original: string | null }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/number-format.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { groupTrackingNumber } from "@/lib/tracking/number-format";
import { FAKE, FAKE_GROUPED } from "../fixtures/tracking-fixtures";

test("domestic waybills group in fours from the left", () => {
  expect(groupTrackingNumber(FAKE.domestic)).toBe(FAKE_GROUPED.domestic);
  expect(groupTrackingNumber(FAKE.domesticAlt)).toBe(FAKE_GROUPED.domesticAlt);
  expect(groupTrackingNumber(FAKE.domestic14)).toBe("0000 1234 5678 90");
  expect(groupTrackingNumber(FAKE.domestic10)).toBe("0000 1234 56");
});

test("HBL letters form one group before the digit groups", () => {
  expect(groupTrackingNumber(FAKE.hbl)).toBe(FAKE_GROUPED.hbl);
  expect(groupTrackingNumber(FAKE.hblAlt)).toBe(FAKE_GROUPED.hblAlt);
  expect(groupTrackingNumber(FAKE.hbl.toLowerCase())).toBe(FAKE_GROUPED.hbl);
});

test("long cargo numbers keep every digit (no truncation)", () => {
  const grouped = groupTrackingNumber(FAKE.cargo);
  expect(grouped.replace(/ /g, "")).toBe(FAKE.cargo);
  expect(grouped.split(" ").every((group) => group.length <= 4)).toBe(true);
});

test("empty input stays empty", () => {
  expect(groupTrackingNumber("")).toBe("");
});
```

Create `tests/unit/template.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { COPY_TOKENS, fillCopy, fillSlots, tokensIn } from "@/lib/tracking/template";

test("stateGuide copy may use exactly five tokens", () => {
  expect([...COPY_TOKENS]).toEqual(["etaDate", "worryDate", "lastEventDate", "carrier", "staleDays"]);
});

test("tokensIn lists tokens in order, repeats included", () => {
  expect(tokensIn("{worryDate}까지 {carrier} {worryDate}")).toEqual(["worryDate", "carrier", "worryDate"]);
  expect(tokensIn("토큰 없음")).toEqual([]);
});

test("fillCopy resolves known tokens and blanks missing or unknown ones", () => {
  expect(fillCopy("{carrier} 기사님 픽업 완료!", { carrier: "CJ대한통운" })).toBe("CJ대한통운 기사님 픽업 완료!");
  expect(fillCopy("{worryDate}까지 그대로면 알려 주세요", {})).toBe("까지 그대로면 알려 주세요");
  expect(fillCopy("{orderId} 확인", { carrier: "CJ대한통운" })).toBe(" 확인");
});

test("fillSlots fills the non-stateGuide slots", () => {
  expect(fillSlots("처리 내역 {n}건 보기", { n: "11" })).toBe("처리 내역 11건 보기");
  expect(fillSlots("{seconds}초째", { seconds: "13" })).toBe("13초째");
});

test("braces without a token name stay untouched", () => {
  expect(fillSlots("{ } {1}", {})).toBe("{ } {1}");
});
```

Create `tests/unit/glossary.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import type { GlossaryEntry } from "@/lib/config/types";
import { glossaryLabel } from "@/lib/tracking/glossary";

const GLOSSARY: readonly GlossaryEntry[] = [
  { source: "수입신고수리", label: "통관 완료" },
  { source: "통관목록접수", label: "통관 접수" },
  { source: "간선하차", label: "지역 터미널 도착" },
  { source: "입항", label: "입항" }
];

test("a known term gets the customer label and keeps the original", () => {
  expect(glossaryLabel("수입신고수리", GLOSSARY)).toEqual({ label: "통관 완료", original: "수입신고수리" });
  expect(glossaryLabel("간선하차", GLOSSARY)).toEqual({ label: "지역 터미널 도착", original: "간선하차" });
});

test("spacing differences still match; the original is trimmed", () => {
  expect(glossaryLabel(" 통관목록 접수 ", GLOSSARY)).toEqual({ label: "통관 접수", original: "통관목록 접수" });
});

test("an unknown term is shown as it is, without an original", () => {
  expect(glossaryLabel("배송출발", GLOSSARY)).toEqual({ label: "배송출발", original: null });
});

test("a term whose label equals the source has no original", () => {
  expect(glossaryLabel("입항", GLOSSARY)).toEqual({ label: "입항", original: null });
});

test("an empty status stays empty", () => {
  expect(glossaryLabel("   ", GLOSSARY)).toEqual({ label: "", original: null });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/number-format.spec.ts tests/unit/template.spec.ts tests/unit/glossary.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — import errors for `@/lib/tracking/number-format`, `@/lib/tracking/template`, `@/lib/tracking/glossary`.

- [ ] **Step 3: Write the implementations**

Create `lib/tracking/number-format.ts`:

```ts
const LETTER_PREFIX = /^[A-Z]+/;
const GROUP_SIZE = 4;

/** 'TEST00000001' → 'TEST 0000 0001'; '00001234567890' → '0000 1234 5678 90'. Never truncates. */
export function groupTrackingNumber(raw: string): string {
  const value = raw.trim().toUpperCase();
  const prefix = LETTER_PREFIX.exec(value)?.[0] ?? "";
  const rest = value.slice(prefix.length);
  const groups: string[] = prefix.length > 0 ? [prefix] : [];
  for (let index = 0; index < rest.length; index += GROUP_SIZE) {
    groups.push(rest.slice(index, index + GROUP_SIZE));
  }
  return groups.join(" ");
}
```

Create `lib/tracking/template.ts`:

```ts
export type CopyToken = "etaDate" | "worryDate" | "lastEventDate" | "carrier" | "staleDays";

export const COPY_TOKENS: readonly CopyToken[] = ["etaDate", "worryDate", "lastEventDate", "carrier", "staleDays"];

const TOKEN_PATTERN = /\{([A-Za-z]+)\}/g;

export function tokensIn(template: string): readonly string[] {
  return Array.from(template.matchAll(TOKEN_PATTERN), (match) => match[1]);
}

/** Replaces every `{name}` with values[name]; unknown or missing names become ''. */
export function fillSlots(template: string, values: Readonly<Record<string, string | undefined>>): string {
  return template.replace(TOKEN_PATTERN, (_whole: string, name: string) => values[name] ?? "");
}

/** stateGuide copy: only the five CopyTokens have values. Unknown tokens are rejected by the config schema. */
export function fillCopy(template: string, values: Readonly<Partial<Record<CopyToken, string>>>): string {
  return fillSlots(template, values);
}
```

Create `lib/tracking/glossary.ts`:

```ts
import type { GlossaryEntry } from "@/lib/config/types";

const withoutSpaces = (value: string): string => value.replace(/\s+/g, "");

/** '수입신고수리' → { label: '통관 완료', original: '수입신고수리' }; unknown terms pass through. */
export function glossaryLabel(
  status: string,
  glossary: readonly GlossaryEntry[]
): { readonly label: string; readonly original: string | null } {
  const trimmed = status.trim();
  const key = withoutSpaces(trimmed);
  const entry = key.length > 0 ? glossary.find((item) => withoutSpaces(item.source) === key) : undefined;
  if (entry === undefined) return { label: trimmed, original: null };
  return { label: entry.label, original: entry.label === trimmed ? null : trimmed };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/number-format.spec.ts tests/unit/template.spec.ts tests/unit/glossary.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck`
Expected: `14 passed`; typecheck exits 0.

- [ ] **Step 5: Commit**

```powershell
git add lib/tracking/number-format.ts lib/tracking/template.ts lib/tracking/glossary.ts tests/unit/number-format.spec.ts tests/unit/template.spec.ts tests/unit/glossary.spec.ts; git commit -m "feat: add number grouping, copy templates and the event glossary"
```

---

### Task 4: Carrier names and notice selection

**Files:**
- Create: `lib/tracking/carriers.ts`, `lib/tracking/notices.ts`
- Test: `tests/unit/carriers.spec.ts`, `tests/unit/notices.spec.ts`

**Interfaces:**
- Consumes: `DeliveryCarrierCode`, `DELIVERY_CARRIER_CODES` (`@/lib/types`); `ConcreteCarrierCode`, `CarrierView`, `LookupRequest`, `GuideKey`, `NoticeKind`, `NoticeView` (Task 1); `Notice` (`@/lib/config/types`); `parseInstant` (Task 2). Tests only: `getDeliveryCarrier` from `@/lib/delivery-carriers` (parity).
- Produces: contract addition 1 (`CONCRETE_CARRIER_CODES`, `CARRIER_NAMES`, `isConcreteCarrier`, `carrierOfficialUrl`, `carrierDisplayName`, `requestCarrierView`); contract §11.8 notices (`type NoticeSlot`, `NOTICE_PRIORITY`, `activeNotices(notices, now, slot): readonly Notice[]`, `pickNotice(notices, now, slot): Notice | null`, `toNoticeView(notice): NoticeView`). Windows are half-open: `startsAt ≤ now < endsAt`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/carriers.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { getDeliveryCarrier } from "@/lib/delivery-carriers";
import {
  CARRIER_NAMES, CONCRETE_CARRIER_CODES, carrierDisplayName, carrierOfficialUrl, isConcreteCarrier, requestCarrierView
} from "@/lib/tracking/carriers";
import { DELIVERY_CARRIER_CODES } from "@/lib/types";
import { FAKE } from "../fixtures/tracking-fixtures";

test("the concrete carrier list is every carrier code except AUTO", () => {
  expect([...CONCRETE_CARRIER_CODES]).toEqual(DELIVERY_CARRIER_CODES.filter((code) => code !== "AUTO"));
  expect(isConcreteCarrier("AUTO")).toBe(false);
  expect(isConcreteCarrier("CJ")).toBe(true);
});

test("names and official URLs match lib/delivery-carriers.ts for every carrier", () => {
  for (const code of CONCRETE_CARRIER_CODES) {
    expect(CARRIER_NAMES[code]).toBe(getDeliveryCarrier(code).name);
    expect(carrierOfficialUrl(code, FAKE.domestic)).toBe(getDeliveryCarrier(code).trackingUrl(FAKE.domestic));
  }
});

test("AUTO or an empty number has no official URL", () => {
  expect(carrierOfficialUrl("AUTO", FAKE.domestic)).toBeNull();
  expect(carrierOfficialUrl("CJ", "")).toBeNull();
});

test("display names never show the internal automatic-lookup label", () => {
  expect(carrierDisplayName("택배사 자동 확인", "AUTO")).toBeNull();
  expect(carrierDisplayName("국내택배 자동 조회", "AUTO")).toBeNull();
  expect(carrierDisplayName(undefined, "AUTO")).toBeNull();
  expect(carrierDisplayName("CJ대한통운", "CJ")).toBe("CJ대한통운");
  expect(carrierDisplayName("", "HANJIN")).toBe("한진택배");
  expect(carrierDisplayName("택배사 자동 확인", "LOTTE")).toBe("롯데택배");
  expect(carrierDisplayName("한진택배", "AUTO")).toBe("한진택배");
});

test("request carrier view uses the given label while the carrier is unknown", () => {
  expect(requestCarrierView({ number: FAKE.domestic, carrier: "AUTO", entry: "manual" }, "택배사 자동 확인")).toEqual({
    code: "AUTO", name: null, barLabel: "택배사 자동 확인", officialUrl: null
  });
  expect(requestCarrierView({ number: FAKE.domestic, carrier: "CJ", entry: "deepLink" }, "택배사 자동 확인")).toEqual({
    code: "CJ", name: "CJ대한통운", barLabel: "CJ대한통운", officialUrl: carrierOfficialUrl("CJ", FAKE.domestic)
  });
});
```

Create `tests/unit/notices.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import type { Notice } from "@/lib/config/types";
import { NOTICE_PRIORITY, activeNotices, pickNotice, toNoticeView } from "@/lib/tracking/notices";

const HOLIDAY: Notice = {
  id: "holiday", kind: "holiday", title: "추석 연휴 배송 안내", body: "추석 연휴(9/24~26)와 주말에는 통관·택배가 쉬어요.",
  startsAt: "2026-09-21T00:00:00+09:00", endsAt: "2026-09-29T00:00:00+09:00", home: true,
  guideKeys: ["customsWaiting", "inTransit", "loading"], cs: true
};
const OUTAGE: Notice = {
  id: "outage", kind: "outage", title: "UNI-PASS 점검 안내", body: "UNI-PASS 점검(22:00~24:00) 중에는 통관 정보가 늦게 보일 수 있어요.",
  startsAt: "2026-09-26T22:00:00+09:00", endsAt: "2026-09-27T00:00:00+09:00", home: true,
  guideKeys: ["loading", "temporaryDelay", "customsWaiting"], cs: true
};
const INFO: Notice = {
  id: "info", kind: "info", title: "배송 조회 안내", body: "조회 결과는 저장하지 않아요.",
  startsAt: "2026-09-01T00:00:00+09:00", endsAt: "2026-10-01T00:00:00+09:00", home: true, guideKeys: [], cs: false
};
const DELAY_OLD: Notice = {
  id: "delay-old", kind: "delay", title: "배송 지연 안내", body: "택배사 물량이 많아 하루 늦어질 수 있어요.",
  startsAt: "2026-09-20T00:00:00+09:00", endsAt: "2026-09-30T00:00:00+09:00", home: true, guideKeys: ["inTransit"], cs: false
};
const DELAY_NEW: Notice = { ...DELAY_OLD, id: "delay-new", startsAt: "2026-09-25T00:00:00+09:00" };
const BROKEN: Notice = { ...INFO, id: "broken", startsAt: "not-a-date" };
const ALL: readonly Notice[] = [INFO, HOLIDAY, OUTAGE, DELAY_OLD, DELAY_NEW, BROKEN];

const AT_1405 = new Date("2026-09-26T14:05:00+09:00");
const AT_2230 = new Date("2026-09-26T22:30:00+09:00");
const ids = (notices: readonly Notice[]): readonly string[] => notices.map((notice) => notice.id);

test("priority is outage > delay > holiday > info", () => {
  expect(NOTICE_PRIORITY).toEqual({ outage: 0, delay: 1, holiday: 2, info: 3 });
});

test("home slot sorts by priority, then the latest start; broken dates never show", () => {
  expect(ids(activeNotices(ALL, AT_1405, { kind: "home" }))).toEqual(["delay-new", "delay-old", "holiday", "info"]);
  expect(pickNotice(ALL, AT_2230, { kind: "home" })?.id).toBe("outage");
});

test("windows are half-open in absolute time (22:00–24:00 KST = 13:00–15:00 UTC)", () => {
  expect(ids(activeNotices([OUTAGE], new Date("2026-09-26T12:59:59.999Z"), { kind: "home" }))).toEqual([]);
  expect(ids(activeNotices([OUTAGE], new Date("2026-09-26T13:00:00Z"), { kind: "home" }))).toEqual(["outage"]);
  expect(ids(activeNotices([OUTAGE], new Date("2026-09-26T14:59:59.999Z"), { kind: "home" }))).toEqual(["outage"]);
  expect(ids(activeNotices([OUTAGE], new Date("2026-09-26T15:00:00Z"), { kind: "home" }))).toEqual([]);
});

test("result slots match guide keys", () => {
  expect(ids(activeNotices(ALL, AT_1405, { kind: "result", guideKey: "customsWaiting" }))).toEqual(["holiday"]);
  expect(ids(activeNotices(ALL, AT_2230, { kind: "result", guideKey: "customsWaiting" }))).toEqual(["outage", "holiday"]);
  expect(ids(activeNotices(ALL, AT_1405, { kind: "result", guideKey: "inTransit" }))).toEqual(["delay-new", "delay-old", "holiday"]);
  expect(pickNotice(ALL, AT_1405, { kind: "result", guideKey: "delivered" })).toBeNull();
});

test("loading and waiting-error slots keep only outage notices", () => {
  expect(ids(activeNotices(ALL, AT_1405, { kind: "result", guideKey: "loading" }))).toEqual([]);
  expect(ids(activeNotices(ALL, AT_2230, { kind: "result", guideKey: "loading" }))).toEqual(["outage"]);
  expect(ids(activeNotices(ALL, AT_2230, { kind: "result", guideKey: "temporaryDelay" }))).toEqual(["outage"]);
});

test("cs slot takes only notices marked for CS replies", () => {
  expect(ids(activeNotices(ALL, AT_1405, { kind: "cs" }))).toEqual(["holiday"]);
});

test("the notice view has no window fields and the input list is not reordered", () => {
  expect(toNoticeView(HOLIDAY)).toEqual({ id: "holiday", kind: "holiday", title: HOLIDAY.title, body: HOLIDAY.body });
  activeNotices(ALL, AT_2230, { kind: "home" });
  expect(ids(ALL)).toEqual(["info", "holiday", "outage", "delay-old", "delay-new", "broken"]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/carriers.spec.ts tests/unit/notices.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — import errors for `@/lib/tracking/carriers` and `@/lib/tracking/notices`.

- [ ] **Step 3: Write the implementations**

Create `lib/tracking/carriers.ts`:

```ts
import type { DeliveryCarrierCode } from "@/lib/types";
import type { CarrierView, ConcreteCarrierCode, LookupRequest } from "@/lib/tracking/types";

/** Client-safe twin of lib/delivery-carriers.ts (which imports zod). Parity is tested in tests/unit/carriers.spec.ts. */
export const CONCRETE_CARRIER_CODES: readonly ConcreteCarrierCode[] = ["CJ", "EPOST", "HANJIN", "LOTTE", "LOGEN"];

export const CARRIER_NAMES: Readonly<Record<ConcreteCarrierCode, string>> = {
  CJ: "CJ대한통운",
  EPOST: "우체국택배",
  HANJIN: "한진택배",
  LOTTE: "롯데택배",
  LOGEN: "로젠택배"
};

const TRACKING_URL_BUILDERS: Readonly<Record<ConcreteCarrierCode, (encodedNumber: string) => string>> = {
  CJ: (value) => `https://trace.cjlogistics.com/next/tracking.html?wblNo=${value}`,
  EPOST: (value) => `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?displayHeader=N&sid1=${value}`,
  HANJIN: (value) => `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=${value}`,
  LOTTE: (value) => `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${value}`,
  LOGEN: (value) => `https://www.ilogen.com/web/personal/trace/${value}`
};

const AUTOMATIC_LABEL_PATTERN = /자동\s*(조회|확인)|자동으로/;

export function isConcreteCarrier(code: DeliveryCarrierCode): code is ConcreteCarrierCode {
  return code !== "AUTO";
}

export function carrierOfficialUrl(code: DeliveryCarrierCode, invoiceNumber: string): string | null {
  if (!isConcreteCarrier(code) || invoiceNumber.length === 0) return null;
  return TRACKING_URL_BUILDERS[code](encodeURIComponent(invoiceNumber));
}

/** A customer-facing carrier name, or null. The internal '택배사 자동 확인' is never returned. */
export function carrierDisplayName(rawName: string | null | undefined, code: DeliveryCarrierCode): string | null {
  const name = rawName?.trim() ?? "";
  if (name.length > 0 && !AUTOMATIC_LABEL_PATTERN.test(name)) return name;
  return isConcreteCarrier(code) ? CARRIER_NAMES[code] : null;
}

/** Carrier view before any data exists (loading, errors). `unknownLabel` is the bar suffix while the carrier is unknown. */
export function requestCarrierView(request: LookupRequest, unknownLabel: string): CarrierView {
  const name = isConcreteCarrier(request.carrier) ? CARRIER_NAMES[request.carrier] : null;
  return {
    code: request.carrier,
    name,
    barLabel: name ?? unknownLabel,
    officialUrl: carrierOfficialUrl(request.carrier, request.number)
  };
}
```

Create `lib/tracking/notices.ts`:

```ts
import type { Notice } from "@/lib/config/types";
import type { GuideKey, NoticeKind, NoticeView } from "@/lib/tracking/types";
import { parseInstant } from "@/lib/tracking/time";

export type NoticeSlot =
  | { readonly kind: "home" }
  | { readonly kind: "result"; readonly guideKey: GuideKey }
  | { readonly kind: "cs" };

export const NOTICE_PRIORITY: Readonly<Record<NoticeKind, number>> = { outage: 0, delay: 1, holiday: 2, info: 3 };

/** While a lookup waits or failed for a service reason only outage notices explain anything. */
const OUTAGE_ONLY_KEYS: ReadonlySet<GuideKey> = new Set<GuideKey>(["loading", "temporaryDelay", "offline", "noResponse"]);

function isActive(notice: Notice, nowMs: number): boolean {
  const starts = parseInstant(notice.startsAt);
  const ends = parseInstant(notice.endsAt);
  if (starts === null || ends === null) return false;
  return starts.getTime() <= nowMs && nowMs < ends.getTime();
}

function matchesSlot(notice: Notice, slot: NoticeSlot): boolean {
  switch (slot.kind) {
    case "home":
      return notice.home;
    case "cs":
      return notice.cs;
    case "result":
      if (!notice.guideKeys.includes(slot.guideKey)) return false;
      return !OUTAGE_ONLY_KEYS.has(slot.guideKey) || notice.kind === "outage";
  }
}

function startsAtMs(notice: Notice): number {
  return parseInstant(notice.startsAt)?.getTime() ?? 0;
}

function compareNotices(a: Notice, b: Notice): number {
  const byKind = NOTICE_PRIORITY[a.kind] - NOTICE_PRIORITY[b.kind];
  if (byKind !== 0) return byKind;
  const byStart = startsAtMs(b) - startsAtMs(a);
  if (byStart !== 0) return byStart;
  return a.id.localeCompare(b.id);
}

/** Active at `now` (startsAt ≤ now < endsAt), matching the slot, sorted by priority then latest startsAt. */
export function activeNotices(notices: readonly Notice[], now: Date, slot: NoticeSlot): readonly Notice[] {
  const nowMs = now.getTime();
  return notices.filter((notice) => isActive(notice, nowMs) && matchesSlot(notice, slot)).sort(compareNotices);
}

export function pickNotice(notices: readonly Notice[], now: Date, slot: NoticeSlot): Notice | null {
  return activeNotices(notices, now, slot)[0] ?? null;
}

export function toNoticeView(notice: Notice): NoticeView {
  return { id: notice.id, kind: notice.kind, title: notice.title, body: notice.body };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/carriers.spec.ts tests/unit/notices.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck`
Expected: `12 passed`; typecheck exits 0.

- [ ] **Step 5: Commit**

```powershell
git add lib/tracking/carriers.ts lib/tracking/notices.ts tests/unit/carriers.spec.ts tests/unit/notices.spec.ts; git commit -m "feat: add client-safe carrier names and notice selection"
```

### Task 5: Operator config, its structural schema and the config fixtures

**Files:**
- Create: `config/site.config.ts`
- Create: `lib/config/schema.ts`
- Create: `lib/config/invariants.ts` (only the result-copy slot table in this task; Task 6 adds the rules)
- Create: `tests/fixtures/config-fixtures.ts`
- Test: `tests/unit/config.spec.ts`

**Interfaces:**
- Consumes: all config types (Task 1), `GUIDE_KEYS` (Task 1).
- Produces: `config/site.config.ts` named exports `channels`, `disclosures`, `calendar`, `durations`, `lookup`, `stateGuide`, `glossary`, `help`, `featuredProducts`, `notices`, `ads`, `style`, `resultCopy`, `siteConfig` (each `satisfies` its type); `SiteConfigSchema: z.ZodType<SiteConfig, z.ZodTypeDef, unknown>`, `formatConfigIssues(error: z.ZodError): string` (`lib/config/schema.ts`); `RESULT_COPY_SLOTS: Readonly<Record<keyof ResultCopyConfig, readonly string[]>>` (`lib/config/invariants.ts`; exported because S07 and S08 add their `ResultCopyConfig` fields here — contract addition 2); `FIXTURE_CONFIG: SiteConfig`, `withConfig(patch: DeepPartialConfig): SiteConfig`, `type DeepPartialConfig`, `FIXTURE_HOLIDAYS`, `FIXTURE_NOTICES`, `FIXTURE_FEATURED` (`tests/fixtures/config-fixtures.ts`).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/config.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import {
  calendar, channels, disclosures, durations, featuredProducts, lookup, resultCopy, siteConfig, stateGuide
} from "@/config/site.config";
import { SiteConfigSchema, formatConfigIssues } from "@/lib/config/schema";
import { GUIDE_KEYS } from "@/lib/tracking/types";
import { FIXTURE_CONFIG, withConfig } from "../fixtures/config-fixtures";

function issuesOf(value: unknown): string {
  const result = SiteConfigSchema.safeParse(value);
  return result.success ? "" : formatConfigIssues(result.error);
}

const DISCLOSURE_FALLBACK = "쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.";
const DISCLOSURE_APPROVED = "쿠팡 링크는 쿠팡 파트너스 활동의 일환으로, 구매 시 운영자가 수수료를 받습니다.";
const PENDING_RECHECK_FALLBACK = "정보 반영까지 시간이 걸릴 수 있어 2~3시간 뒤 다시 확인해 주세요.";
const HOLIDAYS_2027 = [
  "2027-01-01", "2027-02-06", "2027-02-07", "2027-02-08", "2027-02-09", "2027-03-01", "2027-05-01", "2027-05-03",
  "2027-05-05", "2027-05-13", "2027-06-06", "2027-07-17", "2027-07-19", "2027-08-15", "2027-08-16", "2027-09-14",
  "2027-09-15", "2027-09-16", "2027-10-03", "2027-10-04", "2027-10-09", "2027-10-11", "2027-12-25", "2027-12-27"
];

test.describe("shipped config", () => {
  test("the shipped config and the fixture config parse without issues", () => {
    expect(issuesOf(siteConfig)).toBe("");
    expect(issuesOf(FIXTURE_CONFIG)).toBe("");
  });

  test("stateGuide has exactly one row per guide key", () => {
    expect(Object.keys(stateGuide).sort()).toEqual([...GUIDE_KEYS].sort());
  });

  test("E2E-locked status and CTA headings keep their wording", () => {
    expect(stateGuide.pending.title).toBe("통관 정보 등록 전");
    expect(stateGuide.inTransit.title).toBe("국내 배송 중");
    expect(stateGuide.delivered.title).toBe("배송 완료");
    expect(stateGuide.pickedUp.title).toBe("{carrier} 기사님 픽업 완료!");
    expect(stateGuide.pending.ctaHeading).toBe("아직 국내 배송 정보가 없어요");
    expect(stateGuide.inTransit.ctaHeading).toBe("배송이 진행 중이에요");
    expect(stateGuide.delivered.ctaHeading).toBe("배송이 완료됐어요");
    expect(stateGuide.invalidNumber.title).toBe("번호 형식이 달라요. 숫자 10~14자리 또는 영문 3~4자+숫자예요.");
  });

  test("ETA labels and texts, journey station names and issue marks are the spec's", () => {
    expect([resultCopy.etaLabel, resultCopy.etaTodayLabel, resultCopy.etaOverdueLabel, resultCopy.etaDeliveredLabel])
      .toEqual(["도착 예상", "오늘 예상", "예상했던 날짜", "배송 완료일"]);
    expect(resultCopy.etaPendingText).toBe("정보 등록 후 안내");
    expect(resultCopy.etaWithheldText).toBe("지금은 도착 예상일을 안내하기 어려워요");
    // S05's JourneySpine draws these names as literals (contract §11.11); history segment titles read them from here,
    // so an edit here would make the two disagree. The spec fixes them; this row keeps both sources equal.
    expect([resultCopy.stationDeparted, resultCopy.stationCustoms, resultCopy.stationDomestic, resultCopy.stationArrived])
      .toEqual(["해외 출발", "입항·통관", "국내 배송", "도착"]);
    expect([resultCopy.issueStopped, resultCopy.issueCut, resultCopy.issueBranch]).toEqual(["멈춤", "끊김", "갈림"]);
  });

  test("lookup copy is the spec's", () => {
    expect(lookup.copy.submit).toBe("조회하기");
    expect(lookup.copy.submitting).toBe("조회 중…");
    expect(lookup.copy.title).toBe("조회하고 있어요");
    expect(lookup.copy.body).toBe("관세청 통관 정보와 택배사 배송 정보를 함께 확인해요");
    expect(lookup.copy.started).toBe("조회를 시작했어요");
    expect(lookup.copy.longWait).toBe("해외 화물은 여러 해의 기록을 찾아서 조금 더 걸려요. 보통 10초 안에 끝나요.");
    expect(lookup.copy.veryLongWait).toBe("기록이 없는 번호는 30초 가까이 걸릴 수 있어요. 번호가 맞는지 한 번 봐 주세요.");
    expect(lookup.copy.elapsed).toBe("{seconds}초째");
    expect(lookup.copy.cancel).toBe("조회 취소");
    expect(lookup.copy.carrierOfficialFirst).toBe("택배사 공식 조회로 먼저 보기");
    expect(lookup.copy.formatHint).toBe(
      "숫자 10~14자리 (예: 0000 0000 0000) · 영문 3~4자로 시작하는 HBL (예: ABCD 0000 0000) · 공백·하이픈은 자동으로 빼요"
    );
    expect(lookup.copy.numberFinderSummary).toBe("번호는 어디서 찾나요?");
    expect(lookup.copy.numberFinderItems).toEqual(["네이버 주문상세 → 배송조회", "쿠팡 주문목록 → 배송조회", "톡톡 출고 안내문"]);
    expect(lookup.copy.carrierAuto).toBe("택배사 자동 확인");
    expect(lookup.copy.typicalSummary).toBe("보통 이렇게 걸려요");
  });

  test("lookup timing is the pre-R4 set or the R4 set, and the NOT_FOUND caveat follows it", () => {
    expect(lookup.skeletonDelayMs).toBe(400);
    expect(lookup.spinnerStopMs).toBe(5000);
    expect(lookup.elapsedStepSeconds).toBe(5);
    expect(lookup.rateLimitCooldownSeconds).toBe(10);
    expect(lookup.stageMs[0]).toBe(3000);
    expect([45000, 25000]).toContain(lookup.timeoutMs);
    expect(lookup.notFoundServiceCaveat).toBe(lookup.timeoutMs === 45000);
  });

  test("channels keep the current 톡톡 and store links and the spec labels", () => {
    expect(channels.talk.url).toBe("https://talk.naver.com/ct/w41rsr");
    expect(channels.talk.labels).toEqual({
      header: "문의", shortcut: "톡톡 상담", cta: "톡톡으로 문의하기", copyAndTalk: "문의 내용 복사하고 톡톡 열기", footer: "톡톡 상담"
    });
    expect(channels.naver.urls.showcase).toBe("https://mkt.shopping.naver.com/link/6a0bbf9cc55d142f0519328c");
    expect(channels.coupang.urls.showcase).toBe("https://link.coupang.com/a/d7TbzdnS1s");
    expect([channels.naver.isAffiliate, channels.coupang.isAffiliate]).toEqual([false, true]);
    expect([channels.naver.linkLabel, channels.coupang.linkLabel]).toEqual(["네이버 스토어 보기", "쿠팡 스토어 보기"]);
  });

  test("the disclosure is the current wording until approval 9, then the approved wording", () => {
    expect([DISCLOSURE_FALLBACK, DISCLOSURE_APPROVED]).toContain(disclosures.coupang);
  });

  test("the pending recheck sentence is the current one until approval 4", () => {
    expect(durations.pendingRecheck).toBe(PENDING_RECHECK_FALLBACK);
  });

  test("durations use the §17 Q1 defaults", () => {
    expect(durations.stages).toEqual({
      visibleAfterDeparture: { min: 3, max: 7 }, customs: { min: 1, max: 2 },
      handoffBusinessDays: { min: 0, max: 1 }, domestic: { min: 1, max: 2 }
    });
    expect(durations.worry).toEqual({
      afterEstimateBusinessDays: 1, afterClearanceBusinessDays: 2, notFoundDays: 7, pendingDays: 10, undeliveredHours: 24
    });
    expect(durations.staleDays).toBe(14);
    expect(durations.typical.map((row) => row.station)).toEqual(["departed", "customs", "domestic", "arrived"]);
  });

  test("calendar: KST, no Saturday delivery, the verified 2026 and 2027 holidays", () => {
    expect(calendar.timeZone).toBe("Asia/Seoul");
    expect(calendar.carrierDeliversSaturday).toBe(false);
    const byId = new Map(calendar.holidays.map((period) => [period.id, period]));
    expect(byId.get("2026-chuseok")?.dates).toEqual(["2026-09-24", "2026-09-25", "2026-09-26"]);
    expect(byId.get("2026-chuseok")?.badge).toBe("추석 연휴 영향 · 1~2일 늦어질 수 있어요");
    expect(byId.get("2026-foundation-day")?.dates).toEqual(["2026-10-03", "2026-10-05"]);
    expect(byId.get("2026-hangul-day")?.dates).toEqual(["2026-10-09"]);
    expect(calendar.holidays.flatMap((period) => period.dates).filter((date) => date.startsWith("2027-"))).toEqual(HOLIDAYS_2027);
    const all = calendar.holidays.flatMap((period) => period.dates);
    expect(new Set(all).size).toBe(all.length);
  });

  test("ads and style defaults", () => {
    expect(siteConfig.ads).toEqual({ manualSlotId: null, minHeightMobilePx: 280, minHeightDesktopPx: 250, anchorReservePx: 64 });
    expect(siteConfig.style.followSystemDark).toBe(true);
  });

  test("featured products carry no unverified prices", () => {
    // S03 ships store-home links and no prices. S08 Task 10 (approval 10) may add product-detail links with a price and its
    // check time; a price on a store-home link or without a check time stays forbidden, so that follow-up needs no edit here.
    const storeHomes = new Set<string>([...Object.values(channels.naver.urls), ...Object.values(channels.coupang.urls)]);
    const unverified = featuredProducts.filter(
      (item) => item.priceLabel !== null && (item.priceCheckedAt === null || storeHomes.has(item.href))
    );
    expect(unverified.map((item) => item.id)).toEqual([]);
  });
});

test.describe("fixture config", () => {
  test("withConfig merges objects deeply and replaces arrays", () => {
    const patched = withConfig({ durations: { staleDays: 15 }, notices: [] });
    expect(patched.durations.staleDays).toBe(15);
    expect(patched.durations.worry).toEqual(FIXTURE_CONFIG.durations.worry);
    expect(patched.notices).toEqual([]);
    expect(FIXTURE_CONFIG.durations.staleDays).toBe(14);
  });

  test("fixture notices, holidays and featured items are deterministic", () => {
    expect(FIXTURE_CONFIG.notices.map((notice) => notice.id)).toEqual(["fx-holiday", "fx-outage", "fx-info", "fx-expired"]);
    expect(FIXTURE_CONFIG.calendar.holidays.map((period) => period.id)).toEqual([
      "2026-chuseok", "2026-foundation-day", "2026-hangul-day", "2026-christmas", "2027-seollal"
    ]);
    expect(FIXTURE_CONFIG.featuredProducts.map((item) => item.id)).toEqual(["fx-weekly-mount", "fx-month-case"]);
  });
});

test.describe("Korean issue lines", () => {
  test("a wrong type names the path and the expected type", () => {
    const broken = withConfig({ durations: { staleDays: "14" as unknown as number } });
    expect(issuesOf(broken)).toContain("durations.staleDays: 숫자 형식이어야 합니다");
  });

  test("an unknown top-level key is reported for the whole config", () => {
    expect(issuesOf({ ...FIXTURE_CONFIG, extra: true })).toContain("(설정 전체): 알 수 없는 항목입니다: extra");
  });

  test("a bad enum value lists the allowed values", () => {
    const broken = withConfig({ stateGuide: { stale: { tone: "red" as unknown as "attention" } } });
    expect(issuesOf(broken)).toContain(
      "stateGuide.stale.tone: 허용되지 않은 값입니다(가능한 값: neutral, progress, waiting, attention, problem, done)"
    );
  });

  test("a notice time without +09:00 is rejected", () => {
    const broken = withConfig({ notices: [{ ...FIXTURE_CONFIG.notices[0], startsAt: "2026-09-21T00:00:00Z" }] });
    expect(issuesOf(broken)).toContain("notices[0].startsAt: 시각은 2026-09-26T14:05:00+09:00처럼 +09:00을 붙여 씁니다");
  });

  test("an impossible holiday date is rejected", () => {
    const broken = withConfig({
      calendar: { holidays: [{ id: "x", name: "없는 날", dates: ["2026-02-30"], badge: "없는 날 영향 · 1일 늦어질 수 있어요" }] }
    });
    expect(issuesOf(broken)).toContain("calendar.holidays[0].dates[0]: 날짜는 2026-09-24처럼 있는 날짜를 YYYY-MM-DD로 씁니다");
  });

  test("a blank required text is rejected", () => {
    expect(issuesOf(withConfig({ resultCopy: { etaLabel: " " } }))).toContain("resultCopy.etaLabel: 빈 문구입니다");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/config.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — import errors for `@/config/site.config`, `@/lib/config/schema` and `../fixtures/config-fixtures`.

- [ ] **Step 3: Check the holiday list against the official calendar before typing it**

Open the 2027 월력요항 (우주항공청 보도자료 2026-06-29, `https://www.kasa.go.kr` → 정책브리핑 → '2027년 월력요항'; the same table is on 한국천문연구원 천문우주지식정보 `https://astro.kasi.re.kr` → 생활천문관 → 월력요항) and the 2026 월력요항, plus the 2026 amendments of 「공휴일에 관한 법률」 on `https://www.law.go.kr` (노동절 public holiday from 2026-05-01; 제헌절 public holiday with substitute days from 2026-05-11). Compare them with the table below, which Step 4 types into `calendar.holidays` (substitute days in bold):

| Year | Holidays (YYYY-MM-DD) |
|---|---|
| 2026 | 신정 01-01 · 설 02-16, 02-17, 02-18 · 삼일절 03-01, **03-02** · 노동절 05-01 · 어린이날 05-05 · 부처님오신날 05-24, **05-25** · 지방선거일 06-03 · 현충일 06-06 · 제헌절 07-17 · 광복절 08-15, **08-17** · 추석 09-24, 09-25, 09-26 · 개천절 10-03, **10-05** · 한글날 10-09 · 성탄절 12-25 |
| 2027 | 신정 01-01 · 설 02-06, 02-07, 02-08, **02-09** · 삼일절 03-01 · 노동절 05-01, **05-03** · 어린이날 05-05 · 부처님오신날 05-13 · 현충일 06-06 · 제헌절 07-17, **07-19** · 광복절 08-15, **08-16** · 추석 09-14, 09-15, 09-16 · 개천절 10-03, **10-04** · 한글날 10-09, **10-11** · 성탄절 12-25, **12-27** |

Expected: every date matches (2027 check: 15 weekday holidays + 104 weekend days = the published "주 5일제 휴일 119일"). If a date differs, use the official date in Step 4 and in `HOLIDAYS_2027` of Step 1, and note the correction in the stage summary.

- [ ] **Step 4: Write the operator config**

Create `config/site.config.ts`:

```ts
/**
 * 운영 설정 — tracking.tipoasis.com
 *
 * 공지·연휴·채널 링크·제휴 고지·추천 상품·상태 문구를 이 파일 한 곳에서 바꿉니다. 코드는 고치지 않습니다.
 * 바꾸는 순서와 예시는 DEPLOYMENT.md의 '운영 설정 바꾸기'에 있습니다.
 * 저장하면 빌드가 lib/config/schema.ts로 이 파일을 검사하고, 규칙에 어긋나면 한국어 오류 줄과 함께 배포가 멈춥니다.
 *
 * 꼭 지킬 것
 * - 실제 고객 번호(10자리 이상 숫자, 영문 3~4자+숫자 형식의 HBL 번호)는 어떤 문구에도 넣지 않습니다. 예시는 0만 씁니다.
 * - 'AI·인공지능·로봇·봇' 표현은 쓰지 않습니다.
 * - 이 파일은 형식 선언(import type)만 불러옵니다. 브라우저 코드가 필요한 부분만 가져다 씁니다.
 */
import type {
  AdsConfig, CalendarConfig, ChannelsConfig, DisclosuresConfig, DurationsConfig, FeaturedItem, GlossaryEntry, GuideRow,
  HelpEntry, LookupConfig, Notice, ResultCopyConfig, SiteConfig, StyleConfig
} from "@/lib/config/types";
import type { GuideKey } from "@/lib/tracking/types";

// 스토어 홈 주소. 파트너 대시보드에서 배치별 링크를 따로 만들면 channels.*.urls의 해당 배치만 바꿉니다.
const NAVER_STORE_HOME = "https://mkt.shopping.naver.com/link/6a0bbf9cc55d142f0519328c";
const COUPANG_STORE_HOME = "https://link.coupang.com/a/d7TbzdnS1s";

/** 1) 채널 — 톡톡 상담 주소와 라벨, 네이버·쿠팡 스토어(배치별 링크), 허용 호스트(https만 씁니다) */
export const channels = {
  talk: {
    url: "https://talk.naver.com/ct/w41rsr",
    labels: {
      header: "문의",
      shortcut: "톡톡 상담",
      cta: "톡톡으로 문의하기",
      copyAndTalk: "문의 내용 복사하고 톡톡 열기",
      footer: "톡톡 상담"
    }
  },
  naver: {
    name: "네이버 스토어",
    linkLabel: "네이버 스토어 보기",
    isAffiliate: false,
    // 배치: shortcut 홈 바로가기 행, showcase 홈 쇼케이스, pending 국내 도착 전 구매처 선택지(승인 4), deliveredLead 배송 완료 선두
    urls: { shortcut: NAVER_STORE_HOME, showcase: NAVER_STORE_HOME, pending: NAVER_STORE_HOME, deliveredLead: NAVER_STORE_HOME }
  },
  coupang: {
    name: "쿠팡 스토어",
    linkLabel: "쿠팡 스토어 보기",
    isAffiliate: true, // true면 링크에 rel="sponsored nofollow"와 아래 고지 문구가 자동으로 붙습니다
    urls: { shortcut: COUPANG_STORE_HOME, showcase: COUPANG_STORE_HOME, pending: COUPANG_STORE_HOME, deliveredLead: COUPANG_STORE_HOME }
  },
  // 링크에 쓸 수 있는 호스트. 새 주소를 쓰려면 여기에도 추가합니다.
  allowedHosts: ["talk.naver.com", "mkt.shopping.naver.com", "smartstore.naver.com", "link.coupang.com", "www.coupang.com"]
} satisfies ChannelsConfig;

/** 2) 제휴 고지 — 제휴 링크 묶음의 첫 줄에 자동으로 붙습니다. 확정형 문언은 승인 9(법무 확인) 뒤에 바꿉니다. */
export const disclosures = {
  coupang: "쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다."
} satisfies DisclosuresConfig;

/**
 * 3) 달력 — 한국 시간, 공휴일(대체공휴일 포함), 택배 토요일 배송 여부.
 * 매년 6월 말 발표되는 다음 해 월력요항을 보고 추가합니다. 앞으로 60일 안에 공휴일 정보가 없는 해가 있으면 빌드가 경고합니다.
 * badge는 도착 예상 옆에 붙는 문구입니다(연휴가 계산 구간과 겹치면 D-표기와 '오늘 예상'을 숨깁니다).
 */
export const calendar = {
  timeZone: "Asia/Seoul",
  carrierDeliversSaturday: false, // 택배 토요일 배송을 걱정 기준일 계산에 넣으려면 true
  holidays: [
    { id: "2026-new-year", name: "신정", dates: ["2026-01-01"], badge: "신정 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-seollal", name: "설 연휴", dates: ["2026-02-16", "2026-02-17", "2026-02-18"], badge: "설 연휴 영향 · 1~2일 늦어질 수 있어요" },
    { id: "2026-independence-day", name: "삼일절", dates: ["2026-03-01", "2026-03-02"], badge: "삼일절 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-labor-day", name: "노동절", dates: ["2026-05-01"], badge: "노동절 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-childrens-day", name: "어린이날", dates: ["2026-05-05"], badge: "어린이날 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-buddhas-birthday", name: "부처님오신날", dates: ["2026-05-24", "2026-05-25"], badge: "부처님오신날 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-local-election", name: "지방선거일", dates: ["2026-06-03"], badge: "지방선거일 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-memorial-day", name: "현충일", dates: ["2026-06-06"], badge: "현충일 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-constitution-day", name: "제헌절", dates: ["2026-07-17"], badge: "제헌절 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-liberation-day", name: "광복절", dates: ["2026-08-15", "2026-08-17"], badge: "광복절 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-chuseok", name: "추석 연휴", dates: ["2026-09-24", "2026-09-25", "2026-09-26"], badge: "추석 연휴 영향 · 1~2일 늦어질 수 있어요" },
    { id: "2026-foundation-day", name: "개천절", dates: ["2026-10-03", "2026-10-05"], badge: "개천절 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-hangul-day", name: "한글날", dates: ["2026-10-09"], badge: "한글날 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-christmas", name: "성탄절", dates: ["2026-12-25"], badge: "성탄절 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-new-year", name: "신정", dates: ["2027-01-01"], badge: "신정 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-seollal", name: "설 연휴", dates: ["2027-02-06", "2027-02-07", "2027-02-08", "2027-02-09"], badge: "설 연휴 영향 · 1~2일 늦어질 수 있어요" },
    { id: "2027-independence-day", name: "삼일절", dates: ["2027-03-01"], badge: "삼일절 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-labor-day", name: "노동절", dates: ["2027-05-01", "2027-05-03"], badge: "노동절 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-childrens-day", name: "어린이날", dates: ["2027-05-05"], badge: "어린이날 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-buddhas-birthday", name: "부처님오신날", dates: ["2027-05-13"], badge: "부처님오신날 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-memorial-day", name: "현충일", dates: ["2027-06-06"], badge: "현충일 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-constitution-day", name: "제헌절", dates: ["2027-07-17", "2027-07-19"], badge: "제헌절 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-liberation-day", name: "광복절", dates: ["2027-08-15", "2027-08-16"], badge: "광복절 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-chuseok", name: "추석 연휴", dates: ["2027-09-14", "2027-09-15", "2027-09-16"], badge: "추석 연휴 영향 · 1~2일 늦어질 수 있어요" },
    { id: "2027-foundation-day", name: "개천절", dates: ["2027-10-03", "2027-10-04"], badge: "개천절 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-hangul-day", name: "한글날", dates: ["2027-10-09", "2027-10-11"], badge: "한글날 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-christmas", name: "성탄절", dates: ["2027-12-25", "2027-12-27"], badge: "성탄절 영향 · 1일 늦어질 수 있어요" }
  ]
} satisfies CalendarConfig;

/**
 * 4) 소요 기간과 걱정 기준 — 운영자 확인(§17 Q1) 전까지 현재 코드 상수를 씁니다. 4주마다 문의 분류를 보고 조정합니다.
 * 걱정 기준일 = 예상일 뒤 영업일(연휴·주말 제외). 문구 속 일수(7일, 10일, 3~7일)는 아래 값과 같아야 빌드가 통과합니다.
 */
export const durations = {
  stages: {
    visibleAfterDeparture: { min: 3, max: 7 }, // 해외 출고 뒤 HBL이 조회되기까지(일)
    customs: { min: 1, max: 2 },               // 입항 뒤 통관까지(일)
    handoffBusinessDays: { min: 0, max: 1 },   // 통관 완료 뒤 택배사 인계(영업일)
    domestic: { min: 1, max: 2 }               // 국내 배송(일)
  },
  // '보통 이렇게 걸려요' 펼침에 보이는 네 줄
  typical: [
    { station: "departed", text: "해외 출고 후 조회되기까지 보통 3~7일" },
    { station: "customs", text: "입항 후 통관까지 보통 1~2일" },
    { station: "domestic", text: "택배사 인계 0~1영업일, 국내 배송 보통 1~2일" },
    { station: "arrived", text: "배송이 끝나면 택배사 문자로 알려 드려요" }
  ],
  worry: {
    afterEstimateBusinessDays: 1,  // 통관 대기·배송 중: 예상일 + 1영업일까지 그대로면 문의 안내
    afterClearanceBusinessDays: 2, // 통관 완료·인계: 마지막 진행일 + 2영업일
    notFoundDays: 7,               // 결과 없음: 출고 안내 후 7일
    pendingDays: 10,               // 국내 도착 전: 출고 안내 후 10일
    undeliveredHours: 24           // 배송 완료인데 못 받았을 때: 24시간
  },
  staleDays: 14, // 서버 기준(14일)과 같아야 합니다. 다르면 빌드가 멈춥니다.
  // 국내 도착 전 재확인 문장(승인 4 전까지 현행 유지)
  pendingRecheck: "정보 반영까지 시간이 걸릴 수 있어 2~3시간 뒤 다시 확인해 주세요."
} satisfies DurationsConfig;

/**
 * 5) 조회 중 표시 — 시간에 따른 문구와 제한 시간.
 * timeoutMs·notFoundServiceCaveat·stageMs는 서버 개선(승인 5) 배포 뒤 S10이 25초·false·다시 맞춘 값으로 바꿉니다.
 */
export const lookup = {
  skeletonDelayMs: 400,      // 이 시간 안에 끝나면 스켈레톤 없이 결과
  stageMs: [3000, 8000],     // 3초: '조금 더 걸려요' + [조회 취소], 8초: '기록이 없는 번호는…' + 경과 시간
  spinnerStopMs: 5000,       // 스피너는 5초 뒤 멈춥니다
  elapsedStepSeconds: 5,     // 경과 표시 갱신 간격(초)
  timeoutMs: 45000,          // 클라이언트 제한 시간(서버 개선 전 45초)
  rateLimitCooldownSeconds: 10,
  notFoundServiceCaveat: true, // 결과 없음 카드의 '조회 서비스 사정으로…' 보조 줄
  copy: {
    submit: "조회하기",
    submitting: "조회 중…",
    title: "조회하고 있어요",
    body: "관세청 통관 정보와 택배사 배송 정보를 함께 확인해요",
    started: "조회를 시작했어요",
    longWait: "해외 화물은 여러 해의 기록을 찾아서 조금 더 걸려요. 보통 10초 안에 끝나요.",
    veryLongWait: "기록이 없는 번호는 30초 가까이 걸릴 수 있어요. 번호가 맞는지 한 번 봐 주세요.",
    elapsed: "{seconds}초째",
    cancel: "조회 취소",
    carrierOfficialFirst: "택배사 공식 조회로 먼저 보기",
    formatHint: "숫자 10~14자리 (예: 0000 0000 0000) · 영문 3~4자로 시작하는 HBL (예: ABCD 0000 0000) · 공백·하이픈은 자동으로 빼요",
    numberFinderSummary: "번호는 어디서 찾나요?",
    numberFinderItems: ["네이버 주문상세 → 배송조회", "쿠팡 주문목록 → 배송조회", "톡톡 출고 안내문"],
    carrierAuto: "택배사 자동 확인",
    typicalSummary: "보통 이렇게 걸려요"
  }
} satisfies LookupConfig;

/**
 * 6) 상태 안내 표 — 상태마다 톤, 칩, 제목(h2), 이유, 지금 할 일, 걱정 기준 문장, 주 행동, 문의·스토어·추천·광고 자리, 도착 예상 방식.
 * 문구에 쓸 수 있는 토큰: {etaDate} {worryDate} {lastEventDate} {carrier} {staleDays}
 * 불변식(빌드가 검사): 문제 상태는 스토어·추천·광고 0, 배송 중은 스토어 0, 배송 완료는 스토어 선두, 국내 도착 전은 문의 + 구매처.
 * overdueTitle은 걱정 기준일이 지났을 때의 제목이며 통관·배송 진행 상태 여섯 곳에만 씁니다.
 */
export const stateGuide = {
  idle: {
    tone: "neutral", chip: null, docTitle: "통관·배송 조회",
    title: "통관부터 국내 배송까지 한 번에 확인", overdueTitle: null,
    reason: "운송장 번호나 HBL 번호를 넣으면 지금 위치, 도착 예정일, 지금 할 일을 알려 드려요.",
    ctaHeading: null, nextAction: "번호를 넣고 조회하기를 눌러 주세요.", worry: null,
    primaryAction: "submit", inquiryLevel: "shortcutRow", revenueTier: "quiet", stores: "shortcutRow", recommendations: "none", etaMode: "none"
  },
  loading: {
    tone: "neutral", chip: null, docTitle: "조회 중",
    title: "조회하고 있어요", overdueTitle: null,
    reason: "관세청 통관 정보와 택배사 배송 정보를 함께 확인해요",
    ctaHeading: null, nextAction: "잠시만 기다려 주세요.", worry: null,
    primaryAction: "none", inquiryLevel: "header", revenueTier: "none", stores: "none", recommendations: "none", etaMode: "none"
  },
  invalidNumber: {
    tone: "attention", chip: "번호 확인", docTitle: "번호 형식 확인",
    title: "번호 형식이 달라요. 숫자 10~14자리 또는 영문 3~4자+숫자예요.", overdueTitle: null,
    reason: null,
    ctaHeading: "조회가 잘되지 않나요?", nextAction: "번호를 모르시면 주문 안내 문자나 톡톡으로 확인해 드려요", worry: null,
    primaryAction: "fixNumber", inquiryLevel: "blockFirstLink", revenueTier: "none", stores: "none", recommendations: "none", etaMode: "none"
  },
  notFound: {
    tone: "attention", chip: "조회 결과 없음", docTitle: "조회 결과 없음",
    title: "아직 조회되는 정보가 없어요", overdueTitle: null,
    reason: "이 번호가 주문내역과 같나요? 같다면 아직 한국 도착 전일 수 있어요. 보통 해외 출고 후 3~7일 뒤부터 조회돼요.",
    ctaHeading: "조회가 잘되지 않나요?", nextAction: "번호가 주문내역과 같은지 먼저 확인해 주세요.",
    worry: "출고 안내를 받은 지 7일이 지나도 조회되지 않으면 번호를 보내 주세요",
    primaryAction: "fixNumber", inquiryLevel: "blockFirstLink", revenueTier: "none", stores: "none", recommendations: "none", etaMode: "none"
  },
  temporaryDelay: {
    tone: "attention", chip: "조회 지연", docTitle: "조회 지연",
    title: "조회가 잠시 지연되고 있어요", overdueTitle: null,
    reason: "번호 문제는 아니에요.",
    ctaHeading: "조회가 잘되지 않나요?", nextAction: "잠시 뒤 다시 조회해 주세요. 두 번 이상 안 되면 알려 주세요.", worry: null,
    primaryAction: "retry", inquiryLevel: "blockFirstLink", revenueTier: "none", stores: "none", recommendations: "none", etaMode: "none"
  },
  offline: {
    tone: "attention", chip: "연결 끊김", docTitle: "인터넷 연결 끊김",
    title: "인터넷 연결이 끊겼어요", overdueTitle: null,
    reason: "연결이 돌아오면 한 번 자동으로 다시 조회해요.",
    ctaHeading: "조회가 잘되지 않나요?", nextAction: "와이파이나 데이터 연결을 확인해 주세요.", worry: null,
    primaryAction: "retry", inquiryLevel: "blockFirstLink", revenueTier: "none", stores: "none", recommendations: "none", etaMode: "none"
  },
  noResponse: {
    tone: "attention", chip: "응답 없음", docTitle: "응답 없음",
    title: "응답이 너무 오래 걸려 조회를 멈췄어요", overdueTitle: null,
    reason: "번호가 주문내역과 같은지 확인해 주세요. 맞다면 잠시 뒤 다시 조회해 주세요.",
    ctaHeading: "조회가 잘되지 않나요?", nextAction: "계속 안 되면 톡톡으로 알려 주세요.", worry: null,
    primaryAction: "retry", inquiryLevel: "blockFirstLink", revenueTier: "none", stores: "none", recommendations: "none", etaMode: "none"
  },
  serverError: {
    tone: "problem", chip: "조회 오류", docTitle: "조회 오류",
    title: "일시적인 오류로 조회하지 못했어요", overdueTitle: null,
    reason: "번호 문제는 아니에요. 번호를 보내 주시면 확인해 드려요.",
    ctaHeading: "조회가 잘되지 않나요?", nextAction: "문의 내용을 복사해 톡톡으로 보내 주세요.", worry: null,
    primaryAction: "copyAndTalk", inquiryLevel: "primary", revenueTier: "none", stores: "none", recommendations: "none", etaMode: "none"
  },
  pending: {
    tone: "waiting", chip: "국내 도착 전", docTitle: "통관 정보 등록 전",
    title: "통관 정보 등록 전", overdueTitle: null,
    reason: "아직 국내 도착·통관 기록이 없어요. 해외에서 출발한 직후이거나 번호가 다를 수 있어요.",
    ctaHeading: "아직 국내 배송 정보가 없어요", nextAction: "이 번호가 주문내역의 운송장 번호와 같나요?",
    worry: "출고 안내 후 10일이 지나도 이 화면이면 알려 주세요",
    primaryAction: "fixNumber", inquiryLevel: "ctaButton", revenueTier: "quiet", stores: "purchaseChoices", recommendations: "inline", etaMode: "pendingInfo"
  },
  customsArrived: {
    tone: "progress", chip: "통관 준비", docTitle: "통관 준비 중",
    title: "한국에 도착해 통관을 준비하고 있어요",
    overdueTitle: "{worryDate}이 지났는데 아직 통관이 시작되지 않았어요",
    reason: "입항 신고가 끝나면 세관 접수와 심사가 이어져요.",
    ctaHeading: "지금 할 일", nextAction: "지금은 하실 일이 없어요. 통관이 시작되면 순서대로 진행돼요.",
    worry: "{worryDate}까지 그대로면 알려 주세요",
    primaryAction: "none", inquiryLevel: "worryLink", revenueTier: "quiet", stores: "none", recommendations: "optional", etaMode: "estimate"
  },
  customsWaiting: {
    tone: "progress", chip: "통관 대기", docTitle: "통관 대기 중",
    title: "통관 순서를 기다리고 있어요",
    overdueTitle: "{worryDate}이 지났는데 아직 통관이 끝나지 않았어요",
    reason: "세관 접수가 끝났고 순서대로 심사가 진행돼요.",
    ctaHeading: "지금 할 일", nextAction: "지금은 하실 일이 없어요. 통관이 끝나면 택배사로 넘어가요.",
    worry: "{worryDate}까지 그대로면 알려 주세요",
    primaryAction: "none", inquiryLevel: "worryLink", revenueTier: "quiet", stores: "none", recommendations: "optional", etaMode: "estimate"
  },
  customsCleared: {
    tone: "progress", chip: "통관 완료", docTitle: "통관 완료",
    title: "통관이 끝났어요",
    overdueTitle: "{worryDate}이 지났는데 아직 택배사로 넘어가지 않았어요",
    reason: "세관 처리가 끝나 국내 택배사로 넘어갈 차례예요.",
    ctaHeading: "지금 할 일", nextAction: "지금은 하실 일이 없어요. 택배사로 넘어가면 운송장 문자가 와요.",
    worry: "{worryDate}까지 소식이 없으면 알려 주세요",
    primaryAction: "none", inquiryLevel: "worryLink", revenueTier: "quiet", stores: "none", recommendations: "optional", etaMode: "estimate"
  },
  handedToCarrier: {
    tone: "progress", chip: "국내 배송", docTitle: "택배사 인계",
    title: "택배사에 넘어갔어요",
    overdueTitle: "{worryDate}이 지났는데 아직 배송이 시작되지 않았어요",
    reason: "{carrier}에서 배송을 준비하고 있어요.",
    ctaHeading: "지금 할 일", nextAction: "배송이 시작되면 택배사 문자가 와요. 지금 위치는 택배사 조회에서 볼 수 있어요.",
    worry: "{worryDate}까지 소식이 없으면 알려 주세요",
    primaryAction: "carrierOfficial", inquiryLevel: "worryLink", revenueTier: "quiet", stores: "none", recommendations: "optional", etaMode: "estimate"
  },
  pickedUp: {
    tone: "progress", chip: "국내 배송", docTitle: "기사님 픽업 완료",
    title: "{carrier} 기사님 픽업 완료!",
    overdueTitle: "{worryDate}이 지났는데 아직 배송이 시작되지 않았어요",
    reason: "{carrier} 기사님이 상품을 인수해 배송 출발을 준비하고 있어요.",
    ctaHeading: "지금 할 일", nextAction: "배송이 시작되면 택배사 조회에서 위치를 볼 수 있어요.",
    worry: "{worryDate}까지 소식이 없으면 알려 주세요",
    primaryAction: "carrierOfficial", inquiryLevel: "worryLink", revenueTier: "quiet", stores: "none", recommendations: "optional", etaMode: "estimate"
  },
  inTransit: {
    tone: "progress", chip: "국내 배송", docTitle: "국내 배송 중",
    title: "국내 배송 중",
    overdueTitle: "{worryDate}이 지났는데 아직 배송이 끝나지 않았어요",
    reason: "택배사가 주소지로 배송하고 있어요.",
    ctaHeading: "배송이 진행 중이에요", nextAction: "정확한 도착 시간은 택배사 문자나 실시간 조회에서 볼 수 있어요.",
    worry: "{worryDate}까지 안 오면 알려 주세요",
    primaryAction: "carrierOfficial", inquiryLevel: "textLink", revenueTier: "quiet", stores: "none", recommendations: "inline", etaMode: "estimate"
  },
  delivered: {
    tone: "done", chip: "도착", docTitle: "배송 완료",
    title: "배송 완료", overdueTitle: null,
    reason: null,
    ctaHeading: "배송이 완료됐어요", nextAction: "받지 못하셨다면 문 앞·경비실·택배함을 먼저 확인해 주세요.", worry: null,
    primaryAction: "storeLead", inquiryLevel: "afterStores", revenueTier: "lead", stores: "ctaLead", recommendations: "inline", etaMode: "deliveredOn"
  },
  stale: {
    tone: "attention", chip: "확인 필요", docTitle: "배송 이력 확인 필요",
    title: "{staleDays}일 넘게 새 소식이 없어요", overdueTitle: null,
    reason: "마지막 처리는 {lastEventDate}이에요. 보통은 1~2일 안에 다음 단계로 넘어가요.",
    ctaHeading: "지금 할 일", nextAction: "확인이 필요해요. 문의 내용을 복사해 톡톡으로 보내 주세요.", worry: null,
    primaryAction: "copyAndTalk", inquiryLevel: "primary", revenueTier: "none", stores: "none", recommendations: "none", etaMode: "withheld"
  },
  lookupUnavailable: {
    tone: "attention", chip: "택배사 조회 지연", docTitle: "택배사 조회 지연",
    title: "택배사 조회가 잠시 늦어지고 있어요", overdueTitle: null,
    reason: "택배사 응답이 늦어 최신 배송 정보를 불러오지 못했어요. 번호 문제는 아니에요.",
    ctaHeading: "지금 할 일", nextAction: "{carrier} 공식 조회에서 바로 확인할 수 있어요.", worry: null,
    primaryAction: "carrierOfficial", inquiryLevel: "textLink", revenueTier: "none", stores: "none", recommendations: "none", etaMode: "none"
  },
  ambiguous: {
    tone: "attention", chip: "택배사 선택", docTitle: "택배사 선택 필요",
    title: "받으실 택배사를 골라 주세요", overdueTitle: null,
    reason: "같은 번호가 여러 택배사에 있어요.",
    ctaHeading: "택배사 선택", nextAction: "주문 안내 문자에 택배사 이름이 있어요. 고르시면 바로 다시 조회해요.", worry: null,
    primaryAction: "chooseCarrier", inquiryLevel: "textLink", revenueTier: "none", stores: "none", recommendations: "none", etaMode: "none"
  }
} satisfies Readonly<Record<GuideKey, GuideRow>>;

/** 7) 용어 풀이 — 세관·택배사 원문을 고객 말로 바꿉니다. 원문은 작게 함께 보입니다. */
export const glossary = [
  { source: "반입신고", label: "보세창고 도착" },
  { source: "통관목록접수", label: "통관 접수" },
  { source: "통관목록심사", label: "통관 심사" },
  { source: "통관목록심사완료", label: "통관 심사 완료" },
  { source: "수입신고", label: "수입 신고" },
  { source: "수입신고수리", label: "통관 완료" },
  { source: "반출신고", label: "보세창고 출고" },
  { source: "집화처리", label: "기사님 픽업" },
  { source: "간선상차", label: "터미널 출발" },
  { source: "간선하차", label: "지역 터미널 도착" },
  { source: "배송출발", label: "배송 출발" },
  { source: "배달출발", label: "배송 출발" },
  { source: "배송완료", label: "배송 완료" },
  { source: "배달완료", label: "배송 완료" }
] satisfies readonly GlossaryEntry[];

/** 8) 도움말 펼침 — showIn 상태에서 보이고, openIn 상태에서는 처음부터 펼쳐져 있습니다. */
export const help = [
  {
    id: "pre-arrival", summary: "입항 전 화물이 조회되지 않는 이유",
    body: ["해외에서 출고된 화물은 한국에 도착해 입항 신고가 끝나야 조회돼요.", "보통 해외 출고 후 3~7일 뒤부터 조회돼요."],
    showIn: ["notFound", "pending"], openIn: []
  },
  {
    id: "order-check", summary: "주문내역에서 확인",
    body: ["네이버: 주문상세 → 배송조회에서 같은 번호를 볼 수 있어요.", "쿠팡: 주문목록 → 배송조회에서 볼 수 있어요.", "톡톡 출고 안내문에도 번호와 택배사가 있어요."],
    showIn: ["pending", "notFound"], openIn: []
  },
  {
    id: "customs-delay", summary: "통관이 늦어지는 흔한 이유",
    body: [
      "개인통관고유부호나 수취인 이름이 주문 정보와 다르면 통관이 멈출 수 있어요.",
      "연휴와 주말에는 세관이 쉬어서 다음 영업일부터 이어져요.",
      "세관이 서류를 더 요청하면 하루 이틀 더 걸릴 수 있어요."
    ],
    showIn: ["customsArrived", "customsWaiting", "stale"], openIn: ["stale"]
  },
  {
    id: "handoff", summary: "택배사로 넘어가는 데 걸리는 시간",
    body: ["통관이 끝나면 보통 0~1영업일 안에 택배사로 넘어가요.", "택배사로 넘어가면 운송장 문자가 와요."],
    showIn: ["customsCleared", "handedToCarrier", "pickedUp"], openIn: []
  },
  {
    id: "absence", summary: "부재·주소 변경",
    body: ["주소를 바꾸려면 택배사 고객센터나 기사님께 바로 알려 주세요.", "집에 없으면 기사님이 문 앞이나 경비실에 두고 문자를 보내요."],
    showIn: ["inTransit"], openIn: []
  },
  {
    id: "undelivered", summary: "받지 못하셨나요?",
    body: ["문 앞·경비실·택배함을 먼저 확인해 주세요.", "기사님 연락처가 있으면 기사님께 먼저 물어봐 주세요.", "24시간이 지나도 찾지 못하시면 톡톡으로 알려 주세요."],
    showIn: ["delivered"], openIn: []
  },
  {
    id: "return-exchange", summary: "반품·교환",
    body: ["반품·교환은 주문하신 스토어의 주문내역에서 신청할 수 있어요."],
    showIn: ["delivered"], openIn: []
  },
  {
    id: "stale-causes", summary: "새 소식이 멈추는 흔한 이유",
    body: ["세관이 서류 보완을 요청했을 수 있어요.", "택배사 전산 반영이 늦어질 수 있어요."],
    showIn: ["stale"], openIn: []
  }
] satisfies readonly HelpEntry[];

/**
 * 9) 추천 상품 — 결과 화면 인라인 목록(다이얼로그 없음). 유효기간(+09:00) 안의 상품만 보이고, 0개면 목록이 사라집니다.
 * href는 상품 상세 https 주소로 바꿔 주세요(지금은 스토어 홈). 가격은 확인 시각(priceCheckedAt)과 함께일 때만 적습니다.
 */
export const featuredProducts = [
  {
    id: "carpodgo-carplay", name: "Carpodgo mini 6.99인치 카플레이", channel: "naver", href: NAVER_STORE_HOME, isAffiliate: false,
    validFrom: "2026-09-01T00:00:00+09:00", validUntil: "2027-03-31T23:59:59+09:00", priceLabel: null, priceCheckedAt: null,
    contexts: ["pending", "inTransit", "delivered"]
  },
  {
    id: "svbony-eyepiece", name: "SVBONY 천체 망원경 접안 렌즈", channel: "coupang", href: COUPANG_STORE_HOME, isAffiliate: true,
    validFrom: "2026-09-01T00:00:00+09:00", validUntil: "2027-03-31T23:59:59+09:00", priceLabel: null, priceCheckedAt: null,
    contexts: ["pending", "inTransit", "delivered"]
  },
  {
    id: "model-y-mat", name: "테슬라 모델 Y 전천후 전면 매트", channel: "naver", href: NAVER_STORE_HOME, isAffiliate: false,
    validFrom: "2026-09-01T00:00:00+09:00", validUntil: "2027-03-31T23:59:59+09:00", priceLabel: null, priceCheckedAt: null,
    contexts: ["pending", "inTransit", "delivered"]
  },
  {
    id: "blue-archive-display", name: "블루 아카이브 아크릴 전시 케이스", channel: "coupang", href: COUPANG_STORE_HOME, isAffiliate: true,
    validFrom: "2026-09-01T00:00:00+09:00", validUntil: "2027-03-31T23:59:59+09:00", priceLabel: null, priceCheckedAt: null,
    contexts: ["pending", "inTransit", "delivered"]
  }
] satisfies readonly FeaturedItem[];

/**
 * 10) 공지 — 시작 시각에 켜지고 종료 시각에 꺼집니다(한국 시간 +09:00). 제목 20자, 본문 80자 이하, 한 화면에 1개.
 * 우선순위: outage(장애) > delay(지연) > holiday(연휴) > info(안내). home: 홈 한 줄, guideKeys: 결과 카드 안 '안내' 줄, cs: CS 답변 끝.
 * 조회 중·일시 지연 화면에는 outage만 보입니다. 예시는 DEPLOYMENT.md에 있습니다.
 */
export const notices = [
  {
    id: "2026-chuseok", kind: "holiday", title: "추석 연휴 배송 안내",
    body: "추석 연휴(9/24~26)와 주말에는 통관·택배가 쉬어요. 9월 28일(월)부터 순서대로 진행돼요.",
    startsAt: "2026-09-21T00:00:00+09:00", endsAt: "2026-09-29T00:00:00+09:00", home: true,
    guideKeys: ["pending", "customsArrived", "customsWaiting", "customsCleared", "handedToCarrier", "pickedUp", "inTransit"], cs: true
  },
  {
    id: "2026-october-holidays", kind: "holiday", title: "10월 공휴일 배송 안내",
    body: "개천절(10/3)과 대체공휴일(10/5), 한글날(10/9)에는 통관·택배가 쉬어요. 다음 영업일부터 순서대로 진행돼요.",
    startsAt: "2026-09-30T00:00:00+09:00", endsAt: "2026-10-10T00:00:00+09:00", home: true,
    guideKeys: ["pending", "customsArrived", "customsWaiting", "customsCleared", "handedToCarrier", "pickedUp", "inTransit"], cs: true
  }
] satisfies readonly Notice[];

/** 11) 광고 — 수동 광고 단위 ID는 승인 15 뒤에 넣습니다(null이면 슬롯을 그리지 않습니다). 높이는 자리 예약용입니다. */
export const ads = {
  manualSlotId: null,
  minHeightMobilePx: 280,
  minHeightDesktopPx: 250,
  anchorReservePx: 64
} satisfies AdsConfig;

/** 12) 화면 스타일 — 기기가 어두운 모드면 '어두운 화면'으로 시작할지 */
export const style = { followSystemDark: true } satisfies StyleConfig;

/** 13) 결과 화면 공통 문구 — 도착 예상 라벨, 버튼 이름, 처리 내역 요약 등. {date} {n} {time} {seconds} {carrier} 자리는 정해진 곳에만 씁니다. */
export const resultCopy = {
  etaLabel: "도착 예상",
  etaTodayLabel: "오늘 예상",
  etaOverdueLabel: "예상했던 날짜",
  etaDeliveredLabel: "배송 완료일",
  etaPendingText: "정보 등록 후 안내",
  etaWithheldText: "지금은 도착 예상일을 안내하기 어려워요",
  etaUnknownText: "아직 예상일을 계산할 기록이 없어요",
  customsEstimateCaption: "통관 완료 예상 {date}",
  customsDoneCaption: "통관 완료 {date}",
  overdueChip: "확인 필요",
  overdueSentence: "확인이 필요해요. 문의 내용을 복사해 톡톡으로 보내 주세요.",
  carrierUnknown: "택배사",
  carrierUnassigned: "택배사 배정 전",
  issueStopped: "멈춤",
  issueCut: "끊김",
  issueBranch: "갈림",
  stationDeparted: "해외 출발",
  stationCustoms: "입항·통관",
  stationDomestic: "국내 배송",
  stationArrived: "도착",
  historySummary: "처리 내역 {n}건 보기",
  historyLast: "마지막 {time}",
  historyEmpty: "아직 처리 내역이 없어요",
  actionFixNumber: "번호 수정",
  actionRetry: "다시 조회",
  actionCarrierOfficial: "{carrier} 공식 배송조회",
  actionCarrierLive: "{carrier}에서 실시간 위치 보기",
  actionCallDriver: "기사님께 전화",
  actionReturnLink: "다시 볼 링크 복사",
  actionUndelivered: "받지 못하셨나요?",
  pendingStoresIntro: "주문하신 곳에서도 배송 안내를 볼 수 있어요",
  notFoundCaveat: "조회 서비스 사정으로 결과가 없을 수도 있어요",
  carrierCutLine: "택배사 조회가 잠시 늦어요",
  rateLimitedReason: "조회가 몰려 {seconds}초 뒤 다시 조회할 수 있어요",
  customsCheckNote: "개인통관고유부호와 수취인 이름이 주문 정보와 같은지도 확인해 주세요",
  chooseCarrierSentence: "택배사를 고르시면 같은 번호로 바로 다시 조회해요."
} satisfies ResultCopyConfig;

/** 전체 설정(서버·내부 도구·결과 지연 청크용). 브라우저 코드는 위의 필요한 부분만 가져다 씁니다. */
export const siteConfig = {
  channels, disclosures, calendar, durations, lookup, stateGuide, glossary, help, featuredProducts, notices, ads, style, resultCopy
} satisfies SiteConfig;
```

- [ ] **Step 5: Write the result-copy slot table and the structural schema**

Create `lib/config/invariants.ts` (Task 6 adds `checkInvariants` to this file):

```ts
import type { ResultCopyConfig } from "@/lib/config/types";

/** Slots each resultCopy field must contain — no more, no fewer. */
export const RESULT_COPY_SLOTS = {
  etaLabel: [], etaTodayLabel: [], etaOverdueLabel: [], etaDeliveredLabel: [],
  etaPendingText: [], etaWithheldText: [], etaUnknownText: [],
  customsEstimateCaption: ["date"], customsDoneCaption: ["date"],
  overdueChip: [], overdueSentence: [],
  carrierUnknown: [], carrierUnassigned: [],
  issueStopped: [], issueCut: [], issueBranch: [],
  stationDeparted: [], stationCustoms: [], stationDomestic: [], stationArrived: [],
  historySummary: ["n"], historyLast: ["time"], historyEmpty: [],
  actionFixNumber: [], actionRetry: [], actionCarrierOfficial: ["carrier"], actionCarrierLive: ["carrier"],
  actionCallDriver: [], actionReturnLink: [], actionUndelivered: [],
  pendingStoresIntro: [], notFoundCaveat: [], carrierCutLine: [], rateLimitedReason: ["seconds"],
  customsCheckNote: [], chooseCarrierSentence: []
} satisfies Readonly<Record<keyof ResultCopyConfig, readonly string[]>>;
```

Create `lib/config/schema.ts`:

```ts
import { z } from "zod";
import { RESULT_COPY_SLOTS } from "@/lib/config/invariants";
import type { ResultCopyConfig, SiteConfig } from "@/lib/config/types";
import { GUIDE_KEYS } from "@/lib/tracking/types";
import type {
  EtaMode, GuideKey, InquiryLevel, NoticeKind, PrimaryActionKind, RecommendationContext, RecommendationPlacement,
  RevenueTier, StationId, StorePlacement, Tone
} from "@/lib/tracking/types";

/** z.enum from an exhaustive Record<K, true>: a new union member without a schema entry fails typecheck. */
function enumFromKeys<K extends string>(record: Readonly<Record<K, true>>): z.ZodEnum<[K, ...K[]]> {
  const keys = Object.keys(record) as K[];
  if (keys.length === 0) throw new Error("빈 목록으로는 값을 정할 수 없습니다");
  const [first, ...rest] = keys;
  const values: [K, ...K[]] = [first, ...rest];
  return z.enum(values);
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const KST_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?\+09:00$/;

function isRealDateKey(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

const TextSchema = z.string().regex(/\S/, { message: "빈 문구입니다" });
const UrlSchema = z.string().url({ message: "주소 형식이 아닙니다" });
const PositiveIntSchema = z.number().int().positive();
const NonNegativeIntSchema = z.number().int().nonnegative();
const DateKeySchema = z.string().superRefine((value, ctx) => {
  if (!isRealDateKey(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "날짜는 2026-09-24처럼 있는 날짜를 YYYY-MM-DD로 씁니다" });
  }
});
const KstIsoSchema = z.string().superRefine((value, ctx) => {
  if (!KST_ISO_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "시각은 2026-09-26T14:05:00+09:00처럼 +09:00을 붙여 씁니다" });
  }
});

const ToneSchema = enumFromKeys<Tone>({ neutral: true, progress: true, waiting: true, attention: true, problem: true, done: true });
const InquiryLevelSchema = enumFromKeys<InquiryLevel>({
  header: true, shortcutRow: true, blockFirstLink: true, ctaButton: true, worryLink: true, textLink: true, afterStores: true, primary: true
});
const RevenueTierSchema = enumFromKeys<RevenueTier>({ none: true, quiet: true, lead: true });
const StorePlacementSchema = enumFromKeys<StorePlacement>({ none: true, shortcutRow: true, purchaseChoices: true, ctaLead: true });
const RecommendationPlacementSchema = enumFromKeys<RecommendationPlacement>({ none: true, optional: true, inline: true });
const RecommendationContextSchema = enumFromKeys<RecommendationContext>({
  pending: true, customsWaiting: true, customsCleared: true, inTransit: true, delivered: true
});
const EtaModeSchema = enumFromKeys<EtaMode>({ none: true, estimate: true, pendingInfo: true, withheld: true, deliveredOn: true });
const PrimaryActionKindSchema = enumFromKeys<PrimaryActionKind>({
  none: true, submit: true, fixNumber: true, retry: true, copyAndTalk: true, carrierOfficial: true, chooseCarrier: true, storeLead: true
});
const StationIdSchema = enumFromKeys<StationId>({ departed: true, customs: true, domestic: true, arrived: true });
const NoticeKindSchema = enumFromKeys<NoticeKind>({ outage: true, delay: true, holiday: true, info: true });
const GuideKeySchema = z.enum(GUIDE_KEYS);

const TalkChannelSchema = z.object({
  url: UrlSchema,
  labels: z.object({ header: TextSchema, shortcut: TextSchema, cta: TextSchema, copyAndTalk: TextSchema, footer: TextSchema }).strict()
}).strict();

const StoreChannelSchema = z.object({
  name: TextSchema,
  linkLabel: TextSchema,
  isAffiliate: z.boolean(),
  urls: z.object({ shortcut: UrlSchema, showcase: UrlSchema, pending: UrlSchema, deliveredLead: UrlSchema }).strict()
}).strict();

const ChannelsSchema = z.object({
  talk: TalkChannelSchema,
  naver: StoreChannelSchema,
  coupang: StoreChannelSchema,
  allowedHosts: z.array(TextSchema).min(1)
}).strict();

const DisclosuresSchema = z.object({ coupang: z.string() }).strict();

const HolidayPeriodSchema = z.object({
  id: TextSchema, name: TextSchema, dates: z.array(DateKeySchema).min(1), badge: TextSchema
}).strict();

const CalendarSchema = z.object({
  timeZone: z.literal("Asia/Seoul"),
  holidays: z.array(HolidayPeriodSchema),
  carrierDeliversSaturday: z.boolean()
}).strict();

const DayRangeSchema = z.object({ min: NonNegativeIntSchema, max: NonNegativeIntSchema })
  .strict()
  .refine((range) => range.min <= range.max, { message: "최솟값이 최댓값보다 큽니다" });

const DurationsSchema = z.object({
  stages: z.object({
    visibleAfterDeparture: DayRangeSchema, customs: DayRangeSchema, handoffBusinessDays: DayRangeSchema, domestic: DayRangeSchema
  }).strict(),
  typical: z.array(z.object({ station: StationIdSchema, text: TextSchema }).strict()).min(1),
  worry: z.object({
    afterEstimateBusinessDays: PositiveIntSchema,
    afterClearanceBusinessDays: PositiveIntSchema,
    notFoundDays: PositiveIntSchema,
    pendingDays: PositiveIntSchema,
    undeliveredHours: PositiveIntSchema
  }).strict(),
  staleDays: z.number().int(),
  pendingRecheck: TextSchema
}).strict();

const LookupSchema = z.object({
  skeletonDelayMs: PositiveIntSchema,
  stageMs: z.tuple([PositiveIntSchema, PositiveIntSchema]),
  spinnerStopMs: PositiveIntSchema,
  elapsedStepSeconds: PositiveIntSchema,
  timeoutMs: PositiveIntSchema,
  rateLimitCooldownSeconds: PositiveIntSchema,
  notFoundServiceCaveat: z.boolean(),
  copy: z.object({
    submit: TextSchema, submitting: TextSchema, title: TextSchema, body: TextSchema, started: TextSchema,
    longWait: TextSchema, veryLongWait: TextSchema, elapsed: TextSchema, cancel: TextSchema, carrierOfficialFirst: TextSchema,
    formatHint: TextSchema, numberFinderSummary: TextSchema, numberFinderItems: z.array(TextSchema).min(1),
    carrierAuto: TextSchema, typicalSummary: TextSchema
  }).strict()
}).strict();

const GuideRowSchema = z.object({
  tone: ToneSchema,
  chip: TextSchema.nullable(),
  docTitle: TextSchema,
  title: TextSchema,
  overdueTitle: TextSchema.nullable(),
  reason: TextSchema.nullable(),
  ctaHeading: TextSchema.nullable(),
  nextAction: TextSchema,
  worry: TextSchema.nullable(),
  primaryAction: PrimaryActionKindSchema,
  inquiryLevel: InquiryLevelSchema,
  revenueTier: RevenueTierSchema,
  stores: StorePlacementSchema,
  recommendations: RecommendationPlacementSchema,
  etaMode: EtaModeSchema
}).strict();

const stateGuideShape = {
  idle: GuideRowSchema, loading: GuideRowSchema,
  invalidNumber: GuideRowSchema, notFound: GuideRowSchema, temporaryDelay: GuideRowSchema, offline: GuideRowSchema,
  noResponse: GuideRowSchema, serverError: GuideRowSchema,
  pending: GuideRowSchema, customsArrived: GuideRowSchema, customsWaiting: GuideRowSchema, customsCleared: GuideRowSchema,
  handedToCarrier: GuideRowSchema, pickedUp: GuideRowSchema, inTransit: GuideRowSchema, delivered: GuideRowSchema,
  stale: GuideRowSchema, lookupUnavailable: GuideRowSchema, ambiguous: GuideRowSchema
} satisfies Record<GuideKey, typeof GuideRowSchema>;

const GlossaryEntrySchema = z.object({ source: TextSchema, label: TextSchema }).strict();

const HelpEntrySchema = z.object({
  id: TextSchema,
  summary: TextSchema,
  body: z.array(TextSchema).min(1),
  showIn: z.array(GuideKeySchema).min(1),
  openIn: z.array(GuideKeySchema)
}).strict();

const FeaturedItemSchema = z.object({
  id: TextSchema,
  name: TextSchema,
  channel: z.enum(["naver", "coupang"]),
  href: UrlSchema,
  isAffiliate: z.boolean(),
  validFrom: KstIsoSchema,
  validUntil: KstIsoSchema,
  priceLabel: TextSchema.nullable(),
  priceCheckedAt: KstIsoSchema.nullable(),
  contexts: z.array(RecommendationContextSchema).min(1)
}).strict();

const NoticeSchema = z.object({
  id: TextSchema,
  kind: NoticeKindSchema,
  title: TextSchema,
  body: TextSchema,
  startsAt: KstIsoSchema,
  endsAt: KstIsoSchema,
  home: z.boolean(),
  guideKeys: z.array(GuideKeySchema),
  cs: z.boolean()
}).strict();

const AdsSchema = z.object({
  manualSlotId: z.string().regex(/^\d+$/, { message: "광고 단위 ID는 숫자만 씁니다" }).nullable(),
  minHeightMobilePx: PositiveIntSchema,
  minHeightDesktopPx: PositiveIntSchema,
  anchorReservePx: NonNegativeIntSchema
}).strict();

const StyleSchema = z.object({ followSystemDark: z.boolean() }).strict();

const RESULT_COPY_KEYS = Object.keys(RESULT_COPY_SLOTS) as (keyof ResultCopyConfig)[];
const resultCopyShape = Object.fromEntries(RESULT_COPY_KEYS.map((key) => [key, TextSchema])) as Record<keyof ResultCopyConfig, typeof TextSchema>;
const ResultCopySchema = z.object(resultCopyShape).strict();

const SiteConfigObjectSchema = z.object({
  channels: ChannelsSchema,
  disclosures: DisclosuresSchema,
  calendar: CalendarSchema,
  durations: DurationsSchema,
  lookup: LookupSchema,
  stateGuide: z.object(stateGuideShape).strict(),
  glossary: z.array(GlossaryEntrySchema),
  help: z.array(HelpEntrySchema),
  featuredProducts: z.array(FeaturedItemSchema),
  notices: z.array(NoticeSchema),
  ads: AdsSchema,
  style: StyleSchema,
  resultCopy: ResultCopySchema
}).strict();

export const SiteConfigSchema: z.ZodType<SiteConfig, z.ZodTypeDef, unknown> = SiteConfigObjectSchema;

const TYPE_NAMES: Readonly<Record<string, string>> = {
  string: "문자열", number: "숫자", boolean: "true/false", array: "목록", object: "객체", null: "null"
};

function formatPath(path: readonly (string | number)[]): string {
  const text = path.reduce<string>(
    (acc, part) => (typeof part === "number" ? `${acc}[${part}]` : acc.length > 0 ? `${acc}.${part}` : part),
    ""
  );
  return text.length > 0 ? text : "(설정 전체)";
}

function koreanMessage(issue: z.ZodIssue): string {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return issue.received === "undefined" ? "값이 없습니다" : `${TYPE_NAMES[issue.expected] ?? issue.expected} 형식이어야 합니다`;
    case z.ZodIssueCode.invalid_literal:
      return `값은 ${String(issue.expected)}이어야 합니다`;
    case z.ZodIssueCode.invalid_enum_value:
      return `허용되지 않은 값입니다(가능한 값: ${issue.options.join(", ")})`;
    case z.ZodIssueCode.unrecognized_keys:
      return `알 수 없는 항목입니다: ${issue.keys.join(", ")}`;
    case z.ZodIssueCode.too_small:
      if (issue.type === "array") return `항목이 ${String(issue.minimum)}개 이상 있어야 합니다`;
      return issue.inclusive ? `${String(issue.minimum)} 이상이어야 합니다` : `${String(issue.minimum)}보다 커야 합니다`;
    case z.ZodIssueCode.too_big:
      if (issue.type === "array") return `항목은 ${String(issue.maximum)}개까지입니다`;
      return issue.inclusive ? `${String(issue.maximum)} 이하여야 합니다` : `${String(issue.maximum)}보다 작아야 합니다`;
    case z.ZodIssueCode.invalid_string:
      return issue.validation === "url" ? "주소 형식이 아닙니다" : issue.message;
    default:
      return issue.message;
  }
}

/** One Korean line per issue: 'notices[0].endsAt: 종료 시각이 시작보다 빠릅니다'. */
export function formatConfigIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `${formatPath(issue.path)}: ${koreanMessage(issue)}`).join("\n");
}
```

- [ ] **Step 6: Write the config fixtures**

Create `tests/fixtures/config-fixtures.ts`:

```ts
import { siteConfig } from "@/config/site.config";
import type { FeaturedItem, HolidayPeriod, Notice, SiteConfig } from "@/lib/config/types";

type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { readonly [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/** Recursive partial of SiteConfig; arrays (and tuples) are replaced as a whole. */
export type DeepPartialConfig = DeepPartial<SiteConfig>;

export const FIXTURE_HOLIDAYS: readonly HolidayPeriod[] = [
  { id: "2026-chuseok", name: "추석 연휴", dates: ["2026-09-24", "2026-09-25", "2026-09-26"], badge: "추석 연휴 영향 · 1~2일 늦어질 수 있어요" },
  { id: "2026-foundation-day", name: "개천절", dates: ["2026-10-03", "2026-10-05"], badge: "개천절 영향 · 1일 늦어질 수 있어요" },
  { id: "2026-hangul-day", name: "한글날", dates: ["2026-10-09"], badge: "한글날 영향 · 1일 늦어질 수 있어요" },
  { id: "2026-christmas", name: "성탄절", dates: ["2026-12-25"], badge: "성탄절 영향 · 1일 늦어질 수 있어요" },
  { id: "2027-seollal", name: "설 연휴", dates: ["2027-02-06", "2027-02-07", "2027-02-08", "2027-02-09"], badge: "설 연휴 영향 · 1~2일 늦어질 수 있어요" }
];

export const FIXTURE_NOTICES: readonly Notice[] = [
  {
    id: "fx-holiday", kind: "holiday", title: "추석 연휴 배송 안내",
    body: "추석 연휴(9/24~26)와 주말에는 통관·택배가 쉬어요. 9월 28일(월)부터 순서대로 진행돼요.",
    startsAt: "2026-09-21T00:00:00+09:00", endsAt: "2026-09-29T00:00:00+09:00", home: true,
    guideKeys: ["pending", "customsArrived", "customsWaiting", "customsCleared", "handedToCarrier", "pickedUp", "inTransit"], cs: true
  },
  {
    id: "fx-outage", kind: "outage", title: "UNI-PASS 점검 안내",
    body: "UNI-PASS 점검(22:00~24:00) 중에는 통관 정보가 늦게 보일 수 있어요.",
    startsAt: "2026-09-26T22:00:00+09:00", endsAt: "2026-09-27T00:00:00+09:00", home: true,
    guideKeys: ["loading", "temporaryDelay", "noResponse", "offline", "notFound", "customsWaiting"], cs: true
  },
  {
    id: "fx-info", kind: "info", title: "배송 조회 안내",
    body: "조회 결과는 저장하지 않아요. 같은 탭에서 30분 안에 다시 볼 수 있어요.",
    startsAt: "2026-09-01T00:00:00+09:00", endsAt: "2026-10-01T00:00:00+09:00", home: true, guideKeys: [], cs: false
  },
  {
    id: "fx-expired", kind: "delay", title: "택배 없는 날 안내",
    body: "택배 없는 날에는 배송이 쉬어요.",
    startsAt: "2026-08-13T00:00:00+09:00", endsAt: "2026-08-15T00:00:00+09:00", home: true, guideKeys: ["inTransit"], cs: true
  }
];

export const FIXTURE_FEATURED: readonly FeaturedItem[] = [
  {
    id: "fx-weekly-mount", name: "차량용 휴대폰 거치대", channel: "naver",
    href: "https://smartstore.naver.com/example/products/0000000001", isAffiliate: false,
    validFrom: "2026-09-21T00:00:00+09:00", validUntil: "2026-09-28T00:00:00+09:00", priceLabel: null, priceCheckedAt: null,
    contexts: ["pending", "inTransit", "delivered"]
  },
  {
    id: "fx-month-case", name: "아크릴 전시 케이스", channel: "coupang",
    href: "https://www.coupang.com/vp/products/0000000002", isAffiliate: true,
    validFrom: "2026-09-01T00:00:00+09:00", validUntil: "2026-10-31T23:59:59+09:00",
    priceLabel: "39,000원", priceCheckedAt: "2026-09-24T10:00:00+09:00",
    contexts: ["pending", "customsWaiting", "customsCleared", "inTransit", "delivered"]
  }
];

/** siteConfig with deterministic notices, holidays and featured items around FIXTURE_NOW (2026-09-26T14:05 KST). */
export const FIXTURE_CONFIG: SiteConfig = {
  ...siteConfig,
  calendar: { ...siteConfig.calendar, holidays: FIXTURE_HOLIDAYS, carrierDeliversSaturday: false },
  notices: FIXTURE_NOTICES,
  featuredProducts: FIXTURE_FEATURED
};

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeDeep(base: unknown, patch: unknown): unknown {
  if (patch === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    merged[key] = mergeDeep(base[key], value);
  }
  return merged;
}

/** FIXTURE_CONFIG with `patch` merged in (objects deep, arrays replaced). Invalid values are allowed on purpose for schema tests. */
export function withConfig(patch: DeepPartialConfig): SiteConfig {
  return mergeDeep(FIXTURE_CONFIG, patch) as SiteConfig;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/config.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck; npm run lint`
Expected: `21 passed`; typecheck and lint exit 0. (If typecheck reports that the zod object is not assignable to `z.ZodType<SiteConfig, z.ZodTypeDef, unknown>`, the message names the field whose zod output differs from `SiteConfig`; fix that field's schema — never widen `SiteConfig` or cast the schema.)

- [ ] **Step 8: Commit**

```powershell
git add config/site.config.ts lib/config/schema.ts lib/config/invariants.ts tests/fixtures/config-fixtures.ts tests/unit/config.spec.ts; git commit -m "feat: add the operator site config with a Korean-message schema and config fixtures"
```

### Task 6: Config invariants with Korean messages

**Files:**
- Modify: `lib/config/invariants.ts` (append the rules below the slot table from Task 5)
- Modify: `lib/config/schema.ts` (the `SiteConfigSchema` line and one import)
- Test: `tests/unit/config.spec.ts` (append a describe block and one import)

**Interfaces:**
- Consumes: `DIGIT_RUN_PATTERN`, `HBL_LIKE_PATTERN` (`@/lib/privacy/number-patterns`, S01 contract §11.4); `COPY_TOKENS`, `tokensIn` (Task 3); key lists (Task 1); `FAKE` (S01 fixtures, tests only).
- Produces: `checkInvariants(config: SiteConfig, ctx: z.RefinementCtx): void`, `SERVER_STALE_DAYS = 14`, `NOTICE_TITLE_MAX = 20`, `NOTICE_BODY_MAX = 80` (private to S03); `SiteConfigSchema` now enforces the §9 invariants and contract addition 13. Every message is Korean and printed as `path: message` by `formatConfigIssues`.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/config.spec.ts`, add below the existing imports:

```ts
import { FAKE } from "../fixtures/tracking-fixtures";
```

Append to the end of `tests/unit/config.spec.ts`:

```ts
test.describe("config invariants", () => {
  test("problem states and loading carry no stores, recommendations or ads", () => {
    const issues = issuesOf(withConfig({
      stateGuide: {
        stale: { stores: "ctaLead" }, serverError: { revenueTier: "quiet" },
        ambiguous: { recommendations: "inline" }, loading: { stores: "shortcutRow" }
      }
    }));
    expect(issues).toContain("stateGuide.stale.stores: 문제 상태에는 스토어를 둘 수 없습니다");
    expect(issues).toContain("stateGuide.serverError.revenueTier: 문제 상태에는 광고를 둘 수 없습니다");
    expect(issues).toContain("stateGuide.ambiguous.recommendations: 문제 상태에는 추천 상품을 둘 수 없습니다");
    expect(issues).toContain("stateGuide.loading.stores: 조회 중에는 스토어를 둘 수 없습니다");
  });

  test("in transit shows no stores", () => {
    expect(issuesOf(withConfig({ stateGuide: { inTransit: { stores: "ctaLead" } } })))
      .toContain("stateGuide.inTransit.stores: 배송 중에는 스토어를 둘 수 없습니다");
  });

  test("delivered leads with the stores", () => {
    const issues = issuesOf(withConfig({ stateGuide: { delivered: { stores: "none", primaryAction: "none" } } }));
    expect(issues).toContain("stateGuide.delivered.stores: 배송 완료는 스토어가 먼저 와야 합니다");
    expect(issues).toContain("stateGuide.delivered.primaryAction: 배송 완료는 스토어가 먼저 와야 합니다");
  });

  test("pending offers inquiry and purchase choices", () => {
    const issues = issuesOf(withConfig({ stateGuide: { pending: { stores: "none", inquiryLevel: "textLink" } } }));
    expect(issues).toContain("stateGuide.pending.stores: 국내 도착 전에는 구매처 선택지가 있어야 합니다");
    expect(issues).toContain("stateGuide.pending.inquiryLevel: 국내 도착 전에는 문의 버튼이 있어야 합니다");
  });

  test("affiliate links need the disclosure; without affiliate links it may be empty", () => {
    expect(issuesOf(withConfig({ disclosures: { coupang: " " } })))
      .toContain("disclosures.coupang: 제휴 링크에는 고지 문구가 필요합니다");
    expect(issuesOf(withConfig({ disclosures: { coupang: "" }, channels: { coupang: { isAffiliate: false } }, featuredProducts: [] })))
      .not.toContain("disclosures.coupang");
  });

  test("copy with a real-looking number, an HBL token or AI wording fails", () => {
    const notice = { ...FIXTURE_CONFIG.notices[0], body: `택배 ${FAKE.domestic} 확인해 주세요` };
    const helpEntry = { ...FIXTURE_CONFIG.help[0], body: ["안내", `${FAKE.hbl} 확인`] };
    const issues = issuesOf(withConfig({
      notices: [notice],
      help: [helpEntry],
      stateGuide: { inTransit: { reason: "AI가 위치를 알려 드려요" } },
      resultCopy: { carrierCutLine: "배송 로봇이 늦어요" }
    }));
    expect(issues).toContain("notices[0].body: 10자리 이상 숫자를 쓸 수 없습니다");
    expect(issues).toContain("help[0].body[1]: HBL 형식 번호를 쓸 수 없습니다");
    expect(issues).toContain("stateGuide.inTransit.reason: AI·인공지능·로봇·봇 표현을 쓸 수 없습니다");
    expect(issues).toContain("resultCopy.carrierCutLine: AI·인공지능·로봇·봇 표현을 쓸 수 없습니다");
  });

  test("all-zero placeholders, clock times and short digit runs are allowed", () => {
    const notice = { ...FIXTURE_CONFIG.notices[0], body: "예: 0000 0000 0000 · 22:00~24:00 점검 · 1~2일" };
    expect(issuesOf(withConfig({ notices: [notice] }))).toBe("");
  });

  test("stateGuide copy uses only the five tokens; other copy uses none or its fixed slots", () => {
    const issues = issuesOf(withConfig({
      stateGuide: { customsWaiting: { worry: "{orderId}에 {worryDate}까지 그대로면 알려 주세요" } },
      notices: [{ ...FIXTURE_CONFIG.notices[0], title: "{etaDate} 안내" }],
      resultCopy: { historySummary: "처리 내역 보기", actionRetry: "{carrier} 다시 조회" },
      lookup: { copy: { elapsed: "경과" } }
    }));
    expect(issues).toContain("stateGuide.customsWaiting.worry: 허용되지 않은 토큰 {orderId}입니다");
    expect(issues).toContain("notices[0].title: 이 문구에는 토큰을 쓸 수 없습니다");
    expect(issues).toContain("resultCopy.historySummary: {n} 자리가 필요합니다");
    expect(issues).toContain("resultCopy.actionRetry: 허용되지 않은 토큰 {carrier}입니다");
    expect(issues).toContain("lookup.copy.elapsed: {seconds} 자리가 필요합니다");
  });

  test("staleDays must equal the server's 14", () => {
    expect(issuesOf(withConfig({ durations: { staleDays: 15 } })))
      .toContain("durations.staleDays: 서버 기준(14일)과 같아야 합니다");
  });

  test("notice limits, windows and ids", () => {
    const base = FIXTURE_CONFIG.notices[0];
    const issues = issuesOf(withConfig({
      notices: [
        { ...base, id: "a", title: "가".repeat(21) },
        { ...base, id: "b", body: "나".repeat(81) },
        { ...base, id: "c", startsAt: "2026-09-29T00:00:00+09:00", endsAt: "2026-09-21T00:00:00+09:00" },
        { ...base, id: "c" }
      ]
    }));
    expect(issues).toContain("notices[0].title: 제목은 20자 이하여야 합니다");
    expect(issues).toContain("notices[1].body: 본문은 80자 이하여야 합니다");
    expect(issues).toContain("notices[2].endsAt: 종료 시각이 시작보다 빠릅니다");
    expect(issues).toContain("notices[3].id: 같은 id가 이미 있습니다");
    expect(issuesOf(withConfig({ notices: [{ ...base, title: "가".repeat(20), body: "나".repeat(80) }] }))).toBe("");
  });

  test("links must be https on an allowed host", () => {
    const issues = issuesOf(withConfig({
      channels: {
        naver: { urls: { pending: "http://mkt.shopping.naver.com/link/x" } },
        coupang: { urls: { deliveredLead: "https://example.com/x" } }
      }
    }));
    expect(issues).toContain("channels.naver.urls.pending: https 주소만 쓸 수 있습니다");
    expect(issues).toContain("channels.coupang.urls.deliveredLead: 허용 목록에 없는 호스트입니다: example.com");
  });

  test("overdue titles exist exactly for the six progress states, with a {worryDate} worry line", () => {
    const issues = issuesOf(withConfig({
      stateGuide: {
        customsWaiting: { overdueTitle: null },
        delivered: { overdueTitle: "{worryDate}이 지났어요" },
        inTransit: { worry: "곧 도착해요" }
      }
    }));
    expect(issues).toContain("stateGuide.customsWaiting.overdueTitle: 기준일이 지난 상태의 제목이 필요합니다");
    expect(issues).toContain("stateGuide.delivered.overdueTitle: 이 상태에는 기준일 경과 제목을 쓸 수 없습니다");
    expect(issues).toContain("stateGuide.inTransit.worry: {worryDate} 자리가 필요합니다");
  });

  test("day counts in the copy follow the durations", () => {
    const issues = issuesOf(withConfig({
      durations: { worry: { notFoundDays: 5, pendingDays: 12 }, stages: { visibleAfterDeparture: { min: 2, max: 6 } } }
    }));
    expect(issues).toContain("stateGuide.notFound.worry: 걱정 기준(5일)과 문구가 다릅니다");
    expect(issues).toContain("stateGuide.pending.worry: 걱정 기준(12일)과 문구가 다릅니다");
    expect(issues).toContain("stateGuide.notFound.reason: 조회 가능 시점(2~6일)과 문구가 다릅니다");
  });

  test("state-table sanity rules", () => {
    const issues = issuesOf(withConfig({
      stateGuide: {
        stale: { tone: "problem", etaMode: "estimate" },
        customsWaiting: { primaryAction: "copyAndTalk" },
        pending: { etaMode: "estimate" },
        customsCleared: { docTitle: "통관 {carrier} 완료" }
      }
    }));
    expect(issues).toContain("stateGuide.stale.tone: 빨간 톤은 오류 상태에만 쓸 수 있습니다");
    expect(issues).toContain("stateGuide.stale.etaMode: 정체 상태는 예상일 대신 확인 안내를 보여야 합니다");
    expect(issues).toContain("stateGuide.customsWaiting.primaryAction: 정상 대기 상태에는 채움 버튼을 둘 수 없습니다");
    expect(issues).toContain("stateGuide.pending.etaMode: 국내 도착 전에는 '정보 등록 후 안내'를 보여야 합니다");
    expect(issues).toContain("stateGuide.customsCleared.docTitle: 문서 제목에는 숫자나 토큰을 쓸 수 없습니다");
  });

  test("lookup timings must increase", () => {
    expect(issuesOf(withConfig({ lookup: { stageMs: [9000, 8000] } })))
      .toContain("lookup.stageMs: 단계 시각은 스켈레톤 < 긴 대기 < 아주 긴 대기 < 제한 시간 순서여야 합니다");
    expect(issuesOf(withConfig({ lookup: { spinnerStopMs: 60000 } })))
      .toContain("lookup.spinnerStopMs: 스피너 정지 시각은 제한 시간보다 빨라야 합니다");
  });

  test("the S10 Part B values are accepted", () => {
    expect(issuesOf(withConfig({ lookup: { timeoutMs: 25000, notFoundServiceCaveat: false, stageMs: [3000, 7000] } }))).toBe("");
  });

  test("featured items, help entries and holiday ids", () => {
    const late = { ...FIXTURE_CONFIG.featuredProducts[0], validUntil: "2026-09-20T00:00:00+09:00" };
    const unchecked = { ...FIXTURE_CONFIG.featuredProducts[1], priceCheckedAt: null };
    const helpEntry = { ...FIXTURE_CONFIG.help[0], openIn: ["delivered" as const] };
    const [first, second] = FIXTURE_CONFIG.calendar.holidays;
    const issues = issuesOf(withConfig({
      featuredProducts: [late, unchecked],
      help: [helpEntry],
      calendar: { holidays: [first, { ...second, id: first.id }] }
    }));
    expect(issues).toContain("featuredProducts[0].validUntil: 종료 시각이 시작보다 빠릅니다");
    expect(issues).toContain("featuredProducts[1].priceLabel: 가격에는 확인 시각이 필요합니다");
    expect(issues).toContain("help[0].openIn: 펼침 상태는 표시 상태 안에서만 고를 수 있습니다");
    expect(issues).toContain("calendar.holidays[1].id: 같은 id가 이미 있습니다");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/config.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `15 failed, 23 passed` — every new invariant row gets an empty issue string; "all-zero placeholders…" and "the S10 Part B values are accepted" already pass.

- [ ] **Step 3: Write the invariants**

Append to `lib/config/invariants.ts` (keep the `RESULT_COPY_SLOTS` block; add these imports at the top of the file, merging with the existing `import type { ResultCopyConfig }` line into `import type { ResultCopyConfig, SiteConfig } from "@/lib/config/types";`):

```ts
import { z } from "zod";
import { DIGIT_RUN_PATTERN, HBL_LIKE_PATTERN } from "@/lib/privacy/number-patterns";
import { ERROR_GUIDE_KEYS, GUIDE_KEYS, OVERDUE_CAPABLE_KEYS, PROBLEM_GUIDE_KEYS } from "@/lib/tracking/types";
import type { GuideKey } from "@/lib/tracking/types";
import { COPY_TOKENS, tokensIn } from "@/lib/tracking/template";
```

Then append below `RESULT_COPY_SLOTS`:

```ts
export const SERVER_STALE_DAYS = 14; // lib/services/normalizer.ts STALE_AFTER_DAYS
export const NOTICE_TITLE_MAX = 20;
export const NOTICE_BODY_MAX = 80;

type Path = readonly (string | number)[];
type Report = (path: Path, message: string) => void;

const STATE_TEXT_FIELDS = ["chip", "docTitle", "title", "overdueTitle", "reason", "ctaHeading", "nextAction", "worry"] as const;
const NORMAL_WAITING_KEYS: readonly GuideKey[] = ["customsArrived", "customsWaiting", "customsCleared"];
const ERROR_KEYS: ReadonlySet<GuideKey> = new Set<GuideKey>(ERROR_GUIDE_KEYS);
const OVERDUE_KEYS: ReadonlySet<GuideKey> = new Set<GuideKey>(OVERDUE_CAPABLE_KEYS);
const STATE_TOKENS: ReadonlySet<string> = new Set<string>(COPY_TOKENS);
/** Keys whose values are identifiers, dates, URLs or enum values — not customer copy. */
const SKIP_COPY_KEYS: ReadonlySet<string> = new Set([
  "url", "urls", "href", "allowedHosts", "id", "dates", "validFrom", "validUntil", "priceCheckedAt", "startsAt", "endsAt",
  "timeZone", "manualSlotId", "source", "tone", "primaryAction", "inquiryLevel", "revenueTier", "stores", "recommendations",
  "etaMode", "kind", "channel", "station", "guideKeys", "showIn", "openIn", "contexts"
]);
const AI_PATTERN = /(^|[^A-Za-z])AI([^A-Za-z]|$)|인공지능|로봇|봇/;
const ZERO_RUN = /^0+$/;
const ELAPSED_PATH = "lookup.copy.elapsed";

function allMatches(pattern: RegExp, text: string): readonly string[] {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return text.match(new RegExp(pattern.source, flags)) ?? [];
}

function checkSlots(text: string, required: readonly string[], path: Path, report: Report): void {
  const found = new Set(tokensIn(text));
  for (const slot of required) if (!found.has(slot)) report(path, `{${slot}} 자리가 필요합니다`);
  for (const token of found) if (!required.includes(token)) report(path, `허용되지 않은 토큰 {${token}}입니다`);
}

function visitStrings(value: unknown, path: Path, visit: (text: string, path: Path) => void): void {
  if (typeof value === "string") {
    visit(value, path);
    return;
  }
  if (Array.isArray(value)) {
    (value as readonly unknown[]).forEach((item, index) => visitStrings(item, [...path, index], visit));
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value as Readonly<Record<string, unknown>>)) {
      if (!SKIP_COPY_KEYS.has(key)) visitStrings(child, [...path, key], visit);
    }
  }
}

function checkTokenPolicy(text: string, path: Path, report: Report): void {
  const [section, field] = path;
  if (section === "stateGuide") return; // checked with the five CopyTokens in checkStateCopy
  if (section === "resultCopy" && typeof field === "string" && field in RESULT_COPY_SLOTS) {
    checkSlots(text, RESULT_COPY_SLOTS[field as keyof ResultCopyConfig], path, report);
    return;
  }
  if (path.join(".") === ELAPSED_PATH) {
    checkSlots(text, ["seconds"], path, report);
    return;
  }
  if (tokensIn(text).length > 0) report(path, "이 문구에는 토큰을 쓸 수 없습니다");
}

function checkCopyText(config: SiteConfig, report: Report): void {
  visitStrings(config, [], (text, path) => {
    const realRuns = allMatches(DIGIT_RUN_PATTERN, text).filter((run) => !ZERO_RUN.test(run.replace(/[ -]/g, "")));
    if (realRuns.length > 0) report(path, "10자리 이상 숫자를 쓸 수 없습니다");
    if (allMatches(HBL_LIKE_PATTERN, text).length > 0) report(path, "HBL 형식 번호를 쓸 수 없습니다");
    if (AI_PATTERN.test(text)) report(path, "AI·인공지능·로봇·봇 표현을 쓸 수 없습니다");
    checkTokenPolicy(text, path, report);
  });
}

function checkPlacement(config: SiteConfig, report: Report): void {
  const noRevenueKeys: readonly GuideKey[] = [...PROBLEM_GUIDE_KEYS, "loading"];
  for (const key of noRevenueKeys) {
    const row = config.stateGuide[key];
    const who = key === "loading" ? "조회 중" : "문제 상태";
    if (row.stores !== "none") report(["stateGuide", key, "stores"], `${who}에는 스토어를 둘 수 없습니다`);
    if (row.recommendations !== "none") report(["stateGuide", key, "recommendations"], `${who}에는 추천 상품을 둘 수 없습니다`);
    if (row.revenueTier !== "none") report(["stateGuide", key, "revenueTier"], `${who}에는 광고를 둘 수 없습니다`);
  }
  const guide = config.stateGuide;
  if (guide.inTransit.stores !== "none") report(["stateGuide", "inTransit", "stores"], "배송 중에는 스토어를 둘 수 없습니다");
  if (guide.delivered.stores !== "ctaLead") report(["stateGuide", "delivered", "stores"], "배송 완료는 스토어가 먼저 와야 합니다");
  if (guide.delivered.primaryAction !== "storeLead") report(["stateGuide", "delivered", "primaryAction"], "배송 완료는 스토어가 먼저 와야 합니다");
  if (guide.pending.stores !== "purchaseChoices") report(["stateGuide", "pending", "stores"], "국내 도착 전에는 구매처 선택지가 있어야 합니다");
  if (guide.pending.inquiryLevel !== "ctaButton") report(["stateGuide", "pending", "inquiryLevel"], "국내 도착 전에는 문의 버튼이 있어야 합니다");
  for (const key of NORMAL_WAITING_KEYS) {
    if (guide[key].primaryAction !== "none") report(["stateGuide", key, "primaryAction"], "정상 대기 상태에는 채움 버튼을 둘 수 없습니다");
  }
  if (guide.stale.etaMode !== "withheld") report(["stateGuide", "stale", "etaMode"], "정체 상태는 예상일 대신 확인 안내를 보여야 합니다");
  if (guide.pending.etaMode !== "pendingInfo") report(["stateGuide", "pending", "etaMode"], "국내 도착 전에는 '정보 등록 후 안내'를 보여야 합니다");
  if (guide.delivered.etaMode !== "deliveredOn") report(["stateGuide", "delivered", "etaMode"], "배송 완료에는 배송 완료일을 보여야 합니다");
  for (const key of GUIDE_KEYS) {
    if (guide[key].tone === "problem" && !ERROR_KEYS.has(key)) report(["stateGuide", key, "tone"], "빨간 톤은 오류 상태에만 쓸 수 있습니다");
  }
  const hasAffiliate = config.channels.naver.isAffiliate || config.channels.coupang.isAffiliate
    || config.featuredProducts.some((item) => item.isAffiliate);
  if (hasAffiliate && config.disclosures.coupang.trim().length === 0) {
    report(["disclosures", "coupang"], "제휴 링크에는 고지 문구가 필요합니다");
  }
}

function checkStateCopy(config: SiteConfig, report: Report): void {
  for (const key of GUIDE_KEYS) {
    const row = config.stateGuide[key];
    for (const field of STATE_TEXT_FIELDS) {
      const text = row[field];
      if (text === null) continue;
      for (const token of new Set(tokensIn(text))) {
        if (!STATE_TOKENS.has(token)) report(["stateGuide", key, field], `허용되지 않은 토큰 {${token}}입니다`);
      }
    }
    if (/\d|\{/.test(row.docTitle)) report(["stateGuide", key, "docTitle"], "문서 제목에는 숫자나 토큰을 쓸 수 없습니다");
    if (OVERDUE_KEYS.has(key)) {
      if (row.overdueTitle === null) report(["stateGuide", key, "overdueTitle"], "기준일이 지난 상태의 제목이 필요합니다");
      if (row.worry === null || !row.worry.includes("{worryDate}")) report(["stateGuide", key, "worry"], "{worryDate} 자리가 필요합니다");
    } else if (row.overdueTitle !== null) {
      report(["stateGuide", key, "overdueTitle"], "이 상태에는 기준일 경과 제목을 쓸 수 없습니다");
    }
  }
}

function checkDurations(config: SiteConfig, report: Report): void {
  const { durations, stateGuide } = config;
  if (durations.staleDays !== SERVER_STALE_DAYS) report(["durations", "staleDays"], `서버 기준(${SERVER_STALE_DAYS}일)과 같아야 합니다`);
  const { notFoundDays, pendingDays } = durations.worry;
  if (!(stateGuide.notFound.worry ?? "").includes(`${notFoundDays}일`)) {
    report(["stateGuide", "notFound", "worry"], `걱정 기준(${notFoundDays}일)과 문구가 다릅니다`);
  }
  if (!(stateGuide.pending.worry ?? "").includes(`${pendingDays}일`)) {
    report(["stateGuide", "pending", "worry"], `걱정 기준(${pendingDays}일)과 문구가 다릅니다`);
  }
  const { min, max } = durations.stages.visibleAfterDeparture;
  if (!(stateGuide.notFound.reason ?? "").includes(`${min}~${max}일`)) {
    report(["stateGuide", "notFound", "reason"], `조회 가능 시점(${min}~${max}일)과 문구가 다릅니다`);
  }
}

function checkLookup(config: SiteConfig, report: Report): void {
  const { skeletonDelayMs, stageMs, spinnerStopMs, timeoutMs } = config.lookup;
  const [longMs, veryLongMs] = stageMs;
  if (!(skeletonDelayMs < longMs && longMs < veryLongMs && veryLongMs < timeoutMs)) {
    report(["lookup", "stageMs"], "단계 시각은 스켈레톤 < 긴 대기 < 아주 긴 대기 < 제한 시간 순서여야 합니다");
  }
  if (spinnerStopMs >= timeoutMs) report(["lookup", "spinnerStopMs"], "스피너 정지 시각은 제한 시간보다 빨라야 합니다");
}

function checkNotices(config: SiteConfig, report: Report): void {
  config.notices.forEach((notice, index) => {
    if ([...notice.title].length > NOTICE_TITLE_MAX) report(["notices", index, "title"], `제목은 ${NOTICE_TITLE_MAX}자 이하여야 합니다`);
    if ([...notice.body].length > NOTICE_BODY_MAX) report(["notices", index, "body"], `본문은 ${NOTICE_BODY_MAX}자 이하여야 합니다`);
    if (!(Date.parse(notice.endsAt) > Date.parse(notice.startsAt))) report(["notices", index, "endsAt"], "종료 시각이 시작보다 빠릅니다");
  });
}

function checkHosts(config: SiteConfig, report: Report): void {
  const allowed = new Set(config.channels.allowedHosts);
  const checkUrl = (url: string, path: Path): void => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      report(path, "주소 형식이 아닙니다");
      return;
    }
    if (parsed.protocol !== "https:") {
      report(path, "https 주소만 쓸 수 있습니다");
      return;
    }
    if (!allowed.has(parsed.hostname)) report(path, `허용 목록에 없는 호스트입니다: ${parsed.hostname}`);
  };
  checkUrl(config.channels.talk.url, ["channels", "talk", "url"]);
  for (const channel of ["naver", "coupang"] as const) {
    for (const [placement, url] of Object.entries(config.channels[channel].urls)) {
      checkUrl(url, ["channels", channel, "urls", placement]);
    }
  }
  config.featuredProducts.forEach((item, index) => checkUrl(item.href, ["featuredProducts", index, "href"]));
}

function checkUniqueIds(items: readonly { readonly id: string }[], section: Path, report: Report): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.id)) report([...section, index, "id"], "같은 id가 이미 있습니다");
    seen.add(item.id);
  });
}

function checkCollections(config: SiteConfig, report: Report): void {
  checkUniqueIds(config.notices, ["notices"], report);
  checkUniqueIds(config.help, ["help"], report);
  checkUniqueIds(config.featuredProducts, ["featuredProducts"], report);
  checkUniqueIds(config.calendar.holidays, ["calendar", "holidays"], report);
  const seenDates = new Set<string>();
  config.calendar.holidays.forEach((period, periodIndex) => {
    period.dates.forEach((date, dateIndex) => {
      if (seenDates.has(date)) report(["calendar", "holidays", periodIndex, "dates", dateIndex], "같은 날짜가 이미 있습니다");
      seenDates.add(date);
    });
  });
  config.featuredProducts.forEach((item, index) => {
    if (!(Date.parse(item.validUntil) > Date.parse(item.validFrom))) report(["featuredProducts", index, "validUntil"], "종료 시각이 시작보다 빠릅니다");
    if (item.priceLabel !== null && item.priceCheckedAt === null) report(["featuredProducts", index, "priceLabel"], "가격에는 확인 시각이 필요합니다");
  });
  config.help.forEach((entry, index) => {
    if (entry.openIn.some((key) => !entry.showIn.includes(key))) {
      report(["help", index, "openIn"], "펼침 상태는 표시 상태 안에서만 고를 수 있습니다");
    }
  });
}

/** superRefine rules for SiteConfigSchema (roadmap §9 invariants + contract addition 13). */
export function checkInvariants(config: SiteConfig, ctx: z.RefinementCtx): void {
  const report: Report = (path, message) => {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path], message });
  };
  checkPlacement(config, report);
  checkStateCopy(config, report);
  checkCopyText(config, report);
  checkDurations(config, report);
  checkLookup(config, report);
  checkNotices(config, report);
  checkHosts(config, report);
  checkCollections(config, report);
}
```

In `lib/config/schema.ts`, change the invariants import to:

```ts
import { RESULT_COPY_SLOTS, checkInvariants } from "@/lib/config/invariants";
```

and replace the line `export const SiteConfigSchema: z.ZodType<SiteConfig, z.ZodTypeDef, unknown> = SiteConfigObjectSchema;` with:

```ts
export const SiteConfigSchema: z.ZodType<SiteConfig, z.ZodTypeDef, unknown> = SiteConfigObjectSchema.superRefine(checkInvariants);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/config.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck; npm run lint`
Expected: `38 passed` (the shipped config and `FIXTURE_CONFIG` still produce no issues); typecheck and lint exit 0.

- [ ] **Step 5: Commit**

```powershell
git add lib/config/invariants.ts lib/config/schema.ts tests/unit/config.spec.ts; git commit -m "feat: enforce config invariants with Korean messages"
```

---

### Task 7: Server config access, build-time validation, storefront URLs and the operator guide

**Files:**
- Create: `lib/config/server.ts`
- Modify: `app/layout.tsx` (one import, one call in `RootLayout`)
- Modify: `lib/storefront.ts:1-3` (the three URL constants)
- Modify: `DEPLOYMENT.md` (append the section '운영 설정 바꾸기')
- Test: `tests/unit/config.spec.ts` (append a describe block and two imports)

**Interfaces:**
- Consumes: `siteConfig`, `channels` (Task 5); `SiteConfigSchema`, `formatConfigIssues` (Tasks 5–6); `kstDateKey`, `addCalendarDays` (Task 2).
- Produces: `getSiteConfig(): SiteConfig` (memoized, logs holiday warnings once), `holidayCoverageWarnings(config: SiteConfig, now: Date): readonly string[]`, `parseSiteConfig(value: unknown): SiteConfig`, `HOLIDAY_WINDOW_DAYS = 60` (contract §11.7 + addition 11). `NAVER_STORE_URL`, `COUPANG_STORE_URL`, `TALK_URL` in `lib/storefront.ts` keep their names and values but read `channels`.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/config.spec.ts`, add below the existing imports:

```ts
import { HOLIDAY_WINDOW_DAYS, getSiteConfig, holidayCoverageWarnings, parseSiteConfig } from "@/lib/config/server";
import { COUPANG_STORE_URL, NAVER_STORE_URL, TALK_URL } from "@/lib/storefront";
```

Append to the end of the file:

```ts
test.describe("server access", () => {
  test("getSiteConfig parses once and returns the shipped values", () => {
    const first = getSiteConfig();
    expect(first).toEqual(siteConfig);
    expect(getSiteConfig()).toBe(first);
  });

  test("parseSiteConfig throws with one Korean line per problem", () => {
    expect(() => parseSiteConfig(withConfig({ durations: { staleDays: 15 } })))
      .toThrow("config/site.config.ts 설정 오류\ndurations.staleDays: 서버 기준(14일)과 같아야 합니다");
  });

  test("holiday coverage warns once per year without data in the next 60 days", () => {
    expect(HOLIDAY_WINDOW_DAYS).toBe(60);
    expect(holidayCoverageWarnings(FIXTURE_CONFIG, new Date("2026-09-26T14:05:00+09:00"))).toEqual([]);
    expect(holidayCoverageWarnings(FIXTURE_CONFIG, new Date("2027-11-15T09:00:00+09:00"))).toEqual([
      "calendar.holidays: 2028년 공휴일이 없습니다. 2028-01-01부터 걱정 기준일 계산에서 공휴일이 빠집니다. 월력요항을 보고 추가해 주세요."
    ]);
    expect(holidayCoverageWarnings(withConfig({ calendar: { holidays: [] } }), new Date("2026-12-10T09:00:00+09:00"))).toEqual([
      "calendar.holidays: 2026년 공휴일이 없습니다. 2026-12-10부터 걱정 기준일 계산에서 공휴일이 빠집니다. 월력요항을 보고 추가해 주세요.",
      "calendar.holidays: 2027년 공휴일이 없습니다. 2027-01-01부터 걱정 기준일 계산에서 공휴일이 빠집니다. 월력요항을 보고 추가해 주세요."
    ]);
  });

  test("the shipped holidays cover the 60 days after the stage date", () => {
    expect(holidayCoverageWarnings(siteConfig, new Date("2026-09-26T14:05:00+09:00"))).toEqual([]);
  });

  test("the legacy storefront constants come from the config channels", () => {
    expect(NAVER_STORE_URL).toBe(channels.naver.urls.showcase);
    expect(COUPANG_STORE_URL).toBe(channels.coupang.urls.showcase);
    expect(TALK_URL).toBe(channels.talk.url);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/config.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — import error for `@/lib/config/server`; no test in the file runs.

- [ ] **Step 3: Write the server module**

Create `lib/config/server.ts`:

```ts
import { siteConfig } from "@/config/site.config";
import { SiteConfigSchema, formatConfigIssues } from "@/lib/config/schema";
import type { SiteConfig } from "@/lib/config/types";
import { addCalendarDays, kstDateKey } from "@/lib/tracking/time";

// Server-only by rule (contract §11.1 rule 4, enforced by tests/unit/module-boundaries.spec.ts): never import from a "use client" file.

export const HOLIDAY_WINDOW_DAYS = 60;

let cachedConfig: SiteConfig | null = null;

/** Parses any value as SiteConfig; throws an Error whose message lists one Korean 'path: message' line per issue. */
export function parseSiteConfig(value: unknown): SiteConfig {
  const result = SiteConfigSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`config/site.config.ts 설정 오류\n${formatConfigIssues(result.error)}`);
  }
  return result.data;
}

/** Korean warnings, one per calendar year that has days in the next 60 (KST) but no holiday data. */
export function holidayCoverageWarnings(config: SiteConfig, now: Date): readonly string[] {
  const coveredYears = new Set(config.calendar.holidays.flatMap((period) => period.dates.map((date) => date.slice(0, 4))));
  const today = kstDateKey(now);
  const warnedYears = new Set<string>();
  const warnings: string[] = [];
  for (let offset = 0; offset < HOLIDAY_WINDOW_DAYS; offset += 1) {
    const day = addCalendarDays(today, offset);
    const year = day.slice(0, 4);
    if (coveredYears.has(year) || warnedYears.has(year)) continue;
    warnedYears.add(year);
    warnings.push(`calendar.holidays: ${year}년 공휴일이 없습니다. ${day}부터 걱정 기준일 계산에서 공휴일이 빠집니다. 월력요항을 보고 추가해 주세요.`);
  }
  return warnings;
}

/** The validated operator config. Parsed once per server process; the first parse logs holiday coverage warnings. */
export function getSiteConfig(): SiteConfig {
  if (cachedConfig !== null) return cachedConfig;
  const parsed = parseSiteConfig(siteConfig);
  for (const warning of holidayCoverageWarnings(parsed, new Date())) {
    console.warn(`[site.config] ${warning}`);
  }
  cachedConfig = parsed;
  return parsed;
}
```

- [ ] **Step 4: Point the legacy storefront constants at the config**

In `lib/storefront.ts`, replace lines 1–3:

```ts
export const NAVER_STORE_URL = "https://mkt.shopping.naver.com/link/6a0bbf9cc55d142f0519328c";
export const COUPANG_STORE_URL = "https://link.coupang.com/a/d7TbzdnS1s";
export const TALK_URL = "https://talk.naver.com/ct/w41rsr";
```

with:

```ts
import { channels } from "@/config/site.config";

// Legacy entry points kept until S08 deletes this file; the values live in config/site.config.ts (channels).
export const NAVER_STORE_URL = channels.naver.urls.showcase;
export const COUPANG_STORE_URL = channels.coupang.urls.showcase;
export const TALK_URL = channels.talk.url;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/config.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck`
Expected: `43 passed`; typecheck exits 0.

- [ ] **Step 6: Validate the config during `next build`**

In `app/layout.tsx`, add below `import type { Metadata } from "next";`:

```ts
import { getSiteConfig } from "@/lib/config/server";
```

and make the first statement inside `export default function RootLayout(...) {` (before `return (`):

```tsx
  // Validates config/site.config.ts: an invalid operator config fails `next build` with Korean 'path: message' lines.
  getSiteConfig();
```

Run: `npm run build`
Expected: exit 0; the route table is unchanged from the Task 0 baseline; no `[site.config]` warning lines (2026 and 2027 holidays cover the next 60 days).

- [ ] **Step 7: Prove that a broken config stops the build, then restore it**

With the Edit tool, change `staleDays: 14,` to `staleDays: 15,` in `config/site.config.ts` (do not commit). Run: `npm run build`
Expected: the build fails (non-zero exit) while prerendering; the output contains `config/site.config.ts 설정 오류` and `durations.staleDays: 서버 기준(14일)과 같아야 합니다`.
Restore: `git checkout -- config/site.config.ts; git status --short config/site.config.ts`
Expected: no output. Run `npm run build` again → exit 0.

- [ ] **Step 8: Write the operator guide section**

Append to the end of `DEPLOYMENT.md`:

````markdown
## 운영 설정 바꾸기

공지·연휴·채널 링크·제휴 고지·추천 상품·상태 문구는 `config/site.config.ts` 한 파일에 있습니다. 코드는 고치지 않습니다. 변경은 한 달에 1~2번을 기준으로 하고(운영자 확인 기본값), 배포 없이 바꾸는 저장소(Edge Config)는 쓰지 않습니다.

### 바꾸는 순서

1. GitHub에서 `config/site.config.ts`를 열고 연필(Edit) 버튼을 누릅니다.
2. 값을 고친 뒤 "Create a new branch for this commit and start a pull request"를 골라 PR을 만듭니다.
3. PR의 CI가 초록색인지 봅니다. 빨간색이면 로그의 `config/site.config.ts 설정 오류` 아래 줄이 고칠 곳입니다. 예: `notices[0].endsAt: 종료 시각이 시작보다 빠릅니다`.
4. 초록색이면 PR을 `main`에 합칩니다. Vercel이 몇 분 안에 자동 배포합니다.

### 빌드가 검사하는 규칙

- 실제 고객 번호를 넣지 않습니다. 10자리 이상 숫자와 영문 3~4자+숫자(HBL 형식)는 어떤 문구에도 쓸 수 없습니다. 예시가 필요하면 `0000 0000 0000`처럼 0만 씁니다.
- 'AI·인공지능·로봇·봇' 표현은 쓸 수 없습니다.
- 상태 문구(`stateGuide`)에는 `{etaDate}` `{worryDate}` `{lastEventDate}` `{carrier}` `{staleDays}`만 씁니다. 공지·도움말·추천에는 토큰을 쓰지 않습니다.
- 문제 상태(오류·정체·택배사 조회 지연·택배사 선택)에는 스토어·추천·광고를 둘 수 없습니다. 배송 중에는 스토어를 둘 수 없고, 배송 완료는 스토어가 먼저 오며, 국내 도착 전에는 문의와 구매처 선택지가 모두 있어야 합니다.
- 제휴 링크(쿠팡)가 있으면 `disclosures.coupang` 고지 문구가 있어야 합니다.
- 링크는 https만, `channels.allowedHosts`에 있는 호스트만 씁니다.
- `durations.staleDays`는 서버 기준 14일과 같아야 합니다. 걱정 기준 일수를 바꾸면 그 일수가 들어간 문구(`stateGuide.notFound.worry` 등)도 같이 바꿉니다.

### 공지 넣기

`notices` 목록에 한 건을 추가합니다. 시작·종료 시각은 한국 시간(`+09:00`)으로 쓰고, 시작 시각에 켜지고 종료 시각에 꺼집니다. 제목 20자, 본문 80자 이하이며 한 화면에 1개만 보입니다(우선순위: 장애 > 지연 > 연휴 > 안내). 조회 중·일시 지연 화면에는 장애(`outage`) 공지만 보입니다. 페이지를 열 때 소리로 읽어 주지는 않습니다.

UNI-PASS 점검(장애) 공지:

```ts
{
  id: "2026-10-unipass-maintenance",
  kind: "outage",
  title: "UNI-PASS 점검 안내",
  body: "UNI-PASS 점검(22:00~24:00) 중에는 통관 정보가 늦게 보일 수 있어요.",
  startsAt: "2026-10-20T22:00:00+09:00",
  endsAt: "2026-10-21T00:00:00+09:00",
  home: true,
  guideKeys: ["loading", "temporaryDelay", "noResponse", "offline", "notFound", "customsArrived", "customsWaiting"],
  cs: true
}
```

택배 없는 날(지연) 공지:

```ts
{
  id: "2027-no-delivery-day",
  kind: "delay",
  title: "택배 없는 날 안내",
  body: "택배 없는 날에는 택배사가 쉬어요. 다음 영업일부터 순서대로 배송돼요.",
  startsAt: "2027-08-12T00:00:00+09:00",
  endsAt: "2027-08-17T00:00:00+09:00",
  home: true,
  guideKeys: ["handedToCarrier", "pickedUp", "inTransit"],
  cs: true
}
```

설·추석 공지는 `2026-chuseok` 항목을 복사해 날짜와 문구만 바꿉니다.

### 공휴일 넣기(매년 6월 말)

우주항공청·한국천문연구원이 매년 6월 말에 다음 해 월력요항을 발표합니다. `calendar.holidays`에 다음 해 공휴일과 대체공휴일을 모두 넣습니다(날짜는 `YYYY-MM-DD`). 앞으로 60일 안에 공휴일 정보가 없는 해가 있으면 빌드 로그에 `[site.config] calendar.holidays: 2028년 공휴일이 없습니다…` 경고가 나옵니다. 연휴 배지(`badge`)는 도착 예상 옆에 붙고, 연휴가 계산 구간과 겹치면 D-표기와 '오늘 예상'을 숨깁니다. 걱정 기준일은 공휴일과 주말을 뺀 영업일로 계산합니다.

### 추천 상품

`featuredProducts`에 상품 상세 https 주소(`href`)와 유효기간(`validFrom`·`validUntil`, `+09:00`)을 넣습니다. 유효기간이 지나면 자동으로 숨고, 가격(`priceLabel`)은 확인 시각(`priceCheckedAt`)과 함께일 때만 적습니다. 지금 항목은 스토어 홈 주소를 가리키므로 상품 상세 주소로 바꿔 주세요.

### 소요 기간과 걱정 기준(기본값)

| 항목 | 값 |
|---|---|
| HBL 조회 가능 | 해외 출고 후 3~7일 |
| 통관 | 1~2일 |
| 택배사 인계 | 0~1영업일 |
| 국내 배송 | 1~2일 |
| 걱정 기준 | 예상일 + 1영업일(통관 완료·인계는 + 2영업일) |
| 결과 없음 / 국내 도착 전 | 7일 / 10일 |
| 배송 완료인데 못 받음 | 24시간 |
| 토요일 배송 | 계산에 넣지 않음(`calendar.carrierDeliversSaturday: false`) |

### 승인 항목과 연결된 값

- `durations.pendingRecheck`, `channels.*.urls.pending`: 승인 4
- `disclosures.coupang`: 승인 9(법무 확인 뒤 확정형 문언)
- `lookup.timeoutMs`, `lookup.notFoundServiceCaveat`, `lookup.stageMs`: 서버 개선(승인 5) 배포 뒤 바뀝니다
- `ads.manualSlotId`: 승인 15
````

- [ ] **Step 9: Run the full unit suite, lint and commit**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run lint`
Expected: 0 failed (S01's `tests/unit/real-number-guard.spec.ts` included — the new files contain no disallowed digit runs); lint exits 0.

```powershell
git add lib/config/server.ts app/layout.tsx lib/storefront.ts DEPLOYMENT.md tests/unit/config.spec.ts; git commit -m "feat: validate the site config at build time and document operator edits"
```

### Task 8: Inquiry copy (build and parse)

**Files:**
- Create: `lib/tracking/inquiry-copy.ts`
- Test: `tests/unit/inquiry-copy.spec.ts`

**Interfaces:**
- Consumes: `NumberView` (Task 1); `formatKstShortDateTime` (Task 2); `identifyTrackingNumber` from `@/lib/services/identifier` (frozen, zod-free); `FAKE`, `FAKE_GROUPED`, `FIXTURE_NOW` (S01 fixtures).
- Produces (contract §11.8): `buildInquiryCopy(input: { kind: "status"; number: NumberView; stage: string; lastEventAt: Date | null } | { kind: "screenError"; number: NumberView; now: Date }): string` and `parseInquiryCopy(text: string): { readonly number: string } | null`. The format strings are a protocol shared with the CS desk (S09) and stay in this module.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/inquiry-copy.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { buildInquiryCopy, parseInquiryCopy } from "@/lib/tracking/inquiry-copy";
import { FAKE, FAKE_GROUPED, FIXTURE_NOW } from "../fixtures/tracking-fixtures";

const DOMESTIC = { raw: FAKE.domestic, grouped: FAKE_GROUPED.domestic };
const HBL = { raw: FAKE.hbl, grouped: FAKE_GROUPED.hbl };
const toFullWidth = (text: string): string =>
  text.replace(/[0-9A-Za-z]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0xfee0));
const hyphenated = `${FAKE.domestic.slice(0, 4)}-${FAKE.domestic.slice(4, 8)}-${FAKE.domestic.slice(8)}`;

test("status copy: number, last stage and last event time in KST", () => {
  expect(buildInquiryCopy({ kind: "status", number: DOMESTIC, stage: "통관 대기", lastEventAt: new Date("2026-09-23T14:10:00+09:00") }))
    .toBe(`[배송 문의] 조회번호 ${FAKE_GROUPED.domestic} / 마지막 단계 통관 대기 / 마지막 처리 9월 23일 14:10`);
});

test("status copy without any event leaves out the last-event part", () => {
  expect(buildInquiryCopy({ kind: "status", number: HBL, stage: "국내 도착 전", lastEventAt: null }))
    .toBe(`[배송 문의] 조회번호 ${FAKE_GROUPED.hbl} / 마지막 단계 국내 도착 전`);
});

test("screen-error copy carries the time of the error", () => {
  expect(buildInquiryCopy({ kind: "screenError", number: DOMESTIC, now: FIXTURE_NOW }))
    .toBe(`[배송 문의] 조회번호 ${FAKE_GROUPED.domestic} / 조회 화면 오류 / 9월 26일 14:05`);
});

test("the CS side reads the number back from both formats", () => {
  const status = buildInquiryCopy({ kind: "status", number: DOMESTIC, stage: "통관 대기", lastEventAt: null });
  const screenError = buildInquiryCopy({ kind: "screenError", number: HBL, now: FIXTURE_NOW });
  expect(parseInquiryCopy(status)).toEqual({ number: FAKE.domestic });
  expect(parseInquiryCopy(screenError)).toEqual({ number: FAKE.hbl });
});

test("chat text around the copy, line breaks, hyphens and full-width characters still parse", () => {
  const pasted = `안녕하세요\n[배송 문의] 조회번호 ${FAKE_GROUPED.domestic} / 마지막 단계 통관 대기\n확인 부탁드려요`;
  expect(parseInquiryCopy(pasted)).toEqual({ number: FAKE.domestic });
  expect(parseInquiryCopy(`조회번호: ${toFullWidth(FAKE_GROUPED.hbl)}`)).toEqual({ number: FAKE.hbl });
  expect(parseInquiryCopy(`조회번호\n${hyphenated}`)).toEqual({ number: FAKE.domestic });
});

test("never guesses: words after the number, a short number, no label or an empty label give null", () => {
  expect(parseInquiryCopy(`조회번호 ${FAKE_GROUPED.domestic} 9월 23일 도착 예정`)).toBeNull();
  expect(parseInquiryCopy(`조회번호 ${FAKE.invalidShort}`)).toBeNull();
  expect(parseInquiryCopy(`[배송 문의] ${FAKE_GROUPED.domestic}`)).toBeNull();
  expect(parseInquiryCopy("조회번호 / 마지막 단계 통관 대기")).toBeNull();
});

test("the first label wins", () => {
  expect(parseInquiryCopy(`조회번호 ${FAKE_GROUPED.domestic} / 조회번호 ${FAKE_GROUPED.hbl}`)).toEqual({ number: FAKE.domestic });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/inquiry-copy.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — import error for `@/lib/tracking/inquiry-copy`.

- [ ] **Step 3: Write the implementation**

Create `lib/tracking/inquiry-copy.ts`:

```ts
import { identifyTrackingNumber } from "@/lib/services/identifier";
import { formatKstShortDateTime } from "@/lib/tracking/time";
import type { NumberView } from "@/lib/tracking/types";

// Protocol strings shared with the CS desk (S09 parses them), so they live here and not in the operator config.
const PREFIX = "[배송 문의]";
const NUMBER_LABEL = "조회번호";
const STAGE_LABEL = "마지막 단계";
const LAST_EVENT_LABEL = "마지막 처리";
const SCREEN_ERROR = "조회 화면 오류";
const SEPARATOR = " / ";

const FULL_WIDTH_ALNUM = /[０-９Ａ-Ｚａ-ｚ]/g;
const FULL_WIDTH_OFFSET = 0xfee0;
/** The text after '조회번호' up to the next ' /' or line break. */
const LABEL_SEGMENT = /조회번호[\s:：]*([^/\n\r]*)/;
/** Letters and digits, single spaces or hyphens between them, nothing else. */
const CLEAN_SEGMENT = /^[A-Za-z0-9](?:[A-Za-z0-9 　-]*[A-Za-z0-9])?$/;

export function buildInquiryCopy(
  input:
    | { readonly kind: "status"; readonly number: NumberView; readonly stage: string; readonly lastEventAt: Date | null }
    | { readonly kind: "screenError"; readonly number: NumberView; readonly now: Date }
): string {
  const head = `${PREFIX} ${NUMBER_LABEL} ${input.number.grouped}`;
  if (input.kind === "screenError") {
    return [head, SCREEN_ERROR, formatKstShortDateTime(input.now)].join(SEPARATOR);
  }
  const parts = [head, `${STAGE_LABEL} ${input.stage}`];
  if (input.lastEventAt !== null) parts.push(`${LAST_EVENT_LABEL} ${formatKstShortDateTime(input.lastEventAt)}`);
  return parts.join(SEPARATOR);
}

/** The number after '조회번호' when that segment is a clean identifier; otherwise null (never a guess). */
export function parseInquiryCopy(text: string): { readonly number: string } | null {
  const halfWidth = text.replace(FULL_WIDTH_ALNUM, (char) => String.fromCharCode(char.charCodeAt(0) - FULL_WIDTH_OFFSET));
  const segment = LABEL_SEGMENT.exec(halfWidth)?.[1].trim() ?? "";
  if (!CLEAN_SEGMENT.test(segment)) return null;
  const number = segment.replace(/[ 　-]/g, "").toUpperCase();
  return identifyTrackingNumber(number).type === "UNKNOWN" ? null : { number };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/inquiry-copy.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck`
Expected: `7 passed`; typecheck exits 0.

- [ ] **Step 5: Commit**

```powershell
git add lib/tracking/inquiry-copy.ts tests/unit/inquiry-copy.spec.ts; git commit -m "feat: add the inquiry copy format and its safe parser"
```

---

### Task 9: State keys, worry dates and overdue (with the per-state scenario fixtures)

**Files:**
- Create: `tests/fixtures/derive-scenarios.ts`
- Create: `lib/tracking/derive/events.ts`, `lib/tracking/derive/keys.ts`, `lib/tracking/derive/worry.ts`
- Create: `lib/tracking/derive-view.ts` (contract exports `guideKeyForData`, `worryDateKey`, `isOverdue`; Task 10 adds `deriveTrackingView`)
- Test: `tests/unit/derive-view.spec.ts`

**Interfaces:**
- Consumes: `normalizeTrackingData` (frozen, fixtures only); `SiteConfig` (Task 1); time helpers (Task 2); `FIXTURE_CONFIG` (Task 5); `FAKE`, `FIXTURE_NOW` (S01).
- Produces: contract §11.8 `guideKeyForData(data, now, config): GuideKey`, `worryDateKey(data, key, config): KstDateKey | null`, `isOverdue(worry, now): boolean` (worry bases per contract addition 8, stale-from-now per addition 9); private `TimedEvent`, `timedEvents`, `latestEvent`, `hasAnyEvent`, `DataGuideKey`, `CodeGuideKey`, `codeGuideKey`, `dataGuideKey`, `ctaStateFor`, `isoToKey`; fixture exports `CJ_URL`, `OCTOBER_NOW`, `PICKUP_NOW`, `MOVED_NOW`, `AUTO_LOOKUP`, `ev`, `cjLookup`, `customsArrivedData`, `customsWaitingData`, `customsReviewData`, `customsClearedData`, `carrierCutData`, `pickedUpData`, `handedToCarrierData`, `inTransitData`, `pendingData`, `deliveredData`, `staleData`, `lookupUnavailableData`, `ambiguousData`, `movedEstimateData`, `request`, `success`, `failure`.

- [ ] **Step 1: Write the scenario fixtures**

Create `tests/fixtures/derive-scenarios.ts`:

```ts
import { normalizeTrackingData } from "@/lib/services/normalizer";
import type { FailureCause, LookupOutcome, LookupRequest } from "@/lib/tracking/types";
import type { DeliveryCarrierCode, DeliveryLookupResult, StatusCode, TrackResponseData, TrackingEvent } from "@/lib/types";
import { FAKE, FIXTURE_NOW } from "./tracking-fixtures";

/** Explicit, hand-checked inputs for the per-state rows of derive-view.spec.ts and cs-reply.spec.ts (2026 dates, 추석 9/24–26). */
export const CJ_URL = `https://trace.cjlogistics.com/next/tracking.html?wblNo=${FAKE.domestic}`;
export const OCTOBER_NOW = new Date("2026-10-14T10:00:00+09:00"); // Wednesday, no holiday nearby
export const PICKUP_NOW = new Date("2026-10-08T18:00:00+09:00");  // the day before 한글날
export const MOVED_NOW = new Date("2026-09-22T12:00:00+09:00");

export function ev(
  status: string, statusCode: StatusCode, datetime: string, location?: string, extra: Partial<TrackingEvent> = {}
): TrackingEvent {
  return { status, statusCode, datetime, ...(location === undefined ? {} : { location }), ...extra };
}

export const AUTO_LOOKUP: DeliveryLookupResult = { carrier: "택배사 자동 확인", carrierCode: "AUTO", events: [] };

export function cjLookup(
  events: readonly TrackingEvent[], flags: { readonly lookupUnavailable?: boolean; readonly ambiguous?: boolean } = {}
): DeliveryLookupResult {
  return { carrier: "CJ대한통운", carrierCode: "CJ", trackingUrl: CJ_URL, events: [...events], ...flags };
}

const SEPTEMBER_CLEARED = [
  ev("입항", 1, "2026-09-22T08:40:00+09:00", "인천공항"),
  ev("통관목록접수", 2, "2026-09-22T14:12:00+09:00", "인천공항세관"),
  ev("수입신고수리", 4, "2026-09-23T10:05:00+09:00", "인천공항세관")
];
const OCTOBER_CUSTOMS = [
  ev("통관목록접수", 2, "2026-10-06T10:00:00+09:00", "인천공항세관"),
  ev("수입신고수리", 4, "2026-10-07T11:00:00+09:00", "인천공항세관")
];
const PICKUP = ev("집화처리", 5, "2026-10-08T17:00:00+09:00", "인천GW", { detail: "보내시는 고객님으로부터 상품을 인수받았습니다" });

/** HBL, code 1 only (입항 9/25 21:00). */
export function customsArrivedData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.hbl, type: "HBL", customsEvents: [ev("입항", 1, "2026-09-25T21:00:00+09:00", "인천공항")],
    deliveryLookup: AUTO_LOOKUP, now: FIXTURE_NOW
  });
}

/** HBL, code 2 (통관목록접수 9/23 14:10); the server moves the customs estimate to 9/26. */
export function customsWaitingData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.hbl, type: "HBL",
    customsEvents: [ev("입항", 1, "2026-09-22T08:40:00+09:00", "인천공항"), ev("통관목록접수", 2, "2026-09-23T14:10:00+09:00", "인천공항세관")],
    deliveryLookup: AUTO_LOOKUP, now: FIXTURE_NOW
  });
}

/** HBL, code 3, recent. */
export function customsReviewData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.hbl, type: "HBL",
    customsEvents: [
      ev("입항", 1, "2026-09-24T21:00:00+09:00", "인천공항"),
      ev("통관목록접수", 2, "2026-09-25T10:00:00+09:00", "인천공항세관"),
      ev("통관목록심사", 3, "2026-09-25T15:00:00+09:00", "인천공항세관")
    ],
    deliveryLookup: AUTO_LOOKUP, now: FIXTURE_NOW
  });
}

/** Domestic, code 4 on 9/23 10:05 (spec example: handoff worry date 9/29). */
export function customsClearedData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: SEPTEMBER_CLEARED, deliveryLookup: AUTO_LOOKUP, now: FIXTURE_NOW
  });
}

/** Customs events plus a carrier lookup that timed out (code-based state with a cut spine). */
export function carrierCutData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: SEPTEMBER_CLEARED,
    deliveryLookup: cjLookup([], { lookupUnavailable: true }), now: FIXTURE_NOW
  });
}

export function pickedUpData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: OCTOBER_CUSTOMS, deliveryLookup: cjLookup([PICKUP]), now: PICKUP_NOW
  });
}

export function handedToCarrierData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: OCTOBER_CUSTOMS,
    deliveryLookup: cjLookup([ev("간선상차", 5, "2026-10-08T17:00:00+09:00", "인천GW")]), now: PICKUP_NOW
  });
}

/** Code 6 out for delivery on 10/12 08:15 with a driver phone; read on 10/14 (estimate moved to today). */
export function inTransitData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: OCTOBER_CUSTOMS,
    deliveryLookup: cjLookup([PICKUP, ev("배송출발", 6, "2026-10-12T08:15:00+09:00", "서울강남", { driverPhone: FAKE.phone })]),
    now: OCTOBER_NOW
  });
}

export function pendingData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: [], deliveryLookup: AUTO_LOOKUP, now: FIXTURE_NOW
  });
}

export function deliveredData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC",
    customsEvents: [ev("수입신고수리", 4, "2026-09-23T10:05:00+09:00", "인천공항세관")],
    deliveryLookup: cjLookup([
      ev("집화처리", 5, "2026-09-24T09:00:00+09:00", "인천GW"),
      ev("배송출발", 6, "2026-09-25T08:00:00+09:00", "서울강남"),
      ev("배송완료", 7, "2026-09-25T14:32:00+09:00", "문 앞")
    ]),
    now: FIXTURE_NOW
  });
}

/** Last event 9/6 10:00, 20 days before FIXTURE_NOW → estimateStale. */
export function staleData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC",
    customsEvents: [ev("통관목록접수", 2, "2026-09-05T09:00:00+09:00", "인천공항세관"), ev("통관목록심사", 3, "2026-09-06T10:00:00+09:00", "인천공항세관")],
    deliveryLookup: AUTO_LOOKUP, now: FIXTURE_NOW
  });
}

export function lookupUnavailableData(carrier: "AUTO" | "CJ"): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: [],
    deliveryLookup: carrier === "CJ" ? cjLookup([], { lookupUnavailable: true }) : { ...AUTO_LOOKUP, lookupUnavailable: true },
    now: FIXTURE_NOW
  });
}

export function ambiguousData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: [], deliveryLookup: { ...AUTO_LOOKUP, ambiguous: true }, now: FIXTURE_NOW
  });
}

/** 통관목록접수 9/15 read on 9/22: the server moved the customs estimate from 9/16 to 9/22. */
export function movedEstimateData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC",
    customsEvents: [ev("통관목록접수", 2, "2026-09-15T10:00:00+09:00", "인천공항세관")],
    deliveryLookup: AUTO_LOOKUP, now: MOVED_NOW
  });
}

export function request(number: string, carrier: DeliveryCarrierCode = "AUTO"): LookupRequest {
  return { number, carrier, entry: "manual" };
}

export function success(data: TrackResponseData, carrier: DeliveryCarrierCode = "AUTO"): LookupOutcome {
  return { kind: "success", request: request(data.trackingNumber, carrier), data };
}

export function failure(
  cause: FailureCause,
  options: { readonly consecutiveFailures?: number; readonly carrier?: DeliveryCarrierCode; readonly number?: string } = {}
): LookupOutcome {
  return {
    kind: "failure",
    request: request(options.number ?? FAKE.domestic, options.carrier ?? "AUTO"),
    cause,
    consecutiveFailures: options.consecutiveFailures ?? 1
  };
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/derive-view.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { guideKeyForData, isOverdue, worryDateKey } from "@/lib/tracking/derive-view";
import type { GuideKey } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";
import { FIXTURE_CONFIG } from "../fixtures/config-fixtures";
import {
  MOVED_NOW, OCTOBER_NOW, PICKUP_NOW, ambiguousData, carrierCutData, customsArrivedData, customsClearedData, customsReviewData,
  customsWaitingData, deliveredData, handedToCarrierData, inTransitData, lookupUnavailableData, movedEstimateData, pendingData,
  pickedUpData, staleData
} from "../fixtures/derive-scenarios";
import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";

const CONFIG = FIXTURE_CONFIG;
const at = (iso: string): Date => new Date(iso);

interface KeyRow { readonly name: string; readonly data: TrackResponseData; readonly now: Date; readonly key: GuideKey }

const cleared = customsClearedData();
const KEY_ROWS: readonly KeyRow[] = [
  { name: "ambiguous with 0 events", data: ambiguousData(), now: FIXTURE_NOW, key: "ambiguous" },
  { name: "carrier lookup delay with 0 events", data: lookupUnavailableData("AUTO"), now: FIXTURE_NOW, key: "lookupUnavailable" },
  { name: "pending (domestic, no record)", data: pendingData(), now: FIXTURE_NOW, key: "pending" },
  { name: "delivered", data: deliveredData(), now: FIXTURE_NOW, key: "delivered" },
  { name: "delivered wins over a stale flag", data: { ...deliveredData(), estimateStale: true }, now: FIXTURE_NOW, key: "delivered" },
  { name: "stale by the server flag", data: staleData(), now: FIXTURE_NOW, key: "stale" },
  { name: "stale when read 15 days after the last event", data: customsWaitingData(), now: at("2026-10-08T14:10:00+09:00"), key: "stale" },
  { name: "exactly 14 days is not stale yet", data: customsWaitingData(), now: at("2026-10-07T14:10:00+09:00"), key: "customsWaiting" },
  { name: "in transit (code 6)", data: inTransitData(), now: OCTOBER_NOW, key: "inTransit" },
  { name: "picked up (code 5, 집화)", data: pickedUpData(), now: PICKUP_NOW, key: "pickedUp" },
  { name: "handed to carrier (code 5, not a pickup)", data: handedToCarrierData(), now: PICKUP_NOW, key: "handedToCarrier" },
  { name: "customs cleared (code 4)", data: cleared, now: FIXTURE_NOW, key: "customsCleared" },
  { name: "carrier delay with customs events stays code-based", data: carrierCutData(), now: FIXTURE_NOW, key: "customsCleared" },
  { name: "several carriers with customs events stays code-based", data: { ...cleared, delivery: { ...cleared.delivery, ambiguous: true } }, now: FIXTURE_NOW, key: "customsCleared" },
  { name: "customs waiting (code 2)", data: customsWaitingData(), now: FIXTURE_NOW, key: "customsWaiting" },
  { name: "customs review (code 3)", data: customsReviewData(), now: FIXTURE_NOW, key: "customsWaiting" },
  { name: "arrived (code 1)", data: customsArrivedData(), now: FIXTURE_NOW, key: "customsArrived" }
];

test.describe("guide keys from data (priority order)", () => {
  for (const row of KEY_ROWS) {
    test(row.name, () => {
      expect(guideKeyForData(row.data, row.now, CONFIG)).toBe(row.key);
    });
  }
});

test.describe("worry dates", () => {
  test("customs waiting: the moved estimate is capped by the last customs event + 2 days, then + 1 business day", () => {
    expect(worryDateKey(customsWaitingData(), "customsWaiting", CONFIG)).toBe("2026-09-28");
  });

  test("arrived: estimate 9/27 (Sun) + 1 business day", () => {
    expect(worryDateKey(customsArrivedData(), "customsArrived", CONFIG)).toBe("2026-09-28");
  });

  test("customs cleared: spec example 9/23 → 9/29 (추석 and the weekend skipped)", () => {
    expect(worryDateKey(customsClearedData(), "customsCleared", CONFIG)).toBe("2026-09-29");
  });

  test("picked up or handed over: 2 business days after the latest progress, skipping 한글날 and the weekend", () => {
    expect(worryDateKey(pickedUpData(), "pickedUp", CONFIG)).toBe("2026-10-13");
    expect(worryDateKey(handedToCarrierData(), "handedToCarrier", CONFIG)).toBe("2026-10-13");
  });

  test("in transit: delivery estimate + 1 delivery business day", () => {
    expect(worryDateKey(inTransitData(), "inTransit", CONFIG)).toBe("2026-10-15");
  });

  test("an estimate the server moved to today no longer moves the worry date", () => {
    expect(worryDateKey(movedEstimateData(), "customsWaiting", CONFIG)).toBe("2026-09-18");
    expect(isOverdue("2026-09-18", MOVED_NOW)).toBe(true);
  });

  test("states without a date-based worry line", () => {
    expect(worryDateKey(pendingData(), "pending", CONFIG)).toBeNull();
    expect(worryDateKey(deliveredData(), "delivered", CONFIG)).toBeNull();
    expect(worryDateKey(staleData(), "stale", CONFIG)).toBeNull();
    expect(worryDateKey(lookupUnavailableData("AUTO"), "lookupUnavailable", CONFIG)).toBeNull();
    expect(worryDateKey(ambiguousData(), "ambiguous", CONFIG)).toBeNull();
  });
});

function overdueBoundaryRows(): void {
  const worry = "2026-09-28";

  test("overdue: day before, day of, day after (KST)", () => {
    expect(isOverdue(worry, at("2026-09-27T12:00:00+09:00"))).toBe(false);
    expect(isOverdue(worry, at("2026-09-28T12:00:00+09:00"))).toBe(false);
    expect(isOverdue(worry, at("2026-09-29T09:00:00+09:00"))).toBe(true);
  });

  test("overdue flips exactly at KST midnight", () => {
    expect(isOverdue(worry, at("2026-09-28T23:59:59+09:00"))).toBe(false);
    expect(isOverdue(worry, at("2026-09-29T00:00:00+09:00"))).toBe(true);
    expect(isOverdue(worry, at("2026-09-28T15:00:00Z"))).toBe(true);
  });
}

test.describe("overdue", () => {
  overdueBoundaryRows();

  test("no worry date is never overdue", () => {
    expect(isOverdue(null, at("2030-01-01T00:00:00+09:00"))).toBe(false);
  });
});

test.describe("state keys and dates in America/New_York", () => {
  let previousTz: string | undefined;

  test.beforeAll(() => {
    previousTz = process.env.TZ;
    process.env.TZ = "America/New_York";
  });

  test.afterAll(() => {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  });

  test("keys and worry dates do not depend on the device time zone", () => {
    expect(new Date("2026-09-26T00:00:00Z").getHours()).toBe(20);
    expect(guideKeyForData(customsWaitingData(), FIXTURE_NOW, CONFIG)).toBe("customsWaiting");
    expect(worryDateKey(customsWaitingData(), "customsWaiting", CONFIG)).toBe("2026-09-28");
    expect(worryDateKey(inTransitData(), "inTransit", CONFIG)).toBe("2026-10-15");
  });

  overdueBoundaryRows();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/derive-view.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — import error for `@/lib/tracking/derive-view`.

- [ ] **Step 4: Write the implementation**

Create `lib/tracking/derive/events.ts`:

```ts
import { parseInstant } from "@/lib/tracking/time";
import type { TrackResponseData, TrackingEvent } from "@/lib/types";

// Private helper of lib/tracking/derive-view.ts (roadmap §10.2): not imported by other stages.

export interface TimedEvent {
  readonly event: TrackingEvent;
  readonly at: Date;
  readonly source: "customs" | "delivery";
}

function withTimes(events: readonly TrackingEvent[], source: TimedEvent["source"]): TimedEvent[] {
  return events.flatMap((event) => {
    const at = parseInstant(event.datetime);
    return at === null ? [] : [{ event, at, source }];
  });
}

/** Customs and delivery events with a parsable time, oldest first. Events with broken times are skipped. */
export function timedEvents(data: TrackResponseData): readonly TimedEvent[] {
  return [...withTimes(data.customs.events, "customs"), ...withTimes(data.delivery.events, "delivery")]
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function latestEvent(
  events: readonly TimedEvent[], predicate: (item: TimedEvent) => boolean = () => true
): TimedEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const item = events[index];
    if (predicate(item)) return item;
  }
  return null;
}

/** Raw event count as the normalizer sees it (broken times included). */
export function hasAnyEvent(data: TrackResponseData): boolean {
  return data.customs.events.length + data.delivery.events.length > 0;
}
```

Create `lib/tracking/derive/keys.ts`:

```ts
import type { SiteConfig } from "@/lib/config/types";
import { hasAnyEvent, latestEvent, timedEvents } from "@/lib/tracking/derive/events";
import type { CtaState, GuideKey } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

export type DataGuideKey = Extract<
  GuideKey,
  "pending" | "customsArrived" | "customsWaiting" | "customsCleared" | "handedToCarrier" | "pickedUp"
  | "inTransit" | "delivered" | "stale" | "lookupUnavailable" | "ambiguous"
>;
export type CodeGuideKey = Extract<
  DataGuideKey, "customsArrived" | "customsWaiting" | "customsCleared" | "handedToCarrier" | "pickedUp" | "inTransit" | "delivered"
>;

const PICKUP_PATTERN = /(집화|집하|상품\s*인수)/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The state the status code alone implies (ignores pending/stale/carrier problems). */
export function codeGuideKey(data: TrackResponseData): CodeGuideKey {
  switch (data.currentStatusCode) {
    case 7:
      return "delivered";
    case 6:
      return "inTransit";
    case 5:
      return PICKUP_PATTERN.test(data.currentStatus) ? "pickedUp" : "handedToCarrier";
    case 4:
      return "customsCleared";
    case 3:
    case 2:
      return "customsWaiting";
    case 1:
      return "customsArrived";
  }
}

/** Same rule as the server (lib/services/normalizer.ts): no new event for more than staleDays, except delivered. */
function isStaleAt(data: TrackResponseData, now: Date, staleDays: number): boolean {
  if (data.currentStatusCode === 7) return false;
  const latest = latestEvent(timedEvents(data));
  return latest !== null && now.getTime() - latest.at.getTime() > staleDays * DAY_MS;
}

/** Priority: ambiguous(0 events) > lookupUnavailable(0 events) > pending > delivered > stale > code-based. */
export function dataGuideKey(data: TrackResponseData, now: Date, config: SiteConfig): DataGuideKey {
  const hasEvents = hasAnyEvent(data);
  if (data.delivery.ambiguous === true && !hasEvents) return "ambiguous";
  if (data.delivery.lookupUnavailable === true && !hasEvents) return "lookupUnavailable";
  if (data.isPending === true) return "pending";
  if (data.currentStatusCode === 7) return "delivered";
  if (data.estimateStale === true || isStaleAt(data, now, config.durations.staleDays)) return "stale";
  return codeGuideKey(data);
}

export function ctaStateFor(key: DataGuideKey): CtaState {
  switch (key) {
    case "pending":
      return "pending";
    case "customsArrived":
    case "customsWaiting":
      return "customsWaiting";
    case "customsCleared":
    case "handedToCarrier":
    case "pickedUp":
      return "customsCleared";
    case "inTransit":
    case "delivered":
    case "stale":
    case "lookupUnavailable":
    case "ambiguous":
      return key;
  }
}
```

Create `lib/tracking/derive/worry.ts`:

```ts
import type { SiteConfig } from "@/lib/config/types";
import { latestEvent, timedEvents } from "@/lib/tracking/derive/events";
import type { TimedEvent } from "@/lib/tracking/derive/events";
import { addCalendarDays, businessDaysAfter, kstDateKey, parseInstant } from "@/lib/tracking/time";
import type { KstDateKey } from "@/lib/tracking/time";
import type { GuideKey } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

export function isoToKey(iso: string | undefined): KstDateKey | null {
  if (iso === undefined) return null;
  const instant = parseInstant(iso);
  return instant === null ? null : kstDateKey(instant);
}

function eventKey(item: TimedEvent | null): KstDateKey | null {
  return item === null ? null : kstDateKey(item.at);
}

function earlier(a: KstDateKey | null, b: KstDateKey | null): KstDateKey | null {
  if (a === null) return b;
  if (b === null) return a;
  return a < b ? a : b;
}

function later(a: KstDateKey | null, b: KstDateKey | null): KstDateKey | null {
  if (a === null) return b;
  if (b === null) return a;
  return a > b ? a : b;
}

function plusDays(base: KstDateKey | null, days: number): KstDateKey | null {
  return base === null ? null : addCalendarDays(base, days);
}

/**
 * The date after which an unchanged state becomes overdue (contract §11.6 "Worry dates", clarified by S03 addition 8):
 * estimates the server moved to "today" are capped by the last event + the stage maximum, so the date does not move daily.
 */
export function worryDateKey(data: TrackResponseData, key: GuideKey, config: SiteConfig): KstDateKey | null {
  const events = timedEvents(data);
  const { stages, worry } = config.durations;
  const lastCustoms = eventKey(latestEvent(events, (item) => item.source === "customs"));
  const lastDelivery = eventKey(latestEvent(events, (item) => item.source === "delivery"));
  switch (key) {
    case "customsArrived":
    case "customsWaiting": {
      const base = earlier(isoToKey(data.estimatedCustomsClearanceDate), plusDays(lastCustoms, stages.customs.max));
      return base === null ? null : businessDaysAfter(base, worry.afterEstimateBusinessDays, config.calendar, "customs");
    }
    case "customsCleared":
    case "handedToCarrier":
    case "pickedUp": {
      const cleared = eventKey(latestEvent(events, (item) => item.event.statusCode === 4));
      const base = later(cleared, lastDelivery) ?? isoToKey(data.estimatedCustomsClearanceDate) ?? lastCustoms;
      return base === null ? null : businessDaysAfter(base, worry.afterClearanceBusinessDays, config.calendar, "customs");
    }
    case "inTransit": {
      const base = earlier(isoToKey(data.estimatedDeliveryDate), plusDays(lastDelivery, stages.domestic.max));
      return base === null ? null : businessDaysAfter(base, worry.afterEstimateBusinessDays, config.calendar, "delivery");
    }
    default:
      return null;
  }
}

/** Today (KST, from `now`) is after the worry date. */
export function isOverdue(worry: KstDateKey | null, now: Date): boolean {
  return worry !== null && kstDateKey(now) > worry;
}
```

Create `lib/tracking/derive-view.ts`:

```ts
import type { SiteConfig } from "@/lib/config/types";
import { dataGuideKey } from "@/lib/tracking/derive/keys";
import type { GuideKey } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

export { isOverdue, worryDateKey } from "@/lib/tracking/derive/worry";

export function guideKeyForData(data: TrackResponseData, now: Date, config: SiteConfig): GuideKey {
  return dataGuideKey(data, now, config);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/derive-view.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck`
Expected: `30 passed`; typecheck exits 0.

- [ ] **Step 6: Commit**

```powershell
git add tests/fixtures/derive-scenarios.ts lib/tracking/derive/events.ts lib/tracking/derive/keys.ts lib/tracking/derive/worry.ts lib/tracking/derive-view.ts tests/unit/derive-view.spec.ts; git commit -m "feat: derive guide keys, worry dates and overdue in KST"
```

### Task 10: `deriveTrackingView` — result view models (and the basic error view)

**Files:**
- Create: `lib/tracking/derive/actions.ts`, `lib/tracking/derive/shared.ts`, `lib/tracking/derive/carrier-view.ts`, `lib/tracking/derive/spine.ts`, `lib/tracking/derive/eta.ts`, `lib/tracking/derive/history.ts`, `lib/tracking/derive/next-action.ts`, `lib/tracking/derive/success-view.ts`, `lib/tracking/derive/failure-view.ts` (basic version; Task 11 replaces it)
- Modify: `lib/tracking/derive-view.ts` (add `deriveTrackingView`)
- Test: `tests/unit/derive-view.spec.ts` (new import block, new describe blocks)

**Interfaces:**
- Consumes: Tasks 1–9 (`GuideRow` rows, `resultCopy`, `channels`, `disclosures`, `durations`, notices, help, glossary, calendar; `timedEvents`, `latestEvent`, `dataGuideKey`, `codeGuideKey`, `ctaStateFor`, `worryDateKey`, `isOverdue`, `isoToKey`; `requestCarrierView`, `carrierDisplayName`, `carrierOfficialUrl`, `CARRIER_NAMES`, `CONCRETE_CARRIER_CODES`; `buildInquiryCopy`; `pickNotice`, `toNoticeView`; `glossaryLabel`; `fillCopy`, `fillSlots`; time formatters); `buildReturnLink` from `@/lib/site` (S01 §11.3).
- Produces: contract §11.8 `deriveTrackingView(outcome: LookupOutcome, now: Date, config: SiteConfig): TrackingViewModel` for every data state, overdue included, and a basic error view (mode `error`, `ctaState` `error`, 톡톡 as the first link, no stores/ETA/spine marker). Private helpers: `action`, `withWeight`, `talkAction`, `copyAndTalkAction`, `fixNumberAction`, `retryAction`, `returnLinkAction`, `undeliveredAction`, `callDriverAction`, `carrierOfficialAction`, `ALL_CARRIER_CHOICES`, `NO_REVENUE`, `numberView`, `noticeFor`, `helpFor`, `documentTitleFor`, `liveMessageFor`, `carrierForData`, `STATIONS`, `EMPTY_SPINE`, `stationForCode`, `spineFor`, `etaDate`, `etaFor`, `lastEventFor`, `historyFor`, `nextActionForData`, `deriveSuccessView`, `deriveFailureView`.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/derive-view.spec.ts`, replace the import block (all `import` lines at the top) with:

```ts
import { expect, test } from "@playwright/test";
import { buildReturnLink } from "@/lib/site";
import { deriveTrackingView, guideKeyForData, isOverdue, worryDateKey } from "@/lib/tracking/derive-view";
import type { ActionView, FailureCause, GuideKey, RevenueView } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";
import { FIXTURE_CONFIG } from "../fixtures/config-fixtures";
import {
  CJ_URL, MOVED_NOW, OCTOBER_NOW, PICKUP_NOW, ambiguousData, carrierCutData, customsArrivedData, customsClearedData,
  customsReviewData, customsWaitingData, deliveredData, ev, failure, handedToCarrierData, inTransitData, lookupUnavailableData,
  movedEstimateData, pendingData, pickedUpData, staleData, success
} from "../fixtures/derive-scenarios";
import { FAKE, FAKE_GROUPED, FIXTURE_NOW } from "../fixtures/tracking-fixtures";
```

Below the line `const at = (iso: string): Date => new Date(iso);` add:

```ts
const TALK_TEXT: ActionView = {
  kind: "talk", label: "톡톡으로 문의하기", weight: "text", href: CONFIG.channels.talk.url, external: true, cooldownSeconds: null
};
const COPY_AND_TALK: ActionView = {
  kind: "copyAndTalk", label: "문의 내용 복사하고 톡톡 열기", weight: "primary", href: CONFIG.channels.talk.url, external: true, cooldownSeconds: null
};
const NO_REVENUE: RevenueView = { tier: "none", stores: "none", recommendations: "none", recommendationContext: null, adsAllowed: false };
const ALL_CAUSES: readonly FailureCause[] = [
  "invalidNumber", "notFound", "rateLimited", "upstreamTimeout", "badGateway", "network", "offline", "clientTimeout", "serverError", "contractViolation"
];
const BASELINE_WAITING = deriveTrackingView(success(customsWaitingData()), FIXTURE_NOW, CONFIG);
const BASELINE_IN_TRANSIT = deriveTrackingView(success(inTransitData()), OCTOBER_NOW, CONFIG);
const BASELINE_OVERDUE = deriveTrackingView(success(customsWaitingData()), at("2026-09-29T00:00:00+09:00"), CONFIG);
```

Append to the end of the file:

```ts
test.describe("result view models", () => {
  test("customs waiting: calm progress, holiday badge instead of D-n, worry line bound to 톡톡", () => {
    const view = BASELINE_WAITING;
    expect(view.guideKey).toBe("customsWaiting");
    expect(view.mode).toBe("settled");
    expect(view.tone).toBe("progress");
    expect(view.overdue).toBe(false);
    expect(view.number).toEqual({ raw: FAKE.hbl, grouped: FAKE_GROUPED.hbl });
    expect(view.carrier).toEqual({ code: "AUTO", name: null, barLabel: "택배사 배정 전", officialUrl: null });
    expect(view.chip).toBe("통관 대기 · 2/4");
    expect(view.title).toBe("통관 순서를 기다리고 있어요");
    expect(view.reason).toBe("세관 접수가 끝났고 순서대로 심사가 진행돼요.");
    expect(view.spine).toEqual({ current: "customs", issue: null, handoffPending: false, positionLabel: "2/4" });
    expect(view.eta).toEqual({
      kind: "holidayAffected", label: "도착 예상",
      date: { key: "2026-09-29", label: "9월 29일 (화)", month: 9, day: 29, weekday: "화" },
      badge: "추석 연휴 영향 · 1~2일 늦어질 수 있어요", holidayName: "추석 연휴", caption: "통관 완료 예상 9월 26일 (토)"
    });
    expect(view.nextAction).toEqual({
      heading: "지금 할 일",
      sentence: "지금은 하실 일이 없어요. 통관이 끝나면 택배사로 넘어가요.",
      primary: null,
      secondary: [{ kind: "copyReturnLink", label: "다시 볼 링크 복사", weight: "secondary", href: null, external: false, cooldownSeconds: null }],
      worry: { dateKey: "2026-09-28", text: "9월 28일(월)까지 그대로면 알려 주세요", talk: TALK_TEXT },
      stores: null, carrierChoices: null, note: null
    });
    expect(view.notice?.id).toBe("fx-holiday");
    expect(view.lastEvent).toEqual({
      at: "2026-09-23T05:10:00.000Z", label: "통관 접수", original: "통관목록접수", place: "인천공항세관", text: "9월 23일 (수) 14:10 · 통관 접수"
    });
    expect(view.history.count).toBe(2);
    expect(view.history.summaryText).toBe("처리 내역 2건 보기 · 마지막 9월 23일 14:10");
    expect(view.history.emptyText).toBeNull();
    expect(view.history.segments.map((segment) => [segment.station, segment.title, segment.events.length])).toEqual([["customs", "입항·통관", 2]]);
    expect(view.history.recent.map((item) => item.label)).toEqual(["통관 접수", "입항"]);
    expect(view.ctaState).toBe("customsWaiting");
    expect(view.inquiryLevel).toBe("worryLink");
    expect(view.revenue).toEqual({ tier: "quiet", stores: "none", recommendations: "optional", recommendationContext: "customsWaiting", adsAllowed: true });
    expect(view.retry).toBeNull();
    expect(view.auxiliaryLine).toBeNull();
    expect(view.help.map((item) => [item.id, item.defaultOpen])).toEqual([["customs-delay", false]]);
    expect(view.inquiryCopy).toBeNull();
    expect(view.returnLink).toBe(buildReturnLink(FAKE.hbl, "AUTO"));
    expect(view.documentTitle).toBe("통관 대기 중 · 배송 조회");
    expect(view.liveMessage).toBe("통관 순서를 기다리고 있어요 · 도착 예상 9월 29일 (화)");
  });

  test("customs waiting turns overdue at KST midnight after the worry date", () => {
    expect(deriveTrackingView(success(customsWaitingData()), at("2026-09-28T23:59:59+09:00"), CONFIG).overdue).toBe(false);
    const view = BASELINE_OVERDUE;
    expect(view.overdue).toBe(true);
    expect(view.guideKey).toBe("customsWaiting");
    expect(view.tone).toBe("attention");
    expect(view.chip).toBe("확인 필요 · 2/4");
    expect(view.title).toBe("9월 28일(월)이 지났는데 아직 통관이 끝나지 않았어요");
    expect(view.eta).toEqual({
      kind: "overdue", label: "예상했던 날짜", date: { key: "2026-09-29", label: "9월 29일 (화)", month: 9, day: 29, weekday: "화" }
    });
    expect(view.nextAction.primary).toEqual(COPY_AND_TALK);
    expect(view.nextAction.secondary).toEqual([]);
    expect(view.nextAction.worry).toBeNull();
    expect(view.nextAction.sentence).toBe("확인이 필요해요. 문의 내용을 복사해 톡톡으로 보내 주세요.");
    expect(view.nextAction.note).toBe("개인통관고유부호와 수취인 이름이 주문 정보와 같은지도 확인해 주세요");
    expect(view.inquiryCopy).toBe(`[배송 문의] 조회번호 ${FAKE_GROUPED.hbl} / 마지막 단계 통관 대기 / 마지막 처리 9월 23일 14:10`);
    expect(view.inquiryLevel).toBe("primary");
    expect(view.ctaState).toBe("customsWaiting");
    expect(view.revenue).toEqual(NO_REVENUE);
    expect(view.notice).toBeNull();
  });

  test("overdue rows: the day before, the day of and the day after the worry date", () => {
    const data = customsWaitingData();
    expect(deriveTrackingView(success(data), at("2026-09-27T12:00:00+09:00"), CONFIG).overdue).toBe(false);
    expect(deriveTrackingView(success(data), at("2026-09-28T12:00:00+09:00"), CONFIG).overdue).toBe(false);
    expect(deriveTrackingView(success(data), at("2026-09-29T09:00:00+09:00"), CONFIG).overdue).toBe(true);
  });

  test("customs cleared: handoff pending on the customs station, spec worry date 9/29", () => {
    const view = deriveTrackingView(success(customsClearedData()), FIXTURE_NOW, CONFIG);
    expect(view.guideKey).toBe("customsCleared");
    expect(view.chip).toBe("통관 완료 · 2/4");
    expect(view.title).toBe("통관이 끝났어요");
    expect(view.spine).toEqual({ current: "customs", issue: null, handoffPending: true, positionLabel: "2/4" });
    expect(view.eta).toMatchObject({ kind: "holidayAffected", date: { key: "2026-09-26" }, caption: "통관 완료 9월 23일 (수)" });
    expect(view.nextAction.worry?.text).toBe("9월 29일(화)까지 소식이 없으면 알려 주세요");
    expect(view.nextAction.primary).toBeNull();
    expect(view.lastEvent?.text).toBe("9월 23일 (수) 10:05 · 통관 완료");
    expect(view.lastEvent?.original).toBe("수입신고수리");
    expect(view.carrier.barLabel).toBe("택배사 배정 전");
    expect(view.ctaState).toBe("customsCleared");
    expect(view.revenue.recommendationContext).toBe("customsCleared");
    expect(view.help.map((item) => item.id)).toEqual(["handoff"]);
  });

  test("in transit: today's estimate, live carrier link as primary, driver call, no stores", () => {
    const view = BASELINE_IN_TRANSIT;
    expect(view.guideKey).toBe("inTransit");
    expect(view.chip).toBe("국내 배송 · 3/4");
    expect(view.title).toBe("국내 배송 중");
    expect(view.carrier).toEqual({ code: "CJ", name: "CJ대한통운", barLabel: "CJ대한통운", officialUrl: CJ_URL });
    expect(view.eta).toEqual({
      kind: "today", label: "오늘 예상", date: { key: "2026-10-14", label: "10월 14일 (수)", month: 10, day: 14, weekday: "수" }, caption: null
    });
    expect(view.nextAction.heading).toBe("배송이 진행 중이에요");
    expect(view.nextAction.primary).toEqual({
      kind: "carrierOfficial", label: "CJ대한통운에서 실시간 위치 보기", weight: "primary", href: CJ_URL, external: true, cooldownSeconds: null
    });
    expect(view.nextAction.secondary).toEqual([
      { kind: "callDriver", label: "기사님께 전화", weight: "secondary", href: `tel:${FAKE.phone.replace(/-/g, "")}`, external: false, cooldownSeconds: null },
      TALK_TEXT
    ]);
    expect(view.nextAction.worry).toEqual({ dateKey: "2026-10-15", text: "10월 15일(목)까지 안 오면 알려 주세요", talk: TALK_TEXT });
    expect(view.nextAction.stores).toBeNull();
    expect(view.revenue).toEqual({ tier: "quiet", stores: "none", recommendations: "inline", recommendationContext: "inTransit", adsAllowed: true });
    expect(view.inquiryLevel).toBe("textLink");
    expect(view.history.count).toBe(4);
    expect(view.history.segments.map((segment) => segment.station)).toEqual(["customs", "domestic"]);
    expect(view.history.summaryText).toBe("처리 내역 4건 보기 · 마지막 10월 12일 08:15");
    expect(view.returnLink).toBe(buildReturnLink(FAKE.domestic, "CJ"));
    expect(view.liveMessage).toBe("국내 배송 중 · 오늘 예상 10월 14일 (수)");
  });

  test("in transit turns overdue after 10/15 and keeps the official lookup as the only secondary", () => {
    const view = deriveTrackingView(success(inTransitData()), at("2026-10-16T00:00:00+09:00"), CONFIG);
    expect(view.overdue).toBe(true);
    expect(view.title).toBe("10월 15일(목)이 지났는데 아직 배송이 끝나지 않았어요");
    expect(view.nextAction.primary).toEqual(COPY_AND_TALK);
    expect(view.nextAction.secondary).toEqual([
      { kind: "carrierOfficial", label: "CJ대한통운 공식 배송조회", weight: "secondary", href: CJ_URL, external: true, cooldownSeconds: null }
    ]);
    expect(view.nextAction.note).toBeNull();
    expect(view.revenue).toEqual(NO_REVENUE);
  });

  test("pending: number check first, 톡톡 button, purchase choices after the disclosure, recheck note", () => {
    const view = deriveTrackingView(success(pendingData()), FIXTURE_NOW, CONFIG);
    expect(view.guideKey).toBe("pending");
    expect(view.tone).toBe("waiting");
    expect(view.chip).toBe("국내 도착 전");
    expect(view.title).toBe("통관 정보 등록 전");
    expect(view.spine).toEqual({ current: null, issue: null, handoffPending: false, positionLabel: null });
    expect(view.eta).toEqual({ kind: "pendingInfo", label: "도착 예상", text: "정보 등록 후 안내" });
    expect(view.nextAction.heading).toBe("아직 국내 배송 정보가 없어요");
    expect(view.nextAction.primary).toEqual({ kind: "fixNumber", label: "번호 수정", weight: "primary", href: null, external: false, cooldownSeconds: null });
    expect(view.nextAction.secondary.map((item) => [item.kind, item.weight])).toEqual([["talk", "secondary"], ["copyReturnLink", "text"]]);
    expect(view.nextAction.worry).toEqual({ dateKey: null, text: "출고 안내 후 10일이 지나도 이 화면이면 알려 주세요", talk: TALK_TEXT });
    expect(view.nextAction.stores).toEqual({
      placement: "pending", intro: "주문하신 곳에서도 배송 안내를 볼 수 있어요", disclosure: CONFIG.disclosures.coupang,
      links: [
        { channel: "naver", label: "네이버 스토어 보기", href: CONFIG.channels.naver.urls.pending, isAffiliate: false, weight: "secondary" },
        { channel: "coupang", label: "쿠팡 스토어 보기", href: CONFIG.channels.coupang.urls.pending, isAffiliate: true, weight: "secondary" }
      ]
    });
    expect(view.nextAction.note).toBe(CONFIG.durations.pendingRecheck);
    expect(view.revenue).toEqual({ tier: "quiet", stores: "purchaseChoices", recommendations: "inline", recommendationContext: "pending", adsAllowed: true });
    expect(view.ctaState).toBe("pending");
    expect(view.inquiryLevel).toBe("ctaButton");
    expect(view.history).toEqual({ count: 0, summaryText: "처리 내역 0건 보기", emptyText: "아직 처리 내역이 없어요", segments: [], recent: [] });
    expect(view.lastEvent).toBeNull();
    expect(view.help.map((item) => item.id)).toEqual(["pre-arrival", "order-check"]);
  });

  test("delivered: done tone, delivered-on date, stores lead with the disclosure first", () => {
    const view = deriveTrackingView(success(deliveredData()), FIXTURE_NOW, CONFIG);
    expect(view.guideKey).toBe("delivered");
    expect(view.tone).toBe("done");
    expect(view.chip).toBe("도착 · 4/4");
    expect(view.spine.current).toBe("arrived");
    expect(view.eta).toEqual({
      kind: "deliveredOn", label: "배송 완료일", date: { key: "2026-09-25", label: "9월 25일 (금)", month: 9, day: 25, weekday: "금" }
    });
    expect(view.lastEvent).toMatchObject({ place: "문 앞", text: "9월 25일 (금) 14:32 · 배송 완료" });
    expect(view.nextAction.primary).toBeNull();
    expect(view.nextAction.stores?.placement).toBe("deliveredLead");
    expect(view.nextAction.stores?.disclosure).toBe(CONFIG.disclosures.coupang);
    expect(view.nextAction.stores?.links.map((link) => [link.channel, link.weight])).toEqual([["naver", "primary"], ["coupang", "secondary"]]);
    expect(view.nextAction.secondary.map((item) => [item.kind, item.label])).toEqual([["talk", "톡톡으로 문의하기"], ["undeliveredHelp", "받지 못하셨나요?"]]);
    expect(view.revenue).toEqual({ tier: "lead", stores: "ctaLead", recommendations: "inline", recommendationContext: "delivered", adsAllowed: true });
    expect(view.inquiryLevel).toBe("afterStores");
  });

  test("stale: attention tone, stopped mark, estimate withheld, copy-and-talk first", () => {
    const view = deriveTrackingView(success(staleData()), FIXTURE_NOW, CONFIG);
    expect(view.guideKey).toBe("stale");
    expect(view.tone).toBe("attention");
    expect(view.chip).toBe("확인 필요 · 2/4");
    expect(view.title).toBe("14일 넘게 새 소식이 없어요");
    expect(view.reason).toBe("마지막 처리는 9월 6일(일)이에요. 보통은 1~2일 안에 다음 단계로 넘어가요.");
    expect(view.spine).toEqual({ current: "customs", issue: { at: "customs", kind: "stopped", label: "멈춤" }, handoffPending: false, positionLabel: "2/4" });
    expect(view.eta).toEqual({ kind: "withheld", label: "도착 예상", text: "지금은 도착 예상일을 안내하기 어려워요" });
    expect(view.nextAction.primary).toEqual(COPY_AND_TALK);
    expect(view.nextAction.secondary).toEqual([]);
    expect(view.nextAction.note).toBe("개인통관고유부호와 수취인 이름이 주문 정보와 같은지도 확인해 주세요");
    expect(view.inquiryCopy).toBe(`[배송 문의] 조회번호 ${FAKE_GROUPED.domestic} / 마지막 단계 통관 대기 / 마지막 처리 9월 6일 10:00`);
    expect(view.revenue).toEqual(NO_REVENUE);
    expect(view.ctaState).toBe("stale");
    expect(view.help.map((item) => [item.id, item.defaultOpen])).toEqual([["customs-delay", true], ["stale-causes", false]]);
  });

  test("carrier lookup delay without a carrier: cut mark and carrier chips for an instant re-lookup", () => {
    const view = deriveTrackingView(success(lookupUnavailableData("AUTO")), FIXTURE_NOW, CONFIG);
    expect(view.guideKey).toBe("lookupUnavailable");
    expect(view.carrier.barLabel).toBe("택배사");
    expect(view.spine).toEqual({ current: "domestic", issue: { at: "domestic", kind: "cut", label: "끊김" }, handoffPending: false, positionLabel: "3/4" });
    expect(view.eta).toEqual({ kind: "none" });
    expect(view.nextAction.primary).toBeNull();
    expect(view.nextAction.sentence).toBe("택배사를 고르시면 같은 번호로 바로 다시 조회해요.");
    expect(view.nextAction.carrierChoices?.map((choice) => choice.name)).toEqual(["CJ대한통운", "우체국택배", "한진택배", "롯데택배", "로젠택배"]);
    expect(view.nextAction.secondary.map((item) => [item.kind, item.weight])).toEqual([["retry", "secondary"], ["talk", "text"]]);
    expect(view.revenue).toEqual(NO_REVENUE);
  });

  test("carrier lookup delay with a known carrier: the official lookup is the primary action", () => {
    const view = deriveTrackingView(success(lookupUnavailableData("CJ")), FIXTURE_NOW, CONFIG);
    expect(view.nextAction.primary).toEqual({
      kind: "carrierOfficial", label: "CJ대한통운 공식 배송조회", weight: "primary", href: CJ_URL, external: true, cooldownSeconds: null
    });
    expect(view.nextAction.sentence).toBe("CJ대한통운 공식 조회에서 바로 확인할 수 있어요.");
    expect(view.nextAction.carrierChoices).toBeNull();
  });

  test("several carriers: branch mark and carrier chips", () => {
    const view = deriveTrackingView(success(ambiguousData()), FIXTURE_NOW, CONFIG);
    expect(view.guideKey).toBe("ambiguous");
    expect(view.spine.issue).toEqual({ at: "domestic", kind: "branch", label: "갈림" });
    expect(view.nextAction.carrierChoices).toHaveLength(5);
    expect(view.nextAction.primary).toBeNull();
    expect(view.nextAction.secondary.map((item) => item.kind)).toEqual(["talk"]);
    expect(view.ctaState).toBe("ambiguous");
  });

  test("customs events with a carrier lookup delay: code-based state, cut mark and a retry line", () => {
    const view = deriveTrackingView(success(carrierCutData()), FIXTURE_NOW, CONFIG);
    expect(view.guideKey).toBe("customsCleared");
    expect(view.spine).toEqual({ current: "customs", issue: { at: "domestic", kind: "cut", label: "끊김" }, handoffPending: true, positionLabel: "2/4" });
    expect(view.auxiliaryLine).toEqual({
      text: "택배사 조회가 잠시 늦어요", action: { kind: "retry", label: "다시 조회", weight: "text", href: null, external: false, cooldownSeconds: null }
    });
    expect(view.carrier.name).toBe("CJ대한통운");
  });

  test("picked up: the E2E title with the carrier name and the official lookup as primary", () => {
    const view = deriveTrackingView(success(pickedUpData()), PICKUP_NOW, CONFIG);
    expect(view.title).toBe("CJ대한통운 기사님 픽업 완료!");
    expect(view.reason).toBe("CJ대한통운 기사님이 상품을 인수해 배송 출발을 준비하고 있어요.");
    expect(view.chip).toBe("국내 배송 · 3/4");
    expect(view.nextAction.primary?.label).toBe("CJ대한통운 공식 배송조회");
    expect(view.nextAction.worry?.dateKey).toBe("2026-10-13");
    expect(view.ctaState).toBe("customsCleared");
  });

  test("handed to carrier without a pickup event", () => {
    const view = deriveTrackingView(success(handedToCarrierData()), PICKUP_NOW, CONFIG);
    expect(view.title).toBe("택배사에 넘어갔어요");
    expect(view.reason).toBe("CJ대한통운에서 배송을 준비하고 있어요.");
  });

  test("errors: inquiry first, no stores, no ETA, no spine marker, number-free document title", () => {
    for (const cause of ALL_CAUSES) {
      const view = deriveTrackingView(failure(cause), FIXTURE_NOW, CONFIG);
      expect(view.mode, cause).toBe("error");
      expect(view.ctaState, cause).toBe("error");
      expect(view.spine.current, cause).toBeNull();
      expect(view.eta, cause).toEqual({ kind: "none" });
      expect(view.nextAction.stores, cause).toBeNull();
      expect(view.revenue, cause).toEqual(NO_REVENUE);
      const firstLink = [view.nextAction.primary, ...view.nextAction.secondary].find((item) => item !== null && item.href !== null);
      expect(firstLink?.href, cause).toBe(CONFIG.channels.talk.url);
      expect(/\d/.test(view.documentTitle), cause).toBe(false);
      expect(view.documentTitle.endsWith(" · 배송 조회"), cause).toBe(true);
    }
  });

  test("broken event times never leak into the view", () => {
    const data = customsWaitingData();
    const broken: TrackResponseData = {
      ...data,
      customs: { events: [ev("알 수 없음", 2, "not-a-date"), ...[...data.customs.events].reverse(), ev("빈 시각", 1, "")] }
    };
    const view = deriveTrackingView(success(broken), FIXTURE_NOW, CONFIG);
    expect(JSON.stringify(view)).not.toMatch(/Invalid Date|NaN|undefined/);
    expect(view.history.count).toBe(2);
    expect(view.lastEvent?.label).toBe("통관 접수");
    expect(view.nextAction.worry?.dateKey).toBe("2026-09-28");
  });
});

test.describe("result views in America/New_York", () => {
  let previousTz: string | undefined;

  test.beforeAll(() => {
    previousTz = process.env.TZ;
    process.env.TZ = "America/New_York";
  });

  test.afterAll(() => {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  });

  test("the whole view model equals the one computed in the default time zone", () => {
    expect(deriveTrackingView(success(customsWaitingData()), FIXTURE_NOW, CONFIG)).toEqual(BASELINE_WAITING);
    expect(deriveTrackingView(success(inTransitData()), OCTOBER_NOW, CONFIG)).toEqual(BASELINE_IN_TRANSIT);
    expect(deriveTrackingView(success(customsWaitingData()), at("2026-09-29T00:00:00+09:00"), CONFIG)).toEqual(BASELINE_OVERDUE);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/derive-view.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `deriveTrackingView` is not exported by `@/lib/tracking/derive-view` (the module-level baselines throw `deriveTrackingView is not a function`), so the file fails to load.

- [ ] **Step 3: Write the action builders and shared helpers**

Create `lib/tracking/derive/actions.ts`:

```ts
import type { SiteConfig } from "@/lib/config/types";
import { CARRIER_NAMES, CONCRETE_CARRIER_CODES } from "@/lib/tracking/carriers";
import { fillSlots } from "@/lib/tracking/template";
import type { ActionKind, ActionView, ActionWeight, CarrierChoiceView } from "@/lib/tracking/types";

interface ActionOptions {
  readonly href?: string | null;
  readonly external?: boolean;
  readonly cooldownSeconds?: number | null;
}

export function action(kind: ActionKind, label: string, weight: ActionWeight, options: ActionOptions = {}): ActionView {
  return {
    kind,
    label,
    weight,
    href: options.href ?? null,
    external: options.external ?? false,
    cooldownSeconds: options.cooldownSeconds ?? null
  };
}

export function withWeight(view: ActionView, weight: ActionWeight): ActionView {
  return { ...view, weight };
}

export function talkAction(config: SiteConfig, weight: ActionWeight): ActionView {
  return action("talk", config.channels.talk.labels.cta, weight, { href: config.channels.talk.url, external: true });
}

/** [문의 내용 복사하고 톡톡 열기] — always the one filled primary where it appears. */
export function copyAndTalkAction(config: SiteConfig): ActionView {
  return action("copyAndTalk", config.channels.talk.labels.copyAndTalk, "primary", { href: config.channels.talk.url, external: true });
}

export function fixNumberAction(config: SiteConfig, weight: ActionWeight): ActionView {
  return action("fixNumber", config.resultCopy.actionFixNumber, weight);
}

export function retryAction(config: SiteConfig, weight: ActionWeight, cooldownSeconds: number | null = null): ActionView {
  return action("retry", config.resultCopy.actionRetry, weight, { cooldownSeconds });
}

export function returnLinkAction(config: SiteConfig, weight: ActionWeight): ActionView {
  return action("copyReturnLink", config.resultCopy.actionReturnLink, weight);
}

export function undeliveredAction(config: SiteConfig): ActionView {
  return action("undeliveredHelp", config.resultCopy.actionUndelivered, "text");
}

export function callDriverAction(config: SiteConfig, phone: string): ActionView {
  return action("callDriver", config.resultCopy.actionCallDriver, "secondary", { href: `tel:${phone.replace(/[^0-9+]/g, "")}` });
}

export function carrierOfficialAction(
  config: SiteConfig, carrierName: string, href: string, weight: ActionWeight, live: boolean
): ActionView {
  const template = live ? config.resultCopy.actionCarrierLive : config.resultCopy.actionCarrierOfficial;
  return action("carrierOfficial", fillSlots(template, { carrier: carrierName }), weight, { href, external: true });
}

export const ALL_CARRIER_CHOICES: readonly CarrierChoiceView[] = CONCRETE_CARRIER_CODES.map((code) => ({ code, name: CARRIER_NAMES[code] }));
```

Create `lib/tracking/derive/shared.ts`:

```ts
import type { SiteConfig } from "@/lib/config/types";
import { pickNotice, toNoticeView } from "@/lib/tracking/notices";
import { groupTrackingNumber } from "@/lib/tracking/number-format";
import type { EtaView, GuideKey, HelpItemView, NoticeView, NumberView, RevenueView } from "@/lib/tracking/types";

export const NO_REVENUE: RevenueView = {
  tier: "none", stores: "none", recommendations: "none", recommendationContext: null, adsAllowed: false
};

const DOCUMENT_TITLE_SUFFIX = " · 배송 조회";

export function numberView(raw: string): NumberView {
  return { raw, grouped: groupTrackingNumber(raw) };
}

export function noticeFor(config: SiteConfig, now: Date, key: GuideKey): NoticeView | null {
  const notice = pickNotice(config.notices, now, { kind: "result", guideKey: key });
  return notice === null ? null : toNoticeView(notice);
}

export function helpFor(config: SiteConfig, key: GuideKey): readonly HelpItemView[] {
  return config.help
    .filter((entry) => entry.showIn.includes(key))
    .map((entry) => ({ id: entry.id, summary: entry.summary, body: entry.body, defaultOpen: entry.openIn.includes(key) }));
}

/** `${docTitle} · 배송 조회` — docTitle never contains digits (config invariant), so the number never reaches the title. */
export function documentTitleFor(docTitle: string): string {
  return `${docTitle}${DOCUMENT_TITLE_SUFFIX}`;
}

/** One sentence for the polite live region: the status title plus the ETA line. */
export function liveMessageFor(title: string, eta: EtaView): string {
  switch (eta.kind) {
    case "none":
      return title;
    case "pendingInfo":
    case "withheld":
    case "unknown":
      return `${title} · ${eta.label} ${eta.text}`;
    case "date":
    case "today":
    case "holidayAffected":
    case "overdue":
    case "deliveredOn":
      return `${title} · ${eta.label} ${eta.date.label}`;
  }
}
```

- [ ] **Step 4: Write the carrier, spine, ETA and history helpers**

Create `lib/tracking/derive/carrier-view.ts`:

```ts
import type { SiteConfig } from "@/lib/config/types";
import { carrierDisplayName, carrierOfficialUrl } from "@/lib/tracking/carriers";
import type { DataGuideKey } from "@/lib/tracking/derive/keys";
import type { CarrierView, LookupRequest } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

/** States before a carrier is assigned show '택배사 배정 전' instead of a name. */
const UNASSIGNED_KEYS: ReadonlySet<DataGuideKey> = new Set<DataGuideKey>(["pending", "customsArrived", "customsWaiting", "customsCleared"]);

export function carrierForData(data: TrackResponseData, request: LookupRequest, key: DataGuideKey, config: SiteConfig): CarrierView {
  const code = data.delivery.carrierCode !== "AUTO" ? data.delivery.carrierCode : request.carrier;
  const name = carrierDisplayName(data.delivery.carrier, code);
  const invoice = data.delivery.invoiceNumber.length > 0 ? data.delivery.invoiceNumber : request.number;
  const fallback = UNASSIGNED_KEYS.has(key) ? config.resultCopy.carrierUnassigned : config.resultCopy.carrierUnknown;
  return {
    code,
    name,
    barLabel: name ?? fallback,
    officialUrl: data.delivery.trackingUrl || carrierOfficialUrl(code, invoice)
  };
}
```

Create `lib/tracking/derive/spine.ts`:

```ts
import type { SiteConfig } from "@/lib/config/types";
import type { DataGuideKey } from "@/lib/tracking/derive/keys";
import type { SpineView, StationId } from "@/lib/tracking/types";
import type { StatusCode, TrackResponseData } from "@/lib/types";

export const STATIONS: readonly StationId[] = ["departed", "customs", "domestic", "arrived"];
export const EMPTY_SPINE: SpineView = { current: null, issue: null, handoffPending: false, positionLabel: null };

const CODE_BASED_KEYS: ReadonlySet<DataGuideKey> = new Set<DataGuideKey>([
  "customsArrived", "customsWaiting", "customsCleared", "handedToCarrier", "pickedUp", "inTransit"
]);

/** Codes 1–4 → 입항·통관 (4 adds '인계 대기'), 5–6 → 국내 배송, 7 → 도착. */
export function stationForCode(code: StatusCode): StationId {
  if (code <= 4) return "customs";
  if (code <= 6) return "domestic";
  return "arrived";
}

function currentStation(data: TrackResponseData, key: DataGuideKey): StationId | null {
  if (key === "pending") return null;
  if (key === "lookupUnavailable" || key === "ambiguous") return "domestic";
  return stationForCode(data.currentStatusCode);
}

function spineIssue(data: TrackResponseData, key: DataGuideKey, current: StationId, config: SiteConfig): SpineView["issue"] {
  const copy = config.resultCopy;
  const codeBased = CODE_BASED_KEYS.has(key);
  if (key === "stale") return { at: current, kind: "stopped", label: copy.issueStopped };
  if (key === "lookupUnavailable" || (codeBased && data.delivery.lookupUnavailable === true)) {
    return { at: "domestic", kind: "cut", label: copy.issueCut };
  }
  if (key === "ambiguous" || (codeBased && data.delivery.ambiguous === true)) {
    return { at: "domestic", kind: "branch", label: copy.issueBranch };
  }
  return null;
}

export function spineFor(data: TrackResponseData, key: DataGuideKey, config: SiteConfig): SpineView {
  const current = currentStation(data, key);
  if (current === null) return EMPTY_SPINE;
  return {
    current,
    issue: spineIssue(data, key, current, config),
    handoffPending: current === "customs" && data.currentStatusCode === 4,
    positionLabel: `${STATIONS.indexOf(current) + 1}/${STATIONS.length}`
  };
}
```

Create `lib/tracking/derive/eta.ts`:

```ts
import type { SiteConfig } from "@/lib/config/types";
import { latestEvent } from "@/lib/tracking/derive/events";
import type { TimedEvent } from "@/lib/tracking/derive/events";
import type { DataGuideKey } from "@/lib/tracking/derive/keys";
import { isoToKey } from "@/lib/tracking/derive/worry";
import { fillSlots } from "@/lib/tracking/template";
import { calendarDaysBetween, formatKstDate, holidayPeriodBetween, kstDateKey, weekdayLabel } from "@/lib/tracking/time";
import type { KstDateKey } from "@/lib/tracking/time";
import type { EtaDate, EtaView } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

const CUSTOMS_ESTIMATE_KEYS: ReadonlySet<DataGuideKey> = new Set<DataGuideKey>(["customsArrived", "customsWaiting"]);
const CUSTOMS_DONE_KEYS: ReadonlySet<DataGuideKey> = new Set<DataGuideKey>(["customsCleared", "handedToCarrier", "pickedUp"]);

export interface EtaInput {
  readonly data: TrackResponseData;
  readonly key: DataGuideKey;
  readonly overdue: boolean;
  readonly now: Date;
  readonly events: readonly TimedEvent[];
  readonly config: SiteConfig;
}

export function etaDate(key: KstDateKey): EtaDate {
  const [, month, day] = key.split("-").map(Number);
  return { key, label: formatKstDate(key), month, day, weekday: weekdayLabel(key) };
}

/** Secondary line: '통관 완료 예상 9월 26일 (토)' (normalizer value as it is) or '통관 완료 9월 23일 (수)'. */
function captionFor(input: EtaInput): string | null {
  const { data, key, events, config } = input;
  if (CUSTOMS_ESTIMATE_KEYS.has(key)) {
    const estimate = isoToKey(data.estimatedCustomsClearanceDate);
    return estimate === null ? null : fillSlots(config.resultCopy.customsEstimateCaption, { date: formatKstDate(estimate) });
  }
  if (CUSTOMS_DONE_KEYS.has(key)) {
    const cleared = latestEvent(events, (item) => item.event.statusCode === 4);
    return cleared === null ? null : fillSlots(config.resultCopy.customsDoneCaption, { date: formatKstDate(cleared.at) });
  }
  return null;
}

function estimateEta(input: EtaInput): EtaView {
  const { data, overdue, now, events, config } = input;
  const copy = config.resultCopy;
  const estimateKey = isoToKey(data.estimatedDeliveryDate);
  if (estimateKey === null) return { kind: "unknown", label: copy.etaLabel, text: copy.etaUnknownText };
  if (overdue) return { kind: "overdue", label: copy.etaOverdueLabel, date: etaDate(estimateKey) };
  const today = kstDateKey(now);
  const shownKey = estimateKey < today ? today : estimateKey;
  const date = etaDate(shownKey);
  const caption = captionFor(input);
  const last = latestEvent(events);
  const holiday = holidayPeriodBetween(last === null ? today : kstDateKey(last.at), shownKey, config.calendar);
  if (holiday !== null) {
    return { kind: "holidayAffected", label: copy.etaLabel, date, badge: holiday.badge, holidayName: holiday.name, caption };
  }
  const dday = calendarDaysBetween(today, shownKey);
  if (dday === 0) return { kind: "today", label: copy.etaTodayLabel, date, caption };
  return { kind: "date", label: copy.etaLabel, date, dday, caption };
}

export function etaFor(input: EtaInput): EtaView {
  const { data, key, events, config } = input;
  const copy = config.resultCopy;
  switch (config.stateGuide[key].etaMode) {
    case "none":
      return { kind: "none" };
    case "pendingInfo":
      return { kind: "pendingInfo", label: copy.etaLabel, text: copy.etaPendingText };
    case "withheld":
      return { kind: "withheld", label: copy.etaLabel, text: copy.etaWithheldText };
    case "deliveredOn": {
      const delivered = latestEvent(events, (item) => item.event.statusCode === 7) ?? latestEvent(events);
      const deliveredKey = delivered === null ? isoToKey(data.estimatedDeliveryDate) : kstDateKey(delivered.at);
      return deliveredKey === null
        ? { kind: "unknown", label: copy.etaDeliveredLabel, text: copy.etaUnknownText }
        : { kind: "deliveredOn", label: copy.etaDeliveredLabel, date: etaDate(deliveredKey) };
    }
    case "estimate":
      return estimateEta(input);
  }
}
```

Create `lib/tracking/derive/history.ts`:

```ts
import type { SiteConfig } from "@/lib/config/types";
import type { TimedEvent } from "@/lib/tracking/derive/events";
import { STATIONS, stationForCode } from "@/lib/tracking/derive/spine";
import { glossaryLabel } from "@/lib/tracking/glossary";
import { fillSlots } from "@/lib/tracking/template";
import { formatKstDateTime, formatKstShortDateTime } from "@/lib/tracking/time";
import type { HistoryEventView, HistorySegmentView, HistoryView, LastEventView, StationId } from "@/lib/tracking/types";

const RECENT_COUNT = 3;

function stationTitle(station: StationId, config: SiteConfig): string {
  const copy = config.resultCopy;
  switch (station) {
    case "departed":
      return copy.stationDeparted;
    case "customs":
      return copy.stationCustoms;
    case "domestic":
      return copy.stationDomestic;
    case "arrived":
      return copy.stationArrived;
  }
}

function eventView(item: TimedEvent, config: SiteConfig): HistoryEventView {
  const { label, original } = glossaryLabel(item.event.status, config.glossary);
  const place = item.event.location?.trim() ?? "";
  return {
    at: item.at.toISOString(),
    timeText: formatKstDateTime(item.at),
    label,
    original,
    place: place.length > 0 ? place : null
  };
}

/** '9월 23일 (수) 14:10 · 통관 접수' with the original term kept for the small print. */
export function lastEventFor(item: TimedEvent | null, config: SiteConfig): LastEventView | null {
  if (item === null) return null;
  const view = eventView(item, config);
  return { at: view.at, label: view.label, original: view.original, place: view.place, text: `${view.timeText} · ${view.label}` };
}

export function historyFor(events: readonly TimedEvent[], config: SiteConfig): HistoryView {
  const copy = config.resultCopy;
  const views = events.map((item) => eventView(item, config));
  const count = views.length;
  const latest = count > 0 ? events[count - 1] : null;
  const summary = fillSlots(copy.historySummary, { n: String(count) });
  const segments: HistorySegmentView[] = STATIONS.flatMap((station) => {
    const inStation = events.filter((item) => stationForCode(item.event.statusCode) === station).map((item) => eventView(item, config));
    return inStation.length === 0 ? [] : [{ station, title: stationTitle(station, config), events: inStation }];
  });
  return {
    count,
    summaryText: latest === null ? summary : `${summary} · ${fillSlots(copy.historyLast, { time: formatKstShortDateTime(latest.at) })}`,
    emptyText: count === 0 ? copy.historyEmpty : null,
    segments,
    recent: views.slice(-RECENT_COUNT).reverse()
  };
}
```

- [ ] **Step 5: Write the next-action builder and the success view**

Create `lib/tracking/derive/next-action.ts`:

```ts
import type { SiteConfig } from "@/lib/config/types";
import {
  ALL_CARRIER_CHOICES, callDriverAction, carrierOfficialAction, copyAndTalkAction, fixNumberAction, retryAction, returnLinkAction,
  talkAction, undeliveredAction
} from "@/lib/tracking/derive/actions";
import { latestEvent } from "@/lib/tracking/derive/events";
import type { TimedEvent } from "@/lib/tracking/derive/events";
import type { DataGuideKey } from "@/lib/tracking/derive/keys";
import { fillCopy } from "@/lib/tracking/template";
import type { CopyToken } from "@/lib/tracking/template";
import type { KstDateKey } from "@/lib/tracking/time";
import type {
  ActionView, ActionWeight, CarrierView, NextActionView, StoreLinkView, StoreLinksView, StorePlacementId, WorryLineView
} from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

export interface NextActionInput {
  readonly data: TrackResponseData;
  readonly key: DataGuideKey;
  readonly overdue: boolean;
  readonly carrier: CarrierView;
  readonly worryKey: KstDateKey | null;
  readonly events: readonly TimedEvent[];
  readonly values: Readonly<Partial<Record<CopyToken, string>>>;
  readonly config: SiteConfig;
}

/** Overdue customs states also ask the customer to check the customs ID and recipient name. */
const CUSTOMS_NOTE_KEYS: ReadonlySet<DataGuideKey> = new Set<DataGuideKey>(["customsArrived", "customsWaiting", "customsCleared"]);

function storesFor(placement: StorePlacementId, config: SiteConfig, intro: string | null): StoreLinksView {
  const links: StoreLinkView[] = (["naver", "coupang"] as const).map((channel, index) => {
    const store = config.channels[channel];
    const weight: ActionWeight = placement === "deliveredLead" && index === 0 ? "primary" : "secondary";
    return { channel, label: store.linkLabel, href: store.urls[placement], isAffiliate: store.isAffiliate, weight };
  });
  return { placement, intro, disclosure: links.some((link) => link.isAffiliate) ? config.disclosures.coupang : null, links };
}

function officialAction(input: NextActionInput, weight: ActionWeight, live: boolean): ActionView | null {
  const { carrier, config } = input;
  if (carrier.officialUrl === null) return null;
  return carrierOfficialAction(config, carrier.name ?? config.resultCopy.carrierUnknown, carrier.officialUrl, weight, live);
}

function worryLine(input: NextActionInput): WorryLineView | null {
  const { key, overdue, worryKey, config, values } = input;
  const template = config.stateGuide[key].worry;
  if (overdue || template === null) return null;
  if (worryKey !== null) return { dateKey: worryKey, text: fillCopy(template, values), talk: talkAction(config, "text") };
  if (key === "pending") return { dateKey: null, text: fillCopy(template, values), talk: talkAction(config, "text") };
  return null;
}

function latestDriverPhone(events: readonly TimedEvent[]): string | null {
  const withPhone = latestEvent(events, (item) => item.source === "delivery" && (item.event.driverPhone ?? "").trim().length > 0);
  return withPhone?.event.driverPhone ?? null;
}

function sharedParts(input: NextActionInput): Omit<NextActionView, "primary" | "secondary"> {
  const { key, config, values, data } = input;
  const row = config.stateGuide[key];
  return {
    heading: row.ctaHeading,
    sentence: fillCopy(row.nextAction, values),
    worry: worryLine(input),
    stores: null,
    carrierChoices: key === "ambiguous" || data.delivery.ambiguous === true ? ALL_CARRIER_CHOICES : null,
    note: null
  };
}

function overdueAction(input: NextActionInput): NextActionView {
  const { key, config } = input;
  const official = officialAction(input, "secondary", false);
  return {
    ...sharedParts(input),
    sentence: config.resultCopy.overdueSentence,
    primary: copyAndTalkAction(config),
    secondary: official === null ? [] : [official],
    worry: null,
    note: CUSTOMS_NOTE_KEYS.has(key) ? config.resultCopy.customsCheckNote : null
  };
}

/** 지금 할 일: one sentence, at most one filled primary, 0–2 secondary actions, per the state table (spec §7). */
export function nextActionForData(input: NextActionInput): NextActionView {
  const { key, overdue, config } = input;
  if (overdue) return overdueAction(input);
  const shared = sharedParts(input);
  const copy = config.resultCopy;
  switch (key) {
    case "pending":
      return {
        ...shared,
        primary: fixNumberAction(config, "primary"),
        secondary: [talkAction(config, "secondary"), returnLinkAction(config, "text")],
        stores: storesFor("pending", config, copy.pendingStoresIntro),
        note: config.durations.pendingRecheck
      };
    case "customsArrived":
    case "customsWaiting":
    case "customsCleared":
      return { ...shared, primary: null, secondary: [returnLinkAction(config, "secondary")] };
    case "handedToCarrier":
    case "pickedUp":
      return { ...shared, primary: officialAction(input, "primary", false), secondary: [returnLinkAction(config, "secondary")] };
    case "inTransit": {
      const phone = latestDriverPhone(input.events);
      return {
        ...shared,
        primary: officialAction(input, "primary", true),
        secondary: phone === null
          ? [talkAction(config, "text"), returnLinkAction(config, "text")]
          : [callDriverAction(config, phone), talkAction(config, "text")]
      };
    }
    case "delivered":
      return {
        ...shared,
        primary: null,
        secondary: [talkAction(config, "secondary"), undeliveredAction(config)],
        stores: storesFor("deliveredLead", config, null)
      };
    case "stale": {
      const official = officialAction(input, "secondary", false);
      return { ...shared, primary: copyAndTalkAction(config), secondary: official === null ? [] : [official], note: copy.customsCheckNote };
    }
    case "lookupUnavailable": {
      const official = officialAction(input, "primary", false);
      const secondary = [retryAction(config, "secondary"), talkAction(config, "text")];
      return official === null
        ? { ...shared, sentence: copy.chooseCarrierSentence, primary: null, secondary, carrierChoices: ALL_CARRIER_CHOICES }
        : { ...shared, primary: official, secondary };
    }
    case "ambiguous":
      return { ...shared, primary: null, secondary: [talkAction(config, "text")] };
  }
}
```

Create `lib/tracking/derive/success-view.ts`:

```ts
import type { SiteConfig } from "@/lib/config/types";
import { buildReturnLink } from "@/lib/site";
import { retryAction } from "@/lib/tracking/derive/actions";
import { carrierForData } from "@/lib/tracking/derive/carrier-view";
import { etaFor } from "@/lib/tracking/derive/eta";
import { latestEvent, timedEvents } from "@/lib/tracking/derive/events";
import type { TimedEvent } from "@/lib/tracking/derive/events";
import { historyFor, lastEventFor } from "@/lib/tracking/derive/history";
import { codeGuideKey, ctaStateFor, dataGuideKey } from "@/lib/tracking/derive/keys";
import type { DataGuideKey } from "@/lib/tracking/derive/keys";
import { nextActionForData } from "@/lib/tracking/derive/next-action";
import { NO_REVENUE, documentTitleFor, helpFor, liveMessageFor, noticeFor, numberView } from "@/lib/tracking/derive/shared";
import { spineFor } from "@/lib/tracking/derive/spine";
import { isOverdue, worryDateKey } from "@/lib/tracking/derive/worry";
import { buildInquiryCopy } from "@/lib/tracking/inquiry-copy";
import { fillCopy } from "@/lib/tracking/template";
import type { CopyToken } from "@/lib/tracking/template";
import { formatKstDateTight } from "@/lib/tracking/time";
import type { KstDateKey } from "@/lib/tracking/time";
import { OVERDUE_CAPABLE_KEYS } from "@/lib/tracking/types";
import type { EtaView, GuideKey, LookupRequest, RecommendationContext, RevenueView, TrackingViewModel } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

const OVERDUE_KEYS: ReadonlySet<GuideKey> = new Set<GuideKey>(OVERDUE_CAPABLE_KEYS);

const RECOMMENDATION_CONTEXT: Readonly<Partial<Record<DataGuideKey, RecommendationContext>>> = {
  pending: "pending",
  customsArrived: "customsWaiting",
  customsWaiting: "customsWaiting",
  customsCleared: "customsCleared",
  handedToCarrier: "customsCleared",
  pickedUp: "customsCleared",
  inTransit: "inTransit",
  delivered: "delivered"
};

function copyValues(
  eta: EtaView, worryKey: KstDateKey | null, last: TimedEvent | null, carrierName: string, config: SiteConfig
): Readonly<Record<CopyToken, string>> {
  const etaKey = "date" in eta ? eta.date.key : null;
  return {
    etaDate: etaKey === null ? "" : formatKstDateTight(etaKey),
    worryDate: worryKey === null ? "" : formatKstDateTight(worryKey),
    lastEventDate: last === null ? "" : formatKstDateTight(last.at),
    carrier: carrierName,
    staleDays: String(config.durations.staleDays)
  };
}

/** Overdue → no stores, recommendations or ads (spec §7 overdue, §8). */
function revenueFor(key: DataGuideKey, config: SiteConfig, overdue: boolean): RevenueView {
  if (overdue) return NO_REVENUE;
  const row = config.stateGuide[key];
  return {
    tier: row.revenueTier,
    stores: row.stores,
    recommendations: row.recommendations,
    recommendationContext: row.recommendations === "none" ? null : RECOMMENDATION_CONTEXT[key] ?? null,
    adsAllowed: row.revenueTier !== "none"
  };
}

function auxiliaryLineFor(data: TrackResponseData, key: DataGuideKey, config: SiteConfig): TrackingViewModel["auxiliaryLine"] {
  if (!OVERDUE_KEYS.has(key) || data.delivery.lookupUnavailable !== true) return null;
  return { text: config.resultCopy.carrierCutLine, action: retryAction(config, "text") };
}

/** '마지막 단계' of the inquiry copy: the chip of the state the status code implies ('통관 대기'). */
function stageLabel(data: TrackResponseData, config: SiteConfig): string {
  const row = config.stateGuide[codeGuideKey(data)];
  return row.chip ?? row.docTitle;
}

export function deriveSuccessView(request: LookupRequest, data: TrackResponseData, now: Date, config: SiteConfig): TrackingViewModel {
  const key = dataGuideKey(data, now, config);
  const row = config.stateGuide[key];
  const events = timedEvents(data);
  const last = latestEvent(events);
  const worryKey = worryDateKey(data, key, config);
  const overdue = OVERDUE_KEYS.has(key) && isOverdue(worryKey, now);
  const number = numberView(request.number);
  const carrier = carrierForData(data, request, key, config);
  const spine = spineFor(data, key, config);
  const eta = etaFor({ data, key, overdue, now, events, config });
  const values = copyValues(eta, worryKey, last, carrier.name ?? config.resultCopy.carrierUnknown, config);
  const title = fillCopy(overdue && row.overdueTitle !== null ? row.overdueTitle : row.title, values);
  const nextAction = nextActionForData({ data, key, overdue, carrier, worryKey, events, values, config });
  const hasCopyAction = [nextAction.primary, ...nextAction.secondary].some((item) => item?.kind === "copyAndTalk" || item?.kind === "copyInquiry");
  const chipBase = overdue ? config.resultCopy.overdueChip : row.chip;
  return {
    guideKey: key,
    mode: "settled",
    tone: overdue ? "attention" : row.tone,
    overdue,
    number,
    carrier,
    chip: chipBase === null ? null : spine.positionLabel === null ? chipBase : `${chipBase} · ${spine.positionLabel}`,
    title,
    reason: row.reason === null ? null : fillCopy(row.reason, values),
    notice: noticeFor(config, now, key),
    spine,
    eta,
    nextAction,
    lastEvent: lastEventFor(last, config),
    history: historyFor(events, config),
    ctaState: ctaStateFor(key),
    inquiryLevel: overdue ? "primary" : row.inquiryLevel,
    revenue: revenueFor(key, config, overdue),
    retry: null,
    auxiliaryLine: auxiliaryLineFor(data, key, config),
    help: helpFor(config, key),
    inquiryCopy: hasCopyAction
      ? buildInquiryCopy({ kind: "status", number, stage: stageLabel(data, config), lastEventAt: last?.at ?? null })
      : null,
    returnLink: buildReturnLink(number.raw, carrier.code),
    documentTitle: documentTitleFor(row.docTitle),
    liveMessage: liveMessageFor(title, eta)
  };
}
```

- [ ] **Step 6: Write the basic error view and the dispatcher**

Create `lib/tracking/derive/failure-view.ts` (Task 11 replaces this file with the cause-specific version):

```ts
import type { SiteConfig } from "@/lib/config/types";
import { buildReturnLink } from "@/lib/site";
import { requestCarrierView } from "@/lib/tracking/carriers";
import { guideKeyForFailure } from "@/lib/tracking/classify-failure";
import { copyAndTalkAction, fixNumberAction, retryAction, talkAction } from "@/lib/tracking/derive/actions";
import { historyFor } from "@/lib/tracking/derive/history";
import { NO_REVENUE, documentTitleFor, helpFor, noticeFor, numberView } from "@/lib/tracking/derive/shared";
import { EMPTY_SPINE } from "@/lib/tracking/derive/spine";
import { buildInquiryCopy } from "@/lib/tracking/inquiry-copy";
import { fillCopy } from "@/lib/tracking/template";
import type { ActionView, LookupOutcome, PrimaryActionKind, TrackingViewModel } from "@/lib/tracking/types";

type FailureOutcome = Extract<LookupOutcome, { kind: "failure" }>;

function recoveryAction(kind: PrimaryActionKind, config: SiteConfig): ActionView | null {
  switch (kind) {
    case "fixNumber":
      return fixNumberAction(config, "primary");
    case "retry":
      return retryAction(config, "primary");
    case "copyAndTalk":
      return copyAndTalkAction(config);
    default:
      return null;
  }
}

export function deriveFailureView(outcome: FailureOutcome, now: Date, config: SiteConfig): TrackingViewModel {
  const key = guideKeyForFailure(outcome.cause);
  const row = config.stateGuide[key];
  const number = numberView(outcome.request.number);
  const carrier = requestCarrierView(outcome.request, config.resultCopy.carrierUnknown);
  const values = { carrier: carrier.name ?? config.resultCopy.carrierUnknown, staleDays: String(config.durations.staleDays) };
  const title = fillCopy(row.title, values);
  const primary = recoveryAction(row.primaryAction, config);
  const secondary = primary?.kind === "copyAndTalk" ? [retryAction(config, "secondary")] : [talkAction(config, "secondary")];
  return {
    guideKey: key,
    mode: "error",
    tone: row.tone,
    overdue: false,
    number,
    carrier,
    chip: row.chip,
    title,
    reason: row.reason === null ? null : fillCopy(row.reason, values),
    notice: noticeFor(config, now, key),
    spine: EMPTY_SPINE,
    eta: { kind: "none" },
    nextAction: {
      heading: row.ctaHeading, sentence: fillCopy(row.nextAction, values), primary, secondary,
      worry: null, stores: null, carrierChoices: null, note: null
    },
    lastEvent: null,
    history: historyFor([], config),
    ctaState: "error",
    inquiryLevel: row.inquiryLevel,
    revenue: NO_REVENUE,
    retry: { cooldownSeconds: null, autoRetryWhenOnline: false, escalated: false },
    auxiliaryLine: null,
    help: helpFor(config, key),
    inquiryCopy: primary?.kind === "copyAndTalk" ? buildInquiryCopy({ kind: "screenError", number, now }) : null,
    returnLink: buildReturnLink(number.raw, outcome.request.carrier),
    documentTitle: documentTitleFor(row.docTitle),
    liveMessage: title
  };
}
```

Replace the whole content of `lib/tracking/derive-view.ts` with:

```ts
import type { SiteConfig } from "@/lib/config/types";
import { deriveFailureView } from "@/lib/tracking/derive/failure-view";
import { dataGuideKey } from "@/lib/tracking/derive/keys";
import { deriveSuccessView } from "@/lib/tracking/derive/success-view";
import type { GuideKey, LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

export { isOverdue, worryDateKey } from "@/lib/tracking/derive/worry";

/**
 * The one source of truth for result and error screens, CS replies, previews and tests (spec §2 원칙 3).
 * `now` is the client's clock when the result settles (never read during render); every date is judged in KST.
 */
export function deriveTrackingView(outcome: LookupOutcome, now: Date, config: SiteConfig): TrackingViewModel {
  return outcome.kind === "success"
    ? deriveSuccessView(outcome.request, outcome.data, now, config)
    : deriveFailureView(outcome, now, config);
}

export function guideKeyForData(data: TrackResponseData, now: Date, config: SiteConfig): GuideKey {
  return dataGuideKey(data, now, config);
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/derive-view.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck; npm run lint`
Expected: `48 passed`; typecheck and lint exit 0. If a date expectation differs, recompute it by hand from the scenario's events with the rules in contract addition 8 before touching the code; never change an expectation to match output without that check.

- [ ] **Step 8: Commit**

```powershell
git add lib/tracking/derive lib/tracking/derive-view.ts tests/unit/derive-view.spec.ts; git commit -m "feat: derive result view models for every data state including overdue"
```

### Task 11: Cause-specific error views and the GAP3-06 zero-contradiction table

**Files:**
- Modify: `lib/tracking/derive/failure-view.ts` (replace the whole file)
- Test: `tests/unit/derive-view.spec.ts` (final import block, constants, two describe blocks)

**Interfaces:**
- Consumes: Task 10 helpers; `GAP3_06_VARIANTS`, `trackData`, `FixtureState` (S01 fixtures, contract §11.10); `classifyFailure` (Task 1); `withConfig` (Task 5).
- Produces: the complete error view of contract §11.6/§11.8 — NOT_FOUND 7-day worry line and the pre-R4 caveat line (`lookup.notFoundServiceCaveat`), 429 countdown reason and `cooldownSeconds`, offline `autoRetryWhenOnline`, 2-failure escalation (`retry.escalated`, 톡톡 primary, `inquiryLevel` `primary`), the chosen carrier's official lookup on temporary delays, `inquiryCopy` for copy-and-talk; `GuideRow.primaryAction` as the only switch for an error row's action order (`copyAndTalk` row → 톡톡 filled primary; `noResponse` `fixNumber` row → [다시 조회] secondary) — contract addition 10. The pending-approval-3 fallback itself is S04's/S07's view transform, not a config edit.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/derive-view.spec.ts`, replace the import block with:

```ts
import { expect, test } from "@playwright/test";
import { buildReturnLink } from "@/lib/site";
import { carrierOfficialUrl } from "@/lib/tracking/carriers";
import { classifyFailure } from "@/lib/tracking/classify-failure";
import { deriveTrackingView, guideKeyForData, isOverdue, worryDateKey } from "@/lib/tracking/derive-view";
import { PROBLEM_GUIDE_KEYS } from "@/lib/tracking/types";
import type {
  ActionView, CtaState, FailureCause, FailureInput, GuideKey, RevenueView, TrackingViewModel
} from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";
import { FIXTURE_CONFIG, withConfig } from "../fixtures/config-fixtures";
import {
  CJ_URL, MOVED_NOW, OCTOBER_NOW, PICKUP_NOW, ambiguousData, carrierCutData, customsArrivedData, customsClearedData,
  customsReviewData, customsWaitingData, deliveredData, ev, failure, handedToCarrierData, inTransitData, lookupUnavailableData,
  movedEstimateData, pendingData, pickedUpData, staleData, success
} from "../fixtures/derive-scenarios";
import { FAKE, FAKE_GROUPED, FIXTURE_NOW, GAP3_06_VARIANTS, trackData } from "../fixtures/tracking-fixtures";
import type { FixtureState } from "../fixtures/tracking-fixtures";
```

Below the `BASELINE_OVERDUE` constant add:

```ts
const TALK_SECONDARY: ActionView = { ...TALK_TEXT, weight: "secondary" };
const RETRY_TEXT: ActionView = { kind: "retry", label: "다시 조회", weight: "text", href: null, external: false, cooldownSeconds: null };
const RETRY_SECONDARY: ActionView = { ...RETRY_TEXT, weight: "secondary" };

const GAP3_06_KEYS: Readonly<Partial<Record<FixtureState, GuideKey>>> = {
  pending: "pending", customsArrived: "customsArrived", customsWaiting: "customsWaiting", customsReview: "customsWaiting",
  customsCleared: "customsCleared", pickedUp: "pickedUp", inTransit: "inTransit", delivered: "delivered", stale: "stale",
  lookupUnavailableAuto: "lookupUnavailable", lookupUnavailableCarrier: "lookupUnavailable", ambiguous: "ambiguous"
};
const ERROR_CODE_INPUTS: readonly FailureInput[] = [
  { kind: "http", status: 400, code: "INVALID_NUMBER", isJson: true },
  { kind: "http", status: 504, code: "API_TIMEOUT", isJson: true },
  { kind: "http", status: 404, code: "NOT_FOUND", isJson: true },
  { kind: "http", status: 500, code: "SERVER_ERROR", isJson: true },
  { kind: "http", status: 429, code: "RATE_LIMITED", isJson: true }
];
const CTA_BY_KEY: Readonly<Partial<Record<GuideKey, CtaState>>> = {
  pending: "pending", customsArrived: "customsWaiting", customsWaiting: "customsWaiting", customsCleared: "customsCleared",
  handedToCarrier: "customsCleared", pickedUp: "customsCleared", inTransit: "inTransit", delivered: "delivered",
  stale: "stale", lookupUnavailable: "lookupUnavailable", ambiguous: "ambiguous"
};
const PROBLEM_KEYS: ReadonlySet<GuideKey> = new Set<GuideKey>(PROBLEM_GUIDE_KEYS);
const NORMAL_WAITING: ReadonlySet<GuideKey> = new Set<GuideKey>(["customsArrived", "customsWaiting", "customsCleared"]);
const UNRESOLVED_TOKEN = /\{[A-Za-z]+\}/;

/** The rules GAP3-06 found broken in 8 of 12 variants; returns one message per rule a view breaks. */
function contradictions(view: TrackingViewModel): readonly string[] {
  const actions = [view.nextAction.primary, ...view.nextAction.secondary].filter((item): item is ActionView => item !== null);
  const firstLinkKind = actions.find((item) => item.href !== null)?.kind;
  const stores = view.nextAction.stores;
  const texts = [
    view.title, view.reason ?? "", view.chip ?? "", view.nextAction.sentence, view.nextAction.worry?.text ?? "",
    view.nextAction.note ?? "", view.documentTitle, view.liveMessage
  ];
  const problem = view.mode === "error" || PROBLEM_KEYS.has(view.guideKey) || view.overdue;
  const rules: ReadonlyArray<readonly [string, boolean]> = [
    ["CTA state matches the summary", view.ctaState !== (view.mode === "error" ? "error" : CTA_BY_KEY[view.guideKey])],
    ["at most two secondary actions", view.nextAction.secondary.length > 2],
    ["no unresolved tokens", texts.some((text) => UNRESOLVED_TOKEN.test(text))],
    ["problem states carry no stores, recommendations or ads",
      problem && (stores !== null || view.revenue.stores !== "none" || view.revenue.recommendations !== "none" || view.revenue.adsAllowed)],
    ["in transit keeps stores out of the CTA", view.guideKey === "inTransit" && stores !== null],
    ["delivered leads with the stores", view.guideKey === "delivered" && stores?.links[0]?.weight !== "primary"],
    ["pending offers 톡톡 and purchase choices",
      view.guideKey === "pending" && (stores?.placement !== "pending" || !actions.some((item) => item.kind === "talk"))],
    ["stale withholds the estimate", view.guideKey === "stale" && view.eta.kind !== "withheld"],
    ["pending shows '정보 등록 후 안내'", view.guideKey === "pending" && view.eta.kind !== "pendingInfo"],
    ["carrier links only with the known official URL",
      actions.some((item) => item.kind === "carrierOfficial" && (item.href === null || item.href !== view.carrier.officialUrl))],
    ["'배송이 진행 중이에요' only while in transit", view.nextAction.heading === "배송이 진행 중이에요" && view.guideKey !== "inTransit"],
    ["'아직 국내 배송 정보가 없어요' only while pending", view.nextAction.heading === "아직 국내 배송 정보가 없어요" && view.guideKey !== "pending"],
    ["normal waiting has no filled button", NORMAL_WAITING.has(view.guideKey) && !view.overdue && view.nextAction.primary !== null],
    ["red only for real errors", view.tone === "problem" && view.guideKey !== "serverError"],
    ["overdue uses the attention tone and copy-and-talk", view.overdue && (view.tone !== "attention" || view.nextAction.primary?.kind !== "copyAndTalk")],
    ["disclosure exactly when a link is affiliate",
      stores !== null && (stores.disclosure !== null) !== stores.links.some((link) => link.isAffiliate)],
    ["spine position only with a current station", (view.spine.current === null) !== (view.spine.positionLabel === null)],
    ["errors lead with 톡톡", view.mode === "error" && firstLinkKind !== "talk" && firstLinkKind !== "copyAndTalk"],
    ["copy actions carry the inquiry text", actions.some((item) => item.kind === "copyAndTalk") !== (view.inquiryCopy !== null)]
  ];
  return rules.filter(([, broken]) => broken).map(([rule]) => `${view.guideKey}${view.overdue ? " (overdue)" : ""}: ${rule}`);
}
```

Append to the end of the file:

```ts
test.describe("error views by cause", () => {
  const withCaveat = withConfig({ lookup: { notFoundServiceCaveat: true } });
  const withoutCaveat = withConfig({ lookup: { notFoundServiceCaveat: false } });

  test("NOT_FOUND: fix the number first, 톡톡 as the first link, 7-day worry line, caveat line before R4", () => {
    const view = deriveTrackingView(failure("notFound"), FIXTURE_NOW, withCaveat);
    expect(view.guideKey).toBe("notFound");
    expect(view.tone).toBe("attention");
    expect(view.chip).toBe("조회 결과 없음");
    expect(view.title).toBe("아직 조회되는 정보가 없어요");
    expect(view.nextAction.heading).toBe("조회가 잘되지 않나요?");
    expect(view.nextAction.primary).toEqual({ kind: "fixNumber", label: "번호 수정", weight: "primary", href: null, external: false, cooldownSeconds: null });
    expect(view.nextAction.secondary).toEqual([
      TALK_SECONDARY, { kind: "copyReturnLink", label: "다시 볼 링크 복사", weight: "text", href: null, external: false, cooldownSeconds: null }
    ]);
    expect(view.nextAction.worry).toEqual({ dateKey: null, text: "출고 안내를 받은 지 7일이 지나도 조회되지 않으면 번호를 보내 주세요", talk: TALK_TEXT });
    expect(view.auxiliaryLine).toEqual({ text: "조회 서비스 사정으로 결과가 없을 수도 있어요", action: RETRY_TEXT });
    expect(view.retry).toEqual({ cooldownSeconds: null, autoRetryWhenOnline: false, escalated: false });
    expect(view.help.map((item) => item.id)).toEqual(["pre-arrival", "order-check"]);
    expect(view.inquiryCopy).toBeNull();
  });

  test("NOT_FOUND after the R4 server fix: no caveat line, 다시 조회 moves into the CTA block", () => {
    const view = deriveTrackingView(failure("notFound"), FIXTURE_NOW, withoutCaveat);
    expect(view.auxiliaryLine).toBeNull();
    expect(view.nextAction.secondary).toEqual([TALK_SECONDARY, RETRY_TEXT]);
  });

  test("429: the reason becomes the countdown sentence and 다시 조회 waits 10 s", () => {
    const view = deriveTrackingView(failure("rateLimited"), FIXTURE_NOW, withConfig({ lookup: { rateLimitCooldownSeconds: 10 } }));
    expect(view.guideKey).toBe("temporaryDelay");
    expect(view.title).toBe("조회가 잠시 지연되고 있어요");
    expect(view.reason).toBe("조회가 몰려 10초 뒤 다시 조회할 수 있어요");
    expect(view.nextAction.primary).toEqual({ kind: "retry", label: "다시 조회", weight: "primary", href: null, external: false, cooldownSeconds: 10 });
    expect(view.retry).toEqual({ cooldownSeconds: 10, autoRetryWhenOnline: false, escalated: false });
  });

  test("503/504 with a chosen carrier: retry first, 톡톡, then the carrier's official lookup", () => {
    const view = deriveTrackingView(failure("upstreamTimeout", { carrier: "CJ" }), FIXTURE_NOW, CONFIG);
    expect(view.reason).toBe("번호 문제는 아니에요.");
    expect(view.carrier.barLabel).toBe("CJ대한통운");
    expect(view.nextAction.primary?.kind).toBe("retry");
    expect(view.nextAction.secondary).toEqual([
      TALK_SECONDARY,
      { kind: "carrierOfficial", label: "CJ대한통운 공식 배송조회", weight: "text", href: carrierOfficialUrl("CJ", FAKE.domestic), external: true, cooldownSeconds: null }
    ]);
    expect(view.returnLink).toBe(buildReturnLink(FAKE.domestic, "CJ"));
  });

  test("offline: one automatic re-lookup when the connection returns", () => {
    const view = deriveTrackingView(failure("offline"), FIXTURE_NOW, CONFIG);
    expect(view.guideKey).toBe("offline");
    expect(view.title).toBe("인터넷 연결이 끊겼어요");
    expect(view.retry).toEqual({ cooldownSeconds: null, autoRetryWhenOnline: true, escalated: false });
  });

  test("client timeout: no '번호 문제는 아니에요'; retry first, 번호 수정 as a secondary", () => {
    const view = deriveTrackingView(failure("clientTimeout"), FIXTURE_NOW, CONFIG);
    expect(view.guideKey).toBe("noResponse");
    expect(view.title).toBe("응답이 너무 오래 걸려 조회를 멈췄어요");
    expect(view.reason).not.toContain("번호 문제는 아니에요");
    expect(view.nextAction.primary?.kind).toBe("retry");
    expect(view.nextAction.secondary).toEqual([
      TALK_SECONDARY, { kind: "fixNumber", label: "번호 수정", weight: "secondary", href: null, external: false, cooldownSeconds: null }
    ]);
    // Spec §16 item 3 names [번호 수정] for 응답 없음: a fixNumber row swaps the two recovery actions, never duplicates one.
    const fixFirst = deriveTrackingView(failure("clientTimeout"), FIXTURE_NOW, withConfig({ stateGuide: { noResponse: { primaryAction: "fixNumber" } } }));
    expect(fixFirst.nextAction.primary?.kind).toBe("fixNumber");
    expect(fixFirst.nextAction.secondary).toEqual([TALK_SECONDARY, RETRY_SECONDARY]);
  });

  test("500 and contract violation: red tone, copy-and-talk primary with a screen-error inquiry text", () => {
    for (const cause of ["serverError", "contractViolation"] as const) {
      const view = deriveTrackingView(failure(cause), FIXTURE_NOW, CONFIG);
      expect(view.guideKey, cause).toBe("serverError");
      expect(view.tone, cause).toBe("problem");
      expect(view.nextAction.primary, cause).toEqual(COPY_AND_TALK);
      expect(view.nextAction.secondary, cause).toEqual([RETRY_SECONDARY]);
      expect(view.inquiryCopy, cause).toBe(`[배송 문의] 조회번호 ${FAKE_GROUPED.domestic} / 조회 화면 오류 / 9월 26일 14:05`);
      expect(view.inquiryLevel, cause).toBe("primary");
    }
  });

  test("two failures in a row raise 톡톡 to the primary button; invalid numbers never escalate", () => {
    const delay = deriveTrackingView(failure("network", { consecutiveFailures: 2 }), FIXTURE_NOW, CONFIG);
    expect(delay.nextAction.primary).toEqual(COPY_AND_TALK);
    expect(delay.nextAction.secondary).toEqual([RETRY_SECONDARY]);
    expect(delay.retry?.escalated).toBe(true);
    expect(delay.inquiryLevel).toBe("primary");
    expect(delay.inquiryCopy).toBe(`[배송 문의] 조회번호 ${FAKE_GROUPED.domestic} / 조회 화면 오류 / 9월 26일 14:05`);
    const notFound = deriveTrackingView(failure("notFound", { consecutiveFailures: 2 }), FIXTURE_NOW, CONFIG);
    expect(notFound.nextAction.secondary.map((item) => [item.kind, item.weight])).toEqual([["fixNumber", "secondary"]]);
    const invalid = deriveTrackingView(failure("invalidNumber", { consecutiveFailures: 3 }), FIXTURE_NOW, CONFIG);
    expect(invalid.retry?.escalated).toBe(false);
    expect(invalid.nextAction.primary?.kind).toBe("fixNumber");
  });

  test("invalid number: the input error sentence and 톡톡 as the only link", () => {
    const view = deriveTrackingView(failure("invalidNumber"), FIXTURE_NOW, CONFIG);
    expect(view.title).toBe("번호 형식이 달라요. 숫자 10~14자리 또는 영문 3~4자+숫자예요.");
    expect(view.chip).toBe("번호 확인");
    expect(view.carrier.barLabel).toBe("택배사");
    expect(view.nextAction.secondary).toEqual([TALK_SECONDARY]);
  });

  test("an outage notice explains a delay; holiday notices never show on error screens", () => {
    expect(deriveTrackingView(failure("upstreamTimeout"), at("2026-09-26T22:30:00+09:00"), CONFIG).notice?.id).toBe("fx-outage");
    expect(deriveTrackingView(failure("upstreamTimeout"), FIXTURE_NOW, CONFIG).notice).toBeNull();
  });

  test("a copyAndTalk error row makes 톡톡 the filled primary and the recovery action a secondary", () => {
    const fallback = withConfig({ stateGuide: { notFound: { primaryAction: "copyAndTalk", inquiryLevel: "primary" } } });
    const view = deriveTrackingView(failure("notFound"), FIXTURE_NOW, fallback);
    expect(view.nextAction.primary).toEqual(COPY_AND_TALK);
    expect(view.nextAction.secondary.map((item) => [item.kind, item.weight])).toEqual([["fixNumber", "secondary"]]);
  });
});

test.describe("GAP3-06: 12 state variants and the 5 API error codes show 0 contradictions", () => {
  test("each variant maps to its state", () => {
    for (const state of GAP3_06_VARIANTS) {
      expect(deriveTrackingView(success(trackData(state)), FIXTURE_NOW, CONFIG).guideKey, state).toBe(GAP3_06_KEYS[state]);
    }
  });

  test("0 contradictions across the 12 variants and the 5 error codes", () => {
    const views = [
      ...GAP3_06_VARIANTS.map((state) => deriveTrackingView(success(trackData(state)), FIXTURE_NOW, CONFIG)),
      ...ERROR_CODE_INPUTS.map((input) => deriveTrackingView(failure(classifyFailure(input)), FIXTURE_NOW, CONFIG))
    ];
    expect(views).toHaveLength(17);
    expect(views.flatMap(contradictions)).toEqual([]);
  });

  test("0 contradictions for the explicit scenarios, their overdue forms and every failure cause", () => {
    const septemberData = [
      customsArrivedData(), customsWaitingData(), customsReviewData(), customsClearedData(), carrierCutData(), pendingData(),
      deliveredData(), staleData(), lookupUnavailableData("AUTO"), lookupUnavailableData("CJ"), ambiguousData()
    ];
    const views = [
      ...septemberData.map((data) => deriveTrackingView(success(data), FIXTURE_NOW, CONFIG)),
      deriveTrackingView(success(pickedUpData()), PICKUP_NOW, CONFIG),
      deriveTrackingView(success(handedToCarrierData()), PICKUP_NOW, CONFIG),
      BASELINE_IN_TRANSIT,
      BASELINE_OVERDUE,
      deriveTrackingView(success(inTransitData()), at("2026-10-16T00:00:00+09:00"), CONFIG),
      deriveTrackingView(success(customsClearedData()), at("2026-09-30T09:00:00+09:00"), CONFIG),
      ...ALL_CAUSES.map((cause) => deriveTrackingView(failure(cause), FIXTURE_NOW, CONFIG)),
      ...ALL_CAUSES.map((cause) => deriveTrackingView(failure(cause, { consecutiveFailures: 2 }), FIXTURE_NOW, CONFIG))
    ];
    expect(views.flatMap(contradictions)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/derive-view.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `8 failed, 54 passed` — failing: the two NOT_FOUND rows, 429, 503/504 with a carrier, offline, client timeout, escalation, the copyAndTalk-row test (the basic error view has no cause-specific behavior yet). The GAP3-06 rows already pass; if one fails, its message names the state and the broken rule — fix `lib/tracking/derive/*` (never the S01 fixture or the rule).

- [ ] **Step 3: Write the cause-specific error view**

Replace the whole content of `lib/tracking/derive/failure-view.ts` with:

```ts
import type { GuideRow, SiteConfig } from "@/lib/config/types";
import { buildReturnLink } from "@/lib/site";
import { requestCarrierView } from "@/lib/tracking/carriers";
import { guideKeyForFailure } from "@/lib/tracking/classify-failure";
import {
  carrierOfficialAction, copyAndTalkAction, fixNumberAction, retryAction, returnLinkAction, talkAction
} from "@/lib/tracking/derive/actions";
import { historyFor } from "@/lib/tracking/derive/history";
import { NO_REVENUE, documentTitleFor, helpFor, noticeFor, numberView } from "@/lib/tracking/derive/shared";
import { EMPTY_SPINE } from "@/lib/tracking/derive/spine";
import { buildInquiryCopy } from "@/lib/tracking/inquiry-copy";
import { fillCopy, fillSlots } from "@/lib/tracking/template";
import { ERROR_GUIDE_KEYS } from "@/lib/tracking/types";
import type { ActionView, CarrierView, GuideKey, LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";

type FailureOutcome = Extract<LookupOutcome, { kind: "failure" }>;
type ErrorKey = (typeof ERROR_GUIDE_KEYS)[number];

/** Two failures for the same number in a row make 톡톡 the filled primary (spec §5). */
const ESCALATE_AFTER_FAILURES = 2;
const ERROR_KEYS: ReadonlySet<GuideKey> = new Set<GuideKey>(ERROR_GUIDE_KEYS);

/** What the customer can do alone when the row does not name fixNumber or retry itself. */
const NATURAL_RECOVERY: Readonly<Record<ErrorKey, "fixNumber" | "retry">> = {
  invalidNumber: "fixNumber", notFound: "fixNumber", temporaryDelay: "retry", offline: "retry", noResponse: "retry", serverError: "retry"
};

interface FailureContext {
  readonly key: ErrorKey;
  readonly row: GuideRow;
  readonly config: SiteConfig;
  readonly carrier: CarrierView;
  readonly escalated: boolean;
  readonly cooldownSeconds: number | null;
  readonly caveat: boolean;
}

function isErrorKey(key: GuideKey): key is ErrorKey {
  return ERROR_KEYS.has(key);
}

function recoveryAction(context: FailureContext, weight: "primary" | "secondary"): ActionView {
  const configured = context.row.primaryAction;
  const kind = configured === "fixNumber" || configured === "retry" ? configured : NATURAL_RECOVERY[context.key];
  return kind === "fixNumber" ? fixNumberAction(context.config, weight) : retryAction(context.config, weight, context.cooldownSeconds);
}

function extraSecondary(context: FailureContext): readonly ActionView[] {
  const { key, config, carrier, caveat } = context;
  switch (key) {
    case "notFound":
      return [caveat ? returnLinkAction(config, "text") : retryAction(config, "text")];
    case "temporaryDelay":
      return carrier.officialUrl === null || carrier.name === null
        ? []
        : [carrierOfficialAction(config, carrier.name, carrier.officialUrl, "text", false)];
    case "noResponse":
      // The recovery action the row did not make primary (spec §7: retry first; §16 item 3 proposal: fixNumber first).
      return [context.row.primaryAction === "fixNumber" ? retryAction(config, "secondary") : fixNumberAction(config, "secondary")];
    default:
      return [];
  }
}

/** 톡톡 is always the first link of the error CTA block; the recovery action leads unless 톡톡 is the filled primary. */
function failureActions(context: FailureContext): { readonly primary: ActionView | null; readonly secondary: readonly ActionView[] } {
  const { row, config, escalated } = context;
  if (escalated || row.primaryAction === "copyAndTalk") {
    return { primary: copyAndTalkAction(config), secondary: [recoveryAction(context, "secondary")] };
  }
  const primary = row.primaryAction === "none" ? null : recoveryAction(context, "primary");
  return { primary, secondary: [talkAction(config, "secondary"), ...extraSecondary(context)] };
}

export function deriveFailureView(outcome: FailureOutcome, now: Date, config: SiteConfig): TrackingViewModel {
  const key = guideKeyForFailure(outcome.cause);
  if (!isErrorKey(key)) throw new Error(`오류 상태가 아닙니다: ${key}`);
  const row = config.stateGuide[key];
  const copy = config.resultCopy;
  const number = numberView(outcome.request.number);
  const carrier = requestCarrierView(outcome.request, copy.carrierUnknown);
  const cooldownSeconds = outcome.cause === "rateLimited" ? config.lookup.rateLimitCooldownSeconds : null;
  const escalated = key !== "invalidNumber" && outcome.consecutiveFailures >= ESCALATE_AFTER_FAILURES;
  const caveat = key === "notFound" && config.lookup.notFoundServiceCaveat;
  const { primary, secondary } = failureActions({ key, row, config, carrier, escalated, cooldownSeconds, caveat });
  const values = { carrier: carrier.name ?? copy.carrierUnknown, staleDays: String(config.durations.staleDays) };
  const title = fillCopy(row.title, values);
  const reason = cooldownSeconds === null ? row.reason : fillSlots(copy.rateLimitedReason, { seconds: String(cooldownSeconds) });
  return {
    guideKey: key,
    mode: "error",
    tone: row.tone,
    overdue: false,
    number,
    carrier,
    chip: row.chip,
    title,
    reason: reason === null ? null : fillCopy(reason, values),
    notice: noticeFor(config, now, key),
    spine: EMPTY_SPINE,
    eta: { kind: "none" },
    nextAction: {
      heading: row.ctaHeading,
      sentence: fillCopy(row.nextAction, values),
      primary,
      secondary,
      worry: key === "notFound" && row.worry !== null
        ? { dateKey: null, text: fillCopy(row.worry, values), talk: talkAction(config, "text") }
        : null,
      stores: null,
      carrierChoices: null,
      note: null
    },
    lastEvent: null,
    history: historyFor([], config),
    ctaState: "error",
    inquiryLevel: escalated ? "primary" : row.inquiryLevel,
    revenue: NO_REVENUE,
    retry: { cooldownSeconds, autoRetryWhenOnline: outcome.cause === "offline", escalated },
    auxiliaryLine: caveat ? { text: copy.notFoundCaveat, action: retryAction(config, "text") } : null,
    help: helpFor(config, key),
    inquiryCopy: primary?.kind === "copyAndTalk" ? buildInquiryCopy({ kind: "screenError", number, now }) : null,
    returnLink: buildReturnLink(number.raw, outcome.request.carrier),
    documentTitle: documentTitleFor(row.docTitle),
    liveMessage: title
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/derive-view.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck; npm run lint`
Expected: `62 passed`; typecheck and lint exit 0.

- [ ] **Step 5: Commit**

```powershell
git add lib/tracking/derive/failure-view.ts tests/unit/derive-view.spec.ts; git commit -m "feat: derive cause-specific error views and lock GAP3-06 at zero contradictions"
```

### Task 12: Loading view model

**Files:**
- Create: `lib/tracking/loading-view.ts`
- Test: `tests/unit/loading-view.spec.ts`

**Interfaces:**
- Consumes: `LoadingConfig` (`lookup` + `notices`), `requestCarrierView` (Task 4, bar label `lookup.copy.carrierAuto` while the carrier is unknown), `pickNotice`/`toNoticeView` (outage-only for `loading`, Task 4), `groupTrackingNumber`, `fillSlots` (Task 3). Client-safe: no zod, no `lib/delivery-carriers.ts`, no `lib/tracking/derive/*` (checked in Task 14).
- Produces (contract §11.8 + addition 7): `deriveLoadingView(input: { request: LookupRequest; elapsedMs: number; reducedMotion: boolean; now: Date }, config: LoadingConfig): LoadingViewModel`, `loadingStageAt(elapsedMs: number, config: LoadingConfig): LoadingStage`, `nextLoadingChangeMs(elapsedMs: number, config: LoadingConfig): number`. `announcement` is the sentence of the current stage (`started` in `short`, `veryLongWait` in `veryLong`); S04's hook announces it once when the stage changes.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/loading-view.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import type { LoadingConfig } from "@/lib/config/types";
import { carrierOfficialUrl } from "@/lib/tracking/carriers";
import { deriveLoadingView, loadingStageAt, nextLoadingChangeMs } from "@/lib/tracking/loading-view";
import type { LoadingViewModel, LookupRequest } from "@/lib/tracking/types";
import { FIXTURE_CONFIG, withConfig } from "../fixtures/config-fixtures";
import { FAKE, FAKE_GROUPED, FIXTURE_NOW } from "../fixtures/tracking-fixtures";

// Timings pinned here so S10 Part B can change the shipped values without editing this file.
const LOADING: LoadingConfig = {
  lookup: { ...FIXTURE_CONFIG.lookup, skeletonDelayMs: 400, stageMs: [3000, 8000], spinnerStopMs: 5000, elapsedStepSeconds: 5, timeoutMs: 45000 },
  notices: FIXTURE_CONFIG.notices
};
const AUTO: LookupRequest = { number: FAKE.domestic, carrier: "AUTO", entry: "manual" };
const CJ: LookupRequest = { number: FAKE.domestic, carrier: "CJ", entry: "deepLink" };

function view(elapsedMs: number, request: LookupRequest = AUTO, reducedMotion = false, now: Date = FIXTURE_NOW): LoadingViewModel {
  return deriveLoadingView({ request, elapsedMs, reducedMotion, now }, LOADING);
}

test("stage bounds: [0, 0.4 s) instant, [0.4, 3 s) short, [3, 8 s) long, from 8 s very long", () => {
  expect([0, 399, 400, 2999, 3000, 7999, 8000, 44999].map((ms) => loadingStageAt(ms, LOADING)))
    .toEqual(["instant", "instant", "short", "short", "long", "long", "veryLong", "veryLong"]);
});

test("0–0.4 s: only the busy label changes", () => {
  const model = view(100);
  expect(model.stage).toBe("instant");
  expect(model.submitLabel).toBe("조회 중…");
  expect(model.title).toBe("조회하고 있어요");
  expect(model.body).toBe("관세청 통관 정보와 택배사 배송 정보를 함께 확인해요");
  expect(model.number).toEqual({ raw: FAKE.domestic, grouped: FAKE_GROUPED.domestic });
  expect(model.carrier).toEqual({ code: "AUTO", name: null, barLabel: "택배사 자동 확인", officialUrl: null });
  expect([model.extra, model.elapsedText, model.cancel, model.carrierOfficial, model.announcement]).toEqual([null, null, null, null, null]);
});

test("0.4–3 s: the card appears and '조회를 시작했어요' is the announcement", () => {
  const model = view(400);
  expect(model.stage).toBe("short");
  expect(model.announcement).toBe("조회를 시작했어요");
  expect(model.extra).toBeNull();
  expect(model.cancel).toBeNull();
});

test("3 s: the long-wait sentence and [조회 취소]; no cause is claimed", () => {
  const model = view(3000);
  expect(model.extra).toBe("해외 화물은 여러 해의 기록을 찾아서 조금 더 걸려요. 보통 10초 안에 끝나요.");
  expect(model.extra).not.toContain("번호 문제는 아니에요");
  expect(model.cancel).toEqual({ kind: "cancel", label: "조회 취소", weight: "secondary", href: null, external: false, cooldownSeconds: null });
  expect(model.announcement).toBeNull();
});

test("8 s: the very-long sentence is announced; the elapsed text steps every 5 s", () => {
  const model = view(8000);
  expect(model.extra).toBe("기록이 없는 번호는 30초 가까이 걸릴 수 있어요. 번호가 맞는지 한 번 봐 주세요.");
  expect(model.announcement).toBe(model.extra);
  expect(model.carrierOfficial).toBeNull();
  expect([8000, 12999, 13000, 30500].map((ms) => view(ms).elapsedText)).toEqual(["8초째", "8초째", "13초째", "28초째"]);
});

test("8 s with a chosen carrier: '택배사 공식 조회로 먼저 보기' opens the carrier's page", () => {
  expect(view(7999, CJ).carrierOfficial).toBeNull();
  expect(view(8000, CJ).carrierOfficial).toEqual({
    kind: "carrierOfficial", label: "택배사 공식 조회로 먼저 보기", weight: "text",
    href: carrierOfficialUrl("CJ", FAKE.domestic), external: true, cooldownSeconds: null
  });
  expect(view(100, CJ).carrier.barLabel).toBe("CJ대한통운");
});

test("the spinner stops at 5 s and never spins with reduced motion", () => {
  expect(view(4999).spinnerActive).toBe(true);
  expect(view(5000).spinnerActive).toBe(false);
  expect(view(100, AUTO, true).spinnerActive).toBe(false);
});

test("only outage notices show while loading", () => {
  expect(view(400, AUTO, false, new Date("2026-09-26T22:30:00+09:00")).outageNotice?.id).toBe("fx-outage");
  expect(view(400).outageNotice).toBeNull();
  const holidayForLoading: LoadingConfig = { lookup: LOADING.lookup, notices: [{ ...FIXTURE_CONFIG.notices[0], guideKeys: ["loading"] }] };
  expect(deriveLoadingView({ request: AUTO, elapsedMs: 400, reducedMotion: false, now: FIXTURE_NOW }, holidayForLoading).outageNotice).toBeNull();
});

test("next change times give one timer per visible change", () => {
  expect([0, 400, 3000, 5000, 8000, 12999, 13000].map((ms) => nextLoadingChangeMs(ms, LOADING)))
    .toEqual([400, 3000, 5000, 8000, 13000, 13000, 18000]);
});

test("the R4 timings from S10 Part B work the same way", () => {
  const r4 = withConfig({ lookup: { stageMs: [3000, 7000], timeoutMs: 25000, elapsedStepSeconds: 5 } });
  expect(loadingStageAt(7000, r4)).toBe("veryLong");
  expect(deriveLoadingView({ request: AUTO, elapsedMs: 12000, reducedMotion: false, now: FIXTURE_NOW }, r4).elapsedText).toBe("12초째");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/loading-view.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — import error for `@/lib/tracking/loading-view`.

- [ ] **Step 3: Write the implementation**

Create `lib/tracking/loading-view.ts`:

```ts
import type { LoadingConfig } from "@/lib/config/types";
import { requestCarrierView } from "@/lib/tracking/carriers";
import { pickNotice, toNoticeView } from "@/lib/tracking/notices";
import { groupTrackingNumber } from "@/lib/tracking/number-format";
import { fillSlots } from "@/lib/tracking/template";
import type { ActionView, LoadingStage, LoadingViewModel, LookupRequest } from "@/lib/tracking/types";

// Client-safe (initial bundle through useLookup): no zod, no lib/delivery-carriers.ts, no derive helpers.

const MS_PER_SECOND = 1000;

export function loadingStageAt(elapsedMs: number, config: LoadingConfig): LoadingStage {
  const { skeletonDelayMs, stageMs } = config.lookup;
  if (elapsedMs < skeletonDelayMs) return "instant";
  if (elapsedMs < stageMs[0]) return "short";
  if (elapsedMs < stageMs[1]) return "long";
  return "veryLong";
}

/** Seconds shown from the very-long stage on: start, start + step, start + 2·step … (8, 13, 18 with the defaults). */
function elapsedSeconds(elapsedMs: number, config: LoadingConfig): number | null {
  const veryLongMs = config.lookup.stageMs[1];
  if (elapsedMs < veryLongMs) return null;
  const step = config.lookup.elapsedStepSeconds;
  return Math.ceil(veryLongMs / MS_PER_SECOND) + Math.floor((elapsedMs - veryLongMs) / (step * MS_PER_SECOND)) * step;
}

/** The next elapsed time at which deriveLoadingView returns a different model. */
export function nextLoadingChangeMs(elapsedMs: number, config: LoadingConfig): number {
  const { skeletonDelayMs, stageMs, spinnerStopMs, elapsedStepSeconds } = config.lookup;
  const upcoming = [skeletonDelayMs, stageMs[0], spinnerStopMs, stageMs[1]].filter((bound) => bound > elapsedMs);
  if (upcoming.length > 0) return Math.min(...upcoming);
  const stepMs = elapsedStepSeconds * MS_PER_SECOND;
  return stageMs[1] + (Math.floor((elapsedMs - stageMs[1]) / stepMs) + 1) * stepMs;
}

function extraFor(stage: LoadingStage, config: LoadingConfig): string | null {
  switch (stage) {
    case "long":
      return config.lookup.copy.longWait;
    case "veryLong":
      return config.lookup.copy.veryLongWait;
    default:
      return null;
  }
}

function announcementFor(stage: LoadingStage, config: LoadingConfig): string | null {
  switch (stage) {
    case "short":
      return config.lookup.copy.started;
    case "veryLong":
      return config.lookup.copy.veryLongWait;
    default:
      return null;
  }
}

function cancelAction(label: string): ActionView {
  return { kind: "cancel", label, weight: "secondary", href: null, external: false, cooldownSeconds: null };
}

function officialFirstAction(label: string, href: string): ActionView {
  return { kind: "carrierOfficial", label, weight: "text", href, external: true, cooldownSeconds: null };
}

export function deriveLoadingView(
  input: { readonly request: LookupRequest; readonly elapsedMs: number; readonly reducedMotion: boolean; readonly now: Date },
  config: LoadingConfig
): LoadingViewModel {
  const { request, elapsedMs, reducedMotion, now } = input;
  const copy = config.lookup.copy;
  const stage = loadingStageAt(elapsedMs, config);
  const carrier = requestCarrierView(request, copy.carrierAuto);
  const seconds = elapsedSeconds(elapsedMs, config);
  const outage = pickNotice(config.notices, now, { kind: "result", guideKey: "loading" });
  const waitingLong = stage === "long" || stage === "veryLong";
  return {
    stage,
    number: { raw: request.number, grouped: groupTrackingNumber(request.number) },
    carrier,
    title: copy.title,
    body: copy.body,
    extra: extraFor(stage, config),
    elapsedText: seconds === null ? null : fillSlots(copy.elapsed, { seconds: String(seconds) }),
    cancel: waitingLong ? cancelAction(copy.cancel) : null,
    carrierOfficial: stage === "veryLong" && carrier.officialUrl !== null ? officialFirstAction(copy.carrierOfficialFirst, carrier.officialUrl) : null,
    spinnerActive: !reducedMotion && elapsedMs < config.lookup.spinnerStopMs,
    announcement: announcementFor(stage, config),
    submitLabel: copy.submitting,
    outageNotice: outage === null ? null : toNoticeView(outage)
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/loading-view.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck`
Expected: `10 passed`; typecheck exits 0.

- [ ] **Step 5: Commit**

```powershell
git add lib/tracking/loading-view.ts tests/unit/loading-view.spec.ts; git commit -m "feat: add the staged loading view model"
```

---

### Task 13: Internal CS replies from the same view model

**Files:**
- Create: `lib/cs/cs-templates.ts`, `lib/cs/cs-reply.ts`
- Test: `tests/unit/cs-reply.spec.ts`

**Interfaces:**
- Consumes: `TrackingViewModel` (from `deriveTrackingView`, Tasks 10–11), `Notice`, `activeNotices` (cs slot), `fillSlots`, `formatKstDateTight`, `SITE_ORIGIN` (`@/lib/site`, S01), `durations`, `resultCopy` (`@/config/site.config`).
- Produces (contract §11.8 + addition 15): `interface CsReply { short; long; customerLink }`, `buildCsReply(view: TrackingViewModel, context: { now: Date; notices: readonly Notice[] }): CsReply`, `CS_TEMPLATES: Readonly<Record<GuideKey, { short: string; long: string }>>`, `CS_PHRASES`. Internal-only (contract §11.1 rule 4). Replies contain status, reason, ETA, worry date, the self-service link and active `cs` notices; never internal labels ('택배사 자동 확인', '도착전') and never a promise to contact the customer later. An invalid number links to `${SITE_ORIGIN}/`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/cs-reply.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { buildCsReply } from "@/lib/cs/cs-reply";
import { CS_TEMPLATES } from "@/lib/cs/cs-templates";
import { SITE_ORIGIN, buildReturnLink } from "@/lib/site";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import { GUIDE_KEYS } from "@/lib/tracking/types";
import type { FailureCause, TrackingViewModel } from "@/lib/tracking/types";
import { FIXTURE_CONFIG } from "../fixtures/config-fixtures";
import {
  OCTOBER_NOW, PICKUP_NOW, ambiguousData, customsArrivedData, customsClearedData, customsWaitingData, deliveredData, failure,
  handedToCarrierData, inTransitData, lookupUnavailableData, pendingData, pickedUpData, staleData, success
} from "../fixtures/derive-scenarios";
import { FAKE, FIXTURE_NOW } from "../fixtures/tracking-fixtures";

const CONFIG = FIXTURE_CONFIG;
const CONTEXT = { now: FIXTURE_NOW, notices: CONFIG.notices };
const FOLLOW_UP_PROMISE = /드리겠|안내해\s*드릴|연락\s*드릴|확인되는\s*(대로|즉시)/;
const INTERNAL_LABELS = /택배사 자동 확인|국내택배 자동 조회|도착전|조회 지연|택배사 선택 필요|AUTO|undefined|null|\{[A-Za-z]+\}/;
const CAUSES: readonly FailureCause[] = [
  "invalidNumber", "notFound", "rateLimited", "upstreamTimeout", "badGateway", "network", "offline", "clientTimeout", "serverError", "contractViolation"
];

test("customs waiting: status, ETA with the holiday, worry date and the self-service link", () => {
  const view = deriveTrackingView(success(customsWaitingData()), FIXTURE_NOW, CONFIG);
  const reply = buildCsReply(view, CONTEXT);
  const link = buildReturnLink(FAKE.hbl, "AUTO");
  expect(reply.short).toBe(
    `주문하신 상품은 지금 세관 통관 순서를 기다리고 있습니다. 도착 예상일은 9월 29일(화)이며 추석 연휴 영향으로 1~2일 늦어질 수 있습니다. 9월 28일(월)까지 변동이 없으면 다시 말씀해 주세요. 실시간 확인: ${link}`
  );
  expect(reply.customerLink).toBe(view.returnLink);
  expect(reply.long.split("\n")).toEqual([
    "주문하신 상품은 지금 세관 통관 순서를 기다리고 있습니다.",
    "세관 접수가 끝났고 순서대로 심사가 진행됩니다.",
    "최근 처리: 9월 23일 (수) 14:10 · 통관 접수",
    "도착 예상일은 9월 29일(화)이며 추석 연휴 영향으로 1~2일 늦어질 수 있습니다.",
    "9월 28일(월)까지 변동이 없으면 다시 말씀해 주세요.",
    `안내: ${CONFIG.notices[0].title} - ${CONFIG.notices[0].body}`,
    `실시간 확인: ${link}`
  ]);
});

test("overdue: says it is late and gives the first estimate instead of a worry date", () => {
  const now = new Date("2026-09-29T00:00:00+09:00");
  const view = deriveTrackingView(success(customsWaitingData()), now, CONFIG);
  expect(buildCsReply(view, { now, notices: CONFIG.notices }).short).toBe(
    `주문하신 상품은 지금 세관 통관 순서를 기다리고 있습니다. 예상보다 늦어지고 있어 확인이 필요합니다. 처음 안내한 도착 예상일은 9월 29일(화)입니다. 실시간 확인: ${view.returnLink}`
  );
});

test("in transit today and delivered", () => {
  const transit = buildCsReply(deriveTrackingView(success(inTransitData()), OCTOBER_NOW, CONFIG), { now: OCTOBER_NOW, notices: CONFIG.notices });
  expect(transit.short).toBe(
    `주문하신 상품은 지금 국내 배송 중입니다. 도착 예상일은 오늘, 10월 14일(수)입니다. 10월 15일(목)까지 변동이 없으면 다시 말씀해 주세요. 실시간 확인: ${buildReturnLink(FAKE.domestic, "CJ")}`
  );
  const delivered = buildCsReply(deriveTrackingView(success(deliveredData()), FIXTURE_NOW, CONFIG), CONTEXT);
  expect(delivered.short).toBe(`주문하신 상품은 배송이 완료되었습니다. 배송 완료일은 9월 25일(금)입니다. 실시간 확인: ${buildReturnLink(FAKE.domestic, "CJ")}`);
});

test("the new templates: NOT_FOUND, several carriers, carrier delay and errors", () => {
  const notFound = buildCsReply(deriveTrackingView(failure("notFound"), FIXTURE_NOW, CONFIG), CONTEXT);
  expect(notFound.short).toBe(
    `이 번호로는 아직 조회되는 정보가 없습니다. 번호가 주문내역과 같다면 한국 도착 전일 수 있습니다. 실시간 확인: ${buildReturnLink(FAKE.domestic, "AUTO")}`
  );
  expect(notFound.long).toContain("출고 안내를 받은 지 7일이 지나도 조회되지 않으면 다시 말씀해 주세요.");
  expect(buildCsReply(deriveTrackingView(success(ambiguousData()), FIXTURE_NOW, CONFIG), CONTEXT).short).toContain("같은 번호가 여러 택배사에 있어");
  expect(buildCsReply(deriveTrackingView(success(lookupUnavailableData("AUTO")), FIXTURE_NOW, CONFIG), CONTEXT).short).toContain("택배사 조회가 잠시 늦어");
  expect(buildCsReply(deriveTrackingView(failure("serverError"), FIXTURE_NOW, CONFIG), CONTEXT).short).toContain("일시적인 오류로 조회하지 못했습니다.");
});

test("an invalid number links to the lookup page instead of an invalid deep link", () => {
  const reply = buildCsReply(deriveTrackingView(failure("invalidNumber", { number: FAKE.invalidShort }), FIXTURE_NOW, CONFIG), CONTEXT);
  expect(reply.customerLink).toBe(`${SITE_ORIGIN}/`);
  expect(reply.short.endsWith(`실시간 확인: ${SITE_ORIGIN}/`)).toBe(true);
});

test("templates cover every guide key without follow-up promises", () => {
  expect(Object.keys(CS_TEMPLATES).sort()).toEqual([...GUIDE_KEYS].sort());
  for (const [key, template] of Object.entries(CS_TEMPLATES)) {
    expect(`${template.short} ${template.long}`, key).not.toMatch(FOLLOW_UP_PROMISE);
  }
});

test("replies for every state carry no internal labels, raw codes or unresolved tokens", () => {
  const septemberData = [
    customsArrivedData(), customsWaitingData(), customsClearedData(), pendingData(), deliveredData(), staleData(),
    lookupUnavailableData("AUTO"), lookupUnavailableData("CJ"), ambiguousData()
  ];
  const views: TrackingViewModel[] = [
    ...septemberData.map((data) => deriveTrackingView(success(data), FIXTURE_NOW, CONFIG)),
    deriveTrackingView(success(pickedUpData()), PICKUP_NOW, CONFIG),
    deriveTrackingView(success(handedToCarrierData()), PICKUP_NOW, CONFIG),
    deriveTrackingView(success(inTransitData()), OCTOBER_NOW, CONFIG),
    ...CAUSES.map((cause) => deriveTrackingView(failure(cause), FIXTURE_NOW, CONFIG))
  ];
  for (const view of views) {
    const reply = buildCsReply(view, CONTEXT);
    const text = `${reply.short}\n${reply.long}`;
    expect(text, view.guideKey).not.toMatch(INTERNAL_LABELS);
    expect(text, view.guideKey).not.toMatch(FOLLOW_UP_PROMISE);
    expect(reply.long.endsWith(`실시간 확인: ${reply.customerLink}`), view.guideKey).toBe(true);
  }
  expect(buildCsReply(views[5], CONTEXT).short).toContain("14일 넘게 새 처리 기록이 없어");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/cs-reply.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — import errors for `@/lib/cs/cs-reply` and `@/lib/cs/cs-templates`.

- [ ] **Step 3: Write the templates and the reply builder**

Create `lib/cs/cs-templates.ts`:

```ts
import type { GuideKey } from "@/lib/tracking/types";

// Internal-only (contract §11.1 rule 4). 합니다체; no internal labels; no promise to contact the customer later.
// Tokens: {carrier} {staleDays} in CS_TEMPLATES; {date} {holiday} {event} {title} {body} {link} in CS_PHRASES.

export const CS_TEMPLATES: Readonly<Record<GuideKey, { readonly short: string; readonly long: string }>> = {
  idle: {
    short: "조회번호를 알려 주시면 통관과 배송 상태를 바로 확인할 수 있습니다.",
    long: "운송장 번호나 HBL 번호는 주문 안내 문자나 주문내역의 배송조회에서 볼 수 있습니다."
  },
  loading: {
    short: "지금 통관과 배송 정보를 조회하고 있습니다.",
    long: "조회가 끝나면 같은 화면에서 결과를 볼 수 있습니다."
  },
  invalidNumber: {
    short: "보내 주신 번호는 조회번호 형식과 다릅니다. 숫자 10~14자리 운송장 번호나 영문 3~4자로 시작하는 HBL 번호를 확인해 주세요.",
    long: "번호는 주문 안내 문자나 주문내역의 배송조회에서 볼 수 있습니다."
  },
  notFound: {
    short: "이 번호로는 아직 조회되는 정보가 없습니다. 번호가 주문내역과 같다면 한국 도착 전일 수 있습니다.",
    long: "보통 해외 출고 후 3~7일 뒤부터 조회됩니다. 출고 안내를 받은 지 7일이 지나도 조회되지 않으면 다시 말씀해 주세요."
  },
  temporaryDelay: {
    short: "지금 조회 서비스가 잠시 지연되고 있습니다. 번호 문제는 아닙니다.",
    long: "잠시 뒤 아래 링크에서 다시 조회해 주세요."
  },
  offline: {
    short: "인터넷 연결이 끊겨 조회하지 못했습니다.",
    long: "연결을 확인하신 뒤 아래 링크에서 다시 조회해 주세요."
  },
  noResponse: {
    short: "조회 응답이 늦어 결과를 받지 못했습니다.",
    long: "번호가 주문내역과 같은지 확인하신 뒤 아래 링크에서 다시 조회해 주세요."
  },
  serverError: {
    short: "일시적인 오류로 조회하지 못했습니다. 번호 문제는 아닙니다.",
    long: "잠시 뒤 아래 링크에서 다시 조회해 주세요."
  },
  pending: {
    short: "아직 국내 도착·통관 기록이 없습니다. 해외에서 출발한 직후이거나 번호가 다를 수 있습니다.",
    long: "번호가 주문내역의 운송장 번호와 같은지 먼저 확인해 주세요. 출고 안내 후 10일이 지나도 같은 상태면 다시 말씀해 주세요."
  },
  customsArrived: {
    short: "주문하신 상품은 한국에 도착해 통관을 준비하고 있습니다.",
    long: "입항 신고가 끝나면 세관 접수와 심사가 이어집니다."
  },
  customsWaiting: {
    short: "주문하신 상품은 지금 세관 통관 순서를 기다리고 있습니다.",
    long: "세관 접수가 끝났고 순서대로 심사가 진행됩니다."
  },
  customsCleared: {
    short: "주문하신 상품은 통관이 끝나 국내 택배사로 넘어갈 차례입니다.",
    long: "택배사로 넘어가면 운송장 문자가 발송됩니다."
  },
  handedToCarrier: {
    short: "주문하신 상품은 택배사({carrier})로 넘어가 배송을 준비하고 있습니다.",
    long: "배송이 시작되면 택배사 문자가 발송됩니다."
  },
  pickedUp: {
    short: "주문하신 상품은 {carrier} 기사님이 인수해 배송 출발을 준비하고 있습니다.",
    long: "배송이 시작되면 택배사 조회에서 위치를 볼 수 있습니다."
  },
  inTransit: {
    short: "주문하신 상품은 지금 국내 배송 중입니다.",
    long: "정확한 도착 시간은 택배사 문자나 아래 링크의 실시간 조회에서 볼 수 있습니다."
  },
  delivered: {
    short: "주문하신 상품은 배송이 완료되었습니다.",
    long: "받지 못하셨다면 문 앞·경비실·택배함을 먼저 확인해 주세요. 24시간이 지나도 찾지 못하시면 다시 말씀해 주세요."
  },
  stale: {
    short: "주문하신 상품은 {staleDays}일 넘게 새 처리 기록이 없어 확인이 필요합니다.",
    long: "개인통관고유부호와 수취인 이름이 주문 정보와 같은지 확인해 주세요."
  },
  lookupUnavailable: {
    short: "지금 택배사 조회가 잠시 늦어 최신 배송 정보를 불러오지 못했습니다. 번호 문제는 아닙니다.",
    long: "택배사 공식 조회나 아래 링크에서 잠시 뒤 다시 확인해 주세요."
  },
  ambiguous: {
    short: "같은 번호가 여러 택배사에 있어 택배사 확인이 필요합니다.",
    long: "주문 안내 문자에 적힌 택배사를 골라 아래 링크에서 다시 조회해 주세요."
  }
};

export const CS_PHRASES = {
  eta: "도착 예상일은 {date}입니다.",
  etaToday: "도착 예상일은 오늘, {date}입니다.",
  etaHoliday: "도착 예상일은 {date}이며 {holiday} 영향으로 1~2일 늦어질 수 있습니다.",
  deliveredOn: "배송 완료일은 {date}입니다.",
  overdueEta: "처음 안내한 도착 예상일은 {date}입니다.",
  pendingInfo: "도착 예상일은 통관 정보가 등록되면 볼 수 있습니다.",
  withheld: "지금은 도착 예상일을 안내하기 어렵습니다.",
  worry: "{date}까지 변동이 없으면 다시 말씀해 주세요.",
  overdue: "예상보다 늦어지고 있어 확인이 필요합니다.",
  lastEvent: "최근 처리: {event}",
  notice: "안내: {title} - {body}",
  link: "실시간 확인: {link}"
} as const;
```

Create `lib/cs/cs-reply.ts`:

```ts
import { durations, resultCopy } from "@/config/site.config";
import type { Notice } from "@/lib/config/types";
import { CS_PHRASES, CS_TEMPLATES } from "@/lib/cs/cs-templates";
import { SITE_ORIGIN } from "@/lib/site";
import { activeNotices } from "@/lib/tracking/notices";
import { fillSlots } from "@/lib/tracking/template";
import { formatKstDateTight } from "@/lib/tracking/time";
import type { EtaView, TrackingViewModel } from "@/lib/tracking/types";

// Internal-only (contract §11.1 rule 4): imported by the CS desk, never by public pages.

export interface CsReply {
  readonly short: string;
  readonly long: string;
  readonly customerLink: string;
}

function etaSentence(eta: EtaView): string | null {
  switch (eta.kind) {
    case "date":
      return fillSlots(CS_PHRASES.eta, { date: formatKstDateTight(eta.date.key) });
    case "today":
      return fillSlots(CS_PHRASES.etaToday, { date: formatKstDateTight(eta.date.key) });
    case "holidayAffected":
      return fillSlots(CS_PHRASES.etaHoliday, { date: formatKstDateTight(eta.date.key), holiday: eta.holidayName });
    case "overdue":
      return fillSlots(CS_PHRASES.overdueEta, { date: formatKstDateTight(eta.date.key) });
    case "deliveredOn":
      return fillSlots(CS_PHRASES.deliveredOn, { date: formatKstDateTight(eta.date.key) });
    case "pendingInfo":
      return CS_PHRASES.pendingInfo;
    case "withheld":
      return CS_PHRASES.withheld;
    case "unknown":
    case "none":
      return null;
  }
}

const isText = (value: string | null): value is string => value !== null && value.length > 0;

/** Short and long replies from the same view model the customer sees (spec §10 답변 생성). */
export function buildCsReply(
  view: TrackingViewModel,
  context: { readonly now: Date; readonly notices: readonly Notice[] }
): CsReply {
  const customerLink = view.guideKey === "invalidNumber" ? `${SITE_ORIGIN}/` : view.returnLink;
  const template = CS_TEMPLATES[view.guideKey];
  const values = { carrier: view.carrier.name ?? resultCopy.carrierUnknown, staleDays: String(durations.staleDays) };
  const status = fillSlots(template.short, values);
  const overdue = view.overdue ? CS_PHRASES.overdue : null;
  const eta = etaSentence(view.eta);
  const worryKey = view.nextAction.worry?.dateKey ?? null;
  const worry = worryKey === null ? null : fillSlots(CS_PHRASES.worry, { date: formatKstDateTight(worryKey) });
  const lastEvent = view.lastEvent === null ? null : fillSlots(CS_PHRASES.lastEvent, { event: view.lastEvent.text });
  const notices = activeNotices(context.notices, context.now, { kind: "cs" })
    .map((notice) => fillSlots(CS_PHRASES.notice, { title: notice.title, body: notice.body }));
  const link = fillSlots(CS_PHRASES.link, { link: customerLink });
  return {
    short: [status, overdue, eta, worry, link].filter(isText).join(" "),
    long: [status, fillSlots(template.long, values), overdue, lastEvent, eta, worry, ...notices, link].filter(isText).join("\n"),
    customerLink
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/cs-reply.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck; npm run lint`
Expected: `7 passed`; typecheck and lint exit 0.

- [ ] **Step 5: Commit**

```powershell
git add lib/cs/cs-templates.ts lib/cs/cs-reply.ts tests/unit/cs-reply.spec.ts; git commit -m "feat: build internal CS replies from the tracking view model"
```

---

### Task 14: Module boundaries

**Files:**
- Test: `tests/unit/module-boundaries.spec.ts`

**Interfaces:**
- Consumes: the file tree under `app/`, `components/`, `lib/`, `config/`.
- Produces: the enforcement of contract §11.1 rules 3, 4 and 5 for every present and future file: `lib/cs/*` only from internal files; `lib/config/server.ts` only from non-client files under `app/` or `components/shell/`; the client-safe pure modules and every file in `components/lookup/`, `components/primitives/` and client files in `components/shell/` never reach zod, `lib/schemas.ts`, config parsing, `lib/cs/*`, `lib/delivery-carriers.ts`, `lib/tracking/derive-view.ts`, `lib/tracking/derive/*` or `components/result/ResultView.tsx` through static imports (dynamic `import()` is allowed); `lib/tracking/*` (except `fetch-track.ts`) and `config/site.config.ts` use no `window`, `document`, `fetch()`, storage, `Date.now()` or `new Date()` without an argument.

- [ ] **Step 1: Write the test**

Create `tests/unit/module-boundaries.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib", "config"] as const;
const SOURCE_EXTENSIONS = [".ts", ".tsx"] as const;

interface ImportRef {
  readonly specifier: string;
  readonly typeOnly: boolean;
}

const toPosix = (value: string): string => value.split(path.sep).join("/");

function listSourceFiles(relativeDir: string): string[] {
  const absolute = path.join(ROOT, relativeDir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute).flatMap((name) => {
    const relative = toPosix(path.join(relativeDir, name));
    if (statSync(path.join(ROOT, relative)).isDirectory()) return listSourceFiles(relative);
    return SOURCE_EXTENSIONS.some((extension) => name.endsWith(extension)) && !name.endsWith(".d.ts") ? [relative] : [];
  });
}

const ALL_FILES: readonly string[] = SCAN_DIRS.flatMap((dir) => listSourceFiles(dir));

function read(file: string): string {
  return readFileSync(path.join(ROOT, file), "utf8");
}

/** Removes block and line comments; keeps '//' inside URLs such as https://. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

/** Static import/export-from statements; `import type`/`export type` are marked type-only (erased at build). */
const STATIC_IMPORT = /(?:^|[\n;])\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\s+from\s+)?["']([^"']+)["']/g;

function importsOf(file: string): readonly ImportRef[] {
  const source = stripComments(read(file));
  return Array.from(source.matchAll(STATIC_IMPORT), (match) => ({ specifier: match[2], typeOnly: match[1] !== undefined }));
}

function localBase(specifier: string, fromFile: string): string | null {
  if (specifier.startsWith("@/")) return specifier.slice(2);
  if (specifier.startsWith(".")) return toPosix(path.join(path.dirname(fromFile), specifier));
  return null;
}

function resolveImport(specifier: string, fromFile: string): string {
  const base = localBase(specifier, fromFile);
  if (base === null) return `pkg:${specifier}`;
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  const found = candidates.find((candidate) => {
    const absolute = path.join(ROOT, candidate);
    return existsSync(absolute) && statSync(absolute).isFile();
  });
  return found ?? `missing:${base}`;
}

function runtimeImports(file: string): readonly string[] {
  return importsOf(file).filter((ref) => !ref.typeOnly).map((ref) => resolveImport(ref.specifier, file));
}

function runtimeClosure(entry: string): ReadonlySet<string> {
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

const USE_CLIENT = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*["']use client["']/;
const isClientFile = (file: string): boolean => USE_CLIENT.test(read(file));

const INTERNAL_CS_IMPORTERS: readonly RegExp[] = [
  /^components\/InternalCsHelper\.tsx$/, /^components\/internal\//, /^app\/\(internal\)\//, /^lib\/cs\//
];
const CLIENT_SAFE_ENTRIES: readonly string[] = [
  "config/site.config.ts", "lib/tracking/types.ts", "lib/tracking/time.ts", "lib/tracking/number-format.ts",
  "lib/tracking/template.ts", "lib/tracking/glossary.ts", "lib/tracking/notices.ts", "lib/tracking/classify-failure.ts",
  "lib/tracking/loading-view.ts", "lib/tracking/inquiry-copy.ts", "lib/tracking/carriers.ts"
];
const FORBIDDEN_IN_CLIENT: readonly RegExp[] = [
  /^pkg:zod$/, /^lib\/schemas\.ts$/, /^lib\/config\/(schema|invariants|server)\.ts$/, /^lib\/cs\//, /^lib\/delivery-carriers\.ts$/,
  /^lib\/tracking\/derive-view\.ts$/, /^lib\/tracking\/derive\//, /^components\/result\/ResultView\.tsx$/
];
const IMPURE: ReadonlyArray<readonly [string, RegExp]> = [
  ["window", /\bwindow\b/], ["document", /\bdocument\b/], ["fetch()", /\bfetch\s*\(/], ["localStorage", /\blocalStorage\b/],
  ["sessionStorage", /\bsessionStorage\b/], ["Date.now()", /\bDate\.now\s*\(/], ["new Date() without an argument", /\bnew Date\s*\(\s*\)/]
];

function forbiddenReach(entry: string): readonly string[] {
  return [...runtimeClosure(entry)]
    .filter((target) => FORBIDDEN_IN_CLIENT.some((pattern) => pattern.test(target)))
    .map((target) => `${entry} → ${target}`);
}

test("the scanner resolves aliases, relative paths and type-only imports", () => {
  expect(runtimeImports("lib/config/server.ts")).toEqual(
    expect.arrayContaining(["config/site.config.ts", "lib/config/schema.ts", "lib/tracking/time.ts"])
  );
  expect(importsOf("config/site.config.ts").every((ref) => ref.typeOnly)).toBe(true);
  expect([...runtimeClosure("lib/config/schema.ts")]).toContain("pkg:zod");
});

test("lib/cs is imported only by internal files (tests excepted)", () => {
  const offenders = ALL_FILES.filter((file) =>
    runtimeImports(file).some((target) => target.startsWith("lib/cs/")) && !INTERNAL_CS_IMPORTERS.some((pattern) => pattern.test(file))
  );
  expect(offenders).toEqual([]);
});

test("lib/config/server is imported only by server files under app/ or components/shell/", () => {
  const offenders = ALL_FILES.filter((file) =>
    runtimeImports(file).includes("lib/config/server.ts") && (!/^(app|components\/shell)\//.test(file) || isClientFile(file))
  );
  expect(offenders).toEqual([]);
});

test("client-reachable pure modules pull in no zod, config parsing, CS or derive code", () => {
  expect(CLIENT_SAFE_ENTRIES.filter((entry) => !existsSync(path.join(ROOT, entry)))).toEqual([]);
  expect(CLIENT_SAFE_ENTRIES.flatMap(forbiddenReach)).toEqual([]);
});

test("lookup, primitive and client shell components reach none of them statically either", () => {
  const entries = ALL_FILES.filter((file) =>
    /^components\/(lookup|primitives)\//.test(file) || (/^components\/shell\//.test(file) && isClientFile(file))
  );
  expect(entries.flatMap(forbiddenReach)).toEqual([]);
});

test("lib/tracking stays pure: time only from `now`, no browser APIs (fetch-track.ts excepted)", () => {
  const files = ALL_FILES.filter((file) =>
    (file.startsWith("lib/tracking/") && file !== "lib/tracking/fetch-track.ts") || file === "config/site.config.ts"
  );
  const findings = files.flatMap((file) => {
    const source = stripComments(read(file));
    return IMPURE.filter(([, pattern]) => pattern.test(source)).map(([name]) => `${file}: ${name}`);
  });
  expect(files.length).toBeGreaterThan(10);
  expect(findings).toEqual([]);
});
```

- [ ] **Step 2: Plant three violations and watch the test catch them**

Create `lib/tracking/boundary-probe.ts`:

```ts
export const probeNow = (): number => Date.now();
```

Create `components/BoundaryProbe.tsx`:

```tsx
import { CS_TEMPLATES } from "@/lib/cs/cs-templates";

export const probeCount = Object.keys(CS_TEMPLATES).length;
```

Create `components/lookup/BoundaryProbe.tsx` (the folder does not exist before S04; create it for the probe):

```tsx
"use client";
import { z } from "zod";

export const probeSchema = z.string();
```

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/module-boundaries.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `3 failed, 3 passed` — the failures name `components/BoundaryProbe.tsx` (lib/cs), `components/lookup/BoundaryProbe.tsx → pkg:zod`, and `lib/tracking/boundary-probe.ts: Date.now()`.

- [ ] **Step 3: Remove the probes and run again**

Run: `Remove-Item lib/tracking/boundary-probe.ts, components/BoundaryProbe.tsx, components/lookup/BoundaryProbe.tsx; if ((Get-ChildItem components/lookup -Force | Measure-Object).Count -eq 0) { Remove-Item components/lookup }; git status --short components lib/tracking`
Expected: no output from `git status` (the probes are gone and were never tracked).
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/module-boundaries.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run lint`
Expected: `6 passed`; lint exits 0.

- [ ] **Step 4: Commit**

```powershell
git add tests/unit/module-boundaries.spec.ts; git commit -m "test: enforce client, internal and purity module boundaries"
```

### Task 15 (gated by approval 4): Approved pending recheck range and pending link ids

**Files:**
- Modify: `config/site.config.ts` (`durations.pendingRecheck`; `channels.naver.urls.pending` and `channels.coupang.urls.pending` only when the ledger gives new links; `channels.allowedHosts` only for a new host)
- Modify: `tests/unit/config.spec.ts` (replace the test "the pending recheck sentence is the current one until approval 4"; add one test when new links are given)
- Modify (only when this task runs after S04 is merged and before S07 deletes the file): `tests/tracking.spec.ts` (the pending recheck assertion reads `durations.pendingRecheck`), after a roadmap §10.4 amendment commit in `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md`

**Interfaces:**
- Consumes: the ledger row of approval 4 (roadmap §4) — the approved range (`N~M시간` or `N~M일`) and, optionally, two partner-dashboard link URLs for the `pending` placement.
- Produces: new values only; no name or type changes. `deriveTrackingView` puts `durations.pendingRecheck` into `nextAction.note` and `channels.*.urls.pending` into the pending `StoreLinksView` without code changes.

- [ ] **Step 1: Confirm approval 4 is recorded in the roadmap approval ledger; if not, stop.** Open roadmap §4 row 4. Status `approved` with the approved range written in the row or its note → continue. Otherwise mark this task SKIPPED ("approval 4 pending") and keep the fallback (spec §16 item 4 "거절하면"): the current sentence '정보 반영까지 시간이 걸릴 수 있어 2~3시간 뒤 다시 확인해 주세요.' and the current store-home URLs stay as Task 5 shipped them, and the '주문내역에서 확인' help (`help` id `order-check`, shown on pending and NOT_FOUND) already ships. Nothing else changes.
- [ ] **Step 2: Scope check.** If the approval chose the option "비제휴 '네이버에서 주문 확인 · 쿠팡에서 주문 확인' 링크로 바꾸고 제휴 스토어는 하단으로" (spec §16 item 4 선택안), stop after this step: that option needs per-placement affiliate flags and labels (`StoreChannel` is per channel today) and changes S07's pending CTA order, so it is a contract amendment (roadmap §5) for the operator to schedule; record it in the stage summary. Otherwise continue.
- [ ] **Step 3: Write the failing test.** In `tests/unit/config.spec.ts` replace the test `"the pending recheck sentence is the current one until approval 4"` with:

```ts
  test("approval 4: the pending recheck sentence uses the approved range", () => {
    expect(durations.pendingRecheck).toMatch(/^정보 반영까지 시간이 걸릴 수 있어 \d+~\d+(시간|일) 뒤 다시 확인해 주세요\.$/);
    expect(durations.pendingRecheck).not.toBe(PENDING_RECHECK_FALLBACK);
  });
```

  Only if the ledger gives new `pending` link URLs, add below it:

```ts
  test("approval 4: pending purchase choices use their own partner link ids", () => {
    expect(channels.naver.urls.pending).not.toBe(channels.naver.urls.showcase);
    expect(channels.coupang.urls.pending).not.toBe(channels.coupang.urls.showcase);
    expect(issuesOf(siteConfig)).toBe("");
  });
```

- [ ] **Step 4: Run to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/config.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: the approval-4 test(s) fail (`Received: "정보 반영까지 시간이 걸릴 수 있어 2~3시간 뒤 다시 확인해 주세요."`, or equal URLs); all others pass.

- [ ] **Step 5: Apply the approved values.** In `config/site.config.ts`, inside `durations`, replace the `pendingRecheck` comment and value with (the range is the one in the ledger, typed exactly as approved — e.g. `6~12시간`):

```ts
  // 국내 도착 전 재확인 문장(승인 4에서 운영자가 확정한 범위)
  pendingRecheck: "정보 반영까지 시간이 걸릴 수 있어 6~12시간 뒤 다시 확인해 주세요."
```

  If the ledger gives new pending links, set `channels.naver.urls.pending` and `channels.coupang.urls.pending` to them (https only) and add any new host to `channels.allowedHosts`.
  Then find tests outside `tests/unit/config.spec.ts` that pin the old sentence, and the components that still hard-code it:
  `Get-ChildItem tests -Recurse -Include *.ts | Select-String -Pattern '2~3시간'; Get-ChildItem components -Recurse -Include *.ts,*.tsx | Select-String -Pattern '2~3시간'`
  Expected before S04 is merged: `tests/tracking.spec.ts` (test "pending state offers inquiry and purchase-channel choices") and `components/TrackingResultSummary.tsx` — the legacy component still hard-codes the sentence, so the test stays as it is. S04 Task 6 Step 5 (its approval-4 case) switches that literal to `durations.pendingRecheck` when S04 later re-points the file, so S03 never edits `tests/tracking.spec.ts` on this path.
  Expected after S04 is merged (S04 deletes `components/TrackingResultSummary.tsx`; its status slot reads `durations.pendingRecheck`): only the `tests/tracking.spec.ts` line, and it now fails. `tests/tracking.spec.ts` is owned by S01/S04/S06/S07, so first amend roadmap §10.4 in its own commit (roadmap §5), adding "M S03 (approval 4 follow-up)" to the `tests/tracking.spec.ts` row (skip this commit if the row already reads "M S03 only for approval 4/9 follow-ups", as the phase-4 roadmap does):
  `git add docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md; git commit -m "docs: amend renewal contract — S03 Task 15 edits tests/tracking.spec.ts"`
  Then in `tests/tracking.spec.ts` replace `summary.getByText("정보 반영까지 시간이 걸릴 수 있어 2~3시간 뒤 다시 확인해 주세요.")` with `summary.getByText(durations.pendingRecheck)` and add `import { durations } from "@/config/site.config";` below the file's last `import` line (skip the import if S04 already added it). Write the rule → assertion mapping into the stage summary: "pending recheck sentence → `durations.pendingRecheck`". After S07 (which deletes `tests/tracking.spec.ts`) there is no hit and nothing to change.

- [ ] **Step 6: Run to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck; npm run build`
Expected: 0 failed (the day-count invariants still hold — the pending worry line keeps '10일'); typecheck and build exit 0.
If Step 5 edited `tests/tracking.spec.ts`, also run it (port 43210 free; Playwright starts the dev server): `npx playwright test tests/tracking.spec.ts --grep "pending state offers inquiry"`
Expected: `1 passed`.

- [ ] **Step 7: Commit**

```powershell
git add config/site.config.ts tests/unit/config.spec.ts; git commit -m "feat: apply the approved pending recheck range (approval 4)"
```

  If Step 5 edited `tests/tracking.spec.ts`, commit it separately: `git add tests/tracking.spec.ts; git commit -m "test: read the pending recheck sentence from the config (approval 4)"`

---

### Task 16 (gated by approval 9): Definitive affiliate disclosure

**Files:**
- Modify: `config/site.config.ts` (`disclosures.coupang` and its comment)
- Modify: `tests/unit/config.spec.ts` (replace the test "the disclosure is the current wording until approval 9, then the approved wording")
- Modify (only when this task runs after S04 is merged and before S07 deletes the file): `tests/tracking.spec.ts` (the two CTA disclosure assertions read `disclosures.coupang`), after a roadmap §10.4 amendment commit in `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md`

**Interfaces:**
- Consumes: the ledger row of approval 9 with the legal-reviewed wording (default proposal: '쿠팡 링크는 쿠팡 파트너스 활동의 일환으로, 구매 시 운영자가 수수료를 받습니다.').
- Produces: the new `disclosures.coupang` value; every `StoreLinksView.disclosure` from `deriveTrackingView` and every consumer that reads `disclosures.coupang` switch together. The disclosure stays the first element of every affiliate block (contract §11.9 `AffiliateLinkGroup`), so no position change is needed here.

- [ ] **Step 1: Confirm approval 9 is recorded in the roadmap approval ledger; if not, stop.** Roadmap §4 row 9 `approved` with the final wording (after legal review) → continue. Otherwise mark SKIPPED ("approval 9 pending"); fallback (spec §16 item 9 "거절하면"): keep '쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.' and only move it before the links — `StoreLinksView.disclosure` is already rendered first by S05's `AffiliateLinkGroup`, so nothing changes in S03.
- [ ] **Step 2: Pin the approved wording.** If the ledger wording differs from the proposal, first set `DISCLOSURE_APPROVED` in `tests/unit/config.spec.ts` to the ledger text exactly. Then replace the test `"the disclosure is the current wording until approval 9, then the approved wording"` with:

```ts
  test("approval 9: the definitive disclosure wording", () => {
    expect(disclosures.coupang).toBe(DISCLOSURE_APPROVED);
    expect(disclosures.coupang).not.toBe(DISCLOSURE_FALLBACK);
  });
```

- [ ] **Step 3: Run to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/config.spec.ts --grep "approval 9"; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `1 failed` (`Received: "쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다."`).

- [ ] **Step 4: Apply the wording.** In `config/site.config.ts`, replace the `disclosures` block with (use the ledger text if legal changed it):

```ts
/** 2) 제휴 고지 — 제휴 링크 묶음의 첫 줄에 자동으로 붙습니다. 승인 9(법무 확인)로 확정한 문언입니다. */
export const disclosures = {
  coupang: "쿠팡 링크는 쿠팡 파트너스 활동의 일환으로, 구매 시 운영자가 수수료를 받습니다."
} satisfies DisclosuresConfig;
```

  Then list the places that still show the old wording: `Get-ChildItem components, app, tests -Recurse -Include *.ts,*.tsx | Select-String -Pattern '일정 수수료를 받을 수 있으며'`
  Expected: only legacy files that hard-code it — `components/CustomerCta.tsx` (its legacy variants), `components/StorefrontShowcase.tsx` ('일부 링크로 구매하면…'), `components/RecommendedProducts.tsx` and `tests/tracking.spec.ts` — which S04/S06/S07/S08 replace with components that read `disclosures.coupang`. (The privacy page's own affiliate sentence '…일정 수수료를 받을 수 있습니다' does not match the pattern; it is legal text owned by S02/S08.) Write this list into the stage summary; do not edit those components here.
  The docs copies are S05's: `design-system/components/customer-cta.html` quotes the old sentence today, and once S05 is merged `DESIGN.md` and `design-system/components/tracking-form.html` do too. S05's own approval-9 task (its Task 15 "Approved disclosure wording in the docs") replaces them after this task; do not edit them here.
  Spec §16 item 9 also replaces the E2E disclosure literal once. That matters only when this task runs after S04 is merged and before S07 deletes `tests/tracking.spec.ts`: S04's view-driven `CustomerCta` then renders `disclosures.coupang`, so the two CTA assertions `cta.getByText("쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.")` (tests "pending state offers inquiry and purchase-channel choices" and "delivered state leads with store choices") no longer match. In that case first amend roadmap §10.4 in its own commit, adding "M S03 (approval 9 follow-up)" to the `tests/tracking.spec.ts` row (skip this commit if the row already reads "M S03 only for approval 4/9 follow-ups", as the phase-4 roadmap does):
  `git add docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md; git commit -m "docs: amend renewal contract — S03 Task 16 edits tests/tracking.spec.ts"`
  then replace both CTA literals with `cta.getByText(disclosures.coupang)` and add `import { disclosures } from "@/config/site.config";` below the last `import` line (or add `disclosures` to an existing import from `@/config/site.config`). Leave the `storefront.getByText("일부 링크로 구매하면…")` assertion: `StorefrontShowcase` still hard-codes that sentence until S08. Write the rule → assertion mapping into the stage summary: "affiliate disclosure in the CTA → `disclosures.coupang`".
  When this task runs before S04 is merged, do not edit `tests/tracking.spec.ts`: the legacy CTA still hard-codes the old sentence, and S04 Task 6 Step 5 (its approval-9 case) replaces the two CTA literals with `disclosures.coupang` when S04 re-points the file. S03 edits that file only on the after-S04 path above.

- [ ] **Step 5: Run to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck`
Expected: 0 failed (derive-view rows compare against `CONFIG.disclosures.coupang`, so they follow the new value); typecheck exits 0. Exception once S05 is merged (`Test-Path tests/unit/tokens.spec.ts` prints `True`): exactly 2 failures in `tests/unit/tokens.spec.ts` — "documents every primitive and the configured disclosure wording" and "store previews put the configured disclosure first" — because S05's docs still quote the old sentence. That is the hand-off to S05's approval-9 task (S05 Task 15, which checks that `config/site.config.ts` already carries the approved wording and then updates the docs); write "S05 Task 15 must run next" into the stage summary and give it to the operator. Any other failure is a real one.
If `tests/tracking.spec.ts` still exists, run it (port 43210 free; Playwright starts the dev server): `npx playwright test tests/tracking.spec.ts`
Expected: 0 failed. A failure that quotes the old CTA disclosure sentence means Step 4's E2E replacement was needed and not done.

- [ ] **Step 6: Commit**

```powershell
git add config/site.config.ts tests/unit/config.spec.ts; git commit -m "feat: switch to the definitive affiliate disclosure (approval 9)"
```

  If Step 4 edited `tests/tracking.spec.ts`, commit it separately: `git add tests/tracking.spec.ts; git commit -m "test: read the affiliate disclosure from the config (approval 9)"`

---

### Task 17 (gated by approval 8): Holiday date shift for displayed estimates

**Files:**
- Modify: `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §11.7 and §11.8 (contract amendment, separate commit)
- Modify: `lib/config/types.ts` (`CalendarConfig`), `lib/config/schema.ts` (`CalendarSchema`), `config/site.config.ts` (`calendar`), `lib/tracking/time.ts` (new function), `lib/tracking/derive/eta.ts` (shift), `tests/fixtures/config-fixtures.ts` (`FIXTURE_CONFIG.calendar`), `DEPLOYMENT.md` (one line)
- Test: `tests/unit/kst-time.spec.ts`, `tests/unit/derive-view.spec.ts`, `tests/unit/config.spec.ts`

**Interfaces:**
- Consumes: approval 8 in the ledger.
- Produces (contract amendment): `CalendarConfig.shiftEstimates: boolean` ("표시 날짜를 다음 영업일로 미루는 shift", spec §16 item 8) and `firstBusinessDayOnOrAfter(key: KstDateKey, calendar: CalendarConfig, kind: BusinessDayKind): KstDateKey` in `lib/tracking/time.ts`. With `shiftEstimates: true` the displayed delivery estimate moves to the first delivery business day on or after it and the customs-estimate caption to the first customs business day; badges, D-n suppression and worry dates are unchanged; CS replies follow automatically because they read the view.

- [ ] **Step 1: Confirm approval 8 is recorded in the roadmap approval ledger; if not, stop.** Roadmap §4 row 8 `approved` → continue. Otherwise mark SKIPPED ("approval 8 pending"); fallback (spec §16 item 8 "거절하면"): badge only — the behavior Task 10 already ships (badge '추석 연휴 영향 · 1~2일 늦어질 수 있어요', D-n and '오늘 예상' hidden, business-day worry dates, normalizer dates unchanged).
- [ ] **Step 2: Amend the contract in its own commit.** In the roadmap §11.7 `CalendarConfig` block add the line `readonly shiftEstimates: boolean;     // approval 8: displayed estimates move to the next business day` after `carrierDeliversSaturday`, and in §11.8 under `lib/tracking/time.ts` add `export function firstBusinessDayOnOrAfter(key: KstDateKey, calendar: CalendarConfig, kind: BusinessDayKind): KstDateKey;`. Then:

```powershell
git add docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md; git commit -m "docs: amend renewal contract — calendar.shiftEstimates (approval 8)"
```

- [ ] **Step 3: Write the failing tests.** In `tests/unit/kst-time.spec.ts` add `firstBusinessDayOnOrAfter` to the import from `@/lib/tracking/time`, add `shiftEstimates: false,` to the `CALENDAR` object (after `carrierDeliversSaturday: false,`), and append inside `test.describe("business days", …)`:

```ts
  test("first business day on or after a date (approval 8)", () => {
    expect(firstBusinessDayOnOrAfter("2026-09-26", CALENDAR, "delivery")).toBe("2026-09-28");
    expect(firstBusinessDayOnOrAfter("2026-09-28", CALENDAR, "delivery")).toBe("2026-09-28");
    expect(firstBusinessDayOnOrAfter("2026-10-03", CALENDAR, "customs")).toBe("2026-10-06");
  });
```

  In `tests/unit/derive-view.spec.ts` append inside `test.describe("result view models", …)`:

```ts
  test("approval 8: with shiftEstimates, displayed estimates move to the next business day", () => {
    const shifted = withConfig({ calendar: { shiftEstimates: true } });
    const cleared = deriveTrackingView(success(customsClearedData()), FIXTURE_NOW, shifted);
    expect(cleared.eta).toMatchObject({
      kind: "holidayAffected", date: { key: "2026-09-28", label: "9월 28일 (월)" }, caption: "통관 완료 9월 23일 (수)"
    });
    const waiting = deriveTrackingView(success(customsWaitingData()), FIXTURE_NOW, shifted);
    expect(waiting.eta).toMatchObject({ date: { key: "2026-09-29" }, caption: "통관 완료 예상 9월 28일 (월)" });
    expect(waiting.nextAction.worry?.dateKey).toBe("2026-09-28");
    expect(deriveTrackingView(success(customsClearedData()), FIXTURE_NOW, CONFIG).eta).toMatchObject({ date: { key: "2026-09-26" } });
  });
```

  In `tests/unit/config.spec.ts` append inside `test.describe("shipped config", …)`:

```ts
  test("approval 8: displayed estimates are shifted past holidays", () => {
    expect(calendar.shiftEstimates).toBe(true);
    expect(FIXTURE_CONFIG.calendar.shiftEstimates).toBe(false);
  });
```

- [ ] **Step 4: Run to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/kst-time.spec.ts tests/unit/derive-view.spec.ts tests/unit/config.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `firstBusinessDayOnOrAfter` is not exported (kst-time file does not load), the approval-8 derive row gets `2026-09-26`, and `calendar.shiftEstimates` is `undefined`.

- [ ] **Step 5: Implement the shift**

In `lib/config/types.ts`, inside `CalendarConfig`, add after `carrierDeliversSaturday`:

```ts
  readonly shiftEstimates: boolean;          // approval 8: displayed estimates move to the next business day
```

In `lib/config/schema.ts`, replace `CalendarSchema` with:

```ts
const CalendarSchema = z.object({
  timeZone: z.literal("Asia/Seoul"),
  holidays: z.array(HolidayPeriodSchema),
  carrierDeliversSaturday: z.boolean(),
  shiftEstimates: z.boolean()
}).strict();
```

In `config/site.config.ts`, inside `calendar`, add after `carrierDeliversSaturday: false, …`:

```ts
  shiftEstimates: true, // 승인 8: 공휴일·주말에 걸린 예상일을 다음 영업일로 옮겨 보여 줍니다(걱정 기준일 계산은 그대로)
```

In `tests/fixtures/config-fixtures.ts`, replace the `calendar` line of `FIXTURE_CONFIG` with:

```ts
  calendar: { ...siteConfig.calendar, holidays: FIXTURE_HOLIDAYS, carrierDeliversSaturday: false, shiftEstimates: false },
```

In `lib/tracking/time.ts`, append:

```ts
/** `key` itself when it is a business day, otherwise the next business day (approval 8 display shift). */
export function firstBusinessDayOnOrAfter(key: KstDateKey, calendar: CalendarConfig, kind: BusinessDayKind): KstDateKey {
  return isBusinessDay(key, calendar, kind) ? key : businessDaysAfter(key, 1, calendar, kind);
}
```

In `lib/tracking/derive/eta.ts`: change the time import to

```ts
import { calendarDaysBetween, firstBusinessDayOnOrAfter, formatKstDate, holidayPeriodBetween, kstDateKey, weekdayLabel } from "@/lib/tracking/time";
import type { BusinessDayKind, KstDateKey } from "@/lib/tracking/time";
```

add below `etaDate`:

```ts
/** Approval 8: with calendar.shiftEstimates a displayed estimate moves to the first business day on or after it. */
function shownEstimate(key: KstDateKey, config: SiteConfig, kind: BusinessDayKind): KstDateKey {
  return config.calendar.shiftEstimates ? firstBusinessDayOnOrAfter(key, config.calendar, kind) : key;
}
```

in `captionFor`, replace `formatKstDate(estimate)` with `formatKstDate(shownEstimate(estimate, config, "customs"))`; and in `estimateEta`, replace the first two lines after `const copy = config.resultCopy;` with:

```ts
  const rawEstimateKey = isoToKey(data.estimatedDeliveryDate);
  if (rawEstimateKey === null) return { kind: "unknown", label: copy.etaLabel, text: copy.etaUnknownText };
  const estimateKey = shownEstimate(rawEstimateKey, config, "delivery");
```

(the rest of `estimateEta` stays; it already uses `estimateKey`).

In `DEPLOYMENT.md`, section '공휴일 넣기(매년 6월 말)', append the sentence: `calendar.shiftEstimates가 true이면(승인 8) 공휴일·주말에 걸린 예상일을 다음 영업일로 옮겨 보여 줍니다. 걱정 기준일 계산은 바뀌지 않습니다.`

- [ ] **Step 6: Run to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck; npm run lint; npm run build`
Expected: 0 failed (all earlier rows use `FIXTURE_CONFIG` with `shiftEstimates: false`, so their dates are unchanged; the GAP3-06 table still reports 0 contradictions); typecheck, lint and build exit 0.
When this task runs as a follow-up after S04 or a later stage is merged, the shipped config now moves displayed estimates on those stages' pages, so also run the browser suite (port 43210 free; Playwright starts the dev server): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npm run test:e2e`
Expected: 0 failed. A failure that pins a displayed estimate date the shift now moves belongs to the stage that owns that spec file: do not edit it here; stop, record the file, test name and old/new date in the stage summary as a rule → assertion item for that stage (roadmap §5, §8), commit this task (Step 7) on the stage branch, and do not hand it over for merge until that stage's fix is in.
When this task runs before S04 is merged, the legacy page does not read the derived estimate, so `tests/tracking.spec.ts` still passes and is not edited here: S04 Task 6 Step 5 (its approval-8 case) replaces the '7월 17일' estimate literal with the shifted date when S04 re-points the file.

- [ ] **Step 7: Commit**

```powershell
git add lib/config/types.ts lib/config/schema.ts config/site.config.ts lib/tracking/time.ts lib/tracking/derive/eta.ts tests/fixtures/config-fixtures.ts DEPLOYMENT.md tests/unit/kst-time.spec.ts tests/unit/derive-view.spec.ts tests/unit/config.spec.ts; git commit -m "feat: shift displayed estimates past holidays (approval 8)"
```

---

### Task Final: Stage gate

- [ ] **G1. Port free.** `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue` → no output (stop listeners otherwise).
- [ ] **G2. Lint.** `npm run lint` → exit 0, no errors, no warnings introduced by this stage.
- [ ] **G3. Typecheck.** `npm run typecheck` → exit 0.
- [ ] **G4. Build.** `npm run build` → exit 0. Route table: `ƒ /[trackingNumber]` always; `/` is `ƒ` in S01 (it still reads `searchParams`), `○ /` from S02 on, and `○ /` with `Revalidate 5m` from S06 on.
- [ ] **G5. Dev-mode E2E.** `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npm run test:e2e` → "N passed", 0 failed (skips allowed only for tests guarded by `PW_MODE`, `PW_SHOTS`, `PW_VISUAL`, or an approval-gated `test.skip` naming the approval).
- [ ] **G6. Production-mode E2E.** Re-run `npm run build` if `next start` reports a missing or stale build. Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait for `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` = `200`; then `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test` → 0 failed, including `tests/budgets/*`.
- [ ] **G7. After-screens.** Server still running: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='after'; $env:PW_STAGE='S03'; npx playwright test tests/tools/stage-screens.spec.ts` → PNGs in `test-artifacts/stage-screens/S03-after/` at 320, 375, 768, 1024, 1440. Compare with `S03-before/`; send both sets to the operator with SendUserFile. Stop the server (G1 command) and clear the flags: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.
- [ ] **G8. Budgets.** Paste the measured numbers of every budget this plan lists (from the G6 output) into the stage summary. Any budget over its fail line fails the gate.
- [ ] **G9. Code review.** Invoke the `code-review` skill on `git diff claude/tipoasis-tracking-renewal-ae0e3a...HEAD`. Fix every CRITICAL and HIGH finding; if code changed, re-run G2–G6.
- [ ] **G10. Verification.** Invoke `superpowers:verification-before-completion`; paste each command and its result line into the stage summary.
- [ ] **G11. Commit.** `git status` shows only this stage's files (see the roadmap File Map). Commit any remainder with a conventional message and no attribution trailer.
- [ ] **G12. No deploy.** Do not push to `main`; do not run `vercel deploy`. Push `renewal/s03-r2-state-core` only if the operator asked. Hand the stage summary to the operator; merge into the integration branch only after acceptance (roadmap §5).

S03 checks for G8 (roadmap §9 "Table tests; config invariants; module boundaries"): paste the pass counts of `tests/unit/{classify-failure,kst-time,number-format,template,glossary,carriers,notices,config,inquiry-copy,derive-view,loading-view,cs-reply,module-boundaries}.spec.ts` (22 / 14 / 4 / 5 / 5 / 5 / 7 / 43 / 7 / 62 / 10 / 7 / 6 without the gated tasks), state "GAP3-06: 12 variants + 5 error codes, 0 contradictions", and state that `next build` stopped on the broken config in Task 7 Step 7. Also list in the stage summary: the approval statuses (4, 8, 9) and which gated tasks ran or were SKIPPED; the contract additions (section "Additions to the contract"); and the open issues below. S03 changes no page, so the before/after screens must be identical; any visual difference is a gate failure to investigate.

---

## Open Issues for the Operator and Later Stages

1. **Approval 2 fallback (S04).** While approval 2 is pending, the roadmap asks S04 to keep the strings the current E2E asserts. Several of them are the legacy components' own sentences, not spec §7 copy: customs-waiting h2 '통관대기', '정상 통관 대기 상태입니다. 지금은 별도 문의 없이 조금만 기다려 주세요.', '배송 중입니다. 문자로 안내된 배송 예정 시간을 확인해 주세요.', '배송이 완료됐습니다. 상품 상태를 확인해 주세요.', stale '배송 이력 확인 필요' / '마지막 처리 이후 오래 지났습니다', error CTA '조회가 잘되지 않나요?' (kept), ETA label '배송 완료 예상일'. S03 ships the spec §7 copy. S04 renders the legacy strings through a wording overlay in its transitional slot (`LEGACY_RESULT_COPY` in `components/status-slot/status-view.ts`, S04 contract deviation 2), so `config/site.config.ts` is not edited for approval 2 and the internal CS reply keeps the spec copy. The overlay disappears with `components/status-slot/` in S07.
2. **Approval 3 fallback (S04/S07).** While approval 3 is pending, S04 (`applyApprovalFallbacks`) and S07 (`applyResultApprovals`) promote 톡톡 to the filled primary in the view layer (contract addition 10). `config/site.config.ts` keeps the §7 error rows; no "M S04" or "M S07" is needed on it for this fallback.
3. **Featured products point at store homes.** `featuredProducts[].href` are the store-home links until the operator supplies product-detail URLs; their validity ends at `2027-03-31T23:59:59+09:00`, after which the recommendation block disappears. S08 E2E that needs recommendations should use the page clock or its own fixture items. S08 Task 10 (approval 10) replaces the hrefs with product-detail links and may add prices; the Task 5 test "featured products carry no unverified prices" accepts a price only with `priceCheckedAt` on a link that is not a configured store home, so that follow-up does not edit S03's tests.
4. **S01 fixture assumptions.** The GAP3-06 rows assume the 12 `GAP3_06_VARIANTS` map to the keys in `GAP3_06_KEYS` (Task 11). If S01's `trackData` builds a variant differently (e.g. `customsCleared` already overdue at `FIXTURE_NOW`), the key test still holds and the contradiction rules are written to hold for overdue views; a genuine mismatch is a contract question for S01, not a reason to weaken the rules.
5. **Holiday data upkeep.** 2028 holidays must be added after the 2028 월력요항 (late June 2027); from 2027-11-03 (when the 60-day window first reaches 2028) the build prints the `[site.config]` warning until they are added.
6. **응답 없음: spec §7 and §16 item 3 disagree (S04 and S07 report it too).** §7's 'error · 응답 없음' row makes [다시 조회] the primary and [번호 수정] the secondary; §16 item 3's proposal lists 응답 없음 with [번호 수정]. S03 ships §7 (`stateGuide.noResponse.primaryAction: "retry"`). If the operator's approval-3 decision names [번호 수정], a follow-up task changes that one value to `"fixNumber"` and the Task 11 "client timeout" expectations (primary `fixNumber`, secondary [톡톡, 다시 조회] — the `fixFirst` rows already pin that order); no derive code changes.

---

## Self-Review

- **Spec coverage.** §5 time axis and causes → Tasks 1, 12 (0.4/3/8 s stages, cancel, elapsed steps, carrier-first link, spinner stop, outage-only notices), 11 (429 countdown, offline auto re-lookup, 2-failure escalation, timeout wording without '번호 문제는 아니에요', 500/contract copy-and-talk, no server raw message). §6 order/number bar/spine/tones/ETA/지금 할 일/overdue/상세 → Tasks 3, 9, 10 (spine codes and marks, ETA kinds and holiday badge, worry lines, overdue at KST midnight, last event with the original term, history segments and summary). §7 per-state rows → Task 5 `stateGuide` (19 rows) + Tasks 10–11 (each state's actions, stores, recommendations, ads). §8 placement → Task 6 invariants + `RevenueView` in Task 10. §9 config, notices, holidays, build validation and 60-day warning → Tasks 4, 5, 6, 7 (+ DEPLOYMENT.md, §17 Q3). §10 CS replies, new NOT_FOUND/ambiguous/lookupUnavailable/error templates, customer link, cs notices, no internal labels or follow-up promises, inquiry-copy round trip → Tasks 8, 13. §14 pure modules and test contract items 4 (table tests with the TZ row and 3 overdue rows) → Tasks 9–11, 14. §16 items 4, 8, 9 → Tasks 15, 17, 16 with the "거절하면" fallbacks. §17 Q1/Q3 defaults → Task 5 `durations`, `calendar`, Korean comments; Task 7 guide.
- **Placeholder scan.** Every code step contains complete code. The only operator-supplied values are the approval-4 range and optional pending links (Task 15, validated by a format test and the host invariant) and a legal-reviewed disclosure text if it differs from the proposal (Task 16).
- **Type consistency.** Contract names are used as written in §11.6–§11.8; additions are listed once. `DataGuideKey`/`CodeGuideKey`/`ErrorKey` are private narrowings of `GuideKey`. `fillSlots` is used for non-stateGuide slots everywhere, `fillCopy` for stateGuide rows. `requestCarrierView` serves both loading (`lookup.copy.carrierAuto`) and errors (`resultCopy.carrierUnknown`). Test counts: 22, 14, 4, 5, 5, 5, 7, 43, 7, 62, 10, 7, 6.
- **Review Focus.** Line 1 → Task 2 NY describe, Task 9 NY describe and boundary rows, Task 10 whole-view equality in New York. Line 2 → Task 10 "broken event times never leak into the view". Line 3 → Task 6 invariant rows, Task 7 "parseSiteConfig throws with one Korean line per problem" and the Step 7 build failure. Line 4 → Task 7 holiday coverage rows. Line 5 → Task 8 paste rows.

