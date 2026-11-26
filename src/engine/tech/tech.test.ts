// 발전 나무 (DESIGN.md §B3, §B4.4, §B4.5, R1-b)

import { describe, expect, it } from 'vitest';
import { ch1, choose, finishMonth, keepAlive, newGame, passBriefing, pick, pickFood, run, springGame, toFirstSeason, tweakDef } from '../../test/fixtures';
import { findPolicy, getStat, stat } from '../index';
import { firstChoice, playTurn } from '../headless';
import { generateCandidates } from '../policy/candidates';
import { applyCommand } from '../core/reduce';
import { ensureTech, refreshTech } from './tech';
import { peekCell } from './query';
import type { ChapterDefinition, GameState } from '../types';

const status = (s: GameState, id: string) => peekCell(s, id).status;
const progress = (s: GameState, id: string) => peekCell(s, id).progress;
const regen = (def: ChapterDefinition, s: GameState) => {
  refreshTech(def, s);
  s.work.candidates = generateCandidates(def, s);
};
const cellCands = (def: ChapterDefinition, s: GameState) => s.work.candidates.filter((c) => findPolicy(def, c.policyId).tech).map((c) => c.policyId);
/** 이번 턴을 끝내고 다음 턴으로 (결정은 첫 선택지) */
const finishAndNext = (def: ChapterDefinition, s: GameState) => {
  const done = finishMonth(def, s);
  return passBriefing(def, run(def, done, { type: 'nextMonth' }));
};
/** 첫 계절 턴, 발전 나무는 처음 상태로 (1년차 첫 후보로 켜진 칸을 지운다) */
function freshSeason(def: ChapterDefinition, base: ChapterDefinition = def): GameState {
  const s = toFirstSeason(base);
  s.tech = {};
  ensureTech(def, s);
  regen(def, s);
  return s;
}

/** 효과 하나를 지금 상태에 적용한다 (사건 선택지처럼) */
function gift(def: ChapterDefinition, s: GameState, id: string, amount: number): GameState {
  const d = tweakDef((x) => {
    x.content.events.push({ id: 't_gift', scope: 'scheduled', slots: ['briefing'], when: [], weight: 1, cooldown: 0, scene: { bg: '{camp}' }, options: [{ id: 'ok', effects: [{ type: 'tech', id, gift: amount, by: 'ikki' }] }, { id: 'no', effects: [] }] });
  }, def);
  const next = structuredClone(s);
  if (applyCommand(d, next, { type: 'debug', debug: { op: 'forceEvent', eventId: 't_gift' } })) throw new Error('force');
  return choose(d, next, 'ok');
}

describe('칸 상태 전이와 1년차 진척', () => {
  it('처음: 갈래 첫 칸은 열림, 굴 다지기·끌개는 잠김. 1년차 발전 자리에는 칸 1개만', () => {
    const s = springGame('t1');
    expect(['stone_spear', 'grinding_stone', 'tent_repair'].map((id) => status(s, id))).toEqual(['open', 'open', 'open']);
    expect(status(s, 'cave_fortify')).toBe('locked');
    expect(status(s, 'sled')).toBe('locked');
    // 진척이 같으면 앞 칸 → 갈래 순: 사냥·물가의 돌창 손질
    expect(cellCands(ch1, s)).toEqual(['cell_stone_spear']);
    // 작은 발전(겨울 준비)이 남는 자리에 나온다
    expect(s.work.candidates.filter((c) => findPolicy(ch1, c.policyId).slot === 'growth' && !findPolicy(ch1, c.policyId).tech).length).toBeGreaterThan(0);
  });

  it('1년차 한 달 = 1/3철: 세 달이면 1철 칸이 켜지고, 갈래 끝(끌개)이 열린다', () => {
    let s = springGame('t2');
    for (let i = 0; i < 3; i++) {
      keepAlive(ch1, s);
      s = pick(ch1, s, 'cell_stone_spear');
      s = finishMonth(ch1, s);
      if (i < 2) {
        expect(progress(s, 'stone_spear')).toBeCloseTo((i + 1) / 3, 6);
        expect(status(s, 'stone_spear')).toBe('active');
        s = run(ch1, s, { type: 'nextMonth' });
      }
    }
    expect(status(s, 'stone_spear')).toBe('done');
    expect(s.work.reports.at(-1)!.lines.map((l) => l.key)).toContain('line.tech.done');
    expect(s.work.cohesionBy?.['tech.done']).toBe(ch1.balance.tech.doneCohesion);
    expect(status(s, 'sled')).toBe('open');
  });

  it('처음 시작하는 턴에 비용: 가죽이 모자라면 천막 보수를 시작할 수 없다', () => {
    const s = springGame('t3');
    s.tech['tent_repair']!.progress = 0.01; // 앞으로 끌어올려 후보에 보이게
    s.stores.goods['hide'] = 4;
    regen(ch1, s);
    expect(cellCands(ch1, s)).not.toContain('cell_tent_repair');
    s.stores.goods['hide'] = 7;
    regen(ch1, s);
    expect(cellCands(ch1, s)).toEqual(['cell_tent_repair']);
    const a = pick(ch1, s, 'cell_tent_repair');
    expect(a.stores.goods['hide']).toBe(1);
    expect(peekCell(a, 'tent_repair').costPaid).toBe(true);
  });
});

describe('선물, 건너뛰기, 갈래 끝', () => {
  it('선물은 칸의 절반까지', () => {
    let s = gift(ch1, springGame('g1'), 'grinding_stone', 0.8);
    expect(progress(s, 'grinding_stone')).toBeCloseTo(0.5, 6);
    s = gift(ch1, s, 'grinding_stone', 0.3);
    expect(progress(s, 'grinding_stone')).toBeCloseTo(0.5, 6);
    expect(peekCell(s, 'grinding_stone').log.filter((l) => l.kind === 'gift')).toEqual([{ kind: 'gift', by: 'ikki', amount: 0.5, month: s.month }]);
  });

  it('4월 첫 갈래 선물 1/3 (엔진 규칙): 그 칸이 진행 중이 되고 1년차 칸 자리에 나온다', () => {
    const s = gift(ch1, springGame('g2'), 'grinding_stone', 1 / 3);
    expect(status(s, 'grinding_stone')).toBe('active');
    regen(ch1, s);
    expect(cellCands(ch1, s)).toEqual(['cell_grinding_stone']);
  });

  it('건너뛰기: 선물을 받은 칸은 앞 칸이 비어도 열린다 (굴 다지기)', () => {
    const s = gift(ch1, springGame('g3'), 'cave_fortify', 0.5);
    expect(status(s, 'tent_repair')).toBe('open');
    expect(status(s, 'cave_fortify')).toBe('active');
  });

  it('갈래 끝은 선물을 받아도 앞 칸이 켜지기 전에는 잠겨 있다 (안 A)', () => {
    let s = gift(ch1, springGame('g4'), 'sled', 0.5);
    expect(status(s, 'sled')).toBe('locked');
    expect(progress(s, 'sled')).toBeCloseTo(0.5, 6);
    s.tech['stone_spear']!.status = 'done';
    refreshTech(ch1, s);
    expect(status(s, 'sled')).toBe('active');
  });

  it('굴 다지기는 천막 보수가 켜졌거나 바위굴에 살면 열린다', () => {
    const s = springGame('g5');
    s.shelter.kind = 'rock_cave';
    refreshTech(ch1, s);
    expect(status(s, 'cave_fortify')).toBe('open');
  });
});

describe('균형 규칙 (이어 가던 칸)', () => {
  it('1년차: 다른 발전을 고른 달에 이어 가던 칸이 1/6철, "발전하지 않는다" 달에는 그대로', () => {
    let s = springGame('b1');
    keepAlive(ch1, s);
    s = finishAndNext(ch1, pick(ch1, s, 'cell_stone_spear'));
    expect(progress(s, 'stone_spear')).toBeCloseTo(1 / 3, 6);
    // 작은 발전 하나
    keepAlive(ch1, s);
    const small = s.work.candidates.find((c) => findPolicy(ch1, c.policyId).slot === 'growth' && !findPolicy(ch1, c.policyId).tech)!;
    s = finishAndNext(ch1, pick(ch1, s, small.policyId));
    expect(progress(s, 'stone_spear')).toBeCloseTo(1 / 3 + 1 / 6, 6);
    expect(peekCell(s, 'stone_spear').log.at(-1)!.kind).toBe('drift');
    // 발전하지 않는다
    keepAlive(ch1, s);
    s = finishAndNext(ch1, pickFood(ch1, s));
    expect(progress(s, 'stone_spear')).toBeCloseTo(1 / 2, 6);
  });

  it('계절 턴: 다른 칸을 고르면 이어 가던 칸이 절반 속도(+0.5철). 저절로 나아간 몫은 "이어 가던 칸"을 바꾸지 않는다', () => {
    const def = tweakDef((d) => {
      d.tech.cells.find((c) => c.id === 'stone_spear')!.seasons = 2;
      d.tech.cells.find((c) => c.id === 'grinding_stone')!.seasons = 2;
      d.content.events = d.content.events.filter((e) => e.scope !== 'person');
    });
    let s = freshSeason(def);
    s = finishAndNext(def, pick(def, s, 'cell_stone_spear'));
    expect(progress(s, 'stone_spear')).toBeCloseTo(1, 6);
    keepAlive(def, s);
    s = finishAndNext(def, pick(def, s, 'cell_grinding_stone'));
    expect(progress(s, 'grinding_stone')).toBeCloseTo(1, 6);
    expect(progress(s, 'stone_spear')).toBeCloseTo(1.5, 6);
    expect(s.history.at(-1)!.reports.at(-1)!.lines.map((l) => l.key)).toContain('line.tech.drift');
  });
});

describe('계절 턴의 "발전하지 않는다"와 겨울 저장분', () => {
  it('식량 전략만 고른 계절 턴에는 마을 수확 +10% (발전 인원이 식량에 붙는다)', () => {
    const def = tweakDef((d) => {
      d.content.events = d.content.events.filter((e) => e.scope !== 'person');
    });
    const s0 = freshSeason(def);
    const food = pick(def, s0, 'season_camp_work');
    expect(getStat(def, food, 'yield.gather').parts.some((p) => p.source === 'tech.none')).toBe(true);
    const withCell = pick(def, s0, 'cell_grinding_stone');
    expect(getStat(def, withCell, 'yield.gather').parts.some((p) => p.source === 'tech.none')).toBe(false);
  });

  it('겨울 "저장분으로 버틴다": 저장분 70% 이상일 때 후보, 배급 90%(감축), 발전 진척 +1철 (2철 칸이 한 철에 켜진다)', () => {
    const def = tweakDef((d) => {
      d.tech.cells.find((c) => c.id === 'grinding_stone')!.seasons = 2;
      d.content.events = d.content.events.filter((e) => e.scope !== 'person');
    });
    let s = freshSeason(def);
    for (let i = 0; i < 3; i++) {
      keepAlive(def, s);
      s = finishAndNext(def, pick(def, s, 'season_camp_work'));
    }
    expect(s.work.turn.firstMonth).toBe(22); // 2년차 겨울 (12월)
    keepAlive(def, s);
    regen(def, s);
    const ws = s.work.candidates.find((c) => c.policyId === 'winter_stores');
    expect(ws?.hint).toBe('sure');
    const a = finishMonth(def, pick(def, s, 'winter_stores', 'cell_grinding_stone'));
    expect(status(a, 'grinding_stone')).toBe('done');
    expect(peekCell(a, 'grinding_stone').log.map((l) => l.kind)).toEqual(['work', 'winter']);
    expect(a.work.maxHunger).toBe(1);
    // 저장분이 모자라면 나오지 않는다
    const poor = structuredClone(s);
    poor.stores.food = [{ kind: 'dried_meat', kg: 300 }];
    regen(def, poor);
    expect(poor.work.candidates.some((c) => c.policyId === 'winter_stores')).toBe(false);
  });
});

describe('신석기', () => {
  it('갈래 둘의 끝이 켜지면 신석기 깃발과 결말', () => {
    const def = tweakDef((d) => {
      d.tech.cells.push({
        id: 'village',
        branch: 'home',
        order: 4,
        requires: { branchDone: 'home', min: 1 },
        seasons: 1,
        crew: { adults: 1 },
        unlocks: [{ kind: 'policy', id: 'season_camp_work' }],
        scene: { bg: '{camp}' },
      });
      d.content.events = d.content.events.filter((e) => e.scope !== 'person');
    });
    const s = springGame('n1', def);
    for (const id of ['stone_spear', 'sled', 'tent_repair']) Object.assign(s.tech[id]!, { status: 'done', progress: 1 });
    s.tech['village'] = { status: 'locked', progress: 0.99, gifted: 0, log: [], lastProgress: 1 };
    refreshTech(def, s);
    expect(status(s, 'village')).toBe('active');
    // 이어 가던 칸(마을)이 저절로 나아가 켜진다 → 갈래 끝 둘
    const small = s.work.candidates.find((c) => findPolicy(def, c.policyId).slot === 'growth' && !findPolicy(def, c.policyId).tech)!;
    const e = finishMonth(def, pick(def, s, small.policyId));
    expect(status(e, 'village')).toBe('done');
    expect(e.flags['neolithic']).toBeDefined();
    expect(e.flags['neolithic.hunt_water']).toBeDefined();
    expect(e.flags['neolithic.home']).toBeDefined();
    expect(e.step).toBe('ended');
    expect(e.ending?.id).toBe('neolithic');
  });
});

describe('예전 지식의 흡수, 쿨다운, 운반', () => {
  it('칸 상태가 없던 세이브: 1년차 겨울 준비(끌개 엮기, 저장 구덩이)를 마쳤으면 그 칸에 절반 선물, 다 못 마쳤으면 없음', () => {
    const s = springGame('a1');
    s.tech = {};
    s.knowledge.progress['sled'] = 1;
    s.knowledge.has.push('storage_pit');
    ensureTech(ch1, s);
    expect(progress(s, 'sled')).toBe(0);
    expect(progress(s, 'cave_fortify')).toBeCloseTo(0.5, 6);
    expect(status(s, 'cave_fortify')).toBe('active');
    s.tech = {};
    s.knowledge.has.push('sled');
    ensureTech(ch1, s);
    expect(progress(s, 'sled')).toBeCloseTo(0.5, 6);
    expect(status(s, 'sled')).toBe('locked'); // 갈래 끝은 앞 칸 전에는 잠김
  });

  it('쿨다운은 턴 단위: N턴 뒤에 다시 나온다 (계절 턴에서 2 = 한 철 쉼, 1 = 바로 다음 철)', () => {
    const def = tweakDef((d) => {
      d.content.policies.find((p) => p.id === 'season_forest_hunt')!.cooldown = 2;
      // 쿨다운만 본다: 사냥에서 바위가 죽어도 후보가 사라지지 않게 이끄는 사람 조건을 뺀다
      delete d.content.policies.find((p) => p.id === 'season_forest_hunt')!.leader;
      d.content.events = d.content.events.filter((e) => e.scope !== 'person');
    });
    let s = freshSeason(def);
    s = finishAndNext(def, pick(def, s, 'season_forest_hunt'));
    expect(s.work.candidates.some((c) => c.policyId === 'season_forest_hunt')).toBe(false);
    keepAlive(def, s);
    s = finishAndNext(def, pick(def, s, 'season_camp_work'));
    expect(s.work.candidates.some((c) => c.policyId === 'season_forest_hunt')).toBe(true);
  });

  it('계절 턴에 두고 온 고기는 이 철의 결과에 한 줄 (말리는 법도 짐꾼도 없을 때)', () => {
    const def = tweakDef((d) => {
      d.balance.stats['carry.perPerson'] = 1;
      d.balance.carry.portersMaxDays = 0;
      d.content.events = d.content.events.filter((e) => e.scope !== 'person');
    });
    const s0 = freshSeason(def, ch1);
    s0.knowledge.has = s0.knowledge.has.filter((k) => k !== def.balance.carry.dryKnowledge);
    const s = finishMonth(def, pick(def, s0, 'season_forest_hunt'));
    const line = s.work.reports.at(-1)!.lines.find((l) => l.key === 'line.season.leftBehind');
    expect(line).toBeDefined();
    expect(Number(line!.params!['kg'])).toBeGreaterThan(0);
    expect(s.work.cohesionBy?.['leftover.abandon'] ?? 0).toBe(0);
  });

  it('1년차 겨울 준비를 마치면 그 칸에 절반 (끌개 엮기 → 끌개 칸, 저장 구덩이 → 굴 다지기 칸). 이 작은 발전은 계절 턴에 나오지 않는다', () => {
    const s = springGame('w1');
    s.knowledge.progress['storage_pit'] = 3;
    const e = finishMonth(ch1, pickFood(ch1, s));
    expect(e.knowledge.has).toContain('storage_pit');
    expect(progress(e, 'cave_fortify')).toBeCloseTo(0.5, 6);
    expect(peekCell(e, 'cave_fortify').log.at(-1)!.kind).toBe('gift');
    const y2 = toFirstSeason();
    expect(y2.work.candidates.some((c) => ['make_sled', 'cave_fortify'].includes(c.policyId))).toBe(false);
  });

  it('돌창 손질이 켜지면 들소 몰이가 1년차 겨울 달 턴에도 나온다 (상순에 몰고 하순에 나른다)', () => {
    const s = newGame('w2'); // 숨은 늦가을 시작: 11월
    s.tech['stone_spear']!.status = 'done';
    refreshTech(ch1, s);
    regen(ch1, s);
    expect(s.work.candidates.some((c) => c.policyId === 'bison_drive')).toBe(true);
    const e = finishMonth(ch1, pick(ch1, s, 'bison_drive'));
    expect(e.work.ledger.filter((l) => l.source.startsWith('catch.')).length).toBeLessThanOrEqual(1);
  });

  it('짐꾼 몫: 천막 보수(물가 야영) +25%, 끌개 +50% (시험값)', () => {
    const s = springGame('p1');
    expect(stat(ch1, s, 'carry.porterMul')).toBe(1);
    s.tech['tent_repair']!.status = 'done';
    expect(stat(ch1, s, 'carry.porterMul')).toBeCloseTo(1.25, 6);
    s.tech['sled']!.status = 'done';
    expect(stat(ch1, s, 'carry.porterMul')).toBeCloseTo(1.75, 6);
  });

  it('헤드리스: 1년차 + 2년(20턴)을 첫 후보로 끝까지 돈다 (칸이 켜진다)', () => {
    const s = springGame('h1');
    let turns = 0;
    for (; turns < 20 && s.step !== 'ended'; turns++) {
      if (s.step === 'settlement') applyCommand(ch1, s, { type: 'nextMonth' });
      keepAlive(ch1, s);
      playTurn(ch1, s, firstChoice);
    }
    expect(turns).toBe(20);
    expect(s.work.turn.kind).toBe('season');
    expect(Object.values(s.tech).some((c) => c.status === 'done')).toBe(true);
  });
});
