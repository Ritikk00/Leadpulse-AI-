# n8n Setup

The exports in `n8n-workflows/` are inactive starter workflows. They are designed to be imported and configured, not activated with embedded URLs or credentials.

## Configure n8n

1. In n8n, select **Workflows → Import from file** and import each JSON file.
2. Configure the n8n runtime variables `LEAD_API_URL` (API origin only, for example `https://api.example.com`), `WEBHOOK_SECRET` (same random value as the API's secret), `SMTP_FROM`, and `ADMIN_NOTIFICATION_EMAIL`.
3. If your n8n deployment blocks environment access in expressions, either enable environment access only for a trusted n8n instance, or replace the header expression with an n8n-managed Header Auth credential and select it on each HTTP Request node. Do not expose the shared secret in a public webhook response or browser.
4. Configure an SMTP credential on **Email workspace owner** in `new-lead-notification.json`.
5. Test each workflow while inactive using its n8n test URL. Inspect n8n execution data and API responses. Switch to the production webhook URL and activate only after successful tests.

On self-hosted n8n, environment values are provided to the n8n service/container by its operator; do not commit them in this repository. For n8n Cloud, use n8n credentials where expression access to environment variables is unavailable.

## Workflow behavior

- **New lead notification** exposes an n8n webhook for an upstream form/CRM. It sends the incoming JSON body to `POST /api/webhooks/leads`, then emails the workspace owner. The app can also send its own admin notification. Turn off **New lead email alerts** in app Settings when using this workflow's email node to avoid duplicate emails. Expected incoming body: `name`, a 10-digit `phone`, `requirement`, optionally `email` and `timeline`.
- **AI lead qualification** accepts `{ "leadId": "<Mongo ObjectId>" }`, then calls `POST /api/webhooks/lead-analyze`. The app's server-side OpenAI-compatible configuration performs analysis and stores validated output.
- **Lead follow-up** accepts `{ "leadId": "<Mongo ObjectId>", "message": "..." }`, then calls `POST /api/webhooks/follow-up`. The API sends the email via its configured SMTP service and adds an activity event.

## Connect another trigger

To start qualification or follow-up from another workflow, call the imported workflow's production webhook URL from that upstream node. The n8n webhook URL is not the same as the application's `/api/webhooks/...` URL: the n8n workflow receives the trigger and then calls the application with its shared secret.

## Security notes

Generate a long, random `WEBHOOK_SECRET`, store it in both API and n8n secret configuration, and rotate both copies together. Use HTTPS between n8n and the API. Restrict n8n webhook access as appropriate; a public n8n webhook can be invoked by anyone who knows its URL, so use n8n authentication/IP restrictions or add a signature-verification node for sensitive triggers. Add retry/error branches and idempotency keys before using these examples for high-volume production automation.