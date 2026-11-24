import { describe, expect, it } from 'vitest';
import { chapters, commonStrings } from '../../src/data/registry';
import { ch1, tweakDef } from '../../src/test/fixtures';
import { SCENE_IDS } from '../../src/assets/sceneIds';
import { notationIssues, validate } from './validate';

const strings = { ...commonStrings.ko, ...chapters['ch1']!.strings.ko };
const msgs = (def: Parameters<typeof validate>[0], s = strings) => validate(def, s).map((i) => `${i.level}:${i.where}:${i.msg}`);

describe('콘텐츠 검증기', () => {
  it('실제 1장 콘텐츠는 오류가 없다', () => {
    expect(validate(chapters['ch1']!.definition, strings).filter((i) => i.level === 'error')).toEqual([]);
  });

  it('표기 규칙: 화면 정보의 우리말 수, 변수 뒤 조사, 부족 이름 직접 쓰기, 없는 서식', () => {
    const names = new Set(['잿빛강 사람들']);
    const m = (k: string, t: string) => notationIssues(k, t, names).map((i) => i.msg);
    expect(m('ui.top.people', '{n:count}명')[0]).toContain('우리말 수');
    expect(m('policy.x.cost', '사냥꾼 {n:num}')[0]).toContain('우리말 수');
    expect(m('nar.x.1', '순록 {n:count}마리')).toEqual([]);
    expect(m('nar.x.2', '순록 {n:count} 마리')[0]).toContain('띄우지 않는다');
    expect(m('nar.x.3', '{name}이 돌아왔다.')[0]).toContain('{name:이}');
    expect(m('nar.x.4', '{place}에 묻었다.')).toEqual([]);
    expect(m('nar.x.5', '{name:이} 왔다.')).toEqual([]);
    expect(m('ending.x', '잿빛강 사람들은 흩어졌다.')[0]).toContain('{tribe}');
    expect(m('tribe.suggest.grey_river', '잿빛강 사람들')).toEqual([]);
    expect(m('nar.x.6', '{n:foo}')[0]).toContain('없는 서식');
    expect(m('preset.p.land.river.value', '{n:num}')[0]).toContain('우리말 수');
  });

  it('없는 id 참조와 없는 동물 상태를 잡는다', () => {
    const def = tweakDef((d) => {
      d.content.policies[0]!.appearsWhen.push({ type: 'animal', id: 'mammoth' }, { type: 'animal', id: 'reindeer', state: ['flying'] });
      d.content.events[0]!.options[0]!.effects.push({ type: 'goods', id: 'gold', delta: 1 });
    });
    const m = msgs(def);
    expect(m.some((x) => x.includes('없는 animal id: mammoth'))).toBe(true);
    expect(m.some((x) => x.includes('없는 상태: flying'))).toBe(true);
    expect(m.some((x) => x.includes('없는 goods id: gold'))).toBe(true);
  });

  it('없는 문자열, 긴 라벨, 중복 id를 잡는다', () => {
    const def = tweakDef((d) => {
      d.content.policies.push({ ...d.content.policies[0]! });
    });
    const s = { ...strings, 'event.herd_vs_wolves.opt.stay_all': '아주 아주 아주 긴 선택지 라벨이다' };
    delete (s as Record<string, string>)['policy.river_gather.summary'];
    const m = msgs(def, s);
    expect(m.some((x) => x.includes(`중복 id: ${ch1.content.policies[0]!.id}`))).toBe(true);
    expect(m.some((x) => x.includes('문자열 없음: policy.river_gather.summary'))).toBe(true);
    expect(m.some((x) => x.includes('선택지 라벨'))).toBe(true);
  });

  it('공짜 선택지와 가짜 선택지를 잡는다', () => {
    const def = tweakDef((d) => {
      const ev = d.content.events.find((e) => e.id === 'wolves_circle_camp')!;
      ev.options[1] = { id: 'watch', effects: [{ type: 'line', key: 'line.wolves_circled' }] };
      ev.options[2] = { id: 'ignore', effects: [{ type: 'line', key: 'line.wolves_circled' }] };
    });
    const m = msgs(def);
    expect(m.some((x) => x.startsWith('warn:event.wolves_circle_camp.watch') && x.includes('비용'))).toBe(true);
    expect(m.some((x) => x.startsWith('error:event.wolves_circle_camp.ignore') && x.includes('가짜 선택지'))).toBe(true);
  });

  it('매니페스트에 없는 그림과 없는 측정기를 잡는다', () => {
    const def = tweakDef((d) => {
      d.content.policies[0]!.scene = { bg: 'bg.moon_base' };
      d.goals[0]!.paths[0]!.measure = { id: 'nope', target: 1 };
    });
    const m = msgs(def).concat(validate(def, strings, SCENE_IDS).map((i) => i.msg));
    expect(m.some((x) => x.includes('매니페스트에 없는 그림: bg.moon_base'))).toBe(true);
    expect(m.some((x) => x.includes('없는 측정기: nope'))).toBe(true);
  });

  it('도달할 수 없는 사건과 세우지 않는 깃발을 경고한다', () => {
    const def = tweakDef((d) => {
      const ev = d.content.events.find((e) => e.id === 'cave_bear_last_sack')!;
      ev.options.find((o) => o.id === 'use_mouth')!.effects = [{ type: 'cohesion', delta: -1 }];
      d.content.policies[0]!.appearsWhen.push({ type: 'flag', id: 'never_set' });
    });
    const m = msgs(def);
    expect(m.some((x) => x.includes('event.bear_wakes') && x.includes('예약하지 않는다'))).toBe(true);
    expect(m.some((x) => x.includes('세우지 않는 깃발: never_set'))).toBe(true);
  });
});
