// 진행 화면·이달의 결과의 글 만들기: 첫 문장, 사건 직전 문장, 한 줄 회고, 장부 접기
import { describe, expect, it } from 'vitest';
import { chapters, commonStrings } from '../data/registry';
import { createTranslator } from '../i18n';
import { ch1, newGame } from '../test/fixtures';
import type { Line, PhaseReport } from '../engine';
import { eventLead, firstSentence, foldRows, paragraphs, recapOf } from './story';

const tr = createTranslator([commonStrings.ko, chapters['ch1']!.strings.ko], { tribe: '잿빛강 사람들' });

describe('글 만들기', () => {
  it('첫 문장: 마침표·물음표까지, 마침표가 없으면 전체', () => {
    expect(firstSentence('곰이 왔다. 불을 키웠다.')).toBe('곰이 왔다.');
    expect(firstSentence('어디로 갈까? 모른다.')).toBe('어디로 갈까?');
    expect(firstSentence('끝없는 눈')).toBe('끝없는 눈');
  });

  it('사건 제목 줄은 사건 직전 문장 문단이 되고, 그 뒤 사건 줄은 새 문단이다', () => {
    const s = newGame('story');
    const ev = ch1.content.events[0]!.id;
    const lines: Line[] = [
      { key: 'line.chose', params: { option: 'x' }, group: 'village' },
      { key: `event.${ev}.title`, group: 'event' },
      { key: 'line.chose', params: { option: 'y' }, group: 'event' },
    ];
    const ps = paragraphs(tr, ch1, s, lines);
    expect(ps).toHaveLength(3);
    expect(ps[1]).toMatchObject({ label: tr.t(`event.${ev}.title`), text: eventLead(tr, ev), lead: true });
    expect(ps[2]!.lead).toBeUndefined();
  });

  it('한 줄 회고: 사건이 있으면 사건 직전 문장과 고른 것', () => {
    const s = newGame('story');
    const ev = ch1.content.events[0]!;
    const opt = ev.options[0]!.id;
    const r: PhaseReport = {
      slot: 'mid',
      scene: { bg: 'x' },
      lines: [
        { key: `event.${ev.id}.title`, group: 'event' },
        { key: 'line.chose', params: { option: { key: `event.${ev.id}.opt.${opt}` } }, group: 'event' },
      ],
      deltas: {},
      rows: [],
      alerts: [],
      from: { food: 0, firewood: 0 },
    };
    const rc = recapOf(tr, ch1, s, r)!;
    expect(rc.text).toBe(eventLead(tr, ev.id));
    expect(rc.chose).toBe(tr.t(`event.${ev.id}.opt.${opt}`));
  });

  it('장부 행이 넘치면 큰 것만 두고 나머지는 "그 밖"으로 합친다', () => {
    const rows = [5, 4, 3, 2, 1].map((d) => ({ res: 'food', source: `s${d}`, delta: d }));
    expect(foldRows(rows, 5).rest).toBeUndefined();
    const f = foldRows(rows, 4);
    expect(f.shown.map((r) => r.delta)).toEqual([5, 4, 3]);
    expect(f.rest).toEqual({ delta: 3, count: 2 });
  });

  it('"그 밖"에는 양이 작은 줄부터 들어가고, 먹은 양 줄은 작아도 묶이지 않는다', () => {
    const rows = [
      { res: 'food', source: 'spoil', delta: -90 },
      { res: 'food', source: 'feast', delta: -40 },
      { res: 'food', source: 'upkeep.food', delta: -12 },
      { res: 'food', source: 'gift', delta: -8 },
      { res: 'food', source: 'wolves', delta: -3 },
    ];
    const f = foldRows(rows, 3);
    expect(f.shown.map((r) => r.source)).toEqual(['spoil', 'upkeep.food']);
    expect(f.rest).toEqual({ delta: -51, count: 3 });
    // 들어온 순서가 크기 순이 아니어도 작은 것부터 묶인다
    const g = foldRows([rows[4]!, rows[0]!, rows[3]!, rows[1]!], 3);
    expect(g.shown.map((r) => r.source)).toEqual(['spoil', 'feast']);
  });
});
