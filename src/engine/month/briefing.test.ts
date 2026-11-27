import { describe, expect, it } from 'vitest';
import { ch1, finishMonth, newGame, pick, pickFood, tweakDef } from '../../test/fixtures';
import { goalProgress } from '../goals/progress';
import { coldestMonthFirewood, cohesionBand, crewSplit } from '../display';
import { sumLedger } from './month';
import { buildAdvice } from '../advice/advice';

describe('월초 보고', () => {
  it('첫 달: 기록과 같은 머리글과 소식, 상황 칩, 초원 장면', () => {
    const s = newGame('brief');
    const b = s.work.brief!;
    expect(b.headline.key).toBe('head.herd_and_wolves');
    expect(b.news.map((n) => n.key)).toEqual(['news.reindeer.migrating', 'news.wolves.near', 'news.seori.early_frost']);
    expect(b.chips.map((c) => c.key)).toEqual(expect.arrayContaining(['chip.reindeer.migrating', 'chip.wolves.near']));
    expect(b.chips.find((c) => c.key === 'chip.wolves.near')?.tone).toBe('warn');
    expect(b.scene.bg).toBe('bg.steppe');
  });

  it('소식은 우선순위 순으로 최대 maxNews개', () => {
    const s = newGame('brief');
    expect(s.work.brief!.news.length).toBeLessThanOrEqual(ch1.balance.ui.maxNews);
  });

  it('맞는 머리글이 없으면 계절 머리글', () => {
    const def = tweakDef((d) => {
      d.briefing.headlines = [];
    });
    expect(newGame('brief', def).work.brief!.headline.key).toBe('brief.headline.autumn');
  });
});

describe('조언', () => {
  it('조언자 넷이 서로 다른 방침을 민다 (조언이 엇갈린다)', () => {
    const s = newGame('advice');
    const a = s.work.advice;
    expect(a.map((x) => x.personId)).toEqual(['bawi', 'seori', 'noeul', 'ikki']);
    const backed = a.map((x) => x.policyUid);
    expect(new Set(backed).size).toBe(Math.min(a.length, s.work.candidates.length));
    const byPolicy = (pid: string) => s.work.candidates.find((c) => c.policyId === pid)?.uid;
    expect(a.find((x) => x.personId === 'bawi')!.policyUid).toBe(byPolicy('reindeer_big_hunt'));
    expect(a.find((x) => x.personId === 'bawi')!.line.key).toBe('advice.bawi.big_hunt');
  });

  it('조언자가 죽으면 조언하지 않는다', () => {
    const s = newGame('advice');
    s.people['bawi']!.alive = false;
    const a = buildAdvice(ch1, s);
    expect(a.map((x) => x.personId)).toEqual(['seori', 'noeul', 'ikki']);
  });
});

describe('시대 목표 진행도', () => {
  it('잴 수 없는 길은 null, 부족의 확장은 전부 null', () => {
    const g = goalProgress(ch1, newGame('goal'));
    const food = g.find((x) => x.id === 'food_stability')!;
    expect(food.paths.find((p) => p.id === 'first_harvest')!.pct).toBeNull();
    expect(food.paths.find((p) => p.id === 'stockpile')!.pct).toBeGreaterThan(0);
    expect(g.find((x) => x.id === 'expansion')!.pct).toBeNull();
  });

  it('바위굴에서 지낸 달과 오래 가는 식량을 잰다', () => {
    const s = newGame('goal');
    s.counters['shelter_months.rock_cave'] = 6;
    s.stores.food = [{ kind: 'dried_meat', kg: 10000 }];
    const g = goalProgress(ch1, s);
    expect(g.find((x) => x.id === 'permanent_home')!.pct).toBeCloseTo(0.5);
    expect(g.find((x) => x.id === 'food_stability')!.pct).toBe(1);
  });

  it('정산 때 거처에서 지낸 달 수가 쌓인다', () => {
    const s = finishMonth(ch1, pickFood(ch1, newGame('goal')));
    expect(s.counters['shelter_months.tent']).toBe(1);
  });
});

describe('진행 화면용 보고', () => {
  it('단계마다 장부 행, 시작·끝 식량이 있고 행의 합이 식량 변화와 같다', () => {
    const s = finishMonth(ch1, pick(ch1, newGame('rows'), 'tan_hides'));
    for (const r of s.work.reports.slice(1, 4)) {
      expect(r.to).toBeDefined();
      const sum = r.rows.filter((x) => x.res === 'food').reduce((a, x) => a + x.delta, 0);
      expect(sum).toBeCloseTo(r.to!.food - r.from.food, 4);
      expect(r.rows.find((x) => x.source === 'upkeep.food')?.params).toEqual({ people: 34, days: 10 });
    }
  });

  it('마을 서술은 무리 이름표 "마을"로 들어간다', () => {
    const s = pick(ch1, newGame('rows'), 'tan_hides');
    const early = s.work.reports[1]!;
    expect(early.lines.some((l) => l.group === 'village' && l.key.startsWith('nar.village_work'))).toBe(true);
  });

  it('원정 사냥은 잡은 고기를 "원정지의 짐" 행으로 남긴다', () => {
    const s = pick(ch1, newGame('rows'), 'reindeer_big_hunt');
    const early = s.work.reports[1]!;
    const haul = early.rows.find((x) => x.res === 'haul');
    if (early.tier !== 'disaster') expect(haul?.source).toBe('catch.reindeer');
  });

  it('행 합치기는 같은 출처와 부호끼리, 숫자 변수도 더한다', () => {
    const rows = sumLedger([
      { res: 'food', source: 'catch.reindeer', delta: 100, params: { n: 2 } },
      { res: 'food', source: 'catch.reindeer', delta: 150, params: { n: 3 } },
      { res: 'food', source: 'upkeep.food', delta: -10 },
    ]);
    expect(rows).toEqual([
      { res: 'food', source: 'catch.reindeer', delta: 250, params: { n: 5 } },
      { res: 'food', source: 'upkeep.food', delta: -10 },
    ]);
  });
});

describe('표시용 계산', () => {
  it('가장 추운 달 장작 (천막: 하루 20kg × 30일), 결속 구간, 원정·마을 인원', () => {
    const s = newGame('disp');
    expect(coldestMonthFirewood(ch1, s)).toBeCloseTo(600);
    expect(cohesionBand(ch1, 60)).toBe('normal');
    expect(cohesionBand(ch1, 5)).toBe('broken');
    const hunt = s.work.candidates.find((c) => c.policyId === 'reindeer_big_hunt')!;
    expect(crewSplit(ch1, s, hunt)).toEqual({ crew: 14, village: 3 }); // 남는 일할 사람 17 − 14 (족장·노인은 세지 않는다, R2-b)
  });
});
