import { getDictionary, Locale } from '@/lib/dictionaries';
import ProductPageClient from './ProductPageClient';

export default async function ProductPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const resolvedParams = await params;
  const dict = await getDictionary(resolvedParams.lang as Locale);
  
  return <ProductPageClient params={params} dict={dict} />;
} 