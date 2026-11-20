// 순마다의 마을 살림 (DESIGN.md §4.2 4~8번): 마을 일, 먹기, 장작, 부패, 건강

import type { ChapterDefinition, GameState, Person } from '../types';
import { addCohesion, injurePerson, killPerson, ledger, type RunCtx } from '../effects/apply';
import { findAilment, findPlace, findPolicy, monthDef, phaseNo } from '../core/lookup';
import { ageYears, bandDef, dailyFood, isVulnerable, laborUnits, living } from '../people/people';
import { chance } from '../rng/rng';
import { firewoodPerDay, stat } from '../stats/stats';
import { addLot, eat, spoil, totalKg } from '../stores/food';

const byId = (a: Person, b: Person) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function days(def: ChapterDefinition): number {
  return def.balance.daysPerPhase;
}

/** 마을 일손 (원정대 제외), 굶주림 효율 반영 */
export function villageUnits(def: ChapterDefinition, state: GameState): number {
  const away = new Set(state.work.chosen?.crew ?? []);
  const units = living(state)
    .filter((p) => !away.has(p.id))
    .reduce((a, p) => a + laborUnits(def, state, p), 0);
  return units * (def.balance.ration.efficiency[state.hungerStage] ?? 1);
}

export function chores(ctx: RunCtx): void {
  const { def, state } = ctx;
  const d = days(def);
  const units = villageUnits(def, state);
  const m = monthDef(def, state);
  const target = firewoodPerDay(def, state) * d * def.balance.chores.firewoodTargetPhases;
  const chosen = state.work.chosen ? findPolicy(def, state.work.chosen.policyId) : undefined;
  const share =
    chosen?.firewoodShare ?? (state.stores.firewood < target ? def.balance.chores.firewoodShareLow : def.balance.chores.firewoodShareNormal);

  const wood = units * share * m.woodPerWorkerDay * d * stat(def, state, 'yield.wood');
  state.stores.firewood += wood;
  ledger(state, 'firewood', wood, 'village.wood');

  const camp = findPlace(def, state.campPlace);
  const cs = state.places[camp.id];
  const yields = camp.yields[m.season] ?? {};
  let food = 0;
  for (const [yid, per] of Object.entries(yields)) {
    if (per === undefined) continue;
    const yd = def.yields.find((y) => y.id === yid);
    if (!yd) throw new Error(`unknown yield: ${yid}`);
    const max = camp.stockMax[yid];
    const factor = max !== undefined && max > 0 && cs ? Math.max(0, (cs.stock[yid] ?? max) / max) : 1;
    const got = units * (1 - share) * per * factor * stat(def, state, `yield.${yid}`);
    if (cs && max !== undefined) cs.stock[yid] = Math.max(0, (cs.stock[yid] ?? max) - got);
    addLot(state.stores.food, yd.foodKind, got);
    food += got;
  }
  ledger(state, 'food', food, 'village.gather');
  ctx.state.work.reports[ctx.state.work.reports.length - 1]!.lines.push({
    key: 'line.village',
    params: { wood: Math.round(wood), food: Math.round(food) },
  });
}

export function consume(ctx: RunCtx): void {
  const { def, state } = ctx;
  const d = days(def);
  const r = def.balance.ration;
  const people = living(state).sort(byId);
  const need = people.reduce((a, p) => a + dailyFood(def, state, p), 0) * d;
  if (need <= 0) return;
  const cap = Math.min(1, stat(def, state, 'ration.cap'));
  const have = totalKg(state.stores.food);
  let ratio: number;
  if (have >= need * cap) ratio = cap;
  else if (have >= need * r.reduced) ratio = r.reduced;
  else ratio = have / need;
  const eaten = eat(def, state.stores.food, need * ratio, monthDef(def, state).temp);
  ledger(state, 'food', -eaten, 'upkeep.food');

  const stage = ratio >= 1 - 1e-9 ? 0 : ratio >= r.reduced - 1e-9 ? 1 : 2;
  if (stage !== state.hungerStage) {
    state.work.notable = true;
    state.work.reports[state.work.reports.length - 1]!.lines.push({ key: `line.hunger.${stage}` });
  }
  state.hungerStage = stage;
  for (const p of people) {
    if (stage === 0) p.hungerDays = Math.max(0, p.hungerDays - r.recoverPerPhase);
    else p.hungerDays += d * (1 - ratio);
  }
  addCohesion(state, def, r.cohesionPerPhase[stage] ?? 0);
}

export function burnFirewood(ctx: RunCtx): void {
  const { def, state } = ctx;
  const burn = firewoodPerDay(def, state) * days(def);
  if (state.stores.firewood >= burn) {
    state.stores.firewood -= burn;
    ledger(state, 'firewood', -burn, 'upkeep.firewood');
    return;
  }
  const short = burn > 0 ? 1 - state.stores.firewood / burn : 0;
  ledger(state, 'firewood', -state.stores.firewood, 'upkeep.firewood');
  state.stores.firewood = 0;
  const c = def.balance.cold;
  state.work.reports[state.work.reports.length - 1]!.lines.push({ key: 'line.cold' });
  state.work.notable = true;
  addCohesion(state, def, c.cohesion * short);
  for (const p of living(state).sort(byId)) {
    if (!isVulnerable(def, state, p)) continue;
    if (chance(state.rng, short * c.deathChance)) killPerson(ctx, p, 'cold');
    else if (p.ailments.length === 0 && chance(state.rng, short * c.sickChance)) injurePerson(ctx, p, c.sickness, 2);
  }
}

export function spoilFood(ctx: RunCtx): void {
  const { def, state } = ctx;
  const temp = monthDef(def, state).temp;
  const mul = stat(def, state, 'spoil.mul');
  const lost = spoil(def, state.stores.food, temp, mul);
  ledger(state, 'food', -lost, 'spoil');
  spoil(def, state.work.haul, temp, mul);
  for (const c of state.caches) spoil(def, c.lots, temp, mul * def.balance.cache.spoilMul);
}

export function health(ctx: RunCtx): void {
  const { def, state } = ctx;
  const r = def.balance.ration;
  const now = phaseNo(state);
  for (const p of living(state).sort(byId)) {
    // 회복
    const healed = p.ailments.filter((a) => a.healsAt <= now);
    if (healed.length > 0) {
      p.ailments = p.ailments.filter((a) => a.healsAt > now);
      for (const a of healed)
        state.work.reports[state.work.reports.length - 1]!.lines.push({ key: 'line.healed', params: { name: p.name, ailment: { key: `ailment.${a.kind}` } } });
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
  chores(ctx);
  consume(ctx);
  burnFirewood(ctx);
  spoilFood(ctx);
  health(ctx);
}
