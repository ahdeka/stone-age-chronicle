// 장 목록. 장 추가 = chapters/<id>/ 폴더 + 여기 한 줄.

import type { ChapterDefinition } from '../engine';
import { ch1 } from './chapters/ch1/chapter';
import { ch1Ko } from './chapters/ch1/ko';
import { commonKo } from './common/ko';

export interface ChapterEntry {
  definition: ChapterDefinition;
  strings: { ko: Record<string, string> };
}

export const chapters: Record<string, ChapterEntry> = {
  ch1: { definition: ch1, strings: { ko: ch1Ko } },
};

export const commonStrings = { ko: commonKo };

export const DEFAULT_CHAPTER = 'ch1';

export function getChapter(id: string): ChapterEntry | undefined {
  return chapters[id];
}
