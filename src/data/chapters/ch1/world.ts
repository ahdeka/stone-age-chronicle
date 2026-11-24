// 1장 세계: 식량 종류, 물자, 거처, 장소, 동물, 날씨, 병, 특성, 지식, 단서 (DESIGN.md §3.3~3.4, §9, §10.3)
// 장소 기준(시험 플레이): 잿빛강 굽이의 바위 그늘, 북쪽 소나무 숲, 동쪽 초원, 남쪽 늪지.
// 봄 시작(2026-11-20): 계절마다 다른 먹을거리가 마을 일에 들어온다 (봄 물고기 떼, 여름 풀과 열매, 가을 견과, 올가미).

import type {
  AilmentDef,
  AnimalDef,
  ClueDef,
  FacilityDef,
  FoodKindDef,
  KnowledgeDef,
  ModifierDef,
  PlaceDef,
  ShelterDef,
  TraitDef,
  WeatherDef,
  YieldDef,
} from '../../../engine';

export const ch1FoodKinds: FoodKindDef[] = [
  { id: 'raw_meat', spoil: { frozen: 0.005, cold: 0.015, mild: 0.06, warm: 0.15 }, carryFactor: 1 },
  { id: 'dried_meat', spoil: { frozen: 0.003, cold: 0.005, mild: 0.01, warm: 0.02 }, carryFactor: 0.5 },
  { id: 'dried_fish', spoil: { frozen: 0.003, cold: 0.005, mild: 0.01, warm: 0.02 }, carryFactor: 0.5 },
  { id: 'fish', spoil: { frozen: 0.01, cold: 0.03, mild: 0.1, warm: 0.2 }, carryFactor: 1 },
  { id: 'roots', spoil: { frozen: 0.01, cold: 0.02, mild: 0.03, warm: 0.06 }, carryFactor: 1 },
  /** 가을 견과: 오래 간다 */
  { id: 'nuts', spoil: { frozen: 0.002, cold: 0.003, mild: 0.006, warm: 0.012 }, carryFactor: 0.8 },
];

/** 날것 (말리기 대상) */
export const RAW_KINDS = ['raw_meat', 'fish'];
/** 오래 가는 식량 (시대 목표 "석 달분 비축", 시뮬레이터의 준비 정도) */
export const DURABLE_KINDS = ['dried_meat', 'dried_fish', 'nuts'];

export const ch1Goods = ['hide', 'bear_hide', 'spear', 'knife', 'net', 'willow_bark'];

export const ch1Shelters: ShelterDef[] = [
  { id: 'tent', firewoodMul: 1, scene: 'bg.camp_tents' },
  {
    // 바위굴: 장작이 절반만 들고 장작을 많이 쌓아 둘 수 있다. 대신 강이 멀어 물고기가 준다
    id: 'rock_cave',
    firewoodMul: 0.5,
    mods: [
      { stat: 'firewood.cap', op: 'add', value: 900 },
      { stat: 'yield.fish', op: 'mul', value: 0.7 },
      { stat: 'yield.fish_run', op: 'mul', value: 0.7 },
    ],
    scene: 'bg.cave_inside',
  },
  { id: 'pit_house', firewoodMul: 0.6, scene: 'bg.camp_tents' },
];

/** 마을 일의 수확 종류. 'yield.<id>' 스탯이 0이면 그 철에 나지 않는다 (balance 기본값과 아래 계절 모디파이어) */
export const ch1Yields: YieldDef[] = [
  { id: 'gather', foodKind: 'roots' },
  { id: 'fish', foodKind: 'fish' },
  /** 봄 물고기 떼 (녹는달~새싹달, 동물 'fish'가 running일 때만) */
  { id: 'fish_run', foodKind: 'fish' },
  /** 알달의 철새 알 */
  { id: 'eggs', foodKind: 'roots' },
  /** 여름 풀과 열매 */
  { id: 'greens', foodKind: 'roots' },
  /** 가을 견과 (열매달~순록달) */
  { id: 'nuts', foodKind: 'nuts' },
  /** 올가미 (올가미 방침을 할 때만). 같은 자리를 계속 쓰면 준다 */
  { id: 'snare', foodKind: 'raw_meat' },
];

export const ch1Places: PlaceDef[] = [
  {
    id: 'river_bend',
    kind: 'river',
    travelDays: 0,
    scene: 'bg.camp_tents',
    // 순당 마을 일꾼 한 사람의 기대 수확 kg (시험 플레이 늦가을: 일손 6명이 한 달 약 90kg)
    yields: {
      spring: { gather: 5, fish: 2, fish_run: 10, eggs: 6, greens: 6 },
      summer: { gather: 4, fish: 3, greens: 12 },
      autumn: { gather: 4, fish: 1.5, nuts: 9, snare: 6 },
      winter: { gather: 1, fish: 5, snare: 6 },
    },
    stockMax: { gather: 400, fish: 300, fish_run: 1600, eggs: 500, greens: 2500, nuts: 900, snare: 450 },
    recoverPerMonth: 0.3,
  },
  { id: 'reindeer_ford', kind: 'ford', travelDays: 4, scene: 'bg.river_ford', yields: {}, stockMax: {}, recoverPerMonth: 0 },
  { id: 'east_steppe', kind: 'steppe', travelDays: 2, scene: 'bg.steppe', yields: {}, stockMax: {}, recoverPerMonth: 0 },
  { id: 'north_forest', kind: 'forest', travelDays: 2, scene: 'bg.north_forest', yields: {}, stockMax: {}, recoverPerMonth: 0 },
  { id: 'north_cave', kind: 'cave', travelDays: 2, scene: 'bg.cave_mouth', yields: {}, stockMax: {}, recoverPerMonth: 0 },
  { id: 'south_marsh', kind: 'marsh', travelDays: 2, scene: 'bg.marsh', yields: {}, stockMax: {}, recoverPerMonth: 0 },
  { id: 'reed_lake', kind: 'lake', travelDays: 6, scene: 'bg.reed_lake', yields: {}, stockMax: {}, recoverPerMonth: 0 },
];

export const ch1Animals: AnimalDef[] = [
  {
    // 순록: 봄에 북쪽으로, 가을에 남쪽으로 초원을 지난다
    id: 'reindeer',
    states: ['north', 'migrating', 'south'],
    schedule: [
      { month: 'reindeer', to: 'migrating', chance: 0.75, at: 'reindeer_ford' },
      { month: 'leaf', to: 'migrating', chance: 0.6, at: 'reindeer_ford' },
      { month: 'frost', to: 'south', chance: 1, at: null },
      { month: 'thaw', to: 'migrating', chance: 0.6, at: 'reindeer_ford' },
      { month: 'sprout', to: 'north', chance: 1, at: null },
    ],
    meatKg: 50,
    foodKind: 'raw_meat',
    goods: { hide: 1 },
  },
  {
    id: 'wolves',
    states: ['roaming', 'near_camp'],
    schedule: [
      { month: 'leaf', to: 'near_camp', chance: 0.5, at: 'river_bend' },
      { month: 'snow', to: 'near_camp', chance: 0.3, at: 'river_bend' },
      { month: 'thaw', to: 'roaming', chance: 0.5, at: null },
      { month: 'longday', to: 'roaming', chance: 1, at: null },
    ],
    meatKg: 0,
    foodKind: 'raw_meat',
  },
  {
    // 곰: 서리달에 북쪽 숲의 바위굴로 들어가 잠들고, 녹는달에 깨어 숲을 돈다 (여름에는 굴이 빈다)
    id: 'bear',
    states: ['active', 'denning'],
    schedule: [
      { month: 'frost', to: 'denning', chance: 1, at: 'north_cave' },
      { month: 'thaw', to: 'active', chance: 0.8, at: 'north_forest' },
      { month: 'sprout', to: 'active', chance: 1, at: 'north_forest' },
    ],
    meatKg: 250,
    foodKind: 'raw_meat',
    goods: { bear_hide: 1 },
  },
  {
    id: 'red_deer',
    states: ['scattered', 'river_crossing'],
    schedule: [
      { month: 'ice', to: 'river_crossing', chance: 0.6, at: 'river_bend' },
      { month: 'thaw', to: 'scattered', chance: 1, at: null },
    ],
    meatKg: 90,
    foodKind: 'raw_meat',
    goods: { hide: 1 },
  },
  {
    // 봄 물고기 떼: 얼음이 풀리면 강을 거슬러 오른다
    id: 'fish',
    states: ['scarce', 'running'],
    schedule: [
      { month: 'thaw', to: 'running', chance: 1 },
      { month: 'egg', to: 'scarce', chance: 1 },
    ],
    meatKg: 0,
    foodKind: 'fish',
  },
];

/** 계절 수확을 켜는 장 전역 모디파이어 (기본값 0인 수확 스탯) */
export const ch1GlobalMods: ModifierDef[] = [
  { stat: 'yield.fish_run', op: 'add', value: 1, when: [{ type: 'animal', id: 'fish', state: ['running'] }] },
  { stat: 'yield.eggs', op: 'add', value: 1, when: [{ type: 'monthOfYear', in: ['egg'] }] },
  // 여름 풀과 열매: 알달(늦봄)부터 돋는다
  { stat: 'yield.greens', op: 'add', value: 1, when: [{ type: 'any', of: [{ type: 'season', in: ['summer'] }, { type: 'monthOfYear', in: ['egg'] }] }] },
  { stat: 'yield.nuts', op: 'add', value: 1, when: [{ type: 'monthOfYear', in: ['fruit', 'reindeer'] }] },
];

export const ch1Weather: WeatherDef[] = [
  { id: 'clear', mods: [] },
  { id: 'frost', mods: [{ stat: 'firewood.burnMul', op: 'mul', value: 1.1 }] },
  { id: 'rain', mods: [{ stat: 'yield.wood', op: 'mul', value: 0.7 }], overlay: 'ov.rain' },
  { id: 'fog', mods: [{ stat: 'hunt.weather', op: 'add', value: -0.3 }], overlay: 'ov.fog' },
  { id: 'drought', mods: [{ stat: 'yield.gather', op: 'mul', value: 0.7 }, { stat: 'yield.greens', op: 'mul', value: 0.7 }] },
  { id: 'snow', mods: [{ stat: 'yield.gather', op: 'mul', value: 0.6 }, { stat: 'hunt.weather', op: 'add', value: -0.3 }], overlay: 'ov.snow' },
  {
    id: 'cold_snap',
    mods: [{ stat: 'firewood.burnMul', op: 'mul', value: 1.3 }, { stat: 'hunt.weather', op: 'add', value: -0.5 }],
  },
  {
    id: 'blizzard',
    mods: [
      { stat: 'firewood.burnMul', op: 'mul', value: 1.5 },
      { stat: 'yield.wood', op: 'mul', value: 0.4 },
      { stat: 'yield.gather', op: 'mul', value: 0.3 },
      { stat: 'yield.snare', op: 'mul', value: 0.5 },
      { stat: 'hunt.weather', op: 'add', value: -2 },
    ],
    overlay: 'ov.blizzard',
  },
];

export const ch1Ailments: AilmentDef[] = [
  { id: 'fracture', type: 'injury', phases: [5, 7], noLabor: true, deathChance: 0 },
  { id: 'claw', type: 'injury', phases: [2, 4], noLabor: true, deathChance: 0.005 },
  { id: 'frostbite', type: 'injury', phases: [2, 3], noLabor: true, deathChance: 0 },
  { id: 'cough', type: 'sickness', phases: [3, 6], noLabor: true, deathChance: 0.03 },
  { id: 'fever', type: 'sickness', phases: [2, 4], noLabor: true, deathChance: 0.03 },
];

export const ch1Traits: TraitDef[] = [
  { id: 'brave' },
  { id: 'careful' },
  { id: 'tracker' },
  { id: 'herbalist' },
  { id: 'crafty' },
  { id: 'storyteller' },
];

/** 시설: 지은 것 (DESIGN.md §9.1). 지식은 아는 것, 시설은 지은 것이다 */
export const ch1Facilities: FacilityDef[] = [
  // 장작 덧집 (장작 비축 방침): 비를 막아 장작을 더 쌓아 둔다
  { id: 'wood_shed', max: 1, mods: [{ stat: 'firewood.cap', op: 'add', value: 600 }] },
];

/** 지식은 행동에서 자란다 (need만큼 쌓이면 얻는다). 생존 압박을 푸는 방향으로 작동한다 (DESIGN.md §9, §10.4) */
export const ch1Knowledge: KnowledgeDef[] = [
  { id: 'meat_drying', need: 3, mods: [{ stat: 'spoil.mul', op: 'mul', value: 0.85 }] },
  {
    id: 'sled',
    need: 2,
    mods: [
      { stat: 'carry.perPerson', op: 'mul', value: 1.4, when: [{ type: 'season', in: ['spring', 'summer', 'autumn'] }] },
      { stat: 'carry.perPerson', op: 'mul', value: 1.8, when: [{ type: 'season', in: ['winter'] }] },
    ],
  },
  { id: 'storage_pit', need: 3, mods: [{ stat: 'cache.raid', op: 'mul', value: 0.3 }, { stat: 'spoil.mul', op: 'mul', value: 0.85 }] },
  { id: 'ice_fishing', need: 2, mods: [{ stat: 'yield.fish', op: 'add', value: 1, when: [{ type: 'season', in: ['winter'] }] }] },
  { id: 'fur_clothes', need: 3, mods: [{ stat: 'firewood.burnMul', op: 'mul', value: 0.8 }] },
];

export const ch1Clues: ClueDef[] = [
  // 서리의 옛이야기 (C6): 사슴이 어디로 내려오는지 안다
  { id: 'deer_cross_river', mods: [{ stat: 'hunt.bonus', op: 'add', value: 1 }], reveals: ['deer_whereabouts'] },
  // 서리의 옛이야기 (P9): 곰이 겨울에 어느 굴에서 얼마나 깊이 자는지
  { id: 'bear_den_lore', reveals: ['bear_depth'] },
  // 곰 힘줄 (C3 뒤): 이끼가 질긴 올가미를 꼰다
  { id: 'bear_sinew', mods: [{ stat: 'yield.snare', op: 'mul', value: 1.5 }] },
];
