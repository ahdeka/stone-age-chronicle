import { createContext, useContext, type ReactNode } from 'react';
import { createTranslator, type Translator } from '../i18n';

const Ctx = createContext<Translator | null>(null);

export function I18nProvider({ tables, children }: { tables: Record<string, string>[]; children: ReactNode }) {
  return <Ctx.Provider value={createTranslator(...tables)}>{children}</Ctx.Provider>;
}

export function useT(): Translator {
  const t = useContext(Ctx);
  if (!t) throw new Error('I18nProvider missing');
  return t;
}
