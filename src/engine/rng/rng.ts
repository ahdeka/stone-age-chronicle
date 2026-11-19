// 시드 기반 난수 (sfc32). 상태는 GameState.rng에 4개의 uint32로 저장된다.
// Math.random 사용 금지 (architecture.test.ts가 검사한다).

import type { RngState } from '../types';

/** 문자열 시드 → 128비트 상태 (cyrb128 해시) */
export function seedToState(seed: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  const state: RngState = [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  // 초기 상관을 없애기 위해 몇 번 돌린다
  for (let i = 0; i < 15; i++) nextUint32(state);
  return state;
}

/** 상태를 제자리에서 갱신하고 uint32를 돌려준다 */
export function nextUint32(s: RngState): number {
  let [a, b, c, d] = s;
  a >>>= 0;
  b >>>= 0;
  c >>>= 0;
  d >>>= 0;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  s[0] = a >>> 0;
  s[1] = b >>> 0;
  s[2] = c >>> 0;
  s[3] = d >>> 0;
  return t >>> 0;
}

/** [0, 1) */
export function nextFloat(s: RngState): number {
  return nextUint32(s) / 4294967296;
}

/** [min, max] 정수 */
export function nextInt(s: RngState, min: number, max: number): number {
  return min + Math.floor(nextFloat(s) * (max - min + 1));
}

export function chance(s: RngState, p: number): boolean {
  if (p <= 0) return false;
  if (p >= 1) return true;
  return nextFloat(s) < p;
}

/** 가중치 선택. 가중치 합이 0 이하면 -1 */
export function weightedIndex(s: RngState, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += Math.max(0, w);
  if (total <= 0) return -1;
  let r = nextFloat(s) * total;
  for (let i = 0; i < weights.length; i++) {
    const w = Math.max(0, weights[i] ?? 0);
    if (r < w) return i;
    r -= w;
  }
  return weights.length - 1;
}

/** 새 배열을 돌려주는 Fisher-Yates 셔플 */
export function shuffled<T>(s: RngState, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextInt(s, 0, i);
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/** 미리보기 등 원본을 건드리면 안 되는 곳에서 쓰는 복제 */
export function cloneRng(s: RngState): RngState {
  return [s[0], s[1], s[2], s[3]];
}
