# S10 — R4 Server Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `POST /api/track` answer NOT_FOUND in ≤ 3 s (UNI-PASS latency 0.3 s) / ≤ 6 s (1.5 s), report a UNI-PASS outage as `API_TIMEOUT` within 15 s instead of a false NOT_FOUND, log every lookup without numbers, then shorten the client timeout (Part B) and retire or harden the InsForge proxy (Part C) — with the `TrackResponseData` contract unchanged.

**Architecture:** One per-request deadline (`lib/services/lookup-budget.ts`) bounds every upstream call. `lib/services/customs.ts` asks UNI-PASS in two waves (current + last year first, the other four years in parallel only if the first wave found nothing), never retries a confirmed empty answer, and classifies the result as `found | empty | unavailable | notConfigured`. `app/api/track/route.ts` orchestrates UNI-PASS, customstrack and carriers under that deadline, answers carrier-first for DOMESTIC numbers when customs is slow, caches NOT_FOUND for 120 s, maps "every upstream failed" to `API_TIMEOUT`, and writes one number-free log line per request (`lib/services/lookup-log.ts`). Tests drive the real route handler against an in-process upstream stub ported from the Phase 1 GAP2 harness.

**Tech Stack:** Next.js 16.3.6 App Router route handler (Node runtime, Vercel `icn1`), TypeScript strict, zod 3.25 (unchanged schemas), xml2js, cheerio, node-cache, Playwright 1.55+ as the only test runner (unit tests are Playwright tests without `page`).

**Spec:** `docs/superpowers/specs/2026-09-26-tracking-renewal-ia-design.md` — §5 "서버, 승인 시", §11 "2단계: 항목 4 승인 시", §15 R4, §16 승인 5 and 승인 12, §19 (25 s timeout only after the server fix). Roadmap and shared contract: `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md`. Evidence: `<scratchpad>/phase1/results-run2/gaps.json` GAP2-01…07 and the harness `<scratchpad>/phase1/gap-GAP2/{stub-net.cjs,latency-run.cjs}` (`<scratchpad>` as defined in the roadmap header).

**Depends on:** S01 (Parts A and C: fixtures, `lib/privacy/number-patterns.ts`, real-number guard, stage-screens tool, production-mode E2E in CI). S03 (Part B only: `config/site.config.ts` `lookup`, `tests/unit/config.spec.ts`).

**Gated by:** approval 5 (Parts A and B). Approval 12 (Part C: retirement when approved, hardening fallback while `pending`/`rejected`).

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

**S10-specific constraints**
- `TrackResponseData`, `ApiError`, `ApiTrackResponseSchema`, `TrackRequestSchema` and the JSON envelope `{ success, data | error }` are byte-for-byte unchanged. Status codes used: 200, 400, 404, 408, 413, 415, 429, 500, 503, 504 (as today); 503/504 with `API_TIMEOUT` now also mean "every upstream that decides the answer failed".
- Server error messages keep today's Korean strings (the client never shows them). S10 adds no customer copy; Part B changes numbers only.
- Timing constants live only in `LOOKUP_TIMING` / `LOOKUP_CACHE_SECONDS` (`lib/services/lookup-budget.ts`): budget 15 s, per UNI-PASS call 8 s, customstrack 4 s, proxy 5 s, DOMESTIC customs grace 2 s, NOT_FOUND cache 120 s. `export const maxDuration = 30` in `app/api/track/route.ts`; no other non-handler export from that file (Next validates route exports).
- Log lines hold only enums and small integers: `track_lookup {"route":"/api/track","elapsedBucket":…,"unipassOk":…,"unipassFail":…,"resultKind":…,"errorCode":…}`. No number, phone, IP, UA, URL or free text — ever.
- Files S10 may touch: `app/api/track/route.ts`, `lib/services/customs.ts`, `lib/services/customstrack.ts` (deadline pass-through only), `lib/services/lookup-budget.ts`, `lib/services/lookup-log.ts`, the tests named in each task, `DEPLOYMENT.md`, `config/site.config.ts` + `tests/unit/config.spec.ts` (Part B), and the Part C files. `lib/services/http.ts` and `lib/services/delivery.ts` stay untouched (delivery is raced against the deadline instead).
- Agents never call production endpoints, never change Vercel/InsForge/GitHub settings or secrets, and never deploy. Every such step is an operator step with the exact command.

## Review Focus

Conditions the spec implies but no requirement line names; each is pinned by a test in the owning task.

1. **UNI-PASS sends headers and then stalls the body** (GAP2-06; today the request hangs past 330 s): the answer must be `API_TIMEOUT` 504 within 15 s and the call counted as timed out. Tests: Task A4 "a stalled UNI-PASS body counts as a timeout", Task A3 "a stalled UNI-PASS body answers API_TIMEOUT within 15 s".
2. **Partial UNI-PASS failure** (current and last year answer "no record", the four older years fail): customers still get NOT_FOUND, but it must not be cached, so the next lookup asks again. Test: Task A3 "an incomplete NOT_FOUND is not cached".
3. **DOMESTIC number with a fast carrier answer and a hanging UNI-PASS**: the carrier result is not held back (≤ 3.5 s), is not cached (so customs can fill in later), and the background UNI-PASS calls are aborted once the response is sent. Test: Task A3 "a DOMESTIC carrier result is not held back by a slow customs lookup" (time, aborted calls, and a second lookup that asks UNI-PASS again).
4. **Concurrency slots under the new early returns** (cache hits, carrier-first responses with work still in flight): the in-memory cap of 20 must never leak, or healthy customers get 429. Tests: Task A3 "sequential lookups never leak concurrency slots" (25 fresh lookups, then the same 25 as cache hits; a leak on either path turns the 21st call into 429) and Task A3 "carrier-first answers release their concurrency slots" (20 carrier-first answers at once while UNI-PASS still hangs, then one more lookup that must not get 429). The carrier-first path releases its slot in the same `finally` as every other path (Task A5 `POST`).
5. **A log line fed with tracking-like values** (invalid input that is a phone number, an extra field that carries an HBL, a bogus enum value): the line stays number-free and schema-fixed. Tests: Task A2 "extra fields and odd values never reach the line", Task A5 "every response writes one number-free lookup log line".

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `lib/services/lookup-budget.ts` | Create (A1) | `LOOKUP_TIMING`, `LOOKUP_CACHE_SECONDS`, `createLookupDeadline`, `withinMs` — one clock and one abort tree per request |
| `lib/services/lookup-log.ts` | Create (A2) | Log record type, bucket function, number-free formatter, sink seam, UNI-PASS call tally |
| `lib/services/customs.ts` | Modify (A4, A5, C1 or C2F) | Two-wave UNI-PASS lookup under the deadline, result classification, bounded proxy fallback |
| `lib/services/customstrack.ts` | Modify (A4) | Accept `{ timeoutMs, signal }` so the fallback respects the deadline (parse logic untouched) |
| `app/api/track/route.ts` | Modify (A5) | Orchestration, `maxDuration`, NOT_FOUND cache, carrier-first, `API_TIMEOUT` on all-failed, one log line per request |
| `tests/support/unipass-stub.ts` | Create (A3), Modify (C2F; C1 after an earlier C2F) | In-process stub of UNI-PASS, proxy, customstrack, carriers (port of GAP2 `stub-net.cjs`), `callTrack`, budget annotations |
| `tests/unit/lookup-budget.spec.ts` | Create (A1), Modify (C1) | Deadline and constant tests |
| `tests/unit/lookup-log.spec.ts` | Create (A2) | Log format and privacy tests |
| `tests/unit/track-route-latency.spec.ts` | Create (A3), Modify (A4, C1) | Latency budgets and upstream-call behavior against the real route |
| `tests/track-api.spec.ts` | Modify (A5) | `maxDuration` and per-request log line |
| `DEPLOYMENT.md` | Modify (A6, C2 or C2F) | Log schema + failure-rate alert proposal; InsForge removal or URL removal |
| `config/site.config.ts`, `tests/unit/config.spec.ts` | Modify (B1) | `timeoutMs` 25000, `notFoundServiceCaveat` false, `stageMs` re-tuned |
| `insforge/functions/unipass-proxy.ts`, `.github/workflows/deploy-insforge.yml`, `docs/insforge-deployment-runbook.md` | Delete (C2) or harden/edit (C1F, C2F) | Approval 12 |
| `package.json`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `.env.example` | Modify (C2 or C2F) | InsForge scripts and URL mentions |
| `tests/unit/insforge-retired.spec.ts` | Create (C2) | Retirement scan |
| `tests/unit/unipass-proxy.spec.ts` | Create (C1F), Modify (C2F), Delete (C1 after an earlier C1F–C2F) | Hardened proxy + server secret header + doc scan |

## Execution Order and Gating

| Part | Tasks | Runs when | Fallback when not allowed (spec §16) |
|---|---|---|---|
| Start | Task 0 | always | — |
| A — server path (release R4) | A1 → A6 | approval 5 = `approved` | Mark A1–A6 SKIPPED "approval 5 pending". Nothing changes on the server: the client keeps the 45 s timeout, the stage copy and the NOT_FOUND caveat line '조회 서비스 사정으로 결과가 없을 수도 있어요 [다시 조회]' (S03 defaults). The outage misreport and the 429s from slow paths remain (documented in the stage summary). |
| B — client timeout (R4 follow-up) | B1 | approval 5 approved **and** Part A live in production with ≥ 3 days of log evidence **and** S03 merged | SKIPPED; S03's `timeoutMs: 45000`, `notFoundServiceCaveat: true`, `stageMs: [3000, 8000]` stay. |
| C — InsForge | C1 → C2 (retire) | approval 12 = `approved` **and** Part A merged and live **and** the log-evidence rule in C1 Step 2 passes | Until then C1F → C2F (next row) |
| C — InsForge | C1F → C2F (harden) | approval 12 = `pending` or `rejected` | This *is* the fallback: shared secret header, no CORS, number-format validation, call limit. |
| Gate | Task Final | after each part that ran (A, B, C) | — |

Parts B and C usually run days after Part A. Each part re-uses the branch `renewal/s10-r4-server-path` (re-created from the integration head, see B1 Step 3 / C1 Step 3 / C1F Step 2) and ends with Task Final. Before re-running Task Final, rename the previous screen folders (stage screens live under `test-artifacts/`, S01 Addition 1): `Rename-Item test-artifacts/stage-screens/S10-before S10A-before; Rename-Item test-artifacts/stage-screens/S10-after S10A-after` (use `S10B-*` / `S10C-*` when the previous run covered Part B / Part C).

**Likely first run.** Approvals 5 and 12 are both `pending` in the ledger today, so the first S10 run is Task 0 → A1 Step 1 (Part A SKIPPED) → C1F → C2F **variant B** → Task Final. When approval 5 is granted later, the Part A follow-up run starts after that first run was merged: `git branch -D renewal/s10-r4-server-path`, rename the first run's folders to `S10C-before`/`S10C-after`, then run Task 0 in full (its Step 7 marks C1F/C2F DONE-EARLIER) and A1–A6. Tasks A3 Step 2 and A4 Step 4 then re-apply C2F's secret header to the rewritten files (their "C2F already merged" sub-steps), and a later retirement (C1–C2) removes the fallback leftovers (C1 Step 6, C2 Step 6a).

---

### Task 0: Stage start

- [ ] **Step 1: Read approvals.** Open `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §4. For every approval number in this plan's "Gated by" list, write its Status into the stage summary. `pending`/`rejected` → execute the fallback steps and mark the gated task SKIPPED with the reason.
- [ ] **Step 2: Confirm dependencies.** Run (PowerShell): `git log --oneline claude/tipoasis-tracking-renewal-ae0e3a -40`
  Expected: a `merge: SNN …` commit for every stage in this plan's "Depends on" list.
- [ ] **Step 3: Branch.** Run: `git switch -c renewal/s10-r4-server-path claude/tipoasis-tracking-renewal-ae0e3a`
  Expected: `Switched to a new branch 'renewal/s10-r4-server-path'`.
- [ ] **Step 4: Port free.** Run: `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue`
  Expected: no output. Otherwise stop the listener: `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`
- [ ] **Step 5: Baseline build and before-screens.** Run `npm ci` only if `package-lock.json` changed since the last install in this worktree, then `npm run build`.
  Expected: build exits 0. Start the production server in a background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`
  Wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200`.
  Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='before'; $env:PW_STAGE='S10'; npx playwright test tests/tools/stage-screens.spec.ts`
  Expected: PNGs in `test-artifacts/stage-screens/S10-before/` for widths 320, 375, 768, 1024, 1440. (S01 creates the tool first; S01 runs this step after its Task 1.)
- [ ] **Step 6: Baseline suite.** With the server still running: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test`
  Expected: record "N passed / M skipped / 0 failed" in the stage summary. Then stop the server (Step 4 command) and clear the flags: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.

**S10 notes on the standard steps above**
- Step 1: the "Gated by" list is approvals 5 and 12. Approval 5 `pending`/`rejected` → Tasks A1–A6 and B1 SKIPPED (fallback: Execution Order row A). Approval 12 `pending`/`rejected` → C1–C2 SKIPPED and C1F–C2F run (they are the fallback); `approved` → C1F–C2F SKIPPED and C1–C2 run once C1 Step 2's log rule passes.
- Step 2: expected `merge: S01 …` (the only "Depends on" stage for Parts A and C). `merge: S03 …` is needed only by Part B and is checked in Task B1 Step 2. When S10 runs after many other stages, the S01 merge can be older than the last 40 commits; then confirm it with `git log --oneline claude/tipoasis-tracking-renewal-ae0e3a --grep='merge: S01'` (one line).
- Step 3: on a follow-up run the branch name already exists locally; delete it first as "Execution Order and Gating" describes (`git branch -D renewal/s10-r4-server-path`), or use the part's own `git switch -C` step (B1 Step 3, C1 Step 3, C1F Step 2).
- Step 5 and gate G7: the output paths are the roadmap §6/§7 text with S01's Addition 1 applied (`test-artifacts/stage-screens/S10-<before|after>/`, not `test-results/…`: Playwright empties `test-results/` at the start of every run, so Step 6 would delete the before-set). Check after Step 5: `(Get-ChildItem test-artifacts/stage-screens/S10-before -Filter *.png).Count` prints (number of `SCENARIOS` in `tests/tools/stage-screens.spec.ts`) × 5 — 35 right after S01, more once later stages appended scenarios; record the count in the stage summary.

- [ ] **Step 7 (S10): Skip work that already exists.** Run: `git log --oneline claude/tipoasis-tracking-renewal-ae0e3a | Select-String -Pattern 'lookup deadline|lookup log|UNI-PASS stub|two waves|UNI-PASS outage|client lookup timeout|InsForge|proxy shared secret'`
  Expected: no output. Each hit names a task that is already merged (match the commit message in that task's last step); mark it DONE-EARLIER in the stage summary and skip it.
- [ ] **Step 8 (S10): Real numbers are gone from the files S10 edits.** Run: `Select-String -Path tests/track-api.spec.ts, app/api/track/route.ts, lib/services/customs.ts, lib/services/customstrack.ts -Pattern '\d{10,}' | ForEach-Object { $_.Line.Trim() }`
  Expected: no output, or only lines whose 10+ digit runs start with `0000` (S01 fixtures). Anything else → stop: S01's number replacement is not merged; report to the operator.

---

## Part A — Server path (approval 5)

### Task A1: Lookup deadline helper

> **GATED — approval 5.**

**Files:**
- Create: `lib/services/lookup-budget.ts`
- Test: `tests/unit/lookup-budget.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (S10-private, server-only):
  - `LOOKUP_TIMING: { budgetMs: 15000; responseMarginMs: 500; unipassCallMs: 8000; customstrackMs: 4000; proxyMs: 5000; customsGraceAfterCarrierMs: 2000 }` (`as const`)
  - `LOOKUP_CACHE_SECONDS: { result: 900; pending: 300; notFound: 120 }` (`as const`)
  - `interface LookupDeadline { budgetMs: number; elapsedMs(): number; remainingMs(): number; signal(capMs: number): AbortSignal; whenExpired(): Promise<void>; cancel(): void }`
  - `createLookupDeadline(budgetMs?: number /* default 14500 */, clock?: () => number): LookupDeadline`
  - `withinMs<T>(promise: Promise<T>, ms: number): Promise<T | null>`

- [ ] **Step 1: Confirm approval 5 is recorded; if not, stop.** In roadmap §4 row 5 the Status must be `approved`. Otherwise mark Tasks A1–A6 SKIPPED ("approval 5 pending") in the stage summary and go to Part C (C1 Step 1). Fallback while not approved: see "Execution Order and Gating", row A.

- [ ] **Step 2: Write the failing test** — create `tests/unit/lookup-budget.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import {
  LOOKUP_CACHE_SECONDS,
  LOOKUP_TIMING,
  createLookupDeadline,
  withinMs
} from "@/lib/services/lookup-budget";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const reasonName = (signal: AbortSignal): string => {
  const reason: unknown = signal.reason;
  return typeof reason === "object" && reason !== null && "name" in reason && typeof reason.name === "string"
    ? reason.name
    : "none";
};

test("the request budget is 15 s and every fallback path fits inside it", () => {
  expect(LOOKUP_TIMING.budgetMs).toBe(15_000);
  expect(
    LOOKUP_TIMING.unipassCallMs + LOOKUP_TIMING.customstrackMs + LOOKUP_TIMING.responseMarginMs
  ).toBeLessThanOrEqual(LOOKUP_TIMING.budgetMs);
  expect(LOOKUP_TIMING.unipassCallMs + LOOKUP_TIMING.proxyMs + LOOKUP_TIMING.responseMarginMs).toBeLessThanOrEqual(
    LOOKUP_TIMING.budgetMs
  );
  expect(LOOKUP_TIMING.customsGraceAfterCarrierMs).toBeLessThanOrEqual(3_000);
});

test("NOT_FOUND is cached briefly and never longer than a real result", () => {
  expect(LOOKUP_CACHE_SECONDS.notFound).toBeGreaterThanOrEqual(60);
  expect(LOOKUP_CACHE_SECONDS.notFound).toBeLessThanOrEqual(300);
  expect(LOOKUP_CACHE_SECONDS.notFound).toBeLessThanOrEqual(LOOKUP_CACHE_SECONDS.pending);
  expect(LOOKUP_CACHE_SECONDS.pending).toBeLessThanOrEqual(LOOKUP_CACHE_SECONDS.result);
});

test("remaining time follows the injected clock", () => {
  let fakeNow = 1_000;
  const deadline = createLookupDeadline(10_000, () => fakeNow);
  try {
    expect(deadline.remainingMs()).toBe(10_000);
    fakeNow = 1_400;
    expect(deadline.elapsedMs()).toBe(400);
    expect(deadline.remainingMs()).toBe(9_600);
    fakeNow = 12_000;
    expect(deadline.remainingMs()).toBe(0);
  } finally {
    deadline.cancel();
  }
});

test("a call signal aborts after its cap with a TimeoutError", async () => {
  const deadline = createLookupDeadline(5_000);
  try {
    const signal = deadline.signal(50);
    expect(signal.aborted).toBe(false);
    await sleep(150);
    expect(signal.aborted).toBe(true);
    expect(reasonName(signal)).toBe("TimeoutError");
  } finally {
    deadline.cancel();
  }
});

test("a call signal never outlives the deadline", async () => {
  const deadline = createLookupDeadline(60);
  try {
    const signal = deadline.signal(10_000);
    await deadline.whenExpired();
    expect(signal.aborted).toBe(true);
    expect(deadline.remainingMs()).toBe(0);
  } finally {
    deadline.cancel();
  }
});

test("cancel aborts handed-out signals and ends the deadline", async () => {
  const deadline = createLookupDeadline(5_000);
  const signal = deadline.signal(4_000);
  deadline.cancel();
  await deadline.whenExpired();
  expect(signal.aborted).toBe(true);
  expect(reasonName(signal)).toBe("AbortError");
  expect(deadline.remainingMs()).toBe(0);
  deadline.cancel();
});

test("withinMs returns the value when it is fast and null when it is late", async () => {
  expect(await withinMs(Promise.resolve("fast"), 50)).toBe("fast");
  const late = new Promise<string>((resolve) => setTimeout(() => resolve("late"), 300));
  expect(await withinMs(late, 30)).toBeNull();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/lookup-budget.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `Cannot find module` for `lib/services/lookup-budget`.

- [ ] **Step 4: Write the implementation** — create `lib/services/lookup-budget.ts`:

```ts
/**
 * Time and cache limits for one POST /api/track request (spec §16 item 5, release R4).
 * Server-only: imported by app/api/track/route.ts and lib/services/*.
 */

export const LOOKUP_TIMING = {
  /** Wall-clock budget of one request, response included (spec: 전체 예산 15초). */
  budgetMs: 15_000,
  /** Kept free inside the budget for normalizing and serializing the answer. */
  responseMarginMs: 500,
  /** One UNI-PASS call, headers and body together (same cap as the pre-R4 per-call timeout). */
  unipassCallMs: 8_000,
  /** customstrack fallback, headers and body together. */
  customstrackMs: 4_000,
  /** InsForge proxy call (removed with approval 12). */
  proxyMs: 5_000,
  /** DOMESTIC: once a carrier answered with events, wait at most this long for customs. */
  customsGraceAfterCarrierMs: 2_000
} as const;

/** Server cache lifetimes in seconds. NOT_FOUND stays short so a newly registered HBL shows up within minutes. */
export const LOOKUP_CACHE_SECONDS = {
  result: 900,
  pending: 300,
  notFound: 120
} as const;

export interface LookupDeadline {
  readonly budgetMs: number;
  readonly elapsedMs: () => number;
  readonly remainingMs: () => number;
  /** Aborts after min(capMs, remainingMs()), when the deadline ends, or on cancel(). */
  readonly signal: (capMs: number) => AbortSignal;
  /** Resolves when the deadline ends or cancel() runs. */
  readonly whenExpired: () => Promise<void>;
  /** Ends the deadline now: aborts every signal handed out and clears the timer. Safe to call twice. */
  readonly cancel: () => void;
}

const DEFAULT_DEADLINE_MS = LOOKUP_TIMING.budgetMs - LOOKUP_TIMING.responseMarginMs;

export function createLookupDeadline(
  budgetMs: number = DEFAULT_DEADLINE_MS,
  clock: () => number = Date.now
): LookupDeadline {
  const startedAt = clock();
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException("Lookup budget exhausted", "TimeoutError"));
  }, Math.max(0, budgetMs));
  const expired = new Promise<void>((resolve) => {
    controller.signal.addEventListener("abort", () => resolve(), { once: true });
  });
  const remainingMs = (): number =>
    controller.signal.aborted ? 0 : Math.max(0, budgetMs - (clock() - startedAt));

  return {
    budgetMs,
    elapsedMs: () => clock() - startedAt,
    remainingMs,
    signal: (capMs) =>
      AbortSignal.any([controller.signal, AbortSignal.timeout(Math.max(1, Math.min(capMs, remainingMs())))]),
    whenExpired: () => expired,
    cancel: () => {
      clearTimeout(timer);
      if (!controller.signal.aborted) controller.abort(new DOMException("Lookup finished", "AbortError"));
    }
  };
}

/** Resolves with the promise's value, or null when `ms` passes first. */
export async function withinMs<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), Math.max(0, ms));
  });
  try {
    return await Promise.race([promise, late]);
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/lookup-budget.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `7 passed`.
Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```powershell
git add lib/services/lookup-budget.ts tests/unit/lookup-budget.spec.ts; git commit -m "feat: add lookup deadline helper for the track route"
```

---

### Task A2: Number-free lookup log line

> **GATED — approval 5.**

**Files:**
- Create: `lib/services/lookup-log.ts`
- Test: `tests/unit/lookup-log.spec.ts`

**Interfaces:**
- Consumes: `ApiError` from `@/lib/types`; test-only: `FAKE` from `tests/fixtures/tracking-fixtures.ts` (S01), `containsTrackingLikeValue` from `@/lib/privacy/number-patterns` (S01).
- Produces (S10-private, server-only):
  - `type UnipassCallOutcome = "ok" | "fail"`
  - `LOOKUP_RESULT_KINDS` / `type LookupResultKind = "found" | "carrierFirst" | "pending" | "lookupUnavailable" | "ambiguous" | "notFound" | "notFoundCached" | "cached" | "allFailed" | "invalid" | "rateLimited" | "error"`
  - `type ElapsedBucket = "lt1s" | "1to3s" | "3to6s" | "6to10s" | "10to15s" | "ge15s"`
  - `interface LookupLogRecord { route: "/api/track"; elapsedBucket: ElapsedBucket; unipassOk: number; unipassFail: number; resultKind: LookupResultKind; errorCode: ApiError["code"] | null }`
  - `LOOKUP_LOG_EVENT = "track_lookup"`, `elapsedBucket(ms): ElapsedBucket`, `formatLookupLog(record): string`, `logLookup(record): void`, `setLookupLogSink(sink: ((line: string) => void) | null): void`
  - `interface UnipassTally { record(outcome: UnipassCallOutcome): void; snapshot(): { ok: number; fail: number } }`, `createUnipassTally(): UnipassTally`

- [ ] **Step 1: Confirm approval 5 is recorded; if not, stop.** Same check as Task A1 Step 1.

- [ ] **Step 2: Write the failing test** — create `tests/unit/lookup-log.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import {
  LOOKUP_LOG_EVENT,
  createUnipassTally,
  elapsedBucket,
  formatLookupLog,
  logLookup,
  setLookupLogSink,
  type LookupLogRecord
} from "@/lib/services/lookup-log";
import { FAKE } from "../fixtures/tracking-fixtures";

const base: LookupLogRecord = {
  route: "/api/track",
  elapsedBucket: "1to3s",
  unipassOk: 12,
  unipassFail: 0,
  resultKind: "notFound",
  errorCode: "NOT_FOUND"
};

test("elapsed time falls into the six fixed buckets", () => {
  const cases: ReadonlyArray<readonly [number, string]> = [
    [0, "lt1s"],
    [999, "lt1s"],
    [1_000, "1to3s"],
    [2_999, "1to3s"],
    [3_000, "3to6s"],
    [5_999, "3to6s"],
    [6_000, "6to10s"],
    [9_999, "6to10s"],
    [10_000, "10to15s"],
    [14_999, "10to15s"],
    [15_000, "ge15s"],
    [Number.NaN, "ge15s"],
    [-5, "lt1s"]
  ];
  for (const [ms, bucket] of cases) expect(elapsedBucket(ms), String(ms)).toBe(bucket);
});

test("a log line is the event name plus exactly the six spec fields", () => {
  const line = formatLookupLog(base);
  expect(line.startsWith(`${LOOKUP_LOG_EVENT} `)).toBe(true);
  const parsed: unknown = JSON.parse(line.slice(LOOKUP_LOG_EVENT.length + 1));
  expect(parsed).toEqual(base);
  expect(Object.keys(parsed as Record<string, unknown>)).toEqual([
    "route",
    "elapsedBucket",
    "unipassOk",
    "unipassFail",
    "resultKind",
    "errorCode"
  ]);
});

test("extra fields and odd values never reach the line", () => {
  const leaky = { ...base, unipassOk: -1, unipassFail: 1.5, trackingNumber: FAKE.hbl, phone: FAKE.phone };
  const bogusKind = { ...base, resultKind: FAKE.hbl, errorCode: FAKE.domestic } as unknown as LookupLogRecord;
  for (const line of [formatLookupLog(leaky), formatLookupLog(bogusKind)]) {
    expect(line).not.toContain(FAKE.hbl);
    expect(line).not.toContain(FAKE.domestic);
    expect(line).not.toContain("0000-1234");
    expect(containsTrackingLikeValue(line)).toBe(false);
  }
  expect(formatLookupLog(leaky)).toContain('"unipassOk":0,"unipassFail":0');
  expect(formatLookupLog(bogusKind)).toContain('"resultKind":"error","errorCode":"SERVER_ERROR"');
  expect(formatLookupLog({ ...base, unipassOk: 5_000 })).toContain('"unipassOk":999');
});

test("logLookup writes through the sink and survives a failing sink", () => {
  const lines: string[] = [];
  try {
    setLookupLogSink((line) => {
      lines.push(line);
    });
    logLookup(base);
    expect(lines).toEqual([formatLookupLog(base)]);
    setLookupLogSink(() => {
      throw new Error("sink down");
    });
    expect(() => logLookup(base)).not.toThrow();
  } finally {
    setLookupLogSink(null);
  }
});

test("the UNI-PASS tally counts answered and failed calls", () => {
  const tally = createUnipassTally();
  tally.record("ok");
  tally.record("ok");
  tally.record("fail");
  expect(tally.snapshot()).toEqual({ ok: 2, fail: 1 });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/lookup-log.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `Cannot find module` for `lib/services/lookup-log`.

- [ ] **Step 4: Write the implementation** — create `lib/services/lookup-log.ts`:

```ts
import type { ApiError } from "@/lib/types";

/**
 * One number-free log line per POST /api/track request (spec §11 "2단계").
 * Only enums and small integers: never a tracking number, phone, IP, UA, URL or free text.
 */

/** "ok" = 2xx with the UNI-PASS envelope; "fail" = timeout, network error, non-2xx or unreadable body. */
export type UnipassCallOutcome = "ok" | "fail";

export const LOOKUP_RESULT_KINDS = [
  "found",
  "carrierFirst",
  "pending",
  "lookupUnavailable",
  "ambiguous",
  "notFound",
  "notFoundCached",
  "cached",
  "allFailed",
  "invalid",
  "rateLimited",
  "error"
] as const;
export type LookupResultKind = (typeof LOOKUP_RESULT_KINDS)[number];

const ELAPSED_BUCKETS = ["lt1s", "1to3s", "3to6s", "6to10s", "10to15s", "ge15s"] as const;
export type ElapsedBucket = (typeof ELAPSED_BUCKETS)[number];

const ERROR_CODES: readonly ApiError["code"][] = [
  "INVALID_NUMBER",
  "API_TIMEOUT",
  "NOT_FOUND",
  "SERVER_ERROR",
  "RATE_LIMITED"
];

export interface LookupLogRecord {
  readonly route: "/api/track";
  readonly elapsedBucket: ElapsedBucket;
  readonly unipassOk: number;
  readonly unipassFail: number;
  readonly resultKind: LookupResultKind;
  readonly errorCode: ApiError["code"] | null;
}

export const LOOKUP_LOG_EVENT = "track_lookup";

const MAX_COUNT = 999;
const BUCKET_UPPER_BOUNDS: ReadonlyArray<readonly [number, ElapsedBucket]> = [
  [1_000, "lt1s"],
  [3_000, "1to3s"],
  [6_000, "3to6s"],
  [10_000, "6to10s"],
  [15_000, "10to15s"]
];

export function elapsedBucket(ms: number): ElapsedBucket {
  if (Number.isNaN(ms)) return "ge15s";
  const safe = Math.max(0, ms);
  return BUCKET_UPPER_BOUNDS.find(([upper]) => safe < upper)?.[1] ?? "ge15s";
}

const pick = <T extends string>(allowed: readonly T[], value: string, fallback: T): T =>
  allowed.find((item) => item === value) ?? fallback;

const toCount = (value: number): number => (Number.isInteger(value) && value >= 0 ? Math.min(value, MAX_COUNT) : 0);

/** Copies only the six spec fields and re-checks every value, so a caller can never leak data into the line. */
export function formatLookupLog(record: LookupLogRecord): string {
  const line: LookupLogRecord = {
    route: "/api/track",
    elapsedBucket: pick(ELAPSED_BUCKETS, record.elapsedBucket, "ge15s"),
    unipassOk: toCount(record.unipassOk),
    unipassFail: toCount(record.unipassFail),
    resultKind: pick(LOOKUP_RESULT_KINDS, record.resultKind, "error"),
    errorCode: record.errorCode === null ? null : pick(ERROR_CODES, record.errorCode, "SERVER_ERROR")
  };
  return `${LOOKUP_LOG_EVENT} ${JSON.stringify(line)}`;
}

type LogSink = (line: string) => void;
const consoleSink: LogSink = (line) => {
  console.info(line);
};
let activeSink: LogSink = consoleSink;

/** Test seam: capture lines instead of printing them. `null` restores console.info. */
export function setLookupLogSink(sink: LogSink | null): void {
  activeSink = sink ?? consoleSink;
}

/** Writes one line per request. A failing sink never breaks the customer's answer. */
export function logLookup(record: LookupLogRecord): void {
  try {
    activeSink(formatLookupLog(record));
  } catch {
    // Logging is best effort by design: the lookup response must not depend on the log sink.
  }
}

export interface UnipassTally {
  readonly record: (outcome: UnipassCallOutcome) => void;
  readonly snapshot: () => { readonly ok: number; readonly fail: number };
}

export function createUnipassTally(): UnipassTally {
  const counts = { ok: 0, fail: 0 };
  return {
    record: (outcome) => {
      counts[outcome] += 1;
    },
    snapshot: () => ({ ok: counts.ok, fail: counts.fail })
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/lookup-log.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `5 passed`.
Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```powershell
git add lib/services/lookup-log.ts tests/unit/lookup-log.spec.ts; git commit -m "feat: add number-free lookup log line"
```

---

### Task A3: UNI-PASS stub and route latency harness (red)

> **GATED — approval 5.**

**Files:**
- Create: `tests/support/unipass-stub.ts` (port of `<scratchpad>/phase1/gap-GAP2/stub-net.cjs`, fixture numbers only)
- Create: `tests/unit/track-route-latency.spec.ts`

**Interfaces:**
- Consumes: `POST` from `@/app/api/track/route`; `ApiTrackResponseSchema` from `@/lib/schemas`; `DeliveryCarrierCode` from `@/lib/types`.
- Produces (test-only):
  - `STUB_UNIPASS_URL`, `STUB_PROXY_URL`, `STUB_YEAR: number`
  - `type UnipassMode = "ok" | "timeout" | "http500" | "refused" | "bodyStall"`, `type UnipassParam = "hblNo" | "mblNo" | "cargMtNo"`, `type StubNumberKind = "HBL" | "DOMESTIC" | "CARGO"`
  - `interface UpstreamScenario { number; unipass: { mode; latencyMs; failYearOffsets? }; found?: { param; yearOffset }; customstrack?: { mode: "empty" | "timeout"; latencyMs }; carriers?: { mode: "ok" | "timeout" | "unavailable"; latencyMs; cjFound }; proxy?: { mode: "unavailable503" | "timeout"; latencyMs } }`
  - `interface UpstreamCalls { unipass; unipassAborted; unipassYears: readonly number[]; proxy; customstrack; carriers }`
  - `interface StubOptions { apiKey?: boolean; proxy?: boolean }`, `interface UpstreamStub { calls(number): UpstreamCalls; restore(): void }`
  - `stubNumber(kind, seq): string` (HBL `TEST0000dddd`, DOMESTIC `00000000dddd`, CARGO `00000000000000dddd`)
  - `installUpstreamStub(scenarios, options?)`, `withUpstreams(scenarios, run, options?)`
  - `interface TrackCall { status; ms; payload }`, `callTrack(number, carrierCode?)`, `dataOf(call)`, `errorCodeOf(call)`, `recordBudget(name, measuredMs, limitMs)`

- [ ] **Step 1: Confirm approval 5 is recorded; if not, stop.** Same check as Task A1 Step 1.

- [ ] **Step 2: Create the stub** — `tests/support/unipass-stub.ts`:

```ts
import { test } from "@playwright/test";
import type { z } from "zod";
import { POST } from "@/app/api/track/route";
import { ApiTrackResponseSchema } from "@/lib/schemas";
import type { DeliveryCarrierCode } from "@/lib/types";

/**
 * Port of the Phase 1 GAP2 stub-net.cjs. Every upstream the /api/track route can reach (UNI-PASS, the InsForge
 * proxy, customstrack, the five carriers) is simulated in-process with injected latency; any other host throws, so
 * nothing leaves the test process. Scenarios are keyed by fixture numbers only (see stubNumber).
 */

export const STUB_UNIPASS_URL = "https://unipass.stub/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo";
export const STUB_PROXY_URL = "https://proxy.stub/functions/unipass-proxy";
export const STUB_YEAR = new Date().getFullYear();

export type UnipassMode = "ok" | "timeout" | "http500" | "refused" | "bodyStall";
export type UnipassParam = "hblNo" | "mblNo" | "cargMtNo";
export type StubNumberKind = "HBL" | "DOMESTIC" | "CARGO";

export interface UpstreamScenario {
  readonly number: string;
  readonly unipass: { readonly mode: UnipassMode; readonly latencyMs: number; readonly failYearOffsets?: readonly number[] };
  readonly found?: { readonly param: UnipassParam; readonly yearOffset: number };
  readonly customstrack?: { readonly mode: "empty" | "timeout"; readonly latencyMs: number };
  readonly carriers?: { readonly mode: "ok" | "timeout" | "unavailable"; readonly latencyMs: number; readonly cjFound: boolean };
  readonly proxy?: { readonly mode: "unavailable503" | "timeout"; readonly latencyMs: number };
}

export interface UpstreamCalls {
  readonly unipass: number;
  readonly unipassAborted: number;
  readonly unipassYears: readonly number[];
  readonly proxy: number;
  readonly customstrack: number;
  readonly carriers: number;
}

export interface StubOptions {
  /** Default true: UNIPASS_API_KEY is set to a stub value. */
  readonly apiKey?: boolean;
  /** Default false: UNIPASS_PROXY_URL is unset. */
  readonly proxy?: boolean;
}

export interface UpstreamStub {
  readonly calls: (number: string) => UpstreamCalls;
  readonly restore: () => void;
}

// prcsDttm uses the "yyyy-MM-dd HH:mm:ss" form that parseCustomsDatetime also accepts, so this file holds no 10+ digit run.
const FOUND_XML =
  '<?xml version="1.0" encoding="UTF-8"?><cargCsclPrgsInfoQryRtnVo><tCnt>1</tCnt>' +
  "<cargCsclPrgsInfoQryVo><csclPrgsStts>수입신고수리</csclPrgsStts><prgsStts>반출완료</prgsStts><prcsDttm>2026-09-23 10:05:00</prcsDttm><etprCstmNm>인천공항세관</etprCstmNm></cargCsclPrgsInfoQryVo>" +
  "<cargCsclPrgsInfoDtlQryVo><cargTrcnRelaBsopTpcd>입항보고 수리</cargTrcnRelaBsopTpcd><prcsDttm>2026-09-22 08:40:00</prcsDttm><shedNm>인천공항</shedNm></cargCsclPrgsInfoDtlQryVo>" +
  "<cargCsclPrgsInfoDtlQryVo><cargTrcnRelaBsopTpcd>수입신고수리</cargTrcnRelaBsopTpcd><prcsDttm>2026-09-23 10:05:00</prcsDttm><shedNm>인천공항</shedNm></cargCsclPrgsInfoDtlQryVo>" +
  "</cargCsclPrgsInfoQryRtnVo>";
const EMPTY_XML =
  '<?xml version="1.0" encoding="UTF-8"?><cargCsclPrgsInfoQryRtnVo><tCnt>0</tCnt><ntceInfo>[N00] 조회결과가 없습니다.</ntceInfo></cargCsclPrgsInfoQryRtnVo>';
const CJ_FOUND = JSON.stringify({
  resultCode: "200",
  data: {
    svcOutList: [
      { crgStDnm: "집화처리", crgStDcdVal: "보내시는 고객님으로부터 상품을 인수받았습니다", branNm: "인천GW", workDt: "2026-09-24", workHms: "09:10:00" },
      { crgStDnm: "배송출발", crgStDcdVal: "고객님의 상품을 배송할 예정입니다", branNm: "서울강남", workDt: "2026-09-26", workHms: "08:15:00" }
    ]
  }
});
const CJ_EMPTY = JSON.stringify({ resultCode: "200", data: { svcOutList: [] } });
const EMPTY_HTML = "<html><body><p>조회 결과가 없습니다.</p></body></html>";

const DEFAULT_CUSTOMSTRACK = { mode: "empty", latencyMs: 1_000 } as const;
const DEFAULT_CARRIERS = { mode: "ok", latencyMs: 800, cjFound: false } as const;
const DEFAULT_PROXY = { mode: "unavailable503", latencyMs: 300 } as const;
const FOREVER_MS = 60 * 60 * 1000;
const CARRIER_HOSTS = ["service.epost.go.kr", "www.hanjin.com", "www.lotteglogis.com", "www.ilogen.com"];

interface MutableCalls {
  unipass: number;
  unipassAborted: number;
  unipassYears: number[];
  proxy: number;
  customstrack: number;
  carriers: number;
}

const abortReason = (signal?: AbortSignal | null): unknown => {
  const reason: unknown = signal?.reason;
  return reason instanceof Error ? reason : new DOMException("This operation was aborted", "AbortError");
};

const delay = (ms: number, signal?: AbortSignal | null): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(abortReason(signal));
      },
      { once: true }
    );
  });

const urlOf = (input: RequestInfo | URL): URL =>
  new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);

const bodyText = (init?: RequestInit): string => (typeof init?.body === "string" ? init.body : "");

const carrierNumber = (url: URL): string =>
  [...url.searchParams.values()].find((value) => /^\d+$/.test(value)) ?? url.pathname.split("/").pop() ?? "";

const setEnv = (name: string, value: string | undefined): void => {
  if (value === undefined) Reflect.deleteProperty(process.env, name);
  else process.env[name] = value;
};

/** Fixture-only numbers: HBL 'TEST' + 8 digits, DOMESTIC 12 digits, CARGO 18 digits, all digit runs start with 0000. */
export function stubNumber(kind: StubNumberKind, seq: number): string {
  const digits = String(seq).padStart(4, "0");
  if (kind === "HBL") return `TEST0000${digits}`;
  if (kind === "DOMESTIC") return `00000000${digits}`;
  return `00000000000000${digits}`;
}

export function installUpstreamStub(scenarios: readonly UpstreamScenario[], options: StubOptions = {}): UpstreamStub {
  const byNumber = new Map(scenarios.map((scenario) => [scenario.number, scenario]));
  const calls = new Map<string, MutableCalls>();
  const record = (number: string): MutableCalls => {
    const existing = calls.get(number);
    if (existing) return existing;
    const created: MutableCalls = { unipass: 0, unipassAborted: 0, unipassYears: [], proxy: 0, customstrack: 0, carriers: 0 };
    calls.set(number, created);
    return created;
  };
  const scenarioFor = (number: string): UpstreamScenario => {
    const scenario = byNumber.get(number);
    if (!scenario) throw new Error("no stub scenario for this number");
    return scenario;
  };

  const unipass = async (url: URL, signal?: AbortSignal | null): Promise<Response> => {
    const param = (["hblNo", "mblNo", "cargMtNo"] as const).find((key) => url.searchParams.has(key));
    const number = param ? (url.searchParams.get(param) ?? "") : "";
    const scenario = scenarioFor(number);
    const year = Number(url.searchParams.get("blYy"));
    const counter = record(number);
    counter.unipass += 1;
    counter.unipassYears.push(year);
    const { mode, latencyMs, failYearOffsets = [] } = scenario.unipass;
    try {
      if (mode === "timeout") await delay(FOREVER_MS, signal);
      if (mode === "bodyStall") return new Response(new ReadableStream<Uint8Array>(), { status: 200 });
      await delay(latencyMs, signal);
    } catch (error) {
      counter.unipassAborted += 1;
      throw error;
    }
    if (mode === "refused") throw new TypeError("fetch failed");
    if (mode === "http500" || failYearOffsets.includes(year - STUB_YEAR)) {
      return new Response("Internal Server Error", { status: 500 });
    }
    const found =
      scenario.found !== undefined && scenario.found.param === param && year === STUB_YEAR + scenario.found.yearOffset;
    return new Response(found ? FOUND_XML : EMPTY_XML, { status: 200, headers: { "content-type": "application/xml" } });
  };

  const proxy = async (init?: RequestInit): Promise<Response> => {
    const parsed: unknown = JSON.parse(bodyText(init));
    const number =
      typeof parsed === "object" && parsed !== null && "trackingNumber" in parsed && typeof parsed.trackingNumber === "string"
        ? parsed.trackingNumber
        : "";
    const scenario = scenarioFor(number);
    record(number).proxy += 1;
    const { mode, latencyMs } = scenario.proxy ?? DEFAULT_PROXY;
    await delay(mode === "timeout" ? FOREVER_MS : latencyMs, init?.signal);
    return new Response("No backend services available for app", { status: 503 });
  };

  const customstrack = async (url: URL, signal?: AbortSignal | null): Promise<Response> => {
    const number = decodeURIComponent(url.pathname.slice(1));
    const scenario = scenarioFor(number);
    record(number).customstrack += 1;
    const { mode, latencyMs } = scenario.customstrack ?? DEFAULT_CUSTOMSTRACK;
    await delay(mode === "timeout" ? FOREVER_MS : latencyMs, signal);
    return new Response(EMPTY_HTML, { status: 200, headers: { "content-type": "text/html" } });
  };

  const carrier = async (number: string, isCj: boolean, signal?: AbortSignal | null): Promise<Response> => {
    const scenario = scenarioFor(number);
    record(number).carriers += 1;
    const { mode, latencyMs, cjFound } = scenario.carriers ?? DEFAULT_CARRIERS;
    await delay(mode === "timeout" ? FOREVER_MS : latencyMs, signal);
    if (mode === "unavailable") return new Response("service unavailable", { status: 503 });
    if (isCj) {
      return new Response(cjFound ? CJ_FOUND : CJ_EMPTY, { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(EMPTY_HTML, { status: 200, headers: { "content-type": "text/html" } });
  };

  const stubFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = urlOf(input);
    const signal = init?.signal;
    if (url.host === "unipass.stub") return unipass(url, signal);
    if (url.host === "proxy.stub") return proxy(init);
    if (url.host === "www.customstrack.com") return customstrack(url, signal);
    if (url.host === "trace.cjlogistics.com") {
      return carrier(new URLSearchParams(bodyText(init)).get("wblNo") ?? "", true, signal);
    }
    if (CARRIER_HOSTS.includes(url.host)) return carrier(carrierNumber(url), false, signal);
    throw new Error(`BLOCKED unexpected host ${url.host}`);
  };

  const saved = {
    key: process.env.UNIPASS_API_KEY,
    url: process.env.UNIPASS_API_URL,
    proxy: process.env.UNIPASS_PROXY_URL
  };
  const originalFetch = globalThis.fetch;
  setEnv("UNIPASS_API_KEY", options.apiKey === false ? undefined : "stub-key-not-real");
  setEnv("UNIPASS_API_URL", STUB_UNIPASS_URL);
  setEnv("UNIPASS_PROXY_URL", options.proxy === true ? STUB_PROXY_URL : undefined);
  globalThis.fetch = stubFetch;

  return {
    calls: (number) => {
      const counter = record(number);
      return { ...counter, unipassYears: [...counter.unipassYears] };
    },
    restore: () => {
      globalThis.fetch = originalFetch;
      setEnv("UNIPASS_API_KEY", saved.key);
      setEnv("UNIPASS_API_URL", saved.url);
      setEnv("UNIPASS_PROXY_URL", saved.proxy);
    }
  };
}

export async function withUpstreams(
  scenarios: readonly UpstreamScenario[],
  run: (stub: UpstreamStub) => Promise<void>,
  options: StubOptions = {}
): Promise<void> {
  const stub = installUpstreamStub(scenarios, options);
  try {
    await run(stub);
  } finally {
    stub.restore();
  }
}

export type TrackPayload = z.infer<typeof ApiTrackResponseSchema>;
type SuccessPayload = Extract<TrackPayload, { success: true }>;

export interface TrackCall {
  readonly status: number;
  readonly ms: number;
  readonly payload: TrackPayload;
}

let requestSeq = 0;

/** Calls the real route handler once, from a fresh client IP so the per-IP quota never interferes. */
export async function callTrack(number: string, carrierCode: DeliveryCarrierCode = "AUTO"): Promise<TrackCall> {
  requestSeq += 1;
  const request = new Request("http://localhost/api/track", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": `10.9.${Math.floor(requestSeq / 250)}.${requestSeq % 250}`
    },
    body: JSON.stringify({ trackingNumber: number, carrierCode })
  });
  const startedAt = Date.now();
  const response = await POST(request);
  const payload = ApiTrackResponseSchema.parse(await response.json());
  return { status: response.status, ms: Date.now() - startedAt, payload };
}

export const dataOf = (call: TrackCall): SuccessPayload["data"] | null => (call.payload.success ? call.payload.data : null);

export const errorCodeOf = (call: TrackCall): string | null => (call.payload.success ? null : call.payload.error.code);

/** Records a measured budget in the report (annotation) and on stdout for the stage summary (gate G8). */
export function recordBudget(name: string, measuredMs: number, limitMs: number): void {
  const description = `${name}: ${measuredMs} ms (limit ${limitMs} ms)`;
  test.info().annotations.push({ type: "budget", description });
  console.info(`[budget] ${description}`);
}
```

  **If Task C2F was merged before Part A** (the usual order, see "Execution Order and Gating"): run `Select-String -Path lib/services/customs.ts -Pattern 'x-proxy-secret'`. One line printed → apply C2F Step 4's stub edit to the file just created (add `export const STUB_PROXY_SECRET = "stub-proxy-secret";` below `STUB_PROXY_URL`, `secret: process.env.UNIPASS_PROXY_SECRET` to the `saved` object, `setEnv("UNIPASS_PROXY_SECRET", options.proxy === true ? STUB_PROXY_SECRET : undefined);` after the `UNIPASS_PROXY_URL` line, and `setEnv("UNIPASS_PROXY_SECRET", saved.secret);` in `restore`). No output → nothing to add.

- [ ] **Step 3: Write the failing latency tests** — create `tests/unit/track-route-latency.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import {
  callTrack,
  dataOf,
  errorCodeOf,
  recordBudget,
  stubNumber,
  withUpstreams,
  type UpstreamScenario
} from "../support/unipass-stub";

test.describe.configure({ mode: "parallel", timeout: 45_000 });

test.describe("POST /api/track latency (approval 5)", () => {
  test("NOT_FOUND answers within 3 s at UNI-PASS latency 0.3 s", async () => {
    const number = stubNumber("HBL", 101);
    await withUpstreams([{ number, unipass: { mode: "ok", latencyMs: 300 } }], async () => {
      const result = await callTrack(number);
      recordBudget("NOT_FOUND at UNI-PASS latency 0.3 s", result.ms, 3_000);
      expect(result.status).toBe(404);
      expect(errorCodeOf(result)).toBe("NOT_FOUND");
      expect(result.ms).toBeLessThanOrEqual(3_000);
    });
  });

  test("NOT_FOUND answers within 6 s at UNI-PASS latency 1.5 s", async () => {
    const number = stubNumber("HBL", 102);
    await withUpstreams([{ number, unipass: { mode: "ok", latencyMs: 1_500 } }], async () => {
      const result = await callTrack(number);
      recordBudget("NOT_FOUND at UNI-PASS latency 1.5 s", result.ms, 6_000);
      expect(result.status).toBe(404);
      expect(errorCodeOf(result)).toBe("NOT_FOUND");
      expect(result.ms).toBeLessThanOrEqual(6_000);
    });
  });

  test("a CARGO number without records answers within 6 s at 1.5 s", async () => {
    const number = stubNumber("CARGO", 103);
    await withUpstreams([{ number, unipass: { mode: "ok", latencyMs: 1_500 } }], async () => {
      const result = await callTrack(number);
      expect(result.status).toBe(404);
      expect(result.ms).toBeLessThanOrEqual(6_000);
    });
  });

  test("a DOMESTIC number before arrival answers pending within 6 s at 1.5 s", async () => {
    const number = stubNumber("DOMESTIC", 104);
    await withUpstreams([{ number, unipass: { mode: "ok", latencyMs: 1_500 } }], async () => {
      const result = await callTrack(number);
      recordBudget("DOMESTIC pending at UNI-PASS latency 1.5 s", result.ms, 6_000);
      expect(result.status).toBe(200);
      expect(dataOf(result)?.isPending).toBe(true);
      expect(result.ms).toBeLessThanOrEqual(6_000);
    });
  });

  test("a shipment from last year is found in the first wave", async () => {
    const number = stubNumber("HBL", 105);
    await withUpstreams(
      [{ number, unipass: { mode: "ok", latencyMs: 1_500 }, found: { param: "hblNo", yearOffset: -1 } }],
      async (stub) => {
        const result = await callTrack(number);
        expect(result.status).toBe(200);
        expect(result.ms).toBeLessThanOrEqual(2_500);
        expect(stub.calls(number).unipass).toBe(4);
      }
    );
  });

  test("a confirmed empty answer is asked once per year and parameter, never retried", async () => {
    const number = stubNumber("HBL", 106);
    await withUpstreams([{ number, unipass: { mode: "ok", latencyMs: 50 } }], async (stub) => {
      const result = await callTrack(number);
      expect(result.status).toBe(404);
      expect(stub.calls(number).unipass).toBe(12);
      expect(stub.calls(number).customstrack).toBe(1);
    });
  });

  test("a UNI-PASS outage answers API_TIMEOUT within 15 s instead of NOT_FOUND", async () => {
    const number = stubNumber("HBL", 107);
    await withUpstreams(
      [{ number, unipass: { mode: "timeout", latencyMs: 0 } }],
      async (stub) => {
        const result = await callTrack(number);
        recordBudget("UNI-PASS outage to API_TIMEOUT", result.ms, 15_000);
        expect(result.status).toBe(504);
        expect(errorCodeOf(result)).toBe("API_TIMEOUT");
        expect(result.ms).toBeLessThanOrEqual(15_000);
        const calls = stub.calls(number);
        expect(calls.unipass).toBe(4);
        expect(calls.customstrack).toBe(1);
        expect(calls.proxy).toBe(1);
      },
      { proxy: true }
    );
  });

  test("fast UNI-PASS errors answer API_TIMEOUT 503 quickly", async () => {
    const number = stubNumber("HBL", 108);
    await withUpstreams([{ number, unipass: { mode: "http500", latencyMs: 100 } }], async () => {
      const result = await callTrack(number);
      expect(result.status).toBe(503);
      expect(errorCodeOf(result)).toBe("API_TIMEOUT");
      expect(result.ms).toBeLessThanOrEqual(3_000);
    });
  });

  test("a stalled UNI-PASS body answers API_TIMEOUT within 15 s", async () => {
    const number = stubNumber("HBL", 109);
    await withUpstreams([{ number, unipass: { mode: "bodyStall", latencyMs: 0 } }], async () => {
      const result = await callTrack(number);
      expect(result.status).toBe(504);
      expect(errorCodeOf(result)).toBe("API_TIMEOUT");
      expect(result.ms).toBeLessThanOrEqual(15_000);
    });
  });

  test("a DOMESTIC carrier result is not held back by a slow customs lookup", async () => {
    const number = stubNumber("DOMESTIC", 110);
    await withUpstreams(
      [{ number, unipass: { mode: "timeout", latencyMs: 0 }, carriers: { mode: "ok", latencyMs: 800, cjFound: true } }],
      async (stub) => {
        const result = await callTrack(number);
        expect(result.status).toBe(200);
        expect(dataOf(result)?.currentStatus).toBe("배송출발");
        expect(dataOf(result)?.customs.events).toHaveLength(0);
        expect(result.ms).toBeLessThanOrEqual(3_500);
        await expect.poll(() => stub.calls(number).unipassAborted).toBe(6);
        // Not cached: the next lookup asks UNI-PASS again, so customs can fill in once it answers.
        const second = await callTrack(number);
        expect(second.status).toBe(200);
        expect(stub.calls(number).unipass).toBe(12);
        await expect.poll(() => stub.calls(number).unipassAborted).toBe(12);
      }
    );
  });

  test("DOMESTIC keeps customs events that arrive within the grace period", async () => {
    const number = stubNumber("DOMESTIC", 111);
    await withUpstreams(
      [
        {
          number,
          unipass: { mode: "ok", latencyMs: 1_500 },
          found: { param: "hblNo", yearOffset: 0 },
          carriers: { mode: "ok", latencyMs: 800, cjFound: true }
        }
      ],
      async () => {
        const result = await callTrack(number);
        expect(result.status).toBe(200);
        expect(dataOf(result)?.customs.events.length).toBeGreaterThan(0);
        expect(result.ms).toBeLessThanOrEqual(2_500);
      }
    );
  });

  test("DOMESTIC pending is not claimed while UNI-PASS is down", async () => {
    const number = stubNumber("DOMESTIC", 112);
    await withUpstreams([{ number, unipass: { mode: "http500", latencyMs: 100 } }], async () => {
      const result = await callTrack(number);
      expect(result.status).toBe(503);
      expect(errorCodeOf(result)).toBe("API_TIMEOUT");
    });
  });

  test("a carrier outage keeps the lookupUnavailable result with the official link even when UNI-PASS is down", async () => {
    const number = stubNumber("DOMESTIC", 113);
    await withUpstreams(
      [
        {
          number,
          unipass: { mode: "http500", latencyMs: 100 },
          carriers: { mode: "unavailable", latencyMs: 100, cjFound: false }
        }
      ],
      async () => {
        const result = await callTrack(number, "HANJIN");
        expect(result.status).toBe(200);
        expect(dataOf(result)?.currentStatus).toBe("조회 지연");
        expect(dataOf(result)?.delivery.lookupUnavailable).toBe(true);
        expect(dataOf(result)?.delivery.trackingUrl).toContain("hanjin.com");
      }
    );
  });

  test("a complete NOT_FOUND is cached briefly", async () => {
    const number = stubNumber("HBL", 114);
    await withUpstreams([{ number, unipass: { mode: "ok", latencyMs: 100 } }], async (stub) => {
      expect((await callTrack(number)).status).toBe(404);
      const before = stub.calls(number);
      const second = await callTrack(number);
      expect(second.status).toBe(404);
      expect(second.ms).toBeLessThanOrEqual(200);
      expect(stub.calls(number).unipass).toBe(before.unipass);
      expect(stub.calls(number).customstrack).toBe(before.customstrack);
    });
  });

  test("an incomplete NOT_FOUND is not cached", async () => {
    const number = stubNumber("HBL", 115);
    await withUpstreams(
      [{ number, unipass: { mode: "ok", latencyMs: 100, failYearOffsets: [1, -2, -3, -4] } }],
      async (stub) => {
        expect((await callTrack(number)).status).toBe(404);
        expect((await callTrack(number)).status).toBe(404);
        expect(stub.calls(number).unipass).toBe(24);
      }
    );
  });

  test("sequential lookups never leak concurrency slots", async () => {
    const scenarios = Array.from({ length: 25 }, (_, index): UpstreamScenario => ({
      number: stubNumber("HBL", 200 + index),
      unipass: { mode: "ok", latencyMs: 20 },
      found: { param: "hblNo", yearOffset: 0 }
    }));
    await withUpstreams(scenarios, async () => {
      for (const scenario of scenarios) {
        expect((await callTrack(scenario.number)).status).toBe(200);
      }
      // The same 25 again are cache hits (early return before any upstream call).
      for (const scenario of scenarios) {
        expect((await callTrack(scenario.number)).status).toBe(200);
      }
    });
  });

  test("carrier-first answers release their concurrency slots", async () => {
    const scenarios = Array.from({ length: 20 }, (_, index): UpstreamScenario => ({
      number: stubNumber("DOMESTIC", 400 + index),
      unipass: { mode: "timeout", latencyMs: 0 },
      carriers: { mode: "ok", latencyMs: 20, cjFound: true }
    }));
    const probe = stubNumber("HBL", 420);
    await withUpstreams(
      [...scenarios, { number: probe, unipass: { mode: "ok", latencyMs: 20 }, found: { param: "hblNo", yearOffset: 0 } }],
      async () => {
        // 20 at once fill the in-memory cap; each answers carrier-first after the grace period while UNI-PASS still hangs.
        const results = await Promise.all(scenarios.map((scenario) => callTrack(scenario.number)));
        for (const result of results) {
          expect(result.status).toBe(200);
          expect(result.ms).toBeLessThanOrEqual(3_500);
        }
        // If the carrier-first path kept its slot (e.g. until the background customs work ends), the 20 answers would
        // still hold the whole cap and this lookup would get 429.
        expect((await callTrack(probe)).status).toBe(200);
      }
    );
  });

  test("everything hanging still answers within 15 s", async () => {
    const number = stubNumber("DOMESTIC", 116);
    await withUpstreams(
      [
        {
          number,
          unipass: { mode: "timeout", latencyMs: 0 },
          customstrack: { mode: "timeout", latencyMs: 0 },
          carriers: { mode: "timeout", latencyMs: 0, cjFound: false }
        }
      ],
      async () => {
        const result = await callTrack(number);
        expect(result.ms).toBeLessThanOrEqual(15_000);
        expect(result.status).toBe(200);
        expect(dataOf(result)?.delivery.lookupUnavailable).toBe(true);
      }
    );
  });
});
```

- [ ] **Step 4: Run two fast tests against today's route to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/track-route-latency.spec.ts --grep "within 3 s at UNI-PASS latency 0.3 s|fast UNI-PASS errors"; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `2 failed` — the first with `Expected: <= 3000` and a received value around 7 000–8 000 (GAP2-01's 7.67 s), the second with `Expected: 503` / `Received: 404` (GAP2-03). Do not run the whole file yet: the outage tests take up to 45 s each against today's code.

- [ ] **Step 5: Typecheck and lint the new files**

Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Commit (red tests are committed with the harness on purpose; Tasks A4–A5 turn them green)**

```powershell
git add tests/support/unipass-stub.ts tests/unit/track-route-latency.spec.ts; git commit -m "test: add UNI-PASS stub and track route latency harness"
```

---

### Task A4: Two-wave UNI-PASS lookup under one deadline

> **GATED — approval 5.**

**Files:**
- Modify: `lib/services/customs.ts:1-4` (imports), `:172-183` (`parseCustomsEventsXml`), `:96-138` (`buildCustomsRequestUrlBatches`), `:185-262` (direct/proxy/`fetchCustomsEvents`) — the whole file is replaced below; `normalizeCustomsStatus` (`:6-37`) and the row helpers (`:39-170`) keep their exact code.
- Modify: `lib/services/customstrack.ts:1-4` (imports), `:100-108` (`fetchCustomstrackCustomsEvents`); parse code `:6-98` untouched.
- Test: `tests/unit/track-route-latency.spec.ts` (append a `describe`)

**Interfaces:**
- Consumes: `LOOKUP_TIMING`, `createLookupDeadline`, `LookupDeadline` (Task A1); `UnipassCallOutcome` (Task A2); `postJsonWithTimeout`, `readTextWithLimit` from `@/lib/services/http` (frozen).
- Produces:
  - `type CustomsLookupType = Exclude<TrackingType, "UNKNOWN">`
  - `type CustomsLookupResult = { kind: "found"; events: TrackingEvent[] } | { kind: "empty"; complete: boolean } | { kind: "unavailable"; timedOut: boolean } | { kind: "notConfigured" }`
  - `interface CustomsLookupOptions { deadline: LookupDeadline; onUnipassCall?: (outcome: UnipassCallOutcome) => void; onFirstWaveEmpty?: () => void }`
  - `lookupCustomsEvents(trackingNumber: string, type: CustomsLookupType, options: CustomsLookupOptions): Promise<CustomsLookupResult>` — never rejects
  - transitional `fetchCustomsEvents(trackingNumber, type): Promise<TrackingEvent[]>` (deleted in Task A5)
  - `interface CustomstrackOptions { timeoutMs?: number; signal?: AbortSignal }`, `fetchCustomstrackCustomsEvents(trackingNumber: string, options?: CustomstrackOptions): Promise<TrackingEvent[]>`

- [ ] **Step 1: Confirm approval 5 is recorded; if not, stop.** Same check as Task A1 Step 1.

- [ ] **Step 2: Write the failing customs tests.** In `tests/unit/track-route-latency.spec.ts` replace the import block at the top with:

```ts
import { expect, test } from "@playwright/test";
import { lookupCustomsEvents, type CustomsLookupType } from "@/lib/services/customs";
import { createLookupDeadline } from "@/lib/services/lookup-budget";
import {
  STUB_YEAR,
  callTrack,
  dataOf,
  errorCodeOf,
  recordBudget,
  stubNumber,
  withUpstreams,
  type UpstreamScenario
} from "../support/unipass-stub";
```

Then append at the end of the file:

```ts
const runCustoms = async (number: string, type: CustomsLookupType, budgetMs?: number) => {
  const deadline = createLookupDeadline(budgetMs);
  const outcomes: string[] = [];
  let firstWaveEmpty = 0;
  const startedAt = Date.now();
  try {
    const result = await lookupCustomsEvents(number, type, {
      deadline,
      onUnipassCall: (outcome) => {
        outcomes.push(outcome);
      },
      onFirstWaveEmpty: () => {
        firstWaveEmpty += 1;
      }
    });
    return {
      result,
      ms: Date.now() - startedAt,
      ok: outcomes.filter((outcome) => outcome === "ok").length,
      fail: outcomes.filter((outcome) => outcome === "fail").length,
      firstWaveEmpty
    };
  } finally {
    deadline.cancel();
  }
};

test.describe("customs lookup (two waves under one deadline)", () => {
  test("the first wave asks only the current and last year", async () => {
    const number = stubNumber("HBL", 301);
    await withUpstreams(
      [{ number, unipass: { mode: "ok", latencyMs: 300 }, found: { param: "hblNo", yearOffset: 0 } }],
      async (stub) => {
        const run = await runCustoms(number, "HBL");
        expect(run.result.kind).toBe("found");
        expect(run.ms).toBeLessThan(1_000);
        expect(run.ok).toBe(4);
        expect(run.firstWaveEmpty).toBe(0);
        const calls = stub.calls(number);
        expect([...calls.unipassYears].sort((a, b) => a - b)).toEqual([
          STUB_YEAR - 1,
          STUB_YEAR - 1,
          STUB_YEAR,
          STUB_YEAR
        ]);
        expect(calls.proxy).toBe(0);
      },
      { proxy: true }
    );
  });

  test("a confirmed empty answer is asked once per year and parameter", async () => {
    const number = stubNumber("HBL", 302);
    await withUpstreams([{ number, unipass: { mode: "ok", latencyMs: 50 } }], async (stub) => {
      const run = await runCustoms(number, "HBL");
      expect(run.result).toEqual({ kind: "empty", complete: true });
      expect(run.ok).toBe(12);
      expect(run.fail).toBe(0);
      expect(run.firstWaveEmpty).toBe(1);
      expect(stub.calls(number).unipass).toBe(12);
    });
  });

  test("when every call fails the result is unavailable, not empty", async () => {
    const number = stubNumber("HBL", 303);
    await withUpstreams([{ number, unipass: { mode: "http500", latencyMs: 50 } }], async (stub) => {
      const run = await runCustoms(number, "HBL");
      expect(run.result).toEqual({ kind: "unavailable", timedOut: false });
      expect(run.fail).toBe(4);
      expect(stub.calls(number).unipass).toBe(4);
    });
  });

  test("timeouts are reported as timed out and stop at the deadline", async () => {
    const number = stubNumber("HBL", 304);
    await withUpstreams([{ number, unipass: { mode: "timeout", latencyMs: 0 } }], async (stub) => {
      const run = await runCustoms(number, "HBL", 1_500);
      expect(run.result).toEqual({ kind: "unavailable", timedOut: true });
      expect(run.ms).toBeLessThanOrEqual(2_500);
      expect(stub.calls(number).unipassAborted).toBe(4);
    });
  });

  test("a stalled UNI-PASS body counts as a timeout", async () => {
    const number = stubNumber("HBL", 305);
    await withUpstreams([{ number, unipass: { mode: "bodyStall", latencyMs: 0 } }], async () => {
      const run = await runCustoms(number, "HBL", 1_500);
      expect(run.result).toEqual({ kind: "unavailable", timedOut: true });
      expect(run.ms).toBeLessThanOrEqual(2_500);
    });
  });

  test("without an API key and a proxy the lookup is notConfigured", async () => {
    const number = stubNumber("HBL", 306);
    await withUpstreams(
      [{ number, unipass: { mode: "ok", latencyMs: 50 } }],
      async (stub) => {
        const run = await runCustoms(number, "HBL");
        expect(run.result).toEqual({ kind: "notConfigured" });
        expect(run.firstWaveEmpty).toBe(1);
        expect(stub.calls(number).unipass).toBe(0);
      },
      { apiKey: false }
    );
  });
});
```

- [ ] **Step 3: Run the customs tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/track-route-latency.spec.ts --grep "customs lookup"; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `6 failed` with `TypeError: ... lookupCustomsEvents is not a function`.

- [ ] **Step 4: Replace `lib/services/customs.ts`.** First run `Select-String -Path lib/services/customs.ts -Pattern 'x-proxy-secret'` and write the result into the stage summary: one line printed means Task C2F (approval-12 fallback, variant B) was merged before Part A, and its server-side secret gate must survive this rewrite — after pasting the file below, apply C2F Step 4 **variant A** to it (the `PROXY_SECRET_HEADER` constant, the `proxySecret` gate in `lookupViaProxy` and the extra header argument of `postJsonWithTimeout`). No output → paste the file as is. Replace the file with:

```ts
import { parseStringPromise } from "xml2js";
import type { TrackingEvent, TrackingType } from "@/lib/types";
import { toIsoOrNow } from "@/lib/utils";
import { postJsonWithTimeout, readTextWithLimit } from "@/lib/services/http";
import { LOOKUP_TIMING, createLookupDeadline, type LookupDeadline } from "@/lib/services/lookup-budget";
import type { UnipassCallOutcome } from "@/lib/services/lookup-log";

export const normalizeCustomsStatus = (raw: string): TrackingEvent["statusCode"] => {
  const normalized = raw.replace(/\s+/g, "");

  if (
    normalized.includes("수입신고수리") ||
    normalized.includes("수리후반출") ||
    normalized.includes("반출신고") ||
    normalized.includes("통관완료")
  ) {
    return 4;
  }

  if (normalized.includes("수리전")) return 2;

  if (normalized.includes("결재통보") || normalized.includes("심사진행") || normalized.includes("심사중")) return 3;

  if (normalized.includes("입항") || normalized.includes("하선신고수리") || normalized.includes("입항보고수리")) return 1;

  if (
    normalized.includes("반입신고") ||
    normalized.includes("정정") ||
    normalized.includes("보정") ||
    normalized.includes("접수") ||
    normalized.includes("신고")
  ) {
    return 2;
  }

  if (normalized.includes("심사")) return 3;

  return 2;
};

type UnknownRecord = Record<string, unknown>;

const toRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === "object" ? (value as UnknownRecord) : null;

const getString = (node: UnknownRecord, key: string): string | undefined => {
  const value = node[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
};

const toObjectArray = (value: unknown): UnknownRecord[] => {
  if (Array.isArray(value)) {
    return value.map((item) => toRecord(item)).filter((item): item is UnknownRecord => Boolean(item));
  }

  const asRecord = toRecord(value);
  return asRecord ? [asRecord] : [];
};

const toFlatStringRecord = (node: UnknownRecord): Record<string, string> => {
  const out: Record<string, string> = {};
  Object.keys(node).forEach((key) => {
    const text = getString(node, key);
    if (text) out[key] = text;
  });
  return out;
};

const parseCustomsDatetime = (raw?: string): string => {
  if (!raw) return new Date().toISOString();

  if (/^\d{14}$/.test(raw)) {
    const y = raw.slice(0, 4);
    const m = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    const hh = raw.slice(8, 10);
    const mm = raw.slice(10, 12);
    const ss = raw.slice(12, 14);
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}+09:00`;
  }

  if (/^\d{8}$/.test(raw)) {
    const y = raw.slice(0, 4);
    const m = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    return `${y}-${m}-${d}T00:00:00+09:00`;
  }

  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(raw)) {
    return `${raw.replace(" ", "T")}+09:00`;
  }

  return toIsoOrNow(raw);
};

const mapRowsToEvents = (rows: Record<string, string>[]): TrackingEvent[] =>
  rows
    .map((row): TrackingEvent | null => {
      const status =
        row.csclPrgsStts || row.prgsStts || row.cargTrcnRelaBsopTpcd || row.cargTrcnRelaBsopTpcdNm || row.etprCstmNm;
      if (!status) return null;

      const datetimeRaw = row.prcsDttm || row.prgsDttm || row.dclrDttm || row.rlseDttm || row.etprDt;
      return {
        status,
        statusCode: normalizeCustomsStatus(status),
        datetime: parseCustomsDatetime(datetimeRaw),
        location: row.shedNm || row.locplc || row.entrPortNm || row.prnm || row.dsprNm || row.dclrNo,
        detail: row.rlbrCn || row.bfhnGdncCn || row.rlbrDttm || row.csclPrgsStts || row.dclrNo
      };
    })
    .filter((event): event is TrackingEvent => Boolean(event));

const dedupeEvents = (events: TrackingEvent[]): TrackingEvent[] => {
  const seen = new Set<string>();
  const deduped: TrackingEvent[] = [];

  events.forEach((event) => {
    const key = `${event.status}|${event.datetime}|${event.location ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(event);
  });

  return deduped;
};

const DEFAULT_UNIPASS_URL = "https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo";
const USER_AGENT = "Mozilla/5.0 tracking.tipoasis.com";
const MAX_XML_BYTES = 1_048_576;
/** Offsets from the current year. The first wave runs alone; the second only when the first found nothing. */
const FIRST_WAVE_YEAR_OFFSETS: readonly number[] = [0, -1];
const SECOND_WAVE_YEAR_OFFSETS: readonly number[] = [1, -2, -3, -4];

export type CustomsLookupType = Exclude<TrackingType, "UNKNOWN">;
type UnipassParam = "hblNo" | "mblNo" | "cargMtNo";

const PARAMS_BY_TYPE: Readonly<Record<CustomsLookupType, readonly UnipassParam[]>> = {
  HBL: ["hblNo", "mblNo"],
  DOMESTIC: ["hblNo", "mblNo", "cargMtNo"],
  CARGO: ["cargMtNo"]
};

export type CustomsLookupResult =
  | { readonly kind: "found"; readonly events: TrackingEvent[] }
  /** Every answer was a confirmed "no record"; complete = no call failed, so the route may cache NOT_FOUND. */
  | { readonly kind: "empty"; readonly complete: boolean }
  /** No confirmed UNI-PASS answer at all (timeouts, network errors, non-2xx, unreadable bodies). */
  | { readonly kind: "unavailable"; readonly timedOut: boolean }
  /** No UNIPASS_API_KEY and no proxy: local development. */
  | { readonly kind: "notConfigured" };

export interface CustomsLookupOptions {
  readonly deadline: LookupDeadline;
  readonly onUnipassCall?: (outcome: UnipassCallOutcome) => void;
  /** Called once when the first wave ended without events (or right away without a key); starts customstrack. */
  readonly onFirstWaveEmpty?: () => void;
}

type UnipassCall =
  | { readonly outcome: "answered"; readonly events: TrackingEvent[] }
  | { readonly outcome: "failed"; readonly timedOut: boolean };
type YearCalls = readonly UnipassCall[];

interface WaveRequest {
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly trackingNumber: string;
  readonly type: CustomsLookupType;
  readonly year: number;
}

const eventsFromParsedXml = (parsed: unknown): TrackingEvent[] => {
  const root = toRecord(parsed)?.cargCsclPrgsInfoQryRtnVo;
  const rootNode = toRecord(Array.isArray(root) ? root[0] : root) ?? toRecord(parsed);
  if (!rootNode) return [];

  const summaryRows = toObjectArray(rootNode.cargCsclPrgsInfoQryVo).map(toFlatStringRecord);
  const detailRows = toObjectArray(rootNode.cargCsclPrgsInfoDtlQryVo).map(toFlatStringRecord);
  return mapRowsToEvents([...detailRows, ...summaryRows]);
};

/** A UNI-PASS answer is "confirmed" only when it carries the cargCsclPrgsInfoQryRtnVo envelope. */
const readUnipassXml = async (xml: string): Promise<{ readonly confirmed: boolean; readonly events: TrackingEvent[] }> => {
  const parsed: unknown = await parseStringPromise(xml, { explicitArray: false, trim: true });
  return { confirmed: toRecord(parsed)?.cargCsclPrgsInfoQryRtnVo !== undefined, events: eventsFromParsedXml(parsed) };
};

const errorName = (error: unknown): string =>
  typeof error === "object" && error !== null && "name" in error && typeof error.name === "string" ? error.name : "";

const isTimeoutError = (error: unknown): boolean => ["AbortError", "TimeoutError"].includes(errorName(error));

const failedCall = (options: CustomsLookupOptions, timedOut: boolean): UnipassCall => {
  options.onUnipassCall?.("fail");
  return { outcome: "failed", timedOut };
};

/** One UNI-PASS call; headers and body share one cap that never outlives the request deadline. Never rejects. */
const fetchUnipassCall = async (url: string, options: CustomsLookupOptions): Promise<UnipassCall> => {
  const capMs = Math.min(LOOKUP_TIMING.unipassCallMs, options.deadline.remainingMs());
  if (capMs <= 0) return failedCall(options, true);
  const startedAt = Date.now();
  const signal = options.deadline.signal(capMs);
  try {
    const response = await fetch(url, { signal, cache: "no-store", headers: { "user-agent": USER_AGENT } });
    if (!response.ok) return failedCall(options, false);
    const xml = await readTextWithLimit(response, MAX_XML_BYTES, Math.max(1, capMs - (Date.now() - startedAt)));
    const answer = await readUnipassXml(xml);
    if (!answer.confirmed) return failedCall(options, false);
    options.onUnipassCall?.("ok");
    return { outcome: "answered", events: answer.events };
  } catch (error) {
    return failedCall(options, signal.aborted || isTimeoutError(error));
  }
};

const yearUrls = (request: WaveRequest, year: number): string[] =>
  PARAMS_BY_TYPE[request.type].map(
    (param) =>
      `${request.apiUrl}?${new URLSearchParams({ crkyCn: request.apiKey, blYy: String(year), [param]: request.trackingNumber }).toString()}`
  );

const runWave = (offsets: readonly number[], request: WaveRequest, options: CustomsLookupOptions): Promise<YearCalls[]> =>
  Promise.all(
    offsets.map((offset) =>
      Promise.all(yearUrls(request, request.year + offset).map((url) => fetchUnipassCall(url, options)))
    )
  );

/** Events of the first year (in wave order) that has any; later years are ignored so two shipments never mix. */
const firstYearEvents = (years: readonly YearCalls[]): TrackingEvent[] => {
  for (const calls of years) {
    const events = calls.flatMap((call) => (call.outcome === "answered" ? call.events : []));
    if (events.length > 0) return events;
  }
  return [];
};

const countAnswered = (years: readonly YearCalls[]): number =>
  years.reduce((sum, calls) => sum + calls.filter((call) => call.outcome === "answered").length, 0);

const countCalls = (years: readonly YearCalls[]): number => years.reduce((sum, calls) => sum + calls.length, 0);

const anyTimedOut = (years: readonly YearCalls[]): boolean =>
  years.some((calls) => calls.some((call) => call.outcome === "failed" && call.timedOut));

const toFound = (events: TrackingEvent[]): CustomsLookupResult => ({
  kind: "found",
  events: dedupeEvents(events).sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
});

/** Wave 1 = current and last year; wave 2 (the other four years, in parallel) only when wave 1 found nothing. */
const lookupDirect = async (request: WaveRequest, options: CustomsLookupOptions): Promise<CustomsLookupResult> => {
  const first = await runWave(FIRST_WAVE_YEAR_OFFSETS, request, options);
  const firstEvents = firstYearEvents(first);
  if (firstEvents.length > 0) return toFound(firstEvents);
  options.onFirstWaveEmpty?.();
  if (countAnswered(first) === 0) return { kind: "unavailable", timedOut: anyTimedOut(first) };

  const second = await runWave(SECOND_WAVE_YEAR_OFFSETS, request, options);
  const secondEvents = firstYearEvents(second);
  if (secondEvents.length > 0) return toFound(secondEvents);
  const all = [...first, ...second];
  return { kind: "empty", complete: countAnswered(all) === countCalls(all) };
};

const getProxyXml = (payload: unknown): string | null => {
  const node = toRecord(payload);
  return typeof node?.xml === "string" ? node.xml : null;
};

type DirectMiss = Extract<CustomsLookupResult, { kind: "unavailable" } | { kind: "notConfigured" }>;

const proxyMissed = (direct: DirectMiss, timedOut: boolean): CustomsLookupResult =>
  direct.kind === "unavailable"
    ? { kind: "unavailable", timedOut: direct.timedOut || timedOut }
    : { kind: "unavailable", timedOut };

/** InsForge proxy: only after every direct call failed (or without a key), bounded by the deadline. Approval 12 removes it. */
const lookupViaProxy = async (
  trackingNumber: string,
  type: CustomsLookupType,
  options: CustomsLookupOptions,
  direct: DirectMiss
): Promise<CustomsLookupResult> => {
  const proxyUrl = process.env.UNIPASS_PROXY_URL;
  const capMs = Math.min(LOOKUP_TIMING.proxyMs, options.deadline.remainingMs());
  if (!proxyUrl) return direct;
  if (capMs <= 0) return proxyMissed(direct, true);
  const startedAt = Date.now();
  try {
    const response = await postJsonWithTimeout(proxyUrl, { trackingNumber, type }, capMs);
    if (!response.ok) return proxyMissed(direct, false);
    const text = await readTextWithLimit(response, MAX_XML_BYTES, Math.max(1, capMs - (Date.now() - startedAt)));
    const xml = getProxyXml(JSON.parse(text) as unknown);
    const answer = xml ? await readUnipassXml(xml) : null;
    if (answer && answer.events.length > 0) return toFound(answer.events);
    return answer?.confirmed ? { kind: "empty", complete: false } : proxyMissed(direct, false);
  } catch (error) {
    return proxyMissed(direct, isTimeoutError(error));
  }
};

/** Looks up UNI-PASS in two waves under one deadline and classifies the outcome. Never rejects. */
export const lookupCustomsEvents = async (
  trackingNumber: string,
  type: CustomsLookupType,
  options: CustomsLookupOptions
): Promise<CustomsLookupResult> => {
  const apiKey = process.env.UNIPASS_API_KEY;
  if (!apiKey) {
    options.onFirstWaveEmpty?.();
    return lookupViaProxy(trackingNumber, type, options, { kind: "notConfigured" });
  }
  const request: WaveRequest = {
    apiUrl: process.env.UNIPASS_API_URL || DEFAULT_UNIPASS_URL,
    apiKey,
    trackingNumber,
    type,
    year: new Date().getFullYear()
  };
  const direct = await lookupDirect(request, options);
  return direct.kind === "unavailable" ? lookupViaProxy(trackingNumber, type, options, direct) : direct;
};

/** Transitional pre-R4 signature kept only until Task A5 switches app/api/track/route.ts; Task A5 deletes it. */
export const fetchCustomsEvents = async (trackingNumber: string, type: TrackingType): Promise<TrackingEvent[]> => {
  if (type === "UNKNOWN") return [];
  const deadline = createLookupDeadline();
  try {
    const result = await lookupCustomsEvents(trackingNumber, type, { deadline });
    return result.kind === "found" ? result.events : [];
  } finally {
    deadline.cancel();
  }
};
```

- [ ] **Step 5: Let customstrack take the deadline.** In `lib/services/customstrack.ts` replace lines 1–6:

```ts
import * as cheerio from "cheerio";
import type { TrackingEvent } from "@/lib/types";
import { fetchWithTimeout, readTextWithLimit } from "@/lib/services/http";
import { normalizeCustomsStatus } from "@/lib/services/customs";

const CUSTOMSTRACK_BASE_URL = "https://www.customstrack.com";
```

with:

```ts
import * as cheerio from "cheerio";
import type { TrackingEvent } from "@/lib/types";
import { readTextWithLimit } from "@/lib/services/http";
import { normalizeCustomsStatus } from "@/lib/services/customs";

const CUSTOMSTRACK_BASE_URL = "https://www.customstrack.com";
const USER_AGENT = "Mozilla/5.0 tracking.tipoasis.com";
const DEFAULT_TIMEOUT_MS = 12000;
const MAX_HTML_BYTES = 1_048_576;
```

and replace the exported function at the end of the file (old lines 100–108):

```ts
export const fetchCustomstrackCustomsEvents = async (trackingNumber: string): Promise<TrackingEvent[]> => {
  const response = await fetchWithTimeout(`${CUSTOMSTRACK_BASE_URL}/${encodeURIComponent(trackingNumber)}`, 12000);
  if (!response.ok) {
    return [];
  }

  const html = await readTextWithLimit(response, 1_048_576, 12000);
  return parseCustomstrackEvents(html);
};
```

with:

```ts
export interface CustomstrackOptions {
  /** Upper bound for headers and body together. Default 12 s (the pre-R4 value). */
  readonly timeoutMs?: number;
  /** Ends the request early, e.g. when the /api/track deadline ends. */
  readonly signal?: AbortSignal;
}

export const fetchCustomstrackCustomsEvents = async (
  trackingNumber: string,
  options: CustomstrackOptions = {}
): Promise<TrackingEvent[]> => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const response = await fetch(`${CUSTOMSTRACK_BASE_URL}/${encodeURIComponent(trackingNumber)}`, {
    signal,
    cache: "no-store",
    headers: { "user-agent": USER_AGENT }
  });
  if (!response.ok) {
    return [];
  }

  const html = await readTextWithLimit(response, MAX_HTML_BYTES, Math.max(1, timeoutMs - (Date.now() - startedAt)));
  return parseCustomstrackEvents(html);
};
```

- [ ] **Step 6: Run the customs tests and the existing API tests**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/track-route-latency.spec.ts --grep "customs lookup"; npx playwright test tests/track-api.spec.ts tests/delivery-carriers.spec.ts tests/customs-estimate.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `6 passed` for the customs describe; the existing API/carrier/estimate specs report 0 failed (the route still uses the transitional `fetchCustomsEvents`).
If Step 4 found `x-proxy-secret` (C2F merged earlier), also run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/unipass-proxy.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `9 passed` (the server still sends `x-proxy-secret` and skips the proxy without it).
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```powershell
git add lib/services/customs.ts lib/services/customstrack.ts tests/unit/track-route-latency.spec.ts; git commit -m "perf: query UNI-PASS in two waves under one deadline"
```

---

### Task A5: Route orchestration — budget, carrier-first, API_TIMEOUT, NOT_FOUND cache, log line

> **GATED — approval 5.**

**Files:**
- Modify: `app/api/track/route.ts:1-302` (whole file replaced below; the response envelope, messages, status codes and the pre-lookup checks `:135-146` keep their behavior)
- Modify: `lib/services/customs.ts` (delete the transitional `fetchCustomsEvents` and the `createLookupDeadline` import)
- Modify: `tests/track-api.spec.ts:1-3` (imports) and append two tests
- Test: `tests/unit/track-route-latency.spec.ts` (from Task A3, unchanged)

**Interfaces:**
- Consumes: Task A1 (`LOOKUP_TIMING`, `LOOKUP_CACHE_SECONDS`, `createLookupDeadline`, `withinMs`, `LookupDeadline`), Task A2 (`createUnipassTally`, `elapsedBucket`, `logLookup`, `LookupResultKind`, `UnipassTally`, `setLookupLogSink` in tests), Task A4 (`lookupCustomsEvents`, `CustomsLookupResult`, `CustomsLookupType`, `fetchCustomstrackCustomsEvents(number, { timeoutMs, signal })`); frozen `fetchDeliveryTracking`, `normalizeTrackingData`, `identifyTrackingNumber`, `readRequestTextWithLimit`, `getCache`/`setCache`/`buildTrackCacheKey`, rate-limit functions; test-only `FAKE` (S01), `containsTrackingLikeValue` (S01).
- Produces: `export const maxDuration = 30`; `export async function POST(request: Request): Promise<Response>` with the unchanged contract; one `track_lookup` log line per request.

- [ ] **Step 1: Confirm approval 5 is recorded; if not, stop.** Same check as Task A1 Step 1.

- [ ] **Step 2: Write the failing API tests.** In `tests/track-api.spec.ts` replace the import block — after S01 Task 4 it is the four lines `import { expect, test } from "@playwright/test";`, `import { POST } from "@/app/api/track/route";`, `import { ApiTrackResponseSchema } from "@/lib/schemas";`, `import { FAKE } from "./fixtures/tracking-fixtures";` (check with `Get-Content tests/track-api.spec.ts -TotalCount 5`) — with the following six lines, so `FAKE` is imported exactly once:

```ts
import { expect, test } from "@playwright/test";
import { maxDuration, POST } from "@/app/api/track/route";
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import { ApiTrackResponseSchema } from "@/lib/schemas";
import { setLookupLogSink } from "@/lib/services/lookup-log";
import { FAKE } from "./fixtures/tracking-fixtures";
```

Append at the end of the file:

```ts
test("the route declares a 30 s function ceiling", () => {
  expect(maxDuration).toBe(30);
});

test("every response writes one number-free lookup log line", async () => {
  const lines: string[] = [];
  const originalFetch = globalThis.fetch;
  const savedKey = process.env.UNIPASS_API_KEY;
  const savedProxy = process.env.UNIPASS_PROXY_URL;
  Reflect.deleteProperty(process.env, "UNIPASS_API_KEY");
  Reflect.deleteProperty(process.env, "UNIPASS_PROXY_URL");
  setLookupLogSink((line) => {
    lines.push(line);
  });
  globalThis.fetch = async (): Promise<Response> => {
    throw new TypeError("fetch failed");
  };

  try {
    await POST(
      new Request("http://localhost/api/track", {
        method: "POST",
        headers: { "content-type": "text/plain", "x-forwarded-for": "198.51.100.31" },
        body: FAKE.phone
      })
    );
    await POST(
      new Request("http://localhost/api/track", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.32" },
        body: JSON.stringify({ trackingNumber: FAKE.hblAlt, carrierCode: "AUTO" })
      })
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('"resultKind":"invalid","errorCode":"INVALID_NUMBER"');
    expect(lines[1]).toContain('"resultKind":"notFound","errorCode":"NOT_FOUND"');
    for (const line of lines) {
      expect(line.startsWith("track_lookup {")).toBe(true);
      expect(line).not.toContain(FAKE.hblAlt);
      expect(line).not.toContain("0000-1234");
      expect(containsTrackingLikeValue(line)).toBe(false);
    }
  } finally {
    globalThis.fetch = originalFetch;
    setLookupLogSink(null);
    if (savedKey !== undefined) process.env.UNIPASS_API_KEY = savedKey;
    if (savedProxy !== undefined) process.env.UNIPASS_PROXY_URL = savedProxy;
  }
});
```

- [ ] **Step 3: Run the new tests and the quick latency tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/track-api.spec.ts --grep "30 s function ceiling|number-free lookup log line"; npx playwright test tests/unit/track-route-latency.spec.ts --grep "within 3 s at UNI-PASS latency 0.3 s|fast UNI-PASS errors|complete NOT_FOUND is cached"; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `2 failed` (`maxDuration` is `undefined`; no log lines captured) and `3 failed` (about 3.8 s > 3000 because the old route still retries three times; `Received: 404` instead of 503; second call not cached).

- [ ] **Step 4: Replace `app/api/track/route.ts`** with:

```ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { buildTrackCacheKey, getCache, setCache } from "@/lib/cache";
import { getDeliveryCarrier } from "@/lib/delivery-carriers";
import { TrackRequestSchema } from "@/lib/schemas";
import { acquireRequestSlot, consumeRequestQuota, releaseRequestSlot } from "@/lib/rate-limit";
import { lookupCustomsEvents, type CustomsLookupResult, type CustomsLookupType } from "@/lib/services/customs";
import { fetchCustomstrackCustomsEvents } from "@/lib/services/customstrack";
import { fetchDeliveryTracking } from "@/lib/services/delivery";
import { readRequestTextWithLimit } from "@/lib/services/http";
import { identifyTrackingNumber } from "@/lib/services/identifier";
import {
  LOOKUP_CACHE_SECONDS,
  LOOKUP_TIMING,
  createLookupDeadline,
  withinMs,
  type LookupDeadline
} from "@/lib/services/lookup-budget";
import {
  createUnipassTally,
  elapsedBucket,
  logLookup,
  type LookupResultKind,
  type UnipassTally
} from "@/lib/services/lookup-log";
import { normalizeTrackingData } from "@/lib/services/normalizer";
import type { ApiError, DeliveryCarrierCode, DeliveryLookupResult, TrackResponseData, TrackingEvent } from "@/lib/types";

/** Vercel ends the function here; the in-code budget (LOOKUP_TIMING.budgetMs, 15 s) answers well before. */
export const maxDuration = 30;

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0"
};

const TEMPORARY_FAILURE_MESSAGE = "조회 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요";

const INVALID_NUMBER_ERROR: ApiError = {
  code: "INVALID_NUMBER",
  message: "입력하신 번호의 형식을 확인할 수 없습니다. HBL/화물관리번호/국내 운송장 번호를 다시 확인해주세요."
};

interface RouteOutcome {
  readonly response: Response;
  readonly kind: LookupResultKind;
  readonly code: ApiError["code"] | null;
}

interface LookupTarget {
  readonly number: string;
  readonly type: CustomsLookupType;
  readonly carrierCode: DeliveryCarrierCode;
  readonly cacheKey: string;
}

interface CustomsOutcome {
  readonly unipass: CustomsLookupResult;
  readonly events: TrackingEvent[];
}

const errorResponse = (error: ApiError, status: number): Response =>
  NextResponse.json({ success: false, error }, { status, headers: noStoreHeaders });

const successResponse = (data: TrackResponseData): Response =>
  NextResponse.json({ success: true, data }, { headers: noStoreHeaders });

const errorOutcome = (error: ApiError, status: number, kind: LookupResultKind): RouteOutcome => ({
  response: errorResponse(error, status),
  kind,
  code: error.code
});

const notFoundOutcome = (kind: "notFound" | "notFoundCached"): RouteOutcome =>
  errorOutcome({ code: "NOT_FOUND", message: "해당 번호로 통관/배송 정보를 찾을 수 없습니다" }, 404, kind);

/** Every upstream that decides the answer failed: tell the client "try again", never "not found". */
const allFailedOutcome = (timedOut: boolean): RouteOutcome =>
  errorOutcome({ code: "API_TIMEOUT", message: TEMPORARY_FAILURE_MESSAGE }, timedOut ? 504 : 503, "allFailed");

const isExternalFetchError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === "AbortError" || error.message.includes("fetch failed") || error.message.includes("UND_ERR"));

const shouldCacheTrackResult = (params: {
  type: string;
  customsEvents: TrackingEvent[];
  deliveryEvents: TrackingEvent[];
  lookupUnavailable: boolean;
  ambiguous: boolean;
}): boolean => {
  if (params.lookupUnavailable || params.ambiguous) return false;

  if (params.type === "DOMESTIC" && params.customsEvents.length === 0 && params.deliveryEvents.length > 0) {
    return false;
  }

  return true;
};

const notFoundCacheKey = (cacheKey: string): string => `${cacheKey}:not-found`;

const readCachedOutcome = (cacheKey: string): RouteOutcome | null => {
  const cached = getCache<TrackResponseData>(cacheKey);
  if (cached) return { response: successResponse(cached), kind: "cached", code: null };
  return getCache<boolean>(notFoundCacheKey(cacheKey)) === true ? notFoundOutcome("notFoundCached") : null;
};

const autoDelivery = (): DeliveryLookupResult => ({
  carrier: getDeliveryCarrier("AUTO").name,
  carrierCode: "AUTO",
  events: []
});

const unavailableDelivery = (target: LookupTarget): DeliveryLookupResult => {
  const carrier = getDeliveryCarrier(target.carrierCode);
  return {
    carrier: carrier.name,
    carrierCode: target.carrierCode,
    trackingUrl: target.carrierCode === "AUTO" ? undefined : carrier.trackingUrl(target.number),
    lookupUnavailable: true,
    events: []
  };
};

/** Carriers keep their own 12 s caps (frozen delivery.ts); the route stops waiting when the deadline ends. */
const settleDelivery = (target: LookupTarget, deadline: LookupDeadline): Promise<DeliveryLookupResult> => {
  const lookup = fetchDeliveryTracking(target.number, target.carrierCode).catch(() => unavailableDelivery(target));
  const expired = deadline.whenExpired().then(() => unavailableDelivery(target));
  return Promise.race([lookup, expired]);
};

const fetchCustomstrackWithin = async (number: string, deadline: LookupDeadline): Promise<TrackingEvent[]> => {
  const capMs = Math.min(LOOKUP_TIMING.customstrackMs, deadline.remainingMs());
  if (capMs <= 0) return [];
  try {
    return await fetchCustomstrackCustomsEvents(number, { timeoutMs: capMs, signal: deadline.signal(capMs) });
  } catch {
    return [];
  }
};

/** UNI-PASS first; customstrack starts as soon as the first UNI-PASS wave came back empty. Never rejects. */
const lookupCustomsWithFallback = async (
  target: LookupTarget,
  deadline: LookupDeadline,
  tally: UnipassTally
): Promise<CustomsOutcome> => {
  let fallback: Promise<TrackingEvent[]> | null = null;
  const startFallback = (): Promise<TrackingEvent[]> => {
    const current = fallback ?? fetchCustomstrackWithin(target.number, deadline);
    fallback = current;
    return current;
  };
  const unipass = await lookupCustomsEvents(target.number, target.type, {
    deadline,
    onUnipassCall: tally.record,
    onFirstWaveEmpty: () => {
      void startFallback();
    }
  });
  if (unipass.kind === "found") return { unipass, events: unipass.events };
  return { unipass, events: await startFallback() };
};

const successOutcome = (
  target: LookupTarget,
  customsEvents: TrackingEvent[],
  deliveryLookup: DeliveryLookupResult,
  kind: LookupResultKind
): RouteOutcome => {
  const data = normalizeTrackingData({ trackingNumber: target.number, type: target.type, customsEvents, deliveryLookup });
  const cacheable = shouldCacheTrackResult({
    type: target.type,
    customsEvents,
    deliveryEvents: deliveryLookup.events,
    lookupUnavailable: deliveryLookup.lookupUnavailable === true,
    ambiguous: deliveryLookup.ambiguous === true
  });
  if (cacheable) setCache(target.cacheKey, data, LOOKUP_CACHE_SECONDS.result);
  return { response: successResponse(data), kind, code: null };
};

const pendingOutcome = (target: LookupTarget, customs: CustomsOutcome, deliveryLookup: DeliveryLookupResult): RouteOutcome => {
  const data = normalizeTrackingData({ trackingNumber: target.number, type: target.type, customsEvents: [], deliveryLookup });
  if (customs.unipass.kind === "empty" && customs.unipass.complete) {
    setCache(target.cacheKey, data, LOOKUP_CACHE_SECONDS.pending);
  }
  return { response: successResponse(data), kind: "pending", code: null };
};

const resolveCustomsOnly = async (target: LookupTarget, deadline: LookupDeadline, tally: UnipassTally): Promise<RouteOutcome> => {
  const customs = await lookupCustomsWithFallback(target, deadline, tally);
  if (customs.events.length > 0) return successOutcome(target, customs.events, autoDelivery(), "found");
  if (customs.unipass.kind === "unavailable") return allFailedOutcome(customs.unipass.timedOut);
  if (customs.unipass.kind === "empty" && customs.unipass.complete) {
    setCache(notFoundCacheKey(target.cacheKey), true, LOOKUP_CACHE_SECONDS.notFound);
  }
  return notFoundOutcome("notFound");
};

const domesticWithoutCarrierEvents = (
  target: LookupTarget,
  customs: CustomsOutcome,
  deliveryLookup: DeliveryLookupResult
): RouteOutcome => {
  if (customs.events.length > 0) return successOutcome(target, customs.events, deliveryLookup, "found");
  if (deliveryLookup.ambiguous) return successOutcome(target, [], deliveryLookup, "ambiguous");
  if (deliveryLookup.lookupUnavailable) return successOutcome(target, [], deliveryLookup, "lookupUnavailable");
  if (customs.unipass.kind === "unavailable") return allFailedOutcome(customs.unipass.timedOut);
  return pendingOutcome(target, customs, deliveryLookup);
};

/** Carrier-first: once a carrier has events, customs gets a short grace period and is not waited for beyond it. */
const resolveDomestic = async (target: LookupTarget, deadline: LookupDeadline, tally: UnipassTally): Promise<RouteOutcome> => {
  const customsLookup = lookupCustomsWithFallback(target, deadline, tally);
  const deliveryLookup = await settleDelivery(target, deadline);
  if (deliveryLookup.events.length === 0) {
    return domesticWithoutCarrierEvents(target, await customsLookup, deliveryLookup);
  }
  const customs = await withinMs(
    customsLookup,
    Math.min(LOOKUP_TIMING.customsGraceAfterCarrierMs, deadline.remainingMs())
  );
  return customs === null
    ? successOutcome(target, [], deliveryLookup, "carrierFirst")
    : successOutcome(target, customs.events, deliveryLookup, "found");
};

const readTarget = async (request: Request): Promise<LookupTarget | null> => {
  const rawBody = await readRequestTextWithLimit(request, 1024, 5000);
  const body: unknown = JSON.parse(rawBody);
  const parsed = TrackRequestSchema.parse(body);
  const identified = identifyTrackingNumber(parsed.trackingNumber);
  if (identified.type === "UNKNOWN") return null;
  return {
    number: identified.number,
    type: identified.type,
    carrierCode: parsed.carrierCode,
    cacheKey: buildTrackCacheKey(identified.type, identified.number, parsed.carrierCode)
  };
};

const handleLookup = async (request: Request, deadline: LookupDeadline, tally: UnipassTally): Promise<RouteOutcome> => {
  const target = await readTarget(request);
  if (!target) return errorOutcome(INVALID_NUMBER_ERROR, 400, "invalid");
  const cached = readCachedOutcome(target.cacheKey);
  if (cached) return cached;
  return target.type === "DOMESTIC" ? resolveDomestic(target, deadline, tally) : resolveCustomsOnly(target, deadline, tally);
};

const rejectBeforeLookup = (request: Request): RouteOutcome | null => {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return errorOutcome({ code: "INVALID_NUMBER", message: "JSON 요청만 지원합니다" }, 415, "invalid");
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 1024) {
    return errorOutcome({ code: "INVALID_NUMBER", message: "요청 내용이 너무 큽니다" }, 413, "invalid");
  }

  if (!consumeRequestQuota(request) || !acquireRequestSlot()) {
    return errorOutcome(
      { code: "RATE_LIMITED", message: "조회 요청이 많습니다. 잠시 후 다시 시도해주세요" },
      429,
      "rateLimited"
    );
  }

  return null;
};

const outcomeForError = (error: unknown): RouteOutcome => {
  if (error instanceof Error && error.name === "RequestBodyTooLargeError") {
    return errorOutcome({ code: "INVALID_NUMBER", message: "요청 내용이 너무 큽니다" }, 413, "invalid");
  }
  if (error instanceof Error && error.name === "RequestBodyTimeoutError") {
    return errorOutcome({ code: "INVALID_NUMBER", message: "요청 본문을 제시간에 받지 못했습니다" }, 408, "invalid");
  }
  if (error instanceof SyntaxError) {
    return errorOutcome({ code: "INVALID_NUMBER", message: "요청 형식을 확인해주세요" }, 400, "invalid");
  }
  if (error instanceof ZodError) {
    return errorOutcome(
      { code: "INVALID_NUMBER", message: error.issues[0]?.message ?? "입력값을 확인해주세요" },
      400,
      "invalid"
    );
  }
  if (isExternalFetchError(error)) {
    return errorOutcome({ code: "API_TIMEOUT", message: TEMPORARY_FAILURE_MESSAGE }, 504, "error");
  }
  if (error instanceof Error && error.name === "CarrierUnavailableError") {
    return errorOutcome(
      {
        code: "API_TIMEOUT",
        message: "현재 택배사 조회 시스템 점검으로 배송정보 조회가 지연되고 있습니다. 잠시 후 다시 시도해주세요"
      },
      503,
      "error"
    );
  }
  return errorOutcome({ code: "SERVER_ERROR", message: "시스템 오류가 발생했습니다. 관리자에게 문의해주세요" }, 500, "error");
};

export async function POST(request: Request): Promise<Response> {
  const startedAt = Date.now();
  const tally = createUnipassTally();
  const finish = (outcome: RouteOutcome): Response => {
    const counts = tally.snapshot();
    logLookup({
      route: "/api/track",
      elapsedBucket: elapsedBucket(Date.now() - startedAt),
      unipassOk: counts.ok,
      unipassFail: counts.fail,
      resultKind: outcome.kind,
      errorCode: outcome.code
    });
    return outcome.response;
  };

  const rejected = rejectBeforeLookup(request);
  if (rejected) return finish(rejected);

  const deadline = createLookupDeadline();
  try {
    return finish(await handleLookup(request, deadline, tally));
  } catch (error) {
    return finish(outcomeForError(error));
  } finally {
    deadline.cancel();
    releaseRequestSlot();
  }
}
```

- [ ] **Step 5: Remove the transitional wrapper** from `lib/services/customs.ts`: delete the whole `fetchCustomsEvents` block (from its `/** Transitional pre-R4 signature …` comment to its closing `};`) and change the budget import line to:

```ts
import { LOOKUP_TIMING, type LookupDeadline } from "@/lib/services/lookup-budget";
```

Run: `Get-ChildItem app, lib, components, tests -Recurse -Include *.ts, *.tsx | Select-String -Pattern 'fetchCustomsEvents\b'`
Expected: no output.

- [ ] **Step 6: Run the S10 unit and API tests**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/lookup-budget.spec.ts tests/unit/lookup-log.spec.ts tests/unit/track-route-latency.spec.ts tests/track-api.spec.ts tests/delivery-carriers.spec.ts tests/customs-estimate.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: 0 failed; `lookup-budget` 7, `lookup-log` 5, `track-route-latency` 24 (18 from Task A3 + 6 from Task A4), `track-api` 8 (S01's 6 + 2) passed. The four `[budget]` lines print the spec budgets (expected roughly 1.3 s for NOT_FOUND at 0.3 s, 3.0 s for NOT_FOUND and DOMESTIC pending at 1.5 s, and 9 s for the outage).

- [ ] **Step 7: Run the whole unit folder, typecheck and lint**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck; npm run lint`
Expected: 0 failed (this includes S01's `real-number-guard.spec.ts`, which scans the new files, and — when C2F was merged earlier — `unipass-proxy.spec.ts` with 9 passed); typecheck and lint exit 0.

- [ ] **Step 8: Commit**

```powershell
git add app/api/track/route.ts lib/services/customs.ts tests/track-api.spec.ts; git commit -m "fix: report UNI-PASS outages as API_TIMEOUT and bound the track route to 15 s"
```

---

### Task A6: Log documentation, failure-rate alert proposal, and the R4 release checkpoint

> **GATED — approval 5.**

**Files:**
- Modify: `DEPLOYMENT.md` (insert a new section right before `## AdSense Auto Ads`)

**Interfaces:**
- Consumes: the log line format from Task A2 (`LOOKUP_LOG_EVENT`, `LookupResultKind`, `ElapsedBucket`).
- Produces: the operator's log/alert runbook and the daily evidence table that Tasks B1 and C1 read.

- [ ] **Step 1: Confirm approval 5 is recorded; if not, stop.** Same check as Task A1 Step 1.

- [ ] **Step 2: Add the section** — insert this block into `DEPLOYMENT.md` immediately before the line `## AdSense Auto Ads`:

````markdown
## 조회 로그와 실패율 경보 (R4)

`POST /api/track`은 요청마다 번호 없는 한 줄 로그를 남깁니다(`lib/services/lookup-log.ts`).

```text
track_lookup {"route":"/api/track","elapsedBucket":"1to3s","unipassOk":12,"unipassFail":0,"resultKind":"notFound","errorCode":"NOT_FOUND"}
```

- `elapsedBucket`: `lt1s` `1to3s` `3to6s` `6to10s` `10to15s` `ge15s`
- `unipassOk` / `unipassFail`: 이 요청에서 UNI-PASS 직접 호출이 확정 응답을 받은 수 / 실패(시간 초과·연결 오류·비정상 응답)한 수
- `resultKind`: `found` `carrierFirst` `pending` `lookupUnavailable` `ambiguous` `notFound` `notFoundCached` `cached` `allFailed` `invalid` `rateLimited` `error`
- `errorCode`: 오류 응답이면 `ApiError.code`, 아니면 `null`
- 조회번호·전화번호·IP·UA·URL은 넣지 않습니다. 필드를 더할 때도 enum과 정수만 씁니다.

확인 방법: Vercel 대시보드 → 프로젝트 `tracking-tipoasis` → Logs에서 아래 검색어로 줄 수를 셉니다. 로그 보관 기간이 짧을 수 있으므로 R4 배포 뒤 7일 동안 매일 같은 시각에 한 번 세어 S10 단계 요약의 표에 적습니다.

| 셀 값 | 검색어 |
|---|---|
| T (전체) | `track_lookup` |
| Z (UNI-PASS를 부르지 않은 줄) | `"unipassOk":0,"unipassFail":0` |
| F0 (UNI-PASS 실패가 없던 줄) | `"unipassFail":0,` |
| A (모두 실패) | `"resultKind":"allFailed"` |
| S (느린 응답) | `"elapsedBucket":"10to15s"` 줄 수 + `"elapsedBucket":"ge15s"` 줄 수 |
| L (6초 이상) | `"elapsedBucket":"6to10s"` 줄 수 + `"elapsedBucket":"10to15s"` 줄 수 + `"elapsedBucket":"ge15s"` 줄 수 |
| N (결과 없음·도착 전) | `"resultKind":"notFound"` 줄 수 + `"resultKind":"pending"` 줄 수 |

- 실패가 있던 줄의 비율 = (T − F0) ÷ (T − Z)
- 느린 결과 없음 비율의 상한 = L ÷ N (L은 모든 종류의 느린 줄을 세므로 실제 값보다 크거나 같습니다)

경보 제안(새 서비스 없이 수동 점검으로 시작합니다. 로그 드레인·외부 경보 서비스는 승인 13 대상입니다):

| 신호 | 계산 | 기준 | 조치 |
|---|---|---|---|
| UNI-PASS 장애 | 15분 창의 (T − F0) ÷ (T − Z) | 30% 이상(창 안 T − Z가 10줄 이상) | `config/site.config.ts` notices에 outage 공지를 켜고 UNI-PASS 공지 확인 |
| 모두 실패 | 15분 창의 A | 3줄 이상 | 위와 같음 |
| 느린 응답 | 1시간 창의 S ÷ T | 10% 이상 | UNI-PASS 지연 확인, 계속되면 `LOOKUP_TIMING` 재검토 |
| 직접 호출 실패율(승인 12 판단) | 하루의 (T − F0) ÷ (T − Z) | 3일 연속 1% 이하, 3일 합계 T − Z가 200줄 이상 | InsForge 프록시 폐기(승인 12) 진행 |

되돌리기: 배포 직후 A가 계속 늘거나 `allFailed`가 대부분이면 Vercel 대시보드 → Deployments에서 직전 배포로 Instant Rollback 한 뒤 원인을 봅니다.
````

- [ ] **Step 3: Verify the doc stays number-free**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: 0 failed.

- [ ] **Step 4: Commit**

```powershell
git add DEPLOYMENT.md; git commit -m "docs: document the lookup log line and failure-rate alerts"
```

- [ ] **Step 5: Run Task Final (Stage gate) for Part A.** Paste the `[budget]` lines from G6 into the stage summary as the S10 budgets (NOT_FOUND ≤ 3 s at 0.3 s, ≤ 6 s at 1.5 s, outage → `API_TIMEOUT` ≤ 15 s).

- [ ] **Step 6: Hand the R4 release to the operator (operator-run; the agent never pushes `main` or deploys).** Put this checklist in the stage summary:
  1. Merge per roadmap §5. When R3 is not yet released, `release/r4` is cut from `main` plus the S10 Part A commits (roadmap §5 last bullet); the operator opens the PR `release/r4 → main` and merges after CI passes.
  2. After Vercel reports the production deployment READY, smoke test with a fixture number (never a real one):
     ```powershell
     $body = '{"trackingNumber":"TEST00000001","carrierCode":"AUTO"}'
     Measure-Command { try { (Invoke-WebRequest -Method Post -Uri https://tracking.tipoasis.com/api/track -ContentType 'application/json' -Body $body -UseBasicParsing).StatusCode } catch { $_.Exception.Response.StatusCode.value__ } } | Select-Object TotalSeconds
     ```
     Expected: `TotalSeconds` ≤ 6; then, in Vercel Logs, one `track_lookup` line with `"resultKind":"notFound"` and `"unipassOk":12` (or `allFailed` with `unipassFail` > 0 if UNI-PASS is down right now — check again 10 minutes later).
  3. Within the first hour, count T, Z, F0 and A (DEPLOYMENT.md section). If A keeps growing or (T − F0) ÷ (T − Z) stays above 30 %, Instant Rollback and report.
  4. Fill the 7-day evidence table (T, Z, F0, A, S, L, N per day, searched as the DEPLOYMENT.md section lists) in the S10 stage summary; Tasks B1 and C1 read it.

---

## Part B — Client timeout (approval 5, after Part A is live)

### Task B1: Shorten the client timeout and re-tune the stage bounds

> **GATED — approval 5, plus Part A deployed to production with log evidence, plus S03 merged.**

**Files:**
- Modify: `config/site.config.ts` (`lookup.timeoutMs`, `lookup.notFoundServiceCaveat`, `lookup.stageMs` in the `lookup` export created by S03)
- Modify: `tests/unit/config.spec.ts` (S03's file; append a describe; update any assertion that pins the pre-R4 values)

**Interfaces:**
- Consumes: `lookup: LookupConfig` from `@/config/site.config` (S03 contract §11.7: `skeletonDelayMs`, `stageMs: readonly [number, number]`, `spinnerStopMs`, `timeoutMs`, `notFoundServiceCaveat`); `LOOKUP_TIMING` (Task A1).
- Produces: `lookup.timeoutMs === 25000`, `lookup.notFoundServiceCaveat === false`, `lookup.stageMs` = `[3000, 7000]` by default (see Step 4). S04's `useLookup` and S03's `deriveTrackingView` pick these up with no code change.

- [ ] **Step 1: Confirm approval 5 is recorded and Part A is live; if not, stop.** Roadmap §4 row 5 is `approved`, the operator confirms the Part A production deployment (Task A6 Step 6) is at least 3 days old, and the evidence table shows S ÷ T < 5 % on every day and 0 lines in `ge15s`. Otherwise mark B1 SKIPPED; fallback (spec §16 item 5 "거절하면"): keep the 45 s client timeout, the stage copy and the NOT_FOUND caveat line '조회 서비스 사정으로 결과가 없을 수도 있어요 [다시 조회]'.

- [ ] **Step 2: Confirm S03 is merged.** Run: `git log --oneline claude/tipoasis-tracking-renewal-ae0e3a --grep='merge: S03'`
  Expected: one line. Otherwise stop (Part B needs `config/site.config.ts`).

- [ ] **Step 3: Re-create the stage branch from the integration head and re-run the baseline.** Run: `git log --oneline claude/tipoasis-tracking-renewal-ae0e3a --grep='report UNI-PASS outages as API_TIMEOUT'`
  Expected: one line (Task A5's commit is on the integration branch, so Part A was merged; this works even if the local stage branch was deleted after that merge). Then: `git switch -C renewal/s10-r4-server-path claude/tipoasis-tracking-renewal-ae0e3a`
  Expected: `Switched to and reset branch 'renewal/s10-r4-server-path'`. Rename the Part A screen folders (see "Execution Order and Gating") and run Task 0 Steps 4–6 again.

- [ ] **Step 4: Choose `stageMs` from the logs.** Default `[3000, 7000]`. Rule: the long-wait stage stays at 3000 ms (its sentence '보통 10초 안에 끝나요' stays true). The very-long stage ('기록이 없는 번호는…') should start about 1 s after the time by which 90 % of no-record answers (`notFound` + `pending`) arrive. The log line cannot combine `elapsedBucket` and `resultKind` in one search, so use the evidence table's upper bound: with ΣL and ΣN summed over the 7 days, ΣL ÷ ΣN ≤ 10 % → the 90th percentile is below 6 s → `[3000, 7000]`; ΣL ÷ ΣN > 10 % → `[3000, 10000]` (the cap; it stays below the 15 s server budget). ΣN < 100 → the default. Write ΣL, ΣN, the ratio and the chosen pair into the stage summary.

- [ ] **Step 5: Find tests that pin the pre-R4 values.** Run: `Get-ChildItem tests -Recurse -Include *.ts | Select-String -Pattern 'timeoutMs|45000|45_000|notFoundServiceCaveat|조회 서비스 사정으로|stageMs|29190|29_190|29\.19'`
  Expected hits that do **not** block (the producer plans wrote them this way on purpose, S03 Global Constraints "Tests that depend on lookup timing…" and S04 "S10 Part B compatibility"):
  - `tests/unit/config.spec.ts` (S03): "lookup timing is the pre-R4 set or the R4 set…" accepts `45000`/`25000` and ties the caveat to it; `withConfig({ lookup: … })` rows ("the S10 Part B values are accepted").
  - Values set explicitly on a test's own config or options, never compared with the shipped one: `withConfig({ lookup: … })` and local timing objects in S03's `tests/unit/loading-view.spec.ts` / `tests/unit/derive-view.spec.ts`; the `timeoutMs` option of `scrubNumberFromUrl` (S02), `fetchTrack` (S04) and `runBulkLookup` (S09); the elapsed-time input rows of S11's wait-bucket test.
  - Reads of the shipped value: `lookup.timeoutMs`, `lookup.stageMs`, `lookup.notFoundServiceCaveat ? 1 : 0`, `Math.min(29_190, lookup.timeoutMs - 4_000)` (S04 `tests/e2e/loading-timeline.spec.ts`, `failure-causes.spec.ts`, S07 result specs).
  A hit blocks only when it compares the **shipped** `lookup` / `siteConfig.lookup` value — or a page rendered with the shipped config — with a pre-R4 literal (`toBe(45000)`, `toBe(true)` on the caveat flag, `[3000, 8000]`, an unconditional '조회 서비스 사정으로…' assertion, a `29_190` delay not bounded by `lookup.timeoutMs`). Such a literal in another stage's file (S03/S04/S07) blocks the flip: stop, amend roadmap §10.4 in a separate commit `docs: amend renewal contract — S10 Part B edits <file>` (adding "M S10 (Part B)"), then replace the literal as follows and note the rule → assertion mapping in the stage summary: client-timeout literal → `lookup.timeoutMs`; a slow-but-valid response delay (29.19 s) → `lookup.timeoutMs - 4_000`; an unconditional caveat-line assertion → `toHaveCount(lookup.notFoundServiceCaveat ? 1 : 0)`.

- [ ] **Step 6: Write the failing tests.** S03's `tests/unit/config.spec.ts` already imports `lookup` in its `@/config/site.config` import (S03 Task 5 Step 1); do not import it again. Add below the existing imports:

```ts
import { LOOKUP_TIMING } from "@/lib/services/lookup-budget";
```

Append to the end of the file:

```ts
test.describe("R4 client lookup timing (S10 Part B)", () => {
  test("the client timeout is 25 s once the server budget is live", () => {
    expect(lookup.timeoutMs).toBe(25_000);
  });

  test("the client timeout outlasts the server budget by at least 5 s", () => {
    expect(lookup.timeoutMs - LOOKUP_TIMING.budgetMs).toBeGreaterThanOrEqual(5_000);
  });

  test("the NOT_FOUND service caveat is off after the server fix", () => {
    expect(lookup.notFoundServiceCaveat).toBe(false);
  });

  test("stage bounds increase and the very-long stage starts before the server budget ends", () => {
    const [longStage, veryLongStage] = lookup.stageMs;
    expect(longStage).toBeGreaterThanOrEqual(lookup.skeletonDelayMs);
    expect(veryLongStage).toBeGreaterThan(longStage);
    expect(veryLongStage).toBeGreaterThanOrEqual(6_000);
    expect(veryLongStage).toBeLessThanOrEqual(10_000);
    expect(veryLongStage).toBeLessThan(LOOKUP_TIMING.budgetMs);
    expect(lookup.spinnerStopMs).toBeLessThan(veryLongStage);
  });
});
```

- [ ] **Step 7: Run to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/config.spec.ts --grep "R4 client lookup timing"; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `2 failed, 2 passed` against S03's shipped values (`timeoutMs: 45000`, `notFoundServiceCaveat: true`, `stageMs: [3000, 8000]`, `skeletonDelayMs: 400`, `spinnerStopMs: 5000`): "the client timeout is 25 s once the server budget is live" fails with `Received: 45000`, "the NOT_FOUND service caveat is off after the server fix" fails with `Received: true`; "outlasts the server budget by at least 5 s" (45000 − 15000) and "stage bounds increase…" (400 ≤ 3000 < 8000 ≤ 10000, 5000 < 8000) already pass.

- [ ] **Step 8: Flip the values.** In `config/site.config.ts`, inside the `lookup` export, replace the three properties (keep their position; find them with `Select-String -Path config/site.config.ts -Pattern 'timeoutMs|notFoundServiceCaveat|stageMs'`) with exactly:

```ts
  // 긴 대기 문구가 바뀌는 시점(ms). R4 로그 기준으로 다시 맞춤: 3초에 '조금 더 걸려요', 7초에 '기록이 없는 번호는…'.
  stageMs: [3000, 7000],
```

```ts
  // 클라이언트 조회 제한 시간. R4 서버 개선(승인 5) 배포 뒤 25초. 서버는 15초 안에 결과나 API_TIMEOUT을 보냅니다.
  timeoutMs: 25000,
```

```ts
  // 결과 없음 카드의 '조회 서비스 사정으로 결과가 없을 수도 있어요' 보조 줄. R4 뒤에는 서버가 장애를 API_TIMEOUT으로 알리므로 끕니다.
  notFoundServiceCaveat: false,
```

(Use the pair chosen in Step 4 for `stageMs` and update its comment's numbers accordingly.) S03's own assertions in `tests/unit/config.spec.ts` accept both value sets, so they stay as they are; only a blocking hit from Step 5 is rewritten (with the replacement rules given there).

`lookup.copy.veryLongWait` ('기록이 없는 번호는 30초 가까이 걸릴 수 있어요. …') is spec §5 copy and stays unchanged here (S10 adds no customer copy), although after R4 the server answers within 15 s and the client stops at 25 s. Write into the stage summary, for the operator: "R4 뒤 '30초 가까이' 문구 유지 여부 결정 필요 — 바꾸기로 하면 S03 설정값 변경 태스크로 처리".

- [ ] **Step 9: Run to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck; npm run build`
Expected: 0 failed (S03's config parse in `app/layout.tsx` accepts the new values; the build fails on invalid config); typecheck and build exit 0.

- [ ] **Step 10: Commit**

```powershell
git add config/site.config.ts tests/unit/config.spec.ts; git commit -m "feat: shorten the client lookup timeout to 25 s after the R4 server fix"
```

- [ ] **Step 11: Run Task Final (Stage gate) for Part B** and hand the follow-up release to the operator (same merge/PR path as Task A6 Step 6.1; no smoke test beyond the gate is needed because the server is unchanged).

---

## Part C — InsForge proxy (approval 12)

Run **either** C1 → C2 (retire) **or** C1F → C2F (harden) in one run, never both. A later retirement run after an earlier hardening run is expected; C1 Step 6 and C2 Step 6a then remove the fallback's leftovers.

### Task C1: Remove the proxy path from the customs lookup

> **GATED — approval 12 (retirement) and the icn1 log evidence.**

**Files:**
- Modify: `lib/services/customs.ts` (delete `getProxyXml`, `DirectMiss`, `proxyMissed`, `lookupViaProxy`; simplify `lookupCustomsEvents`; drop `postJsonWithTimeout`; delete `PROXY_SECRET_HEADER` when C2F ran earlier)
- Modify: `lib/services/lookup-budget.ts` (delete `proxyMs`)
- Modify: `tests/unit/lookup-budget.spec.ts` (delete the proxy fit line), `tests/unit/track-route-latency.spec.ts` (proxy expectations), `tests/support/unipass-stub.ts` (only when C2F ran earlier: drop the proxy-secret lines)
- Delete (only when C1F–C2F ran earlier): `tests/unit/unipass-proxy.spec.ts`

**Interfaces:**
- Consumes: Task A4 code, the Task A6 evidence table.
- Produces: `lookupCustomsEvents` with the same signature and result union, never calling `UNIPASS_PROXY_URL`; `LOOKUP_TIMING` without `proxyMs`.

- [ ] **Step 1: Confirm approval 12 is recorded; if not, stop.** Roadmap §4 row 12 must be `approved`. `pending`/`rejected` → skip C1–C2 and run C1F–C2F (fallback: harden the proxy — shared secret header, no CORS, number-format validation, call limit).

- [ ] **Step 2: Check the icn1 direct-call failure rate.** From the evidence table (Task A6 Step 6.4): for 3 consecutive days (T − F0) ÷ (T − Z) ≤ 1 % and the 3-day sum of (T − Z) ≥ 200. If Part A never shipped (approval 5 not granted) there is no evidence (spec §16 item 12 asks for the log check "그 전에") and no Part A code for Steps 4–6 to edit: mark C1–C2 SKIPPED ("approval 12 waits for Part A log evidence"), run C1F–C2F instead, and report it to the operator. Also confirm the Part A code is on the integration branch: `git show claude/tipoasis-tracking-renewal-ae0e3a:lib/services/customs.ts | Select-String -Pattern 'const lookupViaProxy'` → one line (no output → same SKIPPED rule). If the rule fails, stop and report the numbers — the proxy is currently the only fallback, and retirement is re-decided by the operator.

- [ ] **Step 3: Re-create the stage branch and re-run the baseline.** `git switch -C renewal/s10-r4-server-path claude/tipoasis-tracking-renewal-ae0e3a`, rename the previous screen folders, run Task 0 Steps 4–6.

- [ ] **Step 4: Write the failing test.** In `tests/unit/track-route-latency.spec.ts`, inside `test.describe("customs lookup …")`, append:

```ts
  test("the proxy URL is ignored after the InsForge retirement", async () => {
    const number = stubNumber("HBL", 307);
    await withUpstreams(
      [{ number, unipass: { mode: "http500", latencyMs: 50 } }],
      async (stub) => {
        const run = await runCustoms(number, "HBL");
        expect(run.result).toEqual({ kind: "unavailable", timedOut: false });
        expect(stub.calls(number).proxy).toBe(0);
      },
      { proxy: true }
    );
  });
```

and in the test "a UNI-PASS outage answers API_TIMEOUT within 15 s instead of NOT_FOUND" change `expect(calls.proxy).toBe(1);` to `expect(calls.proxy).toBe(0);`.

- [ ] **Step 5: Run to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/track-route-latency.spec.ts --grep "proxy URL is ignored|UNI-PASS outage"; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `2 failed` — `Expected: 0` / `Received: 1` for the proxy count.

- [ ] **Step 6: Remove the proxy path.** In `lib/services/customs.ts`:
  - change `import { postJsonWithTimeout, readTextWithLimit } from "@/lib/services/http";` to `import { readTextWithLimit } from "@/lib/services/http";`
  - delete the blocks `const getProxyXml = …`, `type DirectMiss = …`, `const proxyMissed = …` and `const lookupViaProxy = …` (with its doc comment)
  - change the `notConfigured` doc comment to `/** No UNIPASS_API_KEY: local development. */`
  - replace `lookupCustomsEvents` with:

```ts
/** Looks up UNI-PASS in two waves under one deadline and classifies the outcome. Never rejects. */
export const lookupCustomsEvents = async (
  trackingNumber: string,
  type: CustomsLookupType,
  options: CustomsLookupOptions
): Promise<CustomsLookupResult> => {
  const apiKey = process.env.UNIPASS_API_KEY;
  if (!apiKey) {
    options.onFirstWaveEmpty?.();
    return { kind: "notConfigured" };
  }
  return lookupDirect(
    {
      apiUrl: process.env.UNIPASS_API_URL || DEFAULT_UNIPASS_URL,
      apiKey,
      trackingNumber,
      type,
      year: new Date().getFullYear()
    },
    options
  );
};
```

  In `lib/services/lookup-budget.ts` delete the two lines `/** InsForge proxy call (removed with approval 12). */` and `proxyMs: 5_000,`. In `tests/unit/lookup-budget.spec.ts` delete the `expect(LOOKUP_TIMING.unipassCallMs + LOOKUP_TIMING.proxyMs + …` statement (3 lines).

  **Only when the approval-12 fallback (C1F–C2F) was merged earlier** — check with `Select-String -Path lib/services/customs.ts, tests/support/unipass-stub.ts -Pattern 'PROXY_SECRET'`: delete the line `const PROXY_SECRET_HEADER = "x-proxy-secret";` from `lib/services/customs.ts` (it is unused once `lookupViaProxy` is gone, and lint would fail), and from `tests/support/unipass-stub.ts` delete the four proxy-secret lines C2F added (`export const STUB_PROXY_SECRET = …`, `secret: process.env.UNIPASS_PROXY_SECRET` in `saved`, and both `setEnv("UNIPASS_PROXY_SECRET", …)` lines). Re-run the check: no output. Then remove the fallback's spec, whose "server side of the hardened proxy" tests now fail by design and whose function file Task C2 deletes: `git rm tests/unit/unipass-proxy.spec.ts` → one `rm '…'` line.

- [ ] **Step 7: Run to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit tests/track-api.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck; npm run lint`
Expected: 0 failed (`track-route-latency` now 25 passed); typecheck and lint exit 0.

- [ ] **Step 8: Commit**

```powershell
git add lib/services/customs.ts lib/services/lookup-budget.ts tests/unit/lookup-budget.spec.ts tests/unit/track-route-latency.spec.ts tests/support/unipass-stub.ts; git commit -m "refactor: drop the InsForge proxy fallback from the customs lookup"
```

---

### Task C2: Delete the InsForge artifacts and every URL mention

> **GATED — approval 12 (retirement); runs only after Task C1.**

**Files:**
- Delete: `insforge/functions/unipass-proxy.ts`, `.github/workflows/deploy-insforge.yml`, `docs/insforge-deployment-runbook.md`
- Modify: `package.json:12-13` (scripts), `AGENTS.md:21` and the `<!-- INSFORGE:START -->…<!-- INSFORGE:END -->` block, `CLAUDE.md:21`, `DEPLOYMENT.md` (lines 6, 15–17, 26, 41, 96, section `## InsForge CLI Notes`), `README.md:38`
- Check only: `.env.example` (has no `UNIPASS_PROXY_URL` today); Modify it only when C2F ran earlier (Step 6a)
- Create: `tests/unit/insforge-retired.spec.ts`

**Interfaces:**
- Consumes: Task C1.
- Produces: a repository with no InsForge proxy code, workflow, scripts or URLs; an operator checklist for the external clean-up.

- [ ] **Step 1: Confirm approval 12 is recorded; if not, stop.** Same check as Task C1 Step 1, and Task C1 must be committed on this branch (`git log --oneline -5 | Select-String 'drop the InsForge proxy'` → one line).

- [ ] **Step 2: Write the failing test** — create `tests/unit/insforge-retired.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RETIRED_FILES = [
  "insforge/functions/unipass-proxy.ts",
  ".github/workflows/deploy-insforge.yml",
  "docs/insforge-deployment-runbook.md"
];
const SCANNED_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "DEPLOYMENT.md",
  "README.md",
  ".env.example",
  "package.json",
  "lib/services/customs.ts",
  "lib/services/lookup-budget.ts"
];

test("the InsForge proxy files are gone", () => {
  for (const file of RETIRED_FILES) expect(existsSync(path.join(ROOT, file)), file).toBe(false);
});

test("no document or config still points at the InsForge proxy", () => {
  for (const file of SCANNED_FILES) {
    const text = readFileSync(path.join(ROOT, file), "utf8");
    expect(text, file).not.toMatch(/insforge\.app|insforge\.site|UNIPASS_PROXY_(URL|SECRET)|insforge:(current|deploy)|unipass-proxy/i);
  }
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/insforge-retired.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `2 failed` — the three files exist; the scan names the first listed file that still points at the proxy: `AGENTS.md` (the InsForge API base in the INSFORGE block), or `DEPLOYMENT.md` (`UNIPASS_PROXY_URL`) when C2F already rewrote that `AGENTS.md` line.

- [ ] **Step 4: Delete the files**

```powershell
git rm insforge/functions/unipass-proxy.ts .github/workflows/deploy-insforge.yml docs/insforge-deployment-runbook.md
```

Expected: three `rm '…'` lines.

- [ ] **Step 5: Remove the scripts.** In `package.json` delete the entries `"insforge:current": "npx @insforge/cli current",` and `"insforge:deploy": "npx @insforge/cli deployments deploy ."` and remove the trailing comma of the entry that is now last. With no other script changes the block becomes:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test:e2e": "playwright test"
  },
```

- [ ] **Step 6: Edit the docs.**
  - `AGENTS.md` and `CLAUDE.md`: replace `- Hosting: Vercel (프로젝트 `tracking-tipoasis`, 리전 `icn1`), UNI-PASS 프록시는 InsForge Edge Function` with `- Hosting: Vercel (프로젝트 `tracking-tipoasis`, 리전 `icn1`), UNI-PASS는 Vercel 함수에서 직접 호출(InsForge 프록시는 R4에서 폐기)`.
  - `AGENTS.md`: delete everything from the line `<!-- INSFORGE:START -->` through the line `<!-- INSFORGE:END -->` and the one blank line after it.
  - `DEPLOYMENT.md`: replace `InsForge remains in use for the UNI-PASS Edge Function proxy.` with `UNI-PASS is called directly from the Vercel function in \`icn1\`; the InsForge proxy was retired in R4 (approval 12).` (keep the backticks around icn1 as normal Markdown code). Delete these lines: `- InsForge frontend fallback URL: …`, `- Current InsForge deployment ID: …`, `- InsForge project dashboard: …`, `6. Keep the InsForge Edge Function proxy deployed for UNI-PASS access.`, `- \`UNIPASS_PROXY_URL\`: \`https://…/functions/unipass-proxy\``, the line `UNIPASS_PROXY_URL=https://…/functions/unipass-proxy` in the "Current Vercel environment variables" block, and the whole section from `## InsForge CLI Notes` up to (not including) the next `## ` heading.
  - `README.md`: delete the line that starts with `UNIPASS_PROXY_URL=https://` (the InsForge function URL; find it with `Select-String -Path README.md -Pattern '^UNIPASS_PROXY_URL='`).
  - `.env.example`: run `Select-String -Path .env.example -Pattern 'UNIPASS_PROXY'` → expected no output (nothing to remove) unless C2F ran earlier (Step 6a).

- [ ] **Step 6a: Only when the approval-12 fallback (C1F–C2F) was merged earlier, remove what it added.** Check: `Select-String -Path .env.example, README.md, DEPLOYMENT.md -Pattern 'UNIPASS_PROXY_SECRET|x-proxy-secret'`. No output → skip this step. Otherwise:
  - `.env.example`: delete the blank line, the comment line `# InsForge UNI-PASS 프록시(서버 전용). …` and the two lines `UNIPASS_PROXY_URL=` and `UNIPASS_PROXY_SECRET=` that C2F Step 5 appended.
  - `README.md`: delete the two lines `UNIPASS_PROXY_URL=` and `UNIPASS_PROXY_SECRET=` (C2F replaced the URL line with them, so the Step 6 README bullet finds nothing).
  - `DEPLOYMENT.md`: replace the C2F sentence ``InsForge remains only as a fallback UNI-PASS proxy, called with the shared secret header `x-proxy-secret` (`UNIPASS_PROXY_SECRET`).`` with the retirement sentence of Step 6; delete the two bullets ``- `UNIPASS_PROXY_URL`: InsForge function URL (…)`` and ``- `UNIPASS_PROXY_SECRET`: shared secret sent as `x-proxy-secret`; …``, and the two lines `UNIPASS_PROXY_URL=<InsForge function URL>` and `UNIPASS_PROXY_SECRET=<server secret>` in the "Current Vercel environment variables" block. (The `## InsForge CLI Notes` section goes away with Step 6 either way; `AGENTS.md` line 80 goes away with the INSFORGE block.)
  - `tests/unit/unipass-proxy.spec.ts` was already removed by Task C1 Step 6; `Test-Path tests/unit/unipass-proxy.spec.ts` → `False`.
  Re-run the check: no output.

- [ ] **Step 7: Run to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck; npm run lint; npm run build`
Expected: 0 failed (`insforge-retired` 2 passed); typecheck, lint, build exit 0.

- [ ] **Step 8: Commit**

```powershell
git add -A package.json AGENTS.md CLAUDE.md DEPLOYMENT.md README.md .env.example tests/unit/insforge-retired.spec.ts; git commit -m "chore: retire the InsForge UNI-PASS proxy"
```

- [ ] **Step 9: Run Task Final (Stage gate) for Part C**, then hand the external clean-up to the operator (operator-run, after the retirement code is live in production):
  1. `npx vercel env rm UNIPASS_PROXY_URL production` (the code already ignores it; this removes the stale value), and — only if the fallback's secret was set earlier (C2F Step 8) — `npx vercel env rm UNIPASS_PROXY_SECRET production`.
  2. InsForge dashboard: delete the `unipass-proxy` function and the old frontend deployment (`*.insforge.site`), or the whole `tracking-tipoasis` project if nothing else uses it.
  3. GitHub → Settings → Secrets and variables → Actions: delete `INSFORGE_USER_API_KEY`, `INSFORGE_API_BASE_URL`, `INSFORGE_API_KEY`.
  4. Optional local clean-up: delete the untracked `.insforge/` folder. (`.gitignore` and `eslint.config.mjs` keep ignoring `.insforge`; that is harmless, and `eslint.config.mjs` is hook-protected.)

---

### Task C1F: Harden the InsForge proxy function (fallback)

> **GATED — runs only while approval 12 is `pending` or `rejected` (spec §16 item 12 "거절하면").**

**Files:**
- Modify: `insforge/functions/unipass-proxy.ts:1-116` (whole file replaced)
- Create: `tests/unit/unipass-proxy.spec.ts`

**Interfaces:**
- Consumes: `FAKE` (S01 fixtures).
- Produces: `interface ProxyHandlerOptions { now: () => number; maxCallsPerMinute: number }`, `createProxyHandler(options): (request: Request) => Promise<Response>`, default export = `createProxyHandler({ now: Date.now, maxCallsPerMinute: 60 })`; shared secret header name `x-proxy-secret`; InsForge env `UNIPASS_PROXY_SECRET`.

- [ ] **Step 1: Confirm approval 12 is NOT approved; if it is, stop.** Roadmap §4 row 12 is `pending` or `rejected` → continue. `approved` → skip C1F–C2F and run C1–C2.

- [ ] **Step 2: Branch.** If Task 0 of this run already created `renewal/s10-r4-server-path` (Part A ran in this run, or was just marked SKIPPED in Task A1 Step 1 — the usual first run), stay on it. Otherwise `git switch -C renewal/s10-r4-server-path claude/tipoasis-tracking-renewal-ae0e3a`, rename the previous screen folders, and run Task 0 Steps 4–6.

- [ ] **Step 3: Write the failing test** — create `tests/unit/unipass-proxy.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { createProxyHandler } from "@/insforge/functions/unipass-proxy";
import { FAKE } from "../fixtures/tracking-fixtures";

interface DenoLike {
  readonly env: { readonly get: (key: string) => string | undefined };
}

const SECRET = "test-proxy-secret";
const FOUND_XML =
  "<cargCsclPrgsInfoQryRtnVo><cargCsclPrgsInfoQryVo><csclPrgsStts>수입신고수리</csclPrgsStts></cargCsclPrgsInfoQryVo></cargCsclPrgsInfoQryRtnVo>";

const setDenoEnv = (values: Readonly<Record<string, string>>): void => {
  const deno: DenoLike = { env: { get: (key) => values[key] } };
  Object.assign(globalThis, { Deno: deno });
};

const withUnipass = async (run: (urls: string[]) => Promise<void>): Promise<void> => {
  const urls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input): Promise<Response> => {
    urls.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    return new Response(FOUND_XML, { status: 200 });
  };
  try {
    await run(urls);
  } finally {
    globalThis.fetch = originalFetch;
    Reflect.deleteProperty(globalThis, "Deno");
  }
};

const proxyRequest = (body: unknown, headers: Record<string, string> = {}, method = "POST"): Request =>
  new Request("https://proxy.test/functions/unipass-proxy", {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: method === "POST" ? JSON.stringify(body) : undefined
  });

const fixedHandler = () => createProxyHandler({ now: () => 0, maxCallsPerMinute: 60 });

test.describe("hardened InsForge proxy (approval 12 fallback)", () => {
  test("a call without the right shared secret is refused before UNI-PASS", async () => {
    await withUnipass(async (urls) => {
      setDenoEnv({ UNIPASS_API_KEY: "stub", UNIPASS_PROXY_SECRET: SECRET });
      const handler = fixedHandler();
      expect((await handler(proxyRequest({ trackingNumber: FAKE.hbl, type: "HBL" }))).status).toBe(403);
      expect(
        (await handler(proxyRequest({ trackingNumber: FAKE.hbl, type: "HBL" }, { "x-proxy-secret": "wrong" }))).status
      ).toBe(403);
      expect(urls).toHaveLength(0);
    });
  });

  test("answers carry no CORS headers and preflight is refused", async () => {
    await withUnipass(async () => {
      setDenoEnv({ UNIPASS_API_KEY: "stub", UNIPASS_PROXY_SECRET: SECRET });
      const handler = fixedHandler();
      const ok = await handler(proxyRequest({ trackingNumber: FAKE.hbl, type: "HBL" }, { "x-proxy-secret": SECRET }));
      expect(ok.status).toBe(200);
      expect(ok.headers.get("access-control-allow-origin")).toBeNull();
      const preflight = await handler(proxyRequest(null, {}, "OPTIONS"));
      expect(preflight.status).toBe(405);
      expect(preflight.headers.get("access-control-allow-origin")).toBeNull();
    });
  });

  test("the number format is validated per type", async () => {
    await withUnipass(async (urls) => {
      setDenoEnv({ UNIPASS_API_KEY: "stub", UNIPASS_PROXY_SECRET: SECRET });
      const handler = fixedHandler();
      const invalid: readonly unknown[] = [
        { trackingNumber: "../../etc", type: "HBL" },
        { trackingNumber: FAKE.hbl, type: "DOMESTIC" },
        { trackingNumber: FAKE.invalidShort, type: "DOMESTIC" },
        { trackingNumber: FAKE.domestic, type: "UNKNOWN" },
        { type: "HBL" }
      ];
      for (const body of invalid) {
        expect((await handler(proxyRequest(body, { "x-proxy-secret": SECRET }))).status).toBe(400);
      }
      expect(urls).toHaveLength(0);
    });
  });

  test("calls are limited per minute", async () => {
    await withUnipass(async () => {
      setDenoEnv({ UNIPASS_API_KEY: "stub", UNIPASS_PROXY_SECRET: SECRET });
      let now = 1_000;
      const handler = createProxyHandler({ now: () => now, maxCallsPerMinute: 2 });
      const call = () => handler(proxyRequest({ trackingNumber: FAKE.hbl, type: "HBL" }, { "x-proxy-secret": SECRET }));
      expect((await call()).status).toBe(200);
      expect((await call()).status).toBe(200);
      expect((await call()).status).toBe(429);
      now += 60_000;
      expect((await call()).status).toBe(200);
    });
  });

  test("the proxy is closed while the secret is not configured", async () => {
    await withUnipass(async (urls) => {
      setDenoEnv({ UNIPASS_API_KEY: "stub" });
      const response = await fixedHandler()(
        proxyRequest({ trackingNumber: FAKE.hbl, type: "HBL" }, { "x-proxy-secret": SECRET })
      );
      expect(response.status).toBe(503);
      expect(urls).toHaveLength(0);
    });
  });

  test("a valid call returns the first UNI-PASS answer with rows", async () => {
    await withUnipass(async (urls) => {
      setDenoEnv({ UNIPASS_API_KEY: "stub", UNIPASS_PROXY_SECRET: SECRET });
      const response = await fixedHandler()(
        proxyRequest({ trackingNumber: FAKE.hbl, type: "HBL" }, { "x-proxy-secret": SECRET })
      );
      const payload: unknown = await response.json();
      expect(payload).toEqual({ xml: FOUND_XML });
      expect(urls[0]).toContain("hblNo=");
      expect(urls[0]).toContain("blYy=");
    });
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/unipass-proxy.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `6 failed` — `TypeError: … createProxyHandler is not a function`.

- [ ] **Step 5: Replace `insforge/functions/unipass-proxy.ts`** with:

```ts
type TrackingType = "DOMESTIC" | "HBL" | "CARGO";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

/** The Vercel function sends this header; the value lives only in the Vercel and InsForge env vars (UNIPASS_PROXY_SECRET). */
const SECRET_HEADER = "x-proxy-secret";
const DEFAULT_UNIPASS_URL = "https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo";
const WINDOW_MS = 60_000;
const DEFAULT_MAX_CALLS_PER_MINUTE = 60;
const CALL_TIMEOUT_MS = 12000;

const NUMBER_PATTERNS: Readonly<Record<TrackingType, RegExp>> = {
  HBL: /^[A-Z]{3,4}\d{8,16}$/,
  DOMESTIC: /^\d{10,14}$/,
  CARGO: /^\d{15,30}$/
};

const PARAMS_BY_TYPE: Readonly<Record<TrackingType, readonly string[]>> = {
  CARGO: ["cargMtNo"],
  HBL: ["hblNo", "mblNo"],
  DOMESTIC: ["hblNo", "mblNo", "cargMtNo"]
};

const buildRequestUrls = (apiUrl: string, apiKey: string, trackingNumber: string, type: TrackingType): string[] => {
  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear + 1, thisYear - 1, thisYear - 2, thisYear - 3, thisYear - 4];
  return years.flatMap((year) =>
    PARAMS_BY_TYPE[type].map(
      (param) => `${apiUrl}?${new URLSearchParams({ crkyCn: apiKey, blYy: String(year), [param]: trackingNumber }).toString()}`
    )
  );
};

/** No CORS headers: only the Vercel server calls this function. */
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

const safeEqual = (left: string, right: string): boolean => {
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return diff === 0;
};

const isTrackingType = (value: unknown): value is TrackingType =>
  value === "HBL" || value === "DOMESTIC" || value === "CARGO";

const readLookup = async (request: Request): Promise<{ readonly trackingNumber: string; readonly type: TrackingType } | null> => {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const trackingNumber = typeof record.trackingNumber === "string" ? record.trackingNumber.trim().toUpperCase() : "";
  if (!isTrackingType(record.type) || !NUMBER_PATTERNS[record.type].test(trackingNumber)) return null;
  return { trackingNumber, type: record.type };
};

const sweepYears = async (urls: readonly string[]): Promise<string> => {
  let lastXml = "";
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 tracking.tipoasis.com" },
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS)
      });
      if (!response.ok) continue;
      const xml = await response.text();
      lastXml = xml;
      if (xml.includes("<cargCsclPrgsInfoQryVo>") || xml.includes("<cargCsclPrgsInfoDtlQryVo>")) return xml;
    } catch {
      continue;
    }
  }
  return lastXml;
};

export interface ProxyHandlerOptions {
  readonly now: () => number;
  readonly maxCallsPerMinute: number;
}

/** Per-instance call limit (best effort: each edge instance counts on its own). */
export function createProxyHandler(options: ProxyHandlerOptions): (request: Request) => Promise<Response> {
  let windowStartedAt = options.now();
  let callsInWindow = 0;
  const allowCall = (): boolean => {
    const now = options.now();
    if (now - windowStartedAt >= WINDOW_MS) {
      windowStartedAt = now;
      callsInWindow = 0;
    }
    if (callsInWindow >= options.maxCallsPerMinute) return false;
    callsInWindow += 1;
    return true;
  };

  return async (request) => {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const secret = Deno.env.get("UNIPASS_PROXY_SECRET");
    const apiKey = Deno.env.get("UNIPASS_API_KEY");
    if (!secret || !apiKey) return json({ error: "Proxy is not configured" }, 503);
    if (!safeEqual(request.headers.get(SECRET_HEADER) ?? "", secret)) return json({ error: "Forbidden" }, 403);
    const lookup = await readLookup(request);
    if (!lookup) return json({ error: "Invalid trackingNumber or type" }, 400);
    if (!allowCall()) return json({ error: "Too many requests" }, 429);
    const apiUrl = Deno.env.get("UNIPASS_API_URL") || DEFAULT_UNIPASS_URL;
    return json({ xml: await sweepYears(buildRequestUrls(apiUrl, apiKey, lookup.trackingNumber, lookup.type)) });
  };
}

export default createProxyHandler({ now: () => Date.now(), maxCallsPerMinute: DEFAULT_MAX_CALLS_PER_MINUTE });
```

- [ ] **Step 6: Run to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/unipass-proxy.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck; npm run lint`
Expected: `6 passed`; typecheck and lint exit 0.

- [ ] **Step 7: Commit**

```powershell
git add insforge/functions/unipass-proxy.ts tests/unit/unipass-proxy.spec.ts; git commit -m "fix: harden the InsForge UNI-PASS proxy"
```

---

### Task C2F: Send the shared secret from the server and keep the proxy URL out of public docs (fallback)

> **GATED — runs only while approval 12 is `pending` or `rejected`; after Task C1F.**

**Files:**
- Modify: `lib/services/customs.ts` (proxy call: secret header, skip without secret) — variant A (Part A merged) or variant B (Part A skipped), both shown
- Modify: `tests/support/unipass-stub.ts` (variant A only: set `UNIPASS_PROXY_SECRET` with the `proxy` option)
- Modify: `.env.example` (append), `DEPLOYMENT.md`, `README.md:38`, `AGENTS.md:80`, `docs/insforge-deployment-runbook.md:25,32,93`
- Test: `tests/unit/unipass-proxy.spec.ts` (append)

**Interfaces:**
- Consumes: Task C1F (`x-proxy-secret`), `POST` from `@/app/api/track/route`, `FAKE`.
- Produces: env var `UNIPASS_PROXY_SECRET` (server-only); the server calls the proxy only when both `UNIPASS_PROXY_URL` and `UNIPASS_PROXY_SECRET` are set and always sends `x-proxy-secret`.

- [ ] **Step 1: Confirm approval 12 is NOT approved; if it is, stop.** Same check as Task C1F Step 1. This task edits `lib/services/customs.ts` outside approval 5 only to add the header and the secret gate; that is the "거절하면: 서버 전용 공유 비밀 헤더" line of spec §16 item 12.

- [ ] **Step 2: Write the failing tests.** In `tests/unit/unipass-proxy.spec.ts` add these three imports below the existing import lines, then append the second block to the end of the file:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { POST } from "@/app/api/track/route";
```

```ts
const SERVER_ENV_KEYS = ["UNIPASS_API_KEY", "UNIPASS_API_URL", "UNIPASS_PROXY_URL", "UNIPASS_PROXY_SECRET"] as const;

const withServerProxy = async (
  secret: string | null,
  run: (proxySecrets: (string | null)[]) => Promise<void>
): Promise<void> => {
  const saved = SERVER_ENV_KEYS.map((key) => [key, process.env[key]] as const);
  const proxySecrets: (string | null)[] = [];
  const originalFetch = globalThis.fetch;
  process.env.UNIPASS_API_KEY = "stub-key-not-real";
  process.env.UNIPASS_API_URL = "https://unipass.stub/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo";
  process.env.UNIPASS_PROXY_URL = "https://proxy.stub/functions/unipass-proxy";
  if (secret === null) Reflect.deleteProperty(process.env, "UNIPASS_PROXY_SECRET");
  else process.env.UNIPASS_PROXY_SECRET = secret;
  globalThis.fetch = async (input, init): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.host === "proxy.stub") {
      proxySecrets.push(new Headers(init?.headers).get("x-proxy-secret"));
      return new Response("No backend services available for app", { status: 503 });
    }
    if (url.host === "unipass.stub") return new Response("Internal Server Error", { status: 500 });
    return new Response("not found", { status: 404 });
  };
  try {
    await run(proxySecrets);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of saved) {
      if (value === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = value;
    }
  }
};

const postHbl = (number: string, ip: string): Promise<Response> =>
  POST(
    new Request("http://localhost/api/track", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ trackingNumber: number, carrierCode: "AUTO" })
    })
  );

test.describe("server side of the hardened proxy", () => {
  test("the server sends the shared secret header to the proxy", async () => {
    await withServerProxy(SECRET, async (proxySecrets) => {
      await postHbl(FAKE.hbl, "198.51.100.41");
      expect(proxySecrets.length).toBeGreaterThanOrEqual(1);
      expect(proxySecrets.every((value) => value === SECRET)).toBe(true);
    });
  });

  test("the server never calls the proxy without the shared secret", async () => {
    await withServerProxy(null, async (proxySecrets) => {
      await postHbl(FAKE.hblAlt, "198.51.100.42");
      expect(proxySecrets).toHaveLength(0);
    });
  });

  test("public docs do not publish the proxy URL", () => {
    for (const file of ["DEPLOYMENT.md", "README.md", "AGENTS.md", "docs/insforge-deployment-runbook.md"]) {
      expect(readFileSync(path.join(process.cwd(), file), "utf8"), file).not.toMatch(/insforge\.app/i);
    }
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/unipass-proxy.spec.ts --grep "server side"; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `3 failed` (header is `null`; proxy called without a secret; `DEPLOYMENT.md` contains `insforge.app`).

- [ ] **Step 4: Send the header and gate on the secret in `lib/services/customs.ts`.**

  **Variant A (Part A merged; `lookupViaProxy` exists).** Add below `const USER_AGENT = …`:

```ts
const PROXY_SECRET_HEADER = "x-proxy-secret";
```

  In `lookupViaProxy` replace

```ts
  const proxyUrl = process.env.UNIPASS_PROXY_URL;
  const capMs = Math.min(LOOKUP_TIMING.proxyMs, options.deadline.remainingMs());
  if (!proxyUrl) return direct;
```

  with

```ts
  const proxyUrl = process.env.UNIPASS_PROXY_URL;
  const proxySecret = process.env.UNIPASS_PROXY_SECRET;
  const capMs = Math.min(LOOKUP_TIMING.proxyMs, options.deadline.remainingMs());
  if (!proxyUrl || !proxySecret) return direct;
```

  and replace `const response = await postJsonWithTimeout(proxyUrl, { trackingNumber, type }, capMs);` with

```ts
    const response = await postJsonWithTimeout(proxyUrl, { trackingNumber, type }, capMs, {
      [PROXY_SECRET_HEADER]: proxySecret
    });
```

  Then in `tests/support/unipass-stub.ts` add `export const STUB_PROXY_SECRET = "stub-proxy-secret";` below `STUB_PROXY_URL`, add `secret: process.env.UNIPASS_PROXY_SECRET` to the `saved` object, add `setEnv("UNIPASS_PROXY_SECRET", options.proxy === true ? STUB_PROXY_SECRET : undefined);` after the `UNIPASS_PROXY_URL` line, and `setEnv("UNIPASS_PROXY_SECRET", saved.secret);` in `restore`.

  **Variant B (Part A skipped; the original `fetchProxyCustomsEvents` exists).** Replace

```ts
const fetchProxyCustomsEvents = async (trackingNumber: string, type: TrackingType): Promise<TrackingEvent[]> => {
  const proxyUrl = process.env.UNIPASS_PROXY_URL;
  if (!proxyUrl) {
    return [];
  }

  try {
    const response = await postJsonWithTimeout(proxyUrl, { trackingNumber, type }, 15000);
```

  with

```ts
const PROXY_SECRET_HEADER = "x-proxy-secret";

const fetchProxyCustomsEvents = async (trackingNumber: string, type: TrackingType): Promise<TrackingEvent[]> => {
  const proxyUrl = process.env.UNIPASS_PROXY_URL;
  const proxySecret = process.env.UNIPASS_PROXY_SECRET;
  if (!proxyUrl || !proxySecret) {
    return [];
  }

  try {
    const response = await postJsonWithTimeout(proxyUrl, { trackingNumber, type }, 15000, {
      [PROXY_SECRET_HEADER]: proxySecret
    });
```

- [ ] **Step 5: Document the secret and remove the public URL.**
  - `.env.example`: append

```text

# InsForge UNI-PASS 프록시(서버 전용). UNI-PASS 직접 호출이 모두 실패할 때만 쓰며, 두 값이 모두 있어야 호출합니다.
UNIPASS_PROXY_URL=
UNIPASS_PROXY_SECRET=
```

  This plan is itself a public document, so it spells the InsForge host as `https://…insforge.app` (the real host is the one already in these files). List every line to change first: `Select-String -Path DEPLOYMENT.md, README.md, AGENTS.md, docs/insforge-deployment-runbook.md -Pattern 'insforge\.app'` → seven lines (`DEPLOYMENT.md` 3, `README.md` 1, `AGENTS.md` 1, runbook 2). Then:
  - `DEPLOYMENT.md`: replace `InsForge remains in use for the UNI-PASS Edge Function proxy.` with `InsForge remains only as a fallback UNI-PASS proxy, called with the shared secret header \`x-proxy-secret\` (\`UNIPASS_PROXY_SECRET\`).`; replace the bullet ``- `UNIPASS_PROXY_URL`: `https://…insforge.app/functions/unipass-proxy` `` with the two lines ``- `UNIPASS_PROXY_URL`: InsForge function URL (read it from the Vercel env var; it is not published here)`` and ``- `UNIPASS_PROXY_SECRET`: shared secret sent as `x-proxy-secret`; the same value in Vercel (Production) and in the InsForge function env``; in the "Current Vercel environment variables" block replace the line `UNIPASS_PROXY_URL=https://…insforge.app/functions/unipass-proxy` with `UNIPASS_PROXY_URL=<InsForge function URL>` and add the line `UNIPASS_PROXY_SECRET=<server secret>`; in "InsForge CLI Notes" replace the line `npx @insforge/cli deployments env set UNIPASS_PROXY_URL "https://…insforge.app/functions/unipass-proxy"` with `npx @insforge/cli deployments env set UNIPASS_PROXY_SECRET "<same value as Vercel>"`.
  - `README.md`: replace the line `UNIPASS_PROXY_URL=https://…insforge.app/functions/unipass-proxy` with the two lines `UNIPASS_PROXY_URL=` and `UNIPASS_PROXY_SECRET=`.
  - `AGENTS.md`: replace the line ``- **Project:** **tracking-tipoasis** (API base `https://…insforge.app`)`` with `- **Project:** **tracking-tipoasis** (API base: InsForge 대시보드에서 확인 — 공개 문서에 적지 않음)`.
  - `docs/insforge-deployment-runbook.md`: after the line ``- `UNIPASS_PROXY_URL` `` add ``- `UNIPASS_PROXY_SECRET` ``; replace the line `UNIPASS_PROXY_URL=https://…insforge.app/functions/unipass-proxy` with `UNIPASS_PROXY_URL=<InsForge function URL>`; replace the line `npx @insforge/cli deployments env set UNIPASS_PROXY_URL "https://…insforge.app/functions/unipass-proxy"` with `npx @insforge/cli deployments env set UNIPASS_PROXY_SECRET "<same value as Vercel>"`.
  Re-run the `Select-String` above: no output.

- [ ] **Step 6: Run to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit tests/track-api.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npm run typecheck; npm run lint`
Expected: 0 failed (`unipass-proxy` 9 passed; with variant A the latency outage test still sees `proxy` = 1 because the stub now sets the secret); typecheck and lint exit 0.

- [ ] **Step 7: Commit**

```powershell
git add lib/services/customs.ts tests/support/unipass-stub.ts tests/unit/unipass-proxy.spec.ts .env.example DEPLOYMENT.md README.md AGENTS.md docs/insforge-deployment-runbook.md; git commit -m "fix: send the proxy shared secret and keep the proxy URL out of public docs"
```

(With variant B, `tests/support/unipass-stub.ts` does not exist; `git add` of a missing path fails — drop it from the list.)

- [ ] **Step 8: Run Task Final (Stage gate) for Part C**, then hand these operator steps over (the agent never handles the secret value):
  1. Generate the secret locally: `$bytes = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes)`
  2. InsForge: set `UNIPASS_PROXY_SECRET` in the `unipass-proxy` function's secrets and redeploy the updated `insforge/functions/unipass-proxy.ts` with the InsForge CLI/dashboard path used for that function.
  3. Vercel: `npx vercel env add UNIPASS_PROXY_SECRET production` (paste the same value), then release the app through the normal `main` path.
  4. Order does not matter for safety: until both sides have the secret, the app simply skips the proxy (it is only a fallback and currently answers 503).
  5. Verify from any machine: `try { Invoke-WebRequest -Method Options -Uri <function URL> -UseBasicParsing } catch { $_.Exception.Response.StatusCode.value__ }` → `405`, and a POST without the header → `403`.

---

### Task Final: Stage gate

- [ ] **G1. Port free.** `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue` → no output (stop listeners otherwise).
- [ ] **G2. Lint.** `npm run lint` → exit 0, no errors, no warnings introduced by this stage.
- [ ] **G3. Typecheck.** `npm run typecheck` → exit 0.
- [ ] **G4. Build.** `npm run build` → exit 0. Route table: `ƒ /[trackingNumber]` always; `/` is `ƒ` in S01 (it still reads `searchParams`), `○ /` from S02 on, and `○ /` with `Revalidate 5m` from S06 on.
- [ ] **G5. Dev-mode E2E.** `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npm run test:e2e` → "N passed", 0 failed (skips allowed only for tests guarded by `PW_MODE`, `PW_SHOTS`, `PW_VISUAL`, or an approval-gated `test.skip` naming the approval).
- [ ] **G6. Production-mode E2E.** Re-run `npm run build` if `next start` reports a missing or stale build. Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait for `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` = `200`; then `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test` → 0 failed, including `tests/budgets/*`.
- [ ] **G7. After-screens.** Server still running: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='after'; $env:PW_STAGE='S10'; npx playwright test tests/tools/stage-screens.spec.ts` → PNGs in `test-artifacts/stage-screens/S10-after/` at 320, 375, 768, 1024, 1440. Compare with `S10-before/`; send both sets to the operator with SendUserFile. Stop the server (G1 command) and clear the flags: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.
- [ ] **G8. Budgets.** Paste the measured numbers of every budget this plan lists (from the G6 output) into the stage summary. Any budget over its fail line fails the gate.
- [ ] **G9. Code review.** Invoke the `code-review` skill on `git diff claude/tipoasis-tracking-renewal-ae0e3a...HEAD`. Fix every CRITICAL and HIGH finding; if code changed, re-run G2–G6.
- [ ] **G10. Verification.** Invoke `superpowers:verification-before-completion`; paste each command and its result line into the stage summary.
- [ ] **G11. Commit.** `git status` shows only this stage's files (see the roadmap File Map). Commit any remainder with a conventional message and no attribution trailer.
- [ ] **G12. No deploy.** Do not push to `main`; do not run `vercel deploy`. Push `renewal/s10-r4-server-path` only if the operator asked. Hand the stage summary to the operator; merge into the integration branch only after acceptance (roadmap §5).

S10 budget lines for G8 (printed as `[budget] …` by `tests/unit/track-route-latency.spec.ts`): NOT_FOUND at UNI-PASS latency 0.3 s ≤ 3000 ms; NOT_FOUND at 1.5 s ≤ 6000 ms; DOMESTIC pending at 1.5 s ≤ 6000 ms; UNI-PASS outage to API_TIMEOUT ≤ 15000 ms. S10 changes no page, so the before/after screens must be identical; any visual difference is a gate failure to investigate.

---

## Additions to the Contract

Reported to the roadmap owner; none renames a §11 item.

1. **S10-private exports** (roadmap §11.2 lists the modules but not their exports): `lib/services/lookup-budget.ts` → `LOOKUP_TIMING`, `LOOKUP_CACHE_SECONDS`, `LookupDeadline`, `createLookupDeadline`, `withinMs`; `lib/services/lookup-log.ts` → `LOOKUP_LOG_EVENT`, `LOOKUP_RESULT_KINDS`, `LookupResultKind`, `ElapsedBucket`, `LookupLogRecord`, `UnipassCallOutcome`, `UnipassTally`, `elapsedBucket`, `formatLookupLog`, `logLookup`, `setLookupLogSink`, `createUnipassTally`. The log line `track_lookup {…six fields…}` is the stable format S11's KPI docs may cite.
2. **Frozen-module signature changes under approval 5:** `lib/services/customs.ts` gains `lookupCustomsEvents`, `CustomsLookupResult`, `CustomsLookupOptions`, `CustomsLookupType` and loses `fetchCustomsEvents` (its only consumer was the route). `lib/services/customstrack.ts`: `fetchCustomstrackCustomsEvents(trackingNumber, options?: CustomstrackOptions)` (optional, backward compatible).
3. **Test files not in File Map §10.4:** `tests/unit/lookup-budget.spec.ts`, `tests/unit/lookup-log.spec.ts` (C S10), `tests/unit/insforge-retired.spec.ts` (C S10, approval 12), `tests/unit/unipass-proxy.spec.ts` (C S10, fallback; D S10 in Task C1 when a retirement follows an earlier fallback). `tests/support/unipass-stub.ts` exports as listed in Task A3.
4. **File Map note extensions:** `DEPLOYMENT.md` M S10 also in Part A (log/alert section); `.env.example` under the approval-12 fallback gains `UNIPASS_PROXY_URL=` and `UNIPASS_PROXY_SECRET=` (a retirement without an earlier fallback leaves it unchanged — it never had `UNIPASS_PROXY_URL`; after an earlier fallback, Task C2 Step 6a removes those lines again); `insforge/functions/unipass-proxy.ts` under the fallback exports `createProxyHandler`/`ProxyHandlerOptions`; `docs/insforge-deployment-runbook.md` under the fallback keeps the file but drops the URL; `lib/services/customs.ts` M S10 also under the approval-12 fallback (C2F adds only the `x-proxy-secret` header and the secret gate — variant B edits the pre-R4 file while approval 5 is still pending, which the Global Constraints' "except S10 under approval 5" does not name; spec §16 item 12 "거절하면: 서버 전용 공유 비밀 헤더" is the basis).
5. **New server env var** (fallback only): `UNIPASS_PROXY_SECRET`, header `x-proxy-secret`.
6. **Cross-stage test requirement for Part B:** tests owned by S03/S04/S07 must read `lookup.timeoutMs`, `lookup.notFoundServiceCaveat` and `lookup.stageMs` from `config/site.config.ts` instead of literals (in particular S04's "29.19 s pending response still renders pending" delay must be derived from `lookup.timeoutMs`), so Part B changes values without editing their files. Where a literal remains, Task B1 Step 5 amends §10.4 first.
7. **Branch reuse:** Parts B and C re-create `renewal/s10-r4-server-path` from the integration head (`git switch -C`) after the previous part was merged; `PW_STAGE` stays `S10`, and screen folders are renamed `S10A-*`/`S10B-*`/`S10C-*` between gate runs.

## Self-Review

- **Spec coverage.** §16 item 5: no retry on confirmed empty (A4 `lookupDirect`, A3 "asked once per year and parameter"), current + last year first then parallel (A4 waves, A4 "first wave asks only the current and last year"), 15 s budget + `maxDuration = 30` (A1, A5, A5 "30 s function ceiling"), all failed → `API_TIMEOUT` (A5 `allFailedOutcome`, A3 outage/fast-error/stall/DOMESTIC tests), NOT_FOUND 60–300 s cache (A1 `notFound: 120`, A3 cached/not-cached tests), carrier-first (A5 `resolveDomestic`, A3 carrier-first/grace tests), number-free logs (A2, A5 log test) + alert proposal (A6); targets 3 s / 6 s / 15 s (A3, recorded as budgets). Part B: 45000 → 25000, caveat off, stage bounds re-tuned from logs (B1). §15 R4 "icn1 직접 호출 실패율을 확인한 뒤 InsForge를 폐기" (C1 Step 2 rule + A6 evidence table); §16 item 12 retirement (C1–C2) and "거절하면" hardening with all four measures (C1F–C2F). §11 step 2 field list is exactly the six fields.
- **Interpretations recorded.** DOMESTIC with a carrier outage keeps the existing 200 `lookupUnavailable` answer (official carrier link, pinned by the existing `track-api` test and A3) even when UNI-PASS is down; `API_TIMEOUT` is used for DOMESTIC only when carriers answered empty and UNI-PASS failed (it would otherwise claim '도착전'). No API key (local dev) keeps today's behavior (`notConfigured` → NOT_FOUND/pending, never cached).
- **Placeholder scan.** Every code step has complete code; the only operator-chosen value (`stageMs`) has a rule and a default.
- **Type consistency.** `CustomsLookupResult` kinds, `LookupResultKind` members and `LOOKUP_TIMING` keys are spelled identically in A1, A2, A4, A5, C1, C2F; `UnipassCallOutcome` is declared once (lookup-log) and imported by customs.
- **Review Focus.** Five lines, each with its test in A2, A3, A4 or A5.
