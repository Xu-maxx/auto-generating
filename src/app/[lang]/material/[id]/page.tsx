import { getDictionary, type Locale } from '@/lib/dictionaries';
import MaterialPageClient from './MaterialPageClient';

interface ProjectPageProps {
  params: Promise<{ lang: string; id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);

  return <MaterialPageClient params={params} dict={dict} />;
} 