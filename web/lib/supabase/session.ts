import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Cookie-bound client for server components and route handlers; reads the signed-in user's session.
export async function createSupabaseSessionClient() {
	const cookieStore = await cookies()

	return createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll: () => cookieStore.getAll(),
				setAll(cookiesToSet) {
					try {
						cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
					} catch {
						// Server components cannot set cookies; the proxy refreshes the session instead.
					}
				},
			},
		}
	)
}
