// 엔진의 줄(Line)과 수치를 화면 문자열로

import type { Label, Line, LineParamValue } from '../engine';
import type { Translator } from '../i18n';

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
