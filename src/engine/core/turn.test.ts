import { describe, expect, it } from 'vitest';
import { ch1, endTurns, newGame, run, tweakDef } from '../../test/fixtures';
import { ch1Numbers } from '../../data/chapters/ch1/balance';
import type { GameState, LogEntry } from '../types';

/** 수치는 balance에서 읽는다 — 밸런스를 조정해도 테스트가 의미를 잃지 않게 */
const B = ch1.balance.stats;

const lastLog = (s: GameState): LogEntry[] => s.history[s.history.length - 1]!.log;
const sumBy = (log: LogEntry[], source: string, key: string) =>
  log
    .filter((l): l is Extract<LogEntry, { kind: 'resource' }> => l.kind === 'resource' && l.source === source && l.key === key)
    .reduce((a, l) => a + l.delta, 0);

describe('turn loop', () => {
  it('게임 생성 직후 1턴 봄, 행동 단계, 제1대', () => {
    const s = newGame();
    expect(s.turn).toBe(1);
    expect(s.season).toBe('spring');
    expect(s.phase).toBe('action');
    expect(s.reign).toBe(1);
    expect(s.actions.playsLeft).toBe(2);
  });

  it('계절은 봄 → 여름 → 가을 → 겨울 → 봄으로 돈다', () => {
    let s = newGame();
    const seasons = [s.season];
    for (let i = 0; i < 4; i++) {
      s = endTurns(ch1, s, 1);
      seasons.push(s.season);
    }
    expect(seasons).toEqual(['spring', 'summer', 'autumn', 'winter', 'spring']);
  });

  it('겨울에는 같은 인구라도 더 먹는다', () => {
    const s = endTurns(ch1, newGame(), 3); // 겨울 시작
    expect(s.season).toBe('winter');
    const after = endTurns(ch1, s, 1);
    const eaten = -sumBy(lastLog(after), 'upkeep.food', 'food');
    expect(eaten).toBeCloseTo(s.tribe.population * B['consume.food']! * ch1Numbers.season.winter.consume, 4);
  });

  it('생산은 역할 배분을 따른다: 채집만 하면 사냥 산출이 없다', () => {
    let s = newGame();
    s = run(ch1, s, { type: 'setRoles', roles: { gather: 12, hunt: 0, craft: 0, ritual: 0, guard: 0 } });
    s = endTurns(ch1, s, 1);
    const log = lastLog(s);
    expect(sumBy(log, 'role.hunt', 'food')).toBe(0);
    expect(sumBy(log, 'role.gather', 'food')).toBeCloseTo(12 * B['yield.gather']! * ch1Numbers.season.spring.gather, 4);
  });

  it('의례는 전승과 결속을 만들고 누적 전승 카운터에 더한다', () => {
    let s = newGame();
    s = run(ch1, s, { type: 'setRoles', roles: { gather: 6, hunt: 2, craft: 0, ritual: 4, guard: 0 } });
    s = endTurns(ch1, s, 1);
    expect(s.tribe.resources['lore']).toBeCloseTo(2, 4);
    expect(s.counters['lore_total']).toBeCloseTo(2, 4);
  });

  it('저장 상한을 넘는 식량은 버리고 남은 식량은 상한다', () => {
    let s = newGame();
    s = run(ch1, s, { type: 'debug', debug: { op: 'setResource', key: 'food', value: 500 } });
    s = endTurns(ch1, s, 1);
    const cap = 12 * B['storage.food.perPop']!;
    // 상한까지 잘린 뒤 상함 (인구 증가는 결산 후반이라 상한 계산에 영향 없음)
    expect(s.tribe.resources['food']).toBeCloseTo(cap * (1 - B['spoil.food']!), 4);
  });

  it('식량이 모자라면 결속이 줄고, 2턴 연속이면 인구가 준다', () => {
    let s = newGame();
    s = run(ch1, s, { type: 'setRoles', roles: { gather: 0, hunt: 0, craft: 6, ritual: 6, guard: 0 } });
    s = run(ch1, s, { type: 'debug', debug: { op: 'setResource', key: 'food', value: 0 } });
    const c0 = s.tribe.resources['cohesion']!;
    s = endTurns(ch1, s, 1);
    expect(s.tribe.hunger).toBe(1);
    expect(s.tribe.population).toBe(12);
    expect(s.tribe.resources['cohesion']!).toBeLessThan(c0);
    s = endTurns(ch1, s, 1);
    expect(s.tribe.hunger).toBe(2);
    expect(s.tribe.population).toBe(10); // ceil(12 × 0.1) = 2명
    expect(Object.values(s.tribe.roles).reduce((a, b) => a + b, 0)).toBe(10);
  });

  it('잘 먹고 결속이 충분하면 인구가 는다', () => {
    let s = newGame();
    s = run(ch1, s, { type: 'debug', debug: { op: 'setResource', key: 'food', value: 45 } });
    s = endTurns(ch1, s, 4);
    expect(s.tribe.population).toBeGreaterThan(12);
    expect(Object.values(s.tribe.roles).reduce((a, b) => a + b, 0)).toBe(s.tribe.population);
  });

  it('도구는 인구에 비례해 닳는다', () => {
    let s = newGame();
    s = run(ch1, s, { type: 'setRoles', roles: { gather: 8, hunt: 4, craft: 0, ritual: 0, guard: 0 } });
    s = endTurns(ch1, s, 1);
    expect(s.tribe.resources['tools']).toBeCloseTo(8 - 12 * B['wear.tools']!, 4);
  });

  it('지역 고갈이 쌓여 채집 산출을 줄인다', () => {
    let s = newGame();
    s = run(ch1, s, { type: 'setRoles', roles: { gather: 12, hunt: 0, craft: 0, ritual: 0, guard: 0 } });
    s = endTurns(ch1, s, 4); // 다시 봄, 고갈 0.12
    expect(s.regions.state['grey_wolf_hill']!.depletion).toBeCloseTo(0.12, 4);
    const pop = s.tribe.population;
    const gatherers = s.tribe.roles['gather']!;
    s = endTurns(ch1, s, 1);
    expect(sumBy(lastLog(s), 'role.gather', 'food')).toBeCloseTo(gatherers * 1.6 * 1.2 * 0.88, 3);
    expect(pop).toBeGreaterThan(0);
  });

  it('인물은 정해진 턴이 지나면 다음 생애 단계로 넘어간다', () => {
    // 이끼: 청년, stageTurns 9, 청년→장년 12턴 → 3턴 결산 후 장년
    let s = endTurns(ch1, newGame(), 2);
    expect(s.people['p_ikki']!.stage).toBe('youth');
    s = endTurns(ch1, s, 1);
    expect(s.people['p_ikki']!.stage).toBe('adult');
    expect(s.people['p_ikki']!.stageTurns).toBe(0);
    expect(lastLog(s)).toContainEqual({ kind: 'stage', personId: 'p_ikki', to: 'adult', source: 'aging' });
  });

  it('제한 턴에 도달하면 생존 결말로 끝난다', () => {
    const def = tweakDef((d) => {
      d.balance.turnLimit = 3;
      d.content.endings = d.content.endings.map((e) =>
        e.id === 'survive_basic' ? { ...e, check: [{ type: 'turn', min: 3 }] } : e,
      );
    });
    const s = endTurns(def, newGame('t', def), 10);
    expect(s.phase).toBe('ended');
    expect(s.ending).toEqual({ id: 'survive_basic', kind: 'survival', turn: 3 });
    expect(s.history).toHaveLength(3);
  });

  it('인구가 0이 되면 멸족 결말이 시간 종료보다 먼저다', () => {
    let s = newGame();
    s = run(ch1, s, { type: 'debug', debug: { op: 'setPopulation', value: 0 } });
    s = endTurns(ch1, s, 1);
    expect(s.ending?.id).toBe('ruin_extinct');
  });
});
