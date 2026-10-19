# Troubleshooting

## API does not start

- Check that `server/.env` exists and both JWT secrets are at least 32 characters.
- Verify `MONGO_URI`, DNS/network access, database user permissions, and Atlas IP allow-list.
- The API waits for MongoDB before listening. Read the terminal error for connection details; `GET /api/health` is only available after startup.
- Ensure the port in `PORT` is free and the frontend's Vite proxy targets the same port (default `5000`). Vite uses fixed port `5173` and fails clearly instead of silently selecting a different port.

## Browser shows a network or CORS error

- In development, use the Vite origin `http://localhost:5173`; Vite proxies `/api` to port `5000`.
- For split deployment, `CLIENT_URL` must exactly match the browser origin, including scheme and port. Do not set it to `*`.
- Set `VITE_API_URL` before the production frontend build. Check reverse-proxy path handling when the API base includes `/api`.
- Cookies require `withCredentials` in Axios and `credentials: true` CORS configuration; both are enabled in the starter.

## Sign-in refresh loops or logout on reload

- Confirm the refresh response sets `refreshToken` for `/api/auth`, and that the browser accepts cookies for the configured origins.
- In production, use HTTPS and `NODE_ENV=production`. Cross-site frontend/API deployments may require a different cookie `sameSite` strategy plus CSRF protections; review before changing it.
- Refresh tokens are single-session per user. Signing in elsewhere rotates the stored token hash and invalidates the earlier refresh cookie.

## AI qualification uses its fallback

- Set `GROQ_API_KEY` server-side and restart the API. The legacy `OPENAI_API_KEY` variable is accepted during migration.
- A provider/network error or invalid JSON is logged server-side and safely falls back to a WARM/50 score plus a generic personalized WhatsApp greeting.
- Confirm Groq API access and JSON response mode support. Never log or share the key.

## Email is not delivered

- Configure all SMTP fields (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`) and validate provider sender/domain policies.
- Admin alerts additionally need `ADMIN_NOTIFICATION_EMAIL` and the workspace's **New lead email alerts** setting enabled.
- Lead acknowledgements require the workspace setting or environment fallback to be enabled.
- The app logs notification failures server-side without failing lead creation. Follow-up response `sent: false` means SMTP is not configured.

## n8n reports unauthorized or cannot reach API

- Send `x-webhook-secret` with the exact `WEBHOOK_SECRET` value and restart/redeploy after changing API environment.
- Set n8n `LEAD_API_URL` to the API origin without a trailing `/api` path. Use the n8n production URL after activating the workflow.
- Check n8n expression access policy or configure a Header Auth credential. Confirm outbound network/TLS access from n8n to the API.
- Ensure the lead exists before status, analysis, or follow-up. The `leadId` must be a 24-character Mongo ObjectId.