// 발전 칸 조회 (상태를 바꾸지 않는다). 조건 평가기도 쓰므로 타입과 찾기 외에는 가져오지 않는다.

import type { ChapterDefinition, GameState, Id, TechCellDef, TechCellState } from '../types';
import { byId } from '../core/lookup';

export const EPS = 1e-9;

export const findCell = (def: ChapterDefinition, id: Id): TechCellDef => byId(def.tech.cells, id, 'tech cell');

export function freshCell(): TechCellState {
  return { status: 'locked', progress: 0, gifted: 0, log: [] };
}

/** 칸 상태 (없으면 아직 만들지 않은 새 칸으로 본다) */
export function peekCell(state: GameState, id: Id): TechCellState {
  return state.tech[id] ?? freshCell();
}

export function isBranchEnd(cell: TechCellDef): boolean {
  return 'branchDone' in cell.requires;
}

export const isCellDone = (state: GameState, id: Id) => state.tech[id]?.status === 'done';

/** 이 갈래에서 지금 고를 칸: 열린 칸(진행 중 포함) 중 진척이 가장 많은 칸, 같으면 앞 칸 (§B4.2) */
export function nextCell(def: ChapterDefinition, state: GameState, branch: Id): Id | undefined {
  let best: TechCellDef | undefined;
  for (const cell of def.tech.cells) {
    if (cell.branch !== branch) continue;
    const c = peekCell(state, cell.id);
    if (c.status !== 'open' && c.status !== 'active') continue;
    const bp = best ? peekCell(state, best.id).progress : -1;
    if (!best || c.progress > bp + EPS || (Math.abs(c.progress - bp) <= EPS && cell.order < best.order)) best = cell;
  }
  return best?.id;
}

/** 끝 칸이 켜진 갈래 */
export function branchesDone(def: ChapterDefinition, state: GameState): Id[] {
  return def.tech.branches.filter((b) => def.tech.cells.some((c) => c.branch === b && isBranchEnd(c) && isCellDone(state, c.id)));
}
