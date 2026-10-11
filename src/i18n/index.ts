import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { de } from './de'
import { en } from './en'
import { detectLang } from '../lib/settings'

void i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en } },
  lng: detectLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
