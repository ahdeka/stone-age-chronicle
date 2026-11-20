// 테마 명암비 검사: 긴 본문 7:1(AAA), 짧은 글자와 배지 4.5:1(AA). 화면 시안의 토큰을 그대로 검사한다.

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

const BACKGROUNDS = ['bg', 'bg-deep', 'surface', 'inset', 'sheet'];
/** 서술, 대사, 소개 문단처럼 긴 글 */
const LONG_TEXT = ['text', 'prose', 'prose-strong', 'quote', 'text-muted'];
/** 짧은 정보 (흐린 글자는 짧은 정보에만 쓴다) */
const SHORT_TEXT = ['text-faint', 'accent', 'warn-text', 'up', 'down', 'icon', 'text-past'];
/** 글자색 / 배경색 짝 */
const PAIRS: [string, string][] = [
  ['risk-sure', 'risk-sure-bg'],
  ['risk-fair', 'risk-fair-bg'],
  ['risk-risky', 'risk-risky-bg'],
  ['risk-unknown', 'risk-unknown-bg'],
  ['warn-soft', 'warn-bg'],
  ['warn-text', 'warn-bg'],
  ['alert-text', 'alert-bg'],
  ['accent-ink', 'accent'],
  ['text-disabled', 'raised'],
  ['text', 'raised'],
];

describe('theme contrast', () => {
  for (const [id, entry] of Object.entries(chapters)) {
    const tokens = entry.definition.theme.tokens;
    const tok = (k: string) => {
      const v = tokens[k];
      if (!v) throw new Error(`${id}: 토큰 없음 ${k}`);
      return v;
    };
    it(`${id}: 긴 글은 모든 배경에서 7:1 이상`, () => {
      for (const bg of BACKGROUNDS) for (const fg of LONG_TEXT) expect(contrast(tok(fg), tok(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(7);
    });
    it(`${id}: 짧은 글자는 모든 배경에서 4.5:1 이상`, () => {
      for (const bg of BACKGROUNDS) for (const fg of SHORT_TEXT) expect(contrast(tok(fg), tok(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    });
    it(`${id}: 배지·경고·버튼 짝은 4.5:1 이상`, () => {
      for (const [fg, bg] of PAIRS) expect(contrast(tok(fg), tok(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    });
  }
});
