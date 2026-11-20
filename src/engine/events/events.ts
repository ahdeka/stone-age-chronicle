// 이벤트 엔진 (DESIGN.md §5.3): 후속(followUp) → 강제(forced) → 풀(pool) 순서로 뽑는다.

import type { ChapterDefinition, Condition, EventDef, EventInstance, EventOptionDef, GameState, Id, Person } from '../types';
import { allTrue, evaluateAll, matchPerson, type Actors } from '../conditions/evaluate';
import { applyEffects, type EffectCtx } from '../effects/apply';
import { chance, nextInt, weightedIndex } from '../rng/rng';

export function findEvent(def: ChapterDefinition, id: string): EventDef | undefined {
  return def.content.events.find((e) => e.id === id);
}

function alivePeople(state: GameState): Person[] {
  return Object.keys(state.people)
    .sort()
    .map((id) => state.people[id]!)
    .filter((p) => p.alive);
}

/** 필수 슬롯을 모두 서로 다른 인물로 채울 수 있는가 (난수 없이 판정) */
function canBind(state: GameState, ev: EventDef): boolean {
  const used = new Set<Id>();
  for (const slot of ev.actors ?? []) {
    const p = alivePeople(state).find((x) => !used.has(x.id) && matchPerson(x, slot.match));
    if (p) used.add(p.id);
    else if (!slot.optional) return false;
  }
  return true;
}

/** 슬롯마다 후보 중 하나를 난수로 고른다 */
function bindActors(state: GameState, ev: EventDef): Record<string, Id> {
  const actors: Record<string, Id> = {};
  const used = new Set<Id>();
  for (const slot of ev.actors ?? []) {
    const candidates = alivePeople(state).filter((x) => !used.has(x.id) && matchPerson(x, slot.match));
    if (candidates.length === 0) continue;
    const p = candidates[candidates.length === 1 ? 0 : nextInt(state.rng, 0, candidates.length - 1)]!;
    actors[slot.slot] = p.id;
    used.add(p.id);
  }
  return actors;
}

export function isEligible(
  def: ChapterDefinition,
  state: GameState,
  ev: EventDef,
  opts: { ignoreCooldown?: boolean } = {},
): boolean {
  const t = ev.trigger;
  if (t.seasons && !t.seasons.includes(state.season)) return false;
  if (t.minTurn !== undefined && state.turn < t.minTurn) return false;
  if (t.maxTurn !== undefined && state.turn > t.maxTurn) return false;
  if (t.eras && !t.eras.includes(state.eraId)) return false;
  const h = state.events.history[ev.id];
  if (ev.once && h) return false;
  if (!opts.ignoreCooldown && h && state.turn - h.lastTurn < ev.cooldown) return false;
  if (state.events.pending.some((p) => p.eventId === ev.id)) return false;
  if (!allTrue(def, state, t.conditions)) return false;
  return canBind(state, ev);
}

/** 최근 tagStreakMax 턴 연속으로 나온 태그를 가진 이벤트는 쉬게 한다 */
function tagFatigued(def: ChapterDefinition, state: GameState, ev: EventDef): boolean {
  const n = def.balance.events.tagStreakMax;
  const recent = state.events.recentTags;
  if (recent.length < n) return false;
  const lastN = recent.slice(-n);
  return ev.tags.some((tag) => lastN.every((turnTags) => turnTags.includes(tag)));
}

export function eventWeight(def: ChapterDefinition, state: GameState, ev: EventDef): number {
  let w = ev.weight;
  for (const m of ev.weightMods ?? []) if (allTrue(def, state, m.when)) w *= m.mul;
  return w;
}

function fire(def: ChapterDefinition, state: GameState, ev: EventDef): EventInstance {
  const actors = bindActors(state, ev);
  const variant = ev.textVariants?.find((v) => allTrue(def, state, v.when, actors))?.id ?? null;
  const prev = state.events.history[ev.id];
  state.events.history[ev.id] = { count: (prev?.count ?? 0) + 1, lastTurn: state.turn };
  const inst: EventInstance = { uid: `e${state.seq++}`, eventId: ev.id, actors, variant };
  state.events.pending.push(inst);
  return inst;
}

/** A6. 이번 턴의 이벤트를 뽑아 pending에 넣는다 */
export function drawEvents(def: ChapterDefinition, state: GameState): void {
  const b = def.balance.events;
  const cap = b.maxPerTurn;
  const count = () => state.events.pending.length;
  const firedTags: string[] = [];
  const fireAndTag = (ev: EventDef) => {
    fire(def, state, ev);
    firedTags.push(...ev.tags);
  };

  // 1. 도래한 후속 이벤트 — 예약 턴 순, 같으면 등록 순
  const due = state.events.scheduled.filter((s) => s.dueTurn <= state.turn).sort((a, z) => a.dueTurn - z.dueTurn || a.seq - z.seq);
  const keep = state.events.scheduled.filter((s) => s.dueTurn > state.turn);
  for (const s of due) {
    const ev = findEvent(def, s.eventId);
    if (!ev) continue;
    if (!chance(state.rng, s.chance)) continue;
    if (!isEligible(def, state, ev, { ignoreCooldown: true })) continue;
    if (count() >= cap && !ev.ignoreCap) {
      keep.push({ ...s, chance: 1 }); // 확률은 이미 통과했다 → 다음 턴으로 미룬다
      continue;
    }
    fireAndTag(ev);
  }
  state.events.scheduled = keep;

  // 2. 강제 이벤트 — priority 높은 순
  const forced = def.content.events
    .filter((e) => e.mode === 'forced')
    .sort((a, z) => (z.priority ?? 0) - (a.priority ?? 0) || a.id.localeCompare(z.id));
  for (const ev of forced) {
    if (count() >= cap && !ev.ignoreCap) continue;
    if (isEligible(def, state, ev)) fireAndTag(ev);
  }

  // 3. 풀 — 1장은 후보가 있으면 반드시, 2장째는 확률
  const drawPool = () => {
    const candidates = def.content.events.filter(
      (e) => e.mode === 'pool' && isEligible(def, state, e) && !tagFatigued(def, state, e),
    );
    const i = weightedIndex(
      state.rng,
      candidates.map((e) => eventWeight(def, state, e)),
    );
    const ev = candidates[i];
    if (ev) fireAndTag(ev);
  };
  if (count() < cap) drawPool();
  if (count() < cap && count() > 0 && chance(state.rng, b.secondEventChance)) drawPool();

  state.events.recentTags.push([...new Set(firedTags)]);
  if (state.events.recentTags.length > b.tagStreakMax) state.events.recentTags.shift();
}

/** 디버그: 조건을 무시하고 이벤트를 띄운다 */
export function forceEvent(def: ChapterDefinition, state: GameState, eventId: string): string | undefined {
  const ev = findEvent(def, eventId);
  if (!ev) return 'error.debug.unknownEvent';
  if (!canBind(state, ev)) return 'error.debug.cannotBind';
  fire(def, state, ev);
  state.phase = 'event';
  return undefined;
}

// ───────────────────────── 선택지 ─────────────────────────

export interface OptionStatus {
  option: EventOptionDef;
  visible: boolean;
  available: boolean;
  /** 잠금 힌트를 만들 실패 조건 */
  failed: Condition[];
}

export function optionStatuses(def: ChapterDefinition, state: GameState, inst: EventInstance): OptionStatus[] {
  const ev = findEvent(def, inst.eventId);
  if (!ev) return [];
  return ev.options.map((option) => {
    const visible = allTrue(def, state, option.hiddenUnless, inst.actors);
    const r = evaluateAll(def, state, option.requires, inst.actors);
    return { option, visible, available: visible && r.ok, failed: r.failed };
  });
}

/** 선택지 처리. 검증을 먼저 끝내고 나서 상태를 바꾼다. */
export function chooseOption(def: ChapterDefinition, state: GameState, eventUid: string, optionId: string): string | undefined {
  if (state.phase !== 'event') return 'error.wrongPhase';
  const inst = state.events.pending[0];
  if (!inst || inst.uid !== eventUid) return 'error.event.notCurrent';
  const ev = findEvent(def, inst.eventId);
  if (!ev) return 'error.event.unknown';
  const st = optionStatuses(def, state, inst).find((s) => s.option.id === optionId);
  if (!st) return 'error.event.unknownOption';
  if (!st.available) return 'error.event.optionLocked';

  const opt = st.option;
  const actors: Actors = inst.actors;
  const ctx: EffectCtx = { def, state, source: `event.${ev.id}.${opt.id}`, actors };
  state.turnLog.push({ kind: 'event', eventId: ev.id, optionId: opt.id, source: ctx.source });
  applyEffects(ctx, opt.effects);
  applyEffects(ctx, [
    ...(opt.setFlags ?? []).map((id) => ({ type: 'flag' as const, id, set: true })),
    ...(opt.clearFlags ?? []).map((id) => ({ type: 'flag' as const, id, set: false })),
    ...(opt.followUps ?? []).map((f) => ({ type: 'schedule' as const, eventId: f.eventId, delay: f.delay, chance: f.chance })),
  ]);
  if (opt.chronicle) {
    applyEffects(ctx, [{ type: 'chronicle', key: `event.${ev.id}.opt.${opt.id}.chron`, importance: opt.chronicle.importance }]);
  }
  state.events.pending.shift();
  return undefined;
}
