import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLeadIntent } from './intentDetection.js';

describe('intentDetection', () => {
  describe('analyzeLeadIntent safe fallbacks', () => {
    it('returns default fallback when body is empty string', async () => {
      const result = await analyzeLeadIntent('');
      assert.deepEqual(result, { intent: 'General Inquiry', score: 0.5 });
    });

    it('returns fallback without errors or external calls when body is null/falsy cast', async () => {
      const result = await analyzeLeadIntent(null as unknown as string);
      assert.deepEqual(result, { intent: 'General Inquiry', score: 0.5 });
    });

    it('returns default fallback safely when API key is missing even with non-empty body', async () => {
      const origGemini = process.env.GEMINI_API_KEY;
      const origViteGemini = process.env.VITE_GEMINI_API_KEY;
      try {
        delete process.env.GEMINI_API_KEY;
        delete process.env.VITE_GEMINI_API_KEY;
        const result = await analyzeLeadIntent('I would like to book a meeting tomorrow at 3pm');
        assert.deepEqual(result, { intent: 'General Inquiry', score: 0.5 });
      } finally {
        if (origGemini !== undefined) {
          process.env.GEMINI_API_KEY = origGemini;
        } else {
          delete process.env.GEMINI_API_KEY;
        }
        if (origViteGemini !== undefined) {
          process.env.VITE_GEMINI_API_KEY = origViteGemini;
        } else {
          delete process.env.VITE_GEMINI_API_KEY;
        }
      }
    });
  });
});
