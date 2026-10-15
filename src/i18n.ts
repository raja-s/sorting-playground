
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';

export const QUERY_STRING_LANGUAGE_PARAMETER_KEY = 'l';

i18n.use(HttpApi)
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		fallbackLng: 'fr',
		supportedLngs: ['fr', 'en'],
		detection: {
			order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
			lookupQuerystring: QUERY_STRING_LANGUAGE_PARAMETER_KEY,
			caches: ['localStorage', 'cookie']
		},
		debug: false,
		interpolation: { escapeValue: false },
		backend: {
			loadPath: `${import.meta.env.BASE_URL}locales/{{lng}}/{{ns}}.json`
		}
	});

export default i18n;
