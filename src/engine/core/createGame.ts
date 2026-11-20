// 게임 생성: (장 정의, 시작 출처) → 1턴 시작 상태 (DESIGN.md §2.5)

import type { ChapterDefinition, GameState, Id, Person } from '../types';
import { buildStartingDeck } from '../actions/deck';
import { seedToState } from '../rng/rng';
import { SAVE_VERSION } from '../save/version';
import { rolesTotal } from './population';
import { beginTurn } from './turn';

export type StartSource =
  | { kind: 'preset'; presetId: Id; tribeTraits: Id[]; seed: string }
  /** 이전 장 결과로 시작 — ChapterResult와 함께 M6에서 구현한다 */
  | { kind: 'previous'; result: unknown; seed: string };

export function createGame(def: ChapterDefinition, source: StartSource): GameState {
  if (source.kind === 'previous') {
    if (!def.importFromPrevious) throw new Error(`chapter ${def.id} cannot start from a previous chapter`);
    throw new Error('starting from a previous chapter result is not implemented yet (M6)');
  }

  const preset = def.startPresets.find((p) => p.id === source.presetId);
  if (!preset) throw new Error(`unknown preset: ${source.presetId}`);
  if (rolesTotal(preset.roles) !== preset.population) {
    throw new Error(`preset ${preset.id}: roles must sum to population`);
  }
  for (const t of source.tribeTraits) {
    if (!def.content.tribeTraits.some((x) => x.id === t)) throw new Error(`unknown tribe trait: ${t}`);
  }

  const people: Record<Id, Person> = {};
  for (const p of preset.people) {
    people[p.id] = {
      id: p.id,
      name: p.name,
      sex: p.sex,
      stage: p.stage,
      stageTurns: p.stageTurns,
      office: p.office,
      traits: [...p.traits],
      relation: p.relation,
      parents: [p.parents[0], p.parents[1]],
      alive: true,
      bornTurn: 0,
      bornReign: 0,
      death: null,
      ambition: 0,
    };
  }

  const roles: Record<Id, number> = {};
  for (const r of def.roles) roles[r.id] = preset.roles[r.id] ?? 0;
  const resources: Record<Id, number> = {};
  for (const r of def.resources) resources[r.id] = preset.resources[r.id] ?? 0;
  const axes: Record<Id, number> = {};
  for (const a of def.axes) axes[a.id] = preset.axes[a.id] ?? 0;

  const state: GameState = {
    saveVersion: SAVE_VERSION,
    chapterId: def.id,
    seed: source.seed,
    rng: seedToState(source.seed),
    turn: 0,
    season: '',
    reign: 1,
    reignStartTurn: 1,
    eraId: preset.era,
    phase: 'action',
    tribe: {
      name: preset.tribeName,
      traits: [...source.tribeTraits],
      population: preset.population,
      roles,
      resources,
      axes,
      lifestyle: preset.lifestyle,
      growth: 0,
      hunger: 0,
    },
    people,
    regions: { current: preset.region, discovered: [preset.region], state: { [preset.region]: { depletion: 0 } } },
    knowledge: [...preset.knowledge],
    traditions: {},
    flags: {},
    counters: {},
    actions: { playsLeft: 0, busy: [] },
    deck: { draw: [], hand: [], discard: [] },
    events: { pending: [], scheduled: [], history: {}, recentTags: [] },
    chronicle: [],
    delayed: [],
    modifiers: [],
    seq: 0,
    turnLog: [],
    history: [],
    ending: null,
  };

  buildStartingDeck(def, state);
  beginTurn(def, state);
  return state;
}
