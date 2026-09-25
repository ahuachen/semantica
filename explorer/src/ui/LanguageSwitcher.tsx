import { useTranslation } from 'react-i18next';

import { persistLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';

// The rail is 88px wide, so the toggle carries short marks and puts the full
// language name in the tooltip.
const SHORT_LABEL: Record<SupportedLanguage, string> = {
  en: 'EN',
  zh: '中',
};

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const active: SupportedLanguage =
    (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.language)
      ? (i18n.language as SupportedLanguage)
      : 'en';

  const select = (language: SupportedLanguage) => {
    if (language === active) return;
    void i18n.changeLanguage(language);
    persistLanguage(language);
  };

  return (
    <div className="lang-switcher" role="group" aria-label={t('language.label')}>
      {SUPPORTED_LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          className="lang-option"
          data-active={language === active}
          aria-pressed={language === active}
          title={t(`language.${language}`)}
          onClick={() => select(language)}
        >
          {SHORT_LABEL[language]}
        </button>
      ))}
    </div>
  );
}
