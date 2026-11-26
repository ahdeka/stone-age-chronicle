// 순마다의 마을 살림 (DESIGN.md §4.2 4~8번): 마을 일, 먹기, 장작, 부패, 건강

import type { ChapterDefinition, FoodLot, GameState, Id, Line, Person } from '../types';
import { addCohesion, alert, applyEffects, applyNarrative, injurePerson, killPerson, ledger, type RunCtx } from '../effects/apply';
import { byId, findAilment, findPlace, findPolicy, monthDef, phaseNo } from '../core/lookup';
import { planCrew } from '../policy/current';
import { ageYears, bandDef, dailyFood, isVulnerable, laborUnits, living } from '../people/people';
import { chance } from '../rng/rng';
import { firewoodPerDay, getStat, stat, type SourceFilter } from '../stats/stats';
import { addLot, eat, spoil, totalKg } from '../stores/food';

const byPersonId = (a: Person, b: Person) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function days(def: ChapterDefinition): number {
  return def.balance.daysPerPhase;
}

/** "덕분에" 줄로 보이는 발전의 출처: 지은 것과 아는 것 (거처는 장작 아낀 양에만) */
export const BONUS_PREFIXES = ['facility.', 'knowledge.', 'tech.'] as const;
const SAVING_PREFIXES = [...BONUS_PREFIXES, 'shelter.'] as const;
const isBonusSource = (src: string) => BONUS_PREFIXES.some((p) => src.startsWith(p));

/** 마을에서 일하는 사람 (두 칸 전략의 무리 제외, 일할 수 있는 사람) */
export function villageWorkers(def: ChapterDefinition, state: GameState): Person[] {
  const away = planCrew(state);
  return living(state).filter((p) => !away.has(p.id) && laborUnits(def, state, p) > 0);
}

/** 마을 일손 (원정대 제외), 굶주림 효율 반영 */
export function villageUnits(def: ChapterDefinition, state: GameState): number {
  const units = villageWorkers(def, state).reduce((a, p) => a + laborUnits(def, state, p), 0);
  return units * (def.balance.ration.efficiency[state.hungerStage] ?? 1) * stat(def, state, 'village.labor');
}

function push(state: GameState, line: Line): void {
  state.work.reports[state.work.reports.length - 1]!.lines.push(line);
}

/** 마을 일손 중 장작에 쓰는 비율: 전략이 정한 값 중 가장 큰 것, 없으면 장작 사정에 따라 자동 */
export function firewoodShare(def: ChapterDefinition, state: GameState): number {
  let share: number | undefined;
  for (const e of state.work.plan) {
    const v = findPolicy(def, e.bound.policyId).firewoodShare;
    if (v !== undefined) share = Math.max(share ?? 0, v);
  }
  if (share !== undefined) return share;
  const target = firewoodPerDay(def, state) * days(def) * def.balance.chores.firewoodTargetPhases;
  return state.stores.firewood < target ? def.balance.chores.firewoodShareLow : def.balance.chores.firewoodShareNormal;
}

export interface YieldHarvest {
  yid: Id;
  kind: Id;
  kg: number;
  /** 발전 출처마다 늘려 준 몫 (합은 kg를 넘지 않는다) */
  bonus: Record<string, number>;
}

/** 이번 순 마을 일의 기대 수확 (상태를 바꾸지 않는다). 재고 비율(고갈)을 반영한다 */
export function villageHarvest(def: ChapterDefinition, state: GameState): { wood: number; food: YieldHarvest[] } {
  const d = days(def);
  const units = villageUnits(def, state);
  const m = monthDef(def, state);
  const planned = firewoodShare(def, state);
  const room = Math.max(0, stat(def, state, 'firewood.cap') - state.stores.firewood);
  const perShare = units * m.woodPerWorkerDay * d * stat(def, state, 'yield.wood');
  const wood = Math.min(room, perShare * planned);
  // 장작을 더 쌓을 곳이 없으면 장작에 묶였던 일손은 채집으로 돌아간다 (③a: 일손이 그냥 버려지지 않게)
  const share = perShare > 0 ? Math.min(planned, wood / perShare) : planned;

  const camp = findPlace(def, state.campPlace);
  const cs = state.places[camp.id];
  const food: YieldHarvest[] = [];
  for (const [yid, per] of Object.entries(camp.yields[m.season] ?? {})) {
    if (per === undefined) continue;
    const yd = def.yields.find((y) => y.id === yid);
    if (!yd) throw new Error(`unknown yield: ${yid}`);
    const max = camp.stockMax[yid];
    const factor = max !== undefined && max > 0 && cs ? Math.max(0, (cs.stock[yid] ?? max) / max) : 1;
    const key = `yield.${yid}`;
    const full = getStat(def, state, key);
    const raw = units * (1 - share) * per * factor;
    const kg = Math.max(0, raw * full.value);
    food.push({ yid, kind: yd.foodKind, kg, bonus: bonusShares(def, state, key, full.parts.map((p) => p.source), raw, kg) });
  }
  return { wood, food };
}

/** 발전 출처마다 늘려 준 몫. 따로 뺀 값의 합이 모두 뺀 값과 같도록 나눈다 */
function bonusShares(def: ChapterDefinition, state: GameState, key: string, sources: string[], raw: number, kg: number): Record<string, number> {
  const ids = [...new Set(sources.filter(isBonusSource))];
  if (ids.length === 0 || kg <= 0) return {};
  const without = (f: SourceFilter) => Math.max(0, raw * stat(def, state, key, f));
  const total = kg - without(isBonusSource);
  if (total <= 0) return {};
  const each = ids.map((id) => ({ id, v: Math.max(0, kg - without((src) => src === id)) }));
  const sum = each.reduce((a, x) => a + x.v, 0);
  const out: Record<string, number> = {};
  for (const x of each) if (x.v > 0) out[x.id] = sum > 0 ? (total * x.v) / sum : 0;
  return out;
}

/** 발전 덕분에 아낀 양을 이번 달 기록에 더한다 */
export function addSaving(state: GameState, res: Id, source: string, kg: number): void {
  if (kg < 1e-6) return;
  const row = state.work.savings.find((x) => x.res === res && x.source === source);
  if (row) row.kg += kg;
  else state.work.savings.push({ res, source, kg });
}

/** 지은 것이 순마다 저절로 하는 일 (건조대가 날것을 말린다 등) */
export function facilityWork(ctx: RunCtx): void {
  const { def, state } = ctx;
  for (const [id, level] of Object.entries(state.facilities)) {
    if (level <= 0) continue;
    const f = byId(def.facilities, id, 'facility');
    if (f.perPhase) applyEffects({ ...ctx, crew: [], source: `facility.${id}`, group: 'village' }, f.perPhase);
  }
}

export function chores(ctx: RunCtx): void {
  const { def, state } = ctx;
  const h = villageHarvest(def, state);
  state.stores.firewood += h.wood;
  ledger(state, 'firewood', h.wood, 'village.wood');

  const camp = findPlace(def, state.campPlace);
  const cs = state.places[camp.id];
  let food = 0;
  const bonus: Record<string, number> = {};
  for (const y of h.food) {
    if (cs && camp.stockMax[y.yid] !== undefined) cs.stock[y.yid] = Math.max(0, (cs.stock[y.yid] ?? camp.stockMax[y.yid]!) - y.kg);
    addLot(state.stores.food, y.kind, y.kg);
    food += y.kg;
    for (const [src, kg] of Object.entries(y.bonus)) bonus[src] = (bonus[src] ?? 0) + kg;
  }
  // 정산표: 마을 수확에서 발전이 늘려 준 몫을 "덕분에" 줄로 따로 (합은 그대로)
  const extra = Object.values(bonus).reduce((a, x) => a + x, 0);
  ledger(state, 'food', food - extra, 'village.gather');
  for (const [src, kg] of Object.entries(bonus)) ledger(state, 'food', kg, `bonus.${src}`);
  // 마을 서술: 몇 명이 무엇을 얼마나 했는가 (변형은 계절, 날씨, 장작 사정을 따른다)
  state.work.vars['wood'] = Math.round(h.wood);
  state.work.vars['gathered'] = Math.round(food);
  state.work.vars['villagers'] = villageWorkers(def, state).length;
  // 계절 턴은 단계(달)마다 마을 서술 한 번 (첫 순에만)
  if (state.work.turn.kind === 'season' && state.work.phasesDone > 0) return;
  if (state.work.vars['villagers'] === 0) push(state, { key: 'line.village.empty', group: 'village' });
  else applyNarrative({ ...ctx, group: 'village', source: 'village' }, def.hooks.villageNarrative);
}

export function consume(ctx: RunCtx): void {
  const { def, state } = ctx;
  const d = days(def);
  const r = def.balance.ration;
  const people = living(state).sort(byPersonId);
  const need = people.reduce((a, p) => a + dailyFood(def, state, p), 0) * d;
  if (need <= 0) return;
  const cap = Math.min(1, stat(def, state, 'ration.cap'));
  const have = totalKg(state.stores.food);
  let ratio: number;
  if (have >= need * cap) ratio = cap;
  else if (have >= need * r.reduced) ratio = r.reduced;
  else ratio = have / need;
  const eaten = eat(def, state.stores.food, need * ratio, monthDef(def, state).temp);
  ledger(state, 'food', -eaten, 'upkeep.food', { people: people.length, days: d });

  // 단계 (DESIGN.md §10.5): 감축을 먼저 밟는다. 감축 배급에도 못 미치는 순이 이어지거나 거의 먹을 것이 없으면 굶주림
  const shortKey = 'ration_short_phases';
  const short = ratio < r.reduced - 1e-9 ? (state.counters[shortKey] ?? 0) + 1 : 0;
  state.counters[shortKey] = short;
  const stage = ratio >= 1 - 1e-9 ? 0 : ratio < r.starveRatio - 1e-9 || short >= r.starveAfterPhases ? 2 : 1;
  if (stage !== state.hungerStage) {
    state.work.notable = true;
    push(state, { key: `line.hunger.${stage}`, group: 'village' });
  }
  state.hungerStage = stage;
  state.work.maxHunger = Math.max(state.work.maxHunger, stage);
  state.work.stageHunger = Math.max(state.work.stageHunger ?? 0, stage);
  const rp = (state.work.rationPhases ??= [0, 0, 0]);
  rp[stage] += 1;
  for (const p of people) {
    if (stage === 0) p.hungerDays = Math.max(0, p.hungerDays - r.recoverPerPhase);
    else p.hungerDays += d * (1 - ratio);
  }
  // 계절 턴은 순마다가 아니라 단계 끝에 한 번 판정한다 (stageCohesion, §B6.4 안 A)
  if (state.work.turn.kind === 'season') return;
  addCohesion(state, def, r.cohesionPerPhase[stage] ?? 0, `hunger.${stage}`);
  // 배급이 다 찬 순: 결속이 평소까지 돌아온다
  if (stage === 0) recoverCohesion(def, state, r.recoverCohesion.perPhase);
}

function recoverCohesion(def: ChapterDefinition, state: GameState, amount: number): void {
  const upTo = def.balance.ration.recoverCohesion.upTo;
  if (state.cohesion < upTo) addCohesion(state, def, Math.min(amount, upTo - state.cohesion), 'ration.recover');
}

/** 계절 턴 단계(달) 끝의 결속 (§B6.4 안 A): 그 단계 세 순 중 가장 나쁜 배급 상태로 한 번.
 *  감축 −2, 굶주림 −5, 다 먹은 단계 +2 (평소 값까지). 출처 이름은 달 턴과 같다 */
export function stageCohesion(def: ChapterDefinition, state: GameState, worst: number): void {
  const sc = def.balance.ration.stageCohesion;
  if (worst <= 0) recoverCohesion(def, state, sc.recover);
  else addCohesion(state, def, sc.perStage[Math.min(2, worst)] ?? 0, `hunger.${Math.min(2, worst)}`);
}

export function burnFirewood(ctx: RunCtx): void {
  const { def, state } = ctx;
  const burn = firewoodPerDay(def, state) * days(def);
  for (const src of savingSources(def, state)) {
    addSaving(state, 'firewood', src, firewoodPerDay(def, state, (x) => x === src) * days(def) - burn);
  }
  if (state.stores.firewood >= burn) {
    state.stores.firewood -= burn;
    ledger(state, 'firewood', -burn, 'upkeep.firewood');
    return;
  }
  const short = burn > 0 ? 1 - state.stores.firewood / burn : 0;
  ledger(state, 'firewood', -state.stores.firewood, 'upkeep.firewood');
  state.stores.firewood = 0;
  const c = def.balance.cold;
  push(state, { key: 'line.cold', group: 'village' });
  state.work.notable = true;
  addCohesion(state, def, c.cohesion * short, 'cold');
  for (const p of living(state).sort(byPersonId)) {
    if (!isVulnerable(def, state, p)) continue;
    if (chance(state.rng, short * c.deathChance)) killPerson(ctx, p, 'cold');
    else if (p.ailments.length === 0 && chance(state.rng, short * c.sickChance)) injurePerson(ctx, p, c.sickness, 2);
  }
}

/** 장작·부패를 줄여 주는 발전 출처 (지금 걸려 있는 것) */
function savingSources(def: ChapterDefinition, state: GameState): string[] {
  const parts = [...getStat(def, state, 'firewood.burnMul').parts, ...getStat(def, state, 'spoil.mul').parts].map((p) => p.source);
  const out = new Set(parts.filter((src) => SAVING_PREFIXES.some((p) => src.startsWith(p)) && !src.startsWith('shelter.')));
  const shelter = `shelter.${state.shelter.kind}`;
  if (findShelterMul(def, state) < 1) out.add(shelter);
  return [...out];
}

function findShelterMul(def: ChapterDefinition, state: GameState): number {
  return byId(def.shelters, state.shelter.kind, 'shelter').firewoodMul;
}

const cloneLots = (lots: readonly FoodLot[]): FoodLot[] => lots.map((l) => ({ ...l }));

export function spoilFood(ctx: RunCtx): void {
  const { def, state } = ctx;
  const temp = monthDef(def, state).temp;
  const mul = stat(def, state, 'spoil.mul');
  // 발전 덕분에 덜 상한 양 (그 출처를 뺐다면 더 상했을 양)
  for (const p of getStat(def, state, 'spoil.mul').parts) {
    if (!isBonusSource(p.source)) continue;
    const worse = spoil(def, cloneLots(state.stores.food), temp, stat(def, state, 'spoil.mul', (x) => x === p.source));
    const now = spoil(def, cloneLots(state.stores.food), temp, mul);
    addSaving(state, 'food', p.source, worse - now);
  }
  const lost = spoil(def, state.stores.food, temp, mul);
  ledger(state, 'food', -lost, 'spoil');
  spoil(def, state.work.haul, temp, mul);
  for (const e of state.work.plan) spoil(def, e.haul, temp, mul);
  for (const c of state.caches) spoil(def, c.lots, temp, mul * def.balance.cache.spoilMul);
}

export function health(ctx: RunCtx): void {
  const { def, state } = ctx;
  const r = def.balance.ration;
  const now = phaseNo(state);
  for (const p of living(state).sort(byPersonId)) {
    // 회복
    const healed = p.ailments.filter((a) => a.healsAt <= now);
    if (healed.length > 0) {
      p.ailments = p.ailments.filter((a) => a.healsAt > now);
      for (const a of healed) {
        push(state, { key: 'line.healed', params: { name: p.name, ailment: { key: `ailment.${a.kind}` } }, group: 'people' });
        alert(state, { kind: 'healed', personId: p.id, what: a.kind });
      }
    }
    // 병으로 인한 죽음
    for (const a of p.ailments) {
      const def_ = findAilment(def, a.kind);
      const pr = def_.deathChance * (a.severity === 3 ? 2 : 1) * (state.hungerStage === 2 ? r.sickDeathMul : 1);
      if (chance(state.rng, pr)) {
        killPerson(ctx, p, a.kind);
        break;
      }
    }
    if (!p.alive) continue;
    // 굶주림으로 쓰러짐
    const vulnerable = bandDef(def, ageYears(state, p)).vulnerable || p.ailments.length > 0;
    const th = vulnerable ? r.collapseDays.vulnerable : r.collapseDays.others;
    if (p.hungerDays >= th) {
      const pr = Math.min(r.collapseMax, r.collapseChance * (1 + (p.hungerDays - th) / r.collapseSlopeDays));
      if (chance(state.rng, pr)) {
        killPerson(ctx, p, 'hunger');
        continue;
      }
    }
    // 굶주림이 병을 부른다
    if (state.hungerStage === 2 && vulnerable && p.ailments.length === 0 && chance(state.rng, r.sicknessChance)) {
      injurePerson(ctx, p, r.sickness, 2);
    }
  }
}

export function upkeep(ctx: RunCtx): void {
  facilityWork(ctx);
  chores(ctx);
  consume(ctx);
  burnFirewood(ctx);
  spoilFood(ctx);
  health(ctx);
}
