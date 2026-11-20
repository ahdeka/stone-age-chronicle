// 화면용 문장 조립: 템플릿 변수, 연대기 시간 표기, 잠금 힌트.

import { findChief, type ChapterDefinition, type ChronicleEntry, type Condition, type GameState, type Label } from '../engine';
import type { Translator } from '../i18n';

/** 지금 상태로 본문 템플릿 변수를 만든다 (연대기는 엔진이 그 시점 값으로 굳혀 둔다) */
export function liveParams(def: ChapterDefinition, state: GameState, tr: Translator, actors: Record<string, string> = {}): Record<string, string> {
  const params: Record<string, string> = {
    tribe: tr.label(state.tribe.name),
    region: tr.t(`region.${state.regions.current}.name`),
  };
  const chief = findChief(def, state);
  if (chief) params['chief'] = tr.label(chief.name);
  for (const [slot, id] of Object.entries(actors)) {
    const p = state.people[id];
    if (p) params[`actor:${slot}`] = tr.label(p.name);
  }
  return params;
}

export function resolveParams(params: Record<string, Label | number>, tr: Translator): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) out[k] = typeof v === 'number' ? v : tr.label(v);
  return out;
}

/** "제2대 족장 시절의 세 번째 겨울" */
export function chronicleTime(e: ChronicleEntry, tr: Translator): string {
  const ordKey = `ordinal.${e.seasonIndex}`;
  const ordinal = tr.has(ordKey) ? tr.t(ordKey) : tr.t('ordinal.many');
  return tr.t('chron.time', { reign: e.reign, ordinal, season: tr.t(`season.${e.season}.name`) });
}

export function chronicleSentence(e: ChronicleEntry, tr: Translator): string {
  return tr.t(e.key, resolveParams(e.params, tr));
}

/** 잠긴 선택지·카드의 힌트. 데이터가 키를 주면 그것을, 아니면 첫 실패 조건으로 만든다 */
export function lockHint(failed: readonly Condition[], hintKey: string | undefined, tr: Translator): string {
  if (hintKey) return tr.t(hintKey);
  const c = failed[0];
  if (!c) return tr.t('lockauto.generic');
  switch (c.type) {
    case 'resource':
      return tr.t('lockauto.resource', { name: tr.t(`resource.${c.key}.name`), min: c.min ?? 0 });
    case 'role':
      return tr.t('lockauto.role', { name: tr.t(`role.${c.role}.name`), min: c.min ?? 0 });
    case 'population':
      return tr.t('lockauto.population', { min: c.min ?? 0 });
    default:
      return tr.t('lockauto.generic');
  }
}

/** 카드를 쓸 수 없는 이유 → 짧은 문장 */
export function cardReason(reason: string | null, failed: readonly Condition[], hintKey: string | undefined, tr: Translator): string {
  switch (reason) {
    case 'error.action.locked':
      return lockHint(failed, hintKey, tr);
    case 'error.action.cannotAfford':
      return tr.t('lockauto.cost');
    case 'error.action.noPlays':
      return tr.t('lockauto.noPlays');
    case 'error.action.needsAssignee':
      return tr.t('lockauto.needsAssignee');
    default:
      return reason ? tr.t(reason) : '';
  }
}

export const fmtInt = (v: number) => Math.floor(v + 1e-9);
export const fmtDelta = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r)}`;
};
