import { describe, expect, it } from 'vitest';
import { formatToman } from './format.js';

describe('formatToman', () => {
  it('does not misrepresent an unknown legacy amount as zero', () => {
    expect(formatToman(null)).toBe('مبلغ نامشخص');
    expect(formatToman(undefined)).toBe('مبلغ نامشخص');
  });

  it('formats known amounts including an actual zero', () => {
    expect(formatToman(0)).toContain('تومان');
    expect(formatToman(250000)).toContain('تومان');
  });
});
