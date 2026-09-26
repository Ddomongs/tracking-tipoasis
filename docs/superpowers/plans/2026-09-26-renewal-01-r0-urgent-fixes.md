# S01 — R0 Urgent Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the current UI (no structural change), remove every real customer number and lock that with a repo-wide guard, make the lookup form paint immediately (fewer font preloads, no SSR `opacity:0`), keep ads off `/internal`, give CS mismatch drafts a validated 14-day lifetime with [전체 삭제], ship stage-1 security headers plus real `robots.txt`/`sitemap.xml`/404 routes, and run CI E2E against the production build — while creating the shared test infrastructure every later stage uses.

**Architecture:** Three new pure modules feed everything else: `lib/site.ts` (origin, AdSense ids, return link), `lib/privacy/number-patterns.ts` (the digit-run and HBL patterns used by the repo guard now and by traffic checks later) and `lib/security/headers.ts` (header rules consumed by a new `next.config.ts`). Route groups split the app into `app/(public)` (AdSense `<Script>` lives only in its layout) and `app/(internal)` (noindex, no ads). The CS mismatch store moves to `lib/cs/mismatch-storage.ts` with a versioned, zod-validated payload. Test infrastructure is created first — `tests/fixtures/tracking-fixtures.ts` (fake numbers, a fixed clock, 15 canned states built with the real normalizer, failure responses, `mockTrack`), `tests/support/prod-mode.ts`, `tests/tools/stage-screens.spec.ts` — and is frozen after this stage.

**Tech Stack:** Next.js 16.3.6 App Router (Turbopack), React 19.3, TypeScript strict, Tailwind CSS 3.4, zod 3.25, framer-motion 11 (still present in R0), Playwright 1.55 as the only test runner (pure-function tests are Playwright tests without `page`). Windows: every `npm`/`npx`/`node` command runs in PowerShell 5.1.

**Spec:** `docs/superpowers/specs/2026-09-26-tracking-renewal-ia-design.md` — §1 (real numbers nowhere; keep-list), §3 (routes, `robots.txt`·`sitemap.xml` as real routes, `Referrer-Policy strict-origin`), §4 "예시 대신 형식 안내", §10 "격리" and the mismatch storage rules, §12 (font budget, "SSR opacity:0은 금지", 보안·SEO header stage 1), §14 test contract items 5–6, §15 R0, §16 승인 11 and 승인 14 (fallback), §17 Q4 (unidentified 12-digit numbers are treated as real). Roadmap and shared contract: `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` (§4 approvals, §6 Task 0, §7 gate, §10 File Map, §11 contract). Evidence: `<scratchpad>/phase1/results-run1/dim-performance.json` (PERF-01 281 font preloads, PERF-02 hero `opacity:0`), `<scratchpad>/phase1/results-run1/dim-architecture.json` (AdSense on `/internal`, unbounded phone storage), `<scratchpad>` as defined in the roadmap header.

**Depends on:** — (first stage; runs on the integration branch as it is after `e079461`).

**Gated by:** approval 11 (Task 12 only: public git history rewrite). Every other task runs regardless of approvals.

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

**S01-specific constraints**
- R0 keeps the current screen structure and copy (spec §15 "화면 구조 그대로"). The only customer-visible changes are: the two example buttons disappear, the help line under the input becomes the format hint from §11.11, headings may render in IBM Plex Sans KR 700 instead of Space Grotesk, and the hero no longer fades in.
- No real or unidentified tracking number, phone number or fragment of one is ever written into a file, a commit message, a test title or a screenshot sent to the operator, and tests are arranged so their failure messages never print one (the repo guard prints `file:line:column (N digits)` only; the format-hint test asserts a button count before any text). Plan text, including this file, follows the same rule (it is scanned by the guard).
- Every existing E2E business-rule assertion is kept. Where a test changes, only the digits change (rule→assertion map in Task 4).
- `app/layout.tsx` must end this stage exactly in the shape S05 consumes: `import { IBM_Plex_Sans_KR } from "next/font/google";`, `const bodyFont = IBM_Plex_Sans_KR({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-body", preload: false });`, the unchanged `metadata` object, and ``<body className={`${bodyFont.variable} google-anno-skip antialiased`}>`` wrapping `<div className="relative z-10">{children}</div>`; no AdSense `<Script>`.
- `tests/fixtures/tracking-fixtures.ts` is frozen after this stage (roadmap §10.4): its exports must be complete and correct now.
- Stage screenshots go to `test-artifacts/stage-screens/<stage>-<before|after>/` (see "Additions to the contract" item 1).

## Review Focus

Conditions the spec implies but no requirement line names; each is pinned by a test in the owning task.

1. **The enforced CSP silently blocks hydration or AdSense** (a `script-src`/`default-src` slipping into the enforced header would freeze the lookup form in every browser): the enforced policy may only contain `base-uri`, `object-src`, `frame-ancestors`, `form-action`. Test: Task 9 `tests/unit/security-headers.spec.ts` "the enforced CSP never limits scripts, styles, images, fonts or connections"; the whole existing suite (which submits lookups) runs under the new headers in Task 9 Step 7 and at the gate.
2. **Mismatch drafts saved by the old version, or damaged by hand** (a bare array, a record without `templateKey`, a non-ISO `createdAt`, invalid JSON, a future payload version): the CS page must open, keep every valid record, drop the rest, and rewrite storage in the v1 envelope. Tests: Task 8 `tests/unit/mismatch-storage.spec.ts` "drops broken records but keeps valid ones", "garbage, foreign versions and non-objects give an empty list".
3. **The CS tool in a browser that refuses storage** (locked-down office PC, private window): the page opens with an empty list, and saving shows a plain Korean error instead of an uncaught exception. Test: Task 8 `tests/internal-cs-helper.spec.ts` "internal helper still works when the browser refuses storage".
4. **Number-route header matching on real-world path variants** (lowercase HBL, `%20`-encoded spaces, hyphens, dotted files such as `/robots.txt`, `/internal` without a sub-path, nested paths): `X-Robots-Tag: noindex` lands on every number-like single segment and nowhere else. Test: Task 9 `tests/unit/security-headers.spec.ts` "number-route matching follows the path rules" (row table run through Next's own matcher).
5. **Ordinary dates and times in docs and later plans** (`2026-09-26 14:05` reads as the digit run `2026-09-26 14` under the contract pattern): the guard must not fail CI on a date, but must still fail on the same ten digits written without separators. Test: Task 2 `tests/unit/real-number-guard.spec.ts` "a date followed by an hour is not a tracking number; the same digits without separators are".

---

## File Structure

| Path | Action (task) | Responsibility |
|---|---|---|
| `tests/fixtures/tracking-fixtures.ts` | Create (1) | Contract §11.10 fixture module: `FIXTURE_NOW`, `FAKE`, `FAKE_GROUPED`, 15 `FixtureState`s via `normalizeTrackingData`, `FAILURE_RESPONSES`, `mockTrack`, `successBody` |
| `tests/support/prod-mode.ts` | Create (1) | `IS_PRODUCTION_RUN` |
| `tests/tools/stage-screens.spec.ts` | Create (1) | Before/after screenshots at 320/375/768/1024/1440 (`PW_SHOTS`, `PW_STAGE`) |
| `tests/unit/tracking-fixtures.spec.ts` | Create (1) | Locks the fixture values, the 15 states and `mockTrack` |
| `.gitignore`, `.vercelignore` | Modify (1) | Ignore `test-artifacts/` |
| `lib/site.ts` | Create (2) | `SITE_ORIGIN`, AdSense ids and loader URL, `buildReturnLink` |
| `lib/privacy/number-patterns.ts` | Create (2) | `DIGIT_RUN_PATTERN`, `HBL_LIKE_PATTERN`, `isAllowedDigitRun`, `findDisallowedDigitRuns`, `containsTrackingLikeValue`, `decodeRepeatedly` |
| `tests/unit/site.spec.ts` | Create (2) | `lib/site.ts` values and `buildReturnLink` |
| `tests/unit/real-number-guard.spec.ts` | Create (2), Modify (4) | Pattern tests (2); repository scan (4) |
| `components/TrackingForm.tsx` | Modify (3: lines 20, 193–212) | Drop `SAMPLE_NUMBERS` and the example buttons; format hint |
| `tests/tracking.spec.ts` | Modify (3, 4) | Format-hint test (3); fixture numbers (4) |
| `tests/privacy.spec.ts`, `tests/customs-estimate.spec.ts`, `tests/delivery-carriers.spec.ts`, `tests/track-api.spec.ts` | Modify (4) | Fixture numbers only |
| `tests/internal-cs-helper.spec.ts` | Modify (4, 8) | Fixture numbers (4); retention, clear-all, blocked storage (8) |
| `components/InternalCsHelper.tsx` | Modify (4: line 214; 8: imports 26–34, handlers 125–152, list header 351–357) | Placeholder (4); storage import, save errors, [전체 삭제], retention note (8) |
| `Plan.md`, `docs/archive/2026-05/cs-ai-shipping-status-automation/*.md`, `docs/insforge-deployment-runbook.md`, `design-system/components/tracking-form.html` | Modify (4) | Fixture numbers; the design card shows the format hint instead of example chips |
| `app/layout.tsx` | Modify (5: fonts; 7: AdSense removed) | Root html/body only |
| `app/globals.css` | Modify (5: line 52) | `--font-display` falls back to `--font-body` |
| `tests/budgets/font-preload.spec.ts` | Create (5) | ≤ 2 font preloads on `/` and `/{번호}` |
| `components/HomePageClient.tsx` | Modify (6: line 97) | Hero `initial={false}` |
| `tests/budgets/first-paint.spec.ts` | Create (6) | No SSR inline `opacity:0`; hero painted without JS |
| `app/page.tsx` → `app/(public)/page.tsx`; `app/[trackingNumber]/page.tsx` → `app/(public)/[trackingNumber]/page.tsx`; `app/privacy/page.tsx` → `app/(public)/privacy/page.tsx`; `app/internal/cs-helper/page.tsx` → `app/(internal)/internal/cs-helper/page.tsx` | Move (7, `git mv`) | Route groups, contents unchanged |
| `app/(public)/layout.tsx` | Create (7) | AdSense `<Script>` for public pages only |
| `app/(internal)/layout.tsx` | Create (7) | `robots: noindex`, `referrer: no-referrer`, no ads |
| `tests/e2e/internal-isolation.spec.ts` | Create (7) | No ad script/request on `/internal/*`; public pages still load it |
| `lib/services/cs-mismatch-storage.ts` → `lib/cs/mismatch-storage.ts` | Move + rewrite (8) | v1 payload, zod, 14-day TTL, legacy migration, `clearAllStoredRecords` |
| `tests/unit/mismatch-storage.spec.ts` | Create (8) | Payload parsing and serialization |
| `lib/security/headers.ts` | Create (9) | `HeaderRule`, `NUMBER_ROUTE_SOURCE`, `buildSecurityHeaders` |
| `next.config.js` → `next.config.ts` | Delete + create (9) | `poweredByHeader: false`, `headers()` |
| `tests/unit/security-headers.spec.ts`, `tests/e2e/security-headers.spec.ts` | Create (9) | Header rules and live responses |
| `app/robots.ts`, `app/sitemap.ts`, `app/not-found.tsx` | Create (10) | Real metadata routes and a real 404 page |
| `tests/e2e/seo-routes.spec.ts` | Create (10) | `robots.txt`, `sitemap.xml`, 404 |
| `.github/workflows/ci.yml` | Modify (11) | E2E against `next start` with `PW_MODE=production` |
| `tests/unit/ci-workflow.spec.ts` | Create (11) | Locks the CI shape |

## Additions to the contract

Reported to the roadmap owner; nothing here renames or changes a §11 name or signature.

1. **Stage-screen output path.** Playwright empties its output directory (`test-results/`) at the start of every run ("This directory is cleaned at the start", `TestProject.outputDir`), so before-screens written to `test-results/stage-screens/` in Task 0 would be deleted by Task 0 Step 6 and by every later run. `tests/tools/stage-screens.spec.ts` therefore writes to `test-artifacts/stage-screens/<PW_STAGE>-<PW_SHOTS>/<scenario>-<width>.png` (git- and vercel-ignored). Wherever the verbatim Task 0 Step 5 or gate G7 text says `test-results/stage-screens/…`, read `test-artifacts/stage-screens/…`. Proposed amendment: replace the path in roadmap §6 Step 5 and §7 G7.
2. **`findDisallowedDigitRuns` details.** It returns the raw matched substrings (separators kept, in document order), and it skips a match whose raw text is an ISO date plus one space plus a two-digit hour (`YYYY-MM-DD HH`, which is what `DIGIT_RUN_PATTERN` takes from `2026-09-26 14:05`). `isAllowedDigitRun` is exactly as in §11.4.
3. **S01-private exports** (used only inside their own module and by S01's unit specs `tests/unit/mismatch-storage.spec.ts` and `tests/unit/security-headers.spec.ts`; a later stage that modifies the owning module or spec — S09 for `lib/cs/mismatch-storage.ts` and its spec, S11 for `lib/security/headers.ts` and its spec — may keep using them there; no other module imports them): `parseMismatchPayload(raw: string | null, now: number): ParsedMismatchPayload`, `serializeMismatchPayload(records: readonly MismatchRecord[]): string` and `interface ParsedMismatchPayload` in `lib/cs/mismatch-storage.ts`; `ALL_ROUTES_SOURCE` and `INTERNAL_ROUTES_SOURCE` in `lib/security/headers.ts`.
4. **Test files not in File Map §10.4:** `tests/unit/tracking-fixtures.spec.ts`, `tests/unit/site.spec.ts`, `tests/unit/ci-workflow.spec.ts` (all S01). Files not in §10: `.gitignore`, `.vercelignore` (S01, one line each).
5. **Cross-stage note for `tests/e2e/internal-isolation.spec.ts`:** its control test "public pages still load the AdSense loader" asserts one `script[src*="adsbygoogle.js"]` on `/`. S02's `AdLoader` keeps that true for the home entry; if approval 7 moves the home loader behind a result or a scroll (S08 `afterAllowedResult`), S08 must adapt that one test (File Map row should read "C S01, M S08").
6. **`lib/site.ts` shape.** `ADSENSE_PUBLISHER_DIGITS` is declared first and `ADSENSE_CLIENT_ID` / `ADSENSE_LOADER_URL` are template literals built from it, so the 16 digits are written once. The values are exactly the §11.3 values (pinned by `tests/unit/site.spec.ts`); `ADSENSE_CLIENT_ID` is typed `string` rather than the string-literal type, which no consumer relies on.

## Conventions for this plan

- Shell: PowerShell 5.1 for `npm`, `npx`, `node` and `git` (no `&&`; use `;`). `$env:NAME='x'` sets a flag for the rest of the session; clear it with `$env:NAME=$null`.
- **Dev-mode run** = `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test <files>` with port 43210 free (Playwright starts `next dev`; a running `next start` on 43210 would be reused by mistake).
- **Production run** = `npm run build` (exit 0) → background PowerShell `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1` → wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200` → `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test <files>` → stop the server with `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }` and clear the flags `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`. `next start` prints the warning `"next start" does not work with "output: standalone" configuration`; it is harmless and the server runs.
- Every task's steps spell these commands out in full.

---

### Task 0: Stage start

- [ ] **Step 1: Read approvals.** Open `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §4. For every approval number in this plan's "Gated by" list, write its Status into the stage summary. `pending`/`rejected` → execute the fallback steps and mark the gated task SKIPPED with the reason.
- [ ] **Step 2: Confirm dependencies.** Run (PowerShell): `git log --oneline claude/tipoasis-tracking-renewal-ae0e3a -40`
  Expected: a `merge: SNN …` commit for every stage in this plan's "Depends on" list.
- [ ] **Step 3: Branch.** Run: `git switch -c renewal/s01-r0-urgent-fixes claude/tipoasis-tracking-renewal-ae0e3a`
  Expected: `Switched to a new branch 'renewal/s01-r0-urgent-fixes'`.
- [ ] **Step 4: Port free.** Run: `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue`
  Expected: no output. Otherwise stop the listener: `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`
- [ ] **Step 5: Baseline build and before-screens.** Run `npm ci` only if `package-lock.json` changed since the last install in this worktree, then `npm run build`.
  Expected: build exits 0. Start the production server in a background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`
  Wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200`.
  Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='before'; $env:PW_STAGE='S01'; npx playwright test tests/tools/stage-screens.spec.ts`
  Expected: PNGs in `test-artifacts/stage-screens/S01-before/` for widths 320, 375, 768, 1024, 1440. (S01 creates the tool first; S01 runs this step after its Task 1.)
- [ ] **Step 6: Baseline suite.** With the server still running: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test`
  Expected: record "N passed / M skipped / 0 failed" in the stage summary. Then stop the server (Step 4 command) and clear the flags: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.

**S01 notes on the standard steps above**
- Step 1: the "Gated by" list is approval 11 only. Its fallback is part of Task 12.
- Step 2: S01 depends on nothing. Expected: the log shows `e079461 docs: add renewal roadmap, shared contract and R4 server-path plan` (or a later commit); no `merge: SNN …` commit is required.
- Step 5: `tests/tools/stage-screens.spec.ts` does not exist yet. Do Step 5's build now (it doubles as the baseline build), skip its screenshot command, and run the screenshot command at the end of Task 1 (Task 1 Step 8). The PNGs land in `test-artifacts/stage-screens/S01-before/`, not `test-results/…` (Additions to the contract, item 1). Step 5 above and gate G7 already carry this path; they are verbatim copies of roadmap §6/§7, which carry the same `test-artifacts/…` path since the roadmap applied this amendment.
- Step 6: record the baseline count; before S01 the suite has only the top-level `tests/*.spec.ts` files.

- [ ] **Step 7 (S01): Check for a hotfix that already removed the real example numbers.** Run (PowerShell):
  `git fetch --all --prune`
  `git log --all --oneline -S SAMPLE_NUMBERS -- components/TrackingForm.tsx`
  Expected (no hotfix anywhere): exactly one line — the commit that introduced the constant. Then run:
  `foreach ($ref in (git for-each-ref --format='%(refname:short)' refs/heads refs/remotes)) { if (git grep -l SAMPLE_NUMBERS $ref -- components/TrackingForm.tsx) { "$ref : has SAMPLE_NUMBERS" } else { "$ref : no SAMPLE_NUMBERS" } }`
  Expected: every line ends with `has SAMPLE_NUMBERS`. Decide:
  - All refs have it → no hotfix. Continue with Task 1.
  - `main` or `origin/main` says `no SAMPLE_NUMBERS` → the hotfix is released. Merge it into the stage branch first: `git merge --no-ff origin/main -m "merge: main (R0 number hotfix) into S01"`. On conflicts keep main's removal of numbers and example buttons. Then run every task as written: when a task's "run to verify it fails" step already passes, write `DONE-BY-HOTFIX` for that task in the stage summary, skip its implementation step, and still commit its new test. If the hotfix created its own fake-number module, Task 1 overwrites `tests/fixtures/tracking-fixtures.ts` with the contract version and Task 4 points the hotfix's tests at it; delete any other fixture module the hotfix added once nothing imports it (`git grep -l "<module name>" -- tests` returns nothing).
  - Only an unreleased branch says `no SAMPLE_NUMBERS` → do not merge it (it is not in production). Write in the stage summary: "hotfix branch `<name>` duplicates S01 Tasks 3–4; merge it to main first or close it". Continue with Task 1.
  If `git log -S` printed more than one line, list the containing branches for each extra commit with `git branch -a --contains <sha>` and apply the same decision.

---

### Task 1: Shared test infrastructure (fixtures, production flag, stage screens)

**Files:**
- Create: `tests/fixtures/tracking-fixtures.ts`
- Create: `tests/support/prod-mode.ts`
- Create: `tests/tools/stage-screens.spec.ts`
- Modify: `.gitignore` (append after line 59), `.vercelignore` (append after the last line)
- Test: `tests/unit/tracking-fixtures.spec.ts`

**Interfaces:**
- Consumes: `normalizeTrackingData` (`lib/services/normalizer.ts`, frozen), `getDeliveryCarrier` (`lib/delivery-carriers.ts`), `identifyTrackingNumber`, `ApiTrackResponseSchema`, `TrackResponseDataSchema`, types from `lib/types.ts`.
- Produces (contract §11.10, frozen after S01): `FIXTURE_NOW_ISO = "2026-09-26T14:05:00+09:00"`, `FIXTURE_NOW: Date`, `FAKE` (11 keys), `FAKE_GROUPED` (4 keys), `type FixtureState` (15 states), `GAP3_06_VARIANTS: readonly FixtureState[]`, `trackData(state: FixtureState, overrides?: Partial<TrackResponseData>): TrackResponseData`, `type FailureFixture` (8 names), `FAILURE_RESPONSES: Readonly<Record<FailureFixture, { status: number; contentType: string; body: string }>>`, `mockTrack(page, response, options?): Promise<void>`, `successBody(data): string`; `IS_PRODUCTION_RUN: boolean` (`tests/support/prod-mode.ts`); the stage-screens tool with its `SCENARIOS` list (later stages append entries only).

- [ ] **Step 1: Write the failing fixture test**

Create `tests/unit/tracking-fixtures.spec.ts`:

```ts
import { expect, test, type Page, type Route } from "@playwright/test";
import { getDeliveryCarrier } from "@/lib/delivery-carriers";
import { ApiTrackResponseSchema, TrackResponseDataSchema } from "@/lib/schemas";
import { identifyTrackingNumber } from "@/lib/services/identifier";
import type { StatusCode, TrackingType } from "@/lib/types";
import {
  FAILURE_RESPONSES,
  FAKE,
  FAKE_GROUPED,
  FIXTURE_NOW,
  FIXTURE_NOW_ISO,
  GAP3_06_VARIANTS,
  mockTrack,
  successBody,
  trackData,
  type FixtureState
} from "../fixtures/tracking-fixtures";

const STATE_TABLE: ReadonlyArray<readonly [FixtureState, TrackingType, StatusCode, string]> = [
  ["pending", "DOMESTIC", 1, "도착전"],
  ["customsArrived", "HBL", 1, "입항보고수리"],
  ["customsWaiting", "HBL", 2, "통관목록접수"],
  ["customsReview", "HBL", 3, "심사진행"],
  ["customsCleared", "HBL", 4, "반출신고"],
  ["handedToCarrier", "HBL", 5, "택배사 인계"],
  ["pickedUp", "HBL", 5, "집화처리"],
  ["inTransit", "HBL", 6, "간선상차"],
  ["inTransitWithDriver", "HBL", 6, "배송출발"],
  ["delivered", "HBL", 7, "배송완료"],
  ["stale", "HBL", 4, "수입신고수리"],
  ["lookupUnavailableAuto", "DOMESTIC", 1, "조회 지연"],
  ["lookupUnavailableCarrier", "DOMESTIC", 1, "조회 지연"],
  ["ambiguous", "DOMESTIC", 1, "택배사 선택 필요"],
  ["customsWithCarrierCut", "HBL", 4, "반출신고"]
];

test("the fixture clock is Saturday 26 September 2026, 14:05 KST", () => {
  expect(FIXTURE_NOW_ISO).toBe("2026-09-26T14:05:00+09:00");
  expect(FIXTURE_NOW.toISOString()).toBe("2026-09-26T05:05:00.000Z");
});

test("fake numbers have the formats their names promise", () => {
  const typeOf = (value: string): string => identifyTrackingNumber(value).type;
  expect([FAKE.domestic, FAKE.domesticAlt, FAKE.domestic10, FAKE.domestic14].map(typeOf)).toEqual([
    "DOMESTIC",
    "DOMESTIC",
    "DOMESTIC",
    "DOMESTIC"
  ]);
  expect([FAKE.hbl, FAKE.hblAlt].map(typeOf)).toEqual(["HBL", "HBL"]);
  expect(typeOf(FAKE.cargo)).toBe("CARGO");
  expect([FAKE.invalidShort, FAKE.invalidConfusable, FAKE.deepLinkInvalid].map(typeOf)).toEqual([
    "UNKNOWN",
    "UNKNOWN",
    "UNKNOWN"
  ]);
  expect(FAKE.phone).toBe("010-0000-1234");
  expect(FAKE_GROUPED).toEqual({
    domestic: "0000 1234 5678",
    domesticAlt: "0000 0000 0001",
    hbl: "TEST 0000 0001",
    hblAlt: "ABCD 0000 0000"
  });
  for (const key of ["domestic", "domesticAlt", "hbl", "hblAlt"] as const) {
    expect(FAKE_GROUPED[key].replace(/ /g, "")).toBe(FAKE[key]);
  }
});

test("every fixture state is valid API data with the expected code and status", () => {
  expect(new Set(STATE_TABLE.map(([state]) => state)).size).toBe(15);
  for (const [state, type, code, status] of STATE_TABLE) {
    const data = trackData(state);
    expect(TrackResponseDataSchema.safeParse(data).success, state).toBe(true);
    expect([data.type, data.currentStatusCode, data.currentStatus], state).toEqual([type, code, status]);
    const events = [...data.customs.events, ...data.delivery.events];
    expect(
      events.every((item) => Date.parse(item.datetime) <= FIXTURE_NOW.getTime()),
      `${state}: no event after FIXTURE_NOW`
    ).toBe(true);
  }
});

test("fixture states carry the flags later stages branch on", () => {
  const pending = trackData("pending");
  expect(pending.isPending).toBe(true);
  expect(pending.estimatedDeliveryDate).toBeUndefined();
  const stale = trackData("stale");
  expect(stale.estimateStale).toBe(true);
  expect(stale.estimatedDeliveryDate).toBeUndefined();
  expect(trackData("lookupUnavailableAuto").delivery).toMatchObject({ carrierCode: "AUTO", lookupUnavailable: true, events: [] });
  expect(trackData("lookupUnavailableCarrier").delivery).toMatchObject({
    carrier: "한진택배",
    carrierCode: "HANJIN",
    lookupUnavailable: true,
    trackingUrl: getDeliveryCarrier("HANJIN").trackingUrl(FAKE.domestic)
  });
  expect(trackData("ambiguous").delivery).toMatchObject({ carrierCode: "AUTO", ambiguous: true, events: [] });
  const cut = trackData("customsWithCarrierCut");
  expect(cut.delivery.lookupUnavailable).toBe(true);
  expect([cut.customs.events.length, cut.delivery.events.length]).toEqual([4, 0]);
  expect(trackData("inTransitWithDriver").delivery.events.at(-1)).toMatchObject({ status: "배송출발", driverPhone: FAKE.phone });
  expect(trackData("delivered").delivery).toMatchObject({ carrier: "CJ대한통운", carrierCode: "CJ" });
});

test("fixture estimates are fixed by FIXTURE_NOW", () => {
  expect(trackData("customsWaiting")).toMatchObject({
    estimatedCustomsClearanceDate: "2026-09-27T01:10:00.000Z",
    estimatedDeliveryDate: "2026-09-30T01:10:00.000Z"
  });
  expect(trackData("customsCleared")).toMatchObject({
    estimatedCustomsClearanceDate: "2026-09-23T15:30:00+09:00",
    estimatedDeliveryDate: "2026-09-26T06:30:00.000Z"
  });
  expect(trackData("inTransit").estimatedDeliveryDate).toBe("2026-09-26T12:40:00.000Z");
  expect(trackData("delivered").estimatedDeliveryDate).toBe("2026-09-26T11:32:00+09:00");
  expect(trackData("stale").lastUpdated).toBe("2026-09-08T11:00:00+09:00");
});

test("GAP3-06 variants, overrides and fresh copies", () => {
  expect(GAP3_06_VARIANTS).toEqual([
    "pending",
    "customsArrived",
    "customsWaiting",
    "customsReview",
    "customsCleared",
    "pickedUp",
    "inTransit",
    "delivered",
    "stale",
    "lookupUnavailableAuto",
    "lookupUnavailableCarrier",
    "ambiguous"
  ]);
  expect(trackData("pending", { trackingNumber: FAKE.domesticAlt }).trackingNumber).toBe(FAKE.domesticAlt);
  const first = trackData("inTransit");
  first.delivery.events.pop();
  expect(trackData("inTransit").delivery.events).toHaveLength(3);
});

test("failure responses mirror what /api/track sends", () => {
  const statuses = Object.fromEntries(Object.entries(FAILURE_RESPONSES).map(([name, reply]) => [name, reply.status]));
  expect(statuses).toEqual({
    invalid400: 400,
    notFound404: 404,
    rateLimited429: 429,
    upstreamTimeout504: 504,
    unavailable503: 503,
    serverError500: 500,
    badGatewayHtml502: 502,
    contractViolation200: 200
  });
  const codes = {
    invalid400: "INVALID_NUMBER",
    notFound404: "NOT_FOUND",
    rateLimited429: "RATE_LIMITED",
    upstreamTimeout504: "API_TIMEOUT",
    unavailable503: "API_TIMEOUT",
    serverError500: "SERVER_ERROR"
  } as const;
  for (const name of Object.keys(codes) as Array<keyof typeof codes>) {
    const reply = FAILURE_RESPONSES[name];
    expect(reply.contentType, name).toBe("application/json");
    const parsed = ApiTrackResponseSchema.parse(JSON.parse(reply.body));
    expect(parsed.success, name).toBe(false);
    if (!parsed.success) expect(parsed.error.code, name).toBe(codes[name]);
  }
  expect(FAILURE_RESPONSES.badGatewayHtml502.contentType).toContain("text/html");
  expect(() => JSON.parse(FAILURE_RESPONSES.badGatewayHtml502.body)).toThrow();
  expect(ApiTrackResponseSchema.safeParse(JSON.parse(FAILURE_RESPONSES.contractViolation200.body)).success).toBe(false);
  expect(ApiTrackResponseSchema.parse(JSON.parse(successBody(trackData("delivered")))).success).toBe(true);
});

test("mockTrack fulfils POST /api/track after the delay, reports the body and lets other methods through", async () => {
  const handlers: Array<(route: Route) => Promise<void>> = [];
  const fakePage = {
    route: async (_url: string, handler: (route: Route) => Promise<void>) => {
      handlers.push(handler);
    }
  } as unknown as Page;
  const seen: unknown[] = [];
  await mockTrack(fakePage, "notFound404", { delayMs: 30, onRequest: (body) => seen.push(body) });
  expect(handlers).toHaveLength(1);

  const fulfilled: unknown[] = [];
  const postRoute = {
    request: () => ({ method: () => "POST", postDataJSON: () => ({ trackingNumber: FAKE.domestic, carrierCode: "AUTO" }) }),
    fulfill: async (reply: unknown) => {
      fulfilled.push(reply);
    },
    fallback: async () => {
      throw new Error("a POST must not fall back");
    }
  } as unknown as Route;
  const started = Date.now();
  await handlers[0]?.(postRoute);
  expect(Date.now() - started).toBeGreaterThanOrEqual(25);
  expect(seen).toEqual([{ trackingNumber: FAKE.domestic, carrierCode: "AUTO" }]);
  expect(fulfilled).toEqual([FAILURE_RESPONSES.notFound404]);

  let fellBack = false;
  const getRoute = {
    request: () => ({ method: () => "GET" }),
    fulfill: async () => {
      throw new Error("a GET must not be fulfilled");
    },
    fallback: async () => {
      fellBack = true;
    }
  } as unknown as Route;
  await handlers[0]?.(getRoute);
  expect(fellBack).toBe(true);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run (PowerShell): `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/tracking-fixtures.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading the file — `Error: Cannot find module '../fixtures/tracking-fixtures'` (no test runs). The web server is skipped because these tests never open a page.

- [ ] **Step 3: Create the fixture module**

Create `tests/fixtures/tracking-fixtures.ts`:

```ts
/**
 * Shared test fixtures (roadmap §11.10). Frozen after S01: later stages add new fixture files instead of editing this one.
 * Every number here is fake. Real customer numbers must never appear in tests, docs or screens (spec §1, §4).
 */
import type { Page } from "@playwright/test";
import { getDeliveryCarrier } from "@/lib/delivery-carriers";
import { normalizeTrackingData } from "@/lib/services/normalizer";
import type {
  DeliveryCarrierCode,
  DeliveryLookupResult,
  StatusCode,
  TrackResponseData,
  TrackingEvent,
  TrackingType
} from "@/lib/types";

/** Saturday 26 September 2026, 14:05 KST — inside the 2026 Chuseok holidays (9/24–9/26). */
export const FIXTURE_NOW_ISO = "2026-09-26T14:05:00+09:00";
export const FIXTURE_NOW: Date = new Date(FIXTURE_NOW_ISO);

export const FAKE = {
  domestic: "000012345678", // '0000 1234 5678'
  domesticAlt: "000000000001", // '0000 0000 0001'
  domestic10: "0000123456",
  domestic14: "00001234567890", // '0000 1234 5678 90'
  hbl: "TEST00000001", // 'TEST 0000 0001'
  hblAlt: "ABCD00000000", // 'ABCD 0000 0000'
  cargo: "000012345678901234",
  invalidShort: "00001",
  invalidConfusable: "0000-0000-00O0",
  deepLinkInvalid: "ABCDE1", // alphanumeric 6–30, identifyTrackingNumber → UNKNOWN
  phone: "010-0000-1234"
} as const;

export const FAKE_GROUPED = {
  domestic: "0000 1234 5678",
  domesticAlt: "0000 0000 0001",
  hbl: "TEST 0000 0001",
  hblAlt: "ABCD 0000 0000"
} as const;

export type FixtureState =
  | "pending"
  | "customsArrived"
  | "customsWaiting"
  | "customsReview"
  | "customsCleared"
  | "handedToCarrier"
  | "pickedUp"
  | "inTransit"
  | "inTransitWithDriver"
  | "delivered"
  | "stale"
  | "lookupUnavailableAuto"
  | "lookupUnavailableCarrier"
  | "ambiguous"
  | "customsWithCarrierCut";

/** The 12 GAP3-06 variants. */
export const GAP3_06_VARIANTS: readonly FixtureState[] = [
  "pending",
  "customsArrived",
  "customsWaiting",
  "customsReview",
  "customsCleared",
  "pickedUp",
  "inTransit",
  "delivered",
  "stale",
  "lookupUnavailableAuto",
  "lookupUnavailableCarrier",
  "ambiguous"
];

const event = (
  status: string,
  statusCode: StatusCode,
  datetime: string,
  location: string,
  extra: Partial<TrackingEvent> = {}
): TrackingEvent => ({ status, statusCode, datetime, location, ...extra });

// Customs of a shipment that arrived this week (estimates land after Chuseok, 9/27 and 9/30).
const ARRIVED_THIS_WEEK = event("입항보고수리", 1, "2026-09-25T09:30:00+09:00", "인천공항");
const LISTED_TODAY = event("통관목록접수", 2, "2026-09-26T10:10:00+09:00", "인천공항세관");
const REVIEW_TODAY = event("심사진행", 3, "2026-09-26T11:40:00+09:00", "인천공항세관");

// Customs of a shipment cleared before Chuseok: code 4 on Wednesday 9/23 (spec §9 worry-date example).
const CLEARED_FLOW: readonly TrackingEvent[] = [
  event("입항보고수리", 1, "2026-09-21T08:40:00+09:00", "인천공항"),
  event("통관목록접수", 2, "2026-09-22T09:05:00+09:00", "인천공항세관"),
  event("수입신고수리", 4, "2026-09-23T14:10:00+09:00", "인천공항세관"),
  event("반출신고", 4, "2026-09-23T15:30:00+09:00", "인천공항세관")
];

// Domestic CJ events after clearance.
const HANDED_OVER = event("택배사 인계", 5, "2026-09-23T17:10:00+09:00", "인천GW");
const PICKED_UP = event("집화처리", 5, "2026-09-23T18:20:00+09:00", "인천GW", {
  detail: "보내시는 고객님으로부터 상품을 인수받았습니다"
});
const HUB = event("간선상차", 6, "2026-09-25T21:40:00+09:00", "곤지암Hub");
const OUT_FOR_DELIVERY = event("배송출발", 6, "2026-09-26T08:05:00+09:00", "서울강남", {
  driverName: "김배송",
  driverPhone: FAKE.phone
});
const DELIVERED = event("배송완료", 7, "2026-09-26T11:32:00+09:00", "서울강남");

// No event for 18 days (the normalizer marks > 14 days as stale).
const STALE_FLOW: readonly TrackingEvent[] = [
  event("통관목록접수", 2, "2026-09-02T10:00:00+09:00", "인천공항세관"),
  event("수입신고수리", 4, "2026-09-08T11:00:00+09:00", "인천공항세관")
];

type LookupHead = Omit<DeliveryLookupResult, "events">;

interface Recipe {
  readonly number: string;
  readonly type: TrackingType;
  readonly customs: readonly TrackingEvent[];
  readonly lookup: LookupHead;
  readonly deliveryEvents: readonly TrackingEvent[];
}

const autoLookup = (flags: Pick<LookupHead, "lookupUnavailable" | "ambiguous"> = {}): LookupHead => ({
  carrier: "국내택배 자동 조회",
  carrierCode: "AUTO",
  ...flags
});

const carrierLookup = (
  code: Exclude<DeliveryCarrierCode, "AUTO">,
  number: string,
  flags: Pick<LookupHead, "lookupUnavailable"> = {}
): LookupHead => ({
  carrier: getDeliveryCarrier(code).name,
  carrierCode: code,
  trackingUrl: getDeliveryCarrier(code).trackingUrl(number),
  ...flags
});

const hblRecipe = (
  customs: readonly TrackingEvent[],
  lookup: LookupHead,
  deliveryEvents: readonly TrackingEvent[] = []
): Recipe => ({ number: FAKE.hbl, type: "HBL", customs, lookup, deliveryEvents });

const domesticRecipe = (lookup: LookupHead): Recipe => ({
  number: FAKE.domestic,
  type: "DOMESTIC",
  customs: [],
  lookup,
  deliveryEvents: []
});

const CJ = carrierLookup("CJ", FAKE.hbl);

const RECIPES: Readonly<Record<FixtureState, Recipe>> = {
  pending: domesticRecipe(autoLookup()),
  customsArrived: hblRecipe([ARRIVED_THIS_WEEK], autoLookup()),
  customsWaiting: hblRecipe([ARRIVED_THIS_WEEK, LISTED_TODAY], autoLookup()),
  customsReview: hblRecipe([ARRIVED_THIS_WEEK, LISTED_TODAY, REVIEW_TODAY], autoLookup()),
  customsCleared: hblRecipe(CLEARED_FLOW, autoLookup()),
  handedToCarrier: hblRecipe(CLEARED_FLOW, CJ, [HANDED_OVER]),
  pickedUp: hblRecipe(CLEARED_FLOW, CJ, [HANDED_OVER, PICKED_UP]),
  inTransit: hblRecipe(CLEARED_FLOW, CJ, [HANDED_OVER, PICKED_UP, HUB]),
  inTransitWithDriver: hblRecipe(CLEARED_FLOW, CJ, [HANDED_OVER, PICKED_UP, HUB, OUT_FOR_DELIVERY]),
  delivered: hblRecipe(CLEARED_FLOW, CJ, [HANDED_OVER, PICKED_UP, HUB, OUT_FOR_DELIVERY, DELIVERED]),
  stale: hblRecipe(STALE_FLOW, autoLookup()),
  lookupUnavailableAuto: domesticRecipe(autoLookup({ lookupUnavailable: true })),
  lookupUnavailableCarrier: domesticRecipe(carrierLookup("HANJIN", FAKE.domestic, { lookupUnavailable: true })),
  ambiguous: domesticRecipe(autoLookup({ ambiguous: true })),
  customsWithCarrierCut: hblRecipe(CLEARED_FLOW, autoLookup({ lookupUnavailable: true }))
};

/** Built with the real normalizer at FIXTURE_NOW; every call returns fresh objects. `overrides` is a shallow merge. */
export function trackData(state: FixtureState, overrides: Partial<TrackResponseData> = {}): TrackResponseData {
  const recipe = RECIPES[state];
  const data = normalizeTrackingData({
    trackingNumber: recipe.number,
    type: recipe.type,
    customsEvents: recipe.customs.map((item) => ({ ...item })),
    deliveryLookup: { ...recipe.lookup, events: recipe.deliveryEvents.map((item) => ({ ...item })) },
    now: FIXTURE_NOW
  });
  return { ...data, ...overrides };
}

export type FailureFixture =
  | "invalid400"
  | "notFound404"
  | "rateLimited429"
  | "upstreamTimeout504"
  | "unavailable503"
  | "serverError500"
  | "badGatewayHtml502"
  | "contractViolation200";

interface CannedResponse {
  readonly status: number;
  readonly contentType: string;
  readonly body: string;
}

const JSON_TYPE = "application/json";
const errorBody = (code: string, message: string): string => JSON.stringify({ success: false, error: { code, message } });

/** Statuses, codes and messages exactly as app/api/track/route.ts sends them (the UI must never show the messages). */
export const FAILURE_RESPONSES: Readonly<Record<FailureFixture, CannedResponse>> = {
  invalid400: {
    status: 400,
    contentType: JSON_TYPE,
    body: errorBody(
      "INVALID_NUMBER",
      "입력하신 번호의 형식을 확인할 수 없습니다. HBL/화물관리번호/국내 운송장 번호를 다시 확인해주세요."
    )
  },
  notFound404: {
    status: 404,
    contentType: JSON_TYPE,
    body: errorBody("NOT_FOUND", "해당 번호로 통관/배송 정보를 찾을 수 없습니다")
  },
  rateLimited429: {
    status: 429,
    contentType: JSON_TYPE,
    body: errorBody("RATE_LIMITED", "조회 요청이 많습니다. 잠시 후 다시 시도해주세요")
  },
  upstreamTimeout504: {
    status: 504,
    contentType: JSON_TYPE,
    body: errorBody("API_TIMEOUT", "조회 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요")
  },
  unavailable503: {
    status: 503,
    contentType: JSON_TYPE,
    body: errorBody(
      "API_TIMEOUT",
      "현재 택배사 조회 시스템 점검으로 배송정보 조회가 지연되고 있습니다. 잠시 후 다시 시도해주세요"
    )
  },
  serverError500: {
    status: 500,
    contentType: JSON_TYPE,
    body: errorBody("SERVER_ERROR", "시스템 오류가 발생했습니다. 관리자에게 문의해주세요")
  },
  badGatewayHtml502: {
    status: 502,
    contentType: "text/html; charset=utf-8",
    body: "<html><body><h1>502 Bad Gateway</h1></body></html>"
  },
  contractViolation200: {
    status: 200,
    contentType: JSON_TYPE,
    body: JSON.stringify({ success: true, data: { trackingNumber: FAKE.domestic } })
  }
};

/** JSON body of a successful /api/track response: { success: true, data }. */
export function successBody(data: TrackResponseData): string {
  return JSON.stringify({ success: true, data });
}

/** Answers every POST /api/track on `page` with `response`; other methods fall through. */
export async function mockTrack(
  page: Page,
  response: TrackResponseData | FailureFixture,
  options: { readonly delayMs?: number; readonly onRequest?: (body: unknown) => void } = {}
): Promise<void> {
  const reply: CannedResponse =
    typeof response === "string"
      ? FAILURE_RESPONSES[response]
      : { status: 200, contentType: JSON_TYPE, body: successBody(response) };

  await page.route("**/api/track", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.fallback();
      return;
    }
    const body: unknown = request.postDataJSON();
    options.onRequest?.(body);
    const delayMs = options.delayMs ?? 0;
    if (delayMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    try {
      await route.fulfill(reply);
    } catch (error) {
      // During delayMs the page may have navigated or closed, so this request no longer exists. Anything else is a real failure.
      if (!(error instanceof Error) || !/closed|disposed|already handled/i.test(error.message)) throw error;
    }
  });
}
```

- [ ] **Step 4: Create the production-run flag**

Create `tests/support/prod-mode.ts`:

```ts
/** True when the suite runs against `next start` (roadmap §11.10). Budgets and production-only checks skip otherwise. */
export const IS_PRODUCTION_RUN: boolean = process.env.PW_MODE === "production";
```

- [ ] **Step 5: Run the fixture test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/tracking-fixtures.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `8 passed`.

- [ ] **Step 6: Create the stage-screens tool and ignore its output**

Create `tests/tools/stage-screens.spec.ts`:

```ts
import { test, type Locator, type Page } from "@playwright/test";
import { FAKE, FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";

/**
 * Before/after screenshots for each stage (roadmap §6 Step 5, §7 G7).
 * Runs only with PW_SHOTS=before|after and PW_STAGE=S01…S11 against a running `next start`.
 * Output: test-artifacts/stage-screens/<PW_STAGE>-<PW_SHOTS>/<scenario>-<width>.png — outside test-results/,
 * because Playwright empties its output directory at the start of every run.
 * Later stages append entries to SCENARIOS only.
 */
const SHOTS = process.env.PW_SHOTS;
const STAGE = process.env.PW_STAGE ?? "SXX";
const SHOTS_ENABLED = SHOTS === "before" || SHOTS === "after";
const OUTPUT_DIR = `test-artifacts/stage-screens/${STAGE}-${SHOTS ?? "off"}`;
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const VIEWPORT_HEIGHT = 900;

interface StageScenario {
  readonly name: string;
  readonly path: string;
  readonly prepare?: (page: Page) => Promise<void>;
}

const SCENARIOS: readonly StageScenario[] = [
  { name: "home", path: "/" },
  { name: "deeplink-pending", path: `/${FAKE.domestic}`, prepare: (page) => mockTrack(page, trackData("pending")) },
  { name: "deeplink-customsWaiting", path: `/${FAKE.hbl}`, prepare: (page) => mockTrack(page, trackData("customsWaiting")) },
  { name: "deeplink-inTransit", path: `/${FAKE.hbl}`, prepare: (page) => mockTrack(page, trackData("inTransit")) },
  { name: "deeplink-delivered", path: `/${FAKE.hbl}`, prepare: (page) => mockTrack(page, trackData("delivered")) },
  { name: "deeplink-notFound", path: `/${FAKE.domestic}`, prepare: (page) => mockTrack(page, "notFound404") },
  { name: "privacy", path: "/privacy" }
];

/** The pre-S01 example buttons and help line showed real shipments; mask them so no real number reaches a screenshot. */
function legacyExampleMasks(page: Page): Locator[] {
  return [page.getByRole("button", { name: /^예시 / }), page.getByText(/예\) \d/)];
}

async function blockThirdParty(page: Page): Promise<void> {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

test.describe("stage screens", () => {
  test.skip(!SHOTS_ENABLED, "stage screens run only with PW_SHOTS=before|after");
  test.describe.configure({ mode: "parallel" });

  for (const scenario of SCENARIOS) {
    for (const width of WIDTHS) {
      test(`${scenario.name} @ ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.clock.setFixedTime(FIXTURE_NOW);
        await blockThirdParty(page);
        if (scenario.prepare) await scenario.prepare(page);
        await page.goto(scenario.path);
        await settle(page);
        await page.screenshot({
          path: `${OUTPUT_DIR}/${scenario.name}-${width}.png`,
          fullPage: true,
          animations: "disabled",
          mask: legacyExampleMasks(page)
        });
      });
    }
  }
});
```

Append to `.gitignore` (after line 59, `/*.png`):

```gitignore

# stage before/after screenshots and one-off local tools (tests/tools/stage-screens.spec.ts)
/test-artifacts
```

Append to `.vercelignore` (after its last line, `production-*.png`):

```text
test-artifacts
```

- [ ] **Step 7: Verify the tool is skipped without the flags**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/tools/stage-screens.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `35 skipped` (7 scenarios × 5 widths), 0 failed.
Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 8: Commit, then take the deferred before-screens (Task 0 Step 5)**

Run: `git add tests/fixtures/tracking-fixtures.ts tests/support/prod-mode.ts tests/tools/stage-screens.spec.ts tests/unit/tracking-fixtures.spec.ts .gitignore .vercelignore; git commit -m "test: add shared tracking fixtures, production flag and stage-screens tool"`
Expected: one commit with 6 files.

The production build from Task 0 Step 5 is still current (Task 1 changed tests only) — unless Task 0 Step 7 merged `origin/main`; in that case run `npm run build` first (expected: exit 0). Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='before'; $env:PW_STAGE='S01'; npx playwright test tests/tools/stage-screens.spec.ts`
Expected: `35 passed`; `(Get-ChildItem test-artifacts/stage-screens/S01-before -Filter *.png).Count` prints `35`. Open `home-375.png`: the two example buttons and the old help line are covered by mask boxes.
Stop the server: `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`; clear the flags: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.

---

### Task 2: Site constants and number patterns

**Files:**
- Create: `lib/site.ts`
- Create: `lib/privacy/number-patterns.ts`
- Test: `tests/unit/site.spec.ts`
- Test: `tests/unit/real-number-guard.spec.ts` (pattern tests; Task 4 adds the repository scan)

**Interfaces:**
- Consumes: `DeliveryCarrierCode` (`lib/types.ts`); `FAKE`, `FAKE_GROUPED` (Task 1).
- Produces (contract §11.3, §11.4):
  - `lib/site.ts`: `SITE_ORIGIN = "https://tracking.tipoasis.com"`, `ADSENSE_PUBLISHER_DIGITS` (16 digits), `ADSENSE_CLIENT_ID = "ca-pub-" + digits`, `ADSENSE_LOADER_URL`, `buildReturnLink(number: string, carrier: DeliveryCarrierCode): string`.
  - `lib/privacy/number-patterns.ts`: `DIGIT_RUN_PATTERN: RegExp` (`/\d(?:[ -]?\d){9,}/g`), `HBL_LIKE_PATTERN: RegExp` (global), `isAllowedDigitRun(run: string, extraAllowed?: readonly string[]): boolean`, `findDisallowedDigitRuns(text: string, extraAllowed?: readonly string[]): readonly string[]` (raw matched runs; skips `YYYY-MM-DD HH`), `containsTrackingLikeValue(text: string): boolean`, `decodeRepeatedly(text: string): string`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/site.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { ADSENSE_CLIENT_ID, ADSENSE_LOADER_URL, ADSENSE_PUBLISHER_DIGITS, SITE_ORIGIN, buildReturnLink } from "@/lib/site";
import { FAKE, FAKE_GROUPED } from "../fixtures/tracking-fixtures";

test("site constants match the production origin and the AdSense account", () => {
  expect(SITE_ORIGIN).toBe("https://tracking.tipoasis.com");
  expect(ADSENSE_CLIENT_ID).toBe("ca-pub-7351210358018620");
  expect(ADSENSE_CLIENT_ID).toBe(`ca-pub-${ADSENSE_PUBLISHER_DIGITS}`);
  expect(ADSENSE_LOADER_URL).toBe(
    `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`
  );
});

test("buildReturnLink encodes the number and adds ?c= only for a chosen carrier", () => {
  expect(buildReturnLink(FAKE.domestic, "AUTO")).toBe(`${SITE_ORIGIN}/${FAKE.domestic}`);
  expect(buildReturnLink(FAKE.hbl, "CJ")).toBe(`${SITE_ORIGIN}/${FAKE.hbl}?c=CJ`);
  expect(buildReturnLink(FAKE_GROUPED.domestic, "HANJIN")).toBe(`${SITE_ORIGIN}/0000%201234%205678?c=HANJIN`);
});
```

Create `tests/unit/real-number-guard.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import {
  DIGIT_RUN_PATTERN,
  HBL_LIKE_PATTERN,
  containsTrackingLikeValue,
  decodeRepeatedly,
  findDisallowedDigitRuns,
  isAllowedDigitRun
} from "@/lib/privacy/number-patterns";
import { ADSENSE_CLIENT_ID, ADSENSE_LOADER_URL, ADSENSE_PUBLISHER_DIGITS } from "@/lib/site";
import { FAKE, FAKE_GROUPED } from "../fixtures/tracking-fixtures";

// Non-fixture values are assembled at runtime so that this file never contains a disallowed run itself.
const NINES_12 = "9".repeat(12);
const NINES_GROUPED = ["9999", "9999", "9999"].join(" ");
const REAL_LOOKING_MOBILE = ["010", "9876", "5432"].join("-");
const DATE_HOUR_DIGITS = ["2026", "0926", "14"].join("");
const IMPOSSIBLE_TIMESTAMP = ["2026", "1399", "250000"].join("");
const FORMAT_HINT =
  "숫자 10~14자리 (예: 0000 0000 0000) · 영문 3~4자로 시작하는 HBL (예: ABCD 0000 0000) · 공백·하이픈은 자동으로 빼요";

const matchesOf = (pattern: RegExp, text: string): string[] =>
  Array.from(text.matchAll(new RegExp(pattern.source, "g")), (match) => match[0]);

test.describe("number patterns (contract §11.4)", () => {
  test("DIGIT_RUN_PATTERN takes 10+ digits joined by single spaces or hyphens", () => {
    expect(DIGIT_RUN_PATTERN.flags).toContain("g");
    expect(matchesOf(DIGIT_RUN_PATTERN, `a ${FAKE_GROUPED.domestic} b`)).toEqual([FAKE_GROUPED.domestic]);
    expect(matchesOf(DIGIT_RUN_PATTERN, "0000-1234-5678")).toEqual(["0000-1234-5678"]);
    expect(matchesOf(DIGIT_RUN_PATTERN, "000 000 000")).toEqual([]);
    expect(matchesOf(DIGIT_RUN_PATTERN, "0000  1234  5678")).toEqual([]);
  });

  test("HBL_LIKE_PATTERN takes 3–4 letters plus 8–16 digits, not inside a longer run", () => {
    expect(HBL_LIKE_PATTERN.flags).toContain("g");
    expect(matchesOf(HBL_LIKE_PATTERN, `q=${FAKE.hbl}&x=1`)).toEqual([FAKE.hbl]);
    expect(matchesOf(HBL_LIKE_PATTERN, FAKE.hbl.toLowerCase())).toEqual([FAKE.hbl.toLowerCase()]);
    expect(matchesOf(HBL_LIKE_PATTERN, `X${FAKE.hbl}`)).toEqual([]);
    expect(matchesOf(HBL_LIKE_PATTERN, `${FAKE.hbl}X`)).toEqual([]);
    expect(matchesOf(HBL_LIKE_PATTERN, "TEST0000000")).toEqual([]);
    expect(matchesOf(HBL_LIKE_PATTERN, FAKE_GROUPED.hblAlt)).toEqual([]);
  });

  test("the repository allowlist keeps fixtures, the AdSense id, timestamps and the fake mobile", () => {
    for (const value of Object.values(FAKE)) expect(findDisallowedDigitRuns(value), value).toEqual([]);
    expect(isAllowedDigitRun(ADSENSE_PUBLISHER_DIGITS)).toBe(true);
    expect(findDisallowedDigitRuns(ADSENSE_CLIENT_ID)).toEqual([]);
    expect(isAllowedDigitRun("20260926140500")).toBe(true);
    expect(isAllowedDigitRun(IMPOSSIBLE_TIMESTAMP)).toBe(false);
    expect(isAllowedDigitRun(FAKE.phone)).toBe(true);
    expect(isAllowedDigitRun(REAL_LOOKING_MOBILE)).toBe(false);
    expect(isAllowedDigitRun(NINES_12)).toBe(false);
    expect(isAllowedDigitRun(NINES_12, [NINES_12])).toBe(true);
  });

  test("findDisallowedDigitRuns returns the raw runs in document order", () => {
    expect(findDisallowedDigitRuns(`a ${NINES_GROUPED} b ${FAKE.domestic} c ${NINES_12}`)).toEqual([NINES_GROUPED, NINES_12]);
  });

  test("a date followed by an hour is not a tracking number; the same digits without separators are", () => {
    expect(findDisallowedDigitRuns("최종 업데이트: 2026-09-26 14:05")).toEqual([]);
    expect(findDisallowedDigitRuns(`최종 업데이트: ${DATE_HOUR_DIGITS}`)).toEqual([DATE_HOUR_DIGITS]);
  });

  test("containsTrackingLikeValue is strict: fixtures count, placeholders and the AdSense id do not", () => {
    expect(containsTrackingLikeValue(FORMAT_HINT)).toBe(false);
    expect(containsTrackingLikeValue(ADSENSE_LOADER_URL)).toBe(false);
    expect(containsTrackingLikeValue(`https://example.com/?u=${FAKE.domestic}`)).toBe(true);
    expect(containsTrackingLikeValue(`/p/${encodeURIComponent(encodeURIComponent(FAKE_GROUPED.domestic))}`)).toBe(true);
    expect(containsTrackingLikeValue(`q=${FAKE_GROUPED.domestic.replace(/ /g, "+")}`)).toBe(true);
    expect(containsTrackingLikeValue(`ref=%2F${FAKE.hbl}`)).toBe(true);
    expect(containsTrackingLikeValue(`title=${FAKE.hbl.toLowerCase()}`)).toBe(true);
    expect(containsTrackingLikeValue("dt=12&ms=345")).toBe(false);
  });

  test("decodeRepeatedly peels nested encoding and survives malformed escapes", () => {
    expect(decodeRepeatedly(encodeURIComponent(encodeURIComponent("a b")))).toBe("a b");
    expect(decodeRepeatedly(`%E0%A4%A ${encodeURIComponent(FAKE_GROUPED.domestic)}`)).toBe(
      `%E0%A4%A ${FAKE_GROUPED.domestic}`
    );
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/site.spec.ts tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading — `Error: Cannot find module '@/lib/site'` (and `'@/lib/privacy/number-patterns'`).

- [ ] **Step 3: Create `lib/site.ts`**

```ts
import type { DeliveryCarrierCode } from "@/lib/types";

/** Production origin (spec §1). Metadata routes, the sitemap and return links use it. */
export const SITE_ORIGIN = "https://tracking.tipoasis.com";
/** AdSense publisher id digits: the only non-fixture 10+ digit run the repository guard allows (roadmap §11.4). */
export const ADSENSE_PUBLISHER_DIGITS = "7351210358018620";
export const ADSENSE_CLIENT_ID = `ca-pub-${ADSENSE_PUBLISHER_DIGITS}`;
export const ADSENSE_LOADER_URL = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;

/** `${SITE_ORIGIN}/${encodeURIComponent(number)}` plus `?c=${carrier}` when carrier !== "AUTO". `number` is already normalized. */
export function buildReturnLink(number: string, carrier: DeliveryCarrierCode): string {
  const link = `${SITE_ORIGIN}/${encodeURIComponent(number)}`;
  return carrier === "AUTO" ? link : `${link}?c=${carrier}`;
}
```

- [ ] **Step 4: Create `lib/privacy/number-patterns.ts`**

```ts
import { ADSENSE_PUBLISHER_DIGITS } from "@/lib/site";

/** A run of 10+ digits, optionally separated by single spaces or hyphens. Global: use matchAll, or copy it before .test(). */
export const DIGIT_RUN_PATTERN = /\d(?:[ -]?\d){9,}/g;
/** HBL-like token: 3–4 ASCII letters immediately followed by 8–16 digits, not inside a longer letter/digit run. Global. */
export const HBL_LIKE_PATTERN = /(?<![A-Za-z0-9])[A-Za-z]{3,4}\d{8,16}(?![A-Za-z0-9])/g;

const FIXTURE_PREFIX = "0000";
const FAKE_MOBILE_DIGITS = /^0100000\d{4}$/;
const ALL_ZERO_DIGITS = /^0+$/;
/** What DIGIT_RUN_PATTERN takes from '2026-09-26 14:05': a calendar date and an hour, not a number. */
const DATE_HOUR_TEXT = /^\d{4}-\d{2}-\d{2} \d{2}$/;
const PERCENT_ESCAPES = /(?:%[0-9A-Fa-f]{2})+/g;
const MAX_DECODE_ROUNDS = 5;
const MIN_TIMESTAMP_YEAR = 2000;
const MAX_TIMESTAMP_YEAR = 2099;

const digitsOnly = (run: string): string => run.replace(/[ -]/g, "");
const freshCopy = (pattern: RegExp): RegExp => new RegExp(pattern.source, pattern.flags);

/** yyyymmddhhmmss with a real calendar date. */
function isTimestamp14(digits: string): boolean {
  if (!/^\d{14}$/.test(digits)) return false;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const hour = Number(digits.slice(8, 10));
  const minute = Number(digits.slice(10, 12));
  const second = Number(digits.slice(12, 14));
  if (year < MIN_TIMESTAMP_YEAR || year > MAX_TIMESTAMP_YEAR || hour > 23 || minute > 59 || second > 59) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Repo guard allowlist (roadmap §11.4). `run` may contain the separators DIGIT_RUN_PATTERN allows. */
export function isAllowedDigitRun(run: string, extraAllowed: readonly string[] = []): boolean {
  const digits = digitsOnly(run);
  return (
    digits.startsWith(FIXTURE_PREFIX) ||
    digits === ADSENSE_PUBLISHER_DIGITS ||
    extraAllowed.includes(digits) ||
    isTimestamp14(digits) ||
    FAKE_MOBILE_DIGITS.test(digits)
  );
}

/** Raw runs (separators kept, document order) that the repository must not contain. Skips 'YYYY-MM-DD HH'. */
export function findDisallowedDigitRuns(text: string, extraAllowed: readonly string[] = []): readonly string[] {
  return Array.from(text.matchAll(freshCopy(DIGIT_RUN_PATTERN)), (match) => match[0]).filter(
    (raw) => !DATE_HOUR_TEXT.test(raw) && !isAllowedDigitRun(raw, extraAllowed)
  );
}

/** URI-decodes until stable (at most 5 rounds). Malformed escapes stay as they are; valid ones around them still decode. */
export function decodeRepeatedly(text: string): string {
  let current = text;
  for (let round = 0; round < MAX_DECODE_ROUNDS; round += 1) {
    const next = current.replace(PERCENT_ESCAPES, (sequence) => {
      try {
        return decodeURIComponent(sequence);
      } catch {
        return sequence; // a broken escape is data, not an error: keep it and continue
      }
    });
    if (next === current) return current;
    current = next;
  }
  return current;
}

function hasTrackingLikeValue(text: string): boolean {
  const runs = Array.from(text.matchAll(freshCopy(DIGIT_RUN_PATTERN)), (match) => digitsOnly(match[0]));
  if (runs.some((digits) => digits !== ADSENSE_PUBLISHER_DIGITS && !ALL_ZERO_DIGITS.test(digits))) return true;
  return freshCopy(HBL_LIKE_PATTERN).test(text);
}

/**
 * Traffic/copy check (strict): after repeated URI-decoding (and with '+' read as a space), any 10+ digit run other than the
 * AdSense publisher digits or an all-zero placeholder, or any HBL-like token. Fixtures such as '000012345678' count.
 */
export function containsTrackingLikeValue(text: string): boolean {
  const decoded = decodeRepeatedly(text);
  return hasTrackingLikeValue(decoded) || hasTrackingLikeValue(decoded.replace(/\+/g, " "));
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/site.spec.ts tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `9 passed`.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

Run: `git add lib/site.ts lib/privacy/number-patterns.ts tests/unit/site.spec.ts tests/unit/real-number-guard.spec.ts; git commit -m "feat: add site constants and tracking-number patterns"`

---

### Task 3: Format hint instead of the example buttons

**Files:**
- Modify: `components/TrackingForm.tsx:20` (delete `SAMPLE_NUMBERS`), `components/TrackingForm.tsx:193-212` (example buttons + help line → format hint)
- Test: `tests/tracking.spec.ts` (new test inserted before the test "user can choose a representative domestic carrier before tracking", currently line 230)

**Interfaces:**
- Consumes: nothing new.
- Produces: the help element `#tracking-format-help` (still referenced by the input's `aria-describedby`) whose text is exactly the §11.11 format hint. S06 replaces the component; the copy is the same.

- [ ] **Step 1: Write the failing test**

In `tests/tracking.spec.ts`, insert this block immediately before the line `test("user can choose a representative domestic carrier before tracking", async ({ page }) => {`:

```ts
const FORMAT_HINT =
  "숫자 10~14자리 (예: 0000 0000 0000) · 영문 3~4자로 시작하는 HBL (예: ABCD 0000 0000) · 공백·하이픈은 자동으로 빼요";

test("the lookup form shows the format hint instead of example numbers", async ({ page }) => {
  await page.goto("/");

  // Count first: if the old buttons are still there, the failure message shows a count, never a number.
  await expect(page.getByRole("button", { name: /^예시/ })).toHaveCount(0);
  const hint = page.locator("#tracking-format-help");
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText(FORMAT_HINT);
  const input = page.getByRole("textbox", { name: "조회번호 (HBL 또는 운송장)", exact: true });
  const describedBy = (await input.getAttribute("aria-describedby")) ?? "";
  expect(describedBy.split(" ")).toContain("tracking-format-help");
});

```

- [ ] **Step 2: Run it to verify it fails**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/tracking.spec.ts -g "format hint"`
Expected: FAIL — `expect(locator).toHaveCount(expected)` for `getByRole('button', { name: /^예시/ })`, `Expected: 0`, `Received: 2`.

- [ ] **Step 3: Remove the example buttons and show the hint**

In `components/TrackingForm.tsx`:
1. Delete line 20, the `const SAMPLE_NUMBERS = [ … ] as const;` declaration (its two string literals are real shipments; do not copy them anywhere).
2. Replace the block that starts at line 193 with `<div className="flex flex-wrap gap-2">` (it maps `SAMPLE_NUMBERS` to `예시 …` buttons) and ends with the closing `</p>` of the `<p id={TRACKING_HELP_ID} …>` element on line 212 — 20 lines in total — with:

```tsx
      <p id={TRACKING_HELP_ID} className={cn("break-keep text-xs leading-5", isLight ? "text-slate-600" : "text-slate-400")}>
        숫자 10~14자리 (예: 0000 0000 0000) · 영문 3~4자로 시작하는 HBL (예: ABCD 0000 0000) · 공백·하이픈은 자동으로 빼요
      </p>
```

After the edit, the end of the component reads:

```tsx
          </div>
        </div>
      </form>
      <p id={TRACKING_HELP_ID} className={cn("break-keep text-xs leading-5", isLight ? "text-slate-600" : "text-slate-400")}>
        숫자 10~14자리 (예: 0000 0000 0000) · 영문 3~4자로 시작하는 HBL (예: ABCD 0000 0000) · 공백·하이픈은 자동으로 빼요
      </p>
      <p className="text-xs leading-5 text-slate-500">
        참고: UNI-PASS 통관조회는 HBL/화물관리번호에서만 동작하며, 국내 운송장은 택배사 배송조회 기준으로 표시됩니다.
      </p>
    </div>
  );
};
```

Use the Grep tool with pattern `SAMPLE_NUMBERS|예시 \{` on `components/`. Expected: no matches.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx playwright test tests/tracking.spec.ts`
Expected: all tests in the file pass (the 15 existing ones plus the new one: `16 passed`).
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

Run: `git add components/TrackingForm.tsx tests/tracking.spec.ts; git commit -m "fix: replace the example tracking numbers with a format hint"`

---

### Task 4: Repository guard and the fixture-number replacement

**Files:**
- Modify: `tests/unit/real-number-guard.spec.ts` (full rewrite: Task 2's pattern tests + the repository scan)
- Modify (digits only): `tests/tracking.spec.ts`, `tests/privacy.spec.ts`, `tests/customs-estimate.spec.ts`, `tests/delivery-carriers.spec.ts`, `tests/internal-cs-helper.spec.ts`, `tests/track-api.spec.ts`
- Modify: `components/InternalCsHelper.tsx:214` (placeholder)
- Modify: `Plan.md:260,488,510,528`, `docs/archive/2026-05/cs-ai-shipping-status-automation/cs-ai-shipping-status-automation.design.md:197,207,211`, `docs/archive/2026-05/cs-ai-shipping-status-automation/cs-ai-shipping-status-automation.do.md:178,183,271,275,299`, `docs/insforge-deployment-runbook.md:57-59`, `design-system/components/tracking-form.html` (full rewrite)
- Temporary (not committed): `test-artifacts/tools/replace-literals.cjs`

**Interfaces:**
- Consumes: `DIGIT_RUN_PATTERN`, `findDisallowedDigitRuns`, the rest of Task 2's exports; `FAKE`, `FAKE_GROUPED` (Task 1).
- Produces: `tests/unit/real-number-guard.spec.ts` with a constant `EXTRA_ALLOWED: readonly string[] = []` that S08 fills with the manual ad slot id; after this task no file in the guard scope contains a disallowed run.

**Rule → assertion map (spec §14 item 1).** No assertion changes its matcher or expected value; only the digits that identify a shipment change.

| File | Tests touched | Business rule the test locks | What changes |
|---|---|---|---|
| `tests/tracking.spec.ts` | normalizer estimate; "tracking result leads with delivery date…"; "an overdue customs estimate…"; "pickup status…"; "home uses customer language…"; "user can choose a representative domestic carrier…"; the four state tests through `createTrackData`/`submitTracking` | 결과 요약 순서, 오래된 예상일 재계산, 픽업 문구, 고객 언어, 택배사 선택과 공식 링크, 오류 → 문의 우선, 도착 전 → 문의 + 구매처, 배송 중 → 쇼핑 링크 주 흐름 밖, 완료 → 스토어 선두 | 12-digit literals → `FAKE.domestic` (the typed value, the mocked data and the expected request body stay equal to each other) |
| `tests/privacy.spec.ts` | "a stale shipment shows a verification prompt…" | 오래된 이력은 예상일 대신 확인 안내 | data number and deep-link path → `FAKE.domestic` |
| `tests/customs-estimate.spec.ts` | all 6 | 통관 예상일 계산·정체 판정 | `trackingNumber` → `FAKE.domestic` |
| `tests/delivery-carriers.spec.ts` | 10 of 14 | 택배사 파싱, 자동 조회 판정, 캐시 키 분리 | numbers → `FAKE.domestic` (12 digits, so the automatic lookup still asks CJ, HANJIN and LOTTE; the delivery service keeps no state between calls) |
| `tests/track-api.spec.ts` | 4 of 6 | 택배사 장애 시 선택 유지·공식 링크, 일시 실패 미캐시, 415 | three HANJIN requests → `FAKE.domestic`, `FAKE.domesticAlt`, `FAKE.domestic14` (distinct, like before, so the route cache cannot couple them); text body → `FAKE.domestic` |
| `tests/internal-cs-helper.spec.ts` | all 3 | CS 안내문, 도착 전 미저장, 불일치 초안 저장 | invoice → `FAKE.domestic`, phone → `FAKE.phone` |

- [ ] **Step 1: Write the repository scan (failing test)**

Replace the whole content of `tests/unit/real-number-guard.spec.ts` with:

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  DIGIT_RUN_PATTERN,
  HBL_LIKE_PATTERN,
  containsTrackingLikeValue,
  decodeRepeatedly,
  findDisallowedDigitRuns,
  isAllowedDigitRun
} from "@/lib/privacy/number-patterns";
import { ADSENSE_CLIENT_ID, ADSENSE_LOADER_URL, ADSENSE_PUBLISHER_DIGITS } from "@/lib/site";
import { FAKE, FAKE_GROUPED } from "../fixtures/tracking-fixtures";

// Non-fixture values are assembled at runtime so that this file never contains a disallowed run itself.
const NINES_12 = "9".repeat(12);
const NINES_GROUPED = ["9999", "9999", "9999"].join(" ");
const REAL_LOOKING_MOBILE = ["010", "9876", "5432"].join("-");
const DATE_HOUR_DIGITS = ["2026", "0926", "14"].join("");
const IMPOSSIBLE_TIMESTAMP = ["2026", "1399", "250000"].join("");
const FORMAT_HINT =
  "숫자 10~14자리 (예: 0000 0000 0000) · 영문 3~4자로 시작하는 HBL (예: ABCD 0000 0000) · 공백·하이픈은 자동으로 빼요";

const matchesOf = (pattern: RegExp, text: string): string[] =>
  Array.from(text.matchAll(new RegExp(pattern.source, "g")), (match) => match[0]);

test.describe("number patterns (contract §11.4)", () => {
  test("DIGIT_RUN_PATTERN takes 10+ digits joined by single spaces or hyphens", () => {
    expect(DIGIT_RUN_PATTERN.flags).toContain("g");
    expect(matchesOf(DIGIT_RUN_PATTERN, `a ${FAKE_GROUPED.domestic} b`)).toEqual([FAKE_GROUPED.domestic]);
    expect(matchesOf(DIGIT_RUN_PATTERN, "0000-1234-5678")).toEqual(["0000-1234-5678"]);
    expect(matchesOf(DIGIT_RUN_PATTERN, "000 000 000")).toEqual([]);
    expect(matchesOf(DIGIT_RUN_PATTERN, "0000  1234  5678")).toEqual([]);
  });

  test("HBL_LIKE_PATTERN takes 3–4 letters plus 8–16 digits, not inside a longer run", () => {
    expect(HBL_LIKE_PATTERN.flags).toContain("g");
    expect(matchesOf(HBL_LIKE_PATTERN, `q=${FAKE.hbl}&x=1`)).toEqual([FAKE.hbl]);
    expect(matchesOf(HBL_LIKE_PATTERN, FAKE.hbl.toLowerCase())).toEqual([FAKE.hbl.toLowerCase()]);
    expect(matchesOf(HBL_LIKE_PATTERN, `X${FAKE.hbl}`)).toEqual([]);
    expect(matchesOf(HBL_LIKE_PATTERN, `${FAKE.hbl}X`)).toEqual([]);
    expect(matchesOf(HBL_LIKE_PATTERN, "TEST0000000")).toEqual([]);
    expect(matchesOf(HBL_LIKE_PATTERN, FAKE_GROUPED.hblAlt)).toEqual([]);
  });

  test("the repository allowlist keeps fixtures, the AdSense id, timestamps and the fake mobile", () => {
    for (const value of Object.values(FAKE)) expect(findDisallowedDigitRuns(value), value).toEqual([]);
    expect(isAllowedDigitRun(ADSENSE_PUBLISHER_DIGITS)).toBe(true);
    expect(findDisallowedDigitRuns(ADSENSE_CLIENT_ID)).toEqual([]);
    expect(isAllowedDigitRun("20260926140500")).toBe(true);
    expect(isAllowedDigitRun(IMPOSSIBLE_TIMESTAMP)).toBe(false);
    expect(isAllowedDigitRun(FAKE.phone)).toBe(true);
    expect(isAllowedDigitRun(REAL_LOOKING_MOBILE)).toBe(false);
    expect(isAllowedDigitRun(NINES_12)).toBe(false);
    expect(isAllowedDigitRun(NINES_12, [NINES_12])).toBe(true);
  });

  test("findDisallowedDigitRuns returns the raw runs in document order", () => {
    expect(findDisallowedDigitRuns(`a ${NINES_GROUPED} b ${FAKE.domestic} c ${NINES_12}`)).toEqual([NINES_GROUPED, NINES_12]);
  });

  test("a date followed by an hour is not a tracking number; the same digits without separators are", () => {
    expect(findDisallowedDigitRuns("최종 업데이트: 2026-09-26 14:05")).toEqual([]);
    expect(findDisallowedDigitRuns(`최종 업데이트: ${DATE_HOUR_DIGITS}`)).toEqual([DATE_HOUR_DIGITS]);
  });

  test("containsTrackingLikeValue is strict: fixtures count, placeholders and the AdSense id do not", () => {
    expect(containsTrackingLikeValue(FORMAT_HINT)).toBe(false);
    expect(containsTrackingLikeValue(ADSENSE_LOADER_URL)).toBe(false);
    expect(containsTrackingLikeValue(`https://example.com/?u=${FAKE.domestic}`)).toBe(true);
    expect(containsTrackingLikeValue(`/p/${encodeURIComponent(encodeURIComponent(FAKE_GROUPED.domestic))}`)).toBe(true);
    expect(containsTrackingLikeValue(`q=${FAKE_GROUPED.domestic.replace(/ /g, "+")}`)).toBe(true);
    expect(containsTrackingLikeValue(`ref=%2F${FAKE.hbl}`)).toBe(true);
    expect(containsTrackingLikeValue(`title=${FAKE.hbl.toLowerCase()}`)).toBe(true);
    expect(containsTrackingLikeValue("dt=12&ms=345")).toBe(false);
  });

  test("decodeRepeatedly peels nested encoding and survives malformed escapes", () => {
    expect(decodeRepeatedly(encodeURIComponent(encodeURIComponent("a b")))).toBe("a b");
    expect(decodeRepeatedly(`%E0%A4%A ${encodeURIComponent(FAKE_GROUPED.domestic)}`)).toBe(
      `%E0%A4%A ${FAKE_GROUPED.domestic}`
    );
  });
});

// ---- Repository scan (spec §14 item 5, roadmap §11.4 scope) ----
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SCAN_DIRS = ["app", "components", "lib", "config", "tests", "docs", "design-system", "insforge"] as const;
const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".css", ".html", ".md", ".json"]);
const SKIPPED_DIRS = new Set(["node_modules", ".next", "test-results", "playwright-report", "test-artifacts"]);
const SKIPPED_FILES = new Set(["package-lock.json"]);
/** S08 adds the manual ad slot id from config/site.config.ts (roadmap §10.4). */
const EXTRA_ALLOWED: readonly string[] = [];

const toRepoPath = (file: string): string => path.relative(REPO_ROOT, file).split(path.sep).join("/");

function listTextFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : listTextFiles(full);
    const isText = entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name)) && !SKIPPED_FILES.has(entry.name);
    return isText ? [full] : [];
  });
}

function guardTargets(): string[] {
  const scanned = SCAN_DIRS.map((dir) => path.join(REPO_ROOT, dir))
    .filter((dir) => existsSync(dir))
    .flatMap(listTextFiles);
  const rootMarkdown = readdirSync(REPO_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(REPO_ROOT, entry.name));
  return [...scanned, ...rootMarkdown];
}

/** 'file:line:column (N digits)' for every disallowed run — never the digits themselves (CI logs are public). */
function findingsIn(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const disallowed = new Set(findDisallowedDigitRuns(text, EXTRA_ALLOWED));
  if (disallowed.size === 0) return [];
  return Array.from(text.matchAll(new RegExp(DIGIT_RUN_PATTERN.source, "g")))
    .filter((match) => disallowed.has(match[0]))
    .map((match) => {
      const before = text.slice(0, match.index ?? 0).split("\n");
      const column = (before.at(-1)?.length ?? 0) + 1;
      return `${toRepoPath(file)}:${before.length}:${column} (${match[0].replace(/[ -]/g, "").length} digits)`;
    });
}

test.describe("repository scan (spec §14 item 5)", () => {
  test("the scan covers code, tests, docs and design files", () => {
    const targets = guardTargets().map(toRepoPath);
    for (const expected of [
      "app/layout.tsx",
      "lib/site.ts",
      "tests/unit/real-number-guard.spec.ts",
      "docs/superpowers/specs/2026-09-26-tracking-renewal-ia-design.md",
      "design-system/README.md",
      "README.md"
    ]) {
      expect(targets, expected).toContain(expected);
    }
    expect(targets.some((file) => file.includes("node_modules/"))).toBe(false);
  });

  test("no file contains a tracking-number-like digit run outside the allowlist", () => {
    const findings = guardTargets().flatMap(findingsIn);
    expect(findings, "Replace each run with a value from tests/fixtures/tracking-fixtures.ts (roadmap §11.4)").toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `8 passed, 1 failed`. The failing test "no file contains a tracking-number-like digit run outside the allowlist" lists 70 entries of the form `path:line:column (N digits)` in exactly these 12 files: `components/InternalCsHelper.tsx` (1), `design-system/components/tracking-form.html` (4), `docs/archive/2026-05/cs-ai-shipping-status-automation/cs-ai-shipping-status-automation.design.md` (3), `…/cs-ai-shipping-status-automation.do.md` (5), `docs/insforge-deployment-runbook.md` (3), `Plan.md` (4), `tests/customs-estimate.spec.ts` (6), `tests/delivery-carriers.spec.ts` (12), `tests/internal-cs-helper.spec.ts` (11), `tests/privacy.spec.ts` (3), `tests/track-api.spec.ts` (5), `tests/tracking.spec.ts` (13). No digits are printed. If a file under `docs/superpowers/plans/` also appears (another stage plan written after this one), fix its runs in Step 9 the same way and name it in the stage summary.

- [ ] **Step 3: Create the one-off replacement helper**

Create `test-artifacts/tools/replace-literals.cjs` (ignored by git since Task 1; deleted in Step 10):

```js
// One-off S01 helper (Task 4). Replaces 12-digit literals with fixture values, then gets deleted.
const fs = require("node:fs");

const MODES = {
  // A "<12 digits>" string literal in a spec becomes the FAKE.domestic identifier.
  tests: { pattern: /"\d{12}"/g, replacement: "FAKE.domestic" },
  // A bare 12-digit run in a document becomes the fixture digits.
  docs: { pattern: /(?<!\d)\d{12}(?!\d)/g, replacement: "000012345678" }
};

const [mode, ...files] = process.argv.slice(2);
const rule = MODES[mode];
if (!rule || files.length === 0) {
  console.error("usage: node replace-literals.cjs tests|docs <file> [file ...]");
  process.exit(1);
}
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  let count = 0;
  const next = text.replace(rule.pattern, (match) => {
    if (match.replace(/\D/g, "").startsWith("0000")) return match; // already a fixture
    count += 1;
    return rule.replacement;
  });
  fs.writeFileSync(file, next);
  console.log(`${file}: ${count}`);
}
```

- [ ] **Step 4: Replace the quoted literals in five spec files**

Run: `node test-artifacts/tools/replace-literals.cjs tests tests/tracking.spec.ts tests/privacy.spec.ts tests/customs-estimate.spec.ts tests/delivery-carriers.spec.ts tests/internal-cs-helper.spec.ts`
Expected output (one line per file): `tests/tracking.spec.ts: 12`, `tests/privacy.spec.ts: 2`, `tests/customs-estimate.spec.ts: 6`, `tests/delivery-carriers.spec.ts: 12`, `tests/internal-cs-helper.spec.ts: 7`. (After a released hotfix the counts can be lower; any count is fine as long as Step 8 ends clean.)

- [ ] **Step 5: Add the fixture import and fix the literals the helper cannot see**

Use the Edit tool for each change.

1. Imports — add one line to each file:
   - `tests/tracking.spec.ts`: after `import type { StatusCode, TrackResponseData } from "@/lib/types";` add `import { FAKE } from "./fixtures/tracking-fixtures";`
   - `tests/privacy.spec.ts`: after `import { expect, test } from "@playwright/test";` add `import { FAKE } from "./fixtures/tracking-fixtures";`
   - `tests/customs-estimate.spec.ts`: after `import { normalizeTrackingData } from "@/lib/services/normalizer";` add `import { FAKE } from "./fixtures/tracking-fixtures";`
   - `tests/delivery-carriers.spec.ts`: after `import { fetchDeliveryTracking } from "@/lib/services/delivery";` add `import { FAKE } from "./fixtures/tracking-fixtures";`
   - `tests/internal-cs-helper.spec.ts`: after `import { INTERNAL_TEST_CREDENTIALS } from "./internal-auth";` add `import { FAKE } from "./fixtures/tracking-fixtures";`
   - `tests/track-api.spec.ts`: after `import { ApiTrackResponseSchema } from "@/lib/schemas";` add `import { FAKE } from "./fixtures/tracking-fixtures";`
2. `tests/tracking.spec.ts`, test "user can choose a representative domestic carrier before tracking": the `trackingUrl:` value is a string that ends with `wblnumText2=` followed by a 12-digit number. Replace that whole string line with:
   ```ts
               `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=${FAKE.domestic}`
   ```
3. `tests/privacy.spec.ts` line 38 (was 37 before the import): replace the `await page.goto("/…");` line (a slash plus 12 digits) with:
   ```ts
     await page.goto(`/${FAKE.domestic}`);
   ```
4. `tests/internal-cs-helper.spec.ts`:
   - the `toContainText("현재 CJ대한통운 운송장번호 …는 배송중 단계로 확인됩니다.")` line becomes:
     ```ts
       await expect(page.getByLabel("고객 안내문")).toContainText(`현재 CJ대한통운 운송장번호 ${FAKE.domestic}는 배송중 단계로 확인됩니다.`);
     ```
   - in the test "internal helper stores customs mismatch drafts locally", the three phone literals (`.fill("010-…")` and the two `page.getByText("010-…")`) become `FAKE.phone`:
     ```ts
       await page.getByLabel("휴대폰 번호").fill(FAKE.phone);
     ```
     ```ts
       await expect(page.getByText(FAKE.phone)).toBeVisible();
     ```
     (the last line appears twice: before and after `page.reload()`).

- [ ] **Step 6: Replace the numbers in `tests/track-api.spec.ts`**

Use the Edit tool on these lines (line numbers before the Step 5 import; add 1 after it):
- line 16 → `        body: JSON.stringify({ trackingNumber: FAKE.domestic, carrierCode: "HANJIN" })`
- line 27 → `      invoiceNumber: FAKE.domestic,`
- line 48 → `        body: JSON.stringify({ trackingNumber: FAKE.domesticAlt, carrierCode: "HANJIN" })`
- line 81 → `        body: JSON.stringify({ trackingNumber: FAKE.domestic14, carrierCode: "HANJIN" })`
- line 111 → `      body: FAKE.domestic`

- [ ] **Step 7: Run the six specs**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/tracking.spec.ts tests/privacy.spec.ts tests/customs-estimate.spec.ts tests/delivery-carriers.spec.ts tests/internal-cs-helper.spec.ts tests/track-api.spec.ts`
Expected: `47 passed` (16 + 2 + 6 + 14 + 3 + 6), 0 failed.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: still `1 failed`, now listing only `components/InternalCsHelper.tsx`, `design-system/components/tracking-form.html`, the two archive docs, `docs/insforge-deployment-runbook.md` and `Plan.md` (20 entries).

- [ ] **Step 8: Replace the CS helper placeholder**

In `components/InternalCsHelper.tsx` line 214, replace the `placeholder="예: …"` attribute (a 12-digit example) with:

```tsx
                    placeholder="예: 0000 1234 5678"
```

- [ ] **Step 9: Replace the numbers in docs and the design card**

Run: `node test-artifacts/tools/replace-literals.cjs docs Plan.md docs/archive/2026-05/cs-ai-shipping-status-automation/cs-ai-shipping-status-automation.design.md docs/archive/2026-05/cs-ai-shipping-status-automation/cs-ai-shipping-status-automation.do.md`
Expected: `Plan.md: 1`, `…design.md: 3`, `…do.md: 4`.

Then with the Edit tool:
1. `Plan.md` line 488 (a sample HBL: `ABCD` followed by the ten digits one through nine and zero) → `  "trackingNumber": "ABCD00000000"`; line 510 (same sample) → `    "trackingNumber": "ABCD00000000",`; line 528 (the same ten digits as an invoice) → `      "invoiceNumber": "0000123456",`. The `2026-02-14 09:30`-style lines in the diagram near line 289 stay: the guard reads them as dates.
2. `docs/archive/2026-05/cs-ai-shipping-status-automation/cs-ai-shipping-status-automation.do.md` line 299 → ``- enter phone `010-0000-1234`.``
3. `docs/insforge-deployment-runbook.md` lines 57–59 (inside the `text` code block after `POST https://tracking-tipoasis.vercel.app/api/track`) become:
   ```text
   000012345678 -> HTTP 200, currentStatus=반출신고, customsEvents=10
   000000000001 -> HTTP 200, currentStatus=통관목록접수, customsEvents=7
   0000123456 -> HTTP 200, currentStatus=반출신고, customsEvents=11
   ```
   and add this line directly after the closing fence of that code block, followed by a blank line:
   `The numbers above are fake placeholders; the original check used real shipments, which must not be written into this repository (spec §4).`
4. Replace the whole content of `design-system/components/tracking-form.html` with (the example chips and their `.chip` rule are gone; the help line is the format hint):

```html
<!-- @dsCard group="Components" name="Tracking form" subtitle="Carrier select, number input, submit, format hint" -->
<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>Tracking form</title><link rel="stylesheet" href="../_base.css">
<style>
.lum{background:#f8fafc;color:#020617;border-radius:22px;padding:28px;max-width:560px;box-shadow:0 25px 50px -12px rgba(0,0,0,.5)}
label{display:block;font-size:14px;font-weight:600;color:#1e293b}
.field{margin-top:8px;height:56px;width:100%;border-radius:12px;border:1px solid #cbd5e1;background:#f8fafc;padding:0 16px;font:inherit;font-size:14px;font-weight:700;color:#1e293b}
.input{border-color:#22d3ee;background:#fff;font-size:16px;font-weight:600}
.help{font-size:12px;color:#475569;margin-top:8px}
.cue{display:inline-flex;gap:8px;align-items:center;margin-top:8px;padding:8px 12px;border-radius:999px;border:1px solid #67e8f9;background:#ecfeff;color:#155e75;font-size:14px;font-weight:900}
.btn{min-height:56px;padding:0 20px;border-radius:12px;border:0;background:linear-gradient(90deg,#6ee7b7,#5eead4,#67e8f9);font:inherit;font-weight:700;color:#020617}
</style></head>
<body><p class="kicker">Components</p><h1 class="title" style="font-size:24px;margin-top:8px">조회 폼</h1>
<p class="copy" style="max-width:640px;margin-top:8px">보이는 라벨과 접근 가능한 이름을 일치시킨다. 오류는 폼 아래 assertive live region으로 안내한다. 현재 구현은 택배사 선택이 입력 위에 있다.</p>
<div class="lum" style="margin-top:24px">
<label>국내 택배사</label><select class="field"><option>자동으로 찾기</option><option>CJ대한통운</option><option>우체국택배</option><option>한진택배</option><option>롯데택배</option><option>로젠택배</option></select><p class="help">택배사를 모르시면 자동으로 찾기를 선택하세요.</p>
<div style="margin-top:20px"><label>조회번호 (HBL 또는 운송장)</label><div class="cue">운송장 번호는 바로 아래 칸에 넣어 주세요!</div>
<div class="row" style="margin-top:12px;flex-wrap:nowrap"><input class="field input" placeholder="여기에 운송장 / HBL 번호를 입력하세요" style="margin:0"><button class="btn">조회하기 →</button></div></div>
<p class="help">숫자 10~14자리 (예: 0000 0000 0000) · 영문 3~4자로 시작하는 HBL (예: ABCD 0000 0000) · 공백·하이픈은 자동으로 빼요</p>
</div></body></html>
```

5. If Step 2 listed files under `docs/superpowers/plans/`, replace each reported run there with a `0000…` value of the same length (Edit tool), keeping the sentence meaning.

- [ ] **Step 10: Delete the helper and run the guard to verify it passes**

Run: `Remove-Item test-artifacts/tools/replace-literals.cjs`
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `9 passed`.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.
Run: `npx playwright test tests/internal-cs-helper.spec.ts` (port 43210 free)
Expected: `3 passed` (the placeholder change is visual only).

- [ ] **Step 11: Commit**

Run: `git add tests/unit/real-number-guard.spec.ts tests/tracking.spec.ts tests/privacy.spec.ts tests/customs-estimate.spec.ts tests/delivery-carriers.spec.ts tests/internal-cs-helper.spec.ts tests/track-api.spec.ts components/InternalCsHelper.tsx Plan.md docs/archive docs/insforge-deployment-runbook.md design-system/components/tracking-form.html; git commit -m "fix: replace real tracking numbers with fixtures and guard the repository"`
(Add any `docs/superpowers/plans/…` file fixed in Step 9.5.) Then `git status --short` → no output.

---

### Task 5: Font preload budget (IBM Plex Sans KR `preload: false`, 400/700, no Space Grotesk)

**Files:**
- Modify: `app/layout.tsx:3` (font import), `app/layout.tsx:6-16` (font declarations), `app/layout.tsx:42` (`<body>` class)
- Modify: `app/globals.css:52` (heading `font-family`)
- Test: `tests/budgets/font-preload.spec.ts`

**Interfaces:**
- Consumes: `IS_PRODUCTION_RUN`, `FAKE` (Task 1).
- Produces: `app/layout.tsx` font part in the exact shape S05 edits (`import { IBM_Plex_Sans_KR } from "next/font/google";`, `const bodyFont = IBM_Plex_Sans_KR({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-body", preload: false });`, ``<body className={`${bodyFont.variable} google-anno-skip antialiased`}>``); `tests/budgets/font-preload.spec.ts` whose imports S05 extends (`expect`, `test`, `IS_PRODUCTION_RUN`, `FAKE`) and to which S05 appends one `describe` block. Its helpers are named `MAX_FONT_PRELOADS`, `tagFontUrls`, `linkHeaderFontUrls`, `rscFontHintUrls` (S05 must not reuse these names).

- [ ] **Step 1: Write the failing budget test**

Create `tests/budgets/font-preload.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { IS_PRODUCTION_RUN } from "../support/prod-mode";
import { FAKE } from "../fixtures/tracking-fixtures";

/** Spec §12: at most 2 preloaded font files. Phase 1 (PERF-01) measured 281 on production. */
const MAX_FONT_PRELOADS = 2;
/** React flight-data preload hints inside the HTML, e.g. :HL[\"/_next/static/media/x.woff2\",\"font\",…]. */
const RSC_FONT_HINT = /:HL\[\\?"([^"\\]+?\.woff2)\\?",\\?"font/g;

function tagFontUrls(html: string): string[] {
  return Array.from(html.matchAll(/<link\b[^>]*>/g), (match) => match[0])
    .filter((tag) => /\brel="preload"/.test(tag) && /\bas="font"/.test(tag))
    .map((tag) => /\bhref="([^"]+)"/.exec(tag)?.[1] ?? tag);
}

function linkHeaderFontUrls(header: string | undefined): string[] {
  if (!header) return [];
  return header
    .split(/,\s*(?=<)/)
    .filter((entry) => /rel="?preload"?/i.test(entry) && /as="?font"?/i.test(entry))
    .map((entry) => entry.slice(entry.indexOf("<") + 1, entry.indexOf(">")));
}

function rscFontHintUrls(html: string): string[] {
  return Array.from(html.matchAll(RSC_FONT_HINT), (match) => match[1] ?? "");
}

test.describe("font preload budget (S01)", () => {
  test.skip(!IS_PRODUCTION_RUN, "budgets run against next start");

  for (const route of [
    { name: "home", path: "/" },
    { name: "deep link", path: `/${FAKE.domestic}` }
  ] as const) {
    test(`${route.name}: at most ${MAX_FONT_PRELOADS} font files are preloaded`, async ({ request }) => {
      const response = await request.get(route.path);
      expect(response.status()).toBe(200);
      const html = await response.text();
      const tags = tagFontUrls(html);
      const header = linkHeaderFontUrls(response.headers()["link"]);
      const hints = rscFontHintUrls(html);
      const unique = new Set([...tags, ...header, ...hints]);
      // Printed so the stage gate (G8) can record the measured budget.
      console.info(
        `[font-preload] ${route.name}: ${unique.size} files (tags ${tags.length}, Link header ${header.length}, RSC hints ${hints.length})`
      );
      expect(unique.size).toBeLessThanOrEqual(MAX_FONT_PRELOADS);
    });
  }
});
```

- [ ] **Step 2: Run it against the current production build to verify it fails**

Run: `npm run build`
Expected: exit 0.
Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test tests/budgets/font-preload.spec.ts`
Expected: `2 failed` — `expect(received).toBeLessThanOrEqual(expected)`, `Expected: <= 2`, `Received: 281` (the same helpers applied to the Phase 1 capture of production HTML find 233 `<link rel=preload as=font>` tags, 48 `Link` header entries and 281 RSC hints — 281 distinct files). The `[font-preload]` lines show that split.
Stop the server: `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`; clear the flags: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.

- [ ] **Step 3: Change the fonts**

In `app/layout.tsx` (Edit tool):
1. Line 3 `import { IBM_Plex_Sans_KR, Space_Grotesk } from "next/font/google";` → `import { IBM_Plex_Sans_KR } from "next/font/google";`
2. Lines 6–16 (the `bodyFont` and `displayFont` declarations) → exactly:

```ts
const bodyFont = IBM_Plex_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-body",
  preload: false
});
```

3. Line 42 ``<body className={`${bodyFont.variable} ${displayFont.variable} google-anno-skip antialiased`}>`` → ``<body className={`${bodyFont.variable} google-anno-skip antialiased`}>``

In `app/globals.css`, replace line 52 `  font-family: var(--font-display), var(--font-body), sans-serif;` (inside the `h1, h2, h3, h4` rule) with:

```css
  /* Space Grotesk was dropped in R0 (PERF-01); headings fall back to the body font. */
  font-family: var(--font-display, var(--font-body)), sans-serif;
```

Use the Grep tool with pattern `Space_Grotesk|displayFont` over `app/` and `components/`. Expected: no matches.

- [ ] **Step 4: Rebuild and run the budget to verify it passes**

Run: `npm run build`
Expected: exit 0.
Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait for `200` as in Step 2.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test tests/budgets/font-preload.spec.ts`
Expected: `2 passed`; both `[font-preload]` lines print `0 files (tags 0, Link header 0, RSC hints 0)`. Record them for G8.
Stop the server and clear the flags (Step 2 commands).

- [ ] **Step 5: Check the current screens still pass in dev mode**

Run (port 43210 free): `npx playwright test tests/tracking.spec.ts tests/privacy.spec.ts tests/budgets/font-preload.spec.ts`
Expected: `18 passed, 2 skipped` (the budget skips outside production).
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

Run: `git add app/layout.tsx app/globals.css tests/budgets/font-preload.spec.ts; git commit -m "perf: stop preloading Korean font slices and drop Space Grotesk"`

---

### Task 6: First paint without SSR `opacity:0`

**Files:**
- Modify: `components/HomePageClient.tsx:97`
- Test: `tests/budgets/first-paint.spec.ts`

**Interfaces:**
- Consumes: `IS_PRODUCTION_RUN`, `FAKE` (Task 1).
- Produces: the budget "no inline `opacity:0` in the SSR HTML of `/` and `/{번호}`" that every later stage keeps green (S06's server shell must not reintroduce it).

- [ ] **Step 1: Write the failing budget test**

Create `tests/budgets/first-paint.spec.ts`:

```ts
import { expect, test, type Locator } from "@playwright/test";
import { IS_PRODUCTION_RUN } from "../support/prod-mode";
import { FAKE } from "../fixtures/tracking-fixtures";

/** Spec §12 "SSR opacity:0은 금지": an inline style that hides content until JavaScript runs. */
const SSR_HIDDEN_STYLE = /style="[^"]*\bopacity:\s*0(?![.\d])/;

async function effectiveOpacity(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    let opacity = 1;
    for (let node: Element | null = element; node; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity);
    }
    return opacity;
  });
}

test.describe("first paint (S01)", () => {
  test.skip(!IS_PRODUCTION_RUN, "budgets run against next start");

  for (const route of [
    { name: "home", path: "/" },
    { name: "deep link", path: `/${FAKE.domestic}` }
  ] as const) {
    test(`${route.name}: the server HTML hides nothing with an inline opacity:0`, async ({ request }) => {
      const response = await request.get(route.path);
      expect(response.status()).toBe(200);
      expect(await response.text()).not.toMatch(SSR_HIDDEN_STYLE);
    });
  }

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("home: the heading and the lookup input are painted from the server HTML", async ({ page }) => {
      await page.goto("/");
      const heading = page.getByRole("heading", { level: 1, name: "통관부터 국내 배송까지 한 번에 확인" });
      const input = page.getByRole("textbox", { name: "조회번호 (HBL 또는 운송장)", exact: true });
      await expect(heading).toBeVisible();
      await expect(input).toBeVisible();
      expect(await effectiveOpacity(heading)).toBe(1);
      expect(await effectiveOpacity(input)).toBe(1);
    });
  });
});
```

- [ ] **Step 2: Run it against the current production build to verify it fails**

The build from Task 5 Step 4 is current. Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test tests/budgets/first-paint.spec.ts`
Expected: `3 failed` — the two HTML tests with `Expected pattern: not /style="[^"]*\bopacity:\s*0(?![.\d])/` (framer-motion's `style="opacity:0;transform:translateY(10px)"` on the hero), and the no-JS test with `Expected: 1`, `Received: 0` for the heading's effective opacity.
Stop the server: `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`; clear the flags: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.

- [ ] **Step 3: Paint the hero without an enter animation**

In `components/HomePageClient.tsx`, replace line 97 `            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}` with:

```tsx
            // No enter animation for the lookup hero: the server HTML must paint it (spec §12, PERF-02).
            initial={false}
```

(`prefersReducedMotion` stays: `handleSuccess` and the result section still use it.)

- [ ] **Step 4: Rebuild and run the budget to verify it passes**

Run: `npm run build`
Expected: exit 0.
Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait for `200`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test tests/budgets/first-paint.spec.ts tests/budgets/font-preload.spec.ts`
Expected: `5 passed`.
Stop the server and clear the flags (Step 2 commands).

- [ ] **Step 5: Check the motion tests in dev mode**

Run (port 43210 free): `npx playwright test tests/tracking.spec.ts`
Expected: `16 passed` (the finite-motion and layout tests look at CSS animations, which did not change).
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

Run: `git add components/HomePageClient.tsx tests/budgets/first-paint.spec.ts; git commit -m "perf: render the lookup hero visible in the server HTML"`

---

### Task 7: Route groups — AdSense only in `(public)`, `(internal)` is noindex

**Files:**
- Move (`git mv`, contents unchanged): `app/page.tsx` → `app/(public)/page.tsx`; `app/[trackingNumber]/page.tsx` → `app/(public)/[trackingNumber]/page.tsx`; `app/privacy/page.tsx` → `app/(public)/privacy/page.tsx`; `app/internal/cs-helper/page.tsx` → `app/(internal)/internal/cs-helper/page.tsx`
- Create: `app/(public)/layout.tsx`, `app/(internal)/layout.tsx`
- Modify: `app/layout.tsx` (full rewrite: AdSense `<Script>` and the `next/script` import removed)
- Test: `tests/e2e/internal-isolation.spec.ts`

**Interfaces:**
- Consumes: `ADSENSE_LOADER_URL` (Task 2), `INTERNAL_TEST_CREDENTIALS` (`tests/internal-auth.ts`), the Task 5 font declaration in `app/layout.tsx`.
- Produces: `app/(public)/layout.tsx` (S02 replaces its `<Script>` with `<AdLoader/>`; S06/S08/S11 add chrome), `app/(internal)/layout.tsx` (metadata `robots: { index: false, follow: false }`, `referrer: "no-referrer"`), and the final S01 `app/layout.tsx` that S03 and S05 edit.

- [ ] **Step 1: Write the failing isolation test**

Create `tests/e2e/internal-isolation.spec.ts`:

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const AD_SCRIPT = 'script[src*="adsbygoogle.js"]';
/** Ad and analytics hosts. Every request to them is recorded and aborted, so tests never reach the network. */
const AD_REQUEST =
  /^https:\/\/([a-z0-9-]+\.)*(googlesyndication\.com|doubleclick\.net|adtrafficquality\.google|google-analytics\.com|googletagmanager\.com)\//;
const AD_SOURCE_MARKERS = /adsbygoogle|ADSENSE_|AdLoader|pagead2/;

async function recordAdRequests(page: Page): Promise<string[]> {
  const hosts: string[] = [];
  await page.route(AD_REQUEST, async (route) => {
    hosts.push(new URL(route.request().url()).hostname);
    await route.abort();
  });
  return hosts;
}

/** Waits past window.load plus an idle period: the moment next/script's lazyOnload inserts its script. */
async function afterLazyScripts(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestIdleCallback(() => resolve(), { timeout: 2000 });
      })
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 500);
      })
  );
}

function sourceFilesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFilesUnder(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

test("the root layout and the internal route group carry no ad loader", () => {
  const internalDir = path.join(REPO_ROOT, "app", "(internal)");
  expect(existsSync(path.join(internalDir, "layout.tsx")), "app/(internal)/layout.tsx exists").toBe(true);
  for (const file of [path.join(REPO_ROOT, "app", "layout.tsx"), ...sourceFilesUnder(internalDir)]) {
    expect(readFileSync(file, "utf8"), path.relative(REPO_ROOT, file)).not.toMatch(AD_SOURCE_MARKERS);
  }
});

test.describe("internal pages", () => {
  test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

  test("the CS helper loads no ad script, sends no ad request and asks robots not to index it", async ({ page }) => {
    const adHosts = await recordAdRequests(page);
    await page.goto("/internal/cs-helper");
    await afterLazyScripts(page);
    await expect(page.locator(AD_SCRIPT)).toHaveCount(0);
    expect(adHosts).toEqual([]);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  });
});

test("public pages still load the AdSense loader (control)", async ({ page }) => {
  // S02's AdLoader keeps one script with the same src on the home entry; see "Additions to the contract" item 5 for S08.
  await recordAdRequests(page);
  await page.goto("/");
  await expect(page.locator(AD_SCRIPT)).toHaveCount(1);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/internal-isolation.spec.ts`
Expected: `2 failed, 1 passed` — "the root layout and the internal route group carry no ad loader" (`app/(internal)/layout.tsx exists`, expected `true`, received `false`) and "the CS helper loads no ad script…" (`toHaveCount` expected `0`, received `1`); the control passes.

- [ ] **Step 3: Move the pages into route groups**

Run (PowerShell; the .NET calls take the bracket and parenthesis names literally):
```powershell
foreach ($dir in @('app\(public)\[trackingNumber]', 'app\(public)\privacy', 'app\(internal)\internal\cs-helper')) { [System.IO.Directory]::CreateDirectory((Join-Path (Get-Location).Path $dir)) | Out-Null }
git mv app/page.tsx "app/(public)/page.tsx"
git mv "app/[trackingNumber]/page.tsx" "app/(public)/[trackingNumber]/page.tsx"
git mv app/privacy/page.tsx "app/(public)/privacy/page.tsx"
git mv app/internal/cs-helper/page.tsx "app/(internal)/internal/cs-helper/page.tsx"
foreach ($dir in @('app\[trackingNumber]', 'app\privacy', 'app\internal\cs-helper', 'app\internal')) { $full = Join-Path (Get-Location).Path $dir; if ([System.IO.Directory]::Exists($full)) { [System.IO.Directory]::Delete($full) } }
git status --short
```
Expected: four lines starting with `R ` — `app/page.tsx -> app/(public)/page.tsx`, `app/[trackingNumber]/page.tsx -> app/(public)/[trackingNumber]/page.tsx`, `app/privacy/page.tsx -> app/(public)/privacy/page.tsx`, `app/internal/cs-helper/page.tsx -> app/(internal)/internal/cs-helper/page.tsx` — plus `?? tests/e2e/`. `Directory.Delete` only removes empty folders; an exception means something unexpected is left there — inspect it before continuing.

- [ ] **Step 4: Create the two group layouts**

Create `app/(public)/layout.tsx`:

```tsx
import Script from "next/script";
import { ADSENSE_LOADER_URL } from "@/lib/site";

/**
 * Public pages: /, /{번호}, /privacy. The AdSense loader lives only here, so /internal/* never loads it (spec §10).
 * S02 replaces this <Script> with <AdLoader/> (number-route privacy).
 */
export default function PublicLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <>
      <Script async src={ADSENSE_LOADER_URL} crossOrigin="anonymous" strategy="lazyOnload" />
      {children}
    </>
  );
}
```

Create `app/(internal)/layout.tsx`:

```tsx
import type { Metadata } from "next";

/** Internal CS pages: no ads, no analytics, no public chrome; never indexed, no referrer (spec §10). Basic auth stays in proxy.ts. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer"
};

export default function InternalLayout({ children }: { readonly children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 5: Remove AdSense from the root layout**

Replace the whole content of `app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { IBM_Plex_Sans_KR } from "next/font/google";
import "./globals.css";

const bodyFont = IBM_Plex_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-body",
  preload: false
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tracking.tipoasis.com"),
  title: "통관·국내 배송 한 번에 조회",
  description: "HBL 또는 운송장 번호로 통관 단계와 국내 배송 현황을 한 화면에서 확인하세요.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    title: "통관·국내 배송 한 번에 조회",
    description: "구매 고객을 위한 통관·국내 배송 통합 조회"
  },
  twitter: {
    card: "summary",
    title: "통관·국내 배송 한 번에 조회",
    description: "구매 고객을 위한 통관·국내 배송 통합 조회"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${bodyFont.variable} google-anno-skip antialiased`}>
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Next keeps generated route types in `.next/`; remove it so no stale type points at the old paths: `if (Test-Path .next) { Remove-Item -Recurse -Force .next }`
Run (port 43210 free): `npx playwright test tests/e2e/internal-isolation.spec.ts`
Expected: `3 passed`.
Run the whole dev-mode suite: `npx playwright test`
Expected: 0 failed. Passed: 73 (tracking 16, privacy 2, customs-estimate 6, delivery-carriers 14, internal-cs-helper 3, internal-access 4, track-api 6, unit tracking-fixtures 8, site 2, real-number-guard 9, internal-isolation 3); skipped: 40 (stage-screens 35, budgets 5).

- [ ] **Step 7: Build and check the route table**

Run: `npm run build`
Expected: exit 0. The route table lists `ƒ /`, `ƒ /[trackingNumber]`, `○ /privacy`, `○ /internal/cs-helper`, `ƒ /api/track`, `○ /_not-found`, `○ /icon.svg` and `ƒ Proxy (Middleware)` (route groups do not appear in URLs).
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 8: Commit**

Run: `git add -A app tests/e2e/internal-isolation.spec.ts; git status --short` → only the four renames, the two new layouts, `app/layout.tsx` and the new spec are staged.
Run: `git commit -m "refactor: split public and internal route groups so ads stay off /internal"`

---

### Task 8: CS mismatch drafts — v1 payload, zod, 14-day lifetime, [전체 삭제]

**Files:**
- Move + rewrite: `lib/services/cs-mismatch-storage.ts` → `lib/cs/mismatch-storage.ts`
- Modify: `components/InternalCsHelper.tsx:26-34` (import), after line 39 (message constant), `:125-152` (save/delete handlers), `:351-357` (list header)
- Test: `tests/unit/mismatch-storage.spec.ts` (create), `tests/internal-cs-helper.spec.ts` (append two tests, extend imports)

**Interfaces:**
- Consumes: `CustomsMismatchTemplateKey`, `CUSTOMS_MISMATCH_TEMPLATES` (`lib/services/cs-reply-template.ts`, moved by S04); `FAKE`, `FIXTURE_NOW` (Task 1).
- Produces (contract §11.9, §11.14): `MISMATCH_LEGACY_KEY = "tracking-tipoasis:customs-mismatch-records"`, `MISMATCH_TTL_DAYS = 14`, `interface MismatchRecord` (readonly fields), `createRecordId(): string`, `normalizePhone(value: string): string`, `getStoredRecordsSnapshot(): readonly MismatchRecord[]`, `getServerStoredRecordsSnapshot(): readonly MismatchRecord[]`, `subscribeStoredRecords(onChange: () => void): () => void`, `writeStoredRecords(records: readonly MismatchRecord[]): void` (throws when storage refuses), `clearAllStoredRecords(): void`. S01-private: `parseMismatchPayload`, `serializeMismatchPayload`, `ParsedMismatchPayload`. Storage value: `{ "v": 1, "records": MismatchRecord[] }`.

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/mismatch-storage.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import {
  MISMATCH_LEGACY_KEY,
  MISMATCH_TTL_DAYS,
  parseMismatchPayload,
  serializeMismatchPayload,
  type MismatchRecord
} from "@/lib/cs/mismatch-storage";
import { CUSTOMS_MISMATCH_TEMPLATES, type CustomsMismatchTemplateKey } from "@/lib/services/cs-reply-template";
import { FAKE, FIXTURE_NOW } from "../fixtures/tracking-fixtures";

const DAY_MS = 86_400_000;
const NOW = FIXTURE_NOW.getTime();
const isoDaysAgo = (days: number, extraMs = 0): string => new Date(NOW - days * DAY_MS - extraMs).toISOString();
const record = (id: string, createdAt: string, templateKey: CustomsMismatchTemplateKey = "default"): MismatchRecord => ({
  id,
  phone: FAKE.phone,
  content: "통관부호 확인 부탁드립니다.",
  trackingMemo: "ORDER-1",
  templateKey,
  createdAt
});

test("keeps the existing storage key and a 14-day lifetime", () => {
  expect(MISMATCH_LEGACY_KEY).toBe("tracking-tipoasis:customs-mismatch-records");
  expect(MISMATCH_TTL_DAYS).toBe(14);
});

test("nothing stored means an empty list and nothing to rewrite", () => {
  expect(parseMismatchPayload(null, NOW)).toEqual({ records: [], needsRewrite: false });
});

test("a v1 payload round-trips without a rewrite", () => {
  const records = [record("a", isoDaysAgo(1)), { ...record("b", isoDaysAgo(2), "hold"), updatedAt: isoDaysAgo(1) }];
  const raw = serializeMismatchPayload(records);
  expect(JSON.parse(raw)).toEqual({ v: 1, records });
  expect(parseMismatchPayload(raw, NOW)).toEqual({ records, needsRewrite: false });
});

test("the pre-S01 bare array is migrated to the v1 envelope", () => {
  const legacy = [record("a", isoDaysAgo(3))];
  expect(parseMismatchPayload(JSON.stringify(legacy), NOW)).toEqual({ records: legacy, needsRewrite: true });
});

test("drops broken records but keeps valid ones", () => {
  const valid = record("ok", isoDaysAgo(1));
  const raw = JSON.stringify([
    valid,
    { ...valid, id: 7 },
    { id: "no-template", phone: FAKE.phone, content: "x", trackingMemo: "", createdAt: isoDaysAgo(1) },
    { ...valid, id: "bad-template", templateKey: "other" },
    { ...valid, id: "bad-date", createdAt: "어제" },
    "not a record",
    null
  ]);
  expect(parseMismatchPayload(raw, NOW)).toEqual({ records: [valid], needsRewrite: true });
});

test("records older than 14 days are dropped at the boundary", () => {
  const edge = record("edge", isoDaysAgo(MISMATCH_TTL_DAYS));
  const expired = record("expired", isoDaysAgo(MISMATCH_TTL_DAYS, 1));
  const parsed = parseMismatchPayload(serializeMismatchPayload([edge, expired]), NOW);
  expect(parsed.records.map((item) => item.id)).toEqual(["edge"]);
  expect(parsed.needsRewrite).toBe(true);
});

test("garbage, foreign versions and non-objects give an empty list", () => {
  for (const raw of ["not json", '{"v":2,"records":[]}', "null", "42", '{"records":[]}']) {
    expect(parseMismatchPayload(raw, NOW), raw).toEqual({ records: [], needsRewrite: true });
  }
});

test("every template key survives a round trip", () => {
  const keys = Object.keys(CUSTOMS_MISMATCH_TEMPLATES) as CustomsMismatchTemplateKey[];
  const records = keys.map((key, index) => record(`k${index}`, isoDaysAgo(1), key));
  expect(parseMismatchPayload(serializeMismatchPayload(records), NOW).records).toEqual(records);
});
```

- [ ] **Step 2: Write the failing E2E tests**

In `tests/internal-cs-helper.spec.ts`, replace the import line `import { FAKE } from "./fixtures/tracking-fixtures";` (added in Task 4) with:

```ts
import { MISMATCH_LEGACY_KEY } from "@/lib/cs/mismatch-storage";
import { FAKE, FIXTURE_NOW } from "./fixtures/tracking-fixtures";
```

Append to the end of the file:

```ts
test("internal helper keeps mismatch drafts for 14 days and can clear them all", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const fresh = {
    id: "fresh",
    phone: FAKE.phone,
    content: "최근 안내",
    trackingMemo: "ORDER-2",
    templateKey: "default",
    createdAt: "2026-09-20T01:00:00.000Z"
  };
  const expired = { ...fresh, id: "expired", content: "오래된 안내", trackingMemo: "ORDER-OLD", createdAt: "2026-09-01T01:00:00.000Z" };

  await page.goto("/internal/cs-helper");
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [
    MISMATCH_LEGACY_KEY,
    JSON.stringify([fresh, expired])
  ] as const);
  await page.reload();
  await page.getByRole("button", { name: "통관부호 불일치" }).click();

  await expect(page.getByText("ORDER-2", { exact: false })).toBeVisible();
  await expect(page.getByText("ORDER-OLD", { exact: false })).toHaveCount(0);
  await expect(page.getByText("이 브라우저에만 14일 동안 보관하고, 지나면 자동으로 지워요.")).toBeVisible();
  const migrated = await page.evaluate((key) => window.localStorage.getItem(key), MISMATCH_LEGACY_KEY);
  expect(JSON.parse(migrated ?? "null")).toMatchObject({ v: 1, records: [{ id: "fresh" }] });

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "전체 삭제", exact: true }).click();
  await expect(page.getByText("저장된 통관부호 불일치 안내가 없습니다.")).toBeVisible();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), MISMATCH_LEGACY_KEY)).toBeNull();
});

test("internal helper still works when the browser refuses storage", async ({ page }) => {
  // Refuses only this tool's key, like a locked-down browser would; Next.js dev tooling keeps its own storage.
  await page.addInitScript((key) => {
    const refuse = (name: string): void => {
      if (name === key) throw new DOMException("storage is blocked", "SecurityError");
    };
    const { getItem, setItem, removeItem } = Storage.prototype;
    Storage.prototype.getItem = function (this: Storage, name: string): string | null {
      refuse(name);
      return getItem.call(this, name);
    };
    Storage.prototype.setItem = function (this: Storage, name: string, value: string): void {
      refuse(name);
      setItem.call(this, name, value);
    };
    Storage.prototype.removeItem = function (this: Storage, name: string): void {
      refuse(name);
      removeItem.call(this, name);
    };
  }, MISMATCH_LEGACY_KEY);

  await page.goto("/internal/cs-helper");
  await page.getByRole("button", { name: "통관부호 불일치" }).click();
  await expect(page.getByText("저장된 통관부호 불일치 안내가 없습니다.")).toBeVisible();

  await page.getByLabel("휴대폰 번호").fill(FAKE.phone);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("이 브라우저에서는 목록을 저장할 수 없어요. 내용 복사 버튼으로 옮겨 주세요.")).toBeVisible();
});
```

- [ ] **Step 3: Run both to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/mismatch-storage.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading — `Error: Cannot find module '@/lib/cs/mismatch-storage'`.
Run (port 43210 free): `npx playwright test tests/internal-cs-helper.spec.ts`
Expected: FAIL while loading with the same message (the spec now imports the new module).

- [ ] **Step 4: Move and rewrite the storage module**

Run: `[System.IO.Directory]::CreateDirectory((Join-Path (Get-Location).Path 'lib\cs')) | Out-Null; git mv lib/services/cs-mismatch-storage.ts lib/cs/mismatch-storage.ts`
Replace the whole content of `lib/cs/mismatch-storage.ts` with:

```ts
import { z } from "zod";
import type { CustomsMismatchTemplateKey } from "@/lib/services/cs-reply-template";

/** Existing key: drafts saved before S01 are migrated instead of lost (roadmap §11.14). */
export const MISMATCH_LEGACY_KEY = "tracking-tipoasis:customs-mismatch-records";
/** Customer phone numbers stay in this browser at most this long (spec §10; approval-14 fallback). */
export const MISMATCH_TTL_DAYS = 14;

const PAYLOAD_VERSION = 1;
const DAY_MS = 86_400_000;
const TTL_MS = MISMATCH_TTL_DAYS * DAY_MS;

export interface MismatchRecord {
  readonly id: string;
  readonly phone: string;
  readonly content: string;
  readonly trackingMemo: string;
  readonly templateKey: CustomsMismatchTemplateKey;
  readonly createdAt: string;
  readonly updatedAt?: string;
}

export interface ParsedMismatchPayload {
  readonly records: readonly MismatchRecord[];
  /** True when storage holds anything other than exactly serializeMismatchPayload(records): legacy array, broken or expired records, garbage. */
  readonly needsRewrite: boolean;
}

const TEMPLATE_KEYS = ["default", "recipient", "hold"] as const satisfies readonly CustomsMismatchTemplateKey[];

const MismatchRecordSchema = z.object({
  id: z.string().min(1),
  phone: z.string(),
  content: z.string(),
  trackingMemo: z.string(),
  templateKey: z.enum(TEMPLATE_KEYS),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }).optional()
});

const PayloadSchema = z.object({ v: z.literal(PAYLOAD_VERSION), records: z.array(z.unknown()) });

const EMPTY_RECORDS: readonly MismatchRecord[] = [];

export const createRecordId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const normalizePhone = (value: string): string => value.replace(/[^\d-]/g, "").trim();

export function serializeMismatchPayload(records: readonly MismatchRecord[]): string {
  return JSON.stringify({ v: PAYLOAD_VERSION, records });
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null; // unreadable storage is treated as empty and rewritten
  }
}

function candidateRecords(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) return value; // pre-S01 format: a bare array
  const payload = PayloadSchema.safeParse(value);
  return payload.success ? payload.data.records : [];
}

const isFresh = (record: MismatchRecord, now: number): boolean => now - Date.parse(record.createdAt) <= TTL_MS;

export function parseMismatchPayload(raw: string | null, now: number): ParsedMismatchPayload {
  if (raw === null) return { records: EMPTY_RECORDS, needsRewrite: false };
  const records = candidateRecords(parseJson(raw)).flatMap((candidate) => {
    const parsed = MismatchRecordSchema.safeParse(candidate);
    return parsed.success && isFresh(parsed.data, now) ? [parsed.data] : [];
  });
  return { records, needsRewrite: serializeMismatchPayload(records) !== raw };
}

// ---- Browser store for useSyncExternalStore ----
const listeners = new Set<() => void>();
// getSnapshot must return a stable reference, so re-parse only when the stored text changes.
let snapshotRaw: string | null = null;
let snapshotRecords: readonly MismatchRecord[] = EMPTY_RECORDS;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(MISMATCH_LEGACY_KEY);
  } catch {
    return null; // storage refused (private window, policy): behave as "nothing stored"
  }
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function getStoredRecordsSnapshot(): readonly MismatchRecord[] {
  const raw = readRaw();
  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshotRecords = parseMismatchPayload(raw, Date.now()).records;
  }
  return snapshotRecords;
}

export function getServerStoredRecordsSnapshot(): readonly MismatchRecord[] {
  return EMPTY_RECORDS;
}

/** Rewrites storage when it holds a legacy array, broken or expired records. Runs on subscribe, never during render. */
function purgeStoredRecords(): void {
  const { records, needsRewrite } = parseMismatchPayload(readRaw(), Date.now());
  if (!needsRewrite) return;
  try {
    if (records.length === 0) window.localStorage.removeItem(MISMATCH_LEGACY_KEY);
    else window.localStorage.setItem(MISMATCH_LEGACY_KEY, serializeMismatchPayload(records));
  } catch {
    return; // storage became read-only: the snapshot already hides expired records; the next visit retries
  }
  notify();
}

export function subscribeStoredRecords(onChange: () => void): () => void {
  listeners.add(onChange);
  purgeStoredRecords();
  return () => {
    listeners.delete(onChange);
  };
}

/** Throws when the browser refuses storage; the caller shows an error. */
export function writeStoredRecords(records: readonly MismatchRecord[]): void {
  window.localStorage.setItem(MISMATCH_LEGACY_KEY, serializeMismatchPayload(records));
  notify();
}

export function clearAllStoredRecords(): void {
  try {
    window.localStorage.removeItem(MISMATCH_LEGACY_KEY);
  } catch {
    // Storage is refused, so nothing readable is left to clear.
  }
  notify();
}
```

- [ ] **Step 5: Update the CS helper**

In `components/InternalCsHelper.tsx` (Edit tool):

1. Replace the import block on lines 26–34 (`import { createRecordId, … } from "@/lib/services/cs-mismatch-storage";`) with:

```tsx
import {
  MISMATCH_TTL_DAYS,
  clearAllStoredRecords,
  createRecordId,
  getServerStoredRecordsSnapshot,
  getStoredRecordsSnapshot,
  normalizePhone,
  subscribeStoredRecords,
  writeStoredRecords,
  type MismatchRecord
} from "@/lib/cs/mismatch-storage";
```

2. After the line `const CustomsMismatchTemplateKeySchema = z.enum(["default", "recipient", "hold"]);` add:

```tsx
const STORAGE_REFUSED_MESSAGE = "이 브라우저에서는 목록을 저장할 수 없어요. 내용 복사 버튼으로 옮겨 주세요.";
```

3. Replace `handleSaveMismatch` and `handleDeleteRecord` (lines 125–152, from `const handleSaveMismatch = (event: FormEvent<HTMLFormElement>) => {` to the closing `};` of `handleDeleteRecord`) with:

```tsx
  const saveRecords = (next: readonly MismatchRecord[]): boolean => {
    try {
      writeStoredRecords(next);
      return true;
    } catch {
      setError(STORAGE_REFUSED_MESSAGE);
      return false;
    }
  };

  const handleSaveMismatch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const phone = normalizePhone(mismatchPhone);
    const content = mismatchContent.trim();

    if (!phone || !content) {
      setError("휴대폰 번호와 안내 내용을 입력해주세요.");
      return;
    }

    const record: MismatchRecord = {
      id: createRecordId(),
      phone,
      content,
      trackingMemo: trackingMemo.trim(),
      templateKey,
      createdAt: new Date().toISOString()
    };
    if (!saveRecords([record, ...records])) return;
    setMismatchPhone("");
    setTrackingMemo("");
    setError("");
  };

  const handleDeleteRecord = (id: string) => {
    saveRecords(records.filter((record) => record.id !== id));
  };

  const handleClearAll = () => {
    if (!window.confirm("저장된 통관부호 불일치 안내를 모두 삭제할까요?")) return;
    clearAllStoredRecords();
  };
```

4. Replace the list header (lines 351–357, the `<div className="mb-4 flex items-center justify-between gap-2">` block that holds `불일치 안내 목록`, the `{sortedRecords.length}건 저장됨` line and the `MessageSquareText` icon) with:

```tsx
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">불일치 안내 목록</h2>
                <p className="mt-1 text-xs text-slate-400">{sortedRecords.length}건 저장됨</p>
                <p className="mt-1 break-keep text-xs text-slate-400">
                  이 브라우저에만 {MISMATCH_TTL_DAYS}일 동안 보관하고, 지나면 자동으로 지워요.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClearAll}
                  disabled={sortedRecords.length === 0}
                  className="h-9 gap-2 px-3"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  전체 삭제
                </Button>
                <MessageSquareText className="h-5 w-5 text-amber-200" aria-hidden="true" />
              </div>
            </div>
```

Use the Grep tool with pattern `cs-mismatch-storage|CUSTOMS_MISMATCH_STORAGE_KEY` over `app/`, `components/`, `lib/`, `tests/`. Expected: no matches.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/mismatch-storage.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `8 passed`.
Run (port 43210 free): `npx playwright test tests/internal-cs-helper.spec.ts tests/internal-access.spec.ts tests/e2e/internal-isolation.spec.ts`
Expected: `12 passed` (internal-cs-helper 5, internal-access 4, internal-isolation 3).
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 7: Commit**

Run: `git add lib/cs/mismatch-storage.ts lib/services/cs-mismatch-storage.ts components/InternalCsHelper.tsx tests/unit/mismatch-storage.spec.ts tests/internal-cs-helper.spec.ts; git commit -m "fix: expire CS mismatch drafts after 14 days and add clear-all"`

---

### Task 9: Security headers stage 1 via `next.config.ts`

**Files:**
- Create: `lib/security/headers.ts`
- Create: `next.config.ts`; Delete: `next.config.js` (`git rm`)
- Test: `tests/unit/security-headers.spec.ts`, `tests/e2e/security-headers.spec.ts`

**Interfaces:**
- Consumes: `FAKE`, `FAKE_GROUPED`, `IS_PRODUCTION_RUN` (Task 1), `INTERNAL_TEST_CREDENTIALS`; Next's runtime matcher `getPathMatch` (`next/dist/shared/lib/router/utils/path-match`) with `modifyRouteRegex` (`next/dist/lib/redirect-status`), in the unit test only — without the modifier `/:path*` would not match `/`, although Next applies it at runtime.
- Produces (contract §11.5): `interface HeaderRule`, `NUMBER_ROUTE_SOURCE = "/:number((?!privacy$|internal$|api$)[^/.]+)"`, `interface SecurityHeaderOptions { extraScriptHashes?; reportUri? }`, `buildSecurityHeaders(options?: SecurityHeaderOptions): HeaderRule[]`; S01-private `ALL_ROUTES_SOURCE = "/:path*"`, `INTERNAL_ROUTES_SOURCE = "/internal/:path*"`. `next.config.ts` default export `{ output: "standalone", allowedDevOrigins: ["127.0.0.1"], poweredByHeader: false, headers }` — S02 adds `redirects`, S08 passes `extraScriptHashes`, S11 passes `reportUri`. `lib/security/headers.ts` has no imports (`next.config.ts` loads it by relative path; no `@/` alias).

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/security-headers.spec.ts`:

```ts
import { existsSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { modifyRouteRegex } from "next/dist/lib/redirect-status";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import nextConfig from "@/next.config";
import {
  ALL_ROUTES_SOURCE,
  INTERNAL_ROUTES_SOURCE,
  NUMBER_ROUTE_SOURCE,
  buildSecurityHeaders,
  type HeaderRule
} from "@/lib/security/headers";
import { FAKE, FAKE_GROUPED } from "../fixtures/tracking-fixtures";

const headerMap = (rule: HeaderRule | undefined): Record<string, string> =>
  Object.fromEntries((rule?.headers ?? []).map((header) => [header.key, header.value]));
const ruleFor = (source: string): HeaderRule | undefined => buildSecurityHeaders().find((rule) => rule.source === source);
/** Exactly how Next.js matches headers() sources at runtime (next/dist/server/lib/router-utils/filesystem.js). */
const matches = (source: string, pathname: string): boolean =>
  getPathMatch(source, {
    strict: true,
    removeUnnamedParams: true,
    regexModifier: (regex) => modifyRouteRegex(regex)
  })(pathname) !== false;
const directiveNames = (policy: string): string[] =>
  policy
    .split(";")
    .map((part) => part.trim().split(/\s+/)[0] ?? "")
    .filter((name) => name.length > 0);

const NUMBER_ROUTE_ROWS: ReadonlyArray<readonly [string, boolean]> = [
  [`/${FAKE.domestic}`, true],
  [`/${FAKE.hbl}`, true],
  [`/${FAKE.hbl.toLowerCase()}`, true],
  [`/${FAKE.deepLinkInvalid}`, true],
  [`/${encodeURIComponent(FAKE_GROUPED.domestic)}`, true],
  ["/0000-1234-5678", true],
  ["/", false],
  ["/privacy", false],
  ["/internal", false],
  ["/api", false],
  ["/api/track", false],
  ["/internal/cs-helper", false],
  ["/robots.txt", false],
  ["/sitemap.xml", false],
  ["/icon.svg", false],
  [`/${FAKE.domestic}/extra`, false]
];

test("three rules in override order: every route, number routes, /internal", () => {
  expect(buildSecurityHeaders().map((rule) => rule.source)).toEqual([
    ALL_ROUTES_SOURCE,
    NUMBER_ROUTE_SOURCE,
    INTERNAL_ROUTES_SOURCE
  ]);
  expect(NUMBER_ROUTE_SOURCE).toBe("/:number((?!privacy$|internal$|api$)[^/.]+)");
  expect(INTERNAL_ROUTES_SOURCE).toBe("/internal/:path*");
});

test("every route gets the stage-1 security headers", () => {
  const all = headerMap(ruleFor(ALL_ROUTES_SOURCE));
  expect(all["X-Content-Type-Options"]).toBe("nosniff");
  expect(all["Referrer-Policy"]).toBe("strict-origin");
  expect(all["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  expect(all["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains");
  expect(all["Content-Security-Policy"]).toBe("base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'");
  expect(all["Content-Security-Policy-Report-Only"]).toContain("default-src 'self'");
  for (const pathname of ["/", "/privacy", "/api/track", "/robots.txt", `/${FAKE.domestic}`, "/internal/cs-helper"]) {
    expect(matches(ALL_ROUTES_SOURCE, pathname), pathname).toBe(true);
  }
});

test("the enforced CSP never limits scripts, styles, images, fonts or connections", () => {
  const enforced = headerMap(ruleFor(ALL_ROUTES_SOURCE))["Content-Security-Policy"] ?? "";
  expect(directiveNames(enforced).sort()).toEqual(["base-uri", "form-action", "frame-ancestors", "object-src"]);
});

test("the report-only CSP lists the ad hosts and takes extra script hashes and an optional report URI", () => {
  const reportOnly = (rules: HeaderRule[]): string => headerMap(rules[0])["Content-Security-Policy-Report-Only"] ?? "";
  const defaults = reportOnly(buildSecurityHeaders());
  expect(defaults).toContain("https://pagead2.googlesyndication.com");
  expect(defaults).toContain("frame-src https://*.googlesyndication.com");
  expect(defaults).not.toContain("report-uri");
  const withOptions = reportOnly(buildSecurityHeaders({ extraScriptHashes: ["'sha256-abc='"], reportUri: "/api/csp-report" }));
  const scriptSrc = withOptions.split(";").map((part) => part.trim()).find((part) => part.startsWith("script-src")) ?? "";
  expect(scriptSrc.split(" ")).toContain("'sha256-abc='");
  expect(withOptions).toContain("report-uri /api/csp-report");
  expect(reportOnly(buildSecurityHeaders({ reportUri: null }))).not.toContain("report-uri");
});

test("number-route matching follows the path rules", () => {
  for (const [pathname, expected] of NUMBER_ROUTE_ROWS) {
    expect(matches(NUMBER_ROUTE_SOURCE, pathname), pathname).toBe(expected);
  }
  expect(headerMap(ruleFor(NUMBER_ROUTE_SOURCE))).toEqual({ "X-Robots-Tag": "noindex, nofollow" });
});

test("internal routes are noindex, no-store and no-referrer, and come after the site-wide rule", () => {
  for (const pathname of ["/internal", "/internal/cs-helper", "/internal/ui-kit"]) {
    expect(matches(INTERNAL_ROUTES_SOURCE, pathname), pathname).toBe(true);
  }
  expect(matches(INTERNAL_ROUTES_SOURCE, "/internals")).toBe(false);
  expect(headerMap(ruleFor(INTERNAL_ROUTES_SOURCE))).toEqual({
    "X-Robots-Tag": "noindex, nofollow",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer"
  });
});

test("next.config.ts serves these rules and drops the X-Powered-By header", async () => {
  expect(existsSync(path.resolve(__dirname, "..", "..", "next.config.js"))).toBe(false);
  expect(nextConfig.poweredByHeader).toBe(false);
  expect(nextConfig.output).toBe("standalone");
  expect(nextConfig.allowedDevOrigins).toEqual(["127.0.0.1"]);
  expect(await nextConfig.headers?.()).toEqual(
    buildSecurityHeaders().map((rule) => ({ source: rule.source, headers: [...rule.headers] }))
  );
});
```

- [ ] **Step 2: Write the failing E2E test**

Create `tests/e2e/security-headers.spec.ts`:

```ts
import { expect, test, type APIResponse } from "@playwright/test";
import { IS_PRODUCTION_RUN } from "../support/prod-mode";
import { FAKE } from "../fixtures/tracking-fixtures";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";

function expectSiteWideHeaders(response: APIResponse, referrerPolicy: string): void {
  const headers = response.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe(referrerPolicy);
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["strict-transport-security"]).toContain("includeSubDomains");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["content-security-policy-report-only"]).toContain("default-src 'self'");
  expect(headers["x-powered-by"]).toBeUndefined();
}

test.describe("public responses", () => {
  for (const pathname of ["/", "/privacy"]) {
    test(`${pathname} has the site-wide headers and stays indexable`, async ({ request }) => {
      const response = await request.get(pathname);
      expect(response.status()).toBe(200);
      expectSiteWideHeaders(response, "strict-origin");
      expect(response.headers()["x-robots-tag"]).toBeUndefined();
    });
  }

  for (const route of [
    { name: "domestic", path: `/${FAKE.domestic}` },
    { name: "HBL", path: `/${FAKE.hbl}` }
  ] as const) {
    test(`a ${route.name} number route is noindex`, async ({ request }) => {
      const response = await request.get(route.path);
      expect(response.status()).toBe(200);
      expectSiteWideHeaders(response, "strict-origin");
      expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    });
  }

  test("the tracking API answers with the site-wide headers too", async ({ request }) => {
    const response = await request.post("/api/track", { data: { trackingNumber: FAKE.invalidShort, carrierCode: "AUTO" } });
    expect(response.status()).toBe(400);
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-robots-tag"]).toBeUndefined();
  });
});

test.describe("internal responses", () => {
  test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

  test("/internal/cs-helper is noindex and sends no referrer", async ({ request }) => {
    const response = await request.get("/internal/cs-helper");
    expect(response.status()).toBe(200);
    expectSiteWideHeaders(response, "no-referrer");
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  });

  test("/internal/cs-helper is never stored by caches", async ({ request }) => {
    test.skip(!IS_PRODUCTION_RUN, "next dev overrides Cache-Control on pages");
    const response = await request.get("/internal/cs-helper");
    expect(response.headers()["cache-control"]).toContain("no-store");
  });
});
```

- [ ] **Step 3: Run both to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/security-headers.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading — `Error: Cannot find module '@/lib/security/headers'`.
Run (port 43210 free): `npx playwright test tests/e2e/security-headers.spec.ts`
Expected: `6 failed, 1 skipped` — first failure in each is `x-content-type-options` (expected `"nosniff"`, received `undefined`); the cache test is skipped in dev mode.

- [ ] **Step 4: Create the header rules**

Create `lib/security/headers.ts`:

```ts
/**
 * Security and indexing headers (spec §12 "보안·SEO" stage 1, §3 number routes, §10 /internal).
 * next.config.ts imports this file by relative path, so it must not import anything through the "@/" alias.
 */
export interface HeaderRule {
  readonly source: string;
  readonly headers: ReadonlyArray<{ readonly key: string; readonly value: string }>;
}

export interface SecurityHeaderOptions {
  /** Source expressions such as `'sha256-…'` added to the report-only script-src (S08: the pre-paint script). */
  readonly extraScriptHashes?: readonly string[];
  /** Report-only violation endpoint (S11: "/api/csp-report"). */
  readonly reportUri?: string | null;
}

/** Every route. Listed first: later rules override the same header key. */
export const ALL_ROUTES_SOURCE = "/:path*";
/** Single-segment number-like paths: no dot, not a known top-level route. */
export const NUMBER_ROUTE_SOURCE = "/:number((?!privacy$|internal$|api$)[^/.]+)";
export const INTERNAL_ROUTES_SOURCE = "/internal/:path*";

const NOINDEX = "noindex, nofollow";
const HSTS = "max-age=63072000; includeSubDomains";
const PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=(), payment=(), usb=()";

/**
 * Enforced now. It blocks plugins, <base> hijacking, framing by other sites and cross-site form posts, and never limits
 * scripts, styles, images, fonts or connections, so Next.js inline scripts and AdSense keep working (strict CSP = approval 16).
 */
const ENFORCED_CSP = ["base-uri 'self'", "object-src 'none'", "frame-ancestors 'self'", "form-action 'self'"].join("; ");

const AD_HOSTS = [
  "https://pagead2.googlesyndication.com",
  "https://*.googlesyndication.com",
  "https://*.adtrafficquality.google",
  "https://*.doubleclick.net",
  "https://*.google.com",
  "https://*.gstatic.com"
] as const;
const AD_FRAME_HOSTS = [
  "https://*.googlesyndication.com",
  "https://*.doubleclick.net",
  "https://*.google.com",
  "https://*.adtrafficquality.google"
] as const;

/** Observation only: what a stricter policy would block shows up in the browser console (and at reportUri once S11 adds it). */
function reportOnlyCsp(options: SecurityHeaderOptions): string {
  const directives = [
    "default-src 'self'",
    ["script-src 'self' 'unsafe-inline'", ...(options.extraScriptHashes ?? []), ...AD_HOSTS].join(" "),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    ["connect-src 'self'", ...AD_HOSTS].join(" "),
    ["frame-src", ...AD_FRAME_HOSTS].join(" "),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'"
  ];
  const reporting = options.reportUri ? [`report-uri ${options.reportUri}`] : [];
  return [...directives, ...reporting].join("; ");
}

/** Rules for next.config.ts headers(): every route, then number routes, then /internal (later rules win per key). */
export function buildSecurityHeaders(options: SecurityHeaderOptions = {}): HeaderRule[] {
  return [
    {
      source: ALL_ROUTES_SOURCE,
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin" },
        { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
        { key: "Strict-Transport-Security", value: HSTS },
        { key: "Content-Security-Policy", value: ENFORCED_CSP },
        { key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp(options) }
      ]
    },
    {
      source: NUMBER_ROUTE_SOURCE,
      headers: [{ key: "X-Robots-Tag", value: NOINDEX }]
    },
    {
      source: INTERNAL_ROUTES_SOURCE,
      headers: [
        { key: "X-Robots-Tag", value: NOINDEX },
        { key: "Cache-Control", value: "no-store" },
        { key: "Referrer-Policy", value: "no-referrer" }
      ]
    }
  ];
}
```

- [ ] **Step 5: Replace `next.config.js` with `next.config.ts`**

Run: `git rm next.config.js`
Create `next.config.ts`:

```ts
import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./lib/security/headers";

const nextConfig: NextConfig = {
  output: "standalone",
  // Playwright drives `next dev` through 127.0.0.1; Next 16 blocks non-localhost dev origins by default.
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  // Stage-1 security headers, number-route noindex and /internal isolation (lib/security/headers.ts).
  headers: async () => buildSecurityHeaders().map((rule) => ({ source: rule.source, headers: [...rule.headers] }))
};

export default nextConfig;
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/security-headers.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `7 passed`.
Run (port 43210 free; Playwright starts a fresh `next dev`, which reads the new config): `npx playwright test tests/e2e/security-headers.spec.ts`
Expected: `6 passed, 1 skipped`.

- [ ] **Step 7: Run the whole suite in both modes under the new headers**

Run (port 43210 free): `npx playwright test`
Expected: 0 failed (every lookup test hydrates and submits under the enforced CSP).
Run: `npm run build`
Expected: exit 0.
Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test`
Expected: 0 failed; `tests/e2e/security-headers.spec.ts` shows `7 passed` (including "never stored by caches"); only the 35 stage-screens tests are skipped.
Stop the server: `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`; clear the flags: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 8: Commit**

Run: `git add lib/security/headers.ts next.config.ts tests/unit/security-headers.spec.ts tests/e2e/security-headers.spec.ts; git status --short`
Expected: `D  next.config.js` (staged by `git rm` in Step 5) plus the four added files.
Run: `git commit -m "feat: add stage-1 security headers and noindex for number and internal routes"`

---

### Task 10: Real `robots.txt`, `sitemap.xml` and 404 page

**Files:**
- Create: `app/robots.ts`, `app/sitemap.ts`, `app/not-found.tsx`
- Test: `tests/e2e/seo-routes.spec.ts`

**Interfaces:**
- Consumes: `SITE_ORIGIN` (Task 2); `FAKE` (Task 1).
- Produces: metadata routes `/robots.txt` and `/sitemap.xml` (spec §3 "실파일"); `app/not-found.tsx` (root layout only, so no ads; S06 restyles it with tokens). In S01 a single unknown segment such as `/a.b` still reaches `[trackingNumber]`; S06's three-way split turns it into this 404.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/seo-routes.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { FAKE } from "../fixtures/tracking-fixtures";

test("robots.txt is a real text route that allows the site and points to the sitemap", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/plain");
  const lines = (await response.text()).split("\n").map((line) => line.trim());
  expect(lines).toContain("User-Agent: *");
  expect(lines).toContain("Allow: /");
  expect(lines).toContain("Disallow: /api/");
  expect(lines).toContain("Disallow: /internal/");
  expect(lines).toContain("Sitemap: https://tracking.tipoasis.com/sitemap.xml");
});

test("sitemap.xml lists the two public pages and no number route", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("xml");
  const body = await response.text();
  const locations = Array.from(body.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1]);
  expect(locations).toEqual(["https://tracking.tipoasis.com/", "https://tracking.tipoasis.com/privacy"]);
  expect(body).not.toContain(FAKE.domestic);
});

test("an unknown multi-segment path is a real 404 with a way back to the lookup", async ({ page }) => {
  const response = await page.goto("/no/such/page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "페이지를 찾을 수 없어요" })).toBeVisible();
  await expect(page.getByRole("link", { name: "배송 조회로 돌아가기" })).toHaveAttribute("href", "/");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/seo-routes.spec.ts`
Expected: `3 failed` — `/robots.txt` and `/sitemap.xml` answer `text/html` (today the `[trackingNumber]` page catches them), and the 404 page has no heading '페이지를 찾을 수 없어요'.

- [ ] **Step 3: Create the three routes**

Create `app/robots.ts`:

```ts
import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";

/**
 * Real robots.txt (spec §3). Number routes stay crawlable on purpose: they answer X-Robots-Tag: noindex,
 * and a Disallow would hide that header from crawlers.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/internal/"] },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`
  };
}
```

Create `app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";

/** Public, indexable pages only (spec §3). Number routes are never listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_ORIGIN}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_ORIGIN}/privacy`, changeFrequency: "yearly", priority: 0.3 }
  ];
}
```

Create `app/not-found.tsx`:

```tsx
import Link from "next/link";

/** Real 404 (spec §3, SEO-01). Rendered in the root layout only: no ads. S06 restyles it with the design tokens. */
export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto flex min-h-[70dvh] w-full max-w-xl flex-col justify-center px-4 py-16">
      <h1 className="break-keep text-2xl font-semibold text-slate-50">페이지를 찾을 수 없어요</h1>
      <p className="mt-3 break-keep text-sm leading-6 text-slate-300">
        주소가 바뀌었거나 잘못 입력된 것 같아요. 조회번호는 배송 조회 화면에서 다시 입력해 주세요.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center self-start rounded-xl border border-slate-600 px-4 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80"
      >
        배송 조회로 돌아가기
      </Link>
    </main>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (port 43210 free): `npx playwright test tests/e2e/seo-routes.spec.ts tests/e2e/security-headers.spec.ts`
Expected: `9 passed, 1 skipped` (seo-routes 3; security-headers 6 plus the production-only cache test skipped).
Run: `npm run build`
Expected: exit 0; the route table now also lists `○ /robots.txt` and `○ /sitemap.xml`.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

Run: `git add app/robots.ts app/sitemap.ts app/not-found.tsx tests/e2e/seo-routes.spec.ts; git commit -m "feat: serve real robots.txt, sitemap.xml and a 404 page"`

---

### Task 11: CI runs E2E against the production build

**Files:**
- Modify: `.github/workflows/ci.yml` (replace the last step, lines 42–43 `E2E smoke`, with three steps; the file has 43 lines)
- Test: `tests/unit/ci-workflow.spec.ts`

**Interfaces:**
- Consumes: `INTERNAL_TEST_PASSWORD` (`tests/internal-auth.ts`); the flags `PLAYWRIGHT_SKIP_WEB_SERVER`, `PW_MODE` (roadmap §11.10).
- Produces: CI where every E2E, unit and budget spec runs once against `next start` (spec §14 item 6). Dev-mode E2E remains a local gate step (G5).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ci-workflow.spec.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { INTERNAL_TEST_PASSWORD } from "../internal-auth";

interface WorkflowStep {
  readonly name: string;
  readonly body: string;
}

const workflow = readFileSync(path.resolve(__dirname, "..", "..", ".github", "workflows", "ci.yml"), "utf8");
const steps: readonly WorkflowStep[] = workflow
  .split(/\n\s+- name: /)
  .slice(1)
  .map((block) => ({ name: block.split("\n")[0]?.trim() ?? "", body: block }));
const stepIndex = (name: string): number => steps.findIndex((step) => step.name === name);

test("CI builds once, starts next start, then runs E2E against it", () => {
  const build = stepIndex("Build");
  const start = stepIndex("Start production server");
  expect(build).toBeGreaterThan(-1);
  expect(start).toBeGreaterThan(build);
  expect(steps.filter((step) => step.body.includes("npm run test:e2e")).map((step) => step.name)).toEqual([
    "E2E on the production build"
  ]);
  expect(stepIndex("E2E on the production build")).toBeGreaterThan(start);
});

test("the production E2E steps set the flags the specs read", () => {
  const start = steps[stepIndex("Start production server")]?.body ?? "";
  expect(start).toContain("next start --port 43210 --hostname 127.0.0.1");
  expect(start).toContain(`INTERNAL_ACCESS_PASSWORD: ${INTERNAL_TEST_PASSWORD}`);
  const e2e = steps[stepIndex("E2E on the production build")]?.body ?? "";
  expect(e2e).toContain('PLAYWRIGHT_SKIP_WEB_SERVER: "1"');
  expect(e2e).toContain("PW_MODE: production");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ci-workflow.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `2 failed` — `expect(received).toBeGreaterThan(expected)` with `Received: -1` (no "Start production server" step), and `toContain` on an empty step body.

- [ ] **Step 3: Replace the E2E step**

In `.github/workflows/ci.yml`, replace the last step (lines 42–43, directly after the `Build` step on lines 39–40):

```yaml
      - name: E2E smoke
        run: npm run test:e2e
```

with:

```yaml
      - name: Start production server
        env:
          INTERNAL_ACCESS_PASSWORD: playwright-internal-access
        run: |
          nohup npx next start --port 43210 --hostname 127.0.0.1 > next-start.log 2>&1 &
          for attempt in $(seq 1 60); do
            if curl --silent --fail --output /dev/null http://127.0.0.1:43210/; then
              echo "next start answered after ${attempt} s"
              exit 0
            fi
            sleep 1
          done
          cat next-start.log
          exit 1

      - name: E2E on the production build
        env:
          PLAYWRIGHT_SKIP_WEB_SERVER: "1"
          PW_MODE: production
        run: npm run test:e2e

      - name: Server log on failure
        if: failure()
        run: cat next-start.log || true
```

(The job keeps the background server alive until it ends; GitHub cleans up orphan processes after the last step.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/ci-workflow.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `2 passed`.
Reproduce the CI sequence locally once: `npm run build` → background PowerShell `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1` → wait for `200` from `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` → `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npm run test:e2e`
Expected: 0 failed; only the 35 stage-screens tests skipped. Stop the server (`Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`) and clear the flags (`$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`).
Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 5: Commit**

Run: `git add .github/workflows/ci.yml tests/unit/ci-workflow.spec.ts; git commit -m "ci: run E2E against the production build"`

---

### Task 12: Public git history rewrite (optional)

> **GATED — approval 11.** Fallback while not approved (spec §16 승인 11 "거절하면"): the working-tree replacement and the guard ship as done in Task 4; the history stays public; recommend reviewing the repository's visibility.

**Files:**
- Temporary, never committed: `test-artifacts/history-rewrite/collect-runs.cjs`, `test-artifacts/history-rewrite/replacements.txt`
- No tracked file changes.

**Interfaces:**
- Consumes: the guard rules of Task 2 (re-stated inside the collector, because a `.cjs` script cannot import the TypeScript module); `ADSENSE_PUBLISHER_DIGITS` passed on the command line.
- Produces: a rewritten history (operator-run only) or the recorded recommendation.

- [ ] **Step 1: Confirm approval 11 is recorded in the roadmap approval ledger; if not, stop.** Open `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §4, row 11. If Status is not `approved`, mark Task 12 SKIPPED in the stage summary with this text and go to Task Final:
  "Approval 11 = <status>. No history rewrite. The working tree and CI guard are clean, but earlier commits in the public repository still contain the real example numbers and the unidentified 12-digit numbers. Recommendation: make the repository private (GitHub → Settings → General → Danger Zone → Change repository visibility) or approve the rewrite (spec §16 승인 11)."

- [ ] **Step 2: Collect the runs to replace (local, read-only on history)**

Create `test-artifacts/history-rewrite/collect-runs.cjs`:

```js
// S01 Task 12 (approval 11). Lists every 10+ digit run in any commit that the repository guard would reject and writes a
// git-filter-repo replacement file. Output stays in test-artifacts/ (git-ignored). Prints counts only, never the runs.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const publisherDigits = process.argv[2];
if (!/^\d{16}$/.test(publisherDigits ?? "")) {
  console.error("usage: node collect-runs.cjs <ADSENSE_PUBLISHER_DIGITS>");
  process.exit(1);
}
const outFile = path.join("test-artifacts", "history-rewrite", "replacements.txt");
const git = (args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 });

const isTimestamp14 = (digits) => {
  if (!/^\d{14}$/.test(digits)) return false;
  const [year, month, day, hour, minute, second] = [0, 4, 6, 8, 10, 12].map((start, index) =>
    Number(digits.slice(start, index === 0 ? 4 : start + 2))
  );
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    year >= 2000 && year <= 2099 && hour <= 23 && minute <= 59 && second <= 59 &&
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};
const allowed = (digits) =>
  digits.startsWith("0000") || digits === publisherDigits || isTimestamp14(digits) || /^0100000\d{4}$/.test(digits);

const runs = new Set();
for (const commit of git(["rev-list", "--all"]).split(/\r?\n/).filter(Boolean)) {
  let output = "";
  try {
    output = git(["grep", "-I", "-h", "-o", "-E", "[0-9]{10,}", commit]);
  } catch (error) {
    if (error.status === 1) continue; // git grep exits 1 when the commit has no match
    throw error;
  }
  for (const line of output.split(/\r?\n/)) {
    const digits = line.slice(line.lastIndexOf(":") + 1);
    if (/^\d{10,}$/.test(digits) && !allowed(digits)) runs.add(digits);
  }
}
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, [...runs].map((digits) => `${digits}==>000012345678`).join("\n") + "\n");
console.log(`distinct runs to replace: ${runs.size} -> ${outFile}`);
```

Run: `node test-artifacts/history-rewrite/collect-runs.cjs 7351210358018620`
Expected: `distinct runs to replace: N -> test-artifacts/history-rewrite/replacements.txt` with N ≥ 9 (the two example numbers, their neighbours and the unidentified test numbers). Ask the operator to open `replacements.txt` locally and delete any line that is not a shipment number (for example a long id that must stay); never paste its content into chat, a commit or the stage summary.

- [ ] **Step 3: Hand the rewrite to the operator (the agent never force-pushes)**

Give the operator these PowerShell commands and the warnings below; wait for the operator to report the result.

```powershell
# 0. Start in the worktree root (the folder that holds package.json) and keep the replacement file's full path
$replacements = Join-Path (Get-Location).Path 'test-artifacts\history-rewrite\replacements.txt'
Test-Path -LiteralPath $replacements   # must print True
# 1. Tool (a local Python tool; install only if you accept it)
pip install git-filter-repo
# 2. Fresh mirror under %TEMP%, rewritten with the replacement file
git clone --mirror https://github.com/Ddomongs/tracking-tipoasis.git "$env:TEMP\tracking-tipoasis-rewrite.git"
Set-Location "$env:TEMP\tracking-tipoasis-rewrite.git"
git filter-repo --replace-text $replacements
# 3. Verify: prints 0
$patterns = Get-Content -LiteralPath $replacements | ForEach-Object { $_.Split('=')[0] } | Where-Object { $_ }
(git log --all -p | Select-String -SimpleMatch -Pattern $patterns | Measure-Object).Count
# 4. Publish (rewrites main: Vercel redeploys the same code)
git remote add origin https://github.com/Ddomongs/tracking-tipoasis.git
git push --force --all origin
git push --force --tags origin
```

Warnings to include: every clone and worktree (including this one and the `claude/*` branches) must be re-cloned afterwards; open pull requests break; GitHub can keep old commits reachable by SHA until GitHub Support purges cached views (GitHub docs "Removing sensitive data from a repository"); Vercel's previous deployments keep their source snapshots.

- [ ] **Step 4: Record the outcome**

Write into the stage summary: approval 11 status, N (count only), the operator's step-3 verification count (`0` expected), and the date of the force push. Then delete the temporary files: `Remove-Item -Recurse -Force test-artifacts/history-rewrite`.

---

### Task Final: Stage gate

- [ ] **G1. Port free.** `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue` → no output (stop listeners otherwise).
- [ ] **G2. Lint.** `npm run lint` → exit 0, no errors, no warnings introduced by this stage.
- [ ] **G3. Typecheck.** `npm run typecheck` → exit 0.
- [ ] **G4. Build.** `npm run build` → exit 0. Route table: `ƒ /[trackingNumber]` always; `/` is `ƒ` in S01 (it still reads `searchParams`), `○ /` from S02 on, and `○ /` with `Revalidate 5m` from S06 on.
- [ ] **G5. Dev-mode E2E.** `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npm run test:e2e` → "N passed", 0 failed (skips allowed only for tests guarded by `PW_MODE`, `PW_SHOTS`, `PW_VISUAL`, or an approval-gated `test.skip` naming the approval).
- [ ] **G6. Production-mode E2E.** Re-run `npm run build` if `next start` reports a missing or stale build. Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait for `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` = `200`; then `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test` → 0 failed, including `tests/budgets/*`.
- [ ] **G7. After-screens.** Server still running: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='after'; $env:PW_STAGE='S01'; npx playwright test tests/tools/stage-screens.spec.ts` → PNGs in `test-artifacts/stage-screens/S01-after/` at 320, 375, 768, 1024, 1440. Compare with `S01-before/`; send both sets to the operator with SendUserFile. Stop the server (G1 command) and clear the flags: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.
- [ ] **G8. Budgets.** Paste the measured numbers of every budget this plan lists (from the G6 output) into the stage summary. Any budget over its fail line fails the gate.
- [ ] **G9. Code review.** Invoke the `code-review` skill on `git diff claude/tipoasis-tracking-renewal-ae0e3a...HEAD`. Fix every CRITICAL and HIGH finding; if code changed, re-run G2–G6.
- [ ] **G10. Verification.** Invoke `superpowers:verification-before-completion`; paste each command and its result line into the stage summary.
- [ ] **G11. Commit.** `git status` shows only this stage's files (see the roadmap File Map). Commit any remainder with a conventional message and no attribution trailer.
- [ ] **G12. No deploy.** Do not push to `main`; do not run `vercel deploy`. Push `renewal/s01-r0-urgent-fixes` only if the operator asked. Hand the stage summary to the operator; merge into the integration branch only after acceptance (roadmap §5).

**S01 notes on the gate above**
- G4: the S01 route table is `ƒ /` (it still reads `searchParams`; S02 makes it static), `ƒ /[trackingNumber]`, `○ /privacy`, `○ /internal/cs-helper`, `○ /robots.txt`, `○ /sitemap.xml`, `○ /_not-found`, `○ /icon.svg`, `ƒ /api/track` (plus `ƒ Proxy (Middleware)`). A scratch build of this plan's code produced exactly this table.
- G5 (dev mode) expected totals: 101 passed, 41 skipped (35 stage-screens, 5 budgets, 1 production-only cache test). Per file: tracking 16, privacy 2, customs-estimate 6, delivery-carriers 14, internal-cs-helper 5, internal-access 4, track-api 6, unit tracking-fixtures 8, site 2, real-number-guard 9, mismatch-storage 8, security-headers 7, ci-workflow 2, e2e internal-isolation 3, security-headers 6, seo-routes 3.
- G6 (production) expected totals: 107 passed, 35 skipped (stage-screens only).
- G7: the PNGs are in `test-artifacts/stage-screens/S01-after/` (Additions to the contract, item 1; G7 above already uses that path): 35 files; `(Get-ChildItem test-artifacts/stage-screens/S01-after -Filter *.png).Count` prints `35`. Send `home-375.png` and `home-1440.png` from both folders first — the before-shots show mask boxes where the example buttons were; the after-shots show the format hint and the hero without a fade.
- G8: paste the two `[font-preload]` lines (expected `0 files` each), the first-paint result (3 passed), the guard result ("no file contains a tracking-number-like digit run outside the allowlist" passed, 0 findings) and the header results (security-headers E2E 7/7 in production).
- G11: `git diff --stat claude/tipoasis-tracking-renewal-ae0e3a...HEAD` lists only the paths in this plan's File Structure table (plus a fixed `docs/superpowers/plans/…` file if Task 4 Step 9.5 applied). `test-artifacts/` must not appear.
- Stage summary must also contain: the Task 0 Step 7 hotfix decision; approval 11's status and Task 12's outcome; "Additions to the contract" items 1–6 for the roadmap owner; the open issues below.

---

## Self-Review

**1. Spec and scope coverage**

| Requirement (stage scope / spec) | Task |
|---|---|
| Check for a hotfix on all branches and skip what is done | Task 0 Step 7 (+ `DONE-BY-HOTFIX` rule in every red step) |
| `tests/fixtures/tracking-fixtures.ts` (FAKE, `FIXTURE_NOW` 2026-09-26T14:05+09:00, 15 states via `normalizeTrackingData`, `FAILURE_RESPONSES`, `mockTrack`), `tests/support/prod-mode.ts`, `tests/tools/stage-screens.spec.ts`, before-screens | Task 1 |
| Replace every real/unidentified number in app, components, lib, tests (tracking, privacy, customs-estimate, delivery-carriers, track-api, internal-cs-helper), docs (Plan.md, docs/archive, insforge runbook), design-system tracking-form.html | Tasks 3 (form), 4 (everything else) |
| Remove `SAMPLE_NUMBERS` buttons, show the §4 format hint | Task 3 |
| `lib/privacy/number-patterns.ts` + `tests/unit/real-number-guard.spec.ts` (§11.4 allowlist) | Tasks 2, 4 |
| IBM Plex Sans KR `preload: false`, 400/700, Space Grotesk dropped (`--font-display` fallback) + `tests/budgets/font-preload.spec.ts` (≤ 2 on `/` and `/{번호}`) | Task 5 |
| Hero SSR `opacity:0` removed (`initial={false}`) + `tests/budgets/first-paint.spec.ts` | Task 6 |
| Route groups via `git mv`, AdSense `<Script>` only in `app/(public)/layout.tsx`, `app/(internal)/layout.tsx` noindex, `tests/e2e/internal-isolation.spec.ts` | Task 7 |
| `lib/cs/mismatch-storage.ts` (v1 payload, zod, 14-day TTL, legacy migration, `clearAllStoredRecords`), [전체 삭제], `tests/unit/mismatch-storage.spec.ts` | Task 8 |
| `next.config.ts` (`poweredByHeader: false`, `headers()` from `lib/security/headers.ts`: nosniff, strict-origin, Permissions-Policy, enforced CSP + Report-Only, HSTS includeSubDomains, X-Robots-Tag for `NUMBER_ROUTE_SOURCE`, `/internal` noindex + no-store + no-referrer), unit + E2E tests | Task 9 |
| `lib/site.ts`, `app/robots.ts`, `app/sitemap.ts`, `app/not-found.tsx`, `tests/e2e/seo-routes.spec.ts` | Tasks 2, 10 |
| CI runs E2E against the production build | Task 11 |
| Optional history rewrite only with approval 11, otherwise the recommendation | Task 12 |
| Keep E2E business rules; rule→assertion map | Task 4 (map), Tasks 3–10 run the full suites |

**2. Placeholder scan.** No TBD/TODO/"similar to". The only values left to the executor are the real digits the plan must not contain; each such edit names the file, the line and the exact replacement text, and the guard proves the result.

**3. Type and name consistency.** Contract names used exactly: `FIXTURE_NOW_ISO`, `FIXTURE_NOW`, `FAKE`, `FAKE_GROUPED`, `FixtureState`, `GAP3_06_VARIANTS`, `trackData`, `FailureFixture`, `FAILURE_RESPONSES`, `mockTrack`, `successBody`, `IS_PRODUCTION_RUN`, `SITE_ORIGIN`, `ADSENSE_CLIENT_ID`, `ADSENSE_PUBLISHER_DIGITS`, `ADSENSE_LOADER_URL`, `buildReturnLink`, `DIGIT_RUN_PATTERN`, `HBL_LIKE_PATTERN`, `isAllowedDigitRun`, `findDisallowedDigitRuns`, `containsTrackingLikeValue`, `decodeRepeatedly`, `HeaderRule`, `NUMBER_ROUTE_SOURCE`, `SecurityHeaderOptions`, `buildSecurityHeaders`, `MISMATCH_LEGACY_KEY`, `MISMATCH_TTL_DAYS`, `MismatchRecord`, `createRecordId`, `normalizePhone`, `getStoredRecordsSnapshot`, `getServerStoredRecordsSnapshot`, `subscribeStoredRecords`, `writeStoredRecords`, `clearAllStoredRecords`. Private additions are listed under "Additions to the contract".

**4. Review Focus.** All five lines have a pinning test in the owning task (Task 9 unit ×2, Task 8 unit and E2E, Task 2 unit).

**5. Dry run of this plan's code (planning session, scratch copy outside the repo).** Every code block above was extracted into a copy of `e079461`, the structural edits of Tasks 3–7 and 9–11 were applied, and: `tsc --noEmit` exit 0; all unit specs pass except the repository scan, which lists exactly the 70 findings of Task 4 Step 2 (none in `docs/superpowers/`); the Task 4 helper reports 12/2/6/12/7 and 1/3/4 and is idempotent; the pure specs with fixture numbers pass (track-api 6, customs-estimate 6, delivery-carriers 14); against `next start` (webpack build, because Turbopack refuses a junctioned `node_modules`) budgets 5/5, E2E internal-isolation 3/3, security-headers 7/7 (including `no-store` on `/internal`), seo-routes 3/3, the existing tracking/privacy/internal specs 24/24 under the enforced CSP, and stage-screens 35/35 with the example buttons masked. The font-preload and first-paint helpers, run on Phase 1's captured production HTML, find 281 preloads and the inline `opacity:0`, so their red steps are real. The Task 8 E2E tests were not dry-run.

**Open issues (outside S01's scope; copy them into the stage summary).**
1. `/ads.txt` is answered today by the `[trackingNumber]` page (HTML), and after S06's three-way split a dotted path becomes a real 404. Ad crawlers normally read `ads.txt` on the root domain (`tipoasis.com/ads.txt`) and look at a subdomain file only when the root file points to it, so whether `tracking.tipoasis.com/ads.txt` is needed at all is an account question. Proposal for the operator: check the AdSense "Sites" page and the root domain's `ads.txt`; only if AdSense asks for the subdomain file, add `public/ads.txt` with the line AdSense shows (`google.com, pub-` + the publisher digits + `, DIRECT, f08c47fec0942fa0`). It is not in the contract's File Map, so no stage does it without that decision.
2. The enforced CSP's `frame-ancestors 'self'` (Task 9) stops any other site from showing these pages inside an `<iframe>`. Nothing in the repository embeds them, but if the operator's store pages, blog or a partner tool frame `tracking.tipoasis.com`, that view goes blank after R0. Ask the operator before the R0 release; if such an embed exists, drop only `frame-ancestors 'self'` from `ENFORCED_CSP` (and from the expected string and directive list in `tests/unit/security-headers.spec.ts`) — the other three enforced directives stay.
3. The Report-Only CSP allows `'unsafe-inline'` in `script-src`. Once S08 adds the pre-paint hash through `extraScriptHashes`, CSP3 browsers ignore `'unsafe-inline'` in that directive and will report Next.js's own inline scripts as (report-only) violations. Nothing is blocked; S08 and S11 should expect that console and report noise (approval 16 decides the strict policy).
