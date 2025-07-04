import { getDictionary, Locale } from '@/lib/dictionaries';
import LoginPageClient from './LoginPageClient';

export default async function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = await params;
  const dict = await getDictionary(resolvedParams.lang as Locale);
  
  return <LoginPageClient params={params} dict={dict} />;
} 