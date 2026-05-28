# Deployment Notes

## Target

This project is moving from the previous ChemiCloud standalone workflow to an InsForge deployment workflow.

- Source control: GitHub public repository `Ddomongs/tracking-tipoasis`
- Primary deployment: InsForge deployment
- Final production URL: `https://tracking.tipoasis.com`
- Current InsForge deployment URL: `https://sk9gyysw.insforge.site`
- Current InsForge deployment ID: `9e6214a7-3dcc-4f89-9f63-57129d5aa776`
- InsForge project dashboard: `https://insforge.dev/dashboard/project/84fed775-4e5d-40f2-a533-9781e9758c3f`

## Recommended Flow

1. Keep generated artifacts out of Git.
2. Push only source, config, tests, and docs to GitHub.
3. Configure deployment environment variables in InsForge.
4. Deploy with InsForge CLI or MCP.
5. Verify the current InsForge deployment URL.
6. Connect `tracking.tipoasis.com` after domain support/DNS setup is ready.

## Environment Variables

Security rules:

- Do not commit `.env.local`.
- Set `UNIPASS_API_KEY` in InsForge deployment environment variables.
- Keep API calls on server routes only (`POST /api/track`).
- Keep `UNIPASS_API_KEY` empty in local env files by default.

Required values:

- `UNIPASS_API_KEY`: UNI-PASS API001 key (server-side only)
- `UNIPASS_API_URL`: `https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo`
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
npx @insforge/cli deployments env set NEXT_PUBLIC_BASE_URL "https://tracking.tipoasis.com"
npm run insforge:deploy
```

If browser login is unavailable in an agent terminal, authenticate with a personal API key:

```bash
npx @insforge/cli login --user-api-key "<uak_...>"
```

Current deployment blocker: InsForge CLI is installed, but this machine is not authenticated yet.
`npx @insforge/cli current --json` reports `authenticated: false`.

See [docs/insforge-deployment-runbook.md](./docs/insforge-deployment-runbook.md) for the full handoff, including the manual GitHub Actions deployment path.

## Legacy Artifacts

Previous ChemiCloud/CloudLinux packages are kept locally under ignored paths such as `release/`, `deploy/`, `backups/`, and `deploy.zip`. They are intentionally excluded from Git.
