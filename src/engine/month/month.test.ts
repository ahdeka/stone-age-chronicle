import { describe, expect, it } from 'vitest';
import { STAY, ch1, choose, defWith, newGame, pick, run, sumLedger, tweakDef } from '../../test/fixtures';
import { applyCommand, reduce } from '../core/reduce';
import { firstChoice, playMonths } from '../headless';
import { ageYears, band, dailyFoodTotal, living, population } from '../people/people';
import { totalKg } from '../stores/food';
import { workers } from '../conditions/evaluate';
import { phaseNo } from '../core/lookup';
import type { ChapterDefinition, EventDef, GameState, PolicyTemplate } from '../types';

/** 날씨를 맑음으로 고정하고 마을 사건을 끈 정의 */
function calm(fn?: (d: ChapterDefinition) => void, policies: PolicyTemplate[] = [STAY]): ChapterDefinition {
  return defWith(policies, (d) => {
    d.calendar.months = d.calendar.months.map((m) => ({ ...m, weather: { clear: 1 } }));
    d.balance.events.villageChancePerMonth = 0;
    fn?.(d);
  });
}

/** 넉넉한 식량과 장작 */
function plenty(s: GameState): GameState {
  s.stores.food = [{ kind: 'dried_meat', kg: 5000 }];
  s.stores.firewood = 5000;
  return s;
}

const T_EVENT: EventDef = {
  id: 't_event',
  scope: 'policy',
  slots: ['mid'],
  when: [],
  weight: 1,
  cooldown: 0,
  scene: { bg: 'bg.steppe' },
  options: [
    { id: 'a', effects: [{ type: 'firewood', kg: -10 }] },
    { id: 'b', requires: [{ type: 'flag', id: 'nope' }], effects: [] },
  ],
};

const HAUL = (place: string, kg: number): PolicyTemplate => ({
  id: 'test_haul',
  category: 'test',
  appearsWhen: [],
  priority: 1000,
  cooldown: 0,
  crew: { min: 2, max: 2, keepHome: 0 },
  place,
  scene: { bg: '{place}' },
  steps: { late: [{ kind: 'narrate', effects: [{ type: 'food', kind: 'raw_meat', kg, haul: true }] }, { kind: 'carry' }] },
});

describe('게임 생성과 월초 보고', () => {
  it('제1달 낙엽달, 방침 선택 단계, 34명이 프리셋 나이대로', () => {
    const s = newGame();
    expect(s.month).toBe(1);
    expect(s.step).toBe('policy');
    expect(s.work.reports[0]!.slot).toBe('briefing');
    expect(population(s)).toBe(34);
    const counts = { child: 0, adult: 0, elder: 0 };
    for (const p of living(s)) counts[band(ch1, s, p)]++;
    expect(counts).toEqual({ child: 12, adult: 18, elder: 4 });
    const preset = ch1.presets[0]!;
    for (const pp of preset.people) expect(ageYears(s, s.people[pp.id]!)).toBe(pp.age);
  });

  it('방침 후보는 3~5개이고 버티기 방침이 늘 들어간다', () => {
    const s = newGame();
    expect(s.work.candidates.length).toBeGreaterThanOrEqual(3);
    expect(s.work.candidates.length).toBeLessThanOrEqual(5);
    expect(s.work.candidates.some((c) => c.policyId === 'hold_and_ration')).toBe(true);
  });

  it('대사냥 원정대: 족장은 남고, 사냥 우두머리가 이끈다', () => {
    const s = newGame();
    const hunt = s.work.candidates.find((c) => c.policyId === 'reindeer_big_hunt')!;
    expect(hunt.crew).toHaveLength(14);
    expect(hunt.crew).not.toContain('maru');
    expect(hunt.leaderId).toBe('bawi');
    expect(hunt.crew).toContain('bawi');
  });
});

describe('한 달의 진행', () => {
  it('방침을 고르면 상순·중순·하순·정산까지 미리 계산한다', () => {
    const def = calm();
    const s = pick(def, plenty(newGame('m', def)), 'test_stay');
    expect(s.step).toBe('settlement');
    expect(s.work.reports.map((r) => r.slot)).toEqual(['briefing', 'early', 'mid', 'late', 'settlement']);
    expect(s.history).toHaveLength(1);
  });

  it('한 달 소비 = 사람별 하루 기준량 × 30일', () => {
    const def = calm();
    const s0 = plenty(newGame('m', def));
    const need = dailyFoodTotal(def, s0) * 30;
    const s = pick(def, s0, 'test_stay');
    expect(-sumLedger(s, 'food', 'upkeep.food')).toBeCloseTo(need, 4);
  });

  it('장작은 달 기준 × 거처 배율만큼 탄다 (맑은 낙엽달 천막: 하루 4kg)', () => {
    const def = calm();
    const s = pick(def, plenty(newGame('m', def)), 'test_stay');
    expect(-sumLedger(s, 'firewood', 'upkeep.firewood')).toBeCloseTo(4 * 30, 4);
    const cave = plenty(newGame('m', def));
    cave.shelter.kind = 'rock_cave';
    expect(-sumLedger(pick(def, cave, 'test_stay'), 'firewood', 'upkeep.firewood')).toBeCloseTo(2 * 30, 4);
  });

  it('별일 없는 달은 평온한 달로 표시된다', () => {
    const def = calm();
    const s = pick(def, plenty(newGame('m', def)), 'test_stay');
    expect(s.history[0]!.quiet).toBe(true);
  });

  it('다음 달로 넘어가면 월초 보고가 새로 생긴다', () => {
    const def = calm();
    let s = pick(def, plenty(newGame('m', def)), 'test_stay');
    s = run(def, s, { type: 'nextMonth' });
    expect(s.month).toBe(2);
    expect(s.step).toBe('policy');
    expect(s.work.reports).toHaveLength(1);
  });
});

describe('중간 사건', () => {
  const policy: PolicyTemplate = { ...STAY, id: 'test_window', steps: { mid: [{ kind: 'eventWindow', pool: ['t_event'], chance: 1 }] } };
  const def = calm((d) => d.content.events.push(T_EVENT), [policy]);

  it('중순에서 멈추고 선택을 기다린다', () => {
    const s = pick(def, plenty(newGame('e', def)), 'test_window');
    expect(s.step).toBe('decision');
    expect(s.work.decision).toMatchObject({ kind: 'event', eventId: 't_event', slot: 'mid' });
    expect(s.work.reports.map((r) => r.slot)).toEqual(['briefing', 'early', 'mid']);
  });

  it('잠긴 선택지는 거부하고, 고른 뒤에는 정산까지 이어서 계산한다', () => {
    const s = pick(def, plenty(newGame('e', def)), 'test_window');
    const r = reduce(def, s, { type: 'chooseOption', uid: s.work.decision!.uid, optionId: 'b' });
    expect(r.error).toBe('error.optionLocked');
    expect(r.state).toBe(s);
    const done = choose(def, s, 'a');
    expect(done.step).toBe('settlement');
    expect(sumLedger(done, 'firewood', 'event.t_event')).toBe(-10);
    expect(done.history[0]!.quiet).toBe(false);
  });

  it('마을 소식은 방침과 무관하게 중순에 판정한다', () => {
    const d2 = calm((d) => {
      d.balance.events.villageChancePerMonth = 1;
    });
    const s = pick(d2, plenty(newGame('v', d2)), 'test_stay');
    expect(s.step).toBe('decision');
    expect(s.work.decision).toMatchObject({ kind: 'event', eventId: 'wolves_circle_camp' });
  });
});

describe('운반 한계와 남은 고기', () => {
  it('먼 곳: 한 번에 나를 수 있는 만큼만 가져오고 남은 양의 처리를 묻는다', () => {
    const def = calm(undefined, [HAUL('reindeer_ford', 200)]);
    const s = pick(def, plenty(newGame('c', def)), 'test_haul');
    expect(s.step).toBe('decision');
    expect(s.work.decision).toMatchObject({ kind: 'leftover' });
    const cap = 2 * def.balance.stats['carry.perPerson']!;
    expect(sumLedger(s, 'food', 'policy.test_haul')).toBeCloseTo(cap, 4);
    expect((s.work.decision as { kg: number }).kg).toBeCloseTo(200 - cap, 4);
  });

  it('묻으면 은닉물이 생기고, 한 달 뒤 회수 방침은 "결과를 알 수 없다"', () => {
    const def = calm(undefined, [HAUL('reindeer_ford', 200), ch1.content.policies.find((p) => p.id === 'recover_cache')!]);
    let s = pick(def, plenty(newGame('c', def)), 'test_haul');
    s = choose(def, s, 'cache');
    expect(s.step).toBe('settlement');
    expect(s.caches).toHaveLength(1);
    expect(s.caches[0]!.place).toBe('reindeer_ford');
    expect(totalKg(s.caches[0]!.lots)).toBeGreaterThan(100);
    s = run(def, s, { type: 'nextMonth' });
    expect(s.work.candidates.find((c) => c.policyId === 'recover_cache')?.hint).toBe('unknown');
  });

  it('말려서 가져오기는 고기 말리기를 알아야 한다', () => {
    const def = calm(undefined, [HAUL('reindeer_ford', 200)]);
    const s = pick(def, plenty(newGame('c', def)), 'test_haul');
    expect(reduce(def, s, { type: 'chooseOption', uid: s.work.decision!.uid, optionId: 'dry' }).error).toBe('error.optionLocked');
    const s2 = plenty(newGame('c', def));
    s2.knowledge.has.push('meat_drying');
    const done = choose(def, pick(def, s2, 'test_haul'), 'dry');
    const left = 200 - 2 * def.balance.stats['carry.perPerson']!;
    expect(sumLedger(done, 'food', 'leftover.dry')).toBeCloseTo(left * def.balance.carry.dryYield, 4);
  });

  it('가까운 곳: 여러 번 왕복해 운반 한계를 넘는다', () => {
    const def = calm(undefined, [HAUL('north_forest', 180)]);
    const s = pick(def, plenty(newGame('c', def)), 'test_haul');
    expect(s.step).toBe('settlement');
    expect(sumLedger(s, 'food', 'policy.test_haul')).toBeCloseTo(180, 4);
    expect(s.work.vars['trips']).toBe(def.balance.carry.maxTrips);
  });
});

describe('굶주림, 부상, 병', () => {
  const starving = calm((d) => {
    d.places = d.places.map((p) => (p.id === 'river_bend' ? { ...p, yields: {} } : p));
  });

  it('식량이 없으면 굶주림 단계가 되고 덜 먹은 날이 쌓이며 결속이 준다', () => {
    const s0 = newGame('h', starving);
    s0.stores.food = [];
    s0.stores.firewood = 5000;
    const s = pick(starving, s0, 'test_stay');
    expect(s.hungerStage).toBe(2);
    expect(s.cohesion).toBeLessThan(s0.cohesion);
    for (const p of living(s)) expect(p.hungerDays).toBeCloseTo(30, 6);
  });

  it('쓰러짐은 덜 먹은 날이 기준을 넘은 사람에게만 온다 (약한 사람의 기준이 낮다)', () => {
    const def = calm((d) => {
      d.balance.ration.collapseChance = 1;
      d.balance.ration.collapseMax = 1;
    });
    const s0 = plenty(newGame('h', def));
    // 먹고 나면 회복분만큼 줄어든 뒤에 쓰러짐을 판정한다
    const h = def.balance.ration.collapseDays.vulnerable + def.balance.ration.recoverPerPhase;
    s0.people['dotori']!.hungerDays = h; // 아이
    s0.people['galdae']!.hungerDays = h; // 성인: 기준이 더 높아 아직 아래
    const s = pick(def, s0, 'test_stay');
    expect(s.people['dotori']!.alive).toBe(false);
    expect(s.people['dotori']!.cause).toBe('hunger');
    expect(s.people['galdae']!.alive).toBe(true);
  });

  it('부상자는 일하지 못하고, 정해진 순이 지나면 회복한다', () => {
    const def = calm();
    const s0 = plenty(newGame('i', def));
    const w0 = workers(def, s0);
    s0.people['galdae']!.ailments.push({ kind: 'fracture', severity: 2, healsAt: phaseNo(s0) + 2 });
    expect(workers(def, s0)).toBe(w0 - 1);
    const s = pick(def, s0, 'test_stay');
    expect(s.people['galdae']!.ailments).toEqual([]);
    expect(s.work.reports.flatMap((r) => r.lines).some((l) => l.key === 'line.healed')).toBe(true);
  });

  it('장작이 떨어지면 추위가 약한 사람을 해친다', () => {
    const def = calm((d) => {
      d.balance.cold.sickChance = 1;
      d.balance.cold.deathChance = 0;
      d.balance.chores.firewoodShareLow = 0;
      d.balance.chores.firewoodShareNormal = 0;
    });
    const s0 = newGame('cold', def);
    s0.stores.food = [{ kind: 'dried_meat', kg: 5000 }];
    s0.stores.firewood = 0;
    const s = pick(def, s0, { ...STAY }.id);
    const sick = living(s).filter((p) => p.ailments.some((a) => a.kind === def.balance.cold.sickness));
    expect(sick.length).toBeGreaterThan(0);
    for (const p of sick) expect(['child', 'elder']).toContain(band(def, s, p));
  });
});

describe('세계의 기억', () => {
  it('예약 사건은 기한 창 안에서 조건이 맞는 첫 달 월초에 온다', () => {
    const def = calm();
    let s = plenty(newGame('r', def));
    s.scheduled.push({ uid: 's1', event: 'reed_lake_return', from: 2, to: 4 });
    s = pick(def, s, 'test_stay');
    s = run(def, s, { type: 'nextMonth' });
    expect(s.step).toBe('decision');
    expect(s.work.decision).toMatchObject({ kind: 'event', eventId: 'reed_lake_return', slot: 'briefing' });
    s = choose(def, s, 'learn');
    expect(s.step).toBe('policy');
    expect(s.scheduled).toEqual([]);
  });

  it('조건이 끝내 맞지 않으면 기한이 지나 사라진다', () => {
    const def = calm();
    const s = plenty(newGame('r', def));
    s.scheduled.push({ uid: 's1', event: 'reed_lake_return', from: 2, to: 2, when: [{ type: 'flag', id: 'never' }] });
    playMonths(def, s, firstChoice, 3);
    expect(s.scheduled).toEqual([]);
    expect(s.history.flatMap((h) => h.reports).some((r) => r.lines.some((l) => l.key === 'event.reed_lake_return.title'))).toBe(false);
  });

  it('은닉물은 냄새가 쌓이면 짐승에게 털린다 (플레이어는 확인하기 전까지 모른다)', () => {
    const def = calm((d) => {
      d.balance.cache.raidChancePerScent = 1;
      d.balance.cache.raidLoss = [0.5, 0.5];
    });
    let s = plenty(newGame('k', def));
    s.caches.push({ id: 'k1', place: 'reindeer_ford', lots: [{ kind: 'raw_meat', kg: 200 }], month: 1, scent: 0, checkedMonth: 1 });
    s = pick(def, s, 'test_stay');
    const before = totalKg(s.caches[0]!.lots);
    s = run(def, s, { type: 'nextMonth' });
    expect(totalKg(s.caches[0]!.lots)).toBeCloseTo(before * 0.5, 4);
    expect(s.caches[0]!.checkedMonth).toBe(1);
  });

  it('같은 일을 되풀이하면 지식이 자란다', () => {
    const practice: PolicyTemplate = { ...STAY, id: 'test_practice', knowledgeProgress: { ice_fishing: 1 } };
    const def = calm(undefined, [practice]);
    const s = plenty(newGame('kn', def));
    const need = def.knowledge.find((k) => k.id === 'ice_fishing')!.need;
    playMonths(def, s, { pickPolicy: (_d, st) => st.work.candidates.find((c) => c.policyId === 'test_practice')!.uid, pickOption: (_d, _s, _x, o) => o[0]! }, need);
    expect(s.knowledge.has).toContain('ice_fishing');
  });
});

describe('결말', () => {
  it('모두 죽으면 멸족', () => {
    const def = calm();
    let s = plenty(newGame('end', def));
    for (const p of living(s)) s = run(def, s, { type: 'debug', debug: { op: 'kill', personId: p.id } });
    s = pick(def, s, 'test_stay');
    expect(s.step).toBe('ended');
    expect(s.ending).toMatchObject({ id: 'ruin_extinct', kind: 'defeat' });
  });

  it('결속이 낮은 달이 이어지면 분열', () => {
    const def = calm();
    const s = plenty(newGame('end', def));
    s.cohesion = 1;
    s.counters['low_cohesion_months'] = 2;
    const done = pick(def, s, 'test_stay');
    expect(done.ending?.id).toBe('ruin_split');
  });

  it('제한 달에 이르면 생존 결말', () => {
    const def = calm((d) => {
      d.content.endings = d.content.endings.map((e) => (e.id === 'survive_time' ? { ...e, check: [{ type: 'month', min: 2 }] } : e));
    });
    const s = plenty(newGame('end', def));
    playMonths(def, s, firstChoice, 5);
    expect(s.ending).toEqual({ id: 'survive_time', kind: 'survival', month: 2 });
    expect(applyCommand(def, s, { type: 'nextMonth' })).toBe('error.gameEnded');
  });
});

describe('결정론과 순수성', () => {
  it('같은 시드와 같은 선택이면 같은 결과, 다른 시드면 다른 결과', () => {
    const a = newGame('same');
    const b = newGame('same');
    playMonths(ch1, a, firstChoice, 6);
    playMonths(ch1, b, firstChoice, 6);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = newGame('other');
    playMonths(ch1, c, firstChoice, 6);
    expect(JSON.stringify(c.history)).not.toBe(JSON.stringify(a.history));
  });

  it('reduce는 입력 상태를 바꾸지 않는다', () => {
    const s = newGame();
    const snapshot = JSON.stringify(s);
    const r = reduce(ch1, s, { type: 'choosePolicy', uid: s.work.candidates[0]!.uid });
    expect(r.error).toBeUndefined();
    expect(r.state).not.toBe(s);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('지금 단계에 맞지 않는 명령은 거부한다', () => {
    const s = newGame();
    expect(reduce(ch1, s, { type: 'nextMonth' }).error).toBe('error.wrongStep');
    expect(reduce(ch1, s, { type: 'chooseOption', uid: 'x', optionId: 'y' }).error).toBe('error.wrongStep');
    expect(reduce(ch1, s, { type: 'choosePolicy', uid: 'nope' }).error).toBe('error.unknownPolicy');
  });

  it('기본 정의로 1장을 끝까지 헤드리스로 진행할 수 있다', () => {
    const def = tweakDef(() => {});
    const s = newGame('full', def);
    playMonths(def, s, firstChoice, def.balance.monthLimit + 1);
    expect(s.step).toBe('ended');
  });
});
