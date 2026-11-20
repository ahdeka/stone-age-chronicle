// 이벤트·행동 카드 검증 (DESIGN.md §12, CLAUDE.md 선택지 설계 원칙)
// - 중복 id, 선택지 수, 참조(이벤트·카드·스탯·자원·축·인물 슬롯)
// - 도달 불가: 생산자 없는 플래그/카운터 조건, 아무도 예약하지 않는 후속 이벤트
// - 공짜 선택지(비용·위험·기회비용 없음), 가짜 선택지(효과가 같은 선택지)
// - 문자열 키, 선택지 라벨 15자, 본문 2~4문장

import type { ChapterDefinition, Condition, Effect, EventOptionDef } from '../../src/engine';
import type { Issue } from './validate';

export const LABEL_MAX = 15;
export const SENTENCES = { min: 2, max: 4 };

/** 문장 수: 마침표·물음표·느낌표·말줄임표로 끝나는 덩어리 */
export function countSentences(text: string): number {
  return text
    .split(/[.!?…]+(?:\s+|$)/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0).length;
}

function walkEffects(effects: readonly Effect[], visit: (e: Effect) => void): void {
  for (const e of effects) {
    visit(e);
    if (e.type === 'delayed') walkEffects(e.effects, visit);
    if (e.type === 'random') e.outcomes.forEach((o) => walkEffects(o.effects, visit));
    if (e.type === 'check') {
      walkEffects(e.success, visit);
      walkEffects(e.failure, visit);
    }
    if (e.type === 'if') {
      walkEffects(e.then, visit);
      walkEffects(e.else ?? [], visit);
    }
  }
}

function walkConditions(conds: readonly Condition[] | undefined, visit: (c: Condition) => void): void {
  for (const c of conds ?? []) {
    visit(c);
    if (c.type === 'all' || c.type === 'any') walkConditions(c.of, visit);
    if (c.type === 'not') walkConditions([c.of], visit);
  }
}

/** 효과 안의 조건(if)까지 모은다 */
function conditionsInEffects(effects: readonly Effect[]): Condition[] {
  const out: Condition[] = [];
  walkEffects(effects, (e) => {
    if (e.type === 'if') out.push(...e.when);
  });
  return out;
}

/** 이 효과 목록에 비용, 위험, 지연된 결과 중 하나라도 있는가 */
export function hasCostOrRisk(def: ChapterDefinition, effects: readonly Effect[]): boolean {
  let found = false;
  walkEffects(effects, (e) => {
    switch (e.type) {
      case 'resource':
      case 'population':
        if (e.delta < 0) found = true;
        break;
      case 'random':
      case 'check':
      case 'schedule':
      case 'delayed':
      case 'removeCard':
        found = true;
        break;
      case 'person':
        if ((e.change.relation ?? 0) < 0) found = true;
        break;
      case 'modifier': {
        const pol = def.balance.statPolarity[e.mod.stat] ?? 1;
        const better = e.mod.op === 'mul' ? e.mod.value > 1 : e.mod.value > 0;
        if (better !== (pol === 1)) found = true;
        break;
      }
      default:
        break;
    }
  });
  return found;
}

export function validateCards(def: ChapterDefinition, strings: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const err = (where: string, message: string) => issues.push({ level: 'error', where, message });
  const warn = (where: string, message: string) => issues.push({ level: 'warning', where, message });
  const need = (where: string, key: string) => {
    if (strings[key] === undefined) err(where, `문자열 키 없음: ${key}`);
  };

  const events = def.content.events;
  const actions = def.content.actions;
  const eventIds = new Set(events.map((e) => e.id));
  const actionIds = new Set(actions.map((a) => a.id));
  const resources = new Set(def.resources.map((r) => r.id));
  const axes = new Set(def.axes.map((a) => a.id));
  const stats = new Set(Object.keys(def.balance.stats));
  const roles = new Set(def.roles.map((r) => r.id));

  // ── 중복 ──
  for (const [name, list] of [
    ['events', events],
    ['actions', actions],
  ] as const) {
    const seen = new Set<string>();
    for (const x of list) {
      if (seen.has(x.id)) err(name, `중복 id: ${x.id}`);
      seen.add(x.id);
    }
  }

  // ── 생산자 모으기: 어떤 플래그/카운터가 어디선가 만들어지는가, 어떤 이벤트가 예약되는가 ──
  const flagProducers = new Set<string>([def.balance.starvation.flag]);
  const counterProducers = new Set<string>(Object.values(def.balance.totalCounters));
  const scheduled = new Set<string>();
  const collect = (effects: readonly Effect[]) =>
    walkEffects(effects, (e) => {
      if (e.type === 'flag' && e.set) flagProducers.add(e.id);
      if (e.type === 'counter') counterProducers.add(e.id);
      if (e.type === 'schedule') scheduled.add(e.eventId);
    });
  for (const ev of events)
    for (const o of ev.options) {
      collect(o.effects);
      o.setFlags?.forEach((f) => flagProducers.add(f));
      o.followUps?.forEach((f) => scheduled.add(f.eventId));
    }
  for (const a of actions) {
    collect(a.cost ?? []);
    collect(a.effects);
  }

  // ── 공통 참조 검사 ──
  const checkEffects = (where: string, effects: readonly Effect[], slots: Set<string>) =>
    walkEffects(effects, (e) => {
      switch (e.type) {
        case 'resource':
          if (!resources.has(e.key)) err(where, `존재하지 않는 자원: ${e.key}`);
          break;
        case 'axis':
          if (!axes.has(e.axis)) err(where, `존재하지 않는 축: ${e.axis}`);
          break;
        case 'modifier':
          if (!stats.has(e.mod.stat)) err(where, `존재하지 않는 스탯: ${e.mod.stat}`);
          need(where, `stat.${e.mod.stat}`);
          break;
        case 'schedule':
          if (!eventIds.has(e.eventId)) err(where, `존재하지 않는 이벤트 예약: ${e.eventId}`);
          break;
        case 'addCard':
        case 'removeCard':
          if (!actionIds.has(e.id)) err(where, `존재하지 않는 카드: ${e.id}`);
          break;
        case 'person':
          if (e.ref !== 'chief' && !slots.has(e.ref.actor)) err(where, `정의되지 않은 인물 슬롯: ${e.ref.actor}`);
          break;
        case 'random':
          e.outcomes.forEach((o) => o.labelKey && need(where, o.labelKey));
          if (e.outcomes.length < 2) warn(where, 'random 결과가 하나뿐이다');
          break;
        case 'check':
          for (const p of e.power) {
            if (p.source === 'role' && !roles.has(p.id)) err(where, `존재하지 않는 역할: ${p.id}`);
            if (p.source === 'resource' && !resources.has(p.id)) err(where, `존재하지 않는 자원: ${p.id}`);
            if (p.source === 'stat' && !stats.has(p.id)) err(where, `존재하지 않는 스탯: ${p.id}`);
            if (p.source === 'actor' && !slots.has(p.slot)) err(where, `정의되지 않은 인물 슬롯: ${p.slot}`);
          }
          break;
        case 'chronicle':
          need(where, e.key);
          break;
        case 'counter':
          if (strings[`counter.${e.id}`] === undefined) warn(where, `카운터 이름 문자열 없음: counter.${e.id}`);
          break;
        default:
          break;
      }
    });

  const checkConds = (where: string, conds: readonly Condition[] | undefined, slots: Set<string>) =>
    walkConditions(conds, (c) => {
      if (c.type === 'flag' && (c.present ?? true) && !flagProducers.has(c.id)) err(where, `도달 불가: 플래그 ${c.id}를 세우는 곳이 없다`);
      if (c.type === 'counter' && (c.min ?? 0) > 0 && !counterProducers.has(c.id)) err(where, `도달 불가: 카운터 ${c.id}를 늘리는 곳이 없다`);
      if (c.type === 'actor' && !slots.has(c.slot)) err(where, `정의되지 않은 인물 슬롯: ${c.slot}`);
      if (c.type === 'eventSeen' && !eventIds.has(c.id)) err(where, `존재하지 않는 이벤트: ${c.id}`);
    });

  const label = (where: string, key: string) => {
    need(where, key);
    const v = strings[key];
    if (v !== undefined && [...v].length > LABEL_MAX) err(where, `라벨이 ${LABEL_MAX}자를 넘는다 (${[...v].length}자): ${v}`);
  };
  const body = (where: string, key: string) => {
    need(where, key);
    const v = strings[key];
    if (v === undefined) return;
    const n = countSentences(v);
    if (n < SENTENCES.min || n > SENTENCES.max) warn(where, `본문 ${n}문장 (권장 ${SENTENCES.min}~${SENTENCES.max}): ${key}`);
  };

  // ── 이벤트 ──
  let hiddenCount = 0;
  for (const ev of events) {
    const w = `event.${ev.id}`;
    const slots = new Set((ev.actors ?? []).map((a) => a.slot));
    need(w, `${w}.title`);
    body(w, `${w}.text`);
    ev.textVariants?.forEach((v) => {
      body(w, `${w}.text.${v.id}`);
      checkConds(w, v.when, slots);
    });
    checkConds(w, ev.trigger.conditions, new Set()); // 발생 조건은 인물을 바인딩하기 전에 평가된다
    ev.trigger.seasons?.forEach((s) => def.seasons.some((x) => x.id === s) || err(w, `존재하지 않는 계절: ${s}`));
    ev.weightMods?.forEach((m) => checkConds(w, m.when, new Set()));

    if (ev.options.length < 2 || ev.options.length > 4) err(w, `선택지는 2~4개여야 한다 (현재 ${ev.options.length})`);
    if (ev.mode === 'pool' && ev.weight <= 0) err(w, '풀 이벤트의 가중치가 0 이하다');
    if (ev.mode === 'followUp' && !scheduled.has(ev.id)) err(w, '도달 불가: 이 후속 이벤트를 예약하는 곳이 없다');

    const optIds = new Set<string>();
    const signatures = new Map<string, string>();
    for (const o of ev.options) {
      const ow = `${w}.opt.${o.id}`;
      if (optIds.has(o.id)) err(ow, '중복 선택지 id');
      optIds.add(o.id);
      label(ow, `${w}.opt.${o.id}`);
      if (o.chronicle) need(ow, `${w}.opt.${o.id}.chron`);
      if (o.lockHintKey) need(ow, o.lockHintKey);
      if (o.hiddenUnless) hiddenCount++;
      checkConds(ow, o.requires, slots);
      checkConds(ow, o.hiddenUnless, slots);
      checkConds(ow, conditionsInEffects(o.effects), slots);
      checkEffects(ow, o.effects, slots);
      o.followUps?.forEach((f) => eventIds.has(f.eventId) || err(ow, `존재하지 않는 후속 이벤트: ${f.eventId}`));

      if (!o.freeOk && !hasCostOrRisk(def, o.effects) && !(o.followUps?.length)) {
        err(ow, '비용 없는 선택지: 비용·위험·지연된 결과가 하나도 없다 (의도라면 freeOk에 사유를 적는다)');
      }
      const sig = signature(o);
      const twin = signatures.get(sig);
      if (twin) err(ow, `가짜 선택지: ${twin}와 결과가 똑같다`);
      signatures.set(sig, o.id);
    }
  }
  if (hiddenCount > 0) warn('events', `hiddenUnless로 숨긴 선택지 ${hiddenCount}개 — 잠긴 선택지는 숨기지 말고 흐리게 보여 주는 것이 원칙이다`);

  // ── 행동 카드 ──
  for (const a of actions) {
    const w = `action.${a.id}`;
    const slots = new Set(a.assign ? ['assignee'] : []);
    need(w, `${w}.name`);
    need(w, `${w}.text`);
    const name = strings[`${w}.name`];
    if (name !== undefined && [...name].length > LABEL_MAX) err(w, `카드 이름이 ${LABEL_MAX}자를 넘는다: ${name}`);
    if (a.chronicle) need(w, `${w}.chron`);
    if (a.lockHintKey) need(w, a.lockHintKey);
    checkConds(w, a.requires, slots);
    checkConds(w, conditionsInEffects(a.effects), slots);
    checkEffects(w, a.cost ?? [], slots);
    checkEffects(w, a.effects, slots);
    if (!hasCostOrRisk(def, [...(a.cost ?? []), ...a.effects])) {
      // 행동은 그 자체로 한 번의 행동 기회를 쓰므로 기회비용이 있다 — 경고만 한다
      warn(w, '비용도 위험도 없는 행동 카드 (행동 기회만 쓴다)');
    }
  }

  // ── 덱, 연대기 기본 문장 ──
  def.startingDeck.forEach((id) => actionIds.has(id) || err('startingDeck', `존재하지 않는 카드: ${id}`));
  if (def.startingDeck.length < 5) warn('startingDeck', '시작 덱이 손패 크기보다 작다');
  def.chronicleFallbacks.forEach((g, i) => {
    g.keys.forEach((k) => need(`chronicleFallbacks[${i}]`, k));
    checkConds(`chronicleFallbacks[${i}]`, g.when, new Set());
  });
  if (!def.chronicleFallbacks.some((g) => g.when.length === 0)) warn('chronicleFallbacks', '조건 없는 기본 묶음이 없어 연대기가 빌 수 있다');

  return issues;
}

/** 선택지의 결과 서명 (라벨·연대기 제외). 같으면 가짜 선택지 */
function signature(o: EventOptionDef): string {
  return JSON.stringify({
    effects: o.effects,
    setFlags: [...(o.setFlags ?? [])].sort(),
    clearFlags: [...(o.clearFlags ?? [])].sort(),
    followUps: o.followUps ?? [],
  });
}
