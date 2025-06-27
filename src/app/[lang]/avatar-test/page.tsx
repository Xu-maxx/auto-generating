import { getDictionary, type Locale } from '@/lib/dictionaries';
import AvatarTestClient from './AvatarTestClient';

interface AvatarTestPageProps {
  params: Promise<{ lang: string }>;
}

export default async function AvatarTestPage({ params }: AvatarTestPageProps) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);

  return <AvatarTestClient dict={dict} />;
} 