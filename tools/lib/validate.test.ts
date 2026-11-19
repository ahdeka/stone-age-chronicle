import { describe, expect, it } from 'vitest';
import { chapters, commonStrings } from '../../src/data/registry';
import { tweakDef } from '../../src/test/fixtures';
import { validateChapter } from './validate';

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

  it('족장 직책이 없으면 오류', () => {
    const def = tweakDef((d) => {
      d.offices = d.offices.map((o) => ({ id: o.id }));
    });
    expect(validateChapter(def, strings).some((i) => i.message.startsWith('족장 직책'))).toBe(true);
  });
});
