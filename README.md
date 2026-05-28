# tracking-tipoasis

구매대행 고객이 통관 및 국내 배송 상태를 한 페이지에서 조회할 수 있는 Next.js 웹앱입니다.

## Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui 스타일 컴포넌트
- UNI-PASS 통관 조회
- CJ대한통운 배송 조회
- Playwright E2E smoke test

## Local Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

## Environment Variables

Server-only values must be configured in the deployment platform and must not be committed.

```bash
UNIPASS_API_KEY=
UNIPASS_API_URL=https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo
NEXT_PUBLIC_BASE_URL=https://tracking.tipoasis.com
```

## Deployment

The target deployment path is InsForge deployment first, then custom domain connection for:

```text
https://tracking.tipoasis.com
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the current deployment checklist.
