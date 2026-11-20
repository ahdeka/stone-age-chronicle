// 저장/불러오기. 엔진은 문자열만 다룬다 — localStorage와 파일은 UI 계층의 일이다.

import type { GameState } from '../types';
import { SAVE_VERSION } from './version';

export const SAVE_FORMAT = 'stone-age-chronicle-save';
/** 재설계 이후의 세이브 구분자. 이전 설계(카드 방식)의 세이브를 확실히 거부하기 위해 둔다 */
export const SAVE_GENERATION = 'monthly';

export interface SaveFile {
  format: typeof SAVE_FORMAT;
  generation: typeof SAVE_GENERATION;
  saveVersion: number;
  chapterId: string;
  /** UI가 넣는 저장 시각 (엔진은 시계를 읽지 않는다) */
  savedAt: string | null;
  state: GameState;
}

/** n → n+1 변환. 예: migrations[1] = v1 상태를 v2로 바꾸는 함수 */
type Migration = (state: Record<string, unknown>) => Record<string, unknown>;
export const migrations: Record<number, Migration> = {};

export function serialize(state: GameState, savedAt: string | null = null): string {
  const file: SaveFile = {
    format: SAVE_FORMAT,
    generation: SAVE_GENERATION,
    saveVersion: state.saveVersion,
    chapterId: state.chapterId,
    savedAt,
    state,
  };
  return JSON.stringify(file);
}

export type LoadResult = { ok: true; state: GameState; savedAt: string | null } | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function deserialize(json: string): LoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'error.save.notJson' };
  }
  if (!isRecord(raw) || raw.format !== SAVE_FORMAT) return { ok: false, error: 'error.save.format' };
  if (raw.generation !== SAVE_GENERATION) return { ok: false, error: 'error.save.oldDesign' };
  if (typeof raw.saveVersion !== 'number' || !isRecord(raw.state)) return { ok: false, error: 'error.save.format' };
  if (raw.saveVersion > SAVE_VERSION) return { ok: false, error: 'error.save.newer' };

  let state = raw.state;
  for (let v = raw.saveVersion; v < SAVE_VERSION; v++) {
    const m = migrations[v];
    if (!m) return { ok: false, error: 'error.save.noMigration' };
    state = m(state);
    state.saveVersion = v + 1;
  }

  // 최소 구조 확인 — 깨진 파일이 엔진 깊숙이 들어가지 않게
  const required = ['chapterId', 'seed', 'rng', 'month', 'step', 'people', 'stores', 'work', 'places', 'animals'];
  for (const k of required) if (!(k in state)) return { ok: false, error: 'error.save.corrupt' };
  if (!Array.isArray(state.rng) || state.rng.length !== 4) return { ok: false, error: 'error.save.corrupt' };

  return { ok: true, state: state as unknown as GameState, savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : null };
}
