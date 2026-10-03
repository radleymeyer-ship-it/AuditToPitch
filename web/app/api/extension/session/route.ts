import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extensionCorsHeaders, extensionOptions } from '@/lib/extension-cors'

export function OPTIONS(request: NextRequest) {
	return extensionOptions(request, 'POST, OPTIONS')
}

export async function POST(request: NextRequest) {
	const headers = extensionCorsHeaders(request, 'POST, OPTIONS')

	let body: unknown
	try {
		body = await request.json()
	} catch {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers })
	}

	const refreshToken =
		typeof body === 'object' && body !== null && 'refresh_token' in body &&
		typeof body.refresh_token === 'string'
			? body.refresh_token
			: null

	if (!refreshToken) {
		return NextResponse.json({ error: 'Missing refresh token' }, { status: 400, headers })
	}

	try {
		const supabase = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
			{ auth: { autoRefreshToken: false, persistSession: false } }
		)
		const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
		const session = data.session

		if (error || !session) {
			return NextResponse.json({ error: 'Session expired; sign in again' }, { status: 401, headers })
		}

		return NextResponse.json(
			{
				access_token: session.access_token,
				refresh_token: session.refresh_token,
				expires_at: session.expires_at,
				user: { id: session.user.id, email: session.user.email },
			},
			{ status: 200, headers }
		)
	} catch {
		return NextResponse.json({ error: 'Failed to refresh session' }, { status: 500, headers })
	}
}