// 발전 나무 화면용 보기 (R2-b-2, 시안 docs/design/r2/tree.html). 상태를 바꾸지 않는다. 글은 만들지 않고 구조만 돌려준다.
// 칸 12개 = 엔진 칸(def.tech.cells) + 준비 중 칸(def.tech.planned, 늘 잠김).

import type { CellStatus, ChapterDefinition, GameState, Id, PersonQuery, TechCellState, TechLogEntry, TechUnlock } from '../types';
import { findPolicy, monthDef } from '../core/lookup';
import { matchPerson } from '../conditions/evaluate';
import { living } from '../people/people';
import { crewSpecFor, yearOneAllows } from '../policy/candidates';
import { totalKg } from '../stores/food';
import { canStartCell, cellPolicyId, continuingCell } from './tech';
import { EPS, isBranchEnd, nextCell, peekCell } from './query';

/** 숨은 까닭: 열린 칸인데 이번 턴 전략 카드에 없다 */
export type HiddenReason =
  /** 같은 갈래의 다른 칸이 먼저 나온다 (진척이 더 많거나 앞 칸, §B4.2) */
  | { kind: 'behind'; cell: Id }
  /** 1년차엔 한 번에 칸 하나 (§B3.6) */
  | { kind: 'yearOne' }
  /** 시작 비용을 낼 수 없다 */
  | { kind: 'cost' }
  /** 시작할 수 있는 철이 아니다 */
  | { kind: 'season' }
  /** 맡을 사람이 없거나 그 밖 */
  | { kind: 'other' };

/** 잠긴 까닭 */
export type LockReason =
  /** 앞 칸이 켜지면 열림 */
  | { kind: 'prev'; cell: Id }
  /** 갈래 끝: 진척이 가장 많은 앞 칸이 먼저 켜져야 함 (앞 칸이 모두 0%면 cell 없이 갈래 이름) */
  | { kind: 'branch'; branch: Id; cell?: Id }
  /** 칸이 따로 쓴 조건 글 (tech.<id>.need) */
  | { kind: 'custom'; cell: Id }
  /** 준비 중 칸 (R4) */
  | { kind: 'planned' };

export type OpenKind = 'food' | 'major' | 'growth' | 'event' | 'option';

/** 칸이 여는 것 하나: 종류와 이름 (문자열 키 + 변수 없이 쓴다) */
export interface OpenView {
  kind: OpenKind;
  /** 이름 문자열 키 (policy.<id>.name, event.<id>.title, event.<e>.opt.<o>, tech.<id>.open.<n>) */
  name: string;
}

export interface CellView {
  id: Id;
  branch: Id;
  order: number;
  /** 준비 중 칸 (엔진 효과 없음, 늘 잠김) */
  planned: boolean;
  isEnd: boolean;
  status: CellStatus;
  /** 철 단위 */
  seasons: number;
  progress: number;
  /** 부족이 한 몫 (일·겨울·저절로) = progress − gifted */
  worked: number;
  /** 사람·이웃이 준 몫 */
  gifted: number;
  /** 이어 가던 칸 (§B4.4) */
  continuing: boolean;
  /** 이번 턴 전략 카드에 나온다 */
  inPlan: boolean;
  hidden?: HiddenReason;
  lock?: LockReason;
  /** 무리: 이번 턴 종류의 인원(1년차 절반), 맡을 사람과 대신할 사람 (살아 있는 사람 id) */
  crew?: { n: number; person?: Id; fallback?: Id };
  cost?: { goods?: Record<Id, number>; firewoodKg?: number; foodKg?: number };
  costPaid: boolean;
  /** 시작 비용이 모자라면 모자란 양 (전략 팝업의 흐린 카드 "가죽 1장 모자람") */
  shortage?: { goods?: Record<Id, number>; firewoodKg?: number; foodKg?: number };
  opens: OpenView[];
  /** 켜진 달 (실제 달 번호) */
  doneMonth?: number;
  log: TechLogEntry[];
  /** 선물을 준 사람 id (마지막 선물) */
  giftBy?: Id;
}

export interface TechView {
  branches: Id[];
  /** 갈래 순서 → 칸 order 순서 */
  cells: CellView[];
  done: number;
  total: number;
  /** 끝 칸이 켜진 갈래 수 / 신석기에 필요한 수 */
  endsDone: number;
  endsNeed: number;
  continuing?: Id;
  /** 턴 종류: 눈금 단위(달 = 1/3철, 철 = 1) */
  turnKind: 'month' | 'season';
  /** 이번 턴 한 번의 진척 (철) */
  rate: number;
  /** 이어 가던 칸이 이번 턴에 저절로 찰 몫 (철): 다른 발전이나 큰 일을 고르면. 이어 가던 칸이 없으면 0 */
  driftAmount: number;
}

function personFor(def: ChapterDefinition, state: GameState, q: PersonQuery | undefined): Id | undefined {
  if (!q) return undefined;
  // 지금 아프거나 다쳤어도 "맡을 사람"으로 보인다 (ailing 조건은 빼고 자리로 찾는다)
  const { ailing: _a, ...rest } = q as PersonQuery & { ailing?: boolean };
  return living(state).find((p) => matchPerson(def, state, p, rest as PersonQuery))?.id;
}

function opensOf(def: ChapterDefinition, unlocks: readonly TechUnlock[]): OpenView[] {
  return unlocks.map((u) => {
    if (u.kind === 'policy') {
      const slot = def.content.policies.find((p) => p.id === u.id)?.slot ?? 'food';
      return { kind: slot === 'major' ? 'major' : slot === 'growth' ? 'growth' : 'food', name: `policy.${u.id}.name` };
    }
    if (u.kind === 'event') return { kind: 'event', name: `event.${u.id}.title` };
    return { kind: 'option', name: `event.${u.event}.opt.${u.option}` };
  });
}

function lockOf(def: ChapterDefinition, state: GameState, id: Id, hasNeedText: (id: Id) => boolean): LockReason | undefined {
  const cell = def.tech.cells.find((c) => c.id === id)!;
  if (hasNeedText(id)) return { kind: 'custom', cell: id };
  const r = cell.requires;
  if ('all' in r) {
    const first = r.all.find((x) => peekCell(state, x).status !== 'done');
    return first ? { kind: 'prev', cell: first } : undefined;
  }
  if ('any' in r) return r.any[0] ? { kind: 'prev', cell: r.any[0] } : undefined;
  // 갈래 끝: 같은 갈래 앞 칸 중 진척이 가장 많은 칸 (같으면 앞 칸), 모두 0%면 갈래 이름 (§B4.4 읽는 법)
  let best: { id: Id; p: number; order: number } | undefined;
  for (const c of def.tech.cells) {
    if (c.branch !== cell.branch || c.id === id) continue;
    const p = peekCell(state, c.id).progress / c.seasons;
    if (p <= EPS) continue;
    if (!best || p > best.p + EPS || (Math.abs(p - best.p) <= EPS && c.order < best.order)) best = { id: c.id, p, order: c.order };
  }
  return best ? { kind: 'branch', branch: cell.branch, cell: best.id } : { kind: 'branch', branch: cell.branch };
}

/** 열린 칸이 이번 턴 카드에 없는 까닭 */
/** 열린 칸이 이번 턴 카드에 없는 까닭. 1년차는 "한 번에 칸 하나"가 비용보다 먼저다 (그 칸이 자리에 올 칸일 때만 비용 까닭) */
function hiddenOf(def: ChapterDefinition, state: GameState, id: Id, branch: Id, otherCellInPlan: boolean): HiddenReason {
  const next = nextCell(def, state, branch);
  if (next && next !== id) return { kind: 'behind', cell: next };
  if (state.work.turn.kind === 'month' && (otherCellInPlan || !yearOneAllows(def, state, id))) return { kind: 'yearOne' };
  if (!canStartCell(def, state, id)) {
    const cell = def.tech.cells.find((c) => c.id === id)!;
    const c = peekCell(state, id);
    return cell.startSeasons && c.progress <= EPS && !cell.startSeasons.includes(monthDef(def, state).season) ? { kind: 'season' } : { kind: 'cost' };
  }
  if (state.work.turn.kind === 'month') return { kind: 'yearOne' };
  return { kind: 'other' };
}

/**
 * 발전 나무 보기. hasNeedText: 칸이 열리는 조건 글을 따로 가졌는가(문자열 tech.<id>.need) — 화면이 번역기로 알려 준다.
 * inPlan은 전략을 고르는 단계(step 'policy')의 후보에서 읽는다.
 */
export function techView(def: ChapterDefinition, state: GameState, hasNeedText: (id: Id) => boolean = () => false): TechView {
  const kind = state.work.turn.kind;
  const rate = state.work.turn.months / def.balance.tech.monthsPerSeason;
  const cont = continuingCell(def, state);
  const offered = new Set(state.step === 'policy' ? state.work.candidates.map((c) => c.policyId) : []);
  const cells: CellView[] = [];

  for (const cell of def.tech.cells) {
    const c: TechCellState = peekCell(state, cell.id);
    const policy = findPolicy(def, cellPolicyId(cell.id));
    const spec = crewSpecFor(def, state, policy);
    const inPlan = offered.has(cellPolicyId(cell.id));
    const open = c.status === 'open' || c.status === 'active';
    const lastGift = [...c.log].reverse().find((l) => l.kind === 'gift');
    const person = personFor(def, state, cell.crew.person);
    const fallback = personFor(def, state, cell.crew.fallback);
    const v: CellView = {
      id: cell.id,
      branch: cell.branch,
      order: cell.order,
      planned: false,
      isEnd: isBranchEnd(cell),
      status: c.status,
      seasons: cell.seasons,
      progress: c.progress,
      worked: Math.max(0, c.progress - c.gifted),
      gifted: c.gifted,
      continuing: cont === cell.id,
      inPlan,
      crew: { n: spec?.min ?? cell.crew.adults, ...(person ? { person } : {}), ...(fallback ? { fallback } : {}) },
      ...(cell.cost ? { cost: cell.cost } : {}),
      costPaid: !!c.costPaid,
      opens: opensOf(def, cell.unlocks),
      ...(c.doneMonth !== undefined ? { doneMonth: c.doneMonth } : {}),
      log: c.log,
      ...(lastGift?.by ? { giftBy: lastGift.by } : {}),
    };
    if (c.status === 'locked') {
      const lock = lockOf(def, state, cell.id, hasNeedText);
      if (lock) v.lock = lock;
    } else if (open && !inPlan && state.step === 'policy') {
      const otherInPlan = def.tech.cells.some((x) => x.id !== cell.id && offered.has(cellPolicyId(x.id)));
      v.hidden = hiddenOf(def, state, cell.id, cell.branch, otherInPlan);
    }
    // 처음 시작하는 칸의 비용이 모자란 양
    if (open && cell.cost && !c.costPaid) {
      const sh: NonNullable<CellView['shortage']> = {};
      for (const [g, n] of Object.entries(cell.cost.goods ?? {})) {
        const lack = n - (state.stores.goods[g] ?? 0);
        if (lack > 0) (sh.goods ??= {})[g] = lack;
      }
      const wood = (cell.cost.firewoodKg ?? 0) - state.stores.firewood;
      if (wood > 0) sh.firewoodKg = Math.ceil(wood);
      const food = (cell.cost.foodKg ?? 0) - totalKg(state.stores.food);
      if (food > 0) sh.foodKg = Math.ceil(food);
      if (sh.goods || sh.firewoodKg || sh.foodKg) v.shortage = sh;
    }
    cells.push(v);
  }
  for (const p of def.tech.planned ?? []) {
    cells.push({
      id: p.id,
      branch: p.branch,
      order: p.order,
      planned: true,
      isEnd: !!p.end,
      status: 'locked',
      seasons: p.seasons,
      progress: 0,
      worked: 0,
      gifted: 0,
      continuing: false,
      inPlan: false,
      lock: { kind: 'planned' },
      costPaid: false,
      opens: p.opens.map((o) => ({ kind: o.kind, name: o.name })),
      log: [],
    });
  }
  cells.sort((a, b) => def.tech.branches.indexOf(a.branch) - def.tech.branches.indexOf(b.branch) || a.order - b.order);

  const endsDone = def.tech.branches.filter((b) => cells.some((c) => c.branch === b && c.isEnd && c.status === 'done')).length;
  return {
    branches: def.tech.branches,
    cells,
    done: cells.filter((c) => c.status === 'done').length,
    total: cells.length,
    endsDone,
    endsNeed: def.balance.tech.neolithicBranches,
    ...(cont ? { continuing: cont } : {}),
    turnKind: kind,
    rate,
    driftAmount: cont ? Math.min(rate * def.balance.tech.driftRate, def.tech.cells.find((c) => c.id === cont)!.seasons - peekCell(state, cont).progress) : 0,
  };
}
