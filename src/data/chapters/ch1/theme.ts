// 1장 테마: 밤의 모닥불 (DESIGN.md §16). 명암비는 theme.test.ts가 검사한다.

import type { ThemeDef } from '../../../engine';

export const ch1Theme: ThemeDef = {
  id: 'ember_night',
  motif: 'cave_lines',
  tokens: {
    bg: '#16130F',
    surface: '#221D17',
    card: '#2B241C',
    text: '#ECE2CF',
    'text-muted': '#BFAF94',
    'text-faint': '#9A8B74',
    accent: '#F0A050',
    ochre: '#C98A4B',
    danger: '#E9785F',
    good: '#9DC08B',
  },
};
