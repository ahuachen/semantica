import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import enGraph from './locales/en/graph.json';
import enOntology from './locales/en/ontology.json';
import enWorkspaces from './locales/en/workspaces.json';
import zhCommon from './locales/zh/common.json';
import zhGraph from './locales/zh/graph.json';
import zhOntology from './locales/zh/ontology.json';
import zhWorkspaces from './locales/zh/workspaces.json';

export const SUPPORTED_LANGUAGES = ['en', 'zh'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// One namespace per module. Keeps the catalogues small enough to review and
// lets separate modules be translated without touching a shared file.
export const NAMESPACES = ['common', 'graph', 'ontology', 'workspaces'] as const;

const STORAGE_KEY = 'semantica.explorer.language';

function isSupported(value: string | null): value is SupportedLanguage {
  return value !== null && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

// This module is also imported by plain-Node unit tests that never set up a
// DOM, so nothing here may assume `window`, `document` or `navigator` exist.
const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';

// A stored choice wins; otherwise follow the browser. localStorage throws in
// private mode and when site data is blocked, so every access is guarded.
function detectLanguage(): SupportedLanguage {
  if (!hasDom) return 'en';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isSupported(stored)) return stored;
  } catch {
    // fall through to browser detection
  }
  const browserLanguage = typeof navigator === 'undefined' ? '' : navigator.language;
  return browserLanguage.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function persistLanguage(language: SupportedLanguage): void {
  if (!hasDom) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // preference is session-only when storage is unavailable
  }
}

void i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      graph: enGraph,
      ontology: enOntology,
      workspaces: enWorkspaces,
    },
    zh: {
      common: zhCommon,
      graph: zhGraph,
      ontology: zhOntology,
      workspaces: zhWorkspaces,
    },
  },
  ns: NAMESPACES,
  defaultNS: 'common',
  lng: detectLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes interpolated values
  },
});

// Keep <html lang> in sync so screen readers and CSS :lang() see the real language.
if (hasDom) {
  document.documentElement.lang = i18n.language;
  i18n.on('languageChanged', (language) => {
    document.documentElement.lang = language;
  });
}

export default i18n;
