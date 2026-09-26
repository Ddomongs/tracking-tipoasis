# Design Tokens and Common Primitives (default style `signal`) — Stage S05 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the renewal one token architecture scoped by `html[data-style]` with the default style B "색면 신호" (`signal`), the Tailwind `tt-*` mapping, the signal fonts, eleven common primitives with the contract's DOM hooks, an internal gallery at `/internal/ui-kit`, and a rewritten `DESIGN.md` + `design-system/` bundle that are checked against the tokens.

**Architecture:** `app/styles/tokens.css` defines every contract token for `signal` under `:root, [data-style="signal"]` and the signal look of the four variant slots (`status-head`, `eta`, `journey`, `button`) keyed only by `data-*` attributes, so S08 can add `manifest`/`night` by adding token sets and slot overrides without touching components. `lib/style/tokens.ts` mirrors the color values for contrast tests and the gallery; `tests/unit/tokens.spec.ts` keeps CSS, TS, Tailwind, `DESIGN.md` and `design-system/_base.css` in parity. Primitives in `components/primitives/` are server-safe (except `CopyButton`), render only view-model strings plus the few fixed labels the spec gives, and never create live regions.

**Tech Stack:** Next.js 16.3.6 App Router (Turbopack), React 19.3, TypeScript strict, Tailwind CSS 3.4, `next/font/google` (DM Mono 500 latin), Playwright 1.55 (the only test runner; unit tests are Playwright tests without `page`).

**Spec:** `docs/superpowers/specs/2026-09-26-tracking-renewal-ia-design.md` — §6 (result area, spine, ETA), §8 (placement), §12 (accessibility/performance budgets), §13 (visual direction, selectable styles, B supplements), §16 items 9 and 13. **Roadmap and shared contract:** `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §11 (names, paths, hooks, keys, fixtures are used exactly as written there). **Phase 3 canvases (style B source):** `C:/Users/sos84/AppData/Local/Temp/claude/C--Users-sos84-OneDrive-------------04------01------------05----------------claude-worktrees-tipoasis-tracking-renewal-ae0e3a/3566a5b8-54f5-4bd4-bd54-e5e56b713935/scratchpad/phase3/B/project/Main.dc.html` (tokens, contrast, type scale, spine, chips, buttons, motion, font plan) and `m01-home` … `m09-transit-scroll.dc.html` (markup).

**Depends on:** S01 (R0 urgent fixes), S02 (R1 number protection — `lib/clipboard.ts`), S03 (R2 state core — `lib/tracking/types.ts`, `lib/tracking/number-format.ts`, `config/site.config.ts`).
**Gated by:** approval 9 (definitive disclosure wording — Task 15), approval 13 (`@axe-core/playwright` — Task 16).
**Release / order:** R3, user order #1. Branch `renewal/s05-design-tokens-common`.

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

**Stage-specific (S05)**
- S05 does not restyle the legacy UI. It never edits `app/globals.css` or any legacy component; `app/styles/tokens.css` only declares `--tt-*` variables and rules keyed by `[data-slot]`, `[data-status-chip]`, `[data-spine-part]`, `[data-eta-dday]`, `[data-affiliate-disclosure]` and the `.tt-focus` class, none of which the legacy UI uses. Legacy colors stay until S06.
- S05 never edits `components/primitives/LiveAnnouncer.tsx` (S04). Primitives never render `aria-live`, `role="status"`, `role="alert"` or `<output>`; announcements are the caller's job (e.g. through `CopyButton`'s `onCopied`).
- The only customer-facing strings the primitives own are the spec's: '조회번호', '배송 여정 4구간', '해외 출발' '입항·통관' '국내 배송' '도착', '위치 확인 전', '인계 대기', '안내', the suffix ' 새 창으로 열기', and the prefix 'D-'. Every other string comes from view models or `config/site.config.ts`. Strings inside `/internal/ui-kit` are internal gallery captions.
- No existing E2E assertion is changed by this stage. S01's `tests/budgets/font-preload.spec.ts` is extended (new `describe` block), never edited in place. There is therefore no rule→assertion migration in S05.
- No real tracking numbers anywhere (code, tests, docs, `design-system/`): digits only from `0000…`, `ABCD 0000 0000`, `TEST 0000 0001` style values; tests take numbers from `tests/fixtures/tracking-fixtures.ts`.
- Earlier stages' documented deviations this plan follows: S01 Addition 1 (stage screens in `test-artifacts/stage-screens/S05-<before|after>/`, Task 0 Step 5 and G7); S03 additions 4 and 5 (`EtaView` `holidayAffected.holidayName` is required; the `today` view's `label` is '오늘 예상' — Task 8 gallery data and test); S03 addition 11 (`app/layout.tsx` only calls `getSiteConfig()`, which logs the holiday warnings itself — Task 4); S02's `copyText` tries the Clipboard API, then `document.execCommand("copy")`, and never rejects (Task 12's `blockClipboard` stubs both paths). S04 deviation 1 / S07 deviation 10 (approval-3 fallback as a view transform: 톡톡 stays the filled primary on error screens) needs no primitive change: `TalkLink` `weight="primary"` and `CopyButton` `variant="primary"` already exist (gallery demos `talk-primary`, `copy-and-open`).

## Review Focus

Conditions the spec implies but no rule names; the pinning test is added to the owning task.

1. **In-app browsers that block the clipboard** (Naver/Kakao webviews: `navigator.clipboard.writeText` rejects, or `navigator.clipboard` is missing, and `document.execCommand('copy')` returns `false`): `CopyButton` must never throw, must show a read-only selectable `<textarea>` holding the exact text with the text pre-selected, and `copyAndOpen` must still open the 톡톡 tab. Owner: Task 12 (`tests/e2e/ui-kit.spec.ts` "falls back …" ×2 and "copyAndOpen … fallback").
2. **Very long numbers at 320 px** (18-digit cargo number, 30-character HBL): the number bar keeps every group intact, wraps only between groups, never truncates, never scrolls horizontally, and the actions drop below the number. Owner: Task 9 ("long numbers wrap between groups at 320 px").
3. **Primitives placed on a tone field instead of a white surface** (secondary button, text button, 톡톡 link, chip, spine, ETA badge, notice line, disclosure inside an amber/red/green field): text and focus ring switch to the field's on-color, every text stays ≥ 4.5:1 and every focus ring ≥ 3:1, and `--tt-muted` never appears on a field. Owner: Task 5 generic tests ("every text …", "every focusable …") exercised by the in-field demos of Tasks 6–11.
4. **A store view whose disclosure disagrees with its links** (an affiliate link arriving with `disclosure: null`, or a disclosure string with only non-affiliate links): `isAffiliate` alone decides — disclosure rendered first when any link is affiliate, none otherwise; `rel` contains `sponsored nofollow` exactly for affiliate links. Owner: Task 10 ("affiliate groups …").
5. **Windows High Contrast / forced colors** (`forced-colors: active` drops background colors): the spine's done/current bars and the status chips must stay visible (bars keep a `CanvasText` fill, chips get a border). Owner: Tasks 6 and 7 ("forced colors …").

## Additions to the contract

Everything below is additive; no §11 name is renamed. Each item is reported in the stage summary as a contract deviation so the roadmap can be amended (§5 "Contract changes").

1. **`lib/style/tokens.ts` extra exports:** `export const NON_COLOR_TOKENS` (the 27 non-color token names of §11.12, in that order) and `export type NonColorToken`; `export interface ContrastRequirement { readonly fg: ColorToken; readonly bg: ColorToken; readonly min: 3 | 4.5 }`; `export function relativeLuminance(hex: string): number`; `export function contrastRatio(foreground: string, background: string): number` (WCAG 2.x; `#RRGGBB` only, throws otherwise). S08 uses `NON_COLOR_TOKENS` and `contrastRatio` in its `tokens.spec.ts` additions.
2. **`components/primitives/Button.tsx` extra exports:** `export type ButtonVariant = "primary" | "secondary" | "text"`, `export type ButtonSize = "md" | "lg"`, `export type ButtonProps`, `export function buttonClassName(variant: ButtonVariant, size: ButtonSize, extra?: string): string` — later stages use `buttonClassName` to give non-button elements (e.g. radio-chip labels, `<summary>`) the same slot look. **`CopyButton.tsx`:** `export type CopyButtonProps`.
3. **Weight hook (test-selectable):** every `data-slot="button"` element (`Button`, `ButtonLink`, `TalkLink`, `CopyButton`'s trigger) carries `data-variant` (`primary|secondary|text`) equal to the action weight it renders (`ActionWeight`). Later stages assert "one filled primary per screen" and action weights through `[data-slot="button"][data-variant=…]` (S07's result tests and its migration of S04's `data-action-weight` assertions), so the attribute and its three values are part of the contract (roadmap §11.13); S08's per-style CSS may style it but never changes or removes it. **Styling hooks (for S08's per-style CSS; not for tests of business rules):** on `data-slot="button"` elements `data-size` (`md|lg`); inside `JourneySpine` `data-spine-part="track|bar|label|issue|name|sub|unknown"`; inside `EtaDisplay` `data-eta-label`, `data-eta-value`, `data-eta-visual`, `data-eta-dday`, `data-eta-badge`, `data-eta-caption`, `data-eta-text`, and `data-eta-digit` whose value is the digit itself; `data-tone-icon` on `ToneIcon`'s `<svg>` (tone or issue name); `data-notice-variant` (`banner|inline`) on `NoticeBanner`; `data-number-bar-value` / `data-number-bar-actions` inside `NumberBar`; `data-copy-fallback` on `CopyButton`'s fallback `<textarea>`. Gallery-only: `data-ui-kit` on the gallery `<main>`, `data-demo`, `data-copy-text`, `data-copy-outcome`.
4. **Slot CSS contract:** the element with `data-slot="status-head"` must also carry `data-tone` (`Tone`); tokens.css paints it as the signal color field (padding `16px var(--tt-gutter) 20px`, flex column, gap 16 px) and exposes the component variables `--field-bg`/`--field-fg`; component variables `--journey-fill`, `--journey-todo`, `--journey-on-fill`, `--chip-bg`, `--chip-fg`, `--eta-badge-bg`, `--eta-badge-fg` are not style tokens (they are derived from tokens). `.tt-focus` is the one focus-ring class (3 px `--tt-focus`, offset 2 px; `--field-fg` inside a field). `@keyframes tt-grow` is the spine's one-shot grow. The reduced-motion override is declared under `:root, [data-style][data-style]` so a style file cannot re-enable motion.
5. **`--tt-status-field-max` meaning:** 300 px = the maximum height of `[data-slot="status-head"]` at 375×812 so that `[data-cta-state]` starts at ≤ 420 px (48 header + 56 number bar + 300 field + 16 gap). It is a layout budget, not a `max-height` (clipping would break 1.4.4/1.4.10). S07's result-layout test measures against it.
6. **Tailwind:** `transitionTimingFunction.tt` → class `ease-tt` (`var(--tt-ease)`), in addition to the §11.12 keys. `fontSize.tt-*` entries carry line heights (18/20/24/28/32 px, 1.1 for `tt-eta`).
7. **Fonts:** `next/font` exposes DM Mono through the CSS variable `--font-dm-mono` on `<html>`; `--tt-font-mono` is `var(--font-dm-mono, "DM Mono"), ui-monospace, …`.
8. **File Map addition:** `app/(internal)/internal/ui-kit/UiKitInteractive.tsx` — C S05 (client island of the gallery for `CopyButton` demos; S08 may add its style-switcher demo here).
9. **`EtaDisplay` text source:** it renders only `EtaView` strings plus the literal prefix 'D-'; '오늘 예상' reaches the screen through the `today` view's `label` (S03 addition 5: `label = resultCopy.etaTodayLabel`, `caption` stays the secondary line such as '통관 완료 예상 9월 26일 (토)' or `null`). S03 addition 4 (`holidayAffected.holidayName`) is not rendered by `EtaDisplay`; the badge carries the visible sentence.

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `lib/style/styles.ts` | Create | Style ids, customer labels, default/dark ids, storage key, implemented list, `isStyleId` |
| `lib/style/tokens.ts` | Create | Color token names, signal color values, non-color token names, contrast requirements, WCAG contrast helpers |
| `app/styles/tokens.css` | Create | Signal token block, reduced-motion override, focus ring, signal slot CSS (status-head, chip, journey, eta), forced-colors fixes |
| `tailwind.config.ts` | Modify (whole file) | `tt-*` color/font/size/radius/duration keys → CSS variables; legacy color keys removed |
| `app/layout.tsx` | Modify | `data-style="signal"`, tokens.css import, DM Mono 500 latin (preloaded), IBM Plex removed, `font-tt-body` |
| `components/primitives/Button.tsx` | Create | `<button data-slot="button">`, `buttonClassName` |
| `components/primitives/ButtonLink.tsx` | Create | `<a data-slot="button">`, new-window name and `rel` |
| `components/primitives/ToneIcon.tsx` | Create | aria-hidden SVG per tone / issue |
| `components/primitives/StatusChip.tsx` | Create | `<span data-status-chip data-tone>` |
| `components/primitives/JourneySpine.tsx` | Create | 4-station `<ol>` with one `aria-current=step` |
| `components/primitives/EtaDisplay.tsx` | Create | ETA slot: sr-only date label + aria-hidden digits |
| `components/primitives/NumberBar.tsx` | Create | Grouped monospace number, carrier label, wrapping actions |
| `components/primitives/CopyButton.tsx` | Create (client) | Copy / copy-and-open with selectable fallback |
| `components/primitives/AffiliateLinkGroup.tsx` | Create | Disclosure-first store link group |
| `components/primitives/NoticeBanner.tsx` | Create | Banner / in-card '안내' line, never live |
| `components/primitives/TalkLink.tsx` | Create | The one 톡톡 link style at three weights |
| `app/(internal)/internal/ui-kit/page.tsx` | Create | Server gallery of tokens and primitives |
| `app/(internal)/internal/ui-kit/UiKitInteractive.tsx` | Create (client) | Copy demos |
| `tests/unit/tokens.spec.ts` | Create | Style ids, contrast, supplements, CSS/TS/Tailwind/docs parity |
| `tests/e2e/ui-kit.spec.ts` | Create | Layout wiring and primitive behavior in the gallery |
| `tests/budgets/font-preload.spec.ts` | Modify (append) | First-view font bytes, one DM Mono preload, no IBM Plex |
| `DESIGN.md` | Modify (rewrite) | Single design source |
| `design-system/README.md`, `_base.css`, `foundations/{colors,spacing,typography}.html`, `components/{buttons,cards,customer-cta,status,tracking-form}.html` | Modify (rewrite) | Preview bundle from tokens |
| `design-system/components/journey-spine.html` | Create | Spine preview |
| `package.json`, `package-lock.json` | Modify (Task 16 only, approval 13) | `@axe-core/playwright` dev dependency |

**Budgets this stage owns (paste measured values into the stage summary at G8):** token contrast (text ≥ 4.5:1, UI/focus ≥ 3:1, `tokens.spec.ts`); no text ≤ 11 px in the ui-kit; first-view fonts ≤ 100 KB and ≤ 2 preloads on `/` and `/{번호}` (`font-preload.spec.ts`, production only); `--tt-status-field-max` demo ≤ 300 px at 375×812.

**Commands used throughout (PowerShell 5.1, repo root):**
- Unit tests (no web server): `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/tokens.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
- Gallery E2E (Playwright starts `next dev` on 43210): `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts`
- Paths containing parentheses or brackets are always quoted in `git add`.

---

### Task 0: Stage start

- [ ] **Step 1: Read approvals.** Open `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §4. For every approval number in this plan's "Gated by" list, write its Status into the stage summary. `pending`/`rejected` → execute the fallback steps and mark the gated task SKIPPED with the reason.
- [ ] **Step 2: Confirm dependencies.** Run (PowerShell): `git log --oneline claude/tipoasis-tracking-renewal-ae0e3a -40`
  Expected: a `merge: SNN …` commit for every stage in this plan's "Depends on" list.
- [ ] **Step 3: Branch.** Run: `git switch -c renewal/s05-design-tokens-common claude/tipoasis-tracking-renewal-ae0e3a`
  Expected: `Switched to a new branch 'renewal/s05-design-tokens-common'`.
- [ ] **Step 4: Port free.** Run: `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue`
  Expected: no output. Otherwise stop the listener: `Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`
- [ ] **Step 5: Baseline build and before-screens.** Run `npm ci` only if `package-lock.json` changed since the last install in this worktree, then `npm run build`.
  Expected: build exits 0. Start the production server in a background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`
  Wait until `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` prints `200`.
  Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='before'; $env:PW_STAGE='S05'; npx playwright test tests/tools/stage-screens.spec.ts`
  Expected: PNGs in `test-artifacts/stage-screens/S05-before/` for widths 320, 375, 768, 1024, 1440. (S01 creates the tool first; S01 runs this step after its Task 1.)
- [ ] **Step 6: Baseline suite.** With the server still running: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test`
  Expected: record "N passed / M skipped / 0 failed" in the stage summary. Then stop the server (Step 4 command) and clear the flags: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.

**S05 note on the standard steps above:** Step 5 and gate G7 name `test-artifacts/stage-screens/S05-<before|after>/` instead of the roadmap's `test-results/stage-screens/…` (S01 Addition 1: `tests/tools/stage-screens.spec.ts` writes outside `test-results/`, which Playwright empties at the start of every run, so Step 6 would otherwise delete the before-set). Check the count after Step 5: `(Get-ChildItem test-artifacts/stage-screens/S05-before -Filter *.png).Count` prints the number of scenarios × 5.

- [ ] **Step 7 (stage-specific): Dependency artifacts exist.** Run:
  `Test-Path lib/clipboard.ts, lib/site.ts, lib/tracking/types.ts, lib/tracking/time.ts, lib/tracking/number-format.ts, lib/tracking/inquiry-copy.ts, config/site.config.ts, tests/fixtures/tracking-fixtures.ts, tests/support/prod-mode.ts, tests/budgets/font-preload.spec.ts, tests/unit/module-boundaries.spec.ts, "app/(internal)/layout.tsx"`
  Expected: twelve lines `True`. Any `False` → stop; the missing file belongs to S01/S02/S03 and that stage is not merged.
- [ ] **Step 8 (stage-specific): Record the inherited files.** Run: `Get-Content app/layout.tsx; Get-Content tests/budgets/font-preload.spec.ts | Select-Object -First 20`
  Expected: `app/layout.tsx` imports only `IBM_Plex_Sans_KR` from `next/font/google` (S01 dropped Space Grotesk and set `preload: false`), has no AdSense `<Script>` (S01 moved it to `app/(public)/layout.tsx`), and calls `getSiteConfig()` (S03). Note in the stage summary which import lines `font-preload.spec.ts` already has (S01 Task 5 ships `import { expect, test } from "@playwright/test";`, `IS_PRODUCTION_RUN` and `FAKE`; no `Page`/`Response` types, no `mockTrack`/`trackData`) — Task 4 Step 2 merges the missing names into them.

---

### Task 1: Style ids and signal color tokens (TypeScript)

**Files:**
- Create: `lib/style/styles.ts`
- Create: `lib/style/tokens.ts`
- Test: `tests/unit/tokens.spec.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces (roadmap §11.9 + Additions 1): `STYLE_IDS`, `StyleId`, `DEFAULT_STYLE_ID` (`"signal"`), `DARK_STYLE_ID` (`"night"`), `STYLE_STORAGE_KEY` (`"tt:style"`), `STYLE_LABELS`, `IMPLEMENTED_STYLE_IDS` (`["signal"]`), `isStyleId(value: unknown): value is StyleId`; `COLOR_TOKENS`, `ColorToken`, `ColorTokenSet`, `STYLE_COLOR_TOKENS` (`{ signal }`), `CONTRAST_REQUIREMENTS`, `ContrastRequirement`, `NON_COLOR_TOKENS`, `NonColorToken`, `relativeLuminance(hex: string): number`, `contrastRatio(foreground: string, background: string): number`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/tokens.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import {
  DARK_STYLE_ID,
  DEFAULT_STYLE_ID,
  IMPLEMENTED_STYLE_IDS,
  STYLE_IDS,
  STYLE_LABELS,
  STYLE_STORAGE_KEY,
  isStyleId
} from "@/lib/style/styles";
import {
  COLOR_TOKENS,
  CONTRAST_REQUIREMENTS,
  NON_COLOR_TOKENS,
  STYLE_COLOR_TOKENS,
  contrastRatio,
  type ColorTokenSet
} from "@/lib/style/tokens";

const HEX_COLOR = /^#[0-9A-F]{6}$/;
const TONES = ["progress", "waiting", "attention", "problem", "done"] as const;

function implementedColorSets(): ReadonlyArray<readonly [string, ColorTokenSet]> {
  return IMPLEMENTED_STYLE_IDS.map((id) => {
    const set = STYLE_COLOR_TOKENS[id];
    if (!set) throw new Error(`style "${id}" is implemented but has no color tokens`);
    return [id, set] as const;
  });
}

function signalColors(): ColorTokenSet {
  const set = STYLE_COLOR_TOKENS.signal;
  if (!set) throw new Error("signal color tokens are missing");
  return set;
}

function hsl(hex: string): { readonly hue: number; readonly saturation: number; readonly lightness: number } {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { hue: 0, saturation: 0, lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue *= 60;
  return { hue: hue < 0 ? hue + 360 : hue, saturation, lightness };
}

function isRed(hex: string): boolean {
  const { hue, saturation, lightness } = hsl(hex);
  return saturation >= 0.35 && lightness > 0.15 && lightness < 0.85 && (hue <= 15 || hue >= 345);
}

test.describe("style ids", () => {
  test("lists the three styles with customer labels and signal as the default", () => {
    expect(STYLE_IDS).toEqual(["signal", "manifest", "night"]);
    expect(STYLE_LABELS).toEqual({ signal: "기본", manifest: "서류형", night: "어두운 화면" });
    expect(DEFAULT_STYLE_ID).toBe("signal");
    expect(DARK_STYLE_ID).toBe("night");
    expect(STYLE_STORAGE_KEY).toBe("tt:style");
  });

  test("implements only signal in S05", () => {
    expect(IMPLEMENTED_STYLE_IDS).toEqual(["signal"]);
  });

  test("isStyleId accepts exactly the three ids", () => {
    for (const id of STYLE_IDS) expect(isStyleId(id)).toBe(true);
    for (const value of ["", "Signal", "dark", "tt:style", null, undefined, 1, {}]) expect(isStyleId(value)).toBe(false);
  });
});

test.describe("color tokens", () => {
  test("names the 30 color tokens and 27 non-color tokens of the contract once each", () => {
    expect(COLOR_TOKENS).toHaveLength(30);
    expect(new Set(COLOR_TOKENS).size).toBe(30);
    expect(NON_COLOR_TOKENS).toHaveLength(27);
    expect(new Set(NON_COLOR_TOKENS).size).toBe(27);
  });

  test("every implemented style defines every color token as #RRGGBB", () => {
    for (const [id, set] of implementedColorSets()) {
      expect(Object.keys(set).sort(), id).toEqual([...COLOR_TOKENS].sort());
      for (const token of COLOR_TOKENS) expect(set[token], `${id} ${token}`).toMatch(HEX_COLOR);
    }
  });

  test("the contrast requirement list is exactly the contract's", () => {
    const expected = [
      "--tt-ink|--tt-surface|4.5",
      "--tt-ink|--tt-ground|4.5",
      "--tt-muted|--tt-surface|4.5",
      "--tt-muted|--tt-ground|4.5",
      "--tt-link|--tt-surface|4.5",
      "--tt-link|--tt-ground|4.5",
      "--tt-on-primary|--tt-primary|4.5",
      "--tt-board|--tt-tile|4.5",
      "--tt-control|--tt-surface|3",
      "--tt-route|--tt-surface|3",
      "--tt-focus|--tt-surface|3",
      "--tt-focus|--tt-ground|3",
      ...TONES.flatMap((tone) => [`--tt-tone-${tone}-on|--tt-tone-${tone}|4.5`, `--tt-tone-${tone}-ink|--tt-surface|4.5`])
    ];
    const actual = CONTRAST_REQUIREMENTS.map(({ fg, bg, min }) => `${fg}|${bg}|${min}`);
    expect([...actual].sort()).toEqual([...expected].sort());
  });

  test("every implemented style meets every contrast requirement", () => {
    const failures: string[] = [];
    for (const [id, set] of implementedColorSets()) {
      for (const { fg, bg, min } of CONTRAST_REQUIREMENTS) {
        const ratio = contrastRatio(set[fg], set[bg]);
        if (ratio < min) failures.push(`${id}: ${fg} on ${bg} = ${ratio.toFixed(2)} < ${min}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("contrastRatio follows the WCAG 2.x formula", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBe(1);
    expect(contrastRatio("#2244D1", "#FFFFFF")).toBeCloseTo(7.46, 1);
    expect(() => contrastRatio("#FFF", "#000000")).toThrow("#RRGGBB");
  });
});

test.describe("signal supplements (spec §13)", () => {
  test("'확인 필요' is an amber field with ink text", () => {
    const signal = signalColors();
    expect(signal["--tt-tone-attention-on"]).toBe(signal["--tt-ink"]);
    const { hue } = hsl(signal["--tt-tone-attention"]);
    expect(hue).toBeGreaterThanOrEqual(35);
    expect(hue).toBeLessThanOrEqual(55);
  });

  test("red is used only for '문제'", () => {
    const signal = signalColors();
    const redTokens = COLOR_TOKENS.filter((token) => isRed(signal[token]));
    expect(redTokens).toEqual(["--tt-tone-problem", "--tt-tone-problem-ink"]);
  });

  test("the link color is separate from the '정상 진행' tone and the accent", () => {
    const signal = signalColors();
    expect(signal["--tt-link"]).not.toBe(signal["--tt-tone-progress"]);
    expect(signal["--tt-link"]).not.toBe(signal["--tt-accent"]);
  });

  test("the five tone fills are distinct colors", () => {
    const signal = signalColors();
    const fills = TONES.map((tone) => signal[`--tt-tone-${tone}`]);
    expect(new Set(fills).size).toBe(5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/tokens.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: FAIL — `Error: Cannot find module '@/lib/style/styles'` (no tests run).

- [ ] **Step 3: Write `lib/style/styles.ts`**

```ts
/**
 * Screen styles the customer can pick (spec §13). S05 implements only the default,
 * "signal" (B 색면 신호); S08 adds "manifest" and "night" and widens IMPLEMENTED_STYLE_IDS.
 */
export const STYLE_IDS = ["signal", "manifest", "night"] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const DEFAULT_STYLE_ID: StyleId = "signal";
export const DARK_STYLE_ID: StyleId = "night";

/** localStorage key (S08 reads/writes it; never sent to a server). */
export const STYLE_STORAGE_KEY = "tt:style";

export const STYLE_LABELS: Readonly<Record<StyleId, string>> = {
  signal: "기본",
  manifest: "서류형",
  night: "어두운 화면"
};

export const IMPLEMENTED_STYLE_IDS: readonly StyleId[] = ["signal"];

export function isStyleId(value: unknown): value is StyleId {
  return typeof value === "string" && (STYLE_IDS as readonly string[]).includes(value);
}
```

- [ ] **Step 4: Write `lib/style/tokens.ts`**

```ts
import type { StyleId } from "./styles";

/** The 30 color custom properties every style defines (roadmap §11.12). */
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
export type ColorTokenSet = Readonly<Record<ColorToken, string>>;

/** The 27 non-color custom properties every style defines (roadmap §11.12, same order). */
export const NON_COLOR_TOKENS = [
  "--tt-font-body", "--tt-font-display", "--tt-font-mono", "--tt-weight-display",
  "--tt-text-xs", "--tt-text-sm", "--tt-text-md", "--tt-text-lg", "--tt-text-xl", "--tt-text-eta",
  "--tt-leading-tight", "--tt-leading-body", "--tt-radius-button", "--tt-radius-card", "--tt-border-button",
  "--tt-focus-width", "--tt-focus-offset", "--tt-motion-fast", "--tt-motion-base", "--tt-motion-slow", "--tt-ease",
  "--tt-gutter", "--tt-header-h", "--tt-column", "--tt-side", "--tt-status-field-max", "--tt-anchor-reserve"
] as const;
export type NonColorToken = (typeof NON_COLOR_TOKENS)[number];

/**
 * Style B "색면 신호" (Phase 3 canvas B, Main.dc.html) plus the §13 supplements:
 * '확인 필요' is amber with ink text, red only for '문제', links are ink + underline
 * (separate from the '정상 진행' blue). Keep in sync with app/styles/tokens.css.
 */
const SIGNAL_COLORS: ColorTokenSet = {
  "--tt-ground": "#EEEDE8",
  "--tt-surface": "#FFFFFF",
  "--tt-raised": "#FFFFFF",
  "--tt-ink": "#111110",
  "--tt-muted": "#5C5B56",
  "--tt-rule": "#D3D2CB",
  "--tt-control": "#767570",
  "--tt-route": "#85847E",
  "--tt-primary": "#111110",
  "--tt-on-primary": "#FFFFFF",
  "--tt-accent": "#2244D1",
  "--tt-link": "#111110",
  "--tt-focus": "#111110",
  "--tt-tile": "#FFFFFF",
  "--tt-board": "#111110",
  "--tt-tone-progress": "#2244D1",
  "--tt-tone-progress-on": "#FFFFFF",
  "--tt-tone-progress-ink": "#2244D1",
  "--tt-tone-waiting": "#CFCEC6",
  "--tt-tone-waiting-on": "#111110",
  "--tt-tone-waiting-ink": "#5C5B56",
  "--tt-tone-attention": "#F4BC00",
  "--tt-tone-attention-on": "#111110",
  "--tt-tone-attention-ink": "#8A5A00",
  "--tt-tone-problem": "#C8261D",
  "--tt-tone-problem-on": "#FFFFFF",
  "--tt-tone-problem-ink": "#C8261D",
  "--tt-tone-done": "#0B6B3E",
  "--tt-tone-done-on": "#FFFFFF",
  "--tt-tone-done-ink": "#0B6B3E"
};

export const STYLE_COLOR_TOKENS: Readonly<Partial<Record<StyleId, ColorTokenSet>>> = {
  signal: SIGNAL_COLORS
};

export interface ContrastRequirement {
  readonly fg: ColorToken;
  readonly bg: ColorToken;
  readonly min: 3 | 4.5;
}

/**
 * Checked for every implemented style. The 3:1 focus ring on tone fields uses
 * tone-X-on on tone-X, which the 4.5:1 rows already cover.
 */
export const CONTRAST_REQUIREMENTS: readonly ContrastRequirement[] = [
  { fg: "--tt-ink", bg: "--tt-surface", min: 4.5 },
  { fg: "--tt-ink", bg: "--tt-ground", min: 4.5 },
  { fg: "--tt-muted", bg: "--tt-surface", min: 4.5 },
  { fg: "--tt-muted", bg: "--tt-ground", min: 4.5 },
  { fg: "--tt-link", bg: "--tt-surface", min: 4.5 },
  { fg: "--tt-link", bg: "--tt-ground", min: 4.5 },
  { fg: "--tt-on-primary", bg: "--tt-primary", min: 4.5 },
  { fg: "--tt-tone-progress-on", bg: "--tt-tone-progress", min: 4.5 },
  { fg: "--tt-tone-waiting-on", bg: "--tt-tone-waiting", min: 4.5 },
  { fg: "--tt-tone-attention-on", bg: "--tt-tone-attention", min: 4.5 },
  { fg: "--tt-tone-problem-on", bg: "--tt-tone-problem", min: 4.5 },
  { fg: "--tt-tone-done-on", bg: "--tt-tone-done", min: 4.5 },
  { fg: "--tt-tone-progress-ink", bg: "--tt-surface", min: 4.5 },
  { fg: "--tt-tone-waiting-ink", bg: "--tt-surface", min: 4.5 },
  { fg: "--tt-tone-attention-ink", bg: "--tt-surface", min: 4.5 },
  { fg: "--tt-tone-problem-ink", bg: "--tt-surface", min: 4.5 },
  { fg: "--tt-tone-done-ink", bg: "--tt-surface", min: 4.5 },
  { fg: "--tt-board", bg: "--tt-tile", min: 4.5 },
  { fg: "--tt-control", bg: "--tt-surface", min: 3 },
  { fg: "--tt-route", bg: "--tt-surface", min: 3 },
  { fg: "--tt-focus", bg: "--tt-surface", min: 3 },
  { fg: "--tt-focus", bg: "--tt-ground", min: 3 }
];

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function linearChannel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance of a #RRGGBB color. */
export function relativeLuminance(hex: string): number {
  if (!HEX_COLOR.test(hex)) throw new Error(`Expected a #RRGGBB color, got "${hex}"`);
  const r = linearChannel(Number.parseInt(hex.slice(1, 3), 16));
  const g = linearChannel(Number.parseInt(hex.slice(3, 5), 16));
  const b = linearChannel(Number.parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio (1–21), independent of argument order. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/tokens.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `12 passed`.

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck`
Expected: exit 0.
Run: `git add lib/style/styles.ts lib/style/tokens.ts tests/unit/tokens.spec.ts; git commit -m "feat: add screen style ids and signal color tokens"`

---

### Task 2: `app/styles/tokens.css` — signal token block and reduced motion

**Files:**
- Create: `app/styles/tokens.css`
- Test: `tests/unit/tokens.spec.ts` (append)

**Interfaces:**
- Consumes: `COLOR_TOKENS`, `NON_COLOR_TOKENS`, `STYLE_COLOR_TOKENS` (Task 1).
- Produces: every §11.12 custom property on `:root` and `[data-style="signal"]`; motion tokens forced to `0ms` under `prefers-reduced-motion: reduce` via `:root, [data-style][data-style]`.

- [ ] **Step 1: Write the failing test**

Add these imports at the top of `tests/unit/tokens.spec.ts` (below the existing imports):

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
```

Append to the end of `tests/unit/tokens.spec.ts`:

```ts
const REPO_ROOT = path.resolve(__dirname, "../..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function declarations(block: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of block.matchAll(/(--tt-[a-z0-9-]+)\s*:\s*([^;]+);/g)) map.set(match[1], match[2].trim());
  return map;
}

function signalBlock(css: string): Map<string, string> {
  const match = css.match(/:root,\s*\[data-style="signal"\]\s*\{([^}]*)\}/);
  if (!match) throw new Error('app/styles/tokens.css has no ":root, [data-style=\\"signal\\"]" block');
  return declarations(match[1]);
}

function pixels(value: string | undefined): number {
  if (!value || !/^\d+(\.\d+)?px$/.test(value)) throw new Error(`expected a px value, got "${value}"`);
  return Number.parseFloat(value);
}

function milliseconds(value: string | undefined): number {
  if (!value || !/^\d+ms$/.test(value)) throw new Error(`expected a ms value, got "${value}"`);
  return Number.parseFloat(value);
}

test.describe("tokens.css (signal)", () => {
  test("declares every contract token with the TypeScript color values and nothing else", () => {
    const block = signalBlock(readRepoFile("app/styles/tokens.css"));
    const signal = signalColors();
    for (const token of COLOR_TOKENS) expect(block.get(token)?.toUpperCase(), token).toBe(signal[token]);
    for (const token of NON_COLOR_TOKENS) expect(block.has(token), token).toBe(true);
    const known = new Set<string>([...COLOR_TOKENS, ...NON_COLOR_TOKENS]);
    expect([...block.keys()].filter((name) => !known.has(name))).toEqual([]);
  });

  test("non-color signal values follow the spec's type, focus, motion and layout budgets", () => {
    const block = signalBlock(readRepoFile("app/styles/tokens.css"));
    expect(["--tt-text-xs", "--tt-text-sm", "--tt-text-md", "--tt-text-lg", "--tt-text-xl"].map((t) => pixels(block.get(t)))).toEqual([
      12, 14, 16, 20, 24
    ]);
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
    expect(pixels(block.get("--tt-radius-button"))).toBe(0);
    expect(pixels(block.get("--tt-border-button"))).toBe(2);
    expect(block.get("--tt-font-mono")).toContain("var(--font-dm-mono");
    expect(block.get("--tt-font-body")).not.toMatch(/IBM Plex|Space Grotesk/);
  });

  test("reduced motion sets every motion token to 0ms with a selector style files cannot outrank", () => {
    const css = readRepoFile("app/styles/tokens.css");
    const match = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*:root,\s*\[data-style\]\[data-style\]\s*\{([^}]*)\}/);
    expect(match, "reduced-motion block").not.toBeNull();
    const block = declarations(match ? match[1] : "");
    expect(block.get("--tt-motion-fast")).toBe("0ms");
    expect(block.get("--tt-motion-base")).toBe("0ms");
    expect(block.get("--tt-motion-slow")).toBe("0ms");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/tokens.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: 3 FAIL with `ENOENT: no such file or directory, open '…app\styles\tokens.css'`; the 12 Task 1 tests pass.

- [ ] **Step 3: Create `app/styles/tokens.css`**

```css
/*
 * 화면 스타일 토큰 — signal(기본, B 색면 신호)
 * - 기준 문서: DESIGN.md 3장. 색 값은 lib/style/tokens.ts, DESIGN.md, design-system/_base.css 와 같아야 하고
 *   tests/unit/tokens.spec.ts 가 검사합니다.
 * - :root 에도 같은 값을 둬서 data-style 이 없을 때의 기본값이 됩니다.
 * - manifest(서류형)·night(어두운 화면)는 S08 이 app/styles/style-manifest.css·style-night.css 에 더합니다.
 * - 이 파일은 --tt-* 변수와 [data-slot]·[data-status-chip]·[data-spine-part] 같은 새 훅에만 규칙을 겁니다.
 *   기존(레거시) 화면은 바꾸지 않습니다.
 */
:root,
[data-style="signal"] {
  --tt-ground: #EEEDE8;
  --tt-surface: #FFFFFF;
  --tt-raised: #FFFFFF;
  --tt-ink: #111110;
  --tt-muted: #5C5B56;
  --tt-rule: #D3D2CB;
  --tt-control: #767570;
  --tt-route: #85847E;
  --tt-primary: #111110;
  --tt-on-primary: #FFFFFF;
  --tt-accent: #2244D1;
  --tt-link: #111110;
  --tt-focus: #111110;
  --tt-tile: #FFFFFF;
  --tt-board: #111110;
  --tt-tone-progress: #2244D1;
  --tt-tone-progress-on: #FFFFFF;
  --tt-tone-progress-ink: #2244D1;
  --tt-tone-waiting: #CFCEC6;
  --tt-tone-waiting-on: #111110;
  --tt-tone-waiting-ink: #5C5B56;
  --tt-tone-attention: #F4BC00;
  --tt-tone-attention-on: #111110;
  --tt-tone-attention-ink: #8A5A00;
  --tt-tone-problem: #C8261D;
  --tt-tone-problem-on: #FFFFFF;
  --tt-tone-problem-ink: #C8261D;
  --tt-tone-done: #0B6B3E;
  --tt-tone-done-on: #FFFFFF;
  --tt-tone-done-ink: #0B6B3E;

  --tt-font-body: "Apple SD Gothic Neo", "Malgun Gothic", "맑은 고딕", "Noto Sans KR", "Noto Sans CJK KR", system-ui, -apple-system, sans-serif;
  --tt-font-display: "Apple SD Gothic Neo", "Malgun Gothic", "맑은 고딕", "Noto Sans KR", "Noto Sans CJK KR", system-ui, -apple-system, sans-serif;
  --tt-font-mono: var(--font-dm-mono, "DM Mono"), ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  --tt-weight-display: 800;
  --tt-text-xs: 12px;
  --tt-text-sm: 14px;
  --tt-text-md: 16px;
  --tt-text-lg: 20px;
  --tt-text-xl: 24px;
  --tt-text-eta: 40px;
  --tt-leading-tight: 1.25;
  --tt-leading-body: 1.5;
  --tt-radius-button: 0px;
  --tt-radius-card: 0px;
  --tt-border-button: 2px;
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

/* 줄인 모션: 모든 스타일에서 0. [data-style][data-style] 은 스타일 파일의 [data-style="…"] 보다 우선합니다. */
@media (prefers-reduced-motion: reduce) {
  :root,
  [data-style][data-style] {
    --tt-motion-fast: 0ms;
    --tt-motion-base: 0ms;
    --tt-motion-slow: 0ms;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/tokens.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `15 passed`.

- [ ] **Step 5: Commit**

Run: `git add app/styles/tokens.css tests/unit/tokens.spec.ts; git commit -m "feat: define signal style tokens in tokens.css"`

---

### Task 3: Tailwind `tt-*` mapping

**Files:**
- Modify: `tailwind.config.ts:1-46` (whole file)
- Test: `tests/unit/tokens.spec.ts` (append)

**Interfaces:**
- Consumes: `COLOR_TOKENS` (Task 1).
- Produces (roadmap §11.12 + Addition 6): classes `bg-tt-<key>`, `text-tt-<key>`, `border-tt-<key>` for the 30 color keys; `font-tt-body|tt-display|tt-mono`; `text-tt-xs|sm|md|lg|xl|eta`; `rounded-tt-button|tt-card`; `duration-tt-fast|tt-base|tt-slow`; `ease-tt`. Legacy color keys are gone; legacy `borderRadius` `lg/md/sm` and the `pulse-glow` animation stay (still used by legacy components; S06 drops `pulse-glow`).

- [ ] **Step 1: Write the failing test**

Add this import at the top of `tests/unit/tokens.spec.ts`:

```ts
import tailwindConfig from "@/tailwind.config";
```

Append:

```ts
test.describe("tailwind mapping", () => {
  const extend = (tailwindConfig.theme?.extend ?? {}) as Readonly<Record<string, unknown>>;

  test("colors.tt maps every color token and no legacy color key remains", () => {
    const colors = extend.colors as Readonly<Record<string, Readonly<Record<string, string>>>>;
    expect(Object.keys(colors)).toEqual(["tt"]);
    expect(Object.keys(colors.tt)).toEqual([
      "ground", "surface", "raised", "ink", "muted", "rule", "control", "route", "primary", "on-primary", "accent", "link",
      "focus", "tile", "board", "progress", "progress-on", "progress-ink", "waiting", "waiting-on", "waiting-ink",
      "attention", "attention-on", "attention-ink", "problem", "problem-on", "problem-ink", "done", "done-on", "done-ink"
    ]);
    expect(colors.tt.ground).toBe("var(--tt-ground)");
    expect(colors.tt["on-primary"]).toBe("var(--tt-on-primary)");
    expect(colors.tt["attention-ink"]).toBe("var(--tt-tone-attention-ink)");
    expect(Object.values(colors.tt).map((value) => value.slice(4, -1)).sort()).toEqual([...COLOR_TOKENS].sort());
  });

  test("font, size, radius, duration and easing keys point at tokens", () => {
    expect(extend.fontFamily).toEqual({
      "tt-body": "var(--tt-font-body)",
      "tt-display": "var(--tt-font-display)",
      "tt-mono": "var(--tt-font-mono)"
    });
    expect(extend.fontSize).toEqual({
      "tt-xs": ["var(--tt-text-xs)", { lineHeight: "18px" }],
      "tt-sm": ["var(--tt-text-sm)", { lineHeight: "20px" }],
      "tt-md": ["var(--tt-text-md)", { lineHeight: "24px" }],
      "tt-lg": ["var(--tt-text-lg)", { lineHeight: "28px" }],
      "tt-xl": ["var(--tt-text-xl)", { lineHeight: "32px" }],
      "tt-eta": ["var(--tt-text-eta)", { lineHeight: "1.1" }]
    });
    expect(extend.borderRadius).toMatchObject({ "tt-button": "var(--tt-radius-button)", "tt-card": "var(--tt-radius-card)" });
    expect(extend.transitionDuration).toEqual({
      "tt-fast": "var(--tt-motion-fast)",
      "tt-base": "var(--tt-motion-base)",
      "tt-slow": "var(--tt-motion-slow)"
    });
    expect(extend.transitionTimingFunction).toEqual({ tt: "var(--tt-ease)" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/tokens.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: 2 FAIL — first one with `Expected: ["tt"]` / `Received: ["background", "foreground", "card", …]`; 15 pass.

- [ ] **Step 3: Replace `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";
import { COLOR_TOKENS } from "./lib/style/tokens";

/** "--tt-ground" → "ground", "--tt-tone-progress-on" → "progress-on" (classes bg-tt-ground, text-tt-progress-on). */
const ttColors: Record<string, string> = Object.fromEntries(
  COLOR_TOKENS.map((token) => [token.replace(/^--tt-(tone-)?/, ""), `var(${token})`])
);

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        tt: ttColors
      },
      fontFamily: {
        "tt-body": "var(--tt-font-body)",
        "tt-display": "var(--tt-font-display)",
        "tt-mono": "var(--tt-font-mono)"
      },
      fontSize: {
        "tt-xs": ["var(--tt-text-xs)", { lineHeight: "18px" }],
        "tt-sm": ["var(--tt-text-sm)", { lineHeight: "20px" }],
        "tt-md": ["var(--tt-text-md)", { lineHeight: "24px" }],
        "tt-lg": ["var(--tt-text-lg)", { lineHeight: "28px" }],
        "tt-xl": ["var(--tt-text-xl)", { lineHeight: "32px" }],
        "tt-eta": ["var(--tt-text-eta)", { lineHeight: "1.1" }]
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
        "tt-button": "var(--tt-radius-button)",
        "tt-card": "var(--tt-radius-card)"
      },
      transitionDuration: {
        "tt-fast": "var(--tt-motion-fast)",
        "tt-base": "var(--tt-motion-base)",
        "tt-slow": "var(--tt-motion-slow)"
      },
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
    }
  },
  plugins: []
};

export default config;
```

- [ ] **Step 4: Verify nothing used the removed legacy color keys**

Use the Grep tool with pattern `\b(bg|text|border|ring|from|to|via|fill|stroke|outline|divide|placeholder|shadow)-(background|foreground|card|cardForeground|border|muted|mutedForeground|accent-(success|warning|info|error))\b` over `app/`, `components/`, `lib/` (`*.ts`, `*.tsx`, `*.css`).
Expected: no matches (confirmed when this plan was written).

- [ ] **Step 5: Run tests, typecheck, build**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/tokens.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `17 passed`.
Run: `npm run typecheck; npm run build`
Expected: both exit 0 (Tailwind loads `./lib/style/tokens` through its TS config loader).

- [ ] **Step 6: Commit**

Run: `git add tailwind.config.ts tests/unit/tokens.spec.ts; git commit -m "feat: map tt-* tailwind keys to style tokens and drop legacy colors"`

---

### Task 4: Root layout — `data-style="signal"`, tokens import, signal fonts

**Files:**
- Modify: `app/layout.tsx` (S01/S03 version: the `next/font/google` import line, the `IBM_Plex_Sans_KR` declaration, the `<html>` and `<body>` opening tags; add two imports)
- Modify: `tests/budgets/font-preload.spec.ts` (S01's file: merge imports at the top, append one `describe` block)
- Test: `tests/e2e/ui-kit.spec.ts` (create)

**Interfaces:**
- Consumes: `DEFAULT_STYLE_ID` (Task 1); `app/styles/tokens.css` (Task 2); `font-tt-body` (Task 3); fixtures `FAKE`, `mockTrack`, `trackData` and `IS_PRODUCTION_RUN` (S01); `app/layout.tsx` as S01 Task 5/Task 7 left it plus S03 Task 7 Step 6 (`import { getSiteConfig } from "@/lib/config/server";` below the `Metadata` import and `getSiteConfig();` as the first statement of `RootLayout`); `tests/budgets/font-preload.spec.ts` as S01 Task 5 created it (imports `expect`, `test`, `IS_PRODUCTION_RUN`, `FAKE`; helper names `MAX_FONT_PRELOADS`, `RSC_FONT_HINT`, `tagFontUrls`, `linkHeaderFontUrls`, `rscFontHintUrls` are S01's and are not reused here).
- Produces: every page has `<html lang="ko" data-style="signal" class="<DM Mono variable class>">`, the `--tt-*` variables, `--font-dm-mono` on `<html>`, and `<body class="font-tt-body google-anno-skip antialiased">`. IBM Plex Sans KR is gone.

- [ ] **Step 1: Write the failing E2E test**

Create `tests/e2e/ui-kit.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { STYLE_COLOR_TOKENS } from "@/lib/style/tokens";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";

// Basic-auth credentials are sent only when a route challenges (the /internal/* pages).
test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

test.describe("root layout wiring", () => {
  test("pages render html[data-style=signal] with the signal tokens and only the DM Mono web font", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-style", "signal");
    const ground = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--tt-ground").trim().toUpperCase()
    );
    expect(ground).toBe(STYLE_COLOR_TOKENS.signal?.["--tt-ground"]);
    const families = await page.evaluate(async () => {
      await document.fonts.ready;
      return Array.from(document.fonts, (font) => font.family);
    });
    expect(families.some((family) => /DM[_ ]Mono/.test(family))).toBe(true);
    expect(families.filter((family) => /IBM[_ ]Plex|Space[_ ]Grotesk/.test(family))).toEqual([]);
    const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(bodyFont).toMatch(/Apple SD Gothic Neo|Malgun Gothic/);
  });
});
```

- [ ] **Step 2: Write the production font budget test**

In `tests/budgets/font-preload.spec.ts`, make sure the imports at the top provide these names (add only the missing names to the existing import statements; do not duplicate a statement):

```ts
import { expect, test, type Page, type Response } from "@playwright/test";
import { IS_PRODUCTION_RUN } from "../support/prod-mode";
import { FAKE, mockTrack, trackData } from "../fixtures/tracking-fixtures";
```

Append to the end of the file:

```ts
// ---- S05: signal style fonts (spec §12 font budget, §13 "system gothic + 1 numeric subset file") ----
const FIRST_VIEW_FONT_BUDGET_BYTES = 100 * 1024;

interface FirstViewFonts {
  readonly preloadCount: number;
  readonly totalBytes: number;
  readonly families: readonly string[];
}

async function collectFirstViewFonts(page: Page, path: string): Promise<FirstViewFonts> {
  const fontResponses: Response[] = [];
  page.on("response", (response) => {
    if (response.request().resourceType() === "font") fontResponses.push(response);
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(path, { waitUntil: "networkidle" });
  const families = await page.evaluate(async () => {
    await document.fonts.ready;
    return Array.from(document.fonts, (font) => font.family);
  });
  const preloadCount = await page.locator('link[rel="preload"][as="font"]').count();
  let totalBytes = 0;
  for (const response of fontResponses) totalBytes += (await response.request().sizes()).responseBodySize;
  return { preloadCount, totalBytes, families };
}

test.describe("signal style fonts (S05)", () => {
  test.skip(!IS_PRODUCTION_RUN, "budgets run against next start");

  for (const route of [
    { name: "home", path: "/" },
    { name: "deep link", path: `/${FAKE.domestic}` }
  ] as const) {
    test(`${route.name}: one DM Mono preload, no IBM Plex, first-view fonts within 100 KB`, async ({ page }) => {
      await mockTrack(page, trackData("customsWaiting"));
      const fonts = await collectFirstViewFonts(page, route.path);
      // Printed so the stage gate (G8) can record the measured budget.
      console.info(`[font-budget] ${route.name}: ${fonts.totalBytes} B in the first view, ${fonts.preloadCount} preload(s)`);
      expect(fonts.preloadCount).toBe(1);
      expect(fonts.totalBytes).toBeLessThanOrEqual(FIRST_VIEW_FONT_BUDGET_BYTES);
      expect(fonts.families.some((family) => /DM[_ ]Mono/.test(family))).toBe(true);
      expect(fonts.families.filter((family) => /IBM[_ ]Plex|Space[_ ]Grotesk/.test(family))).toEqual([]);
    });
  }
});
```

- [ ] **Step 3: Run the E2E test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts`
Expected: FAIL — `expect(locator).toHaveAttribute(expected)` on `locator('html')`, expected `"signal"`, attribute missing.

- [ ] **Step 4: Edit `app/layout.tsx`**

Make exactly these five edits (use the Edit tool; the "old" text is what S01 left):

1. Replace the font import line `import { IBM_Plex_Sans_KR } from "next/font/google";` with:

```ts
import { DM_Mono } from "next/font/google";
import { DEFAULT_STYLE_ID } from "@/lib/style/styles";
```

2. Replace `import "./globals.css";` with:

```ts
import "./globals.css";
import "./styles/tokens.css";
```

3. Replace the whole `const bodyFont = IBM_Plex_Sans_KR({ … });` declaration (S01: `subsets: ["latin"]`, `weight: ["400", "700"]`, `variable: "--font-body"`, `preload: false`) with:

```ts
// Signal (기본) keeps body and display text on the system Korean gothic (0 KB). The only web font is
// DM Mono 500, latin subset, for tracking-number digits: one preloaded file (spec §12 and §13 font budget).
const monoFont = DM_Mono({
  subsets: ["latin"],
  weight: "500",
  display: "swap",
  preload: true,
  variable: "--font-dm-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"]
});
```

4. Replace `<html lang="ko">` with `<html lang="ko" data-style={DEFAULT_STYLE_ID} className={monoFont.variable}>`.

5. Replace the `<body …>` opening tag (S01: ``<body className={`${bodyFont.variable} google-anno-skip antialiased`}>``) with `<body className="font-tt-body google-anno-skip antialiased">`.

The resulting file must read as below. The `metadata` object is unchanged from S01. The `getSiteConfig` import line (directly below the `Metadata` import) and the comment + `getSiteConfig();` statement at the top of `RootLayout` are S03's (S03 Task 7 Step 6; S03 addition 11: `getSiteConfig()` logs the holiday warnings itself, so the layout never calls `holidayCoverageWarnings`). Do not touch S03's lines; if the file differs from S01 + S03 as shown, apply only the five edits above and record the difference in the stage summary.

```tsx
import type { Metadata } from "next";
import { getSiteConfig } from "@/lib/config/server";
import { DM_Mono } from "next/font/google";
import { DEFAULT_STYLE_ID } from "@/lib/style/styles";
import "./globals.css";
import "./styles/tokens.css";

// Signal (기본) keeps body and display text on the system Korean gothic (0 KB). The only web font is
// DM Mono 500, latin subset, for tracking-number digits: one preloaded file (spec §12 and §13 font budget).
const monoFont = DM_Mono({
  subsets: ["latin"],
  weight: "500",
  display: "swap",
  preload: true,
  variable: "--font-dm-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"]
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
  // Validates config/site.config.ts: an invalid operator config fails `next build` with Korean 'path: message' lines.
  getSiteConfig();
  return (
    <html lang="ko" data-style={DEFAULT_STYLE_ID} className={monoFont.variable}>
      <body className="font-tt-body google-anno-skip antialiased">
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
```

Why the legacy screen keeps working: `.font-tt-body` on `<body>` outranks the `body { font-family: var(--font-body) … }` rule in `app/globals.css`, and the legacy `h1–h4 { font-family: var(--font-display, var(--font-body)), sans-serif }` rule (S01's Task 5 form) becomes invalid at computed-value time now that `--font-body` is undefined, so headings inherit the body's system gothic. S06 removes those legacy rules.

- [ ] **Step 5: Confirm no other file needs IBM Plex**

Use the Grep tool with pattern `IBM_Plex|IBM Plex|Space_Grotesk|--font-body` over `app/`, `components/`, `lib/`.
Expected: matches only in `app/globals.css` (the legacy rules above). Nothing to change in this stage.

- [ ] **Step 6: Run the E2E test and the legacy suites**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts`
Expected: `1 passed`.
Run: `npx playwright test tests/tracking.spec.ts tests/privacy.spec.ts`
Expected: the same passed/skipped counts as the Task 0 baseline for these two files (the font swap changes no business rule; the tablet/desktop overflow tests still pass).

- [ ] **Step 7: Run the production font budget**

Run: `npm run build`
Expected: exit 0.
Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait for `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` = `200`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test tests/budgets/font-preload.spec.ts`
Expected: all tests pass, including `home: one DM Mono preload, …` and `deep link: one DM Mono preload, …`; the `[font-budget]` lines print well under 102400 B (DM Mono latin 500 is one small woff2). Record both numbers in the stage summary.
Stop the server (`Get-NetTCPConnection -LocalPort 43210 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }`) and clear the flags: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.

- [ ] **Step 8: Commit**

Run: `git add app/layout.tsx tests/budgets/font-preload.spec.ts tests/e2e/ui-kit.spec.ts; git commit -m "feat: wire the signal style and DM Mono into the root layout"`

---

### Task 5: Gallery route, `Button`, `ButtonLink`, focus ring, and the generic gallery checks

**Files:**
- Create: `components/primitives/Button.tsx`
- Create: `components/primitives/ButtonLink.tsx`
- Create: `app/(internal)/internal/ui-kit/page.tsx`
- Modify: `app/styles/tokens.css` (append the focus section)
- Test: `tests/e2e/ui-kit.spec.ts` (replace the import block, append)

**Interfaces:**
- Consumes: tokens and Tailwind keys (Tasks 1–3); `TalkPlacement`, `StorePlacementId` from `@/lib/tracking/types` (S03).
- Produces: `Button(props: ButtonProps)`, `ButtonLink(props)`, `buttonClassName(variant, size, extra?)`, `ButtonVariant`, `ButtonSize`, `ButtonProps` (contract §11.9 + Addition 2); the `.tt-focus` class; the gallery page at `/internal/ui-kit` with `<main data-ui-kit="true">` and the functions `Section`, `ColorSection`, `TypeSection`, `ButtonSection`, `UiKitPage` that later tasks extend; the test helpers `UI_KIT_PATH`, `openKit(page, width?, height?)`, `visibleTextSamples(page)`.

- [ ] **Step 1: Write the failing tests**

In `tests/e2e/ui-kit.spec.ts`, replace the two lines

```ts
import { expect, test } from "@playwright/test";
import { STYLE_COLOR_TOKENS } from "@/lib/style/tokens";
```

with

```ts
import { expect, test, type Page } from "@playwright/test";
import { STYLE_COLOR_TOKENS, contrastRatio } from "@/lib/style/tokens";
```

Append to the end of the file:

```ts
const UI_KIT_PATH = "/internal/ui-kit";

async function openKit(page: Page, width = 1280, height = 900): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(UI_KIT_PATH);
  await expect(page.locator("main[data-ui-kit]")).toBeVisible();
}

interface TextSample {
  readonly text: string;
  readonly fg: string;
  readonly bg: string;
  readonly size: number;
}

/** Every visible text node in the gallery with its color, the nearest opaque background and its font size. */
async function visibleTextSamples(page: Page): Promise<readonly TextSample[]> {
  return page.evaluate(() => {
    const toHex = (value: string): string | null => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      if (parts.length > 3 && parts[3] === 0) return null;
      return `#${parts
        .slice(0, 3)
        .map((part) => Math.round(part).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()}`;
    };
    const samples: { text: string; fg: string; bg: string; size: number }[] = [];
    const root = document.querySelector("main[data-ui-kit]");
    if (!root) return samples;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? "").trim();
      const parent = node.parentElement;
      if (!text || !parent || parent.closest(".sr-only")) continue;
      let bg: string | null = null;
      for (let element: Element | null = parent; element && !bg; element = element.parentElement) {
        bg = toHex(getComputedStyle(element).backgroundColor);
      }
      const style = getComputedStyle(parent);
      samples.push({ text: text.slice(0, 40), fg: toHex(style.color) ?? "#000000", bg: bg ?? "#FFFFFF", size: Number.parseFloat(style.fontSize) });
    }
    return samples;
  });
}

interface FocusProbe {
  readonly name: string;
  readonly style: string;
  readonly width: number;
  readonly ring: string | null;
  readonly background: string;
}

/** The focused element inside the gallery, its outline and the nearest opaque background around it. */
async function probeFocused(page: Page): Promise<FocusProbe | null> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement) || !element.closest("main[data-ui-kit]")) return null;
    const toHex = (value: string): string | null => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      if (parts.length > 3 && parts[3] === 0) return null;
      return `#${parts
        .slice(0, 3)
        .map((part) => Math.round(part).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()}`;
    };
    let background: string | null = null;
    for (let node = element.parentElement; node && !background; node = node.parentElement) {
      background = toHex(getComputedStyle(node).backgroundColor);
    }
    const style = getComputedStyle(element);
    return {
      name: (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 40),
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
      ring: toHex(style.outlineColor),
      background: background ?? "#FFFFFF"
    };
  });
}

test.describe("ui-kit gallery", () => {
  test("is served behind internal auth with one main landmark and its title", async ({ page }) => {
    const response = await page.goto(UI_KIT_PATH);
    expect(response?.status()).toBe(200);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "화면 부품 모음" })).toBeVisible();
  });

  test("no text is 11px or smaller", async ({ page }) => {
    await openKit(page, 375, 812);
    const tiny = (await visibleTextSamples(page)).filter((sample) => sample.size <= 11).map((sample) => `${sample.size}px ${sample.text}`);
    expect(tiny).toEqual([]);
  });

  test("every visible text is at least 4.5:1 against its background", async ({ page }) => {
    await openKit(page, 375, 812);
    const failures = (await visibleTextSamples(page))
      .map((sample) => ({ ...sample, ratio: contrastRatio(sample.fg, sample.bg) }))
      .filter((sample) => sample.ratio < 4.5)
      .map((sample) => `${sample.text}: ${sample.fg} on ${sample.bg} = ${sample.ratio.toFixed(2)}`);
    expect(failures).toEqual([]);
  });

  test("320px wide: no horizontal scroll", async ({ page }) => {
    await openKit(page, 320, 800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("every focusable element shows a 3px focus ring at 3:1 or more against its surroundings", async ({ page }) => {
    await openKit(page);
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

  test("primitives never create live regions", async ({ page }) => {
    await openKit(page);
    await expect(page.locator('main[data-ui-kit] :is([aria-live], [role="status"], [role="alert"], output)')).toHaveCount(0);
  });
});

test.describe("Button and ButtonLink", () => {
  test("render the button slot with variant hooks and 44/52px targets", async ({ page }) => {
    await openKit(page);
    const primary = page.locator('[data-demo="button-primary"] [data-slot="button"]');
    await expect(primary).toHaveAttribute("data-variant", "primary");
    await expect(primary).toHaveAttribute("data-size", "lg");
    await expect(primary).toHaveAttribute("type", "button");
    expect((await primary.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(52);
    for (const demo of ["button-secondary", "button-text", "button-link-internal"]) {
      const element = page.locator(`[data-demo="${demo}"] [data-slot="button"]`);
      expect((await element.boundingBox())?.height ?? 0, demo).toBeGreaterThanOrEqual(44);
    }
    await expect(page.locator('[data-demo="button-secondary"] [data-slot="button"]')).toHaveAttribute("data-variant", "secondary");
    await expect(page.locator('[data-demo="button-text"] [data-slot="button"]')).toHaveAttribute("data-variant", "text");
  });

  test("busy keeps the button enabled and sets aria-busy", async ({ page }) => {
    await openKit(page);
    const busy = page.locator('[data-demo="button-busy"] button');
    await expect(busy).toHaveAttribute("aria-busy", "true");
    await expect(busy).toBeEnabled();
    await expect(busy).toHaveText("조회 중…");
  });

  test("an internal ButtonLink stays in the tab and keeps its visible name", async ({ page }) => {
    await openKit(page);
    const link = page.locator('[data-demo="button-link-internal"] a');
    await expect(link).not.toHaveAttribute("target");
    await expect(link).not.toHaveAttribute("aria-label");
    await expect(link).not.toHaveAttribute("rel");
    await expect(link).toHaveAccessibleName("개인정보처리방침");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts`
Expected: the "root layout wiring" test passes; the 9 new tests FAIL (`/internal/ui-kit` returns 404, so `main[data-ui-kit]` is never visible and the first test gets status 404).

- [ ] **Step 3: Create `components/primitives/Button.tsx`**

```tsx
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "text";
export type ButtonSize = "md" | "lg";

const BASE_CLASS =
  "tt-focus inline-flex items-center justify-center gap-2 rounded-tt-button text-center font-tt-body text-tt-md font-bold transition-colors duration-tt-fast ease-tt [word-break:keep-all] aria-busy:cursor-progress";

const SHAPE_CLASS: Readonly<Record<ButtonVariant, Readonly<Record<ButtonSize, string>>>> = {
  primary: { md: "min-h-[44px] px-4", lg: "min-h-[52px] px-5" },
  secondary: { md: "min-h-[44px] px-4", lg: "min-h-[52px] px-5" },
  text: { md: "min-h-[44px] px-0", lg: "min-h-[52px] px-0" }
};

const VARIANT_CLASS: Readonly<Record<ButtonVariant, string>> = {
  primary: "border-0 bg-tt-primary text-tt-on-primary no-underline",
  secondary:
    "border-[length:var(--tt-border-button)] border-solid border-tt-ink bg-tt-surface text-tt-ink no-underline hover:bg-tt-ground",
  text: "border-0 bg-transparent text-tt-link underline decoration-2 underline-offset-[5px]"
};

/**
 * Class list of the `button` variant slot (corner/fill come from --tt-radius-button, --tt-border-button,
 * --tt-primary). Shared by Button, ButtonLink and CopyButton; later stages use it for other controls
 * that must look like buttons.
 */
export function buttonClassName(variant: ButtonVariant, size: ButtonSize, extra?: string): string {
  return [BASE_CLASS, SHAPE_CLASS[variant][size], VARIANT_CLASS[variant], extra].filter(Boolean).join(" ");
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant: ButtonVariant;
  /** md = 44px, lg = 52px (spec §12: actions 44–52px). */
  readonly size?: ButtonSize;
  /** Sets aria-busy. Never disables the button (spec §5). */
  readonly busy?: boolean;
};

export function Button({
  variant,
  size = "md",
  busy = false,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps): React.JSX.Element {
  return (
    <button
      {...rest}
      type={type}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-busy={busy ? true : undefined}
      className={buttonClassName(variant, size, className)}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Create `components/primitives/ButtonLink.tsx`**

```tsx
import type { StorePlacementId, TalkPlacement } from "@/lib/tracking/types";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "./Button";

const NEW_WINDOW_SUFFIX = " 새 창으로 열기";

type ButtonLinkProps = {
  readonly href: string;
  readonly variant: ButtonVariant;
  readonly size?: ButtonSize;
  /** New tab + accessible name `${label} 새 창으로 열기` + rel noopener noreferrer (roadmap §11.1 rule 7). */
  readonly external?: boolean;
  /** Affiliate link: rel gains "sponsored nofollow". */
  readonly sponsored?: boolean;
  readonly label: string;
  readonly placement?: TalkPlacement | StorePlacementId;
  readonly children?: React.ReactNode;
};

export function ButtonLink({
  href,
  variant,
  size = "md",
  external = false,
  sponsored = false,
  label,
  placement,
  children
}: ButtonLinkProps): React.JSX.Element {
  const rel = [sponsored ? "sponsored nofollow" : null, external ? "noopener noreferrer" : null].filter(Boolean).join(" ");
  return (
    <a
      href={href}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-link-placement={placement}
      target={external ? "_blank" : undefined}
      rel={rel || undefined}
      aria-label={external ? `${label}${NEW_WINDOW_SUFFIX}` : undefined}
      className={buttonClassName(variant, size)}
    >
      {children ?? label}
    </a>
  );
}
```

- [ ] **Step 5: Append the focus ring to `app/styles/tokens.css`**

```css

/* ---------- 공통 포커스 링: 3px, 흰 면·바탕 위 3:1 이상 (색면 안에서는 아래 status-head 규칙이 색을 바꿈) ---------- */
.tt-focus:focus-visible {
  outline: var(--tt-focus-width) solid var(--tt-focus);
  outline-offset: var(--tt-focus-offset);
}
```

- [ ] **Step 6: Create `app/(internal)/internal/ui-kit/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Button } from "@/components/primitives/Button";
import { ButtonLink } from "@/components/primitives/ButtonLink";
import { DEFAULT_STYLE_ID, STYLE_LABELS } from "@/lib/style/styles";
import { COLOR_TOKENS, CONTRAST_REQUIREMENTS, STYLE_COLOR_TOKENS, contrastRatio } from "@/lib/style/tokens";

export const metadata: Metadata = {
  title: "화면 부품 모음"
};

const SIGNAL_COLORS = STYLE_COLOR_TOKENS.signal;

const TYPE_SAMPLES = [
  { key: "xs", className: "text-tt-xs", text: "tt-xs · 12px · 척추 라벨, 고지, 원문 용어" },
  { key: "sm", className: "text-tt-sm", text: "tt-sm · 14px · 칩, 이유 한 줄, 안내 줄" },
  { key: "md", className: "text-tt-md", text: "tt-md · 16px · 본문, 버튼" },
  { key: "lg", className: "text-tt-lg font-tt-display [font-weight:var(--tt-weight-display)]", text: "tt-lg · 20px · 상태 제목" },
  { key: "xl", className: "text-tt-xl font-tt-display [font-weight:var(--tt-weight-display)]", text: "tt-xl · 24px · 홈 제목" },
  { key: "eta", className: "text-tt-eta font-tt-display tabular-nums [font-weight:var(--tt-weight-display)]", text: "9월 30일" }
] as const;

function Section({ id, title, children }: { readonly id: string; readonly title: string; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <section aria-labelledby={`kit-${id}`} className="flex flex-col gap-4 border-t-2 border-tt-ink pt-3">
      <h2 id={`kit-${id}`} className="m-0 font-tt-display text-tt-lg [font-weight:var(--tt-weight-display)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ColorSection(): React.JSX.Element | null {
  if (!SIGNAL_COLORS) return null;
  const colors = SIGNAL_COLORS;
  return (
    <Section id="colors" title="색 토큰 · signal">
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-5">
        {COLOR_TOKENS.map((token) => (
          <li key={token} className="flex min-w-0 flex-col gap-1">
            <span aria-hidden="true" className="block h-11 border border-tt-rule" style={{ backgroundColor: colors[token] }} />
            <code className="break-all font-tt-mono text-tt-xs">{token}</code>
            <span className="font-tt-mono text-tt-xs text-tt-muted">{colors[token]}</span>
          </li>
        ))}
      </ul>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {CONTRAST_REQUIREMENTS.map(({ fg, bg, min }) => (
          <li key={`${fg}-${bg}`} className="flex flex-wrap gap-x-2 text-tt-xs">
            <code className="break-all font-tt-mono">{fg}</code>
            <span>/</span>
            <code className="break-all font-tt-mono">{bg}</code>
            <span className="font-bold">{contrastRatio(colors[fg], colors[bg]).toFixed(2)}:1</span>
            <span className="text-tt-muted">기준 {min}:1</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function TypeSection(): React.JSX.Element {
  return (
    <Section id="type" title="글자 크기">
      <div className="flex flex-col gap-2">
        {TYPE_SAMPLES.map((sample) => (
          <p key={sample.key} className={`m-0 ${sample.className}`}>
            {sample.text}
          </p>
        ))}
        <p className="m-0 font-tt-mono text-tt-lg tracking-[0.02em] tabular-nums">0000 1234 5678</p>
      </div>
    </Section>
  );
}

function ButtonSection(): React.JSX.Element {
  return (
    <Section id="buttons" title="버튼 · 링크 버튼">
      <p className="m-0 text-tt-sm text-tt-muted">채움 버튼은 화면당 하나만 써요. 조회 중에도 버튼을 잠그지 않고 aria-busy만 걸어요.</p>
      <div className="flex flex-wrap items-center gap-3">
        <div data-demo="button-primary">
          <Button variant="primary" size="lg">
            조회하기
          </Button>
        </div>
        <div data-demo="button-busy">
          <Button variant="primary" size="lg" busy>
            조회 중…
          </Button>
        </div>
        <div data-demo="button-secondary">
          <Button variant="secondary">번호 수정</Button>
        </div>
        <div data-demo="button-text">
          <Button variant="text">다시 조회</Button>
        </div>
        <div data-demo="button-link-internal">
          <ButtonLink href="/privacy" variant="secondary" label="개인정보처리방침" />
        </div>
      </div>
    </Section>
  );
}

export default function UiKitPage(): React.JSX.Element {
  return (
    <main data-ui-kit="true" className="min-h-screen bg-tt-ground px-4 py-8 font-tt-body text-tt-ink sm:px-8">
      <div className="mx-auto flex max-w-[960px] flex-col gap-10">
        <header className="flex flex-col gap-2">
          <p className="m-0 text-tt-xs font-bold">
            내부 확인용 · {STYLE_LABELS[DEFAULT_STYLE_ID]} 스타일 ({DEFAULT_STYLE_ID})
          </p>
          <h1 className="m-0 font-tt-display text-tt-xl [font-weight:var(--tt-weight-display)]">화면 부품 모음</h1>
          <p className="m-0 max-w-[640px] text-tt-sm text-tt-muted">
            토큰과 공통 부품을 한 화면에서 확인해요. 값의 기준은 DESIGN.md와 app/styles/tokens.css예요.
          </p>
        </header>
        <ColorSection />
        <TypeSection />
        <ButtonSection />
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts`
Expected: `10 passed`.

- [ ] **Step 8: Lint, typecheck, commit**

Run: `npm run lint; npm run typecheck`
Expected: both exit 0 with no new warnings.
Run: `git add components/primitives/Button.tsx components/primitives/ButtonLink.tsx "app/(internal)/internal/ui-kit/page.tsx" app/styles/tokens.css tests/e2e/ui-kit.spec.ts; git commit -m "feat: add Button, ButtonLink and the internal ui-kit gallery"`

---

### Task 6: `ToneIcon`, `StatusChip`, and the `status-head` color field

**Files:**
- Create: `components/primitives/ToneIcon.tsx`
- Create: `components/primitives/StatusChip.tsx`
- Modify: `app/styles/tokens.css` (append status-head and chip sections)
- Modify: `app/(internal)/internal/ui-kit/page.tsx` (imports; add `Field`, `TONES`, `TONE_NAMES`, `ToneSection`, `StatusHeadDemo`; render `<ToneSection />`)
- Test: `tests/e2e/ui-kit.spec.ts` (append)

**Interfaces:**
- Consumes: `Tone`, `SpineIssue` from `@/lib/tracking/types` (S03); `Button` (Task 5).
- Produces: `ToneIcon(props: { tone: Tone; issue?: SpineIssue | null })` rendering `<svg aria-hidden="true" data-tone-icon>` sized `1em`; `StatusChip(props: { tone: Tone; text: string })` rendering `<span data-status-chip="true" data-tone>`; the status-head CSS contract (Addition 4); gallery helpers `Field({ tone, demo, children })` and `StatusHeadDemo()` (replaced in Tasks 7 and 8).

- [ ] **Step 1: Write the failing tests**

Append to `tests/e2e/ui-kit.spec.ts`:

```ts
test.describe("ToneIcon, StatusChip and the status-head field", () => {
  test("one chip per tone, each with an aria-hidden icon and its text", async ({ page }) => {
    await openKit(page);
    const chips = page.locator('[data-demo="chips"] [data-status-chip]');
    await expect(chips).toHaveCount(6);
    const tones = await chips.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-tone")));
    expect(tones).toEqual(["neutral", "progress", "waiting", "attention", "problem", "done"]);
    for (const chip of await chips.all()) {
      await expect(chip).toHaveAttribute("data-status-chip", "true");
      await expect(chip.locator('svg[aria-hidden="true"]')).toHaveCount(1);
      await expect(chip).not.toHaveText("");
    }
  });

  test("inside a field the chip is reversed and secondary/text buttons take the field's text color", async ({ page }) => {
    await openKit(page);
    for (const tone of ["neutral", "progress", "waiting", "attention", "problem", "done"]) {
      const colors = await page.locator(`[data-demo="field-${tone}"]`).evaluate((field) => {
        const read = (selector: string) => {
          const node = field.querySelector(selector);
          return node ? getComputedStyle(node) : null;
        };
        const chip = read("[data-status-chip]");
        const secondary = read('[data-slot="button"][data-variant="secondary"]');
        const text = read('[data-slot="button"][data-variant="text"]');
        return {
          fieldBg: getComputedStyle(field).backgroundColor,
          fieldFg: getComputedStyle(field).color,
          chipBg: chip?.backgroundColor,
          chipFg: chip?.color,
          secondaryBorder: secondary?.borderTopColor,
          secondaryFg: secondary?.color,
          secondaryBg: secondary?.backgroundColor,
          textFg: text?.color
        };
      });
      expect(colors.fieldBg, tone).not.toBe("rgba(0, 0, 0, 0)");
      expect(colors.chipBg, tone).toBe(colors.fieldFg);
      expect(colors.chipFg, tone).toBe(colors.fieldBg);
      expect(colors.secondaryBorder, tone).toBe(colors.fieldFg);
      expect(colors.secondaryFg, tone).toBe(colors.fieldFg);
      expect(colors.secondaryBg, tone).toBe("rgba(0, 0, 0, 0)");
      expect(colors.textFg, tone).toBe(colors.fieldFg);
    }
  });

  test("forced colors: chips keep a visible border", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await openKit(page);
    const width = await page
      .locator('[data-demo="chips"] [data-status-chip]')
      .first()
      .evaluate((element) => getComputedStyle(element).borderTopWidth);
    expect(Number.parseFloat(width)).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts -g "status-head field"`
Expected: 3 FAIL — `[data-demo="chips"] [data-status-chip]` resolves to 0 elements / `[data-demo="field-neutral"]` not found.

- [ ] **Step 3: Create `components/primitives/ToneIcon.tsx`**

```tsx
import type { SpineIssue, Tone } from "@/lib/tracking/types";

const TONE_PATHS: Readonly<Record<Tone, readonly string[]>> = {
  neutral: ["M5 12h14"],
  progress: ["M4 12h14", "M13 6l6 6-6 6"],
  waiting: ["M12 7v5l3 2"],
  attention: ["M12 7v6", "M12 16v1"],
  problem: ["M12 3L2 21h20z", "M12 10v5", "M12 18v1"],
  done: ["M4 12.5l5 5L20 6.5"]
};

const ISSUE_PATHS: Readonly<Record<SpineIssue, readonly string[]>> = {
  stopped: ["M9 5v14", "M15 5v14"],
  cut: ["M10 7H7a5 5 0 0 0 0 10h3", "M14 7h3a5 5 0 0 1 0 10h-3"],
  branch: ["M12 21v-8", "M12 13L5 4", "M12 13l7-9"]
};

const CIRCLED_TONES: ReadonlySet<Tone> = new Set<Tone>(["waiting", "attention"]);

/**
 * Decorative status icon (always aria-hidden; the status is always also written as text, WCAG 1.4.1).
 * Sized 1em so it follows the text next to it; drawn with currentColor.
 */
export function ToneIcon({ tone, issue = null }: { readonly tone: Tone; readonly issue?: SpineIssue | null }): React.JSX.Element {
  const paths = issue ? ISSUE_PATHS[issue] : TONE_PATHS[tone];
  const circled = !issue && CIRCLED_TONES.has(tone);
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-tone-icon={issue ?? tone}
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
      {circled ? <circle cx="12" cy="12" r="9" /> : null}
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
```

- [ ] **Step 4: Create `components/primitives/StatusChip.tsx`**

```tsx
import type { Tone } from "@/lib/tracking/types";
import { ToneIcon } from "./ToneIcon";

/** Status chip, e.g. '통관 대기 · 2/4'. Colors come from app/styles/tokens.css ([data-status-chip][data-tone]). */
export function StatusChip({ tone, text }: { readonly tone: Tone; readonly text: string }): React.JSX.Element {
  return (
    <span data-status-chip="true" data-tone={tone}>
      <ToneIcon tone={tone} />
      <span>{text}</span>
    </span>
  );
}
```

- [ ] **Step 5: Append the status-head and chip sections to `app/styles/tokens.css`**

```css

/* ---------- 변형 슬롯 status-head — signal: 상태 톤 단색 면 ----------
 * data-slot="status-head" 요소는 data-tone 도 함께 가집니다. 색면 안의 글자·선·포커스 링은 --field-fg 한 가지.
 * 높이 예산은 --tt-status-field-max(375×812 에서 '지금 할 일'이 420px 안에서 시작). 자르지 않고 배치로 지킵니다. */
[data-slot="status-head"] {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px var(--tt-gutter) 20px;
  background-color: var(--field-bg);
  color: var(--field-fg);
}
[data-slot="status-head"][data-tone="neutral"] { --field-bg: var(--tt-ground); --field-fg: var(--tt-ink); }
[data-slot="status-head"][data-tone="progress"] { --field-bg: var(--tt-tone-progress); --field-fg: var(--tt-tone-progress-on); }
[data-slot="status-head"][data-tone="waiting"] { --field-bg: var(--tt-tone-waiting); --field-fg: var(--tt-tone-waiting-on); }
[data-slot="status-head"][data-tone="attention"] { --field-bg: var(--tt-tone-attention); --field-fg: var(--tt-tone-attention-on); }
[data-slot="status-head"][data-tone="problem"] { --field-bg: var(--tt-tone-problem); --field-fg: var(--tt-tone-problem-on); }
[data-slot="status-head"][data-tone="done"] { --field-bg: var(--tt-tone-done); --field-fg: var(--tt-tone-done-on); }
[data-slot="status-head"] .tt-focus:focus-visible { outline-color: var(--field-fg); }
[data-slot="status-head"] [data-slot="button"][data-variant="secondary"] {
  border-color: var(--field-fg);
  background-color: transparent;
  color: var(--field-fg);
}
[data-slot="status-head"] [data-slot="button"][data-variant="text"] { color: var(--field-fg); }

/* ---------- 상태 칩: 흰 면 위에서는 톤 색면, 색면 안에서는 반전 ---------- */
[data-status-chip] {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 10px;
  background-color: var(--chip-bg);
  color: var(--chip-fg);
  font-size: var(--tt-text-sm);
  line-height: 20px;
  font-weight: 700;
}
[data-status-chip][data-tone="neutral"] { --chip-bg: var(--tt-ink); --chip-fg: var(--tt-surface); }
[data-status-chip][data-tone="progress"] { --chip-bg: var(--tt-tone-progress); --chip-fg: var(--tt-tone-progress-on); }
[data-status-chip][data-tone="waiting"] { --chip-bg: var(--tt-tone-waiting); --chip-fg: var(--tt-tone-waiting-on); }
[data-status-chip][data-tone="attention"] { --chip-bg: var(--tt-tone-attention); --chip-fg: var(--tt-tone-attention-on); }
[data-status-chip][data-tone="problem"] { --chip-bg: var(--tt-tone-problem); --chip-fg: var(--tt-tone-problem-on); }
[data-status-chip][data-tone="done"] { --chip-bg: var(--tt-tone-done); --chip-fg: var(--tt-tone-done-on); }
[data-slot="status-head"] [data-status-chip] { --chip-bg: var(--field-fg); --chip-fg: var(--field-bg); }

@media (forced-colors: active) {
  [data-status-chip] { border: 1px solid CanvasText; }
}
```

- [ ] **Step 6: Extend the gallery page**

In `app/(internal)/internal/ui-kit/page.tsx`:

(a) Replace `import { ButtonLink } from "@/components/primitives/ButtonLink";` with

```tsx
import { ButtonLink } from "@/components/primitives/ButtonLink";
import { StatusChip } from "@/components/primitives/StatusChip";
```

(b) Replace `import { COLOR_TOKENS, CONTRAST_REQUIREMENTS, STYLE_COLOR_TOKENS, contrastRatio } from "@/lib/style/tokens";` with

```tsx
import { COLOR_TOKENS, CONTRAST_REQUIREMENTS, STYLE_COLOR_TOKENS, contrastRatio } from "@/lib/style/tokens";
import type { Tone } from "@/lib/tracking/types";
```

(c) Replace `        <ButtonSection />` with

```tsx
        <ButtonSection />
        <ToneSection />
```

(d) Append to the end of the file:

```tsx
const TONES: readonly Tone[] = ["neutral", "progress", "waiting", "attention", "problem", "done"];

const TONE_NAMES: Readonly<Record<Tone, string>> = {
  neutral: "조회 중",
  progress: "정상 진행",
  waiting: "정보 대기",
  attention: "확인 필요",
  problem: "문제",
  done: "완료"
};

/** A signal color field. Full-bleed below 640px like the real result card. */
function Field({ tone, demo, children }: { readonly tone: Tone; readonly demo: string; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <div data-slot="status-head" data-tone={tone} data-demo={demo} className="-mx-4 sm:mx-0">
      {children}
    </div>
  );
}

function StatusHeadDemo(): React.JSX.Element {
  return (
    <Field tone="progress" demo="status-head">
      <div className="flex flex-col items-start gap-2">
        <StatusChip tone="progress" text="통관 대기 · 2/4" />
        <div className="flex flex-col gap-1">
          <h3 className="m-0 font-tt-display text-tt-lg [font-weight:var(--tt-weight-display)]">통관 순서를 기다리고 있어요</h3>
          <p className="m-0 text-tt-sm font-medium">세관 접수가 끝났고 순서대로 심사가 진행돼요.</p>
        </div>
      </div>
    </Field>
  );
}

function ToneSection(): React.JSX.Element {
  return (
    <Section id="tones" title="상태 톤 · 칩 · 색면">
      <div data-demo="chips" className="flex flex-wrap gap-2">
        {TONES.map((tone) => (
          <StatusChip key={tone} tone={tone} text={TONE_NAMES[tone]} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {TONES.map((tone) => (
          <Field key={tone} tone={tone} demo={`field-${tone}`}>
            <StatusChip tone={tone} text={TONE_NAMES[tone]} />
            <p className="m-0 text-tt-sm font-medium">색면 위 글자와 선은 색면 글자색 한 가지만 써요.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary">다시 조회</Button>
              <Button variant="text">번호 수정</Button>
            </div>
          </Field>
        ))}
      </div>
      <StatusHeadDemo />
    </Section>
  );
}
```

- [ ] **Step 7: Run the whole gallery spec**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts`
Expected: `13 passed` (the generic contrast and focus tests now also cover the six fields: white on blue 7.46:1, ink on grey 11.96:1, ink on amber 10.83:1, white on red 5.60:1, white on green 6.59:1, ink on ground 16.12:1).

- [ ] **Step 8: Commit**

Run: `git add components/primitives/ToneIcon.tsx components/primitives/StatusChip.tsx app/styles/tokens.css "app/(internal)/internal/ui-kit/page.tsx" tests/e2e/ui-kit.spec.ts; git commit -m "feat: add tone icons, status chips and the signal status-head field"`

---

### Task 7: `JourneySpine` — one 4-station spine with exactly one `aria-current=step`

**Files:**
- Create: `components/primitives/JourneySpine.tsx`
- Modify: `app/styles/tokens.css` (append the journey section)
- Modify: `app/(internal)/internal/ui-kit/page.tsx` (two import lines; replace `StatusHeadDemo`; render `<JourneySection />`; append `CUSTOMS_SPINE`, `SPINE_DEMOS`, `JourneySection`)
- Test: `tests/e2e/ui-kit.spec.ts` (replace `openKit`, append)

**Interfaces:**
- Consumes: `SpineView`, `StationId`, `Tone` from `@/lib/tracking/types` (S03; `SpineView.issue.kind` is `SpineIssue`); `ToneIcon` (Task 6); gallery `Section`, `Field`, `StatusChip` (Tasks 5–6); the field variables `--field-bg` / `--field-fg` (Task 6).
- Produces: `JourneySpine(props: { readonly spine: SpineView; readonly label?: string }): React.JSX.Element`. DOM (style-independent): `<div data-slot="journey"><ol aria-label={label} data-spine-current={StationId | "none"}>` with four `<li data-station={StationId} data-station-state="done|current|todo">` (plus `data-issue={SpineIssue}` on the issue station and `aria-current="step"` on the current one), then `<p data-spine-part="unknown">위치 확인 전</p>` only when `spine.current === null`. CSS `@keyframes tt-grow` (the current bar grows once in `--tt-motion-slow`). Gallery: `CUSTOMS_SPINE`, `SPINE_DEMOS`, `JourneySection`. Test helpers: `settleAnimations(page)`, `readSpine(page, demo)`, `STATION_IDS`, `STATION_NAMES`.

- [ ] **Step 1: Make the gallery helper wait for one-shot motion**

This task adds the first CSS animation (the current bar grows once). Colors and boxes must be measured after it finishes. In `tests/e2e/ui-kit.spec.ts`, replace

```ts
async function openKit(page: Page, width = 1280, height = 900): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(UI_KIT_PATH);
  await expect(page.locator("main[data-ui-kit]")).toBeVisible();
}
```

with

```ts
async function openKit(page: Page, width = 1280, height = 900): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(UI_KIT_PATH);
  await expect(page.locator("main[data-ui-kit]")).toBeVisible();
  await settleAnimations(page);
}

/** Waits for the one-shot entrance motion (spine grow, field paint) so colors and boxes are final. */
async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => animation)));
  });
}
```

- [ ] **Step 2: Write the failing tests**

Append to `tests/e2e/ui-kit.spec.ts`:

```ts
const STATION_IDS = ["departed", "customs", "domestic", "arrived"] as const;
const STATION_NAMES = ["해외 출발", "입항·통관", "국내 배송", "도착"] as const;

interface SpineSnapshot {
  readonly current: string | null;
  readonly stations: ReadonlyArray<{
    readonly id: string | null;
    readonly state: string | null;
    readonly issue: string | null;
    readonly currentStep: boolean;
    readonly text: string;
  }>;
  readonly unknownText: string | null;
}

async function readSpine(page: Page, demo: string): Promise<SpineSnapshot> {
  return page.locator(`[data-demo="${demo}"] [data-slot="journey"]`).evaluate((root) => ({
    current: root.querySelector("ol")?.getAttribute("data-spine-current") ?? null,
    stations: Array.from(root.querySelectorAll("ol > li"), (item) => ({
      id: item.getAttribute("data-station"),
      state: item.getAttribute("data-station-state"),
      issue: item.getAttribute("data-issue"),
      currentStep: item.getAttribute("aria-current") === "step",
      text: (item.textContent ?? "").replace(/\s+/g, " ").trim()
    })),
    unknownText: root.querySelector('[data-spine-part="unknown"]')?.textContent ?? null
  }));
}

test.describe("JourneySpine", () => {
  test("every spine is one labelled ol of the four stations in order", async ({ page }) => {
    await openKit(page);
    const lists = page.locator('main[data-ui-kit] [data-slot="journey"] > ol');
    const count = await lists.count();
    expect(count).toBeGreaterThanOrEqual(11);
    for (let index = 0; index < count; index += 1) {
      const list = lists.nth(index);
      await expect(list).toHaveAttribute("aria-label", "배송 여정 4구간");
      const ids = await list.locator(":scope > li").evaluateAll((items) => items.map((item) => item.getAttribute("data-station")));
      expect(ids).toEqual([...STATION_IDS]);
    }
  });

  test("exactly one aria-current=step on a located spine and none before the location is known", async ({ page }) => {
    await openKit(page);
    let located = 0;
    for (const list of await page.locator('main[data-ui-kit] [data-slot="journey"] > ol').all()) {
      const current = await list.getAttribute("data-spine-current");
      const marked = list.locator(':scope > li[aria-current="step"]');
      if (current === "none") {
        await expect(marked).toHaveCount(0);
        continue;
      }
      located += 1;
      await expect(marked).toHaveCount(1);
      await expect(marked).toHaveAttribute("data-station", current ?? "");
      await expect(marked).toHaveAttribute("data-station-state", "current");
    }
    expect(located).toBeGreaterThanOrEqual(10);
    await expect(page.locator('main[data-ui-kit] [aria-current="step"]')).toHaveCount(located);
  });

  test("stations before the current one are done and the rest are todo", async ({ page }) => {
    await openKit(page);
    const expected: Readonly<Record<string, readonly string[]>> = {
      "spine-customs": ["done", "current", "todo", "todo"],
      "spine-domestic": ["done", "done", "current", "todo"],
      "spine-arrived": ["done", "done", "done", "current"],
      "spine-unknown": ["todo", "todo", "todo", "todo"]
    };
    for (const [demo, states] of Object.entries(expected)) {
      const spine = await readSpine(page, demo);
      expect(spine.stations.map((station) => station.state), demo).toEqual(states);
      expect(spine.stations.map((station) => station.text), demo).toEqual([...STATION_NAMES]);
    }
  });

  test("unknown location: no marker, every station todo and the words '위치 확인 전'", async ({ page }) => {
    await openKit(page);
    const spine = await readSpine(page, "spine-unknown");
    expect(spine.current).toBe("none");
    expect(spine.stations.filter((station) => station.currentStep)).toEqual([]);
    expect(spine.unknownText).toBe("위치 확인 전");
    await expect(page.locator('[data-demo="spine-unknown"] [data-spine-part="unknown"]')).toBeVisible();
  });

  test("issue marks combine color, an icon and the word", async ({ page }) => {
    await openKit(page);
    for (const [demo, station, kind, word] of [
      ["spine-stopped", "customs", "stopped", "멈춤"],
      ["spine-cut", "domestic", "cut", "끊김"],
      ["spine-branch", "domestic", "branch", "갈림"],
      ["spine-cut-ahead", "domestic", "cut", "끊김"]
    ] as const) {
      const item = page.locator(`[data-demo="${demo}"] li[data-station="${station}"]`);
      await expect(item, demo).toHaveAttribute("data-issue", kind);
      await expect(item.locator('[data-spine-part="issue"]'), demo).toHaveText(word);
      await expect(item.locator(`svg[data-tone-icon="${kind}"][aria-hidden="true"]`), demo).toHaveCount(1);
      const bar = await item.locator('[data-spine-part="bar"]').evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        background: getComputedStyle(element).backgroundColor
      }));
      expect(bar.height, demo).toBe(20);
      expect(bar.background, demo).not.toBe("rgba(0, 0, 0, 0)");
    }
    // A carrier delay while customs is still current marks ③ and keeps ② as the current station.
    await expect(page.locator('[data-demo="spine-cut-ahead"] li[data-station="domestic"]')).toHaveAttribute("data-station-state", "todo");
    await expect(page.locator('[data-demo="spine-cut-ahead"] li[aria-current="step"]')).toHaveAttribute("data-station", "customs");
  });

  test("code 4 keeps ② current with a check mark and '인계 대기'", async ({ page }) => {
    await openKit(page);
    const current = page.locator('[data-demo="spine-handoff"] li[aria-current="step"]');
    await expect(current).toHaveAttribute("data-station", "customs");
    await expect(current.locator('[data-spine-part="sub"]')).toHaveText("인계 대기");
    await expect(current.locator('svg[data-tone-icon="done"]')).toHaveCount(1);
  });

  test("inside a field every bar uses the field's text color", async ({ page }) => {
    await openKit(page);
    const colors = await page.locator('[data-demo="spine-customs"]').evaluate((field) => {
      const bar = (station: string) => {
        const element = field.querySelector(`li[data-station="${station}"] [data-spine-part="bar"]`);
        return element ? getComputedStyle(element) : null;
      };
      return {
        fieldFg: getComputedStyle(field).color,
        done: bar("departed")?.backgroundColor,
        current: bar("customs")?.backgroundColor,
        todoBorder: bar("domestic")?.borderTopColor,
        todoWidth: bar("domestic")?.borderTopWidth
      };
    });
    expect(colors.done).toBe(colors.fieldFg);
    expect(colors.current).toBe(colors.fieldFg);
    expect(colors.todoBorder).toBe(colors.fieldFg);
    expect(colors.todoWidth).toBe("2px");
  });

  test("forced colors: done and current bars keep a CanvasText fill", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await openKit(page);
    const result = await page.locator('[data-demo="spine-customs"]').evaluate((field) => {
      const probe = document.createElement("div");
      probe.style.forcedColorAdjust = "none";
      probe.style.backgroundColor = "CanvasText";
      document.body.append(probe);
      const canvasText = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const background = (station: string) => {
        const element = field.querySelector(`li[data-station="${station}"] [data-spine-part="bar"]`);
        return element ? getComputedStyle(element).backgroundColor : "missing";
      };
      return { canvasText, done: background("departed"), current: background("customs") };
    });
    expect(result.done).toBe(result.canvasText);
    expect(result.current).toBe(result.canvasText);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts -g "JourneySpine"`
Expected: 8 FAIL — the first with `Expected: >= 11` / `Received: 0`, the others with `[data-demo="spine-…"] [data-slot="journey"]` resolving to 0 elements.

- [ ] **Step 4: Create `components/primitives/JourneySpine.tsx`**

```tsx
import type { SpineView, StationId } from "@/lib/tracking/types";
import { ToneIcon } from "./ToneIcon";

const STATIONS: ReadonlyArray<{ readonly id: StationId; readonly name: string }> = [
  { id: "departed", name: "해외 출발" },
  { id: "customs", name: "입항·통관" },
  { id: "domestic", name: "국내 배송" },
  { id: "arrived", name: "도착" }
];

const DEFAULT_LABEL = "배송 여정 4구간";
const UNKNOWN_TEXT = "위치 확인 전";
const HANDOFF_TEXT = "인계 대기";

type StationState = "done" | "current" | "todo";

function stationState(index: number, currentIndex: number): StationState {
  if (currentIndex < 0 || index > currentIndex) return "todo";
  return index === currentIndex ? "current" : "done";
}

/**
 * The one progress figure of the result (spec §6): ①해외 출발 ②입항·통관 ③국내 배송 ④도착.
 * Exactly one aria-current="step" when the location is known, none before (spine.current === null).
 * Issue marks (멈춤·끊김·갈림) are color + icon + the word from the view; the issue station can be
 * ahead of the current one (a carrier delay while customs is current). Code 4 keeps ② current with a
 * check mark and '인계 대기'. The look belongs to the `journey` slot in app/styles/tokens.css.
 */
export function JourneySpine({ spine, label = DEFAULT_LABEL }: { readonly spine: SpineView; readonly label?: string }): React.JSX.Element {
  const currentIndex = spine.current === null ? -1 : STATIONS.findIndex((station) => station.id === spine.current);
  return (
    <div data-slot="journey">
      <ol aria-label={label} data-spine-current={spine.current ?? "none"}>
        {STATIONS.map((station, index) => {
          const state = stationState(index, currentIndex);
          const issue = spine.issue !== null && spine.issue.at === station.id ? spine.issue : null;
          const handoff = state === "current" && station.id === "customs" && spine.handoffPending;
          return (
            <li
              key={station.id}
              data-station={station.id}
              data-station-state={state}
              data-issue={issue?.kind}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span data-spine-part="track" aria-hidden="true">
                <span data-spine-part="bar">{issue ? <ToneIcon tone="attention" issue={issue.kind} /> : null}</span>
              </span>
              <span data-spine-part="label">
                {issue ? <span data-spine-part="issue">{issue.label}</span> : null}
                <span data-spine-part="name">
                  {state === "done" || handoff ? <ToneIcon tone="done" /> : null}
                  {station.name}
                </span>
                {handoff ? <span data-spine-part="sub">{HANDOFF_TEXT}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      {spine.current === null ? <p data-spine-part="unknown">{UNKNOWN_TEXT}</p> : null}
    </div>
  );
}
```

- [ ] **Step 5: Append the journey section to `app/styles/tokens.css`**

```css

/* ---------- 변형 슬롯 journey — signal: 4구간 막대 ----------
 * 지난 구간 8px 채움, 지금 구간 20px 채움(한 번 자람), 남은 구간 8px 외곽선.
 * 멈춤·끊김·갈림은 20px 막대 속 아이콘 + 굵은 단어. 색면 안에서는 색면 글자색(currentColor) 한 가지로만 그립니다. */
[data-slot="journey"] {
  --journey-fill: currentColor;
  --journey-todo: currentColor;
  --journey-on-fill: var(--field-bg, var(--tt-surface));
  display: flex;
  flex-direction: column;
  gap: 6px;
}
[data-slot="journey"] > ol {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  column-gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
[data-slot="journey"] li {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
[data-slot="journey"] [data-spine-part="track"] {
  display: flex;
  align-items: flex-end;
  height: 20px;
}
[data-slot="journey"] [data-spine-part="bar"] {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  height: 8px;
}
[data-slot="journey"] [data-station-state="done"] [data-spine-part="bar"] {
  background-color: var(--journey-fill);
}
[data-slot="journey"] [data-station-state="todo"] [data-spine-part="bar"] {
  border: 2px solid var(--journey-todo);
}
[data-slot="journey"] [data-station-state="current"] [data-spine-part="bar"],
[data-slot="journey"] li[data-issue] [data-spine-part="bar"] {
  height: 20px;
  border: 0;
  background-color: var(--journey-fill);
  color: var(--journey-on-fill);
  font-size: 14px;
}
[data-slot="journey"] [data-station-state="current"] [data-spine-part="bar"] {
  transform-origin: left center;
  animation: tt-grow var(--tt-motion-slow) var(--tt-ease) 1 both;
}
[data-slot="journey"] [data-spine-part="label"] {
  display: flex;
  flex-direction: column;
  font-size: var(--tt-text-xs);
  line-height: 18px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
[data-slot="journey"] [data-spine-part="name"] {
  display: flex;
  align-items: center;
  gap: 4px;
}
[data-slot="journey"] [data-station-state="current"] [data-spine-part="name"],
[data-slot="journey"] [data-spine-part="issue"] {
  font-weight: var(--tt-weight-display);
}
[data-slot="journey"] [data-spine-part="unknown"] {
  margin: 0;
  font-size: var(--tt-text-xs);
  line-height: 18px;
  font-weight: 700;
}
@keyframes tt-grow {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
/* 고대비(강제 색) 모드: 배경색이 지워지므로 막대를 시스템 글자색으로 칠합니다. */
@media (forced-colors: active) {
  [data-slot="journey"] [data-spine-part="bar"] { forced-color-adjust: none; }
  [data-slot="journey"] [data-station-state="done"] [data-spine-part="bar"],
  [data-slot="journey"] [data-station-state="current"] [data-spine-part="bar"],
  [data-slot="journey"] li[data-issue] [data-spine-part="bar"] {
    background-color: CanvasText;
    color: Canvas;
  }
  [data-slot="journey"] [data-station-state="todo"] [data-spine-part="bar"] { border-color: CanvasText; }
}
```

- [ ] **Step 6: Extend the gallery page**

In `app/(internal)/internal/ui-kit/page.tsx`:

(a) Replace `import { Button } from "@/components/primitives/Button";` with

```tsx
import { Button } from "@/components/primitives/Button";
import { JourneySpine } from "@/components/primitives/JourneySpine";
```

(b) Replace `import type { Tone } from "@/lib/tracking/types";` with `import type { SpineView, Tone } from "@/lib/tracking/types";`

(c) Replace the whole `function StatusHeadDemo(): React.JSX.Element { … }` (Task 6 version) with

```tsx
function StatusHeadDemo(): React.JSX.Element {
  return (
    <Field tone="progress" demo="status-head">
      <div className="flex flex-col items-start gap-2">
        <StatusChip tone="progress" text="통관 대기 · 2/4" />
        <div className="flex flex-col gap-1">
          <h3 className="m-0 font-tt-display text-tt-lg [font-weight:var(--tt-weight-display)]">통관 순서를 기다리고 있어요</h3>
          <p className="m-0 text-tt-sm font-medium">세관 접수가 끝났고 순서대로 심사가 진행돼요.</p>
        </div>
      </div>
      <JourneySpine spine={CUSTOMS_SPINE} />
    </Field>
  );
}
```

(d) Replace `        <ToneSection />` with

```tsx
        <ToneSection />
        <JourneySection />
```

(e) Append to the end of the file:

```tsx
const CUSTOMS_SPINE: SpineView = { current: "customs", issue: null, handoffPending: false, positionLabel: "2/4" };

const SPINE_DEMOS: ReadonlyArray<{ readonly demo: string; readonly caption: string; readonly tone: Tone; readonly spine: SpineView }> = [
  { demo: "spine-customs", caption: "정상 진행 · 통관 대기 2/4", tone: "progress", spine: CUSTOMS_SPINE },
  {
    demo: "spine-handoff",
    caption: "통관 완료 · 인계 대기 2/4",
    tone: "progress",
    spine: { current: "customs", issue: null, handoffPending: true, positionLabel: "2/4" }
  },
  {
    demo: "spine-domestic",
    caption: "국내 배송 3/4",
    tone: "progress",
    spine: { current: "domestic", issue: null, handoffPending: false, positionLabel: "3/4" }
  },
  {
    demo: "spine-arrived",
    caption: "도착 4/4",
    tone: "done",
    spine: { current: "arrived", issue: null, handoffPending: false, positionLabel: "4/4" }
  },
  {
    demo: "spine-stopped",
    caption: "멈춤 · 장기 정체",
    tone: "attention",
    spine: { current: "customs", issue: { at: "customs", kind: "stopped", label: "멈춤" }, handoffPending: false, positionLabel: "2/4" }
  },
  {
    demo: "spine-cut",
    caption: "끊김 · 택배사 조회 지연",
    tone: "attention",
    spine: { current: "domestic", issue: { at: "domestic", kind: "cut", label: "끊김" }, handoffPending: false, positionLabel: "3/4" }
  },
  {
    demo: "spine-cut-ahead",
    caption: "끊김 · 통관 중 택배사 조회 지연",
    tone: "progress",
    spine: { current: "customs", issue: { at: "domestic", kind: "cut", label: "끊김" }, handoffPending: true, positionLabel: "2/4" }
  },
  {
    demo: "spine-branch",
    caption: "갈림 · 여러 택배사",
    tone: "attention",
    spine: { current: "domestic", issue: { at: "domestic", kind: "branch", label: "갈림" }, handoffPending: false, positionLabel: "3/4" }
  },
  {
    demo: "spine-unknown",
    caption: "위치 확인 전 · 국내 도착 전",
    tone: "waiting",
    spine: { current: null, issue: null, handoffPending: false, positionLabel: null }
  }
];

function JourneySection(): React.JSX.Element {
  return (
    <Section id="journey" title="4구간 여정 척추">
      <p className="m-0 text-tt-sm text-tt-muted">
        지금 구간 표식은 정확히 하나, 위치 확인 전에는 없어요. 멈춤·끊김·갈림은 색·아이콘·글자를 함께 써요.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {SPINE_DEMOS.map((item) => (
          <Field key={item.demo} tone={item.tone} demo={item.demo}>
            <p className="m-0 text-tt-sm font-bold">{item.caption}</p>
            <JourneySpine spine={item.spine} />
          </Field>
        ))}
      </div>
      <div data-demo="spine-surface" className="bg-tt-surface p-4">
        <JourneySpine spine={CUSTOMS_SPINE} />
      </div>
    </Section>
  );
}
```

The gallery now has 11 spines: 10 located (8 in `SPINE_DEMOS`, `spine-surface`, `status-head`) and 1 unknown.

- [ ] **Step 7: Run the whole gallery spec**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts`
Expected: `21 passed` (13 earlier + 8 new; the generic 12px/contrast/focus/320 px tests now also cover eleven spines).

- [ ] **Step 8: Lint, typecheck, commit**

Run: `npm run lint; npm run typecheck`
Expected: both exit 0.
Run: `git add components/primitives/JourneySpine.tsx app/styles/tokens.css "app/(internal)/internal/ui-kit/page.tsx" tests/e2e/ui-kit.spec.ts; git commit -m "feat: add the 4-station JourneySpine primitive"`

---

### Task 8: `EtaDisplay` — the largest text, read once

**Files:**
- Create: `components/primitives/EtaDisplay.tsx`
- Modify: `app/styles/tokens.css` (append the eta section)
- Modify: `app/(internal)/internal/ui-kit/page.tsx` (imports; replace `StatusHeadDemo`; render `<EtaSection />`; append `etaDate`, `DEMO_ETA`, `HOLIDAY_ETA`, `ETA_DEMOS`, `EtaSection`)
- Test: `tests/e2e/ui-kit.spec.ts` (append)

**Interfaces:**
- Consumes: `EtaView`, `EtaDate` from `@/lib/tracking/types` (S03, including S03 addition 4 — `holidayAffected` has a required `holidayName: string` — and addition 5 — `today` carries `label: '오늘 예상'`); `formatKstDate(value: Date | KstDateKey): string` and `weekdayLabel(key: KstDateKey): string` from `@/lib/tracking/time` (S03, gallery only); `JourneySpine`, `CUSTOMS_SPINE` (Task 7); `--field-bg`/`--field-fg` (Task 6).
- Produces: `EtaDisplay(props: { readonly eta: EtaView }): React.JSX.Element | null` — `null` for kind `none`; otherwise `<div data-slot="eta" data-eta-kind={kind}>` with `<p data-eta-label>`; date kinds render `<p data-eta-value>` = `<span class="sr-only">{date.label}</span>` + `<span aria-hidden="true" data-eta-visual>` built from `<span data-eta-part="month|day|weekday">` with one `<span data-eta-digit="d">d</span>` per digit, plus `<span data-eta-dday="n">D-n</span>` for kind `date` only; `holidayAffected` adds `<span data-eta-badge>`; `caption` renders `<p data-eta-caption>`; `pendingInfo`/`withheld`/`unknown` render `<p data-eta-text>`. Gallery: `etaDate(key)`, `DEMO_ETA`, `HOLIDAY_ETA`, `ETA_DEMOS`, `EtaSection`. Budget line `[budget] status-head field at 375x812: N px (max 300 px)`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/e2e/ui-kit.spec.ts`:

```ts
test.describe("EtaDisplay", () => {
  const DATE_DEMOS = ["eta-date", "eta-today", "eta-holiday", "eta-overdue", "eta-delivered"] as const;
  const TEXT_DEMOS = ["eta-pending", "eta-withheld", "eta-unknown"] as const;

  test("renders one eta slot per kind and nothing for 'none'", async ({ page }) => {
    await openKit(page);
    const kinds: Readonly<Record<string, string>> = {
      "eta-date": "date",
      "eta-today": "today",
      "eta-holiday": "holidayAffected",
      "eta-overdue": "overdue",
      "eta-delivered": "deliveredOn",
      "eta-pending": "pendingInfo",
      "eta-withheld": "withheld",
      "eta-unknown": "unknown"
    };
    for (const [demo, kind] of Object.entries(kinds)) {
      await expect(page.locator(`[data-demo="${demo}"] [data-slot="eta"]`), demo).toHaveAttribute("data-eta-kind", kind);
    }
    await expect(page.locator('[data-demo="eta-none"]')).toBeAttached();
    await expect(page.locator('[data-demo="eta-none"] *')).toHaveCount(0);
  });

  test("dates are read once from a screen-reader label and drawn from aria-hidden digit parts", async ({ page }) => {
    await openKit(page);
    for (const demo of DATE_DEMOS) {
      const parts = await page.locator(`[data-demo="${demo}"] [data-eta-value]`).evaluate((element) => {
        const visual = element.querySelector("[data-eta-visual]");
        return {
          label: element.querySelector(".sr-only")?.textContent ?? "",
          srOnlyCount: element.querySelectorAll(".sr-only").length,
          hidden: visual?.getAttribute("aria-hidden") ?? null,
          visualText: (visual?.textContent ?? "").replace(/\s+/g, " ").trim(),
          partNames: Array.from(visual?.querySelectorAll("[data-eta-part]") ?? [], (part) => part.getAttribute("data-eta-part")),
          digits: Array.from(visual?.querySelectorAll("[data-eta-digit]") ?? [], (digit) => [digit.getAttribute("data-eta-digit"), digit.textContent])
        };
      });
      expect(parts.srOnlyCount, demo).toBe(1);
      expect(parts.hidden, demo).toBe("true");
      expect(parts.visualText, demo).toBe(parts.label);
      expect(parts.partNames, demo).toEqual(["month", "day", "weekday"]);
      expect(parts.digits.length, demo).toBe(parts.label.replace(/\D/g, "").length);
      for (const [attribute, text] of parts.digits) expect(attribute, demo).toBe(text);
    }
    await expect(page.locator('[data-demo="eta-date"] [data-eta-value] .sr-only')).toHaveText("9월 30일 (수)");
  });

  test("D-n shows only for a plain estimate; the holiday badge replaces it", async ({ page }) => {
    await openKit(page);
    const dday = page.locator('[data-demo="eta-date"] [data-eta-dday]');
    await expect(dday).toHaveText("D-4");
    await expect(dday).toHaveAttribute("data-eta-dday", "4");
    for (const demo of ["eta-today", "eta-holiday", "eta-overdue", "eta-delivered", ...TEXT_DEMOS]) {
      await expect(page.locator(`[data-demo="${demo}"] [data-eta-dday]`), demo).toHaveCount(0);
    }
    const badge = page.locator('[data-demo="eta-holiday"] [data-eta-badge]');
    await expect(badge).toHaveText("추석 연휴 영향 · 1~2일 늦어질 수 있어요");
    await expect(badge.locator('svg[aria-hidden="true"]')).toHaveCount(1);
    await expect(page.locator('[data-demo="eta-today"] [data-eta-label]')).toHaveText("오늘 예상");
    await expect(page.locator('[data-demo="eta-holiday"] [data-eta-label]')).not.toHaveText("오늘 예상");
  });

  test("text kinds say what is known instead of a date", async ({ page }) => {
    await openKit(page);
    await expect(page.locator('[data-demo="eta-pending"] [data-eta-text]')).toHaveText("정보 등록 후 안내");
    await expect(page.locator('[data-demo="eta-withheld"] [data-eta-text]')).toHaveText("지금은 도착 예상일을 안내하기 어려워요");
    for (const demo of TEXT_DEMOS) await expect(page.locator(`[data-demo="${demo}"] [data-eta-value]`), demo).toHaveCount(0);
  });

  test("the estimated date is the largest text in the status field (32–40px)", async ({ page }) => {
    await openKit(page, 375, 812);
    const sizes = await page.locator('[data-demo="status-head"]').evaluate((field) => {
      const eta = field.querySelector("[data-eta-visual]");
      const textSizes = Array.from(field.querySelectorAll("*"))
        .filter((element) =>
          Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "")
        )
        .filter((element) => !element.closest(".sr-only"))
        .map((element) => Number.parseFloat(getComputedStyle(element).fontSize));
      return { eta: eta ? Number.parseFloat(getComputedStyle(eta).fontSize) : 0, max: Math.max(...textSizes) };
    });
    expect(sizes.eta).toBeGreaterThanOrEqual(32);
    expect(sizes.eta).toBeLessThanOrEqual(40);
    expect(sizes.max).toBe(sizes.eta);
  });

  test("status field budget: chip, title, reason, spine and date fit --tt-status-field-max at 375×812", async ({ page }) => {
    await openKit(page, 375, 812);
    const height = (await page.locator('[data-demo="status-head"]').boundingBox())?.height ?? Number.POSITIVE_INFINITY;
    const budget = await page.evaluate(() =>
      Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tt-status-field-max"))
    );
    // Printed so the stage gate (G8) can record the measured budget.
    console.info(`[budget] status-head field at 375x812: ${Math.round(height)} px (max ${budget} px)`);
    expect(budget).toBe(300);
    expect(height).toBeLessThanOrEqual(budget);
  });

  test("inside a field the D-n chip is reversed and the badge follows the field color", async ({ page }) => {
    await openKit(page);
    const dday = await page.locator('[data-demo="status-head"]').evaluate((field) => {
      const chip = field.querySelector("[data-eta-dday]");
      return {
        fieldBg: getComputedStyle(field).backgroundColor,
        fieldFg: getComputedStyle(field).color,
        chipBg: chip ? getComputedStyle(chip).backgroundColor : null,
        chipFg: chip ? getComputedStyle(chip).color : null
      };
    });
    expect(dday.chipBg).toBe(dday.fieldFg);
    expect(dday.chipFg).toBe(dday.fieldBg);
    const badge = await page.locator('[data-demo="field-eta-holiday"]').evaluate((field) => {
      const element = field.querySelector("[data-eta-badge]");
      return {
        fieldFg: getComputedStyle(field).color,
        border: element ? getComputedStyle(element).borderTopColor : null,
        color: element ? getComputedStyle(element).color : null
      };
    });
    expect(badge.border).toBe(badge.fieldFg);
    expect(badge.color).toBe(badge.fieldFg);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts -g "EtaDisplay"`
Expected: 7 FAIL — `[data-demo="eta-date"] [data-slot="eta"]` resolves to 0 elements (and the budget test: `[data-demo="status-head"] [data-eta-visual]` missing, `sizes.eta` 0).

- [ ] **Step 3: Create `components/primitives/EtaDisplay.tsx`**

```tsx
import type { EtaDate, EtaView } from "@/lib/tracking/types";

const DDAY_PREFIX = "D-";

type ShownEta = Exclude<EtaView, { readonly kind: "none" }>;

function Digits({ value }: { readonly value: number }): React.JSX.Element {
  return (
    <>
      {String(value)
        .split("")
        .map((digit, index) => (
          <span key={`${index}-${digit}`} data-eta-digit={digit}>
            {digit}
          </span>
        ))}
    </>
  );
}

/**
 * Screen readers get one sentence (`date.label`, e.g. '9월 30일 (수)'); the visual is aria-hidden and split
 * into month/day/weekday parts and single digits so each style can draw it its own way (signal: big numerals,
 * night: digit tiles). The visual text equals the label because S03 formats the label as `${month}월 ${day}일 (${weekday})`.
 */
function DateValue({ date, dday }: { readonly date: EtaDate; readonly dday: number | null }): React.JSX.Element {
  return (
    <p data-eta-value="true">
      <span className="sr-only">{date.label}</span>
      <span aria-hidden="true" data-eta-visual="true">
        <span data-eta-part="month">
          <Digits value={date.month} />월
        </span>{" "}
        <span data-eta-part="day">
          <Digits value={date.day} />일
        </span>{" "}
        <span data-eta-part="weekday">({date.weekday})</span>
      </span>
      {dday === null ? null : <span data-eta-dday={String(dday)}>{`${DDAY_PREFIX}${dday}`}</span>}
    </p>
  );
}

function CalendarIcon(): React.JSX.Element {
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
      <path d="M3 5h18v16H3z" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  );
}

function Caption({ text }: { readonly text: string | null }): React.JSX.Element | null {
  return text === null ? null : <p data-eta-caption="true">{text}</p>;
}

function EtaBody({ eta }: { readonly eta: ShownEta }): React.JSX.Element {
  switch (eta.kind) {
    case "date":
      return (
        <>
          <DateValue date={eta.date} dday={eta.dday} />
          <Caption text={eta.caption} />
        </>
      );
    case "today":
      return (
        <>
          <DateValue date={eta.date} dday={null} />
          <Caption text={eta.caption} />
        </>
      );
    case "holidayAffected":
      // Holiday overlap hides D-n and '오늘 예상' (spec §6); the badge says why.
      return (
        <>
          <DateValue date={eta.date} dday={null} />
          <span data-eta-badge="true">
            <CalendarIcon />
            {eta.badge}
          </span>
          <Caption text={eta.caption} />
        </>
      );
    case "overdue":
    case "deliveredOn":
      return <DateValue date={eta.date} dday={null} />;
    case "pendingInfo":
    case "withheld":
    case "unknown":
      return <p data-eta-text="true">{eta.text}</p>;
  }
}

/** The `eta` variant slot (spec §6 도착 예상). Renders only view-model strings plus the prefix 'D-'. */
export function EtaDisplay({ eta }: { readonly eta: EtaView }): React.JSX.Element | null {
  if (eta.kind === "none") return null;
  return (
    <div data-slot="eta" data-eta-kind={eta.kind}>
      <p data-eta-label="true">{eta.label}</p>
      <EtaBody eta={eta} />
    </div>
  );
}
```

- [ ] **Step 4: Append the eta section to `app/styles/tokens.css`**

```css

/* ---------- 변형 슬롯 eta — signal: 굵고 큰 날짜 숫자 ----------
 * 화면에서 가장 큰 글자(--tt-text-eta). D-n 칩은 반전(색면 안: 색면 글자색 바탕), 연휴 배지는 2px 외곽선.
 * '예상했던 날짜'(overdue)는 작고 가늘게 — 흐리게 보이도록 하되 대비는 그대로. */
[data-slot="eta"] {
  --eta-badge-bg: transparent;
  --eta-badge-fg: currentColor;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}
[data-slot="eta"] [data-eta-label] {
  margin: 0;
  font-size: var(--tt-text-xs);
  line-height: 18px;
  font-weight: 700;
}
[data-slot="eta"] [data-eta-value] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  margin: 0;
}
[data-slot="eta"] [data-eta-visual] {
  font-family: var(--tt-font-display);
  font-size: var(--tt-text-eta);
  line-height: 1.1;
  font-weight: var(--tt-weight-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
[data-slot="eta"] [data-eta-part] {
  white-space: nowrap;
}
[data-slot="eta"] [data-eta-dday] {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  background-color: var(--field-fg, var(--tt-ink));
  color: var(--field-bg, var(--tt-surface));
  font-size: var(--tt-text-sm);
  line-height: 20px;
  font-weight: var(--tt-weight-display);
  font-variant-numeric: tabular-nums;
}
[data-slot="eta"] [data-eta-badge] {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  margin-top: 6px;
  padding: 2px 10px;
  border: 2px solid var(--eta-badge-fg);
  background-color: var(--eta-badge-bg);
  color: var(--eta-badge-fg);
  font-size: var(--tt-text-sm);
  line-height: 20px;
  font-weight: 700;
}
[data-slot="eta"] [data-eta-caption] {
  margin: 0;
  font-size: var(--tt-text-sm);
  line-height: 20px;
  font-weight: 500;
}
[data-slot="eta"] [data-eta-text] {
  margin: 0;
  font-family: var(--tt-font-display);
  font-size: var(--tt-text-lg);
  line-height: 28px;
  font-weight: var(--tt-weight-display);
}
[data-slot="eta"][data-eta-kind="overdue"] [data-eta-visual] {
  font-size: var(--tt-text-lg);
  line-height: 28px;
  font-weight: 500;
  letter-spacing: 0;
}
```

- [ ] **Step 5: Extend the gallery page**

In `app/(internal)/internal/ui-kit/page.tsx`:

(a) Replace `import { Button } from "@/components/primitives/Button";` with

```tsx
import { Button } from "@/components/primitives/Button";
import { EtaDisplay } from "@/components/primitives/EtaDisplay";
```

(b) Replace `import type { SpineView, Tone } from "@/lib/tracking/types";` with

```tsx
import type { EtaDate, EtaView, SpineView, Tone } from "@/lib/tracking/types";
import { formatKstDate, weekdayLabel } from "@/lib/tracking/time";
```

(c) Replace the whole `function StatusHeadDemo(): React.JSX.Element { … }` (Task 7 version) with

```tsx
function StatusHeadDemo(): React.JSX.Element {
  return (
    <Field tone="progress" demo="status-head">
      <div className="flex flex-col items-start gap-2">
        <StatusChip tone="progress" text="통관 대기 · 2/4" />
        <div className="flex flex-col gap-1">
          <h3 className="m-0 font-tt-display text-tt-lg [font-weight:var(--tt-weight-display)]">통관 순서를 기다리고 있어요</h3>
          <p className="m-0 text-tt-sm font-medium">세관 접수가 끝났고 순서대로 심사가 진행돼요.</p>
        </div>
      </div>
      <JourneySpine spine={CUSTOMS_SPINE} />
      <EtaDisplay eta={DEMO_ETA} />
    </Field>
  );
}
```

(d) Replace `        <JourneySection />` with

```tsx
        <JourneySection />
        <EtaSection />
```

(e) Append to the end of the file:

```tsx
/** EtaDate for a KST date key, formatted by S03's time helpers ('2026-09-30' → '9월 30일 (수)'). */
function etaDate(key: string): EtaDate {
  const [, month, day] = key.split("-").map(Number);
  return { key, label: formatKstDate(key), month, day, weekday: weekdayLabel(key) };
}

// The gallery pretends today is 2026-09-26 (the fixture date), so 9월 30일 is D-4.
const DEMO_ETA: EtaView = { kind: "date", label: "도착 예상", date: etaDate("2026-09-30"), dday: 4, caption: null };

const HOLIDAY_ETA: EtaView = {
  kind: "holidayAffected",
  label: "도착 예상",
  date: etaDate("2026-09-30"),
  badge: "추석 연휴 영향 · 1~2일 늦어질 수 있어요",
  holidayName: "추석 연휴",
  caption: "통관 완료 예상 9월 28일 (월)"
};

const ETA_DEMOS: ReadonlyArray<{ readonly demo: string; readonly eta: EtaView }> = [
  { demo: "eta-date", eta: DEMO_ETA },
  // S03 addition 5: the "today" view carries '오늘 예상' as its label (resultCopy.etaTodayLabel); caption stays the secondary line.
  { demo: "eta-today", eta: { kind: "today", label: "오늘 예상", date: etaDate("2026-09-26"), caption: null } },
  { demo: "eta-holiday", eta: HOLIDAY_ETA },
  { demo: "eta-overdue", eta: { kind: "overdue", label: "예상했던 날짜", date: etaDate("2026-09-30") } },
  { demo: "eta-delivered", eta: { kind: "deliveredOn", label: "배송 완료일", date: etaDate("2026-09-25") } },
  { demo: "eta-pending", eta: { kind: "pendingInfo", label: "도착 예상", text: "정보 등록 후 안내" } },
  { demo: "eta-withheld", eta: { kind: "withheld", label: "도착 예상", text: "지금은 도착 예상일을 안내하기 어려워요" } },
  { demo: "eta-unknown", eta: { kind: "unknown", label: "도착 예상", text: "아직 예상일을 계산할 기록이 없어요" } },
  { demo: "eta-none", eta: { kind: "none" } }
];

function EtaSection(): React.JSX.Element {
  return (
    <Section id="eta" title="도착 예상">
      <p className="m-0 text-tt-sm text-tt-muted">
        날짜는 화면에서 가장 큰 글자예요. 화면 낭독기는 날짜 문장 하나만 읽고, 숫자 조각은 숨겨요.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {ETA_DEMOS.map((item) => (
          <div key={item.demo} data-demo={item.demo} className="flex min-w-0 flex-col gap-2 bg-tt-surface p-4">
            <EtaDisplay eta={item.eta} />
          </div>
        ))}
      </div>
      <Field tone="progress" demo="field-eta-holiday">
        <EtaDisplay eta={HOLIDAY_ETA} />
      </Field>
    </Section>
  );
}
```

- [ ] **Step 6: Run the whole gallery spec**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts`
Expected: `28 passed`; the output contains `[budget] status-head field at 375x812:` with a value ≤ 300 (about 264 px: 36 padding + 88 chip/title/reason + 16 + 44 spine + 16 + 64 date). Record the number for G8.

- [ ] **Step 7: Lint, typecheck, commit**

Run: `npm run lint; npm run typecheck`
Expected: both exit 0.
Run: `git add components/primitives/EtaDisplay.tsx app/styles/tokens.css "app/(internal)/internal/ui-kit/page.tsx" tests/e2e/ui-kit.spec.ts; git commit -m "feat: add the EtaDisplay primitive and the status field budget check"`

---

### Task 9: `NumberBar` — grouped monospace number, never truncated

**Files:**
- Create: `components/primitives/NumberBar.tsx`
- Modify: `app/(internal)/internal/ui-kit/page.tsx` (imports; render `<NumberBarSection />`; append `LONG_HBL`, `numberView`, `NumberBarSection`)
- Test: `tests/e2e/ui-kit.spec.ts` (imports, append)

**Interfaces:**
- Consumes: `NumberView` from `@/lib/tracking/types` and `groupTrackingNumber(raw: string): string` from `@/lib/tracking/number-format` (S03); `Button` (Task 5); fixtures `FAKE`, `FAKE_GROUPED` (S01).
- Produces: `NumberBar(props: { readonly number: NumberView; readonly carrierLabel: string; readonly actions?: React.ReactNode }): React.JSX.Element` — `<div data-number-bar="true">` holding `<p>` = `<span>조회번호 · {carrierLabel}</span>` + `<span data-number-bar-value="true">` (one `white-space: nowrap` span per group, single spaces between), then `<div data-number-bar-actions="true">` only when `actions` is given. Min height 56 px. Gallery: `LONG_HBL`, `numberView(raw)`, `NumberBarSection`. Test constant `LONG_HBL`.

- [ ] **Step 1: Write the failing tests**

In `tests/e2e/ui-kit.spec.ts`, replace `import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";` with

```ts
import { groupTrackingNumber } from "@/lib/tracking/number-format";
import { FAKE, FAKE_GROUPED } from "../fixtures/tracking-fixtures";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
```

Append to the end of the file:

```ts
// Same value as LONG_HBL in the gallery: a 30-character HBL-shaped fake (letters + zeros only).
const LONG_HBL = `TEST${"0".repeat(26)}`;

test.describe("NumberBar", () => {
  test("shows '조회번호 · carrier' and the number in 4-character monospace groups", async ({ page }) => {
    await openKit(page);
    const bar = page.locator('[data-demo="number-bar-result"] [data-number-bar]');
    await expect(bar).toHaveAttribute("data-number-bar", "true");
    await expect(bar).toContainText("조회번호 · CJ대한통운");
    const value = bar.locator("[data-number-bar-value]");
    await expect(value).toHaveText(FAKE_GROUPED.domestic);
    expect(await value.locator(":scope > span").allTextContents()).toEqual(FAKE_GROUPED.domestic.split(" "));
    const style = await value.evaluate((element) => ({
      family: getComputedStyle(element).fontFamily,
      numeric: getComputedStyle(element).fontVariantNumeric
    }));
    expect(style.family).toMatch(/DM[_ ]Mono/);
    expect(style.numeric).toContain("tabular-nums");
  });

  test("an HBL keeps its letter prefix as one group and a bar without actions has no action row", async ({ page }) => {
    await openKit(page);
    const value = page.locator('[data-demo="number-bar-hbl"] [data-number-bar-value]');
    await expect(value).toHaveText(FAKE_GROUPED.hbl);
    expect(await value.locator(":scope > span").allTextContents()).toEqual(FAKE_GROUPED.hbl.split(" "));
    await expect(page.locator('[data-demo="number-bar-hbl"] [data-number-bar-actions]')).toHaveCount(0);
  });

  test("actions share the number's row on wide screens and move below it at 320px", async ({ page }) => {
    for (const [width, below] of [
      [1280, false],
      [320, true]
    ] as const) {
      await openKit(page, width, 800);
      const boxes = await page.locator('[data-demo="number-bar-result"] [data-number-bar]').evaluate((bar) => ({
        valueBottom: bar.querySelector("[data-number-bar-value]")?.getBoundingClientRect().bottom ?? 0,
        actionsTop: bar.querySelector("[data-number-bar-actions]")?.getBoundingClientRect().top ?? 0
      }));
      if (below) expect(boxes.actionsTop, `${width}px`).toBeGreaterThanOrEqual(boxes.valueBottom);
      else expect(boxes.actionsTop, `${width}px`).toBeLessThan(boxes.valueBottom);
    }
  });

  test("long numbers wrap between groups at 320 px and are never truncated", async ({ page }) => {
    await openKit(page, 320, 800);
    for (const [demo, raw] of [
      ["number-bar-cargo", FAKE.cargo],
      ["number-bar-hbl30", LONG_HBL]
    ] as const) {
      const info = await page.locator(`[data-demo="${demo}"] [data-number-bar-value]`).evaluate((element) => ({
        text: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
        groupLines: Array.from(element.querySelectorAll(":scope > span"), (span) => span.getClientRects().length),
        overflow: element.scrollWidth - element.clientWidth,
        textOverflow: getComputedStyle(element).textOverflow,
        height: element.getBoundingClientRect().height,
        lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight)
      }));
      expect(info.text, demo).toBe(groupTrackingNumber(raw));
      expect(info.groupLines.every((lines) => lines === 1), demo).toBe(true);
      expect(info.overflow, demo).toBeLessThanOrEqual(0);
      expect(info.textOverflow, demo).not.toBe("ellipsis");
      if (demo === "number-bar-hbl30") expect(info.height, demo).toBeGreaterThan(info.lineHeight * 1.5);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts -g "NumberBar"`
Expected: 4 FAIL — `[data-demo="number-bar-result"] [data-number-bar]` resolves to 0 elements.

- [ ] **Step 3: Create `components/primitives/NumberBar.tsx`**

```tsx
import { Fragment } from "react";
import type { NumberView } from "@/lib/tracking/types";

const NUMBER_LABEL = "조회번호";

/**
 * Number bar (spec §6): '조회번호 · {carrier}' above the number in 4-character monospace groups.
 * A group never breaks and nothing is truncated; the number wraps only between groups.
 * Actions ([번호 변경], [번호 수정], [다시 조회]) sit on the right and wrap below the number when the row is too narrow.
 */
export function NumberBar({
  number,
  carrierLabel,
  actions
}: {
  readonly number: NumberView;
  readonly carrierLabel: string;
  readonly actions?: React.ReactNode;
}): React.JSX.Element {
  const groups = number.grouped.split(" ").filter((group) => group !== "");
  return (
    <div
      data-number-bar="true"
      className="flex min-h-[56px] flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-tt-surface px-[var(--tt-gutter)] py-1.5 text-tt-ink"
    >
      <p className="m-0 flex min-w-0 max-w-full flex-col">
        <span className="text-tt-xs font-medium text-tt-muted [word-break:keep-all]">{`${NUMBER_LABEL} · ${carrierLabel}`}</span>
        <span
          data-number-bar-value="true"
          className="block font-tt-mono text-tt-lg font-medium leading-6 tracking-[0.02em] [font-variant-numeric:tabular-nums]"
        >
          {groups.map((group, index) => (
            <Fragment key={`${index}-${group}`}>
              {index > 0 ? " " : null}
              <span className="whitespace-nowrap">{group}</span>
            </Fragment>
          ))}
        </span>
      </p>
      {actions ? (
        <div data-number-bar-actions="true" className="flex flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Extend the gallery page**

In `app/(internal)/internal/ui-kit/page.tsx`:

(a) Replace `import { Button } from "@/components/primitives/Button";` with

```tsx
import { Button } from "@/components/primitives/Button";
import { NumberBar } from "@/components/primitives/NumberBar";
```

(b) Replace `import type { EtaDate, EtaView, SpineView, Tone } from "@/lib/tracking/types";` with

```tsx
import type { EtaDate, EtaView, NumberView, SpineView, Tone } from "@/lib/tracking/types";
import { groupTrackingNumber } from "@/lib/tracking/number-format";
```

(c) Replace `        <EtaSection />` with

```tsx
        <EtaSection />
        <NumberBarSection />
```

(d) Append to the end of the file:

```tsx
/** A 30-character HBL-shaped fake (letters + zeros), the longest input the lookup accepts. */
const LONG_HBL = `TEST${"0".repeat(26)}`;

function numberView(raw: string): NumberView {
  return { raw, grouped: groupTrackingNumber(raw) };
}

function NumberBarSection(): React.JSX.Element {
  return (
    <Section id="number-bar" title="번호 바">
      <p className="m-0 text-tt-sm text-tt-muted">
        4자리씩 묶은 고정폭 숫자예요. 말줄임은 없고, 좁은 화면에서는 버튼이 다음 줄로 내려가요.
      </p>
      <div data-demo="number-bar-loading" className="-mx-4 sm:mx-0">
        <NumberBar
          number={numberView("000012345678")}
          carrierLabel="택배사 자동 확인"
          actions={<Button variant="secondary">번호 변경</Button>}
        />
      </div>
      <div data-demo="number-bar-result" className="-mx-4 sm:mx-0">
        <NumberBar
          number={numberView("000012345678")}
          carrierLabel="CJ대한통운"
          actions={
            <>
              <Button variant="secondary">번호 수정</Button>
              <Button variant="text">다시 조회</Button>
            </>
          }
        />
      </div>
      <div data-demo="number-bar-hbl" className="-mx-4 sm:mx-0">
        <NumberBar number={numberView("TEST00000001")} carrierLabel="택배사 배정 전" />
      </div>
      <div data-demo="number-bar-cargo" className="-mx-4 sm:mx-0">
        <NumberBar
          number={numberView("000012345678901234")}
          carrierLabel="택배사"
          actions={<Button variant="secondary">번호 수정</Button>}
        />
      </div>
      <div data-demo="number-bar-hbl30" className="-mx-4 sm:mx-0">
        <NumberBar
          number={numberView(LONG_HBL)}
          carrierLabel="택배사 자동 확인"
          actions={<Button variant="secondary">번호 변경</Button>}
        />
      </div>
    </Section>
  );
}
```

The gallery values are the fixture values (`FAKE.domestic`, `FAKE.hbl`, `FAKE.cargo`); app code must not import `tests/`, so they are written out here. All start with `0000` or are letters + zeros, which the S01 real-number guard allows.

- [ ] **Step 5: Run the whole gallery spec**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts`
Expected: `32 passed` (the generic 320 px overflow test now also covers the 30-character HBL).

- [ ] **Step 6: Lint, typecheck, commit**

Run: `npm run lint; npm run typecheck`
Expected: both exit 0.
Run: `git add components/primitives/NumberBar.tsx "app/(internal)/internal/ui-kit/page.tsx" tests/e2e/ui-kit.spec.ts; git commit -m "feat: add the NumberBar primitive with group-safe wrapping"`

---

### Task 10: `TalkLink` and `AffiliateLinkGroup` — one 톡톡 style, disclosure first

**Files:**
- Create: `components/primitives/TalkLink.tsx`
- Create: `components/primitives/AffiliateLinkGroup.tsx`
- Modify: `app/styles/tokens.css` (append the disclosure section and the in-field muted override)
- Modify: `app/(internal)/internal/ui-kit/page.tsx` (imports; render `<LinkSection />`; append `storeLink`, `DELIVERED_STORES`, `STORE_DEMOS`, `LinkSection`)
- Test: `tests/e2e/ui-kit.spec.ts` (imports, append)

**Interfaces:**
- Consumes: `ActionWeight`, `TalkPlacement`, `StoreLinkView`, `StoreLinksView`, `StorePlacementId` from `@/lib/tracking/types` and the named exports `channels`, `disclosures` from `@/config/site.config` (S03); `ButtonLink` (Task 5); `Field` (Task 6).
- Produces: `TalkLink(props: { readonly href: string; readonly label: string; readonly weight: ActionWeight; readonly placement: TalkPlacement }): React.JSX.Element` — a `ButtonLink` with `external`, `variant = weight`, `data-link-placement = placement`, accessible name `${label} 새 창으로 열기`, and an aria-hidden speech-bubble icon before the label except at `placement === "header"`. `AffiliateLinkGroup(props: { readonly stores: StoreLinksView; readonly layout?: "row" | "stack" }): React.JSX.Element | null` — `null` when `stores.links` is empty; root `<div data-affiliate-group={placement}>`; first child `<p data-affiliate-disclosure="coupang">` exactly when some link `isAffiliate` (text = `stores.disclosure ?? disclosures.coupang`); then the intro `<p>` when `stores.intro` is non-null; then one `ButtonLink` per link (`sponsored = isAffiliate`, `placement = stores.placement`, `variant = weight`). CSS: `[data-affiliate-disclosure]` look; `[data-slot="status-head"] .text-tt-muted` and `[data-slot="status-head"] [data-affiliate-disclosure]` switch to `--field-fg`. Gallery: `storeLink`, `DELIVERED_STORES`, `STORE_DEMOS`, `LinkSection`.

- [ ] **Step 1: Write the failing tests**

In `tests/e2e/ui-kit.spec.ts`, replace `import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";` with

```ts
import { channels, disclosures } from "@/config/site.config";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
```

Append to the end of the file:

```ts
test.describe("TalkLink and AffiliateLinkGroup", () => {
  test("TalkLink opens 톡톡 in a new tab with one look at three weights", async ({ page }) => {
    await openKit(page);
    const talk = channels.talk;
    for (const [demo, variant, placement, label, icons] of [
      ["talk-header", "text", "header", talk.labels.header, 0],
      ["talk-state", "text", "state", talk.labels.cta, 1],
      ["talk-secondary", "secondary", "state", talk.labels.cta, 1],
      ["talk-primary", "primary", "state", talk.labels.cta, 1],
      ["talk-footer", "text", "footer", talk.labels.footer, 1]
    ] as const) {
      const link = page.locator(`[data-demo="${demo}"] a`);
      await expect(link, demo).toHaveAttribute("href", talk.url);
      await expect(link, demo).toHaveAttribute("target", "_blank");
      await expect(link, demo).toHaveAttribute("rel", "noopener noreferrer");
      await expect(link, demo).toHaveAttribute("aria-label", `${label} 새 창으로 열기`);
      await expect(link, demo).toHaveAttribute("data-variant", variant);
      await expect(link, demo).toHaveAttribute("data-link-placement", placement);
      await expect(link.locator('svg[aria-hidden="true"]'), demo).toHaveCount(icons);
      await expect(link, demo).toHaveText(label);
    }
  });

  test("affiliate groups start with the disclosure exactly when a link is affiliate", async ({ page }) => {
    await openKit(page);
    const affiliateHrefs = new Set<string>(Object.values(channels.coupang.urls));
    for (const demo of ["affiliate-pending", "affiliate-delivered", "affiliate-missing-disclosure", "affiliate-naver-only", "field-links"]) {
      const group = page.locator(`[data-demo="${demo}"] [data-affiliate-group]`);
      await expect(group, demo).toHaveCount(1);
      const placement = (await group.getAttribute("data-affiliate-group")) ?? "";
      const links = await group.locator("a").evaluateAll((anchors) =>
        anchors.map((anchor) => ({
          href: anchor.getAttribute("href") ?? "",
          rel: (anchor.getAttribute("rel") ?? "").split(/\s+/).filter(Boolean).sort(),
          target: anchor.getAttribute("target"),
          placement: anchor.getAttribute("data-link-placement"),
          name: anchor.getAttribute("aria-label"),
          text: (anchor.textContent ?? "").trim()
        }))
      );
      expect(links.length, demo).toBeGreaterThan(0);
      const first = await group.evaluate((element) => {
        const child = element.firstElementChild;
        return child ? { tag: child.tagName, disclosure: child.getAttribute("data-affiliate-disclosure"), text: child.textContent } : null;
      });
      if (links.some((link) => affiliateHrefs.has(link.href))) {
        expect(first, demo).toEqual({ tag: "P", disclosure: "coupang", text: disclosures.coupang });
      } else {
        await expect(group.locator("[data-affiliate-disclosure]"), demo).toHaveCount(0);
      }
      for (const link of links) {
        const expectedRel = affiliateHrefs.has(link.href) ? ["nofollow", "noopener", "noreferrer", "sponsored"] : ["noopener", "noreferrer"];
        expect(link.rel, `${demo} ${link.href}`).toEqual(expectedRel);
        expect(link.target, demo).toBe("_blank");
        expect(link.placement, demo).toBe(placement);
        expect(link.name, demo).toBe(`${link.text} 새 창으로 열기`);
      }
    }
  });

  test("placement ids, the purchase-choice intro and an empty group", async ({ page }) => {
    await openKit(page);
    await expect(page.locator('[data-demo="affiliate-pending"] [data-affiliate-group]')).toHaveAttribute("data-affiliate-group", "pending");
    await expect(page.locator('[data-demo="affiliate-delivered"] [data-affiliate-group]')).toHaveAttribute(
      "data-affiliate-group",
      "deliveredLead"
    );
    await expect(page.locator('[data-demo="affiliate-pending"] [data-affiliate-group] > p').nth(1)).toHaveText(
      "주문하신 곳에서도 배송 안내를 볼 수 있어요"
    );
    const lead = page.locator('[data-demo="affiliate-delivered"] a').first();
    await expect(lead).toHaveAttribute("href", channels.naver.urls.deliveredLead);
    await expect(lead).toHaveAttribute("data-variant", "primary");
    await expect(page.locator('[data-demo="affiliate-empty"] *')).toHaveCount(0);
  });

  test("inside a field no text uses the muted color and links take the field color", async ({ page }) => {
    await openKit(page);
    const muted = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.color = "var(--tt-muted)";
      document.body.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    });
    const fieldColors = await page
      .locator('main[data-ui-kit] [data-slot="status-head"]')
      .evaluateAll((fields) => fields.flatMap((field) => Array.from(field.querySelectorAll("*"), (element) => getComputedStyle(element).color)));
    expect(fieldColors.length).toBeGreaterThan(0);
    expect(fieldColors).not.toContain(muted);
    const result = await page.locator('[data-demo="field-links"]').evaluate((field) => ({
      fieldFg: getComputedStyle(field).color,
      links: Array.from(field.querySelectorAll('a[data-variant="text"], a[data-variant="secondary"]'), (anchor) => getComputedStyle(anchor).color),
      disclosure: getComputedStyle(field.querySelector("[data-affiliate-disclosure]") ?? field).color
    }));
    expect(result.links.length).toBeGreaterThanOrEqual(2);
    for (const color of result.links) expect(color).toBe(result.fieldFg);
    expect(result.disclosure).toBe(result.fieldFg);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts -g "TalkLink and AffiliateLinkGroup"`
Expected: 4 FAIL — `[data-demo="talk-header"] a` / `[data-demo="affiliate-pending"] [data-affiliate-group]` resolve to 0 elements (the muted test fails on `[data-demo="field-links"]` not found).

- [ ] **Step 3: Create `components/primitives/TalkLink.tsx`**

```tsx
import type { ActionWeight, TalkPlacement } from "@/lib/tracking/types";
import { ButtonLink } from "./ButtonLink";

function TalkBubbleIcon(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="1.125em"
      height="1.125em"
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

/**
 * The one 톡톡 link style (spec §8: at most 3 places per screen — header, one state place, footer).
 * Weight "text" is the usual one; "secondary" and "primary" (problem states only) use the same shape at more weight.
 * Always a new tab with the name `${label} 새 창으로 열기`; the speech bubble is left out in the compact header link.
 */
export function TalkLink({
  href,
  label,
  weight,
  placement
}: {
  readonly href: string;
  readonly label: string;
  readonly weight: ActionWeight;
  readonly placement: TalkPlacement;
}): React.JSX.Element {
  return (
    <ButtonLink href={href} variant={weight} external label={label} placement={placement}>
      {placement === "header" ? null : <TalkBubbleIcon />}
      <span>{label}</span>
    </ButtonLink>
  );
}
```

- [ ] **Step 4: Create `components/primitives/AffiliateLinkGroup.tsx`**

```tsx
import { disclosures } from "@/config/site.config";
import type { StoreLinksView } from "@/lib/tracking/types";
import { ButtonLink } from "./ButtonLink";

/**
 * Store/affiliate link block (spec §8). `isAffiliate` alone decides both the disclosure and rel:
 * when any link is affiliate the definitive disclosure is the FIRST child (from the view, or the configured
 * wording if the view left it out); with no affiliate link there is no disclosure even if the view carries one.
 * Affiliate links get rel "sponsored nofollow noopener noreferrer"; every link opens a new tab.
 */
export function AffiliateLinkGroup({
  stores,
  layout = "row"
}: {
  readonly stores: StoreLinksView;
  readonly layout?: "row" | "stack";
}): React.JSX.Element | null {
  if (stores.links.length === 0) return null;
  const hasAffiliate = stores.links.some((link) => link.isAffiliate);
  const disclosure = hasAffiliate ? (stores.disclosure ?? disclosures.coupang) : null;
  return (
    <div data-affiliate-group={stores.placement} className="flex min-w-0 flex-col gap-2">
      {disclosure === null ? null : <p data-affiliate-disclosure="coupang">{disclosure}</p>}
      {stores.intro === null ? null : <p className="m-0 text-tt-sm font-medium [word-break:keep-all]">{stores.intro}</p>}
      <div className={layout === "row" ? "grid grid-cols-1 gap-2 min-[360px]:grid-cols-2" : "flex flex-col items-start gap-2"}>
        {stores.links.map((link) => (
          <ButtonLink
            key={`${link.channel}-${link.href}`}
            href={link.href}
            variant={link.weight}
            external
            sponsored={link.isAffiliate}
            label={link.label}
            placement={stores.placement}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Append the disclosure section to `app/styles/tokens.css`**

```css

/* ---------- 제휴 고지: 링크 묶음의 첫 줄. 흰 면에서는 muted, 색면 안에서는 색면 글자색 ---------- */
[data-affiliate-disclosure] {
  margin: 0;
  color: var(--tt-muted);
  font-size: var(--tt-text-xs);
  line-height: 18px;
  font-weight: 500;
  word-break: keep-all;
}
/* --tt-muted 는 색면 위에서 대비가 모자랍니다(1.03–4.31:1). 색면 안의 보조 글자는 색면 글자색 한 가지로 씁니다. */
[data-slot="status-head"] [data-affiliate-disclosure],
[data-slot="status-head"] .text-tt-muted {
  color: var(--field-fg);
}
```

- [ ] **Step 6: Extend the gallery page**

In `app/(internal)/internal/ui-kit/page.tsx`:

(a) Replace `import { Button } from "@/components/primitives/Button";` with

```tsx
import { AffiliateLinkGroup } from "@/components/primitives/AffiliateLinkGroup";
import { Button } from "@/components/primitives/Button";
import { TalkLink } from "@/components/primitives/TalkLink";
```

(b) Replace `import type { EtaDate, EtaView, NumberView, SpineView, Tone } from "@/lib/tracking/types";` with

```tsx
import type {
  ActionWeight,
  EtaDate,
  EtaView,
  NumberView,
  SpineView,
  StoreLinkView,
  StoreLinksView,
  StorePlacementId,
  Tone
} from "@/lib/tracking/types";
import { channels, disclosures } from "@/config/site.config";
```

(c) Replace `        <NumberBarSection />` with

```tsx
        <NumberBarSection />
        <LinkSection />
```

(d) Append to the end of the file:

```tsx
function storeLink(channel: StoreLinkView["channel"], placement: StorePlacementId, weight: ActionWeight): StoreLinkView {
  const store = channels[channel];
  return { channel, label: store.linkLabel, href: store.urls[placement], isAffiliate: store.isAffiliate, weight };
}

const DELIVERED_STORES: StoreLinksView = {
  placement: "deliveredLead",
  intro: null,
  disclosure: disclosures.coupang,
  links: [storeLink("naver", "deliveredLead", "primary"), storeLink("coupang", "deliveredLead", "secondary")]
};

const STORE_DEMOS: ReadonlyArray<{
  readonly demo: string;
  readonly caption: string;
  readonly layout: "row" | "stack";
  readonly stores: StoreLinksView;
}> = [
  {
    demo: "affiliate-pending",
    caption: "국내 도착 전 · 구매처 선택지 (고지 → 안내 → 링크)",
    layout: "row",
    stores: {
      placement: "pending",
      intro: "주문하신 곳에서도 배송 안내를 볼 수 있어요",
      disclosure: disclosures.coupang,
      links: [storeLink("naver", "pending", "secondary"), storeLink("coupang", "pending", "secondary")]
    }
  },
  { demo: "affiliate-delivered", caption: "배송 완료 · 스토어 선두", layout: "row", stores: DELIVERED_STORES },
  {
    demo: "affiliate-missing-disclosure",
    caption: "고지 문구가 빠진 뷰라도 제휴 링크가 있으면 고지를 붙여요",
    layout: "stack",
    stores: { placement: "showcase", intro: null, disclosure: null, links: [storeLink("coupang", "showcase", "secondary")] }
  },
  {
    demo: "affiliate-naver-only",
    caption: "제휴 링크가 없으면 고지도 없어요",
    layout: "stack",
    stores: { placement: "showcase", intro: null, disclosure: disclosures.coupang, links: [storeLink("naver", "showcase", "secondary")] }
  },
  {
    demo: "affiliate-empty",
    caption: "링크가 0개면 묶음을 그리지 않아요",
    layout: "row",
    stores: { placement: "pending", intro: null, disclosure: null, links: [] }
  }
];

function LinkSection(): React.JSX.Element {
  const talk = channels.talk;
  return (
    <Section id="links" title="톡톡 링크 · 스토어 링크 묶음">
      <p className="m-0 text-tt-sm text-tt-muted">
        톡톡은 한 가지 모양을 세 무게로 써요. 스토어 묶음은 제휴 링크가 있을 때 고지를 첫 줄에 붙여요.
      </p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 bg-tt-surface p-4">
        <span data-demo="talk-header">
          <TalkLink href={talk.url} label={talk.labels.header} weight="text" placement="header" />
        </span>
        <span data-demo="talk-state">
          <TalkLink href={talk.url} label={talk.labels.cta} weight="text" placement="state" />
        </span>
        <span data-demo="talk-secondary">
          <TalkLink href={talk.url} label={talk.labels.cta} weight="secondary" placement="state" />
        </span>
        <span data-demo="talk-primary">
          <TalkLink href={talk.url} label={talk.labels.cta} weight="primary" placement="state" />
        </span>
        <span data-demo="talk-footer">
          <TalkLink href={talk.url} label={talk.labels.footer} weight="text" placement="footer" />
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {STORE_DEMOS.map((item) => (
          <div key={item.demo} className="flex min-w-0 flex-col gap-2 bg-tt-surface p-4">
            <p className="m-0 text-tt-xs font-bold text-tt-muted">{item.caption}</p>
            <div data-demo={item.demo}>
              <AffiliateLinkGroup stores={item.stores} layout={item.layout} />
            </div>
          </div>
        ))}
      </div>
      <Field tone="attention" demo="field-links">
        <TalkLink href={talk.url} label="9월 29일(화)까지 그대로면 알려 주세요" weight="text" placement="state" />
        <AffiliateLinkGroup stores={DELIVERED_STORES} layout="row" />
        <p className="m-0 text-tt-xs text-tt-muted">색면 안에서는 보조 글자도 색면 글자색으로 바뀌어요.</p>
      </Field>
    </Section>
  );
}
```

- [ ] **Step 7: Run the whole gallery spec**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts`
Expected: `36 passed` (the generic focus test now also walks the 톡톡 and store links, in and out of a field).

- [ ] **Step 8: Confirm the primitives stay client-safe**

Run (S03's import scanner, no server needed): `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/module-boundaries.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all pass — `AffiliateLinkGroup` imports only the `disclosures` named export of `config/site.config.ts`, which roadmap §11.7 allows in client code.

- [ ] **Step 9: Lint, typecheck, commit**

Run: `npm run lint; npm run typecheck`
Expected: both exit 0.
Run: `git add components/primitives/TalkLink.tsx components/primitives/AffiliateLinkGroup.tsx app/styles/tokens.css "app/(internal)/internal/ui-kit/page.tsx" tests/e2e/ui-kit.spec.ts; git commit -m "feat: add TalkLink and the disclosure-first AffiliateLinkGroup"`

---

### Task 11: `NoticeBanner` and the one-shot motion that replaces framer-motion

**Files:**
- Create: `components/primitives/NoticeBanner.tsx`
- Modify: `app/styles/tokens.css` (append the motion section)
- Modify: `app/(internal)/internal/ui-kit/page.tsx` (imports; render `<NoticeSection />`; append `HOME_NOTICE`, `INLINE_NOTICES`, `NoticeSection`)
- Test: `tests/e2e/ui-kit.spec.ts` (append)

**Interfaces:**
- Consumes: `NoticeView` from `@/lib/tracking/types` (S03); `Field`, `Section` (Tasks 5–6); `tt-grow` (Task 7); motion tokens (Task 2).
- Produces: `NoticeBanner(props: { readonly notice: NoticeView; readonly variant: "banner" | "inline" }): React.JSX.Element` — banner: `<aside aria-label="안내" data-notice-kind data-notice-variant="banner">` with `<strong>안내</strong> {body}` on `--tt-ground`; inline: `<p data-notice-kind data-notice-variant="inline">` with an aria-hidden info icon and `<strong>안내</strong> {body}` in the inherited color. Never `aria-live`, `role="status"` or `role="alert"`. CSS: `[data-slot="status-head"]` paints once with `@keyframes tt-paint` in `--tt-motion-base`. This plus `tt-grow` is the complete replacement for framer-motion's result entrance (S06 uninstalls the package). Gallery: `HOME_NOTICE`, `INLINE_NOTICES`, `NoticeSection`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/e2e/ui-kit.spec.ts`:

```ts
// The spec's home banner example (spec §7, idle).
const HOME_NOTICE_BODY = "추석 연휴(9/24~26)와 주말에는 통관·택배가 쉬어요. 9월 28일(월)부터 순서대로 진행돼요.";

test.describe("NoticeBanner", () => {
  test("the home banner is an aside named '안내' with the body, at most two lines at 375px, never live", async ({ page }) => {
    await openKit(page, 375, 812);
    const banner = page.locator('[data-demo="notice-banner"] aside');
    await expect(banner).toHaveAttribute("aria-label", "안내");
    await expect(banner).toHaveAttribute("data-notice-kind", "holiday");
    await expect(banner).toHaveAttribute("data-notice-variant", "banner");
    await expect(banner).toHaveText(`안내 ${HOME_NOTICE_BODY}`);
    expect(await banner.getAttribute("aria-live")).toBeNull();
    expect(await banner.getAttribute("role")).toBeNull();
    expect((await banner.boundingBox())?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(56);
  });

  test("the in-card line carries '안내', one icon and the field's text color for every notice kind", async ({ page }) => {
    await openKit(page);
    for (const kind of ["outage", "delay", "holiday", "info"] as const) {
      const field = page.locator(`[data-demo="notice-inline-${kind}"]`);
      const line = field.locator('[data-notice-variant="inline"]');
      await expect(line, kind).toHaveAttribute("data-notice-kind", kind);
      await expect(line.locator("strong"), kind).toHaveText("안내");
      await expect(line.locator('svg[aria-hidden="true"]'), kind).toHaveCount(1);
      const fieldColor = await field.evaluate((element) => getComputedStyle(element).color);
      const lineColor = await line.evaluate((element) => getComputedStyle(element).color);
      expect(lineColor, kind).toBe(fieldColor);
      expect(await line.getAttribute("aria-live"), kind).toBeNull();
    }
  });
});

test.describe("motion", () => {
  test("every animation in the gallery runs once within 150–300 ms", async ({ page }) => {
    await openKit(page);
    const animated = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main[data-ui-kit] *"))
        .map((element) => getComputedStyle(element))
        .filter((style) => style.animationName !== "none")
        .map((style) => ({ name: style.animationName, duration: style.animationDuration, count: style.animationIterationCount }))
    );
    expect(new Set(animated.map((item) => item.name))).toEqual(new Set(["tt-paint", "tt-grow"]));
    for (const item of animated) {
      expect(item.count, item.name).toBe("1");
      const ms = item.duration.endsWith("ms") ? Number.parseFloat(item.duration) : Number.parseFloat(item.duration) * 1000;
      expect(ms, item.name).toBeGreaterThanOrEqual(150);
      expect(ms, item.name).toBeLessThanOrEqual(300);
    }
  });

  test("reduced motion: every animation and transition in the gallery takes 0 ms", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openKit(page);
    const moving = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main[data-ui-kit] *"))
        .map((element) => {
          const style = getComputedStyle(element);
          return `${style.animationDuration},${style.transitionDuration}`;
        })
        .filter((durations) => durations.split(",").some((part) => Number.parseFloat(part) !== 0))
    );
    expect(moving).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts -g "NoticeBanner|motion"`
Expected: 3 FAIL, 1 PASS — the two NoticeBanner tests fail (`[data-demo="notice-banner"] aside` resolves to 0 elements) and the once-only test fails with `Expected: Set {"tt-paint", "tt-grow"}` / `Received: Set {"tt-grow"}`; the reduced-motion test already passes (Task 2's override covers `tt-grow` and the button transitions) and must stay green.

- [ ] **Step 3: Create `components/primitives/NoticeBanner.tsx`**

```tsx
import type { NoticeView } from "@/lib/tracking/types";

const NOTICE_LEAD = "안내";

function NoticeIcon(): React.JSX.Element {
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
      className="mt-0.5 shrink-0"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <path d="M12 7v1" />
    </svg>
  );
}

/**
 * Notice line. "banner": the home strip under the header (ground, 12px, about two lines).
 * "inline": the '안내' line inside the status card; it inherits the field's text color.
 * Never a live region — notices are not announced on page load. Shows '안내' + body; `title` is for CS replies
 * and the internal notices tab.
 */
export function NoticeBanner({ notice, variant }: { readonly notice: NoticeView; readonly variant: "banner" | "inline" }): React.JSX.Element {
  if (variant === "banner") {
    return (
      <aside
        aria-label={NOTICE_LEAD}
        data-notice-kind={notice.kind}
        data-notice-variant="banner"
        className="bg-tt-ground px-[var(--tt-gutter)] py-2.5 text-tt-ink"
      >
        <p className="m-0 mx-auto max-w-[var(--tt-column)] text-tt-xs font-medium [word-break:keep-all]">
          <strong className="font-black">{NOTICE_LEAD}</strong> {notice.body}
        </p>
      </aside>
    );
  }
  return (
    <p
      data-notice-kind={notice.kind}
      data-notice-variant="inline"
      className="m-0 flex items-start gap-1.5 text-tt-sm font-medium [word-break:keep-all]"
    >
      <NoticeIcon />
      <span>
        <strong className="font-black">{NOTICE_LEAD}</strong> {notice.body}
      </span>
    </p>
  );
}
```

- [ ] **Step 4: Append the motion section to `app/styles/tokens.css`**

```css

/* ---------- 한 번만 움직이는 모션 ----------
 * 결과가 오면 색면이 한 번 칠해지고(--tt-motion-base, 200ms) 척추의 지금 칸이 한 번 자랍니다(journey 절의 tt-grow, 250ms).
 * framer-motion 의 결과 등장 모션(opacity·y 이동)을 대신합니다. opacity:0 으로 시작하지 않고, 무한 반복이 없고,
 * 줄인 모션이면 토큰이 0ms 가 되어 바로 끝납니다. */
[data-slot="status-head"] {
  animation: tt-paint var(--tt-motion-base) var(--tt-ease) 1;
}
@keyframes tt-paint {
  from { background-color: var(--tt-ground); }
}
```

- [ ] **Step 5: Extend the gallery page**

In `app/(internal)/internal/ui-kit/page.tsx`:

(a) Replace `import { Button } from "@/components/primitives/Button";` with

```tsx
import { Button } from "@/components/primitives/Button";
import { NoticeBanner } from "@/components/primitives/NoticeBanner";
```

(b) In the `import type { … } from "@/lib/tracking/types";` block, replace the line `  NumberView,` with

```tsx
  NoticeView,
  NumberView,
```

(c) Replace `        <LinkSection />` with

```tsx
        <LinkSection />
        <NoticeSection />
```

(d) Append to the end of the file:

```tsx
const HOME_NOTICE: NoticeView = {
  id: "demo-chuseok-home",
  kind: "holiday",
  title: "추석 연휴 안내",
  body: "추석 연휴(9/24~26)와 주말에는 통관·택배가 쉬어요. 9월 28일(월)부터 순서대로 진행돼요."
};

const INLINE_NOTICES: ReadonlyArray<{ readonly tone: Tone; readonly notice: NoticeView }> = [
  {
    tone: "attention",
    notice: { id: "demo-outage", kind: "outage", title: "통관 조회 점검", body: "UNI-PASS 점검(22:00~24:00) 중에는 통관 정보가 늦게 보일 수 있어요" }
  },
  { tone: "progress", notice: { id: "demo-delay", kind: "delay", title: "배송 지연", body: "택배 물량이 많아 배송이 하루 늦어질 수 있어요" } },
  { tone: "progress", notice: { id: "demo-holiday", kind: "holiday", title: "추석 연휴", body: "추석 연휴로 통관이 9월 28일(월)부터 이어져요." } },
  { tone: "waiting", notice: { id: "demo-info", kind: "info", title: "화면 안내", body: "조회 화면이 새로 바뀌었어요" } }
];

function NoticeSection(): React.JSX.Element {
  return (
    <Section id="notices" title="공지 줄">
      <p className="m-0 text-tt-sm text-tt-muted">공지는 화면당 하나예요. 화면을 열 때 읽어 주는 알림으로 만들지 않아요.</p>
      <div data-demo="notice-banner" className="-mx-4 sm:mx-0">
        <NoticeBanner notice={HOME_NOTICE} variant="banner" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {INLINE_NOTICES.map((item) => (
          <Field key={item.notice.id} tone={item.tone} demo={`notice-inline-${item.notice.kind}`}>
            <NoticeBanner notice={item.notice} variant="inline" />
          </Field>
        ))}
      </div>
    </Section>
  );
}
```

- [ ] **Step 6: Run the whole gallery spec**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts`
Expected: `40 passed` (`openKit` waits for `tt-paint`, so the contrast test measures the final field colors).

- [ ] **Step 7: Lint, typecheck, commit**

Run: `npm run lint; npm run typecheck`
Expected: both exit 0.
Run: `git add components/primitives/NoticeBanner.tsx app/styles/tokens.css "app/(internal)/internal/ui-kit/page.tsx" tests/e2e/ui-kit.spec.ts; git commit -m "feat: add NoticeBanner and the one-shot field paint motion"`

---

### Task 12: `CopyButton` — copy or copy-and-open, with a selectable fallback

**Files:**
- Create: `components/primitives/CopyButton.tsx` (client)
- Create: `app/(internal)/internal/ui-kit/UiKitInteractive.tsx` (client)
- Modify: `app/(internal)/internal/ui-kit/page.tsx` (imports; render `<CopySection />`; append `DEMO_NOW`, `DEMO_NUMBER`, `CopySection`)
- Test: `tests/e2e/ui-kit.spec.ts` (imports, append)

**Interfaces:**
- Consumes: `copyText(text: string): Promise<CopyOutcome>` and `CopyOutcome` from `@/lib/clipboard` (S02); `buildReturnLink(number, carrier)` from `@/lib/site` (S01); `buildInquiryCopy(input)` from `@/lib/tracking/inquiry-copy` (S03); `channels` (S03); `Button`, `buttonClassName`, `ButtonVariant` (Task 5); `numberView` (Task 9).
- Produces: `CopyButton(props: CopyButtonProps): React.JSX.Element` and `export type CopyButtonProps` (Addition 2) — `mode: "copy"` renders a `Button` whose text becomes `copiedLabel` after a successful copy; `mode: "copyAndOpen"` renders `<a href target="_blank" rel="noopener noreferrer" aria-label="${label} 새 창으로 열기" data-slot="button">` and copies in the same click without preventing navigation. On outcome `"fallback"` (or any thrown/rejected copy) it shows `<textarea readonly data-copy-fallback="true" aria-label={label}>` holding exactly `text`, focused with the whole text selected. `onCopied(outcome)` is called once per click. No live region. A new `text` prop clears the previous outcome (derived state, no effect). Gallery: `UiKitInteractive({ returnLink, inquiryText, talkUrl, talkLabel })` with `data-demo="copy"` / `data-demo="copy-and-open"`, `data-copy-text`, `data-copy-outcome` (`none|copied|fallback`); `CopySection`. Test helper `blockClipboard(page, "reject" | "missing")`.

- [ ] **Step 1: Write the failing tests**

In `tests/e2e/ui-kit.spec.ts`, replace `import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";` with

```ts
import { buildReturnLink } from "@/lib/site";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
```

Append to the end of the file:

```ts
/** In-app browser stand-in: the clipboard API rejects (or is missing) and execCommand('copy') returns false. */
async function blockClipboard(page: Page, mode: "reject" | "missing"): Promise<void> {
  await page.addInitScript((kind: "reject" | "missing") => {
    const blocked = () => Promise.reject(new DOMException("Blocked by the in-app browser", "NotAllowedError"));
    Object.defineProperty(Navigator.prototype, "clipboard", {
      configurable: true,
      get: () => (kind === "missing" ? undefined : { writeText: blocked, readText: blocked })
    });
    document.execCommand = () => false;
  }, mode);
}

test.describe("CopyButton", () => {
  test("copy writes the exact text and switches to the copied label", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await openKit(page);
    const demo = page.locator('[data-demo="copy"]');
    const expected = (await demo.getAttribute("data-copy-text")) ?? "";
    expect(expected).toBe(buildReturnLink(FAKE.domestic, "AUTO"));
    await demo.getByRole("button", { name: "다시 볼 링크 복사" }).click();
    await expect(demo).toHaveAttribute("data-copy-outcome", "copied");
    await expect(demo.getByRole("button")).toHaveText("링크를 복사했어요");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
    await expect(demo.locator("[data-copy-fallback]")).toHaveCount(0);
  });

  for (const mode of ["reject", "missing"] as const) {
    test(`falls back to a selected read-only text box when the clipboard is ${mode === "reject" ? "blocked" : "missing"}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await blockClipboard(page, mode);
      await openKit(page);
      const demo = page.locator('[data-demo="copy"]');
      const expected = (await demo.getAttribute("data-copy-text")) ?? "";
      await demo.getByRole("button", { name: "다시 볼 링크 복사" }).click();
      const box = demo.locator("textarea[data-copy-fallback]");
      await expect(box).toBeVisible();
      await expect(box).toHaveAttribute("readonly", "");
      await expect(box).toHaveValue(expected);
      await expect(box).toBeFocused();
      expect(await box.evaluate((area: HTMLTextAreaElement) => [area.selectionStart, area.selectionEnd])).toEqual([0, expected.length]);
      await expect(demo).toHaveAttribute("data-copy-outcome", "fallback");
      await expect(demo.getByRole("button")).toHaveText("다시 볼 링크 복사");
      expect(errors).toEqual([]);
    });
  }

  test("copyAndOpen opens 톡톡 in a new tab in the same click and still shows the fallback box", async ({ page }) => {
    await page.context().route(`${new URL(channels.talk.url).origin}/**`, (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>talk</title>" })
    );
    await blockClipboard(page, "reject");
    await openKit(page);
    const demo = page.locator('[data-demo="copy-and-open"]');
    const link = demo.getByRole("link", { name: `${channels.talk.labels.copyAndTalk} 새 창으로 열기` });
    await expect(link).toHaveAttribute("href", channels.talk.url);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(link).toHaveAttribute("data-variant", "primary");
    const popupPromise = page.context().waitForEvent("page");
    await link.click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    expect(popup.url()).toBe(channels.talk.url);
    await popup.close();
    await expect(demo.locator("textarea[data-copy-fallback]")).toHaveValue((await demo.getAttribute("data-copy-text")) ?? "");
    await expect(demo).toHaveAttribute("data-copy-outcome", "fallback");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts -g "CopyButton"`
Expected: 4 FAIL — `[data-demo="copy"]` / `[data-demo="copy-and-open"]` not found (`getAttribute` times out).

- [ ] **Step 3: Create `components/primitives/CopyButton.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { copyText, type CopyOutcome } from "@/lib/clipboard";
import { Button, buttonClassName, type ButtonVariant } from "./Button";

const NEW_WINDOW_SUFFIX = " 새 창으로 열기";

interface CopyButtonBase {
  readonly text: string;
  readonly label: string;
  readonly variant: ButtonVariant;
  readonly onCopied?: (outcome: CopyOutcome) => void;
}

export type CopyButtonProps =
  | (CopyButtonBase & { readonly mode: "copy"; readonly copiedLabel: string })
  | (CopyButtonBase & { readonly mode: "copyAndOpen"; readonly href: string });

interface CopyResult {
  readonly text: string;
  readonly outcome: CopyOutcome;
}

function startCopy(text: string): Promise<CopyOutcome> {
  try {
    return copyText(text).catch((): CopyOutcome => "fallback");
  } catch {
    return Promise.resolve("fallback");
  }
}

/**
 * Copies `text` (roadmap §11.9). "copy" is a button; "copyAndOpen" is a new-tab link that copies in the same
 * click, so the popup blocker and the clipboard's user-activation rule both see one gesture. When the clipboard
 * is blocked (Naver/Kakao in-app browsers) a read-only textarea with the whole text selected appears below the
 * control. It never throws. Announcing the result is the caller's job (onCopied → useAnnounce); no live region here.
 */
export function CopyButton(props: CopyButtonProps): React.JSX.Element {
  const { text, label, variant, onCopied } = props;
  const [result, setResult] = useState<CopyResult | null>(null);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  // A result belongs to the text it copied; a new text starts fresh without an effect.
  const outcome = result !== null && result.text === text ? result.outcome : null;

  useEffect(() => {
    if (outcome !== "fallback") return;
    const box = fallbackRef.current;
    if (box === null) return;
    box.focus();
    box.select();
  }, [outcome]);

  const copy = (): void => {
    void startCopy(text).then((next) => {
      setResult({ text, outcome: next });
      onCopied?.(next);
    });
  };

  const trigger =
    props.mode === "copy" ? (
      <Button variant={variant} onClick={copy}>
        {outcome === "copied" ? props.copiedLabel : label}
      </Button>
    ) : (
      <a
        href={props.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${label}${NEW_WINDOW_SUFFIX}`}
        data-slot="button"
        data-variant={variant}
        data-size="md"
        className={buttonClassName(variant, "md")}
        onClick={copy}
      >
        {label}
      </a>
    );

  return (
    <div className="flex w-full max-w-full flex-col items-start gap-2">
      {trigger}
      {outcome === "fallback" ? (
        <textarea
          ref={fallbackRef}
          readOnly
          value={text}
          aria-label={label}
          data-copy-fallback="true"
          rows={3}
          onFocus={(event) => event.currentTarget.select()}
          className="tt-focus block w-full min-w-0 resize-none border-2 border-solid border-tt-ink bg-tt-surface p-3 font-tt-body text-tt-md text-tt-ink"
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Create `app/(internal)/internal/ui-kit/UiKitInteractive.tsx`**

```tsx
"use client";

import { useState } from "react";
import { CopyButton } from "@/components/primitives/CopyButton";
import type { CopyOutcome } from "@/lib/clipboard";

/** Client island of the gallery: CopyButton demos that expose their outcome as data-copy-outcome for tests. */
export function UiKitInteractive({
  returnLink,
  inquiryText,
  talkUrl,
  talkLabel
}: {
  readonly returnLink: string;
  readonly inquiryText: string;
  readonly talkUrl: string;
  readonly talkLabel: string;
}): React.JSX.Element {
  const [copyOutcome, setCopyOutcome] = useState<CopyOutcome | "none">("none");
  const [talkOutcome, setTalkOutcome] = useState<CopyOutcome | "none">("none");
  return (
    <div className="flex flex-col gap-3">
      <div data-demo="copy" data-copy-text={returnLink} data-copy-outcome={copyOutcome} className="bg-tt-surface p-4">
        <CopyButton
          mode="copy"
          text={returnLink}
          label="다시 볼 링크 복사"
          copiedLabel="링크를 복사했어요"
          variant="secondary"
          onCopied={setCopyOutcome}
        />
      </div>
      <div data-demo="copy-and-open" data-copy-text={inquiryText} data-copy-outcome={talkOutcome} className="bg-tt-surface p-4">
        <CopyButton mode="copyAndOpen" text={inquiryText} label={talkLabel} href={talkUrl} variant="primary" onCopied={setTalkOutcome} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Extend the gallery page**

In `app/(internal)/internal/ui-kit/page.tsx`:

(a) Replace `import type { Metadata } from "next";` with

```tsx
import type { Metadata } from "next";
import { UiKitInteractive } from "./UiKitInteractive";
import { buildReturnLink } from "@/lib/site";
import { buildInquiryCopy } from "@/lib/tracking/inquiry-copy";
```

(b) Replace `        <NoticeSection />` with

```tsx
        <NoticeSection />
        <CopySection />
```

(c) Append to the end of the file:

```tsx
const DEMO_NOW = new Date("2026-09-26T14:05:00+09:00");
const DEMO_NUMBER = "000012345678";

function CopySection(): React.JSX.Element {
  // '[배송 문의] 조회번호 0000 1234 5678 / 조회 화면 오류 / 9월 26일 14:05' (S03's inquiry copy)
  const inquiryText = buildInquiryCopy({ kind: "screenError", number: numberView(DEMO_NUMBER), now: DEMO_NOW });
  return (
    <Section id="copy" title="복사 버튼">
      <p className="m-0 text-tt-sm text-tt-muted">
        클립보드가 막힌 인앱 브라우저에서는 내용을 고른 상태의 읽기 전용 글상자를 보여 줘요. 문의 복사 버튼은 같은 클릭에서 톡톡을 새 창으로 열어요.
      </p>
      <UiKitInteractive
        returnLink={buildReturnLink(DEMO_NUMBER, "AUTO")}
        inquiryText={inquiryText}
        talkUrl={channels.talk.url}
        talkLabel={channels.talk.labels.copyAndTalk}
      />
    </Section>
  );
}
```

- [ ] **Step 6: Run the whole gallery spec**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts`
Expected: `44 passed`.

- [ ] **Step 7: Lint, typecheck, build, commit**

Run: `npm run lint; npm run typecheck; npm run build`
Expected: all exit 0; the route table lists `/internal/ui-kit`.
Run: `git add components/primitives/CopyButton.tsx "app/(internal)/internal/ui-kit/UiKitInteractive.tsx" "app/(internal)/internal/ui-kit/page.tsx" tests/e2e/ui-kit.spec.ts; git commit -m "feat: add CopyButton with a selectable fallback for blocked clipboards"`

---

### Task 13: `DESIGN.md` — the single design source

**Files:**
- Modify: `DESIGN.md` (rewrite the whole file)
- Test: `tests/unit/tokens.spec.ts` (imports, append)

**Interfaces:**
- Consumes: `COLOR_TOKENS`, `NON_COLOR_TOKENS`, `CONTRAST_REQUIREMENTS`, `contrastRatio`, `signalColors()`, `readRepoFile()` (Tasks 1–2); `disclosures.coupang` (S03 config); every primitive name and hook from Tasks 5–12.
- Produces: `DESIGN.md` whose color table rows read ``| `--tt-x` | `#RRGGBB` | …`` for all 30 color tokens, whose contrast rows read ``| `fg` / `bg` | N.NN:1 | M:1 |`` for all 22 requirements, and which names every non-color token, slot, S05 hook, `tt-paint`/`tt-grow`, every primitive, and the current `disclosures.coupang` sentence. S08 appends its style sections to this file (roadmap §10.5).

- [ ] **Step 1: Write the failing tests**

In `tests/unit/tokens.spec.ts`, replace `import tailwindConfig from "@/tailwind.config";` with

```ts
import tailwindConfig from "@/tailwind.config";
import { disclosures } from "@/config/site.config";
```

Append to the end of the file:

```ts
test.describe("DESIGN.md is the single source", () => {
  const design = (): string => readRepoFile("DESIGN.md");

  test("lists every signal color token with its value", () => {
    const text = design();
    const signal = signalColors();
    const missing = COLOR_TOKENS.filter((token) => !new RegExp(`\\|\\s*\`${token}\`\\s*\\|\\s*\`${signal[token]}\`\\s*\\|`).test(text));
    expect(missing).toEqual([]);
  });

  test("names every non-color token, variant slot, S05 hook and the two motions", () => {
    const text = design();
    const names = [
      ...NON_COLOR_TOKENS,
      'data-slot="status-head"',
      'data-slot="eta"',
      'data-slot="journey"',
      'data-slot="button"',
      "data-tone",
      "data-status-chip",
      "data-station",
      "data-station-state",
      "data-issue",
      "data-spine-current",
      "data-eta-kind",
      "data-number-bar",
      "data-affiliate-group",
      "data-affiliate-disclosure",
      "data-link-placement",
      "data-notice-kind",
      "tt-paint",
      "tt-grow"
    ];
    expect(names.filter((name) => !text.includes(`\`${name}\``))).toEqual([]);
  });

  test("its contrast table matches the computed ratios", () => {
    const text = design();
    const signal = signalColors();
    const wrong = CONTRAST_REQUIREMENTS.filter(({ fg, bg, min }) => {
      const ratio = contrastRatio(signal[fg], signal[bg]).toFixed(2);
      return !text.includes(`| \`${fg}\` / \`${bg}\` | ${ratio}:1 | ${min}:1 |`);
    }).map(({ fg, bg }) => `${fg} / ${bg}`);
    expect(wrong).toEqual([]);
  });

  test("documents every primitive and the configured disclosure wording", () => {
    const text = design();
    const primitives = [
      "Button", "ButtonLink", "ToneIcon", "StatusChip", "JourneySpine", "EtaDisplay",
      "NumberBar", "CopyButton", "AffiliateLinkGroup", "NoticeBanner", "TalkLink", "LiveAnnouncer"
    ];
    expect(primitives.filter((name) => !text.includes(`\`${name}\``))).toEqual([]);
    expect(text).toContain(disclosures.coupang);
  });

  test("carries no legacy tokens or fonts", () => {
    const text = design();
    const legacy = ["background-base", "accent-info", "accent-action", "surface-luminous", "IBM Plex", "Space Grotesk", "4.8s loop"];
    expect(legacy.filter((word) => text.includes(word))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/tokens.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: 5 FAIL (the old DESIGN.md has no `--tt-*` rows, names none of the hooks, quotes the legacy tokens and IBM Plex), 17 pass.

- [ ] **Step 3: Check which disclosure sentence is configured**

Run: `Select-String -Path config/site.config.ts -Pattern '^\s*coupang: "'`
Expected: one match — the `disclosures.coupang` line (the `channels.coupang` entry opens with `{`, not a quote, so it does not match). The DESIGN.md text below quotes the fallback sentence '쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.' (approval 9 pending). If the matched line holds any other sentence, S03's approval-9 follow-up (S03 Task 16) already ran: that is the default proposal '쿠팡 링크는 쿠팡 파트너스 활동의 일환으로, 구매 시 운영자가 수수료를 받습니다.' or the legally reviewed wording recorded in roadmap §4 row 9, which S03 Task 16 Step 2 puts in place of the proposal. Write that exact sentence (the text between the quotes) in §10 instead; Task 14 Steps 12–13 quote the same sentence, and Task 15 then only verifies.

- [ ] **Step 4: Replace `DESIGN.md` with this content**

````markdown
# 통관·배송 조회 디자인 시스템

> 이 문서가 화면 디자인의 **단일 기준**입니다. 값의 원본은 `app/styles/tokens.css`(화면)와 `lib/style/tokens.ts`(대비 검사)이고, `tests/unit/tokens.spec.ts`가 이 문서·CSS·TypeScript·Tailwind 설정·`design-system/` 미리보기가 같은 값을 쓰는지 검사합니다. 공통 부품은 `/internal/ui-kit`(내부 인증)에서 실제 코드로 볼 수 있습니다. 전략과 정보 구조는 `docs/superpowers/specs/2026-09-26-tracking-renewal-ia-design.md`를 따릅니다.

## 1. 원칙

- 고객은 배송이 궁금하거나 불안한 상태로 옵니다. 읽는 순서는 조회 → 지금 상태 → 예상일 → 해야 할 일이고, 자세한 처리 내역은 원할 때만 펼칩니다.
- 화면에서 가장 큰 글자는 도착 예상 날짜(32–40px)입니다. 마케팅 제목이 상태나 날짜보다 커지지 않습니다.
- 상태는 색·아이콘·글자를 함께 써서 알립니다(WCAG 1.4.1). 빨강은 '문제'에만 씁니다. '확인 필요'는 앰버 면에 잉크 글자입니다.
- 채움색 주 버튼은 화면당 1개입니다. 톡톡·스토어는 보조(외곽선 또는 텍스트)이고, 문제 상태에서만 톡톡이 주 버튼이 됩니다.
- 모션은 150–300ms 한 번뿐입니다. 무한 반복은 없고, 줄인 모션 설정이면 0입니다.
- 버리는 것: 글로우 그림자, 흐림 원형 장식, 격자 배경, 그라디언트 버튼, 장식용 번호(01/02/03), 뜻 없는 아이콘.
- 고객 언어로 씁니다. 브랜드·로봇·AI 표현을 쓰지 않고, 한글 문장은 낱말 단위로 줄을 바꿉니다(`word-break: keep-all`).
- 실제 고객 번호는 어디에도 쓰지 않습니다. 예시는 `0000 1234 5678`, `TEST 0000 0001`, `ABCD 0000 0000`처럼 0000·TEST·ABCD 계열만 씁니다.

## 2. 화면 스타일

| id | 고객에게 보이는 이름 | 상태 | 성격 |
|---|---|---|---|
| `signal` | 기본 | R3 기본값(구현됨) | 결과 상단을 상태 톤 단색 면으로 채우고 도착일을 굵고 크게 세웁니다. 장식 0. |
| `manifest` | 서류형 | R3b에서 추가 | 차가운 종이 바탕, 라벨-값 괘선, 상태 도장 한 개, 고정폭 기입값. |
| `night` | 어두운 화면 | R3b에서 추가 | 채도를 뺀 어두운 바탕, 노선도형 여정, 평면 램프, 숫자 타일. |

- 스타일 = 토큰 세트(`html[data-style]` 범위의 CSS 변수) + 변형 슬롯 4개(8장). 부품 구조, DOM 순서, `data-*` 훅, 문구, 배치 규칙은 스타일과 무관합니다.
- 지금은 `app/layout.tsx`가 `<html data-style="signal">`로 고정합니다. '화면 스타일' 고르기, 저장(`localStorage` `tt:style`), 첫 페인트 전 스크립트, 서류형·어두운 화면 토큰은 R3b에서 더합니다.
- `:root`에도 signal 값이 있어서 `data-style`이 없어도 기본 스타일로 보입니다.

## 3. 색 토큰 (signal)

`-tone-X`는 색면·표식 색, `-tone-X-on`은 그 색면 위 글자·아이콘, `-tone-X-ink`는 흰 면 위에서 그 톤을 글자·아이콘으로 쓸 때의 색입니다.

| 토큰 | 값 | Tailwind | 쓰임 |
|---|---|---|---|
| `--tt-ground` | `#EEEDE8` | `bg-tt-ground` | 페이지 바탕, 공지 배너, 중립 색면 |
| `--tt-surface` | `#FFFFFF` | `bg-tt-surface` | 번호 바, 카드, 입력칸 면 |
| `--tt-raised` | `#FFFFFF` | `bg-tt-raised` | 겹쳐 뜨는 면(signal은 surface와 같음) |
| `--tt-ink` | `#111110` | `text-tt-ink` | 본문 글자, 선, 외곽선 버튼 |
| `--tt-muted` | `#5C5B56` | `text-tt-muted` | 보조 글자(흰 면·바탕 위에서만) |
| `--tt-rule` | `#D3D2CB` | `border-tt-rule` | 장식 구분선(대비 요구 없음) |
| `--tt-control` | `#767570` | `border-tt-control` | 입력칸·라디오 경계(3:1) |
| `--tt-route` | `#85847E` | `bg-tt-route` | 흰 면 위의 경로·보조선(3:1) |
| `--tt-primary` | `#111110` | `bg-tt-primary` | 화면당 하나인 채움 버튼 |
| `--tt-on-primary` | `#FFFFFF` | `text-tt-on-primary` | 채움 버튼 글자 |
| `--tt-accent` | `#2244D1` | `bg-tt-accent` | 신호 파랑(링크에는 쓰지 않음) |
| `--tt-link` | `#111110` | `text-tt-link` | 텍스트 링크(잉크 + 2px 밑줄, '정상 진행' 파랑과 분리) |
| `--tt-focus` | `#111110` | `outline-tt-focus` | 흰 면·바탕 위 포커스 링 |
| `--tt-tile` | `#FFFFFF` | `bg-tt-tile` | 숫자 타일 면(signal은 surface와 같음) |
| `--tt-board` | `#111110` | `text-tt-board` | 숫자 타일 글자 |
| `--tt-tone-progress` | `#2244D1` | `bg-tt-progress` | 정상 진행 색면 |
| `--tt-tone-progress-on` | `#FFFFFF` | `text-tt-progress-on` | 정상 진행 색면 위 글자·아이콘 |
| `--tt-tone-progress-ink` | `#2244D1` | `text-tt-progress-ink` | 흰 면 위 정상 진행 글자·아이콘 |
| `--tt-tone-waiting` | `#CFCEC6` | `bg-tt-waiting` | 정보 대기 색면 |
| `--tt-tone-waiting-on` | `#111110` | `text-tt-waiting-on` | 정보 대기 색면 위 글자 |
| `--tt-tone-waiting-ink` | `#5C5B56` | `text-tt-waiting-ink` | 흰 면 위 정보 대기 글자 |
| `--tt-tone-attention` | `#F4BC00` | `bg-tt-attention` | 확인 필요 색면(앰버) |
| `--tt-tone-attention-on` | `#111110` | `text-tt-attention-on` | 확인 필요 색면 위 글자(잉크) |
| `--tt-tone-attention-ink` | `#8A5A00` | `text-tt-attention-ink` | 흰 면 위 확인 필요 글자 |
| `--tt-tone-problem` | `#C8261D` | `bg-tt-problem` | 문제 색면(빨강은 여기만) |
| `--tt-tone-problem-on` | `#FFFFFF` | `text-tt-problem-on` | 문제 색면 위 글자 |
| `--tt-tone-problem-ink` | `#C8261D` | `text-tt-problem-ink` | 흰 면 위 문제 글자 |
| `--tt-tone-done` | `#0B6B3E` | `bg-tt-done` | 완료 색면 |
| `--tt-tone-done-on` | `#FFFFFF` | `text-tt-done-on` | 완료 색면 위 글자 |
| `--tt-tone-done-ink` | `#0B6B3E` | `text-tt-done-ink` | 흰 면 위 완료 글자 |

## 4. 대비 기준

모든 구현 스타일이 아래 기준을 통과해야 합니다(`lib/style/tokens.ts`의 `CONTRAST_REQUIREMENTS`). 수치는 signal 값입니다.

| 글자 / 바탕 | signal | 기준 |
|---|---|---|
| `--tt-ink` / `--tt-surface` | 18.89:1 | 4.5:1 |
| `--tt-ink` / `--tt-ground` | 16.12:1 | 4.5:1 |
| `--tt-muted` / `--tt-surface` | 6.81:1 | 4.5:1 |
| `--tt-muted` / `--tt-ground` | 5.81:1 | 4.5:1 |
| `--tt-link` / `--tt-surface` | 18.89:1 | 4.5:1 |
| `--tt-link` / `--tt-ground` | 16.12:1 | 4.5:1 |
| `--tt-on-primary` / `--tt-primary` | 18.89:1 | 4.5:1 |
| `--tt-tone-progress-on` / `--tt-tone-progress` | 7.46:1 | 4.5:1 |
| `--tt-tone-waiting-on` / `--tt-tone-waiting` | 11.96:1 | 4.5:1 |
| `--tt-tone-attention-on` / `--tt-tone-attention` | 10.83:1 | 4.5:1 |
| `--tt-tone-problem-on` / `--tt-tone-problem` | 5.60:1 | 4.5:1 |
| `--tt-tone-done-on` / `--tt-tone-done` | 6.59:1 | 4.5:1 |
| `--tt-tone-progress-ink` / `--tt-surface` | 7.46:1 | 4.5:1 |
| `--tt-tone-waiting-ink` / `--tt-surface` | 6.81:1 | 4.5:1 |
| `--tt-tone-attention-ink` / `--tt-surface` | 5.93:1 | 4.5:1 |
| `--tt-tone-problem-ink` / `--tt-surface` | 5.60:1 | 4.5:1 |
| `--tt-tone-done-ink` / `--tt-surface` | 6.59:1 | 4.5:1 |
| `--tt-board` / `--tt-tile` | 18.89:1 | 4.5:1 |
| `--tt-control` / `--tt-surface` | 4.62:1 | 3:1 |
| `--tt-route` / `--tt-surface` | 3.75:1 | 3:1 |
| `--tt-focus` / `--tt-surface` | 18.89:1 | 3:1 |
| `--tt-focus` / `--tt-ground` | 16.12:1 | 3:1 |

- `--tt-muted`는 색면 위에서 1.03–4.31:1이라 쓰지 않습니다. 색면 안의 보조 글자는 색면 글자색(`--field-fg`)으로 바뀝니다.
- 포커스 링은 흰 면·바탕 위에서 `--tt-focus`, 색면 안에서 그 색면의 글자색이라 어디서나 3:1 이상입니다.
- 11px 이하 글자는 없습니다. 행동 문구는 14px 이상입니다.

## 5. 글자

- 본문·제목: 시스템 한글 고딕(`--tt-font-body`, `--tt-font-display`: Apple SD Gothic Neo, 맑은 고딕, Noto Sans KR …). 내려받는 파일 0KB.
- 조회번호 숫자: DM Mono 500 latin 서브셋 1파일(`--tt-font-mono`; `next/font`가 `--font-dm-mono`로 연결하고 preload).
- 폰트 예산: preload 2파일 이하(signal은 1), 첫 화면 100KB 이하. 서류형·어두운 화면의 서체는 그 스타일을 고른 경우에만 내려받습니다.
- 제목 굵기 `--tt-weight-display` 800. 줄 간격 `--tt-leading-tight` 1.25, `--tt-leading-body` 1.5. 숫자는 `tabular-nums`.

| 토큰 | 크기 | 줄 높이 | Tailwind | 쓰임 |
|---|---|---|---|---|
| `--tt-text-xs` | 12px | 18px | `text-tt-xs` | 척추 라벨, 고지, 원문 용어, 번호 바 라벨, 공지 배너 |
| `--tt-text-sm` | 14px | 20px | `text-tt-sm` | 칩, 이유 한 줄, 안내 줄, 배지 |
| `--tt-text-md` | 16px | 24px | `text-tt-md` | 본문, 버튼, 입력 |
| `--tt-text-lg` | 20px | 28px | `text-tt-lg` | 상태 제목(h2), 지금 할 일 제목(h3), 조회번호 |
| `--tt-text-xl` | 24px | 32px | `text-tt-xl` | 홈 제목(h1) |
| `--tt-text-eta` | 40px | 1.1 | `text-tt-eta` | 도착 예상 날짜(화면 최대 글자) |

## 6. 간격·크기·레이아웃

| 토큰 | signal | 쓰임 |
|---|---|---|
| `--tt-gutter` | 20px | 좌우 여백, 색면 안쪽 여백 |
| `--tt-header-h` | 48px | 헤더 높이 |
| `--tt-column` | 560px | 결과 왼쪽 열(데스크톱)과 본문 최대 폭 |
| `--tt-side` | 320px | 데스크톱 오른쪽 보조 열 |
| `--tt-status-field-max` | 300px | 375×812에서 상태 색면 높이 예산 |
| `--tt-anchor-reserve` | 64px | 모바일 하단 광고 앵커 높이 예약(`scroll-padding-bottom`) |
| `--tt-radius-button` | 0px | 버튼 모서리 |
| `--tt-radius-card` | 0px | 카드 모서리 |
| `--tt-border-button` | 2px | 외곽선 버튼 테두리 |
| `--tt-focus-width` | 3px | 포커스 링 두께 |
| `--tt-focus-offset` | 2px | 포커스 링 간격 |

- 375×812 첫 화면: 헤더 48 + 번호 바 56 + 상태 색면 300 이하 + 간격 16 → '지금 할 일'이 420px 안에서 시작합니다. 색면은 자르지 않고(`max-height` 금지) 내용 배치로 예산을 지킵니다.
- 320px에서 가로 스크롤 0, 조회번호 말줄임 0.
- 누르는 크기: 행동 44–52px(`md` 44, `lg` 52), 최소 24px.

## 7. 포커스와 모션

- 포커스: `.tt-focus` 한 클래스. `outline: var(--tt-focus-width) solid var(--tt-focus)`, `outline-offset: var(--tt-focus-offset)`. 색면 안에서는 링 색이 `--field-fg`로 바뀝니다.
- 모션 토큰: `--tt-motion-fast` 150ms(버튼 색 전환), `--tt-motion-base` 200ms, `--tt-motion-slow` 250ms, `--tt-ease` `cubic-bezier(0.2, 0, 0, 1)`.
- 움직이는 것은 두 가지뿐입니다: `tt-paint`(결과 상태 색면이 한 번 칠해짐, 200ms)와 `tt-grow`(척추의 지금 칸이 한 번 자람, 250ms). 날짜 숫자는 세어 올라가지 않습니다. `opacity: 0`에서 시작하는 모션은 쓰지 않습니다.
- 줄인 모션: `prefers-reduced-motion: reduce`이면 세 모션 토큰이 모두 0ms입니다(`:root, [data-style][data-style]` 규칙이라 스타일 파일이 되살릴 수 없음).

framer-motion 대체(패키지 제거는 S06):

| 지금(framer-motion) | 바뀐 뒤 |
|---|---|
| `HomePageClient` 결과 영역 `opacity 0 → 1`, `y 10 → 0`, 0.35s | 상태 색면의 `tt-paint` 200ms + 척추 `tt-grow` 250ms. 영역 자체는 움직이지 않음 |
| `HomePageClient` 보조 섹션 `opacity`, `y 8 → 0`, 0.3s | 움직이지 않음 |
| `TimelineStep` 항목마다 `opacity`, `y`, 0.25s | 움직이지 않음(처리 내역은 `<details>` 안) |
| `MotionConfig reducedMotion="user"`, `useReducedMotion` | CSS 모션 토큰 + `prefers-reduced-motion` |

## 8. 변형 슬롯과 `data-*` 훅

스타일마다 달라지는 곳은 네 슬롯뿐입니다. signal 모양은 `app/styles/tokens.css`에 있고, 다른 스타일은 `[data-style="…"] [data-slot="…"]` CSS와 `aria-hidden="true"`인 `data-deco` 요소로만 꾸밉니다.

| 슬롯 | signal | 서류형(R3b) | 어두운 화면(R3b) |
|---|---|---|---|
| `data-slot="status-head"` | 상태 톤 단색 면(`data-tone`). 안의 글자·선·링은 색면 글자색 한 가지 | 도장 | 램프 |
| `data-slot="eta"` | 굵고 큰 날짜 + 반전 D-n 칩 | 기입값 | 숫자 타일 |
| `data-slot="journey"` | 4구간 막대(지난 8px 채움, 지금 20px 채움, 남은 8px 외곽선) | 운송장 경로 | 노선도 |
| `data-slot="button"` | 모서리 0, 잉크 채움 / 2px 잉크 외곽선 / 잉크 밑줄 | 스타일 토큰 | 스타일 토큰 |

공통 부품이 그리는 훅(테스트와 스타일이 함께 씀):

| 훅 | 요소 | 값 |
|---|---|---|
| `data-tone` | 상태 색면, 상태 칩 | `neutral` `progress` `waiting` `attention` `problem` `done` |
| `data-status-chip` | 상태 칩 | `true` |
| `data-station` | 척추 `<li>` | `departed` `customs` `domestic` `arrived` |
| `data-station-state` | 척추 `<li>` | `done` `current` `todo` |
| `data-issue` | 표식이 붙은 척추 `<li>` | `stopped` `cut` `branch` |
| `data-spine-current` | 척추 `<ol>` | 구간 id 또는 `none` |
| `data-eta-kind` | 도착 예상 | `date` `today` `holidayAffected` `overdue` `deliveredOn` `pendingInfo` `withheld` `unknown` |
| `data-number-bar` | 번호 바 | `true` |
| `data-affiliate-group` | 스토어 링크 묶음 | `shortcut` `showcase` `pending` `deliveredLead` |
| `data-affiliate-disclosure` | 묶음의 첫 줄 고지 | `coupang` |
| `data-link-placement` | 톡톡·스토어 링크 | 위치 id |
| `data-notice-kind` | 공지 줄 | `outage` `delay` `holiday` `info` |
| `data-variant` | 버튼·버튼 모양 링크(`data-slot="button"`) | 행동 무게 `primary` `secondary` `text` |

모양 전용 훅(스타일 CSS용, 비즈니스 규칙 테스트에는 쓰지 않음): `data-size`, `data-spine-part`, `data-eta-label`, `data-eta-value`, `data-eta-visual`, `data-eta-part`, `data-eta-digit`, `data-eta-dday`, `data-eta-badge`, `data-eta-caption`, `data-eta-text`, `data-tone-icon`, `data-notice-variant`, `data-number-bar-value`, `data-number-bar-actions`, `data-copy-fallback`.

## 9. 공통 부품 (`components/primitives/`)

부품은 뷰 모델 문자열과 명세가 정한 몇 개 문구('조회번호', '배송 여정 4구간', 구간 이름, '위치 확인 전', '인계 대기', '안내', ' 새 창으로 열기', 'D-')만 그립니다. 나머지 문구는 `config/site.config.ts`에서 옵니다. 부품은 live region을 만들지 않습니다.

| 부품 | 하는 일 | 지키는 규칙 |
|---|---|---|
| `Button` | `<button data-slot="button">` 주·보조·텍스트 | `md` 44px, `lg` 52px. `busy`는 `aria-busy`만 걸고 `disabled`로 막지 않음 |
| `ButtonLink` | 버튼 모양 링크 | 외부 링크는 새 창, `rel="noopener noreferrer"`, 이름 '{라벨} 새 창으로 열기'. 제휴면 `sponsored nofollow` 추가 |
| `ToneIcon` | 톤·표식 아이콘 | 늘 `aria-hidden`. 상태는 글자로도 씀 |
| `StatusChip` | '통관 대기 · 2/4' 같은 칩 | 흰 면에서는 톤 색면, 색면 안에서는 반전 |
| `JourneySpine` | 4구간 여정 | `<ol aria-label="배송 여정 4구간">`, `aria-current="step"` 정확히 1개, 위치 확인 전이면 0개 + '위치 확인 전'. 코드 4는 ②에 ✓와 '인계 대기'. 멈춤·끊김·갈림은 색+아이콘+글자 |
| `EtaDisplay` | 도착 예상 | 화면 최대 글자. 날짜는 숨은 문장 하나로 읽히고 숫자 조각은 `aria-hidden`. D-n은 일반 예상일에만, 연휴가 겹치면 배지로 대신 |
| `NumberBar` | '조회번호 · 택배사' + 번호 | 4자리 묶음 고정폭, 말줄임 0, 묶음 사이에서만 줄바꿈. 좁으면 버튼이 다음 줄로 |
| `CopyButton` | 복사 / 복사하고 열기 | 클립보드가 막히면 내용을 고른 읽기 전용 글상자. 예외를 던지지 않음. 알림은 호출한 쪽이 `onCopied`로 |
| `AffiliateLinkGroup` | 스토어 링크 묶음 | 제휴 링크가 하나라도 있으면 확정형 고지가 첫 줄, 없으면 고지 없음. `isAffiliate` 하나가 고지와 `rel`을 정함 |
| `NoticeBanner` | 공지 배너 / 카드 안 '안내' 줄 | live region 아님. '안내' + 본문 |
| `TalkLink` | 톡톡 링크 | 한 가지 모양을 세 무게(텍스트·보조·주)로. 헤더 말고는 말풍선 아이콘 |
| `LiveAnnouncer` | 화면에 하나뿐인 polite live region | R2에서 만든 것을 그대로 씀(`useAnnounce`) |

## 10. 배치·문구 규칙

- 결과 순서 고정: 번호 바 → 상태 카드 → 도착 예상 → 지금 할 일 → 마지막 처리 → `<details>` '처리 내역 N건 보기'. 이 사이에 광고·스토어·추천·배너를 넣지 않습니다.
- 톡톡은 화면당 최대 3곳(헤더, 상태별 1곳, 푸터), 모양 1종입니다.
- 스토어·제휴 링크 묶음은 확정형 고지를 첫 줄에 둡니다. 고지 문구는 `config/site.config.ts`의 `disclosures.coupang` 한 곳에서 옵니다. 지금 문구: 쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.
- 문제 상태(오류, 장기 정체, 기준일 경과, 택배사 조회 지연, 여러 택배사)에는 스토어·추천·광고가 없습니다.
- 정상 대기 상태에는 채움 버튼이 없고 '지금은 하실 일이 없어요'가 주인공입니다.

## 11. 검사

| 검사 | 파일 | 확인하는 것 |
|---|---|---|
| 토큰 | `tests/unit/tokens.spec.ts` | 대비 기준, CSS·TS·Tailwind·이 문서·`design-system/` 값 일치, signal 보완(앰버+잉크, 빨강은 문제만, 링크 색 분리) |
| 부품 모음 | `tests/e2e/ui-kit.spec.ts` | 11px 이하 글자 0, 글자 대비 4.5:1, 포커스 링 3px·3:1, 320px 가로 스크롤 0, `aria-current` 개수, 클립보드 폴백, 한 번 모션, 줄인 모션 0 |
| 폰트 예산 | `tests/budgets/font-preload.spec.ts` | preload 2파일 이하, 첫 화면 100KB 이하, 예전 본문 웹 폰트 없음(운영 빌드) |
| 자동 접근성 검사(axe) | `tests/e2e/ui-kit.spec.ts` | 승인 13 뒤에만 추가 |

## 12. 바꾸는 방법

- 색이나 크기를 바꿀 때는 `app/styles/tokens.css`, `lib/style/tokens.ts`, 이 문서의 표, `design-system/_base.css`(tokens.css를 그대로 복사)를 한 커밋에서 함께 바꾸고 `tests/unit/tokens.spec.ts`를 돌립니다.
- 대비 기준을 통과하지 못하는 값은 쓰지 않습니다. `/internal/ui-kit`의 색 토큰 절에서 실제 비율을 볼 수 있습니다.
- 새 스타일은 토큰 세트와 네 슬롯 CSS만 더합니다. 부품의 DOM, 훅, 문구는 바꾸지 않습니다.
````

- [ ] **Step 5: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/tokens.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `22 passed`.

- [ ] **Step 6: Commit**

Run: `git add DESIGN.md tests/unit/tokens.spec.ts; git commit -m "docs: rewrite DESIGN.md as the single design source for the signal style"`

---

### Task 14: `design-system/` bundle rebuilt from the tokens

**Files:**
- Modify (rewrite): `design-system/README.md`, `design-system/_base.css`, `design-system/foundations/colors.html`, `design-system/foundations/typography.html`, `design-system/foundations/spacing.html`, `design-system/components/buttons.html`, `design-system/components/status.html`, `design-system/components/cards.html`, `design-system/components/customer-cta.html`, `design-system/components/tracking-form.html`
- Create: `design-system/components/journey-spine.html`
- Test: `tests/unit/tokens.spec.ts` (imports, append)

**Interfaces:**
- Consumes: the final `app/styles/tokens.css` (Tasks 2, 5–8, 10–11); the DOM of every primitive (Tasks 5–12); `disclosures.coupang` (S03).
- Produces: a self-contained preview bundle: `_base.css` = DM Mono `@import` + `--font-dm-mono` + `app/styles/tokens.css` verbatim + preview-only layout rules (colors only through `var(--tt-*)`); every HTML page starts with a `<!-- @dsCard group="Foundations|Components" … -->` marker, links `../_base.css`, uses the primitives' `data-*` DOM, and contains no color literal. S08 adds `foundations/styles.html` and extends the file list in this test.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/tokens.spec.ts`, replace `import { readFileSync } from "node:fs";` with `import { readFileSync, readdirSync } from "node:fs";`

Append to the end of the file:

```ts
test.describe("design-system bundle", () => {
  const DS_FILES = [
    "README.md",
    "_base.css",
    "components/buttons.html",
    "components/cards.html",
    "components/customer-cta.html",
    "components/journey-spine.html",
    "components/status.html",
    "components/tracking-form.html",
    "foundations/colors.html",
    "foundations/spacing.html",
    "foundations/typography.html"
  ] as const;
  const HTML_FILES = DS_FILES.filter((file) => file.endsWith(".html"));
  const normalize = (text: string): string => text.replace(/\r\n/g, "\n");

  function listFiles(directory: string, prefix = ""): string[] {
    return readdirSync(path.join(REPO_ROOT, directory), { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? listFiles(path.join(directory, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`]
    );
  }

  test("contains exactly the listed files and the README names every preview", () => {
    expect(listFiles("design-system").sort()).toEqual([...DS_FILES].sort());
    const readme = readRepoFile("design-system/README.md");
    expect(HTML_FILES.filter((file) => !readme.includes(file))).toEqual([]);
  });

  test("_base.css embeds app/styles/tokens.css unchanged", () => {
    const base = normalize(readRepoFile("design-system/_base.css"));
    expect(base.startsWith('@import url("https://fonts.googleapis.com/css2?family=DM+Mono:wght@500&display=swap");')).toBe(true);
    expect(base).toContain(normalize(readRepoFile("app/styles/tokens.css")).trim());
  });

  test("previews use tokens only: card marker, base stylesheet, no color literals, no legacy fonts or effects", () => {
    const problems: string[] = [];
    for (const file of HTML_FILES) {
      const html = readRepoFile(`design-system/${file}`);
      if (!/^<!-- @dsCard group="(Foundations|Components)"/.test(html)) problems.push(`${file}: no @dsCard marker`);
      if (!html.includes('<link rel="stylesheet" href="../_base.css">')) problems.push(`${file}: no ../_base.css`);
      if (/#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?\b/.test(html)) problems.push(`${file}: color literal`);
      if (/(?:rgb|hsl)a?\(/.test(html)) problems.push(`${file}: color function`);
    }
    for (const file of DS_FILES) {
      const text = readRepoFile(`design-system/${file}`);
      for (const legacy of ["IBM Plex", "Space Grotesk", "linear-gradient", "radial-gradient", "backdrop-filter", "blur(", "box-shadow"]) {
        if (text.includes(legacy)) problems.push(`${file}: ${legacy}`);
      }
    }
    expect(problems).toEqual([]);
  });

  test("every located spine preview marks exactly one current station", () => {
    let lists = 0;
    let unknown = 0;
    let current = 0;
    for (const file of HTML_FILES) {
      const html = readRepoFile(`design-system/${file}`);
      lists += (html.match(/<ol aria-label="배송 여정 4구간"/g) ?? []).length;
      unknown += (html.match(/data-spine-current="none"/g) ?? []).length;
      current += (html.match(/aria-current="step"/g) ?? []).length;
    }
    expect(lists).toBeGreaterThanOrEqual(8);
    expect(unknown).toBeGreaterThanOrEqual(1);
    expect(current).toBe(lists - unknown);
  });

  test("store previews put the configured disclosure first", () => {
    let groups = 0;
    for (const file of HTML_FILES) {
      const html = readRepoFile(`design-system/${file}`);
      const pattern = /<(?:div|section) data-(?:affiliate-group|shortcut-row)="[^"]*"[^>]*>\s*(<p data-affiliate-disclosure="coupang">([^<]*)<\/p>)?/g;
      for (const match of html.matchAll(pattern)) {
        groups += 1;
        expect(match[1], `${file}: the disclosure must be the first child`).toBeDefined();
        expect(match[2], file).toBe(disclosures.coupang);
      }
    }
    expect(groups).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/tokens.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: 5 FAIL (no `journey-spine.html`, `_base.css` has the old dark variables and the IBM Plex import, the previews use hex colors and gradients, no spine or disclosure markup), 22 pass.

- [ ] **Step 3: Rewrite `design-system/_base.css`**

Write the file in three parts with the Write tool: (1) the header below; (2) the complete current content of `app/styles/tokens.css` — read it with the Read tool and paste it unchanged (the test compares it character for character after CRLF normalization); (3) the preview block below.

Part 1 (header):

```css
@import url("https://fonts.googleapis.com/css2?family=DM+Mono:wght@500&display=swap");
/*
 * design-system 미리보기 공통 CSS
 * 1) --font-dm-mono: 앱에서는 next/font 가 넣는 변수입니다. 미리보기에서는 Google Fonts 의 DM Mono 를 씁니다.
 * 2) 그 아래 "tokens.css" 절은 app/styles/tokens.css 를 한 글자도 바꾸지 않고 그대로 붙인 것입니다.
 *    토큰을 바꾸면 이 절을 다시 복사합니다(tests/unit/tokens.spec.ts 가 검사).
 * 3) 맨 아래 "미리보기 전용" 절은 앱이 Tailwind 클래스로 내는 배치를 흉내 냅니다. 색은 var(--tt-*)만 씁니다.
 */
:root { --font-dm-mono: "DM Mono"; }

/* ===== tokens.css ===== */
```

Part 3 (preview block, after the pasted tokens.css):

```css

/* ===== 미리보기 전용 ===== */
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 24px;
  background: var(--tt-ground);
  color: var(--tt-ink);
  font-family: var(--tt-font-body);
  font-size: var(--tt-text-md);
  line-height: var(--tt-leading-body);
  word-break: keep-all;
}
h1, h2, h3, p, ol, ul { margin: 0; }
.kicker { font-size: var(--tt-text-xs); line-height: 18px; font-weight: 700; }
.title { margin-top: 4px; font-family: var(--tt-font-display); font-size: var(--tt-text-xl); line-height: 32px; font-weight: var(--tt-weight-display); }
.subtitle { margin-top: 32px; font-family: var(--tt-font-display); font-size: var(--tt-text-lg); line-height: 28px; font-weight: var(--tt-weight-display); }
.copy { max-width: 640px; margin-top: 8px; color: var(--tt-muted); font-size: var(--tt-text-sm); line-height: 20px; }
.stack { display: grid; gap: 16px; margin-top: 24px; }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.card { display: grid; gap: 8px; justify-items: start; padding: 16px; background: var(--tt-surface); }
.phone { width: 375px; max-width: 100%; background: var(--tt-surface); }
.caption { color: var(--tt-muted); font-size: var(--tt-text-xs); line-height: 18px; font-weight: 700; }
.section-label { font-size: var(--tt-text-xs); line-height: 18px; font-weight: 700; }
.status-title { font-family: var(--tt-font-display); font-size: var(--tt-text-lg); line-height: 28px; font-weight: var(--tt-weight-display); }
.reason { font-size: var(--tt-text-sm); line-height: 20px; font-weight: 500; }
.head { display: grid; gap: 8px; justify-items: start; }
.hint { color: var(--tt-muted); font-size: var(--tt-text-sm); line-height: 20px; }
.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
[data-slot="button"] { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 16px; border-radius: var(--tt-radius-button); font: inherit; font-weight: 700; text-decoration: none; cursor: pointer; }
[data-slot="button"][data-size="lg"] { min-height: 52px; padding: 0 20px; }
[data-slot="button"][data-variant="primary"] { border: 0; background-color: var(--tt-primary); color: var(--tt-on-primary); }
[data-slot="button"][data-variant="secondary"] { border: var(--tt-border-button) solid var(--tt-ink); background-color: var(--tt-surface); color: var(--tt-ink); }
[data-slot="button"][data-variant="text"] { padding: 0; border: 0; background-color: transparent; color: var(--tt-link); text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 5px; }
[data-number-bar] { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; min-height: 56px; padding: 6px var(--tt-gutter); background: var(--tt-surface); }
[data-number-bar] p { display: flex; flex-direction: column; }
[data-number-bar] .label { color: var(--tt-muted); font-size: var(--tt-text-xs); line-height: 18px; font-weight: 500; }
[data-number-bar-value] { display: block; font-family: var(--tt-font-mono); font-size: var(--tt-text-lg); line-height: 24px; font-weight: 500; letter-spacing: 0.02em; font-variant-numeric: tabular-nums; }
[data-number-bar-value] span { white-space: nowrap; }
[data-affiliate-group], [data-shortcut-row] { display: grid; gap: 8px; }
.links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
[data-shortcut-row] .links { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.cta-block { display: grid; gap: 10px; justify-items: start; padding-top: 10px; border-top: 2px solid var(--tt-ink); }
.cta-block h3 { font-family: var(--tt-font-display); font-size: var(--tt-text-lg); line-height: 28px; font-weight: var(--tt-weight-display); }
.cta-block .links { justify-self: stretch; }
[data-notice-variant="banner"] { padding: 10px var(--tt-gutter); background: var(--tt-ground); font-size: var(--tt-text-xs); line-height: 18px; font-weight: 500; }
[data-notice-variant="inline"] { display: flex; align-items: flex-start; gap: 6px; font-size: var(--tt-text-sm); line-height: 20px; font-weight: 500; }
[data-copy-fallback] { display: block; width: 100%; padding: 12px; border: 2px solid var(--tt-ink); background: var(--tt-surface); color: var(--tt-ink); font: inherit; resize: none; }
.field-input { display: block; width: 100%; height: 56px; padding: 0 16px; border: 2px solid var(--tt-control); border-radius: 0; background: var(--tt-surface); color: var(--tt-ink); font-size: var(--tt-text-lg); }
```

- [ ] **Step 4: Rewrite `design-system/README.md`**

```markdown
# tracking-tipoasis 디자인 시스템 미리보기

`../DESIGN.md`(단일 기준)에 적힌 토큰과 공통 부품을 그대로 그린 HTML 미리보기입니다. 모든 파일은 `_base.css` 하나만 씁니다.
`_base.css`는 `app/styles/tokens.css`를 한 글자도 바꾸지 않고 담고 있어서, 토큰을 바꾸면 그 절을 다시 복사해야 합니다(`tests/unit/tokens.spec.ts`가 검사).
색은 모두 `var(--tt-*)`로만 씁니다. 각 HTML은 `<!-- @dsCard group="..." -->` 표시로 시작해 Claude Design이 카드로 읽습니다.
예시 번호는 `0000 1234 5678` 같은 가짜 번호만 씁니다.

Claude Design의 디자인 시스템 프로젝트로 보내기(대화형 Claude Code 세션에서):

1. 이 컴퓨터에서 `/design-login`을 한 번 실행합니다.
2. `design-system/`을 "tracking-tipoasis" 디자인 시스템 프로젝트로 동기화해 달라고 요청합니다.

파일:

- `foundations/colors.html` — signal 색 토큰 30개와 색면 위 글자 대비
- `foundations/typography.html` — 글자 크기 6단계와 서체
- `foundations/spacing.html` — 여백·크기 토큰과 375×812 첫 화면 예산
- `components/buttons.html` — 버튼 슬롯, 톡톡 링크, 복사 폴백, 색면 안 버튼
- `components/status.html` — 상태 칩, 상태 색면 5톤, 도착 예상 표기
- `components/journey-spine.html` — 4구간 척추의 상태별 모양
- `components/cards.html` — 결과 화면 한 장(번호 바 → 상태 색면 → 지금 할 일 → 마지막 처리)
- `components/customer-cta.html` — 상태별 '지금 할 일' 블록과 스토어 링크 묶음
- `components/tracking-form.html` — 홈 조회 영역과 상담·스토어 바로가기 행

서류형·어두운 화면 스타일 미리보기는 R3b에서 더합니다.
```

- [ ] **Step 5: Rewrite `design-system/foundations/colors.html`**

```html
<!-- @dsCard group="Foundations" name="Colors" subtitle="signal(기본) 색 토큰 30개와 색면 위 글자 대비" -->
<!doctype html><html lang="ko" data-style="signal"><head><meta charset="utf-8"><title>Colors</title><link rel="stylesheet" href="../_base.css">
<style>.swatches{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}.sw{display:grid;gap:4px}.chip{height:44px;border:1px solid var(--tt-rule)}.name{font-family:var(--tt-font-mono);font-size:var(--tt-text-xs);line-height:18px;word-break:break-all}.pair{padding:8px 12px;font-size:var(--tt-text-sm);line-height:20px;font-weight:700}</style></head>
<body>
<p class="kicker">Foundations · signal</p>
<h1 class="title">색 토큰</h1>
<p class="copy">값의 원본은 app/styles/tokens.css예요. 빨강은 '문제'에만, '확인 필요'는 앰버 면에 잉크 글자, 텍스트 링크는 잉크와 밑줄로 '정상 진행' 파랑과 나눠요.</p>
<div class="stack swatches">
  <div class="sw"><div class="chip" style="background:var(--tt-ground)"></div><span class="name">--tt-ground</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-surface)"></div><span class="name">--tt-surface</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-raised)"></div><span class="name">--tt-raised</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-ink)"></div><span class="name">--tt-ink</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-muted)"></div><span class="name">--tt-muted</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-rule)"></div><span class="name">--tt-rule</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-control)"></div><span class="name">--tt-control</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-route)"></div><span class="name">--tt-route</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-primary)"></div><span class="name">--tt-primary</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-on-primary)"></div><span class="name">--tt-on-primary</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-accent)"></div><span class="name">--tt-accent</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-link)"></div><span class="name">--tt-link</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-focus)"></div><span class="name">--tt-focus</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-tile)"></div><span class="name">--tt-tile</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-board)"></div><span class="name">--tt-board</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-tone-progress)"></div><span class="name">--tt-tone-progress</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-tone-progress-on)"></div><span class="name">--tt-tone-progress-on</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-tone-progress-ink)"></div><span class="name">--tt-tone-progress-ink</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-tone-waiting)"></div><span class="name">--tt-tone-waiting</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-tone-waiting-on)"></div><span class="name">--tt-tone-waiting-on</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-tone-waiting-ink)"></div><span class="name">--tt-tone-waiting-ink</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-tone-attention)"></div><span class="name">--tt-tone-attention</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-tone-attention-on)"></div><span class="name">--tt-tone-attention-on</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-tone-attention-ink)"></div><span class="name">--tt-tone-attention-ink</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-tone-problem)"></div><span class="name">--tt-tone-problem</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-tone-problem-on)"></div><span class="name">--tt-tone-problem-on</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-tone-problem-ink)"></div><span class="name">--tt-tone-problem-ink</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-tone-done)"></div><span class="name">--tt-tone-done</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-tone-done-on)"></div><span class="name">--tt-tone-done-on</span></div>
  <div class="sw"><div class="chip" style="background:var(--tt-tone-done-ink)"></div><span class="name">--tt-tone-done-ink</span></div>
</div>
<h2 class="subtitle">색면 위 글자</h2>
<div class="stack" style="max-width:520px">
  <p class="pair" style="background:var(--tt-tone-progress);color:var(--tt-tone-progress-on)">정상 진행 · 7.46:1</p>
  <p class="pair" style="background:var(--tt-tone-waiting);color:var(--tt-tone-waiting-on)">정보 대기 · 11.96:1</p>
  <p class="pair" style="background:var(--tt-tone-attention);color:var(--tt-tone-attention-on)">확인 필요 · 앰버 면 + 잉크 글자 · 10.83:1</p>
  <p class="pair" style="background:var(--tt-tone-problem);color:var(--tt-tone-problem-on)">문제 · 빨강은 여기만 · 5.60:1</p>
  <p class="pair" style="background:var(--tt-tone-done);color:var(--tt-tone-done-on)">완료 · 6.59:1</p>
  <p class="pair" style="background:var(--tt-surface);color:var(--tt-muted)">흰 면 위 보조 글자 · 6.81:1 · 색면 위에서는 쓰지 않음</p>
</div>
</body></html>
```

- [ ] **Step 6: Rewrite `design-system/foundations/typography.html`**

```html
<!-- @dsCard group="Foundations" name="Typography" subtitle="시스템 고딕 + DM Mono 숫자 · 12/14/16/20/24/40px" -->
<!doctype html><html lang="ko" data-style="signal"><head><meta charset="utf-8"><title>Typography</title><link rel="stylesheet" href="../_base.css">
<style>.sample{display:grid;gap:2px;padding:12px 0;border-bottom:1px solid var(--tt-rule)}</style></head>
<body>
<p class="kicker">Foundations · signal</p>
<h1 class="title">글자</h1>
<p class="copy">본문과 제목은 시스템 한글 고딕(0KB), 조회번호 숫자만 DM Mono 500 서브셋 1파일이에요. 11px 이하 글자는 없고, 행동 문구는 14px 이상이에요.</p>
<div class="stack" style="max-width:760px;gap:0">
  <div class="sample"><span class="caption">--tt-text-eta · 40px · 도착 예상 날짜(화면 최대 글자)</span><span style="font-family:var(--tt-font-display);font-size:var(--tt-text-eta);line-height:1.1;font-weight:var(--tt-weight-display);font-variant-numeric:tabular-nums">9월 30일 (수)</span></div>
  <div class="sample"><span class="caption">--tt-text-xl · 24px · 홈 제목</span><span style="font-size:var(--tt-text-xl);line-height:32px;font-weight:var(--tt-weight-display)">통관부터 국내 배송까지 한 번에 확인</span></div>
  <div class="sample"><span class="caption">--tt-text-lg · 20px · 상태 제목</span><span class="status-title">통관 순서를 기다리고 있어요</span></div>
  <div class="sample"><span class="caption">--tt-font-mono · 20px · 조회번호</span><span data-number-bar-value="true"><span>0000</span> <span>1234</span> <span>5678</span></span></div>
  <div class="sample"><span class="caption">--tt-text-md · 16px · 본문, 버튼</span><span>지금은 하실 일이 없어요. 통관이 끝나면 택배사로 넘어가요.</span></div>
  <div class="sample"><span class="caption">--tt-text-sm · 14px · 이유 한 줄, 칩, 안내 줄</span><span class="reason">세관 접수가 끝났고 순서대로 심사가 진행돼요.</span></div>
  <div class="sample"><span class="caption">--tt-text-xs · 12px · 척추 라벨, 고지</span><span style="font-size:var(--tt-text-xs);line-height:18px">해외 출발 · 입항·통관 · 국내 배송 · 도착</span></div>
</div>
</body></html>
```

- [ ] **Step 7: Rewrite `design-system/foundations/spacing.html`**

```html
<!-- @dsCard group="Foundations" name="Spacing & layout" subtitle="20px 여백 · 48/56/300px 첫 화면 예산 · 모서리 0" -->
<!doctype html><html lang="ko" data-style="signal"><head><meta charset="utf-8"><title>Spacing</title><link rel="stylesheet" href="../_base.css">
<style>.budget{width:375px;max-width:100%;display:grid;background:var(--tt-surface)}.band{display:flex;align-items:center;padding:0 var(--tt-gutter);border-bottom:1px solid var(--tt-rule);font-size:var(--tt-text-sm);line-height:20px;font-weight:700}.tokens{display:grid;grid-template-columns:max-content 1fr;gap:6px 16px;font-size:var(--tt-text-sm);line-height:20px}.tokens code{font-family:var(--tt-font-mono)}</style></head>
<body>
<p class="kicker">Foundations · signal</p>
<h1 class="title">간격과 첫 화면 예산</h1>
<p class="copy">375×812에서 '지금 할 일'이 420px 안에서 시작해야 해요. 상태 색면은 자르지 않고 배치로 예산을 지켜요.</p>
<div class="stack">
  <div class="budget">
    <div class="band" style="height:var(--tt-header-h)">헤더 48px</div>
    <div class="band" style="height:56px">번호 바 56px</div>
    <div data-slot="status-head" data-tone="progress" style="height:var(--tt-status-field-max);justify-content:center"><p class="status-title">상태 색면 300px 이하</p></div>
    <div style="height:16px"></div>
    <div class="band" style="height:44px;border-top:2px solid var(--tt-ink)">지금 할 일 · 420px 안에서 시작</div>
  </div>
  <div class="tokens">
    <code>--tt-gutter</code><span>20px · 좌우 여백, 색면 안쪽 여백</span>
    <code>--tt-header-h</code><span>48px · 헤더</span>
    <code>--tt-column</code><span>560px · 결과 왼쪽 열, 본문 최대 폭</span>
    <code>--tt-side</code><span>320px · 데스크톱 오른쪽 보조 열</span>
    <code>--tt-status-field-max</code><span>300px · 375×812 상태 색면 높이 예산</span>
    <code>--tt-anchor-reserve</code><span>64px · 모바일 하단 광고 앵커 예약</span>
    <code>--tt-radius-button</code><span>0px · 버튼 모서리</span>
    <code>--tt-radius-card</code><span>0px · 카드 모서리</span>
    <code>--tt-border-button</code><span>2px · 외곽선 버튼</span>
    <code>--tt-focus-width</code><span>3px · 포커스 링</span>
    <code>--tt-focus-offset</code><span>2px · 포커스 링 간격</span>
  </div>
  <div class="row"><button type="button" class="tt-focus" data-slot="button" data-variant="secondary" data-size="md">Tab으로 포커스 링 보기</button></div>
</div>
</body></html>
```

- [ ] **Step 8: Rewrite `design-system/components/buttons.html`**

```html
<!-- @dsCard group="Components" name="Buttons & links" subtitle="주 버튼 1개 · 보조 외곽선 · 텍스트 링크 · 톡톡 · 복사 폴백" -->
<!doctype html><html lang="ko" data-style="signal"><head><meta charset="utf-8"><title>Buttons</title><link rel="stylesheet" href="../_base.css"></head>
<body>
<p class="kicker">Components · button 슬롯</p>
<h1 class="title">버튼과 링크</h1>
<p class="copy">채움 버튼은 화면당 하나예요. 톡톡·스토어는 보조 무게이고, 문제 상태에서만 톡톡이 주 버튼이 돼요. 조회 중에도 버튼을 잠그지 않고 aria-busy만 걸어요.</p>
<div class="stack" style="max-width:640px">
  <div class="card">
    <span class="caption">주 · 52px · 잉크 채움, 모서리 0</span>
    <div class="row">
      <button type="button" class="tt-focus" data-slot="button" data-variant="primary" data-size="lg">조회하기</button>
      <button type="button" class="tt-focus" data-slot="button" data-variant="primary" data-size="lg" aria-busy="true">조회 중…</button>
    </div>
    <span class="caption">보조 · 44px · 2px 외곽선 / 텍스트 · 잉크 밑줄</span>
    <div class="row">
      <button type="button" class="tt-focus" data-slot="button" data-variant="secondary" data-size="md">번호 수정</button>
      <button type="button" class="tt-focus" data-slot="button" data-variant="text" data-size="md">다시 조회</button>
    </div>
  </div>
  <div class="card">
    <span class="caption">톡톡 링크 · 한 모양, 세 무게 · 늘 새 창</span>
    <div class="row">
      <a class="tt-focus" data-slot="button" data-variant="text" data-size="md" data-link-placement="header" href="https://talk.naver.com/" target="_blank" rel="noopener noreferrer" aria-label="문의 새 창으로 열기">문의</a>
      <a class="tt-focus" data-slot="button" data-variant="text" data-size="md" data-link-placement="state" href="https://talk.naver.com/" target="_blank" rel="noopener noreferrer" aria-label="톡톡으로 문의하기 새 창으로 열기"><svg aria-hidden="true" width="1.125em" height="1.125em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 5h16v11H10l-6 4z"/></svg><span>톡톡으로 문의하기</span></a>
      <a class="tt-focus" data-slot="button" data-variant="primary" data-size="md" data-link-placement="state" href="https://talk.naver.com/" target="_blank" rel="noopener noreferrer" aria-label="문의 내용 복사하고 톡톡 열기 새 창으로 열기">문의 내용 복사하고 톡톡 열기</a>
    </div>
  </div>
  <div class="card" style="justify-items:stretch">
    <span class="caption">복사 버튼 · 클립보드가 막히면 내용을 고른 읽기 전용 글상자</span>
    <div><button type="button" class="tt-focus" data-slot="button" data-variant="secondary" data-size="md">다시 볼 링크 복사</button></div>
    <textarea class="tt-focus" data-copy-fallback="true" readonly rows="2" aria-label="다시 볼 링크 복사">https://tracking.tipoasis.com/000012345678</textarea>
  </div>
  <div data-slot="status-head" data-tone="attention">
    <p class="section-label">색면 안 · 외곽선·텍스트·포커스 링이 색면 글자색 한 가지</p>
    <div class="row">
      <button type="button" class="tt-focus" data-slot="button" data-variant="secondary" data-size="md">다시 조회</button>
      <button type="button" class="tt-focus" data-slot="button" data-variant="text" data-size="md">번호 수정</button>
    </div>
  </div>
</div>
</body></html>
```

- [ ] **Step 9: Rewrite `design-system/components/status.html`**

```html
<!-- @dsCard group="Components" name="Status & ETA" subtitle="톤 5종 칩과 색면 · 도착 예상 표기" -->
<!doctype html><html lang="ko" data-style="signal"><head><meta charset="utf-8"><title>Status</title><link rel="stylesheet" href="../_base.css"></head>
<body>
<p class="kicker">Components · status-head · eta 슬롯</p>
<h1 class="title">상태 톤과 도착 예상</h1>
<p class="copy">톤은 정상 진행·정보 대기·확인 필요·문제·완료 다섯 가지예요. 색·아이콘·글자를 함께 쓰고, 빨강은 '문제'에만 써요. 도착 예상 날짜가 화면에서 가장 큰 글자예요.</p>
<div class="stack" style="max-width:420px">
  <div class="row">
    <span data-status-chip="true" data-tone="progress"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12h14"/><path d="M13 6l6 6-6 6"/></svg><span>통관 대기 · 2/4</span></span>
    <span data-status-chip="true" data-tone="waiting"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>국내 도착 전</span></span>
    <span data-status-chip="true" data-tone="attention"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16v1"/></svg><span>확인 필요 · 2/4</span></span>
    <span data-status-chip="true" data-tone="problem"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3L2 21h20z"/><path d="M12 10v5"/><path d="M12 18v1"/></svg><span>조회 오류</span></span>
    <span data-status-chip="true" data-tone="done"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12.5l5 5L20 6.5"/></svg><span>도착 · 4/4</span></span>
  </div>
  <div data-slot="status-head" data-tone="progress">
    <div class="head"><span data-status-chip="true" data-tone="progress"><span>통관 대기 · 2/4</span></span><p class="status-title">통관 순서를 기다리고 있어요</p><p class="reason">세관 접수가 끝났고 순서대로 심사가 진행돼요.</p></div>
    <div data-slot="eta" data-eta-kind="date">
      <p data-eta-label="true">도착 예상</p>
      <p data-eta-value="true"><span class="sr-only">9월 30일 (수)</span><span aria-hidden="true" data-eta-visual="true"><span data-eta-part="month"><span data-eta-digit="9">9</span>월</span> <span data-eta-part="day"><span data-eta-digit="3">3</span><span data-eta-digit="0">0</span>일</span> <span data-eta-part="weekday">(수)</span></span><span data-eta-dday="4">D-4</span></p>
    </div>
  </div>
  <div data-slot="status-head" data-tone="waiting">
    <div class="head"><span data-status-chip="true" data-tone="waiting"><span>국내 도착 전</span></span><p class="status-title">통관 정보 등록 전</p></div>
    <div data-slot="eta" data-eta-kind="pendingInfo"><p data-eta-label="true">도착 예상</p><p data-eta-text="true">정보 등록 후 안내</p></div>
  </div>
  <div data-slot="status-head" data-tone="attention">
    <div class="head"><span data-status-chip="true" data-tone="attention"><span>확인 필요 · 2/4</span></span><p class="status-title">20일째 새 소식이 없어요</p></div>
    <div data-slot="eta" data-eta-kind="withheld"><p data-eta-label="true">도착 예상</p><p data-eta-text="true">지금은 도착 예상일을 안내하기 어려워요</p></div>
  </div>
  <div data-slot="status-head" data-tone="problem">
    <div class="head"><span data-status-chip="true" data-tone="problem"><span>조회 오류</span></span><p class="status-title">일시적인 오류로 조회하지 못했어요</p><p class="reason">번호 문제는 아니에요. 번호를 보내 주시면 확인해 드려요.</p></div>
  </div>
  <div data-slot="status-head" data-tone="done">
    <div class="head"><span data-status-chip="true" data-tone="done"><span>도착 · 4/4</span></span><p class="status-title">배송 완료</p></div>
    <div data-slot="eta" data-eta-kind="deliveredOn">
      <p data-eta-label="true">배송 완료일</p>
      <p data-eta-value="true"><span class="sr-only">9월 25일 (금)</span><span aria-hidden="true" data-eta-visual="true"><span data-eta-part="month"><span data-eta-digit="9">9</span>월</span> <span data-eta-part="day"><span data-eta-digit="2">2</span><span data-eta-digit="5">5</span>일</span> <span data-eta-part="weekday">(금)</span></span></p>
    </div>
  </div>
  <div class="card">
    <span class="caption">연휴가 겹치면 D-n 대신 배지</span>
    <div data-slot="eta" data-eta-kind="holidayAffected">
      <p data-eta-label="true">도착 예상</p>
      <p data-eta-value="true"><span class="sr-only">9월 30일 (수)</span><span aria-hidden="true" data-eta-visual="true"><span data-eta-part="month"><span data-eta-digit="9">9</span>월</span> <span data-eta-part="day"><span data-eta-digit="3">3</span><span data-eta-digit="0">0</span>일</span> <span data-eta-part="weekday">(수)</span></span></p>
      <span data-eta-badge="true"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 5h18v16H3z"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/></svg>추석 연휴 영향 · 1~2일 늦어질 수 있어요</span>
    </div>
  </div>
</div>
</body></html>
```

- [ ] **Step 10: Create `design-system/components/journey-spine.html`**

```html
<!-- @dsCard group="Components" name="Journey spine" subtitle="4구간 척추 · aria-current 1개 · 멈춤·끊김·갈림 · 위치 확인 전" -->
<!doctype html><html lang="ko" data-style="signal"><head><meta charset="utf-8"><title>Journey spine</title><link rel="stylesheet" href="../_base.css"></head>
<body>
<p class="kicker">Components · journey 슬롯</p>
<h1 class="title">4구간 여정 척추</h1>
<p class="copy">지난 구간은 채운 8px, 지금 구간은 채운 20px, 남은 구간은 외곽선 8px이에요. 지금 구간 표식(aria-current=step)은 정확히 하나이고 위치 확인 전에는 없어요. 멈춤·끊김·갈림은 색·아이콘·글자를 함께 써요.</p>
<div class="stack" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">
  <div data-slot="status-head" data-tone="progress">
    <p class="section-label">정상 진행 · 통관 대기 2/4</p>
    <div data-slot="journey"><ol aria-label="배송 여정 4구간" data-spine-current="customs">
      <li data-station="departed" data-station-state="done"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12.5l5 5L20 6.5"/></svg>해외 출발</span></span></li>
      <li data-station="customs" data-station-state="current" aria-current="step"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">입항·통관</span></span></li>
      <li data-station="domestic" data-station-state="todo"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">국내 배송</span></span></li>
      <li data-station="arrived" data-station-state="todo"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">도착</span></span></li>
    </ol></div>
  </div>
  <div data-slot="status-head" data-tone="progress">
    <p class="section-label">통관 완료 · 인계 대기 2/4 (③으로 넘기지 않음)</p>
    <div data-slot="journey"><ol aria-label="배송 여정 4구간" data-spine-current="customs">
      <li data-station="departed" data-station-state="done"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12.5l5 5L20 6.5"/></svg>해외 출발</span></span></li>
      <li data-station="customs" data-station-state="current" aria-current="step"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12.5l5 5L20 6.5"/></svg>입항·통관</span><span data-spine-part="sub">인계 대기</span></span></li>
      <li data-station="domestic" data-station-state="todo"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">국내 배송</span></span></li>
      <li data-station="arrived" data-station-state="todo"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">도착</span></span></li>
    </ol></div>
  </div>
  <div data-slot="status-head" data-tone="done">
    <p class="section-label">완료 · 도착 4/4</p>
    <div data-slot="journey"><ol aria-label="배송 여정 4구간" data-spine-current="arrived">
      <li data-station="departed" data-station-state="done"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12.5l5 5L20 6.5"/></svg>해외 출발</span></span></li>
      <li data-station="customs" data-station-state="done"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12.5l5 5L20 6.5"/></svg>입항·통관</span></span></li>
      <li data-station="domestic" data-station-state="done"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12.5l5 5L20 6.5"/></svg>국내 배송</span></span></li>
      <li data-station="arrived" data-station-state="current" aria-current="step"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">도착</span></span></li>
    </ol></div>
  </div>
  <div data-slot="status-head" data-tone="attention">
    <p class="section-label">멈춤 · 장기 정체</p>
    <div data-slot="journey"><ol aria-label="배송 여정 4구간" data-spine-current="customs">
      <li data-station="departed" data-station-state="done"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12.5l5 5L20 6.5"/></svg>해외 출발</span></span></li>
      <li data-station="customs" data-station-state="current" data-issue="stopped" aria-current="step"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"><svg aria-hidden="true" data-tone-icon="stopped" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 5v14"/><path d="M15 5v14"/></svg></span></span><span data-spine-part="label"><span data-spine-part="issue">멈춤</span><span data-spine-part="name">입항·통관</span></span></li>
      <li data-station="domestic" data-station-state="todo"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">국내 배송</span></span></li>
      <li data-station="arrived" data-station-state="todo"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">도착</span></span></li>
    </ol></div>
  </div>
  <div data-slot="status-head" data-tone="progress">
    <p class="section-label">끊김 · 통관 중 택배사 조회 지연(③에 표식, 지금 구간은 ②)</p>
    <div data-slot="journey"><ol aria-label="배송 여정 4구간" data-spine-current="customs">
      <li data-station="departed" data-station-state="done"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12.5l5 5L20 6.5"/></svg>해외 출발</span></span></li>
      <li data-station="customs" data-station-state="current" aria-current="step"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">입항·통관</span></span></li>
      <li data-station="domestic" data-station-state="todo" data-issue="cut"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"><svg aria-hidden="true" data-tone-icon="cut" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 7H7a5 5 0 0 0 0 10h3"/><path d="M14 7h3a5 5 0 0 1 0 10h-3"/></svg></span></span><span data-spine-part="label"><span data-spine-part="issue">끊김</span><span data-spine-part="name">국내 배송</span></span></li>
      <li data-station="arrived" data-station-state="todo"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">도착</span></span></li>
    </ol></div>
  </div>
  <div data-slot="status-head" data-tone="attention">
    <p class="section-label">갈림 · 여러 택배사</p>
    <div data-slot="journey"><ol aria-label="배송 여정 4구간" data-spine-current="domestic">
      <li data-station="departed" data-station-state="done"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12.5l5 5L20 6.5"/></svg>해외 출발</span></span></li>
      <li data-station="customs" data-station-state="done"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12.5l5 5L20 6.5"/></svg>입항·통관</span></span></li>
      <li data-station="domestic" data-station-state="current" data-issue="branch" aria-current="step"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"><svg aria-hidden="true" data-tone-icon="branch" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 21v-8"/><path d="M12 13L5 4"/><path d="M12 13l7-9"/></svg></span></span><span data-spine-part="label"><span data-spine-part="issue">갈림</span><span data-spine-part="name">국내 배송</span></span></li>
      <li data-station="arrived" data-station-state="todo"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">도착</span></span></li>
    </ol></div>
  </div>
  <div data-slot="status-head" data-tone="waiting">
    <p class="section-label">위치 확인 전 · 국내 도착 전 (표식 0)</p>
    <div data-slot="journey"><ol aria-label="배송 여정 4구간" data-spine-current="none">
      <li data-station="departed" data-station-state="todo"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">해외 출발</span></span></li>
      <li data-station="customs" data-station-state="todo"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">입항·통관</span></span></li>
      <li data-station="domestic" data-station-state="todo"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">국내 배송</span></span></li>
      <li data-station="arrived" data-station-state="todo"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">도착</span></span></li>
    </ol><p data-spine-part="unknown">위치 확인 전</p></div>
  </div>
</div>
</body></html>
```

- [ ] **Step 11: Rewrite `design-system/components/cards.html`**

```html
<!-- @dsCard group="Components" name="Result card" subtitle="번호 바 → 상태 색면(칩·제목·척추·안내·예상일) → 지금 할 일 → 마지막 처리" -->
<!doctype html><html lang="ko" data-style="signal"><head><meta charset="utf-8"><title>Result card</title><link rel="stylesheet" href="../_base.css"></head>
<body>
<p class="kicker">Components · 결과 화면(375px)</p>
<h1 class="title">결과 한 장</h1>
<p class="copy">순서는 번호 바 → 상태 카드 → 도착 예상 → 지금 할 일 → 마지막 처리로 고정이고, 그 사이에 광고·스토어·추천이 없어요. 자세한 기록은 처리 내역을 펼칠 때만 보여요.</p>
<div class="stack">
<div class="phone">
  <div data-number-bar="true"><p><span class="label">조회번호 · 택배사 배정 전</span><span data-number-bar-value="true"><span>0000</span> <span>1234</span> <span>5678</span></span></p><div data-number-bar-actions="true"><button type="button" class="tt-focus" data-slot="button" data-variant="secondary" data-size="md">번호 변경</button></div></div>
  <section data-slot="status-head" data-tone="progress" aria-labelledby="status-title">
    <div class="head"><span data-status-chip="true" data-tone="progress"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12h14"/><path d="M13 6l6 6-6 6"/></svg><span>통관 대기 · 2/4</span></span><h2 id="status-title" class="status-title" tabindex="-1">통관 순서를 기다리고 있어요</h2><p class="reason">세관 접수가 끝났고 순서대로 심사가 진행돼요.</p></div>
    <div data-slot="journey"><ol aria-label="배송 여정 4구간" data-spine-current="customs">
      <li data-station="departed" data-station-state="done"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12.5l5 5L20 6.5"/></svg>해외 출발</span></span></li>
      <li data-station="customs" data-station-state="current" aria-current="step"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">입항·통관</span></span></li>
      <li data-station="domestic" data-station-state="todo"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">국내 배송</span></span></li>
      <li data-station="arrived" data-station-state="todo"><span data-spine-part="track" aria-hidden="true"><span data-spine-part="bar"></span></span><span data-spine-part="label"><span data-spine-part="name">도착</span></span></li>
    </ol></div>
    <p data-notice-kind="holiday" data-notice-variant="inline"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7v1"/></svg><span><strong>안내</strong> 추석 연휴로 통관이 9월 28일(월)부터 이어져요.</span></p>
    <div data-slot="eta" data-eta-kind="holidayAffected">
      <p data-eta-label="true">도착 예상</p>
      <p data-eta-value="true"><span class="sr-only">9월 30일 (수)</span><span aria-hidden="true" data-eta-visual="true"><span data-eta-part="month"><span data-eta-digit="9">9</span>월</span> <span data-eta-part="day"><span data-eta-digit="3">3</span><span data-eta-digit="0">0</span>일</span> <span data-eta-part="weekday">(수)</span></span></p>
      <span data-eta-badge="true"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 5h18v16H3z"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/></svg>추석 연휴 영향 · 1~2일 늦어질 수 있어요</span>
    </div>
  </section>
  <section class="cta-block" data-cta-state="customsWaiting" style="margin:20px var(--tt-gutter) 0">
    <p class="section-label">지금 할 일</p>
    <h3>지금은 하실 일이 없어요.</h3>
    <p>통관이 끝나면 택배사로 넘어가요.</p>
    <a class="tt-focus" data-slot="button" data-variant="text" data-size="md" data-link-placement="state" href="https://talk.naver.com/" target="_blank" rel="noopener noreferrer" aria-label="9월 29일(화)까지 그대로면 알려 주세요 새 창으로 열기"><svg aria-hidden="true" width="1.125em" height="1.125em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 5h16v11H10l-6 4z"/></svg><span>9월 29일(화)까지 그대로면 알려 주세요</span></a>
    <button type="button" class="tt-focus" data-slot="button" data-variant="secondary" data-size="md">다시 볼 링크 복사</button>
  </section>
  <section style="display:grid;gap:4px;margin:16px var(--tt-gutter) 0;padding:10px 0 20px;border-top:1px solid var(--tt-rule)">
    <p class="section-label">마지막 처리</p>
    <p style="font-weight:700;font-variant-numeric:tabular-nums">9월 23일 (수) 14:10 · 통관 접수 <span class="caption">통관목록접수</span></p>
    <details><summary class="tt-focus" style="min-height:44px;display:flex;align-items:center;font-weight:700;cursor:pointer">처리 내역 11건 보기 · 마지막 9월 23일 14:10</summary><p class="hint">지나온 구간별로 기록을 보여 줘요.</p></details>
  </section>
</div>
</div>
</body></html>
```

- [ ] **Step 12: Rewrite `design-system/components/customer-cta.html`**

The two disclosure paragraphs quote `disclosures.coupang`; use the sentence Step 3 of Task 13 found.

```html
<!-- @dsCard group="Components" name="지금 할 일" subtitle="오류 · 국내 도착 전 · 통관 대기 · 배송 중 · 배송 완료 · 기준일 경과" -->
<!doctype html><html lang="ko" data-style="signal"><head><meta charset="utf-8"><title>지금 할 일</title><link rel="stylesheet" href="../_base.css"></head>
<body>
<p class="kicker">Components</p>
<h1 class="title">지금 할 일 블록</h1>
<p class="copy">문장 하나, 주 행동 최대 하나, 보조 1–2개예요. 스토어 링크 묶음은 확정형 고지가 첫 줄이고, 문제 상태에는 스토어가 없어요.</p>
<div class="stack" style="max-width:420px;gap:32px">
  <section class="cta-block" data-cta-state="error">
    <p class="section-label">지금 할 일 · 오류</p>
    <p>번호를 모르시면 주문 안내 문자나 톡톡으로 확인해 드려요.</p>
    <a class="tt-focus" data-slot="button" data-variant="text" data-size="md" data-link-placement="state" href="https://talk.naver.com/" target="_blank" rel="noopener noreferrer" aria-label="톡톡으로 문의하기 새 창으로 열기"><svg aria-hidden="true" width="1.125em" height="1.125em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 5h16v11H10l-6 4z"/></svg><span>톡톡으로 문의하기</span></a>
  </section>
  <section class="cta-block" data-cta-state="pending">
    <p class="section-label">지금 할 일 · 국내 도착 전</p>
    <h3>아직 국내 배송 정보가 없어요</h3>
    <p>정보 반영까지 시간이 걸릴 수 있어 2~3시간 뒤 다시 확인해 주세요.</p>
    <a class="tt-focus" data-slot="button" data-variant="text" data-size="md" data-link-placement="state" href="https://talk.naver.com/" target="_blank" rel="noopener noreferrer" aria-label="톡톡으로 문의하기 새 창으로 열기"><svg aria-hidden="true" width="1.125em" height="1.125em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 5h16v11H10l-6 4z"/></svg><span>톡톡으로 문의하기</span></a>
    <div data-affiliate-group="pending" style="justify-self:stretch">
      <p data-affiliate-disclosure="coupang">쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.</p>
      <p class="reason">주문하신 곳에서도 배송 안내를 볼 수 있어요</p>
      <div class="links">
        <a class="tt-focus" data-slot="button" data-variant="secondary" data-size="md" data-link-placement="pending" href="https://smartstore.naver.com/" target="_blank" rel="noopener noreferrer" aria-label="네이버 스토어 보기 새 창으로 열기">네이버 스토어 보기</a>
        <a class="tt-focus" data-slot="button" data-variant="secondary" data-size="md" data-link-placement="pending" href="https://www.coupang.com/" target="_blank" rel="sponsored nofollow noopener noreferrer" aria-label="쿠팡 스토어 보기 새 창으로 열기">쿠팡 스토어 보기</a>
      </div>
    </div>
  </section>
  <section class="cta-block" data-cta-state="customsWaiting">
    <p class="section-label">지금 할 일 · 통관 대기(채움 버튼 없음)</p>
    <h3>지금은 하실 일이 없어요.</h3>
    <p>통관이 끝나면 택배사로 넘어가요.</p>
    <a class="tt-focus" data-slot="button" data-variant="text" data-size="md" data-link-placement="state" href="https://talk.naver.com/" target="_blank" rel="noopener noreferrer" aria-label="9월 29일(화)까지 그대로면 알려 주세요 새 창으로 열기"><svg aria-hidden="true" width="1.125em" height="1.125em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 5h16v11H10l-6 4z"/></svg><span>9월 29일(화)까지 그대로면 알려 주세요</span></a>
    <button type="button" class="tt-focus" data-slot="button" data-variant="secondary" data-size="md">다시 볼 링크 복사</button>
  </section>
  <section class="cta-block" data-cta-state="inTransit">
    <p class="section-label">지금 할 일 · 배송 중(쇼핑 링크 없음)</p>
    <h3>배송이 진행 중이에요</h3>
    <p>정확한 도착 시간은 택배사 문자나 실시간 조회에서 볼 수 있어요.</p>
    <a class="tt-focus" data-slot="button" data-variant="primary" data-size="lg" href="https://www.cjlogistics.com/" target="_blank" rel="noopener noreferrer" aria-label="CJ대한통운에서 실시간 위치 보기 새 창으로 열기">CJ대한통운에서 실시간 위치 보기</a>
    <a class="tt-focus" data-slot="button" data-variant="text" data-size="md" data-link-placement="state" href="https://talk.naver.com/" target="_blank" rel="noopener noreferrer" aria-label="다른 문의는 톡톡으로 새 창으로 열기"><svg aria-hidden="true" width="1.125em" height="1.125em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 5h16v11H10l-6 4z"/></svg><span>다른 문의는 톡톡으로</span></a>
  </section>
  <section class="cta-block" data-cta-state="delivered">
    <p class="section-label">지금 할 일 · 배송 완료(스토어 선두)</p>
    <h3>배송이 완료됐어요</h3>
    <div data-affiliate-group="deliveredLead" style="justify-self:stretch">
      <p data-affiliate-disclosure="coupang">쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.</p>
      <div class="links">
        <a class="tt-focus" data-slot="button" data-variant="primary" data-size="lg" data-link-placement="deliveredLead" href="https://smartstore.naver.com/" target="_blank" rel="noopener noreferrer" aria-label="네이버 스토어 보기 새 창으로 열기">네이버 스토어 보기</a>
        <a class="tt-focus" data-slot="button" data-variant="secondary" data-size="lg" data-link-placement="deliveredLead" href="https://www.coupang.com/" target="_blank" rel="sponsored nofollow noopener noreferrer" aria-label="쿠팡 스토어 보기 새 창으로 열기">쿠팡 스토어 보기</a>
      </div>
    </div>
    <a class="tt-focus" data-slot="button" data-variant="text" data-size="md" data-link-placement="state" href="https://talk.naver.com/" target="_blank" rel="noopener noreferrer" aria-label="톡톡으로 문의하기 새 창으로 열기"><svg aria-hidden="true" width="1.125em" height="1.125em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 5h16v11H10l-6 4z"/></svg><span>톡톡으로 문의하기</span></a>
  </section>
  <section class="cta-block" data-cta-state="customsWaiting" data-overdue="true">
    <p class="section-label">지금 할 일 · 기준일 경과(톡톡이 주 버튼)</p>
    <a class="tt-focus" data-slot="button" data-variant="primary" data-size="md" href="https://talk.naver.com/" target="_blank" rel="noopener noreferrer" aria-label="문의 내용 복사하고 톡톡 열기 새 창으로 열기">문의 내용 복사하고 톡톡 열기</a>
    <p class="hint">복사되는 내용: [배송 문의] 조회번호 0000 1234 5678 / 통관 대기 / 마지막 처리 9월 23일 14:10</p>
    <p>개인통관고유부호와 수취인 이름이 주문 정보와 같은지도 확인해 주세요.</p>
  </section>
</div>
</body></html>
```

- [ ] **Step 13: Rewrite `design-system/components/tracking-form.html`**

The shortcut-row disclosure quotes `disclosures.coupang` like Step 12.

```html
<!-- @dsCard group="Components" name="Lookup (home)" subtitle="헤더 → 공지 → 제목 → 입력 → 형식 안내 → 택배사 → 조회하기 → 바로가기 행" -->
<!doctype html><html lang="ko" data-style="signal"><head><meta charset="utf-8"><title>Lookup</title><link rel="stylesheet" href="../_base.css"></head>
<body>
<p class="kicker">Components · 홈(375px)</p>
<h1 class="title">홈 조회 영역</h1>
<p class="copy">채움 버튼은 [조회하기] 하나예요. 예시 번호 버튼은 없고 누를 수 없는 형식 안내만 있어요. 바로가기 행의 아래 끝은 375×812에서 약 500px이에요.</p>
<div class="stack">
<div class="phone">
  <header style="display:flex;align-items:center;justify-content:space-between;height:var(--tt-header-h);padding:0 var(--tt-gutter);border-bottom:1px solid var(--tt-rule)">
    <span style="font-weight:var(--tt-weight-display)">통관·배송 조회</span>
    <a class="tt-focus" data-slot="button" data-variant="text" data-size="md" data-link-placement="header" href="https://talk.naver.com/" target="_blank" rel="noopener noreferrer" aria-label="문의 새 창으로 열기">문의</a>
  </header>
  <aside aria-label="안내" data-notice-kind="holiday" data-notice-variant="banner"><p><strong>안내</strong> 추석 연휴(9/24~26)와 주말에는 통관·택배가 쉬어요. 9월 28일(월)부터 순서대로 진행돼요.</p></aside>
  <form data-lookup-form="true" style="display:grid;gap:12px;padding:20px var(--tt-gutter)">
    <h2 style="font-size:var(--tt-text-xl);line-height:32px;font-weight:var(--tt-weight-display)">통관부터 국내 배송까지 한 번에 확인</h2>
    <label for="number" style="font-weight:700">조회번호 (HBL 또는 운송장)</label>
    <input id="number" class="field-input tt-focus" style="font-family:var(--tt-font-mono)" inputmode="text" autocapitalize="characters" autocomplete="off" enterkeyhint="search">
    <p class="hint">숫자 10~14자리 (예: 0000 0000 0000) · 영문 3~4자로 시작하는 HBL (예: ABCD 0000 0000) · 공백·하이픈은 자동으로 빼요</p>
    <details><summary class="tt-focus" style="min-height:44px;display:flex;align-items:center;font-weight:700;cursor:pointer">번호는 어디서 찾나요?</summary><p class="hint">네이버 주문상세 → 배송조회, 쿠팡 주문목록 → 배송조회, 톡톡 출고 안내문</p></details>
    <label for="carrier" style="font-weight:700">국내 택배사</label>
    <select id="carrier" class="field-input tt-focus" style="font-family:var(--tt-font-body);font-size:var(--tt-text-md)"><option>자동으로 찾기</option><option>CJ대한통운</option><option>우체국택배</option><option>한진택배</option><option>롯데택배</option><option>로젠택배</option></select>
    <button type="submit" class="tt-focus" data-slot="button" data-variant="primary" data-size="lg" style="width:100%">조회하기</button>
  </form>
  <section data-shortcut-row="full" aria-label="상담·스토어 바로가기" style="padding:0 var(--tt-gutter) 20px">
    <p data-affiliate-disclosure="coupang">쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.</p>
    <div class="links">
      <a class="tt-focus" data-slot="button" data-variant="secondary" data-size="md" data-link-placement="shortcut" href="https://talk.naver.com/" target="_blank" rel="noopener noreferrer" aria-label="톡톡 상담 새 창으로 열기">톡톡 상담</a>
      <a class="tt-focus" data-slot="button" data-variant="secondary" data-size="md" data-link-placement="shortcut" href="https://smartstore.naver.com/" target="_blank" rel="noopener noreferrer" aria-label="네이버 스토어 새 창으로 열기">네이버 스토어</a>
      <a class="tt-focus" data-slot="button" data-variant="secondary" data-size="md" data-link-placement="shortcut" href="https://www.coupang.com/" target="_blank" rel="sponsored nofollow noopener noreferrer" aria-label="쿠팡 스토어 새 창으로 열기">쿠팡 스토어</a>
    </div>
  </section>
</div>
</div>
</body></html>
```

- [ ] **Step 14: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/tokens.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `27 passed` (8 spine lists across `journey-spine.html` (7) and `cards.html` (1), 1 unknown, 7 `aria-current`; 3 disclosure-first groups).
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/real-number-guard.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: all pass (the previews use only `0000…` values).

- [ ] **Step 15: Look at the previews**

Open `design-system/components/journey-spine.html`, `design-system/components/status.html` and `design-system/components/cards.html` in the Browser pane (`preview_start` with a `file:///…` URL of each file) and check that the fields, spines and dates render like `/internal/ui-kit`. Send `cards.html` to the operator with SendUserFile (`display: "render"`).

- [ ] **Step 16: Commit**

Run: `git add design-system; git commit -m "docs: rebuild the design-system preview bundle from the signal tokens"`

---

### Task 15: Approved disclosure wording in the docs (gated by approval 9)

**Files:**
- Modify: `DESIGN.md` (§10, one sentence)
- Modify: `design-system/components/customer-cta.html` (two disclosure paragraphs), `design-system/components/tracking-form.html` (one disclosure paragraph)
- Test: none new — the Task 13 and Task 14 parity tests read `disclosures.coupang` and fail until the docs match it.

**Interfaces:**
- Consumes: `disclosures.coupang` after S03's approval-9 follow-up has set it to the approved sentence (S05 never edits `config/site.config.ts`).
- Produces: docs and previews that quote the approved sentence. Code needs no change: `AffiliateLinkGroup`, the gallery and every test read the configured value.

- [ ] **Step 1: Confirm approval 9 is recorded in the roadmap approval ledger; if not, stop.** Open `docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md` §4, row 9. Status other than `approved` → stop this task, mark it SKIPPED ("approval 9 pending") in the stage summary, and keep the spec §16 item 9 "거절하면" fallback: the current wording '쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.' stays, and only its position moves before the links — Tasks 10, 13 and 14 already do that everywhere (`AffiliateLinkGroup` first child, DESIGN.md §10, the three preview groups).

- [ ] **Step 2: Confirm the configuration already carries the approved wording**

Run: `Select-String -Path config/site.config.ts -Pattern '^\s*coupang: "'`
Expected: one match — the `disclosures.coupang` line — whose quoted sentence is exactly the wording recorded in roadmap §4 row 9: the default proposal '쿠팡 링크는 쿠팡 파트너스 활동의 일환으로, 구매 시 운영자가 수수료를 받습니다.', or the legally reviewed wording that S03 Task 16 Step 2 puts in its place when the ledger records one. If the line still holds the fallback '쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.', or a sentence that differs from the ledger → stop: the value belongs to S03 (`disclosures.coupang`, roadmap §4 row 9). Ask the operator to run S03's approval-9 follow-up task (S03 Task 16) first, then resume here. Keep the printed sentence (the text between the quotes) for Step 4.

- [ ] **Step 3: Run the parity tests to see the docs lag behind**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/tokens.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: 2 FAIL — "documents every primitive and the configured disclosure wording" and "store previews put the configured disclosure first" (the docs still quote the old sentence); 25 pass. If both already pass (Task 13 Step 3 already found the configured approved sentence and Tasks 13–14 quote it), go to Step 5.

- [ ] **Step 4: Replace the sentence in the three files**

Use the Edit tool with `replace_all: true` in `DESIGN.md`, `design-system/components/customer-cta.html` and `design-system/components/tracking-form.html` (not PowerShell `Set-Content`, which would add a byte-order mark before the `<!-- @dsCard` marker):
- old: `쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.`
- new: the sentence Step 2 printed, character for character (with the default proposal: `쿠팡 링크는 쿠팡 파트너스 활동의 일환으로, 구매 시 운영자가 수수료를 받습니다.`). The parity tests compare against `disclosures.coupang`, so any other text keeps them red.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; npx playwright test tests/unit/tokens.spec.ts; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null`
Expected: `27 passed`.
Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts -g "affiliate"`
Expected: all pass (the gallery renders the configured sentence as the first child).

- [ ] **Step 6: Commit**

Run: `git add DESIGN.md design-system/components/customer-cta.html design-system/components/tracking-form.html; git commit -m "docs: quote the approved affiliate disclosure in DESIGN.md and design-system"`

---

### Task 16: axe checks on the gallery (gated by approval 13)

**Files:**
- Modify: `package.json`, `package-lock.json` (dev dependency `@axe-core/playwright`, only if no earlier stage added it)
- Test: `tests/e2e/ui-kit.spec.ts` (one import, append)

**Interfaces:**
- Consumes: `openKit` (Task 7 version); every gallery section (Tasks 5–12).
- Produces: `describe("axe (approval 13)")` with two tests (375×812 and 1280×900), WCAG 2.0/2.1/2.2 A+AA tags, scoped to `main[data-ui-kit]`. S06/S07/S08 reuse the same `AxeBuilder` pattern in their own specs.

- [ ] **Step 1: Confirm approval 13 is recorded in the roadmap approval ledger; if not, stop.** Open roadmap §4, row 13. Status other than `approved` → stop this task and mark it SKIPPED ("approval 13 pending"). Spec §16 item 13 "거절하면" fallback: accessibility is checked by hand, and the structural tests in `tests/e2e/ui-kit.spec.ts` stay the automated check. Run this manual checklist and paste each result line into the stage summary:
  1. Keyboard only on `/internal/ui-kit` at 1280 px: Tab reaches every button and link in visual order, the ring is visible on white and inside every colored field, Enter activates, nothing traps focus.
  2. Windows Narrator (Ctrl+Win+Enter) on the `spine-customs` demo: reads the list name '배송 여정 4구간', 4 items, the current item announced as the current step, stations in order; on `eta-date` reads '9월 30일 (수)' once and then 'D-4'; on `eta-holiday` reads the badge sentence.
  3. Browser zoom 400 % at 1280 px (320 CSS px): no horizontal scroll; number bar groups stay whole.
  4. Windows contrast theme (설정 → 접근성 → 대비 테마 → 사막 or 수중): spine bars and chips stay visible.
  5. Windows animation effects off (설정 → 접근성 → 시각 효과 → 애니메이션 효과 끔): fields and spines appear without motion.

- [ ] **Step 2: Write the failing test**

In `tests/e2e/ui-kit.spec.ts`, replace `import { expect, test, type Page } from "@playwright/test";` with

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
```

Append to the end of the file:

```ts
test.describe("axe (approval 13)", () => {
  for (const [width, height] of [
    [375, 812],
    [1280, 900]
  ] as const) {
    test(`no WCAG 2.2 AA violations in the gallery at ${width}px`, async ({ page }) => {
      await openKit(page, width, height);
      const results = await new AxeBuilder({ page })
        .include("main[data-ui-kit]")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const violations = results.violations.map(
        (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`
      );
      expect(violations).toEqual([]);
    });
  }
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts -g "axe"`
Expected: FAIL — `Error: Cannot find module '@axe-core/playwright'` (no tests run), unless an earlier stage already installed it.

- [ ] **Step 4: Install the dev dependency if it is missing**

Run: `Select-String -Path package.json -Pattern '"@axe-core/playwright"'`
Expected: a match → skip the install (another stage added it under the same approval). No match → run `npm install --save-dev @axe-core/playwright@^4.10.2`
Expected: `added 2 packages` (`@axe-core/playwright` and `axe-core`), exit 0; `package.json` `devDependencies` lists `"@axe-core/playwright": "^4.10.2"`.

- [ ] **Step 5: Run the gallery spec**

Run: `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; npx playwright test tests/e2e/ui-kit.spec.ts`
Expected: `46 passed`. If axe reports a violation, fix the primitive or gallery markup named by `violation.id` and its target (never relax the test), then re-run.

- [ ] **Step 6: Commit**

Run: `git add package.json package-lock.json tests/e2e/ui-kit.spec.ts; git commit -m "test: add axe checks to the ui-kit gallery"`
(If Step 4 skipped the install, `git add tests/e2e/ui-kit.spec.ts` only.)

---

### Task Final: Stage gate

- [ ] **G1. Port free.** `Get-NetTCPConnection -LocalPort 43210 -ErrorAction SilentlyContinue` → no output (stop listeners otherwise).
- [ ] **G2. Lint.** `npm run lint` → exit 0, no errors, no warnings introduced by this stage.
- [ ] **G3. Typecheck.** `npm run typecheck` → exit 0.
- [ ] **G4. Build.** `npm run build` → exit 0. Route table: `ƒ /[trackingNumber]` always; `/` is `ƒ` in S01 (it still reads `searchParams`), `○ /` from S02 on, and `○ /` with `Revalidate 5m` from S06 on.
- [ ] **G5. Dev-mode E2E.** `$env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null; npm run test:e2e` → "N passed", 0 failed (skips allowed only for tests guarded by `PW_MODE`, `PW_SHOTS`, `PW_VISUAL`, or an approval-gated `test.skip` naming the approval).
- [ ] **G6. Production-mode E2E.** Re-run `npm run build` if `next start` reports a missing or stale build. Background PowerShell: `$env:INTERNAL_ACCESS_PASSWORD='playwright-internal-access'; npx next start --port 43210 --hostname 127.0.0.1`; wait for `(Invoke-WebRequest http://127.0.0.1:43210/ -UseBasicParsing).StatusCode` = `200`; then `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; npx playwright test` → 0 failed, including `tests/budgets/*`.
- [ ] **G7. After-screens.** Server still running: `$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'; $env:PW_MODE='production'; $env:PW_SHOTS='after'; $env:PW_STAGE='S05'; npx playwright test tests/tools/stage-screens.spec.ts` → PNGs in `test-artifacts/stage-screens/S05-after/` at 320, 375, 768, 1024, 1440. Compare with `S05-before/`; send both sets to the operator with SendUserFile. Stop the server (G1 command) and clear the flags: `$env:PW_SHOTS=$null; $env:PW_STAGE=$null; $env:PLAYWRIGHT_SKIP_WEB_SERVER=$null; $env:PW_MODE=$null`.
- [ ] **G8. Budgets.** Paste the measured numbers of every budget this plan lists (from the G6 output) into the stage summary. Any budget over its fail line fails the gate.
- [ ] **G9. Code review.** Invoke the `code-review` skill on `git diff claude/tipoasis-tracking-renewal-ae0e3a...HEAD`. Fix every CRITICAL and HIGH finding; if code changed, re-run G2–G6.
- [ ] **G10. Verification.** Invoke `superpowers:verification-before-completion`; paste each command and its result line into the stage summary.
- [ ] **G11. Commit.** `git status` shows only this stage's files (see the roadmap File Map). Commit any remainder with a conventional message and no attribution trailer.
- [ ] **G12. No deploy.** Do not push to `main`; do not run `vercel deploy`. Push `renewal/s05-design-tokens-common` only if the operator asked. Hand the stage summary to the operator; merge into the integration branch only after acceptance (roadmap §5).

S05 budget lines for G8: `[font-budget] home: N B in the first view, 1 preload(s)` and `[font-budget] deep link: …` (fail above 102400 B or above 2 preloads; S05 expects exactly 1) from `tests/budgets/font-preload.spec.ts`; `[budget] status-head field at 375x812: N px (max 300 px)` from `tests/e2e/ui-kit.spec.ts`; token contrast from `tests/unit/tokens.spec.ts` (all 22 requirements pass — lowest text pair 5.60:1 problem, lowest UI pair 3.75:1 route); "no text ≤ 11 px" from `tests/e2e/ui-kit.spec.ts`. Expected before/after screen difference: only the typeface (IBM Plex Sans KR → system Korean gothic on the legacy pages); layout, colors and copy of `/` and `/{번호}` must be unchanged, because S05 does not restyle the legacy UI. Record the approval 9 and 13 statuses and, when SKIPPED, the fallback evidence (Task 15 Step 1; Task 16 Step 1 checklist).

---

## Additions to the contract (continued, Tasks 7–16)

Additive, no §11 name renamed; reported as contract deviations together with items 1–9 above.

10. **`JourneySpine` DOM:** the slot root `<div data-slot="journey">` wraps the `<ol aria-label data-spine-current>` and, only when `spine.current === null`, a visible `<p data-spine-part="unknown">위치 확인 전</p>` after the list (the `<ol>` keeps the plain label '배송 여정 4구간' in every state). `data-issue` sits on the station named by `issue.at`, which may be a `todo` station ahead of the current one (code-based state with a carrier delay). Code 4 (`handoffPending`) keeps ② `current` with a check icon and `<span data-spine-part="sub">인계 대기</span>`.
11. **`EtaDisplay` composition:** `data-eta-dday` exists only for kind `date` and sits inside `[data-eta-value]` after the visual; the visual is built from `date.month`, `date.day`, `date.weekday` as `{month}월 {day}일 ({weekday})`, which must equal `date.label` (S03's `formatKstDate` form '9월 30일 (수)'); the ui-kit test fails if S03's label format drifts. `holidayAffected` renders `[data-eta-badge]` with an aria-hidden calendar icon; `caption` renders `[data-eta-caption]`.
12. **`AffiliateLinkGroup` reads config:** it imports the named export `disclosures` from `config/site.config.ts` (client-safe per §11.7) to render the disclosure when an affiliate link arrives with `disclosure: null`; a non-null `disclosure` with no affiliate link is not rendered. Row layout is one column below 360 px, two columns from 360 px.
13. **`TalkLink` / `NoticeBanner` details:** `TalkLink` shows the aria-hidden speech-bubble icon at every placement except `header`. `NoticeBanner` renders '안내' + `notice.body` in both variants; the banner is `<aside aria-label="안내">` on `--tt-ground`; `notice.title` is not rendered by the primitive (CS replies and the internal notices tab use it).
14. **CSS additions in `app/styles/tokens.css`:** `@keyframes tt-paint` on `[data-slot="status-head"]` (`--tt-motion-base`, once) next to `tt-grow`; `[data-slot="status-head"] .text-tt-muted` and `[data-slot="status-head"] [data-affiliate-disclosure]` switch to `--field-fg` (muted never on a field); `@media (forced-colors: active)` paints spine bars with `CanvasText`. Together with `tt-grow` this is the whole framer-motion replacement S06 relies on (DESIGN.md §7 table).
15. **`CopyButton` behavior:** a full-width wrapper `<div>` holds the trigger and, on fallback, `<textarea readonly data-copy-fallback="true" aria-label={label} rows=3>` that is focused with the whole text selected; a rejected or synchronously throwing `copyText` both count as `"fallback"`; the outcome resets when `text` changes; `copyAndOpen` never calls `preventDefault`.
16. **Gallery-only names:** `UiKitInteractive({ returnLink, inquiryText, talkUrl, talkLabel })`; `data-demo` ids `status-head`, `field-<tone>`, `spine-*`, `eta-*`, `field-eta-holiday`, `number-bar-*`, `talk-*`, `affiliate-*`, `field-links`, `notice-banner`, `notice-inline-<kind>`, `copy`, `copy-and-open`; `data-copy-text`, `data-copy-outcome` (`none|copied|fallback`). S08 may add demos (its style switcher) but must keep these ids.
17. **Test helpers private to `tests/e2e/ui-kit.spec.ts`** (S08 extends the same file): `openKit` (waits for one-shot animations through `settleAnimations`), `visibleTextSamples`, `probeFocused`, `readSpine`, `blockClipboard`, `STATION_IDS`, `STATION_NAMES`, `LONG_HBL`, `HOME_NOTICE_BODY`.
18. **`tests/unit/tokens.spec.ts` pins the `design-system/` file list** (`DS_FILES`) and requires `_base.css` to embed `app/styles/tokens.css` verbatim; S08 adds `foundations/styles.html` to `DS_FILES` and decides how `style-manifest.css`/`style-night.css` reach `_base.css` in its own task.
19. **Budget output format:** `[budget] status-head field at 375x812: N px (max 300 px)` (ui-kit spec) joins S01's `[font-budget] …` lines as the S05 G8 evidence; S07's result-layout test measures the real card against the same `--tt-status-field-max`.

## Self-Review

- **Spec coverage.** §6 번호 바 → Task 9 (4-character groups, monospace, no truncation, 320 px wrap); 상태 카드 칩·톤 → Task 6; 4구간 척추 with exactly one `aria-current=step`, 0 before the location is known, code 4 on ②, 멈춤·끊김·갈림 as color + icon + word → Task 7; 도착 예상 largest text 32–40 px, D-n, holiday badge hiding D-n, withheld/pendingInfo copy → Task 8; '안내' line in the card → Task 11; building blocks of 지금 할 일 (톡톡 text link, copy-and-open with fallback, disclosure-first store group) → Tasks 10 and 12. §8 disclosure first with `isAffiliate` deciding `rel` → Task 10; 톡톡 one style → Task 10. §12: targets 44–52 px (Task 5), focus ring 3 px ≥ 3:1 and text ≥ 4.5:1 across every demo including fields (Task 5 generic tests + in-field demos of Tasks 6–11), 0 text ≤ 11 px (Task 5), 320 px no horizontal scroll (Tasks 5, 9), no infinite animation and reduced motion 0 (Task 11), fonts ≤ 2 preloads and ≤ 100 KB (Task 4). §13: signal tokens and supplements — amber + ink, red only for 문제, link separate from 정상 진행 (Task 1), status-field cap (Task 8 budget), four variant slots (Tasks 5–8), `data-style="signal"` (Task 4); style picker, pre-paint and other styles stay with S08 (S05 ships `STYLE_IDS`, labels, storage key). §14 CopyButton fallback (Task 12), LiveAnnouncer adopted unchanged (not edited; documented in DESIGN.md §9), framer-motion removal prepared (Task 11 + DESIGN.md §7). §16 item 9 → Task 15 (fallback already implemented by Tasks 10/13/14); item 13 → Task 16 (manual checklist fallback). DESIGN.md as the single source → Task 13; `design-system/` regenerated from tokens incl. `journey-spine.html` → Task 14. The home shortcut-row geometry supplement belongs to S06 (roadmap §9).
- **Placeholder scan.** Every code and document step carries its full content; the only branch (which disclosure sentence to quote) names the fallback sentence, the default proposal, and the command that prints the configured `disclosures.coupang` value to copy verbatim (Task 13 Step 3, Task 15 Steps 2 and 4). Gallery captions are internal strings; customer-facing strings come from the spec or from `config/site.config.ts`.
- **Type consistency.** `JourneySpine`, `EtaDisplay`, `NumberBar`, `TalkLink`, `AffiliateLinkGroup`, `NoticeBanner`, `CopyButton` props match roadmap §11.9 exactly; `CopyButtonProps` is the Addition-2 export. `SpineView`, `EtaView`, `EtaDate`, `NumberView`, `StoreLinksView`, `StoreLinkView`, `StorePlacementId`, `ActionWeight`, `TalkPlacement`, `NoticeView`, `Tone` come from `@/lib/tracking/types` only. Gallery helpers keep one name each across tasks (`Field`, `Section`, `StatusHeadDemo`, `CUSTOMS_SPINE`, `DEMO_ETA`, `numberView`, `DELIVERED_STORES`); the type-import line is replaced by exact old/new text in Tasks 7–11. Test totals: `ui-kit.spec.ts` 1 → 10 → 13 → 21 → 28 → 32 → 36 → 40 → 44 (→ 46 with approval 13); `tokens.spec.ts` 12 → 15 → 17 → 22 → 27.
- **Review Focus.** (1) blocked clipboard → Task 12 "falls back …" ×2 and "copyAndOpen …"; (2) long numbers at 320 px → Task 9 "long numbers wrap between groups …"; (3) primitives on a tone field → Task 5 generic contrast/focus tests over the in-field demos of Tasks 6–11 plus Task 10 "no text uses the muted color"; (4) disclosure disagreeing with links → Task 10 "affiliate groups start with the disclosure exactly when a link is affiliate" (`affiliate-missing-disclosure`, `affiliate-naver-only`); (5) forced colors → Task 6 chip border and Task 7 "forced colors: done and current bars keep a CanvasText fill".
- **Stage constraints kept.** No legacy component or `app/globals.css` edit; `app/styles/tokens.css` rules stay keyed by `[data-slot]`, `[data-status-chip]`, `[data-spine-part]` (inside `[data-slot="journey"]`), `[data-eta-dday]` (inside `[data-slot="eta"]`), `[data-affiliate-disclosure]` and `.tt-focus` (the `@keyframes` and `@media` blocks only wrap such rules); no primitive renders a live region; no existing E2E assertion changes, so there is no rule→assertion migration in S05.
