# AI Setup

AI qualification runs on the server through Groq's OpenAI-compatible Chat Completions API. Set:

```env
GROQ_API_KEY=your-groq-api-key
```

The server uses `llama-3.3-70b-versatile` and `response_format: { type: "json_object" }`. Keep the key in `server/.env` locally and a server-side secret manager in production. Never prefix it with `VITE_` or include it in client code. The legacy `OPENAI_API_KEY` variable is accepted as a migration fallback.

Public inquiry forms submit `{ name, phone, email, requirement, timeline }` to `POST /api/leads/inquire`. The AI extracts a budget from the free-text requirement, scores clarity and urgency, assigns HOT/WARM/COLD priority, summarizes intent/category/urgency, and drafts a personalized WhatsApp message. The response fields are score, priority, detectedBudget, summary, and suggestedWhatsAppMessage; Zod validates them before persistence.

AI output is advisory, may be wrong, and should be reviewed by a person. Do not put sensitive or regulated data into lead requirements. Follow Groq's data retention and processing terms.

If the provider is unavailable, inquiry creation still succeeds with a WARM/50 fallback qualification and generic personalized WhatsApp greeting. Provider requests time out after 30 seconds.