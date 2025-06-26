import { locales } from '@/lib/dictionaries';

export async function generateStaticParams() {
  return locales.map((locale) => ({ lang: locale }));
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  return children;
} 