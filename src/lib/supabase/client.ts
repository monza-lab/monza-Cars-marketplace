import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  // During build time (SSG), these might be missing. We provide fallbacks
  // to prevent @supabase/ssr from throwing a validation error that breaks the build.
  // In the browser, these must be present for auth to work.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase Client] Missing environment variables. Auth will not work.')
    // We return a 'dummy' client that satisfies the type if possible, 
    // but the library requires real strings. We use placeholders just to pass build.
    return createBrowserClient(
      supabaseUrl || 'https://placeholder-url.supabase.co',
      supabaseAnonKey || 'placeholder-key'
    )
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
