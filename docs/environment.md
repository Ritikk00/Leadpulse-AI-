# Environment Variables

The API loads `server/.env` via dotenv. The root `.env.example` mirrors the server template for reference; the API workspace expects its local `.env` inside `server/`. Both templates contain placeholders only and are safe to commit. `.env` files are ignored by Git.

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | No | `development`, `test`, or `production`; defaults to development. |
| `PORT` | No | Express port; defaults to `5000`. Keep the Vite proxy target in `client/vite.config.js` aligned if you change it. |
| `MONGO_URI` | Yes for API | MongoDB connection URI. |
| `CLIENT_URL` | Yes for browser auth | Exact allowed frontend origin, including scheme and port. Defaults to local Vite. |
| `JWT_ACCESS_SECRET` | Yes | Random secret, minimum 32 characters. Keep separate from refresh secret. |
| `JWT_REFRESH_SECRET` | Yes | Separate random secret, minimum 32 characters. |
| `ACCESS_TOKEN_TTL` | No | JWT duration, defaults to `15m`. |
| `REFRESH_TOKEN_TTL` | No | Refresh JWT duration, defaults to `15d`; the cookie lifetime is fixed at 15 days. |
| `GROQ_API_KEY` | Only for AI | Groq API key. Server only; never add it to a `VITE_*` variable. Legacy `OPENAI_API_KEY` is accepted as a migration fallback. |
| `SMTP_HOST` | Only for email | SMTP hostname. |
| `SMTP_PORT` | Only for email | SMTP port; defaults to `587` (STARTTLS). Port `465` enables TLS directly. |
| `SMTP_USER` / `SMTP_PASSWORD` | Only for email | SMTP account credentials. |
| `SMTP_FROM` | Only for email | Verified sender address. |
| `ADMIN_NOTIFICATION_EMAIL` | Only for admin alerts | Inbox for new-lead notification. |
| `LEAD_ACKNOWLEDGEMENT_ENABLED` | No | Environment fallback for public intake acknowledgement, defaults to `false`. Workspace settings can override it. |
| `WEBHOOK_SECRET` | Required in production for n8n | Shared secret checked using `x-webhook-secret`; required by middleware in production. |
| `VITE_API_URL` | No | Client build-time API base. Default `/api` uses same-origin routing/proxy. Public to browsers; do not put secrets here. |
Generate secrets instead of reusing example strings. Keep API secrets in your hosting provider's server-side secret manager, restrict who can read them, rotate them after exposure, and never print them in logs. For a split frontend/API deployment, set `VITE_API_URL=https://api.example.com/api` at frontend build time and set `CLIENT_URL` to the deployed frontend origin on the API.