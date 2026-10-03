import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { getAuditUsage } from '@/lib/audit-quota'
import { extensionCorsHeaders, extensionOptions } from '@/lib/extension-cors'

export function OPTIONS(request: NextRequest) {
	return extensionOptions(request, 'GET, OPTIONS')
}

export async function GET(request: NextRequest) {
	const headers = extensionCorsHeaders(request, 'GET, OPTIONS')
	const authorization = request.headers.get('authorization')
	const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null

	if (!token) {
		return NextResponse.json({ error: 'Missing bearer token' }, { status: 401, headers })
	}

	try {
		const supabase = createSupabaseServiceClient()
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser(token)

		if (authError || !user) {
			return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401, headers })
		}

		const { data: profile, error: profileError } = await supabase
			.from('profiles')
			.select('is_subscribed')
			.eq('id', user.id)
			.maybeSingle()

		if (profileError) {
			return NextResponse.json({ error: 'Failed to load profile' }, { status: 500, headers })
		}
		const isSubscribed = profile?.is_subscribed === true
		let freeAuditsRemaining: number | null = null

		if (!isSubscribed) {
			const usage = await getAuditUsage(supabase, user.id)
			if (usage.error) {
				return NextResponse.json({ error: 'Failed to load free audit balance' }, { status: 500, headers })
			}
			freeAuditsRemaining = usage.remaining
		}

		return NextResponse.json(
			{
				user: { id: user.id, email: user.email },
				is_subscribed: isSubscribed,
				free_audits_remaining: freeAuditsRemaining,
			},
			{ status: 200, headers }
		)
	} catch {
		return NextResponse.json({ error: 'Profile lookup failed' }, { status: 500, headers })
	}
}