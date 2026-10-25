# Environment Variables

The API loads `server/.env` via dotenv. The root `.env.example` mirrors the server template for reference; the API workspace expects its local `.env` inside `server/`. Both templates contain placeholders only and are safe to commit. `.env` files are ignored by Git.

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | No | `development`, `test`, or `production`; defaults to development. |
| `PORT` | No | Express port; defaults to `5000`. Keep the Vite proxy target in `client/vite.config.js` aligned if you change it. |
| `MONGO_URI` | Yes for API | MongoDB connection URI. |
| `CLIENT_URL` | Yes for browser auth | Exact allowed frontend origin, including scheme and port. Defaults to local Vite. |
| `CORS_ORIGINS` | No | Comma-separated additional frontend origins; `CLIENT_URL` is also allowed automatically, as are localhost development origins. |
| `JWT_ACCESS_SECRET` | Yes | Random secret, minimum 32 characters. Keep separate from refresh secret. |
| `JWT_REFRESH_SECRET` | Yes | Separate random secret, minimum 32 characters. |
| `ACCESS_TOKEN_TTL` | No | JWT duration, defaults to `15m`. |
| `REFRESH_TOKEN_TTL` | No | Refresh JWT duration, defaults to `15d`; the cookie lifetime is fixed at 15 days. |
| `GROQ_API_KEY` | Only for AI | Groq API key. Server only; never add it to a `VITE_*` variable. Legacy `OPENAI_API_KEY` is accepted as a migration fallback. |
| `EMAIL_HOST` | Only for email | SMTP hostname; defaults to `smtp.gmail.com`. Legacy `SMTP_HOST` is supported. |
| `EMAIL_PORT` | Only for email | SMTP port; defaults to `465`. Legacy `SMTP_PORT` is supported. |
| `EMAIL_SECURE` | Only for email | `true` uses TLS from connection start; defaults to `true` for port 465. Set false only for providers requiring STARTTLS. |
| `EMAIL_USER` / `EMAIL_PASS` | Only for email | SMTP account credentials. Legacy `SMTP_USER` / `SMTP_PASSWORD` are supported. |
| `EMAIL_FROM` | Only for email | Verified sender address, e.g. `"LeadPulse AI" <your_email@gmail.com>`. Legacy `SMTP_FROM` is supported. |
| `EMAIL_TLS_REJECT_UNAUTHORIZED` | No | Defaults to `true` to validate the SMTP server's TLS certificate. Keep enabled in production. |
| `ADMIN_NOTIFICATION_EMAIL` | Only for admin alerts | Inbox for new-lead notification. |
| `LEAD_ACKNOWLEDGEMENT_ENABLED` | No | Environment fallback for public intake acknowledgement, defaults to `false`. Workspace settings can override it. |
| `WEBHOOK_SECRET` | Required in production for n8n | Shared secret checked using `x-webhook-secret`; required by middleware in production. |
| `VITE_API_URL` | No | Client build-time API base. Default `/api` uses same-origin routing/proxy. Public to browsers; do not put secrets here. |
Generate secrets instead of reusing example strings. Keep API secrets in your hosting provider's server-side secret manager, restrict who can read them, rotate them after exposure, and never print them in logs. SMTP transport verification runs on startup and logs connection/authentication failures; mail operations have bounded connection, greeting, and socket timeouts. For a split frontend/API deployment, set `VITE_API_URL=https://api.example.com/api` at frontend build time and set `CLIENT_URL` to the deployed frontend origin on the API.