import { describe, expect, it } from 'vitest';
import { chapters, commonStrings } from '../../src/data/registry';
import { ch1Full, tweakDef } from '../../src/test/fixtures';
import { validateChapter } from './validate';
import { countSentences } from './validateCards';

const strings = { ...commonStrings.ko, ...chapters['ch1']!.strings.ko };

describe('content validator', () => {
  it('현재 1장 콘텐츠는 오류가 없다', () => {
    const errors = validateChapter(chapters['ch1']!.definition, strings).filter((i) => i.level === 'error');
    expect(errors).toEqual([]);
  });

  it('중복 id, 없는 참조, 없는 스탯, 없는 문자열, 역할 합계 불일치를 잡는다', () => {
    const def = tweakDef((d) => {
      d.resources.push({ id: 'food', min: 0, max: null, icon: 'food' });
      d.seasons[0]!.modifiers.push({ stat: 'yield.magic', op: 'add', value: 1 });
      d.content.endings.push({
        id: 'bad',
        kind: 'victory',
        priority: 1,
        check: [{ type: 'axis', axis: 'nope', min: 1 }],
        powerSeeds: [],
      });
      d.startPresets[0]!.roles['gather'] = 99;
    });
    const msgs = validateChapter(def, strings).map((i) => i.message);
    expect(msgs).toContain('중복 id: food');
    expect(msgs).toContain('존재하지 않는 stat 참조: yield.magic');
    expect(msgs).toContain('존재하지 않는 axis 참조: nope');
    expect(msgs).toContain('문자열 키 없음: ending.bad.title');
    expect(msgs.some((m) => m.startsWith('역할 합계'))).toBe(true);
  });

  it('카드 검사: 공짜 선택지, 가짜 선택지, 라벨 길이, 도달 불가, 선택지 수를 잡는다', () => {
    const def = tweakDef((d) => {
      d.content.events.push(
        {
          id: 'bad_ev',
          tags: [],
          trigger: { conditions: [{ type: 'flag', id: 'never_set' }] },
          mode: 'pool',
          weight: 1,
          cooldown: 0,
          once: false,
          options: [
            { id: 'free', effects: [{ type: 'resource', key: 'food', delta: 5 }] },
            { id: 'twin1', effects: [{ type: 'resource', key: 'food', delta: -1 }] },
            { id: 'twin2', effects: [{ type: 'resource', key: 'food', delta: -1 }] },
            { id: 'good_mod', effects: [{ type: 'modifier', mod: { stat: 'spoil.food', op: 'mul', value: 0.5 }, duration: 2 }] },
            { id: 'fifth', effects: [{ type: 'resource', key: 'food', delta: -2 }] },
          ],
        },
        { id: 'orphan', tags: [], trigger: {}, mode: 'followUp', weight: 1, cooldown: 0, once: false, options: [] },
      );
    }, ch1Full);
    const s2 = {
      ...strings,
      'event.bad_ev.title': 't',
      'event.bad_ev.text': '한 문장. 두 문장.',
      'event.bad_ev.opt.free': '공짜',
      'event.bad_ev.opt.twin1': '쌍둥이',
      'event.bad_ev.opt.twin2': '쌍둥이',
      'event.bad_ev.opt.good_mod': '이 라벨은 열다섯 글자를 훌쩍 넘어 버린다',
      'event.bad_ev.opt.fifth': '다섯째',
    };
    const msgs = validateChapter(def, s2).map((i) => `${i.where} ${i.message}`);
    const has = (re: RegExp) => expect(msgs.some((m) => re.test(m)), re.source).toBe(true);
    has(/bad_ev\.opt\.free 비용 없는 선택지/);
    has(/bad_ev\.opt\.good_mod 비용 없는 선택지/); // 상함이 줄어드는 것은 이득뿐
    has(/twin2 가짜 선택지/);
    has(/라벨이 15자를 넘는다/);
    has(/플래그 never_set를 세우는 곳이 없다/);
    has(/orphan 도달 불가: 이 후속 이벤트를 예약하는 곳이 없다/);
    has(/bad_ev 선택지는 2~4개여야 한다/);
  });

  it('문장 수 세기', () => {
    expect(countSentences('하나. 둘? 셋!')).toBe(3);
    expect(countSentences('땀에 젖어 누운 이가 셋, 아직은 셋이다.')).toBe(1);
    expect(countSentences('겨울 채비를 해 두었다면…')).toBe(1);
  });

  it('족장 직책이 없으면 오류', () => {
    const def = tweakDef((d) => {
      d.offices = d.offices.map((o) => ({ id: o.id }));
    });
    expect(validateChapter(def, strings).some((i) => i.message.startsWith('족장 직책'))).toBe(true);
  });
});
