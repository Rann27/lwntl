/**
 * LWNTL i18n System
 * React context + hook for multi-language support
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import id from './translations/id'
import en from './translations/en'
import type { TranslationStrings } from './translations/id'

export type Language = 'id' | 'en'

const translations: Record<Language, TranslationStrings> = { id, en }

export const LANGUAGE_OPTIONS: Array<{ value: Language; label: string; flag: string }> = [
  { value: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
]

interface I18nContextValue {
  language: Language
  setLanguage: (lang: Language) => void
  t: TranslationStrings
}

const I18nContext = createContext<I18nContextValue>({
  language: 'id',
  setLanguage: () => {},
  t: id,
})

export function I18nProvider({ children, initialLanguage }: { children: ReactNode; initialLanguage?: Language }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage || 'id')

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    document.documentElement.setAttribute('lang', lang)
  }, [])

  // Set initial lang attribute
  useEffect(() => {
    document.documentElement.setAttribute('lang', language)
  }, [language])

  const t = translations[language]

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}