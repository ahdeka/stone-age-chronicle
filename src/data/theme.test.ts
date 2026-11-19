// 테마 명암비 검사 (DESIGN.md §16): 긴 본문 7:1(AAA), 나머지 글자 4.5:1(AA)

import { describe, expect, it } from 'vitest';
import { chapters } from './registry';

function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = ch.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const BACKGROUNDS = ['bg', 'surface', 'card'];
const LONG_TEXT = { tokens: ['text', 'text-muted'], min: 7 };
const SHORT_TEXT = { tokens: ['text-faint', 'accent', 'ochre', 'danger', 'good'], min: 4.5 };

describe('theme contrast', () => {
  for (const [id, entry] of Object.entries(chapters)) {
    const tokens = entry.definition.theme.tokens;
    it(`${id}: 긴 본문 색은 모든 배경에서 7:1 이상`, () => {
      for (const bg of BACKGROUNDS)
        for (const fg of LONG_TEXT.tokens)
          expect(contrast(tokens[fg]!, tokens[bg]!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(LONG_TEXT.min);
    });
    it(`${id}: 나머지 글자 색은 모든 배경에서 4.5:1 이상`, () => {
      for (const bg of BACKGROUNDS)
        for (const fg of SHORT_TEXT.tokens)
          expect(contrast(tokens[fg]!, tokens[bg]!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(SHORT_TEXT.min);
    });
  }
});
