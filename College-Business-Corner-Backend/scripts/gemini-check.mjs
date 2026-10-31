// Quick sanity check for your Gemini key: node --env-file=.env scripts/gemini-check.mjs
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
console.log('Key present:', Boolean(process.env.GEMINI_API_KEY), '| model:', model);
try {
  const hello = await ai.models.generateContent({ model, contents: 'Reply with the single word: ready' });
  console.log('Basic call OK ->', hello.text);
} catch (err) {
  console.log('FAILED:', err?.status ?? '', String(err?.message ?? err).slice(0, 300));
}
