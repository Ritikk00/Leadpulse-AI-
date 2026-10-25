# Authentication

## Session design

Passwords are hashed with bcryptjs at cost 12. Successful registration/login returns a short-lived signed access token in JSON and an independently signed refresh JWT in a `refreshToken` cookie. The refresh JWT itself is stored in MongoDB only as a SHA-256 digest. The cookie is `httpOnly`, scoped to `/api/auth`, and marked `secure` in production. The browser stores the access token and public user profile in per-tab `sessionStorage`, preventing one tab's admin/employee login from overwriting another tab's identity. The API verifies access-token user ID, role, email, and token version against the current database record.

The API uses one active refresh-token hash per user, so a new login replaces that user's prior refresh session. The refresh session has a fixed 15-day expiry; successful refresh requests issue a new access token without extending the refresh-cookie expiry. Access tokens carry a token version that is advanced on login, logout, password reset, and refresh-token replay detection, revoking older access tokens without storing them.

Initial setup checks specifically for a user with `role: 'admin'`. If no admin exists, `POST /api/auth/setup` (or its compatibility alias `POST /api/auth/register`) creates the first admin and starts a session. Existing employee accounts do not prevent setup; deleting the final admin re-opens it. Once an admin exists, both registration endpoints return HTTP `403`. The public `/portal/register` and `/register` pages redirect to sign-in; only an authenticated admin can create employees through the Team area. Existing `member` records are migrated to `employee` at server startup.

Admins can access all leads and assign leads to employees. Employees can access only leads assigned to them; employee-created leads are automatically assigned to their creator, and older employee-owned leads are migrated at startup. Public inquiries are owned by the earliest registered admin (or have no owner if no admin exists) and begin unassigned with status `NEW`.

## Routes

- `GET /api/auth/setup-status`: returns `{ success, isSetupComplete }`; while MongoDB is unavailable it returns HTTP `503` with `isSetupComplete: null`.
- `POST /api/auth/setup` and `POST /api/auth/register`: create the first admin only, return `403` once an admin exists, and on success return `{ success, data: { user, accessToken } }` plus the refresh cookie.
- `POST /api/auth/login`: authenticates admins and employees and returns `{ success, data: { user, accessToken } }` plus the refresh cookie.
- `POST /api/auth/refresh`: returns a new access token without extending the fixed refresh-cookie expiry.
- `POST /api/auth/logout`: clears the refresh cookie and stored matching token hash.
- `POST /api/auth/forgot-password`: returns the same response whether an account exists; SMTP is needed to deliver a reset link.
- `POST /api/auth/reset-password`: consumes a one-time 30-minute token and invalidates refresh sessions.
- `GET /api/auth/me`: returns the authenticated user's public profile.
- `GET /api/users/employees`: admin-only employee directory for lead assignment.
- `PATCH /api/leads/:id/assign`: admin-only assignment; send `{ "employeeId": "..." }` or `{ "employeeId": null }` to unassign.
- `GET /api/leads/track?reference=...`: rate-limited public tracking. Public intake returns the reference once and stores only its SHA-256 hash. Tracking responses contain only customer-facing name, requirement, status, and timestamps.

Auth endpoints have a per-process rate limit. For multi-instance production, use a shared rate-limit store. CORS allows `CLIENT_URL`, any origins listed in `CORS_ORIGINS`, and localhost development origins with credentials; do not use wildcard origins with cookies.

## Production checklist

Use HTTPS, unique random secrets, a correct frontend origin, and a shared rate-limit store. Configure secure cookies at the reverse proxy. Refresh cookies are `httpOnly`; production defaults to `sameSite=none` with `secure=true` for split-origin deployments. Set `REFRESH_COOKIE_SAME_SITE=lax` when the frontend and API share a site. Add CSRF protections if you change cookie-authenticated state-changing routes. This starter does not include organization/team membership, email verification, SSO, or invitation links; admins create employee accounts and provide their credentials securely.