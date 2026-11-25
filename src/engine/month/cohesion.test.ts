// ③a 결속과 식량 흐름 (DESIGN.md §10.5, §10.6, §22.1): 감축을 먼저 밟는 굶주림, 배급 회복, 애도, 장작 일손, 함정 정리
import { describe, expect, it } from 'vitest';
import { ch1, finishMonth, newGame, pickFood, run, springGame, tweakDef } from '../../test/fixtures';
import { runCtx } from './month';
import { consume, villageHarvest } from './upkeep';
import { generateCandidates } from '../policy/candidates';
import { eventText } from '../events/events';
import { findEvent } from '../core/lookup';
import { dailyFoodTotal, living } from '../people/people';
import type { GameState } from '../types';

/** 한 순 먹을 양의 ratio배만 남겨 둔다 */
function withFood(s: GameState, ratio: number): void {
  const need = dailyFoodTotal(ch1, s) * 10;
  s.stores.food = ratio > 0 ? [{ kind: 'dried_meat', kg: need * ratio }] : [];
}

describe('굶주림 단계 (§10.5)', () => {
  it('감축 배급에도 모자라면 처음 두 순은 감축(1단계), 세 순째부터 굶주림(2단계)', () => {
    const s = springGame('short');
    const stages: number[] = [];
    for (let i = 0; i < 4; i++) {
      withFood(s, 0.6);
      consume(runCtx(ch1, s));
      stages.push(s.hungerStage);
    }
    expect(stages).toEqual([1, 1, 2, 2]);
  });

  it('거의 먹을 것이 없으면(0.4배 미만) 곧바로 굶주림', () => {
    const s = springGame('empty');
    withFood(s, 0.2);
    consume(runCtx(ch1, s));
    expect(s.hungerStage).toBe(2);
  });

  it('결속: 감축 −1, 굶주림 −3, 다 먹은 순은 +1 (시작값 55까지만)', () => {
    const s = springGame('coh');
    s.cohesion = 50;
    withFood(s, 0.8);
    consume(runCtx(ch1, s));
    expect(s.cohesion).toBe(49);
    withFood(s, 0.1);
    consume(runCtx(ch1, s));
    expect(s.cohesion).toBe(46);
    for (let i = 0; i < 20; i++) {
      withFood(s, 2);
      consume(runCtx(ch1, s));
    }
    expect(s.cohesion).toBe(55);
    expect(s.work.cohesionBy?.['ration.recover']).toBeGreaterThan(0);
    expect(s.work.cohesionBy?.['hunger.2']).toBe(-3);
  });
});

describe('애도 (월초 사건)', () => {
  function afterDeaths(n: number): GameState {
    let s = finishMonth(ch1, pickFood(ch1, springGame('grief')));
    const victims = living(s).filter((p) => !p.advisor && !p.isChief).slice(0, n);
    for (const p of victims) {
      p.alive = false;
      p.diedMonth = s.month;
    }
    s = run(ch1, s, { type: 'nextMonth' });
    return s;
  }

  it('지난달 죽은 사람이 있으면 월초에 애도 사건이 나오고, 이름이 본문에 들어간다', () => {
    const s = afterDeaths(1);
    expect(s.work.decision).toMatchObject({ kind: 'event', eventId: 'mourning', slot: 'briefing' });
    const d = s.work.decision!;
    const t = eventText(ch1, s, findEvent(ch1, 'mourning'), d.kind === 'event' ? d.actors : {});
    expect(t.key).toBe('event.mourning.text');
    expect(t.params['actor_dead']).toBeDefined();
  });

  it('여럿이면 "외 n명" 본문, 장례는 결속 +6과 장작 20kg, 미루면 결속이 그대로', () => {
    const s = afterDeaths(3);
    const d = s.work.decision!;
    const t = eventText(ch1, s, findEvent(ch1, 'mourning'), d.kind === 'event' ? d.actors : {});
    expect(t.key).toBe('event.mourning.text.many');
    expect(t.params['deaths_others']).toBe(2);
    s.cohesion = 30;
    const rite = run(ch1, s, { type: 'chooseOption', uid: d.uid, optionId: 'rite' });
    expect(rite.cohesion).toBe(36);
    expect(rite.stores.firewood).toBeCloseTo(s.stores.firewood - 20);
    const work = run(ch1, s, { type: 'chooseOption', uid: d.uid, optionId: 'work_on' });
    expect(work.cohesion).toBe(30);
  });

  it('죽은 사람이 없으면 나오지 않는다', () => {
    const s = run(ch1, finishMonth(ch1, pickFood(ch1, springGame('calm'))), { type: 'nextMonth' });
    expect(s.work.events).not.toContain('mourning');
  });
});

describe('일손과 함정 정리', () => {
  it('장작을 더 쌓을 곳이 없으면 장작 일손이 채집으로 돌아간다', () => {
    const s = springGame('wood');
    s.stores.firewood = 0;
    const room = villageHarvest(ch1, s).food.reduce((a, y) => a + y.kg, 0);
    s.stores.firewood = 5000;
    const full = villageHarvest(ch1, s).food.reduce((a, y) => a + y.kg, 0);
    expect(villageHarvest(ch1, s).wood).toBe(0);
    expect(full).toBeGreaterThan(room);
  });

  it('장작 비축: 덧집을 다 짓고 장작이 거의 차 있으면 후보에서 빠진다', () => {
    const def = tweakDef(() => {});
    const s = springGame('shed', def);
    s.month = 4;
    s.facilities['wood_shed'] = 1;
    s.stores.firewood = 50;
    expect(generateCandidates(def, s).some((c) => c.policyId === 'firewood_stockpile')).toBe(true);
    s.stores.firewood = 1250;
    expect(generateCandidates(def, s).some((c) => c.policyId === 'firewood_stockpile')).toBe(false);
  });

  it('버티기는 식량 10일치 미만일 때만 후보에 든다', () => {
    const s = newGame('hold');
    expect(s.work.candidates.some((c) => c.policyId === 'hold_and_ration')).toBe(false);
    withFood(s, 0.5);
    expect(generateCandidates(ch1, s).some((c) => c.policyId === 'hold_and_ration')).toBe(true);
  });
});
