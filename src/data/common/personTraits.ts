// 공통 인물 특성 (DESIGN.md §7.4). 수치 효과와 선택지 해금은 M3에서 채운다.

import type { PersonTraitDef } from '../../engine';

export const personTraits: PersonTraitDef[] = [
  { id: 'brave', modifiers: [], opposites: ['cautious'] },
  { id: 'cautious', modifiers: [], opposites: ['brave'] },
  { id: 'gentle', modifiers: [], opposites: ['ambitious'] },
  { id: 'ambitious', modifiers: [], opposites: ['gentle'] },
  { id: 'stubborn', modifiers: [], opposites: ['pliable'] },
  { id: 'pliable', modifiers: [], opposites: ['stubborn'] },
  { id: 'herbalist', modifiers: [] },
  { id: 'storyteller', modifiers: [] },
  { id: 'crafty', modifiers: [] },
  { id: 'pathfinder', modifiers: [] },
  { id: 'dreamer', modifiers: [] },
  { id: 'silver_tongue', modifiers: [] },
  { id: 'fertile', modifiers: [] },
  { id: 'frail', modifiers: [] },
  { id: 'seasoned', modifiers: [] },
];
