// 식량 묶음: 더하기, 먹기, 부패, 무게 (DESIGN.md §3.3)

import type { ChapterDefinition, FoodLot, TempClass } from '../types';
import { findFoodKind } from '../core/lookup';

export const EPS = 1e-6;

export function totalKg(lots: readonly FoodLot[]): number {
  return lots.reduce((a, l) => a + l.kg, 0);
}

export function addLot(lots: FoodLot[], kind: string, kg: number): void {
  if (kg <= 0) return;
  const same = lots.find((l) => l.kind === kind);
  if (same) same.kg += kg;
  else lots.push({ kind, kg });
}

export function prune(lots: FoodLot[]): void {
  for (let i = lots.length - 1; i >= 0; i--) if ((lots[i]?.kg ?? 0) <= EPS) lots.splice(i, 1);
}

/** 상하기 쉬운 것부터 먹는다. 실제로 먹은 양을 돌려준다 */
export function eat(def: ChapterDefinition, lots: FoodLot[], kg: number, temp: TempClass): number {
  const order = lots.slice().sort((a, b) => findFoodKind(def, b.kind).spoil[temp] - findFoodKind(def, a.kind).spoil[temp]);
  let left = kg;
  for (const lot of order) {
    if (left <= EPS) break;
    const take = Math.min(lot.kg, left);
    lot.kg -= take;
    left -= take;
  }
  prune(lots);
  return kg - Math.max(0, left);
}

/** 한 순의 부패. 상한 양을 돌려준다 */
export function spoil(def: ChapterDefinition, lots: FoodLot[], temp: TempClass, mul = 1): number {
  let lost = 0;
  for (const lot of lots) {
    const r = Math.min(1, findFoodKind(def, lot.kind).spoil[temp] * mul);
    const l = lot.kg * r;
    lot.kg -= l;
    lost += l;
  }
  prune(lots);
  return lost;
}

/** 나를 때의 무게 */
export function carryWeight(def: ChapterDefinition, lot: FoodLot): number {
  return lot.kg * findFoodKind(def, lot.kind).carryFactor;
}

/** 일정 비율만큼 덜어 낸다 (짐승 습격 등). 잃은 양을 돌려준다 */
export function takeFraction(lots: FoodLot[], fraction: number): number {
  let lost = 0;
  for (const lot of lots) {
    const l = lot.kg * Math.min(1, Math.max(0, fraction));
    lot.kg -= l;
    lost += l;
  }
  prune(lots);
  return lost;
}
