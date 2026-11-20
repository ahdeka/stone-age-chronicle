// 아주 작은 번역기. 키가 없으면 키를 그대로 보여 주고(눈에 띄게) 개발 중에 경고한다.

import type { Label } from '../engine';

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
    return raw.replace(/\{([\w:]+)\}/g, (m, name: string) => {
      const v = params[name];
      return v === undefined ? m : String(v);
    });
  };

  return {
    t,
    has: (key) => merged[key] !== undefined,
    label: (l) => ('key' in l ? t(l.key) : l.raw),
  };
}
