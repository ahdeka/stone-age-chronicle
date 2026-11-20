// 결말 판정: 우선순위가 높은 것부터, 조건을 모두 만족하는 첫 결말 (DESIGN.md §13)

import type { ChapterDefinition, EndingDef, GameState } from '../types';
import { allTrue } from '../conditions/evaluate';

export function checkEndings(def: ChapterDefinition, state: GameState): EndingDef | undefined {
  const sorted = def.content.endings.slice().sort((a, b) => b.priority - a.priority);
  return sorted.find((e) => allTrue(def, state, e.check));
}
