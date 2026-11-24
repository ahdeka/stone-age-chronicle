// 엔진의 줄(Line)과 수치를 화면 문자열로

import { calendarDate, type ChapterDefinition, type GameState, type Label, type Line, type LineParamValue } from '../engine';
import type { Translator } from '../i18n';

/** 화면 날짜 "1년차 · 봄 · 3월" (CLAUDE.md "시간") */
export function dateText(tr: Translator, def: ChapterDefinition, state: GameState, month = state.month): string {
  const d = calendarDate(def, state, month);
  return tr.t('ui.date', { year: d.year, season: tr.t(`season.${d.season}`), num: d.number });
}

/** 연대기 같은 좁은 자리의 날짜 "1년차 3월" */
export function shortDateText(tr: Translator, def: ChapterDefinition, state: GameState, month = state.month): string {
  const d = calendarDate(def, state, month);
  return tr.t('ui.date.short', { year: d.year, num: d.number });
}

/** 화면에 보일 부족 이름: 플레이어가 정한 이름, 없으면 프리셋의 첫 추천 이름 */
export function tribeDisplayName(tr: Translator, def: ChapterDefinition, state: GameState | null): string {
  if (state?.tribeName) return state.tribeName;
  const preset = def.presets.find((p) => p.id === state?.presetId) ?? def.presets.find((p) => !p.hidden) ?? def.presets[0];
  const key = preset?.presentation.nameSuggestions[0];
  return key ? tr.t(key) : '';
}

function isLabel(v: LineParamValue): v is Label {
  return typeof v === 'object' && v !== null;
}

export function lineText(tr: Translator, line: Line): string {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(line.params ?? {})) params[k] = isLabel(v) ? tr.label(v) : v;
  return tr.t(line.key, params);
}

export function kg(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}kg`;
}

/** 정산 장부의 출처 키 → 화면 이름 */
export function sourceName(tr: Translator, source: string): string {
  if (source.startsWith('policy.')) return tr.t(`${source}.name`);
  if (source.startsWith('event.')) return tr.t(`${source}.title`);
  return tr.t(`src.${source}`);
}

export function resName(tr: Translator, res: string): string {
  return tr.t(`res.${res}`);
}

/** 이번 달 날씨를 한 줄로: 서로 다른 날씨만, 순서대로 (맑음, 서리) */
export function weatherSummary(tr: Translator, state: GameState): string {
  return [...new Set(state.work.weather.filter(Boolean))].map((w) => tr.t(`weather.${w}`)).join(', ');
}
