import { getDictionary, type Locale } from '@/lib/dictionaries';
import HomePageClient from './HomePageClient';

interface HomePageProps {
  params: Promise<{ lang: string }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);

  return <HomePageClient params={params} dict={dict} />;
} 