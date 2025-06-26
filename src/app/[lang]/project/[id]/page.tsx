import { getDictionary, type Locale } from '@/lib/dictionaries';
import ProjectPageClient from './ProjectPageClient';

interface ProjectPageProps {
  params: Promise<{ lang: string; id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);

  return <ProjectPageClient params={params} dict={dict} />;
} 