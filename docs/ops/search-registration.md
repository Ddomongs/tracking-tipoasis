# 검색 등록 절차 (네이버 서치어드바이저 · Google Search Console)

2026-10-02, 요청 ②(검색 유입). 코드는 준비되어 있고, 아래는 운영자가 한 번만 하면 되는 등록 작업이다.

## 이미 들어가 있는 것

- `https://tracking.tipoasis.com/sitemap.xml`: 홈, `/guide`, 가이드 5개, `/privacy`. 조회번호 주소는 넣지 않는다.
- `robots.txt`: `/api/`, `/internal/`만 막고, 사이트맵 주소를 알린다.
- 조회번호 주소(`/{번호}`)는 `X-Robots-Tag: noindex, nofollow` 헤더로 검색 결과에서 빠진다.
- 대표 이미지 `/og.png`(1200×630), 가이드의 FAQPage·BreadcrumbList 구조화 데이터(홈의 WebSite 구조화 데이터는 '/' HTML 35 KB 예산 때문에 넣지 않음).

## 1. 소유 확인 코드 받기

### 네이버 서치어드바이저
1. https://searchadvisor.naver.com 에 로그인 → 웹마스터 도구 → 사이트 등록 → `https://tracking.tipoasis.com` 입력.
2. 소유 확인 방법에서 **HTML 태그**를 고른다.
3. `<meta name="naver-site-verification" content="코드" />`에서 **content 값(코드)만** 복사한다.

### Google Search Console
- 권장: **도메인 속성**(`tipoasis.com`)으로 등록하고 DNS TXT 레코드로 확인한다. 이 경우 코드 작업이 필요 없다.
- 또는 **URL 접두어 속성**(`https://tracking.tipoasis.com/`) → 확인 방법 **HTML 태그** → `content` 값만 복사한다.

## 2. Vercel에 넣고 재배포

Vercel → 프로젝트 `tracking-tipoasis` → Settings → Environment Variables (Production):

| 이름 | 값 |
| --- | --- |
| `NAVER_SITE_VERIFICATION` | 네이버 content 값 |
| `GOOGLE_SITE_VERIFICATION` | 구글 content 값 (HTML 태그 방식일 때만) |

비밀값은 아니지만(HTML에 그대로 보임) 코드 수정 없이 바꿀 수 있도록 환경변수로 둔다. 영문·숫자·`_`·`-` 8~128자만 받는다. 저장한 뒤 **Redeploy**해야 반영된다.

확인(PowerShell): `(Invoke-WebRequest https://tracking.tipoasis.com/).Content -match 'site-verification'` 이 `True`면 된다.

## 3. 콘솔에서 확인 후 사이트맵 제출

1. 각 콘솔에서 **소유 확인**을 누른다.
2. 네이버: 요청 → 사이트맵 제출 → `https://tracking.tipoasis.com/sitemap.xml`.
3. 구글: Sitemaps → `sitemap.xml` 제출.
4. 네이버: 검증 → 웹 페이지 수집 → `https://tracking.tipoasis.com/guide` 수집 요청(선택).

## 4. 이후 볼 것

- 반영까지 며칠~몇 주가 걸린다. 1~2주 뒤 두 콘솔의 색인 현황과 검색어를 확인한다.
- 조회번호 주소가 색인 목록에 보이면 바로 알려 줄 것(헤더 noindex가 빠졌다는 뜻).
