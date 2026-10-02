# Deployment Notes

## Target

This project has moved from the previous ChemiCloud standalone workflow to a Vercel frontend deployment.
UNI-PASS is called directly from the Vercel function in `icn1`; the InsForge proxy was retired in R4 (approval 12).

- Source control: GitHub public repository `Ddomongs/tracking-tipoasis`
- Primary deployment: Vercel
- Vercel project: `tracking-tipoasis`
- Current Vercel URL: `https://tracking-tipoasis.vercel.app`
- Final production URL: `https://tracking.tipoasis.com`
- Last manual CLI deployment ID: `dpl_Hu3jWM5VNMc4KWBXpf63kkkpptKK` (2026-07-20)
- Deployment trigger: push to `main` on GitHub (Vercel Git integration); CLI deploy is the fallback

## Recommended Flow

1. Keep generated artifacts out of Git.
2. Push only source, config, tests, and docs to GitHub.
3. Configure deployment environment variables in Vercel.
4. Push to `main`; GitHub Actions CI and the Vercel Git integration deploy automatically.
5. Verify the current Vercel deployment URL, `POST /api/track`, and that `/internal/cs-helper` asks for a password.

## Environment Variables

Security rules:

- Do not commit `.env.local`.
- Set `UNIPASS_API_KEY` in Vercel project environment variables.
- Keep API calls on server routes only (`POST /api/track`).
- Keep `UNIPASS_API_KEY` empty in local env files by default.

Required values:

- `UNIPASS_API_KEY`: UNI-PASS API001 key (server-side only)
- `UNIPASS_API_URL`: `https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo`
- `NEXT_PUBLIC_BASE_URL`: `https://tracking.tipoasis.com`
- `INTERNAL_ACCESS_PASSWORD`: browser basic-auth password for `/internal/*` (any username). When unset in production the pages return 404.

## Local Verification

Run these before deployment:

```bash
npm run lint
npm run typecheck
npm run build
```

Run smoke E2E when a browser environment is available:

```bash
npm run test:e2e
```

## GitHub Verification

GitHub Actions runs the same verification gate on pushes and pull requests to `main`:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:e2e`

## Vercel CLI Notes

The Vercel CLI is available through:

```bash
npx vercel --help
```

Current local project link:

```text
project: tracking-tipoasis
owner: sos8457-8054s-projects
```

Typical production deploy:

```bash
npx vercel deploy --prod --yes
```

Current Vercel environment variables are configured for Production:

```text
NEXT_PUBLIC_BASE_URL=https://tracking.tipoasis.com
UNIPASS_API_URL=https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo
UNIPASS_API_KEY=<server secret>
INTERNAL_ACCESS_PASSWORD=<server secret>
```

Custom domain status:

```text
tracking.tipoasis.com -> Vercel project alias added
required DNS: A tracking.tipoasis.com 76.76.21.21
current DNS before cutover: A tracking.tipoasis.com 158.247.212.123
```

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

되돌리기: 배포 직후 A가 계속 늘거나 `allFailed`가 대부분이면 Vercel 대시보드 → Deployments에서 직전 배포로 Instant Rollback 한 뒤 원인을 봅니다.

## AdSense Auto Ads

Auto ads are controlled in the AdSense dashboard, not in code. Element-level exclusion is only available there
(Ads -> By site -> Edit -> Excluded areas, which accepts CSS selectors). The page exposes stable selectors for it:

```text
#tracking                          hero + lookup section (keep ads out)
#tracking-panel                    the light lookup card
[data-tracking-result-summary]     result summary card
[data-ad-exclude="true"]           every area we consider off-limits
```

The ad script is loaded with `lazyOnload` so it never delays first paint.

## Legacy Artifacts

Previous ChemiCloud/CloudLinux packages under `release/`, `deploy/`, `backups/`, and `deploy.zip` are no longer used and are excluded from Git. They can be deleted safely.

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
