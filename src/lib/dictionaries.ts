import 'server-only';

const dictionaries = {
  en: () => import('@/dictionaries/en.json').then((module) => module.default),
  zh: () => import('@/dictionaries/zh.json').then((module) => module.default),
} as const;

export type Locale = keyof typeof dictionaries;

export const getDictionary = async (locale: Locale) => {
  return dictionaries[locale]?.() ?? dictionaries.en();
};

export const locales: Locale[] = ['en', 'zh'];
export const defaultLocale: Locale = 'en'; 