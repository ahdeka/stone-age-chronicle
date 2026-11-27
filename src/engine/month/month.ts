// 한 달의 상태 기계 (DESIGN.md §4)
//
// 월초(startMonth) → [월초 사건 결정] → 전략 고르기(choosePlan: 식량 + 발전, 또는 큰 일)
//   → 상순 → 중순 → 하순 → 정산 을 다음 결정 지점까지 미리 계산한다 (run)
//   순마다: 식량(또는 큰 일)의 단계 → 발전의 단계 → 마을 소식 → 마을 살림. 중간 사건은 한 순에 하나
//   → 결정 지점(중간 사건, 남은 고기 처리)에서 멈춘다 → chooseOption → 이어서 계산
// 정산 뒤 nextMonth → 다음 달 월초
//
// "계속" 버튼은 엔진 명령이 아니다. 화면이 work.reports를 하나씩 보여 줄 뿐이다.

import type { ChapterDefinition, EventSlot, FoodLot, GameState, Id, LedgerLine, Line, LineGroup, MonthWork, Phase, PhaseReport, PlanEntry, PolicyStep, SceneSpec, TurnInfo } from '../types';
import { isSeasonTurn, turnAt } from './turn';
import { ensureTech, payCellCost, settleTech } from '../tech/tech';
import { PHASES } from '../types';
import { allTrue, firewoodDays, foodDays, matchPerson } from '../conditions/evaluate';
import {
  addCohesion,
  applyEffects,
  applyNarrative,
  currentReport,
  grantKnowledge,
  ledger,
  pushLine,
  raiseFacility,
  type RunCtx,
} from '../effects/apply';
import { currentEntry, currentHaul, currentPlace, planCrew } from '../policy/current';
import { previewPlan } from '../policy/plan';
import { findEvent, findPlace, findPolicy, monthDef, nextUid } from '../core/lookup';
import { buildAdvice } from '../advice/advice';
import { buildBriefing, resolveSceneSpec } from './briefing';
import { briefingEventIds, markUsed, optionStatuses, personEventIds, pickEvent, villageEventIds } from '../events/events';
import { runActivity } from '../outcome/activity';
import { band, laborUnits, living, population } from '../people/people';
import { generateCandidates } from '../policy/candidates';
import { chance } from '../rng/rng';
import { stat } from '../stats/stats';
import { addLot, carryWeight, totalKg } from '../stores/food';
import { expireTemporary, recoverPlaces, rollWeather, updateAnimals, updateCaches } from '../world/world';
import { stageCohesion, upkeep } from './upkeep';
import { monthStartOf } from '../display';
import { checkEndings } from './endings';

export function freshWork(weather: [Id, Id, Id], start: MonthWork['start'], turn: TurnInfo = { kind: 'month', months: 1, stage: 0, firstMonth: 0 }): MonthWork {
  return {
    turn,
    candidates: [],
    plan: [],
    planIndex: 0,
    weather,
    phasesDone: 0,
    stepIndex: 0,
    haul: [],
    reports: [],
    ledger: [],
    deaths: [],
    tiers: [],
    events: [],
    notable: false,
    vars: {},
    savings: [],
    villageChecked: false,
    start,
    advice: [],
    maxHunger: 0,
  };
}

/** 새 단계 보고를 연다 */
function openReport(state: GameState, slot: PhaseReport['slot'], scene: SceneSpec, extra: Partial<PhaseReport> = {}): PhaseReport {
  const r: PhaseReport = {
    slot,
    scene,
    lines: [],
    deltas: {},
    rows: [],
    alerts: [],
    from: { food: totalKg(state.stores.food), firewood: state.stores.firewood },
    ...extra,
  };
  state.work.reports.push(r);
  return r;
}

function closeReport(state: GameState): void {
  const r = state.work.reports[state.work.reports.length - 1];
  if (r) r.to = { food: totalKg(state.stores.food), firewood: state.stores.firewood };
}

/** 전략의 줄이 속할 무리: 발전 → 'growth', 원정 → 'crew', 그 밖은 'village' */
function entryGroup(def: ChapterDefinition, e: PlanEntry | undefined): LineGroup {
  if (!e) return 'village';
  if (e.slot === 'growth') return 'growth';
  const p = findPolicy(def, e.bound.policyId);
  return e.bound.crew.length > 0 && !p.crew?.atHome ? 'crew' : 'village';
}

/** 지금 진행 맥락 (지금 단계를 실행하는 전략의 무리와 이끄는 사람) */
export function runCtx(def: ChapterDefinition, state: GameState, extraActors: Record<string, Id> = {}, source?: string, group?: LineGroup): RunCtx {
  const e = currentEntry(state);
  const chosen = e?.bound;
  return {
    def,
    state,
    actors: { ...(chosen?.leaderId ? { leader: chosen.leaderId } : {}), ...extraActors },
    crew: chosen?.crew ?? [],
    source: source ?? (chosen ? `policy.${chosen.policyId}` : 'month'),
    group: group ?? entryGroup(def, e),
  };
}

// ── 월초 ──

/** 달이 바뀔 때 세계가 움직인다: 날씨, 임시 효과, 짐승, 땅의 회복, 묻은 것 */
function worldMonth(def: ChapterDefinition, state: GameState): void {
  state.work.weather = rollWeather(def, state);
  expireTemporary(state);
  updateAnimals(def, state);
  recoverPlaces(def, state);
  updateCaches(def, state);
}

const bandsOf = (def: ChapterDefinition, state: GameState) => new Map(living(state).map((p) => [p.id, band(def, state, p)]));

/** 나이 구간이 바뀐 사람의 줄 ("이제 어른이 되었다") */
function grewLines(def: ChapterDefinition, state: GameState, prev: Map<Id, string>): Line[] {
  const out: Line[] = [];
  for (const p of living(state)) {
    const b = band(def, state, p);
    if (prev.get(p.id) !== b) out.push({ key: `line.grew.${b}`, params: { name: p.name }, group: 'people' });
  }
  return out;
}

/** 새 턴을 연다: 첫 달의 월초 보고, 전략 후보, 조언, 월초 사건 (달 턴과 계절 턴 공통) */
export function startTurn(def: ChapterDefinition, state: GameState): void {
  const prevBands = bandsOf(def, state);
  const turn = turnAt(def, state, state.month + 1);
  state.month += 1;
  state.turn += 1;
  state.work = freshWork(['', '', ''], monthStartOf(def, state), turn);
  worldMonth(def, state);
  // 발전 나무: 칸 상태를 만들고 맞춘다 (새 칸, 바위굴로 옮겨 열린 칸 등)
  ensureTech(def, state);

  const brief = buildBriefing(def, state);
  state.work.brief = brief;
  openReport(state, 'briefing', brief.scene, { lines: [brief.headline, ...brief.news] });
  currentReport(state).lines.push(...grewLines(def, state, prevBands));
  // 거처와 겨울의 기록 (시대 목표 측정용)
  state.work.candidates = generateCandidates(def, state);
  state.work.advice = buildAdvice(def, state);
  state.step = 'policy';

  // 기억: 기한이 된 예약 사건. 계절 턴은 지난 철의 둘째·셋째 달에 기한이 끝난 것도 본다 (그 달에는 월초 보고가 없었다)
  const lookBehind = turn.kind === 'season' ? def.balance.turn.maxSeasonMonths - 1 : 0;
  const due = state.scheduled.filter((x) => x.from <= state.month);
  for (const x of due) {
    if (x.to < state.month - lookBehind) {
      state.scheduled = state.scheduled.filter((y) => y.uid !== x.uid);
      continue;
    }
    if (!allTrue(def, state, x.when)) continue;
    const picked = pickEvent(def, state, 'briefing', [x.event], {});
    if (!picked) continue;
    state.scheduled = state.scheduled.filter((y) => y.uid !== x.uid);
    openEvent(def, state, picked.event.id, 'briefing', picked.actors);
    break;
  }
  // 월초 사건 (애도 등): 예약 사건이 없을 때
  if (state.step === 'policy') {
    const picked = pickEvent(def, state, 'briefing', briefingEventIds(def), {});
    if (picked) openEvent(def, state, picked.event.id, 'briefing', picked.actors);
  }
}

// ── 사건 ──

function openEvent(def: ChapterDefinition, state: GameState, eventId: Id, slot: EventSlot, actors: Record<string, Id>): void {
  const ev = findEvent(def, eventId);
  markUsed(state, ev);
  state.work.events.push(ev.id);
  state.work.notable = true;
  if (slot !== 'briefing') state.work.lastEventPhase = state.work.phasesDone;
  state.work.decision = { uid: nextUid(state, 'd'), kind: 'event', eventId, slot, actors };
  currentReport(state).lines.push({ key: `event.${ev.id}.title`, group: 'event' });
  state.step = 'decision';
}

// ── 방침 실행 ──

/** 이번 달 전략을 정한다: 식량 1개 + 발전 0~1개, 또는 큰 일 1개 (후보 uid) */
export function choosePlan(def: ChapterDefinition, state: GameState, uids: readonly Id[]): string | undefined {
  if (state.step !== 'policy') return 'error.wrongStep';
  const preview = previewPlan(def, state, uids);
  if (preview.error) return preview.error;
  state.work.plan = preview.entries;
  for (const e of preview.entries) {
    const p = findPolicy(def, e.bound.policyId);
    if (p.cooldown > 0) state.cooldowns[p.id] = state.turn + p.cooldown;
    if (p.once) state.usedOnce.push(p.id);
    // 발전 칸: 처음 시작하는 턴에 비용을 낸다
    if (p.tech) payCellCost(runCtx(def, state, {}, `tech.${p.tech}`, 'growth'), p.tech);
  }
  run(def, state);
  return undefined;
}

/** 진행 장면: 주 전략의 장면과 곳 */
function resolveScene(def: ChapterDefinition, state: GameState, weather: Id): SceneSpec {
  const main = state.work.plan[0];
  const p = main ? findPolicy(def, main.bound.policyId) : undefined;
  return resolveSceneSpec(def, state, p?.scene ?? def.scenes.briefing, main?.place ?? state.campPlace, weather);
}

/** 이번 턴에 더 열 수 있는 결정 사건 수가 남았는가 */
function eventRoom(def: ChapterDefinition, state: GameState): boolean {
  const max = isSeasonTurn(state) ? def.balance.turn.eventsPerSeason : def.balance.events.maxPerMonth;
  return state.work.events.length < max;
}

/** 단계 하나를 실행한다. 결정 지점이면 true (멈춤) */
function execStep(def: ChapterDefinition, state: GameState, step: PolicyStep, phase: Phase): boolean {
  const ctx = runCtx(def, state);
  switch (step.kind) {
    case 'narrate':
      if (step.narrative) applyNarrative(ctx, step.narrative);
      applyEffects(ctx, step.effects);
      return false;
    case 'activity':
      runActivity(ctx, step.activity);
      return false;
    case 'eventWindow': {
      if (!eventRoom(def, state)) return false;
      // 한 순에 사건 하나: 식량 칸이 먼저 굴리고, 안 나왔으면 발전 칸
      if (state.work.lastEventPhase === state.work.phasesDone && def.balance.events.maxPerPhase <= 1) return false;
      if (!chance(state.rng, step.chance)) return false;
      const picked = pickEvent(def, state, phase, step.pool, ctx.actors as Record<string, Id>);
      if (!picked) return false;
      openEvent(def, state, picked.event.id, phase, picked.actors);
      return true;
    }
    case 'carry':
      return carry(def, state);
  }
}

/** 원정지의 짐을 마을로 옮긴다. 남은 양이 많으면 처리 결정을 묻는다 (DESIGN.md §3.3) */
export function carry(def: ChapterDefinition, state: GameState): boolean {
  const w = state.work;
  const haul = currentHaul(state);
  if (haul.length === 0) return false;
  const ctx = runCtx(def, state);
  const crewN = ctx.crew.filter((id) => state.people[id]?.alive).length;
  const place = findPlace(def, currentPlace(state) ?? state.campPlace);
  const trips = place.travelDays <= def.balance.carry.multiTripMaxDays ? def.balance.carry.maxTrips : 1;
  let cap = crewN > 0 ? crewN * stat(def, state, 'carry.perPerson') * trips : Infinity;

  const lots = haul.slice().sort((a, b) => carryWeight(def, { kind: a.kind, kg: 1 }) - carryWeight(def, { kind: b.kind, kg: 1 }));
  let carried = 0;
  for (const lot of lots) {
    const per = carryWeight(def, { kind: lot.kind, kg: 1 });
    const take = per > 0 ? Math.min(lot.kg, cap / per) : lot.kg;
    if (take <= 0) continue;
    addLot(state.stores.food, lot.kind, take);
    lot.kg -= take;
    cap -= take * per;
    carried += take;
  }
  setHaul(state, haul.filter((l) => l.kg > 1e-6));
  ledger(state, 'food', carried, ctx.source);
  const left = totalKg(currentHaul(state));
  w.vars['carried'] = Math.round(carried);
  w.vars['trips'] = trips;
  w.vars['left'] = Math.round(left);
  pushLine(ctx, trips > 1 ? 'line.carry.trips' : 'line.carry', {});
  if (left <= 0) return false;
  if (left < def.balance.carry.askLeftoverKg) {
    setHaul(state, []);
    return false;
  }
  // 계절 턴: 남은 고기는 묻지 않고 끝자락에서 처리한다 (DESIGN.md §B5.1. 1년차의 처리 팝업은 1년차 전용)
  if (isSeasonTurn(state)) {
    resolveLeftover(def, state, AUTO_LEFTOVER.find((o) => leftoverAvailable(def, state, o)) ?? 'abandon', true);
    return false;
  }
  w.decision = { uid: nextUid(state, 'd'), kind: 'leftover', kg: left };
  pushLine(ctx, 'line.carry.left', {});
  state.step = 'decision';
  return true;
}

/** 지금 전략의 짐을 바꾼다 (전략이 없으면 따로 두는 짐) */
function setHaul(state: GameState, lots: FoodLot[]): void {
  const e = currentEntry(state);
  if (e) e.haul = lots;
  else state.work.haul = lots;
}

export const LEFTOVER_OPTIONS = ['porters', 'cache', 'dry', 'abandon'] as const;
/** 계절 턴에서 남은 고기를 저절로 처리하는 순서: 말린다 → 짐꾼을 부른다 → 두고 온다 (묻기는 고르는 사람이 있을 때만) */
const AUTO_LEFTOVER = ['dry', 'porters', 'abandon'] as const;

/** 짐꾼으로 부를 수 있는 마을 사람 수 (원정대 밖의 일할 수 있는 사람) */
function porterCount(def: ChapterDefinition, state: GameState): number {
  const away = planCrew(state);
  const home = living(state).filter((p) => !away.has(p.id) && laborUnits(def, state, p) >= 1).length;
  return Math.min(def.balance.carry.porters, home);
}

export function leftoverAvailable(def: ChapterDefinition, state: GameState, id: string): boolean {
  if (id === 'dry') return state.knowledge.has.includes(def.balance.carry.dryKnowledge);
  if (id === 'porters') {
    const place = findPlace(def, currentPlace(state) ?? state.campPlace);
    return place.travelDays <= def.balance.carry.portersMaxDays && porterCount(def, state) > 0;
  }
  return (LEFTOVER_OPTIONS as readonly string[]).includes(id);
}

/** auto: 계절 턴의 저절로 처리 (고른 사람이 없으니 두고 와도 결속이 떨어지지 않는다) */
function resolveLeftover(def: ChapterDefinition, state: GameState, optionId: string, auto = false): void {
  const ctx = runCtx(def, state);
  const b = def.balance.carry;
  const haul = currentHaul(state);
  const kg = totalKg(haul);
  if (optionId === 'porters') {
    // 마을에서 사람을 불러 나른다: 나를 수 있는 만큼만, 그동안 마을 일이 준다 (DESIGN.md §15.3 S10)
    const n = porterCount(def, state);
    // 짐꾼 몫은 발전 칸(천막 보수의 물가 야영, 끌개)이 늘린다: carry.porterMul
    let cap = n * stat(def, state, 'carry.perPerson') * b.porterTrips * stat(def, state, 'carry.porterMul');
    let moved = 0;
    for (const lot of haul) {
      const per = carryWeight(def, { kind: lot.kind, kg: 1 });
      const take = per > 0 ? Math.min(lot.kg, cap / per) : lot.kg;
      addLot(state.stores.food, lot.kind, take);
      cap -= take * per;
      moved += take;
    }
    ledger(state, 'food', moved, 'leftover.porters');
    state.modifiers.push({ mod: { stat: 'yield.wood', op: 'mul', value: b.porterVillageMul }, until: state.month, source: 'leftover.porters' });
    state.modifiers.push({ mod: { stat: 'yield.gather', op: 'mul', value: b.porterVillageMul }, until: state.month, source: 'leftover.porters' });
    pushLine(ctx, 'line.leftover.porters', { n, kg: Math.round(moved) });
    const lost = kg - moved;
    if (lost >= 1) pushLine(ctx, 'line.leftover.abandon', { kg: Math.round(lost) });
    if (auto && lost > 0) state.work.leftBehind = (state.work.leftBehind ?? 0) + lost;
  } else if (optionId === 'cache') {
    const place = currentPlace(state) ?? state.campPlace;
    state.caches.push({ id: nextUid(state, 'k'), place, lots: haul, month: state.month, scent: 0, checkedMonth: state.month });
    state.work.notable = true;
    pushLine(ctx, 'line.leftover.cache', { kg: Math.round(kg) });
  } else if (optionId === 'dry') {
    const dried = kg * b.dryYield;
    addLot(state.stores.food, b.dryKind, dried);
    ledger(state, 'food', dried, 'leftover.dry');
    pushLine(ctx, 'line.leftover.dry', { kg: Math.round(dried) });
  } else {
    if (!auto) addCohesion(state, def, b.abandonCohesion, 'leftover.abandon');
    else state.work.leftBehind = (state.work.leftBehind ?? 0) + kg;
    pushLine(ctx, 'line.leftover.abandon', { kg: Math.round(kg) });
  }
  setHaul(state, []);
}

export function chooseOption(def: ChapterDefinition, state: GameState, uid: Id, optionId: Id): string | undefined {
  const d = state.work.decision;
  if (state.step !== 'decision' || !d) return 'error.wrongStep';
  if (d.uid !== uid) return 'error.unknownDecision';

  if (d.kind === 'leftover') {
    if (!leftoverAvailable(def, state, optionId)) return 'error.optionLocked';
    delete state.work.decision;
    resolveLeftover(def, state, optionId);
    run(def, state);
    return undefined;
  }

  const ev = findEvent(def, d.eventId);
  const st = optionStatuses(def, state, ev, d.actors).find((s) => s.option.id === optionId);
  if (!st) return 'error.unknownOption';
  if (!st.available) return 'error.optionLocked';
  delete state.work.decision;
  const ctx = runCtx(def, state, d.actors, `event.${ev.id}`, 'event');
  currentReport(state).lines.push({ key: 'line.chose', params: { option: { key: `event.${ev.id}.opt.${optionId}` } }, group: 'event' });
  if (st.option.narrative) applyNarrative(ctx, st.option.narrative);
  applyEffects(ctx, st.option.effects);
  if (st.option.activity) runActivity(ctx, st.option.activity);

  if (d.slot === 'briefing') {
    state.step = 'policy';
    // 월초 사건의 결과로 상황이 바뀌었을 수 있다
    state.work.candidates = generateCandidates(def, state);
    state.work.advice = buildAdvice(def, state);
    return undefined;
  }
  run(def, state);
  return undefined;
}

/** 원정이 아닌 전략 (무리가 없거나 마을 안에서 일하는 무리) */
function staysHome(def: ChapterDefinition, e: PlanEntry): boolean {
  const p = findPolicy(def, e.bound.policyId);
  return !p.crew || !!p.crew.atHome;
}

/** 전략마다 이 단계의 걸음을 실행한다 (식량 또는 큰 일 → 발전). 결정 지점이면 true (멈춤, 다시 부르면 이어서) */
function runPlanSteps(def: ChapterDefinition, state: GameState, phase: Phase): boolean {
  const w = state.work;
  while (w.planIndex < w.plan.length) {
    w.active = w.planIndex;
    const steps = findPolicy(def, w.plan[w.planIndex]!.bound.policyId).steps[phase] ?? [];
    while (w.stepIndex < steps.length) {
      const step = steps[w.stepIndex]!;
      w.stepIndex += 1;
      if (!allTrue(def, state, step.when, runCtx(def, state).actors)) continue;
      if (execStep(def, state, step, phase)) return true;
    }
    w.planIndex += 1;
    w.stepIndex = 0;
  }
  delete w.active;
  return false;
}

/** 진행 장면이 벌어지는 곳: 원정이면 원정지, 아니면 거처 */
function reportPlace(def: ChapterDefinition, state: GameState): Id {
  const main = state.work.plan[0];
  return main && !staysHome(def, main) ? (main.place ?? state.campPlace) : state.campPlace;
}

/** 하순(계절 턴은 끝자락의 마지막 순): 운반하지 않은 짐은 그대로 들고 온다 (원정이 아닌 전략, 전략 밖의 짐) */
function bringHomeAll(def: ChapterDefinition, state: GameState): void {
  const w = state.work;
  for (const e of w.plan) {
    if (!staysHome(def, e) || e.haul.length === 0) continue;
    bringHome(state, e.haul, `policy.${e.bound.policyId}`);
    e.haul = [];
  }
  if (w.haul.length > 0) {
    bringHome(state, w.haul, runCtx(def, state).source);
    w.haul = [];
  }
}

/** 다음 결정 지점이나 정산까지 진행한다 */
export function run(def: ChapterDefinition, state: GameState): void {
  state.step = 'policy';
  if (isSeasonTurn(state)) runSeason(def, state);
  else runMonth(def, state);
}

/** 계절 턴 (DESIGN.md §B2.3): 단계 = 달. 단계마다 그 달 첫 순에 전략의 걸음을 실행하고 순 셋의 살림을 돈다.
 *  둘째·셋째 달의 월초 처리(날씨, 짐승, 나이)는 보고 화면 없이 조용히 돈다. 인물 사건 창은 한가운데에만 */
function runSeason(def: ChapterDefinition, state: GameState): void {
  const w = state.work;
  const t = w.turn;
  while (t.stage < t.months) {
    const phase = PHASES[t.stage] ?? 'late';
    const last = t.stage === t.months - 1;
    if (w.reports.length < 2 + t.stage) {
      // 둘째·셋째 달: 조용한 월초
      const grew = t.stage > 0 ? silentMonth(def, state) : [];
      openReport(state, phase, resolveScene(def, state, w.weather[0] ?? ''), { weather: w.weather[0] ?? '', place: reportPlace(def, state), month: state.month });
      currentReport(state).lines.push(...grew);
      w.planIndex = 0;
      w.stepIndex = 0;
      w.stageSteps = false;
      w.stageHunger = 0;
      w.stageStart = { foodKg: totalKg(state.stores.food), foodDays: foodDays(def, state), firewood: state.stores.firewood, firewoodDays: firewoodDays(def, state) };
    }
    if (!w.stageSteps) {
      if (runPlanSteps(def, state, phase)) return;
      w.stageSteps = true;
    }
    // 한가운데: 인물 사건 창 (철마다 하나. 고르는 순서는 R3, §B5.1)
    if (phase === 'mid' && !w.villageChecked) {
      w.villageChecked = true;
      if (eventRoom(def, state)) {
        const picked = pickEvent(def, state, 'mid', personEventIds(def), runCtx(def, state).actors as Record<string, Id>);
        if (picked) {
          openEvent(def, state, picked.event.id, 'mid', picked.actors);
          return;
        }
      }
    }
    while (w.phasesDone < 3) {
      if (last && w.phasesDone === 2) bringHomeAll(def, state);
      upkeep(runCtx(def, state));
      w.phasesDone += 1;
      if (population(state) === 0) break;
    }
    if (population(state) > 0) stageCohesion(def, state, w.stageHunger ?? 0);
    closeReport(state);
    monthEnd(def, state, w.stageHunger ?? 0);
    if (population(state) === 0) break;
    if (last) break;
    t.stage += 1;
    w.phasesDone = 0;
  }
  settle(def, state);
}

/** 계절 턴의 둘째·셋째 달을 연다 (보고 화면 없음). 나이 구간이 바뀐 사람의 줄을 돌려준다 */
function silentMonth(def: ChapterDefinition, state: GameState): Line[] {
  const prev = bandsOf(def, state);
  state.month += 1;
  worldMonth(def, state);
  return grewLines(def, state, prev);
}

/** 달 턴 (1년차): 상순 → 중순 → 하순 */
function runMonth(def: ChapterDefinition, state: GameState): void {
  const w = state.work;
  while (w.phasesDone < 3) {
    const phase = PHASES[w.phasesDone]!;
    if (w.reports.length < 2 + w.phasesDone) {
      openReport(state, phase, resolveScene(def, state, w.weather[w.phasesDone] ?? ''), {
        weather: w.weather[w.phasesDone] ?? '',
        place: reportPlace(def, state),
      });
      w.planIndex = 0;
      w.stepIndex = 0;
    }
    if (runPlanSteps(def, state, phase)) return;
    // 마을 소식 (방침과 무관한 사건) — 중순에 한 번 판정
    if (phase === 'mid' && !w.villageChecked) {
      w.villageChecked = true;
      // 이미 사건이 있었던 달에는 마을 소식을 더하지 않는다 (한 달 0~1개, 드물게 2개)
      if (w.events.length === 0 && chance(state.rng, def.balance.events.villageChancePerMonth)) {
        const picked = pickEvent(def, state, 'mid', villageEventIds(def), runCtx(def, state).actors as Record<string, Id>);
        if (picked) {
          openEvent(def, state, picked.event.id, 'mid', picked.actors);
          return;
        }
      }
    }
    if (phase === 'late') bringHomeAll(def, state);
    upkeep(runCtx(def, state));
    closeReport(state);
    w.phasesDone += 1;
    if (population(state) === 0) break;
  }
  monthEnd(def, state, w.maxHunger);
  settle(def, state);
}

function bringHome(state: GameState, lots: FoodLot[], source: string): void {
  for (const l of lots) addLot(state.stores.food, l.kind, l.kg);
  ledger(state, 'food', totalKg(lots), source);
}

// ── 정산 ──

/** 달마다의 기록 (계절 턴은 단계마다): 거처에서 지낸 달, 굶주림 없이 지낸 겨울 달 (시대 목표 측정용).
 *  maxHunger는 그 달에 겪은 가장 깊은 굶주림 단계 */
function monthEnd(def: ChapterDefinition, state: GameState, maxHunger: number): void {
  const shelterKey = `shelter_months.${state.shelter.kind}`;
  state.counters[shelterKey] = (state.counters[shelterKey] ?? 0) + 1;
  if (monthDef(def, state).season === 'winter') {
    const streak = maxHunger === 0 ? (state.counters['winter_fed_streak'] ?? 0) + 1 : 0;
    state.counters['winter_fed_streak'] = streak;
    if (streak >= 3 && state.flags['winter_fed_full'] === undefined) state.flags['winter_fed_full'] = state.month;
  } else state.counters['winter_fed_streak'] = 0;
}

function settle(def: ChapterDefinition, state: GameState): void {
  const w = state.work;
  const ctx = runCtx(def, state, {}, 'settlement', 'info');
  const report = openReport(state, 'settlement', def.scenes.settlement, { from: { food: w.start.food, firewood: w.start.firewood } });

  // 남은 짐은 버린다 (처리 결정 없이 끝난 경우)
  w.haul = [];
  for (const e of w.plan) e.haul = [];

  const policies = w.plan.map((e) => findPolicy(def, e.bound.policyId));
  const policy = policies[0];
  // 지식은 행동에서 자란다 (두 칸 모두)
  for (const p of policies) {
    for (const [k, n] of Object.entries(p.knowledgeProgress ?? {})) {
      if (state.knowledge.has.includes(k)) continue;
      state.knowledge.progress[k] = (state.knowledge.progress[k] ?? 0) + n;
    }
  }
  // 짓는 일: 고른 달마다 공사가 한 달씩 나아간다
  for (const p of policies) {
    if (!p.builds) continue;
    const id = p.builds.facility;
    const done = (state.projects[id] ?? 0) + 1;
    if (done >= p.builds.months) {
      delete state.projects[id];
      raiseFacility(ctx, id, 1);
    } else state.projects[id] = done;
  }
  for (const k of def.knowledge) {
    if (!state.knowledge.has.includes(k.id) && (state.knowledge.progress[k.id] ?? 0) >= k.need) grantKnowledge(ctx, k.id);
  }
  // 발전 나무: 고른 칸의 진척, 이어 가던 칸, 신석기 (§B3, §B4.4)
  settleTech({ ...ctx, group: 'growth' });

  // 결속이 낮은 채 넘긴 턴 (분열 판정): 달 턴 1, 계절 턴 1.5 — 결말 계수 3 = 석 달 또는 철 둘 (§B6.4)
  const low = state.cohesion < def.balance.cohesion.lowThreshold;
  state.counters['low_cohesion_months'] = low ? (state.counters['low_cohesion_months'] ?? 0) + def.balance.cohesion.lowWeight[w.turn.kind] : 0;

  // 정산표: 이번 달 장부를 출처별로 합친다 (원정지의 짐은 빼고)
  report.rows = sumLedger(w.ledger.filter((l) => l.res !== 'haul'));
  report.savings = w.savings.map((x) => ({ ...x }));
  report.to = { food: totalKg(state.stores.food), firewood: state.stores.firewood };
  const lines = report.lines;
  // 계절 턴에서 다 메고 오지 못해 두고 온 고기 (이 철의 결과 글 한 줄)
  if ((w.leftBehind ?? 0) >= 1) lines.push({ key: 'line.season.leftBehind', params: { kg: Math.round(w.leftBehind!) }, group: 'info' });
  lines.push({
    key: 'settle.food',
    params: { from: Math.round(w.start.food), to: Math.round(totalKg(state.stores.food)), days: Math.floor(foodDays(def, state)) },
    group: 'info',
  });
  lines.push({ key: 'settle.firewood', params: { from: Math.round(w.start.firewood), to: Math.round(state.stores.firewood) }, group: 'info' });
  lines.push({ key: 'settle.population', params: { from: w.start.population, to: population(state) }, group: 'info' });

  // 연대기
  const m = monthDef(def, state);
  const entry = w.chronicle ?? (policy ? { key: 'chron.policy', importance: 0, params: { policy: { key: `policy.${policy.id}.name` } } } : undefined);
  if (entry) state.chronicle.push({ month: state.month, monthId: m.id, key: entry.key, ...(entry.params ? { params: entry.params } : {}) });

  // 평온한 달 판정은 1년차만 (§B8: 계절 턴에는 인물 사건이 늘 있다)
  const quiet = !isSeasonTurn(state) && !w.notable && w.events.length === 0 && w.deaths.length === 0 && w.tiers.every((t) => t === 'success' || t === 'triumph');
  state.history.push({
    month: state.month,
    monthId: m.id,
    turn: state.turn,
    kind: w.turn.kind,
    firstMonth: w.turn.firstMonth,
    policyIds: policies.map((p) => p.id),
    reports: w.reports,
    ledger: w.ledger,
    quiet,
  });

  state.step = 'settlement';
  const ending = checkEndings(def, state);
  if (ending) {
    state.ending = { id: ending.id, kind: ending.kind, month: state.month };
    state.chronicle.push({ month: state.month, monthId: m.id, key: `ending.${ending.id}.chron` });
    state.step = 'ended';
  }
}

/** 같은 자원·출처의 행을 합친다 (숫자 변수도 더한다) */
export function sumLedger(lines: readonly LedgerLine[]): LedgerLine[] {
  const out: LedgerLine[] = [];
  for (const l of lines) {
    const row = out.find((x) => x.res === l.res && x.source === l.source && Math.sign(x.delta) === Math.sign(l.delta));
    if (!row) {
      out.push({ ...l, ...(l.params ? { params: { ...l.params } } : {}) });
      continue;
    }
    row.delta += l.delta;
    if (l.params) {
      row.params ??= {};
      for (const [k, v] of Object.entries(l.params)) row.params[k] = (row.params[k] ?? 0) + v;
    }
  }
  return out;
}

/** 정산을 다 봤다 → 다음 턴 (달 턴이면 다음 달, 계절 턴이면 다음 철) */
export function nextMonth(def: ChapterDefinition, state: GameState): string | undefined {
  if (state.step !== 'settlement') return 'error.wrongStep';
  startTurn(def, state);
  return undefined;
}

/** 디버그: 지금 사건을 강제로 띄운다 (방침 선택 전에만) */
export function forceEvent(def: ChapterDefinition, state: GameState, eventId: Id): string | undefined {
  if (state.step !== 'policy') return 'error.wrongStep';
  const ev = def.content.events.find((e) => e.id === eventId);
  if (!ev) return 'error.unknownEvent';
  const actors: Record<string, Id> = {};
  for (const [slot, q] of Object.entries(ev.actors ?? {})) {
    const pool = q.alive === false ? Object.values(state.people) : living(state);
    const p = pool.find((x) => matchPerson(def, state, x, q));
    if (!p) return 'error.noActor';
    actors[slot] = p.id;
  }
  openEvent(def, state, ev.id, 'briefing', actors);
  return undefined;
}
