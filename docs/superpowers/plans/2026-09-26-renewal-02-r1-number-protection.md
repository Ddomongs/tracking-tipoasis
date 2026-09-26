# R1 Number Protection (candidate B) — Stage S02 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop tracking numbers from reaching Google and the browser history on the current UI: remove the number from the URL after the App Router commits (candidate B), insert the AdSense loader only while the URL carries no number (fail-closed), stop pushing number URLs, restore the last lookup on reload/back only (tab-only, 30 minutes), add [다시 볼 링크 복사], move the `?trackingNumber` redirect into `next.config.ts` so `/` is static, and rewrite the privacy policy to say all of this.

**Architecture:** Three small browser modules own the rules — `lib/privacy/url-scrub.ts` (wait for `history.state.__NA` and Next's `history.replaceState` patch, stash, `replaceState(null, "", "/")`, confirm, plus a popstate guard), `lib/privacy/session-restore.ts` (one sessionStorage entry, reload/back_forward only) and `lib/clipboard.ts` (copy/share with fallbacks). A pure gate (`lib/ads/ad-gate.ts`) and a tiny signal store (`lib/ads/ad-signals.ts`) decide when `components/ads/AdLoader.tsx` may insert the loader; the loader replaces the `next/script` tag in `app/(public)/layout.tsx`. The current `HomePageClient`/`TrackingForm` are only wired to these modules (they are deleted by S06, which re-wires the same modules into `LookupController`). S02's E2E files select only stage-independent hooks so S04–S08 cannot silently break the privacy guarantees.

**Tech Stack:** Next.js 16.3.6 App Router, React 19.3, TypeScript strict, Tailwind 3.4 (legacy classes only), zod 3.25 (tests only in this stage), Playwright 1.58 (installed; `^1.55` in package.json) as the only test runner.

**Spec:** `docs/superpowers/specs/2026-09-26-tracking-renewal-ia-design.md` — §3 (routes, candidate B order ①–⑥, restore, back navigation, share, strict-origin), §8 (ad loader conditions), §11 (safety net E2E), §14 test contract item 4 (url-privacy), §15 R1, §16 item 6 (approval + fallback), §19 (rejected: head-inline scrub, `data-page-url`, `/r`). **Roadmap and shared contract:** `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §11 (names used exactly as written), §4 ledger, §6/§7 (Task 0 / Task Final). **Evidence:** GAP1-01/02/04/06/10 in `C:/Users/sos84/AppData/Local/Temp/claude/C--Users-sos84-OneDrive-------------04------01------------05----------------claude-worktrees-tipoasis-tracking-renewal-ae0e3a/3566a5b8-54f5-4bd4-bd54-e5e56b713935/scratchpad/phase1/results-run2/gaps-condensed.txt`; harnesses `…/scratchpad/phase1/gap-GAP1/local-router.cjs` (ported in Task 9) and `…/prod-candidates.cjs` (candidate `B_gated_postcommit`).

**Depends on:** S01 (R0 urgent fixes — `lib/site.ts`, `lib/privacy/number-patterns.ts`, `tests/fixtures/tracking-fixtures.ts`, route groups `app/(public)` / `app/(internal)`, `next.config.ts`, `tests/tools/stage-screens.spec.ts`).
**Gated by:** approval 6 (candidate B + companions + privacy policy — Task 12 only flips `AD_TIMING_POLICY`; everything else ships under the ledger fallback).
**Release / order:** R1 (prerequisite). Branch `renewal/s02-r1-number-protection`.

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

**Stage-specific (S02)**
- S02 works on the CURRENT UI (dark legacy styling). It adds no tokens, no primitives and no visual restyling; `ReturnLinkButton` uses legacy Tailwind classes and no icon.
- Customer-facing strings S02 adds: '다시 볼 링크 복사' (spec §3, §11.11), '링크를 복사했어요', '링크를 공유했어요', '아래 링크를 길게 눌러 복사해 주세요.' (all inside the transitional `ReturnLinkButton`, which S07 replaces with its `ReturnLinkAction` — the same `shareOrCopyLink` flow — and the config copy `resultCopy.returnLinkCopied` / `returnLinkShared` / `returnLinkFallback`, S07 Additions 5–6), and the privacy policy paragraphs of Task 10 (a legal document that stays in the page file; the operator has it checked before R1 — spec §16 item 6 "법률 확인 권고").
- `AD_TIMING_POLICY` is `"neverOnNumberRoutes"` (approval 6 fallback) until Task 12 finds approval 6 recorded as `approved` in roadmap §4; the privacy policy paragraph about ads is derived from the same constant, so text and behavior cannot disagree.
- S02's E2E files (`tests/e2e/url-privacy.spec.ts`, `session-restore.spec.ts`, `return-link.spec.ts`, `legacy-query-redirect.spec.ts`) are owned by S02 only (File Map §10.4). They therefore select only stage-independent hooks: the input label '조회번호 (HBL 또는 운송장)' + Enter, the button '다시 볼 링크 복사' (= a result has settled), `/api/track` request bodies, `location`, `history`, `sessionStorage` `tt:restore`, `script[data-ad-loader="adsense"]`, `textarea[readonly]`, the footer link '개인정보처리방침'. Never `data-tracking-result-summary`, legacy copy, or the carrier `<select>`.
- The only storage key S02 uses is `tt:restore` (sessionStorage). No cookies, no localStorage, no new dependencies.
- Before the R1 deploy the operator backs up AdSense revenue/RPM for `/번호` URLs (after R1 they all collapse into `/`); Task 13 puts this in the release note.
- Stage screenshots go to `test-artifacts/stage-screens/S02-{before,after}/` (S01 "Additions to the contract" item 1: Playwright empties `test-results/` at the start of every run); Task 0 Step 5 and gate G7 below carry this path, otherwise verbatim from roadmap §6/§7.

## Review Focus

Conditions the spec implies but no single rule names; the pinning test is added to the owning task.

1. **Back/forward, reload, bfcache and a second deep link around the scrub** (roadmap Review Focus 5; a customer taps a carrier link and comes back, reloads, or opens a second notification link in the same tab): `location` never shows a number again, the loader is never present while a number is in `location`, at most one loader per document, and restore brings back the tab's last lookup only on `reload`/`back_forward`. Owner: Task 9 (`url-privacy.spec.ts` rows "reload", "back_forward", "bfcache", "second deep link", "local-router regression") and Task 7 (`session-restore.spec.ts`). A background tab whose first animation frame arrives after the timeout still scrubs when the router is ready: Task 1 unit "late first frame".
2. **Storage that throws** (roadmap Review Focus 3, S02 part; Naver/Kakao in-app browsers, private modes): the `sessionStorage` getter throws or `setItem` throws a quota error → lookup, scrub and ads still work, restore is silently skipped, no page error. Owner: Task 2 (unit `ThrowingStorage`) and Task 7 (E2E "blocked storage", "full storage").
3. **A hash link tapped before hydration on a slow network** (the header's `#tracking` anchor works before JavaScript, creating a history entry `/{번호}#tracking` that the router never saw): after the scrub, Back must not bring the number back into `location`. Owner: Task 1 (unit "history guard") and Task 9 (E2E "hash entry before hydration").
4. **Odd or hostile legacy query values** (`?trackingNumber=%2F%2Fexample.com`, `abc.def`, Hangul, blank, grouped digits with spaces or hyphens): no open redirect, no 500 from a non-ASCII `Location` header, grouped digits still redirect, and `/` stays static. Owner: Task 8.
5. **Clipboard blocked, share sheet dismissed or denied** (in-app webviews; desktop Chrome without a share sheet): the link is still obtainable through a read-only, pre-selected text box, a dismissed sheet changes nothing, a denied sheet falls back to copying. Owner: Task 4 (`return-link.spec.ts`).

## Additions to the contract

Everything below is additive; no §11 name is renamed. Each item is reported in the stage summary so the roadmap can be amended (§5 "Contract changes").

1. **`tests/support/network-capture.ts` extra exports** (S02 E2E use them; S08's `ad-placement.spec.ts` and S11's `analytics-privacy.spec.ts` may import them): `export interface WatchedDocument { readonly documentId: string; readonly startHref: string }`, `export interface AdLoaderInsertion { readonly documentId: string; readonly pathname: string; readonly href: string; readonly hasPageUrlAttribute: boolean }`, `export interface AdLoaderWatch { readonly documents: () => readonly WatchedDocument[]; readonly insertions: () => readonly AdLoaderInsertion[]; readonly currentDocumentId: () => Promise<string> }`, `export function watchAdLoader(page: Page): Promise<AdLoaderWatch>`, `export interface LookupRecorder { readonly numbers: () => readonly string[]; readonly carriers: () => readonly string[]; readonly onRequest: (body: unknown) => void }`, `export function recordLookups(): LookupRecorder`, `export function waitForIdle(page: Page): Promise<void>`. `assertNoTrackingValues` also checks `locationAtRequest` (a third-party request made while the page URL carried a number fails even if its own URL is clean).
2. **Scrub details** (`lib/privacy/url-scrub.ts`, same signatures): "router ready" = `history.state.__NA === true` **and** Next's `history.replaceState` patch installed (an own property of `window.history`) — the deep-link page's `useEffect` runs before the App Router's patching `useEffect`, and an unpatched `replaceState(null, …)` would drop the router's state; a URL "needs a scrub" when the path is a number path **or** path + query + hash contains a tracking-like value; concurrent calls share one promise (React Strict Mode runs effects twice in dev); after the first ready check a document-level `popstate` guard replaces any number URL reached by back/forward with `/` in the same task.
3. **Gate details** (`shouldInsertAdLoader`): a deep-link document needs `scrub === "scrubbed"` (`"notNeeded"` is not enough); `false` for tracking-like pathnames (e.g. `/a/{번호}`, `/{번호}.html`) and `/internal*`; `"afterAllowedResult"` returns `false` until S08 implements it. **Signals:** `entry` is decided once per document when `lib/ads/ad-signals.ts` is first evaluated (before hydration) — a reload of `/` is a new document with `entry: "home"`; a per-tab flag would need a storage key §11.14 does not allow. `setAdSignals` keeps `scrub: "failed"` sticky.
4. **`readRestoreEntry` validation** is a hand-written guard with a unit test proving parity with a zod schema (spec "zod-valid"), so `lib/privacy/session-restore.ts` does not pull zod into S06's initial bundle (§11.1 rule 3).
5. **`AdLoader`** also refuses while `location.search + location.hash` carries a tracking-like value or a `trackingNumber` query parameter; it inserts after `load` + one idle callback (the old `lazyOnload` timing) and appends to `document.body`.
6. **Transitional props (S02-private, deleted with the files by S06):** `TrackingForm` gains `initialCarrier?: DeliveryCarrierCode` and `onSubmitted?: (number: string, carrier: DeliveryCarrierCode, source: TrackingFormSubmitSource) => void` with `export type TrackingFormSubmitSource = "manual" | "initial"`. `ReturnLinkButton` receives the result's resolved `delivery.carrierCode`.
7. **Redirect value rule:** `has` value `(?<trackingNumber>[A-Za-z0-9][A-Za-z0-9 -]{0,63})`. Next passes the original query through, so the `Location` is `/X?trackingNumber=X[&c=…]` (verified on Next 16.3.6); the scrub removes it on the client.
8. **File Map:** `components/HomePageClient.tsx` and `components/TrackingForm.tsx` (M S02) as listed. S01's final plan asserts the loader only in the DOM (`tests/e2e/internal-isolation.spec.ts` control test: one `script[src*="adsbygoogle.js"]` on `/`, which `AdLoader`'s inserted script satisfies), so no S01 test row needs "M S02"; Task 5 Step 7 still re-checks the merged files and adds "M S02" to a row only if it has to edit an SSR-HTML loader assertion there.

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `lib/privacy/url-scrub.ts` | Create | `isNumberPath`, `scrubNumberFromUrl` (router-ready wait, stash, replace, confirm), popstate guard |
| `lib/privacy/session-restore.ts` | Create | `tt:restore` entry: save/read/clear, navigation kind, TTL, zod-equivalent guard |
| `lib/clipboard.ts` | Create | `copyText` (Clipboard API → selection copy → fallback), `shareOrCopyLink` (share sheet first when asked) |
| `lib/ads/ad-gate.ts` | Create | `AdTimingPolicy`, `AD_TIMING_POLICY`, `AdGateInput`, `shouldInsertAdLoader` (pure, fail-closed) |
| `lib/ads/ad-signals.ts` | Create | Per-document ad signal store (`entry`, `scrub`, `resultAdsAllowed`, `scrolledPastLookup`) |
| `components/ads/AdLoader.tsx` | Create (client) | Inserts the AdSense loader at most once per document when the gate allows |
| `components/ReturnLinkButton.tsx` | Create (client, transitional) | '다시 볼 링크 복사' with share/copy/fallback box |
| `app/(public)/layout.tsx` | Modify | `next/script` loader → `<AdLoader />` |
| `app/(public)/page.tsx` | Modify | Stop reading `searchParams` (static `/`) |
| `next.config.ts` | Modify | `redirects()` for legacy `?trackingNumber` |
| `app/(public)/privacy/page.tsx` | Modify | Policy text: Google page address, Vercel logs, customstrack, tab-only 30 min, link sharing; 시행일 |
| `components/HomePageClient.tsx` | Modify (transitional) | Scrub after hydration, restore on reload/back, return link, (Task 11) same-address history entry |
| `components/TrackingForm.tsx` | Modify (transitional) | Drop number `pushState`; `initialCarrier`, `onSubmitted` |
| `tests/support/network-capture.ts` | Create | Third-party capture/abort, assertions, loader watcher, lookup recorder, idle wait |
| `tests/unit/url-scrub.spec.ts` | Create | Scrub and guard with a fake window |
| `tests/unit/session-restore.spec.ts` | Create | Restore rules incl. zod parity and throwing storage |
| `tests/unit/ad-gate.spec.ts` | Create | Gate table, ledger check, signal store |
| `tests/e2e/return-link.spec.ts` | Create | Copy, carrier, fallback, mobile share |
| `tests/e2e/url-privacy.spec.ts` | Create | SSR 0 ads, home, deep links, fail-closed, navigation rows, local-router regression, same-address entry |
| `tests/e2e/session-restore.spec.ts` | Create | Restore rows incl. blocked/full storage |
| `tests/e2e/legacy-query-redirect.spec.ts` | Create | 307 rules, unsafe values, static `/` |
| `tests/privacy.spec.ts` | Modify (append) | New policy paragraphs |

**Budgets/checks this stage owns (G8):** url-privacy — third-party requests captured and aborted, tracking-like values in URL/body/referer/location-at-request = 0; loader insertions in deep-link documents happen only at `location.pathname === "/"` (count them); at most one loader per document.

**Commands used throughout (PowerShell 5.1, repo root):**
- Unit tests (no web server): `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/<file>.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
- E2E (Playwright starts `next dev` on 43210 through `playwright.config.ts`): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/<file>.spec.ts`
- Paths containing parentheses or brackets are quoted in `git add`, and `Test-Path`/`Get-Content`/`Select-String` use `-LiteralPath` (PowerShell treats `[...]` as a wildcard).
- Line numbers below refer to commit `e079461`; S01 shifts some of them. Every edit quotes the exact text to find; if S01 reformatted that text, apply the same change to the equivalent lines and note it in the stage summary.

---

### Task 0: Stage start

- [ ] **Step 1: Read approvals.** Open `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §4. For every approval number in this plan's "Gated by" list, write its Status into the stage summary. `pending`/`rejected` → execute the fallback steps and mark the gated task SKIPPED with the reason.
- [ ] **Step 2: Confirm dependencies.** Run (PowerShell): `git log --oneline claude/tipoasis-tracking-renewal-ae0e3a -40`
  Expected: a `merge: SNN …` commit for every stage in this plan's "Depends on" list.
- [ ] **Step 3: Branch.** Run: `git switch -c renewal/s02-r1-number-protection claude/tipoasis-tracking-renewal-ae0e3a`
  Expected: `Switched to a new branch 'renewal/s02-r1-number-protection'`.
- [ ] **Step 4: Port free.** Run: `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue`
  Expected: no output. Otherwise stop the listener: `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`
- [ ] **Step 5: Baseline build and before-screens.** Run `npm ci` only if `package-lock.json` changed since the last install in this worktree, then `npm run build`.
  Expected: build exits 0. Start the production server in a background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`
  Wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200`.
  Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='before'; $env:PW_STAGE='S02'; npx playwright test tests/tools/stage-screens.spec.ts`
  Expected: PNGs in `test-artifacts/stage-screens/S02-before/` for widths 320, 375, 768, 1024, 1440. (S01 creates the tool first; S01 runs this step after its Task 1.)
- [ ] **Step 6: Baseline suite.** With the server still running: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test`
  Expected: record "N passed / M skipped / 0 failed" in the stage summary. Then stop the server (Step 4 command) and clear the flags: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.

**S02 notes on the standard steps above**
- Step 1: the "Gated by" list is approval 6 only. Its fallback needs no extra step: Task 3 writes `AD_TIMING_POLICY = "neverOnNumberRoutes"`, and Task 12 (the only gated task) starts with the ledger check and is marked SKIPPED while row 6 is `pending`/`rejected`.
- Step 2: expected `merge: S01 …` (S02 depends on S01 only).
- Step 5: the PNGs land in `test-artifacts/stage-screens/S02-before/`, not `test-results/…` (S01 Addition 1). Step 5 above and gate G7 already carry this path; they are otherwise verbatim copies of roadmap §6/§7, whose text still says `test-results/…` until the roadmap owner applies the amendment. Expect 35 files — S01's seven scenarios × five widths — unless a stage merged earlier appended scenarios. Check with `(Get-ChildItem test-artifacts/stage-screens/S02-before -Filter *.png).Count`.

- [ ] **Step 7 (stage-specific): S01 artifacts exist.** Run:
  `Test-Path -LiteralPath lib/site.ts, lib/privacy/number-patterns.ts, lib/security/headers.ts, next.config.ts, tests/fixtures/tracking-fixtures.ts, tests/support/prod-mode.ts, tests/tools/stage-screens.spec.ts, "app/(public)/layout.tsx", "app/(public)/page.tsx", "app/(public)/privacy/page.tsx", "app/(public)/[trackingNumber]/page.tsx", "app/(internal)/layout.tsx"`
  Expected: twelve lines `True`. Any `False` → stop; S01 is not merged.
- [ ] **Step 8 (stage-specific): Skip work that already exists (hotfix branches).** Run:
  `git log --all --oneline -S "scrubNumberFromUrl"; git log --all --oneline -S "tt:restore"; git grep -n "pushState" -- components; git grep -n "redirects" -- next.config.ts`
  Expected: the two `git log` commands print nothing; `git grep` prints exactly one `components/TrackingForm.tsx` line with ``window.history.pushState(null, "", `/${encodeURIComponent(trimmed)}`)``; `next.config.ts` has no `redirects`. If a hotfix already removed the `pushState` line, skip Task 6 Step 4 and say so in the stage summary; if another branch already contains an S02 module, stop and ask the operator which branch is authoritative.
- [ ] **Step 9 (stage-specific): Record the inherited shapes.** Run:
  `Get-Content -LiteralPath "app/(public)/layout.tsx"; Get-Content -LiteralPath "app/(public)/page.tsx"; Select-String -LiteralPath next.config.ts -Pattern "NextConfig|headers|poweredByHeader"; git grep -n -e "adsbygoogle" -e "googlesyndication" -- tests; git grep -n "export" -- lib/site.ts lib/privacy/number-patterns.ts`
  Expected: `(public)/layout.tsx` imports `Script` from `next/script` and renders one `<Script …>` whose `src` is `ADSENSE_LOADER_URL` (or the literal loader URL); `(public)/page.tsx` still awaits `searchParams` and calls `redirect(...)`; `next.config.ts` is typed `NextConfig` and has `poweredByHeader: false` and `headers`; `lib/site.ts` exports `SITE_ORIGIN`, `ADSENSE_CLIENT_ID`, `ADSENSE_PUBLISHER_DIGITS`, `ADSENSE_LOADER_URL`, `buildReturnLink`; `number-patterns.ts` exports `containsTrackingLikeValue`. Copy every `tests/` line that mentions `adsbygoogle`/`googlesyndication` into the stage summary — Task 5 Step 7 decides what to do with each.

---

### Task 1: Number paths and the candidate-B scrub

**Files:**
- Create: `lib/privacy/url-scrub.ts`
- Test: `tests/unit/url-scrub.spec.ts` (create)

**Interfaces:**
- Consumes: `containsTrackingLikeValue(text: string): boolean` from `lib/privacy/number-patterns.ts` (S01); test-only `FAKE` from `tests/fixtures/tracking-fixtures.ts` (S01).
- Produces (roadmap §11.9): `SCRUB_TIMEOUT_MS = 15000`, `isNumberPath(pathname: string): boolean`, `type ScrubStatus = "scrubbed" | "notNeeded" | "failed"`, `scrubNumberFromUrl(options: { readonly timeoutMs: number; readonly beforeReplace: () => void }): Promise<ScrubStatus>` (never rejects). Side effect after the first ready check: a `popstate` guard on `window` (Additions 2).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/url-scrub.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { SCRUB_TIMEOUT_MS, isNumberPath, scrubNumberFromUrl } from "@/lib/privacy/url-scrub";
import { FAKE } from "../fixtures/tracking-fixtures";

interface ReplaceCall {
  readonly patched: boolean;
  readonly url: string | undefined;
}

interface FakeBrowser {
  readonly replaceCalls: () => readonly ReplaceCall[];
  readonly href: () => string;
  /** What the App Router's HistoryUpdater insertion effect does on its first commit. */
  readonly commitRouter: () => void;
  /** What the App Router's useEffect does later: patch history.replaceState as an own property. */
  readonly patchHistory: () => void;
  readonly runFrames: (count: number) => Promise<void>;
  /** A back/forward traversal inside the document: the URL changes, then popstate listeners run. */
  readonly popTo: (path: string) => void;
}

const ORIGIN = "https://tracking.tipoasis.com";

function installFakeBrowser(
  startPath: string,
  behaviour: { readonly ignoreUrl?: boolean; readonly throwOnReplace?: boolean } = {}
): FakeBrowser {
  let current = new URL(startPath, ORIGIN);
  const replaceCalls: ReplaceCall[] = [];
  const popListeners: Array<() => void> = [];
  let frames: Array<() => void> = [];

  const applyReplace = (patched: boolean, url: string | undefined): void => {
    replaceCalls.push({ patched, url });
    if (behaviour.throwOnReplace) throw new DOMException("The operation is insecure.", "SecurityError");
    if (url !== undefined && !behaviour.ignoreUrl) current = new URL(url, current);
  };

  class FakeHistory {
    state: unknown = null;
    replaceState(_state: unknown, _unused: string, url?: string): void {
      applyReplace(false, url);
    }
  }
  const history = new FakeHistory();

  const fakeWindow = {
    history,
    location: {
      get pathname(): string {
        return current.pathname;
      },
      get search(): string {
        return current.search;
      },
      get hash(): string {
        return current.hash;
      },
      get href(): string {
        return current.href;
      }
    },
    requestAnimationFrame(callback: () => void): number {
      frames.push(callback);
      return frames.length;
    },
    addEventListener(type: string, listener: () => void): void {
      if (type === "popstate") popListeners.push(listener);
    }
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });

  return {
    replaceCalls: () => [...replaceCalls],
    href: () => current.href,
    commitRouter: () => {
      history.state = { __NA: true };
    },
    patchHistory: () => {
      Object.defineProperty(history, "replaceState", {
        configurable: true,
        value: (_state: unknown, _unused: string, url?: string): void => applyReplace(true, url)
      });
    },
    runFrames: async (count: number) => {
      for (let index = 0; index < count; index += 1) {
        const pending = frames;
        frames = [];
        pending.forEach((callback) => callback());
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    },
    popTo: (path: string) => {
      current = new URL(path, ORIGIN);
      popListeners.forEach((listener) => listener());
    }
  };
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

test.afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

test("isNumberPath accepts one number-like segment and nothing else", () => {
  const numberPaths = [`/${FAKE.domestic}`, `/${FAKE.hbl}`, `/${FAKE.cargo}`, "/0000%201234%205678", `/${FAKE.deepLinkInvalid}`];
  const otherPaths = [
    "/",
    "",
    "/privacy",
    "/internal",
    "/internal/cs-helper",
    "/api",
    "/api/track",
    "/robots.txt",
    "/sitemap.xml",
    "/icon.svg",
    `/${FAKE.domestic}.html`,
    `/${FAKE.domestic}/`,
    `/a/${FAKE.domestic}`
  ];
  for (const path of numberPaths) expect(isNumberPath(path), path).toBe(true);
  for (const path of otherPaths) expect(isNumberPath(path), path).toBe(false);
});

test("SCRUB_TIMEOUT_MS is 15 seconds", () => {
  expect(SCRUB_TIMEOUT_MS).toBe(15000);
});

test("'/' needs no scrub and history is untouched", async () => {
  const browser = installFakeBrowser("/");
  let stashed = 0;
  const status = await scrubNumberFromUrl({ timeoutMs: 1000, beforeReplace: () => { stashed += 1; } });
  expect(status).toBe("notNeeded");
  expect(stashed).toBe(0);
  expect(browser.replaceCalls()).toEqual([]);
});

test("waits for the router commit and the history patch, stashes, then replaces path, query and hash with '/'", async () => {
  const browser = installFakeBrowser(`/${FAKE.domestic}?c=CJ#top`);
  const events: string[] = [];
  const pending = scrubNumberFromUrl({
    timeoutMs: 5000,
    beforeReplace: () => {
      events.push(`stash after ${browser.replaceCalls().length} replace calls`);
    }
  });
  await browser.runFrames(2);
  expect(browser.replaceCalls()).toEqual([]);
  browser.commitRouter();
  await browser.runFrames(2);
  // __NA alone is not enough: the router patches replaceState in a later effect.
  expect(browser.replaceCalls()).toEqual([]);
  browser.patchHistory();
  await browser.runFrames(1);
  expect(await pending).toBe("scrubbed");
  expect(events).toEqual(["stash after 0 replace calls"]);
  expect(browser.replaceCalls()).toEqual([{ patched: true, url: "/" }]);
  expect(browser.href()).toBe(`${ORIGIN}/`);
});

test("fails closed when the router never commits before the timeout", async () => {
  const browser = installFakeBrowser(`/${FAKE.domestic}`);
  let stashed = 0;
  const pending = scrubNumberFromUrl({ timeoutMs: 20, beforeReplace: () => { stashed += 1; } });
  await sleep(40);
  await browser.runFrames(1);
  expect(await pending).toBe("failed");
  expect(stashed).toBe(0);
  expect(browser.replaceCalls()).toEqual([]);
  expect(browser.href()).toBe(`${ORIGIN}/${FAKE.domestic}`);
});

test("late first frame (background tab): a ready router is used even after the timeout elapsed", async () => {
  const browser = installFakeBrowser(`/${FAKE.hbl}`);
  const pending = scrubNumberFromUrl({ timeoutMs: 20, beforeReplace: () => undefined });
  browser.commitRouter();
  browser.patchHistory();
  await sleep(40);
  await browser.runFrames(1);
  expect(await pending).toBe("scrubbed");
  expect(browser.href()).toBe(`${ORIGIN}/`);
});

test("a throwing stash does not stop the scrub", async () => {
  const browser = installFakeBrowser(`/${FAKE.domestic}`);
  browser.commitRouter();
  browser.patchHistory();
  const pending = scrubNumberFromUrl({
    timeoutMs: 1000,
    beforeReplace: () => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    }
  });
  await browser.runFrames(1);
  expect(await pending).toBe("scrubbed");
  expect(browser.href()).toBe(`${ORIGIN}/`);
});

test("fails when replaceState throws", async () => {
  const browser = installFakeBrowser(`/${FAKE.domestic}`, { throwOnReplace: true });
  browser.commitRouter();
  browser.patchHistory();
  const pending = scrubNumberFromUrl({ timeoutMs: 1000, beforeReplace: () => undefined });
  await browser.runFrames(1);
  expect(await pending).toBe("failed");
});

test("fails when the browser keeps the old URL", async () => {
  const browser = installFakeBrowser(`/${FAKE.domestic}`, { ignoreUrl: true });
  browser.commitRouter();
  browser.patchHistory();
  const pending = scrubNumberFromUrl({ timeoutMs: 1000, beforeReplace: () => undefined });
  await browser.runFrames(1);
  expect(await pending).toBe("failed");
  expect(browser.href()).toBe(`${ORIGIN}/${FAKE.domestic}`);
});

test("concurrent calls (React Strict Mode effects) share one scrub", async () => {
  const browser = installFakeBrowser(`/${FAKE.hbl}`);
  browser.commitRouter();
  browser.patchHistory();
  let stashed = 0;
  const first = scrubNumberFromUrl({ timeoutMs: 1000, beforeReplace: () => { stashed += 1; } });
  const second = scrubNumberFromUrl({ timeoutMs: 1000, beforeReplace: () => { stashed += 1; } });
  expect(second).toBe(first);
  await browser.runFrames(1);
  expect(await first).toBe("scrubbed");
  expect(stashed).toBe(1);
  expect(browser.replaceCalls()).toHaveLength(1);
});

test("a dot path or a query that still carries a number is scrubbed too", async () => {
  for (const start of [`/${FAKE.domestic}.html`, `/?q=${FAKE.hbl}`]) {
    const browser = installFakeBrowser(start);
    browser.commitRouter();
    browser.patchHistory();
    const pending = scrubNumberFromUrl({ timeoutMs: 1000, beforeReplace: () => undefined });
    await browser.runFrames(1);
    expect(await pending, start).toBe("scrubbed");
    expect(browser.href(), start).toBe(`${ORIGIN}/`);
    Reflect.deleteProperty(globalThis, "window");
  }
});

test("never throws without a window", async () => {
  expect(await scrubNumberFromUrl({ timeoutMs: 10, beforeReplace: () => undefined })).toBe("failed");
});

test("history guard: after a scrub, back/forward to a number URL is replaced with '/' at once", async () => {
  const browser = installFakeBrowser(`/${FAKE.domestic}`);
  browser.commitRouter();
  browser.patchHistory();
  const pending = scrubNumberFromUrl({ timeoutMs: 1000, beforeReplace: () => undefined });
  await browser.runFrames(1);
  expect(await pending).toBe("scrubbed");

  browser.popTo(`/${FAKE.domestic}`);
  expect(browser.href()).toBe(`${ORIGIN}/`);
  browser.popTo(`/?c=CJ#${FAKE.hbl}`);
  expect(browser.href()).toBe(`${ORIGIN}/`);
  browser.popTo("/privacy");
  expect(browser.href()).toBe(`${ORIGIN}/privacy`);
  expect(browser.replaceCalls().map((call) => call.url)).toEqual(["/", "/", "/"]);
});

test("no history guard when the router never became ready", async () => {
  const browser = installFakeBrowser(`/${FAKE.domestic}`);
  const pending = scrubNumberFromUrl({ timeoutMs: 20, beforeReplace: () => undefined });
  await sleep(40);
  await browser.runFrames(1);
  expect(await pending).toBe("failed");
  browser.popTo(`/${FAKE.hbl}`);
  expect(browser.replaceCalls()).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/url-scrub.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — the run stops with `Cannot find module` for `@/lib/privacy/url-scrub` (the module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `lib/privacy/url-scrub.ts`:

```ts
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";

/**
 * Candidate B URL scrub (spec §3, GAP1-02). Browser only; never rejects.
 * ① wait (rAF retries) until the App Router committed its first history entry (history.state.__NA)
 *   and installed its history.replaceState patch (an own property of window.history),
 * ② beforeReplace() — the caller stashes { number, carrier, savedAt } for restore,
 * ③ history.replaceState(null, "", "/") — drops path, query and hash,
 * ④ confirm that location is exactly "/".
 * Scrubbing from an inline <head> script before hydration is forbidden (GAP1-01).
 */
export const SCRUB_TIMEOUT_MS = 15000;

export type ScrubStatus = "scrubbed" | "notNeeded" | "failed";

interface ScrubOptions {
  readonly timeoutMs: number;
  readonly beforeReplace: () => void;
}

const RESERVED_SEGMENTS: ReadonlySet<string> = new Set(["privacy", "internal", "api"]);
const SINGLE_SEGMENT = /^\/([^/]+)$/;

/** One path segment that is not privacy|internal|api and has no dot. */
export function isNumberPath(pathname: string): boolean {
  const match = SINGLE_SEGMENT.exec(pathname);
  if (!match) return false;
  const segment = match[1];
  return !segment.includes(".") && !RESERVED_SEGMENTS.has(segment);
}

function urlCarriesNumber(): boolean {
  const { pathname, search, hash } = window.location;
  if (isNumberPath(pathname)) return true;
  try {
    return containsTrackingLikeValue(`${pathname}${search}${hash}`);
  } catch {
    return true;
  }
}

function isHistoryPatched(): boolean {
  return Object.prototype.hasOwnProperty.call(window.history, "replaceState");
}

function isRouterReady(): boolean {
  const state: unknown = window.history.state;
  const committed = typeof state === "object" && state !== null && "__NA" in state && state.__NA === true;
  return committed && isHistoryPatched();
}

function isRoot(): boolean {
  const { pathname, search, hash } = window.location;
  return pathname === "/" && search === "" && hash === "";
}

function waitForRouter(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const tick = (): void => {
      if (isRouterReady()) {
        resolve(true);
        return;
      }
      if (performance.now() - startedAt >= timeoutMs) {
        resolve(false);
        return;
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  });
}

const guardedWindows = new WeakSet<object>();

/**
 * History entries created before hydration (for example a #hash link tapped while scripts were still
 * loading) keep the number. Back/forward to such an entry is replaced with "/" inside the same task,
 * before any other script can read location.
 */
function installHistoryGuard(): void {
  if (guardedWindows.has(window)) return;
  guardedWindows.add(window);
  window.addEventListener("popstate", () => {
    try {
      if (urlCarriesNumber() && isHistoryPatched()) window.history.replaceState(null, "", "/");
    } catch {
      // The ad gate still sees the number path and keeps the loader out.
    }
  });
}

async function runScrub({ timeoutMs, beforeReplace }: ScrubOptions): Promise<ScrubStatus> {
  try {
    if (typeof window === "undefined") return "failed";
    if (!urlCarriesNumber()) return "notNeeded";
    if (!(await waitForRouter(timeoutMs))) return "failed";
    installHistoryGuard();
    if (!urlCarriesNumber()) return "notNeeded";
    try {
      beforeReplace();
    } catch {
      // The restore stash is a convenience; the scrub goes ahead.
    }
    window.history.replaceState(null, "", "/");
    return isRoot() ? "scrubbed" : "failed";
  } catch {
    return "failed";
  }
}

let inFlight: Promise<ScrubStatus> | null = null;

export function scrubNumberFromUrl(options: ScrubOptions): Promise<ScrubStatus> {
  if (inFlight) return inFlight;
  const run = runScrub(options).then((status) => {
    inFlight = null;
    return status;
  });
  inFlight = run;
  return run;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/url-scrub.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `14 passed`.

- [ ] **Step 5: Typecheck and lint the new files**

Run: `npm run typecheck; npx eslint lib/privacy/url-scrub.ts tests/unit/url-scrub.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 6: Commit**

```powershell
git add lib/privacy/url-scrub.ts tests/unit/url-scrub.spec.ts
git commit -m "feat: add candidate-B URL scrub with router-ready wait and history guard"
```

Expected: `[renewal/s02-r1-number-protection …] feat: add candidate-B URL scrub …` and `2 files changed`.

---

### Task 2: Session restore store

**Files:**
- Create: `lib/privacy/session-restore.ts`
- Test: `tests/unit/session-restore.spec.ts` (create)

**Interfaces:**
- Consumes: `DELIVERY_CARRIER_CODES`, `DeliveryCarrierCode` from `lib/types.ts` (frozen); test-only `FAKE`, `FIXTURE_NOW` (S01), `z` from `zod`.
- Produces (roadmap §11.9): `RESTORE_KEY = "tt:restore"`, `RESTORE_TTL_MS = 1800000`, `interface RestoreEntry { number; carrier; savedAt }`, `type NavigationKind = "navigate" | "reload" | "back_forward" | "prerender" | "unknown"`, `type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">`, `currentNavigationKind(): NavigationKind`, `saveRestoreEntry(entry, storage?): void`, `readRestoreEntry({ now, navigation }, storage?): RestoreEntry | null`, `clearRestoreEntry(storage?): void`. Storage errors are swallowed; the default storage is `window.sessionStorage` (a throwing getter counts as "no storage").

- [ ] **Step 1: Write the failing test**

Create `tests/unit/session-restore.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { z } from "zod";
import {
  RESTORE_KEY,
  RESTORE_TTL_MS,
  clearRestoreEntry,
  currentNavigationKind,
  readRestoreEntry,
  saveRestoreEntry
} from "@/lib/privacy/session-restore";
import type { NavigationKind, RestoreEntry, StorageLike } from "@/lib/privacy/session-restore";
import { DELIVERY_CARRIER_CODES } from "@/lib/types";
import { FAKE, FIXTURE_NOW } from "../fixtures/tracking-fixtures";

class MemoryStorage implements StorageLike {
  private readonly items = new Map<string, string>();

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  keys(): readonly string[] {
    return [...this.items.keys()];
  }
}

class ThrowingStorage implements StorageLike {
  getItem(): string | null {
    throw new DOMException("The operation is insecure.", "SecurityError");
  }

  setItem(): void {
    throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
  }

  removeItem(): void {
    throw new DOMException("The operation is insecure.", "SecurityError");
  }
}

const NOW = FIXTURE_NOW.getTime();
const ENTRY: RestoreEntry = { number: FAKE.domestic, carrier: "CJ", savedAt: NOW - 60_000 };

/** The schema the hand-written guard must agree with (spec: restore entries are zod-valid). */
const RestoreEntrySchema = z.object({
  number: z
    .string()
    .max(64)
    .refine((value) => value.trim().length > 0),
  carrier: z.enum(DELIVERY_CARRIER_CODES),
  savedAt: z.number().int().nonnegative()
});

test("key and lifetime follow the contract", () => {
  expect(RESTORE_KEY).toBe("tt:restore");
  expect(RESTORE_TTL_MS).toBe(30 * 60 * 1000);
});

test("a saved entry comes back on reload and back_forward", () => {
  const storage = new MemoryStorage();
  saveRestoreEntry(ENTRY, storage);
  expect(readRestoreEntry({ now: NOW, navigation: "reload" }, storage)).toEqual(ENTRY);
  expect(readRestoreEntry({ now: NOW, navigation: "back_forward" }, storage)).toEqual(ENTRY);
});

test("other navigations never restore and leave the entry alone", () => {
  const storage = new MemoryStorage();
  saveRestoreEntry(ENTRY, storage);
  const others: readonly NavigationKind[] = ["navigate", "prerender", "unknown"];
  for (const navigation of others) {
    expect(readRestoreEntry({ now: NOW, navigation }, storage), navigation).toBeNull();
  }
  expect(storage.getItem(RESTORE_KEY)).not.toBeNull();
});

test("the entry lives exactly 30 minutes, then it is removed", () => {
  const storage = new MemoryStorage();
  const entry: RestoreEntry = { ...ENTRY, savedAt: NOW - RESTORE_TTL_MS };
  saveRestoreEntry(entry, storage);
  expect(readRestoreEntry({ now: NOW, navigation: "reload" }, storage)).toEqual(entry);
  expect(readRestoreEntry({ now: NOW + 1, navigation: "reload" }, storage)).toBeNull();
  expect(storage.getItem(RESTORE_KEY)).toBeNull();
});

test("an entry saved in the future (clock moved back) is dropped", () => {
  const storage = new MemoryStorage();
  saveRestoreEntry({ ...ENTRY, savedAt: NOW + 1 }, storage);
  expect(readRestoreEntry({ now: NOW, navigation: "reload" }, storage)).toBeNull();
  expect(storage.getItem(RESTORE_KEY)).toBeNull();
});

test("saving again overwrites the single entry under the single key", () => {
  const storage = new MemoryStorage();
  saveRestoreEntry(ENTRY, storage);
  const second: RestoreEntry = { number: FAKE.hbl, carrier: "AUTO", savedAt: NOW - 1000 };
  saveRestoreEntry(second, storage);
  expect(storage.keys()).toEqual([RESTORE_KEY]);
  expect(readRestoreEntry({ now: NOW, navigation: "reload" }, storage)).toEqual(second);
});

test("stored values are accepted exactly when the zod schema accepts them; rejected ones are removed", () => {
  const candidates: readonly unknown[] = [
    ENTRY,
    { ...ENTRY, carrier: "AUTO" },
    { ...ENTRY, extra: true },
    { ...ENTRY, number: "" },
    { ...ENTRY, number: "   " },
    { ...ENTRY, number: "0".repeat(65) },
    { ...ENTRY, number: 12 },
    { ...ENTRY, carrier: "DHL" },
    { ...ENTRY, carrier: null },
    { ...ENTRY, savedAt: -1 },
    { ...ENTRY, savedAt: 1.5 },
    { ...ENTRY, savedAt: String(ENTRY.savedAt) },
    { number: ENTRY.number, carrier: ENTRY.carrier },
    null,
    42,
    "text",
    [ENTRY]
  ];
  for (const candidate of candidates) {
    const storage = new MemoryStorage();
    storage.setItem(RESTORE_KEY, JSON.stringify(candidate));
    const restored = readRestoreEntry({ now: NOW, navigation: "reload" }, storage);
    const valid = RestoreEntrySchema.safeParse(candidate).success;
    expect(restored !== null, JSON.stringify(candidate)).toBe(valid);
    if (!valid) expect(storage.getItem(RESTORE_KEY), JSON.stringify(candidate)).toBeNull();
  }
});

test("corrupted JSON is dropped and removed", () => {
  const storage = new MemoryStorage();
  storage.setItem(RESTORE_KEY, "{not json");
  expect(readRestoreEntry({ now: NOW, navigation: "reload" }, storage)).toBeNull();
  expect(storage.getItem(RESTORE_KEY)).toBeNull();
});

test("an invalid entry is never written", () => {
  const storage = new MemoryStorage();
  saveRestoreEntry({ ...ENTRY, number: "   " }, storage);
  saveRestoreEntry({ ...ENTRY, savedAt: -5 }, storage);
  saveRestoreEntry({ ...ENTRY, number: "0".repeat(65) }, storage);
  expect(storage.keys()).toEqual([]);
});

test("storage errors are swallowed", () => {
  const storage = new ThrowingStorage();
  expect(() => saveRestoreEntry(ENTRY, storage)).not.toThrow();
  expect(readRestoreEntry({ now: NOW, navigation: "reload" }, storage)).toBeNull();
  expect(() => clearRestoreEntry(storage)).not.toThrow();
});

test("no storage (null, or no window in this Node process) is a no-op", () => {
  expect(() => saveRestoreEntry(ENTRY, null)).not.toThrow();
  expect(readRestoreEntry({ now: NOW, navigation: "reload" }, null)).toBeNull();
  expect(() => saveRestoreEntry(ENTRY)).not.toThrow();
  expect(readRestoreEntry({ now: NOW, navigation: "reload" })).toBeNull();
  expect(() => clearRestoreEntry()).not.toThrow();
});

test("clearRestoreEntry removes the entry", () => {
  const storage = new MemoryStorage();
  saveRestoreEntry(ENTRY, storage);
  clearRestoreEntry(storage);
  expect(storage.keys()).toEqual([]);
});

test("currentNavigationKind is 'unknown' outside a browser", () => {
  expect(currentNavigationKind()).toBe("unknown");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/session-restore.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `Cannot find module` for `@/lib/privacy/session-restore`.

- [ ] **Step 3: Write the implementation**

Create `lib/privacy/session-restore.ts`:

```ts
import { DELIVERY_CARRIER_CODES } from "@/lib/types";
import type { DeliveryCarrierCode } from "@/lib/types";

/**
 * Tab-only restore of the last lookup (spec §3): sessionStorage, one entry, 30 minutes,
 * restored only on reload and back_forward navigations. Browser only; storage errors are swallowed.
 * Validation mirrors a zod schema by hand (parity is unit-tested) so zod stays out of the initial bundle.
 */
export const RESTORE_KEY = "tt:restore";
export const RESTORE_TTL_MS = 1800000;

export interface RestoreEntry {
  readonly number: string;
  readonly carrier: DeliveryCarrierCode;
  readonly savedAt: number;
}

export type NavigationKind = "navigate" | "reload" | "back_forward" | "prerender" | "unknown";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const MAX_NUMBER_LENGTH = 64;
const RESTORABLE_NAVIGATIONS: ReadonlySet<NavigationKind> = new Set<NavigationKind>(["reload", "back_forward"]);

export function currentNavigationKind(): NavigationKind {
  try {
    if (typeof performance === "undefined" || typeof PerformanceNavigationTiming === "undefined") return "unknown";
    const [entry] = performance.getEntriesByType("navigation");
    if (!(entry instanceof PerformanceNavigationTiming)) return "unknown";
    switch (entry.type) {
      case "navigate":
      case "reload":
      case "back_forward":
      case "prerender":
        return entry.type;
      default:
        return "unknown";
    }
  } catch {
    return "unknown";
  }
}

function isCarrierCode(value: string): value is DeliveryCarrierCode {
  return DELIVERY_CARRIER_CODES.some((code) => code === value);
}

function toRestoreEntry(value: unknown): RestoreEntry | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("number" in value) || !("carrier" in value) || !("savedAt" in value)) return null;
  const { number, carrier, savedAt } = value;
  if (typeof number !== "string" || number.trim().length === 0 || number.length > MAX_NUMBER_LENGTH) return null;
  if (typeof carrier !== "string" || !isCarrierCode(carrier)) return null;
  if (typeof savedAt !== "number" || !Number.isInteger(savedAt) || savedAt < 0) return null;
  return { number, carrier, savedAt };
}

function parseJson(raw: string): unknown {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}

function sessionStore(storage: StorageLike | null | undefined): StorageLike | null {
  if (storage !== undefined) return storage;
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveRestoreEntry(entry: RestoreEntry, storage?: StorageLike | null): void {
  const valid = toRestoreEntry(entry);
  const target = sessionStore(storage);
  if (!valid || !target) return;
  try {
    target.setItem(RESTORE_KEY, JSON.stringify(valid));
  } catch {
    // Quota, private mode or blocked storage: restore is a convenience.
  }
}

export function readRestoreEntry(
  input: { readonly now: number; readonly navigation: NavigationKind },
  storage?: StorageLike | null
): RestoreEntry | null {
  if (!RESTORABLE_NAVIGATIONS.has(input.navigation)) return null;
  const target = sessionStore(storage);
  if (!target) return null;
  try {
    const raw = target.getItem(RESTORE_KEY);
    if (raw === null) return null;
    const entry = toRestoreEntry(parseJson(raw));
    if (entry) {
      const age = input.now - entry.savedAt;
      if (age >= 0 && age <= RESTORE_TTL_MS) return entry;
    }
    target.removeItem(RESTORE_KEY);
    return null;
  } catch {
    return null;
  }
}

export function clearRestoreEntry(storage?: StorageLike | null): void {
  const target = sessionStore(storage);
  if (!target) return;
  try {
    target.removeItem(RESTORE_KEY);
  } catch {
    // Blocked storage has nothing to clear.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/session-restore.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `13 passed`.

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck; npx eslint lib/privacy/session-restore.ts tests/unit/session-restore.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 6: Commit**

```powershell
git add lib/privacy/session-restore.ts tests/unit/session-restore.spec.ts
git commit -m "feat: add tab-only session restore store for the last lookup"
```

Expected: `2 files changed`.

---

### Task 3: Ad gate and ad signals

**Files:**
- Create: `lib/ads/ad-gate.ts`
- Create: `lib/ads/ad-signals.ts`
- Test: `tests/unit/ad-gate.spec.ts` (create)

**Interfaces:**
- Consumes: `isNumberPath`, `ScrubStatus` (Task 1); `containsTrackingLikeValue` (S01); test-only `FAKE` (S01), `node:fs`, the roadmap ledger file.
- Produces (roadmap §11.9): `type AdTimingPolicy = "afterScrub" | "afterAllowedResult" | "neverOnNumberRoutes"`, `AD_TIMING_POLICY: AdTimingPolicy` (= `"neverOnNumberRoutes"` until Task 12), `interface AdGateInput { pathname; entry; scrub; resultAdsAllowed; scrolledPastLookup; policy }`, `shouldInsertAdLoader(input: AdGateInput): boolean`; `interface AdSignals { entry; scrub; resultAdsAllowed; scrolledPastLookup }`, `getAdSignals(): AdSignals`, `setAdSignals(patch: Partial<AdSignals>): void`, `subscribeAdSignals(listener: () => void): () => void`. Rules in Additions 3.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ad-gate.spec.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { AD_TIMING_POLICY, shouldInsertAdLoader } from "@/lib/ads/ad-gate";
import type { AdGateInput, AdTimingPolicy } from "@/lib/ads/ad-gate";
import { getAdSignals, setAdSignals, subscribeAdSignals } from "@/lib/ads/ad-signals";
import type { ScrubStatus } from "@/lib/privacy/url-scrub";
import { FAKE } from "../fixtures/tracking-fixtures";

const POLICIES: readonly AdTimingPolicy[] = ["afterScrub", "afterAllowedResult", "neverOnNumberRoutes"];
const SCRUBS: ReadonlyArray<ScrubStatus | "pending"> = ["pending", "scrubbed", "notNeeded", "failed"];
const ENTRIES: ReadonlyArray<AdGateInput["entry"]> = ["home", "deepLink"];

function gate(overrides: Partial<AdGateInput>): boolean {
  return shouldInsertAdLoader({
    pathname: "/",
    entry: "home",
    scrub: "pending",
    resultAdsAllowed: null,
    scrolledPastLookup: false,
    policy: "afterScrub",
    ...overrides
  });
}

test("no policy inserts the loader on a number, tracking-like or /internal path", () => {
  const paths = [
    `/${FAKE.domestic}`,
    `/${FAKE.hbl}`,
    `/${FAKE.domestic}.html`,
    `/a/${FAKE.domestic}`,
    "/internal",
    "/internal/cs-helper"
  ];
  for (const policy of POLICIES) {
    for (const pathname of paths) {
      for (const entry of ENTRIES) {
        for (const scrub of SCRUBS) {
          const allowed = gate({ policy, pathname, entry, scrub, resultAdsAllowed: true, scrolledPastLookup: true });
          expect(allowed, `${policy} ${pathname} ${entry} ${scrub}`).toBe(false);
        }
      }
    }
  }
});

test("a failed scrub keeps the loader out under every policy", () => {
  for (const policy of POLICIES) {
    for (const entry of ENTRIES) {
      for (const pathname of ["/", "/privacy"]) {
        const allowed = gate({ policy, entry, pathname, scrub: "failed", resultAdsAllowed: true, scrolledPastLookup: true });
        expect(allowed, `${policy} ${entry} ${pathname}`).toBe(false);
      }
    }
  }
});

test("afterScrub: home documents at once, deep-link documents only after a confirmed scrub", () => {
  expect(gate({ policy: "afterScrub", entry: "home", scrub: "pending" })).toBe(true);
  expect(gate({ policy: "afterScrub", entry: "home", scrub: "notNeeded" })).toBe(true);
  expect(gate({ policy: "afterScrub", entry: "home", pathname: "/privacy" })).toBe(true);
  expect(gate({ policy: "afterScrub", entry: "deepLink", scrub: "pending" })).toBe(false);
  expect(gate({ policy: "afterScrub", entry: "deepLink", scrub: "notNeeded" })).toBe(false);
  expect(gate({ policy: "afterScrub", entry: "deepLink", scrub: "scrubbed" })).toBe(true);
  expect(gate({ policy: "afterScrub", entry: "deepLink", scrub: "scrubbed", pathname: "/privacy" })).toBe(true);
});

test("neverOnNumberRoutes: only documents that started on '/' or /privacy", () => {
  expect(gate({ policy: "neverOnNumberRoutes", entry: "home", scrub: "pending" })).toBe(true);
  expect(gate({ policy: "neverOnNumberRoutes", entry: "home", pathname: "/privacy" })).toBe(true);
  for (const scrub of ["pending", "scrubbed", "notNeeded"] as const) {
    expect(gate({ policy: "neverOnNumberRoutes", entry: "deepLink", scrub, resultAdsAllowed: true }), scrub).toBe(false);
  }
});

test("afterAllowedResult stays closed until S08 implements it", () => {
  for (const entry of ENTRIES) {
    for (const scrub of ["pending", "scrubbed", "notNeeded"] as const) {
      const allowed = gate({ policy: "afterAllowedResult", entry, scrub, resultAdsAllowed: true, scrolledPastLookup: true });
      expect(allowed, `${entry} ${scrub}`).toBe(false);
    }
  }
});

test("AD_TIMING_POLICY follows approval 6 in the roadmap ledger", () => {
  const ledger = readFileSync(path.join(process.cwd(), "docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md"), "utf8");
  const status = /^\| 6 \| [^|]+\| (\w+) \|/m.exec(ledger)?.[1];
  expect(status, "approval 6 row not found in roadmap §4").toBeTruthy();
  if (status === "approved") {
    expect(["afterScrub", "afterAllowedResult"]).toContain(AD_TIMING_POLICY);
  } else {
    expect(AD_TIMING_POLICY).toBe("neverOnNumberRoutes");
  }
});

test("ad signals: per-document entry, change-only notifications, sticky failed scrub", () => {
  // No window in this Node process: the entry falls back to the fail-closed "deepLink".
  expect(getAdSignals()).toEqual({ entry: "deepLink", scrub: "pending", resultAdsAllowed: null, scrolledPastLookup: false });
  let notified = 0;
  const unsubscribe = subscribeAdSignals(() => {
    notified += 1;
  });

  setAdSignals({ scrub: "scrubbed" });
  expect(getAdSignals().scrub).toBe("scrubbed");
  expect(notified).toBe(1);
  setAdSignals({ scrub: "scrubbed" });
  expect(notified).toBe(1);

  const before = getAdSignals();
  setAdSignals({ resultAdsAllowed: true });
  expect(before.resultAdsAllowed).toBeNull();
  expect(getAdSignals().resultAdsAllowed).toBe(true);
  expect(notified).toBe(2);

  setAdSignals({ scrub: "failed" });
  setAdSignals({ scrub: "scrubbed" });
  expect(getAdSignals().scrub).toBe("failed");
  expect(notified).toBe(3);

  unsubscribe();
  setAdSignals({ scrolledPastLookup: true });
  expect(notified).toBe(3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ad-gate.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `Cannot find module` for `@/lib/ads/ad-gate`.

- [ ] **Step 3: Write the gate**

(If Task 0 Step 1 recorded approval 6 as `approved`, the ledger test expects the approved policy already: write the file below, then apply Task 12 Step 3 immediately so Step 5 passes, and mark Task 12 "done in Task 3".)

Create `lib/ads/ad-gate.ts`:

```ts
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import { isNumberPath } from "@/lib/privacy/url-scrub";
import type { ScrubStatus } from "@/lib/privacy/url-scrub";

/**
 * When the AdSense loader may be inserted (spec §3, §8, §16 items 6–7). Pure and fail-closed.
 * - "neverOnNumberRoutes": approval 6 fallback — a document that started on a number route never gets the loader.
 * - "afterScrub": approval 6 — a number-route document gets it once the URL scrub is confirmed.
 * - "afterAllowedResult": approval 7 — implemented by S08; closed until then.
 */
export type AdTimingPolicy = "afterScrub" | "afterAllowedResult" | "neverOnNumberRoutes";

/** Approval 6 is pending in roadmap §4 → fallback. S02 Task 12 switches this to "afterScrub" when approval 6 is recorded. */
export const AD_TIMING_POLICY: AdTimingPolicy = "neverOnNumberRoutes";

export interface AdGateInput {
  readonly pathname: string;
  readonly entry: "home" | "deepLink";
  readonly scrub: ScrubStatus | "pending";
  readonly resultAdsAllowed: boolean | null;
  readonly scrolledPastLookup: boolean;
  readonly policy: AdTimingPolicy;
}

function isInternalPath(pathname: string): boolean {
  return pathname === "/internal" || pathname.startsWith("/internal/");
}

function pathAllowsAds(pathname: string): boolean {
  if (isNumberPath(pathname) || isInternalPath(pathname)) return false;
  try {
    return !containsTrackingLikeValue(pathname);
  } catch {
    return false;
  }
}

export function shouldInsertAdLoader(input: AdGateInput): boolean {
  if (!pathAllowsAds(input.pathname) || input.scrub === "failed") return false;
  switch (input.policy) {
    case "neverOnNumberRoutes":
      return input.entry === "home";
    case "afterScrub":
      return input.entry === "home" || input.scrub === "scrubbed";
    case "afterAllowedResult":
      return false;
  }
}
```

- [ ] **Step 4: Write the signal store**

Create `lib/ads/ad-signals.ts`:

```ts
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import { isNumberPath } from "@/lib/privacy/url-scrub";
import type { ScrubStatus } from "@/lib/privacy/url-scrub";

/** Per-document inputs of the ad gate (spec §8). Browser store; read by AdLoader, written by the page. */
export interface AdSignals {
  readonly entry: "home" | "deepLink";
  readonly scrub: ScrubStatus | "pending";
  readonly resultAdsAllowed: boolean | null;
  readonly scrolledPastLookup: boolean;
}

function detectEntry(): AdSignals["entry"] {
  if (typeof window === "undefined") return "deepLink";
  try {
    const { pathname, search, hash } = window.location;
    const carriesNumber = isNumberPath(pathname) || containsTrackingLikeValue(`${pathname}${search}${hash}`);
    return carriesNumber ? "deepLink" : "home";
  } catch {
    return "deepLink";
  }
}

// Decided once per document, when this module is first evaluated in the browser: that happens while
// hydrating, before any effect (and so before the URL scrub) runs.
let signals: AdSignals = {
  entry: detectEntry(),
  scrub: "pending",
  resultAdsAllowed: null,
  scrolledPastLookup: false
};
const listeners = new Set<() => void>();

export function getAdSignals(): AdSignals {
  return signals;
}

export function setAdSignals(patch: Partial<AdSignals>): void {
  const next: AdSignals = {
    entry: patch.entry ?? signals.entry,
    // A failed scrub stops ads for the rest of the document (spec §15: fail-closed).
    scrub: signals.scrub === "failed" ? "failed" : (patch.scrub ?? signals.scrub),
    resultAdsAllowed: patch.resultAdsAllowed === undefined ? signals.resultAdsAllowed : patch.resultAdsAllowed,
    scrolledPastLookup: patch.scrolledPastLookup ?? signals.scrolledPastLookup
  };
  const unchanged =
    next.entry === signals.entry &&
    next.scrub === signals.scrub &&
    next.resultAdsAllowed === signals.resultAdsAllowed &&
    next.scrolledPastLookup === signals.scrolledPastLookup;
  if (unchanged) return;
  signals = next;
  listeners.forEach((listener) => listener());
}

export function subscribeAdSignals(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ad-gate.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `7 passed`.

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck; npx eslint lib/ads tests/unit/ad-gate.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 7: Commit**

```powershell
git add lib/ads/ad-gate.ts lib/ads/ad-signals.ts tests/unit/ad-gate.spec.ts
git commit -m "feat: add fail-closed ad loader gate and per-document ad signals"
```

Expected: `3 files changed`.

---

### Task 4: Clipboard helpers and [다시 볼 링크 복사]

**Files:**
- Create: `lib/clipboard.ts`
- Create: `components/ReturnLinkButton.tsx`
- Modify: `components/HomePageClient.tsx` (imports near lines 18–20; the result block around line 178 `<TrackingResultSummary data={result} />`)
- Test: `tests/e2e/return-link.spec.ts` (create)

**Interfaces:**
- Consumes: `buildReturnLink(number: string, carrier: DeliveryCarrierCode): string` from `lib/site.ts` (S01); `DeliveryCarrierCode`, `TrackResponseData` from `lib/types.ts`; test-only `FAKE`, `trackData`, `mockTrack` (S01).
- Produces (roadmap §11.9): `type CopyOutcome = "copied" | "fallback"`, `copyText(text: string): Promise<CopyOutcome>`, `type ShareOutcome = "shared" | "copied" | "fallback" | "dismissed"`, `shareOrCopyLink(input: { readonly url: string; readonly title: string; readonly preferShare: boolean }): Promise<ShareOutcome>` (S05's `CopyButton` consumes `copyText`); `ReturnLinkButton(props: { readonly number: string; readonly carrier: DeliveryCarrierCode }): React.JSX.Element` rendered under the current result summary. The button's accessible name '다시 볼 링크 복사' is the "result settled" hook for every S02 E2E file.

- [ ] **Step 1: Write the failing E2E test**

Create `tests/e2e/return-link.spec.ts`:

```ts
import { devices, expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { buildReturnLink } from "@/lib/site";
import type { TrackResponseData } from "@/lib/types";
import { FAKE, mockTrack, trackData } from "../fixtures/tracking-fixtures";

const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";
const RETURN_LINK = { name: "다시 볼 링크 복사" } as const;

type ShareMode = "resolve" | "abort" | "deny";

function inTransitWith(carrierCode: "AUTO" | "CJ"): TrackResponseData {
  const base = trackData("inTransit", { trackingNumber: FAKE.domestic });
  return {
    ...base,
    delivery: { ...base.delivery, carrierCode, carrier: carrierCode === "CJ" ? "CJ대한통운" : "택배사 자동 확인" }
  };
}

async function lookUpFromHome(page: Page, number: string): Promise<void> {
  await page.goto("/");
  const input = page.getByLabel(INPUT_LABEL, { exact: true });
  await input.fill(number);
  await input.press("Enter");
  await expect(page.getByRole("button", RETURN_LINK)).toBeVisible();
}

async function removeShareSheet(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
}

async function stubMobileShare(page: Page, mode: ShareMode): Promise<void> {
  await page.addInitScript((shareMode: string) => {
    const shareUrls: string[] = [];
    const clipboardWrites: string[] = [];
    Object.defineProperty(window, "__ttShareUrls", { value: shareUrls });
    Object.defineProperty(window, "__ttClipboardWrites", { value: clipboardWrites });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: (): boolean => true });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: (data: ShareData): Promise<void> => {
        shareUrls.push(String(data.url));
        if (shareMode === "abort") return Promise.reject(new DOMException("Share canceled.", "AbortError"));
        if (shareMode === "deny") return Promise.reject(new DOMException("Permission denied.", "NotAllowedError"));
        return Promise.resolve();
      }
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string): Promise<void> => {
          clipboardWrites.push(text);
          return Promise.resolve();
        }
      }
    });
  }, mode);
}

async function recorded(page: Page, key: "__ttShareUrls" | "__ttClipboardWrites"): Promise<readonly string[]> {
  return page.evaluate((name) => {
    const value: unknown = Reflect.get(window, name);
    return Array.isArray(value) ? value.map((item) => String(item)) : [];
  }, key);
}

test.describe("desktop", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("copies a link that reopens this result", async ({ page }) => {
    await removeShareSheet(page);
    await mockTrack(page, inTransitWith("AUTO"));
    await lookUpFromHome(page, FAKE.domestic);
    await page.getByRole("button", RETURN_LINK).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(buildReturnLink(FAKE.domestic, "AUTO"));
  });

  test("keeps the carrier in the link", async ({ page }) => {
    await removeShareSheet(page);
    await mockTrack(page, inTransitWith("CJ"));
    await page.goto(`/${FAKE.domestic}?c=CJ`);
    await page.getByRole("button", RETURN_LINK).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(buildReturnLink(FAKE.domestic, "CJ"));
  });
});

test("falls back to a read-only, pre-selected link box when copying is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (): Promise<void> => Promise.reject(new DOMException("Write permission denied.", "NotAllowedError"))
      }
    });
    Object.defineProperty(document, "execCommand", { configurable: true, value: (): boolean => false });
  });
  await mockTrack(page, inTransitWith("AUTO"));
  await lookUpFromHome(page, FAKE.domestic);
  await page.getByRole("button", RETURN_LINK).click();
  const link = buildReturnLink(FAKE.domestic, "AUTO");
  const box = page.locator("textarea[readonly]");
  await expect(box).toHaveValue(link);
  await expect
    .poll(() =>
      box.evaluate((element) => (element instanceof HTMLTextAreaElement ? element.selectionEnd - element.selectionStart : -1))
    )
    .toBe(link.length);
});

test.describe("mobile: share sheet first", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: devices["Pixel 7"].userAgent
  });

  test("opens the share sheet with the return link instead of copying", async ({ page }) => {
    await stubMobileShare(page, "resolve");
    await mockTrack(page, inTransitWith("AUTO"));
    await lookUpFromHome(page, FAKE.domestic);
    await page.getByRole("button", RETURN_LINK).click();
    await expect.poll(() => recorded(page, "__ttShareUrls")).toEqual([buildReturnLink(FAKE.domestic, "AUTO")]);
    expect(await recorded(page, "__ttClipboardWrites")).toEqual([]);
  });

  test("a dismissed share sheet changes nothing", async ({ page }) => {
    await stubMobileShare(page, "abort");
    await mockTrack(page, inTransitWith("AUTO"));
    await lookUpFromHome(page, FAKE.domestic);
    await page.getByRole("button", RETURN_LINK).click();
    await expect.poll(() => recorded(page, "__ttShareUrls")).toHaveLength(1);
    expect(await recorded(page, "__ttClipboardWrites")).toEqual([]);
    await expect(page.locator("textarea[readonly]")).toHaveCount(0);
  });

  test("a denied share sheet falls back to copying", async ({ page }) => {
    await stubMobileShare(page, "deny");
    await mockTrack(page, inTransitWith("AUTO"));
    await lookUpFromHome(page, FAKE.domestic);
    await page.getByRole("button", RETURN_LINK).click();
    await expect.poll(() => recorded(page, "__ttClipboardWrites")).toEqual([buildReturnLink(FAKE.domestic, "AUTO")]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/return-link.spec.ts`
Expected: FAIL — `6 failed`; each stops at `expect(getByRole('button', { name: '다시 볼 링크 복사' })).toBeVisible()` ("element(s) not found"), or at the first `click` on that button for "keeps the carrier in the link".

- [ ] **Step 3: Write the clipboard helpers**

Create `lib/clipboard.ts`:

```ts
/**
 * Copy and share with in-app-browser fallbacks (spec §3 "공유", roadmap Review Focus 3). Browser only; never rejects.
 * copyText: Clipboard API → selection copy (older webviews) → "fallback" (the caller shows a read-only text box).
 */
export type CopyOutcome = "copied" | "fallback";
export type ShareOutcome = "shared" | "copied" | "fallback" | "dismissed";

async function writeWithClipboardApi(text: string): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      return false;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function copyWithSelection(text: string): boolean {
  if (typeof document === "undefined" || typeof document.execCommand !== "function") return false;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.setAttribute("aria-hidden", "true");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.opacity = "0";
  document.body.appendChild(area);
  try {
    area.focus({ preventScroll: true });
    area.select();
    area.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
    previousFocus?.focus({ preventScroll: true });
  }
}

export async function copyText(text: string): Promise<CopyOutcome> {
  if (await writeWithClipboardApi(text)) return "copied";
  return copyWithSelection(text) ? "copied" : "fallback";
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function canShare(data: ShareData): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  try {
    return typeof navigator.canShare !== "function" || navigator.canShare(data);
  } catch {
    return false;
  }
}

/** Share sheet first when `preferShare` (mobile); a dismissed sheet is not an error; anything else falls back to copying. */
export async function shareOrCopyLink(input: {
  readonly url: string;
  readonly title: string;
  readonly preferShare: boolean;
}): Promise<ShareOutcome> {
  const data: ShareData = { url: input.url, title: input.title };
  if (input.preferShare && canShare(data)) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (error) {
      if (isAbortError(error)) return "dismissed";
    }
  }
  return copyText(input.url);
}
```

- [ ] **Step 4: Write the button**

Create `components/ReturnLinkButton.tsx`:

```tsx
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { shareOrCopyLink } from "@/lib/clipboard";
import { buildReturnLink } from "@/lib/site";
import type { DeliveryCarrierCode } from "@/lib/types";

// Transitional: S07 replaces this with ReturnLinkAction and config copy. Renders no live region (S04 owns the only one).
const LABEL = "다시 볼 링크 복사";
const COPIED_LABEL = "링크를 복사했어요";
const SHARED_LABEL = "링크를 공유했어요";
const FALLBACK_HINT = "아래 링크를 길게 눌러 복사해 주세요.";
const SHARE_TITLE = "통관·배송 조회";
const LABEL_RESET_MS = 3000;

type ReturnLinkState = "idle" | "copied" | "shared" | "fallback";

function prefersShareSheet(): boolean {
  try {
    return typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

export function ReturnLinkButton({
  number,
  carrier
}: {
  readonly number: string;
  readonly carrier: DeliveryCarrierCode;
}): React.JSX.Element {
  const link = buildReturnLink(number, carrier);
  const [state, setState] = useState<ReturnLinkState>("idle");
  const fallbackId = useId();
  const fallbackRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (state === "fallback") {
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
      return;
    }
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), LABEL_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  const handleClick = async (): Promise<void> => {
    const outcome = await shareOrCopyLink({ url: link, title: SHARE_TITLE, preferShare: prefersShareSheet() });
    if (outcome !== "dismissed") setState(outcome);
  };

  const label = state === "copied" ? COPIED_LABEL : state === "shared" ? SHARED_LABEL : LABEL;

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => void handleClick()}
        className="inline-flex min-h-11 items-center rounded-xl border border-slate-600/80 bg-slate-900/40 px-4 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/60 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80"
      >
        {label}
      </button>
      {state === "fallback" ? (
        <div className="w-full max-w-md">
          <label htmlFor={fallbackId} className="block break-keep text-sm text-slate-300">
            {FALLBACK_HINT}
          </label>
          <textarea
            id={fallbackId}
            ref={fallbackRef}
            readOnly
            rows={2}
            value={link}
            data-copy-fallback="true"
            className="mt-1 w-full resize-none rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80"
          />
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Render it under the current result summary**

In `components/HomePageClient.tsx`, after the line `import { RecommendedProducts } from "@/components/RecommendedProducts";` add:

```ts
import { ReturnLinkButton } from "@/components/ReturnLinkButton";
```

Replace the line

```tsx
              <TrackingResultSummary data={result} />
```

with

```tsx
              <TrackingResultSummary data={result} />
              <ReturnLinkButton
                key={`${result.trackingNumber}:${result.delivery.carrierCode}`}
                number={result.trackingNumber}
                carrier={result.delivery.carrierCode}
              />
```

(`result.trackingNumber` is the server-normalized number; `delivery.carrierCode` is the carrier the lookup resolved to, so an automatic lookup that found CJ produces `?c=CJ` — S06 honors `?c=`; until then the current UI ignores it.)

- [ ] **Step 6: Run test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/return-link.spec.ts`
Expected: `6 passed`.

- [ ] **Step 7: The existing result tests still pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/tracking.spec.ts tests/privacy.spec.ts`
Expected: the same pass count as the Task 0 baseline for these two files, 0 failed.

- [ ] **Step 8: Typecheck and lint**

Run: `npm run typecheck; npx eslint lib/clipboard.ts components/ReturnLinkButton.tsx components/HomePageClient.tsx tests/e2e/return-link.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 9: Commit**

```powershell
git add lib/clipboard.ts components/ReturnLinkButton.tsx components/HomePageClient.tsx tests/e2e/return-link.spec.ts
git commit -m "feat: add return-link copy with share sheet and selectable fallback"
```

Expected: `4 files changed`.

---

### Task 5: Fail-closed AdLoader replaces the layout script

**Files:**
- Create: `tests/support/network-capture.ts`
- Create: `components/ads/AdLoader.tsx`
- Modify: `app/(public)/layout.tsx` (whole file; created by S01)
- Modify (only if Task 0 Step 9 found an SSR-HTML loader assertion): the S01 test that contains it
- Test: `tests/e2e/url-privacy.spec.ts` (create)

**Interfaces:**
- Consumes: `ADSENSE_LOADER_URL` (S01 `lib/site.ts`); `containsTrackingLikeValue` (S01); `AD_TIMING_POLICY`, `shouldInsertAdLoader` (Task 3); `getAdSignals`, `subscribeAdSignals` (Task 3); test-only `FAKE`, `trackData`, `mockTrack` (S01).
- Produces (roadmap §11.9–§11.10, §11.13): `AdLoader(): null` (client; inserts `<script async crossorigin="anonymous" src={ADSENSE_LOADER_URL} data-ad-loader="adsense">` at most once per document); `tests/support/network-capture.ts`: `CapturedRequest`, `captureThirdParty(page)`, `assertNoTrackingValues(requests)` plus Additions 1 (`WatchedDocument`, `AdLoaderInsertion`, `AdLoaderWatch`, `watchAdLoader`, `LookupRecorder`, `recordLookups`, `waitForIdle`).

- [ ] **Step 1: Write the test support module**

Create `tests/support/network-capture.ts`:

```ts
import { expect } from "@playwright/test";
import type { Page, Request, Route } from "@playwright/test";
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";

export interface CapturedRequest {
  readonly url: string;
  readonly method: string;
  readonly postData: string | null;
  readonly referer: string | null;
  readonly locationAtRequest: string | null;
}

/** Must equal the host of `use.baseURL` in playwright.config.ts. */
const APP_HOST = "127.0.0.1:43210";
const RECORDED_FIRST_PARTY = /^\/(?:_vercel\/insights\/|_vercel\/speed-insights\/|api\/csp-report(?:\/|$))/;

function isRecorded(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return url.host !== APP_HOST || RECORDED_FIRST_PARTY.test(url.pathname);
}

function frameUrlOf(request: Request): string | null {
  try {
    return request.frame().url();
  } catch {
    return null;
  }
}

/** Routes every request whose origin differs from the app: records it, then aborts it. First-party
 *  /_vercel/insights/*, /_vercel/speed-insights/* and /api/csp-report are recorded and continued. */
export async function captureThirdParty(page: Page): Promise<{ readonly requests: () => readonly CapturedRequest[] }> {
  const captured: CapturedRequest[] = [];
  await page.route(isRecorded, async (route: Route) => {
    const request = route.request();
    const locationAtRequest = frameUrlOf(request);
    const referer = await request.headerValue("referer");
    captured.push({ url: request.url(), method: request.method(), postData: request.postData(), referer, locationAtRequest });
    if (new URL(request.url()).host === APP_HOST) {
      await route.continue();
    } else {
      await route.abort("blockedbyclient");
    }
  });
  return { requests: () => [...captured] };
}

function isTrackApiPost(request: CapturedRequest): boolean {
  const url = new URL(request.url);
  return request.method === "POST" && url.host === APP_HOST && url.pathname === "/api/track";
}

/** 0 tracking-like values in URL, referer, page location at request time and body; the /api/track POST body is exempt. */
export function assertNoTrackingValues(requests: readonly CapturedRequest[]): void {
  for (const request of requests) {
    const fields: ReadonlyArray<readonly [string, string | null]> = [
      ["url", request.url],
      ["referer", request.referer],
      ["page location at request time", request.locationAtRequest],
      ["body", isTrackApiPost(request) ? null : request.postData]
    ];
    for (const [field, value] of fields) {
      if (value === null) continue;
      expect(containsTrackingLikeValue(value), `${field} of ${request.method} ${request.url} carries a tracking-like value`).toBe(false);
    }
  }
}

export interface WatchedDocument {
  readonly documentId: string;
  readonly startHref: string;
}

export interface AdLoaderInsertion {
  readonly documentId: string;
  readonly pathname: string;
  readonly href: string;
  readonly hasPageUrlAttribute: boolean;
}

export interface AdLoaderWatch {
  readonly documents: () => readonly WatchedDocument[];
  readonly insertions: () => readonly AdLoaderInsertion[];
  readonly currentDocumentId: () => Promise<string>;
}

type WatchEvent =
  | { readonly kind: "document"; readonly document: WatchedDocument }
  | { readonly kind: "insertion"; readonly insertion: AdLoaderInsertion };

function parseWatchEvent(value: unknown): WatchEvent | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("kind" in value) || !("documentId" in value) || !("href" in value)) return null;
  const { kind, documentId, href } = value;
  if (typeof documentId !== "string" || typeof href !== "string") return null;
  if (kind === "document") return { kind, document: { documentId, startHref: href } };
  if (
    kind === "insertion" &&
    "pathname" in value &&
    "hasPageUrlAttribute" in value &&
    typeof value.pathname === "string" &&
    typeof value.hasPageUrlAttribute === "boolean"
  ) {
    return {
      kind,
      insertion: { documentId, href, pathname: value.pathname, hasPageUrlAttribute: value.hasPageUrlAttribute }
    };
  }
  return null;
}

/** Records every top-level document and every `script[data-ad-loader="adsense"]` insertion with the URL at that moment. */
export async function watchAdLoader(page: Page): Promise<AdLoaderWatch> {
  const documents: WatchedDocument[] = [];
  const insertions: AdLoaderInsertion[] = [];
  await page.exposeBinding("__ttAdLoaderEvent", (_source, payload: unknown) => {
    const event = parseWatchEvent(payload);
    if (event?.kind === "document") documents.push(event.document);
    if (event?.kind === "insertion") insertions.push(event.insertion);
  });
  await page.addInitScript(() => {
    if (window.top !== window) return;
    const documentId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    Object.defineProperty(window, "__ttDocumentId", { value: documentId });
    const send = (payload: object): void => {
      const binding: unknown = Reflect.get(window, "__ttAdLoaderEvent");
      if (typeof binding === "function") void binding(payload);
    };
    send({ kind: "document", documentId, href: location.href });
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLScriptElement && node.dataset.adLoader === "adsense") {
            send({
              kind: "insertion",
              documentId,
              href: location.href,
              pathname: location.pathname,
              hasPageUrlAttribute: node.hasAttribute("data-page-url")
            });
          }
        });
      }
    }).observe(document, { childList: true, subtree: true });
  });
  return {
    documents: () => [...documents],
    insertions: () => [...insertions],
    currentDocumentId: () => page.evaluate(() => String(Reflect.get(window, "__ttDocumentId")))
  };
}

export interface LookupRecorder {
  readonly numbers: () => readonly string[];
  readonly carriers: () => readonly string[];
  readonly onRequest: (body: unknown) => void;
}

/** Pass `onRequest` to `mockTrack(page, response, { onRequest })` to record every /api/track body. */
export function recordLookups(): LookupRecorder {
  const numbers: string[] = [];
  const carriers: string[] = [];
  return {
    numbers: () => [...numbers],
    carriers: () => [...carriers],
    onRequest: (body: unknown) => {
      if (typeof body !== "object" || body === null) return;
      if ("trackingNumber" in body && typeof body.trackingNumber === "string") numbers.push(body.trackingNumber);
      if ("carrierCode" in body && typeof body.carrierCode === "string") carriers.push(body.carrierCode);
    }
  };
}

/** Waits for `load` plus two idle callbacks: hydration effects, restore and a scheduled loader insertion have run. */
export async function waitForIdle(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const idle = (next: () => void): void => {
          if (typeof requestIdleCallback === "function") requestIdleCallback(() => next(), { timeout: 2500 });
          else setTimeout(next, 50);
        };
        idle(() => idle(resolve));
      })
  );
}
```

- [ ] **Step 2: Write the failing E2E test**

Create `tests/e2e/url-privacy.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { AD_TIMING_POLICY } from "@/lib/ads/ad-gate";
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import { ADSENSE_LOADER_URL } from "@/lib/site";
import type { TrackResponseData } from "@/lib/types";
import { FAKE, mockTrack, trackData } from "../fixtures/tracking-fixtures";
import { assertNoTrackingValues, captureThirdParty, waitForIdle, watchAdLoader } from "../support/network-capture";
import type { AdLoaderInsertion, AdLoaderWatch } from "../support/network-capture";

const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";
const RESULT_READY = { name: "다시 볼 링크 복사" } as const;

type Entry = "home" | "deepLink";

/** Scenario-level mirror of the gate, evaluated after an allowed (inTransit) result has settled on screen. */
function loaderExpected(entry: Entry): boolean {
  switch (AD_TIMING_POLICY) {
    case "neverOnNumberRoutes":
      return entry === "home";
    case "afterScrub":
    case "afterAllowedResult":
      return true;
  }
}

function inTransit(number: string): TrackResponseData {
  return trackData("inTransit", { trackingNumber: number });
}

async function expectPath(page: Page, expected: string): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => `${location.pathname}${location.search}${location.hash}`), { timeout: 10_000 })
    .toBe(expected);
}

async function submitFromHome(page: Page, number: string): Promise<void> {
  const input = page.getByLabel(INPUT_LABEL, { exact: true });
  await input.fill(number);
  await input.press("Enter");
  await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
}

async function expectLoaderInCurrentDocument(page: Page, loader: AdLoaderWatch, entry: Entry): Promise<void> {
  const documentId = await loader.currentDocumentId();
  const inDocument = (): number => loader.insertions().filter((insertion) => insertion.documentId === documentId).length;
  if (loaderExpected(entry)) {
    await expect.poll(inDocument, { timeout: 10_000 }).toBe(1);
  } else {
    await waitForIdle(page);
    expect(inDocument()).toBe(0);
  }
}

function expectInsertionsSafe(insertions: readonly AdLoaderInsertion[]): void {
  const perDocument = new Map<string, number>();
  for (const insertion of insertions) {
    perDocument.set(insertion.documentId, (perDocument.get(insertion.documentId) ?? 0) + 1);
    expect(insertion.hasPageUrlAttribute, "data-page-url is forbidden (GAP1-03)").toBe(false);
    expect(containsTrackingLikeValue(insertion.href), "loader inserted while the URL carried a number").toBe(false);
  }
  for (const count of perDocument.values()) expect(count, "at most one loader per document").toBe(1);
}

test.describe("SSR shell and home", () => {
  test("SSR HTML of '/', number routes and /privacy carries no ad loader", async ({ request }) => {
    for (const path of ["/", `/${FAKE.domestic}`, `/${FAKE.hbl}`, "/privacy"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      const html = await response.text();
      expect(html, path).not.toContain("adsbygoogle");
      expect(html, path).not.toContain("googlesyndication");
    }
  });

  test("home: one loader at '/' after load, and third-party traffic carries no tracking value", async ({ page }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    await mockTrack(page, inTransit(FAKE.domestic));
    await page.goto("/");
    if (AD_TIMING_POLICY !== "afterAllowedResult") await expectLoaderInCurrentDocument(page, loader, "home");
    await submitFromHome(page, FAKE.domestic);
    await expectLoaderInCurrentDocument(page, loader, "home");
    expect(loader.insertions().map((insertion) => insertion.pathname)).toEqual(["/"]);
    await expect.poll(() => capture.requests().some((request) => request.url === ADSENSE_LOADER_URL)).toBe(true);
    expectInsertionsSafe(loader.insertions());
    assertNoTrackingValues(capture.requests());
  });

  test("/privacy as the first document gets the loader at /privacy", async ({ page }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    await page.goto("/privacy");
    if (AD_TIMING_POLICY !== "afterAllowedResult") {
      await expect.poll(() => loader.insertions().length, { timeout: 10_000 }).toBe(1);
      expect(loader.insertions()[0]?.pathname).toBe("/privacy");
    }
    expectInsertionsSafe(loader.insertions());
    assertNoTrackingValues(capture.requests());
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/url-privacy.spec.ts`
Expected: FAIL — `3 failed`: the SSR test fails on `not.toContain("adsbygoogle")` for `/` (the `next/script` loader is in the HTML); the two loader tests time out on `expect.poll(...).toBe(1)` (received `0`: the `next/script` tag has no `data-ad-loader`).

- [ ] **Step 4: Write the loader**

Create `components/ads/AdLoader.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AD_TIMING_POLICY, shouldInsertAdLoader } from "@/lib/ads/ad-gate";
import { getAdSignals, subscribeAdSignals } from "@/lib/ads/ad-signals";
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import { ADSENSE_LOADER_URL } from "@/lib/site";

const LOADER_SELECTOR = 'script[data-ad-loader="adsense"]';
const IDLE_TIMEOUT_MS = 2000;

let insertScheduled = false;

function loaderPresent(): boolean {
  return document.querySelector(LOADER_SELECTOR) !== null;
}

function allowedNow(): boolean {
  const { pathname, search, hash } = window.location;
  if (new URLSearchParams(search).has("trackingNumber")) return false;
  if (containsTrackingLikeValue(`${search}${hash}`)) return false;
  return shouldInsertAdLoader({ ...getAdSignals(), pathname, policy: AD_TIMING_POLICY });
}

function insertLoader(): void {
  insertScheduled = false;
  // Re-checked at insertion time: the URL or the signals may have changed since scheduling.
  if (loaderPresent() || !allowedNow()) return;
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = ADSENSE_LOADER_URL;
  script.dataset.adLoader = "adsense";
  // Never set data-page-url: AdSense would still send the real URL as loc= (GAP1-03).
  document.body.appendChild(script);
}

function scheduleInsert(): void {
  if (insertScheduled || loaderPresent() || !allowedNow()) return;
  insertScheduled = true;
  const whenIdle = (): void => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(insertLoader, { timeout: IDLE_TIMEOUT_MS });
    } else {
      window.setTimeout(insertLoader, 1);
    }
  };
  if (document.readyState === "complete") whenIdle();
  else window.addEventListener("load", whenIdle, { once: true });
}

/**
 * Inserts the AdSense loader at most once per document, and only while the URL carries no tracking number
 * (spec §3 candidate B, §8). Replaces the former `next/script` tag; the SSR HTML carries no ad script.
 */
export function AdLoader(): null {
  // Only a re-evaluation trigger: client navigations and the scrub's replaceState change the pathname.
  const pathname = usePathname();
  useEffect(() => {
    scheduleInsert();
    return subscribeAdSignals(scheduleInsert);
  }, [pathname]);
  return null;
}
```

- [ ] **Step 5: Mount it in the public layout**

Open `app/(public)/layout.tsx`. Delete the `import Script from "next/script";` line and the whole `<Script … />` element (and the `ADSENSE_LOADER_URL` import if it was only used by that element). Add `import { AdLoader } from "@/components/ads/AdLoader";` and render `<AdLoader />` as the last child. Keep anything else S01 put in the file (metadata export, wrappers). If S01's file held only the script and the children, the result is exactly:

```tsx
import { AdLoader } from "@/components/ads/AdLoader";

export default function PublicLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <>
      {children}
      <AdLoader />
    </>
  );
}
```

Check: `Select-String -LiteralPath "app/(public)/layout.tsx" -Pattern "next/script|adsbygoogle|googlesyndication"` → no output; `git grep -n -e "adsbygoogle" -e "next/script" -- app components` → no output.

- [ ] **Step 6: Run test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/url-privacy.spec.ts`
Expected: `3 passed`.

- [ ] **Step 7: Align any S01 assertion about the old SSR loader**

For each `tests/` line recorded in Task 0 Step 9:
- An assertion that `/internal/…` has no AdSense script → keep (still true: `AdLoader` lives only in `app/(public)/layout.tsx`).
- An assertion on the DOM after navigation such as `page.locator('script[src*="adsbygoogle"]')` with count 1 on `/` or `/privacy` → keep (the inserted script has that `src`; auto-waiting covers the load + idle delay). S01's `internal-isolation.spec.ts` control test "public pages still load the AdSense loader (control)" is this case.
- A line that does not say where the loader is rendered → keep unchanged: the `ADSENSE_LOADER_URL` value check in `tests/unit/site.spec.ts`, the CSP host lists in `tests/unit/security-headers.spec.ts`, and the `AD_SCRIPT` / `AD_REQUEST` / `AD_SOURCE_MARKERS` constants of `tests/e2e/internal-isolation.spec.ts` (`AD_SOURCE_MARKERS` scans only `app/layout.tsx` and `app/(internal)/`, where `AdLoader` never appears).
- An assertion that the SERVER HTML of a public page contains `adsbygoogle` (or the `next/script` preload) → replace it with the rule S02 introduces, in the same test:

```ts
await page.goto("/");
await expect(page.locator('script[data-ad-loader="adsense"]')).toHaveCount(1, { timeout: 10_000 });
```

Run the edited file(s): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/internal-isolation.spec.ts` (and any other edited file) → 0 failed. If nothing needed a change, write "S01 loader assertions: none affected" in the stage summary.

- [ ] **Step 8: Typecheck and lint**

Run: `npm run typecheck; npx eslint components/ads "app/(public)/layout.tsx" tests/support/network-capture.ts tests/e2e/url-privacy.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 9: Commit**

```powershell
git add components/ads/AdLoader.tsx "app/(public)/layout.tsx" tests/support/network-capture.ts tests/e2e/url-privacy.spec.ts
git commit -m "feat: insert the AdSense loader through a fail-closed gate instead of the layout script"
```

(Add the S01 test file from Step 7 to the same commit if it changed.) Expected: `4 files changed` (5 with Step 7).

---

### Task 6: Candidate B on the current page — scrub after hydration, no number pushState

**Files:**
- Modify: `components/HomePageClient.tsx` (React import line 3; imports after line 22; effect after line 41 `const prefersReducedMotion = useReducedMotion();`)
- Modify: `components/TrackingForm.tsx` (the `onSubmit` handler, lines 95–102)
- Test: `tests/e2e/url-privacy.spec.ts` (update the support import; append a `describe`)

**Interfaces:**
- Consumes: `SCRUB_TIMEOUT_MS`, `scrubNumberFromUrl` (Task 1); `saveRestoreEntry` (Task 2); `setAdSignals` (Task 3); `AdLoader` (Task 5) reacts to the signal and to the pathname.
- Produces: order ①–⑥ on deep links — the SSR shell has no ad script (Task 5), `TrackingForm`'s existing effect starts the lookup right after hydration, then `HomePageClient`'s effect waits for the router, stashes `{ number, carrier: "AUTO", savedAt }`, replaces the URL with `/`, confirms, and reports `scrub: "scrubbed" | "failed"` to the ad signals. A manual lookup never changes the URL.

- [ ] **Step 1: Write the failing tests**

In `tests/e2e/url-privacy.spec.ts` replace the support import line

```ts
import { assertNoTrackingValues, captureThirdParty, waitForIdle, watchAdLoader } from "../support/network-capture";
```

with

```ts
import {
  assertNoTrackingValues,
  captureThirdParty,
  recordLookups,
  waitForIdle,
  watchAdLoader
} from "../support/network-capture";
```

and append at the end of the file:

```ts
test.describe("deep links (candidate B)", () => {
  test("the lookup starts, the URL becomes '/', and the loader follows the policy only at '/'", async ({ page }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    const lookups = recordLookups();
    await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");
    expect(lookups.numbers()).toEqual([FAKE.domestic]);
    await expectLoaderInCurrentDocument(page, loader, "deepLink");
    for (const insertion of loader.insertions()) expect(insertion.pathname).toBe("/");
    expectInsertionsSafe(loader.insertions());
    assertNoTrackingValues(capture.requests());
  });

  test("query and hash leave together with the number", async ({ page }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    await mockTrack(page, inTransit(FAKE.hbl));
    await page.goto(`/${FAKE.hbl}?c=CJ#top`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");
    await expectLoaderInCurrentDocument(page, loader, "deepLink");
    expectInsertionsSafe(loader.insertions());
    assertNoTrackingValues(capture.requests());
  });

  test("a manual lookup on '/' never puts the number into the URL", async ({ page }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    const navigated: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigated.push(frame.url());
    });
    await mockTrack(page, inTransit(FAKE.domestic));
    await page.goto("/");
    await submitFromHome(page, FAKE.domestic);
    await expectPath(page, "/");
    await expectLoaderInCurrentDocument(page, loader, "home");
    for (const url of navigated) expect(containsTrackingLikeValue(url), url).toBe(false);
    expectInsertionsSafe(loader.insertions());
    assertNoTrackingValues(capture.requests());
  });

  test("if the URL cannot be changed, the loader stays out (fail-closed)", async ({ page }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    // Simulates a browser/router that refuses the scrub: replaceState keeps the number URL.
    await page.addInitScript(() => {
      const original = History.prototype.replaceState;
      History.prototype.replaceState = function replaceState(
        this: History,
        data: unknown,
        unused: string,
        url?: string | URL | null
      ): void {
        const onNumberPath = /^\/[^/.]+$/.test(location.pathname) && !/^\/(?:privacy|internal|api)$/.test(location.pathname);
        if (onNumberPath && url !== undefined && url !== null && String(url) === "/") {
          original.call(this, data, unused);
          return;
        }
        original.call(this, data, unused, url);
      };
    });
    await mockTrack(page, inTransit(FAKE.domestic));
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await waitForIdle(page);
    await page.waitForTimeout(1000);
    await waitForIdle(page);
    await expectPath(page, `/${FAKE.domestic}`);
    const documentId = await loader.currentDocumentId();
    expect(loader.insertions().filter((insertion) => insertion.documentId === documentId)).toEqual([]);
    expect(capture.requests()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/url-privacy.spec.ts`
Expected: FAIL — `3 failed, 4 passed`: the two deep-link tests time out in `expectPath(page, "/")` (received `/000012345678` / `/TEST00000001?c=CJ#top`), and the manual-lookup test fails in `expectPath` (received `/000012345678` from the `pushState`). The fail-closed test already passes (nothing scrubs yet) and keeps passing after Step 5.

- [ ] **Step 3: Scrub after hydration in `HomePageClient`**

In `components/HomePageClient.tsx` replace

```ts
import { useCallback, useRef, useState } from "react";
```

with

```ts
import { useCallback, useEffect, useRef, useState } from "react";
```

Replace

```ts
import type { TrackResponseData } from "@/lib/types";
```

with

```ts
import { setAdSignals } from "@/lib/ads/ad-signals";
import { saveRestoreEntry } from "@/lib/privacy/session-restore";
import { SCRUB_TIMEOUT_MS, scrubNumberFromUrl } from "@/lib/privacy/url-scrub";
import type { TrackResponseData } from "@/lib/types";
```

Replace

```ts
  const prefersReducedMotion = useReducedMotion();
```

with

```ts
  const prefersReducedMotion = useReducedMotion();

  // Candidate B (spec §3): TrackingForm's effect has already started the lookup. Now, once the App Router
  // has committed, stash the number for restore, remove it from the URL, and report the result to the ad gate.
  useEffect(() => {
    if (!initialTrackingNumber) return;
    void scrubNumberFromUrl({
      timeoutMs: SCRUB_TIMEOUT_MS,
      beforeReplace: () => saveRestoreEntry({ number: initialTrackingNumber, carrier: "AUTO", savedAt: Date.now() })
    }).then((status) => {
      if (status === "scrubbed" || status === "failed") setAdSignals({ scrub: status });
    });
  }, [initialTrackingNumber]);
```

- [ ] **Step 4: Stop pushing number URLs in `TrackingForm`**

In `components/TrackingForm.tsx` replace

```ts
  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      window.history.pushState(null, "", `/${encodeURIComponent(trimmed)}`);
    }
    await submitTracking(value, carrierCode);
  };
```

with

```ts
  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // The number never goes into the URL (spec §3, GAP1-10); restore uses sessionStorage instead.
    await submitTracking(value, carrierCode);
  };
```

Check: `git grep -n "pushState" -- components` → no output.

- [ ] **Step 5: Run test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/url-privacy.spec.ts`
Expected: `7 passed`.

- [ ] **Step 6: The existing suites still pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/tracking.spec.ts tests/privacy.spec.ts tests/e2e/return-link.spec.ts`
Expected: 0 failed (the same pass counts as before this task).

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck; npx eslint components/HomePageClient.tsx components/TrackingForm.tsx tests/e2e/url-privacy.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 8: Commit**

```powershell
git add components/HomePageClient.tsx components/TrackingForm.tsx tests/e2e/url-privacy.spec.ts
git commit -m "feat: scrub deep-link numbers after the router commits and stop pushing number URLs"
```

Expected: `3 files changed`.

---

### Task 7: Restore the last lookup on reload and back/forward

**Files:**
- Modify: `components/TrackingForm.tsx` (props type lines 12–18, destructuring lines 24–30, carrier state line 33, render-time sync lines 37–42, `submitTracking` lines 47–81, initial effect lines 83–93, `onSubmit`)
- Modify: `components/HomePageClient.tsx` (imports; module helpers before `export const HomePageClient`; component body; the `<TrackingForm … />` props)
- Test: `tests/e2e/session-restore.spec.ts` (create)

**Interfaces:**
- Consumes: `currentNavigationKind`, `readRestoreEntry`, `saveRestoreEntry`, `RestoreEntry`, `RESTORE_KEY`, `RESTORE_TTL_MS` (Task 2); `recordLookups`, `waitForIdle` (Task 5).
- Produces: `TrackingForm` props `initialCarrier?: DeliveryCarrierCode`, `onSubmitted?: (number: string, carrier: DeliveryCarrierCode, source: TrackingFormSubmitSource) => void`, `export type TrackingFormSubmitSource = "manual" | "initial"` (Additions 6). Behavior: every lookup start overwrites `tt:restore`; a `reload`/`back_forward` document on `/` replays the entry once (≤ 30 min) with its carrier; any lookup start in the document consumes the restore, so an in-app return to `/` does not replay it.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/session-restore.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { RESTORE_KEY, RESTORE_TTL_MS } from "@/lib/privacy/session-restore";
import type { TrackResponseData } from "@/lib/types";
import { FAKE, mockTrack, trackData } from "../fixtures/tracking-fixtures";
import { recordLookups, waitForIdle } from "../support/network-capture";
import type { LookupRecorder } from "../support/network-capture";

const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";
const RESULT_READY = { name: "다시 볼 링크 복사" } as const;

function inTransit(number: string): TrackResponseData {
  return trackData("inTransit", { trackingNumber: number });
}

async function submitFromHome(page: Page, number: string): Promise<void> {
  const input = page.getByLabel(INPUT_LABEL, { exact: true });
  await input.fill(number);
  await input.press("Enter");
  await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
}

async function expectPath(page: Page, expected: string): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => `${location.pathname}${location.search}${location.hash}`), { timeout: 10_000 })
    .toBe(expected);
}

async function storedEntry(page: Page): Promise<string | null> {
  return page.evaluate((key) => sessionStorage.getItem(key), RESTORE_KEY);
}

async function writeEntry(
  page: Page,
  entry: { readonly number: string; readonly carrier: string; readonly ageMs: number }
): Promise<void> {
  await page.evaluate(
    ({ key, number, carrier, ageMs }) =>
      sessionStorage.setItem(key, JSON.stringify({ number, carrier, savedAt: Date.now() - ageMs })),
    { key: RESTORE_KEY, ...entry }
  );
}

async function expectNoRestore(page: Page, lookups: LookupRecorder, lookupsBefore: number): Promise<void> {
  await waitForIdle(page);
  expect(lookups.numbers()).toHaveLength(lookupsBefore);
  await expect(page.getByRole("button", RESULT_READY)).toHaveCount(0);
}

test("a lookup on '/' comes back after a reload, with its carrier", async ({ page }) => {
  const lookups = recordLookups();
  await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
  await page.goto("/");
  await submitFromHome(page, FAKE.domestic);
  await page.reload();
  await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
  await expectPath(page, "/");
  expect(lookups.numbers()).toEqual([FAKE.domestic, FAKE.domestic]);
  expect(lookups.carriers()).toEqual(["AUTO", "AUTO"]);
});

test("the restored lookup uses the stored carrier", async ({ page }) => {
  const lookups = recordLookups();
  await mockTrack(page, inTransit(FAKE.hbl), { onRequest: lookups.onRequest });
  await page.goto("/");
  await writeEntry(page, { number: FAKE.hbl, carrier: "CJ", ageMs: 1000 });
  await page.reload();
  await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
  expect(lookups.numbers()).toEqual([FAKE.hbl]);
  expect(lookups.carriers()).toEqual(["CJ"]);
});

test("back_forward restores after leaving for another document", async ({ page }) => {
  const lookups = recordLookups();
  await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
  await page.goto("/");
  await submitFromHome(page, FAKE.domestic);
  await page.goto("/privacy");
  await page.goBack();
  await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
  await expectPath(page, "/");
  expect(lookups.numbers()).toEqual([FAKE.domestic, FAKE.domestic]);
});

test("a fresh navigation to '/' does not restore", async ({ page }) => {
  const lookups = recordLookups();
  await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
  await page.goto("/");
  await submitFromHome(page, FAKE.domestic);
  await page.goto("/");
  await expectNoRestore(page, lookups, 1);
  expect(await storedEntry(page)).not.toBeNull();
});

test("a new tab starts empty, even when it reloads", async ({ page, context }) => {
  await mockTrack(page, inTransit(FAKE.domestic));
  await page.goto("/");
  await submitFromHome(page, FAKE.domestic);
  const second = await context.newPage();
  const secondLookups = recordLookups();
  await mockTrack(second, inTransit(FAKE.domestic), { onRequest: secondLookups.onRequest });
  await second.goto("/");
  await second.reload();
  await expectNoRestore(second, secondLookups, 0);
  expect(await storedEntry(second)).toBeNull();
});

test("an entry older than 30 minutes is dropped", async ({ page }) => {
  const lookups = recordLookups();
  await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
  await page.goto("/");
  await writeEntry(page, { number: FAKE.domestic, carrier: "AUTO", ageMs: RESTORE_TTL_MS + 1000 });
  await page.reload();
  await expectNoRestore(page, lookups, 0);
  expect(await storedEntry(page)).toBeNull();
});

test("a corrupted entry is dropped", async ({ page }) => {
  const lookups = recordLookups();
  await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
  await page.goto("/");
  await page.evaluate((key) => sessionStorage.setItem(key, "{not json"), RESTORE_KEY);
  await page.reload();
  await expectNoRestore(page, lookups, 0);
  expect(await storedEntry(page)).toBeNull();
});

test("one entry per tab: the last lookup wins", async ({ page }) => {
  await mockTrack(page, inTransit(FAKE.domestic));
  await page.goto("/");
  await submitFromHome(page, FAKE.domestic);
  await page.goto("/");
  await submitFromHome(page, FAKE.hbl);
  const keys = await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith("tt:")));
  expect(keys).toEqual([RESTORE_KEY]);
  expect(await storedEntry(page)).toContain(`"number":"${FAKE.hbl}"`);
});

test("blocked sessionStorage never breaks the lookup, the scrub or a reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      }
    });
  });
  const lookups = recordLookups();
  await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
  await page.goto(`/${FAKE.domestic}`);
  await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
  await expectPath(page, "/");
  await page.reload();
  await expectNoRestore(page, lookups, 1);
  await expect(page.getByLabel(INPUT_LABEL, { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("a full sessionStorage (setItem throws) never breaks the lookup or a reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const real = window.sessionStorage;
    const full = {
      get length(): number {
        return real.length;
      },
      clear: (): void => real.clear(),
      key: (index: number): string | null => real.key(index),
      getItem: (key: string): string | null => real.getItem(key),
      setItem: (): void => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      },
      removeItem: (key: string): void => real.removeItem(key)
    };
    Object.defineProperty(window, "sessionStorage", { configurable: true, get: () => full });
  });
  const lookups = recordLookups();
  await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
  await page.goto("/");
  await submitFromHome(page, FAKE.domestic);
  await page.reload();
  await expectNoRestore(page, lookups, 1);
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/session-restore.spec.ts`
Expected: FAIL — `7 failed, 3 passed`. Failing: "comes back after a reload", "uses the stored carrier", "back_forward restores" (the button '다시 볼 링크 복사' never appears after reload/back); "a fresh navigation to '/' does not restore" and "one entry per tab" (a home lookup saves nothing yet: `storedEntry` is `null`, `keys` is `[]`); "older than 30 minutes" and "corrupted" (nothing reads the entry yet, so it is never removed). The new-tab and the two storage-error tests pass already because nothing restores yet; they guard the rules once Step 5 lands.

- [ ] **Step 3: Give `TrackingForm` a submit report and a restored carrier**

In `components/TrackingForm.tsx`:

(a) Replace the props type

```ts
type TrackingFormProps = {
  readonly onSuccess: (data: TrackResponseData) => void;
  readonly onError: (message: string) => void;
  readonly onLoading: (loading: boolean) => void;
  readonly initialTrackingNumber?: string;
  readonly surface?: "dark" | "light";
};
```

with

```ts
export type TrackingFormSubmitSource = "manual" | "initial";

type TrackingFormProps = {
  readonly onSuccess: (data: TrackResponseData) => void;
  readonly onError: (message: string) => void;
  readonly onLoading: (loading: boolean) => void;
  /** Called when a lookup starts (after the empty check); the page stashes it for restore. */
  readonly onSubmitted?: (number: string, carrier: DeliveryCarrierCode, source: TrackingFormSubmitSource) => void;
  readonly initialTrackingNumber?: string;
  /** Carrier of a restored lookup; deep links start with "AUTO". */
  readonly initialCarrier?: DeliveryCarrierCode;
  readonly surface?: "dark" | "light";
};
```

(b) Replace the destructuring

```ts
export const TrackingForm = ({
  onSuccess,
  onError,
  onLoading,
  initialTrackingNumber,
  surface = "dark"
}: TrackingFormProps) => {
```

with

```ts
export const TrackingForm = ({
  onSuccess,
  onError,
  onLoading,
  onSubmitted,
  initialTrackingNumber,
  initialCarrier,
  surface = "dark"
}: TrackingFormProps) => {
```

(c) Replace

```ts
  const [carrierCode, setCarrierCode] = useState<DeliveryCarrierCode>("AUTO");
```

with

```ts
  const [carrierCode, setCarrierCode] = useState<DeliveryCarrierCode>(initialCarrier ?? "AUTO");
```

(d) Replace the render-time sync block

```ts
  // A new tracking number from the URL replaces the input during render rather than in an effect.
  if (initialTrackingNumber !== syncedTrackingNumber) {
    setSyncedTrackingNumber(initialTrackingNumber);
    const normalized = initialTrackingNumber?.trim();
    if (normalized) setValue(normalized);
  }
```

with

```ts
  // A new tracking number from the URL or a restored lookup replaces the input during render rather than in an effect.
  if (initialTrackingNumber !== syncedTrackingNumber) {
    setSyncedTrackingNumber(initialTrackingNumber);
    const normalized = initialTrackingNumber?.trim();
    if (normalized) {
      setValue(normalized);
      setCarrierCode(initialCarrier ?? "AUTO");
    }
  }
```

(e) In `submitTracking`, replace the head

```ts
  const submitTracking = useCallback(
    async (trackingNumber: string, selectedCarrier: DeliveryCarrierCode) => {
      if (!trackingNumber.trim()) {
        onError("조회번호를 입력해주세요");
        return;
      }

      onLoading(true);
```

with

```ts
  const submitTracking = useCallback(
    async (trackingNumber: string, selectedCarrier: DeliveryCarrierCode, source: TrackingFormSubmitSource) => {
      if (!trackingNumber.trim()) {
        onError("조회번호를 입력해주세요");
        return;
      }

      onSubmitted?.(trackingNumber.trim(), selectedCarrier, source);
      onLoading(true);
```

and replace its dependency list

```ts
    [onError, onLoading, onSuccess]
```

with

```ts
    [onError, onLoading, onSubmitted, onSuccess]
```

(f) Replace the initial-lookup effect

```ts
    initialSubmittedRef.current = normalized;
    void submitTracking(normalized, "AUTO");
  }, [initialTrackingNumber, submitTracking]);
```

with

```ts
    initialSubmittedRef.current = normalized;
    void submitTracking(normalized, initialCarrier ?? "AUTO", "initial");
  }, [initialCarrier, initialTrackingNumber, submitTracking]);
```

(g) In `onSubmit` replace

```ts
    await submitTracking(value, carrierCode);
```

with

```ts
    await submitTracking(value, carrierCode, "manual");
```

- [ ] **Step 4: Restore once per document in `HomePageClient`**

In `components/HomePageClient.tsx`:

(a) Replace `import { useCallback, useEffect, useRef, useState } from "react";` with

```ts
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
```

(b) Replace

```ts
import { saveRestoreEntry } from "@/lib/privacy/session-restore";
```

with

```ts
import { currentNavigationKind, readRestoreEntry, saveRestoreEntry } from "@/lib/privacy/session-restore";
import type { RestoreEntry } from "@/lib/privacy/session-restore";
```

and replace `import type { TrackResponseData } from "@/lib/types";` with

```ts
import type { DeliveryCarrierCode, TrackResponseData } from "@/lib/types";
```

(c) Insert directly above the line `export const HomePageClient = ({ initialTrackingNumber }: HomePageClientProps) => {`:

```ts
// Session restore (spec §3): only in reload/back_forward documents, read once per document, and dropped as
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

```

(d) Directly below the Task 6 effect (the block that ends with `}, [initialTrackingNumber]);`) insert:

```ts

  const restoreEntry = useSyncExternalStore(subscribeToNothing, getRestoreSnapshot, getServerRestoreSnapshot);
  const restoredRequest = initialTrackingNumber ? null : restoreEntry;

  const handleSubmitted = useCallback((number: string, carrier: DeliveryCarrierCode) => {
    markRestoreConsumed();
    saveRestoreEntry({ number, carrier, savedAt: Date.now() });
  }, []);
```

(e) Replace the form props

```tsx
                  <TrackingForm
                    onSuccess={handleSuccess}
                    onError={handleError}
                    onLoading={setLoading}
                    initialTrackingNumber={initialTrackingNumber}
                    surface="light"
                  />
```

with

```tsx
                  <TrackingForm
                    onSuccess={handleSuccess}
                    onError={handleError}
                    onLoading={setLoading}
                    onSubmitted={handleSubmitted}
                    initialTrackingNumber={initialTrackingNumber || restoredRequest?.number || ""}
                    initialCarrier={restoredRequest?.carrier}
                    surface="light"
                  />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/session-restore.spec.ts`
Expected: `10 passed`.

- [ ] **Step 6: Nothing else moved**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/url-privacy.spec.ts tests/e2e/return-link.spec.ts tests/tracking.spec.ts tests/privacy.spec.ts`
Expected: 0 failed.

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck; npx eslint components/HomePageClient.tsx components/TrackingForm.tsx tests/e2e/session-restore.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing (in particular no `react-hooks/set-state-in-effect`, `react-hooks/refs` or `react-hooks/purity` findings: the store reads happen in `useSyncExternalStore` callbacks and the writes in the submit callback).

- [ ] **Step 8: Commit**

```powershell
git add components/HomePageClient.tsx components/TrackingForm.tsx tests/e2e/session-restore.spec.ts
git commit -m "feat: restore the tab's last lookup on reload and back navigation"
```

Expected: `3 files changed`.

---

### Task 8: Legacy `?trackingNumber` links through `next.config.ts`; `/` becomes static

**Files:**
- Modify: `app/(public)/page.tsx` (whole file)
- Modify: `next.config.ts` (add `redirects` next to S01's `headers`)
- Test: `tests/e2e/legacy-query-redirect.spec.ts` (create)

**Interfaces:**
- Consumes: S01's `next.config.ts` (`const nextConfig: NextConfig = { output, allowedDevOrigins, poweredByHeader, headers }`); the Task 6 scrub removes the forwarded query on the client.
- Produces: `redirects()` in `next.config.ts` (roadmap §11.5 "redirects /* S02 */"): `/` with `has` query `trackingNumber` matching `(?<trackingNumber>[A-Za-z0-9][A-Za-z0-9 -]{0,63})` → 307 `/:trackingNumber` (query passed through, Additions 7); `app/(public)/page.tsx` no longer reads `searchParams`, so the build prints `○ /`.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/legacy-query-redirect.spec.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { APIResponse } from "@playwright/test";
import { FAKE, FAKE_GROUPED, mockTrack, trackData } from "../fixtures/tracking-fixtures";

const RESULT_READY = { name: "다시 볼 링크 복사" } as const;

function locationOf(response: APIResponse): URL {
  const location = response.headers()["location"];
  expect(location, "Location header").toBeTruthy();
  return new URL(location, "http://127.0.0.1:43210");
}

test("'/?trackingNumber=X' answers 307 to '/X'", async ({ request }) => {
  const response = await request.get(`/?trackingNumber=${FAKE.domestic}`, { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(locationOf(response).pathname).toBe(`/${FAKE.domestic}`);
});

test("the carrier query travels along", async ({ request }) => {
  const response = await request.get(`/?trackingNumber=${FAKE.hbl}&c=CJ`, { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  const target = locationOf(response);
  expect(target.pathname).toBe(`/${FAKE.hbl}`);
  expect(target.searchParams.get("c")).toBe("CJ");
});

test("grouped digits with spaces or hyphens still redirect", async ({ request }) => {
  for (const value of [FAKE_GROUPED.domestic, FAKE_GROUPED.domestic.replaceAll(" ", "-")]) {
    const response = await request.get(`/?trackingNumber=${encodeURIComponent(value)}`, { maxRedirects: 0 });
    expect(response.status(), value).toBe(307);
    expect(decodeURIComponent(locationOf(response).pathname), value).toBe(`/${value}`);
  }
});

test("unsafe or empty values are not redirected: no open redirect, no 500", async ({ request }) => {
  for (const raw of ["", "%20", "%2F%2Fexample.com", "abc.def", "%ED%95%9C"]) {
    const response = await request.get(`/?trackingNumber=${raw}`, { maxRedirects: 0 });
    expect(response.status(), raw).toBe(200);
    expect(response.headers()["location"], raw).toBeUndefined();
  }
});

test("a legacy link ends on '/' with the lookup and no number left in the URL", async ({ page }) => {
  await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }));
  await page.goto(`/?trackingNumber=${FAKE.domestic}`);
  await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => `${location.pathname}${location.search}${location.hash}`), { timeout: 10_000 })
    .toBe("/");
});

test("'/' stays static: its page never reads searchParams", () => {
  const source = readFileSync(path.join(process.cwd(), "app", "(public)", "page.tsx"), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  expect(code).not.toContain("searchParams");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/legacy-query-redirect.spec.ts`
Expected: FAIL — `3 failed, 3 passed`: "the carrier query travels along" (`c` is `null`: the page's `redirect()` drops it), "unsafe or empty values…" (status `307` for `%2F%2Fexample.com`), "'/' stays static…" (the source contains `searchParams`).

- [ ] **Step 3: Make `/` static**

Replace the whole content of `app/(public)/page.tsx` with:

```tsx
import { HomePageClient } from "@/components/HomePageClient";

// Static: never reads the query string. Legacy '/?trackingNumber=X' links are redirected by next.config.ts.
export default function HomePage() {
  return <HomePageClient initialTrackingNumber="" />;
}
```

- [ ] **Step 4: Add the redirect to `next.config.ts`**

In `next.config.ts`, directly above `const nextConfig: NextConfig = {`, insert:

```ts
/**
 * Legacy links '/?trackingNumber=X' → 307 '/X' (spec §3). Only a value that starts with a letter or digit and
 * continues with letters, digits, spaces or hyphens (64 characters at most) is redirected: '//host' cannot
 * become an open redirect and non-ASCII values cannot produce an invalid Location header (500).
 * Next passes the query through ('/X?trackingNumber=X&c=…'); the candidate-B scrub removes it in the browser.
 */
const LEGACY_TRACKING_QUERY_VALUE = "(?<trackingNumber>[A-Za-z0-9][A-Za-z0-9 -]{0,63})";
```

and inside the `nextConfig` object, directly after the `headers` property, add the block below. S01 writes `headers` as the last property without a trailing comma (`headers: async () => buildSecurityHeaders().map((rule) => ({ source: rule.source, headers: [...rule.headers] }))`), so first append a `,` to the end of that line:

```ts
  redirects: async () => [
    {
      source: "/",
      has: [{ type: "query", key: "trackingNumber", value: LEGACY_TRACKING_QUERY_VALUE }],
      destination: "/:trackingNumber",
      permanent: false
    }
  ],
```

(`permanent: false` is 307. The `has` value is anchored by Next as `^…$`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue` (stop a stale dev server first with the Task 0 Step 4 command: `next.config.ts` changes need a restart), then `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/legacy-query-redirect.spec.ts`
Expected: `6 passed`.

- [ ] **Step 6: `/` is static in the build**

Run: `npm run build`
Expected: exit 0 and the route table shows `○ /` (and still `ƒ /[trackingNumber]`).

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck; npx eslint "app/(public)/page.tsx" next.config.ts tests/e2e/legacy-query-redirect.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 8: Commit**

```powershell
git add "app/(public)/page.tsx" next.config.ts tests/e2e/legacy-query-redirect.spec.ts
git commit -m "feat: redirect legacy trackingNumber queries in next.config and render / statically"
```

Expected: `3 files changed`.

---

### Task 9: Navigation rows around the scrub and the ported local-router regression

**Files:**
- Test: `tests/e2e/url-privacy.spec.ts` (update the first import line; add helpers; append a `describe`)

**Interfaces:**
- Consumes: everything from Tasks 1–8 (no production code changes in this task); GAP1 harness `…/scratchpad/phase1/gap-GAP1/local-router.cjs` steps 1–8 (ported with fixture numbers and stage-independent selectors).
- Produces: the regression net for roadmap Review Focus 5 — reload, back/forward across documents, bfcache (enabled on purpose), a second deep link in the same tab, a hash entry created before hydration, and the local-router sequence (footer link → privacy → link home → back → back → forward → back → reload → manual lookup) with an RSC-storm limit. These rows are characterization tests of Tasks 1, 6 and 7, so Step 3 proves that the two most important ones fail when their mechanism is removed.

- [ ] **Step 1: Write the tests**

In `tests/e2e/url-privacy.spec.ts` replace the first line

```ts
import { expect, test } from "@playwright/test";
```

with

```ts
import { chromium, expect, test } from "@playwright/test";
```

Insert these helpers directly below the `expectInsertionsSafe` function:

```ts
const RSC_REQUEST_LIMIT = 30;

/** Samples location every 5 ms (and right after each popstate): records any moment where the loader is present
 *  while path, query or hash carries a tracking-like value. */
async function installUrlSampler(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (window.top !== window) return;
    const pattern = /\d(?:[ -]?\d){9,}|(?:^|[^A-Za-z0-9])[A-Za-z]{3,4}\d{8,16}(?![0-9])/;
    const violations: string[] = [];
    const sample = (): void => {
      if (document.querySelector('script[data-ad-loader="adsense"]') === null) return;
      let target = `${location.pathname}${location.search}${location.hash}`;
      try {
        target = decodeURIComponent(target);
      } catch {
        // keep the raw value
      }
      if (pattern.test(target)) violations.push(location.href);
    };
    window.setInterval(sample, 5);
    window.addEventListener("popstate", () => window.setTimeout(sample, 0));
    Object.defineProperty(window, "__ttUrlViolations", { value: violations });
  });
}

async function urlViolations(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const value: unknown = Reflect.get(window, "__ttUrlViolations");
    return Array.isArray(value) ? value.map((item) => String(item)) : [];
  });
}

function pathOf(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
```

Append at the end of the file:

```ts
test.describe("navigation around the scrub", () => {
  test.describe.configure({ timeout: 90_000 });

  test("reload after the scrub restores the lookup at '/' and keeps the loader rules", async ({ page }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    await installUrlSampler(page);
    const lookups = recordLookups();
    await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");
    await expectLoaderInCurrentDocument(page, loader, "deepLink");
    expect(await urlViolations(page)).toEqual([]);

    await page.reload();
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");
    expect(lookups.numbers()).toEqual([FAKE.domestic, FAKE.domestic]);
    await expectLoaderInCurrentDocument(page, loader, "home");
    expect(await urlViolations(page)).toEqual([]);
    expectInsertionsSafe(loader.insertions());
    assertNoTrackingValues(capture.requests());
  });

  test("Back from another document restores at '/' without a number in the URL", async ({ page }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    await installUrlSampler(page);
    const lookups = recordLookups();
    await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");
    await expectLoaderInCurrentDocument(page, loader, "deepLink");
    expect(await urlViolations(page)).toEqual([]);

    await page.goto("/privacy");
    await page.goBack();
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");
    expect(lookups.numbers()).toEqual([FAKE.domestic, FAKE.domestic]);
    await expectLoaderInCurrentDocument(page, loader, "home");
    expect(await urlViolations(page)).toEqual([]);
    expectInsertionsSafe(loader.insertions());
    assertNoTrackingValues(capture.requests());
  });

  test("with bfcache enabled, Back to the scrubbed entry never shows a number", async ({ baseURL }) => {
    // Playwright disables bfcache by default; this browser re-enables it. Chrome may still refuse to cache the
    // deep-link document (Cache-Control: no-store), so both outcomes are checked against the same rules.
    const browser = await chromium.launch({ ignoreDefaultArgs: ["--disable-back-forward-cache"] });
    try {
      const context = await browser.newContext({ baseURL, locale: "ko-KR", timezoneId: "Asia/Seoul" });
      const page = await context.newPage();
      const capture = await captureThirdParty(page);
      const loader = await watchAdLoader(page);
      await installUrlSampler(page);
      await page.addInitScript(() => {
        window.addEventListener("pageshow", (event) => {
          if (event.persisted) document.documentElement.dataset.ttBfcache = "restored";
        });
      });
      const lookups = recordLookups();
      await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
      await page.goto(`/${FAKE.domestic}`);
      await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
      await expectPath(page, "/");
      await expectLoaderInCurrentDocument(page, loader, "deepLink");

      await page.goto("/privacy");
      await page.goBack();
      await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
      await expectPath(page, "/");
      const fromCache = await page.evaluate(() => document.documentElement.dataset.ttBfcache === "restored");
      test.info().annotations.push({ type: "bfcache", description: fromCache ? "restored from bfcache" : "loaded again" });
      expect(lookups.numbers()).toHaveLength(fromCache ? 1 : 2);
      await expectLoaderInCurrentDocument(page, loader, fromCache ? "deepLink" : "home");
      expect(await urlViolations(page)).toEqual([]);
      expectInsertionsSafe(loader.insertions());
      assertNoTrackingValues(capture.requests());
    } finally {
      await browser.close();
    }
  });

  test("a second deep link in the same tab: Back restores the tab's last lookup, never a number URL", async ({ page }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    await installUrlSampler(page);
    const lookups = recordLookups();
    await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");
    await expectLoaderInCurrentDocument(page, loader, "deepLink");
    expect(await urlViolations(page)).toEqual([]);

    await page.goto(`/${FAKE.hbl}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");
    await expectLoaderInCurrentDocument(page, loader, "deepLink");
    expect(await urlViolations(page)).toEqual([]);

    await page.goBack();
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");
    // One entry per tab (spec §3): the restored lookup is the tab's last one.
    expect(lookups.numbers()).toEqual([FAKE.domestic, FAKE.hbl, FAKE.hbl]);
    await expectLoaderInCurrentDocument(page, loader, "home");
    expect(await urlViolations(page)).toEqual([]);
    expectInsertionsSafe(loader.insertions());
    assertNoTrackingValues(capture.requests());
  });

  test("a hash entry created before hydration never brings the number back into location", async ({ page }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    await installUrlSampler(page);
    await mockTrack(page, inTransit(FAKE.domestic));
    let releaseScripts: () => void = () => undefined;
    const scriptsReleased = new Promise<void>((resolve) => {
      releaseScripts = resolve;
    });
    // Hold every script so the page stays un-hydrated, like a slow network.
    await page.route(/\/_next\/static\/.+\.js(?:\?.*)?$/, async (route) => {
      await scriptsReleased;
      await route.continue();
    });
    await page.goto(`/${FAKE.domestic}`, { waitUntil: "commit" });
    await page.evaluate(() => {
      location.hash = "tracking";
    });
    await expect.poll(() => page.evaluate(() => location.hash)).toBe("#tracking");
    releaseScripts();

    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");
    await expectLoaderInCurrentDocument(page, loader, "deepLink");
    await page.goBack();
    await expectPath(page, "/");
    await page.waitForTimeout(300);
    expect(await urlViolations(page)).toEqual([]);
    expectInsertionsSafe(loader.insertions());
    assertNoTrackingValues(capture.requests());
  });

  test("local-router regression (GAP1): links, back/forward and reload stay consistent without numbers in the URL", async ({
    page
  }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    const lookups = recordLookups();
    await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
    const rscRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("_rsc=") || request.headers()["rsc"] === "1") rscRequests.push(request.url());
    });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    // 1. The deep link lands; the lookup runs and the URL becomes '/'.
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");

    // From here on no navigation may carry a number. (Before the scrub, the router's own hydration
    // replaceState reports the deep-link URL once more; that is the URL the customer opened, not a new leak.)
    const navigated: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigated.push(frame.url());
    });

    // 2. The site's own footer link to /privacy (client navigation).
    await page.getByRole("link", { name: "개인정보처리방침" }).first().click();
    await expectPath(page, "/privacy");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("개인정보처리방침");

    // 3. Back to the tracker through a link to '/' on the privacy page.
    await page
      .getByRole("link", { name: "배송 조회로 돌아가기" })
      .or(page.getByRole("link", { name: "통관·배송 조회" }))
      .first()
      .click();
    await expectPath(page, "/");
    await expect(page.getByRole("button", RESULT_READY)).toHaveCount(0);
    await expect(page.getByLabel(INPUT_LABEL, { exact: true })).toHaveValue("");

    // 4–5. Back, back: the first entry (the scrubbed deep link) shows its result again, not the privacy page.
    await page.goBack();
    await expectPath(page, "/privacy");
    await page.goBack();
    await expectPath(page, "/");
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).not.toContainText("개인정보처리방침");

    // 6. Forward, back.
    await page.goForward();
    await expectPath(page, "/privacy");
    await page.goBack();
    await expectPath(page, "/");
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();

    // 7. Reload on the first entry: '/' restores the lookup (it used to be a number URL).
    const lookupsBeforeReload = lookups.numbers().length;
    await page.reload();
    await expectPath(page, "/");
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    expect(lookups.numbers()).toHaveLength(lookupsBeforeReload + 1);

    // 8. A manual lookup from an idle home keeps '/'.
    await page.goto("/");
    await submitFromHome(page, FAKE.domesticAlt);
    await expectPath(page, "/");

    expect(lookups.numbers().slice(0, -1).every((number) => number === FAKE.domestic)).toBe(true);
    expect(lookups.numbers().at(-1)).toBe(FAKE.domesticAlt);
    expect(pageErrors).toEqual([]);
    expect(rscRequests.length, "RSC request storm (GAP1-01 saw 135–226)").toBeLessThanOrEqual(RSC_REQUEST_LIMIT);
    expect(navigated.length).toBeGreaterThan(0);
    for (const url of navigated) expect(containsTrackingLikeValue(pathOf(url)), url).toBe(false);
    expectInsertionsSafe(loader.insertions());
    assertNoTrackingValues(capture.requests());
  });
});
```

- [ ] **Step 2: Run the rows**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/url-privacy.spec.ts`
Expected: `13 passed` (the six new rows pin behavior built in Tasks 1, 6 and 7). Write the bfcache annotation ("restored from bfcache" or "loaded again") into the stage summary.

- [ ] **Step 3: Prove the two key rows bite (temporary mutations, not committed)**

(a) In `lib/privacy/url-scrub.ts`, change the line `    installHistoryGuard();` inside `runScrub` to `    // installHistoryGuard();`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/url-privacy.spec.ts -g "hash entry created before hydration"`
Expected: FAIL — `expectPath(page, "/")` after `goBack()` receives `/000012345678`.
Undo: `git restore lib/privacy/url-scrub.ts`

(b) In `components/HomePageClient.tsx`, change `restoreSnapshot = readRestoreEntry({ now: Date.now(), navigation: currentNavigationKind() });` to `restoreSnapshot = null;`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/url-privacy.spec.ts -g "reload after the scrub"`
Expected: FAIL — `toBeVisible()` for '다시 볼 링크 복사' after the reload times out.
Undo: `git restore components/HomePageClient.tsx`

Check: `git status --short` lists only `tests/e2e/url-privacy.spec.ts`.

- [ ] **Step 4: Production build run of the same file**

Run: `npm run build`; background PowerShell `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait for `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` = `200`; then `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test tests/e2e/url-privacy.spec.ts tests/e2e/session-restore.spec.ts`
Expected: `23 passed` (13 + 10). Record the RSC count printed by a failing limit if any (none expected) and the bfcache annotation. Stop the server (Task 0 Step 4 command) and clear the flags: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck; npx eslint tests/e2e/url-privacy.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 6: Commit**

```powershell
git add tests/e2e/url-privacy.spec.ts
git commit -m "test: pin reload, back/forward, bfcache and local-router behavior around the URL scrub"
```

Expected: `1 file changed`.

---

### Task 10: Privacy policy text

**Files:**
- Modify: `app/(public)/privacy/page.tsx` (imports lines 1–4, `LAST_UPDATED` line 12, `sections` lines 14–56, contact heading line 96)
- Test: `tests/privacy.spec.ts` (append one test; add one import)

**Interfaces:**
- Consumes: `AD_TIMING_POLICY`, `AdTimingPolicy` (Task 3); `TALK_URL` stays as imported by the page.
- Produces: the policy paragraphs spec §16 item 6 asks for — Google page-address collection with the ad-timing rule actually shipped, Vercel access logs including page addresses, customstrack.com forwarding, tab-only 30-minute storage, link sharing — and a new 시행일. The legal line '입력한 번호와 조회 결과는 서버 데이터베이스에 저장하지 않습니다.' and the two existing sentences of section 1 stay verbatim.

- [ ] **Step 1: Write the failing test**

In `tests/privacy.spec.ts`, add below the existing import lines:

```ts
import { AD_TIMING_POLICY } from "@/lib/ads/ad-gate";
import type { AdTimingPolicy } from "@/lib/ads/ad-gate";
```

Append at the end of the file:

```ts
const AD_TIMING_DISCLOSURE: Readonly<Record<AdTimingPolicy, string>> = {
  afterScrub: "사이트 첫 주소(tracking.tipoasis.com/)로 바꾼 뒤에만 광고 코드를 불러옵니다.",
  afterAllowedResult: "조회 결과가 광고를 보여도 되는 상태로 확인된 뒤에만 광고 코드를 불러옵니다.",
  neverOnNumberRoutes: "조회번호가 들어간 주소로 들어온 화면에서는 광고 코드를 불러오지 않습니다."
};

test("privacy policy discloses page addresses, access logs, customs lookup forwarding and tab-only storage", async ({
  page
}) => {
  await page.goto("/privacy");
  const policy = page.locator("main");
  const disclosures = [
    "입력한 번호와 조회 결과는 서버 데이터베이스에 저장하지 않습니다.",
    "지금 보고 있는 페이지 주소를 Google에 보냅니다.",
    AD_TIMING_DISCLOSURE[AD_TIMING_POLICY],
    "접속 로그에는 요청한 페이지 주소도 함께 남습니다.",
    "통관 조회 서비스(customstrack.com)",
    "이 브라우저 탭 안(세션 저장소)에만 보관합니다.",
    "30분이 지나면 다시 쓰지 않고, 탭을 닫으면 브라우저가 지웁니다.",
    "[다시 볼 링크 복사]로 만든 링크에는 조회번호가 들어 있습니다."
  ];
  for (const text of disclosures) {
    await expect(policy.getByText(text, { exact: false }).first(), text).toBeVisible();
  }
  const effective = policy.getByText(/^시행일: /);
  await expect(effective).toHaveText(/^시행일: \d{4}년 \d{1,2}월 \d{1,2}일$/);
  await expect(effective).not.toHaveText("시행일: 2026년 9월 3일");
  await expect(policy.getByRole("heading", { level: 2, name: "8. 문의 채널" })).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/privacy.spec.ts -g "discloses page addresses"`
Expected: FAIL — `1 failed`: `toBeVisible` for "지금 보고 있는 페이지 주소를 Google에 보냅니다." finds no element.

- [ ] **Step 3: Pick the effective date**

Run: `Get-Date -Format "yyyy-M-d"` → e.g. `2026-10-2`. Write it as `YYYY년 M월 D일` (e.g. `2026년 10월 2일`). This is the date the change is prepared; Task 13 asks the operator to confirm or replace it with the R1 deploy date.

- [ ] **Step 4: Rewrite the policy text**

In `app/(public)/privacy/page.tsx`:

(a) Below the existing `import { TALK_URL } from "@/lib/storefront";` add:

```ts
import { AD_TIMING_POLICY } from "@/lib/ads/ad-gate";
import type { AdTimingPolicy } from "@/lib/ads/ad-gate";
```

(b) Replace the line `const LAST_UPDATED = "2026년 9월 3일";` with the following, using the Step 3 date for `LAST_UPDATED` (the example value is the Step 3 example):

```ts
const LAST_UPDATED = "2026년 10월 2일";
const PREVIOUS_EFFECTIVE_DATE = "2026년 9월 3일";

// The ad paragraph follows the policy that actually ships (lib/ads/ad-gate.ts), so text and behavior cannot disagree.
const AD_URL_SENTENCE: Readonly<Record<AdTimingPolicy, string>> = {
  afterScrub:
    "조회번호가 Google에 전달되지 않도록, 조회번호가 들어간 주소로 들어오면 주소를 먼저 사이트 첫 주소(tracking.tipoasis.com/)로 바꾼 뒤에만 광고 코드를 불러옵니다. 주소를 바꾸지 못하면 그 화면에서는 광고를 불러오지 않습니다.",
  afterAllowedResult:
    "조회번호가 Google에 전달되지 않도록, 조회번호가 들어간 주소로 들어오면 주소를 먼저 사이트 첫 주소(tracking.tipoasis.com/)로 바꾸고, 조회 결과가 광고를 보여도 되는 상태로 확인된 뒤에만 광고 코드를 불러옵니다. 주소를 바꾸지 못하면 그 화면에서는 광고를 불러오지 않습니다.",
  neverOnNumberRoutes:
    "조회번호가 Google에 전달되지 않도록, 조회번호가 들어간 주소로 들어온 화면에서는 광고 코드를 불러오지 않습니다."
};
```

(c) Replace the whole `const sections = [ … ] as const;` block with:

```ts
const sections = [
  {
    title: "1. 수집하는 정보",
    body: [
      "이 서비스는 회원가입이나 로그인 없이 이용할 수 있으며, 이름·연락처·주소 등 개인정보를 입력받지 않습니다.",
      "조회를 위해 입력한 HBL 번호, 화물관리번호 또는 국내 운송장 번호는 조회 시점에 관세청 UNI-PASS와 택배사 조회 서비스에 전달되는 목적으로만 사용됩니다. 관세청 UNI-PASS에서 통관 기록을 찾지 못하면 같은 번호로 통관 조회 서비스(customstrack.com)에서도 확인합니다.",
      "입력한 번호와 조회 결과는 서버 데이터베이스에 저장하지 않습니다. 동일 번호의 반복 조회 부담을 줄이기 위해 조회 결과를 서버 메모리에 최대 15분간 임시 보관한 뒤 자동 삭제합니다.",
      "[다시 볼 링크 복사]로 만든 링크에는 조회번호가 들어 있습니다. 링크를 받은 사람도 같은 배송 상태를 볼 수 있으니 필요한 사람에게만 보내 주세요."
    ]
  },
  {
    title: "2. 자동으로 기록되는 정보",
    body: [
      "서비스 호스팅 사업자(Vercel)는 서비스 안정 운영을 위해 접속 IP, 접속 시각, 브라우저 종류 등 접속 로그를 일정 기간 보관할 수 있습니다.",
      "접속 로그에는 요청한 페이지 주소도 함께 남습니다. 조회번호가 들어간 주소(예: tracking.tipoasis.com/조회번호)로 접속하면 그 주소가 접속 로그에 남을 수 있습니다.",
      "과도한 요청을 막기 위해 접속 IP 기준 요청 횟수를 서버 메모리에서 짧게 계산하며, 이 정보는 별도로 저장하거나 식별에 사용하지 않습니다."
    ]
  },
  {
    title: "3. 이 브라우저에 잠시 보관하는 정보",
    body: [
      "새로고침하거나 뒤로 가기로 조회 화면에 돌아왔을 때 결과를 다시 보여 드리기 위해, 마지막으로 조회한 번호 1건과 택배사, 조회 시각을 이 브라우저 탭 안(세션 저장소)에만 보관합니다. 이 정보는 서버로 보내지 않습니다.",
      "보관한 정보는 30분이 지나면 다시 쓰지 않고, 탭을 닫으면 브라우저가 지웁니다. 다른 탭이나 다른 기기에서는 보이지 않습니다."
    ]
  },
  {
    title: "4. 광고 및 쿠키",
    body: [
      "이 서비스는 Google AdSense 광고를 게재합니다. Google 및 광고 파트너는 쿠키를 사용해 이용자의 이 사이트 또는 다른 사이트 방문 기록을 바탕으로 광고를 표시할 수 있습니다.",
      "Google AdSense 광고 코드는 광고를 고르고 부정 사용을 막기 위해 지금 보고 있는 페이지 주소를 Google에 보냅니다.",
      AD_URL_SENTENCE[AD_TIMING_POLICY],
      "맞춤 광고 쿠키 사용은 Google 광고 설정(https://www.google.com/settings/ads)에서 거부할 수 있습니다.",
      "이 서비스 자체는 이용자를 식별하기 위한 쿠키를 별도로 발행하지 않습니다."
    ]
  },
  {
    title: "5. 외부 링크",
    body: [
      "페이지 안의 네이버 스토어, 쿠팡 스토어, 네이버 톡톡 링크는 각 사업자가 운영하는 외부 서비스로 이동합니다. 이동한 뒤의 개인정보 처리는 해당 서비스의 방침을 따릅니다.",
      "쿠팡 링크는 쿠팡 파트너스 제휴 링크이며, 이를 통해 구매하면 운영자가 일정 수수료를 받을 수 있습니다. 구매 가격에는 영향이 없습니다."
    ]
  },
  {
    title: "6. 이용자의 권리",
    body: [
      "이 서비스는 개인정보를 저장하지 않으므로 열람·정정·삭제 요청 대상 정보가 없습니다.",
      "이 브라우저 탭에 보관한 마지막 조회 기록은 탭을 닫으면 바로 지워집니다.",
      "개인정보 처리에 관한 문의는 아래 문의 채널로 보내 주시면 확인 후 답변드립니다."
    ]
  },
  {
    title: "7. 방침 변경",
    body: [
      "이 방침이 바뀌면 이 페이지에 변경 내용과 시행일을 표시합니다.",
      `${LAST_UPDATED} 변경: 광고 코드가 받는 페이지 주소 처리, 접속 로그에 남는 페이지 주소, 통관 조회 서비스(customstrack.com) 확인, 이 브라우저 탭 임시 보관, 조회 링크 공유 안내를 추가했습니다. 이전 시행일: ${PREVIOUS_EFFECTIVE_DATE}.`
    ]
  }
] as const;
```

(d) Replace the contact heading text `              7. 문의 채널` with `              8. 문의 채널`.

- [ ] **Step 5: Run test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/privacy.spec.ts`
Expected: every test in the file passes (the new one included), 0 failed.

- [ ] **Step 6: No real-number or forbidden-word regressions**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: 0 failed (the new text has no 10+ digit run and no HBL-like token).

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck; npx eslint "app/(public)/privacy/page.tsx" tests/privacy.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 8: Commit**

```powershell
git add "app/(public)/privacy/page.tsx" tests/privacy.spec.ts
git commit -m "docs: disclose page addresses, access logs, customs lookup and tab-only storage in the privacy policy"
```

Expected: `2 files changed`.

---

### Task 11: Same-address history entry for Back (only if the local-router regression passes)

**Files:**
- Modify: `components/HomePageClient.tsx` (imports; module helpers below `markRestoreConsumed`; refs; `handleSuccess`; `handleError`; `handleSubmitted`; one new effect)
- Test: `tests/e2e/url-privacy.spec.ts` (append a `describe`)

**Interfaces:**
- Consumes: `TrackingFormSubmitSource` and the `source` argument of `onSubmitted` (Task 7); the Task 9 regression rows as the acceptance gate.
- Produces: after a manual lookup settles on `/`, one extra history entry at the same address `/` (state `{ ttLookup: true }` plus Next's internal keys); Back returns to the lookup form (result cleared, number kept in the input), Forward shows the last result again without a new lookup. Spec §3: "번호 없는 같은 주소 항목을 쌓아 조회 화면으로 돌아오게 하되, local-router 회귀 통과 전에는 만들지 않습니다." Step 6 decides whether it ships.

- [ ] **Step 1: Write the failing test**

Append at the end of `tests/e2e/url-privacy.spec.ts`:

```ts
test.describe("same-address history entry", () => {
  test("after a manual lookup, Back returns to the lookup form at '/', Forward shows the result again", async ({ page }) => {
    const lookups = recordLookups();
    await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
    await page.goto("/");
    const lengthBefore = await page.evaluate(() => history.length);
    await submitFromHome(page, FAKE.domestic);
    await expectPath(page, "/");
    expect(await page.evaluate(() => history.length)).toBe(lengthBefore + 1);

    await page.goBack();
    await expectPath(page, "/");
    await expect(page.getByRole("button", RESULT_READY)).toHaveCount(0);
    await expect(page.getByLabel(INPUT_LABEL, { exact: true })).toBeVisible();

    await page.goForward();
    await expectPath(page, "/");
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    expect(lookups.numbers()).toEqual([FAKE.domestic]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/url-privacy.spec.ts -g "same-address history entry"`
Expected: FAIL — `expect(history.length)` received `lengthBefore` (no entry is pushed yet).

- [ ] **Step 3: Implement the entry in `HomePageClient`**

In `components/HomePageClient.tsx`:

(a) Below `import { TrackingForm } from "@/components/TrackingForm";` add:

```ts
import type { TrackingFormSubmitSource } from "@/components/TrackingForm";
```

(b) Directly below the `markRestoreConsumed` helper (added in Task 7) insert:

```ts

// Same-address history entry (spec §3 뒤로가기): when a manual lookup settles on '/', push '/' once more so that
// Back returns to the lookup form instead of leaving the site. Kept only because the local-router regression passes.
const LOOKUP_HISTORY_MARK = "ttLookup";
const isLookupHistoryEntry = (state: unknown): boolean =>
  typeof state === "object" && state !== null && LOOKUP_HISTORY_MARK in state;
const pushLookupHistoryEntry = (): void => {
  const { pathname, search, hash } = window.location;
  if (pathname !== "/" || search !== "" || hash !== "") return;
  if (isLookupHistoryEntry(window.history.state)) return;
  window.history.pushState({ [LOOKUP_HISTORY_MARK]: true }, "", "/");
};
```

(c) Below `const resultTopRef = useRef<HTMLHeadingElement | null>(null);` add:

```ts
  const lastOutcomeRef = useRef<{ readonly result: TrackResponseData | null; readonly error: string } | null>(null);
  const manualLookupPendingRef = useRef(false);
```

(d) In `handleSuccess`, replace

```ts
    setResult(data);
    setError("");
```

with

```ts
    setResult(data);
    setError("");
    lastOutcomeRef.current = { result: data, error: "" };
    if (manualLookupPendingRef.current) {
      manualLookupPendingRef.current = false;
      pushLookupHistoryEntry();
    }
```

(e) Replace `handleError`

```ts
  const handleError = useCallback((message: string) => {
    setError(message);
    if (message) setResult(null);
  }, []);
```

with

```ts
  const handleError = useCallback((message: string) => {
    setError(message);
    if (!message) return;
    setResult(null);
    lastOutcomeRef.current = { result: null, error: message };
    if (manualLookupPendingRef.current) {
      manualLookupPendingRef.current = false;
      pushLookupHistoryEntry();
    }
  }, []);
```

(f) Replace the Task 7 `handleSubmitted`

```ts
  const handleSubmitted = useCallback((number: string, carrier: DeliveryCarrierCode) => {
    markRestoreConsumed();
    saveRestoreEntry({ number, carrier, savedAt: Date.now() });
  }, []);
```

with

```ts
  const handleSubmitted = useCallback(
    (number: string, carrier: DeliveryCarrierCode, source: TrackingFormSubmitSource) => {
      markRestoreConsumed();
      saveRestoreEntry({ number, carrier, savedAt: Date.now() });
      manualLookupPendingRef.current = source === "manual";
    },
    []
  );

  useEffect(() => {
    const onPopState = (event: PopStateEvent): void => {
      if (window.location.pathname !== "/") return;
      if (isLookupHistoryEntry(event.state)) {
        const last = lastOutcomeRef.current;
        if (!last) return;
        setResult(last.result);
        setError(last.error);
        return;
      }
      setResult(null);
      setError("");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/url-privacy.spec.ts -g "same-address history entry"`
Expected: `1 passed`.

- [ ] **Step 5: Run the regression gate in both modes**

Dev: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e tests/tracking.spec.ts tests/privacy.spec.ts`
Expected: 0 failed; `tests/e2e/url-privacy.spec.ts` reports `14 passed`.
Production: `npm run build`; background `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait for status `200`; `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test tests/e2e/url-privacy.spec.ts tests/e2e/session-restore.spec.ts`
Expected: `24 passed`. Stop the server and clear the flags (`$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`).

- [ ] **Step 6: Decide**

- All green in Step 5 → go to Step 7 and write "same-address pushState: shipped (local-router regression green in dev and production)" into the stage summary.
- Anything red (typically the local-router regression: RSC count, a wrong screen after Back, a page error) → run one focused investigation with `superpowers:systematic-debugging`. If that does not make every Step 5 run green, do not ship: `git restore components/HomePageClient.tsx tests/e2e/url-privacy.spec.ts`, confirm `git status --short` is clean, and write "same-address pushState: not shipped — <test name and assertion that failed>" into the stage summary. Mark Task 11 SKIPPED and continue with Task 12 (the spec rule "only after the local-router regression passes" is satisfied by leaving it out).

- [ ] **Step 7: Typecheck, lint and commit**

Run: `npm run typecheck; npx eslint components/HomePageClient.tsx tests/e2e/url-privacy.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

```powershell
git add components/HomePageClient.tsx tests/e2e/url-privacy.spec.ts
git commit -m "feat: add a same-address history entry so Back returns to the lookup form"
```

Expected: `2 files changed`.

---

### Task 12: Load ads on scrubbed deep links (approval 6)

**Files:**
- Modify: `lib/ads/ad-gate.ts` (the `AD_TIMING_POLICY` line and its comment)
- Test: `tests/unit/ad-gate.spec.ts` (existing ledger test), `tests/e2e/url-privacy.spec.ts` and `tests/privacy.spec.ts` (policy-aware; unchanged)

**Interfaces:**
- Consumes: roadmap §4 row 6.
- Produces: `AD_TIMING_POLICY = "afterScrub"` — a document that started on a number route inserts the loader once the scrub is confirmed (`location.pathname === "/"`); home and `/privacy` documents as before. The privacy policy sentence switches automatically.

- [ ] **Step 1: Confirm approval 6 is recorded in the roadmap approval ledger; if not, stop**

Run: `Select-String -LiteralPath docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md -Pattern "^\| 6 \|"`
Expected to continue: the row reads `| 6 | Candidate B + companions + privacy policy | approved | …`.
If the Status is `pending` or `rejected`: stop here and mark Task 12 SKIPPED with this reason in the stage summary — "approval 6 is <status>; S02 ships the spec §16 item 6 fallback '번호 URL에서는 광고를 아예 싣지 않는 안(딥링크 인벤토리 0)': `AD_TIMING_POLICY = "neverOnNumberRoutes"`, so a document that started on a number route never loads the AdSense loader, while the scrub, restore, return link, redirect and policy text still ship and the policy states this variant. When approval 6 is granted later, only this task is re-opened (roadmap §4)."

- [ ] **Step 2: See the ledger test fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ad-gate.spec.ts -g "follows approval 6"; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `toContain` on `["afterScrub", "afterAllowedResult"]` receives `"neverOnNumberRoutes"`.

- [ ] **Step 3: Flip the policy**

In `lib/ads/ad-gate.ts` replace

```ts
/** Approval 6 is pending in roadmap §4 → fallback. S02 Task 12 switches this to "afterScrub" when approval 6 is recorded. */
export const AD_TIMING_POLICY: AdTimingPolicy = "neverOnNumberRoutes";
```

with

```ts
/** Approval 6 is recorded in roadmap §4: number-route documents load ads once the URL scrub is confirmed.
 *  S08 switches this to "afterAllowedResult" when approval 7 is recorded. */
export const AD_TIMING_POLICY: AdTimingPolicy = "afterScrub";
```

- [ ] **Step 4: Run the tests**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ad-gate.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `7 passed`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/url-privacy.spec.ts tests/privacy.spec.ts`
Expected: 0 failed; url-privacy reports `14 passed` (`13 passed` if Task 11 was not shipped). The deep-link rows now wait for exactly one loader per deep-link document, inserted at `/`.

- [ ] **Step 5: Production-mode check**

Run: `npm run build`; background `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait for status `200`; `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test tests/e2e/url-privacy.spec.ts`
Expected: 0 failed. Stop the server and clear the flags (`$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`).

- [ ] **Step 6: Commit**

```powershell
git add lib/ads/ad-gate.ts
git commit -m "feat: load ads on deep links after a confirmed URL scrub (approval 6)"
```

Expected: `1 file changed`.

---

### Task 13: Stage summary and R1 release note

**Files:** none in the repository (the stage summary is handed to the operator at Task Final G12).

**Interfaces:**
- Consumes: the notes collected in Tasks 0–12.
- Produces: the stage summary sections below, complete before Task Final.

- [ ] **Step 1: Write the stage summary**

Sections, in this order:
1. **Approvals:** approval 6 status and the shipped `AD_TIMING_POLICY`.
2. **Baseline vs final:** the Task 0 Step 6 counts and the G5/G6 counts.
3. **Decisions:** same-address `pushState` shipped or not (Task 11 Step 6 line); the bfcache annotation from Task 9 ("restored from bfcache" / "loaded again"); how each S01 loader assertion was handled (Task 5 Step 7); any edit where S01 had changed the quoted text.
4. **Contract additions:** the eight items of "Additions to the contract" above, for the roadmap owner (§5 "Contract changes").
5. **Known limits:** `?c=` in return links is ignored by the current page until S06 honors it; restore keeps one entry per tab, so Back to an earlier deep-link entry after a second deep link restores the last lookup; the scrub and its guard depend on Next 16.3.6's history patch (`history.state.__NA`, own-property `replaceState`), so every Next upgrade must re-run `tests/e2e/url-privacy.spec.ts` in production mode; `/X?trackingNumber=X` is the redirect target (Next passes the query through) until the scrub runs.
6. **Notes for later stages:** S04 keeps rendering `ReturnLinkButton` in its result summary (S07 replaces it with `ReturnLinkAction`, labelled '다시 볼 링크 복사', which calls `shareOrCopyLink` the same way); S04 Task 0 Step 10 reads whether Task 11 shipped by searching `components/HomePageClient.tsx` for `ttLookup`; `copyText` uses exactly two copy paths (`navigator.clipboard.writeText`, then `document.execCommand("copy")`), so S05's `CopyButton` tests that stub both always reach `"fallback"` (S05 open issue); S08 (approval 7 only) may pin the clock of a url-privacy row to `FIXTURE_NOW` (S08 Addition 14, a test-only edit to this S02 file); S11 Part B makes `/` and `/privacy` post CSP reports that `captureThirdParty` records and `assertNoTrackingValues` checks — if a dev-mode report ever fails only because a `/_next/static/…` chunk name contains a 10-digit run, the fix is to strip `/_next/static/` asset paths from the checked text in `assertNoTrackingValues` (keep checking the rest of the body: S11's `csp-report.spec.ts` relies on it), in a commit that lists `tests/support/network-capture.ts` as "M S11" (S11 open issue 6); S06 wires `scrubNumberFromUrl`, `readRestoreEntry`/`saveRestoreEntry`, `setAdSignals` and the same-address entry (if shipped) into `LookupController` and keeps the hooks S02's E2E files select (input label + Enter in idle mode, '다시 볼 링크 복사' in result mode, `script[data-ad-loader="adsense"]`); S08 implements `"afterAllowedResult"` in `shouldInsertAdLoader` and its privacy sentence already exists.

- [ ] **Step 2: Add the R1 release note for the operator**

1. Before deploying R1, back up AdSense revenue and RPM per page URL for `/{번호}` addresses for at least the last four weeks (AdSense reports by page URL). After R1 these page views are reported under `/` (or not at all under the fallback policy) and can no longer be separated (GAP1-05).
2. Have the new privacy policy text checked (spec §16 item 6 "법률 확인 권고") and confirm the effective date `LAST_UPDATED` in `app/(public)/privacy/page.tsx`; if R1 ships on another day, change that one constant (Task 10 Step 3 set the preparation date).
3. Say which ad behavior ships: `neverOnNumberRoutes` (approval 6 not granted: no ads on pages opened from notification links) or `afterScrub` (ads after the address is cleaned).
4. Release path: `release/r1` → PR to `main` → CI green → the operator merges (no agent pushes to `main`, no `vercel deploy`).

---

### Task Final: Stage gate

- [ ] **G1. Port free.** `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue` → no output (stop listeners otherwise).
- [ ] **G2. Lint.** `npm run lint` → exit 0, no errors, no warnings introduced by this stage.
- [ ] **G3. Typecheck.** `npm run typecheck` → exit 0.
- [ ] **G4. Build.** `npm run build` → exit 0. Route table: `ƒ /[trackingNumber]` always; `/` is `ƒ` in S01 (it still reads `searchParams`), `○ /` from S02 on, and `○ /` with `Revalidate 5m` from S06 on.
- [ ] **G5. Dev-mode E2E.** `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npm run test:e2e` → "N passed", 0 failed (skips allowed only for tests guarded by `PW_MODE`, `PW_SHOTS`, `PW_VISUAL`, or an approval-gated `test.skip` naming the approval).
- [ ] **G6. Production-mode E2E.** Re-run `npm run build` if `next start` reports a missing or stale build. Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait for `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` = `200`; then `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test` → 0 failed, including `tests/budgets/*`.
- [ ] **G7. After-screens.** Server still running: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='after'; $env:PW_STAGE='S02'; npx playwright test tests/tools/stage-screens.spec.ts` → PNGs in `test-artifacts/stage-screens/S02-after/` at 320, 375, 768, 1024, 1440. Compare with `S02-before/`; send both sets to the operator with SendUserFile. Stop the server (G1 command) and clear the flags: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.
- [ ] **G8. Budgets.** Paste the measured numbers of every budget this plan lists (from the G6 output) into the stage summary. Any budget over its fail line fails the gate.
- [ ] **G9. Code review.** Invoke the `code-review` skill on `git diff claude/tipoasis-tracking-renewal-ae0e3a...HEAD`. Fix every CRITICAL and HIGH finding; if code changed, re-run G2–G6.
- [ ] **G10. Verification.** Invoke `superpowers:verification-before-completion`; paste each command and its result line into the stage summary.
- [ ] **G11. Commit.** `git status` shows only this stage's files (see the roadmap File Map). Commit any remainder with a conventional message and no attribution trailer.
- [ ] **G12. No deploy.** Do not push to `main`; do not run `vercel deploy`. Push `renewal/s02-r1-number-protection` only if the operator asked. Hand the stage summary to the operator; merge into the integration branch only after acceptance (roadmap §5).

S02 budget lines for G8 (from the G6 run of `tests/e2e/url-privacy.spec.ts`): third-party requests captured and aborted (count them from the "home" row: at least the loader request when a loader was expected) with 0 tracking-like values in URL, referer, page location at request time and body; loader insertions in deep-link documents — every one at `location.pathname === "/"` (0 insertions under `neverOnNumberRoutes`); at most one loader per document; RSC requests in the local-router regression ≤ 30 (report the count).

G7 (S01 Addition 1; G7 above already uses that path): the PNGs land in `test-artifacts/stage-screens/S02-after/` and are compared with `test-artifacts/stage-screens/S02-before/` from Task 0 Step 5; check `(Get-ChildItem test-artifacts/stage-screens/S02-after -Filter *.png).Count` equals the before count. The before/after screens differ only by the '다시 볼 링크 복사' button under a result and the privacy page text; anything else is a gate failure to investigate.

---

## Self-Review

- **Spec coverage.** §3 candidate B ①–⑥: ① SSR 0 ad scripts (Task 5 test "SSR HTML…"), ② lookup right after hydration (existing `TrackingForm` effect; Task 6 test asserts the POST), ③ `__NA` wait with rAF retries and no ads if never present (Task 1 "fails closed…", Task 3 gate, Task 6 fail-closed row), ④ stash {번호, 택배사, 시각} (Task 6 `beforeReplace`, Task 2 store), ⑤ `replaceState(null,'','/')` incl. hash (Task 1 happy path, Task 6 "query and hash leave…"), ⑥ re-check → urlSafe (Task 1 `isRoot`, "keeps the old URL"). Head-inline scrub not used; `data-page-url` asserted absent (Task 5/9 `expectInsertionsSafe`). Restore reload/back_forward only, tab-only, 1 entry, 30 min (Tasks 2, 7, 9). Same-address `pushState` only after the regression (Task 9 port, Task 11 gate). Share: [다시 볼 링크 복사], mobile share sheet first (Task 4). strict-origin: S01 headers, relied on by `assertNoTrackingValues` (referer). `?trackingNumber` 307 via `next.config` with `has` query, `/` static (Task 8, G4 `○ /`). §8 loader conditions (Task 3 gate + Task 5 loader: no number in URL, not `/internal`, allowed state per policy). §11 safety net E2E (Task 5 `captureThirdParty` + `assertNoTrackingValues` in every url-privacy row). §14 test contract 4 "커밋 전 replaceState 금지, 같은 주소 pushState 회귀" (Task 1 "__NA alone is not enough", Tasks 9/11). §15 R1 incl. the AdSense backup (Task 13). §16 item 6 proposal and fallback (Task 3 constant, Task 12 gated flip, Task 10 policy text per policy).
- **Placeholder scan.** Every code step shows complete code. The two values chosen at execution time have a rule: the policy effective date (Task 10 Step 3, confirmed by the operator in Task 13) and the S01-dependent edits (quoted anchors; Task 0 Step 9 records the inherited shapes; Task 5 Step 7 gives the exact replacement assertion).
- **Type consistency.** `ScrubStatus`, `AdTimingPolicy`, `AdGateInput`, `AdSignals`, `RestoreEntry`, `NavigationKind`, `StorageLike`, `CopyOutcome`, `ShareOutcome`, `CapturedRequest` are spelled as in roadmap §11.9–§11.10 and declared once. `TrackingFormSubmitSource` is declared in `TrackingForm.tsx` (Task 7) and imported as a type in Task 11. `AdLoaderWatch`/`AdLoaderInsertion`/`LookupRecorder` are declared in `tests/support/network-capture.ts` (Task 5) and only imported elsewhere. Test counts: url-scrub 14, session-restore unit 13, ad-gate 7, return-link 6, url-privacy 3 → 7 → 13 → 14, session-restore E2E 10, legacy-query-redirect 6.
- **Review Focus.** Five lines, each pinned: (1) Task 9 rows + Task 7 + Task 1 "late first frame"; (2) Task 2 `ThrowingStorage` + Task 7 "blocked"/"full"; (3) Task 1 "history guard" + Task 9 "hash entry created before hydration"; (4) Task 8 "unsafe or empty values" + "grouped digits"; (5) Task 4 fallback + mobile share rows.
- **Dry run (plan authoring, 2026-09-26).** Every code block was applied to a scratch copy of `e079461` with S01-shaped stubs (`lib/site.ts`, `lib/privacy/number-patterns.ts`, `tests/fixtures/tracking-fixtures.ts`, `app/(public)/layout.tsx` with the `next/script` tag, `next.config.ts`): every quoted anchor matched exactly once; `tsc --noEmit` and eslint (incl. react-hooks v7 rules) were clean; unit 34/34; against a `next dev --webpack` server return-link 6/6, session-restore 10/10, legacy-query-redirect 6/6, url-privacy 14/14 under both `neverOnNumberRoutes` and `afterScrub`, the new privacy test passed; both Task 9 Step 3 mutations failed exactly as stated. Two plan defects found that way were fixed (the static-page test now ignores comments; the local-router row records navigations only after the scrub, because the router's own hydration `replaceState` reports the deep-link URL once). S01's final plan was checked afterwards: its `(public)/layout.tsx`, `mockTrack`, `trackData`, `buildReturnLink` and `internal-isolation` control test match these assumptions; its `next.config.ts` has no trailing comma after `headers` (Task 8 Step 4 says so).
- **Stage independence of S02 tests.** No S02 E2E selects legacy hooks or copy other than the §11.11 strings ('조회번호 (HBL 또는 운송장)', '다시 볼 링크 복사', '개인정보처리방침') and the privacy page link home (with an `.or()` for the S06 header link), so S04–S08 cannot drop a privacy assertion by restyling; they must keep the behavior.
- **Cross-stage review (phase 4, 2026-09-26).** Every inbound name was re-checked against S01's final plan: `SITE_ORIGIN`, `ADSENSE_LOADER_URL`, `buildReturnLink` (`lib/site.ts`), `containsTrackingLikeValue` (never throws; strict about fixtures), `FAKE`/`FAKE_GROUPED` members used here, `FIXTURE_NOW`, `trackData(state, overrides)`, `mockTrack(page, response, { onRequest })`, `IS_PRODUCTION_RUN`, the `(public)` layout's `next/script` tag, `next.config.ts` (`headers` last, no trailing comma), the stage-screens tool (seven scenarios) and the internal-isolation control test (DOM only). Edits made in this review: stage screens under `test-artifacts/` (S01 Addition 1) in Task 0 Step 5, G7 and their notes; S07's `ReturnLinkAction` named as the successor of `ReturnLinkButton`; Task 5 Step 7 lists S01's non-placement loader lines; Addition 8 states S01's final shape; Task 13 notes answer S04 (history marker), S05 (copy paths), S08 (clock pin under approval 7) and S11 (CSP report bodies). The only code-block change is the successor name in `ReturnLinkButton`'s header comment; the dry-run results above still apply.
