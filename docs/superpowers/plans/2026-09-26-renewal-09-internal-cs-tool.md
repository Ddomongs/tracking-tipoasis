# S09 — Internal CS Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-page CS helper with a four-tab internal desk at `/internal/cs-helper` — 배송 안내 (paste up to 20 numbers, look them up one per second, see every row's tone, status, ETA, worry date and last event with problems first, open the customer's own screen at 375 px and copy the short reply, the long reply or the customer link), 통관부호 불일치 (masked phones, 작성·발송·회신·완료 status, zod-validated storage with the approval-14 retention), 안내표 미리보기 (every state with fake numbers, customer screen and CS reply side by side) and 공지 현황 (active, scheduled and expired notices with a KST date simulator for notices, holiday badges and overdue screens).

**Architecture:** Pure internal modules under `lib/cs/` do the work — `bulk-lookup.ts` (parse a paste, run S04's `fetchTrack` sequentially at ≥ 1000 ms, derive each view, sort), `phone-mask.ts`, `preview-outcomes.ts` (fake outcomes for every state, anchored at any `now`), `notice-status.ts` (notice windows, placements and the holiday of a KST day) and the existing `mismatch-storage.ts` (status field; approval-14 storage). Client components under `components/internal/` only render them: `InternalCsDesk` (tablist/tab/tabpanel, `?tab=` deep link) hosts `DeliveryGuideTab` + `BulkResultTable`, `MismatchTab` + `MismatchRecordList`, `PreviewTab` and `NoticeStatusTab`; the customer's screen is always S07's `ResultView` (`readOnly`, `frame="mobile"`) under S05's `NumberBar`, fed by S07's `deriveResultView`, and every reply is S03's `buildCsReply` over that same view. The legacy `InternalCsHelper` is first split into the desk's two tabs (so its suite keeps running), then replaced tab by tab and deleted with the last `components/ui/*` files.

**Tech Stack:** Next.js 16.3.6 App Router (Turbopack), React 19.3, TypeScript strict, Tailwind CSS 3.4 with the S05 `tt-*` keys, zod 3.25 (storage validation only), S05 primitives, S07 `ResultView`, Playwright 1.55 (the only runner; `tests/unit/*` run without a page).

**Spec:** `docs/superpowers/specs/2026-09-26-tracking-renewal-ia-design.md` — §10 내부 CS 도구 (격리, 탭 4개, 답변 생성, 연결과 한계), §4 (fake numbers only), §6–§7 (the states the preview shows), §9 (notices, holidays, KST), §12 (WCAG 2.2 AA, 44 px targets, keyboard), §14 (component boundaries: "CS 미리보기도 같은 컴포넌트", `InternalCsHelper` split, test contract item 1), §15 R5, §16 items 13 and 14, §17 Q2 (links in CS replies). **Roadmap and shared contract:** `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` (§4 approvals, §6 Task 0, §7 gate, §9 budget "Bulk run respects 60/min (≥ 1000 ms spacing)", §10 File Map, §11 contract — every cross-stage name below is used exactly as written there). **Upstream plans consumed:** S01 (`lib/cs/mismatch-storage.ts`, fixtures, stage-screens tool, `tests/e2e/internal-isolation.spec.ts`), S03 (`lib/tracking/*` pure modules, `lib/cs/cs-reply.ts`, `config/site.config.ts`, `tests/fixtures/{config-fixtures,derive-scenarios}.ts`), S04 (`fetchTrack`, `lib/cs/mismatch-templates.ts`, the helper's `buildCsReply` wiring and its suite), S05 (`Button`, `CopyButton`, `NumberBar`, `StatusChip`, tokens), S06 (`normalizeInput`, `precheckNumber`, `tests/e2e/RULE-MAP.md`), S07 (`ResultView`, `deriveResultView`, `ResultViewProps.failureCause`).

**Depends on:** S03, S04, S07 (and through them S01, S02, S05, S06 — all merged into `claude/tipoasis-tracking-renewal-ae0e3a` before this stage starts).

**Gated by:** approval 14 (Task 14: tab-only `sessionStorage` with the '이 브라우저에 7일 보관' opt-in and the legacy-key migration), approval 13 (Task 15: axe on the desk with `@axe-core/playwright`; roadmap §4 does not list S09 under approval 13 — reported as a contract deviation).

**Release / order:** R5, user order #5. Branch `renewal/s09-internal-cs-tool`.

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

**S09-specific constraints**
- The desk lives only at `/internal/cs-helper` in the `(internal)` route group (basic auth in `proxy.ts`, `noindex`, `no-referrer`, no ads, no analytics, no public header). No public page imports an S09 file. `lib/cs/*` is imported only by `components/internal/*`, files under `app/(internal)/` and tests (contract §11.1 rule 4, enforced by S03's `tests/unit/module-boundaries.spec.ts`).
- Numbers: the desk shows and copies only what staff paste. The preview uses only `0000 0000 0001` and `TEST 0000 0001` (spec §10); tests use only `tests/fixtures/tracking-fixtures.ts` and `tests/fixtures/derive-scenarios.ts`. No lookup result, number or reply is stored in the browser or on the server (the desk says '조회 결과와 복사 이력은 저장하지 않습니다.').
- The bulk run calls `/api/track` only through S04's `fetchTrack`, one number at a time, never two at once, with at least 1000 ms between request starts (spec §10 "분당 60건 제한"), at most 20 numbers per run.
- "The customer's screen" on the desk is S07's `ResultView` with `readOnly` and `frame="mobile"`, rendering `deriveResultView(outcome, now)` (S07 addition 10: the exact view the customer page renders, approval-3 fallback included) under S05's `NumberBar`. CS replies are S03's `buildCsReply(view, { now, notices: siteConfig.notices })` over that same view. The desk never re-words a state.
- Customer phone numbers are displayed only as `maskPhone(phone)` ('010-****-1234'); the full number leaves the page only through the explicit [휴대폰 번호 복사] action.
- Staff-only copy (labels, notes, headings of the desk) is Korean and lives in the S09 component that renders it; customer-facing wording comes only from `config/site.config.ts`, `lib/cs/cs-templates.ts` and S07's `ResultView`. §11.11 selector strings are used verbatim: '배송 안내' '통관부호 불일치' '안내표 미리보기' '공지 현황', '짧게 복사' '자세히 복사' '고객 링크 복사', '전체 삭제', '이 브라우저에 7일 보관'.
- Styling uses S05 tokens and primitives only (`Button`, `CopyButton`, `NumberBar`, `StatusChip`, `tt-*` Tailwind keys, `.tt-focus`). No `components/ui/*`, no lucide icons, no glow, gradient or blur. The desk follows the page's `html[data-style]` like every other page.
- Lint is eslint-config-next 16 with eslint-plugin-react-hooks 7 (`set-state-in-effect`, `refs`, `purity`, `static-components` are errors): no `setState` in an effect body, no `ref.current` during render, no `Date.now()`/`new Date()` during render (the desk's reference time is a `useSyncExternalStore` snapshot read once on the client; stored ISO strings are read with `parseInstant`), no component declared inside a component.
- Stage screenshots go to `test-artifacts/stage-screens/S09-{before,after}/` (S01 "Additions to the contract" item 1); read `test-results/…` in the verbatim Task 0 / gate text as `test-artifacts/…`.
- Approval 14 decides only where mismatch drafts are kept (tab-only `sessionStorage` + 7-day opt-in, versus S01's 14-day `localStorage`). Masking, the status field, zod validation and [전체 삭제] ship either way.
- No real or unidentified tracking number, phone number or fragment of one appears in code, tests, test titles, commit messages or screenshots. Numbers that tests need in bulk are generated at runtime from the `0000` prefix.

## Review Focus

Conditions the spec implies but no requirement line names; each is pinned by a test in the owning task.

1. **Staff paste a whole chat, not a clean list** (the customer's '[배송 문의] …' copy, greetings, an order memo, the customer's phone '010-0000-1234', a date): only tracking numbers become rows; a phone-shaped line is never looked up, even without hyphens or with '+82'; lines without digits are skipped silently; lines with digits that are not numbers are listed back to staff. Owner: Task 2 (`tests/unit/bulk-lookup.spec.ts` "phone-shaped lines are rejected, never looked up", "a pasted chat keeps only the numbers: the inquiry copy is read, digit-free lines are skipped"), Task 10 (`tests/e2e/internal-bulk.spec.ts` "pasted inquiry copies, chat lines and bad lines").
2. **A second run started while the first is still answering** (staff correct the list and press [조회 시작] again, or press [멈추기]): the old run's late answers never overwrite the new table and nothing is looked up after [멈추기]. Owner: Task 3 (unit "stopping mid-request puts that row back in the queue and looks nothing else up", "stopping during the wait looks nothing else up", "the default wait ends at once when stopped"), Task 10 (E2E "a new run replaces the previous one; the old run's late answer is ignored", "at most 20 numbers run, and [멈추기] stops the rest").
3. **A staff PC that is not on Korean time** (a laptop set to UTC or `America/New_York`): the notice simulator's default time, its lists and the simulated screens are KST, and a typed time is read as KST. Owner: Task 12 (`tests/e2e/internal-notices.spec.ts` "a browser in America/New_York" › "still simulates Korean time"; Task 5's UTC-day row in "holidayAt names the holiday of the KST day, even when the UTC date is the day before").
4. **A locked-down office browser that refuses the clipboard**: every copy button on the desk leaves the exact reply, link or phone in a selected read-only box instead of failing silently. Owner: Task 10 (E2E "blocked clipboard: [짧게 복사] leaves the reply in a selected box").
5. **Drafts saved by an older version or damaged storage** (records without `status`, an unknown status, a legacy bare array, a `keepUntil` in the past, broken JSON): the tab opens, keeps every valid record, drops the rest and rewrites storage once. Owner: Task 6 (unit "records saved before statuses existed read as 작성 and are rewritten once", "an unknown status drops the record"), Task 14 (unit "a kept payload is valid until keepUntil and gone at keepUntil", "a v1 payload, garbage or nothing is not a v2 list"; E2E "a kept list is deleted once its 7 days are over"); S01's "garbage, foreign versions and non-objects give an empty list" stays green.

## Additions to the contract

Everything below is additive; no §11 name is renamed or retyped. Each item goes into the stage summary as a contract deviation so the roadmap can be amended (roadmap §5 "Contract changes").

1. **`InternalCsDesk` takes an optional prop:** `InternalCsDesk(props: { readonly initialTab?: InternalTabId }): React.JSX.Element` (contract: no props). The page reads `?tab=delivery|mismatch|preview|notices` on the server; anything else opens 배송 안내. `/internal/cs-helper` therefore renders dynamically (`ƒ`), which is harmless for a `no-store` internal page.
2. **`components/internal/tabs.ts` (plain module, no `"use client"`):** `INTERNAL_TAB_IDS = ["delivery", "mismatch", "preview", "notices"] as const`, `type InternalTabId`, `INTERNAL_TAB_LABELS`, `DEFAULT_INTERNAL_TAB`, `parseInternalTab(value)`. The server page cannot call functions exported from a client module, so the ids live here.
3. **`runBulkLookup` options gain optional fields** (declared as `BulkRunOptions`): `fetcher?: BulkFetcher` (default `fetchTrack`), `wait?: (ms, signal) => Promise<void>` (default: an abortable `setTimeout`), `derive?: (outcome, now) => TrackingViewModel` (default `deriveTrackingView(outcome, now, siteConfig)`; the desk passes S07's `deriveResultView`), `timeoutMs?: number` (default `siteConfig.lookup.timeoutMs`). `parseBulkInput` returns the named type `BulkParseResult`. Extra exports: `initialBulkRows(numbers)`, `TONE_LABELS`, `BulkRowSummary`, `summarizeBulkView(view)`, `BulkFetcher`.
4. **`lib/cs/preview-outcomes.ts` exports:** `PREVIEW_NUMBERS`, `PREVIEW_DRIVER_PHONE`, `PREVIEW_OVERDUE_AGE_DAYS`, `PREVIEW_SCENARIO_IDS`, `PreviewScenarioId`, `PreviewScenario`, `buildPreviewScenario(id, now)`, `buildPreviewScenarios(now)`.
5. **New S09-private module `lib/cs/notice-status.ts`:** `NoticeWindow`, `NoticeGroups`, `NoticePlacement`, `noticeWindowAt(notice, now)`, `groupNoticesAt(notices, now)`, `noticePlacementAt(notices, now)`, `holidayAt(now, calendar)`.
6. **`MismatchRecord` gains the required field `status: MismatchStatus`** (records stored without it read as `"draft"`); `lib/cs/mismatch-storage.ts` adds `MISMATCH_STATUSES`, `MismatchStatus`, `MISMATCH_STATUS_LABELS` ('작성' '발송' '회신' '완료'), `isMismatchStatus`, `withRecordStatus`. With approval 14 (Task 14) it also adds `MISMATCH_KEY = "tt:cs-mismatch"`, `MISMATCH_KEEP_DAYS = 7`, `MismatchRetention`, `getRetentionSnapshot`, `getServerRetentionSnapshot`, `setKeepInBrowser`, `ParsedStore`, `parseStorePayload`, `serializeStorePayload` (the §11.14 row's v2 payload), keeping every S01 name with its meaning.
7. **File Map additions (all C S09 unless noted):** `components/internal/tabs.ts`, `components/internal/ui.ts` (shared class lists), `components/internal/ScreenAndReply.tsx` (375 px customer screen + replies, used by three tabs), `lib/cs/notice-status.ts`, `tests/unit/preview-outcomes.spec.ts`, `tests/unit/notice-status.spec.ts`, `tests/support/internal-desk.ts` (desk opener, clipboard recorder and blocker, request start times), `tests/e2e/internal-a11y.spec.ts` (approval 13), `docs/ops/internal-subdomain-proposal.md` (spec §10 "공유 목록 단계에서는 서브도메인 분리를 제안"); modifications: `tests/e2e/RULE-MAP.md` (M S09, section I), `components/InternalCsHelper.tsx` (M S09 transitional `section` prop in Task 8, then D S09), `tests/internal-cs-helper.spec.ts` (M S09 selector re-point in Task 8, then D S09). With approval 13 and no earlier stage having added it: `package.json`, `package-lock.json` (M S09, `@axe-core/playwright` dev dependency).
8. **`data-*` hooks (internal pages only):** `data-internal-tab` (contract, panels), `data-internal-tab-button`, `data-bulk-table`, `data-bulk-row` (number), `data-bulk-status` (`queued|running|done`), `data-bulk-detail` (number), `data-bulk-rejected`, `data-bulk-progress`, `data-preview-frame` (`375`), `data-reply-pair`, `data-preview-scenario` (id), `data-mismatch-record` (id), `data-mismatch-status` (`MismatchStatus`), `data-mismatch-empty`, `data-mismatch-retention` (`ttl14|session|kept`), `data-notice-group` (`active|scheduled|expired`), `data-notice-id`, `data-notice-simulation` (ISO instant), `data-notice-places`, `data-place` (`home|cs|results`), `data-notice-holiday` (holiday id or `none`), `data-simulated-screen` (`customsWaiting|customsWaitingOverdue`).
9. **Budget output line for G8:** `[budget] bulk spacing min: N ms (min 1000 ms)` (Task 10).

## Contract deviations

1. **The desk imports S07's `ResultView` and `deriveResultView` statically** instead of through `loadResultModule()` (S07 open issue 7). The internal page has no JS budget, the preview must render synchronously for screenshots, and the public result chunk stays lazy (S07's `tests/unit/result-module.spec.ts` checks only S07's initial-bundle files; S07's `tests/budgets/js-budget.spec.ts` still runs in G6).
2. **Approval 13 gates an S09 task (Task 15)** although roadmap §4 row 13 lists only S05/S06/S07/S08/S11; the spec's §10 names the preview tab as an axe regression surface.
3. **`tests/e2e/RULE-MAP.md` gains section I** for the internal suite (File Map lists only S06/S07). If S08 appended its own section first, S09's section goes after it; a merge conflict at the end of that file is resolved by keeping both sections.
4. **Stage screens live in `test-artifacts/stage-screens/`** (S01 addition 1).

## File Structure

| File | Action (task) | Responsibility |
|---|---|---|
| `lib/cs/phone-mask.ts` | Create (1) | `maskPhone`: prefix + `*` + last 4 digits; `+82` read as `0` |
| `tests/unit/phone-mask.spec.ts` | Create (1) | Masking rows, nothing of the middle leaks |
| `lib/cs/bulk-lookup.ts` | Create (2), Modify (3) | Paste parsing, row summaries, sort (2); sequential run at ≥ 1000 ms (3) |
| `tests/unit/bulk-lookup.spec.ts` | Create (2), Modify (3) | Parsing, sort and summary rows (2); spacing, abort, failures, derive (3) |
| `lib/cs/preview-outcomes.ts` | Create (4) | Fake outcomes for every state, relative to `now` |
| `tests/unit/preview-outcomes.spec.ts` | Create (4) | Every state on every day around 추석 and 설; fake numbers only |
| `lib/cs/notice-status.ts` | Create (5) | Notice windows, groups, placements; the holiday of a KST day |
| `tests/unit/notice-status.spec.ts` | Create (5) | Groups, boundaries, placements, KST holiday |
| `lib/cs/mismatch-storage.ts` | Modify (6), Rewrite (14, approval 14) | Status field (6); tab-only storage with 7-day opt-in and migration (14) |
| `tests/unit/mismatch-storage.spec.ts` | Modify (6, 14) | Status rows (6); v2 payload rows (14) |
| `components/InternalCsHelper.tsx` | Modify (6, 8), Delete (10) | `status: "draft"` on new records (6); transitional `section` prop (8) |
| `tests/e2e/RULE-MAP.md` | Modify (7, 8, 9, 10, 14) | Section I: internal suite rule → assertion rows |
| `components/internal/tabs.ts` | Create (8), Modify (11, 12) | Tab ids, labels, `?tab=` parsing |
| `components/internal/InternalCsDesk.tsx` | Create (8), Modify (9, 10), Rewrite (11), Modify (12) | Tablist/tab/tabpanel, lazy panels, reference time |
| `components/internal/ui.ts` | Create (8) | Shared field/label/panel class lists |
| `app/(internal)/internal/cs-helper/page.tsx` | Rewrite (8) | Renders `InternalCsDesk` with `?tab=` |
| `tests/support/internal-desk.ts` | Create (8), Modify (9, 10) | `openDesk` (8); `recordClipboard`, `copiedTexts` (9); `blockClipboard`, `recordTrackStarts`, `trackStarts` (10) |
| `tests/e2e/internal-desk.spec.ts` | Create (8), Modify (12) | Tab semantics, keyboard, deep link, kept state; the four spec tabs |
| `tests/internal-cs-helper.spec.ts` | Modify (8, 9), Delete (10) | Selector re-point (8); mismatch tests removed after migration (9) |
| `components/internal/MismatchTab.tsx`, `MismatchRecordList.tsx` | Create (9), Modify `MismatchTab.tsx` (14) | Draft form, list with masking, status, copy, delete, clear-all (9); retention control (14) |
| `tests/e2e/internal-mismatch.spec.ts` | Create (9), Modify (14) | I4–I6 rules plus masking, status, copy (9); approval-14 storage (14) |
| `components/internal/ScreenAndReply.tsx` | Create (10) | 375 px `NumberBar` + read-only `ResultView` next to the two replies |
| `components/internal/DeliveryGuideTab.tsx`, `BulkResultTable.tsx` | Create (10) | Paste form, carrier radios, run/stop, sorted table, row expansion, copy buttons |
| `tests/e2e/internal-bulk.spec.ts` | Create (10) | I1–I3 rules plus bulk, sort, 375 frame, copy, spacing, overlap, blocked clipboard |
| `components/ui/button.tsx`, `card.tsx`, `input.tsx` | Delete (10) | Last consumer was `InternalCsHelper` |
| `components/internal/PreviewTab.tsx` | Create (11) | Every state with fake numbers: customer screen + replies |
| `tests/e2e/internal-preview.spec.ts` | Create (11) | Views and replies equal the Node derivation; fake numbers only; read-only; 375 px at desktop widths |
| `components/internal/NoticeStatusTab.tsx` | Create (12) | KST time input, notice lists, places, holiday, simulated screens |
| `tests/e2e/internal-notices.spec.ts` | Create (12) | Lists and places follow the chosen KST time; holiday; overdue; non-KST browser |
| `tests/tools/stage-screens.spec.ts` | Modify (13) | Four internal scenarios |
| `docs/ops/internal-subdomain-proposal.md` | Create (13) | Subdomain split proposal for a shared list |
| `tests/e2e/internal-a11y.spec.ts` | Create (15, approval 13) | axe WCAG 2.2 AA on each tab |
| `package.json`, `package-lock.json` | Modify (15, approval 13, only if absent) | `@axe-core/playwright` dev dependency |

Execution order: Task 0 → 1 → 2 → … → 13 → gated Task 14 (approval 14) and Task 15 (approval 13), each checking the ledger first → Task Final.

## Conventions for this plan

- Shell: PowerShell 5.1 for `npm`, `npx`, `node` and `git` (no `&&`; use `;`). `$env:NAME='x'` sets a flag for the rest of the session; clear it with `$env:NAME=$null`. Quote every path that contains `(`, `)`, `[` or `]`, and use `-LiteralPath` with `Test-Path`, `Get-Content` and `Select-String`.
- **Unit run** = `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test <files>; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null` (these tests never open a page).
- **Dev-mode run** = port 43210 free (`Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue` prints nothing), then `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test <files>` (Playwright starts `next dev` with `INTERNAL_ACCESS_PASSWORD`, so `/internal/cs-helper` answers `INTERNAL_TEST_CREDENTIALS`).
- **Checks** = `npm run typecheck; npm run lint` → both exit 0 with no new warnings.
- Line numbers and quoted text below refer to the files as S01–S07 leave them. Every edit quotes the exact text to find; files S09 creates or rewrites are given in full.
- Every expectation that is not a §11.11 selector string is computed in the test with the same pure functions the desk uses (`deriveResultView`, `buildCsReply`, `buildPreviewScenario(s)`, `groupNoticesAt`, `noticePlacementAt`, `holidayAt`, `maskPhone`), so the tests lock rules and hooks, not copy.

---

### Task 0: Stage start

- [ ] **Step 1: Read approvals.** Open `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §4. For every approval number in this plan's "Gated by" list, write its Status into the stage summary. `pending`/`rejected` → execute the fallback steps and mark the gated task SKIPPED with the reason.
- [ ] **Step 2: Confirm dependencies.** Run (PowerShell): `git log --oneline claude/tipoasis-tracking-renewal-ae0e3a -40`
  Expected: a `merge: SNN …` commit for every stage in this plan's "Depends on" list.
- [ ] **Step 3: Branch.** Run: `git switch -c renewal/s09-internal-cs-tool claude/tipoasis-tracking-renewal-ae0e3a`
  Expected: `Switched to a new branch 'renewal/s09-internal-cs-tool'`.
- [ ] **Step 4: Port free.** Run: `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue`
  Expected: no output. Otherwise stop the listener: `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`
- [ ] **Step 5: Baseline build and before-screens.** Run `npm ci` only if `package-lock.json` changed since the last install in this worktree, then `npm run build`.
  Expected: build exits 0. Start the production server in a background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`
  Wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200`.
  Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='before'; $env:PW_STAGE='S09'; npx playwright test tests/tools/stage-screens.spec.ts`
  Expected: PNGs in `test-results/stage-screens/S09-before/` for widths 320, 375, 768, 1024, 1440. (S01 creates the tool first; S01 runs this step after its Task 1.)
- [ ] **Step 6: Baseline suite.** With the server still running: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test`
  Expected: record "N passed / M skipped / 0 failed" in the stage summary. Then stop the server (Step 4 command) and clear the flags: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.

**S09 notes on the standard steps above**
- Step 1: the "Gated by" list is 14 and 13. Approval 14 `pending`/`rejected` → Task 14 is SKIPPED and the desk keeps S01's 14-day `localStorage` store (spec §16 item 14 "거절하면: 14일 TTL로 localStorage를 유지합니다(다른 판정안). 서브도메인 분리는 하지 않습니다."). Approval 13 `pending`/`rejected` → Task 15 is SKIPPED (spec §16 item 13 "거절하면 … 접근성은 수동으로 점검합니다").
- Step 2: expected merges are `merge: S03 …`, `merge: S04 …`, `merge: S07 …` and, through them, `merge: S01 …`, `merge: S02 …`, `merge: S05 …`, `merge: S06 …`.
- Step 5: the PNGs land in `test-artifacts/stage-screens/S09-before/` (S01 addition 1). The tool has no internal scenario yet; Task 13 adds four, so they appear only in `S09-after/`.

- [ ] **Step 7 (S09): The artifacts this stage consumes exist.** Run:
  `Test-Path -LiteralPath lib/cs/mismatch-storage.ts, lib/cs/mismatch-templates.ts, lib/cs/cs-reply.ts, lib/cs/cs-templates.ts, lib/tracking/fetch-track.ts, lib/tracking/derive-view.ts, lib/tracking/classify-failure.ts, lib/tracking/number-input.ts, lib/tracking/inquiry-copy.ts, lib/tracking/carriers.ts, lib/tracking/notices.ts, lib/tracking/time.ts, lib/tracking/number-format.ts, components/result/ResultView.tsx, components/result/approvals.ts, components/primitives/Button.tsx, components/primitives/CopyButton.tsx, components/primitives/NumberBar.tsx, components/primitives/StatusChip.tsx, components/InternalCsHelper.tsx, "app/(internal)/internal/cs-helper/page.tsx", tests/internal-cs-helper.spec.ts, tests/fixtures/derive-scenarios.ts, tests/fixtures/config-fixtures.ts, tests/e2e/RULE-MAP.md, tests/unit/mismatch-storage.spec.ts`
  Expected: 26 lines `True`. A `False` means the owning stage (S01, S03, S04, S05, S06 or S07) is not merged as its plan describes — stop and name the missing file in the stage summary.
- [ ] **Step 8 (S09): The names S09 imports are exported as the plans say.** Run:
  `Select-String -LiteralPath lib/cs/cs-reply.ts, components/result/approvals.ts, lib/tracking/fetch-track.ts, lib/tracking/classify-failure.ts, lib/tracking/derive-view.ts, lib/tracking/number-input.ts, lib/tracking/inquiry-copy.ts, lib/tracking/carriers.ts, lib/tracking/notices.ts, lib/tracking/time.ts, lib/tracking/number-format.ts, lib/cs/mismatch-storage.ts, components/result/ResultView.tsx -Pattern 'export (async )?(function|const) (buildCsReply|deriveResultView|fetchTrack|classifyFailure|deriveTrackingView|normalizeInput|precheckNumber|parseInquiryCopy|buildInquiryCopy|CARRIER_NAMES|CONCRETE_CARRIER_CODES|activeNotices|pickNotice|NOTICE_PRIORITY|holidayPeriodBetween|kstDateKey|parseInstant|formatKstDateTime|formatKstDateTight|formatKstTime|addCalendarDays|groupTrackingNumber|getStoredRecordsSnapshot|getServerStoredRecordsSnapshot|subscribeStoredRecords|writeStoredRecords|clearAllStoredRecords|createRecordId|normalizePhone|parseMismatchPayload|serializeMismatchPayload|ResultView)\b' | Measure-Object | Select-Object -ExpandProperty Count`
  Expected: `32`. A lower count → open the files: a missing or renamed name means a dependency deviates from its plan; stop and reconcile before Task 1.
- [ ] **Step 9 (S09): Nothing of S09 exists yet.** Run:
  `Test-Path -LiteralPath components/internal, lib/cs/bulk-lookup.ts, lib/cs/phone-mask.ts, lib/cs/preview-outcomes.ts, lib/cs/notice-status.ts, tests/e2e/internal-desk.spec.ts; git log --oneline --all -- components/internal lib/cs/bulk-lookup.ts | Select-Object -First 5`
  Expected: six lines `False` and no log lines. If anything exists (a parallel or hotfix branch), stop and compare it with this plan task by task; skip only steps whose files already match exactly and record them in the stage summary.
- [ ] **Step 10 (S09): Record the legacy suite and the last users of `components/ui/*`.** Run:
  `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test --list tests/internal-cs-helper.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
  Expected: six titles — "internal helper generates a copy-ready delivery reply from an invoice", "internal helper answers pending invoices from the same view and saves nothing", "internal helper turns a failed lookup into a CS reply, never the server message", "internal helper stores customs mismatch drafts locally", "internal helper keeps mismatch drafts for 14 days and can clear them all", "internal helper still works when the browser refuses storage". Copy them into the stage summary (Task 7 maps each one).
  Run: `git grep -n -e "components/ui/" -- app components lib`
  Expected: exactly three lines, all in `components/InternalCsHelper.tsx` (`button`, `card`, `input`). Any other file → stop: the File Map says S09 deletes the last users, and that file belongs to a stage that has not finished.
  Run: `Select-String -LiteralPath tests/internal-cs-helper.spec.ts -Pattern 'getByRole\("button", \{ name: "통관부호 불일치" \}\)' | Measure-Object | Select-Object -ExpandProperty Count`
  Expected: `4` (Task 8 re-points them).

---

### Task 1: Masked phone numbers

**Files:**
- Create: `lib/cs/phone-mask.ts`
- Test: `tests/unit/phone-mask.spec.ts` (create)

**Interfaces:**
- Consumes: `FAKE.phone` (`tests/fixtures/tracking-fixtures.ts`, S01).
- Produces (contract §11.9): `maskPhone(phone: string): string` — '010-0000-1234' → '010-****-1234'; used by `MismatchRecordList` (Task 9) and its tests.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/phone-mask.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { maskPhone } from "@/lib/cs/phone-mask";
import { FAKE } from "../fixtures/tracking-fixtures";

// Other phone shapes are joined at runtime, so no source line holds a 10+ digit run (S01 repo guard).
const joined = (...parts: readonly string[]): string => parts.join("-");

test("a mobile number keeps 010 and the last four digits", () => {
  expect(maskPhone(FAKE.phone)).toBe("010-****-1234");
});

test("spaces, missing hyphens and +82 give the same mask", () => {
  const digitsOnly = FAKE.phone.replace(/-/g, "");
  expect(maskPhone(digitsOnly)).toBe("010-****-1234");
  expect(maskPhone(` ${FAKE.phone.replace(/-/g, " ")} `)).toBe("010-****-1234");
  expect(maskPhone(`+82 ${FAKE.phone.slice(1)}`)).toBe("010-****-1234");
  expect(maskPhone(`+82${digitsOnly.slice(1)}`)).toBe("010-****-1234");
});

test("ten-digit mobiles and Seoul numbers keep their own prefix", () => {
  expect(maskPhone(joined("011", "000", "1234"))).toBe("011-***-1234");
  expect(maskPhone("02-000-1234")).toBe("02-***-1234");
});

test("the hidden middle never leaks", () => {
  const masked = maskPhone(joined("010", "5678", "1234"));
  expect(masked).toBe("010-****-1234");
  expect(masked).not.toContain("5678");
});

test("too short to tell apart: every digit is hidden", () => {
  expect(maskPhone("1234")).toBe("****");
  expect(maskPhone("")).toBe("");
  expect(maskPhone("없음")).toBe("");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/phone-mask.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading the file — `Error: Cannot find module '@/lib/cs/phone-mask'` (0 tests run).

- [ ] **Step 3: Write the implementation**

Create `lib/cs/phone-mask.ts`:

```ts
// Internal-only (contract §11.1 rule 4). The CS desk shows customer phone numbers masked (spec §10 '010-****-1234');
// the full value only leaves the page through an explicit copy action.

/** Below this many digits a number cannot be told apart safely, so every digit is hidden. */
const MIN_MASKABLE_DIGITS = 8;
const TAIL_DIGITS = 4;
const KOREA_COUNTRY_CODE = "82";
const SEOUL_PREFIX = "02";

/** Digits only; '+82 10 …' becomes '010 …'. */
function domesticDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  const international = value.trim().startsWith("+") && digits.startsWith(KOREA_COUNTRY_CODE);
  return international ? `0${digits.slice(KOREA_COUNTRY_CODE.length)}` : digits;
}

/** Keeps the prefix (02 for Seoul, otherwise 3 digits) and the last 4 digits; every digit between becomes '*'. */
export function maskPhone(phone: string): string {
  const digits = domesticDigits(phone);
  if (digits.length < MIN_MASKABLE_DIGITS) return "*".repeat(digits.length);
  const headLength = digits.startsWith(SEOUL_PREFIX) ? SEOUL_PREFIX.length : 3;
  const hidden = "*".repeat(digits.length - headLength - TAIL_DIGITS);
  return `${digits.slice(0, headLength)}-${hidden}-${digits.slice(-TAIL_DIGITS)}`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/phone-mask.spec.ts tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed (`phone-mask.spec.ts`: `5 passed`; the repo guard finds no digit run in the new files).
Run: `npm run typecheck; npx eslint lib/cs/phone-mask.ts tests/unit/phone-mask.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 5: Commit**

```powershell
git add lib/cs/phone-mask.ts tests/unit/phone-mask.spec.ts
git commit -m "feat: mask customer phone numbers for the CS desk"
```

---

### Task 2: Reading a paste, summarizing a row, sorting problems first

**Files:**
- Create: `lib/cs/bulk-lookup.ts` (parsing, rows, summary, sort; Task 3 adds the run)
- Test: `tests/unit/bulk-lookup.spec.ts` (create)

**Interfaces:**
- Consumes: `normalizeInput(value)`, `precheckNumber(value): PrecheckResult` (`lib/tracking/number-input.ts`, S06); `parseInquiryCopy(text)`, `buildInquiryCopy(input)` (`lib/tracking/inquiry-copy.ts`, S03); `formatKstDateTight(value)` (`lib/tracking/time.ts`, S03); types `EtaView`, `LookupOutcome`, `Tone`, `TrackingViewModel` (`lib/tracking/types.ts`, S03); tests: `deriveTrackingView` (S03), `siteConfig` (S03), `success`, `customsWaitingData`, `deliveredData`, `pendingData` (`tests/fixtures/derive-scenarios.ts`, S03), `FAKE`, `FAKE_GROUPED`, `FIXTURE_NOW` (S01).
- Produces (contract §11.9 + Additions 3): `BULK_MAX = 20`, `BULK_MIN_INTERVAL_MS = 1000`, `interface BulkRow { number; status: "queued" | "running" | "done"; outcome: LookupOutcome | null; view: TrackingViewModel | null }`, `interface BulkParseResult { numbers; rejected; truncated }`, `parseBulkInput(text: string): BulkParseResult`, `initialBulkRows(numbers: readonly string[]): readonly BulkRow[]`, `sortBulkRows(rows: readonly BulkRow[]): readonly BulkRow[]`, `TONE_LABELS: Readonly<Record<Tone, string>>`, `interface BulkRowSummary { toneLabel; title; eta: string | null; etaNote: string | null; worryDate: string | null; lastEvent: string | null }`, `summarizeBulkView(view: TrackingViewModel): BulkRowSummary`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/bulk-lookup.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { siteConfig } from "@/config/site.config";
import {
  BULK_MAX,
  BULK_MIN_INTERVAL_MS,
  TONE_LABELS,
  initialBulkRows,
  parseBulkInput,
  sortBulkRows,
  summarizeBulkView,
  type BulkRow
} from "@/lib/cs/bulk-lookup";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import { buildInquiryCopy } from "@/lib/tracking/inquiry-copy";
import { formatKstDateTight } from "@/lib/tracking/time";
import type { EtaDate, Tone, TrackingViewModel } from "@/lib/tracking/types";
import { customsWaitingData, deliveredData, pendingData, success } from "../fixtures/derive-scenarios";
import { FAKE, FAKE_GROUPED, FIXTURE_NOW } from "../fixtures/tracking-fixtures";

/** Twelve-digit fake numbers built at runtime from the 0000 prefix (never a literal run in the source). */
const fakeNumber = (serial: number): string => `0000${String(serial).padStart(8, "0")}`;
const hyphenated = (value: string): string => `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8)}`;

const BASE_VIEW: TrackingViewModel = deriveTrackingView(success(customsWaitingData()), FIXTURE_NOW, siteConfig);
const DATE: EtaDate = { key: "2026-09-30", label: "9월 30일 (수)", month: 9, day: 30, weekday: "수" };

function doneRow(number: string, tone: Tone): BulkRow {
  return { number, status: "done", outcome: success(deliveredData()), view: { ...BASE_VIEW, tone } };
}

test("the run limits are 20 numbers and 1000 ms between request starts", () => {
  expect(BULK_MAX).toBe(20);
  expect(BULK_MIN_INTERVAL_MS).toBe(1000);
});

test.describe("parseBulkInput", () => {
  test("one number per line; spaces, hyphens and lowercase are normalized", () => {
    const text = `${FAKE_GROUPED.domestic}\n${FAKE.hbl.toLowerCase()}\n  ${hyphenated(FAKE.domesticAlt)}  `;
    expect(parseBulkInput(text)).toEqual({ numbers: [FAKE.domestic, FAKE.hbl, FAKE.domesticAlt], rejected: [], truncated: false });
  });

  test("commas, semicolons and tabs separate numbers too", () => {
    const text = `${FAKE.domestic}, ${FAKE.hbl};${FAKE.domesticAlt}\t${FAKE.hblAlt}`;
    expect(parseBulkInput(text).numbers).toEqual([FAKE.domestic, FAKE.hbl, FAKE.domesticAlt, FAKE.hblAlt]);
  });

  test("a pasted chat keeps only the numbers: the inquiry copy is read, digit-free lines are skipped", () => {
    const copy = buildInquiryCopy({
      kind: "status",
      number: { raw: FAKE.domestic, grouped: FAKE_GROUPED.domestic },
      stage: "통관 대기",
      lastEventAt: FIXTURE_NOW
    });
    const text = ["안녕하세요", copy, "확인 부탁드려요", "조회번호", FAKE_GROUPED.hblAlt].join("\n");
    expect(parseBulkInput(text)).toEqual({ numbers: [FAKE.domestic, FAKE.hblAlt], rejected: [], truncated: false });
  });

  test("phone-shaped lines are rejected, never looked up", () => {
    const digitsOnly = FAKE.phone.replace(/-/g, "");
    const international = `+82 ${FAKE.phone.slice(1)}`;
    const text = [FAKE.phone, digitsOnly, international, FAKE.domestic].join("\n");
    expect(parseBulkInput(text)).toEqual({ numbers: [FAKE.domestic], rejected: [FAKE.phone, digitsOnly, international], truncated: false });
  });

  test("lines with digits that are not numbers come back to staff as written", () => {
    const text = [FAKE.invalidShort, "주문 A-12", FAKE.domestic].join("\n");
    expect(parseBulkInput(text)).toEqual({ numbers: [FAKE.domestic], rejected: [FAKE.invalidShort, "주문 A-12"], truncated: false });
  });

  test("the same number twice keeps the first; more than 20 numbers are cut at 20", () => {
    const many = Array.from({ length: BULK_MAX + 2 }, (_, index) => fakeNumber(index + 1));
    const parsed = parseBulkInput([many[0], hyphenated(many[0]), ...many].join("\n"));
    expect(parsed.numbers).toEqual(many.slice(0, BULK_MAX));
    expect(parsed.truncated).toBe(true);
    expect(parsed.rejected).toEqual([]);
  });

  test("an empty paste gives nothing", () => {
    expect(parseBulkInput(" \n\t\n")).toEqual({ numbers: [], rejected: [], truncated: false });
  });
});

test.describe("rows", () => {
  test("initialBulkRows queues every number without a view", () => {
    expect(initialBulkRows([FAKE.domestic, FAKE.hbl])).toEqual([
      { number: FAKE.domestic, status: "queued", outcome: null, view: null },
      { number: FAKE.hbl, status: "queued", outcome: null, view: null }
    ]);
  });

  test("sortBulkRows puts 문제, then 확인 필요 first and keeps the pasted order otherwise", () => {
    const rows: readonly BulkRow[] = [
      doneRow(fakeNumber(1), "progress"),
      doneRow(fakeNumber(2), "attention"),
      { number: fakeNumber(3), status: "running", outcome: null, view: null },
      doneRow(fakeNumber(4), "problem"),
      doneRow(fakeNumber(5), "done"),
      doneRow(fakeNumber(6), "attention")
    ];
    expect(sortBulkRows(rows).map((row) => row.number)).toEqual([4, 2, 6, 1, 5, 3].map(fakeNumber));
    expect(rows.map((row) => row.number)).toEqual([1, 2, 3, 4, 5, 6].map(fakeNumber));
  });
});

test.describe("summarizeBulkView", () => {
  test("tone label, title, worry date and last event come from the view", () => {
    const summary = summarizeBulkView(BASE_VIEW);
    const worryKey = BASE_VIEW.nextAction.worry?.dateKey ?? null;
    expect(worryKey).not.toBeNull();
    expect(summary.toneLabel).toBe(TONE_LABELS[BASE_VIEW.tone]);
    expect(summary.title).toBe(BASE_VIEW.title);
    expect(summary.worryDate).toBe(worryKey === null ? null : formatKstDateTight(worryKey));
    expect(summary.lastEvent).toBe(BASE_VIEW.lastEvent?.text ?? null);
  });

  test("the tone labels are the spec's tone names", () => {
    expect(TONE_LABELS).toEqual({
      neutral: "확인 중",
      progress: "정상 진행",
      waiting: "정보 대기",
      attention: "확인 필요",
      problem: "문제",
      done: "완료"
    });
  });

  test("a view without a worry date or a last event shows neither", () => {
    const summary = summarizeBulkView(deriveTrackingView(success(pendingData()), FIXTURE_NOW, siteConfig));
    expect(summary.worryDate).toBeNull();
    expect(summary.lastEvent).toBeNull();
  });

  test("every ETA kind reads as one cell and an optional note", () => {
    const cell = (eta: TrackingViewModel["eta"]) => {
      const { eta: text, etaNote } = summarizeBulkView({ ...BASE_VIEW, eta });
      return { text, etaNote };
    };
    expect(cell({ kind: "none" })).toEqual({ text: null, etaNote: null });
    expect(cell({ kind: "date", label: "도착 예상", date: DATE, dday: 4, caption: null })).toEqual({ text: "9월 30일 (수) · D-4", etaNote: null });
    expect(cell({ kind: "date", label: "도착 예상", date: DATE, dday: 4, caption: "통관 완료 9월 28일 (월)" }).etaNote).toBe("통관 완료 9월 28일 (월)");
    expect(cell({ kind: "today", label: "오늘 예상", date: DATE, caption: null })).toEqual({ text: "오늘 예상 · 9월 30일 (수)", etaNote: null });
    expect(
      cell({
        kind: "holidayAffected",
        label: "도착 예상",
        date: DATE,
        badge: "추석 연휴 영향 · 1~2일 늦어질 수 있어요",
        caption: null,
        holidayName: "추석 연휴"
      })
    ).toEqual({ text: "9월 30일 (수)", etaNote: "추석 연휴 영향 · 1~2일 늦어질 수 있어요" });
    expect(cell({ kind: "overdue", label: "예상했던 날짜", date: DATE })).toEqual({ text: "예상했던 날짜 9월 30일 (수)", etaNote: null });
    expect(cell({ kind: "deliveredOn", label: "배송 완료일", date: DATE })).toEqual({ text: "배송 완료일 9월 30일 (수)", etaNote: null });
    expect(cell({ kind: "pendingInfo", label: "도착 예상", text: "정보 등록 후 안내" })).toEqual({ text: "정보 등록 후 안내", etaNote: null });
    expect(cell({ kind: "withheld", label: "도착 예상", text: "지금은 도착 예상일을 안내하기 어려워요" }).text).toBe(
      "지금은 도착 예상일을 안내하기 어려워요"
    );
    expect(cell({ kind: "unknown", label: "도착 예상", text: "아직 예상일을 계산할 기록이 없어요" }).text).toBe("아직 예상일을 계산할 기록이 없어요");
  });
});
```

(The `holidayAffected` literal carries S03's `holidayName` addition. If `npm run typecheck` reports that `holidayName` does not exist on that variant, S03 shipped without it: remove that one property from the literal and note it in the stage summary.)

- [ ] **Step 2: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/bulk-lookup.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading the file — `Error: Cannot find module '@/lib/cs/bulk-lookup'` (0 tests run).

- [ ] **Step 3: Write the implementation**

Create `lib/cs/bulk-lookup.ts`:

```ts
import { parseInquiryCopy } from "@/lib/tracking/inquiry-copy";
import { normalizeInput, precheckNumber } from "@/lib/tracking/number-input";
import { formatKstDateTight } from "@/lib/tracking/time";
import type { EtaView, LookupOutcome, Tone, TrackingViewModel } from "@/lib/tracking/types";

// Internal-only (contract §11.1 rule 4): the CS desk's 배송 안내 tab (spec §10 ①). Up to 20 numbers per run, looked up
// one at a time so the per-IP limit of 60 per minute holds.

export const BULK_MAX = 20;
export const BULK_MIN_INTERVAL_MS = 1000;

export interface BulkRow {
  readonly number: string;
  readonly status: "queued" | "running" | "done";
  readonly outcome: LookupOutcome | null;
  readonly view: TrackingViewModel | null;
}

export interface BulkParseResult {
  /** Normalized, unique, in pasted order, at most BULK_MAX. */
  readonly numbers: readonly string[];
  /** Lines with digits that are not a tracking number (or look like a phone), as staff wrote them. */
  readonly rejected: readonly string[];
  /** True when more than BULK_MAX numbers were pasted. */
  readonly truncated: boolean;
}

/** Line breaks, commas, semicolons and tabs separate entries. */
const ENTRY_SEPARATOR = /\r\n|[\n\r,;\t]/;
const HAS_DIGIT = /[0-9０-９]/;
const INQUIRY_LABEL = "조회번호";
/** A line that is only the '조회번호' label; the number follows on the next line. */
const LABEL_ONLY = /^조회번호[\s:：]*$/;
/** Korean mobile numbers after normalizeInput (+82 allowed): never looked up as a tracking number. */
const PHONE_DIGITS = /^(?:82)?0?1[016789]\d{7,8}$/;

function isPhoneLike(line: string): boolean {
  return PHONE_DIGITS.test(normalizeInput(line).replace(/^\+/, ""));
}

function numberFromLine(line: string): string | null {
  if (line.includes(INQUIRY_LABEL)) return parseInquiryCopy(line)?.number ?? null;
  if (isPhoneLike(line)) return null;
  const checked = precheckNumber(line);
  return checked.ok ? checked.number : null;
}

/** Reads a paste: one number per line (or comma/semicolon/tab), the customer's '[배송 문의] …' copy included. */
export function parseBulkInput(text: string): BulkParseResult {
  const numbers: string[] = [];
  const rejected: string[] = [];
  let truncated = false;
  for (const part of text.split(ENTRY_SEPARATOR)) {
    const line = part.trim();
    if (line === "" || LABEL_ONLY.test(line) || !HAS_DIGIT.test(line)) continue;
    const number = numberFromLine(line);
    if (number === null) {
      rejected.push(line);
    } else if (!numbers.includes(number)) {
      if (numbers.length < BULK_MAX) numbers.push(number);
      else truncated = true;
    }
  }
  return { numbers, rejected, truncated };
}

export function queuedRow(number: string): BulkRow {
  return { number, status: "queued", outcome: null, view: null };
}

export function initialBulkRows(numbers: readonly string[]): readonly BulkRow[] {
  return numbers.map(queuedRow);
}

/** 문제 first, then 확인 필요, then every other settled row, then rows still waiting; the pasted order inside each group. */
const TONE_RANK: Readonly<Partial<Record<Tone, number>>> = { problem: 0, attention: 1 };
const SETTLED_RANK = 2;
const WAITING_RANK = 3;

function rankOf(row: BulkRow): number {
  if (row.view === null) return WAITING_RANK;
  return TONE_RANK[row.view.tone] ?? SETTLED_RANK;
}

export function sortBulkRows(rows: readonly BulkRow[]): readonly BulkRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => rankOf(a.row) - rankOf(b.row) || a.index - b.index)
    .map(({ row }) => row);
}

/** The tone names of spec §6 ('neutral' only appears while a row has no result). */
export const TONE_LABELS: Readonly<Record<Tone, string>> = {
  neutral: "확인 중",
  progress: "정상 진행",
  waiting: "정보 대기",
  attention: "확인 필요",
  problem: "문제",
  done: "완료"
};

export interface BulkRowSummary {
  readonly toneLabel: string;
  readonly title: string;
  readonly eta: string | null;
  readonly etaNote: string | null;
  readonly worryDate: string | null;
  readonly lastEvent: string | null;
}

function etaCell(eta: EtaView): Pick<BulkRowSummary, "eta" | "etaNote"> {
  switch (eta.kind) {
    case "none":
      return { eta: null, etaNote: null };
    case "date":
      return { eta: `${eta.date.label} · D-${eta.dday}`, etaNote: eta.caption };
    case "today":
      return { eta: `${eta.label} · ${eta.date.label}`, etaNote: eta.caption };
    case "holidayAffected":
      return { eta: eta.date.label, etaNote: eta.badge };
    case "overdue":
    case "deliveredOn":
      return { eta: `${eta.label} ${eta.date.label}`, etaNote: null };
    case "pendingInfo":
    case "withheld":
    case "unknown":
      return { eta: eta.text, etaNote: null };
  }
}

/** One table row from the same view the customer sees (spec §10: 톤 배지, 상태 제목, 도착 예상, 걱정 기준일, 마지막 처리). */
export function summarizeBulkView(view: TrackingViewModel): BulkRowSummary {
  const worryKey = view.nextAction.worry?.dateKey ?? null;
  return {
    toneLabel: TONE_LABELS[view.tone],
    title: view.title,
    ...etaCell(view.eta),
    worryDate: worryKey === null ? null : formatKstDateTight(worryKey),
    lastEvent: view.lastEvent?.text ?? null
  };
}
```

(`queuedRow` is exported for Task 3's run and for `DeliveryGuideTab`; it is S09-private.)

- [ ] **Step 4: Run it to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/bulk-lookup.spec.ts tests/unit/module-boundaries.spec.ts tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed (`bulk-lookup.spec.ts`: `14 passed`; `lib/cs/bulk-lookup.ts` is imported only by the test so far).
Run: `npm run typecheck; npx eslint lib/cs/bulk-lookup.ts tests/unit/bulk-lookup.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 5: Commit**

```powershell
git add lib/cs/bulk-lookup.ts tests/unit/bulk-lookup.spec.ts
git commit -m "feat: read pasted tracking numbers and summarize bulk rows for the CS desk"
```

---

### Task 3: One lookup per second — `runBulkLookup`

**Files:**
- Modify: `lib/cs/bulk-lookup.ts` (whole file, Step 3)
- Test: `tests/unit/bulk-lookup.spec.ts` (append a describe block, two import lines)

**Interfaces:**
- Consumes: `fetchTrack(request, { signal, timeoutMs }): Promise<FetchTrackResult>`, `type FetchTrackResult` (`lib/tracking/fetch-track.ts`, S04); `classifyFailure(input: FailureInput): FailureCause` (S03); `deriveTrackingView(outcome, now, config)` (S03); `siteConfig` (`config/site.config.ts`: `lookup.timeoutMs`); types `LookupOutcome`, `LookupRequest`, `TrackingViewModel` (S03); `DeliveryCarrierCode` (`lib/types.ts`); Task 2's module.
- Produces (contract §11.9 + Additions 3): `runBulkLookup(numbers: readonly string[], carrier: DeliveryCarrierCode, options: BulkRunOptions): Promise<void>`; `interface BulkRunOptions { signal: AbortSignal; onRow: (index: number, row: BulkRow) => void; now: () => Date; fetcher?: BulkFetcher; wait?: (ms: number, signal: AbortSignal) => Promise<void>; derive?: (outcome: LookupOutcome, now: Date) => TrackingViewModel; timeoutMs?: number }`; `type BulkFetcher = (request: LookupRequest, options: { readonly signal: AbortSignal; readonly timeoutMs: number }) => Promise<FetchTrackResult>`. Behavior: rows are reported as `running` then `done` (or back to `queued` when stopped mid-request); request starts are at least `BULK_MIN_INTERVAL_MS` apart; only the first `BULK_MAX` numbers run; every request is `{ number, carrier, entry: "manual" }`; failures become `{ kind: "failure", cause: classifyFailure(input), consecutiveFailures: 1 }`; each settled row's view is `derive(outcome, now())`.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/bulk-lookup.spec.ts`:

(a) Replace the import block

```ts
import {
  BULK_MAX,
  BULK_MIN_INTERVAL_MS,
  TONE_LABELS,
  initialBulkRows,
  parseBulkInput,
  sortBulkRows,
  summarizeBulkView,
  type BulkRow
} from "@/lib/cs/bulk-lookup";
```

with

```ts
import {
  BULK_MAX,
  BULK_MIN_INTERVAL_MS,
  TONE_LABELS,
  initialBulkRows,
  parseBulkInput,
  runBulkLookup,
  sortBulkRows,
  summarizeBulkView,
  type BulkFetcher,
  type BulkRow
} from "@/lib/cs/bulk-lookup";
import type { FetchTrackResult } from "@/lib/tracking/fetch-track";
```

(b) Replace `import type { EtaDate, Tone, TrackingViewModel } from "@/lib/tracking/types";` with

```ts
import type { EtaDate, LookupOutcome, LookupRequest, Tone, TrackingViewModel } from "@/lib/tracking/types";
```

(c) Append to the end of the file:

```ts
test.describe("runBulkLookup", () => {
  const DELIVERED: FetchTrackResult = { kind: "success", data: deliveredData() };
  const WAITING: FetchTrackResult = { kind: "success", data: customsWaitingData() };
  const NOT_FOUND: FetchTrackResult = { kind: "failure", input: { kind: "http", status: 404, code: "NOT_FOUND", isJson: true } };
  const FALLBACK: FetchTrackResult = { kind: "failure", input: { kind: "timeout" } };

  interface Harness {
    readonly now: () => Date;
    readonly wait: (ms: number) => Promise<void>;
    readonly fetcher: BulkFetcher;
    readonly starts: readonly number[];
    readonly requests: readonly LookupRequest[];
    readonly waits: readonly number[];
  }

  /** A fake clock: every answer takes `latencyMs` and `wait` advances the clock, so spacing is exact and no real time passes. */
  function harness(answers: readonly FetchTrackResult[], latencyMs: number): Harness {
    let clock = FIXTURE_NOW.getTime();
    const starts: number[] = [];
    const requests: LookupRequest[] = [];
    const waits: number[] = [];
    return {
      now: () => new Date(clock),
      wait: async (ms) => {
        waits.push(ms);
        if (ms > 0) clock += ms;
      },
      fetcher: async (request) => {
        starts.push(clock);
        requests.push(request);
        clock += latencyMs;
        return answers[requests.length - 1] ?? FALLBACK;
      },
      starts,
      requests,
      waits
    };
  }

  function recorder(): { readonly events: string[]; readonly rows: Map<number, BulkRow>; readonly onRow: (index: number, row: BulkRow) => void } {
    const events: string[] = [];
    const rows = new Map<number, BulkRow>();
    return {
      events,
      rows,
      onRow: (index, row) => {
        events.push(`${index}:${row.status}`);
        rows.set(index, row);
      }
    };
  }

  test("looks numbers up one by one, 1000 ms apart, reporting running then done", async () => {
    const run = harness([DELIVERED, WAITING, NOT_FOUND], 300);
    const seen = recorder();
    await runBulkLookup([FAKE.domestic, FAKE.hbl, FAKE.domesticAlt], "AUTO", {
      signal: new AbortController().signal,
      now: run.now,
      wait: run.wait,
      fetcher: run.fetcher,
      onRow: seen.onRow
    });
    expect(seen.events).toEqual(["0:running", "0:done", "1:running", "1:done", "2:running", "2:done"]);
    expect(run.starts.map((start) => start - run.starts[0])).toEqual([0, BULK_MIN_INTERVAL_MS, 2 * BULK_MIN_INTERVAL_MS]);
    expect(run.waits).toEqual([BULK_MIN_INTERVAL_MS - 300, BULK_MIN_INTERVAL_MS - 300]);
    const second = seen.rows.get(1);
    if (second === undefined || second.outcome === null) throw new Error("row 1 did not settle");
    expect(second.outcome).toEqual({
      kind: "success",
      request: { number: FAKE.hbl, carrier: "AUTO", entry: "manual" },
      data: customsWaitingData()
    });
    expect(second.view).toEqual(deriveTrackingView(second.outcome, new Date(run.starts[1] + 300), siteConfig));
    expect(seen.rows.get(2)?.outcome).toEqual({
      kind: "failure",
      request: { number: FAKE.domesticAlt, carrier: "AUTO", entry: "manual" },
      cause: "notFound",
      consecutiveFailures: 1
    });
  });

  test("a slow answer is not followed by an extra wait", async () => {
    const run = harness([DELIVERED, DELIVERED, DELIVERED], 1500);
    await runBulkLookup([FAKE.domestic, FAKE.hbl, FAKE.domesticAlt], "AUTO", {
      signal: new AbortController().signal,
      now: run.now,
      wait: run.wait,
      fetcher: run.fetcher,
      onRow: () => undefined
    });
    expect(run.starts.map((start) => start - run.starts[0])).toEqual([0, 1500, 3000]);
    expect(run.waits.every((ms) => ms <= 0)).toBe(true);
  });

  test("every request carries the chosen carrier, and only the first 20 numbers run", async () => {
    const numbers = Array.from({ length: BULK_MAX + 1 }, (_, index) => fakeNumber(index + 1));
    const run = harness(numbers.map(() => DELIVERED), 0);
    await runBulkLookup(numbers, "CJ", {
      signal: new AbortController().signal,
      now: run.now,
      wait: run.wait,
      fetcher: run.fetcher,
      onRow: () => undefined
    });
    expect(run.requests.map((request) => request.number)).toEqual(numbers.slice(0, BULK_MAX));
    expect(run.requests.every((request) => request.carrier === "CJ" && request.entry === "manual")).toBe(true);
  });

  test("stopping mid-request puts that row back in the queue and looks nothing else up", async () => {
    const controller = new AbortController();
    const run = harness([DELIVERED], 100);
    const fetcher: BulkFetcher = async (request, options) => {
      if (request.number !== FAKE.hbl) return run.fetcher(request, options);
      controller.abort();
      return { kind: "aborted" };
    };
    const seen = recorder();
    await runBulkLookup([FAKE.domestic, FAKE.hbl, FAKE.domesticAlt], "AUTO", {
      signal: controller.signal,
      now: run.now,
      wait: run.wait,
      fetcher,
      onRow: seen.onRow
    });
    expect(seen.events).toEqual(["0:running", "0:done", "1:running", "1:queued"]);
    expect(seen.rows.get(1)).toEqual({ number: FAKE.hbl, status: "queued", outcome: null, view: null });
  });

  test("stopping during the wait looks nothing else up", async () => {
    const controller = new AbortController();
    const run = harness([DELIVERED, DELIVERED], 100);
    const seen = recorder();
    await runBulkLookup([FAKE.domestic, FAKE.hbl], "AUTO", {
      signal: controller.signal,
      now: run.now,
      wait: async () => {
        controller.abort();
      },
      fetcher: run.fetcher,
      onRow: seen.onRow
    });
    expect(seen.events).toEqual(["0:running", "0:done"]);
    expect(run.requests).toHaveLength(1);
  });

  test("failures become failure outcomes with one failure each", async () => {
    const run = harness(
      [
        { kind: "failure", input: { kind: "timeout" } },
        { kind: "failure", input: { kind: "network", online: false } }
      ],
      50
    );
    const seen = recorder();
    await runBulkLookup([FAKE.domestic, FAKE.hbl], "AUTO", {
      signal: new AbortController().signal,
      now: run.now,
      wait: run.wait,
      fetcher: run.fetcher,
      onRow: seen.onRow
    });
    expect(seen.rows.get(0)?.outcome).toMatchObject({ kind: "failure", cause: "clientTimeout", consecutiveFailures: 1 });
    expect(seen.rows.get(1)?.outcome).toMatchObject({ kind: "failure", cause: "offline", consecutiveFailures: 1 });
    expect(seen.rows.get(1)?.view?.mode).toBe("error");
  });

  test("a custom derive builds every settled row's view", async () => {
    const run = harness([DELIVERED, NOT_FOUND], 10);
    const derive = (outcome: LookupOutcome, now: Date): TrackingViewModel => ({
      ...deriveTrackingView(outcome, now, siteConfig),
      title: "시험용 제목"
    });
    const seen = recorder();
    await runBulkLookup([FAKE.domestic, FAKE.hbl], "AUTO", {
      signal: new AbortController().signal,
      now: run.now,
      wait: run.wait,
      fetcher: run.fetcher,
      derive,
      onRow: seen.onRow
    });
    expect([seen.rows.get(0)?.view?.title, seen.rows.get(1)?.view?.title]).toEqual(["시험용 제목", "시험용 제목"]);
  });

  test("the default wait keeps real requests at least 1000 ms apart", async () => {
    const starts: number[] = [];
    await runBulkLookup([FAKE.domestic, FAKE.hbl], "AUTO", {
      signal: new AbortController().signal,
      now: () => new Date(),
      fetcher: async () => {
        starts.push(Date.now());
        return DELIVERED;
      },
      onRow: () => undefined
    });
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(BULK_MIN_INTERVAL_MS - 5);
  });

  test("the default wait ends at once when stopped", async () => {
    const controller = new AbortController();
    const startedAt = Date.now();
    await runBulkLookup([FAKE.domestic, FAKE.hbl], "AUTO", {
      signal: controller.signal,
      now: () => new Date(),
      fetcher: async () => DELIVERED,
      onRow: (_, row) => {
        if (row.status === "done") controller.abort();
      }
    });
    expect(Date.now() - startedAt).toBeLessThan(500);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/bulk-lookup.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `9 failed, 14 passed`. Playwright transpiles the spec to CommonJS, so the missing export is `undefined`: each new test stops with `TypeError: (0 , _bulkLookup.runBulkLookup) is not a function`; the Task 2 tests still pass.

- [ ] **Step 3: Write the implementation**

Replace the whole content of `lib/cs/bulk-lookup.ts` with:

```ts
import { siteConfig } from "@/config/site.config";
import { classifyFailure } from "@/lib/tracking/classify-failure";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import { fetchTrack, type FetchTrackResult } from "@/lib/tracking/fetch-track";
import { parseInquiryCopy } from "@/lib/tracking/inquiry-copy";
import { normalizeInput, precheckNumber } from "@/lib/tracking/number-input";
import { formatKstDateTight } from "@/lib/tracking/time";
import type { EtaView, LookupOutcome, LookupRequest, Tone, TrackingViewModel } from "@/lib/tracking/types";
import type { DeliveryCarrierCode } from "@/lib/types";

// Internal-only (contract §11.1 rule 4): the CS desk's 배송 안내 tab (spec §10 ①). Up to 20 numbers per run, looked up
// one at a time so the per-IP limit of 60 per minute holds.

export const BULK_MAX = 20;
export const BULK_MIN_INTERVAL_MS = 1000;

export interface BulkRow {
  readonly number: string;
  readonly status: "queued" | "running" | "done";
  readonly outcome: LookupOutcome | null;
  readonly view: TrackingViewModel | null;
}

export interface BulkParseResult {
  /** Normalized, unique, in pasted order, at most BULK_MAX. */
  readonly numbers: readonly string[];
  /** Lines with digits that are not a tracking number (or look like a phone), as staff wrote them. */
  readonly rejected: readonly string[];
  /** True when more than BULK_MAX numbers were pasted. */
  readonly truncated: boolean;
}

export type BulkFetcher = (
  request: LookupRequest,
  options: { readonly signal: AbortSignal; readonly timeoutMs: number }
) => Promise<FetchTrackResult>;

export interface BulkRunOptions {
  readonly signal: AbortSignal;
  readonly onRow: (index: number, row: BulkRow) => void;
  readonly now: () => Date;
  /** Default fetchTrack (the only /api/track caller); tests inject answers. */
  readonly fetcher?: BulkFetcher;
  /** Default: a setTimeout that ends early when `signal` aborts. */
  readonly wait?: (ms: number, signal: AbortSignal) => Promise<void>;
  /** Default deriveTrackingView with the shipped config; the desk passes deriveResultView (the customer page's view). */
  readonly derive?: (outcome: LookupOutcome, now: Date) => TrackingViewModel;
  /** Default siteConfig.lookup.timeoutMs. */
  readonly timeoutMs?: number;
}

/** Line breaks, commas, semicolons and tabs separate entries. */
const ENTRY_SEPARATOR = /\r\n|[\n\r,;\t]/;
const HAS_DIGIT = /[0-9０-９]/;
const INQUIRY_LABEL = "조회번호";
/** A line that is only the '조회번호' label; the number follows on the next line. */
const LABEL_ONLY = /^조회번호[\s:：]*$/;
/** Korean mobile numbers after normalizeInput (+82 allowed): never looked up as a tracking number. */
const PHONE_DIGITS = /^(?:82)?0?1[016789]\d{7,8}$/;

function isPhoneLike(line: string): boolean {
  return PHONE_DIGITS.test(normalizeInput(line).replace(/^\+/, ""));
}

function numberFromLine(line: string): string | null {
  if (line.includes(INQUIRY_LABEL)) return parseInquiryCopy(line)?.number ?? null;
  if (isPhoneLike(line)) return null;
  const checked = precheckNumber(line);
  return checked.ok ? checked.number : null;
}

/** Reads a paste: one number per line (or comma/semicolon/tab), the customer's '[배송 문의] …' copy included. */
export function parseBulkInput(text: string): BulkParseResult {
  const numbers: string[] = [];
  const rejected: string[] = [];
  let truncated = false;
  for (const part of text.split(ENTRY_SEPARATOR)) {
    const line = part.trim();
    if (line === "" || LABEL_ONLY.test(line) || !HAS_DIGIT.test(line)) continue;
    const number = numberFromLine(line);
    if (number === null) {
      rejected.push(line);
    } else if (!numbers.includes(number)) {
      if (numbers.length < BULK_MAX) numbers.push(number);
      else truncated = true;
    }
  }
  return { numbers, rejected, truncated };
}

export function queuedRow(number: string): BulkRow {
  return { number, status: "queued", outcome: null, view: null };
}

export function initialBulkRows(numbers: readonly string[]): readonly BulkRow[] {
  return numbers.map(queuedRow);
}

/** An abortable pause; resolves at once for ms ≤ 0 or an aborted signal. */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (ms <= 0 || signal.aborted) {
      resolve();
      return;
    }
    const finish = (): void => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
  });
}

const deriveWithSiteConfig = (outcome: LookupOutcome, now: Date): TrackingViewModel => deriveTrackingView(outcome, now, siteConfig);

function toOutcome(request: LookupRequest, result: Exclude<FetchTrackResult, { kind: "aborted" }>): LookupOutcome {
  return result.kind === "success"
    ? { kind: "success", request, data: result.data }
    : { kind: "failure", request, cause: classifyFailure(result.input), consecutiveFailures: 1 };
}

/**
 * Looks the numbers up in order, one request at a time, starting requests at least BULK_MIN_INTERVAL_MS apart.
 * Reports each row as running, then done with its outcome and view (or queued again when stopped mid-request).
 * Resolves when every number ran or `signal` aborted; never rejects.
 */
export async function runBulkLookup(
  numbers: readonly string[],
  carrier: DeliveryCarrierCode,
  options: BulkRunOptions
): Promise<void> {
  const fetcher = options.fetcher ?? fetchTrack;
  const wait = options.wait ?? pause;
  const derive = options.derive ?? deriveWithSiteConfig;
  const timeoutMs = options.timeoutMs ?? siteConfig.lookup.timeoutMs;
  const batch = numbers.slice(0, BULK_MAX);
  let previousStart: number | null = null;
  for (let index = 0; index < batch.length; index += 1) {
    const number = batch[index];
    if (previousStart !== null) {
      await wait(previousStart + BULK_MIN_INTERVAL_MS - options.now().getTime(), options.signal);
    }
    if (options.signal.aborted) return;
    previousStart = options.now().getTime();
    options.onRow(index, { number, status: "running", outcome: null, view: null });
    const request: LookupRequest = { number, carrier, entry: "manual" };
    const result = await fetcher(request, { signal: options.signal, timeoutMs });
    if (result.kind === "aborted") {
      options.onRow(index, queuedRow(number));
      return;
    }
    const outcome = toOutcome(request, result);
    options.onRow(index, { number, status: "done", outcome, view: derive(outcome, options.now()) });
  }
}

/** 문제 first, then 확인 필요, then every other settled row, then rows still waiting; the pasted order inside each group. */
const TONE_RANK: Readonly<Partial<Record<Tone, number>>> = { problem: 0, attention: 1 };
const SETTLED_RANK = 2;
const WAITING_RANK = 3;

function rankOf(row: BulkRow): number {
  if (row.view === null) return WAITING_RANK;
  return TONE_RANK[row.view.tone] ?? SETTLED_RANK;
}

export function sortBulkRows(rows: readonly BulkRow[]): readonly BulkRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => rankOf(a.row) - rankOf(b.row) || a.index - b.index)
    .map(({ row }) => row);
}

/** The tone names of spec §6 ('neutral' only appears while a row has no result). */
export const TONE_LABELS: Readonly<Record<Tone, string>> = {
  neutral: "확인 중",
  progress: "정상 진행",
  waiting: "정보 대기",
  attention: "확인 필요",
  problem: "문제",
  done: "완료"
};

export interface BulkRowSummary {
  readonly toneLabel: string;
  readonly title: string;
  readonly eta: string | null;
  readonly etaNote: string | null;
  readonly worryDate: string | null;
  readonly lastEvent: string | null;
}

function etaCell(eta: EtaView): Pick<BulkRowSummary, "eta" | "etaNote"> {
  switch (eta.kind) {
    case "none":
      return { eta: null, etaNote: null };
    case "date":
      return { eta: `${eta.date.label} · D-${eta.dday}`, etaNote: eta.caption };
    case "today":
      return { eta: `${eta.label} · ${eta.date.label}`, etaNote: eta.caption };
    case "holidayAffected":
      return { eta: eta.date.label, etaNote: eta.badge };
    case "overdue":
    case "deliveredOn":
      return { eta: `${eta.label} ${eta.date.label}`, etaNote: null };
    case "pendingInfo":
    case "withheld":
    case "unknown":
      return { eta: eta.text, etaNote: null };
  }
}

/** One table row from the same view the customer sees (spec §10: 톤 배지, 상태 제목, 도착 예상, 걱정 기준일, 마지막 처리). */
export function summarizeBulkView(view: TrackingViewModel): BulkRowSummary {
  const worryKey = view.nextAction.worry?.dateKey ?? null;
  return {
    toneLabel: TONE_LABELS[view.tone],
    title: view.title,
    ...etaCell(view.eta),
    worryDate: worryKey === null ? null : formatKstDateTight(worryKey),
    lastEvent: view.lastEvent?.text ?? null
  };
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/bulk-lookup.spec.ts tests/unit/module-boundaries.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed (`bulk-lookup.spec.ts`: `23 passed` — 14 from Task 2 and 9 new; the two real-timer tests take about one second together).
Run: `npm run typecheck; npx eslint lib/cs/bulk-lookup.ts tests/unit/bulk-lookup.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 5: Commit**

```powershell
git add lib/cs/bulk-lookup.ts tests/unit/bulk-lookup.spec.ts
git commit -m "feat: run CS bulk lookups one per second through fetchTrack"
```

---

### Task 4: Fake outcomes for every state — `preview-outcomes.ts`

**Files:**
- Create: `lib/cs/preview-outcomes.ts`
- Test: `tests/unit/preview-outcomes.spec.ts` (create)

**Interfaces:**
- Consumes: `normalizeTrackingData(params)` (`lib/services/normalizer.ts`, frozen, pure — the same builder the API uses); types `FailureCause`, `GuideKey`, `LookupOutcome`, `LookupRequest` (S03), `DeliveryLookupResult`, `StatusCode`, `TrackingEvent`, `TrackingType` (`lib/types.ts`); tests: `deriveTrackingView` (S03), `siteConfig`, `addCalendarDays` (S03), `GUIDE_KEYS` (S03), `findDisallowedDigitRuns`, `HBL_LIKE_PATTERN` (S01), `FIXTURE_NOW` (S01).
- Produces (contract §10.2 row "fake outcomes for every state", Additions 4): `PREVIEW_NUMBERS = { domestic: "000000000001", hbl: "TEST00000001", invalid: "00001" }`, `PREVIEW_DRIVER_PHONE`, `PREVIEW_OVERDUE_AGE_DAYS = 10`, `PREVIEW_SCENARIO_IDS` (19 ids), `type PreviewScenarioId`, `interface PreviewScenario { id; label; guideKey; overdue; outcome: LookupOutcome }`, `buildPreviewScenario(id: PreviewScenarioId, now: Date): PreviewScenario`, `buildPreviewScenarios(now: Date): readonly PreviewScenario[]`. Every GuideKey except `idle` and `loading` appears; `customsWaitingOverdue` is the one overdue scenario; `customsClearedCarrierCut` shows a cut journey. Used by `PreviewTab` (Task 11) and `NoticeStatusTab` (Task 12).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/preview-outcomes.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { siteConfig } from "@/config/site.config";
import {
  PREVIEW_NUMBERS,
  PREVIEW_OVERDUE_AGE_DAYS,
  PREVIEW_SCENARIO_IDS,
  buildPreviewScenario,
  buildPreviewScenarios
} from "@/lib/cs/preview-outcomes";
import { HBL_LIKE_PATTERN, findDisallowedDigitRuns } from "@/lib/privacy/number-patterns";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import { addCalendarDays } from "@/lib/tracking/time";
import { GUIDE_KEYS } from "@/lib/tracking/types";
import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";

const DAY_MS = 86_400_000;
const TIMES = ["00:30", "14:05", "23:50"] as const;
/** Every day around 2026 추석 and the October holidays, and around 2027 설 — weekends and long breaks included. */
const DAYS: readonly string[] = [
  ...Array.from({ length: 36 }, (_, offset) => addCalendarDays("2026-09-15", offset)),
  ...Array.from({ length: 15 }, (_, offset) => addCalendarDays("2027-02-01", offset))
];

test("the scenarios cover every result state once, plus the overdue variant", () => {
  const scenarios = buildPreviewScenarios(FIXTURE_NOW);
  expect(scenarios.map((scenario) => scenario.id)).toEqual([...PREVIEW_SCENARIO_IDS]);
  const keys = [...new Set(scenarios.map((scenario) => scenario.guideKey))].sort();
  expect(keys).toEqual(GUIDE_KEYS.filter((key) => key !== "idle" && key !== "loading").sort());
  expect(scenarios.filter((scenario) => scenario.overdue).map((scenario) => scenario.id)).toEqual(["customsWaitingOverdue"]);
});

test("every scenario derives to its state on any day and time around the holidays", () => {
  const mismatches: string[] = [];
  for (const day of DAYS) {
    for (const time of TIMES) {
      const now = new Date(`${day}T${time}:00+09:00`);
      for (const scenario of buildPreviewScenarios(now)) {
        const view = deriveTrackingView(scenario.outcome, now, siteConfig);
        if (view.guideKey !== scenario.guideKey || view.overdue !== scenario.overdue) {
          mismatches.push(`${day} ${time} ${scenario.id} → ${view.guideKey}${view.overdue ? " (overdue)" : ""}`);
        }
      }
    }
  }
  expect(mismatches).toEqual([]);
});

test("the carrier-cut variant shows a cut journey and the carrier delay line", () => {
  const scenario = buildPreviewScenario("customsClearedCarrierCut", FIXTURE_NOW);
  const view = deriveTrackingView(scenario.outcome, FIXTURE_NOW, siteConfig);
  expect(view.spine.issue?.kind).toBe("cut");
  expect(view.auxiliaryLine).not.toBeNull();
});

test("only the fake numbers appear, and the overdue scenario is read days after its events", () => {
  const scenarios = buildPreviewScenarios(FIXTURE_NOW);
  const allowed = new Set<string>(Object.values(PREVIEW_NUMBERS));
  for (const scenario of scenarios) {
    expect(allowed.has(scenario.outcome.request.number), scenario.id).toBe(true);
    if (scenario.outcome.kind === "success") {
      expect(scenario.outcome.data.trackingNumber, scenario.id).toBe(scenario.outcome.request.number);
    }
  }
  const text = JSON.stringify(scenarios);
  expect(findDisallowedDigitRuns(text)).toEqual([]);
  expect(new Set(text.match(HBL_LIKE_PATTERN) ?? [])).toEqual(new Set([PREVIEW_NUMBERS.hbl]));
  const overdue = buildPreviewScenario("customsWaitingOverdue", FIXTURE_NOW);
  if (overdue.outcome.kind !== "success") throw new Error("the overdue scenario is a success outcome");
  expect(FIXTURE_NOW.getTime() - Date.parse(overdue.outcome.data.lastUpdated)).toBeGreaterThanOrEqual(PREVIEW_OVERDUE_AGE_DAYS * DAY_MS);
});

test("the same instant gives the same scenarios", () => {
  expect(buildPreviewScenarios(FIXTURE_NOW)).toEqual(buildPreviewScenarios(new Date(FIXTURE_NOW.getTime())));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/preview-outcomes.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading the file — `Error: Cannot find module '@/lib/cs/preview-outcomes'` (0 tests run).

- [ ] **Step 3: Write the implementation**

Create `lib/cs/preview-outcomes.ts`:

```ts
import { normalizeTrackingData } from "@/lib/services/normalizer";
import type { FailureCause, GuideKey, LookupOutcome, LookupRequest } from "@/lib/tracking/types";
import type { DeliveryLookupResult, StatusCode, TrackingEvent, TrackingType } from "@/lib/types";

// Internal-only (contract §11.1 rule 4). Fake outcomes for every result state (spec §10 ③ 안내표 미리보기): only the fake
// numbers 0000 0000 0001 and TEST 0000 0001 appear (spec §4), and every event sits relative to `now`, so the preview
// shows the same states on any day. Success data goes through the real normalizer, like an /api/track answer.

export const PREVIEW_NUMBERS = { domestic: "000000000001", hbl: "TEST00000001", invalid: "00001" } as const;
/** The repo guard's fake mobile form (010-0000-dddd). */
export const PREVIEW_DRIVER_PHONE = "010-0000-1234";
/** The overdue preview's events happened this many days before `now`; worry dates fall at most about a week later. */
export const PREVIEW_OVERDUE_AGE_DAYS = 10;

export const PREVIEW_SCENARIO_IDS = [
  "pending",
  "customsArrived",
  "customsWaiting",
  "customsWaitingOverdue",
  "customsCleared",
  "customsClearedCarrierCut",
  "handedToCarrier",
  "pickedUp",
  "inTransit",
  "delivered",
  "stale",
  "lookupUnavailable",
  "ambiguous",
  "invalidNumber",
  "notFound",
  "temporaryDelay",
  "offline",
  "noResponse",
  "serverError"
] as const;
export type PreviewScenarioId = (typeof PREVIEW_SCENARIO_IDS)[number];

export interface PreviewScenario {
  readonly id: PreviewScenarioId;
  /** Staff-facing heading in the preview tab. */
  readonly label: string;
  /** The state this scenario must derive to (tests/unit/preview-outcomes.spec.ts checks it on every day). */
  readonly guideKey: GuideKey;
  readonly overdue: boolean;
  readonly outcome: LookupOutcome;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const STALE_START_HOURS = -21 * 24;
const STALE_LAST_HOURS = -20 * 24;

const AUTO_LOOKUP: DeliveryLookupResult = { carrier: "택배사 자동 확인", carrierCode: "AUTO", events: [] };

function cjLookup(events: readonly TrackingEvent[], lookupUnavailable = false): DeliveryLookupResult {
  return { carrier: "CJ대한통운", carrierCode: "CJ", events: [...events], ...(lookupUnavailable ? { lookupUnavailable: true } : {}) };
}

/** The ISO instant `hours` after `anchor` (negative = before). */
function at(anchor: Date, hours: number): string {
  return new Date(anchor.getTime() + hours * HOUR_MS).toISOString();
}

function ev(status: string, statusCode: StatusCode, datetime: string, location: string, extra: Partial<TrackingEvent> = {}): TrackingEvent {
  return { status, statusCode, datetime, location, ...extra };
}

interface SuccessRecipe {
  readonly kind: "success";
  readonly label: string;
  readonly guideKey: GuideKey;
  readonly type: TrackingType;
  readonly number: string;
  /** Days between the events and `now`; only the overdue variant sets it. */
  readonly ageDays?: number;
  readonly customs: (anchor: Date) => TrackingEvent[];
  readonly delivery: (anchor: Date) => DeliveryLookupResult;
}

interface FailureRecipe {
  readonly kind: "failure";
  readonly label: string;
  readonly guideKey: GuideKey;
  readonly number: string;
  readonly cause: FailureCause;
}

const noCustoms = (): TrackingEvent[] => [];
const autoLookup = (): DeliveryLookupResult => AUTO_LOOKUP;
const waitingEvents = (a: Date): TrackingEvent[] => [
  ev("입항", 1, at(a, -27), "인천공항"),
  ev("통관목록접수", 2, at(a, -3), "인천공항세관")
];
const clearedEvents = (a: Date): TrackingEvent[] => [
  ev("입항", 1, at(a, -50), "인천공항"),
  ev("통관목록접수", 2, at(a, -26), "인천공항세관"),
  ev("수입신고수리", 4, at(a, -3), "인천공항세관")
];
const clearedBeforeHandoff = (a: Date): TrackingEvent[] => [
  ev("통관목록접수", 2, at(a, -50), "인천공항세관"),
  ev("수입신고수리", 4, at(a, -26), "인천공항세관")
];

const domestic = { kind: "success", type: "DOMESTIC", number: PREVIEW_NUMBERS.domestic } as const;
const hbl = { kind: "success", type: "HBL", number: PREVIEW_NUMBERS.hbl } as const;

const RECIPES: Readonly<Record<PreviewScenarioId, SuccessRecipe | FailureRecipe>> = {
  pending: { ...domestic, label: "국내 도착 전", guideKey: "pending", customs: noCustoms, delivery: autoLookup },
  customsArrived: {
    ...hbl,
    label: "입항 · 통관 준비",
    guideKey: "customsArrived",
    customs: (a) => [ev("입항", 1, at(a, -3), "인천공항")],
    delivery: autoLookup
  },
  customsWaiting: { ...hbl, label: "통관 대기", guideKey: "customsWaiting", customs: waitingEvents, delivery: autoLookup },
  customsWaitingOverdue: {
    ...hbl,
    label: "통관 대기 · 걱정 기준일 지남",
    guideKey: "customsWaiting",
    ageDays: PREVIEW_OVERDUE_AGE_DAYS,
    customs: waitingEvents,
    delivery: autoLookup
  },
  customsCleared: { ...domestic, label: "통관 완료", guideKey: "customsCleared", customs: clearedEvents, delivery: autoLookup },
  customsClearedCarrierCut: {
    ...domestic,
    label: "통관 완료 · 택배사 조회 지연",
    guideKey: "customsCleared",
    customs: clearedEvents,
    delivery: () => cjLookup([], true)
  },
  handedToCarrier: {
    ...domestic,
    label: "택배사 인계",
    guideKey: "handedToCarrier",
    customs: clearedBeforeHandoff,
    delivery: (a) => cjLookup([ev("간선상차", 5, at(a, -3), "인천GW")])
  },
  pickedUp: {
    ...domestic,
    label: "기사님 픽업",
    guideKey: "pickedUp",
    customs: clearedBeforeHandoff,
    delivery: (a) => cjLookup([ev("집화처리", 5, at(a, -3), "인천GW")])
  },
  inTransit: {
    ...domestic,
    label: "국내 배송 중",
    guideKey: "inTransit",
    customs: (a) => [ev("통관목록접수", 2, at(a, -74), "인천공항세관"), ev("수입신고수리", 4, at(a, -50), "인천공항세관")],
    delivery: (a) =>
      cjLookup([
        ev("집화처리", 5, at(a, -26), "인천GW"),
        ev("배송출발", 6, at(a, -3), "서울강남", { driverPhone: PREVIEW_DRIVER_PHONE })
      ])
  },
  delivered: {
    ...domestic,
    label: "배송 완료",
    guideKey: "delivered",
    customs: (a) => [ev("수입신고수리", 4, at(a, -74), "인천공항세관")],
    delivery: (a) =>
      cjLookup([
        ev("집화처리", 5, at(a, -50), "인천GW"),
        ev("배송출발", 6, at(a, -8), "서울강남"),
        ev("배송완료", 7, at(a, -3), "문 앞")
      ])
  },
  stale: {
    ...domestic,
    label: "장기 정체",
    guideKey: "stale",
    customs: (a) => [
      ev("통관목록접수", 2, at(a, STALE_START_HOURS), "인천공항세관"),
      ev("통관목록심사", 3, at(a, STALE_LAST_HOURS), "인천공항세관")
    ],
    delivery: autoLookup
  },
  lookupUnavailable: {
    ...domestic,
    label: "택배사 조회 지연",
    guideKey: "lookupUnavailable",
    customs: noCustoms,
    delivery: () => ({ ...AUTO_LOOKUP, lookupUnavailable: true })
  },
  ambiguous: {
    ...domestic,
    label: "여러 택배사에 같은 번호",
    guideKey: "ambiguous",
    customs: noCustoms,
    delivery: () => ({ ...AUTO_LOOKUP, ambiguous: true })
  },
  invalidNumber: { kind: "failure", label: "번호 형식 오류", guideKey: "invalidNumber", number: PREVIEW_NUMBERS.invalid, cause: "invalidNumber" },
  notFound: { kind: "failure", label: "조회 결과 없음", guideKey: "notFound", number: PREVIEW_NUMBERS.hbl, cause: "notFound" },
  temporaryDelay: { kind: "failure", label: "일시 지연", guideKey: "temporaryDelay", number: PREVIEW_NUMBERS.domestic, cause: "upstreamTimeout" },
  offline: { kind: "failure", label: "인터넷 연결 끊김", guideKey: "offline", number: PREVIEW_NUMBERS.domestic, cause: "offline" },
  noResponse: { kind: "failure", label: "응답 없음", guideKey: "noResponse", number: PREVIEW_NUMBERS.hbl, cause: "clientTimeout" },
  serverError: { kind: "failure", label: "조회 오류", guideKey: "serverError", number: PREVIEW_NUMBERS.domestic, cause: "serverError" }
};

function request(number: string): LookupRequest {
  return { number, carrier: "AUTO", entry: "manual" };
}

export function buildPreviewScenario(id: PreviewScenarioId, now: Date): PreviewScenario {
  const recipe = RECIPES[id];
  if (recipe.kind === "failure") {
    return {
      id,
      label: recipe.label,
      guideKey: recipe.guideKey,
      overdue: false,
      outcome: { kind: "failure", request: request(recipe.number), cause: recipe.cause, consecutiveFailures: 1 }
    };
  }
  const anchor = new Date(now.getTime() - (recipe.ageDays ?? 0) * DAY_MS);
  const data = normalizeTrackingData({
    trackingNumber: recipe.number,
    type: recipe.type,
    customsEvents: recipe.customs(anchor),
    deliveryLookup: recipe.delivery(anchor),
    now: anchor
  });
  return {
    id,
    label: recipe.label,
    guideKey: recipe.guideKey,
    overdue: recipe.ageDays !== undefined,
    outcome: { kind: "success", request: request(recipe.number), data }
  };
}

export function buildPreviewScenarios(now: Date): readonly PreviewScenario[] {
  return PREVIEW_SCENARIO_IDS.map((id) => buildPreviewScenario(id, now));
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/preview-outcomes.spec.ts tests/unit/real-number-guard.spec.ts tests/unit/module-boundaries.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed (`preview-outcomes.spec.ts`: `5 passed`). If "every scenario derives to its state …" lists mismatches, read the first one: a scenario that turns `stale`, `overdue` or into another key on a holiday means an event offset in `RECIPES` is wrong for that day — fix the offset, never the expectation.
Run: `npm run typecheck; npx eslint lib/cs/preview-outcomes.ts tests/unit/preview-outcomes.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 5: Commit**

```powershell
git add lib/cs/preview-outcomes.ts tests/unit/preview-outcomes.spec.ts
git commit -m "feat: add fake preview outcomes for every result state"
```

---

### Task 5: Notices and holidays at a chosen instant — `notice-status.ts`

**Files:**
- Create: `lib/cs/notice-status.ts`
- Test: `tests/unit/notice-status.spec.ts` (create)

**Interfaces:**
- Consumes: `NOTICE_PRIORITY`, `activeNotices(notices, now, slot)`, `pickNotice(notices, now, slot)` (`lib/tracking/notices.ts`, S03); `holidayPeriodBetween(from, to, calendar)`, `kstDateKey(instant)`, `parseInstant(iso)` (`lib/tracking/time.ts`, S03); `GUIDE_KEYS`, `GuideKey` (S03); `Notice`, `CalendarConfig`, `HolidayPeriod` (`lib/config/types.ts`, S03); tests: `FIXTURE_NOTICES`, `FIXTURE_CONFIG` (`tests/fixtures/config-fixtures.ts`), `OCTOBER_NOW` (`tests/fixtures/derive-scenarios.ts`), `FIXTURE_NOW`.
- Produces (Additions 5): `type NoticeWindow = "active" | "scheduled" | "expired"`, `interface NoticeGroups { active; scheduled; expired }`, `interface NoticePlacement { home: Notice | null; cs: readonly Notice[]; results: readonly { guideKey: GuideKey; notice: Notice }[] }`, `noticeWindowAt(notice, now): NoticeWindow`, `groupNoticesAt(notices, now): NoticeGroups` (active by priority then latest start, scheduled by start, expired by latest end), `noticePlacementAt(notices, now): NoticePlacement` (the same selection the pages use), `holidayAt(now, calendar): HolidayPeriod | null` (the KST day). Used by `NoticeStatusTab` (Task 12).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/notice-status.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import type { Notice } from "@/lib/config/types";
import { groupNoticesAt, holidayAt, noticePlacementAt, noticeWindowAt } from "@/lib/cs/notice-status";
import { FIXTURE_CONFIG, FIXTURE_NOTICES } from "../fixtures/config-fixtures";
import { OCTOBER_NOW } from "../fixtures/derive-scenarios";
import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";

const kst = (local: string): Date => new Date(`${local}+09:00`);
const ids = (notices: readonly Notice[]): readonly string[] => notices.map((notice) => notice.id);

function fixtureNotice(id: string): Notice {
  const found = FIXTURE_NOTICES.find((notice) => notice.id === id);
  if (found === undefined) throw new Error(`missing fixture notice ${id}`);
  return found;
}

test("a notice is scheduled before startsAt, active from startsAt and expired from endsAt", () => {
  const outage = fixtureNotice("fx-outage");
  expect(noticeWindowAt(outage, kst("2026-09-26T21:59:59"))).toBe("scheduled");
  expect(noticeWindowAt(outage, kst("2026-09-26T22:00:00"))).toBe("active");
  expect(noticeWindowAt(outage, kst("2026-09-26T23:59:59"))).toBe("active");
  expect(noticeWindowAt(outage, kst("2026-09-27T00:00:00"))).toBe("expired");
});

test("a notice with an unreadable window counts as expired", () => {
  expect(noticeWindowAt({ ...fixtureNotice("fx-info"), startsAt: "언제나" }, FIXTURE_NOW)).toBe("expired");
});

test("groups: active by priority, scheduled by start, expired by the latest end", () => {
  const now = groupNoticesAt(FIXTURE_NOTICES, FIXTURE_NOW);
  expect([ids(now.active), ids(now.scheduled), ids(now.expired)]).toEqual([["fx-holiday", "fx-info"], ["fx-outage"], ["fx-expired"]]);
  expect(ids(groupNoticesAt(FIXTURE_NOTICES, kst("2026-09-26T22:30:00")).active)).toEqual(["fx-outage", "fx-holiday", "fx-info"]);
  expect(ids(groupNoticesAt(FIXTURE_NOTICES, kst("2026-08-01T09:00:00")).scheduled)).toEqual([
    "fx-expired",
    "fx-info",
    "fx-holiday",
    "fx-outage"
  ]);
  expect(ids(groupNoticesAt(FIXTURE_NOTICES, kst("2026-10-02T09:00:00")).expired)).toEqual([
    "fx-info",
    "fx-holiday",
    "fx-outage",
    "fx-expired"
  ]);
});

test("places at the fixture time: the home line, CS replies and the result states", () => {
  const places = noticePlacementAt(FIXTURE_NOTICES, FIXTURE_NOW);
  expect(places.home?.id).toBe("fx-holiday");
  expect(ids(places.cs)).toEqual(["fx-holiday"]);
  expect(places.results.map((place) => [place.guideKey, place.notice.id])).toEqual(
    ["pending", "customsArrived", "customsWaiting", "customsCleared", "handedToCarrier", "pickedUp", "inTransit"].map((key) => [
      key,
      "fx-holiday"
    ])
  );
});

test("during the outage window the outage wins where it is listed, and waiting screens show only it", () => {
  const places = noticePlacementAt(FIXTURE_NOTICES, kst("2026-09-26T22:30:00"));
  expect(places.home?.id).toBe("fx-outage");
  expect(ids(places.cs)).toEqual(["fx-outage", "fx-holiday"]);
  expect(places.results.map((place) => [place.guideKey, place.notice.id])).toEqual([
    ["loading", "fx-outage"],
    ["notFound", "fx-outage"],
    ["temporaryDelay", "fx-outage"],
    ["offline", "fx-outage"],
    ["noResponse", "fx-outage"],
    ["pending", "fx-holiday"],
    ["customsArrived", "fx-holiday"],
    ["customsWaiting", "fx-outage"],
    ["customsCleared", "fx-holiday"],
    ["handedToCarrier", "fx-holiday"],
    ["pickedUp", "fx-holiday"],
    ["inTransit", "fx-holiday"]
  ]);
});

test("holidayAt names the holiday of the KST day, even when the UTC date is the day before", () => {
  const calendar = FIXTURE_CONFIG.calendar;
  expect(holidayAt(FIXTURE_NOW, calendar)?.id).toBe("2026-chuseok");
  expect(holidayAt(new Date("2026-09-23T15:30:00Z"), calendar)?.id).toBe("2026-chuseok");
  expect(holidayAt(new Date("2026-09-23T14:59:00Z"), calendar)).toBeNull();
  expect(holidayAt(kst("2026-10-09T09:00:00"), calendar)?.id).toBe("2026-hangul-day");
  expect(holidayAt(OCTOBER_NOW, calendar)).toBeNull();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/notice-status.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL while loading the file — `Error: Cannot find module '@/lib/cs/notice-status'` (0 tests run).

- [ ] **Step 3: Write the implementation**

Create `lib/cs/notice-status.ts`:

```ts
import type { CalendarConfig, HolidayPeriod, Notice } from "@/lib/config/types";
import { NOTICE_PRIORITY, activeNotices, pickNotice } from "@/lib/tracking/notices";
import { holidayPeriodBetween, kstDateKey, parseInstant } from "@/lib/tracking/time";
import { GUIDE_KEYS, type GuideKey } from "@/lib/tracking/types";

// Internal-only (contract §11.1 rule 4): what the 공지 현황 tab shows for a chosen instant (spec §10 ④, §9 공지·연휴).
// Placements reuse lib/tracking/notices.ts, so the tab shows exactly what the pages would show at that instant.

export type NoticeWindow = "active" | "scheduled" | "expired";

export interface NoticeGroups {
  readonly active: readonly Notice[];
  readonly scheduled: readonly Notice[];
  readonly expired: readonly Notice[];
}

export interface NoticePlacement {
  /** The one line under the home header. */
  readonly home: Notice | null;
  /** Appended to CS replies, in priority order. */
  readonly cs: readonly Notice[];
  /** The in-card '안내' line per result state that has one. */
  readonly results: readonly { readonly guideKey: GuideKey; readonly notice: Notice }[];
}

const instantMs = (iso: string): number => parseInstant(iso)?.getTime() ?? Number.NaN;

export function noticeWindowAt(notice: Notice, now: Date): NoticeWindow {
  const starts = instantMs(notice.startsAt);
  const ends = instantMs(notice.endsAt);
  if (Number.isNaN(starts) || Number.isNaN(ends)) return "expired";
  const nowMs = now.getTime();
  if (nowMs < starts) return "scheduled";
  return nowMs < ends ? "active" : "expired";
}

const byPriority = (a: Notice, b: Notice): number =>
  NOTICE_PRIORITY[a.kind] - NOTICE_PRIORITY[b.kind] || instantMs(b.startsAt) - instantMs(a.startsAt) || a.id.localeCompare(b.id);
const byStart = (a: Notice, b: Notice): number => instantMs(a.startsAt) - instantMs(b.startsAt) || a.id.localeCompare(b.id);
const byLatestEnd = (a: Notice, b: Notice): number => instantMs(b.endsAt) - instantMs(a.endsAt) || a.id.localeCompare(b.id);

export function groupNoticesAt(notices: readonly Notice[], now: Date): NoticeGroups {
  const inWindow = (window: NoticeWindow): Notice[] => notices.filter((notice) => noticeWindowAt(notice, now) === window);
  return {
    active: inWindow("active").sort(byPriority),
    scheduled: inWindow("scheduled").sort(byStart),
    expired: inWindow("expired").sort(byLatestEnd)
  };
}

export function noticePlacementAt(notices: readonly Notice[], now: Date): NoticePlacement {
  return {
    home: pickNotice(notices, now, { kind: "home" }),
    cs: activeNotices(notices, now, { kind: "cs" }),
    results: GUIDE_KEYS.flatMap((guideKey) => {
      const notice = pickNotice(notices, now, { kind: "result", guideKey });
      return notice === null ? [] : [{ guideKey, notice }];
    })
  };
}

/** The holiday period that contains the KST calendar day of `now`, or null. */
export function holidayAt(now: Date, calendar: CalendarConfig): HolidayPeriod | null {
  const day = kstDateKey(now);
  return holidayPeriodBetween(day, day, calendar);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/notice-status.spec.ts tests/unit/module-boundaries.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed (`notice-status.spec.ts`: `6 passed`).
Run: `npm run typecheck; npx eslint lib/cs/notice-status.ts tests/unit/notice-status.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 5: Commit**

```powershell
git add lib/cs/notice-status.ts tests/unit/notice-status.spec.ts
git commit -m "feat: group notices and find holidays at a chosen KST instant for the CS desk"
```

---

### Task 6: A status for every mismatch draft (작성·발송·회신·완료)

**Files:**
- Modify: `lib/cs/mismatch-storage.ts` (four insertions; S01 file with S04's template import)
- Modify: `components/InternalCsHelper.tsx` (the record literal in `handleSaveMismatch`, so the legacy form keeps compiling until Task 9)
- Test: `tests/unit/mismatch-storage.spec.ts` (import block, the `record` helper, four appended tests)

**Interfaces:**
- Consumes: S01's `MismatchRecord`, `parseMismatchPayload`, `serializeMismatchPayload` (S01-private), `MismatchRecordSchema` (private); `FAKE`, `FIXTURE_NOW`.
- Produces (Additions 6): `MISMATCH_STATUSES = ["draft", "sent", "replied", "done"] as const`, `type MismatchStatus`, `MISMATCH_STATUS_LABELS = { draft: "작성", sent: "발송", replied: "회신", done: "완료" }`, `isMismatchStatus(value: unknown): value is MismatchStatus`, `withRecordStatus(records: readonly MismatchRecord[], id: string, status: MismatchStatus, now: Date): readonly MismatchRecord[]`; `MismatchRecord.status: MismatchStatus` (required; stored records without it parse as `"draft"` and are rewritten once). Field order in stored records: `id, phone, content, trackingMemo, templateKey, status, createdAt, updatedAt?` (the schema order, so a record the desk writes never needs a rewrite).

- [ ] **Step 1: Write the failing tests**

In `tests/unit/mismatch-storage.spec.ts`:

(a) Replace the import block

```ts
import {
  MISMATCH_LEGACY_KEY,
  MISMATCH_TTL_DAYS,
  parseMismatchPayload,
  serializeMismatchPayload,
  type MismatchRecord
} from "@/lib/cs/mismatch-storage";
```

with

```ts
import {
  MISMATCH_LEGACY_KEY,
  MISMATCH_STATUSES,
  MISMATCH_STATUS_LABELS,
  MISMATCH_TTL_DAYS,
  isMismatchStatus,
  parseMismatchPayload,
  serializeMismatchPayload,
  withRecordStatus,
  type MismatchRecord
} from "@/lib/cs/mismatch-storage";
```

(b) In the `record` helper, replace

```ts
  templateKey,
  createdAt
});
```

with

```ts
  templateKey,
  status: "draft",
  createdAt
});
```

(c) Append to the end of the file:

```ts
test("the four statuses keep their order and Korean labels", () => {
  expect(MISMATCH_STATUSES).toEqual(["draft", "sent", "replied", "done"]);
  expect(MISMATCH_STATUS_LABELS).toEqual({ draft: "작성", sent: "발송", replied: "회신", done: "완료" });
  expect(isMismatchStatus("replied")).toBe(true);
  expect(isMismatchStatus("shipped")).toBe(false);
  expect(isMismatchStatus(undefined)).toBe(false);
});

test("records saved before statuses existed read as 작성 and are rewritten once", () => {
  const old = {
    id: "old",
    phone: FAKE.phone,
    content: "통관부호 확인 부탁드립니다.",
    trackingMemo: "ORDER-1",
    templateKey: "default",
    createdAt: isoDaysAgo(1)
  };
  const parsed = parseMismatchPayload(JSON.stringify({ v: 1, records: [old] }), NOW);
  expect(parsed.records).toEqual([{ ...old, status: "draft" }]);
  expect(parsed.needsRewrite).toBe(true);
  expect(parseMismatchPayload(serializeMismatchPayload(parsed.records), NOW).needsRewrite).toBe(false);
});

test("an unknown status drops the record", () => {
  const raw = JSON.stringify({ v: 1, records: [{ ...record("odd", isoDaysAgo(1)), status: "shipped" }, record("kept", isoDaysAgo(1))] });
  expect(parseMismatchPayload(raw, NOW).records.map((item) => item.id)).toEqual(["kept"]);
});

test("withRecordStatus changes one record, stamps updatedAt and leaves the others and the input untouched", () => {
  const first = record("a", isoDaysAgo(2));
  const second = record("b", isoDaysAgo(1));
  const input: readonly MismatchRecord[] = [first, second];
  const next = withRecordStatus(input, "b", "sent", FIXTURE_NOW);
  expect(next[0]).toBe(first);
  expect(next[1]).toEqual({ ...second, status: "sent", updatedAt: FIXTURE_NOW.toISOString() });
  expect(input[1].status).toBe("draft");
  expect(parseMismatchPayload(serializeMismatchPayload(next), NOW).needsRewrite).toBe(false);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/mismatch-storage.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `8 failed, 4 passed`. The four new tests fail (`MISMATCH_STATUSES` is `undefined`, `withRecordStatus is not a function`, and the S01 schema strips `status`); S01's "a v1 payload round-trips without a rewrite", "the pre-S01 bare array is migrated to the v1 envelope", "drops broken records but keeps valid ones" and "every template key survives a round trip" fail because their records now carry `status`, which the old schema drops.

- [ ] **Step 3: Add the status to the store**

In `lib/cs/mismatch-storage.ts` (Edit tool):

(a) Replace

```ts
export const MISMATCH_TTL_DAYS = 14;
```

with

```ts
export const MISMATCH_TTL_DAYS = 14;

/** Progress of one mismatch notice (spec §10 상태: 작성·발송·회신·완료). Staff set it by hand; the tool never sends anything. */
export const MISMATCH_STATUSES = ["draft", "sent", "replied", "done"] as const;
export type MismatchStatus = (typeof MISMATCH_STATUSES)[number];
export const MISMATCH_STATUS_LABELS: Readonly<Record<MismatchStatus, string>> = {
  draft: "작성",
  sent: "발송",
  replied: "회신",
  done: "완료"
};
```

(b) Replace

```ts
  readonly templateKey: CustomsMismatchTemplateKey;
  readonly createdAt: string;
```

with

```ts
  readonly templateKey: CustomsMismatchTemplateKey;
  readonly status: MismatchStatus;
  readonly createdAt: string;
```

(c) Replace

```ts
  templateKey: z.enum(TEMPLATE_KEYS),
  createdAt: z.string().datetime({ offset: true }),
```

with

```ts
  templateKey: z.enum(TEMPLATE_KEYS),
  // Records saved before statuses existed read as 작성 (the rewrite on subscribe then stores the field).
  status: z.enum(MISMATCH_STATUSES).default("draft"),
  createdAt: z.string().datetime({ offset: true }),
```

(d) Replace

```ts
export const normalizePhone = (value: string): string => value.replace(/[^\d-]/g, "").trim();
```

with

```ts
export const normalizePhone = (value: string): string => value.replace(/[^\d-]/g, "").trim();

export function isMismatchStatus(value: unknown): value is MismatchStatus {
  return typeof value === "string" && MISMATCH_STATUSES.some((status) => status === value);
}

/** A copy of `records` with one record's status changed and `updatedAt` set; every other record is the same object. */
export function withRecordStatus(
  records: readonly MismatchRecord[],
  id: string,
  status: MismatchStatus,
  now: Date
): readonly MismatchRecord[] {
  return records.map((record) => (record.id === id ? { ...record, status, updatedAt: now.toISOString() } : record));
}
```

- [ ] **Step 4: Keep the legacy form compiling**

In `components/InternalCsHelper.tsx` (inside `handleSaveMismatch`), replace

```tsx
      templateKey,
      createdAt: new Date().toISOString()
    };
```

with

```tsx
      templateKey,
      status: "draft",
      createdAt: new Date().toISOString()
    };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/mismatch-storage.spec.ts tests/unit/module-boundaries.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed (`mismatch-storage.spec.ts`: `12 passed`).
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/internal-cs-helper.spec.ts`
Expected: `6 passed` (the migrated v1 payload still matches `{ v: 1, records: [{ id: "fresh" }] }`; new drafts carry `status: "draft"`).
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```powershell
git add lib/cs/mismatch-storage.ts components/InternalCsHelper.tsx tests/unit/mismatch-storage.spec.ts
git commit -m "feat: track a status for every customs mismatch draft"
```

---

### Task 7: Rule → assertion map of the CS helper suite

**Files:**
- Modify: `tests/e2e/RULE-MAP.md` (append section I)
- Test: the title check in Step 2 (PowerShell)

**Interfaces:**
- Consumes: the six titles recorded in Task 0 Step 10; the section format S06 created (Id | Legacy test | Business rule | New assertion | Status).
- Produces: section I — one row per legacy test of `tests/internal-cs-helper.spec.ts` with the new assertions of Tasks 8–10 (exact titles used in those tasks). Tasks 8, 9, 10 and 14 update the Status column.

- [ ] **Step 1: Append the section**

Append to the end of `tests/e2e/RULE-MAP.md` (after S08's section if S08 appended one first):

```markdown

## I — internal CS desk (S09)

The CS helper suite (`tests/internal-cs-helper.spec.ts`, S01 + S04) is staff tooling, not one of the E2E-locked customer rules, but its rules move the same way: the new assertion passes before the old test is removed (spec §14 test contract item 1). New assertions live in `tests/e2e/internal-bulk.spec.ts` (B), `tests/e2e/internal-mismatch.spec.ts` (M) and `tests/e2e/internal-desk.spec.ts` (D). Titles are exact.

| Id | Legacy test (`tests/internal-cs-helper.spec.ts`) | Business rule | New assertion (file → test) | Status |
|---|---|---|---|---|
| I1 | "internal helper generates a copy-ready delivery reply from an invoice" | One number gives a copy-ready reply built by `buildCsReply` from the view the customer sees; carrier and number are shown; the reply carries the customer link and no internal label or server wording; a copy control exists | B → "one number: the row shows the number and carrier, and the replies equal buildCsReply over the customer's view"; "the copy buttons copy the short reply, the long reply and the customer link" | pending (Task 10) |
| I2 | "internal helper answers pending invoices from the same view and saves nothing" | pending gets its reply from the same view; looking numbers up stores nothing in the browser | B → "pending: the reply comes from the same view, and a run stores nothing in the browser" | pending (Task 10) |
| I3 | "internal helper turns a failed lookup into a CS reply, never the server message" | a failed lookup gets the CS error reply; the server's message is never shown | B → "a failed lookup gets the CS error reply, never the server message" | pending (Task 10) |
| I4 | "internal helper stores customs mismatch drafts locally" | a draft is saved with the phone, the memo and the template text and survives a reload; the tool itself sends nothing (the disabled '알림톡 준비중'). The phone is now shown masked (spec §10) | M → "a saved draft is listed with the masked phone, memo and template text and survives a reload"; "the tool never sends messages: a record offers copy, status and delete only" | pending (Task 9) |
| I5 | "internal helper keeps mismatch drafts for 14 days and can clear them all" | legacy drafts migrate, expired ones are dropped, the retention is stated, [전체 삭제] clears storage | M → "legacy drafts are migrated, expired ones dropped, and [전체 삭제] clears everything" (approval 14: "legacy drafts move into this tab's list, expired ones are dropped, and [전체 삭제] clears everything") | pending (Task 9) |
| I6 | "internal helper still works when the browser refuses storage" | the tab opens with an empty list; saving explains the refusal in Korean | M → "a browser that refuses storage still opens and explains why saving failed" | pending (Task 9) |

New S09 assertions without a legacy counterpart: D (tablist/tab/tabpanel semantics, keyboard, `?tab=`, kept panel state, the four spec tabs); B (paste parsing, 20-number limit and [멈추기], problem-first order, the 375 px read-only customer screen, ≥ 1000 ms spacing with the chosen carrier, overlapping runs, blocked clipboard); M (masking, phone copy, status, template copy, missing phone; approval 14: tab-only default, 7-day keep, expiry); `tests/e2e/internal-preview.spec.ts` (every state's screen and replies equal the Node derivation, fake numbers only, read-only, 375 px); `tests/e2e/internal-notices.spec.ts` (lists, places, holiday and simulated screens follow the chosen KST time, also in a non-KST browser).
```

- [ ] **Step 2: Check that every legacy title is in the map**

Run (PowerShell):
```powershell
$titles = Select-String -LiteralPath tests/internal-cs-helper.spec.ts -Pattern '^test\("([^"]+)"' | ForEach-Object { $_.Matches[0].Groups[1].Value }
$map = Get-Content -LiteralPath tests/e2e/RULE-MAP.md -Raw -Encoding UTF8
$titles.Count
$titles | Where-Object { -not $map.Contains($_) }
```
Expected: `6`, then no output. If a title is printed (S04 renamed a test while executing), add a row for it to section I with its rule and the matching B/M assertion, then run the check again.

- [ ] **Step 3: Commit**

```powershell
git add tests/e2e/RULE-MAP.md
git commit -m "docs: map the CS helper E2E rules to the CS desk assertions"
```

---

### Task 8: The desk shell — tablist, tabs and panels; the legacy helper split into the first two tabs

The legacy helper keeps working inside the new shell (one instance per tab, its own header hidden), so its six E2E rules stay green while Tasks 9 and 10 replace each half.

**Files:**
- Create: `components/internal/tabs.ts`, `components/internal/ui.ts`, `components/internal/InternalCsDesk.tsx`
- Modify (whole file): `app/(internal)/internal/cs-helper/page.tsx`
- Modify: `components/InternalCsHelper.tsx` (signature, initial tab, header block, root element — transitional)
- Modify: `tests/internal-cs-helper.spec.ts` (four selectors: button → tab)
- Modify: `tests/e2e/RULE-MAP.md` (status of I4–I6)
- Create: `tests/support/internal-desk.ts`
- Test: `tests/e2e/internal-desk.spec.ts` (create)

**Interfaces:**
- Consumes: `InternalCsHelper` (legacy, S01/S04) with the new transitional prop; `INTERNAL_TEST_CREDENTIALS` (`tests/internal-auth.ts`); S05 tokens (`tt-*` classes, `.tt-focus`).
- Produces: `components/internal/tabs.ts` — `INTERNAL_TAB_IDS` (`["delivery", "mismatch"]` now; Tasks 11 and 12 append `"preview"` and `"notices"`), `type InternalTabId`, `INTERNAL_TAB_LABELS`, `DEFAULT_INTERNAL_TAB = "delivery"`, `parseInternalTab(value: string | readonly string[] | undefined): InternalTabId`; `components/internal/ui.ts` — `PANEL_CLASS`, `LABEL_CLASS`, `HELP_CLASS`, `FIELD_CLASS`, `ERROR_CLASS`, `SECTION_TITLE_CLASS`; contract `InternalCsDesk(props: { readonly initialTab?: InternalTabId }): React.JSX.Element` (Additions 1) — `<main>` with h1 '배송·통관 CS 데스크', `role="tablist"` named 'CS 데스크 메뉴', one `role="tab"` button per id (`id="cs-tab-<id>"`, `aria-selected`, `aria-controls="cs-panel-<id>"`, roving `tabIndex`, `data-internal-tab-button`), one `role="tabpanel"` section per id (`id="cs-panel-<id>"`, `aria-labelledby`, `data-internal-tab`, `hidden` when not selected); a panel's content mounts the first time its tab is selected and then stays mounted; ←/→ wrap, Home/End jump (automatic activation). `tests/support/internal-desk.ts` — `openDesk(page, tab)`. `InternalCsHelper` gains `({ section }: { readonly section?: "delivery" | "mismatch" })` (transitional; the file is deleted in Task 10).

- [ ] **Step 1: Write the failing desk test and its helper**

Create `tests/support/internal-desk.ts`:

```ts
import { expect, type Page } from "@playwright/test";
import { INTERNAL_TAB_LABELS, type InternalTabId } from "@/components/internal/tabs";

/** Opens /internal/cs-helper on one tab; the calling spec uses INTERNAL_TEST_CREDENTIALS. */
export async function openDesk(page: Page, tab: InternalTabId): Promise<void> {
  await page.goto(`/internal/cs-helper?tab=${tab}`);
  await expect(page.getByRole("tab", { name: INTERNAL_TAB_LABELS[tab], exact: true })).toHaveAttribute("aria-selected", "true");
}
```

Create `tests/e2e/internal-desk.spec.ts`:

```ts
import { expect, test, type Locator, type Page } from "@playwright/test";
import { INTERNAL_TAB_IDS, INTERNAL_TAB_LABELS, type InternalTabId } from "@/components/internal/tabs";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
import { openDesk } from "../support/internal-desk";

test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

const tab = (page: Page, id: InternalTabId): Locator => page.getByRole("tab", { name: INTERNAL_TAB_LABELS[id], exact: true });
const panel = (page: Page, id: InternalTabId): Locator => page.locator(`[data-internal-tab="${id}"]`);

async function expectSelected(page: Page, selected: InternalTabId): Promise<void> {
  for (const id of INTERNAL_TAB_IDS) {
    const isSelected = id === selected;
    await expect(tab(page, id)).toHaveAttribute("aria-selected", String(isSelected));
    await expect(tab(page, id)).toHaveAttribute("tabindex", isSelected ? "0" : "-1");
    if (isSelected) await expect(panel(page, id)).toBeVisible();
    else await expect(panel(page, id)).toBeHidden();
  }
}

test("one tablist names every tab, and each tab controls its labelled panel", async ({ page }) => {
  await page.goto("/internal/cs-helper");
  await expect(page.getByRole("heading", { level: 1, name: "배송·통관 CS 데스크" })).toBeVisible();
  const list = page.getByRole("tablist", { name: "CS 데스크 메뉴" });
  await expect(list.getByRole("tab")).toHaveText(INTERNAL_TAB_IDS.map((id) => INTERNAL_TAB_LABELS[id]));
  for (const id of INTERNAL_TAB_IDS) {
    const controls = await tab(page, id).getAttribute("aria-controls");
    const ownId = await tab(page, id).getAttribute("id");
    expect(controls).not.toBeNull();
    const target = page.locator(`[id="${controls ?? ""}"]`);
    await expect(target).toHaveAttribute("role", "tabpanel");
    await expect(target).toHaveAttribute("data-internal-tab", id);
    await expect(target).toHaveAttribute("aria-labelledby", ownId ?? "");
  }
  await expectSelected(page, "delivery");
});

test("clicking a tab selects it and shows only its panel", async ({ page }) => {
  await page.goto("/internal/cs-helper");
  for (const id of [...INTERNAL_TAB_IDS].reverse()) {
    await tab(page, id).click();
    await expectSelected(page, id);
  }
});

test("arrow keys, Home and End move the selection and the focus", async ({ page }) => {
  const first = INTERNAL_TAB_IDS[0];
  const second = INTERNAL_TAB_IDS[1];
  const last = INTERNAL_TAB_IDS[INTERNAL_TAB_IDS.length - 1];
  await page.goto("/internal/cs-helper");
  await tab(page, first).focus();
  await page.keyboard.press("ArrowRight");
  await expectSelected(page, second);
  await expect(tab(page, second)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expectSelected(page, first);
  await page.keyboard.press("ArrowLeft");
  await expectSelected(page, last);
  await expect(tab(page, last)).toBeFocused();
  await page.keyboard.press("Home");
  await expectSelected(page, first);
  await page.keyboard.press("End");
  await expectSelected(page, last);
});

test("?tab= opens that tab; anything else opens 배송 안내", async ({ page }) => {
  for (const id of INTERNAL_TAB_IDS) {
    await openDesk(page, id);
    await expectSelected(page, id);
  }
  await page.goto("/internal/cs-helper?tab=unknown");
  await expectSelected(page, "delivery");
});

test("a panel keeps what staff typed while another tab is shown", async ({ page }) => {
  await openDesk(page, "mismatch");
  await page.getByLabel("운송장/주문 메모", { exact: true }).fill("ORDER-KEEP");
  await tab(page, "delivery").click();
  await tab(page, "mismatch").click();
  await expect(page.getByLabel("운송장/주문 메모", { exact: true })).toHaveValue("ORDER-KEEP");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/internal-desk.spec.ts`
Expected: FAIL while loading the file — `Error: Cannot find module '@/components/internal/tabs'` (0 tests run).

- [ ] **Step 3: Create the tab ids and the shared classes**

Create `components/internal/tabs.ts`:

```ts
// The CS desk's tabs (spec §10 탭 4개). A plain module (no "use client"): the server page validates ?tab= with it
// and the client desk renders it.

export const INTERNAL_TAB_IDS = ["delivery", "mismatch"] as const;
export type InternalTabId = (typeof INTERNAL_TAB_IDS)[number];

export const INTERNAL_TAB_LABELS: Readonly<Record<InternalTabId, string>> = {
  delivery: "배송 안내",
  mismatch: "통관부호 불일치"
};

export const DEFAULT_INTERNAL_TAB: InternalTabId = "delivery";

/** `?tab=` → a tab id; missing, unknown or repeated values open 배송 안내. */
export function parseInternalTab(value: string | readonly string[] | undefined): InternalTabId {
  const raw = typeof value === "string" ? value : value?.[0];
  return INTERNAL_TAB_IDS.find((id) => id === raw) ?? DEFAULT_INTERNAL_TAB;
}
```

Create `components/internal/ui.ts`:

```ts
// Shared class lists of the CS desk. S05 tokens only, so the desk follows the page's screen style.

export const PANEL_CLASS = "flex flex-col gap-4 border-2 border-solid border-tt-rule bg-tt-surface p-4 text-tt-ink";
export const SECTION_TITLE_CLASS = "m-0 font-tt-display text-tt-lg [font-weight:var(--tt-weight-display)] [word-break:keep-all]";
export const LABEL_CLASS = "block text-tt-sm font-bold text-tt-ink [word-break:keep-all]";
export const HELP_CLASS = "m-0 text-tt-sm text-tt-muted [word-break:keep-all]";
export const FIELD_CLASS =
  "tt-focus block min-h-[44px] w-full min-w-0 border-2 border-solid border-tt-ink bg-tt-surface px-3 py-2 font-tt-body text-tt-md text-tt-ink";
export const ERROR_CLASS =
  "m-0 border-0 border-l-4 border-solid border-tt-problem bg-tt-surface px-3 py-2 text-tt-sm font-bold text-tt-problem-ink [word-break:keep-all]";
```

- [ ] **Step 4: Let the legacy helper render one section without its own header**

In `components/InternalCsHelper.tsx` (Edit tool; transitional until Task 10 deletes the file):

(a) Replace `export const InternalCsHelper = () => {` with

```tsx
export const InternalCsHelper = ({ section }: { readonly section?: ActiveTab }) => {
```

(b) Replace `  const [activeTab, setActiveTab] = useState<ActiveTab>("delivery");` with

```tsx
  const [activeTab, setActiveTab] = useState<ActiveTab>(section ?? "delivery");
```

(c) Replace

```tsx
    <main className="pointer-events-auto mx-auto min-h-screen w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      <section className="mb-5 flex flex-col gap-4 border-b border-slate-700/70 pb-5 lg:flex-row lg:items-end lg:justify-between">
```

with

```tsx
    <div className="pointer-events-auto mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      {section !== undefined ? null : (
      <section className="mb-5 flex flex-col gap-4 border-b border-slate-700/70 pb-5 lg:flex-row lg:items-end lg:justify-between">
```

(d) Replace

```tsx
        </div>
      </section>

      {error ? (
```

with

```tsx
        </div>
      </section>
      )}

      {error ? (
```

(e) Replace the last lines of the file

```tsx
    </main>
  );
};
```

with

```tsx
    </div>
  );
};
```

- [ ] **Step 5: Create the desk and render it on the page**

Create `components/internal/InternalCsDesk.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { InternalCsHelper } from "@/components/InternalCsHelper";
import { DEFAULT_INTERNAL_TAB, INTERNAL_TAB_IDS, INTERNAL_TAB_LABELS, type InternalTabId } from "./tabs";
import { HELP_CLASS } from "./ui";

const DESK_TITLE = "배송·통관 CS 데스크";
const DESK_INTRO = "번호를 한꺼번에 조회해 고객 답변을 만들고, 통관부호 불일치 안내와 공지를 관리합니다. 조회 결과와 복사 이력은 저장하지 않습니다.";
const TABLIST_LABEL = "CS 데스크 메뉴";
const TAB_CLASS =
  "tt-focus min-h-[44px] border-0 border-b-4 border-solid border-transparent bg-transparent px-4 text-tt-md font-bold text-tt-muted aria-selected:border-tt-ink aria-selected:text-tt-ink";

const tabElementId = (id: InternalTabId): string => `cs-tab-${id}`;
const panelElementId = (id: InternalTabId): string => `cs-panel-${id}`;

/** Where a key moves the selection (automatic activation; the arrows wrap). */
function targetIndex(key: string, index: number, last: number): number | null {
  switch (key) {
    case "ArrowRight":
      return index === last ? 0 : index + 1;
    case "ArrowLeft":
      return index === 0 ? last : index - 1;
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}

function TabContent({ id }: { readonly id: InternalTabId }): React.JSX.Element {
  switch (id) {
    case "delivery":
      return <InternalCsHelper section="delivery" />;
    case "mismatch":
      return <InternalCsHelper section="mismatch" />;
  }
}

/**
 * The internal CS desk (spec §10): one tablist, one panel per tab. A panel mounts the first time its tab is chosen and
 * then stays mounted (hidden), so a running bulk lookup or a half-written draft survives a tab switch.
 */
export function InternalCsDesk({ initialTab = DEFAULT_INTERNAL_TAB }: { readonly initialTab?: InternalTabId }): React.JSX.Element {
  const [active, setActive] = useState<InternalTabId>(initialTab);
  const [opened, setOpened] = useState<ReadonlySet<InternalTabId>>(() => new Set([initialTab]));
  const tabRefs = useRef<Partial<Record<InternalTabId, HTMLButtonElement | null>>>({});

  const select = (id: InternalTabId, moveFocus: boolean): void => {
    setActive(id);
    setOpened((previous) => (previous.has(id) ? previous : new Set([...previous, id])));
    if (moveFocus) tabRefs.current[id]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    const target = targetIndex(event.key, INTERNAL_TAB_IDS.indexOf(active), INTERNAL_TAB_IDS.length - 1);
    if (target === null) return;
    event.preventDefault();
    select(INTERNAL_TAB_IDS[target], true);
  };

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 pb-16 pt-6 text-tt-ink">
      <header className="flex flex-col gap-2">
        <h1 className="m-0 font-tt-display text-tt-xl [font-weight:var(--tt-weight-display)]">{DESK_TITLE}</h1>
        <p className={HELP_CLASS}>{DESK_INTRO}</p>
      </header>
      <div role="tablist" aria-label={TABLIST_LABEL} className="flex flex-wrap gap-1 border-0 border-b-2 border-solid border-tt-rule">
        {INTERNAL_TAB_IDS.map((id) => (
          <button
            key={id}
            ref={(node) => {
              tabRefs.current[id] = node;
            }}
            type="button"
            role="tab"
            id={tabElementId(id)}
            aria-selected={id === active}
            aria-controls={panelElementId(id)}
            tabIndex={id === active ? 0 : -1}
            data-internal-tab-button={id}
            onClick={() => select(id, false)}
            onKeyDown={onKeyDown}
            className={TAB_CLASS}
          >
            {INTERNAL_TAB_LABELS[id]}
          </button>
        ))}
      </div>
      {INTERNAL_TAB_IDS.map((id) => (
        <section
          key={id}
          role="tabpanel"
          id={panelElementId(id)}
          aria-labelledby={tabElementId(id)}
          data-internal-tab={id}
          hidden={id !== active}
          tabIndex={0}
          className="tt-focus"
        >
          {opened.has(id) ? <TabContent id={id} /> : null}
        </section>
      ))}
    </main>
  );
}
```

Replace the whole content of `app/(internal)/internal/cs-helper/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { InternalCsDesk } from "@/components/internal/InternalCsDesk";
import { parseInternalTab } from "@/components/internal/tabs";

export const metadata: Metadata = {
  title: "배송·통관 CS 데스크",
  description: "배송 안내 일괄 조회, 통관부호 불일치 안내, 안내표 미리보기와 공지 현황"
};

interface CsHelperPageProps {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}

/** /internal/cs-helper — basic auth (proxy.ts), noindex and no-referrer come from the (internal) layout; ?tab= opens a tab. */
export default async function InternalCsHelperPage({ searchParams }: CsHelperPageProps): Promise<React.JSX.Element> {
  const { tab } = await searchParams;
  return <InternalCsDesk initialTab={parseInternalTab(tab)} />;
}
```

- [ ] **Step 6: Point the legacy mismatch tests at the tab**

In `tests/internal-cs-helper.spec.ts`, replace every occurrence (Edit tool, `replace_all`) of

```ts
page.getByRole("button", { name: "통관부호 불일치" })
```

with

```ts
page.getByRole("tab", { name: "통관부호 불일치" })
```

Run: `Select-String -LiteralPath tests/internal-cs-helper.spec.ts -Pattern 'getByRole\("tab", \{ name: "통관부호 불일치" \}\)' | Measure-Object | Select-Object -ExpandProperty Count`
Expected: `4`.

In `tests/e2e/RULE-MAP.md`, replace every occurrence (`replace_all`) of `| pending (Task 9) |` with `| selector re-pointed to the tab (Task 8); pending (Task 9) |`.

- [ ] **Step 7: Run the tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/internal-desk.spec.ts tests/internal-cs-helper.spec.ts tests/internal-access.spec.ts tests/e2e/internal-isolation.spec.ts`
Expected: 0 failed — `internal-desk.spec.ts` `5 passed`, `internal-cs-helper.spec.ts` `6 passed` (the legacy delivery form sits in the 배송 안내 panel, the legacy mismatch form in the 통관부호 불일치 panel), `internal-access.spec.ts` `4 passed`, `internal-isolation.spec.ts` `3 passed`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/module-boundaries.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0 with no new warnings.

- [ ] **Step 8: Commit**

```powershell
git add components/internal/tabs.ts components/internal/ui.ts components/internal/InternalCsDesk.tsx "app/(internal)/internal/cs-helper/page.tsx" components/InternalCsHelper.tsx tests/internal-cs-helper.spec.ts tests/e2e/RULE-MAP.md tests/support/internal-desk.ts tests/e2e/internal-desk.spec.ts
git commit -m "feat: add the tabbed CS desk shell and split the legacy helper into its first two tabs"
```

---

### Task 9: The 통관부호 불일치 tab — masked phones, status, copy, clear-all

**Files:**
- Create: `components/internal/MismatchTab.tsx`, `components/internal/MismatchRecordList.tsx`
- Modify: `components/internal/InternalCsDesk.tsx` (one import, the `mismatch` case)
- Modify: `tests/support/internal-desk.ts` (clipboard recorder)
- Modify: `tests/internal-cs-helper.spec.ts` (remove the three mismatch tests once the new ones pass)
- Modify: `tests/e2e/RULE-MAP.md` (status of I4–I6)
- Test: `tests/e2e/internal-mismatch.spec.ts` (create)

**Interfaces:**
- Consumes: `MISMATCH_TTL_DAYS`, `MISMATCH_STATUSES`, `MISMATCH_STATUS_LABELS`, `isMismatchStatus`, `withRecordStatus`, `MismatchRecord`, `MismatchStatus`, `createRecordId`, `normalizePhone`, `getStoredRecordsSnapshot`, `getServerStoredRecordsSnapshot`, `subscribeStoredRecords`, `writeStoredRecords` (throws when storage refuses), `clearAllStoredRecords`, `MISMATCH_LEGACY_KEY` (`lib/cs/mismatch-storage.ts`, S01 + Task 6); `CUSTOMS_MISMATCH_TEMPLATES`, `CustomsMismatchTemplateKey` (`lib/cs/mismatch-templates.ts`, S04); `maskPhone` (Task 1); `formatKstDateTime`, `parseInstant` (S03); `Button({ variant, type?, … })`, `CopyButton({ mode: "copy", text, label, copiedLabel, variant })` (S05); `PANEL_CLASS`, `SECTION_TITLE_CLASS`, `LABEL_CLASS`, `HELP_CLASS`, `FIELD_CLASS`, `ERROR_CLASS` (Task 8); `openDesk` (Task 8); fixtures `FAKE`, `FIXTURE_NOW`.
- Produces: `MismatchTab(): React.JSX.Element` (form: '휴대폰 번호', '운송장/주문 메모', '안내 템플릿', '발송 예정 내용', [저장] primary, [내용 복사]; errors in `role="alert"`); `MismatchRecordList(props: MismatchRecordListProps): React.JSX.Element` with `interface MismatchRecordListProps { records: readonly MismatchRecord[]; retention: React.ReactNode; onStatus: (id: string, status: MismatchStatus) => void; onDelete: (id: string) => void; onClearAll: () => void }` (heading '불일치 안내 목록', count, the retention node, [전체 삭제] only when there are records, empty text '저장된 통관부호 불일치 안내가 없습니다.'; one `article[data-mismatch-record][data-mismatch-status]` per record, newest first, with the masked phone, memo · saved time, a '진행 상태' select, [휴대폰 번호 복사], [안내 내용 복사], [삭제]). The fallback retention line is `p[data-mismatch-retention="ttl14"]` '이 브라우저에만 14일 동안 보관하고, 지나면 자동으로 지워요.' (S01's text). `tests/support/internal-desk.ts` gains `recordClipboard(page)` and `copiedTexts(page)`.

- [ ] **Step 1: Write the failing tests**

Replace the whole content of `tests/support/internal-desk.ts` with:

```ts
import { expect, type Page } from "@playwright/test";
import { INTERNAL_TAB_LABELS, type InternalTabId } from "@/components/internal/tabs";

declare global {
  interface Window {
    __ttCopied?: string[];
  }
}

/** Opens /internal/cs-helper on one tab; the calling spec uses INTERNAL_TEST_CREDENTIALS. */
export async function openDesk(page: Page, tab: InternalTabId): Promise<void> {
  await page.goto(`/internal/cs-helper?tab=${tab}`);
  await expect(page.getByRole("tab", { name: INTERNAL_TAB_LABELS[tab], exact: true })).toHaveAttribute("aria-selected", "true");
}

/** Replaces navigator.clipboard.writeText with a recorder, so a test reads exactly what a copy button copied. */
export async function recordClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const copied: string[] = [];
    window.__ttCopied = copied;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string): Promise<void> => {
          copied.push(text);
          return Promise.resolve();
        }
      }
    });
  });
}

export async function copiedTexts(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => window.__ttCopied ?? []);
}
```

Create `tests/e2e/internal-mismatch.spec.ts`:

```ts
import { expect, test, type Locator, type Page } from "@playwright/test";
import { MISMATCH_LEGACY_KEY, MISMATCH_STATUS_LABELS, MISMATCH_TTL_DAYS } from "@/lib/cs/mismatch-storage";
import { CUSTOMS_MISMATCH_TEMPLATES } from "@/lib/cs/mismatch-templates";
import { maskPhone } from "@/lib/cs/phone-mask";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
import { FAKE, FIXTURE_NOW } from "../fixtures/tracking-fixtures";
import { copiedTexts, openDesk, recordClipboard } from "../support/internal-desk";

test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

const EMPTY_MESSAGE = "저장된 통관부호 불일치 안내가 없습니다.";
const STORAGE_REFUSED_MESSAGE = "이 브라우저에서는 목록을 저장할 수 없어요. 내용 복사 버튼으로 옮겨 주세요.";
/** Storage keys a locked-down browser refuses in the "refuses storage" test. */
const REFUSED_KEYS: readonly string[] = [MISMATCH_LEGACY_KEY];

const panel = (page: Page): Locator => page.locator('[data-internal-tab="mismatch"]');
const recordWith = (page: Page, memo: string): Locator => page.locator("[data-mismatch-record]").filter({ hasText: memo });

async function saveDraft(page: Page, memo: string): Promise<Locator> {
  await page.getByLabel("휴대폰 번호", { exact: true }).fill(FAKE.phone);
  await page.getByLabel("운송장/주문 메모", { exact: true }).fill(memo);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  const record = recordWith(page, memo);
  await expect(record).toBeVisible();
  return record;
}

test("a saved draft is listed with the masked phone, memo and template text and survives a reload", async ({ page }) => {
  await openDesk(page, "mismatch");
  const record = await saveDraft(page, "ORDER-1");
  await expect(record.getByText(maskPhone(FAKE.phone), { exact: true })).toBeVisible();
  await expect(record).toHaveAttribute("data-mismatch-status", "draft");
  await expect(record.getByText("개인통관고유부호 정보 확인이 필요합니다")).toBeVisible();
  await expect(page.getByText(FAKE.phone, { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("휴대폰 번호", { exact: true })).toHaveValue("");

  await page.reload();
  await expect(recordWith(page, "ORDER-1")).toBeVisible();
});

test("the tool never sends messages: a record offers copy, status and delete only", async ({ page }) => {
  await openDesk(page, "mismatch");
  const record = await saveDraft(page, "ORDER-2");
  await expect(record.getByRole("button")).toHaveText(["휴대폰 번호 복사", "안내 내용 복사", "삭제"]);
  await expect(record.getByRole("combobox", { name: "진행 상태" })).toBeVisible();
  await expect(panel(page).getByRole("button", { name: /알림톡|보내기|전송/ })).toHaveCount(0);
  await expect(panel(page).getByRole("link")).toHaveCount(0);
});

test("[휴대폰 번호 복사] copies the full number while the page shows it masked", async ({ page }) => {
  await recordClipboard(page);
  await openDesk(page, "mismatch");
  const record = await saveDraft(page, "ORDER-3");
  await record.getByRole("button", { name: "휴대폰 번호 복사", exact: true }).click();
  await expect.poll(() => copiedTexts(page)).toEqual([FAKE.phone]);
  await expect(record.getByRole("button", { name: "복사했어요", exact: true })).toBeVisible();
});

test("the status moves through 작성, 발송, 회신 and 완료 and is kept", async ({ page }) => {
  await openDesk(page, "mismatch");
  const record = await saveDraft(page, "ORDER-4");
  const status = record.getByRole("combobox", { name: "진행 상태" });
  await expect(status.locator("option")).toHaveText(Object.values(MISMATCH_STATUS_LABELS));
  for (const value of ["sent", "replied", "done"] as const) {
    await status.selectOption(value);
    await expect(record).toHaveAttribute("data-mismatch-status", value);
  }
  await page.reload();
  await expect(recordWith(page, "ORDER-4")).toHaveAttribute("data-mismatch-status", "done");
});

test("legacy drafts are migrated, expired ones dropped, and [전체 삭제] clears everything", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const fresh = {
    id: "fresh",
    phone: FAKE.phone,
    content: "최근 안내",
    trackingMemo: "ORDER-5",
    templateKey: "default",
    createdAt: "2026-09-20T01:00:00.000Z"
  };
  const expired = { ...fresh, id: "expired", content: "오래된 안내", trackingMemo: "ORDER-OLD", createdAt: "2026-09-01T01:00:00.000Z" };
  await openDesk(page, "mismatch");
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [
    MISMATCH_LEGACY_KEY,
    JSON.stringify([fresh, expired])
  ] as const);
  await page.reload();

  await expect(recordWith(page, "ORDER-5")).toBeVisible();
  await expect(page.getByText("ORDER-OLD", { exact: false })).toHaveCount(0);
  await expect(page.locator("[data-mismatch-retention]")).toHaveText(`이 브라우저에만 ${MISMATCH_TTL_DAYS}일 동안 보관하고, 지나면 자동으로 지워요.`);
  const migrated = await page.evaluate((key) => window.localStorage.getItem(key), MISMATCH_LEGACY_KEY);
  expect(JSON.parse(migrated ?? "null")).toMatchObject({ v: 1, records: [{ id: "fresh", status: "draft" }] });

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "전체 삭제", exact: true }).click();
  await expect(page.getByText(EMPTY_MESSAGE)).toBeVisible();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), MISMATCH_LEGACY_KEY)).toBeNull();
});

test("a browser that refuses storage still opens and explains why saving failed", async ({ page }) => {
  // Refuses only this tool's keys, like a locked-down browser would; Next.js dev tooling keeps its own storage.
  await page.addInitScript((keys) => {
    const refuse = (name: string): void => {
      if (keys.includes(name)) throw new DOMException("storage is blocked", "SecurityError");
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
  }, [...REFUSED_KEYS]);

  await openDesk(page, "mismatch");
  await expect(page.getByText(EMPTY_MESSAGE)).toBeVisible();
  await page.getByLabel("휴대폰 번호", { exact: true }).fill(FAKE.phone);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(panel(page).getByRole("alert")).toHaveText(STORAGE_REFUSED_MESSAGE);
});

test("a template choice fills the draft, and [내용 복사] copies it", async ({ page }) => {
  await recordClipboard(page);
  await openDesk(page, "mismatch");
  await page.getByLabel("안내 템플릿", { exact: true }).selectOption("hold");
  await expect(page.getByLabel("발송 예정 내용", { exact: true })).toHaveValue(CUSTOMS_MISMATCH_TEMPLATES.hold);
  await page.getByRole("button", { name: "내용 복사", exact: true }).click();
  await expect.poll(() => copiedTexts(page)).toEqual([CUSTOMS_MISMATCH_TEMPLATES.hold]);
});

test("a draft without a phone number is not saved", async ({ page }) => {
  await openDesk(page, "mismatch");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(panel(page).getByRole("alert")).toHaveText("휴대폰 번호와 안내 내용을 입력해주세요.");
  await expect(page.getByText(EMPTY_MESSAGE)).toBeVisible();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/internal-mismatch.spec.ts`
Expected: FAIL — `7 failed, 1 passed`. The legacy mismatch form still fills the panel: every test that looks for `[data-mismatch-record]`, `[data-mismatch-retention]` or a `role="alert"` times out on that locator; "a template choice fills the draft, and [내용 복사] copies it" already passes against the legacy form (same labels, same copy text).

- [ ] **Step 3: Write the record list**

Create `components/internal/MismatchRecordList.tsx`:

```tsx
"use client";

import { useId } from "react";
import { Button } from "@/components/primitives/Button";
import { CopyButton } from "@/components/primitives/CopyButton";
import {
  MISMATCH_STATUSES,
  MISMATCH_STATUS_LABELS,
  isMismatchStatus,
  type MismatchRecord,
  type MismatchStatus
} from "@/lib/cs/mismatch-storage";
import { maskPhone } from "@/lib/cs/phone-mask";
import { formatKstDateTime, parseInstant } from "@/lib/tracking/time";
import { FIELD_CLASS, HELP_CLASS, LABEL_CLASS, PANEL_CLASS, SECTION_TITLE_CLASS } from "./ui";

const COPIED_LABEL = "복사했어요";
const EMPTY_MESSAGE = "저장된 통관부호 불일치 안내가 없습니다.";
const NO_MEMO = "메모 없음";

export interface MismatchRecordListProps {
  readonly records: readonly MismatchRecord[];
  /** The retention line (and, with approval 14, the 7-day keep control) under the count. */
  readonly retention: React.ReactNode;
  readonly onStatus: (id: string, status: MismatchStatus) => void;
  readonly onDelete: (id: string) => void;
  readonly onClearAll: () => void;
}

function savedAt(record: MismatchRecord): string {
  const instant = parseInstant(record.createdAt);
  return instant === null ? "" : formatKstDateTime(instant);
}

interface MismatchRecordItemProps {
  readonly record: MismatchRecord;
  readonly onStatus: (id: string, status: MismatchStatus) => void;
  readonly onDelete: (id: string) => void;
}

/** One draft: the phone only masked (spec §10), memo and time, status, and copy/delete. The tool never sends anything. */
function MismatchRecordItem({ record, onStatus, onDelete }: MismatchRecordItemProps): React.JSX.Element {
  const id = useId();
  return (
    <article
      aria-labelledby={`${id}-phone`}
      data-mismatch-record={record.id}
      data-mismatch-status={record.status}
      className="flex flex-col gap-3 border-2 border-solid border-tt-rule bg-tt-surface p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p id={`${id}-phone`} className="m-0 font-tt-mono text-tt-md font-bold">
            {maskPhone(record.phone)}
          </p>
          <p className={HELP_CLASS}>{`${record.trackingMemo || NO_MEMO} · ${savedAt(record)}`}</p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-status`} className={LABEL_CLASS}>
            진행 상태
          </label>
          <select
            id={`${id}-status`}
            value={record.status}
            onChange={(event) => {
              const next = event.target.value;
              if (isMismatchStatus(next)) onStatus(record.id, next);
            }}
            className={FIELD_CLASS}
          >
            {MISMATCH_STATUSES.map((status) => (
              <option key={status} value={status}>
                {MISMATCH_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="m-0 whitespace-pre-wrap bg-tt-ground p-3 text-tt-sm [overflow-wrap:anywhere]">{record.content}</p>
      <div className="flex flex-wrap items-start gap-2">
        <CopyButton mode="copy" text={record.phone} label="휴대폰 번호 복사" copiedLabel={COPIED_LABEL} variant="secondary" />
        <CopyButton mode="copy" text={record.content} label="안내 내용 복사" copiedLabel={COPIED_LABEL} variant="secondary" />
        <Button variant="text" onClick={() => onDelete(record.id)}>
          삭제
        </Button>
      </div>
    </article>
  );
}

export function MismatchRecordList({ records, retention, onStatus, onDelete, onClearAll }: MismatchRecordListProps): React.JSX.Element {
  const titleId = useId();
  const sorted = [...records].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return (
    <section aria-labelledby={titleId} className={PANEL_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={titleId} className={SECTION_TITLE_CLASS}>
            불일치 안내 목록
          </h2>
          <p className={HELP_CLASS}>{`${sorted.length}건 저장됨`}</p>
          {retention}
        </div>
        {sorted.length === 0 ? null : (
          <Button variant="secondary" onClick={onClearAll}>
            전체 삭제
          </Button>
        )}
      </div>
      {sorted.length === 0 ? (
        <p data-mismatch-empty="true" className={HELP_CLASS}>
          {EMPTY_MESSAGE}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {sorted.map((record) => (
            <li key={record.id}>
              <MismatchRecordItem record={record} onStatus={onStatus} onDelete={onDelete} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Write the tab**

Create `components/internal/MismatchTab.tsx`:

```tsx
"use client";

import { useId, useState, useSyncExternalStore, type FormEvent } from "react";
import { Button } from "@/components/primitives/Button";
import { CopyButton } from "@/components/primitives/CopyButton";
import {
  MISMATCH_TTL_DAYS,
  clearAllStoredRecords,
  createRecordId,
  getServerStoredRecordsSnapshot,
  getStoredRecordsSnapshot,
  normalizePhone,
  subscribeStoredRecords,
  withRecordStatus,
  writeStoredRecords,
  type MismatchRecord,
  type MismatchStatus
} from "@/lib/cs/mismatch-storage";
import { CUSTOMS_MISMATCH_TEMPLATES, type CustomsMismatchTemplateKey } from "@/lib/cs/mismatch-templates";
import { MismatchRecordList } from "./MismatchRecordList";
import { ERROR_CLASS, FIELD_CLASS, HELP_CLASS, LABEL_CLASS, PANEL_CLASS, SECTION_TITLE_CLASS } from "./ui";

const TEMPLATE_OPTIONS: readonly { readonly key: CustomsMismatchTemplateKey; readonly label: string }[] = [
  { key: "default", label: "통관부호 불일치 안내" },
  { key: "recipient", label: "수취인 정보 확인 요청" },
  { key: "hold", label: "출고보류 가능 안내" }
];
const STORAGE_REFUSED_MESSAGE = "이 브라우저에서는 목록을 저장할 수 없어요. 내용 복사 버튼으로 옮겨 주세요.";
const MISSING_FIELDS_MESSAGE = "휴대폰 번호와 안내 내용을 입력해주세요.";
const CLEAR_CONFIRM = "저장된 통관부호 불일치 안내를 모두 삭제할까요?";
const COPIED_LABEL = "복사했어요";
const RETENTION_NOTE = `이 브라우저에만 ${MISMATCH_TTL_DAYS}일 동안 보관하고, 지나면 자동으로 지워요.`;

function isTemplateKey(value: string): value is CustomsMismatchTemplateKey {
  return TEMPLATE_OPTIONS.some((option) => option.key === value);
}

/** 통관부호 불일치 (spec §10 ②): write a draft from a template, keep a masked list with a status, copy by hand. */
export function MismatchTab(): React.JSX.Element {
  const baseId = useId();
  const records = useSyncExternalStore(subscribeStoredRecords, getStoredRecordsSnapshot, getServerStoredRecordsSnapshot);
  const [phone, setPhone] = useState("");
  const [memo, setMemo] = useState("");
  const [templateKey, setTemplateKey] = useState<CustomsMismatchTemplateKey>("default");
  const [content, setContent] = useState<string>(CUSTOMS_MISMATCH_TEMPLATES.default);
  const [error, setError] = useState("");

  const save = (next: readonly MismatchRecord[]): boolean => {
    try {
      writeStoredRecords(next);
      setError("");
      return true;
    } catch {
      setError(STORAGE_REFUSED_MESSAGE);
      return false;
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const normalized = normalizePhone(phone);
    const text = content.trim();
    if (normalized === "" || text === "") {
      setError(MISSING_FIELDS_MESSAGE);
      return;
    }
    const record: MismatchRecord = {
      id: createRecordId(),
      phone: normalized,
      content: text,
      trackingMemo: memo.trim(),
      templateKey,
      status: "draft",
      createdAt: new Date().toISOString()
    };
    if (!save([record, ...records])) return;
    setPhone("");
    setMemo("");
  };

  const onTemplate = (value: string): void => {
    if (!isTemplateKey(value)) return;
    setTemplateKey(value);
    setContent(CUSTOMS_MISMATCH_TEMPLATES[value]);
  };

  const onStatus = (id: string, status: MismatchStatus): void => {
    save(withRecordStatus(records, id, status, new Date()));
  };

  const onDelete = (id: string): void => {
    save(records.filter((record) => record.id !== id));
  };

  const onClearAll = (): void => {
    if (window.confirm(CLEAR_CONFIRM)) clearAllStoredRecords();
  };

  const retention = (
    <p data-mismatch-retention="ttl14" className={HELP_CLASS}>
      {RETENTION_NOTE}
    </p>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
      <form onSubmit={onSubmit} noValidate aria-labelledby={`${baseId}-title`} className={PANEL_CLASS}>
        <h2 id={`${baseId}-title`} className={SECTION_TITLE_CLASS}>
          불일치 안내 작성
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${baseId}-phone`} className={LABEL_CLASS}>
              휴대폰 번호
            </label>
            <input
              id={`${baseId}-phone`}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="010-0000-0000"
              className={FIELD_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${baseId}-memo`} className={LABEL_CLASS}>
              운송장/주문 메모
            </label>
            <input
              id={`${baseId}-memo`}
              autoComplete="off"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="선택 입력"
              className={FIELD_CLASS}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${baseId}-template`} className={LABEL_CLASS}>
            안내 템플릿
          </label>
          <select id={`${baseId}-template`} value={templateKey} onChange={(event) => onTemplate(event.target.value)} className={FIELD_CLASS}>
            {TEMPLATE_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${baseId}-content`} className={LABEL_CLASS}>
            발송 예정 내용
          </label>
          <textarea
            id={`${baseId}-content`}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={8}
            className={FIELD_CLASS}
          />
        </div>
        {error === "" ? null : (
          <p role="alert" className={ERROR_CLASS}>
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-start gap-2">
          <Button type="submit" variant="primary">
            저장
          </Button>
          <CopyButton mode="copy" text={content} label="내용 복사" copiedLabel={COPIED_LABEL} variant="secondary" />
        </div>
      </form>
      <MismatchRecordList records={records} retention={retention} onStatus={onStatus} onDelete={onDelete} onClearAll={onClearAll} />
    </div>
  );
}
```

- [ ] **Step 5: Put the tab in the desk**

In `components/internal/InternalCsDesk.tsx`:

(a) Replace `import { InternalCsHelper } from "@/components/InternalCsHelper";` with

```tsx
import { InternalCsHelper } from "@/components/InternalCsHelper";
import { MismatchTab } from "./MismatchTab";
```

(b) Replace

```tsx
    case "mismatch":
      return <InternalCsHelper section="mismatch" />;
```

with

```tsx
    case "mismatch":
      return <MismatchTab />;
```

- [ ] **Step 6: Run the new tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/internal-mismatch.spec.ts tests/e2e/internal-desk.spec.ts`
Expected: 0 failed — `internal-mismatch.spec.ts` `8 passed`, `internal-desk.spec.ts` `5 passed`.

- [ ] **Step 7: Retire the legacy mismatch tests (rules I4–I6 now pass in the new file)**

Run (PowerShell; cuts the file right before the first legacy mismatch test — the three tests are the last ones in the file):

```powershell
$path = Join-Path (Get-Location).Path 'tests\internal-cs-helper.spec.ts'
$text = [System.IO.File]::ReadAllText($path)
$cut = $text.IndexOf('test("internal helper stores customs mismatch drafts locally"')
if ($cut -lt 0) { throw 'legacy mismatch test not found' }
[System.IO.File]::WriteAllText($path, $text.Substring(0, $cut).TrimEnd() + "`n", (New-Object System.Text.UTF8Encoding($false)))
Select-String -LiteralPath tests/internal-cs-helper.spec.ts -Pattern '^test\("' | ForEach-Object { $_.Line }
Select-String -LiteralPath tests/internal-cs-helper.spec.ts -Pattern 'FIXTURE_NOW' | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" }
```
Expected: three `test("internal helper …` lines (the delivery tests I1–I3), then the `FIXTURE_NOW` lines. If `FIXTURE_NOW` now appears only on the import line, replace `import { FAKE, FIXTURE_NOW, mockTrack } from "./fixtures/tracking-fixtures";` with `import { FAKE, mockTrack } from "./fixtures/tracking-fixtures";` (Edit tool).

In `tests/e2e/RULE-MAP.md`, replace every occurrence (`replace_all`) of `| selector re-pointed to the tab (Task 8); pending (Task 9) |` with `| migrated (Task 9) |`.

- [ ] **Step 8: Run the internal suites and checks**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/internal-mismatch.spec.ts tests/e2e/internal-desk.spec.ts tests/internal-cs-helper.spec.ts tests/internal-access.spec.ts tests/e2e/internal-isolation.spec.ts`
Expected: 0 failed — 8 + 5 + 3 + 4 + 3 = `23 passed`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/module-boundaries.spec.ts tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0 with no new warnings.

- [ ] **Step 9: Commit**

```powershell
git add components/internal/MismatchTab.tsx components/internal/MismatchRecordList.tsx components/internal/InternalCsDesk.tsx tests/support/internal-desk.ts tests/e2e/internal-mismatch.spec.ts tests/internal-cs-helper.spec.ts tests/e2e/RULE-MAP.md
git commit -m "feat: add the customs mismatch tab with masked phones, status and copy"
```

---

### Task 10: The 배송 안내 tab — bulk lookup, problem-first table, the customer's screen at 375 px; the legacy helper is deleted

**Files:**
- Create: `components/internal/ScreenAndReply.tsx`, `components/internal/BulkResultTable.tsx`, `components/internal/DeliveryGuideTab.tsx`
- Modify: `components/internal/InternalCsDesk.tsx` (one import, the `delivery` case)
- Modify: `tests/support/internal-desk.ts` (whole file: blocked clipboard, request start times)
- Modify: `tests/e2e/RULE-MAP.md` (status of I1–I3)
- Delete: `components/InternalCsHelper.tsx`, `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/input.tsx`, `tests/internal-cs-helper.spec.ts` (after the new tests pass)
- Test: `tests/e2e/internal-bulk.spec.ts` (create)

**Interfaces:**
- Consumes: Tasks 2–3 (`BULK_MAX`, `BULK_MIN_INTERVAL_MS`, `BulkRow`, `initialBulkRows`, `parseBulkInput`, `runBulkLookup`, `sortBulkRows`, `summarizeBulkView`, `TONE_LABELS`); `deriveResultView(outcome, now): TrackingViewModel` (`components/result/approvals.ts`, S07 addition 10); `ResultView` with `ResultViewProps` (`view`, `onAction`, `readOnly`, `frame`, `failureCause`) (`components/result/ResultView.tsx`, S07); `NumberBar({ number, carrierLabel })`, `StatusChip({ tone, text })`, `Button`, `CopyButton` (S05); `buildCsReply(view, { now, notices }): CsReply` (S03); `siteConfig.notices` (S03); `CARRIER_NAMES`, `CONCRETE_CARRIER_CODES` (`lib/tracking/carriers.ts`, S03); `groupTrackingNumber` (S03); `buildInquiryCopy` (S03, test); fixtures `FAKE`, `FAKE_GROUPED`, `FIXTURE_NOW`, `FAILURE_RESPONSES`, `successBody`, `FailureFixture` (S01), `customsWaitingData`, `deliveredData`, `pendingData` (S03); `openDesk`, `recordClipboard`, `copiedTexts` (Tasks 8–9).
- Produces: `ScreenAndReply({ view, reply, failureCause? }): React.JSX.Element` — `div[data-preview-frame="375"]` (375 px wide: `NumberBar` over `ResultView` with `readOnly` and `frame="mobile"`) next to `div[data-reply-pair]` with read-only textareas '짧은 답변' and '자세한 답변'; `BulkResultTable({ rows, replies, expanded, onToggle }): React.JSX.Element | null` (`table[data-bulk-table]`; one `tr[data-bulk-row][data-bulk-status][data-tone]` per row with a row header (grouped number + carrier name), 상태 톤 (`StatusChip` with `TONE_LABELS`), 상태, 도착 예상 (+ note), 걱정 기준일, 마지막 처리, and [짧게 복사][자세히 복사][고객 링크 복사] + [화면 보기]/[화면 닫기] (`aria-expanded`); an open row adds `tr[data-bulk-detail]` with `ScreenAndReply`); `DeliveryGuideTab(): React.JSX.Element` (textarea '조회번호 (한 줄에 하나, 최대 20건)', fieldset '택배사' with 6 radios, [조회 시작] primary with `aria-busy` while running, [멈추기] while running, `p[data-bulk-rejected]`, the truncation line, `p[data-bulk-progress][role=status]`). `tests/support/internal-desk.ts` gains `blockClipboard(page)`, `recordTrackStarts(page)`, `trackStarts(page)`. Budget line `[budget] bulk spacing min: N ms (min 1000 ms)`.

- [ ] **Step 1: Write the failing tests**

Replace the whole content of `tests/support/internal-desk.ts` with:

```ts
import { expect, type Page } from "@playwright/test";
import { INTERNAL_TAB_LABELS, type InternalTabId } from "@/components/internal/tabs";

declare global {
  interface Window {
    __ttCopied?: string[];
    __ttTrackStarts?: number[];
  }
}

/** Opens /internal/cs-helper on one tab; the calling spec uses INTERNAL_TEST_CREDENTIALS. */
export async function openDesk(page: Page, tab: InternalTabId): Promise<void> {
  await page.goto(`/internal/cs-helper?tab=${tab}`);
  await expect(page.getByRole("tab", { name: INTERNAL_TAB_LABELS[tab], exact: true })).toHaveAttribute("aria-selected", "true");
}

/** Replaces navigator.clipboard.writeText with a recorder, so a test reads exactly what a copy button copied. */
export async function recordClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const copied: string[] = [];
    window.__ttCopied = copied;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string): Promise<void> => {
          copied.push(text);
          return Promise.resolve();
        }
      }
    });
  });
}

export async function copiedTexts(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => window.__ttCopied ?? []);
}

/** A clipboard that refuses every write (the API rejects, execCommand('copy') fails), like a locked-down browser. */
export async function blockClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (): Promise<void> => Promise.reject(new DOMException("blocked", "NotAllowedError")) }
    });
    document.execCommand = (): boolean => false;
  });
}

/** Records performance.now() whenever the page starts a request to /api/track. */
export async function recordTrackStarts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const starts: number[] = [];
    window.__ttTrackStarts = starts;
    const original = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/track")) starts.push(performance.now());
      return original(input, init);
    };
  });
}

export async function trackStarts(page: Page): Promise<readonly number[]> {
  return page.evaluate(() => window.__ttTrackStarts ?? []);
}
```

Create `tests/e2e/internal-bulk.spec.ts`:

```ts
import { expect, test, type Locator, type Page } from "@playwright/test";
import { deriveResultView } from "@/components/result/approvals";
import { siteConfig } from "@/config/site.config";
import { BULK_MAX, BULK_MIN_INTERVAL_MS, TONE_LABELS, sortBulkRows, type BulkRow } from "@/lib/cs/bulk-lookup";
import { buildCsReply, type CsReply } from "@/lib/cs/cs-reply";
import { MISMATCH_LEGACY_KEY } from "@/lib/cs/mismatch-storage";
import { buildInquiryCopy } from "@/lib/tracking/inquiry-copy";
import type { FailureCause, LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
import { customsWaitingData, deliveredData, pendingData } from "../fixtures/derive-scenarios";
import { FAILURE_RESPONSES, FAKE, FAKE_GROUPED, FIXTURE_NOW, successBody, type FailureFixture } from "../fixtures/tracking-fixtures";
import { blockClipboard, copiedTexts, openDesk, recordClipboard, recordTrackStarts, trackStarts } from "../support/internal-desk";

test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

const INPUT_LABEL = `조회번호 (한 줄에 하나, 최대 ${BULK_MAX}건)`;
const SERVER_NOT_FOUND_TEXT = "해당 번호로 통관/배송 정보를 찾을 수 없습니다";
const CAUSE_OF: Readonly<Partial<Record<FailureFixture, FailureCause>>> = { notFound404: "notFound", serverError500: "serverError" };
const SETTLE_TIMEOUT_MS = 15_000;

type Answer = TrackResponseData | FailureFixture;
interface SeenRequest {
  readonly number: string;
  readonly carrier: string;
}

function field(body: unknown, name: "trackingNumber" | "carrierCode"): string {
  if (typeof body !== "object" || body === null || !(name in body)) return "";
  const value: unknown = Reflect.get(body, name);
  return typeof value === "string" ? value : "";
}

/** Answers POST /api/track per requested number (optionally late) and records every request. */
async function answerByNumber(
  page: Page,
  answers: Readonly<Record<string, Answer>>,
  delays: Readonly<Record<string, number>> = {}
): Promise<SeenRequest[]> {
  const seen: SeenRequest[] = [];
  await page.route("**/api/track", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.fallback();
      return;
    }
    const body: unknown = request.postDataJSON();
    const number = field(body, "trackingNumber");
    seen.push({ number, carrier: field(body, "carrierCode") });
    const delayMs = delays[number] ?? 0;
    if (delayMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    const answer: Answer = answers[number] ?? "notFound404";
    const reply = typeof answer === "string" ? FAILURE_RESPONSES[answer] : { status: 200, contentType: "application/json", body: successBody(answer) };
    try {
      await route.fulfill(reply);
    } catch (error) {
      // An aborted run's request no longer exists when its late answer arrives.
      if (!(error instanceof Error) || !/closed|disposed|already handled/i.test(error.message)) throw error;
    }
  });
  return seen;
}

function outcomeOf(number: string, answer: Answer): LookupOutcome {
  const request = { number, carrier: "AUTO", entry: "manual" } as const;
  if (typeof answer !== "string") return { kind: "success", request, data: answer };
  const cause = CAUSE_OF[answer];
  if (cause === undefined) throw new Error(`no cause mapped for ${answer}`);
  return { kind: "failure", request, cause, consecutiveFailures: 1 };
}

/** The view and replies the desk must show: the customer page's view (deriveResultView) and buildCsReply over it. */
function expected(outcome: LookupOutcome): { readonly view: TrackingViewModel; readonly reply: CsReply } {
  const view = deriveResultView(outcome, FIXTURE_NOW);
  return { view, reply: buildCsReply(view, { now: FIXTURE_NOW, notices: siteConfig.notices }) };
}

const bulkRow = (page: Page, number: string): Locator => page.locator(`[data-bulk-row="${number}"]`);
const doneRows = (page: Page): Locator => page.locator('[data-bulk-row][data-bulk-status="done"]');

async function runDesk(page: Page, lines: readonly string[], carrierName?: string): Promise<void> {
  await openDesk(page, "delivery");
  await page.getByLabel(INPUT_LABEL, { exact: true }).fill(lines.join("\n"));
  if (carrierName !== undefined) await page.getByRole("radio", { name: carrierName, exact: true }).check();
  await page.getByRole("button", { name: "조회 시작", exact: true }).click();
}

async function openRow(page: Page, number: string): Promise<Locator> {
  await expect(bulkRow(page, number)).toHaveAttribute("data-bulk-status", "done", { timeout: SETTLE_TIMEOUT_MS });
  await bulkRow(page, number).getByRole("button", { name: "화면 보기", exact: true }).click();
  const detail = page.locator(`[data-bulk-detail="${number}"]`);
  await expect(detail).toBeVisible();
  return detail;
}

test("one number: the row shows the number and carrier, and the replies equal buildCsReply over the customer's view", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const data = deliveredData();
  await answerByNumber(page, { [FAKE.domestic]: data });
  await runDesk(page, [FAKE_GROUPED.domestic]);
  const { view, reply } = expected(outcomeOf(FAKE.domestic, data));
  const row = bulkRow(page, FAKE.domestic);
  await expect(row).toHaveAttribute("data-bulk-status", "done", { timeout: SETTLE_TIMEOUT_MS });
  await expect(row).toHaveAttribute("data-tone", view.tone);
  await expect(row.getByRole("rowheader")).toContainText(FAKE_GROUPED.domestic);
  await expect(row.getByRole("rowheader")).toContainText("CJ대한통운");
  await expect(row.locator("[data-status-chip]")).toHaveText(TONE_LABELS[view.tone]);
  await expect(row).toContainText(view.title);
  const detail = await openRow(page, FAKE.domestic);
  await expect(detail.getByLabel("짧은 답변", { exact: true })).toHaveValue(reply.short);
  await expect(detail.getByLabel("자세한 답변", { exact: true })).toHaveValue(reply.long);
  expect(reply.long).toContain(reply.customerLink);
  expect(`${reply.short}\n${reply.long}`).not.toMatch(/택배사 자동 확인|관리자에게/);
});

test("the copy buttons copy the short reply, the long reply and the customer link", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await recordClipboard(page);
  const data = deliveredData();
  await answerByNumber(page, { [FAKE.domestic]: data });
  await runDesk(page, [FAKE.domestic]);
  const { reply } = expected(outcomeOf(FAKE.domestic, data));
  const row = bulkRow(page, FAKE.domestic);
  await expect(row).toHaveAttribute("data-bulk-status", "done", { timeout: SETTLE_TIMEOUT_MS });
  for (const name of ["짧게 복사", "자세히 복사", "고객 링크 복사"]) {
    await row.getByRole("button", { name, exact: true }).click();
  }
  await expect.poll(() => copiedTexts(page)).toEqual([reply.short, reply.long, reply.customerLink]);
  await expect(row.getByRole("button", { name: "복사했어요", exact: true })).toHaveCount(3);
});

test("pending: the reply comes from the same view, and a run stores nothing in the browser", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const data = pendingData();
  await answerByNumber(page, { [FAKE.domestic]: data });
  await runDesk(page, [FAKE.domestic]);
  const { reply } = expected(outcomeOf(FAKE.domestic, data));
  const detail = await openRow(page, FAKE.domestic);
  await expect(detail.getByLabel("자세한 답변", { exact: true })).toHaveValue(reply.long);
  const stored = await page.evaluate(() => {
    const dump = (storage: Storage): string[] =>
      Array.from({ length: storage.length }, (_, index) => {
        const key = storage.key(index) ?? "";
        return `${key}=${storage.getItem(key) ?? ""}`;
      });
    return [...dump(window.localStorage), ...dump(window.sessionStorage)].join("\n");
  });
  expect(stored).not.toContain(FAKE.domestic);
  expect(stored).not.toContain(FAKE_GROUPED.domestic);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), MISMATCH_LEGACY_KEY)).toBeNull();
});

test("a failed lookup gets the CS error reply, never the server message", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await answerByNumber(page, { [FAKE.domestic]: "notFound404" });
  await runDesk(page, [FAKE.domestic]);
  const { view, reply } = expected(outcomeOf(FAKE.domestic, "notFound404"));
  const detail = await openRow(page, FAKE.domestic);
  await expect(bulkRow(page, FAKE.domestic)).toHaveAttribute("data-tone", view.tone);
  await expect(detail.getByLabel("자세한 답변", { exact: true })).toHaveValue(reply.long);
  await expect(detail.locator("[data-result-view]")).toHaveAttribute("data-result-view", "error");
  await expect(page.getByText(SERVER_NOT_FOUND_TEXT)).toHaveCount(0);
});

test("문제 and 확인 필요 rows come first; the others keep the pasted order", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const answers: Readonly<Record<string, Answer>> = {
    [FAKE.domestic]: deliveredData(),
    [FAKE.hbl]: customsWaitingData(),
    [FAKE.domesticAlt]: "serverError500",
    [FAKE.hblAlt]: "notFound404"
  };
  const numbers = [FAKE.domestic, FAKE.hbl, FAKE.domesticAlt, FAKE.hblAlt];
  await answerByNumber(page, answers);
  await runDesk(page, numbers);
  await expect(doneRows(page)).toHaveCount(numbers.length, { timeout: SETTLE_TIMEOUT_MS });
  const rows: readonly BulkRow[] = numbers.map((number) => {
    const outcome = outcomeOf(number, answers[number]);
    return { number, status: "done", outcome, view: expected(outcome).view };
  });
  const order = await page.locator("[data-bulk-row]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-bulk-row")));
  expect(order).toEqual(sortBulkRows(rows).map((row) => row.number));
  await expect(page.locator("[data-bulk-row]").first()).toHaveAttribute("data-tone", "problem");
});

test("the open row shows the customer's screen at 375 px, read-only", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.setFixedTime(FIXTURE_NOW);
  const data = customsWaitingData();
  await answerByNumber(page, { [FAKE.hbl]: data });
  await runDesk(page, [FAKE.hbl]);
  const { view } = expected(outcomeOf(FAKE.hbl, data));
  const detail = await openRow(page, FAKE.hbl);
  const frame = detail.locator('[data-preview-frame="375"]');
  expect((await frame.boundingBox())?.width).toBe(375);
  const result = frame.locator("[data-result-view]");
  await expect(result).toHaveAttribute("data-read-only", "true");
  await expect(result).toHaveAttribute("data-frame", "mobile");
  await expect(frame.locator("[data-number-bar]")).toContainText(FAKE_GROUPED.hbl);
  const heading = frame.getByRole("heading", { level: 2 }).first();
  await expect(heading).toHaveText(view.title);
  await expect(heading).not.toBeFocused();
  const url = page.url();
  const popup = page.context().waitForEvent("page", { timeout: 1000 }).then(
    () => true,
    () => false
  );
  await frame.locator("a[href]").first().click();
  expect(await popup).toBe(false);
  expect(page.url()).toBe(url);
});

test("pasted inquiry copies, chat lines and bad lines", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await answerByNumber(page, { [FAKE.hbl]: customsWaitingData(), [FAKE.domestic]: deliveredData() });
  const copy = buildInquiryCopy({ kind: "status", number: { raw: FAKE.hbl, grouped: FAKE_GROUPED.hbl }, stage: "통관 대기", lastEventAt: null });
  await runDesk(page, ["안녕하세요", copy, FAKE.invalidShort, FAKE.phone, FAKE_GROUPED.domestic]);
  await expect(page.locator("[data-bulk-row]")).toHaveCount(2);
  await expect(doneRows(page)).toHaveCount(2, { timeout: SETTLE_TIMEOUT_MS });
  await expect(page.locator("[data-bulk-rejected]")).toHaveText(`번호로 읽지 못한 줄 2개: ${FAKE.invalidShort} · ${FAKE.phone}`);
});

test("at most 20 numbers run, and [멈추기] stops the rest", async ({ page }) => {
  const numbers = Array.from({ length: BULK_MAX + 2 }, (_, index) => `0000${String(index + 1).padStart(8, "0")}`);
  const seen = await answerByNumber(page, Object.fromEntries(numbers.map((number) => [number, deliveredData()])));
  await runDesk(page, numbers);
  await expect(page.getByText(`최대 ${BULK_MAX}건까지만 조회해요. 나머지 번호는 빠졌어요.`)).toBeVisible();
  await expect(page.locator("[data-bulk-row]")).toHaveCount(BULK_MAX);
  await expect(doneRows(page)).toHaveCount(1, { timeout: SETTLE_TIMEOUT_MS });
  await page.getByRole("button", { name: "멈추기", exact: true }).click();
  await expect(page.getByRole("button", { name: "멈추기", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "조회 시작", exact: true })).not.toHaveAttribute("aria-busy", "true");
  const requestsAtStop = seen.length;
  await page.waitForTimeout(2 * BULK_MIN_INTERVAL_MS);
  expect(seen.length).toBe(requestsAtStop);
  expect(requestsAtStop).toBeLessThanOrEqual(2);
  const done = await doneRows(page).count();
  await expect(page.locator('[data-bulk-row][data-bulk-status="queued"]')).toHaveCount(BULK_MAX - done);
});

test("requests start at least 1000 ms apart and carry the chosen carrier", async ({ page }) => {
  await recordTrackStarts(page);
  const numbers = [FAKE.domestic, FAKE.hbl, FAKE.domesticAlt];
  const seen = await answerByNumber(page, Object.fromEntries(numbers.map((number) => [number, deliveredData()])));
  await runDesk(page, numbers, "한진택배");
  await expect(doneRows(page)).toHaveCount(numbers.length, { timeout: SETTLE_TIMEOUT_MS });
  expect(seen.map((request) => request.carrier)).toEqual(["HANJIN", "HANJIN", "HANJIN"]);
  const starts = await trackStarts(page);
  const gaps = starts.slice(1).map((start, index) => start - starts[index]);
  const minGap = Math.min(...gaps);
  console.log(`[budget] bulk spacing min: ${Math.round(minGap)} ms (min ${BULK_MIN_INTERVAL_MS} ms)`);
  expect(gaps).toHaveLength(numbers.length - 1);
  // 2 ms of slack: the run spaces starts with Date (whole milliseconds), the recorder reads performance.now().
  expect(minGap).toBeGreaterThanOrEqual(BULK_MIN_INTERVAL_MS - 2);
});

test("a new run replaces the previous one; the old run's late answer is ignored", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await answerByNumber(page, { [FAKE.domestic]: deliveredData(), [FAKE.hbl]: customsWaitingData() }, { [FAKE.domestic]: 2000 });
  await runDesk(page, [FAKE.domestic]);
  await expect(bulkRow(page, FAKE.domestic)).toHaveAttribute("data-bulk-status", "running");
  await page.getByLabel(INPUT_LABEL, { exact: true }).fill(FAKE.hbl);
  await page.getByRole("button", { name: "조회 시작", exact: true }).click();
  await expect(bulkRow(page, FAKE.hbl)).toHaveAttribute("data-bulk-status", "done", { timeout: SETTLE_TIMEOUT_MS });
  await page.waitForTimeout(2500);
  await expect(page.locator("[data-bulk-row]")).toHaveCount(1);
  await expect(bulkRow(page, FAKE.domestic)).toHaveCount(0);
});

test("blocked clipboard: [짧게 복사] leaves the reply in a selected box", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await blockClipboard(page);
  const data = deliveredData();
  await answerByNumber(page, { [FAKE.domestic]: data });
  await runDesk(page, [FAKE.domestic]);
  const { reply } = expected(outcomeOf(FAKE.domestic, data));
  const row = bulkRow(page, FAKE.domestic);
  await expect(row).toHaveAttribute("data-bulk-status", "done", { timeout: SETTLE_TIMEOUT_MS });
  await row.getByRole("button", { name: "짧게 복사", exact: true }).click();
  const box = row.locator("textarea[data-copy-fallback]");
  await expect(box).toHaveValue(reply.short);
  await expect(box).toBeFocused();
});
```

- [ ] **Step 2: Run one of them to verify it fails**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/internal-bulk.spec.ts -g "one number"`
Expected: FAIL — `1 failed`: `locator.fill` waits for `getByLabel('조회번호 (한 줄에 하나, 최대 20건)', { exact: true })` until the 30 s test timeout (the 배송 안내 panel still holds the legacy '운송장번호' form). (The other ten fail the same way; running them now would only cost five minutes.)

- [ ] **Step 3: Write the customer screen next to the replies**

Create `components/internal/ScreenAndReply.tsx`:

```tsx
"use client";

import { useId } from "react";
import { NumberBar } from "@/components/primitives/NumberBar";
import { ResultView } from "@/components/result/ResultView";
import type { CsReply } from "@/lib/cs/cs-reply";
import type { FailureCause, TrackingViewModel } from "@/lib/tracking/types";
import { FIELD_CLASS, LABEL_CLASS } from "./ui";

/** ResultView is read-only here and never reports actions; the handler only satisfies its props. */
const ignoreAction = (): void => undefined;

export interface ScreenAndReplyProps {
  readonly view: TrackingViewModel;
  readonly reply: CsReply;
  readonly failureCause?: FailureCause;
}

/**
 * The customer's screen in a 375 px phone frame — S05's NumberBar over S07's read-only ResultView, exactly what the
 * customer page renders for this view — next to the two CS replies built from the same view (spec §10).
 */
export function ScreenAndReply({ view, reply, failureCause }: ScreenAndReplyProps): React.JSX.Element {
  const id = useId();
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div data-preview-frame="375" className="w-[375px] max-w-full shrink-0 overflow-hidden border-2 border-solid border-tt-rule bg-tt-ground">
        <NumberBar number={view.number} carrierLabel={view.carrier.barLabel} />
        <ResultView view={view} onAction={ignoreAction} readOnly frame="mobile" failureCause={failureCause} />
      </div>
      <div data-reply-pair="true" className="flex min-w-0 flex-1 flex-col gap-2">
        <label htmlFor={`${id}-short`} className={LABEL_CLASS}>
          짧은 답변
        </label>
        <textarea id={`${id}-short`} readOnly value={reply.short} rows={4} className={FIELD_CLASS} />
        <label htmlFor={`${id}-long`} className={LABEL_CLASS}>
          자세한 답변
        </label>
        <textarea id={`${id}-long`} readOnly value={reply.long} rows={9} className={FIELD_CLASS} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write the result table**

Create `components/internal/BulkResultTable.tsx`:

```tsx
"use client";

import { Fragment, useId } from "react";
import { Button } from "@/components/primitives/Button";
import { CopyButton } from "@/components/primitives/CopyButton";
import { StatusChip } from "@/components/primitives/StatusChip";
import { summarizeBulkView, type BulkRow } from "@/lib/cs/bulk-lookup";
import type { CsReply } from "@/lib/cs/cs-reply";
import { groupTrackingNumber } from "@/lib/tracking/number-format";
import type { FailureCause, TrackingViewModel } from "@/lib/tracking/types";
import { ScreenAndReply } from "./ScreenAndReply";

const COLUMNS = ["조회번호", "상태 톤", "상태", "도착 예상", "걱정 기준일", "마지막 처리", "답변·화면"] as const;
const COPIED_LABEL = "복사했어요";
const EMPTY_CELL = "—";
const CELL_CLASS = "border-0 border-b border-solid border-tt-rule px-2 py-2 text-left align-top text-tt-sm [word-break:keep-all]";

export interface BulkResultTableProps {
  /** Rows in display order (sortBulkRows). */
  readonly rows: readonly BulkRow[];
  /** CS replies by number, built when each row settled. */
  readonly replies: Readonly<Record<string, CsReply>>;
  readonly expanded: string | null;
  readonly onToggle: (number: string) => void;
}

function failureCauseOf(row: BulkRow): FailureCause | undefined {
  return row.outcome?.kind === "failure" ? row.outcome.cause : undefined;
}

interface SettledCellsProps {
  readonly view: TrackingViewModel;
  readonly reply: CsReply | undefined;
  readonly open: boolean;
  readonly detailId: string;
  readonly onToggle: () => void;
}

function SettledCells({ view, reply, open, detailId, onToggle }: SettledCellsProps): React.JSX.Element {
  const summary = summarizeBulkView(view);
  return (
    <>
      <td className={CELL_CLASS}>
        <StatusChip tone={view.tone} text={summary.toneLabel} />
      </td>
      <td className={CELL_CLASS}>{summary.title}</td>
      <td className={CELL_CLASS}>
        {summary.eta ?? EMPTY_CELL}
        {summary.etaNote === null ? null : <span className="block text-tt-xs text-tt-muted">{summary.etaNote}</span>}
      </td>
      <td className={CELL_CLASS}>{summary.worryDate ?? EMPTY_CELL}</td>
      <td className={CELL_CLASS}>{summary.lastEvent ?? EMPTY_CELL}</td>
      <td className={CELL_CLASS}>
        <div className="flex min-w-[200px] flex-col items-start gap-2">
          {reply === undefined ? null : (
            <>
              <CopyButton mode="copy" text={reply.short} label="짧게 복사" copiedLabel={COPIED_LABEL} variant="secondary" />
              <CopyButton mode="copy" text={reply.long} label="자세히 복사" copiedLabel={COPIED_LABEL} variant="secondary" />
              <CopyButton mode="copy" text={reply.customerLink} label="고객 링크 복사" copiedLabel={COPIED_LABEL} variant="secondary" />
            </>
          )}
          <Button variant="text" aria-expanded={open} aria-controls={detailId} onClick={onToggle}>
            {open ? "화면 닫기" : "화면 보기"}
          </Button>
        </div>
      </td>
    </>
  );
}

/** 배송 안내 results (spec §10 ①): 톤 배지, 상태 제목, 도착 예상, 걱정 기준일, 마지막 처리; an open row shows the customer's screen. */
export function BulkResultTable({ rows, replies, expanded, onToggle }: BulkResultTableProps): React.JSX.Element | null {
  const baseId = useId();
  if (rows.length === 0) return null;
  return (
    <div className="max-w-full overflow-x-auto">
      <table data-bulk-table="true" className="w-full min-w-[960px] border-collapse bg-tt-surface text-tt-ink">
        <caption className="sr-only">조회 결과. 문제와 확인 필요가 위에 옵니다.</caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className={`${CELL_CLASS} font-bold`}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const detailId = `${baseId}-${row.number}`;
            const reply: CsReply | undefined = replies[row.number];
            const open = expanded === row.number && row.view !== null && reply !== undefined;
            return (
              <Fragment key={row.number}>
                <tr data-bulk-row={row.number} data-bulk-status={row.status} data-tone={row.view?.tone}>
                  <th scope="row" className={`${CELL_CLASS} font-normal`}>
                    <span className="block whitespace-nowrap font-tt-mono text-tt-md font-bold">{groupTrackingNumber(row.number)}</span>
                    {row.view?.carrier.name ? <span className="block text-tt-xs text-tt-muted">{row.view.carrier.name}</span> : null}
                  </th>
                  {row.view === null ? (
                    <td colSpan={COLUMNS.length - 1} className={CELL_CLASS}>
                      {row.status === "running" ? "조회 중…" : "대기"}
                    </td>
                  ) : (
                    <SettledCells view={row.view} reply={reply} open={open} detailId={detailId} onToggle={() => onToggle(row.number)} />
                  )}
                </tr>
                {open && row.view !== null && reply !== undefined ? (
                  <tr data-bulk-detail={row.number}>
                    <td id={detailId} colSpan={COLUMNS.length} className={CELL_CLASS}>
                      <ScreenAndReply view={row.view} reply={reply} failureCause={failureCauseOf(row)} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Write the tab**

Create `components/internal/DeliveryGuideTab.tsx`:

```tsx
"use client";

import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/primitives/Button";
import { deriveResultView } from "@/components/result/approvals";
import { siteConfig } from "@/config/site.config";
import { BULK_MAX, initialBulkRows, parseBulkInput, runBulkLookup, sortBulkRows, type BulkRow } from "@/lib/cs/bulk-lookup";
import { buildCsReply, type CsReply } from "@/lib/cs/cs-reply";
import { CARRIER_NAMES, CONCRETE_CARRIER_CODES } from "@/lib/tracking/carriers";
import type { DeliveryCarrierCode } from "@/lib/types";
import { BulkResultTable } from "./BulkResultTable";
import { ERROR_CLASS, FIELD_CLASS, HELP_CLASS, LABEL_CLASS, PANEL_CLASS, SECTION_TITLE_CLASS } from "./ui";

const INPUT_LABEL = `조회번호 (한 줄에 하나, 최대 ${BULK_MAX}건)`;
const INPUT_HELP =
  "고객이 보낸 '[배송 문의] …' 복사 내용을 그대로 붙여 넣어도 번호를 읽어요. 숫자가 없는 줄은 건너뛰고, 휴대폰 번호는 조회하지 않아요.";
const NO_NUMBERS_MESSAGE = "조회할 번호가 없어요. 숫자 10~14자리 또는 영문 3~4자로 시작하는 번호를 한 줄에 하나씩 넣어 주세요.";
const TRUNCATED_MESSAGE = `최대 ${BULK_MAX}건까지만 조회해요. 나머지 번호는 빠졌어요.`;
const NOT_STORED_NOTE = "조회 결과와 복사 이력은 저장하지 않습니다.";
const CARRIER_OPTIONS: readonly { readonly code: DeliveryCarrierCode; readonly label: string }[] = [
  { code: "AUTO", label: "자동으로 찾기" },
  ...CONCRETE_CARRIER_CODES.map((code) => ({ code, label: CARRIER_NAMES[code] }))
];

interface ParseNote {
  readonly rejected: readonly string[];
  readonly truncated: boolean;
}

/**
 * 배송 안내 (spec §10 ①): paste up to 20 numbers, look them up one per second through fetchTrack, derive the customer
 * page's own view for each, and show 문제/확인 필요 first. Nothing is stored; a new run or [멈추기] ends the previous run.
 */
export function DeliveryGuideTab(): React.JSX.Element {
  const baseId = useId();
  const [text, setText] = useState("");
  const [carrier, setCarrier] = useState<DeliveryCarrierCode>("AUTO");
  const [rows, setRows] = useState<readonly BulkRow[]>([]);
  const [replies, setReplies] = useState<Readonly<Record<string, CsReply>>>({});
  const [note, setNote] = useState<ParseNote | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const displayRows = useMemo(() => sortBulkRows(rows), [rows]);
  const doneCount = rows.filter((row) => row.status === "done").length;

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    controllerRef.current?.abort();
    runIdRef.current += 1;
    const runId = runIdRef.current;
    const isCurrent = (): boolean => runIdRef.current === runId;
    const parsed = parseBulkInput(text);
    setNote({ rejected: parsed.rejected, truncated: parsed.truncated });
    setExpanded(null);
    if (parsed.numbers.length === 0) {
      setError(NO_NUMBERS_MESSAGE);
      setRows([]);
      setRunning(false);
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setError("");
    setRows(initialBulkRows(parsed.numbers));
    setReplies({});
    setRunning(true);
    void runBulkLookup(parsed.numbers, carrier, {
      signal: controller.signal,
      now: () => new Date(),
      derive: deriveResultView,
      onRow: (index, row) => {
        if (!isCurrent()) return;
        setRows((previous) => previous.map((item, position) => (position === index ? row : item)));
        if (row.view === null) return;
        const reply = buildCsReply(row.view, { now: new Date(), notices: siteConfig.notices });
        setReplies((previous) => ({ ...previous, [row.number]: reply }));
      }
    }).finally(() => {
      if (isCurrent()) setRunning(false);
    });
  };

  const onStop = (): void => {
    controllerRef.current?.abort();
  };

  const onToggle = (number: string): void => {
    setExpanded((current) => (current === number ? null : number));
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} noValidate aria-labelledby={`${baseId}-title`} className={PANEL_CLASS}>
        <h2 id={`${baseId}-title`} className={SECTION_TITLE_CLASS}>
          배송 안내 일괄 조회
        </h2>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${baseId}-numbers`} className={LABEL_CLASS}>
            {INPUT_LABEL}
          </label>
          <p id={`${baseId}-help`} className={HELP_CLASS}>
            {INPUT_HELP}
          </p>
          <textarea
            id={`${baseId}-numbers`}
            aria-describedby={`${baseId}-help`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={6}
            spellCheck={false}
            autoComplete="off"
            className={`${FIELD_CLASS} font-tt-mono`}
          />
        </div>
        <fieldset className="m-0 flex flex-wrap gap-x-4 gap-y-1 border-0 p-0">
          <legend className={`${LABEL_CLASS} mb-1`}>택배사</legend>
          {CARRIER_OPTIONS.map((option) => (
            <label key={option.code} className="flex min-h-[44px] items-center gap-2 text-tt-md">
              <input
                type="radio"
                name={`${baseId}-carrier`}
                value={option.code}
                checked={carrier === option.code}
                onChange={() => setCarrier(option.code)}
                className="tt-focus h-6 w-6"
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        {error === "" ? null : (
          <p role="alert" className={ERROR_CLASS}>
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" busy={running}>
            조회 시작
          </Button>
          {running ? (
            <Button variant="secondary" onClick={onStop}>
              멈추기
            </Button>
          ) : null}
          <p className={HELP_CLASS}>{NOT_STORED_NOTE}</p>
        </div>
      </form>
      {note !== null && note.truncated ? <p className={ERROR_CLASS}>{TRUNCATED_MESSAGE}</p> : null}
      {note !== null && note.rejected.length > 0 ? (
        <p data-bulk-rejected="true" className={HELP_CLASS}>
          {`번호로 읽지 못한 줄 ${note.rejected.length}개: ${note.rejected.join(" · ")}`}
        </p>
      ) : null}
      {rows.length === 0 ? null : (
        <p role="status" data-bulk-progress="true" className={HELP_CLASS}>
          {`${rows.length}건 중 ${doneCount}건 조회함${running ? " · 1초에 1건씩 조회해요" : ""}`}
        </p>
      )}
      <BulkResultTable rows={displayRows} replies={replies} expanded={expanded} onToggle={onToggle} />
    </div>
  );
}
```

- [ ] **Step 6: Put the tab in the desk**

In `components/internal/InternalCsDesk.tsx`:

(a) Replace

```tsx
import { InternalCsHelper } from "@/components/InternalCsHelper";
import { MismatchTab } from "./MismatchTab";
```

with

```tsx
import { DeliveryGuideTab } from "./DeliveryGuideTab";
import { MismatchTab } from "./MismatchTab";
```

(b) Replace

```tsx
    case "delivery":
      return <InternalCsHelper section="delivery" />;
```

with

```tsx
    case "delivery":
      return <DeliveryGuideTab />;
```

- [ ] **Step 7: Run the new tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/internal-bulk.spec.ts tests/e2e/internal-desk.spec.ts tests/e2e/internal-mismatch.spec.ts`
Expected: 0 failed — `internal-bulk.spec.ts` `11 passed` (the output contains one `[budget] bulk spacing min: N ms (min 1000 ms)` line with N ≥ 998), `internal-desk.spec.ts` `5 passed`, `internal-mismatch.spec.ts` `8 passed`.

- [ ] **Step 8: Delete the legacy helper, its last UI parts and its suite (rules I1–I3 now pass in the new file)**

Run: `git grep -n -e "InternalCsHelper" -e "components/ui/" -- app components lib tests`
Expected: matches only in `components/InternalCsHelper.tsx` itself, `tests/unit/module-boundaries.spec.ts` (S03's `INTERNAL_CS_IMPORTERS` pattern — a harmless regex, left as it is) and, if they mention the name in text, `tests/internal-cs-helper.spec.ts` or `tests/e2e/RULE-MAP.md`. An `import` or JSX use in any other file → stop: that file still depends on the legacy helper or on `components/ui/*`, and it belongs to a stage that has not finished.
Run: `git rm components/InternalCsHelper.tsx components/ui/button.tsx components/ui/card.tsx components/ui/input.tsx tests/internal-cs-helper.spec.ts`
Expected: five `rm '…'` lines.
In `tests/e2e/RULE-MAP.md`, replace every occurrence (`replace_all`) of `| pending (Task 10) |` with `| migrated (Task 10) |`.
Run: `Select-String -LiteralPath tests/e2e/RULE-MAP.md -Pattern '^\| I[1-6] ' | ForEach-Object { ($_.Line -split '\|')[-2].Trim() }`
Expected: six lines — `migrated (Task 10)` three times, then `migrated (Task 9)` three times.

- [ ] **Step 9: Run the internal suites and checks**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/internal-bulk.spec.ts tests/e2e/internal-desk.spec.ts tests/e2e/internal-mismatch.spec.ts tests/internal-access.spec.ts tests/e2e/internal-isolation.spec.ts`
Expected: 0 failed — 11 + 5 + 8 + 4 + 3 = `31 passed`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/module-boundaries.spec.ts tests/unit/real-number-guard.spec.ts tests/unit/result-module.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed (the desk imports `ResultView` statically, which S07's initial-bundle check does not cover; `lib/cs/*` is still imported only by internal files).
Run: `npm run typecheck; npm run lint`
Expected: both exit 0 with no new warnings.

- [ ] **Step 10: Commit**

```powershell
git add components/internal/ScreenAndReply.tsx components/internal/BulkResultTable.tsx components/internal/DeliveryGuideTab.tsx components/internal/InternalCsDesk.tsx tests/support/internal-desk.ts tests/e2e/internal-bulk.spec.ts tests/e2e/RULE-MAP.md
git commit -m "feat: add the bulk delivery tab and retire the legacy CS helper"
```
Expected: one commit including the five staged deletions.

---

### Task 11: The 안내표 미리보기 tab — every state, customer screen and CS reply side by side

**Files:**
- Create: `components/internal/PreviewTab.tsx`
- Modify: `components/internal/tabs.ts` (the id list and the labels)
- Modify (whole file): `components/internal/InternalCsDesk.tsx` (the desk's reference time and the `preview` case)
- Test: `tests/e2e/internal-preview.spec.ts` (create)

**Interfaces:**
- Consumes: `buildPreviewScenarios(now)`, `PreviewScenario`, `PREVIEW_SCENARIO_IDS`, `PREVIEW_NUMBERS` (Task 4); `deriveResultView` (S07); `buildCsReply`, `CsReply` (S03); `siteConfig.notices`; `formatKstDateTime` (S03); `ScreenAndReply` (Task 10); `PANEL_CLASS`, `SECTION_TITLE_CLASS`, `HELP_CLASS` (Task 8); tests: `findDisallowedDigitRuns`, `HBL_LIKE_PATTERN` (S01), `openDesk` (Task 8), `FIXTURE_NOW`.
- Produces: `PreviewTab({ now }: { readonly now: Date | null }): React.JSX.Element` — a lead panel (h2 '안내표 미리보기', the fake-number note, '기준 시각 …', a `nav` '상태 바로가기' with one in-page link per scenario) and one `section[data-preview-scenario=<id>]` per scenario (h2 = the scenario label, then `ScreenAndReply`); renders '미리보기를 준비하고 있어요.' until the desk's reference time exists. `INTERNAL_TAB_IDS` gains `"preview"` ('안내표 미리보기'). `InternalCsDesk` reads its reference time once on the client with `useSyncExternalStore` (server snapshot `null`) and passes it to time-based tabs.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/internal-preview.spec.ts`:

```ts
import { expect, test, type Locator, type Page } from "@playwright/test";
import { deriveResultView } from "@/components/result/approvals";
import { siteConfig } from "@/config/site.config";
import { buildCsReply } from "@/lib/cs/cs-reply";
import { PREVIEW_NUMBERS, PREVIEW_SCENARIO_IDS, buildPreviewScenarios } from "@/lib/cs/preview-outcomes";
import { HBL_LIKE_PATTERN, findDisallowedDigitRuns } from "@/lib/privacy/number-patterns";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";
import { openDesk } from "../support/internal-desk";

test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

const panel = (page: Page): Locator => page.locator('[data-internal-tab="preview"]');
const scenarioSection = (page: Page, id: string): Locator => page.locator(`[data-preview-scenario="${id}"]`);

async function openPreview(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await openDesk(page, "preview");
  await expect(page.locator("[data-preview-scenario]")).toHaveCount(PREVIEW_SCENARIO_IDS.length);
}

test("every state shows the customer's screen and the replies built from the same view", async ({ page }) => {
  await openPreview(page);
  for (const scenario of buildPreviewScenarios(FIXTURE_NOW)) {
    const view = deriveResultView(scenario.outcome, FIXTURE_NOW);
    const reply = buildCsReply(view, { now: FIXTURE_NOW, notices: siteConfig.notices });
    const section = scenarioSection(page, scenario.id);
    await expect(section.getByRole("heading", { level: 2 }).first()).toHaveText(scenario.label);
    const frame = section.locator('[data-preview-frame="375"]');
    await expect(frame.locator("[data-result-view]")).toHaveAttribute("data-result-view", view.mode);
    if (scenario.outcome.kind === "failure") {
      await expect(frame.locator(`[data-failure-cause="${scenario.outcome.cause}"]`)).toHaveCount(1);
    } else {
      await expect(frame.locator(`[data-guide-key="${view.guideKey}"]`)).toHaveCount(1);
    }
    await expect(frame.getByRole("heading", { level: 2 }).first()).toHaveText(view.title);
    await expect(section.getByLabel("짧은 답변", { exact: true })).toHaveValue(reply.short);
    await expect(section.getByLabel("자세한 답변", { exact: true })).toHaveValue(reply.long);
  }
  await expect(scenarioSection(page, "customsWaitingOverdue").locator('[data-overdue="true"]')).toHaveCount(1);
});

test("only fake numbers appear: no other 10+ digit run, and TEST 0000 0001 is the only HBL-like token", async ({ page }) => {
  await openPreview(page);
  const text = await panel(page).innerText();
  const replies = (
    await panel(page)
      .locator("textarea")
      .evaluateAll((areas) => areas.map((area) => (area instanceof HTMLTextAreaElement ? area.value : "")))
  ).join("\n");
  expect(findDisallowedDigitRuns(text)).toEqual([]);
  expect(findDisallowedDigitRuns(replies)).toEqual([]);
  expect(new Set(`${text}\n${replies}`.match(HBL_LIKE_PATTERN) ?? [])).toEqual(new Set([PREVIEW_NUMBERS.hbl]));
});

test("the preview is read-only: nothing takes focus and a link opens nothing", async ({ page }) => {
  await openPreview(page);
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BODY");
  await expect(panel(page).locator('[data-result-view]:not([data-read-only="true"])')).toHaveCount(0);
  const frame = scenarioSection(page, "customsWaiting").locator('[data-preview-frame="375"]');
  const url = page.url();
  const popup = page.context().waitForEvent("page", { timeout: 1000 }).then(
    () => true,
    () => false
  );
  await frame.locator("a[href]").first().click();
  expect(await popup).toBe(false);
  expect(page.url()).toBe(url);
});

test("the customer screens are 375 px wide at desktop widths", async ({ page }) => {
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await openPreview(page);
    const widths = await panel(page)
      .locator('[data-preview-frame="375"]')
      .evaluateAll((frames) => frames.map((frame) => Math.round(frame.getBoundingClientRect().width)));
    expect(widths).toHaveLength(PREVIEW_SCENARIO_IDS.length);
    expect(new Set(widths)).toEqual(new Set([375]));
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/internal-preview.spec.ts`
Expected: FAIL — `4 failed`; each test stops in `openDesk`: there is no '안내표 미리보기' tab yet (`INTERNAL_TAB_LABELS.preview` is `undefined`, so the tab locator matches every tab and Playwright reports a strict-mode violation).

- [ ] **Step 3: Add the tab id**

In `components/internal/tabs.ts`, replace

```ts
export const INTERNAL_TAB_IDS = ["delivery", "mismatch"] as const;
```

with

```ts
export const INTERNAL_TAB_IDS = ["delivery", "mismatch", "preview"] as const;
```

and replace

```ts
  mismatch: "통관부호 불일치"
};
```

with

```ts
  mismatch: "통관부호 불일치",
  preview: "안내표 미리보기"
};
```

- [ ] **Step 4: Write the tab**

Create `components/internal/PreviewTab.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { deriveResultView } from "@/components/result/approvals";
import { siteConfig } from "@/config/site.config";
import { buildCsReply, type CsReply } from "@/lib/cs/cs-reply";
import { buildPreviewScenarios, type PreviewScenario } from "@/lib/cs/preview-outcomes";
import { formatKstDateTime } from "@/lib/tracking/time";
import type { FailureCause, TrackingViewModel } from "@/lib/tracking/types";
import { ScreenAndReply } from "./ScreenAndReply";
import { HELP_CLASS, PANEL_CLASS, SECTION_TITLE_CLASS } from "./ui";

const PREPARING = "미리보기를 준비하고 있어요.";
const INTRO =
  "모든 상태를 가짜 번호(0000 0000 0001, TEST 0000 0001)로 보여 줍니다. 설정을 고친 뒤 배포 전에 고객 화면과 CS 답변을 여기서 확인하세요.";

interface PreviewItem {
  readonly scenario: PreviewScenario;
  readonly view: TrackingViewModel;
  readonly reply: CsReply;
  readonly failureCause: FailureCause | undefined;
}

/** The customer page's own view for each fake scenario at `now`, and the CS replies built from it. */
function previewItems(now: Date): readonly PreviewItem[] {
  return buildPreviewScenarios(now).map((scenario) => {
    const view = deriveResultView(scenario.outcome, now);
    return {
      scenario,
      view,
      reply: buildCsReply(view, { now, notices: siteConfig.notices }),
      failureCause: scenario.outcome.kind === "failure" ? scenario.outcome.cause : undefined
    };
  });
}

/** 안내표 미리보기 (spec §10 ③): every state with fake numbers — the customer's screen next to the CS replies. */
export function PreviewTab({ now }: { readonly now: Date | null }): React.JSX.Element {
  const items = useMemo(() => (now === null ? [] : previewItems(now)), [now]);
  if (now === null) return <p className={HELP_CLASS}>{PREPARING}</p>;
  return (
    <div className="flex flex-col gap-4">
      <div className={PANEL_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>안내표 미리보기</h2>
        <p className={HELP_CLASS}>{INTRO}</p>
        <p className={HELP_CLASS}>{`기준 시각 ${formatKstDateTime(now)} (한국 시간)`}</p>
        <nav aria-label="상태 바로가기">
          <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0">
            {items.map(({ scenario }) => (
              <li key={scenario.id}>
                <a href={`#preview-${scenario.id}`} className="tt-focus inline-flex min-h-[24px] items-center text-tt-sm text-tt-link underline">
                  {scenario.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      {items.map(({ scenario, view, reply, failureCause }) => (
        <section
          key={scenario.id}
          id={`preview-${scenario.id}`}
          aria-labelledby={`preview-${scenario.id}-title`}
          data-preview-scenario={scenario.id}
          className={PANEL_CLASS}
        >
          <h2 id={`preview-${scenario.id}-title`} className={SECTION_TITLE_CLASS}>
            {scenario.label}
          </h2>
          <ScreenAndReply view={view} reply={reply} failureCause={failureCause} />
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Give the desk a reference time and the new tab**

Replace the whole content of `components/internal/InternalCsDesk.tsx` with:

```tsx
"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { DeliveryGuideTab } from "./DeliveryGuideTab";
import { MismatchTab } from "./MismatchTab";
import { PreviewTab } from "./PreviewTab";
import { DEFAULT_INTERNAL_TAB, INTERNAL_TAB_IDS, INTERNAL_TAB_LABELS, type InternalTabId } from "./tabs";
import { HELP_CLASS } from "./ui";

const DESK_TITLE = "배송·통관 CS 데스크";
const DESK_INTRO = "번호를 한꺼번에 조회해 고객 답변을 만들고, 통관부호 불일치 안내와 공지를 관리합니다. 조회 결과와 복사 이력은 저장하지 않습니다.";
const TABLIST_LABEL = "CS 데스크 메뉴";
const TAB_CLASS =
  "tt-focus min-h-[44px] border-0 border-b-4 border-solid border-transparent bg-transparent px-4 text-tt-md font-bold text-tt-muted aria-selected:border-tt-ink aria-selected:text-tt-ink";

const tabElementId = (id: InternalTabId): string => `cs-tab-${id}`;
const panelElementId = (id: InternalTabId): string => `cs-panel-${id}`;

/** The desk's reference time: read once, on the client, the first time a snapshot is taken (never during server render). */
let deskNow: Date | null = null;
const subscribeNever = (): (() => void) => () => undefined;
function readDeskNow(): Date {
  if (deskNow === null) deskNow = new Date();
  return deskNow;
}
const readServerNow = (): null => null;

/** Where a key moves the selection (automatic activation; the arrows wrap). */
function targetIndex(key: string, index: number, last: number): number | null {
  switch (key) {
    case "ArrowRight":
      return index === last ? 0 : index + 1;
    case "ArrowLeft":
      return index === 0 ? last : index - 1;
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}

function TabContent({ id, now }: { readonly id: InternalTabId; readonly now: Date | null }): React.JSX.Element {
  switch (id) {
    case "delivery":
      return <DeliveryGuideTab />;
    case "mismatch":
      return <MismatchTab />;
    case "preview":
      return <PreviewTab now={now} />;
  }
}

/**
 * The internal CS desk (spec §10): one tablist, one panel per tab. A panel mounts the first time its tab is chosen and
 * then stays mounted (hidden), so a running bulk lookup or a half-written draft survives a tab switch.
 */
export function InternalCsDesk({ initialTab = DEFAULT_INTERNAL_TAB }: { readonly initialTab?: InternalTabId }): React.JSX.Element {
  const now = useSyncExternalStore(subscribeNever, readDeskNow, readServerNow);
  const [active, setActive] = useState<InternalTabId>(initialTab);
  const [opened, setOpened] = useState<ReadonlySet<InternalTabId>>(() => new Set([initialTab]));
  const tabRefs = useRef<Partial<Record<InternalTabId, HTMLButtonElement | null>>>({});

  const select = (id: InternalTabId, moveFocus: boolean): void => {
    setActive(id);
    setOpened((previous) => (previous.has(id) ? previous : new Set([...previous, id])));
    if (moveFocus) tabRefs.current[id]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    const target = targetIndex(event.key, INTERNAL_TAB_IDS.indexOf(active), INTERNAL_TAB_IDS.length - 1);
    if (target === null) return;
    event.preventDefault();
    select(INTERNAL_TAB_IDS[target], true);
  };

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 pb-16 pt-6 text-tt-ink">
      <header className="flex flex-col gap-2">
        <h1 className="m-0 font-tt-display text-tt-xl [font-weight:var(--tt-weight-display)]">{DESK_TITLE}</h1>
        <p className={HELP_CLASS}>{DESK_INTRO}</p>
      </header>
      <div role="tablist" aria-label={TABLIST_LABEL} className="flex flex-wrap gap-1 border-0 border-b-2 border-solid border-tt-rule">
        {INTERNAL_TAB_IDS.map((id) => (
          <button
            key={id}
            ref={(node) => {
              tabRefs.current[id] = node;
            }}
            type="button"
            role="tab"
            id={tabElementId(id)}
            aria-selected={id === active}
            aria-controls={panelElementId(id)}
            tabIndex={id === active ? 0 : -1}
            data-internal-tab-button={id}
            onClick={() => select(id, false)}
            onKeyDown={onKeyDown}
            className={TAB_CLASS}
          >
            {INTERNAL_TAB_LABELS[id]}
          </button>
        ))}
      </div>
      {INTERNAL_TAB_IDS.map((id) => (
        <section
          key={id}
          role="tabpanel"
          id={panelElementId(id)}
          aria-labelledby={tabElementId(id)}
          data-internal-tab={id}
          hidden={id !== active}
          tabIndex={0}
          className="tt-focus"
        >
          {opened.has(id) ? <TabContent id={id} now={now} /> : null}
        </section>
      ))}
    </main>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/internal-preview.spec.ts tests/e2e/internal-desk.spec.ts tests/e2e/internal-bulk.spec.ts tests/e2e/internal-mismatch.spec.ts`
Expected: 0 failed — `internal-preview.spec.ts` `4 passed`; `internal-desk.spec.ts` `5 passed` (its loops now cover three tabs: ← from the first tab wraps to 안내표 미리보기); `internal-bulk.spec.ts` `11 passed`; `internal-mismatch.spec.ts` `8 passed`.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0 with no new warnings.

- [ ] **Step 7: Commit**

```powershell
git add components/internal/PreviewTab.tsx components/internal/tabs.ts components/internal/InternalCsDesk.tsx tests/e2e/internal-preview.spec.ts
git commit -m "feat: add the CS preview tab showing every state with fake numbers"
```

---

### Task 12: The 공지 현황 tab — notice lists, places, holidays and simulated screens at a chosen KST time

**Files:**
- Create: `components/internal/NoticeStatusTab.tsx`
- Modify: `components/internal/tabs.ts` (the id list and the labels)
- Modify: `components/internal/InternalCsDesk.tsx` (one import, the `notices` case)
- Modify: `tests/e2e/internal-desk.spec.ts` (one appended test)
- Test: `tests/e2e/internal-notices.spec.ts` (create)

**Interfaces:**
- Consumes: `groupNoticesAt`, `noticePlacementAt`, `holidayAt`, `NoticeGroups`, `NoticePlacement`, `NoticeWindow` (Task 5); `buildPreviewScenario`, `PreviewScenarioId` (Task 4); `deriveResultView` (S07); `buildCsReply`, `CsReply` (S03); `siteConfig.notices`, `siteConfig.calendar`, `siteConfig.stateGuide[key].docTitle` (S03); `formatKstDateTime`, `formatKstTime`, `kstDateKey`, `parseInstant` (S03); `Notice`, `HolidayPeriod` (S03 config types), `NoticeKind`, `TrackingViewModel` (S03); `Button` (S05); `ScreenAndReply` (Task 10); UI classes (Task 8); the desk's `now` (Task 11).
- Produces: `NoticeStatusTab({ now }: { readonly now: Date | null }): React.JSX.Element` — a `datetime-local` input '기준 시각 (한국 시간)' (default: the desk's reference time as KST 'YYYY-MM-DDTHH:mm'; a typed value is read as KST), [지금으로], an alert '날짜와 시각을 모두 골라 주세요.' while incomplete; `section[data-notice-simulation=<ISO>]` with `dl[data-notice-places]` (`dd[data-place="home"|"cs"|"results"]`, `dd[data-notice-holiday=<holiday id|none>]`), the notice lists (`ul[data-notice-group="active"|"scheduled"|"expired"] > li[data-notice-id]`, each '[종류] 제목', body, KST window and places) and `div[data-simulated-screen="customsWaiting"|"customsWaitingOverdue"]` with `ScreenAndReply`. `INTERNAL_TAB_IDS` becomes `["delivery", "mismatch", "preview", "notices"]` ('공지 현황').

- [ ] **Step 1: Write the failing tests**

Create `tests/e2e/internal-notices.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";
import { deriveResultView } from "@/components/result/approvals";
import { siteConfig } from "@/config/site.config";
import { groupNoticesAt, holidayAt, noticePlacementAt, type NoticeWindow } from "@/lib/cs/notice-status";
import { buildPreviewScenario } from "@/lib/cs/preview-outcomes";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";
import { openDesk } from "../support/internal-desk";

test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

const TIME_LABEL = "기준 시각 (한국 시간)";
const FIXTURE_INPUT = "2026-09-26T14:05";
const NONE = "없음";
const WINDOWS: readonly NoticeWindow[] = ["active", "scheduled", "expired"];
/** A datetime-local value read as Korean time. */
const kst = (local: string): Date => new Date(`${local}:00+09:00`);

async function openNotices(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await openDesk(page, "notices");
}

async function chooseTime(page: Page, local: string): Promise<void> {
  await page.getByLabel(TIME_LABEL, { exact: true }).fill(local);
  await expect(page.locator("[data-notice-simulation]")).toHaveAttribute("data-notice-simulation", kst(local).toISOString());
}

async function expectListsAt(page: Page, at: Date): Promise<void> {
  const groups = groupNoticesAt(siteConfig.notices, at);
  for (const window of WINDOWS) {
    const ids = await page
      .locator(`[data-notice-group="${window}"] [data-notice-id]`)
      .evaluateAll((items) => items.map((item) => item.getAttribute("data-notice-id")));
    expect(ids, window).toEqual(groups[window].map((notice) => notice.id));
  }
}

test("the time starts at the current Korean time and the notice lists follow the chosen time", async ({ page }) => {
  await openNotices(page);
  await expect(page.getByLabel(TIME_LABEL, { exact: true })).toHaveValue(FIXTURE_INPUT);
  await expect(page.locator("[data-notice-simulation]")).toHaveAttribute("data-notice-simulation", FIXTURE_NOW.toISOString());
  await expectListsAt(page, FIXTURE_NOW);
  for (const local of ["2026-10-05T09:00", "2026-09-01T00:00"]) {
    await chooseTime(page, local);
    await expectListsAt(page, kst(local));
  }
});

test("the places show the home notice, the CS notices and the result states of that time", async ({ page }) => {
  await openNotices(page);
  const placement = noticePlacementAt(siteConfig.notices, FIXTURE_NOW);
  const places = page.locator("[data-notice-places]");
  const results = placement.results.map(({ guideKey, notice }) => `${siteConfig.stateGuide[guideKey].docTitle}: ${notice.title}`);
  await expect(places.locator('[data-place="home"]')).toHaveText(placement.home?.title ?? NONE);
  await expect(places.locator('[data-place="cs"]')).toHaveText(placement.cs.length === 0 ? NONE : placement.cs.map((notice) => notice.title).join(" · "));
  await expect(places.locator('[data-place="results"]')).toHaveText(results.length === 0 ? NONE : results.join(" / "));
});

test("the holiday line names the holiday of that Korean day", async ({ page }) => {
  await openNotices(page);
  for (const local of ["2026-09-25T10:00", "2026-10-14T10:00"]) {
    await chooseTime(page, local);
    const holiday = holidayAt(kst(local), siteConfig.calendar);
    const line = page.locator("[data-notice-holiday]");
    await expect(line).toHaveAttribute("data-notice-holiday", holiday?.id ?? "none");
    if (holiday !== null) await expect(line).toContainText(holiday.badge);
  }
});

test("the simulated screens show that time's in-card notice, holiday badge and the overdue screen", async ({ page }) => {
  await openNotices(page);
  for (const [id, overdue] of [
    ["customsWaiting", false],
    ["customsWaitingOverdue", true]
  ] as const) {
    const view = deriveResultView(buildPreviewScenario(id, FIXTURE_NOW).outcome, FIXTURE_NOW);
    expect(view.overdue).toBe(overdue);
    const screen = page.locator(`[data-simulated-screen="${id}"]`);
    await expect(screen.locator("[data-overdue]").first()).toHaveAttribute("data-overdue", String(overdue));
    await expect(screen.locator('[data-slot="eta"]').first()).toHaveAttribute("data-eta-kind", view.eta.kind);
    if (view.notice !== null) await expect(screen.locator('[data-notice-variant="inline"]')).toContainText(view.notice.body);
  }
});

test("an incomplete time asks for both parts", async ({ page }) => {
  await openNotices(page);
  await page.getByLabel(TIME_LABEL, { exact: true }).fill("");
  await expect(page.locator('[data-internal-tab="notices"]').getByRole("alert")).toHaveText("날짜와 시각을 모두 골라 주세요.");
  await expect(page.locator("[data-notice-simulation]")).toHaveCount(0);
});

test("[지금으로] returns to the current Korean time", async ({ page }) => {
  await openNotices(page);
  await chooseTime(page, "2026-10-05T09:00");
  await page.getByRole("button", { name: "지금으로", exact: true }).click();
  await expect(page.getByLabel(TIME_LABEL, { exact: true })).toHaveValue(FIXTURE_INPUT);
});

test.describe("a browser in America/New_York", () => {
  test.use({ timezoneId: "America/New_York" });

  test("still simulates Korean time", async ({ page }) => {
    await openNotices(page);
    await expect(page.getByLabel(TIME_LABEL, { exact: true })).toHaveValue(FIXTURE_INPUT);
    await chooseTime(page, "2026-09-24T00:30");
    const holiday = holidayAt(kst("2026-09-24T00:30"), siteConfig.calendar);
    await expect(page.locator("[data-notice-holiday]")).toHaveAttribute("data-notice-holiday", holiday?.id ?? "none");
  });
});
```

In `tests/e2e/internal-desk.spec.ts`, append:

```ts
test("the desk has the four tabs of spec §10, in order", () => {
  expect(INTERNAL_TAB_IDS).toEqual(["delivery", "mismatch", "preview", "notices"]);
  expect(INTERNAL_TAB_IDS.map((id) => INTERNAL_TAB_LABELS[id])).toEqual(["배송 안내", "통관부호 불일치", "안내표 미리보기", "공지 현황"]);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/internal-notices.spec.ts tests/e2e/internal-desk.spec.ts`
Expected: FAIL — `internal-notices.spec.ts` `7 failed` (each stops in `openDesk`: no '공지 현황' tab yet); `internal-desk.spec.ts` `1 failed, 5 passed` ("the desk has the four tabs of spec §10, in order": received three ids).

- [ ] **Step 3: Add the tab id**

In `components/internal/tabs.ts`, replace

```ts
export const INTERNAL_TAB_IDS = ["delivery", "mismatch", "preview"] as const;
```

with

```ts
export const INTERNAL_TAB_IDS = ["delivery", "mismatch", "preview", "notices"] as const;
```

and replace

```ts
  preview: "안내표 미리보기"
};
```

with

```ts
  preview: "안내표 미리보기",
  notices: "공지 현황"
};
```

- [ ] **Step 4: Write the tab**

Create `components/internal/NoticeStatusTab.tsx`:

```tsx
"use client";

import { useId, useMemo, useState } from "react";
import { Button } from "@/components/primitives/Button";
import { deriveResultView } from "@/components/result/approvals";
import { siteConfig } from "@/config/site.config";
import type { HolidayPeriod, Notice } from "@/lib/config/types";
import { buildCsReply, type CsReply } from "@/lib/cs/cs-reply";
import { groupNoticesAt, holidayAt, noticePlacementAt, type NoticeGroups, type NoticePlacement, type NoticeWindow } from "@/lib/cs/notice-status";
import { buildPreviewScenario, type PreviewScenarioId } from "@/lib/cs/preview-outcomes";
import { formatKstDateTime, formatKstTime, kstDateKey, parseInstant } from "@/lib/tracking/time";
import type { NoticeKind, TrackingViewModel } from "@/lib/tracking/types";
import { ScreenAndReply } from "./ScreenAndReply";
import { ERROR_CLASS, FIELD_CLASS, HELP_CLASS, LABEL_CLASS, PANEL_CLASS, SECTION_TITLE_CLASS } from "./ui";

const KIND_LABELS: Readonly<Record<NoticeKind, string>> = { outage: "장애", delay: "지연", holiday: "연휴", info: "안내" };
const GROUP_TITLES: Readonly<Record<NoticeWindow, string>> = { active: "진행 중", scheduled: "예정", expired: "종료" };
const GROUP_ORDER: readonly NoticeWindow[] = ["active", "scheduled", "expired"];
const SIMULATED: readonly { readonly id: PreviewScenarioId; readonly title: string }[] = [
  { id: "customsWaiting", title: "통관 대기 화면 (안내 한 줄·연휴 배지)" },
  { id: "customsWaitingOverdue", title: "걱정 기준일이 지난 화면" }
];
const INPUT_VALUE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const NONE = "없음";
const PREPARING = "공지 현황을 준비하고 있어요.";
const INCOMPLETE_MESSAGE = "날짜와 시각을 모두 골라 주세요.";
const INTRO = "날짜와 시각을 고르면 그때 보이는 공지, 연휴 배지와 걱정 기준일이 지난 화면을 보여 줍니다. 시각은 한국 시간으로 읽습니다.";

interface SimulatedScreen {
  readonly id: PreviewScenarioId;
  readonly title: string;
  readonly view: TrackingViewModel;
  readonly reply: CsReply;
}

interface Simulation {
  readonly at: Date;
  readonly groups: NoticeGroups;
  readonly placement: NoticePlacement;
  readonly holiday: HolidayPeriod | null;
  readonly screens: readonly SimulatedScreen[];
}

/** 'YYYY-MM-DDTHH:mm' in Korean time, for a datetime-local input. */
function toKstInputValue(instant: Date): string {
  return `${kstDateKey(instant)}T${formatKstTime(instant)}`;
}

/** The instant a datetime-local value names when read as Korean time; null while incomplete. */
function fromKstInputValue(value: string): Date | null {
  return INPUT_VALUE.test(value) ? parseInstant(`${value}:00+09:00`) : null;
}

function simulate(at: Date): Simulation {
  return {
    at,
    groups: groupNoticesAt(siteConfig.notices, at),
    placement: noticePlacementAt(siteConfig.notices, at),
    holiday: holidayAt(at, siteConfig.calendar),
    screens: SIMULATED.map(({ id, title }) => {
      const view = deriveResultView(buildPreviewScenario(id, at).outcome, at);
      return { id, title, view, reply: buildCsReply(view, { now: at, notices: siteConfig.notices }) };
    })
  };
}

function noticePlaces(notice: Notice): string {
  const places = [
    notice.home ? "홈" : null,
    notice.guideKeys.length > 0 ? `결과 화면 ${notice.guideKeys.length}곳` : null,
    notice.cs ? "CS 답변" : null
  ].filter((place): place is string => place !== null);
  return places.length === 0 ? "보이는 곳 없음" : places.join(" · ");
}

function NoticeItem({ notice }: { readonly notice: Notice }): React.JSX.Element {
  const starts = parseInstant(notice.startsAt);
  const ends = parseInstant(notice.endsAt);
  const period = starts === null || ends === null ? "" : `${formatKstDateTime(starts)} ~ ${formatKstDateTime(ends)}`;
  return (
    <li data-notice-id={notice.id} className="flex flex-col gap-1 border-0 border-b border-solid border-tt-rule py-2">
      <p className="m-0 text-tt-md font-bold [word-break:keep-all]">{`[${KIND_LABELS[notice.kind]}] ${notice.title}`}</p>
      <p className="m-0 text-tt-sm [word-break:keep-all]">{notice.body}</p>
      <p className={HELP_CLASS}>{`${period} · ${noticePlaces(notice)}`}</p>
    </li>
  );
}

function SimulationView({ simulation }: { readonly simulation: Simulation }): React.JSX.Element {
  const baseId = useId();
  const { at, groups, placement, holiday, screens } = simulation;
  const results = placement.results.map(({ guideKey, notice }) => `${siteConfig.stateGuide[guideKey].docTitle}: ${notice.title}`);
  return (
    <>
      <section data-notice-simulation={at.toISOString()} aria-labelledby={`${baseId}-places`} className={PANEL_CLASS}>
        <h2 id={`${baseId}-places`} className={SECTION_TITLE_CLASS}>
          {`${formatKstDateTime(at)}에 보이는 곳`}
        </h2>
        <dl data-notice-places="true" className="m-0 grid gap-x-4 gap-y-2 text-tt-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
          <dt className="font-bold">홈 공지</dt>
          <dd data-place="home" className="m-0">
            {placement.home?.title ?? NONE}
          </dd>
          <dt className="font-bold">CS 답변 끝</dt>
          <dd data-place="cs" className="m-0">
            {placement.cs.length === 0 ? NONE : placement.cs.map((notice) => notice.title).join(" · ")}
          </dd>
          <dt className="font-bold">결과 화면 안내</dt>
          <dd data-place="results" className="m-0 [word-break:keep-all]">
            {results.length === 0 ? NONE : results.join(" / ")}
          </dd>
          <dt className="font-bold">연휴</dt>
          <dd data-notice-holiday={holiday?.id ?? "none"} className="m-0">
            {holiday === null ? "공휴일 아님" : `${holiday.name} · ${holiday.badge}`}
          </dd>
        </dl>
      </section>
      <section aria-labelledby={`${baseId}-lists`} className={PANEL_CLASS}>
        <h2 id={`${baseId}-lists`} className={SECTION_TITLE_CLASS}>
          공지 목록
        </h2>
        {GROUP_ORDER.map((group) => (
          <div key={group} className="flex flex-col gap-1">
            <h3 className="m-0 text-tt-md font-bold">{`${GROUP_TITLES[group]} ${groups[group].length}건`}</h3>
            {groups[group].length === 0 ? (
              <p className={HELP_CLASS}>{NONE}</p>
            ) : (
              <ul data-notice-group={group} className="m-0 list-none p-0">
                {groups[group].map((notice) => (
                  <NoticeItem key={notice.id} notice={notice} />
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>
      <section aria-labelledby={`${baseId}-screens`} className={PANEL_CLASS}>
        <h2 id={`${baseId}-screens`} className={SECTION_TITLE_CLASS}>
          화면 시뮬레이션
        </h2>
        {screens.map((screen) => (
          <div key={screen.id} data-simulated-screen={screen.id} className="flex flex-col gap-2">
            <h3 className="m-0 text-tt-md font-bold">{screen.title}</h3>
            <ScreenAndReply view={screen.view} reply={screen.reply} />
          </div>
        ))}
      </section>
    </>
  );
}

/** 공지 현황 (spec §10 ④): active, scheduled and expired notices, and a KST time simulator for notices, holidays and overdue. */
export function NoticeStatusTab({ now }: { readonly now: Date | null }): React.JSX.Element {
  const baseId = useId();
  const [input, setInput] = useState<string | null>(null);
  const value = input ?? (now === null ? "" : toKstInputValue(now));
  const simulation = useMemo(() => {
    const at = fromKstInputValue(value);
    return at === null ? null : simulate(at);
  }, [value]);
  if (input === null && now === null) return <p className={HELP_CLASS}>{PREPARING}</p>;
  return (
    <div className="flex flex-col gap-4">
      <div className={PANEL_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>공지 현황</h2>
        <p className={HELP_CLASS}>{INTRO}</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${baseId}-at`} className={LABEL_CLASS}>
              기준 시각 (한국 시간)
            </label>
            <input
              id={`${baseId}-at`}
              type="datetime-local"
              value={value}
              onChange={(event) => setInput(event.target.value)}
              className={FIELD_CLASS}
            />
          </div>
          <Button variant="secondary" onClick={() => setInput(toKstInputValue(new Date()))}>
            지금으로
          </Button>
        </div>
        {simulation === null ? (
          <p role="alert" className={ERROR_CLASS}>
            {INCOMPLETE_MESSAGE}
          </p>
        ) : null}
      </div>
      {simulation === null ? null : <SimulationView simulation={simulation} />}
    </div>
  );
}
```

- [ ] **Step 5: Put the tab in the desk**

In `components/internal/InternalCsDesk.tsx`:

(a) Replace `import { MismatchTab } from "./MismatchTab";` with

```tsx
import { MismatchTab } from "./MismatchTab";
import { NoticeStatusTab } from "./NoticeStatusTab";
```

(b) Replace

```tsx
    case "preview":
      return <PreviewTab now={now} />;
```

with

```tsx
    case "preview":
      return <PreviewTab now={now} />;
    case "notices":
      return <NoticeStatusTab now={now} />;
```

- [ ] **Step 6: Run the tests to verify they pass**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/internal-notices.spec.ts tests/e2e/internal-desk.spec.ts tests/e2e/internal-preview.spec.ts tests/e2e/internal-bulk.spec.ts tests/e2e/internal-mismatch.spec.ts tests/internal-access.spec.ts tests/e2e/internal-isolation.spec.ts`
Expected: 0 failed — `internal-notices.spec.ts` `7 passed`, `internal-desk.spec.ts` `6 passed`, `internal-preview.spec.ts` `4 passed`, `internal-bulk.spec.ts` `11 passed`, `internal-mismatch.spec.ts` `8 passed`, `internal-access.spec.ts` `4 passed`, `internal-isolation.spec.ts` `3 passed`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/module-boundaries.spec.ts tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0 with no new warnings.

- [ ] **Step 7: Commit**

```powershell
git add components/internal/NoticeStatusTab.tsx components/internal/tabs.ts components/internal/InternalCsDesk.tsx tests/e2e/internal-notices.spec.ts tests/e2e/internal-desk.spec.ts
git commit -m "feat: add the CS notice status tab with a KST date simulator"
```

---

### Task 13: Stage screens of the desk and the subdomain proposal for a shared list

**Files:**
- Modify: `tests/tools/stage-screens.spec.ts` (one import, one helper before `SCENARIOS`, four entries appended — S01's tool: later stages append only)
- Create: `docs/ops/internal-subdomain-proposal.md`
- Test: the stage-screens tool itself (Steps 1 and 4), `tests/unit/real-number-guard.spec.ts` (Step 6)

**Interfaces:**
- Consumes: S01's tool (`interface StageScenario { name; path; prepare? }`, `SCENARIOS`, the clock pinned to `FIXTURE_NOW` before `prepare`, third-party requests aborted); `INTERNAL_TEST_CREDENTIALS` (`tests/internal-auth.ts`); the desk's `?tab=` deep link (Task 8).
- Produces: scenarios `internal-delivery`, `internal-mismatch`, `internal-preview`, `internal-notices` (basic auth sent as an `authorization` header, since the tool's context has no credentials); the operator document for spec §10 "공유 목록 단계에서는 서브도메인 분리를 제안합니다(승인)".

- [ ] **Step 1: Confirm the tool has no desk screen yet**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; $env:PW_SHOTS='after'; $env:PW_STAGE='S09check'; npx playwright test tests/tools/stage-screens.spec.ts -g "internal-"; $env:PW_SHOTS=$null; $env:PW_STAGE=$null`
Expected: FAIL — `Error: No tests found`.

- [ ] **Step 2: Add the four scenarios**

In `tests/tools/stage-screens.spec.ts`:

(a) Directly below the line `import { FAKE, FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";` add

```ts
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
```

(b) Replace `const SCENARIOS: readonly StageScenario[] = [` with

```ts
/** Internal pages sit behind basic auth (proxy.ts); the tool's context has no credentials, so send the header. */
const INTERNAL_AUTHORIZATION = `Basic ${Buffer.from(`${INTERNAL_TEST_CREDENTIALS.username}:${INTERNAL_TEST_CREDENTIALS.password}`).toString("base64")}`;
const internalScreen = (name: string, tab: string): StageScenario => ({
  name,
  path: `/internal/cs-helper?tab=${tab}`,
  prepare: (page) => page.setExtraHTTPHeaders({ authorization: INTERNAL_AUTHORIZATION })
});

const SCENARIOS: readonly StageScenario[] = [
```

(c) After the last entry of `SCENARIOS` (right before the `];` that closes the array; if the last entry has no trailing comma, add one), add

```ts
  // S09: the internal CS desk, one screen per tab (preview and notices follow the pinned FIXTURE_NOW).
  internalScreen("internal-delivery", "delivery"),
  internalScreen("internal-mismatch", "mismatch"),
  internalScreen("internal-preview", "preview"),
  internalScreen("internal-notices", "notices")
```

- [ ] **Step 3: Verify the tool still skips without its flags**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/tools/stage-screens.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: every test skipped, 0 failed; the skipped count grew by 20 (four scenarios × five widths) against Task 0 Step 5's count.

- [ ] **Step 4: Take the four desk screens once against the dev server**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; $env:PW_SHOTS='after'; $env:PW_STAGE='S09check'; npx playwright test tests/tools/stage-screens.spec.ts -g "internal-"; $env:PW_SHOTS=$null; $env:PW_STAGE=$null`
Expected: `20 passed`; `(Get-ChildItem test-artifacts/stage-screens/S09check-after -Filter internal-*.png).Count` prints `20`. Open `internal-preview-1440.png`: the lead panel and 19 sections, each with a 375 px customer screen and two replies; no page shows a login prompt. Then remove the check output: `Remove-Item -Recurse -Force test-artifacts/stage-screens/S09check-after` (the real after-screens are taken in G7).

- [ ] **Step 5: Write the proposal**

Create `docs/ops/internal-subdomain-proposal.md`:

```markdown
# 내부 CS 데스크 서브도메인 분리 제안

작성: 2026-09-26 · 상태: 제안(승인 14의 '분리 수준', 운영자 결정 필요) · 관련: 설계서 §10 '연결과 한계', §16 승인 14

## 지금 구조

- CS 데스크는 `https://tracking.tipoasis.com/internal/cs-helper`에 있습니다. `(internal)` 레이아웃이라 광고·분석·공개 헤더가 없고, 기본 인증(`proxy.ts`), `noindex`, `no-store`, `no-referrer`가 붙습니다.
- 하지만 공개 조회 페이지와 **같은 origin**입니다. 브라우저 저장소(localStorage·sessionStorage)와 쿠키 범위는 origin 단위라서, 공개 페이지에서 실행되는 광고 스크립트도 이론상 같은 저장소를 읽을 수 있습니다.
- 통관부호 불일치 목록에는 고객 휴대폰 번호가 들어갑니다. 그래서 지금은 담당자의 브라우저 한 곳에만 둡니다. 승인 14가 있으면 기본은 이 탭에만(탭을 닫으면 삭제), '이 브라우저에 7일 보관'을 켤 때만 만료 시각과 함께 브라우저에 둡니다. 승인 전에는 14일 뒤 자동 삭제되는 브라우저 저장을 씁니다. 어느 쪽이든 화면에는 010-****-1234처럼 가려서 보여 주고, [전체 삭제]가 있습니다.

## 언제 분리가 필요한가

- 여러 담당자가 **같은 목록을 함께 보고 상태(작성·발송·회신·완료)를 바꿔야 할 때**입니다. 목록을 공유하려면 서버 저장소가 필요하고, 고객 전화번호가 서버에 남습니다.
- 그때도 공개 사이트와 같은 origin·같은 배포에 두면 광고 스크립트와 저장소·쿠키 범위를 공유하고, 공개 사이트의 장애나 배포가 CS 도구에 그대로 영향을 줍니다.

## 제안

1. CS 데스크만 별도 서브도메인(예: `cs.tipoasis.com`)에 배포합니다. origin이 달라 공개 사이트와 저장소·쿠키가 섞이지 않고, 공개 사이트에는 `/internal` 경로가 남지 않습니다.
2. 인증은 담당자별 계정(예: Vercel 비밀번호 보호 또는 SSO)으로 바꾸고, 실패 시도 제한은 Vercel WAF 규칙으로 둡니다(`docs/ops/waf-internal-proposal.md`).
3. 공유 목록은 서버 저장소 한 곳에 두고, 보관 기간이 지나면 자동 삭제합니다. 전화번호는 화면·로그에서 가리고, 조회번호와 조회 결과는 저장하지 않습니다.
4. 옮긴 뒤 한 달 동안 `https://tracking.tipoasis.com/internal/cs-helper`를 새 주소로 이동시키고, 그다음 경로를 닫습니다.

## 비용과 위험

- Vercel 프로젝트(또는 도메인 라우팅)와 저장소가 하나씩 늘어납니다. 새 서비스 추가는 승인 13 대상입니다.
- 서버에 고객 전화번호가 저장되므로 개인정보처리방침 개정, 보관·파기 절차, 접근 기록이 필요합니다.
- 지금처럼 담당자별 브라우저 목록으로 충분하면 분리하지 않는 편이 가장 안전합니다.

## 결정할 것

- 공유 목록이 실제로 필요한가(담당자 수, 인계 빈도).
- 필요하다면 서브도메인 이름, 인증 방식, 보관 기간.
- 결정 전까지는 지금 구조(브라우저 한 곳 보관, 가림 표시, 전체 삭제)를 유지합니다.
```

- [ ] **Step 6: Run the checks**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed (the proposal and the tool contain no 10+ digit run).
Run: `npm run typecheck; npx eslint tests/tools/stage-screens.spec.ts`
Expected: `tsc` exits 0; eslint prints nothing.

- [ ] **Step 7: Commit**

```powershell
git add tests/tools/stage-screens.spec.ts docs/ops/internal-subdomain-proposal.md
git commit -m "docs: add CS desk stage screens and the subdomain proposal for a shared list"
```

---

### Task 14 (gated by approval 14): Drafts in this tab only, '이 브라우저에 7일 보관' on request, the legacy list migrated

**Files:**
- Modify (whole file): `lib/cs/mismatch-storage.ts`
- Modify: `components/internal/MismatchTab.tsx` (imports, retention constants, the retention control)
- Modify: `tests/unit/mismatch-storage.spec.ts` (import block, five appended tests)
- Modify: `tests/e2e/internal-mismatch.spec.ts` (imports, `REFUSED_KEYS`, the legacy-migration test replaced, three appended tests)
- Modify: `tests/e2e/RULE-MAP.md` (row I5)

**Interfaces:**
- Consumes: roadmap §4 row 14; S01's names (kept with their meaning: `MISMATCH_LEGACY_KEY` is now read once and removed; `MISMATCH_TTL_DAYS` filters legacy records during that migration; `parseMismatchPayload`/`serializeMismatchPayload` still read and write the v1 format S01's tests cover); Task 6's status names; Task 9's `MismatchTab`; `formatKstDateTime`, `parseInstant` (S03).
- Produces (Additions 6, contract §11.14 row `tt:cs-mismatch`): `MISMATCH_KEY = "tt:cs-mismatch"`, `MISMATCH_KEEP_DAYS = 7`, `type MismatchRetention = { kind: "session" } | { kind: "kept"; keepUntil: string }`, `interface ParsedStore { records; keepUntil; valid; needsRewrite }`, `serializeStorePayload(records, keepUntil): string` (`{ "v": 2, "keepUntil": …, "records": … }`), `parseStorePayload(raw, now): ParsedStore`, `getRetentionSnapshot()`, `getServerRetentionSnapshot()`, `setKeepInBrowser(keep: boolean, now: Date): void` (throws when storage is refused). Behavior: the list lives in `sessionStorage` by default; with the keep on it lives in `localStorage` until `keepUntil` (now + 7 days) and is deleted after; on subscribe S01's legacy list is merged into the current list and its key removed; `writeStoredRecords` writes where the list lives and still throws when refused; `clearAllStoredRecords` removes both keys and the legacy key. `MismatchTab` shows a checkbox '이 브라우저에 7일 보관' with `data-mismatch-retention="session"|"kept"` and the matching note.

- [ ] **Step 1: Check the ledger**

Open `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §4 and read row 14 ("`/internal` storage policy").
If the Status is `pending` or `rejected`: stop here and mark Task 14 SKIPPED in the stage summary with this reason — "approval 14 is <status>; S09 ships the spec §16 item 14 fallback '14일 TTL로 localStorage를 유지합니다(다른 판정안). 서브도메인 분리는 하지 않습니다.': S01's 14-day `localStorage` list with zod validation, [전체 삭제], masking and the status field (Tasks 6 and 9), asserted by `tests/e2e/internal-mismatch.spec.ts` › 'legacy drafts are migrated, expired ones dropped, and [전체 삭제] clears everything'. When approval 14 is granted later, only this task is re-opened (roadmap §4)." Then go to Task 15.
If the Status is `approved`: continue.

- [ ] **Step 2: Write the failing unit tests**

In `tests/unit/mismatch-storage.spec.ts`:

(a) Replace the import block from `@/lib/cs/mismatch-storage` (as Task 6 left it) with

```ts
import {
  MISMATCH_KEEP_DAYS,
  MISMATCH_KEY,
  MISMATCH_LEGACY_KEY,
  MISMATCH_STATUSES,
  MISMATCH_STATUS_LABELS,
  MISMATCH_TTL_DAYS,
  isMismatchStatus,
  parseMismatchPayload,
  parseStorePayload,
  serializeMismatchPayload,
  serializeStorePayload,
  withRecordStatus,
  type MismatchRecord
} from "@/lib/cs/mismatch-storage";
```

(b) Append to the end of the file:

```ts
test("approval 14: one key for the list and a 7-day keep", () => {
  expect(MISMATCH_KEY).toBe("tt:cs-mismatch");
  expect(MISMATCH_KEEP_DAYS).toBe(7);
});

test("a tab-only v2 payload round-trips without a rewrite", () => {
  const records = [record("a", isoDaysAgo(1))];
  const raw = serializeStorePayload(records, null);
  expect(JSON.parse(raw)).toEqual({ v: 2, keepUntil: null, records });
  expect(parseStorePayload(raw, NOW)).toEqual({ records, keepUntil: null, valid: true, needsRewrite: false });
});

test("a kept payload is valid until keepUntil and gone at keepUntil", () => {
  const keepUntil = new Date(NOW + DAY_MS).toISOString();
  const raw = serializeStorePayload([record("a", isoDaysAgo(1))], keepUntil);
  expect(parseStorePayload(raw, NOW + DAY_MS - 1)).toMatchObject({ keepUntil, valid: true, needsRewrite: false });
  expect(parseStorePayload(raw, NOW + DAY_MS)).toEqual({ records: [], keepUntil: null, valid: false, needsRewrite: true });
});

test("broken records are dropped from a v2 payload", () => {
  const valid = record("ok", isoDaysAgo(1));
  const raw = JSON.stringify({ v: 2, keepUntil: null, records: [valid, { ...valid, id: "bad-date", createdAt: "어제" }, null] });
  expect(parseStorePayload(raw, NOW)).toEqual({ records: [valid], keepUntil: null, valid: true, needsRewrite: true });
});

test("a v1 payload, garbage or nothing is not a v2 list", () => {
  expect(parseStorePayload(serializeMismatchPayload([record("a", isoDaysAgo(1))]), NOW)).toMatchObject({ valid: false, needsRewrite: true });
  expect(parseStorePayload("not json", NOW)).toMatchObject({ valid: false, needsRewrite: true });
  expect(parseStorePayload(null, NOW)).toEqual({ records: [], keepUntil: null, valid: false, needsRewrite: false });
});
```

- [ ] **Step 3: Write the failing E2E changes**

In `tests/e2e/internal-mismatch.spec.ts`:

(a) Replace `import { MISMATCH_LEGACY_KEY, MISMATCH_STATUS_LABELS, MISMATCH_TTL_DAYS } from "@/lib/cs/mismatch-storage";` with

```ts
import { MISMATCH_KEEP_DAYS, MISMATCH_KEY, MISMATCH_LEGACY_KEY, MISMATCH_STATUS_LABELS } from "@/lib/cs/mismatch-storage";
```

and below `import { maskPhone } from "@/lib/cs/phone-mask";` add

```ts
import { formatKstDateTime } from "@/lib/tracking/time";
```

(b) Replace `const REFUSED_KEYS: readonly string[] = [MISMATCH_LEGACY_KEY];` with

```ts
const REFUSED_KEYS: readonly string[] = [MISMATCH_LEGACY_KEY, MISMATCH_KEY];
const KEEP_LABEL = "이 브라우저에 7일 보관";
const DAY_MS = 86_400_000;
```

(c) Replace the whole test that starts with `test("legacy drafts are migrated, expired ones dropped, and [전체 삭제] clears everything"` (through its closing `});`) with

```ts
test("legacy drafts move into this tab's list, expired ones are dropped, and [전체 삭제] clears everything", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const fresh = {
    id: "fresh",
    phone: FAKE.phone,
    content: "최근 안내",
    trackingMemo: "ORDER-5",
    templateKey: "default",
    createdAt: "2026-09-20T01:00:00.000Z"
  };
  const expired = { ...fresh, id: "expired", content: "오래된 안내", trackingMemo: "ORDER-OLD", createdAt: "2026-09-01T01:00:00.000Z" };
  await openDesk(page, "mismatch");
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [
    MISMATCH_LEGACY_KEY,
    JSON.stringify([fresh, expired])
  ] as const);
  await page.reload();

  await expect(recordWith(page, "ORDER-5")).toBeVisible();
  await expect(page.getByText("ORDER-OLD", { exact: false })).toHaveCount(0);
  await expect(page.locator("[data-mismatch-retention]")).toHaveAttribute("data-mismatch-retention", "session");
  const stored = await page.evaluate(
    ([legacyKey, key]) => ({
      legacy: window.localStorage.getItem(legacyKey),
      kept: window.localStorage.getItem(key),
      tab: window.sessionStorage.getItem(key)
    }),
    [MISMATCH_LEGACY_KEY, MISMATCH_KEY] as const
  );
  expect(stored.legacy).toBeNull();
  expect(stored.kept).toBeNull();
  expect(JSON.parse(stored.tab ?? "null")).toMatchObject({ v: 2, keepUntil: null, records: [{ id: "fresh", status: "draft" }] });

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "전체 삭제", exact: true }).click();
  await expect(page.getByText(EMPTY_MESSAGE)).toBeVisible();
  expect(await page.evaluate((key) => window.sessionStorage.getItem(key), MISMATCH_KEY)).toBeNull();
});
```

(d) Append to the end of the file:

```ts
test("by default the list lives in this tab only", async ({ page, context }) => {
  await openDesk(page, "mismatch");
  await saveDraft(page, "ORDER-TAB");
  await expect(page.locator("[data-mismatch-retention]")).toHaveAttribute("data-mismatch-retention", "session");
  await expect(page.getByRole("checkbox", { name: KEEP_LABEL })).not.toBeChecked();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), MISMATCH_KEY)).toBeNull();
  const other = await context.newPage();
  await openDesk(other, "mismatch");
  await expect(other.getByText(EMPTY_MESSAGE)).toBeVisible();
});

test("the 7-day keep moves the list into this browser until the date shown, and back", async ({ page, context }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await openDesk(page, "mismatch");
  await saveDraft(page, "ORDER-KEEP7");
  await page.getByRole("checkbox", { name: KEEP_LABEL }).check();
  await expect(page.locator("[data-mismatch-retention]")).toHaveAttribute("data-mismatch-retention", "kept");
  const keepUntil = new Date(FIXTURE_NOW.getTime() + MISMATCH_KEEP_DAYS * DAY_MS).toISOString();
  const kept = await page.evaluate((key) => window.localStorage.getItem(key), MISMATCH_KEY);
  expect(JSON.parse(kept ?? "null")).toMatchObject({ v: 2, keepUntil, records: [{ trackingMemo: "ORDER-KEEP7" }] });
  expect(await page.evaluate((key) => window.sessionStorage.getItem(key), MISMATCH_KEY)).toBeNull();
  await expect(page.locator("[data-mismatch-retention]")).toContainText(formatKstDateTime(new Date(keepUntil)));

  const other = await context.newPage();
  await other.clock.setFixedTime(FIXTURE_NOW);
  await openDesk(other, "mismatch");
  await expect(recordWith(other, "ORDER-KEEP7")).toBeVisible();
  await other.close();

  await page.getByRole("checkbox", { name: KEEP_LABEL }).uncheck();
  await expect(page.locator("[data-mismatch-retention]")).toHaveAttribute("data-mismatch-retention", "session");
  expect(await page.evaluate((key) => window.localStorage.getItem(key), MISMATCH_KEY)).toBeNull();
  await expect(recordWith(page, "ORDER-KEEP7")).toBeVisible();
});

test("a kept list is deleted once its 7 days are over", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const old = {
    id: "kept-old",
    phone: FAKE.phone,
    content: "지난 안내",
    trackingMemo: "ORDER-EXPIRED",
    templateKey: "default",
    status: "sent",
    createdAt: "2026-09-10T01:00:00.000Z"
  };
  await openDesk(page, "mismatch");
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [
    MISMATCH_KEY,
    JSON.stringify({ v: 2, keepUntil: "2026-09-20T00:00:00.000Z", records: [old] })
  ] as const);
  await page.reload();
  await expect(page.getByText(EMPTY_MESSAGE)).toBeVisible();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), MISMATCH_KEY)).toBeNull();
});
```

- [ ] **Step 4: Run them to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/mismatch-storage.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `5 failed, 12 passed` (`MISMATCH_KEY` is `undefined`, `serializeStorePayload is not a function`, `parseStorePayload is not a function`).
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/internal-mismatch.spec.ts`
Expected: FAIL — `4 failed, 7 passed`: the replaced migration test (retention is `ttl14`, the draft stays in the legacy key), "by default the list lives in this tab only" (no checkbox), "the 7-day keep …" (no checkbox) and "a kept list is deleted …" (the key is never read, so it stays).

- [ ] **Step 5: Rewrite the store**

Replace the whole content of `lib/cs/mismatch-storage.ts` with:

```ts
import { z } from "zod";
import type { CustomsMismatchTemplateKey } from "@/lib/cs/mismatch-templates";

// Internal-only (contract §11.1 rule 4). Customs-mismatch drafts hold customer phone numbers, so they stay in this
// browser only (spec §10 ②, approval 14): this tab by default (sessionStorage), this browser for 7 days only when staff
// turn the keep on (localStorage with an expiry). S01's 14-day localStorage list is migrated once and removed.

/** S01's key (localStorage, v1 or a bare array). Read once on subscribe, merged into MISMATCH_KEY, then removed. */
export const MISMATCH_LEGACY_KEY = "tracking-tipoasis:customs-mismatch-records";
/** Legacy records older than this are dropped while migrating (S01's lifetime). */
export const MISMATCH_TTL_DAYS = 14;
/** Roadmap §11.14: `{ "v": 2, "keepUntil": string | null, "records": MismatchRecord[] }`. */
export const MISMATCH_KEY = "tt:cs-mismatch";
export const MISMATCH_KEEP_DAYS = 7;

/** Progress of one mismatch notice (spec §10 상태: 작성·발송·회신·완료). Staff set it by hand; the tool never sends anything. */
export const MISMATCH_STATUSES = ["draft", "sent", "replied", "done"] as const;
export type MismatchStatus = (typeof MISMATCH_STATUSES)[number];
export const MISMATCH_STATUS_LABELS: Readonly<Record<MismatchStatus, string>> = {
  draft: "작성",
  sent: "발송",
  replied: "회신",
  done: "완료"
};

export interface MismatchRecord {
  readonly id: string;
  readonly phone: string;
  readonly content: string;
  readonly trackingMemo: string;
  readonly templateKey: CustomsMismatchTemplateKey;
  readonly status: MismatchStatus;
  readonly createdAt: string;
  readonly updatedAt?: string;
}

/** Where the list lives now: this tab only, or this browser until keepUntil. */
export type MismatchRetention = { readonly kind: "session" } | { readonly kind: "kept"; readonly keepUntil: string };

export interface ParsedMismatchPayload {
  readonly records: readonly MismatchRecord[];
  /** True when storage holds anything other than exactly serializeMismatchPayload(records): legacy array, broken or expired records, garbage. */
  readonly needsRewrite: boolean;
}

export interface ParsedStore {
  readonly records: readonly MismatchRecord[];
  readonly keepUntil: string | null;
  /** False for nothing stored, garbage, another version, or a keep that has expired. */
  readonly valid: boolean;
  /** True when storage holds anything other than exactly serializeStorePayload(records, keepUntil). */
  readonly needsRewrite: boolean;
}

const LEGACY_VERSION = 1;
const PAYLOAD_VERSION = 2;
const DAY_MS = 86_400_000;
const TTL_MS = MISMATCH_TTL_DAYS * DAY_MS;
const KEEP_MS = MISMATCH_KEEP_DAYS * DAY_MS;

const TEMPLATE_KEYS = ["default", "recipient", "hold"] as const satisfies readonly CustomsMismatchTemplateKey[];

const MismatchRecordSchema = z.object({
  id: z.string().min(1),
  phone: z.string(),
  content: z.string(),
  trackingMemo: z.string(),
  templateKey: z.enum(TEMPLATE_KEYS),
  // Records saved before statuses existed read as 작성 (the rewrite on subscribe then stores the field).
  status: z.enum(MISMATCH_STATUSES).default("draft"),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }).optional()
});

const LegacyPayloadSchema = z.object({ v: z.literal(LEGACY_VERSION), records: z.array(z.unknown()) });
const StorePayloadSchema = z.object({
  v: z.literal(PAYLOAD_VERSION),
  keepUntil: z.string().datetime({ offset: true }).nullable(),
  records: z.array(z.unknown())
});

const EMPTY_RECORDS: readonly MismatchRecord[] = [];
const SESSION_RETENTION: MismatchRetention = { kind: "session" };
const NOTHING_STORED: ParsedStore = { records: EMPTY_RECORDS, keepUntil: null, valid: false, needsRewrite: false };
const UNUSABLE_STORE: ParsedStore = { records: EMPTY_RECORDS, keepUntil: null, valid: false, needsRewrite: true };

export const createRecordId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const normalizePhone = (value: string): string => value.replace(/[^\d-]/g, "").trim();

export function isMismatchStatus(value: unknown): value is MismatchStatus {
  return typeof value === "string" && MISMATCH_STATUSES.some((status) => status === value);
}

/** A copy of `records` with one record's status changed and `updatedAt` set; every other record is the same object. */
export function withRecordStatus(
  records: readonly MismatchRecord[],
  id: string,
  status: MismatchStatus,
  now: Date
): readonly MismatchRecord[] {
  return records.map((record) => (record.id === id ? { ...record, status, updatedAt: now.toISOString() } : record));
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null; // unreadable storage is treated as empty and rewritten
  }
}

function validRecords(candidates: readonly unknown[]): MismatchRecord[] {
  return candidates.flatMap((candidate) => {
    const parsed = MismatchRecordSchema.safeParse(candidate);
    return parsed.success ? [parsed.data] : [];
  });
}

// ---- S01's v1 payload: read only to migrate the legacy key ----

export function serializeMismatchPayload(records: readonly MismatchRecord[]): string {
  return JSON.stringify({ v: LEGACY_VERSION, records });
}

function legacyCandidates(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) return value; // pre-S01 format: a bare array
  const payload = LegacyPayloadSchema.safeParse(value);
  return payload.success ? payload.data.records : [];
}

const isFresh = (record: MismatchRecord, now: number): boolean => now - Date.parse(record.createdAt) <= TTL_MS;

export function parseMismatchPayload(raw: string | null, now: number): ParsedMismatchPayload {
  if (raw === null) return { records: EMPTY_RECORDS, needsRewrite: false };
  const records = validRecords(legacyCandidates(parseJson(raw))).filter((record) => isFresh(record, now));
  return { records, needsRewrite: serializeMismatchPayload(records) !== raw };
}

// ---- v2 payload (approval 14) ----

export function serializeStorePayload(records: readonly MismatchRecord[], keepUntil: string | null): string {
  return JSON.stringify({ v: PAYLOAD_VERSION, keepUntil, records });
}

export function parseStorePayload(raw: string | null, now: number): ParsedStore {
  if (raw === null) return NOTHING_STORED;
  const payload = StorePayloadSchema.safeParse(parseJson(raw));
  if (!payload.success) return UNUSABLE_STORE;
  const { keepUntil } = payload.data;
  if (keepUntil !== null && now >= Date.parse(keepUntil)) return UNUSABLE_STORE;
  const records = validRecords(payload.data.records);
  return { records, keepUntil, valid: true, needsRewrite: serializeStorePayload(records, keepUntil) !== raw };
}

// ---- Browser store for useSyncExternalStore ----

type Area = "session" | "local";

/** Throws when the browser refuses storage (private windows, policies). */
function storageOf(area: Area): Storage {
  return area === "session" ? window.sessionStorage : window.localStorage;
}

function readRaw(area: Area, key: string): string | null {
  try {
    return storageOf(area).getItem(key);
  } catch {
    return null; // refused storage behaves as "nothing stored"
  }
}

function removeQuietly(area: Area, key: string): void {
  try {
    storageOf(area).removeItem(key);
  } catch {
    // Refused storage holds nothing this page can read, so there is nothing to remove.
  }
}

interface StoreState {
  readonly area: Area;
  readonly parsed: ParsedStore;
}

/** A kept list (localStorage, before keepUntil) wins; otherwise this tab's list (sessionStorage). */
function readState(now: number): StoreState {
  const kept = parseStorePayload(readRaw("local", MISMATCH_KEY), now);
  if (kept.valid && kept.keepUntil !== null) return { area: "local", parsed: kept };
  return { area: "session", parsed: parseStorePayload(readRaw("session", MISMATCH_KEY), now) };
}

/** Throws when the browser refuses storage. A tab list never carries keepUntil. */
function writeState(area: Area, records: readonly MismatchRecord[], keepUntil: string | null): void {
  storageOf(area).setItem(MISMATCH_KEY, serializeStorePayload(records, area === "local" ? keepUntil : null));
}

const listeners = new Set<() => void>();
// getSnapshot must return stable references, so re-parse only when the stored text changes.
let snapshotKey: string | null = null;
let snapshotRecords: readonly MismatchRecord[] = EMPTY_RECORDS;
let snapshotRetention: MismatchRetention = SESSION_RETENTION;

function notify(): void {
  listeners.forEach((listener) => listener());
}

function refreshSnapshot(): void {
  // JSON never contains a raw line break, so "\n" separates the two stored texts unambiguously.
  const key = `${readRaw("session", MISMATCH_KEY) ?? ""}\n${readRaw("local", MISMATCH_KEY) ?? ""}`;
  if (key === snapshotKey) return;
  snapshotKey = key;
  const { area, parsed } = readState(Date.now());
  snapshotRecords = parsed.records;
  snapshotRetention = area === "local" && parsed.keepUntil !== null ? { kind: "kept", keepUntil: parsed.keepUntil } : SESSION_RETENTION;
}

export function getStoredRecordsSnapshot(): readonly MismatchRecord[] {
  refreshSnapshot();
  return snapshotRecords;
}

export function getServerStoredRecordsSnapshot(): readonly MismatchRecord[] {
  return EMPTY_RECORDS;
}

export function getRetentionSnapshot(): MismatchRetention {
  refreshSnapshot();
  return snapshotRetention;
}

export function getServerRetentionSnapshot(): MismatchRetention {
  return SESSION_RETENTION;
}

/** Merges S01's legacy list into the current list once, then removes expired or broken payloads. Runs on subscribe. */
function migrateAndPurge(): void {
  const now = Date.now();
  let changed = false;
  const legacyRaw = readRaw("local", MISMATCH_LEGACY_KEY);
  if (legacyRaw !== null) {
    const legacy = parseMismatchPayload(legacyRaw, now).records;
    const { area, parsed } = readState(now);
    const known = new Set(parsed.records.map((record) => record.id));
    const merged = [...parsed.records, ...legacy.filter((record) => !known.has(record.id))];
    try {
      if (merged.length > 0) writeState(area, merged, parsed.keepUntil);
      storageOf("local").removeItem(MISMATCH_LEGACY_KEY);
      changed = true;
    } catch {
      // Storage refused: the legacy key stays and is migrated on a later visit.
    }
  }
  for (const area of ["local", "session"] as const) {
    const raw = readRaw(area, MISMATCH_KEY);
    if (raw === null) continue;
    const parsed = parseStorePayload(raw, now);
    // A kept list stays while it lasts (even empty: keeping is the staff's choice); a tab list only while it has records.
    const keepable = parsed.valid && (area === "local" ? parsed.keepUntil !== null : parsed.records.length > 0);
    if (keepable && !parsed.needsRewrite) continue;
    try {
      if (keepable) writeState(area, parsed.records, parsed.keepUntil);
      else storageOf(area).removeItem(MISMATCH_KEY);
      changed = true;
    } catch {
      // Read-only storage: the snapshot already ignores what cannot be removed.
    }
  }
  if (changed) notify();
}

export function subscribeStoredRecords(onChange: () => void): () => void {
  listeners.add(onChange);
  migrateAndPurge();
  return () => {
    listeners.delete(onChange);
  };
}

/** Writes the list where it lives now (this tab, or this browser while kept). Throws when the browser refuses storage. */
export function writeStoredRecords(records: readonly MismatchRecord[]): void {
  const { area, parsed } = readState(Date.now());
  writeState(area, records, parsed.keepUntil);
  notify();
}

/** Turns the keep on (this browser until now + 7 days) or off (back to this tab only). Throws when storage is refused. */
export function setKeepInBrowser(keep: boolean, now: Date): void {
  const { parsed } = readState(now.getTime());
  if (keep) {
    writeState("local", parsed.records, new Date(now.getTime() + KEEP_MS).toISOString());
    removeQuietly("session", MISMATCH_KEY);
  } else {
    writeState("session", parsed.records, null);
    removeQuietly("local", MISMATCH_KEY);
  }
  notify();
}

export function clearAllStoredRecords(): void {
  removeQuietly("session", MISMATCH_KEY);
  removeQuietly("local", MISMATCH_KEY);
  removeQuietly("local", MISMATCH_LEGACY_KEY);
  notify();
}
```

- [ ] **Step 6: Show the keep control in the tab**

In `components/internal/MismatchTab.tsx`:

(a) Replace the import block from `@/lib/cs/mismatch-storage` (as Task 9 wrote it) with

```tsx
import {
  MISMATCH_KEEP_DAYS,
  clearAllStoredRecords,
  createRecordId,
  getRetentionSnapshot,
  getServerRetentionSnapshot,
  getServerStoredRecordsSnapshot,
  getStoredRecordsSnapshot,
  normalizePhone,
  setKeepInBrowser,
  subscribeStoredRecords,
  withRecordStatus,
  writeStoredRecords,
  type MismatchRecord,
  type MismatchStatus
} from "@/lib/cs/mismatch-storage";
```

(b) Replace `import { CUSTOMS_MISMATCH_TEMPLATES, type CustomsMismatchTemplateKey } from "@/lib/cs/mismatch-templates";` with

```tsx
import { CUSTOMS_MISMATCH_TEMPLATES, type CustomsMismatchTemplateKey } from "@/lib/cs/mismatch-templates";
import { formatKstDateTime, parseInstant } from "@/lib/tracking/time";
```

(c) Replace

```tsx
const RETENTION_NOTE = `이 브라우저에만 ${MISMATCH_TTL_DAYS}일 동안 보관하고, 지나면 자동으로 지워요.`;
```

with

```tsx
const KEEP_LABEL = `이 브라우저에 ${MISMATCH_KEEP_DAYS}일 보관`;
const TAB_ONLY_NOTE = `이 탭을 닫으면 목록이 지워져요. 오래 두려면 ${MISMATCH_KEEP_DAYS}일 보관을 켜 주세요.`;

function keptNote(keepUntil: string): string {
  const until = parseInstant(keepUntil);
  return until === null ? "" : `${formatKstDateTime(until)}까지 이 브라우저에 보관하고, 지나면 자동으로 지워요.`;
}
```

(d) Replace

```tsx
  const records = useSyncExternalStore(subscribeStoredRecords, getStoredRecordsSnapshot, getServerStoredRecordsSnapshot);
```

with

```tsx
  const records = useSyncExternalStore(subscribeStoredRecords, getStoredRecordsSnapshot, getServerStoredRecordsSnapshot);
  const retentionState = useSyncExternalStore(subscribeStoredRecords, getRetentionSnapshot, getServerRetentionSnapshot);
```

(e) Replace

```tsx
  const retention = (
    <p data-mismatch-retention="ttl14" className={HELP_CLASS}>
      {RETENTION_NOTE}
    </p>
  );
```

with

```tsx
  const onKeepChange = (keep: boolean): void => {
    try {
      setKeepInBrowser(keep, new Date());
      setError("");
    } catch {
      setError(STORAGE_REFUSED_MESSAGE);
    }
  };

  const retention = (
    <div data-mismatch-retention={retentionState.kind} className="flex flex-col gap-1">
      <label className="flex min-h-[44px] items-center gap-2 text-tt-md font-bold">
        <input
          type="checkbox"
          checked={retentionState.kind === "kept"}
          onChange={(event) => onKeepChange(event.target.checked)}
          className="tt-focus h-6 w-6"
        />
        {KEEP_LABEL}
      </label>
      <p className={HELP_CLASS}>{retentionState.kind === "kept" ? keptNote(retentionState.keepUntil) : TAB_ONLY_NOTE}</p>
    </div>
  );
```

In `tests/e2e/RULE-MAP.md`, in row I5 replace

```markdown
(approval 14: "legacy drafts move into this tab's list, expired ones are dropped, and [전체 삭제] clears everything") | migrated (Task 9) |
```

with

```markdown
(approval 14: "legacy drafts move into this tab's list, expired ones are dropped, and [전체 삭제] clears everything") | migrated (Task 9); approval-14 form (Task 14) |
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/mismatch-storage.spec.ts tests/unit/module-boundaries.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all passed (`mismatch-storage.spec.ts`: `17 passed` — S01's v1 rows still hold because the legacy parser is unchanged).
Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/internal-mismatch.spec.ts tests/e2e/internal-desk.spec.ts`
Expected: 0 failed — `internal-mismatch.spec.ts` `11 passed`, `internal-desk.spec.ts` `6 passed`.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0 with no new warnings.

- [ ] **Step 8: Commit**

```powershell
git add lib/cs/mismatch-storage.ts components/internal/MismatchTab.tsx tests/unit/mismatch-storage.spec.ts tests/e2e/internal-mismatch.spec.ts tests/e2e/RULE-MAP.md
git commit -m "feat: keep customs mismatch drafts in the tab by default with an optional 7-day keep (approval 14)"
```

---

### Task 15 (gated by approval 13): axe WCAG 2.2 AA on every desk tab

**Files:**
- Create: `tests/e2e/internal-a11y.spec.ts`
- Modify (only if the package is absent): `package.json`, `package-lock.json` (`@axe-core/playwright` dev dependency)

**Interfaces:**
- Consumes: roadmap §4 row 13; `@axe-core/playwright` (`AxeBuilder`); `INTERNAL_TAB_IDS` (Task 12); `openDesk` (Task 8); `mockTrack` (S01), `deliveredData` (S03), `FAKE`, `FIXTURE_NOW`.
- Produces: `tests/e2e/internal-a11y.spec.ts` — one axe run (tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) per tab panel at 1280 px, plus one on the 배송 안내 table with an open row.

- [ ] **Step 1: Check the ledger**

Open `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §4 and read row 13 ("New services/dependencies").
If the Status is `pending` or `rejected`: stop here and mark Task 15 SKIPPED in the stage summary with this reason — "approval 13 is <status>; spec §16 item 13 '거절하면 … 접근성은 수동으로 점검합니다': manual check recorded below; the structural E2E (`internal-desk.spec.ts` tab semantics and keyboard, labelled fields in every desk spec) stay the automated check." Then record this five-item manual check in the stage summary, each with pass/fail: (1) Tab reaches the active tab, ←/→/Home/End switch tabs and Tab moves into the panel; (2) every field on the four tabs has a visible label and the screen reader reads it; (3) the focus ring is visible on tabs, radios, the checkbox, buttons and textareas; (4) at 200 % zoom no text or control is cut off (the result table may scroll inside its own box); (5) a screen reader reads the tab names with 'selected', the table's row headers (numbers) and the copy buttons' names. Then go to Task Final.
If the Status is `approved`: continue.

- [ ] **Step 2: Make sure the dependency is there**

Run: `Select-String -LiteralPath package.json -Pattern '"@axe-core/playwright"' | Measure-Object | Select-Object -ExpandProperty Count`
Expected: `1` when an earlier stage (S05/S06/S07/S08) already added it — skip the install. If it prints `0`: `npm install --save-dev @axe-core/playwright`, then the count is `1` and `git status --short package.json package-lock.json` lists both files.

- [ ] **Step 3: Write the check**

Create `tests/e2e/internal-a11y.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { INTERNAL_TAB_IDS } from "@/components/internal/tabs";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
import { deliveredData } from "../fixtures/derive-scenarios";
import { FAKE, FIXTURE_NOW, mockTrack } from "../fixtures/tracking-fixtures";
import { openDesk } from "../support/internal-desk";

test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function violationsIn(page: Page, selector: string): Promise<readonly string[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_22_AA).include(selector).analyze();
  return results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
}

for (const id of INTERNAL_TAB_IDS) {
  test(`${id}: no WCAG 2.2 AA violation at 1280 px`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.clock.setFixedTime(FIXTURE_NOW);
    await openDesk(page, id);
    expect(await violationsIn(page, `[data-internal-tab="${id}"]`)).toEqual([]);
  });
}

test("배송 안내 with a result and an open row: no WCAG 2.2 AA violation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, deliveredData());
  await openDesk(page, "delivery");
  await page.getByLabel("조회번호 (한 줄에 하나, 최대 20건)", { exact: true }).fill(FAKE.domestic);
  await page.getByRole("button", { name: "조회 시작", exact: true }).click();
  await page.locator(`[data-bulk-row="${FAKE.domestic}"]`).getByRole("button", { name: "화면 보기", exact: true }).click();
  await expect(page.locator(`[data-bulk-detail="${FAKE.domestic}"]`)).toBeVisible();
  expect(await violationsIn(page, '[data-internal-tab="delivery"]')).toEqual([]);
});
```

- [ ] **Step 4: Run it**

Run (port 43210 free): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npx playwright test tests/e2e/internal-a11y.spec.ts`
Expected: `5 passed`. (This is a regression net over code that already exists, so it can pass on the first run.) A violation whose target is inside an S09 file (`components/internal/*`) is fixed in this task and the run repeated; a violation inside `components/result/*` or `components/primitives/*` is reported in the stage summary to the owning stage (S07/S05) and that single node is excluded with `.exclude(<target>)` plus a comment naming the report — never a whole rule.
Run: `npm run typecheck; npm run lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```powershell
git add tests/e2e/internal-a11y.spec.ts
git commit -m "test: check the CS desk tabs with axe WCAG 2.2 AA (approval 13)"
```
If Step 2 installed the package, add `package.json package-lock.json` to the `git add` line and commit them in the same commit.

---

### Task Final: Stage gate

- [ ] **G1. Port free.** `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue` → no output (stop listeners otherwise).
- [ ] **G2. Lint.** `npm run lint` → exit 0, no errors, no warnings introduced by this stage.
- [ ] **G3. Typecheck.** `npm run typecheck` → exit 0.
- [ ] **G4. Build.** `npm run build` → exit 0. Route table: `ƒ /[trackingNumber]` always; `/` is `ƒ` in S01 (it still reads `searchParams`), `○ /` from S02 on, and `○ /` with `Revalidate 5m` from S06 on.
- [ ] **G5. Dev-mode E2E.** `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npm run test:e2e` → "N passed", 0 failed (skips allowed only for tests guarded by `PW_MODE`, `PW_SHOTS`, `PW_VISUAL`, or an approval-gated `test.skip` naming the approval).
- [ ] **G6. Production-mode E2E.** Re-run `npm run build` if `next start` reports a missing or stale build. Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait for `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` = `200`; then `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test` → 0 failed, including `tests/budgets/*`.
- [ ] **G7. After-screens.** Server still running: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='after'; $env:PW_STAGE='S09'; npx playwright test tests/tools/stage-screens.spec.ts` → PNGs in `test-results/stage-screens/S09-after/` at 320, 375, 768, 1024, 1440. Compare with `S09-before/`; send both sets to the operator with SendUserFile. Stop the server (G1 command) and clear the flags: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.
- [ ] **G8. Budgets.** Paste the measured numbers of every budget this plan lists (from the G6 output) into the stage summary. Any budget over its fail line fails the gate.
- [ ] **G9. Code review.** Invoke the `code-review` skill on `git diff claude/tipoasis-tracking-renewal-ae0e3a...HEAD`. Fix every CRITICAL and HIGH finding; if code changed, re-run G2–G6.
- [ ] **G10. Verification.** Invoke `superpowers:verification-before-completion`; paste each command and its result line into the stage summary.
- [ ] **G11. Commit.** `git status` shows only this stage's files (see the roadmap File Map). Commit any remainder with a conventional message and no attribution trailer.
- [ ] **G12. No deploy.** Do not push to `main`; do not run `vercel deploy`. Push `renewal/s09-internal-cs-tool` only if the operator asked. Hand the stage summary to the operator; merge into the integration branch only after acceptance (roadmap §5).

**S09 notes on the gate above**
- G4: the route table also lists `ƒ /internal/cs-helper` (the page reads `?tab=` since Task 8; before S09 it was `○`).
- G5 and G6, S09 files: unit — `phone-mask` 5, `bulk-lookup` 23, `preview-outcomes` 5, `notice-status` 6, `mismatch-storage` 12 (17 with Task 14); E2E — `internal-desk` 6, `internal-mismatch` 8 (11 with Task 14), `internal-bulk` 11, `internal-preview` 4, `internal-notices` 7, `internal-a11y` 5 (only with Task 15); `tests/internal-access.spec.ts` 4 and `tests/e2e/internal-isolation.spec.ts` 3 unchanged; `tests/internal-cs-helper.spec.ts` no longer exists. Every other suite keeps its Task 0 Step 6 count; `tests/unit/module-boundaries.spec.ts` and `tests/unit/real-number-guard.spec.ts` must pass.
- G7: the after-screens include `internal-delivery`, `internal-mismatch`, `internal-preview` and `internal-notices` (they have no before-screens). The PNGs land in `test-artifacts/stage-screens/S09-after/` (S01 addition 1).
- G8: paste `[budget] bulk spacing min: N ms (min 1000 ms)` (fail below 998 ms, the 2 ms timer slack) and S07's `[js-budget] …` lines next to their Task 0 Step 6 values. The desk imports `ResultView` statically (contract deviation 1); S07's budgets must still pass. If the result chunk or `/[번호]` total grew by more than 1 KB, stop and report it (open issue 1 names the fix).
- G11: `git status` shows only the files in this plan's File Structure (plus the five deletions of Task 10 and, with approval 13, `package.json`/`package-lock.json`).

---

## Open issues for the operator and later stages

1. **Static `ResultView` in the internal bundle (contract deviation 1).** If G8 shows the public result chunk or the `/[번호]` total grew after S09, the fix is to load the result module in `ScreenAndReply` through `loadResultModule()` (a `useSyncExternalStore` snapshot of the loaded module, rendering '미리보기를 준비하고 있어요.' until it resolves) and to pass `derive` into `runBulkLookup` from the loaded module; the E2E already wait for `[data-result-view]`.
2. **`tests/e2e/RULE-MAP.md` is appended by S08 and S09 in parallel.** Whichever stage merges second resolves the end-of-file conflict by keeping both sections.
3. **Approval 14 turns S01's 14-day list into a tab-only list on first open.** Staff who want the migrated drafts to survive closing the tab must tick '이 브라우저에 7일 보관' once; the tab's note says so. The operator should tell the CS team on the release day.
4. **The desk's reference time is read once per page load.** The preview uses it; the notice tab starts from it and [지금으로] takes the current time. A desk left open for days shows an old reference time in the preview until the page is reloaded.
5. **Phone-shaped lines are never looked up.** A real 10–11-digit waybill that starts with 010–019 (rare) would be listed under '번호로 읽지 못한 줄'; staff can then use the customer page directly.
6. **Leftovers outside S09's File Map:** with `components/ui/*` gone, `lib/utils.ts` (`cn`, frozen) and the packages `class-variance-authority`, `@radix-ui/react-slot`, `clsx`, `tailwind-merge` may have no remaining users, and `lucide-react` loses the desk as a user. Removing packages is a `package.json` change no stage owns; propose a cleanup after S08 deletes the last legacy components. S03's `tests/unit/module-boundaries.spec.ts` still lists `components/InternalCsHelper.tsx` as an allowed `lib/cs` importer — harmless, S03 may drop the pattern.
7. **Roadmap ledger row 13** should list "S09 Task 15 (axe on the desk)" among its gated tasks (contract deviation 2).
8. **A kept (7-day) list lives in `localStorage` of the public origin.** The ad loader never runs on `/internal`, but public pages share the origin; `docs/ops/internal-subdomain-proposal.md` describes the separation the operator can choose when a shared list is needed.
9. **Axe findings in shared components (Task 15)** are reported to S05/S07 rather than fixed here; any node excluded in `tests/e2e/internal-a11y.spec.ts` must name that report.

## Self-Review

- **Spec coverage (§10, §14, §15 R5, §16 items 13–14).** 격리 (route group, no ads/analytics/public header, basic auth, noindex/no-store/no-referrer) → unchanged S01 layout, kept green by `internal-access`/`internal-isolation` (Tasks 8–13 runs). 탭 4개 with tablist/tab/aria-selected → Task 8 (+ Tasks 11–12 extend, Task 12 pins the four spec tabs). ① 배송 안내: multi-line paste ≤ 20, carrier choice, sequential `/api/track` within 60/min, table with tone badge, title, ETA, worry date, last event, 문제/확인 필요 first, row expansion with `ResultView` at 375 px read-only → Tasks 2, 3, 10; inquiry-copy format read by the CS input → Task 2 (`parseInquiryCopy`) and Task 10 E2E. ② 통관부호 불일치: sessionStorage default, '이 브라우저에 7일 보관' with expiry, zod, auto-expiry, [전체 삭제], 010-****-1234 masking, 작성·발송·회신·완료 status → Tasks 1, 6, 9, 14 (fallback 14-day TTL kept when approval 14 is not granted). ③ 안내표 미리보기: every state with 0000 0000 0001 / TEST 0000 0001, customer screen and CS reply side by side, screenshots and axe → Tasks 4, 11, 13, 15. ④ 공지 현황: 진행·예정·만료 lists, date simulator for notices, holiday badges and overdue → Tasks 5, 12. 답변 생성: `buildCsReply` over the same view, [짧게 복사][자세히 복사][고객 링크 복사], no internal labels or follow-up promises → Task 10 (S03 owns the templates). 연결과 한계: subdomain proposal → Task 13. §14 "CS 미리보기도 같은 컴포넌트" and "InternalCsHelper는 두 컴포넌트로 나눕니다" → Tasks 8–10. Test contract item 1 (map first, new assertions pass, then remove) → Tasks 7–10, 14. Roadmap §9 budget "Bulk run respects 60/min (≥ 1000 ms spacing)" → Task 3 (exact, fake clock) and Task 10 (live page, budget line). File Map deletions (`components/InternalCsHelper.tsx`, `components/ui/{button,card,input}.tsx`, `tests/internal-cs-helper.spec.ts`) → Task 10.
- **Placeholder scan.** No "TBD", "TODO", "implement later" or "similar to Task N". Every code step gives the full file or the exact text to replace; the two steps that depend on text other stages may have shaped (the end of `SCENARIOS` in Task 13, the legacy tests' tail in Task 9) name the anchor and give a check whose output proves the edit.
- **Type consistency.** Contract names are used as written: `InternalCsDesk`, `BULK_MAX`, `BULK_MIN_INTERVAL_MS`, `BulkRow`, `parseBulkInput`, `runBulkLookup`, `sortBulkRows`, `maskPhone`, `MISMATCH_LEGACY_KEY`, `MISMATCH_TTL_DAYS`, `MismatchRecord`, `createRecordId`, `normalizePhone`, `getStoredRecordsSnapshot`, `getServerStoredRecordsSnapshot`, `subscribeStoredRecords`, `writeStoredRecords`, `clearAllStoredRecords`, `ResultView`/`ResultViewProps` (with S07's `failureCause`), `deriveResultView`, `buildCsReply`/`CsReply`, `fetchTrack`/`FetchTrackResult`, `classifyFailure`, `deriveTrackingView`, `parseInquiryCopy`, `buildInquiryCopy`, `precheckNumber`, `normalizeInput`, `groupTrackingNumber`, `activeNotices`, `pickNotice`, `NOTICE_PRIORITY`, `holidayPeriodBetween`, `kstDateKey`, `parseInstant`, `formatKstDateTime`, `formatKstDateTight`, `formatKstTime`, `addCalendarDays`, `CARRIER_NAMES`, `CONCRETE_CARRIER_CODES`, `Button`, `CopyButton`, `NumberBar`, `StatusChip`, `FAKE`, `FAKE_GROUPED`, `FIXTURE_NOW`, `mockTrack`, `successBody`, `FAILURE_RESPONSES`, `FailureFixture`, `FIXTURE_CONFIG`, `FIXTURE_NOTICES`. S09 names keep one spelling across tasks: `BulkParseResult`, `BulkRunOptions`, `BulkFetcher`, `BulkRowSummary`, `summarizeBulkView`, `TONE_LABELS`, `initialBulkRows`, `queuedRow`, `PREVIEW_NUMBERS`, `PREVIEW_DRIVER_PHONE`, `PREVIEW_OVERDUE_AGE_DAYS`, `PREVIEW_SCENARIO_IDS`, `PreviewScenarioId`, `PreviewScenario`, `buildPreviewScenario(s)`, `NoticeWindow`, `NoticeGroups`, `NoticePlacement`, `noticeWindowAt`, `groupNoticesAt`, `noticePlacementAt`, `holidayAt`, `MISMATCH_STATUSES`, `MismatchStatus`, `MISMATCH_STATUS_LABELS`, `isMismatchStatus`, `withRecordStatus`, `MISMATCH_KEY`, `MISMATCH_KEEP_DAYS`, `MismatchRetention`, `ParsedStore`, `parseStorePayload`, `serializeStorePayload`, `getRetentionSnapshot`, `getServerRetentionSnapshot`, `setKeepInBrowser`, `INTERNAL_TAB_IDS`, `InternalTabId`, `INTERNAL_TAB_LABELS`, `DEFAULT_INTERNAL_TAB`, `parseInternalTab`, `ScreenAndReply`, `BulkResultTable`, `DeliveryGuideTab`, `MismatchTab`, `MismatchRecordList`/`MismatchRecordListProps`, `PreviewTab`, `NoticeStatusTab`, `openDesk`, `recordClipboard`, `copiedTexts`, `blockClipboard`, `recordTrackStarts`, `trackStarts`. Test totals: `bulk-lookup` 14 → 23; `mismatch-storage` 8 → 12 → 17; `internal-desk` 5 → 6; `internal-mismatch` 8 → 11; `internal-cs-helper` 6 → 3 → deleted.
- **Review Focus.** (1) a pasted chat with phones → Task 2 "phone-shaped lines are rejected, never looked up", "a pasted chat keeps only the numbers …" and Task 10 "pasted inquiry copies, chat lines and bad lines"; (2) overlapping runs and [멈추기] → Task 3 "stopping mid-request …", "stopping during the wait …", "the default wait ends at once when stopped" and Task 10 "a new run replaces the previous one …", "at most 20 numbers run, and [멈추기] stops the rest"; (3) a staff PC outside KST → Task 12 "a browser in America/New_York › still simulates Korean time" (and Task 5's UTC-day holiday row); (4) a refused clipboard → Task 10 "blocked clipboard: [짧게 복사] leaves the reply in a selected box"; (5) old or damaged drafts → Task 6 "records saved before statuses existed …", "an unknown status drops the record", S01's garbage rows (kept green), Task 14 "a kept payload is valid until keepUntil and gone at keepUntil", "a v1 payload, garbage or nothing is not a v2 list", "a kept list is deleted once its 7 days are over". The roadmap assigns no Review Focus line to S09.
