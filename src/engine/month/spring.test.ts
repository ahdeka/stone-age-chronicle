// 봄 시작 첫 해의 엔진 규칙 (DESIGN.md §15.3): 봄 프리셋, 계절 수확, 말리기, 장작 한계, 묻은 고기 후보, 짐꾼
import { describe, expect, it } from 'vitest';
import { ch1, finishMonth, newGame, pick, run, springGame } from '../../test/fixtures';
import { calendarDate } from '../core/lookup';
import { applyEffects } from '../effects/apply';
import { runCtx, leftoverAvailable, chooseOption } from './month';
import { foodDays } from '../conditions/evaluate';
import { stat } from '../stats/stats';
import { totalKg } from '../stores/food';
import { cacheTargets, generateCandidates } from '../policy/candidates';

describe('봄 시작', () => {
  it('1년차 3월, 34명, 식량 120kg(4일치), 장작 80kg, 노인 한 명이 기침', () => {
    const s = springGame();
    expect(calendarDate(ch1, s)).toMatchObject({ year: 1, season: 'spring', number: 3 });
    expect(Object.values(s.people).filter((p) => p.alive)).toHaveLength(34);
    expect(totalKg(s.stores.food)).toBeCloseTo(120);
    expect(Math.floor(foodDays(ch1, s))).toBe(4);
    expect(s.stores.firewood).toBe(80);
    expect(s.people['eoksae']!.ailments[0]?.kind).toBe('cough');
    expect(s.animals['fish']!.state).toBe('running');
  });

  it('첫 달 후보에 "거의 확실하다" 먹을거리 전략이 있고, 그것만으로 3월에 굶주리지 않는다', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      let s = springGame(seed);
      const safe = s.work.candidates.filter((c) => c.hint === 'sure' && ['fish_run_weirs', 'river_gather'].includes(c.policyId));
      expect(safe.length, seed).toBeGreaterThan(0);
      s = finishMonth(ch1, pick(ch1, s, safe[0]!.policyId));
      expect(s.work.maxHunger, seed).toBe(0);
    }
  });

  it('봄 물고기 떼는 물고기가 오를 때만 마을 수확에 들어온다', () => {
    const s = springGame();
    expect(stat(ch1, s, 'yield.fish_run')).toBe(1);
    s.animals['fish']!.state = 'scarce';
    expect(stat(ch1, s, 'yield.fish_run')).toBe(0);
  });
});

describe('말리기와 장작 한계', () => {
  it('preserve: 날것을 말린 것으로 바꾸고 무게가 준다', () => {
    const s = springGame();
    s.stores.food = [{ kind: 'fish', kg: 100 }];
    applyEffects(runCtx(ch1, s), [{ type: 'preserve', from: ['fish'], to: 'dried_fish', maxKg: 80, yield: 0.6 }]);
    const by = Object.fromEntries(s.stores.food.map((l) => [l.kind, Math.round(l.kg)]));
    expect(by).toEqual({ fish: 20, dried_fish: 48 });
    expect(s.work.vars['preserved']).toBeCloseTo(48);
  });

  it('장작은 쌓아 둘 수 있는 만큼만 (천막 700kg, 덧집 +600, 바위굴 +900)', () => {
    const s = springGame();
    expect(stat(ch1, s, 'firewood.cap')).toBe(700);
    s.facilities['wood_shed'] = 1;
    expect(stat(ch1, s, 'firewood.cap')).toBe(1300);
    s.shelter.kind = 'rock_cave';
    expect(stat(ch1, s, 'firewood.cap')).toBe(2200);
  });
});

describe('묻은 고기 회수와 짐꾼 (S9, S10)', () => {
  it('묻은 곳마다 회수 후보가 하나씩, 그 곳으로 간다', () => {
    const s = newGame('cache');
    s.caches.push(
      { id: 'k1', place: 'reindeer_ford', lots: [{ kind: 'raw_meat', kg: 250 }], month: 1, scent: 0, checkedMonth: 1 },
      { id: 'k2', place: 'north_forest', lots: [{ kind: 'raw_meat', kg: 90 }], month: 1, scent: 0, checkedMonth: 1 },
    );
    // 많이 묻은 곳 → 가까운 곳 순
    expect(cacheTargets(ch1, s)).toEqual(['reindeer_ford', 'north_forest']);
    s.work.candidates = generateCandidates(ch1, s);
    const rec = s.work.candidates.filter((c) => c.policyId === 'recover_cache');
    expect(rec.length).toBeGreaterThan(0);
    for (const c of rec) expect(['reindeer_ford', 'north_forest']).toContain(c.place);
    // 고르면 그 곳이 이번 달의 곳이 된다
    const chosen = run(ch1, s, { type: 'choosePlan', uids: [rec[0]!.uid] });
    expect(chosen.work.plan[0]!.place).toBe(rec[0]!.place);
  });

  it('짐꾼은 4일 이내의 곳에서만, 나를 수 있는 만큼 나르고 마을 일이 준다', () => {
    const s = newGame('porters');
    const hunt = s.work.candidates.find((c) => c.policyId === 'reindeer_big_hunt')!;
    s.work.plan = [{ slot: 'major', bound: { ...hunt, crew: [] }, place: 'reindeer_ford', haul: [] }];
    expect(leftoverAvailable(ch1, s, 'porters')).toBe(true);
    s.work.plan[0]!.place = 'reed_lake';
    expect(leftoverAvailable(ch1, s, 'porters')).toBe(false);
    s.work.plan[0]!.place = 'reindeer_ford';
    s.work.plan[0]!.haul = [{ kind: 'raw_meat', kg: 300 }];
    s.step = 'decision';
    s.work.phasesDone = 2;
    s.work.reports.push({ slot: 'late', scene: { bg: 'bg.steppe' }, lines: [], deltas: {}, rows: [], alerts: [], from: { food: 0, firewood: 0 } });
    s.work.decision = { uid: 'd1', kind: 'leftover', kg: 300 };
    const before = totalKg(s.stores.food);
    expect(chooseOption(ch1, s, 'd1', 'porters')).toBeUndefined();
    const carried = s.work.ledger.find((l) => l.source === 'leftover.porters')!.delta;
    expect(carried).toBeCloseTo(8 * 32);
    expect(totalKg(s.stores.food)).toBeGreaterThan(before);
  });
});
