// 발전 나무 (DESIGN.md §B3, §B4.4, §B4.5)
//
// 칸 상태: 잠김 → (앞 칸 조건, 또는 선물) → 열림 → (진척 > 0) → 진행 중 → (진척 ≥ 철 수) → 켜짐
// 진척 단위는 철이다. 한 턴의 일손 진척 = 그 턴의 달 수 / balance.tech.monthsPerSeason (1년차 한 달 = 1/3철).
// 칸에 일손을 붙이는 것은 장 정의의 칸마다 만든 발전 전략(cellPolicies)이고, 진척은 턴 정산에서 오른다.

import type { ChapterDefinition, GameState, Id, PolicyTemplate, TechCellDef, TechCellState, TechLogEntry } from '../types';
import { branchesDone, EPS, findCell, freshCell, isBranchEnd, isCellDone, peekCell } from './query';
import { allTrue } from '../conditions/evaluate';
import { findPolicy, monthDef } from '../core/lookup';
import { addCohesion, currentReport, grantKnowledge, ledger, offerChronicle, raiseFacility, setFlag, type RunCtx } from '../effects/apply';
import { eat, totalKg } from '../stores/food';

/** 칸 전략 id: 칸 id 앞에 붙인다 (문자열 policy.cell_<칸>.*) */
export const CELL_POLICY_PREFIX = 'cell_';
export const cellPolicyId = (cellId: Id) => `${CELL_POLICY_PREFIX}${cellId}`;

function cellState(state: GameState, id: Id): TechCellState {
  return (state.tech[id] ??= freshCell());
}

/** 앞 칸 조건 */
export function requiresMet(def: ChapterDefinition, state: GameState, cell: TechCellDef): boolean {
  const r = cell.requires;
  if ('all' in r) return r.all.every((id) => isCellDone(state, id));
  if ('any' in r) return r.any.some((id) => isCellDone(state, id)) || (r.or !== undefined && r.or.length > 0 && allTrue(def, state, r.or));
  const done = def.tech.cells.filter((c) => c.branch === r.branchDone && c.id !== cell.id && isCellDone(state, c.id)).length;
  return done >= r.min;
}

/** 선물로 채울 수 있는 몫 (철) */
export function giftCap(def: ChapterDefinition, cell: TechCellDef): number {
  return (cell.gift?.maxShare ?? def.balance.tech.giftMaxShare) * cell.seasons;
}

/** 장 정의의 칸마다 상태를 만든다. 새로 만든 칸은 이미 아는 지식이 주는 선물(KnowledgeDef.grantEffects의 tech 선물)을
 *  받은 것으로 본다 — 칸 상태가 없던 세이브에서 1년차 겨울 준비(끌개 엮기, 저장 구덩이)를 마친 경우 (§B3.3) */
export function ensureTech(def: ChapterDefinition, state: GameState): void {
  const fresh = new Set<Id>();
  for (const cell of def.tech.cells) {
    if (state.tech[cell.id]) continue;
    cellState(state, cell.id);
    fresh.add(cell.id);
  }
  for (const k of state.knowledge.has) {
    for (const e of def.knowledge.find((x) => x.id === k)?.grantEffects ?? []) {
      if (e.type !== 'tech' || !e.gift || !fresh.has(e.id)) continue;
      const cell = findCell(def, e.id);
      const c = cellState(state, e.id);
      const add = Math.min(e.gift, giftCap(def, cell) - c.gifted, cell.seasons - c.progress);
      if (add <= EPS) continue;
      c.progress += add;
      c.gifted += add;
      c.log.push({ kind: 'gift', ...(e.by ? { by: e.by } : {}), amount: add, month: state.month });
    }
  }
  refreshTech(def, state);
}

/** 칸 상태를 다시 맞춘다 (열림은 되돌아가지 않는다) */
export function refreshTech(def: ChapterDefinition, state: GameState): void {
  // 앞 칸이 켜지면 뒤 칸이 열리므로, 바뀌지 않을 때까지
  for (let pass = 0; pass < def.tech.cells.length + 1; pass++) {
    let changed = false;
    for (const cell of def.tech.cells) {
      const c = cellState(state, cell.id);
      if (c.status === 'done') continue;
      const open = c.status !== 'locked' || requiresMet(def, state, cell) || (c.gifted > EPS && !isBranchEnd(cell));
      const next = open ? (c.progress > EPS ? 'active' : 'open') : 'locked';
      if (next !== c.status) {
        c.status = next;
        changed = true;
      }
    }
    if (!changed) return;
  }
}

/** 부족이 전략으로 이 칸에서 마지막으로 일한 달 (일 기록 'work'·'winter'만. 선물·저절로 나아간 몫은 세지 않는다) */
export function lastWorked(c: TechCellState): number | undefined {
  let at: number | undefined;
  for (const l of c.log) if ((l.kind === 'work' || l.kind === 'winter') && (at === undefined || l.month > at)) at = l.month;
  return at;
}

/** 이어 가던 칸 (§B4.4, 2026-11-27): 켜지지 않은 칸 중 가장 최근에 전략으로 고른(부족이 직접 일한) 칸.
 *  열림·진행 중 칸만 된다(잠긴 칸은 안 됨). 선물로만 찬 칸은 되지 않는다. 마지막에 고른 칸이 켜졌으면 그 전에 고르다 만 칸,
 *  그런 칸이 없으면 없다. 같은 달이면 장 정의 순서.
 *  일 기록(log)에서 읽는다 — 세이브 v7의 lastProgress는 선물에도 바뀌었으므로 쓰지 않는다 */
export function continuingCell(def: ChapterDefinition, state: GameState): Id | undefined {
  let best: Id | undefined;
  let at = -Infinity;
  for (const cell of def.tech.cells) {
    const c = peekCell(state, cell.id);
    if (c.status !== 'open' && c.status !== 'active') continue;
    const m = lastWorked(c);
    if (m !== undefined && m > at) {
      at = m;
      best = cell.id;
    }
  }
  return best;
}

/** 칸에 진척을 더한다. 선물은 칸의 상한까지, 모두 칸의 철 수까지. 실제로 더한 양을 돌려준다 */
export function addTechProgress(ctx: RunCtx, id: Id, amount: number, kind: TechLogEntry['kind'], by?: Id): number {
  const { def, state } = ctx;
  const cell = findCell(def, id);
  const c = cellState(state, id);
  if (c.status === 'done' || amount <= EPS) return 0;
  let add = Math.min(amount, cell.seasons - c.progress);
  if (kind === 'gift') add = Math.min(add, giftCap(def, cell) - c.gifted);
  if (add <= EPS) return 0;
  c.progress += add;
  if (kind === 'gift') c.gifted += add;
  // 마지막으로 전략으로 일한 달: 선물·저절로 나아간 몫은 바꾸지 않는다 (§B3.3, 이어 가던 칸은 log에서 읽는다)
  if (kind === 'work' || kind === 'winter') c.lastProgress = state.month;
  c.log.push({ kind, ...(by ? { by } : {}), amount: add, month: state.month });
  refreshTech(def, state);
  if (c.status !== 'locked' && c.progress >= cell.seasons - EPS) completeCell(ctx, id);
  return add;
}

const cellLabel = (id: Id) => ({ key: `tech.${id}` });

function techLine(state: GameState, key: string, params: Record<string, number | { key: string }>): void {
  currentReport(state).lines.push({ key, params, group: 'growth' });
}

/** 칸이 켜진다: 지식·시설을 주고, 작은 잔치(결속), 연대기, 뒤 칸이 열린다 */
function completeCell(ctx: RunCtx, id: Id): void {
  const { def, state } = ctx;
  const cell = findCell(def, id);
  const c = cellState(state, id);
  c.status = 'done';
  c.progress = cell.seasons;
  c.doneMonth = state.month;
  for (const k of cell.grants?.knowledge ?? []) if (!state.knowledge.has.includes(k)) grantKnowledge(ctx, k);
  for (const f of cell.grants?.facility ?? []) raiseFacility(ctx, f, 1);
  addCohesion(state, def, def.balance.tech.doneCohesion, 'tech.done');
  techLine(state, 'line.tech.done', { cell: cellLabel(id) });
  offerChronicle(state, 'chron.tech.done', def.balance.chronicle.builtImportance, { cell: cellLabel(id) });
  state.work.notable = true;
  refreshTech(def, state);
}

// ── 시작 비용 ──

/** 이 칸을 이번 턴에 시작(또는 이어서)할 수 있는가: 시작 철, 처음이면 비용 */
export function canStartCell(def: ChapterDefinition, state: GameState, id: Id): boolean {
  const cell = findCell(def, id);
  const c = peekCell(state, id);
  if (c.status !== 'open' && c.status !== 'active') return false;
  if (cell.startSeasons && c.progress <= EPS && !cell.startSeasons.includes(monthDef(def, state).season)) return false;
  if (c.costPaid || !cell.cost) return true;
  const k = cell.cost;
  for (const [g, n] of Object.entries(k.goods ?? {})) if ((state.stores.goods[g] ?? 0) < n) return false;
  if ((k.firewoodKg ?? 0) > state.stores.firewood) return false;
  if ((k.foodKg ?? 0) > totalKg(state.stores.food)) return false;
  return true;
}

/** 처음 시작하는 턴에 비용을 낸다 */
export function payCellCost(ctx: RunCtx, id: Id): void {
  const { def, state } = ctx;
  const cell = findCell(def, id);
  const c = cellState(state, id);
  if (c.costPaid) return;
  c.costPaid = true;
  const k = cell.cost;
  if (!k) return;
  const source = `tech.${id}`;
  for (const [g, n] of Object.entries(k.goods ?? {})) {
    state.stores.goods[g] = (state.stores.goods[g] ?? 0) - n;
    ledger(state, g, -n, source);
  }
  if (k.firewoodKg) {
    state.stores.firewood -= k.firewoodKg;
    ledger(state, 'firewood', -k.firewoodKg, source);
  }
  if (k.foodKg) ledger(state, 'food', -eat(def, state.stores.food, k.foodKg, monthDef(def, state).temp), source);
}

// ── 턴 정산 ──

/** 턴 정산에서 칸 진척: 고른 칸 + 저장분으로 버틴 겨울의 더한 몫, 이어 가던 칸의 저절로 진행(균형 규칙), 신석기 판정 */
export function settleTech(ctx: RunCtx): void {
  const { def, state } = ctx;
  const w = state.work;
  const b = def.balance.tech;
  const rate = w.turn.months / b.monthsPerSeason;
  const policies = w.plan.map((e) => findPolicy(def, e.bound.policyId));
  const worked = policies.find((p) => p.tech)?.tech;
  const hasGrowth = w.plan.some((e) => e.slot === 'growth');
  const hasMajor = w.plan.some((e) => e.slot === 'major');
  // 이어 가던 칸은 이번 턴 일손 진척 전에 정한다
  const cont = continuingCell(def, state);

  if (worked) {
    const add = addTechProgress(ctx, worked, rate, 'work');
    const bonus = policies.reduce((a, p) => a + (p.techBonus ?? 0), 0);
    const extra = bonus > 0 ? addTechProgress(ctx, worked, bonus, 'winter') : 0;
    if (add + extra > EPS && peekCell(state, worked).status !== 'done') techLine(state, 'line.tech.work', { cell: cellLabel(worked), pct: pctOf(def, state, worked) });
  }
  // 균형 규칙 (§B4.4): 다른 발전이나 큰 일을 고른 턴에 이어 가던 칸이 절반 속도로. "발전하지 않는다" 턴에는 없다
  if (cont && cont !== worked && (hasGrowth || hasMajor)) {
    const add = addTechProgress(ctx, cont, rate * b.driftRate, 'drift');
    if (add > EPS && peekCell(state, cont).status !== 'done') techLine(state, 'line.tech.drift', { cell: cellLabel(cont), pct: pctOf(def, state, cont) });
  }
  refreshTech(def, state);

  // 신석기 (§B3.5): 갈래 둘의 끝이 켜지면. 같은 턴에 켜진 셋째 갈래도 센다
  const done = branchesDone(def, state);
  if (done.length >= b.neolithicBranches && state.flags['neolithic'] === undefined) {
    setFlag(state, 'neolithic', true);
    for (const br of done) setFlag(state, `neolithic.${br}`, true);
    techLine(state, 'line.tech.neolithic', {});
  }
}

function pctOf(def: ChapterDefinition, state: GameState, id: Id): number {
  return Math.floor((peekCell(state, id).progress / findCell(def, id).seasons) * 100 + 1e-6);
}

// ── 장 정의에서 칸 전략 만들기 ──

/** 칸마다 발전 전략 하나: 그 갈래의 "다음 칸"일 때만 후보, 칸이 정한 인원이 마을 안에서 일한다 (두 턴 종류 모두) */
export function cellPolicies(def: Pick<ChapterDefinition, 'tech' | 'balance'>): PolicyTemplate[] {
  return def.tech.cells.map((cell) => ({
    id: cellPolicyId(cell.id),
    slot: 'growth',
    turn: 'any',
    category: `branch.${cell.branch}`,
    appearsWhen: [{ type: 'tech', id: cell.id, next: true }],
    priority: def.balance.tech.cellPriority.month,
    // 계절 턴 높이. 이어 가기(+projectBonus)는 후보 점수에서 준다: 부족이 직접 일한 칸만 (generateCandidates)
    relevance: [{ when: [{ type: 'turnKind', in: ['season'] }], add: def.balance.tech.cellPriority.season - def.balance.tech.cellPriority.month }],
    cooldown: 0,
    tech: cell.id,
    crew: { min: cell.crew.adults, max: cell.crew.adults, keepHome: 0, atHome: true },
    ...(cell.crew.person ? { leader: cell.crew.person } : {}),
    ...(cell.crew.fallback ? { leaderFallback: cell.crew.fallback } : {}),
    scene: cell.scene,
    // 턴의 첫 단계(1년차는 상순, 계절 턴은 초입)에 칸 일 서술 한 줄
    steps: { early: [{ kind: 'narrate', effects: [{ type: 'line', key: `tech.${cell.id}.work` }] }] },
  }));
}
