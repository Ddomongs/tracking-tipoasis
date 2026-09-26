# S08 — Supplementary Areas and Selectable Screen Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish R3 with the supplementary areas — recommendations after the result, the home store showcase, one manual ad slot before the footer, the new footer, the privacy page on the shared shell and the ad-timing policy of approval 7 — and then ship R3b: the '서류형' (`manifest`) and '어두운 화면' (`night`) screen styles, the '화면 스타일' picker, a hash-allowed pre-paint script, per-style fonts, per-style contrast/axe checks and the 48-shot visual matrix.

**Architecture:** Part A adds one pure module (`lib/tracking/recommendations.ts`: validity window, product-detail link, '이번 주' and price rules), three small components (`RecommendationList` rendered through S07's `ResultSlot.renderRecommendations`, `StoreShowcase` in `TrackingPage`'s idle extras, `ManualAdSlot` at the end of the lookup island) and a server `SiteFooter` in the public layout; every placement decision is a pure function of the view model, the config and the ad gate (`lib/ads/ad-gate.ts`), so business rules stay testable in Node. Part B adds two token sets and their variant-slot CSS under `[data-style="manifest"]` / `[data-style="night"]` — no component changes its DOM, hooks or copy — plus an inline `<head>` script whose SHA-256 goes into the CSP Report-Only header, and a client `StylePicker` that only flips `html[data-style]`, writes `localStorage` `tt:style` in a try/catch and announces the change once.

**Tech Stack:** Next.js 16.3.6 App Router (Turbopack), React 19.3, TypeScript strict, Tailwind CSS 3.4 with the S05 `tt-*` keys, `next/font/google` (DM Mono from S05; IBM Plex Mono and JetBrains Mono added with `preload: false`), zod 3.25 (config schema only), Playwright 1.55 as the only runner (`tests/unit/*` run without a page).

**Spec:** `docs/superpowers/specs/2026-09-26-tracking-renewal-ia-design.md` — §4 (첫 화면 아래: 보통 이렇게 걸려요 → 쇼케이스 카드 2장 → 수동 광고 슬롯 → 푸터), §7 (idle row: 광고·쇼케이스), §8 (문의·스토어·광고·추천 배치 규칙), §9 (featuredProducts, ads), §12 (CSS ≤ 25 KB, CLS ≤ 0.05, fonts), §13 (세 스타일, 화면 스타일 선택, 깜빡임 방지, 폰트, 접근성, 품질 비용), §14 (ManualAdSlot, 테스트 계약), §15 (R3 / R3b), §16 items 7, 10, 13 (and the "거절하면" fallback of each), §17 Q5. **Roadmap and shared contract:** `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` (§4 approvals, §6 Task 0, §7 gate, §9 budgets, §10 File Map, §11 contract; every cross-stage name below is used exactly as written there). **Upstream plans consumed:** S01 (fixtures, prod flag, stage-screens tool, real-number guard, `lib/site.ts`, `lib/security/headers.ts`, `next.config.ts`, font budget), S02 (`lib/ads/ad-gate.ts`, `lib/ads/ad-signals.ts`, `AdLoader`, `tests/support/network-capture.ts`, the privacy policy text), S03 (config types/schema/invariants, `featuredProducts`, `ads`, `style`, `resultCopy`, `FIXTURE_FEATURED`, `lib/tracking/time.ts`, `lib/tracking/template.ts`), S04 (`LiveAnnouncer`, the four result E2E specs), S05 (tokens, primitives, gallery, `tests/unit/tokens.spec.ts`, `tests/e2e/ui-kit.spec.ts`, DESIGN.md, `design-system/`), S06 (`TrackingPage`, `LookupController`, `components/lookup/session.ts`, `(public)/layout.tsx`, `.tt-legacy-dark`, `tests/e2e/RULE-MAP.md`), S07 (`ResultSlot` with `renderRecommendations`/`onView`, `ResultView` recommendation slot after `[data-primary-end]`, `SettledViewRecord`/`currentView` in `LookupController`, the legacy `LegacyRecommendedProducts` bridge this plan removes).

**Depends on:** S05, S06, S07 (and through them S01, S02, S03, S04 — all merged into `claude/tipoasis-tracking-renewal-ae0e3a` before this stage starts).

**Gated by:** approval 7 (Task 9: `AD_TIMING_POLICY = "afterAllowedResult"`), approval 10 (Task 10: inline recommendations with the product-detail fact check), approval 13 (Task 16: `tests/e2e/style-a11y.spec.ts` with `@axe-core/playwright`).

**Release / order:** user order #4. Part A (Tasks 1–10) completes R3; Part B (Tasks 11–17) is R3b. Branch `renewal/s08-supplementary-and-styles`; Task 8 Step 9 describes the optional R3 checkpoint merge between the two parts.

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

**S08-specific constraints**
- Recommendations (spec §8, §16 item 10): inline only once approval 10 is recorded; until then the spec's "거절하면" applies — the dialog stays, labelled '운영자 추천', with no price, discount, review or '이번 주' labels. Either way: only items of the result's context inside `[validFrom, validUntil)`, 0 items → no block, the block sits in S07's recommendation slot (after `[data-primary-end]` for delivered, after 처리 내역 otherwise), never in problem states or under overdue (`view.revenue.recommendations === "none"`).
- `'이번 주'` only when `validUntil − validFrom ≤ 7 days`; a price only with a product-detail link and `priceCheckedAt` at most 7 days before the customer's clock. A product-detail link is any `https://` link that is not one of the store-home or 톡톡 links in `channels`.
- Store showcase: home idle only, two store links under the definitive disclosure (`AffiliateLinkGroup`, placement `showcase`), below '보통 이렇게 걸려요'. No store link or showcase in loading, result or error modes.
- Manual ad slot: at most one per page, the last element of `<main>` (after the showcase on the home, after the result area on results), reserved `min-height` 280 px (mobile) / 250 px (≥ 768 px) from `config.ads`; rendered only when `config.ads.manualSlotId` is set (approval 15), the view allows ads (`view.revenue.adsAllowed`, or idle) and the ad gate is open or can still open in this document; filled (`<ins class="adsbygoogle">`) only while the gate is open. `html { scroll-padding-bottom: var(--tt-anchor-reserve) }` and `--tt-anchor-reserve` equals `ads.anchorReservePx` px.
- 톡톡 appears at most three times per screen (header, one state place, footer); the footer's is `TalkLink` placement `footer` with `channels.talk.labels.footer`.
- `AD_TIMING_POLICY` stays S02's value until Task 9 records approval 7; while it is not `"afterAllowedResult"`, DESIGN.md states the known exception '조회 전에 뜬 하단 광고는 오류 화면에 남을 수 있어요.' (spec §16 item 7 "거절하면").
- Styles: `[data-style="manifest"]` and `[data-style="night"]` each declare all 30 color and 27 non-color tokens (values pass `CONTRAST_REQUIREMENTS`); variant-slot looks are CSS under `[data-style="…"] [data-slot="…"]` (plus pseudo-elements); no primitive gains a prop, a DOM node, a hook or a string. The pre-paint script text is a constant whose SHA-256 is pinned by a unit test and passed to `buildSecurityHeaders({ extraScriptHashes })`.
- Fonts: `signal` keeps S05's single DM Mono preload. `manifest` uses IBM Plex Mono 600 and `night` JetBrains Mono 500 for digits, both `preload: false`, referenced only inside their style's token block, so they download only when that style is on screen. Korean display text in `manifest`/`night` uses installed system fonts (Addition 11).
- Copy: the spec gives '운영자 추천', '이번 주', '화면 스타일', '기본' '서류형' '어두운 화면', '화면 스타일을 {label}으로 바꿨어요' and '개인정보처리방침' — used as literals. Every other S08 string lives in `config/site.config.ts` `resultCopy` (Task 2).
- Stage screenshots go to `test-artifacts/stage-screens/S08-{before,after}/` (S01 Addition 1); read `test-results/…` in the verbatim Task 0 / gate text as `test-artifacts/…`.
- No real or unidentified tracking number, phone number or ad-unit id appears in code, tests, test titles, commit messages or screenshots; tests take numbers from `tests/fixtures/tracking-fixtures.ts`, and the gallery's demo ad-unit id is `0000000000`.

## Review Focus

Conditions the spec implies but no rule names; each is pinned by a test in the owning task.

1. **In-app browsers whose storage throws** (roadmap Review Focus 3 assigns this to S08; Naver/Kakao webviews, private windows): reading or writing `localStorage` throws — the pre-paint script must still set a style (`signal`, or `night` on a dark device), the page must not log a page error, the picker must still switch the style for the current page and announce it, and a lookup must still work. Owner: Task 12 (`tests/unit/prepaint.spec.ts` "storage that throws"; `tests/e2e/style-picker.spec.ts` "storage that throws: …") and Task 14 (`style-picker.spec.ts` "storage that throws: the picker still switches …").
2. **A customer's clock far from the config dates** (a tab left open for days, a phone clock off, the page cached across a recommendation's end): an item outside its window never shows, a price checked more than 7 days ago never shows, and a result after every window has ended shows no block at all. Owner: Task 1 (`tests/unit/recommendations.spec.ts` boundary rows) and Task 3 (`tests/e2e/recommendations.spec.ts` "after every validity window has ended …").
3. **A dark-mode device with an earlier choice or a damaged stored value** (a customer who picked '기본' on a dark phone; `tt:style` holding `"dark"` from an old experiment): a valid stored choice always wins, an invalid one falls back to the first-visit rule, and JavaScript disabled shows the server default. Owner: Task 12 (`prepaint.spec.ts` rows; `style-picker.spec.ts` "a stored choice wins over the dark device", "an unknown stored value …", "without JavaScript …").
4. **Narrow screens in the new styles** (320 px with the rotated stamp, the digit tiles and the wider mono digits): no horizontal scroll and no text at 11 px or less in any style, on the gallery and on a live result. Owner: Task 13 (`tests/e2e/ui-kit.spec.ts` "every screen style (S08)") and Task 14 (`style-picker.spec.ts` "320 px in every style: …").
5. **Store links that are not product pages** (the shipped `featuredProducts` still point at store homes): the approved inline list must never present a store home as a product and never show a price for it; while approval 10 is pending the dialog never shows prices, and no dialog link is in the page until the customer opens it (so the result keeps exactly the store links its view allows). Owner: Task 1 ("a store-home link is never recommended …"), Task 3 ("no product link is in the page until the dialog opens"), Task 10 (Step 2 fact check, `recommendations.spec.ts` inline rows).

## Additions to the contract

Everything below is additive; no §11 name is renamed or retyped. Each item goes into the stage summary as a contract deviation (roadmap §5 "Contract changes").

1. **`lib/tracking/recommendations.ts` extra exports:** `type RecommendationPresentation = "inline" | "dialog"`, `RECOMMENDATION_PRESENTATION` (pinned to ledger row 10 by a unit test; `"dialog"` until Task 10), `RECOMMENDATION_LIMIT = 3`, `WEEKLY_LABEL_MAX_DAYS = 7`, `PRICE_CHECK_MAX_AGE_DAYS = 7`, `isProductDetailLink(href: string): boolean`, `selectOperatorPicks(items, context, now, limit): readonly SelectedRecommendation[]` (fallback; removed by Task 10), `recommendationsForView(revenue: RevenueView, items: readonly FeaturedItem[], now: Date, presentation: RecommendationPresentation): readonly SelectedRecommendation[]` (Task 10 drops the fourth parameter). `recommendations: "optional"` (customsWaiting/customsCleared) behaves like `"inline"`: an item appears only if its `contexts` list names that state, so the operator opts items in per state.
2. **`RecommendationListProps`** is exported from `components/supplementary/RecommendationList.tsx` (same shape as §11.9).
3. **`ResultCopyConfig` gains six fields (Task 2):** `recommendationsOpen` '운영자 추천 상품 보기', `recommendationsClose` '닫기', `recommendationPriceChecked` '{date} 확인' (slot `date`), `showcaseTitle` '판매 중인 상품 둘러보기', `footerNote`, `adSlotLabel` '광고'. File Map rows `lib/config/types.ts`, `lib/config/invariants.ts`, `config/site.config.ts` gain "M S08".
4. **`lib/ads/ad-gate.ts` extra exports (Task 7):** `type AdGateState = "open" | "waiting" | "closed"`, `adGateState(input: AdGateInput): AdGateState`, `type ManualSlotMode = "none" | "reserved" | "filled"`, `manualSlotMode(input: { viewMode: ViewMode; resultAdsAllowed: boolean | null; gate: AdGateState }): ManualSlotMode`.
5. **`components/ads/useAdGateState.ts` (C S08, client):** `useAdGateState(serverEntry: "home" | "deepLink" | null): AdGateState` — the gate re-read on every ad-signal change; on the server `/` (static) is evaluated as a home document.
6. **`components/ads/ShowcaseReachedSignal.tsx` (C S08, client, approval 7 only):** an `aria-hidden` sentinel `div[data-ad-scroll-sentinel="showcase"]` that sets `scrolledPastLookup: true` once the showcase is on screen after a real scroll.
7. **`lib/style/prepaint.ts` extra exports:** `PREPAINT_SCRIPT_ID = "tt-prepaint"` (the `<script id>`; attributes are outside the hash) and `PREPAINT_CSP_SOURCE` (`'sha256-…'`). The module has no imports so `next.config.ts` can load it by relative path.
8. **`lib/style/style-choice.ts` (C S08, browser):** `readAppliedStyle(): StyleId`, `subscribeAppliedStyle(listener): () => void`, `applyStyleChoice(id: StyleId, storage?: Pick<Storage, "setItem"> | null): void`.
9. **New `data-*` hooks:** `data-store-showcase` (StoreShowcase root, replaces the legacy `data-storefront-showcase`), `data-ad-scroll-sentinel` (approval 7), `data-recommendation-weekly` and `data-recommendation-price` (inline list, Task 10); gallery demo ids `manual-ad-slot` and `style-picker` (S05's ids are kept).
10. **CSS budget basis (Task 8):** the sum over every `<link rel="stylesheet">` of the server HTML of `gzip -9` bytes, 1 KB = 1024 B (the S07 JS-budget basis, S07 Addition 16); raw bytes are printed next to it. Spec §12's "현재 188,660B" is a raw figure; if the operator wants a raw-byte budget, Tailwind's preflight plus the token/slot CSS alone is expected above 25 KB raw — reported as an open issue, not silently changed.
11. **Font plan deviation:** contract §11.12 lists "display Hahmlet 700 subset" (`manifest`) and "display Gothic A1 700 subset" (`night`). `next/font/google` writes every Korean unicode-range `@font-face` of such a family into the global CSS (Phase 1 PERF-04 measured 377 rules for IBM Plex Sans KR), which alone breaks the 25 KB CSS budget, and a build-time subset needs a new font tool (approval 13). S08 therefore uses installed system fonts for Korean display text (`manifest`: a serif stack, `night`: the system gothic) and web fonts only for digits: IBM Plex Mono 600 (`--font-plex-mono`) and JetBrains Mono 500 (`--font-jetbrains-mono`), latin, `preload: false`. The S05 legacy-font bans narrow from "IBM Plex" to "IBM Plex Sans" (Tasks 13 and 17).
12. **Placement order at the page end:** `<main>` ends with the manual slot (when rendered); `app/(public)/layout.tsx` then renders `StylePicker` and `SiteFooter`, so the slot sits right before the footer block and the picker right above the footer (spec §8, §13).
13. **Visual matrix states (Task 15):** the eight Phase 3 canvas screens — home, loading (short stage), pending, customsWaiting, inTransit, delivered, stale, NOT_FOUND — at 375 and 1440 px in the three styles.
14. **File Map additions (M S08):** `tests/e2e/cta-consistency.spec.ts` and `tests/e2e/status-slot.spec.ts` (the legacy showcase hook), `tests/e2e/RULE-MAP.md`, `tests/e2e/internal-isolation.spec.ts` (Task 9, approval 7), `components/StoreContactPopup.tsx` (only when S06 ran Task 7F: its imports move off `lib/storefront.ts`), `tests/e2e/result-a11y.spec.ts` and `tests/e2e/home.spec.ts` axe exclusions (Task 16, approval 13). **File Map additions (C S08):** `components/ads/useAdGateState.ts`, `components/ads/ShowcaseReachedSignal.tsx`, `lib/style/style-choice.ts`.
15. **`anchorReservePx` stays 64.** No automated test can render a real AdSense anchor (third-party requests are aborted in every test); a unit test pins `--tt-anchor-reserve` (every style) to `ads.anchorReservePx`, and the operator re-measures after approval 15 (open issue 3).
16. **No `data-deco` element was needed.** Every style decoration (the stamp's double rule and tilt, the night lamp, the digit tiles, the dashed route and round stations) is CSS on S05's existing hooks — borders, transforms and `::before` — so no primitive gains a DOM node. The `data-deco` hook (contract §11.13) stays reserved for a later style that needs a real element; the style-independence scan (Task 14) keeps components from reading the style.

## File Structure

| File | Action (task) | Responsibility |
|---|---|---|
| `lib/tracking/recommendations.ts` | Create (1), Modify (10) | Pure selection: context, validity window, detail link, '이번 주', price freshness, limit, presentation |
| `tests/unit/recommendations.spec.ts` | Create (1), Modify (2, 6, 10) | Selection rows, ledger pin, S08 config copy, legacy files gone |
| `lib/config/types.ts`, `config/site.config.ts`, `lib/config/invariants.ts` | Modify (2) | Six `resultCopy` strings |
| `components/supplementary/RecommendationList.tsx` | Create (3), Modify (10) | '운영자 추천' dialog (fallback) → inline list (approval 10) |
| `components/lookup/LookupController.tsx` | Modify (3, 7) | `renderRecommendations` with the S08 list; the manual slot and the ad gate |
| `components/RecommendedProducts.tsx` | Delete (3) | Legacy dialog |
| `tests/e2e/recommendations.spec.ts` | Create (3), Modify (10) | Placement, dialog/inline behavior, validity at the customer's clock |
| `tests/e2e/RULE-MAP.md` | Modify (3, 4, 5, 10) | S08 rule → assertion rows |
| `components/supplementary/StoreShowcase.tsx` | Create (4) | Home showcase (disclosure first, two store links) |
| `components/shell/TrackingPage.tsx` | Modify (4, 9) | Idle extras: typical durations → showcase (→ scroll sentinel, approval 7) |
| `components/StorefrontShowcase.tsx` | Delete (4) | Legacy showcase |
| `tests/e2e/cta-consistency.spec.ts`, `tests/e2e/status-slot.spec.ts` | Modify (4) | `[data-storefront-showcase]` → `[data-store-showcase]` |
| `tests/e2e/ad-placement.spec.ts` | Create (4), Modify (5, 7, 9) | Showcase, footer, 톡톡 count, manual slot, ad timing |
| `components/shell/SiteFooter.tsx` | Create (5) | Footer: note, '개인정보처리방침', 톡톡 (placement footer) |
| `app/(public)/layout.tsx` | Modify (5, 14) | New footer; the picker above it |
| `components/SiteFooter.tsx` | Delete (5) | Legacy footer |
| `app/(public)/privacy/page.tsx`, `tests/privacy.spec.ts` | Modify (6) | Policy on the token shell, 톡톡 from `channels` |
| `app/globals.css` | Modify (6, 7) | Legacy band/classes out; `scroll-padding-bottom` in |
| `components/AnimatedIcon.tsx`, `lib/storefront.ts` | Delete (6) | Last legacy consumers gone |
| `components/StoreContactPopup.tsx` | Modify (6, only after S06 Task 7F) | Imports from `channels` instead of `lib/storefront.ts` |
| `lib/ads/ad-gate.ts`, `tests/unit/ad-gate.spec.ts` | Modify (7, 8, 9) | `adGateState`, `manualSlotMode`; DESIGN.md exception check; `afterAllowedResult` (approval 7) |
| `components/ads/useAdGateState.ts`, `components/ads/ManualAdSlot.tsx` | Create (7) | Gate hook; reserved slot with a gated fill |
| `app/(internal)/internal/ui-kit/page.tsx` | Modify (7, 14) | Manual-slot demo; style picker row |
| `tests/unit/real-number-guard.spec.ts` | Modify (7) | Allowlist `ads.manualSlotId` |
| `tests/budgets/css-budget.spec.ts` | Create (8) | CSS ≤ 25 KB on `/`, `/{번호}`, `/privacy` |
| `DESIGN.md` | Modify (8, 9, 17) | Supplementary placement and the ad-timing exception; style sections |
| `components/ads/ShowcaseReachedSignal.tsx`, `tests/e2e/internal-isolation.spec.ts` | Create / Modify (9) | Approval 7 only |
| `lib/style/styles.ts`, `lib/style/tokens.ts`, `tests/unit/tokens.spec.ts` | Modify (11, 13, 17) | Three implemented styles, their colors, parity and supplements |
| `app/styles/style-manifest.css`, `app/styles/style-night.css` | Create (11), Modify (13) | Token blocks (11); slot CSS (13) |
| `app/layout.tsx` | Modify (11, 12, 13) | Style CSS imports; pre-paint script, `data-follow-dark`, `suppressHydrationWarning`; digit fonts |
| `lib/style/prepaint.ts`, `tests/unit/prepaint.spec.ts` | Create (12), Modify (14) | Script text + hash; behavior in a VM; style-independence scan |
| `next.config.ts` | Modify (12) | Pass `PREPAINT_CSP_SOURCE` into the Report-Only `script-src` |
| `tests/e2e/style-picker.spec.ts` | Create (12), Modify (14) | Pre-paint rules; picker rules |
| `tests/e2e/ui-kit.spec.ts`, `tests/budgets/font-preload.spec.ts` | Modify (7, 13, 14) | Slot demo; per-style gallery checks; per-style font budgets |
| `lib/style/style-choice.ts`, `components/shell/StylePicker.tsx` | Create (14) | Apply/remember/announce a style |
| `tests/visual/style-matrix.spec.ts` (+ `tests/visual/style-matrix.spec.ts-snapshots/`) | Create (15) | 48 screenshots, `PW_VISUAL=1` |
| `tests/tools/stage-screens.spec.ts` | Modify (15) | Four style scenarios |
| `tests/e2e/style-a11y.spec.ts` | Create (16, approval 13) | axe per style |
| `design-system/foundations/styles.html`, `design-system/_base.css`, `design-system/README.md` | Create / Modify (17) | Style previews from the real CSS |

Execution order: Task 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → gated 9 and 10 (each checks the ledger first) → 11 → 12 → 13 → 14 → 15 → gated 16 → 17 → Task Final.

## Conventions for this plan

- Shell: PowerShell 5.1 for `npm`, `npx`, `node` and `git` (no `&&`; use `;`). `$env:NAME='x'` sets a flag for the rest of the session; clear it with `$env:NAME=$null`. Quote every path that contains `(`, `)`, `[` or `]`, and use `-LiteralPath` with `Test-Path`, `Get-Content` and `Select-String` for such paths.
- **Unit run** = `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test <files>; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null` (these tests never open a page).
- **Dev-mode run** = port 43210 free, then `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test <files>` (Playwright starts `next dev` with `INTERNAL_ACCESS_PASSWORD`, so `/internal/ui-kit` answers the test credentials).
- **Production run** = `npm run build` → background PowerShell `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1` → wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200` → `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test <files>` → stop the server with `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }` and clear the flags `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.
- After a route or layout file changes shape, delete stale generated route types before `npm run typecheck`: `if (Test-Path .next) { Remove-Item -Recurse -Force .next }`.
- Edits to files earlier stages wrote quote the exact text to find. If a quoted fragment is not found (an earlier stage reformatted it), apply the same change to the equivalent lines, prove it with the `Select-String` check the step gives, and write the difference into the stage summary.
- Result expectations that are not E2E-locked strings (roadmap §11.11) are computed in the test with `deriveTrackingView(outcome, now, siteConfig)` and `recommendationsForView(...)`, so tests lock rules, roles and hooks — not copy (approval 2).

---

### Task 0: Stage start

- [ ] **Step 1: Read approvals.** Open `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §4. For every approval number in this plan's "Gated by" list, write its Status into the stage summary. `pending`/`rejected` → execute the fallback steps and mark the gated task SKIPPED with the reason.
- [ ] **Step 2: Confirm dependencies.** Run (PowerShell): `git log --oneline claude/tipoasis-tracking-renewal-ae0e3a -40`
  Expected: a `merge: SNN …` commit for every stage in this plan's "Depends on" list.
- [ ] **Step 3: Branch.** Run: `git switch -c renewal/s08-supplementary-and-styles claude/tipoasis-tracking-renewal-ae0e3a`
  Expected: `Switched to a new branch 'renewal/s08-supplementary-and-styles'`.
- [ ] **Step 4: Port free.** Run: `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue`
  Expected: no output. Otherwise stop the listener: `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`
- [ ] **Step 5: Baseline build and before-screens.** Run `npm ci` only if `package-lock.json` changed since the last install in this worktree, then `npm run build`.
  Expected: build exits 0. Start the production server in a background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`
  Wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200`.
  Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='before'; $env:PW_STAGE='S08'; npx playwright test tests/tools/stage-screens.spec.ts`
  Expected: PNGs in `test-results/stage-screens/S08-before/` for widths 320, 375, 768, 1024, 1440. (S01 creates the tool first; S01 runs this step after its Task 1.)
- [ ] **Step 6: Baseline suite.** With the server still running: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test`
  Expected: record "N passed / M skipped / 0 failed" in the stage summary. Then stop the server (Step 4 command) and clear the flags: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.

**S08 notes on the standard steps above**
- Step 1: the "Gated by" list is 7, 10, 13. Step 7 below also records rows 1, 6 and 15, which decide which files exist (row 1) and what Task 9 may do (row 6), and when the manual slot can appear at all (row 15).
- Step 2: expected merges are `merge: S05 …`, `merge: S06 …`, `merge: S07 …`, and (through them) `merge: S01 …` to `merge: S04 …`.
- Step 5: the PNGs land in `test-artifacts/stage-screens/S08-before/` (S01 Addition 1).

- [ ] **Step 7 (S08): Record the approvals this stage reads.** Run:
  `Select-String -Path docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md -Pattern '^\| (1|6|7|10|13|15) \|' | ForEach-Object { $_.Line }`
  Expected: six ledger rows. Copy each row's Status into the stage summary. Approvals 7, 10 and 13 decide whether Tasks 9, 10 and 16 run or are SKIPPED (each task checks again before it starts).
- [ ] **Step 8 (S08): The artifacts this stage consumes exist.** Run:
  `Test-Path -LiteralPath components/result/ResultSlot.tsx, components/result/ResultView.tsx, components/lookup/LookupController.tsx, components/lookup/session.ts, components/shell/TrackingPage.tsx, components/shell/SiteHeader.tsx, "app/(public)/layout.tsx", "app/(public)/privacy/page.tsx", "app/(internal)/internal/ui-kit/page.tsx", lib/ads/ad-gate.ts, lib/ads/ad-signals.ts, components/ads/AdLoader.tsx, components/primitives/AffiliateLinkGroup.tsx, components/primitives/TalkLink.tsx, components/primitives/ButtonLink.tsx, components/primitives/Button.tsx, components/primitives/LiveAnnouncer.tsx, app/styles/tokens.css, lib/style/styles.ts, lib/style/tokens.ts, lib/config/invariants.ts, tests/fixtures/config-fixtures.ts, tests/fixtures/tracking-fixtures.ts, tests/support/network-capture.ts, tests/e2e/RULE-MAP.md, tests/e2e/cta-consistency.spec.ts, tests/e2e/status-slot.spec.ts, tests/unit/real-number-guard.spec.ts, tests/unit/tokens.spec.ts, tests/e2e/ui-kit.spec.ts, tests/budgets/font-preload.spec.ts, tests/tools/stage-screens.spec.ts, next.config.ts`
  Expected: 33 lines `True`. A `False` means the owning stage is not merged as the contract describes — stop and name the missing file in the stage summary.
- [ ] **Step 9 (S08): The legacy files this stage deletes are still there.** Run:
  `Test-Path -LiteralPath components/RecommendedProducts.tsx, components/StorefrontShowcase.tsx, components/SiteFooter.tsx, components/AnimatedIcon.tsx, lib/storefront.ts, components/StoreContactPopup.tsx`
  Expected: five `True`, then `True` for `StoreContactPopup.tsx` only if S06 ran its approval-1 fallback (Task 7F) — record which. A `False` among the first five means an earlier stage already deleted it: skip that file's deletion step and note it.
- [ ] **Step 10 (S08): Record the lookup-island surface Tasks 3 and 7 edit.** Run:
  `Select-String -Path components/lookup/LookupController.tsx -Pattern 'next/dynamic|LegacyRecommendedProducts|renderRecommendations|currentView|clientNowMs|idleExtras|viewMode|handleView|@/config/site.config|LookupOutcome' | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" }`
  Expected: a numbered list that contains `const LegacyRecommendedProducts = dynamic(`, `const renderRecommendations = (view: TrackingViewModel, outcome: LookupOutcome)`, `const currentView =`, `const clientNowMs = useSyncExternalStore(`, `{viewMode === "idle" ? idleExtras : null}` and one `import { … } from "@/config/site.config";` line. Copy it into the stage summary under "LookupController before S08". If `currentView` or `clientNowMs` is missing, stop: S07 Task 9 or S06 Task 8 is not merged as planned.
- [ ] **Step 11 (S08): Record every consumer of the legacy pieces.** Run:
  `git grep -n -e "@/lib/storefront" -e "AnimatedIcon" -e "RecommendedProducts" -e "StorefrontShowcase" -e "components/SiteFooter" -e "data-storefront-showcase" -e "tt-legacy-dark" -- app components lib tests`
  Expected: hits only in the legacy files themselves, `components/lookup/LookupController.tsx` (the S07 bridge), `components/shell/TrackingPage.tsx`, `app/(public)/layout.tsx`, `app/(public)/privacy/page.tsx`, `app/globals.css`, `components/StoreContactPopup.tsx` (7F only), `tests/e2e/cta-consistency.spec.ts`, `tests/e2e/status-slot.spec.ts` and axe exclusions in `tests/e2e/*a11y*.spec.ts` or `tests/e2e/home.spec.ts`. Record the list; Tasks 3–6 and 16 clear every line of it.
- [ ] **Step 12 (S08): Nothing of S08 exists yet.** Run:
  `Test-Path -LiteralPath lib/tracking/recommendations.ts, components/supplementary, components/ads/ManualAdSlot.tsx, components/shell/SiteFooter.tsx, components/shell/StylePicker.tsx, lib/style/prepaint.ts, app/styles/style-manifest.css, tests/e2e/ad-placement.spec.ts; git log --oneline --all -- components/supplementary | Select-Object -First 5`
  Expected: eight lines `False` and no log lines. If anything exists (a parallel or hotfix branch), stop and compare it with this plan task by task; skip only steps whose files already match this plan exactly and record them in the stage summary.

---

## Part A — R3: supplementary areas

### Task 1: Recommendation rules (pure)

**Files:**
- Create: `lib/tracking/recommendations.ts`
- Test: `tests/unit/recommendations.spec.ts` (create)

**Interfaces:**
- Consumes: `FeaturedItem` (S03 `lib/config/types.ts`); `RecommendationContext`, `RevenueView` (S03 `lib/tracking/types.ts`); `parseInstant(iso: string): Date | null` (S03 `lib/tracking/time.ts`); `channels` (S03 `config/site.config.ts`); test-only `FIXTURE_FEATURED` (S03 `tests/fixtures/config-fixtures.ts`: `fx-weekly-mount` naver, valid 2026-09-21 → 2026-09-28, no price; `fx-month-case` coupang affiliate, valid 2026-09-01 → 2026-10-31T23:59:59, '39,000원' checked 2026-09-24T10:00, contexts incl. `customsWaiting`/`customsCleared`), `FIXTURE_NOW` (S01, 2026-09-26T14:05+09:00).
- Produces (contract §11.8 + Addition 1): `interface SelectedRecommendation { item; showPrice; weeklyLabel }`, `selectRecommendations(items, context, now, limit)`, `type RecommendationPresentation`, `RECOMMENDATION_PRESENTATION` (`"dialog"`), `RECOMMENDATION_LIMIT` (3), `WEEKLY_LABEL_MAX_DAYS` (7), `PRICE_CHECK_MAX_AGE_DAYS` (7), `isProductDetailLink(href)`, `selectOperatorPicks(items, context, now, limit)`, `recommendationsForView(revenue, items, now, presentation)`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/recommendations.spec.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { channels } from "@/config/site.config";
import type { FeaturedItem } from "@/lib/config/types";
import {
  PRICE_CHECK_MAX_AGE_DAYS,
  RECOMMENDATION_LIMIT,
  RECOMMENDATION_PRESENTATION,
  WEEKLY_LABEL_MAX_DAYS,
  isProductDetailLink,
  recommendationsForView,
  selectOperatorPicks,
  selectRecommendations,
  type SelectedRecommendation
} from "@/lib/tracking/recommendations";
import type { RevenueView } from "@/lib/tracking/types";
import { FIXTURE_FEATURED } from "../fixtures/config-fixtures";
import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";

const REPO_ROOT = path.resolve(__dirname, "..", "..");

function fixture(id: string): FeaturedItem {
  const item = FIXTURE_FEATURED.find((candidate) => candidate.id === id);
  if (item === undefined) throw new Error(`FIXTURE_FEATURED has no item "${id}"`);
  return item;
}

const WEEKLY = fixture("fx-weekly-mount");
const MONTH = fixture("fx-month-case");
/** An item that still points at a store home — the state of the shipped config until the operator supplies detail links. */
const STORE_HOME: FeaturedItem = {
  ...MONTH,
  id: "fx-store-home",
  channel: "naver",
  href: channels.naver.urls.showcase,
  isAffiliate: false
};
/** A window one day longer than the '이번 주' limit. */
const EIGHT_DAYS: FeaturedItem = { ...WEEKLY, id: "fx-eight-days", validUntil: "2026-09-29T00:00:00+09:00" };

const at = (iso: string): Date => new Date(iso);
const ids = (list: readonly SelectedRecommendation[]): readonly string[] => list.map((entry) => entry.item.id);

function revenue(overrides: Partial<RevenueView>): RevenueView {
  return { tier: "quiet", stores: "none", recommendations: "inline", recommendationContext: "pending", adsAllowed: true, ...overrides };
}

test.describe("selectRecommendations (approved rules, spec §8)", () => {
  test("keeps the items of the context inside their validity window, in config order", () => {
    expect(ids(selectRecommendations(FIXTURE_FEATURED, "pending", FIXTURE_NOW, 5))).toEqual(["fx-weekly-mount", "fx-month-case"]);
    expect(ids(selectRecommendations(FIXTURE_FEATURED, "customsWaiting", FIXTURE_NOW, 5))).toEqual(["fx-month-case"]);
  });

  test("the window is [validFrom, validUntil): an item appears at its start and is gone at its end", () => {
    expect(ids(selectRecommendations([WEEKLY], "pending", at("2026-09-20T23:59:59+09:00"), 5))).toEqual([]);
    expect(ids(selectRecommendations([WEEKLY], "pending", at("2026-09-21T00:00:00+09:00"), 5))).toEqual(["fx-weekly-mount"]);
    expect(ids(selectRecommendations([WEEKLY], "pending", at("2026-09-27T23:59:59+09:00"), 5))).toEqual(["fx-weekly-mount"]);
    expect(ids(selectRecommendations([WEEKLY], "pending", at("2026-09-28T00:00:00+09:00"), 5))).toEqual([]);
  });

  test("'이번 주' only for a validity window of 7 days or less", () => {
    expect(WEEKLY_LABEL_MAX_DAYS).toBe(7);
    const [weekly, month] = selectRecommendations([WEEKLY, MONTH], "pending", FIXTURE_NOW, 5);
    expect(weekly?.weeklyLabel).toBe(true);
    expect(month?.weeklyLabel).toBe(false);
    expect(selectRecommendations([EIGHT_DAYS], "pending", FIXTURE_NOW, 5)[0]?.weeklyLabel).toBe(false);
  });

  test("a store-home link is never recommended, even with a fresh price", () => {
    expect(ids(selectRecommendations([STORE_HOME, MONTH], "pending", FIXTURE_NOW, 5))).toEqual(["fx-month-case"]);
  });

  test("a price shows only when it was checked at most 7 days before now", () => {
    expect(PRICE_CHECK_MAX_AGE_DAYS).toBe(7);
    const priceAt = (iso: string): boolean | undefined => selectRecommendations([MONTH], "pending", at(iso), 5)[0]?.showPrice;
    expect(priceAt("2026-09-26T14:05:00+09:00")).toBe(true);
    expect(priceAt("2026-10-01T10:00:00+09:00")).toBe(true);
    expect(priceAt("2026-10-01T10:00:01+09:00")).toBe(false);
    expect(priceAt("2026-09-24T09:59:59+09:00")).toBe(false);
    expect(selectRecommendations([WEEKLY], "pending", FIXTURE_NOW, 5)[0]?.showPrice).toBe(false);
  });

  test("the limit cuts the list; zero or less returns nothing", () => {
    expect(ids(selectRecommendations(FIXTURE_FEATURED, "pending", FIXTURE_NOW, 1))).toEqual(["fx-weekly-mount"]);
    expect(selectRecommendations(FIXTURE_FEATURED, "pending", FIXTURE_NOW, 0)).toEqual([]);
    expect(selectRecommendations(FIXTURE_FEATURED, "pending", FIXTURE_NOW, -2)).toEqual([]);
  });
});

test.describe("selectOperatorPicks (approval-10 fallback: '운영자 추천' dialog)", () => {
  test("uses the same context and window rules but keeps store-home links", () => {
    expect(ids(selectOperatorPicks([STORE_HOME, WEEKLY, MONTH], "pending", FIXTURE_NOW, 5))).toEqual([
      "fx-store-home",
      "fx-weekly-mount",
      "fx-month-case"
    ]);
    expect(ids(selectOperatorPicks([WEEKLY], "pending", at("2026-09-28T00:00:00+09:00"), 5))).toEqual([]);
  });

  test("never shows a price or '이번 주'", () => {
    for (const entry of selectOperatorPicks([STORE_HOME, WEEKLY, MONTH], "pending", FIXTURE_NOW, 5)) {
      expect(entry.showPrice, entry.item.id).toBe(false);
      expect(entry.weeklyLabel, entry.item.id).toBe(false);
    }
  });
});

test.describe("recommendationsForView", () => {
  test("nothing when the view allows no recommendations or has no context", () => {
    expect(recommendationsForView(revenue({ recommendations: "none" }), FIXTURE_FEATURED, FIXTURE_NOW, "inline")).toEqual([]);
    expect(recommendationsForView(revenue({ recommendationContext: null }), FIXTURE_FEATURED, FIXTURE_NOW, "dialog")).toEqual([]);
  });

  test("'optional' states show only items that name the state in their contexts", () => {
    const view = revenue({ recommendations: "optional", recommendationContext: "customsCleared" });
    expect(ids(recommendationsForView(view, FIXTURE_FEATURED, FIXTURE_NOW, "inline"))).toEqual(["fx-month-case"]);
    expect(recommendationsForView(view, [WEEKLY], FIXTURE_NOW, "inline")).toEqual([]);
  });

  test("the presentation picks the rule set, and the list never exceeds RECOMMENDATION_LIMIT", () => {
    expect(RECOMMENDATION_LIMIT).toBe(3);
    const many = [STORE_HOME, WEEKLY, MONTH, { ...MONTH, id: "fx-month-copy" }, { ...WEEKLY, id: "fx-weekly-copy" }];
    expect(ids(recommendationsForView(revenue({}), many, FIXTURE_NOW, "inline"))).toEqual(["fx-weekly-mount", "fx-month-case", "fx-month-copy"]);
    expect(ids(recommendationsForView(revenue({}), many, FIXTURE_NOW, "dialog"))).toEqual(["fx-store-home", "fx-weekly-mount", "fx-month-case"]);
  });
});

test("isProductDetailLink: https links that are not a configured store-home or 톡톡 link", () => {
  for (const href of [...Object.values(channels.naver.urls), ...Object.values(channels.coupang.urls), channels.talk.url]) {
    expect(isProductDetailLink(href), href).toBe(false);
  }
  expect(isProductDetailLink(WEEKLY.href)).toBe(true);
  expect(isProductDetailLink(MONTH.href)).toBe(true);
  expect(isProductDetailLink(WEEKLY.href.replace("https://", "http://"))).toBe(false);
});

test("RECOMMENDATION_PRESENTATION follows approval 10 in the roadmap ledger", () => {
  const ledger = readFileSync(path.join(REPO_ROOT, "docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md"), "utf8");
  const status = /^\| 10 \| [^|]+\| (\w+) \|/m.exec(ledger)?.[1];
  expect(status, "approval 10 row not found in roadmap §4").toBeTruthy();
  expect(RECOMMENDATION_PRESENTATION).toBe(status === "approved" ? "inline" : "dialog");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/recommendations.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `Error: Cannot find module '@/lib/tracking/recommendations'` (no test runs).

- [ ] **Step 3: Write `lib/tracking/recommendations.ts`**

```ts
import { channels } from "@/config/site.config";
import type { FeaturedItem } from "@/lib/config/types";
import { parseInstant } from "@/lib/tracking/time";
import type { RecommendationContext, RevenueView } from "@/lib/tracking/types";

/**
 * Recommendations after a result (spec §8 "추천", §16 item 10). Pure: time always arrives as `now` (contract §11.1 rule 5).
 * - Only items whose `contexts` name the result's state and whose validity span [validFrom, validUntil) contains `now`.
 * - Approved rules (inline list): a product-detail link is required; '이번 주' only for a span of 7 days or less;
 *   a price only when it was checked at most 7 days before `now`.
 * - Fallback rules (approval 10 not granted, '운영자 추천' dialog): same context and span rules, never a price or '이번 주'.
 */
export interface SelectedRecommendation {
  readonly item: FeaturedItem;
  readonly showPrice: boolean;
  readonly weeklyLabel: boolean;
}

export type RecommendationPresentation = "inline" | "dialog";

/** Approval 10 (roadmap §4 ledger row 10) is pending: the spec §16 item 10 fallback keeps the dialog. Task 10 switches this. */
export const RECOMMENDATION_PRESENTATION: RecommendationPresentation = "dialog";

/** At most three items per result (three short lines at 375 px). */
export const RECOMMENDATION_LIMIT = 3;
export const WEEKLY_LABEL_MAX_DAYS = 7;
export const PRICE_CHECK_MAX_AGE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Store-home and 톡톡 links from the config; none of them is a product detail page. */
const NON_DETAIL_LINKS: ReadonlySet<string> = new Set<string>([
  ...Object.values(channels.naver.urls),
  ...Object.values(channels.coupang.urls),
  channels.talk.url
]);

export function isProductDetailLink(href: string): boolean {
  return href.startsWith("https://") && !NON_DETAIL_LINKS.has(href);
}

interface ValiditySpan {
  readonly from: number;
  readonly until: number;
}

function spanOf(item: FeaturedItem): ValiditySpan | null {
  const from = parseInstant(item.validFrom);
  const until = parseInstant(item.validUntil);
  return from === null || until === null ? null : { from: from.getTime(), until: until.getTime() };
}

function isValidAt(item: FeaturedItem, now: Date): boolean {
  const span = spanOf(item);
  const time = now.getTime();
  return span !== null && span.from <= time && time < span.until;
}

function isWeekly(item: FeaturedItem): boolean {
  const span = spanOf(item);
  return span !== null && span.until - span.from <= WEEKLY_LABEL_MAX_DAYS * DAY_MS;
}

function hasFreshPrice(item: FeaturedItem, now: Date): boolean {
  if (item.priceLabel === null || item.priceCheckedAt === null) return false;
  const checked = parseInstant(item.priceCheckedAt);
  if (checked === null) return false;
  const age = now.getTime() - checked.getTime();
  return age >= 0 && age <= PRICE_CHECK_MAX_AGE_DAYS * DAY_MS;
}

function itemsFor(items: readonly FeaturedItem[], context: RecommendationContext, now: Date): readonly FeaturedItem[] {
  return items.filter((item) => item.contexts.includes(context) && isValidAt(item, now));
}

export function selectRecommendations(
  items: readonly FeaturedItem[],
  context: RecommendationContext,
  now: Date,
  limit: number
): readonly SelectedRecommendation[] {
  return itemsFor(items, context, now)
    .filter((item) => isProductDetailLink(item.href))
    .slice(0, Math.max(0, limit))
    .map((item) => ({ item, showPrice: hasFreshPrice(item, now), weeklyLabel: isWeekly(item) }));
}

export function selectOperatorPicks(
  items: readonly FeaturedItem[],
  context: RecommendationContext,
  now: Date,
  limit: number
): readonly SelectedRecommendation[] {
  return itemsFor(items, context, now)
    .slice(0, Math.max(0, limit))
    .map((item) => ({ item, showPrice: false, weeklyLabel: false }));
}

/**
 * The recommendations a settled result shows. Nothing when the view allows none (problem states, overdue, loading);
 * "optional" states (customsWaiting, customsCleared) behave like "inline" — an item appears only if it names the state.
 */
export function recommendationsForView(
  revenue: RevenueView,
  items: readonly FeaturedItem[],
  now: Date,
  presentation: RecommendationPresentation
): readonly SelectedRecommendation[] {
  const context = revenue.recommendationContext;
  if (revenue.recommendations === "none" || context === null) return [];
  return presentation === "inline"
    ? selectRecommendations(items, context, now, RECOMMENDATION_LIMIT)
    : selectOperatorPicks(items, context, now, RECOMMENDATION_LIMIT);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/recommendations.spec.ts tests/unit/module-boundaries.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `recommendations.spec.ts` `13 passed`; S03's `module-boundaries.spec.ts` all passed (the new file uses no `window`, `document`, `fetch`, storage, `Date.now()` or `new Date()` without an argument, and imports no zod).
If `module-boundaries.spec.ts` lists `lib/tracking/recommendations.ts` in its "lib/tracking stays pure" findings, a word such as `window` slipped into code (comments are stripped before the scan) — rename it and re-run.

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npm run typecheck; npx eslint lib/tracking/recommendations.ts tests/unit/recommendations.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.
Run: `git add lib/tracking/recommendations.ts tests/unit/recommendations.spec.ts; git commit -m "feat: add recommendation selection rules for validity, detail links, weekly label and price freshness"`

---

### Task 2: Supplementary copy in the config

**Files:**
- Modify: `lib/config/types.ts` (inside `ResultCopyConfig`, after S07's `inquiryCopied` line)
- Modify: `config/site.config.ts` (inside `resultCopy`, the `inquiryCopied` line)
- Modify: `lib/config/invariants.ts` (inside `RESULT_COPY_SLOTS`, S07's feedback line)
- Test: `tests/unit/recommendations.spec.ts` (imports, append)

**Interfaces:**
- Consumes: `ResultCopyConfig`, `resultCopy`, `siteConfig`, `RESULT_COPY_SLOTS` (S03; S07 appended `returnLinkCopied`, `returnLinkShared`, `returnLinkFallback`, `inquiryCopied`); `SiteConfigSchema`, `formatConfigIssues` (S03 `lib/config/schema.ts`).
- Produces (Addition 3): `resultCopy.recommendationsOpen` '운영자 추천 상품 보기', `recommendationsClose` '닫기', `recommendationPriceChecked` '{date} 확인', `showcaseTitle` '판매 중인 상품 둘러보기', `footerNote` '입력한 번호로 관세청 통관 정보와 택배사 배송 정보를 함께 조회해요. 정보가 반영되는 시점에 따라 실제와 조금 다를 수 있어요.', `adSlotLabel` '광고'. Tasks 3–7 read them.

- [ ] **Step 1: Write the failing test**

In `tests/unit/recommendations.spec.ts`, replace the line `import { channels } from "@/config/site.config";` with:

```ts
import { channels, resultCopy, siteConfig } from "@/config/site.config";
import { SiteConfigSchema, formatConfigIssues } from "@/lib/config/schema";
```

Append to the end of the file:

```ts
test.describe("supplementary copy in the config (S08)", () => {
  test("resultCopy carries the S08 strings and the shipped config still parses", () => {
    expect(resultCopy.recommendationsOpen).toBe("운영자 추천 상품 보기");
    expect(resultCopy.recommendationsClose).toBe("닫기");
    expect(resultCopy.recommendationPriceChecked).toBe("{date} 확인");
    expect(resultCopy.showcaseTitle).toBe("판매 중인 상품 둘러보기");
    expect(resultCopy.footerNote.length).toBeGreaterThan(10);
    expect(resultCopy.adSlotLabel).toBe("광고");
    const parsed = SiteConfigSchema.safeParse(siteConfig);
    expect(parsed.success, parsed.success ? "" : formatConfigIssues(parsed.error)).toBe(true);
  });

  test("the price note keeps exactly its {date} slot and every S08 string stays token-free otherwise", () => {
    const broken = SiteConfigSchema.safeParse({
      ...siteConfig,
      resultCopy: { ...siteConfig.resultCopy, recommendationPriceChecked: "가격 확인", showcaseTitle: "{date} 상품" }
    });
    expect(broken.success).toBe(false);
    if (broken.success) return;
    const issues = formatConfigIssues(broken.error);
    expect(issues).toContain("resultCopy.recommendationPriceChecked: {date} 자리가 필요합니다");
    expect(issues).toContain("resultCopy.showcaseTitle: 허용되지 않은 토큰 {date}입니다");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/recommendations.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `2 failed, 13 passed` — the first new test fails on `expect(received).toBe(expected)` with `Received: undefined` for `recommendationsOpen`; the second on `expect(received).toBe(expected)` (`Expected: false`, `Received: true`: the schema does not know the two keys yet, so the patched object still parses — or, if S03's `ResultCopySchema` is `.strict()`, it fails with an `unrecognized_keys` issue and the `toContain` assertion fails instead).

- [ ] **Step 3: Add the six fields**

In `lib/config/types.ts`, replace the line

```ts
  readonly inquiryCopied: string;          // '문의 내용을 복사했어요' (S07)
```

with

```ts
  readonly inquiryCopied: string;          // '문의 내용을 복사했어요' (S07)
  readonly recommendationsOpen: string;    // '운영자 추천 상품 보기' — opens the approval-10 fallback dialog (S08)
  readonly recommendationsClose: string;   // '닫기' (S08)
  readonly recommendationPriceChecked: string; // '{date} 확인' — after a price that was checked within 7 days (S08)
  readonly showcaseTitle: string;          // home store showcase heading (S08)
  readonly footerNote: string;             // footer sentence about where the data comes from (S08)
  readonly adSlotLabel: string;            // '광고' — the manual ad slot's accessible name (S08)
```

In `config/site.config.ts`, replace the line

```ts
  inquiryCopied: "문의 내용을 복사했어요"
```

with

```ts
  inquiryCopied: "문의 내용을 복사했어요",
  // 결과 아래 추천 묶음(승인 10 전에는 '운영자 추천' 창을 여는 버튼과 닫기 버튼), 가격 옆 확인일({date} 자리 필수)
  recommendationsOpen: "운영자 추천 상품 보기",
  recommendationsClose: "닫기",
  recommendationPriceChecked: "{date} 확인",
  // 홈 첫 화면 아래 스토어 묶음 제목, 푸터 안내 문장, 수동 광고 자리의 이름(화면 읽기용)
  showcaseTitle: "판매 중인 상품 둘러보기",
  footerNote: "입력한 번호로 관세청 통관 정보와 택배사 배송 정보를 함께 조회해요. 정보가 반영되는 시점에 따라 실제와 조금 다를 수 있어요.",
  adSlotLabel: "광고"
```

In `lib/config/invariants.ts`, replace the line

```ts
  returnLinkCopied: [], returnLinkShared: [], returnLinkFallback: [], inquiryCopied: []
```

with

```ts
  returnLinkCopied: [], returnLinkShared: [], returnLinkFallback: [], inquiryCopied: [],
  recommendationsOpen: [], recommendationsClose: [], recommendationPriceChecked: ["date"],
  showcaseTitle: [], footerNote: [], adSlotLabel: []
```

Run: `Select-String -Path lib/config/types.ts, config/site.config.ts, lib/config/invariants.ts -Pattern 'recommendationPriceChecked' | ForEach-Object { "$($_.Path | Split-Path -Leaf):$($_.LineNumber)" }`
Expected: three lines, one per file. If S07's lines were formatted differently, the check still shows one match per file once the six fields sit at the end of each list.
Run: `npm run typecheck`
Expected: exit 0. If it reports that `tests/fixtures/config-fixtures.ts` builds a `resultCopy` literal without the new fields, add the same six `key: "value"` lines to that literal and run `npm run typecheck` again (exit 0); name the file in the stage summary.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/recommendations.spec.ts tests/unit/config.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed (`recommendations.spec.ts` `15 passed`; S03's `config.spec.ts` unchanged and green — its invariants now also scan the six strings for digit runs, HBL tokens and forbidden words). If a `config.spec.ts` test pins the exact key list of `resultCopy`, append `"recommendationsOpen", "recommendationsClose", "recommendationPriceChecked", "showcaseTitle", "footerNote", "adSlotLabel"` to that list (the only allowed edit of that S03 file), re-run, and name it in the stage summary.

- [ ] **Step 5: Commit**

Run: `git add lib/config/types.ts config/site.config.ts lib/config/invariants.ts tests/unit/recommendations.spec.ts; git commit -m "feat: add the supplementary-area copy to the site config"`
(If Step 3 or Step 4 touched `tests/fixtures/config-fixtures.ts` or `tests/unit/config.spec.ts`, add them to the `git add` line.)

---

### Task 3: '운영자 추천' after the result (approval-10 fallback) replaces the legacy recommendations

**Files:**
- Create: `components/supplementary/RecommendationList.tsx`
- Modify: `components/lookup/LookupController.tsx` (the `@/config/site.config` import, one new import, the `LegacyRecommendedProducts` statement, the `renderRecommendations` statement)
- Delete: `components/RecommendedProducts.tsx`
- Modify: `tests/e2e/RULE-MAP.md` (append the S08 section)
- Test: `tests/e2e/recommendations.spec.ts` (create)

**Interfaces:**
- Consumes: Task 1 (`recommendationsForView`, `RECOMMENDATION_PRESENTATION`, `SelectedRecommendation`), Task 2 (`resultCopy.recommendationsOpen`, `recommendationsClose`); `Button`, `ButtonLink` (S05); `channels`, `disclosures`, `featuredProducts`, `siteConfig` (S03 config); `RecommendationContext`, `TrackingViewModel`, `LookupOutcome` (S03); `deriveTrackingView` (S03, tests only); S07's `ResultSlotProps.renderRecommendations?: (view: TrackingViewModel, outcome: LookupOutcome) => React.ReactNode` (a one-parameter function is assignable) and S07's `data-result-view`, `data-history`, `data-history-empty`, `data-recommendation-slot`, `data-primary-end` hooks; S06's `clientNowMs` (`useSyncExternalStore(subscribeToNothing, getClientNowSnapshot, getServerNowSnapshot)`, `number | null`); test fixtures `trackData`, `mockTrack`, `FIXTURE_NOW`, `FAKE` (S01).
- Produces (contract §11.9 + Addition 2): `RecommendationList(props: RecommendationListProps): React.JSX.Element | null` with root `<section data-recommended-products={context}>`, `null` for no items; in `LookupController`, `renderRecommendations(view)` returns the list for a settled view (validity judged at the customer's clock snapshot) and loads the component with `next/dynamic` (`ssr: false`).

- [ ] **Step 1: Write the rule → assertion rows first**

Append to the end of `tests/e2e/RULE-MAP.md`:

```markdown

## S08 — supplementary areas and styles

Rows added by S08. An old assertion is removed only after its new one passed (spec §14 test contract 1). Expected values that are not E2E-locked strings (roadmap §11.11) are computed in the tests with `deriveTrackingView` and `recommendationsForView`, so config copy changes never break a rule test.

| # | Rule (spec) | Old assertion (file › test) | New assertion (file › test) | Status |
|---|---|---|---|---|
| S08-1 | 국내 도착 전 추천 노출 — the content part of S07-7 (§8 추천, §16 item 10 거절하면: '운영자 추천' 창, 가격·할인 없음) | tracking.spec › "pending state offers inquiry and purchase-channel choices" (dialog trigger and content; the file was deleted by S07 after S07-7) | recommendations › "pending: '운영자 추천' follows 처리 내역 …", "no product link is in the page until the dialog opens …", "where recommendations appear" ×8, "after every validity span has ended …" | migrated (Task 3) |
```

- [ ] **Step 2: Write the failing E2E test**

Create `tests/e2e/recommendations.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";
import { disclosures, featuredProducts, resultCopy, siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import { RECOMMENDATION_PRESENTATION, recommendationsForView } from "@/lib/tracking/recommendations";
import type { LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";
import { FIXTURE_NOW, mockTrack, trackData, type FixtureState } from "../fixtures/tracking-fixtures";

/** Spec §16 item 10 "거절하면" label (a literal of the spec, not config copy). */
const OPERATOR_PICKS_LABEL = "운영자 추천";
/** After every validity span of the shipped featuredProducts (they end 2027-03-31T23:59:59+09:00). */
const LATE_NOW = new Date("2027-04-01T09:00:00+09:00");
/** Price, discount, weekly or review claims — none may appear while approval 10 is pending. */
const PRICE_OR_CLAIM = /\d[\d,]*\s*원|\d+\s*%|이번 주|베스트|리뷰/;
const STATES: readonly FixtureState[] = [
  "pending", "customsWaiting", "customsCleared", "inTransit", "delivered", "stale", "lookupUnavailableCarrier", "ambiguous"
];

function viewOf(data: TrackResponseData, now: Date): TrackingViewModel {
  const outcome: LookupOutcome = {
    kind: "success",
    request: { number: data.trackingNumber, carrier: "AUTO", entry: "deepLink" },
    data
  };
  return deriveTrackingView(outcome, now, siteConfig);
}

async function openResult(page: Page, data: TrackResponseData, now: Date = FIXTURE_NOW): Promise<void> {
  await page.clock.setFixedTime(now);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
  await mockTrack(page, data);
  await page.goto(`/${data.trackingNumber}`);
  await expect(page.locator("[data-result-view] h2")).toBeVisible();
}

/** The lazy list has had its chance to load: nothing is pending on the network any more. */
async function settled(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
}

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

test.describe("'운영자 추천' dialog (S08, approval-10 fallback)", () => {
  test.skip(RECOMMENDATION_PRESENTATION !== "dialog", "approval 10 granted: the inline list replaced the dialog (Task 10)");

  test("pending: '운영자 추천' follows 처리 내역 and opens a dialog of the operator's picks — disclosure first, no price or discount", async ({ page }) => {
    const data = trackData("pending");
    const expected = recommendationsForView(viewOf(data, FIXTURE_NOW).revenue, featuredProducts, FIXTURE_NOW, RECOMMENDATION_PRESENTATION);
    expect(expected.length, "the shipped config recommends something for pending").toBeGreaterThan(0);
    await openResult(page, data);

    const block = page.locator('[data-recommended-products="pending"]');
    await expect(block.getByRole("heading", { level: 2, name: OPERATOR_PICKS_LABEL })).toBeVisible();
    expect(await precedes(page, "[data-history], [data-history-empty]", "[data-recommended-products]")).toBe(true);

    await block.getByRole("button", { name: resultCopy.recommendationsOpen }).click();
    const dialog = page.getByRole("dialog", { name: OPERATOR_PICKS_LABEL });
    await expect(dialog).toBeVisible();
    const links = dialog.getByRole("link");
    await expect(links).toHaveCount(expected.length);
    for (const [index, { item }] of expected.entries()) {
      const link = links.nth(index);
      await expect(link).toHaveAttribute("href", item.href);
      await expect(link).toHaveAccessibleName(`${item.name} 새 창으로 열기`);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", item.isAffiliate ? "sponsored nofollow noopener noreferrer" : "noopener noreferrer");
    }
    if (expected.some(({ item }) => item.isAffiliate)) {
      await expect(dialog.locator("[data-affiliate-disclosure]")).toHaveText(disclosures.coupang);
      expect(await precedes(page, "dialog [data-affiliate-disclosure]", 'dialog a[rel~="sponsored"]')).toBe(true);
    }
    await expect(dialog).not.toContainText(PRICE_OR_CLAIM);
  });

  test("no product link is in the page until the dialog opens; Escape and 닫기 close it and return focus", async ({ page }) => {
    const data = trackData("delivered");
    const expected = recommendationsForView(viewOf(data, FIXTURE_NOW).revenue, featuredProducts, FIXTURE_NOW, RECOMMENDATION_PRESENTATION);
    expect(expected.length).toBeGreaterThan(0);
    await openResult(page, data);

    const block = page.locator('[data-recommended-products="delivered"]');
    const trigger = block.getByRole("button", { name: resultCopy.recommendationsOpen });
    await expect(trigger).toBeVisible();
    await expect(block.locator("a")).toHaveCount(0);

    await trigger.click();
    const dialog = page.getByRole("dialog", { name: OPERATOR_PICKS_LABEL });
    await expect(dialog.getByRole("link")).toHaveCount(expected.length);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(block.locator("a")).toHaveCount(0);

    await trigger.click();
    await dialog.getByRole("button", { name: resultCopy.recommendationsClose }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("where recommendations appear (S08)", () => {
  for (const state of STATES) {
    test(`${state}: a block exactly when the view and the item contexts allow one`, async ({ page }) => {
      const data = trackData(state);
      const view = viewOf(data, FIXTURE_NOW);
      const expected = recommendationsForView(view.revenue, featuredProducts, FIXTURE_NOW, RECOMMENDATION_PRESENTATION);
      await openResult(page, data);
      if (expected.length > 0 && view.revenue.recommendationContext !== null) {
        const block = page.locator(`[data-recommendation-slot] [data-recommended-products="${view.revenue.recommendationContext}"]`);
        await expect(block).toHaveCount(1);
      } else {
        await settled(page);
        await expect(page.locator("[data-recommended-products]")).toHaveCount(0);
      }
    });
  }

  test("after every validity span has ended, a result shows no recommendation block", async ({ page }) => {
    const data = trackData("delivered");
    const view = viewOf(data, LATE_NOW);
    expect(view.revenue.recommendations).not.toBe("none");
    expect(recommendationsForView(view.revenue, featuredProducts, LATE_NOW, RECOMMENDATION_PRESENTATION)).toEqual([]);
    await openResult(page, data, LATE_NOW);
    await settled(page);
    await expect(page.locator("[data-recommended-products]")).toHaveCount(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/recommendations.spec.ts`
Expected: FAIL — the two dialog tests fail (`getByRole('heading', { level: 2, name: '운영자 추천' })` not found: S07 still renders the legacy card), and "after every validity span has ended …" fails with `toHaveCount(0)` receiving `1` (the legacy card ignores validity). The per-state rows fail for the states where S07's bridge renders the legacy card with another hook value or where the new rule expects none; record the pass/fail split in the stage summary.

- [ ] **Step 4: Create `components/supplementary/RecommendationList.tsx`**

```tsx
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/primitives/Button";
import { ButtonLink } from "@/components/primitives/ButtonLink";
import { channels, resultCopy } from "@/config/site.config";
import type { SelectedRecommendation } from "@/lib/tracking/recommendations";
import type { RecommendationContext } from "@/lib/tracking/types";

/** Spec §16 item 10 "거절하면": the dialog stays, labelled '운영자 추천', without price, discount or review labels. */
const OPERATOR_PICKS_LABEL = "운영자 추천";

export interface RecommendationListProps {
  readonly context: RecommendationContext;
  readonly items: readonly SelectedRecommendation[];
  readonly disclosure: string;
}

/**
 * Recommendations after a settled result (spec §8 "추천"). Until approval 10 the operator's picks sit in a native modal
 * <dialog> the customer opens (focus is trapped and Escape closes it natively). The links exist only while it is open,
 * so a result carries exactly the store links its view allows, and the affiliate disclosure is the first line above them.
 */
export function RecommendationList({ context, items, disclosure }: RecommendationListProps): React.JSX.Element | null {
  const baseId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [open, setOpen] = useState(false);
  const titleId = `${baseId}-title`;
  const dialogTitleId = `${baseId}-dialog-title`;
  const triggerId = `${baseId}-open`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (items.length === 0) return null;
  const hasAffiliate = items.some((entry) => entry.item.isAffiliate);

  // Runs for Escape (native close) and for 닫기 (state → effect → close): state follows, focus goes back to the trigger.
  const handleClosed = (): void => {
    setOpen(false);
    document.getElementById(triggerId)?.focus();
  };

  return (
    <section
      data-recommended-products={context}
      aria-labelledby={titleId}
      className="flex flex-col gap-3 border-t-2 border-tt-ink bg-tt-surface px-[var(--tt-gutter)] py-4 text-tt-ink"
    >
      <h2 id={titleId} className="m-0 text-tt-lg font-bold [word-break:keep-all]">
        {OPERATOR_PICKS_LABEL}
      </h2>
      <Button id={triggerId} variant="secondary" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {resultCopy.recommendationsOpen}
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
        onClose={handleClosed}
        className="m-auto w-[calc(100%_-_2rem)] max-w-[480px] border-2 border-tt-ink bg-tt-surface p-0 text-tt-ink"
      >
        <div className="flex flex-col gap-3 p-5">
          <h2 id={dialogTitleId} className="m-0 text-tt-lg font-bold [word-break:keep-all]">
            {OPERATOR_PICKS_LABEL}
          </h2>
          {open ? (
            <>
              {hasAffiliate ? <p data-affiliate-disclosure="coupang">{disclosure}</p> : null}
              <ul className="m-0 flex list-none flex-col p-0">
                {items.map(({ item }) => (
                  <li key={item.id} className="flex flex-col gap-1 border-t border-tt-rule py-2">
                    <ButtonLink href={item.href} variant="text" external sponsored={item.isAffiliate} label={item.name} />
                    <span className="text-tt-xs text-tt-muted">{channels[item.channel].name}</span>
                  </li>
                ))}
              </ul>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {resultCopy.recommendationsClose}
              </Button>
            </>
          ) : null}
        </div>
      </dialog>
    </section>
  );
}
```

- [ ] **Step 5: Render it from `LookupController`**

Work in `components/lookup/LookupController.tsx`, using the lines recorded in Task 0 Step 10.

(a) In the one `import { … } from "@/config/site.config";` statement add `disclosures` and `featuredProducts` to the braces (keep the names already there, alphabetical order is not required). Below the last `@/lib/tracking/…` import add:

```tsx
import { RECOMMENDATION_PRESENTATION, recommendationsForView } from "@/lib/tracking/recommendations";
```

(b) Replace the whole statement that starts with `const LegacyRecommendedProducts = dynamic(` (S07 Task 8 Step 8 (b), with its doc comment line above it) with:

```tsx
/** The recommendation block (spec §8) loads only when a settled result shows it; it is never part of the first paint. */
const RecommendationList = dynamic(
  () => import("@/components/supplementary/RecommendationList").then((module) => module.RecommendationList),
  { ssr: false }
);
```

(c) Replace the whole statement that starts with `const renderRecommendations = (view: TrackingViewModel, outcome: LookupOutcome): React.ReactNode =>` (it ends with `) : null;`) with:

```tsx
  // Spans and price dates are judged at the customer's clock snapshot (S06 session.ts), never with a clock read in render.
  const renderRecommendations = (view: TrackingViewModel): React.ReactNode => {
    const context = view.revenue.recommendationContext;
    if (clientNowMs === null || context === null) return null;
    const items = recommendationsForView(view.revenue, featuredProducts, new Date(clientNowMs), RECOMMENDATION_PRESENTATION);
    return items.length === 0 ? null : <RecommendationList context={context} items={items} disclosure={disclosures.coupang} />;
  };
```

(d) If `LookupOutcome` is now unused in the file (`Select-String -Path components/lookup/LookupController.tsx -Pattern 'LookupOutcome'` prints only the import line), remove it from that type import.

Run: `Select-String -Path components/lookup/LookupController.tsx -Pattern 'RecommendedProducts|LegacyRecommended'`
Expected: no output.

- [ ] **Step 6: Delete the legacy component**

Run: `git grep -n "RecommendedProducts" -- app components lib tests`
Expected: hits only in `components/RecommendedProducts.tsx` itself (and `tests/e2e/result-a11y.spec.ts`'s comment or exclusion if approval 13 was granted earlier — Task 16 handles that file).
Run: `git rm components/RecommendedProducts.tsx`
Run: `npm run typecheck; npx eslint components/supplementary components/lookup/LookupController.tsx tests/e2e/recommendations.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 7: Run the tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/recommendations.spec.ts tests/e2e/result-states.spec.ts tests/e2e/cta-consistency.spec.ts tests/e2e/result-layout.spec.ts`
Expected: 0 failed. `recommendations.spec.ts` shows `11 passed` (2 dialog + 8 states + 1 late clock). S07's `result-states.spec.ts` still finds `[data-recommended-products="pending"|"inTransit"|"delivered"]` visible after 처리 내역 / `[data-primary-end]` and none under overdue; S04's `cta-consistency.spec.ts` still counts one block exactly where `view.revenue.recommendations === "inline"` (no shipped item opts into the optional states) and the same store links as before (the dialog's links are not in the page while it is closed).
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/module-boundaries.spec.ts tests/unit/result-module.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed (`LookupController` reaches `lib/tracking/recommendations.ts` and the config statically — no zod, derive or result-view code; the list itself loads through `import()`).

- [ ] **Step 8: Commit**

Run: `git add components/supplementary/RecommendationList.tsx components/lookup/LookupController.tsx tests/e2e/recommendations.spec.ts tests/e2e/RULE-MAP.md; git commit -m "feat: show the operator's picks after the result and drop the legacy recommendation card"`
(`git rm` in Step 6 already staged the deletion of `components/RecommendedProducts.tsx`.)

---

### Task 4: The home store showcase

**Files:**
- Create: `components/supplementary/StoreShowcase.tsx`
- Modify: `components/shell/TrackingPage.tsx` (the `StorefrontShowcase` import; the `IdleExtras` function and its doc comment)
- Delete: `components/StorefrontShowcase.tsx`
- Modify: `tests/e2e/cta-consistency.spec.ts`, `tests/e2e/status-slot.spec.ts` (the legacy showcase hook only)
- Modify: `tests/e2e/RULE-MAP.md` (two rows; one status cell of S06's row S1)
- Test: `tests/e2e/ad-placement.spec.ts` (create)

**Interfaces:**
- Consumes: `AffiliateLinkGroup({ stores: StoreLinksView, layout?: "row" | "stack" })` (S05; first child `<p data-affiliate-disclosure="coupang">` when a link is affiliate; links carry `data-link-placement={placement}`, `target=_blank`, `rel` from `isAffiliate`, name `${label} 새 창으로 열기`); `channels`, `disclosures`, `lookup.copy.typicalSummary` (S03 config); `resultCopy.showcaseTitle` (Task 2); `StoreChannelId` (S03 `lib/config/types.ts`), `StoreLinksView` (S03); S06's `TrackingPage` idle extras (`TypicalDurations` first).
- Produces: `StoreShowcase(): React.JSX.Element` (contract §11.9) with root `section[data-store-showcase="true"]` (Addition 9), a level-2 heading and one `AffiliateLinkGroup` of placement `showcase`; rendered only in idle mode through `idleExtras`.

- [ ] **Step 1: Write the rule → assertion rows first**

Append to the S08 table at the end of `tests/e2e/RULE-MAP.md` (directly below the S08-1 row):

```markdown
| S08-2 | 홈은 투명한 스토어 선택지 — 쇼케이스 부분 (S06 row S1 "showcase part kept → S08"; §4 첫 화면 아래, §8 고지 선행) | tracking.spec › "home offers transparent storefront choices without interrupting tracking" (showcase heading, links and disclosure; the file was deleted by S07) | ad-placement › "home store showcase (S08)" ×4 | migrated (Task 4) |
| S08-3 | 오류·결과 화면에는 쇼케이스 없음; 조회 전 홈에는 있음 (§8 표) | cta-consistency › "the idle page keeps its store shortcuts" and "…: no store, showcase, popup, recommendation or sponsored link anywhere on the page"; status-slot › error rows — all selecting the legacy `[data-storefront-showcase]` | the same tests with `[data-store-showcase]` (selector only; no assertion or expected value changed); ad-placement › "the showcase is home-only …" ×3 | selectors migrated (Task 4) |
```

Then in S06's row `S1`, replace the text `showcase part kept → S08` with `showcase part migrated (S08-2)`.
Run: `Select-String -Path tests/e2e/RULE-MAP.md -Pattern 'S08-2|showcase part migrated' | ForEach-Object { $_.LineNumber }`
Expected: two line numbers (S06's row S1 and the new S08-2 row).

- [ ] **Step 2: Write the failing E2E test**

Create `tests/e2e/ad-placement.spec.ts`:

```ts
import { expect, test, type Locator, type Page } from "@playwright/test";
import { channels, disclosures, lookup, resultCopy } from "@/config/site.config";
import { FAKE, FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";

async function blockThirdParty(page: Page): Promise<void> {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
}

/** True when `first` comes before `second` in document order. */
async function isBefore(first: Locator, second: Locator): Promise<boolean> {
  const other = await second.elementHandle();
  if (other === null) return false;
  return first.evaluate((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0, other);
}

test.beforeEach(async ({ page }) => {
  await blockThirdParty(page);
  await page.clock.setFixedTime(FIXTURE_NOW);
});

test.describe("home store showcase (S08)", () => {
  test("below '보통 이렇게 걸려요': a heading, then the definitive disclosure, then the two store links", async ({ page }) => {
    await page.goto("/");
    const showcase = page.locator("[data-store-showcase]");
    await expect(showcase).toHaveCount(1);
    await expect(showcase.getByRole("heading", { level: 2, name: resultCopy.showcaseTitle })).toBeVisible();
    const typical = page.locator("details", { has: page.locator("summary", { hasText: lookup.copy.typicalSummary }) });
    expect(await isBefore(typical, showcase)).toBe(true);

    const group = showcase.locator('[data-affiliate-group="showcase"]');
    await expect(group.locator("p, a").first()).toHaveAttribute("data-affiliate-disclosure", "coupang");
    await expect(group.locator("[data-affiliate-disclosure]")).toHaveText(disclosures.coupang);
    await expect(group.getByRole("link")).toHaveCount(2);
  });

  test("each store link opens its showcase link in a new tab, and only the affiliate one is sponsored", async ({ page }) => {
    await page.goto("/");
    const group = page.locator('[data-store-showcase] [data-affiliate-group="showcase"]');
    for (const id of ["naver", "coupang"] as const) {
      const store = channels[id];
      const link = group.getByRole("link", { name: `${store.linkLabel} 새 창으로 열기` });
      await expect(link).toHaveAttribute("href", store.urls.showcase);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("data-link-placement", "showcase");
      await expect(link).toHaveAttribute("rel", store.isAffiliate ? "sponsored nofollow noopener noreferrer" : "noopener noreferrer");
    }
  });

  test("the showcase is a secondary block: the page keeps exactly one filled button", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-store-showcase] [data-slot="button"][data-variant="primary"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="button"][data-variant="primary"]')).toHaveCount(1);
  });

  test("the legacy showcase is gone", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-storefront-showcase], #storefront")).toHaveCount(0);
  });
});

test.describe("the showcase is home-only (S08)", () => {
  test("absent while a deep link is loading", async ({ page }) => {
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }), { delayMs: 20_000 });
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator("[data-loading-stage]")).toBeVisible();
    await expect(page.locator("[data-store-showcase]")).toHaveCount(0);
  });

  test("absent on a settled result", async ({ page }) => {
    await mockTrack(page, trackData("delivered", { trackingNumber: FAKE.domestic }));
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator("[data-result-view] h2")).toBeVisible();
    await expect(page.locator("[data-store-showcase]")).toHaveCount(0);
  });

  test("absent on an error", async ({ page }) => {
    await mockTrack(page, "notFound404");
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator('[data-result-view="error"]')).toBeVisible();
    await expect(page.locator("[data-store-showcase]")).toHaveCount(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/ad-placement.spec.ts`
Expected: `3 failed, 4 passed` — three home tests fail (`[data-store-showcase]` has count 0; the legacy `#storefront` section still exists); "the showcase is a secondary block …" and the three home-only rows pass already (they only assert the one-filled-button rule and absence) and keep guarding the rules.

- [ ] **Step 4: Create `components/supplementary/StoreShowcase.tsx`**

```tsx
import { AffiliateLinkGroup } from "@/components/primitives/AffiliateLinkGroup";
import { channels, disclosures, resultCopy } from "@/config/site.config";
import type { StoreChannelId } from "@/lib/config/types";
import type { StoreLinksView } from "@/lib/tracking/types";

const TITLE_ID = "store-showcase-title";
const STORE_ORDER: readonly StoreChannelId[] = ["naver", "coupang"];

function showcaseLinks(): StoreLinksView {
  const links = STORE_ORDER.map((id) => {
    const store = channels[id];
    return { channel: id, label: store.linkLabel, href: store.urls.showcase, isAffiliate: store.isAffiliate, weight: "secondary" as const };
  });
  return {
    placement: "showcase",
    intro: null,
    disclosure: links.some((link) => link.isAffiliate) ? disclosures.coupang : null,
    links
  };
}

/**
 * Home only, below '보통 이렇게 걸려요' (spec §4 "첫 화면 아래", §7 idle): the two stores behind the definitive disclosure.
 * A server component that TrackingPage passes as an idle extra, so it never shows in loading, result or error modes.
 */
export function StoreShowcase(): React.JSX.Element {
  return (
    <section
      data-store-showcase="true"
      aria-labelledby={TITLE_ID}
      className="flex flex-col gap-3 border-t-2 border-tt-ink bg-tt-surface px-[var(--tt-gutter)] py-6 text-tt-ink"
    >
      <h2 id={TITLE_ID} className="m-0 text-tt-lg font-bold [word-break:keep-all]">
        {resultCopy.showcaseTitle}
      </h2>
      <AffiliateLinkGroup stores={showcaseLinks()} layout="row" />
    </section>
  );
}
```

- [ ] **Step 5: Swap it into `TrackingPage`**

In `components/shell/TrackingPage.tsx`:
(a) Replace `import { StorefrontShowcase } from "@/components/StorefrontShowcase";` with `import { StoreShowcase } from "@/components/supplementary/StoreShowcase";`.
(b) Replace the whole `IdleExtras` function and the doc comment above it (S06: `/** Below the first view, idle mode only (spec §4 order): typical durations, then the showcase (S08 swaps in StoreShowcase). */` followed by the function that renders `<TypicalDurations />` and a `tt-legacy-dark` wrapper around `<StorefrontShowcase />`) with:

```tsx
/** Below the first view, idle mode only (spec §4 order): typical durations, then the store showcase. */
function IdleExtras(): React.JSX.Element {
  return (
    <>
      <div className="px-[var(--tt-gutter)] pb-6">
        <TypicalDurations />
      </div>
      <StoreShowcase />
    </>
  );
}
```

Run: `Select-String -Path components/shell/TrackingPage.tsx -Pattern 'StorefrontShowcase|tt-legacy-dark'`
Expected: no output.

- [ ] **Step 6: Run the new tests, then the old ones that select the legacy hook**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/ad-placement.spec.ts`
Expected: `7 passed`.
Run: `npx playwright test tests/e2e/cta-consistency.spec.ts tests/e2e/status-slot.spec.ts`
Expected: FAIL — `1 failed`: cta-consistency › "the idle page keeps its store shortcuts" (`[data-storefront-showcase]` resolves to 0 elements). The error rows still pass, but only because the legacy hook can no longer exist — Step 7 restores their meaning.

- [ ] **Step 7: Move the two S04 specs to the new hook**

In `tests/e2e/cta-consistency.spec.ts` and `tests/e2e/status-slot.spec.ts`, replace every `[data-storefront-showcase]` with `[data-store-showcase]` (replace all; nothing else changes).
Run: `Select-String -Path tests/e2e/cta-consistency.spec.ts, tests/e2e/status-slot.spec.ts -Pattern 'data-storefront-showcase'`
Expected: no output.
Run (port 43210 free): `npx playwright test tests/e2e/cta-consistency.spec.ts tests/e2e/status-slot.spec.ts tests/e2e/home.spec.ts`
Expected: 0 failed (production-only tests skipped).

- [ ] **Step 8: Delete the legacy showcase**

Run: `git grep -n "StorefrontShowcase\|data-storefront-showcase" -- app components lib tests`
Expected: hits only in `components/StorefrontShowcase.tsx` itself.
Run: `git rm components/StorefrontShowcase.tsx`
Run: `npm run typecheck; npx eslint components/supplementary components/shell/TrackingPage.tsx tests/e2e/ad-placement.spec.ts tests/e2e/cta-consistency.spec.ts tests/e2e/status-slot.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 9: Commit**

Run: `git add components/supplementary/StoreShowcase.tsx components/shell/TrackingPage.tsx tests/e2e/ad-placement.spec.ts tests/e2e/cta-consistency.spec.ts tests/e2e/status-slot.spec.ts tests/e2e/RULE-MAP.md; git commit -m "feat: add the home store showcase with the disclosure first and retire the legacy showcase"`

---

### Task 5: The new footer

**Files:**
- Create: `components/shell/SiteFooter.tsx`
- Modify: `app/(public)/layout.tsx` (whole file)
- Delete: `components/SiteFooter.tsx`
- Modify: `tests/e2e/RULE-MAP.md` (one row)
- Test: `tests/e2e/ad-placement.spec.ts` (append)

**Interfaces:**
- Consumes: `TalkLink({ href, label, weight, placement })` (S05; name `${label} 새 창으로 열기`, `data-link-placement`); `channels.talk.url`, `channels.talk.labels.footer` '톡톡 상담' (S03); `resultCopy.footerNote` (Task 2); S06's `SiteHeader`, S04's `LiveAnnouncerProvider`, S02's `AdLoader`.
- Produces: `SiteFooter(): React.JSX.Element` (contract §11.9, server) — `<footer>` (the page's `contentinfo`) with the note, the '개인정보처리방침' link (`/privacy`) and one 톡톡 `TalkLink` (placement `footer`); `app/(public)/layout.tsx` renders header → page → footer → loader inside the live-region provider.

- [ ] **Step 1: Write the rule → assertion row first**

Append to the S08 table at the end of `tests/e2e/RULE-MAP.md`:

```markdown
| S08-4 | 푸터: 개인정보처리방침 링크와 톡톡 한 곳, 톡톡은 화면당 최대 3곳 (§8 문의, §12 3.2.6) | privacy.spec › "privacy policy is reachable from the footer and explains the no-storage rule" (footer link part — kept unchanged) | ad-placement › "footer (S08)" ×4 | added (Task 5); privacy.spec kept |
```

- [ ] **Step 2: Write the failing E2E test**

Append to `tests/e2e/ad-placement.spec.ts`:

```ts
test.describe("footer (S08)", () => {
  for (const route of [
    { name: "home", path: "/" },
    { name: "privacy", path: "/privacy" }
  ] as const) {
    test(`${route.name}: the footer carries the note, '개인정보처리방침' and one 톡톡 link`, async ({ page }) => {
      await page.goto(route.path);
      const footer = page.getByRole("contentinfo");
      await expect(footer).toHaveCount(1);
      await expect(footer.getByText(resultCopy.footerNote)).toBeVisible();
      await expect(footer.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute("href", "/privacy");
      const talk = footer.getByRole("link", { name: `${channels.talk.labels.footer} 새 창으로 열기` });
      await expect(talk).toHaveAttribute("href", channels.talk.url);
      await expect(talk).toHaveAttribute("data-link-placement", "footer");
      await expect(footer.locator(`a[href="${channels.talk.url}"]`)).toHaveCount(1);
    });
  }

  test("톡톡 appears at most three times on a result screen: header, one state place, footer", async ({ page }) => {
    await mockTrack(page, trackData("pending", { trackingNumber: FAKE.domestic }));
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator("[data-result-view] h2")).toBeVisible();
    const talkLinks = page.locator(`a[href="${channels.talk.url}"]`);
    expect(await talkLinks.count()).toBeLessThanOrEqual(3);
    await expect(page.getByRole("contentinfo").locator(`a[href="${channels.talk.url}"]`)).toHaveCount(1);
  });

  test("톡톡 appears at most three times on an error screen", async ({ page }) => {
    await mockTrack(page, "notFound404");
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator('[data-result-view="error"]')).toBeVisible();
    expect(await page.locator(`a[href="${channels.talk.url}"]`).count()).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/ad-placement.spec.ts -g "footer"`
Expected: FAIL — the two page rows fail on `getByText(resultCopy.footerNote)` (the legacy footer has another sentence) and on the 톡톡 name (`톡톡으로 문의하기 새 창으로 열기` in the legacy footer); the two count rows pass already (the legacy footer also has one 톡톡 link) and keep guarding the rule.

- [ ] **Step 4: Create `components/shell/SiteFooter.tsx`**

```tsx
import Link from "next/link";
import { TalkLink } from "@/components/primitives/TalkLink";
import { channels, resultCopy } from "@/config/site.config";

/** Existing E2E wording: tests/privacy.spec.ts reaches the policy through the footer link with this name. */
const PRIVACY_LINK_LABEL = "개인정보처리방침";

/**
 * Public footer (spec §8 문의, §14 "app/(public)/layout.tsx: 헤더, 푸터"): where the data comes from, the privacy policy,
 * and the third of at most three 톡톡 places on a screen (header, one state place, footer).
 */
export function SiteFooter(): React.JSX.Element {
  return (
    <footer className="border-t border-tt-rule bg-tt-surface text-tt-ink">
      <div className="mx-auto flex w-full max-w-[var(--tt-column)] flex-col gap-2 px-[var(--tt-gutter)] py-6">
        <p className="m-0 text-tt-xs text-tt-muted [word-break:keep-all]">{resultCopy.footerNote}</p>
        <div className="flex flex-wrap items-center gap-x-6">
          <Link
            href="/privacy"
            className="tt-focus inline-flex min-h-[44px] items-center text-tt-sm font-bold text-tt-link underline decoration-2 underline-offset-[5px]"
          >
            {PRIVACY_LINK_LABEL}
          </Link>
          <TalkLink href={channels.talk.url} label={channels.talk.labels.footer} weight="text" placement="footer" />
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 5: Replace `app/(public)/layout.tsx`**

Replace the whole file with the block below. If a later-merged stage added elements to this file (S11's `<Analytics />` under approval 13, or a `metadata` export), keep them in the same order around the new elements and note it in the stage summary.

```tsx
import { AdLoader } from "@/components/ads/AdLoader";
import { LiveAnnouncerProvider } from "@/components/primitives/LiveAnnouncer";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteHeader } from "@/components/shell/SiteHeader";

/**
 * Public pages: /, /{번호}, /privacy (spec §14 "app/(public)/layout.tsx: 헤더, 푸터, live region·AdLoader 자리").
 * The one polite live region exists here before any announcement (spec §5). The AdSense loader stays last and fail-closed (S02).
 */
export default function PublicLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <LiveAnnouncerProvider>
      <SiteHeader />
      {children}
      <SiteFooter />
      <AdLoader />
    </LiveAnnouncerProvider>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/ad-placement.spec.ts tests/privacy.spec.ts tests/e2e/home.spec.ts tests/e2e/url-privacy.spec.ts tests/e2e/internal-isolation.spec.ts`
Expected: 0 failed. `ad-placement.spec.ts` `11 passed`; `privacy.spec.ts` still finds the footer link '개인정보처리방침' → `/privacy`; S06's header tests are unchanged; S02's and S01's loader tests are unchanged (the loader is still the layout's last element).

- [ ] **Step 7: Delete the legacy footer**

Run: `git grep -n "components/SiteFooter\"" -- app components lib tests`
Expected: no output.
Run: `git rm components/SiteFooter.tsx`
Run: `npm run typecheck; npx eslint components/shell/SiteFooter.tsx "app/(public)/layout.tsx" tests/e2e/ad-placement.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 8: Commit**

Run: `git add components/shell/SiteFooter.tsx "app/(public)/layout.tsx" tests/e2e/ad-placement.spec.ts tests/e2e/RULE-MAP.md; git commit -m "feat: add the token footer with the privacy link and one 톡톡 place"`

---

### Task 6: The privacy page on the shared shell; the last legacy pieces go

**Files:**
- Modify: `app/(public)/privacy/page.tsx` (two import lines; the `PrivacyPolicyPage` function)
- Modify: `components/StoreContactPopup.tsx` (only if it exists — S06 Task 7F ran; the import and three constants)
- Modify: `app/globals.css` (delete the legacy band and legacy classes)
- Delete: `components/AnimatedIcon.tsx`, `lib/storefront.ts`
- Test: `tests/privacy.spec.ts` (imports, append), `tests/unit/recommendations.spec.ts` (imports, append)

**Interfaces:**
- Consumes: `TalkLink` (S05); `channels.talk.url`, `channels.talk.labels.cta` '톡톡으로 문의하기' (S03); S02's policy constants in the page (`LAST_UPDATED`, `PREVIOUS_EFFECTIVE_DATE`, `AD_URL_SENTENCE`, `sections`) — unchanged; S06's `.tt-legacy-dark` band and legacy classes in `app/globals.css`.
- Produces: `/privacy` rendered from tokens with the contact as `TalkLink` (placement `state`, the page's one state place: header + page + footer = 3); no `.tt-legacy-dark`, `.section-title`, `.section-copy`, `.brand-panel` anywhere; `components/AnimatedIcon.tsx` and `lib/storefront.ts` deleted (all five legacy files of roadmap §10 now gone).

- [ ] **Step 1: Write the failing tests**

In `tests/privacy.spec.ts`, add below the existing import lines:

```ts
import { channels } from "@/config/site.config";
```

Append to the end of `tests/privacy.spec.ts`:

```ts
test("the privacy page sits on the token shell with the configured 톡톡 contact (S08)", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.locator(".tt-legacy-dark, .brand-panel, .section-title")).toHaveCount(0);
  const main = page.locator("main#main-content");
  const colors = await main.evaluate((element) => {
    const probe = (value: string): string => {
      const span = document.createElement("span");
      span.style.color = value;
      document.body.append(span);
      const rgb = getComputedStyle(span).color;
      span.remove();
      return rgb;
    };
    const root = getComputedStyle(document.documentElement);
    return {
      surface: probe(root.getPropertyValue("--tt-surface").trim()),
      ink: probe(root.getPropertyValue("--tt-ink").trim()),
      background: getComputedStyle(element).backgroundColor,
      color: getComputedStyle(element).color
    };
  });
  expect(colors.background).toBe(colors.surface);
  expect(colors.color).toBe(colors.ink);
  const contact = main.getByRole("link", { name: `${channels.talk.labels.cta} 새 창으로 열기` });
  await expect(contact).toHaveAttribute("href", channels.talk.url);
  await expect(contact).toHaveAttribute("target", "_blank");
  await expect(contact).toHaveAttribute("data-link-placement", "state");
});
```

In `tests/unit/recommendations.spec.ts`, replace `import { readFileSync } from "node:fs";` with `import { existsSync, readFileSync, readdirSync } from "node:fs";` and append:

```ts
test.describe("legacy supplementary pieces are gone (S08)", () => {
  const LEGACY_FILES = [
    "components/RecommendedProducts.tsx",
    "components/StorefrontShowcase.tsx",
    "components/SiteFooter.tsx",
    "components/AnimatedIcon.tsx",
    "lib/storefront.ts"
  ] as const;
  const LEGACY_MENTION = /@\/lib\/storefront|AnimatedIcon|RecommendedProducts|StorefrontShowcase|@\/components\/SiteFooter"|tt-legacy-dark|data-storefront-showcase|\.brand-panel|\.section-title|\.section-copy/;

  function sourceFiles(dir: string): string[] {
    return readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
      const relative = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return sourceFiles(relative);
      return /\.(ts|tsx|css)$/.test(entry.name) ? [relative] : [];
    });
  }

  test("the five legacy files are deleted", () => {
    expect(LEGACY_FILES.filter((file) => existsSync(path.join(REPO_ROOT, file)))).toEqual([]);
  });

  test("no app, component, library or config file mentions them or the legacy band", () => {
    const offenders = ["app", "components", "lib", "config"]
      .flatMap(sourceFiles)
      .filter((file) => LEGACY_MENTION.test(readFileSync(path.join(REPO_ROOT, file), "utf8")));
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/recommendations.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `2 failed, 15 passed` — `components/AnimatedIcon.tsx` and `lib/storefront.ts` still exist; the mention scan lists `app/(public)/privacy/page.tsx` (storefront import, legacy classes), `app/globals.css` (`.tt-legacy-dark` and the legacy classes), `lib/storefront.ts`, `components/AnimatedIcon.tsx` and, after S06 Task 7F, `components/StoreContactPopup.tsx`.
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/privacy.spec.ts -g "token shell"`
Expected: FAIL — `toHaveCount(0)` for `.tt-legacy-dark, .brand-panel, .section-title` receives `3` (S06's band on `<main>`, S02's article and title).

- [ ] **Step 3: Put the privacy page on the shell**

In `app/(public)/privacy/page.tsx`:
(a) Delete the line `import { ArrowLeft } from "lucide-react";`.
(b) Replace the line `import { TALK_URL } from "@/lib/storefront";` with:

```ts
import { TalkLink } from "@/components/primitives/TalkLink";
import { channels } from "@/config/site.config";
```

(c) Replace everything from the line `export default function PrivacyPolicyPage() {` to the end of the file with the block below. The `metadata`, `LAST_UPDATED`, `PREVIOUS_EFFECTIVE_DATE`, `AD_URL_SENTENCE` and `sections` declarations above it stay exactly as S02 wrote them. If the function contains an element this block does not have (for example S11's analytics paragraph under approval 13), keep it at the same position and note it in the stage summary.

```tsx
export default function PrivacyPolicyPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-[var(--tt-column)] bg-tt-surface px-[var(--tt-gutter)] py-8 text-tt-ink outline-none"
    >
      <Link
        href="/"
        className="tt-focus inline-flex min-h-[44px] items-center text-tt-sm font-bold text-tt-link underline decoration-2 underline-offset-[5px]"
      >
        배송 조회로 돌아가기
      </Link>

      <article className="mt-4 flex flex-col gap-6">
        <header className="flex flex-col gap-2 border-b-2 border-tt-ink pb-4">
          <h1 className="m-0 text-tt-xl font-black [word-break:keep-all]">tracking.tipoasis.com 개인정보처리방침</h1>
          <p className="m-0 text-tt-sm text-tt-muted">시행일: {LAST_UPDATED}</p>
          <p className="m-0 text-tt-md [word-break:keep-all]">
            이 서비스는 구매 고객이 통관과 국내 배송 상태를 조회할 수 있도록 운영자가 제공하는 무료 조회 도구입니다.
            개인정보 최소 수집 원칙에 따라 조회에 필요한 번호 외에는 어떤 정보도 요구하지 않습니다.
          </p>
        </header>

        {sections.map((section) => (
          <section key={section.title} aria-labelledby={section.title} className="flex flex-col gap-3">
            <h2 id={section.title} className="m-0 text-tt-lg font-bold">
              {section.title}
            </h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="m-0 text-tt-sm leading-6 [word-break:keep-all]">
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <section aria-labelledby="privacy-contact" className="flex flex-col gap-3">
          <h2 id="privacy-contact" className="m-0 text-tt-lg font-bold">
            8. 문의 채널
          </h2>
          <p className="m-0 text-tt-sm leading-6 [word-break:keep-all]">개인정보 관련 문의는 네이버 톡톡으로 남겨 주세요.</p>
          <div>
            <TalkLink href={channels.talk.url} label={channels.talk.labels.cta} weight="secondary" placement="state" />
          </div>
        </section>
      </article>
    </main>
  );
}
```

Run: `Select-String -LiteralPath "app/(public)/privacy/page.tsx" -Pattern 'storefront|TALK_URL|ArrowLeft|brand-panel|section-(kicker|title|copy)|tt-legacy-dark'`
Expected: no output.

- [ ] **Step 4: Move the collapsed popup off `lib/storefront.ts` (only after S06 Task 7F)**

Run: `Test-Path components/StoreContactPopup.tsx`
If `False`, skip to Step 5. If `True`:
(a) Replace `import { COUPANG_STORE_URL, NAVER_STORE_URL, TALK_URL } from "@/lib/storefront";` with `import { channels } from "@/config/site.config";`.
(b) Replace every `NAVER_STORE_URL` with `channels.naver.urls.showcase`, every `COUPANG_STORE_URL` with `channels.coupang.urls.showcase`, and every `TALK_URL` with `channels.talk.url` (replace all; these are exactly the values `lib/storefront.ts` re-exported since S03).
Run: `Select-String -Path components/StoreContactPopup.tsx -Pattern 'storefront|NAVER_STORE_URL|COUPANG_STORE_URL|TALK_URL'`
Expected: no output.

- [ ] **Step 5: Delete the two legacy modules**

Run: `git grep -n -e "@/lib/storefront" -e "AnimatedIcon" -- app components lib tests`
Expected: hits only inside `lib/storefront.ts` and `components/AnimatedIcon.tsx` themselves.
Run: `git rm components/AnimatedIcon.tsx lib/storefront.ts`

- [ ] **Step 6: Remove the legacy band and classes from `app/globals.css`**

In `app/globals.css` (S06 Task 9 version):
1. Delete the comment that starts with `/*` and contains `과도기 띠(S06 → S07·S08)` together with the `.tt-legacy-dark { … }` rule below it.
2. Delete the comment `/* 옛 부품 전용 글자·패널 모양 — 과도기 띠 안에서만 쓰입니다. 사용하는 부품을 지우는 단계가 함께 지웁니다. */` and the rules `.section-title { … }`, `.section-copy { … }` and `.brand-panel { … }`.
3. If `components/StoreContactPopup.tsx` does **not** exist, also delete `.section-kicker { … }`, `.brand-icon-tile { … }` and the whole `@media (min-width: 640px) { .section-kicker { … } }` block. If it **does** exist (S06 Task 7F), keep those three and the `.store-quick-link …`/`.contact-popup-position` block, and put this comment directly above `.section-kicker`: `/* 승인 1 대체안(S06 Task 7F)의 접힌 상담·스토어 팝업 전용 — 팝업을 지우는 단계가 함께 지웁니다. */`

Run: `Select-String -Path app/globals.css -Pattern 'tt-legacy-dark|section-title|section-copy|brand-panel'`
Expected: no output.
Run (only when the popup does not exist): `Select-String -Path app/globals.css -Pattern 'section-kicker|brand-icon-tile|store-quick-link'`
Expected: no output.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/recommendations.spec.ts tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed (`recommendations.spec.ts` `17 passed`).
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/privacy.spec.ts tests/e2e/ad-placement.spec.ts tests/e2e/home.spec.ts`
Expected: 0 failed — every S01/S02 privacy test still passes (the 시행일 line, the eight disclosures, '8. 문의 채널', the no-storage sentence, the footer link and `link { name: "톡톡으로 문의하기" }` with `target=_blank`, which now matches the `TalkLink` name '톡톡으로 문의하기 새 창으로 열기').
Run: `npm run typecheck; npm run lint`
Expected: both exit 0, no new warnings.

- [ ] **Step 8: Commit**

Run: `git add "app/(public)/privacy/page.tsx" app/globals.css tests/privacy.spec.ts tests/unit/recommendations.spec.ts; git add -u components/StoreContactPopup.tsx; git commit -m "refactor: move the privacy page onto the token shell and delete the last legacy supplementary pieces"`
(`git rm` in Step 5 already staged the two deletions; `git add -u` on a missing popup file is a no-op.)

---

### Task 7: One manual ad slot before the footer

**Files:**
- Modify: `lib/ads/ad-gate.ts` (append)
- Create: `components/ads/useAdGateState.ts`, `components/ads/ManualAdSlot.tsx`
- Modify: `components/lookup/LookupController.tsx` (imports; two lines after `currentView`; one JSX line)
- Modify: `app/globals.css` (append `scroll-padding-bottom`)
- Modify: `app/(internal)/internal/ui-kit/page.tsx` (import; render `<AdSlotSection />`; append the section)
- Modify: `tests/unit/real-number-guard.spec.ts` (the `EXTRA_ALLOWED` constant; append one test)
- Test: `tests/unit/ad-gate.spec.ts` (imports, append), `tests/e2e/ad-placement.spec.ts` (imports, append)

**Interfaces:**
- Consumes: `AdGateInput`, `AdTimingPolicy`, `AD_TIMING_POLICY`, `shouldInsertAdLoader` (S02 `lib/ads/ad-gate.ts`); `getAdSignals`, `subscribeAdSignals` (S02 `lib/ads/ad-signals.ts`); `ADSENSE_CLIENT_ID` (S01 `lib/site.ts`); `ads` (`manualSlotId`, `minHeightMobilePx` 280, `minHeightDesktopPx` 250, `anchorReservePx` 64), `resultCopy.adSlotLabel` (config); `ViewMode` (S03); `--tt-anchor-reserve` (S05 tokens, 64px); S06/S07 `LookupController` names `viewMode`, `currentView`, `entry`, `idleExtras`; S05 gallery `Section`; `INTERNAL_TEST_CREDENTIALS` (`tests/internal-auth.ts`); S01 guard's `EXTRA_ALLOWED` and `findDisallowedDigitRuns`.
- Produces (contract §11.9 + Additions 4, 5): `adGateState(input: AdGateInput): AdGateState`, `manualSlotMode(input): ManualSlotMode`, `useAdGateState(serverEntry): AdGateState`, `ManualAdSlot({ allowed, slotId }): React.JSX.Element | null` — `<aside data-ad-slot="manual" aria-label="광고">` with the reserved min-height; `<ins class="adsbygoogle">` and one `adsbygoogle.push({})` only while the gate is open. `LookupController` renders it once, last in its fragment. `html { scroll-padding-bottom: var(--tt-anchor-reserve) }`. Gallery demo `data-demo="manual-ad-slot"`.

- [ ] **Step 1: Write the failing unit tests**

In `tests/unit/ad-gate.spec.ts`:
(a) Replace `import { readFileSync } from "node:fs";` with `import { readFileSync, readdirSync } from "node:fs";`.
(b) Replace `import { AD_TIMING_POLICY, shouldInsertAdLoader } from "@/lib/ads/ad-gate";` with `import { AD_TIMING_POLICY, adGateState, manualSlotMode, shouldInsertAdLoader } from "@/lib/ads/ad-gate";`.
(c) Below the last import line add `import { ads } from "@/config/site.config";`.
(d) Append:

```ts
test.describe("adGateState and manualSlotMode (S08)", () => {
  const HOME: AdGateInput = {
    pathname: "/",
    entry: "home",
    scrub: "pending",
    resultAdsAllowed: null,
    scrolledPastLookup: false,
    policy: "afterScrub"
  };

  test("afterScrub: home is open at once; a deep link waits for its scrub, then opens; a failed scrub closes it", () => {
    expect(adGateState(HOME)).toBe("open");
    expect(adGateState({ ...HOME, entry: "deepLink" })).toBe("waiting");
    expect(adGateState({ ...HOME, entry: "deepLink", scrub: "scrubbed" })).toBe("open");
    expect(adGateState({ ...HOME, entry: "deepLink", scrub: "failed" })).toBe("closed");
  });

  test("neverOnNumberRoutes keeps deep-link documents closed; number and internal paths are always closed", () => {
    expect(adGateState({ ...HOME, policy: "neverOnNumberRoutes" })).toBe("open");
    expect(adGateState({ ...HOME, entry: "deepLink", scrub: "scrubbed", policy: "neverOnNumberRoutes" })).toBe("closed");
    expect(adGateState({ ...HOME, pathname: `/${FAKE.domestic}` })).toBe("closed");
    expect(adGateState({ ...HOME, pathname: "/internal/ui-kit" })).toBe("closed");
  });

  test("manualSlotMode: home and allowed results only; reserved while the gate waits, filled while it is open", () => {
    expect(manualSlotMode({ viewMode: "idle", resultAdsAllowed: null, gate: "open" })).toBe("filled");
    expect(manualSlotMode({ viewMode: "idle", resultAdsAllowed: null, gate: "waiting" })).toBe("reserved");
    expect(manualSlotMode({ viewMode: "idle", resultAdsAllowed: null, gate: "closed" })).toBe("none");
    expect(manualSlotMode({ viewMode: "settled", resultAdsAllowed: true, gate: "open" })).toBe("filled");
    expect(manualSlotMode({ viewMode: "settled", resultAdsAllowed: true, gate: "waiting" })).toBe("reserved");
    expect(manualSlotMode({ viewMode: "settled", resultAdsAllowed: false, gate: "open" })).toBe("none");
    expect(manualSlotMode({ viewMode: "settled", resultAdsAllowed: null, gate: "open" })).toBe("none");
    expect(manualSlotMode({ viewMode: "loading", resultAdsAllowed: true, gate: "open" })).toBe("none");
    expect(manualSlotMode({ viewMode: "error", resultAdsAllowed: null, gate: "open" })).toBe("none");
  });

  test("every style's --tt-anchor-reserve equals config.ads.anchorReservePx, and html keeps that scroll padding", () => {
    const stylesDir = path.join(process.cwd(), "app/styles");
    const files = readdirSync(stylesDir).filter((name) => name.endsWith(".css"));
    expect(files).toContain("tokens.css");
    for (const name of files) {
      const values = Array.from(readFileSync(path.join(stylesDir, name), "utf8").matchAll(/--tt-anchor-reserve\s*:\s*([^;]+);/g), (match) =>
        match[1].trim()
      );
      expect(values.length, name).toBeGreaterThan(0);
      for (const value of values) expect(value, name).toBe(`${ads.anchorReservePx}px`);
    }
    const globals = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
    expect(globals).toMatch(/html\s*\{[^}]*scroll-padding-bottom:\s*var\(--tt-anchor-reserve\)/);
  });
});
```

In `tests/unit/real-number-guard.spec.ts`:
(a) Below the last import line add `import { ads } from "@/config/site.config";`.
(b) Replace the two lines

```ts
/** S08 adds the manual ad slot id from config/site.config.ts (roadmap §10.4). */
const EXTRA_ALLOWED: readonly string[] = [];
```

with

```ts
/** The manual ad unit id from config/site.config.ts (approval 15) is the one real 10-digit value the repo may hold (S08). */
const EXTRA_ALLOWED: readonly string[] = ads.manualSlotId === null ? [] : [ads.manualSlotId];
```

(c) Append:

```ts
test("the configured manual ad unit id is the one extra allowed run (S08)", () => {
  const sample = "9".repeat(10);
  expect(findDisallowedDigitRuns(`data-ad-slot="${sample}"`)).toEqual([sample]);
  expect(findDisallowedDigitRuns(`data-ad-slot="${sample}"`, [sample])).toEqual([]);
  expect(EXTRA_ALLOWED).toEqual(ads.manualSlotId === null ? [] : [ads.manualSlotId]);
});
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ad-gate.spec.ts tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `ad-gate.spec.ts` — the four new tests fail (`adGateState is not a function` ×3; the scroll-padding assertion fails on `app/globals.css`); S02's seven tests pass. `real-number-guard.spec.ts` — all passed (the new test passes already: the guard function takes `extraAllowed` since S01, and `EXTRA_ALLOWED` now reads the config).

- [ ] **Step 3: Add the gate state and the slot rule to `lib/ads/ad-gate.ts`**

At the top of `lib/ads/ad-gate.ts`, below the existing imports, add:

```ts
import type { ViewMode } from "@/lib/tracking/types";
```

Append to the end of the file:

```ts
/**
 * The ad gate of one document (spec §8): "open" — the loader may go in and the manual slot may fill now; "waiting" — not
 * yet, but a confirmed scrub, an allowed result or a scroll to the showcase can still open it in this document;
 * "closed" — never in this document (number or internal path, failed scrub, or a policy that excludes it).
 */
export type AdGateState = "open" | "waiting" | "closed";

export function adGateState(input: AdGateInput): AdGateState {
  if (shouldInsertAdLoader(input)) return "open";
  const best: AdGateInput = {
    ...input,
    scrub: input.scrub === "pending" ? "scrubbed" : input.scrub,
    resultAdsAllowed: true,
    scrolledPastLookup: true
  };
  return shouldInsertAdLoader(best) ? "waiting" : "closed";
}

export type ManualSlotMode = "none" | "reserved" | "filled";

/**
 * The one manual slot before the footer (spec §8): on the home (idle) and on a result whose view allows ads; reserved
 * while the gate may still open, filled while it is open, absent while loading and in every problem state
 * ("문제 상태 광고 0" = manual slot 0 + no new loader).
 */
export function manualSlotMode(input: {
  readonly viewMode: ViewMode;
  readonly resultAdsAllowed: boolean | null;
  readonly gate: AdGateState;
}): ManualSlotMode {
  const allowedHere = input.viewMode === "idle" || (input.viewMode === "settled" && input.resultAdsAllowed === true);
  if (!allowedHere || input.gate === "closed") return "none";
  return input.gate === "open" ? "filled" : "reserved";
}
```

- [ ] **Step 4: Append the scroll padding to `app/globals.css`**

```css

/* 모바일 하단 광고(앵커)에 가린 마지막 줄도 스크롤해서 꺼낼 수 있게 합니다(spec §8, GAP4-07). 값은 config ads.anchorReservePx와 같습니다. */
html {
  scroll-padding-bottom: var(--tt-anchor-reserve);
}
```

- [ ] **Step 5: Run the unit tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ad-gate.spec.ts tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed (`ad-gate.spec.ts` `11 passed`).

- [ ] **Step 6: Write the failing E2E tests**

In `tests/e2e/ad-placement.spec.ts`:
(a) Replace `import { channels, disclosures, lookup, resultCopy } from "@/config/site.config";` with `import { ads, channels, disclosures, lookup, resultCopy } from "@/config/site.config";`.
(b) Below the last import line add `import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";`.
(c) Append:

```ts
const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";
const LOOKUP_ANOTHER_LABEL = "다른 번호 조회";

async function lookUp(page: Page, number: string): Promise<void> {
  const input = page.getByLabel(INPUT_LABEL, { exact: true });
  await input.fill(number);
  await input.press("Enter");
}

test.describe("manual ad slot (S08)", () => {
  test("html keeps scroll room for a bottom anchor equal to config.ads.anchorReservePx", async ({ page }) => {
    await page.goto("/");
    const padding = await page.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingBottom);
    expect(padding).toBe(`${ads.anchorReservePx}px`);
  });

  test("without an ad unit id no page renders a slot", async ({ page }) => {
    test.skip(ads.manualSlotId !== null, "an ad unit id is configured: the approval-15 rows below cover the live slot");
    await page.goto("/");
    await expect(page.locator("[data-store-showcase]")).toBeVisible();
    await expect(page.locator("[data-ad-slot]")).toHaveCount(0);
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }));
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator("[data-result-view] h2")).toBeVisible();
    await expect(page.locator("[data-ad-slot]")).toHaveCount(0);
  });
});

test.describe("manual ad slot with an ad unit id (S08, approval 15)", () => {
  test.skip(ads.manualSlotId === null, "approval 15: config.ads.manualSlotId is not set yet");

  test("home: one slot after the showcase and before the footer, reserving the configured height", async ({ page }) => {
    for (const [width, reserved] of [
      [375, ads.minHeightMobilePx],
      [1280, ads.minHeightDesktopPx]
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const slot = page.locator('aside[data-ad-slot="manual"]');
      await expect(slot).toHaveCount(1);
      await expect(slot).toHaveAccessibleName(resultCopy.adSlotLabel);
      expect(await isBefore(page.locator("[data-store-showcase]"), slot)).toBe(true);
      expect(await isBefore(slot, page.getByRole("contentinfo"))).toBe(true);
      expect(Math.round((await slot.boundingBox())?.height ?? 0)).toBeGreaterThanOrEqual(reserved);
    }
  });

  test("an allowed result gets one slot after the result area; loading and a problem result get none", async ({ page }) => {
    await page.goto("/");
    await mockTrack(page, trackData("delivered", { trackingNumber: FAKE.domestic }), { delayMs: 2_000 });
    await lookUp(page, FAKE.domestic);
    await expect(page.locator("[data-loading-stage]")).toBeVisible();
    await expect(page.locator("[data-ad-slot]")).toHaveCount(0);
    await expect(page.locator("[data-result-view] h2")).toBeVisible();
    const slot = page.locator('aside[data-ad-slot="manual"]');
    await expect(slot).toHaveCount(1);
    expect(await isBefore(page.locator("[data-result-view]"), slot)).toBe(true);

    await mockTrack(page, "notFound404");
    await page.getByRole("button", { name: LOOKUP_ANOTHER_LABEL }).click();
    await lookUp(page, FAKE.domesticAlt);
    await expect(page.locator('[data-result-view="error"]')).toBeVisible();
    await expect(page.locator("[data-ad-slot]")).toHaveCount(0);
  });
});

test.describe("manual ad slot in the gallery (S08)", () => {
  test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

  test("the reserved box keeps its height when an ad fills it, and /internal never fills it", async ({ page }) => {
    for (const [width, reserved] of [
      [375, ads.minHeightMobilePx],
      [1280, ads.minHeightDesktopPx]
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/internal/ui-kit");
      const slot = page.locator('[data-demo="manual-ad-slot"] aside[data-ad-slot="manual"]');
      await expect(slot).toHaveAccessibleName(resultCopy.adSlotLabel);
      await expect(slot.locator("ins")).toHaveCount(0);
      const before = (await slot.boundingBox())?.height ?? 0;
      expect(Math.round(before)).toBe(reserved);
      await slot.evaluate((box, height) => {
        const filler = document.createElement("div");
        filler.style.height = `${height}px`;
        box.append(filler);
      }, ads.minHeightDesktopPx);
      const after = (await slot.boundingBox())?.height ?? 0;
      console.info(`[budget] manual slot fill at ${width}px: ${Math.round(before)} -> ${Math.round(after)} px (reserved ${reserved} px, shift 0 expected)`);
      expect(after).toBe(before);
    }
  });
});
```

- [ ] **Step 7: Run the E2E tests to verify they fail**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/ad-placement.spec.ts -g "manual ad slot"`
Expected: `1 failed, 2 passed, 2 skipped` — the gallery test fails (`[data-demo="manual-ad-slot"]` not found); the scroll-padding and no-id rows pass (Step 4 and the shipped `manualSlotId: null`); the two approval-15 rows are skipped.

- [ ] **Step 8: Create `components/ads/useAdGateState.ts`**

```ts
"use client";

import { useCallback, useSyncExternalStore } from "react";
import { AD_TIMING_POLICY, adGateState, type AdGateState } from "@/lib/ads/ad-gate";
import { getAdSignals, subscribeAdSignals } from "@/lib/ads/ad-signals";

function readGate(): AdGateState {
  return adGateState({ ...getAdSignals(), pathname: window.location.pathname, policy: AD_TIMING_POLICY });
}

/**
 * The ad gate of this document, re-read on every ad-signal change (scrub result, allowed result, scroll). The server has
 * no signals: a home render ('/' is static) is judged as a fresh home document, anything else as closed.
 */
export function useAdGateState(serverEntry: "home" | "deepLink" | null): AdGateState {
  const readServerGate = useCallback((): AdGateState => {
    if (serverEntry !== "home") return "closed";
    return adGateState({
      pathname: "/",
      entry: "home",
      scrub: "pending",
      resultAdsAllowed: null,
      scrolledPastLookup: false,
      policy: AD_TIMING_POLICY
    });
  }, [serverEntry]);
  return useSyncExternalStore(subscribeAdSignals, readGate, readServerGate);
}
```

- [ ] **Step 9: Create `components/ads/ManualAdSlot.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { ads, resultCopy } from "@/config/site.config";
import { ADSENSE_CLIENT_ID } from "@/lib/site";
import { useAdGateState } from "./useAdGateState";

type AdQueueWindow = Window & { adsbygoogle?: unknown[] };

/**
 * The one manual ad slot, right before the footer (spec §8). The box reserves its height before any fill (config.ads:
 * 280 px on phones, 250 px from 768 px) so a filled ad never shifts the page. The ad unit is inserted and requested only
 * while the ad gate is open (S02 candidate B and the ad-timing policy). `allowed` is the caller's placement decision.
 */
export function ManualAdSlot({
  allowed,
  slotId
}: {
  readonly allowed: boolean;
  readonly slotId: string | null;
}): React.JSX.Element | null {
  const gate = useAdGateState(null);
  const fill = allowed && slotId !== null && gate === "open";

  useEffect(() => {
    if (!fill) return;
    try {
      const queueWindow = window as AdQueueWindow;
      queueWindow.adsbygoogle = queueWindow.adsbygoogle ?? [];
      queueWindow.adsbygoogle.push({});
    } catch {
      // The loader reports its own errors; the reserved box simply stays empty.
    }
  }, [fill]);

  if (!allowed || slotId === null) return null;
  const reserve = {
    "--ad-min-mobile": `${ads.minHeightMobilePx}px`,
    "--ad-min-desktop": `${ads.minHeightDesktopPx}px`
  } as React.CSSProperties;
  return (
    <aside
      data-ad-slot="manual"
      aria-label={resultCopy.adSlotLabel}
      style={reserve}
      className="mx-auto block w-full max-w-[var(--tt-column)] min-h-[var(--ad-min-mobile)] md:min-h-[var(--ad-min-desktop)]"
    >
      {fill ? (
        <ins
          className="adsbygoogle block"
          data-ad-client={ADSENSE_CLIENT_ID}
          data-ad-slot={slotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : null}
    </aside>
  );
}
```

- [ ] **Step 10: Render the slot from `LookupController`**

In `components/lookup/LookupController.tsx`:
(a) Add `ads` to the braces of the `@/config/site.config` import. Below the `@/components/…` imports add:

```tsx
import { ManualAdSlot } from "@/components/ads/ManualAdSlot";
import { useAdGateState } from "@/components/ads/useAdGateState";
```

and below the `@/lib/ads/ad-signals` import add:

```tsx
import { manualSlotMode } from "@/lib/ads/ad-gate";
```

(b) Directly below the statement that starts with `const currentView =` (S07 Task 9 Step 5 (d)) add:

```tsx
  // The one manual slot before the footer (spec §8): home and allowed results only, never while loading or in a problem state.
  const adGate = useAdGateState(entry.kind === "home" ? "home" : "deepLink");
  const manualSlot = manualSlotMode({ viewMode, resultAdsAllowed: currentView?.revenue.adsAllowed ?? null, gate: adGate });
```

(c) Replace the line `      {viewMode === "idle" ? idleExtras : null}` with:

```tsx
      {viewMode === "idle" ? idleExtras : null}
      <ManualAdSlot allowed={manualSlot !== "none"} slotId={ads.manualSlotId} />
```

Run: `Select-String -Path components/lookup/LookupController.tsx -Pattern 'ManualAdSlot|manualSlotMode|useAdGateState' | ForEach-Object { $_.LineNumber }`
Expected: six line numbers — the three new imports, the `useAdGateState(` and `manualSlotMode(` statements, and the `<ManualAdSlot` line.

- [ ] **Step 11: Add the gallery demo**

In `app/(internal)/internal/ui-kit/page.tsx`:
(a) Add below the existing `@/components/primitives/…` imports:

```tsx
import { ManualAdSlot } from "@/components/ads/ManualAdSlot";
```

(b) Replace `        <CopySection />` with:

```tsx
        <CopySection />
        <AdSlotSection />
```

(c) Append to the end of the file:

```tsx
/** A fake ad unit id (0000 series): /internal never loads ads, so the gallery shows only the reserved box. */
const DEMO_AD_SLOT_ID = "0000000000";

function AdSlotSection(): React.JSX.Element {
  return (
    <Section id="ad-slot" title="수동 광고 자리">
      <div data-demo="manual-ad-slot" className="border-2 border-dashed border-tt-rule">
        <ManualAdSlot allowed slotId={DEMO_AD_SLOT_ID} />
      </div>
    </Section>
  );
}
```

- [ ] **Step 12: Run the tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/ad-placement.spec.ts tests/e2e/ui-kit.spec.ts tests/e2e/internal-isolation.spec.ts tests/e2e/url-privacy.spec.ts tests/e2e/result-states.spec.ts`
Expected: 0 failed; `ad-placement.spec.ts` `14 passed, 2 skipped` (the approval-15 rows); S05's gallery checks still pass with the new section (its only text is the section title); S01's isolation test still finds no ad marker in `app/(internal)/` (the gallery imports `ManualAdSlot`, which is not a marker) and no `<ins>` is created on `/internal`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0, no new warnings.

- [ ] **Step 13: Commit**

Run: `git add lib/ads/ad-gate.ts components/ads/useAdGateState.ts components/ads/ManualAdSlot.tsx components/lookup/LookupController.tsx app/globals.css "app/(internal)/internal/ui-kit/page.tsx" tests/unit/ad-gate.spec.ts tests/unit/real-number-guard.spec.ts tests/e2e/ad-placement.spec.ts; git commit -m "feat: reserve one manual ad slot before the footer and fill it only while the ad gate is open"`

---

### Task 8: CSS budget, the placement notes and the R3 checkpoint

**Files:**
- Create: `tests/budgets/css-budget.spec.ts`
- Modify: `DESIGN.md` (append section 13)
- Test: `tests/unit/ad-gate.spec.ts` (append one test)

**Interfaces:**
- Consumes: `IS_PRODUCTION_RUN` (S01), `FAKE` (S01), `AD_TIMING_POLICY` (S02), `ads`, `resultCopy` (config); the whole Part A.
- Produces: `[css-budget]` G8 lines for `/`, `/{번호}`, `/privacy` (Addition 10 basis); DESIGN.md §13 "보조 영역과 광고 시점" — the placement rules of Tasks 3–7 and, while approval 7 is not implemented, the known exception sentence '조회 전에 뜬 하단 광고는 오류 화면에 남을 수 있어요.' (pinned to `AD_TIMING_POLICY` by a unit test).

- [ ] **Step 1: Write the failing tests**

Create `tests/budgets/css-budget.spec.ts`:

```ts
import { gzipSync } from "node:zlib";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { FAKE } from "../fixtures/tracking-fixtures";
import { IS_PRODUCTION_RUN } from "../support/prod-mode";

/** Spec §12: CSS ≤ 25 KB — gzip -9 per stylesheet, summed, 1 KB = 1024 B (S08 Addition 10; the S07 JS-budget basis). */
const CSS_BUDGET_BYTES = 25 * 1024;
const LINK_TAG = /<link\b[^>]*>/g;

interface CssSize {
  readonly files: number;
  readonly raw: number;
  readonly gzip: number;
}

function stylesheetHrefs(html: string): readonly string[] {
  const hrefs = (html.match(LINK_TAG) ?? [])
    .filter((tag) => /\brel="stylesheet"/.test(tag))
    .map((tag) => /\bhref="([^"]+)"/.exec(tag)?.[1])
    .filter((href): href is string => href !== undefined);
  return [...new Set(hrefs)];
}

async function cssSize(request: APIRequestContext, path: string): Promise<CssSize> {
  const document = await request.get(path);
  expect(document.status(), path).toBe(200);
  const hrefs = stylesheetHrefs(await document.text());
  expect(hrefs.length, `${path}: stylesheets in the server HTML`).toBeGreaterThan(0);
  let raw = 0;
  let gzip = 0;
  for (const href of hrefs) {
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
    const body = await response.body();
    raw += body.length;
    gzip += gzipSync(body, { level: 9 }).length;
  }
  return { files: hrefs.length, raw, gzip };
}

test.describe("CSS budget (S08)", () => {
  test.skip(!IS_PRODUCTION_RUN, "budgets run against next start");

  for (const route of [
    { name: "'/'", path: "/" },
    { name: "'/{번호}'", path: `/${FAKE.domestic}` },
    { name: "'/privacy'", path: "/privacy" }
  ] as const) {
    test(`${route.name}: stylesheets stay within 25 KB (gzip -9)`, async ({ request }) => {
      const size = await cssSize(request, route.path);
      console.info(`[css-budget] ${route.name}: ${size.gzip} B gzip -9, ${size.raw} B raw, ${size.files} file(s) (max ${CSS_BUDGET_BYTES} B)`);
      expect(size.gzip).toBeLessThanOrEqual(CSS_BUDGET_BYTES);
    });
  }
});
```

Append to `tests/unit/ad-gate.spec.ts`:

```ts
test("DESIGN.md states the ad-timing exception exactly while approval 7 is not implemented (S08)", () => {
  const design = readFileSync(path.join(process.cwd(), "DESIGN.md"), "utf8");
  const exception = "조회 전에 뜬 하단 광고는 오류 화면에 남을 수 있어요.";
  expect(design.includes(exception)).toBe(AD_TIMING_POLICY !== "afterAllowedResult");
  expect(design).toContain("## 13. 보조 영역과 광고 시점");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ad-gate.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `1 failed, 11 passed` — `expect(received).toBe(expected)` (`Expected: true`, `Received: false`): DESIGN.md does not have the sentence yet.
Run (production run, see Conventions): `npm run build`, start the server, then `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test tests/budgets/css-budget.spec.ts`
Expected: `3 passed` with three `[css-budget]` lines — the budget test is new but the page already meets it; if any line is above 25600 B the test fails and names the route: remove unused CSS (the usual culprits are leftover legacy rules in `app/globals.css` and third-party `@font-face` blocks) before going on, and record the numbers. Stop the server and clear the flags.

- [ ] **Step 3: Append section 13 to `DESIGN.md`**

Append to the end of `DESIGN.md`:

````markdown

## 13. 보조 영역과 광고 시점

- **추천**(`components/supplementary/RecommendationList.tsx`, 규칙은 `lib/tracking/recommendations.ts`): 결과가 허용할 때만(`view.revenue.recommendations`가 `none`이 아닐 때) 결과 흐름 뒤에 둡니다. 배송 완료는 `data-primary-end` 바로 뒤, 그 밖에는 처리 내역 뒤입니다. 상품의 `contexts`에 그 상태가 있고 유효기간 안에 있을 때만 보이고, 0개면 묶음이 없습니다. 승인 10 전에는 '운영자 추천' 창으로만 열고 가격·할인·'이번 주'를 쓰지 않습니다. 승인 10 뒤에는 인라인 목록이고, 상품 상세 링크가 필수이며, '이번 주'는 유효기간 7일 이하, 가격은 확인일 7일 이내일 때만 씁니다.
- **쇼케이스**(`components/supplementary/StoreShowcase.tsx`, `data-store-showcase`): 홈 조회 전 화면에서만, '보통 이렇게 걸려요' 아래에 둡니다. 확정형 고지가 첫 줄이고 네이버·쿠팡 두 링크가 보조 무게로 옵니다.
- **수동 광고 자리**(`components/ads/ManualAdSlot.tsx`, `data-ad-slot="manual"`): 페이지당 1개, `<main>`의 마지막(푸터 묶음 바로 앞)입니다. 홈과 광고가 허용된 결과에서만 그리고, 높이를 미리 잡아 둡니다(휴대폰 280px, 768px 이상 250px, `config.ads`). 광고 단위 ID(`ads.manualSlotId`, 승인 15)가 없으면 그리지 않습니다. 조회 중과 문제 상태에는 없습니다.
- **하단 여백**: `html { scroll-padding-bottom: var(--tt-anchor-reserve) }`. 값은 `ads.anchorReservePx`(64px)와 같습니다.
- **푸터**(`components/shell/SiteFooter.tsx`): 안내 문장, '개인정보처리방침', 톡톡 한 곳(배치 `footer`). 톡톡은 화면당 최대 3곳입니다.
- **광고 시점**: 지금 정책은 `lib/ads/ad-gate.ts`의 `AD_TIMING_POLICY`입니다. 조회 전에 뜬 하단 광고는 오류 화면에 남을 수 있어요. 승인 7(결과가 허용 상태로 확정되거나 쇼케이스까지 스크롤한 뒤에만 넣기)이 기록되면 이 예외 문장을 지웁니다.
````

- [ ] **Step 4: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ad-gate.spec.ts tests/unit/tokens.spec.ts tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed (`ad-gate.spec.ts` `12 passed`; S05's DESIGN.md checks still pass — the new section adds no legacy word and no color row).

- [ ] **Step 5: Commit**

Run: `git add tests/budgets/css-budget.spec.ts tests/unit/ad-gate.spec.ts DESIGN.md; git commit -m "test: add the CSS budget and document the supplementary placement and ad-timing exception"`

- [ ] **Step 6: Part A in both modes**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test`
Expected: 0 failed (skips only for `PW_MODE`/`PW_SHOTS`/`PW_VISUAL`-guarded or approval-gated tests: the two approval-15 slot rows, and the dialog/inline describe that does not match `RECOMMENDATION_PRESENTATION`).
Run the production run of the whole suite (Conventions): `npx playwright test` with `PW_MODE=production`.
Expected: 0 failed, including `tests/budgets/css-budget.spec.ts` and S06/S07's HTML, LCP, CLS, JS and font budgets (Part A adds no web font, and the recommendation list stays out of the initial bundle).

- [ ] **Step 7: Record the Part A budget lines**

Copy the three `[css-budget]` lines and the two `[budget] manual slot fill …` lines into the stage summary, next to the unchanged `[js-budget]`, `[html-budget]`, `[lcp-budget]`, `[fcp-budget]`, `[cls-budget]` and `[font-budget]` lines from the production run.

- [ ] **Step 8: Decide the gated Part A tasks**

Read ledger rows 7 and 10 again (Task 0 Step 7). Run Task 9 if row 7 is `approved` (and row 6 is `approved`, see Task 9 Step 1), otherwise mark it SKIPPED with the fallback evidence (DESIGN.md §13 exception sentence, the `ad-gate.spec.ts` test that pins it). Run Task 10 if row 10 is `approved` and the operator has put product-detail links into `featuredProducts`, otherwise mark it SKIPPED with the fallback evidence (`recommendations.spec.ts` dialog rows passing).

- [ ] **Step 9: R3 checkpoint (only if the operator wants R3 before R3b)**

R3 = S05 + S06 + S07 + S08 Part A (roadmap §1). If the operator asks to release R3 now: run the standard gate G1–G12 (Task Final) on the current branch head with `PW_STAGE='S08A'` for the after-screens, hand over the summary, and after acceptance run on the integration branch `git merge --no-ff renewal/s08-supplementary-and-styles -m "merge: S08 Part A supplementary areas"` and `git branch release/r3 claude/tipoasis-tracking-renewal-ae0e3a` (the operator opens the PR `release/r3 → main`; no agent pushes to `main`). Then continue with Task 11 on the same stage branch; Task Final merges it again as `merge: S08 Part B selectable styles`. Otherwise go straight on.

---

### Task 9 (gated by approval 7): Load ads only after an allowed result or a scroll to the showcase

**Files:**
- Modify: `lib/ads/ad-gate.ts` (the doc-comment line about `"afterAllowedResult"`; the `AD_TIMING_POLICY` statement; the `"afterAllowedResult"` case)
- Create: `components/ads/ShowcaseReachedSignal.tsx`
- Modify: `components/shell/TrackingPage.tsx` (import; `IdleExtras`)
- Modify: `tests/unit/ad-gate.spec.ts` (replace two S02 tests; append one)
- Modify: `tests/e2e/internal-isolation.spec.ts` (the control test body)
- Modify: `DESIGN.md` (§13 last bullet), `tests/e2e/RULE-MAP.md` (one row)
- Test: `tests/e2e/ad-placement.spec.ts` (imports, append)

**Interfaces:**
- Consumes: `shouldInsertAdLoader`, `AdGateInput`, `AdTimingPolicy` (S02); `setAdSignals` (S02); S07's `handleView` in `LookupController`, which already calls `setAdSignals({ resultAdsAllowed: view.revenue.adsAllowed })` for every settled or failed view; `watchAdLoader`, `waitForIdle`, `AdLoaderInsertion` (S02 `tests/support/network-capture.ts`); `containsTrackingLikeValue` (S01); `StoreShowcase` (Task 4).
- Produces: `AD_TIMING_POLICY = "afterAllowedResult"` with the rule: home documents — an allowed result (`resultAdsAllowed === true`) or `scrolledPastLookup`; deep-link documents — `scrub === "scrubbed"` and an allowed result; any document — never while `resultAdsAllowed === false` (a problem result holds the loader; a later allowed result in the same tab inserts it once). `ShowcaseReachedSignal(): React.JSX.Element` (`div[data-ad-scroll-sentinel="showcase"]`, Addition 6). S02's privacy paragraph switches itself through `AD_URL_SENTENCE[AD_TIMING_POLICY]`.

- [ ] **Step 1: Confirm approval 7 is recorded in the roadmap approval ledger; if not, stop**

Run: `Select-String -Path docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md -Pattern '^\| 7 \|' | ForEach-Object { $_.Line }`
Expected: the row's Status column reads `approved`. If it reads `pending` or `rejected`, STOP and mark this task SKIPPED in the stage summary with the reason "approval 7 not granted". Fallback (spec §16 item 7 "거절하면"): the home keeps loading immediately, deep links load at scrub time (S02's policy stays), and the known exception '조회 전에 뜬 하단 광고는 오류 화면에 남을 수 있어요.' is documented in DESIGN.md §13 (Task 8, pinned by `tests/unit/ad-gate.spec.ts`). Nothing else changes.

- [ ] **Step 2: Approval 6 must be granted as well**

Run: `Select-String -Path docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md -Pattern '^\| 6 \|' | ForEach-Object { $_.Line }`
Expected: `approved`. If it is not, STOP and hand back: `"afterAllowedResult"` loads ads on scrubbed deep links (spec §16 item 7 builds on item 6), which approval 6's fallback forbids ("번호 URL에서는 광고를 아예 싣지 않는 안"). A home-only variant needs a fourth `AdTimingPolicy` value — a contract amendment the operator must ask for (roadmap §5). Record "Task 9 blocked: approval 7 granted without approval 6".

- [ ] **Step 3: Write the rule → assertion row first**

Append to the S08 table in `tests/e2e/RULE-MAP.md`:

```markdown
| S08-5 | 광고 로더 시점: 홈은 허용 결과 확정 또는 쇼케이스까지 스크롤 뒤, 딥링크는 주소 정리 + 허용 결과 뒤, 문제 상태 동안 보류 (§8 광고, §16 item 7) | internal-isolation › "public pages still load the AdSense loader (control)" (loader right after load on '/'); url-privacy rows are policy-aware and stay | ad-placement › "ad timing (S08, approval 7)" ×4; internal-isolation control test scrolls to the showcase first; unit ad-gate › "afterAllowedResult (approval 7): …" | migrated (Task 9) |
```

- [ ] **Step 4: Write the failing unit tests**

In `tests/unit/ad-gate.spec.ts`:
(a) Replace the whole test that starts with `test("afterAllowedResult stays closed until S08 implements it", () => {` (to its closing `});`) with:

```ts
test("afterAllowedResult (approval 7): home after an allowed result or a scroll, deep links after the scrub and an allowed result, never during a problem result", () => {
  const base = {
    pathname: "/",
    scrub: "pending",
    resultAdsAllowed: null,
    scrolledPastLookup: false,
    policy: "afterAllowedResult"
  } as const;
  expect(gate({ ...base, entry: "home" })).toBe(false);
  expect(gate({ ...base, entry: "home", scrolledPastLookup: true })).toBe(true);
  expect(gate({ ...base, entry: "home", resultAdsAllowed: true })).toBe(true);
  expect(gate({ ...base, entry: "home", resultAdsAllowed: false, scrolledPastLookup: true })).toBe(false);
  expect(gate({ ...base, entry: "deepLink", resultAdsAllowed: true })).toBe(false);
  expect(gate({ ...base, entry: "deepLink", scrub: "scrubbed" })).toBe(false);
  expect(gate({ ...base, entry: "deepLink", scrub: "scrubbed", scrolledPastLookup: true })).toBe(false);
  expect(gate({ ...base, entry: "deepLink", scrub: "scrubbed", resultAdsAllowed: false })).toBe(false);
  expect(gate({ ...base, entry: "deepLink", scrub: "scrubbed", resultAdsAllowed: true })).toBe(true);
  expect(adGateState({ ...base, entry: "home" })).toBe("waiting");
  expect(adGateState({ ...base, entry: "deepLink" })).toBe("waiting");
});
```

(b) Replace the whole test that starts with `test("AD_TIMING_POLICY follows approval 6 in the roadmap ledger", () => {` (to its closing `});`) with:

```ts
test("AD_TIMING_POLICY follows approvals 6 and 7 in the roadmap ledger", () => {
  const ledger = readFileSync(path.join(process.cwd(), "docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md"), "utf8");
  const statusOf = (row: number): string | undefined => new RegExp(`^\\| ${row} \\| [^|]+\\| (\\w+) \\|`, "m").exec(ledger)?.[1];
  const six = statusOf(6);
  const seven = statusOf(7);
  expect(six, "approval 6 row not found in roadmap §4").toBeTruthy();
  expect(seven, "approval 7 row not found in roadmap §4").toBeTruthy();
  const expected: AdTimingPolicy =
    six === "approved" && seven === "approved" ? "afterAllowedResult" : six === "approved" ? "afterScrub" : "neverOnNumberRoutes";
  expect(AD_TIMING_POLICY).toBe(expected);
});
```

- [ ] **Step 5: Run the unit tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ad-gate.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `2 failed, 10 passed` — the approval-7 rule test (`gate({ … scrolledPastLookup: true })` receives `false`: S02 keeps the branch closed) and the ledger test (`Expected: "afterAllowedResult"`, `Received: "afterScrub"`). The DESIGN.md test still passes here (the policy has not changed yet, so the exception sentence must still be there); Step 8 removes the sentence together with the policy switch.

- [ ] **Step 6: Write the failing E2E tests**

In `tests/e2e/ad-placement.spec.ts`, below the last import line add:

```ts
import { AD_TIMING_POLICY } from "@/lib/ads/ad-gate";
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import { waitForIdle, watchAdLoader, type AdLoaderWatch } from "../support/network-capture";
```

Append:

```ts
async function loaderCount(loader: AdLoaderWatch): Promise<number> {
  const documentId = await loader.currentDocumentId();
  return loader.insertions().filter((insertion) => insertion.documentId === documentId).length;
}

function expectCleanInsertions(loader: AdLoaderWatch): void {
  for (const insertion of loader.insertions()) {
    expect(insertion.pathname).toBe("/");
    expect(containsTrackingLikeValue(insertion.href), "loader inserted while the URL carried a number").toBe(false);
  }
}

test.describe("ad timing (S08, approval 7)", () => {
  test.skip(AD_TIMING_POLICY !== "afterAllowedResult", "approval 7 not granted: S02's timing applies (Task 9 SKIPPED)");

  test("home: no loader before a lookup or a scroll; one after scrolling down to the showcase", async ({ page }) => {
    const loader = await watchAdLoader(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await waitForIdle(page);
    expect(await loaderCount(loader)).toBe(0);
    await page.locator("[data-store-showcase]").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 1));
    await expect.poll(() => loaderCount(loader), { timeout: 10_000 }).toBe(1);
    expectCleanInsertions(loader);
  });

  test("home: a problem result inserts nothing; a later allowed result in the same tab inserts it once", async ({ page }) => {
    const loader = await watchAdLoader(page);
    await page.goto("/");
    await mockTrack(page, "notFound404");
    await lookUp(page, FAKE.domestic);
    await expect(page.locator('[data-result-view="error"]')).toBeVisible();
    await waitForIdle(page);
    expect(await loaderCount(loader)).toBe(0);

    await mockTrack(page, trackData("delivered", { trackingNumber: FAKE.domesticAlt }));
    await page.getByRole("button", { name: LOOKUP_ANOTHER_LABEL }).click();
    await lookUp(page, FAKE.domesticAlt);
    await expect(page.locator('[data-result-view="settled"]')).toBeVisible();
    await expect.poll(() => loaderCount(loader), { timeout: 10_000 }).toBe(1);
    expectCleanInsertions(loader);
  });

  test("deep link: a problem result holds the loader; an allowed lookup afterwards in the same tab inserts it once", async ({ page }) => {
    const loader = await watchAdLoader(page);
    await mockTrack(page, "notFound404");
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator('[data-result-view="error"]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => location.pathname), { timeout: 10_000 }).toBe("/");
    await waitForIdle(page);
    expect(await loaderCount(loader)).toBe(0);

    await mockTrack(page, trackData("delivered", { trackingNumber: FAKE.domesticAlt }));
    await page.getByRole("button", { name: LOOKUP_ANOTHER_LABEL }).click();
    await lookUp(page, FAKE.domesticAlt);
    await expect(page.locator('[data-result-view="settled"]')).toBeVisible();
    await expect.poll(() => loaderCount(loader), { timeout: 10_000 }).toBe(1);
    expectCleanInsertions(loader);
  });

  test("deep link: an allowed result inserts the loader once, after the scrub", async ({ page }) => {
    const loader = await watchAdLoader(page);
    await mockTrack(page, trackData("delivered", { trackingNumber: FAKE.domestic }));
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator('[data-result-view="settled"]')).toBeVisible();
    await expect.poll(() => loaderCount(loader), { timeout: 10_000 }).toBe(1);
    expectCleanInsertions(loader);
  });
});
```

In `tests/e2e/internal-isolation.spec.ts`, replace everything between the opening line of the test `"public pages still load the AdSense loader (control)"` and its closing `});` (S01's comment line and three statements) with:

```ts
  // S08 (approval 7): on '/' the loader waits for an allowed result or a scroll down to the store showcase.
  await recordAdRequests(page);
  await page.goto("/");
  await page.locator("[data-store-showcase]").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 1));
  await expect(page.locator(AD_SCRIPT)).toHaveCount(1);
```

- [ ] **Step 7: Implement `"afterAllowedResult"` and switch the policy**

In `lib/ads/ad-gate.ts`:
(a) Replace the doc-comment line ` * - "afterAllowedResult": approval 7 — implemented by S08; closed until then.` with:

```ts
 * - "afterAllowedResult": approval 7 — home documents after an allowed result or a scroll to the showcase; deep-link
 *   documents after a confirmed scrub and an allowed result; never while a problem result is on screen.
```

(b) Replace the whole `export const AD_TIMING_POLICY: AdTimingPolicy = …;` statement and the one-line doc comment directly above it with:

```ts
/** Approvals 6 and 7 are recorded in roadmap §4 (S08 Task 9). Revert switch for spec §17 Q5: "afterScrub". */
export const AD_TIMING_POLICY: AdTimingPolicy = "afterAllowedResult";
```

(c) Replace the two lines

```ts
    case "afterAllowedResult":
      return false;
```

with

```ts
    case "afterAllowedResult":
      // A problem result holds the loader; a later allowed result in the same tab opens the gate once (spec §8).
      if (input.resultAdsAllowed === false) return false;
      if (input.entry === "deepLink") return input.scrub === "scrubbed" && input.resultAdsAllowed === true;
      return input.resultAdsAllowed === true || input.scrolledPastLookup;
```

- [ ] **Step 8: Report the scroll to the showcase**

Create `components/ads/ShowcaseReachedSignal.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { setAdSignals } from "@/lib/ads/ad-signals";

/**
 * Approval 7, home: the ad loader may load once the customer has scrolled down to the store showcase (spec §7 idle,
 * §16 item 7). An aria-hidden sentinel right above the showcase that reports only after a real scroll (scrollY > 0),
 * so a tall window that shows the showcase without scrolling does not count.
 */
export function ShowcaseReachedSignal(): React.JSX.Element {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (sentinel === null || typeof IntersectionObserver === "undefined") return undefined;
    let visible = false;
    const report = (): void => {
      if (!visible || window.scrollY <= 0) return;
      setAdSignals({ scrolledPastLookup: true });
      cleanup();
    };
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      report();
    });
    function cleanup(): void {
      observer.disconnect();
      window.removeEventListener("scroll", report);
    }
    observer.observe(sentinel);
    window.addEventListener("scroll", report, { passive: true });
    return cleanup;
  }, []);

  return <div ref={sentinelRef} data-ad-scroll-sentinel="showcase" aria-hidden="true" className="h-px" />;
}
```

In `components/shell/TrackingPage.tsx`:
(a) Below `import { StoreShowcase } from "@/components/supplementary/StoreShowcase";` add `import { ShowcaseReachedSignal } from "@/components/ads/ShowcaseReachedSignal";`.
(b) Replace the line `      <StoreShowcase />` (inside `IdleExtras`) with:

```tsx
      <ShowcaseReachedSignal />
      <StoreShowcase />
```

In `DESIGN.md` §13, replace the last bullet (it starts with `- **광고 시점**: 지금 정책은`) with:

```markdown
- **광고 시점**(승인 7, `AD_TIMING_POLICY = "afterAllowedResult"`): 홈은 첫 결과가 광고 허용 상태로 확정되거나 고객이 쇼케이스까지 스크롤한 뒤, 딥링크는 주소 정리와 허용 결과가 모두 확인된 뒤 한 번 넣습니다. 문제 상태 결과가 보이는 동안에는 넣지 않고, 같은 탭에서 나중에 허용 결과가 나오면 넣습니다. 홈 수익이 크게 줄면(spec §17 Q5) `"afterScrub"`로 되돌립니다.
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ad-gate.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `12 passed` (the DESIGN.md test now expects the exception sentence to be absent, and Step 8 removed it).
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/ad-placement.spec.ts tests/e2e/internal-isolation.spec.ts tests/e2e/url-privacy.spec.ts tests/e2e/session-restore.spec.ts tests/privacy.spec.ts`
Expected: 0 failed; `ad-placement.spec.ts` `18 passed, 2 skipped` (the approval-15 rows). S02's `url-privacy.spec.ts` rows are policy-aware (`loaderExpected` returns true after an allowed in-transit result, and the pre-lookup home check is skipped for `"afterAllowedResult"`); S02's privacy test now finds `AD_TIMING_DISCLOSURE.afterAllowedResult` in the policy text.
If an S02 `url-privacy.spec.ts` row that expects a loader after an in-transit result fails with `0` insertions, check its view at the machine's date: S02 does not pin the clock, and at a later real date the in-transit fixture can be overdue (`adsAllowed: false`), which now correctly holds the loader. Pin that test's clock with `await page.clock.setFixedTime(FIXTURE_NOW);` as its first statement (import `FIXTURE_NOW` from the fixtures) — a test-only edit; list `tests/e2e/url-privacy.spec.ts` as a File Map addition (M S08) in the stage summary.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 10: Commit**

Run: `git add lib/ads/ad-gate.ts components/ads/ShowcaseReachedSignal.tsx components/shell/TrackingPage.tsx tests/unit/ad-gate.spec.ts tests/e2e/ad-placement.spec.ts tests/e2e/internal-isolation.spec.ts tests/e2e/RULE-MAP.md DESIGN.md; git commit -m "feat: load ads only after an allowed result or a scroll to the showcase (approval 7)"`

---

### Task 10 (gated by approval 10): Inline recommendations with the product-detail fact check

**Files:**
- Modify: `lib/tracking/recommendations.ts` (remove the fallback; `recommendationsForView` loses its fourth parameter)
- Modify: `components/supplementary/RecommendationList.tsx` (whole file)
- Modify: `components/lookup/LookupController.tsx` (the recommendations import; one call)
- Modify: `tests/e2e/cta-consistency.spec.ts` (one assertion; imports)
- Modify: `config/site.config.ts` (only `featuredProducts[].href`/`priceLabel`/`priceCheckedAt` values the operator supplies)
- Modify: `tests/unit/real-number-guard.spec.ts` (`EXTRA_ALLOWED` gains the configured product-link ids)
- Modify: `tests/e2e/RULE-MAP.md` (S08-1 cells)
- Test: `tests/unit/recommendations.spec.ts`, `tests/e2e/recommendations.spec.ts`

**Interfaces:**
- Consumes: Task 1–3 names; `fillSlots(template, values)` (S03 `lib/tracking/template.ts`); `formatKstDateTight(value: Date | KstDateKey)` ('9월 24일(목)', S03 `lib/tracking/time.ts`); `resultCopy.recommendationPriceChecked` (Task 2).
- Produces: `recommendationsForView(revenue: RevenueView, items: readonly FeaturedItem[], now: Date): readonly SelectedRecommendation[]` (approved rules only); `selectOperatorPicks`, `RecommendationPresentation` and `RECOMMENDATION_PRESENTATION` removed (Addition 1 notes this); `RecommendationList` renders an inline list — heading '운영자 추천', the disclosure first when an item is affiliate, one `<li>` per item with an optional `span[data-recommendation-weekly]` '이번 주', the detail link, the store name and an optional `span[data-recommendation-price]` '39,000원 · 9월 24일(목) 확인'.

- [ ] **Step 1: Confirm approval 10 is recorded in the roadmap approval ledger; if not, stop**

Run: `Select-String -Path docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md -Pattern '^\| 10 \|' | ForEach-Object { $_.Line }`
Expected: `approved`. If it reads `pending` or `rejected`, STOP and mark this task SKIPPED with the reason "approval 10 not granted". Fallback (spec §16 item 10 "거절하면"): the dialog stays, labelled '운영자 추천', without price or discount labels — shipped by Task 3 and pinned by `tests/e2e/recommendations.spec.ts` "'운영자 추천' dialog (S08, approval-10 fallback)".

- [ ] **Step 2: The fact check — every recommended item needs a product-detail link**

Append to `tests/unit/recommendations.spec.ts` (and add `featuredProducts` to the braces of its `@/config/site.config` import):

```ts
test("every shipped featured product links to a product-detail page (approval 10 fact check)", () => {
  expect(featuredProducts.filter((item) => !isProductDetailLink(item.href)).map((item) => item.id)).toEqual([]);
  for (const item of featuredProducts) {
    if (item.priceLabel !== null) expect(item.priceCheckedAt, `${item.id}: a price needs its check date`).not.toBeNull();
  }
});
```

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/recommendations.spec.ts -g "fact check"; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected with the S03 defaults: FAIL, listing `carpodgo-carplay`, `svbony-eyepiece`, `model-y-mat`, `blue-archive-display` (they still point at the store homes). STOP here and ask the operator for each item's product-detail URL (or to drop the item), plus a price and its check time if they want one shown. Edit only those values in `config/site.config.ts` `featuredProducts` (`href`, and optionally `priceLabel` + `priceCheckedAt` as `YYYY-MM-DDTHH:MM:SS+09:00`); if a new host appears, add it to `channels.allowedHosts`. Re-run until it passes.
Product-detail links often carry a product id of 10 or more digits, which the repository guard (S01) would report as a possible tracking number. Configured product links are public shop pages, so allowlist their digit runs next to the ad unit id: in `tests/unit/real-number-guard.spec.ts` add `featuredProducts` to the braces of the `@/config/site.config` import (Task 7 added `import { ads } from "@/config/site.config";`) and replace the Task 7 line

```ts
const EXTRA_ALLOWED: readonly string[] = ads.manualSlotId === null ? [] : [ads.manualSlotId];
```

with

```ts
/** Digit runs of the configured product-detail links (approval 10) are public shop ids, not tracking numbers (S08). */
const PRODUCT_LINK_RUNS: readonly string[] = featuredProducts.flatMap((item) => item.href.match(/\d{10,}/g) ?? []);
const EXTRA_ALLOWED: readonly string[] = [...(ads.manualSlotId === null ? [] : [ads.manualSlotId]), ...PRODUCT_LINK_RUNS];
```

and in the Task 7 test `"the configured manual ad unit id is the one extra allowed run (S08)"` replace its last line with `expect(EXTRA_ALLOWED).toEqual([...(ads.manualSlotId === null ? [] : [ads.manualSlotId]), ...PRODUCT_LINK_RUNS]);`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/config.spec.ts tests/unit/real-number-guard.spec.ts tests/unit/recommendations.spec.ts -g "config|guard|scan|fact check|allowed run"; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed.

- [ ] **Step 3: Write the failing tests for the inline list**

In `tests/unit/recommendations.spec.ts`:
(a) In the import from `@/lib/tracking/recommendations`, remove `RECOMMENDATION_PRESENTATION` and `selectOperatorPicks`.
(b) Delete the whole `test.describe("selectOperatorPicks (approval-10 fallback: '운영자 추천' dialog)", …)` block.
(c) Replace the whole `test.describe("recommendationsForView", …)` block with:

```ts
test.describe("recommendationsForView (approval 10)", () => {
  test("nothing when the view allows no recommendations or has no context", () => {
    expect(recommendationsForView(revenue({ recommendations: "none" }), FIXTURE_FEATURED, FIXTURE_NOW)).toEqual([]);
    expect(recommendationsForView(revenue({ recommendationContext: null }), FIXTURE_FEATURED, FIXTURE_NOW)).toEqual([]);
  });

  test("'optional' states show only items that name the state in their contexts", () => {
    const view = revenue({ recommendations: "optional", recommendationContext: "customsCleared" });
    expect(ids(recommendationsForView(view, FIXTURE_FEATURED, FIXTURE_NOW))).toEqual(["fx-month-case"]);
    expect(recommendationsForView(view, [WEEKLY], FIXTURE_NOW)).toEqual([]);
  });

  test("the approved rules apply, and the list never exceeds RECOMMENDATION_LIMIT", () => {
    expect(RECOMMENDATION_LIMIT).toBe(3);
    const many = [STORE_HOME, WEEKLY, MONTH, { ...MONTH, id: "fx-month-copy" }, { ...WEEKLY, id: "fx-weekly-copy" }];
    expect(ids(recommendationsForView(revenue({}), many, FIXTURE_NOW))).toEqual(["fx-weekly-mount", "fx-month-case", "fx-month-copy"]);
  });
});
```

(d) Replace the whole test `"RECOMMENDATION_PRESENTATION follows approval 10 in the roadmap ledger"` with:

```ts
test("approval 10 is recorded, so the inline rules are the only rules", () => {
  const ledger = readFileSync(path.join(REPO_ROOT, "docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md"), "utf8");
  expect(/^\| 10 \| [^|]+\| (\w+) \|/m.exec(ledger)?.[1]).toBe("approved");
});
```

In `tests/e2e/recommendations.spec.ts`:
(a) Replace `import { RECOMMENDATION_PRESENTATION, recommendationsForView } from "@/lib/tracking/recommendations";` with `import { recommendationsForView } from "@/lib/tracking/recommendations";`, and add `formatKstDateTight` and `fillSlots` imports:

```ts
import { fillSlots } from "@/lib/tracking/template";
import { formatKstDateTight } from "@/lib/tracking/time";
```

(b) At every call site, replace `recommendationsForView(<revenue>, featuredProducts, <now>, RECOMMENDATION_PRESENTATION)` with `recommendationsForView(<revenue>, featuredProducts, <now>)` (the first three arguments stay as they are).
(c) Replace the whole `test.describe("'운영자 추천' dialog (S08, approval-10 fallback)", …)` block and the `PRICE_OR_CLAIM` constant with:

```ts
const WEEKLY_LABEL = "이번 주";

test.describe("inline recommendations (S08, approval 10)", () => {
  test("pending: '운영자 추천' follows 처리 내역 as an inline list — disclosure first, detail links, '이번 주' and prices only where the rules allow", async ({ page }) => {
    const data = trackData("pending");
    const expected = recommendationsForView(viewOf(data, FIXTURE_NOW).revenue, featuredProducts, FIXTURE_NOW);
    expect(expected.length, "the operator's items recommend something for pending").toBeGreaterThan(0);
    await openResult(page, data);

    const block = page.locator('[data-recommended-products="pending"]');
    await expect(block.getByRole("heading", { level: 2, name: OPERATOR_PICKS_LABEL })).toBeVisible();
    expect(await precedes(page, "[data-history], [data-history-empty]", "[data-recommended-products]")).toBe(true);
    const items = block.getByRole("listitem");
    await expect(items).toHaveCount(expected.length);
    for (const [index, entry] of expected.entries()) {
      const row = items.nth(index);
      const link = row.getByRole("link", { name: `${entry.item.name} 새 창으로 열기` });
      await expect(link).toHaveAttribute("href", entry.item.href);
      await expect(link).toHaveAttribute("rel", entry.item.isAffiliate ? "sponsored nofollow noopener noreferrer" : "noopener noreferrer");
      await expect(row.locator("[data-recommendation-weekly]")).toHaveCount(entry.weeklyLabel ? 1 : 0);
      if (entry.weeklyLabel) await expect(row.locator("[data-recommendation-weekly]")).toHaveText(WEEKLY_LABEL);
      const price = row.locator("[data-recommendation-price]");
      if (entry.showPrice && entry.item.priceLabel !== null && entry.item.priceCheckedAt !== null) {
        const checked = fillSlots(resultCopy.recommendationPriceChecked, { date: formatKstDateTight(new Date(entry.item.priceCheckedAt)) });
        await expect(price).toHaveText(`${entry.item.priceLabel} · ${checked}`);
      } else {
        await expect(price).toHaveCount(0);
      }
    }
    if (expected.some(({ item }) => item.isAffiliate)) {
      await expect(block.locator("[data-affiliate-disclosure]")).toHaveText(disclosures.coupang);
      expect(await precedes(page, "[data-recommended-products] [data-affiliate-disclosure]", '[data-recommended-products] a[rel~="sponsored"]')).toBe(true);
    }
  });

  test("no dialog and no store-home link in the list", async ({ page }) => {
    const data = trackData("delivered");
    await openResult(page, data);
    const block = page.locator('[data-recommended-products="delivered"]');
    await expect(block).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const hrefs = await block.locator("a").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    for (const href of hrefs) expect(isProductDetailLink(href), href).toBe(true);
  });
});
```

and add `isProductDetailLink` to that file's `@/lib/tracking/recommendations` import.

In `tests/e2e/cta-consistency.spec.ts`:
(a) Change the `@/config/site.config` import to also import `featuredProducts`, and add `import { recommendationsForView } from "@/lib/tracking/recommendations";`.
(b) Replace the line

```ts
    await expect(page.locator("[data-recommended-products]")).toHaveCount(view.revenue.recommendations === "inline" ? 1 : 0);
```

with

```ts
    // S08 (approval 10): optional states show a block only when an item opts into them (Addition 1).
    await expect(page.locator("[data-recommended-products]")).toHaveCount(
      recommendationsForView(view.revenue, featuredProducts, FIXTURE_NOW).length > 0 ? 1 : 0
    );
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/recommendations.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — the `recommendationsForView` rows receive the dialog picks (a store-home item first) because the function still takes a presentation argument and falls back to `selectOperatorPicks` when it is `undefined`.
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/recommendations.spec.ts`
Expected: `1 failed, 10 passed` — "pending: … as an inline list …" finds no `listitem` in the block (the list still sits in the closed dialog); "no dialog and no store-home link in the list" passes already (a closed dialog is hidden and the block holds no link) and keeps guarding the rule.

- [ ] **Step 5: Keep only the approved rules in `lib/tracking/recommendations.ts`**

(a) Delete these three statements with their doc comments: `export type RecommendationPresentation = "inline" | "dialog";`, `export const RECOMMENDATION_PRESENTATION: RecommendationPresentation = "dialog";` and the whole `export function selectOperatorPicks(…) { … }`.
(b) Replace the whole `recommendationsForView` function and its doc comment with:

```ts
/**
 * The recommendations a settled result shows (approval 10). Nothing when the view allows none (problem states, overdue,
 * loading); "optional" states (customsWaiting, customsCleared) behave like "inline" — an item appears only if it names the state.
 */
export function recommendationsForView(
  revenue: RevenueView,
  items: readonly FeaturedItem[],
  now: Date
): readonly SelectedRecommendation[] {
  const context = revenue.recommendationContext;
  if (revenue.recommendations === "none" || context === null) return [];
  return selectRecommendations(items, context, now, RECOMMENDATION_LIMIT);
}
```

(c) In the file's top doc comment, replace the line ` * - Fallback rules (approval 10 not granted, '운영자 추천' dialog): same context and span rules, never a price or '이번 주'.` with ` * - Approval 10 is recorded (S08 Task 10): the '운영자 추천' list is inline and these are the only rules.`

- [ ] **Step 6: Replace `components/supplementary/RecommendationList.tsx`**

```tsx
"use client";

import { useId } from "react";
import { ButtonLink } from "@/components/primitives/ButtonLink";
import { channels, resultCopy } from "@/config/site.config";
import type { SelectedRecommendation } from "@/lib/tracking/recommendations";
import { fillSlots } from "@/lib/tracking/template";
import { formatKstDateTight } from "@/lib/tracking/time";
import type { RecommendationContext } from "@/lib/tracking/types";

/** Spec literals: the list's name and the weekly label (§16 item 10, §8 추천). */
const OPERATOR_PICKS_LABEL = "운영자 추천";
const WEEKLY_LABEL = "이번 주";

export interface RecommendationListProps {
  readonly context: RecommendationContext;
  readonly items: readonly SelectedRecommendation[];
  readonly disclosure: string;
}

function priceLine(entry: SelectedRecommendation): string | null {
  const { item } = entry;
  if (!entry.showPrice || item.priceLabel === null || item.priceCheckedAt === null) return null;
  const checked = fillSlots(resultCopy.recommendationPriceChecked, { date: formatKstDateTight(new Date(item.priceCheckedAt)) });
  return `${item.priceLabel} · ${checked}`;
}

/**
 * Inline recommendations after a settled result (spec §8 "추천", §16 item 10): the definitive disclosure first when an
 * item is affiliate, then one line per item — '이번 주' only for a validity span of 7 days or less, the product-detail
 * link, the store, and a price only when it was checked within 7 days. The rules live in lib/tracking/recommendations.ts.
 */
export function RecommendationList({ context, items, disclosure }: RecommendationListProps): React.JSX.Element | null {
  const titleId = useId();
  if (items.length === 0) return null;
  const hasAffiliate = items.some((entry) => entry.item.isAffiliate);
  return (
    <section
      data-recommended-products={context}
      aria-labelledby={titleId}
      className="flex flex-col gap-3 border-t-2 border-tt-ink bg-tt-surface px-[var(--tt-gutter)] py-4 text-tt-ink"
    >
      <h2 id={titleId} className="m-0 text-tt-lg font-bold [word-break:keep-all]">
        {OPERATOR_PICKS_LABEL}
      </h2>
      <div className="flex flex-col gap-2">
        {hasAffiliate ? <p data-affiliate-disclosure="coupang">{disclosure}</p> : null}
        <ul className="m-0 flex list-none flex-col p-0">
          {items.map((entry) => {
            const price = priceLine(entry);
            return (
              <li key={entry.item.id} className="flex flex-col items-start gap-1 border-t border-tt-rule py-2">
                {entry.weeklyLabel ? (
                  <span data-recommendation-weekly="true" className="border border-tt-ink px-2 text-tt-xs font-bold">
                    {WEEKLY_LABEL}
                  </span>
                ) : null}
                <ButtonLink href={entry.item.href} variant="text" external sponsored={entry.item.isAffiliate} label={entry.item.name} />
                <span className="text-tt-xs text-tt-muted">{channels[entry.item.channel].name}</span>
                {price === null ? null : (
                  <span data-recommendation-price="true" className="text-tt-sm font-bold">
                    {price}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Update the one caller**

In `components/lookup/LookupController.tsx`:
(a) Replace `import { RECOMMENDATION_PRESENTATION, recommendationsForView } from "@/lib/tracking/recommendations";` with `import { recommendationsForView } from "@/lib/tracking/recommendations";`.
(b) Replace `recommendationsForView(view.revenue, featuredProducts, new Date(clientNowMs), RECOMMENDATION_PRESENTATION)` with `recommendationsForView(view.revenue, featuredProducts, new Date(clientNowMs))`.
Run: `git grep -n "RECOMMENDATION_PRESENTATION\|selectOperatorPicks\|recommendationsOpen\|recommendationsClose" -- app components lib tests`
Expected: no output except the config type/value lines of `recommendationsOpen`/`recommendationsClose` in `lib/config/types.ts`, `config/site.config.ts`, `lib/config/invariants.ts` and the Task 2 test in `tests/unit/recommendations.spec.ts` (the two strings stay in the config for a possible return to the dialog; they are not rendered).

- [ ] **Step 8: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed.
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/recommendations.spec.ts tests/e2e/cta-consistency.spec.ts tests/e2e/result-states.spec.ts tests/e2e/result-layout.spec.ts`
Expected: 0 failed; `recommendations.spec.ts` `11 passed` (2 inline + 8 states + 1 late clock).
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 9: Update the map and commit**

In `tests/e2e/RULE-MAP.md`, row `S08-1`: replace its "New assertion" cell text `recommendations › "pending: '운영자 추천' follows 처리 내역 …", "no product link is in the page until the dialog opens …"` with `recommendations › "pending: '운영자 추천' follows 처리 내역 as an inline list …", "no dialog and no store-home link in the list"`, and its Status `migrated (Task 3)` with `migrated (Task 3, dialog); inline since Task 10 (approval 10)`.
Run: `git add lib/tracking/recommendations.ts components/supplementary/RecommendationList.tsx components/lookup/LookupController.tsx config/site.config.ts tests/unit/real-number-guard.spec.ts tests/unit/recommendations.spec.ts tests/e2e/recommendations.spec.ts tests/e2e/cta-consistency.spec.ts tests/e2e/RULE-MAP.md; git commit -m "feat: show recommendations inline with detail links, weekly labels and checked prices (approval 10)"`

---

## Part B — R3b: selectable screen styles

### Task 11: The `manifest` and `night` token sets

**Files:**
- Modify: `lib/style/tokens.ts` (the `STYLE_COLOR_TOKENS` statement)
- Modify: `lib/style/styles.ts` (the doc comment and `IMPLEMENTED_STYLE_IDS`)
- Create: `app/styles/style-manifest.css`, `app/styles/style-night.css` (token blocks)
- Modify: `app/layout.tsx` (two CSS imports)
- Test: `tests/unit/tokens.spec.ts` (replace one S05 test; append), `tests/e2e/ui-kit.spec.ts` (append)

**Interfaces:**
- Consumes: `COLOR_TOKENS`, `NON_COLOR_TOKENS`, `ColorTokenSet`, `CONTRAST_REQUIREMENTS`, `contrastRatio`, `STYLE_COLOR_TOKENS` (S05 `lib/style/tokens.ts`); `STYLE_IDS`, `IMPLEMENTED_STYLE_IDS` (S05 `lib/style/styles.ts`); S05 test helpers inside `tests/unit/tokens.spec.ts` (`readRepoFile`, `declarations`, `signalBlock`, `pixels`, `milliseconds`, `hsl`, `isRed`, `TONES`) and `tests/e2e/ui-kit.spec.ts` (`openKit`, `settleAnimations`); Phase 3 canvas values (roadmap §11.12 table).
- Produces: `STYLE_COLOR_TOKENS = { signal, manifest, night }` (contract §11.9: S08 adds `manifest`, `night`); `IMPLEMENTED_STYLE_IDS = ["signal", "manifest", "night"]`; `[data-style="manifest"]` and `[data-style="night"]` blocks declaring all 57 tokens (night also `color-scheme: dark`); both files imported after `tokens.css`, so a style block outranks the `:root` fallback at equal specificity.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/tokens.spec.ts`, replace

```ts
  test("implements only signal in S05", () => {
    expect(IMPLEMENTED_STYLE_IDS).toEqual(["signal"]);
  });
```

with

```ts
  test("implements all three styles (S08)", () => {
    expect(IMPLEMENTED_STYLE_IDS).toEqual(["signal", "manifest", "night"]);
  });
```

Append to the end of `tests/unit/tokens.spec.ts`:

```ts
const STYLE_FILES = { manifest: "app/styles/style-manifest.css", night: "app/styles/style-night.css" } as const;
type ExtraStyleId = keyof typeof STYLE_FILES;

function styleBlock(id: ExtraStyleId): Map<string, string> {
  const match = readRepoFile(STYLE_FILES[id]).match(new RegExp(`\\[data-style="${id}"\\]\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`${STYLE_FILES[id]} has no [data-style="${id}"] token block`);
  return declarations(match[1]);
}

function styleColors(id: ExtraStyleId): ColorTokenSet {
  const set = STYLE_COLOR_TOKENS[id];
  if (!set) throw new Error(`${id} color tokens are missing`);
  return set;
}

test.describe("manifest and night tokens (S08)", () => {
  for (const id of ["manifest", "night"] as const) {
    test(`${id}: the style file declares every contract token with the TypeScript colors and nothing else`, () => {
      const block = styleBlock(id);
      const colors = styleColors(id);
      for (const token of COLOR_TOKENS) expect(block.get(token)?.toUpperCase(), `${id} ${token}`).toBe(colors[token]);
      for (const token of NON_COLOR_TOKENS) expect(block.has(token), `${id} ${token}`).toBe(true);
      const known = new Set<string>([...COLOR_TOKENS, ...NON_COLOR_TOKENS]);
      expect([...block.keys()].filter((name) => !known.has(name))).toEqual([]);
    });

    test(`${id}: type, focus, motion and layout values follow the shared budgets`, () => {
      const block = styleBlock(id);
      const sizes = ["--tt-text-xs", "--tt-text-sm", "--tt-text-md", "--tt-text-lg", "--tt-text-xl"].map((token) => pixels(block.get(token)));
      expect(sizes).toEqual([12, 14, 16, 20, 24]);
      const eta = pixels(block.get("--tt-text-eta"));
      expect(eta).toBeGreaterThanOrEqual(32);
      expect(eta).toBeLessThanOrEqual(40);
      expect(pixels(block.get("--tt-focus-width"))).toBeGreaterThanOrEqual(3);
      expect(pixels(block.get("--tt-focus-offset"))).toBe(2);
      for (const token of ["--tt-motion-fast", "--tt-motion-base", "--tt-motion-slow"]) {
        const ms = milliseconds(block.get(token));
        expect(ms, token).toBeGreaterThanOrEqual(150);
        expect(ms, token).toBeLessThanOrEqual(300);
      }
      expect(pixels(block.get("--tt-header-h"))).toBe(48);
      expect(pixels(block.get("--tt-column"))).toBe(560);
      expect(pixels(block.get("--tt-side"))).toBe(320);
      expect(pixels(block.get("--tt-status-field-max"))).toBe(300);
      expect(pixels(block.get("--tt-anchor-reserve"))).toBe(64);
      expect(pixels(block.get("--tt-radius-button"))).toBeLessThanOrEqual(8);
      expect(pixels(block.get("--tt-border-button"))).toBeGreaterThanOrEqual(1);
      expect(block.get("--tt-font-body")).toBe(signalBlock(readRepoFile("app/styles/tokens.css")).get("--tt-font-body"));
      expect(block.get("--tt-font-mono")).toContain(id === "manifest" ? "var(--font-plex-mono" : "var(--font-jetbrains-mono");
    });

    test(`${id}: red only for '문제', amber for '확인 필요', links apart from '정상 진행' and the accent, five distinct fills`, () => {
      const colors = styleColors(id);
      expect(COLOR_TOKENS.filter((token) => isRed(colors[token]))).toEqual(["--tt-tone-problem", "--tt-tone-problem-ink"]);
      const { hue } = hsl(colors["--tt-tone-attention"]);
      expect(hue).toBeGreaterThanOrEqual(25);
      expect(hue).toBeLessThanOrEqual(55);
      expect(colors["--tt-link"]).not.toBe(colors["--tt-tone-progress"]);
      expect(colors["--tt-link"]).not.toBe(colors["--tt-accent"]);
      expect(new Set(TONES.map((tone) => colors[`--tt-tone-${tone}`])).size).toBe(5);
    });
  }

  test("the root layout loads both style files after tokens.css", () => {
    const layout = readRepoFile("app/layout.tsx");
    const tokens = layout.indexOf('import "./styles/tokens.css";');
    const manifest = layout.indexOf('import "./styles/style-manifest.css";');
    const night = layout.indexOf('import "./styles/style-night.css";');
    expect(tokens).toBeGreaterThan(-1);
    expect(manifest).toBeGreaterThan(tokens);
    expect(night).toBeGreaterThan(manifest);
  });
});
```

Append to the end of `tests/e2e/ui-kit.spec.ts`:

```ts
test.describe("style token sets on the page (S08)", () => {
  for (const id of ["signal", "manifest", "night"] as const) {
    test(`html[data-style=${id}] applies the ${id} colors`, async ({ page }) => {
      await openKit(page);
      await page.evaluate((style) => document.documentElement.setAttribute("data-style", style), id);
      const values = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const read = (token: string): string => root.getPropertyValue(token).trim().toUpperCase();
        return { ground: read("--tt-ground"), ink: read("--tt-ink"), primary: read("--tt-primary"), problem: read("--tt-tone-problem") };
      });
      const set = STYLE_COLOR_TOKENS[id];
      expect(values).toEqual({
        ground: set?.["--tt-ground"],
        ink: set?.["--tt-ink"],
        primary: set?.["--tt-primary"],
        problem: set?.["--tt-tone-problem"]
      });
    });
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/tokens.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — "implements all three styles (S08)" (`Received: ["signal"]`), the six style-file tests (`ENOENT … style-manifest.css` / `style-night.css`, or "color tokens are missing") and the layout-order test (`manifest` import not found). S05's other tests pass.
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/ui-kit.spec.ts -g "style token sets"`
Expected: `2 failed, 1 passed` — `manifest` and `night` still read the signal values from the `:root` fallback.

- [ ] **Step 3: Add the two color sets to `lib/style/tokens.ts`**

Replace

```ts
export const STYLE_COLOR_TOKENS: Readonly<Partial<Record<StyleId, ColorTokenSet>>> = {
  signal: SIGNAL_COLORS
};
```

with

```ts
/**
 * Style A "세관 서류" (Phase 3 canvas A, Main.dc.html): cold paper, ink rules, one rubber stamp for the state.
 * Links are ink + underline (apart from the stamp blue). Keep in sync with app/styles/style-manifest.css.
 */
const MANIFEST_COLORS: ColorTokenSet = {
  "--tt-ground": "#ECEFF3",
  "--tt-surface": "#FAFBFC",
  "--tt-raised": "#FAFBFC",
  "--tt-ink": "#14213A",
  "--tt-muted": "#4A566B",
  "--tt-rule": "#C4CCD7",
  "--tt-control": "#6B7689",
  "--tt-route": "#7D8899",
  "--tt-primary": "#1B4A9A",
  "--tt-on-primary": "#FFFFFF",
  "--tt-accent": "#1B4A9A",
  "--tt-link": "#14213A",
  "--tt-focus": "#14213A",
  "--tt-tile": "#FAFBFC",
  "--tt-board": "#14213A",
  "--tt-tone-progress": "#1B4A9A",
  "--tt-tone-progress-on": "#FFFFFF",
  "--tt-tone-progress-ink": "#1B4A9A",
  "--tt-tone-waiting": "#56627A",
  "--tt-tone-waiting-on": "#FFFFFF",
  "--tt-tone-waiting-ink": "#56627A",
  "--tt-tone-attention": "#9A5A00",
  "--tt-tone-attention-on": "#FFFFFF",
  "--tt-tone-attention-ink": "#9A5A00",
  "--tt-tone-problem": "#B3261E",
  "--tt-tone-problem-on": "#FFFFFF",
  "--tt-tone-problem-ink": "#B3261E",
  "--tt-tone-done": "#185C36",
  "--tt-tone-done-on": "#FFFFFF",
  "--tt-tone-done-ink": "#185C36"
};

/**
 * Style C "야간 관제" (Phase 3 canvas C, Main.dc.html): desaturated dark ground, metro-line journey, flat lamps,
 * digit tiles (tile/board). Links are ink + underline (apart from the lamp blue). Keep in sync with app/styles/style-night.css.
 */
const NIGHT_COLORS: ColorTokenSet = {
  "--tt-ground": "#0C1214",
  "--tt-surface": "#131B1E",
  "--tt-raised": "#1A2428",
  "--tt-ink": "#E6ECE9",
  "--tt-muted": "#9AA8AC",
  "--tt-rule": "#27343A",
  "--tt-control": "#62757C",
  "--tt-route": "#6E8288",
  "--tt-primary": "#8FB3F0",
  "--tt-on-primary": "#0C1214",
  "--tt-accent": "#8FB3F0",
  "--tt-link": "#E6ECE9",
  "--tt-focus": "#E6ECE9",
  "--tt-tile": "#080C0E",
  "--tt-board": "#F1E8D4",
  "--tt-tone-progress": "#8FB3F0",
  "--tt-tone-progress-on": "#0C1214",
  "--tt-tone-progress-ink": "#8FB3F0",
  "--tt-tone-waiting": "#A3AFB3",
  "--tt-tone-waiting-on": "#0C1214",
  "--tt-tone-waiting-ink": "#A3AFB3",
  "--tt-tone-attention": "#E8A847",
  "--tt-tone-attention-on": "#0C1214",
  "--tt-tone-attention-ink": "#E8A847",
  "--tt-tone-problem": "#EF7C71",
  "--tt-tone-problem-on": "#0C1214",
  "--tt-tone-problem-ink": "#EF7C71",
  "--tt-tone-done": "#74CB9B",
  "--tt-tone-done-on": "#0C1214",
  "--tt-tone-done-ink": "#74CB9B"
};

export const STYLE_COLOR_TOKENS: Readonly<Partial<Record<StyleId, ColorTokenSet>>> = {
  signal: SIGNAL_COLORS,
  manifest: MANIFEST_COLORS,
  night: NIGHT_COLORS
};
```

Measured ratios of these values (WCAG 2.x, checked when this plan was written): manifest ink/surface 15.49, ink/ground 13.92, muted/surface 7.15, muted/ground 6.42, white on primary 8.42, tone-on/tone 5.47–8.42, tone-ink/surface 5.28–8.13, control/surface 4.43, route/surface 3.46; night ink/surface 14.58, ink/ground 15.77, muted/surface 7.12, muted/ground 7.71, on-primary/primary 8.88, tone-on/tone 7.01–9.67, tone-ink/surface 6.48–8.94, board/tile 16.12, control/surface 3.62, route/surface 4.33. All 22 requirements pass for both.

- [ ] **Step 4: Implement all three styles in `lib/style/styles.ts`**

Replace

```ts
export const IMPLEMENTED_STYLE_IDS: readonly StyleId[] = ["signal"];
```

with

```ts
export const IMPLEMENTED_STYLE_IDS: readonly StyleId[] = ["signal", "manifest", "night"];
```

and in the file's first doc comment replace `"signal" (B 색면 신호); S08 adds "manifest" and "night" and widens IMPLEMENTED_STYLE_IDS.` with `"signal" (B 색면 신호, the default), "manifest" (A 세관 서류) and "night" (C 야간 관제) — all three implemented since S08.`

- [ ] **Step 5: Create `app/styles/style-manifest.css`**

Copy `--tt-font-body` from the `:root, [data-style="signal"]` block of `app/styles/tokens.css` unchanged (S05 wrote `"Apple SD Gothic Neo", "Malgun Gothic", "맑은 고딕", "Noto Sans KR", "Noto Sans CJK KR", system-ui, -apple-system, sans-serif`; the test compares the two strings).

```css
/*
 * 화면 스타일 토큰 — manifest(서류형, A 세관 서류)
 * - 기준 문서: DESIGN.md 14장. 색 값은 lib/style/tokens.ts 의 MANIFEST_COLORS 와 같아야 하고 tests/unit/tokens.spec.ts 가 검사합니다.
 * - 이 파일은 [data-style="manifest"] 범위에만 규칙을 겁니다. 부품의 DOM·data-* 훅·문구는 바꾸지 않습니다.
 * - 한글 제목은 설치된 명조 글꼴을 쓰고(웹 폰트 없음), 숫자만 IBM Plex Mono(이 스타일을 고를 때만 내려받음)를 씁니다.
 * - app/layout.tsx 가 tokens.css 다음에 이 파일을 불러서, 같은 우선순위에서 :root 기본값보다 이 값이 이깁니다.
 */
[data-style="manifest"] {
  --tt-ground: #ECEFF3;
  --tt-surface: #FAFBFC;
  --tt-raised: #FAFBFC;
  --tt-ink: #14213A;
  --tt-muted: #4A566B;
  --tt-rule: #C4CCD7;
  --tt-control: #6B7689;
  --tt-route: #7D8899;
  --tt-primary: #1B4A9A;
  --tt-on-primary: #FFFFFF;
  --tt-accent: #1B4A9A;
  --tt-link: #14213A;
  --tt-focus: #14213A;
  --tt-tile: #FAFBFC;
  --tt-board: #14213A;
  --tt-tone-progress: #1B4A9A;
  --tt-tone-progress-on: #FFFFFF;
  --tt-tone-progress-ink: #1B4A9A;
  --tt-tone-waiting: #56627A;
  --tt-tone-waiting-on: #FFFFFF;
  --tt-tone-waiting-ink: #56627A;
  --tt-tone-attention: #9A5A00;
  --tt-tone-attention-on: #FFFFFF;
  --tt-tone-attention-ink: #9A5A00;
  --tt-tone-problem: #B3261E;
  --tt-tone-problem-on: #FFFFFF;
  --tt-tone-problem-ink: #B3261E;
  --tt-tone-done: #185C36;
  --tt-tone-done-on: #FFFFFF;
  --tt-tone-done-ink: #185C36;

  --tt-font-body: "Apple SD Gothic Neo", "Malgun Gothic", "맑은 고딕", "Noto Sans KR", "Noto Sans CJK KR", system-ui, -apple-system, sans-serif;
  --tt-font-display: "AppleMyungjo", "Nanum Myeongjo", "NanumMyeongjo", "Batang", "바탕", "Noto Serif KR", "Noto Serif CJK KR", serif;
  --tt-font-mono: var(--font-plex-mono, "IBM Plex Mono"), ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  --tt-weight-display: 700;
  --tt-text-xs: 12px;
  --tt-text-sm: 14px;
  --tt-text-md: 16px;
  --tt-text-lg: 20px;
  --tt-text-xl: 24px;
  --tt-text-eta: 36px;
  --tt-leading-tight: 1.25;
  --tt-leading-body: 1.5;
  --tt-radius-button: 2px;
  --tt-radius-card: 0px;
  --tt-border-button: 1px;
  --tt-focus-width: 3px;
  --tt-focus-offset: 2px;
  --tt-motion-fast: 150ms;
  --tt-motion-base: 200ms;
  --tt-motion-slow: 250ms;
  --tt-ease: cubic-bezier(0.2, 0, 0, 1);
  --tt-gutter: 20px;
  --tt-header-h: 48px;
  --tt-column: 560px;
  --tt-side: 320px;
  --tt-status-field-max: 300px;
  --tt-anchor-reserve: 64px;
}
```

- [ ] **Step 6: Create `app/styles/style-night.css`**

```css
/*
 * 화면 스타일 토큰 — night(어두운 화면, C 야간 관제)
 * - 기준 문서: DESIGN.md 15장. 색 값은 lib/style/tokens.ts 의 NIGHT_COLORS 와 같아야 하고 tests/unit/tokens.spec.ts 가 검사합니다.
 * - 이 파일은 [data-style="night"] 범위에만 규칙을 겁니다. 부품의 DOM·data-* 훅·문구는 바꾸지 않습니다.
 * - 한글은 시스템 고딕, 숫자만 JetBrains Mono(이 스타일을 고를 때만 내려받음)를 씁니다. 층은 흐림 없이 밝기 단계로만 나눕니다.
 * - 기기 어두운 모드면 첫 방문에 이 스타일로 시작합니다(config style.followSystemDark, lib/style/prepaint.ts).
 */
[data-style="night"] {
  color-scheme: dark;
  --tt-ground: #0C1214;
  --tt-surface: #131B1E;
  --tt-raised: #1A2428;
  --tt-ink: #E6ECE9;
  --tt-muted: #9AA8AC;
  --tt-rule: #27343A;
  --tt-control: #62757C;
  --tt-route: #6E8288;
  --tt-primary: #8FB3F0;
  --tt-on-primary: #0C1214;
  --tt-accent: #8FB3F0;
  --tt-link: #E6ECE9;
  --tt-focus: #E6ECE9;
  --tt-tile: #080C0E;
  --tt-board: #F1E8D4;
  --tt-tone-progress: #8FB3F0;
  --tt-tone-progress-on: #0C1214;
  --tt-tone-progress-ink: #8FB3F0;
  --tt-tone-waiting: #A3AFB3;
  --tt-tone-waiting-on: #0C1214;
  --tt-tone-waiting-ink: #A3AFB3;
  --tt-tone-attention: #E8A847;
  --tt-tone-attention-on: #0C1214;
  --tt-tone-attention-ink: #E8A847;
  --tt-tone-problem: #EF7C71;
  --tt-tone-problem-on: #0C1214;
  --tt-tone-problem-ink: #EF7C71;
  --tt-tone-done: #74CB9B;
  --tt-tone-done-on: #0C1214;
  --tt-tone-done-ink: #74CB9B;

  --tt-font-body: "Apple SD Gothic Neo", "Malgun Gothic", "맑은 고딕", "Noto Sans KR", "Noto Sans CJK KR", system-ui, -apple-system, sans-serif;
  --tt-font-display: "Apple SD Gothic Neo", "Malgun Gothic", "맑은 고딕", "Noto Sans KR", "Noto Sans CJK KR", system-ui, -apple-system, sans-serif;
  --tt-font-mono: var(--font-jetbrains-mono, "JetBrains Mono"), ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  --tt-weight-display: 700;
  --tt-text-xs: 12px;
  --tt-text-sm: 14px;
  --tt-text-md: 16px;
  --tt-text-lg: 20px;
  --tt-text-xl: 24px;
  --tt-text-eta: 36px;
  --tt-leading-tight: 1.25;
  --tt-leading-body: 1.5;
  --tt-radius-button: 4px;
  --tt-radius-card: 0px;
  --tt-border-button: 1px;
  --tt-focus-width: 3px;
  --tt-focus-offset: 2px;
  --tt-motion-fast: 150ms;
  --tt-motion-base: 200ms;
  --tt-motion-slow: 250ms;
  --tt-ease: cubic-bezier(0.2, 0, 0, 1);
  --tt-gutter: 20px;
  --tt-header-h: 48px;
  --tt-column: 560px;
  --tt-side: 320px;
  --tt-status-field-max: 300px;
  --tt-anchor-reserve: 64px;
}
```

- [ ] **Step 7: Load both files in `app/layout.tsx`**

Replace `import "./styles/tokens.css";` with:

```ts
import "./styles/tokens.css";
import "./styles/style-manifest.css";
import "./styles/style-night.css";
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/tokens.spec.ts tests/unit/ad-gate.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed — S05's "every implemented style meets every contrast requirement" now checks all three sets; Task 7's anchor-reserve test now also reads the two new files (`64px`).
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/ui-kit.spec.ts tests/e2e/home.spec.ts`
Expected: 0 failed (`style token sets on the page` `3 passed`; every page still renders `data-style="signal"`, so nothing else changes on screen).
Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 9: Commit**

Run: `git add lib/style/tokens.ts lib/style/styles.ts app/styles/style-manifest.css app/styles/style-night.css app/layout.tsx tests/unit/tokens.spec.ts tests/e2e/ui-kit.spec.ts; git commit -m "feat: add the manifest and night token sets"`

---

### Task 12: The pre-paint style script and its CSP hash

**Files:**
- Create: `lib/style/prepaint.ts`
- Modify: `app/layout.tsx` (two imports; the `<html>` opening tag; a `<head>` with the script)
- Modify: `next.config.ts` (one import; the `buildSecurityHeaders(…)` call)
- Test: `tests/unit/prepaint.spec.ts` (create), `tests/e2e/style-picker.spec.ts` (create)

**Interfaces:**
- Consumes: `STYLE_IDS`, `DEFAULT_STYLE_ID`, `DARK_STYLE_ID`, `STYLE_STORAGE_KEY` (S05 `lib/style/styles.ts`, for parity checks only); `style.followSystemDark` (S03 config, default `true`); `buildSecurityHeaders({ extraScriptHashes })` (S01 `lib/security/headers.ts`, the S01-private `ALL_ROUTES_SOURCE = "/:path*"`); S01's `next.config.ts` default export; test fixtures `FAKE`, `mockTrack`, `trackData` (S01).
- Produces (contract §11.9 + Addition 7): `PREPAINT_SCRIPT` (constant text), `PREPAINT_SCRIPT_SHA256` (`TdNQr4k3zLaTHH5Tbi0dMNlxgX+Y+iNDKf16t15FhKE=`), `PREPAINT_SCRIPT_ID` (`tt-prepaint`), `PREPAINT_CSP_SOURCE`; `<html data-style="signal" data-follow-dark="1|0" suppressHydrationWarning>` with `<head><script id="tt-prepaint">…</script></head>`; the Report-Only `script-src` carries the hash. Hook `data-follow-dark` (contract §11.13).

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/prepaint.spec.ts`:

```ts
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import { expect, test } from "@playwright/test";
import nextConfig from "@/next.config";
import { PREPAINT_CSP_SOURCE, PREPAINT_SCRIPT, PREPAINT_SCRIPT_ID, PREPAINT_SCRIPT_SHA256 } from "@/lib/style/prepaint";
import { DARK_STYLE_ID, DEFAULT_STYLE_ID, STYLE_IDS, STYLE_STORAGE_KEY } from "@/lib/style/styles";

interface PrepaintCase {
  readonly stored?: string | null;
  readonly storageThrows?: boolean;
  readonly followDark: "1" | "0" | null;
  readonly dark: boolean;
  readonly noMatchMedia?: boolean;
}

/** Runs the exact script text against a fake document, storage and media query; returns the data-style it set. */
function runPrepaint(input: PrepaintCase): string | null {
  const attributes = new Map<string, string>();
  if (input.followDark !== null) attributes.set("data-follow-dark", input.followDark);
  const documentElement = {
    getAttribute: (name: string): string | null => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string): void => {
      attributes.set(name, value);
    }
  };
  const fakeWindow: Record<string, unknown> = {};
  Object.defineProperty(fakeWindow, "localStorage", {
    get() {
      if (input.storageThrows === true) throw new Error("SecurityError: storage is blocked");
      return { getItem: (key: string): string | null => (key === STYLE_STORAGE_KEY ? (input.stored ?? null) : null) };
    }
  });
  if (input.noMatchMedia !== true) {
    fakeWindow.matchMedia = (query: string): { readonly matches: boolean } => ({
      matches: query === "(prefers-color-scheme: dark)" && input.dark
    });
  }
  runInNewContext(PREPAINT_SCRIPT, { window: fakeWindow, document: { documentElement } });
  return attributes.get("data-style") ?? null;
}

test("the script text and its SHA-256 are pinned together", () => {
  expect(createHash("sha256").update(PREPAINT_SCRIPT, "utf8").digest("base64")).toBe(PREPAINT_SCRIPT_SHA256);
  expect(PREPAINT_CSP_SOURCE).toBe(`'sha256-${PREPAINT_SCRIPT_SHA256}'`);
  expect(PREPAINT_SCRIPT_ID).toBe("tt-prepaint");
});

test("the script uses the storage key and the style ids of lib/style/styles.ts", () => {
  expect(PREPAINT_SCRIPT).toContain(`getItem("${STYLE_STORAGE_KEY}")`);
  for (const id of STYLE_IDS) expect(PREPAINT_SCRIPT).toContain(`"${id}"`);
  expect(PREPAINT_SCRIPT).toContain(`s="${DEFAULT_STYLE_ID}"`);
  expect(PREPAINT_SCRIPT).toContain(`s="${DARK_STYLE_ID}"`);
});

test("first visit: signal on a light device, night on a dark device when following it, signal when the switch is off", () => {
  expect(runPrepaint({ followDark: "1", dark: false })).toBe("signal");
  expect(runPrepaint({ followDark: "1", dark: true })).toBe("night");
  expect(runPrepaint({ followDark: "0", dark: true })).toBe("signal");
  expect(runPrepaint({ followDark: null, dark: true })).toBe("signal");
});

test("a stored valid choice always wins; an unknown stored value falls back to the first-visit rule", () => {
  expect(runPrepaint({ stored: "manifest", followDark: "1", dark: true })).toBe("manifest");
  expect(runPrepaint({ stored: "signal", followDark: "1", dark: true })).toBe("signal");
  expect(runPrepaint({ stored: "night", followDark: "0", dark: false })).toBe("night");
  expect(runPrepaint({ stored: "dark", followDark: "1", dark: false })).toBe("signal");
  expect(runPrepaint({ stored: "dark", followDark: "1", dark: true })).toBe("night");
});

test("storage that throws (in-app browsers, private windows) and a missing matchMedia never stop the script", () => {
  expect(runPrepaint({ storageThrows: true, followDark: "1", dark: false })).toBe("signal");
  expect(runPrepaint({ storageThrows: true, followDark: "1", dark: true })).toBe("night");
  expect(runPrepaint({ stored: "manifest", noMatchMedia: true, followDark: "1", dark: true })).toBe("manifest");
  expect(runPrepaint({ noMatchMedia: true, followDark: "1", dark: true })).toBe("signal");
});

test("next.config puts the hash into the Report-Only script-src and keeps the enforced CSP free of script rules", async () => {
  const rules = (await nextConfig.headers?.()) ?? [];
  const allRoutes = rules.find((rule) => rule.source === "/:path*");
  expect(allRoutes, "the all-routes header rule").toBeDefined();
  const valueOf = (key: string): string => allRoutes?.headers.find((header) => header.key === key)?.value ?? "";
  const scriptSrc = valueOf("Content-Security-Policy-Report-Only")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("script-src"));
  expect(scriptSrc).toContain(PREPAINT_CSP_SOURCE);
  expect(valueOf("Content-Security-Policy")).not.toContain("script-src");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/prepaint.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `Error: Cannot find module '@/lib/style/prepaint'` (no test runs).

- [ ] **Step 3: Create `lib/style/prepaint.ts`**

```ts
/**
 * Pre-paint style script (spec §13 "깜빡임 방지"). A tiny inline <head> script that sets html[data-style] before the
 * first paint: the stored choice (localStorage tt:style, read in try/catch); else "night" when the device is in dark mode
 * and html[data-follow-dark="1"] (config style.followSystemDark); else "signal". '/' stays static — the server always
 * renders data-style="signal" and this script changes the attribute in the browser before anything is painted.
 *
 * The text is a constant because its SHA-256 goes into the CSP (lib/security/headers.ts through next.config.ts), so an
 * enforced script-src can allow it by hash without 'unsafe-inline'. No imports: next.config.ts loads this file by a
 * relative path. The ids and the key must match lib/style/styles.ts; tests/unit/prepaint.spec.ts checks them and the hash.
 */
export const PREPAINT_SCRIPT_ID = "tt-prepaint";

export const PREPAINT_SCRIPT =
  '(function(){var d=document.documentElement,s=null;' +
  'try{s=window.localStorage.getItem("tt:style")}catch(e){}' +
  'if(s!=="signal"&&s!=="manifest"&&s!=="night"){s="signal";' +
  'try{if(d.getAttribute("data-follow-dark")==="1"&&window.matchMedia("(prefers-color-scheme: dark)").matches){s="night"}}catch(e){}}' +
  'd.setAttribute("data-style",s)})();';

/** base64 SHA-256 of PREPAINT_SCRIPT (UTF-8). Recompute it whenever the text changes: the unit test prints the new value. */
export const PREPAINT_SCRIPT_SHA256 = "TdNQr4k3zLaTHH5Tbi0dMNlxgX+Y+iNDKf16t15FhKE=";

/** The source expression for a CSP script-src. */
export const PREPAINT_CSP_SOURCE = `'sha256-${PREPAINT_SCRIPT_SHA256}'`;
```

- [ ] **Step 4: Pass the hash to the headers in `next.config.ts`**

(a) Below `import { buildSecurityHeaders } from "./lib/security/headers";` add:

```ts
import { PREPAINT_CSP_SOURCE } from "./lib/style/prepaint";
```

(b) In the `headers:` property, replace `buildSecurityHeaders()` with `buildSecurityHeaders({ extraScriptHashes: [PREPAINT_CSP_SOURCE] })`. If S11 already passes an options object (`buildSecurityHeaders({ reportUri: … })`), add `extraScriptHashes: [PREPAINT_CSP_SOURCE]` as another property of that object instead.

Run: `Select-String -Path next.config.ts -Pattern 'PREPAINT_CSP_SOURCE' | ForEach-Object { $_.LineNumber }`
Expected: two line numbers (the import and the call).

- [ ] **Step 5: Run the unit test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/prepaint.spec.ts tests/unit/security-headers.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed (`prepaint.spec.ts` `6 passed`; S01's header tests are unchanged because `buildSecurityHeaders` itself did not change). If the hash test fails, the script text in Step 3 was not copied exactly: copy it again; never change the pinned hash to match a different text without reviewing the difference.

- [ ] **Step 6: Write the failing E2E test**

Create `tests/e2e/style-picker.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";
import { style as styleConfig } from "@/config/site.config";
import { PREPAINT_CSP_SOURCE, PREPAINT_SCRIPT, PREPAINT_SCRIPT_ID, PREPAINT_SCRIPT_SHA256 } from "@/lib/style/prepaint";
import { STYLE_STORAGE_KEY } from "@/lib/style/styles";
import { FAKE, mockTrack, trackData } from "../fixtures/tracking-fixtures";

type StyleProbeWindow = Window & { __ttStyleAtBody?: string | null };

/** Records html[data-style] when <body> first appears — before anything in the body can be painted. */
async function recordStyleAtBody(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      if (document.body === null) return;
      (window as StyleProbeWindow).__ttStyleAtBody = document.documentElement.getAttribute("data-style");
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  });
}

async function styleAtBody(page: Page): Promise<string | null | undefined> {
  return page.evaluate(() => (window as StyleProbeWindow).__ttStyleAtBody);
}

async function storeStyle(page: Page, value: string): Promise<void> {
  await page.addInitScript(
    ([key, stored]) => {
      try {
        window.localStorage.setItem(key, stored);
      } catch {
        // storage blocked: the test that needs it fails on the style check instead
      }
    },
    [STYLE_STORAGE_KEY, value] as const
  );
}

/** Naver/Kakao in-app browsers and some private windows throw on any localStorage access. */
async function blockLocalStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      }
    });
  });
}

async function blockThirdParty(page: Page): Promise<void> {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
}

const DARK_FIRST_VISIT = styleConfig.followSystemDark ? "night" : "signal";

test.beforeEach(async ({ page }) => {
  await blockThirdParty(page);
});

test.describe("pre-paint style script (S08)", () => {
  test("the server renders the default style, the follow-dark flag and the script in <head> before <body>", async ({ request }) => {
    const html = await (await request.get("/")).text();
    expect(html).toMatch(/<html[^>]*\sdata-style="signal"/);
    expect(html).toMatch(new RegExp(`<html[^>]*\\sdata-follow-dark="${styleConfig.followSystemDark ? "1" : "0"}"`));
    const scriptAt = html.indexOf(`<script id="${PREPAINT_SCRIPT_ID}">`);
    expect(scriptAt).toBeGreaterThan(-1);
    expect(scriptAt).toBeLessThan(html.indexOf("<body"));
    expect(html).toContain(PREPAINT_SCRIPT);
  });

  test("the page's Report-Only CSP carries the script's hash, and the served script text hashes to it", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.headers()["content-security-policy-report-only"]).toContain(PREPAINT_CSP_SOURCE);
    const digest = await page.evaluate(async (id) => {
      const text = document.getElementById(id)?.textContent ?? "";
      const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }, PREPAINT_SCRIPT_ID);
    expect(digest).toBe(PREPAINT_SCRIPT_SHA256);
  });

  test("first visit on a light device: 기본 (signal) before the body appears", async ({ page }) => {
    await recordStyleAtBody(page);
    await page.goto("/");
    expect(await styleAtBody(page)).toBe("signal");
    await expect(page.locator("html")).toHaveAttribute("data-style", "signal");
  });

  test("an unknown stored value falls back to the first-visit rule", async ({ page }) => {
    await storeStyle(page, "dark");
    await recordStyleAtBody(page);
    await page.goto("/");
    expect(await styleAtBody(page)).toBe("signal");
  });

  test("storage that throws: the first-visit rule still applies, nothing breaks and a lookup still works", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      // Next's development overlay is not part of the page; only application errors count.
      if (!/next-devtools|dev-overlay/.test(error.stack ?? "")) errors.push(error.message);
    });
    await blockLocalStorage(page);
    await recordStyleAtBody(page);
    await mockTrack(page, trackData("delivered", { trackingNumber: FAKE.domestic }));
    await page.goto(`/${FAKE.domestic}`);
    expect(await styleAtBody(page)).toBe("signal");
    await expect(page.locator('[data-result-view="settled"]')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test.describe("on a dark device", () => {
    test.use({ colorScheme: "dark" });

    test("first visit starts in 어두운 화면 (night) before the body appears when the config follows the device", async ({ page }) => {
      await recordStyleAtBody(page);
      await page.goto("/");
      expect(await styleAtBody(page)).toBe(DARK_FIRST_VISIT);
    });

    test("a stored choice wins over the dark device", async ({ page }) => {
      await storeStyle(page, "manifest");
      await recordStyleAtBody(page);
      await page.goto("/");
      expect(await styleAtBody(page)).toBe("manifest");
    });

    test("storage that throws still follows the dark device", async ({ page }) => {
      await blockLocalStorage(page);
      await recordStyleAtBody(page);
      await page.goto("/");
      expect(await styleAtBody(page)).toBe(DARK_FIRST_VISIT);
    });
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false, colorScheme: "dark" });

    test("the page keeps the server default", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-style", "signal");
    });
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/style-picker.spec.ts`
Expected: `5 failed, 4 passed` — the server-HTML test (no `data-follow-dark`, no script), the CSP test (the header already carries the hash from Step 4, but the page has no `#tt-prepaint` to hash: `Received: "47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU="`, the digest of an empty string), the three dark-device tests (`Received: "signal"`); the light, unknown-value, throwing-storage and no-JavaScript rows pass already (the static default is `signal`) and keep guarding the rules.

- [ ] **Step 8: Render the script in `app/layout.tsx`**

(a) Below `import { DEFAULT_STYLE_ID } from "@/lib/style/styles";` add:

```ts
import { style as styleConfig } from "@/config/site.config";
import { PREPAINT_SCRIPT, PREPAINT_SCRIPT_ID } from "@/lib/style/prepaint";
```

(b) Replace the opening tag `<html lang="ko" data-style={DEFAULT_STYLE_ID} className={monoFont.variable}>` with:

```tsx
    <html
      lang="ko"
      data-style={DEFAULT_STYLE_ID}
      data-follow-dark={styleConfig.followSystemDark ? "1" : "0"}
      className={monoFont.variable}
      suppressHydrationWarning
    >
      <head>
        {/* Sets html[data-style] before the first paint (spec §13); allowed by its hash in the CSP (lib/style/prepaint.ts). */}
        <script id={PREPAINT_SCRIPT_ID} dangerouslySetInnerHTML={{ __html: PREPAINT_SCRIPT }} />
      </head>
```

(`suppressHydrationWarning` covers only `<html>`'s own attributes: the script may have changed `data-style` before React hydrates, and React leaves that attribute alone.)

- [ ] **Step 9: Run the tests to verify they pass**

Run: `if (Test-Path .next) { Remove-Item -Recurse -Force .next }; npm run typecheck`
Expected: exit 0.
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/style-picker.spec.ts tests/e2e/ui-kit.spec.ts tests/e2e/security-headers.spec.ts tests/e2e/home.spec.ts tests/e2e/deep-link.spec.ts`
Expected: 0 failed (`style-picker.spec.ts` `9 passed`). Playwright's default `colorScheme` is `light`, so every other spec still sees `signal`.
Run the whole dev-mode suite: `npx playwright test`
Expected: 0 failed. Chromium now logs `[Report Only] Refused to execute inline script …` for Next's own inline scripts (a CSP3 browser ignores `'unsafe-inline'` once a hash is present; S01 open issue 4) — report-only, nothing is blocked. If a test fails because it collects console errors, change that test's filter to ignore messages that start with `[Report Only]` (a test-only edit; name the file in the stage summary).
Run: `npm run lint`
Expected: exit 0 (`@next/next/no-head-element` does not apply to the `app/` directory).

- [ ] **Step 10: Commit**

Run: `git add lib/style/prepaint.ts app/layout.tsx next.config.ts tests/unit/prepaint.spec.ts tests/e2e/style-picker.spec.ts; git commit -m "feat: set the screen style before the first paint with a hash-allowed inline script"`

---

### Task 13: Variant slots and per-style digit fonts

**Files:**
- Modify: `app/styles/style-manifest.css`, `app/styles/style-night.css` (append the slot rules)
- Modify: `app/layout.tsx` (the font import; two font declarations; the `<html>` class)
- Modify: `tests/e2e/ui-kit.spec.ts` (one regex in S05's root-layout test; imports; append), `tests/budgets/font-preload.spec.ts` (one regex in S05's block; imports; append)

**Interfaces:**
- Consumes: S05's slot CSS contract (Addition 4: `--field-bg`/`--field-fg` on `[data-slot="status-head"][data-tone]`, `--chip-bg`/`--chip-fg` on `[data-status-chip][data-tone]`, `--journey-fill`/`--journey-todo`/`--journey-on-fill`, `--eta-badge-*`, `.tt-focus`), S05's styling hooks (Addition 3: `data-spine-part`, `data-eta-visual`, `data-eta-digit`, `data-eta-label`, `data-variant`), gallery demos `chips`, `field-<tone>`, `eta-date` (S05 Addition 16); `STYLE_COLOR_TOKENS` (Task 11); S05's font-budget helper `collectFirstViewFonts(page, path)` and `FIRST_VIEW_FONT_BUDGET_BYTES`; `STYLE_STORAGE_KEY` (S05).
- Produces: `manifest` — status head on paper with a rotated double-ruled stamp chip, entry-line date in IBM Plex Mono, solid past route and dashed remaining route; `night` — status head on the raised layer with a tone-colored top rule, chips with a flat round lamp, digit tiles (`--tt-tile`/`--tt-board`), rounded current/issue stations; button corners/borders from the token blocks. Fonts `--font-plex-mono` (IBM Plex Mono 600) and `--font-jetbrains-mono` (JetBrains Mono 500), latin, `preload: false`.

- [ ] **Step 1: Write the failing tests**

In `tests/e2e/ui-kit.spec.ts`:
(a) In S05's test "pages render html[data-style=signal] with the signal tokens and only the DM Mono web font", replace `/IBM[_ ]Plex|Space[_ ]Grotesk/` with `/IBM[_ ]Plex[_ ]Sans|Space[_ ]Grotesk/` (the retired body font stays banned; IBM Plex Mono is the manifest digit font, Addition 11).
(b) Below the existing `@/lib/style/tokens` import add `import type { StyleId } from "@/lib/style/styles";`.
(c) Append:

```ts
async function applyStyle(page: Page, id: StyleId): Promise<void> {
  await page.evaluate((style) => document.documentElement.setAttribute("data-style", style), id);
  await settleAnimations(page);
}

function rgbToHex(value: string): string {
  const parts = /rgba?\(([^)]+)\)/.exec(value)?.[1].split(/[\s,/]+/).filter(Boolean).map(Number) ?? [];
  return `#${parts
    .slice(0, 3)
    .map((part) => Math.round(part).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

test.describe("every screen style (S08)", () => {
  for (const id of ["manifest", "night"] as const) {
    test(`${id}: no text at 11px or less, every text 4.5:1, no horizontal scroll at 320px`, async ({ page }) => {
      await openKit(page, 375, 812);
      await applyStyle(page, id);
      const samples = await visibleTextSamples(page);
      expect(samples.filter((sample) => sample.size <= 11).map((sample) => `${sample.size}px ${sample.text}`)).toEqual([]);
      const failures = samples
        .map((sample) => ({ ...sample, ratio: contrastRatio(sample.fg, sample.bg) }))
        .filter((sample) => sample.ratio < 4.5)
        .map((sample) => `${sample.text}: ${sample.fg} on ${sample.bg} = ${sample.ratio.toFixed(2)}`);
      expect(failures).toEqual([]);
      await page.setViewportSize({ width: 320, height: 800 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });

    test(`${id}: every focusable element shows a 3px focus ring at 3:1 or more`, async ({ page }) => {
      await openKit(page);
      await applyStyle(page, id);
      const failures: string[] = [];
      let inside = 0;
      for (let press = 0; press < 250; press += 1) {
        await page.keyboard.press("Tab");
        const probe = await probeFocused(page);
        if (!probe) {
          if (inside > 0) break;
          continue;
        }
        inside += 1;
        const ratio = probe.ring ? contrastRatio(probe.ring, probe.background) : 0;
        if (probe.style === "none" || probe.width < 3 || ratio < 3) {
          failures.push(`${probe.name}: ${probe.style} ${probe.width}px ${probe.ring} on ${probe.background} = ${ratio.toFixed(2)}`);
        }
      }
      expect(inside).toBeGreaterThanOrEqual(5);
      expect(failures).toEqual([]);
    });
  }

  test("manifest: the status chip is a stamp, the date an entry line in the digit font, the remaining route dashed", async ({ page }) => {
    await openKit(page);
    await applyStyle(page, "manifest");
    const stamp = await page.locator('[data-demo="field-progress"] [data-status-chip]').evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, border: style.borderTopStyle, width: style.borderTopWidth, transform: style.transform, color: style.color };
    });
    expect(stamp.background).toBe("rgba(0, 0, 0, 0)");
    expect(stamp.border).toBe("double");
    expect(stamp.width).toBe("3px");
    expect(stamp.transform).not.toBe("none");
    expect(rgbToHex(stamp.color)).toBe(STYLE_COLOR_TOKENS.manifest?.["--tt-tone-progress-ink"]);
    const entry = await page.locator('[data-demo="eta-date"] [data-eta-visual]').evaluate((element) => {
      const style = getComputedStyle(element);
      return { line: style.borderBottomStyle, family: style.fontFamily };
    });
    expect(entry.line).toBe("solid");
    expect(entry.family).toMatch(/IBM[_ ]Plex[_ ]Mono/);
    const todo = await page.locator('[data-slot="journey"] [data-station-state="todo"] [data-spine-part="bar"]').first().evaluate((element) => getComputedStyle(element).borderTopStyle);
    expect(todo).toBe("dashed");
  });

  test("night: chips carry a flat lamp, the date sits on digit tiles, the current station is round", async ({ page }) => {
    await openKit(page);
    await applyStyle(page, "night");
    const night = STYLE_COLOR_TOKENS.night;
    const lamp = await page.locator('[data-demo="chips"] [data-status-chip][data-tone="progress"]').evaluate((element) => {
      const style = getComputedStyle(element, "::before");
      return { content: style.content, background: style.backgroundColor, radius: style.borderTopLeftRadius };
    });
    expect(lamp.content).toBe('""');
    expect(lamp.radius).toBe("50%");
    expect(rgbToHex(lamp.background)).toBe(night?.["--tt-tone-progress"]);
    const tile = await page.locator('[data-demo="eta-date"] [data-eta-digit]').first().evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color, family: style.fontFamily };
    });
    expect(rgbToHex(tile.background)).toBe(night?.["--tt-tile"]);
    expect(rgbToHex(tile.color)).toBe(night?.["--tt-board"]);
    expect(tile.family).toMatch(/JetBrains[_ ]Mono/);
    const current = await page.locator('[data-slot="journey"] [data-station-state="current"] [data-spine-part="bar"]').first().evaluate((element) => getComputedStyle(element).borderTopLeftRadius);
    expect(current).toBe("999px");
  });
});
```

In `tests/budgets/font-preload.spec.ts`:
(a) In S05's block "signal style fonts (S05)", replace `/IBM[_ ]Plex|Space[_ ]Grotesk/` with `/IBM[_ ]Plex[_ ]Sans|Space[_ ]Grotesk/`.
(b) Add below the existing imports: `import { STYLE_STORAGE_KEY } from "@/lib/style/styles";`.
(c) Append:

```ts
// ---- S08: per-style digit fonts (spec §13 "서류형·어두운 화면의 서체는 그 스타일을 고른 경우에만 내려받습니다") ----
const DIGIT_FONTS = [
  { style: "signal", loads: /DM[_ ]Mono/, never: /IBM[_ ]Plex[_ ]Mono|JetBrains[_ ]Mono/ },
  { style: "manifest", loads: /IBM[_ ]Plex[_ ]Mono/, never: /JetBrains[_ ]Mono/ },
  { style: "night", loads: /JetBrains[_ ]Mono/, never: /IBM[_ ]Plex[_ ]Mono/ }
] as const;

test.describe("per-style digit fonts (S08)", () => {
  test.skip(!IS_PRODUCTION_RUN, "budgets run against next start");

  for (const { style, loads, never } of DIGIT_FONTS) {
    test(`${style}: one preload, its digit font loads only in that style, first-view fonts within 100 KB`, async ({ page }) => {
      await page.addInitScript(
        ([key, value]) => {
          try {
            window.localStorage.setItem(key, value);
          } catch {
            // no storage: the style check below fails and names the reason
          }
        },
        [STYLE_STORAGE_KEY, style] as const
      );
      await mockTrack(page, trackData("customsWaiting"));
      const fonts = await collectFirstViewFonts(page, `/${FAKE.domestic}`);
      await expect(page.locator("html")).toHaveAttribute("data-style", style);
      const loaded = await page.evaluate(() => Array.from(document.fonts).filter((face) => face.status === "loaded").map((face) => face.family));
      console.info(`[font-budget] ${style} deep link: ${fonts.totalBytes} B in the first view, ${fonts.preloadCount} preload(s), loaded ${loaded.join(", ")}`);
      expect(fonts.preloadCount).toBe(1);
      expect(fonts.totalBytes).toBeLessThanOrEqual(FIRST_VIEW_FONT_BUDGET_BYTES);
      expect(loaded.some((family) => loads.test(family)), `${style} loads its digit font`).toBe(true);
      expect(loaded.filter((family) => never.test(family))).toEqual([]);
    });
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/ui-kit.spec.ts -g "every screen style"`
Expected: FAIL — the two slot tests (`border: "none"` instead of `"double"`; no `::before` lamp) fail; the four generic per-style rows pass already (Task 11's tokens meet every contrast pair) and keep guarding the rules; record the split.
Run the production run of `tests/budgets/font-preload.spec.ts` (Conventions).
Expected: the `manifest` and `night` rows fail (`manifest loads its digit font` — `false`: `--font-plex-mono` is not defined yet, so the stack falls back to installed monospace fonts); `signal` passes. Stop the server and clear the flags.

- [ ] **Step 3: Append the manifest slots to `app/styles/style-manifest.css`**

```css

/* ---------- 변형 슬롯 status-head — manifest: 종이 위 도장 ----------
 * 색면 대신 서류 면에 잉크 글자. 상태는 칩 하나가 2° 기울어진 겹테두리 도장으로 찍힙니다(색 + 아이콘 + 문구). */
[data-style="manifest"] [data-slot="status-head"][data-tone] {
  --field-bg: var(--tt-surface);
  --field-fg: var(--tt-ink);
  border-top: 1px solid var(--tt-ink);
  border-bottom: 1px solid var(--tt-rule);
}
[data-style="manifest"] [data-status-chip] {
  background-color: transparent;
  color: var(--chip-stamp);
  border: 3px double var(--chip-stamp);
  font-family: var(--tt-font-display);
  transform: rotate(-2deg);
}
[data-style="manifest"] [data-status-chip][data-tone="neutral"] { --chip-stamp: var(--tt-ink); }
[data-style="manifest"] [data-status-chip][data-tone="progress"] { --chip-stamp: var(--tt-tone-progress-ink); }
[data-style="manifest"] [data-status-chip][data-tone="waiting"] { --chip-stamp: var(--tt-tone-waiting-ink); }
[data-style="manifest"] [data-status-chip][data-tone="attention"] { --chip-stamp: var(--tt-tone-attention-ink); }
[data-style="manifest"] [data-status-chip][data-tone="problem"] { --chip-stamp: var(--tt-tone-problem-ink); }
[data-style="manifest"] [data-status-chip][data-tone="done"] { --chip-stamp: var(--tt-tone-done-ink); }

/* ---------- 변형 슬롯 eta — manifest: 기입값 ----------
 * 라벨은 서식 글자, 날짜는 고정폭 숫자로 밑줄 칸 위에 적습니다. */
[data-style="manifest"] [data-slot="eta"] [data-eta-label] {
  letter-spacing: 0.08em;
}
[data-style="manifest"] [data-slot="eta"] [data-eta-visual] {
  padding-bottom: 4px;
  border-bottom: 1px solid currentColor;
  font-family: var(--tt-font-mono);
  font-weight: 600;
  letter-spacing: 0;
}

/* ---------- 변형 슬롯 journey — manifest: 운송장 경로 ----------
 * 지나온 길은 가는 실선, 남은 길은 점선, 지금 구간과 문제 구간은 그대로 굵은 칸입니다. */
[data-style="manifest"] [data-slot="journey"] [data-spine-part="bar"] {
  height: 4px;
}
[data-style="manifest"] [data-slot="journey"] [data-station-state="todo"] [data-spine-part="bar"] {
  height: 0;
  border: 0;
  border-top: 2px dashed var(--journey-todo);
}
[data-style="manifest"] [data-slot="journey"] [data-station-state="current"] [data-spine-part="bar"],
[data-style="manifest"] [data-slot="journey"] li[data-issue] [data-spine-part="bar"] {
  height: 20px;
}

@media (forced-colors: active) {
  [data-style="manifest"] [data-status-chip] { border-color: CanvasText; }
}
```

- [ ] **Step 4: Append the night slots to `app/styles/style-night.css`**

```css

/* ---------- 변형 슬롯 status-head — night: 램프 ----------
 * 색면 대신 한 단계 밝은 층에 잉크 글자, 윗선과 칩의 램프만 상태 톤 색입니다. 글자는 늘 잉크입니다. */
[data-style="night"] [data-slot="status-head"][data-tone] {
  --field-bg: var(--tt-raised);
  --field-fg: var(--tt-ink);
  border-top: 2px solid var(--field-lamp);
}
[data-style="night"] [data-slot="status-head"][data-tone="neutral"] { --field-lamp: var(--tt-rule); }
[data-style="night"] [data-slot="status-head"][data-tone="progress"] { --field-lamp: var(--tt-tone-progress); }
[data-style="night"] [data-slot="status-head"][data-tone="waiting"] { --field-lamp: var(--tt-tone-waiting); }
[data-style="night"] [data-slot="status-head"][data-tone="attention"] { --field-lamp: var(--tt-tone-attention); }
[data-style="night"] [data-slot="status-head"][data-tone="problem"] { --field-lamp: var(--tt-tone-problem); }
[data-style="night"] [data-slot="status-head"][data-tone="done"] { --field-lamp: var(--tt-tone-done); }
[data-style="night"] [data-status-chip] {
  background-color: transparent;
  color: var(--tt-ink);
  border: 1px solid var(--chip-lamp);
}
[data-style="night"] [data-status-chip]::before {
  content: "";
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: var(--chip-lamp);
}
[data-style="night"] [data-status-chip][data-tone="neutral"] { --chip-lamp: var(--tt-muted); }
[data-style="night"] [data-status-chip][data-tone="progress"] { --chip-lamp: var(--tt-tone-progress); }
[data-style="night"] [data-status-chip][data-tone="waiting"] { --chip-lamp: var(--tt-tone-waiting); }
[data-style="night"] [data-status-chip][data-tone="attention"] { --chip-lamp: var(--tt-tone-attention); }
[data-style="night"] [data-status-chip][data-tone="problem"] { --chip-lamp: var(--tt-tone-problem); }
[data-style="night"] [data-status-chip][data-tone="done"] { --chip-lamp: var(--tt-tone-done); }

/* ---------- 변형 슬롯 eta — night: 숫자 타일 ----------
 * 날짜의 숫자 하나하나를 어두운 칸(tile) 위 밝은 글자(board)로 세웁니다. 넘김 없이 제자리에 둡니다. */
[data-style="night"] [data-slot="eta"] [data-eta-visual] {
  font-family: var(--tt-font-mono);
  letter-spacing: 0;
}
[data-style="night"] [data-slot="eta"] [data-eta-digit] {
  display: inline-block;
  min-width: 0.9em;
  margin: 0 1px;
  padding: 2px 4px;
  background-color: var(--tt-tile);
  color: var(--tt-board);
  text-align: center;
}

/* ---------- 변형 슬롯 journey — night: 노선도 ----------
 * 지나온 길은 가는 선, 남은 길은 점선, 지금 역과 문제 역은 둥근 램프입니다. */
[data-style="night"] [data-slot="journey"] [data-spine-part="bar"] {
  height: 4px;
}
[data-style="night"] [data-slot="journey"] [data-station-state="todo"] [data-spine-part="bar"] {
  height: 0;
  border: 0;
  border-top: 2px dashed var(--journey-todo);
}
[data-style="night"] [data-slot="journey"] [data-station-state="current"] [data-spine-part="bar"],
[data-style="night"] [data-slot="journey"] li[data-issue] [data-spine-part="bar"] {
  height: 20px;
  border-radius: 999px;
}

@media (forced-colors: active) {
  [data-style="night"] [data-status-chip]::before { background-color: CanvasText; }
  [data-style="night"] [data-slot="eta"] [data-eta-digit] { border: 1px solid CanvasText; }
}
```

- [ ] **Step 5: Add the two digit fonts in `app/layout.tsx`**

(a) Replace `import { DM_Mono } from "next/font/google";` with `import { DM_Mono, IBM_Plex_Mono, JetBrains_Mono } from "next/font/google";`.
(b) Directly below the whole `const monoFont = DM_Mono({ … });` declaration add:

```ts
// Digit fonts of the other two styles: never preloaded, and referenced only by their style's token block
// (app/styles/style-manifest.css, style-night.css), so a browser downloads one only when that style is on screen.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: "600",
  display: "swap",
  preload: false,
  variable: "--font-plex-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"]
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: "500",
  display: "swap",
  preload: false,
  variable: "--font-jetbrains-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"]
});
```

(c) In the `<html>` opening tag, replace `className={monoFont.variable}` with ``className={`${monoFont.variable} ${plexMono.variable} ${jetbrainsMono.variable}`}``.

- [ ] **Step 6: Run the tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/ui-kit.spec.ts tests/e2e/style-picker.spec.ts`
Expected: 0 failed (`ui-kit.spec.ts` gains `6 passed` for "every screen style (S08)"; S05's signal checks are unchanged — none of the new rules match without `[data-style="manifest"]`/`[data-style="night"]`).
Run the production run of `tests/budgets/font-preload.spec.ts tests/budgets/css-budget.spec.ts` (Conventions).
Expected: 0 failed; three `[font-budget] … deep link` lines (one preload each; manifest loads IBM Plex Mono and no JetBrains Mono, night the reverse, signal neither) and three `[css-budget]` lines still at or under 25600 B. Record all six lines. Stop the server and clear the flags.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 7: Commit**

Run: `git add app/styles/style-manifest.css app/styles/style-night.css app/layout.tsx tests/e2e/ui-kit.spec.ts tests/budgets/font-preload.spec.ts; git commit -m "feat: style the four variant slots for manifest and night and load their digit fonts on demand"`

---

### Task 14: The '화면 스타일' picker

**Files:**
- Create: `lib/style/style-choice.ts`, `components/shell/StylePicker.tsx`
- Modify: `app/(public)/layout.tsx` (import; one element)
- Modify: `app/(internal)/internal/ui-kit/page.tsx` (import; render `<StyleSection />`; append the section)
- Test: `tests/e2e/style-picker.spec.ts` (imports, append), `tests/unit/prepaint.spec.ts` (imports, append)

**Interfaces:**
- Consumes: `STYLE_IDS`, `STYLE_LABELS`, `DEFAULT_STYLE_ID`, `STYLE_STORAGE_KEY`, `isStyleId`, `StyleId` (S05); `useAnnounce()` (S04 `LiveAnnouncer`; a no-op outside the provider, as on `/internal`); Task 12's pre-paint script (it applied the stored or first-visit style before hydration); Task 5's `app/(public)/layout.tsx`.
- Produces (contract §11.9 + Addition 8): `readAppliedStyle(): StyleId`, `subscribeAppliedStyle(listener): () => void`, `applyStyleChoice(id, storage?)`; `StylePicker(): React.JSX.Element` — `<div><fieldset data-style-picker="true"><legend>화면 스타일</legend>` with three labelled radios (44 px labels) named '기본' '서류형' '어두운 화면'; choosing one sets `html[data-style]` at once, writes `tt:style` in a try/catch and announces '화면 스타일을 {label}으로 바꿨어요' once. Placed in the public layout directly above `SiteFooter` (Addition 12); gallery demo `data-demo="style-picker"`.

- [ ] **Step 1: Write the failing tests**

In `tests/e2e/style-picker.spec.ts`:
(a) Replace `import { STYLE_STORAGE_KEY } from "@/lib/style/styles";` with `import { STYLE_IDS, STYLE_LABELS, STYLE_STORAGE_KEY, type StyleId } from "@/lib/style/styles";`.
(b) Append:

```ts
const LEGEND = "화면 스타일";

function announcement(id: StyleId): string {
  return `화면 스타일을 ${STYLE_LABELS[id]}으로 바꿨어요`;
}

async function choose(page: Page, id: StyleId): Promise<void> {
  await page.getByRole("group", { name: LEGEND }).getByRole("radio", { name: STYLE_LABELS[id], exact: true }).check();
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test.describe("'화면 스타일' picker (S08)", () => {
  test("right above the footer on every public page: a fieldset '화면 스타일' with three 44 px radios", async ({ page }) => {
    await mockTrack(page, trackData("delivered", { trackingNumber: FAKE.domestic }));
    for (const path of ["/", `/${FAKE.domestic}`, "/privacy"]) {
      await page.goto(path);
      const picker = page.getByRole("group", { name: LEGEND });
      await expect(picker, path).toHaveCount(1);
      await expect(picker).toHaveAttribute("data-style-picker", "true");
      await expect(picker.getByRole("radio")).toHaveCount(3);
      for (const id of STYLE_IDS) {
        const label = picker.locator("label", { has: page.getByRole("radio", { name: STYLE_LABELS[id], exact: true }) });
        expect((await label.boundingBox())?.height ?? 0, `${path} ${id}`).toBeGreaterThanOrEqual(44);
      }
      const aboveFooter = await page.evaluate(() => {
        const footer = document.querySelector("footer");
        const picker = document.querySelector("[data-style-picker]");
        return footer !== null && picker !== null && footer.previousElementSibling?.contains(picker) === true;
      });
      expect(aboveFooter, path).toBe(true);
    }
  });

  test("the applied style's radio is checked and nothing is stored until the customer chooses", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("group", { name: LEGEND }).getByRole("radio", { name: STYLE_LABELS.signal, exact: true })).toBeChecked();
    expect(await page.evaluate((key) => window.localStorage.getItem(key), STYLE_STORAGE_KEY)).toBeNull();
  });

  test("choosing 서류형 applies it at once, announces it once, remembers it and survives a reload", async ({ page }) => {
    await page.goto("/");
    const region = page.locator('[data-live-region="polite"]');
    await expect(region).toHaveText("");
    await choose(page, "manifest");
    await expect(page.locator("html")).toHaveAttribute("data-style", "manifest");
    await expect(region).toHaveText(announcement("manifest"));
    expect(await page.evaluate((key) => window.localStorage.getItem(key), STYLE_STORAGE_KEY)).toBe("manifest");
    await recordStyleAtBody(page);
    await page.reload();
    expect(await styleAtBody(page)).toBe("manifest");
    await expect(page.getByRole("group", { name: LEGEND }).getByRole("radio", { name: STYLE_LABELS.manifest, exact: true })).toBeChecked();
    await expect(page.locator('[data-live-region="polite"]')).toHaveText("");
  });

  test("keyboard: the arrow keys move through the styles and each change is announced", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("group", { name: LEGEND }).getByRole("radio", { name: STYLE_LABELS.signal, exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("html")).toHaveAttribute("data-style", "manifest");
    await expect(page.locator('[data-live-region="polite"]')).toHaveText(announcement("manifest"));
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("html")).toHaveAttribute("data-style", "night");
    await expect(page.locator('[data-live-region="polite"]')).toHaveText(announcement("night"));
  });

  test("storage that throws: the picker still switches the style for this page and announces it", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      // Next's development overlay is not part of the page; only application errors count.
      if (!/next-devtools|dev-overlay/.test(error.stack ?? "")) errors.push(error.message);
    });
    await blockLocalStorage(page);
    await page.goto("/");
    await choose(page, "night");
    await expect(page.locator("html")).toHaveAttribute("data-style", "night");
    await expect(page.locator('[data-live-region="polite"]')).toHaveText(announcement("night"));
    expect(errors).toEqual([]);
  });

  test("a style change keeps the result's structure, hooks and copy", async ({ page }) => {
    await mockTrack(page, trackData("delivered", { trackingNumber: FAKE.domestic }));
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator('[data-result-view="settled"]')).toBeVisible();
    await page.waitForLoadState("networkidle");
    const snapshot = (): Promise<{ readonly text: string; readonly hooks: string }> =>
      page.locator("[data-view-state]").evaluate((root) => ({
        text: root.textContent ?? "",
        hooks: Array.from(root.querySelectorAll("*"), (element) =>
          Array.from(element.attributes)
            .filter((attribute) => attribute.name.startsWith("data-"))
            .map((attribute) => `${attribute.name}=${attribute.value}`)
            .join(" ")
        ).join("|")
      }));
    const before = await snapshot();
    for (const id of ["manifest", "night", "signal"] as const) {
      await choose(page, id);
      await expect(page.locator("html")).toHaveAttribute("data-style", id);
      expect(await snapshot(), id).toEqual(before);
    }
  });

  test("320 px in every style: no horizontal scroll on the home and on a long-number result", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.cargo }));
    for (const id of STYLE_IDS) {
      await page.goto("/");
      await choose(page, id);
      expect(await horizontalOverflow(page), `${id} home`).toBeLessThanOrEqual(0);
      await page.goto(`/${FAKE.cargo}`);
      await expect(page.locator("[data-result-view] h2")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-style", id);
      expect(await horizontalOverflow(page), `${id} result`).toBeLessThanOrEqual(0);
    }
  });

  test("the choice never leaves the browser: no request carries it", async ({ page }) => {
    const carried: string[] = [];
    page.on("request", (request) => {
      const text = `${request.url()} ${request.postData() ?? ""}`;
      if (text.includes(STYLE_STORAGE_KEY) || text.includes(encodeURIComponent(STYLE_STORAGE_KEY))) carried.push(request.url());
    });
    await page.goto("/");
    await choose(page, "night");
    await mockTrack(page, trackData("delivered", { trackingNumber: FAKE.domestic }));
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator('[data-result-view="settled"]')).toBeVisible();
    expect(carried).toEqual([]);
  });
});
```

In `tests/unit/prepaint.spec.ts`:
(a) Add below the first import line: `import { readdirSync, readFileSync, statSync } from "node:fs";` and `import path from "node:path";`.
(b) Append:

```ts
test("only the root layout, the style modules and the picker read or write the style (style-independent DOM, S08)", () => {
  const ROOT = process.cwd();
  const ALLOWED = new Set([
    "app/layout.tsx",
    "lib/style/styles.ts",
    "lib/style/prepaint.ts",
    "lib/style/style-choice.ts",
    "components/shell/StylePicker.tsx"
  ]);
  const STYLE_ACCESS = /data-style|dataset\.style|STYLE_STORAGE_KEY|tt:style|applyStyleChoice|readAppliedStyle/;
  const stripComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
  const walk = (dir: string): string[] =>
    readdirSync(path.join(ROOT, dir)).flatMap((name) => {
      const relative = `${dir}/${name}`;
      if (statSync(path.join(ROOT, relative)).isDirectory()) return walk(relative);
      return /\.(ts|tsx)$/.test(name) ? [relative] : [];
    });
  const offenders = ["app", "components", "lib", "config"]
    .flatMap(walk)
    .filter((file) => !ALLOWED.has(file) && STYLE_ACCESS.test(stripComments(readFileSync(path.join(ROOT, file), "utf8"))));
  expect(offenders).toEqual([]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/style-picker.spec.ts -g "picker"`
Expected: FAIL — every picker test times out on `getByRole('group', { name: '화면 스타일' })` except "a style change keeps …", which fails the same way at its first `choose`; record the count (8 failed).
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/prepaint.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `7 passed` — the new scan passes before the picker exists and keeps guarding the rule; if it lists a file, a component already reads the style: move that logic behind the picker or into CSS before going on.

- [ ] **Step 3: Create `lib/style/style-choice.ts`**

```ts
import { DEFAULT_STYLE_ID, STYLE_STORAGE_KEY, isStyleId, type StyleId } from "@/lib/style/styles";

/**
 * The customer's screen-style choice in the browser (spec §13 "화면 스타일 선택"). The pre-paint script (lib/style/prepaint.ts)
 * applied the stored or first-visit style before hydration; this module reads that attribute, applies later choices at
 * once and remembers them in this browser only (localStorage tt:style — never sent anywhere). Browser only.
 */
type StyleStorage = Pick<Storage, "setItem">;

const listeners = new Set<() => void>();

export function readAppliedStyle(): StyleId {
  const value = document.documentElement.getAttribute("data-style");
  return isStyleId(value) ? value : DEFAULT_STYLE_ID;
}

export function subscribeAppliedStyle(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function browserStorage(): StyleStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Applies the style at once; a blocked storage (in-app browsers, private windows) only means the choice lasts for this page. */
export function applyStyleChoice(id: StyleId, storage: StyleStorage | null = browserStorage()): void {
  document.documentElement.setAttribute("data-style", id);
  try {
    storage?.setItem(STYLE_STORAGE_KEY, id);
  } catch {
    // Storage refused the write: the style still applies until the page is left.
  }
  listeners.forEach((listener) => listener());
}
```

- [ ] **Step 4: Create `components/shell/StylePicker.tsx`**

```tsx
"use client";

import { useSyncExternalStore } from "react";
import { useAnnounce } from "@/components/primitives/LiveAnnouncer";
import { applyStyleChoice, readAppliedStyle, subscribeAppliedStyle } from "@/lib/style/style-choice";
import { STYLE_IDS, STYLE_LABELS, type StyleId } from "@/lib/style/styles";

/** Spec §13 literals: the group's name and the one sentence read after a change. */
const LEGEND = "화면 스타일";
const RADIO_NAME = "tt-style";

function announcementFor(id: StyleId): string {
  return `화면 스타일을 ${STYLE_LABELS[id]}으로 바꿨어요`;
}

/** '/' is static, so the server cannot know the customer's style: no radio is checked until hydration reads html[data-style]. */
function readServerStyle(): StyleId | null {
  return null;
}

/**
 * '화면 스타일' (spec §13): three radios right above the footer. A choice changes only html[data-style] — every component
 * keeps its DOM, hooks and copy — is remembered in this browser, and is announced once through the page's live region.
 */
export function StylePicker(): React.JSX.Element {
  const current = useSyncExternalStore<StyleId | null>(subscribeAppliedStyle, readAppliedStyle, readServerStyle);
  const announce = useAnnounce();

  const choose = (id: StyleId): void => {
    if (id === current) return;
    applyStyleChoice(id);
    announce(announcementFor(id));
  };

  return (
    <div className="border-t border-tt-rule bg-tt-surface text-tt-ink">
      <fieldset data-style-picker="true" className="mx-auto w-full max-w-[var(--tt-column)] border-0 px-[var(--tt-gutter)] py-4">
        <legend className="mb-2 p-0 text-tt-sm font-bold">{LEGEND}</legend>
        <div className="grid grid-cols-3 gap-2">
          {STYLE_IDS.map((id) => (
            <label
              key={id}
              className="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 border border-tt-control px-2 text-tt-sm font-bold [word-break:keep-all] has-[:checked]:border-2 has-[:checked]:border-tt-ink"
            >
              <input
                type="radio"
                name={RADIO_NAME}
                value={id}
                checked={current === id}
                onChange={() => choose(id)}
                className="tt-focus m-0 h-5 w-5 shrink-0 accent-[var(--tt-primary)]"
              />
              <span>{STYLE_LABELS[id]}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
```

- [ ] **Step 5: Place it above the footer and in the gallery**

In `app/(public)/layout.tsx`:
(a) Below `import { SiteHeader } from "@/components/shell/SiteHeader";` add `import { StylePicker } from "@/components/shell/StylePicker";`.
(b) Replace the line `      <SiteFooter />` with:

```tsx
      <StylePicker />
      <SiteFooter />
```

In `app/(internal)/internal/ui-kit/page.tsx`:
(a) Below `import { ManualAdSlot } from "@/components/ads/ManualAdSlot";` add `import { StylePicker } from "@/components/shell/StylePicker";`.
(b) Replace `        <AdSlotSection />` with:

```tsx
        <AdSlotSection />
        <StyleSection />
```

(c) Append to the end of the file:

```tsx
/** The real picker: choosing a style here restyles the whole gallery (this browser remembers it, as on the public pages). */
function StyleSection(): React.JSX.Element {
  return (
    <Section id="style-picker" title="화면 스타일 고르기">
      <div data-demo="style-picker">
        <StylePicker />
      </div>
    </Section>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `if (Test-Path .next) { Remove-Item -Recurse -Force .next }; npm run typecheck`
Expected: exit 0.
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/style-picker.spec.ts tests/e2e/ui-kit.spec.ts tests/e2e/ad-placement.spec.ts tests/privacy.spec.ts tests/e2e/home.spec.ts`
Expected: 0 failed (`style-picker.spec.ts` `17 passed`; S05's gallery checks now also tab through the three radios and find a 3 px ring on each; Task 5's footer tests still find one `contentinfo`).
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed (the style-independence scan allows exactly the five files).
Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 7: Commit**

Run: `git add lib/style/style-choice.ts components/shell/StylePicker.tsx "app/(public)/layout.tsx" "app/(internal)/internal/ui-kit/page.tsx" tests/e2e/style-picker.spec.ts tests/unit/prepaint.spec.ts; git commit -m "feat: add the '화면 스타일' picker above the footer"`

---

### Task 15: The 48-shot style matrix and the style stage screens

**Files:**
- Create: `tests/visual/style-matrix.spec.ts` and its baselines `tests/visual/style-matrix.spec.ts-snapshots/*.png`
- Modify: `tests/tools/stage-screens.spec.ts` (append four entries to `SCENARIOS`)

**Interfaces:**
- Consumes: `STYLE_IDS`, `STYLE_STORAGE_KEY` (S05); `FAKE`, `FIXTURE_NOW`, `mockTrack`, `trackData`, `FailureFixture` (S01); the hooks `data-view-state`, `data-loading-stage`, `data-result-view` (S06/S07); the stage-screens tool's `SCENARIOS` entries `{ name, path, prepare? }` (S01; S04/S06/S07 appended; S07 Addition 18: "S08 appends after them").
- Produces: `tests/visual/style-matrix.spec.ts` — 8 states × 2 widths × 3 styles = 48 `toHaveScreenshot` tests, skipped unless `PW_VISUAL=1` (roadmap §11.10), with committed baselines; stage scenarios `home-manifest`, `home-night`, `deeplink-inTransit-manifest`, `deeplink-inTransit-night`.

- [ ] **Step 1: Write the matrix**

Create `tests/visual/style-matrix.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";
import { STYLE_IDS, STYLE_STORAGE_KEY, type StyleId } from "@/lib/style/styles";
import type { TrackResponseData } from "@/lib/types";
import { FAKE, FIXTURE_NOW, mockTrack, trackData, type FailureFixture } from "../fixtures/tracking-fixtures";

/**
 * Visual regression matrix (spec §13 "품질 비용"): the eight Phase 3 canvas screens × 375 / 1440 px × three styles = 48.
 * Runs only with PW_VISUAL=1 (roadmap §11.10). Baselines live in tests/visual/style-matrix.spec.ts-snapshots/.
 */
const VISUAL = process.env.PW_VISUAL === "1";
const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 1440, height: 900 }
] as const;

interface MatrixState {
  readonly name: string;
  readonly path: string;
  readonly reply: TrackResponseData | FailureFixture | null;
  /** Visible once the state is on screen. */
  readonly ready: string;
  readonly loading?: boolean;
}

const STATES: readonly MatrixState[] = [
  { name: "home", path: "/", reply: null, ready: '[data-view-state="idle"]' },
  {
    name: "loading",
    path: `/${FAKE.domestic}`,
    reply: trackData("inTransit", { trackingNumber: FAKE.domestic }),
    ready: '[data-loading-stage="short"]',
    loading: true
  },
  { name: "pending", path: `/${FAKE.domestic}`, reply: trackData("pending", { trackingNumber: FAKE.domestic }), ready: '[data-result-view="settled"]' },
  { name: "customsWaiting", path: `/${FAKE.hbl}`, reply: trackData("customsWaiting", { trackingNumber: FAKE.hbl }), ready: '[data-result-view="settled"]' },
  { name: "inTransit", path: `/${FAKE.domestic}`, reply: trackData("inTransit", { trackingNumber: FAKE.domestic }), ready: '[data-result-view="settled"]' },
  { name: "delivered", path: `/${FAKE.domestic}`, reply: trackData("delivered", { trackingNumber: FAKE.domestic }), ready: '[data-result-view="settled"]' },
  { name: "stale", path: `/${FAKE.domestic}`, reply: trackData("stale", { trackingNumber: FAKE.domestic }), ready: '[data-result-view="settled"]' },
  { name: "notFound", path: `/${FAKE.domestic}`, reply: "notFound404", ready: '[data-result-view="error"]' }
];

async function prepare(page: Page, style: StyleId, state: MatrixState): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [STYLE_STORAGE_KEY, style] as const
  );
  if (state.loading === true) {
    // Fake timers: the card is held at the short stage (0.4–3 s) however slow the machine is.
    await page.clock.install({ time: FIXTURE_NOW });
  } else {
    await page.clock.setFixedTime(FIXTURE_NOW);
  }
  if (state.reply !== null) await mockTrack(page, state.reply, state.loading === true ? { delayMs: 120_000 } : undefined);
}

test.describe("style matrix (S08)", () => {
  test.skip(!VISUAL, "the visual matrix runs only with PW_VISUAL=1");
  test.describe.configure({ mode: "parallel" });

  for (const style of STYLE_IDS) {
    for (const viewport of VIEWPORTS) {
      for (const state of STATES) {
        test(`${state.name} · ${style} · ${viewport.width}`, async ({ page }) => {
          await page.setViewportSize(viewport);
          await prepare(page, style, state);
          const lookupStarted = state.loading === true ? page.waitForRequest("**/api/track") : null;
          await page.goto(state.path);
          if (lookupStarted !== null) {
            // The lookup has started (after hydration): move the fake clock into the short stage and keep it there.
            await lookupStarted;
            await page.clock.runFor(1_000);
          }
          await expect(page.locator(state.ready)).toBeVisible();
          await expect(page.locator("html")).toHaveAttribute("data-style", style);
          if (state.loading !== true) await page.waitForLoadState("networkidle");
          await page.evaluate(async () => {
            await document.fonts.ready;
          });
          await expect(page).toHaveScreenshot(`${state.name}-${style}-${viewport.width}.png`, {
            fullPage: true,
            animations: "disabled",
            maxDiffPixelRatio: 0.01
          });
        });
      }
    }
  }
});
```

- [ ] **Step 2: Run it to verify it fails without baselines**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; $env:PW_VISUAL='1'; npx playwright test tests/visual/style-matrix.spec.ts`
Expected: FAIL — `48 failed` with `A snapshot doesn't exist at …style-matrix.spec.ts-snapshots\<state>-<style>-<width>-chromium-win32.png, writing actual.` (Playwright writes the actual images).
Run without the flag: `$env:PW_VISUAL=$null; npx playwright test tests/visual/style-matrix.spec.ts`
Expected: `48 skipped`.

- [ ] **Step 3: Write, review and keep the baselines**

Run: `$env:PW_VISUAL='1'; npx playwright test tests/visual/style-matrix.spec.ts --update-snapshots; $env:PW_VISUAL=$null`
Expected: `48 passed` and 48 PNGs in `tests/visual/style-matrix.spec.ts-snapshots/`.
Review every image before committing: the style matches its name (signal: tone color fields; manifest: paper, stamp chip, dashed route, mono date on a rule; night: dark ground, lamp chips, digit tiles, round current station); no text is cut or overflows at 375 px; the loading shots show the short-stage card; only `0000`/`TEST` numbers appear. Send the 1440 px home and in-transit shots of each style to the operator with SendUserFile (six files) for a look. A wrong-looking image is a CSS bug in Task 13's rules — fix the rule, re-run with `--update-snapshots`, review again.
Run: `$env:PW_VISUAL='1'; npx playwright test tests/visual/style-matrix.spec.ts; $env:PW_VISUAL=$null`
Expected: `48 passed` (stable against the baselines). The baselines are specific to this machine's platform suffix (`-chromium-win32`); CI never runs the matrix (no `PW_VISUAL`).

- [ ] **Step 4: Append the style scenarios to the stage-screens tool**

In `tests/tools/stage-screens.spec.ts`, directly before the `];` that closes `SCENARIOS` (after S07's `deeplink-overdue` entry), add:

```ts
  // S08: the two new screen styles, chosen before the page loads like a returning customer's stored choice.
  { name: "home-manifest", path: "/", prepare: (page) => page.addInitScript(() => window.localStorage.setItem("tt:style", "manifest")) },
  { name: "home-night", path: "/", prepare: (page) => page.addInitScript(() => window.localStorage.setItem("tt:style", "night")) },
  {
    name: "deeplink-inTransit-manifest",
    path: `/${FAKE.hbl}`,
    prepare: async (page) => {
      await page.addInitScript(() => window.localStorage.setItem("tt:style", "manifest"));
      await mockTrack(page, trackData("inTransit"));
    }
  },
  {
    name: "deeplink-inTransit-night",
    path: `/${FAKE.hbl}`,
    prepare: async (page) => {
      await page.addInitScript(() => window.localStorage.setItem("tt:style", "night"));
      await mockTrack(page, trackData("inTransit"));
    }
  }
```

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test --list tests/tools/stage-screens.spec.ts | Select-String -Pattern 'manifest|night' | Measure-Object | Select-Object -ExpandProperty Count; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `20` (four scenarios × five widths).
Run: `npx eslint tests/visual/style-matrix.spec.ts tests/tools/stage-screens.spec.ts`
Expected: no output.

- [ ] **Step 5: Commit**

Run: `git add tests/visual/style-matrix.spec.ts tests/visual/style-matrix.spec.ts-snapshots tests/tools/stage-screens.spec.ts; git commit -m "test: add the 48-shot style matrix and the style stage screens"`

---

### Task 16 (gated by approval 13): axe in every style

**Files:**
- Create: `tests/e2e/style-a11y.spec.ts`
- Modify: `package.json`, `package-lock.json` (only if `@axe-core/playwright` is not installed yet)
- Modify: `tests/e2e/result-a11y.spec.ts` (S07; drop the legacy exclusions), and any other `tests/e2e/*.spec.ts` whose `AxeBuilder` excludes `.tt-legacy-dark` or `[data-recommended-products]`

**Interfaces:**
- Consumes: `AxeBuilder` from `@axe-core/playwright` (approval 13); `STYLE_IDS`, `STYLE_STORAGE_KEY` (S05); `FAKE`, `FIXTURE_NOW`, `mockTrack`, `trackData` (S01); `INTERNAL_TEST_CREDENTIALS`.
- Produces: `describe("axe per style (S08, approval 13)")` — WCAG 2.0/2.1/2.2 A and AA tags on home, pending, delivered, NOT_FOUND, the open recommendation block and the gallery, in all three styles at 375 and 1280 px.

- [ ] **Step 1: Confirm approval 13 is recorded in the roadmap approval ledger; if not, stop**

Run: `Select-String -Path docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md -Pattern '^\| 13 \|' | ForEach-Object { $_.Line }`
Expected: `approved`. If it reads `pending` or `rejected`, STOP and mark this task SKIPPED. Fallback (spec §16 item 13 "거절하면": accessibility is checked by hand): run this five-item checklist in each of the three styles (choose the style with the picker) and record pass/fail with a note per item in the stage summary:
1. Keyboard only: `/` → type a fixture number → Enter → result → 처리 내역 `<details>` → recommendation block → the picker; focus is always visible (3 px ring) and never hidden behind anything.
2. Screen reader (NVDA on Windows or VoiceOver): the result heading is read after a lookup; choosing '서류형' reads '화면 스타일을 서류형으로 바꿨어요' exactly once.
3. Browser zoom 200 % at 1280 px: no text is cut and nothing overlaps.
4. Windows contrast themes (forced colors): chips, the stamp border, the lamps, the digit tiles and the journey bars stay visible.
5. Chrome DevTools → Rendering → "Emulate vision deficiencies" (protanopia, deuteranopia): every state stays distinguishable by its icon and words.
The structural checks of Tasks 13–14 (per-style text contrast, focus rings, 320 px) remain the automated guard.

- [ ] **Step 2: Make sure the axe package is installed**

Run: `Select-String -Path package.json -Pattern '"@axe-core/playwright"'`
Expected: one line (S05, S06 or S07 installed it under approval 13). If there is no output: `npm install --save-dev @axe-core/playwright@4` → `added … packages`; record the installed version in the stage summary.

- [ ] **Step 3: Write the test**

Create `tests/e2e/style-a11y.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { STYLE_IDS, STYLE_STORAGE_KEY, type StyleId } from "@/lib/style/styles";
import type { TrackResponseData } from "@/lib/types";
import { FAKE, FIXTURE_NOW, mockTrack, trackData, type FailureFixture } from "../fixtures/tracking-fixtures";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 1280, height: 900 }
] as const;

interface Scene {
  readonly name: string;
  readonly path: string;
  readonly reply: TrackResponseData | FailureFixture | null;
  readonly ready: string;
}

const SCENES: readonly Scene[] = [
  { name: "home", path: "/", reply: null, ready: '[data-view-state="idle"]' },
  { name: "pending", path: `/${FAKE.domestic}`, reply: trackData("pending", { trackingNumber: FAKE.domestic }), ready: '[data-result-view="settled"]' },
  { name: "delivered", path: `/${FAKE.domestic}`, reply: trackData("delivered", { trackingNumber: FAKE.domestic }), ready: '[data-result-view="settled"]' },
  { name: "notFound", path: `/${FAKE.domestic}`, reply: "notFound404", ready: '[data-result-view="error"]' }
];

async function useStyle(page: Page, style: StyleId): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [STYLE_STORAGE_KEY, style] as const
  );
}

async function violations(page: Page): Promise<readonly string[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
}

test.describe("axe per style (S08, approval 13)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
    await page.clock.setFixedTime(FIXTURE_NOW);
  });

  for (const style of STYLE_IDS) {
    for (const viewport of VIEWPORTS) {
      test(`${style} · ${viewport.width}: home, results and the error screen have no WCAG 2.2 AA violation`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await useStyle(page, style);
        for (const scene of SCENES) {
          if (scene.reply !== null) await mockTrack(page, scene.reply);
          await page.goto(scene.path);
          await expect(page.locator(scene.ready)).toBeVisible();
          await expect(page.locator("html")).toHaveAttribute("data-style", style);
          await page.waitForLoadState("networkidle");
          expect(await violations(page), `${style} ${viewport.width} ${scene.name}`).toEqual([]);
        }
      });
    }

    test.describe(`${style}: the gallery`, () => {
      test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

      test(`${style}: every primitive in the gallery has no WCAG 2.2 AA violation`, async ({ page }) => {
        await useStyle(page, style);
        await page.goto("/internal/ui-kit");
        await expect(page.locator("main[data-ui-kit]")).toBeVisible();
        const results = await new AxeBuilder({ page }).include("main[data-ui-kit]").withTags(WCAG_TAGS).analyze();
        expect(results.violations.map((violation) => violation.id)).toEqual([]);
      });
    });
  }
});
```

- [ ] **Step 4: Drop the legacy exclusions**

Run: `Select-String -Path tests/e2e/*.spec.ts -Pattern "exclude\(\"(\.tt-legacy-dark|\[data-recommended-products\])\"\)" | ForEach-Object { "$($_.Filename):$($_.LineNumber): $($_.Line.Trim())" }`
Expected: the lines S06/S07 added (for example `.exclude("[data-recommended-products]")` in `tests/e2e/result-a11y.spec.ts`, S07 open issue 6). Delete each of those `.exclude(…)` calls (keep the rest of the builder chain) and the comment words that name the legacy blocks.

- [ ] **Step 5: Run the tests**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/style-a11y.spec.ts tests/e2e/result-a11y.spec.ts tests/e2e/home.spec.ts tests/e2e/ui-kit.spec.ts`
Expected: 0 failed (`style-a11y.spec.ts` `9 passed`). A violation names its rule and target: fix the style CSS or the component (never add an exclusion), then re-run.

- [ ] **Step 6: Commit**

Run: `git add tests/e2e/style-a11y.spec.ts tests/e2e/*.spec.ts package.json package-lock.json; git commit -m "test: run axe on every screen style and drop the legacy exclusions (approval 13)"`

---

### Task 17: DESIGN.md and the design-system style sections

**Files:**
- Modify: `DESIGN.md` (§2 table and one bullet; append §14–§16)
- Create: `design-system/foundations/styles.html`
- Modify: `design-system/_base.css` (the header; the two style files embedded after `tokens.css`), `design-system/README.md` (one line)
- Test: `tests/unit/tokens.spec.ts` (S05's `DS_FILES` list; two legacy-word lists; append)

**Interfaces:**
- Consumes: Tasks 11–14 (token values, slot CSS, picker, pre-paint names); S05's DESIGN.md structure (§1–§12) and `design-system/` bundle with its tests (`DS_FILES`, the `@dsCard` marker, `../_base.css`, no color literals, the spine and disclosure counters); Task 8's §13.
- Produces: DESIGN.md §14 "색 토큰 (manifest)", §15 "색 토큰 (night)" (every color with its value; every contrast pair with its ratio, pinned by tests), §16 "화면 스타일 고르기와 첫 페인트"; `design-system/_base.css` = tokens.css + style-manifest.css + style-night.css verbatim; `design-system/foundations/styles.html` (the three styles' status head, ETA, journey and buttons side by side).

- [ ] **Step 1: Write the failing tests**

In `tests/unit/tokens.spec.ts`:
(a) In S05's `DS_FILES` list, add `"foundations/styles.html",` directly below `"foundations/spacing.html",`.
(b) In S05's test "previews use tokens only: …", replace `"IBM Plex", "Space Grotesk", "linear-gradient"` with `"IBM Plex Sans", "Space Grotesk", "linear-gradient"`; in S05's test "carries no legacy tokens or fonts", replace `"IBM Plex", "Space Grotesk", "4.8s loop"` with `"IBM Plex Sans", "Space Grotesk", "4.8s loop"` (the retired body font stays banned; IBM Plex Mono is the manifest digit font — Addition 11).
(c) Append:

```ts
test.describe("DESIGN.md style sections (S08)", () => {
  function section(heading: string, next: string): string {
    const text = readRepoFile("DESIGN.md");
    const start = text.indexOf(heading);
    if (start < 0) return "";
    const end = text.indexOf(next, start + heading.length);
    return text.slice(start, end < 0 ? undefined : end);
  }

  for (const [id, heading, next] of [
    ["manifest", "## 14. 색 토큰 (manifest)", "## 15."],
    ["night", "## 15. 색 토큰 (night)", "## 16."]
  ] as const) {
    test(`${id}: every color token with its value and every contrast pair with its ratio`, () => {
      const text = section(heading, next);
      expect(text.length, heading).toBeGreaterThan(0);
      const colors = styleColors(id);
      const missing = COLOR_TOKENS.filter((token) => !new RegExp(`\\|\\s*\`${token}\`\\s*\\|\\s*\`${colors[token]}\`\\s*\\|`).test(text));
      expect(missing).toEqual([]);
      const wrong = CONTRAST_REQUIREMENTS.filter(({ fg, bg, min }) => {
        const ratio = contrastRatio(colors[fg], colors[bg]).toFixed(2);
        return !text.includes(`| \`${fg}\` / \`${bg}\` | ${ratio}:1 | ${min}:1 |`);
      }).map(({ fg, bg }) => `${fg} / ${bg}`);
      expect(wrong).toEqual([]);
    });
  }

  test("the picker, the storage key, the pre-paint names and the matrix are documented", () => {
    const text = section("## 16. 화면 스타일 고르기와 첫 페인트", "## 17.");
    for (const name of ["StylePicker", "tt:style", "PREPAINT_SCRIPT_SHA256", "data-follow-dark", "style-matrix.spec.ts", "화면 스타일을 {label}으로 바꿨어요"]) {
      expect(text, name).toContain(name);
    }
  });
});

test.describe("design-system style previews (S08)", () => {
  const normalized = (file: string): string => readRepoFile(file).replace(/\r\n/g, "\n");

  test("_base.css embeds both style files unchanged, after tokens.css", () => {
    const base = normalized("design-system/_base.css");
    const tokensAt = base.indexOf(normalized("app/styles/tokens.css").trim());
    const manifestAt = base.indexOf(normalized("app/styles/style-manifest.css").trim());
    const nightAt = base.indexOf(normalized("app/styles/style-night.css").trim());
    expect(tokensAt).toBeGreaterThan(-1);
    expect(manifestAt).toBeGreaterThan(tokensAt);
    expect(nightAt).toBeGreaterThan(manifestAt);
  });

  test("foundations/styles.html shows the three styles with the slot hooks", () => {
    const html = readRepoFile("design-system/foundations/styles.html");
    for (const id of STYLE_IDS) expect(html).toContain(`<section data-style="${id}"`);
    for (const hook of ['data-slot="status-head"', 'data-slot="eta"', 'data-slot="journey"', 'data-slot="button"']) {
      expect((html.match(new RegExp(hook, "g")) ?? []).length, hook).toBeGreaterThanOrEqual(3);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/tokens.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — S05's file-list test (`foundations/styles.html` missing), the three DESIGN.md style tests (sections 14–16 do not exist), and the two preview tests (`_base.css` lacks the style files; `styles.html` missing). Everything else passes.

- [ ] **Step 3: Update DESIGN.md**

(a) In §2's table replace `| \`manifest\` | 서류형 | R3b에서 추가 |` with `| \`manifest\` | 서류형 | R3b 구현(고객이 고름) |` and `| \`night\` | 어두운 화면 | R3b에서 추가 |` with `| \`night\` | 어두운 화면 | R3b 구현(고객이 고름, 기기 어두운 모드의 첫 방문 기본) |`.
(b) Replace the bullet that starts with `- 지금은 \`app/layout.tsx\`가 \`<html data-style="signal">\`로 고정합니다.` with:

```markdown
- 서버는 늘 `<html data-style="signal">`로 그립니다. `<head>`의 첫 페인트 전 스크립트가 저장된 선택(`localStorage` `tt:style`) 또는 기기 어두운 모드(`data-follow-dark`)에 따라 첫 페인트 전에 바꿉니다(16장). 서류형·어두운 화면 토큰은 14·15장입니다.
```

Run: `Select-String -Path DESIGN.md -Pattern 'R3b에서 추가|로 고정합니다'`
Expected: no output.
(c) Append to the end of `DESIGN.md`:

````markdown

## 14. 색 토큰 (manifest)

서류형(A 세관 서류): 차가운 종이 바탕, 괘선, 상태는 도장 하나, 기입값은 고정폭 숫자. 링크는 잉크 + 밑줄(도장 청색과 분리). 값의 원본은 `app/styles/style-manifest.css`와 `lib/style/tokens.ts`(`MANIFEST_COLORS`)입니다.

| 토큰 | 값 | 쓰임 |
|---|---|---|
| `--tt-ground` | `#ECEFF3` | 페이지 바탕 |
| `--tt-surface` | `#FAFBFC` | 서류 면 · 카드·입력칸 |
| `--tt-raised` | `#FAFBFC` | 한 단계 위 층(서류 면과 같음) |
| `--tt-ink` | `#14213A` | 본문·서식 틀 |
| `--tt-muted` | `#4A566B` | 라벨·보조 문장 |
| `--tt-rule` | `#C4CCD7` | 칸 나눔 괘선(글자에 쓰지 않음) |
| `--tt-control` | `#6B7689` | 입력칸 테두리 |
| `--tt-route` | `#7D8899` | 척추 점선·빈 칸 |
| `--tt-primary` | `#1B4A9A` | 채움 주 버튼(세관 청색) |
| `--tt-on-primary` | `#FFFFFF` | 주 버튼 글자 |
| `--tt-accent` | `#1B4A9A` | 강조(세관 청색) |
| `--tt-link` | `#14213A` | 링크(잉크 + 밑줄) |
| `--tt-focus` | `#14213A` | 포커스 링 |
| `--tt-tile` | `#FAFBFC` | 숫자 칸(서류 면) |
| `--tt-board` | `#14213A` | 숫자 칸 글자 |
| `--tt-tone-progress` | `#1B4A9A` | 정상 진행 채움 |
| `--tt-tone-progress-on` | `#FFFFFF` | 정상 진행 채움 위 글자 |
| `--tt-tone-progress-ink` | `#1B4A9A` | 정상 진행 글자·도장 선 |
| `--tt-tone-waiting` | `#56627A` | 정보 대기 채움 |
| `--tt-tone-waiting-on` | `#FFFFFF` | 정보 대기 채움 위 글자 |
| `--tt-tone-waiting-ink` | `#56627A` | 정보 대기 글자·도장 선 |
| `--tt-tone-attention` | `#9A5A00` | 확인 필요 채움 |
| `--tt-tone-attention-on` | `#FFFFFF` | 확인 필요 채움 위 글자 |
| `--tt-tone-attention-ink` | `#9A5A00` | 확인 필요 글자·도장 선 |
| `--tt-tone-problem` | `#B3261E` | 문제 채움(빨강은 여기에만) |
| `--tt-tone-problem-on` | `#FFFFFF` | 문제 채움 위 글자 |
| `--tt-tone-problem-ink` | `#B3261E` | 문제 글자·도장 선 |
| `--tt-tone-done` | `#185C36` | 완료 채움 |
| `--tt-tone-done-on` | `#FFFFFF` | 완료 채움 위 글자 |
| `--tt-tone-done-ink` | `#185C36` | 완료 글자·도장 선 |

| 짝 | 대비 | 기준 |
|---|---|---|
| `--tt-ink` / `--tt-surface` | 15.49:1 | 4.5:1 |
| `--tt-ink` / `--tt-ground` | 13.92:1 | 4.5:1 |
| `--tt-muted` / `--tt-surface` | 7.15:1 | 4.5:1 |
| `--tt-muted` / `--tt-ground` | 6.42:1 | 4.5:1 |
| `--tt-link` / `--tt-surface` | 15.49:1 | 4.5:1 |
| `--tt-link` / `--tt-ground` | 13.92:1 | 4.5:1 |
| `--tt-on-primary` / `--tt-primary` | 8.42:1 | 4.5:1 |
| `--tt-tone-progress-on` / `--tt-tone-progress` | 8.42:1 | 4.5:1 |
| `--tt-tone-waiting-on` / `--tt-tone-waiting` | 6.13:1 | 4.5:1 |
| `--tt-tone-attention-on` / `--tt-tone-attention` | 5.47:1 | 4.5:1 |
| `--tt-tone-problem-on` / `--tt-tone-problem` | 6.54:1 | 4.5:1 |
| `--tt-tone-done-on` / `--tt-tone-done` | 8.01:1 | 4.5:1 |
| `--tt-tone-progress-ink` / `--tt-surface` | 8.13:1 | 4.5:1 |
| `--tt-tone-waiting-ink` / `--tt-surface` | 5.92:1 | 4.5:1 |
| `--tt-tone-attention-ink` / `--tt-surface` | 5.28:1 | 4.5:1 |
| `--tt-tone-problem-ink` / `--tt-surface` | 6.31:1 | 4.5:1 |
| `--tt-tone-done-ink` / `--tt-surface` | 7.73:1 | 4.5:1 |
| `--tt-board` / `--tt-tile` | 15.49:1 | 4.5:1 |
| `--tt-control` / `--tt-surface` | 4.43:1 | 3:1 |
| `--tt-route` / `--tt-surface` | 3.46:1 | 3:1 |
| `--tt-focus` / `--tt-surface` | 15.49:1 | 3:1 |
| `--tt-focus` / `--tt-ground` | 13.92:1 | 3:1 |

- 글꼴: 한글 제목은 설치된 명조(`AppleMyungjo`, `Nanum Myeongjo`, `Batang` …, 없으면 serif), 본문은 기본과 같은 시스템 고딕, 숫자는 IBM Plex Mono 600(`--font-plex-mono`, preload 없음). 웹 한글 제목 글꼴(Hahmlet)은 CSS 예산 때문에 쓰지 않습니다.
- 변형 슬롯: `status-head` 종이 면 + 2° 기울어진 겹테두리 도장 칩, `eta` 밑줄 칸 위 고정폭 기입값, `journey` 지나온 길 실선·남은 길 점선, `button` 모서리 2px·테두리 1px.

## 15. 색 토큰 (night)

어두운 화면(C 야간 관제): 채도를 뺀 어두운 바탕, 층은 흐림 없이 밝기 단계로만, 상태는 평면 램프, 날짜는 숫자 타일. 링크는 잉크 + 밑줄(램프 파랑과 분리). 값의 원본은 `app/styles/style-night.css`와 `lib/style/tokens.ts`(`NIGHT_COLORS`)입니다.

| 토큰 | 값 | 쓰임 |
|---|---|---|
| `--tt-ground` | `#0C1214` | 페이지 바탕 |
| `--tt-surface` | `#131B1E` | 결과 면 |
| `--tt-raised` | `#1A2428` | 상태 머리·한 단계 위 층 |
| `--tt-ink` | `#E6ECE9` | 본문 글자 |
| `--tt-muted` | `#9AA8AC` | 보조 글자 |
| `--tt-rule` | `#27343A` | 가는 선(글자에 쓰지 않음) |
| `--tt-control` | `#62757C` | 입력칸 테두리 |
| `--tt-route` | `#6E8288` | 노선 점선·빈 역 |
| `--tt-primary` | `#8FB3F0` | 채움 주 버튼(관제 파랑) |
| `--tt-on-primary` | `#0C1214` | 주 버튼 글자 |
| `--tt-accent` | `#8FB3F0` | 강조(관제 파랑) |
| `--tt-link` | `#E6ECE9` | 링크(잉크 + 밑줄) |
| `--tt-focus` | `#E6ECE9` | 포커스 링 |
| `--tt-tile` | `#080C0E` | 숫자 타일 바탕 |
| `--tt-board` | `#F1E8D4` | 숫자 타일 글자 |
| `--tt-tone-progress` | `#8FB3F0` | 정상 진행 램프·채움 |
| `--tt-tone-progress-on` | `#0C1214` | 정상 진행 채움 위 글자 |
| `--tt-tone-progress-ink` | `#8FB3F0` | 정상 진행 글자 |
| `--tt-tone-waiting` | `#A3AFB3` | 정보 대기 램프·채움 |
| `--tt-tone-waiting-on` | `#0C1214` | 정보 대기 채움 위 글자 |
| `--tt-tone-waiting-ink` | `#A3AFB3` | 정보 대기 글자 |
| `--tt-tone-attention` | `#E8A847` | 확인 필요 램프·채움 |
| `--tt-tone-attention-on` | `#0C1214` | 확인 필요 채움 위 글자 |
| `--tt-tone-attention-ink` | `#E8A847` | 확인 필요 글자 |
| `--tt-tone-problem` | `#EF7C71` | 문제 램프·채움(빨강 계열은 여기에만) |
| `--tt-tone-problem-on` | `#0C1214` | 문제 채움 위 글자 |
| `--tt-tone-problem-ink` | `#EF7C71` | 문제 글자 |
| `--tt-tone-done` | `#74CB9B` | 완료 램프·채움 |
| `--tt-tone-done-on` | `#0C1214` | 완료 채움 위 글자 |
| `--tt-tone-done-ink` | `#74CB9B` | 완료 글자 |

| 짝 | 대비 | 기준 |
|---|---|---|
| `--tt-ink` / `--tt-surface` | 14.58:1 | 4.5:1 |
| `--tt-ink` / `--tt-ground` | 15.77:1 | 4.5:1 |
| `--tt-muted` / `--tt-surface` | 7.12:1 | 4.5:1 |
| `--tt-muted` / `--tt-ground` | 7.71:1 | 4.5:1 |
| `--tt-link` / `--tt-surface` | 14.58:1 | 4.5:1 |
| `--tt-link` / `--tt-ground` | 15.77:1 | 4.5:1 |
| `--tt-on-primary` / `--tt-primary` | 8.88:1 | 4.5:1 |
| `--tt-tone-progress-on` / `--tt-tone-progress` | 8.88:1 | 4.5:1 |
| `--tt-tone-waiting-on` / `--tt-tone-waiting` | 8.40:1 | 4.5:1 |
| `--tt-tone-attention-on` / `--tt-tone-attention` | 9.10:1 | 4.5:1 |
| `--tt-tone-problem-on` / `--tt-tone-problem` | 7.01:1 | 4.5:1 |
| `--tt-tone-done-on` / `--tt-tone-done` | 9.67:1 | 4.5:1 |
| `--tt-tone-progress-ink` / `--tt-surface` | 8.21:1 | 4.5:1 |
| `--tt-tone-waiting-ink` / `--tt-surface` | 7.76:1 | 4.5:1 |
| `--tt-tone-attention-ink` / `--tt-surface` | 8.41:1 | 4.5:1 |
| `--tt-tone-problem-ink` / `--tt-surface` | 6.48:1 | 4.5:1 |
| `--tt-tone-done-ink` / `--tt-surface` | 8.94:1 | 4.5:1 |
| `--tt-board` / `--tt-tile` | 16.12:1 | 4.5:1 |
| `--tt-control` / `--tt-surface` | 3.62:1 | 3:1 |
| `--tt-route` / `--tt-surface` | 4.33:1 | 3:1 |
| `--tt-focus` / `--tt-surface` | 14.58:1 | 3:1 |
| `--tt-focus` / `--tt-ground` | 15.77:1 | 3:1 |

- 글꼴: 한글은 시스템 고딕, 숫자는 JetBrains Mono 500(`--font-jetbrains-mono`, preload 없음). `color-scheme: dark`로 스크롤 막대와 입력 부품도 어둡게 그립니다.
- 변형 슬롯: `status-head` 한 단계 밝은 층 + 상태 톤 윗선, 칩 앞 둥근 램프(`::before`), `eta` 숫자마다 `--tt-tile` 칸 위 `--tt-board` 글자, `journey` 가는 선·점선·둥근 현재 역, `button` 모서리 4px·테두리 1px.

## 16. 화면 스타일 고르기와 첫 페인트

- **고르기**: 푸터 바로 위 `StylePicker`(`components/shell/StylePicker.tsx`, `data-style-picker`). fieldset + legend '화면 스타일', 라디오 3개(기본·서류형·어두운 화면, 각 44px). 바꾸면 `html[data-style]`만 바뀌고 live region이 '화면 스타일을 {label}으로 바꿨어요'를 한 번 읽습니다. 부품의 DOM·`data-*` 훅·문구·배치는 스타일과 무관하고, `tests/unit/prepaint.spec.ts`가 스타일을 읽는 파일을 레이아웃·스타일 모듈·고르기 부품으로 제한합니다.
- **저장**: `localStorage` `tt:style` 한 값(`signal` | `manifest` | `night`). 개인정보가 아니고 서버로 보내지 않습니다. 저장소가 막히면 그 화면 안에서만 바뀝니다.
- **첫 페인트 전**: `lib/style/prepaint.ts`의 `PREPAINT_SCRIPT`가 `<head>`에서 스타일을 정합니다(저장된 선택 → 기기 어두운 모드면서 `data-follow-dark="1"`이면 night → 아니면 signal). 글이 상수라서 해시 `PREPAINT_SCRIPT_SHA256`가 CSP Report-Only의 `script-src`에 들어갑니다(`next.config.ts`). 글을 바꾸면 해시를 새로 계산하고 `tests/unit/prepaint.spec.ts`를 돌립니다. `data-follow-dark`는 `config/site.config.ts`의 `style.followSystemDark`(기본 true)입니다.
- **글꼴 예산**: 기본은 DM Mono 한 파일만 preload합니다. 서류형·어두운 화면의 숫자 글꼴은 preload하지 않고 그 스타일의 토큰에서만 쓰므로 그 스타일일 때만 내려받습니다(`tests/budgets/font-preload.spec.ts`).
- **검사**: `tests/unit/tokens.spec.ts`(세 스타일의 값·대비·보완), `tests/e2e/ui-kit.spec.ts`(스타일별 11px 이하 0·글자 대비·포커스 링·320px), `tests/e2e/style-picker.spec.ts`(첫 페인트 규칙, 고르기, 막힌 저장소), `tests/visual/style-matrix.spec.ts`(핵심 8상태 × 375·1440 × 3스타일 = 48장, `PW_VISUAL=1`), `tests/e2e/style-a11y.spec.ts`(승인 13 뒤 axe).
````

- [ ] **Step 4: Rebuild the design-system style previews**

`design-system/_base.css`:
(a) Directly below its first line (`@import url("https://fonts.googleapis.com/css2?family=DM+Mono:wght@500&display=swap");`) add:

```css
@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@600&family=JetBrains+Mono:wght@500&display=swap");
```

(b) Replace `:root { --font-dm-mono: "DM Mono"; }` with `:root { --font-dm-mono: "DM Mono"; --font-plex-mono: "IBM Plex Mono"; --font-jetbrains-mono: "JetBrains Mono"; }`.
(c) Directly above the line `/* ===== 미리보기 전용 ===== */`, insert `/* ===== style-manifest.css ===== */`, then the complete current content of `app/styles/style-manifest.css` pasted unchanged (read it with the Read tool), then `/* ===== style-night.css ===== */`, then the complete content of `app/styles/style-night.css` unchanged, then one empty line.
(d) In the header comment, replace `2) 그 아래 "tokens.css" 절은 app/styles/tokens.css 를 한 글자도 바꾸지 않고 그대로 붙인 것입니다.` with `2) 그 아래 "tokens.css"·"style-manifest.css"·"style-night.css" 절은 app/styles/ 의 세 파일을 한 글자도 바꾸지 않고 그대로 붙인 것입니다.`

Create `design-system/foundations/styles.html`:

```html
<!-- @dsCard group="Foundations" title="화면 스타일 세 가지" -->
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>화면 스타일 · 기본 · 서류형 · 어두운 화면</title>
<link rel="stylesheet" href="../_base.css">
<style>
  .ds-styles { display: grid; gap: 24px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
  .ds-style { display: flex; flex-direction: column; gap: 12px; padding: 16px; background: var(--tt-ground); color: var(--tt-ink); font-family: var(--tt-font-body); }
  .ds-style h2 { margin: 0; font-size: var(--tt-text-lg); }
  .ds-style h3 { margin: 0; font-family: var(--tt-font-display); font-size: var(--tt-text-lg); font-weight: var(--tt-weight-display); }
  .ds-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .ds-style [data-slot="button"] { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border-radius: var(--tt-radius-button); font-weight: 700; text-decoration: none; }
  .ds-style [data-slot="button"][data-variant="primary"] { background: var(--tt-primary); color: var(--tt-on-primary); }
  .ds-style [data-slot="button"][data-variant="secondary"] { border: var(--tt-border-button) solid var(--tt-ink); background: var(--tt-surface); color: var(--tt-ink); }
  .ds-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
</head>
<body>
<main class="ds-styles">
<section data-style="signal" class="ds-style">
  <h2>기본 (signal)</h2>
  <div data-slot="status-head" data-tone="progress">
    <span data-status-chip="true" data-tone="progress">통관 대기 · 2/4</span>
    <h3>통관 순서를 기다리고 있어요</h3>
    <div data-slot="journey">
      <ol aria-label="배송 여정 4구간" data-spine-current="customs">
        <li data-station="departed" data-station-state="done"><span data-spine-part="track"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">해외 출발</span></span></li>
        <li data-station="customs" data-station-state="current" aria-current="step"><span data-spine-part="track"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">입항·통관</span></span></li>
        <li data-station="domestic" data-station-state="todo"><span data-spine-part="track"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">국내 배송</span></span></li>
        <li data-station="arrived" data-station-state="todo"><span data-spine-part="track"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">도착</span></span></li>
      </ol>
    </div>
    <div data-slot="eta" data-eta-kind="date">
      <p data-eta-label>도착 예상</p>
      <p data-eta-value><span class="ds-sr">9월 30일 (수)</span><span data-eta-visual aria-hidden="true"><span data-eta-part="month"><span data-eta-digit="9">9</span>월</span> <span data-eta-part="day"><span data-eta-digit="3">3</span><span data-eta-digit="0">0</span>일</span> <span data-eta-part="weekday">(수)</span></span><span data-eta-dday>D-4</span></p>
    </div>
  </div>
  <div class="ds-row">
    <a data-slot="button" data-variant="primary" data-size="lg" href="#">조회하기</a>
    <a data-slot="button" data-variant="secondary" data-size="md" href="#">다시 볼 링크 복사</a>
  </div>
</section>
<section data-style="manifest" class="ds-style">
  <h2>서류형 (manifest)</h2>
  <div data-slot="status-head" data-tone="progress">
    <span data-status-chip="true" data-tone="progress">통관 대기 · 2/4</span>
    <h3>통관 순서를 기다리고 있어요</h3>
    <div data-slot="journey">
      <ol aria-label="배송 여정 4구간" data-spine-current="customs">
        <li data-station="departed" data-station-state="done"><span data-spine-part="track"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">해외 출발</span></span></li>
        <li data-station="customs" data-station-state="current" aria-current="step"><span data-spine-part="track"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">입항·통관</span></span></li>
        <li data-station="domestic" data-station-state="todo"><span data-spine-part="track"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">국내 배송</span></span></li>
        <li data-station="arrived" data-station-state="todo"><span data-spine-part="track"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">도착</span></span></li>
      </ol>
    </div>
    <div data-slot="eta" data-eta-kind="date">
      <p data-eta-label>도착 예상</p>
      <p data-eta-value><span class="ds-sr">9월 30일 (수)</span><span data-eta-visual aria-hidden="true"><span data-eta-part="month"><span data-eta-digit="9">9</span>월</span> <span data-eta-part="day"><span data-eta-digit="3">3</span><span data-eta-digit="0">0</span>일</span> <span data-eta-part="weekday">(수)</span></span><span data-eta-dday>D-4</span></p>
    </div>
  </div>
  <div class="ds-row">
    <a data-slot="button" data-variant="primary" data-size="lg" href="#">조회하기</a>
    <a data-slot="button" data-variant="secondary" data-size="md" href="#">다시 볼 링크 복사</a>
  </div>
</section>
<section data-style="night" class="ds-style">
  <h2>어두운 화면 (night)</h2>
  <div data-slot="status-head" data-tone="progress">
    <span data-status-chip="true" data-tone="progress">통관 대기 · 2/4</span>
    <h3>통관 순서를 기다리고 있어요</h3>
    <div data-slot="journey">
      <ol aria-label="배송 여정 4구간" data-spine-current="customs">
        <li data-station="departed" data-station-state="done"><span data-spine-part="track"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">해외 출발</span></span></li>
        <li data-station="customs" data-station-state="current" aria-current="step"><span data-spine-part="track"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">입항·통관</span></span></li>
        <li data-station="domestic" data-station-state="todo"><span data-spine-part="track"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">국내 배송</span></span></li>
        <li data-station="arrived" data-station-state="todo"><span data-spine-part="track"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">도착</span></span></li>
      </ol>
    </div>
    <div data-slot="eta" data-eta-kind="date">
      <p data-eta-label>도착 예상</p>
      <p data-eta-value><span class="ds-sr">9월 30일 (수)</span><span data-eta-visual aria-hidden="true"><span data-eta-part="month"><span data-eta-digit="9">9</span>월</span> <span data-eta-part="day"><span data-eta-digit="3">3</span><span data-eta-digit="0">0</span>일</span> <span data-eta-part="weekday">(수)</span></span><span data-eta-dday>D-4</span></p>
    </div>
  </div>
  <div class="ds-row">
    <a data-slot="button" data-variant="primary" data-size="lg" href="#">조회하기</a>
    <a data-slot="button" data-variant="secondary" data-size="md" href="#">다시 볼 링크 복사</a>
  </div>
</section>
</main>
</body>
</html>
```

In `design-system/README.md`, in the list of previews add the line `- \`foundations/styles.html\` — 세 화면 스타일(기본·서류형·어두운 화면)의 상태 머리·도착 예상·여정·버튼을 나란히 봅니다.` next to the other `foundations/` lines.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `Select-String -Path DESIGN.md -Pattern '^## 1[3-6]\.' | ForEach-Object { $_.Line }`
Expected: four headings, in order: `## 13. 보조 영역과 광고 시점`, `## 14. 색 토큰 (manifest)`, `## 15. 색 토큰 (night)`, `## 16. 화면 스타일 고르기와 첫 페인트`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/tokens.spec.ts tests/unit/ad-gate.spec.ts tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed — the contrast rows in §14/§15 equal `contrastRatio(...).toFixed(2)` of the Task 11 values; the spine counter now also counts the three spines of `styles.html` (one `aria-current="step"` each); no preview has a color literal; `_base.css` holds the three token files in order. If a DESIGN.md row fails, the executor changed a Task 11 value: recompute the row with `contrastRatio` and keep §14/§15, the CSS and `lib/style/tokens.ts` equal.

- [ ] **Step 6: Commit**

Run: `git add DESIGN.md design-system/_base.css design-system/foundations/styles.html design-system/README.md tests/unit/tokens.spec.ts; git commit -m "docs: add the manifest and night style sections to DESIGN.md and the design-system previews"`

---

### Task Final: Stage gate

- [ ] **G1. Port free.** `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue` → no output (stop listeners otherwise).
- [ ] **G2. Lint.** `npm run lint` → exit 0, no errors, no warnings introduced by this stage.
- [ ] **G3. Typecheck.** `npm run typecheck` → exit 0.
- [ ] **G4. Build.** `npm run build` → exit 0. Route table: `ƒ /[trackingNumber]` always; `/` is `ƒ` in S01 (it still reads `searchParams`), `○ /` from S02 on, and `○ /` with `Revalidate 5m` from S06 on.
- [ ] **G5. Dev-mode E2E.** `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npm run test:e2e` → "N passed", 0 failed (skips allowed only for tests guarded by `PW_MODE`, `PW_SHOTS`, `PW_VISUAL`, or an approval-gated `test.skip` naming the approval).
- [ ] **G6. Production-mode E2E.** Re-run `npm run build` if `next start` reports a missing or stale build. Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait for `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` = `200`; then `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test` → 0 failed, including `tests/budgets/*`.
- [ ] **G7. After-screens.** Server still running: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='after'; $env:PW_STAGE='S08'; npx playwright test tests/tools/stage-screens.spec.ts` → PNGs in `test-results/stage-screens/S08-after/` at 320, 375, 768, 1024, 1440. Compare with `S08-before/`; send both sets to the operator with SendUserFile. Stop the server (G1 command) and clear the flags: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.
- [ ] **G8. Budgets.** Paste the measured numbers of every budget this plan lists (from the G6 output) into the stage summary. Any budget over its fail line fails the gate.
- [ ] **G9. Code review.** Invoke the `code-review` skill on `git diff claude/tipoasis-tracking-renewal-ae0e3a...HEAD`. Fix every CRITICAL and HIGH finding; if code changed, re-run G2–G6.
- [ ] **G10. Verification.** Invoke `superpowers:verification-before-completion`; paste each command and its result line into the stage summary.
- [ ] **G11. Commit.** `git status` shows only this stage's files (see the roadmap File Map). Commit any remainder with a conventional message and no attribution trailer.
- [ ] **G12. No deploy.** Do not push to `main`; do not run `vercel deploy`. Push `renewal/s08-supplementary-and-styles` only if the operator asked. Hand the stage summary to the operator; merge into the integration branch only after acceptance (roadmap §5).

**S08 notes on the standard gate above**
- G4: `○ /` with `Revalidate 5m`, `ƒ /[trackingNumber]`, `○ /privacy`; no new route (the gallery keeps `/internal/ui-kit`). The build downloads IBM Plex Mono and JetBrains Mono through `next/font` like DM Mono.
- G5: allowed skips are every `tests/budgets/*` test (production only), the stage-screens tool (no `PW_SHOTS`), the 48 matrix shots (no `PW_VISUAL`), the two approval-15 rows of `ad-placement.spec.ts` ("approval 15: config.ads.manualSlotId is not set yet"), the recommendation describe that does not match `RECOMMENDATION_PRESENTATION` (approval 10) — only while Task 10 has not run —, the approval-7 describe of `ad-placement.spec.ts` when Task 9 is SKIPPED, and the earlier stages' production-only rows. Then run the matrix once in dev mode: `$env:PW_VISUAL='1'; npx playwright test tests/visual/style-matrix.spec.ts; $env:PW_VISUAL=$null` → `48 passed`.
- G6: next to S01/S05/S06/S07's budgets, `tests/budgets/css-budget.spec.ts` (3) and the per-style font rows of `tests/budgets/font-preload.spec.ts` (3) must pass; S07's JS budgets must stay green — the recommendation list loads through `import()`, and the picker plus the gate hook are the only new initial-bundle code.
- G7: the PNGs land in `test-artifacts/stage-screens/S08-after/` (S01 Addition 1). Every `home-*` shot changes (the showcase replaces the dark legacy band, the picker and the token footer close the page); every result shot ends with the picker and the new footer, and pending/in-transit/delivered show the '운영자 추천' block; `privacy-*` is on the token shell. The four style scenarios exist only in the after-set. If the R3 checkpoint (Task 8 Step 9) ran, compare against `S08A-after/` as well.
- G8 budget lines: `[css-budget]` ×3 (fail above 25600 B gzip -9), `[budget] manual slot fill at 375px/1280px` ×2 (fail if the height changes), `[font-budget] <style> deep link` ×3 plus S05's two signal lines (fail above 1 preload or 102400 B), and — unchanged since S06/S07 — `[js-budget]` ×5, `[html-budget]`, `[lcp-budget]`, `[fcp-budget]`, `[cls-budget]`, `[budget] result fill CLS`.
- G11: this stage's files are the File Structure table plus Additions 5, 6, 8 and 14; `tests/visual/style-matrix.spec.ts-snapshots/` holds exactly 48 PNGs.
- G12: merge with `git merge --no-ff renewal/s08-supplementary-and-styles -m "merge: S08 supplementary areas and selectable styles"` (or `-m "merge: S08 Part B selectable styles"` when Part A was merged at the R3 checkpoint), then cut the release checkpoint `git branch release/r3b claude/tipoasis-tracking-renewal-ae0e3a` (roadmap §1: R3b = S08 Part B; the operator opens the PR, no agent pushes to `main`).
- Stage summary also lists: the statuses of approvals 1, 6, 7, 10, 13, 15; which of Tasks 9, 10, 16 ran or were SKIPPED with the fallback evidence (the DESIGN.md §13 exception sentence and its unit test; the passing dialog rows; the five-item manual checklist per style); the Task 0 records (Steps 7–11); whether `components/StoreContactPopup.tsx` existed and was re-pointed; any earlier-stage text that had to be matched differently (Conventions); the contract deviations (Additions 1–16) and the open issues below.

---

## Open issues for the operator and later stages

1. **Recommendations point at store homes.** S03 shipped `featuredProducts` with store-home links (S03 open issue 3). While approval 10 is pending the dialog shows them as '운영자 추천' without claims; once approval 10 is recorded, Task 10 stops at its fact check until the operator supplies a product-detail link per item (the inline list requires one). Product ids of 10 or more digits in those links are allowlisted by the repository guard through `featuredProducts` (Task 10 Step 2).
2. **CSS budget basis.** S08 measures `gzip -9` (Addition 10). Spec §12 quotes the current CSS as a raw figure (188,660 B, almost all `@font-face`). A raw 25 KB budget is not reachable with Tailwind's preflight plus the token and slot CSS; the operator should confirm the gzip basis or name another one.
3. **Anchor reserve.** `ads.anchorReservePx` stays 64 px (Addition 15). Phase 1 GAP4 simulated anchors up to 124 px tall; after approval 15 is applied, measure the live mobile anchor on a phone and change `ads.anchorReservePx` and the three `--tt-anchor-reserve` values together (the Task 7 unit test keeps them equal).
4. **Manual slot needs an ad unit id.** Nothing renders until `config.ads.manualSlotId` is set (approval 15, applied in a different week from the R3 deploy). The two live-slot rows of `ad-placement.spec.ts` start running automatically then; `/ads.txt` is still a 404 after S06's three-way split (S01 open issue) and AdSense expects it.
5. **Approval 7 without approval 6.** `"afterAllowedResult"` also opens scrubbed deep links, which approval 6's fallback forbids; Task 9 stops in that combination. A home-only timing needs a fourth `AdTimingPolicy` value (contract amendment, roadmap §5).
6. **Korean display web fonts.** Contract §11.12 named Hahmlet (manifest) and Gothic A1 (night); S08 uses installed fonts for Korean display text (Addition 11). Self-hosted subsets would need a font-subset tool and a build step (approval 13) and a coverage check against the config copy.
7. **Report-Only noise.** With the pre-paint hash in the Report-Only `script-src`, CSP3 browsers ignore `'unsafe-inline'` there and report Next's own inline scripts (S01 open issue 4). Nothing is blocked; S11's report endpoint (if merged) will receive these reports, and the strict-CSP decision (approval 16) must cover Next's inline scripts before any `script-src` is enforced.
8. **Visual baselines are per platform.** The 48 baselines carry the `-chromium-win32` suffix; on another OS regenerate them with `--update-snapshots` and review them before trusting a diff. CI never runs the matrix.
9. **The fallback keeps one dialog.** Spec §12 says "다이얼로그는 쓰지 않습니다", while §16 item 10 "거절하면" keeps the recommendation dialog; S08 follows §16 until approval 10 (native modal `<dialog>`, links rendered only while open). Task 10 removes it.
10. **`optional` recommendation placement.** Spec §8 marks customsWaiting/customsCleared recommendations "선택". S08 reads it as an opt-in per item (`contexts`), so the shipped items (pending/inTransit/delivered only) show nothing there (Addition 1). The operator opts an item in by adding the state to its `contexts`.
11. **Unused fallback copy after approval 10.** `resultCopy.recommendationsOpen`/`recommendationsClose` stay in the config after Task 10 (a possible return to the dialog); a later cleanup may remove them together with their type and slot lines.

## Self-Review

- **Spec coverage.** §4 첫 화면 아래 order (보통 이렇게 걸려요 → 쇼케이스 카드 2장 → 수동 광고 슬롯 → 푸터) → Tasks 4, 7, 5, 14 (`isBefore` checks in `ad-placement.spec.ts`); §7 idle (쇼케이스 1블록 showcase placement, 광고 지연 삽입) → Tasks 4, 9; §8 광고 (loader conditions, deep-link hold on problem states, home after an allowed result or a scroll, manual slot 1 per page before the footer with 280/250 px, `scroll-padding-bottom`, "문제 상태 광고 0" = slot 0 + no new loader, `data-ad-exclude`/`google-anno-skip` untouched) → Tasks 7, 9; §8 문의 (톡톡 at most 3, footer place) → Task 5; §8 스토어·제휴 (disclosure first, `isAffiliate` decides `rel`) → Tasks 3, 4, 10; §8 추천 (inline only, validity window, 0 → no block, '이번 주' ≤ 7 days, price with detail link and ≤ 7-day check) → Tasks 1, 3, 10; §9 featuredProducts/ads → Tasks 1, 2, 7, 10; §12 CSS ≤ 25 KB, CLS, fonts ≤ 2 preloads and ≤ 100 KB, 320 px, 44 px targets, focus 3:1, text 4.5:1, 11 px → Tasks 7, 8, 13, 14; §13 three styles with the B default, token sets, the four variant slots, picker (fieldset/legend/3×44 px radios above the footer), first-visit rule with `followSystemDark`, `tt:style` in try/catch, pre-paint script with a CSP hash while `/` stays static, per-style fonts only when chosen, the one announcement, 48-shot matrix, axe and contrast per style, style-independent DOM → Tasks 11–17; §14 ManualAdSlot, privacy on the shell, test contract (rule → assertion map first, hooks) → Tasks 3–7 and RULE-MAP rows S08-1…S08-5; §15 R3 (추천 인라인, 수동 슬롯, 홈 로더 지연) and R3b → Parts A and B with the Task 8 checkpoint; §16 items 7, 10, 13 → Tasks 9, 10, 16, each starting with the ledger check and naming its "거절하면" fallback; §17 Q5 revert switch → `AD_TIMING_POLICY` comment and DESIGN.md §13.
- **Placeholder scan.** No "TBD", "TODO", "implement later" or "similar to Task N"; every code step carries complete code; the design-system preview and the DESIGN.md tables are written out in full. Steps that edit earlier stages' files quote the exact text and give a `Select-String` check; branch points (S06 Task 7F's popup, S11's options object in `next.config.ts`, an already-installed axe package, approvals recorded or not) spell out both paths.
- **Type consistency.** Contract names are used as written: `selectRecommendations`, `SelectedRecommendation`, `RecommendationList`, `StoreShowcase`, `ManualAdSlot({ allowed, slotId })`, `SiteFooter`, `StylePicker`, `PREPAINT_SCRIPT`, `PREPAINT_SCRIPT_SHA256`, `AD_TIMING_POLICY`, `AdGateInput`, `shouldInsertAdLoader`, `setAdSignals`, `STYLE_IDS`, `STYLE_LABELS`, `STYLE_STORAGE_KEY`, `IMPLEMENTED_STYLE_IDS`, `STYLE_COLOR_TOKENS`, `COLOR_TOKENS`, `NON_COLOR_TOKENS`, `CONTRAST_REQUIREMENTS`, `FeaturedItem`, `RevenueView`, `RecommendationContext`, `ViewMode`, `TrackingViewModel`, `ResultSlotProps.renderRecommendations`, `ads`, `style`, `resultCopy`, `featuredProducts`, `disclosures`, `channels`. S08 additions keep one spelling across tasks: `RecommendationPresentation`/`RECOMMENDATION_PRESENTATION`, `RECOMMENDATION_LIMIT`, `WEEKLY_LABEL_MAX_DAYS`, `PRICE_CHECK_MAX_AGE_DAYS`, `isProductDetailLink`, `selectOperatorPicks`, `recommendationsForView` (four parameters until Task 10, three after), `AdGateState`/`adGateState`, `ManualSlotMode`/`manualSlotMode`, `useAdGateState`, `ShowcaseReachedSignal`, `PREPAINT_SCRIPT_ID`, `PREPAINT_CSP_SOURCE`, `readAppliedStyle`/`subscribeAppliedStyle`/`applyStyleChoice`, `MANIFEST_COLORS`/`NIGHT_COLORS`, hooks `data-store-showcase`, `data-ad-scroll-sentinel`, `data-recommendation-weekly`, `data-recommendation-price`, `data-style-picker`, `data-follow-dark`, `data-ad-slot="manual"`. Test counts: `recommendations.spec.ts` (unit) 13 → 15 (Task 2) → 17 (Task 6) → Task 10 rewrites it; `ad-gate.spec.ts` 7 → 11 (Task 7) → 12 (Task 8), 12 after Task 9; `ad-placement.spec.ts` 7 → 11 → 16 (2 skipped) → 20 with Task 9; `recommendations.spec.ts` (e2e) 11; `prepaint.spec.ts` 6 → 7; `style-picker.spec.ts` 9 → 17; `style-a11y.spec.ts` 9; matrix 48.
- **Review Focus.** (1) storage that throws → Task 12 unit row and E2E rows (light and dark), Task 14 picker row; (2) a customer's clock far from the config dates → Task 1 boundary rows, Task 3 "after every validity span has ended"; (3) a dark device with an earlier or damaged choice, and no JavaScript → Task 12 rows; (4) 320 px in the new styles → Task 13 gallery rows, Task 14 live rows with the 18-digit cargo number; (5) store links that are not product pages → Task 1 "a store-home link is never recommended", Task 3 "no product link is in the page until the dialog opens", Task 10's fact check and inline rows. The roadmap's Review Focus 3 (S08: `style-picker.spec.ts` with storage throwing) is covered by (1).
