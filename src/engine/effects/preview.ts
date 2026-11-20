// 효과 미리보기 (DESIGN.md §4.2, §4.3): 상태를 바꾸지 않고 UI에 보일 목록을 만든다.
// 확실한 효과는 수치, check는 성공 확률, random은 "알 수 없음", 예약·지연은 "언젠가 돌아온다"로만.
// 플래그와 연대기는 보이지 않는다.

import type { ChapterDefinition, Effect, GameState, Id } from '../types';
import { allTrue, type Actors } from '../conditions/evaluate';
import { checkProbability, resolvePerson, type EffectCtx } from './apply';

export type PreviewItem =
  | { kind: 'resource'; key: Id; delta: number }
  | { kind: 'population'; delta: number }
  | { kind: 'axis'; axis: Id; delta: number }
  | { kind: 'counter'; id: Id; delta: number }
  | { kind: 'modifier'; stat: string; op: 'add' | 'mul'; value: number; duration: number }
  | { kind: 'person'; personId: Id; relation: number }
  | { kind: 'trait'; personId: Id; trait: Id; added: boolean }
  | { kind: 'card'; cardId: Id; delta: number }
  | { kind: 'chance'; p: number; success: PreviewItem[]; failure: PreviewItem[] }
  | { kind: 'random'; outcomes: { weight: number; labelKey?: string }[] }
  | { kind: 'later' };

export function previewEffects(
  def: ChapterDefinition,
  state: GameState,
  effects: readonly Effect[],
  actors: Actors = {},
): PreviewItem[] {
  const ctx: EffectCtx = { def, state, source: 'preview', actors };
  const out: PreviewItem[] = [];
  const merge = (item: PreviewItem) => {
    if (item.kind === 'resource') {
      const prev = out.find((x) => x.kind === 'resource' && x.key === item.key);
      if (prev && prev.kind === 'resource') return void (prev.delta += item.delta);
    }
    if (item.kind === 'axis') {
      const prev = out.find((x) => x.kind === 'axis' && x.axis === item.axis);
      if (prev && prev.kind === 'axis') return void (prev.delta += item.delta);
    }
    if (item.kind === 'population') {
      const prev = out.find((x) => x.kind === 'population');
      if (prev && prev.kind === 'population') return void (prev.delta += item.delta);
    }
    if (item.kind === 'later' && out.some((x) => x.kind === 'later')) return;
    out.push(item);
  };

  for (const e of effects) {
    switch (e.type) {
      case 'resource':
        merge({ kind: 'resource', key: e.key, delta: e.delta });
        break;
      case 'population':
        merge({ kind: 'population', delta: e.delta });
        break;
      case 'axis':
        merge({ kind: 'axis', axis: e.axis, delta: e.delta });
        break;
      case 'counter':
        merge({ kind: 'counter', id: e.id, delta: e.delta });
        break;
      case 'modifier':
        merge({ kind: 'modifier', stat: e.mod.stat, op: e.mod.op, value: e.mod.value, duration: e.duration });
        break;
      case 'person': {
        const p = resolvePerson(ctx, e.ref);
        if (!p) break;
        if (e.change.relation) merge({ kind: 'person', personId: p.id, relation: e.change.relation });
        if (e.change.addTrait) merge({ kind: 'trait', personId: p.id, trait: e.change.addTrait, added: true });
        if (e.change.removeTrait) merge({ kind: 'trait', personId: p.id, trait: e.change.removeTrait, added: false });
        break;
      }
      case 'addCard':
        merge({ kind: 'card', cardId: e.id, delta: e.count ?? 1 });
        break;
      case 'removeCard':
        merge({ kind: 'card', cardId: e.id, delta: -1 });
        break;
      case 'schedule':
      case 'delayed':
        merge({ kind: 'later' });
        break;
      case 'random':
        merge({ kind: 'random', outcomes: e.outcomes.map((o) => ({ weight: o.weight, labelKey: o.labelKey })) });
        break;
      case 'check':
        merge({
          kind: 'chance',
          p: checkProbability(ctx, e.power, e.difficulty),
          success: previewEffects(def, state, e.success, actors),
          failure: previewEffects(def, state, e.failure, actors),
        });
        break;
      case 'if':
        for (const item of previewEffects(def, state, allTrue(def, state, e.when, actors) ? e.then : (e.else ?? []), actors)) merge(item);
        break;
      case 'flag':
      case 'chronicle':
        break;
    }
  }
  return out.filter((x) => !('delta' in x) || x.delta !== 0);
}
