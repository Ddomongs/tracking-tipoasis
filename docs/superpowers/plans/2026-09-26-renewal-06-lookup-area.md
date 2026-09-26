# S06 — Lookup Area and Page Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy home with one server shell (`TrackingPage`) shared by `/` and `/{번호}` and one client island (`LookupController`), so that the lookup area — 48 px header, form, format hint, '번호는 어디서 찾나요?', input assist, 상담·스토어 바로가기 row, '보통 이렇게 걸려요', notice line — fits the 375×812 first view; deep links paint the number bar and '조회하고 있어요' from the server HTML, other alphanumeric paths get the INVALID screen and everything else a real 404; framer-motion and every infinite animation are gone; and the home E2E contract moves from copy to roles and hooks.

**Architecture:** `app/(public)/page.tsx` (static, `revalidate = 300`) and `app/(public)/[trackingNumber]/page.tsx` (three-way split with `classifyDeepLink`) both render the server component `TrackingPage`, which renders the client island `LookupController`. The island owns the view mode as component state (idle → loading → settled | error), wires S04's `useLookup`, S02's scrub/restore/ad signals and S05's primitives, and decides what to show through a pure display table (`components/lookup/lookup-display.ts`). Until S07 ships its result island, loading/result/error content comes from S04's `StatusSlot` inside the transitional `LegacyResultSection`, whose view model is derived through a dynamic import so `deriveTrackingView` and zod stay out of the lookup island's static graph. Pure input rules (normalization, pre-check, confusables, deep-link decision, paste extraction) live in `lib/tracking/number-input.ts`.

**Tech Stack:** Next.js 16.3.6 App Router (Turbopack), React 19.3, TypeScript strict, Tailwind CSS 3.4 with the S05 `tt-*` keys, zod 3.25 (untouched here), Playwright 1.55 (the only test runner; pure-function tests are Playwright tests without a `page`; budgets use a Chromium CDP session). framer-motion is uninstalled by Task 9. Windows: every `npm`/`npx`/`node` command runs in PowerShell 5.1.

**Spec:** `docs/superpowers/specs/2026-09-26-tracking-renewal-ia-design.md` — §3 (routes, screen modes, two entrances, candidate B, noscript), §4 (first view, input, format hint, 바로가기 행, below the fold), §5 (0–0.4 s button label, focus and live rules, INVALID handling), §7 rows idle / loading / error INVALID, §8 (톡톡 ≤ 3 places, disclosure first), §9 (notices re-filtered after mount), §12 (a11y and budgets), §13 (visual rules, B supplements), §14 (components, test contract), §16 approvals 1, 2, 13. Roadmap and shared contract: `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` (§4 ledger, §6 Task 0, §7 gate, §9 budgets, §10 File Map, §11 contract). Stage plans consumed: S01 (`…-01-r0-urgent-fixes.md`), S02 (`…-02-r1-number-protection.md`), S03 (`…-03-r2-state-core.md`), S05 (`…-05-design-tokens-common.md`). S04's plan (`…-04-r2-status-slot.md`) did not exist when this plan was written: S06 consumes S04 through contract §11.8–§11.9 only and verifies S04's real shapes in Task 0 (see "Consumed S04 shapes"). S07 (`…-07-result-area.md`) later replaces `LegacyResultSection` with its own result island, which takes over the settle-time focus, live sentence and document title from `LookupController`.

**Depends on:** S02, S04, S05 (and through them S01, S03).

**Gated by:** approval 2 (the whole stage; roadmap §4 marks it BLOCKING for S06), approval 1 (Task 7; the fallback is Task 7F), approval 13 (Task 11).

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

**S06-specific constraints**
- S06 is user order #2 of R3. R3 is released only after S05, S06, S07 and S08 Part A are merged (roadmap §1), so the transitional states below never reach production on their own.
- Result rendering stays S04's until S07: `LegacyResultSection` renders S04's `StatusSlot` plus the legacy details exactly as S04's `HomePageClient` rendered them. S04's E2E files (`tests/e2e/{status-slot,loading-timeline,failure-causes,cta-consistency}.spec.ts`), S02's E2E files and the result tests in `tests/tracking.spec.ts` must pass unchanged at every commit of this stage.
- Legacy dark components that stay visible until S07/S08 (the legacy footer, the legacy `StorefrontShowcase`, S04's status slot with the legacy result details, the privacy article) sit on a `.tt-legacy-dark` band so they stay readable once the body switches to the tokens (Task 9).
- Test contract migration (approval 2): `tests/e2e/RULE-MAP.md` is written first (Task 3). A legacy test is removed only in the task that adds the new assertions for its rules, and only after those assertions pass.
- The lookup island never imports `zod`, `lib/schemas.ts`, `lib/delivery-carriers.ts`, `lib/tracking/derive-view.ts` or `lib/tracking/derive/*` statically (contract §11.1 rule 3; S03's `tests/unit/module-boundaries.spec.ts` enforces it for every file in `components/lookup/`, following imports transitively). `deriveTrackingView` and `siteConfig` are reached through a dynamic `import()` only.
- eslint-config-next 16 runs the React Compiler rules (`react-hooks/set-state-in-effect`, `react-hooks/refs`, `react-hooks/purity`, `react-hooks/immutability`): no `setState` directly in an effect body, no `ref.current` read during render, no `Date.now()`/`new Date()` in a component body. Clock reads live in event handlers, effects, `useSyncExternalStore` snapshot functions or plain helpers outside components.
- Customer copy: spec strings that are also selectors (§11.11: '통관·배송 조회', '문의', '본문으로 건너뛰기', '조회번호 (HBL 또는 운송장)', '국내 택배사', '자동으로 찾기', '배송 조회 결과', '상담·스토어 바로가기', '택배사를 CJ대한통운으로 맞췄어요', '되돌리기', '번호 변경', and the spec's '다른 번호 조회') are constants in the S06 module that renders them; the diagnosis and confusable sentences live in `lib/tracking/number-input.ts` (contract §11.8); the one customer sentence the spec does not give (the noscript notice) is added to `config/site.config.ts` as `lookup.copy.noscriptNotice` (Task 8). Everything else comes from `config/site.config.ts`.
- Digits in tests come from `tests/fixtures/tracking-fixtures.ts` only. This plan is scanned by S01's repository guard: it contains no 10+ digit run except all-zero-prefixed fixture forms and the fake mobile number.
- No new npm dependency. Task 9 only removes `framer-motion`. `@axe-core/playwright` is used only if approval 13 installed it (Task 11).

## Review Focus

Conditions the spec implies but no requirement line names, most likely first. Each line names the test that pins it.

1. **Pasted notification text with several digit runs** (roadmap Review Focus 1: an order number, the mobile number '010-0000-1234', a date '2026.09.26' and the waybill in one message): extraction returns the waybill/HBL only when exactly one candidate passes `identifyTrackingNumber`; with two candidates nothing is auto-picked and the pasted text stays in the input for the customer to edit. Owner: Task 2 (`tests/unit/number-input.spec.ts` "extractFromPastedText" rows) and Task 6 (`tests/e2e/lookup-input.spec.ts` "a pasted text with two number candidates is left for the customer to edit").
2. **Deep-link path variants** (roadmap Review Focus 4: lowercase HBL, `%20`-encoded spaces, hyphens, full-width digits, a trailing slash, 31+ characters, a dot): the server split and the client normalizer agree, invalid input never calls the API, every number-like response is `noindex`. Owner: Task 1 (unit rows) and Task 5 (`tests/e2e/deep-link.spec.ts` "path variants normalize to one lookup", "other shapes are a real 404 without a lookup", "a trailing slash redirects to the number path", "number-like responses are noindex and titled without the number").
3. **A customer who presses a key or taps while a deep link is still loading**: when the result arrives, focus must not jump to the status heading (spec §5 "딥링크는 고객이 다른 곳을 조작하지 않았을 때만"). Owner: Task 5 (`deep-link.spec.ts` "focus stays where the customer is when they interacted during loading").
4. **A form submitted before the scripts arrive** (slow network, blocked scripts): the GET form still reaches the deep-link shell through the `?trackingNumber` redirect, and the shell says why no result appears. Owner: Task 5 (`lookup-input.spec.ts` "without JavaScript the form reaches the deep-link shell through the redirect") and Task 8 ("without JavaScript the deep-link shell explains that results need JavaScript").
5. **A home page served from the 5-minute cache after its notice ended, or a phone clock far off**: an ended notice never shows after mount. Owner: Task 8 (`tests/unit/lookup-display.spec.ts` "the home notice survives only while it is active on the customer's clock" and `home.spec.ts` "a notice that has ended by the customer's clock is gone after mount").

Also pinned: an 18-digit cargo number at 320 px never scrolls horizontally (Task 5 `deep-link.spec.ts`), and leaving a slow lookup through [번호 변경] ignores its late answer (Task 5 `home.spec.ts`).

## Additions to the contract

Additive; no §11 name is renamed or retyped. Each item goes into the stage summary as a contract deviation (roadmap §5 "Contract changes").

1. **`lib/tracking/number-input.ts` extra exports:** `export const MAX_NUMBER_LENGTH = 30` (the API's `trackingNumber` limit in `lib/schemas.ts`), `export type ConfusableKind = "letterO" | "letterIl"`, `export function pasteCarrierNotice(carrierName: string): string` ('택배사를 CJ대한통운으로 맞췄어요', choosing 으로/로 by the last syllable).
2. **File Map additions (S06-owned):** `components/lookup/lookup-display.ts` (pure display table: `computeDisplay`, `viewModeOf`, `outcomeKey`, `stillActiveHomeNotice`, types `LookupDisplay`, `DisplayInput`, `DerivedView`, `InvalidInput`), `components/lookup/session.ts` (per-document snapshots: restore entry, client clock; the same-address history helpers when S02 shipped them), `components/lookup/PendingCard.tsx` (the static '조회하고 있어요' card of a deep link before its lookup starts and during its first 0.4 s), `tests/unit/lookup-display.spec.ts`. Only files in `components/lookup/` and S06's tests import them; S07 may change or delete them.
3. **Config addition:** `LookupConfig.copy.noscriptNotice: string` (type in `lib/config/types.ts`, schema in `lib/config/schema.ts`, value in `config/site.config.ts`, expectation in `tests/unit/config.spec.ts`). The File Map rows of those four files gain "M S06".
4. **Transitional CSS class `.tt-legacy-dark`** in `app/globals.css` (a dark band for legacy components). S07 removes its result-area users and S08 removes the rest (legacy footer, legacy showcase, privacy page) and deletes the class. The File Map row `app/(public)/privacy/page.tsx` gains "M S06" (Task 9 adds the class to its `<main>`).
5. **`LegacyResultSection.tsx` transitional exports:** `export type LegacyDeriver = (outcome: LookupOutcome, now: Date) => TrackingViewModel`, `export function loadLegacyDeriver(): Promise<LegacyDeriver>`, `export function getLoadedLegacyDeriver(): LegacyDeriver | null`, `export function LegacyResultSection(props: StatusSlotProps): React.JSX.Element`. S07 replaces them with `loadResultModule()` and deletes the file.
6. **Deep-link metadata:** the `/[trackingNumber]` document title is `${stateGuide.loading.docTitle} · 배송 조회` ('조회 중 · 배송 조회') for valid numbers and `${stateGuide.invalidNumber.docTitle} · 배송 조회` for the INVALID screen; `robots: { index: false, follow: false }`.
7. **Legacy components kept mounted:** the legacy `StorefrontShowcase` stays in `TrackingPage`'s idle extras (on a `.tt-legacy-dark` band) until S08 swaps in `StoreShowcase`; the legacy `components/SiteFooter.tsx` is mounted by `app/(public)/layout.tsx` until S08's `components/shell/SiteFooter.tsx`.
8. **Stage-screen output path** follows S01's Addition 1: `test-artifacts/stage-screens/S06-<before|after>/` (read that path wherever the verbatim Task 0 / gate text says `test-results/stage-screens/`).
9. **`FailureFallback`** (listed in the File Map without a contract signature): `FailureFallback(props: { readonly guideKey: "invalidNumber" | "serverError" }): React.JSX.Element` — the error CTA block `<div data-cta-state="error">` (h3 `ctaHeading`, sentence `nextAction`, then [톡톡으로 문의하기] as the block's first link) used on the INVALID form screen and when the result code cannot be loaded.

## Consumed S04 shapes

S04's plan was not available when this plan was written. S06 relies on these contract facts and checks them in Task 0 Step 9; if one does not hold, stop and have this plan amended before Task 4.

- **A1** `components/lookup/useLookup.ts` exports `useLookup(options: UseLookupOptions): UseLookupResult` exactly as §11.9; `onSettled(outcome, now)` is called once per settled request, outside render; `submit`, `retry`, `cancel`, `reset` are stable callbacks; `cancel` returns to `phase: "idle"`; `loading` is non-null while `state.phase === "loading"`.
- **A2** `components/status-slot/StatusSlot.tsx` exports `interface StatusSlotProps` and `StatusSlot` exactly as §11.9. It attaches `headingRef` to its visible status `h2` (`tabIndex={-1}`), renders the result summary with `ReturnLinkButton` ('다시 볼 링크 복사'), and does **not** call `useAnnounce`, move focus or set `document.title` (S04's `HomePageClient` did those; `LookupController` takes them over).
- **A3** `components/primitives/LiveAnnouncer.tsx` exports `LiveAnnouncerProvider` and `useAnnounce` as §11.9, and S04 mounted the provider inside `components/HomePageClient.tsx` (not in a layout).
- **A4** S04's `HomePageClient` renders, after `<StatusSlot … />`, the legacy result details (customs/delivery timelines, `CustomerCta`, `RecommendedProducts` with S04's props and conditions). Task 5 moves that block into `LegacyResultSection` verbatim.

## File Structure

| Path | Action (task) | Responsibility |
|---|---|---|
| `lib/tracking/number-input.ts` | Create (1), Modify (2) | Normalization, pre-check with diagnosis, confusables, deep-link decision, `?c=` parsing (1); paste extraction and the paste notice (2) |
| `tests/unit/number-input.spec.ts` | Create (1), Modify (2) | Table tests of the module |
| `tests/e2e/RULE-MAP.md` | Create (3), Modify (5, 7 or 7F, 9) | Rule → assertion map of the existing home E2E; status per row |
| `components/shell/SiteHeader.tsx` | Create (4) | 48 px header, '통관·배송 조회' + '문의', skip link |
| `app/(public)/layout.tsx` | Modify (4) | `LiveAnnouncerProvider`, header, legacy footer band, `AdLoader` |
| `components/SiteHeader.tsx` | Delete (4) | Legacy header |
| `components/HomePageClient.tsx` | Modify (4), Delete (5) | Loses header/footer/provider (4); replaced by the shell (5) |
| `app/globals.css` | Modify (4, 9) | `.tt-legacy-dark` (4); token body, legacy motion and decoration removed (9) |
| `tests/e2e/home.spec.ts` | Create (4), Modify (5, 7 or 7F, 8, 9, 11) | Header, home first view, mode changes, shortcut row, below the fold, tokens, axe |
| `components/lookup/lookup-display.ts` | Create (5), Modify (8) | Pure display table (5); home notice re-filter (8) |
| `components/lookup/session.ts` | Create (5), Modify (8) | Restore snapshot, same-address entry if S02 shipped it (5); client clock snapshot (8) |
| `components/lookup/FormatHint.tsx`, `NumberFinderHelp.tsx`, `FailureFallback.tsx`, `PendingCard.tsx` | Create (5) | Form pieces and fallbacks |
| `components/lookup/LookupForm.tsx` | Create (5), Modify (6) | Form and invalid state (5); paste handler and assist slot (6) |
| `components/lookup/LegacyResultSection.tsx` | Create (5) | Transitional: S04 status slot + legacy details + lazy deriver |
| `components/lookup/LookupController.tsx` | Create (5), Modify (6, 7 or 7F, 8) | The client island |
| `components/shell/TrackingPage.tsx` | Create (5), Modify (8) | Server shell |
| `app/(public)/page.tsx`, `app/(public)/[trackingNumber]/page.tsx` | Modify (5) | Static `/`; three-way split, `?c=`, metadata |
| `components/TrackingForm.tsx`, `LogisticsFlow.tsx`, `AssuranceRail.tsx`, `ServiceGuide.tsx` | Delete (5) | Replaced or retired |
| `tests/unit/lookup-display.spec.ts` | Create (5), Modify (8) | Display table and notice re-filter |
| `tests/e2e/deep-link.spec.ts` | Create (5) | Deep-link split, focus/live/title rules |
| `tests/e2e/lookup-input.spec.ts` | Create (5), Modify (6, 8) | Input rules, pre-check, paste, no-JS paths |
| `tests/tracking.spec.ts` | Modify (5, 7 or 7F) | Remove the migrated home/motion/layout/format tests; popup steps |
| `components/lookup/InputAssist.tsx` | Create (6) | Paste notice + [되돌리기], confusable hint |
| `components/lookup/ShortcutRow.tsx` | Create (7) | Region '상담·스토어 바로가기' (full / talkOnly) |
| `components/StoreContactPopup.tsx` | Delete (7) or Modify (7F) | Popup removed (approval 1) or collapsed by default (fallback) |
| `components/lookup/TypicalDurations.tsx` | Create (8) | '보통 이렇게 걸려요' details |
| `config/site.config.ts`, `lib/config/types.ts`, `lib/config/schema.ts`, `tests/unit/config.spec.ts` | Modify (8) | `lookup.copy.noscriptNotice` |
| `tailwind.config.ts`, `components/TimelineStep.tsx`, `components/CustomerCta.tsx`, `app/not-found.tsx`, `app/(public)/privacy/page.tsx`, `package.json`, `package-lock.json` | Modify (9) | `pulse-glow` gone, static timeline step, no floating CTA, token 404, dark band on privacy, framer-motion uninstalled |
| `components/StatusBanner.tsx`, `components/ui/badge.tsx` | Delete (9) | Unused legacy |
| `tests/budgets/motion-budget.spec.ts` | Create (9) | 0 infinite animations after 8 s, reduced motion, no framer-motion |
| `tests/budgets/html-budget.spec.ts`, `tests/budgets/lcp-budget.spec.ts` | Create (10) | HTML ≤ 35 KB + static cache; LCP, deep-link first paint, CLS |
| `tests/tools/stage-screens.spec.ts` | Modify (10) | Append the INVALID deep-link scenario |

**Budgets this stage owns (paste the measured values into the stage summary at G8):** `/` HTML ≤ 35 KB (`[html-budget]`); 0 infinite animations 8 s after load on `/`, on a loading deep link and on a settled result (`motion-budget.spec.ts`); `/` LCP ≤ 2.0 s on Slow 4G (`[lcp-budget]`); deep-link first contentful paint ≤ 1.0 s on Fast 4G (`[fcp-budget]`); CLS ≤ 0.05 on `/` and while a deep link loads (`[cls-budget]`); home first-view geometry — shortcut row bottom ≤ 550 px at 375×667 and ≈ 500 px at 375×812 (`[geometry]`, Task 7; Task 7F measures the [조회하기] bottom instead).

**Execution order:** Task 0 → 1 → 2 → 3 → 4 → 5 → 6 → (7 if approval 1 is `approved`, else 7F) → 8 → 9 → 10 → (11 if approval 13 is `approved`, else its fallback step) → Task Final.

## Conventions for this plan

- Shell: PowerShell 5.1 for `npm`, `npx`, `node` and `git` (no `&&`; use `;`). `$env:NAME='x'` sets a flag for the rest of the session; clear it with `$env:NAME=$null`. Paths with parentheses or brackets are quoted, and `Test-Path`/`Get-Content`/`Select-String` use `-LiteralPath`.
- **Unit run** (no web server): `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/<file>.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
- **Dev-mode run** (port 43210 free; Playwright starts `next dev`): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test <files>`
- **Production run** = `npm run build` (exit 0) → background PowerShell `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1` → wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200` → `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test <files>` → stop the server with `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }` and clear the flags `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`. `next start` warns `"next start" does not work with "output: standalone" configuration`; the server still runs.
- After a route file changes shape, delete stale generated route types before `npm run typecheck`: `if (Test-Path .next) { Remove-Item -Recurse -Force .next }`.
- Existing-file edits quote the exact text to find. Earlier stages may have reformatted the quoted text; if a quoted fragment is not found, apply the same change to the equivalent lines and write the difference into the stage summary.

---

### Task 0: Stage start

- [ ] **Step 1: Read approvals.** Open `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §4. For every approval number in this plan's "Gated by" list, write its Status into the stage summary. `pending`/`rejected` → execute the fallback steps and mark the gated task SKIPPED with the reason.
- [ ] **Step 2: Confirm dependencies.** Run (PowerShell): `git log --oneline claude/tipoasis-tracking-renewal-ae0e3a -40`
  Expected: a `merge: SNN …` commit for every stage in this plan's "Depends on" list.
- [ ] **Step 3: Branch.** Run: `git switch -c renewal/s06-lookup-area claude/tipoasis-tracking-renewal-ae0e3a`
  Expected: `Switched to a new branch 'renewal/s06-lookup-area'`.
- [ ] **Step 4: Port free.** Run: `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue`
  Expected: no output. Otherwise stop the listener: `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`
- [ ] **Step 5: Baseline build and before-screens.** Run `npm ci` only if `package-lock.json` changed since the last install in this worktree, then `npm run build`.
  Expected: build exits 0. Start the production server in a background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`
  Wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200`.
  Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='before'; $env:PW_STAGE='S06'; npx playwright test tests/tools/stage-screens.spec.ts`
  Expected: PNGs in `test-results/stage-screens/S06-before/` for widths 320, 375, 768, 1024, 1440. (S01 creates the tool first; S01 runs this step after its Task 1.)
- [ ] **Step 6: Baseline suite.** With the server still running: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test`
  Expected: record "N passed / M skipped / 0 failed" in the stage summary. Then stop the server (Step 4 command) and clear the flags: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.

**S06 notes on the standard steps above**
- Step 1: the "Gated by" list is approvals 2, 1 and 13. Approval 2 is decided in Step 7 below (it gates the whole stage). Approval 1 selects Task 7 (`approved`) or Task 7F (anything else). Approval 13 selects Task 11 (`approved`) or its fallback step.
- Step 5 and gate G7: the stage-screens tool writes to `test-artifacts/stage-screens/S06-before/` and `…/S06-after/` (S01 Addition 1).

- [ ] **Step 7 (S06): Approval 2 is a hard stop.** Open roadmap §4 and read row 2 ("Home restructure + test contract").
  - `approved` → write "approval 2: approved" into the stage summary and continue.
  - anything else → **stop the stage now.** Write into the stage summary: "S06 blocked: approval 2 is `<status>`. Spec §16 item 2 'if declined': the new states would have to keep the current test wording, so the home cannot drop the hero copy, LogisticsFlow, AssuranceRail, the input shake and the popup dialog that `tests/tracking.spec.ts` asserts; the operator must decide approval 2 or re-scope S06." Delete the stage branch (`git switch claude/tipoasis-tracking-renewal-ae0e3a; git branch -D renewal/s06-lookup-area`) and hand the summary to the operator. No other task runs.

- [ ] **Step 8 (S06): Dependency artifacts exist.** Run:
  `Test-Path -LiteralPath lib/privacy/url-scrub.ts, lib/privacy/session-restore.ts, lib/ads/ad-signals.ts, components/ads/AdLoader.tsx, components/ReturnLinkButton.tsx, tests/support/network-capture.ts, config/site.config.ts, lib/tracking/carriers.ts, lib/tracking/notices.ts, lib/tracking/loading-view.ts, lib/tracking/derive-view.ts, lib/tracking/number-format.ts, tests/fixtures/config-fixtures.ts, lib/tracking/lookup-state.ts, lib/tracking/fetch-track.ts, components/lookup/useLookup.ts, components/primitives/LiveAnnouncer.tsx, components/status-slot/StatusSlot.tsx, app/styles/tokens.css, components/primitives/Button.tsx, components/primitives/ButtonLink.tsx, components/primitives/NumberBar.tsx, components/primitives/TalkLink.tsx, components/primitives/NoticeBanner.tsx, components/primitives/ToneIcon.tsx, tests/unit/module-boundaries.spec.ts`
  Expected: 26 lines `True`. Any `False` → stop; the stage that owns the file (S02 first six, S03 next seven, S04 next five, S05 next seven, S03 last) is not merged.

- [ ] **Step 9 (S06): Check the consumed S04 shapes (A1–A4).** Run:
  `Select-String -LiteralPath components/lookup/useLookup.ts -Pattern "export function useLookup|export interface UseLookup(Options|Result)"`
  Expected: three lines (the function and both interfaces).
  `Select-String -LiteralPath components/status-slot/StatusSlot.tsx -Pattern "export interface StatusSlotProps|export function StatusSlot|headingRef|useAnnounce|document\.title|\.focus\("`
  Expected: lines for `export interface StatusSlotProps`, `export function StatusSlot` and at least one `headingRef` use; **no** line with `useAnnounce`, `document.title` or `.focus(`. If `useAnnounce`, `document.title` or `.focus(` appears, S04's slot already announces, titles or focuses: stop and have Task 5 Step 11 amended so `LookupController` does not do the same work twice.
  `Select-String -LiteralPath components/HomePageClient.tsx -Pattern "LiveAnnouncerProvider|<StatusSlot|useLookup\(|onSettled|useAnnounce|document\.title|\.focus\(|setAdSignals|scrubNumberFromUrl|readRestoreEntry|LOOKUP_HISTORY_MARK"`
  Expected: `LiveAnnouncerProvider` (import and one element), `<StatusSlot`, `useLookup(`, S02's `setAdSignals`/`scrubNumberFromUrl`/`readRestoreEntry` lines, and S04's focus/title/announce lines. Copy the whole output into the stage summary. Any behavior of S04's `HomePageClient` that is **not** one of: lookup start on a deep link, candidate-B scrub, restore, focus to the status `h2`, one live sentence, document title, the same-address entry, or the rendering of the result block — stop and have Task 5 amended to port it.
  Then print S04's result block for Task 5 Step 10: `git show claude/tipoasis-tracking-renewal-ae0e3a:components/HomePageClient.tsx` and copy the JSX that follows `<StatusSlot … />` (up to, not including, the storefront showcase, `ServiceGuide` and footer elements) plus the module-level helpers it uses into the stage summary under the heading "S04 result block".

- [ ] **Step 10 (S06): Did S02 ship the same-address history entry?** Run: `Select-String -LiteralPath components/HomePageClient.tsx -Pattern "LOOKUP_HISTORY_MARK"`
  Expected: either no output (S02 Task 11 SKIPPED — write "same-address entry: not shipped, Task 5 Step 12 skipped") or one or more lines (write "same-address entry: shipped, Task 5 Step 12 runs").

- [ ] **Step 11 (S06): Skip work that already exists elsewhere.** Run:
  `git fetch --all --prune; git log --all --oneline -S "LookupController" -- components; git log --all --oneline -S "ShortcutRow" -- components; git log --all --oneline -S "classifyDeepLink" -- lib`
  Expected: no output. If a line appears, list the containing branches with `git branch -a --contains <sha>`; if one of them is not an S06 stage branch, stop and ask the operator which branch is authoritative (a hotfix or another session already started this work).
  Run: `Select-String -LiteralPath package.json -Pattern '"framer-motion"'`
  Expected: one line (Task 9 removes it). No output → a hotfix already removed framer-motion: Task 9 Step 5 is `DONE-BY-HOTFIX`; keep its test.

---

### Task 1: Input rules — normalization, pre-check, confusables, deep-link decision, `?c=`

**Files:**
- Create: `lib/tracking/number-input.ts`
- Test: `tests/unit/number-input.spec.ts`

**Interfaces:**
- Consumes: `identifyTrackingNumber` (`lib/services/identifier.ts`, frozen, type-only imports inside), `CONCRETE_CARRIER_CODES` (`lib/tracking/carriers.ts`, S03 Addition 1), types `ConcreteCarrierCode`, `InvalidReason` (`lib/tracking/types.ts`), `DeliveryCarrierCode` (`lib/types.ts`); fixtures `FAKE`, `FAKE_GROUPED` (S01).
- Produces (contract §11.8 + Addition 1): `normalizeInput(value: string): string`, `classifyDeepLink(segment: string): DeepLinkDecision`, `parseCarrierParam(value: string | readonly string[] | undefined): DeliveryCarrierCode`, `detectConfusables(normalized: string): ConfusableHint`, `precheckNumber(value: string): PrecheckResult`, types `DeepLinkDecision`, `ConfusableHint`, `ConfusableKind`, `PrecheckResult`, constant `MAX_NUMBER_LENGTH = 30`. Task 2 adds `PasteExtraction`, `extractFromPastedText`, `pasteCarrierNotice` to the same file.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/number-input.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import {
  classifyDeepLink,
  detectConfusables,
  MAX_NUMBER_LENGTH,
  normalizeInput,
  parseCarrierParam,
  precheckNumber
} from "@/lib/tracking/number-input";
import { FAKE, FAKE_GROUPED } from "../fixtures/tracking-fixtures";

/** '!'…'~' → their full-width forms (U+FF01…U+FF5E); spaces stay as they are. */
const toFullWidth = (value: string): string =>
  value.replace(/[!-~]/g, (character) => String.fromCharCode(character.charCodeAt(0) + 0xfee0));

const O_MESSAGE = "영문 O가 섞여 있어요. 숫자 0인가요?";
const IL_MESSAGE = "영문 I나 l이 섞여 있어요. 숫자 1인가요?";

test.describe("normalizeInput", () => {
  test("removes spaces and hyphens, converts full-width characters and uppercases", () => {
    expect(normalizeInput(`  ${FAKE_GROUPED.domestic}  `)).toBe(FAKE.domestic);
    expect(normalizeInput(FAKE_GROUPED.domestic.replaceAll(" ", "-"))).toBe(FAKE.domestic);
    expect(normalizeInput(FAKE_GROUPED.domestic.replaceAll(" ", "–"))).toBe(FAKE.domestic);
    expect(normalizeInput(FAKE_GROUPED.domestic.replaceAll(" ", "　"))).toBe(FAKE.domestic);
    expect(normalizeInput(toFullWidth(FAKE_GROUPED.hbl.toLowerCase()))).toBe(FAKE.hbl);
    expect(normalizeInput(toFullWidth(FAKE_GROUPED.domestic.replaceAll(" ", "-")))).toBe(FAKE.domestic);
    expect(normalizeInput("")).toBe("");
  });
});

test.describe("precheckNumber", () => {
  test("accepts every fixture format and returns the normalized number", () => {
    for (const value of [
      FAKE.domestic,
      FAKE.domesticAlt,
      FAKE.domestic10,
      FAKE.domestic14,
      FAKE.cargo,
      FAKE.hbl,
      FAKE.hblAlt,
      FAKE_GROUPED.domestic,
      FAKE.hbl.toLowerCase(),
      toFullWidth(FAKE.domestic)
    ]) {
      expect(precheckNumber(value), value).toEqual({ ok: true, number: normalizeInput(value) });
    }
  });

  test("names the reason and a one-line diagnosis for every other input", () => {
    expect(precheckNumber("   ")).toEqual({ ok: false, reason: "empty", diagnosis: "조회번호를 넣어 주세요" });
    expect(precheckNumber(FAKE.invalidShort)).toEqual({ ok: false, reason: "tooShort", diagnosis: "지금 5자리예요" });
    expect(precheckNumber(FAKE.invalidConfusable)).toEqual({
      ok: false,
      reason: "confusableLetter",
      diagnosis: `입력하신 값: 0000-0000-00O0 → ${O_MESSAGE}`
    });
    expect(precheckNumber("TEST0000")).toEqual({ ok: false, reason: "tooShort", diagnosis: "영문 뒤 숫자가 지금 4자리예요" });
    expect(precheckNumber(`TEST${"0".repeat(17)}`)).toEqual({
      ok: false,
      reason: "badFormat",
      diagnosis: "영문 뒤 숫자가 지금 17자리예요. 8~16자리여야 해요"
    });
    expect(precheckNumber(FAKE.deepLinkInvalid)).toEqual({
      ok: false,
      reason: "badFormat",
      diagnosis: "영문은 번호 앞에 3~4자만 올 수 있어요"
    });
    expect(precheckNumber("0000#1234")).toEqual({ ok: false, reason: "badFormat", diagnosis: "숫자와 영문만 넣을 수 있어요" });
    expect(precheckNumber("0".repeat(MAX_NUMBER_LENGTH + 1))).toEqual({
      ok: false,
      reason: "tooLong",
      diagnosis: "지금 31자예요. 30자까지 넣을 수 있어요"
    });
  });
});

test.describe("detectConfusables", () => {
  test("suggests the digit when a letter O, I or l makes an otherwise valid number", () => {
    expect(detectConfusables(normalizeInput(FAKE.invalidConfusable))).toEqual({
      kind: "letterO",
      suggestion: "000000000000",
      message: O_MESSAGE
    });
    expect(detectConfusables("TEST0000O001")).toEqual({ kind: "letterO", suggestion: FAKE.hbl, message: O_MESSAGE });
    expect(detectConfusables("TESTO0000001")).toEqual({ kind: "letterO", suggestion: FAKE.hbl, message: O_MESSAGE });
    expect(detectConfusables(normalizeInput("0000i2345678"))).toEqual({
      kind: "letterIl",
      suggestion: FAKE.domestic,
      message: IL_MESSAGE
    });
    expect(detectConfusables(normalizeInput("0000l2345678"))).toEqual({
      kind: "letterIl",
      suggestion: FAKE.domestic,
      message: IL_MESSAGE
    });
  });

  test("stays silent for valid numbers, real HBL prefixes and hopeless input", () => {
    expect(detectConfusables(FAKE.hbl)).toBeNull();
    expect(detectConfusables("OLIV00000001")).toBeNull();
    expect(detectConfusables(FAKE.deepLinkInvalid)).toBeNull();
    expect(detectConfusables("0000O")).toBeNull();
    expect(detectConfusables("")).toBeNull();
  });
});

test.describe("classifyDeepLink", () => {
  test("valid numbers in every spelling the server may receive", () => {
    const rows: ReadonlyArray<readonly [string, string]> = [
      [FAKE.domestic, FAKE.domestic],
      [FAKE_GROUPED.domestic, FAKE.domestic],
      [FAKE_GROUPED.domestic.replaceAll(" ", "-"), FAKE.domestic],
      [toFullWidth(FAKE.domestic), FAKE.domestic],
      [` ${FAKE.domestic} `, FAKE.domestic],
      [FAKE.hbl.toLowerCase(), FAKE.hbl],
      [FAKE.cargo, FAKE.cargo]
    ];
    for (const [segment, number] of rows) {
      expect(classifyDeepLink(segment), segment).toEqual({ kind: "valid", number });
    }
  });

  test("alphanumeric 6–30 characters that are not a number are INVALID", () => {
    expect(classifyDeepLink(FAKE.deepLinkInvalid)).toEqual({ kind: "invalid", input: "ABCDE1" });
    expect(classifyDeepLink(FAKE.deepLinkInvalid.toLowerCase())).toEqual({ kind: "invalid", input: "ABCDE1" });
    expect(classifyDeepLink("0000000000O0")).toEqual({ kind: "invalid", input: "0000000000O0" });
  });

  test("everything else is a real 404", () => {
    for (const segment of ["a.b", "robots.txt", "한글", "ABCDE", "0".repeat(31), "", "0000/1234", "%", "0000_1234_5678"]) {
      expect(classifyDeepLink(segment), segment).toEqual({ kind: "notFound" });
    }
  });
});

test.describe("parseCarrierParam", () => {
  test("accepts the five carrier codes in any case and falls back to AUTO", () => {
    expect(parseCarrierParam("CJ")).toBe("CJ");
    expect(parseCarrierParam(" hanjin ")).toBe("HANJIN");
    expect(parseCarrierParam(["LOTTE", "CJ"])).toBe("LOTTE");
    expect(parseCarrierParam("EPOST")).toBe("EPOST");
    expect(parseCarrierParam("logen")).toBe("LOGEN");
    expect(parseCarrierParam("AUTO")).toBe("AUTO");
    expect(parseCarrierParam("NOPE")).toBe("AUTO");
    expect(parseCarrierParam([])).toBe("AUTO");
    expect(parseCarrierParam(undefined)).toBe("AUTO");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/number-input.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading the file — `Error: Cannot find module '@/lib/tracking/number-input'` (no test runs).

- [ ] **Step 3: Create `lib/tracking/number-input.ts`**

```ts
/**
 * Lookup input rules (spec §3 딥링크 3분기, §4 입력). Pure: no window, no storage, no clock (contract §11.1 rule 5).
 * The server route and the client island use the same functions, so a deep link and a typed number can never disagree.
 */
import { identifyTrackingNumber } from "@/lib/services/identifier";
import { CONCRETE_CARRIER_CODES } from "@/lib/tracking/carriers";
import type { InvalidReason } from "@/lib/tracking/types";
import type { DeliveryCarrierCode } from "@/lib/types";

/** The API's limit for `trackingNumber` (lib/schemas.ts TrackRequestSchema). */
export const MAX_NUMBER_LENGTH = 30;

export type DeepLinkDecision =
  | { readonly kind: "valid"; readonly number: string }
  | { readonly kind: "invalid"; readonly input: string }
  | { readonly kind: "notFound" };

export type ConfusableKind = "letterO" | "letterIl";
export type ConfusableHint = { readonly kind: ConfusableKind; readonly suggestion: string; readonly message: string } | null;

export type PrecheckResult =
  | { readonly ok: true; readonly number: string }
  | { readonly ok: false; readonly reason: InvalidReason; readonly diagnosis: string };

const FULL_WIDTH_ASCII = /[！-～]/g;
const FULL_WIDTH_OFFSET = 0xfee0;
/** Whitespace (incl. U+3000 and NBSP), ASCII hyphen, Unicode hyphens/dashes and the minus sign. */
const SEPARATORS = /[\s\-‐-―−]/g;
const DEEP_LINK_SHAPE = /^[A-Z0-9]{6,30}$/;
const HBL_PREFIX = /^([A-Z]{3,4})(.+)$/;
const HBL_DIGITS = /^[A-Z]{3,4}(\d*)$/;
const CONFUSABLE_MESSAGES: Readonly<Record<ConfusableKind, string>> = {
  letterO: "영문 O가 섞여 있어요. 숫자 0인가요?",
  letterIl: "영문 I나 l이 섞여 있어요. 숫자 1인가요?"
};

/** Trim, remove spaces and hyphens, full-width → half-width, uppercase. */
export function normalizeInput(value: string): string {
  return value
    .replace(FULL_WIDTH_ASCII, (character) => String.fromCharCode(character.charCodeAt(0) - FULL_WIDTH_OFFSET))
    .replace(SEPARATORS, "")
    .toUpperCase();
}

/** A normalized value the API accepts: identifyTrackingNumber knows it and it fits the request limit. */
function isAcceptedNumber(normalized: string): boolean {
  return normalized.length <= MAX_NUMBER_LENGTH && identifyTrackingNumber(normalized).type !== "UNKNOWN";
}

/** `segment` is already URI-decoded by the caller. */
export function classifyDeepLink(segment: string): DeepLinkDecision {
  const normalized = normalizeInput(segment);
  if (isAcceptedNumber(normalized)) return { kind: "valid", number: normalized };
  if (DEEP_LINK_SHAPE.test(normalized)) return { kind: "invalid", input: normalized };
  return { kind: "notFound" };
}

/** `?c=` → a concrete carrier code, anything else → "AUTO". */
export function parseCarrierParam(value: string | readonly string[] | undefined): DeliveryCarrierCode {
  const raw = typeof value === "string" ? value : value?.[0];
  const code = raw?.trim().toUpperCase() ?? "";
  return CONCRETE_CARRIER_CODES.find((carrier) => carrier === code) ?? "AUTO";
}

const toDigits = (part: string): string => part.replace(/O/g, "0").replace(/[IL]/g, "1");

/** Only for values that are not valid yet and become valid when O → 0 and I/L → 1 in the digit part. */
export function detectConfusables(normalized: string): ConfusableHint {
  if (normalized === "" || isAcceptedNumber(normalized)) return null;
  const splits: Array<{ readonly prefix: string; readonly rest: string }> = [];
  const hbl = HBL_PREFIX.exec(normalized);
  if (hbl !== null) splits.push({ prefix: hbl[1] ?? "", rest: hbl[2] ?? "" });
  splits.push({ prefix: "", rest: normalized });
  for (const { prefix, rest } of splits) {
    if (!/[OIL]/.test(rest)) continue;
    const suggestion = `${prefix}${toDigits(rest)}`;
    if (!isAcceptedNumber(suggestion)) continue;
    const kind: ConfusableKind = rest.includes("O") ? "letterO" : "letterIl";
    return { kind, suggestion, message: CONFUSABLE_MESSAGES[kind] };
  }
  return null;
}

const fail = (reason: InvalidReason, diagnosis: string): PrecheckResult => ({ ok: false, reason, diagnosis });

/** Client pre-check before any request (spec §4 "형식은 … 클라이언트에서 먼저 검사"). */
export function precheckNumber(value: string): PrecheckResult {
  const normalized = normalizeInput(value);
  if (normalized === "") return fail("empty", "조회번호를 넣어 주세요");
  if (normalized.length > MAX_NUMBER_LENGTH) {
    return fail("tooLong", `지금 ${normalized.length}자예요. ${MAX_NUMBER_LENGTH}자까지 넣을 수 있어요`);
  }
  if (isAcceptedNumber(normalized)) return { ok: true, number: normalized };
  const confusable = detectConfusables(normalized);
  if (confusable !== null) return fail("confusableLetter", `입력하신 값: ${value.trim()} → ${confusable.message}`);
  if (/^\d+$/.test(normalized)) return fail("tooShort", `지금 ${normalized.length}자리예요`);
  const hblDigits = HBL_DIGITS.exec(normalized);
  if (hblDigits !== null) {
    const digits = (hblDigits[1] ?? "").length;
    return digits < 8
      ? fail("tooShort", `영문 뒤 숫자가 지금 ${digits}자리예요`)
      : fail("badFormat", `영문 뒤 숫자가 지금 ${digits}자리예요. 8~16자리여야 해요`);
  }
  if (/[^A-Z0-9]/.test(normalized)) return fail("badFormat", "숫자와 영문만 넣을 수 있어요");
  return fail("badFormat", "영문은 번호 앞에 3~4자만 올 수 있어요");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/number-input.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `9 passed`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/module-boundaries.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all pass (the new module is pure: no `window`, no clock, no zod).
Run: `npm run typecheck; npx eslint lib/tracking/number-input.ts tests/unit/number-input.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 5: Commit**

Run: `git add lib/tracking/number-input.ts tests/unit/number-input.spec.ts; git commit -m "feat: add lookup input rules for normalization, pre-check and deep links"`

---

### Task 2: Paste extraction and the paste notice

**Files:**
- Modify: `lib/tracking/number-input.ts` (append after `precheckNumber`; extend the carriers import)
- Test: `tests/unit/number-input.spec.ts` (extend the import, append two `describe` blocks)

**Interfaces:**
- Consumes: Task 1 (`normalizeInput`, the private `isAcceptedNumber`, `FULL_WIDTH_ASCII`, `FULL_WIDTH_OFFSET`), `ConcreteCarrierCode`.
- Produces (contract §11.8 + Addition 1): `interface PasteExtraction { readonly number: string; readonly carrier: ConcreteCarrierCode | null }`, `extractFromPastedText(text: string): PasteExtraction | null` (null unless exactly one valid candidate), `pasteCarrierNotice(carrierName: string): string`. Task 6 calls both from the input's paste handler.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/number-input.spec.ts` replace the import block

```ts
import {
  classifyDeepLink,
  detectConfusables,
  MAX_NUMBER_LENGTH,
  normalizeInput,
  parseCarrierParam,
  precheckNumber
} from "@/lib/tracking/number-input";
```

with

```ts
import {
  classifyDeepLink,
  detectConfusables,
  extractFromPastedText,
  MAX_NUMBER_LENGTH,
  normalizeInput,
  parseCarrierParam,
  pasteCarrierNotice,
  precheckNumber
} from "@/lib/tracking/number-input";
```

and append at the end of the file:

```ts
const WAYBILL_HYPHENS = FAKE_GROUPED.domestic.replaceAll(" ", "-");
/** An order number shaped like Naver's 16-digit ones; fixture-safe (starts with 0000). */
const ORDER_NUMBER = `0000${"0".repeat(11)}1`;

test.describe("extractFromPastedText (roadmap Review Focus 1)", () => {
  test("a notification with one number gives the number and the carrier it names", () => {
    const text = [
      "[CJ대한통운] 고객님의 상품이 발송되었습니다.",
      `운송장번호 ${WAYBILL_HYPHENS}`,
      `배송 문의 ${FAKE.phone} · 발송일 2026.09.26 14:05`
    ].join("\n");
    expect(extractFromPastedText(text)).toEqual({ number: FAKE.domestic, carrier: "CJ" });
  });

  test("an order number next to the waybill means two candidates and no pick", () => {
    const text = `주문번호 ${ORDER_NUMBER}\n[CJ대한통운] 운송장번호 ${WAYBILL_HYPHENS}\n문의 ${FAKE.phone}`;
    expect(extractFromPastedText(text)).toBeNull();
  });

  test("grouped digits and a spaced HBL are read as one number each", () => {
    expect(extractFromPastedText(`한진택배 송장 ${FAKE_GROUPED.hbl} 입니다`)).toEqual({ number: FAKE.hbl, carrier: "HANJIN" });
    expect(extractFromPastedText(`운송장 ${FAKE_GROUPED.domestic}`)).toEqual({ number: FAKE.domestic, carrier: null });
    expect(extractFromPastedText(`CJ ${FAKE_GROUPED.domestic}`)).toEqual({ number: FAKE.domestic, carrier: null });
  });

  test("a mobile number, dates and times are never tracking numbers", () => {
    expect(extractFromPastedText(`연락처 ${FAKE.phone} 2026-09-26 14:05 2026.09.26`)).toBeNull();
    expect(extractFromPastedText(`연락처 ${FAKE.phone.replaceAll("-", " ")}`)).toBeNull();
    expect(extractFromPastedText(`연락처 ${FAKE.phone.replaceAll("-", "")}`)).toBeNull();
  });

  test("the same number twice counts once; two carriers named means no carrier", () => {
    expect(extractFromPastedText(`${FAKE.domestic} (${FAKE_GROUPED.domestic})`)).toEqual({ number: FAKE.domestic, carrier: null });
    expect(extractFromPastedText(`CJ대한통운 또는 한진택배 ${WAYBILL_HYPHENS}`)).toEqual({ number: FAKE.domestic, carrier: null });
  });

  test("full-width digits and a lowercase HBL are normalized", () => {
    expect(extractFromPastedText(`우체국택배 ${toFullWidth(WAYBILL_HYPHENS)}`)).toEqual({ number: FAKE.domestic, carrier: "EPOST" });
    expect(extractFromPastedText(`로젠택배 hbl ${FAKE.hbl.toLowerCase()}`)).toEqual({ number: FAKE.hbl, carrier: "LOGEN" });
  });

  test("text without a number gives null", () => {
    expect(extractFromPastedText("")).toBeNull();
    expect(extractFromPastedText("배송 안내입니다. 롯데택배로 보냈어요.")).toBeNull();
  });
});

test.describe("pasteCarrierNotice", () => {
  test("uses 으로 after a final consonant and 로 otherwise", () => {
    expect(pasteCarrierNotice("CJ대한통운")).toBe("택배사를 CJ대한통운으로 맞췄어요");
    for (const name of ["우체국택배", "한진택배", "롯데택배", "로젠택배"]) {
      expect(pasteCarrierNotice(name), name).toBe(`택배사를 ${name}로 맞췄어요`);
    }
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/number-input.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `8 failed, 9 passed`: the eight new tests fail with `TypeError: … extractFromPastedText is not a function` / `… pasteCarrierNotice is not a function` (Playwright's transform turns the missing named exports into `undefined`); the nine Task 1 tests still pass. (`npm run typecheck` would also report `Module '"@/lib/tracking/number-input"' has no exported member 'extractFromPastedText'`.)

- [ ] **Step 3: Implement extraction and the notice**

In `lib/tracking/number-input.ts` replace

```ts
import type { InvalidReason } from "@/lib/tracking/types";
```

with

```ts
import type { ConcreteCarrierCode, InvalidReason } from "@/lib/tracking/types";
```

and append at the end of the file:

```ts
export interface PasteExtraction {
  readonly number: string;
  readonly carrier: ConcreteCarrierCode | null;
}

/** Letter/digit runs, optionally joined by single hyphens ('0000-1234-5678', '010-0000-1234'). */
const TOKEN = /[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/g;
const DIGIT_GROUP = /^\d{1,4}$/;
const LETTER_PREFIX = /^[A-Za-z]{3,4}$/;
/** '010-0000-1234', '02-000-0000' and the like, as written in notifications. */
const PHONE_FORMAT = /^0\d{1,2}[ -]\d{3,4}[ -]\d{4}$/;
/** Korean mobile numbers after normalization (10–11 digits, 010/011/016/017/018/019). */
const MOBILE_NUMBER = /^01[016789]\d{7,8}$/;
const CARRIER_MENTIONS: ReadonlyArray<readonly [ConcreteCarrierCode, RegExp]> = [
  ["CJ", /CJ\s*대한통운|대한통운|CJ\s*택배/i],
  ["EPOST", /우체국/],
  ["HANJIN", /한진/],
  ["LOTTE", /롯데/],
  ["LOGEN", /로젠/]
];

interface Token {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

/** Every token alone, plus runs of short groups written with single spaces ('0000 1234 5678', 'TEST 0000 0001'). */
function candidateStrings(text: string): string[] {
  const tokens: Token[] = Array.from(text.matchAll(TOKEN), (match) => ({
    text: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length
  }));
  const candidates = tokens.map((token) => token.text);
  let group: Token[] = [];
  const flush = (): void => {
    if (group.length >= 2 && group.some((token) => DIGIT_GROUP.test(token.text))) {
      candidates.push(group.map((token) => token.text).join(" "));
    }
    group = [];
  };
  for (const token of tokens) {
    const previous = group[group.length - 1];
    const adjacent = previous !== undefined && /^\s$/.test(text.slice(previous.end, token.start));
    if (DIGIT_GROUP.test(token.text)) {
      if (!adjacent) flush();
      group.push(token);
      continue;
    }
    flush();
    if (LETTER_PREFIX.test(token.text)) group.push(token);
  }
  flush();
  return candidates;
}

function carrierMentionedIn(text: string): ConcreteCarrierCode | null {
  const mentioned = CARRIER_MENTIONS.filter(([, pattern]) => pattern.test(text)).map(([code]) => code);
  return mentioned.length === 1 ? (mentioned[0] ?? null) : null;
}

/**
 * A pasted notification (spec §4): the one tracking number in it and the carrier it names.
 * Null unless exactly one distinct valid candidate exists — a second candidate (an order number, another waybill)
 * means the customer must choose, so nothing is picked (roadmap Review Focus 1).
 */
export function extractFromPastedText(text: string): PasteExtraction | null {
  const cleaned = text
    .replace(FULL_WIDTH_ASCII, (character) => String.fromCharCode(character.charCodeAt(0) - FULL_WIDTH_OFFSET))
    .replace(/[‐-―−]/g, "-");
  const numbers = new Set<string>();
  for (const raw of candidateStrings(cleaned)) {
    if (PHONE_FORMAT.test(raw)) continue;
    const number = normalizeInput(raw);
    if (MOBILE_NUMBER.test(number)) continue;
    if (isAcceptedNumber(number)) numbers.add(number);
  }
  if (numbers.size !== 1) return null;
  const [number] = [...numbers];
  if (number === undefined) return null;
  return { number, carrier: carrierMentionedIn(cleaned) };
}

/** '으로' after a final consonant other than ㄹ, '로' otherwise (and after non-Hangul). */
function directionalParticle(word: string): "으로" | "로" {
  const code = word.charCodeAt(word.length - 1);
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return "로";
  const finalConsonant = (code - 0xac00) % 28;
  return finalConsonant === 0 || finalConsonant === 8 ? "로" : "으로";
}

/** '택배사를 CJ대한통운으로 맞췄어요' (spec §4 paste notice). */
export function pasteCarrierNotice(carrierName: string): string {
  return `택배사를 ${carrierName}${directionalParticle(carrierName)} 맞췄어요`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/number-input.spec.ts tests/unit/module-boundaries.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `number-input.spec.ts` `17 passed`; module boundaries all pass.
Run: `npm run typecheck; npx eslint lib/tracking/number-input.ts tests/unit/number-input.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.
Run the repository guard (the new test strings carry digits): `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all pass.

- [ ] **Step 5: Commit**

Run: `git add lib/tracking/number-input.ts tests/unit/number-input.spec.ts; git commit -m "feat: extract the tracking number and carrier from pasted notifications"`

---

### Task 3: Rule → assertion map of the home E2E (approval 2 migration, first step)

**Files:**
- Create: `tests/e2e/RULE-MAP.md`
- Test: the title check in Step 2 (PowerShell)

**Interfaces:**
- Consumes: the test titles of `tests/tracking.spec.ts` as they are after S01–S05.
- Produces: `tests/e2e/RULE-MAP.md` — one row per legacy test with its business rule, the new assertion that carries it (file → test title) and a status. Tasks 5, 7/7F and 9 update the status column; S07 adds its result rows (File Map: "C S06, M S07").

- [ ] **Step 1: Write the map**

Create `tests/e2e/RULE-MAP.md`:

```markdown
# E2E rule → assertion map

Spec §14 test contract item 1 and approval 2: every business rule the old copy-bound E2E tests protected is carried by a new structural assertion (roles, `data-*` hooks, config values) **before** the old test is removed. This file is the ledger of that migration. Titles are exact test titles.

Status values: `pending (Task N)` — the new assertion is planned in that task; `migrated (Task N)` — the new assertion passed and the old test was removed in that task; `retired (approval 2)` — a decoration the spec deletes (§4 "삭제하는 것"), asserted as absent; `kept → S07` / `kept → S08` — still asserted by the old test until that stage migrates it.

## H — home and lookup area (S06)

| Id | Legacy test (`tests/tracking.spec.ts`) | Business rule | New assertion (file → test) | Status |
|---|---|---|---|---|
| H1 | "home uses customer language without brand, robot, or AI copy" | 고객 언어(브랜드·로봇·AI 문구 금지); `google-anno-skip` on `<body>`; home h1 '통관부터 국내 배송까지 한 번에 확인'; the input and [조회하기] are visible | `tests/e2e/home.spec.ts` → "home copy speaks customer language: no AI, robot or brand slogans"; "one h1 and the lookup form come first; the hero decorations are gone" | pending (Task 5) |
| H1r | same test: the '구매 고객을 위한 배송조회' badge, LogisticsFlow, the AssuranceRail region, the input shake and the pointer/submit cues | decorations the spec deletes (§4) | `tests/e2e/home.spec.ts` → "one h1 and the lookup form come first; the hero decorations are gone" (hooks counted as 0) | retired (approval 2) |
| F1 | "the lookup form shows the format hint instead of example numbers" (added by S01) | real numbers nowhere; the non-clickable format hint describes the input | `tests/e2e/lookup-input.spec.ts` → "the format hint replaces example numbers and describes the input" | pending (Task 5) |
| C1 | "user can choose a representative domestic carrier before tracking" | the chosen carrier travels with the request; the skip link is off-screen until focused; the result links the carrier's official page | `tests/e2e/lookup-input.spec.ts` → "the carrier choice lists the five carriers and travels with the request"; `tests/e2e/home.spec.ts` → "the skip link stays off-screen until it is focused"; result part → S07 | kept → S07 (S06 adds the lookup assertions; S07 removes the test) |
| M1 | "semantic motion is finite and honors reduced-motion" | finite motion; reduced motion respected | `tests/e2e/home.spec.ts` → "no infinite animation runs, and reduced motion stops every animation"; `tests/budgets/motion-budget.spec.ts` → "no infinite animation 8 s after load: home, a loading deep link and a settled result", "reduced motion: nothing animates on home and on a settled result" | pending (Task 5; budget Task 9) |
| L1 | "tablet layout keeps motion inside the viewport" | no horizontal scroll | `tests/e2e/home.spec.ts` → "no horizontal scroll at 320, 768 and 1280 px" | pending (Task 5) |
| L2 | "desktop layout keeps motion inside the viewport" | no horizontal scroll | same as L1 | pending (Task 5) |
| P1 | "mobile first view exposes consultation and store shortcuts" | 모바일 첫 화면에 상담·스토어 바로가기 | approval 1: `tests/e2e/home.spec.ts` → "the row is in the first view at 390×844, 375×812 and 360×780 and nothing covers the lookup button or the row"; fallback: "the collapsed 상담·스토어 button is in the first view and never covers the lookup panel", "opening it shows 톡톡, 네이버 and 쿠팡 shortcuts" | pending (Task 7 or 7F) |
| S1 | "home offers transparent storefront choices without interrupting tracking" | store choices come with the disclosure; nothing interrupts the lookup | approval 1: `tests/e2e/home.spec.ts` → "the definitive disclosure comes before the coupang link, and only affiliate links are sponsored" + the trial clicks of P1's test; fallback: P1's fallback tests. The legacy showcase assertions stay until S08 replaces the showcase | popup step pending (Task 7 or 7F); showcase part kept → S08 |
| O1 | "an overdue customs estimate is recalculated and remains readable on mobile" — its popup-closing step only | none (the step existed because the popup covered the form) | — | step pending removal (Task 7 or 7F); the test itself kept → S07 |

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

S02's (`url-privacy`, `session-restore`, `return-link`, `legacy-query-redirect`) and S04's (`status-slot`, `loading-timeline`, `failure-causes`, `cta-consistency`) E2E files select stage-independent hooks and are not changed by S06.

## N — new S06 assertions without a legacy counterpart

- `tests/e2e/deep-link.spec.ts`: server shell without JavaScript, three-way split, path variants, `?c=`, `noindex`, focus/live/title rules after a deep-link lookup, 320 px cargo number, production cache headers.
- `tests/e2e/lookup-input.spec.ts`: input attributes, normalization, pre-check with diagnosis, confusable question, paste extraction and [되돌리기], busy form, no-JavaScript paths.
- `tests/e2e/home.spec.ts`: header, skip link, one live region, one filled button, mode changes on `/`, shortcut row geometry (approval 1), typical durations, notice re-filter, token colors.
- `tests/budgets/{html-budget,motion-budget,lcp-budget}.spec.ts`.
```

- [ ] **Step 2: Check that every legacy test title is in the map**

Run (PowerShell):
```powershell
$titles = Select-String -LiteralPath tests/tracking.spec.ts -Pattern '^\s*test\("([^"]+)"' | ForEach-Object { $_.Matches[0].Groups[1].Value }
$map = Get-Content -LiteralPath tests/e2e/RULE-MAP.md -Raw -Encoding UTF8
$titles | Where-Object { -not $map.Contains($_) }
```
Expected: no output. If titles are printed (S04 renamed or added result tests), add one row per printed title to section R with its rule and `kept → S07`, then run the check again. (The two viewport tests use a template-literal title and are not matched by the pattern; they are rows L1 and L2.)

- [ ] **Step 3: Commit**

Run: `git add tests/e2e/RULE-MAP.md; git commit -m "docs: map the home E2E rules to their new assertions"`

---

### Task 4: New header, public layout chrome and the one live region

**Files:**
- Create: `components/shell/SiteHeader.tsx`
- Modify: `app/(public)/layout.tsx` (whole file)
- Modify: `components/HomePageClient.tsx` (remove the legacy header, footer and live-region provider it renders)
- Delete: `components/SiteHeader.tsx`
- Modify: `app/globals.css` (append `.tt-legacy-dark`)
- Test: `tests/e2e/home.spec.ts` (create)

**Interfaces:**
- Consumes: `TalkLink` (S05; `placement="header"` shows no icon), `channels` (`config/site.config.ts`), `LiveAnnouncerProvider` (S04), `AdLoader` (S02), legacy `SiteFooter` (`components/SiteFooter.tsx`, deleted by S08).
- Produces: `SiteHeader(): React.JSX.Element` (contract §11.9) — skip link '본문으로 건너뛰기' (`href="#main-content"`, off-screen until focused), `<header>` 48 px with `<Link href="/">통관·배송 조회</Link>` and `TalkLink` '문의' (accessible name '문의 새 창으로 열기'); `app/(public)/layout.tsx` = `LiveAnnouncerProvider` › header, page, legacy footer on a `.tt-legacy-dark` band, `AdLoader`; the `.tt-legacy-dark` class (Addition 4).

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/home.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { channels } from "@/config/site.config";
import { FAKE, mockTrack, trackData } from "../fixtures/tracking-fixtures";

test.describe("site header (S06)", () => {
  test("a 48 px header shows the site name on the left and 문의 on the right, and nothing else", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(header).toHaveCount(1);
    expect((await header.boundingBox())?.height).toBe(48);
    await expect(header.getByRole("link")).toHaveCount(2);
    const home = header.getByRole("link", { name: "통관·배송 조회", exact: true });
    const talk = header.getByRole("link", { name: "문의 새 창으로 열기", exact: true });
    await expect(home).toHaveAttribute("href", "/");
    await expect(talk).toHaveAttribute("href", channels.talk.url);
    await expect(talk).toHaveAttribute("target", "_blank");
    await expect(talk).toHaveAttribute("rel", "noopener noreferrer");
    await expect(talk).toHaveAttribute("data-link-placement", "header");
    expect((await home.boundingBox())?.x ?? 0).toBeLessThan((await talk.boundingBox())?.x ?? 0);
  });

  test("the same header sits on the home, a deep link and the privacy page", async ({ page }) => {
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }));
    for (const path of ["/", `/${FAKE.domestic}`, "/privacy"]) {
      await page.goto(path);
      const header = page.getByRole("banner");
      await expect(header.getByRole("link", { name: "통관·배송 조회", exact: true }), path).toBeVisible();
      await expect(header.getByRole("link", { name: "문의 새 창으로 열기", exact: true }), path).toBeVisible();
    }
  });

  test("the skip link stays off-screen until it is focused", async ({ page }) => {
    await page.goto("/");
    const skip = page.getByRole("link", { name: "본문으로 건너뛰기", exact: true });
    await expect(skip).toHaveAttribute("href", "#main-content");
    expect((await skip.boundingBox())?.y ?? 0).toBeLessThan(0);
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    expect((await skip.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0);
  });

  test("every public page has exactly one polite live region", async ({ page }) => {
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }));
    for (const path of ["/", `/${FAKE.domestic}`, "/privacy"]) {
      await page.goto(path);
      await expect(page.locator('[data-live-region="polite"]'), path).toHaveCount(1);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/home.spec.ts`
Expected: FAIL — `3 failed, 1 passed`: the header test fails at the height check (`Expected: 48`, received the legacy header's taller height); the same-header test fails on `/` (the legacy logo link is named '통관 배송 조회로 이동', so no link is named exactly '통관·배송 조회'); the live-region test fails on `/privacy` with `Received: 0` (S04 mounts the provider inside `HomePageClient` only). The skip-link test passes already — the legacy skip link behaves the same way — and keeps guarding the new one.

- [ ] **Step 3: Create `components/shell/SiteHeader.tsx`**

```tsx
import Link from "next/link";
import { channels } from "@/config/site.config";
import { TalkLink } from "@/components/primitives/TalkLink";

const SITE_NAME = "통관·배송 조회";
const SKIP_LINK_LABEL = "본문으로 건너뛰기";

/**
 * Public header (spec §4, §7 idle; WCAG 3.2.6): 48 px, the site name on the left and the text link '문의' (톡톡, new tab)
 * on the right — the same place on every public page. No store links (spec §4 "헤더 스토어 링크" 삭제).
 * The skip link is the first focusable element and stays off-screen until it receives focus.
 */
export function SiteHeader(): React.JSX.Element {
  return (
    <>
      <a
        href="#main-content"
        className="tt-focus absolute left-2 top-2 z-50 -translate-y-24 bg-tt-primary px-4 py-3 text-tt-sm font-bold text-tt-on-primary no-underline focus:translate-y-0"
      >
        {SKIP_LINK_LABEL}
      </a>
      <header className="h-[var(--tt-header-h)] border-b border-tt-rule bg-tt-surface text-tt-ink">
        <div className="mx-auto flex h-full w-full max-w-[var(--tt-column)] items-center justify-between gap-3 px-[var(--tt-gutter)]">
          <Link
            href="/"
            className="tt-focus inline-flex min-h-[44px] items-center text-tt-md font-black tracking-[-0.01em] text-tt-ink no-underline [word-break:keep-all]"
          >
            {SITE_NAME}
          </Link>
          <TalkLink href={channels.talk.url} label={channels.talk.labels.header} weight="text" placement="header" />
        </div>
      </header>
    </>
  );
}
```

- [ ] **Step 4: Replace `app/(public)/layout.tsx`**

The S02 file renders `{children}` and `<AdLoader />`. Replace the whole file with:

```tsx
import { AdLoader } from "@/components/ads/AdLoader";
import { LiveAnnouncerProvider } from "@/components/primitives/LiveAnnouncer";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

/**
 * Public pages: /, /{번호}, /privacy (spec §14 "app/(public)/layout.tsx: 헤더, 푸터, live region·AdLoader 자리").
 * The one polite live region exists here before any announcement (spec §5). The legacy footer sits on a dark band
 * until S08 replaces it with components/shell/SiteFooter.tsx. The AdSense loader stays last and fail-closed (S02).
 */
export default function PublicLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <LiveAnnouncerProvider>
      <SiteHeader />
      {children}
      <div className="tt-legacy-dark">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <SiteFooter />
        </div>
      </div>
      <AdLoader />
    </LiveAnnouncerProvider>
  );
}
```

If S02 or a later stage added other elements or a `metadata` export to this file, keep them in the same order around the new elements and note it in the stage summary.

- [ ] **Step 5: Strip the header, footer and provider out of `HomePageClient`**

In `components/HomePageClient.tsx` (S04's version):
1. Delete the line `import { SiteHeader } from "@/components/SiteHeader";` and the element `<SiteHeader showStorefront={showStorefront} />`.
2. Delete the line `import { SiteFooter } from "@/components/SiteFooter";` and the element `<SiteFooter />`.
3. Delete the `LiveAnnouncerProvider` import and its opening and closing tags; keep everything between them.
4. If `showStorefront` is now unused (TypeScript or eslint reports it), delete its `const showStorefront = …;` line.

Check: `Select-String -LiteralPath components/HomePageClient.tsx -Pattern "SiteHeader|SiteFooter|LiveAnnouncerProvider"` → no output.
Delete the legacy header: `git rm components/SiteHeader.tsx`
Check: `git grep -n "components/SiteHeader" -- app components` → no output.

- [ ] **Step 6: Add the transitional dark band to `app/globals.css`**

Append at the end of `app/globals.css`:

```css

/*
 * 과도기 띠(S06 → S07·S08): 옛 어두운 부품(옛 푸터, 옛 결과 상세와 S04 상태 슬롯, 옛 스토어 쇼케이스,
 * 개인정보처리방침 본문)을 토큰 바탕 위에서도 읽을 수 있게 감쌉니다. S07·S08이 마지막 사용처를 지우면서 함께 지웁니다.
 */
.tt-legacy-dark {
  color-scheme: dark;
  background: linear-gradient(180deg, #050b17 0%, #07111f 100%);
  color: hsl(210, 40%, 98%);
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/home.spec.ts`
Expected: `4 passed`.
Run the suites that touch the header, the footer or the live region: `npx playwright test tests/tracking.spec.ts tests/privacy.spec.ts tests/e2e/url-privacy.spec.ts tests/e2e/session-restore.spec.ts tests/e2e/status-slot.spec.ts tests/e2e/loading-timeline.spec.ts tests/e2e/internal-isolation.spec.ts`
Expected: 0 failed (same pass counts as the Task 0 baseline for these files).
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 8: Commit**

Run: `git add components/shell/SiteHeader.tsx "app/(public)/layout.tsx" components/HomePageClient.tsx app/globals.css tests/e2e/home.spec.ts; git add -u components/SiteHeader.tsx; git commit -m "feat: add the 48px public header and move the live region into the public layout"`

---

### Task 5: Server shell, lookup island and the deep-link three-way split

**Files:**
- Create: `components/lookup/lookup-display.ts`, `components/lookup/session.ts`, `components/lookup/FormatHint.tsx`, `components/lookup/NumberFinderHelp.tsx`, `components/lookup/FailureFallback.tsx`, `components/lookup/PendingCard.tsx`, `components/lookup/LookupForm.tsx`, `components/lookup/LegacyResultSection.tsx`, `components/lookup/LookupController.tsx`, `components/shell/TrackingPage.tsx`
- Modify: `app/(public)/page.tsx` (whole file), `app/(public)/[trackingNumber]/page.tsx` (whole file)
- Delete: `components/HomePageClient.tsx`, `components/TrackingForm.tsx`, `components/LogisticsFlow.tsx`, `components/AssuranceRail.tsx`, `components/ServiceGuide.tsx`
- Modify: `tests/tracking.spec.ts` (remove the four migrated home tests and S01's format-hint test), `tests/e2e/RULE-MAP.md` (status column), `tests/e2e/home.spec.ts` (append)
- Test: `tests/unit/lookup-display.spec.ts` (create), `tests/e2e/deep-link.spec.ts` (create), `tests/e2e/lookup-input.spec.ts` (create)

**Interfaces:**
- Consumes: Task 1 (`classifyDeepLink`, `parseCarrierParam`, `precheckNumber`); Task 4 (`SiteHeader`, the layout's `LiveAnnouncerProvider`, `.tt-legacy-dark`); S04 `useLookup`, `StatusSlot`/`StatusSlotProps`, `useAnnounce`, `LookupState`, `INITIAL_LOOKUP_STATE`; S03 `deriveLoadingView`, `deriveTrackingView` (dynamic import only), `groupTrackingNumber`, `requestCarrierView`, `CARRIER_NAMES`, `CONCRETE_CARRIER_CODES`, config named exports `lookup`, `notices`, `stateGuide`, `channels`, `siteConfig` (dynamic import only); S02 `scrubNumberFromUrl`, `SCRUB_TIMEOUT_MS`, `readRestoreEntry`, `saveRestoreEntry`, `currentNavigationKind`, `RestoreEntry`, `setAdSignals`, `waitForIdle` (test support); S05 `Button`, `NumberBar`, `TalkLink`, `ToneIcon`.
- Produces: `TrackingPage(props: { readonly entry: TrackingEntry }): React.JSX.Element` and `LookupController(props: LookupControllerProps): React.JSX.Element` with `LookupControllerProps` exactly as contract §11.9; hooks `data-view-state` (idle/loading/settled/error) on the lookup section, `data-lookup-form="true"`, `data-guide-key="invalidNumber"` on the input error block, `data-cta-state="error"` on `FailureFallback`, `data-ad-exclude="true"` on the lookup section; the INVALID form screen; the deep-link shell (number bar + '조회하고 있어요'); Additions 2, 5, 6, 7, 9. Later tasks extend `LookupForm` (Task 6), `LookupController` (Tasks 6, 7/7F, 8), `lookup-display.ts` and `session.ts` (Task 8), `TrackingPage` (Task 8).

- [ ] **Step 1: Write the failing display-table test**

Create `tests/unit/lookup-display.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { lookup, notices } from "@/config/site.config";
import {
  computeDisplay,
  outcomeKey,
  viewModeOf,
  type DerivedView,
  type DisplayInput
} from "@/components/lookup/lookup-display";
import type { LoadingConfig } from "@/lib/config/types";
import { deriveLoadingView } from "@/lib/tracking/loading-view";
import { INITIAL_LOOKUP_STATE, type LookupState } from "@/lib/tracking/lookup-state";
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
const BASE: DisplayInput = { state: INITIAL_LOOKUP_STATE, loading: null, entry: HOME, formOpen: true, localInvalid: null, derived: null };

test("idle: the home shows the form, an unopened deep link shows the pending card", () => {
  expect(computeDisplay(BASE)).toEqual({ kind: "form", busy: false, invalid: null });
  expect(computeDisplay({ ...BASE, entry: DEEP, formOpen: false })).toEqual({ kind: "pending", request: DEEP_REQUEST });
  expect(computeDisplay({ ...BASE, entry: DEEP, formOpen: true })).toEqual({ kind: "form", busy: false, invalid: null });
});

test("a manual lookup keeps the busy form for the first 0.4 s, then the status slot takes over", () => {
  const state = loadingState(MANUAL);
  expect(computeDisplay({ ...BASE, state, loading: loadingAt(MANUAL, 0) })).toEqual({ kind: "form", busy: true, invalid: null });
  expect(computeDisplay({ ...BASE, state, loading: loadingAt(MANUAL, 500) })).toEqual({ kind: "slot", request: MANUAL, derived: null });
  expect(computeDisplay({ ...BASE, state, loading: loadingAt(MANUAL, 9000) })).toEqual({ kind: "slot", request: MANUAL, derived: null });
});

test("deep links, restores, retries and carrier chips show the pending card instead of the busy form", () => {
  for (const entry of ["deepLink", "restore", "retry", "carrierChip", "autoRetryOnline"] as const) {
    const request: LookupRequest = { ...MANUAL, entry };
    expect(
      computeDisplay({ ...BASE, entry: DEEP, formOpen: false, state: loadingState(request), loading: loadingAt(request, 0) }),
      entry
    ).toEqual({ kind: "pending", request });
  }
});

test("a settled or failed lookup shows its result only once its own view is derived", () => {
  const settled: LookupState = { phase: "settled", outcome: SUCCESS, settledAt: 2 };
  const own: DerivedView = { key: outcomeKey(SUCCESS), seq: 1, view: null };
  const stale: DerivedView = { key: outcomeKey({ ...SUCCESS, request: { ...MANUAL, number: FAKE.domesticAlt } }), seq: 1, view: null };
  expect(computeDisplay({ ...BASE, state: settled, derived: own })).toEqual({ kind: "slot", request: MANUAL, derived: own });
  expect(computeDisplay({ ...BASE, state: settled, derived: stale })).toEqual({ kind: "pending", request: MANUAL });
  expect(computeDisplay({ ...BASE, state: settled })).toEqual({ kind: "pending", request: MANUAL });
  const failed = failure("notFound");
  const error: LookupState = { phase: "error", outcome: failed, settledAt: 3 };
  const ownFailure: DerivedView = { key: outcomeKey(failed), seq: 2, view: null };
  expect(outcomeKey(failed)).not.toBe(outcomeKey(failure("serverError")));
  expect(computeDisplay({ ...BASE, state: error, derived: ownFailure })).toEqual({ kind: "slot", request: MANUAL, derived: ownFailure });
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
  expect(viewModeOf({ kind: "pending", request: DEEP_REQUEST }, "idle")).toBe("loading");
  expect(viewModeOf({ kind: "pending", request: MANUAL }, "settled")).toBe("loading");
  expect(viewModeOf({ kind: "slot", request: MANUAL, derived: null }, "loading")).toBe("loading");
  expect(viewModeOf({ kind: "slot", request: MANUAL, derived: null }, "settled")).toBe("settled");
  expect(viewModeOf({ kind: "slot", request: MANUAL, derived: null }, "error")).toBe("error");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/lookup-display.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading — `Error: Cannot find module '@/components/lookup/lookup-display'`.

- [ ] **Step 3: Create `components/lookup/lookup-display.ts`**

```ts
/**
 * What the lookup island shows (spec §3 "화면 모드는 컴포넌트 상태", §5 시간축). Pure: the island passes its state in and
 * renders the display it gets back. Modes never live in the URL (GAP1-10).
 */
import type { LookupState } from "@/lib/tracking/lookup-state";
import type {
  LoadingViewModel,
  LookupOutcome,
  LookupRequest,
  TrackingEntry,
  TrackingViewModel,
  ViewMode
} from "@/lib/tracking/types";

/** The error under the input: from the client pre-check, or a server INVALID answer (diagnosis null). */
export interface InvalidInput {
  readonly diagnosis: string | null;
  /** Grows with every failed attempt so the role=alert sentence is announced again. */
  readonly attempt: number;
}

/** The view model derived for one settled outcome; `view` is null when the result code could not be loaded. */
export interface DerivedView {
  readonly key: string;
  readonly seq: number;
  readonly view: TrackingViewModel | null;
}

export type LookupDisplay =
  | { readonly kind: "form"; readonly busy: boolean; readonly invalid: InvalidInput | null }
  | { readonly kind: "pending"; readonly request: LookupRequest }
  | { readonly kind: "slot"; readonly request: LookupRequest; readonly derived: DerivedView | null };

export interface DisplayInput {
  readonly state: LookupState;
  readonly loading: LoadingViewModel | null;
  readonly entry: TrackingEntry;
  /** False only for a deep link whose form the customer has not opened. */
  readonly formOpen: boolean;
  readonly localInvalid: InvalidInput | null;
  readonly derived: DerivedView | null;
}

/** Identifies one settled outcome: result kind, request and failure cause. */
export function outcomeKey(outcome: LookupOutcome): string {
  const { number, carrier, entry } = outcome.request;
  const cause = outcome.kind === "failure" ? outcome.cause : "";
  return [outcome.kind, number, carrier, entry, cause].join("|");
}

function settledDisplay(outcome: LookupOutcome, derived: DerivedView | null): LookupDisplay {
  if (derived === null || derived.key !== outcomeKey(outcome)) return { kind: "pending", request: outcome.request };
  return { kind: "slot", request: outcome.request, derived };
}

/**
 * form    — idle, the INVALID screen, and a manual lookup's first 0.4 s (only the button label changes, spec §5);
 * pending — the static '조회하고 있어요' card: a deep link before its lookup starts, any non-manual lookup's first 0.4 s,
 *           and a settled lookup whose view is still being derived;
 * slot    — S04's status slot (loading from 0.4 s, errors, results).
 */
export function computeDisplay(input: DisplayInput): LookupDisplay {
  const { state, loading, entry, formOpen, localInvalid, derived } = input;
  if (localInvalid !== null) return { kind: "form", busy: false, invalid: localInvalid };
  switch (state.phase) {
    case "idle":
      if (!formOpen && entry.kind === "deepLink") {
        return { kind: "pending", request: { number: entry.number, carrier: entry.carrier, entry: "deepLink" } };
      }
      return { kind: "form", busy: false, invalid: null };
    case "loading":
      if ((loading?.stage ?? "instant") !== "instant") return { kind: "slot", request: state.request, derived: null };
      return state.request.entry === "manual"
        ? { kind: "form", busy: true, invalid: null }
        : { kind: "pending", request: state.request };
    case "error":
      if (state.outcome.cause === "invalidNumber") return { kind: "form", busy: false, invalid: { diagnosis: null, attempt: 0 } };
      return settledDisplay(state.outcome, derived);
    case "settled":
      return settledDisplay(state.outcome, derived);
  }
}

export function viewModeOf(display: LookupDisplay, phase: LookupState["phase"]): ViewMode {
  if (display.kind === "form") {
    if (display.invalid !== null) return "error";
    return display.busy ? "loading" : "idle";
  }
  if (display.kind === "pending") return "loading";
  if (phase === "settled") return "settled";
  return phase === "error" ? "error" : "loading";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/lookup-display.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `6 passed`.

- [ ] **Step 5: Write the failing E2E tests**

Create `tests/e2e/deep-link.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";
import { channels, lookup, stateGuide } from "@/config/site.config";
import type { TrackResponseData } from "@/lib/types";
import { FAKE, FAKE_GROUPED, mockTrack, trackData } from "../fixtures/tracking-fixtures";
import { waitForIdle } from "../support/network-capture";
import { IS_PRODUCTION_RUN } from "../support/prod-mode";

const RESULT_READY = { name: "다시 볼 링크 복사" } as const;
const TITLE_SUFFIX = " · 배송 조회";
const LOADING_TITLE = `${stateGuide.loading.docTitle}${TITLE_SUFFIX}`;
const INVALID_TITLE = `${stateGuide.invalidNumber.docTitle}${TITLE_SUFFIX}`;
const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";

const toFullWidth = (value: string): string =>
  value.replace(/[!-~]/g, (character) => String.fromCharCode(character.charCodeAt(0) + 0xfee0));

async function recordTrack(page: Page, options: { readonly delayMs?: number; readonly data?: TrackResponseData } = {}): Promise<unknown[]> {
  const bodies: unknown[] = [];
  await mockTrack(page, options.data ?? trackData("inTransit", { trackingNumber: FAKE.domestic }), {
    delayMs: options.delayMs ?? 0,
    onRequest: (body) => bodies.push(body)
  });
  return bodies;
}

async function activeTag(page: Page): Promise<string> {
  return page.evaluate(() => document.activeElement?.tagName ?? "");
}

test.describe("server shell without JavaScript (S06)", () => {
  test.use({ javaScriptEnabled: false });

  test("a valid number is painted as the number bar and '조회하고 있어요' from the server HTML", async ({ page }) => {
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator('[data-view-state="loading"]')).toHaveCount(1);
    const bar = page.locator('[data-number-bar="true"]');
    await expect(bar).toContainText(FAKE_GROUPED.domestic);
    await expect(bar).toContainText(lookup.copy.carrierAuto);
    await expect(page.getByRole("heading", { level: 2, name: lookup.copy.title })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "배송 조회 결과" })).toHaveCount(1);
    expect(await page.title()).toBe(LOADING_TITLE);
  });

  test("?c= carries the carrier into the number bar", async ({ page }) => {
    await page.goto(`/${FAKE.hbl}?c=cj`);
    const bar = page.locator('[data-number-bar="true"]');
    await expect(bar).toContainText(FAKE_GROUPED.hbl);
    await expect(bar).toContainText("CJ대한통운");
  });

  test("an alphanumeric path that is not a number renders the INVALID screen", async ({ page }) => {
    const response = await page.goto(`/${FAKE.deepLinkInvalid}`);
    expect(response?.status()).toBe(200);
    const input = page.getByRole("textbox", { name: INPUT_LABEL, exact: true });
    await expect(input).toHaveValue(FAKE.deepLinkInvalid);
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator('[data-guide-key="invalidNumber"] [role="alert"]')).toHaveText(stateGuide.invalidNumber.title);
    await expect(page.locator('[data-view-state="error"]')).toHaveCount(1);
    expect(await page.title()).toBe(INVALID_TITLE);
  });
});

test.describe("three-way split (S06)", () => {
  test("path variants normalize to one lookup", async ({ page }) => {
    const bodies = await recordTrack(page);
    const variants: ReadonlyArray<readonly [string, string]> = [
      [FAKE.hbl.toLowerCase(), FAKE.hbl],
      [encodeURIComponent(FAKE_GROUPED.domestic), FAKE.domestic],
      [FAKE_GROUPED.domestic.replaceAll(" ", "-"), FAKE.domestic],
      [encodeURIComponent(toFullWidth(FAKE.domestic)), FAKE.domestic]
    ];
    for (const [path] of variants) {
      await page.goto(`/${path}`);
      await expect(page.getByRole("button", RESULT_READY), path).toBeVisible();
    }
    expect(bodies).toEqual(variants.map(([, number]) => ({ trackingNumber: number, carrierCode: "AUTO" })));
  });

  test("?c= is sent with the lookup and unknown values fall back to AUTO", async ({ page }) => {
    const bodies = await recordTrack(page);
    await page.goto(`/${FAKE.hbl}?c=CJ`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await page.goto(`/${FAKE.hbl}?c=NOPE`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    expect(bodies).toEqual([
      { trackingNumber: FAKE.hbl, carrierCode: "CJ" },
      { trackingNumber: FAKE.hbl, carrierCode: "AUTO" }
    ]);
  });

  test("an invalid alphanumeric path never calls the API", async ({ page }) => {
    const bodies = await recordTrack(page);
    await page.goto(`/${FAKE.deepLinkInvalid}`);
    await expect(page.locator('[data-view-state="error"]')).toHaveCount(1);
    const cta = page.locator('[data-cta-state="error"]');
    await expect(cta.getByRole("link").first()).toHaveAccessibleName(`${channels.talk.labels.cta} 새 창으로 열기`);
    await waitForIdle(page);
    expect(bodies).toEqual([]);
    await expect(page.getByRole("button", RESULT_READY)).toHaveCount(0);
  });

  test("other shapes are a real 404 without a lookup", async ({ request }) => {
    for (const path of ["/a.b", `/${encodeURIComponent("한글")}`, `/${"0".repeat(31)}`, "/ABCDE"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
    }
  });

  test("a trailing slash redirects to the number path", async ({ request }) => {
    const response = await request.get(`/${FAKE.domestic}/`, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(new URL(response.headers()["location"] ?? "", "http://127.0.0.1:43210").pathname).toBe(`/${FAKE.domestic}`);
  });

  test("number-like responses are noindex and titled without the number", async ({ request }) => {
    for (const [path, title] of [
      [`/${FAKE.domestic}`, LOADING_TITLE],
      [`/${FAKE.deepLinkInvalid}`, INVALID_TITLE]
    ] as const) {
      const response = await request.get(path);
      expect(response.headers()["x-robots-tag"] ?? "", path).toContain("noindex");
      const html = await response.text();
      expect(html, path).toMatch(/<meta name="robots" content="noindex, nofollow"/);
      expect(/<title>([^<]*)<\/title>/.exec(html)?.[1], path).toBe(title);
    }
  });
});

test.describe("after the lookup (S06)", () => {
  test("focus moves to the status heading when the customer has not interacted", async ({ page }) => {
    await recordTrack(page, { delayMs: 300 });
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expect.poll(() => activeTag(page)).toBe("H2");
  });

  test("focus stays where the customer is when they interacted during loading", async ({ page }) => {
    await recordTrack(page, { delayMs: 1500 });
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator('[data-view-state="loading"]')).toHaveCount(1);
    await page.keyboard.press("Shift");
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await page.waitForTimeout(300);
    expect(await activeTag(page)).not.toBe("H2");
  });

  test("one live region hears the start and the result, once each", async ({ page }) => {
    await page.addInitScript(() => {
      const heard: string[] = [];
      (window as unknown as { __ttLive: string[] }).__ttLive = heard;
      let last = "";
      new MutationObserver(() => {
        const text = document.querySelector('[data-live-region="polite"]')?.textContent?.trim() ?? "";
        if (text === last) return;
        if (text !== "") heard.push(text);
        last = text;
      }).observe(document, { subtree: true, childList: true, characterData: true });
    });
    await recordTrack(page, { delayMs: 1000 });
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await page.waitForTimeout(300);
    const heard = await page.evaluate(() => (window as unknown as { __ttLive: string[] }).__ttLive);
    expect(heard).toHaveLength(2);
    expect(heard[0]).toBe(lookup.copy.started);
  });

  test("the document title follows the result and never contains the number", async ({ page }) => {
    await recordTrack(page);
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expect.poll(() => page.title()).not.toBe(LOADING_TITLE);
    const title = await page.title();
    expect(title.endsWith(TITLE_SUFFIX)).toBe(true);
    expect(title).not.toMatch(/\d{4}/);
  });

  test("[번호 변경] on a deep link opens the form with the number", async ({ page }) => {
    await recordTrack(page, { delayMs: 5000 });
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator('[data-number-bar="true"]')).toBeVisible();
    await page.getByRole("button", { name: "번호 변경" }).click();
    const input = page.getByRole("textbox", { name: INPUT_LABEL, exact: true });
    await expect(input).toHaveValue(FAKE.domestic);
    await expect(input).toBeFocused();
    await expect(page.locator('[data-view-state="idle"]')).toHaveCount(1);
  });

  test("an 18-digit cargo number at 320 px scrolls nowhere", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await recordTrack(page, { delayMs: 5000 });
    await page.goto(`/${FAKE.cargo}`);
    await expect(page.locator('[data-number-bar="true"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe("production caching (S06)", () => {
  test.skip(!IS_PRODUCTION_RUN, "next dev overrides Cache-Control on pages");

  test("number routes are private and never stored", async ({ request }) => {
    for (const path of [`/${FAKE.domestic}`, `/${FAKE.deepLinkInvalid}`]) {
      const cacheControl = (await request.get(path)).headers()["cache-control"] ?? "";
      expect(cacheControl, path).toContain("private");
      expect(cacheControl, path).toContain("no-store");
    }
  });
});
```

Create `tests/e2e/lookup-input.spec.ts`:

```ts
import { expect, test, type Locator, type Page } from "@playwright/test";
import { channels, lookup, stateGuide } from "@/config/site.config";
import { FAKE, FAKE_GROUPED, mockTrack, trackData } from "../fixtures/tracking-fixtures";
import { waitForIdle } from "../support/network-capture";

const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";
const RESULT_READY = { name: "다시 볼 링크 복사" } as const;

function trackingInput(page: Page): Locator {
  return page.getByRole("textbox", { name: INPUT_LABEL, exact: true });
}

async function recordTrack(page: Page, delayMs = 0): Promise<unknown[]> {
  const bodies: unknown[] = [];
  await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }), {
    delayMs,
    onRequest: (body) => bodies.push(body)
  });
  return bodies;
}

test.describe("lookup input (S06)", () => {
  test("the format hint replaces example numbers and describes the input", async ({ page }) => {
    await page.goto("/");
    // Count first: if example buttons came back, the failure prints a count, never a number.
    await expect(page.getByRole("button", { name: /^예시/ })).toHaveCount(0);
    const hint = page.locator("#tracking-format-help");
    await expect(hint).toBeVisible();
    await expect(hint).toHaveText(lookup.copy.formatHint);
    const describedBy = (await trackingInput(page).getAttribute("aria-describedby")) ?? "";
    expect(describedBy.split(" ")).toContain("tracking-format-help");
  });

  test("input attributes suit phone keyboards and nothing takes focus on load", async ({ page }) => {
    await page.goto("/");
    const input = trackingInput(page);
    await expect(input).toHaveAttribute("inputmode", "text");
    await expect(input).toHaveAttribute("autocapitalize", "characters");
    await expect(input).toHaveAttribute("autocomplete", "off");
    await expect(input).toHaveAttribute("enterkeyhint", "search");
    await expect(input).toHaveAttribute("name", "trackingNumber");
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  });

  test("the number is normalized before it is sent", async ({ page }) => {
    const bodies = await recordTrack(page);
    await page.goto("/");
    await trackingInput(page).fill(`  ${FAKE_GROUPED.hbl.toLowerCase().replaceAll(" ", "-")} `);
    await trackingInput(page).press("Enter");
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    expect(bodies).toEqual([{ trackingNumber: FAKE.hbl, carrierCode: "AUTO" }]);
  });

  test("the carrier choice lists the five carriers and travels with the request", async ({ page }) => {
    const bodies = await recordTrack(page);
    await page.goto("/");
    const carrier = page.getByRole("combobox", { name: "국내 택배사" });
    await expect(carrier.locator("option")).toHaveText(["자동으로 찾기", "CJ대한통운", "우체국택배", "한진택배", "롯데택배", "로젠택배"]);
    await carrier.selectOption("HANJIN");
    await trackingInput(page).fill(FAKE.domestic);
    await trackingInput(page).press("Enter");
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    expect(bodies).toEqual([{ trackingNumber: FAKE.domestic, carrierCode: "HANJIN" }]);
  });

  test("a malformed number is caught before any request, with the reason next to the input", async ({ page }) => {
    const bodies = await recordTrack(page);
    await page.goto("/");
    const input = trackingInput(page);
    await input.fill(FAKE.invalidShort);
    await input.press("Enter");
    const error = page.locator('[data-guide-key="invalidNumber"]');
    await expect(error.getByRole("alert")).toHaveText(stateGuide.invalidNumber.title);
    await expect(error).toContainText("지금 5자리예요");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveValue(FAKE.invalidShort);
    await expect(input).toBeFocused();
    await expect(page.locator('[data-view-state="error"]')).toHaveCount(1);
    await expect(page.locator("details", { hasText: lookup.copy.numberFinderSummary })).toHaveAttribute("open", "");
    const cta = page.locator('[data-cta-state="error"]');
    await expect(cta.getByRole("link").first()).toHaveAccessibleName(`${channels.talk.labels.cta} 새 창으로 열기`);
    await expect(cta.getByRole("link", { name: /스토어/ })).toHaveCount(0);
    await waitForIdle(page);
    expect(bodies).toEqual([]);
  });

  test("correcting the number and submitting again runs the lookup", async ({ page }) => {
    const bodies = await recordTrack(page);
    await page.goto("/");
    const input = trackingInput(page);
    await input.fill(FAKE.invalidShort);
    await input.press("Enter");
    await expect(page.locator('[data-guide-key="invalidNumber"]')).toBeVisible();
    await input.fill(FAKE.domestic);
    await input.press("Enter");
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expect(page.locator('[data-guide-key="invalidNumber"]')).toHaveCount(0);
    expect(bodies).toEqual([{ trackingNumber: FAKE.domestic, carrierCode: "AUTO" }]);
  });

  test("while a lookup starts the form stays editable and only the button label changes", async ({ page }) => {
    await page.clock.install();
    const bodies = await recordTrack(page, 2000);
    await page.goto("/");
    await trackingInput(page).fill(FAKE.domestic);
    await page.getByRole("button", { name: lookup.copy.submit }).click();
    await expect(page.getByRole("button", { name: lookup.copy.submitting })).toHaveAttribute("aria-busy", "true");
    await expect(trackingInput(page)).toBeEditable();
    await expect(page.locator('[data-lookup-form="true"]')).toHaveAttribute("aria-busy", "true");
    await expect(page.locator('[data-view-state="loading"]')).toHaveCount(1);
    await page.clock.runFor(500);
    await expect(page.locator('[data-number-bar="true"]')).toBeVisible();
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible({ timeout: 10_000 });
    expect(bodies).toHaveLength(1);
  });
});

test.describe("lookup input without JavaScript (S06)", () => {
  test.use({ javaScriptEnabled: false });

  test("without JavaScript the form reaches the deep-link shell through the redirect", async ({ page }) => {
    await page.goto("/");
    await trackingInput(page).fill(FAKE.domestic);
    await page.getByRole("combobox", { name: "국내 택배사" }).selectOption("CJ");
    await page.getByRole("button", { name: lookup.copy.submit }).click();
    await page.waitForURL((url) => url.pathname === `/${FAKE.domestic}`);
    const bar = page.locator('[data-number-bar="true"]');
    await expect(bar).toContainText(FAKE_GROUPED.domestic);
    await expect(bar).toContainText("CJ대한통운");
  });
});
```

Append to `tests/e2e/home.spec.ts`:

```ts
const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";
const HOME_H1 = "통관부터 국내 배송까지 한 번에 확인";
const RESULT_READY = { name: "다시 볼 링크 복사" } as const;

test.describe("home first view (S06)", () => {
  test("one h1 and the lookup form come first; the hero decorations are gone", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(HOME_H1);
    await expect(page.locator('[data-view-state="idle"]')).toHaveCount(1);
    const form = page.locator('[data-lookup-form="true"]');
    await expect(form.getByRole("textbox", { name: INPUT_LABEL, exact: true })).toBeVisible();
    await expect(form.getByRole("combobox", { name: "국내 택배사" })).toBeVisible();
    await expect(form.getByRole("button", { name: "조회하기" })).toBeVisible();
    for (const hook of ["data-logistics-flow", "data-input-shake", "data-motion-cue", "data-tracking-result-summary"]) {
      await expect(page.locator(`[${hook}]`), hook).toHaveCount(0);
    }
    await expect(page.getByRole("region", { name: "배송 조회 안심 안내" })).toHaveCount(0);
    await expect(page.getByText("구매 고객을 위한 배송조회")).toHaveCount(0);
  });

  test("home copy speaks customer language: no AI, robot or brand slogans", async ({ page }) => {
    await page.goto("/");
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/\bAI\b|인공지능|로봇|챗봇/);
    await expect(page.getByText("실시간 AI 배송 추적 시스템")).toHaveCount(0);
    await expect(page.locator("body")).toHaveClass(/google-anno-skip/);
  });

  test("the lookup area keeps its ad-exclusion hook and exactly one filled button", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('#tracking[data-ad-exclude="true"]')).toHaveCount(1);
    const filled = page.locator('[data-slot="button"][data-variant="primary"]');
    await expect(filled).toHaveCount(1);
    await expect(filled).toHaveText("조회하기");
  });

  test("no horizontal scroll at 320, 768 and 1280 px", async ({ page }) => {
    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${width}px`).toBe(true);
    }
  });

  test("no infinite animation runs, and reduced motion stops every animation", async ({ page }) => {
    await page.goto("/");
    const infinite = await page.evaluate(
      () => document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations === Number.POSITIVE_INFINITY).length
    );
    expect(infinite).toBe(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    const moving = await page.evaluate(
      () =>
        document.getAnimations().filter((animation) => {
          const duration = Number(animation.effect?.getComputedTiming().duration ?? 0);
          return animation.playState === "running" && duration > 0;
        }).length
    );
    expect(moving).toBe(0);
  });

  test("the skip link moves focus to the main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });
});

test.describe("mode changes stay on '/' (S06)", () => {
  test("[다른 번호 조회] resets to the form without a navigation or a new lookup", async ({ page }) => {
    const bodies: unknown[] = [];
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.hbl }), { onRequest: (body) => bodies.push(body) });
    const documents: string[] = [];
    page.on("load", () => documents.push(page.url()));
    await page.goto("/");
    const input = page.getByRole("textbox", { name: INPUT_LABEL, exact: true });
    await input.fill(FAKE.hbl);
    await input.press("Enter");
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await page.getByRole("button", { name: "다른 번호 조회" }).click();
    await expect(page.locator('[data-view-state="idle"]')).toHaveCount(1);
    await expect(input).toHaveValue(FAKE.hbl);
    await expect(input).toBeFocused();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(HOME_H1);
    expect(new URL(page.url()).pathname).toBe("/");
    expect(documents).toHaveLength(1);
    expect(bodies).toHaveLength(1);
  });

  test("[번호 변경] during a slow lookup returns to the form and ignores the late answer", async ({ page }) => {
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }), { delayMs: 2500 });
    await page.goto("/");
    const input = page.getByRole("textbox", { name: INPUT_LABEL, exact: true });
    await input.fill(FAKE.domestic);
    await input.press("Enter");
    await expect(page.locator('[data-number-bar="true"]')).toBeVisible();
    await page.getByRole("button", { name: "번호 변경" }).click();
    await expect(input).toHaveValue(FAKE.domestic);
    await expect(input).toBeFocused();
    await page.waitForTimeout(3000);
    await expect(page.getByRole("button", RESULT_READY)).toHaveCount(0);
    await expect(page.locator('[data-view-state="idle"]')).toHaveCount(1);
  });
});
```

- [ ] **Step 6: Run the new E2E tests to verify they fail**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/deep-link.spec.ts tests/e2e/lookup-input.spec.ts tests/e2e/home.spec.ts`
Expected: FAIL. Already passing, because they guard behavior the legacy page shares: the four Task 4 header tests; lookup-input "the format hint replaces example numbers and describes the input" and "the carrier choice lists the five carriers and travels with the request"; deep-link "a trailing slash redirects to the number path"; home "home copy speaks customer language: no AI, robot or brand slogans" and "no horizontal scroll at 320, 768 and 1280 px". Every other new test fails, because `[data-view-state]`, `[data-number-bar]`, `[data-lookup-form]`, the INVALID screen, the 404 split, the `noindex` meta tag, the normalized request body and the buttons '번호 변경'/'다른 번호 조회' do not exist on the legacy page; "production caching" is skipped in dev mode.

- [ ] **Step 7: Create `components/lookup/session.ts`**

```ts
/**
 * Per-document client snapshots of the lookup island, ported from S02's HomePageClient helpers.
 * Restore (spec §3): only in reload/back_forward documents, read once per document, and dropped as soon as any lookup
 * starts in this document, so an in-app return to '/' does not replay it. The server snapshot is null, so the static
 * '/' HTML and the first client render are identical (useSyncExternalStore renders the server snapshot while hydrating).
 */
import { currentNavigationKind, readRestoreEntry, type RestoreEntry } from "@/lib/privacy/session-restore";

let restoreSnapshot: RestoreEntry | null | undefined;
let restoreConsumed = false;

/** These snapshots never change on their own; nothing to subscribe to. */
export function subscribeToNothing(): () => void {
  return () => undefined;
}

export function getRestoreSnapshot(): RestoreEntry | null {
  if (restoreConsumed) return null;
  if (restoreSnapshot === undefined) {
    restoreSnapshot = readRestoreEntry({ now: Date.now(), navigation: currentNavigationKind() });
  }
  return restoreSnapshot;
}

export function getServerRestoreSnapshot(): RestoreEntry | null {
  return null;
}

export function markRestoreConsumed(): void {
  restoreConsumed = true;
}
```

- [ ] **Step 8: Create the small form pieces**

Create `components/lookup/FormatHint.tsx`:

```tsx
/** The non-clickable format line under the input (spec §4 "예시 대신 형식 안내"). Real numbers never appear here. */
export function FormatHint({ id, text }: { readonly id: string; readonly text: string }): React.JSX.Element {
  return (
    <p id={id} className="m-0 mt-1.5 text-tt-xs text-tt-muted [word-break:keep-all]">
      {text}
    </p>
  );
}
```

Create `components/lookup/NumberFinderHelp.tsx`:

```tsx
/**
 * '번호는 어디서 찾나요?' (spec §4): 네이버 주문상세 → 배송조회, 쿠팡 주문목록 → 배송조회, 톡톡 출고 안내문.
 * Opens by itself on the INVALID screen (spec §7 "이 상태에서는 기본으로 펼침"); the key remounts it when that changes,
 * so the customer can still close it.
 */
export function NumberFinderHelp({
  summary,
  items,
  open
}: {
  readonly summary: string;
  readonly items: readonly string[];
  readonly open: boolean;
}): React.JSX.Element {
  return (
    <details key={open ? "open" : "closed"} open={open || undefined}>
      <summary className="tt-focus inline-flex min-h-[44px] cursor-pointer items-center text-tt-sm font-bold text-tt-link underline decoration-2 underline-offset-4">
        {summary}
      </summary>
      <ul className="m-0 mb-2 list-disc pl-5 text-tt-sm text-tt-ink">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </details>
  );
}
```

Create `components/lookup/FailureFallback.tsx`:

```tsx
import { channels, stateGuide } from "@/config/site.config";
import { TalkLink } from "@/components/primitives/TalkLink";

/**
 * Error CTA block (spec §7 INVALID; E2E rule "오류는 문의 우선·스토어 홍보 없음"): heading, one sentence, and
 * [톡톡으로 문의하기] as the block's first link, at secondary weight next to the page's one filled button.
 * Used on the INVALID form screen and when the result code cannot be loaded ("serverError").
 */
export function FailureFallback({ guideKey }: { readonly guideKey: "invalidNumber" | "serverError" }): React.JSX.Element {
  const row = stateGuide[guideKey];
  return (
    <div data-cta-state="error" className="flex flex-col gap-2 border-t border-tt-rule px-[var(--tt-gutter)] pt-4">
      {row.ctaHeading === null ? null : <h3 className="m-0 text-tt-md font-bold text-tt-ink">{row.ctaHeading}</h3>}
      <p className="m-0 text-tt-sm text-tt-ink [word-break:keep-all]">{row.nextAction}</p>
      <div>
        <TalkLink href={channels.talk.url} label={channels.talk.labels.cta} weight="secondary" placement="state" />
      </div>
    </div>
  );
}
```

Create `components/lookup/PendingCard.tsx`:

```tsx
/**
 * The static '조회하고 있어요' card (spec §7 loading): what a deep link paints from the server HTML, and what any
 * non-manual lookup shows in its first 0.4 s. Static skeleton blocks, no shimmer, no spinner (spec §5, §12 2.2.2).
 */
export function PendingCard({ title, body }: { readonly title: string; readonly body: string }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 px-[var(--tt-gutter)] pt-2">
      <h2 className="m-0 text-tt-lg font-black text-tt-ink">{title}</h2>
      <p className="m-0 text-tt-sm text-tt-ink [word-break:keep-all]">{body}</p>
      <div aria-hidden="true" className="mt-2 flex flex-col gap-3">
        <div className="h-14 bg-tt-ground" />
        <div className="h-10 w-2/3 bg-tt-ground" />
        <div className="h-24 bg-tt-ground" />
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Create `components/lookup/LookupForm.tsx`**

```tsx
"use client";

import type { RefObject } from "react";
import { lookup as lookupConfig } from "@/config/site.config";
import { FormatHint } from "@/components/lookup/FormatHint";
import { NumberFinderHelp } from "@/components/lookup/NumberFinderHelp";
import { Button } from "@/components/primitives/Button";
import { ToneIcon } from "@/components/primitives/ToneIcon";
import { CARRIER_NAMES, CONCRETE_CARRIER_CODES } from "@/lib/tracking/carriers";
import { parseCarrierParam } from "@/lib/tracking/number-input";
import type { DeliveryCarrierCode } from "@/lib/types";

export const TRACKING_INPUT_ID = "tracking-number";
export const FORMAT_HINT_ID = "tracking-format-help";
const ERROR_ID = "tracking-number-error";
const DIAGNOSIS_ID = "tracking-number-diagnosis";
const CARRIER_ID = "tracking-carrier";
const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";
const CARRIER_LABEL = "국내 택배사";
const AUTO_LABEL = "자동으로 찾기";

export interface InvalidInputView {
  readonly message: string;
  readonly diagnosis: string | null;
  readonly attempt: number;
}

export interface LookupFormProps {
  readonly value: string;
  readonly carrier: DeliveryCarrierCode;
  readonly busy: boolean;
  readonly invalid: InvalidInputView | null;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly onValueChange: (value: string) => void;
  readonly onCarrierChange: (carrier: DeliveryCarrierCode) => void;
  readonly onSubmit: () => void;
}

/**
 * The lookup form (spec §4). It is also a plain GET form: without JavaScript it submits to '/?trackingNumber=…&c=…',
 * which next.config.ts redirects (307) to the deep-link shell (spec §3). Inputs are never disabled; busy → aria-busy.
 * No autofocus (the phone keyboard would cover the screen).
 */
export function LookupForm({
  value,
  carrier,
  busy,
  invalid,
  inputRef,
  onValueChange,
  onCarrierChange,
  onSubmit
}: LookupFormProps): React.JSX.Element {
  const describedBy = [FORMAT_HINT_ID, invalid ? ERROR_ID : null, invalid?.diagnosis ? DIAGNOSIS_ID : null]
    .filter((id): id is string => id !== null)
    .join(" ");
  return (
    <form
      method="get"
      action="/"
      noValidate
      data-lookup-form="true"
      aria-busy={busy || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col px-[var(--tt-gutter)]"
    >
      <label htmlFor={TRACKING_INPUT_ID} className="text-tt-sm font-bold text-tt-ink">
        {INPUT_LABEL}
      </label>
      <input
        ref={inputRef}
        id={TRACKING_INPUT_ID}
        name="trackingNumber"
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className={`tt-focus mt-1 h-14 w-full rounded-none border-[3px] bg-tt-surface px-4 font-tt-mono text-tt-lg tracking-[0.04em] text-tt-ink ${
          invalid ? "border-tt-attention-ink" : "border-tt-ink"
        }`}
      />
      {invalid ? (
        <div data-guide-key="invalidNumber" className="mt-2 flex flex-col gap-1">
          <p
            key={invalid.attempt}
            id={ERROR_ID}
            role="alert"
            className="m-0 flex items-start gap-1.5 text-tt-sm font-bold text-tt-attention-ink [word-break:keep-all]"
          >
            <ToneIcon tone="attention" />
            <span>{invalid.message}</span>
          </p>
          {invalid.diagnosis ? (
            <p id={DIAGNOSIS_ID} className="m-0 text-tt-sm text-tt-ink [word-break:keep-all]">
              {invalid.diagnosis}
            </p>
          ) : null}
        </div>
      ) : null}
      <FormatHint id={FORMAT_HINT_ID} text={lookupConfig.copy.formatHint} />
      <NumberFinderHelp
        summary={lookupConfig.copy.numberFinderSummary}
        items={lookupConfig.copy.numberFinderItems}
        open={invalid !== null}
      />
      <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-2">
        <label htmlFor={CARRIER_ID} className="whitespace-nowrap text-tt-sm font-bold text-tt-ink">
          {CARRIER_LABEL}
        </label>
        <div className="relative">
          <select
            id={CARRIER_ID}
            name="c"
            value={carrier}
            onChange={(event) => onCarrierChange(parseCarrierParam(event.target.value))}
            className="tt-focus block h-12 w-full appearance-none rounded-none border-2 border-tt-ink bg-tt-surface pl-3.5 pr-10 text-tt-md font-medium text-tt-ink"
          >
            <option value="AUTO">{AUTO_LABEL}</option>
            {CONCRETE_CARRIER_CODES.map((code) => (
              <option key={code} value={code}>
                {CARRIER_NAMES[code]}
              </option>
            ))}
          </select>
          <svg
            aria-hidden="true"
            focusable="false"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="square"
            strokeLinejoin="miter"
            className="pointer-events-none absolute right-3.5 top-4 text-tt-ink"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>
      <Button type="submit" variant="primary" size="lg" busy={busy} className="mt-3 w-full">
        {busy ? lookupConfig.copy.submitting : lookupConfig.copy.submit}
      </Button>
    </form>
  );
}
```

- [ ] **Step 10: Create `components/lookup/LegacyResultSection.tsx` and move S04's result block into it**

(a) Create the file:

```tsx
"use client";

import { StatusSlot, type StatusSlotProps } from "@/components/status-slot/StatusSlot";
import type { LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";

export type LegacyDeriver = (outcome: LookupOutcome, now: Date) => TrackingViewModel;

let loadedDeriver: LegacyDeriver | null = null;
let pendingDeriver: Promise<LegacyDeriver> | null = null;

/** The deriver when its chunk has already arrived, so a settled lookup renders in the same task. */
export function getLoadedLegacyDeriver(): LegacyDeriver | null {
  return loadedDeriver;
}

/**
 * deriveTrackingView and the full config through a dynamic import (contract §11.1 rule 3): they stay out of the lookup
 * island's static graph. Preloaded when a lookup starts; a failed chunk can be retried. S07 replaces this with
 * loadResultModule() and deletes the file.
 */
export function loadLegacyDeriver(): Promise<LegacyDeriver> {
  if (loadedDeriver !== null) return Promise.resolve(loadedDeriver);
  if (pendingDeriver === null) {
    pendingDeriver = Promise.all([import("@/lib/tracking/derive-view"), import("@/config/site.config")]).then(
      ([derive, config]) => {
        const deriver: LegacyDeriver = (outcome, now) => derive.deriveTrackingView(outcome, now, config.siteConfig);
        loadedDeriver = deriver;
        return deriver;
      },
      (error: unknown) => {
        pendingDeriver = null;
        throw error;
      }
    );
  }
  return pendingDeriver;
}

/**
 * Transitional result area (S06 → S07): S04's status slot, then the legacy result details exactly as S04's
 * HomePageClient rendered them, on the dark legacy band.
 */
export function LegacyResultSection(props: StatusSlotProps): React.JSX.Element {
  return (
    <div className="tt-legacy-dark flex flex-col gap-4 px-4 py-4">
      <StatusSlot {...props} />
      {/* S04 result block */}
    </div>
  );
}
```

(b) Replace the comment `{/* S04 result block */}` with the "S04 result block" recorded in Task 0 Step 9, following these rules:
1. Keep S04's elements, their order, props and conditions exactly — they are what S04's E2E files and the R-rows of `tests/e2e/RULE-MAP.md` assert.
2. Rename S04's identifiers: S04's lookup state (`state`, `lookup.state` or similar) → `props.state`; S04's view model variable → `props.view`; the settled data S04 read from the settled state → `(props.state.phase === "settled" ? props.state.outcome.data : null)` (keep S04's null checks around it); S04's action callback → `props.onAction`.
3. Copy the imports those elements need (for example `CustomsTimeline`, `DeliveryTimeline`, `CustomerCta`, `RecommendedProducts`) and every module-level helper they call (for example S04's delivery waiting-message helper) into this file, below the existing imports and above `LegacyDeriver`.
4. Do not copy `StatusSlot` itself, focus/title/announce code, the scrub/restore/ad-signal code, the same-address history code, the storefront showcase, `ServiceGuide` or the footer.

For orientation only, the block S04 started from (commit `e079461`, `components/HomePageClient.tsx` lines 179–197) rendered, inside the result section: a `<section aria-labelledby="tracking-details-title">` with the heading '상세 진행 내역', `CustomsTimeline events={result.customs.events}` and `DeliveryTimeline delivery={result.delivery} waitingMessage={getDeliveryWaitingMessage(result)}` in a two-column grid, then `CustomerCta variant="result" …` and `RecommendedProducts …`. S04's version is authoritative.

Check: `Select-String -LiteralPath components/lookup/LegacyResultSection.tsx -Pattern "HomePageClient|useAnnounce|document\.title|scrubNumberFromUrl"` → no output.

- [ ] **Step 11: Create `components/lookup/LookupController.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { lookup as lookupConfig, notices, stateGuide } from "@/config/site.config";
import { FailureFallback } from "@/components/lookup/FailureFallback";
import { getLoadedLegacyDeriver, LegacyResultSection, loadLegacyDeriver, type LegacyDeriver } from "@/components/lookup/LegacyResultSection";
import { LookupForm } from "@/components/lookup/LookupForm";
import { computeDisplay, outcomeKey, viewModeOf, type DerivedView, type InvalidInput, type LookupDisplay } from "@/components/lookup/lookup-display";
import { PendingCard } from "@/components/lookup/PendingCard";
import { getRestoreSnapshot, getServerRestoreSnapshot, markRestoreConsumed, subscribeToNothing } from "@/components/lookup/session";
import { useLookup } from "@/components/lookup/useLookup";
import { Button } from "@/components/primitives/Button";
import { useAnnounce } from "@/components/primitives/LiveAnnouncer";
import { NumberBar } from "@/components/primitives/NumberBar";
import { StoreContactPopup } from "@/components/StoreContactPopup";
import { setAdSignals } from "@/lib/ads/ad-signals";
import type { LoadingConfig } from "@/lib/config/types";
import { saveRestoreEntry, type RestoreEntry } from "@/lib/privacy/session-restore";
import { SCRUB_TIMEOUT_MS, scrubNumberFromUrl } from "@/lib/privacy/url-scrub";
import { requestCarrierView } from "@/lib/tracking/carriers";
import { groupTrackingNumber } from "@/lib/tracking/number-format";
import { precheckNumber } from "@/lib/tracking/number-input";
import type {
  LookupEntry,
  LookupOutcome,
  LookupRequest,
  NoticeView,
  NumberView,
  ResultAction,
  TrackingEntry,
  TrackingViewModel
} from "@/lib/tracking/types";
import type { DeliveryCarrierCode } from "@/lib/types";

export interface LookupControllerProps {
  readonly entry: TrackingEntry;
  readonly homeNotice: NoticeView | null; // server-picked; re-filtered with KST after mount (Task 8)
  readonly idleExtras: React.ReactNode;   // server-rendered below-the-fold blocks, rendered only in idle mode
}

const LOADING_CONFIG: LoadingConfig = { lookup: lookupConfig, notices };
const HEADING_ID = "lookup-heading";
const HOME_HEADING = "통관부터 국내 배송까지 한 번에 확인";
const RESULT_HEADING = "배송 조회 결과";
const CHANGE_NUMBER_LABEL = "번호 변경";
const LOOKUP_ANOTHER_LABEL = "다른 번호 조회";
const TITLE_SUFFIX = " · 배송 조회";
/** The root layout's metadata title; restored when the customer is back on the form. */
const HOME_DOCUMENT_TITLE = "통관·국내 배송 한 번에 조회";
const LOADING_DOCUMENT_TITLE = `${stateGuide.loading.docTitle}${TITLE_SUFFIX}`;
const INVALID_DOCUMENT_TITLE = `${stateGuide.invalidNumber.docTitle}${TITLE_SUFFIX}`;
/** Deep links and restores move focus only if the customer has not interacted (spec §5). */
const PASSIVE_ENTRIES: ReadonlySet<LookupEntry> = new Set<LookupEntry>(["deepLink", "restore"]);
const INTERACTION_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

function initialInvalid(entry: TrackingEntry): InvalidInput | null {
  if (entry.kind !== "invalidDeepLink") return null;
  const result = precheckNumber(entry.input);
  return { diagnosis: result.ok ? null : result.diagnosis, attempt: 0 };
}

/** The lookup a document starts on its own: a deep link, or a restored lookup on '/'. */
function autoRequest(entry: TrackingEntry, restore: RestoreEntry | null): LookupRequest | null {
  if (entry.kind === "deepLink") return { number: entry.number, carrier: entry.carrier, entry: "deepLink" };
  if (entry.kind === "home" && restore !== null) return { number: restore.number, carrier: restore.carrier, entry: "restore" };
  return null;
}

function numberViewOf(number: string): NumberView {
  return { raw: number, grouped: groupTrackingNumber(number) };
}

function deriveSafely(derive: LegacyDeriver, outcome: LookupOutcome, now: Date): TrackingViewModel | null {
  try {
    return derive(outcome, now);
  } catch {
    return null;
  }
}

function pageTitleOf(display: LookupDisplay, loadingLike: boolean): string | null {
  if (display.kind === "form") {
    if (display.invalid !== null) return INVALID_DOCUMENT_TITLE;
    return display.busy ? LOADING_DOCUMENT_TITLE : HOME_DOCUMENT_TITLE;
  }
  return loadingLike ? LOADING_DOCUMENT_TITLE : null; // settled titles come from the view model
}

/**
 * The one client island of the tracking page (spec §3, §14): mode as component state, lookups through S04's useLookup,
 * candidate B and restore (S02), focus/live/title rules (spec §5). [다른 번호 조회] is a state reset, never a navigation.
 */
export function LookupController({ entry, idleExtras }: LookupControllerProps): React.JSX.Element {
  const announce = useAnnounce();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const autoStartedRef = useRef(false);
  const focusInputRef = useRef(false);
  const interactedRef = useRef(false);
  const derivedSeqRef = useRef(0);
  const handledSeqRef = useRef<number | null>(null);
  const announcedLoadingRef = useRef<string | null>(null);

  const [inputValue, setInputValue] = useState(() =>
    entry.kind === "deepLink" ? entry.number : entry.kind === "invalidDeepLink" ? entry.input : ""
  );
  const [carrier, setCarrier] = useState<DeliveryCarrierCode>(() => (entry.kind === "deepLink" ? entry.carrier : "AUTO"));
  const [formOpen, setFormOpen] = useState(entry.kind !== "deepLink");
  const [localInvalid, setLocalInvalid] = useState<InvalidInput | null>(() => initialInvalid(entry));
  const [derived, setDerived] = useState<DerivedView | null>(null);

  // Overdue and every date are judged with the client clock at settle time (spec §6), never during render.
  const handleSettled = useCallback((outcome: LookupOutcome, now: Date) => {
    derivedSeqRef.current += 1;
    const seq = derivedSeqRef.current;
    const key = outcomeKey(outcome);
    const loaded = getLoadedLegacyDeriver();
    if (loaded !== null) {
      setDerived({ key, seq, view: deriveSafely(loaded, outcome, now) });
      return;
    }
    void loadLegacyDeriver().then(
      (derive) => setDerived({ key, seq, view: deriveSafely(derive, outcome, now) }),
      () => setDerived({ key, seq, view: null })
    );
  }, []);

  const { state, loading, submit, retry, cancel, reset } = useLookup({ config: LOADING_CONFIG, onSettled: handleSettled });
  const restoreEntry = useSyncExternalStore(subscribeToNothing, getRestoreSnapshot, getServerRestoreSnapshot);

  const display = computeDisplay({ state, loading, entry, formOpen, localInvalid, derived });
  const viewMode = viewModeOf(display, state.phase);
  const activeRequest = display.kind === "form" ? null : display.request;
  const loadingLike = display.kind === "pending" || state.phase === "loading";

  const beginLookup = useCallback(
    (request: LookupRequest) => {
      markRestoreConsumed();
      // Every lookup start overwrites the tab's one restore entry; a deep link stashes it in the scrub instead (S02).
      if (request.entry !== "deepLink") saveRestoreEntry({ number: request.number, carrier: request.carrier, savedAt: Date.now() });
      void loadLegacyDeriver().catch(() => undefined);
      submit(request);
    },
    [submit]
  );

  // Candidate B ②: the lookup starts right after hydration (deep link), or a reload/back_forward restores it.
  useEffect(() => {
    if (autoStartedRef.current) return;
    const request = autoRequest(entry, restoreEntry);
    if (request === null) return;
    autoStartedRef.current = true;
    beginLookup(request);
  }, [beginLookup, entry, restoreEntry]);

  // Candidate B ③–⑥ (S02): wait for the router, stash, replaceState('/'), confirm, then tell the ad gate.
  useEffect(() => {
    if (entry.kind === "home") return;
    const stash = entry.kind === "deepLink" ? { number: entry.number, carrier: entry.carrier } : null;
    void scrubNumberFromUrl({
      timeoutMs: SCRUB_TIMEOUT_MS,
      beforeReplace: () => {
        if (stash !== null) saveRestoreEntry({ ...stash, savedAt: Date.now() });
      }
    }).then((status) => {
      // An INVALID deep link never unlocks the ad loader (spec §7 INVALID: 광고 0, 로더가 없으면 넣지 않음).
      if (stash === null) return;
      if (status === "scrubbed" || status === "failed") setAdSignals({ scrub: status });
    });
  }, [entry]);

  useEffect(() => {
    const mark = (): void => {
      interactedRef.current = true;
    };
    for (const type of INTERACTION_EVENTS) document.addEventListener(type, mark, { capture: true, passive: true });
    return () => {
      for (const type of INTERACTION_EVENTS) document.removeEventListener(type, mark, { capture: true });
    };
  }, []);

  // A settled result: one live sentence, the document title, and focus to the visible status h2 (spec §5).
  const settled = display.kind === "slot" && display.derived !== null ? display.derived : null;
  const settledEntry = activeRequest?.entry ?? null;
  useEffect(() => {
    if (settled === null || handledSeqRef.current === settled.seq) return;
    handledSeqRef.current = settled.seq;
    if (settled.view !== null) {
      document.title = settled.view.documentTitle;
      announce(settled.view.liveMessage);
    }
    if (settledEntry !== null && PASSIVE_ENTRIES.has(settledEntry) && interactedRef.current) return;
    headingRef.current?.focus();
  }, [announce, settled, settledEntry]);

  // Loading: '조회를 시작했어요' on entering the short stage, the 8 s sentence once (spec §5), each once per lookup.
  const loadingAnnouncement = state.phase === "loading" ? (loading?.announcement ?? null) : null;
  const loadingKey = state.phase === "loading" && loading !== null ? `${state.startedAt}|${loading.stage}` : null;
  useEffect(() => {
    if (loadingKey === null || loadingAnnouncement === null || announcedLoadingRef.current === loadingKey) return;
    announcedLoadingRef.current = loadingKey;
    announce(loadingAnnouncement);
  }, [announce, loadingAnnouncement, loadingKey]);

  const pageTitle = pageTitleOf(display, loadingLike);
  useEffect(() => {
    if (pageTitle !== null) document.title = pageTitle;
  }, [pageTitle]);

  // A server INVALID answer (400/413/415) is shown at the input and keeps the focus there (spec §5).
  const serverInvalidAt = state.phase === "error" && state.outcome.cause === "invalidNumber" ? state.settledAt : null;
  useEffect(() => {
    if (serverInvalidAt !== null) inputRef.current?.focus();
  }, [serverInvalidAt]);

  // After [번호 변경] / [다른 번호 조회] / [번호 수정] the form is back: focus and select the number (WCAG 3.3.7 keeps it).
  useEffect(() => {
    if (display.kind !== "form" || !focusInputRef.current) return;
    focusInputRef.current = false;
    inputRef.current?.focus();
    inputRef.current?.select();
  });

  const openForm = useCallback(
    (how: "cancel" | "reset", request: LookupRequest | null) => {
      if (how === "cancel") cancel();
      else reset();
      if (request !== null) {
        setInputValue(request.number);
        setCarrier(request.carrier);
      }
      setLocalInvalid(null);
      setFormOpen(true);
      focusInputRef.current = true;
    },
    [cancel, reset]
  );

  const handleSubmit = useCallback(() => {
    const result = precheckNumber(inputValue);
    if (!result.ok) {
      if (state.phase === "loading") cancel(); // a new submission always replaces the running one (spec §5)
      setLocalInvalid((previous) => ({ diagnosis: result.diagnosis, attempt: (previous?.attempt ?? 0) + 1 }));
      inputRef.current?.focus();
      return;
    }
    setLocalInvalid(null);
    beginLookup({ number: result.number, carrier, entry: "manual" });
  }, [beginLookup, cancel, carrier, inputValue, state.phase]);

  const handleAction = useCallback(
    (action: ResultAction) => {
      switch (action.kind) {
        case "fixNumber":
          openForm("reset", activeRequest);
          return;
        case "cancel":
          openForm("cancel", activeRequest);
          return;
        case "retry":
          retry();
          return;
        case "chooseCarrier":
          if (activeRequest === null) return;
          setCarrier(action.carrier);
          beginLookup({ number: activeRequest.number, carrier: action.carrier, entry: "carrierChip" });
          return;
        case "copied":
        case "openedExternal":
          return;
      }
    },
    [activeRequest, beginLookup, openForm, retry]
  );

  const numberBarAction =
    activeRequest === null ? null : (
      <Button variant="text" onClick={() => openForm(loadingLike ? "cancel" : "reset", activeRequest)}>
        {loadingLike ? CHANGE_NUMBER_LABEL : LOOKUP_ANOTHER_LABEL}
      </Button>
    );
  const carrierLabel =
    settled?.view?.carrier.barLabel ??
    (activeRequest === null ? "" : requestCarrierView(activeRequest, lookupConfig.copy.carrierAuto).barLabel);

  return (
    <>
      <section
        id="tracking"
        aria-labelledby={HEADING_ID}
        data-view-state={viewMode}
        data-ad-exclude="true"
        className="flex flex-col gap-4 pb-6"
      >
        <h1
          id={HEADING_ID}
          className={
            display.kind === "form"
              ? "m-0 px-[var(--tt-gutter)] pt-3 text-tt-xl font-black text-tt-ink [word-break:keep-all]"
              : "sr-only"
          }
        >
          {display.kind === "form" ? HOME_HEADING : RESULT_HEADING}
        </h1>
        {display.kind === "form" ? (
          <LookupForm
            value={inputValue}
            carrier={carrier}
            busy={display.busy}
            invalid={
              display.invalid === null
                ? null
                : { message: stateGuide.invalidNumber.title, diagnosis: display.invalid.diagnosis, attempt: display.invalid.attempt }
            }
            inputRef={inputRef}
            onValueChange={setInputValue}
            onCarrierChange={setCarrier}
            onSubmit={handleSubmit}
          />
        ) : (
          <NumberBar number={numberViewOf(display.request.number)} carrierLabel={carrierLabel} actions={numberBarAction} />
        )}
        {display.kind === "form" && display.invalid !== null ? <FailureFallback guideKey="invalidNumber" /> : null}
        {display.kind === "form" ? null : (
          <div aria-busy={loadingLike || undefined} className={loadingLike ? "min-h-[560px]" : undefined}>
            {display.kind === "pending" ? <PendingCard title={lookupConfig.copy.title} body={lookupConfig.copy.body} /> : null}
            {display.kind === "slot" && settled !== null && settled.view === null ? (
              <div className="flex flex-col gap-3 pt-2">
                <h2 ref={headingRef} tabIndex={-1} className="m-0 px-[var(--tt-gutter)] text-tt-lg font-black text-tt-ink outline-none">
                  {stateGuide.serverError.title}
                </h2>
                <FailureFallback guideKey="serverError" />
              </div>
            ) : null}
            {display.kind === "slot" && (settled === null || settled.view !== null) ? (
              <LegacyResultSection
                state={state}
                loading={loading}
                view={settled?.view ?? null}
                onAction={handleAction}
                headingRef={headingRef}
              />
            ) : null}
          </div>
        )}
      </section>
      {viewMode === "idle" ? idleExtras : null}
      <StoreContactPopup visible={viewMode === "idle"} />
    </>
  );
}
```

Notes for the implementer:
- `beginLookup` only calls stable functions (`markRestoreConsumed`, `saveRestoreEntry`, S04's `submit`) and no local `setState`, so calling it from the auto-start effect does not trip `react-hooks/set-state-in-effect`.
- `StoreContactPopup` stays mounted exactly as the legacy page mounted it (idle only) until Task 7 removes it or Task 7F collapses it.
- If `npx eslint components/lookup/LookupController.tsx` reports `react-hooks/refs` for `handleSubmit` (a ref read inside a callback the compiler cannot prove is an event handler), move the `inputRef.current?.focus()` line into the focus effect by setting `focusInputRef.current = true` instead; behavior is identical.

- [ ] **Step 12 (only if Task 0 Step 10 found the same-address entry): port it**

Skip this step when Task 0 Step 10 recorded "not shipped".

(a) Append to `components/lookup/session.ts`:

```ts

/**
 * Same-address history entry (spec §3 뒤로가기; S02 Task 11 shipped it because the local-router regression passed):
 * after a manual lookup settles on '/', '/' is pushed once more so Back returns to the lookup form.
 */
export const LOOKUP_HISTORY_MARK = "ttLookup";

export function isLookupHistoryEntry(state: unknown): boolean {
  return typeof state === "object" && state !== null && LOOKUP_HISTORY_MARK in state;
}

export function pushLookupHistoryEntry(): void {
  const { pathname, search, hash } = window.location;
  if (pathname !== "/" || search !== "" || hash !== "") return;
  if (isLookupHistoryEntry(window.history.state)) return;
  window.history.pushState({ [LOOKUP_HISTORY_MARK]: true }, "", "/");
}
```

(b) In `components/lookup/LookupController.tsx`:
1. Replace `import { getRestoreSnapshot, getServerRestoreSnapshot, markRestoreConsumed, subscribeToNothing } from "@/components/lookup/session";` with
   `import { getRestoreSnapshot, getServerRestoreSnapshot, isLookupHistoryEntry, markRestoreConsumed, pushLookupHistoryEntry, subscribeToNothing } from "@/components/lookup/session";`
   and add `import type { LookupState } from "@/lib/tracking/lookup-state";` below the `@/lib/config/types` import.
2. Directly above `function initialInvalid`, add:
   ```ts
   /** The last settled screen, replayed by Forward without a new lookup. */
   interface ReplayFrame {
     readonly state: Extract<LookupState, { readonly phase: "settled" | "error" }>;
     readonly derived: DerivedView;
   }
   ```
3. Below `const announcedLoadingRef = useRef<string | null>(null);` add:
   ```ts
   const manualPendingRef = useRef(false);
   const lastShownRef = useRef<ReplayFrame | null>(null);
   ```
   and below `const [derived, setDerived] = useState<DerivedView | null>(null);` add:
   ```ts
   const [replay, setReplay] = useState<ReplayFrame | null>(null);
   ```
4. Replace
   ```ts
   const display = computeDisplay({ state, loading, entry, formOpen, localInvalid, derived });
   ```
   with
   ```ts
   const replaying = replay !== null && state.phase === "idle";
   const shownState: LookupState = replaying ? replay.state : state;
   const display = computeDisplay({ state: shownState, loading, entry, formOpen, localInvalid, derived: replaying ? replay.derived : derived });
   ```
   and in the JSX replace `state={state}` on `LegacyResultSection` with `state={shownState}`.
5. In `beginLookup`, directly after `markRestoreConsumed();` add `manualPendingRef.current = request.entry === "manual";`.
6. In the settle effect, directly after `handledSeqRef.current = settled.seq;` add:
   ```ts
   if (!replaying && (state.phase === "settled" || state.phase === "error")) lastShownRef.current = { state, derived: settled };
   if (manualPendingRef.current) {
     manualPendingRef.current = false;
     pushLookupHistoryEntry();
   }
   ```
   and change that effect's dependency list to `[announce, replaying, settled, settledEntry, state]`.
7. In `handleSubmit` and in `openForm`, add `setReplay(null);` as the first statement.
8. Below the interaction effect, add:
   ```ts
   useEffect(() => {
     const onPopState = (event: PopStateEvent): void => {
       if (window.location.pathname !== "/") return;
       if (isLookupHistoryEntry(event.state)) {
         setReplay(lastShownRef.current);
         return;
       }
       const last = lastShownRef.current;
       setReplay(null);
       reset();
       if (last !== null) {
         setInputValue(last.state.outcome.request.number);
         setCarrier(last.state.outcome.request.carrier);
       }
       setLocalInvalid(null);
       setFormOpen(true);
     };
     window.addEventListener("popstate", onPopState);
     return () => window.removeEventListener("popstate", onPopState);
   }, [reset]);
   ```
Check: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/url-privacy.spec.ts -g "same-address history entry"` runs in Step 15.

- [ ] **Step 13: Create the shell and switch both pages to it**

Create `components/shell/TrackingPage.tsx`:

```tsx
import { LookupController } from "@/components/lookup/LookupController";
import { StorefrontShowcase } from "@/components/StorefrontShowcase";
import type { TrackingEntry } from "@/lib/tracking/types";

/**
 * Server shell of '/' and '/{번호}' (spec §3 "두 라우트는 같은 서버 셸", §14). The only client island is LookupController.
 * `entry`: home; a valid deep link (painted as the number bar + '조회하고 있어요'); an INVALID deep link (the form with
 * the error, no API call).
 */
export function TrackingPage({ entry }: { readonly entry: TrackingEntry }): React.JSX.Element {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-[var(--tt-column)] bg-tt-surface text-tt-ink outline-none"
    >
      <LookupController entry={entry} homeNotice={null} idleExtras={<IdleExtras />} />
    </main>
  );
}

/** Below the first view, idle mode only (spec §4 "첫 화면 아래"). S08 replaces the legacy showcase with StoreShowcase. */
function IdleExtras(): React.JSX.Element {
  return (
    <div className="tt-legacy-dark px-4 py-6">
      <StorefrontShowcase />
    </div>
  );
}
```

Replace the whole content of `app/(public)/page.tsx` with:

```tsx
import { TrackingPage } from "@/components/shell/TrackingPage";

// Static: never reads the query (legacy links are redirected by next.config.ts). Re-rendered at most every 5 minutes
// so notice windows in config/site.config.ts switch on and off without a deploy (spec §3).
export const revalidate = 300;

export default function HomePage() {
  return <TrackingPage entry={{ kind: "home" }} />;
}
```

Replace the whole content of `app/(public)/[trackingNumber]/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { stateGuide } from "@/config/site.config";
import { TrackingPage } from "@/components/shell/TrackingPage";
import { classifyDeepLink, parseCarrierParam } from "@/lib/tracking/number-input";
import type { TrackingEntry } from "@/lib/tracking/types";

type TrackingPathPageProps = {
  readonly params: Promise<{ readonly trackingNumber: string }>;
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
};

const TITLE_SUFFIX = " · 배송 조회";

/** Next may hand over the raw segment; a malformed escape is kept as literal text and then fails the shape check. */
function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params }: TrackingPathPageProps): Promise<Metadata> {
  const { trackingNumber } = await params;
  const decision = classifyDeepLink(decodeSegment(trackingNumber));
  const docTitle = decision.kind === "invalid" ? stateGuide.invalidNumber.docTitle : stateGuide.loading.docTitle;
  return { title: `${docTitle}${TITLE_SUFFIX}`, robots: { index: false, follow: false } };
}

/**
 * '/{번호}' (spec §3): valid → the shell with the number bar and '조회하고 있어요' in the server HTML; alphanumeric 6–30
 * but not a number → the INVALID screen, no API call; anything else (a dot, Hangul, 31+ characters) → a real 404.
 * `?c=` carries the carrier. The document title never contains the number; X-Robots-Tag comes from next.config (S01).
 */
export default async function TrackingPathPage({ params, searchParams }: TrackingPathPageProps) {
  const [{ trackingNumber }, query] = await Promise.all([params, searchParams]);
  const decision = classifyDeepLink(decodeSegment(trackingNumber));
  if (decision.kind === "notFound") notFound();
  const entry: TrackingEntry =
    decision.kind === "valid"
      ? { kind: "deepLink", number: decision.number, carrier: parseCarrierParam(query.c) }
      : { kind: "invalidDeepLink", input: decision.input };
  return <TrackingPage entry={entry} />;
}
```

- [ ] **Step 14: Delete the replaced components**

Run: `git rm components/HomePageClient.tsx components/TrackingForm.tsx components/LogisticsFlow.tsx components/AssuranceRail.tsx components/ServiceGuide.tsx`
Check: `git grep -n -e "HomePageClient" -e "TrackingForm" -e "LogisticsFlow" -e "AssuranceRail" -e "ServiceGuide" -- app components lib` → no output.
Run: `if (Test-Path .next) { Remove-Item -Recurse -Force .next }; npm run typecheck`
Expected: exit 0.

- [ ] **Step 15: Run the new tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/deep-link.spec.ts tests/e2e/lookup-input.spec.ts tests/e2e/home.spec.ts`
Expected: deep-link `15 passed, 1 skipped` (the production-only cache test), lookup-input `8 passed`, home `12 passed`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/lookup-display.spec.ts tests/unit/module-boundaries.spec.ts tests/unit/number-input.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all pass. If `module-boundaries.spec.ts` names `components/lookup/LegacyResultSection.tsx → …` through a file under `components/status-slot/` (S04's slot reaches zod, `lib/delivery-carriers.ts` or derive code statically), load the slot lazily instead: in `LegacyResultSection.tsx` replace `import { StatusSlot, type StatusSlotProps } from "@/components/status-slot/StatusSlot";` with
```tsx
import dynamic from "next/dynamic";
import type { StatusSlotProps } from "@/components/status-slot/StatusSlot";

const StatusSlot = dynamic(() => import("@/components/status-slot/StatusSlot").then((module) => module.StatusSlot), { ssr: false });
```
and run both commands again (the slot renders only after a lookup starts, so nothing painted by the server changes).

- [ ] **Step 16: Remove the migrated legacy tests and record the migration**

In `tests/tracking.spec.ts` delete, each from its first line through its closing `});` (for the loop: through the loop's closing `}`):
1. the test starting `test("home uses customer language without brand, robot, or AI copy", async ({ page }) => {`;
2. S01's `const FORMAT_HINT =` declaration and the test starting `test("the lookup form shows the format hint instead of example numbers", async ({ page }) => {`;
3. the test starting `test("semantic motion is finite and honors reduced-motion", async ({ page }) => {`;
4. the loop starting `for (const viewport of [` that creates `${viewport.name} layout keeps motion inside the viewport`.

Check: `Select-String -LiteralPath tests/tracking.spec.ts -Pattern "home uses customer language|format hint instead|semantic motion is finite|layout keeps motion inside" ` → no output.
In `tests/e2e/RULE-MAP.md` set the Status of rows H1, F1, L1 and L2 to `migrated (Task 5)` and of row M1 to `migrated (Task 5); budget pending (Task 9)`.

- [ ] **Step 17: Run the whole suite, lint and build**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test`
Expected: 0 failed — in particular S02's `url-privacy`, `session-restore`, `return-link`, `legacy-query-redirect`, S04's `status-slot`, `loading-timeline`, `failure-causes`, `cta-consistency`, S01's `seo-routes` and `internal-isolation`, and the remaining `tests/tracking.spec.ts` tests (C1, P1, S1 and the R rows) pass unchanged.
Run: `npm run lint; npm run typecheck`
Expected: both exit 0.
Run: `npm run build`
Expected: exit 0; the route table shows `○ /` with a revalidate time of `5m` and `ƒ /[trackingNumber]`.

- [ ] **Step 18: Commit**

Run:
```powershell
git add components/lookup components/shell/TrackingPage.tsx "app/(public)/page.tsx" "app/(public)/[trackingNumber]/page.tsx" tests/unit/lookup-display.spec.ts tests/e2e/deep-link.spec.ts tests/e2e/lookup-input.spec.ts tests/e2e/home.spec.ts tests/e2e/RULE-MAP.md tests/tracking.spec.ts
git add -u components
git commit -m "feat: serve / and /{number} from one tracking shell with the lookup island"
```
Expected: one commit; `git status --short` is clean.

---

### Task 6: Input assist — paste parsing with [되돌리기] and the O↔0 / I↔1 question

**Files:**
- Create: `components/lookup/InputAssist.tsx`
- Modify: `components/lookup/LookupForm.tsx` (props, `aria-describedby`, `onPaste`, assist slot)
- Modify: `components/lookup/LookupController.tsx` (imports, paste state and handlers, props passed to `LookupForm`)
- Test: `tests/e2e/lookup-input.spec.ts` (append)

**Interfaces:**
- Consumes: Task 1 `detectConfusables`, `normalizeInput`, `precheckNumber`; Task 2 `extractFromPastedText`, `pasteCarrierNotice`; `CARRIER_NAMES` (S03); `useAnnounce` (S04); `Button` (S05).
- Produces: `InputAssist(props: { readonly confusable: ConfusableHint; readonly pastedCarrierName: string | null; readonly onUndo: () => void }): React.JSX.Element | null` and `INPUT_ASSIST_ID = "tracking-input-assist"`; `LookupFormProps` gains `assist: React.ReactNode`, `assistVisible: boolean`, `onPaste: (event: React.ClipboardEvent<HTMLInputElement>) => void`. Behavior: pasting a notification with exactly one number sets the number and the carrier it names and says '택배사를 {이름}으로/로 맞췄어요' with [되돌리기] (also announced once); pasting anything else is left to the browser; while the typed value becomes valid only with O→0 or I/l→1, the question '영문 O가 섞여 있어요. 숫자 0인가요?' shows under the input before submitting.

- [ ] **Step 1: Write the failing tests**

Append to `tests/e2e/lookup-input.spec.ts`:

```ts
const NOTIFICATION = [
  "[CJ대한통운] 고객님의 상품이 발송되었습니다.",
  `운송장번호 ${FAKE_GROUPED.domestic.replaceAll(" ", "-")}`,
  `배송 문의 ${FAKE.phone}`
].join("\n");
/** An order number shaped like Naver's 16-digit ones; fixture-safe (starts with 0000). */
const ORDER_NUMBER = `0000${"0".repeat(11)}1`;

async function pasteText(page: Page, text: string): Promise<void> {
  await page.evaluate((value) => navigator.clipboard.writeText(value), text);
  await trackingInput(page).focus();
  await page.keyboard.press("ControlOrMeta+V");
}

test.describe("input assist (S06)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL ?? "http://127.0.0.1:43210" });
  });

  test("typing a letter O where a zero belongs shows the question before submitting", async ({ page }) => {
    const bodies = await recordTrack(page);
    await page.goto("/");
    await trackingInput(page).fill(FAKE.invalidConfusable);
    await expect(page.locator("#tracking-input-assist")).toHaveText("영문 O가 섞여 있어요. 숫자 0인가요?");
    const describedBy = (await trackingInput(page).getAttribute("aria-describedby")) ?? "";
    expect(describedBy.split(" ")).toContain("tracking-input-assist");
    await expect(page.locator('[data-lookup-form="true"]').getByRole("alert")).toHaveCount(0);
    expect(bodies).toEqual([]);
  });

  test("a submitted confusable number names the value and the likely fix", async ({ page }) => {
    const bodies = await recordTrack(page);
    await page.goto("/");
    await trackingInput(page).fill(FAKE.invalidConfusable);
    await trackingInput(page).press("Enter");
    const error = page.locator('[data-guide-key="invalidNumber"]');
    await expect(error.getByRole("alert")).toHaveText(stateGuide.invalidNumber.title);
    await expect(error).toContainText(`입력하신 값: ${FAKE.invalidConfusable} → 영문 O가 섞여 있어요. 숫자 0인가요?`);
    await expect(page.locator("#tracking-input-assist")).toHaveCount(0);
    await waitForIdle(page);
    expect(bodies).toEqual([]);
  });

  test("a pasted notification sets the number and the carrier, and 되돌리기 restores the carrier", async ({ page }) => {
    await page.goto("/");
    await pasteText(page, NOTIFICATION);
    await expect(trackingInput(page)).toHaveValue(FAKE.domestic);
    const carrier = page.getByRole("combobox", { name: "국내 택배사" });
    await expect(carrier).toHaveValue("CJ");
    const assist = page.locator("#tracking-input-assist");
    await expect(assist).toContainText("택배사를 CJ대한통운으로 맞췄어요");
    await expect(page.locator('[data-live-region="polite"]')).toHaveText("택배사를 CJ대한통운으로 맞췄어요");
    await assist.getByRole("button", { name: "되돌리기" }).click();
    await expect(carrier).toHaveValue("AUTO");
    await expect(assist).toHaveCount(0);
    await expect(trackingInput(page)).toBeFocused();
  });

  test("a pasted text with two number candidates is left for the customer to edit", async ({ page }) => {
    await page.goto("/");
    const text = `주문번호 ${ORDER_NUMBER} 운송장 ${FAKE.domestic}`;
    await pasteText(page, text);
    await expect(trackingInput(page)).toHaveValue(text);
    await expect(page.getByRole("combobox", { name: "국내 택배사" })).toHaveValue("AUTO");
    await expect(page.locator("#tracking-input-assist")).toHaveCount(0);
  });

  test("pasting a bare number just pastes it", async ({ page }) => {
    await page.goto("/");
    await pasteText(page, FAKE_GROUPED.domestic);
    await expect(trackingInput(page)).toHaveValue(FAKE_GROUPED.domestic);
    await expect(page.locator("#tracking-input-assist")).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/lookup-input.spec.ts -g "input assist"`
Expected: FAIL — `2 failed, 3 passed`: "typing a letter O…" (`#tracking-input-assist` not found) and "a pasted notification…" (`toHaveValue` receives the whole pasted notification). The other three already pass — Task 5's pre-check shows the diagnosis, and the browser's default paste is what they expect — and keep guarding that the assist hides once the error shows and that ambiguous text is never rewritten.

- [ ] **Step 3: Create `components/lookup/InputAssist.tsx`**

```tsx
"use client";

import { Button } from "@/components/primitives/Button";
import { pasteCarrierNotice, type ConfusableHint } from "@/lib/tracking/number-input";

export const INPUT_ASSIST_ID = "tracking-input-assist";
const UNDO_LABEL = "되돌리기";

/**
 * Help right under the input (spec §4): the paste notice '택배사를 CJ대한통운으로 맞췄어요' with [되돌리기], and the
 * question asked before submitting when a letter O, I or l probably meant a digit (WCAG 3.3.3). Referenced by the
 * input's aria-describedby while it is shown; never a live region itself.
 */
export function InputAssist({
  confusable,
  pastedCarrierName,
  onUndo
}: {
  readonly confusable: ConfusableHint;
  readonly pastedCarrierName: string | null;
  readonly onUndo: () => void;
}): React.JSX.Element | null {
  if (confusable === null && pastedCarrierName === null) return null;
  return (
    <div id={INPUT_ASSIST_ID} className="mt-1.5 flex flex-col gap-0.5 text-tt-sm text-tt-ink">
      {pastedCarrierName === null ? null : (
        <p className="m-0 flex flex-wrap items-center gap-x-2 [word-break:keep-all]">
          <span>{pasteCarrierNotice(pastedCarrierName)}</span>
          <Button variant="text" onClick={onUndo}>
            {UNDO_LABEL}
          </Button>
        </p>
      )}
      {confusable === null ? null : (
        <p className="m-0 font-bold text-tt-attention-ink [word-break:keep-all]">{confusable.message}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Give `LookupForm` the assist slot and the paste handler**

In `components/lookup/LookupForm.tsx`:
1. Below `import { FormatHint } from "@/components/lookup/FormatHint";` add `import { INPUT_ASSIST_ID } from "@/components/lookup/InputAssist";`.
2. In `interface LookupFormProps`, directly after `readonly onSubmit: () => void;` add:
   ```ts
     /** Rendered right under the input (Task 6: paste notice, confusable question). */
     readonly assist: React.ReactNode;
     /** True while `assist` renders something; adds its id to aria-describedby. */
     readonly assistVisible: boolean;
     readonly onPaste: (event: React.ClipboardEvent<HTMLInputElement>) => void;
   ```
3. In the parameter list, replace `  onSubmit\n}: LookupFormProps)` with `  onSubmit,\n  assist,\n  assistVisible,\n  onPaste\n}: LookupFormProps)`.
4. Replace
   ```ts
   const describedBy = [FORMAT_HINT_ID, invalid ? ERROR_ID : null, invalid?.diagnosis ? DIAGNOSIS_ID : null]
   ```
   with
   ```ts
   const describedBy = [FORMAT_HINT_ID, assistVisible ? INPUT_ASSIST_ID : null, invalid ? ERROR_ID : null, invalid?.diagnosis ? DIAGNOSIS_ID : null]
   ```
5. On the `<input>`, directly after `onChange={(event) => onValueChange(event.target.value)}` add `onPaste={onPaste}`.
6. Directly after the `<input … />` element (before `{invalid ? (`), add `{assist}`.

- [ ] **Step 5: Wire paste and the confusable question in `LookupController`**

In `components/lookup/LookupController.tsx`:
1. Below `import { FailureFallback } from "@/components/lookup/FailureFallback";` add `import { InputAssist } from "@/components/lookup/InputAssist";`.
2. Replace `import { requestCarrierView } from "@/lib/tracking/carriers";` with `import { CARRIER_NAMES, requestCarrierView } from "@/lib/tracking/carriers";`.
3. Replace `import { precheckNumber } from "@/lib/tracking/number-input";` with
   ```ts
   import { detectConfusables, extractFromPastedText, normalizeInput, pasteCarrierNotice, precheckNumber } from "@/lib/tracking/number-input";
   ```
4. Directly below `const [derived, setDerived] = useState<DerivedView | null>(null);` add:
   ```ts
   const [pasted, setPasted] = useState<{ readonly carrierName: string; readonly previous: DeliveryCarrierCode } | null>(null);
   ```
5. Directly below the `handleSubmit` callback add:
   ```ts
   const handlePaste = useCallback(
     (event: React.ClipboardEvent<HTMLInputElement>) => {
       const text = event.clipboardData.getData("text");
       if (text === "" || precheckNumber(text).ok) return; // a bare number: the browser pastes it
       const extraction = extractFromPastedText(text);
       if (extraction === null) return; // zero or several candidates: the customer edits the text (Review Focus 1)
       event.preventDefault();
       setInputValue(extraction.number);
       setLocalInvalid(null);
       if (extraction.carrier === null || extraction.carrier === carrier) {
         setPasted(null);
         return;
       }
       const carrierName = CARRIER_NAMES[extraction.carrier];
       setPasted({ carrierName, previous: carrier });
       setCarrier(extraction.carrier);
       announce(pasteCarrierNotice(carrierName));
     },
     [announce, carrier]
   );

   const handleUndoPaste = useCallback(() => {
     if (pasted !== null) setCarrier(pasted.previous);
     setPasted(null);
     inputRef.current?.focus(); // the [되돌리기] button disappears; keep the keyboard in the form
   }, [pasted]);

   const handleCarrierChange = useCallback((next: DeliveryCarrierCode) => {
     setCarrier(next);
     setPasted(null);
   }, []);
   ```
6. In `handleSubmit` and in `openForm`, add `setPasted(null);` as the first statement of the callback body.
7. Directly above `const numberBarAction =` add:
   ```ts
   // The question is asked before submitting; once the pre-check error shows, the diagnosis carries it instead.
   const confusable = display.kind === "form" && display.invalid === null ? detectConfusables(normalizeInput(inputValue)) : null;
   ```
8. In the `<LookupForm` element, replace `onCarrierChange={setCarrier}` with `onCarrierChange={handleCarrierChange}` and add, directly after `onSubmit={handleSubmit}`:
   ```tsx
   assist={<InputAssist confusable={confusable} pastedCarrierName={pasted?.carrierName ?? null} onUndo={handleUndoPaste} />}
   assistVisible={confusable !== null || pasted !== null}
   onPaste={handlePaste}
   ```

- [ ] **Step 6: Run the tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/lookup-input.spec.ts tests/e2e/home.spec.ts tests/e2e/deep-link.spec.ts`
Expected: lookup-input `13 passed`, home `12 passed`, deep-link `15 passed, 1 skipped`.
Run: `npm run typecheck; npx eslint components/lookup tests/e2e/lookup-input.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 7: Commit**

Run: `git add components/lookup/InputAssist.tsx components/lookup/LookupForm.tsx components/lookup/LookupController.tsx tests/e2e/lookup-input.spec.ts; git commit -m "feat: read pasted notifications and ask about O/0 and I/1 before submitting"`

---

### Task 7 (gated by approval 1): The inline 상담·스토어 바로가기 row replaces the popup

**Files:**
- Create: `components/lookup/ShortcutRow.tsx`
- Modify: `components/lookup/LookupController.tsx` (render the row; drop the popup)
- Delete: `components/StoreContactPopup.tsx`
- Modify: `tests/e2e/home.spec.ts` (import line; append), `tests/tracking.spec.ts` (remove P1; remove the popup steps of S1 and O1), `tests/e2e/RULE-MAP.md`
- Test: `tests/e2e/home.spec.ts`

**Interfaces:**
- Consumes: `channels`, `disclosures` (S03 config); `buttonClassName` (S05 Addition 2); `FailureFallback` (Task 5).
- Produces: `ShortcutRow(props: { readonly mode: "full" | "talkOnly" }): React.JSX.Element` — `<section aria-label="상담·스토어 바로가기" data-shortcut-row={mode}>`; `full`: `<p data-affiliate-disclosure="coupang">` first when a store link is affiliate, then three 44 px outline links '톡톡 상담', '네이버 스토어', '쿠팡 스토어' (`data-link-placement="shortcut"`, new tab, `rel` from `isAffiliate`); `talkOnly`: the INVALID error CTA block (`FailureFallback`) inside the region. Rendered under the form in idle (`full`) and INVALID (`talkOnly`) modes; absent while the button is busy and in every number-bar mode.

- [ ] **Step 1: Confirm approval 1**

Open roadmap §4 row 1. If its Status is not `approved`, stop this task, write "Task 7 SKIPPED: approval 1 is `<status>`" into the stage summary and run Task 7F. Spec §16 item 1 "거절하면": the popup stays but starts collapsed and never overlaps the lookup panel, and an occlusion test guards it.

- [ ] **Step 2: Write the failing tests**

If Task 7F ran earlier in this stage (approval 1 arrived later and this task runs as a follow-up), first delete from `tests/e2e/home.spec.ts` the constants `NO_NOTICE_TIME` and `REOPEN` and the whole `test.describe("상담·스토어 popup, collapsed (S06, approval-1 fallback)", …)` block, and in `tests/e2e/RULE-MAP.md` note "7F fallback replaced by Task 7" on rows P1, S1 and O1.

In `tests/e2e/home.spec.ts` replace `import { channels } from "@/config/site.config";` with `import { channels, disclosures } from "@/config/site.config";` and append:

```ts
/** Outside every shipped notice window, so no banner changes the first-view geometry (spec §16 item 1 relaxes it on notice days). */
const NO_NOTICE_TIME = new Date("2026-11-18T10:00:00+09:00");
const SHORTCUT_REGION = { name: "상담·스토어 바로가기" } as const;

test.describe("상담·스토어 바로가기 row (S06, approval 1)", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(NO_NOTICE_TIME);
  });

  test("the row is in the first view at 390×844, 375×812 and 360×780 and nothing covers the lookup button or the row", async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 375, height: 812 },
      { width: 360, height: 780 }
    ]) {
      const size = `${viewport.width}×${viewport.height}`;
      await page.setViewportSize(viewport);
      await page.goto("/");
      const row = page.getByRole("region", SHORTCUT_REGION);
      await expect(row, size).toHaveAttribute("data-shortcut-row", "full");
      await expect(row, size).toBeInViewport({ ratio: 1 });
      await page.getByRole("button", { name: "조회하기" }).click({ trial: true });
      for (const name of ["톡톡 상담", "네이버 스토어", "쿠팡 스토어"]) {
        await row.getByRole("link", { name: `${name} 새 창으로 열기` }).click({ trial: true });
      }
    }
  });

  test("the row ends by 550 px at 375×667 (about 500 px at 375×812)", async ({ page }) => {
    for (const viewport of [
      { width: 375, height: 667 },
      { width: 375, height: 812 }
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      const box = await page.getByRole("region", SHORTCUT_REGION).boundingBox();
      const bottom = Math.round((box?.y ?? 0) + (box?.height ?? Number.POSITIVE_INFINITY));
      console.info(`[geometry] shortcut row bottom at ${viewport.width}x${viewport.height}: ${bottom} px (max 550 px)`);
      expect(bottom).toBeLessThanOrEqual(550);
    }
  });

  test("the definitive disclosure comes before the coupang link, and only affiliate links are sponsored", async ({ page }) => {
    await page.goto("/");
    const row = page.getByRole("region", SHORTCUT_REGION);
    await expect(row.locator("p, a").first()).toHaveAttribute("data-affiliate-disclosure", "coupang");
    await expect(row.locator('[data-affiliate-disclosure="coupang"]')).toHaveText(disclosures.coupang);
    const relFor = (isAffiliate: boolean): string => (isAffiliate ? "sponsored nofollow noopener noreferrer" : "noopener noreferrer");
    const links = [
      { name: "톡톡 상담", href: channels.talk.url, rel: relFor(false) },
      { name: "네이버 스토어", href: channels.naver.urls.shortcut, rel: relFor(channels.naver.isAffiliate) },
      { name: "쿠팡 스토어", href: channels.coupang.urls.shortcut, rel: relFor(channels.coupang.isAffiliate) }
    ];
    for (const link of links) {
      const anchor = row.getByRole("link", { name: `${link.name} 새 창으로 열기` });
      await expect(anchor, link.name).toHaveAttribute("href", link.href);
      await expect(anchor, link.name).toHaveAttribute("rel", link.rel);
      await expect(anchor, link.name).toHaveAttribute("target", "_blank");
      await expect(anchor, link.name).toHaveAttribute("data-link-placement", "shortcut");
      expect((await anchor.boundingBox())?.height ?? 0, link.name).toBeGreaterThanOrEqual(44);
    }
  });

  test("only 톡톡 stays while the number is invalid; the row is gone in loading and results", async ({ page }) => {
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }), { delayMs: 1500 });
    await page.goto("/");
    const input = page.getByRole("textbox", { name: INPUT_LABEL, exact: true });
    await input.fill(FAKE.invalidShort);
    await input.press("Enter");
    const row = page.getByRole("region", SHORTCUT_REGION);
    await expect(row).toHaveAttribute("data-shortcut-row", "talkOnly");
    await expect(row.getByRole("link")).toHaveCount(1);
    await expect(row.getByRole("link").first()).toHaveAccessibleName(`${channels.talk.labels.cta} 새 창으로 열기`);
    await expect(row.locator("[data-affiliate-disclosure]")).toHaveCount(0);
    await input.fill(FAKE.domestic);
    await input.press("Enter");
    await expect(page.locator('[data-number-bar="true"]')).toBeVisible();
    await expect(page.locator("[data-shortcut-row]")).toHaveCount(0);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expect(page.locator("[data-shortcut-row]")).toHaveCount(0);
  });

  test("no dialog opens by itself", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1500);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/home.spec.ts -g "바로가기 row"`
Expected: FAIL — `5 failed`: the region '상담·스토어 바로가기' does not exist (the first four), and the legacy popup is an open dialog (`toHaveCount(0)` received `1`).

- [ ] **Step 4: Create `components/lookup/ShortcutRow.tsx`**

```tsx
import { channels, disclosures } from "@/config/site.config";
import { FailureFallback } from "@/components/lookup/FailureFallback";
import { buttonClassName } from "@/components/primitives/Button";

export const SHORTCUT_REGION_LABEL = "상담·스토어 바로가기";
const NEW_WINDOW_SUFFIX = " 새 창으로 열기";
/** The button slot's secondary look (44 px outline), with the tighter padding three links need in one row at 360 px. */
const LINK_CLASS = buttonClassName("secondary", "md", "!px-1 !text-tt-sm");

function TalkBubbleIcon(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className="shrink-0"
    >
      <path d="M4 5h16v11H10l-6 4z" />
    </svg>
  );
}

function ShortcutLink({
  href,
  label,
  sponsored,
  icon
}: {
  readonly href: string;
  readonly label: string;
  readonly sponsored: boolean;
  readonly icon: React.ReactNode;
}): React.JSX.Element {
  return (
    <a
      href={href}
      target="_blank"
      rel={sponsored ? "sponsored nofollow noopener noreferrer" : "noopener noreferrer"}
      aria-label={`${label}${NEW_WINDOW_SUFFIX}`}
      data-slot="button"
      data-variant="secondary"
      data-size="md"
      data-link-placement="shortcut"
      className={LINK_CLASS}
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}

/**
 * Region '상담·스토어 바로가기' right under [조회하기] (spec §4, approval 1): the definitive disclosure first, then
 * [톡톡 상담][네이버 스토어][쿠팡 스토어] as 44 px outlines, lighter than the one filled button. `isAffiliate` alone decides
 * the disclosure and rel="sponsored nofollow" (spec §8). While the number is invalid only 톡톡 stays — as the error CTA
 * block, so the screen keeps one 톡톡 place besides the header and the footer (spec §8 "화면당 최대 3곳").
 */
export function ShortcutRow({ mode }: { readonly mode: "full" | "talkOnly" }): React.JSX.Element {
  if (mode === "talkOnly") {
    return (
      <section aria-label={SHORTCUT_REGION_LABEL} data-shortcut-row="talkOnly">
        <FailureFallback guideKey="invalidNumber" />
      </section>
    );
  }
  const stores = [channels.naver, channels.coupang];
  const hasAffiliate = stores.some((store) => store.isAffiliate);
  return (
    <section aria-label={SHORTCUT_REGION_LABEL} data-shortcut-row="full" className="flex flex-col gap-2 px-[var(--tt-gutter)]">
      {hasAffiliate ? <p data-affiliate-disclosure="coupang">{disclosures.coupang}</p> : null}
      <div className="grid grid-cols-3 gap-2">
        <ShortcutLink href={channels.talk.url} label={channels.talk.labels.shortcut} sponsored={false} icon={<TalkBubbleIcon />} />
        {stores.map((store) => (
          <ShortcutLink key={store.name} href={store.urls.shortcut} label={store.name} sponsored={store.isAffiliate} icon={null} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Render the row and remove the popup**

In `components/lookup/LookupController.tsx`:
1. Delete `import { StoreContactPopup } from "@/components/StoreContactPopup";` and the element `<StoreContactPopup visible={viewMode === "idle"} />`.
2. Below `import { PendingCard } from "@/components/lookup/PendingCard";` add `import { ShortcutRow } from "@/components/lookup/ShortcutRow";`.
3. Replace
   ```tsx
   {display.kind === "form" && display.invalid !== null ? <FailureFallback guideKey="invalidNumber" /> : null}
   ```
   with
   ```tsx
   {display.kind === "form" && !display.busy ? <ShortcutRow mode={display.invalid === null ? "full" : "talkOnly"} /> : null}
   ```
Delete the popup: `git rm components/StoreContactPopup.tsx`
Check: `git grep -n "StoreContactPopup" -- app components lib tests` → no output.

- [ ] **Step 6: Run the new tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/home.spec.ts tests/e2e/lookup-input.spec.ts`
Expected: home `17 passed`; lookup-input `13 passed`. Record both `[geometry]` lines for G8.
If the 375×667 bottom is above 550 px, the Korean system font wraps a line more than planned: shorten the vertical rhythm in this order and re-run — `pt-3` → `pt-2` on the home `h1`, `gap-4` → `gap-3` on the lookup `section`, `mt-3` → `mt-2` on the submit button — and note the change in the stage summary.

- [ ] **Step 7: Remove the replaced legacy assertions**

In `tests/tracking.spec.ts`:
1. Delete the test starting `test("mobile first view exposes consultation and store shortcuts", async ({ page }) => {` through its closing `});`.
2. In the test "home offers transparent storefront choices without interrupting tracking", delete the line `await expect(page.getByRole("dialog", { name: "문의와 상품 확인을 바로 시작하세요" })).toBeVisible();`.
3. In the test "an overdue customs estimate is recalculated and remains readable on mobile", delete the line `await page.getByRole("dialog", { name: "상담·스토어 바로가기" }).getByRole("button", { name: "상담과 스토어 팝업 닫기" }).click();`.
Check: `Select-String -LiteralPath tests/tracking.spec.ts -Pattern 'getByRole\("dialog"'` → only the pending-state recommendations dialog lines ('금주의 베스트 리뷰 상품') remain.
In `tests/e2e/RULE-MAP.md` set P1 to `migrated (Task 7)`, S1 to `popup step migrated (Task 7); showcase part kept → S08`, O1 to `step removed (Task 7); test kept → S07`.

- [ ] **Step 8: Run the whole suite and commit**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test`
Expected: 0 failed.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.
Run: `git add components/lookup/ShortcutRow.tsx components/lookup/LookupController.tsx tests/e2e/home.spec.ts tests/tracking.spec.ts tests/e2e/RULE-MAP.md; git add -u components/StoreContactPopup.tsx; git commit -m "feat: replace the automatic popup with the inline consultation and store row"`

---

### Task 7F (runs only when approval 1 is not granted): Keep the popup, collapsed and out of the way

**Files:**
- Modify: `components/StoreContactPopup.tsx` (initial state)
- Modify: `tests/e2e/home.spec.ts` (append), `tests/tracking.spec.ts` (remove P1; remove the popup steps of S1 and O1), `tests/e2e/RULE-MAP.md`
- Test: `tests/e2e/home.spec.ts`

**Interfaces:**
- Consumes: the legacy `StoreContactPopup` mounted by `LookupController` in idle mode (Task 5).
- Produces: the approval-1 fallback of roadmap §4 row 1 — the popup starts collapsed (only its '상담·스토어' pill shows), never overlaps the lookup panel, and an occlusion test guards it at 1280×720 and 390×844. The INVALID screen keeps `FailureFallback` directly (no shortcut row).

- [ ] **Step 1: Confirm this is the fallback path**

Open roadmap §4 row 1. If its Status is `approved`, skip this task (Task 7 ran). Otherwise write "approval 1: `<status>` → Task 7F fallback" into the stage summary.

- [ ] **Step 2: Write the failing tests**

Append to `tests/e2e/home.spec.ts`:

```ts
const NO_NOTICE_TIME = new Date("2026-11-18T10:00:00+09:00");
const REOPEN = { name: "상담과 스토어 바로가기 다시 열기" } as const;

test.describe("상담·스토어 popup, collapsed (S06, approval-1 fallback)", () => {
  test("the collapsed 상담·스토어 button is in the first view and never covers the lookup panel", async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1280, height: 720 }
    ]) {
      const size = `${viewport.width}×${viewport.height}`;
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expect(page.getByRole("dialog"), size).toHaveCount(0);
      await expect(page.getByRole("button", REOPEN), size).toBeInViewport();
      await page.getByRole("textbox", { name: INPUT_LABEL, exact: true }).click({ trial: true });
      await page.getByRole("combobox", { name: "국내 택배사" }).click({ trial: true });
      await page.getByRole("button", { name: "조회하기" }).click({ trial: true });
    }
  });

  test("opening it shows 톡톡, 네이버 and 쿠팡 shortcuts", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", REOPEN).click();
    const popup = page.getByRole("dialog", { name: "상담·스토어 바로가기" });
    await expect(popup).toBeVisible();
    await expect(popup.getByRole("link", { name: "상담사에게 톡톡 문의하기 새 창으로 열기" })).toBeVisible();
    await expect(popup.getByRole("link", { name: "네이버 스토어 바로가기 새 창으로 열기" })).toBeVisible();
    await expect(popup.getByRole("link", { name: "쿠팡 스토어 바로가기 새 창으로 열기" })).toHaveAttribute("rel", /sponsored/);
  });

  test("the lookup button ends by 550 px at 375×667", async ({ page }) => {
    await page.clock.setFixedTime(NO_NOTICE_TIME);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    const box = await page.getByRole("button", { name: "조회하기" }).boundingBox();
    const bottom = Math.round((box?.y ?? 0) + (box?.height ?? Number.POSITIVE_INFINITY));
    console.info(`[geometry] lookup button bottom at 375x667: ${bottom} px (max 550 px)`);
    expect(bottom).toBeLessThanOrEqual(550);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/home.spec.ts -g "collapsed"`
Expected: FAIL — `1 failed, 2 passed`: the first test fails on `toHaveCount(0)` for dialogs (the popup opens by itself). The other two pass already and guard the fallback.

- [ ] **Step 4: Start the popup collapsed**

In `components/StoreContactPopup.tsx` replace

```tsx
  const [open, setOpen] = useState(true);
```

with

```tsx
  // Approval-1 fallback (spec §16 item 1 "거절하면"): collapsed by default, so it never covers the lookup panel.
  const [open, setOpen] = useState(false);
```

- [ ] **Step 5: Run the tests and replace the legacy popup assertions**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/home.spec.ts`
Expected: `15 passed`. Record the `[geometry]` line for G8.
In `tests/tracking.spec.ts`:
1. Delete the test starting `test("mobile first view exposes consultation and store shortcuts", async ({ page }) => {` through its closing `});` (its rule is now carried by the two new fallback tests).
2. In "home offers transparent storefront choices without interrupting tracking", delete the line `await expect(page.getByRole("dialog", { name: "문의와 상품 확인을 바로 시작하세요" })).toBeVisible();`.
3. In "an overdue customs estimate is recalculated and remains readable on mobile", delete the line `await page.getByRole("dialog", { name: "상담·스토어 바로가기" }).getByRole("button", { name: "상담과 스토어 팝업 닫기" }).click();`.
In `tests/e2e/RULE-MAP.md` set P1 to `migrated (Task 7F, fallback)`, S1 to `popup step migrated (Task 7F); showcase part kept → S08`, O1 to `step removed (Task 7F); test kept → S07`.

- [ ] **Step 6: Run the whole suite and commit**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test`
Expected: 0 failed.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.
Run: `git add components/StoreContactPopup.tsx tests/e2e/home.spec.ts tests/tracking.spec.ts tests/e2e/RULE-MAP.md; git commit -m "fix: start the consultation popup collapsed so it never covers the lookup form"`
When approval 1 is granted later, run Task 7 as a follow-up task of this stage (roadmap §4: a later approval re-opens only the gated task); Task 7 deletes the popup and these fallback tests' describe block.

---

### Task 8: Below the form — '보통 이렇게 걸려요', the home notice line and the noscript notice

**Files:**
- Create: `components/lookup/TypicalDurations.tsx`
- Modify: `components/shell/TrackingPage.tsx` (whole file), `components/lookup/LookupController.tsx` (notice line), `components/lookup/lookup-display.ts` (append), `components/lookup/session.ts` (append)
- Modify: `lib/config/types.ts`, `lib/config/schema.ts`, `config/site.config.ts` (`lookup.copy.noscriptNotice`, Addition 3)
- Test: `tests/unit/lookup-display.spec.ts` (append), `tests/unit/config.spec.ts` (append), `tests/e2e/home.spec.ts` (import line, append), `tests/e2e/lookup-input.spec.ts` (append)

**Interfaces:**
- Consumes: `durations`, `lookup`, `notices`, `resultCopy` (S03 config); `pickNotice`, `activeNotices`, `toNoticeView` (S03 `lib/tracking/notices.ts`); `NoticeBanner` (S05); `Notice` (S03 `lib/config/types.ts`); `NO_NOTICE_TIME` (defined in `home.spec.ts` by Task 7 or 7F).
- Produces: `TypicalDurations(): React.JSX.Element` (server-safe `<details>` with the four `durations.typical` rows); `stillActiveHomeNotice(notice: NoticeView | null, all: readonly Notice[], nowMs: number | null): NoticeView | null` (lookup-display); `getClientNowSnapshot(): number | null`, `getServerNowSnapshot(): number | null` (session); `LookupConfig.copy.noscriptNotice`. `TrackingPage` passes the server-picked `homeNotice` for the home entry, renders the noscript notice for deep-link entries, and gives idle mode the typical durations above the legacy showcase (spec §4 order).

- [ ] **Step 1: Write the failing tests**

In `tests/unit/lookup-display.spec.ts`:
1. Replace the import of `@/components/lookup/lookup-display` with
   ```ts
   import {
     computeDisplay,
     outcomeKey,
     stillActiveHomeNotice,
     viewModeOf,
     type DerivedView,
     type DisplayInput
   } from "@/components/lookup/lookup-display";
   ```
2. Below `import type { LoadingConfig } from "@/lib/config/types";` add `import type { Notice } from "@/lib/config/types";` and `import { toNoticeView } from "@/lib/tracking/notices";`.
3. Append:
   ```ts
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

   test("the home notice survives only while it is active on the customer's clock", () => {
     const view = toNoticeView(HOME_NOTICE);
     expect(stillActiveHomeNotice(view, [HOME_NOTICE], FIXTURE_NOW.getTime())).toEqual(view);
     expect(stillActiveHomeNotice(view, [HOME_NOTICE], Date.parse(HOME_NOTICE.endsAt))).toBeNull();
     expect(stillActiveHomeNotice(view, [], FIXTURE_NOW.getTime())).toBeNull();
     expect(stillActiveHomeNotice(view, [HOME_NOTICE], null)).toEqual(view);
     expect(stillActiveHomeNotice(null, [HOME_NOTICE], FIXTURE_NOW.getTime())).toBeNull();
   });
   ```

Append to `tests/unit/config.spec.ts`:

```ts
test("the noscript notice (S06) is one plain customer sentence pair", () => {
  expect(lookup.copy.noscriptNotice).toBe("자바스크립트가 꺼져 있어 조회 결과를 보여 드릴 수 없어요. 브라우저 설정에서 켠 뒤 다시 열어 주세요.");
});
```

In `tests/e2e/home.spec.ts` add `durations` and `lookup` to the `@/config/site.config` import (it becomes `import { channels, disclosures, durations, lookup } from "@/config/site.config";` after Task 7, or `import { channels, durations, lookup } from "@/config/site.config";` after Task 7F) and append:

```ts
test.describe("below the form (S06)", () => {
  test("'보통 이렇게 걸려요' opens the four typical durations from config", async ({ page }) => {
    await page.goto("/");
    const summary = page.getByText(lookup.copy.typicalSummary, { exact: true });
    const details = page.locator("details", { has: summary });
    await expect(details).not.toHaveAttribute("open");
    await summary.click();
    await expect(details).toHaveAttribute("open", "");
    await expect(details.locator("dt")).toHaveText(["해외 출발", "입항·통관", "국내 배송", "도착"]);
    await expect(details.locator("dd")).toHaveText(durations.typical.map((row) => row.text));
  });

  test("a notice that has ended by the customer's clock is gone after mount", async ({ page }) => {
    await page.clock.setFixedTime(NO_NOTICE_TIME);
    await page.goto("/");
    await expect(page.locator('[data-view-state="idle"]')).toHaveCount(1);
    await expect(page.locator("[data-notice-kind]")).toHaveCount(0);
  });
});
```

Append to `tests/e2e/lookup-input.spec.ts`:

```ts
test.describe("deep-link shell without JavaScript (S06)", () => {
  test.use({ javaScriptEnabled: false });

  test("without JavaScript the deep-link shell explains that results need JavaScript", async ({ page }) => {
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.getByText(lookup.copy.noscriptNotice, { exact: true })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/lookup-display.spec.ts tests/unit/config.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — lookup-display: the new test fails with `TypeError: … stillActiveHomeNotice is not a function`; config: the new test fails with `Expected: "자바스크립트가 …"`, `Received: undefined`.
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/home.spec.ts tests/e2e/lookup-input.spec.ts -g "below the form|without JavaScript the deep-link shell"`
Expected: FAIL — `2 failed, 1 passed`: '보통 이렇게 걸려요' does not exist yet; the noscript text is `undefined` (Playwright rejects the locator). The ended-notice test passes already (no notice renders yet) and guards the re-filter.

- [ ] **Step 3: Add `lookup.copy.noscriptNotice` to the config (Addition 3)**

In `lib/config/types.ts`, inside `LookupConfig.copy`, replace

```ts
    readonly typicalSummary: string;       // '보통 이렇게 걸려요' (S03 addition)
```

with

```ts
    readonly typicalSummary: string;       // '보통 이렇게 걸려요' (S03 addition)
    readonly noscriptNotice: string;       // S06 addition: the deep-link shell's note when JavaScript is off
```

In `lib/config/schema.ts` replace

```ts
    carrierAuto: TextSchema, typicalSummary: TextSchema
```

with

```ts
    carrierAuto: TextSchema, typicalSummary: TextSchema, noscriptNotice: TextSchema
```

In `config/site.config.ts`, inside `lookup.copy`, replace

```ts
    typicalSummary: "보통 이렇게 걸려요"
```

with

```ts
    typicalSummary: "보통 이렇게 걸려요",
    // 자바스크립트가 꺼진 브라우저에서 번호 링크를 열었을 때 번호 바 위에 보이는 안내
    noscriptNotice: "자바스크립트가 꺼져 있어 조회 결과를 보여 드릴 수 없어요. 브라우저 설정에서 켠 뒤 다시 열어 주세요."
```

Use the Grep tool with pattern `typicalSummary` on `lib/config/invariants.ts`. If it matches (S03 keeps a per-key slot table for `lookup.copy`), add `noscriptNotice: []` next to that entry.

- [ ] **Step 4: Append the notice re-filter to `components/lookup/lookup-display.ts`**

Add below the existing imports:

```ts
import type { Notice } from "@/lib/config/types";
import { activeNotices } from "@/lib/tracking/notices";
```

(and add `NoticeView` to the `@/lib/tracking/types` type import), then append at the end of the file:

```ts
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

- [ ] **Step 5: Append the client clock snapshot to `components/lookup/session.ts`**

```ts

let clientNowMs: number | null = null;

/** The customer's clock, read once per document after hydration (the home notice is re-filtered with it). */
export function getClientNowSnapshot(): number | null {
  if (clientNowMs === null) clientNowMs = Date.now();
  return clientNowMs;
}

export function getServerNowSnapshot(): number | null {
  return null;
}
```

- [ ] **Step 6: Create `components/lookup/TypicalDurations.tsx`**

```tsx
import { durations, lookup, resultCopy } from "@/config/site.config";
import type { StationId } from "@/lib/tracking/types";

const STATION_NAMES: Readonly<Record<StationId, string>> = {
  departed: resultCopy.stationDeparted,
  customs: resultCopy.stationCustoms,
  domestic: resultCopy.stationDomestic,
  arrived: resultCopy.stationArrived
};

/** '보통 이렇게 걸려요' (spec §4 "첫 화면 아래"): the four journey stations with their usual durations from config. */
export function TypicalDurations(): React.JSX.Element {
  return (
    <details className="border-b border-t-2 border-b-tt-rule border-t-tt-ink text-tt-ink">
      <summary className="tt-focus flex min-h-12 cursor-pointer items-center text-tt-md font-bold">{lookup.copy.typicalSummary}</summary>
      <dl className="m-0 grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-2 pb-4 text-tt-sm">
        {durations.typical.map((row) => (
          <div key={row.station} className="contents">
            <dt className="font-bold">{STATION_NAMES[row.station]}</dt>
            <dd className="m-0 [word-break:keep-all]">{row.text}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
```

- [ ] **Step 7: Replace `components/shell/TrackingPage.tsx`**

```tsx
import { LookupController } from "@/components/lookup/LookupController";
import { TypicalDurations } from "@/components/lookup/TypicalDurations";
import { StorefrontShowcase } from "@/components/StorefrontShowcase";
import { lookup, notices } from "@/config/site.config";
import { pickNotice, toNoticeView } from "@/lib/tracking/notices";
import type { NoticeView, TrackingEntry } from "@/lib/tracking/types";

/** The home banner of this render: '/' is static, so this runs at build time and then at most every 5 minutes. */
function currentHomeNotice(): NoticeView | null {
  const notice = pickNotice(notices, new Date(), { kind: "home" });
  return notice === null ? null : toNoticeView(notice);
}

/**
 * Server shell of '/' and '/{번호}' (spec §3 "두 라우트는 같은 서버 셸", §14). The only client island is LookupController.
 * `entry`: home; a valid deep link (painted as the number bar + '조회하고 있어요'); an INVALID deep link (the form with
 * the error, no API call). Without JavaScript a deep link says why no result appears (spec §3 noscript).
 */
export function TrackingPage({ entry }: { readonly entry: TrackingEntry }): React.JSX.Element {
  const homeNotice = entry.kind === "home" ? currentHomeNotice() : null;
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-[var(--tt-column)] bg-tt-surface text-tt-ink outline-none"
    >
      {entry.kind === "home" ? null : (
        <noscript>
          <p className="m-0 border-b border-tt-rule bg-tt-ground px-[var(--tt-gutter)] py-3 text-tt-sm font-bold text-tt-ink [word-break:keep-all]">
            {lookup.copy.noscriptNotice}
          </p>
        </noscript>
      )}
      <LookupController entry={entry} homeNotice={homeNotice} idleExtras={<IdleExtras />} />
    </main>
  );
}

/** Below the first view, idle mode only (spec §4 order): typical durations, then the showcase (S08 swaps in StoreShowcase). */
function IdleExtras(): React.JSX.Element {
  return (
    <>
      <div className="px-[var(--tt-gutter)] pb-6">
        <TypicalDurations />
      </div>
      <div className="tt-legacy-dark px-4 py-6">
        <StorefrontShowcase />
      </div>
    </>
  );
}
```

- [ ] **Step 8: Show the notice line in `LookupController`**

In `components/lookup/LookupController.tsx`:
1. Replace the `@/components/lookup/lookup-display` import so it also imports `stillActiveHomeNotice`.
2. Replace the `@/components/lookup/session` import so it also imports `getClientNowSnapshot` and `getServerNowSnapshot`.
3. Below `import { NumberBar } from "@/components/primitives/NumberBar";` add `import { NoticeBanner } from "@/components/primitives/NoticeBanner";`.
4. Replace `export function LookupController({ entry, idleExtras }: LookupControllerProps): React.JSX.Element {` with `export function LookupController({ entry, homeNotice, idleExtras }: LookupControllerProps): React.JSX.Element {`.
5. Directly below `const restoreEntry = useSyncExternalStore(subscribeToNothing, getRestoreSnapshot, getServerRestoreSnapshot);` add:
   ```ts
   const clientNowMs = useSyncExternalStore(subscribeToNothing, getClientNowSnapshot, getServerNowSnapshot);
   const notice = stillActiveHomeNotice(homeNotice, notices, clientNowMs);
   ```
6. In the returned fragment, directly before `<section`, add:
   ```tsx
   {viewMode === "idle" && notice !== null ? <NoticeBanner notice={notice} variant="banner" /> : null}
   ```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/lookup-display.spec.ts tests/unit/config.spec.ts tests/unit/module-boundaries.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all pass (`lookup-display.spec.ts` `7 passed`).
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/home.spec.ts tests/e2e/lookup-input.spec.ts tests/e2e/deep-link.spec.ts`
Expected: home `19 passed` (after Task 7) or `17 passed` (after Task 7F); lookup-input `14 passed`; deep-link `15 passed, 1 skipped`. The Task 7 geometry test still passes because the shipped notices are inactive at `NO_NOTICE_TIME`.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 10: Commit**

Run: `git add components/lookup/TypicalDurations.tsx components/shell/TrackingPage.tsx components/lookup/LookupController.tsx components/lookup/lookup-display.ts components/lookup/session.ts lib/config/types.ts lib/config/schema.ts config/site.config.ts lib/config/invariants.ts tests/unit/lookup-display.spec.ts tests/unit/config.spec.ts tests/e2e/home.spec.ts tests/e2e/lookup-input.spec.ts; git commit -m "feat: add typical durations, the re-filtered home notice and the noscript note"`
(`git add` of an unchanged `lib/config/invariants.ts` is a no-op.)

---

### Task 9: No infinite motion, no framer-motion, token body

**Files:**
- Modify: `app/globals.css` (whole file), `tailwind.config.ts` (drop `pulse-glow`), `components/TimelineStep.tsx` (whole file), `components/CustomerCta.tsx` (drop the floating variant), `app/not-found.tsx` (whole file), `app/(public)/privacy/page.tsx` (one class), `package.json`, `package-lock.json` (uninstall framer-motion)
- Delete: `components/StatusBanner.tsx`, `components/ui/badge.tsx`
- Modify: `tests/e2e/home.spec.ts` (append), `tests/e2e/RULE-MAP.md`
- Test: `tests/budgets/motion-budget.spec.ts` (create)

**Interfaces:**
- Consumes: S05 tokens and `buttonClassName`; the legacy components still mounted until S07/S08.
- Produces: the body painted from `--tt-ground`/`--tt-ink`; zero legacy keyframes and zero infinite animations in the app; `framer-motion` gone from `package.json`; the motion budget test (roadmap §9 S06). Legacy text classes (`.section-*`, `.brand-*`) stay for the legacy components on the `.tt-legacy-dark` band.

- [ ] **Step 1: Write the failing tests**

Create `tests/budgets/motion-budget.spec.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { FAKE, mockTrack, trackData } from "../fixtures/tracking-fixtures";
import { IS_PRODUCTION_RUN } from "../support/prod-mode";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
/** Spec §12 2.2.2: after 8 s nothing may still be moving forever. */
const SETTLE_MS = 8500;
const RESULT_READY = { name: "다시 볼 링크 복사" } as const;

async function infiniteAnimations(page: Page): Promise<readonly string[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.playState === "running" && animation.effect?.getTiming().iterations === Number.POSITIVE_INFINITY)
      .map((animation) => {
        const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
        const name = animation instanceof CSSAnimation ? animation.animationName : "script";
        return `${name} on ${target?.tagName ?? "?"}`;
      })
  );
}

async function movingAnimations(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.getAnimations().filter((animation) => {
        const duration = Number(animation.effect?.getComputedTiming().duration ?? 0);
        return animation.playState === "running" && duration > 0;
      }).length
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|css)$/.test(entry.name) ? [full] : [];
  });
}

test.describe("motion budget (S06)", () => {
  test.skip(!IS_PRODUCTION_RUN, "budgets run against next start");
  test.describe.configure({ timeout: 90_000 });

  test("no infinite animation 8 s after load: home, a loading deep link and a settled result", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(SETTLE_MS);
    expect(await infiniteAnimations(page), "home").toEqual([]);

    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }), { delayMs: 30_000 });
    await page.goto(`/${FAKE.domestic}`);
    await page.waitForTimeout(SETTLE_MS);
    expect(await infiniteAnimations(page), "loading deep link").toEqual([]);

    await page.unroute("**/api/track");
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.hbl }));
    await page.goto(`/${FAKE.hbl}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await page.waitForTimeout(SETTLE_MS);
    expect(await infiniteAnimations(page), "settled result").toEqual([]);
  });

  test("reduced motion: nothing animates on home and on a settled result", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForTimeout(500);
    expect(await movingAnimations(page), "home").toBe(0);
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.hbl }));
    await page.goto(`/${FAKE.hbl}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await page.waitForTimeout(500);
    expect(await movingAnimations(page), "settled result").toBe(0);
  });

  test("framer-motion is uninstalled and imported nowhere", () => {
    const manifest = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as {
      readonly dependencies?: Readonly<Record<string, string>>;
      readonly devDependencies?: Readonly<Record<string, string>>;
    };
    expect(Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })).not.toContain("framer-motion");
    const importers = ["app", "components", "lib"]
      .flatMap((dir) => sourceFiles(path.join(REPO_ROOT, dir)))
      .filter((file) => readFileSync(file, "utf8").includes("framer-motion"))
      .map((file) => path.relative(REPO_ROOT, file));
    expect(importers).toEqual([]);
  });
});
```

Append to `tests/e2e/home.spec.ts`:

```ts
test.describe("style tokens on the page (S06)", () => {
  test("the page ground and text colors come from the style tokens", async ({ page }) => {
    await page.goto("/");
    const colors = await page.evaluate(() => {
      const probe = (value: string): string => {
        const element = document.createElement("span");
        element.style.color = value;
        document.body.append(element);
        const rgb = getComputedStyle(element).color;
        element.remove();
        return rgb;
      };
      const root = getComputedStyle(document.documentElement);
      const body = getComputedStyle(document.body);
      return {
        ground: probe(root.getPropertyValue("--tt-ground").trim()),
        ink: probe(root.getPropertyValue("--tt-ink").trim()),
        background: body.backgroundColor,
        color: body.color
      };
    });
    expect(colors.background).toBe(colors.ground);
    expect(colors.color).toBe(colors.ink);
  });

  test("a settled result runs no infinite animation", async ({ page }) => {
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.hbl }));
    await page.goto(`/${FAKE.hbl}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    const infinite = await page.evaluate(
      () => document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations === Number.POSITIVE_INFINITY).length
    );
    expect(infinite).toBe(0);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/home.spec.ts -g "style tokens on the page"`
Expected: FAIL — `2 failed`: the body background is still the legacy gradient (`Received: "rgba(0, 0, 0, 0)"` or the legacy color), and the settled result runs the legacy `cue-diagonal` animation of the recommendation cue and the `pulse-glow` of the current timeline dot (count ≥ 1).
The budget file needs production: `npm run build`; background `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait for `200`; `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test tests/budgets/motion-budget.spec.ts`
Expected: `2 failed, 1 passed`: "no infinite animation …" lists the legacy `pulse-glow` of the current timeline dot (and `cue-diagonal` of the recommendation cue when recommendations show) for the settled result; "framer-motion is uninstalled …" fails on `package.json`. The reduced-motion test already passes — the legacy classes honor `prefers-reduced-motion` — and keeps guarding it. Stop the server and clear the flags (Conventions).

- [ ] **Step 3: Replace `app/globals.css`**

Replace the whole file with the block below. If Task 7 deleted `components/StoreContactPopup.tsx`, leave out the last block (`.store-quick-link …` and `.contact-popup-position`); if Task 7F kept the popup, keep it.

```css
/* biome-ignore lint/suspicious/noUnknownAtRules: Tailwind CSS layer directive. */
@tailwind base;
/* biome-ignore lint/suspicious/noUnknownAtRules: Tailwind CSS layer directive. */
@tailwind components;
/* biome-ignore lint/suspicious/noUnknownAtRules: Tailwind CSS layer directive. */
@tailwind utilities;

/*
 * 전역 바탕 — 색·글꼴·크기는 app/styles/tokens.css 의 --tt-* 토큰만 씁니다(DESIGN.md).
 * 격자 배경, 흐림 장식, 무한 애니메이션, 부드러운 스크롤은 쓰지 않습니다(spec §12 2.2.2, §13).
 */
:root {
  color-scheme: light;
}

body {
  min-height: 100dvh;
  background: var(--tt-ground);
  color: var(--tt-ink);
  /* 과도기: 옛 결과 상세(S07이 지움)가 좁은 화면에서 넘치지 않게 막던 규칙을 유지합니다. */
  overflow-x: hidden;
  text-rendering: optimizeLegibility;
}

/*
 * 과도기 띠(S06 → S07·S08): 옛 어두운 부품(옛 푸터, 옛 결과 상세와 S04 상태 슬롯, 옛 스토어 쇼케이스,
 * 개인정보처리방침 본문)을 토큰 바탕 위에서도 읽을 수 있게 감쌉니다. S07·S08이 마지막 사용처를 지우면서 함께 지웁니다.
 */
.tt-legacy-dark {
  color-scheme: dark;
  background: linear-gradient(180deg, #050b17 0%, #07111f 100%);
  color: hsl(210, 40%, 98%);
}

/* 옛 부품 전용 글자·패널 모양 — 과도기 띠 안에서만 쓰입니다. 사용하는 부품을 지우는 단계가 함께 지웁니다. */
.section-kicker {
  color: rgb(165 243 252);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1rem;
}

.section-title {
  color: rgb(248 250 252);
  font-weight: 600;
  line-height: 1.25;
  text-wrap: balance;
  word-break: keep-all;
}

.section-copy {
  color: rgb(203 213 225);
  line-height: 1.75rem;
  word-break: keep-all;
}

.brand-panel {
  border: 1px solid rgba(51, 65, 85, 0.7);
  border-radius: 1rem;
  background: rgba(15, 23, 42, 0.55);
}

.brand-icon-tile {
  display: inline-flex;
  height: 2.75rem;
  width: 2.75rem;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(103, 232, 249, 0.3);
  border-radius: 0.75rem;
  background: rgba(103, 232, 249, 0.1);
  color: rgb(207 250 254);
}

@media (min-width: 640px) {
  .section-kicker {
    font-size: 0.875rem;
    line-height: 1.25rem;
  }
}

/* 승인 1 대체안(Task 7F)에서만: 접힌 상담·스토어 팝업의 옛 모양 */
.store-quick-link {
  display: inline-flex;
  min-height: 3rem;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 1px solid rgba(51, 65, 85, 0.8);
  border-radius: 0.75rem;
  background: rgba(15, 23, 42, 0.8);
  color: rgb(241 245 249);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1rem;
  padding-inline: 0.75rem;
}

.store-quick-link:focus-visible {
  outline: 2px solid rgba(165, 243, 252, 0.8);
  outline-offset: 2px;
}

.contact-popup-position {
  bottom: max(0.75rem, env(safe-area-inset-bottom));
}
```

Removed on purpose: the dark gradient body and its grid `body::before`, the `h1–h4` legacy font rule (S05 note), `scroll-behavior: smooth`, `::selection`, the legacy `--background-*`/`--accent-*` variables, the `brand-panel` glow shadow and blur, every `@keyframes` (`cue-*`, `input-*`, `visual-*`, `logistics-packet`, `loading-route`) and every `.motion-*` class (spec §13 "버리는 것", §12 2.2.2). Legacy elements that still carry a `.motion-*` class simply stop moving.
Check: use the Grep tool with pattern `--background-|--accent-|motion-cue|motion-input|motion-logistics|motion-loading` over `app/` and `components/` (`*.ts`, `*.tsx`, `*.css`). Expected: matches only in class-name strings of legacy components (`components/AnimatedIcon.tsx`, `components/RecommendedProducts.tsx`), none in CSS.

- [ ] **Step 4: Drop `pulse-glow`, make the timeline step static, trim the legacy leftovers**

In `tailwind.config.ts` (S05 version) replace

```ts
      transitionTimingFunction: {
        tt: "var(--tt-ease)"
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(16, 185, 129, 0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgba(16, 185, 129, 0)" }
        }
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite"
      }
```

with

```ts
      transitionTimingFunction: {
        tt: "var(--tt-ease)"
      }
```

Replace the whole content of `components/TimelineStep.tsx` with:

```tsx
import { cn } from "@/lib/utils";

type TimelineStepProps = {
  label: string;
  datetime?: string;
  state: "completed" | "current" | "pending";
  detail?: string;
};

const dotStyle: Record<TimelineStepProps["state"], string> = {
  completed: "bg-emerald-400",
  current: "bg-amber-300",
  pending: "bg-slate-500"
};

/** Legacy history row (deleted by S07). Static since S06: no framer-motion entrance, no pulsing dot (spec §12 2.2.2). */
export const TimelineStep = ({ label, datetime, detail, state }: TimelineStepProps) => (
  <li className={cn("relative rounded-xl py-1 pl-8 pr-1", state === "current" && "bg-amber-200/[0.04]")}>
    <span className={cn("absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border border-slate-900", dotStyle[state])} />
    <span className="absolute left-[6px] top-6 h-[calc(100%-12px)] w-px bg-slate-700/80" aria-hidden="true" />
    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-100">
      <span>{label}</span>
      {state === "current" ? (
        <span className="rounded-md border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-xs font-semibold text-amber-100">
          현재
        </span>
      ) : null}
    </div>
    <time className="mt-1 block text-xs tabular-nums text-slate-300" dateTime={datetime}>
      {datetime ? new Date(datetime).toLocaleString("ko-KR") : "-"}
    </time>
    {detail ? <div className="mt-0.5 break-keep text-xs leading-5 text-slate-400">{detail}</div> : null}
  </li>
);
```

In `components/CustomerCta.tsx` remove the floating variant (spec §14 "CustomerCta floating 변형" 삭제): in the props type keep only the `variant: "result"` member; delete `const isFloating = variant === "floating";`; replace each `isFloating ? A : B` with `B` and delete each `isFloating && X` / `!isFloating && X` term (keeping `X` for the `!isFloating` case). In the `e079461` text these are `isFloating ? "mt-4 p-3 sm:ml-auto sm:w-80" : "p-4 sm:p-5"` → `"p-4 sm:p-5"`, `cn("space-y-1", !isFloating && "max-w-3xl")` → `"space-y-1 max-w-3xl"`, `isFloating ? "text-base" : "text-lg sm:text-xl"` → `"text-lg sm:text-xl"`, and the grid's `isFloating && "grid-cols-1"` → removed. S04 reworked this file; apply the same removal to S04's text.
Check: `Select-String -LiteralPath components/CustomerCta.tsx -Pattern "floating|isFloating"` → no output.

Delete the unused legacy files: `git rm components/StatusBanner.tsx components/ui/badge.tsx`
Check: `git grep -n -e "StatusBanner" -e "ui/badge" -- app components lib` → no output.

- [ ] **Step 5: Uninstall framer-motion**

Run: `npm uninstall framer-motion`
Expected: `removed … packages` and exit 0 (no other dependency changes).
Check: `git grep -n "framer-motion" -- app components lib package.json` → no output.

- [ ] **Step 6: Restyle the 404 page and band the privacy article**

Replace the whole content of `app/not-found.tsx` with:

```tsx
import Link from "next/link";
import { buttonClassName } from "@/components/primitives/Button";

/** Real 404 (spec §3, SEO-01): dotted, Hangul and 31+ character paths land here. Root layout only, so no ads. */
export default function NotFound() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-[70dvh] w-full max-w-[var(--tt-column)] flex-col justify-center gap-3 bg-tt-surface px-[var(--tt-gutter)] py-16 text-tt-ink"
    >
      <h1 className="m-0 text-tt-xl font-black [word-break:keep-all]">페이지를 찾을 수 없어요</h1>
      <p className="m-0 text-tt-sm [word-break:keep-all]">
        주소가 바뀌었거나 잘못 입력된 것 같아요. 조회번호는 배송 조회 화면에서 다시 입력해 주세요.
      </p>
      <Link href="/" className={buttonClassName("secondary", "md", "mt-3 self-start")}>
        배송 조회로 돌아가기
      </Link>
    </main>
  );
}
```

In `app/(public)/privacy/page.tsx` add the class `tt-legacy-dark` to the `<main id="main-content" …>` element (S01/S02 text: `className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14"` → `className="tt-legacy-dark mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14"`). S08 restyles the page on the shell and removes the band.

- [ ] **Step 7: Run the tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test`
Expected: 0 failed; `home.spec.ts` gains 2 passes; `tests/e2e/seo-routes.spec.ts` (the 404 page) and `tests/privacy.spec.ts` pass unchanged.
Production: `npm run build` (exit 0); background `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait for `200`; `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test tests/budgets/motion-budget.spec.ts tests/budgets/first-paint.spec.ts tests/budgets/font-preload.spec.ts`
Expected: all pass. Stop the server and clear the flags.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.
In `tests/e2e/RULE-MAP.md` set row M1 to `migrated (Task 5); budget added (Task 9)`.

- [ ] **Step 8: Commit**

Run:
```powershell
git add app/globals.css tailwind.config.ts components/TimelineStep.tsx components/CustomerCta.tsx app/not-found.tsx "app/(public)/privacy/page.tsx" package.json package-lock.json tests/budgets/motion-budget.spec.ts tests/e2e/home.spec.ts tests/e2e/RULE-MAP.md
git add -u components/StatusBanner.tsx components/ui/badge.tsx
git commit -m "perf: remove framer-motion and every infinite animation, paint the body from tokens"
```

---

### Task 10: HTML, LCP, first-paint and CLS budgets; the INVALID stage screen

**Files:**
- Create: `tests/budgets/html-budget.spec.ts`, `tests/budgets/lcp-budget.spec.ts`
- Modify: `tests/tools/stage-screens.spec.ts` (append one scenario)

**Interfaces:**
- Consumes: `IS_PRODUCTION_RUN` (S01), fixtures (S01), `lookup` (S03 config); the finished shell of Tasks 5–9.
- Produces: the S06 budgets of roadmap §9 as production-only tests with `[html-budget]`, `[lcp-budget]`, `[fcp-budget]`, `[cls-budget]` output lines for G8; the stage-screens scenario `deeplink-invalid` (S01's tool: later stages append only).

- [ ] **Step 1: Write the budget tests**

Create `tests/budgets/html-budget.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { FAKE } from "../fixtures/tracking-fixtures";
import { IS_PRODUCTION_RUN } from "../support/prod-mode";

/** Spec §12: '/' HTML ≤ 35 KB (109,852 B before the renewal), served from the static cache (CDN HIT on Vercel). */
const HTML_BUDGET_BYTES = 35 * 1024;

test.describe("HTML budget (S06)", () => {
  test.skip(!IS_PRODUCTION_RUN, "budgets run against next start");

  test("'/' HTML is at most 35 KB and comes from the 5-minute static cache", async ({ request }) => {
    const response = await request.get("/");
    expect(response.status()).toBe(200);
    const bytes = (await response.body()).byteLength;
    console.info(`[html-budget] '/': ${bytes} B (max ${HTML_BUDGET_BYTES} B)`);
    expect(bytes).toBeLessThanOrEqual(HTML_BUDGET_BYTES);
    expect(response.headers()["cache-control"] ?? "").toContain("s-maxage=300");
  });

  test("the deep-link shell size is reported for the stage summary", async ({ request }) => {
    const response = await request.get(`/${FAKE.domestic}`);
    expect(response.status()).toBe(200);
    console.info(`[html-budget] '/{번호}': ${(await response.body()).byteLength} B (reported, no limit)`);
  });
});
```

Create `tests/budgets/lcp-budget.spec.ts`:

```ts
import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { lookup } from "@/config/site.config";
import { FAKE, FAKE_GROUPED, mockTrack, trackData } from "../fixtures/tracking-fixtures";
import { IS_PRODUCTION_RUN } from "../support/prod-mode";

interface NetworkProfile {
  readonly name: string;
  readonly latencyMs: number;
  readonly downloadBytesPerSecond: number;
  readonly uploadBytesPerSecond: number;
  readonly cpuSlowdown: number;
}

/**
 * Chrome DevTools "Slow 4G" — the throttling Lighthouse applies in DevTools mode for its mobile run (RTT 150 ms × 3.75,
 * 1.6 Mbps × 0.9 down, 750 kbps × 0.9 up) — with Lighthouse's mobile CPU slowdown × 4. Spec §12: '/' LCP ≤ 2.0 s.
 */
const SLOW_4G: NetworkProfile = {
  name: "Slow 4G",
  latencyMs: 150 * 3.75,
  downloadBytesPerSecond: ((1.6 * 1000 * 1000) / 8) * 0.9,
  uploadBytesPerSecond: ((750 * 1000) / 8) * 0.9,
  cpuSlowdown: 4
};
/** Chrome DevTools "Fast 4G" (RTT 60 ms × 2.75, 9 Mbps × 0.9 down, 1.5 Mbps × 0.9 up), CPU not slowed. Spec §12: ≤ 1.0 s. */
const FAST_4G: NetworkProfile = {
  name: "Fast 4G",
  latencyMs: 60 * 2.75,
  downloadBytesPerSecond: ((9 * 1000 * 1000) / 8) * 0.9,
  uploadBytesPerSecond: ((1.5 * 1000 * 1000) / 8) * 0.9,
  cpuSlowdown: 1
};
const LCP_BUDGET_MS = 2000;
const FCP_BUDGET_MS = 1000;
const CLS_BUDGET = 0.05;

async function throttle(page: Page, profile: NetworkProfile): Promise<CDPSession> {
  const session = await page.context().newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: profile.latencyMs,
    downloadThroughput: profile.downloadBytesPerSecond,
    uploadThroughput: profile.uploadBytesPerSecond
  });
  await session.send("Emulation.setCPUThrottlingRate", { rate: profile.cpuSlowdown });
  return session;
}

/** Only first-party traffic counts toward these budgets; ads and other hosts are aborted. */
async function blockThirdParty(page: Page): Promise<void> {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
}

function largestContentfulPaint(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          resolve(entries[entries.length - 1]?.startTime ?? Number.POSITIVE_INFINITY);
        }).observe({ type: "largest-contentful-paint", buffered: true });
        setTimeout(() => resolve(Number.POSITIVE_INFINITY), 5000);
      })
  );
}

function firstContentfulPaint(page: Page): Promise<number> {
  return page.evaluate(() => performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? Number.POSITIVE_INFINITY);
}

function cumulativeLayoutShift(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { readonly value?: number; readonly hadRecentInput?: boolean };
            if (shift.hadRecentInput !== true) total += shift.value ?? 0;
          }
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => resolve(total), 200);
      })
  );
}

test.describe("LCP, first paint and CLS budgets (S06)", () => {
  test.skip(!IS_PRODUCTION_RUN, "budgets run against next start");
  test.describe.configure({ timeout: 60_000 });

  test("'/' LCP ≤ 2.0 s on Slow 4G", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await blockThirdParty(page);
    await throttle(page, SLOW_4G);
    await page.goto("/", { waitUntil: "load" });
    await page.waitForTimeout(1000);
    const lcp = await largestContentfulPaint(page);
    console.info(`[lcp-budget] '/' on ${SLOW_4G.name}: ${Math.round(lcp)} ms (max ${LCP_BUDGET_MS} ms)`);
    expect(lcp).toBeLessThanOrEqual(LCP_BUDGET_MS);
  });

  test("deep-link first paint ≤ 1.0 s on Fast 4G, and that paint is the number bar with '조회하고 있어요'", async ({ page, request }) => {
    const html = await (await request.get(`/${FAKE.domestic}`)).text();
    expect(html).toContain('data-number-bar="true"');
    expect(html).toContain(lookup.copy.title);
    await page.setViewportSize({ width: 375, height: 812 });
    await blockThirdParty(page);
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }), { delayMs: 20_000 });
    await throttle(page, FAST_4G);
    await page.goto(`/${FAKE.domestic}`, { waitUntil: "load" });
    const fcp = await firstContentfulPaint(page);
    console.info(`[fcp-budget] deep link on ${FAST_4G.name}: ${Math.round(fcp)} ms (max ${FCP_BUDGET_MS} ms)`);
    expect(fcp).toBeLessThanOrEqual(FCP_BUDGET_MS);
    await expect(page.locator('[data-number-bar="true"]')).toContainText(FAKE_GROUPED.domestic);
  });

  test("CLS ≤ 0.05 on '/' and while a deep link loads", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await blockThirdParty(page);
    await page.goto("/");
    await page.waitForTimeout(3000);
    const home = await cumulativeLayoutShift(page);
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }), { delayMs: 20_000 });
    await page.goto(`/${FAKE.domestic}`);
    await page.waitForTimeout(3500); // crosses the 0.4 s and 3 s stage changes
    const deepLink = await cumulativeLayoutShift(page);
    console.info(`[cls-budget] '/': ${home.toFixed(3)}, deep link while loading: ${deepLink.toFixed(3)} (max ${CLS_BUDGET})`);
    expect(home).toBeLessThanOrEqual(CLS_BUDGET);
    expect(deepLink).toBeLessThanOrEqual(CLS_BUDGET);
  });
});
```

- [ ] **Step 2: Run the budgets against the production build**

These budgets measure what Tasks 5–9 built, so they are expected to pass on the first run; each one fails when its limit is exceeded (a regression check, not a red-first unit test).
Run: `npm run build` → exit 0. Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test tests/budgets/html-budget.spec.ts tests/budgets/lcp-budget.spec.ts`
Expected: `5 passed`; copy the `[html-budget]`, `[lcp-budget]`, `[fcp-budget]` and `[cls-budget]` lines into the stage summary.
If a limit fails:
- `[html-budget]` over 35 KB: print the largest parts with `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).Content | Out-File -Encoding utf8 $env:TEMP\s06-home.html` and look for serialized props of `LookupController` (the idle extras are server-rendered; only `entry`, `homeNotice` and the extras' RSC payload may appear) — move any large literal into a server component.
- `[lcp-budget]`/`[fcp-budget]`: check that nothing above the fold waits for JavaScript (`first-paint.spec.ts` must still pass) and that only DM Mono is preloaded (`font-preload.spec.ts`).
- `[cls-budget]` on the deep link: the loading container must keep `min-h-[560px]` in both the pending and the slot display (Task 5 Step 11).
Stop the server and clear the flags (Conventions).

- [ ] **Step 3: Add the INVALID deep-link stage screen**

In `tests/tools/stage-screens.spec.ts` append this entry as the last element of the `SCENARIOS` array (after the entries S01 and later stages added):

```ts
  // S06: INVALID deep link — server-rendered form with the error, no API call
  { name: "deeplink-invalid", path: `/${FAKE.deepLinkInvalid}` },
```

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/tools/stage-screens.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: every test skipped (no `PW_SHOTS`), 0 failed; the count grew by 5 (one scenario × five widths).

- [ ] **Step 4: Typecheck, lint and commit**

Run: `npm run typecheck; npx eslint tests/budgets tests/tools/stage-screens.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.
Run: `git add tests/budgets/html-budget.spec.ts tests/budgets/lcp-budget.spec.ts tests/tools/stage-screens.spec.ts; git commit -m "test: add the S06 HTML, LCP, first-paint and CLS budgets"`

---

### Task 11 (gated by approval 13): axe on the home, INVALID and loading screens

**Files:**
- Modify: `tests/e2e/home.spec.ts` (one import at the top; append)
- Modify (only if the package is missing): `package.json`, `package-lock.json`

**Interfaces:**
- Consumes: `@axe-core/playwright` (dev dependency added by the first stage that ran with approval 13 granted; S05 Task 16 when approved by then).
- Produces: `describe("axe (S06, approval 13)")` — WCAG 2.0/2.1/2.2 A+AA tags, legacy bands (`.tt-legacy-dark`) excluded because S07/S08 replace them.

- [ ] **Step 1: Confirm approval 13**

Open roadmap §4 row 13. If its Status is not `approved`, skip Steps 2–5, write "Task 11 SKIPPED: approval 13 is `<status>`" into the stage summary, and do the fallback (spec §16 item 13 "거절하면: … 접근성은 수동으로 점검"): walk the checklist below once at 375×812 and at 1280×900 in Chrome and paste the results into the stage summary —
  1. Keyboard only on `/`: Tab order is skip link → '통관·배송 조회' → '문의' → input → '번호는 어디서 찾나요?' → '국내 택배사' → [조회하기] → the shortcut links (Task 7) or the '상담·스토어' pill (Task 7F) → '보통 이렇게 걸려요'; every focus ring is visible (3 px).
  2. Submit '00001' with Enter: the error is read once (screen reader: NVDA + Chrome), focus stays in the input, '번호는 어디서 찾나요?' is open.
  3. Open `/000012345678` (the fixture number `FAKE.domestic`) against the dev server with DevTools "Slow 4G": '조회를 시작했어요' is read once; when the result (or the NOT_FOUND screen) arrives, focus lands on the status heading.
  4. 200 % browser zoom at 1280 px: no horizontal scroll on `/` and on the INVALID screen.
  5. Windows high-contrast (forced colors): the input border, the buttons and the shortcut outlines stay visible.

- [ ] **Step 2: Make sure the package is installed**

Run: `Test-Path -LiteralPath node_modules/@axe-core/playwright/package.json`
Expected: `True` (S05 installed it). If `False`, run `npm install --save-dev @axe-core/playwright` (approval 13 covers it) and include `package.json`/`package-lock.json` in Step 5's commit.

- [ ] **Step 3: Write the tests**

At the top of `tests/e2e/home.spec.ts` add `import AxeBuilder from "@axe-core/playwright";` as the first import, and append:

```ts
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe("axe (S06, approval 13)", () => {
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 1280, height: 900 }
  ]) {
    test(`home, INVALID and a loading deep link have no WCAG 2.2 AA violations at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }), { delayMs: 20_000 });
      const scan = async (label: string): Promise<void> => {
        const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).exclude(".tt-legacy-dark").analyze();
        expect(results.violations.map((violation) => `${violation.id} (${violation.nodes.length})`), label).toEqual([]);
      };
      await page.goto("/");
      await scan("home");
      await page.goto(`/${FAKE.deepLinkInvalid}`);
      await scan("INVALID deep link");
      await page.goto(`/${FAKE.domestic}`);
      await expect(page.locator('[data-number-bar="true"]')).toBeVisible();
      await scan("deep link while loading");
    });
  }
});
```

- [ ] **Step 4: Run them**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/home.spec.ts -g "axe"`
Expected: `2 passed`. A violation prints its rule id and node count; fix the S06 component it names (never the legacy bands, which are excluded) and run again.

- [ ] **Step 5: Commit**

Run: `git add tests/e2e/home.spec.ts; git commit -m "test: run axe on the S06 lookup screens"` (add `package.json package-lock.json` if Step 2 installed the package).

---

### Task Final: Stage gate

- [ ] **G1. Port free.** `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue` → no output (stop listeners otherwise).
- [ ] **G2. Lint.** `npm run lint` → exit 0, no errors, no warnings introduced by this stage.
- [ ] **G3. Typecheck.** `npm run typecheck` → exit 0.
- [ ] **G4. Build.** `npm run build` → exit 0. Route table: `ƒ /[trackingNumber]` always; `/` is `ƒ` in S01 (it still reads `searchParams`), `○ /` from S02 on, and `○ /` with `Revalidate 5m` from S06 on.
- [ ] **G5. Dev-mode E2E.** `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npm run test:e2e` → "N passed", 0 failed (skips allowed only for tests guarded by `PW_MODE`, `PW_SHOTS`, `PW_VISUAL`, or an approval-gated `test.skip` naming the approval).
- [ ] **G6. Production-mode E2E.** Re-run `npm run build` if `next start` reports a missing or stale build. Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait for `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` = `200`; then `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test` → 0 failed, including `tests/budgets/*`.
- [ ] **G7. After-screens.** Server still running: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='after'; $env:PW_STAGE='S06'; npx playwright test tests/tools/stage-screens.spec.ts` → PNGs in `test-results/stage-screens/S06-after/` at 320, 375, 768, 1024, 1440. Compare with `S06-before/`; send both sets to the operator with SendUserFile. Stop the server (G1 command) and clear the flags: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.
- [ ] **G8. Budgets.** Paste the measured numbers of every budget this plan lists (from the G6 output) into the stage summary. Any budget over its fail line fails the gate.
- [ ] **G9. Code review.** Invoke the `code-review` skill on `git diff claude/tipoasis-tracking-renewal-ae0e3a...HEAD`. Fix every CRITICAL and HIGH finding; if code changed, re-run G2–G6.
- [ ] **G10. Verification.** Invoke `superpowers:verification-before-completion`; paste each command and its result line into the stage summary.
- [ ] **G11. Commit.** `git status` shows only this stage's files (see the roadmap File Map). Commit any remainder with a conventional message and no attribution trailer.
- [ ] **G12. No deploy.** Do not push to `main`; do not run `vercel deploy`. Push `renewal/s06-lookup-area` only if the operator asked. Hand the stage summary to the operator; merge into the integration branch only after acceptance (roadmap §5).

**S06 notes on the standard gate above**
- G4: `○ /` with a revalidate time of `5m`, `ƒ /[trackingNumber]`; no other route changes.
- G5/G6: the dev-mode skips are the production-only tests (`deep-link.spec.ts` "production caching", every `tests/budgets/*` test) and, when approval 13 is pending, nothing else (Task 11 adds no test then).
- G7: the PNGs land in `test-artifacts/stage-screens/S06-after/` (S01 Addition 1). Compare `home-*`, `deeplink-*` and the new `deeplink-invalid-*` with `S06-before/`; the legacy bands (footer, showcase, result details) are expected to look as before.
- G8 budget lines: `[html-budget]` (2 lines), `[lcp-budget]`, `[fcp-budget]`, `[cls-budget]`, the `[geometry]` line(s) of Task 7 or 7F, and the three test names of `tests/budgets/motion-budget.spec.ts`.
- G11: this stage's files are the File Structure table above plus `tests/e2e/RULE-MAP.md`; `git status --short` shows nothing else.
- Stage summary also lists: approvals 1, 2, 13 and which of Task 7 / 7F and Task 11 / fallback ran; the S04 result block that Task 5 Step 10 moved; whether Task 5 Step 12 (same-address entry) ran; any quoted text that earlier stages had reformatted; the contract deviations (Additions 1–9) and the open issues below.

## Open issues for the operator and later stages

1. **S04 plan was missing when this plan was written.** Task 5 Step 10 moves S04's result block by rule rather than by quoted code, and "Consumed S04 shapes" A1–A4 are checked in Task 0 Step 9. A reviewer who has S04's final plan should replace Step 10 (b) with S04's exact JSX before execution.
2. **`stateGuide` and `siteConfig` in the initial bundle.** `LookupController` and `FailureFallback` import the `stateGuide` named export (INVALID copy, document titles), and the dynamic `import("@/config/site.config")` in `LegacyResultSection` cannot split a module that is also imported statically. S07 owns the JS budget (`/` app ≤ 25 KB): if it is exceeded, pass the few INVALID strings from `TrackingPage` as props instead.
3. **`/ads.txt` is a real 404 after the three-way split** (S01 open issue). AdSense expects `public/ads.txt`; not in the File Map — operator decision.
4. **An INVALID deep link never unlocks the ad loader in its document** (the scrub result is not reported to the ad signals), even if the customer then looks up a valid number in the same tab. This follows spec §7 INVALID "로더가 아직 없으면 넣지 않음"; S08's `afterAllowedResult` policy may revisit it.
5. **Approval 3 weight on the INVALID screen:** 톡톡 stays a secondary outline there because [조회하기] is the screen's one filled button; approval 3's fallback ('톡톡 is the filled primary on every error screen') is applied by S04/S07 to the result-area error cards, not to the form's INVALID state.
6. **Throttling presets** in `tests/budgets/lcp-budget.spec.ts` follow Chrome DevTools' "Slow 4G"/"Fast 4G" and Lighthouse's mobile CPU × 4 (Slow 4G only). If the operator measures with other presets (PSI field data, WebPageTest), record which one the stage summary uses.
7. **S07 takes over** the settle-time focus, live sentence and document title (its result island) and deletes `LegacyResultSection`, the pending/slot split of `lookup-display.ts` it no longer needs, and the `.tt-legacy-dark` users in the result area; S08 swaps the legacy footer and showcase, restyles `/privacy`, and deletes `.tt-legacy-dark` and the legacy text classes in `app/globals.css`.

## Self-Review

- **Spec coverage.** §3 routes: `/` static with `revalidate = 300` and no `searchParams` (Task 5 Step 13, S02 test "'/' stays static"), deep-link three-way split with `?c=` and `noindex`, title without the number, private/no-store (Tasks 1, 5), same server shell for both entrances (Task 5), modes as component state and [다른 번호 조회] as a reset (Task 5, `home.spec.ts` "mode changes"), candidate B and restore re-wired from S02 (Task 5 Steps 7, 11, 12), noscript GET form → 307 → shell + notice (Tasks 5, 8). §4 first view: 48 px header with '통관·배송 조회' and '문의' (Task 4), notice line re-filtered after mount (Task 8), h1, input attributes and no mobile autofocus (Task 5), format hint and '번호는 어디서 찾나요?' (Task 5), carrier combobox and [조회하기] (Task 5), paste parsing with [되돌리기] and the O↔0/I↔1 question (Tasks 2, 6), client pre-check without a request (Tasks 1, 5), 바로가기 row with the disclosure first, 44 px outlines, talk-only while invalid, hidden in loading/result, ≤ 550 px at 375×667 (Task 7; fallback 7F), below the fold '보통 이렇게 걸려요' then the showcase (Task 8), deletions of hero copy, LogisticsFlow, AssuranceRail, infinite animations, header store links (Tasks 4, 5, 9). §5: button label only for 0–0.4 s, inputs never disabled, abort on a new submit, one live region, focus to the visible h2 except after deep-link interaction, `role=alert` only on the error sentence, INVALID at the input with focus kept there (Tasks 4, 5). §7 idle, loading (deep-link SSR card), INVALID rows (Tasks 5, 7). §8: 톡톡 at most three places (header, row/error block, footer), `isAffiliate` decides disclosure and `rel` (Task 7). §9 notices re-filtered after mount, not announced (Task 8). §12: no infinite animation, reduced motion 0, 320 px no horizontal scroll, targets 44 px, HTML ≤ 35 KB, LCP ≤ 2.0 s Slow 4G, deep-link first paint ≤ 1.0 s Fast 4G, CLS ≤ 0.05 (Tasks 5, 9, 10); axe only with approval 13 (Task 11). §13: framer-motion removed, body on tokens, no glow/blur/grid (Task 9). §14: component boundaries (`TrackingPage` server, `LookupController` island), deletions (popup under approval 1, LogisticsFlow, AssuranceRail, StatusBanner, CustomerCta floating, framer-motion), test contract items 1–3 (RULE-MAP first, hooks, `toBeInViewport` at 390×844/375×812/360×780 with trial clicks) (Tasks 3, 5, 7, 9). §16 items 1, 2, 13 gate Tasks 7/7F, the stage, and Task 11.
- **Placeholder scan.** Every code step carries complete code. The one step that moves code by rule is Task 5 Step 10 (b) (S04's result block, unknown when this plan was written); it states the exact source (Task 0 Step 9 output), the renames and what must not be copied, and Open issue 1 asks a reviewer to inline S04's JSX. Task 5 Step 12 and Tasks 7/7F/11 are conditional on recorded decisions, each with both branches spelled out.
- **Type consistency.** Contract names are used as written: `TrackingEntry`, `LookupControllerProps`, `TrackingPage`, `SiteHeader`, `normalizeInput`, `classifyDeepLink`, `parseCarrierParam`, `PasteExtraction`, `extractFromPastedText`, `ConfusableHint`, `detectConfusables`, `PrecheckResult`, `precheckNumber`, `useLookup`/`UseLookupOptions`/`UseLookupResult`, `StatusSlot`/`StatusSlotProps`, `LiveAnnouncerProvider`/`useAnnounce`, `scrubNumberFromUrl`/`SCRUB_TIMEOUT_MS`, `readRestoreEntry`/`saveRestoreEntry`/`currentNavigationKind`/`RestoreEntry`, `setAdSignals`, `deriveLoadingView`, `deriveTrackingView`, `groupTrackingNumber`, `requestCarrierView`, `CARRIER_NAMES`, `CONCRETE_CARRIER_CODES`, `pickNotice`/`activeNotices`/`toNoticeView`, `Button`/`buttonClassName`, `NumberBar`, `TalkLink`, `ToneIcon`, `NoticeBanner`. S06-private names keep one spelling across tasks: `computeDisplay`, `viewModeOf`, `outcomeKey`, `stillActiveHomeNotice`, `LookupDisplay`, `DisplayInput`, `DerivedView`, `InvalidInput`, `InvalidInputView`, `LegacyDeriver`, `loadLegacyDeriver`, `getLoadedLegacyDeriver`, `getRestoreSnapshot`, `getServerRestoreSnapshot`, `markRestoreConsumed`, `subscribeToNothing`, `getClientNowSnapshot`, `getServerNowSnapshot`, `INPUT_ASSIST_ID`, `SHORTCUT_REGION_LABEL`, `NO_NOTICE_TIME`, `RESULT_READY`, `INPUT_LABEL`. Test counts: `number-input.spec.ts` 9 → 17; `lookup-display.spec.ts` 6 → 7; `home.spec.ts` 4 → 12 → 17 (Task 7) or 15 (Task 7F) → 19/17 (Task 8) → 21/19 (Task 9) → +2 with approval 13; `lookup-input.spec.ts` 8 → 13 → 14; `deep-link.spec.ts` 16 (15 in dev).
- **Review Focus.** (1) pasted text with several digit runs → Task 2 unit rows + Task 6 E2E; (2) deep-link path variants → Task 1 rows + Task 5 `deep-link.spec.ts`; (3) interaction during a deep-link load → Task 5 focus test; (4) submit before scripts → Task 5 no-JS test + Task 8 noscript notice; (5) stale cached notice / clock off → Task 8 unit + E2E. Extra pins: 320 px cargo number, late answer after [번호 변경].
- **Stage constraints kept.** S02/S04 E2E files are not edited; every removed legacy assertion has its RULE-MAP row and a passing replacement first; no file of a later stage is touched; `config/site.config.ts` and its schema/types/test change only through Task 8 (Addition 3); no real number appears (all digits come from `FAKE`, `FAKE_GROUPED`, zero-prefixed forms or the fake mobile number).
