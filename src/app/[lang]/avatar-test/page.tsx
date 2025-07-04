import { getDictionary, type Locale } from '@/lib/dictionaries';
import AvatarTestClient from './AvatarTestClient';

interface AvatarTestPageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AvatarTestPage({ params, searchParams }: AvatarTestPageProps) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);
  const search = await searchParams;

  return <AvatarTestClient dict={dict} searchParams={search} />;
} 