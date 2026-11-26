// 전략 두 칸 (DESIGN.md §6.4): 식량 + 발전, 큰 일, 일손 나누기, 시설과 "덕분에" 줄, 한 순에 사건 하나

import { describe, expect, it } from 'vitest';
import { STAY, ch1, defWith, newGame, run, springGame, sumLedger } from '../../test/fixtures';
import { applyCommand } from '../core/reduce';
import { findPolicy } from '../core/lookup';
import { firstChoice, playMonth } from '../headless';
import { previewPlan } from '../policy/plan';
import { generateCandidates } from '../policy/candidates';
import { totalKg } from '../stores/food';
import type { ChapterDefinition, Command, EventDef, GameState, PolicyTemplate } from '../types';

const FOOD: PolicyTemplate = { ...STAY, id: 't_food', slot: 'food' };

const GROW: PolicyTemplate = {
  id: 't_grow',
  slot: 'growth',
  category: 'craft',
  appearsWhen: [],
  priority: 900,
  cooldown: 0,
  crew: { min: 4, max: 4, keepHome: 0, atHome: true },
  scene: { bg: '{camp}' },
  steps: { early: [{ kind: 'narrate', effects: [{ type: 'line', key: 'line.chose', params: { option: 'x' } }] }] },
  builds: { facility: 't_rack', months: 2 },
};

/** 원정 (식량 칸 / 발전 칸): 하순에 고기를 짐으로 얻고 나른다 */
const trip = (id: string, slot: 'food' | 'growth', place: string, kg: number, keepHome = 0, size = 3): PolicyTemplate => ({
  id,
  slot,
  category: id,
  appearsWhen: [],
  priority: 800,
  cooldown: 0,
  crew: { min: size, max: size, keepHome },
  place,
  scene: { bg: '{place}' },
  steps: { late: [{ kind: 'narrate', effects: [{ type: 'food', kind: 'raw_meat', kg, haul: true }] }, { kind: 'carry' }] },
});

const BIG: PolicyTemplate = { ...trip('t_big', 'food', 'east_steppe', 10), slot: 'major', priority: 700 };

const EV: EventDef = {
  id: 't_ev',
  scope: 'policy',
  slots: ['mid'],
  when: [],
  weight: 1,
  cooldown: 0,
  scene: { bg: 'bg.steppe' },
  options: [{ id: 'a', effects: [] }],
};

function calm(policies: PolicyTemplate[], fn?: (d: ChapterDefinition) => void): ChapterDefinition {
  return defWith(policies, (d) => {
    d.calendar.months = d.calendar.months.map((m) => ({ ...m, weather: { clear: 1 } }));
    d.balance.events.villageChancePerMonth = 0;
    d.facilities = [...d.facilities, { id: 't_rack', max: 1, mods: [{ stat: 'yield.gather', op: 'mul', value: 1.5 }] }];
    fn?.(d);
  });
}

function plenty(s: GameState): GameState {
  s.stores.food = [{ kind: 'dried_meat', kg: 5000 }];
  s.stores.firewood = 5000;
  return s;
}

const uid = (s: GameState, id: string) => {
  const c = s.work.candidates.find((x) => x.policyId === id);
  if (!c) throw new Error(`not a candidate: ${id} (${s.work.candidates.map((x) => x.policyId).join(', ')})`);
  return c.uid;
};
const plan = (s: GameState, ...ids: string[]): Command => ({ type: 'choosePlan', uids: ids.map((id) => uid(s, id)) });

describe('후보와 칸 규칙', () => {
  it('식량·발전·큰 일 칸이 따로 나오고, 식량이 모자라면 버티기가 식량 칸에 있다', () => {
    const def = calm([FOOD, GROW, BIG]);
    const s = newGame('slots', def);
    expect(s.work.candidates.some((c) => c.policyId === 'hold_and_ration')).toBe(false);
    s.stores.food = [{ kind: 'dried_meat', kg: 100 }];
    s.work.candidates = generateCandidates(def, s);
    const slots = s.work.candidates.map((c) => def.content.policies.find((p) => p.id === c.policyId)!.slot);
    expect(slots).toEqual([...slots].sort((a, b) => ['major', 'food', 'growth'].indexOf(a) - ['major', 'food', 'growth'].indexOf(b)));
    expect(slots).toContain('growth');
    expect(slots).toContain('major');
    expect(s.work.candidates.some((c) => c.policyId === 'hold_and_ration')).toBe(true);
  });

  it('식량 없이 발전만, 큰 일과 다른 전략, 식량 둘은 고를 수 없다', () => {
    const def = calm([FOOD, GROW, BIG]);
    const s = plenty(newGame('rules', def));
    expect(previewPlan(def, s, [uid(s, 't_grow')]).error).toBe('error.planNeedsFood');
    expect(previewPlan(def, s, [uid(s, 't_big'), uid(s, 't_food')]).error).toBe('error.planMajorAlone');
    const short = newGame('rules', def);
    short.stores.food = [{ kind: 'dried_meat', kg: 100 }];
    short.work.candidates = generateCandidates(def, short);
    expect(previewPlan(def, short, [uid(short, 't_food'), uid(short, 'hold_and_ration')]).error).toBe('error.planNeedsFood');
    expect(previewPlan(def, s, [uid(s, 't_food'), uid(s, 't_food')]).error).toBe('error.planDuplicate');
    expect(previewPlan(def, s, [uid(s, 't_food'), uid(s, 't_grow')]).error).toBeUndefined();
    expect(previewPlan(def, s, [uid(s, 't_big')]).error).toBeUndefined();
  });
});

describe('일손 나누기', () => {
  it('발전 무리는 정해진 인원이 마을 일에서 빠지고, 그만큼 마을 식량이 준다 (대가 kg)', () => {
    const def = calm([FOOD, GROW]);
    const s = plenty(newGame('labor', def));
    const pv = previewPlan(def, s, [uid(s, 't_food'), uid(s, 't_grow')]);
    expect(pv.labor.growth).toBe(4);
    expect(pv.labor.village).toBe(pv.labor.total - 4);
    expect(pv.labor.food).toBe(pv.labor.total - 4);
    expect(pv.growthFoodCostKg).toBeGreaterThan(0);
    expect(previewPlan(def, s, [uid(s, 't_food')]).growthFoodCostKg).toBe(0);

    const alone = run(def, s, plan(s, 't_food'));
    const both = run(def, s, plan(s, 't_food', 't_grow'));
    const gathered = (x: GameState) => sumLedger(x, 'food', 'village.gather');
    expect(gathered(both)).toBeLessThan(gathered(alone));
    expect(gathered(alone) - gathered(both)).toBeCloseTo(pv.growthFoodCostKg, 0);
  });

  it('두 칸의 무리는 겹치지 않고, 마을에 남길 인원은 합쳐서 지킨다', () => {
    const hunt = trip('t_hunt', 'food', 'east_steppe', 50, 0, 8);
    const scout = trip('t_scout', 'growth', 'south_marsh', 0, 0, 4);
    const def = calm([hunt, scout]);
    const s = plenty(newGame('crew', def));
    const pv = previewPlan(def, s, [uid(s, 't_hunt'), uid(s, 't_scout')]);
    expect(pv.error).toBeUndefined();
    const [a, b] = pv.entries.map((e) => e.bound.crew);
    expect(a!.some((x) => b!.includes(x))).toBe(false);

    // 두 무리의 인원 합이 일할 수 있는 성인보다 많으면 함께 할 수 없다 (R1-c: planCrew)
    const greedy = calm([trip('t_hunt', 'food', 'east_steppe', 50, 0, 14), trip('t_scout', 'growth', 'south_marsh', 0, 8, 4)]);
    const g = plenty(newGame('crew2', greedy));
    expect(previewPlan(greedy, g, [uid(g, 't_hunt'), uid(g, 't_scout')]).error).toBe('error.planCrew');
    // 인원은 되지만 마을에 남을 사람이 모자라면 planLabor
    const home = calm([trip('t_hunt', 'food', 'east_steppe', 50, 8, 10), trip('t_scout', 'growth', 'south_marsh', 0, 0, 4)]);
    const h = plenty(newGame('crew3', home));
    expect(previewPlan(home, h, [uid(h, 't_hunt'), uid(h, 't_scout')]).error).toBe('error.planLabor');
  });

  it('원정 둘은 짐과 곳을 따로 들고 다닌다', () => {
    const def = calm([trip('t_hunt', 'food', 'east_steppe', 60), trip('t_scout', 'growth', 'south_marsh', 20)]);
    const s0 = plenty(newGame('haul', def));
    const s = run(def, s0, plan(s0, 't_hunt', 't_scout'));
    expect(s.step).toBe('settlement');
    expect(s.work.plan.map((e) => e.place)).toEqual(['east_steppe', 'south_marsh']);
    expect(sumLedger(s, 'food', 'policy.t_hunt')).toBeCloseTo(60, 4);
    expect(sumLedger(s, 'food', 'policy.t_scout')).toBeCloseTo(20, 4);
    // 발전 칸의 줄은 '발전' 무리로
    expect(s.work.reports.some((r) => r.lines.some((l) => l.group === 'growth'))).toBe(true);
  });
});

describe('한 순에 사건 하나', () => {
  it('두 칸이 같은 순에 사건 창을 열어도 하나만 열린다', () => {
    const withWindow = (p: PolicyTemplate): PolicyTemplate => ({ ...p, steps: { ...p.steps, mid: [{ kind: 'eventWindow', pool: ['t_ev'], chance: 1 }] } });
    const def = calm([withWindow(FOOD), withWindow({ ...GROW, builds: undefined })], (d) => {
      d.content.events = [...d.content.events, EV];
    });
    let s = plenty(newGame('ev', def));
    s = run(def, s, plan(s, 't_food', 't_grow'));
    expect(s.step).toBe('decision');
    s = run(def, s, { type: 'chooseOption', uid: s.work.decision!.uid, optionId: 'a' });
    expect(s.step).toBe('settlement');
    expect(s.work.events).toEqual(['t_ev']);
  });
});

describe('시설과 덕분에 줄', () => {
  it('짓는 일은 고른 달마다 나아가고, 다 지으면 시설이 오르고 후보에서 빠진다', () => {
    const def = calm([FOOD, GROW]);
    let s = plenty(newGame('build', def));
    s = run(def, s, plan(s, 't_food', 't_grow'));
    expect(s.projects['t_rack']).toBe(1);
    expect(s.facilities['t_rack']).toBeUndefined();
    s = run(def, s, { type: 'nextMonth' });
    s = run(def, s, plan(s, 't_food', 't_grow'));
    expect(s.facilities['t_rack']).toBe(1);
    expect(s.projects['t_rack']).toBeUndefined();
    expect(s.work.reports.at(-1)!.lines.some((l) => l.key === 'line.built')).toBe(true);
    s = run(def, s, { type: 'nextMonth' });
    expect(s.work.candidates.some((c) => c.policyId === 't_grow')).toBe(false);
  });

  it('시설이 늘려 준 마을 수확은 "덕분에" 줄로 따로, 행의 합은 식량 변화와 같다', () => {
    const def = calm([FOOD]);
    const s0 = plenty(newGame('bonus', def));
    s0.facilities['t_rack'] = 1;
    const s = run(def, s0, plan(s0, 't_food'));
    const bonus = sumLedger(s, 'food', 'bonus.facility.t_rack');
    const gather = sumLedger(s, 'food', 'village.gather');
    expect(bonus).toBeGreaterThan(0);
    // ×1.5 중 0.5가 시설 몫 (뿌리 채집만 늘어난다)
    const without = plenty(newGame('bonus', def));
    const base = sumLedger(run(def, without, plan(without, 't_food')), 'food', 'village.gather');
    expect(gather + bonus).toBeGreaterThan(base);
    for (const r of s.work.reports.slice(1, 4)) {
      const sum = r.rows.filter((x) => x.res === 'food').reduce((a, x) => a + x.delta, 0);
      expect(sum).toBeCloseTo(r.to!.food - r.from.food, 4);
    }
  });

  it('바위굴이면 장작을 아낀 양이 정산에 남는다 (장부 증감은 아니다)', () => {
    const def = calm([FOOD]);
    const s0 = plenty(newGame('save', def));
    s0.shelter.kind = 'rock_cave';
    const s = run(def, s0, plan(s0, 't_food'));
    const saved = s.work.savings.find((x) => x.res === 'firewood' && x.source === 'shelter.rock_cave');
    // 맑은 낙엽달: 천막 하루 4kg → 바위굴 2kg, 30일
    expect(saved?.kg).toBeCloseTo(2 * 30, 4);
    expect(s.work.reports.at(-1)!.savings).toEqual(s.work.savings);
    expect(totalKg(s.stores.food)).toBeGreaterThan(0);
  });

  it('1장 데이터 12달: 칸마다 후보는 4개를 넘지 않는다 (결정 팝업 4열, 발전은 "발전하지 않는다"를 더해 4개)', () => {
    for (const seed of ['cap-a', 'cap-b', 'cap-c']) {
      const s = springGame(seed);
      for (let m = 0; m < 12 && s.step !== 'ended'; m++) {
        if (s.step === 'settlement') applyCommand(ch1, s, { type: 'nextMonth' });
        const n = { food: 0, growth: 0, major: 0 };
        for (const c of s.work.candidates) n[findPolicy(ch1, c.policyId).slot]++;
        expect(n.food, `${seed} ${s.month}`).toBeLessThanOrEqual(4);
        expect(n.growth, `${seed} ${s.month}`).toBeLessThanOrEqual(3);
        expect(n.major, `${seed} ${s.month}`).toBeLessThanOrEqual(1);
        playMonth(ch1, s, firstChoice);
      }
    }
  });
});
