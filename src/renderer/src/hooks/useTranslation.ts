import { createContext, useContext } from 'react'
import type { Translations } from '../../../shared/i18n'
import { TRANSLATIONS } from '../../../shared/i18n'
import type { AppLanguage } from '../../../shared/types'

// ─── Context ──────────────────────────────────────────────────────────────────

export interface I18nContextValue {
  lang: AppLanguage
  tr: Translations
  setLang: (lang: AppLanguage) => void
}

export const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  tr: TRANSLATIONS.en,
  setLang: () => {}
})

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTranslation(): I18nContextValue {
  return useContext(I18nContext)
}
