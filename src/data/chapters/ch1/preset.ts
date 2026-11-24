// 시작 프리셋: 봄 시작(기본)과 숨은 늦가을 시작(시험 플레이 재현용, docs/playtest-log.md "시작 브리핑")
// 34명: 성인 18(남 9, 여 9), 노인 4, 아이 12. 모두 이름, 나이, 부모·자식 관계를 가진다.

import type { LandFact, PresetPerson, StartPreset } from '../../../engine';
import { CH1_AUTUMN_MONTH_INDEX, CH1_START_MONTH_INDEX } from './calendar';

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
const A = 'preset.grey_river_autumn';

const landFacts: LandFact[] = (['terrain', 'climate', 'rain', 'river', 'soil', 'danger'] as const).map((f) => ({
  icon: f,
  label: `${P}.land.${f}.label`,
  value: `${P}.land.${f}.value`,
  ...(f === 'danger' ? { tone: 'warn' as const } : {}),
}));
const land = { title: `${P}.land.title`, subtitle: `${P}.land.subtitle`, intro: `${P}.land.intro`, facts: landFacts };
const nameSuggestions = ['tribe.suggest.grey_river', 'tribe.suggest.willow_brook', 'tribe.suggest.white_ford', 'tribe.suggest.dawn_fire'];
const discovered = ['river_bend', 'reindeer_ford', 'east_steppe', 'north_forest', 'south_marsh'];
const lines = (k: string) => [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `${k}.intro.${n}`);

/** 기본 시작: 긴 겨울을 막 넘긴 봄 (1년차 3월 녹는달). DESIGN.md §10.2 */
export const ch1SpringPreset: StartPreset = {
  id: 'grey_river',
  presentation: {
    chapterLabel: `${P}.chapter`,
    introLines: lines(P),
    nameSuggestions,
    meta: `${P}.meta`,
    tagline: `${P}.tagline`,
    land,
    chronicleOpening: `${P}.chronicle`,
  },
  shelterUnits: 5,
  startMonthIndex: CH1_START_MONTH_INDEX,
  campPlace: 'river_bend',
  shelter: 'tent',
  // 겨울 끝의 기침: 노인 억새 (서리는 건강하다 — C5를 위해)
  people: ch1People.map((p) => (p.id === 'eoksae' ? { ...p, ailing: { kind: 'cough', severity: 1 as const, phases: 4 } } : p)),
  food: [
    { kind: 'roots', kg: 70 },
    { kind: 'dried_meat', kg: 50 },
  ],
  firewood: 80,
  goods: { hide: 4, bear_hide: 0, spear: 14, knife: 9, net: 1, willow_bark: 0 },
  cohesion: 55,
  discovered,
  animals: {
    reindeer: { state: 'migrating', at: 'reindeer_ford', known: true, vars: {} },
    wolves: { state: 'roaming', known: true, vars: {} },
    bear: { state: 'active', at: 'north_forest', known: false, vars: {} },
    red_deer: { state: 'scattered', known: false, vars: {} },
    fish: { state: 'running', known: true, vars: {} },
  },
  knowledge: [],
};

/** 숨은 시작: 시험 플레이 재현 테스트용 늦가을 (낙엽달). 화면의 시작에는 나오지 않는다 */
export const ch1AutumnPreset: StartPreset = {
  ...ch1SpringPreset,
  id: 'grey_river_autumn',
  hidden: true,
  presentation: {
    ...ch1SpringPreset.presentation,
    introLines: lines(A),
    meta: `${A}.meta`,
    tagline: `${A}.tagline`,
    chronicleOpening: `${A}.chronicle`,
  },
  startMonthIndex: CH1_AUTUMN_MONTH_INDEX,
  people: ch1People,
  food: [
    { kind: 'raw_meat', kg: 220 },
    { kind: 'roots', kg: 200 },
    { kind: 'dried_meat', kg: 100 },
  ],
  firewood: 150,
  goods: { hide: 12, bear_hide: 0, spear: 14, knife: 9, net: 1, willow_bark: 0 },
  cohesion: 60,
  animals: {
    reindeer: { state: 'migrating', at: 'reindeer_ford', known: true, vars: {} },
    wolves: { state: 'near_camp', at: 'river_bend', known: true, vars: { hunger: 1 } },
    bear: { state: 'active', at: 'north_cave', known: false, vars: {} },
    red_deer: { state: 'scattered', known: false, vars: {} },
    fish: { state: 'scarce', known: true, vars: {} },
  },
};
