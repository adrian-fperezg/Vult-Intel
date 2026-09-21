import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, cleanCompany } from './dataSanitizer.js';

describe('dataSanitizer', () => {
  describe('cleanName', () => {
    it('returns null for null, undefined, or empty/whitespace strings', () => {
      assert.equal(cleanName(null), null);
      assert.equal(cleanName(undefined), null);
      assert.equal(cleanName(''), null);
      assert.equal(cleanName('   '), null);
    });

    it('converts uppercase and lowercase names to title case', () => {
      assert.equal(cleanName('ADRIAN'), 'Adrian');
      assert.equal(cleanName('adrian perez'), 'Adrian Perez');
      assert.equal(cleanName('JOHN DOE'), 'John Doe');
    });

    it('handles hyphenated names and trimmed edge cases', () => {
      assert.equal(cleanName('jean-luc'), 'Jean-Luc');
      assert.equal(cleanName('  mary-jane watson  '), 'Mary-Jane Watson');
    });
  });

  describe('cleanCompany', () => {
    it('returns null for null, undefined, or empty/whitespace strings', () => {
      assert.equal(cleanCompany(null), null);
      assert.equal(cleanCompany(undefined), null);
      assert.equal(cleanCompany(''), null);
      assert.equal(cleanCompany('   '), null);
    });

    it('removes common legal suffixes at the end of company names', () => {
      assert.equal(cleanCompany('Acme Inc.'), 'Acme');
      assert.equal(cleanCompany('Vult Intel LLC'), 'Vult Intel');
      assert.equal(cleanCompany('Tech Corp.'), 'Tech');
      assert.equal(cleanCompany('Global Ltd.'), 'Global');
      assert.equal(cleanCompany('Enterprise GmbH'), 'Enterprise');
      assert.equal(cleanCompany('Innovate S.A.'), 'Innovate');
      assert.equal(cleanCompany('Solutions Co.'), 'Solutions');
    });

    it('preserves company name when suffix is the only word', () => {
      assert.equal(cleanCompany('Inc.'), 'Inc.');
      assert.equal(cleanCompany('LLC'), 'LLC');
    });

    it('does not remove suffixes embedded within words', () => {
      assert.equal(cleanCompany('Include Health'), 'Include Health');
    });
  });
});
