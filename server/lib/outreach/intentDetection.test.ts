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
  });
});
