// 아주 작은 번역기. 키가 없으면 키를 그대로 보여 주고(눈에 띄게) 개발 중에 경고한다.
// 변수: {name}, 수 서식 {n:count} {n:num} {n:days} (numerals.ts), 조사 서식 {name:이} {tribe:은} (josa.ts)
// globals: 모든 문자열에 늘 들어가는 변수 (부족 이름 {tribe})

import type { Label } from '../engine';
import { isJosaFormat, withJosa } from './josa';
import { FORMATTERS } from './numerals';

export type Strings = Record<string, string>;
export type Params = Record<string, string | number>;

export interface Translator {
  t: (key: string, params?: Params) => string;
  has: (key: string) => boolean;
  label: (l: Label) => string;
}

/** {이름} 또는 {이름:서식}. 이름은 영문·숫자·밑줄, 서식은 영문 또는 한글 조사 */
export const PLACEHOLDER = /\{(\w+)(?::([\w가-힣]+))?\}/g;

export function format(raw: string, params: Params): string {
  return raw.replace(PLACEHOLDER, (m, name: string, fmt: string | undefined) => {
    const v = params[name];
    if (v === undefined) return m;
    if (!fmt) return String(v);
    if (isJosaFormat(fmt)) return withJosa(String(v), fmt);
    const f = FORMATTERS[fmt];
    return f && typeof v === 'number' ? f(Math.round(v)) : String(v);
  });
}

export function createTranslator(tables: Strings[], globals: Params = {}): Translator {
  const merged: Strings = Object.assign({}, ...tables);
  const warned = new Set<string>();

  const t = (key: string, params?: Params): string => {
    const raw = merged[key];
    if (raw === undefined) {
      if (!warned.has(key)) {
        warned.add(key);
        console.warn(`[i18n] missing key: ${key}`);
      }
      return `⟨${key}⟩`;
    }
    if (!raw.includes('{')) return raw;
    return format(raw, { ...globals, ...params });
  };

  return {
    t,
    has: (key) => merged[key] !== undefined,
    label: (l) => ('key' in l ? t(l.key) : l.raw),
  };
}
