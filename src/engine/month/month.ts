// 한 달의 상태 기계 (DESIGN.md §4)
//
// 월초(startMonth) → [월초 사건 결정] → 방침 선택(choosePolicy)
//   → 상순 → 중순 → 하순 → 정산 을 다음 결정 지점까지 미리 계산한다 (run)
//   → 결정 지점(중간 사건, 남은 고기 처리)에서 멈춘다 → chooseOption → 이어서 계산
// 정산 뒤 nextMonth → 다음 달 월초
//
// "계속" 버튼은 엔진 명령이 아니다. 화면이 work.reports를 하나씩 보여 줄 뿐이다.

import type { ChapterDefinition, EventSlot, GameState, Id, LedgerLine, LineGroup, MonthWork, Phase, PhaseReport, PolicyStep, SceneSpec } from '../types';
import { PHASES } from '../types';
import { allTrue, foodDays, matchPerson } from '../conditions/evaluate';
import {
  addCohesion,
  applyEffects,
  applyNarrative,
  currentReport,
  grantKnowledge,
  ledger,
  pushLine,
  type RunCtx,
} from '../effects/apply';
import { findEvent, findPlace, findPolicy, monthDef, nextUid } from '../core/lookup';
import { buildAdvice } from '../advice/advice';
import { buildBriefing, resolveSceneSpec } from './briefing';
import { markUsed, optionStatuses, pickEvent, villageEventIds } from '../events/events';
import { runActivity } from '../outcome/activity';
import { band, laborUnits, living, population } from '../people/people';
import { generateCandidates } from '../policy/candidates';
import { chance } from '../rng/rng';
import { stat } from '../stats/stats';
import { addLot, carryWeight, totalKg } from '../stores/food';
import { expireTemporary, recoverPlaces, rollWeather, updateAnimals, updateCaches } from '../world/world';
import { upkeep } from './upkeep';
import { checkEndings } from './endings';

export function freshWork(weather: [Id, Id, Id], start: MonthWork['start']): MonthWork {
  return {
    candidates: [],
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

/** 지금 진행 맥락 (방침의 원정대와 이끄는 사람) */
export function runCtx(def: ChapterDefinition, state: GameState, extraActors: Record<string, Id> = {}, source?: string, group?: LineGroup): RunCtx {
  const chosen = state.work.chosen;
  return {
    def,
    state,
    actors: { ...(chosen?.leaderId ? { leader: chosen.leaderId } : {}), ...extraActors },
    crew: chosen?.crew ?? [],
    source: source ?? (chosen ? `policy.${chosen.policyId}` : 'month'),
    group: group ?? (chosen && chosen.crew.length > 0 ? 'crew' : 'village'),
  };
}

// ── 월초 ──

export function startMonth(def: ChapterDefinition, state: GameState): void {
  const prevBands = new Map(living(state).map((p) => [p.id, band(def, state, p)]));
  state.month += 1;
  state.work = freshWork(['', '', ''], {
    food: totalKg(state.stores.food),
    firewood: state.stores.firewood,
    population: population(state),
  });
  state.work.weather = rollWeather(def, state);
  expireTemporary(state);
  updateAnimals(def, state);
  recoverPlaces(def, state);
  updateCaches(def, state);

  const brief = buildBriefing(def, state);
  state.work.brief = brief;
  openReport(state, 'briefing', brief.scene, { lines: [brief.headline, ...brief.news] });
  for (const p of living(state)) {
    const b = band(def, state, p);
    if (prevBands.get(p.id) !== b) currentReport(state).lines.push({ key: `line.grew.${b}`, params: { name: p.name }, group: 'people' });
  }
  // 거처와 겨울의 기록 (시대 목표 측정용)
  state.work.candidates = generateCandidates(def, state);
  state.work.advice = buildAdvice(def, state);
  state.step = 'policy';

  // 기억: 기한이 된 예약 사건
  const due = state.scheduled.filter((x) => x.from <= state.month);
  for (const x of due) {
    if (x.to < state.month) {
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
}

// ── 사건 ──

function openEvent(def: ChapterDefinition, state: GameState, eventId: Id, slot: EventSlot, actors: Record<string, Id>): void {
  const ev = findEvent(def, eventId);
  markUsed(state, ev);
  state.work.events.push(ev.id);
  state.work.notable = true;
  state.work.decision = { uid: nextUid(state, 'd'), kind: 'event', eventId, slot, actors };
  currentReport(state).lines.push({ key: `event.${ev.id}.title`, group: 'event' });
  state.step = 'decision';
}

// ── 방침 실행 ──

export function choosePolicy(def: ChapterDefinition, state: GameState, uid: Id): string | undefined {
  if (state.step !== 'policy') return 'error.wrongStep';
  const c = state.work.candidates.find((x) => x.uid === uid);
  if (!c) return 'error.unknownPolicy';
  const p = findPolicy(def, c.policyId);
  state.work.chosen = c;
  if (p.cooldown > 0) state.cooldowns[p.id] = state.month + p.cooldown;
  if (p.once) state.usedOnce.push(p.id);
  const place = c.place ?? p.place;
  if (place) state.work.place = place;
  run(def, state);
  return undefined;
}

function resolveScene(def: ChapterDefinition, state: GameState, phase: Phase): SceneSpec {
  const p = state.work.chosen ? findPolicy(def, state.work.chosen.policyId) : undefined;
  return resolveSceneSpec(def, state, p?.scene ?? def.scenes.briefing, state.work.place ?? state.campPlace, state.work.weather[PHASES.indexOf(phase)] ?? '');
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
      if (state.work.events.length >= def.balance.events.maxPerMonth) return false;
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
  if (w.haul.length === 0) return false;
  const ctx = runCtx(def, state);
  const crewN = ctx.crew.filter((id) => state.people[id]?.alive).length;
  const place = findPlace(def, w.place ?? state.campPlace);
  const trips = place.travelDays <= def.balance.carry.multiTripMaxDays ? def.balance.carry.maxTrips : 1;
  let cap = crewN > 0 ? crewN * stat(def, state, 'carry.perPerson') * trips : Infinity;

  const lots = w.haul.slice().sort((a, b) => carryWeight(def, { kind: a.kind, kg: 1 }) - carryWeight(def, { kind: b.kind, kg: 1 }));
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
  w.haul = w.haul.filter((l) => l.kg > 1e-6);
  ledger(state, 'food', carried, ctx.source);
  const left = totalKg(w.haul);
  w.vars['carried'] = Math.round(carried);
  w.vars['trips'] = trips;
  w.vars['left'] = Math.round(left);
  pushLine(ctx, trips > 1 ? 'line.carry.trips' : 'line.carry', {});
  if (left <= 0) return false;
  if (left < def.balance.carry.askLeftoverKg) {
    w.haul = [];
    return false;
  }
  w.decision = { uid: nextUid(state, 'd'), kind: 'leftover', kg: left };
  pushLine(ctx, 'line.carry.left', {});
  state.step = 'decision';
  return true;
}

export const LEFTOVER_OPTIONS = ['porters', 'cache', 'dry', 'abandon'] as const;

/** 짐꾼으로 부를 수 있는 마을 사람 수 (원정대 밖의 일할 수 있는 사람) */
function porterCount(def: ChapterDefinition, state: GameState): number {
  const away = new Set(state.work.chosen?.crew ?? []);
  const home = living(state).filter((p) => !away.has(p.id) && laborUnits(def, state, p) >= 1).length;
  return Math.min(def.balance.carry.porters, home);
}

export function leftoverAvailable(def: ChapterDefinition, state: GameState, id: string): boolean {
  if (id === 'dry') return state.knowledge.has.includes(def.balance.carry.dryKnowledge);
  if (id === 'porters') {
    const place = findPlace(def, state.work.place ?? state.campPlace);
    return place.travelDays <= def.balance.carry.portersMaxDays && porterCount(def, state) > 0;
  }
  return (LEFTOVER_OPTIONS as readonly string[]).includes(id);
}

function resolveLeftover(def: ChapterDefinition, state: GameState, optionId: string): void {
  const w = state.work;
  const ctx = runCtx(def, state);
  const b = def.balance.carry;
  const kg = totalKg(w.haul);
  if (optionId === 'porters') {
    // 마을에서 사람을 불러 나른다: 나를 수 있는 만큼만, 그동안 마을 일이 준다 (DESIGN.md §15.3 S10)
    const n = porterCount(def, state);
    let cap = n * stat(def, state, 'carry.perPerson') * b.porterTrips;
    let moved = 0;
    for (const lot of w.haul) {
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
  } else if (optionId === 'cache') {
    const place = w.place ?? state.campPlace;
    state.caches.push({ id: nextUid(state, 'k'), place, lots: w.haul, month: state.month, scent: 0, checkedMonth: state.month });
    state.work.notable = true;
    pushLine(ctx, 'line.leftover.cache', { kg: Math.round(kg) });
  } else if (optionId === 'dry') {
    const dried = kg * b.dryYield;
    addLot(state.stores.food, b.dryKind, dried);
    ledger(state, 'food', dried, 'leftover.dry');
    pushLine(ctx, 'line.leftover.dry', { kg: Math.round(dried) });
  } else {
    addCohesion(state, def, b.abandonCohesion);
    pushLine(ctx, 'line.leftover.abandon', { kg: Math.round(kg) });
  }
  w.haul = [];
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

/** 다음 결정 지점이나 정산까지 진행한다 */
export function run(def: ChapterDefinition, state: GameState): void {
  state.step = 'policy';
  const policy = state.work.chosen ? findPolicy(def, state.work.chosen.policyId) : undefined;
  while (state.work.phasesDone < 3) {
    const phase = PHASES[state.work.phasesDone]!;
    if (state.work.reports.length < 2 + state.work.phasesDone) {
      openReport(state, phase, resolveScene(def, state, phase), {
        weather: state.work.weather[state.work.phasesDone] ?? '',
        place: policy?.crew ? (state.work.place ?? state.campPlace) : state.campPlace,
      });
      state.work.stepIndex = 0;
    }
    const steps = policy?.steps[phase] ?? [];
    while (state.work.stepIndex < steps.length) {
      const step = steps[state.work.stepIndex]!;
      state.work.stepIndex += 1;
      if (!allTrue(def, state, step.when, runCtx(def, state).actors)) continue;
      if (execStep(def, state, step, phase)) return;
    }
    // 마을 소식 (방침과 무관한 사건) — 중순에 한 번 판정
    if (phase === 'mid' && !state.work.villageChecked) {
      state.work.villageChecked = true;
      // 이미 사건이 있었던 달에는 마을 소식을 더하지 않는다 (한 달 0~1개, 드물게 2개)
      if (state.work.events.length === 0 && chance(state.rng, def.balance.events.villageChancePerMonth)) {
        const picked = pickEvent(def, state, 'mid', villageEventIds(def), runCtx(def, state).actors as Record<string, Id>);
        if (picked) {
          openEvent(def, state, picked.event.id, 'mid', picked.actors);
          return;
        }
      }
    }
    // 하순 끝: 운반하지 않은 짐은 그대로 들고 온다 (원정대 없는 방침)
    if (phase === 'late' && state.work.haul.length > 0 && !(policy?.crew)) {
      for (const l of state.work.haul) addLot(state.stores.food, l.kind, l.kg);
      ledger(state, 'food', totalKg(state.work.haul), runCtx(def, state).source);
      state.work.haul = [];
    }
    upkeep(runCtx(def, state));
    closeReport(state);
    state.work.phasesDone += 1;
    if (population(state) === 0) break;
  }
  settle(def, state);
}

// ── 정산 ──

function settle(def: ChapterDefinition, state: GameState): void {
  const w = state.work;
  const ctx = runCtx(def, state, {}, 'settlement', 'info');
  const report = openReport(state, 'settlement', def.scenes.settlement, { from: { food: w.start.food, firewood: w.start.firewood } });

  // 남은 짐은 버린다 (처리 결정 없이 끝난 경우)
  w.haul = [];

  // 지식은 행동에서 자란다
  const policy = w.chosen ? findPolicy(def, w.chosen.policyId) : undefined;
  for (const [k, n] of Object.entries(policy?.knowledgeProgress ?? {})) {
    if (state.knowledge.has.includes(k)) continue;
    state.knowledge.progress[k] = (state.knowledge.progress[k] ?? 0) + n;
  }
  for (const k of def.knowledge) {
    if (!state.knowledge.has.includes(k.id) && (state.knowledge.progress[k.id] ?? 0) >= k.need) grantKnowledge(ctx, k.id);
  }

  // 결속이 낮은 달 수 (분열 판정)
  const low = state.cohesion < def.balance.cohesion.lowThreshold;
  state.counters['low_cohesion_months'] = low ? (state.counters['low_cohesion_months'] ?? 0) + 1 : 0;

  // 시대 목표 측정용 기록: 거처에서 지낸 달, 굶주림 없이 지낸 겨울 달
  const shelterKey = `shelter_months.${state.shelter.kind}`;
  state.counters[shelterKey] = (state.counters[shelterKey] ?? 0) + 1;
  if (monthDef(def, state).season === 'winter') {
    const streak = w.maxHunger === 0 ? (state.counters['winter_fed_streak'] ?? 0) + 1 : 0;
    state.counters['winter_fed_streak'] = streak;
    if (streak >= 3 && state.flags['winter_fed_full'] === undefined) state.flags['winter_fed_full'] = state.month;
  } else state.counters['winter_fed_streak'] = 0;

  // 정산표: 이번 달 장부를 출처별로 합친다 (원정지의 짐은 빼고)
  report.rows = sumLedger(w.ledger.filter((l) => l.res !== 'haul'));
  report.to = { food: totalKg(state.stores.food), firewood: state.stores.firewood };
  const lines = report.lines;
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

  const quiet = !w.notable && w.events.length === 0 && w.deaths.length === 0 && w.tiers.every((t) => t === 'success' || t === 'triumph');
  state.history.push({
    month: state.month,
    monthId: m.id,
    ...(policy ? { policyId: policy.id } : {}),
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

export function nextMonth(def: ChapterDefinition, state: GameState): string | undefined {
  if (state.step !== 'settlement') return 'error.wrongStep';
  startMonth(def, state);
  return undefined;
}

/** 디버그: 지금 사건을 강제로 띄운다 (방침 선택 전에만) */
export function forceEvent(def: ChapterDefinition, state: GameState, eventId: Id): string | undefined {
  if (state.step !== 'policy') return 'error.wrongStep';
  const ev = def.content.events.find((e) => e.id === eventId);
  if (!ev) return 'error.unknownEvent';
  const actors: Record<string, Id> = {};
  for (const [slot, q] of Object.entries(ev.actors ?? {})) {
    const p = living(state).find((x) => matchPerson(def, state, x, q));
    if (!p) return 'error.noActor';
    actors[slot] = p.id;
  }
  openEvent(def, state, ev.id, 'briefing', actors);
  return undefined;
}
