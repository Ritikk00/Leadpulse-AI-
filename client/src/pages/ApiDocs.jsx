import { useState } from 'react';
import { Check, Copy, ExternalLink, KeyRound, Webhook } from 'lucide-react';
import { PageHeader } from '../components/ui';

const endpoints = [
  { method: 'POST', path: '/api/webhooks/leads', purpose: 'Create a lead and trigger configured email notifications.', body: '{ "name": "Jordan Lee", "phone": "1234567890", "email": "jordan@example.com", "requirement": "Need a new company website", "timeline": "Immediate (Ready now)" }' },
  { method: 'POST', path: '/api/webhooks/lead-status', purpose: 'Update pipeline status and record the change in activity.', body: '{ "leadId": "<24-character-lead-id>", "status": "QUALIFIED" }' },
  { method: 'POST', path: '/api/webhooks/follow-up', purpose: 'Send a follow-up email and record delivery in activity.', body: '{ "leadId": "<24-character-lead-id>", "message": "Thanks for your time. Here are the next steps…" }' },
  { method: 'POST', path: '/api/webhooks/lead-analyze', purpose: 'Run AI qualification for an existing lead.', body: '{ "leadId": "<24-character-lead-id>" }' },
  { method: 'POST', path: '/api/leads/inquire', purpose: 'Create and qualify a universal industry-agnostic inquiry.', body: '{ "name": "Jordan Lee", "phone": "1234567890", "email": "jordan@example.com", "requirement": "Looking for an appointment platform, budget around ₹60 Lakhs", "timeline": "Within 15 - 30 Days" }' }
];

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return <button className="icon-button copy-button" title="Copy example" aria-label="Copy example" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>;
}

export function ApiDocs() {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:4000/api';
  return <>
    <PageHeader eyebrow="BUILD ON THE STARTER" title="API & webhooks" description="Connect forms, automations, and internal tools to the lead pipeline." />
    <div className="docs-layout">
      <section className="panel docs-main"><div className="docs-intro"><span className="docs-icon"><Webhook size={18} /></span><div><h2>Webhook endpoints</h2><p>Each request uses JSON and an <code>x-webhook-secret</code> header. Set the same value as <code>WEBHOOK_SECRET</code> in the server environment.</p></div></div>
        <div className="base-url"><span>API BASE URL</span><code>{baseUrl}</code><CopyButton value={baseUrl} /></div>
        <div className="endpoint-list">{endpoints.map((endpoint) => <article className="endpoint" key={endpoint.path}><div className="endpoint-top"><span className="method-post">{endpoint.method}</span><code>{endpoint.path}</code></div><p>{endpoint.purpose}</p><div className="code-block"><pre><code>{`curl -X POST "${baseUrl}${endpoint.path.replace('/api', '')}" \\\n  -H "Content-Type: application/json" \\\n  -H "x-webhook-secret: $WEBHOOK_SECRET" \\\n  -d '${endpoint.body}'`}</code></pre><CopyButton value={`curl -X POST "${baseUrl}${endpoint.path.replace('/api', '')}" -H "Content-Type: application/json" -H "x-webhook-secret: $WEBHOOK_SECRET" -d '${endpoint.body}'`} /></div></article>)}</div>
      </section>
      <aside className="docs-aside"><div className="docs-note"><span className="aside-icon"><KeyRound size={16} /></span><h3>Keep the secret private</h3><p>Never place the webhook secret in browser code. Store it in n8n credentials or environment variables and send it as a request header.</p></div><div className="docs-note"><span className="aside-icon"><ExternalLink size={16} /></span><h3>n8n workflow files</h3><p>Import the examples from <code>/n8n-workflows</code>, then update API base URLs and credentials in each HTTP Request node.</p><a href="https://docs.n8n.io/workflows/" target="_blank" rel="noreferrer">n8n workflow guide <ExternalLink size={13} /></a></div><div className="docs-note"><span className="aside-icon"><Webhook size={16} /></span><h3>Public inquiry form</h3><p><code>POST /api/leads/inquire</code> accepts name, phone, optional email, free-text requirement, and timeline. It is rate limited and does not require a webhook secret.</p></div></aside>
    </div>
  </>;
}