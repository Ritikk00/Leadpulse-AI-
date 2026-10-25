# Customization

## Brand and public form

Update the LeadPulse AI colors, type choices, and public inquiry copy in `client/src/styles.css` and `client/src/pages/Landing.jsx`. Outgoing application emails use the LeadPulse AI sender name. Update `intakeSchema` and the matching server `leadInputSchema` together when adding or changing public lead fields. Keep server validation authoritative. The universal inquiry payload is name, phone, optional email, requirement, and timeline.

## Pipeline

Statuses and priorities are defined in `server/src/models/Lead.js`, mirrored in `server/src/utils/validation.js`, and displayed by the client. Keep the enum, update schema, filters, badge styles, and dashboard status order in sync. Add a `LeadActivity` record for any new state transition that needs an audit trail.

## AI provider

The OpenAI-compatible request and system instruction live in `server/src/services/aiService.js`; the response contract is in `server/src/utils/validation.js`. Preserve schema validation before writing to MongoDB, set a timeout, and keep provider credentials server-only. Review business/privacy requirements before sending additional fields.

## Email and automation

`server/src/services/emailService.js` isolates SMTP delivery. Replace or extend this service to use a queue/provider without coupling controllers to the transport. Webhook paths and HMAC/shared-secret middleware are in `server/src/routes/webhookRoutes.js` and `server/src/middleware/webhookAuth.js`. Keep integration payload changes aligned with `docs/api.md` and the n8n exports.

## Multi-user SaaS boundary

This is a single-workspace starter, not a tenant-isolated SaaS implementation. Leads are not scoped by owner or organization. Before onboarding multiple customer workspaces, introduce tenant IDs and query scoping on every lead, activity, assignment, dashboard, and webhook path; add invitation/member management and tenant-isolation tests. Do not deploy it as multi-tenant software without that work.