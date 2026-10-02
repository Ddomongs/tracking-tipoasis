# 사이트 문구·링크 저장소 연결 (Vercel Edge Config)

2026-10-02 요청. 관리자 화면 `/internal/cs-helper?tab=site`('사이트 문구·링크')에서 첫 화면 스토어 칸의
버튼 문구, 제목, 안내 한 줄, 네이버·쿠팡·유튜브 버튼 문구와 링크를 바꿉니다. 저장소를 연결하기 전에는 화면이 보기 전용이고,
사이트는 `config/site.config.ts`의 기본값을 씁니다.

## 1. Edge Config 저장소 만들기 (한 번)

1. Vercel → 팀 → **Storage** → **Create Database** → **Edge Config** → 이름 `tracking-site-settings` → Create.
2. 만든 저장소 화면 → **Projects** → **Connect Project** → `tracking-tipoasis` → Production(필요하면 Preview도) 선택 → Connect.
   - 이때 Vercel이 환경변수 `EDGE_CONFIG`(읽기용 연결 주소)를 자동으로 넣습니다.

## 2. 저장용 토큰 넣기 (한 번)

1. Vercel → 오른쪽 위 프로필 → **Account Settings** → **Tokens** → **Create Token**
   - 이름 `tracking-site-settings`, Scope는 팀(`tracking-tipoasis`가 있는 팀), 만료는 원하는 기간.
2. 프로젝트 `tracking-tipoasis` → Settings → **Environment Variables** (Production):

| 이름 | 값 |
| --- | --- |
| `VERCEL_API_TOKEN` | 위에서 만든 토큰 (비밀값, 커밋 금지. **Sensitive**로 표시하고 Production에만) |
| `VERCEL_TEAM_ID` | `team_MNsFPszrqXW8f3h9bdp26E0D` |

3. **Redeploy** 한 번.

주의: Vercel 토큰은 팀 전체 권한입니다. 이 프로젝트의 서버 함수 전부가 읽을 수 있으니 Sensitive·Production 전용으로 두고,
쓰지 않게 되면 Tokens 화면에서 바로 삭제하세요.

## 3. 확인

- 관리자 화면 '사이트 문구·링크'에서 "볼 수만 있어요" 안내가 사라지면 연결된 것입니다.
- 값을 바꾸고 [저장] → "저장했어요" → 첫 화면을 새로고침하면 바로(늦어도 1분) 바뀝니다.
- 링크는 https이고 `config/site.config.ts`의 `channels.allowedHosts`에 있는 곳만 저장됩니다. 새 쇼핑몰 주소를 쓰려면 그 목록에 호스트를 먼저 추가해야 합니다(코드 배포 필요).
- 유튜브 채널 주소를 비우면 유튜브 버튼이 숨겨집니다.

## 안전장치

- 저장 화면과 저장 주소(`/internal/site-settings`)는 `/internal` 기본 인증 뒤에 있고, 다른 사이트에서 보낸 저장 요청은 거절합니다.
- 저장된 값 중 형식이 틀린 칸은 무시하고 기본값을 씁니다. 저장소가 응답하지 않아도 사이트는 기본값으로 정상 동작합니다.
- 토큰을 지우거나 만료되면 저장만 안 되고(화면에 이유 표시), 사이트 표시는 마지막 저장값을 그대로 씁니다.
