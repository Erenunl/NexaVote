# Nexavision

Nexavision is a production-oriented Eurovision-style fan contest voting platform. It includes a static React frontend for GitHub Pages, a Cloudflare Worker API, Cloudflare D1 persistence, secure jury and organizer sessions, a live jury monitor, and a presentation-ready scoreboard.

The Discord bot is intentionally **not** part of this repository. It integrates through the signed server API documented in [docs/DISCORD_BOT_INTEGRATION.md](docs/DISCORD_BOT_INTEGRATION.md).

## Architecture

- `apps/web` — React, TypeScript, Vite, Tailwind CSS. Fully static output; no Node server is required by GitHub Pages.
- `apps/api` — Hono on Cloudflare Workers with D1 migrations, jury/admin APIs, and signed bot integration APIs.
- `apps/api/migrations` — production schema. Ballot and score uniqueness is enforced in D1.
- `apps/api/seed/dev.sql` — safe 12-country demo edition; it contains no credentials.
- `.github/workflows/deploy-pages.yml` — frontend checks, build, SPA fallback, and GitHub Pages deployment.

The frontend and bot are independent clients of the same backend. Voting remains fully functional when the bot is offline.

## Security model

- Jury passwords use PBKDF2-SHA256 with a unique salt and 310,000 iterations; a keyed lookup hash avoids scanning all records.
- Raw passwords are never persisted. Generated passwords are returned once.
- Jury and admin sessions are random bearer tokens; only SHA-256 token hashes are stored.
- Browser tokens live in `sessionStorage`, avoiding cross-origin/third-party-cookie failures.
- One active jury session is enforced by a D1 primary key. Credential rotation revokes it.
- Login attempts are rate limited with generic errors.
- Heartbeats determine online status; a login alone does not keep a jury online.
- Ballots are revalidated server-side and inserted atomically. Database constraints block duplicate ballots, countries, and point values.
- Public endpoints never expose unpublished results, ballots, credentials, tokens, or Discord IDs.
- Bot requests use timestamped, nonce-protected HMAC signatures.

## Prerequisites

- 64-bit Node.js 22.13 or newer
- pnpm 11 (`corepack enable && corepack prepare pnpm@11.25.0 --activate`)
- A Cloudflare account for Worker/D1 deployment
- A GitHub repository with Pages enabled for frontend hosting

## Local development

From the repository root:

```powershell
pnpm install
Copy-Item apps/api/.dev.vars.example apps/api/.dev.vars
Copy-Item apps/web/.env.example apps/web/.env.local
node scripts/generate-admin-hash.mjs
```

Paste the generated value into `ADMIN_PASSWORD_HASH` in `apps/api/.dev.vars`. Replace the other placeholder secrets with independent random values of at least 32 bytes. Then initialize local D1:

```powershell
pnpm --filter @nexavision/api db:migrate:local
pnpm --filter @nexavision/api db:seed:local
```

Run the API and frontend in separate terminals:

```powershell
pnpm dev:api
pnpm dev:web
```

Open `http://localhost:5173`. The API runs at `http://localhost:8787`. Use `/admin` to generate jury credentials; the seed intentionally has none.

## Verification

```powershell
pnpm typecheck
pnpm test
pnpm build
```

The tests cover password authentication, unauthorized requests, single-session enforcement, credential rotation, duplicate submissions, self-voting, duplicate recipients, incomplete ballots, closed voting, and result visibility.

## Cloudflare Worker and D1 setup

Authenticate Wrangler, create D1, and copy the returned database ID into `apps/api/wrangler.toml`:

```powershell
pnpm --filter @nexavision/api exec wrangler login
pnpm --filter @nexavision/api exec wrangler d1 create nexavision-db
```

Set production secrets. Each command prompts securely; do not pass values on the command line:

```powershell
pnpm --filter @nexavision/api exec wrangler secret put PASSWORD_PEPPER
pnpm --filter @nexavision/api exec wrangler secret put ADMIN_PASSWORD_HASH
pnpm --filter @nexavision/api exec wrangler secret put BOT_API_KEY_ID
pnpm --filter @nexavision/api exec wrangler secret put BOT_API_SECRET
```

Set `ALLOWED_ORIGINS` in `wrangler.toml` to the exact GitHub Pages origin (plus localhost only for development), then apply and deploy:

```powershell
pnpm --filter @nexavision/api exec wrangler d1 migrations apply nexavision-db --remote
pnpm --filter @nexavision/api exec wrangler deploy
```

Do not run `seed/dev.sql` against production unless the demo edition is genuinely wanted. Create real editions and entries through `/admin` or controlled D1 provisioning.

## GitHub Pages setup

1. Push the repository to GitHub with the deployment branch named `main` (or adjust the workflow).
2. In **Settings → Pages**, set the source to **GitHub Actions**.
3. In **Settings → Secrets and variables → Actions → Variables**, add:
   - `VITE_API_URL` — deployed Worker origin, for example `https://nexavision-api.example.workers.dev`
   - `VITE_BASE_PATH` — `/REPOSITORY_NAME/` for project Pages, or `/` for a custom/root domain
4. Run **Deploy frontend to GitHub Pages** or push to `main`.
5. Add the final Pages origin to Worker `ALLOWED_ORIGINS` and redeploy the Worker.

The workflow copies `index.html` to `404.html` so direct visits to `/admin`, `/jury`, and other client routes load correctly on GitHub Pages.

## Production checklist

- Replace the D1 placeholder database ID.
- Configure all four Worker secrets with independent production values.
- Restrict `ALLOWED_ORIGINS` to real frontend origins.
- Create the real edition and entries; verify country counts and YouTube URLs.
- Generate/rotate all jury credentials and confirm one-time delivery.
- Test login, a complete ballot, reset, and results publication with non-production data.
- Keep results hidden and voting in `draft` until the organizer is ready.
- Give the separate bot team `docs/DISCORD_BOT_INTEGRATION.md`, the Worker URL, and secrets through a secure channel.

## Environment variables

| Name | Location | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | frontend build | Worker API origin |
| `VITE_BASE_PATH` | frontend build | GitHub Pages repository base path |
| `PASSWORD_PEPPER` | Worker secret | Keyed jury-password lookup |
| `ADMIN_PASSWORD_HASH` | Worker secret | Encoded PBKDF2 administrator password |
| `BOT_API_KEY_ID` | Worker + bot secret stores | Integration key identifier |
| `BOT_API_SECRET` | Worker + bot secret stores | HMAC signing secret |
| `ALLOWED_ORIGINS` | Worker variable | Comma-separated exact frontend origins |
| `SESSION_TTL_MINUTES` | Worker variable | Jury session inactivity TTL |
| `ADMIN_SESSION_TTL_MINUTES` | Worker variable | Admin session TTL |

No production deployment or external Discord action has been performed by this project.

