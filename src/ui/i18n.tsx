import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createTranslator, type Params, type Translator } from '../i18n';

const Ctx = createContext<Translator | null>(null);

/** globals: 모든 문자열에 들어가는 변수 (부족 이름 {tribe}) */
export function I18nProvider({ tables, globals, children }: { tables: Record<string, string>[]; globals?: Params; children: ReactNode }) {
  const key = JSON.stringify(globals ?? {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tr = useMemo(() => createTranslator(tables, globals), [tables, key]);
  return <Ctx.Provider value={tr}>{children}</Ctx.Provider>;
}

export function useT(): Translator {
  const t = useContext(Ctx);
  if (!t) throw new Error('I18nProvider missing');
  return t;
}
