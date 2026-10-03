import { createClient } from '@supabase/supabase-js'

// Service-role client for server-only use (API routes). Never expose to the client bundle.
export function createSupabaseServiceClient() {
	return createClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!,
		{ auth: { autoRefreshToken: false, persistSession: false } }
	)
}
