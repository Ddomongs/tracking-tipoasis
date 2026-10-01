# KPI 대시보드 정의

- 목적: 개편이 "가장 빨리 안심하고 다음 행동을 바로 안다"를 이뤘는지, 문의와 수익을 해치지 않았는지를 매주 같은 식으로 봅니다(스펙 §1 성공 기준, §11 KPI).
- 비교 창: 개편 전 4주(기준선, `observability-baseline.md`)와 개편 뒤 4주. 수익(KPI 6)은 배포 전후 2주씩 비교합니다.
- 출처: 승인 13이 있으면 Vercel Web Analytics 이벤트와 Speed Insights를 씁니다. 승인 13이 없으면 대체 출처(Observability 요청 수, 톡톡 수기 분류, AdSense·파트너 대시보드)만 씁니다. 아래 표에 두 출처를 모두 적어 둡니다.
- 개인정보: 이벤트와 보고서에는 조회번호·전화번호·입력 내용이 없습니다. 이 문서에도 적지 않습니다.

## 켜기 전 준비(승인 13, 운영자)

- Vercel 대시보드 → 프로젝트 `tracking-tipoasis` → Analytics에서 Web Analytics를, Speed Insights에서 Speed Insights를 켭니다. R5 배포 전에 켭니다.
- 사용자 지정 이벤트는 Vercel 요금제에 따라 쓸 수 있는 속성 수가 다릅니다. 이 사이트의 이벤트는 속성을 최대 2개만 보냅니다. 요금제 화면에서 사용자 지정 이벤트가 켜져 있는지 확인합니다.
- 배포 뒤 하루 안에 Web Analytics의 페이지 목록이 `/`, `/[trackingNumber]`, `/privacy`처럼 템플릿으로만 보이는지 확인합니다. 번호가 보이면 바로 Web Analytics를 끄고 알립니다.

## 이벤트(속성은 모두 정해진 값)

| 이벤트 | 속성 | 뜻 |
|---|---|---|
| `lookup_start` | `entry`(manual, deepLink, restore, carrierChip, retry, autoRetryOnline), `repeat`(같은 탭 10분 안 두 번째 이후 조회면 true) | 조회 시작 |
| `lookup_settle` | `state`(상태 키, 걱정 기준일이 지났으면 뒤에 `+overdue`), `wait`(lt1, 1to3, 3to8, 8to25, 25to45, timeout) | 결과나 오류가 화면에 나온 때 |
| `lookup_error` | `cause`(오류 원인 키) | 오류로 끝난 조회 |
| `action` | `action`(종류@자리, 예: talk@header, copyAndTalk@state, storeLink@deliveredLead), `state` | 링크 누름 |
| `details_open` | 없음 | 처리 내역 펼침 |
| `notice_view` | `id`(공지 id) | 공지가 화면에 나옴 |
| `style_select` | `style`(signal, manifest, night) | 화면 스타일 바꿈 |
| `helpful` | `value`(yes, no) | 정의만 있음(화면 없음) |

## KPI 표

| # | KPI | 식 | 출처(승인 13 이후) | 대체 출처 | 목표·경보 |
|---|---|---|---|---|---|
| 1 | 조회당 문의 | 주간 톡톡 문의 ÷ 주간 조회 | 분자: 수기 분류 합계. 분모: `lookup_start` 수 | 분모: Observability `/api/track` 요청 수 | 개편 뒤 4주 평균이 개편 전 4주보다 낮을 것 |
| 2 | 정상 대기 3상태의 톡톡 클릭률 | `action`(talk·copyAndTalk)이면서 `state`가 customsArrived, customsWaiting, customsCleared, handedToCarrier, pickedUp, inTransit 중 하나(`+overdue` 없음)인 수 ÷ 같은 `state`의 `lookup_settle` 수 | 이벤트 | 수기 분류 '위치·언제 와요' ÷ 조회 | 가설: 개편 전의 절반 |
| 3 | 문제 상태 톡톡 중 문의 내용 복사 비율 | copyAndTalk ÷ (talk + copyAndTalk), `state`가 오류·stale·lookupUnavailable·ambiguous 이거나 `+overdue` | 이벤트 | 톡톡 첫 메시지가 '[배송 문의] 조회번호 …' 형식인 문의 ÷ 문제 상태 문의(수기) | 50 % 이상 |
| 4 | 같은 탭 10분 안 재조회 | (`lookup_start`의 `repeat`=true 수 + `entry`=restore 수) ÷ `lookup_start` 수 | 이벤트 | 없음(측정 불가로 표시) | 개편 뒤 감소(불안의 대리 지표) |
| 5 | 결과 대기 버킷 | `wait`가 25to45 또는 timeout인 `lookup_settle` ÷ 전체 `lookup_settle` | 이벤트 | 승인 5 뒤 `track_lookup`의 `elapsedBucket`이 `ge15s`인 줄 ÷ 전체 `track_lookup` 줄(서버 처리 시간만 재고 가장 긴 버킷이 15초 이상이라 25초 초과를 직접 세지 못합니다. 이 비율이 1 % 미만이면 목표도 지킨 것으로 봅니다) | 25초 초과 1 % 미만 |
| 6 | delivered 스토어 클릭률과 '/' RPM | `action` storeLink@deliveredLead ÷ `state`=delivered인 `lookup_settle`; '/' RPM은 AdSense 보고서 | 이벤트 + AdSense | 파트너 대시보드의 deliveredLead 링크 클릭 수 + AdSense | '/' RPM 15 % 하락 시 되돌림 규칙 |
| 7 | 필드 LCP·INP·CLS p75 | Speed Insights의 경로별 p75(`/`, `/[trackingNumber]`) | Speed Insights | 없음(CI 예산 `tests/budgets`만) | LCP 2.5초 이하, INP 200ms 이하, CLS 0.05 이하 |

- 스타일 사용 비중: `style_select`의 `style`별 비중을 4주마다 봅니다. 거의 쓰이지 않는 스타일의 정리 여부는 운영자가 정합니다(스펙 §13 "정리 기준").

## 되돌림 규칙: '/' RPM 15 %

- 개편 뒤 2주의 '/' RPM 평균이 개편 전 2주보다 15 % 이상 낮으면, 홈 광고 로더 지연 규칙부터 되돌립니다(로드맵 §3 질문 5).
- 해당하는 경우: 승인 7로 `lib/ads/ad-gate.ts`의 `AD_TIMING_POLICY`가 `"afterAllowedResult"`일 때만입니다.
- 방법: `AD_TIMING_POLICY`를 승인 6 상태에 맞게 바꾸는 PR을 엽니다. 승인 6이 approved이면 `"afterScrub"`, 아니면 `"neverOnNumberRoutes"`. PR → CI → main 순서입니다.
- 되돌린 뒤 2주를 다시 비교하고 결과를 "결정 기록"에 적습니다.

## 주간 표

| 주(월요일) | KPI 1 | KPI 2 | KPI 3 | KPI 4 | KPI 5 | KPI 6 스토어 | KPI 6 '/' RPM | KPI 7 LCP | KPI 7 INP | KPI 7 CLS | 비고 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | | |

## 결정 기록

| 날짜 | 근거(KPI와 기간) | 결정 |
|---|---|---|
| | | |
