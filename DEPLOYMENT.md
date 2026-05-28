# Deployment Notes

## Target

This project has moved from the previous ChemiCloud standalone workflow to a Vercel frontend deployment.
InsForge remains in use for the UNI-PASS Edge Function proxy.

- Source control: GitHub public repository `Ddomongs/tracking-tipoasis`
- Primary deployment: Vercel
- Vercel project: `tracking-tipoasis`
- Current Vercel URL: `https://tracking-tipoasis.vercel.app`
- Final production URL: `https://tracking.tipoasis.com`
- Current Vercel deployment ID: `dpl_C19DuhGU6dU32cHFdnk8TmuBqReR`
- InsForge frontend fallback URL: `https://sk9gyysw.insforge.site`
- Current InsForge deployment ID: `c8b7c28a-5fa1-43a7-995c-c2b4c01d6dce`
- InsForge project dashboard: `https://insforge.dev/dashboard/project/84fed775-4e5d-40f2-a533-9781e9758c3f`

## Recommended Flow

1. Keep generated artifacts out of Git.
2. Push only source, config, tests, and docs to GitHub.
3. Configure deployment environment variables in Vercel.
4. Deploy with Vercel CLI.
5. Verify the current Vercel deployment URL and `POST /api/track`.
6. Keep the InsForge Edge Function proxy deployed for UNI-PASS access.

## Environment Variables

Security rules:

- Do not commit `.env.local`.
- Set `UNIPASS_API_KEY` in Vercel project environment variables.
- Keep API calls on server routes only (`POST /api/track`).
- Keep `UNIPASS_API_KEY` empty in local env files by default.

Required values:

- `UNIPASS_API_KEY`: UNI-PASS API001 key (server-side only)
- `UNIPASS_API_URL`: `https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo`
- `UNIPASS_PROXY_URL`: `https://sk9gyysw.ap-southeast.insforge.app/functions/unipass-proxy`
- `NEXT_PUBLIC_BASE_URL`: `https://tracking.tipoasis.com`

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
UNIPASS_PROXY_URL=https://sk9gyysw.ap-southeast.insforge.app/functions/unipass-proxy
UNIPASS_API_URL=https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo
UNIPASS_API_KEY=<server secret>
```

Custom domain status:

```text
tracking.tipoasis.com -> Vercel project alias added
required DNS: A tracking.tipoasis.com 76.76.21.21
current DNS before cutover: A tracking.tipoasis.com 158.247.212.123
```

## InsForge CLI Notes

The InsForge CLI is available through:

```bash
npx @insforge/cli --help
```

Check local authentication/project context:

```bash
npm run insforge:current
```

Typical steps:

```bash
npx @insforge/cli login
npx @insforge/cli create --name tracking-tipoasis --template empty
npx @insforge/cli deployments env set UNIPASS_API_KEY "<value>"
npx @insforge/cli deployments env set UNIPASS_API_URL "https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo"
npx @insforge/cli deployments env set UNIPASS_PROXY_URL "https://sk9gyysw.ap-southeast.insforge.app/functions/unipass-proxy"
npx @insforge/cli deployments env set NEXT_PUBLIC_BASE_URL "https://tracking.tipoasis.com"
npm run insforge:deploy
```

If browser login is unavailable in an agent terminal, authenticate with a personal API key:

```bash
npx @insforge/cli login --user-api-key "<uak_...>"
```

Current deployment status: InsForge CLI is authenticated on this machine and the project is linked.
Latest live verification returned `READY` for deployment `c8b7c28a-5fa1-43a7-995c-c2b4c01d6dce`.

See [docs/insforge-deployment-runbook.md](./docs/insforge-deployment-runbook.md) for the full handoff, including the manual GitHub Actions deployment path.

## Legacy Artifacts

Previous ChemiCloud/CloudLinux packages are kept locally under ignored paths such as `release/`, `deploy/`, `backups/`, and `deploy.zip`. They are intentionally excluded from Git.
