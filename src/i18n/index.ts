// 아주 작은 번역기. 키가 없으면 키를 그대로 보여 주고(눈에 띄게) 개발 중에 경고한다.

import type { Label } from '../engine';
import { FORMATTERS } from './numerals';

export type Strings = Record<string, string>;
export type Params = Record<string, string | number>;

export interface Translator {
  t: (key: string, params?: Params) => string;
  has: (key: string) => boolean;
  label: (l: Label) => string;
}

export function createTranslator(...tables: Strings[]): Translator {
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
    if (!params) return raw;
    // {name} 또는 {name:서식}. 서식은 우리말 수 읽기 (numerals.ts)
    return raw.replace(/\{([\w]+)(?::(\w+))?\}/g, (m, name: string, fmt: string | undefined) => {
      const v = params[name];
      if (v === undefined) return m;
      const f = fmt ? FORMATTERS[fmt] : undefined;
      return f && typeof v === 'number' ? f(Math.round(v)) : String(v);
    });
  };

  return {
    t,
    has: (key) => merged[key] !== undefined,
    label: (l) => ('key' in l ? t(l.key) : l.raw),
  };
}
