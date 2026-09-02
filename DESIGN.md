# Tracking Page Design System

## 1. Atmosphere & Identity

차분하고 신뢰할 수 있는 배송 안내 화면이다. 사용자는 배송이 궁금하거나 불안한 상태로 방문하므로 조회 결과와 다음 행동을 먼저 보여주고, 기술 과시·로봇·과장된 AI 표현은 사용하지 않는다. 시그니처는 짙은 남색 배경 위에 은은한 항로 빛과 청록색 진행 신호가 이어지고, 에메랄드색이 안전한 다음 행동만 또렷하게 구분하는 것이다.

첫 화면은 **조회 도구가 중심인 비대칭 히어로**다. 왼쪽은 짧은 약속과 신뢰 근거, 오른쪽은 하나의 밝은 조회 패널로 구성한다. 상품·스토어 유도는 조회 흐름을 가로막는 팝업 대신 첫 화면 아래의 독립된 편집형 섹션과 국내 배송 대기·배송 완료 CTA에서 제공한다.

## 2. Color

### Palette

| Role | Token | Dark value | Usage |
|---|---|---:|---|
| Background/base | `background-base` | `#050b17` | 페이지 배경 시작점 |
| Background/mid | `background-mid` | `#0a1324` | 배경 그라디언트 중간 연결점 |
| Background/deep | `background-deep` | `#121f31` | 페이지 배경 끝점 |
| Surface/default | `surface-default` | `slate-900 / 40–75%` | 카드와 입력 영역 |
| Surface/elevated | `surface-elevated` | `slate-950 / 95%` | 플로팅 도움말 |
| Text/primary | `text-primary` | `slate-50` | 제목과 핵심 상태 |
| Text/secondary | `text-secondary` | `slate-300–400` | 설명과 메타데이터 |
| Border/default | `border-default` | `slate-700 / 80%` | 중립 카드 테두리 |
| Accent/info | `accent-info` | `cyan-300` | 조회 및 진행 정보 |
| Accent/action | `accent-action` | `emerald-300–400` | 문의와 완료 행동 |
| Status/warning | `status-warning` | `amber-300` | 주의와 대기 상태 |
| Status/error | `status-error` | `rose-300` | 조회 오류 |
| Channel/naver | `channel-naver` | `#03c75a` | 네이버 링크에만 사용 |
| Channel/coupang | `channel-coupang` | `amber-300` | 쿠팡 링크와 라벨에만 사용 |
| Surface/luminous | `surface-luminous` | `slate-50` | 첫 화면 조회 패널 |
| Text/on-light | `text-on-light` | `slate-950` | 밝은 조회 패널의 제목과 입력 |

### Rules

- 배경은 CSS 그라디언트만 사용하고 외부 3D·로봇 iframe을 사용하지 않는다.
- 광고 스크립트는 유지하되 본문을 바꾸는 AdSense 광고 의도 링크·앵커·칩은 허용하지 않는다. 페이지 전체에 `google-anno-skip`을 적용한다.
- 청록색은 정보, 에메랄드색은 행동, 황색은 주의에 사용한다.
- 스토어 고유색은 해당 외부 링크에서만 사용한다.
- 밝은 surface는 조회 입력 패널 한 곳에 집중해 첫 행동을 명확히 한다.
- 법적·운영 고지와 데이터 출처 문구는 12px에서도 `slate-400` 이상 대비를 유지한다.

## 3. Typography

### Scale

| Level | Size | Weight | Usage |
|---|---:|---:|---|
| Display | `30px / 48px` | 600 | 페이지 제목, 모바일/데스크톱 |
| H2 | `18px / 20px` | 600–700 | 결과·CTA 제목 |
| Body | `16px` | 400–600 | 주요 설명과 버튼 |
| Body/sm | `14px` | 400–600 | 보조 설명 |
| Caption | `12px` | 500–600 | 상태 라벨과 메타데이터 |

### Font Stack

- Body: `IBM Plex Sans KR`, sans-serif
- Display: `Space Grotesk`, `IBM Plex Sans KR`, sans-serif

### Rules

- 고객 행동을 설명하는 본문과 링크는 14px 미만으로 만들지 않는다.
- 영문 대문자 배지나 `AI`, `STEP` 같은 시스템 중심 표현을 사용하지 않는다.
- 한글 문장은 조사·어미가 낱글자로 분리되지 않도록 의미 단위 컨테이너에 `break-keep`을 적용한다.

## 4. Spacing & Layout

### Base Unit

모든 여백은 4px 단위를 따른다. 주 사용값은 8, 12, 16, 20, 24, 32, 40, 48, 64px이다.

### Grid

- 마케팅·히어로 최대 폭: `1152px` (`max-w-6xl`)
- 조회 결과 최대 폭: `1024px` (`max-w-5xl`)
- 모바일 좌우 여백: `16px`
- 데스크톱 좌우 여백: `24px`
- 결과 카드: 모바일 1열, `md` 이상 2열
- 상태별 CTA: 조회 전에는 모든 화면에서 본문 흐름 안의 작은 인라인 도움말. 결과·오류 상태에서는 콘텐츠 흐름 안의 전체 폭 카드
- 히어로: 모바일 1열, `lg` 이상에서 설명과 조회 패널을 6열씩 배치하되 패널의 밝은 surface와 내부 여백으로 시각적 무게를 더한다.
- 스토어 쇼케이스: 모바일 1열, `md` 이상 2열. 실제 추천 상품이 등록되면 가로 스크롤 없이 2~3열 그리드로 확장

## 5. Components

### Card

- **Structure**: 의미 있는 제목·본문을 감싸는 재사용 surface
- **Variants**: neutral, info, success, warning, destructive
- **States**: 정적 카드, 로딩, 오류
- **Accessibility**: 텍스트 대비를 유지하고 색만으로 상태를 전달하지 않는다.
- **Motion**: 페이지 진입 시 `opacity`와 `transform`만 사용한다.

### Tracking Form

- **Structure**: 보이는 국내 택배사 선택과 도움말, 보이는 조회번호 입력, 입력 위치 안내, 조회 버튼, 예시 번호, 형식 안내
- **Layout**: 택배사 선택은 전체 폭, 조회번호와 버튼은 모바일 1열·`sm` 이상 2열로 배치해 긴 운송장 번호가 잘리지 않게 한다.
- **States**: default, focus, submitting, error
- **Accessibility**: 보이는 라벨과 접근 가능한 이름을 모두 `조회번호 (HBL 또는 운송장)`으로 일치시키고, 오류는 조회 영역 아래의 assertive live region에서 안내한다.

### Customer CTA

- **Structure**: 상태 제목, 한 문장 안내, 목적이 명확한 외부 링크
- **Variants / states**:
  - `idle`: 조회 전에 `문의가 필요하신가요?`와 톡톡 문의만 노출. 모바일·태블릿은 인라인, 데스크톱은 플로팅
  - `error`: 조회 실패 시 조회번호 재확인과 톡톡 문의를 우선
  - `pending`: 국내 배송 정보가 없을 때 톡톡과 구매한 스토어 선택 제공
  - `inTransit`: 배송 진행 정보를 먼저 보게 하고 톡톡 문의만 보조 제공
  - `delivered`: 배송 완료 후 네이버·쿠팡 스토어를 우선, 톡톡은 보조 제공
- **Interaction states**: default, hover, focus-visible, active
- **Accessibility**: 링크 이름에 목적지와 새 창 열림을 포함한다. 터치 높이는 최소 44px이다.
- **Disclosure**: 현재 상태 CTA에 쿠팡 제휴 링크가 포함되면 같은 CTA 안에 수수료 제공 가능성을 바로 고지한다.
- **Motion**: 상태 변경 자체에는 별도 애니메이션을 추가하지 않는다.

### Status Banner

- **Structure**: 상태 아이콘, 현재 상태, 진행 단계, 진행 막대
- **States**: pending, customs, delivery, completed
- **Accessibility**: `STEP` 대신 한국어 단계 표현을 사용하고 아이콘은 장식으로 숨긴다.

### Utility Header

- **Structure**: 서비스 설명형 워드마크, `배송 조회`, `이용 안내`, `스토어` 앵커
- **States**: default, hover, focus-visible, active
- **Accessibility**: 첫 링크 앞에 `본문으로 건너뛰기`를 제공하고, 모바일에서도 모든 링크의 터치 높이를 44px 이상 유지한다.
- **Behavior**: `스토어` 앵커는 같은 화면에 `#storefront` 대상이 실제로 렌더링될 때만 노출한다.

### Assurance Rail

- **Structure**: `통관+국내배송`, `조회 정보 입력 안내`, `고객 문의 연결` 세 가지 사실만 짧게 제공
- **Layout**: 카드 세 개가 아니라 하나의 연속된 rail 안에서 구분선으로 나눈다.
- **Accessibility**: 장식 아이콘은 숨기고 문장만으로 의미가 완결되어야 한다.

### Storefront Showcase

- **Structure**: 섹션 소개, 네이버·쿠팡 채널 카드, 선택형 추천 상품 그리드, 제휴 고지
- **Data**: 스토어와 상품은 `lib/storefront.ts`의 readonly 설정에서 관리한다. 상품 데이터가 없으면 가짜 상품명·가격·후기를 만들지 않고 채널 카드만 렌더링한다.
- **States**: 채널 카드 default/hover/focus-visible/active, 상품 목록 populated/empty
- **Interaction**: 팝업·자동 열림·카운트다운을 사용하지 않는다. 사용자가 섹션 링크를 직접 선택할 때만 새 창으로 이동한다.
- **Disclosure**: 제휴 링크가 있으면 섹션 안에 수수료 제공 가능성을 명시한다.
- **Accessibility**: 외부 링크 이름에 채널과 새 창 열림을 포함하며 최소 터치 높이는 44px이다.

### Conversion Footer

- **Structure**: 배송 조회로 돌아가기, 톡톡 문의, 데이터 출처·반영 시점 안내
- **Behavior**: 법적 문서가 실제로 존재하지 않는 동안 가짜 약관·개인정보 링크를 만들지 않는다.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|---|---:|---|---|
| Micro | 150–200ms | ease-out | 링크 hover/focus |
| Standard | 300–350ms | ease-in-out | 페이지·결과 진입 |
| Semantic icon | 1.5–1.9s × 2 | ease-in-out | 경로·조회·문의·통관·배송의 의미를 짧게 설명 |
| Signature route | 4.8s loop | ease-in-out | 첫 화면의 해외 이동→통관→국내 배송 경로만 반복 |
| Loading | 1.7s loop | ease-in-out | 실제 조회 요청이 진행되는 동안에만 반복 |

- `transform`, `opacity`, `filter`만 애니메이션한다.
- `prefers-reduced-motion` 사용자는 비필수 이동과 진입 모션을 생략한다.
- 의미 아이콘은 화면 진입 후 두 번만 재생하고 정지한다. 모든 아이콘에 공통 회전·부유 모션을 적용하지 않는다.
- 스토어·상품 아이콘은 자동 재생하지 않고 사용자가 카드에 포인터를 올렸을 때만 한 번 반응한다.
- 지속 반복은 물류 흐름을 설명하는 대표 경로와 실제 로딩 상태에만 허용한다.
- 조회 성공 후 결과 위치로 이동하되, 사용자 포커스를 잃지 않게 한다.
- 앵커 이동은 부드럽게 처리하되 `prefers-reduced-motion`에서는 즉시 이동한다.
- 스토어 카드는 hover 시 `transform`과 표면색만 바뀌며 자동 재생·주의를 빼앗는 모션은 사용하지 않는다.

## 7. Depth & Surface

전략은 **mixed**다. 기본 카드는 반투명 tonal shift와 1px 저대비 테두리로 구분하고, 플로팅 도움말과 밝은 조회 패널에만 짙은 그림자를 사용한다. 배경 깊이는 두 개의 약한 radial gradient, 항로를 연상시키는 낮은 대비의 선형 패턴, 세로 linear gradient로 만들며 사진·로봇·3D iframe을 사용하지 않는다.

## 8. Conversion & Content Rules

- 화면의 첫 번째 전환 목표는 항상 배송 조회다.
- 톡톡은 문의 상황에서, 스토어 링크는 첫 화면 아래와 국내 배송 대기·배송 완료 상태에서만 강조한다.
- `베스트`, `인기`, `할인`, 가격, 후기 수치는 실제 상품 데이터가 등록된 경우에만 사용한다.
- 사용자를 방해하는 자동 팝업, 닫기 어려운 배너, 가짜 희소성, 가짜 실시간 구매 알림은 금지한다.
- 제휴 링크는 `sponsored nofollow noopener noreferrer` 관계와 눈에 보이는 고지를 함께 사용한다.
- 스토어 클릭 기록과 최근 본 상품을 브라우저 저장소에 새로 저장하지 않는다.
