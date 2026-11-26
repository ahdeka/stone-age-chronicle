// 계절 턴 (DESIGN.md §B2.3, R1-a): 1년차 달 턴 → 2년차부터 철 턴, 단계 = 달, 한가운데 인물 사건 창

import { describe, expect, it } from 'vitest';
import { ch1, choose, keepAlive, newGame, pick, run, springGame, toFirstSeason, tweakDef } from '../../test/fixtures';
import { applyCommand, calendarDate, findPolicy } from '../index';
import { firstChoice, playTurn, playTurns } from '../headless';
import { deserialize, serialize, SAVE_FORMAT } from '../save/save';
import { SAVE_VERSION } from '../save/version';
import type { ChapterDefinition, GameState } from '../types';

const lineKeys = (s: GameState, i: number) => s.work.reports[i]!.lines.map((l) => l.key);

function pickSeason(def: ChapterDefinition, s: GameState, policyId = 'season_camp_work'): GameState {
  return pick(def, s, policyId);
}

describe('턴 종류', () => {
  it('1년차 12턴은 달 턴이고, 2월 정산 뒤 2년차 봄 계절 턴(3·4·5월)이 열린다', () => {
    const s = springGame('kinds');
    const kinds: string[] = [];
    for (let i = 0; i < 12; i++) {
      if (s.step === 'settlement') applyCommand(ch1, s, { type: 'nextMonth' });
      kinds.push(s.work.turn.kind);
      expect(s.turn).toBe(s.month);
      keepAlive(ch1, s);
      playTurn(ch1, s, firstChoice);
    }
    expect(kinds.every((k) => k === 'month')).toBe(true);
    expect(calendarDate(ch1, s).number).toBe(2);
    const next = run(ch1, s, { type: 'nextMonth' });
    expect(next.work.turn).toEqual({ kind: 'season', months: 3, stage: 0, firstMonth: 13 });
    expect(next.turn).toBe(13);
    const d = calendarDate(ch1, next);
    expect([d.year, d.season, d.number]).toEqual([2, 'spring', 3]);
  });

  it('숨은 늦가을 시작은 1년차가 넉 달(11~2월)이고, 3월부터 철 턴이다', () => {
    const s = toFirstSeason(ch1, newGame('autumn-season'));
    expect(s.turn).toBe(5);
    expect(s.work.turn).toMatchObject({ kind: 'season', months: 3, firstMonth: 5 });
    expect(calendarDate(ch1, s).number).toBe(3);
  });

  it('후보는 턴 종류에 맞는 전략만: 1년차에 계절 전략 없음, 계절 턴에 달 전략 없음', () => {
    const y1 = springGame('cands');
    expect(y1.work.candidates.every((c) => (findPolicy(ch1, c.policyId).turn ?? 'month') === 'month')).toBe(true);
    const y2 = toFirstSeason();
    expect(y2.work.candidates.length).toBeGreaterThan(0);
    expect(y2.work.candidates.every((c) => findPolicy(ch1, c.policyId).turn === 'season')).toBe(true);
  });
});

describe('계절 턴 하나', () => {
  it('단계 보고 3개(초입·한가운데·끝자락 = 달 셋)와 철 정산. 한가운데에서 인물 사건 결정을 기다린다', () => {
    const s0 = toFirstSeason();
    const s1 = pickSeason(ch1, s0);
    // 한가운데(둘째 달)에서 멈춤
    expect(s1.step).toBe('decision');
    expect(s1.work.decision).toMatchObject({ kind: 'event', eventId: 'season_fireside', slot: 'mid' });
    expect(s1.month).toBe(14);
    expect(s1.work.reports.map((r) => r.slot)).toEqual(['briefing', 'early', 'mid']);
    expect(s1.work.reports.map((r) => r.month)).toEqual([undefined, 13, 14]);
    // 결정 뒤 끝자락과 정산
    const s2 = choose(ch1, s1, 'big_fire');
    expect(s2.step).toBe('settlement');
    expect(s2.month).toBe(15);
    expect(s2.work.reports.map((r) => r.slot)).toEqual(['briefing', 'early', 'mid', 'late', 'settlement']);
    expect(s2.work.reports.map((r) => r.month)).toEqual([undefined, 13, 14, 15, undefined]);
    // 단계마다 날씨가 그 달의 것, 마을 서술은 단계마다 한 번
    for (const i of [1, 2, 3]) expect(lineKeys(s2, i).filter((k) => k.startsWith('nar.village_work')).length).toBeLessThanOrEqual(1);
    // 기록: 턴 하나 = 철 하나
    const h = s2.history.at(-1)!;
    expect(h).toMatchObject({ kind: 'season', turn: 13, firstMonth: 13, month: 15 });
    // 철 정산은 턴 시작 값에서 (석 달의 장부)
    expect(s2.work.reports.at(-1)!.from.food).toBe(s0.work.start.food);
    // 다음 턴은 여름 철
    const s3 = run(ch1, s2, { type: 'nextMonth' });
    expect(s3.work.turn).toMatchObject({ kind: 'season', firstMonth: 16, stage: 0 });
    expect(s3.turn).toBe(14);
    expect(calendarDate(ch1, s3).season).toBe('summer');
  });

  it('석 달 동안 사람은 나이를 먹고, 순 9개의 살림이 돈다 (먹은 양 = 9순)', () => {
    const s0 = toFirstSeason();
    const s = playSeason(ch1, s0);
    const eatRows = s.work.ledger.filter((l) => l.source === 'upkeep.food');
    expect(eatRows.length).toBe(9);
  });

  it('인물 사건이 없으면 멈추지 않고 철 끝까지 간다', () => {
    const def = tweakDef((d) => {
      d.content.events = d.content.events.filter((e) => e.scope !== 'person');
    });
    const s = pickSeason(def, toFirstSeason(def));
    expect(s.step).toBe('settlement');
    expect(s.work.reports.map((r) => r.slot)).toEqual(['briefing', 'early', 'mid', 'late', 'settlement']);
  });

  it('남은 고기는 묻지 않고 끝자락에서 저절로 처리한다 (1년차의 처리 팝업은 1년차 전용)', () => {
    const def = tweakDef((d) => {
      d.balance.stats['carry.perPerson'] = 1;
      d.content.events = d.content.events.filter((e) => e.scope !== 'person');
    });
    const s0 = toFirstSeason(def);
    const s = pickSeason(def, s0, 'season_forest_hunt');
    expect(s.step).toBe('settlement');
    expect(s.history.at(-1)!.kind).toBe('season');
    const keys = s.work.reports.flatMap((r) => r.lines.map((l) => l.key));
    // 한 사람이 1kg만 나르니 고기가 남는다 → 처리 줄이 있고(묻는 팝업 없음), 두고 와도 결속은 떨어지지 않는다
    expect(keys).toContain('line.carry.trips');
    expect(keys.some((k) => k.startsWith('line.leftover.'))).toBe(true);
    expect(keys).not.toContain('line.carry.left');
    expect(s.work.cohesionBy?.['leftover.abandon'] ?? 0).toBe(0);
  });
});

/** 계절 턴 하나를 첫 후보·첫 선택지로 정산까지 */
function playSeason(def: ChapterDefinition, s: GameState): GameState {
  const cur = structuredClone(s);
  playTurn(def, cur, firstChoice);
  return cur;
}

describe('계절 턴의 결정론과 저장', () => {
  it('같은 시드와 같은 선택이면 계절 턴 결과가 같다', () => {
    const a = playSeason(ch1, toFirstSeason());
    const b = playSeason(ch1, toFirstSeason());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('한가운데 결정 대기 중에 저장해도 그대로 돌아오고, 이어서 진행한 결과가 같다', () => {
    const a = pickSeason(ch1, toFirstSeason());
    const r = deserialize(serialize(a));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state).toEqual(a);
    const b = r.state;
    playTurns(ch1, a, firstChoice, 3);
    playTurns(ch1, b, firstChoice, 3);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('v5 세이브(1년차 중간)는 v6으로 옮겨진다: 턴 = 달, 달 턴, 칸·줄기는 빈 값. 이어서 2년차까지 간다', () => {
    const s = springGame('mig6');
    keepAlive(ch1, s);
    playTurns(ch1, s, firstChoice, 4);
    const v5 = structuredClone(s) as unknown as Record<string, unknown>;
    v5['saveVersion'] = 5;
    delete v5['turn'];
    delete v5['tech'];
    delete v5['arcs'];
    delete (v5['work'] as Record<string, unknown>)['turn'];
    for (const h of v5['history'] as Record<string, unknown>[]) {
      delete h['turn'];
      delete h['kind'];
      delete h['firstMonth'];
    }
    const file = JSON.stringify({ format: SAVE_FORMAT, generation: 'monthly', saveVersion: 5, chapterId: 'ch1', savedAt: null, state: v5 });
    const r = deserialize(file);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const m = r.state;
    expect(m.saveVersion).toBe(SAVE_VERSION);
    expect(m.turn).toBe(m.month);
    expect(m.work.turn).toEqual({ kind: 'month', months: 1, stage: 0, firstMonth: m.month });
    expect(m.tech).toEqual({});
    expect(m.arcs).toEqual({});
    expect(m.history.map((h) => h.turn)).toEqual(m.history.map((h) => h.month));
    expect(m).toEqual(s);
    const y2 = toFirstSeason(ch1, m);
    expect(y2.work.turn.kind).toBe('season');
  });
});
