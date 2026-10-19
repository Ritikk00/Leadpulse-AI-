# Deployment

This starter does not assume a hosting provider. You need a Node-capable API host, static frontend hosting (or a Node static server), MongoDB, HTTPS, and optionally an OpenAI-compatible provider, SMTP service, and n8n instance.

## API service

1. Deploy the `server/` workspace or the repository root with npm workspaces enabled.
2. Set `NODE_ENV=production`, `PORT` (the host-provided value or `4000`), `MONGO_URI`, `CLIENT_URL`, and a unique `JWT_SECRET` or independent `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` values of at least 32 characters.
3. Set `WEBHOOK_SECRET` before enabling n8n. Add AI and SMTP values only if those integrations are enabled.
4. Use a managed MongoDB database with least-privilege credentials, encrypted storage, backups, and network restrictions.
5. Set the host's health check to `GET /api/health`. The API starts before MongoDB is ready and retries its database connection; the health endpoint checks process health, not MongoDB readiness. Setup-status returns HTTP `503` while MongoDB is unavailable.
6. Terminate TLS at a trusted proxy/host and configure proxy trust/rate-limit storage for your topology before adding multiple API instances.

## Frontend

Set `VITE_API_URL` at build time. If the frontend and API share one origin behind a reverse proxy, route `/api` to Express and use the default `/api`. If they use separate origins, use a value such as `https://api.example.com/api`; set API `CLIENT_URL` to the exact frontend origin. Keep both services on the same site (for example, `app.example.com` and `api.example.com`) because refresh authentication uses a `SameSite=Strict` cookie. Build with `npm run build` and publish `client/dist` to a static host. Frontend variables are public; never place tokens or provider keys in them.

Configure the static host to serve `index.html` for client-side routes such as `/portal/login`, `/portal/setup`, and `/app/leads`. Configure security headers, HTTPS, compression, and cache hashed assets while leaving the HTML entry revalidatable.

## Before launch

- Verify the fixed 15-day refresh cookie arrives over HTTPS; the API sets `secure` only when `NODE_ENV=production`.
- Setup and public registration are limited to the first admin; admins create employee accounts from the Team area.
- Replace the per-process auth rate limiter with a shared store for multiple API instances.
- Add monitoring, structured logs, alerting, backups, retention/deletion policy, and documented incident response.
- Configure provider billing limits and verify SMTP sender/domain authentication.
- Review `LICENSE` and the Gumroad product terms before distributing the source.