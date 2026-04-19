import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createRawClient } from '@supabase/supabase-js';
import { getAllKnownScraperNames } from '@/features/scrapers/common/sourceRegistry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_EMAILS = ['caposk8@hotmail.com', 'caposk817@gmail.com'];

function serviceClient() {
  return createRawClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const supabaseAuth = await createServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
    return NextResponse.json(
      { status: 401, code: 'AUTH_REQUIRED', message: 'Admin access required' },
      { status: 401 },
    );
  }

  const { name } = await ctx.params;
  const known = getAllKnownScraperNames();
  // Accept unknown names too — operator may want to debug one that's not in the
  // registry (e.g. a newly-added collector). Only reject obviously invalid chars.
  if (!/^[a-z0-9-]+$/i.test(name)) {
    return NextResponse.json(
      { status: 400, code: 'INVALID_NAME', message: 'invalid scraper name' },
      { status: 400 },
    );
  }

  const supa = serviceClient();
  const { data, error } = await supa
    .from('scraper_runs')
    .select('*')
    .eq('scraper_name', name)
    .order('started_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json(
      { status: 500, code: 'QUERY_ERROR', message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    status: 200,
    code: 'OK',
    data: {
      scraperName: name,
      knownInRegistry: known.includes(name),
      recentRuns: data ?? [],
    },
  });
}
