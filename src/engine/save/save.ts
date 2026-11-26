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
export const migrations: Record<number, Migration> = {
  /** v1 → v2: 새 필드를 기본값으로 채운다. 월초 보고와 조언은 다음 달부터 생긴다 */
  1: (st) => {
    const shelter = (st['shelter'] ?? {}) as Record<string, unknown>;
    const work = (st['work'] ?? {}) as Record<string, unknown>;
    const fixReport = (r: Record<string, unknown>) => ({ rows: [], alerts: [], from: { food: 0, firewood: 0 }, ...r });
    const reports = Array.isArray(work['reports']) ? (work['reports'] as Record<string, unknown>[]).map(fixReport) : [];
    const history = Array.isArray(st['history'])
      ? (st['history'] as Record<string, unknown>[]).map((h) => ({
          ...h,
          reports: Array.isArray(h['reports']) ? (h['reports'] as Record<string, unknown>[]).map(fixReport) : [],
        }))
      : [];
    return {
      ...st,
      shelter: { units: 1, ...shelter },
      work: { advice: [], maxHunger: 0, ...work, reports },
      history,
    };
  },
  /** v2 → v3: 부족 이름. 이전 세이브는 빈 문자열(= 프리셋의 기본 이름)로 둔다 */
  2: (st) => ({ tribeName: '', ...st }),
  /** v3 → v4: 전략 두 칸. 고른 방침 하나는 주 전략(식량 칸)으로 옮긴다. 칸은 방침 정의에서 다시 읽으므로 정확하지 않아도 된다.
   *  1장의 장작 덧집은 깃발(wood_shed)이었다 → 시설로 */
  3: (st) => {
    const work = (st['work'] ?? {}) as Record<string, unknown>;
    const { chosen, place, ...rest } = work;
    const plan = chosen ? [{ slot: 'food', bound: chosen, ...(place ? { place } : {}), haul: Array.isArray(work['haul']) ? work['haul'] : [] }] : [];
    const flags = (st['flags'] ?? {}) as Record<string, unknown>;
    const history = Array.isArray(st['history'])
      ? (st['history'] as Record<string, unknown>[]).map(({ policyId, ...h }) => ({ ...h, policyIds: policyId ? [policyId] : [] }))
      : [];
    return {
      ...st,
      facilities: flags['wood_shed'] !== undefined ? { wood_shed: 1 } : {},
      projects: {},
      history,
      work: { ...rest, plan, planIndex: 0, savings: [], haul: chosen ? [] : (work['haul'] ?? []) },
    };
  },
  /** v4 → v5: 월초 지표를 더 남긴다. 이전 세이브는 모르는 값을 지금 값으로 채운다(그 달의 증감은 0으로 보인다) */
  4: (st) => {
    const work = (st['work'] ?? {}) as Record<string, unknown>;
    const start = (work['start'] ?? {}) as Record<string, unknown>;
    const people = Object.values((st['people'] ?? {}) as Record<string, { alive?: boolean; ailments?: unknown[] }>).filter((p) => p.alive);
    const ailing = people.filter((p) => (p.ailments ?? []).length > 0).length;
    return {
      ...st,
      work: {
        ...work,
        start: {
          food: 0,
          firewood: 0,
          population: people.length,
          foodDays: 0,
          cohesion: typeof st['cohesion'] === 'number' ? st['cohesion'] : 0,
          workers: 0,
          sick: ailing,
          injured: 0,
          ...start,
        },
      },
    };
  },
  /** v5 → v6: 턴. v5 세이브는 모두 1년차(달 턴)라 턴 번호 = 달. 칸·줄기 상태는 비워 둔다(칸은 장 정의에서 계산한다).
   *  짓다 만 공사(projects)는 그대로 둔다 — 칸 진척으로 바꾸는 것은 발전 나무(R1-b)가 맡는다 */
  5: (st) => {
    const month = typeof st['month'] === 'number' ? st['month'] : 1;
    const work = (st['work'] ?? {}) as Record<string, unknown>;
    const history = Array.isArray(st['history'])
      ? (st['history'] as Record<string, unknown>[]).map((h) => ({ turn: h['month'], kind: 'month', firstMonth: h['month'], ...h }))
      : [];
    return {
      tech: {},
      arcs: {},
      ...st,
      turn: month,
      history,
      work: { turn: { kind: 'month', months: 1, stage: 0, firstMonth: month }, ...work },
    };
  },
};

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
