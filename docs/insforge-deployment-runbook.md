# InsForge Deployment Runbook

This repository is linked to InsForge and has a successful deployment.

Current verified state:

- GitHub repository: `https://github.com/Ddomongs/tracking-tipoasis`
- InsForge project dashboard: `https://insforge.dev/dashboard/project/84fed775-4e5d-40f2-a533-9781e9758c3f`
- Current InsForge deployment URL: `https://sk9gyysw.insforge.site`
- Current InsForge deployment ID: `9e6214a7-3dcc-4f89-9f63-57129d5aa776`
- GitHub CI passes `npm ci`, `lint`, `typecheck`, `build`, and E2E smoke.
- Local `npx @insforge/cli current --json` reports an authenticated InsForge user and linked `tracking-tipoasis` project.

## Required Deployment Secrets

Configure these values in the InsForge project or in GitHub Actions secrets before deploying:

- `UNIPASS_API_KEY`
- `UNIPASS_API_URL`
- `NEXT_PUBLIC_BASE_URL`

Use:

```text
UNIPASS_API_URL=https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo
NEXT_PUBLIC_BASE_URL=https://tracking.tipoasis.com
```

## Option A: Deploy From This Machine

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
npx @insforge/cli deployments env set NEXT_PUBLIC_BASE_URL "https://tracking.tipoasis.com"
npm run insforge:deploy
```

## Option B: Deploy From GitHub Actions

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

## Remaining Custom Domain Work

Remote deployment is complete. The remaining production cutover task is custom domain binding for:

```text
https://tracking.tipoasis.com
```

If InsForge exposes domain binding for the deployment, connect the domain there. If the deployment is backed by Vercel, domain binding may need to happen through the provider surface exposed by InsForge.
