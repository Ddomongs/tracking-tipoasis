# InsForge Deployment Runbook

This repository is ready for InsForge deployment, but the current machine is not authenticated with InsForge yet.

Current verified state:

- GitHub repository: `https://github.com/Ddomongs/tracking-tipoasis`
- Latest verified commit at the time this runbook was added: `92422f4`
- GitHub CI passes `npm ci`, `lint`, `typecheck`, `build`, and E2E smoke.
- Local `npx @insforge/cli current --json` reports `"authenticated": false`.

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

Create or link the project, then configure deployment variables:

```bash
npx @insforge/cli create --name tracking-tipoasis --template empty
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

## Current Blocker

Remote deployment is blocked until one of these is true:

1. `npx @insforge/cli current --json` reports an authenticated user and linked project.
2. GitHub Actions has the required InsForge authentication secrets and the manual deployment workflow succeeds.
3. A self-hosted InsForge API base URL and project API key are provided.
