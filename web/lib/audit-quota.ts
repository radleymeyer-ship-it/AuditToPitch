import type { createSupabaseServiceClient } from '@/lib/supabase/server'

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>

export const FREE_AUDIT_LIMIT = 3

export async function getAuditUsage(supabase: ServiceClient, userId: string) {
	const { count, error } = await supabase
		.from('audits')
		.select('id', { count: 'exact', head: true })
		.eq('user_id', userId)

	return {
		used: count ?? 0,
		remaining: Math.max(0, FREE_AUDIT_LIMIT - (count ?? 0)),
		error,
	}
}