import test from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../src/config/env.js';
import { analyzeLead } from '../src/services/aiService.js';

const lead = { name: 'Taylor Reed', phone: '1234567890', requirement: 'A clinic appointment platform with a budget of ₹60 Lakhs', timeline: 'Within 15 - 30 Days' };

test('AI analysis returns a usable fallback when the provider key is missing', async () => {
  const originalKey = env.GROQ_API_KEY;
  const originalConsoleError = console.error;
  env.GROQ_API_KEY = '';
  console.error = () => {};
  try {
    const result = await analyzeLead(lead);
    assert.equal(result.score, 50);
    assert.equal(result.priority, 'WARM');
    assert.equal(result.detectedBudget, '₹60 Lakhs');
    assert.match(result.suggestedWhatsAppMessage, /Taylor/);
  } finally {
    env.GROQ_API_KEY = originalKey;
    console.error = originalConsoleError;
  }
});

test('AI fallback preserves Hindi language and extracts a mentioned budget', async () => {
  const originalKey = env.GROQ_API_KEY;
  const originalConsoleError = console.error;
  env.GROQ_API_KEY = '';
  console.error = () => {};
  try {
    const result = await analyzeLead({ ...lead, requirement: 'मुझे ₹60 Lakhs के बजट में घर चाहिए' });
    assert.equal(result.detectedBudget, '₹60 Lakhs');
    assert.match(result.suggestedWhatsAppMessage, /नमस्ते/);
  } finally {
    env.GROQ_API_KEY = originalKey;
    console.error = originalConsoleError;
  }
});

test('AI provider failures are logged and return a usable fallback', async () => {
  const originalKey = env.GROQ_API_KEY;
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const logged = [];
  env.GROQ_API_KEY = 'test-provider-key';
  globalThis.fetch = async () => new Response('provider unavailable', { status: 429 });
  console.error = (...args) => logged.push(args);
  try {
    const result = await analyzeLead(lead);
    assert.equal(result.priority, 'WARM');
    assert.match(logged[0][0], /Groq lead qualification failed/);
  } finally {
    env.GROQ_API_KEY = originalKey;
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

test('AI request uses Groq JSON mode and the universal lead fields', async () => {
  const originalKey = env.GROQ_API_KEY;
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestBody;
  const result = { score: 82, priority: 'COLD', detectedBudget: '₹60 Lakhs', summary: 'Clinic appointment platform inquiry, within 15 - 30 Days.', suggestedWhatsAppMessage: 'Hello Taylor, thank you for your inquiry.' };
  env.GROQ_API_KEY = 'test-provider-key';
  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) } }] }), { status: 200 });
  };
  try {
    const qualified = await analyzeLead(lead);
    assert.equal(requestUrl, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(requestBody.model, 'llama-3.3-70b-versatile');
    assert.deepEqual(requestBody.response_format, { type: 'json_object' });
    assert.deepEqual(JSON.parse(requestBody.messages[1].content), {
      name: lead.name,
      phone: lead.phone,
      requirement: lead.requirement,
      timeline: lead.timeline
    });
    assert.equal(qualified.priority, 'HOT');
    assert.equal(qualified.detectedBudget, '₹60 Lakhs');
  } finally {
    env.GROQ_API_KEY = originalKey;
    globalThis.fetch = originalFetch;
  }
});
