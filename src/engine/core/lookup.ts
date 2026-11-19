import type { ChapterDefinition, RegionDef } from '../types';

export function findRegion(def: ChapterDefinition, id: string): RegionDef | undefined {
  return def.content.regions.find((r) => r.id === id);
}

export function resourceRange(def: ChapterDefinition, key: string): { min: number; max: number } {
  const r = def.resources.find((x) => x.id === key);
  if (!r) throw new Error(`unknown resource: ${key}`);
  return { min: r.min, max: r.max ?? Number.POSITIVE_INFINITY };
}

export function axisRange(def: ChapterDefinition, id: string): { min: number; max: number } {
  const a = def.axes.find((x) => x.id === id);
  if (!a) throw new Error(`unknown axis: ${id}`);
  return { min: a.min, max: a.max };
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** 부동소수 오차가 저장 파일에 쌓이지 않도록 소수 넷째 자리에서 자른다 */
export function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
