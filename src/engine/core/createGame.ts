// 시작 프리셋 → 게임 상태. 이전 장의 결과(ChapterResult)로 시작하는 길은 M5에서 붙인다 (DESIGN.md §3.6).

import type { ChapterDefinition, GameState, Person, PlaceState } from '../types';
import { byId, monthDef } from './lookup';
import { seedToState, nextInt } from '../rng/rng';
import { SAVE_VERSION } from '../save/version';
import { freshWork, startMonth } from '../month/month';
import { addLot } from '../stores/food';
import { population } from '../people/people';

export interface NewGameOptions {
  presetId?: string;
  seed: string;
  /** 플레이어가 정한 부족 이름. 없거나 비면 프리셋의 기본 이름 */
  tribeName?: string;
}

/** 부족 이름의 길이 한계 (글자). 화면 머리글과 상단 바에 들어가야 한다 */
export const TRIBE_NAME_MAX = 12;

export function cleanTribeName(name: string | undefined): string {
  return [...(name ?? '').replace(/\s+/g, ' ').trim()].slice(0, TRIBE_NAME_MAX).join('');
}

export function createGame(def: ChapterDefinition, opts: NewGameOptions): GameState {
  // 프리셋을 고르지 않으면 화면에 보이는 첫 프리셋 (숨은 프리셋은 테스트용)
  const preset = opts.presetId ? byId(def.presets, opts.presetId, 'preset') : (def.presets.find((p) => !p.hidden) ?? def.presets[0]);
  if (!preset) throw new Error(`chapter ${def.id} has no presets`);
  const rng = seedToState(opts.seed);

  const people: Record<string, Person> = {};
  for (const pp of preset.people) {
    // 태어난 달: 시작 달(1) 기준으로 나이만큼 거슬러 가고, 생일은 시드로 흩는다
    const birthMonth = 1 - pp.age * 12 - nextInt(rng, 0, 11);
    people[pp.id] = {
      id: pp.id,
      name: { key: `person.${pp.id}` },
      sex: pp.sex,
      birthMonth,
      alive: true,
      parents: pp.parents ?? [],
      traits: pp.traits ?? [],
      skills: pp.skills ?? {},
      ...(pp.advisor ? { advisor: pp.advisor } : {}),
      ...(pp.isChief ? { isChief: true } : {}),
      ailments: [],
      hungerDays: 0,
    };
  }

  const places: Record<string, PlaceState> = {};
  for (const p of def.places) {
    const stock: Record<string, number> = {};
    for (const [y, max] of Object.entries(p.stockMax)) if (max !== undefined) stock[y] = max;
    places[p.id] = { discovered: preset.discovered.includes(p.id), stock, facts: [] };
  }

  const food: GameState['stores']['food'] = [];
  for (const f of preset.food) addLot(food, f.kind, f.kg);

  const state: GameState = {
    saveVersion: SAVE_VERSION,
    chapterId: def.id,
    presetId: preset.id,
    seed: opts.seed,
    rng,
    tribeName: cleanTribeName(opts.tribeName),
    month: 0,
    startMonthIndex: preset.startMonthIndex,
    step: 'policy',
    campPlace: preset.campPlace,
    shelter: { kind: preset.shelter, place: preset.campPlace, units: preset.shelterUnits },
    people,
    chiefLine: 1,
    stores: { food, firewood: preset.firewood, goods: { ...preset.goods } },
    cohesion: preset.cohesion,
    hungerStage: 0,
    places,
    animals: structuredClone(preset.animals),
    knowledge: { has: [...preset.knowledge], progress: {} },
    clues: [],
    caches: [],
    scheduled: [],
    modifiers: [],
    flags: {},
    counters: {},
    cooldowns: {},
    usedOnce: [],
    narrativeRecent: {},
    work: freshWork(['', '', ''], { food: 0, firewood: 0, population: 0 }),
    history: [],
    chronicle: [],
    seq: 0,
  };
  startMonth(def, state);
  // 연대기의 첫 문장 (기록자 시점)
  state.chronicle.push({ month: 1, monthId: monthDef(def, state).id, key: preset.presentation.chronicleOpening, params: { pop: population(state) } });
  return state;
}
