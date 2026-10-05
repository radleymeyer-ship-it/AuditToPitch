import { createClient } from '@supabase/supabase-js'

// Session persistence is handled in account.ts via chrome.storage.
export const supabase = createClient(
	import.meta.env.VITE_SUPABASE_URL ?? '',
	import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
	{ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
)
