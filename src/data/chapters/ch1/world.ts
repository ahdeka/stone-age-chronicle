// 1장 세계: 식량 종류, 물자, 거처, 장소, 동물, 날씨, 병, 특성, 지식, 단서 (DESIGN.md §3.3~3.4, §9)
// 장소 기준(시험 플레이): 잿빛강 굽이의 바위 그늘, 북쪽 소나무 숲, 동쪽 초원, 남쪽 늪지.

import type {
  AilmentDef,
  AnimalDef,
  ClueDef,
  FoodKindDef,
  KnowledgeDef,
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
];

export const ch1Goods = ['hide', 'bear_hide', 'spear', 'knife', 'net'];

export const ch1Shelters: ShelterDef[] = [
  { id: 'tent', firewoodMul: 1, scene: 'bg.camp_tents' },
  { id: 'rock_cave', firewoodMul: 0.5, scene: 'bg.cave_inside' },
  { id: 'pit_house', firewoodMul: 0.6, scene: 'bg.camp_tents' },
];

export const ch1Yields: YieldDef[] = [
  { id: 'gather', foodKind: 'roots' },
  { id: 'fish', foodKind: 'fish' },
];

export const ch1Places: PlaceDef[] = [
  {
    id: 'river_bend',
    kind: 'river',
    travelDays: 0,
    scene: 'bg.river_ford',
    // 순당 마을 일꾼 한 사람의 기대 수확 kg (시험 플레이 1달: 일손 6명이 한 달 약 90kg)
    yields: { spring: { gather: 4, fish: 2 }, summer: { gather: 9, fish: 3 }, autumn: { gather: 4, fish: 1.5 }, winter: { gather: 1, fish: 5 } },
    stockMax: { gather: 400, fish: 300 },
    recoverPerMonth: 0.3,
  },
  { id: 'reindeer_ford', kind: 'ford', travelDays: 4, scene: 'bg.steppe', yields: {}, stockMax: {}, recoverPerMonth: 0 },
  { id: 'east_steppe', kind: 'steppe', travelDays: 2, scene: 'bg.steppe', yields: {}, stockMax: {}, recoverPerMonth: 0 },
  { id: 'north_forest', kind: 'forest', travelDays: 2, scene: 'bg.north_forest', yields: {}, stockMax: {}, recoverPerMonth: 0 },
  { id: 'north_cave', kind: 'cave', travelDays: 2, scene: 'bg.cave_mouth', yields: {}, stockMax: {}, recoverPerMonth: 0 },
  { id: 'south_marsh', kind: 'marsh', travelDays: 2, scene: 'bg.marsh', yields: {}, stockMax: {}, recoverPerMonth: 0 },
  { id: 'reed_lake', kind: 'lake', travelDays: 6, scene: 'bg.reed_lake', yields: {}, stockMax: {}, recoverPerMonth: 0 },
];

export const ch1Animals: AnimalDef[] = [
  {
    id: 'reindeer',
    states: ['north', 'migrating', 'south'],
    schedule: [
      { month: 'reindeer', to: 'migrating', chance: 0.7, at: 'reindeer_ford' },
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
      { month: 'snow', to: 'near_camp', chance: 0.3, at: 'river_bend' },
      { month: 'thaw', to: 'roaming', chance: 0.5, at: null },
    ],
    meatKg: 0,
    foodKind: 'raw_meat',
  },
  {
    id: 'bear',
    states: ['active', 'denning'],
    schedule: [
      { month: 'frost', to: 'denning', chance: 1 },
      { month: 'thaw', to: 'active', chance: 0.8 },
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
];

export const ch1Weather: WeatherDef[] = [
  { id: 'clear', mods: [] },
  { id: 'frost', mods: [{ stat: 'firewood.burnMul', op: 'mul', value: 1.1 }] },
  { id: 'rain', mods: [{ stat: 'yield.wood', op: 'mul', value: 0.7 }], overlay: 'ov.rain' },
  { id: 'fog', mods: [{ stat: 'hunt.weather', op: 'add', value: -0.3 }], overlay: 'ov.fog' },
  { id: 'drought', mods: [{ stat: 'yield.gather', op: 'mul', value: 0.7 }] },
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
      { stat: 'hunt.weather', op: 'add', value: -2 },
    ],
    overlay: 'ov.blizzard',
  },
];

export const ch1Ailments: AilmentDef[] = [
  { id: 'fracture', phases: [5, 7], noLabor: true, deathChance: 0 },
  { id: 'claw', phases: [2, 4], noLabor: true, deathChance: 0.005 },
  { id: 'frostbite', phases: [2, 3], noLabor: true, deathChance: 0 },
  { id: 'cough', phases: [3, 6], noLabor: true, deathChance: 0.03 },
  { id: 'fever', phases: [2, 4], noLabor: true, deathChance: 0.03 },
];

export const ch1Traits: TraitDef[] = [
  { id: 'brave' },
  { id: 'careful' },
  { id: 'tracker' },
  { id: 'herbalist' },
  { id: 'crafty' },
  { id: 'storyteller' },
];

export const ch1Knowledge: KnowledgeDef[] = [
  { id: 'meat_drying', need: 3, mods: [{ stat: 'spoil.mul', op: 'mul', value: 0.85 }] },
  { id: 'sled', need: 3, mods: [{ stat: 'carry.perPerson', op: 'mul', value: 1.8, when: [{ type: 'season', in: ['winter'] }] }] },
  { id: 'storage_pit', need: 3, mods: [] },
  { id: 'ice_fishing', need: 2, mods: [{ stat: 'yield.fish', op: 'add', value: 1, when: [{ type: 'season', in: ['winter'] }] }] },
  { id: 'fur_clothes', need: 3, mods: [{ stat: 'firewood.burnMul', op: 'mul', value: 0.8 }] },
];

export const ch1Clues: ClueDef[] = [{ id: 'deer_cross_river', mods: [{ stat: 'hunt.bonus', op: 'add', value: 1 }], reveals: ['deer_whereabouts'] }];
