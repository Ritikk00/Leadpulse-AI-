# REST API

Base path: `/api`. JSON success responses use `{ "success": true, "data": ... }`; errors use `{ "success": false, "error": "..." }` and may include field-level `details`. Authenticated endpoints require `Authorization: Bearer <accessToken>`. The refresh cookie is never returned in JSON.

## Authentication and public intake

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/auth/setup-status` | Public | Check whether an admin account exists |
| `POST` | `/auth/setup` | Public, rate-limited | Create the first admin only |
| `POST` | `/auth/register` | Public, rate-limited | Compatibility alias for first-admin setup; forbidden after setup |
| `POST` | `/auth/login` | Public, rate-limited | Start session |
| `POST` | `/auth/refresh` | Refresh cookie | Issue an access token within the fixed refresh-cookie lifetime |
| `POST` | `/auth/logout` | Optional cookie | End session |
| `POST` | `/auth/forgot-password` | Public, rate-limited | Request reset email |
| `POST` | `/auth/reset-password` | Public, rate-limited | Consume reset token |
| `GET` | `/auth/me` | Access token | Current profile |
| `POST` | `/leads/public` | Public, rate-limited | Website intake form |
| `GET` | `/leads/track?reference=...` | Public, rate-limited | Track an inquiry using its private reference |

`POST /api/leads/inquire` requires `name`, a 10-digit `phone`, `requirement`, and accepts optional `email` and `timeline` (defaulting to `Immediate (Ready now)`). The customer form sends only `{ name, phone, email, requirement, timeline }`; budget is detected from the free-text requirement. Public submissions are assigned to the primary admin, start as `NEW`, and return the saved lead plus a one-time tracking reference. The reference is stored as a hash; tracking returns only `name`, `requirement`, `status`, `createdAt`, and `updatedAt`. Status and priority are assigned by the API. Do not accept user-supplied AI output through the public intake contract.

## Lead and dashboard routes

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/leads` | Access token | Search/filter/paginate leads |
| `POST` | `/leads` | Access token | Create an internal lead |
| `GET` | `/leads/:id` | Access token | Lead plus latest 100 activity events |
| `PATCH` | `/leads/:id` | Access token | Update allowed lead fields/status/priority |
| `PATCH` | `/leads/:id/assign` | Admin | Assign a lead to an employee or pass `employeeId: null` to unassign |
| `DELETE` | `/leads/:id` | Admin | Delete lead and history |
| `POST` | `/leads/:id/analyze` | Access token | Call configured AI provider and validate result |
| `POST` | `/leads/:id/activities` | Access token | Add an activity note |
| `POST` | `/leads/:id/whatsapp` | Access token | Record a WhatsApp chat initiation in the lead activity timeline |
| `GET` | `/dashboard` | Access token | Metric counts, status/source counts, last seven days, recent leads |
| `GET` | `/settings` | Access token | Read email preferences and workspace auto-assignment status |
| `PATCH` | `/settings` | Access token | Update personal email notification preferences |
| `PUT` | `/settings` | Admin | Enable or disable workspace round-robin auto-assignment with `{ "autoAssign": true|false }` |
| `GET` | `/users/employees` | Admin | List employee IDs, names, and emails |
| `PATCH` | `/profile` | Access token | Update name or password |
| `GET` | `/health` | Public | API health response |

`GET /leads` query parameters: `search`, `status`, `priority`, `source`, `page` (1-based), and `limit` (1–100, default 10). Results sort newest first. The dashboard qualification metric is `QUALIFIED / total leads`.

`GET /api/auth/setup-status` returns `{ "success": true, "isSetupComplete": true|false }`. If MongoDB is connecting or unavailable, it returns HTTP `503` with `isSetupComplete: null`. When there is no admin (including after the final admin is deleted), either first-admin endpoint may create an admin; it returns HTTP `403` once any admin exists. Employee accounts do not lock setup. Public registration does not create employees: admins add employees from the Team area. The `/portal/register` page and legacy `/register` route redirect to `/portal/login`.

Round-robin auto-assignment is disabled by default. When enabled, public inquiries are assigned to active employees in creation order. The workspace settings document stores the last assigned employee, updated with an atomic compare-and-set so concurrent inquiries move through the employee list without duplicate cursor advances. If that employee is no longer active, assignment restarts from the first active employee. With no eligible employees, the lead remains unassigned. Turning the setting off restores the normal unassigned public-lead workflow.

## Webhooks

All routes below require `x-webhook-secret: <WEBHOOK_SECRET>` in production. See [n8n setup](n8n-setup.md) for request examples.

| Method | Path | JSON body |
| --- | --- | --- |
| `POST` | `/webhooks/leads` | Lead intake fields |
| `POST` | `/webhooks/lead-status` | `{ "leadId": "...", "status": "QUALIFIED" }` |
| `POST` | `/webhooks/follow-up` | `{ "leadId": "...", "message": "..." }` |
| `POST` | `/webhooks/lead-analyze` | `{ "leadId": "..." }` |

`GET /health` returns API process status only; it does not perform a database readiness check. Use deployment-level monitoring for MongoDB connectivity.