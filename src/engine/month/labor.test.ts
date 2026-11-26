// R1-c: 인원 제약 (DESIGN.md §B4.3), 결속 계절 환산 안 A와 분열 (§B6.4)

import { describe, expect, it } from 'vitest';
import { ch1, choose, keepAlive, passBriefing, run, springGame, toFirstSeason, tweakDef } from '../../test/fixtures';
import { applyCommand } from '../core/reduce';
import { findPolicy } from '../core/lookup';
import { previewPlan, workingAdults } from '../policy/plan';
import { crewSpecFor, generateCandidates } from '../policy/candidates';
import { ensureTech } from '../tech/tech';
import { band, living } from '../people/people';
import { runCtx } from './month';
import { consume, stageCohesion } from './upkeep';
import type { ChapterDefinition, GameState, PolicyTemplate } from '../types';

const uid = (s: GameState, id: string) => {
  const c = s.work.candidates.find((x) => x.policyId === id);
  if (!c) throw new Error(`not a candidate: ${id} (${s.work.candidates.map((x) => x.policyId).join(', ')})`);
  return c.uid;
};
const seatOf = (s: GameState, seat: string) => living(s).find((p) => p.advisor?.seat === seat)!;

/** 첫 계절 턴, 발전 나무는 처음 상태로 (갈래 첫 칸 셋이 발전 후보) */
function freshSeason(def: ChapterDefinition = ch1): GameState {
  const s = toFirstSeason(def);
  s.tech = {};
  ensureTech(def, s);
  s.work.candidates = generateCandidates(def, s);
  return s;
}

/** 계절 턴 시험용 식량 전략: 마을 안에서 일하는 무리 (최소 4명, 마을에 남길 사람 없음) */
const CREW_FOOD: PolicyTemplate = {
  id: 't_season_crew',
  slot: 'food',
  turn: 'season',
  category: 't_crew',
  appearsWhen: [],
  priority: 990,
  cooldown: 0,
  crew: { min: 4, max: 6, keepHome: 0, atHome: true },
  scene: { bg: '{camp}' },
  steps: {},
};

describe('인원 제약 (§B4.3)', () => {
  it('일할 수 있는 성인: 노인·아이·족장·다치거나 아픈 사람은 들지 않는다', () => {
    const s = springGame('adults');
    const adults = living(s).filter((p) => band(ch1, s, p) === 'adult' && !p.isChief);
    expect(workingAdults(ch1, s)).toBe(adults.length);
    adults[0]!.ailments.push({ kind: 'fracture', severity: 2, healsAt: 9999 });
    expect(workingAdults(ch1, s)).toBe(adults.length - 1);
  });

  it('인물 겹침: 식량 전략을 이끄는 바위가 먼저, 돌창 손질 칸은 fallback(이끼)이 맡는다. 무리는 겹치지 않는다', () => {
    const s = freshSeason();
    const bawi = seatOf(s, 'hunt_leader');
    const ikki = seatOf(s, 'artisan');
    // 칸 하나만 보면 바위가 맡는다
    expect(s.work.candidates.find((c) => c.policyId === 'cell_stone_spear')!.leaderId).toBe(bawi.id);
    const pv = previewPlan(ch1, s, [uid(s, 'season_forest_hunt'), uid(s, 'cell_stone_spear')]);
    expect(pv.error).toBeUndefined();
    const [food, growth] = pv.entries;
    expect(food!.bound.leaderId).toBe(bawi.id);
    expect(growth!.bound.leaderId).toBe(ikki.id);
    expect(growth!.bound.crew).toContain(ikki.id);
    expect(growth!.bound.crew).not.toContain(bawi.id);
    expect(food!.bound.crew.some((x) => growth!.bound.crew.includes(x))).toBe(false);
    // 합 ≤ 일할 수 있는 성인
    expect(food!.bound.crew.length + growth!.bound.crew.length).toBeLessThanOrEqual(workingAdults(ch1, s));
    // 실제로 고르면 그대로 진행된다
    const next = run(ch1, s, { type: 'choosePlan', uids: [uid(s, 'season_forest_hunt'), uid(s, 'cell_stone_spear')] });
    expect(next.work.plan.find((e) => e.slot === 'growth')!.bound.leaderId).toBe(ikki.id);
  });

  it('인물 겹침에 fallback이 없으면 함께 고를 수 없고, 이유는 그 사람과 맡은 전략', () => {
    // 갈돌 칸을 바위가 꼭 맡아야 하는 칸으로 바꾼다 (fallback 없음)
    const def = tweakDef((d) => {
      const p = d.content.policies.find((x) => x.id === 'cell_grinding_stone')!;
      p.leader = { seat: 'hunt_leader', ailing: false };
      delete p.leaderFallback;
    });
    const s = freshSeason(def);
    const bawi = seatOf(s, 'hunt_leader');
    const uids = [uid(s, 'season_forest_hunt'), uid(s, 'cell_grinding_stone')];
    const pv = previewPlan(def, s, uids);
    expect(pv.error).toBe('error.planPerson');
    expect(pv.errorParams).toEqual({ person: bawi.id, policy: 'season_forest_hunt' });
    // 엔진도 거부한다
    expect(applyCommand(def, structuredClone(s), { type: 'choosePlan', uids })).toBe('error.planPerson');
    // 바위가 이끌지 않는 식량 전략과는 함께 고를 수 있다
    expect(previewPlan(def, s, [uid(s, 'season_camp_work'), uid(s, 'cell_grinding_stone')]).error).toBeUndefined();
  });

  it('인원 넘침: 두 전략의 최소 인원 합이 일할 수 있는 성인보다 많으면 거부, 이유는 일할 사람 수', () => {
    const def = tweakDef((d) => {
      d.content.policies.unshift(CREW_FOOD);
    });
    const s = freshSeason(def);
    // 일할 수 있는 성인을 6명만 남긴다 (나머지 성인은 다쳐서 쉰다)
    // 조언자는 남긴다 (칸을 이끌 사람)
    const adults = living(s)
      .filter((p) => band(def, s, p) === 'adult' && !p.isChief)
      .sort((x, y) => Number(!!y.advisor) - Number(!!x.advisor));
    for (const p of adults.slice(6)) p.ailments.push({ kind: 'fracture', severity: 2, healsAt: 9999 });
    s.work.candidates = generateCandidates(def, s);
    expect(workingAdults(def, s)).toBe(6);
    // 혼자는 된다 (6명)
    expect(previewPlan(def, s, [uid(s, 't_season_crew')]).error).toBeUndefined();
    // 칸 3명 + 식량 최소 4명 = 7 > 6
    const uids = [uid(s, 't_season_crew'), uid(s, 'cell_stone_spear')];
    expect(findPolicy(def, 'cell_stone_spear').crew!.min).toBe(3);
    const pv = previewPlan(def, s, uids);
    expect(pv.error).toBe('error.planCrew');
    expect(pv.errorParams).toEqual({ n: 6 });
    expect(applyCommand(def, structuredClone(s), { type: 'choosePlan', uids })).toBe('error.planCrew');
    // 2명짜리 칸(갈돌)과는 된다: 2 + 4 = 6, 식량 무리는 남는 4명
    const ok = previewPlan(def, s, [uid(s, 't_season_crew'), uid(s, 'cell_grinding_stone')]);
    expect(ok.error).toBeUndefined();
    expect(ok.entries.reduce((a, e) => a + e.bound.crew.length, 0)).toBeLessThanOrEqual(6);
  });
});

describe('1년차 칸 규칙 (2026-11-26)', () => {
  it('1년차 칸 무리는 절반(내림, 최소 2명), 계절 턴은 정의 그대로', () => {
    const y1 = springGame('crew1');
    for (const [id, n] of [['cell_stone_spear', 2], ['cell_cave_fortify', 2], ['cell_grinding_stone', 2]] as const) {
      expect(crewSpecFor(ch1, y1, findPolicy(ch1, id))!.min).toBe(n);
    }
    const y2 = toFirstSeason();
    expect(crewSpecFor(ch1, y2, findPolicy(ch1, 'cell_stone_spear'))!.min).toBe(3);
    expect(crewSpecFor(ch1, y2, findPolicy(ch1, 'cell_cave_fortify'))!.min).toBe(4);
    // 칸이 아닌 전략은 그대로
    const p = findPolicy(ch1, 'season_forest_hunt');
    expect(crewSpecFor(ch1, y2, p)).toEqual(p.crew);
  });

  it('1년차에 진행 중인 칸이 있으면 그 칸만 후보 (선물로 진행 중이어도)', () => {
    const s = springGame('one-cell');
    s.tech['grinding_stone']!.progress = 0.2;
    s.tech['grinding_stone']!.gifted = 0.2;
    s.tech['grinding_stone']!.status = 'active';
    s.work.candidates = generateCandidates(ch1, s);
    const cells = s.work.candidates.filter((c) => findPolicy(ch1, c.policyId).tech).map((c) => c.policyId);
    expect(cells).toEqual(['cell_grinding_stone']);
  });

  it('1년차에 부족이 새로 시작하는 칸은 하나: 마친 뒤에는 새 칸이 나오지 않고, 선물로 진행 중인 칸은 이어 간다', () => {
    const s = springGame('one-start');
    const ss = s.tech['stone_spear']!;
    ss.status = 'done';
    ss.progress = 1;
    ss.log.push({ kind: 'work', amount: 1, month: 3 });
    s.work.candidates = generateCandidates(ch1, s);
    expect(s.work.candidates.some((c) => findPolicy(ch1, c.policyId).tech)).toBe(false);
    // 선물로 진행 중인 칸은 나온다
    const tr = s.tech['tent_repair']!;
    tr.progress = 0.5;
    tr.gifted = 0.5;
    tr.status = 'active';
    tr.costPaid = true;
    s.work.candidates = generateCandidates(ch1, s);
    expect(s.work.candidates.filter((c) => findPolicy(ch1, c.policyId).tech).map((c) => c.policyId)).toEqual(['cell_tent_repair']);
    // 계절 턴에는 이 규칙이 없다
    const y2 = toFirstSeason();
    for (const id of Object.keys(y2.tech)) y2.tech[id]!.log.push({ kind: 'work', amount: 0, month: 3 });
    y2.work.candidates = generateCandidates(ch1, y2);
    expect(y2.work.candidates.some((c) => findPolicy(ch1, c.policyId).tech)).toBe(true);
  });
});

describe('결속 계절 환산 (§B6.4 안 A)', () => {
  it('계절 턴의 순은 결속을 바꾸지 않고, 단계 끝에 한 번: 감축 −2, 굶주림 −5, 다 먹은 단계 +2 (55까지)', () => {
    const s = toFirstSeason();
    s.cohesion = 40;
    s.stores.food = [{ kind: 'dried_meat', kg: 1 }];
    consume(runCtx(ch1, s));
    expect(s.hungerStage).toBe(2);
    expect(s.cohesion).toBe(40);
    stageCohesion(ch1, s, 1);
    expect(s.cohesion).toBe(38);
    stageCohesion(ch1, s, 2);
    expect(s.cohesion).toBe(33);
    stageCohesion(ch1, s, 0);
    expect(s.cohesion).toBe(35);
    s.cohesion = 54;
    stageCohesion(ch1, s, 0);
    expect(s.cohesion).toBe(55);
  });

  it('넉넉한 철: 단계 셋 모두 다 먹어 +2씩 (한 철 +6), 굶주림 출처는 없다', () => {
    const s0 = toFirstSeason();
    s0.cohesion = 40;
    let s = run(ch1, s0, { type: 'choosePlan', uids: [uid(s0, 'season_camp_work')] });
    if (s.step === 'decision') s = choose(ch1, s, 'save_wood');
    expect(s.step).toBe('settlement');
    expect(s.work.cohesionBy?.['ration.recover']).toBe(6);
    expect(s.work.cohesionBy?.['hunger.1'] ?? 0).toBe(0);
    expect(s.work.cohesionBy?.['hunger.2'] ?? 0).toBe(0);
  });

  it('겨울 "저장분으로 버틴다": 배급 90%라 단계마다 감축 판정 (한 철 −6)', () => {
    let s = toFirstSeason();
    // 여름·가을을 넘겨 겨울 철까지 (넉넉히 채워 둔다)
    for (let i = 0; i < 3; i++) {
      s = run(ch1, s, { type: 'choosePlan', uids: [uid(s, 'season_camp_work')] });
      if (s.step === 'decision') s = choose(ch1, s, 'save_wood');
      s = run(ch1, s, { type: 'nextMonth' });
      keepAlive(ch1, s);
      s = passBriefing(ch1, s);
    }
    expect(s.work.turn.kind).toBe('season');
    s.work.candidates = generateCandidates(ch1, s);
    s = run(ch1, s, { type: 'choosePlan', uids: [uid(s, 'winter_stores')] });
    if (s.step === 'decision') s = choose(ch1, s, 'save_wood');
    expect(s.work.cohesionBy?.['hunger.1']).toBe(-6);
    expect(s.work.cohesionBy?.['ration.recover'] ?? 0).toBe(0);
  });

  it('분열: 결속 10 아래로 철을 넘긴 것이 두 번 이어지면 (달 턴은 석 달)', () => {
    const s0 = toFirstSeason();
    const low = (s: GameState) => {
      s.cohesion = 0;
      let cur = run(ch1, s, { type: 'choosePlan', uids: [uid(s, 'season_camp_work')] });
      if (cur.step === 'decision') cur = choose(ch1, cur, 'save_wood');
      return cur;
    };
    const a = low(s0);
    expect(a.cohesion).toBeLessThan(10);
    expect(a.counters['low_cohesion_months']).toBe(1.5);
    expect(a.step).toBe('settlement');
    const b0 = passBriefing(ch1, run(ch1, a, { type: 'nextMonth' }));
    keepAlive(ch1, b0);
    const b = low(b0);
    expect(b.counters['low_cohesion_months']).toBe(3);
    expect(b.ending?.id).toBe('ruin_split');
  });
});
