import { createContext, useContext } from 'react';
import { DEFAULT_LOCALE, zhCN, type LocaleCode, type Messages } from './messages';

/**
 * 类型安全取词：t((m) => m.app.workbench)。
 * selector 在当前语言字典上求值；键缺失（或中间层缺失抛错）时回退 zh-CN。
 */
export type Translate = <T extends string | ((...args: never[]) => string)>(
  selector: (messages: Messages) => T,
) => T;

export interface LocaleContextValue {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: Translate;
}

export const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (selector) => selector(zhCN),
});

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
