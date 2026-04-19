import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import DataQualityClient from './DataQualityClient';

const ADMIN_EMAILS = ['caposk8@hotmail.com', 'caposk817@gmail.com'];

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Data Quality — Monza Admin',
    description:
      'Truth-telling dashboard for scraper and cron job health, ingestion freshness, and field completeness.',
  };
}

export default async function DataQualityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
    redirect(`/${locale}`);
  }

  return <DataQualityClient locale={locale} />;
}
