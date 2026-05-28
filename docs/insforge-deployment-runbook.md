# InsForge Deployment Runbook

This repository is linked to InsForge and has a successful InsForge deployment, but the primary frontend deployment is now Vercel.
InsForge remains active for the UNI-PASS Edge Function proxy.

Current verified state:

- GitHub repository: `https://github.com/Ddomongs/tracking-tipoasis`
- Vercel project: `tracking-tipoasis`
- Vercel production URL: `https://tracking-tipoasis.vercel.app`
- Vercel deployment ID: `dpl_C19DuhGU6dU32cHFdnk8TmuBqReR`
- Vercel custom domain alias: `tracking.tipoasis.com`
- InsForge project dashboard: `https://insforge.dev/dashboard/project/84fed775-4e5d-40f2-a533-9781e9758c3f`
- Current InsForge deployment URL: `https://sk9gyysw.insforge.site`
- Current InsForge deployment ID: `c8b7c28a-5fa1-43a7-995c-c2b4c01d6dce`
- GitHub CI passes `npm ci`, `lint`, `typecheck`, `build`, and E2E smoke.
- Local `npx @insforge/cli current --json` reports an authenticated InsForge user and linked `tracking-tipoasis` project.

## Required Deployment Secrets

Configure these values in the InsForge project or in GitHub Actions secrets before deploying:

- `UNIPASS_API_KEY`
- `UNIPASS_API_URL`
- `UNIPASS_PROXY_URL`
- `NEXT_PUBLIC_BASE_URL`

Use:

```text
UNIPASS_API_URL=https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo
UNIPASS_PROXY_URL=https://sk9gyysw.ap-southeast.insforge.app/functions/unipass-proxy
NEXT_PUBLIC_BASE_URL=https://tracking.tipoasis.com
```

## Primary Deploy: Vercel

The local checkout is linked to:

```text
sos8457-8054s-projects/tracking-tipoasis
```

Production deploy:

```bash
npx vercel deploy --prod --yes
```

Production environment variables are already configured on Vercel.
If values need to be replaced later, use `npx vercel env add <name> production --force`.

Live API verification after deployment:

```text
POST https://tracking-tipoasis.vercel.app/api/track
509494650981 -> HTTP 200, currentStatus=반출신고, customsEvents=10
303595969624 -> HTTP 200, currentStatus=통관목록접수, customsEvents=7
509493884901 -> HTTP 200, currentStatus=반출신고, customsEvents=11
```

## InsForge Frontend Fallback: Deploy From This Machine

Authenticate first:

```bash
npx @insforge/cli login
```

If browser login is unavailable, use a personal API key:

```bash
npx @insforge/cli login --user-api-key "<uak_...>"
```

Confirm context:

```bash
npm run insforge:current -- --json
```

If the project is not linked yet, create it once:

```bash
npx @insforge/cli create --name tracking-tipoasis --template empty
```

Then configure deployment variables and deploy:

```bash
npx @insforge/cli deployments env set UNIPASS_API_KEY "<value>"
npx @insforge/cli deployments env set UNIPASS_API_URL "https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo"
npx @insforge/cli deployments env set UNIPASS_PROXY_URL "https://sk9gyysw.ap-southeast.insforge.app/functions/unipass-proxy"
npx @insforge/cli deployments env set NEXT_PUBLIC_BASE_URL "https://tracking.tipoasis.com"
npm run insforge:deploy
```

## InsForge Frontend Fallback: Deploy From GitHub Actions

The manual workflow is:

```text
.github/workflows/deploy-insforge.yml
```

For InsForge Cloud, add repository secrets:

- `INSFORGE_USER_API_KEY`
- `UNIPASS_API_KEY`

For self-hosted InsForge, add repository secrets:

- `INSFORGE_API_BASE_URL`
- `INSFORGE_API_KEY`
- `UNIPASS_API_KEY`

Then run the workflow manually from GitHub Actions.

## Self-Hosted InsForge Notes

Self-hosting InsForge is separate from deploying this app.

The InsForge self-hosting docs require a VPS-style environment with Docker Compose. A typical cPanel shared hosting account is usually not enough for the InsForge control plane because the platform runs PostgreSQL, PostgREST, the InsForge backend/dashboard, and Deno services.

Minimum missing infrastructure information:

- VPS/public server IP or hostname
- SSH user and key
- InsForge API base URL
- InsForge project API key
- Whether deployments are enabled on that self-hosted instance

## Custom Domain

The target public URL remains:

```text
https://tracking.tipoasis.com
```

At the time of the current InsForge deployment documentation, custom domains for InsForge Deployments are listed as coming soon. If the deployed site is backed by Vercel through InsForge, domain binding may need to be completed through whichever provider surface InsForge exposes for that deployment.

For the current Vercel deployment, the domain has already been added as a project alias.
DNS must be changed at the current DNS provider before the domain resolves to Vercel.

Required DNS record:

```text
A tracking.tipoasis.com 76.76.21.21
```

Current DNS before cutover:

```text
A tracking.tipoasis.com 158.247.212.123
```

Do not change the root `tipoasis.com` record or mail-related records for this cutover.
