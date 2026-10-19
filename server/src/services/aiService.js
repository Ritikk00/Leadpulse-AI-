import { env } from '../config/env.js';
import { parseAiResult } from '../utils/validation.js';

function extractBudget(requirement) {
  const match = String(requirement || '').match(/(?:₹|rs\.?|inr|\$|usd|€|eur|£|gbp)\s*\d[\d,]*(?:\.\d+)?\s*(?:lakhs?|lacs?|crores?|cr|k|m|million|billion)?|\b\d[\d,]*(?:\.\d+)?\s*(?:lakhs?|lacs?|crores?|cr|k|million|billion)\b/i);
  return match?.[0].trim() || 'Not Specified';
}

function fallbackQualification(lead) {
  const firstName = String(lead.name || 'there').trim().split(/\s+/)[0];
  const requirement = String(lead.requirement || '');
  const isHindi = /[\u0900-\u097f]/.test(requirement);
  const isHinglish = !isHindi && /\b(aap|hai|hain|chahiye|mujhe|ke liye|karna|kripya|namaste)\b/i.test(requirement);
  return {
    score: 50,
    priority: 'WARM',
    detectedBudget: extractBudget(requirement),
    summary: `AI qualification was unavailable. Review ${firstName}'s requirement and timeline manually.`,
    suggestedWhatsAppMessage: isHindi
      ? `नमस्ते ${firstName}, संपर्क करने के लिए धन्यवाद। हमें आपकी जानकारी मिल गई है। आपकी आवश्यकता पर चर्चा करने के लिए आपसे सुविधाजनक समय पर बात करना चाहेंगे।`
      : isHinglish
        ? `Namaste ${firstName}, sampark karne ke liye dhanyavaad. Humein aapki inquiry mil gayi hai. Aapki requirement par baat karne ke liye kaunsa samay convenient rahega?`
        : `Hello ${firstName}, thank you for reaching out. We received your inquiry and would be happy to learn more about your requirements. When would be a convenient time to connect?`
  };
}

export async function analyzeLead(lead) {
  try {
    if (!env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not configured.');
    const response = await fetch(`${env.GROQ_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.GROQ_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Qualify business inquiries across any industry using only the supplied name, phone, requirement, and timeline. Internally identify the inquiry category, intent, and urgency, and reflect those in the summary without adding output fields. Extract any budget explicitly mentioned in the requirement exactly and concisely; if none is stated, use "Not Specified". Score 0-100 based on clarity and urgency. Priority must be HOT for scores >=75, WARM for scores 45-74, and COLD for scores <45. Write a brief, useful summary. Detect whether the lead writes in English, Hindi (Devanagari), or Hinglish (Hindi in Latin script), then draft a polite, context-aware WhatsApp follow-up in that same language, addressed to the lead by name; never invent facts. For healthcare or other regulated inquiries, only acknowledge the request and offer to connect with the appropriate professional; do not provide medical, legal, or financial advice. Return only a JSON object with score (integer), priority ("HOT", "WARM", or "COLD"), detectedBudget (string), summary (string), and suggestedWhatsAppMessage (string).'
          },
          { role: 'user', content: JSON.stringify({ name: lead.name, phone: lead.phone, requirement: lead.requirement, timeline: lead.timeline }) }
        ]
      }),
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error(`Groq API returned ${response.status} ${response.statusText}.`);
    const body = await response.json();
    const content = body.choices?.[0]?.message?.content;
    const result = parseAiResult(JSON.parse(content));
    result.priority = result.score >= 75 ? 'HOT' : result.score >= 45 ? 'WARM' : 'COLD';
    if (result.detectedBudget === 'Not Specified') result.detectedBudget = extractBudget(lead.requirement);
    return result;
  } catch (error) {
    console.error('Groq lead qualification failed; using fallback:', error instanceof Error ? error.message : String(error));
    return fallbackQualification(lead);
  }
}
