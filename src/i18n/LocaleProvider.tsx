import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_LOCALE,
  DICTIONARIES,
  LOCALE_STORAGE_KEY,
  zhCN,
  type LocaleCode,
  type Messages,
} from './messages';
import { LocaleContext, type Translate } from './LocaleContext';

function loadStoredLocale(): LocaleCode {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === 'zh-CN' || stored === 'en-US') return stored;
  } catch {
    // localStorage 不可用时用默认语言
  }
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(loadStoredLocale);

  const setLocale = useCallback((next: LocaleCode) => {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // 持久化失败仅本次会话生效
    }
  }, []);

  const t = useCallback<Translate>((selector) => {
    if (locale !== DEFAULT_LOCALE) {
      try {
        // 部分翻译字典按完整形状访问；缺失键得到 undefined、缺失中间层抛错，均回退
        const value = selector(DICTIONARIES[locale] as Messages);
        if (value !== undefined) return value;
      } catch {
        // 回退 zh-CN
      }
    }
    return selector(zhCN);
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
