// 콘텐츠 검증 (npm run validate:content). DESIGN.md §12, §18, CLAUDE.md "재미 검증 도구"
// 오류: 없는 id 참조, 중복 id, 없는 문자열, 고를 수 없는 구조 / 경고: 공짜 선택지, 문장 길이, 변형 부족, 도달 불가

import type { ChapterDefinition, Condition, Effect, EventDef, Id, Narrative, PolicyStep, PolicyTemplate, SceneSpec } from '../../src/engine';
import { MEASURES, PHASES } from '../../src/engine';
import { PLACEHOLDER } from '../../src/i18n';
import { isJosaFormat } from '../../src/i18n/josa';
import { FORMATTERS } from '../../src/i18n/numerals';

export interface Issue {
  level: 'error' | 'warn';
  where: string;
  msg: string;
}

/** 서술 결과의 등급별 최소 변형 수 (M1: 1 → M2: 2 → M6: 3, DESIGN.md §12) */
export const MIN_VARIANTS = 1;
export const MAX_LABEL = 15;
export const MAX_SPEECH = 40;
/** 결정 팝업 카드의 한 줄 설명 최대 글자 수 (넘으면 경고, 카드 한 줄 약 18자) */
export const MAX_BRIEF = 18;
export const SENTENCES = { min: 1, max: 3 };
export const EVENT_TEXT_SENTENCES = { min: 2, max: 4 };

function sentences(s: string): number {
  return s.split(/(?<=[.!?])\s+/).filter((x) => x.trim().length > 0).length;
}

/** sceneIds: 그림 매니페스트에 있는 id (없으면 형식만 검사) */
export function validate(def: ChapterDefinition, strings: Record<string, string>, sceneIds?: ReadonlySet<string>): Issue[] {
  const issues: Issue[] = [];
  const err = (where: string, msg: string) => issues.push({ level: 'error', where, msg });
  const warn = (where: string, msg: string) => issues.push({ level: 'warn', where, msg });
  const ids = <T extends { id: string }>(list: readonly T[]) => new Set(list.map((x) => x.id));

  const sets = {
    policy: ids(def.content.policies),
    event: ids(def.content.events),
    narrative: ids(def.content.narratives),
    place: ids(def.places),
    animal: ids(def.animals),
    food: ids(def.foodKinds),
    goods: new Set(def.goods),
    shelter: ids(def.shelters),
    weather: ids(def.weather),
    ailment: ids(def.ailments),
    trait: ids(def.traits),
    knowledge: ids(def.knowledge),
    facility: ids(def.facilities),
    clue: ids(def.clues),
    month: ids(def.calendar.months),
    season: new Set(def.seasons),
    yield: ids(def.yields),
  };
  const need = (kind: keyof typeof sets, id: string, where: string) => {
    if (!sets[kind].has(id)) err(where, `없는 ${kind} id: ${id}`);
  };
  const str = (key: string, where: string) => {
    if (strings[key] === undefined) err(where, `문자열 없음: ${key}`);
    return strings[key] ?? '';
  };

  // ── 중복 id ──
  const dupCheck = (name: string, list: readonly { id: string }[]) => {
    const seen = new Set<string>();
    for (const x of list) {
      if (seen.has(x.id)) err(name, `중복 id: ${x.id}`);
      seen.add(x.id);
    }
  };
  dupCheck('policies', def.content.policies);
  dupCheck('events', def.content.events);
  dupCheck('narratives', def.content.narratives);
  dupCheck('places', def.places);
  dupCheck('animals', def.animals);
  dupCheck('knowledge', def.knowledge);
  dupCheck('facilities', def.facilities);

  // ── 참조 사용 기록 (도달 가능성 검사용) ──
  const scheduledEvents = new Set<string>();
  const pooledEvents = new Set<string>();
  const usedNarratives = new Set<string>();
  const flagsSet = new Set<string>();
  const flagsRead: { id: string; where: string }[] = [];

  function checkCond(c: Condition, where: string): void {
    switch (c.type) {
      case 'animal': {
        need('animal', c.id, where);
        const a = def.animals.find((x) => x.id === c.id);
        for (const st of c.state ?? []) if (a && !a.states.includes(st)) err(where, `${c.id}에 없는 상태: ${st}`);
        if (c.at && c.at !== '$place') need('place', c.at, where);
        return;
      }
      case 'animalVar':
        return need('animal', c.id, where);
      case 'place':
      case 'placeStock':
        return need('place', c.id, where);
      case 'goods':
        return need('goods', c.id, where);
      case 'food':
        for (const k of c.kinds ?? []) need('food', k, where);
        return;
      case 'knowledge':
        return need('knowledge', c.id, where);
      case 'facility':
        return need('facility', c.id, where);
      case 'clue':
        return need('clue', c.id, where);
      case 'shelter':
        for (const k of c.in) need('shelter', k, where);
        return;
      case 'season':
        for (const k of c.in) need('season', k, where);
        return;
      case 'monthOfYear':
        for (const k of c.in) need('month', k, where);
        return;
      case 'weather':
        for (const k of c.in) need('weather', k, where);
        return;
      case 'cache':
        if (c.at && c.at !== '$place') need('place', c.at, where);
        return;
      case 'policy':
        if (c.id) need('policy', c.id, where);
        return;
      case 'flag':
        flagsRead.push({ id: c.id, where });
        return;
      case 'person':
        if (c.match.trait) need('trait', c.match.trait, where);
        return;
      case 'all':
      case 'any':
        for (const x of c.of) checkCond(x, where);
        return;
      case 'not':
        return checkCond(c.of, where);
      default:
        return;
    }
  }
  const conds = (cs: readonly Condition[] | undefined, where: string) => {
    for (const c of cs ?? []) checkCond(c, where);
  };

  function checkEffect(e: Effect, where: string): void {
    switch (e.type) {
      case 'food':
        return need('food', e.kind, where);
      case 'catch':
        return need('animal', e.animal, where);
      case 'goods':
        return need('goods', e.id, where);
      case 'injure':
        need('ailment', e.ailment, where);
        str(`ailment.${e.ailment}`, where);
        return;
      case 'death':
        str(`cause.${e.cause}`, where);
        return;
      case 'animal': {
        need('animal', e.id, where);
        const a = def.animals.find((x) => x.id === e.id);
        if (e.state && a && !a.states.includes(e.state)) err(where, `${e.id}에 없는 상태: ${e.state}`);
        if (e.at) need('place', e.at, where);
        return;
      }
      case 'place':
        need('place', e.id, where);
        if (e.stock) need('yield', e.stock.yield, where);
        return;
      case 'shelter':
        need('shelter', e.kind, where);
        if (e.place) need('place', e.place, where);
        return;
      case 'knowledge':
        return need('knowledge', e.id, where);
      case 'facility':
        need('facility', e.id, where);
        if (!e.level && !e.progress) err(where, `시설 효과에 level이나 progress가 없다: ${e.id}`);
        return;
      case 'clue':
        need('clue', e.id, where);
        str(`clue.${e.id}`, where);
        return;
      case 'cache':
        if (e.at !== '$place') need('place', e.at, where);
        return;
      case 'preserve':
        for (const k of e.from) need('food', k, where);
        need('food', e.to, where);
        return;
      case 'schedule':
        need('event', e.event, where);
        scheduledEvents.add(e.event);
        conds(e.when, where);
        return;
      case 'flag':
        if (e.set) flagsSet.add(e.id);
        return;
      case 'modifier':
        conds(e.mod.when, where);
        if (def.balance.stats[e.mod.stat] === undefined) err(where, `없는 스탯: ${e.mod.stat}`);
        return;
      case 'random':
        for (const o of e.outcomes) effects(o.effects, where);
        return;
      case 'if':
        conds(e.when, where);
        effects(e.then, where);
        effects(e.else, where);
        return;
      case 'line':
        str(e.key, where);
        return;
      case 'narrative':
        need('narrative', e.id, where);
        usedNarratives.add(e.id);
        return;
      case 'chronicle':
        str(e.key, where);
        return;
      default:
        return;
    }
  }
  function effects(es: readonly Effect[] | undefined, where: string): void {
    for (const e of es ?? []) checkEffect(e, where);
  }

  const sceneId = (id: string, where: string) => {
    if (id.startsWith('{')) {
      if (!['{place}', '{camp}', '{weather}'].includes(id)) err(where, `알 수 없는 장면 자리표시자: ${id}`);
      return;
    }
    if (!/^(bg|ground|sub|ov|portrait)\.[a-z_]+$/.test(id)) err(where, `장면 id 형식이 아니다: ${id}`);
    else if (sceneIds && !sceneIds.has(id)) err(where, `매니페스트에 없는 그림: ${id}`);
  };
  const scene = (s: SceneSpec | undefined, where: string) => {
    if (!s) return;
    sceneId(s.bg, where);
    if (s.ground && s.ground !== 'none') sceneId(s.ground, where);
    for (const x of s.subjects ?? []) sceneId(x, where);
    if (s.overlay) sceneId(s.overlay, where);
  };

  // ── 방침 ──
  for (const p of def.content.policies) {
    const w = `policy.${p.id}`;
    str(`policy.${p.id}.name`, w);
    str(`policy.${p.id}.summary`, w);
    // 결정 팝업 카드의 한 줄 설명 (2026-11-24 3차 피드백)
    str(`policy.${p.id}.brief`, w);
    const brief = strings[`policy.${p.id}.brief`];
    if (brief && [...brief].length > MAX_BRIEF) warn(w, `한 줄 설명 ${[...brief].length}자 (최대 ${MAX_BRIEF}): ${brief}`);
    conds(p.appearsWhen, w);
    for (const r of p.relevance ?? []) conds(r.when, w);
    if (p.place) need('place', p.place, w);
    for (const m of p.monthMods ?? []) if (def.balance.stats[m.stat] === undefined) err(w, `없는 스탯: ${m.stat}`);
    for (const k of Object.keys(p.knowledgeProgress ?? {})) need('knowledge', k, w);
    if (p.builds) {
      need('facility', p.builds.facility, w);
      if (!(p.builds.months >= 1)) err(w, `공사 달 수는 1 이상: ${p.builds.months}`);
    }
    // 전략 칸 (DESIGN.md §6.4): 버티기는 식량 칸, 발전은 지속 효과를 하나 이상 남긴다
    if (!['food', 'growth', 'major'].includes(p.slot)) err(w, `없는 전략 칸: ${p.slot}`);
    if (p.fallback && p.slot !== 'food') err(w, '버티기 방침은 식량 칸이어야 한다');
    if (p.slot === 'growth' && !growthLasts(p)) err(w, '발전 전략이 남기는 것이 없다 (시설·지식·단서·깃발·장소·거처·약속·물자·치료 중 하나)');
    scene(p.scene, w);
    let hasCarry = false;
    for (const ph of PHASES) {
      for (const st of (p.steps[ph] ?? []) as PolicyStep[]) {
        const sw = `${w}.${ph}`;
        conds(st.when, sw);
        if (st.kind === 'narrate') {
          if (st.narrative) {
            need('narrative', st.narrative, sw);
            usedNarratives.add(st.narrative);
          }
          effects(st.effects, sw);
        } else if (st.kind === 'activity') {
          for (const t of st.activity.power) if (t.src === 'stat' && def.balance.stats[t.id] === undefined) err(sw, `없는 스탯: ${t.id}`);
          for (const [tier, out] of Object.entries(st.activity.outcomes)) {
            if (out.narrative) {
              need('narrative', out.narrative, `${sw}.${tier}`);
              usedNarratives.add(out.narrative);
            }
            effects(out.effects, `${sw}.${tier}`);
            scene(out.scene, `${sw}.${tier}`);
          }
          for (const c of st.activity.costs ?? []) {
            conds(c.when, `${sw}.cost`);
            effects(c.effects, `${sw}.cost`);
          }
          for (const h of st.activity.hidden ?? []) conds(h.knownWhen, `${sw}.hidden`);
        } else if (st.kind === 'eventWindow') {
          for (const id of st.pool) {
            need('event', id, sw);
            pooledEvents.add(id);
          }
        } else if (st.kind === 'carry') hasCarry = true;
      }
    }
    if (p.crew && !hasCarry && JSON.stringify(p.steps).includes('"haul":true')) warn(w, '짐을 만들지만 운반 단계가 없다');
    if (p.crew && JSON.stringify(p.steps).includes('"type":"catch"') && !hasCarry) warn(w, '사냥감을 잡지만 운반 단계가 없다');
  }
  if (!def.content.policies.some((p) => p.fallback)) err('policies', '버티기 방침(fallback)이 하나도 없다');

  // ── 사건 ──
  const checkEvent = (ev: EventDef) => {
    const w = `event.${ev.id}`;
    str(`event.${ev.id}.title`, w);
    const text = str(`event.${ev.id}.text`, w);
    const n = sentences(text);
    if (text && (n < EVENT_TEXT_SENTENCES.min || n > EVENT_TEXT_SENTENCES.max)) warn(w, `본문 ${n}문장 (권장 ${EVENT_TEXT_SENTENCES.min}~${EVENT_TEXT_SENTENCES.max})`);
    conds(ev.when, w);
    for (const q of Object.values(ev.actors ?? {})) if (q.trait) need('trait', q.trait, w);
    scene(ev.scene, w);
    for (const sp of ev.speakers ?? []) {
      const line = str(sp.line, w);
      if (line.length > MAX_SPEECH) warn(w, `대사 ${line.length}자 (최대 ${MAX_SPEECH}): ${sp.line}`);
    }
    if (ev.options.length < 2 || ev.options.length > 4) err(w, `선택지 ${ev.options.length}개 (2~4개)`);
    const sigs = new Set<string>();
    for (const o of ev.options) {
      const ow = `${w}.${o.id}`;
      const label = str(`event.${ev.id}.opt.${o.id}`, ow);
      if (label.length > MAX_LABEL) warn(ow, `선택지 라벨 ${label.length}자 (최대 ${MAX_LABEL}): ${label}`);
      conds(o.requires, ow);
      effects(o.effects, ow);
      if (o.narrative) {
        need('narrative', o.narrative, ow);
        usedNarratives.add(o.narrative);
      }
      if (o.activity)
        for (const out of Object.values(o.activity.outcomes)) {
          effects(out.effects, ow);
          if (out.narrative) {
            need('narrative', out.narrative, ow);
            usedNarratives.add(out.narrative);
          }
        }
      if (!o.activity && !hasCost(o.effects)) warn(ow, '비용·위험·기회비용이 보이지 않는 선택지');
      const sig = JSON.stringify({ e: o.effects, a: o.activity });
      if (sigs.has(sig)) err(ow, '결과가 같은 선택지 (가짜 선택지)');
      sigs.add(sig);
    }
    if (ev.scope === 'policy' && !pooledEvents.has(ev.id)) warn(w, '어느 방침의 사건 창에도 들어 있지 않다 (도달 불가)');
    if (ev.scope === 'scheduled' && !scheduledEvents.has(ev.id)) warn(w, '어디서도 예약하지 않는다 (도달 불가)');
  };
  // 사건 검사 전에 모든 방침·사건의 예약과 풀을 모아 둔다 (위에서 방침은 끝남; 사건 안의 예약을 먼저 훑는다)
  for (const ev of def.content.events) for (const o of ev.options) effects(o.effects, `event.${ev.id}.${o.id}`);
  for (const ev of def.content.events) checkEvent(ev);

  // ── 서술 ──
  need('narrative', def.hooks.villageNarrative, 'hooks');
  usedNarratives.add(def.hooks.villageNarrative);
  const village = def.content.narratives.find((n) => n.id === def.hooks.villageNarrative);
  if (village) {
    const seasons = [...new Set(def.calendar.months.map((m) => m.season))];
    const gap = uncoveredSeasons(village, seasons);
    if (gap.length > 0) warn('hooks', `마을 서술에 맞는 변형이 없는 계절 (그 계절 순의 서술이 빌 수 있다): ${gap.join(', ')}`);
  }
  for (const n of def.content.narratives) {
    const w = `narrative.${n.id}`;
    if (n.variants.length < MIN_VARIANTS) warn(w, `변형 ${n.variants.length}개 (최소 ${MIN_VARIANTS})`);
    for (const v of n.variants) {
      const t = str(v.text, w);
      const k = sentences(t);
      if (t && (k < SENTENCES.min || k > SENTENCES.max)) warn(w, `${v.text}: ${k}문장 (권장 ${SENTENCES.min}~${SENTENCES.max})`);
      conds(v.when, w);
    }
    effects(n.facts, w);
    if (!usedNarratives.has(n.id)) warn(w, '아무 데서도 쓰지 않는 서술');
  }

  // ── 깃발: 읽기만 하고 세우지 않는 깃발 ──
  for (const f of flagsRead) if (!flagsSet.has(f.id)) warn(f.where, `어디서도 세우지 않는 깃발: ${f.id}`);

  // ── 세계와 문자열 ──
  for (const m of def.calendar.months) {
    str(`month.${m.id}`, `month.${m.id}`);
    need('season', m.season, `month.${m.id}`);
    for (const w of Object.keys(m.weather)) need('weather', w, `month.${m.id}`);
  }
  for (const s of def.seasons) str(`season.${s}`, 'seasons');
  for (const w of def.weather) str(`weather.${w.id}`, `weather.${w.id}`);
  for (const p of def.places) {
    str(`place.${p.id}`, `place.${p.id}`);
    sceneId(p.scene, `place.${p.id}`);
    for (const y of Object.keys(p.stockMax)) need('yield', y, `place.${p.id}`);
  }
  for (const a of def.animals) {
    for (const st of a.states) str(`animal.${a.id}.${st}`, `animal.${a.id}`);
    for (const sc of a.schedule) {
      need('month', sc.month, `animal.${a.id}`);
      if (!a.states.includes(sc.to)) err(`animal.${a.id}`, `없는 상태로 전이: ${sc.to}`);
      if (sc.at) need('place', sc.at, `animal.${a.id}`);
    }
    need('food', a.foodKind, `animal.${a.id}`);
    for (const g of Object.keys(a.goods ?? {})) need('goods', g, `animal.${a.id}`);
  }
  for (const a of def.ailments) {
    str(`ailment.${a.id}`, `ailment.${a.id}`);
    str(`cause.${a.id}`, `ailment.${a.id}`);
  }
  for (const g of def.goods) str(`res.${g}`, 'goods');
  for (const f of def.foodKinds) str(`food.${f.id}`, 'food');
  for (const s of def.shelters) str(`shelter.${s.id}`, 'shelters');
  for (const k of def.knowledge) str(`knowledge.${k.id}`, `knowledge.${k.id}`);
  for (const f of def.facilities) {
    const fw = `facility.${f.id}`;
    str(fw, fw);
    if (!(f.max >= 1)) err(fw, `최대 단계는 1 이상: ${f.max}`);
    for (const m of f.mods) {
      if (def.balance.stats[m.stat] === undefined) err(fw, `없는 스탯: ${m.stat}`);
      conds(m.when, fw);
    }
    effects(f.perPhase, fw);
  }
  if (!def.content.policies.some((p) => p.slot === 'food')) err('policies', '식량 칸 전략이 하나도 없다');
  for (const c of def.clues) str(`clue.${c.id}`, `clue.${c.id}`);
  for (const e of def.content.endings) {
    str(`ending.${e.id}.title`, `ending.${e.id}`);
    str(`ending.${e.id}.chron`, `ending.${e.id}`);
    conds(e.check, `ending.${e.id}`);
  }
  for (const pr of def.presets) {
    const w = `preset.${pr.id}`;
    need('place', pr.campPlace, w);
    need('shelter', pr.shelter, w);
    for (const f of pr.food) need('food', f.kind, w);
    for (const g of Object.keys(pr.goods)) need('goods', g, w);
    for (const d of pr.discovered) need('place', d, w);
    for (const a of def.animals) if (!pr.animals[a.id]) err(w, `동물 시작 상태 없음: ${a.id}`);
    for (const [id, st] of Object.entries(pr.animals)) {
      const a = def.animals.find((x) => x.id === id);
      if (!a) err(w, `없는 동물: ${id}`);
      else if (!a.states.includes(st.state)) err(w, `${id}에 없는 상태: ${st.state}`);
    }
    const ppl = new Set(pr.people.map((p) => p.id));
    for (const p of pr.people) {
      str(`person.${p.id}`, w);
      for (const par of p.parents ?? []) if (!ppl.has(par)) err(w, `${p.id}의 부모가 없다: ${par}`);
      for (const t of p.traits ?? []) need('trait', t, w);
    }
    if (pr.people.filter((p) => p.isChief).length !== 1) err(w, '족장은 정확히 한 명이어야 한다');
  }
  for (const k of ['ration', 'cold'] as const) need('ailment', def.balance[k].sickness, `balance.${k}`);
  need('animal', def.balance.cache.raidAnimal, 'balance.cache');
  need('knowledge', def.balance.carry.dryKnowledge, 'balance.carry');
  need('food', def.balance.carry.dryKind, 'balance.carry');
  scene(def.scenes.briefing, 'scenes.briefing');
  scene(def.scenes.settlement, 'scenes.settlement');
  scene(def.scenes.intro, 'scenes.intro');
  for (const [sn, g] of Object.entries(def.scenes.groundBySeason ?? {})) {
    need('season', sn, 'scenes.groundBySeason');
    sceneId(g, 'scenes.groundBySeason');
  }
  for (const sh of def.shelters) for (const m of sh.mods ?? []) if (def.balance.stats[m.stat] === undefined) err(`shelter.${sh.id}`, `없는 스탯: ${m.stat}`);
  for (const m of def.globalMods) {
    if (def.balance.stats[m.stat] === undefined) err('globalMods', `없는 스탯: ${m.stat}`);
    conds(m.when, 'globalMods');
  }
  for (const k of def.knowledge) for (const m of k.mods) if (def.balance.stats[m.stat] === undefined) err(`knowledge.${k.id}`, `없는 스탯: ${m.stat}`);
  for (const c of def.clues) for (const m of c.mods ?? []) if (def.balance.stats[m.stat] === undefined) err(`clue.${c.id}`, `없는 스탯: ${m.stat}`);
  for (const y of def.yields) if (def.balance.stats[`yield.${y.id}`] === undefined) err(`yield.${y.id}`, `스탯 기본값 없음: yield.${y.id}`);
  for (const w of def.weather) if (w.overlay) sceneId(w.overlay, `weather.${w.id}`);
  for (const sh of def.shelters) sceneId(sh.scene, `shelter.${sh.id}`);

  // ── 화면용 글 (M2 화면 시안) ──
  for (const pr of def.presets) {
    const w = `preset.${pr.id}`;
    const ps = pr.presentation;
    for (const k of [ps.chapterLabel, ps.meta, ps.tagline, ps.land.title, ps.land.subtitle, ps.land.intro, ps.chronicleOpening, ...ps.introLines, ...ps.nameSuggestions])
      str(k, w);
    if (ps.nameSuggestions.length === 0) err(w, '추천 부족 이름이 없다');
    for (const f of ps.land.facts) for (const k of [f.label, f.value]) str(k, w);
  }
  for (const m of def.calendar.months) str(`month.${m.id}.when`, `month.${m.id}`);
  for (const sname of def.seasons) str(`brief.headline.${sname}`, 'briefing');
  const br = def.briefing;
  for (const h of br.headlines) {
    str(h.key, 'briefing.headlines');
    conds(h.when, 'briefing.headlines');
  }
  for (const n of br.news) {
    str(n.key, 'briefing.news');
    if (n.chip) str(n.chip, 'briefing.news');
    conds(n.when, 'briefing.news');
  }
  for (const c of br.chips) {
    str(c.key, 'briefing.chips');
    conds(c.when, 'briefing.chips');
  }
  for (const sc of br.scenes) {
    scene(sc.scene, 'briefing.scenes');
    conds(sc.when, 'briefing.scenes');
  }
  // 조언: 조언자마다 입장이 있어야 하고, 대사 키가 있어야 한다
  const stanceIds = new Set(def.advisors.stances.map((x) => x.id));
  for (const pr of def.presets)
    for (const pp of pr.people)
      if (pp.advisor) {
        if (!stanceIds.has(pp.advisor.stance)) err(`preset.${pr.id}`, `없는 입장: ${pp.advisor.stance}`);
        str(`seat.${pp.advisor.seat}`, `preset.${pr.id}`);
        str(`advice.generic.${pp.advisor.stance}`, 'advisors');
        if (sceneIds && !sceneIds.has(`portrait.${pp.advisor.seat}`)) warn(`preset.${pr.id}`, `초상이 없는 자리: ${pp.advisor.seat}`);
      }
  for (const st of def.advisors.stances) str(`stance.${st.id}`, 'advisors');
  for (const l of def.advisors.lines) {
    str(l.text, 'advisors.lines');
    if (l.policy) need('policy', l.policy, 'advisors.lines');
    if (l.stance && !stanceIds.has(l.stance)) err('advisors.lines', `없는 입장: ${l.stance}`);
    conds(l.when, 'advisors.lines');
  }
  // 시대 목표: 문자열과 측정기
  for (const g of def.goals) {
    str(`goal.${g.id}`, `goal.${g.id}`);
    for (const pth of g.paths) {
      str(`goal.${g.id}.${pth.id}`, `goal.${g.id}`);
      if (pth.measure && !MEASURES[pth.measure.id]) err(`goal.${g.id}.${pth.id}`, `없는 측정기: ${pth.measure.id}`);
    }
  }
  // 진행 화면의 장부 행과 알림, 방침 카드의 대가
  for (const a of def.animals) if (a.meatKg > 0) str(`row.catch.${a.id}`, `animal.${a.id}`);
  for (const a of def.ailments) str(`ailment.${a.id}.effect`, `ailment.${a.id}`);
  for (const p of def.content.policies) str(`policy.${p.id}.cost`, `policy.${p.id}`);

  // ── 표기 규칙 (CLAUDE.md "화면 표기 원칙") ──
  const tribeNames = new Set(def.presets.flatMap((pr) => pr.presentation.nameSuggestions.map((k) => strings[k] ?? '')).filter(Boolean));
  for (const [key, text] of Object.entries(strings)) issues.push(...notationIssues(key, text, tribeNames));

  return issues;
}

/** 화면 정보용 키: 아라비아 숫자만 쓴다 (우리말 수 서식 금지) */
export function isScreenKey(key: string): boolean {
  return (
    SCREEN_PREFIXES.some((p) => key.startsWith(p)) ||
    key.endsWith('.cost') ||
    key.endsWith('.brief') ||
    key.endsWith('.lock') ||
    /^preset\.[^.]+\.(land\.|meta$)/.test(key)
  );
}
const SCREEN_PREFIXES = ['ui.', 'chip.', 'row.', 'settle.', 'brief.', 'alert.', 'tier.', 'hint.', 'cohesion.', 'goal.', 'goals.'];
/** 우리말로 읽는 수 서식 */
const NATIVE_FORMATS = new Set(['count', 'num']);
const JOSA_CHARS = /^(은|는|이|가|을|를|와|과|으로|로)(?![가-힣])/u;

/** 문자열 하나의 표기 검사: 서식 이름, 조사, 화면용 숫자, 부족 이름 */
export function notationIssues(key: string, text: string, tribeNames: ReadonlySet<string>): Issue[] {
  const out: Issue[] = [];
  const err = (msg: string) => out.push({ level: 'error', where: `ko.${key}`, msg });
  for (const m of text.matchAll(PLACEHOLDER)) {
    const fmt = m[2];
    const after = text.slice((m.index ?? 0) + m[0].length);
    if (fmt && !FORMATTERS[fmt] && !isJosaFormat(fmt)) err(`없는 서식: ${m[0]}`);
    if (fmt && NATIVE_FORMATS.has(fmt) && isScreenKey(key)) err(`화면 정보에는 우리말 수를 쓰지 않는다: ${m[0]} (아라비아 숫자로)`);
    if (fmt === 'count' && after.startsWith(' ')) err(`{n:count} 뒤는 띄우지 않는다 (서식이 띄어쓰기를 넣는다): ${m[0]}`);
    if (!fmt && JOSA_CHARS.test(after)) err(`변수 바로 뒤의 조사는 서식으로: ${m[0]}${after.slice(0, 2)} → {${m[1]}:${after.match(JOSA_CHARS)![1]}}`);
  }
  if (!key.startsWith('tribe.suggest.')) for (const n of tribeNames) if (text.includes(n)) err(`부족 이름을 직접 쓰지 않는다: "${n}" → {tribe}`);
  return out;
}

/** 오르면 나쁜 스탯 */
const BAD_WHEN_UP = new Set(['spoil.mul', 'cache.raid', 'firewood.burnMul']);

/**
 * 서술이 빈 순 막기: 마을 서술(hooks.villageNarrative)은 순마다 늘 나오는 유일한 서술이라
 * 어느 계절에도 맞는 변형이 하나는 있어야 한다. 계절 조건이 없거나 그 계절을 포함한 변형이면 덮는다고 본다
 * (날씨로 나눈 변형은 서로 덮는다고 가정한다). 덮이지 않는 계절을 돌려준다.
 */
export function uncoveredSeasons(n: Narrative, seasons: readonly Id[]): Id[] {
  const covers = (s: Id) =>
    n.variants.some((v) => (v.when ?? []).every((c) => c.type !== 'season' || c.in.includes(s)));
  return seasons.filter((s) => !covers(s));
}

/** 발전 전략이 지속되는 무언가를 남기는가: 지식 진행, 공사, 또는 단계의 효과 중 남는 것 */
export function growthLasts(p: PolicyTemplate): boolean {
  if (p.builds || Object.keys(p.knowledgeProgress ?? {}).length > 0) return true;
  const outs: Effect[] = [];
  for (const ph of PHASES) {
    for (const st of (p.steps[ph] ?? []) as PolicyStep[]) {
      if (st.kind === 'narrate') outs.push(...(st.effects ?? []));
      else if (st.kind === 'activity') for (const o of Object.values(st.activity.outcomes)) outs.push(...o.effects);
      // 사건 창은 사건이 남길 것을 정한다 (이웃 만나기, 굴 찾기)
      else if (st.kind === 'eventWindow') return true;
    }
  }
  return lastingEffects(outs);
}

const LASTING = new Set(['facility', 'knowledge', 'clue', 'flag', 'place', 'shelter', 'schedule', 'counter', 'heal']);
function lastingEffects(es: readonly Effect[]): boolean {
  return es.some((e) => {
    if (LASTING.has(e.type)) return true;
    if (e.type === 'goods') return typeof e.delta === 'number' ? e.delta > 0 : e.delta[1] > 0;
    if (e.type === 'if') return lastingEffects(e.then) || lastingEffects(e.else ?? []);
    if (e.type === 'random') return e.outcomes.some((o) => lastingEffects(o.effects));
    return false;
  });
}

/** 비용·위험이 보이는 효과가 있는가 (기회비용은 opportunity로 표시) */
export function hasCost(es: readonly Effect[]): boolean {
  return es.some((e) => {
    switch (e.type) {
      case 'food':
      case 'firewood':
        return typeof e.kg === 'number' ? e.kg < 0 : e.kg[0] < 0;
      case 'goods':
        return typeof e.delta === 'number' ? e.delta < 0 : e.delta[0] < 0;
      case 'cohesion':
        return e.delta < 0;
      case 'injure':
      case 'death':
      case 'random':
        return true;
      case 'modifier':
        // 오르면 나쁜 스탯(부패, 짐승의 습격, 장작 소모)은 올리는 것이 비용이다
        if (BAD_WHEN_UP.has(e.mod.stat)) return e.mod.op === 'add' ? e.mod.value > 0 : e.mod.value > 1;
        return e.mod.op === 'add' ? e.mod.value < 0 : e.mod.value < 1;
      case 'flag':
        // 기회비용 깃발: 'opportunity.'로 시작하거나 다음 단계를 건너뛰게 하는 깃발
        return e.set && (e.id.startsWith('hunt_called_off') || e.id.startsWith('opportunity.'));
      case 'if':
        return hasCost(e.then) || hasCost(e.else ?? []);
      default:
        return false;
    }
  });
}
