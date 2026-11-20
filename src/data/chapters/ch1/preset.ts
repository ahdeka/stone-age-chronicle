// 시작 프리셋: 잿빛강 사람들, 낙엽달 (docs/playtest-log.md "시작 브리핑")
// 34명: 성인 18(남 9, 여 9), 노인 4, 아이 12. 모두 이름, 나이, 부모·자식 관계를 가진다.

import type { PresetPerson, StartPreset } from '../../../engine';
import { CH1_START_MONTH_INDEX } from './calendar';

type Row = [id: string, sex: 'f' | 'm', age: number, extra?: Partial<PresetPerson>];

const rows: Row[] = [
  // ── 족장과 조언자 ──
  ['maru', 'm', 38, { isChief: true, skills: { hunt: 2 }, traits: ['careful'] }],
  ['bawi', 'm', 34, { skills: { hunt: 3 }, traits: ['brave'], advisor: { seat: 'hunt_leader', stance: 'bold' } }],
  ['seori', 'f', 66, { skills: { lore: 3 }, traits: ['storyteller'], advisor: { seat: 'elder', stance: 'cautious' } }],
  ['noeul', 'f', 22, { skills: { heal: 2, gather: 2 }, traits: ['herbalist'], advisor: { seat: 'healer', stance: 'practical' } }],
  ['ikki', 'm', 20, { skills: { craft: 3, hunt: 1 }, traits: ['crafty'], advisor: { seat: 'artisan', stance: 'inventive' } }],
  // ── 이름이 알려진 사냥꾼 (시험 플레이) ──
  ['doljjeogwi', 'm', 29, { skills: { hunt: 2 }, traits: ['brave'] }],
  ['galdae', 'm', 17, { skills: { hunt: 2 } }],
  ['sol', 'm', 15, { skills: { hunt: 1 } }],
  // ── 그 밖의 성인 ──
  ['yeoul', 'm', 31, { skills: { hunt: 2 } }],
  ['neoreok', 'm', 42, { skills: { hunt: 1, craft: 1 } }],
  ['garam', 'm', 26, { skills: { hunt: 1 } }],
  ['beodeul', 'f', 36, { skills: { gather: 2 } }],
  ['darae', 'f', 30, { skills: { hunt: 1, gather: 1 } }],
  ['iseul', 'f', 27, { skills: { gather: 2 } }],
  ['meoru', 'f', 33, { skills: { hunt: 1, gather: 1 } }],
  ['dallae', 'f', 24, { skills: { gather: 1 } }],
  ['bora', 'f', 40, { skills: { gather: 2, craft: 1 } }],
  ['nari', 'f', 19, { skills: { gather: 1 } }],
  ['sandeul', 'f', 29, { skills: { gather: 1, craft: 1 } }],
  // ── 노인 ──
  ['neuti', 'm', 68, { skills: { lore: 1 } }],
  ['eoksae', 'f', 61, { skills: { gather: 1 } }],
  ['deunggeol', 'm', 57, { skills: { craft: 2 } }],
  // ── 아이 (부모) ──
  ['dotori', 'm', 9, { parents: ['maru', 'beodeul'] }],
  ['kong', 'f', 5, { parents: ['maru', 'beodeul'] }],
  ['saebyeok', 'f', 11, { parents: ['bawi', 'meoru'] }],
  ['byeol', 'm', 7, { parents: ['bawi', 'meoru'] }],
  ['bangul', 'f', 3, { parents: ['bawi', 'meoru'] }],
  ['gaeam', 'm', 8, { parents: ['yeoul', 'darae'] }],
  ['noru', 'm', 4, { parents: ['yeoul', 'darae'] }],
  ['daram', 'f', 6, { parents: ['neoreok', 'bora'] }],
  ['achim', 'm', 12, { parents: ['neoreok', 'bora'] }],
  ['gureum', 'f', 2, { parents: ['doljjeogwi', 'iseul'] }],
  ['ssari', 'm', 10, { parents: ['garam', 'dallae'] }],
  ['jindal', 'f', 1, { parents: ['garam', 'dallae'] }],
];

/** 성인의 부모가 노인인 경우 (가족 관계) */
const elderParents: Record<string, string[]> = {
  bora: ['deunggeol', 'eoksae'],
  neoreok: ['neuti'],
  beodeul: ['seori'],
};

export const ch1People: PresetPerson[] = rows.map(([id, sex, age, extra]) => ({
  id,
  sex,
  age,
  ...extra,
  ...(elderParents[id] ? { parents: elderParents[id] } : {}),
}));

const P = 'preset.grey_river';

export const ch1Preset: StartPreset = {
  id: 'grey_river',
  presentation: {
    chapterLabel: `${P}.chapter`,
    introLines: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `${P}.intro.${n}`),
    nameSuggestions: ['tribe.suggest.grey_river', 'tribe.suggest.willow_brook', 'tribe.suggest.white_ford', 'tribe.suggest.dawn_fire'],
    meta: `${P}.meta`,
    tagline: `${P}.tagline`,
    land: {
      title: `${P}.land.title`,
      subtitle: `${P}.land.subtitle`,
      intro: `${P}.land.intro`,
      facts: ['terrain', 'climate', 'rain', 'river', 'soil', 'danger'].map((f) => ({
        mark: `${P}.land.${f}.mark`,
        label: `${P}.land.${f}.label`,
        value: `${P}.land.${f}.value`,
      })),
    },
    chronicleOpening: `${P}.chronicle`,
  },
  shelterUnits: 5,
  startMonthIndex: CH1_START_MONTH_INDEX,
  campPlace: 'river_bend',
  shelter: 'tent',
  people: ch1People,
  food: [
    { kind: 'raw_meat', kg: 220 },
    { kind: 'roots', kg: 200 },
    { kind: 'dried_meat', kg: 100 },
  ],
  firewood: 150,
  goods: { hide: 12, bear_hide: 0, spear: 14, knife: 9, net: 1 },
  cohesion: 60,
  discovered: ['river_bend', 'reindeer_ford', 'east_steppe', 'north_forest', 'south_marsh'],
  animals: {
    reindeer: { state: 'migrating', at: 'reindeer_ford', known: true, vars: {} },
    wolves: { state: 'near_camp', at: 'river_bend', known: true, vars: { hunger: 1 } },
    bear: { state: 'active', at: 'north_cave', known: false, vars: {} },
    red_deer: { state: 'scattered', known: false, vars: {} },
  },
  knowledge: [],
};
