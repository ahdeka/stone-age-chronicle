// 콘텐츠 검증 (DESIGN.md §12). M1 범위: 중복 id, id 참조, 스탯 키, 문자열 키, 프리셋 정합성, 테마 토큰.
// 이벤트·카드 관련 검사(도달 불가, 비용 없는 선택지, 라벨 길이 등)는 M2에서 추가한다.

import type { ChapterDefinition, Condition, Label, ModifierDef } from '../../src/engine';

export interface Issue {
  level: 'error' | 'warning';
  where: string;
  message: string;
}

const REQUIRED_THEME_TOKENS = ['bg', 'surface', 'card', 'text', 'text-muted', 'text-faint', 'accent', 'ochre', 'danger', 'good'];

export function validateChapter(def: ChapterDefinition, strings: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const err = (where: string, message: string) => issues.push({ level: 'error', where, message });
  const warn = (where: string, message: string) => issues.push({ level: 'warning', where, message });

  // ── 1. 중복 id ──
  const lists: [string, { id: string }[]][] = [
    ['resources', def.resources],
    ['axes', def.axes],
    ['roles', def.roles],
    ['seasons', def.seasons],
    ['eras', def.eras],
    ['lifestyles', def.lifestyles],
    ['lifeStages', def.lifeStages],
    ['offices', def.offices],
    ['personTraits', def.content.personTraits],
    ['tribeTraits', def.content.tribeTraits],
    ['regions', def.content.regions],
    ['endings', def.content.endings],
    ['startPresets', def.startPresets],
  ];
  for (const [name, list] of lists) {
    const seen = new Set<string>();
    for (const { id } of list) {
      if (seen.has(id)) err(name, `중복 id: ${id}`);
      seen.add(id);
    }
  }

  const ids = {
    resource: new Set(def.resources.map((x) => x.id)),
    axis: new Set(def.axes.map((x) => x.id)),
    role: new Set(def.roles.map((x) => x.id)),
    season: new Set(def.seasons.map((x) => x.id)),
    era: new Set(def.eras.map((x) => x.id)),
    lifestyle: new Set(def.lifestyles.map((x) => x.id)),
    stage: new Set(def.lifeStages.map((x) => x.id)),
    office: new Set(def.offices.map((x) => x.id)),
    personTrait: new Set(def.content.personTraits.map((x) => x.id)),
    tribeTrait: new Set(def.content.tribeTraits.map((x) => x.id)),
    region: new Set(def.content.regions.map((x) => x.id)),
    stat: new Set(Object.keys(def.balance.stats)),
  };
  const ref = (where: string, kind: keyof typeof ids, id: string) => {
    if (!ids[kind].has(id)) err(where, `존재하지 않는 ${kind} 참조: ${id}`);
  };

  // ── 2. 조건과 모디파이어 ──
  const checkCondition = (where: string, c: Condition): void => {
    switch (c.type) {
      case 'resource':
        return ref(where, 'resource', c.key);
      case 'role':
        return ref(where, 'role', c.role);
      case 'axis':
        return ref(where, 'axis', c.axis);
      case 'lifestyle':
        return ref(where, 'lifestyle', c.is);
      case 'tribeTrait':
        return ref(where, 'tribeTrait', c.id);
      case 'season':
        return c.in.forEach((s) => ref(where, 'season', s));
      case 'era':
        return ref(where, 'era', c.is);
      case 'region':
        if (c.current) ref(where, 'region', c.current);
        return;
      case 'regionDiscovered':
        return ref(where, 'region', c.id);
      case 'person':
      case 'chief': {
        const q = c.match;
        if (q.office) ref(where, 'office', q.office);
        if (q.trait) ref(where, 'personTrait', q.trait);
        q.stage?.forEach((s) => ref(where, 'stage', s));
        return;
      }
      case 'all':
      case 'any':
        return c.of.forEach((x) => checkCondition(where, x));
      case 'not':
        return checkCondition(where, c.of);
      // flag / counter / eventSeen / knowledge / tradition 참조 검사는 생산자가 생기는 M2·M4에서
      default:
        return;
    }
  };
  const checkMods = (where: string, mods: readonly ModifierDef[]) => {
    for (const m of mods) {
      ref(where, 'stat', m.stat);
      m.when?.forEach((c) => checkCondition(where, c));
      if (m.sourceKey && strings[m.sourceKey] === undefined) err(where, `문자열 키 없음: ${m.sourceKey}`);
    }
  };
  checkMods('balance.globalModifiers', def.balance.globalModifiers);
  def.seasons.forEach((s) => checkMods(`season.${s.id}`, s.modifiers));
  def.lifestyles.forEach((l) => checkMods(`lifestyle.${l.id}`, l.modifiers));
  def.content.tribeTraits.forEach((t) => checkMods(`tribeTrait.${t.id}`, t.modifiers));
  def.content.personTraits.forEach((t) => {
    checkMods(`personTrait.${t.id}`, t.modifiers);
    t.opposites?.forEach((o) => ref(`personTrait.${t.id}.opposites`, 'personTrait', o));
  });
  def.content.endings.forEach((e) => e.check.forEach((c) => checkCondition(`ending.${e.id}`, c)));

  // ── 3. 역할, 소비, 저장, balance 참조 ──
  const b = def.balance;
  for (const r of def.roles) {
    for (const o of r.outputs) {
      ref(`role.${r.id}`, 'resource', o.resource);
      ref(`role.${r.id}`, 'stat', o.stat);
      if (o.bonusFrom) ref(`role.${r.id}`, 'resource', o.bonusFrom.resource);
    }
  }
  b.upkeep.forEach((u) => {
    ref('balance.upkeep', 'resource', u.resource);
    ref('balance.upkeep', 'stat', u.perCapitaStat);
  });
  b.storage.forEach((s) => {
    ref('balance.storage', 'resource', s.resource);
    ref('balance.storage', 'stat', s.capPerCapitaStat);
    ref('balance.storage', 'stat', s.spoilStat);
  });
  ref('balance.cohesionResource', 'resource', b.cohesionResource);
  ref('balance.starvation', 'resource', b.starvation.resource);
  ref('balance.growth', 'stat', b.growth.rateStat);
  ref('balance.actions', 'stat', b.actions.stat);
  Object.keys(b.totalCounters).forEach((k) => ref('balance.totalCounters', 'resource', k));
  b.roleLossOrder.forEach((r) => ref('balance.roleLossOrder', 'role', r));
  ref('balance.newcomerRole', 'role', b.newcomerRole);
  if (b.warnTurn >= b.turnLimit) err('balance', 'warnTurn은 turnLimit보다 작아야 한다');
  if (b.actions.min > b.actions.max) err('balance.actions', 'min > max');

  // ── 4. 생애 단계, 직책 ──
  for (const st of def.lifeStages) {
    if (st.next !== null) {
      ref(`lifeStage.${st.id}`, 'stage', st.next);
      if (st.turnsToNext <= 0) err(`lifeStage.${st.id}`, 'turnsToNext는 0보다 커야 한다');
    }
  }
  const chiefOffices = def.offices.filter((o) => o.isChief);
  if (chiefOffices.length !== 1) err('offices', `족장 직책(isChief)은 정확히 하나여야 한다 (현재 ${chiefOffices.length})`);

  // ── 5. 지역 ──
  for (const r of def.content.regions) {
    for (const s of def.seasons) if (r.foodMul[s.id] === undefined) err(`region.${r.id}`, `foodMul에 계절 ${s.id}가 없다`);
    r.revealedFrom.forEach((x) => ref(`region.${r.id}.revealedFrom`, 'region', x));
  }

  // ── 6. 프리셋 ──
  for (const p of def.startPresets) {
    const w = `preset.${p.id}`;
    Object.keys(p.roles).forEach((r) => ref(w, 'role', r));
    Object.keys(p.resources).forEach((r) => ref(w, 'resource', r));
    Object.keys(p.axes).forEach((a) => ref(w, 'axis', a));
    const sum = Object.values(p.roles).reduce((a, x) => a + x, 0);
    if (sum !== p.population) err(w, `역할 합계(${sum})가 인구(${p.population})와 다르다`);
    ref(w, 'lifestyle', p.lifestyle);
    ref(w, 'era', p.era);
    ref(w, 'region', p.region);
    const personIds = new Set<string>();
    let chiefs = 0;
    for (const person of p.people) {
      const pw = `${w}.people.${person.id}`;
      if (personIds.has(person.id)) err(pw, '중복 인물 id');
      personIds.add(person.id);
      ref(pw, 'stage', person.stage);
      if (person.office) ref(pw, 'office', person.office);
      if (person.office && person.office === chiefOffices[0]?.id) chiefs++;
      person.traits.forEach((t) => ref(pw, 'personTrait', t));
      if (person.traits.length < 1 || person.traits.length > 2) warn(pw, '인물 특성은 1~2개를 권장한다');
    }
    for (const person of p.people)
      for (const parent of person.parents)
        if (parent !== null && !personIds.has(parent)) err(`${w}.people.${person.id}`, `존재하지 않는 부모: ${parent}`);
    if (chiefs !== 1) err(w, `족장이 정확히 한 명이어야 한다 (현재 ${chiefs})`);
    if (p.people.length < 4 || p.people.length > 8) warn(w, `인물 수 ${p.people.length} (권장 4~8)`);
  }

  // ── 7. 문자열 키 ──
  const need = (where: string, key: string) => {
    if (strings[key] === undefined) err(where, `문자열 키 없음: ${key}`);
  };
  const needLabel = (where: string, l: Label) => {
    if ('key' in l) need(where, l.key);
  };
  need('chapter', `chapter.${def.id}.title`);
  need('chapter.scale', def.scale.labelKey);
  def.resources.forEach((r) => need('resources', `resource.${r.id}.name`));
  def.axes.forEach((a) => {
    need('axes', `axis.${a.id}.neg`);
    need('axes', `axis.${a.id}.pos`);
  });
  def.roles.forEach((r) => need('roles', `role.${r.id}.name`));
  def.seasons.forEach((s) => need('seasons', `season.${s.id}.name`));
  def.eras.forEach((e) => need('eras', `era.${e.id}.name`));
  def.lifestyles.forEach((l) => need('lifestyles', `lifestyle.${l.id}.name`));
  def.lifeStages.forEach((s) => need('lifeStages', `stage.${s.id}.name`));
  def.offices.forEach((o) => need('offices', `office.${o.id}.name`));
  def.content.personTraits.forEach((t) => need('personTraits', `trait.person.${t.id}.name`));
  def.content.tribeTraits.forEach((t) => need('tribeTraits', `trait.tribe.${t.id}.name`));
  def.content.regions.forEach((r) => need('regions', `region.${r.id}.name`));
  def.content.endings.forEach((e) => {
    need('endings', `ending.${e.id}.title`);
    need('endings', `ending.${e.id}.text`);
  });
  def.startPresets.forEach((p) => {
    needLabel(`preset.${p.id}`, p.tribeName);
    p.people.forEach((x) => needLabel(`preset.${p.id}.people.${x.id}`, x.name));
  });

  // ── 8. 테마, 결말 ──
  for (const t of REQUIRED_THEME_TOKENS) if (!def.theme.tokens[t]) err('theme', `토큰 없음: ${t}`);
  if (!def.content.endings.some((e) => e.kind === 'survival')) err('endings', '생존(시간 종료) 결말이 하나 이상 필요하다');

  return issues;
}
