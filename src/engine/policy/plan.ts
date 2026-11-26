// 이번 달 전략 짜기 (DESIGN.md §6.4): 식량 1개 + 발전 0~1개, 또는 큰 일 1개.
// 무리는 큰 일 → 발전 → 식량 순으로 뽑는다. 앞에서 뽑힌 사람은 뒤에서 뽑지 않고,
// 마을에 남길 인원(keepHome)은 두 칸을 합쳐서 지킨다. 상태를 바꾸지 않는다(잠깐 바꾼 것은 되돌린다).

import type { BoundPolicy, ChapterDefinition, GameState, Id, Person, PlanEntry, PolicySlot, PolicyTemplate } from '../types';
import { PHASES } from '../types';
import { findPolicy } from '../core/lookup';
import { band, laborUnits, living } from '../people/people';
import { crewSpecFor, formCrew, pickLeader, policyHint } from './candidates';
import { villageHarvest } from '../month/upkeep';

export interface PlanPreview {
  /** 고를 수 없는 조합이면 오류 키 */
  error?: string;
  /** 오류 문구의 변수: planCrew {n: 일할 수 있는 성인}, planPerson {person: 사람 id, policy: 그 사람이 맡은 전략 id} */
  errorParams?: Record<string, string | number>;
  /** 무리를 다시 뽑고 위험 단서를 다시 계산한 전략 (plan 순서: 식량, 발전 / 큰 일) */
  entries: PlanEntry[];
  /** 사람 수: 일할 수 있는 사람 전체, 식량 쪽(원정 + 마을), 발전 무리, 마을에 남는 사람 */
  labor: { total: number; food: number; growth: number; village: number };
  /** 발전 칸 때문에 마을 수확이 줄어드는 양 (이번 달 기대값, kg). 발전이 없으면 0 */
  growthFoodCostKg: number;
}

const ORDER: Record<PolicySlot, number> = { major: 0, growth: 1, food: 2 };
/** plan에 놓는 순서: 주 전략이 먼저 (장면, 연대기, 서술 순서) */
const PLAN_ORDER: Record<PolicySlot, number> = { major: 0, food: 1, growth: 2 };

export function slotOf(def: ChapterDefinition, policyId: Id): PolicySlot {
  return findPolicy(def, policyId).slot;
}

/** 칸 규칙 확인: 큰 일 하나 / 식량 하나 + 발전 0~1개 */
function checkSlots(slots: PolicySlot[]): string | undefined {
  if (slots.length === 0) return 'error.planEmpty';
  if (slots.includes('major')) return slots.length === 1 ? undefined : 'error.planMajorAlone';
  const food = slots.filter((s) => s === 'food').length;
  const growth = slots.filter((s) => s === 'growth').length;
  if (food !== 1) return 'error.planNeedsFood';
  if (growth > 1) return 'error.planTooManyGrowth';
  return undefined;
}

function headcount(def: ChapterDefinition, state: GameState): number {
  return living(state).filter((p) => laborUnits(def, state, p) > 0).length;
}

/** 일할 수 있는 성인 (§B4.3): 무리에 붙일 수 있는 성인 — 다치거나 아프지 않고, 족장이 아닌 사람(족장은 무리에 뽑지 않는다,
 *  crew.includeChief). 노인은 들지 않는다(마을 일에 0.5로 보탠다). 줄기로 떠난 사람은 R3에서 뺀다 */
export function workingAdults(def: ChapterDefinition, state: GameState): number {
  return living(state).filter((p) => !p.isChief && band(def, state, p) === 'adult' && laborUnits(def, state, p) > 0).length;
}

/** 무리를 못 뽑은 까닭: 두 전략의 최소 인원 합이 일할 수 있는 성인보다 많으면 planCrew("일할 사람이 n명뿐이다"),
 *  아니면 마을에 남길 사람이 모자란 것(planLabor) */
function crewError(def: ChapterDefinition, state: GameState, picked: readonly { p: PolicyTemplate }[]): string {
  const need = picked.reduce((a, { p }) => a + (crewSpecFor(def, state, p)?.min ?? 0), 0);
  return need > workingAdults(def, state) ? 'error.planCrew' : 'error.planLabor';
}

/** 이끌 사람이 다른 전략에 가 있으면 그 사람 id와 전략 id (화면의 이유 한 줄: "{name:은} 이미 {policy:을} 맡았다") */
function personConflict(
  def: ChapterDefinition,
  state: GameState,
  p: PolicyTemplate,
  picked: readonly { c: BoundPolicy; p: PolicyTemplate }[],
  leaders: ReadonlyMap<Id, Person>,
): Record<string, string> | undefined {
  for (const { c, p: other } of picked) {
    if (other === p) continue;
    const l = leaders.get(c.uid);
    if (l && pickLeader(def, state, p) === l) return { person: l.id, policy: other.id };
  }
  return undefined;
}

export function previewPlan(def: ChapterDefinition, state: GameState, uids: readonly Id[]): PlanPreview {
  const total = headcount(def, state);
  const empty: PlanPreview = { entries: [], labor: { total, food: total, growth: 0, village: total }, growthFoodCostKg: 0 };
  if (new Set(uids).size !== uids.length) return { ...empty, error: 'error.planDuplicate' };
  const picked: { c: BoundPolicy; p: PolicyTemplate }[] = [];
  for (const uid of uids) {
    const c = state.work.candidates.find((x) => x.uid === uid);
    if (!c) return { ...empty, error: 'error.unknownPolicy' };
    picked.push({ c, p: findPolicy(def, c.policyId) });
  }
  const slotErr = checkSlots(picked.map((x) => x.p.slot));
  if (slotErr) return { ...empty, error: slotErr };

  // 이끄는 사람 먼저: 큰 일 → 식량 → 발전 (§B4.3 이름 있는 인물은 한 턴에 한 자리).
  // 식량 전략을 이끄는 사람이 칸에 필요한 인물이면 칸은 fallback이 맡고, fallback도 없으면 함께 고를 수 없다
  const leaders = new Map<Id, Person>();
  const leaderTaken = new Set<Id>();
  for (const { c, p } of picked.slice().sort((a, b) => PLAN_ORDER[a.p.slot] - PLAN_ORDER[b.p.slot])) {
    const l = pickLeader(def, state, p, leaderTaken);
    if (p.leader && !l) {
      const busy = personConflict(def, state, p, picked, leaders);
      return busy ? { ...empty, error: 'error.planPerson', errorParams: busy } : { ...empty, error: 'error.planLabor' };
    }
    if (l) {
      leaders.set(c.uid, l);
      leaderTaken.add(l.id);
    }
  }

  // 무리 뽑기: 큰 일 → 발전 → 식량 (발전 칸의 인원은 정해져 있고, 식량 무리는 남는 사람으로)
  const taken = new Set<Id>();
  let awayUnits = 0;
  const entries: PlanEntry[] = [];
  const savedProbe = state.work.probePlace;
  try {
    for (const { c, p } of picked.slice().sort((a, b) => ORDER[a.p.slot] - ORDER[b.p.slot])) {
      const own = leaders.get(c.uid);
      // 다른 전략을 이끄는 사람은 이 무리에 뽑지 않는다
      const busy = new Set([...taken, ...[...leaderTaken].filter((id) => id !== own?.id)]);
      const formed = formCrew(def, state, p, { taken: busy, awayUnits, leader: own ?? null });
      if (!formed) return { ...empty, error: crewError(def, state, picked), errorParams: { n: workingAdults(def, state) } };
      for (const x of formed.crew) {
        taken.add(x.id);
        awayUnits += laborUnits(def, state, x);
      }
      if (formed.leader) taken.add(formed.leader.id);
      const place = p.crew && !p.crew.atHome ? (c.place ?? p.place) : undefined;
      // 무리가 바뀌었을 수 있으니 위험 단서를 다시 잰다 (그 전략의 곳에서)
      if (c.place) state.work.probePlace = c.place;
      const actors: Record<string, Id> = formed.leader ? { leader: formed.leader.id } : {};
      const hint = policyHint(def, state, p, { crew: formed.crew, ...(formed.leader ? { leader: formed.leader } : {}), actors });
      if (savedProbe === undefined) delete state.work.probePlace;
      else state.work.probePlace = savedProbe;
      const bound: BoundPolicy = {
        ...c,
        crew: formed.crew.map((x) => x.id),
        hint,
      };
      if (formed.leader) bound.leaderId = formed.leader.id;
      else delete bound.leaderId;
      entries.push({ slot: p.slot, bound, ...(place ? { place } : {}), haul: [] });
    }
  } finally {
    if (savedProbe === undefined) delete state.work.probePlace;
    else state.work.probePlace = savedProbe;
  }
  entries.sort((a, b) => PLAN_ORDER[a.slot] - PLAN_ORDER[b.slot]);

  const growthCrew = entries.filter((e) => e.slot === 'growth').reduce((a, e) => a + e.bound.crew.length, 0);
  const allCrew = entries.reduce((a, e) => a + e.bound.crew.length, 0);
  const growth = entries.find((e) => e.slot === 'growth');
  return {
    entries,
    labor: { total, food: total - growthCrew, growth: growthCrew, village: total - allCrew },
    growthFoodCostKg: growth ? Math.max(0, expectedVillageFood(def, state, entries.filter((e) => e !== growth)) - expectedVillageFood(def, state, entries)) : 0,
  };
}

/** 이 전략들로 한 달 동안 마을이 거둘 식량의 기대값 (지금 순의 날씨로, 세 순 동안 재고가 줄어드는 것까지) */
export function expectedVillageFood(def: ChapterDefinition, state: GameState, entries: PlanEntry[]): number {
  const saved = state.work.plan;
  const savedActive = state.work.active;
  const camp = state.places[state.campPlace];
  const savedStock = camp ? { ...camp.stock } : undefined;
  state.work.plan = entries;
  delete state.work.active;
  try {
    let total = 0;
    for (let i = 0; i < PHASES.length; i++) {
      for (const y of villageHarvest(def, state).food) {
        total += y.kg;
        if (camp && camp.stock[y.yid] !== undefined) camp.stock[y.yid] = Math.max(0, camp.stock[y.yid]! - y.kg);
      }
    }
    return total;
  } finally {
    state.work.plan = saved;
    if (savedActive === undefined) delete state.work.active;
    else state.work.active = savedActive;
    if (camp && savedStock) camp.stock = savedStock;
  }
}
