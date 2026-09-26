# tracking.tipoasis.com Renewal — Roadmap and Shared Contract (Plan 00)

> **For agentic workers:** This document is not executed task-by-task. It is the shared contract for the eleven stage plans (`2026-09-26-renewal-01-…` to `…-11-…`). Every stage plan is executed with superpowers:subagent-driven-development (recommended) or superpowers:executing-plans, and every stage plan copies §6 "Standard Stage Start" as its first task and §7 "Standard Stage Gate" as its last task, verbatim. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn the approved renewal spec into eleven independently executable stage plans that ship as releases R0 → R1 → R2 → R3 → R3b → R4 → R5 without naming conflicts, overlapping file ownership, or scope gaps.

**Architecture:** Pure core first (config + `deriveTrackingView` table), then UI islands that only render view models. The public page becomes one server shell (`TrackingPage`) with one client island (`LookupController`) and one lazily loaded result chunk (`ResultView`). Screen styles are CSS-token sets scoped by `html[data-style]`; DOM, hooks, copy and placement rules never depend on the style.

**Tech Stack:** Next.js 16.3.6 App Router (Turbopack), React 19.3, TypeScript strict, Tailwind CSS 3.4, zod 3.25, lucide-react, Playwright 1.55 (the only test runner; pure-function tests are Playwright tests without a `page`). framer-motion is removed in S06.

**Spec:** `docs/superpowers/specs/2026-09-26-tracking-renewal-ia-design.md` (source of truth; chapter numbers below are spec chapters). Phase 3 style canvases: `<scratchpad>/phase3/{A,B,C}/project/*.dc.html` (A = 세관 서류 `manifest`, B = 색면 신호 `signal`, default, C = 야간 관제 `night`). Phase 1 evidence: `<scratchpad>/phase1/results-run1/*.json`, `<scratchpad>/phase1/results-run2/{synthesis,gaps}.json`, ad-privacy harness `<scratchpad>/phase1/gap-GAP1/{prod-candidates.cjs,local-router.cjs}`, latency harness `<scratchpad>/phase1/gap-GAP2/`. `<scratchpad>` = `C:/Users/sos84/AppData/Local/Temp/claude/C--Users-sos84-OneDrive-------------04------01------------05----------------claude-worktrees-tipoasis-tracking-renewal-ae0e3a/3566a5b8-54f5-4bd4-bd54-e5e56b713935/scratchpad`.

**Repo root:** `C:/Users/sos84/OneDrive/바탕 화면/개인 폴더/04. 자동화/01. 구글 안디그래비티/05. 통관정보 웹페이지 생성/.claude/worktrees/tipoasis-tracking-renewal-ae0e3a` (integration branch `claude/tipoasis-tracking-renewal-ae0e3a`). All paths below are relative to it.

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

## Review Focus

Cross-stage conditions the spec implies but no single rule names. Each line names the stage whose plan must add the pinning test.

1. **Pasted notification text with several digit runs** (order number, phone '010-0000-1234', date '2026.09.26', and the waybill): extraction must return the waybill/HBL token only when exactly one candidate matches `identifyTrackingNumber`; with two candidates it must not auto-pick and must leave the text for the customer to edit. Owner: S06, `tests/unit/number-input.spec.ts`.
2. **Customer device not in KST** (overseas buyer with `TZ=America/New_York`, or a phone clock off by hours): ETA labels, D-n, worry dates, overdue and notice windows are computed from the `now` argument in `Asia/Seoul`; overdue flips exactly at KST midnight after the worry date. Owner: S03, `tests/unit/derive-view.spec.ts` (TZ row + 23:59/00:00 KST boundary rows).
3. **In-app browsers that throw on storage or clipboard** (Naver/Kakao webviews): `navigator.clipboard.writeText` rejects → a selectable text box appears; `sessionStorage`/`localStorage` access throws → restore is skipped and the style falls back to `signal`, never a crash. Owners: S05 (`tests/e2e/ui-kit.spec.ts` CopyButton with clipboard stubbed to reject), S02 (`tests/e2e/session-restore.spec.ts` with storage throwing), S08 (`tests/e2e/style-picker.spec.ts` with storage throwing).
4. **Deep-link path variants**: lowercase HBL `/test00000001`, encoded spaces `/0000%201234%205678`, hyphens, full-width digits, trailing slash, 31+ characters, a dot in the segment — the server split and the client normalizer agree, no API call for invalid input, `noindex` on every number-like response. Owner: S06, `tests/e2e/deep-link.spec.ts`.
5. **Reload, back/forward and bfcache around the URL scrub** (second deep link in the same tab, reload after scrub, back from a carrier tab): the ad loader is never present while a number is in `location`, is inserted at most once per document, and restore follows the rules. Owner: S02, `tests/e2e/url-privacy.spec.ts` and `tests/e2e/session-restore.spec.ts`.

---

## 1. Stage List and Mapping

| Id | Plan file | Title | Spec release | User order | Summary of scope |
|---|---|---|---|---|---|
| S01 | `2026-09-26-renewal-01-r0-urgent-fixes.md` | R0 urgent fixes | R0 | prerequisite | On the CURRENT UI: check for a hotfix branch first; replace real numbers with fixtures + generic real-number guard; remove the example buttons (format hint instead); fonts (IBM Plex Sans KR `preload:false`, weights 400/700, drop Space Grotesk) + preload-count budget test; remove hero SSR `opacity:0`; route groups `(public)`/`(internal)` with AdSense only in `(public)`; mismatch storage 14-day TTL + zod + clear-all (moved to `lib/cs/`); security headers stage 1 via `next.config.ts` + `lib/security/headers.ts`; `X-Robots-Tag` for number routes and `/internal`; `app/robots.ts`, `app/sitemap.ts`, `app/not-found.tsx`; shared test fixtures; stage-screens tool; CI runs E2E on the production build; optional history rewrite (approval 11). |
| S02 | `…-02-r1-number-protection.md` | R1 number protection | R1 | prerequisite | Candidate-B URL scrub after router commit; `AdLoader` gated fail-closed; remove number `pushState`; session restore; [다시 볼 링크 복사] on the current result UI; `?trackingNumber` redirect in `next.config.ts`; privacy policy text; url-privacy E2E with third-party requests intercepted and aborted; local-router regression → same-address `pushState` only if it passes. |
| S03 | `…-03-r2-state-core.md` | R2 state core (pure) | R2 | prerequisite | `config/site.config.ts`, `lib/config/{types,schema,server}.ts`, `lib/tracking/*` pure modules (types, KST time, business days, holidays, number grouping, templates, glossary, notices, classifyFailure, deriveTrackingView incl. overdue, deriveLoadingView, inquiry copy), `lib/cs/{cs-reply,cs-templates}.ts`, build-time config validation, table tests incl. `TZ=America/New_York` and overdue day-before/day-of/day-after rows, module-boundary test, DEPLOYMENT.md "운영 설정 바꾸기". |
| S04 | `…-04-r2-status-slot.md` | R2 status slot on the current page | R2 | prerequisite | `lookup-state` reducer, `fetchTrack`, `useLookup`, `LiveAnnouncer`, `StatusSlot` under the current form (loading/error/result in one slot, staged copy at 0.4/3/8 s, [조회 취소], 45 s timeout, per-cause errors, focus to visible h2), fix the 8 CTA contradictions (GAP3-06) via `deriveTrackingView`, no affiliate in problem states, worry-date line + [문의 내용 복사하고 톡톡 열기], CS helper switched to `buildCsReply`, retire `TrackingResultSummary`. |
| S05 | `…-05-design-tokens-common.md` | Design tokens and primitives (signal) | R3 | #1 | `[data-style]` token architecture with only the `signal` set, Tailwind `tt-*` mapping, tone/type/focus/motion tokens, primitives (Button, ButtonLink, StatusChip, ToneIcon, JourneySpine, EtaDisplay, NumberBar, CopyButton, AffiliateLinkGroup, NoticeBanner, TalkLink), `/internal/ui-kit` gallery, fonts for `signal`, DESIGN.md rewrite as the single source, `design-system/` bundle rewritten from tokens. |
| S06 | `…-06-lookup-area.md` | Lookup area and shell | R3 | #2 | `TrackingPage` server shell for `/` and `/[trackingNumber]` (`/` static, revalidate 300), `LookupController` island (normalize, paste parsing, O↔0/I↔1 hint, client pre-check, abort, modes, restore), new header, inline 상담·스토어 바로가기 row (approval 1), format hint, '번호는 어디서 찾나요?', notice line, deep-link 3-way split, noscript GET form, remove LogisticsFlow/AssuranceRail/popup/infinite animations/framer-motion, transitional `LegacyResultSection`, rule→assertion map and home E2E migration (approval 2), HTML/LCP/motion budgets. |
| S07 | `…-07-result-area.md` | Result area | R3 | #3 | Lazy `ResultView` (≤ 30 KB) with fixed order, all §7 state rows, `LoadingCard`, `FailureCard`, overdue/stale/lookupUnavailable/ambiguous chips, holiday badge, desktop two-column layout, document titles, scroll-jump-free fill, result E2E migration by hooks, JS budgets; deletes all legacy result components. |
| S08 | `…-08-supplementary-and-styles.md` | Supplementary + selectable styles | R3 (Part A) + R3b (Part B) | #4 | Part A: inline recommendations, store showcase, manual ad slot, ad timing (approval 7), new footer, privacy page on the shell, CSS budget, legacy deletions. Part B: `manifest` and `night` token sets + 4 variant slots, '화면 스타일' picker, pre-paint script + CSP hash, per-style fonts, per-style contrast/axe, 48-shot visual matrix, DESIGN.md/design-system style sections. |
| S09 | `…-09-internal-cs-tool.md` | Internal CS desk | R5 | #5 | `(internal)` desk with four tabs (배송 안내 bulk ≤ 20, 통관부호 불일치 with approval-14 storage, 안내표 미리보기 using `ResultView` at 375, 공지 현황 date simulator), `buildCsReply` short/long + customer link copy, `InternalCsHelper` split, legacy `components/ui/*` removal. |
| S10 | `…-10-r4-server-path.md` | Server path (approval 5) | R4 | parallel | Part A: no retry on confirmed empty, current+last year first then parallel, 15 s budget, `maxDuration = 30`, all-failed → `API_TIMEOUT`, short NOT_FOUND cache, carrier-first response, number-free structured logs, latency harness tests. Part B (after Part A is deployed): `timeoutMs` 45000 → 25000, caveat off, stage bounds re-tuned. Part C (approval 12): InsForge retirement or hardening. |
| S11 | `…-11-r5-measurement-ops.md` | Measurement and ops | R5 | parallel | Observability baseline procedure (no code; run in the R0 week), analytics (approval 13: cookieless, URL templating, enum events, loaded after the URL scrub), AdSense account checklist (approval 15, operator-manual), CSP Report-Only collection endpoint, strict-CSP decision record (approval 16), KPI dashboard definition, WAF proposal for `/internal`. |

**Release checkpoints.** R0 = S01. R1 = S02. R2 = S03 + S04. R3 = S05 + S06 + S07 + S08 Part A. R3b = S08 Part B. R4 = S10 Part A (then Part B as a follow-up release). R5 = S09 + S11 (S11's baseline procedure is executed in the R0 week).

## 2. Dependency Graph

```
S01 ──┬──> S02 ──────────┬───────────────┐
      │                  v               v
      ├──> S03 ──┬─────> S04 ──┐         │
      │          │             v         │
      │          └──────────> S05 <──────┘   (S05 needs S01, S02, S03)
      │                        │
      │               S04 + S05 └──> S06 ──> S07 ──> S08(A) ──> S08(B)
      │                                        │
      │                                        └──> S09   (also needs S03, S04)
      ├──> S10(A) ──(deployed)──> S10(B needs S03) ──> S10(C, approval 12)
      └──> S11(baseline docs, R0 week) ── S11(rest needs S02)
```

| Stage | dependsOn (must be merged into the integration branch first) | Can run in parallel with |
|---|---|---|
| S01 | — | S11 baseline doc |
| S02 | S01 | S03, S10 A |
| S03 | S01 | S02, S10 A |
| S04 | S02, S03 | S05, S10 |
| S05 | S01, S02, S03 (`CopyButton` uses `lib/clipboard.ts`) | S04, S10 |
| S06 | S02, S04, S05 | S10 |
| S07 | S03, S05, S06 | S10 |
| S08 | S05, S06, S07 (Part B after Part A) | S09, S10 |
| S09 | S03, S04, S07 | S08, S10, S11 |
| S10 | S01 (Part B also S03) | everything after S01 |
| S11 | S01, S02, S03, S05 (event types import `GuideKey`, `FailureCause`, `ActionKind`, `StyleId`); the baseline doc needs nothing and runs in the R0 week | S08, S09, S10 |

Merge order into the integration branch follows release order: a stage belonging to release N+1 merges only after `release/rN` has been cut (§5).

## 3. Operator Questions (spec §17) — Defaults and Consumers

| Q | Default when unanswered | Consumed by |
|---|---|---|
| 1 Stage durations and worry thresholds | Current constants: 통관 1~2일, 인계 0~1영업일, 국내 1~2일; HBL visible 3~7 days after departure; worry = estimate + 1 business day; NOT_FOUND 7 days; pending 10 days; undelivered 24 h; no Saturday delivery; pending copy unchanged | S03 (`config.durations`, `config.calendar`) |
| 2 Do notifications contain `/{번호}` links? | Both entrances first-class; if Observability shows `/[번호]` < 30 %, pre-hydration lookup start stays deferred | S11 (baseline), S06 (no pre-hydration start) |
| 3 How often do notices/recommendations change, who edits | 1–2 changes/month via GitHub web edit → PR → CI → main; no Edge Config | S03 (Korean comments + DEPLOYMENT.md section) |
| 4 Unidentified 12-digit numbers real? Rewrite history? | Treat as real; replace in the working tree + guard; no history rewrite | S01 |
| 5 Revenue tolerance | Keep the reassurance-first rules; compare RPM and store clicks 2 weeks before/after; if `/` RPM drops ≥ 15 %, revert the home loader deferral first | S08 (revert switch = `AD_TIMING_POLICY`), S11 (KPI) |

## 4. Approval Ledger and Gating

The operator edits the **Status** column. Every stage plan's Task 0 reads it. `pending` means "not approved yet": implement the fallback path and mark the gated task SKIPPED with the reason. A later approval re-opens only the gated task (as a follow-up task in the same stage plan, executed when approved).

| # | Item (spec §16) | Status | Gated tasks (stage) | Fallback while not approved |
|---|---|---|---|---|
| 1 | Auto popup → non-modal 바로가기 row | pending | S06: ShortcutRow, delete `StoreContactPopup`, replace dialog assertions | Keep the popup collapsed by default and placed so it never overlaps the lookup panel; add an occlusion test (trial click on [조회하기] at 1280×720, 390×844). |
| 2 | Home restructure + test contract (copy-bound → rules/roles/hooks) | pending | S04: replace copy-bound result assertions; S06: home restructure + migration; S07: result migration | BLOCKING for S06/S07 (the operator must decide before they start). S04 fallback: new stateGuide copy must equal the strings the current tests assert for the rows they cover. |
| 3 | Error rule wording (recovery action first, 톡톡 first link) | pending | S04 `FailureNotice` weights; S07 `FailureCard` weights | 톡톡 is the filled primary on every error screen; [번호 수정]/[다시 조회] are secondary. |
| 4 | Pending recheck copy + purchase-choice destination | pending | S03 `durations.pendingRecheck`, `channels.*.urls.pending`; S07 pending CTA help line | Keep '정보 반영까지 시간이 걸릴 수 있어 2~3시간 뒤 다시 확인해 주세요.' and the current store-home URLs; add the '주문내역에서 확인' help. |
| 5 | Narrow data-layer release (item 4) | pending | S10 Parts A and B | Keep the 45 s client timeout, stage copy and the NOT_FOUND caveat line '조회 서비스 사정으로 결과가 없을 수도 있어요 [다시 조회]'. |
| 6 | Candidate B + companions + privacy policy | pending | S02 (scrub, AdLoader, pushState removal, restore, return link, redirect, policy) | `AD_TIMING_POLICY = "neverOnNumberRoutes"`: no loader in a tab whose first document was a number route; the rest of S02 still ships. |
| 7 | Ad loader timing (deep link + home) | pending | S08 Part A: `afterAllowedResult` policy | Home loads immediately; deep links load at scrub time (candidate B timing); document the known exception "an anchor loaded before a lookup can stay on an error screen". |
| 8 | Holiday date shift | pending | S03 (contract amendment adds `calendar.shiftEstimates` only if approved) | Badge only (default design). |
| 9 | Definitive disclosure wording and position | pending | S03 `disclosures.coupang` value | Current wording '쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.' placed before the links (position change needs no approval). |
| 10 | Inline recommendations + fact check | pending | S08 `RecommendationList` | Keep the dialog; label '운영자 추천'; no price/discount labels. |
| 11 | Public git history rewrite | pending | S01 final optional task | No rewrite; recommend reviewing repository visibility. |
| 12 | InsForge proxy retirement | pending | S10 Part C | Harden: server-only shared secret header, no CORS, number-format validation, call limit. |
| 13 | New services/dependencies (Vercel Web Analytics, Speed Insights, `@axe-core/playwright`) | pending | S05/S06/S07/S08 axe tests; S11 analytics | Manual a11y checklist + structural tests without axe; Observability counts + manual 톡톡 classification only. |
| 14 | `/internal` storage policy | pending | S09 storage task | Keep S01's 14-day TTL `localStorage`. |
| 15 | AdSense account settings | pending | S11 checklist (operator applies manually, a different week than R3) | Only turn off the vignette extra trigger. |
| 16 | Strict nonce CSP | pending | S11 decision record | Stay on stage-1 headers. |

Operator pre-release steps: before R1, back up AdSense revenue/RPM for `/번호` URLs; approval-15 settings are applied in a different week from the R3 deploy.

## 5. Branches, Commits, Releases

- Integration branch: `claude/tipoasis-tracking-renewal-ae0e3a`. Stage branch: `renewal/sNN-<slug>` created from the integration head after all `dependsOn` stages are merged (slugs: `s01-r0-urgent-fixes`, `s02-r1-number-protection`, `s03-r2-state-core`, `s04-r2-status-slot`, `s05-design-tokens-common`, `s06-lookup-area`, `s07-result-area`, `s08-supplementary-and-styles`, `s09-internal-cs-tool`, `s10-r4-server-path`, `s11-r5-measurement-ops`).
- Commits are small and conventional (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `perf:`, `ci:`), no attribution trailer.
- A stage merges into the integration branch with `git merge --no-ff renewal/sNN-<slug> -m "merge: SNN <title>"` only after its Stage Gate passed and the operator accepted the stage summary.
- Release checkpoint: `git branch release/rN <integration head>` right after the release's last stage merged. The operator opens the PR `release/rN → main` (CI must pass). No agent pushes to `main`. R4 is cut from `main` plus S10 Part A commits when R3 is not yet released.
- Contract changes: a stage that finds this contract wrong stops, amends §11 in a separate commit `docs: amend renewal contract — <what>` (additive whenever possible), and names the amendment in its summary.

## 6. Standard Stage Start (copy verbatim as Task 0 of every stage plan)

```markdown
### Task 0: Stage start

- [ ] **Step 1: Read approvals.** Open `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §4. For every approval number in this plan's "Gated by" list, write its Status into the stage summary. `pending`/`rejected` → execute the fallback steps and mark the gated task SKIPPED with the reason.
- [ ] **Step 2: Confirm dependencies.** Run (PowerShell): `git log --oneline claude/tipoasis-tracking-renewal-ae0e3a -40`
  Expected: a `merge: SNN …` commit for every stage in this plan's "Depends on" list.
- [ ] **Step 3: Branch.** Run: `git switch -c renewal/sNN-<slug> claude/tipoasis-tracking-renewal-ae0e3a`
  Expected: `Switched to a new branch 'renewal/sNN-<slug>'`.
- [ ] **Step 4: Port free.** Run: `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue`
  Expected: no output. Otherwise stop the listener: `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`
- [ ] **Step 5: Baseline build and before-screens.** Run `npm ci` only if `package-lock.json` changed since the last install in this worktree, then `npm run build`.
  Expected: build exits 0. Start the production server in a background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`
  Wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200`.
  Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='before'; $env:PW_STAGE='SNN'; npx playwright test tests/tools/stage-screens.spec.ts`
  Expected: PNGs in `test-results/stage-screens/SNN-before/` for widths 320, 375, 768, 1024, 1440. (S01 creates the tool first; S01 runs this step after its Task 1.)
- [ ] **Step 6: Baseline suite.** With the server still running: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test`
  Expected: record "N passed / M skipped / 0 failed" in the stage summary. Then stop the server (Step 4 command) and clear the flags: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.
```

## 7. Standard Stage Gate (copy verbatim as the last task of every stage plan)

```markdown
### Task Final: Stage gate

- [ ] **G1. Port free.** `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue` → no output (stop listeners otherwise).
- [ ] **G2. Lint.** `npm run lint` → exit 0, no errors, no warnings introduced by this stage.
- [ ] **G3. Typecheck.** `npm run typecheck` → exit 0.
- [ ] **G4. Build.** `npm run build` → exit 0. Route table: `ƒ /[trackingNumber]` always; `/` is `ƒ` in S01 (it still reads `searchParams`), `○ /` from S02 on, and `○ /` with `Revalidate 5m` from S06 on.
- [ ] **G5. Dev-mode E2E.** `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npm run test:e2e` → "N passed", 0 failed (skips allowed only for tests guarded by `PW_MODE`, `PW_SHOTS`, `PW_VISUAL`, or an approval-gated `test.skip` naming the approval).
- [ ] **G6. Production-mode E2E.** Re-run `npm run build` if `next start` reports a missing or stale build. Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait for `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` = `200`; then `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test` → 0 failed, including `tests/budgets/*`.
- [ ] **G7. After-screens.** Server still running: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='after'; $env:PW_STAGE='SNN'; npx playwright test tests/tools/stage-screens.spec.ts` → PNGs in `test-results/stage-screens/SNN-after/` at 320, 375, 768, 1024, 1440. Compare with `SNN-before/`; send both sets to the operator with SendUserFile. Stop the server (G1 command) and clear the flags: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.
- [ ] **G8. Budgets.** Paste the measured numbers of every budget this plan lists (from the G6 output) into the stage summary. Any budget over its fail line fails the gate.
- [ ] **G9. Code review.** Invoke the `code-review` skill on `git diff claude/tipoasis-tracking-renewal-ae0e3a...HEAD`. Fix every CRITICAL and HIGH finding; if code changed, re-run G2–G6.
- [ ] **G10. Verification.** Invoke `superpowers:verification-before-completion`; paste each command and its result line into the stage summary.
- [ ] **G11. Commit.** `git status` shows only this stage's files (see the roadmap File Map). Commit any remainder with a conventional message and no attribution trailer.
- [ ] **G12. No deploy.** Do not push to `main`; do not run `vercel deploy`. Push `renewal/sNN-<slug>` only if the operator asked. Hand the stage summary to the operator; merge into the integration branch only after acceptance (roadmap §5).
```

## 8. Stage Plan Authoring Rules

- Each stage plan starts with the writing-plans header, then **Depends on** and **Gated by** lines (ids/numbers from §1–§4), copies this roadmap's Global Constraints verbatim (it may add stage-specific lines), writes its own Review Focus (adding the tests this roadmap's Review Focus assigns to it), Task 0 from §6, tasks, and the §7 gate.
- Every name that crosses a stage boundary comes from §11. A stage may add private helpers only in files it owns (File Map) and must not export names that collide with §11. Names not in §11 are private and must not be imported by other stages.
- A stage never edits a file owned by a later stage. When it must touch a file owned by an earlier stage, the File Map lists it as a modification for that stage.
- Tests follow §11.10 (paths, fixture module, env flags). No test hardcodes a real number; digits come from `tests/fixtures/tracking-fixtures.ts`.
- Customer-facing strings are Korean exactly as the spec gives them; stage-authored copy that the spec does not give goes into `config/site.config.ts` (S03 owns it; later stages amend values only through a task that edits that file and its tests).

## 9. Budgets and Checks per Stage

| Stage | Budgets/checks the stage adds or must keep green |
|---|---|
| S01 | Font preload count ≤ 2 on `/` and `/{번호}`; no `opacity:0` in the SSR lookup section; real-number guard; security headers present |
| S02 | url-privacy (0 tracking-like values in third-party traffic); loader inserted only when `location.pathname === "/"` |
| S03 | Table tests; config invariants; module boundaries (no `lib/cs`/`lib/config/server` in client files) |
| S04 | Loading timeline (29.19 s pending response still renders pending); focus/live-region counts |
| S05 | Token contrast (text ≥ 4.5:1, UI/focus ≥ 3:1); no text ≤ 11 px in the ui-kit; first-view fonts ≤ 100 KB, ≤ 2 preloads |
| S06 | `/` HTML ≤ 35 KB; 0 infinite animations 8 s after load; `/` LCP ≤ 2.0 s Slow 4G; deep-link first paint ≤ 1.0 s Fast 4G; CLS ≤ 0.05; home first-view geometry (shortcut row bottom ≈ 500 px at 375×812, ≤ 550 px at 375×667) |
| S07 | JS: `/` initial ≤ 165 KB (fail > 175 KB, warn ≥ 145 KB, app ≤ 25 KB), result chunk ≤ 30 KB, `/[번호]` total ≤ 195 KB; result first view at 375×812 contains status, ETA and next action; scroll jump 0 on fill |
| S08 | CSS ≤ 25 KB; manual slot reserved min-height (CLS ≤ 0.05); per-style fonts not preloaded; per-style contrast; 48-shot matrix (local, `PW_VISUAL=1`) |
| S09 | Bulk run respects 60/min (≥ 1000 ms spacing) |
| S10 | NOT_FOUND ≤ 3 s at UNI-PASS latency 0.3 s, ≤ 6 s at 1.5 s; outage → `API_TIMEOUT` ≤ 15 s |
| S11 | Analytics requests carry 0 tracking-like values; CSP report endpoint stores/logs no number |

## 10. File Map

Actions: **C** create, **M** modify, **D** delete, **MV** `git mv` (history kept). "Stages" lists every stage that touches the file, in execution order. Files not listed are not touched by the renewal.

### 10.1 App routes and config

| Path | Stages | Notes |
|---|---|---|
| `app/layout.tsx` | M S01, M S03, M S05, M S08 | S01 fonts + remove AdSense; S03 `getSiteConfig()` build validation; S05 `signal` fonts, `data-style="signal"`, `import "./styles/tokens.css"`; S08 pre-paint script, `suppressHydrationWarning`, `data-follow-dark`, per-style fonts |
| `app/(public)/layout.tsx` | C S01, M S02, M S06, M S08, M S11 | S01 AdSense `<Script>` moved here; S02 `<AdLoader/>`; S06 header, `LiveAnnouncerProvider`, legacy footer; S08 `StylePicker` + new `SiteFooter`; S11 `<Analytics/>` (approval 13) |
| `app/(internal)/layout.tsx` | C S01 | no ads, `robots: noindex`, own minimal chrome |
| `app/page.tsx` → `app/(public)/page.tsx` | MV S01, M S02, M S06, M S08 | S02 stop reading `searchParams`; S06 `TrackingPage` + `revalidate = 300`; S08 idle extras (showcase, manual slot) |
| `app/[trackingNumber]/page.tsx` → `app/(public)/[trackingNumber]/page.tsx` | MV S01, M S06 | S06 3-way split, `?c=`, `robots` metadata |
| `app/privacy/page.tsx` → `app/(public)/privacy/page.tsx` | MV S01, M S02, M S08, M S11 | S02 policy text; S08 shell styling + config channels; S11 analytics disclosure (approval 13) |
| `app/internal/cs-helper/page.tsx` → `app/(internal)/internal/cs-helper/page.tsx` | MV S01, M S09 | S09 renders `InternalCsDesk` |
| `app/(internal)/internal/ui-kit/page.tsx` | C S05, M S08 | primitive gallery; S08 adds a style switcher row |
| `app/robots.ts` | C S01 | |
| `app/sitemap.ts` | C S01 | `/`, `/privacy` |
| `app/not-found.tsx` | C S01, M S06 | S06 restyle with tokens |
| `app/globals.css` | M S01, M S06, M S08 | S01 `--font-display` fallback; S06 remove legacy dark body/motion keyframes/unused classes, body uses tokens; S08 `scroll-padding-bottom` |
| `app/styles/tokens.css` | C S05 | `signal` tokens under `:root, [data-style="signal"]` |
| `app/styles/style-manifest.css` | C S08 | `manifest` tokens + slot CSS |
| `app/styles/style-night.css` | C S08 | `night` tokens + slot CSS |
| `app/api/track/route.ts` | M S10 | approval 5 |
| `app/api/csp-report/route.ts` | C S11 | |
| `app/icon.svg`, `public/favicon.svg` | — | unchanged |
| `next.config.js` → `next.config.ts` | D+C S01, M S02, M S08, M S11 | S01 TS config, `poweredByHeader:false`, `headers()` from `lib/security/headers.ts`; S02 `redirects()`; S08 passes the pre-paint hash; S11 passes `reportUri` |
| `tailwind.config.ts` | M S05, M S06 | S05 `tt-*` keys, drop unused legacy keys; S06 drop `pulse-glow` |
| `config/site.config.ts` | C S03, M S10 | S10 Part B flips `lookup.timeoutMs`, `lookup.notFoundServiceCaveat`, `lookup.stageMs` |
| `package.json`, `package-lock.json` | M S06, M S10, M S11 | S06 uninstall `framer-motion`; S10 remove `insforge:*` scripts (approval 12); S11 add analytics packages (approval 13). Axe (approval 13) is added by the first stage that runs with approval 13 granted (S05 if granted by then) |
| `.github/workflows/ci.yml` | M S01 | production-build E2E (`next start` + `PLAYWRIGHT_SKIP_WEB_SERVER=1`, `PW_MODE=production`) |
| `.github/workflows/deploy-insforge.yml` | D S10 | approval 12 |
| `insforge/functions/unipass-proxy.ts` | D S10 (or M under the fallback) | approval 12 |
| `.env.example` | M S10 | approval 12 |
| `playwright.config.ts` | — | unchanged; env flags are read inside specs |

### 10.2 Library

| Path | Stages | Notes |
|---|---|---|
| `lib/site.ts` | C S01 | origin, AdSense ids, `buildReturnLink` |
| `lib/privacy/number-patterns.ts` | C S01 | guard/traffic patterns |
| `lib/security/headers.ts` | C S01 | header rules builder |
| `lib/security/csp-report.ts` | C S11 | report parsing + number-free summary |
| `lib/privacy/url-scrub.ts` | C S02 | candidate B |
| `lib/privacy/session-restore.ts` | C S02 | |
| `lib/clipboard.ts` | C S02 | |
| `lib/ads/ad-gate.ts` | C S02, M S08 | S08 approval-7 policy |
| `lib/ads/ad-signals.ts` | C S02 | |
| `lib/config/types.ts` | C S03 | |
| `lib/config/schema.ts` | C S03 | |
| `lib/config/server.ts` | C S03 | |
| `lib/tracking/types.ts` | C S03 | all cross-stage domain types |
| `lib/tracking/time.ts` | C S03 | |
| `lib/tracking/number-format.ts` | C S03 | |
| `lib/tracking/template.ts` | C S03 | |
| `lib/tracking/glossary.ts` | C S03 | |
| `lib/tracking/notices.ts` | C S03 | |
| `lib/tracking/classify-failure.ts` | C S03 | |
| `lib/tracking/derive-view.ts` | C S03 | |
| `lib/tracking/derive/*.ts` | C S03 | private helpers of `derive-view.ts` only |
| `lib/tracking/loading-view.ts` | C S03 | |
| `lib/tracking/inquiry-copy.ts` | C S03 | |
| `lib/tracking/lookup-state.ts` | C S04 | |
| `lib/tracking/fetch-track.ts` | C S04 | |
| `lib/tracking/number-input.ts` | C S06 | |
| `lib/tracking/recommendations.ts` | C S08 | |
| `lib/cs/mismatch-storage.ts` (from `lib/services/cs-mismatch-storage.ts`) | MV+M S01, M S04, M S09 | S04 import path of template keys; S09 approval-14 storage |
| `lib/cs/mismatch-templates.ts` | C S04 | `CUSTOMS_MISMATCH_TEMPLATES` moved out of `lib/services/cs-reply-template.ts` |
| `lib/services/cs-reply-template.ts` | D S04 | replaced by `buildCsReply` + `mismatch-templates.ts` |
| `lib/cs/cs-reply.ts` | C S03 | internal-only |
| `lib/cs/cs-templates.ts` | C S03 | internal-only |
| `lib/cs/bulk-lookup.ts` | C S09 | |
| `lib/cs/phone-mask.ts` | C S09 | |
| `lib/cs/preview-outcomes.ts` | C S09 | fake outcomes for every state (0000 0000 0001, TEST 0000 0001) |
| `lib/style/styles.ts` | C S05, M S08 | S08 widens `IMPLEMENTED_STYLE_IDS` |
| `lib/style/tokens.ts` | C S05, M S08 | S08 adds `manifest`, `night` |
| `lib/style/prepaint.ts` | C S08 | |
| `lib/analytics/events.ts` | C S11 | approval 13 |
| `lib/analytics/url-template.ts` | C S11 | approval 13 |
| `lib/storefront.ts` | M S03, D S08 | S03 URLs re-exported from `config/site.config.ts` `channels`; S08 deletes after last consumer |
| `lib/services/customs.ts` | M S10 | approval 5 (+ proxy removal under approval 12) |
| `lib/services/lookup-log.ts` | C S10 | number-free structured logs |
| `lib/services/lookup-budget.ts` | C S10 | deadline helper |
| `lib/schemas.ts`, `lib/types.ts`, `lib/cache.ts`, `lib/rate-limit.ts`, `lib/delivery-carriers.ts`, `lib/utils.ts`, other `lib/services/*` | — | frozen (S10 may touch `lib/services/customstrack.ts` only to pass the deadline) |

### 10.3 Components

| Path | Stages | Notes |
|---|---|---|
| `components/HomePageClient.tsx` | M S01, M S02, M S04, D S06 | S01 remove SSR opacity; S02 scrub/restore/return link; S04 `useLookup` + `StatusSlot` + `LiveAnnouncerProvider` |
| `components/TrackingForm.tsx` | M S01, M S02, M S04, D S06 | S01 drop `SAMPLE_NUMBERS`, format hint; S02 drop `pushState`; S04 `aria-busy`, no `disabled` |
| `components/TrackingResultSummary.tsx` | D S04 | |
| `components/ErrorMessage.tsx`, `components/LoadingSpinner.tsx` | D S04 | |
| `components/ui/alert.tsx`, `components/ui/skeleton.tsx` | D S04 | |
| `components/CustomerCta.tsx` | M S04, M S06, D S07 | S04 `ctaState`/revenue from view; S06 delete floating variant |
| `components/RecommendedProducts.tsx` | M S04, D S08 | S04 gate by `view.revenue.recommendations` |
| `components/InternalCsHelper.tsx` | M S01, M S04, D S09 | S01 placeholder + [전체 삭제]; S04 `buildCsReply` |
| `components/StoreContactPopup.tsx` | D S06 (or M S06 under approval-1 fallback) | |
| `components/LogisticsFlow.tsx`, `components/AssuranceRail.tsx`, `components/ServiceGuide.tsx`, `components/StatusBanner.tsx`, `components/ui/badge.tsx` | D S06 | |
| `components/SiteHeader.tsx` | D S06 | replaced by `components/shell/SiteHeader.tsx` |
| `components/TimelineStep.tsx` | M S06, D S07 | S06 drops framer-motion |
| `components/CustomsTimeline.tsx`, `components/DeliveryTimeline.tsx` | D S07 | |
| `components/ReturnLinkButton.tsx` | C S02, D S07 | |
| `components/StorefrontShowcase.tsx`, `components/SiteFooter.tsx`, `components/AnimatedIcon.tsx` | D S08 | |
| `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/input.tsx` | D S09 | last consumer `InternalCsHelper` |
| `components/ads/AdLoader.tsx` | C S02, M S08 | |
| `components/ads/ManualAdSlot.tsx` | C S08 | |
| `components/primitives/LiveAnnouncer.tsx` | C S04 | S05 adopts it unchanged |
| `components/primitives/Button.tsx`, `ButtonLink.tsx`, `StatusChip.tsx`, `ToneIcon.tsx`, `JourneySpine.tsx`, `EtaDisplay.tsx`, `NumberBar.tsx`, `CopyButton.tsx`, `AffiliateLinkGroup.tsx`, `NoticeBanner.tsx`, `TalkLink.tsx` | C S05 | S08 may add `data-deco` children (aria-hidden) to `StatusChip`, `JourneySpine`, `EtaDisplay`; no prop changes |
| `components/status-slot/StatusSlot.tsx`, `ResultSummary.tsx`, `WorryLine.tsx`, `CopyInquiryButton.tsx` | C S04, D S07 | transitional |
| `components/status-slot/LoadingTimeline.tsx` → `components/result/LoadingCard.tsx` | C S04, MV+M S07 | |
| `components/status-slot/FailureNotice.tsx` → `components/result/FailureCard.tsx` | C S04, MV+M S07 | |
| `components/lookup/useLookup.ts` | C S04, M S06 | S06 restore/initial entry only; signature frozen (§11) |
| `components/lookup/LookupController.tsx` | C S06, M S07, M S08 | S07 lazy ResultView + LoadingCard; S08 recommendations, manual slot, ad signals |
| `components/lookup/LookupForm.tsx`, `FormatHint.tsx`, `NumberFinderHelp.tsx`, `ShortcutRow.tsx`, `InputAssist.tsx`, `TypicalDurations.tsx`, `FailureFallback.tsx` | C S06 | |
| `components/lookup/LegacyResultSection.tsx` | C S06, D S07 | transitional |
| `components/shell/TrackingPage.tsx` | C S06, M S08 | S08 idle extras |
| `components/shell/SiteHeader.tsx` | C S06 | |
| `components/shell/SiteFooter.tsx` | C S08 | |
| `components/shell/StylePicker.tsx` | C S08 | |
| `components/result/ResultView.tsx`, `result-module.ts`, `load-result-module.ts`, `StatusCard.tsx`, `NextActionBlock.tsx`, `LastEventLine.tsx`, `HistoryDetails.tsx`, `CarrierChooser.tsx`, `DeliveredHelp.tsx`, `SideColumn.tsx` | C S07 | |
| `components/supplementary/RecommendationList.tsx`, `StoreShowcase.tsx` | C S08 | |
| `components/internal/InternalCsDesk.tsx`, `DeliveryGuideTab.tsx`, `BulkResultTable.tsx`, `MismatchTab.tsx`, `MismatchRecordList.tsx`, `PreviewTab.tsx`, `NoticeStatusTab.tsx` | C S09 | |
| `components/analytics/Analytics.tsx` | C S11 | approval 13 |

### 10.4 Tests

| Path | Stages | Notes |
|---|---|---|
| `tests/fixtures/tracking-fixtures.ts` | C S01 | frozen after S01 (additions go to new fixture files) |
| `tests/fixtures/config-fixtures.ts` | C S03 | |
| `tests/support/prod-mode.ts` | C S01 | |
| `tests/support/network-capture.ts` | C S02 | |
| `tests/support/unipass-stub.ts` | C S10 | port of GAP2 `stub-net.cjs` with fixture numbers |
| `tests/tools/stage-screens.spec.ts` | C S01, M S04, M S06, M S07, M S08, M S09 | stages append scenarios only |
| `tests/unit/real-number-guard.spec.ts` | C S01, M S08 | S08 allowlists the manual ad slot id from config |
| `tests/unit/security-headers.spec.ts` | C S01 | |
| `tests/unit/mismatch-storage.spec.ts` | C S01, M S09 | |
| `tests/unit/session-restore.spec.ts`, `tests/unit/url-scrub.spec.ts` | C S02 | |
| `tests/unit/ad-gate.spec.ts` | C S02, M S08 | |
| `tests/unit/config.spec.ts` | C S03, M S10 | |
| `tests/unit/kst-time.spec.ts`, `number-format.spec.ts`, `template.spec.ts`, `glossary.spec.ts`, `notices.spec.ts`, `classify-failure.spec.ts`, `derive-view.spec.ts`, `loading-view.spec.ts`, `inquiry-copy.spec.ts`, `cs-reply.spec.ts`, `module-boundaries.spec.ts` | C S03 | |
| `tests/unit/lookup-state.spec.ts`, `tests/unit/fetch-track.spec.ts` | C S04 | |
| `tests/unit/tokens.spec.ts` | C S05, M S08 | |
| `tests/unit/number-input.spec.ts` | C S06 | |
| `tests/unit/normalizer.spec.ts` | C S07 | moved from `tests/tracking.spec.ts` |
| `tests/unit/recommendations.spec.ts`, `tests/unit/prepaint.spec.ts` | C S08 | |
| `tests/unit/bulk-lookup.spec.ts`, `tests/unit/phone-mask.spec.ts` | C S09 | |
| `tests/unit/track-route-latency.spec.ts` | C S10 | |
| `tests/unit/csp-report.spec.ts`, `tests/unit/analytics-events.spec.ts` | C S11 | |
| `tests/e2e/security-headers.spec.ts`, `seo-routes.spec.ts`, `internal-isolation.spec.ts` | C S01 | |
| `tests/e2e/url-privacy.spec.ts`, `session-restore.spec.ts`, `return-link.spec.ts`, `legacy-query-redirect.spec.ts` | C S02 | S11 extends url-privacy only through `tests/e2e/analytics-privacy.spec.ts` |
| `tests/e2e/status-slot.spec.ts`, `loading-timeline.spec.ts`, `failure-causes.spec.ts`, `cta-consistency.spec.ts` | C S04, M S07 | S07 rewrites selectors to the R3 DOM |
| `tests/e2e/ui-kit.spec.ts` | C S05, M S08 | |
| `tests/e2e/RULE-MAP.md` | C S06, M S07 | rule → assertion map of the existing E2E |
| `tests/e2e/home.spec.ts`, `deep-link.spec.ts`, `lookup-input.spec.ts` | C S06 | |
| `tests/e2e/result-states.spec.ts`, `result-layout.spec.ts`, `result-a11y.spec.ts` | C S07 | `result-a11y` needs approval 13 |
| `tests/e2e/recommendations.spec.ts`, `ad-placement.spec.ts`, `style-picker.spec.ts`, `style-a11y.spec.ts` | C S08 | `style-a11y` needs approval 13 |
| `tests/e2e/internal-desk.spec.ts`, `internal-bulk.spec.ts`, `internal-mismatch.spec.ts`, `internal-preview.spec.ts`, `internal-notices.spec.ts` | C S09 | |
| `tests/e2e/analytics-privacy.spec.ts` | C S11 | approval 13 |
| `tests/budgets/font-preload.spec.ts` | C S01, M S05, M S08 | |
| `tests/budgets/first-paint.spec.ts` | C S01 | no SSR `opacity:0` |
| `tests/budgets/html-budget.spec.ts`, `motion-budget.spec.ts`, `lcp-budget.spec.ts` | C S06 | |
| `tests/budgets/js-budget.spec.ts` | C S07 | |
| `tests/budgets/css-budget.spec.ts` | C S08 | |
| `tests/visual/style-matrix.spec.ts` (+ committed baselines under `tests/visual/style-matrix.spec.ts-snapshots/`) | C S08 | runs only with `PW_VISUAL=1` |
| `tests/tracking.spec.ts` | M S01, M S04, M S06, D S07 | S06 removes home/popup/motion/layout tests after `home.spec.ts` passes; S07 moves the rest |
| `tests/privacy.spec.ts` | M S01, M S02, M S04, M S07, M S08 | S07 moves the stale test to `result-states.spec.ts` |
| `tests/customs-estimate.spec.ts`, `tests/delivery-carriers.spec.ts` | M S01 | numbers only |
| `tests/track-api.spec.ts` | M S01, M S10 | |
| `tests/internal-cs-helper.spec.ts` | M S01, M S04, D S09 | |
| `tests/internal-access.spec.ts`, `tests/internal-auth.ts` | — | unchanged |

### 10.5 Docs and design

| Path | Stages | Notes |
|---|---|---|
| `DESIGN.md` | M S05, M S08 | S05 rewrite as the single source; S08 style sections |
| `design-system/README.md`, `_base.css`, `foundations/{colors,spacing,typography}.html`, `components/{buttons,cards,customer-cta,status,tracking-form}.html` | M S01 (`tracking-form.html` numbers), M S05, M S08 | S05 rewrites from tokens |
| `design-system/components/journey-spine.html` | C S05 | |
| `design-system/foundations/styles.html` | C S08 | |
| `Plan.md`, `docs/archive/2026-05/cs-ai-shipping-status-automation/*.md` | M S01 | real/unknown numbers → fixtures |
| `docs/insforge-deployment-runbook.md` | M S01, D S10 | S01 numbers; S10 deletes (approval 12) or keeps without the URL (fallback) |
| `DEPLOYMENT.md` | M S03, M S10 | S03 "운영 설정 바꾸기"; S10 InsForge removal |
| `AGENTS.md`, `CLAUDE.md`, `README.md` | M S10 | InsForge URL/mentions (approval 12) |
| `docs/ops/observability-baseline.md`, `adsense-settings-checklist.md`, `kpi-dashboard.md`, `strict-csp-decision.md`, `waf-internal-proposal.md` | C S11 | |
| `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` | this file | amended only via §5 contract changes and the §4 ledger |

---

## 11. SHARED CONTRACT

<!-- CONTRACT:BEGIN -->

### 11.1 Rules

1. Every export listed here keeps exactly this name, path, signature and meaning. Implementations may add private helpers in files the same stage owns; they are not imported across stages.
2. Types live in the listed modules only. Do not redeclare a contract type elsewhere; import it (`import type` for type-only use).
3. Client-bundle rules: `components/lookup/*`, `components/shell/*` client parts and `components/primitives/*` never import `zod`, `lib/schemas.ts`, `lib/config/schema.ts`, `lib/config/server.ts`, `lib/cs/*`, `lib/tracking/derive-view.ts`, or `components/result/ResultView.tsx` statically. Zod response parsing and `deriveTrackingView` load through `loadResultModule()` or the dynamic import inside `fetchTrack`.
4. `lib/cs/*` is imported only by `components/InternalCsHelper.tsx` (legacy, until S09 deletes it), `components/internal/*`, files under `app/(internal)/`, and tests. `lib/config/server.ts` is imported only by files without `"use client"` under `app/` or `components/shell/`, and by tests. `tests/unit/module-boundaries.spec.ts` (S03) enforces both by scanning import statements.
5. `lib/tracking/*` (except `fetch-track.ts`) is pure: no `window`, `document`, `fetch`, storage, or `Date.now()`/`new Date()` without an argument; time always comes from a `now: Date` parameter.
6. All Korean UI strings that tests select by are listed in §11.11; other copy comes from `config/site.config.ts`.
7. External links: `target="_blank"`, `rel="noopener noreferrer"` (plus `sponsored nofollow` when `isAffiliate`), accessible name `${label} 새 창으로 열기`.

### 11.2 Module Map

| Module | Owner | Kind |
|---|---|---|
| `lib/site.ts` | S01 | constants + `buildReturnLink` |
| `lib/privacy/number-patterns.ts` | S01 | pure |
| `lib/security/headers.ts` | S01 | pure (used by `next.config.ts`) |
| `lib/privacy/url-scrub.ts`, `lib/privacy/session-restore.ts`, `lib/clipboard.ts` | S02 | browser |
| `lib/ads/ad-gate.ts` | S02 | pure |
| `lib/ads/ad-signals.ts` | S02 | browser store |
| `config/site.config.ts` | S03 | data (client-importable named exports) |
| `lib/config/types.ts`, `lib/config/schema.ts`, `lib/config/server.ts` | S03 | types / zod / server |
| `lib/tracking/types.ts`, `time.ts`, `number-format.ts`, `template.ts`, `glossary.ts`, `notices.ts`, `classify-failure.ts`, `derive-view.ts`, `loading-view.ts`, `inquiry-copy.ts` | S03 | pure |
| `lib/cs/cs-reply.ts`, `lib/cs/cs-templates.ts` | S03 | internal-only pure |
| `lib/tracking/lookup-state.ts` | S04 | pure |
| `lib/tracking/fetch-track.ts` | S04 | browser (fetch) |
| `components/lookup/useLookup.ts` | S04 | client hook |
| `components/primitives/LiveAnnouncer.tsx` | S04 | client |
| `lib/style/styles.ts`, `lib/style/tokens.ts` | S05 | pure |
| `components/primitives/*` (others) | S05 | client-safe components |
| `lib/tracking/number-input.ts` | S06 | pure |
| `components/shell/TrackingPage.tsx`, `components/shell/SiteHeader.tsx` | S06 | server |
| `components/lookup/LookupController.tsx` | S06 | client |
| `components/result/*` | S07 | client (lazy chunk except `LoadingCard`, `load-result-module.ts`) |
| `lib/tracking/recommendations.ts` | S08 | pure |
| `lib/style/prepaint.ts` | S08 | pure (string + hash) |
| `components/supplementary/*`, `components/ads/ManualAdSlot.tsx`, `components/shell/{SiteFooter,StylePicker}.tsx` | S08 | |
| `lib/cs/bulk-lookup.ts`, `lib/cs/phone-mask.ts`, `lib/cs/preview-outcomes.ts`, `components/internal/*` | S09 | internal-only |
| `lib/services/lookup-log.ts`, `lib/services/lookup-budget.ts` | S10 | server |
| `lib/security/csp-report.ts`, `lib/analytics/*`, `components/analytics/Analytics.tsx` | S11 | |

### 11.3 `lib/site.ts` (S01)

```ts
import type { DeliveryCarrierCode } from "@/lib/types";

export const SITE_ORIGIN = "https://tracking.tipoasis.com";
export const ADSENSE_CLIENT_ID = "ca-pub-7351210358018620";
export const ADSENSE_PUBLISHER_DIGITS = "7351210358018620";
export const ADSENSE_LOADER_URL = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;

/** `${SITE_ORIGIN}/${encodeURIComponent(number)}` plus `?c=${carrier}` when carrier !== "AUTO". `number` is already normalized. */
export function buildReturnLink(number: string, carrier: DeliveryCarrierCode): string;
```

### 11.4 `lib/privacy/number-patterns.ts` (S01)

```ts
/** A run of 10+ digits, optionally separated by single spaces or hyphens: /\d(?:[ -]?\d){9,}/g */
export const DIGIT_RUN_PATTERN: RegExp;
/** HBL-like token: 3–4 ASCII letters immediately followed by 8–16 digits, not inside a longer letter/digit run. */
export const HBL_LIKE_PATTERN: RegExp;

/** Repo guard allowlist. A run (separators removed) is allowed when it:
 *  - starts with "0000" (fixtures), or
 *  - equals ADSENSE_PUBLISHER_DIGITS or one of `extraAllowed` (S08 passes the manual ad slot id), or
 *  - is a valid yyyymmddhhmmss timestamp (14 digits), or
 *  - is a fake mobile number 010-0000-dddd (digits "0100000dddd"). */
export function isAllowedDigitRun(run: string, extraAllowed?: readonly string[]): boolean;
export function findDisallowedDigitRuns(text: string, extraAllowed?: readonly string[]): readonly string[];

/** Traffic/copy check (strict): true when `text`, after repeated URI-decoding, contains any 10+ digit run
 *  other than ADSENSE_PUBLISHER_DIGITS or an all-zero placeholder ('0000 0000 0000' in the format hint), or any HBL-like token.
 *  Fixtures such as '000012345678' are NOT allowed here. */
export function containsTrackingLikeValue(text: string): boolean;
export function decodeRepeatedly(text: string): string;
```

Repo guard scope (`tests/unit/real-number-guard.spec.ts`): text files (`.ts .tsx .js .mjs .cjs .css .html .md .json` except `package-lock.json`) under `app/`, `components/`, `lib/`, `config/`, `tests/`, `docs/`, `design-system/`, `insforge/`, plus root `*.md`; skips `node_modules/`, `.next/`, `test-results/`, `playwright-report/` and snapshot images. The guard source contains no real-number fragment.

### 11.5 `lib/security/headers.ts` (S01)

```ts
export interface HeaderRule {
  readonly source: string;
  readonly headers: ReadonlyArray<{ readonly key: string; readonly value: string }>;
}
/** Single-segment number-like paths: "/:number((?!privacy$|internal$|api$)[^/.]+)" */
export const NUMBER_ROUTE_SOURCE: string;
export interface SecurityHeaderOptions {
  readonly extraScriptHashes?: readonly string[]; // S08: [`'sha256-${PREPAINT_SCRIPT_SHA256}'`] goes into the Report-Only script-src
  readonly reportUri?: string | null;             // S11: "/api/csp-report"
}
/** Rules for: all routes (nosniff, Referrer-Policy strict-origin, Permissions-Policy, HSTS includeSubDomains, enforced CSP, CSP-Report-Only);
 *  NUMBER_ROUTE_SOURCE (X-Robots-Tag noindex, nofollow); "/internal/:path*" (X-Robots-Tag noindex, nofollow; Cache-Control no-store; Referrer-Policy no-referrer). */
export function buildSecurityHeaders(options?: SecurityHeaderOptions): HeaderRule[];
```

`next.config.ts` (S01) default export: `{ output: "standalone", allowedDevOrigins: ["127.0.0.1"], poweredByHeader: false, headers: async () => buildSecurityHeaders({...}), redirects /* S02 */ }`. Relative imports only (`./lib/security/headers`), no `@/` alias inside `next.config.ts`.

### 11.6 Domain Types — `lib/tracking/types.ts` (S03)

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
  | { readonly kind: "holidayAffected"; readonly label: string; readonly date: EtaDate; readonly badge: string; readonly caption: string | null }
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

GuideKey mapping from data (`guideKeyForData`), in priority order: `ambiguous` (delivery.ambiguous and 0 events) → `lookupUnavailable` (delivery.lookupUnavailable and 0 events) → `pending` (isPending) → `delivered` (code 7) → `stale` (estimateStale) → `inTransit` (code 6) → `pickedUp` (code 5 and `currentStatus` matches `/(집화|집하|상품\s*인수)/`) → `handedToCarrier` (code 5) → `customsCleared` (code 4) → `customsWaiting` (codes 2–3) → `customsArrived` (code 1). Failures: `guideKeyForFailure(cause)`. Overdue applies only to `OVERDUE_CAPABLE_KEYS`.

CtaState mapping: errors → `"error"`; `pending` → `"pending"`; `customsArrived`, `customsWaiting` → `"customsWaiting"`; `customsCleared`, `handedToCarrier`, `pickedUp` → `"customsCleared"`; `inTransit`, `delivered`, `stale`, `lookupUnavailable`, `ambiguous` → same name. Overdue keeps the base `CtaState` and sets `data-overdue="true"`.

Spine mapping: codes 1–4 → `customs` (code 4 sets `handoffPending`), 5–6 → `domestic`, 7 → `arrived`; `pending`, `notFound` and other errors → `current: null`; `stale` → issue `stopped` at `current`; `lookupUnavailable` (0 events) → `current: "domestic"`, issue `cut` at `domestic`; `ambiguous` (0 events) → `current: "domestic"`, issue `branch` at `domestic`; code-based state with `delivery.lookupUnavailable` → issue `cut` at `domestic` (current unchanged) + `auxiliaryLine`; with `delivery.ambiguous` → issue `branch` at `domestic` + secondary carrier chips.

Worry dates (`businessDaysAfter` counts business days strictly after the base; holidays excluded): `customsArrived`/`customsWaiting` base = KST date of `estimatedCustomsClearanceDate` (fallback: last customs event date + `durations.stages.customs.max` calendar days), n = `durations.worry.afterEstimateBusinessDays` (1), kind `customs`; `customsCleared`/`handedToCarrier`/`pickedUp` base = KST date of the code-4 event (fallback `estimatedCustomsClearanceDate`), n = `durations.worry.afterClearanceBusinessDays` (2), kind `customs`; `inTransit` base = KST date of `estimatedDeliveryDate`, n = 1, kind `delivery`. `notFound`/`pending` use day-count sentences (`dateKey: null`). `isOverdue` = today(KST) > worry date.

### 11.7 Config — `lib/config/types.ts`, `lib/config/schema.ts`, `lib/config/server.ts`, `config/site.config.ts` (S03)

```ts
// lib/config/types.ts
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
}
export type LoadingConfig = Pick<SiteConfig, "lookup" | "notices">;
```

```ts
// config/site.config.ts — named exports (each `satisfies` its type) + the aggregate
export const channels: ChannelsConfig;
export const disclosures: DisclosuresConfig;
export const calendar: CalendarConfig;
export const durations: DurationsConfig;
export const lookup: LookupConfig;
export const stateGuide: Readonly<Record<GuideKey, GuideRow>>;
export const glossary: readonly GlossaryEntry[];
export const help: readonly HelpEntry[];
export const featuredProducts: readonly FeaturedItem[];
export const notices: readonly Notice[];
export const ads: AdsConfig;
export const style: StyleConfig;
export const siteConfig: SiteConfig;
```
Client code imports the smallest named export it needs (e.g. `lookup`, `notices`, `channels`, `disclosures`); only the lazy result chunk and server/internal code import `siteConfig`.

```ts
// lib/config/schema.ts
import { z } from "zod";
export const SiteConfigSchema: z.ZodType<SiteConfig, z.ZodTypeDef, unknown>; // object schema + superRefine invariants (§ Global Constraints "Config")
export function formatConfigIssues(error: z.ZodError): string;              // one Korean line per issue, 'path: message'

// lib/config/server.ts  (no "use client"; never imported by client files)
export function getSiteConfig(): SiteConfig;                                  // parses siteConfig once (memoized); throws Error(formatConfigIssues(...))
export function holidayCoverageWarnings(config: SiteConfig, now: Date): readonly string[]; // Korean warnings for days in the next 60 with no holiday data for that year
```
`app/layout.tsx` calls `getSiteConfig()` during render so `next build` fails on invalid config and logs `holidayCoverageWarnings` with `console.warn`.

### 11.8 Pure Functions (S03 unless noted)

```ts
// lib/tracking/time.ts
export type KstDateKey = string; // 'YYYY-MM-DD'
export type BusinessDayKind = "customs" | "delivery"; // delivery counts Saturday iff calendar.carrierDeliversSaturday
export function kstDateKey(instant: Date): KstDateKey;
export function parseInstant(iso: string): Date | null;
export function formatKstDate(value: Date | KstDateKey): string;      // '9월 30일 (수)'
export function formatKstDateTight(value: Date | KstDateKey): string; // '9월 29일(화)'
export function formatKstDateTime(instant: Date): string;             // '9월 23일 (수) 14:10'
export function formatKstShortDateTime(instant: Date): string;        // '9월 23일 14:10'
export function formatKstTime(instant: Date): string;                 // '14:10'
export function weekdayLabel(key: KstDateKey): string;                // '수'
export function addCalendarDays(key: KstDateKey, days: number): KstDateKey;
export function calendarDaysBetween(from: KstDateKey, to: KstDateKey): number;
export function isHoliday(key: KstDateKey, calendar: CalendarConfig): boolean;
export function isBusinessDay(key: KstDateKey, calendar: CalendarConfig, kind: BusinessDayKind): boolean;
export function businessDaysAfter(start: KstDateKey, count: number, calendar: CalendarConfig, kind: BusinessDayKind): KstDateKey;
export function holidayPeriodBetween(from: KstDateKey, to: KstDateKey, calendar: CalendarConfig): HolidayPeriod | null;

// lib/tracking/number-format.ts
export function groupTrackingNumber(raw: string): string; // letters prefix as one group, then digits in 4s from the left:
// '000012345678' → '0000 1234 5678'; '00001234567890' → '0000 1234 5678 90'; 'TEST00000001' → 'TEST 0000 0001'

// lib/tracking/template.ts
export type CopyToken = "etaDate" | "worryDate" | "lastEventDate" | "carrier" | "staleDays";
export const COPY_TOKENS: readonly CopyToken[];
export function tokensIn(template: string): readonly string[];
export function fillCopy(template: string, values: Readonly<Partial<Record<CopyToken, string>>>): string; // unknown/missing tokens throw in tests via config invariants; at runtime replaced by ''

// lib/tracking/glossary.ts
export function glossaryLabel(status: string, glossary: readonly GlossaryEntry[]): { readonly label: string; readonly original: string | null };

// lib/tracking/notices.ts
export type NoticeSlot = { readonly kind: "home" } | { readonly kind: "result"; readonly guideKey: GuideKey } | { readonly kind: "cs" };
export const NOTICE_PRIORITY: Readonly<Record<NoticeKind, number>>; // outage 0, delay 1, holiday 2, info 3
/** Active at `now` (startsAt ≤ now < endsAt), matching the slot, sorted by priority then latest startsAt.
 *  Result slots for "loading" | "temporaryDelay" | "offline" | "noResponse" keep only kind "outage". */
export function activeNotices(notices: readonly Notice[], now: Date, slot: NoticeSlot): readonly Notice[];
export function pickNotice(notices: readonly Notice[], now: Date, slot: NoticeSlot): Notice | null;
export function toNoticeView(notice: Notice): NoticeView;

// lib/tracking/classify-failure.ts
export function classifyFailure(input: FailureInput): FailureCause;
export function guideKeyForFailure(cause: FailureCause): GuideKey;
// invalidNumber→invalidNumber; notFound→notFound; rateLimited|upstreamTimeout|badGateway|network→temporaryDelay;
// offline→offline; clientTimeout→noResponse; serverError|contractViolation→serverError

// lib/tracking/derive-view.ts
export function deriveTrackingView(outcome: LookupOutcome, now: Date, config: SiteConfig): TrackingViewModel;
export function guideKeyForData(data: TrackResponseData, now: Date, config: SiteConfig): GuideKey;
export function worryDateKey(data: TrackResponseData, key: GuideKey, config: SiteConfig): KstDateKey | null;
export function isOverdue(worry: KstDateKey | null, now: Date): boolean;

// lib/tracking/loading-view.ts
export function deriveLoadingView(
  input: { readonly request: LookupRequest; readonly elapsedMs: number; readonly reducedMotion: boolean; readonly now: Date },
  config: LoadingConfig
): LoadingViewModel;
export function loadingStageAt(elapsedMs: number, config: LoadingConfig): LoadingStage;

// lib/tracking/inquiry-copy.ts
export function buildInquiryCopy(input:
  | { readonly kind: "status"; readonly number: NumberView; readonly stage: string; readonly lastEventAt: Date | null }
  | { readonly kind: "screenError"; readonly number: NumberView; readonly now: Date }
): string;
// status:      '[배송 문의] 조회번호 0000 1234 5678 / 마지막 단계 통관 대기 / 마지막 처리 9월 23일 14:10'
// screenError: '[배송 문의] 조회번호 0000 1234 5678 / 조회 화면 오류 / 9월 26일 14:05'
export function parseInquiryCopy(text: string): { readonly number: string } | null;

// lib/cs/cs-reply.ts (internal only)
export interface CsReply { readonly short: string; readonly long: string; readonly customerLink: string }
export function buildCsReply(view: TrackingViewModel, context: { readonly now: Date; readonly notices: readonly Notice[] }): CsReply;
// lib/cs/cs-templates.ts (internal only)
export const CS_TEMPLATES: Readonly<Record<GuideKey, { readonly short: string; readonly long: string }>>;

// lib/tracking/lookup-state.ts (S04)
export type LookupState =
  | { readonly phase: "idle"; readonly lastRequest: LookupRequest | null; readonly failureStreak: number }
  | { readonly phase: "loading"; readonly request: LookupRequest; readonly startedAt: number; readonly failureStreak: number }
  | { readonly phase: "settled"; readonly outcome: Extract<LookupOutcome, { kind: "success" }>; readonly settledAt: number }
  | { readonly phase: "error"; readonly outcome: Extract<LookupOutcome, { kind: "failure" }>; readonly settledAt: number };
export type LookupEvent =
  | { readonly type: "submit"; readonly request: LookupRequest; readonly at: number }
  | { readonly type: "succeeded"; readonly data: TrackResponseData; readonly at: number }
  | { readonly type: "failed"; readonly cause: FailureCause; readonly at: number }
  | { readonly type: "cancelled" }
  | { readonly type: "reset" };
export const INITIAL_LOOKUP_STATE: LookupState; // { phase: "idle", lastRequest: null, failureStreak: 0 }
export function lookupReducer(state: LookupState, event: LookupEvent): LookupState;
// failed → consecutiveFailures = previous failureStreak + 1 for the same number (reset to 1 for a different number); succeeded resets to 0

// lib/tracking/fetch-track.ts (S04)
export type FetchTrackResult =
  | { readonly kind: "success"; readonly data: TrackResponseData }
  | { readonly kind: "failure"; readonly input: FailureInput }
  | { readonly kind: "aborted" }; // caller aborted (cancel or superseded)
export function fetchTrack(request: LookupRequest, options: { readonly signal: AbortSignal; readonly timeoutMs: number }): Promise<FetchTrackResult>;
// POSTs { trackingNumber: request.number, carrierCode: request.carrier } to /api/track; parses with a dynamic import of "@/lib/schemas".

// lib/tracking/number-input.ts (S06)
export type DeepLinkDecision =
  | { readonly kind: "valid"; readonly number: string }
  | { readonly kind: "invalid"; readonly input: string }  // alphanumeric 6–30 after normalization but identifyTrackingNumber → UNKNOWN
  | { readonly kind: "notFound" };                        // everything else
export function normalizeInput(value: string): string;   // trim, remove spaces/hyphens, full-width → half-width, uppercase
export function classifyDeepLink(segment: string): DeepLinkDecision; // segment is decodeURIComponent-ed by the caller
export function parseCarrierParam(value: string | readonly string[] | undefined): DeliveryCarrierCode; // invalid → "AUTO"
export interface PasteExtraction { readonly number: string; readonly carrier: ConcreteCarrierCode | null }
export function extractFromPastedText(text: string): PasteExtraction | null; // null unless exactly one valid candidate
export type ConfusableHint = { readonly kind: "letterO" | "letterIl"; readonly suggestion: string; readonly message: string } | null;
export function detectConfusables(normalized: string): ConfusableHint; // message '영문 O가 섞여 있어요. 숫자 0인가요?'
export type PrecheckResult =
  | { readonly ok: true; readonly number: string }
  | { readonly ok: false; readonly reason: InvalidReason; readonly diagnosis: string }; // '지금 5자리예요' etc.
export function precheckNumber(value: string): PrecheckResult;

// lib/tracking/recommendations.ts (S08)
export interface SelectedRecommendation { readonly item: FeaturedItem; readonly showPrice: boolean; readonly weeklyLabel: boolean }
export function selectRecommendations(items: readonly FeaturedItem[], context: RecommendationContext, now: Date, limit: number): readonly SelectedRecommendation[];
```

### 11.9 Browser Modules, Hooks and Components

```ts
// lib/clipboard.ts (S02)
export type CopyOutcome = "copied" | "fallback"; // "fallback" → caller shows a selectable read-only text box
export function copyText(text: string): Promise<CopyOutcome>;
export type ShareOutcome = "shared" | "copied" | "fallback" | "dismissed";
export function shareOrCopyLink(input: { readonly url: string; readonly title: string; readonly preferShare: boolean }): Promise<ShareOutcome>;

// lib/privacy/url-scrub.ts (S02)
export const SCRUB_TIMEOUT_MS = 15000;
export function isNumberPath(pathname: string): boolean; // one segment, not privacy|internal|api, no dot
export type ScrubStatus = "scrubbed" | "notNeeded" | "failed";
/** Waits (rAF retries) for history.state.__NA, calls beforeReplace (stash), replaceState(null,'','/'), then confirms location.pathname === '/'. Never throws. */
export function scrubNumberFromUrl(options: { readonly timeoutMs: number; readonly beforeReplace: () => void }): Promise<ScrubStatus>;

// lib/privacy/session-restore.ts (S02)
export const RESTORE_KEY = "tt:restore";
export const RESTORE_TTL_MS = 1800000; // 30 minutes
export interface RestoreEntry { readonly number: string; readonly carrier: DeliveryCarrierCode; readonly savedAt: number }
export type NavigationKind = "navigate" | "reload" | "back_forward" | "prerender" | "unknown";
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function currentNavigationKind(): NavigationKind;
export function saveRestoreEntry(entry: RestoreEntry, storage?: StorageLike | null): void;           // overwrites the single entry; swallows storage errors
export function readRestoreEntry(input: { readonly now: number; readonly navigation: NavigationKind }, storage?: StorageLike | null): RestoreEntry | null; // only reload/back_forward, ≤ RESTORE_TTL_MS, zod-valid
export function clearRestoreEntry(storage?: StorageLike | null): void;

// lib/ads/ad-gate.ts (S02; S08 implements "afterAllowedResult")
export type AdTimingPolicy = "afterScrub" | "afterAllowedResult" | "neverOnNumberRoutes";
export const AD_TIMING_POLICY: AdTimingPolicy; // S02: "afterScrub" (approval 6) or "neverOnNumberRoutes" (fallback); S08: "afterAllowedResult" (approval 7)
export interface AdGateInput {
  readonly pathname: string;
  readonly entry: "home" | "deepLink";              // first document of this tab was '/' (or /privacy) vs a number route
  readonly scrub: ScrubStatus | "pending";
  readonly resultAdsAllowed: boolean | null;        // null until a result settles in this tab
  readonly scrolledPastLookup: boolean;
  readonly policy: AdTimingPolicy;
}
export function shouldInsertAdLoader(input: AdGateInput): boolean; // false whenever isNumberPath(pathname) or scrub is "failed"

// lib/ads/ad-signals.ts (S02)
export interface AdSignals {
  readonly entry: "home" | "deepLink";
  readonly scrub: ScrubStatus | "pending";
  readonly resultAdsAllowed: boolean | null;
  readonly scrolledPastLookup: boolean;
}
export function getAdSignals(): AdSignals;
export function setAdSignals(patch: Partial<AdSignals>): void;
export function subscribeAdSignals(listener: () => void): () => void;
```

```ts
// components/ads/AdLoader.tsx (S02) — client, mounted once in app/(public)/layout.tsx
export function AdLoader(): null; // inserts <script async crossorigin="anonymous" src={ADSENSE_LOADER_URL} data-ad-loader="adsense"> at most once per document

// components/ReturnLinkButton.tsx (S02, deleted by S07)
export function ReturnLinkButton(props: { readonly number: string; readonly carrier: DeliveryCarrierCode }): React.JSX.Element; // '다시 볼 링크 복사'

// components/primitives/LiveAnnouncer.tsx (S04)
export function LiveAnnouncerProvider(props: { readonly children: React.ReactNode }): React.JSX.Element;
// renders children + <div data-live-region="polite" role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
export function useAnnounce(): (message: string) => void; // clears then sets text so repeats are re-read

// components/lookup/useLookup.ts (S04; S06 may change internals only)
export interface UseLookupOptions {
  readonly config: LoadingConfig;
  readonly onSettled?: (outcome: LookupOutcome, now: Date) => void; // called once per settled request, outside render
}
export interface UseLookupResult {
  readonly state: LookupState;
  readonly loading: LoadingViewModel | null; // recomputed only at stage boundaries and elapsed steps
  readonly submit: (request: LookupRequest) => void; // aborts the previous request
  readonly retry: () => void;                        // re-submits the last request with entry "retry"
  readonly cancel: () => void;                       // back to idle, number kept
  readonly reset: () => void;
}
export function useLookup(options: UseLookupOptions): UseLookupResult;
// Owns: AbortController per submit, timeout (config.lookup.timeoutMs → FailureInput "timeout"), stage timers,
// reduced-motion detection, one auto re-lookup on the "online" event after an "offline" failure.

// components/status-slot/StatusSlot.tsx (S04, transitional, deleted by S07)
export interface StatusSlotProps {
  readonly state: LookupState;
  readonly loading: LoadingViewModel | null;
  readonly view: TrackingViewModel | null;
  readonly onAction: (action: ResultAction) => void;
  readonly headingRef: React.RefObject<HTMLHeadingElement | null>;
}
export function StatusSlot(props: StatusSlotProps): React.JSX.Element | null;
```

```ts
// components/primitives/* (S05). All are server-safe unless marked client. DOM is identical for every style.
export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant: "primary" | "secondary" | "text"; readonly size?: "md" | "lg"; readonly busy?: boolean; // md 44px, lg 52px; busy → aria-busy, never disabled
}): React.JSX.Element;
export function ButtonLink(props: {
  readonly href: string; readonly variant: "primary" | "secondary" | "text"; readonly size?: "md" | "lg";
  readonly external?: boolean; readonly sponsored?: boolean; readonly label: string;
  readonly placement?: TalkPlacement | StorePlacementId; readonly children?: React.ReactNode;
}): React.JSX.Element; // external → target _blank + aria-label `${label} 새 창으로 열기`; sets data-link-placement
export function ToneIcon(props: { readonly tone: Tone; readonly issue?: SpineIssue | null }): React.JSX.Element; // aria-hidden svg
export function StatusChip(props: { readonly tone: Tone; readonly text: string }): React.JSX.Element; // <span data-status-chip data-tone>
export function JourneySpine(props: { readonly spine: SpineView; readonly label?: string }): React.JSX.Element; // label default '배송 여정 4구간'
export function EtaDisplay(props: { readonly eta: EtaView }): React.JSX.Element | null; // null for kind "none"
export function NumberBar(props: { readonly number: NumberView; readonly carrierLabel: string; readonly actions?: React.ReactNode }): React.JSX.Element;
export function CopyButton(props: // client
  | { readonly mode: "copy"; readonly text: string; readonly label: string; readonly copiedLabel: string; readonly variant: "primary" | "secondary" | "text"; readonly onCopied?: (o: CopyOutcome) => void }
  | { readonly mode: "copyAndOpen"; readonly text: string; readonly label: string; readonly href: string; readonly variant: "primary" | "secondary" | "text"; readonly onCopied?: (o: CopyOutcome) => void }
): React.JSX.Element; // copyAndOpen renders an <a target=_blank>; copies in the same click; on "fallback" shows a read-only selectable textarea with the text
export function AffiliateLinkGroup(props: { readonly stores: StoreLinksView; readonly layout?: "row" | "stack" }): React.JSX.Element | null;
// root data-affiliate-group={placement}; first child <p data-affiliate-disclosure="coupang"> when disclosure !== null
export function NoticeBanner(props: { readonly notice: NoticeView; readonly variant: "banner" | "inline" }): React.JSX.Element; // never a live region
export function TalkLink(props: { readonly href: string; readonly label: string; readonly weight: ActionWeight; readonly placement: TalkPlacement }): React.JSX.Element;
```

```ts
// components/shell/TrackingPage.tsx (S06, server)
export function TrackingPage(props: { readonly entry: TrackingEntry }): React.JSX.Element;
// components/shell/SiteHeader.tsx (S06, server): 48px header, left '통관·배송 조회', right text link '문의' (톡톡, new tab), skip link '본문으로 건너뛰기'
export function SiteHeader(): React.JSX.Element;

// components/lookup/LookupController.tsx (S06, client)
export interface LookupControllerProps {
  readonly entry: TrackingEntry;
  readonly homeNotice: NoticeView | null; // server-picked; re-filtered with KST after mount
  readonly idleExtras: React.ReactNode;   // server-rendered below-the-fold blocks, rendered only in idle mode
}
export function LookupController(props: LookupControllerProps): React.JSX.Element;
// Renders, top to bottom: h1 (idle: '통관부터 국내 배송까지 한 번에 확인'; otherwise sr-only '배송 조회 결과'),
// form (idle/invalid) or NumberBar (loading/settled/error), status slot, recommendation slot, idleExtras (idle), ManualAdSlot (S08).

// components/result/ResultView.tsx (S07, lazy chunk ≤ 30 KB)
export interface ResultViewProps {
  readonly view: TrackingViewModel;
  readonly onAction: (action: ResultAction) => void;
  readonly headingRef?: React.Ref<HTMLHeadingElement>;
  readonly recommendationSlot?: React.ReactNode; // placed per view.revenue.recommendations and guideKey
  readonly readOnly?: boolean;                   // CS preview: actions inert, no focus moves
  readonly frame?: "responsive" | "mobile";      // "mobile" forces the 375px single-column layout
}
export function ResultView(props: ResultViewProps): React.JSX.Element;
// components/result/result-module.ts (S07): the lazy entry
export { ResultView } from "./ResultView";
export { deriveTrackingView } from "@/lib/tracking/derive-view";
export { siteConfig } from "@/config/site.config";
// components/result/load-result-module.ts (S07)
export type ResultModule = typeof import("./result-module");
export function loadResultModule(): Promise<ResultModule>; // memoized dynamic import
export function preloadResultModule(): void;              // called on submit/deep-link start
// components/result/LoadingCard.tsx (S07, initial bundle)
export function LoadingCard(props: { readonly loading: LoadingViewModel; readonly onCancel: () => void }): React.JSX.Element;

// components/ads/ManualAdSlot.tsx (S08)
export function ManualAdSlot(props: { readonly allowed: boolean; readonly slotId: string | null }): React.JSX.Element | null;
// components/supplementary/RecommendationList.tsx (S08)
export function RecommendationList(props: {
  readonly context: RecommendationContext; readonly items: readonly SelectedRecommendation[]; readonly disclosure: string;
}): React.JSX.Element | null; // root <section data-recommended-products={context}>; null when items is empty
// components/supplementary/StoreShowcase.tsx (S08, server)
export function StoreShowcase(): React.JSX.Element;
// components/shell/SiteFooter.tsx (S08, server), components/shell/StylePicker.tsx (S08, client)
export function SiteFooter(): React.JSX.Element;
export function StylePicker(): React.JSX.Element;

// components/internal/InternalCsDesk.tsx (S09, client)
export function InternalCsDesk(): React.JSX.Element;
// lib/cs/bulk-lookup.ts (S09)
export const BULK_MAX = 20;
export const BULK_MIN_INTERVAL_MS = 1000;
export interface BulkRow { readonly number: string; readonly status: "queued" | "running" | "done"; readonly outcome: LookupOutcome | null; readonly view: TrackingViewModel | null }
export function parseBulkInput(text: string): { readonly numbers: readonly string[]; readonly rejected: readonly string[]; readonly truncated: boolean };
export function runBulkLookup(numbers: readonly string[], carrier: DeliveryCarrierCode, options: {
  readonly signal: AbortSignal; readonly onRow: (index: number, row: BulkRow) => void; readonly now: () => Date;
}): Promise<void>;
export function sortBulkRows(rows: readonly BulkRow[]): readonly BulkRow[]; // problem, attention first
// lib/cs/phone-mask.ts (S09)
export function maskPhone(phone: string): string; // '010-****-1234'

// lib/cs/mismatch-storage.ts (S01 exports; S09 adds status + session/opt-in without renaming these)
export const MISMATCH_LEGACY_KEY = "tracking-tipoasis:customs-mismatch-records";
export const MISMATCH_TTL_DAYS = 14;
export interface MismatchRecord {
  readonly id: string; readonly phone: string; readonly content: string; readonly trackingMemo: string;
  readonly templateKey: CustomsMismatchTemplateKey; readonly createdAt: string; readonly updatedAt?: string;
}
export function createRecordId(): string;
export function normalizePhone(value: string): string;
export function getStoredRecordsSnapshot(): readonly MismatchRecord[];      // zod-validated, expired removed
export function getServerStoredRecordsSnapshot(): readonly MismatchRecord[];
export function subscribeStoredRecords(onChange: () => void): () => void;
export function writeStoredRecords(records: readonly MismatchRecord[]): void;
export function clearAllStoredRecords(): void;
// CustomsMismatchTemplateKey lives in lib/services/cs-reply-template.ts until S04 moves it to lib/cs/mismatch-templates.ts.

// lib/style/styles.ts (S05)
export const STYLE_IDS = ["signal", "manifest", "night"] as const;
export type StyleId = (typeof STYLE_IDS)[number];
export const DEFAULT_STYLE_ID: StyleId;      // "signal"
export const DARK_STYLE_ID: StyleId;         // "night"
export const STYLE_STORAGE_KEY = "tt:style";
export const STYLE_LABELS: Readonly<Record<StyleId, string>>; // { signal: '기본', manifest: '서류형', night: '어두운 화면' }
export const IMPLEMENTED_STYLE_IDS: readonly StyleId[];        // S05: ["signal"]; S08: all three
export function isStyleId(value: unknown): value is StyleId;
// lib/style/tokens.ts (S05; S08 adds manifest, night)
export const COLOR_TOKENS = [
  "--tt-ground", "--tt-surface", "--tt-raised", "--tt-ink", "--tt-muted", "--tt-rule", "--tt-control", "--tt-route",
  "--tt-primary", "--tt-on-primary", "--tt-accent", "--tt-link", "--tt-focus", "--tt-tile", "--tt-board",
  "--tt-tone-progress", "--tt-tone-progress-on", "--tt-tone-progress-ink",
  "--tt-tone-waiting", "--tt-tone-waiting-on", "--tt-tone-waiting-ink",
  "--tt-tone-attention", "--tt-tone-attention-on", "--tt-tone-attention-ink",
  "--tt-tone-problem", "--tt-tone-problem-on", "--tt-tone-problem-ink",
  "--tt-tone-done", "--tt-tone-done-on", "--tt-tone-done-ink"
] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];
export type ColorTokenSet = Readonly<Record<ColorToken, string>>; // hex values
export const STYLE_COLOR_TOKENS: Readonly<Partial<Record<StyleId, ColorTokenSet>>>;
export const CONTRAST_REQUIREMENTS: readonly { readonly fg: ColorToken; readonly bg: ColorToken; readonly min: 3 | 4.5 }[];
// lib/style/prepaint.ts (S08)
export const PREPAINT_SCRIPT: string;        // constant text: reads localStorage tt:style (try/catch), html[data-follow-dark], prefers-color-scheme; sets html[data-style]
export const PREPAINT_SCRIPT_SHA256: string; // base64 sha256 of PREPAINT_SCRIPT

// lib/analytics/events.ts (S11, approval 13)
export type AnalyticsEvent =
  | { readonly name: "lookup_start"; readonly entry: LookupEntry }
  | { readonly name: "lookup_settle"; readonly guideKey: GuideKey; readonly overdue: boolean; readonly wait: "lt1" | "1to3" | "3to8" | "8to25" | "25to45" | "timeout" }
  | { readonly name: "lookup_error"; readonly cause: FailureCause }
  | { readonly name: "action"; readonly kind: ActionKind; readonly placement: TalkPlacement | StorePlacementId; readonly guideKey: GuideKey }
  | { readonly name: "details_open" }
  | { readonly name: "notice_view"; readonly id: string }
  | { readonly name: "helpful"; readonly value: "yes" | "no" }
  | { readonly name: "style_select"; readonly style: StyleId };
// lib/analytics/url-template.ts (S11)
export function templatePath(pathname: string): string; // number routes → '/[trackingNumber]'; query, hash, referrer dropped by the caller
```

### 11.10 Tests: Layout, Fixtures, Env Flags

- `tests/unit/*.spec.ts`: Playwright tests without `page` (pure functions, file scans). `tests/e2e/*.spec.ts`: browser tests. `tests/budgets/*.spec.ts`: run only when `PW_MODE=production` (`test.skip(!IS_PRODUCTION_RUN, "budgets run against next start")`). `tests/visual/*.spec.ts`: only when `PW_VISUAL=1`. `tests/tools/stage-screens.spec.ts`: only when `PW_SHOTS` is `before` or `after`. `tests/fixtures/*.ts` and `tests/support/*.ts` are imports, not specs. Existing top-level `tests/*.spec.ts` stay where they are until the File Map moves or deletes them.
- Env flags: `PLAYWRIGHT_SKIP_WEB_SERVER=1` (existing), `PW_MODE=production`, `PW_SHOTS=before|after` + `PW_STAGE=S01…S11`, `PW_VISUAL=1`. Unit tests needing another time zone set `process.env.TZ = "America/New_York"` in `test.beforeAll` and restore it in `test.afterAll`.
- `tests/support/prod-mode.ts` (S01): `export const IS_PRODUCTION_RUN: boolean;` (`process.env.PW_MODE === "production"`).
- `tests/support/network-capture.ts` (S02):
  ```ts
  export interface CapturedRequest { readonly url: string; readonly method: string; readonly postData: string | null; readonly referer: string | null; readonly locationAtRequest: string | null }
  /** Routes every request whose origin differs from the page origin: records it, then aborts it. First-party requests to
   *  /_vercel/insights/*, /_vercel/speed-insights/* and /api/csp-report are recorded too (and continued). */
  export function captureThirdParty(page: Page): Promise<{ readonly requests: () => readonly CapturedRequest[] }>;
  export function assertNoTrackingValues(requests: readonly CapturedRequest[]): void; // uses containsTrackingLikeValue; /api/track POST body exempt
  ```
- **Fixture module `tests/fixtures/tracking-fixtures.ts` (S01, frozen afterwards):**
  ```ts
  import type { Page } from "@playwright/test";
  import type { TrackResponseData } from "@/lib/types";

  export const FIXTURE_NOW_ISO = "2026-09-26T14:05:00+09:00";
  export const FIXTURE_NOW: Date;
  export const FAKE = {
    domestic: "000012345678",       // '0000 1234 5678'
    domesticAlt: "000000000001",    // '0000 0000 0001'
    domestic10: "0000123456",
    domestic14: "00001234567890",   // '0000 1234 5678 90'
    hbl: "TEST00000001",            // 'TEST 0000 0001'
    hblAlt: "ABCD00000000",         // 'ABCD 0000 0000'
    cargo: "000012345678901234",
    invalidShort: "00001",
    invalidConfusable: "0000-0000-00O0",
    deepLinkInvalid: "ABCDE1",      // alphanumeric 6–30, identifyTrackingNumber → UNKNOWN
    phone: "010-0000-1234"
  } as const;
  export const FAKE_GROUPED: { readonly domestic: "0000 1234 5678"; readonly domesticAlt: "0000 0000 0001"; readonly hbl: "TEST 0000 0001"; readonly hblAlt: "ABCD 0000 0000" };

  export type FixtureState =
    | "pending" | "customsArrived" | "customsWaiting" | "customsReview" | "customsCleared" | "handedToCarrier" | "pickedUp"
    | "inTransit" | "inTransitWithDriver" | "delivered" | "stale" | "lookupUnavailableAuto" | "lookupUnavailableCarrier"
    | "ambiguous" | "customsWithCarrierCut";
  /** The 12 GAP3-06 variants: pending, customsArrived, customsWaiting, customsReview, customsCleared, pickedUp, inTransit,
   *  delivered, stale, lookupUnavailableAuto, lookupUnavailableCarrier, ambiguous. */
  export const GAP3_06_VARIANTS: readonly FixtureState[];
  /** Built with normalizeTrackingData({ ..., now: FIXTURE_NOW }) from canned events (2026-09 dates, 추석 9/24–26), then overrides. */
  export function trackData(state: FixtureState, overrides?: Partial<TrackResponseData>): TrackResponseData;

  export type FailureFixture = "invalid400" | "notFound404" | "rateLimited429" | "upstreamTimeout504" | "unavailable503" | "serverError500" | "badGatewayHtml502" | "contractViolation200";
  export const FAILURE_RESPONSES: Readonly<Record<FailureFixture, { readonly status: number; readonly contentType: string; readonly body: string }>>;
  export async function mockTrack(page: Page, response: TrackResponseData | FailureFixture, options?: {
    readonly delayMs?: number; readonly onRequest?: (body: unknown) => void;
  }): Promise<void>;
  export function successBody(data: TrackResponseData): string; // JSON { success: true, data }
  ```
- `tests/fixtures/config-fixtures.ts` (S03): `export const FIXTURE_CONFIG: SiteConfig;` (siteConfig with deterministic notices, holidays and featured items around `FIXTURE_NOW`), `export function withConfig(patch: DeepPartialConfig): SiteConfig;`, `export type DeepPartialConfig` (recursive partial).
- Test files per stage: see File Map §10.4.

### 11.11 UI Strings That Are Also Selectors

| String | Where | Owner |
|---|---|---|
| '통관·배송 조회' / '문의' | header left / right text link (`${label} 새 창으로 열기` = '문의 새 창으로 열기') | S06 |
| '본문으로 건너뛰기' | skip link | S06 (legacy exists) |
| '통관부터 국내 배송까지 한 번에 확인' | home h1 | existing / S06 |
| '조회번호 (HBL 또는 운송장)' | input label | existing |
| '국내 택배사' / '자동으로 찾기' / 'CJ대한통운' '우체국택배' '한진택배' '롯데택배' '로젠택배' | combobox label / options | existing |
| '조회하기' / '조회 중…' | submit / busy label | existing |
| '숫자 10~14자리 (예: 0000 0000 0000) · 영문 3~4자로 시작하는 HBL (예: ABCD 0000 0000) · 공백·하이픈은 자동으로 빼요' | format hint | S01 (current UI), S06 |
| '번호는 어디서 찾나요?' | details summary | S06 |
| '상담·스토어 바로가기' | region name; links '톡톡 상담' '네이버 스토어' '쿠팡 스토어' | S06 (approval 1) |
| '택배사를 CJ대한통운으로 맞췄어요' / '되돌리기' | paste notice | S06 |
| '영문 O가 섞여 있어요. 숫자 0인가요?' | confusable hint | S06 |
| '번호 형식이 달라요. 숫자 10~14자리 또는 영문 3~4자+숫자예요.' | invalid error (role=alert) | S03 config, S06 |
| '배송 조회 결과' | sr-only h1 in result modes | S06 |
| '배송 여정 4구간' / '해외 출발' '입항·통관' '국내 배송' '도착' / '멈춤' '끊김' '갈림' / '위치 확인 전' / '인계 대기' | spine | S05 |
| '번호 변경' (loading) / '번호 수정' / '다시 조회' / '조회 취소' | number bar and card actions | S04, S06, S07 |
| '조회하고 있어요' / '조회를 시작했어요' / '{seconds}초째' / '택배사 공식 조회로 먼저 보기' | loading | S03 config |
| '문의 내용 복사하고 톡톡 열기' / '톡톡으로 문의하기' / '다시 볼 링크 복사' / '받지 못하셨나요?' / '기사님께 전화' / '네이버 스토어 보기' / '쿠팡 스토어 보기' | actions | S03 config, S05 primitives |
| '아직 국내 배송 정보가 없어요' / '배송이 진행 중이에요' / '배송이 완료됐어요' | CTA h3 (pending / inTransit / delivered) | S03 config |
| '통관 정보 등록 전' / '국내 배송 중' / '배송 완료' / 'CJ대한통운 기사님 픽업 완료!' (`'{carrier} 기사님 픽업 완료!'`) | status h2 locked by E2E | S03 config |
| '정보 등록 후 안내' / '지금은 도착 예상일을 안내하기 어려워요' / '배송 완료일' / '도착 예상' / '예상했던 날짜' / '오늘 예상' | ETA | S03 config |
| '처리 내역 {n}건 보기' / '아직 처리 내역이 없어요' | history | S03 derive |
| '쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.' (until approval 9) / '쿠팡 링크는 쿠팡 파트너스 활동의 일환으로, 구매 시 운영자가 수수료를 받습니다.' (after) | disclosure; tests read `disclosures.coupang` | S03 config |
| '화면 스타일' / '기본' '서류형' '어두운 화면' / '화면 스타일을 {label}으로 바꿨어요' | style picker | S08 |
| '입력한 번호와 조회 결과는 서버 데이터베이스에 저장하지 않습니다.' | privacy (legal, locked) | existing |
| '배송 안내' '통관부호 불일치' '안내표 미리보기' '공지 현황' / '짧게 복사' '자세히 복사' '고객 링크 복사' / '전체 삭제' / '이 브라우저에 7일 보관' | internal desk | S01 ('전체 삭제'), S09 |
| Document title `'{docTitle} · 배송 조회'` (e.g. '통관 대기 중 · 배송 조회') | result states | S03, S07 |

### 11.12 Style Tokens, Tailwind Keys, Variant Slots

**CSS custom properties** (every style defines every name; `signal` also on `:root` as the fallback). Defined in `app/styles/tokens.css` (S05, `:root, [data-style="signal"]`), `app/styles/style-manifest.css` and `app/styles/style-night.css` (S08, `[data-style="manifest"]` / `[data-style="night"]`).

Color tokens (30; mirrored in `lib/style/tokens.ts`, parity checked by `tests/unit/tokens.spec.ts`):
`--tt-ground` `--tt-surface` `--tt-raised` `--tt-ink` `--tt-muted` `--tt-rule` `--tt-control` `--tt-route` `--tt-primary` `--tt-on-primary` `--tt-accent` `--tt-link` `--tt-focus` `--tt-tile` `--tt-board`
`--tt-tone-progress` `--tt-tone-progress-on` `--tt-tone-progress-ink`
`--tt-tone-waiting` `--tt-tone-waiting-on` `--tt-tone-waiting-ink`
`--tt-tone-attention` `--tt-tone-attention-on` `--tt-tone-attention-ink`
`--tt-tone-problem` `--tt-tone-problem-on` `--tt-tone-problem-ink`
`--tt-tone-done` `--tt-tone-done-on` `--tt-tone-done-ink`

Meaning: `-tone-X` = fill/lamp/stamp color; `-tone-X-on` = text/icon on an X fill; `-tone-X-ink` = X used as text/icon on `--tt-surface`. `--tt-muted` is never used on tone fills. `--tt-primary` is the one filled primary button.

Non-color tokens: `--tt-font-body` `--tt-font-display` `--tt-font-mono` `--tt-weight-display` `--tt-text-xs` (12px) `--tt-text-sm` (14px) `--tt-text-md` (16px) `--tt-text-lg` (20px) `--tt-text-xl` (24px, home h1) `--tt-text-eta` (32–40px per style) `--tt-leading-tight` `--tt-leading-body` `--tt-radius-button` `--tt-radius-card` `--tt-border-button` `--tt-focus-width` (3px) `--tt-focus-offset` (2px) `--tt-motion-fast` (150ms) `--tt-motion-base` (200ms) `--tt-motion-slow` (250ms) `--tt-ease` `--tt-gutter` `--tt-header-h` (48px) `--tt-column` (560px) `--tt-side` (320px) `--tt-status-field-max` `--tt-anchor-reserve`.

Contrast requirements (`CONTRAST_REQUIREMENTS`, every implemented style): 4.5:1 — ink/surface, ink/ground, muted/surface, muted/ground, link/surface, link/ground, on-primary/primary, each tone-X-on/tone-X, each tone-X-ink/surface, board/tile. 3:1 — control/surface, route/surface, focus/surface, focus/ground, each tone-X-on/tone-X as focus ring on fields.

Reference values from the Phase 3 canvases (S05 fills `signal`, S08 fills the others; values marked "choose" are picked by that stage and must pass the requirements):

| Token | signal (B) | manifest (A) | night (C) |
|---|---|---|---|
| ground | #EEEDE8 | #ECEFF3 | #0C1214 |
| surface | #FFFFFF | #FAFBFC | #131B1E |
| raised | #FFFFFF | #FAFBFC | #1A2428 |
| ink | #111110 | #14213A | #E6ECE9 |
| muted | #5C5B56 | #4A566B | #9AA8AC |
| rule | #D3D2CB | #C4CCD7 | #27343A |
| control | choose (≥ 3:1 on surface) | choose | #62757C |
| route | choose | #7D8899 | choose |
| primary / on-primary | #111110 / #FFFFFF (ink fill, radius 0) | #1B4A9A / #FFFFFF | #8FB3F0 / #0C1214 |
| accent | #2244D1 | #1B4A9A | #8FB3F0 |
| link | choose (not #2244D1) | choose (not #1B4A9A) | choose (not #8FB3F0) |
| focus | #111110 on surfaces; tone-X-on on fields | choose | choose |
| tile / board | = surface / = ink | = surface / = ink | #080C0E / #F1E8D4 |
| tone progress (fill/on) | #2244D1 / #FFFFFF | #1B4A9A (stamp) | #8FB3F0 (lamp) |
| tone waiting | #CFCEC6 / #111110 | #56627A | #A3AFB3 |
| tone attention | #F4BC00 / #111110 | #9A5A00 | #E8A847 |
| tone problem | #C8261D / #FFFFFF | #B3261E | #EF7C71 |
| tone done | #0B6B3E / #FFFFFF | #185C36 | #74CB9B |
| fonts | body system gothic; display system bold; mono DM Mono 500 latin (preload) | display Hahmlet 700 subset; body system; mono IBM Plex Mono 600 (preload:false) | display Gothic A1 700 subset; body system; mono JetBrains Mono (preload:false) |
| eta size | 40px | 32–40px (choose) | 36px |

**Tailwind keys** (S05, `tailwind.config.ts`): `colors.tt.{ground,surface,raised,ink,muted,rule,control,route,primary,on-primary,accent,link,focus,tile,board,progress,progress-on,progress-ink,waiting,waiting-on,waiting-ink,attention,attention-on,attention-ink,problem,problem-on,problem-ink,done,done-on,done-ink}` → classes `bg-tt-ground`, `text-tt-ink`, `bg-tt-progress`, `text-tt-progress-on` …; `fontFamily.tt-body|tt-display|tt-mono`; `fontSize.tt-xs|tt-sm|tt-md|tt-lg|tt-xl|tt-eta`; `borderRadius.tt-button|tt-card`; `transitionDuration.tt-fast|tt-base|tt-slow`. Legacy keys (`background`, `foreground`, `card`, `border`, `muted`, `mutedForeground`, `accent.*`) are removed (unused).

**Variant slots** (`data-slot`, S05 renders; S08 styles): `status-head` (signal: color field; manifest: stamp; night: lamp), `eta` (signal: large numeral; manifest: entry value; night: digit tiles), `journey` (signal: bar; manifest: waybill route; night: metro line), `button` (corner/fill via `--tt-radius-button`, `--tt-border-button`, `--tt-primary`). Per-style decoration is CSS under `[data-style="…"] [data-slot="…"]`; extra decorative elements carry `aria-hidden="true"` and `data-deco`. `EtaDisplay` always renders `<span class="sr-only">{date.label}</span>` plus an `aria-hidden` visual with `data-eta-part="month|day|weekday"` spans and one `data-eta-digit` span per digit.

### 11.13 `data-*` Hooks

| Hook | Element | Values | Owner |
|---|---|---|---|
| `data-style` | `<html>` | `signal` `manifest` `night` | S05 (static `signal`), S08 (pre-paint) |
| `data-follow-dark` | `<html>` | `1` `0` | S08 |
| `data-view-state` | LookupController dynamic-area root | `idle` `loading` `settled` `error` | S06 |
| `data-guide-key` | status card root; invalid-input error block | `GuideKey` | S04 (StatusSlot), S06 (input error), S07 |
| `data-overdue` | status card root | `true` `false` | S04, S07 |
| `data-tone` | status card root, `StatusChip` | `Tone` | S05, S07 |
| `data-cta-state` | 지금 할 일 block | `CtaState` | existing, S04, S07 |
| `data-eta-kind` | `EtaDisplay` root (and S04's ResultSummary ETA) | `EtaKind` | S04, S05 |
| `data-station` | spine `<li>` | `StationId` | S05 |
| `data-station-state` | spine `<li>` | `done` `current` `todo` | S05 |
| `data-issue` | spine `<li>` | `stopped` `cut` `branch` | S05 |
| `data-spine-current` | spine `<ol>` | `StationId` or `none` | S05 |
| `data-primary-end` | empty marker after the first-view primary flow | `true` | S07 |
| `data-recommended-products` | recommendations root | `RecommendationContext` | existing (legacy), S08 |
| `data-affiliate-group` | `AffiliateLinkGroup` root | `StorePlacementId` | S05 |
| `data-affiliate-disclosure` | disclosure `<p>`, first child of the group | `coupang` | S05 |
| `data-link-placement` | store/talk anchors | `StorePlacementId` or `TalkPlacement` | S05 |
| `data-slot` | variant slot roots | `status-head` `eta` `journey` `button` | S05 |
| `data-deco` | decorative aria-hidden elements | style-specific names | S08 |
| `data-status-chip` | `StatusChip` root | `true` | S05 |
| `data-live-region` | the one polite live region | `polite` | S04 |
| `data-number-bar` | `NumberBar` root | `true` | S05 |
| `data-lookup-form` | lookup `<form>` | `true` | S06 |
| `data-shortcut-row` | shortcut region | `full` `talkOnly` | S06 |
| `data-notice-kind` | `NoticeBanner` root | `NoticeKind` | S05 |
| `data-loading-stage` | `LoadingTimeline` / `LoadingCard` root | `LoadingStage` | S04, S07 |
| `data-failure-cause` | failure card root | `FailureCause` | S04, S07 |
| `data-ad-exclude` | lookup and result areas | `true` | existing, S06, S07 |
| `data-ad-loader` | injected AdSense `<script>` | `adsense` | S02 |
| `data-ad-slot` | manual slot `<aside>` | `manual` | S08 |
| `data-style-picker` | picker fieldset | `true` | S08 |
| `data-internal-tab` | internal tab panels | `delivery` `mismatch` `preview` `notices` | S09 |
| `data-tracking-result-summary`, `data-delivery-estimate`, `data-customs-estimate`, `data-motion-*`, `data-input-shake`, `data-logistics-flow`, `data-contact-popup`, `data-storefront-showcase` | legacy | removed with their components (S04–S08) | — |

### 11.14 Storage Keys

| Key | Storage | Value | Owner |
|---|---|---|---|
| `tt:restore` | sessionStorage | `RestoreEntry` JSON (1 entry, 30 min) | S02 |
| `tt:style` | localStorage | `signal` \| `manifest` \| `night` | S08 |
| `tracking-tipoasis:customs-mismatch-records` | localStorage | S01: `{ "v": 1, "records": MismatchRecord[] }` with 14-day TTL (legacy array migrated on read) | S01; removed by S09 migration when approval 14 is granted |
| `tt:cs-mismatch` | sessionStorage (default) / localStorage (7-day opt-in) | `{ "v": 2, "keepUntil": string \| null, "records": MismatchRecord[] }` | S09 (approval 14) |

No other storage keys, cookies or IndexedDB are used by the application.

<!-- CONTRACT:END -->

---

## 12. Self-Review

- **Spec coverage:** §1 success criteria → S02 (third-party 0), S03/S04 (contradictions 0), S03 (config), S06 (home first view, deep-link first paint, LCP), S07 (result first view), S04/S07 (error position/focus), S11 (inquiry KPI). §3 → S01, S02, S06, S07. §4 → S01 (example buttons), S06. §5 → S03, S04, S07, S10. §6–§7 → S03, S05, S07 (S04 for R2). §8 → S03 invariants, S05, S06, S07, S08. §9 → S03 (S10 flips). §10 → S01, S04, S09, S11 (WAF, subdomain proposal). §11 → S10 (logs), S11. §12 → budgets table §9 + S01 headers. §13 → S05, S08. §14 → File Map + §11. §15 → §1 release mapping. §16 → §4. §17 → §3. §18 keep-list → Global Constraints.
- **Placeholder scan:** values left for a stage to choose are named with their constraint ("choose … ≥ 3:1"); no TBD/TODO.
- **Type consistency:** `GuideKey`, `CtaState`, `FailureCause`, `StationId`, `StorePlacementId`, `TalkPlacement`, `RecommendationContext` are declared once in `lib/tracking/types.ts`; config types import them; hooks in §11.13 use the same unions.
- **Ownership:** every file in §10 has a single creating stage; later modifications are listed in execution order; transitional files (`components/status-slot/*`, `LegacyResultSection.tsx`, `ReturnLinkButton.tsx`) have a deleting stage.
