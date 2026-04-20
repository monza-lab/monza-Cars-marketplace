import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

type ServerClientOptions = {
  response?: NextResponse
}

export async function createClient(options: ServerClientOptions = {}) {
  const cookieStore = await cookies()
  const { response } = options

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  return createServerClient(
    supabaseUrl || 'https://placeholder-url.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
            if (response) {
              cookiesToSet.forEach(({ name, value, options }) =>
                response.cookies.set(name, value, options)
              )
            }
          } catch {
            // Ignored in Server Components
          }
        },
      },
    }
  )
}
